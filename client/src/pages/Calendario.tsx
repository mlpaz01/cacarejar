import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import {
  CalendarDays,
  Copy,
  Download,
  Edit3,
  FileText,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  ideia: "Ideia",
  em_edicao: "Em edicao",
  aprovado: "Aprovado",
  publicado: "Publicado",
  medir: "Medir",
};

const STATUS_STYLE: Record<string, string> = {
  ideia: "bg-white text-[#61708a] border-[#e6ebf3]",
  em_edicao: "bg-[#fff8e8] text-[#8a5a00] border-[#ffe0a3]",
  aprovado: "bg-[#eafff1] text-[#087a32] border-[#bfeccb]",
  publicado: "bg-[#eef4ff] text-[#174a95] border-[#dbe8ff]",
  medir: "bg-[#071b44] text-white border-[#071b44]",
};

export default function Calendario() {
  const [, navigate] = useLocation();
  const [resultDrafts, setResultDrafts] = useState<
    Record<number, Record<string, string>>
  >({});
  const utils = trpc.useUtils();
  const diagnosis = trpc.diagnosis.get.useQuery();
  const updateItem = trpc.diagnosis.updateSevenDayItem.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      toast.success("Calendario atualizado.");
    },
    onError: e => toast.error(e.message || "Erro ao atualizar calendario"),
  });
  const ensureOriginCreative = trpc.studio.ensureOriginCreative.useMutation({
    onError: e => toast.error(e.message || "Erro ao abrir Estudio"),
  });

  const plan: any = diagnosis.data;
  const items = ((plan?.plano7Dias ?? []) as any[]).map((item, index) => ({
    ...item,
    index,
    date: addDays(new Date(), index),
    status: item.status || "ideia",
  }));
  const published = items.filter(
    item => ["publicado", "medir"].includes(item.status) || item.resultado
  ).length;
  const approved = items.filter(item => item.status === "aprovado").length;
  const editing = items.filter(item => item.status === "em_edicao").length;
  const focusItem =
    items.find(
      item => !["publicado", "medir"].includes(item.status) && !item.resultado
    ) ?? items[0];

  const weekText = items
    .map(item =>
      [
        `${format(item.date, "dd/MM", { locale: ptBR })} - ${item.dia} - ${item.canal}`,
        `Status: ${STATUS_LABEL[item.status] ?? item.status}`,
        `Formato: ${item.formato || "-"}`,
        `Objetivo: ${item.objetivo || "-"}`,
        `Gancho: ${item.gancho || "-"}`,
        `Legenda: ${item.legenda || "-"}`,
        `CTA: ${item.cta || "-"}`,
        item.hashtags?.length ? `Hashtags: ${item.hashtags.join(" ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n---\n\n");

  async function copyWeek() {
    await navigator.clipboard?.writeText(weekText);
    toast.success("Semana copiada.");
  }

  function downloadCsv() {
    const header = [
      "data",
      "dia",
      "canal",
      "formato",
      "status",
      "objetivo",
      "gancho",
      "cta",
      "link",
    ].join(",");
    const rows = items.map(item =>
      [
        format(item.date, "yyyy-MM-dd"),
        item.dia,
        item.canal,
        item.formato,
        STATUS_LABEL[item.status] ?? item.status,
        item.objetivo,
        item.gancho,
        item.cta,
        item.publicadoUrl ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacarejar-calendario-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadIcs() {
    const stamp = icsDate(new Date());
    const events = items.map((item, index) => {
      const start = new Date(item.date);
      start.setHours(9 + Math.min(index, 6), 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      const description = [
        `Status: ${STATUS_LABEL[item.status] ?? item.status}`,
        `Canal: ${item.canal}`,
        `Formato: ${item.formato || "-"}`,
        `Objetivo: ${item.objetivo || "-"}`,
        `Gancho: ${item.gancho || "-"}`,
        `Legenda: ${item.legenda || "-"}`,
        `CTA: ${item.cta || "-"}`,
        item.hashtags?.length ? `Hashtags: ${item.hashtags.join(" ")}` : "",
      ]
        .filter(Boolean)
        .join("\\n");
      return [
        "BEGIN:VEVENT",
        `UID:cacarejar-${format(new Date(), "yyyyMMdd")}-${index}@cacarejar`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsEscape(`${item.dia} - ${item.canal}: ${item.gancho || "post"}`)}`,
        `DESCRIPTION:${icsEscape(description)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cacarejar//Calendario Editorial//PT-BR",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cacarejar-calendario-${format(new Date(), "yyyy-MM-dd")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setStatus(
    index: number,
    status: "ideia" | "em_edicao" | "aprovado" | "publicado" | "medir"
  ) {
    updateItem.mutate({ index, patch: { status } });
  }

  async function openStudio(index: number, creativeId?: number) {
    try {
      const id =
        creativeId ??
        (
          await ensureOriginCreative.mutateAsync({
            originType: "diagnosis-plan",
            index,
          })
        ).id;
      await utils.diagnosis.get.invalidate();
      navigate(
        `/criativos/${id}?returnTo=${encodeURIComponent(`/calendario?studioReturn=${Date.now()}`)}&closeOnSave=1`
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir Estudio");
    }
  }

  function saveResult(index: number) {
    const draft = resultDrafts[index] ?? {};
    updateItem.mutate({
      index,
      patch: {
        status: "medir",
        publicadoUrl: draft.publicadoUrl || undefined,
        resultado: {
          alcance: numberOrUndefined(draft.alcance),
          salvamentos: numberOrUndefined(draft.salvamentos),
          cliques: numberOrUndefined(draft.cliques),
          leads: numberOrUndefined(draft.leads),
          vendas: numberOrUndefined(draft.vendas),
          receita: numberOrUndefined(draft.receita),
          observacoes: draft.observacoes || undefined,
        },
      },
    });
  }

  if (diagnosis.isLoading) {
    return (
      <AppLayout
        title="Calendario Editorial"
        subtitle="Carregando plano semanal"
        journeyActive="publicacao"
      >
        <div className="rounded-2xl border border-[#e6ebf3] bg-white p-10 text-center text-sm font-black text-[#61708a]">
          Carregando...
        </div>
      </AppLayout>
    );
  }

  if (!plan || !items.length) {
    return (
      <AppLayout
        title="Calendario Editorial"
        subtitle="Crie um diagnostico para gerar o calendario."
        journeyActive="publicacao"
      >
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-10 text-center shadow-sm">
          <CalendarDays className="w-11 h-11 text-[#c7d1e0] mx-auto mb-3" />
          <p className="text-base font-black text-[#071b44]">
            Nenhum plano semanal ativo
          </p>
          <p className="text-sm text-[#61708a] mt-1">
            O calendario nasce do Plano de 7 dias do diagnostico.
          </p>
          <Link href="/diagnostico">
            <a className="btn-action-primary mt-5 px-5 py-3 text-sm inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> Abrir diagnostico
            </a>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Calendario Editorial"
      subtitle="Uma semana visivel para publicar, acompanhar e medir sem se perder."
      journeyActive="publicacao"
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={copyWeek}
            className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copiar semana
          </button>
          <button
            onClick={downloadCsv}
            className="btn-action-primary px-4 py-2.5 text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Baixar CSV
          </button>
          <button
            onClick={downloadIcs}
            className="rounded-xl bg-[#071b44] px-4 py-2.5 text-sm font-black text-white hover:bg-[#0d2a5e] flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" /> Baixar agenda
          </button>
        </div>
      }
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">
            Semana ativa
          </p>
          <h2 className="text-2xl font-black mt-2">
            {plan.produto || plan.nicho || "Plano editorial"}
          </h2>
          <p className="text-sm text-white/78 leading-relaxed mt-3 max-w-3xl">
            Use esta tela como mesa de operacao: edite, aprove, publique
            manualmente, cole o link e volte para medir.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <TopMetric label="Em edicao" value={String(editing)} />
            <TopMetric label="Aprovados" value={String(approved)} />
            <TopMetric
              label="Publicados"
              value={`${published}/${items.length}`}
            />
          </div>
        </div>
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase">
            Proximo passo
          </p>
          <h3 className="text-xl font-black text-[#071b44] mt-1">
            {nextAction(items)}
          </h3>
          <p className="text-sm text-[#61708a] leading-relaxed mt-2">
            O calendario nao substitui o Estudio: ele organiza a semana e mantem
            a execucao conectada ao diagnostico.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/diagnostico">
              <a className="rounded-xl border border-[#e6ebf3] px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Plano completo
              </a>
            </Link>
            <Link href="/recalibracao">
              <a className="rounded-xl border border-[#e6ebf3] px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Check-in
              </a>
            </Link>
          </div>
        </div>
      </section>

      {focusItem && (
        <section className="rounded-3xl border border-[#ffd6ce] bg-[#fff8f6] p-5 shadow-sm mb-6">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff3217] text-white grid place-items-center flex-shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
                Modo execucao da semana
              </p>
              <h2 className="text-xl font-black text-[#071b44] mt-1">
                {focusItem.dia} - {focusItem.canal}
              </h2>
              <p className="text-sm text-[#22304b] font-bold leading-relaxed mt-1">
                {focusItem.gancho ||
                  "Abra no Estudio, refine e publique quando estiver pronto."}
              </p>
              <p className="text-xs text-[#61708a] mt-2">
                Status atual:{" "}
                {STATUS_LABEL[focusItem.status] ?? focusItem.status}. Proximo
                passo: {executionHint(focusItem)}.
              </p>
            </div>
            <div className="grid grid-cols-2 md:flex gap-2">
              <button
                type="button"
                onClick={() =>
                  openStudio(focusItem.index, focusItem.creativeId)
                }
                disabled={ensureOriginCreative.isPending}
                className="rounded-xl bg-[#071b44] text-white px-4 py-2.5 text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {ensureOriginCreative.isPending &&
                (ensureOriginCreative.variables as any)?.index ===
                  focusItem.index ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Edit3 className="w-3.5 h-3.5" />
                )}
                Editar
              </button>
              <button
                type="button"
                onClick={() => setStatus(focusItem.index, "aprovado")}
                disabled={updateItem.isPending}
                className="rounded-xl border border-[#e6ebf3] bg-white text-[#071b44] px-4 py-2.5 text-xs font-black hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => setStatus(focusItem.index, "publicado")}
                disabled={updateItem.isPending}
                className="rounded-xl border border-[#e6ebf3] bg-white text-[#071b44] px-4 py-2.5 text-xs font-black hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Publicado
              </button>
              <button
                type="button"
                onClick={() => saveResult(focusItem.index)}
                disabled={updateItem.isPending}
                className="rounded-xl border border-[#18b85c] bg-[#eafff1] text-[#087a32] px-4 py-2.5 text-xs font-black hover:bg-[#dffbea] disabled:opacity-50"
              >
                Medir
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {items.map(item => {
          const creatingCreative =
            ensureOriginCreative.isPending &&
            (ensureOriginCreative.variables as any)?.index === item.index;
          return (
            <article
              key={`${item.dia}-${item.index}`}
              className="rounded-2xl border border-[#e6ebf3] bg-white p-4 shadow-sm flex flex-col min-h-[560px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black text-[#ff3217] uppercase">
                    {format(item.date, "EEE dd/MM", { locale: ptBR })}
                  </p>
                  <h3 className="text-base font-black text-[#071b44] mt-1">
                    {item.dia}
                  </h3>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-black ${STATUS_STYLE[item.status] ?? STATUS_STYLE.ideia}`}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>

              <p className="text-xs font-black text-[#071b44] mt-4">
                {item.canal}
              </p>
              <p className="text-[11px] text-[#61708a] font-bold mt-1">
                {item.formato || "post"}
              </p>
              <div className="rounded-xl bg-[#fbfcff] border border-[#e6ebf3] p-3 mt-3 flex-1">
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Gancho
                </p>
                <p className="text-sm font-black text-[#071b44] leading-snug mt-1 line-clamp-4">
                  {item.gancho}
                </p>
                <p className="text-[11px] text-[#22304b] leading-relaxed mt-2 line-clamp-6">
                  {item.legenda}
                </p>
              </div>

              {item.publicadoUrl && (
                <a
                  href={item.publicadoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 rounded-xl border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2 text-[11px] font-black text-[#071b44] inline-flex items-center gap-1.5 truncate"
                >
                  <LinkIcon className="w-3.5 h-3.5 shrink-0" /> Post publicado
                </a>
              )}

              <div className="mt-3 rounded-xl bg-[#fbfcff] border border-[#e6ebf3] p-3">
                <p className="text-[10px] font-black text-[#61708a] uppercase">
                  Resultado
                </p>
                <input
                  value={
                    resultDrafts[item.index]?.publicadoUrl ??
                    item.publicadoUrl ??
                    ""
                  }
                  onChange={e =>
                    setResultDrafts(prev => ({
                      ...prev,
                      [item.index]: {
                        ...(prev[item.index] ?? {}),
                        publicadoUrl: e.target.value,
                      },
                    }))
                  }
                  placeholder="Link do post publicado"
                  className="mt-2 w-full rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    ["alcance", "Alcance"],
                    ["salvamentos", "Salvos"],
                    ["cliques", "Cliques"],
                    ["leads", "Leads"],
                    ["vendas", "Vendas"],
                    ["receita", "Receita R$"],
                  ].map(([key, label]) => (
                    <input
                      key={key}
                      type="number"
                      min={0}
                      value={
                        resultDrafts[item.index]?.[key] ??
                        item.resultado?.[key] ??
                        ""
                      }
                      onChange={e =>
                        setResultDrafts(prev => ({
                          ...prev,
                          [item.index]: {
                            ...(prev[item.index] ?? {}),
                            [key]: e.target.value,
                          },
                        }))
                      }
                      placeholder={label}
                      className="rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                    />
                  ))}
                </div>
                <textarea
                  value={
                    resultDrafts[item.index]?.observacoes ??
                    item.resultado?.observacoes ??
                    ""
                  }
                  onChange={e =>
                    setResultDrafts(prev => ({
                      ...prev,
                      [item.index]: {
                        ...(prev[item.index] ?? {}),
                        observacoes: e.target.value,
                      },
                    }))
                  }
                  placeholder="Observacao humana: comentarios, DMs, percepcao e aprendizados."
                  className="mt-2 w-full min-h-[64px] resize-none rounded-lg border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                />
                <button
                  type="button"
                  onClick={() => saveResult(item.index)}
                  disabled={updateItem.isPending}
                  className="mt-2 w-full rounded-xl border border-[#18b85c] bg-[#eafff1] text-[#087a32] px-3 py-2 text-xs font-black hover:bg-[#dffbea] disabled:opacity-50"
                >
                  Salvar resultado
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {(["em_edicao", "aprovado", "publicado", "medir"] as const).map(
                  status => (
                    <button
                      key={status}
                      onClick={() => setStatus(item.index, status)}
                      disabled={updateItem.isPending}
                      className={`rounded-lg border px-2 py-1.5 text-[9px] font-black disabled:opacity-50 ${item.status === status ? "bg-[#071b44] text-white border-[#071b44]" : "bg-white text-[#61708a] border-[#e6ebf3] hover:text-[#071b44]"}`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => openStudio(item.index, item.creativeId)}
                  disabled={creatingCreative}
                  className="rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-[10px] font-black text-[#071b44] hover:bg-[#f8fafc] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {creatingCreative ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Edit3 className="w-3 h-3" />
                  )}
                  Estudio
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard?.writeText(
                      `${item.dia} - ${item.canal}\n\n${item.gancho}\n\n${item.legenda}\n\n${item.cta || ""}`
                    );
                    toast.success("Post copiado.");
                  }}
                  className="rounded-xl bg-[#071b44] px-3 py-2 text-[10px] font-black text-white hover:bg-[#0d2a5e] flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </AppLayout>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-[10px] font-black text-white/60 uppercase">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function nextAction(items: any[]) {
  if (!items.some(item => item.status !== "ideia"))
    return "Comece editando o Dia 1 no Estudio.";
  if (items.some(item => item.status === "em_edicao"))
    return "Finalize a edicao e aprove os posts prontos.";
  if (items.some(item => item.status === "aprovado"))
    return "Publique os aprovados e cole os links no diagnostico.";
  if (items.some(item => item.status === "publicado"))
    return "Registre resultados e marque como medir.";
  return "Rode o check-in para transformar os resultados em aprendizado.";
}

function executionHint(item: any) {
  if (item.resultado || item.status === "medir")
    return "rodar o check-in e transformar resultado em aprendizado";
  if (item.status === "publicado")
    return "registrar link, numeros e observacoes do post";
  if (item.status === "aprovado") return "publicar manualmente e colar o link";
  if (item.status === "em_edicao") return "finalizar o toque humano no Estudio";
  return "abrir no Estudio e deixar pronto para aprovacao";
}

function csvCell(value: any) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function numberOrUndefined(value: any) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function icsDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value: string) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
