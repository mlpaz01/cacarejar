/**
 * Agente Estrategista — Diagnóstico (nível consultoria).
 * 1) LÊ o perfil real (ProfileProvider/Apify) — bio, seguidores, posts campeões (com imagem).
 * 2) EXTRAI o DNA visual da marca VENDO os posts campeões (visão multimodal) — padrão Pomelli.
 * 3) Monta um plano estratégico profundo + POST IDEAS com prompt memorável de direção de arte
 *    (padrão Higgsfield: cena, luz, lente, paleta da marca) e roteiro de vídeo (Reels/TikTok).
 * Cérebro: Claude 3.5 Sonnet via OpenRouter.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { approvals, creatives, experiments, factorDefinitions, orgProfile, reviewChecks, variants } from "../../drizzle/schema";
import { openRouterChat, ContentPart } from "../openrouter";
import { fetchProfile, fetchSite, profileReadingEnabled, SocialProfile, SiteSnapshot } from "./profileProvider";
import { archivePendingForContext } from "./approvals";
import { contextFromPlan, creativeMatchesContext } from "./context";

const BRAIN = "anthropic/claude-sonnet-4.6";
const truncate = (s: string, n: number) => (s || "").slice(0, n);
const archiveId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const stripAccents = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const lowerPlain = (s: string) => stripAccents(s).toLowerCase();

function buildDiagnosisDataQuality(
  redes: Record<string, string>,
  profile: SocialProfile | null,
  site: SiteSnapshot | null
): CacaPlan["dataQuality"] {
  const missing: string[] = [];
  const warnings: string[] = [];
  const expectedSocial = [
    redes.instagram ? "Instagram" : "",
    redes.tiktok ? "TikTok" : "",
  ].filter(Boolean);
  const readSocial =
    profile?.network === "instagram" ? "Instagram" :
    profile?.network === "tiktok" ? "TikTok" :
    "";

  for (const source of expectedSocial) {
    if (source !== readSocial) missing.push(source);
  }
  if (redes.site && !site?.title && !site?.description && !site?.excerpt) missing.push("Site");
  if (expectedSocial.length && !profileReadingEnabled()) warnings.push("APIFY_TOKEN ausente: leitura social real indisponivel.");
  if (missing.length) warnings.push(`Fontes nao lidas automaticamente: ${missing.join(", ")}.`);

  const status = missing.length ? "degraded" : "complete";
  if (status === "degraded") {
    console.warn("[data-quality]", JSON.stringify({
      event: "diagnosis_degraded",
      missing,
      hasProfile: !!profile,
      hasSite: !!(site?.title || site?.description || site?.excerpt),
    }));
  }

  return {
    status,
    message: status === "complete"
      ? "Leitura feita com as fontes automaticas disponiveis."
      : "Algumas fontes nao puderam ser lidas agora. O parecer continua util, mas deve ser revisado ou atualizado antes de virar decisao final.",
    missing,
    warnings,
    checkedAt: Date.now(),
  };
}

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

function contextSeed(produto: string, redes: Record<string, string> = {}, site?: SiteSnapshot | null, profile?: SocialProfile | null) {
  return lowerPlain([
    produto,
    redes.instagram,
    redes.tiktok,
    redes.linkedin,
    linkedinSlug(redes.linkedin),
    redes.site,
    siteHost(redes.site || site?.url),
    site?.title,
    site?.description,
    site?.h1,
    site?.excerpt,
    profile?.bio,
    profile?.category,
  ].filter(Boolean).join(" "));
}

function occupationalHealthContext(produto: string, redes: Record<string, string> = {}, site?: SiteSnapshot | null, profile?: SocialProfile | null) {
  const seed = contextSeed(produto, redes, site, profile);
  return /\b(saude do trabalho|saudedotrabalho|sst|seguranca do trabalho|segurancadotrabalho|medicina ocupacional|medicinaocupacional|sesmt|pcmso|pgr\b|aso\b|e-social|esocial|ergonomia|nr[- ]?\d+|normas regulamentadoras)\b/.test(seed);
}

function ensureArchiveIds(archived: any[]) {
  let changed = false;
  const next = archived.map((snap, index) => {
    if (snap?.id) return snap;
    changed = true;
    return { ...snap, id: `${snap?.archivedAt ?? Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}` };
  });
  return { archived: next, changed };
}
const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");

function parseJson<T = any>(content: string): T | null {
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    return JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return null;
  }
}

/** Mantém só valores de fator que existem na taxonomia; usa `base` como fallback. */
async function sanitizeFactors(suggested: Record<string, string>, base: Record<string, string>): Promise<Record<string, string>> {
  const db = await getDb();
  const valid = new Map<string, Set<string>>();
  if (db) {
    const defs = await db.select().from(factorDefinitions);
    for (const d of defs) valid.set(d.key, new Set((d.values as any[]).map(v => v.key)));
  }
  const out: Record<string, string> = { ...base };
  for (const [k, v] of Object.entries(suggested ?? {})) {
    const set = valid.get(k);
    if (set && set.has(v)) out[k] = v;
  }
  return out;
}

// ───────────────────────── tipos ─────────────────────────
export interface PostIdea {
  titulo: string;
  pilar: string;
  formato: "imagem" | "reels" | "carrossel";
  angulo: "dor" | "desejo" | "transformacao";
  gancho: string;          // gancho de 3 segundos
  copy: string;            // legenda
  hashtags: string[];
  cta: string;
  visualPrompt: string;    // prompt memorável (EN) para a imagem
  roteiro?: { gancho3s: string; cenas: { tempo: string; acao: string; audio: string }[]; cta: string };
}
export interface BrandDNA {
  paleta: string[];        // hex
  tipografia: string;
  estiloFoto: string;
  motivos: string[];
  tom: string;
  resumoVisual: string;
}
export interface PostInterest {
  nome: string;
  categoria: "dor" | "desejo" | "tecnologia" | "persona" | "conteudo";
  score: number;
  sinal: string;
  porQueImporta: string;
  conteudoLinkedIn: string;
  targeting: string[];
  evidencias: { fonte: string; trecho: string; url?: string; hotScore?: number }[];
}
export interface WeeklyContentPlanItem {
  dia: string;
  canal: string;
  objetivo: string;
  formato: PostIdea["formato"] | "story" | "blog" | "check-in";
  pilar: string;
  gancho: string;
  legenda: string;
  roteiro?: PostIdea["roteiro"];
  direcaoVisual: string;
  visualPrompt: string;
  cta: string;
  hashtags: string[];
  checklistHumano: string[];
  status: "ideia" | "em_edicao" | "aprovado" | "publicado" | "medir";
  metricaChave: string;
  origem: string;
  publicadoUrl?: string;
  resultado?: {
    registradoEm?: number;
    alcance?: number;
    visualizacoes?: number;
    curtidas?: number;
    comentarios?: number;
    salvamentos?: number;
    compartilhamentos?: number;
    cliques?: number;
    leads?: number;
    vendas?: number;
    receita?: number;
    observacoes?: string;
  };
}
export interface CacaPlan {
  // consultoria
  sumarioExecutivo: string;
  situacao: { fator: string; analise: string }[];
  objetivoPrincipal: string;
  brandDNA: BrandDNA;
  pilaresEstrategicos: { titulo: string; objetivo: string; acoes: { acao: string; detalhe: string }[] }[];
  cronograma: { periodo: string; foco: string; meta: string }[];
  conclusao: string;
  postIdeas: PostIdea[];
  interessesPosts?: PostInterest[];
  plano7Dias?: WeeklyContentPlanItem[];
  aprendizadoSemanal?: {
    atualizadoEm: number;
    resumo: string;
    melhorSinal: string;
    repetir: string[];
    melhorar: string[];
    proximaAcao: string;
  };
  motorOrganico?: {
    score: number;
    leitura: string;
    scoreBreakdown?: { nome: string; valor: number; detalhe: string }[];
    ajustesPerfil: string[];
    termosBuscaSocial: string[];
    pilares: string[];
    oportunidades: string[];
    proximosPassos?: { acao: string; motivo: string; impacto: string }[];
  };
  campanhaAssistida?: {
    titulo: string;
    base: string;
    objetivo: string;
    canal: string;
    publico: string[];
    copy: string;
    criativo: string;
    orcamento: string;
    checklist: string[];
    kpis: string[];
  };
  // legado / seções extras
  resumo: string;
  diagnostico: string[];
  publicoAlvo: string[];
  dnaOrganico: string[];
  pilaresConteudo: string[];
  oportunidades: string[];
  analiseTopPosts: string[];
  estrategia: { canal: string; funil: string; angulos: string[]; oferta: string };
  planoAcao: { dia: string; foco: string }[];
  kpis: string[];
  suggestedFactors: Record<string, string>;
  produto: string;
  lente: "dor" | "desejo";
  nicho: string;
  perfilLido?: boolean;
  profile?: SocialProfile | null;
  siteLido?: boolean;
  site?: SiteSnapshot | null;
  linkedin?: string | null;
  redes?: Record<string, string>;
  dataQuality?: {
    status: "complete" | "degraded";
    message: string;
    missing?: string[];
    warnings?: string[];
    checkedAt: number;
  };
  fontesUsadas?: { canal: string; origem: string; sinal: string; impacto: string; status?: string }[];
  metodoDiagnostico?: {
    etapa: string;
    leitura: string;
    decisao: string;
  }[];
  parecerEstrategico?: {
    titulo: string;
    analise: string;
    prescricaoImediata: string;
    radarImpacto?: string;
  };
  acoesImediatas?: {
    prioridade: string;
    canal: string;
    acao: string;
    motivo: string;
  }[];
  prescricoesPorCanal?: {
    canal: "Instagram" | "TikTok / Reels" | "Google (Busca)" | "Blog / SEO";
    funcao: string;
    prioridade: string;
    conteudos: string[];
    cta: string;
    kpis: string[];
    origem: string;
  }[];
  cronogramaMulticanal?: {
    semana: string;
    tema: string;
    canais: { canal: string; acao: string; objetivo: string }[];
    meta: string;
  }[];
  linkedin360?: {
    empresa: string;
    niveis: { nivel: string; descricao: string; achados: string[] }[];
    areasAfins: string[];
    cargos: string[];
    tecnologias: string[];
    publicosAnuncio?: { nome: string; alvo: string[]; mensagem: string; oferta: string }[];
    mensagensPorNivel?: { nivel: string; abordagem: string; conteudo: string; anuncio: string }[];
  };
  // Visão 360 por canal REAL (Instagram, TikTok, Google) — substitui a densidade do antigo LinkedIn 360.
  canais360?: {
    canais: {
      canal: string;
      papel: string;
      leitura: string;
      publicos: string[];
      angulosAnuncio: { nome: string; mensagem: string; oferta: string }[];
      formatos: string[];
      conteudos: string[];
      kpis: string[];
    }[];
  };
  // Espião de Anúncios (Sprint 2) — anúncios reais de concorrentes na Meta.
  anunciosConcorrentes?: any[];
  anunciosInsights?: { titulo: string; detalhe: string }[];
  anunciosQuery?: string;
  anunciosScannedAt?: number;
  // Inteligência de Google (Sprint 3) — buscas reais (autocomplete) + pautas SEO + volume (DataForSEO opcional).
  googleSEO?: {
    termo: string;
    scannedAt: number;
    fonteVolume?: string;
    termos: { termo: string; volume?: number; cpc?: number; competicao?: string }[];
    perguntas: string[];
    ideiasConteudo: { titulo: string; tipo: string }[];
  };
  acompanhamento?: {
    ciclo: string;
    progresso: number;
    conteudos: { total: number; feitos: number };
    campanhas: number;
    proximoFoco: string;
    snapshots: { label: string; resumo: string; scores: { nome: string; valor: number }[] }[];
    semanas: { semana: string; itens: { texto: string; status: "done" | "todo" | "late" }[] }[];
    metricasCampanha: { canal: string; titulo: string; metricas: { nome: string; valor: string }[]; leitura: string }[];
    novaPrescricao: string;
    feedbacks?: { at: number; texto: string }[];
  };
}

// ───────────────────────── nicho / fatores ─────────────────────────
const PALETAS: Record<string, string[]> = {
  laranja: ["#FF6B35", "#F7931E", "#FFF1E6"],
  azul: ["#0D2A5E", "#3B82F6", "#EAF2FF"],
  verde: ["#18B85C", "#0E7C45", "#EAF8F0"],
  rosa: ["#FF5C8A", "#FFB3C8", "#FFF0F5"],
  roxo: ["#7C3AED", "#A78BFA", "#F3EEFF"],
  vermelho: ["#E11D48", "#FB7185", "#FFF1F2"],
};

function detectNicho(produto: string, profile?: SocialProfile | null, redes: Record<string, string> = {}, site?: SiteSnapshot | null) {
  const p = contextSeed(produto, redes, site, profile);
  const has = (...ks: string[]) => ks.some(k => p.includes(k));
  if (occupationalHealthContext(produto, redes, site, profile))
    return { nicho: "saude do trabalho, SST e medicina ocupacional", cor: "azul", tipo: "pessoa", idade: "adulto_26_40", sexo: "ambos" };
  if (has("confeit", "bolo", "doce", "marmita", "comida", "gastron", "receita"))
    return { nicho: "alimentação & gastronomia", cor: "laranja", tipo: "alimento", idade: "adulto_26_40", sexo: "feminino" };
  if (has("emagrec", "fitness", "treino", "academia", "muscula", "dieta", "shape", "saúde"))
    return { nicho: "fitness & saúde", cor: "verde", tipo: "pessoa", idade: "jovem_18_25", sexo: "ambos" };
  if (has("beleza", "estétic", "maquia", "cabelo", "unha", "skincare", "cosmétic"))
    return { nicho: "beleza & estética", cor: "rosa", tipo: "pessoa", idade: "adulto_26_40", sexo: "feminino" };
  if (has("curso", "mentoria", "aula", "ebook", "e-book", "infoproduto", "treinamento", "aprender"))
    return { nicho: "educação & infoprodutos", cor: "azul", tipo: "pessoa", idade: "adulto_26_40", sexo: "ambos" };
  if (has("money", "dinheiro", "renda", "investi", "financ", "trading", "cripto", "lucro", "artesanato", "diy"))
    return { nicho: p.includes("artesanato") || p.includes("diy") ? "artesanato & DIY" : "finanças & renda", cor: "verde", tipo: "tecnologico", idade: "jovem_18_25", sexo: "ambos" };
  if (has("moda", "roupa", "loja", "vestuár", "calçad", "acessóri"))
    return { nicho: "moda & varejo", cor: "roxo", tipo: "pessoa", idade: "jovem_18_25", sexo: "feminino" };
  if (has("imóv", "imobiliár", "aluguel", "apart"))
    return { nicho: "imobiliário", cor: "azul", tipo: "cenario", idade: "maduro_41_60", sexo: "ambos" };
  return { nicho: "negócios & serviços", cor: "laranja", tipo: "pessoa", idade: "adulto_26_40", sexo: "ambos" };
}

