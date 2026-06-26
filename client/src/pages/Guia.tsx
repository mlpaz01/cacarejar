import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Megaphone,
  MousePointerClick,
  Pencil,
  Radar,
  RefreshCw,
} from "lucide-react";

export default function Guia() {
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const planItems = ((diagnosis as any)?.plano7Dias ?? []) as any[];
  const measured = planItems.filter(
    (item: any) =>
      item.resultado || ["publicado", "medir"].includes(item.status)
  );
  const approved = planItems.filter(
    (item: any) => item.status === "aprovado"
  ).length;
  const activeCampaigns = (campaigns ?? []).filter(
    (c: any) => c.status === "ativa"
  ).length;

  const steps = [
    {
      title: "1. Perfil certo",
      text: "Crie ou restaure o negocio que vai receber atencao nesta semana.",
      href: "/diagnostico",
      icon: FileText,
      done: !!diagnosis,
    },
    {
      title: "2. Radar vivo",
      text: "Use sinais do mercado para evitar conteudo que nasce só de palpite.",
      href: "/radar",
      icon: Radar,
      done: !!(diagnosis as any)?.radarImpacto,
    },
    {
      title: "3. Estudio humano",
      text: "Abra os posts, ajuste copy/imagem e marque a versao humana final.",
      href: "/criativos",
      icon: Pencil,
      done: approved > 0 || measured.length > 0,
    },
    {
      title: "4. Aprovar e publicar",
      text: "Aprove os melhores posts e publique com registro em Integracoes.",
      href: "/integracoes",
      icon: ClipboardCheck,
      done: measured.length > 0,
    },
    {
      title: "5. Campanha pequena",
      text: "Transforme o vencedor organico em campanha de baixo risco.",
      href: "/campanhas",
      icon: Megaphone,
      done: activeCampaigns > 0,
    },
    {
      title: "6. Aprender",
      text: "Registre resultados e rode o acompanhamento para recalibrar a proxima semana.",
      href: "/recalibracao",
      icon: RefreshCw,
      done: measured.length > 0,
    },
  ];
  const done = steps.filter(step => step.done).length;

  return (
    <AppLayout
      title="Guia de uso"
      subtitle="Roteiro simples para usar o Cacarejar sem acompanhamento individual."
    >
      <section className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Onboarding guiado
            </p>
            <h2 className="text-2xl font-black mt-2">
              Uma semana inteira, do diagnostico ao aprendizado
            </h2>
            <p className="text-sm text-white/75 mt-3 max-w-3xl">
              Este guia existe para o usuario novo saber o que fazer em seguida
              e para voce testar seus negocios com o mesmo padrao.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-4 min-w-[150px]">
            <p className="text-xs font-black text-white/60 uppercase">
              Progresso
            </p>
            <p className="text-3xl font-black mt-1">
              {done}/{steps.length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {steps.map(step => {
          const Icon = step.icon;
          return (
            <Link key={step.title} href={step.href}>
              <a className="rounded-2xl border border-[#e6ebf3] bg-white p-5 shadow-sm hover:border-[#071b44] transition-colors min-h-[180px] flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl grid place-items-center ${step.done ? "bg-[#eafff1] text-[#087a32]" : "bg-[#fff1ef] text-[#ff3217]"}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase rounded-full px-2.5 py-1 ${step.done ? "bg-[#eafff1] text-[#087a32]" : "bg-[#fff1ef] text-[#8f2014]"}`}
                  >
                    {step.done ? "feito" : "pendente"}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#071b44] mt-4">
                  {step.title}
                </h3>
                <p className="text-sm text-[#61708a] leading-relaxed mt-2 flex-1">
                  {step.text}
                </p>
                <span className="text-xs font-black text-[#ff3217] inline-flex items-center gap-1 mt-4">
                  Abrir etapa <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InfoCard
          title="Como saber se deu certo"
          icon={MousePointerClick}
          items={[
            "1 post publicado",
            "1 resultado registrado",
            "1 aprendizado gerado",
            "1 proxima acao clara",
          ]}
        />
        <InfoCard
          title="Erros comuns"
          icon={ClipboardCheck}
          items={[
            "Trocar de perfil no meio da semana",
            "Aprovar sem editar",
            "Publicar sem registrar link",
            "Escalar campanha sem sinal real",
          ]}
        />
        <InfoCard
          title="Padrao minimo"
          icon={CheckCircle2}
          items={[
            "Texto com detalhe real",
            "Imagem coerente com a marca",
            "CTA claro",
            "Resultado salvo em ate 48h",
          ]}
        />
      </section>
    </AppLayout>
  );
}

function InfoCard({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: any;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black text-[#071b44] flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#ff3217]" /> {title}
      </h3>
      <div className="space-y-2 mt-4">
        {items.map(item => (
          <p
            key={item}
            className="text-sm text-[#22304b] font-semibold leading-snug"
          >
            - {item}
          </p>
        ))}
      </div>
    </div>
  );
}
