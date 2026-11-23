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
 * Cabeçalho global enxuto e padronizado (`src/components/AppHeader.tsx`).
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

  const navItems = [
    {
      href: "/dashboard",
      label: "Rebanho",
      icon: LayoutGrid,
      active: pathname === "/dashboard",
    },
    {
      href: "/identify",
      label: "Identificar",
      icon: ScanLine,
      active: pathname.startsWith("/identify"),
    },
    {
      href: "/animal/new",
      label: "Cadastrar",
      icon: PlusCircle,
      active: pathname === "/animal/new",
    },
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: "Gestão",
            icon: ShieldCheck,
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
  ];

  return (
    <header className="glass-header sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Esquerda: Voltar ou Marca */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar"
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-theme-primary bg-theme-surface-2 hover:bg-theme-surface border border-theme active:scale-95 transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex items-center shrink-0 rounded-[10px] active:scale-95 transition"
              aria-label="Ir para o painel do rebanho"
            >
              <BrandMark className="w-9 h-9" />
            </Link>
          )}

          <div className="min-w-0">
            {title ? (
              <div className="text-sm sm:text-[15px] font-bold text-theme-primary truncate tracking-tight leading-tight">
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

        {/* Centro (Desktop apenas) */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-[10px] text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                  item.active
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-2"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Direita: Ações da tela, Tema e Perfil */}
        <div className="flex items-center gap-2 shrink-0">
          {actions}

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Link
            href="/profile"
            aria-label={`Abrir perfil (${user?.name || "Operador"})`}
            title={`Perfil e configurações (${user?.name || "Operador"})`}
            className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-[10px] border text-xs font-semibold transition active:scale-95 shrink-0 ${
              isProfileActive
                ? "bg-emerald-500/12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-theme-surface-2 border-theme text-theme-primary hover:border-emerald-500/40"
            }`}
          >
            <span className="w-6 h-6 rounded-[7px] bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
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
