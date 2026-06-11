/**
 * Relatório imprimível do Diagnóstico — formato A4, sem sidebar/header.
 * Aberto via /app/diagnostico/relatorio (botão "Exportar PDF" no estudo).
 * Após carregar, dispara window.print() para o cliente salvar como PDF.
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Heart, MessageCircle, BadgeCheck, Users, UserPlus, Grid3x3, TrendingUp,
  Target, Palette, Calendar, Flag, Sparkles, Film, Flame,
} from "lucide-react";

const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "—");

export default function DiagnosticoPrint() {
  const plan = trpc.diagnosis.get.useQuery();
  const radar = trpc.radar.get.useQuery();
  const shown: any = plan.data;
  const rd: any = radar.data;

  useEffect(() => {
    if (plan.isLoading || radar.isLoading) return;
    if (!shown) return;
    // Espera TODAS as imagens da página carregarem antes de chamar print() —
    // senão os posts sugeridos podem sair em branco no PDF.
    let cancelled = false;
    const waitAllImages = async () => {
      // dá um respiro para o React montar todas as <img>
      await new Promise(r => window.setTimeout(r, 400));
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>(res => {
          const done = () => res();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          // timeout por imagem (não trava a impressão se uma falhar)
          window.setTimeout(done, 5000);
        });
      }));
      if (!cancelled) window.print();
    };
    waitAllImages();
    return () => { cancelled = true; };
  }, [plan.isLoading, radar.isLoading, shown]);

  if (plan.isLoading) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Carregando relatório…</div>;
  }
  if (!shown) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Nenhum estudo disponível</h1>
        <p>Faça o diagnóstico do seu negócio antes de exportar o relatório.</p>
        <a href="/app/diagnostico">Voltar para o Diagnóstico</a>
      </div>
    );
  }

  const prof = shown.profile;
  const dna = shown.brandDNA;
  const e = shown.estrategia ?? {};
  const ideas: any[] = shown.postIdeas ?? [];
  const radarContribution = shown.radarContribuicoes;
  const radarSelectedIdeas: any[] = (radarContribution?.ideias ?? [])
    .filter((it: any) => it.status === "use")
    .map((it: any) => ({ ...it, idea: rd?.ideas?.[it.index] }))
    .filter((it: any) => it.idea);
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const radarFeedbackDraft = (() => {
    try {
      return JSON.parse(window.localStorage.getItem("cacarejar.radarFeedbackDraft") || "null");
    } catch {
      return null;
    }
  })();
  const useRadarDraft = !!radarFeedbackDraft && (!rd?.scannedAt || radarFeedbackDraft.scannedAt === rd.scannedAt);
  const radarLikedPostKeys = new Set((useRadarDraft ? radarFeedbackDraft.likedPostKeys : rd?.feedback?.likedPostKeys) ?? []);
  const radarDislikedPostKeys = new Set((useRadarDraft ? radarFeedbackDraft.dislikedPostKeys : rd?.feedback?.dislikedPostKeys) ?? []);
  const radarHitKey = (h: any) => String(h?.url || h?.img || String(h?.ownerUsername || "") + ":" + String(h?.caption || "").slice(0, 80));
  const radarHitDecision = (h: any) => radarLikedPostKeys.has(radarHitKey(h)) ? "gostei" : radarDislikedPostKeys.has(radarHitKey(h)) ? "nao gostei" : "sem feedback";
  const radarIdeaDecision = (idea: any) => idea?.diagnosisDecision === "use" ? "gostei" : idea?.diagnosisDecision === "skip" ? "nao gostei" : "Agente decide";

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        html, body, #root { background: #fff; }
        .doc { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #22304b; max-width: 186mm; margin: 0 auto; }
        .doc * { box-sizing: border-box; }
        .doc h1, .doc h2, .doc h3, .doc h4 { color: #070b17; margin: 0; }
        .cover h1, .cover h2, .cover h3, .cover h4 { color: #fff; }
        .doc p { margin: 0; line-height: 1.5; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }
        .page-break { page-break-before: always; break-before: page; }
        .meta { font-size: 10px; color: #8492a6; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; }
        .pill { display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .gridPillars { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .card { border: 1px solid #e6ebf3; border-radius: 10px; padding: 14px; background: #fff; }
        .card h3 { font-size: 11px; font-weight: 900; color: #ff3217; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .bullet { font-size: 11px; line-height: 1.5; padding-left: 12px; position: relative; font-weight: 600; color: #22304b; margin-bottom: 4px; }
        .bullet:before { content: "•"; position: absolute; left: 0; color: #ff3217; font-weight: 900; }
        .post-card { border: 1px solid #e6ebf3; border-radius: 10px; overflow: hidden; }
        .post-card img { width: 100%; aspect-ratio: 1/1; object-fit: cover; background: #f6f8fc; display: block; }
        .post-meta { padding: 8px 10px; }
      `}</style>

      {/* Barra de ações (só na tela, some no PDF) */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 50, background: "#071b44", color: "#fff", padding: "10px 20px", display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.8 }}>Use <strong>Salvar como PDF</strong> no diálogo de impressão (margens "padrão", gráficos de fundo ligados).</span>
        <button onClick={() => window.print()} style={{ background: "#ff3217", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: "pointer" }}>Imprimir / Salvar PDF</button>
      </div>

      <div className="doc" style={{ padding: "10mm 0" }}>
        {/* Capa */}
        <div className="avoid-break cover" style={{ background: "linear-gradient(135deg,#071b44 0%,#0d2a5e 72%,#132f68 100%)", color: "#fff", borderRadius: 16, padding: 24, marginBottom: 14, boxShadow: "0 10px 24px rgba(7,27,68,0.18)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <img src="/assets/logo-dark.png" alt="Cacarejar" style={{ height: 65, width: 180, objectFit: "contain", display: "block" }} />
            <span style={{ marginLeft: "auto", fontSize: 9.5, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 900, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "5px 9px" }}>Estudo Estrategico - {today}</span>
          </div>
          <div style={{ width: 42, height: 3, borderRadius: 999, background: "#ff3217", marginBottom: 10 }} />
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 950, lineHeight: 1.08, marginTop: 0, marginBottom: 8, letterSpacing: "-0.01em" }}>Estudo do seu negocio</h1>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.86)", maxWidth: 480 }}>Analise feita pelo Agente Estrategista{prof ? ` para @${prof.handle}` : ""}, com plano de acao, DNA visual, ideias criativas e sinais de mercado.</p>
        </div>
        {/* Header de perfil */}
        {prof && (
          <div className="avoid-break card" style={{ background: "#fafbfd", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              {prof.profilePic && <img src={prof.profilePic} alt="" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid #e6ebf3" }} />}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 16, color: "#070b17" }}>@{prof.handle}</span>
                  {prof.verified && <BadgeCheck className="w-4 h-4" style={{ color: "#3897f0" }} />}
                </div>
                {prof.fullName && <p style={{ fontSize: 11, fontWeight: 700, color: "#22304b" }}>{prof.fullName}</p>}
                {prof.bio && <p style={{ fontSize: 10, color: "#61708a", marginTop: 4, whiteSpace: "pre-line", maxWidth: 360 }}>{prof.bio}</p>}
              </div>
              <div className="grid4" style={{ gap: 6, minWidth: 280 }}>
                <Metric icon={<Users className="w-3 h-3" />} label="Seguidores" value={nf(prof.followers)} />
                <Metric icon={<UserPlus className="w-3 h-3" />} label="Seguindo" value={nf(prof.following)} />
                <Metric icon={<Grid3x3 className="w-3 h-3" />} label="Posts" value={nf(prof.postsCount)} />
                <Metric icon={<TrendingUp className="w-3 h-3" />} label="Engaj." value={prof.engajamentoPct ? `${prof.engajamentoPct}%` : "—"} highlight />
              </div>
            </div>
          </div>
        )}

        {shown.linkedin && (
          <div className="avoid-break card" style={{ marginBottom: 12, background: "#f8fbff" }}>
            <h3>LinkedIn usado na Visao 360</h3>
            <p style={{ fontSize: 10.5, fontWeight: 800, color: "#071b44", wordBreak: "break-all" }}>{shown.linkedin}</p>
            <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 600, marginTop: 4 }}>
              Usado como contexto estrategico para linguagem B2B, areas afins, interesses e hipoteses de segmentacao.
            </p>
          </div>
        )}

        {/* Sumário executivo */}
        <div className="avoid-break card" style={{ marginBottom: 12 }}>
          <h3>Sumário executivo</h3>
          <p style={{ fontSize: 11.5, fontWeight: 600 }}>{shown.sumarioExecutivo ?? shown.resumo}</p>
          {shown.objetivoPrincipal && (
            <div style={{ background: "#071b44", color: "#fff", padding: 10, borderRadius: 8, marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <Target className="w-4 h-4" style={{ color: "#ff8a72", flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 11, fontWeight: 700 }}><strong>Objetivo:</strong> {shown.objetivoPrincipal}</p>
            </div>
          )}
        </div>

        {/* DNA visual */}
        {dna && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Palette className="w-3.5 h-3.5" /> DNA visual da marca</h3>
            <p style={{ fontSize: 10, color: "#61708a", marginBottom: 8 }}>Extraído dos posts campeões — toda imagem nova nasce com essa identidade.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {(dna.paleta ?? []).map((c: string, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid #e6ebf3", borderRadius: 999, padding: "3px 8px 3px 4px" }}>
                  <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,0.08)" }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#22304b", textTransform: "uppercase" }}>{c}</span>
                </div>
              ))}
            </div>
            <div className="grid2">
              <DnaRow label="Estilo de foto" value={dna.estiloFoto} />
              <DnaRow label="Tom" value={dna.tom} />
              <DnaRow label="Tipografia" value={dna.tipografia} />
              <DnaRow label="Motivos recorrentes" value={(dna.motivos ?? []).join(", ")} />
            </div>
            {dna.resumoVisual && <p style={{ fontSize: 11, fontStyle: "italic", color: "#22304b", marginTop: 8, fontWeight: 600 }}>"{dna.resumoVisual}"</p>}
          </div>
        )}

        {/* Análise da situação */}
        {shown.situacao?.length > 0 && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3>Análise da situação</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <tbody>
                {shown.situacao.map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: i < shown.situacao.length - 1 ? "1px solid #eef2f7" : "none" }}>
                    <td style={{ padding: "6px 8px 6px 0", fontWeight: 900, color: "#071b44", width: "30%", verticalAlign: "top" }}>{s.fator}</td>
                    <td style={{ padding: "6px 0", fontWeight: 600, color: "#22304b" }}>{s.analise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {shown.interessesPosts?.length > 0 && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Target className="w-3.5 h-3.5" /> Visao 360: interesses pelos posts</h3>
            <p style={{ fontSize: 10, color: "#61708a", fontWeight: 600, marginBottom: 8 }}>
              Interesses inferidos pelos sinais publicos dos posts, Radar e ideias marcadas para orientar conteudo e campanhas no LinkedIn.
            </p>
            <div className="gridPillars">
              {shown.interessesPosts.map((it: any, i: number) => (
                <div key={i} style={{ border: "1px solid #e6ebf3", borderRadius: 8, padding: 10, background: "#fbfcff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <div>
                      <span className="pill" style={{ background: "#fff1ef", color: "#ff3217", textTransform: "uppercase" }}>{it.categoria}</span>
                      <h4 style={{ fontSize: 11, fontWeight: 900, color: "#071b44", marginTop: 4 }}>{it.nome}</h4>
                    </div>
                    <span className="pill" style={{ background: "#071b44", color: "#fff", flexShrink: 0 }}>{it.score ?? 0}/100</span>
                  </div>
                  {it.sinal && <p style={{ fontSize: 9.6, fontWeight: 700, color: "#22304b", lineHeight: 1.35 }}>{it.sinal}</p>}
                  {it.conteudoLinkedIn && <p style={{ fontSize: 9.2, color: "#61708a", fontWeight: 600, lineHeight: 1.35, marginTop: 4 }}><strong>LinkedIn:</strong> {it.conteudoLinkedIn}</p>}
                  {it.targeting?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {it.targeting.slice(0, 4).map((t: string, j: number) => <span key={j} className="pill" style={{ background: "#fff", color: "#071b44", border: "1px solid #e6ebf3" }}>{t}</span>)}
                    </div>
                  )}
                  {it.evidencias?.length > 0 && (
                    <p style={{ fontSize: 8.8, color: "#61708a", fontWeight: 600, lineHeight: 1.3, marginTop: 6 }}>
                      <strong>Evidencia:</strong> {it.evidencias[0].fonte}: {it.evidencias[0].trecho}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pilares estratégicos */}
        {shown.pilaresEstrategicos?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Pilares estratégicos</h2>
            <div className="grid3">
              {shown.pilaresEstrategicos.map((p: any, i: number) => (
                <div key={i} className="avoid-break card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ background: "#fff1ef", color: "#ff3217", width: 22, height: 22, borderRadius: 6, fontWeight: 900, fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <h4 style={{ fontSize: 12, fontWeight: 900 }}>{p.titulo}</h4>
                  </div>
                  <p style={{ fontSize: 10, color: "#61708a", fontWeight: 700, marginBottom: 6 }}>{p.objetivo}</p>
                  {(p.acoes ?? []).map((a: any, j: number) => (
                    <p key={j} style={{ fontSize: 10, color: "#22304b", lineHeight: 1.4, marginBottom: 3 }}>
                      <strong>{a.acao}:</strong> {a.detalhe}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top posts */}
        {prof?.topPosts?.length > 0 && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3>🏆 Seus melhores posts — e por que funcionam</h3>
            <div className="grid3" style={{ marginTop: 8 }}>
              {prof.topPosts.map((p: any, i: number) => (
                <div key={i} className="post-card">
                  {p.img ? <img src={p.img} alt="" /> : <div style={{ aspectRatio: "1/1", background: "#f6f8fc" }} />}
                  <div className="post-meta">
                    <div style={{ display: "flex", gap: 8, fontSize: 10, fontWeight: 700, color: "#61708a", marginBottom: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Heart className="w-3 h-3" style={{ color: "#ff3217" }} /> {nf(p.likes)}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MessageCircle className="w-3 h-3" /> {nf(p.comments)}</span>
                    </div>
                    <p style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.4 }}>{shown.analiseTopPosts?.[i] ?? (p.caption || "").slice(0, 90)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radar de Mercado completo */}
        {rd && (
          <div className="page-break" style={{ marginBottom: 12 }}>
            <div className="avoid-break card" style={{ marginBottom: 12, background: "#071b44", color: "#fff", borderColor: "#071b44" }}>
              <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 950, display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Flame className="w-4 h-4" style={{ color: "#ff8a72" }} /> Radar de Mercado completo
              </h2>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>
                Conteudo do Agente Radar usado para complementar o diagnostico, incluindo sinais de mercado, posts analisados, feedbacks e ideias geradas.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {rd.quality && <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)" }}>Pesquisa {rd.quality.grade} - {rd.quality.hitsCount} hits - {rd.quality.sourcesCount} fontes</span>}
                <span className="pill" style={{ background: "#eafff1", color: "#087a32" }}>{radarLikedPostKeys.size} gostei em posts</span>
                <span className="pill" style={{ background: "#fff1ef", color: "#c20f00" }}>{radarDislikedPostKeys.size} nao gostei em posts</span>
                <span className="pill" style={{ background: "#fff", color: "#071b44" }}>{(rd.ideas ?? []).filter((i: any) => i.diagnosisDecision === "use").length} ideias aprovadas</span>
              </div>
            </div>

            {rd.marketSummary && (
              <div className="avoid-break card" style={{ marginBottom: 12 }}>
                <h3>Resumo do mercado</h3>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#22304b" }}>{rd.marketSummary}</p>
                {(rd.sources?.length > 0 || rd.hashtags?.length > 0) && (
                  <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 700, marginTop: 8 }}>
                    Fontes: {rd.sources?.map((src: string) => "@" + src).join(", ")}{rd.hashtags?.length ? " - Hashtags: " + rd.hashtags.map((h: string) => "#" + h).join(" ") : ""}
                  </p>
                )}
              </div>
            )}

            {rd.patterns?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Padroes vencedores detectados</h2>
                <div className="grid3">
                  {rd.patterns.map((p: any, i: number) => (
                    <div key={i} className="avoid-break card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                        <h4 style={{ fontSize: 11.5, fontWeight: 900, color: "#071b44" }}>{p.title}</h4>
                        <span className="pill" style={{ background: "#ff3217", color: "#fff", flexShrink: 0 }}>{p.hotScore ?? "-"} hot</span>
                      </div>
                      {p.insight && <p style={{ fontSize: 10, fontWeight: 700, color: "#22304b", marginBottom: 4 }}>{p.insight}</p>}
                      {p.whyItWorks && <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 600 }}><strong>Por que funciona:</strong> {p.whyItWorks}</p>}
                      {p.recommendedMove && <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 600, marginTop: 3 }}><strong>Como usar:</strong> {p.recommendedMove}</p>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {p.contentMechanism && <span className="pill" style={{ background: "#f6f8fc", color: "#071b44", border: "1px solid #e6ebf3" }}>{p.contentMechanism}</span>}
                        {(p.evidenceCount ?? 0) > 0 && <span className="pill" style={{ background: "#fff1ef", color: "#ff3217" }}>{p.evidenceCount} evidencias</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rd.opportunities?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Oportunidades para apostar</h2>
                <div className="grid2">
                  {rd.opportunities.map((o: any, i: number) => (
                    <div key={i} className="avoid-break card" style={{ padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                        <h4 style={{ fontSize: 11.5, fontWeight: 900, color: "#071b44" }}>{o.title}</h4>
                        <span className="pill" style={{ background: "#eafff1", color: "#087a32", flexShrink: 0 }}>{o.priorityScore ?? "-"} prioridade</span>
                      </div>
                      {o.reasonToBet && <p style={{ fontSize: 10, fontWeight: 700, color: "#22304b" }}>{o.reasonToBet}</p>}
                      {o.suggestedAngle && <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 600, marginTop: 4 }}><strong>Angulo:</strong> {o.suggestedAngle}</p>}
                      {o.firstPostIdea && <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 600, marginTop: 3 }}><strong>Primeiro post:</strong> {o.firstPostIdea}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rd.hits?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Posts analisados pelo Radar</h2>
                <div className="grid3">
                  {rd.hits.map((h: any, i: number) => {
                    const status = radarHitDecision(h);
                    return (
                      <div key={i} className="avoid-break post-card">
                        {h.img ? <img src={h.img} alt="" style={{ objectFit: "contain" }} /> : <div style={{ aspectRatio: "1/1", background: "#f6f8fc" }} />}
                        <div className="post-meta">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "flex-start" }}>
                            <p style={{ fontSize: 10, fontWeight: 900, color: "#071b44" }}>@{h.ownerUsername}</p>
                            <span className="pill" style={{ background: status === "gostei" ? "#eafff1" : status === "nao gostei" ? "#fff1ef" : "#f6f8fc", color: status === "gostei" ? "#087a32" : status === "nao gostei" ? "#c20f00" : "#61708a", border: "1px solid #e6ebf3" }}>{status}</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 9, fontWeight: 800, color: "#61708a", marginTop: 4 }}>
                            <span className="pill" style={{ background: "#fff1ef", color: "#ff3217" }}>{h.hotScore ?? "-"} hot</span>
                            <span>{nf(h.likes)} likes</span><span>{nf(h.comments)} comentarios</span>
                            {typeof h.engagementRate === "number" && <span>{h.engagementRate}% eng.</span>}
                          </div>
                          {h.mechanism && <p style={{ fontSize: 9, color: "#ff3217", fontWeight: 900, marginTop: 4 }}>{h.mechanism}</p>}
                          {h.why && <p style={{ fontSize: 9.5, fontWeight: 650, lineHeight: 1.35, marginTop: 4 }}><strong>Por que bombou:</strong> {h.why}</p>}
                          {h.caption && <p style={{ fontSize: 9, color: "#61708a", fontWeight: 600, lineHeight: 1.35, marginTop: 4 }}><strong>Legenda:</strong> {String(h.caption).slice(0, 360)}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {rd.ideas?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Ideias geradas pelo Radar</h2>
                <div className="grid3">
                  {rd.ideas.map((it: any, i: number) => {
                    const status = radarIdeaDecision(it);
                    return (
                      <div key={i} className="avoid-break card" style={{ padding: 0, overflow: "hidden" }}>
                        {it.imageUrl && <img src={it.imageUrl} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", background: "#f6f8fc" }} />}
                        <div style={{ padding: 10 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5 }}>
                            <span className="pill" style={{ background: status === "gostei" ? "#eafff1" : status === "nao gostei" ? "#fff1ef" : "#f6f8fc", color: status === "gostei" ? "#087a32" : status === "nao gostei" ? "#c20f00" : "#61708a", border: "1px solid #e6ebf3" }}>{status}</span>
                            {it.fonte && <span className="pill" style={{ background: "#fff1ef", color: "#ff3217" }}>@{it.fonte}</span>}
                            {it.formato && <span className="pill" style={{ background: "#f1f4f9", color: "#61708a", textTransform: "uppercase" }}>{it.formato}</span>}
                          </div>
                          {it.opportunityTitle && <p style={{ fontSize: 9.5, color: "#61708a", fontWeight: 800, marginBottom: 3 }}>Oportunidade: {it.opportunityTitle}</p>}
                          {it.gancho && <p style={{ fontSize: 11, fontWeight: 900, color: "#070b17", lineHeight: 1.3 }}>{it.gancho}</p>}
                          {it.copy && <p style={{ fontSize: 9.8, fontWeight: 600, lineHeight: 1.4, marginTop: 4 }}>{it.copy}</p>}
                          {Array.isArray(it.hashtags) && it.hashtags.length > 0 && <p style={{ fontSize: 8.8, color: "#ff3217", fontWeight: 800, marginTop: 4 }}>{it.hashtags.map((h: string) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</p>}
                          {it.cta && <p style={{ fontSize: 9, color: "#61708a", marginTop: 3 }}><strong>CTA:</strong> {it.cta}</p>}
                          {it.diagnosisFeedback && <p style={{ fontSize: 9, color: "#071b44", background: "#f6f8fc", borderRadius: 6, padding: 6, marginTop: 6 }}><strong>Feedback:</strong> {it.diagnosisFeedback}</p>}
                          {it.diagnosisReason && <p style={{ fontSize: 9, color: "#61708a", fontWeight: 600, marginTop: 4 }}><strong>Decisao:</strong> {it.diagnosisReason}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contribuicoes do Radar no diagnostico */}
        {radarContribution && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles className="w-3.5 h-3.5" /> Contribuicoes do Radar no diagnostico</h3>
            {radarContribution.resumo && <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{radarContribution.resumo}</p>}
            {radarContribution.recomendacao && <p style={{ fontSize: 10, color: "#61708a", fontWeight: 600, marginBottom: 8 }}>{radarContribution.recomendacao}</p>}
            {radarSelectedIdeas.length > 0 && (
              <div className="grid3">
                {radarSelectedIdeas.map((entry: any) => (
                  <div key={entry.index} style={{ border: "1px solid #e6ebf3", borderRadius: 8, overflow: "hidden" }}>
                    {entry.idea.imageUrl && <img src={entry.idea.imageUrl} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", background: "#f6f8fc" }} />}
                    <div style={{ padding: 8 }}>
                      <span className="pill" style={{ background: "#eafff1", color: "#087a32", border: "1px solid #bfeccb" }}>Entra no diagnostico</span>
                      {entry.idea.gancho && <p style={{ fontSize: 10.5, fontWeight: 900, marginTop: 5, color: "#070b17" }}>{entry.idea.gancho}</p>}
                      {entry.reason && <p style={{ fontSize: 9.5, fontWeight: 600, color: "#61708a", marginTop: 4 }}>{entry.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post ideas */}
        {ideas.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 900, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles className="w-4 h-4" style={{ color: "#ff3217" }} /> Posts sugeridos (alinhados à estratégia)
            </h2>
            <div className="grid3">
              {ideas.map((it: any, i: number) => (
                <div key={i} className="avoid-break card" style={{ padding: 0, overflow: "hidden" }}>
                  {it.imageUrl && (
                    <img src={it.imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", background: "#f6f8fc", display: "block" }} />
                  )}
                  <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
                    {it.pilar && <span className="pill" style={{ background: "#fff1ef", color: "#ff3217" }}>{it.pilar}</span>}
                    {it.formato && <span className="pill" style={{ background: "#f1f4f9", color: "#61708a", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 3 }}>{it.formato === "reels" && <Film className="w-2.5 h-2.5" />}{it.formato}</span>}
                  </div>
                  {it.gancho && <p style={{ fontSize: 11.5, fontWeight: 900, color: "#070b17", lineHeight: 1.3, marginBottom: 4 }}>{it.gancho}</p>}
                  {it.copy && <p style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.45, marginBottom: 4 }}>{it.copy}</p>}
                  {Array.isArray(it.hashtags) && it.hashtags.length > 0 && (
                    <p style={{ fontSize: 9, color: "#ff3217", fontWeight: 800 }}>{it.hashtags.map((h: string) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</p>
                  )}
                  {it.cta && <p style={{ fontSize: 9, color: "#61708a", marginTop: 3 }}><strong>CTA:</strong> {it.cta}</p>}
                  {it.roteiro && (
                    <div style={{ background: "#f6f8fc", borderRadius: 6, padding: 8, marginTop: 6 }}>
                      <p style={{ fontSize: 9.5, fontWeight: 900, color: "#070b17" }}>🎬 {it.roteiro.gancho3s}</p>
                      {(it.roteiro.cenas ?? []).map((c: any, j: number) => (
                        <p key={j} style={{ fontSize: 9, color: "#22304b", marginTop: 2 }}>
                          <strong>{c.tempo}</strong> · {c.acao} <span style={{ opacity: 0.6 }}>· {c.audio}</span>
                        </p>
                      ))}
                      {it.roteiro.cta && <p style={{ fontSize: 9, marginTop: 2 }}><strong>CTA:</strong> {it.roteiro.cta}</p>}
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cronograma */}
        {shown.cronograma?.length > 0 && (
          <div className="avoid-break card" style={{ marginBottom: 12 }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}><Calendar className="w-3.5 h-3.5" /> Cronograma</h3>
            <div className="grid4" style={{ marginTop: 8 }}>
              {shown.cronograma.map((c: any, i: number) => (
                <div key={i} style={{ border: "1px solid #e6ebf3", borderRadius: 8, padding: 10 }}>
                  <span style={{ background: "#071b44", color: "#fff", fontSize: 9, fontWeight: 900, padding: "3px 8px", borderRadius: 4 }}>{c.periodo}</span>
                  <p style={{ fontSize: 10, fontWeight: 600, marginTop: 6 }}>{c.foco}</p>
                  <p style={{ fontSize: 9, color: "#18b85c", fontWeight: 900, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}><Flag className="w-2.5 h-2.5" /> {c.meta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estratégia / KPIs */}
        <div className="grid2" style={{ marginBottom: 12 }}>
          <div className="avoid-break card">
            <h3>Estratégia & Funil</h3>
            <p style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 3 }}>📣 {e.canal}</p>
            <p style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 3 }}>🪜 {e.funil}</p>
            <p style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 3 }}>🎯 {(e.angulos ?? []).join(" · ")}</p>
            <p style={{ fontSize: 10.5, fontWeight: 700 }}>💰 {e.oferta}</p>
          </div>
          <div className="avoid-break card">
            <h3>KPIs & características</h3>
            <p style={{ fontSize: 10, fontWeight: 800 }}>KPIs: {(shown.kpis ?? []).join(" · ")}</p>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(shown.suggestedFactors ?? {}).map(([k, v]: any) => (
                <span key={k} className="pill" style={{ background: "#fff1ef", color: "#ff3217", border: "1px solid #ffd0c8" }}>{String(v).replace(/_/g, " ")}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Conclusão */}
        {shown.conclusao && (
          <div className="avoid-break" style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)", color: "#fff", borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <h3 style={{ color: "#ff8a72", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.05, marginBottom: 6, fontWeight: 900 }}>Conclusão</h3>
            <p style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.5 }}>{shown.conclusao}</p>
          </div>
        )}

        {/* Rodapé */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#8492a6", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e6ebf3" }}>
          Gerado em {today} · cacarejar.com.br — motor de marketing com agentes exclusivos
        </div>
      </div>
    </>
  );
}

function Metric({ icon, label, value, highlight }: any) {
  return (
    <div style={{ background: highlight ? "#fff1ef" : "#f6f8fc", border: `1px solid ${highlight ? "#ffd0c8" : "#e6ebf3"}`, borderRadius: 8, padding: "5px 6px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 800, color: highlight ? "#ff3217" : "#61708a" }}>{icon}{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#070b17", marginTop: 1 }}>{value}</div>
    </div>
  );
}

function DnaRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ background: "#f6f8fc", borderRadius: 6, padding: 8 }}>
      <p style={{ fontSize: 9, fontWeight: 900, color: "#61708a", textTransform: "uppercase", letterSpacing: 0.05 }}>{label}</p>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: "#22304b", lineHeight: 1.4, marginTop: 2 }}>{value}</p>
    </div>
  );
}
