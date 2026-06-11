/**
 * Notificações — plataforma (sino) + email.
 * Email é enviado via Resend se RESEND_API_KEY estiver no .env; senão, no-op (marca como não enviado).
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, users } from "../../drizzle/schema";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Cacarejar <nao-responder@cacarejar.com.br>",
        to,
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Cria uma notificação na plataforma e tenta enviar email (se habilitado). */
export async function notify(params: {
  organizationId: number;
  userId?: number | null;
  type: string;
  title: string;
  body?: string;
  email?: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const channels = params.email === false ? ["platform"] : ["platform", "email"];
  const res = await db.insert(notifications).values({
    organizationId: params.organizationId,
    userId: params.userId ?? null,
    type: params.type,
    title: params.title,
    body: params.body,
    channels,
  });

  if (params.email !== false) {
    // descobre o email do dono da org (ou do user)
    let to = "";
    if (params.userId) {
      const u = await db.select().from(users).where(eq(users.id, params.userId)).limit(1);
      to = u[0]?.email ?? "";
    }
    if (!to) {
      const u = await db.select().from(users).where(eq(users.organizationId, params.organizationId)).limit(1);
      to = u[0]?.email ?? "";
    }
    if (to) {
      const ok = await sendEmail(
        to,
        `🐓 ${params.title}`,
        `<div style="font-family:Inter,Arial,sans-serif"><h2 style="color:#071b44">${params.title}</h2><p style="color:#22304b">${params.body ?? ""}</p><p style="color:#61708a;font-size:12px">cacarejar.com.br</p></div>`
      );
      if (ok) {
        const id = Array.isArray(res) ? (res[0] as any)?.insertId : (res as any)?.insertId;
        if (id) await db.update(notifications).set({ emailSentAt: new Date() }).where(eq(notifications.id, id));
      }
    }
  }
}

export async function listForOrg(orgId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.organizationId, orgId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function unreadCount(orgId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.organizationId, orgId), isNull(notifications.readAt)));
  return Number(rows[0]?.n ?? 0);
}

export async function markRead(orgId: number, id?: number) {
  const db = await getDb();
  if (!db) return;
  if (id) {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.organizationId, orgId)));
  } else {
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.organizationId, orgId), isNull(notifications.readAt)));
  }
}
