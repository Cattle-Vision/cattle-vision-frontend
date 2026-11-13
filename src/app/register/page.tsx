"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, User, Mail, Lock, Eye, EyeOff, Activity, AlertTriangle, Check } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await register(name, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex bg-theme-bg text-theme-primary">
      {/* Painel lateral */}
      <div className="hidden lg:flex w-[400px] xl:w-[440px] flex-col justify-between p-10 bg-[#10161D] text-white border-r border-slate-800">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Activity className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              Cattle<span className="text-emerald-400">Vision</span>
            </span>
          </Link>

          <div className="mt-14">
            <p className="font-mono-tag text-[11px] uppercase tracking-wider text-emerald-400 mb-3">
              Cadastro de Operador
            </p>
            <h1 className="text-2xl xl:text-3xl font-bold leading-tight tracking-tight">
              Organize o rebanho e registre capturas padronizadas em campo.
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Crie sua conta para cadastrar animais, capturar fotos da região posterior com mira
              guiada e compartilhar fichas com sua equipe.
            </p>
          </div>
        </div>

        <div className="space-y-2.5 pt-6 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Cadastro por brinco, raça, idade e tag RFID</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Galeria histórica com qualidade de enquadramento</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Guarda compartilhada por animal</span>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex flex-col justify-center items-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-theme-secondary hover:text-theme-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              Início
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white">
                  <Activity className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="font-bold text-sm text-theme-primary">
                  Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
                </span>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="card p-5 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-bold text-theme-primary tracking-tight mb-1">
              Criar nova conta
            </h2>
            <p className="text-xs sm:text-sm text-theme-secondary mb-5">
              Preencha seus dados para gerenciar seu rebanho e realizar avaliações zootécnicas.
            </p>

            {error && (
              <div className="error-banner mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              <div>
                <label className="field-label" htmlFor="reg-name">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field-input pl-10"
                    placeholder="João da Silva"
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="reg-email">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field-input pl-10"
                    placeholder="seu@email.com"
                    inputMode="email"
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="reg-password">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input pl-10 pr-10"
                    placeholder="Mínimo de 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-primary p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-base mt-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Criando conta…" : "Concluir Cadastro"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-theme text-center">
              <p className="text-sm text-theme-secondary">
                Já possui uma conta?{" "}
                <Link
                  href="/login"
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
