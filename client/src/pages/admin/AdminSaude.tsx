import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  MessageSquareQuote,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";

const cardLabels: Array<{
  key: string;
  label: string;
  icon: any;
  tone: string;
  format?: (value: number) => string;
}> = [
  { key: "totalOrgs", label: "Organizacoes", icon: LayoutDashboard, tone: "#1c6ed9" },
  { key: "profilesUpdated7d", label: "Perfis ativos 7d", icon: Activity, tone: "#18b85c" },
  { key: "reviewQueue", label: "Fila de revisao", icon: ShieldCheck, tone: "#ff3217" },
  { key: "pendingPayments", label: "Pagamentos pendentes", icon: DollarSign, tone: "#b85c00" },
  { key: "failedDispatches7d", label: "Falhas 7d", icon: AlertTriangle, tone: "#c20f00" },
  { key: "heldCC", label: "Creditos em hold", icon: CreditCard, tone: "#6b5cff" },
  { key: "publishedTestimonials", label: "Depoimentos publicados", icon: MessageSquareQuote, tone: "#087a32" },
  { key: "totalTestimonials", label: "Depoimentos totais", icon: MessageSquareQuote, tone: "#61708a" },
];

export default function AdminSaude() {
  const [, setLocation] = useLocation();
  const health = trpc.admin.health.useQuery();
  const data: any = health.data;
  const cards = data?.cards ?? {};

  return (
    <div
      className="min-h-screen bg-[#f7f9fc]"
      style={{ fontFamily: "Inter, Arial, sans-serif" }}
    >
      <header
        style={{ background: "#011643" }}
        className="px-8 h-16 flex items-center justify-between shadow-lg"
      >
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" theme="dark" hideTagline />
          <span
            className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: "rgba(255,50,23,0.15)", color: "#ff3217" }}
          >
            <Activity className="w-3 h-3 inline mr-1" />
            Saude
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white border border-white/20 hover:bg-white/10"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Painel
          </button>
          <button
            onClick={() => { window.location.href = "/app/"; }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white/70 border border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Plataforma
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-6">
        <section className="rounded-2xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-white/60">
            Operacao Cacarejar
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap mt-2">
            <div>
              <h1 className="text-2xl font-black">Saude operacional</h1>
              <p className="text-sm text-white/72 font-semibold mt-2 max-w-3xl">
                Um painel rapido para enxergar gargalos antes de liberar mais
                usuarios: fila de revisao, creditos, publicacoes, pagamentos e
                custo de operacoes.
              </p>
            </div>
            <button
              onClick={() => health.refetch()}
              className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black hover:bg-[#f8fafc]"
            >
              Atualizar leitura
            </button>
          </div>
        </section>

        {health.isLoading ? (
          <div className="rounded-xl border border-[#e6ebf3] bg-white p-8 text-sm font-black text-[#61708a]">
            Carregando saude operacional...
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-[#ffd0c8] bg-[#fff8f6] p-8 text-sm font-black text-[#c20f00]">
            Banco indisponivel para esta leitura.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cardLabels.map(({ key, label, icon: Icon, tone }) => (
                <div
                  key={key}
                  className="rounded-xl border border-[#e6ebf3] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-lg grid place-items-center"
                      style={{ background: `${tone}16`, color: tone }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-black text-[#61708a]">
                      {label}
                    </p>
                  </div>
                  <p className="text-3xl font-black text-[#071b44] mt-4">
                    {Number(cards[key] ?? 0).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[.9fr_1.1fr] gap-5">
              <div className="rounded-xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
                <h2 className="text-base font-black text-[#071b44]">
                  Alertas
                </h2>
                <div className="space-y-3 mt-4">
                  {(data.alerts ?? []).map((alert: any) => {
                    const ok = alert.level === "ok";
                    return (
                      <div
                        key={`${alert.level}-${alert.title}`}
                        className={`rounded-xl border p-4 ${
                          ok
                            ? "border-[#c9f2d8] bg-[#f2fff7]"
                            : "border-[#ffd0c8] bg-[#fff8f6]"
                        }`}
                      >
                        <p
                          className={`text-sm font-black flex items-center gap-2 ${
                            ok ? "text-[#087a32]" : "text-[#c20f00]"
                          }`}
                        >
                          {ok ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                          {alert.title}
                        </p>
                        <p className="text-xs font-semibold text-[#61708a] mt-1">
                          {alert.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
                <h2 className="text-base font-black text-[#071b44] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#ff3217]" />
                  Operacoes com credito nos ultimos 7 dias
                </h2>
                {(data.operations ?? []).length === 0 ? (
                  <p className="text-sm font-semibold text-[#61708a] mt-4">
                    Nenhum consumo de credito registrado no periodo.
                  </p>
                ) : (
                  <div className="divide-y divide-[#edf1f7] mt-4">
                    {data.operations.map((op: any) => (
                      <div
                        key={`${op.ref}-${op.count}`}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#071b44] truncate">
                            {op.group}
                          </p>
                          <p className="text-xs font-semibold text-[#61708a] truncate">
                            {op.ref}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#071b44]">
                            {op.credits} cc
                          </p>
                          <p className="text-xs font-semibold text-[#61708a]">
                            {op.count} operacao(oes)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
              <p className="text-xs font-bold text-[#61708a]">
                Ultima leitura:{" "}
                {new Date(data.generatedAt).toLocaleString("pt-BR")}
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
