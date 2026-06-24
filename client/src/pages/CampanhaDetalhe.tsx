import { AppLayout } from "@/components/AppLayout";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Copy,
  DollarSign,
  Eye,
  Loader2,
  MousePointerClick,
  Pause,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const brl = (n: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));
const number = (n: number) => new Intl.NumberFormat("pt-BR").format(Number(n || 0));

export default function CampanhaDetalhe() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const utils = trpc.useUtils();

  const campaigns = trpc.campaigns.list.useQuery();
  const creatives = trpc.creatives.list.useQuery({ campaignId: id }, { enabled: Number.isFinite(id) });
  const metrics = trpc.metrics.byCampaign.useQuery({ campaignId: id }, { enabled: Number.isFinite(id) });
  const logs = trpc.dispatch.logs.useQuery({ campaignId: id }, { enabled: Number.isFinite(id) });
  const calibration = trpc.calibration.byCampaign.useQuery({ campaignId: id }, { enabled: Number.isFinite(id) });

  const campaign = (campaigns.data ?? []).find((item: any) => item.id === id);
  const update = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success("Campanha atualizada.");
    },
    onError: e => toast.error(e.message || "Erro ao atualizar campanha"),
  });
  const analyze = trpc.calibration.analyze.useMutation({
    onSuccess: () => {
      utils.calibration.byCampaign.invalidate({ campaignId: id });
      toast.success("Analise de campanha criada.");
    },
    onError: e => toast.error(e.message || "Erro ao analisar campanha"),
  });

  const totals = (metrics.data ?? []).reduce((acc: any, row: any) => {
    acc.impressions += row.impressions ?? 0;
    acc.clicks += row.clicks ?? 0;
    acc.conversions += row.conversions ?? 0;
    acc.spend += Number(row.spend ?? 0);
    acc.revenue += Number(row.revenue ?? 0);
    return acc;
  }, { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 });
  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.conversions ? totals.spend / totals.conversions : 0;
  const roi = totals.spend ? ((totals.revenue - totals.spend) / totals.spend) * 100 : 0;
  const budgetTotal = Number(campaign?.budgetTotal ?? 0);
  const budgetSpent = Number(campaign?.budgetSpent ?? totals.spend ?? 0);
  const budgetProgress = budgetTotal ? Math.min(100, Math.round((budgetSpent / budgetTotal) * 100)) : 0;

  const packageText = campaign ? [
    `Campanha: ${campaign.name}`,
    `Status: ${campaign.status}`,
    `Objetivo: ${campaign.objective}`,
    `Publico: ${campaign.targetAudience || "nao informado"}`,
    `Canais: ${(campaign.channels as string[] ?? []).join(", ")}`,
    `Orcamento: ${brl(campaign.budgetTotal)} | gasto: ${brl(budgetSpent)}`,
    "",
    `Metricas: ${number(totals.impressions)} impressoes, ${number(totals.clicks)} cliques, ${number(totals.conversions)} conversoes, CTR ${ctr.toFixed(2)}%, CPL ${brl(cpl)}, ROI ${roi.toFixed(1)}%.`,
    "",
    "Criativos vinculados:",
    ...(creatives.data ?? []).map((creative: any) => `- #${creative.id}: ${(creative.copy || creative.briefing || "").slice(0, 150)}`),
  ].join("\n") : "";

  if (campaigns.isLoading) {
    return (
      <AppLayout title="Campanha" subtitle="Carregando campanha">
        <div className="rounded-2xl border border-[#e6ebf3] bg-white p-10 text-center text-sm font-black text-[#61708a]">Carregando...</div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout title="Campanha nao encontrada" subtitle="Volte para a lista e escolha uma campanha ativa.">
        <div className="rounded-2xl border border-[#e6ebf3] bg-white p-10 text-center shadow-sm">
          <p className="text-base font-black text-[#071b44]">Essa campanha nao existe neste perfil.</p>
          <Link href="/campanhas"><a className="btn-action-primary mt-5 inline-flex px-5 py-3 text-sm">Voltar para campanhas</a></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={campaign.name}
      subtitle="Controle de execucao, criativos, verba e aprendizado."
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/campanhas">
            <a className="btn-quiet"><ArrowLeft className="w-4 h-4" /> Campanhas</a>
          </Link>
          <button
            onClick={async () => {
              await navigator.clipboard?.writeText(packageText);
              toast.success("Resumo da campanha copiado.");
            }}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copiar resumo
          </button>
          {campaign.status === "ativa" ? (
            <button onClick={() => update.mutate({ id, status: "pausada" })} disabled={update.isPending} className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2 disabled:opacity-50">
              <Pause className="w-4 h-4" /> Pausar
            </button>
          ) : (
            <button onClick={() => update.mutate({ id, status: "ativa" })} disabled={update.isPending} className="btn-action-primary px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
              <Play className="w-4 h-4" /> Ativar
            </button>
          )}
        </div>
      }
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-black text-white/60 uppercase tracking-widest">Campanha em foco</p>
              <h2 className="text-2xl font-black mt-2">{campaign.objective}</h2>
            </div>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-white/78 leading-relaxed mt-4">{campaign.targetAudience || "Publico ainda nao detalhado. Use a campanha assistida do diagnostico para preencher melhor essa parte."}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {((campaign.channels as string[]) ?? []).map(channel => <ChannelBadge key={channel} channel={channel} />)}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black text-white/60 uppercase">Verba usada</p>
              <p className="text-xs font-black text-white">{budgetProgress}%</p>
            </div>
            <div className="h-3 rounded-full bg-white/15 mt-2 overflow-hidden">
              <div className="h-full bg-[#ff3217]" style={{ width: `${budgetProgress}%` }} />
            </div>
            <p className="text-sm font-black mt-3">{brl(budgetSpent)} de {brl(budgetTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric label="Impressoes" value={number(totals.impressions)} icon={Eye} />
          <Metric label="Cliques" value={number(totals.clicks)} icon={MousePointerClick} />
          <Metric label="Conversoes" value={number(totals.conversions)} icon={Target} />
          <Metric label="ROI" value={`${roi.toFixed(1)}%`} icon={BarChart3} />
          <Metric label="CTR" value={`${ctr.toFixed(2)}%`} icon={RefreshCcw} />
          <Metric label="CPL" value={brl(cpl)} icon={DollarSign} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 mb-6">
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-black text-[#071b44] flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#ff3217]" /> Criativos vinculados</h2>
              <p className="text-sm text-[#61708a] mt-1">Tudo que esta alimentando esta campanha.</p>
            </div>
            <Link href="/criativos">
              <a className="rounded-xl border border-[#e6ebf3] px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc]">Abrir Estudio</a>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {(creatives.data ?? []).length ? (creatives.data ?? []).map((creative: any) => (
              <article key={creative.id} className="rounded-2xl border border-[#e6ebf3] overflow-hidden bg-[#fbfcff]">
                {creative.imageUrl && <img src={creative.imageUrl} alt="" className="w-full aspect-[16/10] object-cover bg-[#f6f8fc]" />}
                <div className="p-4">
                  <p className="text-[10px] font-black text-[#ff3217] uppercase">#{creative.id} - {creative.status}</p>
                  <p className="text-sm font-bold text-[#22304b] leading-relaxed mt-2 line-clamp-5">{creative.copy || creative.briefing}</p>
                  <Link href={`/criativos/${creative.id}?returnTo=${encodeURIComponent(`/campanhas/${id}`)}&closeOnSave=1`}>
                    <a className="mt-3 w-full rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex justify-center">Editar no Estudio</a>
                  </Link>
                </div>
              </article>
            )) : (
              <div className="md:col-span-2 rounded-2xl border border-dashed border-[#d8e0ec] bg-[#fbfcff] p-8 text-center">
                <p className="text-sm font-black text-[#071b44]">Nenhum criativo vinculado.</p>
                <p className="text-xs text-[#61708a] mt-1">Vincule criativos no Estudio ou envie posts pela Aprovação.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-[#071b44] flex items-center gap-2"><RefreshCcw className="w-4 h-4 text-[#ff3217]" /> Aprendizado</h3>
            <p className="text-xs text-[#61708a] leading-relaxed mt-2">Gere uma leitura quando houver sinais suficientes para ajustar verba, criativo ou publico.</p>
            <button onClick={() => analyze.mutate({ campaignId: id })} disabled={analyze.isPending} className="mt-4 w-full btn-action-primary px-4 py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Analisar campanha
            </button>
          </div>
          <div className="rounded-3xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-[#071b44]">Ultimas leituras</h3>
            <div className="space-y-3 mt-4">
              {(calibration.data ?? []).slice(0, 3).map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-3">
                  <p className="text-[10px] font-black text-[#ff3217]">{item.status}</p>
                  <p className="text-xs font-bold text-[#22304b] leading-relaxed mt-1 line-clamp-4">{item.analysis}</p>
                </div>
              ))}
              {!(calibration.data ?? []).length && <p className="text-xs text-[#61708a]">Nenhuma leitura criada ainda.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-[#071b44] flex items-center gap-2"><Send className="w-4 h-4 text-[#ff3217]" /> Disparos</h3>
            <div className="space-y-2 mt-4">
              {(logs.data ?? []).slice(0, 5).map((log: any) => (
                <div key={log.id} className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-3">
                  <p className="text-xs font-black text-[#071b44]">{log.channel} - {log.status}</p>
                  <p className="text-[11px] text-[#61708a] mt-1">{log.scheduledAt ? format(new Date(log.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "sem data"}</p>
                </div>
              ))}
              {!(logs.data ?? []).length && <p className="text-xs text-[#61708a]">Sem disparos registrados.</p>}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-[#071b44] flex items-center gap-2"><Calendar className="w-5 h-5 text-[#ff3217]" /> Janela de campanha</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Small label="Inicio" value={campaign.startDate ? format(new Date(campaign.startDate), "dd/MM/yyyy", { locale: ptBR }) : "Nao definido"} />
          <Small label="Termino" value={campaign.endDate ? format(new Date(campaign.endDate), "dd/MM/yyyy", { locale: ptBR }) : "Nao definido"} />
          <Small label="Status de saude" value={totals.conversions ? "Com conversao registrada" : totals.clicks ? "Com clique, sem conversao" : "Aguardando volume"} />
        </div>
      </section>
    </AppLayout>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-white p-4 shadow-sm">
      <Icon className="w-4 h-4 text-[#ff3217] mb-2" />
      <p className="text-[10px] font-black uppercase tracking-wide text-[#61708a]">{label}</p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#61708a]">{label}</p>
      <p className="text-sm font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}
