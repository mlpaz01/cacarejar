import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2, Telescope, Sparkles, Heart, MessageCircle,
  Film, ExternalLink, Search, Target, BarChart3, Flame,
  ThumbsUp, ThumbsDown, Wand2, MessageSquare, FileDown,
} from "lucide-react";
import { AnalysisProgress, RADAR_STEPS } from "@/components/AnalysisProgress";

const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");
const hitKey = (h: any) => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`);
const hitOwner = (h: any) => String(h?.ownerUsername || "").replace(/^@/, "").toLowerCase();
const cleanHandle = (h?: string) => (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").toLowerCase();

export default function Radar() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const radar = trpc.radar.get.useQuery();
  const diagnosis = trpc.diagnosis.get.useQuery();
  const [handles, setHandles] = useState("");
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [likedHitKeys, setLikedHitKeys] = useState<string[]>([]);
  const [dislikedHitKeys, setDislikedHitKeys] = useState<string[]>([]);
  const [ideaFeedbacks, setIdeaFeedbacks] = useState<Record<number, string>>({});

  const scan = trpc.radar.scan.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Pesquisa concluída!"); },
    onError: e => toast.error(e.message || "Erro na pesquisa"),
  });
  const genIdea = trpc.radar.generateIdea.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Conteúdo gerado na sua identidade!"); },
    onError: e => toast.error(e.message || "Erro ao gerar"),
  });

  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => { toast.success("Enviado para aprovação!"); navigate("/aprovacao"); },
    onError: e => toast.error(e.message || "Erro ao enviar para aprovação"),
  });

  const decideIdea = trpc.radar.updateIdeaDecision.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Decisao salva para o Agente Especialista"); },
    onError: e => toast.error(e.message || "Erro ao salvar decisao"),
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
    onSuccess: () => { utils.diagnosis.get.invalidate(); utils.radar.get.invalidate(); toast.success("Diagnostico atualizado pelo Agente Especialista!"); navigate("/diagnostico"); },
    onError: e => toast.error(e.message || "Erro ao usar as ideias no diagnostico"),
  });

  const data = radar.data as any;
  const plan = diagnosis.data as any;
  const selectedHandle = cleanHandle(plan?.profile?.handle || plan?._redes?.instagram || plan?.redes?.instagram);
  const selectedProduto = plan?.produto || data?.baseProduto || "";
  const selectedNicho = plan?.nicho || data?.nicho || "";
  const radarBaseHandle = cleanHandle(data?.baseHandle);
  const radarLooksStale = !!data && !!radarBaseHandle && !!selectedHandle && radarBaseHandle !== selectedHandle;
  const manualHandles = handles.split(",").map(s => cleanHandle(s)).filter(Boolean);
  const canStartRadar = manualHandles.length > 0 || !!selectedHandle;
  const refineInfo = data?.feedback ?? { refinementCount: 0, freeLimit: 3, nextCostCC: 10 };
  const freeLeft = Math.max(0, (refineInfo.freeLimit ?? 3) - (refineInfo.refinementCount ?? 0));
  const ideaLikes = ((data?.ideas ?? []) as any[]).filter(it => it.diagnosisDecision === "use").length;
  const ideaDislikes = ((data?.ideas ?? []) as any[]).filter(it => it.diagnosisDecision === "skip").length;

  useEffect(() => {
    if (!data) return;
    setLikedHitKeys((data.feedback?.likedPostKeys ?? []) as string[]);
    setDislikedHitKeys((data.feedback?.dislikedPostKeys ?? []) as string[]);
    const nextFeedbacks: Record<number, string> = {};
    ((data.ideas ?? []) as any[]).forEach((idea, index) => {
      if (idea.diagnosisFeedback) nextFeedbacks[index] = idea.diagnosisFeedback;
    });
    setIdeaFeedbacks(nextFeedbacks);
  }, [data?.scannedAt]);

  const parseHandles = () => handles.split(",").map(s => cleanHandle(s)).filter(Boolean);
  const runScan = () => {
    const parsed = parseHandles();
    if (!parsed.length && !selectedHandle) {
      toast.error("Crie ou restaure um diagnostico com perfil antes de iniciar o Radar.");
      return;
    }
    scan.mutate(parsed.length ? { handles: parsed } : undefined);
  };
  const runRefine = () => refine.mutate({ likedPostKeys: likedHitKeys, dislikedPostKeys: dislikedHitKeys });
  const markHitLike = (hit: any) => {
    const key = hitKey(hit);
    const owner = hitOwner(hit);
    const sameOwnerKeys = ((data?.hits ?? []) as any[]).filter(h => hitOwner(h) === owner).map(hitKey);
    setLikedHitKeys(prev => [...prev.filter(k => !sameOwnerKeys.includes(k)), key]);
    setDislikedHitKeys(prev => prev.filter(k => k !== key));
  };
  const markHitDislike = (hit: any) => {
    const key = hitKey(hit);
    setLikedHitKeys(prev => prev.filter(k => k !== key));
    setDislikedHitKeys(prev => prev.includes(key) ? prev : [...prev, key]);
  };
  const setIdeaDecision = (index: number, decision: "use" | "skip" | "agent") => {
    decideIdea.mutate({ index, decision, feedback: ideaFeedbacks[index] });
  };
  const sendIdeasToApproval = async () => {
    const sourceIdeas = ((data?.ideas ?? []) as any[]).slice(0, 3);
    if (!sourceIdeas.length) {
      toast.error("Nenhuma ideia do Radar encontrada");
      return;
    }
    setGeneratingBatch(true);
    try {
      const creativeIds: number[] = [];
      for (const { idea, index } of sourceIdeas.map((idea, index) => ({ idea, index }))) {
        let creativeId = idea.creativeId as number | undefined;
        if (!creativeId) {
          const generated = await genIdea.mutateAsync({ index });
          creativeId = (generated as any)?.id;
        }
        if (creativeId) creativeIds.push(creativeId);
      }
      const uniqueIds = Array.from(new Set(creativeIds));
      if (!uniqueIds.length) throw new Error("Criativos nao encontrados para aprovacao");
      await sendApproval.mutateAsync({ creativeIds: uniqueIds, name: "Posts do Radar de Mercado" });
      await utils.radar.get.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao preparar posts para aprovacao");
    } finally {
      setGeneratingBatch(false);
    }
  };
  const exportPdf = () => {
    try {
      window.localStorage.setItem("cacarejar.radarFeedbackDraft", JSON.stringify({
        scannedAt: data?.scannedAt,
        likedPostKeys: likedHitKeys,
        dislikedPostKeys: dislikedHitKeys,
      }));
    } catch { /* noop */ }
    window.open("/app/diagnostico/relatorio", "_blank");
  };

  const SearchBar = (
    <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Telescope className="w-4 h-4 text-[#ff3217]" />
        <h3 className="text-sm font-black text-[#070b17]">Pesquisar o que está bombando no seu setor</h3>
      </div>
      {selectedHandle ? (
        <div className="mb-3 rounded-xl border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">Base atual do Radar</p>
            <p className="text-xs font-black text-[#071b44]">@{selectedHandle}{selectedNicho ? ` - ${selectedNicho}` : ""}</p>
          </div>
          {selectedProduto && <span className="text-[10px] font-bold text-[#61708a] bg-white border border-[#e6ebf3] rounded-full px-3 py-1 max-w-[360px] truncate">{selectedProduto}</span>}
        </div>
      ) : (
        <div className="mb-3 rounded-xl border border-[#ffd5ce] bg-[#fff8f6] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-bold text-[#8f2014]">Nenhum perfil de diagnostico selecionado. Informe @ inspiradores abaixo ou crie/restaure um diagnostico antes de iniciar o Radar.</p>
          <button onClick={() => navigate("/diagnostico")} className="text-[11px] font-black text-[#071b44] bg-white border border-[#ffd5ce] rounded-full px-3 py-1 hover:border-[#ff8a45]">Ir para Diagnostico</button>
        </div>
      )}
      {radarLooksStale && (
        <div className="mb-3 rounded-xl border border-[#ffd5ce] bg-[#fff8f6] px-3 py-2">
          <p className="text-xs font-bold text-[#8f2014]">
            A pesquisa exibida abaixo foi gerada para @{radarBaseHandle}. Para usar @{selectedHandle}, inicie um novo Radar.
          </p>
        </div>
      )}
      <p className="text-[11px] text-[#61708a] mb-3">{selectedHandle ? "Deixe em branco para o Agente usar o diagnostico selecionado, ou informe @ inspiradores para comparar perfis especificos." : "Sem diagnostico selecionado, o Radar so inicia com @ inspiradores informados manualmente."}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={handles} onChange={e => setHandles(e.target.value)} placeholder="@perfil1, @perfil2 (opcional)"
          className="flex-1 border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]" />
        <button onClick={runScan} disabled={scan.isPending || !canStartRadar}
          className="btn-action-navy text-sm px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {scan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {scan.isPending ? "Pesquisando…" : "Iniciar Radar"}
        </button>
        <button
          onClick={() => recalibrate.mutate({ feedback: "Usar os feedbacks do Radar no diagnóstico." })}
          disabled={recalibrate.isPending || !data}
          className="btn-action-primary text-sm px-5 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {recalibrate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {recalibrate.isPending ? "Recalculando..." : "Usar Feedbacks do Radar no diagnóstico"}
        </button>
      </div>
    </div>
  );

  return (
    <AppLayout
      title="Radar de Mercado"
      subtitle="O Agente Radar pesquisa os hits do seu setor e adapta para a sua marca"
      actions={
        <button onClick={exportPdf} className="text-xs font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors">
          <FileDown className="w-3.5 h-3.5" /> Exportar PDF
        </button>
      }
    >
      {SearchBar}

      {plan?.linkedin360 && (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                <Target className="w-4 h-4 text-[#ff3217]" /> Visao 360 conectada ao diagnostico
              </h3>
              <p className="text-[11px] text-[#61708a] mt-1">
                Use esses sinais para julgar os posts do Radar e para orientar anuncios no LinkedIn.
              </p>
            </div>
            <button onClick={() => navigate("/diagnostico")} className="text-[11px] font-black text-[#071b44] border border-[#e6ebf3] rounded-full px-3 py-1.5 hover:bg-[#f6f8fc]">
              Ver parecer completo
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(plan.linkedin360.niveis ?? []).map((nivel: any) => (
              <div key={nivel.nivel} className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">{nivel.nivel}</p>
                <p className="text-xs font-black text-[#071b44] mt-1">{nivel.descricao}</p>
                <div className="space-y-1 mt-2">
                  {(nivel.achados ?? []).slice(0, 2).map((achado: string) => (
                    <p key={achado} className="text-[11px] text-[#61708a] leading-snug">- {achado}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {[...(plan.linkedin360.areasAfins ?? []), ...(plan.linkedin360.cargos ?? []), ...(plan.linkedin360.tecnologias ?? [])].slice(0, 12).map((item: string) => (
              <span key={item} className="text-[10px] font-black text-[#071b44] bg-white border border-[#e6ebf3] rounded-full px-3 py-1">{item}</span>
            ))}
          </div>
        </div>
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
          <p className="text-base font-black text-[#22304b]">Descubra o que dá certo no seu mercado</p>
          <p className="text-sm text-[#61708a] mt-1 max-w-md mx-auto">O Agente encontra os posts campeões de perfis inspiradores do seu setor e cria ideias com a SUA identidade visual.</p>
        </div>
      )}

      {data && (
        <>
          {/* Inteligencia de audiencia */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#ff3217]" /> O que esta quente agora
                </h3>
                <p className="text-[11px] text-[#61708a] mt-1">
                  O Agente de Audiencia analisa sinais fora da curva, padroes vencedores e oportunidades para a sua marca.
                </p>
              </div>
              {data.quality && (
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  Pesquisa {data.quality.grade} · {data.quality.hitsCount} hits · {data.quality.sourcesCount} fontes
                </span>
              )}
            </div>

            {data.marketSummary && (
              <div className="rounded-xl bg-[#071b44] text-white p-4 mb-4">
                <p className="text-sm font-semibold leading-relaxed">{data.marketSummary}</p>
              </div>
            )}

            {data.patterns?.length > 0 && (
              <div className="mb-5">
                <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Padroes vencedores detectados
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {data.patterns.slice(0, 4).map((p: any, i: number) => (
                    <div key={i} className="rounded-xl border border-[#e6ebf3] p-4 bg-[#fbfcff]">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h5 className="text-sm font-black text-[#071b44] leading-snug">{p.title}</h5>
                        <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2 py-0.5">{p.hotScore ?? "-"} hot</span>
                      </div>
                      {p.insight && <p className="text-xs text-[#22304b] font-semibold leading-snug">{p.insight}</p>}
                      {p.whyItWorks && <p className="text-[11px] text-[#61708a] mt-2"><span className="font-black text-[#070b17]">Por que funciona:</span> {p.whyItWorks}</p>}
                      {p.recommendedMove && <p className="text-[11px] text-[#61708a] mt-1"><span className="font-black text-[#070b17]">Como usar:</span> {p.recommendedMove}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.contentMechanism && <span className="text-[9px] font-black text-[#071b44] bg-white border border-[#e6ebf3] rounded px-1.5 py-0.5">{p.contentMechanism}</span>}
                        {(p.evidenceCount ?? 0) > 0 && <span className="text-[9px] font-black text-[#61708a] bg-white border border-[#e6ebf3] rounded px-1.5 py-0.5">{p.evidenceCount} evidencias</span>}
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
                    <div key={i} className="rounded-xl border border-[#e6ebf3] p-4 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-sm font-black text-[#070b17] leading-snug">{o.title}</h5>
                        <span className="text-[10px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded-full px-2 py-0.5">{o.priorityScore ?? "-"} prioridade</span>
                      </div>
                      {o.reasonToBet && <p className="text-xs text-[#22304b] font-semibold leading-snug mt-2">{o.reasonToBet}</p>}
                      {o.suggestedAngle && <p className="text-[11px] text-[#61708a] mt-2"><span className="font-black text-[#070b17]">Angulo:</span> {o.suggestedAngle}</p>}
                      {o.firstPostIdea && <p className="text-[11px] text-[#61708a] mt-1"><span className="font-black text-[#070b17]">Primeiro post:</span> {o.firstPostIdea}</p>}
                      {o.effort && <span className="inline-flex mt-3 text-[9px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">esforco {o.effort}</span>}
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
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2"><Search className="w-4 h-4 text-[#ff3217]" /> Pesquisa de mercado</h3>
                <p className="text-[11px] text-[#61708a] mt-1">Abra o post para analisar e marque Gostei ou Não gostei direto no card. Os gostei viram referencia; os não gostei saem da proxima rodada.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  {likedHitKeys.length} gostei / {dislikedHitKeys.length} não gostei
                </span>
                <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                  {freeLeft > 0 ? `${freeLeft} refinamento(s) gratis` : `${refineInfo.nextCostCC ?? 10} CC por refinamento`}
                </span>
                {freeLeft <= 0 && (
                  <button onClick={() => navigate("/creditos")} className="text-[10px] font-black text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded-full px-3 py-1 hover:bg-white">
                    Comprar creditos
                  </button>
                )}
                <button
                  onClick={runRefine}
                  disabled={refine.isPending || likedHitKeys.length === 0}
                  className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refine.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {refine.isPending ? "Refinando..." : "Usar Feedback para refazer a pesquisa"}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#61708a] mb-3">
              Perfis analisados:{" "}
              {(data.sources ?? []).map((s: string) => (
                <span key={s} className="font-bold text-[#071b44]">@{s} </span>
              ))}
              {data.hashtags?.length > 0 && <span className="text-[#9aa7bd]">· hashtags: {data.hashtags.map((h: string) => "#" + h).join(" ")}</span>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
              {(data.hits ?? []).map((h: any, i: number) => {
                const key = hitKey(h);
                const handle = hitOwner(h);
                const liked = likedHitKeys.includes(key);
                const disliked = dislikedHitKeys.includes(key);
                return (
                  <div key={i} className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${liked ? "border-[#18b85c] bg-[#f7fff9]" : disliked ? "border-[#c20f00] bg-[#fff8f6]" : "border-[#e6ebf3] bg-white"}`}>
                    <a href={h.url} target="_blank" rel="noreferrer" className="block relative group">
                      {h.img
                        ? <img src={h.img} alt="" className="w-full aspect-square object-cover bg-[#f6f8fc]" referrerPolicy="no-referrer" />
                        : <div className="w-full aspect-square bg-[#f6f8fc] flex items-center justify-center text-[#9aa7bd]"><Telescope className="w-7 h-7" /></div>}
                      <span className="absolute right-2 top-2 text-[9px] font-black text-white bg-black/60 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Abrir post <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </a>
                    <div className="p-2 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-1">
                        <a href={h.url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-[#071b44] hover:text-[#ff3217] flex items-center gap-1 truncate">@{h.ownerUsername} <ExternalLink className="w-2.5 h-2.5" /></a>
                        <span className={`text-[9px] font-black rounded-full px-2 py-0.5 flex-shrink-0 ${liked ? "bg-[#18b85c] text-white" : disliked ? "bg-[#c20f00] text-white" : "bg-[#eef2f7] text-[#61708a]"}`}>
                          {liked ? "gostei" : disliked ? "não gostei" : "sem marcação"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[#61708a] mt-0.5">
                        <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-[#ff3217]" /> {nf(h.likes)}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {nf(h.comments)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {typeof h.hotScore === "number" && <span className="text-[9px] font-black text-white bg-[#ff3217] rounded px-1.5 py-0.5">{h.hotScore} hot</span>}
                        {typeof h.engagementRate === "number" && <span className="text-[9px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">{h.engagementRate}% eng.</span>}
                        {typeof h.outlierScore === "number" && h.outlierScore > 1.2 && <span className="text-[9px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded px-1.5 py-0.5">{h.outlierScore}x perfil</span>}
                      </div>
                      {h.mechanism && <p className="text-[9px] text-[#ff3217] font-black uppercase tracking-wide mt-1">{h.mechanism}</p>}
                      {h.why && <p className="text-[10px] text-[#22304b] font-semibold leading-snug mt-1 flex-1">{h.why}</p>}
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
                Marque Gostei em pelo menos um post compatível para refazer a pesquisa. Se gostar de mais de um post do mesmo perfil, o Radar mantém só o último marcado para trazer variedade.
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

          {/* Ideias adaptadas */}
          {data.ideas?.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <div>
                  <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#ff3217]" /> Ideias para voce (na sua identidade)</h3>
                  <p className="text-[11px] text-[#61708a] mt-1">{ideaLikes} gostei / {ideaDislikes} não gostei. O Agente Especialista decide o que ficar em aberto.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={sendIdeasToApproval} disabled={generatingBatch || genIdea.isPending || sendApproval.isPending}
                    className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {generatingBatch || genIdea.isPending || sendApproval.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {generatingBatch || genIdea.isPending || sendApproval.isPending ? "Preparando..." : "Gerar posts para aprovacao"}
                  </button>
                  <button onClick={() => recalibrate.mutate({ feedback: "Usar as ideias do Radar como parte do diagnostico." })} disabled={recalibrate.isPending}
                    className="btn-action-secondary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {recalibrate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Usar Feedbacks de ideias no Diagnóstico
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#61708a] mb-3">Cada ideia adapta um hit do mercado para a sua marca. Marque seus feedbacks; os posts sao gerados direto em Revisar e publicar.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {data.ideas.map((it: any, i: number) => {
                  const gen = genIdea.isPending && (genIdea.variables as any)?.index === i;
                  const decision = it.diagnosisDecision ?? "agent";
                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden flex flex-col ${decision === "use" ? "border-[#18b85c]" : decision === "skip" ? "border-[#ffd0c8]" : "border-[#e6ebf3]"}`}>
                      {it.imageUrl
                        ? <img src={it.imageUrl} alt="" className="w-full aspect-square object-cover bg-[#f6f8fc]" />
                        : <div className="w-full aspect-square bg-[#f6f8fc] flex flex-col items-center justify-center text-[#9aa7bd] gap-1 relative">
                            {gen ? <Loader2 className="w-7 h-7 animate-spin text-[#ff3217]" /> : <Sparkles className="w-7 h-7" />}
                            <span className="text-[10px] font-bold">{gen ? "Gerando…" : "Ideia (sem imagem ainda)"}</span>
                          </div>}
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {it.fonte && <span className="text-[9px] font-black text-[#ff3217] bg-[#fff1ef] rounded px-1.5 py-0.5">inspirado em @{it.fonte}</span>}
                          {it.priorityScore && <span className="text-[9px] font-black text-[#18b85c] bg-[#eafff1] border border-[#bfeccb] rounded px-1.5 py-0.5">{it.priorityScore} prioridade</span>}
                          {it.formato && <span className="text-[9px] font-black text-[#61708a] bg-[#f1f4f9] rounded px-1.5 py-0.5 uppercase flex items-center gap-0.5">{it.formato === "reels" && <Film className="w-2.5 h-2.5" />}{it.formato}</span>}
                        </div>
                        {it.opportunityTitle && <p className="text-[10px] text-[#61708a] font-bold mb-1">Oportunidade: {it.opportunityTitle}</p>}
                        {it.gancho && <p className="text-xs font-black text-[#070b17] leading-snug mb-1">{it.gancho}</p>}
                        {it.copy && <p className="text-[11px] text-[#22304b] font-semibold leading-snug flex-1">{it.copy}</p>}
                        {Array.isArray(it.hashtags) && it.hashtags.length > 0 && (
                          <p className="text-[10px] text-[#ff3217] font-bold mt-1">{it.hashtags.map((h: string) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</p>
                        )}
                        {it.cta && <p className="text-[10px] text-[#61708a] mt-1"><span className="font-black">CTA:</span> {it.cta}</p>}
                        <div className="mt-2.5 rounded-lg border border-[#e6ebf3] bg-[#fbfcff] p-2">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[10px] font-black rounded-full px-2 py-1 ${
                              decision === "use" ? "text-[#087a32] bg-[#eafff1] border border-[#bfeccb]"
                              : decision === "skip" ? "text-[#c20f00] bg-[#fff1ef] border border-[#ffd0c8]"
                              : "text-[#071b44] bg-[#eef2f7] border border-[#dbe3ef]"
                            }`}>
                              {decision === "use" ? "Gostei - entra no diagnostico" : decision === "skip" ? "Não gostei - não usar" : "Agente Especialista decide"}
                            </span>
                            {it.diagnosisReason && <span className="text-[9px] text-[#61708a] font-bold truncate">{it.diagnosisReason}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button type="button" onClick={() => setIdeaDecision(i, "use")} disabled={decideIdea.isPending}
                              className={`text-[9px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1 disabled:opacity-50 ${decision === "use" ? "text-white bg-[#18b85c] border-[#18b85c]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#18b85c]"}`}>
                              <ThumbsUp className="w-3 h-3" /> Gostei
                            </button>
                            <button type="button" onClick={() => setIdeaDecision(i, "skip")} disabled={decideIdea.isPending}
                              className={`text-[9px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1 disabled:opacity-50 ${decision === "skip" ? "text-white bg-[#c20f00] border-[#c20f00]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#c20f00]"}`}>
                              <ThumbsDown className="w-3 h-3" /> Não gostei
                            </button>
                          </div>
                          <div className="mt-2 flex items-start gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-[#9aa7bd] mt-1 flex-shrink-0" />
                            <textarea value={ideaFeedbacks[i] ?? ""} onChange={e => setIdeaFeedbacks(prev => ({ ...prev, [i]: e.target.value }))}
                              onBlur={() => (ideaFeedbacks[i] ?? "") !== (it.diagnosisFeedback ?? "") && setIdeaDecision(i, decision)}
                              placeholder="Observacao para o Agente sobre esta ideia"
                              className="w-full min-h-[54px] text-[10px] border border-[#e6ebf3] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#ff3217]" />
                          </div>
                        </div>
                        {it.roteiro && (
                          <details className="mt-2">
                            <summary className="text-[10px] font-black text-[#071b44] cursor-pointer flex items-center gap-1"><Film className="w-3 h-3" /> Ver roteiro</summary>
                            <div className="mt-1.5 rounded-lg bg-[#f6f8fc] p-2 space-y-1">
                              <p className="text-[10px] font-bold text-[#070b17]">🎬 {it.roteiro.gancho3s}</p>
                              {(it.roteiro.cenas ?? []).map((c: any, j: number) => (
                                <div key={j} className="text-[10px] text-[#22304b] flex gap-1.5"><span className="font-black whitespace-nowrap">{c.tempo}</span><span>{c.acao} <span className="opacity-60">· {c.audio}</span></span></div>
                              ))}
                              {it.roteiro.cta && <p className="text-[10px]"><span className="font-black">CTA:</span> {it.roteiro.cta}</p>}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
