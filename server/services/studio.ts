/**
 * Serviço do Estúdio de Criação.
 * Monta prompt a partir das características, gera copy (OpenRouter c/ fallback)
 * e imagem (ImageProvider), debitando créditos via hold→settle.
 */
import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "../db";
import { factorDefinitions, creatives } from "../../drizzle/schema";
import { getImageProvider } from "./imageProvider";
import * as credits from "./credits";
import { openRouterChat } from "../openrouter";

export async function listFactors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(factorDefinitions).where(eq(factorDefinitions.isActive, true)).orderBy(asc(factorDefinitions.sortOrder));
}

/** Monta o prompt de imagem (determinístico) a partir das características. */
function buildImagePrompt(produto: string, fv: Record<string, string>, factorMap: Map<string, any>): string {
  const frags: string[] = [`anúncio profissional para: ${produto}`];
  for (const [k, val] of Object.entries(fv)) {
    const def = factorMap.get(k);
    if (!def) continue;
    const valDef = (def.values as any[]).find(v => v.key === val);
    if (valDef?.promptFragment) frags.push(valDef.promptFragment);
  }
  frags.push("alta qualidade, composição para mídia social, sem texto sobreposto");
  return frags.join(", ");
}

/** Gera a copy. Tenta OpenRouter; se falhar/sem chave, usa template pelas características. */
async function generateCopy(produto: string, fv: Record<string, string>): Promise<string> {
  const tom = fv.copy_tom ?? "amigavel";
  const formato = fv.copy_formato ?? "oferta_direta";
  const cta = fv.copy_cta ?? "saiba_mais";
  const angulo = fv.of_angulo ?? "desejo";

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const content = await openRouterChat(
        [
          { role: "system", content: "Você é um copywriter de anúncios brasileiro. Escreva UMA copy curta (até 2 frases) para anúncio, em PT-BR, sem hashtags, sem emojis em excesso (no máximo 1). Retorne só a copy." },
          { role: "user", content: `Produto: ${produto}\nTom: ${tom}\nFormato: ${formato}\nÂngulo: ${angulo}\nCTA desejado: ${cta}\nEscreva a copy.` },
        ],
        { model: "anthropic/claude-3.5-haiku", temperature: 0.9, maxTokens: 150 }
      );
      const c = content.trim().replace(/^["']|["']$/g, "");
      if (c) return c;
    } catch {
      /* cai no template */
    }
  }

  // Template de fallback (sem LLM)
  const ctaText: Record<string, string> = {
    compre_agora: "Compre agora", saiba_mais: "Saiba mais", garanta_vaga: "Garanta sua vaga",
    fale_conosco: "Fale conosco", baixe_gratis: "Baixe grátis", comece_agora: "Comece agora",
  };
  const ganchoPorAngulo: Record<string, string> = {
    dor: `Cansado de não ter resultado com ${produto.toLowerCase()}?`,
    desejo: `Imagine ter o resultado que você sempre quis com ${produto.toLowerCase()}.`,
    transformacao: `A transformação que você procura começa com ${produto.toLowerCase()}.`,
    curiosidade: `O segredo por trás de ${produto.toLowerCase()} que ninguém te conta.`,
    status: `Quem usa ${produto.toLowerCase()} já saiu na frente.`,
  };
  const gancho = ganchoPorAngulo[angulo] ?? ganchoPorAngulo.desejo;
  return `${gancho} ${ctaText[cta] ?? "Saiba mais"} 👉`;
}

const COR = ["laranja", "azul", "verde", "roxo", "rosa", "vermelho"];

/**
 * Gera variações. Se az=true, varia automaticamente ângulo × formato × cor de forma
 * balanceada para alimentar o Teste A/Z. Cada variação debita créditos (hold→settle).
 */