function suggestFactors(produto: string, objetivo: string, profile?: SocialProfile | null, redes: Record<string, string> = {}, site?: SiteSnapshot | null) {
  const n = detectNicho(produto, profile, redes, site);
  const angulo = objetivo === "leads" ? "curiosidade" : objetivo === "lancar" ? "transformacao" : "desejo";
  const lente: "dor" | "desejo" = objetivo === "leads" ? "dor" : "desejo";
  const factors: Record<string, string> = {
    img_tipo: n.tipo, img_cor_predominante: n.cor, img_pessoa_idade: n.idade, img_pessoa_sexo: n.sexo,
    img_estilo: "foto_realista", copy_tom: "emocional", copy_formato: "prova_social",
    copy_gatilho: "prova_social", copy_cta: objetivo === "leads" ? "baixe_gratis" : "comece_agora", of_angulo: angulo,
  };
  return { factors, lente, nicho: n.nicho, cor: n.cor };
}

const INTEREST_DEFS: Array<{
  nome: string;
  categoria: PostInterest["categoria"];
  termos: string[];
  sinal: string;
  porQueImporta: string;
  conteudoLinkedIn: string;
  targeting: string[];
}> = [
  { nome: "Transformacao profissional", categoria: "desejo", termos: ["carreira", "curriculo", "emprego", "linkedin", "profissional", "transicao", "pdi", "cargo", "gestor", "lideranca"], sinal: "Posts sobre virada de carreira, status profissional e proximo passo geram leitura e salvamento.", porQueImporta: "No LinkedIn, este interesse conversa com decisores e profissionais em momento ativo de mudanca.", conteudoLinkedIn: "Use narrativas de antes/depois profissional, checklist de decisao e prova concreta do resultado.", targeting: ["Cargos de gestao", "Recursos humanos", "Desenvolvimento profissional", "LinkedIn ativo"] },
  { nome: "Aprendizagem e educacao aplicada", categoria: "conteudo", termos: ["aprendizagem", "educacao", "curso", "aula", "ensino", "escola", "professor", "aluno", "tdah", "dislexia", "neurodivergente", "treinamento"], sinal: "Conteudos que traduzem um conceito dificil em situacao pratica tendem a performar melhor.", porQueImporta: "Ajuda a construir autoridade sem parecer anuncio direto, especialmente em B2B consultivo.", conteudoLinkedIn: "Crie posts didaticos com exemplo real, erro comum e um framework facil de repetir.", targeting: ["Educacao", "Treinamento e desenvolvimento", "Edtech", "Gestores pedagogicos"] },
  { nome: "Automacao, agentes e produtividade", categoria: "tecnologia", termos: ["ia", "agente", "automacao", "automação", "api", "crm", "erp", "software", "plataforma", "sistema", "dados", "dashboard", "produtividade"], sinal: "Tecnologia performa quando aparece como ganho concreto, nao como novidade abstrata.", porQueImporta: "Permite falar com compradores que buscam eficiencia, reducao de custo e menos trabalho manual.", conteudoLinkedIn: "Mostre o processo antes/depois: tarefa manual, agente executando, ganho mensuravel.", targeting: ["Tecnologia", "Operacoes", "SaaS", "Transformacao digital", "Produtividade"] },
  { nome: "Seguranca, confianca e risco", categoria: "dor", termos: ["seguranca", "segurança", "lgpd", "juridico", "jurídico", "risco", "compliance", "assinatura", "documento", "contrato", "privacidade"], sinal: "Posts com risco claro e consequencia concreta ativam urgencia sem depender de promessa exagerada.", porQueImporta: "Bom para decisores que precisam justificar compra por reducao de risco e conformidade.", conteudoLinkedIn: "Use comparativos de risco, checklist de conformidade e casos de custo evitado.", targeting: ["Juridico", "Compliance", "Seguranca da informacao", "Operacoes", "Administrativo"] },
  { nome: "Prova social e autoridade humana", categoria: "persona", termos: ["case", "depoimento", "cliente", "resultado", "prova", "antes", "depois", "historia", "história", "bastidor", "rosto", "familia", "equipe"], sinal: "Rosto humano, historia real e evidencia especifica tendem a gerar confianca e comentario.", porQueImporta: "Reduz a distancia entre marca e comprador, principalmente quando a oferta exige confianca.", conteudoLinkedIn: "Transforme clientes, fundadores e bastidores em posts com tese, contexto e aprendizado.", targeting: ["Fundadores", "Tomadores de decisao", "Clientes semelhantes", "Comunidades profissionais"] },
  { nome: "Dor operacional e decisao de compra", categoria: "dor", termos: ["erro", "problema", "dificuldade", "travar", "manual", "tempo", "custo", "perda", "retrabalho", "urgente", "nao sei", "não sei"], sinal: "Conteudos que nomeiam uma dor especifica parecem escritos para a pessoa certa.", porQueImporta: "E o caminho mais curto para anuncio: dor reconhecida, consequencia e solucao.", conteudoLinkedIn: "Abra com o erro caro, mostre o impacto e feche com um diagnostico simples.", targeting: ["Operacoes", "Administracao", "Gestores de area", "Pequenas empresas", "B2B"] },
];

function postTextSignals(plan: Partial<CacaPlan>, profile?: SocialProfile | null, radar?: any) {
  const rows: { fonte: string; trecho: string; url?: string; hotScore?: number; weight: number }[] = [];
  for (const p of profile?.posts ?? []) {
    if (p.caption) rows.push({ fonte: `@${profile?.handle ?? "perfil"}`, trecho: p.caption, url: (p as any).url, weight: 1 + Math.log10((p.likes ?? 0) + (p.comments ?? 0) * 4 + 1) });
  }
  for (const p of profile?.topPosts ?? []) {
    if (p.caption) rows.push({ fonte: `@${profile?.handle ?? "perfil"} - top post`, trecho: p.caption, url: (p as any).url, weight: 1.4 + Math.log10((p.likes ?? 0) + (p.comments ?? 0) * 4 + 1) });
  }
  for (const h of radar?.hits ?? []) {
    const text = [h.caption, h.why, h.theme, h.mechanism].filter(Boolean).join(" ");
    if (text) rows.push({ fonte: `@${h.ownerUsername ?? "radar"}`, trecho: text, url: h.url, hotScore: h.hotScore, weight: 1.2 + ((h.hotScore ?? 50) / 80) });
  }
  for (const i of radar?.ideas ?? []) {
    const text = [i.titulo, i.gancho, i.copy, i.opportunityTitle, i.patternTitle].filter(Boolean).join(" ");
    if (text) rows.push({ fonte: i.fonte ? `Ideia Radar - @${i.fonte}` : "Ideia Radar", trecho: text, url: i.fonteUrl, hotScore: i.priorityScore, weight: i.diagnosisDecision === "use" ? 2 : i.diagnosisDecision === "skip" ? 0.25 : 1 });
  }
  for (const i of plan.postIdeas ?? []) {
    const text = [i.titulo, i.pilar, i.gancho, i.copy, ...(i.hashtags ?? [])].filter(Boolean).join(" ");
    rows.push({ fonte: "Post sugerido", trecho: text, weight: 0.8 });
  }
  return rows;
}

