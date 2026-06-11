/**
 * Carteira de créditos (CC) — hold → settle → release.
 * Garante que nenhuma operação de IA rode sem crédito reservado (anti-prejuízo).
 *
 * Fluxo:
 *  1. hold(orgId, cc, ref) — checa saldo e cota diária, reserva CC (move de balance p/ held).
 *  2. settle(orgId, holdId, realCostUsdMicros) — confirma o consumo (debita held, registra custo real).
 *  3. release(orgId, holdId) — devolve o CC reservado (se a operação falhou).
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  creditWallet,
  creditLedger,
  creditDailyCounter,
  organizations,
  plans,
} from "../../drizzle/schema";

function today(): string {
  // YYYY-MM-DD (UTC). Suficiente para cota diária; ajustar TZ depois se preciso.
  return new Date().toISOString().slice(0, 10);
}

/** Extrai insertId do resultado do drizzle/mysql2 (pode vir como objeto ou [ResultSetHeader]). */
export function insertIdOf(res: any): number {
  if (Array.isArray(res)) return res[0]?.insertId ?? 0;
  return res?.insertId ?? 0;
}

export type HoldResult =
  | { ok: true; holdLedgerId: number; balanceAfter: number }
  | { ok: false; reason: "saldo_insuficiente" | "cota_diaria" | "db"; balance: number; needed: number };

/** Garante que a org tenha uma carteira (cria com saldo 0 se não existir). */
export async function ensureWallet(orgId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(creditWallet).where(eq(creditWallet.organizationId, orgId)).limit(1);
  if (existing.length === 0) {
    await db.insert(creditWallet).values({ organizationId: orgId, balanceCC: 0, heldCC: 0 });
  }
}

export async function getWallet(orgId: number) {
  const db = await getDb();
  if (!db) return null;
  await ensureWallet(orgId);
  const rows = await db.select().from(creditWallet).where(eq(creditWallet.organizationId, orgId)).limit(1);
  return rows[0] ?? null;
}

/** Quanto a org já usou hoje (consumo) — para a cota diária. */
export async function getDailyUsed(orgId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(creditDailyCounter)
    .where(and(eq(creditDailyCounter.organizationId, orgId), eq(creditDailyCounter.date, today())))
    .limit(1);
  return rows[0]?.usedCC ?? 0;
}

/** Cota diária do plano da org (0 = sem limite configurado). */
export async function getDailyQuota(orgId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const planKey = org[0]?.plan ?? "free";
  const pl = await db.select().from(plans).where(eq(plans.key, planKey)).limit(1);
  return pl[0]?.dailyQuotaCC ?? 0;
}

/**
 * Reserva CC antes de chamar a IA. Checa saldo e cota diária.
 * `bypassDaily` para top-ups avulsos que não respeitam cota.
 */
export async function hold(
  orgId: number,
  cc: number,
  ref: string,
  opts?: { bypassDaily?: boolean; description?: string }
): Promise<HoldResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db", balance: 0, needed: cc };
  await ensureWallet(orgId);

  const wallet = await getWallet(orgId);
  const balance = wallet?.balanceCC ?? 0;
  if (balance < cc) return { ok: false, reason: "saldo_insuficiente", balance, needed: cc };

  if (!opts?.bypassDaily) {
    const quota = await getDailyQuota(orgId);
    if (quota > 0) {
      const used = await getDailyUsed(orgId);
      if (used + cc > quota) return { ok: false, reason: "cota_diaria", balance, needed: cc };
    }
  }

  // move CC: balance -= cc, held += cc
  await db
    .update(creditWallet)
    .set({ balanceCC: sql`${creditWallet.balanceCC} - ${cc}`, heldCC: sql`${creditWallet.heldCC} + ${cc}` })
    .where(eq(creditWallet.organizationId, orgId));

  const res = await db.insert(creditLedger).values({
    organizationId: orgId,
    type: "hold",
    amountCC: -cc,
    ref,
    description: opts?.description ?? "Reserva de créditos",
  });
  const holdLedgerId = insertIdOf(res);
  return { ok: true, holdLedgerId, balanceAfter: balance - cc };
}