export async function generateVariations(params: {
  orgId: number;
  userId: number;
  produto: string;
  ratio: string;
  baseFactors: Record<string, string>;
  qty: number;
  az: boolean;
  refImageUrl?: string; // clonar a partir de um post enviado
}) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  const factors = await listFactors();
  const factorMap = new Map(factors.map(f => [f.key, f]));
  const provider = getImageProvider();

  const angulos = params.az ? ["desejo", "dor", "transformacao"] : [params.baseFactors.of_angulo ?? "desejo"];
  const formatos = params.az ? ["oferta_direta", "historia", "prova_social"] : [params.baseFactors.copy_formato ?? "oferta_direta"];
  const qty = Math.max(1, Math.min(params.qty, 8));

  // 1. Monta as specs e RESERVA créditos (sequencial, rápido). Para se faltar saldo/cota.
  const cc = credits.CC_COST.imagem_padrao;
  const jobs: { fv: Record<string, string>; lente: "dor" | "desejo"; holdId: number }[] = [];
  let stopped: string | undefined;
  for (let i = 0; i < qty; i++) {
    const fv: Record<string, string> = { ...params.baseFactors };
    if (params.az) {
      fv.of_angulo = angulos[i % angulos.length];
      fv.copy_formato = formatos[Math.floor(i / angulos.length) % formatos.length];
      if (!params.baseFactors.img_cor_predominante) fv.img_cor_predominante = COR[i % COR.length];
    }
    const lente = (fv.of_angulo === "dor" ? "dor" : "desejo") as "dor" | "desejo";
    const hold = await credits.hold(params.orgId, cc, `creative:new`, { description: "Geração de criativo" });
    if (!hold.ok) { stopped = hold.reason; break; }
    jobs.push({ fv, lente, holdId: hold.holdLedgerId });
  }

  // 2. Gera imagem + copy EM PARALELO (imagens reais são lentas — não pode ser sequencial).
  const results = await Promise.all(
    jobs.map(async job => {
      try {
        const prompt = buildImagePrompt(params.produto, job.fv, factorMap);
        const [img, copy] = await Promise.all([
          provider.generate({ prompt, ratio: params.ratio, factorValues: job.fv, produto: params.produto, refImageUrl: params.refImageUrl }),
          generateCopy(params.produto, job.fv),
        ]);
        const ins = await db.insert(creatives).values({
          organizationId: params.orgId, userId: params.userId, briefing: params.produto,
          copy, imageUrl: img.imageUrl, ratio: params.ratio, lente: job.lente, formato: job.fv.copy_formato,
          factorValues: job.fv, generationMeta: { model: img.model, prompt, cloned: !!params.refImageUrl }, status: "rascunho",
        });
        const id = credits.insertIdOf(ins);
        await credits.settle(params.orgId, job.holdId, img.realCostUsdMicros);
        return { id, copy, imageUrl: img.imageUrl, lente: job.lente, formato: job.fv.copy_formato, factorValues: job.fv };
      } catch (e) {
        await credits.release(params.orgId, job.holdId).catch(() => {});
        console.error("[studio] falha em uma variação:", (e as any)?.message);
        return null;
      }
    })
  );

  const out = results.filter(Boolean) as any[];
  return { creatives: out, generated: out.length, stopped };
}

/**
 * Gera as PROPOSTAS de post do diagnóstico a partir dos `postIdeas` do plano.
 * Cada ideia já vem com um prompt MEMORÁVEL de direção de arte (visualPrompt, padrão
 * Higgsfield) embebido com o DNA visual da marca (padrão Pomelli). Reforçamos a
 * consistência usando um post campeão como referência (img2img). Guardamos no criativo
 * todo o briefing (gancho, copy, hashtags, cta, roteiro) para o cliente poder EDITAR.
 */
