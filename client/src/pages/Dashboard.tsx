import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Eye,
  Megaphone,
  MousePointerClick,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  TrendingUp,
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
  return String(n || 0);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n || 0));
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
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const { data: integrations } = trpc.integrations.list.useQuery();
  const { data: allMetrics } = trpc.metrics.all.useQuery({
    from: subDays(new Date(), 30).toISOString(),
    to: new Date().toISOString(),
  });

  const activeCampaigns = campaigns?.filter((c) => c.status === "ativa") ?? [];
  const pendingCalibrations = calibrations?.filter((c) => c.status === "pendente") ?? [];
  const connectedChannels = integrations?.filter((i) => i.status === "conectado").length ?? 0;
  const planItems = ((diagnosis as any)?.plano7Dias ?? []) as any[];
  const doneItems = planItems.filter((item) => ["publicado", "medir"].includes(item.status) || item.resultado).length;
  const approvedItems = planItems.filter((item) => item.status === "aprovado").length;
  const nextItem = planItems.find((item) => !["publicado", "medir"].includes(item.status) && !item.resultado) ?? planItems[0];
  const planProgress = planItems.length ? Math.round((doneItems / planItems.length) * 100) : 0;

  const chartData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i);
      return {
        date: format(date, "dd/MM", { locale: ptBR }),
        Impressoes: 0,
        Cliques: 0,
        Conversoes: 0,
      };
    });

    for (const m of allMetrics ?? []) {
      const key = format(new Date(m.date), "dd/MM", { locale: ptBR });
      const day = days.find((d) => d.date === key);
      if (day) {
        day.Impressoes += m.impressions ?? 0;
        day.Cliques += m.clicks ?? 0;
        day.Conversoes += m.conversions ?? 0;
      }
    }
    return days;
  }, [allMetrics]);

  const setupSteps = [
    {
      label: "Diagnostico ativo",
      done: !!diagnosis,
      text: diagnosis ? "Perfil estrategico carregado." : "Crie ou restaure um perfil para guiar todas as abas.",
      href: "/diagnostico",
    },
    {
      label: "Plano de 7 dias",
      done: planItems.length > 0,
      text: planItems.length ? `${planItems.length} ideias prontas para executar.` : "Gere um plano semanal antes de criar campanha.",
      href: "/diagnostico",
    },
    {
      label: "Posts revisados",
      done: approvedItems > 0 || doneItems > 0,
      text: approvedItems || doneItems ? `${approvedItems + doneItems} post(s) ja passaram de fase.` : "Edite no Estudio e aprove os primeiros posts.",
      href: "/aprovacao",
    },
    {
      label: "Publicacao assistida",
      done: activeCampaigns.length > 0 || connectedChannels > 0,
      text: connectedChannels ? `${connectedChannels} canal(is) com credencial.` : "Use Integracoes para copiar a rotina e publicar manualmente.",
      href: "/integracoes",
    },
    {
      label: "Medicao",
      done: doneItems > 0 || (summary?.totalClicks ?? 0) > 0,
      text: doneItems ? `${doneItems} item(ns) medidos/publicados.` : "Registre resultados para os Agentes recalcularem a rota.",
      href: "/recalibracao",
    },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Central de acao para diagnosticar, criar, aprovar, publicar e medir."
      actions={
        <Link href="/diagnostico">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo diagnostico
          </Button>
        </Link>
      }
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">Primeiro uso</p>
          <h2 className="text-2xl font-black mt-2">Do diagnostico ao aprendizado real</h2>
          <p className="text-sm text-white/78 leading-relaxed mt-3 max-w-3xl">
            O Cacarejar funciona melhor em ciclo semanal: diagnostico, plano, Estudio, aprovacao, publicacao assistida e check-in.
            Complete os passos abaixo para sentir a plataforma trabalhando de ponta a ponta.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href="/diagnostico">
              <a className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Abrir diagnostico
              </a>
            </Link>
            <Link href="/integracoes">
              <a className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <ClipboardCheck className="w-3.5 h-3.5" /> Rotina assistida
              </a>
            </Link>
            <Link href="/calendario">
              <a className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Calendario
              </a>
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#ff3217] uppercase">Checklist operacional</p>
              <h3 className="text-xl font-black text-[#071b44] mt-1">{setupDone}/{setupSteps.length} concluido(s)</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-[#071b44] text-white grid place-items-center text-lg font-black">{Math.round((setupDone / setupSteps.length) * 100)}%</div>
          </div>
          <div className="space-y-2 mt-5">
            {setupSteps.map((step) => (
              <Link key={step.label} href={step.href}>
                <a className="flex items-start gap-3 rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-3 hover:bg-white transition-colors">
                  <CheckCircle2 className={`w-5 h-5 mt-0.5 ${step.done ? "text-[#18b85c]" : "text-[#c7d1e0]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-[#071b44]">{step.label}</span>
                    <span className="block text-xs text-[#61708a] leading-snug mt-0.5">{step.text}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#9aa7ba] mt-1" />
                </a>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {pendingCalibrations.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-black text-amber-700">
              {pendingCalibrations.length} sugestao(s) de recalibracao pendente(s)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Os Agentes encontraram oportunidades de ajuste nas campanhas.
            </p>
          </div>
          <Link href="/recalibracao">
            <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/30 text-amber-700 hover:bg-amber-500/10">
              Ver ajustes <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <section className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">Jornada atual</p>
            <h2 className="text-xl font-black text-[#071b44] mt-1">
              {(diagnosis as any)?.produto || (diagnosis as any)?.nicho || "Motor semanal"}
            </h2>
            <p className="text-sm text-[#61708a] mt-1">
              {nextItem ? `${nextItem.dia} - ${nextItem.canal}: ${nextItem.gancho}` : "Nenhum plano ativo encontrado."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/diagnostico">
              <a className="rounded-xl bg-[#071b44] text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5" /> Abrir plano
              </a>
            </Link>
            <Link href="/calendario">
              <a className="rounded-xl border border-[#e6ebf3] text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2 hover:bg-[#f8fafc]">
                <CalendarDays className="w-3.5 h-3.5" /> Ver calendario
              </a>
            </Link>
            <Link href="/aprovacao">
              <a className="rounded-xl border border-[#e6ebf3] text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2 hover:bg-[#f8fafc]">
                <CheckSquare className="w-3.5 h-3.5" /> Revisar posts
              </a>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 mt-5">
          <div className="rounded-2xl bg-[#071b44] text-white p-4">
            <p className="text-[10px] font-black text-white/60 uppercase">Semana</p>
            <p className="text-4xl font-black mt-1">{planProgress}%</p>
            <div className="h-2 rounded-full bg-white/15 mt-3 overflow-hidden">
              <div className="h-full bg-[#18b85c]" style={{ width: `${planProgress}%` }} />
            </div>
            <p className="text-[11px] text-white/75 mt-3">{doneItems} de {planItems.length || 0} itens medidos/publicados</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <JourneyMetric label="Diagnostico" value={(diagnosis as any)?.produto ? "ativo" : "pendente"} />
            <JourneyMetric label="Plano" value={planItems.length ? `${planItems.length} itens` : "vazio"} />
            <JourneyMetric label="Campanhas" value={`${activeCampaigns.length} ativa(s)`} />
            <JourneyMetric label="Aprendizado" value={doneItems ? "com dados" : "sem dados"} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Impressoes totais" value={formatNumber(summary?.totalImpressions ?? 0)} icon={Eye} loading={loadingSummary} />
        <MetricCard label="Cliques totais" value={formatNumber(summary?.totalClicks ?? 0)} icon={MousePointerClick} loading={loadingSummary} />
        <MetricCard label="Conversoes" value={formatNumber(summary?.totalConversions ?? 0)} icon={ShoppingCart} loading={loadingSummary} />
        <MetricCard label="ROI medio" value={`${((summary?.avgRoi ?? 0) * 100).toFixed(1)}%`} icon={TrendingUp} iconColor="text-emerald-400" loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Performance - ultimos 14 dias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Impressoes, cliques e conversoes</p>
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
              <Area type="monotone" dataKey="Impressoes" stroke="oklch(0.62 0.22 280)" strokeWidth={2} fill="url(#gradImpr)" />
              <Area type="monotone" dataKey="Cliques" stroke="oklch(0.72 0.18 200)" strokeWidth={2} fill="url(#gradClicks)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card-premium p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Campanhas ativas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{activeCampaigns.length} em execucao</p>
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
              <Link href="/campanhas">
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
                        <p className="text-xs font-medium text-foreground leading-snug line-clamp-1 flex-1">{campaign.name}</p>
                        <StatusBadge status="ativa" />
                      </div>
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {channels.slice(0, 3).map((ch) => (
                          <ChannelBadge key={ch} channel={ch} showLabel={false} />
                        ))}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Orcamento</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <SmallStat icon={Megaphone} label="Campanhas ativas" value={String(summary?.activeCampaigns ?? 0)} />
        <SmallStat icon={TrendingUp} label="Receita total" value={formatCurrency(summary?.totalRevenue ?? 0)} />
        <SmallStat icon={BarChart3} label="Investimento" value={formatCurrency(summary?.totalSpend ?? 0)} />
        <SmallStat icon={RefreshCw} label="Recalibracoes" value={String(pendingCalibrations.length)} />
      </div>
    </AppLayout>
  );
}

function JourneyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function SmallStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="card-premium p-4 flex items-center gap-3">
      <div className="p-2.5 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
