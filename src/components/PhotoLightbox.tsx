'use client';

/**
 * PhotoLightbox — Visualizador fullscreen de fotos (`src/components/PhotoLightbox.tsx`).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Activity, Loader2 } from 'lucide-react';
import { Photo, getPhotoUrl } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface PhotoLightboxProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  onPhotoRecalibrated?: (photoId: string, newScore: number) => void;
}

export default function PhotoLightbox({ photos, initialIndex, onClose, onPhotoRecalibrated }: PhotoLightboxProps) {
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [recalibrating, setRecalibrating] = useState(false);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
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

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 m-0 p-0 w-full h-full max-w-none max-h-none bg-slate-950/95 backdrop-blur-md flex items-center justify-center border-none outline-none animate-fade-in"
      style={{ padding: 0 }}
    >
      {/* Top Bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/90 text-xs font-bold bg-white/10 px-2.5 py-1 rounded-md backdrop-blur-sm">
            {currentIndex + 1} / {localPhotos.length}
          </span>
          {hasScore && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Activity className="w-3.5 h-3.5" />
              Enquadramento: {Math.round(currentPhoto.score as number)}%
            </span>
          )}
          {currentPhoto.ics?.status === 'CALCULATED' &&
          typeof currentPhoto.ics.score === 'number' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30">
              ICS: {currentPhoto.ics.score.toFixed(1)} · {currentPhoto.ics.classification}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
              ICS e Contorno: Em desenvolvimento
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Imagem principal */}
      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-10">
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
          <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
            <img
              ref={imgRef}
              key={currentPhoto.id}
              src={url}
              alt={`Foto ${currentIndex + 1}`}
              onLoad={() => setImgStatus('loaded')}
              onError={() => setImgStatus('error')}
              className={`max-w-full max-h-full object-contain rounded-lg animate-scale-in select-none shadow-2xl transition-opacity duration-200 ${
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
      </div>

      {/* Aviso transparente quando a IA de ICS ainda não executa */}
      {currentPhoto.ics?.status !== 'CALCULATED' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/65 border border-amber-400/25 text-[11px] text-amber-200/90 backdrop-blur-sm pointer-events-none whitespace-nowrap max-w-[90vw] truncate"
          style={{
            bottom:
              photos.length > 1
                ? 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 2.25rem)'
                : 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          IA de avaliação de ICS e contorno corporal em desenvolvimento (modelo neural inativo)
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
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-md transition active:scale-95 z-10 backdrop-blur-sm"
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
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-2 rounded-md transition active:scale-95 z-10 backdrop-blur-sm"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Dots de navegação */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm"
          style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
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
    </dialog>
  );
}
