"use client";

/**
 * Página de Identificação Inteligente por RFID ESP32 & Brinco (`src/app/identify/page.tsx`).
 *
 * Funcionalidades:
 * - Conexão e escuta contínua de leituras de tags RFID via Web Bluetooth (ESP32).
 * - Identificação instantânea com adesão automática à Guarda Compartilhada.
 * - Suporte a simulação e entrada manual para navegadores sem Web Bluetooth.
 * - Priorização visual de Apelido do animal e ocultação de códigos RFID longos e randômicos.
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
  ExternalLink,
  Copy,
} from "lucide-react";
import { normalizeTag } from "@/lib/animal";
import { Animal, RfidScanResult } from "@/lib/types";
import { apiFetch, scanRfidTag } from "@/lib/api";
import { bluetoothRfid, BluetoothStatus, RfidEventDetail } from "@/lib/bluetooth-rfid";
import { BluetoothRfidModal } from "@/components/BluetoothRfidModal";
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
  const [bluetoothModalOpen, setBluetoothModalOpen] = useState(false);
  const [bleStatus, setBleStatus] = useState<BluetoothStatus>("disconnected");
  const [bleDeviceName, setBleDeviceName] = useState("");
  const [scanResult, setScanResult] = useState<RfidScanResult | null>(null);

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
        toast("Tag RFID não cadastrada. Inicie o cadastro do animal.", "info");
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary pb-20 sm:pb-8">
      <AppHeader
        showBack
        backHref="/dashboard"
        title="Identificação & Leitor RFID"
        subtitle="Conexão com ESP32, guarda compartilhada e busca"
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-xl mx-auto flex flex-col gap-6">

          {/* Cartão de Conexão com o Leitor RFID ESP32 */}
          <div className="card p-5 border-2 border-emerald-500/20 bg-linear-to-b from-emerald-500/5 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  bleStatus === "connected"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : bleStatus === "connecting"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse"
                    : "bg-theme-surface-2 text-theme-secondary"
                }`}>
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-theme-primary">
                    Leitor RFID ESP32 (Curral)
                  </h2>
                  <p className="text-xs text-theme-secondary">
                    {bleStatus === "connected"
                      ? `Conectado a ${bleDeviceName || "CattleVision-RFID"}`
                      : bleStatus === "connecting"
                      ? "Pareando via Bluetooth..."
                      : "Aproxime o dispositivo do animal para leitura"}
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
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
                {bleStatus === "connected" ? "Pronto para Ler" : bleStatus === "connecting" ? "Buscando..." : "Desconectado"}
              </span>
            </div>

            {bleStatus === "connected" ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Aguardando aproximar da vaca no curral...</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBluetoothModalOpen(true)}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
                >
                  Opções
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleConnectBle}
                  disabled={bleStatus === "connecting"}
                  className="btn-primary flex-1 py-3 text-xs"
                >
                  {bleStatus === "connecting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      <span>Conectar ESP32 Bluetooth</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setBluetoothModalOpen(true)}
                  className="btn-secondary py-3 px-4 text-xs shrink-0"
                >
                  Simulador / Ajuda
                </button>
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
                        {/* Prioridade Absoluta ao Apelido/Nome */}
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

                  {/* Informação secundária da Tag RFID */}
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
                      className="btn-primary flex-1 py-3 text-xs text-center justify-center"
                    >
                      <span>Abrir Ficha da Vaca</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                    <Link
                      href={`/camera?animalId=${scanResult.animal.id}&animalName=${encodeURIComponent(scanResult.animal.name || scanResult.animal.tag)}`}
                      className="btn-secondary py-3 px-4 text-xs flex items-center gap-1.5"
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
                        Esta tag RFID foi lida com sucesso pelo leitor. Deseja registrar a vaca agora?
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
                    className="btn-primary w-full py-3 text-xs text-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    <span>Cadastrar Vaca com Esta Tag</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Busca Manual / Digitação de Brinco */}
          <div className="card p-6">
            <h2 className="text-base font-extrabold text-theme-primary mb-1">
              Busca Manual por Brinco ou RFID
            </h2>
            <p className="text-xs text-theme-secondary mb-4 leading-relaxed">
              Caso não esteja com o leitor Bluetooth por perto, digite o identificador ou brinco da vaca.
            </p>

            {error && <div className="error-banner mb-4">{error}</div>}

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label" htmlFor="tag-input">
                  Código do Brinco ou RFID
                </label>
                <input
                  id="tag-input"
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  className="field-input font-mono text-sm tracking-wider uppercase font-bold"
                  placeholder="Ex: NEL-0142 ou E2801160..."
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !tag.trim()}
                className="btn-primary w-full py-3.5"
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
                            {/* Apelido em Destaque */}
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

      <BluetoothRfidModal
        isOpen={bluetoothModalOpen}
        onClose={() => setBluetoothModalOpen(false)}
        onScanComplete={(scannedTag, animalId, isNew) => {
          setBluetoothModalOpen(false);
          if (animalId) {
            router.push(`/animal/${animalId}`);
          } else if (isNew) {
            router.push(`/animal/new?tag=${encodeURIComponent(scannedTag)}`);
          }
        }}
      />

      <MobileNav />
    </div>
  );
}
