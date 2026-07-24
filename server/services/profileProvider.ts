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
  shares?: number;
  views?: number;
  img?: string;   // imagem do post (displayUrl)
  url?: string;   // permalink
  timestamp?: string;
  type?: string;
}
export interface SocialProfile {
  network: "instagram" | "tiktok" | "facebook";
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
  relatedProfiles?: {
    handle: string;
    fullName?: string;
    profilePic?: string;
    verified?: boolean;
  }[];
  source: string;
}

function warnDataQuality(event: string, details: Record<string, unknown>) {
  console.warn("[data-quality]", JSON.stringify({ event, ...details }));
}

function cleanHandle(h: string): string {
  return (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
}

function cleanTikTokHandle(h: string): string {
  return (h || "").trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "")
    .replace(/[/?].*$/, "");
}

/** Baixa uma imagem remota (CDN do IG bloqueia hotlink) e devolve URL local absoluta.
 *  Retorna undefined se o download falhar ou o conteúdo não for uma imagem válida. */
async function localizeImage(remoteUrl: string | undefined, tag: string): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  // data: URLs não são suportadas pelos modelos de visão via URL — descarta
  if (remoteUrl.startsWith("data:")) return undefined;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { nanoid } = await import("nanoid");
    const res = await fetch(remoteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CacarejarBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return undefined;
    // Valida que o servidor realmente devolveu uma imagem (e não HTML de erro com status 200)
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      console.warn(`[profileProvider] localizeImage: content-type inválido "${ct.slice(0, 60)}" para ${remoteUrl.slice(0, 80)}`);
      return undefined;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // Arquivo muito pequeno = quase certeza de ser HTML de erro (imagens reais têm >2 KB)
    if (buf.byteLength < 2048) {
      console.warn(`[profileProvider] localizeImage: arquivo suspeito (${buf.byteLength}B) para ${remoteUrl.slice(0, 80)}`);
      return undefined;
    }
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = `ig_${tag}_${nanoid(8)}.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);
    const base = process.env.PUBLIC_URL || "https://cacarejar.com.br";
    return `${base}/uploads/${file}`;
  } catch {
    return undefined;
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
    views: x.videoViewCount ?? x.videoPlayCount ?? x.viewCount ?? undefined,
    img: x.displayUrl ?? x.images?.[0] ?? undefined,
    url: x.url ?? undefined,
    timestamp: x.timestamp ?? undefined,
    type: x.type ?? x.productType ?? undefined,
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
    avgLikes,
    relatedProfiles: (p.relatedProfiles ?? []).slice(0, 20).map((item: any) => ({
      handle: item.username ?? item.handle ?? "",
      fullName: item.full_name ?? item.fullName ?? undefined,
      profilePic: item.profile_pic_url ?? item.profilePicUrl ?? undefined,
      verified: item.is_verified ?? item.verified ?? false,
    })).filter((item: any) => item.handle),
    source: "apify",
  };
}

/** Localiza (baixa) as imagens visíveis do perfil (top posts + avatar) para servir do nosso domínio. */
async function localizeProfile(profile: SocialProfile): Promise<SocialProfile> {
  await Promise.all((profile.topPosts ?? []).map(async (tp, i) => { tp.img = await localizeImage(tp.img, `post${i}`); }));
  profile.profilePic = await localizeImage(profile.profilePic, `avatar`);
  return profile;
}

/** Mapeia itens brutos do Apify TikTok para SocialProfile.
 *  Suporta dois modos de scraper: profile-per-item (com latestVideos[]) e video-per-item (com authorMeta). */
function mapTikTokItems(items: any[], fallbackHandle?: string): SocialProfile | null {
  if (!items?.length) return null;
  const first = items[0];
  const hasVideosArray = Array.isArray(first.latestVideos) || Array.isArray(first.videos);

  let handle: string, fullName: string | undefined, bio: string | undefined;
  let followers = 0, following = 0, videoCount = 0;
  let profilePic: string | undefined, verified = false;
  let rawVideos: any[] = [];

  if (hasVideosArray) {
    handle = first.nickName ?? first.uniqueId ?? fallbackHandle ?? "";
    fullName = first.name ?? undefined;
    bio = first.signature ?? undefined;
    followers = first.followers ?? first.followerCount ?? first.fans ?? 0;
    following = first.following ?? first.followingCount ?? 0;
    videoCount = first.videoCount ?? first.postCount ?? 0;
    profilePic = first.avatar ?? first.avatarLarger ?? undefined;
    verified = first.verified ?? false;
    rawVideos = (first.latestVideos ?? first.videos ?? []).slice(0, 12);
  } else {
    // video-per-item: authorMeta repetido em cada item
    const author = first.authorMeta ?? first.author ?? first;
    handle = author.nickName ?? author.uniqueId ?? author.name ?? fallbackHandle ?? "";
    fullName = author.name ?? undefined;
    bio = author.signature ?? undefined;
    followers = author.fans ?? author.followers ?? author.followerCount ?? 0;
    following = author.following ?? author.followingCount ?? 0;
    videoCount = author.video ?? author.videoCount ?? 0;
    profilePic = author.avatar ?? author.avatarLarger ?? undefined;
    verified = author.verified ?? false;
    rawVideos = items.slice(0, 12);
  }

  if (!handle) return null;

  const posts: SocialPost[] = rawVideos.map((v: any) => ({
    caption: v.text ?? v.desc ?? v.caption ?? "",
    likes: v.diggCount ?? v.digg_count ?? 0,
    comments: v.commentCount ?? v.comment_count ?? 0,
    shares: v.shareCount ?? v.share_count ?? 0,
    views: v.playCount ?? v.play_count ?? 0,
    img: v.coverUrl ?? v.videoMeta?.coverUrl ?? v.thumbnail ?? undefined,
    url: v.webVideoUrl ?? v.url ?? undefined,
    timestamp: v.createTime ? new Date(v.createTime * 1000).toISOString() : v.timestamp ?? undefined,
    type: "video",
  }));

  const topPosts = posts.slice().sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments)).slice(0, 3);
  const avgEng = posts.length ? posts.reduce((s, x) => s + x.likes + x.comments, 0) / posts.length : 0;
  const avgLikes = posts.length ? Math.round(posts.reduce((s, x) => s + x.likes, 0) / posts.length) : 0;

  return {
    network: "tiktok", handle, fullName, bio,
    followers, following, postsCount: videoCount,
    profilePic, verified, posts, topPosts,
    engajamentoPct: followers > 0 ? +((avgEng / followers) * 100).toFixed(2) : undefined,
    avgLikes, source: "apify",
  };
}

/** TikTok via Apify (clockworks/tiktok-profile-scraper). Requer APIFY_TOKEN. */
async function fetchTikTokApify(handle: string): Promise<SocialProfile | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "tiktok" });
    return null;
  }
  const user = cleanTikTokHandle(handle);
  if (!user) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: [`https://www.tiktok.com/@${user}`], resultsPerPage: 12 }),
      }
    );
    if (!res.ok) {
      warnDataQuality("apify_profile_http_error", { network: "tiktok", handle: user, status: res.status });
      return null;
    }
    const items = (await res.json()) as any[];
    if (!Array.isArray(items) || !items.length) {
      warnDataQuality("apify_profile_empty", { network: "tiktok", handle: user });
      return null;
    }
    const profile = mapTikTokItems(items, user);
    if (!profile) {
      warnDataQuality("apify_profile_unmapped", { network: "tiktok", handle: user });
      return null;
    }
    return localizeProfile(profile);
  } catch (e) {
    warnDataQuality("apify_profile_exception", { network: "tiktok", handle: user, message: (e as any)?.message });
    return null;
  }
}

