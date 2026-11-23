"use client";

/**
 * Página de Identificação Rápida de Animais (`src/app/identify/page.tsx`).
 */
import { useState, useEffect, useMemo } from "react";
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
  ChevronDown,
  ChevronUp,
  Shuffle,
} from "lucide-react";
import { normalizeTag } from "@/lib/animal";
import { Animal, RfidScanResult } from "@/lib/types";
import {
  apiFetchCached,
  getApiCacheSnapshot,
  readPersistedApiCache,
  scanRfidTag,
} from "@/lib/api";
import { bluetoothRfid, BluetoothStatus, RfidEventDetail } from "@/lib/bluetooth-rfid";
import AppHeader from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";
import { useToast } from "@/components/ui/Toast";

const ANIMALS_SUMMARY_ENDPOINT = "/api/animals?summary=1";

export default function IdentifyPage() {
  const { toast } = useToast();

  const cachedAnimals = getApiCacheSnapshot<Animal[]>(ANIMALS_SUMMARY_ENDPOINT);
  const [queryOrTag, setQueryOrTag] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allAnimals, setAllAnimals] = useState<Animal[]>(() =>
    Array.isArray(cachedAnimals) ? cachedAnimals : []
  );
  const [bleStatus, setBleStatus] = useState<BluetoothStatus>("disconnected");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [scanResult, setScanResult] = useState<RfidScanResult | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedTag, setSimulatedTag] = useState("");

  useEffect(() => {
    if (!cachedAnimals) {
      const persisted = readPersistedApiCache<Animal[]>(ANIMALS_SUMMARY_ENDPOINT);
      if (Array.isArray(persisted)) {
        setAllAnimals(persisted);
      }
    }
    apiFetchCached<Animal[]>(ANIMALS_SUMMARY_ENDPOINT, 15_000)
      .then((d) => {
        if (Array.isArray(d)) setAllAnimals(d);
      })
      .catch(() => {});

    setBleStatus(bluetoothRfid.getStatus());
    setBleDeviceName(bluetoothRfid.getDeviceName());

    const unsubStatus = bluetoothRfid.onStatusChange((status, name) => {
      setBleStatus(status);
      if (name) setBleDeviceName(name);
    });

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
            ? "Animal identificado com sucesso."
            : "Animal localizado e adicionado ao seu acesso compartilhado.",
          "success"
        );
      } else {
        bluetoothRfid.playAudioFeedback("alert");
        toast("Brinco não cadastrado. Você pode criar a ficha agora.", "info");
      }
    } catch (err: any) {
      setError(err?.message || "Não foi possível consultar este código.");
      bluetoothRfid.playAudioFeedback("alert");
    } finally {
      setLoading(false);
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeTag(queryOrTag);
    if (!normalized) {
      setError("Digite o número do brinco ou código eletrônico.");
      return;
    }
    await handleProcessRfid(normalized);
  };

  const handleConnectBle = async () => {
    setError("");
    const ok = await bluetoothRfid.connect();
    if (ok) {
      toast("Leitor Bluetooth conectado.", "success");
    }
  };

  const handleDisconnectBle = () => {
    bluetoothRfid.disconnect();
    toast("Leitor desconectado.", "info");
  };

  const handleSimulateTag = () => {
    const clean = simulatedTag.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
    if (!clean) return;
    bluetoothRfid.emitManualTag(clean, "simulation");
  };

  const generateSampleTag = () => {
    let hex = "E280";
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < 20; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSimulatedTag(hex);
  };

  const isBleSupported = bluetoothRfid.isSupported();

  const matchingAnimals = useMemo(() => {
    const q = queryOrTag.trim().toUpperCase();
    if (!q) return allAnimals.slice(0, 6);
    return allAnimals
      .filter(
        (a) =>
          a.tag.toUpperCase().includes(q) ||
          (a.name && a.name.toUpperCase().includes(q)) ||
          a.breed.toUpperCase().includes(q)
      )
      .slice(0, 8);
  }, [allAnimals, queryOrTag]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary pb-24 sm:pb-10">
      <AppHeader
        showBack
        backHref="/dashboard"
        title="Identificar animal"
        subtitle="Leitor Bluetooth ou busca rápida"
      />

      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          {/* Leitor Bluetooth */}
          <div className="card p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${
                    bleStatus === "connected"
                      ? "bg-emerald-600 text-white"
                      : bleStatus === "connecting"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse"
                        : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-theme-primary truncate">
                    Leitor de brinco Bluetooth
                  </h2>
                  <p className="text-xs text-theme-secondary truncate">
                    {bleStatus === "connected"
                      ? `Conectado a ${bleDeviceName || "leitor"}`
                      : bleStatus === "connecting"
                        ? "Pareando com o aparelho…"
                        : "Conecte o bastão leitor para abrir fichas automaticamente"}
                  </p>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold border shrink-0 ${
                  bleStatus === "connected"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                    : bleStatus === "connecting"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                      : "bg-theme-surface-2 text-theme-muted border-theme"
                }`}
              >
                {bleStatus === "connected"
                  ? "Conectado"
                  : bleStatus === "connecting"
                    ? "Pareando"
                    : "Desconectado"}
              </span>
            </div>

            {bleStatus === "connected" ? (
              <div className="p-3 rounded-[10px] bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs">
                <span className="text-emerald-800 dark:text-emerald-200 font-semibold">
                  Aproxime o leitor do brinco para identificar o animal.
                </span>
                <button
                  type="button"
                  onClick={handleDisconnectBle}
                  className="btn-secondary !py-1.5 !px-3 !min-h-[34px] text-xs shrink-0"
                >
                  Desconectar
                </button>
              </div>
            ) : isBleSupported ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleConnectBle}
                  disabled={bleStatus === "connecting"}
                  className="btn-primary flex-1 text-xs sm:text-sm"
                >
                  {bleStatus === "connecting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando…</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Conectar leitor</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSimulator((v) => !v)}
                  className="btn-secondary text-xs shrink-0"
                >
                  <span>Simular leitura</span>
                  {showSimulator ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-[10px] card-subtle text-xs text-theme-secondary">
                Este navegador não suporta leitura direta por Bluetooth. Utilize a busca abaixo.
              </div>
            )}

            {(showSimulator || !isBleSupported) && (
              <div className="pt-3 border-t border-theme space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-theme-secondary">
                    Teste com código simulado
                  </span>
                  <button
                    type="button"
                    onClick={generateSampleTag}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Gerar exemplo</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simulatedTag}
                    onChange={(e) => setSimulatedTag(e.target.value.toUpperCase())}
                    placeholder="Código do brinco eletrônico"
                    className="field-input font-mono-tag text-xs uppercase flex-1"
                  />
                  <button
                    type="button"
                    disabled={!simulatedTag.trim() || loading}
                    onClick={handleSimulateTag}
                    className="btn-secondary !px-3.5 text-xs shrink-0"
                  >
                    Testar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Busca Manual */}
          <div className="card p-4 sm:p-5">
            <h2 className="text-sm font-bold text-theme-primary mb-1">
              Buscar por brinco ou apelido
            </h2>
            <p className="text-xs text-theme-secondary mb-3">
              Digite o código do animal para consultar ou filtre sua lista abaixo.
            </p>

            {error && <div className="error-banner mb-3">{error}</div>}

            <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-theme-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="tag-input"
                  value={queryOrTag}
                  onChange={(e) => setQueryOrTag(e.target.value)}
                  className="field-input pl-10 text-sm"
                  placeholder="Apelido, raça ou número do brinco…"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !queryOrTag.trim()}
                className="btn-secondary !px-4 text-xs sm:text-sm shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{loading ? "Consultando…" : "Consultar"}</span>
              </button>
            </form>
          </div>

          {/* Resultado da Consulta */}
          {scanResult && (
            <div
              className={`card p-4 sm:p-5 border ${
                scanResult.registered
                  ? "border-emerald-500/45 bg-emerald-500/[0.04]"
                  : "border-amber-500/45 bg-amber-500/[0.04]"
              }`}
            >
              {scanResult.registered && scanResult.animal ? (
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                          {scanResult.isOwner ? "Seu rebanho" : "Guarda compartilhada"}
                        </span>
                        <h3 className="text-base font-bold text-theme-primary">
                          {scanResult.animal.name || "Sem apelido"}
                        </h3>
                        <p className="text-xs text-theme-secondary">
                          {scanResult.animal.breed} — {scanResult.animal.sex} ({scanResult.animal.weight} kg)
                        </p>
                      </div>
                    </div>

                    {!scanResult.isOwner && (
                      <span className="px-2 py-0.5 rounded-[7px] text-[11px] font-semibold bg-sky-500/12 text-sky-700 dark:text-sky-300 inline-flex items-center gap-1 shrink-0">
                        <Users className="w-3 h-3" />
                        <span>Compartilhado</span>
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-[10px] card-subtle flex items-center justify-between text-xs font-mono-tag">
                    <span className="text-theme-muted font-sans">Identificador</span>
                    <span className="font-semibold text-theme-primary truncate max-w-[220px]">
                      {scanResult.animal.tag}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/animal/${scanResult.animal.id}`}
                      className="btn-primary flex-1 text-xs"
                    >
                      <span>Abrir ficha</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/camera?animalId=${scanResult.animal.id}&animalName=${encodeURIComponent(
                        scanResult.animal.name || scanResult.animal.tag
                      )}`}
                      className="btn-secondary text-xs"
                    >
                      <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Fotografar</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">
                        Não cadastrado
                      </span>
                      <h3 className="text-sm font-bold text-theme-primary">
                        Nenhum animal encontrado com este brinco
                      </h3>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Cadastre o animal agora para começar os registros.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-[10px] card-subtle flex items-center justify-between text-xs font-mono-tag">
                    <span className="text-theme-muted font-sans">Código</span>
                    <span className="font-semibold text-theme-primary truncate max-w-[220px]">
                      {scanResult.rfid}
                    </span>
                  </div>

                  <Link
                    href={`/animal/new?tag=${encodeURIComponent(scanResult.rfid)}`}
                    className="btn-primary w-full text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar este animal</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Lista Rápida */}
          {matchingAnimals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <h3 className="text-xs font-semibold text-theme-muted">
                  {queryOrTag.trim() ? "Resultados no seu rebanho" : "Recentes no rebanho"}
                </h3>
                <Link
                  href="/animal/new"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo animal</span>
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                {matchingAnimals.map((a) => {
                  const displayName = a.name?.trim() || "Sem apelido";
                  const isShared = a.isShared || (a.custody && !a.custody.isOwner);
                  const photoCount = a.photoCount ?? a.photos?.length ?? 0;

                  return (
                    <div
                      key={a.id}
                      className="card p-3 flex items-center justify-between gap-3 hover:border-emerald-500/50 transition"
                    >
                      <Link href={`/animal/${a.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-theme-primary truncate">
                            {displayName}
                          </span>
                          {isShared && (
                            <span className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold bg-sky-500/12 text-sky-700 dark:text-sky-300 shrink-0">
                              Compartilhado
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-theme-secondary tabular-nums">
                          <span className="font-mono-tag text-[11px] text-theme-muted">
                            {a.tag.length > 14 ? `${a.tag.slice(0, 8)}…` : a.tag}
                          </span>
                          <span>{a.breed}</span>
                          <span>
                            {photoCount} {photoCount === 1 ? "foto" : "fotos"}
                          </span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/camera?animalId=${a.id}&animalName=${encodeURIComponent(displayName)}`}
                          className="btn-primary !py-2 !px-3 !min-h-[36px] text-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Fotografar</span>
                        </Link>
                        <Link
                          href={`/animal/${a.id}`}
                          className="p-2 text-theme-muted hover:text-theme-primary"
                          aria-label="Abrir ficha"
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
