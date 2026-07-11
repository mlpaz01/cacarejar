import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
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
const cleanHandle = (h?: string) =>
  (h || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
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
]);

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
      toast.success("Diagnostico atualizado pelo Agente Especialista!");
      navigate("/diagnostico");
    },
    onError: e =>
      toast.error(e.message || "Erro ao usar as ideias no diagnostico"),
  });

  const data = radar.data as any;
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
    .map(s => cleanHandle(s))
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
  const hits = (data?.hits ?? []) as any[];
  const dataQuality = (data as any)?.dataQuality;
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
      .slice(0, 6);
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
    () => topSocialTerms(hits, data?.hashtags ?? []),
    [hits, data?.hashtags]
  );

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
      .map(s => cleanHandle(s))
      .filter(Boolean);
  const runScan = () => {
    const parsed = parseHandles();
    if (!parsed.length && !hasDiagnosisContext) {
      toast.error(
        "Crie ou restaure um diagnostico com perfil antes de iniciar o Radar."
      );
      return;
    }
    scan.mutate(parsed.length ? { handles: parsed } : undefined);
  };
  const useSuggestedProfiles = () => {
    const profiles = (suggestedSources.data?.profiles ?? [])
      .map(cleanHandle)
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
      likedPostKeys: likedHitKeys,
      dislikedPostKeys: dislikedHitKeys,
    });
  const markHitLike = (hit: any) => {
    const key = hitKey(hit);
    const owner = hitOwner(hit);
    const sameOwnerKeys = ((data?.hits ?? []) as any[])
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
      data.marketSummary || "Sem resumo registrado.",
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

  const SearchBar = (
    <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Telescope className="w-4 h-4 text-[#ff3217]" />
        <h3 className="text-sm font-black text-[#070b17]">
          Pesquisar o que está bombando no seu setor
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
            Nenhum perfil de diagnostico selecionado. Informe @ inspiradores
            abaixo ou crie/restaure um diagnostico antes de iniciar o Radar.
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
          ? "Deixe em branco para o Agente usar o diagnostico selecionado, ou informe @ inspiradores para comparar perfis especificos."
          : "Sem diagnostico selecionado, o Radar so inicia com @ inspiradores informados manualmente."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={handles}
          onChange={e => setHandles(e.target.value)}
          placeholder="@perfil1, @perfil2 (opcional)"
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
          {scan.isPending ? "Pesquisando…" : "Iniciar Radar"}
        </button>
        <button
          onClick={() =>
            recalibrate.mutate({
              feedback: "Usar os feedbacks do Radar no diagnóstico.",
            })
          }
          disabled={recalibrate.isPending || !data}
          className="btn-action-primary text-sm px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {recalibrate.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {recalibrate.isPending
            ? "Recalculando..."
            : "Usar Feedbacks do Radar no diagnóstico"}
        </button>
      </div>
      {hasDiagnosisContext && !!suggestedSources.data?.hashtags?.length && (
        <p className="mt-3 text-[11px] text-[#61708a]">
          Sinais preparados pelo Agente:{" "}
          {(suggestedSources.data.hashtags as string[])
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
      subtitle="O Agente Radar pesquisa os hits do seu setor e adapta para a sua marca"
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
      {SearchBar}

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

      {!scan.isPending && !data && (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-12 shadow-sm text-center">
          <Telescope className="w-12 h-12 text-[#cfd8e6] mx-auto mb-3" />
          <p className="text-base font-black text-[#22304b]">
            Descubra o que dá certo no seu mercado
          </p>
          <p className="text-sm text-[#61708a] mt-1 max-w-md mx-auto">
            O Agente encontra os posts campeões de perfis inspiradores do seu
            setor e cria ideias com a SUA identidade visual.
          </p>
        </div>
      )}

      {data && (
        <>
          {/* Inteligencia de audiencia */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
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
              {data.quality && (
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  Pesquisa {data.quality.grade} · {data.quality.hitsCount} hits
                  · {data.quality.sourcesCount} fontes
                </span>
              )}
            </div>

            {data.marketSummary && (
              <div className="rounded-xl bg-[#071b44] text-white p-4 mb-4">
                <p className="text-sm font-semibold leading-relaxed">
                  {data.marketSummary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#ff3217]" /> Biblioteca
                    de concorrentes
                  </h4>
                  <button
                    onClick={copyRadarPackage}
                    className="text-[10px] font-black text-[#071b44] border border-[#e6ebf3] bg-white rounded-full px-2.5 py-1 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <div className="space-y-2 mt-3">
                  {sourceStats.length ? (
                    sourceStats.map((s: any) => (
                      <div
                        key={s.owner}
                        className="rounded-lg bg-white border border-[#e6ebf3] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">
                            @{s.owner}
                          </p>
                          <span className="text-[9px] font-black text-white bg-[#ff3217] rounded-full px-2 py-0.5">
                            {s.avgHot} hot
                          </span>
                        </div>
                        <p className="text-[10px] text-[#61708a] mt-0.5">
                          {s.count} hit(s) - {s.topMechanism}
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

            {data.patterns?.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Padroes vencedores
                  detectados
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {data.patterns.slice(0, 4).map((p: any, i: number) => (
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

            {data.opportunities?.length > 0 && (
              <div>
                <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Oportunidades para apostar
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {data.opportunities.slice(0, 4).map((o: any, i: number) => (
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

          {/* Cita a pesquisa */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <div>
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#ff3217]" /> Pesquisa de
                  mercado
                </h3>
                <p className="text-[11px] text-[#61708a] mt-1">
                  Abra o post para analisar e marque Gostei ou Não gostei direto
                  no card. Os gostei viram referencia; os não gostei saem da
                  proxima rodada.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  {likedHitKeys.length} gostei / {dislikedHitKeys.length} não
                  gostei
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
                  disabled={refine.isPending || likedHitKeys.length === 0}
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
              {(data.sources ?? []).map((s: string) => (
                <span key={s} className="font-bold text-[#071b44]">
                  @{s}{" "}
                </span>
              ))}
              {data.hashtags?.length > 0 && (
                <span className="text-[#9aa7bd]">
                  · hashtags:{" "}
                  {data.hashtags.map((h: string) => "#" + h).join(" ")}
                </span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
              {(data.hits ?? []).map((h: any, i: number) => {
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
            {(data?.hits?.length ?? 0) > 0 && likedHitKeys.length === 0 && (
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

          {data.ideas?.length > 0 && (
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
                  onClick={() => navigate("/criativos")}
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
