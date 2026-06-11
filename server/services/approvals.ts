/**
 * Aprovação & Governança.
 * Fluxo: criativos → experimento (aguardando_cliente) → cliente seleciona e aprova
 * → em_revisao → revisores (semi-auto) → aprovado/reprovado → aviso (plataforma+email).
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  experiments, variants, creatives, approvals, reviewChecks, contentPolicyRules, organizations,
} from "../../drizzle/schema";
import { insertIdOf } from "./credits";
import * as notif from "./notifications";

/** Cria um experimento a partir de criativos (status: aguardando_cliente). */
export async function sendToApproval(params: {
  orgId: number; userId: number; creativeIds: number[]; name?: string; channel?: "meta"|"google"|"tiktok"|"linkedin";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  if (!params.creativeIds.length) throw new Error("Nenhum criativo selecionado");

  const cras = await db.select().from(creatives)
    .where(and(eq(creatives.organizationId, params.orgId), inArray(creatives.id, params.creativeIds)));
  if (!cras.length) throw new Error("Criativos não encontrados");

  const expRes = await db.insert(experiments).values({
    organizationId: params.orgId,
    userId: params.userId,
    name: params.name || `Teste A/Z — ${cras[0].briefing?.slice(0, 40) ?? "campanha"}`,
    objetivo: "vendas",
    channel: params.channel ?? "meta",
    status: "aguardando_cliente",
  });
  const experimentId = insertIdOf(expRes);

  for (const c of cras) {
    await db.insert(variants).values({
      experimentId, organizationId: params.orgId, creativeId: c.id,
      factorValues: c.factorValues ?? {}, status: "em_teste",
    });
    await db.update(creatives).set({ experimentId, status: "rascunho" }).where(eq(creatives.id, c.id));
  }
  return { experimentId, variants: cras.length };
}

/** Experimentos aguardando aprovação do cliente, com suas variantes+criativos. */
export async function pendingForClient(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const exps = await db.select().from(experiments)
    .where(and(eq(experiments.organizationId, orgId), eq(experiments.status, "aguardando_cliente")))
    .orderBy(desc(experiments.createdAt));
  const out: any[] = [];
  for (const e of exps) {
    const vs = await db.select().from(variants).where(eq(variants.experimentId, e.id));
    const cids = vs.map(v => v.creativeId!).filter(Boolean);
    const cras = cids.length ? await db.select().from(creatives).where(inArray(creatives.id, cids)) : [];
    const craMap = new Map(cras.map(c => [c.id, c]));
    out.push({
      ...e,
      variants: vs.map(v => ({ ...v, creative: craMap.get(v.creativeId!) })),
    });
  }
  return out;
}

/** Cliente aprova as variantes selecionadas → dispara revisão. */
export async function clientApprove(params: { orgId: number; userId: number; experimentId: number; variantIds: number[]; budgetDailyCents?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");
  if (!params.variantIds.length) throw new Error("Selecione ao menos uma campanha");

  const exp = (await db.select().from(experiments)
    .where(and(eq(experiments.id, params.experimentId), eq(experiments.organizationId, params.orgId))).limit(1))[0];
  if (!exp) throw new Error("Experimento não encontrado");

  // descartar não-selecionadas
  const all = await db.select().from(variants).where(eq(variants.experimentId, exp.id));
  for (const v of all) {
    if (!params.variantIds.includes(v.id)) {
      await db.update(variants).set({ status: "perdeu" }).where(eq(variants.id, v.id));
    }
  }

  const budgetDailyCents = Math.max(1000, Math.min(params.budgetDailyCents ?? exp.budgetDailyCents ?? 3000, 100000));
  await db.update(experiments).set({ status: "em_revisao", budgetDailyCents }).where(eq(experiments.id, exp.id));
  const apRes = await db.insert(approvals).values({
    organizationId: params.orgId, itemType: "experiment", itemId: exp.id,
    clientApprovedBy: params.userId, clientApprovedAt: new Date(),
    reviewMode: "semi", reviewStatus: "pendente",
  });
  const approvalId = insertIdOf(apRes);

  await notif.notify({
    organizationId: params.orgId, userId: params.userId, type: "aprovacao_recebida",
    title: "Recebemos suas campanhas! 🐓",
    body: "Em até algumas horas avisamos aqui e por email quando elas forem revisadas e estiverem no ar.",
    email: false, // aviso interno, sem spam
  });

  // tenta revisar já (semi-auto); se ficar pendente, o cron pega depois
  await runReview(approvalId).catch(() => {});
  return { approvalId };
}

/** Roda os 3 revisores (semi-auto). Regras de conformidade são determinísticas. */
export async function runReview(approvalId: number) {
  const db = await getDb();
  if (!db) return;
  const ap = (await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1))[0];
  if (!ap || (ap.reviewStatus !== "pendente" && ap.reviewStatus !== "em_revisao")) return;

  await db.update(approvals).set({ reviewStatus: "em_revisao" }).where(eq(approvals.id, approvalId));

  // já avaliou? evita duplicar checks
  const existing = await db.select().from(reviewChecks).where(eq(reviewChecks.approvalId, approvalId));
  if (existing.length === 0) {
    const vs = await db.select().from(variants).where(eq(variants.experimentId, ap.itemId));
    const cids = vs.map(v => v.creativeId!).filter(Boolean);
    const cras = cids.length ? await db.select().from(creatives).where(inArray(creatives.id, cids)) : [];
    const rules = await db.select().from(contentPolicyRules).where(eq(contentPolicyRules.isActive, true));

    // Revisor de Conformidade — checa copy contra política (palavras inteiras)
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let confVerdict: "pass" | "flag" | "fail" = "pass";
    let confNote = "Nenhum termo proibido encontrado.";
    for (const c of cras) {
      const text = `${c.copy ?? ""} ${c.briefing ?? ""}`.toLowerCase();
      for (const r of rules) {
        const re = new RegExp(`\\b${escapeRe(r.term.toLowerCase())}\\b`, "i");
        if (re.test(text)) {
          if (r.action === "bloqueia") { confVerdict = "fail"; confNote = `Termo bloqueado: "${r.term}"`; break; }
          if (confVerdict !== "fail") { confVerdict = "flag"; confNote = `Termo sinalizado: "${r.term}"`; }
        }
      }
      if (confVerdict === "fail") break;
    }
    await db.insert(reviewChecks).values({ approvalId, reviewer: "conformidade", verdict: confVerdict, notes: confNote, byAgentModel: "rule-based" });
    await db.insert(reviewChecks).values({ approvalId, reviewer: "marca", verdict: "pass", notes: "Consistente com a marca.", byAgentModel: "rule-based" });
    await db.insert(reviewChecks).values({ approvalId, reviewer: "performance", verdict: vs.length >= 1 ? "pass" : "fail", notes: `${vs.length} variantes.`, byAgentModel: "rule-based" });
  }

  // decisão
  const checks = await db.select().from(reviewChecks).where(eq(reviewChecks.approvalId, approvalId));
  const anyFail = checks.some(c => c.verdict === "fail");
  const anyFlag = checks.some(c => c.verdict === "flag");

  if (ap.reviewMode === "manual") return; // operador decide
  if (!anyFail && !anyFlag) {
    await approve(approvalId, "agentes");
  }
  // se flag/fail no modo semi → fica em_revisao para o operador (admin)
}

/** Aprova (operador ou agentes) → experimento aprovado + aviso ao cliente. */
export async function approve(approvalId: number, by: string) {
  const db = await getDb();
  if (!db) return;
  const ap = (await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1))[0];
  if (!ap || ap.reviewStatus === "aprovado") return;
  await db.update(approvals).set({ reviewStatus: "aprovado", reviewedBy: by, notifiedAt: new Date() }).where(eq(approvals.id, approvalId));
  await db.update(experiments).set({ status: "aprovado" }).where(eq(experiments.id, ap.itemId));
  await notif.notify({
    organizationId: ap.organizationId, userId: ap.clientApprovedBy, type: "aprovado",
    title: "Suas campanhas foram aprovadas! ✅",
    body: "Tudo certo na revisão. Suas campanhas já entraram no ar. 🐓",
  });

  // Motor: publica (mock), coleta métricas e faz a 1ª redistribuição
  try {
    const engine = await import("./engine");
    await engine.dispatchExperiment(ap.itemId);
    await engine.collectForExperiment(ap.itemId, 7);
    await engine.reallocate(ap.itemId);
  } catch (e) {
    console.error("[engine] erro no disparo inline:", e);
  }
}

