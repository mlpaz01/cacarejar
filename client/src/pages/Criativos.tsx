import { AppLayout } from "@/components/AppLayout";
import { useLocation } from "wouter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import {
  ImageIcon,
  Loader2,
  CheckCircle,
  XCircle,
  Link2,
  RotateCcw,
  Upload,
  X,
  Pencil,
  Sparkles,
  Send,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHANNELS = ["tiktok", "instagram", "google"] as const;

function getExt(file: File): "jpg" | "jpeg" | "png" | "webp" | "gif" {
  const map: Record<string, "jpg" | "jpeg" | "png" | "webp" | "gif"> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[file.type] ?? "jpg";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Criativos() {
  const utils = trpc.useUtils();
  const { data: creatives, isLoading } = trpc.creatives.list.useQuery({
    campaignId: undefined,
  });
  const { data: campaigns } = trpc.campaigns.list.useQuery();

  const uploadMutation = trpc.creatives.upload.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setBriefing("");
      setPreview(null);
      setFile(null);
      setSelectedChannels([]);
      setSelectedCampaignId(undefined);
      toast.success("Criativo adicionado com sucesso!");
    },
    onError: e => toast.error(`Erro: ${e.message}`),
  });

  const updateStatusMutation = trpc.creatives.updateStatus.useMutation({
    onSuccess: () => utils.creatives.list.invalidate(),
  });

  const deleteCreative = trpc.studio.deleteCreative.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      toast.success("Criativo excluído");
    },
    onError: e => toast.error(e.message || "Erro ao excluir"),
  });
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    preview: string;
  } | null>(null);

  const linkMutation = trpc.creatives.linkToCampaign.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setLinkOpen(false);
      toast.success("Criativo vinculado à campanha!");
    },
  });

  const [briefing, setBriefing] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    number | undefined
  >();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCreativeId, setLinkCreativeId] = useState<number | null>(null);
  const [linkCampaignId, setLinkCampaignId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Editor de criativo ──
  const [editId, setEditId] = useState<number | null>(null);
  const [editCopy, setEditCopy] = useState("");
  const editQuery = trpc.studio.getCreative.useQuery(
    { id: editId! },
    { enabled: editId != null }
  );
  const editC = editQuery.data as any;
  const editMeta = (editC?.generationMeta ?? {}) as any;

  useEffect(() => {
    if (editC) setEditCopy(editC.copy ?? "");
  }, [editC?.id]);

  // deep-link vindo do Diagnóstico: /criativos?edit=<id> → redireciona pra nova tela
  const [, navigate] = useLocation();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (id) navigate(`/criativos/${id}`);
  }, []);

  const saveCopy = trpc.studio.updateCreative.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      editQuery.refetch();
      toast.success("Alterações salvas!");
    },
    onError: e => toast.error(e.message || "Erro ao salvar"),
  });
  const regen = trpc.studio.regenerateImage.useMutation({
    onSuccess: () => {
      editQuery.refetch();
      utils.creatives.list.invalidate();
      toast.success("Nova imagem gerada!");
    },
    onError: e => toast.error(e.message || "Erro ao regerar"),
  });
  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => {
      setEditId(null);
      toast.success("Enviado para aprovação!");
    },
    onError: e => toast.error(e.message || "Erro ao enviar"),
  });

  function toggleChannel(ch: string) {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (jpg, png, webp)");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Selecione uma imagem primeiro.");
      return;
    }
    if (!briefing.trim() || briefing.length < 3) {
      toast.error("Adicione uma descrição com pelo menos 3 caracteres.");
      return;
    }
    const imageData = await fileToBase64(file);
    const ext = getExt(file);
    uploadMutation.mutate({
      briefing,
      imageData,
      ext,
      campaignId: selectedCampaignId,
      channels: selectedChannels.length > 0 ? selectedChannels : undefined,
    });
  }

  function openLink(creativeId: number) {
    setLinkCreativeId(creativeId);
    setLinkOpen(true);
  }

  return (
    <AppLayout
      title="Biblioteca do Estudio"
      subtitle="Conteudos criados, edicao visual e envio somente do que ficou pronto para aprovacao."
      journeyActive="estudio"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/estudio")}
            className="text-sm font-black text-white px-4 py-2.5 rounded-lg flex items-center gap-2"
            style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
          >
            <Sparkles className="w-4 h-4" /> Criar no Estudio
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-1">
          <div className="card-premium p-6 sticky top-24">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-primary/10">
                <Upload className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Adicionar referencia
                </h2>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WebP
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* File drop area */}
              <div
                className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                  preview
                    ? "border-primary/40"
                    : "border-border hover:border-primary/40"
                }`}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {preview ? (
                  <div className="relative">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                      onClick={e => {
                        e.stopPropagation();
                        setPreview(null);
                        setFile(null);
                        if (inputRef.current) inputRef.current.value = "";
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">
                      Clique para selecionar
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      JPG, PNG ou WebP
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Descrição *
                </Label>
                <Textarea
                  placeholder="Descreva brevemente este criativo..."
                  value={briefing}
                  onChange={e => setBriefing(e.target.value)}
                  className="bg-background border-border resize-none h-20 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Canais de destino
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHANNELS.map(ch => (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
                        selectedChannels.includes(ch)
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80"
                      }`}
                    >
                      <Checkbox
                        checked={selectedChannels.includes(ch)}
                        onCheckedChange={() => toggleChannel(ch)}
                      />
                      <ChannelBadge channel={ch} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Vincular à campanha (opcional)
                </Label>
                <select
                  value={selectedCampaignId ?? ""}
                  onChange={e =>
                    setSelectedCampaignId(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Sem campanha</option>
                  {(campaigns ?? []).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleUpload}
                disabled={uploadMutation.isPending || !file}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Adicionar referencia
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Creatives grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Conteudos do Estudio
              {creatives && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({creatives.length})
                </span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="aspect-square bg-card animate-pulse rounded-xl border border-border"
                />
              ))}
            </div>
          ) : !creatives || creatives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-medium text-muted-foreground">
                Nenhum conteudo no Estudio
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Crie com os Agentes ou adicione uma referencia manual.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {creatives.map(creative => (
                <div
                  key={creative.id}
                  className="card-premium overflow-hidden group"
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {creative.imageUrl ? (
                      <img
                        src={creative.imageUrl}
                        alt="Criativo"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <StatusBadge status={creative.status} />
                    </div>
                  </div>

                  <div className="p-3">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {creative.briefing}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      {(creative.channels as string[] | null)?.map(ch => (
                        <ChannelBadge key={ch} channel={ch} showLabel={false} />
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-1.5 mb-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => navigate(`/criativos/${creative.id}`)}
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setConfirmDelete({
                            id: creative.id,
                            preview: creative.briefing ?? "este criativo",
                          })
                        }
                        title="Excluir criativo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {creative.status === "aprovado" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs h-7"
                            onClick={() => openLink(creative.id)}
                          >
                            <Link2 className="w-3 h-3" /> Vincular
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-destructive hover:text-destructive"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: creative.id,
                                status: "rejeitado",
                              })
                            }
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {creative.status === "rejeitado" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 text-xs h-7"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: creative.id,
                              status: "aprovado",
                            })
                          }
                        >
                          <RotateCcw className="w-3 h-3" /> Restaurar
                        </Button>
                      )}
                      {creative.status === "em_uso" && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Em uso ({creative.usageCount}x)
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-2">
                      {format(
                        new Date(creative.createdAt),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor de criativo */}
      <Dialog open={editId != null} onOpenChange={o => !o && setEditId(null)}>
        <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Editar criativo
            </DialogTitle>
          </DialogHeader>
          {editQuery.isLoading || !editC ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-1">
              {/* Imagem + regerar */}
              <div>
                <div className="aspect-square rounded-xl overflow-hidden bg-muted border border-border relative">
                  {editC.imageUrl ? (
                    <img
                      src={editC.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  {regen.isPending && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 mt-2 text-xs"
                  disabled={regen.isPending}
                  onClick={() => regen.mutate({ id: editC.id })}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Regerar imagem (15
                  créditos)
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Mantém o estilo da marca e a direção de arte do post.
                </p>
              </div>

              {/* Briefing + copy editável */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {editMeta.pilar && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 rounded px-2 py-0.5">
                      {editMeta.pilar}
                    </span>
                  )}
                  {editMeta.formato && (
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-2 py-0.5 uppercase">
                      {editMeta.formato}
                    </span>
                  )}
                  {editMeta.angulo && (
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-2 py-0.5">
                      {editMeta.angulo}
                    </span>
                  )}
                </div>
                {editMeta.gancho && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-black">
                      Gancho (3s)
                    </Label>
                    <p className="text-sm font-bold text-foreground">
                      {editMeta.gancho}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black">
                    Legenda / Copy
                  </Label>
                  <Textarea
                    value={editCopy}
                    onChange={e => setEditCopy(e.target.value)}
                    className="bg-background border-border resize-none h-28 text-sm mt-1"
                  />
                </div>
                {Array.isArray(editMeta.hashtags) &&
                  editMeta.hashtags.length > 0 && (
                    <p className="text-[11px] text-primary font-semibold">
                      {editMeta.hashtags
                        .map((h: string) => (h.startsWith("#") ? h : "#" + h))
                        .join(" ")}
                    </p>
                  )}
                {editMeta.cta && (
                  <p className="text-xs">
                    <span className="font-black text-muted-foreground">
                      CTA:
                    </span>{" "}
                    {editMeta.cta}
                  </p>
                )}
                {editMeta.roteiro && (
                  <div className="rounded-lg border border-border p-2.5 bg-background">
                    <Label className="text-[10px] text-muted-foreground uppercase font-black">
                      Roteiro de vídeo
                    </Label>
                    <p className="text-[11px] font-bold text-foreground mt-1">
                      🎬 {editMeta.roteiro.gancho3s}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {(editMeta.roteiro.cenas ?? []).map(
                        (c: any, i: number) => (
                          <div
                            key={i}
                            className="text-[11px] text-muted-foreground flex gap-2"
                          >
                            <span className="font-black text-foreground whitespace-nowrap">
                              {c.tempo}
                            </span>
                            <span>
                              {c.acao}{" "}
                              <span className="opacity-60">· {c.audio}</span>
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    {editMeta.roteiro.cta && (
                      <p className="text-[11px] mt-1">
                        <span className="font-black">CTA:</span>{" "}
                        {editMeta.roteiro.cta}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 gap-2 text-xs"
                    disabled={saveCopy.isPending}
                    onClick={() =>
                      saveCopy.mutate({ id: editC.id, copy: editCopy })
                    }
                  >
                    {saveCopy.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}{" "}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-xs"
                    disabled={sendApproval.isPending}
                    onClick={() =>
                      sendApproval.mutate({ creativeIds: [editC.id] })
                    }
                  >
                    <Send className="w-3.5 h-3.5" /> Enviar p/ aprovação
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog
        open={confirmDelete != null}
        onOpenChange={o => !o && setConfirmDelete(null)}
      >
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Excluir
              criativo
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir{" "}
            <span className="font-bold text-foreground">
              {confirmDelete?.preview}
            </span>
            ? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCreative.isPending}
              onClick={() => {
                if (!confirmDelete) return;
                deleteCreative.mutate(
                  { id: confirmDelete.id },
                  { onSuccess: () => setConfirmDelete(null) }
                );
              }}
            >
              {deleteCreative.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Vincular a uma Campanha
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">
              Selecione a campanha
            </Label>
            <select
              value={linkCampaignId ?? ""}
              onChange={e => setLinkCampaignId(Number(e.target.value))}
              className="w-full h-9 px-3 mt-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {(campaigns ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (linkCreativeId && linkCampaignId) {
                  linkMutation.mutate({
                    id: linkCreativeId,
                    campaignId: linkCampaignId,
                  });
                }
              }}
              disabled={!linkCampaignId || linkMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
