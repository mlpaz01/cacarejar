/**
 * Espião de Anúncios — lê anúncios REAIS de concorrentes na Biblioteca de Anúncios da Meta
 * (Facebook/Instagram) via Apify (actor curious_coder/facebook-ads-library-scraper).
 * Sinal-chave: anúncio ATIVO há muitos dias = provável vencedor (lucrativo).
 * Gera insights com Agentes (ângulos, ofertas, formatos) para municiar o diagnóstico.
 * Requer APIFY_TOKEN. Sem token → retorna vazio (falha graciosa).
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orgProfile } from "../../drizzle/schema";
import { openRouterChat, ContentPart } from "../openrouter";
import { localizeRemoteImage } from "./profileProvider";

const AD_ACTOR = "curious_coder~facebook-ads-library-scraper";
const BRAIN = "anthropic/claude-sonnet-4.6";

export interface CompetitorAd {
  advertiser: string;
  pageCategory?: string;
  pageLikes?: number;
  text: string;
  title?: string;
  cta?: string;
  linkUrl?: string;
  thumb?: string;        // imagem de preview (localizada no nosso domínio)
  format?: string;       // VIDEO | IMAGE | DCO | ...
  platforms: string[];   // FACEBOOK | INSTAGRAM | ...
  active: boolean;
  startDate?: string;    // ISO
  runningDays?: number;  // dias rodando (se ativo) — quanto maior, mais provável vencedor
  adLibraryUrl?: string;
}

export interface AdSpyResult {
  query: string;
  scannedAt: number;
  ads: CompetitorAd[];
  insights: { titulo: string; detalhe: string }[];
}

function cleanKeyword(s: string): string {
  return (s || "").replace(/[,;].*$/, "").trim().split(/\s+/).slice(0, 4).join(" ").slice(0, 60);
}

function epochToISO(e?: number): string | undefined {
  if (!e || typeof e !== "number") return undefined;
  try { return new Date(e * 1000).toISOString(); } catch { return undefined; }
}

function pickThumb(snap: any): string | undefined {
  const img = (snap?.images ?? [])[0];
  const fromImg = img?.original_image_url || img?.resized_image_url;
  if (fromImg) return fromImg;
  const vid = (snap?.videos ?? [])[0];
  if (vid?.video_preview_image_url) return vid.video_preview_image_url;
  const card = (snap?.cards ?? [])[0];
  return card?.original_image_url || card?.resized_image_url || card?.video_preview_image_url || undefined;
}

function mapAd(item: any): CompetitorAd | null {
  if (!item) return null;
  const snap = item.snapshot ?? {};
  const card0 = (snap.cards ?? [])[0];
  const text = snap?.body?.text || card0?.body?.text || card0?.body || snap?.title || "";
  const advertiser = snap?.page_name || item?.page_name || "Anunciante";
  const thumb = pickThumb(snap);
  if (!text && !thumb) return null;
  const start = item?.start_date;
  const active = !!item?.is_active;
  let runningDays: number | undefined;
  if (active && typeof start === "number") {
    runningDays = Math.max(0, Math.round((Date.now() / 1000 - start) / 86400));
  }
  return {
    advertiser,
    pageCategory: (snap?.page_categories ?? [])[0],
    pageLikes: typeof snap?.page_like_count === "number" ? snap.page_like_count : undefined,
    text: String(text).replace(/\s+/g, " ").trim().slice(0, 600),
    title: snap?.title || undefined,
    cta: snap?.cta_text || card0?.cta_text || undefined,
    linkUrl: snap?.link_url || card0?.link_url || undefined,
    thumb,
    format: snap?.display_format || undefined,
    platforms: Array.isArray(item?.publisher_platform) ? item.publisher_platform : [],
    active,
    startDate: epochToISO(start),
    runningDays,
    adLibraryUrl: item?.ad_library_url || item?.url || undefined,
  };
}

/** Busca anúncios de concorrentes por palavra-chave na Biblioteca de Anúncios da Meta (país BR). */
export async function fetchCompetitorAds(keyword: string, opts: { country?: string; count?: number } = {}): Promise<CompetitorAd[]> {
  const token = process.env.APIFY_TOKEN;
  const kw = cleanKeyword(keyword);
  if (!token || !kw) return [];
  const country = opts.country || "BR";
  const count = Math.max(10, opts.count ?? 16); // actor exige mínimo 10
  const libUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=${country}&q=${encodeURIComponent(kw)}&search_type=keyword_unordered&media_type=all`;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${AD_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=220`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [{ url: libUrl }], count }),
      }
    );
    if (!res.ok) return [];
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) return [];
    const ads = items.map(mapAd).filter(Boolean) as CompetitorAd[];
    // dedup por anunciante + início do texto
    const seen = new Set<string>();
    const uniq = ads.filter(a => {
      const k = (a.advertiser + "|" + a.text.slice(0, 40)).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // ativos há mais tempo primeiro (provável vencedor)
    uniq.sort((a, b) => (b.runningDays ?? -1) - (a.runningDays ?? -1));
    return uniq.slice(0, 12);
  } catch {
    return [];
  }
}

