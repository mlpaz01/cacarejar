import { cn } from "@/lib/utils";

type Status = "ativa" | "pausada" | "rascunho" | "concluida" | "arquivada" | "conectado" | "desconectado" | "erro" | "agendado" | "enviado" | "falhou" | "cancelado" | "gerando" | "aprovado" | "rejeitado" | "em_uso" | "pendente" | "aplicado" | "ignorado";

const statusConfig: Record<Status, { label: string; className: string }> = {
  ativa: { label: "Ativa", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  pausada: { label: "Pausada", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  rascunho: { label: "Rascunho", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  concluida: { label: "Concluída", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  arquivada: { label: "Arquivada", className: "bg-slate-600/15 text-slate-500 border-slate-600/30" },
  conectado: { label: "Conectado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  desconectado: { label: "Desconectado", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  erro: { label: "Erro", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  agendado: { label: "Agendado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  enviado: { label: "Enviado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  falhou: { label: "Falhou", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelado: { label: "Cancelado", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  gerando: { label: "Gerando", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rejeitado: { label: "Rejeitado", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  em_uso: { label: "Em uso", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  pendente: { label: "Pendente", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  aplicado: { label: "Aplicado", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  ignorado: { label: "Ignorado", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  );
}
