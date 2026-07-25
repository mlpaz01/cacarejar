import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { JourneyNextAction } from "@/components/JourneyNextAction";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  Telescope,
  Sparkles,
  Heart,
  MessageCircle,
  Film,
  ExternalLink,
  Search,
  Target,
  BarChart3,
  Flame,
  ThumbsUp,
  ThumbsDown,
  FileDown,
  Copy,
  Network,
  Hash,
  Users,
  Building2,
  Handshake,
  BadgeCheck,
  Lightbulb,
} from "lucide-react";
import { AnalysisProgress, RADAR_STEPS } from "@/components/AnalysisProgress";

const nf = (n?: number) =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "—";
const hitKey = (h: any) =>
  String(
    h?.url ||
      h?.img ||
      `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`
  );
const hitOwner = (h: any) =>
  String(h?.ownerUsername || "")
    .replace(/^@/, "")
    .toLowerCase();
const safePotentialBrandText = (brand: any, value: any) => {
  const text = String(value || "").trim();
  if (brand?.relationship === "investiu_em_perfil_similar") return text;
  return text
    .replace(/parceria\s+(j[áa]\s+)?confirmada\s+(p[uú]blicamente)?:?/gi, "Afinidade potencial:")
    .replace(/investimento\s+(j[áa]\s+)?confirmado\s+(p[uú]blicamente)?:?/gi, "Sinal de afinidade:")
    .replace(/contrato\s+ativo/gi, "possivel abertura comercial")
    .replace(/a marca\s+j[áa]\s+validou\s+o perfil/gi, "a marca poderia se beneficiar do perfil")
    .replace(/\bj[áa] conhece o trabalho\b/gi, "tem afinidade com esse tipo de trabalho")
    .replace(/\bj[áa] conhece\b/gi, "pode ter afinidade com")
    .replace(/\bj[áa] foi confirmado\b/gi, "deve ser confirmado")
    .replace(/\bj[áa] foi confirmada\b/gi, "deve ser confirmada")
    .replace(/\bconfirmado p[uú]blicamente\b/gi, "a confirmar publicamente")
    .replace(/\bconfirmada p[uú]blicamente\b/gi, "a confirmar publicamente")
    .replace(/\bcampanha anterior\b/gi, "conteudo de melhor desempenho")
    .replace(/\bda conte[uú]do de melhor desempenho\b/gi, "do conteudo de melhor desempenho")
    .replace(/\bformalizar em contrato de s[ée]rie\b/gi, "propor uma serie")
    .replace(/\bformalizar em contrato\b/gi, "propor uma conversa comercial")
    .replace(/\bera co-branded\b/gi, "poderia indicar afinidade com esse ecossistema")
    .replace(/\bcontrato de s[ée]rie\b/gi, "serie comercial")
    .trim();
};
const cleanHandle = (h?: string) =>
  (h || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
type RadarChannel = "instagram" | "facebook" | "tiktok";
const CHANNELS: { id: RadarChannel; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
];
const cleanSourceHandle = (raw: string, channel: RadarChannel) => {
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
const siteHost = (raw?: string) => {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http")
      ? new URL(value)
      : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
};
const profileContext = (plan: any) => {
  const redes = { ...(plan?.redes ?? {}), ...(plan?._redes ?? {}) };
  const ig = cleanHandle(plan?.profile?.handle || redes.instagram);
  if (ig)
    return { key: `instagram:${ig}`, label: `@${ig}`, source: "Instagram" };
  const host = siteHost(redes.site || plan?.site?.url);
  if (host) return { key: `site:${host}`, label: host, source: "Site" };
  return { key: "", label: "", source: "" };
};

const normalizeLoose = (value: any) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const RADAR_BLOCK_TERMS = [
  "violencia",
  "violencia domestica",
  "policia",
  "preso",
  "presa",
  "prisao",
  "crime",
  "denuncia",
  "denunciada",
  "agressao",
  "assassin",
  "morte",
  "estupro",
  "abuso",
  "nudez",
  "sensual",
  "lingerie",
  "calcinha",
  "sutia",
  "onlyfans",
  "aposta",
  "cassino",
  "bet",
  "sorteio",
  "premio",
  "concorra",
  "ganhe",
  "marque",
  "seguir todos",
  "comente bastante",
  "engajadas",
];

const STOP_TERMS = new Set([
  "para",
  "com",
  "uma",
  "que",
  "seu",
  "sua",
  "dos",
  "das",
  "mais",
  "como",
  "voce",
  "você",
  "esse",
  "essa",
  "isso",
  "pela",
  "pelo",
  "sobre",
  "quando",
  "porque",
  "onde",
  "cada",
  "todo",
  "toda",
  "sem",
  "tem",
  "vai",
  "cliente",
  "clientes",
  "conteudo",
  "conteudos",
  "post",
  "posts",
  "instagram",
  "reels",
  "tiktok",
  "redes",
  "sociais",
  "marketing",
  "vender",
  "vendas",
  "perfil",
  "marca",
]);

function radarHitText(hit: any) {
  return normalizeLoose(
    [
      hit?.ownerUsername,
      hit?.ownerFullName,
      hit?.caption,
      hit?.theme,
      hit?.why,
      hit?.mechanism,
      hit?.profileMatchReason,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function radarContextTerms(plan: any) {
  const raw = normalizeLoose(
    [
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
    ]
      .filter(Boolean)
      .join(" ")
  );
  const counts = new Map<string, number>();
  for (const term of raw.match(/[a-z0-9]{4,}/g) ?? []) {
    if (STOP_TERMS.has(term) || /^\d+$/.test(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 28)
    .map(([term]) => term);
}

function filterRadarHitsForBrand(hits: any[], plan: any) {
  const terms = radarContextTerms(plan);
  const hasEnoughContext = terms.length >= 4;
  const visible: any[] = [];
  let hidden = 0;

  for (const hit of hits) {
    const text = radarHitText(hit);
    if (RADAR_BLOCK_TERMS.some(term => text.includes(term))) {
      hidden += 1;
      continue;
    }
    const matchedTerms = terms.filter(term => text.includes(term));
    const score =
      matchedTerms.length * 2 +
      (hit?.why || hit?.theme ? 1 : 0) +
      (hit?.sourceType === "profile" ? 1 : 0);
    if (
      hasEnoughContext &&
      score < 3 &&
      Number(hit?.profileFitScore ?? 0) < 75
    ) {
      hidden += 1;
      continue;
    }
    visible.push({
      ...hit,
      fitScore: Math.max(score, Number(hit?.profileFitScore ?? 0)),
    });
  }

  return {
    hits: visible.sort(
      (a, b) =>
        (b.fitScore ?? 0) - (a.fitScore ?? 0) ||
        (b.hotScore ?? 0) - (a.hotScore ?? 0)
    ),
    hidden,
  };
}

function topSocialTerms(hits: any[], hashtags: string[] = []) {
  const counts = new Map<string, number>();
  for (const raw of hashtags) {
    const key = String(raw).replace(/^#/, "").toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 3);
  }
  for (const hit of hits) {
    const words =
      String(hit.caption || hit.why || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9_]{4,}/g) ?? [];
    for (const word of words) {
      if (STOP_TERMS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([term, score]) => ({ term, score }));
}

export default function Radar() {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const radar = trpc.radar.get.useQuery();
  const diagnosis = trpc.diagnosis.get.useQuery();
  const suggestedSources = trpc.radar.suggest.useQuery(undefined, {
    enabled: !!diagnosis.data,
  });
  const [handles, setHandles] = useState("");
  const [activeChannel, setActiveChannel] =
    useState<RadarChannel>("instagram");
  const [radarMode, setRadarMode] = useState<"profiles" | "brands">("profiles");
  const [likedHitKeys, setLikedHitKeys] = useState<string[]>([]);
  const [dislikedHitKeys, setDislikedHitKeys] = useState<string[]>([]);

  const scan = trpc.radar.scan.useMutation({
    onSuccess: () => {
      utils.radar.get.invalidate();
      toast.success("Pesquisa concluída!");
    },
    onError: e => toast.error(e.message || "Erro na pesquisa"),
  });
  const refine = trpc.radar.refine.useMutation({
    onSuccess: () => {
      utils.radar.get.invalidate();
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
      toast.success("Radar refinado com base nos perfis compativeis!");
    },
    onError: e => toast.error(e.message || "Erro ao refinar o Radar"),
  });
  const recalibrate = trpc.diagnosis.recalibrate.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      toast.success("Diagnostico atualizado. Abrindo o Estudio.");
      navigate("/estudio");
    },
    onError: e =>
      toast.error(e.message || "Erro ao usar as ideias no diagnostico"),
  });

  const data = radar.data as any;
  const dataIsLegacy = !!data && data?.engineVersion !== 3;
  const channelData =
    dataIsLegacy
      ? null
      : data?.channels?.[activeChannel] ??
        (!data?.channels && activeChannel === "instagram" ? data : null);
  const plan = diagnosis.data as any;
  const selectedContext = profileContext(plan);
  const selectedHandle = cleanHandle(
    plan?.profile?.handle || plan?._redes?.instagram || plan?.redes?.instagram
  );
  const selectedProduto = plan?.produto || data?.baseProduto || "";
  const selectedNicho = plan?.nicho || data?.nicho || "";
  const radarBaseHandle = cleanHandle(data?.baseHandle);
  const radarBaseKey =
    data?.baseKey || (radarBaseHandle ? `instagram:${radarBaseHandle}` : "");
  const radarBaseLabel =
    data?.baseLabel || (radarBaseHandle ? `@${radarBaseHandle}` : "");
  const radarLooksStale =
    !!data &&
    !!radarBaseKey &&
    !!selectedContext.key &&
    radarBaseKey !== selectedContext.key;
  const manualHandles = handles
    .split(",")
    .map(s => cleanSourceHandle(s, activeChannel))
    .filter(Boolean);
  const hasDiagnosisContext =
    !!selectedContext.key || !!selectedProduto || !!selectedNicho;
  const canStartRadar = manualHandles.length > 0 || hasDiagnosisContext;
  const refineInfo = data?.feedback ?? {
    refinementCount: 0,
    freeLimit: 3,
    nextCostCC: 10,
  };
  const freeLeft = Math.max(
    0,
    (refineInfo.freeLimit ?? 3) - (refineInfo.refinementCount ?? 0)
  );
  const rawHits = (channelData?.hits ?? []) as any[];
  const filteredRadar = useMemo(
    () => filterRadarHitsForBrand(rawHits, diagnosis.data),
    [rawHits, diagnosis.data]
  );
  const hits = filteredRadar.hits;
  const hiddenHitsCount = filteredRadar.hidden;
  const dataQuality = channelData?.dataQuality;
  const profileMatches = (channelData?.profileMatches ?? []) as any[];
  const brandProspects = (channelData?.brandProspects ?? []) as any[];
  const topProfileMatches = profileMatches
    .slice()
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
    .slice(0, 10);
  const topBrandProspects = brandProspects
    .slice()
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
    .slice(0, 10);
  const sourceStats = useMemo(() => {
    const map = new Map<string, any>();
    for (const h of hits) {
      const owner = hitOwner(h) || "sem-perfil";
      const row = map.get(owner) ?? {
        owner,
        count: 0,
        hot: 0,
        likes: 0,
        comments: 0,
        mechanisms: new Map<string, number>(),
      };
      row.count += 1;
      row.hot += Number(h.hotScore ?? 0);
      row.likes += Number(h.likes ?? 0);
      row.comments += Number(h.comments ?? 0);
      const mech = h.mechanism || h.theme || "sinal geral";
      row.mechanisms.set(mech, (row.mechanisms.get(mech) ?? 0) + 1);
      map.set(owner, row);
    }
    return [...map.values()]
      .map(row => ({
        ...row,
        avgHot: row.count ? Math.round(row.hot / row.count) : 0,
        topMechanism:
          [...row.mechanisms.entries()].sort(
            (a, b) => Number(b[1]) - Number(a[1])
          )[0]?.[0] ?? "sinal geral",
      }))
      .sort((a, b) => b.avgHot - a.avgHot)
      .slice(0, 10);
  }, [hits]);
  const signalMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const h of hits) {
      const key = h.mechanism || h.theme || "sinal geral";
      const row = map.get(key) ?? {
        key,
        count: 0,
        hot: 0,
        examples: [] as string[],
      };
      row.count += 1;
      row.hot += Number(h.hotScore ?? 0);
      if (h.why && row.examples.length < 2) row.examples.push(h.why);
      map.set(key, row);
    }
    return [...map.values()]
      .map(row => ({
        ...row,
        avgHot: row.count ? Math.round(row.hot / row.count) : 0,
      }))
      .sort((a, b) => b.avgHot - a.avgHot)
      .slice(0, 5);
  }, [hits]);
  const socialTerms = useMemo(
    () => topSocialTerms(hits, channelData?.hashtags ?? []),
    [hits, channelData?.hashtags]
  );
  const channelKeys = new Set(rawHits.map(hitKey));
  const channelLikedHitKeys = likedHitKeys.filter(key => channelKeys.has(key));
  const channelDislikedHitKeys = dislikedHitKeys.filter(key =>
    channelKeys.has(key)
  );
  const feedbackCount =
    channelLikedHitKeys.length + channelDislikedHitKeys.length;

  useEffect(() => {
    if (!data) return;
    setLikedHitKeys((data.feedback?.likedPostKeys ?? []) as string[]);
    setDislikedHitKeys((data.feedback?.dislikedPostKeys ?? []) as string[]);
  }, [data?.scannedAt]);

  useEffect(() => {
    if (!location.includes("studioReturn=")) return;
    utils.radar.get.invalidate();
    radar.refetch();
  }, [location]);

  const parseHandles = () =>
    handles
      .split(",")
      .map(s => cleanSourceHandle(s, activeChannel))
      .filter(Boolean);
  const runScan = () => {
    const parsed = parseHandles();
    if (!parsed.length && !hasDiagnosisContext) {
      toast.error(
        "Crie ou restaure um diagnostico com perfil antes de iniciar o Radar."
      );
      return;
    }
    scan.mutate({
      channel: activeChannel,
      ...(parsed.length ? { handles: parsed } : {}),
    });
  };
  const useSuggestedProfiles = () => {
    const profiles = (
      suggestedSources.data?.channels?.[activeChannel]?.profiles ??
      (activeChannel === "instagram" ? suggestedSources.data?.profiles : []) ??
      []
    )
      .map((handle: string) => cleanSourceHandle(handle, activeChannel))
      .filter(Boolean);
    if (!profiles.length) {
      toast.info(
        "O Agente vai iniciar pelo contexto e pelas hashtags do diagnostico."
      );
      return;
    }
    setHandles(profiles.map((h: string) => `@${h}`).join(", "));
    toast.success("Perfis sugeridos adicionados ao Radar.");
  };
  const runRefine = () =>
    refine.mutate({
      likedPostKeys: channelLikedHitKeys,
      dislikedPostKeys: channelDislikedHitKeys,
      channel: activeChannel,
    });
  const applyRadarFeedback = () =>
    recalibrate.mutate({
      feedback:
        "Usar os feedbacks do Radar no diagnostico e seguir para criacao no Estudio.",
    });
  const scrollToFeedback = () =>
    document
      .getElementById("radar-feedback")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const markHitLike = (hit: any) => {
    const key = hitKey(hit);
    const owner = hitOwner(hit);
    const sameOwnerKeys = ((channelData?.hits ?? []) as any[])
      .filter(h => hitOwner(h) === owner)
      .map(hitKey);
    setLikedHitKeys(prev => [
      ...prev.filter(k => !sameOwnerKeys.includes(k)),
      key,
    ]);
    setDislikedHitKeys(prev => prev.filter(k => k !== key));
  };
  const markHitDislike = (hit: any) => {
    const key = hitKey(hit);
    setLikedHitKeys(prev => prev.filter(k => k !== key));
    setDislikedHitKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
  };
  const exportPdf = () => {
    try {
      window.localStorage.setItem(
        "cacarejar.radarFeedbackDraft",
        JSON.stringify({
          scannedAt: data?.scannedAt,
          likedPostKeys: likedHitKeys,
          dislikedPostKeys: dislikedHitKeys,
        })
      );
    } catch {
      /* noop */
    }
    window.open("/app/diagnostico/relatorio", "_blank");
  };
  const copyRadarPackage = async () => {
    if (!data) return;
    const text = [
      `Radar de Mercado - ${selectedContext.label || selectedProduto || selectedNicho || "perfil ativo"}`,
      "",
      "Resumo:",
      channelData?.marketSummary || "Sem resumo registrado.",
      "",
      "Concorrentes/fontes com mais sinal:",
      ...sourceStats.map(
        s =>
          `- @${s.owner}: ${s.count} hit(s), hot medio ${s.avgHot}, padrao ${s.topMechanism}`
      ),
      "",
      "Termos de social SEO:",
      socialTerms.map(t => `#${t.term}`).join(" "),
      "",
      "Sinais para adaptar:",
      ...signalMap.map(
        s => `- ${s.key}: ${s.count} evidencia(s), hot medio ${s.avgHot}`
      ),
    ].join("\n");
    await navigator.clipboard?.writeText(text);
    toast.success("Pacote do Radar copiado.");
  };

  const radarNextAction = !channelData
    ? {
        title: "Proxima acao: iniciar o Radar",
        text: "Use o perfil ativo do diagnostico ou informe perfis inspiradores. O objetivo aqui e encontrar referencias reais antes de criar qualquer conteudo.",
        label: scan.isPending ? "Pesquisando..." : "Iniciar Radar",
        run: runScan,
        disabled: scan.isPending || !canStartRadar,
      }
    : feedbackCount === 0
      ? {
          title: "Proxima acao: marcar referencias que combinam",
          text: "Abra os posts encontrados e marque Gostei ou Nao gostei. Esse toque humano ensina os Agentes o que serve para este negocio antes de ir ao Estudio.",
          label: "Ver posts para marcar",
          run: scrollToFeedback,
          disabled: false,
        }
      : (refineInfo.refinementCount ?? 0) === 0
        ? {
            title: "Proxima acao: refinar o Radar com seu feedback",
            text: "Voce ja marcou referencias. Agora refaca a pesquisa com esse criterio para evitar copiar concorrente errado e melhorar o contexto da criacao.",
            label: refine.isPending ? "Refinando..." : "Refinar Radar",
            run: runRefine,
            disabled: refine.isPending || channelLikedHitKeys.length === 0,
          }
        : {
            title: "Proxima acao: aplicar feedback e abrir o Estudio",
            text: "O Radar ja recebeu seu criterio. Agora aplique esse aprendizado ao diagnostico e siga para criar, editar visualmente e dar o toque humano.",
            label: recalibrate.isPending ? "Aplicando..." : "Abrir Estudio",
            run: applyRadarFeedback,
            disabled: recalibrate.isPending,
          };

  const SearchBar = (
    <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Telescope className="w-4 h-4 text-[#ff3217]" />
        <h3 className="text-sm font-black text-[#070b17]">
          Encontrar concorrentes e inspiracoes no{" "}
          {CHANNELS.find(channel => channel.id === activeChannel)?.label}
        </h3>
      </div>
      {selectedContext.label ? (
        <div className="mb-3 rounded-xl border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">
              Base atual do Radar
            </p>
            <p className="text-xs font-black text-[#071b44]">
              {selectedContext.label}
              {selectedNicho ? ` - ${selectedNicho}` : ""}
            </p>
          </div>
          {selectedContext.source && (
            <span className="text-[10px] font-black text-[#071b44] bg-white border border-[#e6ebf3] rounded-full px-3 py-1">
              {selectedContext.source}
            </span>
          )}
          {selectedProduto && (
            <span className="text-[10px] font-bold text-[#61708a] bg-white border border-[#e6ebf3] rounded-full px-3 py-1 max-w-[360px] truncate">
              {selectedProduto}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-[#ffd5ce] bg-[#fff8f6] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-bold text-[#8f2014]">
            Nenhum perfil de diagnostico selecionado. Informe @ concorrentes
            ou criadores de inspiracao abaixo, ou crie/restaure um diagnostico.
          </p>
          <button
            onClick={() => navigate("/diagnostico")}
            className="text-[11px] font-black text-[#071b44] bg-white border border-[#ffd5ce] rounded-full px-3 py-1 hover:border-[#ff8a45]"
          >
            Ir para Diagnostico
          </button>
        </div>
      )}
      {radarLooksStale && (
        <div className="mb-3 rounded-xl border border-[#ffd5ce] bg-[#fff8f6] px-3 py-2">
          <p className="text-xs font-bold text-[#8f2014]">
            A pesquisa exibida abaixo foi gerada para {radarBaseLabel}. Para
            usar {selectedContext.label}, inicie um novo Radar.
          </p>
        </div>
      )}
      <p className="text-[11px] text-[#61708a] mb-3">
        {hasDiagnosisContext
          ? "Deixe em branco para o Agente descobrir candidatos pelo diagnostico. Todo perfil sera validado por publico, oferta e conteudo antes de aparecer."
          : "Sem diagnostico selecionado, informe perfis que deseja comparar para iniciar o Radar."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={handles}
          onChange={e => setHandles(e.target.value)}
          placeholder={
            activeChannel === "facebook"
              ? "pagina1, facebook.com/pagina2 (opcional)"
              : "@perfil1, @perfil2 (opcional)"
          }
          className="flex-1 border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
        />
        <button
          onClick={useSuggestedProfiles}
          disabled={suggestedSources.isLoading || !hasDiagnosisContext}
          className="text-sm px-4 py-2.5 rounded-lg border border-[#e6ebf3] text-[#071b44] font-black bg-white hover:bg-[#f6f8fc] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {suggestedSources.isLoading ? "Sugerindo..." : "Sugerir perfis"}
        </button>
        <button
          onClick={runScan}
          disabled={scan.isPending || !canStartRadar}
          className="btn-action-navy text-sm px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scan.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {scan.isPending
            ? "Pesquisando..."
            : `Pesquisar ${CHANNELS.find(
                channel => channel.id === activeChannel
              )?.label}`}
        </button>
        <button
          onClick={() =>
            recalibrate.mutate({
              feedback: "Usar os feedbacks do Radar no diagnóstico.",
            })
          }
          disabled={recalibrate.isPending || !data || feedbackCount === 0}
          className="hidden"
        >
          {recalibrate.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {recalibrate.isPending
            ? "Aplicando..."
            : "Usar Feedbacks do Radar no diagnóstico"}
        </button>
      </div>
      {hasDiagnosisContext &&
        !!suggestedSources.data?.channels?.[activeChannel]?.hashtags?.length && (
        <p className="mt-3 text-[11px] text-[#61708a]">
          Hashtags preparadas pelo Agente:{" "}
          {(suggestedSources.data.channels[activeChannel].hashtags as string[])
            .slice(0, 8)
            .map(h => `#${h}`)
            .join(" ")}
        </p>
      )}
    </div>
  );

  return (
    <AppLayout
      title="Radar de Mercado"
      subtitle="O Agente qualifica concorrentes, inspiracoes e oportunidades de marca por canal"
      journeyActive="radar"
      actions={
        <button
          onClick={exportPdf}
          className="text-xs font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" /> Exportar PDF
        </button>
      }
    >
      <JourneyNextAction
        title={radarNextAction.title}
        text={radarNextAction.text}
        label={radarNextAction.label}
        onClick={radarNextAction.run}
        disabled={radarNextAction.disabled}
      />

      <section className="bg-white border border-[#e6ebf3] rounded-xl px-4 py-3 mb-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CHANNELS.map(channel => {
            const snapshot = data?.channels?.[channel.id];
            const count =
              snapshot?.profileMatches?.length ??
              (channel.id === "instagram" && !data?.channels
                ? data?.profileMatches?.length ?? 0
                : 0);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  setActiveChannel(channel.id);
                  setHandles("");
                }}
                className={`h-10 px-4 rounded-lg text-xs font-black whitespace-nowrap transition-colors ${
                  activeChannel === channel.id
                    ? "bg-[#071b44] text-white"
                    : "text-[#61708a] hover:bg-[#f6f8fc]"
                }`}
              >
                {channel.label}
                {count > 0 && (
                  <span className="ml-2 opacity-75">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="inline-flex items-center rounded-lg bg-[#f1f4f9] p-1">
          <button
            type="button"
            onClick={() => setRadarMode("profiles")}
            className={`h-9 px-4 rounded-md text-xs font-black inline-flex items-center gap-2 ${
              radarMode === "profiles"
                ? "bg-white text-[#071b44] shadow-sm"
                : "text-[#61708a]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Concorrentes e inspiracoes
            {topProfileMatches.length > 0 && (
              <span className="rounded-full bg-[#f1f4f9] px-1.5 py-0.5 text-[9px] text-[#61708a]">
                {topProfileMatches.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setRadarMode("brands")}
            className={`h-9 px-4 rounded-md text-xs font-black inline-flex items-center gap-2 ${
              radarMode === "brands"
                ? "bg-white text-[#071b44] shadow-sm"
                : "text-[#61708a]"
            }`}
          >
            <Handshake className="w-3.5 h-3.5" />
            Marcas interessadas
            {topBrandProspects.length > 0 && (
              <span className="rounded-full bg-[#f1f4f9] px-1.5 py-0.5 text-[9px] text-[#61708a]">
                {topBrandProspects.length}
              </span>
            )}
          </button>
        </div>
      </section>

      {radarMode === "profiles" ? (
        SearchBar
      ) : (
        <section className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#fff1ef] text-[#ff3217] grid place-items-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-[#071b44]">
              Marcas que podem se interessar por este perfil
            </h3>
            <p className="text-xs text-[#61708a] mt-1 leading-relaxed">
              O Agente cruza sinais publicos de parceria com afinidade de
              publico e tema. Hipoteses aparecem claramente separadas de
              investimentos encontrados.
            </p>
          </div>
          <button
            type="button"
            onClick={runScan}
            disabled={scan.isPending || !canStartRadar}
            className="btn-action-navy px-5 py-3 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {scan.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Atualizar oportunidades
          </button>
        </section>
      )}

      {dataQuality?.status === "degraded" && (
        <section className="rounded-2xl border border-[#ffd5ce] bg-[#fff8f6] p-4 shadow-sm mb-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#ffd5ce] text-[#ff3217] grid place-items-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-black text-[#8f2014] uppercase tracking-wide">
              Radar com leitura parcial
            </p>
            <p className="text-sm text-[#22304b] font-semibold leading-relaxed mt-1">
              {dataQuality.message}
            </p>
            {!!dataQuality.warnings?.length && (
              <p className="text-xs text-[#61708a] mt-1">
                {dataQuality.warnings.join(" ")}
              </p>
            )}
          </div>
        </section>
      )}

      {scan.isPending && (
        <div className="max-w-2xl mx-auto mb-5">
          <AnalysisProgress
            steps={RADAR_STEPS}
            active={scan.isPending}
            title="Investigando o seu mercado…"
            subtitle="O Agente Radar está pesquisando os hits do setor."
          />
        </div>
      )}

      {!scan.isPending && !channelData && (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-12 shadow-sm text-center">
          <Telescope className="w-12 h-12 text-[#cfd8e6] mx-auto mb-3" />
          <p className="text-base font-black text-[#22304b]">
            {dataIsLegacy
              ? "Atualize o Radar para usar a nova inteligencia competitiva"
              : "Descubra o que da certo no seu mercado"}
          </p>
          <p className="text-sm text-[#61708a] mt-1 max-w-md mx-auto">
            {dataIsLegacy
              ? "A pesquisa anterior nao tinha qualificacao de perfil. O novo Agente valida publico, oferta e conteudo antes de mostrar qualquer nome."
              : "O Agente encontra perfis comparaveis e mostra os posts que realmente ficaram fora da curva."}
          </p>
        </div>
      )}

      {!scan.isPending && channelData && (
        <section className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-black text-[#071b44] flex items-center gap-2">
                <Handshake className="w-4 h-4 text-[#ff3217]" />
                Match do Radar
              </h3>
              <p className="text-[11px] text-[#61708a] mt-1">
                Ate 10 perfis inspiradores e ate 10 marcas que podem se
                interessar pelo conteudo deste perfil.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                {topProfileMatches.length}/10 perfis
              </span>
              <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                {topBrandProspects.length}/10 marcas
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#ff3217]" />
                  Perfis inspiradores e concorrentes
                </h4>
                <button
                  type="button"
                  onClick={() => setRadarMode("profiles")}
                  className="text-[10px] font-black text-[#071b44] border border-[#e6ebf3] bg-white rounded-full px-3 py-1 hover:border-[#071b44]"
                >
                  Ver posts
                </button>
              </div>
              {topProfileMatches.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {topProfileMatches.map((profile: any, index: number) => (
                    <article
                      key={`${profile.handle}-${index}`}
                      className="rounded-lg bg-white border border-[#e6ebf3] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#071b44] truncate">
                          @{profile.handle}
                        </p>
                        <span className="text-[9px] font-black text-white bg-[#ff3217] rounded-full px-2 py-0.5">
                          {profile.fitScore ?? "-"}/100
                        </span>
                      </div>
                      <p className="text-[9px] font-black text-[#ff3217] uppercase mt-1">
                        {profile.role === "concorrente_direto"
                          ? "Concorrente direto"
                          : profile.matchScope === "componente_editorial"
                            ? `Inspiracao: ${String(profile.inspirationDimension || "mecanismo").replace(/_/g, " ")}`
                            : "Inspiracao ampla"}
                      </p>
                      <p className="text-[10px] text-[#61708a] mt-1 line-clamp-2">
                        {profile.reason}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-white border border-[#e6ebf3] p-4 text-xs text-[#61708a] font-semibold">
                  Rode o Radar para montar a lista de perfis qualificados.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#ff3217]" />
                  Marcas que podem se interessar
                </h4>
                <button
                  type="button"
                  onClick={() => setRadarMode("brands")}
                  className="text-[10px] font-black text-[#071b44] border border-[#e6ebf3] bg-white rounded-full px-3 py-1 hover:border-[#071b44]"
                >
                  Ver abordagem
                </button>
              </div>
              {topBrandProspects.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {topBrandProspects.map((brand: any, index: number) => {
                    const hasInvestmentSignal =
                      brand.relationship === "investiu_em_perfil_similar";
                    return (
                      <article
                        key={`${brand.handle || brand.brand}-${index}`}
                        className="rounded-lg bg-white border border-[#e6ebf3] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">
                            {brand.brand}
                          </p>
                          <span className="text-[9px] font-black text-white bg-[#071b44] rounded-full px-2 py-0.5">
                            {brand.fitScore ?? "-"}/100
                          </span>
                        </div>
                        <p
                          className={`text-[9px] font-black uppercase mt-1 ${
                            hasInvestmentSignal
                              ? "text-[#087a38]"
                              : "text-[#ff3217]"
                          }`}
                        >
                          {hasInvestmentSignal
                            ? "Sinal publico"
                            : "Hipotese de fit"}
                        </p>
                        <p className="text-[10px] text-[#61708a] mt-1 line-clamp-2">
                          {safePotentialBrandText(
                            brand,
                            brand.contentFit || brand.why
                          )}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg bg-white border border-[#e6ebf3] p-4 text-xs text-[#61708a] font-semibold">
                  Atualize o Radar para buscar marcas por afinidade comercial.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {radarMode === "brands" && channelData && (
        <section className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-black text-[#071b44] flex items-center gap-2">
                <Handshake className="w-4 h-4 text-[#ff3217]" />
                Oportunidades de parceria
              </h3>
              <p className="text-[11px] text-[#61708a] mt-1">
                A nota mede afinidade comercial. Interesse e verba so sao
                confirmados depois de uma conversa com a marca.
              </p>
            </div>
            <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
              {topBrandProspects.length}/10 marca(s) analisada(s)
            </span>
          </div>
          {topBrandProspects.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {topBrandProspects.map((brand: any, index: number) => {
                const hasInvestmentSignal =
                  brand.relationship === "investiu_em_perfil_similar";
                const displayWhy = safePotentialBrandText(
                  brand,
                  brand.contentFit || brand.why
                );
                const displayApproach = safePotentialBrandText(
                  brand,
                  brand.approach
                );
                const brandUrl = brand.handle
                  ? activeChannel === "facebook"
                    ? `https://facebook.com/${brand.handle}`
                    : activeChannel === "tiktok"
                      ? `https://tiktok.com/@${brand.handle}`
                      : `https://instagram.com/${brand.handle}`
                  : "";
                return (
                  <article
                    key={`${brand.handle || brand.brand}-${index}`}
                    className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#071b44] truncate">
                          {brand.brand}
                        </p>
                        <p className="text-[10px] text-[#61708a] font-bold mt-0.5">
                          {brand.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#071b44] text-white px-2.5 py-1 text-[10px] font-black flex-shrink-0">
                        {brand.fitScore}/100
                      </span>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black mt-3 ${
                        hasInvestmentSignal
                          ? "bg-[#eafff1] text-[#087a38] border border-[#bfeccb]"
                          : "bg-[#fff1ef] text-[#9b1c0b] border border-[#ffd6ce]"
                      }`}
                    >
                      {hasInvestmentSignal ? (
                        <BadgeCheck className="w-3 h-3" />
                      ) : (
                        <Lightbulb className="w-3 h-3" />
                      )}
                      {hasInvestmentSignal
                        ? "Sinal publico de investimento"
                        : "Oportunidade potencial"}
                    </div>
                    <p className="text-xs text-[#22304b] font-semibold leading-relaxed mt-3">
                      {displayWhy}
                    </p>
                    {!!brand.matchedContent?.length && (
                      <div className="rounded-lg bg-white border border-[#e6ebf3] p-3 mt-3">
                        <p className="text-[9px] uppercase font-black text-[#ff3217]">
                          Conteudo que cria o match
                        </p>
                        <p className="text-[11px] text-[#22304b] leading-relaxed mt-1">
                          {brand.matchedContent.slice(0, 3).join(" | ")}
                        </p>
                      </div>
                    )}
                    {!!brand.interestedThemes?.length && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {brand.interestedThemes.map((theme: string) => (
                          <span
                            key={theme}
                            className="rounded-full bg-white border border-[#e6ebf3] px-2 py-1 text-[9px] font-black text-[#61708a]"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="rounded-lg bg-white border border-[#e6ebf3] p-3 mt-3">
                      <p className="text-[9px] uppercase font-black text-[#ff3217]">
                        Como abordar
                      </p>
                      <p className="text-[11px] text-[#22304b] leading-relaxed mt-1">
                        {displayApproach}
                      </p>
                    </div>
                    {hasInvestmentSignal && !!brand.evidence?.length && (
                      <details className="mt-3">
                        <summary className="text-[10px] font-black text-[#071b44] cursor-pointer">
                          Ver evidencia publica
                        </summary>
                        <p className="text-[10px] text-[#61708a] leading-relaxed mt-2 break-words">
                          {brand.evidence[0]}
                        </p>
                      </details>
                    )}
                    {brandUrl && (
                      <a
                        href={brandUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-[10px] font-black text-[#071b44] hover:text-[#ff3217]"
                      >
                        Abrir perfil da marca
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-8 text-center">
              <Building2 className="w-8 h-8 text-[#c5cfdd] mx-auto" />
              <p className="text-sm font-black text-[#071b44] mt-3">
                Ainda nao ha marca com evidencia suficiente neste canal.
              </p>
              <p className="text-xs text-[#61708a] mt-1">
                Atualize a pesquisa. O Agente prefere uma lista vazia a inventar
                patrocinadores.
              </p>
            </div>
          )}
        </section>
      )}

      {radarMode === "profiles" && channelData && (
        <>
          {/* Inteligencia de audiencia */}
          <div
            id="radar-feedback"
            className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5 scroll-mt-32"
          >
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#ff3217]" /> O que esta quente
                  agora
                </h3>
                <p className="text-[11px] text-[#61708a] mt-1">
                  O Agente de Audiencia analisa sinais fora da curva, padroes
                  vencedores e oportunidades para a sua marca.
                </p>
              </div>
              {channelData.quality && (
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  Pesquisa {channelData.quality.grade} · {hits.length} posts
                  validos · {profileMatches.length} perfis qualificados
                </span>
              )}
            </div>

            {channelData.marketSummary && (
              <div className="rounded-xl bg-[#071b44] text-white p-4 mb-4">
                <p className="text-sm font-semibold leading-relaxed">
                  {channelData.marketSummary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#ff3217]" /> Biblioteca
                    de perfis qualificados
                  </h4>
                  <button
                    onClick={copyRadarPackage}
                    className="text-[10px] font-black text-[#071b44] border border-[#e6ebf3] bg-white rounded-full px-2.5 py-1 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <div className="space-y-2 mt-3">
                  {topProfileMatches.length ? (
                    topProfileMatches.map((profile: any) => (
                      <div
                        key={profile.handle}
                        className="rounded-lg bg-white border border-[#e6ebf3] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">
                            @{profile.handle}
                          </p>
                          <span className="text-[9px] font-black text-white bg-[#ff3217] rounded-full px-2 py-0.5">
                            {profile.fitScore}/100
                          </span>
                        </div>
                        <p className="text-[9px] font-black text-[#ff3217] uppercase mt-1">
                          {profile.role === "concorrente_direto"
                            ? "Concorrente direto"
                            : profile.matchScope === "componente_editorial"
                              ? `Inspiracao: ${String(profile.inspirationDimension || "mecanismo").replace(/_/g, " ")}`
                              : "Inspiracao ampla"}
                        </p>
                        <p className="text-[10px] text-[#61708a] mt-1 line-clamp-3">
                          {profile.reason}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#61708a]">
                      Rode o Radar para montar a biblioteca.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-[#ff3217]" /> Mapa de
                  sinais
                </h4>
                <div className="space-y-2 mt-3">
                  {signalMap.length ? (
                    signalMap.map((s: any) => (
                      <div
                        key={s.key}
                        className="rounded-lg bg-white border border-[#e6ebf3] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">
                            {s.key}
                          </p>
                          <span className="text-[9px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded-full px-2 py-0.5">
                            {s.count} evid.
                          </span>
                        </div>
                        {s.examples?.[0] && (
                          <p className="text-[10px] text-[#61708a] line-clamp-2 mt-1">
                            {s.examples[0]}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#61708a]">
                      Os mecanismos aparecem aqui depois da pesquisa.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#ff3217]" /> Social SEO
                </h4>
                <p className="text-[11px] text-[#61708a] mt-2">
                  Termos recorrentes para legenda, bio, Reels, carrossel e busca
                  social.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {socialTerms.length ? (
                    socialTerms.map((t: any) => (
                      <span
                        key={t.term}
                        className="rounded-full border border-[#e6ebf3] bg-white px-2.5 py-1 text-[10px] font-black text-[#071b44]"
                      >
                        #{t.term}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#61708a]">
                      Sem termos suficientes ainda.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {channelData.patterns?.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Padroes vencedores
                  detectados
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {channelData.patterns
                    .slice(0, 4)
                    .map((p: any, i: number) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#e6ebf3] p-4 bg-[#fbfcff]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h5 className="text-sm font-black text-[#071b44] leading-snug">
                          {p.title}
                        </h5>
                        <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2 py-0.5">
                          {p.hotScore ?? "-"} hot
                        </span>
                      </div>
                      {p.insight && (
                        <p className="text-xs text-[#22304b] font-semibold leading-snug">
                          {p.insight}
                        </p>
                      )}
                      {p.whyItWorks && (
                        <p className="text-[11px] text-[#61708a] mt-2">
                          <span className="font-black text-[#070b17]">
                            Por que funciona:
                          </span>{" "}
                          {p.whyItWorks}
                        </p>
                      )}
                      {p.recommendedMove && (
                        <p className="text-[11px] text-[#61708a] mt-1">
                          <span className="font-black text-[#070b17]">
                            Como usar:
                          </span>{" "}
                          {p.recommendedMove}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.contentMechanism && (
                          <span className="text-[9px] font-black text-[#071b44] bg-white border border-[#e6ebf3] rounded px-1.5 py-0.5">
                            {p.contentMechanism}
                          </span>
                        )}
                        {(p.evidenceCount ?? 0) > 0 && (
                          <span className="text-[9px] font-black text-[#61708a] bg-white border border-[#e6ebf3] rounded px-1.5 py-0.5">
                            {p.evidenceCount} evidencias
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {channelData.opportunities?.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Oportunidades para apostar
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {channelData.opportunities
                    .slice(0, 4)
                    .map((o: any, i: number) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#e6ebf3] p-4 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-sm font-black text-[#070b17] leading-snug">
                          {o.title}
                        </h5>
                        <span className="text-[10px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded-full px-2 py-0.5">
                          {o.priorityScore ?? "-"} prioridade
                        </span>
                      </div>
                      {o.reasonToBet && (
                        <p className="text-xs text-[#22304b] font-semibold leading-snug mt-2">
                          {o.reasonToBet}
                        </p>
                      )}
                      {o.suggestedAngle && (
                        <p className="text-[11px] text-[#61708a] mt-2">
                          <span className="font-black text-[#070b17]">
                            Angulo:
                          </span>{" "}
                          {o.suggestedAngle}
                        </p>
                      )}
                      {o.effort && (
                        <span className="inline-flex mt-3 text-[9px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">
                          esforco {o.effort}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Posts de referencia */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <div>
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#ff3217]" /> Posts de
                  concorrentes e criadores
                </h3>
                <p className="text-[11px] text-[#61708a] mt-1">
                  Abra cada post real, veja a imagem e marque Gostei ou Nao
                  gostei. Os gostei viram referencia; os rejeitados saem da
                  proxima pesquisa.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  {channelLikedHitKeys.length} gostei /{" "}
                  {channelDislikedHitKeys.length} não gostei
                </span>
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  {freeLeft > 0
                    ? `${freeLeft} refinamento(s) gratis`
                    : `${refineInfo.nextCostCC ?? 10} CC por refinamento`}
                </span>
                {freeLeft <= 0 && (
                  <button
                    onClick={() => navigate("/creditos")}
                    className="text-[10px] font-black text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded-full px-3 py-1 hover:bg-white"
                  >
                    Comprar creditos
                  </button>
                )}
                <button
                  onClick={runRefine}
                  disabled={
                    refine.isPending || channelLikedHitKeys.length === 0
                  }
                  className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refine.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {refine.isPending
                    ? "Refinando..."
                    : "Usar Feedback para refazer a pesquisa"}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#61708a] mb-3">
              Perfis analisados:{" "}
              {(channelData.sources ?? []).map((s: string) => (
                <span key={s} className="font-bold text-[#071b44]">
                  @{s}{" "}
                </span>
              ))}
              {channelData.hashtags?.length > 0 && (
                <span className="text-[#9aa7bd]">
                  · hashtags:{" "}
                  {channelData.hashtags
                    .map((h: string) => "#" + h)
                    .join(" ")}
                </span>
              )}
            </p>
            {hiddenHitsCount > 0 && (
              <div className="rounded-xl border border-[#ffd6ce] bg-[#fff8f6] p-3 mb-3">
                <p className="text-xs font-black text-[#9b1c0b] uppercase tracking-wide">
                  Filtro de aderencia ativo
                </p>
                <p className="text-xs text-[#22304b] font-semibold leading-relaxed mt-1">
                  {hiddenHitsCount} post(s) foram ocultados porque pareciam
                  pouco aderentes, sensiveis ou oportunistas demais para este
                  negocio.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
              {hits.map((h: any, i: number) => {
                const key = hitKey(h);
                const handle = hitOwner(h);
                const liked = likedHitKeys.includes(key);
                const disliked = dislikedHitKeys.includes(key);
                return (
                  <div
                    key={i}
                    className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${liked ? "border-[#18b85c] bg-[#f7fff9]" : disliked ? "border-[#c20f00] bg-[#fff8f6]" : "border-[#e6ebf3] bg-white"}`}
                  >
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block relative group"
                    >
                      {h.img ? (
                        <img
                          src={h.img}
                          alt=""
                          className="w-full aspect-square object-cover bg-[#f6f8fc]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full aspect-square bg-[#f6f8fc] flex items-center justify-center text-[#9aa7bd]">
                          <Telescope className="w-7 h-7" />
                        </div>
                      )}
                      <span className="absolute right-2 top-2 text-[9px] font-black text-white bg-black/60 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Abrir post <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </a>
                    <div className="p-2 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-black text-[#071b44] hover:text-[#ff3217] flex items-center gap-1 truncate"
                        >
                          @{h.ownerUsername}{" "}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        <span
                          className={`text-[9px] font-black rounded-full px-2 py-0.5 flex-shrink-0 ${liked ? "bg-[#18b85c] text-white" : disliked ? "bg-[#c20f00] text-white" : "bg-[#eef2f7] text-[#61708a]"}`}
                        >
                          {liked
                            ? "gostei"
                            : disliked
                              ? "não gostei"
                              : "sem marcação"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[#61708a] mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-2.5 h-2.5 text-[#ff3217]" />{" "}
                          {nf(h.likes)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="w-2.5 h-2.5" />{" "}
                          {nf(h.comments)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {typeof h.profileFitScore === "number" && (
                          <span className="text-[9px] font-black text-[#071b44] bg-[#eef2f7] border border-[#dce3ed] rounded px-1.5 py-0.5">
                            perfil {h.profileFitScore}/100
                          </span>
                        )}
                        {typeof h.hotScore === "number" && (
                          <span className="text-[9px] font-black text-white bg-[#ff3217] rounded px-1.5 py-0.5">
                            {h.hotScore} hot
                          </span>
                        )}
                        {typeof h.engagementRate === "number" && (
                          <span className="text-[9px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">
                            {h.engagementRate}% eng.
                          </span>
                        )}
                        {typeof h.outlierScore === "number" &&
                          h.outlierScore > 1.2 && (
                            <span className="text-[9px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded px-1.5 py-0.5">
                              {h.outlierScore}x perfil
                            </span>
                          )}
                      </div>
                      {h.profileRole && (
                        <p className="text-[9px] text-[#ff3217] font-black uppercase tracking-wide mt-1">
                          {h.profileRole === "concorrente_direto"
                            ? "Concorrente direto"
                            : h.profileMatchScope === "componente_editorial"
                              ? `Inspiracao: ${String(h.profileInspirationDimension || "mecanismo").replace(/_/g, " ")}`
                              : "Inspiracao ampla"}
                        </p>
                      )}
                      {h.profileMatchReason && (
                        <p className="text-[10px] text-[#61708a] leading-snug mt-1 line-clamp-2">
                          {h.profileMatchReason}
                        </p>
                      )}
                      {h.mechanism && (
                        <p className="text-[9px] text-[#ff3217] font-black uppercase tracking-wide mt-1">
                          {h.mechanism}
                        </p>
                      )}
                      {h.why && (
                        <p className="text-[10px] text-[#22304b] font-semibold leading-snug mt-1 flex-1">
                          {h.why}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                        <button
                          type="button"
                          onClick={() => markHitLike(h)}
                          disabled={!handle}
                          className={`text-[10px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-40 ${liked ? "text-white bg-[#18b85c] border-[#18b85c]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#18b85c]"}`}
                        >
                          <ThumbsUp className="w-3 h-3" /> Gostei
                        </button>
                        <button
                          type="button"
                          onClick={() => markHitDislike(h)}
                          disabled={!handle}
                          className={`text-[10px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-40 ${disliked ? "text-white bg-[#c20f00] border-[#c20f00]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#c20f00]"}`}
                        >
                          <ThumbsDown className="w-3 h-3" /> Não gostei
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!hits.length && rawHits.length > 0 && (
              <p className="text-[11px] text-[#61708a] font-semibold mt-3 rounded-xl bg-[#fbfcff] border border-[#e6ebf3] p-3">
                A coleta encontrou posts, mas nenhum passou no filtro de
                aderencia. Informe perfis que voce realmente considera
                referencia, ou rode uma nova busca com uma direcao mais
                especifica.
              </p>
            )}
            {hits.length > 0 && channelLikedHitKeys.length === 0 && (
              <p className="text-[11px] text-[#61708a] font-semibold mt-3 rounded-xl bg-[#fbfcff] border border-[#e6ebf3] p-3">
                Marque Gostei em pelo menos um post compatível para refazer a
                pesquisa. Se gostar de mais de um post do mesmo perfil, o Radar
                mantém só o último marcado para trazer variedade.
              </p>
            )}

            {refine.isPending && (
              <div className="mt-4">
                <AnalysisProgress
                  steps={RADAR_STEPS}
                  active={refine.isPending}
                  title="Refinando o Radar de Mercado..."
                  subtitle="Usando os posts marcados, evitando os rejeitados e buscando novos nomes com mais variedade."
                />
              </div>
            )}
          </div>

          {channelData.ideas?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ff3217]" /> Direcoes do Radar guardadas
                  </h3>
                  <p className="text-[11px] text-[#61708a] mt-1 max-w-3xl leading-relaxed">
                    O Radar encontrou caminhos possiveis, mas a criacao de posts nao acontece mais nesta tela. Use estes sinais como contexto e siga para o Estudio, onde os Agentes montam a base editavel e voce aplica o toque humano.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/estudio")}
                  className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2"
                >
                  Abrir Estudio
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
