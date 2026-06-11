import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Plus,
  Search,
  Megaphone,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Eye,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
] as const;

const OBJECTIVES = [
  "Reconhecimento de marca",
  "Geração de leads",
  "Tráfego para o site",
  "Engajamento",
  "Conversões",
  "Vendas",
];

function formatCurrency(n: number | string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
}

export default function Campanhas() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      setOpen(false);
      resetForm();
      toast.success("Campanha criada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success("Campanha atualizada!");
    },
  });
  const archiveMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success("Campanha arquivada.");
    },
  });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  const [form, setForm] = useState({
    name: "",
    objective: "",
    targetAudience: "",
    budgetTotal: "",
    channels: [] as string[],
    startDate: "",
    endDate: "",
  });

  function resetForm() {
    setForm({ name: "", objective: "", targetAudience: "", budgetTotal: "", channels: [], startDate: "", endDate: "" });
  }

  function toggleChannel(ch: string) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch],
    }));
  }

  function handleSubmit() {
    if (!form.name || !form.objective || !form.budgetTotal || form.channels.length === 0) {
      toast.error("Preencha todos os campos obrigatórios e selecione ao menos um canal.");
      return;
    }
    createMutation.mutate({
      name: form.name,
      objective: form.objective,
      targetAudience: form.targetAudience,
      budgetTotal: form.budgetTotal,
      channels: form.channels as any,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    });
  }

  const filtered = (campaigns ?? []).filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusOptions = ["todos", "ativa", "pausada", "rascunho", "concluida", "arquivada"];

  return (
    <AppLayout
      title="Campanhas"
      subtitle="Gerencie todas as suas campanhas de marketing"
      actions={
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-card animate-pulse rounded-xl border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-medium text-muted-foreground">Nenhuma campanha encontrada</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search ? "Tente ajustar os filtros de busca." : "Crie sua primeira campanha para começar."}
          </p>
          {!search && (
            <Button className="mt-4 gap-2" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Criar campanha
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((campaign) => {
            const channels = campaign.channels as string[];
            const budgetTotal = parseFloat(String(campaign.budgetTotal));
            const budgetSpent = parseFloat(String(campaign.budgetSpent ?? 0));
            const progress = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
            return (
              <div
                key={campaign.id}
                className="card-premium p-5 flex items-center gap-5 hover:border-border/80 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Link href={`/campanhas/${campaign.id}`}>
                      <a className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                        {campaign.name}
                      </a>
                    </Link>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{campaign.objective}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {channels.map((ch) => (
                        <ChannelBadge key={ch} channel={ch} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(budgetSpent)} / {formatCurrency(budgetTotal)}
                    </div>
                    {campaign.startDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(campaign.startDate), "dd/MM/yyyy", { locale: ptBR })}
                        {campaign.endDate && ` → ${format(new Date(campaign.endDate), "dd/MM/yyyy", { locale: ptBR })}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Budget progress */}
                <div className="w-32 hidden lg:block">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>Orçamento</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link href={`/campanhas/${campaign.id}`}>
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {campaign.status !== "ativa" && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: campaign.id, status: "ativa" })}
                          className="gap-2"
                        >
                          <Play className="w-3.5 h-3.5" /> Ativar
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "ativa" && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: campaign.id, status: "pausada" })}
                          className="gap-2"
                        >
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => archiveMutation.mutate({ id: campaign.id, status: "arquivada" })}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Archive className="w-3.5 h-3.5" /> Arquivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Nova Campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome da campanha *</Label>
              <Input
                placeholder="Ex: Lançamento Produto Q3"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Objetivo *</Label>
              <select
                value={form.objective}
                onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecione um objetivo</option>
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Público-alvo</Label>
              <Textarea
                placeholder="Descreva o público-alvo da campanha..."
                value={form.targetAudience}
                onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                className="bg-background border-border resize-none h-20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Orçamento total (R$) *</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.budgetTotal}
                onChange={(e) => setForm((f) => ({ ...f, budgetTotal: e.target.value }))}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Canais *</Label>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map(({ id, label }) => (
                  <label
                    key={id}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                      form.channels.includes(id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <Checkbox
                      checked={form.channels.includes(id)}
                      onCheckedChange={() => toggleChannel(id)}
                    />
                    <ChannelBadge channel={id} />
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de início</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data de término</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
