import { AppLayout } from "@/components/AppLayout";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { subDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, TrendingUp, MousePointerClick, Eye, ShoppingCart, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";

const CHANNEL_COLORS: Record<string, string> = {
  linkedin: "oklch(0.62 0.22 240)",
  tiktok: "oklch(0.68 0.20 340)",
  instagram: "oklch(0.62 0.22 300)",
  google: "oklch(0.72 0.18 60)",
};

const PERIOD_OPTIONS = [
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

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
    <div className="glass rounded-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground">{typeof p.value === "number" ? formatNumber(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Metricas() {
  const [period, setPeriod] = useState(30);
  const [selectedCampaign, setSelectedCampaign] = useState<number | undefined>();

  const from = subDays(new Date(), period).toISOString();
  const to = new Date().toISOString();

  const { data: allMetrics, isLoading } = trpc.metrics.all.useQuery({ from, to });
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: campaignMetrics } = trpc.metrics.byCampaign.useQuery(
    { campaignId: selectedCampaign!, from, to },
    { enabled: !!selectedCampaign }
  );

  // Aggregate totals
  const totals = useMemo(() => {
    const data = allMetrics ?? [];
    return {
      impressions: data.reduce((s, m) => s + (m.impressions ?? 0), 0),
      clicks: data.reduce((s, m) => s + (m.clicks ?? 0), 0),
      conversions: data.reduce((s, m) => s + (m.conversions ?? 0), 0),
      spend: data.reduce((s, m) => s + parseFloat(String(m.spend ?? 0)), 0),
      revenue: data.reduce((s, m) => s + parseFloat(String(m.revenue ?? 0)), 0),
    };
  }, [allMetrics]);

  // Chart data by day
  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; Impressões: number; Cliques: number; Conversões: number }> = {};
    for (let i = period - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
      days[d] = { date: d, Impressões: 0, Cliques: 0, Conversões: 0 };
    }
    for (const m of allMetrics ?? []) {
      const d = format(new Date(m.date), "dd/MM", { locale: ptBR });
      if (days[d]) {
        days[d].Impressões += m.impressions ?? 0;
        days[d].Cliques += m.clicks ?? 0;
        days[d].Conversões += m.conversions ?? 0;
      }
    }
    return Object.values(days);
  }, [allMetrics, period]);

  // By channel
  const channelData = useMemo(() => {
    const map: Record<string, { channel: string; Impressões: number; Cliques: number; Conversões: number; Investimento: number }> = {};
    for (const m of allMetrics ?? []) {
      if (!map[m.channel]) {
        map[m.channel] = { channel: m.channel, Impressões: 0, Cliques: 0, Conversões: 0, Investimento: 0 };
      }
      map[m.channel].Impressões += m.impressions ?? 0;
      map[m.channel].Cliques += m.clicks ?? 0;
      map[m.channel].Conversões += m.conversions ?? 0;
      map[m.channel].Investimento += parseFloat(String(m.spend ?? 0));
    }
    return Object.values(map);
  }, [allMetrics]);

  // Pie data
  const pieData = channelData.map((d) => ({
    name: d.channel,
    value: d.Impressões,
  }));

  const roi = totals.spend > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  return (
    <AppLayout
      title="Métricas & Resultados"
      subtitle="Análise de performance por canal, campanha e período"
    >
      {/* Period selector */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5">
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <select
            value={selectedCampaign ?? ""}
            onChange={(e) => setSelectedCampaign(e.target.value ? Number(e.target.value) : undefined)}
            className="h-8 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todas as campanhas</option>
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Impressões" value={formatNumber(totals.impressions)} icon={Eye} loading={isLoading} />
        <MetricCard label="Cliques" value={formatNumber(totals.clicks)} icon={MousePointerClick} loading={isLoading} />
        <MetricCard label="Conversões" value={formatNumber(totals.conversions)} icon={ShoppingCart} loading={isLoading} />
        <MetricCard label="ROI" value={`${roi.toFixed(1)}%`} icon={TrendingUp} iconColor="text-emerald-400" loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Investimento" value={formatCurrency(totals.spend)} icon={DollarSign} loading={isLoading} />
        <MetricCard label="Receita" value={formatCurrency(totals.revenue)} icon={TrendingUp} iconColor="text-emerald-400" loading={isLoading} />
        <MetricCard label="CTR" value={`${ctr.toFixed(2)}%`} icon={MousePointerClick} loading={isLoading} />
        <MetricCard label="CPC Médio" value={totals.clicks > 0 ? formatCurrency(totals.spend / totals.clicks) : "R$ 0"} icon={BarChart3} loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Area chart */}
        <div className="lg:col-span-2 card-premium p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Evolução Diária</h3>
          <p className="text-xs text-muted-foreground mb-5">Impressões, cliques e conversões por dia</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.62 0.22 280)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.62 0.22 280)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.72 0.18 200)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.72 0.18 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 265)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.56 0.010 265)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.56 0.010 265)" }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Area type="monotone" dataKey="Impressões" stroke="oklch(0.62 0.22 280)" strokeWidth={2} fill="url(#g1)" />
              <Area type="monotone" dataKey="Cliques" stroke="oklch(0.72 0.18 200)" strokeWidth={2} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card-premium p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Impressões por Canal</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição percentual</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground/40">
              <BarChart3 className="w-10 h-10" />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHANNEL_COLORS[entry.name] ?? `hsl(${index * 90}, 60%, 60%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[d.name] }} />
                      <ChannelBadge channel={d.name} />
                    </div>
                    <span className="text-muted-foreground">{formatNumber(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bar chart by channel */}
      <div className="card-premium p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Performance por Canal</h3>
        <p className="text-xs text-muted-foreground mb-5">Comparativo de cliques, conversões e investimento</p>
        {channelData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma métrica registrada no período selecionado.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.010 265)" vertical={false} />
              <XAxis
                dataKey="channel"
                tick={{ fontSize: 11, fill: "oklch(0.56 0.010 265)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.56 0.010 265)" }} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="Cliques" fill="oklch(0.62 0.22 280)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Conversões" fill="oklch(0.68 0.20 150)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </AppLayout>
  );
}
