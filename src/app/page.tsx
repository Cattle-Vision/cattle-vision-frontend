/**
 * Landing Page (`src/app/page.tsx`).
 */
import Link from "next/link";
import {
  Camera,
  ArrowRight,
  ScanLine,
  WifiOff,
  ChevronRight,
  ClipboardCheck,
  Users,
  Check,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { LandingAuthCheck } from "@/components/LandingAuthCheck";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { BrandMark } from "@/components/BrandMark";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary selection:bg-emerald-600 selection:text-white">
      <LandingAuthCheck />

      <header className="glass-header sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark className="w-8 h-8 sm:w-9 sm:h-9" />
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-[17px] tracking-tight text-theme-primary block leading-none">
                Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
              </span>
              <span className="text-[11px] font-medium text-theme-secondary hidden sm:block mt-0.5">
                Avaliação Corporal Bovina
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallPrompt variant="button" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-ghost text-xs sm:text-sm px-3"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="btn-primary !min-h-[38px] text-xs sm:text-sm px-3.5 sm:px-4"
            >
              <span>Criar conta</span>
              <ArrowRight className="w-3.5 h-3.5 hidden xs:inline" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="pt-10 pb-14 sm:pt-16 sm:pb-20 px-4 sm:px-6 border-b border-theme">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full mb-4">
                Gestão de campo e avaliação de ICS
              </span>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-theme-primary leading-[1.12] mb-4">
                Avaliação corporal e histórico completo do rebanho direto no curral.
              </h1>

              <p className="text-sm sm:text-base text-theme-secondary leading-relaxed max-w-xl mb-7">
                Identifique cada animal pelo apelido, brinco ou leitor Bluetooth, registre fotos
                guiadas e acompanhe o Índice de Condição Corporal (ICS) junto ao histórico
                sanitário e de movimentações.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-md">
                <Link
                  href="/register"
                  className="btn-primary py-3 px-5 text-sm sm:text-base justify-center"
                >
                  <span>Começar agora</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn-secondary py-3 px-5 text-sm sm:text-base justify-center"
                >
                  Já tenho conta
                </Link>
              </div>

              <div className="mt-3 sm:hidden">
                <PwaInstallPrompt variant="button" className="w-full justify-center" />
              </div>

              <div className="mt-8 pt-6 border-t border-theme flex flex-wrap gap-x-6 gap-y-2.5 text-xs font-medium text-theme-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Índice de Condição Corporal (1,0 a 5,0)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Funciona mesmo sem internet
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Compatível com leitor Bluetooth
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="card p-5 space-y-3">
                <div className="pb-2.5 border-b border-theme">
                  <span className="text-xs font-bold text-theme-primary">
                    Como funciona na prática
                  </span>
                </div>

                <div className="flex items-start gap-3 p-3.5 card-subtle">
                  <div className="w-9 h-9 rounded-[10px] bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-theme-primary">
                      1. Identifique o animal
                    </p>
                    <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed">
                      Busque pelo apelido, número do brinco ou aproxime o leitor eletrônico Bluetooth.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 card-subtle">
                  <div className="w-9 h-9 rounded-[10px] bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-theme-primary">
                      2. Capture a foto guiada
                    </p>
                    <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed">
                      A câmera auxilia no enquadramento e distância antes mesmo de salvar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 card-subtle">
                  <div className="w-9 h-9 rounded-[10px] bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-theme-primary">
                      3. Calcule e acompanhe o ICS
                    </p>
                    <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed">
                      Solicite a nota corporal (1,0 a 5,0) e mantenha vacinas, localização e notas na ficha.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 px-4 sm:px-6 bg-theme-surface">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-xl mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-theme-primary tracking-tight">
                Feito para a rotina do campo e do escritório
              </h2>
              <p className="text-sm text-theme-secondary mt-1.5">
                Simples de operar no curral com uma mão e completo para análise do lote.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="card-subtle p-5">
                <div className="w-9 h-9 rounded-[10px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <WifiOff className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-theme-primary mb-1.5">
                  Funciona sem sinal
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Cadastros, observações e fotos ficam salvos no aparelho e sincronizam
                  automaticamente assim que a internet voltar.
                </p>
              </div>

              <div className="card-subtle p-5">
                <div className="w-9 h-9 rounded-[10px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <ScanLine className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-theme-primary mb-1.5">
                  Brinco e leitura Bluetooth
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Encontre qualquer animal instantaneamente digitando o apelido ou conectando um
                  leitor Bluetooth compatível.
                </p>
              </div>

              <div className="card-subtle p-5">
                <div className="w-9 h-9 rounded-[10px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-3">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-theme-primary mb-1.5">
                  Trabalho em equipe
                </h3>
                <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
                  Compartilhe fichas específicas com veterinários, técnicos ou peões mantendo o
                  controle de quem pode gerenciar o animal.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-theme py-6 px-4 sm:px-6 bg-theme-bg text-xs text-theme-secondary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-theme-primary">
            CattleVision — Avaliação Corporal Bovina
          </span>
          <p>© {new Date().getFullYear()} CattleVision</p>
        </div>
      </footer>
    </div>
  );
}
