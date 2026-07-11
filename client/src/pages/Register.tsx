import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, Check } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const BENEFITS = [
  "Raio-X gratuito do perfil na criação da conta",
  "Créditos avulsos via PIX — sem assinatura",
  "Agentes autônomos para criar, analisar e otimizar",
  "Suporte humano disponível",
];

export default function Register() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao criar conta");
        return;
      }
      toast.success("Conta criada! Vamos montar seu plano 🐓");
      const plano = new URLSearchParams(window.location.search).get("plano");
      window.location.href = plano ? `/app/creditos?plano=${plano}` : "/app/diagnostico";
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "Inter, Arial, sans-serif" }}
    >
      {/* Painel esquerdo — navy */}
      <div
        className="hidden lg:flex flex-col justify-between w-96 p-10 text-white flex-shrink-0"
        style={{ background: "#011643" }}
      >
        <BrandLogo size="md" theme="dark" />

        <div className="space-y-6">
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: "#ff3217" }}>
              Por que cacarejar?
            </p>
            <ul className="space-y-3">
              {BENEFITS.map(b => (
                <li key={b} className="flex items-center gap-3 text-sm font-semibold text-white/80">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "#ff3217" }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

        </div>

        <p className="text-xs text-white/30">© 2026 cacarejar.com.br</p>
      </div>

      {/* Painel direito */}
      <div className="flex-1 flex items-center justify-center bg-[#f7f9fc] p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-8">
            <BrandLogo size="md" theme="light" />
          </div>

          <div className="bg-white rounded-xl border border-[#e6ebf3] p-8 shadow-sm">
            <h1 className="text-2xl font-black mb-1" style={{ color: "#070b17" }}>
              Ver diagnóstico grátis
            </h1>
            <p className="text-sm mb-6" style={{ color: "#61708a" }}>
              Crie sua conta e comece pelo raio-X do seu perfil
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold" style={{ color: "#22304b" }}>
                  Seu nome
                </Label>
                <Input
                  placeholder="João Silva"
                  value={form.name}
                  onChange={set("name")}
                  required
                  disabled={loading}
                  className="border-[#e6ebf3] bg-[#f7f9fc] h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold" style={{ color: "#22304b" }}>
                  Nome da empresa
                </Label>
                <Input
                  placeholder="Minha Empresa"
                  value={form.companyName}
                  onChange={set("companyName")}
                  required
                  disabled={loading}
                  className="border-[#e6ebf3] bg-[#f7f9fc] h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold" style={{ color: "#22304b" }}>
                  E-mail
                </Label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={form.email}
                  onChange={set("email")}
                  required
                  disabled={loading}
                  className="border-[#e6ebf3] bg-[#f7f9fc] h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold" style={{ color: "#22304b" }}>
                  Senha
                </Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={form.password}
                  onChange={set("password")}
                  required
                  disabled={loading}
                  className="border-[#e6ebf3] bg-[#f7f9fc] h-11"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg font-black text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60 mt-2"
                style={{
                  background: "linear-gradient(180deg, #ff421f, #f0200d)",
                  boxShadow: "0 8px 20px rgba(255, 49, 22, .25)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  "Ver meu diagnóstico grátis"
                )}
              </button>
            </form>

            <p className="text-center text-sm mt-5" style={{ color: "#61708a" }}>
              Já tem conta?{" "}
              <button
                type="button"
                className="font-bold hover:underline"
                style={{ color: "#ff3217" }}
                onClick={() => setLocation("/login")}
              >
                Entrar
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
