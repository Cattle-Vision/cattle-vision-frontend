"use client";

/**
 * Painel de Avaliação Corporal (ICS), Contorno e Aptidão para Abate (`src/components/animal/AnimalIcsPanel.tsx`).
 *
 * Diretriz de transparência técnica:
 * - A IA neural de ICS (escala 1,0–5,0), extração de contorno corporal e aptidão para abate
 *   ainda está em desenvolvimento e NÃO está em execução no sistema atual.
 * - Nenhuma nota de ICS ou status de abate é simulado; enquanto `ics.status !== "CALCULATED"`,
 *   os campos permanecem explicitamente marcados como "Em desenvolvimento".
 * - Separa claramente a confiança de enquadramento (YOLO, 0–100%) do futuro índice ICS.
 */
import { Activity, AlertTriangle, CheckCircle2, Clock, Eye, Loader2 } from "lucide-react";
import { Animal, Photo } from "@/lib/types";

interface AnimalIcsPanelProps {
  animal: Animal;
  photos: Photo[];
  recalibrating: boolean;
  onRecalibrate: () => void;
  onSelectPhoto?: (index: number) => void;
}

export default function AnimalIcsPanel({
  animal,
  photos,
  recalibrating,
  onRecalibrate,
  onSelectPhoto,
}: AnimalIcsPanelProps) {
  const ics = animal.ics;
  const isCalculated = ics?.status === "CALCULATED" && typeof ics.score === "number";

  // Calcula média apenas das capturas com score de enquadramento válido (YOLO)
  const validScores = photos
    .map((p) => p.score)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  const avgFraming =
    validScores.length > 0
      ? Math.round(validScores.reduce((acc, s) => acc + s, 0) / validScores.length)
      : null;

  // Ordenação cronológica descendente mantendo índice original para abertura correta no Lightbox
  const orderedWithIndex = photos
    .map((photo, originalIndex) => ({ photo, originalIndex }))
    .sort((a, b) => {
      const ta = a.photo.createdAt ? new Date(a.photo.createdAt).getTime() : 0;
      const tb = b.photo.createdAt ? new Date(b.photo.createdAt).getTime() : 0;
      return tb - ta;
    });

  return (
    <div className="space-y-4">
      {/* Banner obrigatório de status real da IA de ICS/Abate */}
      {!isCalculated && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Avaliação de ICS e Abate por IA em desenvolvimento
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                Modelo neural inativo
              </span>
            </div>
            <p className="text-[11px] text-theme-secondary mt-1 leading-relaxed">
              {ics?.message ||
                "A IA de avaliação do Índice de Condição Corporal (ICS 1,0–5,0), extração de contorno anatômico e aptidão para abate ainda não está implementada e não está em execução. As fotos ficam salvas e validadas por enquadramento para processamento futuro."}
            </p>
          </div>
        </div>
      )}

      {/* Resumo comparativo: ICS futuro vs Enquadramento YOLO atual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-theme-surface-2 border border-theme">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
            ICS (Escala 1,0–5,0)
          </span>
          {isCalculated ? (
            <>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {ics.score?.toFixed(1)}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                {ics.classification || "Classificação calculada"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Em desenvolvimento
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                Aguardando modelo neural
              </p>
            </>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface-2 border border-theme">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
            Aptidão para Abate
          </span>
          {isCalculated && ics.slaughterStatus !== "IN_DEVELOPMENT" ? (
            <>
              <p
                className={`text-sm font-bold mt-1 flex items-center gap-1.5 ${
                  ics.slaughterReady
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {ics.slaughterLabel || (ics.slaughterReady ? "Apto para abate" : "Ainda não apto")}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5 truncate" title={ics.slaughterReason}>
                {ics.slaughterReason || "Baseado no ICS calculado"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Em desenvolvimento
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                Depende do motor de ICS
              </p>
            </>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface-2 border border-theme">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
            Enquadramento YOLO
          </span>
          <p className="text-lg font-bold text-theme-primary tabular-nums mt-1">
            {avgFraming !== null ? `${avgFraming}%` : "—"}
          </p>
          <p className="text-[11px] text-theme-secondary mt-0.5">
            {validScores.length > 0
              ? `Média de ${validScores.length} captura(s)`
              : "Sem fotos avaliadas"}
          </p>
        </div>
      </div>

      {/* Histórico cronológico de avaliações por captura */}
      {photos.length > 0 && (
        <div className="rounded-xl border border-theme overflow-hidden">
          <div className="px-3.5 py-2.5 bg-theme-surface-2 border-b border-theme flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-theme-primary">
              Histórico de Avaliações ({photos.length})
            </span>
            <button
              type="button"
              onClick={onRecalibrate}
              disabled={recalibrating}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
            >
              {recalibrating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Activity className="w-3 h-3" />
              )}
              <span>{recalibrating ? "Recalculando…" : "Recalcular enquadramento"}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme bg-theme-surface/60 text-[10px] uppercase tracking-wider text-theme-muted">
                  <th className="py-2 px-3 font-semibold">Data / Hora</th>
                  <th className="py-2 px-3 font-semibold">Enquadramento</th>
                  <th className="py-2 px-3 font-semibold">ICS</th>
                  <th className="py-2 px-3 font-semibold">Abate</th>
                  <th className="py-2 px-3 font-semibold text-right">Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {orderedWithIndex.map(({ photo, originalIndex }) => {
                  const photoIcs = photo.ics;
                  const photoCalculated =
                    photoIcs?.status === "CALCULATED" && typeof photoIcs.score === "number";
                  const dateLabel = photo.createdAt
                    ? new Date(photo.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—";

                  return (
                    <tr key={photo.id} className="hover:bg-theme-surface-2/60 transition-colors">
                      <td className="py-2 px-3 text-theme-secondary whitespace-nowrap tabular-nums">
                        {dateLabel}
                      </td>
                      <td className="py-2 px-3 font-semibold tabular-nums">
                        {typeof photo.score === "number" ? (
                          <span
                            className={
                              photo.score >= 70
                                ? "text-emerald-600 dark:text-emerald-400"
                                : photo.score >= 45
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-500"
                            }
                          >
                            {Math.round(photo.score)}%
                          </span>
                        ) : (
                          <span className="text-theme-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {photoCalculated ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {photoIcs.score?.toFixed(1)} · {photoIcs.classification}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            Em desenvolvimento
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {photoCalculated && photoIcs.slaughterStatus !== "IN_DEVELOPMENT" ? (
                          <span className="font-semibold text-theme-primary">
                            {photoIcs.slaughterLabel ||
                              (photoIcs.slaughterReady ? "Apto" : "Não apto")}
                          </span>
                        ) : (
                          <span className="text-[11px] text-theme-muted">Em desenvolvimento</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {onSelectPhoto && (
                          <button
                            type="button"
                            onClick={() => onSelectPhoto(originalIndex)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <Eye className="w-3 h-3" />
                            Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
