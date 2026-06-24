import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Copy, Egg, RefreshCw, Trophy } from "lucide-react";

const BRL = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const FACTOR_LABEL: Record<string, string> = {
  img_cor_predominante: "cor",
  img_tipo: "imagem",
  img_pessoa_idade: "idade",
  copy_tom: "tom",
  copy_formato: "formato",
  of_angulo: "angulo",
};

export default function Ovos() {
  const utils = trpc.useUtils();
  const dash = trpc.ovos.dashboard.useQuery();
  const refresh = trpc.ovos.refresh.useMutation({
    onSuccess: () => {
      toast.success("Metricas atualizadas e verba redistribuida.");
      utils.ovos.dashboard.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar resultados"),
  });

  const d = dash.data;
  const k = d?.kpis;
  const f = d?.funnel;
  const hasData = !!d && (!!k?.activeExperiments || !!k?.conversions);

  const winnerText = d?.winner ? [
    "Receita do vencedor",
    "",
    d.winner.copy,
    "",
    "Fatores:",
    ...Object.entries(d.winner.factorValues ?? {}).slice(0, 8).map(([fk, val]: any) => `- ${(FACTOR_LABEL[fk] ?? fk)}: ${val}`),
  ].join("\n") : "";

  async function copyWinner() {
    if (!winnerText) return;
    await navigator.clipboard?.writeText(winnerText);
    toast.success("Receita do vencedor copiada.");
  }

  return (
    <AppLayout
      title="Ovos de Ouro"
      subtitle="Resultados, redistribuicao de verba e padroes que merecem ser repetidos."
      actions={
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="text-xs font-black text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refresh.isPending ? "animate-spin" : ""}`} /> Atualizar
        </button>
      }
    >
      {dash.isLoading ? (
        <p className="text-sm text-[#61708a]">Carregando...</p>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-[#e6ebf3] p-10 text-center shadow-sm">
          <Egg className="w-10 h-10 text-[#c7cdd8] mx-auto mb-3" />
          <p className="text-sm font-black text-[#070b17]">Nenhuma campanha com resultado ainda</p>
          <p className="text-xs text-[#61708a] mt-1">Aprove conteudos, publique campanhas e registre metricas para revelar os vencedores.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5 mb-6">
            <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
              <p className="text-xs font-black text-white/60 uppercase tracking-widest">Motor de vencedores</p>
              <h2 className="text-2xl font-black mt-2">O que esta puxando resultado</h2>
              <p className="text-sm text-white/78 leading-relaxed mt-3">
                A leitura compara criativos, verba e fatores de mensagem para identificar padroes que devem virar novas variacoes.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                <Kpi label="Gasto" value={BRL(k!.spend)} />
                <Kpi label="Leads" value={String(k!.leads)} />
                <Kpi label="CPL" value={BRL(k!.cpl)} />
                <Kpi label="ROAS" value={`${k!.roas}x`} accent />
                <Kpi label="Vencedores" value={String(k!.goldenEggs)} accent />
              </div>
            </div>
            <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
              <Trophy className="w-6 h-6 text-[#ff3217]" />
              <p className="text-xs font-black text-[#61708a] uppercase tracking-wide mt-3">Decisao recomendada</p>
              <h3 className="text-xl font-black text-[#071b44] mt-1">
                {d?.winner ? "Criar novas variacoes do vencedor" : "Coletar mais volume antes de decidir"}
              </h3>
              <p className="text-sm text-[#61708a] leading-relaxed mt-2">
                {d?.winner
                  ? "Use a copy e os fatores vencedores como base, mas troque angulo, imagem ou oferta para descobrir o proximo salto."
                  : "Ainda falta volume minimo para separar intuicao de sinal real."}
              </p>
              {d?.winner && (
                <button onClick={copyWinner} className="mt-4 rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5" /> Copiar receita
                </button>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#e6ebf3] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[#070b17] mb-3">Distribuicao da verba</h3>
              <div className="space-y-3">
                {d.variants.map((v: any) => (
                  <VariantBar key={v.id} variant={v} />
                ))}
              </div>
              <p className="text-[11px] text-[#61708a] mt-3">A verba deve migrar para quem prova resultado. Em modo assistido, use esta leitura para ajustar manualmente.</p>
            </div>

            <div className="bg-white rounded-2xl border border-[#e6ebf3] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[#070b17] mb-3">Funil</h3>
              <Funnel f={f!} />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-[#e6ebf3] p-5 shadow-sm mt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-[#070b17]">Receita do vencedor</h3>
                <p className="text-xs text-[#61708a] mt-1">Padroes criativos que estao aparecendo nos melhores resultados.</p>
              </div>
              {d?.winner && (
                <button onClick={copyWinner} className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
              )}
            </div>

            {d.winner ? (
              <div className="bg-[#f6f8fc] border border-[#e6ebf3] rounded-2xl p-4 mt-4">
                <p className="text-sm font-bold text-[#070b17]">{d.winner.copy}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(d.winner.factorValues ?? {}).slice(0, 8).map(([fk, val]: any) => (
                    <span key={fk} className="text-[10px] font-bold text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded px-2 py-0.5">
                      {(FACTOR_LABEL[fk] ?? fk)}: {val}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#61708a] mt-4">Ainda coletando dados para eleger um vencedor com seguranca.</p>
            )}

            {d.relevance && d.relevance.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-black text-[#61708a] uppercase tracking-wide mb-2">O que mais influencia a venda</p>
                <div className="space-y-2">
                  {d.relevance.map((r: any) => (
                    <div key={r.factor} className="flex items-center justify-between text-xs rounded-xl border border-[#e6ebf3] bg-[#fbfcff] px-3 py-2">
                      <span className="font-semibold text-[#22304b]">
                        {(FACTOR_LABEL[r.factor.split(":")[0]] ?? r.factor.split(":")[0])}: <b>{r.value}</b>
                      </span>
                      <span className="font-black" style={{ color: r.uplift >= 0 ? "#18b85c" : "#c42510" }}>
                        {r.uplift >= 0 ? "+" : ""}{r.uplift}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </AppLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: accent ? "#ffd0c8" : "rgba(255,255,255,.14)", background: accent ? "rgba(255,50,23,.12)" : "rgba(255,255,255,.08)" }}>
      <p className="text-[10px] font-black text-white/62 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function VariantBar({ variant }: { variant: any }) {
  const color = variant.status === "ovo_de_ouro" ? "#18b85c" : variant.status === "em_teste" ? "#2f7fd1" : "#c7cdd8";
  const label = variant.status === "ovo_de_ouro" ? "vencedor" : variant.status === "em_teste" ? "em teste" : "pausado";
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold mb-1">
        <span className="text-[#22304b] truncate pr-2">
          {label} - {variant.lente ?? ""} {variant.factorValues?.img_cor_predominante ?? ""}
        </span>
        <span style={{ color }}>{variant.share}%</span>
      </div>
      <div className="h-2 bg-[#f6f8fc] rounded-full overflow-hidden">
        <div className="h-2 rounded-full" style={{ width: `${variant.share}%`, background: color }} />
      </div>
    </div>
  );
}

function Funnel({ f }: { f: { impressions: number; clicks: number; leads: number; conversions: number } }) {
  const steps = [
    { label: "Impressoes", v: f.impressions, color: "linear-gradient(135deg,#ff7b00,#ff3217)" },
    { label: "Cliques", v: f.clicks, color: "linear-gradient(135deg,#7c39e8,#4a1f99)" },
    { label: "Leads", v: f.leads, color: "linear-gradient(135deg,#2f7fd1,#143f6b)" },
    { label: "Vendas", v: f.conversions, color: "linear-gradient(135deg,#18b85c,#0a6b34)" },
  ];
  const max = Math.max(f.impressions, 1);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const w = Math.max(8, Math.round((s.v / max) * 100));
        const prev = i > 0 ? steps[i - 1].v : null;
        const conv = prev && prev > 0 ? ((s.v / prev) * 100).toFixed(1) : null;
        return (
          <div key={s.label}>
            {conv && <p className="text-[9px] text-[#61708a] font-bold ml-1">Conversao da etapa: {conv}%</p>}
            <div className="text-white font-black text-xs rounded-lg px-3 py-2 flex justify-between" style={{ width: `${w}%`, minWidth: 120, background: s.color }}>
              <span>{s.label}</span>
              <span>{s.v.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
