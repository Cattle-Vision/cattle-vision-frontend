"use client";

/**
 * Painel de Condição Corporal (ICS) e Histórico de Avaliações (`src/components/animal/AnimalIcsPanel.tsx`).
 */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Animal, Photo } from "@/lib/types";
import {
  drainIcsQueue,
  enqueueAnimalIcs,
  enqueuePhotoIcs,
  getIcsQueueStatus,
  IcsQueueStatusResponse,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface AnimalIcsPanelProps {
  animal: Animal;
  photos: Photo[];
  onSelectPhoto?: (index: number) => void;
  onAnimalUpdated?: () => void;
}

export default function AnimalIcsPanel({
  animal,
  photos,
  onSelectPhoto,
  onAnimalUpdated,
}: AnimalIcsPanelProps) {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const [processingPhotoId, setProcessingPhotoId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<IcsQueueStatusResponse | null>(null);
  const [progress, setProgress] = useState<{
    processedCount: number;
    remainingQueued: number;
  } | null>(null);

  const ics = animal.ics;
  const isCalculated = ics?.status === "CALCULATED" && typeof ics.score === "number";

  const hasQueuedOrProcessing = photos.some(
    (p) => p.ics?.status === "QUEUED" || p.ics?.status === "PROCESSING"
  );
  const pendingPhotosCount = photos.filter((p) => p.ics?.status !== "CALCULATED").length;

  const refreshQueueStatus = useCallback(async () => {
    try {
      const status = await getIcsQueueStatus(animal.id);
      setQueueStatus(status);
    } catch {
      // Silencia erros pontuais de leitura de fila
    }
  }, [animal.id]);

  useEffect(() => {
    if (photos.length === 0) return;
    if (hasQueuedOrProcessing || requesting) {
      refreshQueueStatus();
    }
  }, [photos.length, hasQueuedOrProcessing, requesting, refreshQueueStatus]);

  useEffect(() => {
    if (!hasQueuedOrProcessing || requesting) return;
    const interval = setInterval(() => {
      refreshQueueStatus();
      onAnimalUpdated?.();
    }, 5000);
    return () => clearInterval(interval);
  }, [hasQueuedOrProcessing, requesting, refreshQueueStatus, onAnimalUpdated]);

  const handleRequestAnimalIcs = async (force = false) => {
    if (requesting || photos.length === 0) return;
    setRequesting(true);
    setProgress(null);
    try {
      const enq = await enqueueAnimalIcs(animal.id, force);
      toast(enq.message || "Fotos enviadas para avaliação.", "info");
      await refreshQueueStatus();
      onAnimalUpdated?.();

      const drain = await drainIcsQueue({
        animalId: animal.id,
        onProgress: (info) => {
          setProgress({
            processedCount: info.processedCount,
            remainingQueued: info.remainingQueued,
          });
          onAnimalUpdated?.();
        },
      });

      await refreshQueueStatus();
      onAnimalUpdated?.();

      if (drain.processedCount > 0) {
        toast(
          `Avaliação concluída para ${drain.processedCount} captura(s).`,
          "success"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível avaliar o ICS.";
      toast(msg, "error");
    } finally {
      setRequesting(false);
      setProgress(null);
    }
  };

  const handleRequestPhotoIcs = async (photoId: string) => {
    if (requesting || processingPhotoId) return;
    setProcessingPhotoId(photoId);
    try {
      const enq = await enqueuePhotoIcs(photoId);
      toast(enq.message || `Na fila (posição #${enq.position}).`, "info");
      await refreshQueueStatus();
      onAnimalUpdated?.();

      await drainIcsQueue({
        animalId: animal.id,
        onProgress: () => {
          onAnimalUpdated?.();
        },
      });

      await refreshQueueStatus();
      onAnimalUpdated?.();
      toast("ICS atualizado com sucesso.", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao avaliar esta foto.";
      toast(msg, "error");
    } finally {
      setProcessingPhotoId(null);
    }
  };

  const validScores = photos
    .map((p) => p.score)
    .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
  const avgFraming =
    validScores.length > 0
      ? Math.round(validScores.reduce((acc, s) => acc + s, 0) / validScores.length)
      : null;

  const orderedWithIndex = photos
    .map((photo, originalIndex) => ({ photo, originalIndex }))
    .sort((a, b) => {
      const ta = a.photo.createdAt ? new Date(a.photo.createdAt).getTime() : 0;
      const tb = b.photo.createdAt ? new Date(b.photo.createdAt).getTime() : 0;
      return tb - ta;
    });

  const activeAnimalQueueJobs = (queueStatus?.jobs ?? []).filter(
    (j) => j.animalId === animal.id
  );
  const firstQueuePosition = activeAnimalQueueJobs.find((j) => j.position)?.position;

  // Posição percentual do score na escala zootécnica 1.0 a 5.0
  const scorePercent =
    isCalculated && typeof ics.score === "number"
      ? Math.max(0, Math.min(100, ((ics.score - 1) / 4) * 100))
      : null;

  return (
    <div className="space-y-4">
      {/* Resumo de Condição Corporal */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-theme-primary">
              Índice de Condição Corporal (ICS)
            </h2>
            <p className="text-xs text-theme-secondary mt-0.5">
              {requesting
                ? progress
                  ? `Analisando capturas (${progress.processedCount} concluídas, ${progress.remainingQueued} restantes)…`
                  : "Processando fila de avaliação…"
                : hasQueuedOrProcessing
                  ? firstQueuePosition
                    ? `Na fila para avaliação (posição #${firstQueuePosition}).`
                    : "Capturas aguardando na fila de avaliação."
                  : isCalculated
                    ? "Avaliação calculada com base nas capturas do animal."
                    : photos.length > 0
                      ? "Solicite a avaliação para calcular o ICS a partir das fotos salvas."
                      : "Registre uma captura para habilitar a avaliação de ICS."}
            </p>
          </div>

          {photos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {pendingPhotosCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleRequestAnimalIcs(false)}
                  disabled={requesting || Boolean(processingPhotoId)}
                  className="btn-primary !py-2 !px-3.5 !min-h-[38px] text-xs"
                >
                  {requesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {requesting
                      ? "Avaliando…"
                      : hasQueuedOrProcessing
                        ? "Processar fila"
                        : `Avaliar ICS (${pendingPhotosCount})`}
                  </span>
                </button>
              )}

              {isCalculated && (
                <button
                  type="button"
                  onClick={() => handleRequestAnimalIcs(true)}
                  disabled={requesting || Boolean(processingPhotoId)}
                  className="btn-secondary !py-2 !px-3 !min-h-[38px] text-xs"
                  title="Reenviar todas as fotos para nova avaliação de ICS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${requesting ? "animate-spin" : ""}`} />
                  <span>Reavaliar</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Régua visual da escala 1,0 a 5,0 quando calculado */}
        {isCalculated && scorePercent !== null && (
          <div className="card-subtle p-3.5 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-theme-secondary">Escala 1,0 – 5,0</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {ics.score?.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs font-semibold text-theme-primary">
                  {ics.classification}
                </span>
              </div>
            </div>

            <div className="relative h-2 rounded-full bg-theme-surface border border-theme overflow-visible">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 opacity-85"
                style={{ width: "100%" }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-700 shadow-sm"
                style={{ left: `${scorePercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] font-medium text-theme-muted tabular-nums">
              <span>1,0 Magro</span>
              <span>3,0 Ideal</span>
              <span>5,0 Sobrepeso</span>
            </div>
          </div>
        )}

        {/* Métricas objetivas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card-subtle p-3.5">
            <span className="text-[11px] font-semibold text-theme-muted block">
              Nota ICS
            </span>
            {isCalculated ? (
              <>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                  {ics.score?.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-xs text-theme-secondary mt-0.5">{ics.classification}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-theme-primary mt-1 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {ics?.status === "QUEUED"
                    ? "Na fila"
                    : ics?.status === "PROCESSING"
                      ? "Avaliando…"
                      : ics?.status === "FAILED" || ics?.status === "ERROR"
                        ? "Não identificado"
                        : "Não avaliado"}
                </p>
                <p className="text-[11px] text-theme-muted mt-0.5">Escala 1,0 a 5,0</p>
              </>
            )}
          </div>

          <div className="card-subtle p-3.5">
            <span className="text-[11px] font-semibold text-theme-muted block">
              Condição corporal
            </span>
            {isCalculated && ics.slaughterStatus !== "IN_DEVELOPMENT" ? (
              <>
                <p
                  className={`text-sm font-bold mt-1 inline-flex items-center gap-1.5 ${
                    ics.slaughterReady
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {ics.slaughterLabel || (ics.slaughterReady ? "Apto" : "Em acompanhamento")}
                </p>
                <p className="text-[11px] text-theme-secondary mt-0.5 line-clamp-1" title={ics.slaughterReason}>
                  {ics.slaughterReason}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-theme-secondary mt-1">Aguardando ICS</p>
                <p className="text-[11px] text-theme-muted mt-0.5">Definida após avaliação</p>
              </>
            )}
          </div>

          <div className="card-subtle p-3.5">
            <span className="text-[11px] font-semibold text-theme-muted block">
              Qualidade média das fotos
            </span>
            <p className="text-lg font-bold text-theme-primary tabular-nums mt-1">
              {avgFraming !== null ? `${avgFraming}%` : "—"}
            </p>
            <p className="text-[11px] text-theme-muted mt-0.5">
              {validScores.length > 0
                ? `${validScores.length} ${validScores.length === 1 ? "captura avaliada" : "capturas avaliadas"}`
                : "Sem capturas"}
            </p>
          </div>
        </div>
      </div>

      {/* Histórico cronológico de avaliações */}
      {photos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-theme-surface-2 border-b border-theme flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-theme-primary">
              Histórico por captura ({photos.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme bg-theme-surface text-[11px] text-theme-muted">
                  <th className="py-2.5 px-3.5 font-semibold">Data</th>
                  <th className="py-2.5 px-3.5 font-semibold">Enquadramento</th>
                  <th className="py-2.5 px-3.5 font-semibold">ICS</th>
                  <th className="py-2.5 px-3.5 font-semibold">Classificação</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {orderedWithIndex.map(({ photo, originalIndex }) => {
                  const photoIcs = photo.ics;
                  const photoCalculated =
                    photoIcs?.status === "CALCULATED" && typeof photoIcs.score === "number";
                  const photoQueued =
                    photoIcs?.status === "QUEUED" || photoIcs?.status === "PROCESSING";
                  const isBusy = processingPhotoId === photo.id;
                  const dateLabel = photo.createdAt
                    ? new Date(photo.createdAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—";

                  return (
                    <tr key={photo.id} className="hover:bg-theme-surface-2/60 transition-colors">
                      <td className="py-2.5 px-3.5 text-theme-secondary whitespace-nowrap tabular-nums">
                        {dateLabel}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold tabular-nums">
                        {typeof photo.score === "number" ? (
                          <span
                            className={
                              photo.score >= 70
                                ? "text-emerald-700 dark:text-emerald-400"
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
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {photoCalculated ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {photoIcs.score?.toFixed(2).replace(".", ",")}
                          </span>
                        ) : photoQueued ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {photoIcs?.status === "PROCESSING" ? "Avaliando" : "Na fila"}
                          </span>
                        ) : photoIcs?.status === "FAILED" || photoIcs?.status === "ERROR" ? (
                          <span className="text-[11px] font-medium text-rose-500">
                            Não identificado
                          </span>
                        ) : (
                          <span className="text-[11px] text-theme-muted">Não avaliado</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-theme-secondary">
                        {photoCalculated ? photoIcs.classification : "—"}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleRequestPhotoIcs(photo.id)}
                            disabled={requesting || Boolean(processingPhotoId)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-secondary hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : photoCalculated ? (
                              <RefreshCw className="w-3 h-3" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            <span>{photoCalculated ? "Reavaliar" : "Avaliar"}</span>
                          </button>

                          {onSelectPhoto && (
                            <button
                              type="button"
                              onClick={() => onSelectPhoto(originalIndex)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver</span>
                            </button>
                          )}
                        </div>
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