/** Instagram via Apify (apify/instagram-profile-scraper). Requer APIFY_TOKEN. */
async function fetchInstagramApify(handle: string): Promise<SocialProfile | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "instagram" });
    return null;
  }
  const user = cleanHandle(handle);
  if (!user) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [user] }) }
    );
    if (!res.ok) {
      warnDataQuality("apify_profile_http_error", { network: "instagram", handle: user, status: res.status });
      return null;
    }
    const items = (await res.json()) as any[];
    const profile = mapProfileItem(items?.[0], user);
    if (!profile) {
      warnDataQuality("apify_profile_unmapped", { network: "instagram", handle: user });
      return null;
    }
    return localizeProfile(profile);
  } catch (e) {
    warnDataQuality("apify_profile_exception", { network: "instagram", handle: user, message: (e as any)?.message });
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
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "instagram_batch" });
    return [];
  }
  if (!handles.length) return [];
  const users = [...new Set(handles.map(cleanHandle).filter(Boolean))].slice(0, 12);
  if (!users.length) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: users }) }
    );
    if (!res.ok) {
      warnDataQuality("apify_batch_http_error", { network: "instagram", handles: users, status: res.status });
      return [];
    }
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) {
      warnDataQuality("apify_batch_invalid_response", { network: "instagram", handles: users });
      return [];
    }
    const out: SocialProfile[] = [];
    for (const it of items) {
      const prof = mapProfileItem(it);
      if (prof && (prof.posts?.length ?? 0) > 0) out.push(prof); // só os que realmente raspou
    }
    if (!out.length) warnDataQuality("apify_batch_no_profiles", { network: "instagram", handles: users });
    return out;
  } catch (e) {
    warnDataQuality("apify_batch_exception", { network: "instagram", handles: users, message: (e as any)?.message });
    return [];
  }
}

