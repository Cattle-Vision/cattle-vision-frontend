'use client';

/**
 * PhotoGrid — Grade de fotos responsiva com metadados de IA e proxy autenticado (`src/components/PhotoGrid.tsx`).
 */
import { Trash2, ImageOff, ZoomIn, Activity, Calendar, Camera } from 'lucide-react';
import { Photo, getPhotoUrl } from '@/lib/types';
import { AsyncPhoto } from '@/components/AsyncPhoto';

interface PhotoGridProps {
  photos: Photo[];
  onDelete?: (photoId: string) => void;
  onSelect: (photo: Photo, index: number) => void;
}

function PhotoCard({
  photo,
  onDelete,
  onSelect,
  index,
}: {
  photo: Photo;
  onDelete?: (id: string) => void;
  onSelect: (photo: Photo, index: number) => void;
  index: number;
}) {
  // Solicita miniatura redimensionada (480px) para carregamento rápido na grade
  const url = getPhotoUrl(photo.id, 480);

  const formattedDate = photo.createdAt
    ? new Date(photo.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const hasScore = typeof photo.score === 'number' && !Number.isNaN(photo.score);
  const isHighScore = hasScore && (photo.score as number) >= 45;
  const icsCalculated =
    photo.ics?.status === 'CALCULATED' && typeof photo.ics.score === 'number';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(photo, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(photo, index);
        }
      }}
      aria-label={`Ver foto ${index + 1}`}
      className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer select-none group active:scale-[0.99] transition-all bg-theme-surface-2 border border-theme shadow-xs hover:border-emerald-500/60"
    >
      <AsyncPhoto
        src={url}
        alt={`Foto ${index + 1}`}
        loadingLabel="Carregando foto…"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        fallbackIcon={<ImageOff className="w-7 h-7 text-theme-muted" />}
      />

      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />

      {hasScore && (
        <div
          title={`Enquadramento anatômico (YOLO): ${Math.round(photo.score as number)}%`}
          className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums backdrop-blur-md shadow-xs pointer-events-none ${
            isHighScore
              ? 'bg-emerald-600/90 text-white'
              : 'bg-amber-600/90 text-white'
          }`}
        >
          <Activity className="w-3 h-3" />
          Enq. {Math.round(photo.score as number)}%
        </div>
      )}

      <div
        title={
          icsCalculated
            ? `ICS calculado: ${photo.ics?.score?.toFixed(1)}`
            : 'Módulo de IA para ICS ainda em desenvolvimento'
        }
        className={`absolute bottom-8 left-2.5 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold backdrop-blur-md pointer-events-none ${
          icsCalculated
            ? 'bg-emerald-600/90 text-white'
            : 'bg-black/65 text-amber-300 border border-amber-400/30'
        }`}
      >
        {icsCalculated ? `ICS ${photo.ics?.score?.toFixed(1)}` : 'ICS: Em dev'}
      </div>

      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <div className="bg-black/65 text-white p-2.5 rounded-full backdrop-blur-sm shadow-lg">
          <ZoomIn className="w-5 h-5" />
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(photo.id);
          }}
          aria-label="Apagar foto"
          className="absolute top-2.5 right-2.5 z-10 bg-black/60 hover:bg-red-600 active:bg-red-700 text-white p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 shadow-lg backdrop-blur-sm cursor-pointer active:scale-90"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white pointer-events-none">
        <span className="text-xs font-bold tracking-tight">
          Captura #{index + 1}
        </span>
        {formattedDate && (
          <span className="text-[10px] text-white/80 flex items-center gap-1 font-medium">
            <Calendar className="w-2.5 h-2.5" />
            {formattedDate}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PhotoGrid({
  photos,
  onDelete,
  onSelect,
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="col-span-full py-14 px-4 text-center flex flex-col items-center gap-3 bg-theme-surface border border-dashed border-theme rounded-lg">
        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Camera className="w-6 h-6 stroke-[1.75]" />
        </div>
        <div>
          <p className="text-sm font-bold text-theme-primary">
            Nenhuma foto registrada para este animal
          </p>
          <p className="text-xs text-theme-secondary mt-1 max-w-xs mx-auto">
            Use a câmera guiada para capturar o animal ou envie uma foto da galeria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          index={index}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
