"use client";

import { useEffect, useRef } from "react";

export const AUTO_REFRESH_INTERVAL_MS = 15_000;
export const DATA_SYNCED_EVENT = "cattlevision:data-synced";

/**
 * Notifica telas abertas de que dados ou mídias acabaram de ser sincronizados/atualizados,
 * permitindo atualização imediata da interface sem reload manual do navegador.
 */
export function emitDataSyncedEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_SYNCED_EVENT));
}

export interface UseAutoRefreshOptions {
  /** Intervalo entre atualizações silenciosas (padrão: 15.000 ms). */
  intervalMs?: number;
  /** Permite pausar temporariamente o polling (ex.: enquanto autentica ou envia upload). */
  enabled?: boolean;
  /** Revalida ao voltar foco/visibilidade da aba (padrão: true). */
  refreshOnFocus?: boolean;
}

/**
 * Executa polling silencioso periódico com proteção contra empilhamento de requisições
 * quando o banco PostgreSQL remoto apresenta latência elevada.
 */
export function useAutoRefresh(
  onRefresh: () => void | Promise<void>,
  options: UseAutoRefreshOptions = {}
): void {
  const {
    intervalMs = AUTO_REFRESH_INTERVAL_MS,
    enabled = true,
    refreshOnFocus = true,
  } = options;

  const callbackRef = useRef(onRefresh);
  const enabledRef = useRef(enabled);
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);

  callbackRef.current = onRefresh;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    const triggerRefresh = async (minElapsedMs = 0) => {
      if (!enabledRef.current || inFlightRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      const now = Date.now();
      if (minElapsedMs > 0 && now - lastRunAtRef.current < minElapsedMs) {
        return;
      }

      inFlightRef.current = true;
      lastRunAtRef.current = now;
      try {
        await callbackRef.current();
      } catch {
        // Atualização em segundo plano nunca interrompe a interação atual
      } finally {
        inFlightRef.current = false;
      }
    };

    const timer = setInterval(() => {
      void triggerRefresh(0);
    }, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void triggerRefresh(4_000);
      }
    };
    const handleFocus = () => {
      void triggerRefresh(4_000);
    };
    const handleOnlineOrSync = () => {
      void triggerRefresh(0);
    };

    if (refreshOnFocus) {
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("focus", handleFocus);
    }
    window.addEventListener("online", handleOnlineOrSync);
    window.addEventListener(DATA_SYNCED_EVENT, handleOnlineOrSync);

    return () => {
      clearInterval(timer);
      if (refreshOnFocus) {
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", handleFocus);
      }
      window.removeEventListener("online", handleOnlineOrSync);
      window.removeEventListener(DATA_SYNCED_EVENT, handleOnlineOrSync);
    };
  }, [enabled, intervalMs, refreshOnFocus]);
}