export async function generateProposals(params: { orgId: number; userId: number; plan: any }) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const plan = params.plan ?? {};
  const produto: string = plan.produto || "seu produto";
  const profile = plan.profile;
  const refs: (string | undefined)[] = (profile?.topPosts ?? []).map((p: any) => p.img);
  const baseFactors: Record<string, string> = {};
  for (const [k, v] of Object.entries(plan.suggestedFactors ?? {})) if (v) baseFactors[k] = String(v);

  // ideias do plano (sempre existem; o diagnóstico produz fallback). Limita a 4.
  const ideas: any[] = (plan.postIdeas ?? []).slice(0, 4);
  if (ideas.length === 0) ideas.push({ titulo: produto, pilar: "conteúdo", formato: "imagem", angulo: "desejo", copy: "", visualPrompt: buildImagePrompt(produto, baseFactors, new Map()) });

  const provider = getImageProvider();
  const cc = credits.CC_COST.imagem_padrao;
  const jobs: { idea: any; ref?: string; fv: Record<string, string>; holdId: number }[] = [];
  let stopped: string | undefined;
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const fv: Record<string, string> = { ...baseFactors, of_angulo: idea.angulo === "transformacao" ? "transformacao" : idea.angulo || "desejo" };
    const hold = await credits.hold(params.orgId, cc, "creative:proposal", { description: "Proposta de post (diagnóstico)" });
    if (!hold.ok) { stopped = hold.reason; break; }
    jobs.push({ idea, ref: refs[i] || refs[0] || undefined, fv, holdId: hold.holdLedgerId });
  }

  const results = await Promise.all(
    jobs.map(async job => {
      const idea = job.idea;
      try {
        // prompt memorável + (se houver referência) reforço de consistência de estilo.
        const prompt = job.ref
          ? `${idea.visualPrompt}\nKeep the same visual style, color palette and mood as the reference image.`
          : idea.visualPrompt;
        const copyPromise = idea.copy ? Promise.resolve(idea.copy) : generateCopy(`${produto} — ${idea.pilar}`, job.fv);
        const [img, copy] = await Promise.all([
          provider.generate({ prompt, ratio: "1:1", factorValues: job.fv, produto, refImageUrl: job.ref }),
          copyPromise,
        ]);
        const lente = (job.fv.of_angulo === "dor" ? "dor" : "desejo") as "dor" | "desejo";
        const meta = {
          model: img.model, visualPrompt: idea.visualPrompt, clonedFrom: job.ref ?? null,
          titulo: idea.titulo, pilar: idea.pilar, formato: idea.formato, angulo: idea.angulo,
          gancho: idea.gancho ?? null, hashtags: idea.hashtags ?? [], cta: idea.cta ?? null, roteiro: idea.roteiro ?? null,
        };
        const ins = await db.insert(creatives).values({
          organizationId: params.orgId, userId: params.userId, briefing: `${idea.titulo || produto}`,
          copy, imageUrl: img.imageUrl, ratio: "1:1", lente, formato: idea.formato || "imagem",
          factorValues: job.fv, generationMeta: meta, status: "rascunho",
        });
        const id = credits.insertIdOf(ins);
        await credits.settle(params.orgId, job.holdId, img.realCostUsdMicros);
        return { id, imageUrl: img.imageUrl, copy, lente, ...meta };
      } catch (e) {
        await credits.release(params.orgId, job.holdId).catch(() => {});
        console.error("[studio] falha em proposta:", (e as any)?.message);
        return null;
      }
    })
  );
  const out = results.filter(Boolean) as any[];
  // persiste creativeId + imageUrl em planoJson.postIdeas → sobrevive à navegação
  try {
    const diag = await import("./diagnosis");
    await diag.attachCreativesToPostIdeas(params.orgId, out.map(o => ({ id: o.id, imageUrl: o.imageUrl })));
  } catch (e) { console.error("[studio] attachCreativesToPostIdeas falhou:", (e as any)?.message); }
  return { creatives: out, generated: out.length, stopped };
}

