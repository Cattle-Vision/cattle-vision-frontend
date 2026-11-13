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
    <header className="glass-header sticky top-0 z-30 border-b border-theme bg-theme-surface/92 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-3">
        {/* Lado Esquerdo: Identidade / Botão Voltar */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-theme-primary bg-theme-surface-2 hover:bg-theme-surface border border-theme active:scale-95 transition touch-manipulation shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-lg bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white shrink-0 hover:bg-emerald-700 dark:hover:bg-emerald-400 transition active:scale-95"
              aria-label="Ir para o painel principal"
            >
              <Activity className="w-4.5 h-4.5 stroke-[2.2]" />
            </Link>
          )}

          <div className="min-w-0">
            {title ? (
              <div className="text-sm sm:text-[15px] font-bold text-theme-primary truncate tracking-tight">
                {title}
              </div>
            ) : (
              <Link href="/dashboard" className="block min-w-0">
                <span className="font-bold text-base sm:text-[17px] tracking-tight text-theme-primary">
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

        {/* Centro (Desktop): Navegação Principal */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              pathname === "/dashboard"
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Rebanho</span>
          </Link>

          <Link
            href="/identify"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              pathname.startsWith("/identify")
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>Identificar</span>
          </Link>

          <Link
            href="/animal/new"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              pathname === "/animal/new"
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cadastrar</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                pathname.startsWith("/admin")
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Lado Direito: Operador, PWA, Tema e Sair */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}

          {user?.name && (
            <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-md bg-theme-surface-2 border border-theme text-[11px] font-medium text-theme-secondary max-w-[140px] truncate">
              {user.name}
            </span>
          )}

          <div className="hidden sm:block">
            <PwaInstallPrompt variant="button" />
          </div>
          <div className="sm:hidden">
            <PwaInstallPrompt variant="icon" />
          </div>

          <ThemeToggle />

          <button
            type="button"
            onClick={handleLogout}
            title={`Sair da conta (${user?.name || "Operador"})`}
            aria-label="Sair da conta"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-theme-secondary hover:text-red-600 dark:hover:text-red-400 bg-theme-surface-2 hover:bg-red-500/10 border border-theme hover:border-red-500/30 active:scale-95 transition touch-manipulation shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
