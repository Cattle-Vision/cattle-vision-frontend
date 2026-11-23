'use client';

/**
 * PhotoLightbox — Visualizador fullscreen de fotos (`src/components/PhotoLightbox.tsx`).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Activity, Loader2, Sparkles } from 'lucide-react';
import { Photo, getPhotoUrl } from '@/lib/types';
import { apiFetch, enqueuePhotoIcs, invalidateApiCache, processNextIcsJob } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onPhotoRecalibrated?: (photoId: string, newScore: number) => void;
  onPhotoIcsUpdated?: (photoId: string) => void;
}

export default function PhotoLightbox({
  photos,
  initialIndex,
  onClose,
  onPhotoRecalibrated,
  onPhotoIcsUpdated,
}: PhotoLightboxProps) {
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [recalibrating, setRecalibrating] = useState(false);
  const [generatingIcs, setGeneratingIcs] = useState(false);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete) {
      setImgStatus(el.naturalWidth > 0 ? 'loaded' : 'error');
      return;
    }
    setImgStatus('loading');
  }, [currentIndex, photos]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target === dialogRef.current || e.target === stageRef.current) onClose();
  };

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      delta < 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  const currentPhoto = localPhotos[currentIndex];
  if (!currentPhoto) return null;

  const currentPhotoRaw = currentPhoto as Photo & {
    icsStatus?: string;
    icsScore?: number | null;
    icsClassification?: string | null;
  };
  const effectiveIcsStatus = currentPhoto.ics?.status || currentPhotoRaw.icsStatus;
  const effectiveIcsScore =
    typeof currentPhoto.ics?.score === 'number'
      ? currentPhoto.ics.score
      : typeof currentPhotoRaw.icsScore === 'number'
        ? currentPhotoRaw.icsScore
        : null;
  const effectiveIcsClass =
    currentPhoto.ics?.classification || currentPhotoRaw.icsClassification || '';

  const url = getPhotoUrl(currentPhoto.id);
  const hasScore = typeof currentPhoto.score === 'number' && !Number.isNaN(currentPhoto.score);

  const handleRecalibrateCurrent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recalibrating || !currentPhoto) return;
    setRecalibrating(true);
    try {
      const data = await apiFetch<any>(`/api/photos/${currentPhoto.id}/recalibrate`, { method: 'POST' });
      const updatedScore =
        typeof data?.newScore === 'number'
          ? data.newScore
          : typeof data?.score === 'number'
          ? data.score
          : data?.photo?.score ?? currentPhoto.score;
      setLocalPhotos((prev) =>
        prev.map((p, idx) => (idx === currentIndex ? { ...p, score: updatedScore } : p))
      );
      onPhotoRecalibrated?.(currentPhoto.id, updatedScore);
    } catch (err: any) {
      toast(err?.message || 'Erro ao recalcular enquadramento da foto.', 'error');
    } finally {
      setRecalibrating(false);
    }
  };

  const handleGenerateCurrentIcs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (generatingIcs || !currentPhoto) return;
    const targetPhotoId = currentPhoto.id;
    setGeneratingIcs(true);
    try {
      const enq = await enqueuePhotoIcs(targetPhotoId);
      setLocalPhotos((prev) =>
        prev.map((p) =>
          p.id === targetPhotoId
            ? {
                ...p,
                ics: {
                  ...(p.ics || {
                    scale: '1.0 - 5.0',
                    classification: 'Na fila',
                    slaughterReady: null,
                    slaughterStatus: 'IN_DEVELOPMENT',
                    slaughterLabel: 'Na fila',
                    slaughterReason: enq.message,
                    morphologicalFeatures: null,
                    contourPoints: null,
                    aiModelVersion: null,
                    message: enq.message,
                    source: 'internal-backend',
                    estimatedAt: new Date().toISOString(),
                  }),
                  status: 'QUEUED',
                },
              }
            : p
        )
      );
      toast(enq.message || `Foto na fila (posição #${enq.position}).`, 'info');

      for (let i = 0; i < 60; i += 1) {
        const step = await processNextIcsJob(currentPhoto.animalId);
        if (!step.processed) break;
        if (step.job?.photoId === targetPhotoId && step.ics) {
          const updatedIcs = step.ics as any;
          setLocalPhotos((prev) =>
            prev.map((p) =>
              p.id === targetPhotoId
                ? {
                    ...p,
                    ics: updatedIcs,
                    contourPoints: updatedIcs.contourPoints ?? p.contourPoints,
                  }
                : p
            )
          );
          invalidateApiCache('/api/animals');
          invalidateApiCache('/api/admin/animals');
          onPhotoIcsUpdated?.(targetPhotoId);
          toast(
            typeof updatedIcs.score === 'number'
              ? `ICS calculado: ${updatedIcs.score.toFixed(2)} (${updatedIcs.classification})`
              : updatedIcs.message || 'Processamento de ICS finalizado.',
            updatedIcs.status === 'CALCULATED' ? 'success' : 'info'
          );
          break;
        }
        if (step.remainingQueued <= 0) break;
      }
    } catch (err: any) {
      toast(err?.message || 'Erro ao solicitar geração de ICS.', 'error');
    } finally {
      setGeneratingIcs(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 m-0 p-0 w-full h-[100dvh] max-w-none max-h-none bg-slate-950/95 backdrop-blur-md flex flex-col border-none outline-none animate-fade-in overflow-hidden"
      style={{ padding: 0 }}
    >
      {/* Top Bar dedicada (sem sobrepor nem cortar a imagem) */}
      <div
        className="relative z-20 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-black/60 border-b border-white/10"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <span className="text-white/90 text-xs font-bold bg-white/10 px-2.5 py-1 rounded-md backdrop-blur-sm">
            {currentIndex + 1} / {localPhotos.length}
          </span>
          {hasScore && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Activity className="w-3.5 h-3.5" />
              Enquadramento: {Math.round(currentPhoto.score as number)}%
            </span>
          )}
          {effectiveIcsStatus === 'CALCULATED' && effectiveIcsScore !== null ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
              ICS: {effectiveIcsScore.toFixed(2)}
              {effectiveIcsClass ? ` · ${effectiveIcsClass}` : ''}
            </span>
          ) : effectiveIcsStatus === 'QUEUED' || effectiveIcsStatus === 'PROCESSING' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
              <Loader2 className="w-3 h-3 animate-spin" />
              {effectiveIcsStatus === 'PROCESSING' ? 'Calculando ICS…' : 'ICS: Na fila'}
            </span>
          ) : effectiveIcsStatus === 'FAILED' || effectiveIcsStatus === 'ERROR' ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-400/30">
              ICS: Não identificado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-white/80 border border-white/20">
              ICS: Aguardando solicitação
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleGenerateCurrentIcs}
            disabled={generatingIcs}
            aria-label="Gerar ICS"
            className="bg-blue-600/80 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-md transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 min-h-[38px]"
            title="Solicitar cálculo de ICS desta foto na fila do servidor"
          >
            {generatingIcs ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-200" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            )}
            <span className="hidden xs:inline">
              {generatingIcs
                ? 'Na fila…'
                : effectiveIcsStatus === 'CALCULATED'
                  ? 'Regerar ICS'
                  : 'Gerar ICS'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleRecalibrateCurrent}
            disabled={recalibrating}
            aria-label="Recalcular Enquadramento"
            className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-md transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50 min-h-[38px]"
            title="Recalcular enquadramento desta foto com o modelo neural"
          >
            {recalibrating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden xs:inline">
              {recalibrating ? 'Calculando…' : 'Recalcular'}
            </span>
          </button>
          <a
            href={url}
            download={`cattle_photo_${currentPhoto.id}.jpg`}
            onClick={(e) => e.stopPropagation()}
            aria-label="Baixar imagem"
            className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md transition active:scale-95"
            title="Baixar imagem"
          >
            <Download className="w-4.5 h-4.5" />
          </a>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-md transition active:scale-95"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Palco central da imagem: ocupa exatamente o espaço livre sem cortar nenhuma borda */}
      <div
        ref={stageRef}
        onClick={handleBackdropClick}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center px-3 py-3 sm:px-14 sm:py-5 overflow-hidden"
      >
        {imgStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-xs font-medium text-white/80">
              Carregando imagem em alta resolução…
            </span>
          </div>
        )}

        {imgStatus === 'error' ? (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <span className="text-sm font-medium">Não foi possível carregar esta imagem.</span>
          </div>
        ) : (
          <div className="relative flex items-center justify-center max-w-full max-h-full">
            <img
              ref={imgRef}
              key={currentPhoto.id}
              src={url}
              alt={`Foto ${currentIndex + 1}`}
              onLoad={() => setImgStatus('loaded')}
              onError={() => setImgStatus('error')}
              className={`block w-auto h-auto max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-7rem)] max-h-[calc(100dvh-9.5rem)] object-contain rounded-lg animate-scale-in select-none shadow-2xl transition-opacity duration-200 ${
                imgStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
              }`}
              draggable={false}
            />
            {imgStatus === 'loaded' &&
              Array.isArray(currentPhoto.contourPoints) &&
              currentPhoto.contourPoints.length >= 2 && (
                <svg
                  viewBox={
                    Math.max(...currentPhoto.contourPoints.map((pt) => Math.max(pt.x, pt.y))) <= 1.05
                      ? '0 0 1 1'
                      : '0 0 100 100'
                  }
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
                >
                  <polygon
                    points={currentPhoto.contourPoints.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                    fill="rgba(16, 185, 129, 0.14)"
                    stroke="#34d399"
                    strokeWidth={
                      Math.max(...currentPhoto.contourPoints.map((pt) => Math.max(pt.x, pt.y))) <= 1.05
                        ? '0.006'
                        : '0.6'
                    }
                  />
                </svg>
              )}
          </div>
        )}

        {/* Botão anterior */}
        {photos.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Foto anterior"
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-md transition active:scale-95 z-10 backdrop-blur-sm border border-white/15"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Botão próximo */}
        {photos.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Próxima foto"
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-md transition active:scale-95 z-10 backdrop-blur-sm border border-white/15"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Barra inferior para status da fila e dots de navegação sem cobrir a foto */}
      {(photos.length > 1 ||
        effectiveIcsStatus === 'QUEUED' ||
        effectiveIcsStatus === 'PROCESSING') && (
        <div
          className="relative z-20 shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 bg-black/50 border-t border-white/10"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {(effectiveIcsStatus === 'QUEUED' || effectiveIcsStatus === 'PROCESSING') && (
            <div className="px-3 py-1 rounded-full bg-black/70 border border-blue-400/30 text-[11px] text-blue-200 whitespace-nowrap max-w-[90vw] truncate">
              Calculando ICS no servidor (modelo YOLO26m ONNX)…
            </div>
          )}

          {photos.length > 1 && (
            <div className="flex gap-2 bg-black/40 px-3 py-1.5 rounded-full">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                  aria-label={`Ir para foto ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex ? 'bg-emerald-400 scale-125 w-4' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
