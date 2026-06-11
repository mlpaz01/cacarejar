/**
 * ImageProvider — geração de imagem.
 * - OpenRouterImageProvider: imagens REAIS via Gemini Image (texto→imagem e imagem→imagem/clone).
 *   Usa a mesma OPENROUTER_API_KEY. Salva o PNG em /uploads e retorna a URL.
 * - MockImageProvider: mockup SVG (fallback quando não há chave).
 */
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export interface ImageGenInput {
  prompt: string;
  ratio?: string;                 // "1:1" | "9:16" | "16:9"
  factorValues?: Record<string, string>;
  produto?: string;
  refImageUrl?: string;           // para clonar (image-to-image)
}
export interface ImageGenResult {
  imageUrl: string;
  model: string;
  realCostUsdMicros: number;
}
export interface ImageProvider {
  name: string;
  generate(input: ImageGenInput): Promise<ImageGenResult>;
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const IMAGE_MODEL = process.env.IMAGE_MODEL || "google/gemini-2.5-flash-image";

function ratioHint(ratio?: string): string {
  if (ratio === "9:16") return "formato vertical 9:16 (story/reels), 1080x1920";
  if (ratio === "16:9") return "formato horizontal 16:9, 1920x1080";
  return "formato quadrado 1:1, 1080x1080";
}

function saveDataUrl(dataUrl: string): string | null {
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return null;
  const ext = m[1].split("/")[1].replace("jpeg", "jpg");
  const buf = Buffer.from(m[2], "base64");
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const file = `gen_${nanoid()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, file), buf);
  return `/uploads/${file}`;
}

// ─── OpenRouter (Gemini Image) ────────────────────────────────────────────────
async function geminiImageOnce(input: ImageGenInput, useRef: boolean): Promise<ImageGenResult> {
  const key = process.env.OPENROUTER_API_KEY!;
  const text = `${input.prompt}. ${ratioHint(input.ratio)}. Imagem de anúncio profissional, sem texto sobreposto, alta qualidade.`;
  const content: any = useRef && input.refImageUrl
    ? [
        { type: "text", text: `Use a imagem de referência como base e gere uma variação publicitária: ${text}` },
        { type: "image_url", image_url: { url: input.refImageUrl } },
      ]
    : text;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Cacarejar Estudio" },
    body: JSON.stringify({ model: IMAGE_MODEL, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
  });
  if (!res.ok) throw new Error(`OpenRouter image ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error("Sem imagem na resposta do modelo");
  const saved = saveDataUrl(url);
  if (!saved) throw new Error("Falha ao salvar imagem");
  const cost = data?.usage?.cost ?? 0;
  return { imageUrl: saved, model: IMAGE_MODEL, realCostUsdMicros: Math.round(cost * 1e6) };
}

export const OpenRouterImageProvider: ImageProvider = {
  name: IMAGE_MODEL,
  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    // O Gemini às vezes responde só texto. Tenta com referência; se falhar,
    // tenta de novo SEM referência (mais confiável; o prompt já carrega o DNA da marca).
    const attempts: boolean[] = input.refImageUrl ? [true, false, false] : [false, false];
    let lastErr: any;
    for (const useRef of attempts) {
      try {
        return await geminiImageOnce(input, useRef);
      } catch (e) {
        lastErr = e; // tanto "Sem imagem" quanto "imagem de referência inválida" → tenta sem ref
      }
    }
    throw lastErr;
  },
};

// ─── Mock (SVG) ───────────────────────────────────────────────────────────────
const COLOR_HEX: Record<string, [string, string]> = {
  laranja: ["#ff7b00", "#ff3217"], vermelho: ["#ff5236", "#c20f00"], azul: ["#2f7fd1", "#143f6b"],
  verde: ["#18b85c", "#0a6b34"], amarelo: ["#ffc400", "#ff8a00"], roxo: ["#7c39e8", "#3f1a80"],
  rosa: ["#ff5fa2", "#c0398a"], preto_branco: ["#3a3a3a", "#0b0b0b"], pastel: ["#ffd9c0", "#ffb59a"], neutro: ["#8492a6", "#46556b"],
};
const TYPE_EMOJI: Record<string, string> = { pessoa: "🧑", animal: "🐾", objeto: "📦", tecnologico: "💡", abstrato: "🔷", alimento: "🍰", cenario: "🏞️" };
function rdims(r?: string) { return r === "9:16" ? { w: 360, h: 640 } : r === "16:9" ? { w: 640, h: 360 } : { w: 512, h: 512 }; }
function esc(s: string) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export const MockImageProvider: ImageProvider = {
  name: "mock-svg",
  async generate(input: ImageGenInput): Promise<ImageGenResult> {
    const fv = input.factorValues ?? {};
    const [c1, c2] = COLOR_HEX[fv.img_cor_predominante ?? "laranja"] ?? COLOR_HEX.laranja;
    const emoji = TYPE_EMOJI[fv.img_tipo ?? "pessoa"] ?? "✨";
    const { w, h } = rdims(input.ratio);
    const produto = esc((input.produto ?? "Seu produto").slice(0, 40));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="50%" y="${h * 0.42}" font-size="${Math.min(w, h) * 0.28}" text-anchor="middle" dominant-baseline="central">${emoji}</text><text x="50%" y="${h * 0.78}" font-family="Inter,Arial" font-size="${Math.min(w, h) * 0.05}" font-weight="900" fill="#fff" text-anchor="middle">${produto}</text></svg>`;
    return { imageUrl: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"), model: "mock-svg", realCostUsdMicros: 0 };
  },
};

export function getImageProvider(): ImageProvider {
  return process.env.OPENROUTER_API_KEY ? OpenRouterImageProvider : MockImageProvider;
}