/** Insights dos Agentes sobre o conjunto de anúncios (ângulos, ofertas, formatos, o que fazer diferente). */
async function generateInsights(keyword: string, ads: CompetitorAd[]): Promise<{ titulo: string; detalhe: string }[]> {
  if (!process.env.OPENROUTER_API_KEY || !ads.length) return [];
  const lines = ads.slice(0, 12).map((a, i) =>
    `${i + 1}. [${a.advertiser}${a.runningDays != null ? ` · ativo ha ${a.runningDays}d` : ""}${a.format ? ` · ${a.format}` : ""}] CTA:${a.cta || "-"} | ${a.text.slice(0, 180)}`
  ).join("\n");
  const prompt = `Voce e estrategista de trafego pago. Abaixo estao anuncios REAIS de concorrentes no nicho "${keyword}" (Biblioteca de Anuncios da Meta, Brasil). Anuncios "ativos ha muitos dias" tendem a ser vencedores (provavelmente lucrativos, por isso seguem no ar).
Analise e devolva SOMENTE JSON no formato {"insights":[{"titulo":string,"detalhe":string}]} com 4 a 5 itens cobrindo:
- angulos/ganchos que mais se repetem
- ofertas e CTAs mais usados
- formatos predominantes (video, imagem, carrossel)
- o que provavelmente esta funcionando (priorize os que rodam ha mais tempo)
- 1 recomendacao concreta do que VOCE pode fazer DIFERENTE para se destacar
Seja especifico, pratico e direto, em portugues do Brasil. "titulo" curto (ate 6 palavras); "detalhe" 1-2 frases.
ANUNCIOS:
${lines}`;
  try {
    const parts: ContentPart[] = [{ type: "text", text: prompt }];
    const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.5, maxTokens: 1100 });
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
    return Array.isArray(parsed?.insights) ? parsed.insights.slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Escaneia anúncios de concorrentes + insights, persiste no planoJson e devolve ao cliente. */
export async function scanAdSpy(orgId: number, params: { query?: string } = {}): Promise<AdSpyResult> {
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
  if (!keyword) throw new Error("Rode um diagnostico primeiro ou informe uma palavra-chave para o Espiao de Anuncios.");

  const ads = await fetchCompetitorAds(keyword, { country: "BR", count: 16 });
  // localiza thumbs (CDN da Meta bloqueia hotlink)
  await Promise.all(ads.map(async (a, i) => { a.thumb = await localizeRemoteImage(a.thumb, `ad${i}`); }));
  const insights = await generateInsights(keyword, ads);
  const scannedAt = Date.now();

  if (db && row && plan) {
    const nextPlan = { ...plan, anunciosConcorrentes: ads, anunciosInsights: insights, anunciosQuery: keyword, anunciosScannedAt: scannedAt };
    await db.update(orgProfile).set({ planoJson: nextPlan }).where(eq(orgProfile.organizationId, orgId));
  }
  return { query: keyword, scannedAt, ads, insights };
}
