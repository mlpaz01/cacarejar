import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2, Sparkles, ArrowRight, RotateCcw, Image as ImageIcon, Send,
  Users, UserPlus, Grid3x3, TrendingUp, BadgeCheck, Heart, MessageCircle, Copy, Upload,
  Target, Palette, Film, Pencil, Calendar, Flag, Telescope, Flame, FileDown, History, Trash2, AlertTriangle, Search,
  ThumbsUp, ThumbsDown, ExternalLink, Wand2, MessageSquare,
} from "lucide-react";
import { AnalysisProgress, pickDiagnosisSteps, RADAR_STEPS } from "@/components/AnalysisProgress";

const OBJETIVOS = [
  { v: "vender", label: "Vender mais" },
  { v: "leads", label: "Gerar leads" },
  { v: "seguidores", label: "Crescer seguidores" },
  { v: "lancar", label: "Lançar produto" },
] as const;

const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");
const hitKey = (h: any) => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`);
const hitOwner = (h: any) => String(h?.ownerUsername || "").replace(/^@/, "").toLowerCase();
const absoluteUrl = (url?: string) => {
  const u = String(url || "").trim();
  return !u || /^https?:\/\//i.test(u) ? u : `https://${u}`;
};

export default function Diagnostico() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const existing = trpc.diagnosis.get.useQuery();

  const [produto, setProduto] = useState("");
  const [objetivo, setObjetivo] = useState<"vender" | "leads" | "seguidores" | "lancar">("vender");
  const [redes, setRedes] = useState({ instagram: "", tiktok: "", linkedin: "", site: "" });
  const [sobre, setSobre] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [forceForm, setForceForm] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [generatingRadarBatch, setGeneratingRadarBatch] = useState(false);
  const [likedRadarHitKeys, setLikedRadarHitKeys] = useState<string[]>([]);
  const [dislikedRadarHitKeys, setDislikedRadarHitKeys] = useState<string[]>([]);
  const [radarIdeaFeedbacks, setRadarIdeaFeedbacks] = useState<Record<number, string>>({});
  const [approvingRadarIdeaIndex, setApprovingRadarIdeaIndex] = useState<number | null>(null);
  const [approvingCreativeId, setApprovingCreativeId] = useState<number | null>(null);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState("");

  const analyze = trpc.diagnosis.analyze.useMutation({
    onSuccess: p => { setPlan(p); setForceForm(false); setProposals([]); utils.diagnosis.get.invalidate(); utils.radar.get.invalidate(); toast.success("Estudo concluído!"); },
    onError: e => toast.error(e.message || "Erro ao analisar"),
  });
  const genProposals = trpc.studio.generateProposals.useMutation({
    onSuccess: d => {
      setProposals(d.creatives ?? []);
      // os ids/imageUrls foram persistidos no planoJson — recarrega o plano para refletir
      utils.diagnosis.get.invalidate();
      toast.success(`${d.generated} posts gerados no estilo do seu perfil!`);
    },
    onError: e => toast.error(e.message || "Erro ao gerar posts"),
  });
  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => { toast.success("Enviado para aprovação!"); navigate("/aprovacao"); },
    onError: e => toast.error(e.message || "Erro ao enviar"),
  });
  const importImg = trpc.studio.importImageUrl.useMutation({
    onSuccess: r => { sessionStorage.setItem("clone_ref", r.url); toast.success("Post selecionado — abrindo o Estúdio para clonar"); navigate("/estudio"); },
    onError: () => toast.error("Não consegui importar a imagem do post"),
  });
  const uploadRef = trpc.studio.uploadReference.useMutation();

  const radar = trpc.radar.get.useQuery();
  const rd: any = radar.data;
  const archive = trpc.diagnosis.archive.useMutation();
  const archives = trpc.diagnosis.archives.useQuery();
  const restoreArchive = trpc.diagnosis.restoreArchive.useMutation({
    onSuccess: () => { utils.diagnosis.get.invalidate(); utils.radar.get.invalidate(); archives.refetch(); setForceForm(false); setShowHistory(false); setPlan(null); toast.success("Estudo restaurado!"); },
    onError: e => toast.error(e.message || "Erro ao restaurar"),
  });
  const deleteArchive = trpc.diagnosis.deleteArchive.useMutation({
    onSuccess: () => { archives.refetch(); toast.success("Estudo arquivado removido"); setConfirmDeleteArchive(null); },
    onError: e => toast.error(e.message || "Erro ao excluir"),
  });
  const [confirmDeleteArchive, setConfirmDeleteArchive] = useState<{ id: string; label: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<{ oldHandle: string; newHandle: string } | null>(null);
  const scanRadar = trpc.radar.scan.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Pesquisa de mercado concluída!"); },
    onError: e => toast.error(e.message || "Erro na pesquisa de mercado"),
  });
  const genRadarIdea = trpc.radar.generateIdea.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Post do Radar gerado na sua identidade!"); },
    onError: e => toast.error(e.message || "Erro ao gerar post do Radar"),
  });
  const refineRadar = trpc.radar.refine.useMutation({
    onSuccess: () => {
      utils.radar.get.invalidate();
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
      toast.success("Radar retroalimentado com os perfis marcados!");
    },
    onError: e => toast.error(e.message || "Erro ao retroalimentar o Radar"),
  });
  const decideRadarIdea = trpc.radar.updateIdeaDecision.useMutation({
    onSuccess: () => { utils.radar.get.invalidate(); toast.success("Decisao salva para o Agente Especialista"); },
    onError: e => toast.error(e.message || "Erro ao salvar decisao"),
  });
  const recalibrate = trpc.diagnosis.recalibrate.useMutation({
    onSuccess: p => {
      setPlan(p);
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      toast.success("Diagnostico recalibrado pelo Agente Especialista!");
    },
    onError: e => toast.error(e.message || "Erro ao recalibrar diagnostico"),
  });

  const generateRadarBatch = async (items: any[]) => {
    const pending = items.map((it, index) => ({ it, index })).filter(({ it }) => !(it.creativeId ?? it.id));
    if (!pending.length) return;
    setGeneratingRadarBatch(true);
    try {
      for (const { index } of pending) await genRadarIdea.mutateAsync({ index });
      await utils.radar.get.invalidate();
      toast.success(`${pending.length} imagens do Radar geradas!`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar imagens do Radar");
    } finally {
      setGeneratingRadarBatch(false);
    }
  };

  const sendRadarIdeaToApproval = async (index: number, idea: any) => {
    setApprovingRadarIdeaIndex(index);
    try {
      let creativeId = (idea.creativeId ?? idea.id) as number | undefined;
      if (!creativeId) {
        const generated = await genRadarIdea.mutateAsync({ index });
        creativeId = (generated as any)?.id;
        await utils.radar.get.invalidate();
      }
      if (!creativeId) throw new Error("Criativo não encontrado para aprovação");
      await sendApproval.mutateAsync({ creativeIds: [creativeId], name: idea.titulo || "Post do Radar" });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar para aprovação");
    } finally {
      setApprovingRadarIdeaIndex(null);
    }
  };

  const sendCreativeToApproval = async (creativeId: number, name?: string) => {
    setApprovingCreativeId(creativeId);
    try {
      await sendApproval.mutateAsync({ creativeIds: [creativeId], name });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar para aprovação");
    } finally {
      setApprovingCreativeId(null);
    }
  };

  const cleanH = (h: string) => (h || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "").toLowerCase();
  const prepareRedes = () => {
    const next = { ...redes };
    if (!next.linkedin?.trim() && /linkedin\.com/i.test(next.site || "")) {
      next.linkedin = next.site.trim();
      next.site = "";
      setRedes(next);
    }
    return next;
  };
  const setRadarIdeaDecision = (index: number, decision: "use" | "skip" | "agent") => {
    decideRadarIdea.mutate({ index, decision, feedback: radarIdeaFeedbacks[index] });
  };
  const letAgentDecideRadarIdeas = async (items: any[]) => {
    try {
      for (let i = 0; i < items.length; i++) {
        await decideRadarIdea.mutateAsync({ index: i, decision: "agent", feedback: radarIdeaFeedbacks[i] });
      }
      await recalibrate.mutateAsync({ feedback: diagnosisFeedback || "Usuario pediu para o Agente Especialista decidir pelas ideias em aberto." });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao acionar o Agente Especialista");
    }
  };

  const openBlankDiagnosis = () => {
    setPlan(null);
    setForceForm(true);
    setShowHistory(false);
    setProposals([]);
    setArchiveSearch("");
    setProduto("");
    setSobre("");
    setObjetivo("vender");
    setRedes({ instagram: "", tiktok: "", linkedin: "", site: "" });
  };

  useEffect(() => {
    if (!rd) return;
    setLikedRadarHitKeys((rd.feedback?.likedPostKeys ?? []) as string[]);
    setDislikedRadarHitKeys((rd.feedback?.dislikedPostKeys ?? []) as string[]);
    const nextFeedbacks: Record<number, string> = {};
    ((rd.ideas ?? []) as any[]).forEach((idea, index) => {
      if (idea.diagnosisFeedback) nextFeedbacks[index] = idea.diagnosisFeedback;
    });
    setRadarIdeaFeedbacks(nextFeedbacks);
  }, [rd?.scannedAt]);

  /** Dispara o analyze.
   *  - Mesmo @ → só atualiza (backend faz rate-limit de 3x/24h)
   *  - @ diferente → modal de confirmação (perde plano + radar)
   *  - Sem plano salvo → estudo direto */
  const runAnalyze = () => {
    const nextRedes = prepareRedes();
    const existingHandle = (existing.data as any)?.profile?.handle ? cleanH((existing.data as any).profile.handle) : "";
    const newHandle = cleanH(nextRedes.instagram || "");
    const hasSavedPlan = !!(existing.data as any)?.sumarioExecutivo || !!(existing.data as any)?.resumo;
    if (hasSavedPlan && existingHandle && newHandle && existingHandle !== newHandle) {
      setConfirmReset({ oldHandle: existingHandle, newHandle });
      return;
    }
    analyze.mutate({ produto, objetivo, redes: nextRedes, sobre });
  };

  /** Executa o estudo após escolha no modal — pode arquivar ou descartar o antigo. */
  const doAnalyzeWith = async (archiveOld: boolean) => {
    setConfirmReset(null);
    try {
      if (archiveOld) await archive.mutateAsync({ reason: "perfil-trocado" });
      // mesmo sem arquivar, o backend faz upsert e o frontend recarrega — perde naturalmente o anterior
      analyze.mutate({ produto, objetivo, redes: prepareRedes(), sobre });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao arquivar plano atual");
    }
  };

  const handleOwnPost = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try { const r = await uploadRef.mutateAsync({ dataUrl: String(reader.result) }); sessionStorage.setItem("clone_ref", r.url); toast.success("Post enviado — abrindo o Estúdio"); navigate("/estudio"); }
      catch { toast.error("Erro ao enviar imagem"); }
    };
    reader.readAsDataURL(file);
  };

  const activeDiagnosisItem = (() => {
    const current: any = existing.data;
    if (!current) return null;
    return {
      id: "active-current",
      active: true,
      archivedAt: null,
      handle: current.profile?.handle ?? null,
      nicho: current.nicho ?? current.diagnostico?.nicho ?? null,
      produto: current.produto ?? null,
      summary: (current.sumarioExecutivo ?? current.resumo ?? "").slice(0, 160) || null,
      hasRadar: !!rd,
      postCount: Array.isArray(current.postIdeas) ? current.postIdeas.length : 0,
      radarIdeasCount: Array.isArray(rd?.ideas) ? rd.ideas.length : 0,
    };
  })();

  const savedDiagnosisItems = (() => {
    const source = [
      ...(activeDiagnosisItem ? [activeDiagnosisItem] : []),
      ...[...(archives.data ?? [])].reverse(),
    ];
    const q = archiveSearch.trim().toLowerCase();
    return q
      ? source.filter((a: any) => [a.handle, a.nicho, a.produto, a.summary].filter(Boolean).join(" ").toLowerCase().includes(q))
      : source;
  })();

  if (showHistory) {
    return (
      <AppLayout
        title="Historico de diagnosticos"
        subtitle="Pesquise, restaure ou remova estudos antigos sem misturar com o diagnóstico atual."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(false)} className="text-xs font-bold text-[#61708a] hover:text-[#071b44] flex items-center gap-1.5 px-3 py-2">
              <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Voltar
            </button>
            <button onClick={() => { setShowHistory(false); setPlan(null); setForceForm(true); setProposals([]); }} className="btn-action-secondary text-sm px-5 py-2.5 flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Criar novo diagnostico
            </button>
          </div>
        }
      >
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
            <div>
              <h3 className="text-lg font-black text-[#070b17] flex items-center gap-2"><History className="w-5 h-5 text-[#ff3217]" /> Diagnosticos salvos</h3>
              <p className="text-sm text-[#61708a] mt-1">Use a busca para localizar por perfil, nicho, produto ou resumo.</p>
            </div>
            <span className="text-xs font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1.5">{savedDiagnosisItems.length} de {(archives.data?.length ?? 0) + (activeDiagnosisItem ? 1 : 0)}</span>
          </div>

          <div className="flex items-center gap-2 border border-[#e6ebf3] rounded-xl px-4 py-3 bg-[#f6f8fc] mb-5">
            <Search className="w-4 h-4 text-[#9aa7bd] flex-shrink-0" />
            <input value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} placeholder="Pesquisar por @, nicho, produto ou resumo" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[#9aa7bd]" />
            {archiveSearch && <button onClick={() => setArchiveSearch("")} className="text-xs font-black text-[#61708a] hover:text-[#ff3217]">Limpar</button>}
          </div>

          {savedDiagnosisItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {savedDiagnosisItems.map((a: any) => {
                const when = a.active ? "Atual" : a.archivedAt ? new Date(a.archivedAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
                const label = a.handle ? `@${a.handle}` : a.nicho ?? a.produto ?? "este estudo";
                return (
                  <div key={a.id ?? a.index} className={`rounded-xl border p-5 flex flex-col bg-white hover:shadow-sm transition-all ${a.active ? "border-[#ff3217]" : "border-[#e6ebf3] hover:border-[#ffd0c8]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {a.handle ? <p className="text-base font-black text-[#071b44] truncate">@{a.handle}</p> : <p className="text-base font-black text-[#61708a]">(sem perfil)</p>}
                        <p className="text-xs text-[#9aa7bd] font-bold mt-1">{when}</p>
                      </div>
                      {!a.active && (
                        <button onClick={() => setConfirmDeleteArchive({ id: a.id, label })} className="text-[#c20f00] hover:bg-[#fff1ef] border border-transparent hover:border-[#ffd0c8] rounded-lg p-2 transition-colors flex-shrink-0" title="Excluir estudo arquivado">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {a.active && <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2.5 py-1 w-fit mt-3">Atual</span>}
                    {a.nicho && <p className="text-xs text-[#ff3217] font-black uppercase tracking-wide mt-3">{a.nicho}</p>}
                    {a.produto && <p className="text-xs text-[#61708a] font-bold mt-1 line-clamp-1">{a.produto}</p>}
                    {a.summary && <p className="text-sm text-[#22304b] leading-relaxed mt-3 flex-1 line-clamp-3">{a.summary}</p>}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(a.postCount ?? 0) > 0 && <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-2.5 py-1">{a.postCount} posts</span>}
                      {a.hasRadar && <span className="text-[10px] font-black text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded-full px-2.5 py-1">Radar{a.radarIdeasCount ? `: ${a.radarIdeasCount}` : ""}</span>}
                    </div>
                    {a.active ? (
                      <button onClick={() => { setShowHistory(false); setForceForm(false); setPlan(null); }} className="btn-action-secondary mt-5 text-sm px-4 py-2.5 flex items-center justify-center gap-2">
                        Abrir diagnostico atual
                      </button>
                    ) : (
                      <button onClick={() => a.id && restoreArchive.mutate({ id: a.id })} disabled={restoreArchive.isPending || !a.id} className="mt-5 text-sm font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#ff3217] hover:bg-[#fff8f6] rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                        {restoreArchive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restaurar este diagnostico
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#d9e1ee] bg-[#f6f8fc] p-10 text-center">
              <p className="text-sm font-black text-[#22304b]">Nenhum diagnóstico encontrado</p>
              <p className="text-xs text-[#61708a] mt-1">Tente outro termo de busca.</p>
            </div>
          )}
        </div>

        {confirmDeleteArchive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteArchive(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-full bg-[#fff1ef] flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-[#c20f00]" />
              </div>
              <h2 className="text-lg font-black text-[#070b17]">Excluir estudo arquivado?</h2>
              <p className="text-sm text-[#22304b] mt-2 leading-relaxed">
                Você vai apagar definitivamente o estudo de <span className="font-black">{confirmDeleteArchive.label}</span>.
              </p>
              <p className="text-[11px] text-[#61708a] mt-2">Esta ação não pode ser desfeita.</p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => setConfirmDeleteArchive(null)} className="text-xs font-bold text-[#070b17] border border-[#e6ebf3] hover:bg-[#f6f8fc] px-4 py-2.5 rounded-lg">Cancelar</button>
                <button onClick={() => deleteArchive.mutate({ id: confirmDeleteArchive.id })} disabled={deleteArchive.isPending} className="text-xs font-black text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "#c20f00" }}>
                  {deleteArchive.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }

  const shown = plan ?? (forceForm ? null : existing.data);

  // ════════════════════ RELATÓRIO ════════════════════
  if (shown) {
    const prof = shown.profile;
    const dna = shown.brandDNA;
    // Fonte da verdade = postIdeas do plano salvo (com creativeId/imageUrl persistidos).
    // Mescla o estado local `proposals` por cima como fallback imediato pós-geração (antes do refetch).
    const baseIdeas = (shown.postIdeas ?? []) as any[];
    const ideas: any[] = baseIdeas.length
      ? baseIdeas.map((it, i) => proposals[i] ? { ...it, ...proposals[i] } : it)
      : proposals;
    const radarIdeas: any[] = ((rd?.ideas ?? []) as any[]).slice(0, 3);
    const radarIdeaLikes = radarIdeas.filter(it => it.diagnosisDecision === "use").length;
    const radarIdeaDislikes = radarIdeas.filter(it => it.diagnosisDecision === "skip").length;
    const hottestRadarHits: any[] = ((rd?.hits ?? []) as any[])
      .slice()
      .sort((a, b) => (b.hotScore ?? ((b.likes ?? 0) + (b.comments ?? 0))) - (a.hotScore ?? ((a.likes ?? 0) + (a.comments ?? 0))))
      .slice(0, 4);
    const visibleRadarHitKeys = hottestRadarHits.map(hitKey);
    const selectedVisibleRadarHitKeys = likedRadarHitKeys.filter(k => visibleRadarHitKeys.includes(k));
    const dislikedVisibleRadarHitKeys = dislikedRadarHitKeys.filter(k => visibleRadarHitKeys.includes(k));
    const radarRefineInfo = rd?.feedback ?? { refinementCount: 0, freeLimit: 3, nextCostCC: 10 };
    const radarFreeLeft = Math.max(0, (radarRefineInfo.freeLimit ?? 3) - (radarRefineInfo.refinementCount ?? 0));
    const radarCreativeIds = radarIdeas.map(i => i.creativeId ?? i.id).filter(Boolean);
    const preparingPosts = genProposals.isPending || scanRadar.isPending || genRadarIdea.isPending || generatingRadarBatch || sendApproval.isPending;
    const preparePostsForApproval = async () => {
      try {
        let strategicIds = ideas.map(i => i.creativeId ?? i.id).filter(Boolean);
        if (strategicIds.length === 0) {
          const generated = await genProposals.mutateAsync();
          strategicIds = (generated.creatives ?? []).map((c: any) => c.id).filter(Boolean);
        }

        let radarSource: any = rd;
        if (!radarSource?.ideas?.length) {
          radarSource = await scanRadar.mutateAsync(undefined);
          await utils.radar.get.invalidate();
        }
        const approvalRadarIdeas: any[] = ((radarSource?.ideas ?? []) as any[]).slice(0, 3);
        const nextRadarIds = approvalRadarIdeas.map(i => i.creativeId ?? i.id).filter(Boolean);
        const pendingRadar = approvalRadarIdeas
          .map((it, index) => ({ it, index }))
          .filter(({ it }) => !(it.creativeId ?? it.id));
        if (pendingRadar.length > 0) {
          setGeneratingRadarBatch(true);
          for (const { index } of pendingRadar) {
            const generated = await genRadarIdea.mutateAsync({ index });
            const id = (generated as any)?.id;
            if (id) nextRadarIds.push(id);
          }
          setGeneratingRadarBatch(false);
        }

        const creativeIds = Array.from(new Set([...strategicIds, ...nextRadarIds])).filter(Boolean);
        if (!creativeIds.length) throw new Error("Nenhum post gerado para aprovação");
        await sendApproval.mutateAsync({
          creativeIds,
          name: nextRadarIds.length ? "Posts do Diagnostico + Radar" : "Posts do Diagnostico",
        });
        await Promise.allSettled([utils.diagnosis.get.invalidate(), utils.radar.get.invalidate()]);
      } catch (e: any) {
        setGeneratingRadarBatch(false);
        toast.error(e?.message || "Erro ao preparar posts para aprovação");
      }
    };
    const exportDiagnosisPdf = () => {
      try {
        window.localStorage.setItem("cacarejar.radarFeedbackDraft", JSON.stringify({
          scannedAt: rd?.scannedAt,
          likedPostKeys: likedRadarHitKeys,
          dislikedPostKeys: dislikedRadarHitKeys,
        }));
      } catch { /* noop */ }
      window.open("/app/diagnostico/relatorio", "_blank");
    };
    const e = shown.estrategia ?? {};
    return (
      <AppLayout
        title="Estudo do seu negócio"
        subtitle="Plano feito pelo Agente Estrategista"
        actions={
          <div className="flex gap-2">
            <span className="hidden sm:flex text-xs font-black text-[#087a32] bg-[#eafff1] border border-[#bfeccb] rounded-lg items-center gap-1.5 px-3 py-2">
              <BadgeCheck className="w-3.5 h-3.5" /> Salvo automaticamente
            </span>
            <button onClick={() => setShowHistory(true)} className="text-xs font-bold text-[#61708a] hover:text-[#071b44] flex items-center gap-1.5 px-3 py-2">
              <History className="w-3.5 h-3.5" /> Ver Historico
            </button>
            <button onClick={() => {
              const h = cleanH((shown.profile?.handle) || "");
              if (!h) { setPlan(null); setForceForm(true); setProposals([]); return; }
              analyze.mutate({
                produto: shown.produto ?? "", objetivo: "vender",
                redes: { instagram: h, ...((shown as any)._redes ?? {}) }, sobre: "",
              });
            }} disabled={analyze.isPending} className="text-xs font-bold text-[#61708a] hover:text-[#ff3217] flex items-center gap-1.5 px-3 py-2 disabled:opacity-50" title="Re-lê o perfil atual e atualiza o estudo (limite 3/24h)">
              <RotateCcw className="w-3.5 h-3.5" /> Atualizar
            </button>
            <button onClick={preparePostsForApproval} disabled={preparingPosts}
              className="btn-action-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Gera os posts sugeridos e abre a revisao final para aprovacao">
              {preparingPosts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {preparingPosts ? "Preparando posts..." : "Gerar posts para aprovacao"}
            </button>
            <button onClick={async () => {
              try {
                // Arquiva o estado atual (plano + radar) — fica recuperável em "Estudos anteriores".
                // Sem arquivar, o radar do perfil antigo "vazaria" para o novo perfil até o cliente refazer a pesquisa.
                await archive.mutateAsync({ reason: "novo-diagnostico" });
                utils.diagnosis.get.invalidate();
                utils.radar.get.invalidate();
                archives.refetch();
                setPlan(null); setForceForm(true); setShowHistory(false); setProposals([]);
                setRedes({ instagram: "", tiktok: "", linkedin: "", site: "" });
                setProduto(""); setSobre("");
                toast.success("Estudo arquivado. Pronto para criar um novo diagnóstico.");
              } catch (e: any) {
                toast.error(e?.message || "Erro ao arquivar");
              }
            }} disabled={archive.isPending} className="btn-action-secondary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Arquiva o estudo atual e abre o formulario para um novo diagnostico">
              {archive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              Criar novo diagnostico
            </button>
            <button onClick={exportDiagnosisPdf} className="text-xs font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors">
              <FileDown className="w-3.5 h-3.5" /> Exportar PDF
            </button>
          </div>
        }
      >
        {/* Header do perfil */}
        {prof ? (
          <div className="rounded-2xl p-6 mb-5 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}>
            <div className="flex items-start gap-4 flex-wrap">
              {prof.profilePic
                ? <img src={prof.profilePic} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white/30" referrerPolicy="no-referrer" />
                : <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl">👤</div>}
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black">@{prof.handle}</span>
                  {prof.verified && <BadgeCheck className="w-4 h-4 text-[#3897f0]" />}
                </div>
                {prof.fullName && <p className="text-sm text-white/80 font-semibold">{prof.fullName}</p>}
                {prof.bio && <p className="text-xs text-white/60 mt-1 whitespace-pre-line leading-snug max-w-xl">{prof.bio}</p>}
                {shown.linkedin && <a href={absoluteUrl(shown.linkedin)} target="_blank" rel="noreferrer" className="inline-flex mt-2 text-[11px] font-black text-white bg-white/10 border border-white/15 rounded-full px-3 py-1 hover:bg-white/15">LinkedIn usado na Visao 360</a>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Metric icon={<Users className="w-4 h-4" />} label="Seguidores" value={nf(prof.followers)} />
                <Metric icon={<UserPlus className="w-4 h-4" />} label="Seguindo" value={nf(prof.following)} />
                <Metric icon={<Grid3x3 className="w-4 h-4" />} label="Posts" value={nf(prof.postsCount)} />
                <Metric icon={<TrendingUp className="w-4 h-4" />} label="Engajamento" value={prof.engajamentoPct ? `${prof.engajamentoPct}%` : "—"} highlight />
              </div>
            </div>
          </div>
        ) : shown.linkedin ? (
          <div className="rounded-2xl p-6 mb-5 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black">in</div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">LinkedIn informado</div>
                <p className="text-base font-black break-all">{shown.linkedin}</p>
                <a href={absoluteUrl(shown.linkedin)} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white underline">Abrir perfil no LinkedIn</a>
                <p className="text-xs text-white/60 mt-1 leading-snug max-w-xl">Usado como contexto estrategico para linguagem B2B, areas afins, interesses e hipoteses de segmentacao.</p>
              </div>
              <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="text-[10px] font-bold text-white/60">Visao 360</div>
                <div className="text-sm font-black text-white">Contexto LinkedIn</div>
                <div className="text-[10px] text-white/60 mt-1">Leitura profunda vira proxima etapa com provider/API.</div>
              </div>
            </div>
          </div>
        ) : shown.site && (shown.site.title || shown.site.url) ? (
          <div className="rounded-2xl p-6 mb-5 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}>
            <div className="flex items-start gap-4 flex-wrap">
              {shown.site.ogImage
                ? <img src={shown.site.ogImage} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30" referrerPolicy="no-referrer" />
                : <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">🌐</div>}
              <div className="flex-1 min-w-[200px]">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest">Site analisado</div>
                <p className="text-base font-black">{shown.site.title ?? shown.site.url}</p>
                <a href={shown.site.url} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white underline">{shown.site.url}</a>
                {shown.site.description && <p className="text-xs text-white/70 mt-1 leading-snug max-w-xl">{shown.site.description}</p>}
              </div>
              <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="text-[10px] font-bold text-white/60">Análise baseada em</div>
                <div className="text-sm font-black text-white">Site oficial</div>
                <div className="text-[10px] text-white/60 mt-1">Conecte seu Instagram para um estudo ainda mais profundo.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#ffd0c8] bg-[#fff1ef] p-4 mb-5 text-sm text-[#22304b] font-semibold">
            Análise baseada no que você descreveu. Para um estudo completo, informe um @ do Instagram ou um site.
          </div>
        )}

        {/* Sumário executivo */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
          <h3 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2">Sumário executivo</h3>
          <p className="text-sm font-semibold text-[#22304b] leading-relaxed">{shown.sumarioExecutivo ?? shown.resumo}</p>
          {shown.objetivoPrincipal && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#071b44] text-white p-3">
              <Target className="w-4 h-4 mt-0.5 text-[#ff8a72] flex-shrink-0" />
              <p className="text-xs font-semibold"><span className="font-black">Objetivo:</span> {shown.objetivoPrincipal}</p>
            </div>
          )}
        </div>

        {/* DNA visual da marca */}
        {dna && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2 mb-1"><Palette className="w-4 h-4 text-[#ff3217]" /> DNA visual da marca</h3>
            <p className="text-[11px] text-[#61708a] mb-3">Extraído dos seus posts campeões — toda imagem nova nasce com essa identidade.</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(dna.paleta ?? []).map((c: string, i: number) => (
                <div key={i} className="flex items-center gap-1.5 border border-[#e6ebf3] rounded-full pl-1 pr-2.5 py-1">
                  <span className="w-5 h-5 rounded-full border border-black/10" style={{ background: c }} />
                  <span className="text-[10px] font-bold text-[#22304b] uppercase">{c}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <DNARow label="Estilo de foto" value={dna.estiloFoto} />
              <DNARow label="Tom" value={dna.tom} />
              <DNARow label="Tipografia" value={dna.tipografia} />
              <DNARow label="Motivos recorrentes" value={(dna.motivos ?? []).join(", ")} />
            </div>
            {dna.resumoVisual && <p className="text-xs text-[#22304b] font-semibold italic mt-3">"{dna.resumoVisual}"</p>}
          </div>
        )}

        {/* Análise da situação */}
        {shown.situacao?.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <h3 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-3">Análise da situação</h3>
            <div className="divide-y divide-[#eef2f7]">
              {shown.situacao.map((s: any, i: number) => (
                <div key={i} className="grid grid-cols-[120px_1fr] gap-3 py-2">
                  <span className="text-[11px] font-black text-[#071b44]">{s.fator}</span>
                  <span className="text-[11px] text-[#22304b] font-semibold">{s.analise}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {shown.interessesPosts?.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div>
                <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#ff3217]" /> Visao 360: interesses pelos posts
                </h3>
                <p className="text-[11px] text-[#61708a] mt-1">Interesses inferidos pelos sinais publicos dos posts, Radar e ideias marcadas. Use como base para conteudo e campanhas no LinkedIn.</p>
              </div>
              <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                {shown.interessesPosts.length} interesses detectados
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {shown.interessesPosts.map((it: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[9px] font-black uppercase text-[#ff3217] bg-[#fff1ef] rounded-full px-2 py-0.5">{it.categoria}</span>
                      <h4 className="text-sm font-black text-[#071b44] mt-1">{it.nome}</h4>
                    </div>
                    <span className="text-[10px] font-black text-white bg-[#071b44] rounded-lg px-2 py-1">{it.score ?? 0}/100</span>
                  </div>
                  {it.sinal && <p className="text-[11px] font-semibold text-[#22304b] leading-snug">{it.sinal}</p>}
                  {it.porQueImporta && <p className="text-[10px] text-[#61708a] leading-snug mt-2"><span className="font-black text-[#070b17]">Por que importa:</span> {it.porQueImporta}</p>}
                  {it.conteudoLinkedIn && <p className="text-[10px] text-[#61708a] leading-snug mt-1.5"><span className="font-black text-[#070b17]">LinkedIn:</span> {it.conteudoLinkedIn}</p>}
                  {it.targeting?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {it.targeting.slice(0, 4).map((t: string, j: number) => (
                        <span key={j} className="text-[9px] font-bold text-[#071b44] bg-white border border-[#e6ebf3] rounded-full px-2 py-0.5">{t}</span>
                      ))}
                    </div>
                  )}
                  {it.evidencias?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#e6ebf3] space-y-1.5">
                      {it.evidencias.slice(0, 2).map((ev: any, j: number) => (
                        <p key={j} className="text-[9.5px] text-[#61708a] leading-snug">
                          <span className="font-black text-[#071b44]">{ev.fonte}</span>{typeof ev.hotScore === "number" ? ` - ${ev.hotScore} hot` : ""}: {ev.trecho}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pilares estratégicos */}
        {shown.pilaresEstrategicos?.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-black text-[#070b17] mb-3">Pilares estratégicos</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {shown.pilaresEstrategicos.map((p: any, i: number) => (
                <div key={i} className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-lg bg-[#fff1ef] text-[#ff3217] text-xs font-black flex items-center justify-center">{i + 1}</span>
                    <h4 className="text-sm font-black text-[#070b17]">{p.titulo}</h4>
                  </div>
                  <p className="text-[11px] text-[#61708a] font-semibold mb-2">{p.objetivo}</p>
                  <ul className="space-y-1.5">
                    {(p.acoes ?? []).map((a: any, j: number) => (
                      <li key={j} className="text-[11px] text-[#22304b] leading-snug">
                        <span className="font-black">{a.acao}:</span> {a.detalhe}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seus melhores posts */}
        {prof?.topPosts?.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="text-sm font-black text-[#070b17]">🏆 Seus melhores posts — e por que funcionam</h3>
              <label className="text-xs font-bold text-[#61708a] hover:text-[#ff3217] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Enviar outro post de sucesso
                <input type="file" accept="image/*" className="hidden" onChange={ev => handleOwnPost(ev.target.files?.[0])} />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {prof.topPosts.map((p: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#e6ebf3] overflow-hidden flex flex-col">
                  {p.img
                    ? <img src={p.img} alt="" className="w-full aspect-square object-contain bg-[#f6f8fc]" referrerPolicy="no-referrer" />
                    : <div className="w-full aspect-square bg-[#f6f8fc] flex items-center justify-center text-3xl">🖼️</div>}
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 text-[11px] font-bold text-[#61708a] mb-1.5">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-[#ff3217]" /> {nf(p.likes)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {nf(p.comments)}</span>
                    </div>
                    <p className="text-[11px] text-[#22304b] font-semibold leading-snug flex-1">
                      {shown.analiseTopPosts?.[i] ?? (p.caption || "").slice(0, 90)}
                    </p>
                    <button
                      onClick={() => p.img && importImg.mutate({ url: p.img })}
                      disabled={!p.img || importImg.isPending}
                      className="mt-2.5 text-[11px] font-black text-[#ff3217] border border-[#ffd0c8] rounded-lg py-1.5 flex items-center justify-center gap-1.5 hover:bg-[#fff1ef] disabled:opacity-50"
                    >
                      {importImg.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                      Usar como base (clonar)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* O que está bombando no seu setor (Radar) */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <div>
              <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2"><Flame className="w-4 h-4 text-[#ff3217]" /> Mais hot do Radar de Mercado</h3>
              {(rd?.hits?.length ?? 0) > 0 && (
                <p className="text-[11px] text-[#61708a] mt-1">Marque Gostei ou Não gostei nos posts abaixo e retroalimente o Radar sem sair do diagnostico.</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(rd?.hits?.length ?? 0) > 0 && (
                <>
                  <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                    {selectedVisibleRadarHitKeys.length} gostei / {dislikedVisibleRadarHitKeys.length} não gostei
                  </span>
                  <span className="text-[10px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1">
                    {radarFreeLeft > 0 ? `${radarFreeLeft} refinamento(s) gratis` : `${radarRefineInfo.nextCostCC ?? 10} CC por refinamento`}
                  </span>
                  <button
                    onClick={() => refineRadar.mutate({ likedPostKeys: likedRadarHitKeys, dislikedPostKeys: dislikedRadarHitKeys })}
                    disabled={refineRadar.isPending || likedRadarHitKeys.length === 0}
                    className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refineRadar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {refineRadar.isPending ? "Refinando..." : "Usar Feedback para refazer a pesquisa"}
                  </button>
                  <button onClick={() => navigate("/radar")} className="text-xs font-black text-[#ff3217] flex items-center gap-1.5 hover:underline">
                    Ver Radar completo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {(rd?.hits?.length ?? 0) === 0 && (
                <button onClick={() => scanRadar.mutate(undefined)} disabled={scanRadar.isPending}
                  className="btn-action-primary text-xs px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {scanRadar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {scanRadar.isPending ? "Pesquisando..." : "Gerar Radar de Mercado"}
                </button>
              )}
            </div>
          </div>
          {scanRadar.isPending || refineRadar.isPending ? (
            <div className="mt-4">
              <AnalysisProgress
                steps={RADAR_STEPS}
                active={scanRadar.isPending || refineRadar.isPending}
                title={refineRadar.isPending ? "Retroalimentando o Radar de Mercado..." : "Gerando o Radar de Mercado..."}
                subtitle={refineRadar.isPending ? "Usando os posts marcados, evitando os rejeitados e buscando novos nomes com mais variedade." : "O Agente Radar esta buscando hits e adaptando ideias para esta marca."}
              />
            </div>
          ) : (rd?.hits?.length ?? 0) > 0 ? (
            <>
              {rd.marketSummary && (
                <div className="rounded-xl bg-[#071b44] text-white p-3 mb-3">
                  <p className="text-xs font-semibold leading-relaxed">{rd.marketSummary}</p>
                </div>
              )}
              <p className="text-[11px] text-[#61708a] mb-3">Posts ranqueados por calor de mercado. Abra o post original se quiser conferir detalhes, mas aqui ja mostramos o suficiente para decidir rapido.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {hottestRadarHits.map((h: any, i: number) => {
                  const key = hitKey(h);
                  const handle = hitOwner(h);
                  const liked = likedRadarHitKeys.includes(key);
                  const disliked = dislikedRadarHitKeys.includes(key);
                  const markLike = () => {
                    const sameOwnerKeys = hottestRadarHits.filter(item => hitOwner(item) === handle).map(hitKey);
                    setLikedRadarHitKeys(prev => [...prev.filter(k => !sameOwnerKeys.includes(k)), key]);
                    setDislikedRadarHitKeys(prev => prev.filter(k => k !== key));
                  };
                  const markUnlike = () => {
                    setLikedRadarHitKeys(prev => prev.filter(k => k !== key));
                    setDislikedRadarHitKeys(prev => prev.includes(key) ? prev : [...prev, key]);
                  };
                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${liked ? "border-[#18b85c] bg-[#f7fff9]" : disliked ? "border-[#c20f00] bg-[#fff8f6]" : "border-[#e6ebf3] bg-white"}`}>
                      <a href={h.url || "/app/radar"} target={h.url ? "_blank" : undefined} rel={h.url ? "noreferrer" : undefined} className="block relative group">
                        {h.img
                          ? <img src={h.img} alt="" className="w-full aspect-[4/5] object-contain bg-[#f6f8fc]" referrerPolicy="no-referrer" />
                          : <div className="w-full aspect-[4/5] bg-[#f6f8fc] flex items-center justify-center text-[#9aa7bd]"><Telescope className="w-7 h-7" /></div>}
                        <span className="absolute right-2 top-2 text-[9px] font-black text-white bg-black/60 rounded-full px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Abrir post <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                      <div className="p-2 flex-1 flex flex-col">
                        <div className="flex items-center justify-between gap-1">
                          <a href={h.url || "/app/radar"} target={h.url ? "_blank" : undefined} rel={h.url ? "noreferrer" : undefined} className="text-[10px] font-black text-[#071b44] hover:text-[#ff3217] flex items-center gap-1 truncate">@{h.ownerUsername} <ExternalLink className="w-2.5 h-2.5" /></a>
                          {typeof h.hotScore === "number" && <span className="text-[9px] font-black text-white bg-[#ff3217] rounded px-1.5 py-0.5 flex-shrink-0">{h.hotScore}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#61708a] mt-0.5">
                          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-[#ff3217]" /> {nf(h.likes)}</span>
                          <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {nf(h.comments)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className={`text-[9px] font-black rounded-full px-2 py-0.5 ${liked ? "bg-[#18b85c] text-white" : disliked ? "bg-[#c20f00] text-white" : "bg-[#eef2f7] text-[#61708a]"}`}>{liked ? "gostei" : disliked ? "não gostei" : "sem marcação"}</span>
                          {typeof h.engagementRate === "number" && <span className="text-[9px] font-black text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">{h.engagementRate}% eng.</span>}
                          {h.mechanism && <span className="text-[9px] font-black text-[#ff3217] bg-[#fff1ef] rounded px-1.5 py-0.5 truncate max-w-full">{h.mechanism}</span>}
                        </div>
                        {h.why && <p className="text-[10px] text-[#22304b] font-semibold leading-snug mt-2 line-clamp-3"><span className="font-black text-[#070b17]">Por que bombou:</span> {h.why}</p>}
                        {h.caption && <p className="text-[10px] text-[#61708a] leading-snug mt-1.5 line-clamp-4"><span className="font-black text-[#070b17]">Legenda:</span> {h.caption}</p>}
                        <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                          <button type="button" onClick={markLike} disabled={!handle}
                            className={`text-[10px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-40 ${liked ? "text-white bg-[#18b85c] border-[#18b85c]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#18b85c]"}`}>
                            <ThumbsUp className="w-3 h-3" /> Gostei
                          </button>
                          <button type="button" onClick={markUnlike} disabled={!handle}
                            className={`text-[10px] font-black rounded-lg border py-1.5 flex items-center justify-center gap-1.5 disabled:opacity-40 ${disliked ? "text-white bg-[#c20f00] border-[#c20f00]" : "text-[#61708a] bg-white border-[#e6ebf3] hover:border-[#c20f00]"}`}>
                            <ThumbsDown className="w-3 h-3" /> Não gostei
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#61708a] mt-3">As ideias de posts geradas pelo Radar agora aparecem direto em <button onClick={() => navigate("/aprovacao")} className="font-black text-[#ff3217] hover:underline">Revisar e publicar</button>, onde voce aprova, edita ou tira do teste.</p>
            </>
          ) : (
            <p className="text-[11px] text-[#61708a]">O Agente Radar descobre os posts campeões de perfis do seu setor, explica por que funcionam e cria ideias com a SUA identidade visual. {scanRadar.isPending ? "Pesquisando agora…" : "Clique para pesquisar (leva ~2-3 min)."}</p>
          )}
        </div>

        {shown.radarContribuicoes && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <h3 className="text-sm font-black text-[#070b17] flex items-center gap-2 mb-1"><Wand2 className="w-4 h-4 text-[#ff3217]" /> Contribuicoes do Radar no diagnostico</h3>
            {shown.radarContribuicoes.resumo && <p className="text-xs text-[#22304b] font-semibold leading-relaxed">{shown.radarContribuicoes.resumo}</p>}
            {shown.radarContribuicoes.recomendacao && <p className="text-[11px] text-[#61708a] mt-1">{shown.radarContribuicoes.recomendacao}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {(shown.radarContribuicoes.ideias ?? []).map((it: any) => (
                <span key={it.index} className={`text-[10px] font-black rounded-full px-2.5 py-1 border ${it.status === "use" ? "text-[#087a32] bg-[#eafff1] border-[#bfeccb]" : "text-[#c20f00] bg-[#fff1ef] border-[#ffd0c8]"}`}>
                  Ideia {Number(it.index) + 1}: {it.status === "use" ? "entra" : "nao entra"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Cronograma */}
        {shown.cronograma?.length > 0 && (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-5">
            <h3 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-3 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Cronograma</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {shown.cronograma.map((c: any, i: number) => (
                <div key={i} className="rounded-xl border border-[#e6ebf3] p-3">
                  <span className="text-[10px] font-black text-white bg-[#071b44] rounded px-2 py-1">{c.periodo}</span>
                  <p className="text-[11px] text-[#22304b] font-semibold mt-2">{c.foco}</p>
                  <p className="text-[10px] text-[#18b85c] font-black mt-1.5 flex items-center gap-1"><Flag className="w-3 h-3" /> {c.meta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPIs + características + funil */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
            <h3 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-2">Estratégia & Funil</h3>
            <p className="text-[11px] text-[#22304b] font-semibold mb-1">📣 {e.canal}</p>
            <p className="text-[11px] text-[#22304b] font-semibold mb-1">🪜 {e.funil}</p>
            <p className="text-[11px] text-[#22304b] font-semibold mb-1">🎯 {(e.angulos ?? []).join(" · ")}</p>
            <p className="text-[11px] text-[#22304b] font-semibold mb-3">💰 {e.oferta}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-black text-[#61708a] uppercase">KPIs:</span>
              {(shown.kpis ?? []).map((k: string, i: number) => (
                <span key={i} className="text-[10px] font-bold text-[#22304b]">{k}{i < shown.kpis.length - 1 ? " ·" : ""}</span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
            <h3 className="text-xs font-black text-[#ff3217] uppercase tracking-wide mb-3">Características sugeridas (vão pro Estúdio)</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(shown.suggestedFactors ?? {}).map(([k, v]: any) => (
                <span key={k} className="text-[10px] font-bold text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded px-2 py-1">{String(v).replace(/_/g, " ")}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Conclusão */}
        {shown.conclusao && (
          <div className="rounded-xl p-5 text-white shadow-sm" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}>
            <h3 className="text-xs font-black text-[#ff8a72] uppercase tracking-wide mb-2">Conclusão</h3>
            <p className="text-sm font-semibold leading-relaxed">{shown.conclusao}</p>
          </div>
        )}
      </AppLayout>
    );
  }

  // ════════════════════ FORMULÁRIO ════════════════════
  return (
    <AppLayout
      title="Vamos estudar seu negocio"
      subtitle="O Agente Estrategista le seu perfil, analisa o DNA visual e monta um plano profissional. Leva ~2-3 minutos."
      actions={(activeDiagnosisItem || (archives.data?.length ?? 0) > 0) ? (
        <div className="flex gap-2">
          {activeDiagnosisItem && (
            <button onClick={() => { setForceForm(false); setPlan(null); setShowHistory(false); }} className="text-xs font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg">
              <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Voltar ao diagnóstico atual
            </button>
          )}
          <button onClick={() => setShowHistory(true)} className="text-xs font-bold text-[#61708a] hover:text-[#071b44] flex items-center gap-1.5 px-3 py-2">
            <History className="w-3.5 h-3.5" /> Ver Historico
          </button>
        </div>
      ) : undefined}
    >
      {analyze.isPending ? (
        <div className="max-w-2xl mx-auto py-4">
          <AnalysisProgress
            steps={pickDiagnosisSteps({ instagram: redes.instagram, site: redes.site, linkedin: redes.linkedin })}
            active={analyze.isPending}
            title={
              redes.instagram?.trim()
                ? `Estudando @${redes.instagram.replace(/^@/, "")}…`
                : redes.linkedin?.trim()
                  ? `Estudando ${redes.linkedin.replace(/^https?:\/\//, "").replace(/\/$/, "")}…`
                  : redes.site?.trim()
                  ? `Estudando ${redes.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}…`
                  : "Estudando seu negócio…"
            }
            subtitle="Nosso Agente Estrategista está trabalhando."
          />
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <h3 className="text-xs font-black text-[#071b44] uppercase tracking-wide mb-3">Suas fontes</h3>
          <div className="space-y-2.5">
            <Field icon="IG" placeholder="@seu_instagram (analisamos perfil e posts)" value={redes.instagram} onChange={(v: string) => setRedes(r => ({ ...r, instagram: v }))} />
            <Field icon="in" placeholder="LinkedIn do perfil ou empresa" value={redes.linkedin} onChange={(v: string) => setRedes(r => ({ ...r, linkedin: v }))} />
            <Field icon="TT" placeholder="@seu_tiktok (contexto, leitura em breve)" value={redes.tiktok} onChange={(v: string) => setRedes(r => ({ ...r, tiktok: v }))} />
            <Field icon="www" placeholder="site ou pagina de vendas" value={redes.site} onChange={(v: string) => setRedes(r => ({ ...r, site: v }))} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#f6f8fc] border border-[#e6ebf3] p-3">
              <p className="text-[10px] font-black text-[#071b44] uppercase">Leitura profunda agora</p>
              <p className="text-[11px] text-[#61708a] mt-1">Instagram: bio, posts, engajamento e DNA visual.</p>
            </div>
            <div className="rounded-lg bg-[#fff8f6] border border-[#ffd0c8] p-3">
              <p className="text-[10px] font-black text-[#ff3217] uppercase">Visao 360 LinkedIn</p>
              <p className="text-[11px] text-[#61708a] mt-1">LinkedIn entra como contexto estrategico e prepara a segmentacao; leitura profunda exige provider/API.</p>
            </div>
          </div>
          <h3 className="text-xs font-black text-[#071b44] uppercase tracking-wide mt-5 mb-2">Conte mais (opcional)</h3>
          <textarea value={sobre} onChange={e => setSobre(e.target.value)} placeholder="Quem é seu cliente? O que já tentou? Cole posts que funcionaram…"
            className="w-full border border-[#e6ebf3] rounded-lg p-3 text-sm bg-[#f6f8fc] min-h-[80px] focus:outline-none focus:border-[#ff3217]" />
        </div>

        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <h3 className="text-xs font-black text-[#071b44] uppercase tracking-wide mb-2">O que você vende? *</h3>
          <textarea value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: Curso de confeitaria para iniciantes, R$297, foco em mães que querem renda extra"
            className="w-full border border-[#e6ebf3] rounded-lg p-3 text-sm bg-[#f6f8fc] min-h-[80px] focus:outline-none focus:border-[#ff3217]" />
          <h3 className="text-xs font-black text-[#071b44] uppercase tracking-wide mt-4 mb-2">Seu objetivo agora?</h3>
          <div className="flex flex-wrap gap-2">
            {OBJETIVOS.map(o => (
              <button key={o.v} onClick={() => setObjetivo(o.v)} className="rounded-full text-xs font-bold px-4 py-2 transition-colors"
                style={{ border: `1.5px solid ${objetivo === o.v ? "#ff3217" : "#e6ebf3"}`, background: objetivo === o.v ? "#fff1ef" : "#fff", color: objetivo === o.v ? "#ff3217" : "#22304b" }}>
                {o.label}
              </button>
            ))}
          </div>
          <button disabled={analyze.isPending || produto.trim().length < 3} onClick={runAnalyze}
            className="btn-action-primary w-full mt-6 h-12 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyze.isPending ? "Estudando seu negócio a fundo… (pode levar 2-3 min)" : "Fazer o estudo do meu negócio"}
          </button>
          <p className="text-[11px] text-[#61708a] text-center mt-2">1º estudo grátis · lemos seu perfil e o Agente Estrategista analisa tudo</p>
        </div>
      </div>

      </>
      )}

      {/* Modal: excluir estudo arquivado */}
      {confirmDeleteArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmDeleteArchive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-[#fff1ef] flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-[#c20f00]" />
            </div>
            <h2 className="text-lg font-black text-[#070b17]">Excluir estudo arquivado?</h2>
            <p className="text-sm text-[#22304b] mt-2 leading-relaxed">
              Você vai apagar definitivamente o estudo de <span className="font-black">{confirmDeleteArchive.label}</span>, incluindo plano, posts e radar associados.
            </p>
            <p className="text-[11px] text-[#61708a] mt-2">Esta ação não pode ser desfeita.</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setConfirmDeleteArchive(null)} className="text-xs font-bold text-[#070b17] border border-[#e6ebf3] hover:bg-[#f6f8fc] px-4 py-2.5 rounded-lg">
                Cancelar
              </button>
              <button onClick={() => deleteArchive.mutate({ id: confirmDeleteArchive.id })} disabled={deleteArchive.isPending}
                className="text-xs font-black text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: "#c20f00" }}>
                {deleteArchive.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: troca de perfil */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b17]/55 backdrop-blur-md p-4" onClick={() => setConfirmReset(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-[430px] w-full p-6 sm:p-7" onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 rounded-full bg-[#fff1ef] flex items-center justify-center mb-4">
              <RotateCcw className="w-5 h-5 text-[#ff3217]" />
            </div>
            <h2 className="text-xl font-black text-[#070b17]">Voce esta trocando de perfil</h2>
            <p className="text-sm text-[#61708a] mt-3 leading-relaxed">
              Voce tinha o estudo de <span className="font-black text-[#22304b]">@{confirmReset.oldHandle}</span> e agora vai gerar para <span className="font-black text-[#22304b]">@{confirmReset.newHandle}</span>.
            </p>
            <div className="bg-[#fff8f6] border border-[#ffd0c8] rounded-xl p-3.5 mt-4 text-xs text-[#22304b]">
              <p className="font-black mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-[#ff3217]" /> Isso vai trocar a base do diagnostico:</p>
              <ul className="space-y-1 pl-5 list-disc">
                <li>O plano estrategico atual</li>
                <li>Os posts sugeridos e suas imagens</li>
                <li>A pesquisa de Radar de Mercado</li>
                <li>As ideias geradas a partir daquele perfil</li>
              </ul>
            </div>
            <p className="text-[11px] text-[#61708a] mt-3 leading-relaxed">Recomendado: guarde o estudo anterior no historico. Assim voce pode recuperar esse plano, posts e Radar depois.</p>
            <div className="grid grid-cols-1 gap-2.5 mt-5">
              <button onClick={() => doAnalyzeWith(true)} disabled={archive.isPending || analyze.isPending}
                className="btn-action-primary text-sm px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {archive.isPending || analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Guardar historico e gerar novo
              </button>
              <button onClick={() => doAnalyzeWith(false)} disabled={archive.isPending || analyze.isPending}
                className="text-xs font-black text-[#070b17] border border-[#e6ebf3] hover:border-[#ff3217] hover:bg-[#fff8f6] px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                Descartar o anterior e gerar novo
              </button>
              <button onClick={() => setConfirmReset(null)} disabled={archive.isPending || analyze.isPending} className="text-xs font-bold text-[#61708a] hover:text-[#070b17] py-2 disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Metric({ icon, label, value, highlight }: any) {
  return (
    <div className="rounded-xl px-3 py-2 text-center" style={{ background: highlight ? "rgba(255,50,23,0.18)" : "rgba(255,255,255,0.08)", border: `1px solid ${highlight ? "rgba(255,50,23,0.4)" : "rgba(255,255,255,0.12)"}` }}>
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold" style={{ color: highlight ? "#ff8a72" : "rgba(255,255,255,0.6)" }}>{icon}{label}</div>
      <div className="text-lg font-black mt-0.5 text-white">{value}</div>
    </div>
  );
}

function DNARow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-[#f6f8fc] p-2.5">
      <p className="text-[9px] font-black text-[#61708a] uppercase tracking-wide">{label}</p>
      <p className="text-[11px] text-[#22304b] font-semibold leading-snug mt-0.5">{value}</p>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange }: any) {
  return (
    <div className="flex items-center gap-2 border border-[#e6ebf3] rounded-lg px-3 py-2.5 bg-[#f6f8fc]">
      <span className="w-8 h-6 rounded-md bg-white border border-[#e6ebf3] text-[10px] font-black text-[#071b44] flex items-center justify-center flex-shrink-0">{icon}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm focus:outline-none" />
    </div>
  );
}
