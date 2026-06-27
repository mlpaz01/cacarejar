import { Link } from "wouter";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Megaphone,
  Pencil,
  Radar,
  Send,
  TrendingUp,
} from "lucide-react";

export type JourneyStepId =
  | "diagnostico"
  | "radar"
  | "estudio"
  | "aprovacao"
  | "publicacao"
  | "campanhas"
  | "metricas"
  | "acompanhamento";

export const journeySteps: Array<{
  id: JourneyStepId;
  label: string;
  href: string;
  icon: any;
  detail: string;
}> = [
  {
    id: "diagnostico",
    label: "Diagnostico",
    href: "/diagnostico",
    icon: FileText,
    detail: "Perfil e prescricao",
  },
  {
    id: "radar",
    label: "Radar",
    href: "/radar",
    icon: Radar,
    detail: "Concorrencia e feedback",
  },
  {
    id: "estudio",
    label: "Estudio",
    href: "/criativos",
    icon: Pencil,
    detail: "Toque humano",
  },
  {
    id: "aprovacao",
    label: "Aprovacao",
    href: "/aprovacao",
    icon: ClipboardCheck,
    detail: "Posts finais",
  },
  {
    id: "publicacao",
    label: "Publicacao",
    href: "/integracoes",
    icon: Send,
    detail: "Publicar e registrar",
  },
  {
    id: "campanhas",
    label: "Campanhas",
    href: "/campanhas",
    icon: Megaphone,
    detail: "Escalar vencedor",
  },
  {
    id: "metricas",
    label: "Metricas",
    href: "/metricas",
    icon: BarChart3,
    detail: "Resultado real",
  },
  {
    id: "acompanhamento",
    label: "Acompanhamento",
    href: "/recalibracao",
    icon: TrendingUp,
    detail: "Aprender e repetir",
  },
];

export function JourneyGuide({
  active,
  compact = false,
}: {
  active: JourneyStepId;
  compact?: boolean;
}) {
  const activeIndex = journeySteps.findIndex(step => step.id === active);

  return (
    <section className="bg-white border border-[#e6ebf3] rounded-2xl p-4 shadow-sm mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
            Jornada guiada
          </p>
          <h2 className="text-lg font-black text-[#071b44]">
            Da estrategia ao aprendizado
          </h2>
        </div>
        <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
          Etapa {Math.max(1, activeIndex + 1)} de {journeySteps.length}
        </span>
      </div>

      <div
        className={`grid gap-2 ${compact ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" : "grid-cols-1 md:grid-cols-4 xl:grid-cols-8"}`}
      >
        {journeySteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === active;
          const done = index < activeIndex;

          return (
            <Link key={step.id} href={step.href}>
              <a
                className={`rounded-xl border p-3 transition-all block ${isActive ? "border-[#ff3217] bg-[#fff1ef]" : done ? "border-[#bfeccb] bg-[#eafff1]" : "border-[#e6ebf3] bg-[#fbfcff] hover:bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? "bg-[#ff3217] text-white" : done ? "bg-[#18b85c] text-white" : "bg-white text-[#61708a] border border-[#e6ebf3]"}`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#071b44] truncate">
                      {step.label}
                    </p>
                    <p className="text-[10px] font-bold text-[#61708a] truncate">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </a>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
