"use client";

/**
 * Painel de Avaliação Corporal (ICS), Contorno e Aptidão para Abate (`src/components/animal/AnimalIcsPanel.tsx`).
 *
 * Arquitetura:
 * - Inferência executada exclusivamente no backend via modelo `YOLO26m` ONNX.
 * - Como o modelo de ICS (~78 MB) é mais pesado, o processamento utiliza uma fila persistente
 *   em PostgreSQL (`IcsJob`) no servidor: o usuário solicita a geração, visualiza sua posição
 *   na fila e acompanha o cálculo em tempo real.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
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
      // Silencia erros intermitentes de consulta de status para não poluir a interface
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
      toast(enq.message || "Solicitação enviada para a fila de ICS.", "info");
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
          `Avaliação de ICS concluída para ${drain.processedCount} captura(s)!`,
          "success"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar fila de ICS.";
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
      toast(
        enq.message || `Foto enviada para a fila (posição #${enq.position}).`,
        "info"
      );
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
      toast("ICS da captura atualizado com sucesso!", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar ICS desta foto.";
      toast(msg, "error");
    } finally {
      setProcessingPhotoId(null);
    }
  };

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

  const activeAnimalQueueJobs = (queueStatus?.jobs ?? []).filter(
    (j) => j.animalId === animal.id
  );
  const firstQueuePosition = activeAnimalQueueJobs.find((j) => j.position)?.position;

  return (
    <div className="space-y-4">
      {/* Banner de status do motor YOLO26m e fila persistente de ICS */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          requesting || hasQueuedOrProcessing
            ? "bg-blue-500/10 border-blue-500/30"
            : isCalculated
              ? "bg-emerald-500/10 border-emerald-500/30"
              : ics?.status === "FAILED" || ics?.status === "ERROR"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-theme-surface-2 border-theme"
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              requesting || hasQueuedOrProcessing
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                : isCalculated
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {requesting || hasQueuedOrProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isCalculated ? (
              <Sparkles className="w-4 h-4" />
            ) : ics?.status === "FAILED" || ics?.status === "ERROR" ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-theme-primary">
                {requesting
                  ? "Processando fila de ICS no servidor…"
                  : hasQueuedOrProcessing
                    ? "Captura(s) na fila de cálculo ICS"
                    : isCalculated
                      ? "IA de ICS (YOLO26m) ativa no servidor"
                      : ics?.status === "FAILED" || ics?.status === "ERROR"
                        ? "Não foi possível identificar o ICS automaticamente"
                        : "Avaliação de ICS sob demanda (YOLO26m)"}
              </h3>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  requesting || hasQueuedOrProcessing
                    ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                    : isCalculated
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-theme-surface text-theme-secondary border border-theme"
                }`}
              >
                {requesting && progress
                  ? `Processadas: ${progress.processedCount} · Restantes: ${progress.remainingQueued}`
                  : firstQueuePosition
                    ? `Posição na fila: #${firstQueuePosition}`
                    : isCalculated
                      ? ics.aiModelVersion || "yolo26m-ics"
                      : "Fila no backend"}
              </span>
            </div>

            <p className="text-[11px] text-theme-secondary mt-1 leading-relaxed">
              {requesting
                ? "Executando inferência do modelo YOLO26m no servidor (1 foto por etapa para estabilidade)."
                : ics?.message ||
                  "Como o modelo de ICS é mais pesado, as análises entram em uma fila persistente no backend."}
            </p>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingPhotosCount > 0 && (
              <button
                type="button"
                onClick={() => handleRequestAnimalIcs(false)}
                disabled={requesting || Boolean(processingPhotoId)}
                className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
              >
                {requesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {requesting
                    ? "Processando fila…"
                    : hasQueuedOrProcessing
                      ? "Processar fila agora"
                      : `Solicitar geração de ICS (${pendingPhotosCount})`}
                </span>
              </button>
            )}

            {isCalculated && (
              <button
                type="button"
                onClick={() => handleRequestAnimalIcs(true)}
                disabled={requesting || Boolean(processingPhotoId)}
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
                title="Enviar todas as fotos deste animal novamente para a fila de ICS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${requesting ? "animate-spin" : ""}`} />
                <span>Regerar ICS</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resumo comparativo: ICS vs Enquadramento YOLO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-theme-surface-2 border border-theme">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted block">
            ICS (Escala 1,0–5,0)
          </span>
          {isCalculated ? (
            <>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {ics.score?.toFixed(2)}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                {ics.classification || "Classificação calculada"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {ics?.status === "QUEUED"
                  ? "Na fila do servidor"
                  : ics?.status === "PROCESSING"
                    ? "Calculando…"
                    : ics?.status === "FAILED" || ics?.status === "ERROR"
                      ? "Não identificado"
                      : "Não solicitado"}
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                Solicite a geração para calcular
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
              <p className="text-sm font-bold text-theme-secondary mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0 text-theme-muted" />
                Aguardando ICS
              </p>
              <p className="text-[11px] text-theme-secondary mt-0.5">
                Calculado junto com o ICS
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme bg-theme-surface/60 text-[10px] uppercase tracking-wider text-theme-muted">
                  <th className="py-2 px-3 font-semibold">Data / Hora</th>
                  <th className="py-2 px-3 font-semibold">Enquadramento</th>
                  <th className="py-2 px-3 font-semibold">ICS</th>
                  <th className="py-2 px-3 font-semibold">Abate</th>
                  <th className="py-2 px-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
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
                            {photoIcs.score?.toFixed(2)} · {photoIcs.classification}
                          </span>
                        ) : photoQueued ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {photoIcs?.status === "PROCESSING" ? "Processando" : "Na fila"}
                          </span>
                        ) : photoIcs?.status === "FAILED" || photoIcs?.status === "ERROR" ? (
                          <span className="text-[11px] font-medium text-rose-500">
                            Não identificado
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-theme-muted">
                            Não solicitado
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
                          <span className="text-[11px] text-theme-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleRequestPhotoIcs(photo.id)}
                            disabled={requesting || Boolean(processingPhotoId)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                            title={
                              photoCalculated
                                ? "Regerar ICS desta captura"
                                : "Solicitar geração de ICS desta captura"
                            }
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : photoCalculated ? (
                              <RefreshCw className="w-3 h-3" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {photoCalculated ? "Regerar" : "Gerar ICS"}
                          </button>

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