/** Confirma o consumo do hold: debita held de vez e registra o custo real. */
export async function settle(orgId: number, holdLedgerId: number, realCostUsdMicros = 0): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const holdRows = await db.select().from(creditLedger).where(eq(creditLedger.id, holdLedgerId)).limit(1);
  const holdRow = holdRows[0];
  if (!holdRow) return;
  const cc = Math.abs(holdRow.amountCC);

  // held -= cc (consumido)
  await db
    .update(creditWallet)
    .set({ heldCC: sql`GREATEST(${creditWallet.heldCC} - ${cc}, 0)` })
    .where(eq(creditWallet.organizationId, orgId));

  // registra consumo + custo real
  await db.insert(creditLedger).values({
    organizationId: orgId,
    type: "consumo",
    amountCC: -cc,
    costUsdMicros: realCostUsdMicros,
    ref: holdRow.ref,
    description: "Consumo confirmado",
  });

  // incrementa contador diário (upsert)
  const d = today();
  const existing = await db
    .select()
    .from(creditDailyCounter)
    .where(and(eq(creditDailyCounter.organizationId, orgId), eq(creditDailyCounter.date, d)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(creditDailyCounter)
      .set({ usedCC: sql`${creditDailyCounter.usedCC} + ${cc}` })
      .where(eq(creditDailyCounter.id, existing[0].id));
  } else {
    await db.insert(creditDailyCounter).values({ organizationId: orgId, date: d, usedCC: cc });
  }
}

/** Devolve o CC reservado (operação falhou): held -= cc, balance += cc. */
export async function release(orgId: number, holdLedgerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const holdRows = await db.select().from(creditLedger).where(eq(creditLedger.id, holdLedgerId)).limit(1);
  const holdRow = holdRows[0];
  if (!holdRow) return;
  const cc = Math.abs(holdRow.amountCC);

  await db
    .update(creditWallet)
    .set({
      heldCC: sql`GREATEST(${creditWallet.heldCC} - ${cc}, 0)`,
      balanceCC: sql`${creditWallet.balanceCC} + ${cc}`,
    })
    .where(eq(creditWallet.organizationId, orgId));

  await db.insert(creditLedger).values({
    organizationId: orgId,
    type: "estorno",
    amountCC: cc,
    ref: holdRow.ref,
    description: "Estorno (operação não concluída)",
  });
}

/** Crédito direto (recarga/bônus). Use idempotencyKey para webhooks. */
export async function credit(
  orgId: number,
  cc: number,
  type: "recarga" | "bonus" | "ajuste",
  opts?: { ref?: string; description?: string; idempotencyKey?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureWallet(orgId);

  if (opts?.idempotencyKey) {
    const dup = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, opts.idempotencyKey))
      .limit(1);
    if (dup.length > 0) return; // já processado
  }

  await db
    .update(creditWallet)
    .set({ balanceCC: sql`${creditWallet.balanceCC} + ${cc}` })
    .where(eq(creditWallet.organizationId, orgId));

  await db.insert(creditLedger).values({
    organizationId: orgId,
    type,
    amountCC: cc,
    ref: opts?.ref,
    description: opts?.description ?? "Crédito",
    idempotencyKey: opts?.idempotencyKey,
  });
}

/** Histórico (ledger) recente da org. */
export async function getLedger(orgId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, orgId))
    .orderBy(sql`${creditLedger.createdAt} DESC`)
    .limit(limit);
}

/** Tabela de consumo de CC por operação (fallback se ai_model_cost não populado). */
export const CC_COST: Record<string, number> = {
  imagem_padrao: 15,
  imagem_alta: 30,
  copy_lote: 5,
  copy_lote_az: 18,
  copy_reescrita: 1,
  diagnostico: 30,
  recalibracao: 20,
  radar_refine: 10,
};