function inferPostInterests(plan: Partial<CacaPlan>, profile?: SocialProfile | null, radar?: any): PostInterest[] {
  const signals = postTextSignals(plan, profile, radar);
  const baseText = `${plan.produto ?? ""} ${plan.nicho ?? ""} ${plan.sumarioExecutivo ?? ""} ${plan.linkedin ?? ""}`.toLowerCase();
  return INTEREST_DEFS.map(def => {
    const evidencias: PostInterest["evidencias"] = [];
    let score = 0;
    const terms = def.termos.map(t => t.toLowerCase());
    for (const s of signals) {
      const text = (s.trecho || "").toLowerCase();
      const hits = terms.filter(t => text.includes(t)).length;
      if (!hits) continue;
      score += hits * 12 * s.weight + (s.hotScore ?? 0) / 8;
      if (evidencias.length < 3) {
        evidencias.push({ fonte: s.fonte, trecho: truncate(s.trecho.replace(/\s+/g, " "), 150), url: s.url, hotScore: s.hotScore });
      }
    }
    score += terms.filter(t => baseText.includes(t)).length * 10;
    return { ...def, score: Math.min(99, Math.max(0, Math.round(score))), evidencias };
  })
    .filter(i => i.score >= 18 || i.evidencias.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function hasValue(v?: string | null) {
  return !!String(v ?? "").trim();
}

function shortSource(url?: string | null) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function detectBusinessName(plan: Partial<CacaPlan>, redes?: Record<string, string>, radar?: any) {
  const linked = shortSource(plan.linkedin || redes?.linkedin);
  if (linked) return linked;
  const handle = plan.profile?.handle || redes?.instagram || radar?.baseHandle;
  if (handle) return `@${String(handle).replace(/^@/, "")}`;
  return plan.produto || "Negocio analisado";
}

function buildSources(plan: Partial<CacaPlan>, redes: Record<string, string> = {}, radar?: any): CacaPlan["fontesUsadas"] {
  const out: CacaPlan["fontesUsadas"] = [];
  if (hasValue(redes.site) || plan.siteLido) {
    out.push({
      canal: "Site",
      origem: shortSource(redes.site || plan.site?.url) || "site informado",
      sinal: plan.site?.title || plan.site?.description || "Proposta comercial e promessa central analisadas.",
      impacto: "Vira base para Blog / SEO, materiais de autoridade e paginas de campanha.",
      status: "analisado",
    });
  }
  if (hasValue(redes.linkedin) || hasValue(plan.linkedin)) {
    out.push({
      canal: "LinkedIn",
      origem: shortSource(plan.linkedin || redes.linkedin),
      sinal: "Contexto B2B usado para mapear autoridade, decisores, areas afins e linguagem tecnica.",
      impacto: "Define posts de tese, segmentacao de campanha e temas que precisam de prova tecnica.",
      status: "visao 360",
    });
  }
  if (plan.profile?.handle || hasValue(redes.instagram)) {
    out.push({
      canal: "Instagram",
      origem: plan.profile?.handle ? `@${plan.profile.handle}` : String(redes.instagram),
      sinal: plan.profile ? `${nf(plan.profile.followers)} seguidores e engajamento ~${plan.profile.engajamentoPct ?? "-"}%.` : "Perfil informado como contexto visual.",
      impacto: "Alimenta prova social, bastidores, DNA visual e formatos de confianca.",
      status: plan.profile ? "lido" : "informado",
    });
  }
  if (hasValue(redes.tiktok)) {
    out.push({
      canal: "TikTok",
      origem: String(redes.tiktok),
      sinal: "Canal usado como hipotese para descoberta e simplificacao de dores complexas.",
      impacto: "Orienta roteiros curtos, analogias e testes de retencao.",
      status: "informado",
    });
  }
  if (radar?.hits?.length || radar?.ideas?.length) {
    const liked = (radar.feedback?.likedPostKeys ?? []).length;
    const disliked = (radar.feedback?.dislikedPostKeys ?? []).length;
    out.push({
      canal: "Radar de Mercado",
      origem: `${radar.hits?.length ?? 0} hits analisados`,
      sinal: radar.marketSummary || "Padroes quentes, criadores e formatos vencedores identificados.",
      impacto: `Feedback aplicado: ${liked} gostei e ${disliked} nao gostei. O parecer usa estes sinais para corrigir a rota.`,
      status: "colaborativo",
    });
  }
  return out;
}

function buildLinkedIn360(plan: Partial<CacaPlan>, redes: Record<string, string> = {}, radar?: any): CacaPlan["linkedin360"] {
  const empresa = detectBusinessName(plan, redes, radar);
  const interesses = (plan.interessesPosts ?? []).slice(0, 4);
  const targeting = Array.from(new Set(interesses.flatMap(i => i.targeting ?? []))).slice(0, 8);
  const techInterest = interesses.find(i => i.categoria === "tecnologia");
  const riskInterest = interesses.find(i => i.nome.toLowerCase().includes("seguranca"));
  const produto = plan.produto || empresa;
  const dor = interesses.find(i => i.categoria === "dor")?.nome || "dor operacional";
  const autoridade = interesses.find(i => i.categoria === "persona")?.nome || "prova social e autoridade";
  const cargos = ["CEO", "COO", "CTO", "Gerente de Operacoes", "Gestor de TI", "Compras B2B"];
  const tecnologias = [
    techInterest ? techInterest.nome : "Automacao e produtividade",
    riskInterest ? riskInterest.nome : "Dados, compliance e confianca",
    "Integracoes, CRM e processos digitais",
  ];
  return {
    empresa,
    niveis: [
      {
        nivel: "Nivel 1",
        descricao: "Ativos proprios e pessoas diretamente ligadas ao perfil.",
        achados: ["Pagina/empresa analisada", "Fundadores e porta-vozes potenciais", "Promessa central e termos tecnicos do site"],
      },
      {
        nivel: "Nivel 2",
        descricao: "Ecossistema proximo que valida autoridade.",
        achados: ["Clientes e parceiros", "Concorrentes e empresas comparaveis", "Profissionais que comentam temas parecidos"],
      },
      {
        nivel: "Nivel 3",
        descricao: "Mercados adjacentes que ampliam campanha e conteudo.",
        achados: targeting.length ? targeting.slice(0, 5) : ["Operacoes", "Tecnologia", "Gestao", "Compliance", "Compras B2B"],
      },
    ],
    areasAfins: targeting.length ? targeting : ["Operacoes", "Tecnologia", "Administracao", "Seguranca", "Marketing B2B"],
    cargos,
    tecnologias,
    publicosAnuncio: [
      {
        nome: "Decisor economico",
        alvo: ["CEO", "Diretor", "Fundador", "Socio", ...targeting.slice(0, 2)].slice(0, 6),
        mensagem: `Mostre o custo de nao resolver ${dor} e traduza em impacto financeiro claro.`,
        oferta: "Diagnostico executivo ou conversa consultiva.",
      },
      {
        nome: "Gestor operacional",
        alvo: ["Operacoes", "Administracao", "Gestores de area", ...tecnologias.slice(0, 2)].slice(0, 6),
        mensagem: `Fale de processo, retrabalho, risco e ganho pratico com ${produto}.`,
        oferta: "Checklist, comparativo ou simulacao rapida.",
      },
      {
        nome: "Influenciador tecnico",
        alvo: ["Tecnologia", "TI", "Dados", "Compliance", ...cargos.slice(1, 3)].slice(0, 6),
        mensagem: `Use linguagem tecnica suficiente para gerar confianca sem virar jargao.`,
        oferta: "Guia tecnico, artigo pilar ou prova de conceito.",
      },
    ],
    mensagensPorNivel: [
      {
        nivel: "Nivel 1",
        abordagem: "Autoridade propria",
        conteudo: `Publicar tese do fundador/empresa sobre ${dor}, com exemplo concreto e CTA para diagnostico.`,
        anuncio: "Anuncio com dor reconhecida + promessa especifica + prova simples.",
      },
      {
        nivel: "Nivel 2",
        abordagem: "Prova por ecossistema",
        conteudo: `Conectar ${autoridade} com parceiros, clientes, cases e conversas em perfis relacionados.`,
        anuncio: "Anuncio com comparativo, antes/depois ou validacao por setor.",
      },
      {
        nivel: "Nivel 3",
        abordagem: "Expansao adjacente",
        conteudo: `Traduzir ${produto} para areas afins: ${targeting.slice(0, 3).join(", ") || "operacoes, tecnologia e gestao"}.`,
        anuncio: "Campanhas segmentadas por cargo/area, cada uma com dor e CTA especificos.",
      },
    ],
  };
}

function buildCanais360(plan: Partial<CacaPlan>, redes: Record<string, string> = {}, radar?: any): CacaPlan["canais360"] {
  const interesses = (plan.interessesPosts ?? []).slice(0, 4);
  const targeting = Array.from(new Set(interesses.flatMap(i => i.targeting ?? []))).slice(0, 8);
  const produto = plan.produto || plan.nicho || "seu produto";
  const nicho = plan.nicho || produto;
  const dor = interesses.find(i => i.categoria === "dor")?.nome || "a dor central do cliente";
  const desejo = interesses.find(i => i.categoria === "desejo")?.nome || "a transformacao desejada";
  const prof = plan.profile;
  const baseTargeting = targeting.length ? targeting : ["Interessados no nicho", "Lookalike dos seguidores", "Quem engajou no perfil", "Visitantes do site"];
  const igLeitura = prof
    ? `@${prof.handle}: ${nf(prof.followers)} seguidores, engajamento ~${prof.engajamentoPct ?? "—"}% (media ${nf(prof.avgLikes)} curtidas/post). Ha audiencia aquecida — falta converter em venda.`
    : "Perfil ainda nao lido. Conecte o Instagram para uma leitura com numeros reais.";
  return {
    canais: [
      {
        canal: "Instagram",
        papel: "Prova social, confianca visual e conversao direta no feed/stories.",
        leitura: igLeitura,
        publicos: baseTargeting,
        angulosAnuncio: [
          { nome: "Antes e depois", mensagem: `Mostre a transformacao real ligada a ${desejo}.`, oferta: "Convite direto (DM/WhatsApp) ou link na bio." },
          { nome: "Dor reconhecida", mensagem: `Nomeie ${dor} e mostre o caminho com ${produto}.`, oferta: "Material ou condicao especial para quem chamar." },
          { nome: "Prova social", mensagem: "Depoimento ou bastidor que gera confianca imediata.", oferta: "Oferta de entrada com baixa friccao." },
        ],
        formatos: ["Reels com gancho de 3s", "Carrossel antes/depois", "Stories com enquete + CTA"],
        conteudos: ["Bastidor real do processo", "Depoimento de cliente", "Erro comum que o publico comete"],
        kpis: ["salvamentos", "cliques no perfil", "conversas iniciadas"],
      },
      {
        canal: "TikTok / Reels",
        papel: "Descoberta e alcance — simplificar a dor e atrair quem ainda nao conhece.",
        leitura: redes?.tiktok
          ? `Canal informado (${redes.tiktok}). Use para abrir descoberta com videos curtos e analogias.`
          : "Sem TikTok conectado. Mesmo assim, Reels no Instagram cobrem este papel de descoberta.",
        publicos: ["Publico frio do nicho", "Tendencias e sons em alta", "Quem busca solucao rapida"],
        angulosAnuncio: [
          { nome: "Mito x verdade", mensagem: `Quebre uma crenca errada comum sobre ${nicho}.`, oferta: "Seguir + ver o guia completo." },
          { nome: "Analogia simples", mensagem: `Explique ${dor} de um jeito que qualquer um entende em 20s.`, oferta: "Comentar palavra-chave para receber material." },
        ],
        formatos: ["Video 15-30s com gancho forte", "Tutorial rapido", "Reacao a tendencia"],
        conteudos: ["3 erros que travam resultado", "Passo a passo em 20s", "Bastidor autentico"],
        kpis: ["retencao", "compartilhamentos", "visitas ao perfil"],
      },
      {
        canal: "Google (Busca & SEO)",
        papel: "Capturar quem JA procura a solucao — intencao alta de compra.",
        leitura: `Quem tem ${dor} pesquisa no Google antes de comprar. Sem presenca na busca, esse lead vai para o concorrente.`,
        publicos: ["Busca pela solucao direta", "Busca por '[nicho] perto de mim'", "Comparacao de preco/opcoes", "Duvidas tecnicas do nicho"],
        angulosAnuncio: [
          { nome: "Anuncio de busca (intencao)", mensagem: `Apareca para quem pesquisa por ${nicho} com uma promessa clara.`, oferta: "Diagnostico ou orcamento rapido." },
          { nome: "Conteudo que ranqueia", mensagem: `Artigo respondendo a principal duvida sobre ${nicho}.`, oferta: "Checklist ou contato no fim do artigo." },
        ],
        formatos: ["Anuncio de busca (Google Ads)", "Artigo pilar SEO", "FAQ otimizado", "Pagina de destino por intencao"],
        conteudos: ["Guia: como escolher a solucao certa", "FAQ com as duvidas reais do cliente", "Comparativo transparente de opcoes/preco"],
        kpis: ["palavras ranqueadas", "trafego organico", "conversao da pagina"],
      },
    ],
  };
}

function buildChannelPrescriptions(plan: Partial<CacaPlan>, radar?: any): CacaPlan["prescricoesPorCanal"] {
  const radarSource = radar?.marketSummary ? "Radar de Mercado + feedbacks" : "Diagnostico 360";
  const coreTheme = plan.nicho || plan.produto || "tema principal";
  return [
    {
      canal: "Instagram",
      funcao: "Prova social, confianca visual e conversao direta.",
      prioridade: "Prioridade 1",
      conteudos: [
        `Carrossel antes/depois mostrando o resultado em ${coreTheme}.`,
        "Reels com gancho de 3s sobre a dor central do cliente.",
        "Stories com prova social, enquete e CTA direto (DM/WhatsApp).",
      ],
      cta: "Direct, WhatsApp ou link na bio.",
      kpis: ["salvamentos", "conversas iniciadas", "cliques no perfil"],
      origem: "Perfil lido + DNA visual",
    },
    {
      canal: "TikTok / Reels",
      funcao: "Descoberta e simplificacao da dor para publico frio.",
      prioridade: "Alcance",
      conteudos: [
        "Analogia simples que explica um problema complexo em 20s.",
        "Mitos, erros comuns e bastidores em ate 30 segundos.",
        "Cortes dos temas que performarem no Instagram.",
      ],
      cta: "Comentar palavra-chave, seguir ou ver guia completo.",
      kpis: ["retencao", "compartilhamentos", "visitas ao perfil"],
      origem: radarSource,
    },
    {
      canal: "Google (Busca)",
      funcao: "Capturar intencao de compra — quem ja procura a solucao.",
      prioridade: "Intencao alta",
      conteudos: [
        `Anuncio de busca para quem pesquisa por ${coreTheme}.`,
        "Pagina de destino por intencao, com promessa e prova.",
        "FAQ com as duvidas reais que o cliente digita no Google.",
      ],
      cta: "Diagnostico, orcamento rapido ou contato.",
      kpis: ["palavras ranqueadas", "cliques de busca", "conversao da pagina"],
      origem: "Intencao de busca + nicho",
    },
    {
      canal: "Blog / SEO",
      funcao: "Construir autoridade e ranquear no longo prazo.",
      prioridade: "Ativo de longo prazo",
      conteudos: [
        "Artigo pilar que sustenta a tese da semana.",
        "FAQ SEO com perguntas que aparecem nos comentarios e no Radar.",
        "Comparativo/guia para termos que o comprador pesquisa.",
      ],
      cta: "Checklist, diagnostico ou contato comercial.",
      kpis: ["palavras ranqueadas", "trafego organico", "conversao da pagina"],
      origem: "Site + busca",
    },
  ];
}

function buildDiagnosticMethod(plan: Partial<CacaPlan>, radar?: any): CacaPlan["metodoDiagnostico"] {
  const sources = (plan.fontesUsadas?.length ? plan.fontesUsadas : buildSources(plan, plan.redes ?? {}, radar)) ?? [];
  const channels = (plan.prescricoesPorCanal ?? buildChannelPrescriptions(plan, radar) ?? []).map(p => p.canal);
  const sourceNames = sources.map(s => s.canal).join(", ") || "briefing informado";
  return [
    {
      etapa: "1. Coleta multicanal",
      leitura: `O Agente cruzou ${sourceNames} para evitar uma leitura baseada em um unico canal.`,
      decisao: "Separar diagnostico de prescricao: primeiro entender o contexto, depois definir o papel de cada canal.",
    },
    {
      etapa: "2. Leitura de mercado",
      leitura: radar?.marketSummary
        ? truncate(radar.marketSummary, 260)
        : "O Radar ainda nao foi usado ou nao possui sinais recentes para este diagnostico.",
      decisao: radar?.marketSummary
        ? "Usar o que esta quente como referencia, sem copiar: adaptar mecanismo, linguagem e oportunidade."
        : "Gerar a primeira prescricao com base no diagnostico e atualizar quando o Radar trouxer sinais vivos.",
    },
    {
      etapa: "3. Prescricao por canal",
      leitura: channels.length ? `Canais com funcao definida: ${channels.join(", ")}.` : "Os canais principais ainda precisam ser priorizados.",
      decisao: "Cada canal recebe uma tarefa: autoridade, descoberta, prova social, SEO ou conversao.",
    },
    {
      etapa: "4. Execucao e recalculo",
      leitura: "O plano vira cronograma, conteudos aprovaveis e acompanhamento semanal.",
      decisao: "Recalcular o parecer com feedbacks, posts aprovados e resultados de campanha, nao apenas por intuicao.",
    },
  ];
}

function buildImmediateActions(plan: Partial<CacaPlan>, radar?: any): CacaPlan["acoesImediatas"] {
  const prescriptions = plan.prescricoesPorCanal ?? buildChannelPrescriptions(plan, radar) ?? [];
  const top = prescriptions.slice(0, 4);
  return top.map((p, index) => ({
    prioridade: index === 0 ? "Agora" : index === 1 ? "Proxima acao" : index === 2 ? "Apoio" : "Teste",
    canal: p.canal,
    acao: p.conteudos?.[0] || p.funcao,
    motivo: p.origem ? `Baseado em ${p.origem}. KPI principal: ${p.kpis?.[0] ?? "sinal qualificado"}.` : p.funcao,
  }));
}

function buildMultichannelTimeline(plan: Partial<CacaPlan>): CacaPlan["cronogramaMulticanal"] {
  const theme = plan.nicho || plan.produto || "tema central";
  return [
    {
      semana: "Semana 1",
      tema: "Dor central",
      canais: [
        { canal: "Google", acao: `Anuncio de busca para quem ja procura ${theme}.`, objetivo: "Capturar intencao de compra." },
        { canal: "Blog", acao: "Artigo pilar com checklist e termos tecnicos.", objetivo: "Criar respaldo e destino de trafego." },
        { canal: "Instagram", acao: "Carrossel visual com bastidor/prova social.", objetivo: "Humanizar a dor." },
        { canal: "TikTok", acao: "Video curto com analogia simples.", objetivo: "Abrir descoberta." },
      ],
      meta: "Base de autoridade publicada.",
    },
    {
      semana: "Semana 2",
      tema: "Prova e comparacao",
      canais: [
        { canal: "Google", acao: "Pagina de destino + FAQ com as duvidas reais do cliente.", objetivo: "Converter a busca em lead." },
        { canal: "Blog", acao: "FAQ SEO derivado das duvidas e comentarios.", objetivo: "Responder buscas long tail." },
        { canal: "Instagram", acao: "Depoimento, bastidor ou caso visual.", objetivo: "Aumentar confianca." },
        { canal: "Campanha", acao: "Teste com publico decisor e criativos aprovados.", objetivo: "Medir resposta real." },
      ],
      meta: "Primeiros sinais de campanha e conteudo.",
    },
    {
      semana: "Semana 3",
      tema: "Autoridade tecnica",
      canais: [
        { canal: "Instagram", acao: "Post de autoridade com prova e bastidor real.", objetivo: "Firmar autoridade." },
        { canal: "Blog", acao: "Guia pratico com termo ranqueavel.", objetivo: "Construir ativo SEO." },
        { canal: "TikTok", acao: "Erro comum explicado em 30 segundos.", objetivo: "Aumentar alcance." },
        { canal: "Radar", acao: "Refazer Radar com feedbacks.", objetivo: "Trazer novos sinais quentes." },
      ],
      meta: "Rota corrigida por dados.",
    },
    {
      semana: "Semana 4",
      tema: "Conversao",
      canais: [
        { canal: "Instagram", acao: "Convite direto para diagnostico com prova concreta.", objetivo: "Gerar leads." },
        { canal: "Blog", acao: "Landing/artigo de fundo para campanha.", objetivo: "Converter trafego." },
        { canal: "Instagram", acao: "Stories com perguntas e chamada direta.", objetivo: "Ativar relacionamento." },
        { canal: "Campanha", acao: "Remarketing para quem interagiu.", objetivo: "Aumentar eficiencia." },
      ],
      meta: "Novo ciclo pronto para recalibracao.",
    },
  ];
}

export function buildSevenDayPlan(plan: Partial<CacaPlan>, radar?: any): CacaPlan["plano7Dias"] {
  const produto = plan.produto || plan.nicho || "sua oferta";
  const niche = plan.nicho || produto;
  const ideas = plan.postIdeas?.length ? plan.postIdeas : [];
  const pick = (index: number, fallback: Partial<PostIdea>): PostIdea => ({
    titulo: fallback.titulo || `Conteudo ${index + 1}`,
    pilar: fallback.pilar || "Execucao semanal",
    formato: fallback.formato || "imagem",
    angulo: fallback.angulo || "desejo",
    gancho: fallback.gancho || `O que ninguem te conta sobre ${produto}`,
    copy: fallback.copy || `Mostre uma historia real sobre ${produto}, com contexto, prova e convite simples.`,
    hashtags: fallback.hashtags || ["#conteudo", "#marketing", "#negocios"],
    cta: fallback.cta || "Chame no direct para saber mais",
    visualPrompt: fallback.visualPrompt || buildFallbackVisualPrompt(produto, fallback.pilar || "Execucao semanal", plan.brandDNA || {
      paleta: ["#071b44", "#ff3217", "#f8fafc"],
      tipografia: "Sans-serif bold",
      estiloFoto: "Realistic editorial social media photo",
      motivos: ["human presence", "real environment"],
      tom: "authentic and useful",
      resumoVisual: "Realistic, direct and human.",
    }),
    roteiro: fallback.roteiro,
  });
  const sourceIdeas = [
    pick(0, ideas[0] ?? {}),
    pick(1, ideas[1] ?? {}),
    pick(2, ideas[2] ?? {}),
    pick(3, ideas[3] ?? {}),
  ];
  const radarIdea = radar?.ideas?.find((i: any) => i?.diagnosisDecision === "use") ?? radar?.ideas?.[0];
  const radarGancho = radarIdea?.gancho || radarIdea?.titulo || `O sinal quente do mercado para ${niche}`;
  const humanChecklist = [
    "Adicionar um detalhe real que so esta marca teria.",
    "Trocar qualquer frase generica por uma frase com ponto de vista.",
    "Confirmar se o visual parece humano, especifico e coerente com o DNA.",
  ];
  return [
    {
      dia: "Dia 1",
      canal: "Instagram",
      objetivo: "Abrir a semana com a tese central do diagnostico.",
      formato: sourceIdeas[0].formato,
      pilar: sourceIdeas[0].pilar,
      gancho: sourceIdeas[0].gancho,
      legenda: sourceIdeas[0].copy,
      roteiro: sourceIdeas[0].roteiro,
      direcaoVisual: plan.brandDNA?.resumoVisual || "Visual real, humano e coerente com a marca.",
      visualPrompt: sourceIdeas[0].visualPrompt,
      cta: sourceIdeas[0].cta,
      hashtags: sourceIdeas[0].hashtags,
      checklistHumano: humanChecklist,
      status: "ideia",
      metricaChave: "Salvamentos e comentarios qualificados",
      origem: "Diagnostico + DNA visual",
    },
    {
      dia: "Dia 2",
      canal: "Stories / WhatsApp",
      objetivo: "Transformar atencao em conversa.",
      formato: "story",
      pilar: "Prova e bastidor",
      gancho: `Mostre um bastidor real de ${produto}`,
      legenda: `Hoje eu mostraria um bastidor simples: o antes, o durante e o depois de ${produto}. Feche com uma pergunta direta para puxar conversa.`,
      direcaoVisual: "Stories com prova real, enquete e print/depoimento quando existir.",
      visualPrompt: buildFallbackVisualPrompt(produto, "bastidor real e prova humana", plan.brandDNA || {
        paleta: ["#071b44", "#ff3217", "#f8fafc"],
        tipografia: "Sans-serif bold",
        estiloFoto: "Realistic editorial social media photo",
        motivos: ["human presence", "real environment"],
        tom: "authentic and useful",
        resumoVisual: "Realistic, direct and human.",
      }),
      cta: "Responda este story ou chame no WhatsApp",
      hashtags: [],
      checklistHumano: humanChecklist,
      status: "ideia",
      metricaChave: "Respostas, DMs e cliques",
      origem: "Funil de conversa",
    },
    {
      dia: "Dia 3",
      canal: "Reels / TikTok",
      objetivo: "Ganhar descoberta com uma ideia simples e memoravel.",
      formato: "reels",
      pilar: sourceIdeas[1].pilar,
      gancho: sourceIdeas[1].gancho,
      legenda: sourceIdeas[1].copy,
      roteiro: sourceIdeas[1].roteiro,
      direcaoVisual: "Video vertical, ritmo rapido, rosto ou objeto real nos 3 primeiros segundos.",
      visualPrompt: sourceIdeas[1].visualPrompt,
      cta: sourceIdeas[1].cta,
      hashtags: sourceIdeas[1].hashtags,
      checklistHumano: humanChecklist,
      status: "ideia",
      metricaChave: "Retencao e compartilhamentos",
      origem: "Post idea + formato de descoberta",
    },
    {
      dia: "Dia 4",
      canal: "Instagram",
      objetivo: "Usar sinal do mercado sem copiar concorrente.",
      formato: sourceIdeas[2].formato,
      pilar: "Radar traduzido para a marca",
      gancho: radarGancho,
      legenda: radarIdea?.copy || sourceIdeas[2].copy,
      roteiro: sourceIdeas[2].roteiro,
      direcaoVisual: radarIdea?.creativeDirection || "Adaptar o mecanismo vencedor ao DNA visual da marca.",
      visualPrompt: radarIdea?.visualPrompt || sourceIdeas[2].visualPrompt,
      cta: radarIdea?.cta || sourceIdeas[2].cta,
      hashtags: radarIdea?.hashtags || sourceIdeas[2].hashtags,
      checklistHumano: [
        "Garantir que a ideia foi adaptada, nao copiada.",
        ...humanChecklist,
      ],
      status: "ideia",
      metricaChave: "Alcance e salvamentos",
      origem: radar?.marketSummary ? "Radar de Mercado" : "Hipotese do diagnostico",
    },
    {
      dia: "Dia 5",
      canal: "Blog / SEO / LinkedIn",
      objetivo: "Criar ativo de autoridade pesquisavel.",
      formato: "blog",
      pilar: "Autoridade e busca social",
      gancho: `Guia pratico: como decidir sobre ${niche}`,
      legenda: `Transforme a principal duvida do cliente em um post/artigo simples: problema, criterios de decisao, erro comum, exemplo real e convite para conversar.`,
      direcaoVisual: "Capa limpa com titulo forte, prova ou bastidor real.",
      visualPrompt: buildFallbackVisualPrompt(produto, "autoridade pratica e guia pesquisavel", plan.brandDNA || {
        paleta: ["#071b44", "#ff3217", "#f8fafc"],
        tipografia: "Sans-serif bold",
        estiloFoto: "Realistic editorial social media photo",
        motivos: ["human presence", "real environment"],
        tom: "authentic and useful",
        resumoVisual: "Realistic, direct and human.",
      }),
      cta: "Salvar, compartilhar ou pedir o diagnostico",
      hashtags: ["#seo", "#conteudo", "#autoridade"],
      checklistHumano: humanChecklist,
      status: "ideia",
      metricaChave: "Cliques, tempo de leitura e comentarios",
      origem: "Motor organico",
    },
    {
      dia: "Dia 6",
      canal: "Instagram",
      objetivo: "Fazer oferta sem perder o tom humano.",
      formato: sourceIdeas[3].formato,
      pilar: sourceIdeas[3].pilar,
      gancho: sourceIdeas[3].gancho,
      legenda: sourceIdeas[3].copy,
      roteiro: sourceIdeas[3].roteiro,
      direcaoVisual: "Oferta com contexto, prova e friccao baixa.",
      visualPrompt: sourceIdeas[3].visualPrompt,
      cta: sourceIdeas[3].cta,
      hashtags: sourceIdeas[3].hashtags,
      checklistHumano: [
        "Checar se existe uma oferta clara.",
        "Remover promessa exagerada.",
        ...humanChecklist,
      ],
      status: "ideia",
      metricaChave: "Cliques, DMs, leads e vendas",
      origem: "Oferta + conversao",
    },
    {
      dia: "Dia 7",
      canal: "Check-in",
      objetivo: "Medir sinais e preparar a proxima semana.",
      formato: "check-in",
      pilar: "Aprendizado semanal",
      gancho: "O que esta semana ensinou?",
      legenda: "Registre quais posts foram publicados, quais geraram conversa, quais tiveram salvamentos e quais merecem virar campanha.",
      direcaoVisual: "Nao precisa publicar; e uma tarefa interna de aprendizado.",
      visualPrompt: "",
      cta: "Registrar resultados e recalibrar o plano",
      hashtags: [],
      checklistHumano: [
        "Registrar numeros reais, mesmo que pequenos.",
        "Marcar o melhor gancho da semana.",
        "Escolher um conteudo para repetir ou transformar em campanha.",
      ],
      status: "ideia",
      metricaChave: "Aprendizados acionaveis",
      origem: "Loop semanal",
    },
  ];
}

function numericScore(result: WeeklyContentPlanItem["resultado"] = {}) {
  const reach = (result.alcance ?? 0) + (result.visualizacoes ?? 0);
  const engagement = (result.curtidas ?? 0) + (result.comentarios ?? 0) * 4 + (result.salvamentos ?? 0) * 6 + (result.compartilhamentos ?? 0) * 5;
  const business = (result.cliques ?? 0) * 3 + (result.leads ?? 0) * 12 + (result.vendas ?? 0) * 30 + (result.receita ?? 0) / 10;
  return Math.round(reach * 0.03 + engagement + business);
}

export function buildWeeklyLearning(items: WeeklyContentPlanItem[] = []): CacaPlan["aprendizadoSemanal"] {
  const withResults = items.filter(i => i.resultado);
  const published = items.filter(i => i.status === "publicado" || i.status === "medir" || i.resultado);
  if (!withResults.length && !published.length) {
    return {
      atualizadoEm: Date.now(),
      resumo: "A semana ainda esta em preparacao. Publique os primeiros itens e registre sinais para o Agente aprender.",
      melhorSinal: "Sem dados publicados ainda.",
      repetir: ["Publicar pelo menos 3 itens do plano antes de tirar conclusoes."],
      melhorar: ["Adicionar detalhes humanos nos posts antes de publicar."],
      proximaAcao: "Executar os dois primeiros dias do plano e registrar DMs, salvamentos ou cliques.",
    };
  }
  const ranked = [...items].sort((a, b) => numericScore(b.resultado) - numericScore(a.resultado));
  const best = ranked.find(i => i.resultado) ?? published[0] ?? ranked[0];
  const low = ranked.filter(i => i.resultado).slice(-2);
  const totalLeads = withResults.reduce((s, i) => s + (i.resultado?.leads ?? 0), 0);
  const totalSales = withResults.reduce((s, i) => s + (i.resultado?.vendas ?? 0), 0);
  const totalSaves = withResults.reduce((s, i) => s + (i.resultado?.salvamentos ?? 0), 0);
  return {
    atualizadoEm: Date.now(),
    resumo: `${published.length} item(ns) publicados/medidos. Sinais registrados: ${totalSaves} salvamentos, ${totalLeads} leads e ${totalSales} venda(s).`,
    melhorSinal: best ? `${best.dia} (${best.canal}) - ${best.gancho}` : "Ainda sem vencedor claro.",
    repetir: [
      best?.pilar ? `Repetir o pilar "${best.pilar}" com novo exemplo real.` : "Repetir o tema que gerou mais conversa.",
      best?.formato ? `Criar uma variacao no formato ${best.formato}.` : "Criar uma variacao do melhor gancho.",
    ].filter(Boolean),
    melhorar: low.length
      ? low.map(i => `Revisar ${i.dia}: trocar gancho/CTA se nao gerou cliques, comentarios ou salvamentos.`)
      : ["Registrar resultados dos posts fracos para o Agente diferenciar gosto de performance."],
    proximaAcao: best && numericScore(best.resultado) > 0
      ? "Transformar o melhor sinal da semana em nova versao e, se houver venda/lead, em campanha assistida."
      : "Publicar mais itens antes de investir verba. Primeiro precisamos de sinal organico.",
  };
}

export function buildOrganicEngine(plan: Partial<CacaPlan>, radar?: any): CacaPlan["motorOrganico"] {
  const bio = [plan.profile?.bio, plan.site?.description, plan.sumarioExecutivo].filter(Boolean).join(" ");
  const hasOffer = /\b(compre|comprar|or[cç]amento|diagnostico|diagnóstico|aula|curso|kit|produto|servi[cç]o|whatsapp|link)\b/i.test(bio);
  const hasProof = !!plan.profile?.followers || /\b(cliente|resultado|case|depoimento|prova|anos|especialista)\b/i.test(bio);
  const hasCta = /\b(link|bio|direct|whatsapp|chame|contato|diagnostico|diagnóstico)\b/i.test(bio);
  const hasRadar = !!radar?.hits?.length || !!radar?.ideas?.length;
  const hasPlan = !!plan.plano7Dias?.length;
  const scoreBreakdown = [
    { nome: "Oferta", valor: hasOffer ? 15 : 4, detalhe: hasOffer ? "Oferta identificada no perfil/contexto." : "Oferta ainda precisa ficar obvia." },
    { nome: "Prova", valor: hasProof ? 15 : 5, detalhe: hasProof ? "Existe sinal de autoridade ou base social." : "Falta prova social, numero ou bastidor real." },
    { nome: "CTA", valor: hasCta ? 15 : 3, detalhe: hasCta ? "Ha caminho de conversa/conversao." : "CTA ainda esta fraco ou invisivel." },
    { nome: "Radar", valor: hasRadar ? 10 : 2, detalhe: hasRadar ? "Mercado ja trouxe sinais externos." : "Radar precisa ser rodado/refinado." },
    { nome: "Execucao", valor: hasPlan ? 10 : 3, detalhe: hasPlan ? "Plano semanal existe." : "Ainda falta rotina semanal." },
  ];
  const score = Math.min(100, 35 + scoreBreakdown.reduce((s, item) => s + item.valor, 0));
  const rawTerms = [
    plan.produto,
    plan.nicho,
    ...(plan.pilaresConteudo ?? []),
    ...(plan.interessesPosts ?? []).map(i => i.nome),
    ...(radar?.opportunities ?? []).map((o: any) => o.title || o.theme),
  ].filter(Boolean).join(" ");
  const terms = Array.from(new Set(
    stripAccents(rawTerms)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 3 && !["para", "como", "mais", "sobre", "conteudo", "negocio"].includes(w))
  )).slice(0, 14);
  return {
    score,
    scoreBreakdown,
    leitura: score >= 75
      ? "A base organica esta pronta para consistencia semanal e testes de campanha."
      : score >= 55
        ? "Existe base organica, mas ainda falta deixar oferta, prova e CTA mais obvios."
        : "Antes de trafego pago, fortaleça perfil, prova e conteudo util para nao comprar clique frio demais.",
    ajustesPerfil: [
      hasOffer ? "Oferta aparece no contexto." : "Deixar a oferta principal explicita na bio/perfil.",
      hasProof ? "Existe algum sinal de prova/autoridade." : "Adicionar prova social, numero, case ou bastidor real.",
      hasCta ? "CTA identificado." : "Adicionar CTA direto: WhatsApp, direct, diagnostico ou link.",
      "Fixar 3 posts: promessa, prova e melhor conteudo educativo.",
    ],
    termosBuscaSocial: terms.length ? terms : ["problema do cliente", "solucao", "preco", "como escolher", "resultado"],
    pilares: (plan.pilaresConteudo?.length ? plan.pilaresConteudo : ["Prova social", "Bastidores", "Educacao", "Oferta"]).slice(0, 5),
    oportunidades: [
      "Transformar comentarios e DMs em novos posts.",
      "Reaproveitar cada ideia em Reels, carrossel, Story e post de autoridade.",
      "Usar salvamentos e cliques como criterio para decidir o que vira anuncio.",
    ],
    proximosPassos: [
      {
        acao: hasOffer ? "Transformar oferta em post fixado" : "Reescrever bio com oferta principal",
        motivo: hasOffer ? "A promessa ja existe; precisa ganhar visibilidade." : "Sem oferta clara, o conteudo atrai mas nao converte.",
        impacto: "Mais cliques, DMs e conversas qualificadas.",
      },
      {
        acao: hasProof ? "Criar prova semanal recorrente" : "Publicar prova social simples",
        motivo: hasProof ? "Prova precisa virar rotina, nao excecao." : "Prova reduz desconfianca antes de vender.",
        impacto: "Mais salvamentos, respostas e confianca.",
      },
      {
        acao: hasRadar ? "Reaproveitar sinais do Radar no plano" : "Rodar Radar com perfis inspiradores",
        motivo: hasRadar ? "O mercado ja mostrou mecanismos que podem ser adaptados." : "Sem radar, o plano depende demais de intuicao.",
        impacto: "Ideias mais atuais e menos genericas.",
      },
    ],
  };
}

export function buildAssistedCampaign(plan: Partial<CacaPlan>): CacaPlan["campanhaAssistida"] {
  const items = plan.plano7Dias ?? [];
  const ranked = [...items].sort((a, b) => numericScore(b.resultado) - numericScore(a.resultado));
  const best = ranked.find(i => i.resultado && numericScore(i.resultado) > 0) ?? ranked.find(i => i.status === "aprovado" || i.status === "publicado") ?? items[0];
  const produto = plan.produto || plan.nicho || "oferta";
  const base = best ? `${best.dia} - ${best.canal}: ${best.gancho}` : "Primeiro post aprovado do plano de 7 dias";
  return {
    titulo: `Campanha assistida - ${produto}`.slice(0, 80),
    base,
    objetivo: best?.resultado?.leads || best?.resultado?.vendas ? "Escalar um conteudo com sinal real de conversao." : "Testar interesse com baixo investimento antes de escalar.",
    canal: best?.canal?.includes("Google") ? "Google / Busca" : "Meta Ads (Instagram/Facebook)",
    publico: [
      "Pessoas que engajaram com o perfil nos ultimos 30 dias.",
      `Interesses e termos ligados a ${plan.nicho || produto}.`,
      "Remarketing de visitantes/site/WhatsApp quando existir base.",
    ],
    copy: best?.legenda || `Mostre a promessa de ${produto}, uma prova simples e um convite direto para conversar.`,
    criativo: best?.direcaoVisual || plan.brandDNA?.resumoVisual || "Criativo com rosto, contexto real e CTA claro.",
    orcamento: "Comecar com R$ 20-30/dia por 3 dias. So aumentar se houver clique, DM, lead ou venda.",
    checklist: [
      "Conferir se oferta e CTA estao claros.",
      "Usar criativo com checklist humano 4/5 ou superior.",
      "Enviar para uma pagina, WhatsApp ou direct que responda rapido.",
      "Medir CTR, cliques, leads e vendas antes de escalar.",
      "Nao automatizar verba alta sem resultado manual registrado.",
    ],
    kpis: ["CTR", "CPC", "DMs/leads", "CPL", "vendas", "receita"],
  };
}

function buildPlanner(plan: Partial<CacaPlan>): CacaPlan["acompanhamento"] {
  const timeline = plan.cronogramaMulticanal ?? buildMultichannelTimeline(plan) ?? [];
  return {
    ciclo: "Ciclo de 30 dias",
    progresso: 0,
    conteudos: { total: 16, feitos: 0 },
    campanhas: 0,
    proximoFoco: "Executar Semana 1",
    snapshots: [
      {
        label: "Diagnostico Semana 0",
        resumo: plan.sumarioExecutivo || "Foto inicial do posicionamento, canais e oportunidades.",
        scores: [
          { nome: "Clareza de posicionamento", valor: 62 },
          { nome: "Consistencia por canal", valor: 38 },
          { nome: "Base de autoridade", valor: 44 },
        ],
      },
      {
        label: "Check-in Semana 2",
        resumo: "Sera preenchido quando houver execucao, posts publicados e primeiros sinais de campanha.",
        scores: [
          { nome: "Clareza de posicionamento", valor: 0 },
          { nome: "Consistencia por canal", valor: 0 },
          { nome: "Base de autoridade", valor: 0 },
        ],
      },
    ],
    semanas: timeline.map((week, i) => ({
      semana: week.semana,
      itens: week.canais.map(item => ({ texto: `${item.canal}: ${item.acao}`, status: "todo" as const })),
    })),
    metricasCampanha: [
      { canal: "LinkedIn Ads", titulo: "Decisores e areas afins", metricas: [{ nome: "CTR", valor: "-" }, { nome: "CPL", valor: "-" }, { nome: "Leads qualificados", valor: "-" }], leitura: "Aguardando campanha aprovada." },
      { canal: "Meta Ads", titulo: "Bastidores e prova visual", metricas: [{ nome: "CTR", valor: "-" }, { nome: "CPC", valor: "-" }, { nome: "Cliques no site", valor: "-" }], leitura: "Aguardando campanha aprovada." },
      { canal: "Conteudo organico", titulo: "LinkedIn + Blog", metricas: [{ nome: "Comentarios qualificados", valor: "-" }, { nome: "Buscas de marca", valor: "-" }, { nome: "Artigos publicados", valor: "0/2" }], leitura: "Aguardando execucao do cronograma." },
    ],
    novaPrescricao: "Execute a primeira semana, publique o artigo pilar e registre o check-in para o Agente comparar a evolucao.",
  };
}

export function enhancePlanV2(plan: CacaPlan, redes: Record<string, string> = {}, radar?: any): CacaPlan {
  const next: CacaPlan = { ...plan, redes: { ...(plan.redes ?? {}), ...redes } };
  next.interessesPosts = inferPostInterests(next, next.profile, radar);
  next.fontesUsadas = next.fontesUsadas?.length ? next.fontesUsadas : buildSources(next, next.redes, radar);
  next.canais360 = next.canais360?.canais?.length ? next.canais360 : buildCanais360(next, next.redes, radar);
  // Limpa restos de LinkedIn de planos antigos: se detectado, reconstrói por canal real.
  const hasLinkedin =
    (next.prescricoesPorCanal ?? []).some((p: any) => /linkedin/i.test(p?.canal || "")) ||
    (next.cronogramaMulticanal ?? []).some((w: any) => (w?.canais ?? []).some((c: any) => /linkedin/i.test(c?.canal || ""))) ||
    (next.acoesImediatas ?? []).some((a: any) => /linkedin/i.test(a?.canal || ""));
  next.prescricoesPorCanal = (next.prescricoesPorCanal?.length && !hasLinkedin) ? next.prescricoesPorCanal : buildChannelPrescriptions(next, radar);
  next.cronogramaMulticanal = (next.cronogramaMulticanal?.length && !hasLinkedin) ? next.cronogramaMulticanal : buildMultichannelTimeline(next);
  next.plano7Dias = next.plano7Dias?.length ? next.plano7Dias : buildSevenDayPlan(next, radar);
  next.aprendizadoSemanal = next.aprendizadoSemanal ?? buildWeeklyLearning(next.plano7Dias ?? []);
  next.motorOrganico = buildOrganicEngine(next, radar);
  next.campanhaAssistida = buildAssistedCampaign(next);
  next.acoesImediatas = (next.acoesImediatas?.length && !hasLinkedin) ? next.acoesImediatas : buildImmediateActions(next, radar);
  next.metodoDiagnostico = next.metodoDiagnostico?.length ? next.metodoDiagnostico : buildDiagnosticMethod(next, radar);
  next.parecerEstrategico = next.parecerEstrategico ?? {
    titulo: "Parecer estrategico",
    analise: next.sumarioExecutivo || next.resumo || "O negocio tem sinais suficientes para organizar canais por funcao e transformar diagnostico em execucao.",
    prescricaoImediata: "Trabalhar um tema central por semana, conectando Instagram, TikTok / Reels, Google (Busca) e Blog / SEO em uma mesma narrativa.",
    radarImpacto: radar?.marketSummary ? `Radar: ${truncate(radar.marketSummary, 360)}` : "Aguardando Radar de Mercado para fortalecer o parecer com sinais vivos.",
  };
  next.acompanhamento = next.acompanhamento ?? buildPlanner(next);
  return next;
}

function applyContextGuard(plan: CacaPlan, produto: string, redes: Record<string, string> = {}, site?: SiteSnapshot | null, profile?: SocialProfile | null): CacaPlan {
  if (!occupationalHealthContext(produto, redes, site, profile)) return plan;
  const blocked = /\b(fitness|academia|treino|musculacao|muscula[cç][aã]o|emagrecimento|shape)\b/i;
  const next: CacaPlan = {
    ...plan,
    nicho: "saude do trabalho, SST e medicina ocupacional",
    suggestedFactors: {
      ...(plan.suggestedFactors ?? {}),
      img_cor_predominante: "azul",
      img_tipo: "pessoa",
      copy_tom: "tecnico_acessivel",
      copy_formato: "autoridade_consultiva",
      copy_gatilho: "risco_e_conformidade",
      of_angulo: "dor",
    },
  };
  if (!next.sumarioExecutivo || blocked.test(next.sumarioExecutivo)) {
    next.sumarioExecutivo = "A leitura principal aponta para Saude do Trabalho, SST e Medicina Ocupacional: um mercado B2B em que empresas, RH, SESMT e gestores precisam reduzir risco, cumprir normas e proteger pessoas. O LinkedIn informado foi usado como sinal de identidade do nicho, junto ao site/briefing quando disponivel. A estrategia deve construir autoridade tecnica acessivel, prova de conformidade e conteudo educativo que transforme obrigacoes como PCMSO, PGR, eSocial, ergonomia e NRs em decisao clara de compra.";
  }
  if (!next.objetivoPrincipal || blocked.test(next.objetivoPrincipal)) {
    next.objetivoPrincipal = "Gerar leads qualificados de empresas que precisam organizar Saude do Trabalho, SST, exames ocupacionais, programas obrigatorios e prevencao com orientacao confiavel.";
  }
  return next;
}

// ───────────────────────── DNA visual (visão) ─────────────────────────
async function analyzeBrandDNA(profile: SocialProfile | null, produto: string, site?: SiteSnapshot | null): Promise<{ brandDNA: BrandDNA; analiseTopPosts: string[] }> {
  const { cor } = suggestFactors(produto, "vender", profile);
  const fallback: BrandDNA = {
    paleta: PALETAS[cor] ?? PALETAS.laranja,
    tipografia: "Sans-serif moderna, títulos em peso bold",
    estiloFoto: "Foto lifestyle autêntica, luz natural, aspecto real (não banco de imagens)",
    motivos: ["pessoas reais", "produto em destaque", "cenário cotidiano"],
    tom: "próximo, confiável e aspiracional",
    resumoVisual: "Visual autêntico e acolhedor, com a cara de quem fala de igual pra igual.",
  };
  const imgs = (profile?.topPosts ?? []).map(p => p.img).filter(Boolean).slice(0, 3) as string[];
  // Sem perfil mas COM site: extrai DNA da OG image + texto do site
  if (imgs.length === 0 && site && process.env.OPENROUTER_API_KEY) {
    try {
      const parts: ContentPart[] = [
        { type: "text", text: `Você é diretor de arte. Esta é a presença ONLINE da marca (sem Instagram). Extraia o DNA VISUAL e o tom a partir do que estiver visível (logo, og:image, título, descrição, texto da landing). Mesmo com pouca info, dê um direcionamento útil — não fique genérico.
SITE: ${site.url}
TÍTULO: ${site.title ?? "—"}
DESCRIÇÃO: ${site.description ?? "—"}
H1: ${site.h1 ?? "—"}
TRECHO: ${(site.excerpt ?? "").slice(0, 600)}
PRODUTO: ${produto}
Retorne SOMENTE JSON: {"brandDNA":{"paleta":["#hex","#hex","#hex"],"tipografia":string,"estiloFoto":string,"motivos":[string,string,string],"tom":string,"resumoVisual":string}}` },
      ];
      if (site.ogImage) parts.push({ type: "image_url", image_url: { url: site.ogImage } });
      const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.5, maxTokens: 900 });
      const parsed = parseJson<{ brandDNA: BrandDNA }>(content);
      if (parsed?.brandDNA) return { brandDNA: { ...fallback, ...parsed.brandDNA }, analiseTopPosts: [] };
      console.error("[diagnosis] brandDNA(site): JSON não parseado");
    } catch (e) { console.error("[diagnosis] brandDNA(site) falhou:", (e as any)?.message); }
    return { brandDNA: fallback, analiseTopPosts: [] };
  }
  if (!process.env.OPENROUTER_API_KEY || imgs.length === 0) {
    const analiseTopPosts = (profile?.topPosts ?? []).map(p => `${nf(p.likes)} curtidas, ${nf(p.comments)} comentários — ${truncate(p.caption || "conteúdo visual forte", 70)}`);
    return { brandDNA: fallback, analiseTopPosts };
  }
  try {
    const parts: ContentPart[] = [
      { type: "text", text: `Você é diretor de arte. Analise os ${imgs.length} posts de MAIOR engajamento desta marca (${profile?.handle ?? ""}, nicho próximo a "${produto}") e extraia o DNA VISUAL para replicarmos a estética que já funciona.
Retorne SOMENTE JSON:
{"brandDNA":{"paleta":["#hex","#hex","#hex"],"tipografia":string,"estiloFoto":string,"motivos":[string,string,string],"tom":string,"resumoVisual":string},"analiseTopPosts":[string]}
- "paleta": 3-4 cores DOMINANTES reais que você vê (hex aproximado).
- "estiloFoto": descreva o estilo (ex.: "selfie autêntica, luz natural, fundo de papel craft, doodles desenhados à mão").
- "analiseTopPosts": 1 comentário perspicaz POR imagem (na ordem), explicando por que engajou e o que replicar.` },
    ];
    profile?.topPosts.slice(0, 3).forEach((p, i) => {
      parts.push({ type: "text", text: `Post ${i + 1}: ${nf(p.likes)} curtidas, ${nf(p.comments)} comentários. Legenda: "${truncate(p.caption || "(sem legenda)", 120)}"` });
      if (p.img) parts.push({ type: "image_url", image_url: { url: p.img } });
    });
    const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.4, maxTokens: 1600 });
    const parsed = parseJson<{ brandDNA: BrandDNA; analiseTopPosts: string[] }>(content);
    if (parsed?.brandDNA) {
      return {
        brandDNA: { ...fallback, ...parsed.brandDNA },
        analiseTopPosts: parsed.analiseTopPosts?.length ? parsed.analiseTopPosts : fallback.motivos,
      };
    }
    console.error("[diagnosis] brandDNA: JSON não parseado (len=" + content.length + ", início=" + content.slice(0, 60) + ")");
  } catch (e) {
    console.error("[diagnosis] brandDNA vision falhou:", (e as any)?.message);
  }
  const analiseTopPosts = (profile?.topPosts ?? []).map(p => `${nf(p.likes)} curtidas, ${nf(p.comments)} comentários — ${truncate(p.caption || "conteúdo visual forte", 70)}`);
  return { brandDNA: fallback, analiseTopPosts };
}

