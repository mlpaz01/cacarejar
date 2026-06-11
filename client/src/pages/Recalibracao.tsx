import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Zap,
  Loader2,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  ImageIcon,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
type CalibrationSuggestion = {
  tipo: string;
  descricao: string;
  valorAtual?: string;
  valorSugerido?: string;
  impactoEstimado?: string;
};

const SUGGESTION_ICONS: Record<string, any> = {
  orcamento: DollarSign,
  publico_alvo: Users,
  criativo: ImageIcon,
  canal: Megaphone,
};

const SUGGESTION_LABELS: Record<string, string> = {
  orcamento: "Orçamento",
  publico_alvo: "Público-alvo",
  criativo: "Criativo",
  canal: "Canal",
};

function SuggestionCard({ s }: { s: CalibrationSuggestion }) {
  const Icon = SUGGESTION_ICONS[s.tipo] ?? Zap;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            {SUGGESTION_LABELS[s.tipo] ?? s.tipo}
          </span>
        </div>
        <p className="text-xs text-foreground leading-relaxed">{s.descricao}</p>
        {(s.valorAtual || s.valorSugerido) && (
          <div className="flex items-center gap-3 mt-2 text-[10px]">
            {s.valorAtual && (
              <span className="text-muted-foreground">
                Atual: <span className="text-foreground font-medium">{s.valorAtual}</span>
              </span>
            )}
            {s.valorSugerido && (
              <span className="text-muted-foreground">
                Sugerido: <span className="text-primary font-medium">{s.valorSugerido}</span>
              </span>
            )}
          </div>
        )}
        {s.impactoEstimado && (
          <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {s.impactoEstimado}
          </p>
        )}
      </div>
    </div>
  );
}

function CalibrationEntry({ log, campaigns }: { log: any; campaigns: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const campaign = campaigns.find((c) => c.id === log.campaignId);
  const suggestions = log.suggestions as CalibrationSuggestion[];

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {campaign?.name ?? `Campanha #${log.campaignId}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(log.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{log.analysis}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={log.status} />
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground">
            {suggestions.length} sugestão{suggestions.length !== 1 ? "ões" : ""}
          </span>
          <div className="flex gap-1">
            {Array.from(new Set(suggestions.map((s) => s.tipo))).map((tipo) => {
              const Icon = SUGGESTION_ICONS[tipo] ?? Zap;
              return (
                <span key={tipo} className="p-1 rounded bg-muted text-muted-foreground">
                  <Icon className="w-3 h-3" />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{log.analysis}</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <SuggestionCard key={i} s={s} />
            ))}
          </div>
          {log.status === "pendente" && <CalibrationActions logId={log.id} />}
          {log.status === "aplicado" && log.appliedAt && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Aplicado em {format(new Date(log.appliedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CalibrationActions({ logId }: { logId: number }) {
  const utils = trpc.useUtils();
  const applyMutation = trpc.calibration.markApplied.useMutation({
    onSuccess: () => {
      utils.calibration.list.invalidate();
      toast.success("Sugestões marcadas como aplicadas!");
    },
  });
  const ignoreMutation = trpc.calibration.ignore.useMutation({
    onSuccess: () => {
      utils.calibration.list.invalidate();
      toast.info("Sugestões ignoradas.");
    },
  });

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        size="sm"
        className="gap-1.5 text-xs h-8"
        onClick={() => applyMutation.mutate({ id: logId })}
        disabled={applyMutation.isPending}
      >
        <CheckCircle className="w-3.5 h-3.5" />
        Aplicar sugestões
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs h-8 text-muted-foreground"
        onClick={() => ignoreMutation.mutate({ id: logId })}
        disabled={ignoreMutation.isPending}
      >
        <XCircle className="w-3.5 h-3.5" />
        Ignorar
      </Button>
    </div>
  );
}

export default function Recalibracao() {
  const utils = trpc.useUtils();
  const { data: calibrations, isLoading } = trpc.calibration.list.useQuery();
  const { data: campaigns } = trpc.campaigns.list.useQuery();

  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeMutation = trpc.calibration.analyze.useMutation({
    onSuccess: (data) => {
      utils.calibration.list.invalidate();
      setAnalyzing(false);
      toast.success("Análise concluída! Novas sugestões disponíveis.");
    },
    onError: (e) => {
      setAnalyzing(false);
      toast.error(`Erro na análise: ${e.message}`);
    },
  });

  function handleAnalyze() {
    if (!selectedCampaign) {
      toast.error("Selecione uma campanha para analisar.");
      return;
    }
    setAnalyzing(true);
    analyzeMutation.mutate({ campaignId: selectedCampaign });
  }

  const pending = (calibrations ?? []).filter((c) => c.status === "pendente");
  const history = (calibrations ?? []).filter((c) => c.status !== "pendente");

  return (
    <AppLayout
      title="Motor de Recalibração"
      subtitle="Análise inteligente e otimização automática de campanhas"
    >
      {/* Analyze panel */}
      <div className="card-premium p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 flex-shrink-0">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground mb-1">Analisar Campanha com IA</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              O motor de IA analisa as métricas da campanha selecionada e gera sugestões personalizadas de
              otimização de orçamento, público-alvo, criativos e canais para maximizar o ROI.
            </p>
            <div className="flex items-center gap-3">
              <select
                value={selectedCampaign ?? ""}
                onChange={(e) => setSelectedCampaign(Number(e.target.value) || null)}
                className="h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1 max-w-xs"
              >
                <option value="">Selecione uma campanha</option>
                {(campaigns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button
                className="gap-2"
                onClick={handleAnalyze}
                disabled={analyzing || analyzeMutation.isPending || !selectedCampaign}
              >
                {analyzing || analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Analisar Agora
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pending suggestions */}
      {pending.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Sugestões Pendentes
              <span className="ml-2 text-xs font-normal text-amber-400">({pending.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {pending.map((log) => (
              <CalibrationEntry key={log.id} log={log} campaigns={campaigns ?? []} />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Histórico de Recalibrações
          {history.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({history.length})</span>
          )}
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : history.length === 0 && pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-base font-medium text-muted-foreground">Nenhuma análise realizada ainda</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Selecione uma campanha acima e clique em "Analisar Agora" para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((log) => (
              <CalibrationEntry key={log.id} log={log} campaigns={campaigns ?? []} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