/** Gera UM criativo a partir de uma ideia (Radar de Mercado / adaptações). refImageUrl = estilo do cliente. */
export async function generateFromIdea(orgId: number, userId: number, idea: any, refImageUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const provider = getImageProvider();
  const cc = credits.CC_COST.imagem_padrao;
  const fv: Record<string, string> = { of_angulo: idea.angulo === "transformacao" ? "transformacao" : (idea.angulo || "desejo") };
  const hold = await credits.hold(orgId, cc, "creative:radar", { description: "Conteúdo do Radar de Mercado" });
  if (!hold.ok) throw new Error(hold.reason === "quota" ? "Cota diária atingida" : "Créditos insuficientes");
  try {
    const prompt = refImageUrl ? `${idea.visualPrompt}\nKeep the same visual style, color palette and mood as the reference image.` : idea.visualPrompt;
    const copyP = idea.copy ? Promise.resolve(idea.copy) : generateCopy(idea.titulo || "", fv);
    const [img, copy] = await Promise.all([
      provider.generate({ prompt, ratio: "1:1", factorValues: fv, produto: idea.titulo || "", refImageUrl }),
      copyP,
    ]);
    const lente = (fv.of_angulo === "dor" ? "dor" : "desejo") as "dor" | "desejo";
    const meta = {
      model: img.model, visualPrompt: idea.visualPrompt, clonedFrom: refImageUrl ?? null,
      titulo: idea.titulo, pilar: idea.fonte ? `Inspirado em @${idea.fonte}` : (idea.pilar ?? null), formato: idea.formato, angulo: idea.angulo,
      gancho: idea.gancho ?? null, hashtags: idea.hashtags ?? [], cta: idea.cta ?? null, roteiro: idea.roteiro ?? null, fonte: idea.fonte ?? null,
    };
    const ins = await db.insert(creatives).values({
      organizationId: orgId, userId, briefing: idea.titulo || "Conteúdo do Radar",
      copy, imageUrl: img.imageUrl, ratio: "1:1", lente, formato: idea.formato || "imagem",
      factorValues: fv, generationMeta: meta, status: "rascunho",
    });
    const id = credits.insertIdOf(ins);
    await credits.settle(orgId, hold.holdLedgerId, img.realCostUsdMicros);
    return { id, imageUrl: img.imageUrl, copy, ...meta };
  } catch (e) {
    await credits.release(orgId, hold.holdLedgerId).catch(() => {});
    throw e;
  }
}

/** Detalhe de um criativo (para o editor de Criativos). */
export async function getCreative(orgId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(creatives).where(eq(creatives.id, id)).limit(1);
  const c = rows[0];
  if (!c || c.organizationId !== orgId) return null;
  return c;
}

