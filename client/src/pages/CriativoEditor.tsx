/**
 * Editor de Criativo — página inteira, estilo Whisk/Pomelli.
 * Painel esquerdo: imagem grande + ações (regerar, upload próprio, histórico).
 * Painel direito (com abas): Brief · Direção de Arte · Imagem.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { JourneyGuide } from "@/components/JourneyGuide";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Upload,
  History,
  Save,
  Send,
  Download,
  Loader2,
  Pencil,
  Palette,
  FileText,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Tag,
  Hash,
  Megaphone,
  Target,
  Layers,
  Eye,
  Trash2,
  AlertTriangle,
  Copy,
  CheckCircle2,
  ShieldCheck,
  GitCompareArrows,
  UserRoundCheck,
} from "lucide-react";

type Tab = "brief" | "art" | "image";

export default function CriativoEditor() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/criativos/:id");
  const id = params?.id ? Number(params.id) : null;
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );
  const returnTo = searchParams.get("returnTo") || "";
  const closeOnSave = searchParams.get("closeOnSave") === "1";

  const cQuery = trpc.studio.getCreative.useQuery(
    { id: id! },
    { enabled: id != null }
  );
  const diagnosis = trpc.diagnosis.get.useQuery();
  const c: any = cQuery.data;
  const meta: any = c?.generationMeta ?? {};
  const brandDNA: any = (diagnosis.data as any)?.brandDNA;

  const [tab, setTab] = useState<Tab>("brief");
  const [copy, setCopy] = useState("");
  const [briefing, setBriefing] = useState("");
  const [gancho, setGancho] = useState("");
  const [cta, setCta] = useState("");
  const [hashtagsTxt, setHashtagsTxt] = useState("");
  const [pilar, setPilar] = useState("");
  const [angulo, setAngulo] = useState("");
  const [formato, setFormato] = useState("");
  const [visualPrompt, setVisualPrompt] = useState("");
  const [promptOverride, setPromptOverride] = useState("");
  const [keepStyle, setKeepStyle] = useState(true);
  const [roteiroTxt, setRoteiroTxt] = useState("");
  const emptyHumanChecks = {
    detalheReal: false,
    pontoDeVista: false,
    visualHumano: false,
    ctaClaro: false,
    naoGenerico: false,
  };
  const [humanChecks, setHumanChecks] = useState(emptyHumanChecks);
  const [humanNote, setHumanNote] = useState("");
  const [finalVersion, setFinalVersion] = useState(false);
  const [humanTemplate, setHumanTemplate] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  const loadedRoteiroTxt = useMemo(
    () => (meta.roteiro ? JSON.stringify(meta.roteiro, null, 2) : ""),
    [meta.roteiro]
  );
  const loadedHashtagsTxt = useMemo(
    () => (Array.isArray(meta.hashtags) ? meta.hashtags.join(" ") : ""),
    [meta.hashtags]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!c) return false;
    return (
      !!pendingImageUrl ||
      dirty ||
      copy !== (c.copy ?? "") ||
      briefing !== (c.briefing ?? "") ||
      gancho !== (meta.gancho ?? "") ||
      cta !== (meta.cta ?? "") ||
      hashtagsTxt !== loadedHashtagsTxt ||
      pilar !== (meta.pilar ?? "") ||
      angulo !== (meta.angulo ?? c.lente ?? "") ||
      formato !== (c.formato ?? meta.formato ?? "imagem") ||
      visualPrompt !== (meta.visualPrompt ?? "") ||
      roteiroTxt !== loadedRoteiroTxt ||
      JSON.stringify(humanChecks) !==
        JSON.stringify(meta.humanReview?.checks ?? emptyHumanChecks) ||
      humanNote !== (meta.humanReview?.note ?? "") ||
      finalVersion !== !!meta.humanReview?.finalVersion ||
      humanTemplate !== (meta.humanReview?.template ?? "")
    );
  }, [
    pendingImageUrl,
    dirty,
    c,
    meta.gancho,
    meta.cta,
    meta.pilar,
    meta.angulo,
    meta.formato,
    meta.visualPrompt,
    meta.humanReview,
    loadedHashtagsTxt,
    loadedRoteiroTxt,
    copy,
    briefing,
    gancho,
    cta,
    hashtagsTxt,
    pilar,
    angulo,
    formato,
    visualPrompt,
    roteiroTxt,
    humanChecks,
    humanNote,
    finalVersion,
    humanTemplate,
  ]);

  // Sincroniza estado local quando criativo carrega ou refetch.
  useEffect(() => {
    if (!c) return;
    setCopy(c.copy ?? "");
    setBriefing(c.briefing ?? "");
    setFormato(c.formato ?? meta.formato ?? "imagem");
    setGancho(meta.gancho ?? "");
    setCta(meta.cta ?? "");
    setHashtagsTxt(Array.isArray(meta.hashtags) ? meta.hashtags.join(" ") : "");
    setPilar(meta.pilar ?? "");
    setAngulo(meta.angulo ?? c.lente ?? "");
    setVisualPrompt(meta.visualPrompt ?? "");
    setRoteiroTxt(meta.roteiro ? JSON.stringify(meta.roteiro, null, 2) : "");
    setHumanChecks(meta.humanReview?.checks ?? emptyHumanChecks);
    setHumanNote(meta.humanReview?.note ?? "");
    setFinalVersion(!!meta.humanReview?.finalVersion);
    setHumanTemplate(meta.humanReview?.template ?? "");
    setPromptOverride("");
    setDirty(false);
  }, [c?.id, c?.imageUrl]);

  useEffect(() => {
    setPendingImageUrl(null);
  }, [c?.id]);

  const versions: any[] = useMemo(
    () => (Array.isArray(meta.versions) ? [...meta.versions].reverse() : []),
    [meta.versions]
  );
  const textVersions: any[] = useMemo(
    () =>
      Array.isArray(meta.textVersions) ? [...meta.textVersions].reverse() : [],
    [meta.textVersions]
  );
  const agentDraft: any =
    meta.agentDraft ?? textVersions[textVersions.length - 1];

  const refreshLinkedScreens = async () => {
    await Promise.allSettled([
      utils.creatives.list.invalidate(),
      utils.diagnosis.get.invalidate(),
      utils.radar.get.invalidate(),
      utils.approvals.pendingForClient.invalidate(),
    ]);
  };
  const goBack = () => {
    if (returnTo && closeOnSave && hasUnsavedChanges) {
      saveAll();
      return;
    }
    if (returnTo) navigate(returnTo);
    else if (window.history.length > 1) window.history.back();
    else navigate("/criativos");
  };

  const save = trpc.studio.updateCreative.useMutation({
    onSuccess: async () => {
      await refreshLinkedScreens();
      await cQuery.refetch();
      setDirty(false);
      setPendingImageUrl(null);
      toast.success("Alterações salvas!");
      if (closeOnSave && returnTo) navigate(returnTo);
    },
    onError: e => toast.error(e.message || "Erro ao salvar"),
  });
  const regen = trpc.studio.regenerateImage.useMutation({
    onSuccess: async data => {
      setPendingImageUrl((data as any)?.imageUrl ?? "__changed__");
      await refreshLinkedScreens();
      await cQuery.refetch();
      toast.success("Nova imagem gerada. Salve para confirmar e voltar.");
    },
    onError: e => toast.error(e.message || "Erro ao regerar"),
  });
  const setImg = trpc.studio.setImage.useMutation({
    onSuccess: async data => {
      setPendingImageUrl((data as any)?.imageUrl ?? "__changed__");
      await refreshLinkedScreens();
      await cQuery.refetch();
      toast.success("Imagem atualizada. Salve para confirmar e voltar.");
    },
    onError: e => toast.error(e.message || "Erro no upload"),
  });
  const revert = trpc.studio.revertImage.useMutation({
    onSuccess: async data => {
      setPendingImageUrl((data as any)?.imageUrl ?? "__changed__");
      await refreshLinkedScreens();
      await cQuery.refetch();
      toast.success("Versao restaurada. Salve para confirmar e voltar.");
    },
    onError: e => toast.error(e.message || "Erro ao restaurar"),
  });
  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => {
      toast.success("Enviado para aprovação!");
      navigate("/aprovacao");
    },
    onError: e => toast.error(e.message || "Erro ao enviar"),
  });
  const deleteCreative = trpc.studio.deleteCreative.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      toast.success("Criativo excluído");
      navigate(returnTo || "/criativos");
    },
    onError: e => toast.error(e.message || "Erro ao excluir"),
  });
  const duplicateCreative = trpc.studio.duplicateCreative.useMutation({
    onSuccess: async (data: any) => {
      await utils.creatives.list.invalidate();
      toast.success("Variacao duplicada.");
      navigate(`/criativos/${data.id}`);
    },
    onError: e => toast.error(e.message || "Erro ao duplicar"),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveAll() {
    if (!id) return;
    let roteiro: any = undefined;
    try {
      roteiro = roteiroTxt.trim() ? JSON.parse(roteiroTxt) : null;
    } catch {
      /* mantém antigo */
    }
    save.mutate({
      id,
      copy,
      briefing,
      gancho,
      cta,
      pilar,
      angulo,
      formato,
      visualPrompt,
      hashtags: hashtagsTxt
        .split(/\s+/)
        .filter(Boolean)
        .map(h => (h.startsWith("#") ? h : "#" + h)),
      humanReview: {
        checks: humanChecks,
        note: humanNote.trim() || null,
        finalVersion,
        template: humanTemplate || null,
        score: Object.values(humanChecks).filter(Boolean).length,
        reviewedAt: Date.now(),
      },
      ...(roteiro !== undefined ? { roteiro } : {}),
    });
  }

  function handleUpload(file?: File) {
    if (!file || !id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImg.mutate({ id, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  function handleRegen() {
    if (!id) return;
    regen.mutate({
      id,
      promptOverride: promptOverride.trim() || visualPrompt.trim() || undefined,
      keepStyle,
    });
  }

  function restoreTextVersion(v: any) {
    setBriefing(v.briefing ?? "");
    setCopy(v.copy ?? "");
    setGancho(v.gancho ?? "");
    setCta(v.cta ?? "");
    setHashtagsTxt(Array.isArray(v.hashtags) ? v.hashtags.join(" ") : "");
    setPilar(v.pilar ?? "");
    setAngulo(v.angulo ?? "");
    setFormato(v.formato ?? "imagem");
    setVisualPrompt(v.visualPrompt ?? "");
    setRoteiroTxt(v.roteiro ? JSON.stringify(v.roteiro, null, 2) : "");
    if (v.humanReview?.checks) setHumanChecks(v.humanReview.checks);
    if (v.humanReview?.note !== undefined)
      setHumanNote(v.humanReview.note ?? "");
    setFinalVersion(!!v.humanReview?.finalVersion);
    setHumanTemplate(v.humanReview?.template ?? "");
    setDirty(true);
    toast.success("Versao carregada. Revise e salve para aplicar.");
  }

  function applyHumanTemplate(kind: "bastidor" | "prova" | "opiniao") {
    const base = copy.trim();
    const lead =
      kind === "bastidor"
        ? "Bastidor real:"
        : kind === "prova"
          ? "O sinal que importa:"
          : "Minha leitura:";
    const insert =
      kind === "bastidor"
        ? "troque este trecho por uma cena real, uma conversa, uma objecao ou um detalhe que so esta marca teria."
        : kind === "prova"
          ? "adicione numero, caso, depoimento, antes/depois ou uma evidencia concreta antes do CTA."
          : "coloque um ponto de vista claro, mesmo que simples, para o post nao parecer neutro demais.";
    setCopy(`${lead} ${insert}\n\n${base}`.trim());
    setHumanTemplate(kind);
    setHumanChecks(prev => ({
      ...prev,
      detalheReal: kind !== "opiniao" ? true : prev.detalheReal,
      pontoDeVista: kind === "opiniao" ? true : prev.pontoDeVista,
      naoGenerico: true,
    }));
    setDirty(true);
    toast.success(
      "Molde humano aplicado. Ajuste o trecho com informacao real."
    );
  }

  function applyCopyVariant(kind: "direta" | "historia" | "autoridade") {
    const base = copy.trim() || gancho.trim();
    const next =
      kind === "direta"
        ? `${gancho || "O ponto principal"}\n\n${base}\n\n${cta || "Me chama para dar o proximo passo."}`
        : kind === "historia"
          ? `Antes de falar da oferta, olha a situacao real:\n\n${base}\n\nFoi isso que mostrou o caminho para ${cta || "conversar com quem precisa resolver isso agora"}.`
          : `Existe um erro comum aqui: tratar isso como detalhe.\n\n${base}\n\nA diferenca esta em criterio, consistencia e execucao. ${cta || ""}`.trim();
    setCopy(next);
    setHumanTemplate(kind);
    setHumanChecks(prev => ({
      ...prev,
      pontoDeVista: kind !== "direta" ? true : prev.pontoDeVista,
      ctaClaro: true,
      naoGenerico: true,
    }));
    setDirty(true);
    toast.success("Variacao de copy aplicada.");
  }

  if (!id)
    return (
      <AppLayout title="Criativo">
        <p className="text-sm text-muted-foreground">Criativo inválido.</p>
      </AppLayout>
    );
  if (cQuery.isLoading || !c) {
    return (
      <AppLayout title="Carregando criativo…">
        <div className="flex justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const savingLabel = closeOnSave && returnTo ? "Salvar e voltar" : "Salvar";
  const footerSavingLabel =
    closeOnSave && returnTo
      ? "Salvar e voltar para origem"
      : "Salvar alterações";

  const angChip =
    angulo === "dor"
      ? "bg-red-50 text-red-600 border-red-200"
      : angulo === "transformacao"
        ? "bg-violet-50 text-violet-600 border-violet-200"
        : "bg-emerald-50 text-emerald-600 border-emerald-200";

  return (
    <AppLayout
      title="Editor de criativo"
      subtitle={c.briefing}
      actions={
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="text-xs font-bold text-[#61708a] hover:text-[#070b17] flex items-center gap-1.5 px-3 py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <button
            onClick={saveAll}
            disabled={!hasUnsavedChanges || save.isPending}
            className="text-xs font-black text-[#070b17] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {save.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {savingLabel}
          </button>
          <button
            onClick={() => duplicateCreative.mutate({ id: c.id })}
            disabled={duplicateCreative.isPending}
            className="text-xs font-black text-[#071b44] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] flex items-center gap-1.5 px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {duplicateCreative.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Duplicar
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-bold text-[#c20f00] hover:text-white hover:bg-[#c20f00] border border-[#ffd0c8] hover:border-[#c20f00] flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors"
            title="Excluir criativo"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
          <button
            onClick={() => sendApproval.mutate({ creativeIds: [c.id] })}
            disabled={sendApproval.isPending}
            className="text-xs font-black text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(180deg,#18b85c,#0f8d44)" }}
          >
            {sendApproval.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Enviar p/ aprovação
          </button>
        </div>
      }
    >
      <JourneyGuide active="estudio" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-5">
        {/* ═══════ PAINEL ESQUERDO — IMAGEM ═══════ */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm overflow-hidden">
            <div className="aspect-square bg-[#f6f8fc] relative">
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-[#cfd8e6]" />
                </div>
              )}
              {regen.isPending && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                  <p className="text-sm text-white font-bold">
                    Regerando imagem…
                  </p>
                  <p className="text-[11px] text-white/70">~8-12 segundos</p>
                </div>
              )}
              {setImg.isPending && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                  <p className="text-sm text-white font-bold">
                    Enviando imagem…
                  </p>
                </div>
              )}
            </div>
            {/* Ações sobre a imagem */}
            <div className="p-4 grid grid-cols-2 gap-2 border-t border-[#e6ebf3]">
              <button
                onClick={handleRegen}
                disabled={regen.isPending}
                className="text-xs font-black text-white px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: "linear-gradient(180deg,#ff421f,#f0200d)",
                }}
              >
                {regen.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Regerar imagem
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                disabled={setImg.isPending}
                className="text-xs font-black text-[#070b17] border border-[#e6ebf3] hover:border-[#071b44] hover:bg-[#f6f8fc] px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir imagem própria
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleUpload(e.target.files?.[0])}
              />

              {c.imageUrl && (
                <a
                  href={c.imageUrl}
                  download
                  className="text-xs font-bold text-[#61708a] hover:text-[#070b17] border border-[#e6ebf3] px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 col-span-1"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
              )}
              <button
                onClick={() => window.open(c.imageUrl, "_blank")}
                className="text-xs font-bold text-[#61708a] hover:text-[#070b17] border border-[#e6ebf3] px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 col-span-1"
              >
                <Eye className="w-3.5 h-3.5" /> Abrir em tela cheia
              </button>
            </div>
            <p className="px-4 pb-3 text-[10px] text-[#61708a]">
              Regerar usa o prompt da aba "Direção de Arte". 15 créditos por
              geração.
            </p>
          </div>

          {/* Histórico de versões */}
          {versions.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm p-4">
              <h3 className="text-xs font-black text-[#070b17] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#ff3217]" /> Histórico (
                {versions.length})
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {versions.slice(0, 8).map((v, i) => (
                  <button
                    key={i}
                    onClick={() =>
                      revert.mutate({ id: c.id, imageUrl: v.imageUrl })
                    }
                    disabled={revert.isPending}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-[#e6ebf3] hover:border-[#ff3217]"
                    title="Restaurar esta versão"
                  >
                    <img
                      src={v.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-colors">
                      <RefreshCw className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                    <span className="absolute bottom-0.5 left-0.5 text-[8px] font-black text-white bg-black/60 px-1 rounded uppercase">
                      {v.kind ?? "v"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#61708a] mt-2">
                Clique numa versão para restaurar.
              </p>
            </div>
          )}
        </div>

        {/* Painel direito de edicao */}
        <div className="space-y-4">
          {/* Chips do brief */}
          <div className="flex items-center gap-2 flex-wrap">
            {pilar && (
              <span className="text-[10px] font-black text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded-full px-2.5 py-1">
                {pilar}
              </span>
            )}
            {formato && (
              <span className="text-[10px] font-black text-[#61708a] bg-[#f1f4f9] border border-[#e6ebf3] rounded-full px-2.5 py-1 uppercase flex items-center gap-1">
                {formato === "reels" && <Film className="w-2.5 h-2.5" />}
                {formato}
              </span>
            )}
            {angulo && (
              <span
                className={`text-[10px] font-black border rounded-full px-2.5 py-1 ${angChip}`}
              >
                {angulo}
              </span>
            )}
            <span className="text-[10px] font-bold text-[#9aa7bd] ml-auto">
              ID #{c.id} · {c.status}
            </span>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm">
            <div className="flex border-b border-[#e6ebf3]">
              <TabBtn
                active={tab === "brief"}
                onClick={() => setTab("brief")}
                icon={<FileText className="w-3.5 h-3.5" />}
              >
                Brief
              </TabBtn>
              <TabBtn
                active={tab === "art"}
                onClick={() => setTab("art")}
                icon={<Palette className="w-3.5 h-3.5" />}
              >
                Direção de Arte
              </TabBtn>
              <TabBtn
                active={tab === "image"}
                onClick={() => setTab("image")}
                icon={<ImageIcon className="w-3.5 h-3.5" />}
              >
                Imagem
              </TabBtn>
            </div>

            <div className="p-5 space-y-4">
              {/* ─── BRIEF ─── */}
              {tab === "brief" && (
                <>
                  <Field
                    icon={<FileText className="w-3 h-3" />}
                    label="Nome interno / brief"
                    hint="Identifica este criativo no Estudio e nas telas de origem."
                  >
                    <input
                      value={briefing}
                      onChange={e => {
                        setBriefing(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Ex.: Dia 1 - Instagram"
                      className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                    />
                  </Field>
                  <Field
                    icon={<Target className="w-3 h-3" />}
                    label="Gancho (3 segundos)"
                    hint="Frase que prende nos primeiros segundos. Pergunta intrigante, número surpreendente, promessa."
                  >
                    <input
                      value={gancho}
                      onChange={e => {
                        setGancho(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Ex.: Quanto rende R$100/mês investido?"
                      className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                    />
                  </Field>
                  <Field
                    icon={<Megaphone className="w-3 h-3" />}
                    label="Legenda / Copy"
                    hint="Texto do post. Tom alinhado ao DNA da marca."
                  >
                    <textarea
                      value={copy}
                      onChange={e => {
                        setCopy(e.target.value);
                        setDirty(true);
                      }}
                      rows={5}
                      className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217] resize-none"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      icon={<Hash className="w-3 h-3" />}
                      label="Hashtags"
                      hint="Separadas por espaço."
                    >
                      <input
                        value={hashtagsTxt}
                        onChange={e => {
                          setHashtagsTxt(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="#financas #investimentos"
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                      />
                    </Field>
                    <Field
                      icon={<Tag className="w-3 h-3" />}
                      label="CTA"
                      hint="Chamada de ação."
                    >
                      <input
                        value={cta}
                        onChange={e => {
                          setCta(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="Ex.: Toca no link e garante o seu"
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                      />
                    </Field>
                  </div>
                  <div className="rounded-xl border border-[#e6ebf3] bg-white p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                          <UserRoundCheck className="w-3.5 h-3.5 text-[#ff3217]" />{" "}
                          Oficina de humanizacao
                        </h4>
                        <p className="text-[11px] text-[#61708a] mt-1">
                          Use um molde para tirar o texto da neutralidade e
                          depois substitua o trecho por informacao real.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fbfcff] border border-[#e6ebf3] px-3 py-1 text-[10px] font-black text-[#071b44]">
                        {humanTemplate || "sem molde"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => applyHumanTemplate("bastidor")}
                        className="rounded-lg border border-[#e6ebf3] bg-[#fbfcff] hover:border-[#071b44] px-3 py-2 text-left"
                      >
                        <span className="block text-[11px] font-black text-[#071b44]">
                          Bastidor real
                        </span>
                        <span className="block text-[10px] text-[#61708a] mt-0.5">
                          cena, detalhe ou conversa que so a marca teria
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHumanTemplate("prova")}
                        className="rounded-lg border border-[#e6ebf3] bg-[#fbfcff] hover:border-[#071b44] px-3 py-2 text-left"
                      >
                        <span className="block text-[11px] font-black text-[#071b44]">
                          Prova concreta
                        </span>
                        <span className="block text-[10px] text-[#61708a] mt-0.5">
                          numero, depoimento, caso ou antes/depois
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyHumanTemplate("opiniao")}
                        className="rounded-lg border border-[#e6ebf3] bg-[#fbfcff] hover:border-[#071b44] px-3 py-2 text-left"
                      >
                        <span className="block text-[11px] font-black text-[#071b44]">
                          Ponto de vista
                        </span>
                        <span className="block text-[10px] text-[#61708a] mt-0.5">
                          opiniao clara para nao parecer generico
                        </span>
                      </button>
                    </div>
                    <div className="mt-3 rounded-lg border border-[#e6ebf3] bg-[#fbfcff] p-3">
                      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide flex items-center gap-1.5">
                        <GitCompareArrows className="w-3.5 h-3.5" /> Testes de
                        copy
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[
                          ["direta", "Direta"],
                          ["historia", "Historia"],
                          ["autoridade", "Autoridade"],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyCopyVariant(key as any)}
                            className="rounded-full border border-[#dbe3ef] bg-white px-3 py-1.5 text-[10px] font-black text-[#071b44] hover:border-[#ff3217]"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#ff3217]" />{" "}
                          Checklist anti-generico
                        </h4>
                        <p className="text-[11px] text-[#61708a] mt-1">
                          Os Agentes entregam a base; marque quando o criativo
                          ganhou verdade humana.
                        </p>
                      </div>
                      <span className="rounded-full bg-white border border-[#e6ebf3] px-3 py-1 text-[10px] font-black text-[#071b44]">
                        {Object.values(humanChecks).filter(Boolean).length}/5
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                      {[
                        ["detalheReal", "Tem um detalhe real da marca"],
                        ["pontoDeVista", "Tem opiniao ou ponto de vista"],
                        ["visualHumano", "Visual parece humano e especifico"],
                        ["ctaClaro", "CTA esta claro e sem exagero"],
                        ["naoGenerico", "Nao poderia ser de qualquer empresa"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-bold text-[#22304b] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(humanChecks as any)[key]}
                            onChange={e => {
                              setHumanChecks(prev => ({
                                ...prev,
                                [key]: e.target.checked,
                              }));
                              setDirty(true);
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={humanNote}
                      onChange={e => {
                        setHumanNote(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Ex.: adicionei um bastidor real da loja, troquei promessa generica por uma opiniao nossa, usei uma imagem que parece feita por humano."
                      className="mt-3 w-full min-h-[72px] resize-none rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                    />
                    <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 cursor-pointer">
                      <span className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#18b85c] mt-0.5" />
                        <span>
                          <span className="block text-xs font-black text-[#071b44]">
                            Versao humana final
                          </span>
                          <span className="block text-[10px] text-[#61708a] mt-0.5">
                            Marque quando texto e visual estao prontos para sair
                            da plataforma.
                          </span>
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={finalVersion}
                        onChange={e => {
                          setFinalVersion(e.target.checked);
                          setDirty(true);
                        }}
                      />
                    </label>
                    {Object.values(humanChecks).filter(Boolean).length < 4 ? (
                      <p className="text-[11px] text-[#8f2014] bg-[#fff8f6] border border-[#ffd5ce] rounded-lg px-3 py-2 mt-3">
                        Antes de aprovar, refine copy ou imagem para sair da
                        cara de anuncio automatico.
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#087a32] bg-[#eafff1] border border-[#bfeccb] rounded-lg px-3 py-2 mt-3">
                        <CheckCircle2 className="inline w-3 h-3 mr-1" />
                        Criativo com toque humano suficiente para teste.
                      </p>
                    )}
                  </div>
                  {(brandDNA || agentDraft) && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {brandDNA && <StudioBrandKit dna={brandDNA} />}
                      {agentDraft && (
                        <AgentDraftCompare
                          draft={agentDraft}
                          current={{
                            gancho,
                            copy,
                            cta,
                            hashtagsTxt,
                            visualPrompt,
                          }}
                        />
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <Field icon={<Layers className="w-3 h-3" />} label="Pilar">
                      <input
                        value={pilar}
                        onChange={e => {
                          setPilar(e.target.value);
                          setDirty(true);
                        }}
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                      />
                    </Field>
                    <Field label="Angulo">
                      <select
                        value={angulo}
                        onChange={e => {
                          setAngulo(e.target.value);
                          setDirty(true);
                        }}
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                      >
                        <option value="desejo">Desejo</option>
                        <option value="dor">Dor</option>
                        <option value="transformacao">Transformação</option>
                      </select>
                    </Field>
                    <Field label="Formato">
                      <select
                        value={formato}
                        onChange={e => {
                          setFormato(e.target.value);
                          setDirty(true);
                        }}
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217]"
                      >
                        <option value="imagem">Imagem</option>
                        <option value="reels">Reels</option>
                        <option value="carrossel">Carrossel</option>
                      </select>
                    </Field>
                  </div>

                  {/* Roteiro de vídeo (se houver) */}
                  {(formato === "reels" ||
                    formato === "carrossel" ||
                    roteiroTxt) && (
                    <Field
                      icon={<Film className="w-3 h-3" />}
                      label="Roteiro (JSON)"
                      hint='Estrutura: { "gancho3s": "...", "cenas": [{ "tempo": "0-3s", "acao": "...", "audio": "..." }], "cta": "..." }'
                    >
                      <textarea
                        value={roteiroTxt}
                        onChange={e => {
                          setRoteiroTxt(e.target.value);
                          setDirty(true);
                        }}
                        rows={8}
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-xs font-mono bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217] resize-none"
                      />
                    </Field>
                  )}
                  {textVersions.length > 0 && (
                    <div className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-[#ff3217]" />{" "}
                            Versoes de texto
                          </h4>
                          <p className="text-[11px] text-[#61708a] mt-1">
                            Recupere uma versao anterior da legenda, gancho,
                            CTA, roteiro ou direcao de arte.
                          </p>
                        </div>
                        <span className="rounded-full bg-white border border-[#e6ebf3] px-3 py-1 text-[10px] font-black text-[#071b44]">
                          {textVersions.length}
                        </span>
                      </div>
                      <div className="space-y-2 mt-3">
                        {textVersions.slice(0, 5).map((v, i) => (
                          <button
                            key={`${v.at ?? i}-${i}`}
                            type="button"
                            onClick={() => restoreTextVersion(v)}
                            className="w-full text-left rounded-lg border border-[#e6ebf3] bg-white hover:border-[#071b44] p-3 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-black text-[#071b44] truncate">
                                {v.gancho || v.briefing || "Versao anterior"}
                              </p>
                              <span className="text-[10px] font-bold text-[#61708a] whitespace-nowrap">
                                {v.at
                                  ? new Date(v.at).toLocaleString("pt-BR")
                                  : `#${i + 1}`}
                              </span>
                            </div>
                            {v.copy && (
                              <p className="text-[11px] text-[#61708a] line-clamp-2 mt-1">
                                {v.copy}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Direcao de arte */}
              {tab === "art" && (
                <>
                  <Field
                    icon={<Palette className="w-3 h-3" />}
                    label="Prompt de imagem (visualPrompt)"
                    hint="Briefing de direção de arte em inglês. Cena, luz, lente, paleta da marca. Este prompt é usado pelo botão 'Regerar'."
                  >
                    <textarea
                      value={visualPrompt}
                      onChange={e => {
                        setVisualPrompt(e.target.value);
                        setDirty(true);
                      }}
                      rows={8}
                      placeholder="Editorial lifestyle photo of…"
                      className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-xs font-mono bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217] resize-none"
                    />
                  </Field>

                  <div className="rounded-lg border border-[#fff1ef] bg-[#fff8f6] p-4 space-y-3">
                    <h4 className="text-xs font-black text-[#ff3217] uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Regerar imagem
                    </h4>
                    <Field
                      label="Override do prompt (opcional)"
                      hint="Se preencher, é este prompt que vai pro modelo (em vez do salvo acima)."
                    >
                      <textarea
                        value={promptOverride}
                        onChange={e => setPromptOverride(e.target.value)}
                        rows={3}
                        placeholder="Deixe em branco para usar o prompt salvo."
                        className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2.5 text-xs font-mono bg-white focus:outline-none focus:border-[#ff3217] resize-none"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#22304b] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keepStyle}
                        onChange={e => setKeepStyle(e.target.checked)}
                      />
                      Manter estilo da marca como referência (img2img)
                    </label>
                    <button
                      onClick={handleRegen}
                      disabled={regen.isPending}
                      className="w-full text-sm font-black text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        background: "linear-gradient(180deg,#ff421f,#f0200d)",
                      }}
                    >
                      {regen.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {regen.isPending
                        ? "Gerando…"
                        : "Regerar imagem (15 créditos)"}
                    </button>
                  </div>

                  {meta.clonedFrom && (
                    <div className="rounded-lg border border-[#e6ebf3] p-3 flex items-center gap-3">
                      <img
                        src={meta.clonedFrom}
                        alt=""
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-[#61708a] uppercase">
                          Referência de estilo
                        </p>
                        <p className="text-[11px] text-[#22304b] font-semibold">
                          Clonado a partir desta imagem.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ─── IMAGEM ─── */}
              {tab === "image" && (
                <>
                  <div
                    className="rounded-lg border-2 border-dashed border-[#e6ebf3] hover:border-[#ff3217] p-8 text-center cursor-pointer transition-colors"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      handleUpload(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <Upload className="w-8 h-8 text-[#cfd8e6] mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#22304b]">
                      Subir imagem própria
                    </p>
                    <p className="text-[11px] text-[#61708a] mt-1">
                      JPG, PNG ou WebP. Clique ou arraste aqui. A imagem atual
                      vai pro histórico — você pode restaurar depois.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#e6ebf3] p-3 space-y-2">
                    <h4 className="text-xs font-black text-[#070b17] uppercase tracking-wide">
                      Detalhes técnicos
                    </h4>
                    <Row label="Modelo" value={meta.model ?? "—"} />
                    <Row label="Proporção" value={c.ratio ?? "—"} />
                    <Row
                      label="Gerada em"
                      value={
                        c.createdAt
                          ? new Date(c.createdAt).toLocaleString("pt-BR")
                          : "—"
                      }
                    />
                    {c.imageUrl && (
                      <Row
                        label="URL"
                        value={
                          <a
                            className="text-[#ff3217] hover:underline truncate block"
                            href={c.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.imageUrl}
                          </a>
                        }
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rodapé com Salvar fixo */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-[#61708a]">
                {hasUnsavedChanges
                  ? "Você tem alterações não salvas."
                  : "Todas as alterações salvas."}
              </p>
              {pendingImageUrl && (
                <p className="text-[10px] font-black text-[#ff3217] mt-1">
                  Imagem nova pronta. Salve para atualizar a tela de origem.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveAll}
                disabled={!hasUnsavedChanges || save.isPending}
                className="text-xs font-black text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg,#071b44,#0d2a5e)",
                }}
              >
                {save.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {footerSavingLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#fff1ef] flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-[#c20f00]" />
            </div>
            <h2 className="text-lg font-black text-[#070b17]">
              Excluir este criativo?
            </h2>
            <p className="text-sm text-[#22304b] mt-2 leading-relaxed">
              Você está prestes a excluir{" "}
              <span className="font-black">{c.briefing}</span>. A imagem, o
              brief e todas as versões anteriores vão sumir.
            </p>
            <p className="text-[11px] text-[#61708a] mt-2">
              Esta ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs font-bold text-[#070b17] border border-[#e6ebf3] hover:bg-[#f6f8fc] px-4 py-2.5 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteCreative.mutate({ id: c.id })}
                disabled={deleteCreative.isPending}
                className="text-xs font-black text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#c20f00" }}
              >
                {deleteCreative.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs font-black py-3 px-4 flex items-center justify-center gap-1.5 transition-colors ${active ? "text-[#ff3217] border-b-2 border-[#ff3217] bg-[#fff8f6]" : "text-[#61708a] hover:text-[#070b17] border-b-2 border-transparent"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  icon,
  label,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-black text-[#61708a] uppercase tracking-wide flex items-center gap-1 mb-1.5">
        {icon}
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[#9aa7bd] mt-1">{hint}</p>}
    </div>
  );
}

function StudioBrandKit({ dna }: { dna: any }) {
  const palette = Array.isArray(dna.paleta)
    ? dna.paleta.filter(Boolean).slice(0, 5)
    : [];
  const motivos = Array.isArray(dna.motivos)
    ? dna.motivos.filter(Boolean).slice(0, 4)
    : [];
  return (
    <div className="rounded-xl border border-[#e6ebf3] bg-white p-4">
      <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-[#ff3217]" /> DNA ativo da marca
      </h4>
      <p className="text-[11px] text-[#22304b] font-semibold leading-snug mt-2">
        {dna.resumoVisual ||
          "Preserve consistencia visual, tom e contexto real."}
      </p>
      {palette.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {palette.map((color: string) => (
            <span
              key={color}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#e6ebf3] bg-[#fbfcff] px-2.5 py-1 text-[10px] font-black text-[#071b44]"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10"
                style={{ background: color }}
              />
              {color}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
        <MiniInfo label="Tom" value={dna.tom || "Humano e direto"} />
        <MiniInfo
          label="Imagem"
          value={dna.estiloFoto || "Realista com contexto"}
        />
      </div>
      {motivos.length > 0 && (
        <p className="text-[10px] text-[#61708a] font-bold mt-3">
          {motivos.join(" · ")}
        </p>
      )}
    </div>
  );
}

function AgentDraftCompare({ draft, current }: { draft: any; current: any }) {
  const currentText = current.copy || "";
  const draftText = draft.copy || "";
  const changed =
    currentText.trim() !== draftText.trim() ||
    (current.gancho || "") !== (draft.gancho || "");
  return (
    <div className="rounded-xl border border-[#e6ebf3] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-black text-[#071b44] uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ff3217]" /> Base dos Agentes
            x edicao
          </h4>
          <p className="text-[11px] text-[#61708a] mt-1">
            {changed
              ? "A versao humana ja mudou a base inicial."
              : "A base inicial ainda esta praticamente igual."}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${changed ? "bg-[#eafff1] text-[#087a32] border border-[#bfeccb]" : "bg-[#fff8f6] text-[#8f2014] border border-[#ffd5ce]"}`}
        >
          {changed ? "humanizado" : "base pura"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <CompareBox
          title="Base"
          text={draftText || draft.gancho || "Sem base registrada."}
        />
        <CompareBox
          title="Atual"
          text={currentText || current.gancho || "Sem edicao atual."}
        />
      </div>
    </div>
  );
}

function CompareBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-[#e6ebf3] bg-[#fbfcff] p-3">
      <p className="text-[10px] font-black text-[#61708a] uppercase">{title}</p>
      <p className="text-[11px] text-[#22304b] leading-snug mt-1 line-clamp-5">
        {text}
      </p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e6ebf3] bg-[#fbfcff] p-2">
      <p className="text-[9px] font-black text-[#61708a] uppercase">{label}</p>
      <p className="text-[11px] font-bold text-[#22304b] leading-snug mt-0.5">
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="font-black text-[#61708a] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[#22304b] font-semibold text-right truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
