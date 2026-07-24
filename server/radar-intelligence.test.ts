import { describe, expect, it } from "vitest";
import {
  commercialSignals,
  fallbackProfileAssessment,
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
