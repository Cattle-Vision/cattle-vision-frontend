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
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import ThemeToggle from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";

export interface AppHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  showBack?: boolean;
  backHref?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

/**
 * Cabeçalho padronizado do sistema.
 * - Mantém o símbolo canônico `BrandMark` (sincronizado ao ícone PWA e favicon).
 * - Em telas menores (`< md`), omite os links principais já presentes na `MobileNav`
 *   inferior para evitar redundância visual.
 * - Centraliza o acesso ao perfil do operador, senha, tema e saída em `/profile`.
 */
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
  const { user, isAdmin } = useAuth();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || "Perfil";
  const initials = (user?.name || "OP")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const isProfileActive = pathname.startsWith("/profile");

  return (
    <header className="glass-header sticky top-0 z-30 border-b border-theme bg-theme-surface/92 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-3">
        {/* Lado Esquerdo: Identidade canônica ou Botão Voltar */}
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
              className="inline-flex items-center shrink-0 rounded-lg active:scale-95 transition"
              aria-label="Ir para o painel principal"
            >
              <BrandMark className="w-9 h-9" />
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

        {/* Centro (Desktop apenas — no mobile a navegação principal fica na MobileNav inferior) */}
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

        {/* Lado Direito: Ações contextuais da página, tema (desktop) e Perfil do Operador */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Link
            href="/profile"
            aria-label={`Abrir página de perfil (${user?.name || "Operador"})`}
            title={`Perfil e configurações (${user?.name || "Operador"})`}
            className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg border text-xs font-semibold transition active:scale-95 touch-manipulation shrink-0 ${
              isProfileActive
                ? "bg-emerald-500/12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-theme-surface-2 border-theme text-theme-primary hover:border-emerald-500/40"
            }`}
          >
            <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {initials || <UserIcon className="w-3.5 h-3.5" />}
            </span>
            <span className="hidden sm:inline max-w-[110px] truncate">{firstName}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
