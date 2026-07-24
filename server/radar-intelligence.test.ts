import { describe, expect, it } from "vitest";
import {
  commercialSignals,
  fallbackProfileAssessment,
  qualifiesProfileAssessment,
} from "./services/radar";
import type { SocialProfile } from "./services/profileProvider";

const plan = {
  produto: "Videos artisticos, sustentaveis e humoristicos para redes sociais",
  nicho: "criacao audiovisual autoral",
  resumoDiagnostico:
    "Criadora que transforma temas de sustentabilidade em videos artisticos com humor.",
  profile: {
    handle: "julialag0",
    bio: "Video, arte, sustentabilidade e humor",
    category: "Digital creator",
  },
};

function profile(
  handle: string,
  bio: string,
  captions: string[]
): SocialProfile {
  const posts = captions.map(caption => ({
    caption,
    likes: 100,
    comments: 10,
  }));
  return {
    network: "instagram",
    handle,
    bio,
    posts,
    topPosts: posts,
    source: "test",
  };
}

describe("Radar competitive intelligence", () => {
  it("rejects a visually similar profile without business or audience overlap", () => {
    const candidate = profile(
      "moda_rosa",
      "Looks, maquiagem e rotina",
      ["Vestido novo para a festa", "Minha maquiagem favorita"]
    );
    expect(
      fallbackProfileAssessment(plan, candidate, "instagram", false)
    ).toBeNull();
  });

  it("accepts a profile with concrete thematic and editorial overlap", () => {
    const candidate = profile(
      "video_com_proposito",
      "Criacao audiovisual, arte e sustentabilidade",
      [
        "Bastidor de um video artistico sustentavel",
        "Como usar humor para falar de consumo consciente",
      ]
    );
    const result = fallbackProfileAssessment(
      plan,
      candidate,
      "instagram",
      false
    );
    expect(result?.fitScore).toBeGreaterThanOrEqual(60);
    expect(result?.evidence.length).toBeGreaterThan(0);
  });

  it("rejects a polished fashion profile even when the model cites audience size and personal brand", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao",
          fitScore: 62,
          confidence: "media",
          dimensions: {
            audience: 72,
            offer: 18,
            subject: 15,
            formatTone: 22,
            visualDNA: 12,
          },
          reason:
            "Criadora de moda com porte de audiencia comparavel e identidade pessoal forte.",
          evidence: [
            "37 mil seguidores",
            "Marca pessoal centralizada na criadora",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(false);
  });

  it("accepts an editorial inspiration only when subject, format, tone and visual DNA all align", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao",
          fitScore: 86,
          confidence: "alta",
          dimensions: {
            audience: 68,
            offer: 45,
            subject: 91,
            formatTone: 88,
            visualDNA: 84,
          },
          reason:
            "Criacao audiovisual autoral com humor, processo aparente e linguagem raw.",
          evidence: [
            "Bastidores do processo artistico aparecem nos videos",
            "Humor e expressao facial conduzem os ganchos",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(true);
  });

  it("accepts a direct competitor through audience, offer and subject even with a different visual treatment", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "concorrente_direto",
          fitScore: 82,
          confidence: "alta",
          dimensions: {
            audience: 84,
            offer: 79,
            subject: 88,
            formatTone: 58,
            visualDNA: 42,
          },
          reason:
            "Atende marcas que procuram videos autorais com humor e sustentabilidade.",
          evidence: [
            "Oferta de producao audiovisual para marcas",
            "Conteudo recorrente sobre humor e sustentabilidade",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(true);
  });

  it("accepts a partial inspiration only when its named editorial component is strong", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao_de_componente",
          inspirationDimension: "assunto",
          fitScore: 74,
          confidence: "alta",
          dimensions: {
            audience: 45,
            offer: 30,
            subject: 88,
            formatTone: 62,
            visualDNA: 58,
          },
          evidence: [
            "Transforma sucata em objetos artisticos",
            "Mostra o processo manual nos videos",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(true);
  });

  it("scores a component by its specific utility instead of averaging unrelated offer dimensions", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao_de_componente",
          inspirationDimension: "formato_tom",
          fitScore: 76,
          confidence: "alta",
          dimensions: {
            audience: 42,
            offer: 18,
            subject: 58,
            formatTone: 78,
            visualDNA: 50,
          },
          evidence: [
            "Usa o erro intencional como linguagem comica",
            "Transforma o processo artistico em punchline",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(true);
  });

  it("accepts a strong mechanism with one concrete supporting dimension", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao_de_componente",
          inspirationDimension: "mecanismo",
          fitScore: 70,
          confidence: "alta",
          dimensions: {
            audience: 45,
            offer: 30,
            subject: 75,
            formatTone: 30,
            visualDNA: 25,
          },
          evidence: [
            "Transforma embalagem descartada em objeto artistico",
            "Organiza o processo em uma serie recorrente",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(true);
  });

  it("does not accept audience size as a component inspiration", () => {
    expect(
      qualifiesProfileAssessment(
        {
          decision: "inspiracao_de_componente",
          inspirationDimension: "audiencia",
          fitScore: 74,
          confidence: "alta",
          dimensions: {
            audience: 95,
            offer: 15,
            subject: 20,
            formatTone: 25,
            visualDNA: 20,
          },
          evidence: [
            "Quantidade semelhante de seguidores",
            "Criadora aparece no proprio perfil",
          ],
        },
        { hasVisualSample: true }
      )
    ).toBe(false);
  });

  it("only treats a brand mention as commercial when the post carries a public partnership signal", () => {
    const candidate = profile(
      "criadora",
      "Criadora de conteudo",
      [
        "Publi em parceria com @marca_verde para uma rotina mais sustentavel.",
        "Hoje visitei a @marca_citada e gostei do espaco.",
      ]
    );
    const signals = commercialSignals([candidate]);
    expect(
      signals.find(signal => signal.handle === "marca_verde")
        ?.commercialMentions
    ).toBe(1);
    expect(
      signals.find(signal => signal.handle === "marca_citada")
        ?.commercialMentions
    ).toBe(0);
  });
});
