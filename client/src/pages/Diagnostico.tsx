import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  ExternalLink,
  FileDown,
  Flame,
  Globe2,
  History,
  Instagram,
  Loader2,
  Megaphone,
  MessageSquareText,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AnalysisProgress, pickDiagnosisSteps, RADAR_STEPS } from "@/components/AnalysisProgress";
import { JourneyGuide } from "@/components/JourneyGuide";
import { trpc } from "@/lib/trpc";

const OBJETIVOS = [
  { v: "vender", label: "Vender mais" },
  { v: "leads", label: "Gerar leads" },
  { v: "seguidores", label: "Crescer seguidores" },
  { v: "lancar", label: "Lancar produto" },
] as const;

const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "-");
const absUrl = (url?: string) => {
  const u = String(url || "").trim();
  return !u || /^https?:\/\//i.test(u) ? u : `https://${u}`;
};
const hitKey = (h: any) => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`);
const channelIcon = (canal?: string) => {
  const c = String(canal || "").toLowerCase();
  if (c.includes("google") || c.includes("busca")) return Globe2;
  if (c.includes("blog") || c.includes("seo")) return BookOpen;
  if (c.includes("instagram")) return Instagram;
  if (c.includes("tiktok") || c.includes("reels")) return Video;
  return Target;
};

export default function Diagnostico() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const existing = trpc.diagnosis.get.useQuery();
  const radar = trpc.radar.get.useQuery();
  const archives = trpc.diagnosis.archives.useQuery();

  const [produto, setProduto] = useState("");
  const [objetivo, setObjetivo] = useState<(typeof OBJETIVOS)[number]["v"]>("vender");
  const [redes, setRedes] = useState({ site: "", instagram: "", tiktok: "" });
  const [sobre, setSobre] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [forceForm, setForceForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchArchive, setSearchArchive] = useState("");
  const [likedHitKeys, setLikedHitKeys] = useState<string[]>([]);
  const [dislikedHitKeys, setDislikedHitKeys] = useState<string[]>([]);
  const [adQuery, setAdQuery] = useState("");
  const [googleQuery, setGoogleQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [preparingApproval, setPreparingApproval] = useState(false);

  const analyze = trpc.diagnosis.analyze.useMutation({
    onSuccess: p => {
      setPlan(p);
      setForceForm(false);
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      toast.success("Diagnostico concluido.");
    },
    onError: e => toast.error(e.message || "Erro ao gerar diagnostico"),
  });
  const restoreArchive = trpc.diagnosis.restoreArchive.useMutation({
    onSuccess: () => {
      setPlan(null);
      setForceForm(false);
      setShowHistory(false);
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      toast.success("Diagnostico restaurado.");
    },
    onError: e => toast.error(e.message || "Erro ao restaurar"),
  });
  const deleteArchive = trpc.diagnosis.deleteArchive.useMutation({
    onSuccess: (res: any) => {
      utils.diagnosis.archives.invalidate();
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      utils.approvals.pendingForClient.invalidate();
      toast.success(`Perfil excluido definitivamente. ${res?.creativesDeleted ?? 0} criativos e ${res?.approvalsDeleted ?? 0} aprovacoes removidos.`);
    },
    onError: e => toast.error(e.message || "Erro ao excluir perfil"),
  });
  const scanRadar = trpc.radar.scan.useMutation({
    onSuccess: () => {
      utils.radar.get.invalidate();
      toast.success("Radar atualizado.");
    },
    onError: e => toast.error(e.message || "Erro ao atualizar Radar"),
  });
  const refineRadar = trpc.radar.refine.useMutation({
    onSuccess: () => {
      utils.radar.get.invalidate();
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
      toast.success("Radar refinado com os feedbacks.");
    },
    onError: e => toast.error(e.message || "Erro ao refinar Radar"),
  });
  const recalibrate = trpc.diagnosis.recalibrate.useMutation({
    onSuccess: p => {
      setPlan(p);
      utils.diagnosis.get.invalidate();
      utils.radar.get.invalidate();
      toast.success("Parecer recalculado com os feedbacks.");
    },
    onError: e => toast.error(e.message || "Erro ao recalcular diagnostico"),
  });
  const scanAds = trpc.diagnosis.scanAds.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      toast.success("Espiao de anuncios atualizado.");
    },
    onError: e => toast.error(e.message || "Erro ao escanear anuncios"),
  });
  const scanGoogle = trpc.diagnosis.scanGoogle.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      toast.success("Buscas do Google atualizadas.");
    },
    onError: e => toast.error(e.message || "Erro ao buscar no Google"),
  });
  const genProposals = trpc.studio.generateProposals.useMutation({
    onError: e => toast.error(e.message || "Erro ao gerar posts"),
  });
  const genRadarIdea = trpc.radar.generateIdea.useMutation({
    onError: e => toast.error(e.message || "Erro ao gerar ideia do Radar"),
  });
  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => {
      toast.success("Conteudos enviados para aprovacao.");
      navigate("/aprovacao");
    },
    onError: e => toast.error(e.message || "Erro ao enviar para aprovacao"),
  });

  const shown = plan ?? (forceForm ? null : existing.data);
  const rd: any = radar.data;

  useEffect(() => {
    if (!rd) return;
    setLikedHitKeys((rd.feedback?.likedPostKeys ?? []) as string[]);
    setDislikedHitKeys((rd.feedback?.dislikedPostKeys ?? []) as string[]);
  }, [rd?.scannedAt]);

  const diagnosisSteps = useMemo(() => pickDiagnosisSteps({ instagram: redes.instagram, tiktok: redes.tiktok, site: redes.site }), [redes]);
  const formReady = produto.trim().length >= 3 && Object.values(redes).some(Boolean);

  const runAnalyze = () => {
    if (!formReady) {
      toast.error("Informe o que voce vende e pelo menos um canal.");
      return;
    }
    analyze.mutate({ produto, objetivo, redes, sobre });
  };

  const openBlankDiagnosis = () => {
    setPlan(null);
    setForceForm(true);
    setShowHistory(false);
    setProduto("");
    setSobre("");
    setObjetivo("vender");
    setRedes({ site: "", instagram: "", tiktok: "" });
    setFeedback("");
  };

  const refreshCurrentDiagnosis = () => {
    const current: any = shown;
    if (!current) return openBlankDiagnosis();
    const nextRedes = current.redes ?? current._redes ?? {
      instagram: current.profile?.handle ? `@${current.profile.handle}` : "",
      site: current.site?.url ?? "",
      tiktok: "",
    };
    analyze.mutate({
      produto: current.produto || produto || "Produto ou servico",
      objetivo: current.objetivo || "vender",
      redes: nextRedes,
      sobre: feedback || sobre || "",
    });
  };

  const prepareApproval = async () => {
    setPreparingApproval(true);
    try {
      const strategic = await genProposals.mutateAsync();
      const creativeIds: number[] = (strategic.creatives ?? []).map((c: any) => c.id).filter(Boolean);

      let radarSource: any = rd;
      if (!radarSource?.ideas?.length) {
        radarSource = await scanRadar.mutateAsync(undefined);
        await utils.radar.get.invalidate();
      }
      const radarIdeas = ((radarSource?.ideas ?? []) as any[]).slice(0, 3);
      for (let index = 0; index < radarIdeas.length; index++) {
        let creativeId = radarIdeas[index]?.creativeId ?? radarIdeas[index]?.id;
        if (!creativeId) {
          const generated = await genRadarIdea.mutateAsync({ index });
          creativeId = (generated as any)?.id;
        }
        if (creativeId) creativeIds.push(Number(creativeId));
      }

      const uniqueIds = Array.from(new Set(creativeIds));
      if (!uniqueIds.length) throw new Error("Nenhum conteudo foi gerado para aprovacao");
      await sendApproval.mutateAsync({ creativeIds: uniqueIds, name: "Conteudos por canal do diagnostico" });
      await Promise.allSettled([utils.diagnosis.get.invalidate(), utils.radar.get.invalidate()]);
      toast.success("Conteudos preparados para aprovacao.");
      navigate("/aprovacao");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao preparar conteudos");
    } finally {
      setPreparingApproval(false);
    }
  };

  const markHit = (hit: any, value: "like" | "dislike") => {
    const key = hitKey(hit);
    if (value === "like") {
      setLikedHitKeys(prev => prev.includes(key) ? prev : [...prev, key]);
      setDislikedHitKeys(prev => prev.filter(k => k !== key));
    } else {
      setDislikedHitKeys(prev => prev.includes(key) ? prev : [...prev, key]);
      setLikedHitKeys(prev => prev.filter(k => k !== key));
    }
  };

  const useRadarFeedback = async () => {
    await refineRadar.mutateAsync({ likedPostKeys: likedHitKeys, dislikedPostKeys: dislikedHitKeys });
    await recalibrate.mutateAsync({ feedback: feedback || "Usar feedbacks do Radar no parecer e na prescricao." });
  };

  const exportPdf = () => {
    try {
      window.localStorage.setItem("cacarejar.radarFeedbackDraft", JSON.stringify({
        scannedAt: rd?.scannedAt,
        likedPostKeys: likedHitKeys,
        dislikedPostKeys: dislikedHitKeys,
      }));
    } catch { /* noop */ }
    window.open("/app/diagnostico/relatorio", "_blank");
  };

  if (analyze.isPending) {
    return (
      <AppLayout title="Vamos estudar seu negocio" subtitle="O Agente Estrategista esta cruzando canais, Radar e prescricoes.">
        <div className="max-w-3xl mx-auto pt-16">
          <AnalysisProgress
            steps={diagnosisSteps}
            active
            title={`Estudando ${redes.instagram || redes.site || produto}...`}
            subtitle="Nosso Agente Estrategista esta trabalhando."
          />
        </div>
      </AppLayout>
    );
  }

  if (showHistory) {
    const items = (archives.data ?? []).filter((item: any) => {
      const q = searchArchive.trim().toLowerCase();
      if (!q) return true;
      return [item.handle, item.nicho, item.produto, item.summary].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    return (
      <AppLayout
        title="Historico de diagnosticos"
        subtitle="Restaure estudos quando precisar comparar um perfil antigo."
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(false)} className="btn-quiet"><ArrowRight className="w-4 h-4 rotate-180" /> Voltar</button>
            <button onClick={openBlankDiagnosis} className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2"><Pencil className="w-4 h-4" /> Novo diagnostico</button>
          </div>
        }
      >
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-center gap-3 rounded-xl border border-[#e6ebf3] bg-[#f8fafc] px-4 py-3 mb-5">
            <Search className="w-4 h-4 text-[#61708a]" />
            <input value={searchArchive} onChange={e => setSearchArchive(e.target.value)} placeholder="Pesquisar por perfil, nicho ou resumo" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          {items.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-[#e6ebf3] p-5 bg-white">
                  <p className="text-xs font-black text-[#ff3217] uppercase">{item.nicho || "Diagnostico"}</p>
                  <h3 className="text-lg font-black text-[#071b44] mt-1">{item.handle ? `@${item.handle}` : item.produto || "Sem perfil"}</h3>
                  <p className="text-sm text-[#61708a] mt-2 line-clamp-3">{item.summary || "Sem resumo salvo."}</p>
                  <button onClick={() => restoreArchive.mutate({ id: item.id })} disabled={restoreArchive.isPending} className="mt-4 w-full rounded-xl border border-[#e6ebf3] px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center justify-center gap-2 disabled:opacity-50">
                    {restoreArchive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restaurar
                  </button>
                  <button
                    onClick={() => {
                      const label = item.handle ? `@${item.handle}` : item.produto || item.nicho || "este perfil";
                      const ok = window.confirm(
                        `Exclusao definitiva de ${label}.\n\nIsso apaga este perfil do historico e remove tudo que estiver ligado a ele: diagnostico salvo, Radar, ideias, criativos gerados, aprovacoes, variantes e revisoes relacionadas.\n\nEssa acao nao pode ser desfeita.`
                      );
                      if (!ok) return;
                      deleteArchive.mutate({ id: item.id });
                    }}
                    disabled={deleteArchive.isPending || restoreArchive.isPending}
                    className="mt-2 w-full rounded-xl border border-[#ffd0c8] bg-[#fff7f5] px-4 py-2.5 text-sm font-black text-[#c20f00] hover:bg-[#fff1ef] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deleteArchive.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir definitivo
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d9e1ee] bg-[#f8fafc] p-10 text-center text-sm font-bold text-[#61708a]">Nenhum historico encontrado.</div>
          )}
        </div>
      </AppLayout>
    );
  }

  if (!shown) {
    return (
      <AppLayout
        title="Vamos estudar seu negocio"
        subtitle="Informe os canais disponiveis. O parecer vai cruzar origem, Radar, canais e prescricao."
        actions={<button onClick={() => setShowHistory(true)} className="btn-quiet"><History className="w-4 h-4" /> Ver Historico</button>}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-[#ff3217]" />
              <h2 className="text-lg font-black text-[#070b17]">Novo diagnostico multicanal</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field icon={Globe2} label="Site oficial">
                <input value={redes.site} onChange={e => setRedes(r => ({ ...r, site: e.target.value }))} placeholder="https://empresa.com.br" className="input-clean" />
              </Field>
              <Field icon={Instagram} label="Instagram">
                <input value={redes.instagram} onChange={e => setRedes(r => ({ ...r, instagram: e.target.value }))} placeholder="@perfil" className="input-clean" />
              </Field>
              <Field icon={Video} label="TikTok / Reels">
                <input value={redes.tiktok} onChange={e => setRedes(r => ({ ...r, tiktok: e.target.value }))} placeholder="@perfil ou link" className="input-clean" />
              </Field>
            </div>
            <Field icon={Target} label="O que voce vende?" className="mt-4">
              <textarea value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: consultoria B2B, plataforma SaaS, curso, servico local..." className="input-clean min-h-[92px] resize-none" />
            </Field>
            <Field icon={MessageSquareText} label="Contexto opcional" className="mt-4">
              <textarea value={sobre} onChange={e => setSobre(e.target.value)} placeholder="Cliente ideal, ticket, objecoes, diferenciais, concorrentes ou observacoes importantes." className="input-clean min-h-[110px] resize-none" />
            </Field>
            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-2">
                {OBJETIVOS.map(o => (
                  <button key={o.v} onClick={() => setObjetivo(o.v)} className={`rounded-full border px-4 py-2 text-xs font-black ${objetivo === o.v ? "bg-[#071b44] text-white border-[#071b44]" : "bg-white text-[#61708a] border-[#e6ebf3] hover:bg-[#f8fafc]"}`}>{o.label}</button>
                ))}
              </div>
              <button onClick={runAnalyze} disabled={!formReady || analyze.isPending} className="btn-action-primary px-6 py-3 text-sm flex items-center gap-2 disabled:opacity-50">
                {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar diagnostico
              </button>
            </div>
          </section>

          <aside className="bg-[#071b44] text-white rounded-2xl p-6 shadow-sm h-fit">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest">Metodologia</p>
            <h3 className="text-2xl font-black mt-2 leading-tight">Parecer + prescricao + planner.</h3>
            <p className="text-sm text-white/75 mt-3 leading-relaxed">
              O diagnostico separa o que foi identificado em cada origem e transforma isso em plano de acao por canal: Blog / SEO, Instagram e TikTok / Reels.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {["Fontes usadas", "Visao 360", "Cronograma", "Acompanhamento"].map(label => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/8 p-3 text-sm font-black">{label}</div>
              ))}
            </div>
          </aside>
        </div>
      </AppLayout>
    );
  }

  const prof = shown.profile;
  const fontes = shown.fontesUsadas ?? [];
  const metodo = shown.metodoDiagnostico ?? [];
  const parecer = shown.parecerEstrategico ?? {};
  const acoesImediatas = shown.acoesImediatas ?? [];
  const prescricoes = shown.prescricoesPorCanal ?? [];
  const timeline = shown.cronogramaMulticanal ?? [];
  const acompanhamento = shown.acompanhamento;
  const interests = shown.interessesPosts ?? [];
  const hotHits = ((rd?.hits ?? []) as any[]).slice().sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0)).slice(0, 4);
  const radarFreeLeft = Math.max(0, ((rd?.feedback?.freeLimit ?? 3) - (rd?.feedback?.refinementCount ?? 0)));

  return (
    <AppLayout
      title="Parecer estrategico"
      subtitle="Diagnostico multicanal com prescricao, Radar e acompanhamento."
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <span className="hidden md:flex text-xs font-black text-[#087a32] bg-[#eafff1] border border-[#bfeccb] rounded-xl items-center gap-1.5 px-3 py-2"><BadgeCheck className="w-3.5 h-3.5" /> Salvo automaticamente</span>
          <button onClick={() => setShowHistory(true)} className="btn-quiet"><History className="w-4 h-4" /> Ver Historico</button>
          <button onClick={refreshCurrentDiagnosis} disabled={analyze.isPending} className="btn-quiet disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Atualizar</button>
          <button onClick={prepareApproval} disabled={preparingApproval} className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
            {preparingApproval ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar conteudos para aprovacao
          </button>
          <button onClick={openBlankDiagnosis} className="rounded-xl border border-[#e6ebf3] bg-white px-5 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"><Pencil className="w-4 h-4" /> Criar novo diagnostico</button>
          <button onClick={exportPdf} className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"><FileDown className="w-4 h-4" /> Exportar PDF</button>
        </div>
      }
    >
      <JourneyGuide active="diagnostico" />

      {scanRadar.isPending && (
        <div className="max-w-3xl mx-auto mb-5">
          <AnalysisProgress steps={RADAR_STEPS} active title="Atualizando Radar de Mercado..." subtitle="O Agente Radar esta buscando sinais quentes para reforcar o parecer." />
        </div>
      )}

      <ProfileHero plan={shown} />

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">Parecer estrategico</p>
          <h2 className="text-2xl font-black text-[#071b44] mt-2">{parecer.titulo || "O que o Agente encontrou"}</h2>
          <p className="text-base font-semibold text-[#22304b] leading-relaxed mt-3">{parecer.analise || shown.sumarioExecutivo || shown.resumo}</p>
          <div className="mt-5 rounded-2xl bg-[#071b44] text-white p-4">
            <p className="text-xs font-black text-white/60 uppercase">Prescricao imediata</p>
            <p className="text-sm font-bold leading-relaxed mt-1">{parecer.prescricaoImediata || shown.objetivoPrincipal}</p>
          </div>
          {parecer.radarImpacto && <p className="text-sm text-[#61708a] mt-4 leading-relaxed">{parecer.radarImpacto}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">Fontes usadas</p>
              <h3 className="text-lg font-black text-[#071b44] mt-1">De onde saiu o parecer</h3>
            </div>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">{fontes.length || 0} fontes</span>
          </div>
          <div className="space-y-3 mt-4">
            {(fontes.length ? fontes : [{ canal: "Diagnostico", origem: "Informacoes digitadas", sinal: "Briefing inicial", impacto: "Base para o plano." }]).map((f: any, i: number) => (
              <div key={`${f.canal}-${i}`} className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#071b44]">{f.canal}</p>
                  {f.status && <span className="text-[10px] font-black text-[#61708a] bg-white rounded-full border border-[#e6ebf3] px-2 py-0.5">{f.status}</span>}
                </div>
                <p className="text-xs font-bold text-[#22304b] mt-1">{f.origem}</p>
                <p className="text-xs text-[#61708a] mt-1 leading-relaxed">{f.sinal}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {metodo.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine icon={Search} title="Metodo do diagnostico" subtitle="Como o Agente transformou canais, mercado e briefing em uma prescricao." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            {metodo.map((m: any) => (
              <article key={m.etapa} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
                <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">{m.etapa}</p>
                <p className="text-sm font-bold text-[#071b44] leading-relaxed mt-2">{m.leitura}</p>
                <div className="mt-3 rounded-xl bg-white border border-[#e6ebf3] p-3">
                  <p className="text-[10px] font-black text-[#61708a] uppercase">Decisao</p>
                  <p className="text-xs font-bold text-[#22304b] leading-relaxed mt-1">{m.decisao}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {acoesImediatas.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine icon={BadgeCheck} title="Acoes imediatas" subtitle="O que executar primeiro antes de abrir novas frentes." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            {acoesImediatas.map((a: any) => (
              <article key={`${a.prioridade}-${a.canal}`} className="rounded-2xl border border-[#e6ebf3] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[#ff3217] uppercase">{a.prioridade}</p>
                    <h3 className="text-lg font-black text-[#071b44] mt-1">{a.canal}</h3>
                  </div>
                  <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">fazer</span>
                </div>
                <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-3">{a.acao}</p>
                <p className="text-xs text-[#61708a] leading-relaxed mt-2">{a.motivo}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine icon={Target} title="Prescricao por canal" subtitle="Cada canal recebe uma funcao clara, conteudos e KPIs proprios." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {prescricoes.map((p: any) => {
            const Icon = channelIcon(p.canal);
            return (
              <article key={p.canal} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-[#e6ebf3] flex items-center justify-center text-[#ff3217]"><Icon className="w-5 h-5" /></div>
                    <div>
                      <h3 className="text-lg font-black text-[#071b44]">{p.canal}</h3>
                      <p className="text-xs font-bold text-[#61708a]">{p.funcao}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">{p.prioridade}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {(p.conteudos ?? []).map((c: string, i: number) => <p key={i} className="text-sm text-[#22304b] leading-relaxed"><b>{i + 1}.</b> {c}</p>)}
                </div>
                <div className="mt-4 rounded-xl bg-white border border-[#e6ebf3] p-3">
                  <p className="text-xs font-black text-[#ff3217]">CTA</p>
                  <p className="text-sm font-bold text-[#071b44]">{p.cta}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">{(p.kpis ?? []).map((k: string) => <Tag key={k}>{k}</Tag>)}</div>
              </article>
            );
          })}
        </div>
      </section>

      {plan?.canais360?.canais?.length ? (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine icon={Target} title="Visao 360 por canal" subtitle="Leitura, publicos, angulos de anuncio e formatos para cada canal com dado real: Instagram, TikTok e Google." />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
            {plan.canais360.canais.map((c: any) => {
              const Icon = channelIcon(c.canal);
              return (
                <div key={c.canal} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-[#fff1ef] flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-[#ff3217]" /></span>
                    <p className="text-sm font-black text-[#071b44]">{c.canal}</p>
                  </div>
                  <p className="text-[11px] font-bold text-[#61708a] mt-2">{c.papel}</p>
                  <p className="text-xs text-[#22304b] leading-relaxed mt-2">{c.leitura}</p>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">Publicos</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">{(c.publicos ?? []).map((p: string) => <Tag key={p}>{p}</Tag>)}</div>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">Angulos de anuncio</p>
                  <div className="space-y-2 mt-1">
                    {(c.angulosAnuncio ?? []).map((a: any, i: number) => (
                      <div key={i} className="rounded-xl border border-[#e6ebf3] bg-white p-2.5">
                        <p className="text-xs font-black text-[#071b44]">{a.nome}</p>
                        <p className="text-[11px] text-[#22304b] leading-snug mt-1">{a.mensagem}</p>
                        <p className="text-[10px] text-[#61708a] font-bold mt-1"><span className="text-[#ff3217]">Oferta:</span> {a.oferta}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">Formatos</p>
                  <ul className="mt-1 space-y-0.5">{(c.formatos ?? []).map((f: string) => <li key={f} className="text-[11px] text-[#22304b]">- {f}</li>)}</ul>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">Conteudos</p>
                  <ul className="mt-1 space-y-0.5">{(c.conteudos ?? []).map((f: string) => <li key={f} className="text-[11px] text-[#22304b]">- {f}</li>)}</ul>

                  <div className="flex flex-wrap gap-1.5 mt-3">{(c.kpis ?? []).map((k: string) => <span key={k} className="text-[10px] font-bold text-[#61708a] bg-white border border-[#e6ebf3] rounded-full px-2 py-0.5">{k}</span>)}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <HeaderLine icon={Flame} title="Radar integrado ao parecer" subtitle="Marque os posts quentes para o Agente recalcular a leitura." />
          <div className="flex gap-2 flex-wrap mt-4 mb-4">
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">{likedHitKeys.length} gostei / {dislikedHitKeys.length} nao gostei</span>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">{radarFreeLeft} refinamento(s) gratis</span>
            <button onClick={() => scanRadar.mutate(undefined)} disabled={scanRadar.isPending} className="rounded-full border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50">Atualizar Radar</button>
            <button onClick={useRadarFeedback} disabled={!rd || refineRadar.isPending || recalibrate.isPending} className="rounded-full bg-[#ff3217] text-white px-4 py-1 text-xs font-black disabled:opacity-50">Usar feedbacks no diagnostico</button>
          </div>
          <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback opcional para o Agente antes de recalcular o parecer." className="input-clean min-h-[72px] resize-none mb-4" />
          {hotHits.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hotHits.map((hit: any) => {
                const key = hitKey(hit);
                const liked = likedHitKeys.includes(key);
                const disliked = dislikedHitKeys.includes(key);
                return (
                  <article key={key} className={`rounded-2xl overflow-hidden border bg-white ${liked ? "border-[#18b85c]" : disliked ? "border-[#ff3217]" : "border-[#e6ebf3]"}`}>
                    {hit.img && <img src={hit.img} alt="" className="w-full aspect-[4/3] object-cover bg-[#f8fafc]" referrerPolicy="no-referrer" />}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#071b44]">@{hit.ownerUsername}</p>
                        <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2 py-1">{hit.hotScore ?? "-"} hot</span>
                      </div>
                      <p className="text-xs text-[#22304b] leading-relaxed mt-2 line-clamp-5">{hit.caption || hit.why || hit.theme}</p>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={() => markHit(hit, "like")} className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${liked ? "bg-[#18b85c] text-white border-[#18b85c]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}><ThumbsUp className="w-3.5 h-3.5" /> Gostei</button>
                        <button onClick={() => markHit(hit, "dislike")} className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${disliked ? "bg-[#ff3217] text-white border-[#ff3217]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}><ThumbsDown className="w-3.5 h-3.5" /> Nao gostei</button>
                      </div>
                      {hit.url && <a href={absUrl(hit.url)} target="_blank" rel="noreferrer" className="mt-2 text-[11px] font-black text-[#61708a] hover:text-[#071b44] flex items-center gap-1">Abrir post <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EmptyText>Atualize o Radar para trazer posts quentes para dentro do diagnostico.</EmptyText>}
        </div>
      </section>

      {(() => {
        const adData: any = scanAds.data ?? (plan?.anunciosConcorrentes?.length
          ? { query: plan.anunciosQuery, ads: plan.anunciosConcorrentes, insights: plan.anunciosInsights ?? [], scannedAt: plan.anunciosScannedAt }
          : null);
        return (
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
            <HeaderLine icon={Megaphone} title="Espiao de Anuncios dos concorrentes" subtitle="Anuncios reais rodando agora na Meta (Facebook/Instagram). Os que rodam ha mais tempo costumam ser os campeoes." />
            <div className="flex gap-2 flex-wrap mt-4 mb-4 items-center">
              <input
                value={adQuery}
                onChange={e => setAdQuery(e.target.value)}
                placeholder={`Palavra-chave ou concorrente (padrao: ${plan?.produto || plan?.nicho || "seu nicho"})`}
                className="input-clean flex-1 min-w-[220px]"
              />
              <button
                onClick={() => scanAds.mutate(adQuery.trim() ? { query: adQuery.trim() } : undefined)}
                disabled={scanAds.isPending}
                className="rounded-full bg-[#ff3217] text-white px-4 py-2 text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
              >
                {scanAds.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {scanAds.isPending ? "Escaneando..." : "Escanear anuncios"}
              </button>
            </div>
            {scanAds.isPending ? (
              <EmptyText>Buscando anuncios reais na Biblioteca da Meta... isso pode levar 1-2 minutos.</EmptyText>
            ) : adData?.ads?.length ? (
              <>
                {adData.insights?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                    {adData.insights.map((ins: any, i: number) => (
                      <div key={i} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                        <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">{ins.titulo}</p>
                        <p className="text-xs text-[#22304b] leading-relaxed mt-1">{ins.detalhe}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {adData.ads.map((ad: any, i: number) => (
                    <article key={i} className="rounded-2xl overflow-hidden border border-[#e6ebf3] bg-white flex flex-col">
                      {ad.thumb && <img src={ad.thumb} alt="" className="w-full aspect-[4/5] object-cover bg-[#f8fafc]" referrerPolicy="no-referrer" />}
                      <div className="p-3 flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">{ad.advertiser}</p>
                          {ad.active && ad.runningDays != null && (
                            <span className="text-[10px] font-black text-white bg-[#18b85c] rounded-full px-2 py-1 whitespace-nowrap">{ad.runningDays}d no ar</span>
                          )}
                        </div>
                        <p className="text-xs text-[#22304b] leading-relaxed mt-2 line-clamp-5 flex-1">{ad.text}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ad.cta && <span className="text-[10px] font-black text-[#071b44] bg-[#f1f5fb] rounded-full px-2 py-0.5">{ad.cta}</span>}
                          {(ad.platforms || []).slice(0, 2).map((p: string) => <span key={p} className="text-[10px] font-bold text-[#61708a] bg-[#f8fafc] rounded-full px-2 py-0.5">{p}</span>)}
                        </div>
                        {ad.adLibraryUrl && <a href={absUrl(ad.adLibraryUrl)} target="_blank" rel="noreferrer" className="mt-2 text-[11px] font-black text-[#61708a] hover:text-[#071b44] flex items-center gap-1">Ver na Biblioteca <ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    </article>
                  ))}
                </div>
                {adData.query && <p className="text-[11px] text-[#61708a] mt-3">Busca: <b>{adData.query}</b>{adData.scannedAt ? ` - ${new Date(adData.scannedAt).toLocaleString("pt-BR")}` : ""}</p>}
              </>
            ) : (
              <EmptyText>Clique em "Escanear anuncios" para ver o que os concorrentes estao anunciando agora - e quais ja rodam ha semanas (os campeoes).</EmptyText>
            )}
          </section>
        );
      })()}

      {(() => {
        const g: any = scanGoogle.data ?? ((plan?.googleSEO?.termos?.length || plan?.googleSEO?.perguntas?.length) ? plan.googleSEO : null);
        return (
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
            <HeaderLine icon={Globe2} title="O que seu cliente pesquisa no Google" subtitle="Buscas reais (autocomplete do Google) sobre o seu nicho — viram pauta de conteudo e anuncio de busca." />
            <div className="flex gap-2 flex-wrap mt-4 mb-4 items-center">
              <input
                value={googleQuery}
                onChange={e => setGoogleQuery(e.target.value)}
                placeholder={`Palavra-chave (padrao: ${plan?.produto || plan?.nicho || "seu nicho"})`}
                className="input-clean flex-1 min-w-[220px]"
              />
              <button
                onClick={() => scanGoogle.mutate(googleQuery.trim() ? { query: googleQuery.trim() } : undefined)}
                disabled={scanGoogle.isPending}
                className="rounded-full bg-[#ff3217] text-white px-4 py-2 text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
              >
                {scanGoogle.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {scanGoogle.isPending ? "Buscando..." : "Buscar no Google"}
              </button>
            </div>
            {scanGoogle.isPending ? (
              <EmptyText>Consultando o autocomplete do Google...</EmptyText>
            ) : g ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  {g.ideiasConteudo?.length ? (
                    <>
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">Pautas sugeridas (SEO)</p>
                      <div className="space-y-2 mt-2">
                        {g.ideiasConteudo.map((idea: any, i: number) => (
                          <div key={i} className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-3">
                            <span className="text-[10px] font-black text-white bg-[#071b44] rounded-full px-2 py-0.5">{idea.tipo}</span>
                            <p className="text-xs font-bold text-[#071b44] mt-1.5">{idea.titulo}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                <div>
                  {g.perguntas?.length ? (
                    <>
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">Perguntas que pesquisam</p>
                      <ul className="mt-2 space-y-1">{g.perguntas.map((q: string) => <li key={q} className="text-xs text-[#22304b]">- {q}</li>)}</ul>
                    </>
                  ) : null}
                  {g.termos?.length ? (
                    <>
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-4">
                        Termos relacionados{g.fonteVolume === "dataforseo" ? " (volume real/mes)" : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {g.termos.map((t: any, i: number) => {
                          const label = typeof t === "string" ? t : t?.termo;
                          const vol = typeof t === "object" ? t?.volume : undefined;
                          return (
                            <span key={label || i} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#22304b] bg-[#f1f5fb] border border-[#e6ebf3] rounded-full px-2.5 py-1">
                              {label}
                              {typeof vol === "number" ? <span className="text-[10px] font-black text-[#18b85c]">{vol.toLocaleString("pt-BR")}/mes</span> : null}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyText>Clique em "Buscar no Google" para ver o que as pessoas realmente pesquisam sobre o seu nicho - e transformar em pauta de conteudo.</EmptyText>
            )}
            {g?.termo && !scanGoogle.isPending && <p className="text-[11px] text-[#61708a] mt-3">Busca base: <b>{g.termo}</b></p>}
          </section>
        );
      })()}

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine icon={BarChart3} title="Visao 360: interesses pelos posts" subtitle="Sinais inferidos por posts, Radar e ideias marcadas." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {interests.slice(0, 4).map((it: any) => <InterestCard key={it.nome} item={it} />)}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine icon={CalendarDays} title="Cronograma multicanal" subtitle="O plano vira execucao semanal por canal." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {timeline.map((week: any) => (
            <article key={week.semana} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
              <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">{week.semana}</span>
              <h3 className="text-lg font-black text-[#071b44] mt-3">{week.tema}</h3>
              <div className="space-y-2 mt-3">{(week.canais ?? []).map((c: any) => <p key={`${week.semana}-${c.canal}`} className="text-sm text-[#22304b]"><b>{c.canal}:</b> {c.acao} <span className="text-[#61708a]">({c.objetivo})</span></p>)}</div>
              <p className="text-xs font-bold text-[#18b85c] mt-3">{week.meta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
        <HeaderLine icon={TrendingUp} title="Acompanhamento" subtitle="Foto inicial, check-in e leitura de campanha para o proximo ciclo." />
        {acompanhamento ? (
          <div className="grid grid-cols-1 xl:grid-cols-[.8fr_1.2fr] gap-5 mt-5">
            <div className="rounded-2xl bg-[#071b44] text-white p-5">
              <p className="text-xs font-black text-white/60 uppercase">{acompanhamento.ciclo}</p>
              <div className="mt-4">
                <div className="flex items-end justify-between"><span className="text-sm font-bold text-white/70">Progresso</span><span className="text-4xl font-black">{acompanhamento.progresso ?? 0}%</span></div>
                <div className="h-2 rounded-full bg-white/15 mt-3 overflow-hidden"><div className="h-full bg-[#ff3217]" style={{ width: `${Math.min(100, acompanhamento.progresso ?? 0)}%` }} /></div>
              </div>
              <p className="text-sm font-bold mt-4">Proximo foco: {acompanhamento.proximoFoco}</p>
              <p className="text-xs text-white/70 mt-2">{acompanhamento.novaPrescricao}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(acompanhamento.snapshots ?? []).map((s: any) => (
                <div key={s.label} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                  <h3 className="text-sm font-black text-[#071b44]">{s.label}</h3>
                  <p className="text-xs text-[#61708a] mt-2 line-clamp-4">{s.resumo}</p>
                  <div className="space-y-2 mt-3">{(s.scores ?? []).map((score: any) => <ScoreRow key={score.nome} label={score.nome} value={score.valor} />)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : <EmptyText>O planner sera criado junto com o proximo diagnostico.</EmptyText>}
      </section>
    </AppLayout>
  );
}

function ProfileHero({ plan }: { plan: any }) {
  const prof = plan.profile;
  const profileTitle = prof?.handle ? `@${prof.handle}` : plan.linkedin360?.empresa || plan.site?.title || plan.produto || "Diagnostico";
  const profileSub = prof?.fullName || plan.nicho || plan.site?.url || plan.linkedin || "Plano multicanal";
  return (
    <section className="rounded-3xl p-6 mb-5 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}>
      <div className="flex items-center gap-5 flex-wrap">
        {prof?.profilePic ? <img src={prof.profilePic} alt="" className="w-20 h-20 rounded-full object-cover border border-white/30" referrerPolicy="no-referrer" /> : <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center"><Target className="w-9 h-9 text-white/70" /></div>}
        <div className="flex-1 min-w-[240px]">
          <p className="text-2xl font-black leading-tight">{profileTitle}</p>
          <p className="text-sm text-white/75 mt-1">{profileSub}</p>
          {plan.linkedin && <a href={absUrl(plan.linkedin)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white mt-2">Abrir LinkedIn <ExternalLink className="w-3 h-3" /></a>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HeroMetric label="Seguidores" value={nf(prof?.followers)} />
          <HeroMetric label="Seguindo" value={nf(prof?.following)} />
          <HeroMetric label="Posts" value={nf(prof?.postsCount)} />
          <HeroMetric label="Engajamento" value={prof?.engajamentoPct ? `${prof.engajamentoPct}%` : "-"} hot />
        </div>
      </div>
    </section>
  );
}

function Field({ icon: Icon, label, children, className = "" }: any) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black text-[#071b44] flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5 text-[#ff3217]" /> {label}</span>
      {children}
    </label>
  );
}

function HeaderLine({ icon: Icon, title, subtitle }: any) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2"><Icon className="w-5 h-5 text-[#ff3217]" /> {title}</h2>
        {subtitle && <p className="text-sm text-[#61708a] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function HeroMetric({ label, value, hot = false }: any) {
  return (
    <div className={`rounded-2xl border px-4 py-3 min-w-[116px] text-center ${hot ? "border-[#ff3217]/70 bg-[#ff3217]/10" : "border-white/15 bg-white/10"}`}>
      <p className="text-[10px] font-black text-white/60 uppercase">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function Tag({ children }: any) {
  return <span className="rounded-full border border-[#e6ebf3] bg-white px-3 py-1 text-[10px] font-black text-[#071b44]">{children}</span>;
}

function ChipBox({ title, items = [] }: { title: string; items?: string[] }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <p className="text-xs font-black text-[#ff3217] uppercase">{title}</p>
      <div className="flex flex-wrap gap-2 mt-3">{items.slice(0, 8).map(item => <Tag key={item}>{item}</Tag>)}</div>
    </div>
  );
}

function InterestCard({ item }: { item: any }) {
  return (
    <article className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-[#fff1ef] text-[#ff3217] px-3 py-1 text-[10px] font-black uppercase">{item.categoria}</span>
          <h3 className="text-lg font-black text-[#071b44] mt-3">{item.nome}</h3>
        </div>
        <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">{item.score ?? 0}/100</span>
      </div>
      <p className="text-sm text-[#22304b] mt-3 leading-relaxed">{item.sinal}</p>
      <p className="text-xs text-[#61708a] mt-3"><b className="text-[#070b17]">LinkedIn:</b> {item.conteudoLinkedIn}</p>
      <div className="flex flex-wrap gap-2 mt-3">{(item.targeting ?? []).slice(0, 5).map((t: string) => <Tag key={t}>{t}</Tag>)}</div>
    </article>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold"><span className="text-[#61708a]">{label}</span><span className="text-[#071b44]">{value}/100</span></div>
      <div className="h-2 rounded-full bg-[#edf1f7] mt-1 overflow-hidden"><div className="h-full bg-[#ff3217]" style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  );
}

function EmptyText({ children }: any) {
  return <div className="rounded-2xl border border-dashed border-[#d9e1ee] bg-[#f8fafc] p-8 text-center text-sm font-bold text-[#61708a] mt-5">{children}</div>;
}
