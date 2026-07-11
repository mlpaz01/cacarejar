import { z } from "zod";
import { eq, sql, and, gte } from "drizzle-orm";
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
  getDispatchLogsByOrg,
  createDispatchLog,
  updateDispatchLog,
  getCalibrationLogs,
  getCalibrationLogsByCampaign,
  getCalibrationLogById,
  createCalibrationLog,
  updateCalibrationLog,
  getDb,
  getUserByEmail,
  getAdminStats,
  getAllOrgs,
  listTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from "./db";
import { analyzeAndCalibrate } from "./openrouter";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import {
  approvals,
  campaigns,
  creditLedger,
  creditWallet,
  dispatchLogs,
  notificationPrefs,
  organizations,
  orgProfile,
  payments,
  users,
} from "../drizzle/schema";
import * as creditsService from "./services/credits";
import * as asaasService from "./services/asaas";
import * as studioService from "./services/studio";
import * as approvalsService from "./services/approvals";
import * as notifService from "./services/notifications";
import * as engine from "./services/engine";
import * as diagnosisService from "./services/diagnosis";
import * as adSpyService from "./services/adSpy";
import * as googleIntelService from "./services/googleIntel";
import * as radarService from "./services/radar";
import { creativeMatchesContext, getActiveOrgContext, mergeContextMeta } from "./services/context";

async function requireOrgCampaign(orgId: number, campaignId: number) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.organizationId !== orgId) throw new Error("Campanha nao encontrada");
  return campaign;
}

async function requireOrgCreative(orgId: number, creativeId: number) {
  const creative = await getCreativeById(creativeId);
  if (!creative || creative.organizationId !== orgId) throw new Error("Criativo nao encontrado");
  return creative;
}

async function requireOrgCalibration(orgId: number, calibrationId: number) {
  const calibration = await getCalibrationLogById(calibrationId);
  if (!calibration || calibration.organizationId !== orgId) throw new Error("Leitura nao encontrada");
  return calibration;
}

function creditHoldError(reason: "saldo_insuficiente" | "cota_diaria" | "db") {
  if (reason === "saldo_insuficiente") return "Creditos insuficientes. Recarregue sua carteira em Creditos.";
  if (reason === "cota_diaria") return "Cota diaria de creditos atingida. Tente novamente amanha ou ajuste seu plano.";
  return "Nao foi possivel reservar creditos.";
}

async function holdCredits(orgId: number, cc: number, ref: string, description: string) {
  const h = await creditsService.hold(orgId, cc, ref, { description });
  if (!h.ok) throw new Error(creditHoldError(h.reason));
  return h.holdLedgerId;
}

// ─── Campaigns Router ─────────────────────────────────────────────────────────

const campaignsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    const orgId = ctx.user.organizationId;
    if (!orgId) return [];
    return getCampaigns(orgId);
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return requireOrgCampaign(orgId, input.id);
    }),

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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCampaign(orgId, input.id);
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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCampaign(orgId, input.id);
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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      const campaign = await requireOrgCampaign(orgId, input.campaignId);
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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      const campaign = await requireOrgCampaign(orgId, input.campaignId);
      if (!campaign?.scheduleCronTaskUid) throw new Error("Nenhum agendamento ativo");
      await updateHeartbeatJob(campaign.scheduleCronTaskUid, { enable: false });
      return { success: true };
    }),
});

// ─── Creatives Router ─────────────────────────────────────────────────────────

const creativesRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return [];
      if (input.campaignId !== undefined) await requireOrgCampaign(orgId, input.campaignId);
      const activeContext = await getActiveOrgContext(orgId);
      if (!activeContext) return [];
      const rows = await getCreatives(orgId, input.campaignId);
      return rows.filter((creative) => creativeMatchesContext(creative, activeContext));
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return requireOrgCreative(orgId, input.id);
    }),

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

      const activeContext = await getActiveOrgContext(orgId);
      const { UPLOADS_DIR } = await import("./_core/index");

      const base64 = input.imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const fileName = `${nanoid()}.${input.ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(filePath, buffer);

      const imageUrl = `/uploads/${fileName}`;

      if (input.campaignId !== undefined) await requireOrgCampaign(orgId, input.campaignId);

      const insertResult = await createCreative({
        organizationId: orgId,
        userId: ctx.user.id,
        campaignId: input.campaignId,
        briefing: input.briefing,
        imageUrl,
        channels: input.channels,
        generationMeta: mergeContextMeta({ source: "upload" }, activeContext),
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

      if (input.campaignId !== undefined) await requireOrgCampaign(orgId, input.campaignId);

      const insertResult = await createCreative({
        organizationId: orgId,
        userId: ctx.user.id,
        campaignId: input.campaignId,
        briefing: input.briefing,
        imageUrl: input.imageUrl,
        channels: input.channels,
        generationMeta: mergeContextMeta({ source: "url-import" }, await getActiveOrgContext(orgId)),
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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCreative(orgId, input.id);
      await updateCreative(input.id, { status: input.status });
      return { success: true };
    }),

  linkToCampaign: protectedProcedure
    .input(z.object({ id: z.number(), campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCreative(orgId, input.id);
      await requireOrgCampaign(orgId, input.campaignId);
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
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCampaign(orgId, input.campaignId);
      return getMetrics(
        input.campaignId,
        input.from ? new Date(input.from) : undefined,
        input.to ? new Date(input.to) : undefined
      );
    }),

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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCampaign(orgId, input.campaignId);
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
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return [];
      if (input.campaignId !== undefined) await requireOrgCampaign(orgId, input.campaignId);
      return getDispatchLogsByOrg(orgId, input.campaignId, input.channel);
    }),

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
      await requireOrgCampaign(orgId, input.campaignId);
      if (input.creativeId !== undefined) await requireOrgCreative(orgId, input.creativeId);
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
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return [];
      await requireOrgCampaign(orgId, input.campaignId);
      return getCalibrationLogsByCampaign(input.campaignId);
    }),

  analyze: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");

      const campaign = await requireOrgCampaign(orgId, input.campaignId);
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
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCalibration(orgId, input.id);
      await updateCalibrationLog(input.id, { status: "aplicado", appliedAt: new Date() });
      return { success: true };
    }),

  ignore: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      await requireOrgCalibration(orgId, input.id);
      await updateCalibrationLog(input.id, { status: "ignorado" });
      return { success: true };
    }),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────

const adminRouter = router({
  stats: adminProcedure.query(() => getAdminStats()),

  health: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const since24h = new Date(Date.now() - 86_400_000);
    const since7d = new Date(Date.now() - 7 * 86_400_000);

    const [
      [orgsRow],
      [profilesRow],
      [pendingPaymentsRow],
      [failedDispatchesRow],
      [reviewQueueRow],
      [walletRow],
      creditRows,
      testimonialRows,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(organizations),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orgProfile)
        .where(gte(orgProfile.updatedAt, since7d)),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(payments)
        .where(eq(payments.status, "pendente")),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(dispatchLogs)
        .where(and(eq(dispatchLogs.status, "falhou"), gte(dispatchLogs.createdAt, since7d))),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(approvals)
        .where(sql`${approvals.reviewStatus} IN ('pendente', 'em_revisao')`),
      db
        .select({
          heldCC: sql<number>`COALESCE(SUM(${creditWallet.heldCC}), 0)`,
          balanceCC: sql<number>`COALESCE(SUM(${creditWallet.balanceCC}), 0)`,
          wallets: sql<number>`COUNT(*)`,
        })
        .from(creditWallet),
      db
        .select({
          ref: creditLedger.ref,
          count: sql<number>`COUNT(*)`,
          credits: sql<number>`COALESCE(SUM(ABS(${creditLedger.amountCC})), 0)`,
        })
        .from(creditLedger)
        .where(and(eq(creditLedger.type, "consumo"), gte(creditLedger.createdAt, since7d)))
        .groupBy(creditLedger.ref),
      listTestimonials().catch(() => []),
    ]);

    const publishedTestimonials = testimonialRows.filter(row => row.isPublished).length;
    const operations = creditRows
      .map(row => ({
        ref: row.ref || "sem referencia",
        group: (row.ref || "outro").split(":")[0],
        count: Number(row.count ?? 0),
        credits: Number(row.credits ?? 0),
      }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10);

    const cards = {
      totalOrgs: Number(orgsRow?.count ?? 0),
      profilesUpdated7d: Number(profilesRow?.count ?? 0),
      pendingPayments: Number(pendingPaymentsRow?.count ?? 0),
      failedDispatches7d: Number(failedDispatchesRow?.count ?? 0),
      reviewQueue: Number(reviewQueueRow?.count ?? 0),
      heldCC: Number(walletRow?.heldCC ?? 0),
      balanceCC: Number(walletRow?.balanceCC ?? 0),
      wallets: Number(walletRow?.wallets ?? 0),
      publishedTestimonials,
      totalTestimonials: testimonialRows.length,
    };

    const alerts: Array<{ level: "ok" | "warn" | "danger"; title: string; detail: string }> = [];
    if (cards.failedDispatches7d > 0) {
      alerts.push({
        level: "danger",
        title: "Falhas de publicacao nos ultimos 7 dias",
        detail: `${cards.failedDispatches7d} registro(s) precisam de revisao manual.`,
      });
    }
    if (cards.heldCC > 0) {
      alerts.push({
        level: "warn",
        title: "Creditos reservados em aberto",
        detail: `${cards.heldCC} credito(s) centesimais ainda estao em hold.`,
      });
    }
    if (cards.pendingPayments > 0) {
      alerts.push({
        level: "warn",
        title: "Pagamentos pendentes",
        detail: `${cards.pendingPayments} pagamento(s) aguardando confirmacao.`,
      });
    }
    if (cards.reviewQueue > 0) {
      alerts.push({
        level: "warn",
        title: "Fila de revisao com itens",
        detail: `${cards.reviewQueue} item(ns) ainda aguardam aprovacao operacional.`,
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        level: "ok",
        title: "Operacao sem bloqueios criticos",
        detail: "Nao encontrei falhas recentes, pagamentos pendentes ou fila operacional urgente.",
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      since24h: since24h.toISOString(),
      since7d: since7d.toISOString(),
      cards,
      alerts,
      operations,
    };
  }),

  orgs: adminProcedure.query(() => getAllOrgs()),

  testimonials: adminProcedure.query(() => listTestimonials()),

  createTestimonial: adminProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(160),
      company: z.string().trim().max(180).optional(),
      niche: z.string().trim().max(160).optional(),
      quote: z.string().trim().min(10).max(1200),
      resultLabel: z.string().trim().max(255).optional(),
      imageUrl: z.string().trim().max(1200).optional(),
      isPublished: z.boolean().default(false),
      sortOrder: z.number().int().min(0).max(9999).default(0),
    }))
    .mutation(async ({ input }) => {
      const id = await createTestimonial({
        ...input,
        company: input.company || null,
        niche: input.niche || null,
        resultLabel: input.resultLabel || null,
        imageUrl: input.imageUrl || null,
      });
      return { success: true, id };
    }),

  updateTestimonial: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(2).max(160).optional(),
      company: z.string().trim().max(180).nullable().optional(),
      niche: z.string().trim().max(160).nullable().optional(),
      quote: z.string().trim().min(10).max(1200).optional(),
      resultLabel: z.string().trim().max(255).nullable().optional(),
      imageUrl: z.string().trim().max(1200).nullable().optional(),
      isPublished: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      const cleanPatch: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        cleanPatch[key] = typeof value === "string" ? value.trim() || null : value;
      }
      await updateTestimonial(id, cleanPatch as any);
      return { success: true };
    }),

  deleteTestimonial: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteTestimonial(input.id);
      return { success: true };
    }),

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

  financials: adminProcedure
    .input(z.object({ days: z.number().int().min(0).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const since = input.days > 0 ? new Date(Date.now() - input.days * 86_400_000) : new Date(0);

      // Receita de pagamentos confirmados
      const [revRow] = await db
        .select({
          totalCents: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(payments)
        .where(and(eq(payments.status, "pago"), gte(payments.paidAt, since)));

      // Operações de crédito por ref (consumo = crédito negativo)
      const opsRows = await db
        .select({
          ref: creditLedger.ref,
          cnt: sql<number>`COUNT(*)`,
          ccTotal: sql<number>`COALESCE(SUM(ABS(${creditLedger.amountCC})), 0)`,
        })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.type, "consumo"),
            gte(creditLedger.createdAt, since),
          )
        )
        .groupBy(creditLedger.ref);

      // Novas contas (via boas-vindas)
      const [welcomeRow] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.type, "bonus"),
            sql`${creditLedger.ref} LIKE 'welcome:%'`,
            gte(creditLedger.createdAt, since),
          )
        );

      // Agrupa operações por prefixo de ref
      const opMap: Record<string, { cnt: number; ccTotal: number }> = {};
      for (const row of opsRows) {
        const prefix = (row.ref ?? "outro").split(":")[0];
        if (!opMap[prefix]) opMap[prefix] = { cnt: 0, ccTotal: 0 };
        opMap[prefix].cnt += Number(row.cnt);
        opMap[prefix].ccTotal += Number(row.ccTotal);
      }

      // Custo estimado em BRL (câmbio fixo R$5.80/USD)
      const USD_BRL = 5.80;
      const creative = opMap["creative"] ?? { cnt: 0, ccTotal: 0 };
      const radar = opMap["radar"] ?? { cnt: 0, ccTotal: 0 };
      const adspy = opMap["adspy"] ?? { cnt: 0, ccTotal: 0 };
      const diagnosis = opMap["diagnosis"] ?? { cnt: 0, ccTotal: 0 };

      // Estimativas de custo por operação em USD
      const creativeUsd = creative.cnt * 0.05; // ~R$0.29 → ~$0.05
      const radarUsd = radar.cnt * 0.031;       // ~R$0.18 → ~$0.031
      const adspyUsd = adspy.cnt * 0.069;       // ~R$0.40 → ~$0.069
      const diagnosisUsd = diagnosis.cnt * 0.138; // ~R$0.80 → ~$0.138
      const newAccounts = Number(welcomeRow?.cnt ?? 0);
      const welcomeBonusUsd = newAccounts * 0.138; // diagnóstico gratuito na criação
      const totalCostUsd = creativeUsd + radarUsd + adspyUsd + diagnosisUsd + welcomeBonusUsd;
      const totalCostBrl = totalCostUsd * USD_BRL;

      const revenueBrl = Number(revRow?.totalCents ?? 0) / 100;
      const marginBrl = revenueBrl - totalCostBrl;
      const marginPct = revenueBrl > 0 ? (marginBrl / revenueBrl) * 100 : 0;

      return {
        period: { days: input.days },
        revenue: { brl: revenueBrl, count: Number(revRow?.count ?? 0) },
        cost: {
          totalBrl: totalCostBrl,
          breakdown: { creative: creativeUsd * USD_BRL, radar: radarUsd * USD_BRL, adspy: adspyUsd * USD_BRL, diagnosis: diagnosisUsd * USD_BRL, welcome: welcomeBonusUsd * USD_BRL },
        },
        margin: { brl: marginBrl, pct: marginPct },
        ops: {
          creative: creative.cnt,
          radar: radar.cnt,
          adspy: adspy.cnt,
          diagnosis: diagnosis.cnt,
          newAccounts,
        },
      };
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

  // Asaas está configurado? (UI escolhe PIX real vs compra simulada)
  asaasOn: publicProcedure.query(() => asaasService.asaasEnabled()),

  // Cria cobrança PIX real (Asaas) para um pacote. Devolve QR + copia-e-cola.
  createTopupPix: protectedProcedure
    .input(z.object({ pkg: z.enum(["boton", "ninhada", "galinheiro", "granja"]), cpfCnpj: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      if (!asaasService.asaasEnabled()) throw new Error("Pagamento ainda não configurado. Tente novamente em instantes.");
      const db = await getDb();
      if (!db) throw new Error("Banco indisponível");
      const p = PACKAGES[input.pkg];

      const customerId = await asaasService.ensureCustomer({
        orgId,
        name: ctx.user.name || ctx.user.email || `Org ${orgId}`,
        email: ctx.user.email || undefined,
        cpfCnpj: input.cpfCnpj,
      });

      // registra o pagamento como pendente (ccAmount = créditos do pacote)
      const ins = await db.insert(payments).values({
        organizationId: orgId,
        kind: "topup",
        provider: "asaas",
        amountCents: p.cents,
        ccAmount: p.cc,
        status: "pendente",
      });
      const paymentId = creditsService.insertIdOf(ins);

      const charge = await asaasService.createPixPayment({
        customerId,
        value: p.cents / 100,
        description: `Cacarejar — ${p.label} (${p.cc} créditos)`,
        externalReference: `payment:${paymentId}`,
      });
      await db.update(payments).set({ externalId: charge.id }).where(eq(payments.id, paymentId));

      const qr = await asaasService.getPixQr(charge.id);
      return {
        paymentId,
        asaasId: charge.id,
        valueCents: p.cents,
        cc: p.cc,
        label: p.label,
        pixPayload: qr?.payload ?? null,
        pixQrImage: qr?.encodedImage ?? null,
        invoiceUrl: charge.invoiceUrl ?? null,
      };
    }),

  // Checa o status do pagamento (e credita se confirmou, caso o webhook ainda não tenha chegado).
  paymentStatus: protectedProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) return { status: "pendente" as const };
      const db = await getDb();
      if (!db) return { status: "pendente" as const };
      const rows = await db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
      const row = rows[0];
      if (!row || row.organizationId !== orgId) return { status: "pendente" as const };
      if (row.status === "pago") return { status: "pago" as const };

      // fallback: consulta o Asaas direto (caso o webhook atrase)
      if (row.externalId && asaasService.asaasEnabled()) {
        const live = await asaasService.getPayment(row.externalId);
        if (live && asaasService.isPaidStatus(live.status)) {
          await db.update(payments).set({ status: "pago", paidAt: new Date() }).where(eq(payments.id, row.id));
          if ((row.ccAmount ?? 0) > 0) {
            await creditsService.credit(orgId, row.ccAmount ?? 0, "recarga", {
              ref: `payment:${row.id}`,
              description: `Recarga via PIX (Asaas) — ${row.ccAmount} CC`,
              idempotencyKey: `asaas:${row.externalId}`,
            });
          }
          return { status: "pago" as const };
        }
      }
      return { status: "pendente" as const };
    }),

  // MVP: compra simulada (sem gateway ainda — Asaas entra no Sprint 6).
  // Credita direto para destravar testes do estúdio.
  buyMock: protectedProcedure
    .input(z.object({ pkg: z.enum(["boton", "ninhada", "galinheiro", "granja"]) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      if (asaasService.asaasEnabled()) throw new Error("Compra simulada bloqueada com o Asaas habilitado.");
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

  // Cria ou reaproveita um criativo ligado a uma sugestao/post de origem
  ensureOriginCreative: protectedProcedure
    .input(z.object({
      originType: z.enum(["diagnosis-plan", "radar-idea"]),
      index: z.number().int().min(0),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return studioService.ensureCreativeForOrigin(orgId, ctx.user.id, input.originType, input.index);
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
      humanReview: z.any().optional(),
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
  duplicateCreative: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return studioService.duplicateCreative(orgId, ctx.user.id, input.id);
    }),

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

// ─── Settings Router ─────────────────────────────────────────────────────────

const cleanOptionalText = (value?: string | null) => {
  const text = value?.trim();
  return text ? text : null;
};

const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.user.organizationId;
    const db = await getDb();

    if (!orgId || !db) {
      return {
        user: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
          role: ctx.user.role,
        },
        organization: null,
        profile: null,
        notifications: {
          emailEnabled: true,
          prefs: {},
        },
      };
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const [profile] = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
    const [prefs] = await db
      .select()
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.organizationId, orgId), eq(notificationPrefs.userId, ctx.user.id)))
      .limit(1);

    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
      },
      organization: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            isActive: org.isActive,
          }
        : null,
      profile: profile
        ? {
            nicho: profile.nicho,
            produto: profile.produto,
            objetivo: profile.objetivo,
            site: profile.site,
            redes: profile.redes ?? {},
          }
        : null,
      notifications: {
        emailEnabled: prefs?.emailEnabled ?? true,
        prefs: prefs?.prefs ?? {},
      },
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        user: z
          .object({
            name: z.string().trim().min(2, "Informe seu nome").max(120).optional(),
          })
          .optional(),
        organization: z
          .object({
            name: z.string().trim().min(2, "Informe o nome da empresa").max(160).optional(),
          })
          .optional(),
        profile: z
          .object({
            nicho: z.string().trim().max(128).optional(),
            produto: z.string().trim().max(1000).optional(),
            objetivo: z.string().trim().max(64).optional(),
            site: z.string().trim().max(320).optional(),
            redes: z
              .object({
                instagram: z.string().trim().max(120).optional(),
                linkedin: z.string().trim().max(320).optional(),
                tiktok: z.string().trim().max(120).optional(),
              })
              .optional(),
          })
          .optional(),
        notifications: z
          .object({
            emailEnabled: z.boolean().optional(),
            prefs: z.record(z.string(), z.boolean()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.user?.name !== undefined) {
        await db.update(users).set({ name: input.user.name }).where(eq(users.id, ctx.user.id));
      }

      if (input.organization?.name !== undefined) {
        await db.update(organizations).set({ name: input.organization.name }).where(eq(organizations.id, orgId));
      }

      if (input.profile) {
        const redes = input.profile.redes
          ? Object.fromEntries(
              Object.entries(input.profile.redes)
                .map(([key, value]) => [key, cleanOptionalText(value)])
                .filter(([, value]) => Boolean(value))
            )
          : undefined;

        const profileValues = {
          organizationId: orgId,
          nicho: cleanOptionalText(input.profile.nicho),
          produto: cleanOptionalText(input.profile.produto),
          objetivo: cleanOptionalText(input.profile.objetivo),
          site: cleanOptionalText(input.profile.site),
          ...(redes ? { redes } : {}),
        };

        await db
          .insert(orgProfile)
          .values(profileValues)
          .onDuplicateKeyUpdate({
            set: {
              nicho: profileValues.nicho,
              produto: profileValues.produto,
              objetivo: profileValues.objetivo,
              site: profileValues.site,
              ...(redes ? { redes } : {}),
            },
          });
      }

      if (input.notifications) {
        const emailEnabled = input.notifications.emailEnabled ?? true;
        const prefs = input.notifications.prefs ?? {};
        const existing = await db
          .select()
          .from(notificationPrefs)
          .where(and(eq(notificationPrefs.organizationId, orgId), eq(notificationPrefs.userId, ctx.user.id)))
          .limit(1);

        if (existing.length) {
          await db
            .update(notificationPrefs)
            .set({ emailEnabled, prefs })
            .where(and(eq(notificationPrefs.organizationId, orgId), eq(notificationPrefs.userId, ctx.user.id)));
        } else {
          await db.insert(notificationPrefs).values({
            organizationId: orgId,
            userId: ctx.user.id,
            emailEnabled,
            prefs,
          });
        }
      }

      return { success: true };
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
  updateAcompanhamento: protectedProcedure
    .input(z.object({ acompanhamento: z.any(), feedback: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return diagnosisService.updateAcompanhamento(orgId, input.acompanhamento, input.feedback);
    }),
  // Espião de Anúncios — 1º scan grátis por org; a partir do 2º cobra 25 CC.
  updateSevenDayItem: protectedProcedure
    .input(z.object({
      index: z.number().int().min(0),
      patch: z.object({
        status: z.enum(["ideia", "em_edicao", "aprovado", "publicado", "medir"]).optional(),
        publicadoUrl: z.string().optional(),
        resultado: z.object({
          alcance: z.number().optional(),
          visualizacoes: z.number().optional(),
          curtidas: z.number().optional(),
          comentarios: z.number().optional(),
          salvamentos: z.number().optional(),
          compartilhamentos: z.number().optional(),
          cliques: z.number().optional(),
          leads: z.number().optional(),
          vendas: z.number().optional(),
          receita: z.number().optional(),
          observacoes: z.string().optional(),
        }).optional(),
      }),
    }))
    .mutation(({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      return diagnosisService.updateSevenDayPlanItem(orgId, input.index, input.patch as any);
    }),
  scanAds: protectedProcedure
    .input(z.object({ query: z.string().optional() }).nullish())
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      const plan = await diagnosisService.getPlan(orgId);
      const isFirstScan = !plan?.anunciosConcorrentes?.length;
      let holdId: number | null = null;
      if (!isFirstScan) {
        const h = await creditsService.hold(orgId, 25, "adspy:scan", { description: "Espião de anúncios — scan adicional", bypassDaily: true });
        if (!h.ok) throw new Error(h.reason === "saldo_insuficiente" ? "Créditos insuficientes. Recarregue sua carteira em Créditos." : "Não foi possível reservar créditos.");
        holdId = h.holdLedgerId!;
      }
      try {
        const result = await adSpyService.scanAdSpy(orgId, { query: input?.query });
        if (holdId !== null) {
          if (Array.isArray(result.ads) && result.ads.length > 0) await creditsService.settle(orgId, holdId);
          else await creditsService.release(orgId, holdId);
        }
        return result;
      } catch (e) {
        if (holdId !== null) await creditsService.release(orgId, holdId);
        throw e;
      }
    }),
  // Inteligência de Google — buscas reais (autocomplete) + pautas de SEO.
  scanGoogle: protectedProcedure
    .input(z.object({ query: z.string().optional() }).nullish())
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organizacao nao encontrada");
      const holdId = await holdCredits(
        orgId,
        creditsService.CC_COST.diagnostico,
        "diagnosis:scanGoogle",
        "Inteligencia de Google e pautas de SEO"
      );
      try {
        const result = await googleIntelService.scanGoogleIntel(orgId, { query: input?.query });
        await creditsService.settle(orgId, holdId);
        return result;
      } catch (e) {
        await creditsService.release(orgId, holdId);
        throw e;
      }
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
    .input(z.object({ handles: z.array(z.string()).optional() }).nullish())
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.organizationId;
      if (!orgId) throw new Error("Organização não encontrada");
      const holdId = await holdCredits(
        orgId,
        creditsService.CC_COST.recalibracao,
        "radar:scan",
        "Radar de mercado e concorrencia"
      );
      try {
        const result = await radarService.scan(orgId, { handles: input?.handles });
        await creditsService.settle(orgId, holdId);
        return result;
      } catch (e) {
        await creditsService.release(orgId, holdId);
        throw e;
      }
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
  settings: settingsRouter,
  ovos: ovosRouter,
  diagnosis: diagnosisRouter,
  radar: radarRouter,
});

export type AppRouter = typeof appRouter;
