import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  Settings2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Channel = "linkedin" | "tiktok" | "instagram" | "google";

const CHANNEL_CONFIG: Record<Channel, { label: string; description: string; color: string; bgColor: string; icon: string }> = {
  linkedin: {
    label: "LinkedIn",
    description: "Anúncios e posts patrocinados no LinkedIn Campaign Manager",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    icon: "in",
  },
  tiktok: {
    label: "TikTok",
    description: "Anúncios e conteúdo patrocinado no TikTok Ads Manager",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/20",
    icon: "tt",
  },
  instagram: {
    label: "Instagram",
    description: "Anúncios e posts patrocinados via Meta Ads Manager",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: "ig",
  },
  google: {
    label: "Google",
    description: "Campanhas de busca e display no Google Ads",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    icon: "G",
  },
};

function IntegrationCard({ channel, integration, onSave }: {
  channel: Channel;
  integration?: any;
  onSave: (data: any) => void;
}) {
  const config = CHANNEL_CONFIG[channel];
  const [expanded, setExpanded] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    accountName: integration?.accountName ?? "",
    accessToken: integration?.accessToken ?? "",
    refreshToken: integration?.refreshToken ?? "",
  });

  const isConnected = integration?.status === "conectado";
  const hasError = integration?.status === "erro";

  function handleSave() {
    if (!form.accessToken) {
      toast.error("Informe o token de acesso.");
      return;
    }
    onSave({
      channel,
      accountName: form.accountName,
      accessToken: form.accessToken,
      refreshToken: form.refreshToken,
      status: "conectado",
    });
  }

  function handleDisconnect() {
    onSave({ channel, accessToken: "", refreshToken: "", status: "desconectado" });
  }

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Channel icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-sm flex-shrink-0 ${config.bgColor} ${config.color}`}>
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
              {integration ? (
                <StatusBadge status={integration.status} />
              ) : (
                <StatusBadge status="desconectado" />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
            {integration?.accountName && (
              <p className="text-xs text-muted-foreground mt-1">
                Conta: <span className="text-foreground font-medium">{integration.accountName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDisconnect}
              >
                <XCircle className="w-3.5 h-3.5" />
                Desconectar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setExpanded(true)}
              >
                <Key className="w-3.5 h-3.5" />
                Configurar
              </Button>
            )}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da conta</Label>
            <Input
              placeholder={`Ex: Conta ${config.label} Principal`}
              value={form.accountName}
              onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
              className="bg-background border-border text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Token de acesso *</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Cole seu token de acesso aqui..."
                value={form.accessToken}
                onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
                className="bg-background border-border text-sm h-9 pr-10 font-mono"
              />
              <button
                onClick={() => setShowToken((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Token de atualização (opcional)</Label>
            <Input
              type="password"
              placeholder="Token de refresh (se aplicável)..."
              value={form.refreshToken}
              onChange={(e) => setForm((f) => ({ ...f, refreshToken: e.target.value }))}
              className="bg-background border-border text-sm h-9 font-mono"
            />
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Como obter o token:</strong> Acesse o painel de desenvolvedor do {config.label},
              crie um aplicativo com permissões de anúncios e copie o token de acesso gerado.
              Os tokens são armazenados de forma segura e usados apenas para disparar campanhas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleSave}>
              <CheckCircle className="w-3.5 h-3.5" />
              Salvar e Conectar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8 text-muted-foreground"
              onClick={() => setExpanded(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Integracoes() {
  const utils = trpc.useUtils();
  const { data: integrations, isLoading } = trpc.integrations.list.useQuery();
  const { data: dispatchLogs, isLoading: loadingLogs } = trpc.dispatch.logs.useQuery({});

  const saveMutation = trpc.integrations.save.useMutation({
    onSuccess: () => {
      utils.integrations.list.invalidate();
      toast.success("Integração salva com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const channels: Channel[] = ["linkedin", "tiktok", "instagram", "google"];

  function getIntegration(channel: Channel) {
    return integrations?.find((i) => i.channel === channel);
  }

  const connectedCount = integrations?.filter((i) => i.status === "conectado").length ?? 0;

  return (
    <AppLayout
      title="Integrações"
      subtitle="Configure as conexões com as plataformas de anúncios"
    >
      {/* Status overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {channels.map((ch) => {
          const integration = getIntegration(ch);
          const config = CHANNEL_CONFIG[ch];
          const status = integration?.status ?? "desconectado";
          return (
            <div key={ch} className={`card-premium p-4 flex items-center gap-3 border ${config.bgColor}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${config.bgColor} ${config.color} border border-current/20`}>
                {config.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{config.label}</p>
                <StatusBadge status={status} className="mt-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Integration cards */}
      <div className="space-y-3 mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Canais Configurados
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({connectedCount} de {channels.length} conectados)
          </span>
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : (
          channels.map((ch) => (
            <IntegrationCard
              key={ch}
              channel={ch}
              integration={getIntegration(ch)}
              onSave={(data) => saveMutation.mutate(data)}
            />
          ))
        )}
      </div>

      {/* Dispatch logs */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Logs de Disparo
          {dispatchLogs && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">({dispatchLogs.length} registros)</span>
          )}
        </h2>

        {loadingLogs ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-card animate-pulse rounded-xl border border-border" />
            ))}
          </div>
        ) : !dispatchLogs || dispatchLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center card-premium">
            <Send className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum disparo registrado ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Os logs de disparo aparecerão aqui após o agente automático executar campanhas.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dispatchLogs.map((log) => (
              <div key={log.id} className="card-premium p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {log.status === "enviado" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {log.status === "falhou" && <XCircle className="w-4 h-4 text-red-400" />}
                  {log.status === "agendado" && <Clock className="w-4 h-4 text-blue-400" />}
                  {log.status === "cancelado" && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground capitalize">{log.channel}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-xs text-muted-foreground">Campanha #{log.campaignId}</span>
                    <StatusBadge status={log.status} />
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-red-400 truncate">{log.errorMessage}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(log.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {log.executedAt && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Executado: {format(new Date(log.executedAt), "HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