/** Localiza (baixa) uma imagem remota e devolve URL do nosso domínio. Reuso para o Radar. */
/** TikTok em lote. Limitamos a seis perfis para manter custo e tempo previsiveis. */
/** Busca uma janela ampliada de posts para os poucos perfis que chegaram a
 * qualificacao. O Profile Scraper sozinho traz apenas publicacoes recentes. */
export async function fetchInstagramPostHistoryBatch(
  handles: string[],
  limitPerProfile = 30
): Promise<Record<string, SocialPost[]>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "instagram_post_history" });
    return {};
  }
  const users = [...new Set(handles.map(cleanHandle).filter(Boolean))].slice(0, 6);
  if (!users.length) return {};
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: users.map(user => `https://www.instagram.com/${user}/`),
          resultsType: "posts",
          resultsLimit: Math.max(12, Math.min(limitPerProfile, 40)),
          skipPinnedPosts: true,
        }),
      }
    );
    if (!res.ok) {
      warnDataQuality("apify_post_history_http_error", {
        handles: users,
        status: res.status,
      });
      return {};
    }
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) {
      warnDataQuality("apify_post_history_invalid_response", { handles: users });
      return {};
    }
    const allowed = new Set(users);
    const grouped: Record<string, SocialPost[]> = {};
    for (const item of items) {
      const owner = cleanHandle(item?.ownerUsername ?? item?.username ?? "");
      if (!allowed.has(owner)) continue;
      const post: SocialPost = {
        caption: item?.caption ?? "",
        likes: item?.likesCount ?? 0,
        comments: item?.commentsCount ?? 0,
        shares: item?.sharesCount ?? item?.reshareCount ?? undefined,
        views:
          item?.videoViewCount ??
          item?.videoPlayCount ??
          item?.viewCount ??
          undefined,
        img: item?.displayUrl ?? item?.images?.[0] ?? undefined,
        url: item?.url ?? undefined,
        timestamp: item?.timestamp ?? undefined,
        type: item?.type ?? item?.productType ?? undefined,
      };
      (grouped[owner] ??= []).push(post);
    }
    return grouped;
  } catch (e) {
    warnDataQuality("apify_post_history_exception", {
      handles: users,
      message: (e as any)?.message,
    });
    return {};
  }
}

export async function fetchTikTokProfilesBatch(handles: string[]): Promise<SocialProfile[]> {
  const users = [...new Set(handles.map(cleanTikTokHandle).filter(Boolean))].slice(0, 6);
  if (!users.length) return [];
  const profiles = await Promise.all(users.map(fetchTikTokApify));
  return profiles.filter(
    (profile): profile is SocialProfile =>
      !!profile && (profile.posts?.length ?? 0) > 0
  );
}

