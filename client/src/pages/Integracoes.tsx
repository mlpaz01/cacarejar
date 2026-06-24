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
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
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
import { Link } from "wouter";

type Channel = "tiktok" | "instagram" | "google";

const CHANNEL_CONFIG: Record<
  Channel,
  {
    label: string;
    description: string;
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
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

function IntegrationCard({
  channel,
  integration,
  onSave,
}: {
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
    onSave({
      channel,
      accessToken: "",
      refreshToken: "",
      status: "desconectado",
    });
  }

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Channel icon */}
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-sm flex-shrink-0 ${config.bgColor} ${config.color}`}
          >
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="text-sm font-semibold text-foreground">
                {config.label}
              </h3>
              {integration ? (
                <StatusBadge status={integration.status} />
              ) : (
                <StatusBadge status="desconectado" />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {config.description}
            </p>
            {integration?.accountName && (
              <p className="text-xs text-muted-foreground mt-1">
                Conta:{" "}
                <span className="text-foreground font-medium">
                  {integration.accountName}
                </span>
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
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Nome da conta
            </Label>
            <Input
              placeholder={`Ex: Conta ${config.label} Principal`}
              value={form.accountName}
              onChange={e =>
                setForm(f => ({ ...f, accountName: e.target.value }))
              }
              className="bg-background border-border text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Token de acesso *
            </Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Cole seu token de acesso aqui..."
                value={form.accessToken}
                onChange={e =>
                  setForm(f => ({ ...f, accessToken: e.target.value }))
                }
                className="bg-background border-border text-sm h-9 pr-10 font-mono"
              />
              <button
                onClick={() => setShowToken(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Token de atualização (opcional)
            </Label>
            <Input
              type="password"
              placeholder="Token de refresh (se aplicável)..."
              value={form.refreshToken}
              onChange={e =>
                setForm(f => ({ ...f, refreshToken: e.target.value }))
              }
              className="bg-background border-border text-sm h-9 font-mono"
            />
          </div>
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Como obter o token:</strong>{" "}
              Acesse o painel de desenvolvedor do {config.label}, crie um
              aplicativo com permissões de anúncios e copie o token de acesso
              gerado. Os tokens são armazenados de forma segura e usados apenas
              para disparar campanhas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleSave}
            >
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

function ControlMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#61708a]">
        {label}
      </p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function numberOrUndefined(value: any) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function Integracoes() {
  const utils = trpc.useUtils();
  const { data: integrations, isLoading } = trpc.integrations.list.useQuery();
  const { data: dispatchLogs, isLoading: loadingLogs } =
    trpc.dispatch.logs.useQuery({});
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const [publishDrafts, setPublishDrafts] = useState<
    Record<number, Record<string, string>>
  >({});

  const saveMutation = trpc.integrations.save.useMutation({
    onSuccess: () => {
      utils.integrations.list.invalidate();
      toast.success("Integração salva com sucesso!");
    },
    onError: e => toast.error(e.message),
  });
  const updatePlanItem = trpc.diagnosis.updateSevenDayItem.useMutation({
    onSuccess: () => {
      utils.diagnosis.get.invalidate();
      toast.success("Publicacao registrada.");
    },
    onError: e => toast.error(e.message || "Erro ao registrar publicacao"),
  });

  const channels: Channel[] = ["tiktok", "instagram", "google"];

  function getIntegration(channel: Channel) {
    return integrations?.find(i => i.channel === channel);
  }

  const connectedCount =
    integrations?.filter(i => i.status === "conectado").length ?? 0;
  const activeCampaigns = (campaigns ?? []).filter(
    (campaign: any) => !["arquivada", "concluida"].includes(campaign.status)
  );
  const planItems = (((diagnosis as any)?.plano7Dias ?? []) as any[]).map(
    (item, index) => ({ ...item, index, status: item.status || "ideia" })
  );
  const publishQueue = planItems
    .filter(
      (item: any) =>
        ["aprovado", "publicado", "medir"].includes(item.status) ||
        item.resultado
    )
    .slice(0, 8);
  const manualPackage = [
    "Rotina de publicacao assistida - Cacarejar",
    "",
    `Canais com conexao real: ${connectedCount}/${channels.length}`,
    `Campanhas em acompanhamento: ${activeCampaigns.length}`,
    "",
    "Passo 1 - Abra Aprovacao e escolha os posts finais.",
    "Passo 2 - Copie o pacote de aprovacao.",
    "Passo 3 - Publique ou programe no canal escolhido.",
    "Passo 4 - Registre os numeros em Diagnostico/Metricas.",
    "Passo 5 - Rode o check-in em Acompanhamento para recalcular a rota.",
    "",
    "Campanhas atuais:",
    ...activeCampaigns
      .slice(0, 8)
      .map(
        (campaign: any) =>
          `- ${campaign.name} (${campaign.status}) - ${(campaign.channels ?? []).join(", ")}`
      ),
  ].join("\n");

  async function copyManualPackage() {
    await navigator.clipboard?.writeText(manualPackage);
    toast.success("Rotina assistida copiada.");
  }

  async function copyPost(item: any) {
    const text = [
      `${item.dia} - ${item.canal}`,
      item.gancho ? `Gancho: ${item.gancho}` : "",
      item.legenda || item.copy || "",
      item.cta ? `CTA: ${item.cta}` : "",
      item.hashtags?.length ? item.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard?.writeText(text);
    toast.success("Post copiado.");
  }

  function savePublication(
    index: number,
    status: "publicado" | "medir" = "publicado"
  ) {
    const draft = publishDrafts[index] ?? {};
    updatePlanItem.mutate({
      index,
      patch: {
        status,
        publicadoUrl: draft.publicadoUrl || undefined,
        resultado: {
          alcance: numberOrUndefined(draft.alcance),
          cliques: numberOrUndefined(draft.cliques),
          leads: numberOrUndefined(draft.leads),
          vendas: numberOrUndefined(draft.vendas),
          observacoes: draft.observacoes || undefined,
        },
      },
    });
  }

  return (
    <AppLayout
      title="Integrações"
      subtitle="Configure as conexões com as plataformas de anúncios"
    >
      <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-5 mb-6">
        <div className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm">
          <p className="text-xs font-black text-white/60 uppercase tracking-widest">
            Modo interno assistido
          </p>
          <h2 className="text-2xl font-black mt-2">
            Publicacao com controle humano
          </h2>
          <p className="text-sm text-white/78 leading-relaxed mt-3 max-w-3xl">
            Enquanto as APIs de canais nao estiverem conectadas, o Cacarejar
            prepara pacote, copy, criativos, verba e checklist. A publicacao
            final fica manual, com registro de resultado para os Agentes
            aprenderem no proximo ciclo.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={copyManualPackage}
              className="rounded-xl bg-white text-[#071b44] px-4 py-2 text-xs font-black inline-flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar rotina
            </button>
            <Link href="/aprovacao">
              <a className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5" /> Abrir aprovacao
              </a>
            </Link>
            <Link href="/recalibracao">
              <a className="rounded-xl border border-white/20 text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Check-in
              </a>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ControlMetric
            label="Canais conectados"
            value={`${connectedCount}/${channels.length}`}
          />
          <ControlMetric
            label="Campanhas ativas"
            value={String(activeCampaigns.length)}
          />
          <ControlMetric
            label="Disparos registrados"
            value={String(dispatchLogs?.length ?? 0)}
          />
          <ControlMetric
            label="Modo atual"
            value={connectedCount ? "hibrido" : "assistido"}
          />
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-[#e6ebf3] p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black text-[#ff3217] uppercase tracking-wide">
              Fila de publicacao assistida
            </p>
            <h2 className="text-2xl font-black text-[#071b44] mt-1">
              Posts prontos para publicar e medir
            </h2>
            <p className="text-sm text-[#61708a] mt-2 max-w-3xl">
              Copie a legenda, baixe a imagem, publique manualmente no canal e
              registre o link aqui. O resultado volta para o plano inteiro.
            </p>
          </div>
          <Link href="/calendario">
            <a className="rounded-xl border border-[#e6ebf3] bg-white px-4 py-2 text-xs font-black text-[#071b44] hover:bg-[#f8fafc]">
              Abrir calendario
            </a>
          </Link>
        </div>
        {publishQueue.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            {publishQueue.map((item: any) => (
              <article
                key={`${item.dia}-${item.index}`}
                className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-white border border-[#e6ebf3] overflow-hidden flex-shrink-0 grid place-items-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ClipboardList className="w-6 h-6 text-[#c7d1e0]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-[#ff3217] uppercase">
                      {item.status.replace("_", " ")}
                    </p>
                    <h3 className="text-sm font-black text-[#071b44] mt-1">
                      {item.dia} - {item.canal}
                    </h3>
                    <p className="text-xs font-bold text-[#22304b] leading-snug mt-1 line-clamp-2">
                      {item.gancho}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  <button
                    onClick={() => copyPost(item)}
                    className="rounded-xl bg-[#071b44] text-white px-3 py-2 text-[10px] font-black inline-flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                  {item.imageUrl ? (
                    <a
                      href={item.imageUrl}
                      download
                      className="rounded-xl border border-[#e6ebf3] bg-white text-[#071b44] px-3 py-2 text-[10px] font-black inline-flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3 h-3" /> Imagem
                    </a>
                  ) : (
                    <span className="rounded-xl border border-[#e6ebf3] bg-white text-[#9aa7bd] px-3 py-2 text-[10px] font-black inline-flex items-center justify-center">
                      Sem imagem
                    </span>
                  )}
                  {item.publicadoUrl ? (
                    <a
                      href={item.publicadoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-[#e6ebf3] bg-white text-[#071b44] px-3 py-2 text-[10px] font-black inline-flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir
                    </a>
                  ) : (
                    <button
                      onClick={() => savePublication(item.index, "publicado")}
                      disabled={updatePlanItem.isPending}
                      className="rounded-xl border border-[#e6ebf3] bg-white text-[#071b44] px-3 py-2 text-[10px] font-black disabled:opacity-50"
                    >
                      Publicado
                    </button>
                  )}
                  <button
                    onClick={() => savePublication(item.index, "medir")}
                    disabled={updatePlanItem.isPending}
                    className="rounded-xl border border-[#18b85c] bg-[#eafff1] text-[#087a32] px-3 py-2 text-[10px] font-black disabled:opacity-50"
                  >
                    Medir
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_100px] gap-2 mt-3">
                  <input
                    value={
                      publishDrafts[item.index]?.publicadoUrl ??
                      item.publicadoUrl ??
                      ""
                    }
                    onChange={e =>
                      setPublishDrafts(prev => ({
                        ...prev,
                        [item.index]: {
                          ...(prev[item.index] ?? {}),
                          publicadoUrl: e.target.value,
                        },
                      }))
                    }
                    placeholder="Link do post publicado"
                    className="rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={
                      publishDrafts[item.index]?.alcance ??
                      item.resultado?.alcance ??
                      ""
                    }
                    onChange={e =>
                      setPublishDrafts(prev => ({
                        ...prev,
                        [item.index]: {
                          ...(prev[item.index] ?? {}),
                          alcance: e.target.value,
                        },
                      }))
                    }
                    placeholder="Alcance"
                    className="rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={
                      publishDrafts[item.index]?.cliques ??
                      item.resultado?.cliques ??
                      ""
                    }
                    onChange={e =>
                      setPublishDrafts(prev => ({
                        ...prev,
                        [item.index]: {
                          ...(prev[item.index] ?? {}),
                          cliques: e.target.value,
                        },
                      }))
                    }
                    placeholder="Cliques"
                    className="rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={
                      publishDrafts[item.index]?.leads ??
                      item.resultado?.leads ??
                      ""
                    }
                    onChange={e =>
                      setPublishDrafts(prev => ({
                        ...prev,
                        [item.index]: {
                          ...(prev[item.index] ?? {}),
                          leads: e.target.value,
                        },
                      }))
                    }
                    placeholder="Leads"
                    className="rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                  />
                </div>
                <textarea
                  value={
                    publishDrafts[item.index]?.observacoes ??
                    item.resultado?.observacoes ??
                    ""
                  }
                  onChange={e =>
                    setPublishDrafts(prev => ({
                      ...prev,
                      [item.index]: {
                        ...(prev[item.index] ?? {}),
                        observacoes: e.target.value,
                      },
                    }))
                  }
                  placeholder="Observacoes: comentarios, DMs, percepcao do post..."
                  className="mt-2 w-full min-h-[58px] resize-none rounded-xl border border-[#e6ebf3] bg-white px-3 py-2 text-xs font-semibold text-[#071b44] outline-none focus:border-[#ff3217]"
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d8e0ec] bg-[#fbfcff] p-8 text-center mt-5">
            <p className="text-sm font-black text-[#071b44]">
              Nenhum post aprovado ainda
            </p>
            <p className="text-xs text-[#61708a] mt-1">
              Aprove posts no Diagnostico, Calendario ou Aprovacao para montar a
              fila de publicacao.
            </p>
          </div>
        )}
      </section>

      {/* Status overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {channels.map(ch => {
          const integration = getIntegration(ch);
          const config = CHANNEL_CONFIG[ch];
          const status = integration?.status ?? "desconectado";
          return (
            <div
              key={ch}
              className={`card-premium p-4 flex items-center gap-3 border ${config.bgColor}`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${config.bgColor} ${config.color} border border-current/20`}
              >
                {config.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {config.label}
                </p>
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
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-24 bg-card animate-pulse rounded-xl border border-border"
              />
            ))}
          </div>
        ) : (
          channels.map(ch => (
            <IntegrationCard
              key={ch}
              channel={ch}
              integration={getIntegration(ch)}
              onSave={data => saveMutation.mutate(data)}
            />
          ))
        )}
      </div>

      {/* Dispatch logs */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Logs de Disparo
          {dispatchLogs && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({dispatchLogs.length} registros)
            </span>
          )}
        </h2>

        {loadingLogs ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-14 bg-card animate-pulse rounded-xl border border-border"
              />
            ))}
          </div>
        ) : !dispatchLogs || dispatchLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center card-premium">
            <Send className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum disparo registrado ainda
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Os logs de disparo aparecerão aqui após o agente automático
              executar campanhas.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dispatchLogs.map(log => (
              <div
                key={log.id}
                className="card-premium p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  {log.status === "enviado" && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                  {log.status === "falhou" && (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  {log.status === "agendado" && (
                    <Clock className="w-4 h-4 text-blue-400" />
                  )}
                  {log.status === "cancelado" && (
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground capitalize">
                      {log.channel}
                    </span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-xs text-muted-foreground">
                      Campanha #{log.campaignId}
                    </span>
                    <StatusBadge status={log.status} />
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-red-400 truncate">
                      {log.errorMessage}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(log.scheduledAt), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                  {log.executedAt && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Executado:{" "}
                      {format(new Date(log.executedAt), "HH:mm", {
                        locale: ptBR,
                      })}
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
