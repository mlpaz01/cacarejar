import fs from "node:fs";
import path from "node:path";
import playwright from "../../.test-tools/node_modules/playwright-core/index.js";

const { chromium } = playwright;

const BASE = "https://cacarejar.com.br";
const OUT_DIR = path.resolve("docs/qa/fluxo-saude-trabalho");
fs.mkdirSync(OUT_DIR, { recursive: true });

const report = [];
const stamp = Date.now();
const email = process.env.FLOW_EMAIL || `fluxo.saude.${stamp}@teste.cacarejar.com.br`;
const password = "TesteFluxo@123";

function log(step, ok, detail = {}, error = undefined) {
  const row = { step, ok, detail, error: error ? String(error?.message || error) : undefined, at: new Date().toISOString() };
  report.push(row);
  console.log(`${ok ? "OK" : "FAIL"} ${step}`, error ? row.error : "");
}

async function register() {
  if (process.env.FLOW_EMAIL) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`login ${res.status}: ${text}`);
    const cookie = res.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("login nao retornou cookie");
    return cookie;
  }
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Marina Demo SST",
      email,
      password,
      companyName: "Saúde do Trabalho 360 Demo",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`register ${res.status}: ${text}`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("registro nao retornou cookie");
  return cookie;
}

async function trpc(cookie, name, input = undefined, kind = "mutation") {
  const isQuery = kind === "query";
  const queryInput = input === undefined ? "" : `&input=${encodeURIComponent(JSON.stringify({ 0: { json: input ?? null } }))}`;
  const res = await fetch(`${BASE}/api/trpc/${name}?batch=1${isQuery ? queryInput : ""}`, {
    method: isQuery ? "GET" : "POST",
    headers: isQuery ? { cookie } : { "content-type": "application/json", cookie },
    body: isQuery ? undefined : JSON.stringify({ 0: { json: input ?? null } }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${name} invalid json ${res.status}: ${text.slice(0, 600)}`); }
  const item = Array.isArray(json) ? json[0] : json;
  if (!res.ok || item?.error) throw new Error(`${name} ${res.status}: ${JSON.stringify(item?.error ?? json).slice(0, 1200)}`);
  return item?.result?.data?.json;
}

async function trpcPost(cookie, name, input = undefined) {
  const res = await fetch(`${BASE}/api/trpc/${name}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ 0: { json: input ?? null } }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${name} invalid json ${res.status}: ${text.slice(0, 600)}`); }
  const item = Array.isArray(json) ? json[0] : json;
  if (!res.ok || item?.error) throw new Error(`${name} ${res.status}: ${JSON.stringify(item?.error ?? json).slice(0, 1200)}`);
  return item?.result?.data?.json;
}

async function shot(page, name) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function visibleText(page) {
  return (await page.locator("body").innerText({ timeout: 5000 })).replace(/\s+/g, " ").slice(0, 3000);
}

async function main() {
  const cookie = await register();
  log("01 registrar conta de teste", true, { email });

  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    baseURL: BASE,
  });
  const [cookieName, cookieValue] = cookie.split("=");
  await context.addCookies([{ name: cookieName, value: cookieValue, domain: "cacarejar.com.br", path: "/", httpOnly: true, secure: true }]);
  const page = await context.newPage();

  await page.goto(`${BASE}/app/diagnostico`);
  await shot(page, "01-diagnostico-form");
  log("02 abrir tela diagnostico em branco", true, { text: await visibleText(page) });

  const diagnoseInput = {
    produto: "Plataforma e consultoria de saúde do trabalho, saúde mental no trabalho e SST para empresas. Ajuda RH, gestores e SESMT a organizar PCMSO, PGR, ASO, eSocial, ergonomia, prevenção de burnout e campanhas internas de bem-estar corporativo.",
    objetivo: "leads",
    redes: {
      linkedin: "https://www.linkedin.com/in/saudedotrabalho/",
      site: "https://saudedotrabalho.com",
      instagram: "",
      tiktok: "",
    },
    sobre: "Cliente ideal: empresas com 50 a 500 colaboradores, RH e gestores de operações que precisam reduzir risco ocupacional, afastamentos e passivos. Diferencial: linguagem humana, técnica e preventiva.",
  };
  const plan = await trpc(cookie, "diagnosis.analyze", diagnoseInput);
  log("03 gerar diagnostico", true, {
    nicho: plan?.nicho,
    produto: plan?.produto,
    linkedin: plan?.linkedin,
    posts: plan?.postIdeas?.length,
    canais: plan?.prescricoesPorCanal?.map(p => p.canal),
  });
  await page.goto(`${BASE}/app/diagnostico`);
  await shot(page, "02-diagnostico-resultado");

  const suggest = await trpc(cookie, "radar.suggest", undefined, "query");
  log("04 sugerir fontes radar", true, suggest);
  const radar = await trpc(cookie, "radar.scan", {});
  log("05 iniciar radar", true, {
    base: radar?.baseLabel,
    hits: radar?.hits?.length,
    sources: radar?.sources,
    hashtags: radar?.hashtags,
    quality: radar?.quality,
  });
  await page.goto(`${BASE}/app/radar`);
  await shot(page, "03-radar");

  const hitKeys = (radar?.hits ?? []).slice(0, 2).map(h => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`));
  const disliked = (radar?.hits ?? []).slice(2, 4).map(h => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`));
  const refined = await trpc(cookie, "radar.refine", { likedPostKeys: hitKeys, dislikedPostKeys: disliked });
  log("06 refinar radar com feedback", true, { hits: refined?.hits?.length, quality: refined?.quality, sources: refined?.sources });
  await page.goto(`${BASE}/app/radar`);
  await shot(page, "04-radar-refinado");

  for (const [index, decision] of ["use", "agent", "skip"].entries()) {
    await trpc(cookie, "radar.updateIdeaDecision", { index, decision, feedback: index === 0 ? "Usar como eixo de autoridade LinkedIn e artigo SEO." : "" }).catch(e => log(`07.${index} marcar ideia ${decision}`, false, {}, e));
  }
  const recalibrated = await trpc(cookie, "diagnosis.recalibrate", { feedback: "Incorporar apenas sinais aderentes a SST, saúde mental no trabalho e RH corporativo." });
  log("07 recalcular diagnostico com feedbacks", true, {
    nicho: recalibrated?.nicho,
    radarIdeas: recalibrated?.radarContribuicoes?.ideias?.length,
    conclusao: recalibrated?.conclusao?.slice(0, 180),
  });
  await page.goto(`${BASE}/app/diagnostico`);
  await shot(page, "05-diagnostico-recalculado");

  let proposalIds = [];
  try {
    const proposals = await trpc(cookie, "studio.generateProposals");
    proposalIds = (proposals?.creatives ?? []).map(c => c.id).filter(Boolean);
    log("08 gerar posts do diagnostico", true, { generated: proposals?.generated, stopped: proposals?.stopped, ids: proposalIds });
  } catch (e) {
    log("08 gerar posts do diagnostico", false, {}, e);
  }

  let radarCreativeIds = [];
  for (let index = 0; index < 3; index++) {
    try {
      const creative = await trpc(cookie, "radar.generateIdea", { index });
      if (creative?.id) radarCreativeIds.push(creative.id);
      log(`09.${index + 1} gerar criativo do radar`, true, { id: creative?.id, imageUrl: creative?.imageUrl });
    } catch (e) {
      log(`09.${index + 1} gerar criativo do radar`, false, {}, e);
    }
  }
  await page.goto(`${BASE}/app/criativos`);
  await shot(page, "06-criativos");

  const approvalIds = [...new Set([...proposalIds, ...radarCreativeIds])];
  if (approvalIds.length) {
    const approval = await trpc(cookie, "approvals.sendToApproval", { creativeIds: approvalIds, name: "Fluxo Demo SST - posts por canal" });
    log("10 enviar para aprovacao", true, approval);
    await page.goto(`${BASE}/app/aprovacao`);
    await shot(page, "07-aprovacao");
    const pending = await trpc(cookie, "approvals.pendingForClient", undefined, "query");
    const exp = pending?.[0];
    if (exp?.variants?.length) {
      const selected = exp.variants.slice(0, Math.min(3, exp.variants.length)).map(v => v.id);
      const approved = await trpc(cookie, "approvals.clientApprove", { experimentId: exp.id, variantIds: selected, budgetDailyCents: 3000 });
      log("11 aprovar posts e verba", true, { approvalId: approved?.approvalId, selected });
      await page.goto(`${BASE}/app/aprovacao`);
      await shot(page, "08-aprovacao-pos-aprovar");
    } else {
      log("11 aprovar posts e verba", false, { pending });
    }
  } else {
    log("10 enviar para aprovacao", false, { reason: "nenhum criativo gerado" });
  }

  const campaign = await trpc(cookie, "campaigns.create", {
    name: "Campanha LinkedIn - SST e Saúde Mental no Trabalho",
    objective: "Gerar leads qualificados de RH e gestores para diagnóstico ocupacional.",
    targetAudience: "RH, SESMT, gestores de operações e donos de empresas com 50 a 500 colaboradores.",
    budgetTotal: "1500",
    channels: ["linkedin", "instagram"],
    startDate: "2026-06-17",
    endDate: "2026-07-17",
  });
  log("12 criar campanha", true, campaign);
  await page.goto(`${BASE}/app/campanhas`);
  await shot(page, "09-campanhas");

  const currentPlan = await trpc(cookie, "diagnosis.get", undefined, "query");
  const acompanhamento = currentPlan?.acompanhamento ?? {};
  const updated = await trpc(cookie, "diagnosis.updateAcompanhamento", {
    acompanhamento: {
      ...acompanhamento,
      progresso: 18,
      conteudos: { total: 16, feitos: 3 },
      campanhas: 1,
      proximoFoco: "Publicar artigo pilar sobre PCMSO/PGR e rodar primeiro teste LinkedIn.",
    },
    feedback: "Semana 1 simulada: campanha criada, 3 posts aprovados e foco em LinkedIn + blog SEO.",
  });
  log("13 atualizar acompanhamento", true, { progresso: updated?.acompanhamento?.progresso, foco: updated?.acompanhamento?.proximoFoco });
  await page.goto(`${BASE}/app/recalibracao`);
  await shot(page, "10-acompanhamento");

  await page.goto(`${BASE}/app/metricas`);
  await shot(page, "11-metricas");

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ email, report }, null, 2), "utf8");
  const md = [
    `# Auditoria Fluxo Saúde do Trabalho`,
    ``,
    `Conta: ${email}`,
    ``,
    ...report.map(r => `- ${r.ok ? "OK" : "FALHA"} **${r.step}**${r.error ? `: ${r.error}` : ""}`),
    ``,
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "report.md"), md, "utf8");
}

main().catch(err => {
  log("erro geral", false, {}, err);
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify({ email, report }, null, 2), "utf8");
  process.exitCode = 1;
});
