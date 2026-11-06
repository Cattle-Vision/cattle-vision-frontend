"use client";

/**
 * Barra de Navegação Inferior Mobile/Tablet (`src/components/MobileNav.tsx`).
 * Otimizada para ergonomia do operador com touch targets generosos (mínimo 48px).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ScanLine, PlusCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function MobileNav({ isAdmin: propIsAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { isAdmin: authIsAdmin, isAuthenticated } = useAuth();
  const isAdmin = propIsAdmin ?? authIsAdmin;

  if (!isAuthenticated) return null;

  // Não exibe a barra na tela da câmera (para liberar 100% da viewport para o viewfinder)
  if (pathname.startsWith("/camera")) return null;

  const items = [
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
            label: "Admin",
            icon: ShieldCheck,
            active: pathname.startsWith("/admin"),
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Navegação principal mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-header border-t border-theme bg-theme-surface/95 backdrop-blur-md px-2 pt-1.5 flex items-center justify-center shadow-lg"
      style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-lg flex items-center justify-around gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-h-[52px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all active:scale-95 touch-manipulation select-none ${
                item.active
                  ? "text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10"
                  : "text-theme-secondary hover:text-theme-primary font-medium"
              }`}
            >
              <Icon className={`w-5 h-5 ${item.active ? "stroke-[2.4]" : "stroke-[1.8]"}`} />
              <span className="text-[11px] mt-1 tracking-tight leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
