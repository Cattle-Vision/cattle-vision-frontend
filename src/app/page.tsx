/**
 * Landing Page Principal — Produto CattleVision (`src/app/page.tsx`).
 *
 * Filosofia:
 * Sistema Inteligente para Avaliação e Diagnóstico Automatizado do
 * Índice de Condição Corporal (ICS / ECC / BCS) Bovino por Visão Computacional.
 */
import Link from "next/link";
import {
  Camera,
  Activity,
  ArrowRight,
  ScanLine,
  CheckCircle2,
  Sparkles,
  Layers,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { LandingAuthCheck } from "@/components/LandingAuthCheck";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-theme-bg text-theme-primary selection:bg-emerald-500 selection:text-white">
      <LandingAuthCheck />

      {/* Header Institucional */}
      <header className="glass-header sticky top-0 z-30 border-b border-theme bg-theme-surface/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-theme-primary truncate block">
                Cattle<span className="text-emerald-600 dark:text-emerald-400">Vision</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-theme-secondary truncate hidden xs:block">
                Diagnóstico de Condição Corporal (ICS)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallPrompt variant="button" className="hidden sm:inline-flex" />
            <ThemeToggle className="p-2" />
            <Link
              href="/login"
              className="btn-ghost text-xs sm:text-sm px-3 py-2 min-h-[40px] font-bold"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="btn-primary text-xs sm:text-sm px-4 py-2 min-h-[40px] font-bold shadow-xs"
            >
              <span>Cadastrar</span>
              <ArrowRight className="w-3.5 h-3.5 hidden xs:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6">
          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge de Destaque */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-6 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Inteligência Artificial Aplicada à Pecuária de Precisão</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-theme-primary leading-[1.12] mb-6">
              Diagnóstico Automatizado do{" "}
              <span className="text-emerald-600 dark:text-emerald-400 block sm:inline">
                Escore Corporal Bovino
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-theme-secondary leading-relaxed max-w-2xl mx-auto mb-8 font-medium">
              Avalie o <strong>Índice de Condição Corporal (ICS / BCS)</strong> do seu rebanho diretamente no curral.
              Com auxílio visual anatômico da câmera inteligente, você registra cada lote com rapidez e máxima consistência zootécnica.
            </p>

            {/* Aviso transparente sobre o estágio neural */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium mb-8 bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/30 max-w-xl mx-auto text-left sm:text-center">
              <Activity className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Módulo de Predição de ICS:</strong> Em fase final de desenvolvimento neural. O cálculo anatômico e validação de enquadramento já estão 100% ativos.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
              <Link
                href="/register"
                className="btn-primary w-full py-3.5 text-sm sm:text-base font-bold shadow-md min-h-[50px] justify-center"
              >
                <span>Acessar o Sistema</span>
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="btn-secondary w-full py-3.5 text-sm sm:text-base font-bold min-h-[50px] justify-center"
              >
                Já tenho cadastro
              </Link>
            </div>

            {/* Botão PWA Mobile Direct */}
            <div className="mt-4 sm:hidden">
              <PwaInstallPrompt variant="button" className="w-full justify-center py-2.5 text-xs font-bold" />
            </div>

            {/* Métricas e Pilares */}
            <div className="mt-12 pt-8 border-t border-theme grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-4xl mx-auto">
              {[
                {
                  label: "Avaliação do ICS",
                  desc: "Escala 1 a 5 para nutrição e reprodução bovina",
                },
                {
                  label: "Câmera Anatômica",
                  desc: "Silhueta e mira precisa da garupa no celular",
                },
                {
                  label: "Pronto para o Campo",
                  desc: "Funciona sob sol intenso e armazena offline",
                },
                {
                  label: "Histórico por Brinco",
                  desc: "Acompanhamento visual completo da evolução",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-theme-surface border border-theme rounded-xl p-3.5 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs mb-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {item.label}
                  </div>
                  <p className="text-xs text-theme-secondary leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como Funciona no Dia a Dia da Fazenda */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 bg-theme-surface border-y border-theme">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-theme-primary tracking-tight">
                Simples de usar na rotina do curral
              </h2>
              <p className="text-sm sm:text-base text-theme-secondary mt-2">
                Projetado para vaqueiros e manejadores trabalharem com rapidez, sem complicação tecnológica.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Localize pelo Brinco",
                  desc: "Digite os números do brinco ou apelido do animal para abrir a ficha zootécnica instantaneamente.",
                  icon: <ScanLine className="w-6 h-6 text-emerald-500" />,
                },
                {
                  step: "02",
                  title: "Enquadre com a Mira",
                  desc: "Aponte a câmera a 1,5m da garupa. A mira visual orienta a altura ideal e valida a qualidade anatômica da foto.",
                  icon: <Camera className="w-6 h-6 text-emerald-500" />,
                },
                {
                  step: "03",
                  title: "Diagnóstico e Manejo",
                  desc: "A foto é catalogada na ficha do bovino para aferição do escore corporal e planejamento de nutrição do rebanho.",
                  icon: <TrendingUp className="w-6 h-6 text-emerald-500" />,
                },
              ].map((card) => (
                <div
                  key={card.step}
                  className="card p-6 border border-theme bg-theme-surface-2 rounded-2xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-theme-surface border border-theme flex items-center justify-center">
                        {card.icon}
                      </div>
                      <span className="font-mono-tag text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Passo {card.step}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-theme-primary mb-2">{card.title}</h3>
                    <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-theme py-8 px-4 sm:px-6 bg-theme-surface-2 text-center text-xs text-theme-secondary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white text-[10px] font-bold">
              CV
            </div>
            <span className="font-bold text-theme-primary">CattleVision</span>
            <span>— Avaliação Zootécnica de Precisão</span>
          </div>
          <p>© {new Date().getFullYear()} CattleVision. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
