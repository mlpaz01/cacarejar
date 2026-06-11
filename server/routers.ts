import { z } from "zod";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { sdk } from "./_core/sdk";
import bcrypt from "bcryptjs";
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCreatives,
  getCreativeById,
  createCreative,
  updateCreative,
  getMetrics,
  getMetricsByOrgId,
  createMetric,
  getDashboardSummary,
  getIntegrations,
  upsertIntegration,
  getDispatchLogs,
  createDispatchLog,
  updateDispatchLog,
  getCalibrationLogs,
  getCalibrationLogsByCampaign,
  createCalibrationLog,
  updateCalibrationLog,
  getDb,
  getUserByEmail,
  getAdminStats,
  getAllOrgs,
} from "./db";
import { analyzeAndCalibrate } from "./openrouter";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { campaigns } from "../drizzle/schema";
import * as creditsService from "./services/credits";
import * as studioService from "./services/studio";
import * as approvalsService from "./services/approvals";
import * as notifService from "./services/notifications";
import * as engine from "./services/engine";
import * as diagnosisService from "./services/diagnosis";
import * as radarService from "./services/radar";

// ─── Campaigns Router ─────────────────────────────────────────────────────────

const campaignsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return getCampaigns(orgId);
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCampaignById(input.id)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        objective: z.string().min(1),
        targetAudience: z.string().optional(),
        budgetTotal: z.string(),
        channels: z.array(z.enum(["linkedin", "tiktok", "instagram", "google"])),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      await createCampaign({
        organizationId: orgId,
        userId: ctx.user.id,
        name: input.name,
        objective: input.objective,
        targetAudience: input.targetAudience,
        budgetTotal: input.budgetTotal,
        channels: input.channels,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        status: "rascunho",
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        objective: z.string().optional(),
        targetAudience: z.string().optional(),
        budgetTotal: z.string().optional(),
        channels: z.array(z.enum(["linkedin", "tiktok", "instagram", "google"])).optional(),
        status: z.enum(["rascunho", "ativa", "pausada", "concluida", "arquivada"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, startDate, endDate, ...rest } = input;
      await updateCampaign(id, {
        ...rest,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCampaign(input.id);
      return { success: true };
    }),

  scheduleDispatch: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        cron: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new Error("Campanha não encontrada");

      const { runScheduledDispatch } = await import("./_core/index");

      if (campaign.scheduleCronTaskUid) {
        await updateHeartbeatJob(campaign.scheduleCronTaskUid, { cron: input.cron, enable: true });
      } else {
        const job = await createHeartbeatJob(
          {
            name: `dispatch-campaign-${input.campaignId}`,
            cron: input.cron,
            path: "/api/scheduled/dispatch",
            description: `Disparo automático: ${campaign.name}`,
          },
          runScheduledDispatch
        );
        const db = await getDb();
        if (db) {
          await db
            .update(campaigns)
            .set({ scheduleCronTaskUid: job.taskUid })
            .where(eq(campaigns.id, input.campaignId));
        }
      }
      return { success: true };
    }),

  pauseDispatch: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input }) => {
      const campaign = await getCampaignById(input.campaignId);
      if (!campaign?.scheduleCronTaskUid) throw new Error("Nenhum agendamento ativo");
      await updateHeartbeatJob(campaign.scheduleCronTaskUid, { enable: false });
      return { success: true };
    }),
});

// ─── Creatives Router ─────────────────────────────────────────────────────────

const creativesRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return [];
      return getCreatives(orgId, input.campaignId);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCreativeById(input.id)),

  upload: protectedProcedure
    .input(
      z.object({
        briefing: z.string().min(3),
        imageData: z.string().min(10),
        ext: z.enum(["jpg", "jpeg", "png", "webp", "gif"]).default("jpg"),
        campaignId: z.number().optional(),
        channels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");

      const { UPLOADS_DIR } = await import("./_core/index");

      const base64 = input.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const fileName = `${nanoid()}.${input.ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/uploads/${fileName}`;

      const insertResult = await createCreative({
        organizationId: orgId,
        userId: ctx.user.id,
        campaignId: input.campaignId,
        briefing: input.briefing,
        imageUrl,
        channels: input.channels,
        status: "aprovado",
      });

      const insertId = (insertResult as any).insertId as number;
      return { success: true, id: insertId, imageUrl };
    }),

  addFromUrl: protectedProcedure
    .input(
      z.object({
        briefing: z.string().min(3),
        imageUrl: z.string().url("URL inválida"),
        campaignId: z.number().optional(),
        channels: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");

      const insertResult = await createCreative({
        organizationId: orgId,
        userId: ctx.user.id,
        campaignId: input.campaignId,
        briefing: input.briefing,
        imageUrl: input.imageUrl,
        channels: input.channels,
        status: "aprovado",
      });

      const insertId = (insertResult as any).insertId as number;
      return { success: true, id: insertId, imageUrl: input.imageUrl };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["aprovado", "rejeitado", "em_uso"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateCreative(input.id, { status: input.status });
      return { success: true };
    }),

  linkToCampaign: protectedProcedure
    .input(z.object({ id: z.number(), campaignId: z.number() }))
    .mutation(async ({ input }) => {
      await updateCreative(input.id, { campaignId: input.campaignId, status: "em_uso" });
      return { success: true };
    }),
});

// ─── Metrics Router ───────────────────────────────────────────────────────────

const metricsRouter = router({
  byCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(({ input }) =>
      getMetrics(
        input.campaignId,
        input.from ? new Date(input.from) : undefined,
        input.to ? new Date(input.to) : undefined
      )
    ),

  all: protectedProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return [];
      return getMetricsByOrgId(
        orgId,
        input.from ? new Date(input.from) : undefined,
        input.to ? new Date(input.to) : undefined
      );
    }),

  dashboard: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return null;
    return getDashboardSummary(orgId);
  }),

  seed: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        channel: z.string(),
        impressions: z.number(),
        clicks: z.number(),
        conversions: z.number(),
        spend: z.string(),
        revenue: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const spend = parseFloat(input.spend);
      const revenue = parseFloat(input.revenue);
      const roi = spend > 0 ? (revenue - spend) / spend : 0;
      const ctr = input.impressions > 0 ? input.clicks / input.impressions : 0;
      const cpc = input.clicks > 0 ? spend / input.clicks : 0;
      await createMetric({
        campaignId: input.campaignId,
        channel: input.channel,
        date: new Date(),
        impressions: input.impressions,
        clicks: input.clicks,
        conversions: input.conversions,
        spend: input.spend,
        revenue: input.revenue,
        roi: roi.toFixed(4),
        ctr: ctr.toFixed(4),
        cpc: cpc.toFixed(4),
      });
      return { success: true };
    }),
});

// ─── Integrations Router ──────────────────────────────────────────────────────

const integrationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return getIntegrations(orgId);
  }),

  save: protectedProcedure
    .input(
      z.object({
        channel: z.enum(["linkedin", "tiktok", "instagram", "google"]),
        accountName: z.string().optional(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
        status: z.enum(["conectado", "desconectado", "erro"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      await upsertIntegration({
        organizationId: orgId,
        userId: ctx.user.id,
        channel: input.channel,
        accountName: input.accountName,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        status: input.status ?? "desconectado",
      });
      return { success: true };
    }),
});

// ─── Dispatch Router ──────────────────────────────────────────────────────────

const dispatchRouter = router({
  logs: protectedProcedure
    .input(z.object({ campaignId: z.number().optional(), channel: z.string().optional() }))
    .query(({ input }) => getDispatchLogs(input.campaignId, input.channel)),

  schedule: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        creativeId: z.number().optional(),
        channel: z.string(),
        scheduledAt: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      await createDispatchLog({
        organizationId: orgId,
        campaignId: input.campaignId,
        creativeId: input.creativeId,
        channel: input.channel,
        scheduledAt: new Date(input.scheduledAt),
        status: "agendado",
      });
      return { success: true };
    }),
});

// ─── Calibration Router ───────────────────────────────────────────────────────

const calibrationRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return getCalibrationLogs(orgId);
  }),

  byCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(({ input }) => getCalibrationLogsByCampaign(input.campaignId)),

  analyze: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");

      const campaign = await getCampaignById(input.campaignId);
      if (!campaign) throw new Error("Campanha não encontrada");

      const metricsData = await getMetrics(input.campaignId);
      const totalImpressions = metricsData.reduce((s, m) => s + (m.impressions ?? 0), 0);
      const totalClicks = metricsData.reduce((s, m) => s + (m.clicks ?? 0), 0);
      const totalConversions = metricsData.reduce((s, m) => s + (m.conversions ?? 0), 0);
      const totalSpend = metricsData.reduce(
        (s, m) => s + parseFloat(String(m.spend ?? 0)),
        0
      );
      const totalRevenue = metricsData.reduce(
        (s, m) => s + parseFloat(String(m.revenue ?? 0)),
        0
      );
      const avgRoi =
        totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      const result = await analyzeAndCalibrate({
        campaignName: campaign.name,
        objective: campaign.objective,
        budget: parseFloat(String(campaign.budgetTotal)),
        channels: campaign.channels as string[],
        metrics: {
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          spend: totalSpend,
          revenue: totalRevenue,
          ctr,
          roi: avgRoi,
        },
      });

      await createCalibrationLog({
        organizationId: orgId,
        campaignId: input.campaignId,
        userId: ctx.user.id,
        analysis: result.analysis,
        suggestions: result.suggestions,
        status: "pendente",
      });

      return { success: true, analysis: result.analysis, suggestions: result.suggestions };
    }),

  markApplied: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCalibrationLog(input.id, { status: "aplicado", appliedAt: new Date() });
      return { success: true };
    }),

  ignore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCalibrationLog(input.id, { status: "ignorado" });
      return { success: true };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

const adminRouter = router({
  stats: adminProcedure.query(() => getAdminStats()),

  orgs: adminProcedure.query(() => getAllOrgs()),

  updateOrgPlan: adminProcedure
    .input(
      z.object({
        orgId: z.number(),
        plan: z.enum(["free", "starter", "pro"]),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { updateOrg } = await import("./db");
      await updateOrg(input.orgId, {
        plan: input.plan,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      return { success: true };
    }),

  // ── Fila de revisão ──
  reviewQueue: adminProcedure.query(() => approvalsService.reviewQueue()),

  approveItem: adminProcedure
    .input(z.object({ approvalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await approvalsService.approve(input.approvalId, `operador:${ctx.user.id}`);
      return { success: true };
    }),

  rejectItem: adminProcedure
    .input(z.object({ approvalId: z.number(), reason: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      await approvalsService.reject(input.approvalId, input.reason, `operador:${ctx.user.id}`);
      return { success: true };
    }),
});

// ─── Credits Router ─────────────────────────────────────────────────────────

const PACKAGES: Record<string, { cc: number; cents: number; label: string }> = {
  boton: { cc: 500, cents: 5900, label: "Bóton" },
  ninhada: { cc: 1500, cents: 14900, label: "Ninhada" },
  galinheiro: { cc: 5000, cents: 44900, label: "Galinheiro" },
  granja: { cc: 20000, cents: 149900, label: "Granja" },
};

const creditsRouter = router({
  wallet: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return { balanceCC: 0, heldCC: 0, dailyUsed: 0, dailyQuota: 0 };
    const wallet = await creditsService.getWallet(orgId);
    const dailyUsed = await creditsService.getDailyUsed(orgId);
    const dailyQuota = await creditsService.getDailyQuota(orgId);
    return {
      balanceCC: wallet?.balanceCC ?? 0,
      heldCC: wallet?.heldCC ?? 0,
      dailyUsed,
      dailyQuota,
    };
  }),

  ledger: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return creditsService.getLedger(orgId, 30);
  }),

  packages: publicProcedure.query(() => PACKAGES),

  costTable: publicProcedure.query(() => creditsService.CC_COST),

  // MVP: compra simulada (sem gateway ainda — Asaas entra no Sprint 6).
  // Credita direto para destravar testes do estúdio.
  buyMock: protectedProcedure
    .input(z.object({ pkg: z.enum(["boton", "ninhada", "galinheiro", "granja"]) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      const p = PACKAGES[input.pkg];
      await creditsService.credit(orgId, p.cc, "recarga", {
        ref: `mock_purchase:${input.pkg}`,
        description: `Compra (simulada) — ${p.label} ${p.cc} CC`,
      });
      return { success: true, added: p.cc };
    }),
});

// ─── Studio Router ────────────────────────────────────────────────────────────

const studioRouter = router({
  factors: protectedProcedure.query(() => studioService.listFactors()),

  recent: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return studioService.listRecentCreatives(orgId, 12);
  }),

  generate: protectedProcedure
    .input(
      z.object({
        produto: z.string().min(2),
        ratio: z.enum(["1:1", "9:16", "16:9"]).default("1:1"),
        baseFactors: z.record(z.string(), z.string()).default({}),
        qty: z.number().min(1).max(8).default(6),
        az: z.boolean().default(true),
        refImageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.generateVariations({
        orgId,
        userId: ctx.user.id,
        produto: input.produto,
        ratio: input.ratio,
        baseFactors: input.baseFactors,
        qty: input.qty,
        az: input.az,
        refImageUrl: input.refImageUrl,
      });
    }),

  // Upload de um post de sucesso (base64) para clonar
  uploadReference: protectedProcedure
    .input(z.object({ dataUrl: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.saveReference(orgId, input.dataUrl);
    }),

  // Importa a imagem de um post (URL remota, ex.: Instagram) para clonar
  importImageUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.importImageUrl(orgId, input.url);
    }),

  // Gera 3 propostas clonando o estilo dos posts campeões do perfil
  generateProposals: protectedProcedure
    .mutation(async ({ ctx }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      const plan = await diagnosisService.getPlan(orgId);
      if (!plan) throw new Error("Faça o diagnóstico primeiro");
      return studioService.generateProposals({ orgId, userId: ctx.user.id, plan });
    }),

  // Detalhe de um criativo (editor)
  getCreative: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.getCreative(orgId, input.id);
    }),

  // Edita copy / brief / direção de arte do criativo
  updateCreative: protectedProcedure
    .input(z.object({
      id: z.number(),
      copy: z.string().optional(),
      briefing: z.string().optional(),
      visualPrompt: z.string().optional(),
      gancho: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      pilar: z.string().optional(),
      angulo: z.string().optional(),
      formato: z.string().optional(),
      roteiro: z.any().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      const { id, ...patch } = input;
      return studioService.updateCreative(orgId, id, patch);
    }),

  // Upload de uma imagem própria como a imagem do criativo
  setImage: protectedProcedure
    .input(z.object({ id: z.number(), dataUrl: z.string().min(20) }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.setImageFromDataUrl(orgId, input.id, input.dataUrl);
    }),

  // Restaura uma versão anterior da imagem
  revertImage: protectedProcedure
    .input(z.object({ id: z.number(), imageUrl: z.string() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.revertImage(orgId, input.id, input.imageUrl);
    }),

  // Exclui um criativo (apenas rascunho/rejeitado)
  deleteCreative: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.deleteCreative(orgId, input.id);
    }),

  // Regera a imagem do criativo (debita créditos)
  regenerateImage: protectedProcedure
    .input(z.object({ id: z.number(), promptOverride: z.string().optional(), keepStyle: z.boolean().optional() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return studioService.regenerateImage(orgId, ctx.user.id, input.id, { promptOverride: input.promptOverride, keepStyle: input.keepStyle });
    }),
});

