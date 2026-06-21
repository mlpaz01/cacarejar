import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { orgProfile } from "../../drizzle/schema";

export type ActiveOrgContext = {
  key: string;
  label: string;
  source: "Instagram" | "LinkedIn" | "Site" | "Diagnostico";
  profileHandle?: string;
  produto?: string;
  nicho?: string;
  relatedCreativeIds?: number[];
};

export type ContextMeta = {
  contextKey: string;
  contextLabel: string;
  contextSource: ActiveOrgContext["source"];
  profileHandle?: string;
  diagnosisProduct?: string;
  diagnosisNiche?: string;
};

export function cleanContextHandle(raw?: string | null) {
  return (raw || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function linkedinSlug(raw?: string | null) {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((p) => ["in", "company", "school", "showcase"].includes(p.toLowerCase()));
    return (marker >= 0 ? parts[marker + 1] : parts[0] || "").toLowerCase();
  } catch {
    return value.replace(/^@/, "").replace(/^linkedin\.com\//i, "").split(/[/?#]/)[0].toLowerCase();
  }
}

function siteHost(raw?: string | null) {
  const value = (raw || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function planRedes(plan: any, rowRedes?: any) {
  return { ...(rowRedes ?? {}), ...(plan?.redes ?? {}), ...(plan?._redes ?? {}) } as Record<string, string>;
}

function collectCreativeIds(plan: any, row?: any) {
  const ids = new Set<number>();
  const add = (value: unknown) => {
    const id = Number(value);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  };

  for (const idea of plan?.postIdeas ?? []) add(idea?.creativeId);
  for (const idea of row?.radarJson?.ideas ?? []) add(idea?.creativeId);
  for (const creative of plan?.creatives ?? []) add(creative?.id);
  return Array.from(ids);
}

export function contextFromPlan(plan: any, row?: any): ActiveOrgContext | null {
  const redes = planRedes(plan, row?.redes);
  const produto = String(plan?.produto ?? row?.produto ?? "").trim() || undefined;
  const nicho = String(plan?.nicho ?? row?.nicho ?? "").trim() || undefined;
  const relatedCreativeIds = collectCreativeIds(plan, row);
  const withRelated = (ctx: Omit<ActiveOrgContext, "relatedCreativeIds">): ActiveOrgContext => ({
    ...ctx,
    ...(relatedCreativeIds.length ? { relatedCreativeIds } : {}),
  });

  const ig = cleanContextHandle(plan?.profile?.handle || redes.instagram);
  if (ig) {
    return withRelated({
      key: `instagram:${ig}`,
      label: `@${ig}`,
      source: "Instagram",
      profileHandle: ig,
      produto,
      nicho,
    });
  }

  const li = linkedinSlug(plan?.linkedin || redes.linkedin);
  if (li) {
    return withRelated({ key: `linkedin:${li}`, label: `LinkedIn /${li}`, source: "LinkedIn", produto, nicho });
  }

  const host = siteHost(redes.site || plan?.site?.url || row?.site);
  if (host) {
    return withRelated({ key: `site:${host}`, label: host, source: "Site", produto, nicho });
  }

  if (produto || nicho) {
    const base = `${produto ?? ""}:${nicho ?? ""}`.toLowerCase().replace(/\s+/g, "-").slice(0, 120);
    return withRelated({
      key: `diagnostico:${base}`,
      label: produto || nicho || "Diagnostico",
      source: "Diagnostico",
      produto,
      nicho,
    });
  }

  return null;
}

export async function getActiveOrgContext(orgId: number): Promise<ActiveOrgContext | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(orgProfile).where(eq(orgProfile.organizationId, orgId)).limit(1);
  if (!row?.planoJson) return null;
  return contextFromPlan(row.planoJson, row);
}

export function contextMeta(ctx: ActiveOrgContext | null): ContextMeta | undefined {
  if (!ctx?.key) return undefined;
  return {
    contextKey: ctx.key,
    contextLabel: ctx.label,
    contextSource: ctx.source,
    profileHandle: ctx.profileHandle,
    diagnosisProduct: ctx.produto,
    diagnosisNiche: ctx.nicho,
  };
}

export function mergeContextMeta(meta: Record<string, unknown> | null | undefined, ctx: ActiveOrgContext | null) {
  const stamped = contextMeta(ctx);
  return stamped ? { ...(meta ?? {}), ...stamped } : (meta ?? {});
}

export function creativeContextKey(creative: any): string {
  return String(creative?.generationMeta?.contextKey ?? "");
}

export function creativeMatchesContext(creative: any, ctx: ActiveOrgContext | null): boolean {
  if (!ctx?.key) return false;
  const key = creativeContextKey(creative);
  if (key) return key === ctx.key;
  return !!creative?.id && !!ctx.relatedCreativeIds?.includes(Number(creative.id));
}
