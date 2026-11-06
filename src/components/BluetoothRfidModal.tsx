"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  bluetoothRfid,
  BluetoothStatus,
  RfidEventDetail,
} from "@/lib/bluetooth-rfid";
import { scanRfidTag } from "@/lib/api";

interface BluetoothRfidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete?: (tag: string, animalId?: string, isNew?: boolean) => void;
}

export function BluetoothRfidModal({
  isOpen,
  onClose,
  onScanComplete,
}: BluetoothRfidModalProps) {
  const router = useRouter();
  const [status, setStatus] = useState<BluetoothStatus>(bluetoothRfid.getStatus());
  const [deviceName, setDeviceName] = useState<string>(bluetoothRfid.getDeviceName());
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastScannedTag, setLastScannedTag] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    const unsubStatus = bluetoothRfid.onStatusChange((newStatus, devName, errorMsg) => {
      setStatus(newStatus);
      if (devName) setDeviceName(devName);
      if (errorMsg) setErrorMessage(errorMsg);
      else setErrorMessage("");
    });

    const unsubTag = bluetoothRfid.onTag(async (detail: RfidEventDetail) => {
      setLastScannedTag(detail.tag);
      await processScannedTag(detail.tag);
    });

    return () => {
      unsubStatus();
      unsubTag();
    };
  }, []);

  async function processScannedTag(tag: string) {
    if (!tag || isProcessing) return;
    setIsProcessing(true);
    setFeedbackMsg({ type: "info", text: `Consultando tag ${tag.slice(0, 8)}...` });

    try {
      const res = await scanRfidTag(tag);
      if (res.registered && res.animal) {
        setFeedbackMsg({
          type: "success",
          text: res.message || "Animal identificado com sucesso!",
        });
        bluetoothRfid.playAudioFeedback("success");
        bluetoothRfid.triggerHaptic([80, 50, 80]);

        if (onScanComplete) {
          onScanComplete(tag, res.animal.id, false);
        } else {
          setTimeout(() => {
            onClose();
            router.push(`/animal/${res.animal!.id}`);
          }, 1200);
        }
      } else {
        // Tag não registrada
        setFeedbackMsg({
          type: "info",
          text: "Tag não registrada no rebanho. Redirecionando para cadastro...",
        });
        bluetoothRfid.playAudioFeedback("alert");

        if (onScanComplete) {
          onScanComplete(tag, undefined, true);
        } else {
          setTimeout(() => {
            onClose();
            router.push(`/animal/new?tag=${encodeURIComponent(tag)}`);
          }, 1400);
        }
      }
    } catch (err: any) {
      console.error("[RFID Modal] Erro ao processar tag:", err);
      setFeedbackMsg({
        type: "error",
        text: err?.message || "Falha ao consultar tag no servidor.",
      });
      bluetoothRfid.playAudioFeedback("alert");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleConnect() {
    setErrorMessage("");
    setFeedbackMsg(null);
    const ok = await bluetoothRfid.connect();
    if (ok) {
      setFeedbackMsg({ type: "success", text: "Leitor ESP32 conectado com sucesso!" });
    }
  }

  function handleDisconnect() {
    bluetoothRfid.disconnect();
    setFeedbackMsg({ type: "info", text: "Leitor ESP32 desconectado." });
  }

  function handleManualSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = manualInput.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
    if (!clean) return;
    bluetoothRfid.emitManualTag(clean, "manual");
  }

  function generateRandomEpc() {
    // Gera EPC UHF padrão de 12 bytes = 24 caracteres hexadecimais
    let hex = "E280";
    const chars = "0123456789ABCDEF";
    for (let i = 0; i < 20; i++) {
      hex += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setManualInput(hex);
  }

  if (!isOpen) return null;

  const isSupported = bluetoothRfid.isSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-surface-subtle">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              status === "connected"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : status === "connecting"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                : "bg-primary/10 text-primary border border-primary/20"
            }`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.88 16.29L13 18.17V14.41M13 5.83l1.88 1.88-1.88 1.88M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29M13 9.59l1.88-1.88L13 5.83v3.76m0 8.58l1.88-1.88L13 14.41v3.76z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">Leitor RFID ESP32</h3>
              <p className="text-xs text-text-subtle">
                {status === "connected"
                  ? `Conectado: ${deviceName}`
                  : status === "connecting"
                  ? "Conectando ao dispositivo BLE..."
                  : "Identificação por radiofrequência & guarda compartilhada"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Mensagens de Feedback */}
          {feedbackMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
                feedbackMsg.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : feedbackMsg.type === "error"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              }`}
            >
              {feedbackMsg.type === "success" && (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {feedbackMsg.type === "error" && (
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {feedbackMsg.type === "info" && (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs border border-red-500/20">
              {errorMessage}
            </div>
          )}

          {/* Estado de Conexão Bluetooth */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-subtle">
                Status da Conexão
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                status === "connected"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : status === "connecting"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-surface text-text-subtle border border-border"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  status === "connected"
                    ? "bg-emerald-500 animate-pulse"
                    : status === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-text-muted"
                }`} />
                {status === "connected" ? "Pareado & Ativo" : status === "connecting" ? "Pareando..." : "Desconectado"}
              </span>
            </div>

            {isSupported ? (
              <div>
                {status !== "connected" ? (
                  <button
                    onClick={handleConnect}
                    disabled={status === "connecting"}
                    className="w-full py-3 px-4 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {status === "connecting" ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Buscando Leitor CattleVision-RFID...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14.88 16.29L13 18.17V14.41M13 5.83l1.88 1.88-1.88 1.88M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29M13 9.59l1.88-1.88L13 5.83v3.76m0 8.58l1.88-1.88L13 14.41v3.76z" />
                        </svg>
                        <span>Conectar Leitor ESP32 via Bluetooth</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDisconnect}
                      className="w-full py-2.5 px-4 rounded-xl bg-surface border border-border text-text font-medium text-xs hover:bg-surface-hover transition-colors"
                    >
                      Desconectar Dispositivo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                <p className="font-semibold mb-1">Web Bluetooth não suportado neste navegador</p>
                <p>
                  No iPhone (iOS Safari), use o navegador gratuito <strong>Bluefy</strong> ou utilize a simulação / digitação manual de tag abaixo.
                </p>
              </div>
            )}
          </div>

          {/* Última Tag Detectada */}
          {lastScannedTag && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Última Tag RFID Detectada
              </span>
              <div className="flex items-center justify-between">
                <code className="text-xs font-mono font-bold text-text bg-surface px-2.5 py-1 rounded border border-border break-all">
                  {lastScannedTag}
                </code>
                <span className="text-[11px] text-text-subtle">
                  {isProcessing ? "Processando..." : "Lida agora"}
                </span>
              </div>
            </div>
          )}

          {/* Seção de Simulação e Leitura Manual */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label htmlFor="manual-rfid" className="text-xs font-semibold text-text">
                Simulador / Leitura Manual de Tag RFID
              </label>
              <button
                type="button"
                onClick={generateRandomEpc}
                className="text-xs text-primary hover:underline font-medium"
              >
                + Gerar EPC 24-Hex
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                id="manual-rfid"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                placeholder="Ex: E2801160600002047E7A5A01 ou 1024"
                className="field-input flex-1 font-mono text-xs uppercase"
              />
              <button
                type="submit"
                disabled={!manualInput.trim() || isProcessing}
                className="px-4 py-2.5 rounded-xl bg-surface border border-border text-text font-medium text-xs hover:bg-surface-hover active:scale-[0.98] transition-all disabled:opacity-40 shrink-0"
              >
                {isProcessing ? "Consultando..." : "Simular Leitura"}
              </button>
            </form>
            <p className="text-[11px] text-text-subtle leading-relaxed">
              Ao aproximar o leitor do brinco ou simular uma leitura: se a vaca já existir, você receberá a <strong>Guarda Compartilhada</strong> instantaneamente; caso contrário, será iniciado o novo cadastro.
            </p>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 border-t border-border bg-surface-subtle flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-border text-text text-xs font-medium hover:bg-surface-hover transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
