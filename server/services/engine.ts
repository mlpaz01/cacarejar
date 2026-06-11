/**
 * Motor: disparo (via provider), coleta de métricas, redistribuição (Thompson Sampling),
 * relevância de fatores e agregação para o Dashboard de Ovos de Ouro.
 * Nesta fase usa o MockProvider — quando a conta real do canal existir, troca o provider.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { experiments, variants, creatives, metricsTimeseries, organizations } from "../../drizzle/schema";
import { getProvider } from "../channels";
import * as notif from "./notifications";

// ─── Helpers de amostragem (Thompson Sampling) ───────────────────────────────
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gamma(k: number): number {
  // Marsaglia-Tsang (k >= 1)
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do { x = randn(); v = Math.pow(1 + c * x, 3); } while (v <= 0);
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function sampleBeta(a: number, b: number): number {
  const x = gamma(Math.max(a, 1)), y = gamma(Math.max(b, 1));
  return x / (x + y);
}

function lastDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (n - 1) * 86400e3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

// ─── Disparo ──────────────────────────────────────────────────────────────────
export async function dispatchExperiment(expId: number) {
  const db = await getDb();
  if (!db) return;
  const exp = (await db.select().from(experiments).where(eq(experiments.id, expId)).limit(1))[0];
  if (!exp || exp.status !== "aprovado") return;

  const provider = getProvider("mock"); // MVP: mock até a conta real do canal existir
  const acc = { organizationId: exp.organizationId };
  const budget = exp.budgetDailyCents || 3000;

  const camp = await provider.createCampaign(acc, { name: exp.name, budgetDailyCents: budget });
  const vs = await db.select().from(variants).where(and(eq(variants.experimentId, expId), eq(variants.status, "em_teste")));
  const share = vs.length ? +(100 / vs.length).toFixed(2) : 0;

  for (const v of vs) {
    const cr = v.creativeId ? (await db.select().from(creatives).where(eq(creatives.id, v.creativeId)).limit(1))[0] : null;
    const up = await provider.uploadCreative(acc, { imageUrl: cr?.imageUrl, copy: cr?.copy, ratio: cr?.ratio ?? "1:1" });
    const ad = await provider.createAd(acc, { campaignRef: camp.externalRef, creativeRef: up.externalRef });
    await db.update(variants).set({ externalRef: ad.externalRef, budgetSharePct: String(share) }).where(eq(variants.id, v.id));
  }
  await db.update(experiments).set({ status: "no_ar", budgetDailyCents: budget }).where(eq(experiments.id, expId));
}

export async function dispatchApproved() {
  const db = await getDb();
  if (!db) return;
  const aps = await db.select().from(experiments).where(eq(experiments.status, "aprovado"));
  for (const e of aps) await dispatchExperiment(e.id).catch(() => {});
}

// ─── Coleta de métricas ────────────────────────────────────────────────────────
export async function collectForExperiment(expId: number, days = 7) {
  const db = await getDb();
  if (!db) return;
  const exp = (await db.select().from(experiments).where(eq(experiments.id, expId)).limit(1))[0];
  if (!exp) return;
  const provider = getProvider("mock");
  const acc = { organizationId: exp.organizationId };
  const range = lastDays(days);
  const vs = await db.select().from(variants).where(eq(variants.experimentId, expId));
  for (const v of vs) {
    if (!v.externalRef) continue;
    const rows = await provider.fetchMetrics(acc, v.externalRef, range);
    for (const r of rows) {
      const ex = await db.select().from(metricsTimeseries)
        .where(and(eq(metricsTimeseries.variantId, v.id), eq(metricsTimeseries.date, r.date))).limit(1);
      const vals = {
        impressions: r.impressions, clicks: r.clicks, leads: r.leads,
        conversions: r.conversions, spendCents: r.spendCents, revenueCents: r.revenueCents,
      };
      if (ex.length) await db.update(metricsTimeseries).set(vals).where(eq(metricsTimeseries.id, ex[0].id));
      else await db.insert(metricsTimeseries).values({ organizationId: exp.organizationId, variantId: v.id, date: r.date, ...vals });
    }
  }
}

export async function collectAllLive(days = 7) {
  const db = await getDb();
  if (!db) return;
  const live = await db.select().from(experiments).where(eq(experiments.status, "no_ar"));
  for (const e of live) await collectForExperiment(e.id, days).catch(() => {});
}

// ─── Agregação por variante ────────────────────────────────────────────────────
async function aggByVariant(expId: number) {
  const db = await getDb();
  if (!db) return [];
  const vs = await db.select().from(variants).where(eq(variants.experimentId, expId));
  const vids = vs.map(v => v.id);
  if (!vids.length) return [];
  const rows = await db
    .select({
      variantId: metricsTimeseries.variantId,
      impressions: sql<number>`COALESCE(SUM(${metricsTimeseries.impressions}),0)`,
      clicks: sql<number>`COALESCE(SUM(${metricsTimeseries.clicks}),0)`,
      leads: sql<number>`COALESCE(SUM(${metricsTimeseries.leads}),0)`,
      conversions: sql<number>`COALESCE(SUM(${metricsTimeseries.conversions}),0)`,
      spendCents: sql<number>`COALESCE(SUM(${metricsTimeseries.spendCents}),0)`,
      revenueCents: sql<number>`COALESCE(SUM(${metricsTimeseries.revenueCents}),0)`,
    })
    .from(metricsTimeseries)
    .where(inArray(metricsTimeseries.variantId, vids))
    .groupBy(metricsTimeseries.variantId);
  return rows.map(r => ({
    variantId: r.variantId,
    impressions: Number(r.impressions), clicks: Number(r.clicks), leads: Number(r.leads),
    conversions: Number(r.conversions), spendCents: Number(r.spendCents), revenueCents: Number(r.revenueCents),
  }));
}

// ─── Redistribuição (Thompson Sampling) ──────────────────────────────────────
const FLOOR = 0.05, CEIL = 0.60, MIN_CONV = 12, PROB_WIN = 0.6, LEAD_RATIO = 1.25, SAMPLES = 2000;

export async function reallocate(expId: number) {
  const db = await getDb();
  if (!db) return;
  const vs = (await db.select().from(variants).where(eq(variants.experimentId, expId)))
    .filter(v => v.status === "em_teste" || v.status === "ovo_de_ouro");
  if (vs.length === 0) return;

  const agg = await aggByVariant(expId);
  const aggMap = new Map(agg.map(a => [a.variantId, a]));

  const totalConv = agg.reduce((s, a) => s + a.conversions, 0);
  const totalRev = agg.reduce((s, a) => s + a.revenueCents, 0);
  const avgTicket = totalConv > 0 ? totalRev / totalConv : 29700;

  // Monte Carlo: prob. de cada variante ser a melhor (por receita esperada)
  const wins: Record<number, number> = {};
  vs.forEach(v => (wins[v.id] = 0));
  for (let s = 0; s < SAMPLES; s++) {
    let best = -1, bestScore = -1;
    for (const v of vs) {
      const a = aggMap.get(v.id);
      const conv = a?.conversions ?? 0;
      const clicks = Math.max(a?.clicks ?? 0, conv);
      const theta = sampleBeta(1 + conv, 1 + (clicks - conv));
      const value = conv > 0 ? (a!.revenueCents / conv) : avgTicket;
      const score = theta * value;
      if (score > bestScore) { bestScore = score; best = v.id; }
    }
    if (best >= 0) wins[best]++;
  }
  const prob: Record<number, number> = {};
  vs.forEach(v => (prob[v.id] = wins[v.id] / SAMPLES));

  // shares com piso/teto
  let shares: Record<number, number> = {};
  vs.forEach(v => (shares[v.id] = prob[v.id]));
  // matar perdedores claros (com volume) → share 0
  const alive = vs.filter(v => {
    const conv = aggMap.get(v.id)?.conversions ?? 0;
    if (conv >= MIN_CONV && prob[v.id] < 0.02) return false;
    return true;
  });
  const aliveIds = new Set(alive.map(v => v.id));
  let sum = alive.reduce((s, v) => s + Math.max(shares[v.id], 0.0001), 0);
  const norm: Record<number, number> = {};
  alive.forEach(v => (norm[v.id] = Math.max(shares[v.id], 0.0001) / sum));
  // aplicar piso/teto e renormalizar
  alive.forEach(v => (norm[v.id] = Math.min(Math.max(norm[v.id], FLOOR), CEIL)));
  sum = alive.reduce((s, v) => s + norm[v.id], 0);
  alive.forEach(v => (norm[v.id] = norm[v.id] / sum));

  // elege O líder (maior probabilidade) como ovo de ouro:
  // confiança estatística (prob) OU líder claro em vendas (>= 25% acima do 2º)
  let leaderId = -1, leaderProb = -1;
  for (const v of alive) if (prob[v.id] > leaderProb) { leaderProb = prob[v.id]; leaderId = v.id; }
  const convSorted = alive.map(v => aggMap.get(v.id)?.conversions ?? 0).sort((a, b) => b - a);
  const secondConv = convSorted[1] ?? 0;
  const leaderConv = aggMap.get(leaderId)?.conversions ?? 0;
  const hasWinner =
    leaderId >= 0 && leaderConv >= MIN_CONV &&
    (leaderProb >= PROB_WIN || leaderConv >= LEAD_RATIO * Math.max(secondConv, 1));
  const wasWinnerBefore = vs.some(v => v.isWinner);

  for (const v of vs) {
    let status: any = "em_teste";
    let isWinner = false;
    let share = 0;
    if (aliveIds.has(v.id)) {
      share = +(norm[v.id] * 100).toFixed(2);
      if (hasWinner && v.id === leaderId) { status = "ovo_de_ouro"; isWinner = true; }
    } else {
      status = "perdeu";
    }
    await db.update(variants).set({ budgetSharePct: String(share), status, isWinner }).where(eq(variants.id, v.id));
  }

  // notifica quando o ovo de ouro surge pela 1ª vez
  if (hasWinner && !wasWinnerBefore) {
    const exp = (await db.select().from(experiments).where(eq(experiments.id, expId)).limit(1))[0];
    if (exp) {
      await notif.notify({
        organizationId: exp.organizationId, userId: exp.userId, type: "ovo_de_ouro",
        title: "Encontramos um ovo de ouro! 🥚",
        body: "Identificamos a campanha vencedora e já estamos concentrando seu investimento nela.",
      }).catch(() => {});
    }
  }
}

export async function reallocateAll() {
  const db = await getDb();
  if (!db) return;
  const live = await db.select().from(experiments).where(eq(experiments.status, "no_ar"));
  for (const e of live) await reallocate(e.id).catch(() => {});
}

// ─── Relevância de fatores (uplift por valor) ─────────────────────────────────
export async function factorRelevance(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const exps = await db.select().from(experiments).where(and(eq(experiments.organizationId, orgId), eq(experiments.status, "no_ar")));
  if (!exps.length) return [];
  const expIds = exps.map(e => e.id);
  const vs = await db.select().from(variants).where(inArray(variants.experimentId, expIds));
  const allAgg: any[] = [];
  for (const e of expIds) allAgg.push(...await aggByVariant(e));
  const aggMap = new Map(allAgg.map(a => [a.variantId, a]));

  const totalConv = allAgg.reduce((s, a) => s + a.conversions, 0);
  const totalClicks = allAgg.reduce((s, a) => s + a.clicks, 0);
  const overall = totalClicks > 0 ? totalConv / totalClicks : 0;
  if (overall === 0) return [];

  // agrupa por factorKey:value
  const groups: Record<string, { conv: number; clicks: number; label: string }> = {};
  for (const v of vs) {
    const a = aggMap.get(v.id);
    if (!a) continue;
    const fv = (v.factorValues ?? {}) as Record<string, string>;
    for (const [fk, val] of Object.entries(fv)) {
      const key = `${fk}:${val}`;
      if (!groups[key]) groups[key] = { conv: 0, clicks: 0, label: val };
      groups[key].conv += a.conversions;
      groups[key].clicks += a.clicks;
    }
  }
  const out = Object.entries(groups)
    .filter(([, g]) => g.clicks >= 30)
    .map(([key, g]) => {
      const rate = g.clicks > 0 ? g.conv / g.clicks : 0;
      const uplift = ((rate - overall) / overall) * 100;
      return { factor: key, value: g.label, uplift: +uplift.toFixed(0) };
    })
    .sort((a, b) => Math.abs(b.uplift) - Math.abs(a.uplift))
    .slice(0, 8);
  return out;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function dashboard(orgId: number) {
  const db = await getDb();
  if (!db) return null;
  const exps = await db.select().from(experiments)
    .where(and(eq(experiments.organizationId, orgId), inArray(experiments.status, ["no_ar", "aprovado"])));
  const expIds = exps.map(e => e.id);

  let totals = { impressions: 0, clicks: 0, leads: 0, conversions: 0, spendCents: 0, revenueCents: 0 };
  const allVariants: any[] = [];
  for (const e of expIds) {
    const agg = await aggByVariant(e);
    const aggMap = new Map(agg.map(a => [a.variantId, a]));
    for (const a of agg) {
      totals.impressions += a.impressions; totals.clicks += a.clicks; totals.leads += a.leads;
      totals.conversions += a.conversions; totals.spendCents += a.spendCents; totals.revenueCents += a.revenueCents;
    }
    const vs = await db.select().from(variants).where(eq(variants.experimentId, e));
    const cids = vs.map(v => v.creativeId!).filter(Boolean);
    const cras = cids.length ? await db.select().from(creatives).where(inArray(creatives.id, cids)) : [];
    const craMap = new Map(cras.map(c => [c.id, c]));
    for (const v of vs) {
      const a = aggMap.get(v.id);
      allVariants.push({
        id: v.id, status: v.status, isWinner: v.isWinner,
        share: Number(v.budgetSharePct ?? 0),
        copy: craMap.get(v.creativeId!)?.copy,
        lente: craMap.get(v.creativeId!)?.lente,
        factorValues: v.factorValues,
        conversions: a?.conversions ?? 0, spendCents: a?.spendCents ?? 0, revenueCents: a?.revenueCents ?? 0,
      });
    }
  }

  const spend = totals.spendCents / 100, revenue = totals.revenueCents / 100;
  const roas = spend > 0 ? +(revenue / spend).toFixed(2) : 0;
  const cpl = totals.leads > 0 ? +(spend / totals.leads).toFixed(2) : 0;
  const goldenEggs = allVariants.filter(v => v.isWinner).length;

  allVariants.sort((a, b) => b.share - a.share);
  const relevance = await factorRelevance(orgId);

  return {
    kpis: {
      spend, leads: totals.leads, conversions: totals.conversions, revenue, roas, cpl,
      goldenEggs, activeExperiments: exps.filter(e => e.status === "no_ar").length,
    },
    funnel: { impressions: totals.impressions, clicks: totals.clicks, leads: totals.leads, conversions: totals.conversions },
    variants: allVariants.slice(0, 8),
    relevance,
    winner: allVariants.find(v => v.isWinner) ?? null,
  };
}