/** Edita campos textuais e o brief do criativo. Aceita qualquer campo do brief (gancho, hashtags, cta, roteiro...). */
export async function updateCreative(orgId: number, id: number, patch: {
  copy?: string; briefing?: string; visualPrompt?: string; gancho?: string; hashtags?: string[]; cta?: string;
  pilar?: string; angulo?: string; formato?: string; roteiro?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const c = await getCreative(orgId, id);
  if (!c) throw new Error("Criativo não encontrado");
  const set: any = {};
  if (typeof patch.copy === "string") set.copy = patch.copy;
  if (typeof patch.briefing === "string") set.briefing = patch.briefing;
  if (typeof patch.formato === "string") set.formato = patch.formato;

  const meta = { ...((c.generationMeta as any) ?? {}) };
  let metaChanged = false;
  for (const k of ["visualPrompt", "gancho", "hashtags", "cta", "pilar", "angulo", "formato", "roteiro"] as const) {
    if ((patch as any)[k] !== undefined) { meta[k] = (patch as any)[k]; metaChanged = true; }
  }
  if (metaChanged) set.generationMeta = meta;

  if (Object.keys(set).length) await db.update(creatives).set(set).where(eq(creatives.id, id));
  return { ok: true };
}

/** Versiona a imagem do criativo. Mantém histórico em generationMeta.versions[]. */
async function pushVersion(orgId: number, id: number, newImageUrl: string, kind: "regen" | "upload" | "revert", extra: any = {}) {
  const db = await getDb();
  if (!db) return;
  const c = await getCreative(orgId, id);
  if (!c) return;
  const meta = { ...((c.generationMeta as any) ?? {}) };
  const versions: any[] = Array.isArray(meta.versions) ? meta.versions : [];
  // guarda a imagem ANTERIOR como item da timeline (mais útil pra voltar)
  if (c.imageUrl) versions.push({ imageUrl: c.imageUrl, at: Date.now(), kind: meta._lastKind ?? "previous", ...(meta._lastExtra ?? {}) });
  meta.versions = versions.slice(-10); // últimas 10
  meta._lastKind = kind;
  meta._lastExtra = extra;
  await db.update(creatives).set({ imageUrl: newImageUrl, generationMeta: meta }).where(eq(creatives.id, id));
}

/** Sobe uma imagem do cliente (dataUrl base64) como a imagem do criativo. Versiona a anterior. */
export async function setImageFromDataUrl(orgId: number, id: number, dataUrl: string) {
  const c = await getCreative(orgId, id);
  if (!c) throw new Error("Criativo não encontrado");
  const saved = await saveReference(orgId, dataUrl);
  await pushVersion(orgId, id, saved.url, "upload", { source: "user-upload" });
  return { imageUrl: saved.url };
}

/** Exclui um criativo. Bloqueia se estiver em uso em campanha/experimento (status != rascunho/rejeitado). */
export async function deleteCreative(orgId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const c = await getCreative(orgId, id);
  if (!c) throw new Error("Criativo não encontrado");
  const blocked = ["aprovado", "em_uso", "agendado", "no_ar", "em_revisao", "aguardando_cliente"];
  if (c.status && blocked.includes(c.status)) {
    throw new Error(`Não posso excluir um criativo com status "${c.status}". Rejeite primeiro.`);
  }
  await db.delete(creatives).where(eq(creatives.id, id));
  return { ok: true };
}

/** Restaura uma versão anterior da imagem. */
export async function revertImage(orgId: number, id: number, imageUrl: string) {
  const c = await getCreative(orgId, id);
  if (!c) throw new Error("Criativo não encontrado");
  await pushVersion(orgId, id, imageUrl, "revert");
  return { imageUrl };
}

/** Regera a IMAGEM de um criativo usando seu visualPrompt (ou um override). Debita créditos. */
export async function regenerateImage(orgId: number, userId: number, id: number, opts: { promptOverride?: string; keepStyle?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  const c = await getCreative(orgId, id);
  if (!c) throw new Error("Criativo não encontrado");
  const meta = (c.generationMeta as any) ?? {};
  const visualPrompt = opts.promptOverride || meta.visualPrompt || c.briefing || "social media post";
  const ref = opts.keepStyle === false ? undefined : (meta.clonedFrom || undefined);
  const provider = getImageProvider();
  const cc = credits.CC_COST.imagem_padrao;
  const hold = await credits.hold(orgId, cc, "creative:regen", { description: "Regerar imagem do criativo" });
  if (!hold.ok) throw new Error(hold.reason === "quota" ? "Cota diária atingida" : "Créditos insuficientes");
  try {
    const prompt = ref ? `${visualPrompt}\nKeep the same visual style, color palette and mood as the reference image.` : visualPrompt;
    const img = await provider.generate({ prompt, ratio: c.ratio || "1:1", factorValues: (c.factorValues as any) ?? {}, produto: c.briefing || "", refImageUrl: ref });
    // versiona a imagem anterior antes de trocar
    await pushVersion(orgId, id, img.imageUrl, "regen", { model: img.model, prompt });
    // atualiza prompt/modelo no meta
    const cur = await getCreative(orgId, id);
    const meta2 = { ...((cur?.generationMeta as any) ?? {}), model: img.model, visualPrompt };
    await db.update(creatives).set({ generationMeta: meta2 }).where(eq(creatives.id, id));
    await credits.settle(orgId, hold.holdLedgerId, img.realCostUsdMicros);
    return { imageUrl: img.imageUrl };
  } catch (e) {
    await credits.release(orgId, hold.holdLedgerId).catch(() => {});
    throw e;
  }
}

export async function listRecentCreatives(orgId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creatives).where(eq(creatives.organizationId, orgId)).orderBy(desc(creatives.createdAt)).limit(limit);
}

/** Baixa uma imagem remota (ex.: post do Instagram) e salva em /uploads. Retorna URL pública absoluta. */
export async function importImageUrl(orgId: number, remoteUrl: string): Promise<{ url: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const { nanoid } = await import("nanoid");
  const res = await fetch(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Não consegui baixar a imagem do post");
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const dir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = `ref_${orgId}_${nanoid()}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  const base = process.env.PUBLIC_URL || "https://cacarejar.com.br";
  return { url: `${base}/uploads/${file}` };
}

/** Salva uma imagem de referência (post de sucesso) enviada pelo cliente. Retorna a URL pública. */
export async function saveReference(orgId: number, dataUrl: string): Promise<{ url: string }> {
  const fs = await import("fs");
  const path = await import("path");
  const { nanoid } = await import("nanoid");
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) throw new Error("Imagem inválida");
  const ext = m[1].split("/")[1].replace("jpeg", "jpg");
  const dir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = `ref_${orgId}_${nanoid()}.${ext}`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(m[2], "base64"));
  const base = process.env.PUBLIC_URL || "https://cacarejar.com.br";
  return { url: `${base}/uploads/${file}` };
}