// ─── Approvals Router ─────────────────────────────────────────────────────────

const approvalsRouter = router({
  pendingForClient: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return approvalsService.pendingForClient(orgId);
  }),

  sendToApproval: protectedProcedure
    .input(z.object({ creativeIds: z.array(z.number()).min(1), name: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return approvalsService.sendToApproval({ orgId, userId: ctx.user.id, creativeIds: input.creativeIds, name: input.name });
    }),

  clientApprove: protectedProcedure
    .input(z.object({ experimentId: z.number(), variantIds: z.array(z.number()).min(1), budgetDailyCents: z.number().int().min(1000).max(100000).optional() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return approvalsService.clientApprove({ orgId, userId: ctx.user.id, experimentId: input.experimentId, variantIds: input.variantIds, budgetDailyCents: input.budgetDailyCents });
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────

const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return notifService.listForOrg(orgId);
  }),
  unreadCount: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return 0;
    return notifService.unreadCount(orgId);
  }),
  markRead: protectedProcedure
    .input(z.object({ id: z.number().optional() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return { ok: true };
      return notifService.markRead(orgId, input.id).then(() => ({ ok: true }));
    }),
});

// ─── Diagnóstico Router (Cacá) ────────────────────────────────────────────────

const diagnosisRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return null;
    return diagnosisService.getPlan(orgId);
  }),
  // Arquiva o plano + radar atuais (snapshot recuperável depois) e zera o estado.
  // Use antes de regerar com outro perfil, para não perder o trabalho anterior.
  archive: protectedProcedure
    .input(z.object({ reason: z.string().optional() }).optional())
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return diagnosisService.archiveCurrentPlan(orgId, input?.reason ?? "user-requested");
    }),
  archives: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return diagnosisService.listArchives(orgId);
  }),
  refreshAllowance: protectedProcedure
    .input(z.object({ handle: z.string() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return { allowed: false, used: 0, limit: 0, resetAt: 0 };
      return diagnosisService.checkRefreshAllowance(orgId, input.handle);
    }),
  restoreArchive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return diagnosisService.restoreArchive(orgId, input.id);
    }),
  deleteArchive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return diagnosisService.deleteArchive(orgId, input.id);
    }),
  analyze: protectedProcedure
    .input(z.object({
      produto: z.string().min(3),
      objetivo: z.enum(["vender", "leads", "seguidores", "lancar"]).default("vender"),
      redes: z.record(z.string(), z.string()).optional(),
      sobre: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return diagnosisService.analyze({ orgId, produto: input.produto, objetivo: input.objetivo, redes: input.redes, sobre: input.sobre });
    }),
  recalibrate: protectedProcedure
    .input(z.object({ feedback: z.string().optional() }).optional())
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return diagnosisService.recalibrateWithRadar(orgId, input?.feedback);
    }),
});

