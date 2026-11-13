'use client';

import { useEffect, useState } from 'react';
import { getSyncQueue, clearSyncItem } from '@/lib/sync';
import { getApiUrl, getStoredToken, invalidateApiCache } from '@/lib/api';
import { WifiOff } from 'lucide-react';

interface SyncItem {
  id: number;
  url: string;
  method: string;
  body: { animalId: string; file: ArrayBuffer; fileName: string } | Record<string, unknown>;
  isFormData: boolean;
}

export function SyncManager() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      const queue = (await getSyncQueue()) as SyncItem[];
      let syncedAny = false;
      const baseUrl = getApiUrl();

      for (const item of queue) {
        try {
          let bodyData: FormData | string;
          if (item.isFormData) {
            const fd = new FormData();
            const formBody = item.body as { animalId: string; file: ArrayBuffer; fileName: string };
            fd.append('animalId', formBody.animalId);
            fd.append('view', 'REAR');
            fd.append('file', new Blob([formBody.file], { type: 'image/jpeg' }), formBody.fileName);
            bodyData = fd;
          } else {
            bodyData = JSON.stringify(item.body);
          }

          const headers: Record<string, string> = item.isFormData
            ? {}
            : { 'Content-Type': 'application/json' };

          const token = getStoredToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const targetUrl = item.url.startsWith('http')
            ? item.url
            : `${baseUrl}${item.url.startsWith('/') ? item.url : `/${item.url}`}`;

          const res = await fetch(targetUrl, { method: item.method, body: bodyData, headers });
          if (res.ok) {
            await clearSyncItem(item.id);
            syncedAny = true;
          }
        } catch {
          // Mantém no IndexedDB para retry subsequente
        }
      }

      if (syncedAny) {
        invalidateApiCache('/api/animals');
      }
    };

    window.addEventListener('online', handleOnline);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!mounted || isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-semibold">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Modo offline ativo — fotos capturadas serão enviadas quando a conexão retornar</span>
    </div>
  );
}
