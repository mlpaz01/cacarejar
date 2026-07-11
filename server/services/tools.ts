/**
 * Micro-ferramentas isca (Sprint 5) — endpoints públicos (sem login) para atrair tráfego
 * orgânico e funilar para o diagnóstico pago. Inclui rate limit persistente por IP (anti-abuso/custo).
 */
import { openRouterChat, ContentPart } from "../openrouter";
import { consumeRateLimit } from "../db";

const BRAIN = "anthropic/claude-sonnet-4.6";

export async function rateLimited(ip: string, max = 8, windowMs = 60 * 60 * 1000): Promise<boolean> {
  const result = await consumeRateLimit(`tools:${ip || "unknown"}`, max, windowMs);
  return !result.allowed;
}

export interface Legenda {
  texto: string;
  hashtags: string[];
}

export interface BioAnalysis {
  score: number;
  verdict: string;
  resumo: string;
  pontosFortes: string[];
  ajustes: string[];
  bioReescrita: string;
  ctas: string[];
  palavrasChave: string[];
}

export async function gerarLegenda(input: { tema?: string; rede?: string; tom?: string }): Promise<{ legendas: Legenda[] }> {
  const tema = String(input.tema || "").slice(0, 300).trim();
  if (!tema) return { legendas: [] };
  const rede = String(input.rede || "Instagram").slice(0, 30);
  const tom = String(input.tom || "").slice(0, 40);
  const prompt = `Voce e copywriter de redes sociais. Gere 3 legendas curtas e persuasivas em portugues do Brasil para um post de ${rede} sobre: "${tema}".${tom ? ` Tom: ${tom}.` : ""}
Regras de cada legenda: gancho forte na primeira linha, corpo curto e escaneavel, 1 CTA claro no fim. Inclua 5 hashtags relevantes (sem #genericas demais).
Responda SOMENTE JSON: {"legendas":[{"texto":string,"hashtags":[string]}]}`;
  try {
    const parts: ContentPart[] = [{ type: "text", text: prompt }];
    const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.8, maxTokens: 900 });
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
    const legendas: Legenda[] = Array.isArray(parsed?.legendas)
      ? parsed.legendas.slice(0, 3).map((l: any) => ({
          texto: String(l?.texto || "").slice(0, 1200),
          hashtags: Array.isArray(l?.hashtags) ? l.hashtags.map((h: any) => String(h)).slice(0, 8) : [],
        }))
      : [];
    return { legendas };
  } catch {
    return { legendas: [] };
  }
}

function fallbackBioAnalysis(bio: string, nicho: string): BioAnalysis {
  const lower = bio.toLowerCase();
  const hasOffer = /\b(ajudo|fazemos|vendo|curso|mentoria|consulta|servico|serviço|produto|loja|especialista)\b/i.test(bio);
  const hasProof = /\b(anos|clientes|alunos|resultado|cases?|especialista|certificado|desde|mil|k)\b/i.test(bio);
  const hasCta = /\b(chame|link|clique|agende|compre|baixe|fale|whatsapp|dm|direct)\b/i.test(bio);
  const hasAudience = /\b(para|empreendedor|maes|mães|empresas|criadores|profissionais|alunos|clientes|pessoas)\b/i.test(bio);
  const hasContact = /\b(wa\.me|whatsapp|@|http|www|link)\b/i.test(bio);
  let score = 25;
  if (bio.length >= 45 && bio.length <= 150) score += 15;
  if (hasOffer) score += 18;
  if (hasAudience) score += 14;
  if (hasProof) score += 14;
  if (hasCta) score += 10;
  if (hasContact) score += 4;
  score = Math.max(0, Math.min(100, score));
  const area = nicho || "seu nicho";
  const ajustes = [
    !hasOffer ? "Diga claramente o que voce vende ou resolve." : "",
    !hasAudience ? "Mostre para quem a marca e feita." : "",
    !hasProof ? "Inclua uma prova simples: numero, autoridade, experiencia ou resultado." : "",
    !hasCta ? "Feche com um convite direto para conversa, agenda, compra ou diagnostico." : "",
  ].filter(Boolean);
  return {
    score,
    verdict: score >= 80 ? "Bio forte" : score >= 60 ? "Bio boa, mas pode converter mais" : "Bio precisa ficar mais clara",
    resumo: "A bio precisa responder rapido: quem voce ajuda, com qual promessa, por que confiar e qual proximo passo.",
    pontosFortes: [
      bio.length <= 160 ? "Tamanho adequado para leitura rapida." : "Ha contexto suficiente, mas da para enxugar.",
      hasCta ? "Ja existe um convite para acao." : "Existe espaco claro para melhorar a chamada final.",
    ],
    ajustes: ajustes.length ? ajustes : ["Troque palavras genericas por uma promessa mais especifica.", "Inclua uma prova concreta para aumentar confianca."],
    bioReescrita: `${area}: ajudamos voce a transformar presenca em resultado com conteudo claro, prova real e acao simples. Fale no direct para receber o primeiro passo.`,
    ctas: ["Me chama no direct", "Pegue o primeiro passo no link", "Agende uma conversa"],
    palavrasChave: Array.from(new Set([area, "resultado", "conteudo", "estrategia", "prova"])).slice(0, 6),
  };
}

