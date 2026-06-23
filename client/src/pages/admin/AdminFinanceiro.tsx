import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, DollarSign, Users, Zap, AlertTriangle } from "lucide-react";

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Todo período", days: 0 },
];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number) {
  return v.toFixed(1) + "%";
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "blue" | "orange";
}) {
  const colors: Record<string, string> = {
    green: "#16a34a",
    red: "#dc2626",
    blue: "#2563eb",
    orange: "#d97706",
  };
  const bgs: Record<string, string> = {
    green: "#f0fdf4",
    red: "#fef2f2",
    blue: "#eff6ff",
    orange: "#fffbeb",
  };
  const c = accent ? colors[accent] : "#011643";
  const bg = accent ? bgs[accent] : "#f7f9fc";
  return (
    <div className="rounded-xl border border-[#e6ebf3] bg-white p-5 flex gap-4 items-start">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <span style={{ color: c }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#61708a]">{label}</p>
        <p className="text-2xl font-black mt-0.5" style={{ color: c }}>{value}</p>
        {sub && <p className="text-xs text-[#61708a] font-semibold mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b border-[#f0f3f8] last:border-0 ${highlight ? "font-black" : ""}`}>
      <span className="text-sm text-[#263754]">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-[#011643]" : "text-[#455369]"}`}>{value}</span>
    </div>
  );
}

export default function AdminFinanceiro() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = trpc.admin.financials.useQuery({ days });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#011643]">Dashboard Financeiro</h1>
          <p className="text-sm text-[#61708a] font-semibold mt-0.5">Receita real × custo estimado de API × margem</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                days === p.days
                  ? "bg-[#011643] text-white border-[#011643]"
                  : "bg-white text-[#61708a] border-[#e6ebf3] hover:border-[#011643]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-20 text-[#61708a] font-semibold">Carregando...</div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 font-semibold flex gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          Erro ao carregar dados: {error.message}
        </div>
      )}
      {data && (
        <>
          {/* Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Receita"
              value={fmtBRL(data.revenue.brl)}
              sub={`${data.revenue.count} recarga${data.revenue.count !== 1 ? "s" : ""}`}
              accent="blue"
            />
            <StatCard
              icon={<TrendingDown className="w-5 h-5" />}
              label="Custo estimado"
              value={fmtBRL(data.cost.totalBrl)}
              sub="APIs dos Agentes (estimativa)"
              accent="orange"
            />
            <StatCard
              icon={data.margin.brl >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              label="Margem"
              value={fmtBRL(data.margin.brl)}
              sub={fmtPct(data.margin.pct) + " de margem bruta"}
              accent={data.margin.brl >= 0 ? "green" : "red"}
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Novas contas"
              value={String(data.ops.newAccounts)}
              sub={`~${fmtBRL(data.ops.newAccounts * 0.80 * 5.80)} em diagnósticos`}
              accent="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Operações */}
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#ff3217]" />
                <h2 className="text-sm font-black text-[#011643]">Operações realizadas</h2>
              </div>
              <Row label="Criativos gerados" value={`${data.ops.creative}`} />
              <Row label="Refinos de radar" value={`${data.ops.radar}`} />
              <Row label="Scans AdSpy" value={`${data.ops.adspy}`} />
              <Row label="Diagnósticos" value={`${data.ops.diagnosis}`} />
              <Row label="Novas contas (diagnóstico gratuito)" value={`${data.ops.newAccounts}`} />
            </div>

            {/* Breakdown de custo */}
            <div className="bg-white rounded-xl border border-[#e6ebf3] p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-[#ff3217]" />
                <h2 className="text-sm font-black text-[#011643]">Breakdown de custo estimado</h2>
              </div>
              <Row label="Criativos (imagem por Agente)" value={fmtBRL(data.cost.breakdown.creative)} />
              <Row label="Radar (análise)" value={fmtBRL(data.cost.breakdown.radar)} />
              <Row label="AdSpy (scan)" value={fmtBRL(data.cost.breakdown.adspy)} />
              <Row label="Diagnósticos" value={fmtBRL(data.cost.breakdown.diagnosis)} />
              <Row label="Bônus de boas-vindas (diagnóstico grátis)" value={fmtBRL(data.cost.breakdown.welcome)} />
              <Row label="Total estimado" value={fmtBRL(data.cost.totalBrl)} highlight />
            </div>
          </div>

          {/* Aviso metodologia */}
          <div className="mt-4 rounded-lg bg-[#fffbeb] border border-[#fde68a] px-4 py-3 text-xs text-[#92400e] font-semibold">
            ⚠️ Custos são <strong>estimativas</strong> baseadas em médias por operação (câmbio R$5,80/USD). Consulte OpenRouter e Gemini para valores reais.
          </div>
        </>
      )}
    </div>
  );
}
