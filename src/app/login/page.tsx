"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ArrowLeft, Lock, Mail, AlertTriangle, Check } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "E-mail ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex bg-theme-bg text-theme-primary">
      {/* Lateral Institucional (Desktop) */}
      <div className="hidden lg:flex w-[400px] xl:w-[440px] flex-col justify-between p-10 bg-[#0F1714] text-white border-r border-emerald-950/60">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandMark className="w-9 h-9" />
            <span className="font-bold text-xl tracking-tight">
              Cattle<span className="text-emerald-400">Vision</span>
            </span>
          </Link>

          <div className="mt-14">
            <span className="text-xs font-semibold text-emerald-400 block mb-3">
              Acesso ao sistema
            </span>
            <h1 className="text-2xl xl:text-3xl font-bold leading-tight tracking-tight">
              Controle completo do rebanho em campo e no escritório.
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Acesse as fichas do lote, faça capturas guiadas e acompanhe o escore corporal (ICS)
              de cada animal.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-6 border-t border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Busca por apelido, brinco ou leitor Bluetooth</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Avaliação corporal na escala de 1,0 a 5,0</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Sincronização automática quando offline</span>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex flex-col justify-center items-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-secondary hover:text-theme-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Início</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <div className="lg:hidden flex items-center gap-2">
                <BrandMark className="w-7 h-7" />
                <span className="font-bold text-sm text-theme-primary">
                  Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="card p-6 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-bold text-theme-primary tracking-tight mb-1">
              Entrar na conta
            </h2>
            <p className="text-xs sm:text-sm text-theme-secondary mb-5">
              Informe seu e-mail e senha para gerenciar o rebanho.
            </p>

            {error && (
              <div className="error-banner mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label" htmlFor="email">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input pl-10"
                    placeholder="seu@email.com"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="password">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input pl-10 pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary p-1"
                    tabIndex={-1}
                    aria-label="Mostrar ou ocultar senha"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-sm sm:text-base mt-1"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? "Entrando…" : "Entrar"}</span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-theme text-center">
              <p className="text-sm text-theme-secondary">
                Ainda não tem conta?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Criar cadastro
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
