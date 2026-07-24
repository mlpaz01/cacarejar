import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileDown,
  Flame,
  Globe2,
  Heart,
  History,
  Instagram,
  Loader2,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Palette,
  Pencil,
  Radar,
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
import {
  AnalysisProgress,
  pickDiagnosisSteps,
  RADAR_STEPS,
} from "@/components/AnalysisProgress";
import { trpc } from "@/lib/trpc";

const OBJETIVOS = [
  { v: "vender", label: "Vender mais" },
  { v: "leads", label: "Gerar leads" },
  { v: "seguidores", label: "Crescer seguidores" },
  { v: "lancar", label: "Lancar produto" },
] as const;

const nf = (n?: number) =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "-";
const absUrl = (url?: string) => {
  const u = String(url || "").trim();
  return !u || /^https?:\/\//i.test(u) ? u : `https://${u}`;
};
const hitKey = (h: any) =>
  String(
    h?.url ||
      h?.img ||
      `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`
  );
const pickPostImage = (item: any) =>
  String(
    item?.imageUrl ||
      item?.img ||
      item?.thumbnail ||
      item?.thumbnailUrl ||
      item?.displayUrl ||
      item?.mediaUrl ||
      item?.coverUrl ||
      item?.fonteImg ||
      ""
  );
const shortText = (value: any, max = 220) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};
const channelIcon = (canal?: string) => {
  const c = String(canal || "").toLowerCase();
  if (c.includes("google") || c.includes("busca")) return Globe2;
  if (c.includes("blog") || c.includes("seo")) return BookOpen;
  if (c.includes("instagram")) return Instagram;
  if (c.includes("tiktok") || c.includes("reels")) return Video;
  return Target;
};

