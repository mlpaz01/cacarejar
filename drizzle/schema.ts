import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Organizations ────────────────────────────────────────────────────────────

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  plan: mysqlEnum("plan", ["free", "starter", "pro"]).default("free").notNull(),
  pagarmeCustomerId: varchar("pagarmeCustomerId", { length: 255 }),
  pagarmeSubscriptionId: varchar("pagarmeSubscriptionId", { length: 255 }),
  planExpiresAt: timestamp("planExpiresAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  password: varchar("password", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  organizationId: int("organizationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  objective: varchar("objective", { length: 128 }).notNull(),
  targetAudience: text("targetAudience"),
  budgetTotal: decimal("budgetTotal", { precision: 12, scale: 2 }).notNull(),
  budgetSpent: decimal("budgetSpent", { precision: 12, scale: 2 }).default("0"),
  channels: json("channels").$type<string[]>().notNull(),
  status: mysqlEnum("status", ["rascunho", "ativa", "pausada", "concluida", "arquivada"])
    .default("rascunho")
    .notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Creatives ────────────────────────────────────────────────────────────────

export const creatives = mysqlTable("creatives", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  campaignId: int("campaignId"),
  experimentId: int("experimentId"),
  userId: int("userId").notNull(),
  briefing: text("briefing").notNull(),
  copy: text("copy"),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  ratio: varchar("ratio", { length: 12 }).default("1:1"),
  lente: mysqlEnum("lente", ["dor", "desejo"]),
  formato: varchar("formato", { length: 32 }),
  factorValues: json("factorValues").$type<Record<string, string>>(),
  generationMeta: json("generationMeta").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["gerando", "rascunho", "aprovado", "rejeitado", "em_uso"])
    .default("gerando")
    .notNull(),
  channels: json("channels").$type<string[]>(),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Creative = typeof creatives.$inferSelect;
export type InsertCreative = typeof creatives.$inferInsert;

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const metrics = mysqlTable("metrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  channel: varchar("channel", { length: 64 }).notNull(),
  date: timestamp("date").notNull(),
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  conversions: int("conversions").default(0),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  roi: decimal("roi", { precision: 8, scale: 4 }).default("0"),
  ctr: decimal("ctr", { precision: 8, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 8, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

// ─── Integrations ─────────────────────────────────────────────────────────────

export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  channel: mysqlEnum("channel", ["linkedin", "tiktok", "instagram", "google"]).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  status: mysqlEnum("status", ["conectado", "desconectado", "erro"]).default("desconectado").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;

// ─── Dispatch Logs ────────────────────────────────────────────────────────────

export const dispatchLogs = mysqlTable("dispatch_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  campaignId: int("campaignId").notNull(),
  creativeId: int("creativeId"),
  channel: varchar("channel", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["agendado", "enviado", "falhou", "cancelado"])
    .default("agendado")
    .notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  executedAt: timestamp("executedAt"),
  errorMessage: text("errorMessage"),
  externalId: varchar("externalId", { length: 255 }),
  payload: json("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DispatchLog = typeof dispatchLogs.$inferSelect;
export type InsertDispatchLog = typeof dispatchLogs.$inferInsert;

// ─── Calibration Logs ─────────────────────────────────────────────────────────

export const calibrationLogs = mysqlTable("calibration_logs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId").notNull(),
  analysis: text("analysis").notNull(),
  suggestions: json("suggestions").$type<CalibrationSuggestion[]>().notNull(),
  status: mysqlEnum("status", ["pendente", "aplicado", "ignorado"]).default("pendente").notNull(),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CalibrationLog = typeof calibrationLogs.$inferSelect;
export type InsertCalibrationLog = typeof calibrationLogs.$inferInsert;

export type CalibrationSuggestion = {
  tipo: "orcamento" | "publico_alvo" | "criativo" | "canal";
  descricao: string;
  valorAtual?: string;
  valorSugerido?: string;
  impactoEstimado?: string;
};

// ══════════════════════════════════════════════════════════════════════════════
// SPRINT 1 — Fundação do motor (créditos, planos, config, taxonomia, experimentos)
// ══════════════════════════════════════════════════════════════════════════════

// ─── Planos ─────────────────────────────────────────────────────────────────
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // free/starter/crescimento/escala/agencia
  name: varchar("name", { length: 64 }).notNull(),
  priceCents: int("priceCents").default(0).notNull(),
  ccIncluded: int("ccIncluded").default(0).notNull(),
  dailyQuotaCC: int("dailyQuotaCC").default(0).notNull(),
  limits: json("limits").$type<Record<string, number>>(),
  allowedModels: json("allowedModels").$type<string[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

// ─── Carteira de créditos ───────────────────────────────────────────────────
export const creditWallet = mysqlTable("credit_wallet", {
  organizationId: int("organizationId").primaryKey(),
  balanceCC: int("balanceCC").default(0).notNull(), // saldo disponível
  heldCC: int("heldCC").default(0).notNull(),        // reservado (hold) ainda não liquidado
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CreditWallet = typeof creditWallet.$inferSelect;

export const creditLedger = mysqlTable("credit_ledger", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  type: mysqlEnum("type", ["recarga", "hold", "consumo", "estorno", "bonus", "ajuste"]).notNull(),
  amountCC: int("amountCC").notNull(), // positivo entra, negativo sai
  costUsdMicros: int("costUsdMicros").default(0), // custo real medido (p/ margem)
  ref: varchar("ref", { length: 128 }), // ex: creative:123, payment:abc
  description: varchar("description", { length: 255 }),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CreditLedger = typeof creditLedger.$inferSelect;
export type InsertCreditLedger = typeof creditLedger.$inferInsert;

export const creditDailyCounter = mysqlTable("credit_daily_counter", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  usedCC: int("usedCC").default(0).notNull(),
});
export type CreditDailyCounter = typeof creditDailyCounter.$inferSelect;

// ─── Pagamentos & assinaturas ───────────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  kind: mysqlEnum("kind", ["assinatura", "topup"]).notNull(),
  provider: varchar("provider", { length: 32 }).default("asaas"),
  amountCents: int("amountCents").notNull(),
  ccAmount: int("ccAmount").default(0), // se for topup de créditos
  status: mysqlEnum("status", ["pendente", "pago", "falhou", "estornado"]).default("pendente").notNull(),
  externalId: varchar("externalId", { length: 128 }),
  webhookRaw: json("webhookRaw").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  planKey: varchar("planKey", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["ativa", "cancelada", "inadimplente", "trial"]).default("trial").notNull(),
  provider: varchar("provider", { length: 32 }).default("asaas"),
  externalId: varchar("externalId", { length: 128 }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Subscription = typeof subscriptions.$inferSelect;

// ─── Perfil da org (diagnóstico) ────────────────────────────────────────────
export const orgProfile = mysqlTable("org_profile", {
  organizationId: int("organizationId").primaryKey(),
  nicho: varchar("nicho", { length: 128 }),
  produto: text("produto"),
  objetivo: varchar("objetivo", { length: 64 }),
  site: varchar("site", { length: 320 }),
  redes: json("redes").$type<Record<string, string>>(),
  dnaOrganico: json("dnaOrganico").$type<Record<string, unknown>>(),
  publicoAlvo: json("publicoAlvo").$type<Record<string, unknown>>(),
  resumoDiagnostico: text("resumoDiagnostico"),
  planoJson: json("planoJson").$type<Record<string, unknown>>(),
  radarJson: json("radarJson").$type<Record<string, unknown>>(),
  archivedPlans: json("archivedPlans").$type<Array<{ archivedAt: number; reason?: string; nicho?: string; produto?: string; redes?: Record<string, string>; planoJson?: any; radarJson?: any }>>(),
  refreshHistory: json("refreshHistory").$type<Array<{ at: number; handle?: string }>>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgProfile = typeof orgProfile.$inferSelect;

// ─── Membros da org (equipe) ────────────────────────────────────────────────
export const orgMembers = mysqlTable("org_members", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["owner", "admin", "membro"]).default("membro").notNull(),
  status: mysqlEnum("status", ["ativo", "convidado"]).default("convidado").notNull(),
  invitedAt: timestamp("invitedAt").defaultNow().notNull(),
});
export type OrgMember = typeof orgMembers.$inferSelect;

// ─── Taxonomia (Teste A/Z) ──────────────────────────────────────────────────
export const factorDefinitions = mysqlTable("factor_definitions", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 48 }).notNull().unique(),
  dimensao: mysqlEnum("dimensao", ["imagem", "copy", "oferta", "publico"]).notNull(),
  label: varchar("label", { length: 96 }).notNull(),
  values: json("values").$type<{ key: string; label: string; promptFragment?: string }[]>().notNull(),
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
});
export type FactorDefinition = typeof factorDefinitions.$inferSelect;
export type InsertFactorDefinition = typeof factorDefinitions.$inferInsert;

// ─── Experimentos & variantes ───────────────────────────────────────────────
export const experiments = mysqlTable("experiments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  objetivo: varchar("objetivo", { length: 64 }),
  channel: mysqlEnum("channel", ["meta", "google", "tiktok", "linkedin"]).default("meta").notNull(),
  designType: varchar("designType", { length: 32 }).default("fatorial"),
  status: mysqlEnum("status", [
    "rascunho", "aguardando_cliente", "aprovado_cliente",
    "em_revisao", "aprovado", "reprovado", "agendado", "no_ar", "pausado", "arquivado",
  ]).default("rascunho").notNull(),
  budgetDailyCents: int("budgetDailyCents").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = typeof experiments.$inferInsert;

export const variants = mysqlTable("variants", {
  id: int("id").autoincrement().primaryKey(),
  experimentId: int("experimentId").notNull(),
  organizationId: int("organizationId").notNull(),
  creativeId: int("creativeId"),
  factorValues: json("factorValues").$type<Record<string, string>>(),
  budgetSharePct: decimal("budgetSharePct", { precision: 5, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["em_teste", "ovo_de_ouro", "perdeu", "pausada"]).default("em_teste").notNull(),
  isWinner: boolean("isWinner").default(false),
  externalRef: varchar("externalRef", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Variant = typeof variants.$inferSelect;

// ─── Aprovação & revisão ────────────────────────────────────────────────────
export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  itemType: mysqlEnum("itemType", ["experiment", "creative", "action"]).notNull(),
  itemId: int("itemId").notNull(),
  clientApprovedBy: int("clientApprovedBy"),
  clientApprovedAt: timestamp("clientApprovedAt"),
  reviewMode: mysqlEnum("reviewMode", ["manual", "semi", "auto"]).default("semi").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["pendente", "em_revisao", "aprovado", "reprovado"])
    .default("pendente").notNull(),
  reviewedBy: varchar("reviewedBy", { length: 64 }), // operador ou "agentes"
  reason: text("reason"),
  notifiedAt: timestamp("notifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Approval = typeof approvals.$inferSelect;

export const reviewChecks = mysqlTable("review_checks", {
  id: int("id").autoincrement().primaryKey(),
  approvalId: int("approvalId").notNull(),
  reviewer: mysqlEnum("reviewer", ["conformidade", "marca", "performance"]).notNull(),
  verdict: mysqlEnum("verdict", ["pass", "flag", "fail"]).notNull(),
  notes: text("notes"),
  byAgentModel: varchar("byAgentModel", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReviewCheck = typeof reviewChecks.$inferSelect;

// ─── Contas de canal (OAuth do cliente) ─────────────────────────────────────
export const channelAccounts = mysqlTable("channel_accounts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  channel: mysqlEnum("channel", ["meta", "google", "tiktok", "linkedin"]).notNull(),
  mode: mysqlEnum("mode", ["client_owned", "agency"]).default("client_owned").notNull(),
  externalAccountId: varchar("externalAccountId", { length: 128 }),
  accountName: varchar("accountName", { length: 255 }),
  accessTokenEnc: text("accessTokenEnc"),
  refreshTokenEnc: text("refreshTokenEnc"),
  expiresAt: timestamp("expiresAt"),
  status: mysqlEnum("status", ["conectado", "desconectado", "erro"]).default("desconectado").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChannelAccount = typeof channelAccounts.$inferSelect;

// ─── Fila de disparo & métricas (timeseries) ────────────────────────────────
export const adDispatches = mysqlTable("ad_dispatches", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  channel: mysqlEnum("channel", ["meta", "google", "tiktok", "linkedin", "mock"]).default("mock").notNull(),
  op: mysqlEnum("op", ["create_campaign", "upload_creative", "create_ad", "set_budget", "pause", "resume"]).notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["pendente", "processando", "enviado", "falhou"]).default("pendente").notNull(),
  attempts: int("attempts").default(0).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),
  externalRef: varchar("externalRef", { length: 128 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdDispatch = typeof adDispatches.$inferSelect;

export const metricsTimeseries = mysqlTable("metrics_timeseries", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  variantId: int("variantId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  leads: int("leads").default(0),
  conversions: int("conversions").default(0),
  spendCents: int("spendCents").default(0),
  revenueCents: int("revenueCents").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MetricsTimeseries = typeof metricsTimeseries.$inferSelect;

// ─── Notificações ───────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),
  type: varchar("type", { length: 48 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  channels: json("channels").$type<string[]>().default(["platform"]),
  readAt: timestamp("readAt"),
  emailSentAt: timestamp("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const notificationPrefs = mysqlTable("notification_prefs", {
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  emailEnabled: boolean("emailEnabled").default(true),
  prefs: json("prefs").$type<Record<string, boolean>>(),
});
export type NotificationPref = typeof notificationPrefs.$inferSelect;

// ─── Aprendizado ────────────────────────────────────────────────────────────
export const learnings = mysqlTable("learnings", {
  id: int("id").autoincrement().primaryKey(),
  scope: mysqlEnum("scope", ["org", "nicho", "global"]).notNull(),
  scopeKey: varchar("scopeKey", { length: 128 }).notNull(), // orgId ou nome do nicho
  key: varchar("key", { length: 128 }).notNull(),           // ex: fator:img_cor:laranja
  value: json("value").$type<Record<string, unknown>>(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).default("0"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Learning = typeof learnings.$inferSelect;

// ─── Config da plataforma (cofre, custos, apps, política, auditoria) ─────────
export const platformSecrets = mysqlTable("platform_secrets", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 48 }).notNull().unique(), // openrouter/fal/gemini/asaas/resend/apify
  valueEnc: text("valueEnc"),       // criptografado
  meta: json("meta").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["ok", "erro", "nao_configurado"]).default("nao_configurado").notNull(),
  expiresAt: timestamp("expiresAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlatformSecret = typeof platformSecrets.$inferSelect;

export const channelApps = mysqlTable("channel_apps", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["meta", "google", "tiktok", "linkedin"]).notNull().unique(),
  appIdEnc: text("appIdEnc"),
  appSecretEnc: text("appSecretEnc"),
  devTokenEnc: text("devTokenEnc"),
  status: mysqlEnum("status", ["dev", "basic", "standard", "nao_configurado"]).default("nao_configurado").notNull(),
  capiEnabled: boolean("capiEnabled").default(false),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChannelApp = typeof channelApps.$inferSelect;

export const aiModelCost = mysqlTable("ai_model_cost", {
  id: int("id").autoincrement().primaryKey(),
  operation: varchar("operation", { length: 48 }).notNull(), // imagem_padrao/imagem_alta/copy/diagnostico
  model: varchar("model", { length: 96 }).notNull(),
  realCostUsdMicros: int("realCostUsdMicros").default(0),
  chargedCC: int("chargedCC").default(0),
  isDefault: boolean("isDefault").default(false),
  forPlan: varchar("forPlan", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiModelCost = typeof aiModelCost.$inferSelect;

export const contentPolicyRules = mysqlTable("content_policy_rules", {
  id: int("id").autoincrement().primaryKey(),
  term: varchar("term", { length: 255 }).notNull(),
  action: mysqlEnum("action", ["bloqueia", "flag"]).notNull(),
  note: varchar("note", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
});
export type ContentPolicyRule = typeof contentPolicyRules.$inferSelect;

export const auditLog = mysqlTable("audit_log", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  userId: int("userId"),
  action: varchar("action", { length: 96 }).notNull(),
  detail: json("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLog.$inferSelect;