function cleanFacebookHandle(raw: string) {
  return (raw || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
    .replace(/[/?#].*$/, "");
}

function facebookImage(item: any): string | undefined {
  const attachments = Array.isArray(item?.attachments) ? item.attachments : [];
  const media = attachments.flatMap((attachment: any) =>
    Array.isArray(attachment?.subattachments?.data)
      ? attachment.subattachments.data
      : [attachment]
  );
  return (
    item?.image ??
    item?.picture ??
    item?.thumbnail ??
    item?.full_picture ??
    media.find((entry: any) => entry?.media?.image?.src)?.media?.image?.src ??
    undefined
  );
}

/** Le publicacoes de Paginas publicas do Facebook, com volume limitado. */
export async function fetchFacebookPagesBatch(handles: string[]): Promise<SocialProfile[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "facebook_batch" });
    return [];
  }
  const pages = [...new Set(handles.map(cleanFacebookHandle).filter(Boolean))].slice(0, 8);
  if (!pages.length) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/api-ninja~facebook-pages-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: pages,
          type: "posts",
          maxResults: 12,
          parseAllResults: false,
        }),
      }
    );
    if (!res.ok) {
      warnDataQuality("apify_batch_http_error", {
        network: "facebook",
        handles: pages,
        status: res.status,
      });
      return [];
    }
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) return [];
    const grouped = new Map<
      string,
      { name?: string; followers?: number; posts: SocialPost[] }
    >();
    for (const item of items) {
      const authorUrl = item?.author?.url ?? item?.page_url ?? item?.pageUrl ?? "";
      const fallback = item?.author?.name ?? item?.page_name ?? item?.name ?? "";
      const handle = cleanFacebookHandle(authorUrl || fallback);
      if (!handle) continue;
      const row = grouped.get(handle) ?? {
        name: item?.author?.name ?? item?.page_name ?? item?.name,
        followers: item?.followers,
        posts: [] as SocialPost[],
      };
      row.posts.push({
        caption: item?.message ?? item?.description ?? item?.text ?? "",
        likes: item?.reactions_count ?? item?.likes_count ?? item?.likes ?? 0,
        comments: item?.comments_count ?? item?.comments ?? 0,
        shares: item?.reshare_count ?? item?.shares_count ?? item?.shares ?? 0,
        views: item?.play_count ?? item?.views_count ?? item?.views ?? undefined,
        img: facebookImage(item),
        url: item?.url ?? item?.post_url ?? undefined,
        timestamp: item?.timestamp
          ? new Date(
              Number(item.timestamp) *
                (Number(item.timestamp) < 10_000_000_000 ? 1000 : 1)
            ).toISOString()
          : item?.date ?? undefined,
        type: item?.type ?? "post",
      });
      grouped.set(handle, row);
    }
    return [...grouped.entries()]
      .map(([handle, row]) => {
        const posts = row.posts.slice(0, 12);
        const topPosts = posts
          .slice()
          .sort(
            (a, b) =>
              b.likes +
              b.comments * 4 +
              (b.shares ?? 0) * 6 -
              (a.likes + a.comments * 4 + (a.shares ?? 0) * 6)
          )
          .slice(0, 3);
        const avg = posts.length
          ? posts.reduce((sum, post) => sum + post.likes + post.comments, 0) /
            posts.length
          : 0;
        return {
          network: "facebook" as const,
          handle,
          fullName: row.name,
          followers: row.followers,
          posts,
          topPosts,
          engajamentoPct: row.followers
            ? +((avg / row.followers) * 100).toFixed(2)
            : undefined,
          avgLikes: posts.length
            ? Math.round(
                posts.reduce((sum, post) => sum + post.likes, 0) / posts.length
              )
            : 0,
          source: "apify",
        };
      })
      .filter(profile => profile.posts.length > 0);
  } catch (e) {
    warnDataQuality("apify_batch_exception", {
      network: "facebook",
      handles: pages,
      message: (e as any)?.message,
    });
    return [];
  }
}

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
  if (!token) {
    warnDataQuality("apify_missing_token", { network: "hashtag" });
    return [];
  }
  if (!hashtags.length) return [];
  const tags = hashtags
    .map(h => (h || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^#/, "").replace(/[^a-zA-Z0-9_]/g, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashtags: tags, resultsType: "posts", resultsLimit: limit }),
      }
    );
    if (!res.ok) {
      warnDataQuality("apify_hashtag_http_error", { hashtags: tags, status: res.status });
      return [];
    }
    const items = (await res.json()) as any[];
    if (!Array.isArray(items)) {
      warnDataQuality("apify_hashtag_invalid_response", { hashtags: tags });
      return [];
    }
    if (!items.length) warnDataQuality("apify_hashtag_empty", { hashtags: tags });
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
  } catch (e) {
    warnDataQuality("apify_hashtag_exception", { hashtags: tags, message: (e as any)?.message });
    return [];
  }
}

/** Tenta ler o perfil das redes informadas. Instagram e TikTok via Apify. */
export async function fetchProfile(redes: Record<string, string>): Promise<SocialProfile | null> {
  if (redes?.instagram) {
    const ig = await fetchInstagramApify(redes.instagram);
    if (ig) return ig;
  }
  if (redes?.tiktok) {
    const tt = await fetchTikTokApify(redes.tiktok);
    if (tt) return tt;
  }
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
