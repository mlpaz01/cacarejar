import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ShieldCheck, LayoutDashboard, Check, X } from "lucide-react";

const VERDICT: Record<string, { bg: string; color: string; label: string }> = {
  pass: { bg: "#e6f9ef", color: "#0c7a3c", label: "pass" },
  flag: { bg: "#fff3e0", color: "#b85c00", label: "flag" },
  fail: { bg: "#fff0f0", color: "#c42510", label: "fail" },
};

export default function AdminRevisao() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const queue = trpc.admin.reviewQueue.useQuery();
  const [reasonFor, setReasonFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const approve = trpc.admin.approveItem.useMutation({
    onSuccess: () => { toast.success("Aprovado e cliente avisado"); utils.admin.reviewQueue.invalidate(); },
    onError: () => toast.error("Erro ao aprovar"),
  });
  const reject = trpc.admin.rejectItem.useMutation({
    onSuccess: () => { toast.success("Reprovado e cliente avisado"); setReasonFor(null); setReason(""); utils.admin.reviewQueue.invalidate(); },
    onError: () => toast.error("Erro ao reprovar"),
  });

  const checkOf = (checks: any[], reviewer: string) => checks.find(c => c.reviewer === reviewer);

  return (
    <div className="min-h-screen bg-[#f7f9fc]" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      <header style={{ background: "#071b44" }} className="px-8 h-16 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" theme="dark" hideTagline />
          <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(255,50,23,0.15)", color: "#ff3217" }}>
            <ShieldCheck className="w-3 h-3 inline mr-1" />Revisão
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white border border-white/20 hover:bg-white/10">
            <LayoutDashboard className="w-3.5 h-3.5" /> Painel
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8">
        <h1 className="text-xl font-black text-[#070b17] mb-1">Fila de revisão</h1>
        <p className="text-sm text-[#61708a] mb-6">Os agentes avaliaram; só exceções (flag/fail) precisam de decisão humana.</p>

        {queue.isLoading ? (
          <p className="text-sm text-[#61708a]">Carregando…</p>
        ) : !queue.data || queue.data.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-10 text-center">
            <Check className="w-10 h-10 text-[#18b85c] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#070b17]">Fila vazia — tudo revisado! 🐓</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.data.map((ap: any) => (
              <div key={ap.id} className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-black text-[#070b17]">{ap.experiment?.name ?? `Item #${ap.itemId}`}</p>
                    <p className="text-xs text-[#61708a]">{ap.orgName} · modo {ap.reviewMode} · status {ap.reviewStatus}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {["conformidade", "marca", "performance"].map(r => {
                      const c = checkOf(ap.checks, r);
                      const v = c ? VERDICT[c.verdict] : null;
                      return (
                        <span key={r} className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: v?.bg ?? "#eef1f6", color: v?.color ?? "#6b7a90" }} title={c?.notes ?? ""}>
                          {r}: {v?.label ?? "—"}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => approve.mutate({ approvalId: ap.id })}
                    className="text-xs font-black text-white px-4 py-2 rounded-lg flex items-center gap-1.5"
                    style={{ background: "#18b85c" }}
                  >
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => setReasonFor(reasonFor === ap.id ? null : ap.id)}
                    className="text-xs font-black text-[#c42510] border border-[#ffd0c8] px-4 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Reprovar
                  </button>
                  {ap.checks?.find((c: any) => c.notes && c.verdict !== "pass") && (
                    <span className="text-[11px] text-[#b85c00]">
                      {ap.checks.find((c: any) => c.verdict !== "pass")?.notes}
                    </span>
                  )}
                </div>

                {reasonFor === ap.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Motivo da reprovação (o cliente verá)"
                      className="flex-1 border border-[#e6ebf3] rounded-lg px-3 py-2 text-sm bg-[#f6f8fc]"
                    />
                    <button
                      onClick={() => reject.mutate({ approvalId: ap.id, reason })}
                      disabled={reason.length < 2}
                      className="text-xs font-black text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      style={{ background: "#ff3217" }}
                    >
                      Confirmar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
