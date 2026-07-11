import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Copy,
  MonitorPlay,
  Pencil,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type VideoDuration = 15 | 30 | 45;
type VideoMode = "comfy" | "magnific" | "capcut";

type ScenePlan = {
  label: string;
  seconds: string;
  objective: string;
  visual: string;
  camera: string;
  screenText: string;
  narration: string;
  prompt: string;
};

type VideoPackage = {
  title: string;
  hook: string;
  promise: string;
  narration: string;
  cta: string;
  scenes: ScenePlan[];
  negativePrompt: string;
  checklist: string[];
};

const durations: VideoDuration[] = [15, 30, 45];
const modes: Array<{ id: VideoMode; label: string; description: string }> = [
  {
    id: "comfy",
    label: "ComfyUI",
    description: "Cenas numeradas, prompts e direcao visual para workflow.",
  },
  {
    id: "magnific",
    label: "Magnific",
    description: "Prompts de acabamento visual, referencia e consistencia.",
  },
  {
    id: "capcut",
    label: "CapCut",
    description: "Roteiro, texto na tela, cortes e ordem de edicao.",
  },
];

const toneOptions = [
  "humano e direto",
  "bastidor real",
  "prova antes/depois",
  "educativo com tensao",
  "oferta discreta",
];

export default function VideosTikTok() {
  const diagnosis = trpc.diagnosis.get.useQuery();
  const plan: any = diagnosis.data;
  const items = useMemo(
    () =>
      (((plan as any)?.plano7Dias ?? []) as any[]).map((item, index) => ({
        ...item,
        index,
        status: item.status || "ideia",
      })),
    [plan]
  );
  const initialIndex = getInitialIndex();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [duration, setDuration] = useState<VideoDuration>(30);
  const [mode, setMode] = useState<VideoMode>("comfy");
  const [tone, setTone] = useState(toneOptions[0]);
  const selected =
    items[Math.max(0, Math.min(selectedIndex, items.length - 1))] ?? items[0];
  const videoPackage = selected
    ? buildVideoPackage(plan, selected, duration, tone)
    : null;
  const packageText = videoPackage
    ? buildPackageText(mode, plan, selected, videoPackage, duration, tone)
    : "";

  async function copy(text: string, label = "Copiado.") {
    await navigator.clipboard?.writeText(text);
    toast.success(label);
  }

  if (diagnosis.isLoading) {
    return (
      <AppLayout
        title="Videos TikTok"
        subtitle="Carregando plano semanal."
        journeyActive="estudio"
      >
        <div className="rounded-2xl border border-[#e6ebf3] bg-white p-10 text-center text-sm font-black text-[#61708a]">
          Carregando...
        </div>
      </AppLayout>
    );
  }

  if (!items.length || !videoPackage) {
    return (
      <AppLayout
        title="Videos TikTok"
        subtitle="Transforme posts do plano semanal em roteiro, cenas e prompts para video vertical."
        journeyActive="estudio"
      >
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-10 text-center shadow-sm">
          <Clapperboard className="w-12 h-12 text-[#c7d1e0] mx-auto mb-3" />
          <p className="text-base font-black text-[#071b44]">
            Nenhum plano semanal ativo
          </p>
          <p className="text-sm text-[#61708a] mt-1">
            Crie ou restaure um diagnostico para gerar videos a partir dos posts
            recomendados na jornada.
          </p>
          <Link href="/diagnostico">
            <a className="btn-action-primary mt-5 px-5 py-3 text-sm inline-flex items-center gap-2">
              Abrir diagnostico <ArrowRight className="w-4 h-4" />
            </a>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Videos TikTok"
      subtitle="Ferramenta do Estudio para preparar roteiro, storyboard e pacote visual antes da Publicacao."
      journeyActive="estudio"
      actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => copy(packageText, "Pacote de video copiado.")}
            className="rounded-xl bg-[#071b44] px-4 py-2.5 text-sm font-black text-white hover:bg-[#0d2a5e] inline-flex items-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copiar pacote
          </button>
          <Link href="/criativos">
            <a className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
              <Pencil className="w-4 h-4" /> Estudio
            </a>
          </Link>
          <Link href="/integracoes">
            <a className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2.5 text-sm font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2">
              <Send className="w-4 h-4" /> Publicacao
            </a>
          </Link>
        </div>
      }
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_.95fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
            <Clapperboard className="w-4 h-4" /> Assistente de video TikTok
          </p>
          <h2 className="text-3xl font-black mt-3">
            Transforme um post em video vertical
          </h2>
          <p className="text-sm text-white/75 leading-relaxed mt-3 max-w-3xl">
            Os Agentes montam o roteiro e o pacote tecnico. Voce ajusta o toque
            humano e leva para ComfyUI, Magnific, CapCut ou gravacao propria.
            Depois volte para Publicacao para registrar link e resultado.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <MiniMetric label="Formato" value="9:16" />
            <MiniMetric label="Duracao" value={`${duration}s`} />
            <MiniMetric
              label="Cenas"
              value={String(videoPackage.scenes.length)}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
              Post base
            </label>
            <select
              value={selected.index}
              onChange={e => setSelectedIndex(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-[#e6ebf3] bg-white px-3 py-3 text-sm font-black text-[#071b44] outline-none focus:border-[#ff3217]"
            >
              {items.map(item => (
                <option key={item.index} value={item.index}>
                  {item.dia} - {item.canal} - {compact(item.gancho, 64)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-black text-[#61708a] uppercase">
              Duracao
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {durations.map(value => (
                <button
                  key={value}
                  onClick={() => setDuration(value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    duration === value
                      ? "bg-[#071b44] text-white border-[#071b44]"
                      : "bg-white text-[#071b44] border-[#e6ebf3] hover:bg-[#f8fafc]"
                  }`}
                >
                  {value}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-black text-[#61708a] uppercase">
              Toque humano
            </p>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#e6ebf3] bg-white px-3 py-3 text-sm font-bold text-[#071b44] outline-none focus:border-[#ff3217]"
            >
              {toneOptions.map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[.9fr_1.1fr] gap-5 mb-6">
        <div className="rounded-3xl border border-[#ffd0c8] bg-[#fff8f6] p-6 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase">
            Roteiro principal
          </p>
          <h2 className="text-2xl font-black text-[#071b44] mt-2">
            {videoPackage.title}
          </h2>
          <div className="space-y-4 mt-5">
            <ScriptBlock label="Gancho 0-3s" text={videoPackage.hook} />
            <ScriptBlock label="Promessa" text={videoPackage.promise} />
            <ScriptBlock label="Narração" text={videoPackage.narration} />
            <ScriptBlock label="CTA" text={videoPackage.cta} />
          </div>
        </div>

        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <p className="text-xs font-black text-[#61708a] uppercase">
            Destino do pacote
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {modes.map(item => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === item.id
                    ? "border-[#ff3217] bg-[#fff8f6]"
                    : "border-[#e6ebf3] bg-white hover:bg-[#fbfcff]"
                }`}
              >
                <span className="text-sm font-black text-[#071b44]">
                  {item.label}
                </span>
                <span className="block text-xs font-semibold text-[#61708a] leading-relaxed mt-1">
                  {item.description}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-[#071b44] text-white p-5 mt-5">
            <p className="text-xs font-black text-white/60 uppercase flex items-center gap-2">
              <MonitorPlay className="w-4 h-4" /> Pacote pronto
            </p>
            <p className="text-sm text-white/80 leading-relaxed mt-2">
              Copie este pacote para a ferramenta escolhida. Ele ja inclui
              proporcao 9:16, cenas, prompt negativo, textos na tela e direcao
              de edicao.
            </p>
            <button
              onClick={() =>
                copy(packageText, `Pacote ${modeLabel(mode)} copiado.`)
              }
              className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#071b44] hover:bg-[#f8fafc] inline-flex items-center gap-2 mt-4"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar {modeLabel(mode)}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {videoPackage.scenes.map((scene, index) => (
          <article
            key={`${scene.label}-${index}`}
            className="rounded-2xl border border-[#e6ebf3] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-[#ff3217] uppercase">
                  Cena {index + 1} - {scene.seconds}
                </p>
                <h3 className="text-base font-black text-[#071b44] mt-1">
                  {scene.label}
                </h3>
              </div>
              <button
                onClick={() => copy(scene.prompt, "Prompt da cena copiado.")}
                className="rounded-lg border border-[#e6ebf3] p-2 text-[#071b44] hover:bg-[#f8fafc]"
                aria-label="Copiar prompt da cena"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mt-4">
              <SceneLine label="Objetivo" text={scene.objective} />
              <SceneLine label="Visual" text={scene.visual} />
              <SceneLine label="Camera" text={scene.camera} />
              <SceneLine label="Texto na tela" text={scene.screenText} />
              <SceneLine label="Fala" text={scene.narration} />
              <SceneLine label="Prompt visual" text={scene.prompt} />
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_.85fr] gap-5">
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <p className="text-xs font-black text-[#ff3217] uppercase">
            Prompt negativo
          </p>
          <p className="text-sm font-semibold text-[#22304b] leading-relaxed mt-2">
            {videoPackage.negativePrompt}
          </p>
        </div>
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <p className="text-xs font-black text-[#61708a] uppercase">
            Checklist antes de publicar
          </p>
          <div className="space-y-2 mt-3">
            {videoPackage.checklist.map(item => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#18b85c] mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-[#22304b]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-[10px] font-black text-white/60 uppercase">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function ScriptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white border border-[#ffd0c8] p-4">
      <p className="text-[10px] font-black text-[#ff3217] uppercase">{label}</p>
      <p className="text-sm font-bold text-[#071b44] leading-relaxed mt-1">
        {text}
      </p>
    </div>
  );
}

function SceneLine({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-[#61708a] uppercase">{label}</p>
      <p className="text-xs font-semibold text-[#22304b] leading-relaxed mt-1">
        {text}
      </p>
    </div>
  );
}

function getInitialIndex() {
  if (typeof window === "undefined") return 0;
  const value = Number(
    new URLSearchParams(window.location.search).get("index")
  );
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function buildVideoPackage(
  plan: any,
  item: any,
  duration: VideoDuration,
  tone: string
): VideoPackage {
  const brand = compact(
    plan?.produto || plan?.perfil || plan?.instagram || plan?.nicho || "marca",
    90
  );
  const audience = compact(
    plan?.publico || plan?.persona || plan?.nicho || "pessoas certas",
    110
  );
  const hook = compact(
    item.gancho ||
      `O que quase ninguem percebe sobre ${brand} antes de tentar vender.`,
    150
  );
  const core = compact(
    item.legenda ||
      item.copy ||
      "Mostre o problema, prove com um bastidor real e feche com um convite simples.",
    340
  );
  const cta = compact(
    item.cta || "Comente ou chame no direct para dar o proximo passo.",
    140
  );
  const sceneCount = duration === 15 ? 3 : duration === 30 ? 5 : 6;
  const seconds = makeTimeline(duration, sceneCount);
  const labels = [
    "Gancho visual",
    "Problema real",
    "Bastidor ou prova",
    "Virada de criterio",
    "Convite",
    "Fechamento memoravel",
  ].slice(0, sceneCount);

  const scenes = labels.map((label, index) => {
    const objective = sceneObjective(index, sceneCount, brand, hook);
    const visual = sceneVisual(index, brand, audience, tone, core);
    const screenText = sceneText(index, hook, cta, brand);
    const narration = sceneNarration(index, hook, core, cta);
    const camera = sceneCamera(index);
    const prompt = [
      "vertical 9:16 TikTok frame",
      `brand context: ${brand}`,
      `tone: ${tone}`,
      visual,
      camera,
      "Brazilian market, natural light, expressive but credible, refined social video aesthetic",
      "leave clean negative space for short Portuguese on-screen text",
      "no watermark, no unreadable typography",
    ].join(", ");
    return {
      label,
      seconds: seconds[index],
      objective,
      visual,
      camera,
      screenText,
      narration,
      prompt,
    };
  });

  return {
    title: `${item.dia || "Post"} em video TikTok - ${compact(item.canal || "vertical", 32)}`,
    hook,
    promise: `Em ${duration}s, mostrar por que isso importa para ${audience} e conduzir para uma acao simples.`,
    narration: buildNarration(scenes),
    cta,
    scenes,
    negativePrompt:
      "low quality, blurry, distorted face, extra fingers, deformed hands, unreadable text, watermark, stock photo look, generic ad, plastic skin, overprocessed image, cropped head, broken anatomy, random logos",
    checklist: [
      "Os 3 primeiros segundos deixam claro o problema ou desejo.",
      "Cada cena tem um texto curto na tela.",
      "O visual parece real para a marca, nao generico.",
      "A fala combina com o tom humano do negocio.",
      "O CTA aparece no final sem parecer empurrado.",
      "Exportar em 1080x1920, 24 ou 30 fps.",
    ],
  };
}

function buildPackageText(
  mode: VideoMode,
  plan: any,
  item: any,
  video: VideoPackage,
  duration: VideoDuration,
  tone: string
) {
  const lines = [
    `PACOTE ${modeLabel(mode).toUpperCase()} - CACAREJAR`,
    "",
    `Marca/perfil: ${plan?.produto || plan?.perfil || plan?.instagram || plan?.nicho || "-"}`,
    `Post base: ${item.dia || "-"} - ${item.canal || "-"} - ${item.formato || "video vertical"}`,
    `Duracao: ${duration}s`,
    `Proporcao: 9:16`,
    `Toque humano: ${tone}`,
    "",
    `GANCHO: ${video.hook}`,
    `PROMESSA: ${video.promise}`,
    `CTA: ${video.cta}`,
    "",
    "ROTEIRO DE FALA:",
    video.narration,
    "",
    "CENAS:",
    ...video.scenes.flatMap((scene, index) => [
      "",
      `Cena ${index + 1} (${scene.seconds}) - ${scene.label}`,
      `Objetivo: ${scene.objective}`,
      `Visual: ${scene.visual}`,
      `Camera: ${scene.camera}`,
      `Texto na tela: ${scene.screenText}`,
      `Fala: ${scene.narration}`,
      `Prompt visual: ${scene.prompt}`,
    ]),
    "",
    `PROMPT NEGATIVO: ${video.negativePrompt}`,
    "",
    modeInstructions(mode),
  ];
  return lines.join("\n");
}

function modeInstructions(mode: VideoMode) {
  if (mode === "comfy") {
    return [
      "COMFYUI:",
      "1. Gerar uma imagem 9:16 por cena.",
      "2. Preservar personagem, paleta e ambiente entre cenas usando referencias.",
      "3. Animar cada cena com movimento leve de camera.",
      "4. Exportar trechos e montar na ordem do roteiro.",
      "5. Aplicar texto na tela fora do gerador, se o texto sair ilegivel.",
    ].join("\n");
  }
  if (mode === "magnific") {
    return [
      "MAGNIFIC:",
      "1. Usar as imagens base/ref como referencia.",
      "2. Aplicar o prompt de cada cena para refinamento.",
      "3. Preservar rosto, produto, roupa, cor e estilo.",
      "4. Evitar excesso de pele plastica ou aparencia generica.",
      "5. Exportar frames refinados para animacao ou CapCut.",
    ].join("\n");
  }
  return [
    "CAPCUT:",
    "1. Criar projeto 9:16.",
    "2. Inserir cenas na ordem, com cortes rapidos.",
    "3. Aplicar textos curtos exatamente como indicado.",
    "4. Gravar narracao ou usar legenda falada.",
    "5. Finalizar com CTA e registrar resultado no Cacarejar.",
  ].join("\n");
}

function modeLabel(mode: VideoMode) {
  return modes.find(item => item.id === mode)?.label ?? "pacote";
}

function makeTimeline(duration: VideoDuration, count: number) {
  const chunk = duration / count;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.round(index * chunk);
    const end = Math.round((index + 1) * chunk);
    return `${start}-${end}s`;
  });
}

function sceneObjective(
  index: number,
  total: number,
  brand: string,
  hook: string
) {
  if (index === 0) return `Parar o scroll com: ${hook}`;
  if (index === total - 1)
    return `Convidar para o proximo passo sem quebrar a confianca.`;
  if (index === 1) return `Mostrar o problema real que ${brand} resolve.`;
  if (index === 2) return "Trazer bastidor, prova ou exemplo concreto.";
  return "Amarrar o criterio e preparar a decisao.";
}

function sceneVisual(
  index: number,
  brand: string,
  audience: string,
  tone: string,
  core: string
) {
  const base = compact(core, 150);
  const visuals = [
    `close-up emocional de alguem percebendo o problema que ${brand} resolve`,
    `situacao cotidiana de ${audience}, com detalhe real e nada posado`,
    `bastidor visual da solucao, tela, produto, atendimento ou processo acontecendo`,
    `comparacao antes/depois com composicao limpa e clara`,
    `momento de decisao, pessoa olhando para a solucao com alivio discreto`,
    `frame final com espaco para CTA e identidade visual da marca`,
  ];
  return `${visuals[index] ?? visuals[visuals.length - 1]}; referencia de conteudo: ${base}; estilo ${tone}`;
}

function sceneText(index: number, hook: string, cta: string, brand: string) {
  const texts = [
    compact(hook, 58),
    "O problema nao e falta de vontade.",
    "Olha o que muda no bastidor.",
    "Quando o caminho muda, o resultado muda.",
    compact(cta, 58),
    `${brand}: proximo passo simples.`,
  ];
  return texts[index] ?? compact(cta, 58);
}

function sceneNarration(
  index: number,
  hook: string,
  core: string,
  cta: string
) {
  const lines = [
    hook,
    compact(core, 180),
    "Mostre um detalhe real aqui. Algo que so essa marca teria.",
    "A virada e simples: menos promessa generica, mais criterio e contexto.",
    cta,
    "Feche com uma frase curta e facil de lembrar.",
  ];
  return lines[index] ?? cta;
}

function sceneCamera(index: number) {
  const cameras = [
    "push-in suave, enquadramento vertical, rosto ou detalhe ocupando o terco central",
    "camera de mao leve, corte rapido, sensacao de bastidor real",
    "travelling curto ou pan lento mostrando o processo",
    "split visual ou corte seco de antes/depois",
    "plano medio com espaco para texto no topo",
    "frame limpo, foco no CTA, movimento minimo",
  ];
  return cameras[index] ?? cameras[cameras.length - 1];
}

function buildNarration(scenes: ScenePlan[]) {
  return scenes.map(scene => scene.narration).join(" ");
}

function compact(value: any, max = 120) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}