// ───────────────────────── template (fallback sem LLM) ─────────────────────────
function buildFallbackVisualPrompt(produto: string, pilar: string, dna: BrandDNA): string {
  const cores = dna.paleta.join(", ");
  return `Editorial lifestyle photo for a social media post about "${produto}" — theme: ${pilar}. ${dna.estiloFoto}. Color palette ${cores}. Real, authentic mood (${dna.tom}). Shot on 50mm, shallow depth of field, soft natural light, rule-of-thirds composition. Leave clean negative space at the top for a headline. No text in the image, high quality.`;
}

function templatePlan(produto: string, objetivo: string, redes: Record<string, string>, profile: SocialProfile | null, dna: BrandDNA): CacaPlan {
  const { factors, lente, nicho } = suggestFactors(produto, objetivo, profile, redes);
  const objLabel: Record<string, string> = { vender: "vender mais", leads: "gerar leads", seguidores: "crescer seguidores", lancar: "lançar o produto" };

  const pilares = ["Prova social (resultados/depoimentos)", "Bastidores e autenticidade", "Educação rápida (dica que resolve)", "Oferta/CTA claro"];
  const angulos: PostIdea["angulo"][] = ["desejo", "transformacao", "dor", "desejo"];
  const formatos: PostIdea["formato"][] = ["imagem", "reels", "carrossel", "imagem"];
  const postIdeas: PostIdea[] = [0, 1, 2, 3].map(i => ({
    titulo: `${pilares[i]} de ${produto}`.slice(0, 60),
    pilar: pilares[i],
    formato: formatos[i],
    angulo: angulos[i],
    gancho: i === 0 ? `O resultado que você não esperava com ${produto.toLowerCase()}` : i === 1 ? `Antes x depois: o que mudou com ${produto.toLowerCase()}` : i === 2 ? `O erro que te impede de ter resultado com ${produto.toLowerCase()}` : `O convite direto para começar com ${produto.toLowerCase()}`,
    copy: `${pilares[i]} — mostre por que ${produto} entrega o que promete. Fale com quem busca ${objLabel[objetivo] ?? "resultado"}.`,
    hashtags: ["#" + nicho.split(" ")[0].replace(/[^a-zA-Z]/g, ""), "#dica", "#resultado"],
    cta: objetivo === "leads" ? "Baixe grátis" : "Comece agora",
    visualPrompt: buildFallbackVisualPrompt(produto, pilares[i], dna),
    roteiro: formatos[i] === "reels" ? {
      gancho3s: `Para nos 3 primeiros segundos: "${i === 1 ? "Antes eu também travava nisso…" : "Ninguém te conta isso sobre " + produto.toLowerCase()}"`,
      cenas: [
        { tempo: "0-3s", acao: "Gancho na câmera, plano fechado no rosto", audio: "Áudio em alta + fala do gancho" },
        { tempo: "3-12s", acao: "Mostra o processo/resultado (B-roll)", audio: "Narração explicando o valor" },
        { tempo: "12-20s", acao: "Prova (print/depoimento/antes-depois)", audio: "ASMR do produto / trilha" },
        { tempo: "20-25s", acao: "Chamada para ação na tela", audio: "CTA falado" },
      ],
      cta: objetivo === "leads" ? "Comenta 'EU QUERO' que te mando o material" : "Toca no link e garante o seu",
    } : undefined,
  }));

  const plan: CacaPlan = {
    nicho, produto, lente, perfilLido: !!profile, profile, brandDNA: dna, linkedin: redes.linkedin || null,
    sumarioExecutivo: `Você atua em ${nicho} e quer ${objLabel[objetivo] ?? "vender mais"}.${profile ? ` Analisamos seu perfil @${profile.handle} (${nf(profile.followers)} seguidores, engajamento ~${profile.engajamentoPct ?? "—"}%).` : ""} Há audiência e conteúdo que engaja — o que falta é transformar isso em vendas com criativos na sua identidade visual, um funil direto e o Teste A/Z para achar o "ovo de ouro".`,
    resumo: `Plano para transformar sua audiência em vendas, com a cara da sua marca.`,
    objetivoPrincipal: `${(objLabel[objetivo] ?? "Vender mais")} de forma previsível, encontrando os criativos campeões e escalando o que dá retorno.`,
    situacao: [
      { fator: "Perfil", analise: profile ? `@${profile.handle} · ${nf(profile.followers)} seguidores${profile.category ? ` · ${profile.category}` : ""}` : "Análise pelo que foi descrito (perfil não lido)" },
      { fator: "Engajamento", analise: profile?.engajamentoPct ? `~${profile.engajamentoPct}% (média ${nf(profile.avgLikes)} curtidas/post) — sinal de audiência aquecida.` : "A medir após conectar o perfil." },
      { fator: "Ponto forte", analise: "Conteúdo autêntico com identidade visual definida — base ideal para anúncios que não parecem anúncio." },
      { fator: "Principal desafio", analise: "Converter alcance/engajamento em venda direta (falta anúncio pago + CTA + funil)." },
    ],
    diagnostico: [
      `Nicho: ${nicho}.`,
      profile ? `Perfil @${profile.handle}: ${nf(profile.followers)} seguidores.` : "Sem perfil lido.",
      "Gargalo provável: audiência sem oferta/anúncio estruturado.",
    ],
    publicoAlvo: [
      `Faixa principal: ${factors.img_pessoa_idade.replace(/_/g, " ")}, ${factors.img_pessoa_sexo}.`,
      "Já consome seu conteúdo — público quente para remarketing.",
      "Busca transformação/resultado no tema do nicho.",
    ],
    dnaOrganico: [dna.resumoVisual, `Tom: ${dna.tom}.`, `Estilo: ${dna.estiloFoto}.`],
    pilaresConteudo: pilares,
    pilaresEstrategicos: [
      { titulo: "Conteúdo que vende", objetivo: "Criativos na identidade da marca, prontos para anúncio.", acoes: [
        { acao: "Replicar o que já funciona", detalhe: "Transformar os posts campeões em anúncios (mesma estética)." },
        { acao: "Teste A/Z", detalhe: "Variar ângulo (dor/desejo/transformação) e formato para achar o vencedor." },
        { acao: "Gancho de 3s", detalhe: "Todo criativo abre com um gancho forte que prende a atenção." },
      ] },
      { titulo: "Funil & oferta", objetivo: "Caminho claro do anúncio até a compra.", acoes: [
        { acao: "Funil direto", detalhe: "Anúncio → página simples → WhatsApp/Checkout." },
        { acao: "Oferta + downsell", detalhe: "Oferta principal com parcelamento e uma isca barata para quem não comprar." },
      ] },
      { titulo: "Otimização contínua", objetivo: "Escalar o que dá retorno e cortar o que não dá.", acoes: [
        { acao: "Ovos de Ouro", detalhe: "A verba migra sozinha para o criativo vencedor (Thompson Sampling)." },
        { acao: "Leitura semanal", detalhe: "Acompanhar CPL/ROAS e dobrar a aposta no campeão." },
      ] },
    ],
    oportunidades: [
      "Transformar os posts campeões em anúncios pagos.",
      "Criar um funil simples (anúncio → página → WhatsApp).",
      "Testar ângulos (Teste A/Z) para achar o que mais vende.",
    ],
    analiseTopPosts: (profile?.topPosts ?? []).map(p => `${nf(p.likes)} curtidas, ${nf(p.comments)} comentários — ${truncate(p.caption || "conteúdo visual forte", 70)}`),
    estrategia: {
      canal: "Meta (Instagram/Facebook) + Reels",
      funil: "Anúncio → Landing simples → WhatsApp/Checkout",
      angulos: lente === "dor" ? ["Dor (o problema)", "Desejo (a transformação)", "Prova social"] : ["Desejo (o resultado)", "Transformação", "Prova social"],
      oferta: "Oferta principal + parcelamento + downsell.",
    },
    cronograma: [
      { periodo: "Semana 1", foco: "Gerar 6 criativos no Estudio e aprovar o pacote final.", meta: "Pacote pronto para publicacao" },
      { periodo: "Semana 2", foco: "Acompanhar Ovos de Ouro; a verba migra para o que vende.", meta: "1º criativo vencedor" },
      { periodo: "Semana 3", foco: "Escalar o vencedor e gerar variações do ângulo campeão.", meta: "ROAS positivo" },
      { periodo: "Semana 4", foco: "Novos ângulos + remarketing do público quente.", meta: "Escala sustentável" },
    ],
    planoAcao: [
      { dia: "Dia 1", foco: "Gerar 6 criativos no Estúdio (Teste A/Z)." },
      { dia: "Dia 2", foco: "Publicar manualmente nos canais e registrar os links." },
      { dia: "Dia 4", foco: "Acompanhar os Ovos de Ouro." },
      { dia: "Dia 7", foco: "Escalar o vencedor e variar o ângulo campeão." },
    ],
    kpis: ["CPL (custo por lead)", "ROAS", "Conversão da página", "Nº de vendas", "Ovos de ouro encontrados"],
    conclusao: "O caminho é consistência + método: criar na identidade da marca, testar ângulos, deixar a verba migrar para o vencedor e escalar. Com disciplina, o crescimento vira consequência.",
    suggestedFactors: factors,
    postIdeas,
  };
  plan.interessesPosts = inferPostInterests(plan, profile);
  return enhancePlanV2(plan, redes);
}

