/**
 * Definições Globais de Tipos e Helpers de URL do CattleVision Frontend (`src/lib/types.ts`).
 *
 * Integra com a API remota do backend (seja em outro PC, Docker ou Vercel).
 */
import { getApiUrl } from "./api";

export interface User {
  id: number | string;
  name: string;
  email: string;
  role: "ADMIN" | "USER" | string;
  createdAt?: string;
}

export interface ContourPoint {
  x: number;
  y: number;
}

export type SlaughterStatus = "IN_DEVELOPMENT" | "READY" | "NOT_READY";

export interface IcsData {
  aiAvailable?: boolean;
  status:
    | "IN_DEVELOPMENT"
    | "NOT_REQUESTED"
    | "QUEUED"
    | "PROCESSING"
    | "CALCULATED"
    | "FAILED"
    | "ERROR";
  score?: number | null;
  scale?: string;
  classification?: string;
  slaughterReady?: boolean | null;
  slaughterStatus?: SlaughterStatus;
  slaughterLabel?: string;
  slaughterReason?: string;
  morphologicalFeatures?: Record<string, number> | null;
  contourPoints?: ContourPoint[] | null;
  aiModelVersion?: string | null;
  source?: string;
  estimatedAt?: string;
  message?: string;
}

export interface Photo {
  id: string;
  animalId?: string;
  filePath?: string;
  view?: string;
  score?: number | null; // Confiança anatômica do enquadramento (0-100)
  icsStatus?: string | null;
  icsScore?: number | null;
  icsClassification?: string | null;
  slaughterReady?: boolean | null;
  slaughterStatus?: string | null;
  slaughterReason?: string | null;
  morphologicalFeatures?: Record<string, number> | null;
  contourPoints?: ContourPoint[] | null;
  aiModelVersion?: string | null;
  evaluatedAt?: string | null;
  ics?: IcsData | null;
  createdAt?: string;
}

export interface VaccineRecord {
  id: string;
  animalId: string;
  name: string;
  dose?: string | null;
  batch?: string | null;
  appliedAt: string;
  nextDueAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export type DiseaseStatus = "ACTIVE" | "MONITORING" | "RECOVERED";

export interface DiseaseRecord {
  id: string;
  animalId: string;
  name: string;
  symptoms?: string | null;
  treatment?: string | null;
  status: DiseaseStatus;
  diagnosedAt: string;
  recoveredAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface AnimalLocationLog {
  id: string;
  animalId: string;
  location: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  reason?: string | null;
  movedAt: string;
  createdAt?: string;
}

export type ObservationCategory =
  | "GERAL"
  | "MANEJO"
  | "NUTRICAO"
  | "COMPORTAMENTO"
  | "OUTRA";

export interface AnimalObservation {
  id: string;
  animalId: string;
  category: ObservationCategory;
  title?: string | null;
  content: string;
  observedAt: string;
  createdById?: number | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
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
  length?: number | null;
  location?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  observations?: string | null;
  ownerId: number;
  ics?: IcsData | null;
  vaccines?: VaccineRecord[];
  diseases?: DiseaseRecord[];
  locationLogs?: AnimalLocationLog[];
  observationRecords?: AnimalObservation[];
  isOwner?: boolean;
  isShared?: boolean;
  custody?: CustodyInfo;
  createdAt?: string;
  updatedAt?: string;
  photoCount?: number;
  photos: Photo[];
}

export interface AnimalWithOwner extends Animal {
  owner: {
    name: string;
    email: string;
  };
}

/**
 * Retorna a URL da rota proxy para renderização segura da foto no backend.
 * Quando `width` é informado (ex.: 480 para miniaturas de grade), o backend entrega
 * uma versão redimensionada e negociada em WebP/JPEG para economizar banda móvel.
 */
export function getPhotoUrl(photoOrId: Pick<Photo, "id"> | string, width?: number): string {
  const id = typeof photoOrId === "string" ? photoOrId : photoOrId.id;
  const base = getApiUrl();
  const query = width ? `?w=${Math.round(width)}` : "";
  return `${base}/api/photos/${encodeURIComponent(id)}${query}`;
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
