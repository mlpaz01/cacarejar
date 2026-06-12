import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, Inbox, ShieldCheck, Coins, TrendingUp, Check, Pencil, Layers3, Send } from "lucide-react";

const BUDGETS = [
  { cents: 2000, label: "Conservador", note: "R$ 20/dia" },
  { cents: 3000, label: "Recomendado", note: "R$ 30/dia" },
  { cents: 6000, label: "Acelerado", note: "R$ 60/dia" },
] as const;

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const channelLabel = (channels?: string[] | null, fallback?: string) => {
  const c = String(channels?.[0] || fallback || "meta").toLowerCase();
  if (c.includes("linkedin")) return "LinkedIn";
  if (c.includes("tiktok")) return "TikTok";
  if (c.includes("google")) return "Google / SEO";
  if (c.includes("instagram")) return "Instagram";
  return "Meta Ads";
};
const originLabel = (c: any) => {
  const meta = c?.generationMeta ?? {};
  if (meta.fonte) return "Radar de Mercado";
  if (meta.canal) return "Diagnostico por canal";
  if (c?.experimentId) return "Conteudo em teste";
  return "Estudio";
};

export default function Aprovacao() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const pending = trpc.approvals.pendingForClient.useQuery();
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [budgetByExp, setBudgetByExp] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!pending.data?.length) return;
    setSel(prev => {
      const next = { ...prev };
      for (const exp of pending.data as any[]) {
        for (const v of exp.variants ?? []) if (next[v.id] === undefined) next[v.id] = true;
      }
      return next;
    });
    setBudgetByExp(prev => {
      const next = { ...prev };
      for (const exp of pending.data as any[]) {
        if (next[exp.id] === undefined) next[exp.id] = exp.budgetDailyCents || 3000;
      }
      return next;
    });
  }, [pending.data]);

  const approve = trpc.approvals.clientApprove.useMutation({
    onSuccess: () => {
      toast.success("Aprovado! Os Agentes vão revisar e colocar no ar.");
      setSel({});
      utils.approvals.pendingForClient.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onError: e => toast.error(e.message || "Erro ao aprovar"),
  });

  return (
    <AppLayout title="Revisar e publicar" subtitle="A última conferência antes dos Agentes colocarem dinheiro em mídia.">
      {pending.isLoading ? (
        <p className="text-sm text-[#61708a]">Carregando...</p>
      ) : !pending.data || pending.data.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-10 text-center shadow-sm">
          <Inbox className="w-10 h-10 text-[#c7cdd8] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#070b17]">Nada para publicar agora</p>
          <p className="text-xs text-[#61708a] mt-1">Escolha posts no Diagnóstico e envie para aprovação.</p>
        </div>
      ) : (
        pending.data.map((exp: any) => {
          const selectedIds = exp.variants.filter((v: any) => sel[v.id]).map((v: any) => v.id);
          const budgetDailyCents = budgetByExp[exp.id] ?? 3000;
          const channels = Array.from(new Set(exp.variants.map((v: any) => channelLabel(v.creative?.channels, exp.channel))));
          const origins = Array.from(new Set(exp.variants.map((v: any) => originLabel(v.creative))));
          return (
            <div key={exp.id} className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h3 className="text-base font-black text-[#070b17]">{exp.name}</h3>
                  <p className="text-xs text-[#61708a] mt-1">
                    {selectedIds.length} de {exp.variants.length} posts selecionados para revisao final.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f6f8fc] border border-[#e6ebf3] px-3 py-1 text-[10px] font-black text-[#071b44]"><Layers3 className="w-3 h-3" /> {channels.join(" + ")}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1ef] border border-[#ffd0c8] px-3 py-1 text-[10px] font-black text-[#ff3217]"><Send className="w-3 h-3" /> {origins.join(" + ")}</span>
                  </div>
                </div>
                <button
                  disabled={selectedIds.length === 0 || approve.isPending}
                  onClick={() => approve.mutate({ experimentId: exp.id, variantIds: selectedIds, budgetDailyCents })}
                  className="btn-action-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Aprovar e publicar
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs font-black text-[#071b44]">Posts que entram no teste</p>
                    <button
                      onClick={() => {
                        const allSelected = selectedIds.length === exp.variants.length;
                        setSel(s => {
                          const next = { ...s };
                          for (const v of exp.variants) next[v.id] = !allSelected;
                          return next;
                        });
                      }}
                      className="text-[11px] font-black text-[#ff3217] hover:underline"
                    >
                      {selectedIds.length === exp.variants.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exp.variants.map((v: any) => {
                      const c = v.creative ?? {};
                      const on = !!sel[v.id];
                      return (
                        <div
                          key={v.id}
                          className="text-left rounded-xl overflow-hidden border-2 transition-all bg-white"
                          style={{ borderColor: on ? "#18b85c" : "#e6ebf3", boxShadow: on ? "0 6px 18px rgba(24,184,92,.13)" : "none" }}
                        >
                          <div className="relative">
                            <img src={c.imageUrl} alt="" className="w-full aspect-[16/10] object-cover bg-[#f6f8fc]" />
                            <span
                            className="absolute top-2 right-2 h-7 rounded-lg flex items-center gap-1 px-2 text-[10px] font-black"
                            style={{ background: on ? "#18b85c" : "rgba(255,255,255,.92)", color: on ? "#fff" : "#61708a", border: on ? "none" : "1px solid #e6ebf3" }}
                            >
                              {on && <Check className="w-3 h-3" />} {on ? "Aprovado" : "Nao usar"}
                            </span>
                          </div>
                          <div className="p-3 bg-white">
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              <span className="text-[9px] font-black text-[#071b44] bg-[#eef4ff] border border-[#dbe8ff] rounded px-1.5 py-0.5">{channelLabel(c.channels, exp.channel)}</span>
                              <span className="text-[9px] font-black text-[#ff3217] bg-[#fff1ef] border border-[#ffd0c8] rounded px-1.5 py-0.5">{originLabel(c)}</span>
                            </div>
                            <p className="text-xs text-[#22304b] font-semibold leading-snug min-h-[116px] line-clamp-8">{c.copy}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {c.lente && <Tag>{c.lente}</Tag>}
                              {c.formato && <Tag>{c.formato}</Tag>}
                              {c.pilar && <Tag>{c.pilar}</Tag>}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button type="button" onClick={() => setSel(s => ({ ...s, [v.id]: true }))}
                                className="text-[11px] font-black rounded-lg border py-2 flex items-center justify-center gap-1.5"
                                style={{ background: on ? "#18b85c" : "#fff", color: on ? "#fff" : "#071b44", borderColor: on ? "#18b85c" : "#e6ebf3" }}>
                                <Check className="w-3.5 h-3.5" /> Aprovar
                              </button>
                              <button type="button" onClick={() => setSel(s => ({ ...s, [v.id]: false }))}
                                className="text-[11px] font-black rounded-lg border py-2 flex items-center justify-center"
                                style={{ background: !on ? "#fff1ef" : "#fff", color: !on ? "#c20f00" : "#61708a", borderColor: !on ? "#ffd0c8" : "#e6ebf3" }}>
                                Nao usar
                              </button>
                            </div>
                            {c.id && (
                              <button type="button" onClick={() => navigate(`/criativos/${c.id}`)}
                                className="mt-2 w-full text-[11px] font-black text-[#071b44] border border-[#e6ebf3] rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-[#f6f8fc]">
                                <Pencil className="w-3 h-3" /> Editar / regerar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="rounded-xl border border-[#e6ebf3] bg-[#fbfcff] p-4 h-fit">
                  <h4 className="text-sm font-black text-[#070b17] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[#ff3217]" /> Verba diária
                  </h4>
                  <p className="text-[11px] text-[#61708a] mt-1">
                    Esse é o teto que pode ser investido por dia neste teste.
                  </p>
                  <div className="grid grid-cols-1 gap-2 mt-3">
                    {BUDGETS.map(b => {
                      const active = budgetDailyCents === b.cents;
                      return (
                        <button
                          key={b.cents}
                          onClick={() => setBudgetByExp(prev => ({ ...prev, [exp.id]: b.cents }))}
                          className="rounded-lg border px-3 py-2 text-left transition-colors"
                          style={{ borderColor: active ? "#ff3217" : "#e6ebf3", background: active ? "#fff1ef" : "#fff" }}
                        >
                          <span className="text-xs font-black text-[#071b44]">{b.label}</span>
                          <span className="block text-[11px] font-bold text-[#61708a]">{b.note}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="block mt-3 text-[10px] font-black text-[#61708a] uppercase">Outro valor diário</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-[#071b44]">R$</span>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={Math.round(budgetDailyCents / 100)}
                      onChange={e => {
                        const reais = Math.max(10, Math.min(Number(e.target.value || 0), 1000));
                        setBudgetByExp(prev => ({ ...prev, [exp.id]: reais * 100 }));
                      }}
                      className="w-full border border-[#e6ebf3] rounded-lg px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-[#ff3217]"
                    />
                  </div>
                  <div className="mt-4 rounded-lg bg-[#071b44] text-white p-3">
                    <p className="text-xs font-black flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#ff8a72]" /> Como a verba é dividida?</p>
                    <p className="text-[11px] leading-relaxed mt-1 text-white/85">
                      No começo, os {selectedIds.length || 0} posts recebem partes iguais de {brl(budgetDailyCents)}/dia. Depois, o motor mede resultado e puxa mais verba para o post vencedor, mantendo um piso de teste para os outros.
                    </p>
                  </div>
                  <div className="mt-3 rounded-lg bg-white border border-[#e6ebf3] p-3">
                    <p className="text-xs font-black text-[#071b44] flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#18b85c]" /> Para que serve aprovar?</p>
                    <p className="text-[11px] text-[#61708a] leading-relaxed mt-1">
                      É sua autorização final de conteúdo e verba. Depois disso, os Agentes revisam marca, política e performance antes de colocar no ar.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          );
        })
      )}
    </AppLayout>
  );
}

function Tag({ children }: any) {
  return (
    <span className="text-[9px] font-bold text-[#61708a] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}
