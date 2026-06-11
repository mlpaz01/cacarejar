import { describe, expect, it } from "vitest";

describe("OpenRouter API Key", () => {
  it("deve ter a variável OPENROUTER_API_KEY definida", () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
    expect(key?.startsWith("sk-or-")).toBe(true);
  });

  it("deve conseguir listar modelos disponíveis no OpenRouter", async () => {
    const key = process.env.OPENROUTER_API_KEY;
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { data: Array<{ id: string }> };
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    console.log(`✅ OpenRouter: ${data.data.length} modelos disponíveis`);
  }, 15000);
});
