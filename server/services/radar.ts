/**
 * Agente de Audiencia / Radar de Mercado.
 *
 * Fase 1: deixa de ser apenas um buscador de posts populares e passa a entregar:
 * - ranking por post fora da curva, nao por curtida bruta;
 * - padroes de mercado com evidencias;
 * - oportunidades priorizadas para a marca;
 * - ideias acionaveis baseadas em mecanismos vencedores.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orgProfile } from "../../drizzle/schema";
import { openRouterChat, ContentPart } from "../openrouter";
import { getPlan } from "./diagnosis";
import * as credits from "./credits";
import {
  fetchInstagramProfilesBatch,
  fetchHotPostsByHashtag,
  localizeRemoteImage,
  HotPost,
  SocialPost,
} from "./profileProvider";

const BRAIN = "anthropic/claude-sonnet-4.6";
const FREE_REFINES = 3;
const REFINE_COST_CC = 10;
const cleanHandle = (h: string) => (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").toLowerCase();
const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "-");
const stripAccents = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const lowerPlain = (s: string) => stripAccents(s).toLowerCase();

function linkedinSlug(raw?: string) {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex(p => ["in", "company", "school", "showcase"].includes(p.toLowerCase()));
    return (marker >= 0 ? parts[marker + 1] : parts[0] || "").toLowerCase();
  } catch {
    return value.replace(/^@/, "").replace(/^linkedin\.com\//i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function siteHost(raw?: string) {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function planRedes(plan: any) {
  return { ...(plan?.redes ?? {}), ...(plan?._redes ?? {}) } as Record<string, string>;
}

function baseContext(plan: any) {
  const redes = planRedes(plan);
  const ig = cleanHandle(plan?.profile?.handle || redes.instagram || "");
  if (ig) return { key: `instagram:${ig}`, label: `@${ig}`, source: "Instagram", ownHandle: ig };
  const li = linkedinSlug(plan?.linkedin || redes.linkedin || "");
  if (li) return { key: `linkedin:${li}`, label: `LinkedIn /${li}`, source: "LinkedIn", ownHandle: "" };
  const host = siteHost(redes.site || plan?.site?.url || "");
  if (host) return { key: `site:${host}`, label: host, source: "Site", ownHandle: "" };
  return { key: "", label: "", source: "", ownHandle: "" };
}

function sourceSeed(plan: any) {
  const redes = planRedes(plan);
  return lowerPlain([
    plan?.produto,
    plan?.nicho,
    plan?.sumarioExecutivo,
    plan?.resumoDiagnostico,
    plan?.linkedin,
    redes.linkedin,
    linkedinSlug(plan?.linkedin || redes.linkedin),
    redes.site,
    plan?.site?.url,
    plan?.site?.title,
    plan?.site?.description,
    plan?.site?.h1,
    plan?.site?.excerpt,
    plan?.profile?.bio,
    plan?.profile?.category,
  ].filter(Boolean).join(" "));
}

function fallbackSources(plan: any): { profiles: string[]; hashtags: string[] } {
  const seed = sourceSeed(plan);
  if (/\b(saude do trabalho|saudedotrabalho|sst|seguranca do trabalho|segurancadotrabalho|medicina ocupacional|medicinaocupacional|sesmt|pcmso|pgr\b|aso\b|e-social|esocial|ergonomia|nr[- ]?\d+|normas regulamentadoras)\b/.test(seed)) {
    return {
      profiles: [],
      hashtags: ["saudedotrabalho", "segurancadotrabalho", "medicinaocupacional", "sst", "sesmt", "ergonomia", "esocial", "pcmso", "pgr", "nr"],
    };
  }
  if (/\b(linkedin|b2b|consultoria|software|saas|automacao|automacao|tecnologia|gestao)\b/.test(seed)) {
    return { profiles: [], hashtags: ["b2b", "empreendedorismo", "gestao", "tecnologia", "consultoria", "software", "saas", "automacao", "produtividade", "negocios"] };
  }
  if (/\b(educacao|aprendizagem|tdah|dislexia|neurodivergente|escola|pedagogia)\b/.test(seed)) {
    return { profiles: [], hashtags: ["educacao", "aprendizagem", "educacaoinclusiva", "tdah", "dislexia", "neurodivergente", "pedagogia", "psicopedagogia"] };
  }
  return { profiles: [], hashtags: ["negocios", "empreendedorismo", "marketingdigital", "conteudo", "vendas", "marca", "estrategia"] };
}

function parseJson<T = any>(content: string): T | null {
  try {
    const c = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s = c.indexOf("{"), e = c.lastIndexOf("}");
    return JSON.parse(s >= 0 ? c.slice(s, e + 1) : c);
  } catch { return null; }
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number, d = 2) => +n.toFixed(d);
const engagement = (likes = 0, comments = 0) => likes + comments * 4;

function ageDays(timestamp?: string) {
  if (!timestamp) return undefined;
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return undefined;
  return Math.max(0, (Date.now() - t) / 86400000);
}

function recencyScore(timestamp?: string) {
  const days = ageDays(timestamp);
  if (days == null) return 0.55;
  if (days <= 7) return 1;
  if (days <= 30) return 0.82;
  if (days <= 90) return 0.62;
  if (days <= 180) return 0.44;
  return 0.28;
}

function inferFormat(post: { caption?: string; type?: string; url?: string }) {
  const t = (post.type || "").toLowerCase();
  const c = (post.caption || "").toLowerCase();
  if (t.includes("video") || t.includes("reel") || c.includes("reels")) return "reels";
  if (t.includes("carousel") || c.includes("arraste") || c.includes("carrossel")) return "carrossel";
  return "imagem";
}

function mechanismFromText(text = "") {
  const c = text.toLowerCase();
  if (/antes|depois|resultado|transforma/.test(c)) return "transformacao";
  if (/erro|nao faca|pare de|mito|verdade/.test(c)) return "quebra de crenca";
  if (/como|passo|guia|dica|lista|formas/.test(c)) return "educativo pratico";
  if (/cliente|depoimento|case|prova|resultado/.test(c)) return "prova social";
  if (/bastidor|rotina|por tras|dia a dia/.test(c)) return "bastidor de autoridade";
  if (/preco|vaga|agenda|oferta|promo/.test(c)) return "oferta direta";
  return "curiosidade/desejo";
}

function calcHotScore(input: {
  likes: number;
  comments: number;
  followers?: number;
  timestamp?: string;
  profileAvgEngagement?: number;
}) {
  const raw = engagement(input.likes, input.comments);
  const followers = input.followers || 0;
  const engagementRate = followers > 0 ? (raw / followers) * 100 : undefined;
  const commentRatio = raw > 0 ? input.comments / Math.max(1, input.likes + input.comments) : 0;
  const outlierScore = input.profileAvgEngagement && input.profileAvgEngagement > 0
    ? raw / input.profileAvgEngagement
    : 1;
  const erComponent = engagementRate == null ? 18 : clamp(engagementRate * 9, 0, 38);
  const outlierComponent = clamp(Math.log2(Math.max(1, outlierScore)) * 16, 0, 28);
  const commentComponent = clamp(commentRatio * 120, 0, 16);
  const volumeComponent = clamp(Math.log10(raw + 1) * 5, 0, 12);
  const recencyComponent = recencyScore(input.timestamp) * 6;
  return {
    rawEngagement: raw,
    engagementRate: engagementRate == null ? undefined : round(engagementRate),
    commentRatio: round(commentRatio * 100),
    outlierScore: round(outlierScore),
    recencyScore: round(recencyScore(input.timestamp) * 100),
    hotScore: Math.round(erComponent + outlierComponent + commentComponent + volumeComponent + recencyComponent),
  };
}

export interface RadarHit {
  ownerUsername?: string;
  ownerFullName?: string;
  followers?: number;
  likes: number;
  comments: number;
  img?: string;
  url?: string;
  caption?: string;
  timestamp?: string;
  type?: string;
  format?: string;
  sourceType?: "profile" | "hashtag";
  why?: string;
  theme?: string;
  mechanism?: string;
  rawEngagement?: number;
  engagementRate?: number;
  commentRatio?: number;
  outlierScore?: number;
  recencyScore?: number;
  hotScore?: number;
}

export interface MarketPattern {
  title: string;
  insight: string;
  hotScore: number;
  evidenceCount: number;
  whyItWorks: string;
  audienceDesire: string;
  contentMechanism: string;
  recommendedMove: string;
  risks?: string;
  sourcePostIndexes: number[];
}

export interface MarketOpportunity {
  title: string;
  priorityScore: number;
  reasonToBet: string;
  suggestedAngle: string;
  creativeDirection: string;
  firstPostIdea: string;
  effort?: "baixo" | "medio" | "alto";
}

export interface RadarIdea {
  titulo: string;
  formato: "imagem" | "reels" | "carrossel";
  angulo: "dor" | "desejo" | "transformacao";
  gancho: string;
  copy: string;
  hashtags: string[];
  cta: string;
  visualPrompt: string;
  roteiro?: { gancho3s: string; cenas: { tempo: string; acao: string; audio: string }[]; cta: string };
  fonte?: string;
  fonteUrl?: string;
  fonteImg?: string;
  patternTitle?: string;
  opportunityTitle?: string;
  priorityScore?: number;
  creativeId?: number;
  imageUrl?: string;
  diagnosisDecision?: "use" | "skip" | "agent";
  diagnosisReason?: string;
  diagnosisFeedback?: string;
  diagnosisDecidedAt?: number;
}

export interface RadarResult {
  scannedAt: number;
  nicho?: string;
  baseHandle?: string;
  baseKey?: string;
  baseLabel?: string;
  baseSource?: string;
  baseProduto?: string;
  marketSummary?: string;
  sources: string[];
  hashtags: string[];
  hits: RadarHit[];
  patterns?: MarketPattern[];
  opportunities?: MarketOpportunity[];
  ideas: RadarIdea[];
  quality?: {
    grade: "forte" | "media" | "fraca";
    sourcesCount: number;
    hitsCount: number;
    message: string;
  };
  feedback?: {
    likedHandles: string[];
    rejectedHandles: string[];
    likedPostKeys?: string[];
    dislikedPostKeys?: string[];
    refinementCount: number;
    freeLimit: number;
    nextCostCC: number;
  };
}

function hitKey(h: Pick<RadarHit, "url" | "img" | "ownerUsername" | "caption">) {
  return String(h.url || h.img || `${h.ownerUsername || ""}:${(h.caption || "").slice(0, 80)}`);
}

export async function suggestSources(orgId: number): Promise<{ profiles: string[]; hashtags: string[] }> {
  const plan: any = await getPlan(orgId);
  const produto = plan?.produto || "";
  const nicho = plan?.nicho || "";
  const ctx = baseContext(plan);
  const ownHandle = ctx.ownHandle;
  const fallback = fallbackSources(plan);
  if (!process.env.OPENROUTER_API_KEY) return fallback;
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Audiencia da Cacarejar. Sugira fontes brasileiras para mapear o que esta quente no Instagram.
Retorne SOMENTE JSON {"profiles":[handles sem @, 8-12],"hashtags":[8-10 sem #]}.
Misture: concorrentes diretos, criadores de nicho, perfis aspiracionais, microcomunidades e hashtags de dor/desejo/solucao. Evite celebridades genericas.`,
      },
      {
        role: "user",
        content: `Nicho: ${nicho}
Produto/conta: ${produto}
Contexto ativo: ${ctx.label || "sem perfil identificado"} (${ctx.source || "diagnostico"})
LinkedIn/site/briefing disponiveis: ${JSON.stringify(planRedes(plan))}
Se nao souber perfis confiaveis, retorne profiles vazio e hashtags fortes do nicho. Nao invente perfis aleatorios.`,
      },
    ], { model: BRAIN, temperature: 0.55, maxTokens: 700 });
    const j = parseJson<{ profiles: string[]; hashtags: string[] }>(content) ?? { profiles: [], hashtags: [] };
    const profiles = (j.profiles ?? []).map(cleanHandle).filter(h => h && h !== ownHandle);
    const hashtags = (j.hashtags ?? []).map(h => h.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
    return {
      profiles: [...new Set([...profiles, ...fallback.profiles])].slice(0, 12),
      hashtags: [...new Set([...hashtags, ...fallback.hashtags])].slice(0, 10),
    };
  } catch {
    return fallback;
  }
}

function fallbackPatterns(hits: RadarHit[]): MarketPattern[] {
  const groups = new Map<string, number[]>();
  hits.forEach((h, i) => {
    const key = h.mechanism || mechanismFromText(h.caption || "");
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([mechanism, indexes]) => {
      const avg = indexes.reduce((s, i) => s + (hits[i].hotScore ?? 0), 0) / indexes.length;
      return {
        title: mechanism.charAt(0).toUpperCase() + mechanism.slice(1),
        insight: `Padrao recorrente em ${indexes.length} post(s) com bom sinal de engajamento.`,
        hotScore: Math.round(avg),
        evidenceCount: indexes.length,
        whyItWorks: "Conecta uma tensao clara da audiencia com uma promessa facil de entender.",
        audienceDesire: "Entender rapidamente se aquilo resolve uma dor ou aproxima de um resultado desejado.",
        contentMechanism: mechanism,
        recommendedMove: "Transformar o padrao em uma peca com gancho forte, prova concreta e CTA simples.",
        risks: "Evitar copiar layout/claims do concorrente; adaptar a promessa ao posicionamento da marca.",
        sourcePostIndexes: indexes.slice(0, 3),
      };
    });
}

function fallbackOpportunities(patterns: MarketPattern[], nicho: string): MarketOpportunity[] {
  return patterns.slice(0, 3).map((p, i) => ({
    title: `Apostar em ${p.contentMechanism}`,
    priorityScore: Math.max(55, Math.min(92, p.hotScore + 10 - i * 4)),
    reasonToBet: p.whyItWorks,
    suggestedAngle: p.audienceDesire,
    creativeDirection: p.recommendedMove,
    firstPostIdea: `Criar um post de ${p.contentMechanism} aplicado ao nicho ${nicho || "da marca"}.`,
    effort: i === 0 ? "baixo" : "medio",
  }));
}

function fallbackIdeas(opportunities: MarketOpportunity[], hits: RadarHit[], brandDNA: any): RadarIdea[] {
  const palette = Array.isArray(brandDNA?.paleta) ? brandDNA.paleta.join(", ") : "brand color palette";
  return opportunities.slice(0, 3).map((o, i) => {
    const h = hits[o.priorityScore ? i % Math.max(1, hits.length) : 0];
    const formato = i === 1 ? "reels" : i === 2 ? "carrossel" : "imagem";
    return {
      titulo: o.title,
      formato: formato as RadarIdea["formato"],
      angulo: i === 0 ? "dor" : i === 1 ? "desejo" : "transformacao",
      gancho: o.firstPostIdea,
      copy: `${o.reasonToBet} Mostre isso com uma prova simples e convide a audiencia para dar o proximo passo.`,
      hashtags: [],
      cta: "Fale com a gente para aplicar isso no seu caso.",
      visualPrompt: `Premium social media image for a Brazilian brand, inspired by the winning content mechanism "${o.title}". Use ${palette}, clean composition, strong focal point, modern editorial lighting, brand-safe aesthetic, no text in the image, leave clean negative space at the top for a headline.`,
      fonte: h?.ownerUsername,
      fonteUrl: h?.url,
      fonteImg: h?.img,
      opportunityTitle: o.title,
      priorityScore: o.priorityScore,
    };
  });
}

export async function scan(orgId: number, opts: { handles?: string[]; excludeHandles?: string[]; feedback?: RadarResult["feedback"] } = {}): Promise<RadarResult> {
  const plan: any = await getPlan(orgId);
  if (!plan) throw new Error("Faca o diagnostico primeiro");
  const produto = plan.produto || "";
  const nicho = plan.nicho || "";
  const brandDNA = plan.brandDNA ?? {};
  const ctx = baseContext(plan);
  const ownHandle = ctx.ownHandle;

  const suggestion = await suggestSources(orgId);
  const hashtags = suggestion.hashtags;
  const exclude = new Set((opts.excludeHandles ?? []).map(cleanHandle).filter(Boolean));
  let handles = (opts.handles ?? []).map(cleanHandle).filter(h => h && h !== ownHandle && !exclude.has(h));
  let hashtagPosts: HotPost[] = [];
  if (!handles.length) {
    hashtagPosts = hashtags.length ? await fetchHotPostsByHashtag(hashtags, 60) : [];
    const owners = [...hashtagPosts]
      .sort((a, b) => engagement(b.likes, b.comments) - engagement(a.likes, a.comments))
      .map(p => cleanHandle(p.ownerUsername || ""))
      .filter(Boolean);
    handles = [...new Set([...owners, ...suggestion.profiles])].filter(h => h && h !== ownHandle && !exclude.has(h));
  }
  handles = handles.slice(0, 12);

  const profiles = await fetchInstagramProfilesBatch(handles);
  const candidates: RadarHit[] = [];

  for (const p of profiles) {
    const posts = (p.posts ?? []).filter((post: SocialPost) => post.img);
    const avg = posts.length ? posts.reduce((s, post) => s + engagement(post.likes, post.comments), 0) / posts.length : 0;
    for (const post of posts) {
      const score = calcHotScore({
        likes: post.likes,
        comments: post.comments,
        followers: p.followers,
        timestamp: post.timestamp,
        profileAvgEngagement: avg,
      });
      candidates.push({
        ownerUsername: p.handle,
        ownerFullName: p.fullName,
        followers: p.followers,
        likes: post.likes,
        comments: post.comments,
        img: post.img,
        url: post.url,
        caption: post.caption,
        timestamp: post.timestamp,
        sourceType: "profile",
        format: inferFormat(post),
        mechanism: mechanismFromText(post.caption),
        ...score,
      });
    }
  }

  for (const post of hashtagPosts.filter(p => p.img)) {
    const score = calcHotScore({ likes: post.likes, comments: post.comments, timestamp: (post as any).timestamp });
    candidates.push({
      ownerUsername: cleanHandle(post.ownerUsername || ""),
      ownerFullName: post.ownerFullName,
      likes: post.likes,
      comments: post.comments,
      img: post.img,
      url: post.url,
      caption: post.caption,
      timestamp: (post as any).timestamp,
      type: post.type,
      sourceType: "hashtag",
      format: inferFormat(post),
      mechanism: mechanismFromText(post.caption),
      ...score,
    });
  }

  const seen = new Set<string>();
  const owners = new Set<string>();
  const hits = candidates
    .sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0))
    .filter(h => {
      const key = (h.url || h.img || "") + (h.ownerUsername || "");
      const owner = cleanHandle(h.ownerUsername || "");
      if (!h.img || seen.has(key) || owners.has(owner) || h.ownerUsername === ownHandle || exclude.has(owner)) return false;
      seen.add(key);
      if (owner) owners.add(owner);
      return true;
    })
    .slice(0, 12);

  if (!hits.length) throw new Error("Nao consegui encontrar posts do nicho. Informe alguns @ inspiradores e tente de novo.");

  await Promise.all(hits.map(async (h, i) => { h.img = await localizeRemoteImage(h.img, `radar_hit${i}`); }));
  const scanned = [...new Set(hits.map(h => h.ownerUsername).filter(Boolean))] as string[];

  let marketSummary = "";
  let patterns: MarketPattern[] = fallbackPatterns(hits);
  let opportunities: MarketOpportunity[] = fallbackOpportunities(patterns, nicho);
  let ideas: RadarIdea[] = fallbackIdeas(opportunities, hits, brandDNA);

  const withImg = hits.filter(h => h.img).slice(0, 8);
  if (process.env.OPENROUTER_API_KEY && withImg.length) {
    try {
      const evidence = withImg.map((h, i) => ({
        i,
        owner: h.ownerUsername,
        followers: h.followers,
        likes: h.likes,
        comments: h.comments,
        hotScore: h.hotScore,
        engagementRate: h.engagementRate,
        outlierScore: h.outlierScore,
        recencyScore: h.recencyScore,
        format: h.format,
        mechanismGuess: h.mechanism,
        caption: (h.caption || "").slice(0, 350),
      }));
      const parts: ContentPart[] = [
        {
          type: "text",
          text: `Voce e o Agente de Audiencia da Cacarejar. Sua entrega precisa ser util como uma mini consultoria de mercado, nao uma lista de posts.

Cliente:
- Produto: ${produto}
- Nicho: ${nicho}
- DNA visual: ${JSON.stringify(brandDNA)}

Evidencias de posts ranqueados por hotScore (ja calculado por taxa, comentarios, recencia e desempenho fora da media do perfil):
${JSON.stringify(evidence)}

Analise as imagens anexadas e retorne SOMENTE JSON:
{
 "marketSummary": "sintese de 2 frases sobre o que esta quente e a oportunidade",
 "items": [{"i":0,"why":"por que funcionou","theme":"tema","mechanism":"mecanismo vencedor"}],
 "patterns": [{
   "title":"nome curto do padrao",
   "insight":"o que esta acontecendo",
   "hotScore":85,
   "evidenceCount":3,
   "whyItWorks":"por que mexe com a audiencia",
   "audienceDesire":"desejo/dor por tras",
   "contentMechanism":"antes/depois|quebra de crenca|prova social|educativo pratico|bastidor|oferta|outro",
   "recommendedMove":"como a marca deve usar",
   "risks":"o que evitar",
   "sourcePostIndexes":[0,2]
 }],
 "opportunities": [{
   "title":"oportunidade acionavel",
   "priorityScore":90,
   "reasonToBet":"por que apostar",
   "suggestedAngle":"angulo criativo",
   "creativeDirection":"direcao pratica",
   "firstPostIdea":"primeiro post para criar",
   "effort":"baixo|medio|alto"
 }],
 "ideas": [{
   "titulo":"string",
   "formato":"imagem|reels|carrossel",
   "angulo":"dor|desejo|transformacao",
   "gancho":"string",
   "copy":"string",
   "hashtags":["string"],
   "cta":"string",
   "visualPrompt":"prompt em ingles, 70-110 palavras, com paleta/estilo do cliente, sem texto na imagem, termina com leave clean negative space at the top for a headline",
   "roteiro":{"gancho3s":"string","cenas":[{"tempo":"0-3s","acao":"string","audio":"string"}],"cta":"string"},
   "fonteIndex":0,
   "patternTitle":"string",
   "opportunityTitle":"string",
   "priorityScore":90
 }]
}

Regras:
- Nao copie o concorrente. Extraia o mecanismo e adapte.
- Priorize oportunidades que a marca consiga executar agora.
- Gere 3 ideias fortes, cada uma vinculada a uma oportunidade.
- Seja especifico: nada de frases genericas como "criar conteudo de valor".`,
        },
      ];
      withImg.forEach((h, i) => {
        parts.push({ type: "text", text: `POST ${i} - @${h.ownerUsername} - hotScore ${h.hotScore} - ${nf(h.likes)} likes, ${nf(h.comments)} comentarios - "${(h.caption || "(visual)").slice(0, 160)}"` });
        if (h.img) parts.push({ type: "image_url", image_url: { url: h.img } });
      });
      const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.55, maxTokens: 14000 });
      const parsed = parseJson<any>(content);
      if (parsed) {
        marketSummary = typeof parsed.marketSummary === "string" ? parsed.marketSummary : marketSummary;
        if (Array.isArray(parsed.items)) {
          for (const it of parsed.items) {
            const h = withImg[it.i];
            if (!h) continue;
            if (typeof it.why === "string") h.why = it.why;
            if (typeof it.theme === "string") h.theme = it.theme;
            if (typeof it.mechanism === "string") h.mechanism = it.mechanism;
          }
        }
        if (Array.isArray(parsed.patterns) && parsed.patterns.length) patterns = parsed.patterns.slice(0, 5);
        if (Array.isArray(parsed.opportunities) && parsed.opportunities.length) opportunities = parsed.opportunities.slice(0, 5);
        if (Array.isArray(parsed.ideas) && parsed.ideas.length) {
          ideas = parsed.ideas.slice(0, 3).map((idea: any, idx: number) => {
            const h = withImg[typeof idea.fonteIndex === "number" ? idea.fonteIndex : idx] ?? withImg[0];
            return {
              titulo: idea.titulo,
              formato: idea.formato,
              angulo: idea.angulo,
              gancho: idea.gancho,
              copy: idea.copy,
              hashtags: Array.isArray(idea.hashtags) ? idea.hashtags : [],
              cta: idea.cta,
              visualPrompt: idea.visualPrompt,
              roteiro: idea.roteiro,
              fonte: h?.ownerUsername,
              fonteUrl: h?.url,
              fonteImg: h?.img,
              patternTitle: idea.patternTitle,
              opportunityTitle: idea.opportunityTitle,
              priorityScore: idea.priorityScore,
            };
          }).filter((idea: RadarIdea) => idea?.visualPrompt && idea?.gancho);
        }
      } else {
        console.error("[radar] inteligencia: JSON nao parseado (len=" + content.length + ")");
      }
    } catch (e) {
      console.error("[radar] inteligencia falhou:", (e as any)?.message);
    }
  }

  const quality = {
    grade: (hits.length >= 8 && scanned.length >= 4 ? "forte" : hits.length >= 4 ? "media" : "fraca") as "forte" | "media" | "fraca",
    sourcesCount: scanned.length,
    hitsCount: hits.length,
    message: hits.length >= 8
      ? "Pesquisa com bom volume de sinais."
      : "Pesquisa com poucos sinais; informe perfis inspiradores para aprofundar.",
  };

  const result: RadarResult = {
    scannedAt: Date.now(),
    nicho,
    baseHandle: ownHandle || undefined,
    baseKey: ctx.key || undefined,
    baseLabel: ctx.label || undefined,
    baseSource: ctx.source || undefined,
    baseProduto: produto || undefined,
    marketSummary,
    sources: scanned,
    hashtags,
    hits,
    patterns,
    opportunities,
    ideas,
    quality,
    feedback: opts.feedback,
  };

  const db = await getDb();
  if (db) await db.update(orgProfile).set({ radarJson: result as any }).where(eq(orgProfile.organizationId, orgId));
  return result;
}

export async function getRadar(orgId: number): Promise<RadarResult | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  return (rows[0]?.radarJson as any) ?? null;
}

async function suggestMoreLike(orgId: number, likedHandles: string[], rejectedHandles: string[], likedPosts: RadarHit[] = []): Promise<string[]> {
  const plan: any = await getPlan(orgId);
  const produto = plan?.produto || "";
  const nicho = plan?.nicho || "";
  if (!process.env.OPENROUTER_API_KEY || !likedHandles.length) return [];
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Audiencia da Cacarejar. O usuario marcou quais posts parecem compativeis com a marca.
Sugira NOVOS handles brasileiros de Instagram parecidos com os perfis e mecanismos aprovados, evitando os rejeitados.
Retorne SOMENTE JSON {"profiles":[handles sem @, 8-12]}.
Priorize perfis reais, nichados, com boa chance de ter conteudo acionavel. Busque variedade: no maximo um perfil muito parecido para cada aprovado. Nao repita nenhum handle informado.`,
      },
      {
        role: "user",
        content: `Nicho: ${nicho}
Produto: ${produto}
Posts aprovados:
${likedPosts.map(h => `- @${h.ownerUsername}: mecanismo=${h.mechanism || "-"}; caption="${(h.caption || "").slice(0, 180)}"`).join("\n") || likedHandles.map(h => "- @" + h).join("\n")}
Perfis dos posts aprovados: ${likedHandles.map(h => "@" + h).join(", ")}
Perfis rejeitados/excluidos: ${rejectedHandles.map(h => "@" + h).join(", ")}`,
      },
    ], { model: BRAIN, temperature: 0.6, maxTokens: 700 });
    const parsed = parseJson<{ profiles: string[] }>(content);
    return [...new Set((parsed?.profiles ?? []).map(cleanHandle).filter(Boolean))]
      .filter(h => !likedHandles.includes(h) && !rejectedHandles.includes(h))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function refineWithFeedback(orgId: number, input: string[] | { likedHandles?: string[]; likedPostKeys?: string[]; dislikedPostKeys?: string[] }): Promise<RadarResult> {
  const current = await getRadar(orgId);
  if (!current?.sources?.length) throw new Error("Faca uma pesquisa de Radar primeiro");

  const likedPostKeys = new Set((Array.isArray(input) ? [] : input.likedPostKeys ?? []).map(String).filter(Boolean));
  const dislikedPostKeys = [...new Set((Array.isArray(input) ? [] : input.dislikedPostKeys ?? []).map(String).filter(Boolean))];
  const fallbackLikedHandles = Array.isArray(input) ? input : (input.likedHandles ?? []);
  const likedPosts = ((current.hits ?? []) as RadarHit[]).filter(h => likedPostKeys.has(hitKey(h)));
  const likedHandles = [...new Set([
    ...likedPosts.map(h => cleanHandle(h.ownerUsername || "")).filter(Boolean),
    ...fallbackLikedHandles.map(cleanHandle).filter(Boolean),
  ])];
  if (!likedHandles.length) throw new Error("Marque Gostei em pelo menos um post compativel para refazer a pesquisa");

  const currentSources = [...new Set([
    ...(current.sources ?? []).map(cleanHandle).filter(Boolean),
    ...((current.hits ?? []) as RadarHit[]).map(h => cleanHandle(h.ownerUsername || "")).filter(Boolean),
  ])];
  const dislikedHandles = ((current.hits ?? []) as RadarHit[])
    .filter(h => dislikedPostKeys.includes(hitKey(h)))
    .map(h => cleanHandle(h.ownerUsername || ""))
    .filter(Boolean);
  const rejectedHandles = [...new Set(dislikedHandles.filter(h => !likedHandles.includes(h)))];
  const previousCount = current.feedback?.refinementCount ?? 0;
  const nextCount = previousCount + 1;
  let holdId: number | null = null;

  if (previousCount >= FREE_REFINES) {
    const hold = await credits.hold(orgId, REFINE_COST_CC, "radar:refine", { description: "Refinamento do Radar de Mercado" });
    if (!hold.ok) {
      throw new Error(hold.reason === "saldo_insuficiente"
        ? `Voce usou os ${FREE_REFINES} refinamentos gratis. Compre creditos para continuar.`
        : "Cota diaria de creditos atingida para refinar o Radar");
    }
    holdId = hold.holdLedgerId;
  }

  try {
    const more = await suggestMoreLike(orgId, likedHandles, rejectedHandles, likedPosts);
    const handles = [...new Set([...likedHandles, ...more])].slice(0, 12);
    const feedback = {
      likedHandles,
      rejectedHandles,
      likedPostKeys: [...likedPostKeys],
      dislikedPostKeys,
      refinementCount: nextCount,
      freeLimit: FREE_REFINES,
      nextCostCC: REFINE_COST_CC,
    };
    const result = await scan(orgId, { handles, excludeHandles: rejectedHandles, feedback });
    if (holdId) await credits.settle(orgId, holdId, 0);
    return result;
  } catch (e) {
    if (holdId) await credits.release(orgId, holdId).catch(() => {});
    throw e;
  }
}

export async function attachCreativeToIdea(orgId: number, index: number, creativeId: number, imageUrl: string) {
  const db = await getDb();
  if (!db) return;
  const radar = await getRadar(orgId);
  if (!radar?.ideas?.[index]) return;
  radar.ideas[index] = { ...radar.ideas[index], creativeId, imageUrl };
  await db.update(orgProfile).set({ radarJson: radar as any }).where(eq(orgProfile.organizationId, orgId));
}

export async function updateIdeaDecision(orgId: number, index: number, decision: "use" | "skip" | "agent", feedback?: string) {
  const db = await getDb();
  if (!db) return { ok: false };
  const radar = await getRadar(orgId);
  if (!radar?.ideas?.[index]) throw new Error("Ideia nao encontrada");
  radar.ideas[index] = {
    ...radar.ideas[index],
    diagnosisDecision: decision,
    diagnosisFeedback: feedback?.trim() || radar.ideas[index].diagnosisFeedback,
    diagnosisDecidedAt: Date.now(),
  };
  await db.update(orgProfile).set({ radarJson: radar as any }).where(eq(orgProfile.organizationId, orgId));
  return { ok: true, idea: radar.ideas[index] };
}