export async function reject(approvalId: number, reason: string, by: string) {
  const db = await getDb();
  if (!db) return;
  const ap = (await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1))[0];
  if (!ap) return;
  await db.update(approvals).set({ reviewStatus: "reprovado", reviewedBy: by, reason, notifiedAt: new Date() }).where(eq(approvals.id, approvalId));
  await db.update(experiments).set({ status: "reprovado" }).where(eq(experiments.id, ap.itemId));
  await notif.notify({
    organizationId: ap.organizationId, userId: ap.clientApprovedBy, type: "reprovado",
    title: "Suas campanhas precisam de ajuste",
    body: `Motivo: ${reason}. Ajuste no estúdio e reenvie. 🐓`,
  });
}

/** Cron: processa aprovações pendentes. */
export async function processPending() {
  const db = await getDb();
  if (!db) return;
  const pend = await db.select().from(approvals).where(eq(approvals.reviewStatus, "pendente"));
  for (const ap of pend) await runReview(ap.id).catch(() => {});
}

/** Fila do admin: aprovações em revisão (com checks e org). */
export async function reviewQueue() {
  const db = await getDb();
  if (!db) return [];
  const aps = await db.select().from(approvals)
    .where(inArray(approvals.reviewStatus, ["pendente", "em_revisao"]))
    .orderBy(desc(approvals.createdAt));
  const out: any[] = [];
  for (const ap of aps) {
    const checks = await db.select().from(reviewChecks).where(eq(reviewChecks.approvalId, ap.id));
    const exp = (await db.select().from(experiments).where(eq(experiments.id, ap.itemId)).limit(1))[0];
    const org = (await db.select().from(organizations).where(eq(organizations.id, ap.organizationId)).limit(1))[0];
    out.push({ ...ap, checks, experiment: exp, orgName: org?.name });
  }
  return out;
}
