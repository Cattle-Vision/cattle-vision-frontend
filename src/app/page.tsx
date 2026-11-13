/**
 * Landing Page Principal (`src/app/page.tsx`).
 *
 * Apresentação direta e técnica da ferramenta de campo CattleVision:
 * identificação por brinco/RFID, captura guiada da garupa e histórico
 * zootécnico do rebanho com suporte offline.
 */
import Link from "next/link";
import {
  Camera,
  Activity,
  ArrowRight,
  ScanLine,
  WifiOff,
  ChevronRight,
  Database,
  Users,
  Check,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { LandingAuthCheck } from "@/components/LandingAuthCheck";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary selection:bg-emerald-600 selection:text-white">
      <LandingAuthCheck />

      {/* Header Institucional */}
      <header className="glass-header sticky top-0 z-30 border-b border-theme bg-theme-surface/92 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <Activity className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-[17px] tracking-tight text-theme-primary truncate block leading-none">
                Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
              </span>
              <span className="text-[11px] font-medium text-theme-secondary truncate hidden sm:block mt-0.5">
                Registro de Condição Corporal Bovina
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallPrompt variant="button" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-ghost text-xs sm:text-sm px-3 py-2 min-h-[38px] font-semibold"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="btn-primary text-xs sm:text-sm px-3.5 sm:px-4 py-2 min-h-[38px] font-semibold"
            >
              <span>Criar conta</span>
              <ArrowRight className="w-3.5 h-3.5 hidden xs:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1">
        {/* Hero em 2 colunas no desktop para leitura rápida */}
        <section className="pt-10 pb-12 sm:pt-16 sm:pb-16 px-4 sm:px-6 border-b border-theme">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <p className="font-mono-tag text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-3">
                Manejo de Curral • PWA Offline
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-theme-primary leading-[1.12] mb-4">
                Registro e avaliação de condição corporal direto no tronco.
              </h1>

              <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-xl mb-7">
                Localize o animal por brinco, apelido ou leitor RFID Bluetooth, faça a captura
                padronizada da região posterior com validação instantânea de enquadramento e
                mantenha o histórico do rebanho acessível em campo.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-md">
                <Link
                  href="/register"
                  className="btn-primary py-3 px-5 text-sm sm:text-base font-semibold min-h-[46px] justify-center"
                >
                  <span>Acessar o Sistema</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn-secondary py-3 px-5 text-sm sm:text-base font-semibold min-h-[46px] justify-center"
                >
                  Já tenho cadastro
                </Link>
              </div>

              <div className="mt-3 sm:hidden">
                <PwaInstallPrompt variant="button" className="w-full justify-center py-2.5 text-xs font-semibold" />
              </div>

              <div className="mt-7 pt-5 border-t border-theme flex flex-wrap gap-x-6 gap-y-2 text-xs text-theme-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Escala zootécnica 1 a 5 (ICS / ECC)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Fila offline no dispositivo
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Leitor RFID ESP32 via BLE
                </span>
              </div>
            </div>

            {/* Painel de fluxo operacional — substitui blocos decorativos genéricos */}
            <div className="lg:col-span-5">
              <div className="card p-4 sm:p-5 bg-theme-surface border border-theme">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-theme">
                  <span className="text-xs font-semibold text-theme-primary">
                    Fluxo de captura em campo
                  </span>
                  <span className="font-mono-tag text-[11px] text-theme-secondary">
                    3 etapas
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-theme-surface-2 border border-theme">
                    <div className="w-8 h-8 rounded-md bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ScanLine className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-theme-primary">
                          1. Identificação do bovino
                        </p>
                        <span className="font-mono-tag text-[11px] text-theme-secondary">
                          Brinco / RFID
                        </span>
                      </div>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Busca rápida no lote ou leitura automática via bastão Bluetooth.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-theme-surface-2 border border-theme">
                    <div className="w-8 h-8 rounded-md bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-theme-primary">
                          2. Enquadramento da garupa
                        </p>
                        <span className="font-mono-tag text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                          Score óptico
                        </span>
                      </div>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Mira visual a 1,5 m valida nitidez, contraste e ângulo antes de salvar.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-theme-surface-2 border border-theme">
                    <div className="w-8 h-8 rounded-md bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-theme-primary">
                          3. Histórico na ficha do animal
                        </p>
                        <span className="font-mono-tag text-[11px] text-theme-secondary">
                          Sync auto
                        </span>
                      </div>
                      <p className="text-xs text-theme-secondary mt-0.5">
                        Fotos e registros ficam vinculados ao animal e sincronizam ao reconectar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pilares operacionais */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-theme-surface">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-xl mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-theme-primary tracking-tight">
                Feito para a rotina do manejo
              </h2>
              <p className="text-sm text-theme-secondary mt-1.5">
                Interface direta para operar com uma mão no curral e revisar lotes no escritório.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-xl bg-theme-bg border border-theme">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <WifiOff className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-semibold text-sm text-theme-primary mb-1.5">
                  Funciona sem sinal de internet
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Capturas feitas no pasto ou tronco sem cobertura ficam guardadas no aparelho e são
                  enviadas automaticamente quando a conexão retorna.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-theme-bg border border-theme">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <ScanLine className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-semibold text-sm text-theme-primary mb-1.5">
                  Brinco e RFID integrados
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Abra a ficha pelo número do brinco, nome do animal ou conectando um bastão leitor
                  ESP32 via Bluetooth direto no navegador.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-theme-bg border border-theme">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-semibold text-sm text-theme-primary mb-1.5">
                  Guarda compartilhada por animal
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Compartilhe o acesso de um animal específico com técnicos, veterinários ou outros
                  operadores da equipe sem misturar todo o rebanho.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé enxuto */}
      <footer className="border-t border-theme py-6 px-4 sm:px-6 bg-theme-bg text-xs text-theme-secondary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-theme-primary">CattleVision</span>
            <span>•</span>
            <span>Avaliação de Condição Corporal Bovina</span>
          </div>
          <p>© {new Date().getFullYear()} CattleVision</p>
        </div>
      </footer>
    </div>
  );
}
