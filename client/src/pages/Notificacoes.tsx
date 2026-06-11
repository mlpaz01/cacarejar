import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck } from "lucide-react";

const ICON: Record<string, string> = {
  aprovado: "✅", reprovado: "⚠️", aprovacao_recebida: "📨",
  ovo_de_ouro: "🥚", saldo_baixo: "🐓", default: "🔔",
};

export default function Notificacoes() {
  const utils = trpc.useUtils();
  const list = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const fmt = (d: string | Date) =>
    new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <AppLayout
      title="Notificações"
      subtitle="Avisos sobre suas campanhas"
      actions={
        <button
          onClick={() => markRead.mutate({})}
          className="text-xs font-bold text-[#61708a] hover:text-[#ff3217] flex items-center gap-1.5"
        >
          <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
        </button>
      }
    >
      {list.isLoading ? (
        <p className="text-sm text-[#61708a]">Carregando…</p>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e6ebf3] p-10 text-center shadow-sm">
          <Bell className="w-10 h-10 text-[#c7cdd8] mx-auto mb-3" />
          <p className="text-sm font-bold text-[#070b17]">Nenhuma notificação ainda</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm divide-y divide-[#e6ebf3]">
          {list.data.map((n: any) => (
            <button
              key={n.id}
              onClick={() => !n.readAt && markRead.mutate({ id: n.id })}
              className="w-full text-left flex items-start gap-3 p-4 hover:bg-[#fafbfd] transition-colors"
              style={{ background: n.readAt ? "#fff" : "#fff8f7" }}
            >
              <span className="text-xl leading-none mt-0.5">{ICON[n.type] ?? ICON.default}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#070b17]">{n.title}</p>
                {n.body && <p className="text-xs text-[#61708a] mt-0.5 leading-snug">{n.body}</p>}
                <p className="text-[10px] text-[#a0aec0] mt-1">{fmt(n.createdAt)}</p>
              </div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-[#ff3217] mt-2" />}
            </button>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
