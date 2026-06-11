import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Loader2,
  Megaphone,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";

type PlannerItem = { texto: string; status: "done" | "todo" | "late" };
type PlannerWeek = { semana: string; itens: PlannerItem[] };

const statusStyle: Record<PlannerItem["status"], string> = {
  done: "bg-[#eafff1] text-[#087a32] border-[#bfeccb]",
  todo: "bg-white text-[#61708a] border-[#e6ebf3]",
  late: "bg-[#fff1ef] text-[#c20f00] border-[#ffd0c8]",
};

export default function Recalibracao() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const diagnosis = trpc.diagnosis.get.useQuery();
  const campaigns = trpc.campaigns.list.useQuery();
  const metrics = trpc.metrics.all.useQuery({});
  const plan: any = diagnosis.data;

  const [planner, setPlanner] = useState<any>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (plan?.acompanhamento) setPlanner(plan.acompanhamento);
  }, [plan?.acompanhamento]);

  const updatePlanner = trpc.diagnosis.updateAcompanhamento.useMutation({
    onSuccess: data => {
      setPlanner((data as any)?.acompanhamento);
      utils.diagnosis.get.invalidate();
      toast.success("Acompanhamento salvo.");
    },
    onError: e => toast.error(e.message || "Erro ao salvar acompanhamento"),
  });

  const recalibrate = trpc.diagnosis.recalibrate.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      toast.success("Diagnostico recalculado com a evolucao.");
      navigate("/diagnostico");
    },
    onError: e => toast.error(e.message || "Erro ao recalcular diagnostico"),
  });

  const totals = useMemo(() => {
    const rows = metrics.data ?? [];
    const impressions = rows.reduce((s: number, m: any) => s + (m.impressions ?? 0), 0);
    const clicks = rows.reduce((s: number, m: any) => s + (m.clicks ?? 0), 0);
    const conversions = rows.reduce((s: number, m: any) => s + (m.conversions ?? 0), 0);
    const spend = rows.reduce((s: number, m: any) => s + Number(m.spend ?? 0), 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpl = conversions > 0 ? spend / conversions : 0;
    return { impressions, clicks, conversions, spend, ctr, cpl };
  }, [metrics.data]);

  const progress = planner?.progresso ?? 0;
  const contentDone = planner?.conteudos?.feitos ?? 0;
  const contentTotal = planner?.conteudos?.total ?? 0;

  const setItemStatus = (weekIndex: number, itemIndex: number, status: PlannerItem["status"]) => {
    setPlanner((prev: any) => {
      const source = prev ?? plan?.acompanhamento;
      if (!source) return prev;
      const semanas = (source.semanas ?? []).map((week: PlannerWeek, wi: number) => ({
        ...week,
        itens: (week.itens ?? []).map((item: PlannerItem, ii: number) => wi === weekIndex && ii === itemIndex ? { ...item, status } : item),
      }));
      const items = semanas.flatMap((week: PlannerWeek) => week.itens ?? []);
      const done = items.filter((item: PlannerItem) => item.status === "done").length;
      const total = items.length || 1;
      return { ...source, semanas, progresso: Math.round((done / total) * 100), conteudos: { total, feitos: done } };
    });
  };

  const savePlanner = async () => {
    if (!planner) return;
    await updatePlanner.mutateAsync({ acompanhamento: planner, feedback });
    setFeedback("");
  };

  const recalibrateWithProgress = async () => {
    if (!planner) return;
    await updatePlanner.mutateAsync({ acompanhamento: planner, feedback });
    await recalibrate.mutateAsync({ feedback: feedback || "Recalcular o parecer usando o acompanhamento, os itens executados e os resultados de campanha." });
  };

  if (diagnosis.isLoading) {
    return (
      <AppLayout title="Acompanhamento" subtitle="Carregando o plano de execucao">
        <div className="bg-white border border-[#e6ebf3] rounded-2xl p-10 text-center text-sm font-bold text-[#61708a]">Carregando...</div>
      </AppLayout>
    );
  }

  if (!plan) {
    return (
      <AppLayout title="Acompanhamento" subtitle="Primeiro gere um diagnostico para abrir o planner.">
        <div className="bg-white border border-[#e6ebf3] rounded-2xl p-10 text-center shadow-sm">
          <ClipboardCheck className="w-11 h-11 text-[#c7d1e0] mx-auto mb-3" />
          <p className="text-base font-black text-[#071b44]">Nenhum diagnostico ativo</p>
          <p className="text-sm text-[#61708a] mt-1">O acompanhamento nasce do parecer estrategico e do cronograma multicanal.</p>
          <button onClick={() => navigate("/diagnostico")} className="btn-action-primary mt-5 px-5 py-3 text-sm inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Criar diagnostico
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Acompanhamento"
      subtitle="Transforme o diagnostico em execucao, registre a evolucao e recalcule a rota."
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={() => navigate("/diagnostico")} className="btn-quiet">
            <FileText className="w-4 h-4" /> Ver diagnostico
          </button>
          <button onClick={savePlanner} disabled={!planner || updatePlanner.isPending} className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2 disabled:opacity-50">
            {updatePlanner.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salvar check-in
          </button>
          <button onClick={recalibrateWithProgress} disabled={!planner || updatePlanner.isPending || recalibrate.isPending} className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
            {recalibrate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Recalcular com evolucao
          </button>
        </div>
      }
    >
      <section className="grid grid-cols-1 xl:grid-cols-[.85fr_1.15fr] gap-5 mb-5">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">{planner?.ciclo || "Ciclo de execucao"}</p>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-white/70">Progresso do cronograma</p>
              <p className="text-5xl font-black mt-1">{progress}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white/70">Conteudos feitos</p>
              <p className="text-2xl font-black">{contentDone}/{contentTotal || "-"}</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-white/15 mt-5 overflow-hidden">
            <div className="h-full bg-[#ff3217]" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 mt-5">
            <p className="text-xs font-black text-white/60 uppercase">Proximo foco</p>
            <p className="text-base font-black mt-1">{planner?.proximoFoco || "Executar a primeira semana"}</p>
            <p className="text-sm text-white/72 mt-2">{planner?.novaPrescricao || "Registre o que foi feito para o Agente ajustar a proxima rota."}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#ff3217]" /> Sinais de resultado</h2>
              <p className="text-sm text-[#61708a] mt-1">Leitura inicial para comparar com a Semana 2 e as campanhas aprovadas.</p>
            </div>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">{campaigns.data?.length ?? 0} campanha(s)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Metric label="Impressoes" value={formatNumber(totals.impressions)} icon={Megaphone} />
            <Metric label="Cliques" value={formatNumber(totals.clicks)} icon={Target} />
            <Metric label="Conversoes" value={formatNumber(totals.conversions)} icon={TrendingUp} />
            <Metric label="CTR" value={`${totals.ctr.toFixed(2)}%`} icon={BarChart3} />
          </div>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="O que aconteceu desde o diagnostico? Ex.: publiquei 3 posts, o LinkedIn gerou comentarios bons, o Instagram nao respondeu, a campanha teve CPL alto..."
            className="input-clean min-h-[112px] resize-none mt-5"
          />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#ff3217]" /> Planner do diagnostico</h2>
            <p className="text-sm text-[#61708a] mt-1">Marque o que foi executado. Isso vira contexto para o Agente recalcular a prescricao.</p>
          </div>
          <div className="flex gap-2">
            <StatusPill label="Feito" status="done" />
            <StatusPill label="A fazer" status="todo" />
            <StatusPill label="Atrasado" status="late" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {(planner?.semanas ?? []).map((week: PlannerWeek, wi: number) => (
            <article key={`${week.semana}-${wi}`} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
              <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">{week.semana}</span>
              <div className="space-y-2 mt-4">
                {(week.itens ?? []).map((item, ii) => (
                  <div key={`${item.texto}-${ii}`} className={`rounded-xl border p-3 ${statusStyle[item.status ?? "todo"]}`}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setItemStatus(wi, ii, item.status === "done" ? "todo" : "done")}
                        className="mt-0.5"
                        title={item.status === "done" ? "Marcar como a fazer" : "Marcar como feito"}
                      >
                        {item.status === "done" ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                      <p className="text-sm font-bold leading-relaxed flex-1">{item.texto}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {(["done", "todo", "late"] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setItemStatus(wi, ii, status)}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${item.status === status ? statusStyle[status] : "bg-white text-[#61708a] border-[#e6ebf3]"}`}
                        >
                          {status === "done" ? "feito" : status === "late" ? "atrasado" : "a fazer"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm">
        <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#ff3217]" /> Snapshots de evolucao</h2>
        <p className="text-sm text-[#61708a] mt-1">Compare a foto inicial com o check-in para saber se a prescricao esta melhorando a execucao.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {(planner?.snapshots ?? []).map((snap: any) => (
            <div key={snap.label} className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5">
              <h3 className="text-base font-black text-[#071b44]">{snap.label}</h3>
              <p className="text-sm text-[#61708a] mt-2 line-clamp-5">{snap.resumo}</p>
              <div className="space-y-3 mt-4">
                {(snap.scores ?? []).map((score: any) => (
                  <Score key={score.nome} label={score.nome} value={score.valor} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <Icon className="w-4 h-4 text-[#ff3217] mb-2" />
      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: PlannerItem["status"] }) {
  return <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusStyle[status]}`}>{label}</span>;
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-[#61708a]">{label}</span>
        <span className="text-[#071b44]">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-[#edf1f7] mt-1 overflow-hidden">
        <div className="h-full bg-[#ff3217]" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}