// ───────────────────────── plano via LLM (cérebro) ─────────────────────────
async function llmPlan(produto: string, objetivo: string, redes: Record<string, string>, profile: SocialProfile | null, dna: BrandDNA, sobre?: string, site?: SiteSnapshot | null): Promise<CacaPlan | null> {
  if (!process.env.OPENROUTER_API_KEY) return null;
  try {
    const base = templatePlan(produto, objetivo, redes, profile, dna);
    const linkedinId = linkedinSlug(redes.linkedin);
    const validatedContext = occupationalHealthContext(produto, redes, site, profile)
      ? `\nSINAL CONFIAVEL DE NICHO: o briefing/LinkedIn/site indica Saude do Trabalho, SST, Seguranca do Trabalho ou Medicina Ocupacional. Trate como mercado B2B/profissional de normas, prevencao, empresas, RH, SESMT, PCMSO, PGR, eSocial e ergonomia. Nao classifique como fitness, academia, treino, emagrecimento ou bem-estar generico.`
      : "";
    const linkedinTxt = redes.linkedin
      ? `\nLINKEDIN INFORMADO: ${redes.linkedin}${linkedinId ? `\nIDENTIFICADOR DO LINKEDIN: ${linkedinId}` : ""}\nUse como contexto estrategico para linguagem B2B, areas afins e hipoteses de segmentacao. Nao finja ter lido posts, conexoes ou pessoas relacionadas do LinkedIn se esses dados nao estiverem no texto.${validatedContext}`
      : "";
    const perfilTxt = profile
      ? `PERFIL (@${profile.handle}): ${nf(profile.followers)} seguidores; bio: "${profile.bio ?? ""}"; categoria: ${profile.category ?? "-"}; engajamento ~${profile.engajamentoPct ?? "?"}%.
POSTS RECENTES (legenda | curtidas | comentarios):
${profile.posts.slice(0, 8).map(p => `- ${(p.caption || "(sem legenda)").slice(0, 80)} | ${p.likes} | ${p.comments}`).join("\n")}${linkedinTxt}`
      : site && (site.title || site.excerpt)
        ? `PERFIL SOCIAL: ainda nao tem (ou nao informado).
SITE OFICIAL: ${site.url}
TITULO: ${site.title ?? "-"}
DESCRICAO: ${site.description ?? "-"}
H1: ${site.h1 ?? "-"}
TRECHO DA LANDING: ${(site.excerpt ?? "").slice(0, 800)}${linkedinTxt}`
        : `PERFIL: nao lido automaticamente.${linkedinTxt}`;

    const sys = `Você é o Agente Estrategista da Cacarejar — consultor sênior de marketing (nível de agência de elite) que escreve planos como uma consultoria de verdade e dirige a arte dos criativos. PT-BR. Use DADOS REAIS (cite números). Seja específico, confiável e acionável.

DNA VISUAL DA MARCA (já extraído dos posts campeões — RESPEITE em todo visualPrompt):
${JSON.stringify(dna)}

Retorne SOMENTE JSON válido com EXATAMENTE estas chaves:
{
 "sumarioExecutivo": string (3-5 frases, cita números reais),
 "situacao": [{"fator":string,"analise":string}] (4-5 linhas: Perfil, Engajamento, Ponto forte, Desafio, Oportunidade),
 "objetivoPrincipal": string,
 "publicoAlvo": [string] (3-4),
 "oportunidades": [string] (3),
 "pilaresEstrategicos": [{"titulo":string,"objetivo":string,"acoes":[{"acao":string,"detalhe":string}]}] (3-4 pilares, 2-3 ações cada),
 "cronograma": [{"periodo":string,"foco":string,"meta":string}] (4 períodos),
 "conclusao": string,
 "postIdeas": [{"titulo":string,"pilar":string,"formato":"imagem"|"reels"|"carrossel","angulo":"dor"|"desejo"|"transformacao","gancho":string,"copy":string,"hashtags":[string],"cta":string,"visualPrompt":string,"roteiro":{"gancho3s":string,"cenas":[{"tempo":string,"acao":string,"audio":string}],"cta":string}}] (EXATAMENTE 4 ideias),
 "suggestedFactors": object,
 "lente": "dor"|"desejo",
 "nicho": string
}

REGRAS DOS POST IDEAS (o mais importante):
- 3 ideias com ângulos DIFERENTES e ao menos 1 formato "reels".
- "visualPrompt": UM prompt de geração de imagem MEMORÁVEL, em INGLÊS, 50-90 palavras. DEVE conter: sujeito + ação concreta; cenário; composição/enquadramento; iluminação; câmera/lente (ex.: shot on 35mm, shallow depth of field); a PALETA da marca (use os hex do DNA); mood alinhado ao tom da marca; estilo fotográfico alinhado a estiloFoto do DNA; e TERMINE com "leave clean negative space at the top for a headline". Não escreva texto dentro da imagem. Nada genérico — deve parecer um post REAL desta marca.
- "roteiro" (só nos formatos reels/carrossel): gancho de 3s + 3-4 cenas (tempo/ação/áudio, com ASMR ou POV quando fizer sentido) + CTA.
- "gancho": frase de 3 segundos que prende (pergunta intrigante, número surpreendente, promessa).
- suggestedFactors usa chaves: img_tipo,img_cor_predominante,img_pessoa_idade,img_pessoa_sexo,img_estilo,copy_tom,copy_formato,copy_gatilho,copy_cta,of_angulo (valores snake_case).`;

    const usr = `Produto/oferta: ${produto}
Objetivo: ${objetivo}
Redes: ${JSON.stringify(redes)}
${perfilTxt}
O cliente também contou: ${sobre || "(nada além)"}
Fatores válidos de referência: ${JSON.stringify(base.suggestedFactors)}.`;

    const content = await openRouterChat([{ role: "system", content: sys }, { role: "user", content: usr }], { model: BRAIN, temperature: 0.7, maxTokens: 8192 });
    const parsed = parseJson<Partial<CacaPlan>>(content);
    if (!parsed) { console.error("[diagnosis] plano: JSON não parseado (len=" + content.length + ", fim=" + content.slice(-60) + ")"); return null; }

    // monta o plano final: base garante TODOS os campos legados; LLM enriquece os de consultoria.
    const plan: CacaPlan = {
      ...base,
      ...parsed,
      brandDNA: dna,
      analiseTopPosts: base.analiseTopPosts,
      profile,
      linkedin: redes.linkedin || null,
      produto,
      perfilLido: !!profile,
      suggestedFactors: { ...base.suggestedFactors, ...(parsed.suggestedFactors ?? {}) },
      postIdeas: ([...((parsed.postIdeas?.length ? parsed.postIdeas : []) as PostIdea[]), ...base.postIdeas].slice(0, 4)) as PostIdea[],
      pilaresEstrategicos: parsed.pilaresEstrategicos?.length ? parsed.pilaresEstrategicos : base.pilaresEstrategicos,
      cronograma: parsed.cronograma?.length ? parsed.cronograma : base.cronograma,
      situacao: parsed.situacao?.length ? parsed.situacao : base.situacao,
    };
    return enhancePlanV2(applyContextGuard(plan, produto, redes, site, profile), redes);
  } catch (e) {
    console.error("[diagnosis] llmPlan falhou:", (e as any)?.message);
    return null;
  }
}

