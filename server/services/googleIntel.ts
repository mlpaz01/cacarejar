/**
 * Inteligência de Google (SEO) — Sprint 3 (versão grátis).
 * Puxa as buscas REAIS que as pessoas digitam no Google (autocomplete/Suggest) sobre o nicho
 * e transforma em pautas de conteúdo/SEO com Agentes. Sem credenciais, sem custo.
 * (O volume/dificuldade via DataForSEO entra depois, quando houver conta paga.)
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orgProfile } from "../../drizzle/schema";
import { openRouterChat, ContentPart } from "../openrouter";

const BRAIN = "anthropic/claude-sonnet-4.6";

export interface GoogleTerm {
  termo: string;
  volume?: number;       // buscas/mês (só com DataForSEO)
  cpc?: number;          // custo por clique estimado (só com DataForSEO)
  competicao?: string;   // LOW | MEDIUM | HIGH (só com DataForSEO)
}
export interface GoogleIntel {
  termo: string;
  scannedAt: number;
  fonteVolume: "dataforseo" | "nenhuma";  // de onde veio o volume (se veio)
  termos: GoogleTerm[];  // sugestões reais (não-pergunta), com volume quando disponível
  perguntas: string[];   // sugestões em forma de pergunta
  ideiasConteudo: { titulo: string; tipo: string }[];
}

function cleanKeyword(s: string): string {
  return (s || "").replace(/[,;].*$/, "").trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 60);
}

const QUESTION_RE = /^(como|qual|quais|quanto|quantos|quantas|onde|quando|por que|porque|o que|pra que|para que|vale a pena|quem)\b/i;

async function suggestOnce(q: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt&gl=br&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CacarejarBot/1.0)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

/** Busca autocomplete real do Google para a palavra-chave + alguns modificadores de intenção. */
export async function fetchGoogleSuggest(keyword: string): Promise<string[]> {
  const kw = cleanKeyword(keyword);
  if (!kw) return [];
  const seeds = [kw, `como ${kw}`, `melhor ${kw}`, `${kw} preço`, `${kw} vale a pena`, `${kw} perto de mim`, `${kw} para`];
  const results = await Promise.all(seeds.map(suggestOnce));
  const flat = results.flat().map(s => String(s).trim()).filter(Boolean);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const s of flat) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(s);
  }
  return uniq.slice(0, 40);
}

async function generateContentIdeas(keyword: string, termos: string[], perguntas: string[]): Promise<{ titulo: string; tipo: string }[]> {
  if (!process.env.OPENROUTER_API_KEY || (!termos.length && !perguntas.length)) return [];
  const prompt = `Voce e especialista em SEO e conteudo. Abaixo estao buscas REAIS que pessoas digitam no Google (autocomplete) sobre "${keyword}", no Brasil.
Gere SOMENTE JSON no formato {"ideias":[{"titulo":string,"tipo":string}]} com 5 a 6 pautas de conteudo/SEO que capturam essas intencoes de busca. "tipo" deve ser um de: "Artigo SEO", "FAQ", "Pagina de venda", "Video/Reels". Titulos prontos para publicar, especificos e em portugues do Brasil. Priorize as buscas com intencao de compra.
BUSCAS (termos): ${termos.slice(0, 20).join("; ")}
BUSCAS (perguntas): ${perguntas.slice(0, 15).join("; ")}`;
  try {
    const parts: ContentPart[] = [{ type: "text", text: prompt }];
    const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.5, maxTokens: 900 });
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
    return Array.isArray(parsed?.ideias) ? parsed.ideias.slice(0, 8) : [];
  } catch {
    return [];
  }
}

/** Volume de busca real via DataForSEO (opcional). Só roda se DATAFORSEO_LOGIN/PASSWORD existirem no .env.
 *  Sem credenciais → retorna mapa vazio (a feature degrada para só termos, sem números). */
async function fetchSearchVolume(keywords: string[]): Promise<Map<string, { volume: number; cpc?: number; competicao?: string }>> {
  const out = new Map<string, { volume: number; cpc?: number; competicao?: string }>();
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  const list = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean))).slice(0, 100);
  if (!login || !password || !list.length) return out;
  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const body = [{ keywords: list, language_code: "pt", location_code: 2076 }]; // 2076 = Brasil (Google Ads)
    const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return out;
    const data = (await res.json()) as any;
    const items = data?.tasks?.[0]?.result ?? [];
    for (const it of items) {
      if (it?.keyword) {
        out.set(String(it.keyword).toLowerCase(), {
          volume: typeof it.search_volume === "number" ? it.search_volume : 0,
          cpc: typeof it.cpc === "number" ? it.cpc : undefined,
          competicao: it.competition ?? it.competition_level ?? undefined,
        });
      }
    }
    return out;
  } catch {
    return out;
  }
}

/** Escaneia o que o público pesquisa no Google + gera pautas, persiste no planoJson. */
export async function scanGoogleIntel(orgId: number, params: { query?: string } = {}): Promise<GoogleIntel> {
  const db = await getDb();
  let row: any = null;
  let plan: any = null;
  let keyword = cleanKeyword(params.query || "");
  if (db) {
    const rows = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
    row = rows[0];
    plan = row?.planoJson;
    if (!keyword) keyword = cleanKeyword(plan?.produto || row?.produto || plan?.nicho || row?.nicho || "");
  }
  if (!keyword) throw new Error("Rode um diagnostico primeiro ou informe uma palavra-chave para o Google.");

  const all = await fetchGoogleSuggest(keyword);
  const perguntas = all.filter(s => QUESTION_RE.test(s));
  const termosRaw = all.filter(s => !QUESTION_RE.test(s)).slice(0, 24);
  const ideiasConteudo = await generateContentIdeas(keyword, termosRaw, perguntas);
  const volMap = await fetchSearchVolume([keyword, ...termosRaw]);
  const fonteVolume: GoogleIntel["fonteVolume"] = volMap.size ? "dataforseo" : "nenhuma";
  let termos: GoogleTerm[] = termosRaw.map(t => {
    const v = volMap.get(t.toLowerCase());
    return { termo: t, volume: v?.volume, cpc: v?.cpc, competicao: v?.competicao };
  });
  if (fonteVolume === "dataforseo") termos = termos.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
  const scannedAt = Date.now();
  const result: GoogleIntel = {
    termo: keyword,
    scannedAt,
    fonteVolume,
    termos,
    perguntas: perguntas.slice(0, 16),
    ideiasConteudo,
  };

  if (db && row && plan) {
    const nextPlan = { ...plan, googleSEO: result };
    await db.update(orgProfile).set({ planoJson: nextPlan }).where(eq(orgProfile.organizationId, orgId));
  }
  return result;
}
