import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@nomeutempo.app",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: { cookie: "" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
    ...overrides,
  };
}

describe("Motor de Marketing — Routers", () => {
  it("auth.me retorna null para contexto sem usuário", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me retorna o usuário autenticado", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@nomeutempo.app");
  });

  it("auth.logout limpa o cookie e retorna success", async () => {
    const cleared: string[] = [];
    const ctx = createMockContext({
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared).toHaveLength(1);
  });

  it("calibration.list requer autenticação", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.calibration.list()).rejects.toThrow();
  });

  it("campaigns.list requer autenticação", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.campaigns.list()).rejects.toThrow();
  });

  it("creatives.list requer autenticação", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.creatives.list({ campaignId: undefined })).rejects.toThrow();
  });

  it("integrations.list requer autenticação", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.integrations.list()).rejects.toThrow();
  });

  it("metrics.dashboard requer autenticação", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.metrics.dashboard()).rejects.toThrow();
  });
});

describe("OpenRouter — Configuração", () => {
  it("OPENROUTER_API_KEY está definida e válida", () => {
    const key = process.env.OPENROUTER_API_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe("string");
    expect(key!.length).toBeGreaterThan(20);
    expect(key!.startsWith("sk-or-")).toBe(true);
  });
});