const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const REFRESH_LIMIT_PER_HANDLE = 3;
const cleanHandle = (h: string) => (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").toLowerCase();

/** Verifica se o cliente pode atualizar o estudo do MESMO @ — 3 atualizações por 24h.
 *  Retorna { allowed, used, limit, resetAt } sem mutar nada. */
export async function checkRefreshAllowance(orgId: number, handle: string) {
  const db = await getDb();
  const h = cleanHandle(handle);
  if (!db || !h) return { allowed: true, used: 0, limit: REFRESH_LIMIT_PER_HANDLE, resetAt: 0 };
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const history = ((rows[0]?.refreshHistory as any[]) ?? []).filter(r => r?.handle === h && Date.now() - r.at < REFRESH_WINDOW_MS);
  const used = history.length;
  const oldest = history.length ? Math.min(...history.map(r => r.at)) : 0;
  return { allowed: used < REFRESH_LIMIT_PER_HANDLE, used, limit: REFRESH_LIMIT_PER_HANDLE, resetAt: oldest + REFRESH_WINDOW_MS };
}

export async function analyze(params: {
  orgId: number; produto: string; objetivo: string; redes?: Record<string, string>; sobre?: string;
}): Promise<CacaPlan> {
  const redes = params.redes ?? {};
  // Rate limit do MESMO @ — 3x/24h. Outros @ passam livre (fluxo de troca já tem confirmação).
  const handleNovo = cleanHandle(redes.instagram || "");
  if (handleNovo) {
    const check = await checkRefreshAllowance(params.orgId, handleNovo);
    if (!check.allowed) {
      const horas = Math.max(1, Math.ceil((check.resetAt - Date.now()) / (60 * 60 * 1000)));
      throw new Error(`Você já atualizou o estudo de @${handleNovo} ${check.used}x nas últimas 24h (limite ${check.limit}). Tente novamente em ~${horas}h.`);
    }
  }
  // Lê IG + SITE em paralelo. Site é fallback útil quando o cliente ainda não tem IG.
  const [profile, site] = await Promise.all([
    fetchProfile(redes).catch(() => null),
    redes.site ? fetchSite(redes.site).catch(() => null) : Promise.resolve(null),
  ]);
  const { brandDNA, analiseTopPosts } = await analyzeBrandDNA(profile, params.produto, site);

  const plan = (await llmPlan(params.produto, params.objetivo, redes, profile, brandDNA, params.sobre, site))
    ?? templatePlan(params.produto, params.objetivo, redes, profile, brandDNA);
  plan.analiseTopPosts = analiseTopPosts;
  plan.brandDNA = brandDNA;
  plan.site = site ?? undefined;
  plan.siteLido = !!site?.title || !!site?.description;
  plan.linkedin = redes.linkedin || null;
  plan.redes = redes;
  plan.dataQuality = buildDiagnosisDataQuality(redes, profile, site);
  const enhancedPlan = enhancePlanV2(applyContextGuard(plan, params.produto, redes, site, profile), redes);
  enhancedPlan.dataQuality = plan.dataQuality;

  const base = suggestFactors(params.produto, params.objetivo, profile, redes, site).factors;
  enhancedPlan.suggestedFactors = await sanitizeFactors(enhancedPlan.suggestedFactors, base);

  const db = await getDb();
  if (db) {
    const existing = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, params.orgId)).limit(1);
    const oldContext = existing[0]?.planoJson ? contextFromPlan(existing[0].planoJson, existing[0]) : null;
    const newContext = contextFromPlan(enhancedPlan, { redes, produto: params.produto, nicho: enhancedPlan.nicho });
    if (existing[0]?.planoJson && oldContext?.key !== newContext?.key) {
      await archivePendingForContext(params.orgId, oldContext, true);
    }
    const row = {
      organizationId: params.orgId, nicho: enhancedPlan.nicho, produto: params.produto, objetivo: params.objetivo, redes,
      dnaOrganico: { itens: enhancedPlan.dnaOrganico, perfil: profile ?? undefined },
      publicoAlvo: { idade: enhancedPlan.suggestedFactors.img_pessoa_idade, sexo: enhancedPlan.suggestedFactors.img_pessoa_sexo },
      resumoDiagnostico: enhancedPlan.sumarioExecutivo ?? enhancedPlan.resumo, planoJson: enhancedPlan as any, radarJson: null as any,
    };
    // registra a atualização (para rate limit por @)
    const history = ((existing[0]?.refreshHistory as any[]) ?? []).filter(r => Date.now() - r.at < REFRESH_WINDOW_MS);
    if (handleNovo) history.push({ at: Date.now(), handle: handleNovo });
    (row as any).refreshHistory = history.slice(-20);

    if (existing.length) await db.update(orgProfile).set(row).where(eq(orgProfile.organizationId, params.orgId));
    else await db.insert(orgProfile).values(row);
  }
  return enhancedPlan;
}

