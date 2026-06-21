import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, ArrowLeft } from "lucide-react";

const PKG_ORDER = ["boton", "ninhada", "galinheiro", "granja"] as const;

export default function Creditos() {
  const utils = trpc.useUtils();
  const wallet = trpc.credits.wallet.useQuery();
  const ledger = trpc.credits.ledger.useQuery();
  const packages = trpc.credits.packages.useQuery();
  const asaasOn = trpc.credits.asaasOn.useQuery();

  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState<any>(null);
  const planoFromUrl = new URLSearchParams(window.location.search).get("plano");

  const buy = trpc.credits.buyMock.useMutation({
    onSuccess: d => {
      toast.success(`+${d.added} créditos adicionados 🐓`);
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
    },
    onError: () => toast.error("Erro ao comprar créditos"),
  });

  const createPix = trpc.credits.createTopupPix.useMutation({
    onSuccess: d => {
      if (!d.pixPayload && !d.invoiceUrl) {
        toast.error("Não consegui gerar o PIX agora. Tente novamente.");
        return;
      }
      setPix(d);
    },
    onError: e => toast.error(e.message || "Erro ao gerar o PIX"),
  });

  const status = trpc.credits.paymentStatus.useQuery(
    { paymentId: pix?.paymentId ?? 0 },
    { enabled: !!pix, refetchInterval: 4000 }
  );

  useEffect(() => {
    if (pix && status.data?.status === "pago") {
      toast.success("Pagamento confirmado! Créditos liberados 🐓");
      utils.credits.wallet.invalidate();
      utils.credits.ledger.invalidate();
      setPix(null);
    }
  }, [status.data?.status, pix, utils]);

  const w = wallet.data;
  const quotaPct = w && w.dailyQuota > 0 ? Math.min(100, Math.round((w.dailyUsed / w.dailyQuota) * 100)) : 0;
  const usePix = !!asaasOn.data;

  const fmtBRL = (cents: number) => `R$ ${(cents / 100).toFixed(0)}`;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const typeLabel: Record<string, string> = {
    recarga: "Recarga", hold: "Reserva", consumo: "Consumo", estorno: "Estorno", bonus: "Bônus", ajuste: "Ajuste",
  };

  function buyPkg(key: (typeof PKG_ORDER)[number]) {
    if (usePix) createPix.mutate({ pkg: key, cpfCnpj: cpf.trim() || undefined });
    else buy.mutate({ pkg: key });
  }

  function copyPayload() {
    if (!pix?.pixPayload) return;
    navigator.clipboard.writeText(pix.pixPayload).then(() => toast.success("Código PIX copiado!"));
  }

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
        {/* Pacotes / PIX */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
          {!pix ? (
            <>
              {planoFromUrl && packages.data && (packages.data as any)[planoFromUrl] && (
                <div className="mb-4 rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: "#fff8f7", border: "1.5px solid #ff3217" }}>
                  <span className="text-lg">🐓</span>
                  <div>
                    <p className="text-xs font-black text-[#ff3217]">Você escolheu o pacote {(packages.data as any)[planoFromUrl].label}</p>
                    <p className="text-[11px] text-[#61708a] font-semibold">Preencha o CPF/CNPJ abaixo e clique em {fmtBRL((packages.data as any)[planoFromUrl].cents)} para ativar via PIX.</p>
                  </div>
                </div>
              )}
              <h3 className="text-sm font-black text-[#070b17] mb-3">Comprar créditos</h3>
              {usePix && (
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-[#61708a] mb-1">CPF/CNPJ (para a nota do PIX)</label>
                  <input
                    value={cpf}
                    onChange={e => setCpf(e.target.value)}
                    placeholder="Somente números"
                    inputMode="numeric"
                    className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div className="space-y-2.5">
                {packages.data &&
                  PKG_ORDER.map(key => {
                    const p = (packages.data as any)[key];
                    if (!p) return null;
                    const pending = (usePix ? createPix.isPending && createPix.variables?.pkg === key : buy.isPending && buy.variables?.pkg === key);
                    return (
                      <div key={key} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: key === planoFromUrl ? "2px solid #ff3217" : "1px solid #e6ebf3", background: key === planoFromUrl ? "#fff8f7" : undefined }}>
                        <div>
                          <p className="text-sm font-bold text-[#070b17]">
                            {p.label} <span className="text-[#61708a] font-semibold">· {p.cc.toLocaleString("pt-BR")} CC</span>
                          </p>
                        </div>
                        <button
                          onClick={() => buyPkg(key)}
                          disabled={createPix.isPending || buy.isPending}
                          className="text-xs font-black text-white px-4 py-2 rounded-lg disabled:opacity-60 flex items-center gap-2"
                          style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
                        >
                          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          {fmtBRL(p.cents)}
                        </button>
                      </div>
                    );
                  })}
              </div>
              <p className="text-[11px] text-[#61708a] mt-3">
                {usePix
                  ? "💚 Pagamento via PIX. Os créditos entram automaticamente após a confirmação."
                  : "💡 Compra simulada (gateway de pagamento ainda não configurado)."}
              </p>
            </>
          ) : (
            <>
              <button onClick={() => setPix(null)} className="text-xs font-bold text-[#61708a] flex items-center gap-1 mb-3 hover:text-[#070b17]">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos pacotes
              </button>
              <h3 className="text-sm font-black text-[#070b17]">Pague com PIX para liberar {pix.cc?.toLocaleString("pt-BR")} CC</h3>
              <p className="text-xs text-[#61708a] mt-1">{pix.label} · {fmtBRL(pix.valueCents)}</p>

              {pix.pixQrImage && (
                <div className="flex justify-center my-4">
                  <img src={`data:image/png;base64,${pix.pixQrImage}`} alt="QR Code PIX" className="w-52 h-52 border border-[#e6ebf3] rounded-lg" />
                </div>
              )}

              {pix.pixPayload && (
                <div className="mt-2">
                  <p className="text-[11px] font-bold text-[#61708a] mb-1">PIX copia e cola</p>
                  <div className="flex gap-2">
                    <input readOnly value={pix.pixPayload} className="flex-1 border border-[#e6ebf3] rounded-lg px-3 py-2 text-[11px] text-[#22304b] bg-[#f8fafc]" />
                    <button onClick={copyPayload} className="px-3 py-2 rounded-lg bg-[#071b44] text-white text-xs font-black flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </button>
                  </div>
                </div>
              )}

              {pix.invoiceUrl && (
                <a href={pix.invoiceUrl} target="_blank" rel="noreferrer" className="block text-center mt-3 text-xs font-black text-[#ff3217]">
                  Abrir fatura no Asaas →
                </a>
              )}

              <div className="flex items-center justify-center gap-2 mt-4 text-xs font-bold text-[#61708a]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Aguardando pagamento… os créditos entram automaticamente.
              </div>
            </>
          )}
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
                  <span className="text-sm font-black" style={{ color: e.amountCC >= 0 ? "#18b85c" : "#ff3217" }}>
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
