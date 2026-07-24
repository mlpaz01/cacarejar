import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

const nf = (n?: number) =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "-";

const pickImage = (item: any) =>
  String(
    item?.imageUrl ||
      item?.img ||
      item?.thumbnail ||
      item?.thumbnailUrl ||
      item?.displayUrl ||
      item?.mediaUrl ||
      item?.coverUrl ||
      item?.fonteImg ||
      ""
  );

const cleanText = (value: any, fallback = "") =>
  String(value || fallback).trim();

const truncate = (value: any, max = 220) => {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const hitKey = (h: any) =>
  String(
    h?.url ||
      h?.img ||
      `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`
  );

const readFeedbackDraft = () => {
  try {
    return JSON.parse(window.localStorage.getItem("cacarejar.radarFeedbackDraft") || "{}");
  } catch {
    return {};
  }
};

export default function DiagnosticoPrint() {
  const plan = trpc.diagnosis.get.useQuery();
  const radar = trpc.radar.get.useQuery();
  const shown: any = plan.data;
  const rd: any = radar.data;

  useEffect(() => {
    if (plan.isLoading || radar.isLoading || !shown) return;
    let cancelled = false;
    const run = async () => {
      await new Promise(r => window.setTimeout(r, 700));
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise<void>(res => {
            const done = () => res();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            window.setTimeout(done, 6500);
          });
        })
      );
      if (!cancelled) window.print();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [plan.isLoading, radar.isLoading, shown]);

  if (plan.isLoading) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Carregando relatorio...</div>;
  }

  if (!shown) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Nenhum diagnostico disponivel</h1>
        <p>Gere um diagnostico antes de exportar o PDF.</p>
        <a href="/app/diagnostico">Voltar</a>
      </div>
    );
  }

  const prof = shown.profile;
  const brandDNA = shown.brandDNA ?? {};
  const parecer = shown.parecerEstrategico ?? {};
  const situacao = (shown.situacao ?? []) as any[];
  const pilares = (shown.pilaresEstrategicos ?? []) as any[];
  const postAnalyses = (shown.analiseTopPosts ?? []) as string[];
  const topPosts = ((prof?.topPosts ?? []) as any[])
    .filter(post => pickImage(post))
    .slice(0, 3);
  const feedbackDraft = readFeedbackDraft();
  const liked = new Set(
    ((feedbackDraft?.likedPostKeys ?? rd?.feedback?.likedPostKeys ?? []) as string[])
  );
  const disliked = new Set(
    ((feedbackDraft?.dislikedPostKeys ?? rd?.feedback?.dislikedPostKeys ?? []) as string[])
  );
  const radarPosts = ((rd?.hits ?? []) as any[])
    .filter(hit => pickImage(hit))
    .slice(0, 8);
  const postIdeas = ((shown.postIdeas ?? []) as any[]).slice(0, 4);
  const timeline = ((shown.cronogramaMulticanal ?? shown.cronograma ?? []) as any[]).slice(0, 4);
  const acompanhamento = shown.acompanhamento;
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const title = prof?.handle
    ? `@${prof.handle}`
    : shown.site?.title || shown.produto || "Diagnostico";
  const subtitle =
    prof?.fullName || shown.nicho || shown.site?.url || shown.linkedin || "Plano multicanal";

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm 10mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { break-before: page; page-break-before: always; }
        }
        html, body, #root { background: #f7f9fc; }
        .doc { max-width: 188mm; margin: 0 auto; padding: 8mm 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #071b44; }
        .doc * { box-sizing: border-box; }
        h1, h2, h3, h4, p { margin: 0; }
        p { line-height: 1.48; }
        .cover { position: relative; overflow: hidden; min-height: 233mm; color: #fff; border-radius: 20px; padding: 28px; background: radial-gradient(circle at 88% 12%, rgba(255,50,23,.34), transparent 28%), linear-gradient(135deg,#041335 0%,#071b44 55%,#0d2a5e 100%); }
        .cover:after { content: ""; position: absolute; right: -44mm; bottom: -34mm; width: 118mm; height: 118mm; border-radius: 50%; border: 1px solid rgba(255,255,255,.14); }
        .badge { display: inline-flex; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: rgba(255,255,255,.82); padding: 6px 10px; font-size: 9px; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
        .cover-card { position: relative; z-index: 1; margin-top: 18px; border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.08); border-radius: 14px; padding: 14px; }
        .section { border: 1px solid #e1e7f0; border-radius: 14px; padding: 14px; margin-top: 10px; background: #fff; break-inside: avoid; }
        .section.dark { background: #071b44; color: #fff; border-color: #071b44; }
        .section.soft { background: #fbfcff; }
        .kicker { font-size: 9.5px; font-weight: 950; color: #ff3217; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
        .dark .kicker { color: #ff9c8f; }
        .heading { font-size: 18px; line-height: 1.1; font-weight: 950; color: #071b44; }
        .dark .heading { color: #fff; }
        .text { font-size: 11px; font-weight: 650; color: #22304b; }
        .small { font-size: 9.5px; font-weight: 650; color: #61708a; }
        .dark .text, .dark .small { color: rgba(255,255,255,.8); }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 9px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .mini { border: 1px solid #e1e7f0; border-radius: 10px; background: #fbfcff; padding: 9px; break-inside: avoid; }
        .pill { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; border: 1px solid #e1e7f0; background: #fff; color: #071b44; padding: 3px 8px; font-size: 8.5px; font-weight: 950; }
        .metric { text-align: center; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.1); padding: 10px 8px; }
        .metric .label { color: rgba(255,255,255,.58); font-size: 8.2px; font-weight: 950; text-transform: uppercase; }
        .metric .value { color: #fff; font-size: 15px; font-weight: 950; margin-top: 2px; }
        .post-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 10px; background: #eef2f7; display: block; }
        .post-square { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px; background: #eef2f7; display: block; }
        .quote { border-left: 3px solid #ff3217; padding-left: 10px; font-size: 11px; font-weight: 800; color: #071b44; }
        .line { height: 3px; width: 46px; border-radius: 999px; background: #ff3217; margin: 10px 0; }
        .bar { height: 4px; border-radius: 999px; background: #e8edf5; overflow: hidden; margin-top: 4px; }
        .bar span { display: block; height: 100%; border-radius: 999px; background: #ff3217; }
      `}</style>

      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#071b44", color: "#fff", padding: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Use Salvar como PDF na janela de impressao.</span>
        <button onClick={() => window.print()} style={{ border: 0, background: "#ff3217", color: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 900 }}>Imprimir / Salvar PDF</button>
      </div>

      <main className="doc">
        <section className="cover">
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/assets/logo-dark.png" alt="Cacarejar" style={{ height: 88, width: "auto", objectFit: "contain" }} />
            <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.72)", fontSize: 9, fontWeight: 900 }}>{today}</span>
          </div>
          <div style={{ position: "relative", zIndex: 1, marginTop: 70 }}>
            <span className="badge">Estudo estrategico</span>
            <div className="line" />
            <h1 style={{ color: "#fff", fontSize: 37, lineHeight: 1, fontWeight: 950, maxWidth: "145mm" }}>Estudo do seu negocio</h1>
            <p style={{ color: "rgba(255,255,255,.84)", fontSize: 13.5, fontWeight: 650, marginTop: 10, maxWidth: "142mm" }}>
              Analise feita pelo Agente Estrategista para {title}, com DNA visual, melhores posts, sinais de mercado, ideias criativas e plano de acao.
            </p>
            <div className="cover-card">
              <p style={{ fontSize: 10, color: "rgba(255,255,255,.55)", fontWeight: 950, textTransform: "uppercase", letterSpacing: ".06em" }}>Promessa central</p>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 850, marginTop: 5 }}>{shown.objetivoPrincipal || parecer.prescricaoImediata || "Transformar diagnostico em execucao semanal com criterio humano."}</p>
            </div>
          </div>
        </section>

        <section className="section dark page-break">
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            {prof?.profilePic && <img src={prof.profilePic} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,.28)" }} referrerPolicy="no-referrer" />}
            <div style={{ flex: 1 }}>
              <p className="kicker">Perfil analisado</p>
              <h2 className="heading">{title}</h2>
              <p className="small">{subtitle}</p>
            </div>
            <div className="grid4" style={{ width: "88mm" }}>
              <Metric label="Seguidores" value={nf(prof?.followers)} />
              <Metric label="Seguindo" value={nf(prof?.following)} />
              <Metric label="Posts" value={nf(prof?.postsCount)} />
              <Metric label="Engaj." value={prof?.engajamentoPct ? `${prof.engajamentoPct}%` : "-"} />
            </div>
          </div>
        </section>

        <section className="section">
          <p className="kicker">Sumario executivo</p>
          <h2 className="heading">{parecer.titulo || "Leitura estrategica"}</h2>
          <p className="text" style={{ marginTop: 7 }}>{parecer.analise || shown.sumarioExecutivo || shown.resumo}</p>
          <div className="mini" style={{ background: "#071b44", color: "#fff", borderColor: "#071b44", marginTop: 10 }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,.58)", fontWeight: 950, textTransform: "uppercase" }}>Prescricao imediata</p>
            <p style={{ fontSize: 11.5, color: "#fff", fontWeight: 850, marginTop: 3 }}>{parecer.prescricaoImediata || shown.objetivoPrincipal || "Validar o mercado no Radar antes de abrir o Estudio."}</p>
          </div>
        </section>

        <section className="section">
          <p className="kicker">DNA visual da marca</p>
          <h2 className="heading">O que preservar antes de criar</h2>
          <div className="grid2" style={{ marginTop: 9 }}>
            <Info title="Estilo de foto" text={brandDNA.estiloFoto || "Imagem realista com contexto humano."} />
            <Info title="Tom" text={brandDNA.tom || "Direto, util e humano."} />
            <Info title="Tipografia" text={brandDNA.tipografia || "Sans-serif forte e limpa."} />
            <Info title="Motivos recorrentes" text={(brandDNA.motivos ?? []).slice(0, 4).join(", ") || "Produto, pessoa, contexto e prova."} />
          </div>
          {!!brandDNA.paleta?.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
              {brandDNA.paleta.slice(0, 6).map((color: string) => (
                <span key={color} className="pill">
                  <span style={{ width: 13, height: 13, borderRadius: "50%", background: color, border: "1px solid rgba(0,0,0,.12)" }} />
                  {color}
                </span>
              ))}
            </div>
          )}
          {brandDNA.resumoVisual && <p className="quote" style={{ marginTop: 10 }}>{brandDNA.resumoVisual}</p>}
        </section>

        {!!situacao.length && (
          <section className="section">
            <p className="kicker">Analise da situacao</p>
            <div style={{ display: "grid", gap: 7 }}>
              {situacao.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="mini" style={{ display: "grid", gridTemplateColumns: "32mm 1fr", gap: 8, alignItems: "start" }}>
                  <p style={{ color: "#ff3217", fontSize: 10.5, fontWeight: 950 }}>{item.fator}</p>
                  <p className="text">{item.analise}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!pilares.length && (
          <section className="section">
            <p className="kicker">Pilares estrategicos</p>
            <div className="grid2">
              {pilares.slice(0, 4).map((pilar: any, i: number) => (
                <article key={i} className="mini">
                  <span className="pill" style={{ background: "#ff3217", color: "#fff", borderColor: "#ff3217" }}>Pilar {i + 1}</span>
                  <h3 style={{ fontSize: 13, color: "#071b44", fontWeight: 950, marginTop: 7 }}>{pilar.titulo}</h3>
                  <p className="small" style={{ marginTop: 4 }}>{pilar.objetivo}</p>
                  {(pilar.acoes ?? []).slice(0, 3).map((acao: any, j: number) => (
                    <p key={j} className="text" style={{ fontSize: 9.6, marginTop: 5 }}><b>{acao.acao}:</b> {acao.detalhe}</p>
                  ))}
                </article>
              ))}
            </div>
          </section>
        )}

        {!!topPosts.length && (
          <section className="section page-break">
            <p className="kicker">Seus melhores posts - e por que funcionam</p>
            <div className="grid3">
              {topPosts.map((post: any, i: number) => (
                <article key={i} className="mini">
                  <img src={pickImage(post)} alt="" className="post-img" referrerPolicy="no-referrer" />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                    <span className="pill">{nf(post.likes)} curtidas</span>
                    <span className="pill">{nf(post.comments)} comentarios</span>
                  </div>
                  <h3 style={{ color: "#071b44", fontSize: 12, fontWeight: 950, marginTop: 7 }}>Post {i + 1}</h3>
                  <p className="text" style={{ fontSize: 9.7, marginTop: 4 }}>{postAnalyses[i] || truncate(post.caption, 210)}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {!!radarPosts.length && (
          <section className="section">
            <p className="kicker">O que esta bombando no seu setor</p>
            <h2 className="heading">Concorrentes e criadores de inspiracao</h2>
            {rd?.marketSummary && <p className="text" style={{ marginTop: 7 }}>{rd.marketSummary}</p>}
            <div className="grid4" style={{ marginTop: 10 }}>
              {radarPosts.slice(0, 8).map((hit: any, i: number) => {
                const decision = liked.has(hitKey(hit)) ? "gostei" : disliked.has(hitKey(hit)) ? "nao gostei" : "sem feedback";
                return (
                  <article key={i} className="mini">
                    <img src={pickImage(hit)} alt="" className="post-square" referrerPolicy="no-referrer" />
                    <p style={{ fontSize: 10, color: "#071b44", fontWeight: 950, marginTop: 6 }}>@{hit.ownerUsername || "inspiracao"}</p>
                    <p className="small">{nf(hit.likes)} curtidas - {nf(hit.comments)} comentarios</p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                      <span className="pill" style={{ background: "#ff3217", color: "#fff", borderColor: "#ff3217" }}>{hit.hotScore ?? "-"} hot</span>
                      <span className="pill">{decision}</span>
                    </div>
                    <p className="text" style={{ fontSize: 9.2, marginTop: 5 }}>{truncate(hit.why || hit.mechanism || hit.caption, 145)}</p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!!postIdeas.length && (
          <section className="section">
            <p className="kicker">Posts sugeridos alinhados a estrategia</p>
            <p className="small" style={{ marginBottom: 9 }}>A imagem abaixo e a referencia visual disponivel: post campeao, sinal do Radar ou criativo ja gerado no Estudio.</p>
            <div className="grid2">
              {postIdeas.map((idea: any, i: number) => {
                const ref =
                  pickImage(idea) ||
                  pickImage(topPosts[i % Math.max(1, topPosts.length)]) ||
                  pickImage(radarPosts[i % Math.max(1, radarPosts.length)]);
                return (
                  <article key={i} className="mini">
                    {ref && <img src={ref} alt="" className="post-img" referrerPolicy="no-referrer" />}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: ref ? 7 : 0 }}>
                      <span className="pill">{idea.formato || "post"}</span>
                      <span className="pill">{idea.angulo || idea.pilar || "estrategia"}</span>
                    </div>
                    <h3 style={{ color: "#071b44", fontSize: 13, fontWeight: 950, marginTop: 7 }}>{idea.titulo || idea.gancho}</h3>
                    <p className="text" style={{ marginTop: 5 }}>{idea.gancho}</p>
                    <p className="small" style={{ marginTop: 5 }}>{truncate(idea.copy || idea.legenda, 260)}</p>
                    {idea.cta && <p style={{ color: "#ff3217", fontSize: 9.8, fontWeight: 950, marginTop: 5 }}>CTA: {idea.cta}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!!timeline.length && (
          <section className="section">
            <p className="kicker">Cronograma multicanal</p>
            <h2 className="heading">O plano vira execucao semanal por canal</h2>
            <div className="grid2">
              {timeline.map((item: any, i: number) => (
                <article key={i} className="mini">
                  <span className="pill" style={{ background: "#071b44", color: "#fff", borderColor: "#071b44" }}>{item.periodo || item.semana || `Etapa ${i + 1}`}</span>
                  <h3 style={{ color: "#071b44", fontSize: 12.5, fontWeight: 950, marginTop: 7 }}>{item.foco || item.tema}</h3>
                  {(item.canais ?? []).slice(0, 4).map((c: any, j: number) => (
                    <p key={j} className="small" style={{ marginTop: 4 }}><b>{c.canal}:</b> {c.acao}{c.objetivo ? ` (${c.objetivo})` : ""}</p>
                  ))}
                  {item.meta && <p style={{ color: "#18a34a", fontSize: 9.8, fontWeight: 900, marginTop: 6 }}>{item.meta}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {acompanhamento && (
          <section className="section">
            <p className="kicker">Acompanhamento</p>
            <h2 className="heading">Foto inicial, check-in e proximo ciclo</h2>
            <div className="grid2" style={{ marginTop: 9 }}>
              <div className="mini" style={{ background: "#071b44", borderColor: "#071b44", color: "#fff" }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,.6)", fontWeight: 950, textTransform: "uppercase" }}>{acompanhamento.ciclo || "Ciclo de 30 dias"}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginTop: 12 }}>
                  <p style={{ color: "rgba(255,255,255,.72)", fontSize: 11, fontWeight: 800 }}>Progresso</p>
                  <p style={{ color: "#fff", fontSize: 28, fontWeight: 950 }}>{acompanhamento.progresso ?? 0}%</p>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,.16)", overflow: "hidden", marginTop: 6 }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.min(100, acompanhamento.progresso ?? 0)}%`, background: "#ff3217" }} />
                </div>
                <p style={{ color: "#fff", fontSize: 11.5, fontWeight: 900, marginTop: 12 }}>Proximo foco: {acompanhamento.proximoFoco || "Executar Semana 1"}</p>
                <p style={{ color: "rgba(255,255,255,.76)", fontSize: 9.5, fontWeight: 650, marginTop: 5 }}>{acompanhamento.novaPrescricao || "Registrar resultados para o Agente comparar a evolucao."}</p>
              </div>
              <div className="grid2">
                {(acompanhamento.snapshots ?? []).slice(0, 4).map((snap: any, i: number) => (
                  <article key={`${snap.label || "snapshot"}-${i}`} className="mini">
                    <h3 style={{ color: "#071b44", fontSize: 11.5, fontWeight: 950 }}>{snap.label || `Check-in ${i + 1}`}</h3>
                    <p className="small" style={{ marginTop: 4 }}>{truncate(snap.resumo, 150)}</p>
                    <div style={{ display: "grid", gap: 6, marginTop: 7 }}>
                      {(snap.scores ?? []).slice(0, 3).map((score: any) => (
                        <ScoreMini key={score.nome} label={score.nome} value={score.valor} />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="section dark">
          <p className="kicker">Conclusao</p>
          <h2 className="heading">Da estrategia ao aprendizado</h2>
          <p className="text" style={{ marginTop: 8 }}>{shown.conclusao || "O proximo passo e executar o ciclo com foco: validar referencias, editar no Estudio, aprovar, publicar e medir o que trouxe conversa real."}</p>
        </section>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
    </div>
  );
}

function Info({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mini">
      <p style={{ fontSize: 10.5, color: "#071b44", fontWeight: 950 }}>{title}</p>
      <p className="small" style={{ marginTop: 4 }}>{text || "-"}</p>
    </div>
  );
}

function ScoreMini({ label, value }: { label: string; value?: number }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <p style={{ color: "#61708a", fontSize: 8.5, fontWeight: 900 }}>{label}</p>
        <p style={{ color: "#071b44", fontSize: 8.5, fontWeight: 950 }}>{pct}/100</p>
      </div>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
