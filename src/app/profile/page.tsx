"use client";

/**
 * Página de Perfil e Configurações do Operador (`src/app/profile/page.tsx`).
 *
 * Centraliza dados cadastrais, alteração de nome/senha, tema visual,
 * status do leitor RFID Bluetooth, fila offline e saída da conta —
 * mantendo o cabeçalho global limpo em telas móveis e desktop.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Mail,
  ShieldCheck,
  KeyRound,
  LogOut,
  Save,
  Loader2,
  Bluetooth,
  BluetoothConnected,
  WifiOff,
  Check,
  AlertTriangle,
  Images,
  Beef,
  Palette,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  apiFetch,
  apiFetchCached,
  getApiCacheSnapshot,
  setCachedUser,
  setStoredToken,
} from "@/lib/api";
import { Animal, User } from "@/lib/types";
import { getSyncQueue } from "@/lib/sync";
import { bluetoothRfid, BluetoothStatus } from "@/lib/bluetooth-rfid";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";
import ThemeToggle from "@/components/ThemeToggle";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, isAdmin, logout, refreshSession } = useAuth();
  const { toast, confirm } = useToast();

  // Edição de nome
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Alteração de senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Métricas locais e Bluetooth
  const [herdStats, setHerdStats] = useState({ animals: 0, photos: 0 });
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [bleStatus, setBleStatus] = useState<BluetoothStatus>("disconnected");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [bleSupported, setBleSupported] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const cached = getApiCacheSnapshot<Animal[]>("/api/animals?summary=1");
    if (Array.isArray(cached)) {
      const photos = cached.reduce(
        (acc, a) => acc + (a.photoCount ?? a.photos?.length ?? 0),
        0
      );
      setHerdStats({ animals: cached.length, photos });
    }

    apiFetchCached<Animal[]>("/api/animals?summary=1", 15000)
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        const photos = list.reduce(
          (acc, a) => acc + (a.photoCount ?? a.photos?.length ?? 0),
          0
        );
        setHerdStats({ animals: list.length, photos });
      })
      .catch(() => {});

    getSyncQueue()
      .then((q) => setPendingSyncCount(q.length))
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    setBleSupported(bluetoothRfid.isSupported());
    setBleStatus(bluetoothRfid.getStatus());
    setBleDeviceName(bluetoothRfid.getDeviceName());

    const unsub = bluetoothRfid.onStatusChange((status, devName) => {
      setBleStatus(status);
      if (devName) setBleDeviceName(devName);
    });
    return () => unsub();
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFeedback({ type: "error", text: "O nome deve ter pelo menos 2 caracteres." });
      return;
    }

    setSavingProfile(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ user: User; token?: string; message?: string }>(
        "/api/auth/me",
        {
          method: "PATCH",
          body: { name: trimmed },
        }
      );
      if (res.token) setStoredToken(res.token);
      if (res.user) setCachedUser(res.user);
      await refreshSession();
      toast("Nome atualizado com sucesso.", "success");
      setFeedback({ type: "success", text: "Dados cadastrais atualizados." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao atualizar nome." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword || !newPassword) {
      setFeedback({ type: "error", text: "Preencha a senha atual e a nova senha." });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: "error", text: "A nova senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "A confirmação não confere com a nova senha." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await apiFetch<{ user: User; token?: string }>("/api/auth/me", {
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      if (res.token) setStoredToken(res.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Senha alterada com sucesso.", "success");
      setFeedback({ type: "success", text: "Senha atualizada com segurança." });
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Erro ao alterar senha." });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleBleToggle = async () => {
    if (bleStatus === "connected") {
      bluetoothRfid.disconnect();
      toast("Leitor Bluetooth desconectado.", "info");
      return;
    }
    await bluetoothRfid.connect();
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

  const initials = (user?.name || "OP")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  if (authLoading || (!isAuthenticated && typeof window !== "undefined")) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-theme-bg">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary pb-24 sm:pb-12">
      <AppHeader
        title="Perfil do Operador"
        subtitle={user?.email}
        showBack
        backHref="/dashboard"
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-3 sm:px-6 py-5 space-y-5">
        {/* Cartão Principal do Operador */}
        <section className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
              {initials || <UserIcon className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-theme-primary truncate">
                  {user?.name || "Operador"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                    isAdmin
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                  }`}
                >
                  {isAdmin ? "Administrador" : "Operador"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-theme-secondary flex items-center gap-1.5 truncate mt-0.5">
                <Mail className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                {user?.email}
              </p>
              {memberSince && (
                <p className="text-[11px] text-theme-muted mt-1">
                  Conta ativa desde {memberSince}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-auto shrink-0">
            <div className="px-3 py-2 rounded-lg bg-theme-surface-2 border border-theme text-center">
              <Beef className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mx-auto mb-0.5" />
              <p className="text-sm font-bold tabular-nums text-theme-primary">{herdStats.animals}</p>
              <p className="text-[10px] text-theme-muted">Animais</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-theme-surface-2 border border-theme text-center">
              <Images className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mx-auto mb-0.5" />
              <p className="text-sm font-bold tabular-nums text-theme-primary">{herdStats.photos}</p>
              <p className="text-[10px] text-theme-muted">Fotos</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-theme-surface-2 border border-theme text-center">
              <WifiOff className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
              <p className="text-sm font-bold tabular-nums text-theme-primary">{pendingSyncCount}</p>
              <p className="text-[10px] text-theme-muted">Fila offline</p>
            </div>
          </div>
        </section>

        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 font-medium ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Formulário: Nome do Operador */}
          <form onSubmit={handleSaveName} className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-theme-primary">Dados da Conta</h2>
            </div>

            <div>
              <label htmlFor="profile-name" className="block text-xs font-semibold text-theme-secondary mb-1.5">
                Nome completo
              </label>
              <input
                id="profile-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-secondary mb-1.5">
                E-mail de acesso
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="input-field opacity-70 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary w-full py-2.5 text-xs sm:text-sm"
            >
              {savingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Nome
            </button>
          </form>

          {/* Formulário: Alterar Senha */}
          <form onSubmit={handleChangePassword} className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-theme-primary">Segurança e Senha</h2>
            </div>

            <div>
              <label htmlFor="cur-pass" className="block text-xs font-semibold text-theme-secondary mb-1.5">
                Senha atual
              </label>
              <input
                id="cur-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-pass" className="block text-xs font-semibold text-theme-secondary mb-1.5">
                  Nova senha
                </label>
                <input
                  id="new-pass"
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="conf-pass" className="block text-xs font-semibold text-theme-secondary mb-1.5">
                  Confirmar senha
                </label>
                <input
                  id="conf-pass"
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="input-field"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-secondary w-full py-2.5 text-xs sm:text-sm"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Atualizar Senha
            </button>
          </form>
        </div>

        {/* Hardware, Aparência e Administração */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-theme-primary">Preferências e Equipamento</h2>

          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Tema */}
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-theme-surface-2 border border-theme flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4 text-theme-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                    Tema de exibição
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    Alterna entre modo claro de campo e escuro noturno.
                  </p>
                </div>
              </div>
              <ThemeToggle />
            </div>

            {/* Leitor Bluetooth RFID */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                    bleStatus === "connected"
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400"
                      : "bg-theme-surface-2 border-theme text-theme-secondary"
                  }`}
                >
                  {bleStatus === "connected" ? (
                    <BluetoothConnected className="w-4 h-4" />
                  ) : (
                    <Bluetooth className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                    Leitor RFID Bluetooth (ESP32)
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    {!bleSupported
                      ? "Web Bluetooth indisponível neste navegador (use Chrome/Edge)."
                      : bleStatus === "connected"
                      ? `Conectado a ${bleDeviceName || "CattleVision-RFID"}`
                      : "Nenhum bastão RFID pareado nesta sessão."}
                  </p>
                </div>
              </div>

              {bleSupported && (
                <button
                  type="button"
                  onClick={handleBleToggle}
                  disabled={bleStatus === "connecting"}
                  className={
                    bleStatus === "connected"
                      ? "btn-secondary py-2 px-3 min-h-[36px] text-xs"
                      : "btn-primary py-2 px-3 min-h-[36px] text-xs"
                  }
                >
                  {bleStatus === "connecting" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bluetooth className="w-3.5 h-3.5" />
                  )}
                  {bleStatus === "connected" ? "Desconectar" : "Parear Bastão"}
                </button>
              )}
            </div>

            {/* Painel Admin */}
            {isAdmin && (
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                      Administração do Sistema
                    </p>
                    <p className="text-[11px] text-theme-secondary">
                      Gerenciar operadores, usuários e banco fotográfico.
                    </p>
                  </div>
                </div>
                <Link href="/admin" className="btn-secondary py-2 px-3 min-h-[36px] text-xs">
                  Abrir Admin
                </Link>
              </div>
            )}

            {/* Instalação PWA */}
            <div className="pt-3 flex items-center justify-between gap-3 empty:hidden">
              <PwaInstallPrompt variant="banner" className="w-full" />
            </div>
          </div>
        </section>

        {/* Encerrar Sessão */}
        <section className="card p-5 border-red-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-theme-primary">Sessão do Operador</h2>
            <p className="text-xs text-theme-secondary mt-0.5">
              Encerra o acesso autenticado neste aparelho mantendo os dados salvos no servidor.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition active:scale-[0.98] shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
