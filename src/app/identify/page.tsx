"use client";

/**
 * Página de Identificação Inteligente de Animais (`src/app/identify/page.tsx`).
 *
 * Funcionalidades:
 * - Leitor RFID ESP32 via Web Bluetooth integrado diretamente na tela (sem popups intrusivos).
 * - Identificação instantânea com adesão automática à Guarda Compartilhada.
 * - Priorização máxima do Apelido do animal e ocultação de códigos RFID longos.
 * - Ferramenta de simulação e entrada manual inline para testes e dispositivos sem BLE.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Loader2,
  Camera,
  Plus,
  ChevronRight,
  Bluetooth,
  Users,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { normalizeTag } from "@/lib/animal";
import { Animal, RfidScanResult } from "@/lib/types";
import { apiFetch, scanRfidTag } from "@/lib/api";
import { bluetoothRfid, BluetoothStatus, RfidEventDetail } from "@/lib/bluetooth-rfid";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";
import { useToast } from "@/components/ui/Toast";

export default function IdentifyPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentAnimals, setRecentAnimals] = useState<Animal[]>([]);
  const [bleStatus, setBleStatus] = useState<BluetoothStatus>("disconnected");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [scanResult, setScanResult] = useState<RfidScanResult | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedTag, setSimulatedTag] = useState("");

  useEffect(() => {
    // Carrega rebanho recente
    apiFetch<Animal[]>("/api/animals")
      .then((d) => {
        if (Array.isArray(d)) setRecentAnimals(d.slice(0, 6));
      })
      .catch(() => {});

    // Monitora status Bluetooth
    setBleStatus(bluetoothRfid.getStatus());
    setBleDeviceName(bluetoothRfid.getDeviceName());

    const unsubStatus = bluetoothRfid.onStatusChange((status, name) => {
      setBleStatus(status);
      if (name) setBleDeviceName(name);
    });

    // Escuta tags lidas via ESP32 ou simulador
    const unsubTag = bluetoothRfid.onTag(async (detail: RfidEventDetail) => {
      await handleProcessRfid(detail.tag);
    });

    return () => {
      unsubStatus();
      unsubTag();
    };
  }, []);

  async function handleProcessRfid(rfidTag: string) {
    const clean = normalizeTag(rfidTag);
    if (!clean) return;

    setLoading(true);
    setError("");
    setScanResult(null);

    try {
      const res = await scanRfidTag(clean);
      setScanResult(res);

      if (res.registered && res.animal) {
        bluetoothRfid.playAudioFeedback("success");
        bluetoothRfid.triggerHaptic([80, 50, 80]);
        toast(
          res.isOwner
            ? "Vaca identificada com sucesso (Seu Rebanho)!"
            : "Vaca identificada! Guarda Compartilhada ativada com sucesso.",
          "success"
        );
      } else {
        bluetoothRfid.playAudioFeedback("alert");
        toast("Tag RFID não cadastrada. Prossiga com o cadastro.", "info");
      }
    } catch (err: any) {
      console.error("[Identify] Erro ao ler RFID:", err);
      setError(err?.message || "Falha ao consultar a tag RFID no servidor.");
      bluetoothRfid.playAudioFeedback("alert");
    } finally {
      setLoading(false);
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTag(tag);
    if (!normalized) {
      setError("Digite o código do brinco ou RFID do animal.");
      return;
    }
    await handleProcessRfid(normalized);
  };

  const handleConnectBle = async () => {
    setError("");
    const ok = await bluetoothRfid.connect();
    if (ok) {
      toast("Leitor RFID ESP32 conectado com sucesso!", "success");
    }
  };

  const handleDisconnectBle = () => {
    bluetoothRfid.disconnect();
    toast("Leitor RFID desconectado.", "info");
  };

  const handleSimulateTag = () => {
    const clean = simulatedTag.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
    if (!clean) return;
    bluetoothRfid.emitManualTag(clean, "simulation");
  };

  const generateRandomEpc = () => {
    let hex = "E280";
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < 20; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSimulatedTag(hex);
  };

  const isBleSupported = bluetoothRfid.isSupported();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary pb-20 sm:pb-8">
      <AppHeader
        showBack
        backHref="/dashboard"
        title="Identificação de Animais"
        subtitle="Leitor RFID ESP32 ou busca manual"
      />

      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-xl mx-auto flex flex-col gap-5">

          {/* Cartão de Integração Direta com o Leitor RFID ESP32 */}
          <div className="card p-5 border-2 border-emerald-500/20 bg-linear-to-b from-emerald-500/5 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  bleStatus === "connected"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : bleStatus === "connecting"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse"
                    : "bg-theme-surface-2 text-theme-secondary"
                }`}>
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-theme-primary">
                    Leitor RFID ESP32
                  </h2>
                  <p className="text-xs text-theme-secondary">
                    {bleStatus === "connected"
                      ? `Conectado: ${bleDeviceName || "CattleVision-RFID"}`
                      : bleStatus === "connecting"
                      ? "Conectando ao dispositivo..."
                      : "Pareie com o leitor portátil via Bluetooth"}
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shrink-0 ${
                bleStatus === "connected"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : bleStatus === "connecting"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-theme-surface-2 text-theme-muted border-theme"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  bleStatus === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : bleStatus === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-theme-muted"
                }`} />
                {bleStatus === "connected" ? "Pronto para Leitura" : bleStatus === "connecting" ? "Pareando..." : "Desconectado"}
              </span>
            </div>

            {bleStatus === "connected" ? (
              <div className="space-y-3 mt-2">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span>Aproxime o leitor da vaca no curral para ler a tag.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectBle}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-theme-muted hover:text-red-500 bg-theme-surface border border-theme transition shrink-0"
                  >
                    Desconectar
                  </button>
                </div>
              </div>
            ) : isBleSupported ? (
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleConnectBle}
                  disabled={bleStatus === "connecting"}
                  className="btn-primary flex-1 py-3 text-xs font-bold"
                >
                  {bleStatus === "connecting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Conectar Leitor ESP32</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSimulator(!showSimulator)}
                  className="btn-secondary py-3 px-3.5 text-xs font-semibold flex items-center justify-center gap-1 shrink-0"
                >
                  <span>Simulador de Tag</span>
                  {showSimulator ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-bold">Navegador sem suporte a Web Bluetooth nativo</p>
                <p className="text-[11px] leading-relaxed">
                  No iPhone Safari, use o navegador gratuito <strong>Bluefy</strong> ou utilize a busca manual e simulação abaixo.
                </p>
              </div>
            )}

            {/* Simulador Inline de Tag RFID (para testes rápidos ou browsers sem BLE) */}
            {(showSimulator || !isBleSupported) && (
              <div className="mt-4 pt-3.5 border-t border-theme/60 space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-secondary">
                    Simulador de Leitura RFID (Campo / Testes)
                  </span>
                  <button
                    type="button"
                    onClick={generateRandomEpc}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Gerar EPC 24-Hex
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simulatedTag}
                    onChange={(e) => setSimulatedTag(e.target.value.toUpperCase())}
                    placeholder="Ex: E2801160600002047E7A5A01"
                    className="field-input font-mono text-xs uppercase flex-1"
                  />
                  <button
                    type="button"
                    disabled={!simulatedTag.trim() || loading}
                    onClick={handleSimulateTag}
                    className="btn-secondary px-3.5 py-2 text-xs font-bold shrink-0"
                  >
                    Simular
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resultado do Scan de RFID */}
          {scanResult && (
            <div className={`card p-5 border-2 animate-in fade-in slide-in-from-top-2 duration-300 ${
              scanResult.registered
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-amber-500/40 bg-amber-500/5"
            }`}>
              {scanResult.registered && scanResult.animal ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          {scanResult.isOwner ? "Proprietário Principal" : "Guarda Compartilhada Ativada"}
                        </span>
                        {/* Apelido em Destaque */}
                        <h3 className="text-lg font-black text-theme-primary">
                          {scanResult.animal.name || "Animal Sem Apelido"}
                        </h3>
                        <p className="text-xs text-theme-secondary">
                          {scanResult.animal.breed} · {scanResult.animal.sex} · {scanResult.animal.weight} kg
                        </p>
                      </div>
                    </div>

                    {!scanResult.isOwner && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1 shrink-0">
                        <Users className="w-3 h-3" />
                        Compartilhada
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-lg bg-theme-surface-2 border border-theme flex items-center justify-between text-xs font-mono">
                    <span className="text-theme-muted text-[11px]">RFID / Brinco:</span>
                    <span className="font-bold text-theme-primary truncate max-w-[200px]" title={scanResult.animal.tag}>
                      {scanResult.animal.tag.length > 14
                        ? `${scanResult.animal.tag.slice(0, 8)}...${scanResult.animal.tag.slice(-4)}`
                        : scanResult.animal.tag}
                    </span>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/animal/${scanResult.animal.id}`}
                      className="btn-primary flex-1 py-3 text-xs text-center justify-center font-bold"
                    >
                      <span>Abrir Ficha da Vaca</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                    <Link
                      href={`/camera?animalId=${scanResult.animal.id}&animalName=${encodeURIComponent(scanResult.animal.name || scanResult.animal.tag)}`}
                      className="btn-secondary py-3 px-4 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Fotografar</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Tag Não Cadastrada
                      </span>
                      <h3 className="text-base font-bold text-theme-primary">
                        Animal ainda não registrado no sistema
                      </h3>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Tag lida com sucesso pelo sensor. Deseja cadastrar o animal agora?
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-theme-surface-2 border border-theme flex items-center justify-between text-xs font-mono">
                    <span className="text-theme-muted text-[11px]">Tag Lida:</span>
                    <span className="font-bold text-theme-primary truncate max-w-[220px]" title={scanResult.rfid}>
                      {scanResult.rfid}
                    </span>
                  </div>

                  <Link
                    href={`/animal/new?tag=${encodeURIComponent(scanResult.rfid)}`}
                    className="btn-primary w-full py-3 text-xs text-center justify-center font-bold"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    <span>Cadastrar Vaca com Esta Tag</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Busca Manual / Digitação de Brinco ou Apelido */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-sm sm:text-base font-extrabold text-theme-primary mb-1">
              Busca por Brinco ou RFID
            </h2>
            <p className="text-xs text-theme-secondary mb-4 leading-relaxed">
              Caso não esteja utilizando o leitor Bluetooth, digite o identificador ou brinco da vaca.
            </p>

            {error && <div className="error-banner mb-4">{error}</div>}

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="field-label" htmlFor="tag-input">
                  Código do Brinco ou RFID
                </label>
                <input
                  id="tag-input"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  className="field-input font-mono text-xs sm:text-sm tracking-wider uppercase font-bold"
                  placeholder="Ex: NEL-0142 ou E2801160..."
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !tag.trim()}
                className="btn-primary w-full py-3.5 text-xs font-bold"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? "Localizando…" : "Consultar ou Ativar Guarda"}
              </button>
            </form>
          </div>

          {/* Rebanho Recente com Foco no Apelido */}
          {recentAnimals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">
                  Rebanho Acessado Recentemente
                </h3>
                <Link
                  href="/animal/new"
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo cadastro
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {recentAnimals.map((a) => {
                  const displayName = a.name || "Vaca sem apelido";
                  const isShared = a.isShared || (a.custody && !a.custody.isOwner);

                  return (
                    <div
                      key={a.id}
                      className="card p-3.5 flex items-center justify-between gap-3 hover:border-emerald-500/50 transition"
                    >
                      <Link
                        href={`/animal/${a.id}`}
                        className="flex-1 min-w-0 flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-theme-primary truncate">
                              {displayName}
                            </span>
                            {isShared && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                                Compartilhada
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-theme-secondary">
                            <span className="font-mono text-[11px] bg-theme-surface-2 px-1.5 py-0.5 rounded text-theme-muted">
                              {a.tag.length > 12 ? `${a.tag.slice(0, 8)}...` : a.tag}
                            </span>
                            <span>· {a.breed}</span>
                            <span>· {a.photos?.length ?? 0} fotos</span>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/camera?animalId=${a.id}&animalName=${encodeURIComponent(displayName)}`}
                          className="btn-primary py-2 px-3 text-xs"
                          title="Fotografar com IA"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Foto</span>
                        </Link>
                        <Link
                          href={`/animal/${a.id}`}
                          className="p-2 text-theme-muted hover:text-theme-primary"
                          aria-label="Abrir animal"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
