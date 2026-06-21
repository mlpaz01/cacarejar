import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bell, Building2, Loader2, Save, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SettingsForm = {
  userName: string;
  organizationName: string;
  nicho: string;
  produto: string;
  objetivo: string;
  site: string;
  instagram: string;
  linkedin: string;
  tiktok: string;
  emailEnabled: boolean;
  notificationPrefs: Record<string, boolean>;
};

const emptyForm: SettingsForm = {
  userName: "",
  organizationName: "",
  nicho: "",
  produto: "",
  objetivo: "",
  site: "",
  instagram: "",
  linkedin: "",
  tiktok: "",
  emailEnabled: true,
  notificationPrefs: {
    approvals: true,
    performance: true,
    credits: true,
    product: false,
  },
};

const notificationOptions = [
  { key: "approvals", label: "Aprovações", description: "Revisões, retornos e aprovações de criativos." },
  { key: "performance", label: "Performance", description: "Mudanças relevantes em campanhas e ovos de ouro." },
  { key: "credits", label: "Créditos", description: "Alertas de saldo baixo e confirmações de recarga." },
  { key: "product", label: "Produto", description: "Novidades operacionais da plataforma." },
] as const;

export default function Configuracoes() {
  const utils = trpc.useUtils();
  const settings = trpc.settings.get.useQuery();
  const [form, setForm] = useState<SettingsForm>(emptyForm);

  useEffect(() => {
    const data = settings.data;
    if (!data) return;

    setForm({
      userName: data.user.name ?? "",
      organizationName: data.organization?.name ?? "",
      nicho: data.profile?.nicho ?? "",
      produto: data.profile?.produto ?? "",
      objetivo: data.profile?.objetivo ?? "",
      site: data.profile?.site ?? "",
      instagram: data.profile?.redes?.instagram ?? "",
      linkedin: data.profile?.redes?.linkedin ?? "",
      tiktok: data.profile?.redes?.tiktok ?? "",
      emailEnabled: data.notifications?.emailEnabled ?? true,
      notificationPrefs: {
        ...emptyForm.notificationPrefs,
        ...(data.notifications?.prefs ?? {}),
      },
    });
  }, [settings.data]);

  const planLabel = useMemo(() => {
    const plan = settings.data?.organization?.plan ?? "free";
    const labels: Record<string, string> = {
      free: "Free",
      starter: "Starter",
      pro: "Pro",
    };
    return labels[plan] ?? plan;
  }, [settings.data?.organization?.plan]);

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.settings.get.invalidate(),
        utils.auth.me.invalidate(),
      ]);
      toast.success("Configurações salvas.");
    },
    onError: (error) => toast.error(error.message),
  });

  const setField = <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveAccount = () => {
    updateSettings.mutate({
      user: { name: form.userName },
      organization: { name: form.organizationName },
    });
  };

  const saveProfile = () => {
    updateSettings.mutate({
      profile: {
        nicho: form.nicho,
        produto: form.produto,
        objetivo: form.objetivo,
        site: form.site,
        redes: {
          instagram: form.instagram,
          linkedin: form.linkedin,
          tiktok: form.tiktok,
        },
      },
    });
  };

  const saveNotifications = () => {
    updateSettings.mutate({
      notifications: {
        emailEnabled: form.emailEnabled,
        prefs: form.notificationPrefs,
      },
    });
  };

  if (settings.isLoading) {
    return (
      <AppLayout title="Configurações" subtitle="Conta, empresa e preferências">
        <div className="flex items-center gap-2 text-sm text-[#61708a]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando configurações...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações" subtitle="Conta, empresa e preferências">
      <Tabs defaultValue="conta" className="space-y-6">
        <TabsList className="bg-white border border-[#e6ebf3] shadow-sm">
          <TabsTrigger value="conta" className="gap-2 px-4">
            <UserRound className="w-4 h-4" />
            Conta
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-2 px-4">
            <Building2 className="w-4 h-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2 px-4">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conta" className="space-y-4">
          <div className="card-premium p-6 max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Dados de acesso</h2>
                <p className="text-xs text-muted-foreground mt-1">Perfil usado dentro da plataforma.</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {settings.data?.user.role ?? "user"}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input
                  value={form.userName}
                  onChange={(event) => setField("userName", event.target.value)}
                  className="bg-background border-border h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={settings.data?.user.email ?? ""} disabled className="bg-muted/50 border-border h-10" />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={saveAccount} disabled={updateSettings.isPending} className="gap-2">
                {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar conta
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="empresa" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="card-premium p-6">
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-foreground">Perfil da empresa</h2>
                <p className="text-xs text-muted-foreground mt-1">Base usada pelo diagnóstico e pelos agentes de criação.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input
                    value={form.organizationName}
                    onChange={(event) => setField("organizationName", event.target.value)}
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nicho</Label>
                  <Input
                    value={form.nicho}
                    onChange={(event) => setField("nicho", event.target.value)}
                    placeholder="Ex: SaaS, saúde ocupacional, educação"
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Produto ou oferta principal</Label>
                  <Textarea
                    value={form.produto}
                    onChange={(event) => setField("produto", event.target.value)}
                    className="min-h-24 bg-background border-border"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Objetivo</Label>
                  <Input
                    value={form.objetivo}
                    onChange={(event) => setField("objetivo", event.target.value)}
                    placeholder="Ex: gerar leads, vender mais, autoridade"
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Site</Label>
                  <Input
                    value={form.site}
                    onChange={(event) => setField("site", event.target.value)}
                    placeholder="https://"
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Instagram</Label>
                  <Input
                    value={form.instagram}
                    onChange={(event) => setField("instagram", event.target.value)}
                    placeholder="@perfil"
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                  <Input
                    value={form.linkedin}
                    onChange={(event) => setField("linkedin", event.target.value)}
                    placeholder="URL ou página"
                    className="bg-background border-border h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">TikTok</Label>
                  <Input
                    value={form.tiktok}
                    onChange={(event) => setField("tiktok", event.target.value)}
                    placeholder="@perfil"
                    className="bg-background border-border h-10"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={saveProfile} disabled={updateSettings.isPending} className="gap-2">
                  {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar empresa
                </Button>
              </div>
            </div>

            <div className="card-premium p-5 h-fit">
              <p className="text-xs text-muted-foreground">Plano atual</p>
              <p className="text-2xl font-black text-foreground mt-1">{planLabel}</p>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <p>
                  Slug: <span className="font-semibold text-foreground">{settings.data?.organization?.slug ?? "-"}</span>
                </p>
                <p>
                  Status:{" "}
                  <span className="font-semibold text-foreground">
                    {settings.data?.organization?.isActive === false ? "inativo" : "ativo"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notificacoes" className="space-y-4">
          <div className="card-premium p-6 max-w-3xl">
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Email</h2>
                <p className="text-xs text-muted-foreground mt-1">Canal principal para avisos importantes.</p>
              </div>
              <Switch
                checked={form.emailEnabled}
                onCheckedChange={(checked) => setField("emailEnabled", checked)}
                aria-label="Ativar notificações por email"
              />
            </div>

            <div className="divide-y divide-border">
              {notificationOptions.map((option) => (
                <div key={option.key} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                  <Switch
                    checked={form.notificationPrefs[option.key] ?? false}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        notificationPrefs: {
                          ...current.notificationPrefs,
                          [option.key]: checked,
                        },
                      }))
                    }
                    aria-label={`Ativar ${option.label}`}
                  />
                </div>
              ))}
            </div>

            <div className="mt-2 flex justify-end">
              <Button onClick={saveNotifications} disabled={updateSettings.isPending} className="gap-2">
                {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar notificações
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
