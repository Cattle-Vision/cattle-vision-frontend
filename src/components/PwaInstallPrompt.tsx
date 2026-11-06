"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, X, Check, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt({
  variant = "button",
  className = "",
}: {
  variant?: "button" | "banner" | "icon";
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Detecta se já está rodando como app instalado
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detecta iOS / iPadOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isAppleDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
      } catch {
        // Fallback
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // Navegador que não disparou beforeinstallprompt (ou já dispensado)
      setShowIosGuide(true);
    }
  };

  return (
    <>
      {variant === "icon" && (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Instalar Aplicativo (PWA)"
          aria-label="Instalar Aplicativo (PWA)"
          className={`p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition min-w-[40px] min-h-[40px] inline-flex items-center justify-center touch-manipulation active:scale-95 ${className}`}
        >
          <Smartphone className="w-4 h-4" />
        </button>
      )}

      {variant === "button" && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition active:scale-95 touch-manipulation shrink-0 ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar App</span>
        </button>
      )}

      {/* Modal Guiado para iOS e navegadores sem prompt nativo */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="card p-5 max-w-sm w-full bg-theme-surface border border-theme shadow-xl rounded-2xl relative">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-3 right-3 p-1.5 text-theme-muted hover:text-theme-primary rounded-lg"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Smartphone className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-theme-primary mb-1">
              Instalar o CattleVision no seu Celular
            </h3>
            <p className="text-xs text-theme-secondary mb-4 leading-relaxed">
              Tenha acesso rápido direto do curral, funcionando em tela cheia mesmo sem sinal de internet:
            </p>

            <ol className="text-xs text-theme-primary space-y-2.5 mb-5 bg-theme-surface-2 p-3.5 rounded-xl border border-theme">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Toque no botão <strong>Compartilhar</strong>{" "}
                  <Share className="w-3.5 h-3.5 inline text-emerald-500 mx-0.5" /> na barra do navegador Safari ou Chrome.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Role para baixo e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="btn-primary w-full py-2.5 text-xs font-bold"
            >
              <Check className="w-4 h-4" />
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PwaInstallPrompt;
