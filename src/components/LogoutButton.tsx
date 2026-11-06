"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/Toast";

export function LogoutButton() {
  const { logout } = useAuth();
  const { confirm } = useToast();

  const handleLogout = async () => {
    const ok = await confirm({
      title: "Desconectar Sessão",
      message: "Deseja realmente sair da sua conta?",
      confirmText: "Sair",
      cancelText: "Permanecer",
      variant: "danger",
    });
    if (ok) {
      logout();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      title="Sair"
      aria-label="Sair da conta"
      className="p-2 rounded-md border border-theme bg-theme-surface hover:bg-theme-surface-2 text-theme-muted hover:text-red-500 transition min-w-[38px] min-h-[38px] inline-flex items-center justify-center touch-manipulation"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}
