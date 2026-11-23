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
  Cpu,
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
import {
  cacheLocalModelsForOffline,
  getLocalVisionStatus,
  LocalAiModelStatus,
  warmUpLocalVisionModels,
} from "@/lib/local-onnx";
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
  const [localAiStatus, setLocalAiStatus] = useState<LocalAiModelStatus>("idle");
  const [aiCachedOffline, setAiCachedOffline] = useState(false);

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

  useEffect(() => {
    setLocalAiStatus(getLocalVisionStatus());
    if (typeof caches !== "undefined") {
      caches
        .match("/models/identifier.onnx")
        .then((hit) => setAiCachedOffline(Boolean(hit)))
        .catch(() => {});
    }
  }, []);

  const handlePrepareOfflineAi = async () => {
    setLocalAiStatus("loading");
    const cached = await cacheLocalModelsForOffline();
    const warmed = await warmUpLocalVisionModels();
    setAiCachedOffline(cached || warmed);
    if (warmed) {
      setLocalAiStatus("ready");
      toast("Modo offline pronto para capturas sem sinal.", "success");
    } else {
      setLocalAiStatus("unavailable");
      toast("Não foi possível preparar o modo offline neste navegador.", "error");
    }
  };

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
              <h2 className="text-sm font-bold text-theme-primary">Dados da conta</h2>
            </div>

            <div>
              <label htmlFor="profile-name" className="field-label">
                Nome completo
              </label>
              <input
                id="profile-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">
                E-mail de acesso
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="field-input opacity-70 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary w-full text-xs sm:text-sm"
            >
              {savingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar nome</span>
            </button>
          </form>

          {/* Formulário: Alterar Senha */}
          <form onSubmit={handleChangePassword} className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-theme-primary">Segurança e senha</h2>
            </div>

            <div>
              <label htmlFor="cur-pass" className="field-label">
                Senha atual
              </label>
              <input
                id="cur-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="field-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-pass" className="field-label">
                  Nova senha
                </label>
                <input
                  id="new-pass"
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="conf-pass" className="field-label">
                  Confirmar senha
                </label>
                <input
                  id="conf-pass"
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="field-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-secondary w-full text-xs sm:text-sm"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              <span>Atualizar senha</span>
            </button>
          </form>
        </div>

        {/* Hardware, Aparência e Administração */}
        <section className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-theme-primary">Preferências e equipamento</h2>

          <div className="divide-y divide-[var(--border-subtle)]">
            {/* Tema */}
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[10px] bg-theme-surface-2 border border-theme flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4 text-theme-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                    Tema visual
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    Alterna entre modo claro de campo e modo escuro.
                  </p>
                </div>
              </div>
              <ThemeToggle />
            </div>

            {/* Leitor Bluetooth */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
                    bleStatus === "connected"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
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
                    Leitor de brinco Bluetooth
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    {!bleSupported
                      ? "Navegador sem suporte a leitura direta por Bluetooth."
                      : bleStatus === "connected"
                      ? `Conectado a ${bleDeviceName || "leitor"}`
                      : "Nenhum leitor pareado no momento."}
                  </p>
                </div>
              </div>

              {bleSupported && (
                <button
                  type="button"
                  onClick={handleBleToggle}
                  disabled={bleStatus === "connecting"}
                  className={`${
                    bleStatus === "connected" ? "btn-secondary" : "btn-primary"
                  } !py-2 !px-3 !min-h-[36px] text-xs`}
                >
                  {bleStatus === "connecting" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bluetooth className="w-3.5 h-3.5" />
                  )}
                  <span>{bleStatus === "connected" ? "Desconectar" : "Parear leitor"}</span>
                </button>
              )}
            </div>

            {/* Modo Offline da Câmera */}
            <div className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${
                    localAiStatus === "ready" || aiCachedOffline
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-theme-surface-2 border-theme text-theme-secondary"
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                    Modo offline da câmera
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    {localAiStatus === "ready"
                      ? "Ativo neste aparelho · Funciona sem internet."
                      : aiCachedOffline
                      ? "Recursos salvos no aparelho para trabalho sem sinal."
                      : "Baixa os recursos para guiar a captura mesmo sem internet."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrepareOfflineAi}
                disabled={localAiStatus === "loading"}
                className={`${
                  localAiStatus === "ready" ? "btn-secondary" : "btn-primary"
                } !py-2 !px-3 !min-h-[36px] text-xs`}
              >
                {localAiStatus === "loading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5" />
                )}
                <span>{localAiStatus === "ready" ? "Offline pronto" : "Preparar offline"}</span>
              </button>
            </div>

            {/* Painel de Gestão */}
            {isAdmin && (
              <div className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[10px] bg-theme-surface-2 border border-theme flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-theme-primary">
                      Central de Gestão
                    </p>
                    <p className="text-[11px] text-theme-secondary">
                      Gerenciar operadores, usuários e todo o banco de capturas.
                    </p>
                  </div>
                </div>
                <Link href="/admin" className="btn-secondary !py-2 !px-3 !min-h-[36px] text-xs">
                  Abrir gestão
                </Link>
              </div>
            )}

            {/* Instalação App */}
            <div className="pt-3 flex items-center justify-between gap-3 empty:hidden">
              <PwaInstallPrompt variant="banner" className="w-full" />
            </div>
          </div>
        </section>

        {/* Encerrar Sessão */}
        <section className="card p-5 border-red-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-theme-primary">Sair da conta</h2>
            <p className="text-xs text-theme-secondary mt-0.5">
              Encerra sua sessão neste aparelho mantendo seus dados protegidos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-danger !py-2.5 !px-4 text-xs sm:text-sm shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta</span>
          </button>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}
