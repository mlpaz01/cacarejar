import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  Megaphone,
  Zap,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs space-y-1.5">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground">{p.name}: <strong>{typeof p.value === "number" ? formatNumber(p.value) : p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = trpc.metrics.dashboard.useQuery();
  const { data: campaigns, isLoading: loadingCampaigns } = trpc.campaigns.list.useQuery();
  const { data: calibrations } = trpc.calibration.list.useQuery();
  const { data: allMetrics } = trpc.metrics.all.useQuery({
    from: subDays(new Date(), 30).toISOString(),
    to: new Date().toISOString(),
  });

  const activeCampaigns = campaigns?.filter((c) => c.status === "ativa") ?? [];
  const pendingCalibrations = calibrations?.filter((c) => c.status === "pendente") ?? [];

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      return {
        date: format(date, "dd/MM", { locale: ptBR }),
        Impressões: 0,
        Cliques: 0,
        Conversões: 0,
      };
    });

    if (allMetrics) {
      for (const m of allMetrics) {
        const key = format(new Date(m.date), "dd/MM", { locale: ptBR });
        const day = days.find((d) => d.date === key);
        if (day) {
          day.Impressões += m.impressions ?? 0;
          day.Cliques += m.clicks ?? 0;
          day.Conversões += m.conversions ?? 0;
        }
      }
    }
    return days;
  }, [allMetrics]);

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Visão geral de todas as suas campanhas"
      actions={
        <Link href="/campanhas/nova">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </Link>
      }
    >
      {/* Alertas de recalibração */}
      {pendingCalibrations.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">
              {pendingCalibrations.length} sugestão{pendingCalibrations.length > 1 ? "ões" : ""} de recalibração pendente{pendingCalibrations.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O motor de IA identificou oportunidades de otimização nas suas campanhas.
            </p>
          </div>
          <Link href="/recalibracao">
            <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              Ver sugestões <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Impressões Totais"
          value={formatNumber(summary?.totalImpressions ?? 0)}
          icon={Eye}
          loading={loadingSummary}
        />
        <MetricCard
          label="Cliques Totais"
          value={formatNumber(summary?.totalClicks ?? 0)}
          icon={MousePointerClick}
          loading={loadingSummary}
        />
        <MetricCard
          label="Conversões"
          value={formatNumber(summary?.totalConversions ?? 0)}
          icon={ShoppingCart}
          loading={loadingSummary}
        />
        <MetricCard
          label="ROI Médio"
          value={`${((summary?.avgRoi ?? 0) * 100).toFixed(1)}%`}
          icon={TrendingUp}
          iconColor="text-emerald-400"
          loading={loadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de performance */}
        <div className="lg:col-span-2 card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance — Últimos 14 dias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Impressões, cliques e conversões</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradImpr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.62 0.22 280)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.62 0.22 280)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.18 200)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.18 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 265)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.56 0.010 265)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.56 0.010 265)" }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Impressões" stroke="oklch(0.62 0.22 280)" strokeWidth={2} fill="url(#gradImpr)" />
              <Area type="monotone" dataKey="Cliques" stroke="oklch(0.72 0.18 200)" strokeWidth={2} fill="url(#gradClicks)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Campanhas ativas */}
        <div className="card-premium p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Campanhas Ativas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{activeCampaigns.length} em execução</p>
            </div>
            <Link href="/campanhas">
              <a className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </a>
            </Link>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : activeCampaigns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Megaphone className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma campanha ativa</p>
              <Link href="/campanhas/nova">
                <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Criar campanha
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {activeCampaigns.slice(0, 6).map((campaign) => {
                const channels = campaign.channels as string[];
                const budgetTotal = parseFloat(String(campaign.budgetTotal));
                const budgetSpent = parseFloat(String(campaign.budgetSpent ?? 0));
                const progress = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
                return (
                  <Link key={campaign.id} href={`/campanhas/${campaign.id}`}>
                    <a className="block p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs font-medium text-foreground leading-snug line-clamp-1 flex-1">
                          {campaign.name}
                        </p>
                        <StatusBadge status="ativa" />
                      </div>
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {channels.slice(0, 3).map((ch) => (
                          <ChannelBadge key={ch} channel={ch} showLabel={false} />
                        ))}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Orçamento</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </a>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Megaphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Campanhas ativas</p>
            <p className="text-xl font-semibold text-foreground">{summary?.activeCampaigns ?? 0}</p>
          </div>
        </div>
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Receita total</p>
            <p className="text-xl font-semibold text-foreground">{formatCurrency(summary?.totalRevenue ?? 0)}</p>
          </div>
        </div>
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Investimento</p>
            <p className="text-xl font-semibold text-foreground">{formatCurrency(summary?.totalSpend ?? 0)}</p>
          </div>
        </div>
        <div className="card-premium p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recalibrações pendentes</p>
            <p className="text-xl font-semibold text-foreground">{pendingCalibrations.length}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
