"use client";

/**
 * Botão Alternador de Tema Claro / Escuro (`src/components/ThemeToggle.tsx`).
 */
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? theme === "dark" : false;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
      className={`p-2 rounded-xl border border-theme bg-theme-surface hover:bg-theme-surface-2 text-theme-secondary hover:text-theme-primary transition active:scale-95 shrink-0 inline-flex items-center justify-center min-w-[38px] min-h-[38px] touch-manipulation ${className}`}
    >
      {isDark ? (
        <Sun className="w-4.5 h-4.5 text-amber-400 stroke-[2.2]" />
      ) : (
        <Moon className="w-4.5 h-4.5 text-slate-700 stroke-[2.2]" />
      )}
    </button>
  );
}

export default ThemeToggle;