/** Anexa as imagens geradas (creativeId + imageUrl) às postIdeas do plano salvo,
 *  para que sobrevivam à navegação (sem precisar regerar). Match por ordem. */
export async function attachCreativesToPostIdeas(orgId: number, creatives: { id: number; imageUrl: string }[]) {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const plan = rows[0]?.planoJson as any;
  if (!plan?.postIdeas?.length) return;
  for (let i = 0; i < Math.min(creatives.length, plan.postIdeas.length); i++) {
    plan.postIdeas[i] = { ...plan.postIdeas[i], creativeId: creatives[i].id, imageUrl: creatives[i].imageUrl };
  }
  await db.update(orgProfile).set({ planoJson: plan }).where(eq(orgProfile.organizationId, orgId));
}

/** Arquiva o plano + radar atuais em archivedPlans[] e ZERA planoJson/radarJson.
 *  Usado quando o cliente regera o diagnóstico para outro perfil. */
export async function archiveCurrentPlan(orgId: number, reason = "user-requested") {
  const db = await getDb();
  if (!db) return { archived: false };
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const row = rows[0];
  if (!row?.planoJson) return { archived: false };
  const currentContext = contextFromPlan(row.planoJson, row);
  const archived: any[] = Array.isArray(row.archivedPlans) ? row.archivedPlans as any[] : [];
  archived.push({
    id: archiveId(), archivedAt: Date.now(), reason,
    nicho: row.nicho ?? undefined, produto: row.produto ?? undefined,
    redes: (row.redes as any) ?? undefined,
    dnaOrganico: (row.dnaOrganico as any) ?? undefined,
    publicoAlvo: (row.publicoAlvo as any) ?? undefined,
    planoJson: row.planoJson, radarJson: row.radarJson ?? undefined,
  });
  // mantém últimos 10 snapshots
  const trimmed = archived.slice(-10);
  await archivePendingForContext(orgId, currentContext, true);
  await db.update(orgProfile).set({ archivedPlans: trimmed as any, planoJson: null as any, radarJson: null as any, resumoDiagnostico: null }).where(eq(orgProfile.organizationId, orgId));
  return { archived: true, totalSnapshots: trimmed.length };
}

/** Lista snapshots arquivados (sem o JSON pesado — só metadados). */
export async function listArchives(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const row = rows[0];
  const normalized = ensureArchiveIds((row?.archivedPlans as any[]) ?? []);
  const archived = normalized.archived;
  if (row && normalized.changed) {
    await db.update(orgProfile).set({ archivedPlans: archived as any }).where(eq(orgProfile.organizationId, orgId));
  }
  return archived.map((a, i) => ({
    id: a.id, index: i, archivedAt: a.archivedAt, reason: a.reason,
    nicho: a.nicho, produto: a.produto,
    handle: a.planoJson?.profile?.handle ?? null,
    summary: a.planoJson?.sumarioExecutivo?.slice(0, 160) ?? null,
    hasRadar: !!a.radarJson,
    postCount: Array.isArray(a.planoJson?.postIdeas) ? a.planoJson.postIdeas.length : 0,
    radarIdeasCount: Array.isArray(a.radarJson?.ideas) ? a.radarJson.ideas.length : 0,
  }));
}

async function deleteProfileArtifacts(orgId: number, context: ReturnType<typeof contextFromPlan>) {
  const db = await getDb();
  if (!db || !context) return { creativesDeleted: 0, experimentsDeleted: 0, approvalsDeleted: 0 };

  const allCreatives = await db.select().from(creatives).where(eq(creatives.organizationId, orgId));
  const scopedCreatives = allCreatives.filter((creative) => creativeMatchesContext(creative, context));
  const creativeIds = scopedCreatives.map((creative) => creative.id).filter(Boolean);
  const experimentIds = new Set<number>();

  for (const creative of scopedCreatives) {
    if (creative.experimentId) experimentIds.add(creative.experimentId);
  }

  if (creativeIds.length) {
    const scopedVariants = await db.select().from(variants).where(inArray(variants.creativeId, creativeIds));
    for (const variant of scopedVariants) experimentIds.add(variant.experimentId);
  }

  const expIds = Array.from(experimentIds).filter(Boolean);
  const approvalIds = new Set<number>();
  if (expIds.length) {
    const experimentApprovals = await db.select().from(approvals)
      .where(and(eq(approvals.organizationId, orgId), eq(approvals.itemType, "experiment"), inArray(approvals.itemId, expIds)));
    for (const approval of experimentApprovals) approvalIds.add(approval.id);
  }
  if (creativeIds.length) {
    const creativeApprovals = await db.select().from(approvals)
      .where(and(eq(approvals.organizationId, orgId), eq(approvals.itemType, "creative"), inArray(approvals.itemId, creativeIds)));
    for (const approval of creativeApprovals) approvalIds.add(approval.id);
  }

  const appIds = Array.from(approvalIds).filter(Boolean);
  if (appIds.length) {
    await db.delete(reviewChecks).where(inArray(reviewChecks.approvalId, appIds));
    await db.delete(approvals).where(inArray(approvals.id, appIds));
  }
  if (expIds.length) {
    await db.delete(variants).where(inArray(variants.experimentId, expIds));
  }
  if (creativeIds.length) {
    await db.delete(variants).where(inArray(variants.creativeId, creativeIds));
  }
  if (expIds.length) {
    await db.delete(experiments).where(and(eq(experiments.organizationId, orgId), inArray(experiments.id, expIds)));
  }
  if (creativeIds.length) {
    await db.delete(creatives).where(and(eq(creatives.organizationId, orgId), inArray(creatives.id, creativeIds)));
  }

  return {
    creativesDeleted: creativeIds.length,
    experimentsDeleted: expIds.length,
    approvalsDeleted: appIds.length,
  };
}

/** Exclui definitivamente um snapshot arquivado e os artefatos ligados ao perfil. */
export async function deleteArchive(orgId: number, id: string) {
  const db = await getDb();
  if (!db) return { ok: false };
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const archived = ensureArchiveIds(((rows[0]?.archivedPlans as any[]) ?? []).slice()).archived;
  const index = archived.findIndex(snap => snap?.id === id);
  if (index < 0) return { ok: false };
  const snap = archived[index];
  const context = contextFromPlan(snap?.planoJson, { ...snap, radarJson: snap?.radarJson });
  const deleted = await deleteProfileArtifacts(orgId, context);
  archived.splice(index, 1);
  await db.update(orgProfile).set({ archivedPlans: archived as any }).where(eq(orgProfile.organizationId, orgId));
  return { ok: true, remaining: archived.length, ...deleted };
}

/** Restaura um snapshot arquivado (volta a ser o plano/radar atuais). */
export async function restoreArchive(orgId: number, id: string) {
  const db = await getDb();
  if (!db) return { ok: false };
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const archived = ensureArchiveIds(((rows[0]?.archivedPlans as any[]) ?? []).slice()).archived;
  const index = archived.findIndex(snap => snap?.id === id);
  const snap = archived[index];
  if (!snap) return { ok: false };
  archived.splice(index, 1);

  const snapPlan = (snap.planoJson as any) ?? null;
  const snapRedes = (snap.redes as any) ?? {};
  const snapHandle = String(snapPlan?.profile?.handle ?? snapRedes?.instagram ?? "").replace(/^@/, "");
  const snapRadar = snap.radarJson
    ? {
        ...(snap.radarJson as any),
        baseHandle: ((snap.radarJson as any).baseHandle ?? snapHandle) || undefined,
        baseProduto: ((snap.radarJson as any).baseProduto ?? snap.produto ?? snapPlan?.produto) || undefined,
      }
    : null;

  // Arquiva o atual antes de restaurar para nao perder o estado vigente.
  if (rows[0]?.planoJson) {
    const currentContext = contextFromPlan(rows[0].planoJson, rows[0]);
    archived.push({
      id: archiveId(), archivedAt: Date.now(), reason: "auto-before-restore",
      nicho: rows[0].nicho ?? undefined, produto: rows[0].produto ?? undefined,
      redes: (rows[0].redes as any) ?? undefined,
      dnaOrganico: (rows[0].dnaOrganico as any) ?? undefined,
      publicoAlvo: (rows[0].publicoAlvo as any) ?? undefined,
      planoJson: rows[0].planoJson, radarJson: rows[0].radarJson ?? undefined,
    });
    await archivePendingForContext(orgId, currentContext, true);
  }

  await db.update(orgProfile).set({
    nicho: snap.nicho ?? null,
    produto: snap.produto ?? null,
    redes: snap.redes ?? null,
    dnaOrganico: (snap as any).dnaOrganico ?? null,
    publicoAlvo: (snap as any).publicoAlvo ?? null,
    planoJson: snapPlan,
    radarJson: snapRadar,
    archivedPlans: archived.slice(-10) as any,
    resumoDiagnostico: snapPlan?.sumarioExecutivo ?? null,
  }).where(eq(orgProfile.organizationId, orgId));
  return { ok: true };
}

