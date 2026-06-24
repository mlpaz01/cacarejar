import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  ImageIcon,
  BarChart3,
  Zap,
  Library,
  Settings2,
  LogOut,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Coins,
  CheckSquare,
  Bell,
  Egg,
  CalendarDays,
  MessageSquareHeart,
  Telescope,
  UserCog,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";

const navGroups = [
  {
    title: "Estrategia",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/diagnostico", icon: MessageSquareHeart, label: "Diagnostico" },
      { href: "/radar", icon: Telescope, label: "Radar de Mercado" },
    ],
  },
  {
    title: "Criacao",
    items: [
      { href: "/criativos", icon: ImageIcon, label: "Criativos" },
    ],
  },
  {
    title: "Veiculacao",
    items: [
      { href: "/aprovacao", icon: CheckSquare, label: "Aprovacao" },
      { href: "/calendario", icon: CalendarDays, label: "Calendario" },
      { href: "/campanhas", icon: Megaphone, label: "Campanhas" },
      { href: "/ovos", icon: Egg, label: "Ovos de Ouro" },
    ],
  },
  {
    title: "Resultados",
    items: [
      { href: "/metricas", icon: BarChart3, label: "Metricas" },
      { href: "/recalibracao", icon: Zap, label: "Acompanhamento" },
    ],
  },
  {
    title: "Conta",
    items: [
      { href: "/biblioteca", icon: Library, label: "Biblioteca" },
      { href: "/creditos", icon: Coins, label: "Creditos" },
      { href: "/notificacoes", icon: Bell, label: "Notificacoes" },
      { href: "/integracoes", icon: Settings2, label: "Integracoes" },
      { href: "/configuracoes", icon: UserCog, label: "Configuracoes" },
    ],
  },
];

const SIDEBAR_KEY = "cacarejar.sidebar.collapsed";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const unread = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }, [collapsed]);

  useEffect(() => {
    if (title) document.title = `${title} | Cacarejar`;
    else document.title = "Cacarejar | Plataforma de Marketing com Agentes";
  }, [title]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex">
      <aside
        className={cn(
          "bg-sidebar flex flex-col fixed inset-y-0 left-0 z-40 shadow-xl transition-[width] duration-200 ease-out",
          collapsed ? "w-[72px]" : "w-60"
        )}
      >
        <div
          className={cn(
            "h-24 flex items-center border-b border-sidebar-border relative",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          {collapsed ? (
            <BrandLogo size="sm" theme="dark" variant="icon" />
          ) : (
            <BrandLogo size="sidebar" theme="dark" />
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border text-white/70 hover:text-white hover:bg-primary hover:border-primary flex items-center justify-center shadow-md transition-colors z-10"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        <nav className={cn("flex-1 py-4 overflow-y-auto overflow-x-hidden", collapsed ? "px-2 space-y-3" : "px-3 space-y-4")}>
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {collapsed ? (
                <div className="border-t border-white/5 mx-2 mb-2" />
              ) : (
                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest px-3 mb-2">
                  {group.title}
                </p>
              )}

              {group.items.map(({ href, icon: Icon, label }) => {
                const isActive = location === href || (href !== "/" && location.startsWith(href));
                const hasBadge = href === "/notificacoes" && (unread.data ?? 0) > 0;
                const item = (
                  <Link key={href} href={href}>
                    <a
                      className={cn(
                        "flex items-center rounded-lg text-sm font-semibold transition-all duration-150 group relative",
                        collapsed ? "justify-center h-10 w-full" : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-primary text-white shadow-sm"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 flex-shrink-0",
                          isActive ? "text-white" : "text-white/50 group-hover:text-white"
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{label}</span>
                          {hasBadge && (
                            <span className="ml-auto bg-primary text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                              {unread.data}
                            </span>
                          )}
                          {isActive && !hasBadge && (
                            <ChevronRight className="w-3.5 h-3.5 ml-auto text-white/70" />
                          )}
                        </>
                      )}
                      {collapsed && hasBadge && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary border border-sidebar" />
                      )}
                    </a>
                  </Link>
                );

                if (!collapsed) return item;
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <div>{item}</div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-bold">
                      {label}
                      {hasBadge && <span className="ml-1.5 text-primary">- {unread.data}</span>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-8 h-8 flex-shrink-0 cursor-default">
                    <AvatarFallback className="bg-primary text-white text-xs font-black">{initials}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-bold">
                  {user?.name ?? "Usuario"}
                  {user?.email && <div className="text-[10px] font-normal opacity-70">{user.email}</div>}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    aria-label="Sair"
                    className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-primary text-white text-xs font-black">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name ?? "Usuario"}</p>
                <p className="text-[10px] text-white/40 truncate">{user?.email ?? ""}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    aria-label="Sair"
                    className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ease-out",
          collapsed ? "ml-[72px]" : "ml-60"
        )}
      >
        {(title || actions) && (
          <header className="min-h-[72px] border-b border-border bg-white sticky top-0 z-30 px-5 lg:px-8 py-3 shadow-sm">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1">
                {title && (
                  <div className="max-w-3xl">
                    <h1 className="text-base font-black leading-tight text-foreground">{title}</h1>
                    {subtitle && <p className="text-xs leading-snug text-muted-foreground mt-1">{subtitle}</p>}
                  </div>
                )}
              </div>
              {actions && <div className="flex shrink-0 items-center justify-start xl:justify-end gap-2 flex-wrap">{actions}</div>}
            </div>
          </header>
        )}

        <main className="flex-1 p-5 lg:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
