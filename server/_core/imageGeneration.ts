// Image generation is disabled. Creatives are added via URL (e.g. exported from ChatGPT).
export type GenerateImageOptions = {
  prompt: string;
};

export type GenerateImageResponse = {
  url: string | null;
};

export async function generateImage(_opts: GenerateImageOptions): Promise<GenerateImageResponse> {
  throw new Error("Geração de imagem por IA está desabilitada. Use a opção de URL externa.");
}
