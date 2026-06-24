import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Register from "@/pages/Register";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRevisao from "@/pages/admin/AdminRevisao";
import AdminFinanceiro from "@/pages/admin/AdminFinanceiro";
import { Router, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Campanhas from "./pages/Campanhas";
import CampanhaDetalhe from "./pages/CampanhaDetalhe";
import Criativos from "./pages/Criativos";
import CriativoEditor from "./pages/CriativoEditor";
import Metricas from "./pages/Metricas";
import Recalibracao from "./pages/Recalibracao";
import Biblioteca from "./pages/Biblioteca";
import Integracoes from "./pages/Integracoes";
import Creditos from "./pages/Creditos";
import Estudio from "./pages/Estudio";
import Aprovacao from "./pages/Aprovacao";
import Notificacoes from "./pages/Notificacoes";
import Configuracoes from "./pages/Configuracoes";
import Ovos from "./pages/Ovos";
import Diagnostico from "./pages/Diagnostico";
import DiagnosticoPrint from "./pages/DiagnosticoPrint";
import Radar from "./pages/Radar";
import { useEffect } from "react";

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login">{() => { window.location.href = "/login"; return null; }}</Route>
      <Route path="/register">{() => { window.location.href = "/register"; return null; }}</Route>
      <Route path="/" component={Dashboard} />
      <Route path="/campanhas" component={Campanhas} />
      <Route path="/campanhas/:id" component={CampanhaDetalhe} />
      <Route path="/criativos/:id" component={CriativoEditor} />
      <Route path="/criativos" component={Criativos} />
      <Route path="/metricas" component={Metricas} />
      <Route path="/recalibracao" component={Recalibracao} />
      <Route path="/biblioteca" component={Biblioteca} />
      <Route path="/integracoes" component={Integracoes} />
      <Route path="/diagnostico/relatorio" component={DiagnosticoPrint} />
      <Route path="/diagnostico" component={Diagnostico} />
      <Route path="/radar" component={Radar} />
      <Route path="/estudio" component={Estudio} />
      <Route path="/aprovacao" component={Aprovacao} />
      <Route path="/ovos" component={Ovos} />
      <Route path="/notificacoes" component={Notificacoes} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/creditos" component={Creditos} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/" component={AdminDashboard} />
      <Route path="/revisao" component={AdminRevisao} />
      <Route path="/financeiro" component={AdminFinanceiro} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const path = window.location.pathname;
  const isApp = path.startsWith("/app");
  const isAdmin = path.startsWith("/admin");

  useEffect(() => {
    const cleanPath = window.location.pathname;
    if (cleanPath === "/login") document.title = "Entrar | Cacarejar";
    else if (cleanPath === "/register") document.title = "Criar conta | Cacarejar";
    else if (cleanPath.startsWith("/admin")) document.title = "Admin | Cacarejar";
    else if (!cleanPath.startsWith("/app")) document.title = "Cacarejar | Marketing com Agentes Exclusivos";
  }, [path]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          {isAdmin ? (
            <Router base="/admin">
              <AdminRouter />
            </Router>
          ) : isApp ? (
            <Router base="/app">
              <AppRouter />
            </Router>
          ) : (
            <Router base="">
              <PublicRouter />
            </Router>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
