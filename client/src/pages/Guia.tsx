import { AppLayout } from "@/components/AppLayout";
import { journeySteps } from "@/components/JourneyGuide";
import type { JourneyStepId } from "@/components/JourneyGuide";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  ClipboardCheck,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";

export default function Guia() {
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const { data: radar } = trpc.radar.get.useQuery();
  const { data: creatives } = trpc.creatives.list.useQuery({
    campaignId: undefined,
  });

  const planItems = ((diagnosis as any)?.plano7Dias ?? []) as any[];
  const approved = planItems.filter(
    (item: any) => item.status === "aprovado"
  ).length;
  const published = planItems.filter((item: any) =>
    ["publicado", "medir"].includes(item.status)
  ).length;
  const measured = planItems.filter((item: any) => item.resultado).length;
  const learningDone =
    !!(diagnosis as any)?.aprendizadoSemanal ||
    (((diagnosis as any)?.acompanhamento?.feedbacks ?? []) as any[]).length >
      0;
  const radarFeedbackCount =
    ((radar as any)?.feedback?.likedPostKeys?.length ?? 0) +
    ((radar as any)?.feedback?.dislikedPostKeys?.length ?? 0);
  const editedCreatives =
    (creatives ?? []).filter((creative: any) => {
      const meta = creative.generationMeta ?? {};
      return (
        meta?.humanReview?.finalVersion ||
        meta?.humanReview?.score >= 4 ||
        creative.status === "aprovado"
      );
    }).length || planItems.filter((item: any) => item.creativeId).length;

  const cards: Array<{
    id: JourneyStepId;
    title: string;
    action: string;
    text: string;
    done: boolean;
    success: string;
  }> = [
    {
      id: "diagnostico",
      title: "1. Diagnostico",
      action: "Escolha o perfil e deixe os Agentes entenderem o negocio.",
      text: "Ao concluir, voce ja ve posts fortes do proprio perfil, uma primeira leitura e referencias de mercado para validar.",
      done: !!diagnosis,
      success: "Perfil ativo pronto para orientar todo o resto.",
    },
    {
      id: "radar",
      title: "2. Referencias",
      action:
        "Marque Gostei ou Nao gostei nos posts e perfis encontrados.",
      text: "Esse clique ensina o criterio humano: o que parece concorrente, inspiracao ou caminho errado para este negocio.",
      done: !!radar && radarFeedbackCount > 0,
      success: "Referencias validadas com criterio humano.",
    },
    {
      id: "estudio",
      title: "3. Estudio",
      action:
        "Veja as sugestoes e ajuste texto, imagem e bastidor antes de aprovar.",
      text: "O Estudio e o lugar oficial de criacao. Diagnostico e referencias orientam; aqui a pessoa da o toque humano.",
      done: editedCreatives > 0,
      success: "Pelo menos um criativo foi humanizado.",
    },
    {
      id: "publicacao",
      title: "4. Publicacao",
      action: "Aprove, publique no canal e registre o link.",
      text: "Sem registro, a plataforma nao aprende. Esta etapa fecha a execucao da semana.",
      done: approved > 0 || published > 0 || measured > 0,
      success: "Conteudo publicado com rastreio.",
    },
    {
      id: "metricas",
      title: "5. Resultados",
      action:
        "Informe o que aconteceu e deixe os Agentes aprenderem para o proximo ciclo.",
      text: "Aqui gosto pessoal vira dado. A proxima semana nasce do que trouxe conversa, lead ou venda.",
      done: measured > 0 || learningDone,
      success: "Resultado registrado e pronto para virar aprendizado.",
    },
  ];

  const next = cards.find(card => !card.done) ?? cards[cards.length - 1];
  const nextStep = journeySteps.find(step => step.id === next.id)!;
  const done = cards.filter(card => card.done).length;

  return (
    <AppLayout
      title="Guia de uso"
      subtitle="Um caminho simples: entender, escolher referencias, editar, publicar e medir."
      journeyActive={next.id}
    >
      <section className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="max-w-4xl">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Sem treinamento
            </p>
            <h2 className="text-3xl font-black mt-2">{next.title}</h2>
            <p className="text-base text-white/85 mt-3 leading-relaxed">
              {next.action}
            </p>
            <p className="text-sm text-white/62 mt-2 leading-relaxed">
              {next.text}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-4 min-w-[170px]">
            <p className="text-xs font-black text-white/60 uppercase">
              Jornada
            </p>
            <p className="text-3xl font-black mt-1">
              {done}/{cards.length}
            </p>
          </div>
        </div>
        <Link href={nextStep.href}>
          <a className="mt-5 rounded-xl bg-white text-[#071b44] px-5 py-3 text-sm font-black inline-flex items-center gap-2 hover:bg-[#f6f8fc]">
            {nextStep.label === "Estudio"
              ? "Abrir Estudio"
              : `Abrir ${nextStep.label}`}{" "}
            <ArrowRight className="w-4 h-4" />
          </a>
        </Link>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map(card => {
          const step = journeySteps.find(item => item.id === card.id)!;
          const Icon = step.icon;
          const isNext = card.id === next.id;
          return (
            <Link key={card.id} href={step.href}>
              <a
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors min-h-[230px] flex flex-col ${
                  isNext
                    ? "border-[#ff3217] bg-[#fff8f6]"
                    : "border-[#e6ebf3] hover:border-[#071b44]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl grid place-items-center ${
                      card.done
                        ? "bg-[#eafff1] text-[#087a32]"
                        : isNext
                          ? "bg-[#ff3217] text-white"
                          : "bg-[#fff1ef] text-[#ff3217]"
                    }`}
                  >
                    {card.done ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase rounded-full px-2.5 py-1 ${
                      card.done
                        ? "bg-[#eafff1] text-[#087a32]"
                        : isNext
                          ? "bg-[#ff3217] text-white"
                          : "bg-[#fff1ef] text-[#8f2014]"
                    }`}
                  >
                    {card.done ? "feito" : isNext ? "agora" : "aguarde"}
                  </span>
                </div>
                <h3 className="text-lg font-black text-[#071b44] mt-4">
                  {card.title}
                </h3>
                <p className="text-sm font-bold text-[#22304b] leading-snug mt-2">
                  {card.action}
                </p>
                <p className="text-xs text-[#61708a] leading-relaxed mt-2 flex-1">
                  {card.done ? card.success : card.text}
                </p>
                <span className="text-xs font-black text-[#ff3217] inline-flex items-center gap-1 mt-4">
                  Ir para etapa <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            </Link>
          );
        })}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <InfoCard
          title="Regra simples"
          icon={ShieldCheck}
          items={[
            "Diagnostico entende o perfil.",
            "Referencias ensinam o criterio.",
            "Estudio cria e humaniza.",
            "Resultados melhoram a proxima semana.",
          ]}
        />
        <InfoCard
          title="Quando quiser video"
          icon={Clapperboard}
          items={[
            "Entre pelo Estudio.",
            "Escolha um post base.",
            "Use o roteiro vertical.",
            "Registre o resultado depois.",
          ]}
        />
        <InfoCard
          title="Como saber se deu certo"
          icon={MousePointerClick}
          items={[
            "1 perfil ativo sem mistura.",
            "1 concorrente validado no Radar.",
            "1 post humanizado e publicado.",
            "1 resultado registrado.",
          ]}
        />
        <InfoCard
          title="Padrao minimo"
          icon={ClipboardCheck}
          items={[
            "Texto com detalhe real.",
            "Imagem coerente com a marca.",
            "CTA claro.",
            "Check-in feito em ate 48h.",
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
