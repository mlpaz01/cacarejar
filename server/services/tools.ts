/**
 * Micro-ferramentas isca (Sprint 5) — endpoints públicos (sem login) para atrair tráfego
 * orgânico e funilar para o diagnóstico pago. Inclui rate limit simples por IP (anti-abuso/custo).
 */
import { openRouterChat, ContentPart } from "../openrouter";

const BRAIN = "anthropic/claude-sonnet-4.6";

// Rate limit em memória por IP (reinicia ao reiniciar o processo — suficiente para v1).
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimited(ip: string, max = 8, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  h.count++;
  return h.count > max;
}

export interface Legenda {
  texto: string;
  hashtags: string[];
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
