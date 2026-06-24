import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  CheckCircle,
  Copy,
  Filter,
  ImageIcon,
  Library,
  Link2,
  Loader2,
  Search,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";

const STATUS_OPTIONS = [
  "todos",
  "aprovado",
  "em_uso",
  "rejeitado",
  "gerando",
] as const;

export default function Biblioteca() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: creatives, isLoading } = trpc.creatives.list.useQuery({
    campaignId: undefined,
  });
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterChannel, setFilterChannel] = useState<string>("todos");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCreativeId, setLinkCreativeId] = useState<number | null>(null);
  const [linkCampaignId, setLinkCampaignId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const linkMutation = trpc.creatives.linkToCampaign.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setLinkOpen(false);
      toast.success("Criativo reutilizado na campanha.");
    },
    onError: e => toast.error(e.message),
  });
  const duplicateCreative = trpc.studio.duplicateCreative.useMutation({
    onSuccess: (data: any) => {
      utils.creatives.list.invalidate();
      toast.success("Variacao criada a partir do aprendizado.");
      navigate(
        `/criativos/${data.id}?returnTo=${encodeURIComponent("/biblioteca")}&closeOnSave=1`
      );
    },
    onError: e => toast.error(e.message || "Erro ao criar variacao"),
  });

  const filtered = (creatives ?? []).filter(creative => {
    const text =
      `${creative.briefing ?? ""} ${creative.copy ?? ""}`.toLowerCase();
    const matchSearch = text.includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "todos" || creative.status === filterStatus;
    const channels = creative.channels as string[] | null;
    const matchChannel =
      filterChannel === "todos" || (channels?.includes(filterChannel) ?? false);
    return matchSearch && matchStatus && matchChannel;
  });

  const selectedCreative =
    selected !== null
      ? (creatives ?? []).find(creative => creative.id === selected)
      : null;
  const measuredItems = (
    ((diagnosis as any)?.plano7Dias ?? []) as any[]
  ).filter(item => item.resultado);
  const learningScore = (item: any) => {
    const r = item.resultado ?? {};
    return (
      Number(r.salvamentos ?? 0) * 2 +
      Number(r.cliques ?? 0) * 3 +
      Number(r.leads ?? 0) * 8 +
      Number(r.vendas ?? 0) * 18 +
      Number(r.receita ?? 0) / 10
    );
  };
  const bestLearnings = [...measuredItems]
    .sort((a, b) => learningScore(b) - learningScore(a))
    .slice(0, 4);
  const learningText = bestLearnings.length
    ? [
        `Aprendizados do perfil: ${(diagnosis as any)?.produto || (diagnosis as any)?.nicho || "perfil ativo"}`,
        "",
        ...bestLearnings.flatMap((item, index) => {
          const r = item.resultado ?? {};
          return [
            `${index + 1}. ${item.dia} - ${item.canal}`,
            `Gancho: ${item.gancho}`,
            `Resultado: ${r.salvamentos ?? 0} salvos, ${r.cliques ?? 0} cliques, ${r.leads ?? 0} leads, ${r.vendas ?? 0} vendas, receita R$ ${r.receita ?? 0}`,
            r.observacoes ? `Observacao: ${r.observacoes}` : "",
            "",
          ];
        }),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  async function copyLearnings() {
    if (!learningText) return;
    await navigator.clipboard?.writeText(learningText);
    toast.success("Aprendizados copiados.");
  }

  return (
    <AppLayout
      title="Biblioteca"
      subtitle="Criativos, vencedores e aprendizados reutilizaveis."
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">
            Memoria de crescimento
          </p>
          <h2 className="text-2xl font-black mt-2">
            O que ja funcionou neste perfil
          </h2>
          <p className="text-sm text-white/78 leading-relaxed mt-3 max-w-3xl">
            A biblioteca junta criativos salvos com aprendizados dos posts
            medidos. Use isso para repetir padroes bons sem copiar tudo igual.
          </p>
          <button
            onClick={copyLearnings}
            disabled={!bestLearnings.length}
            className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2 mt-5 disabled:opacity-50"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar aprendizados
          </button>
        </div>
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase">
            Top aprendizados
          </p>
          <div className="space-y-3 mt-4">
            {bestLearnings.length ? (
              bestLearnings.map((item, index) => (
                <div
                  key={`${item.dia}-${index}`}
                  className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-3"
                >
                  <p className="text-[10px] font-black text-[#61708a] uppercase flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-[#ff3217]" /> {index + 1}.{" "}
                    {item.dia} - {item.canal}
                  </p>
                  <p className="text-xs font-black text-[#071b44] leading-snug mt-1 line-clamp-2">
                    {item.gancho}
                  </p>
                  <p className="text-[11px] text-[#61708a] mt-1">
                    {item.resultado?.salvamentos ?? 0} salvos -{" "}
                    {item.resultado?.cliques ?? 0} cliques -{" "}
                    {item.resultado?.leads ?? 0} leads
                  </p>
                  {item.creativeId ? (
                    <button
                      type="button"
                      onClick={() =>
                        duplicateCreative.mutate({
                          id: Number(item.creativeId),
                        })
                      }
                      disabled={duplicateCreative.isPending}
                      className="mt-2 rounded-xl bg-white border border-[#e6ebf3] px-3 py-2 text-[10px] font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {duplicateCreative.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Criar variacao
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-[#61708a] leading-relaxed">
                Ainda nao ha posts medidos. Registre resultados no Diagnostico
                ou no Calendario para construir a memoria do perfil.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por briefing..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {STATUS_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {status === "todos"
                ? "Todos"
                : status.charAt(0).toUpperCase() +
                  status.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {["todos", "tiktok", "instagram", "google"].map(channel => (
            <button
              key={channel}
              onClick={() => setFilterChannel(channel)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterChannel === channel
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {channel === "todos"
                ? "Todos canais"
                : channel.charAt(0).toUpperCase() + channel.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total",
            count: (creatives ?? []).length,
            color: "text-foreground",
          },
          {
            label: "Aprovados",
            count: (creatives ?? []).filter(
              creative => creative.status === "aprovado"
            ).length,
            color: "text-emerald-400",
          },
          {
            label: "Em uso",
            count: (creatives ?? []).filter(
              creative => creative.status === "em_uso"
            ).length,
            color: "text-blue-400",
          },
          {
            label: "Rejeitados",
            count: (creatives ?? []).filter(
              creative => creative.status === "rejeitado"
            ).length,
            color: "text-red-400",
          },
        ].map(({ label, count, color }) => (
          <div key={label} className="card-premium p-4 text-center">
            <p className={`text-2xl font-semibold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div
              key={i}
              className="aspect-square bg-card animate-pulse rounded-xl border border-border"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Library className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-medium text-muted-foreground">
            Nenhum criativo encontrado
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search || filterStatus !== "todos" || filterChannel !== "todos"
              ? "Tente ajustar os filtros."
              : "Gere seu primeiro criativo na area de Criativos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(creative => {
            const channels = creative.channels as string[] | null;
            const isSelected = selected === creative.id;
            return (
              <div
                key={creative.id}
                className={`card-premium overflow-hidden cursor-pointer transition-all duration-200 ${
                  isSelected ? "ring-2 ring-primary" : "hover:border-border/80"
                }`}
                onClick={() => setSelected(isSelected ? null : creative.id)}
              >
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {creative.imageUrl ? (
                    <img
                      src={creative.imageUrl}
                      alt="Criativo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={creative.status} />
                  </div>
                  {creative.usageCount !== null && creative.usageCount > 0 && (
                    <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5" />
                      {creative.usageCount}x
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {creative.briefing}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mb-2">
                    {channels?.map(channel => (
                      <ChannelBadge
                        key={channel}
                        channel={channel}
                        showLabel={false}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    {format(new Date(creative.createdAt), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCreative && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {selectedCreative.imageUrl ? (
                <img
                  src={selectedCreative.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon className="w-5 h-5 m-2.5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-foreground line-clamp-1 max-w-[200px]">
                {selectedCreative.briefing}
              </p>
              <StatusBadge status={selectedCreative.status} className="mt-1" />
            </div>
            {selectedCreative.status === "aprovado" && (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 ml-2"
                onClick={() => {
                  setLinkCreativeId(selectedCreative.id);
                  setLinkOpen(true);
                }}
              >
                <Link2 className="w-3.5 h-3.5" />
                Reutilizar
              </Button>
            )}
            <button
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-xs ml-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Reutilizar criativo
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">
              Selecione a campanha de destino
            </Label>
            <select
              value={linkCampaignId ?? ""}
              onChange={e => setLinkCampaignId(Number(e.target.value) || null)}
              className="w-full h-9 px-3 mt-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {(campaigns ?? []).map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
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
                if (linkCreativeId && linkCampaignId)
                  linkMutation.mutate({
                    id: linkCreativeId,
                    campaignId: linkCampaignId,
                  });
              }}
              disabled={!linkCampaignId || linkMutation.isPending}
            >
              Vincular e reutilizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
