import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { JourneyGuide } from "@/components/JourneyGuide";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Coins,
  ArrowRight,
  Wand2,
  Upload,
  X,
  Copy,
} from "lucide-react";

// Fatores em destaque no estúdio (single-select cada)
const KEY_FACTORS = [
  "img_tipo",
  "img_cor_predominante",
  "img_pessoa_idade",
  "copy_tom",
  "copy_formato",
  "of_angulo",
];

const RATIOS = [
  { v: "1:1", label: "⬛ 1:1 Feed" },
  { v: "9:16", label: "📲 9:16 Story" },
  { v: "16:9", label: "🖥️ 16:9" },
] as const;

export default function Estudio() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const factors = trpc.studio.factors.useQuery();
  const recent = trpc.studio.recent.useQuery();
  const wallet = trpc.credits.wallet.useQuery();

  const sendApproval = trpc.approvals.sendToApproval.useMutation({
    onSuccess: () => {
      toast.success("Enviado para aprovação! 🐓");
      navigate("/aprovacao");
    },
    onError: e => toast.error(e.message || "Erro ao enviar"),
  });

  const plan = trpc.diagnosis.get.useQuery();

  const [produto, setProduto] = useState("");
  const [ratio, setRatio] = useState<"1:1" | "9:16" | "16:9">("1:1");
  const [az, setAz] = useState(true);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [results, setResults] = useState<any[]>([]);
  const [prefilled, setPrefilled] = useState(false);
  const [refUrl, setRefUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const uploadRef = trpc.studio.uploadReference.useMutation();

  const handleRefFile = (file?: File) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 6MB)");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await uploadRef.mutateAsync({
          dataUrl: String(reader.result),
        });
        setRefUrl(r.url);
        toast.success("Post de referência carregado — vamos clonar e variar!");
      } catch {
        toast.error("Erro ao enviar imagem");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Pré-preenche com a sugestão da Cacá (diagnóstico)
  // Recebe um post vindo do Diagnóstico ("Usar como base") para clonar
  useEffect(() => {
    const ref = sessionStorage.getItem("clone_ref");
    if (ref) {
      setRefUrl(ref);
      sessionStorage.removeItem("clone_ref");
    }
  }, []);

  useEffect(() => {
    if (!prefilled && plan.data) {
      if (plan.data.produto && !produto) setProduto(plan.data.produto);
      if (plan.data.suggestedFactors) setSel(plan.data.suggestedFactors);
      setPrefilled(true);
    }
  }, [plan.data, prefilled, produto]);

  // "Decida por mim": gera já com a sugestão do plano, sem configurar
  const decideForMe = () => {
    const p = plan.data;
    const prod = (p?.produto || produto).trim();
    if (prod.length < 2) {
      navigate("/diagnostico");
      return;
    }
    if (!produto) setProduto(prod);
    if (p?.suggestedFactors) setSel(p.suggestedFactors);
    gen.mutate({
      produto: prod,
      ratio,
      baseFactors: cleanSel(p?.suggestedFactors ?? sel),
      qty: 6,
      az: true,
      refImageUrl: refUrl || undefined,
    });
  };

  const gen = trpc.studio.generate.useMutation({
    onSuccess: d => {
      setResults(d.creatives ?? []);
      utils.credits.wallet.invalidate();
      utils.studio.recent.invalidate();
      if (d.stopped === "saldo_insuficiente")
        toast.error("Saldo de créditos insuficiente. Compre mais em Créditos.");
      else if (d.stopped === "cota_diaria")
        toast.error("Cota diária atingida. Tente amanhã ou use pacote avulso.");
      else toast.success(`${d.generated} variações geradas! 🥚`);
    },
    onError: e => toast.error(e.message || "Erro ao gerar"),
  });

  const keyFactorDefs = (factors.data ?? []).filter((f: any) =>
    KEY_FACTORS.includes(f.key)
  );
  const pick = (fk: string, vk: string) =>
    setSel(s => ({ ...s, [fk]: s[fk] === vk ? "" : vk }));

  const estimate = (az ? 6 : 1) * 15;

  return (
    <AppLayout
      title="Criar novos criativos"
      subtitle="Descreva seu produto, escolha o jeitão e gere os posts"
      actions={
        <>
          <button
            onClick={() => navigate("/criativos")}
            className="text-xs font-bold text-[#61708a] hover:text-[#070b17] flex items-center gap-1.5 px-3 py-2"
          >
            ← Voltar para Criativos
          </button>
          <span className="text-xs font-bold text-[#071b44] bg-[#f6f8fc] border border-[#e6ebf3] rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-[#ff3217]" />{" "}
            {wallet.data?.balanceCC ?? 0} CC
          </span>
        </>
      }
    >
      {/* Decida por mim / Diagnóstico */}
      <JourneyGuide active="estudio" />

      {plan.data ? (
        <div
          className="rounded-xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3"
          style={{ background: "linear-gradient(135deg,#071b44,#0d2a5e)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-sm font-black text-white">
                Deixe o Estrategista decidir por você
              </p>
              <p className="text-xs text-white/60">
                Geramos 6 variações com as características que o seu plano
                sugere — você não precisa configurar nada.
              </p>
            </div>
          </div>
          <button
            onClick={decideForMe}
            disabled={gen.isPending}
            className="text-sm font-black text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
            style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
          >
            {gen.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Decida por mim
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#ffd0c8] bg-[#fff1ef] p-4 mb-6 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#22304b]">
            💡 Faça o <b>diagnóstico</b> primeiro — o Estrategista monta seu
            plano e pré-preenche tudo aqui.
          </p>
          <button
            onClick={() => navigate("/diagnostico")}
            className="text-xs font-black text-white px-4 py-2 rounded-lg whitespace-nowrap"
            style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
          >
            Ir para o diagnóstico →
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm mb-6">
        <label className="text-xs font-black text-[#071b44] uppercase tracking-wide">
          O que você vai anunciar?
        </label>
        <textarea
          value={produto}
          onChange={e => setProduto(e.target.value)}
          placeholder="Ex.: Curso de confeitaria para iniciantes — bolos caseiros para vender"
          className="w-full mt-2 border border-[#e6ebf3] rounded-lg p-3 text-sm bg-[#f6f8fc] focus:outline-none focus:border-[#ff3217] min-h-[60px]"
        />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs font-black text-[#071b44] uppercase tracking-wide mr-1">
            Proporção
          </span>
          {RATIOS.map(r => (
            <Chip key={r.v} on={ratio === r.v} onClick={() => setRatio(r.v)}>
              {r.label}
            </Chip>
          ))}
        </div>

        {/* Clonar post de sucesso */}
        <div className="mt-4">
          <span className="text-xs font-black text-[#071b44] uppercase tracking-wide">
            Clonar um post de sucesso{" "}
            <span className="text-[#61708a] font-semibold normal-case">
              (opcional)
            </span>
          </span>
          {refUrl ? (
            <div className="flex items-center gap-3 mt-2 border border-[#18b85c] bg-[#f3fbf6] rounded-lg p-2.5">
              <img
                src={refUrl}
                alt=""
                className="w-14 h-14 rounded-md object-cover"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-[#0c7a3c] flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Vamos clonar e variar este
                  post
                </p>
                <p className="text-[11px] text-[#61708a]">
                  As variações vão manter o estilo, mudando os fatores do Teste
                  A/Z.
                </p>
              </div>
              <button
                onClick={() => setRefUrl("")}
                className="p-1.5 text-[#61708a] hover:text-[#ff3217]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 mt-2 border border-dashed border-[#c7cdd8] rounded-lg px-4 py-3 cursor-pointer hover:border-[#ff3217] text-sm text-[#61708a] font-semibold w-fit">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading
                ? "Enviando…"
                : "Enviar imagem de um post que funcionou"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleRefFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>

        {/* A/Z toggle */}
        <div
          className="flex items-center justify-between mt-4 rounded-lg px-4 py-3 cursor-pointer"
          style={{
            background: az ? "#fff1ef" : "#f6f8fc",
            border: `1.5px solid ${az ? "#ff3217" : "#e6ebf3"}`,
          }}
          onClick={() => setAz(a => !a)}
        >
          <span
            className="text-sm font-bold"
            style={{ color: az ? "#ff3217" : "#61708a" }}
          >
            🥚 Teste A/Z — gerar 6 variações cruzando características
          </span>
          <span
            className="w-10 h-5 rounded-full relative transition-colors"
            style={{ background: az ? "#ff3217" : "#c7cdd8" }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all"
              style={{ left: az ? "22px" : "2px" }}
            />
          </span>
        </div>

        {/* Chips de características */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-4">
          {keyFactorDefs.map((f: any) => (
            <div key={f.key}>
              <p className="text-[11px] font-bold text-[#61708a] mb-1">
                {f.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(f.values as any[])
                  .filter(v => v.key !== "na")
                  .slice(0, 6)
                  .map(v => (
                    <Chip
                      key={v.key}
                      small
                      on={sel[f.key] === v.key}
                      onClick={() => pick(f.key, v.key)}
                    >
                      {v.label}
                    </Chip>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-5">
          <span className="text-xs text-[#61708a] font-semibold">
            Custo estimado: <b className="text-[#ff3217]">{estimate} CC</b>
          </span>
          <button
            disabled={gen.isPending || produto.trim().length < 2}
            onClick={() =>
              gen.mutate({
                produto,
                ratio,
                baseFactors: cleanSel(sel),
                qty: az ? 6 : 1,
                az,
                refImageUrl: refUrl || undefined,
              })
            }
            className="text-sm font-black text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
          >
            {gen.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {gen.isPending ? "Gerando..." : "Gerar criativos 🥚"}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-[#070b17]">
              Variações geradas
            </h3>
            <button
              onClick={() =>
                sendApproval.mutate({ creativeIds: results.map(r => r.id) })
              }
              disabled={sendApproval.isPending}
              className="text-sm font-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50"
              style={{ background: "linear-gradient(180deg,#ff421f,#f0200d)" }}
            >
              {sendApproval.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Enviar para aprovação
            </button>
          </div>
          <Grid items={results} />
        </>
      )}

      {/* Recentes */}
      {results.length === 0 && recent.data && recent.data.length > 0 && (
        <>
          <h3 className="text-sm font-black text-[#070b17] mb-3">
            Criados recentemente
          </h3>
          <Grid items={recent.data} />
        </>
      )}
    </AppLayout>
  );
}

function cleanSel(s: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(s)) if (v) out[k] = v;
  return out;
}

function Chip({ children, on, onClick, small }: any) {
  return (
    <button
      onClick={onClick}
      className="rounded-full font-bold transition-colors"
      style={{
        fontSize: small ? 11 : 12,
        padding: small ? "5px 10px" : "7px 13px",
        border: `1.5px solid ${on ? "#ff3217" : "#e6ebf3"}`,
        background: on ? "#fff1ef" : "#fff",
        color: on ? "#ff3217" : "#22304b",
      }}
    >
      {children}
    </button>
  );
}

function Grid({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map(c => (
        <div
          key={c.id}
          className="bg-white rounded-xl border border-[#e6ebf3] overflow-hidden shadow-sm"
        >
          <img
            src={c.imageUrl}
            alt=""
            className="w-full aspect-square object-cover bg-[#f6f8fc]"
          />
          <div className="p-3">
            <p className="text-xs text-[#22304b] font-semibold leading-snug min-h-[34px]">
              {c.copy}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {c.lente && <Tag>{c.lente}</Tag>}
              {c.formato && <Tag>{c.formato}</Tag>}
              {c.factorValues?.img_cor_predominante && (
                <Tag>{c.factorValues.img_cor_predominante}</Tag>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Tag({ children }: any) {
  return (
    <span className="text-[9px] font-bold text-[#61708a] bg-[#f6f8fc] border border-[#e6ebf3] rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}
