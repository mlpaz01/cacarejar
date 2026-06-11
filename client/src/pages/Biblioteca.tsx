import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Library,
  Search,
  ImageIcon,
  Link2,
  CheckCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS = ["todos", "aprovado", "em_uso", "rejeitado", "gerando"] as const;

export default function Biblioteca() {
  const utils = trpc.useUtils();
  const { data: creatives, isLoading } = trpc.creatives.list.useQuery({ campaignId: undefined });
  const { data: campaigns } = trpc.campaigns.list.useQuery();

  const linkMutation = trpc.creatives.linkToCampaign.useMutation({
    onSuccess: () => {
      utils.creatives.list.invalidate();
      setLinkOpen(false);
      toast.success("Criativo reutilizado na campanha!");
    },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterChannel, setFilterChannel] = useState<string>("todos");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCreativeId, setLinkCreativeId] = useState<number | null>(null);
  const [linkCampaignId, setLinkCampaignId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const filtered = (creatives ?? []).filter((c) => {
    const matchSearch = c.briefing.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const channels = c.channels as string[] | null;
    const matchChannel = filterChannel === "todos" || (channels?.includes(filterChannel) ?? false);
    return matchSearch && matchStatus && matchChannel;
  });

  const selectedCreative = selected !== null ? (creatives ?? []).find((c) => c.id === selected) : null;

  return (
    <AppLayout
      title="Biblioteca de Criativos"
      subtitle="Histórico completo de todos os criativos gerados"
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por briefing..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {["todos", "linkedin", "tiktok", "instagram", "google"].map((ch) => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filterChannel === ch
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {ch === "todos" ? "Todos canais" : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", count: (creatives ?? []).length, color: "text-foreground" },
          { label: "Aprovados", count: (creatives ?? []).filter((c) => c.status === "aprovado").length, color: "text-emerald-400" },
          { label: "Em uso", count: (creatives ?? []).filter((c) => c.status === "em_uso").length, color: "text-blue-400" },
          { label: "Rejeitados", count: (creatives ?? []).filter((c) => c.status === "rejeitado").length, color: "text-red-400" },
        ].map(({ label, count, color }) => (
          <div key={label} className="card-premium p-4 text-center">
            <p className={`text-2xl font-semibold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square bg-card animate-pulse rounded-xl border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Library className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-medium text-muted-foreground">Nenhum criativo encontrado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search || filterStatus !== "todos" || filterChannel !== "todos"
              ? "Tente ajustar os filtros."
              : "Gere seu primeiro criativo na seção de Criativos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((creative) => {
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
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{creative.briefing}</p>
                  <div className="flex items-center gap-1 flex-wrap mb-2">
                    {channels?.map((ch) => (
                      <ChannelBadge key={ch} channel={ch} showLabel={false} />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    {format(new Date(creative.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selectedCreative && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {selectedCreative.imageUrl ? (
                <img src={selectedCreative.imageUrl} alt="" className="w-full h-full object-cover" />
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
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Reutilizar Criativo</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs text-muted-foreground">Selecione a campanha de destino</Label>
            <select
              value={linkCampaignId ?? ""}
              onChange={(e) => setLinkCampaignId(Number(e.target.value) || null)}
              className="w-full h-9 px-3 mt-1.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (linkCreativeId && linkCampaignId) {
                  linkMutation.mutate({ id: linkCreativeId, campaignId: linkCampaignId });
                }
              }}
              disabled={!linkCampaignId || linkMutation.isPending}
            >
              Vincular e Reutilizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
