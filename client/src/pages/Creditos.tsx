import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const PKG_ORDER = ["boton", "ninhada", "galinheiro", "granja"] as const;

export default function Creditos() {
  const utils = trpc.useUtils();
  const wallet = trpc.credits.wallet.useQuery();
  const ledger = trpc.credits.ledger.useQuery();
  const packages = trpc.credits.packages.useQuery();

  const buy = trpc.credits.buyMock.useMutation({
    onSuccess: d => {
      toast.success(`+${d.added} créditos adicionados 🐓`);
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
    },
    onError: () => toast.error("Erro ao comprar créditos"),
  });

  const w = wallet.data;
  const quotaPct = w && w.dailyQuota > 0 ? Math.min(100, Math.round((w.dailyUsed / w.dailyQuota) * 100)) : 0;

  const fmtBRL = (cents: number) => `R$ ${(cents / 100).toFixed(0)}`;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const typeLabel: Record<string, string> = {
    recarga: "Recarga", hold: "Reserva", consumo: "Consumo", estorno: "Estorno", bonus: "Bônus", ajuste: "Ajuste",
  };

  return (
    <AppLayout title="Carteira de créditos" subtitle="Seus créditos de IA (CC) para o estúdio de criação">
      {/* Saldo + cota */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <p className="text-xs font-bold text-[#61708a] mb-1">Saldo disponível</p>
          <p className="text-3xl font-black text-[#070b17]">
            {wallet.isLoading ? "…" : (w?.balanceCC ?? 0).toLocaleString("pt-BR")}{" "}
            <span className="text-base text-[#ff3217]">CC</span>
          </p>
          {!!w?.heldCC && <p className="text-[11px] text-[#61708a] mt-1">{w.heldCC} CC reservados</p>}
        </div>
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#61708a]">Cota diária do estúdio</p>
            <p className="text-xs font-black text-[#070b17]">
              {w?.dailyUsed ?? 0} / {w?.dailyQuota ? w.dailyQuota : "∞"} CC
            </p>
          </div>
          <div className="h-2.5 bg-[#f6f8fc] rounded-full mt-3 overflow-hidden">
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${quotaPct}%`, background: quotaPct > 85 ? "#ff3217" : "#18b85c" }}
            />
          </div>
          <p className="text-[11px] text-[#61708a] mt-2">
            A cota protege contra consumo excessivo. Pacotes avulsos não respeitam a cota diária.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pacotes */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#070b17] mb-3">Comprar créditos</h3>
          <div className="space-y-2.5">
            {packages.data &&
              PKG_ORDER.map(key => {
                const p = (packages.data as any)[key];
                if (!p) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between border border-[#e6ebf3] rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#070b17]">
                        {p.label} <span className="text-[#61708a] font-semibold">· {p.cc.toLocaleString("pt-BR")} CC</span>
                      </p>
                    </div>
                    <button
                      onClick={() => buy.mutate({ pkg: key })}
                      disabled={buy.isPending}
                      className="text-xs font-black text-white px-4 py-2 rounded-lg disabled:opacity-60 flex items-center gap-2"
                      style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
                    >
                      {buy.isPending && buy.variables?.pkg === key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      {fmtBRL(p.cents)}
                    </button>
                  </div>
                );
              })}
          </div>
          <p className="text-[11px] text-[#61708a] mt-3">
            💡 Compra simulada nesta fase (Sprint 1). O checkout real via Asaas entra no Sprint 6.
          </p>
        </div>

        {/* Histórico */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          <h3 className="text-sm font-black text-[#070b17] mb-3">Histórico</h3>
          {ledger.isLoading ? (
            <p className="text-sm text-[#61708a]">Carregando…</p>
          ) : ledger.data && ledger.data.length > 0 ? (
            <div className="divide-y divide-[#e6ebf3]">
              {ledger.data.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#070b17]">{typeLabel[e.type] ?? e.type}</p>
                    <p className="text-[10px] text-[#61708a]">{e.description ?? ""} · {fmtDate(e.createdAt)}</p>
                  </div>
                  <span
                    className="text-sm font-black"
                    style={{ color: e.amountCC >= 0 ? "#18b85c" : "#ff3217" }}
                  >
                    {e.amountCC >= 0 ? "+" : ""}
                    {e.amountCC} CC
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#61708a]">Sem movimentações ainda.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
