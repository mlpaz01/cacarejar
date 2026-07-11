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
  const { data: campaigns } = trpc.campaigns.list.useQuery();
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
  const activeCampaigns = (campaigns ?? []).filter(
    (campaign: any) => campaign.status === "ativa"
  ).length;
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
      action: "Preencha ou restaure o perfil que sera trabalhado nesta semana.",
      text: "Defina negocio, objetivo e canais. Esta etapa cria a prescricao e impede que as outras abas misturem perfis.",
      done: !!diagnosis,
      success: "Perfil ativo e parecer prontos.",
    },
    {
      id: "radar",
      title: "2. Radar",
      action:
        "Rode o Radar e marque quais concorrentes/postagens combinam com o negocio.",
      text: "Esta etapa valida referencias e sinais de mercado. Ela nao gera posts; ela melhora o contexto antes da criacao.",
      done: !!radar && radarFeedbackCount > 0,
      success: "Concorrencia validada com feedback humano.",
    },
    {
      id: "estudio",
      title: "3. Estudio",
      action:
        "Crie ou refine posts, imagens e roteiros de video com base no Diagnostico e no Radar.",
      text: "Este e o unico lugar de criacao. A base vem dos Agentes, mas o usuario ajusta texto, imagem, bastidor, prova, videos verticais e marca a versao humana final.",
      done: editedCreatives > 0,
      success: "Pelo menos um criativo foi humanizado.",
    },
    {
      id: "aprovacao",
      title: "4. Aprovacao",
      action: "Selecione somente os posts que estao prontos para sair.",
      text: "Esta etapa separa ideia de publicacao real. O que nao estiver claro volta para o Estudio.",
      done: approved > 0 || published > 0 || measured > 0,
      success: "Posts finais escolhidos.",
    },
    {
      id: "publicacao",
      title: "5. Publicacao",
      action:
        "Copie legenda, baixe imagem, publique no canal e registre o link.",
      text: "Sem link e resultado, o Cacarejar nao aprende. Publicacao assistida e o controle da execucao semanal.",
      done: published > 0 || measured > 0,
      success: "Conteudo publicado com rastreio.",
    },
    {
      id: "campanhas",
      title: "6. Campanhas",
      action: "Transforme um post com sinal organico em campanha pequena.",
      text: "A verba entra depois do sinal real. Primeiro prova, depois escala com seguranca.",
      done: activeCampaigns > 0,
      success: "Campanha criada a partir de sinal.",
    },
    {
      id: "metricas",
      title: "7. Metricas",
      action:
        "Confira alcance, cliques, leads, vendas e o que merece variacao.",
      text: "Aqui o usuario diferencia gosto pessoal de performance real.",
      done: measured > 0,
      success: "Resultado registrado.",
    },
    {
      id: "acompanhamento",
      title: "8. Acompanhamento",
      action:
        "Rode o check-in e transforme resultado em aprendizado da proxima semana.",
      text: "A jornada fecha quando o que aconteceu vira prescricao melhor para o proximo ciclo.",
      done: !!(diagnosis as any)?.aprendizadoSemanal && measured > 0,
      success: "Aprendizado pronto para repetir o ciclo.",
    },
  ];

  const next = cards.find(card => !card.done) ?? cards[cards.length - 1];
  const nextStep = journeySteps.find(step => step.id === next.id)!;
  const done = cards.filter(card => card.done).length;

  return (
    <AppLayout
      title="Guia de uso"
      subtitle="A jornada guiada do Cacarejar, do perfil ativo ao aprendizado real."
      journeyActive={next.id}
    >
      <section className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="max-w-4xl">
            <p className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Proximo clique certo
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
          title="Regra da jornada"
          icon={ShieldCheck}
          items={[
            "Diagnostico e Radar orientam, mas nao sao telas de criacao.",
            "Crie e edite conteudos no Estudio.",
            "Nao publique sem passar pelo Estudio.",
            "Nao escale campanha sem resultado organico.",
          ]}
        />
        <InfoCard
          title="Videos verticais"
          icon={Clapperboard}
          items={[
            "Videos TikTok fica dentro do Estudio.",
            "Use depois de escolher um post base.",
            "Copie roteiro, cenas e prompt visual.",
            "Depois registre publicacao e resultado.",
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
