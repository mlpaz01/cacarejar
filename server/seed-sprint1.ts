/**
 * Seed do Sprint 1: planos, taxonomia de fatores (Teste A/Z), custos de modelo,
 * regras de política e créditos iniciais para a org admin (testes).
 * Idempotente: usa onDuplicateKeyUpdate por chave única.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import {
  plans, factorDefinitions, aiModelCost, contentPolicyRules,
  organizations, creditWallet, creditLedger,
} from "../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL!);

// ─── Planos ───────────────────────────────────────────────────────────────
const PLANS = [
  { key: "free", name: "Free", priceCents: 0, ccIncluded: 300, dailyQuotaCC: 180, sortOrder: 1,
    limits: { campanhas: 1, criativos: 50 }, allowedModels: ["barato"] },
  { key: "starter", name: "Starter", priceCents: 9700, ccIncluded: 1000, dailyQuotaCC: 240, sortOrder: 2,
    limits: { campanhas: 5, criativos: 500 }, allowedModels: ["barato", "padrao"] },
  { key: "crescimento", name: "Crescimento", priceCents: 29700, ccIncluded: 4000, dailyQuotaCC: 400, sortOrder: 3,
    limits: { campanhas: 15, criativos: 2000 }, allowedModels: ["padrao"] },
  { key: "escala", name: "Escala", priceCents: 69700, ccIncluded: 12000, dailyQuotaCC: 1200, sortOrder: 4,
    limits: { campanhas: 999, criativos: 99999 }, allowedModels: ["padrao", "alta"] },
  { key: "agencia", name: "Agência", priceCents: 199700, ccIncluded: 40000, dailyQuotaCC: 5000, sortOrder: 5,
    limits: { campanhas: 999, criativos: 99999 }, allowedModels: ["padrao", "alta", "premium"] },
];

// ─── Taxonomia A/Z ──────────────────────────────────────────────────────────
type V = { key: string; label: string; promptFragment?: string };
const v = (key: string, label: string, pf?: string): V => ({ key, label, promptFragment: pf });

const FACTORS: { key: string; dimensao: "imagem"|"copy"|"oferta"|"publico"; label: string; sortOrder: number; values: V[] }[] = [
  { key: "img_tipo", dimensao: "imagem", label: "Tipo de imagem", sortOrder: 1, values: [
    v("pessoa","Com pessoas","com uma pessoa em destaque"), v("animal","Mascote/animal","com um mascote ou animal"),
    v("objeto","Produto","com o produto em destaque"), v("tecnologico","Tecnológica","estilo tecnológico e moderno"),
    v("abstrato","Abstrata","composição abstrata"), v("alimento","Alimento","alimento apetitoso em destaque"),
    v("cenario","Cenário","um cenário ambiente") ] },
  { key: "img_pessoa_idade", dimensao: "imagem", label: "Idade da pessoa", sortOrder: 2, values: [
    v("jovem_18_25","Jovem 18–25","pessoa jovem de 18 a 25 anos"), v("adulto_26_40","Adulto 26–40","pessoa adulta de 26 a 40 anos"),
    v("maduro_41_60","Maduro 41–60","pessoa madura de 41 a 60 anos"), v("na","Não se aplica") ] },
  { key: "img_pessoa_sexo", dimensao: "imagem", label: "Sexo da pessoa", sortOrder: 3, values: [
    v("feminino","Feminino","pessoa do sexo feminino"), v("masculino","Masculino","pessoa do sexo masculino"),
    v("ambos","Ambos","pessoas de ambos os sexos"), v("na","Não se aplica") ] },
  { key: "img_pessoa_etnia", dimensao: "imagem", label: "Etnia", sortOrder: 4, values: [
    v("branca","Branca","pessoa branca"), v("negra","Negra","pessoa negra"), v("parda","Parda","pessoa parda"),
    v("asiatica","Asiática","pessoa asiática"), v("indigena","Indígena","pessoa indígena"),
    v("diversa","Diversa","grupo diverso"), v("na","Não se aplica") ] },
  { key: "img_emocao", dimensao: "imagem", label: "Emoção/expressão", sortOrder: 5, values: [
    v("sorriso","Sorrindo","sorrindo e feliz"), v("serio","Sério","expressão séria"),
    v("surpreso","Surpreso","expressão surpresa"), v("aspiracional","Aspiracional","olhar aspiracional"),
    v("neutro","Neutro","expressão neutra") ] },
  { key: "img_cor_predominante", dimensao: "imagem", label: "Cor predominante", sortOrder: 6, values: [
    v("laranja","Laranja","paleta predominante laranja"), v("vermelho","Vermelho","paleta vermelha"),
    v("azul","Azul","paleta azul"), v("verde","Verde","paleta verde"), v("amarelo","Amarelo","paleta amarela"),
    v("roxo","Roxo","paleta roxa"), v("rosa","Rosa","paleta rosa"), v("preto_branco","P&B","preto e branco"),
    v("pastel","Pastel","tons pastel"), v("neutro","Neutro","tons neutros") ] },
  { key: "img_estilo", dimensao: "imagem", label: "Estilo visual", sortOrder: 7, values: [
    v("foto_realista","Foto realista","fotografia realista"), v("ilustracao","Ilustração","ilustração"),
    v("render_3d","3D","render 3D"), v("minimalista","Minimalista","estilo minimalista"),
    v("colagem","Colagem","colagem"), v("meme","Meme","estilo meme") ] },
  { key: "img_cenario", dimensao: "imagem", label: "Cenário", sortOrder: 8, values: [
    v("estudio","Estúdio","fundo de estúdio"), v("ambiente_real","Ambiente real","ambiente real"),
    v("externo_natureza","Externo/natureza","ambiente externo natural"), v("escritorio","Escritório","escritório"),
    v("casa","Casa","ambiente de casa"), v("fundo_solido","Fundo sólido","fundo de cor sólida") ] },
  { key: "img_texto_na_imagem", dimensao: "imagem", label: "Texto na imagem", sortOrder: 9, values: [
    v("sem_texto","Sem texto","sem texto na arte"), v("palavra_chave","Palavra-chave","com uma palavra-chave em destaque"),
    v("headline","Headline","com uma headline curta"), v("oferta_grande","Oferta grande","com a oferta em destaque") ] },
  { key: "img_enquadramento", dimensao: "imagem", label: "Enquadramento", sortOrder: 10, values: [
    v("close","Close","close-up"), v("meio_corpo","Meio corpo","plano médio"),
    v("corpo_inteiro","Corpo inteiro","corpo inteiro"), v("produto_isolado","Produto isolado","produto isolado"),
    v("flat_lay","Flat lay","flat lay visto de cima"), v("panoramica","Panorâmica","plano panorâmico") ] },

  { key: "copy_tom", dimensao: "copy", label: "Tom da copy", sortOrder: 20, values: [
    v("direto","Direto"), v("amigavel","Amigável"), v("empolgante","Empolgante"), v("emocional","Emocional"),
    v("empatia","Empatia"), v("autoridade","Autoridade"), v("urgencia","Urgência"), v("curiosidade","Curiosidade") ] },
  { key: "copy_formato", dimensao: "copy", label: "Formato da copy", sortOrder: 21, values: [
    v("pergunta","Pergunta"), v("historia","História"), v("lista","Lista"), v("prova_social","Prova social"),
    v("oferta_direta","Oferta direta"), v("antes_depois","Antes/depois"), v("mito_verdade","Mito x verdade") ] },
  { key: "copy_gatilho", dimensao: "copy", label: "Gatilho mental", sortOrder: 22, values: [
    v("escassez","Escassez"), v("urgencia","Urgência"), v("prova_social","Prova social"), v("autoridade","Autoridade"),
    v("reciprocidade","Reciprocidade"), v("novidade","Novidade"), v("pertencimento","Pertencimento"), v("medo_perda","Medo da perda") ] },
  { key: "copy_cta", dimensao: "copy", label: "Chamada (CTA)", sortOrder: 23, values: [
    v("compre_agora","Compre agora"), v("saiba_mais","Saiba mais"), v("garanta_vaga","Garanta sua vaga"),
    v("fale_conosco","Fale conosco"), v("baixe_gratis","Baixe grátis"), v("comece_agora","Comece agora") ] },

  { key: "of_angulo", dimensao: "oferta", label: "Angulo de venda", sortOrder: 30, values: [
    v("dor","Dor"), v("desejo","Desejo"), v("transformacao","Transformação"), v("curiosidade","Curiosidade"), v("status","Status") ] },
  { key: "of_prova_social", dimensao: "oferta", label: "Prova social", sortOrder: 31, values: [
    v("nenhuma","Nenhuma"), v("depoimento","Depoimento"), v("numeros","Números"), v("selo_autoridade","Selo de autoridade"), v("midia","Mídia") ] },
  { key: "of_preco", dimensao: "oferta", label: "Preço/oferta", sortOrder: 32, values: [
    v("sem_preco","Sem preço"), v("preco_cheio","Preço cheio"), v("desconto","Desconto"),
    v("ancoragem","Ancoragem"), v("parcelado","Parcelado"), v("gratis_isca","Grátis (isca)") ] },

  { key: "pub_idade", dimensao: "publico", label: "Faixa etária", sortOrder: 40, values: [
    v("18_24","18–24"), v("25_34","25–34"), v("35_44","35–44"), v("45_54","45–54"), v("55mais","55+"), v("amplo","Amplo") ] },
  { key: "pub_sexo", dimensao: "publico", label: "Sexo do público", sortOrder: 41, values: [
    v("feminino","Feminino"), v("masculino","Masculino"), v("todos","Todos") ] },
  { key: "pub_canal", dimensao: "publico", label: "Canal", sortOrder: 42, values: [
    v("instagram","Instagram"), v("facebook","Facebook"), v("tiktok","TikTok"),
    v("google_search","Google Search"), v("google_display","Google Display"), v("linkedin","LinkedIn") ] },
];

const MODEL_COSTS = [
  { operation: "imagem_padrao", model: "flux-2-dev", realCostUsdMicros: 24000, chargedCC: 15, isDefault: true },
  { operation: "imagem_alta", model: "gemini-2.5-flash-image", realCostUsdMicros: 39000, chargedCC: 30, isDefault: true },
  { operation: "copy", model: "gemini-2.5-flash-lite", realCostUsdMicros: 600, chargedCC: 5, isDefault: true },
  { operation: "diagnostico", model: "claude-sonnet", realCostUsdMicros: 50000, chargedCC: 30, isDefault: true },
];

const POLICY = [
  { term: "renda garantida", action: "bloqueia" as const, note: "Promessa de renda garantida derruba conta" },
  { term: "ganhe dinheiro fácil", action: "bloqueia" as const, note: "Promessa enganosa" },
  { term: "cura", action: "flag" as const, note: "Termo de saúde sensível" },
  { term: "antes e depois", action: "flag" as const, note: "Antes/depois saúde é sensível" },
];

async function main() {
  console.log("[seed] Planos...");
  for (const p of PLANS) {
    await db.insert(plans).values(p).onDuplicateKeyUpdate({
      set: { name: p.name, priceCents: p.priceCents, ccIncluded: p.ccIncluded, dailyQuotaCC: p.dailyQuotaCC, limits: p.limits, allowedModels: p.allowedModels, sortOrder: p.sortOrder },
    });
  }

  console.log("[seed] Taxonomia de fatores...");
  for (const f of FACTORS) {
    await db.insert(factorDefinitions).values({ key: f.key, dimensao: f.dimensao, label: f.label, values: f.values, sortOrder: f.sortOrder })
      .onDuplicateKeyUpdate({ set: { label: f.label, values: f.values, sortOrder: f.sortOrder } });
  }
  console.log(`[seed]   ${FACTORS.length} fatores`);

  console.log("[seed] Custos de modelo...");
  for (const m of MODEL_COSTS) {
    const exists = await db.select().from(aiModelCost).where(eq(aiModelCost.operation, m.operation)).limit(1);
    if (exists.length === 0) await db.insert(aiModelCost).values(m);
  }

  console.log("[seed] Política de conteúdo...");
  for (const r of POLICY) {
    const exists = await db.select().from(contentPolicyRules).where(eq(contentPolicyRules.term, r.term)).limit(1);
    if (exists.length === 0) await db.insert(contentPolicyRules).values(r);
  }

  console.log("[seed] Créditos iniciais para orgs existentes (teste)...");
  const orgs = await db.select().from(organizations);
  for (const org of orgs) {
    const w = await db.select().from(creditWallet).where(eq(creditWallet.organizationId, org.id)).limit(1);
    if (w.length === 0) {
      await db.insert(creditWallet).values({ organizationId: org.id, balanceCC: 5000, heldCC: 0 });
      await db.insert(creditLedger).values({ organizationId: org.id, type: "bonus", amountCC: 5000, description: "Créditos de boas-vindas (seed)" });
      console.log(`[seed]   org ${org.id} (${org.name}) +5000 CC`);
    }
  }

  console.log("[seed] Concluído ✅");
  process.exit(0);
}

main().catch(e => { console.error("[seed] erro:", e); process.exit(1); });
