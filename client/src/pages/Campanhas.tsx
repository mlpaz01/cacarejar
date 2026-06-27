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
  ClipboardCheck,
  Copy,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Eye,
  ArrowRight,
  WandSparkles,
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(n));
}

function organicScore(item: any) {
  const r = item?.resultado ?? {};
  return (
    (Number(r.vendas) || 0) * 100 +
    (Number(r.leads) || 0) * 35 +
    (Number(r.cliques) || 0) * 4 +
    (Number(r.salvamentos) || 0) * 3 +
    (Number(r.comentarios) || 0) * 2 +
    (Number(r.alcance) || Number(r.visualizacoes) || 0) / 100
  );
}

export default function Campanhas() {
  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      setOpen(false);
      resetForm();
      toast.success("Campanha criada com sucesso!");
    },
    onError: e => toast.error(e.message),
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
    setForm({
      name: "",
      objective: "",
      targetAudience: "",
      budgetTotal: "",
      channels: [],
      startDate: "",
      endDate: "",
    });
  }

  const assistedCampaign = (diagnosis as any)?.campanhaAssistida;
  const measuredItems = (
    ((diagnosis as any)?.plano7Dias ?? []) as any[]
  ).filter(item => item?.resultado);
  const bestOrganic = [...measuredItems].sort(
    (a, b) => organicScore(b) - organicScore(a)
  )[0];
  const assistedCopy = assistedCampaign
    ? [
        `Campanha assistida: ${assistedCampaign.titulo}`,
        `Canal: ${assistedCampaign.canal}`,
        `Objetivo: ${assistedCampaign.objetivo}`,
        `Base: ${assistedCampaign.base}`,
        `Orcamento: ${assistedCampaign.orcamento}`,
        "",
        "Copy:",
        assistedCampaign.copy,
        "",
        "Checklist:",
        ...(assistedCampaign.checklist ?? []).map(
          (item: string) => `- ${item}`
        ),
        "",
        "KPIs:",
        ...(assistedCampaign.kpis ?? []).map((item: string) => `- ${item}`),
      ].join("\n")
    : "";

  function assistedChannels(canal?: string) {
    const value = String(canal || "").toLowerCase();
    if (value.includes("google")) return ["google"];
    if (value.includes("tiktok")) return ["tiktok"];
    return ["instagram"];
  }

  function useAssistedCampaign() {
    if (!assistedCampaign) return;
    setForm({
      name:
        assistedCampaign.titulo ||
        `Campanha assistida - ${(diagnosis as any)?.produto || "perfil ativo"}`,
      objective: assistedCampaign.objetivo || "Conversões",
      targetAudience: [
        `Base estrategica: ${assistedCampaign.base || "conteudo vencedor do plano"}`,
        assistedCampaign.copy ? `Mensagem: ${assistedCampaign.copy}` : "",
        ...(assistedCampaign.checklist ?? []).map(
          (item: string) => `Checklist: ${item}`
        ),
      ]
        .filter(Boolean)
        .join("\n"),
      budgetTotal: "150",
      channels: assistedChannels(assistedCampaign.canal),
      startDate: "",
      endDate: "",
    });
    setOpen(true);
  }

  async function copyAssistedCampaign() {
    if (!assistedCopy) return;
    await navigator.clipboard?.writeText(assistedCopy);
    toast.success("Campanha assistida copiada.");
  }

  function useWinnerCampaign() {
    if (!bestOrganic) return;
    const r = bestOrganic.resultado ?? {};
    setForm({
      name: `Teste pago - vencedor ${bestOrganic.dia || bestOrganic.canal || "organico"}`,
      objective:
        r.leads || r.vendas
          ? "Conversões"
          : r.cliques
            ? "Tráfego para o site"
            : "Engajamento",
      targetAudience: [
        `Post vencedor organico: ${bestOrganic.gancho}`,
        bestOrganic.legenda ? `Legenda base: ${bestOrganic.legenda}` : "",
        bestOrganic.cta ? `CTA: ${bestOrganic.cta}` : "",
        `Sinal registrado: ${r.alcance ?? r.visualizacoes ?? 0} alcance, ${r.cliques ?? 0} cliques, ${r.leads ?? 0} leads, ${r.vendas ?? 0} vendas.`,
        "Hipotese: colocar verba pequena em cima do que ja teve resposta real, sem perder o toque humano do criativo.",
      ]
        .filter(Boolean)
        .join("\n"),
      budgetTotal: "150",
      channels: assistedChannels(bestOrganic.canal),
      startDate: "",
      endDate: "",
    });
    setOpen(true);
  }

  function toggleChannel(ch: string) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }));
  }

  function handleSubmit() {
    if (
      !form.name ||
      !form.objective ||
      !form.budgetTotal ||
      form.channels.length === 0
    ) {
      toast.error(
        "Preencha todos os campos obrigatórios e selecione ao menos um canal."
      );
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

  const filtered = (campaigns ?? []).filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusOptions = [
    "todos",
    "ativa",
    "pausada",
    "rascunho",
    "concluida",
    "arquivada",
  ];
  const totals = (campaigns ?? []).reduce(
    (acc, campaign) => {
      const total = parseFloat(String(campaign.budgetTotal ?? 0));
      const spent = parseFloat(String(campaign.budgetSpent ?? 0));
      if (campaign.status === "ativa") acc.active += 1;
      acc.totalBudget += total;
      acc.spent += spent;
      return acc;
    },
    { active: 0, totalBudget: 0, spent: 0 }
  );
  const remaining = Math.max(0, totals.totalBudget - totals.spent);

  return (
    <AppLayout
      title="Campanhas"
      subtitle="Gerencie todas as suas campanhas de marketing"
      journeyActive="campanhas"
      actions={
        <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      }
    >
      {assistedCampaign && (
        <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide flex items-center gap-2">
                <WandSparkles className="w-4 h-4" /> Recomendacao do diagnostico
              </p>
              <h2 className="text-2xl font-black text-[#071b44] mt-1">
                {assistedCampaign.titulo}
              </h2>
              <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-2 max-w-4xl">
                {assistedCampaign.objetivo}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={copyAssistedCampaign}
                className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
              >
                <Copy className="w-4 h-4" /> Copiar pacote
              </button>
              <button
                onClick={useAssistedCampaign}
                className="btn-action-primary px-4 py-2 text-xs flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" /> Usar campanha
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
            <div className="rounded-2xl bg-[#fbfcff] border border-[#e6ebf3] p-4">
              <p className="text-[10px] font-black uppercase text-[#61708a]">
                Canal e base
              </p>
              <p className="text-sm font-black text-[#071b44] mt-2">
                {assistedCampaign.canal}
              </p>
              <p className="text-xs text-[#61708a] leading-relaxed mt-2">
                {assistedCampaign.base}
              </p>
            </div>
            <div className="rounded-2xl bg-[#fbfcff] border border-[#e6ebf3] p-4">
              <p className="text-[10px] font-black uppercase text-[#61708a]">
                Verba inicial
              </p>
              <p className="text-sm font-black text-[#071b44] mt-2">
                {assistedCampaign.orcamento}
              </p>
              <p className="text-xs text-[#61708a] leading-relaxed mt-2">
                Comece pequeno, meca o vencedor e so depois aumente
                investimento.
              </p>
            </div>
            <div className="rounded-2xl bg-[#fbfcff] border border-[#e6ebf3] p-4">
              <p className="text-[10px] font-black uppercase text-[#61708a]">
                Checklist de seguranca
              </p>
              {(assistedCampaign.checklist ?? [])
                .slice(0, 3)
                .map((item: string) => (
                  <p
                    key={item}
                    className="text-xs font-bold text-[#22304b] leading-snug mt-2"
                  >
                    - {item}
                  </p>
                ))}
            </div>
          </div>
        </section>
      )}

      {bestOrganic && (
        <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-black text-[#18b85c] uppercase tracking-wide">
                Campanha a partir de vencedor organico
              </p>
              <h2 className="text-2xl font-black text-[#071b44] mt-1">
                Escalar o que ja mostrou sinal real
              </h2>
              <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-2 max-w-4xl">
                {bestOrganic.gancho}
              </p>
            </div>
            <button
              onClick={useWinnerCampaign}
              className="btn-action-primary px-4 py-2 text-xs flex items-center gap-2"
            >
              <Megaphone className="w-4 h-4" /> Criar campanha do vencedor
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
            <ControlMetric label="Canal" value={bestOrganic.canal || "-"} />
            <ControlMetric
              label="Alcance"
              value={String(
                bestOrganic.resultado?.alcance ??
                  bestOrganic.resultado?.visualizacoes ??
                  0
              )}
            />
            <ControlMetric
              label="Cliques"
              value={String(bestOrganic.resultado?.cliques ?? 0)}
            />
            <ControlMetric
              label="Leads"
              value={String(bestOrganic.resultado?.leads ?? 0)}
            />
            <ControlMetric
              label="Vendas"
              value={String(bestOrganic.resultado?.vendas ?? 0)}
            />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">
            Sala de controle
          </p>
          <h2 className="text-2xl font-black mt-2">
            Campanhas conectadas ao plano
          </h2>
          <p className="text-sm text-white/75 mt-2 max-w-2xl">
            Acompanhe o que saiu da aprovação, quanto já consumiu e qual canal
            precisa de ajuste antes de escalar verba.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href="/aprovacao">
              <a className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                Revisar posts <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Link>
            <Link href="/metricas">
              <a className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                Ver métricas <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ControlMetric label="Ativas" value={String(totals.active)} />
          <ControlMetric
            label="Verba usada"
            value={formatCurrency(totals.spent)}
          />
          <ControlMetric
            label="Saldo do plano"
            value={formatCurrency(remaining)}
          />
          <ControlMetric
            label="Campanhas"
            value={String(campaigns?.length ?? 0)}
          />
        </div>
      </section>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanhas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {statusOptions.map(s => (
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
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-24 bg-card animate-pulse rounded-xl border border-border"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-base font-medium text-muted-foreground">
            Nenhuma campanha encontrada
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search
              ? "Tente ajustar os filtros de busca."
              : "Crie sua primeira campanha para começar."}
          </p>
          {!search && (
            <Button className="mt-4 gap-2" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Criar campanha
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(campaign => {
            const channels = campaign.channels as string[];
            const budgetTotal = parseFloat(String(campaign.budgetTotal));
            const budgetSpent = parseFloat(String(campaign.budgetSpent ?? 0));
            const progress =
              budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
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
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
                    {campaign.objective}
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {channels.map(ch => (
                        <ChannelBadge key={ch} channel={ch} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(budgetSpent)} /{" "}
                      {formatCurrency(budgetTotal)}
                    </div>
                    {campaign.startDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(campaign.startDate), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                        {campaign.endDate &&
                          ` → ${format(new Date(campaign.endDate), "dd/MM/yyyy", { locale: ptBR })}`}
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
                          onClick={() =>
                            updateMutation.mutate({
                              id: campaign.id,
                              status: "ativa",
                            })
                          }
                          className="gap-2"
                        >
                          <Play className="w-3.5 h-3.5" /> Ativar
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "ativa" && (
                        <DropdownMenuItem
                          onClick={() =>
                            updateMutation.mutate({
                              id: campaign.id,
                              status: "pausada",
                            })
                          }
                          className="gap-2"
                        >
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          archiveMutation.mutate({
                            id: campaign.id,
                            status: "arquivada",
                          })
                        }
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
            <DialogTitle className="text-base font-semibold">
              Nova Campanha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Nome da campanha *
              </Label>
              <Input
                placeholder="Ex: Lançamento Produto Q3"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Objetivo *
              </Label>
              <select
                value={form.objective}
                onChange={e =>
                  setForm(f => ({ ...f, objective: e.target.value }))
                }
                className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecione um objetivo</option>
                {OBJECTIVES.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Público-alvo
              </Label>
              <Textarea
                placeholder="Descreva o público-alvo da campanha..."
                value={form.targetAudience}
                onChange={e =>
                  setForm(f => ({ ...f, targetAudience: e.target.value }))
                }
                className="bg-background border-border resize-none h-20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Orçamento total (R$) *
              </Label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.budgetTotal}
                onChange={e =>
                  setForm(f => ({ ...f, budgetTotal: e.target.value }))
                }
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
                <Label className="text-xs text-muted-foreground">
                  Data de início
                </Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e =>
                    setForm(f => ({ ...f, startDate: e.target.value }))
                  }
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Data de término
                </Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e =>
                    setForm(f => ({ ...f, endDate: e.target.value }))
                  }
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function ControlMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#61708a]">
        {label}
      </p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}
