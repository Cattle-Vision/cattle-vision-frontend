"use client";

import React, { useState, useEffect } from "react";
import { bluetoothRfid, BluetoothStatus } from "@/lib/bluetooth-rfid";
import { BluetoothRfidModal } from "./BluetoothRfidModal";

export function BluetoothStatusButton() {
  const [status, setStatus] = useState<BluetoothStatus>("disconnected");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setStatus(bluetoothRfid.getStatus());
    const unsub = bluetoothRfid.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
    return unsub;
  }, []);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        type="button"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border ${
          isConnected
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            : isConnecting
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse"
            : "bg-surface-subtle text-text-subtle border-border hover:bg-surface-hover hover:text-text"
        }`}
        title="Gerenciar Leitor RFID ESP32 via Bluetooth"
        aria-label="Leitor RFID ESP32"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isConnected
              ? "bg-emerald-500 animate-pulse"
              : isConnecting
              ? "bg-amber-500 animate-pulse"
              : "bg-text-muted"
          }`}
        />
        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.88 16.29L13 18.17V14.41M13 5.83l1.88 1.88-1.88 1.88M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29M13 9.59l1.88-1.88L13 5.83v3.76m0 8.58l1.88-1.88L13 14.41v3.76z" />
        </svg>
        <span className="hidden sm:inline">
          {isConnected ? "ESP32 Conectado" : isConnecting ? "Conectando..." : "Leitor RFID"}
        </span>
      </button>

      <BluetoothRfidModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