export async function recalibrateWithRadar(orgId: number, feedback?: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const row = rows[0];
  const plan = row?.planoJson as any;
  const radar = row?.radarJson as any;
  if (!plan) throw new Error("Faca o diagnostico primeiro");
  if (!radar?.ideas?.length) throw new Error("Gere o Radar de Mercado antes de recalibrar o diagnostico");
  const savedProfile = (row?.dnaOrganico as any)?.perfil;
  const savedHandle = (row?.redes as any)?.instagram;
  const preservedProfile = plan.profile ?? savedProfile ?? (savedHandle ? { handle: String(savedHandle).replace(/^@/, "") } : null);

  const ideas = (radar.ideas as any[]).map((idea, index) => ({
    index,
    titulo: idea.titulo,
    gancho: idea.gancho,
    copy: idea.copy,
    formato: idea.formato,
    opportunityTitle: idea.opportunityTitle,
    patternTitle: idea.patternTitle,
    priorityScore: idea.priorityScore,
    fonte: idea.fonte,
    decision: idea.diagnosisDecision ?? "agent",
    userFeedback: idea.diagnosisFeedback ?? "",
  }));
  const explicitUse = ideas.filter(i => i.decision === "use");
  const explicitSkip = ideas.filter(i => i.decision === "skip");
  const undecided = ideas.filter(i => i.decision === "agent");

  const fallbackSelected = (explicitUse.length ? explicitUse : [...undecided].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0)).slice(0, 2));
  let patch: any = {
    radarContribuicoes: {
      recalibratedAt: Date.now(),
      feedback: feedback?.trim() || "",
      resumo: "O Agente Especialista priorizou os sinais do Radar que melhor reforcam o plano atual.",
      recomendacao: "Use as ideias aprovadas como complemento do diagnostico e descarte as rejeitadas para manter foco.",
      ideias: fallbackSelected.map(i => ({
        index: i.index,
        status: "use",
        reason: i.decision === "use" ? "Marcada pelo usuario para entrar no diagnostico." : "Escolhida pelo Agente Especialista por aderencia e prioridade.",
      })),
    },
  };

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const content = await openRouterChat([
        {
          role: "system",
          content: `Voce e o Agente Especialista da Cacarejar. Recalibre um diagnostico existente usando as escolhas do usuario e o Radar de Mercado.
Use sempre o termo Agente ou Agente autonomo. Nunca use rotulos genericos de modelos generativos nas respostas ao usuario. Respeite escolhas explicitas:
- decision "use": precisa entrar no diagnostico.
- decision "skip": precisa ficar fora.
- decision "agent": voce decide se entra ou nao.
Retorne SOMENTE JSON valido:
{
 "sumarioExecutivo": string,
 "objetivoPrincipal": string,
 "pilaresEstrategicos": [{"titulo":string,"objetivo":string,"acoes":[{"acao":string,"detalhe":string}]}],
 "cronograma": [{"periodo":string,"foco":string,"meta":string}],
 "conclusao": string,
 "oportunidades": [string],
 "radarContribuicoes": {
   "resumo": string,
   "recomendacao": string,
   "ideias": [{"index":number,"status":"use"|"skip","reason":string}]
 }
}
Atualize plano, cronograma e conclusao para refletir o Radar, sem destruir a estrategia original.`,
        },
        {
          role: "user",
          content: `DIAGNOSTICO ATUAL:
${JSON.stringify({
  produto: plan.produto,
  nicho: plan.nicho,
  sumarioExecutivo: plan.sumarioExecutivo,
  objetivoPrincipal: plan.objetivoPrincipal,
  pilaresEstrategicos: plan.pilaresEstrategicos,
  cronograma: plan.cronograma,
  conclusao: plan.conclusao,
  oportunidades: plan.oportunidades,
})}

RADAR:
${JSON.stringify({
  marketSummary: radar.marketSummary,
  patterns: radar.patterns,
  opportunities: radar.opportunities,
  ideas,
  explicitUse,
  explicitSkip,
  undecided,
})}

OBSERVACAO DO USUARIO:
${feedback?.trim() || "(sem observacao)"}`,
        },
      ], { model: BRAIN, temperature: 0.45, maxTokens: 7000 });
      const parsed = parseJson<any>(content);
      if (parsed?.radarContribuicoes?.ideias?.length) {
        patch = {
          ...(typeof parsed.sumarioExecutivo === "string" ? { sumarioExecutivo: parsed.sumarioExecutivo } : {}),
          ...(typeof parsed.objetivoPrincipal === "string" ? { objetivoPrincipal: parsed.objetivoPrincipal } : {}),
          ...(Array.isArray(parsed.pilaresEstrategicos) ? { pilaresEstrategicos: parsed.pilaresEstrategicos } : {}),
          ...(Array.isArray(parsed.cronograma) ? { cronograma: parsed.cronograma } : {}),
          ...(typeof parsed.conclusao === "string" ? { conclusao: parsed.conclusao } : {}),
          ...(Array.isArray(parsed.oportunidades) ? { oportunidades: parsed.oportunidades } : {}),
          radarContribuicoes: {
            ...parsed.radarContribuicoes,
            recalibratedAt: Date.now(),
            feedback: feedback?.trim() || "",
          },
        };
      }
    } catch (e) {
      console.error("[diagnosis] recalibrateWithRadar falhou:", (e as any)?.message);
    }
  }

  const contributionIdeas = [...(patch.radarContribuicoes?.ideias ?? [])];
  for (const idea of explicitUse) {
    const existing = contributionIdeas.find((i: any) => i.index === idea.index);
    if (existing) existing.status = "use";
    else contributionIdeas.push({ index: idea.index, status: "use", reason: "Marcada pelo usuario para entrar no diagnostico." });
  }
  for (const idea of explicitSkip) {
    const existing = contributionIdeas.find((i: any) => i.index === idea.index);
    if (existing) existing.status = "skip";
    else contributionIdeas.push({ index: idea.index, status: "skip", reason: "Marcada pelo usuario para nao entrar no diagnostico." });
  }
  patch.radarContribuicoes = { ...patch.radarContribuicoes, ideias: contributionIdeas };

  const selectedIndexes = new Set(contributionIdeas.filter((i: any) => i.status === "use").map((i: any) => i.index));
  const reasons = new Map(contributionIdeas.map((i: any) => [i.index, i.reason]));
  radar.ideas = radar.ideas.map((idea: any, index: number) => ({
    ...idea,
    diagnosisDecision: idea.diagnosisDecision === "skip" ? "skip" : selectedIndexes.has(index) ? "use" : (idea.diagnosisDecision ?? "agent"),
    diagnosisReason: reasons.get(index) ?? idea.diagnosisReason,
    diagnosisDecidedAt: Date.now(),
  }));

  const nextPlanRaw = {
    ...plan,
    ...patch,
    radarContribuicoes: patch.radarContribuicoes,
    produto: plan.produto,
    nicho: plan.nicho,
    lente: plan.lente,
    profile: preservedProfile,
    perfilLido: plan.perfilLido ?? !!preservedProfile,
    brandDNA: plan.brandDNA,
    postIdeas: plan.postIdeas,
    analiseTopPosts: plan.analiseTopPosts,
  };
  const nextPlan = enhancePlanV2(nextPlanRaw as CacaPlan, (row?.redes as any) ?? plan.redes ?? {}, radar);
  nextPlan.interessesPosts = inferPostInterests(nextPlan, preservedProfile, radar);
  await db.update(orgProfile).set({
    planoJson: nextPlan as any,
    radarJson: radar as any,
    resumoDiagnostico: nextPlan.sumarioExecutivo ?? plan.sumarioExecutivo ?? null,
  }).where(eq(orgProfile.organizationId, orgId));
  return nextPlan;
}

export async function getPlan(orgId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  if (!rows.length) return null;
  const row = rows[0] as any;
  const plan = row.planoJson as any;
  if (!plan) return null;
  const savedHandle = String(row.redes?.instagram ?? "").replace(/^@/, "");
  if (!plan.linkedin && row.redes?.linkedin) {
    plan.linkedin = row.redes.linkedin;
  }
  const savedProfileRaw = row.dnaOrganico?.perfil;
  const savedProfileHandle = String(savedProfileRaw?.handle ?? "").replace(/^@/, "");
  const savedProfile = !savedProfileRaw || !savedHandle || !savedProfileHandle || savedProfileHandle === savedHandle
    ? savedProfileRaw
    : null;
  if (!plan.profile && (savedProfile || savedHandle)) {
    const healed = {
      ...plan,
      profile: savedProfile ?? { handle: savedHandle },
      perfilLido: plan.perfilLido ?? !!savedProfile,
      produto: plan.produto ?? row.produto,
      nicho: plan.nicho ?? row.nicho,
    };
    if (!Array.isArray(healed.interessesPosts) || !healed.interessesPosts.length) {
      healed.interessesPosts = inferPostInterests(healed, savedProfile ?? healed.profile, row.radarJson);
    }
    const enhanced = enhancePlanV2(healed as CacaPlan, row.redes ?? {}, row.radarJson);
    await db.update(orgProfile).set({ planoJson: enhanced as any }).where(eq(orgProfile.organizationId, orgId));
    return enhanced as unknown as CacaPlan;
  }
  const planHasLinkedin = (plan.prescricoesPorCanal ?? []).some((p: any) => /linkedin/i.test(p?.canal || ""));
  if (!Array.isArray(plan.interessesPosts) || !plan.interessesPosts.length || !plan.prescricoesPorCanal?.length || !plan.cronogramaMulticanal?.length || !plan.plano7Dias?.length || !plan.motorOrganico || !plan.campanhaAssistida || !plan.acompanhamento || !plan.canais360?.canais?.length || planHasLinkedin) {
    plan.interessesPosts = inferPostInterests(plan, plan.profile ?? savedProfile, row.radarJson);
    const enhanced = enhancePlanV2(plan as CacaPlan, row.redes ?? {}, row.radarJson);
    await db.update(orgProfile).set({ planoJson: enhanced as any }).where(eq(orgProfile.organizationId, orgId));
    return enhanced as unknown as CacaPlan;
  }
  return plan as unknown as CacaPlan | null;
}

export async function updateAcompanhamento(orgId: number, acompanhamentoPatch: any, feedback?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponivel");
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const row = rows[0];
  const plan = row?.planoJson as unknown as CacaPlan | undefined;
  if (!plan) throw new Error("Faca o diagnostico primeiro");

  const current: any = plan.acompanhamento ?? buildPlanner(plan);
  const next = {
    ...current,
    ...(acompanhamentoPatch ?? {}),
    updatedAt: Date.now(),
  };
  const weeks = Array.isArray(next.semanas) ? next.semanas : [];
  const items = weeks.flatMap((w: any) => Array.isArray(w.itens) ? w.itens : []);
  const done = items.filter((it: any) => it.status === "done").length;
  const total = items.length || current.conteudos?.total || 1;
  const patchConteudos = acompanhamentoPatch?.conteudos ?? {};
  const hasManualProgress = typeof acompanhamentoPatch?.progresso === "number";
  const hasManualDone = typeof patchConteudos?.feitos === "number";
  const computedProgress = Math.round((done / total) * 100);
  const manualDone = hasManualDone ? Math.max(0, Math.min(total, Math.round(patchConteudos.feitos))) : undefined;
  const manualProgress = hasManualProgress ? Math.max(0, Math.min(100, Math.round(acompanhamentoPatch.progresso))) : undefined;
  const shouldUseManual = (hasManualProgress || hasManualDone) && done === 0;
  next.progresso = shouldUseManual ? (manualProgress ?? Math.round(((manualDone ?? 0) / total) * 100)) : computedProgress;
  next.conteudos = { total, feitos: shouldUseManual ? (manualDone ?? Math.round((next.progresso / 100) * total)) : done };
  if (feedback?.trim()) {
    next.feedbacks = [
      ...((current as any).feedbacks ?? []),
      { at: Date.now(), texto: feedback.trim() },
    ].slice(-12);
    next.novaPrescricao = `Feedback registrado: ${truncate(feedback.trim(), 180)}. Recalcule o diagnostico com esse contexto quando quiser ajustar a rota.`;
  }
  const shouldSnapshot = !!feedback?.trim() || next.progresso !== current.progresso || done !== current.conteudos?.feitos;
  if (shouldSnapshot) {
    const label = `Check-in ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
    const clarity = Math.min(100, 45 + Math.round(next.progresso * 0.35));
    const consistency = Math.min(100, 35 + Math.round((done / Math.max(1, total)) * 55));
    const authority = Math.min(100, 40 + Math.round(done * 3.5));
    const snapshot = {
      label,
      resumo: feedback?.trim()
        ? truncate(feedback.trim(), 260)
        : `${done} de ${total} acoes marcadas como feitas no planner.`,
      scores: [
        { nome: "Clareza de posicionamento", valor: clarity },
        { nome: "Consistencia por canal", valor: consistency },
        { nome: "Base de autoridade", valor: authority },
      ],
    };
    const snapshots = Array.isArray(next.snapshots) ? next.snapshots : [];
    next.snapshots = [...snapshots, snapshot].slice(-6);
  }

  const updatedPlan = enhancePlanV2({ ...plan, acompanhamento: next }, row.redes ?? {}, row.radarJson);
  await db.update(orgProfile).set({ planoJson: updatedPlan as any }).where(eq(orgProfile.organizationId, orgId));
  return updatedPlan;
}

export async function updateSevenDayPlanItem(orgId: number, index: number, patch: Partial<WeeklyContentPlanItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponivel");
  const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  const row = rows[0];
  const plan = row?.planoJson as unknown as CacaPlan | undefined;
  if (!plan) throw new Error("Faca o diagnostico primeiro");
  const items = Array.isArray(plan.plano7Dias) && plan.plano7Dias.length ? [...plan.plano7Dias] : buildSevenDayPlan(plan, row.radarJson) ?? [];
  if (index < 0 || index >= items.length) throw new Error("Item do plano nao encontrado");

  const current = items[index];
  const cleanResult = patch.resultado
    ? {
        ...(current.resultado ?? {}),
        ...patch.resultado,
        registradoEm: Date.now(),
      }
    : current.resultado;
  items[index] = {
    ...current,
    ...patch,
    resultado: cleanResult,
  };

  const publishedOrMeasured = items.filter(i => i.status === "publicado" || i.status === "medir" || i.resultado).length;
  const acompanhamento = (plan.acompanhamento ?? buildPlanner(plan)) as any;
  const nextAcompanhamento = {
    ...acompanhamento,
    updatedAt: Date.now(),
    progresso: Math.round((publishedOrMeasured / Math.max(1, items.length)) * 100),
    conteudos: { total: items.length, feitos: publishedOrMeasured },
    proximoFoco: items.find(i => i.status === "ideia" || i.status === "em_edicao")?.dia ?? "Revisar aprendizado semanal",
    novaPrescricao: "Plano de 7 dias atualizado. Registre resultados reais para recalibrar a proxima semana.",
  };
  const updatedPlan = enhancePlanV2({
    ...plan,
    plano7Dias: items,
    acompanhamento: nextAcompanhamento as any,
    aprendizadoSemanal: buildWeeklyLearning(items),
  }, row.redes ?? {}, row.radarJson);
  await db.update(orgProfile).set({ planoJson: updatedPlan as any }).where(eq(orgProfile.organizationId, orgId));
  return updatedPlan;
}

export function readingEnabled() { return profileReadingEnabled(); }
