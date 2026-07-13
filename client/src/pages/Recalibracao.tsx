import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Copy,
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
import { JourneyNextAction } from "@/components/JourneyNextAction";
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
  const duplicateCreative = trpc.studio.duplicateCreative.useMutation({
    onSuccess: (data: any) => {
      toast.success("Variacao criada a partir do melhor sinal.");
      navigate(
        `/criativos/${data.id}?returnTo=${encodeURIComponent("/recalibracao")}&closeOnSave=1`
      );
    },
    onError: e => toast.error(e.message || "Erro ao criar variacao"),
  });

  const totals = useMemo(() => {
    const rows = metrics.data ?? [];
    const impressions = rows.reduce(
      (s: number, m: any) => s + (m.impressions ?? 0),
      0
    );
    const clicks = rows.reduce((s: number, m: any) => s + (m.clicks ?? 0), 0);
    const conversions = rows.reduce(
      (s: number, m: any) => s + (m.conversions ?? 0),
      0
    );
    const spend = rows.reduce(
      (s: number, m: any) => s + Number(m.spend ?? 0),
      0
    );
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpl = conversions > 0 ? spend / conversions : 0;
    return { impressions, clicks, conversions, spend, ctr, cpl };
  }, [metrics.data]);

  const progress = planner?.progresso ?? 0;
  const contentDone = planner?.conteudos?.feitos ?? 0;
  const contentTotal = planner?.conteudos?.total ?? 0;
  const planItems = (plan?.plano7Dias ?? []) as any[];
  const measuredItems = planItems.filter((item: any) => item?.resultado);
  const executedItems = planItems.filter(
    (item: any) =>
      ["publicado", "medir"].includes(item?.status) || item?.resultado
  );
  const organicTotals = measuredItems.reduce(
    (acc: any, item: any) => {
      const r = item.resultado ?? {};
      acc.salvamentos += Number(r.salvamentos ?? 0);
      acc.cliques += Number(r.cliques ?? 0);
      acc.leads += Number(r.leads ?? 0);
      acc.vendas += Number(r.vendas ?? 0);
      acc.receita += Number(r.receita ?? 0);
      return acc;
    },
    { salvamentos: 0, cliques: 0, leads: 0, vendas: 0, receita: 0 }
  );
  const bestPlanItem = [...measuredItems].sort(
    (a: any, b: any) => organicScore(b) - organicScore(a)
  )[0];
  const organicDecisions = buildOrganicDecisions(measuredItems, bestPlanItem);
  const checkinText = [
    `Check-in do perfil: ${plan?.profile?.handle || plan?.produto || plan?.nicho || "perfil ativo"}`,
    `Plano executado: ${executedItems.length}/${planItems.length || 7} itens publicados ou medidos.`,
    `Sinais organicos: ${organicTotals.salvamentos} salvamentos, ${organicTotals.cliques} cliques, ${organicTotals.leads} leads, ${organicTotals.vendas} vendas, receita estimada ${formatCurrency(organicTotals.receita)}.`,
    bestPlanItem
      ? `Melhor sinal: Dia ${bestPlanItem.dia} - ${bestPlanItem.canal} (${bestPlanItem.gancho || bestPlanItem.ideia}).`
      : "Melhor sinal: ainda sem item medido.",
    totals.conversions
      ? `Campanhas: ${totals.conversions} conversoes com CPL aproximado de ${formatCurrency(totals.cpl)}.`
      : "Campanhas: ainda sem conversoes registradas.",
    "Decisao sugerida: manter o que gerou salvamento/comentario, transformar vencedor em nova pauta e evitar escalar verba antes de medir.",
  ].join("\n");
  const nextWeekText = [
    `Plano da proxima semana - ${plan?.profile?.handle || plan?.produto || plan?.nicho || "perfil ativo"}`,
    bestPlanItem
      ? `Base vencedora: Dia ${bestPlanItem.dia} - ${bestPlanItem.canal}: ${bestPlanItem.gancho || bestPlanItem.ideia}`
      : "Base vencedora: ainda nao definida, medir pelo menos um post antes de escalar.",
    `Repetir: ${organicDecisions.repetir}`,
    `Ajustar: ${organicDecisions.ajustar}`,
    `Evitar agora: ${organicDecisions.evitar}`,
    totals.conversions
      ? `Campanha: proteger o que converteu e comparar CPL antes de aumentar verba. CPL atual ${formatCurrency(totals.cpl)}.`
      : "Campanha: criar teste pequeno somente depois de sinal organico medido.",
    "Proxima rotina: Diagnostico atualizado -> Radar validado -> Estudio -> Aprovacao -> Publicacao -> Metricas -> Aprendizado.",
  ].join("\n");

  const fillCheckin = () => {
    setFeedback(checkinText);
    toast.success("Resumo aplicado ao check-in.");
  };

  const copyCheckin = async () => {
    await navigator.clipboard?.writeText(checkinText);
    toast.success("Resumo copiado.");
  };

  const copyNextWeek = async () => {
    await navigator.clipboard?.writeText(nextWeekText);
    toast.success("Plano da proxima semana copiado.");
  };

  const setItemStatus = (
    weekIndex: number,
    itemIndex: number,
    status: PlannerItem["status"]
  ) => {
    setPlanner((prev: any) => {
      const source = prev ?? plan?.acompanhamento;
      if (!source) return prev;
      const semanas = (source.semanas ?? []).map(
        (week: PlannerWeek, wi: number) => ({
          ...week,
          itens: (week.itens ?? []).map((item: PlannerItem, ii: number) =>
            wi === weekIndex && ii === itemIndex ? { ...item, status } : item
          ),
        })
      );
      const items = semanas.flatMap((week: PlannerWeek) => week.itens ?? []);
      const done = items.filter(
        (item: PlannerItem) => item.status === "done"
      ).length;
      const total = items.length || 1;
      return {
        ...source,
        semanas,
        progresso: Math.round((done / total) * 100),
        conteudos: { total, feitos: done },
      };
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
    await recalibrate.mutateAsync({
      feedback:
        feedback ||
        "Recalcular o parecer usando o acompanhamento, os itens executados e os resultados de campanha.",
    });
  };
  const hasLearningSignals =
    measuredItems.length > 0 || totals.impressions > 0 || totals.conversions > 0;
  const learningNextAction = !hasLearningSignals
    ? {
        title: "Proxima acao: medir antes de aprender",
        text: "Ainda falta resultado real para fechar o ciclo. Registre os numeros da publicacao e volte para recalibrar com dados.",
        label: "Abrir Publicacao",
        onClick: () => navigate("/integracoes"),
        disabled: false,
      }
    : feedback.trim().length === 0
      ? {
          title: "Proxima acao: preencher o check-in",
          text: "Use o resumo dos resultados como base. Depois salve ou recalcule a rota da proxima semana.",
          label: "Usar resumo",
          onClick: fillCheckin,
          disabled: false,
        }
      : {
          title: "Proxima acao: recalcular a proxima rota",
          text: "Com resultado e contexto humano registrados, os Agentes podem atualizar o diagnostico para o proximo ciclo.",
          label: recalibrate.isPending ? "Recalculando..." : "Recalcular rota",
          onClick: recalibrateWithProgress,
          disabled: !planner || updatePlanner.isPending || recalibrate.isPending,
        };

  if (diagnosis.isLoading) {
    return (
      <AppLayout
        title="Acompanhamento"
        subtitle="Carregando o plano de execucao"
      >
        <div className="bg-white border border-[#e6ebf3] rounded-2xl p-10 text-center text-sm font-bold text-[#61708a]">
          Carregando...
        </div>
      </AppLayout>
    );
  }

  if (!plan) {
    return (
      <AppLayout
        title="Acompanhamento"
        subtitle="Primeiro gere um diagnostico para abrir o planner."
      >
        <div className="bg-white border border-[#e6ebf3] rounded-2xl p-10 text-center shadow-sm">
          <ClipboardCheck className="w-11 h-11 text-[#c7d1e0] mx-auto mb-3" />
          <p className="text-base font-black text-[#071b44]">
            Nenhum diagnostico ativo
          </p>
          <p className="text-sm text-[#61708a] mt-1">
            O acompanhamento nasce do parecer estrategico e do cronograma
            multicanal.
          </p>
          <button
            onClick={() => navigate("/diagnostico")}
            className="btn-action-primary mt-5 px-5 py-3 text-sm inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Criar diagnostico
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Acompanhamento"
      subtitle="Feche o ciclo semanal: resultados entram, aprendizado sai, proxima rota melhora."
      journeyActive="acompanhamento"
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => navigate("/diagnostico")}
            className="btn-quiet"
          >
            <FileText className="w-4 h-4" /> Ver estrategia
          </button>
          <button
            onClick={savePlanner}
            disabled={!planner || updatePlanner.isPending}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2 disabled:opacity-50"
          >
            {updatePlanner.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}{" "}
            Salvar check-in
          </button>
          <button
            onClick={recalibrateWithProgress}
            disabled={
              !planner || updatePlanner.isPending || recalibrate.isPending
            }
            className="btn-action-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {recalibrate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}{" "}
            Recalcular com evolucao
          </button>
        </div>
      }
    >
      <JourneyNextAction
        title={learningNextAction.title}
        text={learningNextAction.text}
        label={learningNextAction.label}
        onClick={learningNextAction.onClick}
        disabled={learningNextAction.disabled}
      />

      <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#ff3217]" /> Check-in da
              semana
            </h2>
            <p className="text-sm text-[#61708a] mt-1">
              Resumo do ciclo para transformar execucao em aprendizado e
              alimentar a nova rota.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={fillCheckin}
              className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Usar no check-in
            </button>
            <button
              onClick={copyCheckin}
              className="rounded-xl bg-[#071b44] px-4 py-2 text-xs font-black text-white hover:bg-[#10285d] flex items-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copiar resumo
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          <Metric
            label="Plano executado"
            value={`${executedItems.length}/${planItems.length || 7}`}
            icon={CheckCircle2}
          />
          <Metric
            label="Salvamentos"
            value={formatNumber(organicTotals.salvamentos)}
            icon={ClipboardCheck}
          />
          <Metric
            label="Cliques organicos"
            value={formatNumber(organicTotals.cliques)}
            icon={Target}
          />
          <Metric
            label="Leads"
            value={formatNumber(organicTotals.leads)}
            icon={TrendingUp}
          />
          <Metric
            label="Receita"
            value={formatCurrency(organicTotals.receita)}
            icon={BarChart3}
          />
        </div>
        <div className="rounded-2xl bg-[#fbfcff] border border-[#e6ebf3] p-4 mt-4">
          <p className="text-xs font-black text-[#61708a] uppercase">
            Melhor aprendizado ate aqui
          </p>
          <p className="text-sm font-black text-[#071b44] mt-1">
            {bestPlanItem
              ? `Dia ${bestPlanItem.dia} - ${bestPlanItem.canal}: ${bestPlanItem.gancho || bestPlanItem.ideia}`
              : "Ainda falta medir ao menos um post para eleger um vencedor."}
          </p>
          <p className="text-xs text-[#61708a] leading-relaxed mt-2">
            {bestPlanItem
              ? "Use esse sinal como base para o proximo Estudio, uma campanha pequena ou uma nova variacao."
              : "Quando houver resultado, o resumo passa a orientar o que repetir, ajustar ou abandonar."}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
            <DecisionCard
              label="Repetir"
              value={organicDecisions.repetir}
              tone="dark"
            />
            <DecisionCard
              label="Ajustar"
              value={organicDecisions.ajustar}
              tone="light"
            />
            <DecisionCard
              label="Evitar agora"
              value={organicDecisions.evitar}
              tone="warn"
            />
          </div>
          {bestPlanItem?.creativeId ? (
            <button
              type="button"
              onClick={() =>
                duplicateCreative.mutate({
                  id: Number(bestPlanItem.creativeId),
                })
              }
              disabled={duplicateCreative.isPending}
              className="mt-4 rounded-xl bg-[#071b44] text-white px-4 py-2.5 text-xs font-black inline-flex items-center gap-2 disabled:opacity-50"
            >
              {duplicateCreative.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Criar variacao do vencedor
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="max-w-4xl">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest">
              Proxima semana
            </p>
            <h2 className="text-2xl font-black mt-2">
              O que repetir, ajustar e evitar
            </h2>
            <p className="text-sm text-white/78 leading-relaxed mt-3">
              Este e o fechamento pratico do ciclo: sai do resultado real e
              vira uma rota objetiva para a proxima semana.
            </p>
          </div>
          <button
            type="button"
            onClick={copyNextWeek}
            className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar plano
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-5">
          <DecisionCard
            label="Repetir"
            value={organicDecisions.repetir}
            tone="dark"
          />
          <DecisionCard
            label="Ajustar"
            value={organicDecisions.ajustar}
            tone="light"
          />
          <DecisionCard
            label="Evitar agora"
            value={organicDecisions.evitar}
            tone="warn"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            onClick={() => navigate("/diagnostico")}
            className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2"
          >
            Atualizar diagnostico <RefreshCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => navigate(bestPlanItem ? "/estudio" : "/integracoes")}
            className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2"
          >
            {bestPlanItem ? "Criar nova variacao" : "Medir primeiro"}{" "}
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[.85fr_1.15fr] gap-5 mb-5">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">
            {planner?.ciclo || "Ciclo de execucao"}
          </p>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-white/70">
                Progresso do cronograma
              </p>
              <p className="text-5xl font-black mt-1">{progress}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white/70">
                Conteudos feitos
              </p>
              <p className="text-2xl font-black">
                {contentDone}/{contentTotal || "-"}
              </p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-white/15 mt-5 overflow-hidden">
            <div
              className="h-full bg-[#ff3217]"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4 mt-5">
            <p className="text-xs font-black text-white/60 uppercase">
              Proximo foco
            </p>
            <p className="text-base font-black mt-1">
              {planner?.proximoFoco || "Executar a primeira semana"}
            </p>
            <p className="text-sm text-white/72 mt-2">
              {planner?.novaPrescricao ||
                "Registre o que foi feito para o Agente ajustar a proxima rota."}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#ff3217]" /> Sinais de
                resultado
              </h2>
              <p className="text-sm text-[#61708a] mt-1">
                Leitura inicial para comparar com a Semana 2 e as campanhas
                aprovadas.
              </p>
            </div>
            <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
              {campaigns.data?.length ?? 0} campanha(s)
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Metric
              label="Impressoes"
              value={formatNumber(totals.impressions)}
              icon={Megaphone}
            />
            <Metric
              label="Cliques"
              value={formatNumber(totals.clicks)}
              icon={Target}
            />
            <Metric
              label="Conversoes"
              value={formatNumber(totals.conversions)}
              icon={TrendingUp}
            />
            <Metric
              label="CTR"
              value={`${totals.ctr.toFixed(2)}%`}
              icon={BarChart3}
            />
          </div>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="O que aconteceu nesta semana? Ex.: publiquei 3 posts, o LinkedIn gerou comentarios bons, o Instagram nao respondeu, a campanha teve CPL alto..."
            className="input-clean min-h-[112px] resize-none mt-5"
          />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#ff3217]" /> Planner do
              diagnostico
            </h2>
            <p className="text-sm text-[#61708a] mt-1">
              Marque o que foi executado. Isso vira contexto para o Agente
              recalcular a prescricao.
            </p>
          </div>
          <div className="flex gap-2">
            <StatusPill label="Feito" status="done" />
            <StatusPill label="A fazer" status="todo" />
            <StatusPill label="Atrasado" status="late" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          {(planner?.semanas ?? []).map((week: PlannerWeek, wi: number) => (
            <article
              key={`${week.semana}-${wi}`}
              className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5"
            >
              <span className="rounded-full bg-[#071b44] text-white text-xs font-black px-3 py-1">
                {week.semana}
              </span>
              <div className="space-y-2 mt-4">
                {(week.itens ?? []).map((item, ii) => (
                  <div
                    key={`${item.texto}-${ii}`}
                    className={`rounded-xl border p-3 ${statusStyle[item.status ?? "todo"]}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setItemStatus(
                            wi,
                            ii,
                            item.status === "done" ? "todo" : "done"
                          )
                        }
                        className="mt-0.5"
                        title={
                          item.status === "done"
                            ? "Marcar como a fazer"
                            : "Marcar como feito"
                        }
                      >
                        {item.status === "done" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <p className="text-sm font-bold leading-relaxed flex-1">
                        {item.texto}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {(["done", "todo", "late"] as const).map(status => (
                        <button
                          key={status}
                          onClick={() => setItemStatus(wi, ii, status)}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] font-black ${item.status === status ? statusStyle[status] : "bg-white text-[#61708a] border-[#e6ebf3]"}`}
                        >
                          {status === "done"
                            ? "feito"
                            : status === "late"
                              ? "atrasado"
                              : "a fazer"}
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
        <h2 className="text-xl font-black text-[#070b17] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#ff3217]" /> Evolucao registrada
        </h2>
        <p className="text-sm text-[#61708a] mt-1">
          Compare a foto inicial com os check-ins para saber se a prescricao
          esta melhorando a execucao.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(planner?.snapshots ?? []).map((snap: any) => (
              <div
                key={snap.label}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5"
              >
                <h3 className="text-base font-black text-[#071b44]">
                  {snap.label}
                </h3>
                <p className="text-sm text-[#61708a] mt-2 line-clamp-5">
                  {snap.resumo}
                </p>
                <div className="space-y-3 mt-4">
                  {(snap.scores ?? []).map((score: any) => (
                    <Score
                      key={score.nome}
                      label={score.nome}
                      value={score.valor}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <aside className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-5 h-fit">
            <h3 className="text-sm font-black text-[#071b44]">
              Historico de check-ins
            </h3>
            <p className="text-xs text-[#61708a] mt-1">
              Cada registro vira contexto para o Agente recalcular a rota.
            </p>
            <div className="space-y-3 mt-4">
              {((planner?.feedbacks ?? []) as any[]).length ? (
                (planner.feedbacks ?? [])
                  .slice()
                  .reverse()
                  .map((f: any) => (
                    <div
                      key={`${f.at}-${f.texto}`}
                      className="rounded-xl border border-[#e6ebf3] bg-white p-3"
                    >
                      <p className="text-[10px] font-black text-[#ff3217]">
                        {new Date(f.at).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-xs font-bold text-[#22304b] leading-relaxed mt-1">
                        {f.texto}
                      </p>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-[#61708a] rounded-xl border border-dashed border-[#d8e0ec] bg-white p-4">
                  Ainda nao ha check-ins. Escreva o que foi executado e salve
                  para criar a primeira foto de evolucao.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </AppLayout>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <Icon className="w-4 h-4 text-[#ff3217] mb-2" />
      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function DecisionCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "dark" | "light" | "warn";
}) {
  const style =
    tone === "dark"
      ? "bg-[#071b44] text-white border-[#071b44]"
      : tone === "warn"
        ? "bg-[#fff8f6] text-[#071b44] border-[#ffd5ce]"
        : "bg-white text-[#071b44] border-[#e6ebf3]";
  const labelStyle =
    tone === "dark"
      ? "text-white/60"
      : tone === "warn"
        ? "text-[#ff3217]"
        : "text-[#61708a]";
  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p
        className={`text-[10px] font-black uppercase tracking-wide ${labelStyle}`}
      >
        {label}
      </p>
      <p className="text-sm font-black leading-snug mt-2">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: PlannerItem["status"];
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusStyle[status]}`}
    >
      {label}
    </span>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-[#61708a]">{label}</span>
        <span className="text-[#071b44]">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-[#edf1f7] mt-1 overflow-hidden">
        <div
          className="h-full bg-[#ff3217]"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(n || 0));
}

function organicScore(item: any) {
  const r = item?.resultado ?? {};
  return (
    Number(r.salvamentos ?? 0) * 2 +
    Number(r.cliques ?? 0) * 3 +
    Number(r.leads ?? 0) * 8 +
    Number(r.vendas ?? 0) * 18 +
    Number(r.receita ?? 0) / 10
  );
}

function buildOrganicDecisions(measuredItems: any[], bestPlanItem: any) {
  if (!measuredItems.length) {
    return {
      repetir: "Medir ao menos um post publicado.",
      ajustar:
        "Publicar o proximo item com uma pergunta clara para puxar resposta.",
      evitar: "Trocar toda a estrategia antes de ter sinal real.",
    };
  }

  const ranked = [...measuredItems].sort(
    (a, b) => organicScore(b) - organicScore(a)
  );
  const best = bestPlanItem ?? ranked[0];
  const weakest = ranked[ranked.length - 1];
  const bestResult = best?.resultado ?? {};
  const hasConversion =
    Number(bestResult.leads ?? 0) > 0 || Number(bestResult.vendas ?? 0) > 0;
  const hasInterest =
    Number(bestResult.salvamentos ?? 0) > 0 ||
    Number(bestResult.cliques ?? 0) > 0;

  return {
    repetir: best
      ? `${best.canal}: ${best.gancho || best.ideia || "gancho vencedor"}.`
      : "Repetir o item com melhor resposta manual.",
    ajustar: hasConversion
      ? "Transformar o vencedor em oferta direta ou campanha pequena."
      : hasInterest
        ? "Criar uma nova versao com CTA mais forte e prova real."
        : "Testar uma promessa mais especifica antes de aumentar volume.",
    evitar:
      weakest && organicScore(weakest) < organicScore(best) / 3
        ? `${weakest.canal}: nao escalar esse angulo sem mudar gancho.`
        : "Aumentar verba ou frequencia sem registrar novos resultados.",
  };
}
