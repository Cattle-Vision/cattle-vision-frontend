"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ScanLine,
  ArrowLeft,
  LayoutGrid,
  PlusCircle,
  ShieldCheck,
  LogOut,
  Activity,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/Toast";
import ThemeToggle from "@/components/ThemeToggle";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export interface AppHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  backHref,
  onBack,
  actions,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { confirm } = useToast();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Desconectar Sessão",
      message: "Deseja realmente sair da sua conta no CattleVision?",
      confirmText: "Sair da Conta",
      cancelText: "Continuar Logado",
      variant: "danger",
    });
    if (ok) {
      logout();
    }
  };

  return (
    <header className="glass-header sticky top-0 z-30 border-b border-theme bg-theme-surface/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Lado Esquerdo: Identidade / Botão Voltar */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-theme-primary bg-theme-surface-2 hover:bg-theme-surface border border-theme active:scale-95 transition touch-manipulation shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-xs hover:opacity-95 transition active:scale-95"
              aria-label="Ir para o painel principal"
            >
              <Activity className="w-5 h-5 stroke-[2.2]" />
            </Link>
          )}

          <div className="min-w-0">
            {title ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-theme-primary truncate">
                  {title}
                </div>
              </div>
            ) : (
              <Link href="/dashboard" className="block min-w-0">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-theme-primary">
                  Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
                </span>
              </Link>
            )}

            {subtitle && (
              <div className="text-[11px] sm:text-xs text-theme-secondary truncate leading-tight mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Centro (Desktop): Links diretos para agilidade (no mobile estão no Bottom Nav) */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              pathname === "/dashboard"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Rebanho</span>
          </Link>

          <Link
            href="/identify"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              pathname.startsWith("/identify")
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>Identificar</span>
          </Link>

          <Link
            href="/animal/new"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              pathname === "/animal/new"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cadastrar</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                pathname.startsWith("/admin")
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Lado Direito: Ações da Página, PWA, Tema e Botão Sair Sempre Visível */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}

          {/* Botão de Instalação PWA: ícone no mobile, botão com texto no desktop */}
          <div className="hidden sm:block">
            <PwaInstallPrompt variant="button" />
          </div>
          <div className="sm:hidden">
            <PwaInstallPrompt variant="icon" />
          </div>

          <ThemeToggle />

          {/* Botão Sair — Garantido dentro da tela, nunca ultrapassa o limite da viewport */}
          <button
            type="button"
            onClick={handleLogout}
            title={`Sair da conta (${user?.name || "Operador"})`}
            aria-label="Sair da conta"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 active:scale-95 transition touch-manipulation shrink-0"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