export default function Diagnostico() {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();
  const existing = trpc.diagnosis.get.useQuery();
  const radar = trpc.radar.get.useQuery();
  const archives = trpc.diagnosis.archives.useQuery();

  const [produto, setProduto] = useState("");
  const [objetivo, setObjetivo] =
    useState<(typeof OBJETIVOS)[number]["v"]>("vender");
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
  const [autoRadarStarted, setAutoRadarStarted] = useState(false);

  const analyze = trpc.diagnosis.analyze.useMutation({
    onSuccess: p => {
      setPlan(p);
      setForceForm(false);
      setAutoRadarStarted(false);
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
      setAutoRadarStarted(false);
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
      toast.success(
        `Perfil excluido definitivamente. ${res?.creativesDeleted ?? 0} criativos e ${res?.approvalsDeleted ?? 0} aprovacoes removidos.`
      );
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
  const shown = plan ?? (forceForm ? null : existing.data);
  const rd: any = radar.data;

  useEffect(() => {
    if (!shown || forceForm || showHistory) return;
    if (autoRadarStarted || scanRadar.isPending) return;
    if (rd?.scannedAt || ((rd?.hits ?? []) as any[]).length > 0) return;
    const hasContext = Boolean(
      shown.profile?.handle ||
        shown.redes?.instagram ||
        shown._redes?.instagram ||
        shown.produto ||
        shown.nicho
    );
    if (!hasContext) return;
    setAutoRadarStarted(true);
    scanRadar.mutate(undefined);
  }, [
    autoRadarStarted,
    forceForm,
    showHistory,
    rd?.scannedAt,
    rd?.hits?.length,
    scanRadar.isPending,
    shown?.profile?.handle,
    shown?.redes?.instagram,
    shown?._redes?.instagram,
    shown?.produto,
    shown?.nicho,
  ]);

  useEffect(() => {
    if (!location.includes("studioReturn=")) return;
    setPlan(null);
    setForceForm(false);
    utils.diagnosis.get.invalidate();
    existing.refetch();
  }, [location]);

  useEffect(() => {
    if (!rd) return;
    setLikedHitKeys((rd.feedback?.likedPostKeys ?? []) as string[]);
    setDislikedHitKeys((rd.feedback?.dislikedPostKeys ?? []) as string[]);
  }, [rd?.scannedAt]);

  const diagnosisSteps = useMemo(
    () =>
      pickDiagnosisSteps({
        instagram: redes.instagram,
        tiktok: redes.tiktok,
        site: redes.site,
      }),
    [redes]
  );
  const formReady =
    produto.trim().length >= 3 && Object.values(redes).some(Boolean);

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
    setAutoRadarStarted(false);
    setProduto("");
    setSobre("");
    setObjetivo("vender");
    setRedes({ site: "", instagram: "", tiktok: "" });
    setFeedback("");
  };

  const refreshCurrentDiagnosis = () => {
    const current: any = shown;
    if (!current) return openBlankDiagnosis();
    const nextRedes = current.redes ??
      current._redes ?? {
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

  const markHit = (hit: any, value: "like" | "dislike") => {
    const key = hitKey(hit);
    if (value === "like") {
      setLikedHitKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
      setDislikedHitKeys(prev => prev.filter(k => k !== key));
    } else {
      setDislikedHitKeys(prev => (prev.includes(key) ? prev : [...prev, key]));
      setLikedHitKeys(prev => prev.filter(k => k !== key));
    }
  };

  const useRadarFeedback = async () => {
    await refineRadar.mutateAsync({
      likedPostKeys: likedHitKeys,
      dislikedPostKeys: dislikedHitKeys,
    });
    await recalibrate.mutateAsync({
      feedback:
        feedback || "Usar feedbacks do Radar no parecer e na prescricao.",
    });
  };

  const applyFeedbackAndOpenStudio = async () => {
    if (!rd) {
      scanRadar.mutate(undefined);
      return;
    }
    if (!likedHitKeys.length && !dislikedHitKeys.length) {
      toast.error("Marque Gostei ou Nao gostei em pelo menos uma referencia.");
      return;
    }
    await useRadarFeedback();
    navigate("/estudio");
  };

  const exportPdf = () => {
    try {
      window.localStorage.setItem(
        "cacarejar.radarFeedbackDraft",
        JSON.stringify({
          scannedAt: rd?.scannedAt,
          likedPostKeys: likedHitKeys,
          dislikedPostKeys: dislikedHitKeys,
        })
      );
    } catch {
      /* noop */
    }
    window.open("/app/diagnostico/relatorio", "_blank");
  };

  if (analyze.isPending) {
    return (
      <AppLayout
        title="Vamos estudar seu negocio"
        subtitle="O Agente Estrategista esta cruzando canais, Radar e prescricoes."
        journeyActive="diagnostico"
      >
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
      return [item.handle, item.nicho, item.produto, item.summary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return (
      <AppLayout
        title="Historico de diagnosticos"
        subtitle="Restaure estudos quando precisar comparar um perfil antigo."
        journeyActive="diagnostico"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(false)} className="btn-quiet">
              <ArrowRight className="w-4 h-4 rotate-180" /> Voltar
            </button>
            <button
              onClick={openBlankDiagnosis}
              className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Novo diagnostico
            </button>
          </div>
        }
      >
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-center gap-3 rounded-xl border border-[#e6ebf3] bg-[#f8fafc] px-4 py-3 mb-5">
            <Search className="w-4 h-4 text-[#61708a]" />
            <input
              value={searchArchive}
              onChange={e => setSearchArchive(e.target.value)}
              placeholder="Pesquisar por perfil, nicho ou resumo"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {items.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#e6ebf3] p-5 bg-white"
                >
                  <p className="text-xs font-black text-[#ff3217] uppercase">
                    {item.nicho || "Diagnostico"}
                  </p>
                  <h3 className="text-lg font-black text-[#071b44] mt-1">
                    {item.handle
                      ? `@${item.handle}`
                      : item.produto || "Sem perfil"}
                  </h3>
                  <p className="text-sm text-[#61708a] mt-2 line-clamp-3">
                    {item.summary || "Sem resumo salvo."}
                  </p>
                  <button
                    onClick={() => restoreArchive.mutate({ id: item.id })}
                    disabled={restoreArchive.isPending}
                    className="mt-4 w-full rounded-xl border border-[#e6ebf3] px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {restoreArchive.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}{" "}
                    Restaurar
                  </button>
                  <button
                    onClick={() => {
                      const label = item.handle
                        ? `@${item.handle}`
                        : item.produto || item.nicho || "este perfil";
                      const ok = window.confirm(
                        `Exclusao definitiva de ${label}.\n\nIsso apaga este perfil do historico e remove tudo que estiver ligado a ele: diagnostico salvo, Radar, ideias, criativos gerados, aprovacoes, variantes e revisoes relacionadas.\n\nEssa acao nao pode ser desfeita.`
                      );
                      if (!ok) return;
                      deleteArchive.mutate({ id: item.id });
                    }}
                    disabled={
                      deleteArchive.isPending || restoreArchive.isPending
                    }
                    className="mt-2 w-full rounded-xl border border-[#ffd0c8] bg-[#fff7f5] px-4 py-2.5 text-sm font-black text-[#c20f00] hover:bg-[#fff1ef] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {deleteArchive.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}{" "}
                    Excluir definitivo
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d9e1ee] bg-[#f8fafc] p-10 text-center text-sm font-bold text-[#61708a]">
              Nenhum historico encontrado.
            </div>
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
        journeyActive="diagnostico"
        actions={
          <button onClick={() => setShowHistory(true)} className="btn-quiet">
            <History className="w-4 h-4" /> Ver Historico
          </button>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-[#ff3217]" />
              <h2 className="text-lg font-black text-[#070b17]">
                Novo diagnostico multicanal
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field icon={Globe2} label="Site oficial">
                <input
                  value={redes.site}
                  onChange={e =>
                    setRedes(r => ({ ...r, site: e.target.value }))
                  }
                  placeholder="https://empresa.com.br"
                  className="input-clean"
                />
              </Field>
              <Field icon={Instagram} label="Instagram">
                <input
                  value={redes.instagram}
                  onChange={e =>
                    setRedes(r => ({ ...r, instagram: e.target.value }))
                  }
                  placeholder="@perfil"
                  className="input-clean"
                />
              </Field>
              <Field icon={Video} label="TikTok / Reels">
                <input
                  value={redes.tiktok}
                  onChange={e =>
                    setRedes(r => ({ ...r, tiktok: e.target.value }))
                  }
                  placeholder="@perfil ou link"
                  className="input-clean"
                />
              </Field>
            </div>
            <Field icon={Target} label="O que voce vende?" className="mt-4">
              <textarea
                value={produto}
                onChange={e => setProduto(e.target.value)}
                placeholder="Ex.: consultoria B2B, plataforma SaaS, curso, servico local..."
                className="input-clean min-h-[92px] resize-none"
              />
            </Field>
            <Field
              icon={MessageSquareText}
              label="Contexto opcional"
              className="mt-4"
            >
              <textarea
                value={sobre}
                onChange={e => setSobre(e.target.value)}
                placeholder="Cliente ideal, ticket, objecoes, diferenciais, concorrentes ou observacoes importantes."
                className="input-clean min-h-[110px] resize-none"
              />
            </Field>
            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex flex-wrap gap-2">
                {OBJETIVOS.map(o => (
                  <button
                    key={o.v}
                    onClick={() => setObjetivo(o.v)}
                    className={`rounded-full border px-4 py-2 text-xs font-black ${objetivo === o.v ? "bg-[#071b44] text-white border-[#071b44]" : "bg-white text-[#61708a] border-[#e6ebf3] hover:bg-[#f8fafc]"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                onClick={runAnalyze}
                disabled={!formReady || analyze.isPending}
                className="btn-action-primary px-6 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {analyze.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}{" "}
                Gerar diagnostico
              </button>
            </div>
          </section>

          <aside className="bg-[#071b44] text-white rounded-2xl p-6 shadow-sm h-fit">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest">
              Metodologia
            </p>
            <h3 className="text-2xl font-black mt-2 leading-tight">
              Parecer + prescricao + planner.
            </h3>
            <p className="text-sm text-white/75 mt-3 leading-relaxed">
              O diagnostico separa o que foi identificado em cada origem e
              transforma isso em plano de acao por canal: Blog / SEO, Instagram
              e TikTok / Reels.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {[
                "Fontes usadas",
                "Visao 360",
                "Cronograma",
                "Acompanhamento",
              ].map(label => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/8 p-3 text-sm font-black"
                >
                  {label}
                </div>
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
  const plano7Dias = shown.plano7Dias ?? [];
  const timeline = shown.cronogramaMulticanal ?? [];
  const acompanhamento = shown.acompanhamento;
  const interests = shown.interessesPosts ?? [];
  const hotHits = ((rd?.hits ?? []) as any[])
    .slice()
    .sort((a, b) => (b.hotScore ?? 0) - (a.hotScore ?? 0))
    .slice(0, 4);
  const radarFreeLeft = Math.max(
    0,
    (rd?.feedback?.freeLimit ?? 3) - (rd?.feedback?.refinementCount ?? 0)
  );
  const aprendizado = shown.aprendizadoSemanal;
  const motorOrganico = shown.motorOrganico;
  const campanhaAssistida = shown.campanhaAssistida;
  const brandDNA = shown.brandDNA;
  const topPosts = ((prof?.topPosts ?? []) as any[])
    .filter((post: any) => pickPostImage(post))
    .slice(0, 3);
  const topPostAnalyses = ((shown.analiseTopPosts ?? []) as string[]).filter(
    Boolean
  );
  const situacao = ((shown.situacao ?? []) as any[]).filter(
    item => item?.fator && item?.analise
  );
  const pilaresEstrategicos = ((shown.pilaresEstrategicos ?? []) as any[]).filter(
    item => item?.titulo
  );
  const dataQuality = (shown as any).dataQuality;
  const organicPackageText = motorOrganico
    ? [
        `Motor organico - ${(shown as any)?.produto || (shown as any)?.nicho || "perfil ativo"}`,
        "",
        `Leitura: ${motorOrganico.leitura || "-"}`,
        "",
        "Ajustes do perfil:",
        ...((motorOrganico.ajustesPerfil ?? []) as string[]).map(
          (x: string) => `- ${x}`
        ),
        "",
        "Termos para Social SEO:",
        ((motorOrganico.termosBuscaSocial ?? []) as string[]).join(", "),
        "",
        "Oportunidades:",
        ...((motorOrganico.oportunidades ?? []) as string[]).map(
          (x: string) => `- ${x}`
        ),
        "",
        "Proximos passos:",
        ...((motorOrganico.proximosPassos ?? []) as any[]).map(
          (x: any) => `- ${x.acao}: ${x.motivo}`
        ),
      ].join("\n")
    : "";
  const copyOrganicPackage = async () => {
    if (!organicPackageText) return;
    await navigator.clipboard?.writeText(organicPackageText);
    toast.success("Pacote organico copiado.");
  };
  const radarHasFeedback =
    !!rd?.scannedAt &&
    (((rd?.feedback?.likedPostKeys ?? []) as any[]).length +
      ((rd?.feedback?.dislikedPostKeys ?? []) as any[]).length >
      0 ||
      ((rd?.ideas ?? []) as any[]).some(
        (idea: any) =>
          idea.diagnosisDecision && idea.diagnosisDecision !== "agent"
      ));
  const savedRadarAdSignals =
    ((rd?.feedback?.likedHandles ?? []) as any[]).length +
    ((rd?.feedback?.likedPostKeys ?? []) as any[]).length;
  const canRunAdSpy = adQuery.trim().length > 0 || savedRadarAdSignals > 0;
  const journeyAction = !radarHasFeedback
    ? {
        label: "Validar referencias",
        title: "Proxima acao: escolher o que combina",
        text: "Veja os posts e perfis sugeridos, marque Gostei ou Nao gostei e use esse criterio antes de abrir o Estudio.",
        run: () => {
          const el = document.getElementById("radar-previo");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          else navigate("/radar");
        },
      }
    : plano7Dias.length > 0
      ? {
          label: "Abrir Estudio",
          title: "Proxima acao: criar e humanizar no Estudio",
          text: "As referencias ja receberam seu criterio. Agora os posts ficam no Estudio, onde voce edita visualmente antes de aprovar.",
          run: () => navigate("/estudio"),
        }
      : {
          label: "Abrir Estudio",
          title: "Proxima acao: criar os primeiros conteudos",
          text: "O diagnostico ja definiu a direcao. Agora a criacao acontece no Estudio, antes de qualquer aprovacao.",
          run: () => navigate("/estudio"),
        };

  return (
    <AppLayout
      title="Diagnostico"
      subtitle="Perfil ativo, referencias e plano da semana."
      journeyActive="diagnostico"
      actions={
        <div className="flex gap-2 flex-wrap justify-end items-center">
          <span className="hidden lg:flex text-xs font-black text-[#087a32] bg-[#eafff1] border border-[#bfeccb] rounded-xl items-center gap-1.5 px-3 py-2">
            <BadgeCheck className="w-3.5 h-3.5" /> Salvo
          </span>
          <button
            onClick={journeyAction.run}
            className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4" /> {journeyAction.label}
          </button>
          <button
            onClick={openBlankDiagnosis}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" /> Novo diagnostico
          </button>
          <details className="relative group">
            <summary className="list-none cursor-pointer rounded-xl border border-[#e6ebf3] bg-white px-3 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2">
              <MoreHorizontal className="w-4 h-4" /> Mais
            </summary>
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-2xl border border-[#e6ebf3] bg-white p-2 shadow-xl">
              <button
                onClick={() => setShowHistory(true)}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
              >
                <History className="w-4 h-4" /> Ver historico
              </button>
              <button
                onClick={refreshCurrentDiagnosis}
                disabled={analyze.isPending}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Atualizar dados
              </button>
              <button
                onClick={exportPdf}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" /> Exportar PDF
              </button>
            </div>
          </details>
        </div>
      }
    >
      {scanRadar.isPending && (
        <div className="max-w-3xl mx-auto mb-5">
          <AnalysisProgress
            steps={RADAR_STEPS}
            active
            title="Atualizando Radar de Mercado..."
            subtitle="O Agente Radar esta buscando sinais quentes para reforcar o parecer."
          />
        </div>
      )}

      {dataQuality?.status === "degraded" && (
        <section className="rounded-2xl border border-[#ffd5ce] bg-[#fff8f6] p-4 shadow-sm mb-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#ffd5ce] text-[#ff3217] grid place-items-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-black text-[#8f2014] uppercase tracking-wide">
              Leitura parcial dos dados
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

      <ProfileHero plan={shown} />

      <DiagnosisSummarySection
        plan={shown}
        parecer={parecer}
        topPostsCount={topPosts.length}
        radarCount={hotHits.length}
      />

      {topPosts.length > 0 && (
        <TopPostsSection posts={topPosts} analyses={topPostAnalyses} />
      )}

      <RadarPreviewSection
        hits={hotHits}
        likedHitKeys={likedHitKeys}
        dislikedHitKeys={dislikedHitKeys}
        onMark={markHit}
        onScan={() => scanRadar.mutate(undefined)}
        onRefine={useRadarFeedback}
        onContinue={applyFeedbackAndOpenStudio}
        onAdvanced={() => navigate("/radar")}
        loading={scanRadar.isPending}
        refining={refineRadar.isPending || recalibrate.isPending}
        hasRadar={!!rd?.scannedAt}
      />

      {timeline.length > 0 && (
        <SchedulePreviewSection
          timeline={timeline}
          onOpenStudio={() => navigate("/estudio")}
        />
      )}

      <details className="group rounded-2xl border border-[#e6ebf3] bg-white shadow-sm mb-5">
        <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
              Analise completa
            </p>
            <h2 className="text-xl font-black text-[#071b44]">
              Ver detalhes avancados
            </h2>
            <p className="text-sm text-[#61708a] mt-1">
              Metodo, motor organico, anuncios, Google, cronograma completo e acompanhamento ficam aqui para nao pesar a jornada.
            </p>
          </div>
          <span
            className="w-9 h-9 rounded-full border border-[#e6ebf3] bg-white text-[#071b44] grid place-items-center group-open:bg-[#071b44] group-open:text-white transition-colors"
            aria-label="Mostrar ou ocultar detalhes avancados"
          >
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="px-5 pb-5">

      {brandDNA && <BrandDNASection dna={brandDNA} />}

      {(situacao.length > 0 || pilaresEstrategicos.length > 0) && (
        <StrategicStudySection
          situacao={situacao}
          pilares={pilaresEstrategicos}
        />
      )}

      {motorOrganico && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <HeaderLine
              icon={Sparkles}
              title="Motor organico"
              subtitle="Antes de comprar trafego, fortalecer perfil, social SEO e consistencia de conteudo."
            />
            <button
              type="button"
              onClick={copyOrganicPackage}
              className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar pacote organico
            </button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_320px] gap-5 mt-5">
            <div className="rounded-3xl bg-[#071b44] text-white p-5">
              <p className="text-xs font-black text-white/60 uppercase">
                Score organico
              </p>
              <p className="text-5xl font-black mt-2">{motorOrganico.score}</p>
              <div className="h-2 rounded-full bg-white/15 mt-4 overflow-hidden">
                <div
                  className="h-full bg-[#ff3217]"
                  style={{ width: `${Math.min(100, motorOrganico.score)}%` }}
                />
              </div>
              <p className="text-xs text-white/75 leading-relaxed mt-4">
                {motorOrganico.leitura}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Ajustes do perfil
                </p>
                {(motorOrganico.ajustesPerfil ?? []).map((x: string) => (
                  <p
                    key={x}
                    className="text-xs text-[#22304b] leading-snug mt-2"
                  >
                    - {x}
                  </p>
                ))}
              </div>
              <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Social SEO
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(motorOrganico.termosBuscaSocial ?? []).map((x: string) => (
                    <Tag key={x}>{x}</Tag>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Oportunidades
                </p>
                {(motorOrganico.oportunidades ?? []).map((x: string) => (
                  <p
                    key={x}
                    className="text-xs text-[#22304b] leading-snug mt-2"
                  >
                    - {x}
                  </p>
                ))}
              </div>
            </div>
            {motorOrganico.scoreBreakdown?.length > 0 && (
              <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Por que esta nota
                </p>
                <div className="space-y-3 mt-3">
                  {motorOrganico.scoreBreakdown.map((item: any) => (
                    <div key={item.nome}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-[#071b44]">
                          {item.nome}
                        </p>
                        <span className="text-[10px] font-black text-[#61708a]">
                          {item.valor} pts
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#e6ebf3] overflow-hidden mt-1">
                        <div
                          className="h-full bg-[#ff3217]"
                          style={{
                            width: `${Math.min(100, (Number(item.valor) / 15) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-[#61708a] mt-1">
                        {item.detalhe}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {motorOrganico.proximosPassos?.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
              {motorOrganico.proximosPassos.map((item: any) => (
                <article
                  key={item.acao}
                  className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
                >
                  <p className="text-[10px] font-black text-[#ff3217] uppercase">
                    Proximo passo
                  </p>
                  <h3 className="text-sm font-black text-[#071b44] mt-1">
                    {item.acao}
                  </h3>
                  <p className="text-xs text-[#22304b] font-semibold leading-snug mt-2">
                    {item.motivo}
                  </p>
                  <p className="text-[11px] text-[#61708a] leading-snug mt-2">
                    {item.impacto}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
            Parecer estrategico
          </p>
          <h2 className="text-2xl font-black text-[#071b44] mt-2">
            {parecer.titulo || "O que o Agente encontrou"}
          </h2>
          <p className="text-base font-semibold text-[#22304b] leading-relaxed mt-3">
            {parecer.analise || shown.sumarioExecutivo || shown.resumo}
          </p>
          <div className="mt-5 rounded-2xl bg-[#071b44] text-white p-4">
            <p className="text-xs font-black text-white/60 uppercase">
              Prescricao imediata
            </p>
            <p className="text-sm font-bold leading-relaxed mt-1">
              {parecer.prescricaoImediata || shown.objetivoPrincipal}
            </p>
          </div>
          {parecer.radarImpacto && (
            <p className="text-sm text-[#61708a] mt-4 leading-relaxed">
              {parecer.radarImpacto}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
                Fontes usadas
              </p>
              <h3 className="text-lg font-black text-[#071b44] mt-1">
                De onde saiu o parecer
              </h3>
            </div>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
              {fontes.length || 0} fontes
            </span>
          </div>
          <div className="space-y-3 mt-4">
            {(fontes.length
              ? fontes
              : [
                  {
                    canal: "Diagnostico",
                    origem: "Informacoes digitadas",
                    sinal: "Briefing inicial",
                    impacto: "Base para o plano.",
                  },
                ]
            ).map((f: any, i: number) => (
              <div
                key={`${f.canal}-${i}`}
                className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#071b44]">{f.canal}</p>
                  {f.status && (
                    <span className="text-[10px] font-black text-[#61708a] bg-white rounded-full border border-[#e6ebf3] px-2 py-0.5">
                      {f.status}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#22304b] mt-1">
                  {f.origem}
                </p>
                <p className="text-xs text-[#61708a] mt-1 leading-relaxed">
                  {f.sinal}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {metodo.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine
            icon={Search}
            title="Metodo do diagnostico"
            subtitle="Como o Agente transformou canais, mercado e briefing em uma prescricao."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            {metodo.map((m: any) => (
              <article
                key={m.etapa}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5"
              >
                <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
                  {m.etapa}
                </p>
                <p className="text-sm font-bold text-[#071b44] leading-relaxed mt-2">
                  {m.leitura}
                </p>
                <div className="mt-3 rounded-xl bg-white border border-[#e6ebf3] p-3">
                  <p className="text-[10px] font-black text-[#61708a] uppercase">
                    Decisao
                  </p>
                  <p className="text-xs font-bold text-[#22304b] leading-relaxed mt-1">
                    {m.decisao}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {acoesImediatas.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine
            icon={BadgeCheck}
            title="Acoes imediatas"
            subtitle="O que executar primeiro antes de abrir novas frentes."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            {acoesImediatas.map((a: any) => (
              <article
                key={`${a.prioridade}-${a.canal}`}
                className="rounded-2xl border border-[#e6ebf3] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-[#ff3217] uppercase">
                      {a.prioridade}
                    </p>
                    <h3 className="text-lg font-black text-[#071b44] mt-1">
                      {a.canal}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">
                    fazer
                  </span>
                </div>
                <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-3">
                  {a.acao}
                </p>
                <p className="text-xs text-[#61708a] leading-relaxed mt-2">
                  {a.motivo}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {plano7Dias.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <HeaderLine
              icon={Pencil}
              title="Conteudos fora do diagnostico"
              subtitle={`O plano encontrou ${plano7Dias.length} direcoes para a semana. Para manter a jornada simples, a criacao e a edicao ficam concentradas no Estudio.`}
            />
            <button
              type="button"
              onClick={() => navigate("/estudio")}
              className="rounded-xl bg-[#071b44] text-white px-5 py-3 text-sm font-black inline-flex items-center justify-center gap-2 hover:bg-[#0b255c]"
            >
              Abrir Estudio <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {aprendizado && (
        <section className="rounded-2xl bg-[#071b44] text-white p-6 shadow-sm mb-5">
          <p className="text-xs font-black text-white/60 uppercase tracking-wide">
            Aprendizado semanal
          </p>
          <h2 className="text-2xl font-black mt-2">
            O que a semana esta ensinando
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mt-3">
            {aprendizado.resumo}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
              <p className="text-[10px] font-black text-white/50 uppercase">
                Melhor sinal
              </p>
              <p className="text-sm font-bold mt-2">
                {aprendizado.melhorSinal}
              </p>
            </div>
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
              <p className="text-[10px] font-black text-white/50 uppercase">
                Repetir
              </p>
              {(aprendizado.repetir ?? []).map((x: string) => (
                <p key={x} className="text-xs text-white/80 mt-2">
                  - {x}
                </p>
              ))}
            </div>
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
              <p className="text-[10px] font-black text-white/50 uppercase">
                Melhorar
              </p>
              {(aprendizado.melhorar ?? []).slice(0, 2).map((x: string) => (
                <p key={x} className="text-xs text-white/80 mt-2">
                  - {x}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-white text-[#071b44] p-4">
            <p className="text-[10px] font-black text-[#ff3217] uppercase">
              Proxima acao
            </p>
            <p className="text-sm font-black mt-1">{aprendizado.proximaAcao}</p>
          </div>
        </section>
      )}

      {campanhaAssistida && (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine
            icon={Megaphone}
            title="Campanha assistida"
            subtitle="Transforme o melhor sinal organico em teste pago manual, com controle humano antes de investir."
          />
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 mt-5">
            <div>
              <p className="text-xs font-black text-[#ff3217] uppercase">
                {campanhaAssistida.canal}
              </p>
              <h3 className="text-2xl font-black text-[#071b44] mt-1">
                {campanhaAssistida.titulo}
              </h3>
              <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-3">
                {campanhaAssistida.objetivo}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                  <p className="text-[10px] font-black text-[#61708a] uppercase">
                    Base
                  </p>
                  <p className="text-sm font-black text-[#071b44] mt-1">
                    {campanhaAssistida.base}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                  <p className="text-[10px] font-black text-[#61708a] uppercase">
                    Orcamento
                  </p>
                  <p className="text-sm font-black text-[#071b44] mt-1">
                    {campanhaAssistida.orcamento}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4 mt-3">
                <p className="text-[10px] font-black text-[#61708a] uppercase">
                  Copy sugerida
                </p>
                <p className="text-sm text-[#22304b] leading-relaxed mt-2">
                  {campanhaAssistida.copy}
                </p>
              </div>
            </div>
            <aside className="rounded-2xl bg-[#fff8f6] border border-[#ffd5ce] p-4">
              <p className="text-xs font-black text-[#ff3217] uppercase">
                Checklist antes de subir
              </p>
              {(campanhaAssistida.checklist ?? []).map((x: string) => (
                <p
                  key={x}
                  className="text-xs font-bold text-[#22304b] leading-snug mt-2"
                >
                  - {x}
                </p>
              ))}
              <p className="text-xs font-black text-[#071b44] uppercase mt-4">
                KPIs
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(campanhaAssistida.kpis ?? []).map((x: string) => (
                  <Tag key={x}>{x}</Tag>
                ))}
              </div>
            </aside>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine
          icon={Target}
          title="Prescricao por canal"
          subtitle="Cada canal recebe uma funcao clara, conteudos e KPIs proprios."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {prescricoes.map((p: any) => {
            const Icon = channelIcon(p.canal);
            return (
              <article
                key={p.canal}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-[#e6ebf3] flex items-center justify-center text-[#ff3217]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-[#071b44]">
                        {p.canal}
                      </h3>
                      <p className="text-xs font-bold text-[#61708a]">
                        {p.funcao}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">
                    {p.prioridade}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {(p.conteudos ?? []).map((c: string, i: number) => (
                    <p
                      key={i}
                      className="text-sm text-[#22304b] leading-relaxed"
                    >
                      <b>{i + 1}.</b> {c}
                    </p>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-white border border-[#e6ebf3] p-3">
                  <p className="text-xs font-black text-[#ff3217]">CTA</p>
                  <p className="text-sm font-bold text-[#071b44]">{p.cta}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(p.kpis ?? []).map((k: string) => (
                    <Tag key={k}>{k}</Tag>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {plan?.canais360?.canais?.length ? (
        <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
          <HeaderLine
            icon={Target}
            title="Visao 360 por canal"
            subtitle="Leitura, publicos, angulos de anuncio e formatos para cada canal com dado real: Instagram, TikTok e Google."
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
            {plan.canais360.canais.map((c: any) => {
              const Icon = channelIcon(c.canal);
              return (
                <div
                  key={c.canal}
                  className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4 flex flex-col"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-[#fff1ef] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-[#ff3217]" />
                    </span>
                    <p className="text-sm font-black text-[#071b44]">
                      {c.canal}
                    </p>
                  </div>
                  <p className="text-[11px] font-bold text-[#61708a] mt-2">
                    {c.papel}
                  </p>
                  <p className="text-xs text-[#22304b] leading-relaxed mt-2">
                    {c.leitura}
                  </p>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">
                    Publicos
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {(c.publicos ?? []).map((p: string) => (
                      <Tag key={p}>{p}</Tag>
                    ))}
                  </div>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">
                    Angulos de anuncio
                  </p>
                  <div className="space-y-2 mt-1">
                    {(c.angulosAnuncio ?? []).map((a: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[#e6ebf3] bg-white p-2.5"
                      >
                        <p className="text-xs font-black text-[#071b44]">
                          {a.nome}
                        </p>
                        <p className="text-[11px] text-[#22304b] leading-snug mt-1">
                          {a.mensagem}
                        </p>
                        <p className="text-[10px] text-[#61708a] font-bold mt-1">
                          <span className="text-[#ff3217]">Oferta:</span>{" "}
                          {a.oferta}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">
                    Formatos
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {(c.formatos ?? []).map((f: string) => (
                      <li key={f} className="text-[11px] text-[#22304b]">
                        - {f}
                      </li>
                    ))}
                  </ul>

                  <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-3">
                    Conteudos
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {(c.conteudos ?? []).map((f: string) => (
                      <li key={f} className="text-[11px] text-[#22304b]">
                        - {f}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(c.kpis ?? []).map((k: string) => (
                      <span
                        key={k}
                        className="text-[10px] font-bold text-[#61708a] bg-white border border-[#e6ebf3] rounded-full px-2 py-0.5"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <HeaderLine
            icon={Flame}
            title="Radar integrado ao parecer"
            subtitle="Marque os posts quentes para o Agente recalcular a leitura."
          />
          <div className="flex gap-2 flex-wrap mt-4 mb-4">
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
              {likedHitKeys.length} gostei / {dislikedHitKeys.length} nao gostei
            </span>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
              {radarFreeLeft} refinamento(s) gratis
            </span>
            <button
              onClick={() => scanRadar.mutate(undefined)}
              disabled={scanRadar.isPending}
              className="rounded-full border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              Atualizar Radar
            </button>
            <button
              onClick={useRadarFeedback}
              disabled={!rd || refineRadar.isPending || recalibrate.isPending}
              className="rounded-full bg-[#ff3217] text-white px-4 py-1 text-xs font-black disabled:opacity-50"
            >
              Usar feedbacks no diagnostico
            </button>
          </div>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Feedback opcional para o Agente antes de recalcular o parecer."
            className="input-clean min-h-[72px] resize-none mb-4"
          />
          {hotHits.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hotHits.map((hit: any) => {
                const key = hitKey(hit);
                const liked = likedHitKeys.includes(key);
                const disliked = dislikedHitKeys.includes(key);
                return (
                  <article
                    key={key}
                    className={`rounded-2xl overflow-hidden border bg-white ${liked ? "border-[#18b85c]" : disliked ? "border-[#ff3217]" : "border-[#e6ebf3]"}`}
                  >
                    {hit.img && (
                      <img
                        src={hit.img}
                        alt=""
                        className="w-full aspect-[4/3] object-cover bg-[#f8fafc]"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#071b44]">
                          @{hit.ownerUsername}
                        </p>
                        <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2 py-1">
                          {hit.hotScore ?? "-"} hot
                        </span>
                      </div>
                      <p className="text-xs text-[#22304b] leading-relaxed mt-2 line-clamp-5">
                        {hit.caption || hit.why || hit.theme}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button
                          onClick={() => markHit(hit, "like")}
                          className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${liked ? "bg-[#18b85c] text-white border-[#18b85c]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Gostei
                        </button>
                        <button
                          onClick={() => markHit(hit, "dislike")}
                          className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${disliked ? "bg-[#ff3217] text-white border-[#ff3217]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> Nao gostei
                        </button>
                      </div>
                      {hit.url && (
                        <a
                          href={absUrl(hit.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 text-[11px] font-black text-[#61708a] hover:text-[#071b44] flex items-center gap-1"
                        >
                          Abrir post <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyText>
              Atualize o Radar para trazer posts quentes para dentro do
              diagnostico.
            </EmptyText>
          )}
        </div>
      </section>

      {(() => {
        const adData: any =
          scanAds.data ??
          (plan?.anunciosScannedAt || plan?.anunciosDataQuality
            ? {
                query: plan.anunciosQuery,
                ads: plan.anunciosConcorrentes ?? [],
                insights: plan.anunciosInsights ?? [],
                querySource: plan.anunciosQuerySource,
                queryLabel: plan.anunciosQueryLabel,
                scannedAt: plan.anunciosScannedAt,
                dataQuality: plan.anunciosDataQuality,
              }
            : null);
        return (
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
            <HeaderLine
              icon={Megaphone}
              title="Espiao de Anuncios"
              subtitle="Com Radar validado, busca anuncios de referencias comparaveis. Sem Radar, use uma palavra-chave ou concorrente manual."
            />
            <div className="flex gap-2 flex-wrap mt-4 mb-4 items-center">
              <input
                value={adQuery}
                onChange={e => setAdQuery(e.target.value)}
                placeholder={
                  savedRadarAdSignals > 0
                    ? "Opcional: deixe em branco para usar referencias aprovadas no Radar"
                    : "Digite uma palavra-chave ou concorrente, ou rode o Radar antes"
                }
                className="input-clean flex-1 min-w-[220px]"
              />
              <button
                onClick={() =>
                  scanAds.mutate(
                    adQuery.trim() ? { query: adQuery.trim() } : undefined
                  )
                }
                disabled={scanAds.isPending || !canRunAdSpy}
                className="rounded-full bg-[#ff3217] text-white px-4 py-2 text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
              >
                {scanAds.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                {scanAds.isPending
                  ? "Escaneando..."
                  : adQuery.trim()
                    ? "Escanear busca"
                    : savedRadarAdSignals > 0
                      ? "Escanear referencias do Radar"
                      : "Informe termo ou use Radar"}
              </button>
            </div>
            {!canRunAdSpy && (
              <div className="rounded-2xl border border-[#ffd0c8] bg-[#fff8f7] p-4 mb-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#9b1c0b]">
                  Para chamar de concorrente, precisa de criterio
                </p>
                <p className="text-sm text-[#22304b] font-semibold leading-relaxed mt-1">
                  Rode o Radar e marque Gostei nos perfis/postagens que parecem
                  comparaveis, ou digite manualmente uma palavra-chave ou nome
                  de concorrente. A busca automatica ampla pelo produto foi
                  removida para evitar resultados estranhos.
                </p>
              </div>
            )}
            {adData?.dataQuality?.status === "degraded" && (
              <div className="rounded-2xl border border-[#ffd0c8] bg-[#fff8f7] p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-[#ffd0c8] flex items-center justify-center text-[#ff3217] shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#9b1c0b]">
                      Leitura parcial dos anuncios
                    </p>
                    <p className="text-sm text-[#22304b] font-semibold leading-relaxed mt-1">
                      {adData.dataQuality.message}
                    </p>
                    {!!adData.dataQuality.warnings?.length && (
                      <p className="text-xs text-[#61708a] mt-1">
                        {adData.dataQuality.warnings.join(" ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {scanAds.isPending ? (
              <EmptyText>
                Buscando anuncios reais na Biblioteca da Meta... isso pode levar
                1-2 minutos.
              </EmptyText>
            ) : adData?.ads?.length ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
                    Origem:{" "}
                    {adData.querySource === "radar"
                      ? adData.queryLabel || "Radar validado"
                      : adData.querySource === "manual"
                        ? "Busca manual"
                        : "Busca antiga por palavra-chave ampla"}
                  </span>
                  {adData.querySource !== "radar" && (
                    <span className="rounded-full bg-[#fff8f7] border border-[#ffd0c8] px-3 py-1 text-xs font-black text-[#9b1c0b]">
                      Valide aderencia antes de tratar como concorrente
                    </span>
                  )}
                </div>
                {adData.insights?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                    {adData.insights.map((ins: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
                      >
                        <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
                          {ins.titulo}
                        </p>
                        <p className="text-xs text-[#22304b] leading-relaxed mt-1">
                          {ins.detalhe}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {adData.ads.map((ad: any, i: number) => (
                    <article
                      key={i}
                      className="rounded-2xl overflow-hidden border border-[#e6ebf3] bg-white flex flex-col"
                    >
                      {ad.thumb && (
                        <img
                          src={ad.thumb}
                          alt=""
                          className="w-full aspect-[4/5] object-cover bg-[#f8fafc]"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="p-3 flex flex-col flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#071b44] truncate">
                            {ad.advertiser}
                          </p>
                          {ad.active && ad.runningDays != null && (
                            <span className="text-[10px] font-black text-white bg-[#18b85c] rounded-full px-2 py-1 whitespace-nowrap">
                              {ad.runningDays}d no ar
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#22304b] leading-relaxed mt-2 line-clamp-5 flex-1">
                          {ad.text}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ad.cta && (
                            <span className="text-[10px] font-black text-[#071b44] bg-[#f1f5fb] rounded-full px-2 py-0.5">
                              {ad.cta}
                            </span>
                          )}
                          {(ad.platforms || []).slice(0, 2).map((p: string) => (
                            <span
                              key={p}
                              className="text-[10px] font-bold text-[#61708a] bg-[#f8fafc] rounded-full px-2 py-0.5"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                        {ad.adLibraryUrl && (
                          <a
                            href={absUrl(ad.adLibraryUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 text-[11px] font-black text-[#61708a] hover:text-[#071b44] flex items-center gap-1"
                          >
                            Ver na Biblioteca{" "}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {adData.query && (
                  <p className="text-[11px] text-[#61708a] mt-3">
                    Busca: <b>{adData.query}</b>
                    {adData.scannedAt
                      ? ` - ${new Date(adData.scannedAt).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                )}
              </>
            ) : (
              <EmptyText>
                Para ver anuncios de concorrentes, digite uma busca manual ou
                rode o Radar antes e marque Gostei nas referencias que fazem
                sentido para este negocio.
              </EmptyText>
            )}
          </section>
        );
      })()}

      {(() => {
        const g: any =
          scanGoogle.data ??
          (plan?.googleSEO?.termos?.length || plan?.googleSEO?.perguntas?.length
            ? plan.googleSEO
            : null);
        return (
          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
            <HeaderLine
              icon={Globe2}
              title="O que seu cliente pesquisa no Google"
              subtitle="Buscas reais (autocomplete do Google) sobre o seu nicho — viram pauta de conteudo e anuncio de busca."
            />
            <div className="flex gap-2 flex-wrap mt-4 mb-4 items-center">
              <input
                value={googleQuery}
                onChange={e => setGoogleQuery(e.target.value)}
                placeholder={`Palavra-chave (padrao: ${plan?.produto || plan?.nicho || "seu nicho"})`}
                className="input-clean flex-1 min-w-[220px]"
              />
              <button
                onClick={() =>
                  scanGoogle.mutate(
                    googleQuery.trim()
                      ? { query: googleQuery.trim() }
                      : undefined
                  )
                }
                disabled={scanGoogle.isPending}
                className="rounded-full bg-[#ff3217] text-white px-4 py-2 text-xs font-black disabled:opacity-50 flex items-center gap-1.5"
              >
                {scanGoogle.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
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
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">
                        Pautas sugeridas (SEO)
                      </p>
                      <div className="space-y-2 mt-2">
                        {g.ideiasConteudo.map((idea: any, i: number) => (
                          <div
                            key={i}
                            className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-3"
                          >
                            <span className="text-[10px] font-black text-white bg-[#071b44] rounded-full px-2 py-0.5">
                              {idea.tipo}
                            </span>
                            <p className="text-xs font-bold text-[#071b44] mt-1.5">
                              {idea.titulo}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                <div>
                  {g.perguntas?.length ? (
                    <>
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">
                        Perguntas que pesquisam
                      </p>
                      <ul className="mt-2 space-y-1">
                        {g.perguntas.map((q: string) => (
                          <li key={q} className="text-xs text-[#22304b]">
                            - {q}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {g.termos?.length ? (
                    <>
                      <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide mt-4">
                        Termos relacionados
                        {g.fonteVolume === "dataforseo"
                          ? " (volume real/mes)"
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {g.termos.map((t: any, i: number) => {
                          const label = typeof t === "string" ? t : t?.termo;
                          const vol =
                            typeof t === "object" ? t?.volume : undefined;
                          return (
                            <span
                              key={label || i}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#22304b] bg-[#f1f5fb] border border-[#e6ebf3] rounded-full px-2.5 py-1"
                            >
                              {label}
                              {typeof vol === "number" ? (
                                <span className="text-[10px] font-black text-[#18b85c]">
                                  {vol.toLocaleString("pt-BR")}/mes
                                </span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyText>
                Clique em "Buscar no Google" para ver o que as pessoas realmente
                pesquisam sobre o seu nicho - e transformar em pauta de
                conteudo.
              </EmptyText>
            )}
            {g?.termo && !scanGoogle.isPending && (
              <p className="text-[11px] text-[#61708a] mt-3">
                Busca base: <b>{g.termo}</b>
              </p>
            )}
          </section>
        );
      })()}

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine
          icon={BarChart3}
          title="Visao 360: interesses pelos posts"
          subtitle="Sinais inferidos por posts, Radar e ideias marcadas."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {interests.slice(0, 4).map((it: any) => (
            <InterestCard key={it.nome} item={it} />
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <HeaderLine
          icon={CalendarDays}
          title="Cronograma multicanal"
          subtitle="O plano vira execucao semanal por canal."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {timeline.map((week: any) => (
            <article
              key={week.semana}
              className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5"
            >
              <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">
                {week.semana}
              </span>
              <h3 className="text-lg font-black text-[#071b44] mt-3">
                {week.tema}
              </h3>
              <div className="space-y-2 mt-3">
                {(week.canais ?? []).map((c: any) => (
                  <p
                    key={`${week.semana}-${c.canal}`}
                    className="text-sm text-[#22304b]"
                  >
                    <b>{c.canal}:</b> {c.acao}{" "}
                    <span className="text-[#61708a]">({c.objetivo})</span>
                  </p>
                ))}
              </div>
              <p className="text-xs font-bold text-[#18b85c] mt-3">
                {week.meta}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
        <HeaderLine
          icon={TrendingUp}
          title="Acompanhamento"
          subtitle="Foto inicial, check-in e leitura de campanha para o proximo ciclo."
        />
        {acompanhamento ? (
          <div className="grid grid-cols-1 xl:grid-cols-[.8fr_1.2fr] gap-5 mt-5">
            <div className="rounded-2xl bg-[#071b44] text-white p-5">
              <p className="text-xs font-black text-white/60 uppercase">
                {acompanhamento.ciclo}
              </p>
              <div className="mt-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm font-bold text-white/70">
                    Progresso
                  </span>
                  <span className="text-4xl font-black">
                    {acompanhamento.progresso ?? 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/15 mt-3 overflow-hidden">
                  <div
                    className="h-full bg-[#ff3217]"
                    style={{
                      width: `${Math.min(100, acompanhamento.progresso ?? 0)}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-sm font-bold mt-4">
                Proximo foco: {acompanhamento.proximoFoco}
              </p>
              <p className="text-xs text-white/70 mt-2">
                {acompanhamento.novaPrescricao}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(acompanhamento.snapshots ?? []).map((s: any) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
                >
                  <h3 className="text-sm font-black text-[#071b44]">
                    {s.label}
                  </h3>
                  <p className="text-xs text-[#61708a] mt-2 line-clamp-4">
                    {s.resumo}
                  </p>
                  <div className="space-y-2 mt-3">
                    {(s.scores ?? []).map((score: any) => (
                      <ScoreRow
                        key={score.nome}
                        label={score.nome}
                        value={score.valor}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyText>
            O planner sera criado junto com o proximo diagnostico.
          </EmptyText>
        )}
      </section>
        </div>
      </details>
    </AppLayout>
  );
}

function DiagnosisSummarySection({
  plan,
  parecer,
  topPostsCount,
  radarCount,
}: {
  plan: any;
  parecer: any;
  topPostsCount: number;
  radarCount: number;
}) {
  const negocio =
    plan?.produto || plan?.nicho || plan?.profile?.fullName || "este perfil";
  const leitura =
    parecer?.analise ||
    plan?.sumarioExecutivo ||
    plan?.resumo ||
    "Os Agentes montaram uma primeira leitura do perfil. Agora escolha as referencias que fazem sentido antes de criar.";
  const prescricao =
    parecer?.prescricaoImediata ||
    plan?.objetivoPrincipal ||
    "Validar referencias reais e transformar a melhor direcao em conteudo editavel no Estudio.";
  return (
    <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-5">
        <div>
          <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
            Resumo simples
          </p>
          <h2 className="text-2xl font-black text-[#071b44] mt-2">
            O que entendemos sobre {negocio}
          </h2>
          <p className="text-base font-semibold text-[#22304b] leading-relaxed mt-3">
            {leitura}
          </p>
        </div>
        <div className="rounded-2xl bg-[#071b44] text-white p-5">
          <p className="text-xs font-black text-white/60 uppercase">
            Proximo clique
          </p>
          <h3 className="text-xl font-black mt-2">
            Escolha as referencias antes de criar
          </h3>
          <p className="text-sm text-white/75 leading-relaxed mt-2">
            {prescricao}
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <MiniStat label="Posts do perfil" value={topPostsCount || "-"} />
            <MiniStat label="Referencias" value={radarCount || "-"} />
          </div>
        </div>
      </div>
    </section>
  );
}

function RadarPreviewSection({
  hits,
  likedHitKeys,
  dislikedHitKeys,
  onMark,
  onScan,
  onRefine,
  onContinue,
  onAdvanced,
  loading,
  refining,
  hasRadar,
}: {
  hits: any[];
  likedHitKeys: string[];
  dislikedHitKeys: string[];
  onMark: (hit: any, value: "like" | "dislike") => void;
  onScan: () => void;
  onRefine: () => void;
  onContinue: () => void;
  onAdvanced: () => void;
  loading: boolean;
  refining: boolean;
  hasRadar: boolean;
}) {
  const feedbackCount = likedHitKeys.length + dislikedHitKeys.length;
  return (
    <section
      id="radar-previo"
      className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5 scroll-mt-28"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <HeaderLine
          icon={Radar}
          title="Referencias encontradas"
          subtitle="Marque o que combina e o que nao combina. Esse criterio guia os posts no Estudio."
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onScan}
            disabled={loading}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            {hasRadar ? "Rebuscar previa" : "Buscar referencias"}
          </button>
          <button
            type="button"
            onClick={onAdvanced}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc]"
          >
            Radar avancado
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5 mt-5">
          <p className="text-sm font-black text-[#071b44]">
            Buscando posts e perfis parecidos...
          </p>
          <p className="text-xs text-[#61708a] mt-1">
            A primeira previa fica aqui para voce validar sem sair do Diagnostico.
          </p>
        </div>
      ) : hits.length ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
            {hits.map((hit: any) => {
              const key = hitKey(hit);
              const liked = likedHitKeys.includes(key);
              const disliked = dislikedHitKeys.includes(key);
              return (
                <article
                  key={key}
                  className={`rounded-2xl border overflow-hidden bg-white flex flex-col ${liked ? "border-[#18b85c]" : disliked ? "border-[#ff3217]" : "border-[#e6ebf3]"}`}
                >
                  {hit.img ? (
                    <img
                      src={hit.img}
                      alt=""
                      className="w-full aspect-[4/3] object-cover bg-[#f8fafc]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-[#f8fafc] grid place-items-center text-[#61708a]">
                      <Radar className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-[#071b44] truncate">
                        @{hit.ownerUsername || "referencia"}
                      </p>
                      <span className="text-[10px] font-black text-white bg-[#ff3217] rounded-full px-2 py-1">
                        {hit.hotScore ?? "-"} hot
                      </span>
                    </div>
                    <p className="text-xs text-[#22304b] leading-relaxed mt-2 line-clamp-4 flex-1">
                      {hit.why || hit.mechanism || hit.caption || hit.theme}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => onMark(hit, "like")}
                        className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${liked ? "bg-[#18b85c] text-white border-[#18b85c]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Gostei
                      </button>
                      <button
                        type="button"
                        onClick={() => onMark(hit, "dislike")}
                        className={`rounded-xl border px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 ${disliked ? "bg-[#ff3217] text-white border-[#ff3217]" : "bg-white text-[#071b44] border-[#e6ebf3]"}`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> Nao
                      </button>
                    </div>
                    {hit.url && (
                      <a
                        href={absUrl(hit.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 text-[11px] font-black text-[#61708a] hover:text-[#071b44] inline-flex items-center gap-1"
                      >
                        Abrir post <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="rounded-2xl border border-[#ffd6ce] bg-[#fff8f6] p-4 mt-5 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-black text-[#071b44]">
                {feedbackCount
                  ? `${feedbackCount} escolha(s) feitas.`
                  : "Escolha pelo menos uma referencia para ensinar o criterio."}
              </p>
              <p className="text-xs text-[#61708a] mt-1">
                Depois disso, as sugestoes de post aparecem no Estudio.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefine}
              disabled={!feedbackCount || refining}
              className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-3 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              {refining ? "Refinando..." : "Refinar com minhas escolhas"}
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!feedbackCount || refining}
              className="rounded-xl bg-[#071b44] text-white px-5 py-3 text-xs font-black hover:bg-[#0b255c] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              Usar e abrir Estudio <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-[#ffd6ce] bg-[#fff8f6] p-5 mt-5">
          <p className="text-sm font-black text-[#071b44]">
            Ainda nao ha referencias para validar.
          </p>
          <p className="text-xs text-[#61708a] mt-1">
            Clique em Buscar referencias ou use o Radar avancado para informar perfis especificos.
          </p>
        </div>
      )}
    </section>
  );
}

function SchedulePreviewSection({
  timeline,
  onOpenStudio,
}: {
  timeline: any[];
  onOpenStudio: () => void;
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <HeaderLine
          icon={CalendarDays}
          title="Cronograma recomendado"
          subtitle="Uma previa simples do caminho sugerido. A criacao dos posts acontece no Estudio."
        />
        <button
          type="button"
          onClick={onOpenStudio}
          className="rounded-xl bg-[#071b44] text-white px-5 py-3 text-sm font-black inline-flex items-center justify-center gap-2 hover:bg-[#0b255c]"
        >
          Ver sugestoes no Estudio <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
        {timeline.slice(0, 4).map((week: any) => {
          const first = (week.canais ?? [])[0] ?? {};
          return (
            <article
              key={week.semana}
              className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
            >
              <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">
                {week.semana}
              </span>
              <h3 className="text-base font-black text-[#071b44] mt-3">
                {week.tema || first.acao || "Execucao da semana"}
              </h3>
              <p className="text-xs text-[#22304b] leading-relaxed mt-2">
                {first.canal ? `${first.canal}: ` : ""}
                {first.acao || week.meta || "Abrir no Estudio e preparar o conteudo."}
              </p>
              {week.meta && (
                <p className="text-[11px] font-bold text-[#18b85c] mt-3">
                  {week.meta}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
      <p className="text-[10px] font-black text-white/55 uppercase">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

function ProfileHero({ plan }: { plan: any }) {
  const prof = plan.profile;
  const profileTitle = prof?.handle
    ? `@${prof.handle}`
    : plan.linkedin360?.empresa ||
      plan.site?.title ||
      plan.produto ||
      "Diagnostico";
  const profileSub =
    prof?.fullName ||
    plan.nicho ||
    plan.site?.url ||
    plan.linkedin ||
    "Plano multicanal";
  return (
    <section
      className="rounded-3xl p-6 mb-5 text-white shadow-lg"
      style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}
    >
      <div className="flex items-center gap-5 flex-wrap">
        {prof?.profilePic ? (
          <img
            src={prof.profilePic}
            alt=""
            className="w-20 h-20 rounded-full object-cover border border-white/30"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center">
            <Target className="w-9 h-9 text-white/70" />
          </div>
        )}
        <div className="flex-1 min-w-[240px]">
          <p className="text-2xl font-black leading-tight">{profileTitle}</p>
          <p className="text-sm text-white/75 mt-1">{profileSub}</p>
          {plan.linkedin && (
            <a
              href={absUrl(plan.linkedin)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white mt-2"
            >
              Abrir LinkedIn <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HeroMetric label="Seguidores" value={nf(prof?.followers)} />
          <HeroMetric label="Seguindo" value={nf(prof?.following)} />
          <HeroMetric label="Posts" value={nf(prof?.postsCount)} />
          <HeroMetric
            label="Engajamento"
            value={prof?.engajamentoPct ? `${prof.engajamentoPct}%` : "-"}
            hot
          />
        </div>
      </div>
    </section>
  );
}

function BrandDNASection({ dna }: { dna: any }) {
  const paleta = Array.isArray(dna.paleta) ? dna.paleta.filter(Boolean) : [];
  const motivos = Array.isArray(dna.motivos) ? dna.motivos.filter(Boolean) : [];
  return (
    <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
      <HeaderLine
        icon={Palette}
        title="DNA da marca"
        subtitle="A base visual e verbal que os Agentes devem preservar antes do toque humano final."
      />
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-5 mt-5">
        <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
          <p className="text-[10px] font-black text-[#ff3217] uppercase">
            Leitura visual
          </p>
          <p className="text-sm font-bold text-[#071b44] leading-relaxed mt-2">
            {dna.resumoVisual || "Visual humano, coerente e reconhecivel."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <InfoTile title="Tom" value={dna.tom || "Direto, util e humano"} />
            <InfoTile
              title="Estilo de imagem"
              value={dna.estiloFoto || "Editorial realista com contexto"}
            />
            <InfoTile
              title="Tipografia"
              value={dna.tipografia || "Sans-serif forte"}
            />
            <InfoTile
              title="Regra pratica"
              value="Agente cria a base; humano adiciona verdade, detalhe e criterio."
            />
          </div>
        </div>
        <div className="space-y-4">
          {paleta.length > 0 && (
            <div className="rounded-2xl border border-[#e6ebf3] bg-white p-4">
              <p className="text-[10px] font-black text-[#ff3217] uppercase">
                Paleta
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {paleta.slice(0, 6).map((color: string) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e6ebf3] bg-[#fbfcff] px-3 py-1.5 text-[10px] font-black text-[#071b44]"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ background: color }}
                    />
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
          {motivos.length > 0 && (
            <div className="rounded-2xl border border-[#e6ebf3] bg-white p-4">
              <p className="text-[10px] font-black text-[#ff3217] uppercase">
                Motivos recorrentes
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {motivos.slice(0, 8).map((item: string) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TopPostsSection({
  posts,
  analyses,
}: {
  posts: any[];
  analyses: string[];
}) {
  return (
    <section className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
      <HeaderLine
        icon={Flame}
        title="Posts campeoes que orientam a criacao"
        subtitle="As sugestoes devem partir do que ja funcionou no perfil: imagem real, engajamento e mecanismo criativo. O Estudio adapta, nao copia."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        {posts.map((post: any, index: number) => (
          <article
            key={`${post.url || post.img || index}`}
            className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] overflow-hidden flex flex-col"
          >
            <img
              src={pickPostImage(post)}
              alt=""
              className="w-full aspect-[4/3] object-cover bg-[#f8fafc]"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 flex flex-col flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-[#ff3217] uppercase">
                  Post {index + 1}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black text-[#61708a]">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="w-3 h-3 text-[#ff3217]" />
                    {nf(post.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquareText className="w-3 h-3" />
                    {nf(post.comments)}
                  </span>
                </div>
              </div>
              <p className="text-sm font-bold text-[#071b44] leading-relaxed mt-3">
                {analyses[index] ||
                  `Este post virou referencia porque juntou imagem forte, tema reconhecivel e resposta real da audiencia: ${shortText(post.caption, 170)}`}
              </p>
              {post.caption && (
                <p className="text-xs text-[#61708a] leading-relaxed mt-3 line-clamp-4">
                  {shortText(post.caption, 220)}
                </p>
              )}
              {post.url && (
                <a
                  href={absUrl(post.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 text-[11px] font-black text-[#61708a] hover:text-[#071b44] inline-flex items-center gap-1"
                >
                  Abrir post original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StrategicStudySection({
  situacao,
  pilares,
}: {
  situacao: any[];
  pilares: any[];
}) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-[.95fr_1.05fr] gap-5 mb-5">
      {situacao.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <HeaderLine
            icon={Search}
            title="Analise da situacao"
            subtitle="O que o perfil mostra agora e o que isso muda na decisao."
          />
          <div className="space-y-3 mt-5">
            {situacao.slice(0, 5).map((item: any, index: number) => (
              <div
                key={`${item.fator}-${index}`}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
              >
                <p className="text-[10px] font-black text-[#ff3217] uppercase tracking-wide">
                  {item.fator}
                </p>
                <p className="text-sm font-semibold text-[#22304b] leading-relaxed mt-1">
                  {item.analise}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {pilares.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-6 shadow-sm">
          <HeaderLine
            icon={Target}
            title="Pilares estrategicos"
            subtitle="Os movimentos que devem guiar Radar, Estudio, aprovacao e publicacao."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {pilares.slice(0, 4).map((pilar: any, index: number) => (
              <article
                key={`${pilar.titulo}-${index}`}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
              >
                <span className="rounded-full bg-[#071b44] text-white text-[10px] font-black px-3 py-1">
                  Pilar {index + 1}
                </span>
                <h3 className="text-base font-black text-[#071b44] mt-3">
                  {pilar.titulo}
                </h3>
                <p className="text-xs text-[#61708a] leading-relaxed mt-2">
                  {pilar.objetivo}
                </p>
                <div className="space-y-2 mt-3">
                  {(pilar.acoes ?? []).slice(0, 3).map((acao: any, i: number) => (
                    <p
                      key={`${acao.acao}-${i}`}
                      className="text-xs text-[#22304b] leading-relaxed"
                    >
                      <b>{acao.acao}:</b> {acao.detalhe}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e6ebf3] bg-white p-3">
      <p className="text-[10px] font-black text-[#61708a] uppercase">{title}</p>
      <p className="text-xs font-bold text-[#22304b] leading-snug mt-1">
        {value}
      </p>
    </div>
  );
}

function Field({ icon: Icon, label, children, className = "" }: any) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black text-[#071b44] flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-[#ff3217]" /> {label}
      </span>
      {children}
    </label>
  );
}

function HeaderLine({ icon: Icon, title, subtitle }: any) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#ff3217]" /> {title}
        </h2>
        {subtitle && <p className="text-sm text-[#61708a] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function HeroMetric({ label, value, hot = false }: any) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 min-w-[116px] text-center ${hot ? "border-[#ff3217]/70 bg-[#ff3217]/10" : "border-white/15 bg-white/10"}`}
    >
      <p className="text-[10px] font-black text-white/60 uppercase">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function Tag({ children }: any) {
  return (
    <span className="rounded-full border border-[#e6ebf3] bg-white px-3 py-1 text-[10px] font-black text-[#071b44]">
      {children}
    </span>
  );
}

function ChipBox({ title, items = [] }: { title: string; items?: string[] }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <p className="text-xs font-black text-[#ff3217] uppercase">{title}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {items.slice(0, 8).map(item => (
          <Tag key={item}>{item}</Tag>
        ))}
      </div>
    </div>
  );
}

function InterestCard({ item }: { item: any }) {
  return (
    <article className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-[#fff1ef] text-[#ff3217] px-3 py-1 text-[10px] font-black uppercase">
            {item.categoria}
          </span>
          <h3 className="text-lg font-black text-[#071b44] mt-3">
            {item.nome}
          </h3>
        </div>
        <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">
          {item.score ?? 0}/100
        </span>
      </div>
      <p className="text-sm text-[#22304b] mt-3 leading-relaxed">
        {item.sinal}
      </p>
      <p className="text-xs text-[#61708a] mt-3">
        <b className="text-[#070b17]">LinkedIn:</b> {item.conteudoLinkedIn}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {(item.targeting ?? []).slice(0, 5).map((t: string) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
    </article>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-[#61708a]">{label}</span>
        <span className="text-[#071b44]">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-[#edf1f7] mt-1 overflow-hidden">
        <div
          className="h-full bg-[#ff3217]"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function EmptyText({ children }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9e1ee] bg-[#f8fafc] p-8 text-center text-sm font-bold text-[#61708a] mt-5">
      {children}
    </div>
  );
}