// ─── Radar de Mercado Router ──────────────────────────────────────────────────

const radarRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return null;
    return radarService.getRadar(orgId);
  }),
  suggest: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) throw new Error("Organização não encontrada");
    return radarService.suggestSources(orgId);
  }),
  scan: protectedProcedure
    .input(z.object({ handles: z.array(z.string()).optional() }).optional())
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      return radarService.scan(orgId, { handles: input?.handles });
    }),
  refine: protectedProcedure
    .input(z.object({
      likedHandles: z.array(z.string()).optional(),
      likedPostKeys: z.array(z.string()).optional(),
      dislikedPostKeys: z.array(z.string()).optional(),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return radarService.refineWithFeedback(orgId, input);
    }),
  updateIdeaDecision: protectedProcedure
    .input(z.object({
      index: z.number(),
      decision: z.enum(["use", "skip", "agent"]),
      feedback: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return radarService.updateIdeaDecision(orgId, input.index, input.decision, input.feedback);
    }),
  // Gera a imagem de uma ideia do radar (na identidade do cliente)
  generateIdea: protectedProcedure
    .input(z.object({ index: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      const radar = await radarService.getRadar(orgId);
      const idea = radar?.ideas?.[input.index];
      if (!idea) throw new Error("Ideia não encontrada");
      const plan: any = await diagnosisService.getPlan(orgId);
      const ref = plan?.profile?.topPosts?.[0]?.img as string | undefined; // estilo do cliente
      const creative = await studioService.generateFromIdea(orgId, ctx.user.id, idea, ref);
      await radarService.attachCreativeToIdea(orgId, input.index, creative.id, creative.imageUrl);
      return creative;
    }),
});

// ─── Ovos de Ouro Router ──────────────────────────────────────────────────────

const ovosRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return null;
    return engine.dashboard(orgId);
  }),
  // dev/demo: força coletar métricas + redistribuir agora (sem esperar o cron)
  refresh: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return { ok: false };
    await engine.collectAllLive(7);
    await engine.reallocateAll();
    return { ok: true };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email.toLowerCase().trim());
        if (!user || !user.password) {
          throw new Error("Credenciais inválidas");
        }
        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) throw new Error("Credenciais inválidas");

        const token = await sdk.createSessionToken(user.id, user.email ?? input.email);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { ok: true, name: user.name, email: user.email, role: user.role };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  campaigns: campaignsRouter,
  creatives: creativesRouter,
  metrics: metricsRouter,
  integrations: integrationsRouter,
  dispatch: dispatchRouter,
  calibration: calibrationRouter,
  admin: adminRouter,
  credits: creditsRouter,
  studio: studioRouter,
  approvals: approvalsRouter,
  notifications: notificationsRouter,
  ovos: ovosRouter,
  diagnosis: diagnosisRouter,
  radar: radarRouter,
});

export type AppRouter = typeof appRouter;
