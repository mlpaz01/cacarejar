import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async data => {
      await utils.auth.me.invalidate();
      if (data.role === "superadmin") {
        window.location.href = "/admin/";
      } else {
        window.location.href = "/app/";
      }
    },
    onError: err => {
      setError(err.message || "Credenciais inválidas");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

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

        <div>
          <h2 className="text-[22px] font-black leading-snug mb-4">
            <span className="whitespace-nowrap">Não basta botar o ovo.</span><br />
            <span style={{ color: "#ff3217" }}>Tem que cacarejar.</span>
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Crie campanhas, gerencie criativos e otimize seus resultados com inteligência artificial.
          </p>
        </div>

        <p className="text-xs text-white/30">© 2026 cacarejar.com.br</p>
      </div>

      {/* Painel direito — branco */}
      <div className="flex-1 flex items-center justify-center bg-[#f7f9fc] p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <BrandLogo size="md" theme="light" />
          </div>

          <div className="bg-white rounded-xl border border-[#e6ebf3] p-8 shadow-sm">
            <h1 className="text-2xl font-black mb-1" style={{ color: "#070b17" }}>
              Entrar
            </h1>
            <p className="text-sm mb-6" style={{ color: "#61708a" }}>
              Acesse sua conta para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold" style={{ color: "#22304b" }}>
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="border-[#e6ebf3] bg-[#f7f9fc] focus:border-[#ff3217] focus:ring-[#ff3217]/20 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold" style={{ color: "#22304b" }}>
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="border-[#e6ebf3] bg-[#f7f9fc] focus:border-[#ff3217] focus:ring-[#ff3217]/20 h-11"
                />
              </div>

              {error && (
                <p className="text-sm text-center font-semibold" style={{ color: "#ff3217" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-12 rounded-lg font-black text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg, #ff421f, #f0200d)",
                  boxShadow: "0 8px 20px rgba(255, 49, 22, .25)",
                }}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>

            <p className="text-center text-sm mt-5" style={{ color: "#61708a" }}>
              Não tem conta?{" "}
              <button
                type="button"
                className="font-bold hover:underline"
                style={{ color: "#ff3217" }}
                onClick={() => { window.location.href = "/register"; }}
              >
                Criar conta grátis
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
