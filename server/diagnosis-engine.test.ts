import { describe, expect, it } from "vitest";
import {
  buildAssistedCampaign,
  buildOrganicEngine,
  buildSevenDayPlan,
  buildWeeklyLearning,
  enhancePlanV2,
  type CacaPlan,
  type PostIdea,
} from "./services/diagnosis";

const brandDNA = {
  paleta: ["#071b44", "#ff3217", "#f8fafc"],
  tipografia: "Sans-serif bold",
  estiloFoto: "Foto real com produto e pessoa",
  motivos: ["produto real", "bastidor humano"],
  tom: "direto, caloroso e util",
  resumoVisual: "A marca deve parecer humana, fresca e com produto real em primeiro plano.",
};

const postIdeas: PostIdea[] = [
  {
    titulo: "O ritual do acai bem montado",
    pilar: "Desejo e produto",
    formato: "reels",
    angulo: "desejo",
    gancho: "O acai que muda a pausa da tarde",
    copy: "Mostre a montagem real, textura e toppings, fechando com convite para pedir.",
    hashtags: ["#acai", "#delivery"],
    cta: "Pedir pelo WhatsApp",
    visualPrompt: "Realistic vertical video frame of a Brazilian acai bowl, human hands, vibrant toppings.",
  },
  {
    titulo: "Erro comum no acai",
    pilar: "Educacao",
    formato: "carrossel",
    angulo: "dor",
    gancho: "O detalhe que faz o acai perder sabor",
    copy: "Explique um erro comum e mostre como a marca resolve no preparo.",
    hashtags: ["#alimentacao", "#acai"],
    cta: "Salvar para lembrar",
    visualPrompt: "Editorial carousel cover with acai bowl and concise bold typography.",
  },
  {
    titulo: "Bastidor da loja",
    pilar: "Prova e bastidor",
    formato: "imagem",
    angulo: "transformacao",
    gancho: "Por tras de um copo perfeito",
    copy: "Mostre bastidor real, cuidado e padrao de qualidade.",
    hashtags: ["#bastidores", "#acai"],
    cta: "Chamar no direct",
    visualPrompt: "Real store kitchen, acai preparation, natural light, authentic brand colors.",
  },
  {
    titulo: "Oferta da semana",
    pilar: "Oferta",
    formato: "imagem",
    angulo: "desejo",
    gancho: "Hoje e dia de acai sem complicar",
    copy: "Apresente uma oferta simples com prova visual e CTA direto.",
    hashtags: ["#promocao", "#acai"],
    cta: "Pedir agora",
    visualPrompt: "Clean product photo of acai combo with direct offer and warm light.",
  },
];

const basePlan = {
  produto: "Gud Gud Acai",
  nicho: "alimentacao & gastronomia",
  sumarioExecutivo: "Perfil de acai com potencial para transformar desejo visual em pedidos no WhatsApp.",
  resumo: "Acai artesanal com foco em delivery.",
  brandDNA,
  postIdeas,
  pilaresConteudo: ["Produto real", "Bastidores", "Prova social", "Oferta"],
  profile: {
    handle: "gudgudacai",
    bio: "Acai artesanal com pedidos pelo WhatsApp. Clientes reais e montagem caprichada todos os dias.",
    followers: 2658,
  },
} satisfies Partial<CacaPlan>;

const radar = {
  marketSummary: "Videos de preparo real e bastidores estao gerando mais salvamentos no nicho.",
  ideas: [
    {
      diagnosisDecision: "use",
      titulo: "O acai montado em 15 segundos",
      gancho: "O sinal quente: textura vende antes do preco",
      copy: "Mostre a montagem em tempo real, feche com uma pergunta e CTA para pedido.",
      cta: "Quero esse hoje",
      hashtags: ["#acai", "#fooddelivery"],
      creativeDirection: "Close real do produto, mao humana e luz natural.",
      visualPrompt: "Close-up of acai texture, toppings, real hand, vertical social video.",
    },
  ],
  hits: [{ caption: "Montagem real do acai", hotScore: 88 }],
};

describe("diagnosis growth engine", () => {
  it("gera um plano de 7 dias com checklist humano e sinal do Radar", () => {
    const items = buildSevenDayPlan(basePlan, radar) ?? [];

    expect(items).toHaveLength(7);
    expect(new Set(items.map((item) => item.dia))).toHaveLength(7);
    expect(items[0].checklistHumano.join(" ")).toContain("detalhe real");
    expect(items[3].origem).toBe("Radar de Mercado");
    expect(items[3].gancho).toContain("textura vende");
    expect(items[6].formato).toBe("check-in");
  });

  it("transforma resultados manuais em aprendizado semanal acionavel", () => {
    const items = buildSevenDayPlan(basePlan, radar) ?? [];
    const measured = items.map((item, index) => ({
      ...item,
      status: index === 2 ? "publicado" as const : item.status,
      resultado: index === 2
        ? { salvamentos: 8, comentarios: 4, leads: 3, vendas: 1 }
        : index === 0
          ? { salvamentos: 1, comentarios: 0, leads: 0, vendas: 0 }
          : undefined,
    }));

    const learning = buildWeeklyLearning(measured);

    expect(learning?.resumo).toContain("3 leads");
    expect(learning?.resumo).toContain("1 venda");
    expect(learning?.melhorSinal).toContain("Dia 3");
    expect(learning?.proximaAcao).toContain("campanha assistida");
  });

  it("calcula motor organico com oferta, prova, CTA e contexto de Radar", () => {
    const engine = buildOrganicEngine(basePlan, radar);

    expect(engine?.score).toBeGreaterThanOrEqual(85);
    expect(engine?.ajustesPerfil.join(" ")).toContain("CTA");
    expect(engine?.termosBuscaSocial.length).toBeGreaterThan(0);
    expect(engine?.scoreBreakdown?.map((item) => item.nome)).toEqual(["Oferta", "Prova", "CTA", "Radar", "Execucao"]);
    expect(engine?.proximosPassos?.[0]?.acao).toContain("oferta");
  });

  it("escolhe o melhor sinal organico como base de campanha assistida", () => {
    const items = buildSevenDayPlan(basePlan, radar) ?? [];
    const plano7Dias = items.map((item, index) => ({
      ...item,
      resultado: index === 2 ? { visualizacoes: 900, salvamentos: 10, leads: 4 } : undefined,
    }));

    const campaign = buildAssistedCampaign({ ...basePlan, plano7Dias });

    expect(campaign?.base).toContain("Dia 3");
    expect(campaign?.checklist.join(" ")).toContain("humano");
    expect(campaign?.orcamento).toContain("R$ 20-30/dia");
  });

  it("enriquece diagnosticos antigos sem perder redes do perfil atual", () => {
    const enhanced = enhancePlanV2(basePlan as CacaPlan, { instagram: "@gudgudacai" }, radar);

    expect(enhanced.redes?.instagram).toBe("@gudgudacai");
    expect(enhanced.plano7Dias).toHaveLength(7);
    expect(enhanced.aprendizadoSemanal?.resumo).toContain("semana");
    expect(enhanced.motorOrganico?.score).toBeGreaterThanOrEqual(85);
    expect(enhanced.motorOrganico?.scoreBreakdown?.length).toBe(5);
    expect(enhanced.campanhaAssistida?.titulo).toContain("Gud Gud Acai");
  });
});
