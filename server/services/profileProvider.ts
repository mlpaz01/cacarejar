/**
 * ProfileProvider — leitura de perfil público de redes sociais.
 * O Instagram bloqueia leitura anônima do servidor (require_login), então usamos
 * um provedor de scraping (Apify) quando o token estiver configurado.
 * Sem token → retorna null (a análise segue só com o texto informado pelo cliente).
 */

export interface SocialPost {
  caption: string;
  likes: number;
  comments: number;
  img?: string;   // imagem do post (displayUrl)
  url?: string;   // permalink
  timestamp?: string;
}
export interface SocialProfile {
  network: "instagram" | "tiktok";
  handle: string;
  fullName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  category?: string;
  profilePic?: string;
  verified?: boolean;
  posts: SocialPost[];
  topPosts: SocialPost[];     // 3 melhores por engajamento
  engajamentoPct?: number;    // (média likes+coment / seguidores) * 100
  avgLikes?: number;
  source: string;
}

function cleanHandle(h: string): string {
  return (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
}

/** Baixa uma imagem remota (CDN do IG bloqueia hotlink) e devolve URL local absoluta. */
async function localizeImage(remoteUrl: string | undefined, tag: string): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { nanoid } = await import("nanoid");
    const res = await fetch(remoteUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return remoteUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = `ig_${tag}_${nanoid(8)}.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);
    const base = process.env.PUBLIC_URL || "https://cacarejar.com.br";
    return `${base}/uploads/${file}`;
  } catch {
    return remoteUrl;
  }
}

/** Mapeia um item bruto do Apify para SocialProfile (SEM localizar imagens). */
function mapProfileItem(p: any, fallbackHandle?: string): SocialProfile | null {
  if (!p) return null;
  const handle = p.username ?? fallbackHandle;
  if (!handle) return null;
  const posts: SocialPost[] = (p.latestPosts ?? []).slice(0, 12).map((x: any) => ({
    caption: x.caption ?? "",
    likes: x.likesCount ?? 0,
    comments: x.commentsCount ?? 0,
    img: x.displayUrl ?? x.images?.[0] ?? undefined,
    url: x.url ?? undefined,
    timestamp: x.timestamp ?? undefined,
  }));
  const followers = p.followersCount ?? 0;
  const topPosts = posts.slice().sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments)).slice(0, 3);
  const avgEng = posts.length ? posts.reduce((s, x) => s + x.likes + x.comments, 0) / posts.length : 0;
  const avgLikes = posts.length ? Math.round(posts.reduce((s, x) => s + x.likes, 0) / posts.length) : 0;
  return {
    network: "instagram", handle, fullName: p.fullName, bio: p.biography,
    followers, following: p.followsCount, postsCount: p.postsCount,
    category: p.businessCategoryName, profilePic: p.profilePicUrlHD ?? p.profilePicUrl,
    verified: p.verified, posts, topPosts,
    engajamentoPct: followers > 0 ? +((avgEng / followers) * 100).toFixed(2) : undefined,
    avgLikes, source: "apify",
  };
}

/** Localiza (baixa) as imagens visíveis do perfil (top posts + avatar) para servir do nosso domínio. */
async function localizeProfile(profile: SocialProfile): Promise<SocialProfile> {
  await Promise.all((profile.topPosts ?? []).map(async (tp, i) => { tp.img = await localizeImage(tp.img, `post${i}`); }));
  profile.profilePic = await localizeImage(profile.profilePic, `avatar`);
  return profile;
}

/** Instagram via Apify (apify/instagram-profile-scraper). Requer APIFY_TOKEN. */
async function fetchInstagramApify(handle: string): Promise<SocialProfile | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  const user = cleanHandle(handle);
  if (!user) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [user] }) }
    );
    if (!res.ok) return null;
    const items = (await res.json()) as any[];
    const profile = mapProfileItem(items?.[0], user);
    if (!profile) return null;
    return localizeProfile(profile);
  } catch {
    return null;
  }
}

/** Raspa um perfil avulso por @handle (para o Radar de Mercado). */
export async function fetchInstagramProfile(handle: string): Promise<SocialProfile | null> {
  return fetchInstagramApify(handle);
}

/** Raspa VÁRIOS perfis numa única chamada (mais barato e estável). Pula os que vierem
 *  vazios (sem posts) — contas muito grandes às vezes bloqueiam. NÃO localiza imagens
 *  (o Radar localiza só os hits selecionados, pra economizar). */
export async function fetchInstagramProfilesBatch(handles: string[]): Promise<SocialProfile[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token || !handles.length) return [];
  const users = [...new Set(handles.map(cleanHandle).filter(Boolean))].slice(0, 12);
  if (!users.length) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: users }) }
    );
    if (!res.ok) return [];
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) return [];
    const out: SocialProfile[] = [];
    for (const it of items) {
      const prof = mapProfileItem(it);
      if (prof && (prof.posts?.length ?? 0) > 0) out.push(prof); // só os que realmente raspou
    }
    return out;
  } catch {
    return [];
  }
}

/** Localiza (baixa) uma imagem remota e devolve URL do nosso domínio. Reuso para o Radar. */
export async function localizeRemoteImage(url: string | undefined, tag = "img"): Promise<string | undefined> {
  return localizeImage(url, tag);
}

export interface HotPost {
  caption: string;
  likes: number;
  comments: number;
  img?: string;
  url?: string;
  timestamp?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  type?: string;
}

/** Descobre posts do nicho por hashtag (Apify instagram-hashtag-scraper). Retorna posts recentes
 *  com o @ do autor — usado para DESCOBRIR perfis ativos no setor (depois raspamos os top posts deles). */
export async function fetchHotPostsByHashtag(hashtags: string[], limit = 30): Promise<HotPost[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token || !hashtags.length) return [];
  const tags = hashtags.map(h => h.replace(/^#/, "").trim()).filter(Boolean).slice(0, 4);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtags: tags, resultsType: "posts", resultsLimit: limit }),
      }
    );
    if (!res.ok) return [];
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) return [];
    return items.map(x => ({
      caption: x.caption ?? "",
      likes: x.likesCount ?? 0,
      comments: x.commentsCount ?? 0,
      img: x.displayUrl ?? x.images?.[0] ?? undefined,
      url: x.url ?? undefined,
      timestamp: x.timestamp ?? undefined,
      ownerUsername: x.ownerUsername ?? undefined,
      ownerFullName: x.ownerFullName ?? undefined,
      type: x.type ?? undefined,
    }));
  } catch {
    return [];
  }
}

/** Tenta ler o perfil das redes informadas. Hoje: Instagram via Apify. */
export async function fetchProfile(redes: Record<string, string>): Promise<SocialProfile | null> {
  if (redes?.instagram) {
    const ig = await fetchInstagramApify(redes.instagram);
    if (ig) return ig;
  }
  // TikTok/LinkedIn: adicionar provider quando necessário.
  return null;
}

/** Está habilitada a leitura real de perfil? (para a UI orientar o usuário) */
export function profileReadingEnabled(): boolean {
  return !!process.env.APIFY_TOKEN;
}

// ─────────────────────── Site (página de vendas / landing) ───────────────────────
export interface SiteSnapshot {
  url: string;
  title?: string;
  description?: string;
  ogImage?: string;        // já localizada (URL do nosso domínio)
  h1?: string;
  excerpt?: string;        // primeiros parágrafos relevantes
  source: "site";
}

function normalizeUrl(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  return s;
}

function pick(html: string, re: RegExp): string | undefined {
  const m = html.match(re);
  return m ? m[1].replace(/\s+/g, " ").trim() : undefined;
}

/** Faz fetch da página, extrai title/description/og:image/h1 + texto relevante.
 *  Não usa headless — só HTML estático. Bom o bastante para landing pages. */
export async function fetchSite(rawUrl: string): Promise<SiteSnapshot | null> {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CacarejarBot/1.0)", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) return { url, source: "site" };
    const html = await res.text();

    const title = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      ?? pick(html, /<title[^>]*>([^<]+)<\/title>/i);
    const description = pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      ?? pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const rawOg = pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? pick(html, /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
    const h1 = pick(html, /<h1[^>]*>([^<]+)<\/h1>/i);

    // Resolve URL relativa da og:image
    let ogAbs: string | undefined;
    if (rawOg) {
      try { ogAbs = new URL(rawOg, url).toString(); } catch { ogAbs = rawOg; }
    }

    // Texto: pega <p>...</p> e <h2>...</h2> em ordem, limpa tags
    const textChunks: string[] = [];
    const regex = /<(p|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) && textChunks.length < 30) {
      const txt = m[2].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
      if (txt.length >= 30) textChunks.push(txt);
    }
    const excerpt = textChunks.slice(0, 8).join(" · ").slice(0, 1500);

    const ogImage = await localizeImage(ogAbs, "site");
    return { url, title, description, ogImage, h1, excerpt, source: "site" };
  } catch {
    return { url, source: "site" };
  }
}
