import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

const nf = (n?: number) => (typeof n === "number" ? n.toLocaleString("pt-BR") : "-");
const hitKey = (h: any) => String(h?.url || h?.img || `${h?.ownerUsername || ""}:${String(h?.caption || "").slice(0, 80)}`);

export default function DiagnosticoPrint() {
  const plan = trpc.diagnosis.get.useQuery();
  const radar = trpc.radar.get.useQuery();
  const shown: any = plan.data;
  const rd: any = radar.data;

  useEffect(() => {
    if (plan.isLoading || radar.isLoading || !shown) return;
    let cancelled = false;
    const run = async () => {
      await new Promise(r => window.setTimeout(r, 450));
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>(res => {
          const done = () => res();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 5000);
        });
      }));
      if (!cancelled) window.print();
    };
    run();
    return () => { cancelled = true; };
  }, [plan.isLoading, radar.isLoading, shown]);

  if (plan.isLoading) return <div style={{ padding: 40, fontFamily: "system-ui" }}>Carregando relatorio...</div>;
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
  const parecer = shown.parecerEstrategico ?? {};
  const fontes = shown.fontesUsadas ?? [];
  const metodo = shown.metodoDiagnostico ?? [];
  const acoesImediatas = shown.acoesImediatas ?? [];
  const prescricoes = shown.prescricoesPorCanal ?? [];
  const timeline = shown.cronogramaMulticanal ?? [];
  const interests = shown.interessesPosts ?? [];
  const linkedin360 = shown.linkedin360;
  const acompanhamento = shown.acompanhamento;
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const hotHits = ((rd?.hits ?? []) as any[]).slice(0, 6);
  const liked = new Set((rd?.feedback?.likedPostKeys ?? []) as string[]);
  const disliked = new Set((rd?.feedback?.dislikedPostKeys ?? []) as string[]);

  return (
    <>
      <style>{`
        @page { size: A4; margin: 13mm 11mm; }
        @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        html, body, #root { background: #fff; }
        .doc { max-width: 188mm; margin: 0 auto; padding: 8mm 0; font-family: Inter, system-ui, -apple-system, sans-serif; color: #22304b; }
        .doc * { box-sizing: border-box; }
        h1, h2, h3, h4, p { margin: 0; }
        p { line-height: 1.48; }
        .cover { background: linear-gradient(135deg,#071b44,#0d2a5e); color: #fff; border-radius: 16px; padding: 22px; margin-bottom: 12px; break-inside: avoid; }
        .section { border: 1px solid #e6ebf3; border-radius: 12px; padding: 14px; margin-bottom: 10px; break-inside: avoid; background: #fff; }
        .section h3 { font-size: 11px; font-weight: 950; color: #ff3217; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 7px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .mini { border: 1px solid #e6ebf3; border-radius: 9px; padding: 9px; background: #fbfcff; }
        .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 8px; font-size: 9px; font-weight: 900; }
        .bullet { position: relative; padding-left: 11px; font-size: 9.6px; font-weight: 650; color: #22304b; margin-top: 4px; }
        .bullet:before { content: "•"; position: absolute; left: 0; color: #ff3217; font-weight: 950; }
        .small { font-size: 9.5px; color: #61708a; font-weight: 650; }
        .text { font-size: 11px; font-weight: 650; color: #22304b; }
        .post img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; background: #f6f8fc; }
      `}</style>

      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#071b44", color: "#fff", padding: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <span style={{ fontSize: 12, opacity: .8 }}>Use Salvar como PDF na janela de impressao.</span>
        <button onClick={() => window.print()} style={{ border: 0, background: "#ff3217", color: "#fff", borderRadius: 10, padding: "8px 14px", fontWeight: 900 }}>Imprimir / Salvar PDF</button>
      </div>

      <main className="doc">
        <section className="cover">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <img src="/assets/logo-dark.png" alt="Cacarejar" style={{ height: 58, width: 170, objectFit: "contain" }} />
            <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 999, padding: "5px 9px" }}>{today}</span>
          </div>
          <div style={{ width: 42, height: 3, borderRadius: 999, background: "#ff3217", marginBottom: 10 }} />
          <h1 style={{ color: "#fff", fontSize: 28, lineHeight: 1.05, fontWeight: 950 }}>Parecer estrategico</h1>
          <p style={{ color: "rgba(255,255,255,.84)", fontSize: 12.5, fontWeight: 650, marginTop: 7 }}>
            Diagnostico multicanal feito pelo Agente Estrategista{prof?.handle ? ` para @${prof.handle}` : ""}.
          </p>
        </section>

        <section className="section" style={{ background: "#fbfcff" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {prof?.profilePic && <img src={prof.profilePic} alt="" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover" }} />}
            <div style={{ flex: 1 }}>
              <h2 style={{ color: "#071b44", fontSize: 17, fontWeight: 950 }}>{prof?.handle ? `@${prof.handle}` : shown.linkedin360?.empresa || shown.produto || "Diagnostico"}</h2>
              <p className="small">{prof?.fullName || shown.nicho || shown.linkedin || shown.site?.url || "Plano multicanal"}</p>
            </div>
            <div className="grid4" style={{ minWidth: 300 }}>
              <Metric label="Seguidores" value={nf(prof?.followers)} />
              <Metric label="Seguindo" value={nf(prof?.following)} />
              <Metric label="Posts" value={nf(prof?.postsCount)} />
              <Metric label="Engaj." value={prof?.engajamentoPct ? `${prof.engajamentoPct}%` : "-"} />
            </div>
          </div>
        </section>

        <section className="section">
          <h3>Parecer</h3>
          <h2 style={{ fontSize: 17, color: "#071b44", fontWeight: 950, marginBottom: 6 }}>{parecer.titulo || "Leitura do Agente Estrategista"}</h2>
          <p className="text">{parecer.analise || shown.sumarioExecutivo || shown.resumo}</p>
          <div style={{ background: "#071b44", color: "#fff", padding: 10, borderRadius: 9, marginTop: 9 }}>
            <p style={{ fontSize: 9.5, color: "rgba(255,255,255,.7)", fontWeight: 900, textTransform: "uppercase" }}>Prescricao imediata</p>
            <p style={{ fontSize: 11, fontWeight: 800 }}>{parecer.prescricaoImediata || shown.objetivoPrincipal || "Executar a primeira semana e medir sinais por canal."}</p>
          </div>
          {parecer.radarImpacto && <p className="small" style={{ marginTop: 8 }}>{parecer.radarImpacto}</p>}
        </section>

        {fontes.length > 0 && (
          <section className="section">
            <h3>Fontes usadas</h3>
            <div className="grid2">{fontes.map((f: any, i: number) => <Info key={i} title={f.canal} text={f.origem} note={f.sinal} />)}</div>
          </section>
        )}

        {metodo.length > 0 && (
          <section className="section">
            <h3>Metodo do diagnostico</h3>
            <div className="grid2">
              {metodo.map((m: any, i: number) => (
                <div className="mini" key={i}>
                  <h4 style={{ color: "#071b44", fontSize: 11.5, fontWeight: 950 }}>{m.etapa}</h4>
                  <p className="small" style={{ marginTop: 4 }}>{m.leitura}</p>
                  <p style={{ fontSize: 9.3, color: "#22304b", fontWeight: 750, marginTop: 4 }}><strong>Decisao:</strong> {m.decisao}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {acoesImediatas.length > 0 && (
          <section className="section">
            <h3>Acoes imediatas</h3>
            <div className="grid2">
              {acoesImediatas.map((a: any, i: number) => (
                <div className="mini" key={i}>
                  <span className="pill" style={{ color: "#fff", background: "#ff3217" }}>{a.prioridade}</span>
                  <h4 style={{ color: "#071b44", fontSize: 12, fontWeight: 950, marginTop: 6 }}>{a.canal}</h4>
                  <p className="text" style={{ fontSize: 10, marginTop: 4 }}>{a.acao}</p>
                  <p className="small" style={{ marginTop: 4 }}>{a.motivo}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {prescricoes.length > 0 && (
          <section className="section">
            <h3>Prescricao por canal</h3>
            <div className="grid2">
              {prescricoes.map((p: any, i: number) => (
                <div className="mini" key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <h4 style={{ color: "#071b44", fontSize: 12.5, fontWeight: 950 }}>{p.canal}</h4>
                    <span className="pill" style={{ color: "#fff", background: "#071b44" }}>{p.prioridade}</span>
                  </div>
                  <p className="small" style={{ marginTop: 3 }}>{p.funcao}</p>
                  {(p.conteudos ?? []).slice(0, 3).map((c: string, j: number) => <p key={j} className="bullet">{c}</p>)}
                  {p.cta && <p style={{ fontSize: 9.5, color: "#071b44", fontWeight: 850, marginTop: 5 }}>CTA: {p.cta}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {linkedin360 && (
          <section className="section">
            <h3>Visao 360 para LinkedIn</h3>
            <div className="grid3">
              {(linkedin360.niveis ?? []).map((n: any, i: number) => (
                <div className="mini" key={i}>
                  <p style={{ fontSize: 9.5, color: "#ff3217", fontWeight: 950, textTransform: "uppercase" }}>{n.nivel}</p>
                  <p style={{ fontSize: 10.5, color: "#071b44", fontWeight: 900, marginTop: 3 }}>{n.descricao}</p>
                  {(n.achados ?? []).slice(0, 3).map((a: string, j: number) => <p key={j} className="bullet">{a}</p>)}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {[...(linkedin360.areasAfins ?? []), ...(linkedin360.cargos ?? []), ...(linkedin360.tecnologias ?? [])].slice(0, 16).map((item: string) => (
                <span key={item} className="pill" style={{ color: "#071b44", background: "#fff", border: "1px solid #e6ebf3" }}>{item}</span>
              ))}
            </div>
            {!!linkedin360.publicosAnuncio?.length && (
              <div className="grid2" style={{ marginTop: 8 }}>
                {linkedin360.publicosAnuncio.slice(0, 4).map((p: any, i: number) => (
                  <div className="mini" key={i}>
                    <h4 style={{ color: "#071b44", fontSize: 11.5, fontWeight: 950 }}>{p.nome}</h4>
                    <p className="small" style={{ marginTop: 4 }}>{p.mensagem}</p>
                    <p style={{ fontSize: 9.2, color: "#22304b", fontWeight: 750, marginTop: 4 }}><strong>Oferta:</strong> {p.oferta}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {interests.length > 0 && (
          <section className="section">
            <h3>Interesses pelos posts</h3>
            <div className="grid2">
              {interests.slice(0, 4).map((it: any, i: number) => (
                <div className="mini" key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <h4 style={{ color: "#071b44", fontSize: 12, fontWeight: 950 }}>{it.nome}</h4>
                    <span className="pill" style={{ color: "#fff", background: "#071b44" }}>{it.score ?? 0}/100</span>
                  </div>
                  <p className="small" style={{ marginTop: 4 }}>{it.sinal}</p>
                  <p style={{ fontSize: 9.3, color: "#61708a", fontWeight: 650, marginTop: 4 }}><strong>LinkedIn:</strong> {it.conteudoLinkedIn}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {timeline.length > 0 && (
          <section className="section">
            <h3>Cronograma multicanal</h3>
            <div className="grid2">
              {timeline.map((week: any, i: number) => (
                <div className="mini" key={i}>
                  <span className="pill" style={{ color: "#fff", background: "#071b44" }}>{week.semana}</span>
                  <h4 style={{ color: "#071b44", fontSize: 12, fontWeight: 950, marginTop: 6 }}>{week.tema}</h4>
                  {(week.canais ?? []).map((c: any, j: number) => <p key={j} className="bullet"><strong>{c.canal}:</strong> {c.acao}</p>)}
                  <p style={{ color: "#18a34a", fontSize: 9.5, fontWeight: 850, marginTop: 5 }}>{week.meta}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {hotHits.length > 0 && (
          <section className="section">
            <h3>Radar de Mercado no diagnostico</h3>
            {rd?.marketSummary && <p className="text" style={{ marginBottom: 8 }}>{rd.marketSummary}</p>}
            <div className="grid2">
              {hotHits.map((h: any, i: number) => {
                const decision = liked.has(hitKey(h)) ? "gostei" : disliked.has(hitKey(h)) ? "nao gostei" : "sem feedback";
                return (
                  <div className="mini post" key={i}>
                    {h.img && <img src={h.img} alt="" />}
                    <p style={{ fontSize: 9.5, color: "#071b44", fontWeight: 900, marginTop: 5 }}>@{h.ownerUsername}</p>
                    <p style={{ fontSize: 9, color: "#61708a", fontWeight: 750 }}>{h.hotScore ?? "-"} hot - {decision}</p>
                    <p style={{ fontSize: 9, color: "#22304b", fontWeight: 650, marginTop: 4 }}>{h.why || h.caption}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {acompanhamento && (
          <section className="section">
            <h3>Acompanhamento</h3>
            <div className="grid2">
              <div style={{ background: "#071b44", color: "#fff", borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 9.5, color: "rgba(255,255,255,.7)", fontWeight: 900, textTransform: "uppercase" }}>{acompanhamento.ciclo}</p>
                <p style={{ fontSize: 28, color: "#fff", fontWeight: 950 }}>{acompanhamento.progresso ?? 0}%</p>
                <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.86)", fontWeight: 800 }}>Proximo foco: {acompanhamento.proximoFoco}</p>
                <p style={{ fontSize: 9.5, color: "rgba(255,255,255,.72)", fontWeight: 650, marginTop: 6 }}>{acompanhamento.novaPrescricao}</p>
              </div>
              <div>
                {(acompanhamento.snapshots ?? []).slice(0, 2).map((s: any, i: number) => (
                  <div className="mini" key={i} style={{ marginBottom: 6 }}>
                    <p style={{ color: "#071b44", fontSize: 10.5, fontWeight: 900 }}>{s.label}</p>
                    <p className="small">{s.resumo}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini" style={{ textAlign: "center", padding: 8 }}>
      <p style={{ fontSize: 8.5, color: "#61708a", fontWeight: 900, textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontSize: 14, color: "#071b44", fontWeight: 950 }}>{value}</p>
    </div>
  );
}

function Info({ title, text, note }: { title: string; text?: string; note?: string }) {
  return (
    <div className="mini">
      <p style={{ fontSize: 10.5, color: "#071b44", fontWeight: 900 }}>{title}</p>
      {text && <p style={{ fontSize: 9.5, color: "#22304b", fontWeight: 800, marginTop: 2 }}>{text}</p>}
      {note && <p className="small" style={{ marginTop: 2 }}>{note}</p>}
    </div>
  );
}
