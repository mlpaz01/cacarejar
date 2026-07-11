import { BrandLogo } from "@/components/BrandLogo";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

const benefits = [
  "Diagnostico gratuito do perfil ativo",
  "30 CC de boas-vindas para testar os Agentes",
  "Radar de mercado antes da criacao",
  "Estudio para editar posts, imagens e videos",
  "Publicacao assistida com registro de resultado",
  "Creditos avulsos via PIX, sem assinatura obrigatoria",
];

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen bg-[#f7f9fc] text-[#071b44]"
      style={{ fontFamily: "Inter, Arial, sans-serif" }}
    >
      <header className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <BrandLogo size="md" theme="light" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/login")}
            className="text-sm font-black text-[#071b44]"
          >
            Entrar
          </button>
          <button
            onClick={() => setLocation("/register")}
            className="rounded-xl bg-[#ff3217] px-4 py-2.5 text-sm font-black text-white"
          >
            Diagnostico gratis + 30 CC
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <p className="text-xs font-black uppercase tracking-widest text-[#ff3217]">
          Agentes autonomos de marketing
        </p>
        <h1 className="mt-4 text-5xl font-black leading-tight">
          Diagnostico, Radar e Estudio para publicar com mais clareza.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-semibold text-[#61708a] leading-relaxed">
          O Cacarejar le seu perfil, organiza referencias reais e ajuda voce a
          criar conteudo editavel com toque humano antes de publicar. A conta
          gratis inclui diagnostico e 30 CC de boas-vindas.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setLocation("/register")}
            className="rounded-xl bg-[#ff3217] px-6 py-3 text-sm font-black text-white inline-flex items-center justify-center gap-2"
          >
            Fazer diagnostico gratis + 30 CC <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { window.location.href = "/precos"; }}
            className="rounded-xl border border-[#dbe3f0] bg-white px-6 py-3 text-sm font-black text-[#071b44]"
          >
            Ver creditos
          </button>
        </div>

        <section className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-3 text-left">
          {benefits.map(item => (
            <div
              key={item}
              className="rounded-2xl border border-[#e6ebf3] bg-white p-4 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-[#18b85c]" />
              <p className="mt-3 text-sm font-black text-[#071b44]">{item}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
