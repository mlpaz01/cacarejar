import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { subscriptions } from "../../drizzle/schema";

export type SubscriptionPlanKey = "ninhada_mensal" | "galinheiro_mensal" | "granja_mensal";

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanKey, { label: string; cc: number; cents: number; description: string }> = {
  ninhada_mensal: {
    label: "Ninhada mensal",
    cc: 1200,
    cents: 9700,
    description: "Para manter uma rotina semanal leve.",
  },
  galinheiro_mensal: {
    label: "Galinheiro mensal",
    cc: 3000,
    cents: 19700,
    description: "Para executar toda semana com mais folga.",
  },
  granja_mensal: {
    label: "Granja mensal",
    cc: 9000,
    cents: 49700,
    description: "Para varios negocios, time interno ou alto volume.",
  },
};

export function subscriptionFeatureEnabled(): boolean {
  return process.env.SUBSCRIPTIONS_ENABLED === "true";
}

export function getSubscriptionPlan(key?: string | null) {
  if (!key) return null;
  return SUBSCRIPTION_PLANS[key as SubscriptionPlanKey] ?? null;
}

export async function ensureSubscriptionsTable(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id int AUTO_INCREMENT NOT NULL,
      organizationId int NOT NULL,
      planKey varchar(32) NOT NULL,
      status enum('ativa','cancelada','inadimplente','trial') NOT NULL DEFAULT 'trial',
      provider varchar(32) DEFAULT 'asaas',
      externalId varchar(128),
      currentPeriodEnd timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
}

export async function getCurrentSubscription(orgId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    await ensureSubscriptionsTable();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .orderBy(sql`${subscriptions.updatedAt} DESC`)
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getSubscriptionByExternalId(externalId: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    await ensureSubscriptionsTable();
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.externalId, externalId)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
