/**
 * AnalysisProgress — animação de progresso para operações longas (diagnóstico, radar).
 * Simula etapas com tempos realistas baseados no que o backend faz, para reduzir a
 * angústia da espera. Quando `done=true`, salta para 100% e some.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";

export interface AnalysisStep {
  label: string;       // "Lendo seu perfil no Instagram"
  detail?: string;     // explicação curta
  durationMs: number;  // tempo estimado dessa etapa
  icon?: string;       // emoji
}

interface Props {
  steps: AnalysisStep[];
  active: boolean;     // true enquanto a request está pendente
  title?: string;
  subtitle?: string;
  accent?: string;     // cor primária do gradiente
}

export function AnalysisProgress({ steps, active, title = "Estudando seu negócio…", subtitle = "Nosso Agente Estrategista está trabalhando.", accent = "#ff3217" }: Props) {
  const [percent, setPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const totalMs = steps.reduce((s, x) => s + x.durationMs, 0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      // finaliza suavemente: salta para 100%
      if (percent < 100) {
        let p = percent;
        const id = window.setInterval(() => {
          p = Math.min(100, p + 8);
          setPercent(p);
          setCurrentStep(steps.length);
          if (p >= 100) window.clearInterval(id);
        }, 40);
        return () => window.clearInterval(id);
      }
      return;
    }
    // reset ao iniciar
    setPercent(0); setCurrentStep(0); startRef.current = performance.now();
    const tick = () => {
      if (startRef.current == null) return;
      const elapsed = performance.now() - startRef.current;
      // limite a 95% (os últimos 5% só quando done=true) — evita "barra parada em 100%"
      const cap = 95;
      const ratio = Math.min(1, elapsed / totalMs);
      const p = Math.min(cap, Math.round(ratio * cap));
      setPercent(p);
      // etapa atual: soma cumulativa
      let acc = 0, idx = 0;
      for (let i = 0; i < steps.length; i++) {
        acc += steps[i].durationMs;
        if (elapsed < acc) { idx = i; break; }
        idx = i + 1;
      }
      setCurrentStep(Math.min(idx, steps.length - 1));
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const currentLabel = steps[currentStep]?.label ?? steps[steps.length - 1]?.label ?? "Finalizando…";
  const currentDetail = steps[currentStep]?.detail;

  return (
    <div className="bg-white rounded-2xl border border-[#e6ebf3] shadow-lg overflow-hidden">
      {/* Header com gradiente */}
      <div className="relative p-6 text-white" style={{ background: `linear-gradient(135deg,#071b44,#0d2a5e)` }}>
        <div className="absolute inset-0 opacity-20">
          <SparkleField />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0 relative">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
            <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black">{title}</h3>
            <p className="text-xs text-white/70">{subtitle}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>{percent}%</div>
            <div className="text-[10px] text-white/60 uppercase tracking-wider font-bold">progresso</div>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-4 h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out relative"
            style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${accent}, #ff8a72)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer" />
          </div>
        </div>

        {/* Etapa atual em destaque */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="font-bold">{steps[currentStep]?.icon ?? "✨"}</span>
          <span className="font-semibold">{currentLabel}</span>
        </div>
        {currentDetail && <p className="text-[11px] text-white/60 mt-0.5 ml-5">{currentDetail}</p>}
      </div>

      {/* Lista de etapas */}
      <div className="p-5">
        <p className="text-[10px] font-black text-[#61708a] uppercase tracking-widest mb-3">Etapas</p>
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <li key={i} className={`flex items-start gap-3 transition-opacity ${i > currentStep ? "opacity-40" : ""}`}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                  style={{
                    background: done ? "#18b85c" : active ? "#fff1ef" : "#f1f4f9",
                    border: active ? `1.5px solid ${accent}` : "none",
                  }}>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : active ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: accent }} />
                  ) : (
                    <span className="text-[10px] font-black text-[#9aa7bd]">{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className={`text-xs font-bold ${done ? "text-[#22304b]" : active ? "text-[#070b17]" : "text-[#61708a]"}`}>
                    {s.icon ?? ""} {s.label}
                  </p>
                  {s.detail && active && <p className="text-[10px] text-[#61708a] mt-0.5">{s.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-[11px] text-[#61708a] mt-5 text-center">
          Pode levar 2-3 minutos. Aguarde por aqui — vamos te avisar quando terminar.
        </p>
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .shimmer { animation: shimmer 2s linear infinite; }
      `}</style>
    </div>
  );
}

function SparkleField() {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 100,
    delay: (i * 0.3) % 3,
    size: 2 + (i % 3),
  }));
  return (
    <>
      {dots.map((d, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, animation: `pulse 2s ${d.delay}s infinite ease-in-out` }} />
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }`}</style>
    </>
  );
}

// Etapas pré-configuradas — Diagnóstico com Instagram
export const DIAGNOSIS_STEPS_IG: AnalysisStep[] = [
  { icon: "🔍", label: "Lendo seu perfil no Instagram", detail: "Buscamos bio, seguidores, posts e engajamento via Apify.", durationMs: 35000 },
  { icon: "🖼️", label: "Baixando seus posts campeões", detail: "Trazemos as imagens para o nosso servidor (a CDN do IG bloqueia).", durationMs: 7000 },
  { icon: "🎨", label: "Analisando o DNA visual da marca", detail: "Claude Sonnet 4.6 vê suas fotos e extrai paleta, tipografia e estilo.", durationMs: 25000 },
  { icon: "🧠", label: "Identificando seu nicho e padrões", detail: "Cruza o que você descreveu com o que vemos no perfil.", durationMs: 5000 },
  { icon: "🪜", label: "Construindo a estratégia de funil", detail: "Canal, oferta e ângulos do Teste A/Z.", durationMs: 35000 },
  { icon: "🏛️", label: "Detalhando pilares estratégicos", detail: "Cada pilar com ações concretas (consultoria nível agência).", durationMs: 12000 },
  { icon: "✨", label: "Criando ideias de post com gancho e roteiro", detail: "Briefings de direção de arte com a paleta da sua marca.", durationMs: 25000 },
  { icon: "✅", label: "Validando características visuais", detail: "Garantia de que as sugestões batem com a taxonomia.", durationMs: 6000 },
];

// Etapas para quando só há SITE (sem Instagram)
export const DIAGNOSIS_STEPS_SITE: AnalysisStep[] = [
  { icon: "🌐", label: "Lendo seu site oficial", detail: "Buscamos título, descrição, imagem de capa e o texto principal.", durationMs: 10000 },
  { icon: "🎨", label: "Analisando a identidade visual da marca", detail: "Claude Sonnet 4.6 olha sua landing e extrai paleta, tom e estilo.", durationMs: 20000 },
  { icon: "🧠", label: "Identificando seu nicho e proposta", detail: "Cruzamos o que você descreveu com o que vemos no site.", durationMs: 5000 },
  { icon: "🪜", label: "Construindo a estratégia de funil", detail: "Canal, oferta e ângulos do Teste A/Z.", durationMs: 35000 },
  { icon: "🏛️", label: "Detalhando pilares estratégicos", detail: "Cada pilar com ações concretas (nível agência).", durationMs: 12000 },
  { icon: "✨", label: "Criando ideias de post com gancho e roteiro", detail: "Briefings de direção de arte na sua paleta.", durationMs: 25000 },
  { icon: "✅", label: "Validando características visuais", detail: "Garantia de que as sugestões batem com a taxonomia.", durationMs: 6000 },
];

export const DIAGNOSIS_STEPS_LINKEDIN: AnalysisStep[] = [
  { icon: "in", label: "Lendo o contexto do LinkedIn", detail: "Usamos o perfil informado como sinal estrategico; a leitura profunda de posts/conexoes exige provider/API.", durationMs: 8000 },
  { icon: "B2B", label: "Mapeando linguagem B2B", detail: "O Agente procura areas afins, dores de decisao e hipoteses de segmentacao.", durationMs: 12000 },
  { icon: "360", label: "Gerando interesses da Visao 360", detail: "Cruza o LinkedIn informado com produto, nicho e sinais de posts disponiveis.", durationMs: 12000 },
  { icon: "funil", label: "Construindo a estrategia de funil", detail: "Canal, oferta e angulos do Teste A/Z.", durationMs: 30000 },
  { icon: "post", label: "Criando ideias de post com gancho e roteiro", detail: "Briefings de direcao de arte alinhados a marca.", durationMs: 22000 },
  { icon: "ok", label: "Validando caracteristicas visuais", durationMs: 6000 },
];

// Etapas para TikTok
export const DIAGNOSIS_STEPS_TT: AnalysisStep[] = [
  { icon: "🎵", label: "Lendo seu perfil no TikTok", detail: "Buscamos bio, seguidores, vídeos e engajamento via Apify.", durationMs: 30000 },
  { icon: "🖼️", label: "Baixando thumbnails dos seus vídeos campeões", detail: "Trazemos as capas para o nosso servidor.", durationMs: 7000 },
  { icon: "🎨", label: "Analisando a identidade visual dos vídeos", detail: "Claude Sonnet 4.6 vê suas capas e extrai estilo, paleta e padrão.", durationMs: 25000 },
  { icon: "🧠", label: "Identificando seu nicho e padrões de conteúdo", detail: "Cruza o que você descreveu com o que vemos nos vídeos.", durationMs: 5000 },
  { icon: "🪜", label: "Construindo a estratégia de funil", detail: "Canal, oferta e ângulos do Teste A/Z.", durationMs: 35000 },
  { icon: "🏛️", label: "Detalhando pilares estratégicos", detail: "Cada pilar com ações concretas (consultoria nível agência).", durationMs: 12000 },
  { icon: "✨", label: "Criando ideias de vídeo com gancho e roteiro", detail: "Briefings de direção para TikTok e Reels com sua estética.", durationMs: 25000 },
  { icon: "✅", label: "Validando características visuais", detail: "Garantia de que as sugestões batem com a taxonomia.", durationMs: 6000 },
];

// Etapas para quando não há nem Instagram nem site
export const DIAGNOSIS_STEPS_GENERIC: AnalysisStep[] = [
  { icon: "🧠", label: "Analisando o que você descreveu", detail: "Entendendo seu produto e objetivo.", durationMs: 8000 },
  { icon: "🎨", label: "Definindo identidade visual base", detail: "Paleta e estilo coerentes com seu nicho.", durationMs: 8000 },
  { icon: "🪜", label: "Construindo a estratégia de funil", detail: "Canal, oferta e ângulos do Teste A/Z.", durationMs: 35000 },
  { icon: "🏛️", label: "Detalhando pilares estratégicos", detail: "Cada pilar com ações concretas.", durationMs: 12000 },
  { icon: "✨", label: "Criando ideias de post com gancho e roteiro", detail: "Briefings de direção de arte.", durationMs: 25000 },
  { icon: "✅", label: "Validando características visuais", durationMs: 6000 },
];

/** Escolhe a sequência de etapas com base no que o cliente informou. */
export function pickDiagnosisSteps(input: { instagram?: string; tiktok?: string; site?: string }): AnalysisStep[] {
  if (input.instagram?.trim()) return DIAGNOSIS_STEPS_IG;
  if (input.tiktok?.trim()) return DIAGNOSIS_STEPS_TT;
  if (input.site?.trim()) return DIAGNOSIS_STEPS_SITE;
  return DIAGNOSIS_STEPS_GENERIC;
}

// Alias para compatibilidade
export const DIAGNOSIS_STEPS = DIAGNOSIS_STEPS_IG;

export const RADAR_STEPS: AnalysisStep[] = [
  { icon: "🧠", label: "Sugerindo perfis e hashtags do seu nicho", detail: "Claude lista os concorrentes e influencers relevantes.", durationMs: 12000 },
  { icon: "🔍", label: "Descobrindo perfis pelas hashtags", detail: "Buscamos posts ativos e seus autores.", durationMs: 25000 },
  { icon: "📥", label: "Lendo os perfis encontrados em lote", detail: "Raspagem em uma chamada (mais barata e estável).", durationMs: 30000 },
  { icon: "🏆", label: "Rankeando os hits por engajamento", detail: "Selecionamos os posts campeões com imagem.", durationMs: 6000 },
  { icon: "🖼️", label: "Baixando as imagens dos hits", detail: "Servindo do nosso domínio (CDN do IG bloqueia hotlink).", durationMs: 10000 },
  { icon: "🎯", label: "Adaptando os conceitos para a sua identidade", detail: "Claude vê cada post e cria a versão na sua paleta.", durationMs: 45000 },
];
