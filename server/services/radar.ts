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
  fetchTikTokProfilesBatch,
  fetchFacebookPagesBatch,
  fetchHotPostsByHashtag,
  localizeRemoteImage,
  HotPost,
  SocialPost,
  SocialProfile,
} from "./profileProvider";

const BRAIN = "anthropic/claude-sonnet-4.6";
const DISCOVERY_BRAIN = "perplexity/sonar-pro";
const FREE_REFINES = 3;
const REFINE_COST_CC = 10;
export type RadarChannel = "instagram" | "facebook" | "tiktok";
const cleanHandle = (h: string) => (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").toLowerCase();
const cleanChannelHandle = (raw: string, channel: RadarChannel) => {
  const value = (raw || "").trim().replace(/^@/, "");
  if (channel === "tiktok") {
    return value
      .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "")
      .replace(/[/?#].*$/, "")
      .toLowerCase();
  }
  if (channel === "facebook") {
    return value
      .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
      .replace(/[/?#].*$/, "")
      .toLowerCase();
  }
  return cleanHandle(value);
};
const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "-");
const stripAccents = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const lowerPlain = (s: string) => stripAccents(s).toLowerCase();
const cleanTag = (h: string) => lowerPlain(h || "").replace(/^#/, "").replace(/[^a-z0-9_]/g, "").trim();

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
      profiles: [
        "gestaoesst",
        "sst.descomplicada",
        "brunogoncalves.sst",
        "andrezalopes.sst",
        "servmed_servsaude_sma",
        "newtimesaude",
        "esocialsst",
        "zuki.ocupacional",
      ],
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

function isOccupationalHealthPlan(plan: any) {
  return /\b(saude do trabalho|saudedotrabalho|saude mental no trabalho|saudementalnotrabalho|sst|seguranca do trabalho|segurancadotrabalho|medicina ocupacional|medicinaocupacional|sesmt|pcmso|pgr\b|aso\b|e-social|esocial|ergonomia|nr[- ]?\d+|normas regulamentadoras|bemestar corporativo|bem estar corporativo)\b/.test(sourceSeed(plan));
}

function occupationalRelevanceScore(hit: Pick<RadarHit, "ownerUsername" | "ownerFullName" | "caption" | "theme" | "why" | "mechanism">) {
  const text = lowerPlain([
    hit.ownerUsername,
    hit.ownerFullName,
    hit.caption,
    hit.theme,
    hit.why,
    hit.mechanism,
  ].filter(Boolean).join(" "));
  const strong = [
    "saude do trabalho", "saudedotrabalho", "seguranca do trabalho", "segurancadotrabalho",
    "medicina ocupacional", "medicinaocupacional", "sst", "sesmt", "pcmso", "pgr",
    "aso", "exame admissional", "exame demissional", "exame ocupacional", "ocupacional",
    "ergonomia", "ergonomico", "ergonomica", "nr ", "nr-", "nrs", "norma regulamentadora",
    "esocial", "e-social", "cat", "cipa", "ltcat", "ppra", "insalubridade", "periculosidade",
    "acidente de trabalho", "afastamento", "absenteismo", "burnout", "saude mental no trabalho",
    "bem estar corporativo", "bemestar corporativo", "qualidade de vida no trabalho", "qvt",
  ];
  const medium = [
    "trabalhador", "trabalhadores", "funcionario", "funcionarios", "colaborador", "colaboradores",
    "empresa", "empresas", "rh", "gestao de pessoas", "previdenciario", "inss", "clinica ocupacional",
  ];
  const noise = [
    "perfume", "musica", "beleza", "maquiagem", "moda", "legado", "fruta", "agricola",
    "paleografico", "grafologico", "habilitacao", "detran", "escola", "curso de ingles",
    "astrologia", "tarot", "horoscopo", "make", "estetica", "skin care", "skincare",
  ];
  let score = 0;
  for (const term of strong) if (text.includes(term)) score += 3;
  for (const term of medium) if (text.includes(term)) score += 1;
  for (const term of noise) if (text.includes(term)) score -= 3;
  const hasWork = /\b(trabalho|trabalhador|funcionario|colaborador|empresa|rh|corporativo|ocupacional|sst|sesmt)\b/.test(text);
  const hasHealth = /\b(saude|mental|medicina|clinica|ergonomia|burnout|ocupacional|exame|prevencao|seguranca)\b/.test(text);
  if (hasWork && hasHealth) score += 3;
  return score;
}

const GENERIC_RADAR_STOPWORDS = new Set([
  "para", "pela", "pelo", "com", "sem", "que", "uma", "umas", "uns", "dos", "das",
  "nas", "nos", "esse", "essa", "isso", "este", "esta", "voce", "cliente", "clientes",
  "conteudo", "conteudos", "post", "posts", "instagram", "reels", "tiktok", "redes",
  "sociais", "marketing", "vender", "vendas", "mais", "fazer", "faco", "perfil", "marca",
]);

const RADAR_BLOCKLIST_TERMS = [
  "violencia", "violencia domestica", "policia", "preso", "presa", "prisao", "crime",
  "denuncia", "denunciada", "agressao", "assassin", "morte", "estupro", "abuso",
  "nudez", "sensual", "lingerie", "calcinha", "sutia", "onlyfans", "aposta", "cassino",
  "bet", "sorteio", "premio", "concorra", "ganhe", "marque", "seguir todos",
  "comente bastante", "engajadas",
];

function radarHitText(hit: Pick<RadarHit, "ownerUsername" | "ownerFullName" | "caption" | "theme" | "why" | "mechanism" | "profileMatchReason">) {
  return lowerPlain([
    hit.ownerUsername,
    hit.ownerFullName,
    hit.caption,
    hit.theme,
    hit.why,
    hit.mechanism,
    hit.profileMatchReason,
  ].filter(Boolean).join(" "));
}

function planRelevanceTerms(plan: any) {
  const seed = lowerPlain([
    plan?.produto,
    plan?.nicho,
    plan?.sumarioExecutivo,
    plan?.resumo,
    plan?.objetivoPrincipal,
    plan?.profile?.handle,
    plan?.profile?.fullName,
    plan?.profile?.bio,
    plan?.profile?.category,
    plan?.site?.title,
    plan?.site?.description,
    plan?.brandDNA ? JSON.stringify(plan.brandDNA) : "",
  ].filter(Boolean).join(" "));
  const counts = new Map<string, number>();
  for (const term of seed.match(/[a-z0-9]{4,}/g) ?? []) {
    if (GENERIC_RADAR_STOPWORDS.has(term) || /^\d+$/.test(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 28)
    .map(([term]) => term);
}

function isBrandSafeRadarHit(hit: RadarHit) {
  const text = radarHitText(hit);
  return !RADAR_BLOCKLIST_TERMS.some(term => text.includes(term));
}

function genericRelevanceScore(plan: any, hit: RadarHit) {
  const terms = planRelevanceTerms(plan);
  const text = radarHitText(hit);
  const matches = terms.filter(term => text.includes(term));
  return {
    termsCount: terms.length,
    score:
      matches.length * 2 +
      (hit.why || hit.theme ? 1 : 0) +
      (hit.sourceType === "profile" ? 1 : 0),
  };
}

function isRelevantHitForPlan(plan: any, hit: RadarHit, opts: { relaxed?: boolean } = {}) {
  if (!isBrandSafeRadarHit(hit)) return false;
  if (
    Number(hit.profileFitScore ?? 0) >= 75 &&
    hit.profileConfidence !== "baixa"
  ) return true;
  if (isOccupationalHealthPlan(plan)) return occupationalRelevanceScore(hit) >= 6;
  const rel = genericRelevanceScore(plan, hit);
  if (rel.termsCount < 4) return opts.relaxed ? rel.score >= 0 : rel.score >= 1;
  return rel.score >= (opts.relaxed ? 1 : 3);
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
  channel?: RadarChannel;
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
  profileRole?: "concorrente_direto" | "inspiracao";
  profileMatchScope?: "perfil_completo" | "componente_editorial";
  profileInspirationDimension?: string;
  profileFitScore?: number;
  profileConfidence?: "alta" | "media" | "baixa";
  profileMatchReason?: string;
}

export interface RadarProfileMatch {
  channel: RadarChannel;
  handle: string;
  fullName?: string;
  bio?: string;
  followers?: number;
  profilePic?: string;
  role: "concorrente_direto" | "inspiracao";
  matchScope?: "perfil_completo" | "componente_editorial";
  inspirationDimension?: string;
  fitScore: number;
  confidence: "alta" | "media" | "baixa";
  reason: string;
  audienceOverlap: string;
  offerOverlap: string;
  contentOpportunity: string;
  evidence: string[];
  dimensions?: RadarFitDimensions;
}

export interface RadarFitDimensions {
  audience: number;
  offer: number;
  subject: number;
  formatTone: number;
  visualDNA: number;
}

export interface RadarBrandProspect {
  channel: RadarChannel;
  brand: string;
  handle?: string;
  category: string;
  relationship: "investiu_em_perfil_similar" | "aderencia_potencial";
  evidenceLevel: "confirmada" | "sinal_publico" | "hipotese";
  fitScore: number;
  why: string;
  interestedThemes: string[];
  evidence: string[];
  approach: string;
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
  engineVersion?: number;
  activeChannel?: RadarChannel;
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
  profileMatches?: RadarProfileMatch[];
  brandProspects?: RadarBrandProspect[];
  channels?: Partial<Record<RadarChannel, {
    scannedAt: number;
    marketSummary?: string;
    sources: string[];
    hashtags: string[];
    hits: RadarHit[];
    profileMatches: RadarProfileMatch[];
    brandProspects: RadarBrandProspect[];
    patterns?: MarketPattern[];
    opportunities?: MarketOpportunity[];
    ideas?: RadarIdea[];
    quality?: RadarResult["quality"];
    dataQuality?: RadarResult["dataQuality"];
  }>>;
  patterns?: MarketPattern[];
  opportunities?: MarketOpportunity[];
  ideas: RadarIdea[];
  quality?: {
    grade: "forte" | "media" | "fraca";
    sourcesCount: number;
    hitsCount: number;
    message: string;
  };
  dataQuality?: {
    status: "complete" | "degraded";
    message: string;
    missing?: string[];
    warnings?: string[];
    checkedAt: number;
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

export interface RadarSourceSuggestions {
  profiles: string[];
  hashtags: string[];
  channels: Record<RadarChannel, {
    profiles: string[];
    hashtags: string[];
    searchRationale?: string;
  }>;
}

export async function suggestSources(orgId: number): Promise<RadarSourceSuggestions> {
  const plan: any = await getPlan(orgId);
  const produto = plan?.produto || "";
  const nicho = plan?.nicho || "";
  const ctx = baseContext(plan);
  const ownHandle = ctx.ownHandle;
  const fallback = fallbackSources(plan);
  const redes = planRedes(plan);
  const emptyChannels: RadarSourceSuggestions["channels"] = {
    instagram: { profiles: fallback.profiles, hashtags: fallback.hashtags },
    facebook: { profiles: [], hashtags: [] },
    tiktok: { profiles: [], hashtags: fallback.hashtags.slice(0, 6) },
  };
  if (!process.env.OPENROUTER_API_KEY) {
    return { profiles: fallback.profiles, hashtags: fallback.hashtags, channels: emptyChannels };
  }
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Inteligencia Competitiva da Cacarejar.
Sua tarefa e descobrir candidatos reais para uma pesquisa de mercado, separados por canal.

Retorne SOMENTE JSON:
{
  "instagram":{"profiles":["handle sem @"],"hashtags":["sem #"],"searchRationale":"criterio usado"},
  "facebook":{"profiles":["handle ou pagina"],"hashtags":[],"searchRationale":"criterio usado"},
  "tiktok":{"profiles":["handle sem @"],"hashtags":["sem #"],"searchRationale":"criterio usado"}
}

Regras:
- Um concorrente direto atende publico parecido com oferta comparavel.
- Uma inspiracao pode ter outra oferta, mas precisa compartilhar assunto, linguagem, tom, formato ou mecanismo de conteudo concretamente aplicavel.
- Procure em tres trilhas, nesta ordem: concorrentes da mesma atividade; pares editoriais com o mesmo tipo de criacao; inspiracoes adjacentes com o mesmo mecanismo e DNA.
- Use o DNA da marca e os posts campeoes como consulta de busca. Porte de audiencia, genero, rosto humano e "marca pessoal" nao sao criterios.
- Para criadores autorais, diferencie claramente arte/processo/humor de moda, beleza, turismo e lifestyle.
- Nao confunda aparencia, genero, cor, roupa, popularidade ou tema ocasional com aderencia de negocio.
- Priorize brasileiros e perfis nichados. Evite celebridades, agregadores, noticias, sorteios e perfis genericos.
- Sugira no maximo 8 perfis por canal. Se nao souber um handle real, deixe a lista vazia.
- Nao invente nomes para completar quantidade. A etapa seguinte validara cada perfil em dados publicos.`,
      },
      {
        role: "user",
        content: `Produto/conta (evidencia principal): ${produto}
Contexto ativo: ${ctx.label || "sem perfil identificado"} (${ctx.source || "diagnostico"})
Evidencias concretas da marca (use nesta ordem): ${JSON.stringify({
  bio: plan?.profile?.bio,
  dna: plan?.brandDNA,
  postsCampeoes: (plan?.profile?.topPosts ?? [])
    .slice(0, 6)
    .map((post: any) => ({
      texto: String(post?.caption || "").slice(0, 420),
      formato: post?.type,
    })),
  objetivo: plan?.objetivoPrincipal,
})}
Rotulos automaticos de baixa confianca (ignore quando conflitarem com bio, DNA ou posts): ${JSON.stringify({
  nicho,
  categoria: plan?.profile?.category,
  sumario: plan?.sumarioExecutivo,
  resumo: plan?.resumoDiagnostico || plan?.resumo,
})}
Canais do cliente: ${JSON.stringify(redes)}
Conteudo real, DNA e posts campeoes sempre vencem os rotulos automaticos do diagnostico.
Nao inclua o proprio perfil do cliente nas sugestoes.`,
      },
    ], { model: DISCOVERY_BRAIN, temperature: 0.15, maxTokens: 2000 });
    const j = parseJson<any>(content) ?? {};
    const instagramProfiles = (j.instagram?.profiles ?? [])
      .map((h: string) => cleanChannelHandle(h, "instagram"))
      .filter((h: string) => h && h !== ownHandle);
    const instagramHashtags = (j.instagram?.hashtags ?? []).map(cleanTag).filter(Boolean);
    const profilePool = isOccupationalHealthPlan(plan)
      ? [...fallback.profiles, ...instagramProfiles]
      : [...instagramProfiles, ...fallback.profiles];
    const channels: RadarSourceSuggestions["channels"] = {
      instagram: {
        profiles: [...new Set(profilePool)].slice(0, 8),
        hashtags: [...new Set([
          ...instagramHashtags,
          ...fallback.hashtags.map(cleanTag),
        ])].filter(Boolean).slice(0, 10),
        searchRationale: j.instagram?.searchRationale,
      },
      facebook: {
        profiles: [...new Set((j.facebook?.profiles ?? [])
          .map((h: string) => cleanChannelHandle(h, "facebook"))
          .filter(Boolean))].slice(0, 8) as string[],
        hashtags: [],
        searchRationale: j.facebook?.searchRationale,
      },
      tiktok: {
        profiles: [...new Set((j.tiktok?.profiles ?? [])
          .map((h: string) => cleanChannelHandle(h, "tiktok"))
          .filter(Boolean))].slice(0, 6) as string[],
        hashtags: [...new Set((j.tiktok?.hashtags ?? []).map(cleanTag).filter(Boolean))].slice(0, 8) as string[],
        searchRationale: j.tiktok?.searchRationale,
      },
    };
    return {
      profiles: channels.instagram.profiles,
      hashtags: channels.instagram.hashtags,
      channels,
    };
  } catch {
    return { profiles: fallback.profiles, hashtags: fallback.hashtags, channels: emptyChannels };
  }
}

function assessmentPosts(profile: SocialProfile, limit = 6) {
  const seen = new Set<string>();
  return [...(profile.topPosts ?? []), ...(profile.posts ?? [])]
    .filter(post => {
      const key = String(
        post.url ||
        post.img ||
        `${post.timestamp || ""}:${(post.caption || "").slice(0, 120)}`
      );
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function profileEvidence(profile: SocialProfile) {
  return [
    profile.bio,
    profile.category,
    ...assessmentPosts(profile).map(post => post.caption),
  ].filter(Boolean).join(" ");
}

const COMPETITIVE_VERTICALS: Record<string, string[]> = {
  arte_audiovisual: [
    "arte", "artistico", "artistica", "audiovisual", "video", "criacao",
    "processo criativo", "sustentavel", "sustentabilidade", "humor", "comedia",
  ],
  moda_beleza: [
    "moda", "fashion", "look", "looks", "roupa", "vestido", "maquiagem",
    "makeup", "beleza", "skincare", "cosmetico", "cabelo",
  ],
  fitness: [
    "fitness", "academia", "treino", "musculacao", "personal trainer",
    "emagrecimento", "nutricao esportiva",
  ],
  gastronomia: [
    "receita", "culinaria", "gastronomia", "restaurante", "comida",
    "confeitaria", "chef",
  ],
  educacao: [
    "educacao", "ensino", "aprendizagem", "escola", "professor", "pedagogia",
    "curso", "aula",
  ],
  saude: [
    "saude", "medicina", "psicologia", "terapia", "clinica", "bem estar",
    "bem-estar",
  ],
  tecnologia: [
    "tecnologia", "software", "saas", "automacao", "programacao", "startup",
    "inteligencia artificial",
  ],
};

function dominantVerticals(text: string) {
  const normalized = lowerPlain(text);
  return Object.entries(COMPETITIVE_VERTICALS)
    .map(([vertical, terms]) => ({
      vertical,
      score: terms.reduce(
        (total, term) => total + (normalized.includes(term) ? 1 : 0),
        0
      ),
    }))
    .filter(item => item.score >= 2)
    .sort((a, b) => b.score - a.score);
}

function hasContradictoryVertical(plan: any, profile: SocialProfile) {
  const planVerticals = new Set(
    dominantVerticals(sourceSeed(plan)).map(item => item.vertical)
  );
  const profileVerticals = dominantVerticals(profileEvidence(profile));
  return profileVerticals.some(
    item => item.score >= 3 && !planVerticals.has(item.vertical)
  );
}

function normalizeDimensions(raw: any): RadarFitDimensions {
  const source = raw?.dimensions ?? raw ?? {};
  return {
    audience: clamp(Number(source.audience) || 0, 0, 100),
    offer: clamp(Number(source.offer) || 0, 0, 100),
    subject: clamp(Number(source.subject) || 0, 0, 100),
    formatTone: clamp(
      Number(source.formatTone ?? source.format_tone) || 0,
      0,
      100
    ),
    visualDNA: clamp(
      Number(source.visualDNA ?? source.visual_dna) || 0,
      0,
      100
    ),
  };
}

export function qualifiesProfileAssessment(
  item: any,
  options: { manual?: boolean; hasVisualSample?: boolean } = {}
) {
  const decision = String(item?.decision || "");
  if (
    ![
      "concorrente_direto",
      "inspiracao",
      "inspiracao_integral",
      "inspiracao_de_componente",
    ].includes(decision)
  ) {
    return false;
  }
  if (item?.confidence === "baixa") return false;

  const manual = options.manual === true;
  const fitScore = clamp(Number(item?.fitScore) || 0, 0, 100);
  const dimensions = normalizeDimensions(item);
  const evidenceCount = Array.isArray(item?.evidence)
    ? item.evidence.map(String).filter(Boolean).length
    : 0;
  const minimumEvidence = manual ? 1 : 2;
  if (evidenceCount < minimumEvidence) return false;

  if (decision === "concorrente_direto") {
    return (
      fitScore >= (manual ? 65 : 78) &&
      dimensions.audience >= (manual ? 58 : 72) &&
      dimensions.offer >= (manual ? 55 : 68) &&
      dimensions.subject >= (manual ? 55 : 65)
    );
  }

  if (decision === "inspiracao_de_componente") {
    const component = String(item?.inspirationDimension || "");
    if (
      !["assunto", "formato_tom", "dna_visual", "mecanismo"].includes(
        component
      )
    ) {
      return false;
    }
    const componentScore =
      component === "assunto"
        ? dimensions.subject
        : component === "formato_tom"
          ? dimensions.formatTone
          : component === "dna_visual"
            ? dimensions.visualDNA
            : Math.max(
                dimensions.subject,
                dimensions.formatTone,
                dimensions.visualDNA
              );
    const supportingScores = [
      dimensions.subject,
      dimensions.formatTone,
      dimensions.visualDNA,
    ].sort((a, b) => b - a);
    return (
      fitScore >= (manual ? 62 : 68) &&
      componentScore >= (manual ? 72 : 78) &&
      (supportingScores[1] ?? 0) >= (manual ? 50 : 55)
    );
  }

  const visualGate = options.hasVisualSample
    ? dimensions.visualDNA >= (manual ? 52 : 65)
    : dimensions.formatTone >= (manual ? 68 : 82);
  return (
    fitScore >= (manual ? 65 : 78) &&
    dimensions.subject >= (manual ? 58 : 70) &&
    dimensions.formatTone >= (manual ? 62 : 74) &&
    visualGate
  );
}

export function fallbackProfileAssessment(
  plan: any,
  profile: SocialProfile,
  channel: RadarChannel,
  isManual: boolean
): RadarProfileMatch | null {
  const terms = planRelevanceTerms(plan);
  const text = lowerPlain([
    profile.handle,
    profile.fullName,
    profile.bio,
    profile.category,
    ...assessmentPosts(profile, 8).map(post => post.caption),
  ].filter(Boolean).join(" "));
  if (RADAR_BLOCKLIST_TERMS.some(term => text.includes(term))) return null;
  const matched = terms.filter(term => text.includes(term));
  const evidenceFields = [
    profile.bio,
    profile.category,
    ...assessmentPosts(profile, 8).map(post => post.caption),
  ].map(value => lowerPlain(String(value || "")));
  const matchedFields = evidenceFields.filter(field =>
    matched.some(term => field.includes(term))
  ).length;
  if (
    !isManual &&
    (matched.length < 4 ||
      matchedFields < 2 ||
      hasContradictoryVertical(plan, profile))
  ) {
    return null;
  }
  const fitScore = clamp(
    8 +
      matched.length * 8 +
      Math.min(matchedFields, 4) * 5 +
      (profile.bio ? 4 : 0) +
      (isManual ? 8 : 0),
    0,
    100
  );
  if (fitScore < (isManual ? 60 : 72)) return null;
  const dimensions: RadarFitDimensions = {
    audience: clamp(35 + matched.length * 7, 0, 88),
    offer: clamp(30 + matched.length * 7, 0, 88),
    subject: clamp(35 + matched.length * 9, 0, 94),
    formatTone: clamp(30 + matchedFields * 10, 0, 80),
    visualDNA: 0,
  };
  return {
    channel,
    handle: cleanChannelHandle(profile.handle, channel),
    fullName: profile.fullName,
    bio: profile.bio,
    followers: profile.followers,
    profilePic: profile.profilePic,
    role: fitScore >= 82 ? "concorrente_direto" : "inspiracao",
    fitScore,
    confidence: matched.length >= 6 ? "alta" : "media",
    reason: matched.length
      ? `Aderencia comprovada por ${matched.slice(0, 5).join(", ")}.`
      : "Perfil informado manualmente para comparacao.",
    audienceOverlap: matched.slice(0, 3).join(", ") || "A validar com o usuario",
    offerOverlap: fitScore >= 76 ? "Oferta ou problema atendido parecem comparaveis." : "Oferta diferente; util como inspiracao.",
    contentOpportunity: "Observar os formatos fora da curva e adaptar o mecanismo ao DNA da marca.",
    evidence: matched.slice(0, 6),
    dimensions,
  };
}

interface PublicProfileResearch {
  handle: string;
  positioning?: string;
  signatureMechanisms?: string[];
  compatibilityClues?: string[];
  incompatibilityClues?: string[];
  sources?: string[];
}

async function researchMarketProfiles(
  plan: any,
  profiles: SocialProfile[],
  channel: RadarChannel
) {
  const empty = new Map<string, PublicProfileResearch>();
  if (!process.env.OPENROUTER_API_KEY || !profiles.length) return empty;
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o pesquisador publico do Agente de Inteligencia Competitiva da Cacarejar.
Pesquise o posicionamento e os mecanismos editoriais dos perfis REAIS recebidos.
Esta pesquisa complementa uma janela limitada de posts recentes; nao substitui as evidencias coletadas.

Retorne SOMENTE JSON:
{"profiles":[{
  "handle":"exatamente um handle recebido",
  "positioning":"atividade e proposta editorial comprovadas",
  "signatureMechanisms":["mecanismo recorrente comprovado"],
  "compatibilityClues":["evidencia que pode aproximar da marca analisada"],
  "incompatibilityClues":["evidencia que afasta da marca analisada"],
  "sources":["URL publica consultada"]
}]}

Regras:
- Pesquise cada handle exatamente como recebido e nao troque por homonimos.
- Prefira site oficial, entrevistas, imprensa reconhecida e descricoes publicas do proprio criador.
- Procure recorrencia: obra, processo, humor, formato, acabamento, bastidor e relacao com o publico.
- Popularidade, genero, aparencia e tamanho de audiencia nao sao mecanismos editoriais.
- Nao invente. Se nao houver evidencia publica suficiente, deixe os campos vazios.
- Registre no maximo tres fontes por perfil.`,
      },
      {
        role: "user",
        content: `MARCA ANALISADA
${JSON.stringify({
  produto: plan?.produto,
  perfil: {
    handle: plan?.profile?.handle,
    bio: plan?.profile?.bio,
  },
  dna: plan?.brandDNA,
  postsCampeoes: (plan?.profile?.topPosts ?? [])
    .slice(0, 5)
    .map((post: any) => String(post?.caption || "").slice(0, 360)),
})}

CANAL: ${channel}
PERFIS VERIFICADOS PARA PESQUISA:
${JSON.stringify(profiles.map(profile => ({
  handle: cleanChannelHandle(profile.handle, channel),
  nome: profile.fullName,
  bio: profile.bio,
})))}`,
      },
    ], { model: DISCOVERY_BRAIN, temperature: 0.1, maxTokens: 3200 });
    const parsed = parseJson<{ profiles?: PublicProfileResearch[] }>(content);
    const allowed = new Set(
      profiles.map(profile => cleanChannelHandle(profile.handle, channel))
    );
    const result = new Map<string, PublicProfileResearch>();
    for (const item of parsed?.profiles ?? []) {
      const handle = cleanChannelHandle(item?.handle || "", channel);
      if (!allowed.has(handle)) continue;
      result.set(handle, {
        handle,
        positioning: String(item?.positioning || "").slice(0, 700),
        signatureMechanisms: Array.isArray(item?.signatureMechanisms)
          ? item.signatureMechanisms.map(String).filter(Boolean).slice(0, 5)
          : [],
        compatibilityClues: Array.isArray(item?.compatibilityClues)
          ? item.compatibilityClues.map(String).filter(Boolean).slice(0, 5)
          : [],
        incompatibilityClues: Array.isArray(item?.incompatibilityClues)
          ? item.incompatibilityClues.map(String).filter(Boolean).slice(0, 5)
          : [],
        sources: Array.isArray(item?.sources)
          ? item.sources.map(String).filter(Boolean).slice(0, 3)
          : [],
      });
    }
    return result;
  } catch {
    return empty;
  }
}

async function assessMarketProfiles(
  plan: any,
  profiles: SocialProfile[],
  channel: RadarChannel,
  manualHandles: string[],
  ownProfile?: SocialProfile
): Promise<RadarProfileMatch[]> {
  if (!profiles.length) return [];
  const manual = new Set(manualHandles.map(handle => cleanChannelHandle(handle, channel)));
  const fallback = profiles
    .map(profile =>
      fallbackProfileAssessment(
        plan,
        profile,
        channel,
        manual.has(cleanChannelHandle(profile.handle, channel))
      )
    )
    .filter((match): match is RadarProfileMatch => !!match);
  if (!process.env.OPENROUTER_API_KEY) return fallback;

  try {
    const publicResearch = await researchMarketProfiles(plan, profiles, channel);
    const candidates = profiles.map(profile => ({
      handle: cleanChannelHandle(profile.handle, channel),
      nome: profile.fullName,
      bio: profile.bio,
      categoria: profile.category,
      seguidores: profile.followers,
      informadoPeloUsuario: manual.has(cleanChannelHandle(profile.handle, channel)),
      temAmostraVisual: assessmentPosts(profile).some(post => Boolean(post.img)),
      amostraPublicacoes: assessmentPosts(profile).map((post, index) => ({
        prioridade: index < (profile.topPosts?.length ?? 0)
          ? "post_campeao"
          : "post_recente",
        texto: (post.caption || "").slice(0, 420),
        curtidas: post.likes,
        comentarios: post.comments,
        compartilhamentos: post.shares,
        visualizacoes: post.views,
      })),
      pesquisaPublica:
        publicResearch.get(cleanChannelHandle(profile.handle, channel)) ?? null,
    }));
    const prompt = `MARCA ANALISADA
${JSON.stringify({
  produto: plan?.produto,
  nicho: plan?.nicho,
  resumo: plan?.resumoDiagnostico || plan?.resumo,
  sumario: plan?.sumarioExecutivo,
  objetivo: plan?.objetivoPrincipal,
  perfil: {
    handle: plan?.profile?.handle,
    nome: plan?.profile?.fullName,
    bio: plan?.profile?.bio,
    categoria: plan?.profile?.category,
  },
  dna: plan?.brandDNA,
  postsCampeoes: (plan?.profile?.topPosts ?? [])
    .slice(0, 5)
    .map((post: any) => String(post?.caption || "").slice(0, 420)),
})}

CANAL: ${channel}
CANDIDATOS COLETADOS:
${JSON.stringify(candidates)}

As imagens seguintes estao identificadas pelo handle. Compare composicao, acabamento,
cenario, expressao, uso de texto, energia, processo e linguagem visual com o DNA descrito.
Uma foto bonita, um rosto humano ou porte de audiencia semelhante NAO constituem aderencia.
A pesquisa publica complementa a janela recente de posts, mas so vale quando traz posicionamento,
mecanismo e fontes concretas. Em caso de conflito, explique a divergencia nas evidencias.`;
    const visualParts: ContentPart[] = [{ type: "text", text: prompt }];
    const ownImages = [
      ...(ownProfile?.topPosts ?? []),
      ...(ownProfile?.posts ?? []),
      ...(plan?.profile?.topPosts ?? []),
    ]
      .map((post: any) => post?.img)
      .filter(Boolean)
      .slice(0, 2);
    ownImages.forEach((img: string, index: number) => {
      visualParts.push({
        type: "text",
        text: `REFERENCIA VISUAL DA MARCA ANALISADA ${index + 1}:`,
      });
      visualParts.push({ type: "image_url", image_url: { url: img } });
    });
    for (const profile of profiles.slice(0, 12)) {
      const samples = assessmentPosts(profile)
        .filter(post => Boolean(post.img))
        .slice(0, 2);
      samples.forEach((sample, index) => {
        visualParts.push({
          type: "text",
          text: `POST ${index + 1} DE MELHOR DESEMPENHO DO CANDIDATO @${cleanChannelHandle(profile.handle, channel)}
Legenda: ${(sample.caption || "").slice(0, 260)}
Curtidas: ${sample.likes || 0}; comentarios: ${sample.comments || 0}; visualizacoes: ${sample.views || 0}`,
        });
        visualParts.push({
          type: "image_url",
          image_url: { url: sample.img! },
        });
      });
    }

    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Inteligencia Competitiva da Cacarejar.
Avalie perfis REAIS ja coletados. O objetivo nao e achar gente parecida visualmente; e encontrar concorrentes e inspiracoes estrategicas.

Classifique cada candidato como:
- concorrente_direto: publico e problema/oferta comparaveis;
- inspiracao_integral: assunto, formato/tom e DNA visual se combinam de forma ampla;
- inspiracao_de_componente: apenas UM componente editorial e realmente forte e util;
- rejeitar: coincidencia superficial, tema ocasional, agregador, noticia, sorteio, celebridade generica, conteudo sensivel ou negocio sem relacao.

Retorne SOMENTE JSON:
{"assessments":[{
  "handle":"exatamente um handle recebido",
  "decision":"concorrente_direto|inspiracao_integral|inspiracao_de_componente|rejeitar",
  "fitScore":0,
  "confidence":"alta|media|baixa",
  "dimensions":{"audience":0,"offer":0,"subject":0,"formatTone":0,"visualDNA":0},
  "inspirationDimension":"assunto|formato_tom|dna_visual|mecanismo|",
  "reason":"por que este perfil serve ou nao serve",
  "audienceOverlap":"publico compartilhado",
  "offerOverlap":"relacao entre ofertas",
  "contentOpportunity":"o que observar sem copiar",
  "evidence":["evidencia concreta 1","evidencia concreta 2"]
}]}

Regras duras:
- concorrente_direto exige publico, problema, oferta e assunto comparaveis.
- inspiracao_integral exige assunto, mecanismo editorial, tom/formato e DNA visual realmente aplicaveis.
- inspiracao_de_componente so pode ser usada quando o componente nomeado for forte e houver ao menos uma segunda dimensao de apoio. A justificativa deve comecar com "Inspiracao apenas para..." e dizer claramente o que NAO e comparavel.
- Audiencia, numero de seguidores e "marca pessoal" nunca podem ser o componente de inspiracao.
- Nota alta nunca pode nascer apenas de audiencia numericamente parecida, marca pessoal, rosto humano ou popularidade.
- Se o perfil analisado usa linguagem raw, humor, bastidores e processo autoral, fotografia polida de moda/lifestyle nao e inspiracao.
- Se oferta e assunto forem de outro setor, audience e visualDNA nao podem compensar sozinhos.
- Quando houver imagem, compare acabamento, cenario, expressao, texto na tela, energia e processo. Quando nao houver imagem, visualDNA nao pode passar de 55.
- fitScore deve refletir as cinco dimensoes, e nao uma impressao geral generica.
- Aparencia, genero, roupa, cor, popularidade ou uma palavra solta nao provam aderencia.
- Perfis de crime, violencia, sensualizacao, noticias, sorteios e engajamento forcado devem ser rejeitados, salvo quando forem o proprio campo profissional do cliente.
- Nao invente informacao. Quando a evidencia for insuficiente, rejeite.
- Cada perfil aceito precisa ter ao menos duas evidencias concretas retiradas da bio, publicacoes ou imagem.
- Avalie todos os handles e nunca altere seus nomes.`,
      },
      {
        role: "user",
        content: visualParts,
      },
    ], { model: BRAIN, temperature: 0.15, maxTokens: 5200 });
    const parsed = parseJson<{ assessments?: any[] }>(content);
    const byHandle = new Map(
      profiles.map(profile => [
        cleanChannelHandle(profile.handle, channel),
        profile,
      ])
    );
    const accepted: RadarProfileMatch[] = [];
    for (const item of parsed?.assessments ?? []) {
      const handle = cleanChannelHandle(item?.handle || "", channel);
      const profile = byHandle.get(handle);
      if (!profile) continue;
      const fitScore = clamp(Number(item?.fitScore) || 0, 0, 100);
      if (item?.decision === "rejeitar") {
        console.info("[radar-qualification]", JSON.stringify({
          event: "profile_rejected",
          channel,
          handle,
          decision: item?.decision,
          fitScore,
          confidence: item?.confidence,
          dimensions: normalizeDimensions(item),
          reason: String(item?.reason || "").slice(0, 320),
        }));
        continue;
      }
      const hasVisualSample = profile.posts.some(post => Boolean(post.img));
      if (
        !qualifiesProfileAssessment(item, {
          manual: manual.has(handle),
          hasVisualSample,
        })
      ) {
        console.info("[radar-qualification]", JSON.stringify({
          event: "profile_rejected",
          channel,
          handle,
          decision: item?.decision,
          fitScore,
          confidence: item?.confidence,
          dimensions: normalizeDimensions(item),
          reason: String(item?.reason || "").slice(0, 320),
        }));
        continue;
      }
      const dimensions = normalizeDimensions(item);
      accepted.push({
        channel,
        handle,
        fullName: profile.fullName,
        bio: profile.bio,
        followers: profile.followers,
        profilePic: profile.profilePic,
        role: item?.decision === "concorrente_direto"
          ? "concorrente_direto"
          : "inspiracao",
        matchScope:
          item?.decision === "inspiracao_de_componente"
            ? "componente_editorial"
            : "perfil_completo",
        inspirationDimension:
          item?.decision === "inspiracao_de_componente"
            ? String(item?.inspirationDimension || "mecanismo")
            : undefined,
        fitScore,
        confidence: item?.confidence === "alta" ? "alta" : "media",
        reason: String(item?.reason || "Perfil aderente ao contexto do negocio."),
        audienceOverlap: String(item?.audienceOverlap || "Publico semelhante."),
        offerOverlap: String(item?.offerOverlap || "Oferta complementar ou comparavel."),
        contentOpportunity: String(item?.contentOpportunity || "Analisar mecanismos vencedores sem copiar."),
        evidence: Array.isArray(item?.evidence)
          ? item.evidence.map(String).filter(Boolean).slice(0, 4)
          : [],
        dimensions,
      });
    }
    return accepted
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 8);
  } catch (error) {
    console.error("[radar] qualificacao de perfis falhou:", (error as any)?.message);
    return fallback.filter(match => match.confidence !== "baixa");
  }
}

export function commercialSignals(profiles: SocialProfile[]) {
  const signals = new Map<
    string,
    {
      handle: string;
      mentions: number;
      commercialMentions: number;
      evidence: string[];
      channels: Set<RadarChannel>;
    }
  >();
  const ownHandles = new Set(
    profiles.map(profile => lowerPlain(profile.handle)).filter(Boolean)
  );
  for (const profile of profiles) {
    for (const post of profile.posts ?? []) {
      const caption = String(post.caption || "");
      const mentions = caption.match(/@[a-zA-Z0-9._]{2,}/g) ?? [];
      const commercial = /\b(publi|publicidade|parceria|patrocin|ad\b|ad:|apoio|oferecimento|embaixador|embaixadora|cupom|desconto)\b/i.test(
        stripAccents(caption)
      );
      for (const raw of mentions) {
        const handle = raw.slice(1).toLowerCase();
        if (!handle || ownHandles.has(handle)) continue;
        const row = signals.get(handle) ?? {
          handle,
          mentions: 0,
          commercialMentions: 0,
          evidence: [],
          channels: new Set<RadarChannel>(),
        };
        row.mentions += 1;
        if (commercial) row.commercialMentions += 1;
        row.channels.add(profile.network);
        if (row.evidence.length < 3) {
          row.evidence.push(
            `${profile.handle}: "${caption.slice(0, 180)}"${post.url ? ` (${post.url})` : ""}`
          );
        }
        signals.set(handle, row);
      }
    }
  }
  return [...signals.values()].sort(
    (a, b) =>
      b.commercialMentions - a.commercialMentions ||
      b.mentions - a.mentions
  );
}

async function discoverBrandProspects(
  plan: any,
  profiles: SocialProfile[],
  profileMatches: RadarProfileMatch[],
  channel: RadarChannel
): Promise<RadarBrandProspect[]> {
  const signals = commercialSignals(profiles);
  const verified = signals
    .filter(signal => signal.commercialMentions > 0)
    .slice(0, 5)
    .map<RadarBrandProspect>(signal => ({
      channel,
      brand: `@${signal.handle}`,
      handle: signal.handle,
      category: "Marca citada em conteudo comercial",
      relationship: "investiu_em_perfil_similar",
      evidenceLevel: "sinal_publico",
      fitScore: clamp(72 + signal.commercialMentions * 6, 0, 96),
      why: "A marca apareceu em publicacao com sinal de parceria, publicidade ou promocao em um perfil qualificado pelo Radar.",
      interestedThemes: [],
      evidence: signal.evidence,
      approach: "Estude a parceria encontrada e apresente uma proposta ligada ao mesmo objetivo, com um formato autoral do perfil selecionado.",
    }));

  if (!process.env.OPENROUTER_API_KEY) return verified;
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Oportunidades de Marca da Cacarejar.
Encontre marcas que podem se interessar pelo perfil analisado.

Existem duas classes:
1. investiu_em_perfil_similar: somente quando ha evidencia publica fornecida de publi, parceria ou patrocinio;
2. aderencia_potencial: marca cuja categoria, publico e temas combinam, mas sem afirmar investimento anterior.

Retorne SOMENTE JSON:
{"brands":[{
  "brand":"nome da marca",
  "handle":"handle se souber, sem @",
  "category":"categoria",
  "relationship":"investiu_em_perfil_similar|aderencia_potencial",
  "evidenceLevel":"sinal_publico|hipotese",
  "fitScore":0,
  "why":"por que pode se interessar",
  "interestedThemes":["tema 1","tema 2"],
  "evidence":["evidencia concreta"],
  "approach":"abordagem especifica para iniciar conversa"
}]}

Regras:
- Nunca diga que uma marca investiu sem uma evidencia publica recebida.
- Para hipoteses, prefira marcas reais com operacao no Brasil e explique a afinidade.
- Evite uma lista obvia de gigantes. Misture marcas nichadas, empresas medias e no maximo duas grandes.
- A nota mede afinidade comercial, nao fama.
- Nao prometa contato, verba ou interesse confirmado.
- Gere no maximo 8 oportunidades, ordenadas por utilidade.`,
      },
      {
        role: "user",
        content: `PERFIL E NEGOCIO
${JSON.stringify({
  produto: plan?.produto,
  nicho: plan?.nicho,
  resumo: plan?.resumoDiagnostico || plan?.resumo,
  objetivo: plan?.objetivoPrincipal,
  perfil: plan?.profile,
  dna: plan?.brandDNA,
})}

PERFIS SIMILARES QUALIFICADOS
${JSON.stringify(profileMatches)}

SINAIS PUBLICOS DE MARCAS NAS PUBLICACOES
${JSON.stringify(signals.slice(0, 20).map(signal => ({
  handle: signal.handle,
  mencoes: signal.mentions,
  mencoesComSinalComercial: signal.commercialMentions,
  evidencias: signal.evidence,
})))}`,
      },
    ], { model: BRAIN, temperature: 0.2, maxTokens: 4200 });
    const parsed = parseJson<{ brands?: any[] }>(content);
    const commercialByHandle = new Map(
      signals.map(signal => [signal.handle, signal])
    );
    const prospects: RadarBrandProspect[] = [];
    for (const item of parsed?.brands ?? []) {
      const handle = lowerPlain(String(item?.handle || "").replace(/^@/, ""));
      const signal = handle ? commercialByHandle.get(handle) : undefined;
      const askedInvested = item?.relationship === "investiu_em_perfil_similar";
      const hasPublicSignal = !!signal?.commercialMentions;
      const relationship = askedInvested && hasPublicSignal
        ? "investiu_em_perfil_similar"
        : "aderencia_potencial";
      const evidenceLevel = relationship === "investiu_em_perfil_similar"
        ? "sinal_publico"
        : "hipotese";
      const brand = String(item?.brand || (handle ? `@${handle}` : "")).trim();
      if (!brand) continue;
      prospects.push({
        channel,
        brand,
        handle: handle || undefined,
        category: String(item?.category || "Marca com afinidade tematica"),
        relationship,
        evidenceLevel,
        fitScore: clamp(Number(item?.fitScore) || 0, 0, 100),
        why: String(item?.why || "Afinidade potencial com o publico e os temas do perfil."),
        interestedThemes: Array.isArray(item?.interestedThemes)
          ? item.interestedThemes.map(String).filter(Boolean).slice(0, 5)
          : [],
        evidence: relationship === "investiu_em_perfil_similar"
          ? signal!.evidence
          : Array.isArray(item?.evidence)
            ? item.evidence.map(String).filter(Boolean).slice(0, 3)
            : [],
        approach: String(item?.approach || "Apresente uma proposta curta com tema, formato e beneficio para a marca."),
      });
    }
    const merged = [...verified, ...prospects]
      .filter(prospect => prospect.fitScore >= 55)
      .sort((a, b) => {
        if (a.relationship !== b.relationship) {
          return a.relationship === "investiu_em_perfil_similar" ? -1 : 1;
        }
        return b.fitScore - a.fitScore;
      });
    const seen = new Set<string>();
    return merged.filter(prospect => {
      const key = lowerPlain(prospect.handle || prospect.brand);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  } catch (error) {
    console.error("[radar] prospeccao de marcas falhou:", (error as any)?.message);
    return verified;
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

function contextFallbackPatterns(plan: any): MarketPattern[] {
  const seed = sourceSeed(plan);
  if (/\b(saude do trabalho|saudedotrabalho|sst|seguranca do trabalho|medicina ocupacional|sesmt|pcmso|pgr|esocial|ergonomia)\b/.test(seed)) {
    return [
      {
        title: "Obrigacao invisivel que vira risco caro",
        insight: "No mercado de Saude do Trabalho, conteudos que traduzem uma obrigacao tecnica em risco financeiro e humano tendem a gerar atencao qualificada.",
        hotScore: 68,
        evidenceCount: 0,
        whyItWorks: "O decisor nao compra norma; ele compra reducao de risco, tranquilidade e previsibilidade.",
        audienceDesire: "Entender o que precisa resolver agora para evitar multa, passivo trabalhista ou acidente.",
        contentMechanism: "dor operacional",
        recommendedMove: "Criar posts que comecem pela consequencia concreta e depois expliquem PCMSO, PGR, ASO, ergonomia ou eSocial em linguagem simples.",
        risks: "Evitar linguagem alarmista sem prova e evitar parecer aula juridica pesada.",
        sourcePostIndexes: [],
      },
      {
        title: "RH e gestor como herois da prevencao",
        insight: "Conteudos que posicionam RH, gestores e SESMT como protagonistas da protecao das pessoas criam identificacao e autoridade.",
        hotScore: 62,
        evidenceCount: 0,
        whyItWorks: "Tira o tema do campo burocratico e leva para cuidado, reputacao e gestao responsavel.",
        audienceDesire: "Mostrar que a empresa cuida de pessoas sem perder controle operacional.",
        contentMechanism: "autoridade humana",
        recommendedMove: "Usar bastidores, checklists e casos anonimos que mostrem decisao correta antes do problema aparecer.",
        risks: "Nao prometer eliminacao total de risco; vender metodo e acompanhamento.",
        sourcePostIndexes: [],
      },
    ];
  }
  return [
    {
      title: "Dor especifica antes da solucao",
      insight: "Quando nao ha volume de posts suficiente, a aposta mais segura e abrir pelo problema concreto que o cliente reconhece.",
      hotScore: 55,
      evidenceCount: 0,
      whyItWorks: "A audiencia presta atencao quando sente que o conteudo nomeou uma dor real.",
      audienceDesire: "Saber se existe um caminho simples para resolver sem perder tempo.",
      contentMechanism: "quebra de crenca",
      recommendedMove: "Criar uma peca com erro comum, consequencia e primeira acao recomendada.",
      risks: "Evitar generalidades e promessas amplas demais.",
      sourcePostIndexes: [],
    },
  ];
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

export async function scan(
  orgId: number,
  opts: {
    handles?: string[];
    excludeHandles?: string[];
    feedback?: RadarResult["feedback"];
    channel?: RadarChannel;
    strictQualification?: boolean;
  } = {}
): Promise<RadarResult> {
  const plan: any = await getPlan(orgId);
  if (!plan) throw new Error("Faca o diagnostico primeiro");
  const channel: RadarChannel = opts.channel ?? "instagram";
  const produto = plan.produto || "";
  const nicho = plan.nicho || "";
  const brandDNA = plan.brandDNA ?? {};
  const ctx = baseContext(plan);
  const ownHandle = ctx.ownHandle;

  const suggestion = await suggestSources(orgId);
  const channelSuggestion = suggestion.channels[channel];
  const hashtags = channelSuggestion.hashtags;
  const exclude = new Set(
    (opts.excludeHandles ?? [])
      .map(handle => cleanChannelHandle(handle, channel))
      .filter(Boolean)
  );
  const manualHandles = (opts.handles ?? [])
    .map(handle => cleanChannelHandle(handle, channel))
    .filter(Boolean);
  let handles = manualHandles.filter(
    handle =>
      handle &&
      !(channel === "instagram" && handle === ownHandle) &&
      !exclude.has(handle)
  );
  let hashtagPosts: HotPost[] = [];
  let relatedHandles: string[] = [];
  let ownProfile: SocialProfile | undefined;
  if (!handles.length && channel === "instagram" && ownHandle) {
    [ownProfile] = await fetchInstagramProfilesBatch([ownHandle]);
    relatedHandles = (ownProfile?.relatedProfiles ?? [])
      .map(profile => cleanChannelHandle(profile.handle, "instagram"))
      .filter(handle => handle && handle !== ownHandle && !exclude.has(handle));
  }
  if (!handles.length && channel === "instagram") {
    hashtagPosts = hashtags.length ? await fetchHotPostsByHashtag(hashtags, 60) : [];
    const owners = [...hashtagPosts]
      .sort((a, b) => engagement(b.likes, b.comments) - engagement(a.likes, a.comments))
      .map(p => cleanChannelHandle(p.ownerUsername || "", "instagram"))
      .filter(Boolean);
    handles = [...new Set([
      ...channelSuggestion.profiles,
      ...owners,
      ...relatedHandles,
    ])].filter(handle => handle && handle !== ownHandle && !exclude.has(handle));
  } else if (!handles.length) {
    handles = channelSuggestion.profiles.filter(handle => !exclude.has(handle));
  }
  handles = handles.slice(0, 18);

  const profiles = channel === "instagram"
    ? await fetchInstagramProfilesBatch(handles)
    : channel === "tiktok"
      ? await fetchTikTokProfilesBatch(handles)
      : await fetchFacebookPagesBatch(handles);
  const profileMatches = await assessMarketProfiles(
    plan,
    profiles,
    channel,
    opts.strictQualification ? [] : manualHandles,
    ownProfile
  );
  const acceptedHandles = new Set(profileMatches.map(match => match.handle));
  const acceptedProfiles = profiles.filter(profile =>
    acceptedHandles.has(cleanChannelHandle(profile.handle, channel))
  );
  const qualityWarnings: string[] = [];
  const missingSources: string[] = [];
  if (handles.length && profiles.length < handles.length) {
    const readHandles = new Set(
      profiles.map(profile => cleanChannelHandle(profile.handle, channel))
    );
    const notRead = handles.filter(
      handle => !readHandles.has(cleanChannelHandle(handle, channel))
    );
    if (notRead.length) {
      missingSources.push(...notRead.map(h => `@${h}`));
      qualityWarnings.push(`Nem todos os perfis informados foram lidos automaticamente (${notRead.slice(0, 5).join(", ")}).`);
    }
  }
  if (!profiles.length && !hashtagPosts.length) {
    qualityWarnings.push("A coleta automatica nao trouxe perfis ou hashtags com posts suficientes nesta rodada.");
  }
  if (profiles.length && !profileMatches.length) {
    qualityWarnings.push(
      "Os perfis coletados nao provaram aderencia suficiente de publico, oferta ou conteudo e foram descartados."
    );
  }
  const candidates: RadarHit[] = [];

  for (const p of acceptedProfiles) {
    const profileMatch = profileMatches.find(
      match => match.handle === cleanChannelHandle(p.handle, channel)
    );
    const posts = (p.posts ?? []).filter(
      (post: SocialPost) => channel === "facebook" || post.img
    );
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
        channel,
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
        profileRole: profileMatch?.role,
        profileMatchScope: profileMatch?.matchScope,
        profileInspirationDimension: profileMatch?.inspirationDimension,
        profileFitScore: profileMatch?.fitScore,
        profileConfidence: profileMatch?.confidence,
        profileMatchReason: profileMatch?.reason,
        ...score,
      });
    }
  }

  for (const post of channel === "instagram" ? hashtagPosts.filter(p => p.img) : []) {
    const owner = cleanChannelHandle(post.ownerUsername || "", "instagram");
    const profileMatch = profileMatches.find(match => match.handle === owner);
    if (!profileMatch) continue;
    const score = calcHotScore({ likes: post.likes, comments: post.comments, timestamp: (post as any).timestamp });
    candidates.push({
      channel,
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
      profileRole: profileMatch.role,
      profileMatchScope: profileMatch.matchScope,
      profileInspirationDimension: profileMatch.inspirationDimension,
      profileFitScore: profileMatch.fitScore,
      profileConfidence: profileMatch.confidence,
      profileMatchReason: profileMatch.reason,
      ...score,
    });
  }

  const seen = new Set<string>();
  const ownerCounts = new Map<string, number>();
  let filteredOutByRelevance = 0;
  const hits = candidates
    .sort(
      (a, b) =>
        (b.profileFitScore ?? 0) - (a.profileFitScore ?? 0) ||
        (b.hotScore ?? 0) - (a.hotScore ?? 0)
    )
    .filter(h => {
      const key = (h.url || h.img || "") + (h.ownerUsername || "");
      const owner = cleanChannelHandle(h.ownerUsername || "", channel);
      if (
        (!h.img && channel !== "facebook") ||
        seen.has(key) ||
        (ownerCounts.get(owner) ?? 0) >= 3 ||
        (channel === "instagram" && h.ownerUsername === ownHandle) ||
        exclude.has(owner)
      ) return false;
      if (!isRelevantHitForPlan(plan, h, { relaxed: !!opts.handles?.length })) {
        filteredOutByRelevance += 1;
        return false;
      }
      seen.add(key);
      if (owner) ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
      return true;
    })
    .slice(0, 18);

  if (hits.length) {
    await Promise.all(hits.map(async (h, i) => { h.img = await localizeRemoteImage(h.img, `radar_hit${i}`); }));
  }
  const scanned = [...new Set(hits.map(h => h.ownerUsername).filter(Boolean))] as string[];
  const brandProspectsPromise = discoverBrandProspects(
    plan,
    acceptedProfiles,
    profileMatches,
    channel
  );

  let marketSummary = hits.length
    ? ""
    : "O Agente nao encontrou posts publicos suficientes na coleta automatica desta rodada. Ainda assim, montou uma leitura inicial pelo diagnostico e pelas hashtags seguras do nicho; informe @ inspiradores para aprofundar com evidencias reais.";
  let patterns: MarketPattern[] = hits.length ? fallbackPatterns(hits) : contextFallbackPatterns(plan);
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
      : isOccupationalHealthPlan(plan)
        ? "Pesquisa com poucos sinais aderentes; o Agente filtrou posts fora de Saude do Trabalho/SST. Informe @ inspiradores para aprofundar."
        : "Pesquisa com poucos sinais; informe perfis inspiradores para aprofundar.",
  };
  if (!hits.length) {
    qualityWarnings.push("O Radar ficou sem evidencias visuais suficientes e usou contexto do diagnostico como apoio.");
  }
  if (filteredOutByRelevance > 0) {
    qualityWarnings.push(`${filteredOutByRelevance} post(s) foram ocultados por baixa aderencia, tema sensivel ou mecanica oportunista.`);
  }
  const dataQuality: RadarResult["dataQuality"] = {
    status: qualityWarnings.length || quality.grade === "fraca" ? "degraded" : "complete",
    message: qualityWarnings.length || quality.grade === "fraca"
      ? "Leitura parcial do mercado. Use como sinal inicial e informe perfis inspiradores para aprofundar."
      : "Leitura feita com bom volume de evidencias automaticas.",
    missing: missingSources,
    warnings: qualityWarnings,
    checkedAt: Date.now(),
  };
  if (dataQuality.status === "degraded") {
    console.warn("[data-quality]", JSON.stringify({
      event: "radar_degraded",
      orgId,
      handles,
      missing: missingSources,
      hitsCount: hits.length,
      sourcesCount: scanned.length,
      warnings: qualityWarnings,
    }));
  }

  const brandProspects = await brandProspectsPromise;
  const scannedAt = Date.now();
  const current = await getRadar(orgId);
  const channels: NonNullable<RadarResult["channels"]> = {
    ...(current?.engineVersion === 3 ? current.channels ?? {} : {}),
    [channel]: {
      scannedAt,
      marketSummary,
      sources: scanned,
      hashtags,
      hits,
      profileMatches,
      brandProspects,
      patterns,
      opportunities,
      ideas,
      quality,
      dataQuality,
    },
  };
  const channelSnapshots = Object.values(channels).filter(Boolean);
  const combinedHits = channelSnapshots.flatMap(snapshot => snapshot!.hits);
  const combinedProfiles = channelSnapshots.flatMap(
    snapshot => snapshot!.profileMatches
  );
  const combinedBrands = channelSnapshots.flatMap(
    snapshot => snapshot!.brandProspects
  );
  const result: RadarResult = {
    scannedAt,
    engineVersion: 3,
    activeChannel: channel,
    nicho,
    baseHandle: ownHandle || undefined,
    baseKey: ctx.key || undefined,
    baseLabel: ctx.label || undefined,
    baseSource: ctx.source || undefined,
    baseProduto: produto || undefined,
    marketSummary,
    sources: [...new Set(channelSnapshots.flatMap(snapshot => snapshot!.sources))],
    hashtags: [...new Set(channelSnapshots.flatMap(snapshot => snapshot!.hashtags))],
    hits: combinedHits,
    profileMatches: combinedProfiles,
    brandProspects: combinedBrands,
    channels,
    patterns,
    opportunities,
    ideas,
    quality,
    dataQuality,
    feedback: opts.feedback ?? current?.feedback,
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

async function suggestMoreLike(
  orgId: number,
  likedHandles: string[],
  rejectedHandles: string[],
  likedPosts: RadarHit[] = [],
  channel: RadarChannel = "instagram"
): Promise<string[]> {
  const plan: any = await getPlan(orgId);
  const produto = plan?.produto || "";
  const nicho = plan?.nicho || "";
  if (!process.env.OPENROUTER_API_KEY || !likedHandles.length) return [];
  try {
    const content = await openRouterChat([
      {
        role: "system",
        content: `Voce e o Agente de Inteligencia Competitiva da Cacarejar. O usuario marcou quais perfis e posts parecem compativeis com a marca.
Sugira NOVOS handles brasileiros de ${channel} parecidos em publico, oferta ou mecanismo editorial, evitando os rejeitados.
Retorne SOMENTE JSON {"profiles":[handles sem @, 8-12]}.
Priorize perfis reais, nichados, com boa chance de ter conteudo acionavel. Busque variedade: no maximo um perfil muito parecido para cada aprovado. Nao repita nenhum handle informado. Aparencia visual nao prova aderencia.`,
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
    return [...new Set((parsed?.profiles ?? [])
      .map(handle => cleanChannelHandle(handle, channel))
      .filter(Boolean))]
      .filter(h => !likedHandles.includes(h) && !rejectedHandles.includes(h))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export async function refineWithFeedback(
  orgId: number,
  input: string[] | {
    likedHandles?: string[];
    likedPostKeys?: string[];
    dislikedPostKeys?: string[];
    channel?: RadarChannel;
  }
): Promise<RadarResult> {
  const current = await getRadar(orgId);
  if (!current?.sources?.length) throw new Error("Faca uma pesquisa de Radar primeiro");

  const channel: RadarChannel = Array.isArray(input)
    ? current.activeChannel ?? "instagram"
    : input.channel ?? current.activeChannel ?? "instagram";
  const channelHits = current.channels?.[channel]?.hits ??
    (current.hits ?? []).filter(hit => (hit.channel ?? "instagram") === channel);
  const likedPostKeys = new Set((Array.isArray(input) ? [] : input.likedPostKeys ?? []).map(String).filter(Boolean));
  const dislikedPostKeys = [...new Set((Array.isArray(input) ? [] : input.dislikedPostKeys ?? []).map(String).filter(Boolean))];
  const fallbackLikedHandles = Array.isArray(input) ? input : (input.likedHandles ?? []);
  const likedPosts = channelHits.filter(h => likedPostKeys.has(hitKey(h)));
  const likedHandles = [...new Set([
    ...likedPosts.map(h => cleanChannelHandle(h.ownerUsername || "", channel)).filter(Boolean),
    ...fallbackLikedHandles.map(handle => cleanChannelHandle(handle, channel)).filter(Boolean),
  ])];
  if (!likedHandles.length) throw new Error("Marque Gostei em pelo menos um post compativel para refazer a pesquisa");

  const currentSources = [...new Set([
    ...(current.channels?.[channel]?.sources ?? []).map(handle => cleanChannelHandle(handle, channel)).filter(Boolean),
    ...channelHits.map(h => cleanChannelHandle(h.ownerUsername || "", channel)).filter(Boolean),
  ])];
  const dislikedHandles = channelHits
    .filter(h => dislikedPostKeys.includes(hitKey(h)))
    .map(h => cleanChannelHandle(h.ownerUsername || "", channel))
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
    const more = await suggestMoreLike(orgId, likedHandles, rejectedHandles, likedPosts, channel);
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
    const result = await scan(orgId, {
      handles,
      excludeHandles: rejectedHandles,
      feedback,
      channel,
    });
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
