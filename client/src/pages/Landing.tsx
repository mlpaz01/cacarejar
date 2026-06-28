import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import {
  BarChart3,
  Megaphone,
  ImageIcon,
  Zap,
  Globe,
  BrainCircuit,
  Check,
  ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";

const FEATURES = [
  {
    icon: Megaphone,
    title: "Gestão de Campanhas",
    desc: "Crie, agende e monitore campanhas em múltiplos canais de uma só plataforma.",
  },
  {
    icon: ImageIcon,
    title: "Biblioteca de Criativos",
    desc: "Organize imagens, copy e assets. Vincule criativos às campanhas com um clique.",
  },
  {
    icon: BarChart3,
    title: "Métricas em Tempo Real",
    desc: "ROI, CTR, CPC e conversões em dashboards visuais. Tome decisões com dados.",
  },
  {
    icon: BrainCircuit,
    title: "Recalibração com Agentes",
    desc: "Análise automática de desempenho com sugestões práticas geradas pelos Agentes.",
  },
  {
    icon: Globe,
    title: "Multi-canal",
    desc: "LinkedIn, Instagram, TikTok e Google Ads conectados em um só lugar.",
  },
  {
    icon: Zap,
    title: "Disparo Automático",
    desc: "Programe campanhas para dispararem no melhor horário, sem intervenção manual.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    highlight: false,
    features: [
      "1 campanha ativa",
      "50 criativos",
      "Métricas básicas",
      "Suporte por e-mail",
    ],
    cta: "Começar grátis",
  },
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    highlight: true,
    features: [
      "5 campanhas ativas",
      "500 criativos",
      "Métricas avançadas",
      "Recalibração com Agentes",
      "Suporte prioritário",
    ],
    cta: "Assinar Starter",
  },
  {
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    highlight: false,
    features: [
      "Campanhas ilimitadas",
      "Criativos ilimitados",
      "Todos os módulos",
      "API de integração",
      "Suporte dedicado",
    ],
    cta: "Assinar Pro",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 sticky top-0 z-50 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <BrandLogo size="sm" theme="light" />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
            >
              Entrar
            </Button>
            <Button size="sm" onClick={() => setLocation("/register")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
        <Badge variant="secondary" className="mb-6">
          Motor de marketing para pequenas e médias empresas
        </Badge>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight mb-6">
          Marketing digital que{" "}
          <span className="text-primary">realmente funciona</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Gerencie campanhas, criativos e métricas em múltiplos canais. Com
          Agentes autônomos para otimizar seu ROI automaticamente.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => setLocation("/register")}>
            Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setLocation("/login")}
          >
            Já tenho conta
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Tudo que você precisa
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <Card
              key={f.title}
              className="border-border/50 hover:border-primary/40 transition-colors"
            >
              <CardHeader>
                <f.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          Planos simples e transparentes
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Comece grátis. Faça upgrade quando precisar de mais.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PLANS.map(plan => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-border/50"
              }`}
            >
              {plan.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4">
                  Mais popular
                </Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : "outline"}
                  onClick={() => setLocation("/register")}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>© 2024 cacarejar.com.br — Motor de Marketing Digital</p>
      </footer>
    </div>
  );
}
