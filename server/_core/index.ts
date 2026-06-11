import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import fs from "fs";
import path from "path";
import {
  getDb,
  getIntegrations,
  createDispatchLog,
  updateDispatchLog,
} from "../db";
import { campaigns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import cron from "node-cron";

// ─── Dispatch: processa campanhas ativas a cada 30 min ────────────────────────

export async function runScheduledDispatch() {
  const db = await getDb();
  if (!db) return;

  const activeCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.status, "ativa"));

  for (const campaign of activeCampaigns) {
    const integrations = await getIntegrations(campaign.organizationId);
    const connectedChannels = integrations
      .filter(i => i.status === "conectado")
      .map(i => i.channel);

    const campaignChannels = (campaign.channels as string[]) ?? [];
    const channelsToDispatch = campaignChannels.filter(ch =>
      connectedChannels.includes(ch as any)
    );

    if (channelsToDispatch.length === 0) continue;

    for (const channel of channelsToDispatch) {
      const logResult = await createDispatchLog({
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        channel,
        scheduledAt: new Date(),
        status: "agendado",
        payload: { triggeredBy: "node-cron", campaignName: campaign.name },
      });

      const logId = (logResult as any).insertId as number;

      try {
        const integration = integrations.find(i => i.channel === channel);
        if (!integration?.accessToken) {
          await updateDispatchLog(logId, {
            status: "falhou",
            executedAt: new Date(),
            errorMessage: `Token de acesso não configurado para ${channel}`,
          });
          continue;
        }

        // Placeholder: substituir pela chamada real à API do canal
        await updateDispatchLog(logId, {
          status: "enviado",
          executedAt: new Date(),
          externalId: `ext-${Date.now()}-${channel}`,
        });
      } catch (err: any) {
        await updateDispatchLog(logId, {
          status: "falhou",
          executedAt: new Date(),
          errorMessage: err?.message ?? "Erro desconhecido",
        });
      }
    }
  }
}

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Garantir pasta de uploads e servir como estático
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  app.use("/uploads", express.static(UPLOADS_DIR));

  registerStorageProxy(app);
  registerAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Cron: disparo automático de campanhas ativas a cada 30 min
  cron.schedule("*/30 * * * *", async () => {
    console.log("[Cron] Running scheduled dispatch...");
    try {
      await runScheduledDispatch();
    } catch (err) {
      console.error("[Cron] Dispatch error:", err);
    }
  });

  // Cron: revisão semi-automática (processa aprovações pendentes) a cada 2 min
  cron.schedule("*/2 * * * *", async () => {
    try {
      const approvals = await import("../services/approvals");
      await approvals.processPending();
    } catch (err) {
      console.error("[Cron] Review error:", err);
    }
  });

  // Cron: motor — publica aprovados, coleta métricas e redistribui (ovos de ouro)
  cron.schedule("*/5 * * * *", async () => {
    try {
      const engine = await import("../services/engine");
      await engine.dispatchApproved();
      await engine.collectAllLive(7);
      await engine.reallocateAll();
    } catch (err) {
      console.error("[Cron] Engine error:", err);
    }
  });

  const port = ENV.port;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
