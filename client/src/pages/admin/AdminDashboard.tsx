import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users, TrendingUp, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { useLocation } from "wouter";

const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 97,
  pro: 297,
};

const PLAN_STYLE: Record<string, { bg: string; text: string }> = {
  free:    { bg: "#f7f9fc", text: "#61708a" },
  starter: { bg: "#fff3e0", text: "#b85c00" },
  pro:     { bg: "#fff0f0", text: "#ff3217" },
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const utils = trpc.useUtils();

  const updatePlan = trpc.admin.updateOrgPlan.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado");
      utils.admin.stats.invalidate();
    },
    onError: err => {
      if (err.message.includes("10001") || err.message.includes("10002")) {
        setLocation("/login");
        return;
      }
      toast.error("Erro ao atualizar plano");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#ff3217] border-t-transparent animate-spin" />
          <p className="text-sm font-semibold text-[#61708a]">Carregando...</p>
        </div>
      </div>
    );
  }

  const orgs = stats?.orgs ?? [];
  const mrr = orgs.reduce((sum, o) => sum + (PLAN_PRICE[o.plan] ?? 0), 0);
  const byPlan = stats?.byPlan ?? {};

  return (
    <div className="min-h-screen bg-[#f7f9fc]" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
      {/* Header — navy */}
      <header style={{ background: "#071b44" }} className="px-8 h-16 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" theme="dark" hideTagline />
          <span
            className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: "rgba(255,50,23,0.15)", color: "#ff3217" }}
          >
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/revisao")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white border border-white/20 hover:bg-white/10 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Fila de revisão
          </button>
          <button
            onClick={() => { window.location.href = "/app/"; }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white border border-white/20 hover:bg-white/10 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Acessar Plataforma
          </button>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              setLocation("/login");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Building2, label: "Total de Orgs", value: stats?.totalOrgs ?? 0, color: "#1c6ed9" },
            { icon: Users, label: "Orgs Ativas", value: stats?.activeOrgs ?? 0, color: "#18b85c" },
            {
              icon: TrendingUp,
              label: "MRR",
              value: `R$ ${mrr.toLocaleString("pt-BR")}`,
              color: "#ff3217",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-bold text-[#61708a]">{label}</span>
              </div>
              <p className="text-3xl font-black" style={{ color: "#070b17" }}>{value}</p>
            </div>
          ))}

          {/* Por Plano */}
          <div className="bg-white rounded-xl border border-[#e6ebf3] p-5 shadow-sm">
            <p className="text-xs font-bold text-[#61708a] mb-3">Por Plano</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byPlan).map(([plan, count]) => {
                const s = PLAN_STYLE[plan] ?? { bg: "#f7f9fc", text: "#61708a" };
                return (
                  <span
                    key={plan}
                    className="px-2.5 py-1 rounded-full text-xs font-black"
                    style={{ background: s.bg, color: s.text }}
                  >
                    {plan}: {count as number}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabela de orgs */}
        <div className="bg-white rounded-xl border border-[#e6ebf3] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e6ebf3]">
            <h2 className="text-base font-black" style={{ color: "#070b17" }}>Organizações</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f7f9fc]">
                <TableHead className="text-xs font-black text-[#61708a]">Empresa</TableHead>
                <TableHead className="text-xs font-black text-[#61708a]">Slug</TableHead>
                <TableHead className="text-xs font-black text-[#61708a]">Plano</TableHead>
                <TableHead className="text-xs font-black text-[#61708a]">Status</TableHead>
                <TableHead className="text-xs font-black text-[#61708a]">Criada em</TableHead>
                <TableHead className="text-xs font-black text-[#61708a]">Alterar Plano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map(org => {
                const ps = PLAN_STYLE[org.plan] ?? PLAN_STYLE.free;
                return (
                  <TableRow key={org.id} className="hover:bg-[#fafbfd]">
                    <TableCell className="font-bold text-[#070b17]">{org.name}</TableCell>
                    <TableCell className="text-xs text-[#61708a]">{org.slug}</TableCell>
                    <TableCell>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-black"
                        style={{ background: ps.bg, color: ps.text }}
                      >
                        {org.plan}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-black"
                        style={{
                          background: org.isActive ? "#e6f9ef" : "#f7f9fc",
                          color: org.isActive ? "#18b85c" : "#61708a",
                        }}
                      >
                        {org.isActive ? "ativa" : "inativa"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#61708a]">
                      {new Date(org.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={org.plan}
                        onValueChange={plan =>
                          updatePlan.mutate({
                            orgId: org.id,
                            plan: plan as "free" | "starter" | "pro",
                          })
                        }
                      >
                        <SelectTrigger className="w-28 h-7 text-xs border-[#e6ebf3] bg-[#f7f9fc]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              {orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-[#61708a] py-12 font-semibold">
                    Nenhuma organização cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
