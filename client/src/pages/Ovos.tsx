import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RefreshCw, Egg } from "lucide-react";

const BRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const FACTOR_LABEL: Record<string, string> = {
  img_cor_predominante: "cor", img_tipo: "imagem", img_pessoa_idade: "idade",
  copy_tom: "tom", copy_formato: "formato", of_angulo: "ângulo",
};

export default function Ovos() {
  const utils = trpc.useUtils();
  const dash = trpc.ovos.dashboard.useQuery();
  const refresh = trpc.ovos.refresh.useMutation({
    onSuccess: () => { toast.success("Métricas atualizadas e verba redistribuída 🥚"); utils.ovos.dashboard.invalidate(); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const d = dash.data;
  const k = d?.kpis;
  const f = d?.funnel;

  const STATUS_COLOR: Record<string, string> = { ovo_de_ouro: "#18b85c", em_teste: "#2f7fd1", perdeu: "#c7cdd8", pausada: "#c7cdd8" };
  const STATUS_LABEL: Record<string, string> = { ovo_de_ouro: "🥚 ovo de ouro", em_teste: "em teste", perdeu: "pausado", pausada: "pausado" };

  return (
    <AppLayout
      title="Ovos de Ouro"
      subtitle="Resultados, distribuição de verba e o que está vendendo"
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
        <p className="text-sm text-[#61708a]">Carregando…</p>
      ) : !d || k?.activeExperiments === 0 && k?.conversions === 0 ? (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-10 text-center shadow-sm">
          <Egg className="w-10 h-10 text-[#c7cdd8] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#070b17]">Nenhuma campanha no ar ainda</p>
          <p className="text-xs text-[#61708a] mt-1">Crie no Estúdio → aprove → e os ovos de ouro aparecem aqui.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Kpi label="Gasto" value={BRL(k!.spend)} />
            <Kpi label="Leads" value={String(k!.leads)} />
            <Kpi label="CPL" value={BRL(k!.cpl)} />
            <Kpi label="ROAS" value={`${k!.roas}x`} accent />
            <Kpi label="Ovos de ouro" value={`${k!.goldenEggs} 🥚`} accent />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição de verba */}
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[#070b17] mb-3">Distribuição da verba</h3>
              <div className="space-y-3">
                {d.variants.map((v: any) => (
                  <div key={v.id}>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-[#22304b] truncate pr-2">
                        {STATUS_LABEL[v.status] ?? v.status} · {v.lente ?? ""} {v.factorValues?.img_cor_predominante ?? ""}
                      </span>
                      <span style={{ color: STATUS_COLOR[v.status] }}>{v.share}%</span>
                    </div>
                    <div className="h-2 bg-[#f6f8fc] rounded-full overflow-hidden">
                      <div className="h-2 rounded-full" style={{ width: `${v.share}%`, background: STATUS_COLOR[v.status] }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#61708a] mt-3">A verba migra sozinha para quem mais vende (Thompson Sampling).</p>
            </div>

            {/* Funil */}
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
              <h3 className="text-sm font-black text-[#070b17] mb-3">Funil</h3>
              <Funnel f={f!} />
            </div>
          </div>

          {/* Ovo de ouro + relevância */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mt-6">
            <h3 className="text-sm font-black text-[#070b17] mb-3">🥚 A receita do ovo de ouro</h3>
            {d.winner ? (
              <>
                <div className="bg-[#f6f8fc] border border-[#e6ebf3] rounded-lg p-4 mb-4">
                  <p className="text-sm font-bold text-[#070b17]">{d.winner.copy}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(d.winner.factorValues ?? {}).slice(0, 6).map(([fk, val]: any) => (
                      <span key={fk} className="text-[10px] font-bold text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded px-2 py-0.5">
                        {(FACTOR_LABEL[fk] ?? fk)}: {val}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#61708a] mb-4">Ainda coletando dados para eleger o ovo de ouro (precisa de volume mínimo).</p>
            )}

            {d.relevance && d.relevance.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-[#61708a] uppercase tracking-wide mb-2">O que mais influencia a venda</p>
                <div className="space-y-1.5">
                  {d.relevance.map((r: any) => (
                    <div key={r.factor} className="flex items-center justify-between text-xs">
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
          </div>
        </>
      )}
    </AppLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm" style={{ borderColor: accent ? "#ffd0c8" : "#e6ebf3" }}>
      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black mt-1" style={{ color: accent ? "#ff3217" : "#070b17" }}>{value}</p>
    </div>
  );
}

function Funnel({ f }: { f: { impressions: number; clicks: number; leads: number; conversions: number } }) {
  const steps = [
    { label: "Impressões", v: f.impressions, color: "linear-gradient(135deg,#ff7b00,#ff3217)" },
    { label: "Cliques", v: f.clicks, color: "linear-gradient(135deg,#7c39e8,#4a1f99)" },
    { label: "Leads", v: f.leads, color: "linear-gradient(135deg,#2f7fd1,#143f6b)" },
    { label: "Vendas 🥚", v: f.conversions, color: "linear-gradient(135deg,#18b85c,#0a6b34)" },
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
            {conv && <p className="text-[9px] text-[#61708a] font-bold ml-1">▼ {conv}%</p>}
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
