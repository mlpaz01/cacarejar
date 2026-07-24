import { Link } from "wouter";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Pencil,
  Radar,
  Send,
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
    detail: "perfil, posts e plano",
  },
  {
    id: "radar",
    label: "Radar de mercado",
    href: "/diagnostico",
    icon: Radar,
    detail: "concorrentes e marcas",
  },
  {
    id: "estudio",
    label: "Estudio",
    href: "/estudio",
    icon: Pencil,
    detail: "editar antes de sair",
  },
  {
    id: "publicacao",
    label: "Publicacao",
    href: "/integracoes",
    icon: Send,
    detail: "aprovar e registrar",
  },
  {
    id: "metricas",
    label: "Resultados",
    href: "/metricas",
    icon: BarChart3,
    detail: "medir e aprender",
  },
];

const normalizeJourneyStep = (active: JourneyStepId): JourneyStepId => {
  if (active === "aprovacao") return "publicacao";
  if (active === "campanhas" || active === "acompanhamento") return "metricas";
  return active;
};

export function JourneyGuide({
  active,
  compact = false,
}: {
  active: JourneyStepId;
  compact?: boolean;
}) {
  const normalizedActive = normalizeJourneyStep(active);
  const activeIndex = journeySteps.findIndex(step => step.id === normalizedActive);

  return (
    <section className="bg-white border border-[#e6ebf3] rounded-2xl p-3 shadow-sm mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
            Jornada guiada
          </p>
          <h2 className="text-base font-black text-[#071b44]">
            O proximo clique certo
          </h2>
        </div>
        <span className="rounded-full bg-[#f8fafc] border border-[#e6ebf3] px-3 py-1 text-xs font-black text-[#071b44]">
          Etapa {Math.max(1, activeIndex + 1)} de {journeySteps.length}
        </span>
      </div>

      <div
        className={`grid gap-2 ${compact ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-1 md:grid-cols-3 xl:grid-cols-5"}`}
      >
        {journeySteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.id === normalizedActive;
          const done = index < activeIndex;

          return (
            <Link key={step.id} href={step.href}>
              <a
                className={`rounded-xl border p-2.5 transition-all block ${isActive ? "border-[#ff3217] bg-[#fff1ef]" : done ? "border-[#bfeccb] bg-[#eafff1]" : "border-[#e6ebf3] bg-[#fbfcff] hover:bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? "bg-[#ff3217] text-white" : done ? "bg-[#18b85c] text-white" : "bg-white text-[#61708a] border border-[#e6ebf3]"}`}
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
