/**
 * Definições Globais de Tipos e Helpers de URL do CattleVision Frontend (`src/lib/types.ts`).
 *
 * Integra com a API remota do backend (seja em outro PC, Docker ou Vercel).
 */
import { getApiUrl } from "./api";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "USER" | string;
}

export interface Photo {
  id: string;
  animalId?: string;
  filePath?: string;
  view?: string;
  score?: number | null;
  createdAt?: string;
}

export interface Animal {
  id: string;
  tag: string;
  name: string;
  breed: string;
  sex: string;
  weight: number;
  age: number;
  ownerId: number;
  createdAt?: string;
  updatedAt?: string;
  photos: Photo[];
}

export interface AnimalWithOwner extends Animal {
  owner: {
    name: string;
    email: string;
  };
}

/**
 * Retorna a URL absoluta ou relativa da rota proxy para renderização segura da foto no backend.
 */
export function getPhotoUrl(photoOrId: Pick<Photo, "id"> | string): string {
  const id = typeof photoOrId === "string" ? photoOrId : photoOrId.id;
  const base = getApiUrl();
  return `${base}/api/photos/${encodeURIComponent(id)}`;
}

/**
 * Normaliza caminhos de fotos para visualização universal.
 */
export function filePathToUrl(filePathOrId: string, photoId?: string): string {
  if (photoId) {
    return getPhotoUrl(photoId);
  }
  if (!filePathOrId) return "";
  if (filePathOrId.startsWith("data:")) return filePathOrId;
  if (filePathOrId.startsWith("http://") || filePathOrId.startsWith("https://")) {
    return filePathOrId;
  }
  const clean = filePathOrId.replace(/^\//, "");
  const base = getApiUrl();
  return `${base}/api/${clean}`;
}
