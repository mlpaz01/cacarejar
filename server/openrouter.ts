/**
 * OpenRouter LLM helper
 * Usa a chave OPENROUTER_API_KEY para acessar os modelos disponíveis na conta do usuário.
 */

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function getKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY não configurada");
  return key;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chama o endpoint de chat completion do OpenRouter.
 * Usa claude-3-5-haiku como padrão (rápido e barato), com fallback para modelos alternativos.
 */
export async function openRouterChat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = "anthropic/claude-3.5-haiku",
    temperature = 0.7,
    maxTokens = 2048,
  } = options;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://nomeutempo.app",
      "X-Title": "NoMeuTempo Marketing Engine",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

/**
 * Lista modelos disponíveis na conta OpenRouter.
 */
export async function listOpenRouterModels(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: { Authorization: `Bearer ${getKey()}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models error ${res.status}`);
  const data = (await res.json()) as { data: Array<{ id: string; name: string }> };
  return data.data ?? [];
}

/**
 * Analisa métricas de campanha e retorna sugestões de recalibração em JSON estruturado.
 */
export async function analyzeAndCalibrate(params: {
  campaignName: string;
  objective: string;
  budget: number;
  channels: string[];
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    ctr: number;
    roi: number;
  };
}): Promise<{
  analysis: string;
  suggestions: Array<{
    tipo: "orcamento" | "publico_alvo" | "criativo" | "canal";
    descricao: string;
    valorAtual?: string;
    valorSugerido?: string;
    impactoEstimado?: string;
  }>;
}> {
  const { campaignName, objective, budget, channels, metrics } = params;

  const systemPrompt = `Você é um especialista sênior em marketing digital e performance de campanhas.
Analise os dados fornecidos e retorne SOMENTE um JSON válido, sem markdown, sem explicações extras.
O JSON deve ter exatamente esta estrutura:
{
  "analysis": "texto de análise em português",
  "suggestions": [
    {
      "tipo": "orcamento" | "publico_alvo" | "criativo" | "canal",
      "descricao": "descrição da sugestão",
      "valorAtual": "valor atual (opcional)",
      "valorSugerido": "valor sugerido (opcional)",
      "impactoEstimado": "impacto estimado (opcional)"
    }
  ]
}`;

  const userPrompt = `Campanha: "${campaignName}"
Objetivo: ${objective}
Orçamento total: R$ ${budget.toFixed(2)}
Canais: ${channels.join(", ")}

Métricas atuais:
- Impressões: ${metrics.impressions.toLocaleString("pt-BR")}
- Cliques: ${metrics.clicks.toLocaleString("pt-BR")}
- CTR: ${metrics.ctr.toFixed(2)}%
- Conversões: ${metrics.conversions}
- Gasto: R$ ${metrics.spend.toFixed(2)}
- Receita gerada: R$ ${metrics.revenue.toFixed(2)}
- ROI: ${metrics.roi.toFixed(1)}%

Analise o desempenho e forneça sugestões concretas de otimização para maximizar o ROI.
Foque em ajustes práticos de orçamento, segmentação de público, qualidade de criativos e mix de canais.`;

  const content = await openRouterChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { model: "anthropic/claude-3.5-haiku", temperature: 0.4, maxTokens: 1500 }
  );

  try {
    // Remove possíveis blocos markdown
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: retorna análise como texto puro
    return {
      analysis: content,
      suggestions: [
        {
          tipo: "criativo",
          descricao: "Revise os criativos com base na análise acima para melhorar o desempenho.",
        },
      ],
    };
  }
}

/**
 * Gera um prompt otimizado para criação de imagem de campanha.
 */
export async function generateCreativePrompt(params: {
  briefing: string;
  channels: string[];
  objective: string;
}): Promise<string> {
  const { briefing, channels, objective } = params;

  const content = await openRouterChat(
    [
      {
        role: "system",
        content: `Você é um diretor de arte especializado em campanhas digitais.
Crie um prompt detalhado em inglês para gerar uma imagem publicitária profissional.
O prompt deve ser específico, visual e adequado para anúncios digitais.
Retorne APENAS o prompt em inglês, sem explicações.`,
      },
      {
        role: "user",
        content: `Briefing: ${briefing}
Objetivo da campanha: ${objective}
Canais de veiculação: ${channels.join(", ")}

Crie um prompt de imagem publicitária profissional, moderna e impactante.`,
      },
    ],
    { model: "anthropic/claude-3.5-haiku", temperature: 0.8, maxTokens: 300 }
  );

  return content.trim();
}