export async function analisarBio(input: { bio?: string; nicho?: string }): Promise<BioAnalysis> {
  const bio = String(input.bio || "").slice(0, 240).trim();
  const nicho = String(input.nicho || "").slice(0, 80).trim();
  if (!bio) return fallbackBioAnalysis("", nicho);
  const fallback = fallbackBioAnalysis(bio, nicho);
  if (!process.env.OPENROUTER_API_KEY) return fallback;
  const prompt = `Voce e estrategista de Instagram. Analise a bio abaixo para conversao de visitantes em seguidores, DMs ou leads.
BIO: "${bio}"
NICHO/NEGOCIO: "${nicho || "nao informado"}"

Devolva SOMENTE JSON:
{"score":number de 0 a 100,"verdict":string curta,"resumo":string curta,"pontosFortes":[string,string],"ajustes":[string,string,string,string],"bioReescrita":string com ate 150 caracteres,"ctas":[string,string,string],"palavrasChave":[string,string,string,string,string]}

Regras:
- Seja pratico, especifico e em portugues do Brasil.
- Nao use a expressao IA.
- Fale em Agente apenas se fizer sentido.
- A bio reescrita deve caber em perfil social, com promessa clara e CTA.`;
  try {
    const parts: ContentPart[] = [{ type: "text", text: prompt }];
    const content = await openRouterChat([{ role: "user", content: parts }], { model: BRAIN, temperature: 0.55, maxTokens: 900 });
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
    return {
      score: Math.max(0, Math.min(100, Number(parsed?.score ?? fallback.score))),
      verdict: String(parsed?.verdict || fallback.verdict).slice(0, 90),
      resumo: String(parsed?.resumo || fallback.resumo).slice(0, 300),
      pontosFortes: Array.isArray(parsed?.pontosFortes) ? parsed.pontosFortes.map((x: any) => String(x)).slice(0, 3) : fallback.pontosFortes,
      ajustes: Array.isArray(parsed?.ajustes) ? parsed.ajustes.map((x: any) => String(x)).slice(0, 5) : fallback.ajustes,
      bioReescrita: String(parsed?.bioReescrita || fallback.bioReescrita).slice(0, 180),
      ctas: Array.isArray(parsed?.ctas) ? parsed.ctas.map((x: any) => String(x)).slice(0, 4) : fallback.ctas,
      palavrasChave: Array.isArray(parsed?.palavrasChave) ? parsed.palavrasChave.map((x: any) => String(x)).slice(0, 8) : fallback.palavrasChave,
    };
  } catch {
    return fallback;
  }
}
