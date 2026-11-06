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

export interface IcsData {
  status: "IN_DEVELOPMENT" | "CALCULATED" | "ERROR";
  score?: number | null;
  scale?: string;
  classification?: string;
  message?: string;
}

export interface Photo {
  id: string;
  animalId?: string;
  filePath?: string;
  view?: string;
  score?: number | null; // Confiança anatômica do enquadramento (0-100)
  ics?: IcsData | null;
  createdAt?: string;
}

export interface CustodyUser {
  id: number;
  name: string;
  email: string;
}

export interface AnimalCollaboratorRecord {
  id: string;
  animalId: string;
  userId: number;
  role: string;
  createdAt: string;
  user: CustodyUser;
}

export interface CustodyInfo {
  isOwner: boolean;
  isCollaborator: boolean;
  canManage: boolean;
  owner: CustodyUser;
  collaborators: AnimalCollaboratorRecord[];
}

export interface RfidScanResult {
  registered: boolean;
  rfid: string;
  animal?: Animal;
  sharedGranted?: boolean;
  isOwner?: boolean;
  message: string;
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
  isOwner?: boolean;
  isShared?: boolean;
  custody?: CustodyInfo;
  createdAt?: string;
  updatedAt?: string;
  ics?: IcsData | null;
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
