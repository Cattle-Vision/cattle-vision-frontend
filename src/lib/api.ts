/**
 * Cliente HTTP Universal e Adaptador de Comunicação Cross-Origin (`src/lib/api.ts`)
 *
 * Responsável por conectar o Frontend Next.js ao Servidor de API (Backend).
 * Suporta instâncias rodando em:
 * - PCs e servidores locais diferentes (ex: backend em 192.168.1.100:3001)
 * - Vercel Serverless / Domínios separados (ex: api.meusite.com)
 * - Docker Compose em redes bridge ou hosts físicos independentes
 *
 * Gerencia tokens de autenticação JWT Bearer no localStorage (`cattle_vision_jwt_token`).
 * Possui interceptador Self-Healing que limpa credenciais inválidas em respostas 401.
 */

import {
  Animal,
  AnimalLocationLog,
  AnimalObservation,
  DiseaseRecord,
  DiseaseStatus,
  ObservationCategory,
  RfidScanResult,
  User,
  VaccineRecord,
} from "./types";

const TOKEN_KEY = "cattle_vision_jwt_token";
const USER_CACHE_KEY = "cattle_vision_user_cache";
const SESSION_API_CACHE_PREFIX = "cv_api_cache:";

/** Cache em memória + sessionStorage estilo stale-while-revalidate para navegação instantânea */
const responseCache = new Map<string, { data: unknown; timestamp: number }>();
const inflightRequests = new Map<string, Promise<unknown>>();

function readSessionApiCache(cleanEndpoint: string): { data: unknown; timestamp: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_API_CACHE_PREFIX}${cleanEndpoint}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: unknown; timestamp: number };
    if (!parsed || typeof parsed.timestamp !== "number") return null;
    responseCache.set(cleanEndpoint, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionApiCache(cleanEndpoint: string, data: unknown, timestamp: number): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify({ data, timestamp });
    if (serialized.length > 450_000) return;
    sessionStorage.setItem(`${SESSION_API_CACHE_PREFIX}${cleanEndpoint}`, serialized);
  } catch {
    // Ignora limite de quota
  }
}

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    if (typeof window !== "undefined") {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(SESSION_API_CACHE_PREFIX)) {
            sessionStorage.removeItem(k);
          }
        }
      } catch {
        // ignore
      }
    }
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
  if (typeof window !== "undefined") {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`${SESSION_API_CACHE_PREFIX}${prefix}`)) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // ignore
    }
  }
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return parsed && parsed.id && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Ignora quota errors de storage
  }
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    // Garante que a mensagem contenha o status HTTP para compatibilidade com verificações existentes
    const fullMessage = message.includes(String(status))
      ? message
      : `${message} (${status})`;
    super(fullMessage);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

/**
 * Obtém a URL base do backend configurada.
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    // Em dev local (porta 3000 -> 3001), conecta direto na porta local;
    // em producao/HTTPS usa proxy same-origin (/api/* via next.config.ts) para eliminar
    // preflight OPTIONS e segundo handshake TLS em cada rota dinamica.
    if (window.location.port === "3000") {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return "";
  }
  if (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim() !== "") {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "http://localhost:3001";
}

/**
 * Recupera o token JWT armazenado no cliente.
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Salva o token JWT no armazenamento local.
 */
export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.error("Erro ao persistir token de autenticação:", err);
  }
}

/**
 * Remove o token JWT e limpa eventuais resquícios de sessão legada.
 */
export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    invalidateApiCache();
    sessionStorage.removeItem("cv_auth_verified_at");
    // Limpeza de tokens legados caso existam
    localStorage.removeItem("cv_token");
    localStorage.removeItem("token");
    // Limpa cookies antigos de NextAuth caso ainda persistam no navegador
    document.cookie = "next-auth.session-token=; path=/; max-age=0";
    document.cookie = "__Secure-next-auth.session-token=; path=/; max-age=0";
    document.cookie = "authjs.session-token=; path=/; max-age=0";
  } catch (err) {
    console.error("Erro ao remover token:", err);
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: any;
}

/**
 * Realiza chamadas HTTP com injeção automática de Bearer Token, headers CORS e
 * interceptador automático de erro 401 para auto-recuperação de sessão.
 */
export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});

  // Anexa o token JWT Bearer se disponível
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let errorDetail = "";
    let errJson: any = null;
    try {
      errJson = await response.json();
      errorDetail = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }

    // Interceptador de 401: Token inválido, expirado ou segredo JWT alterado no backend
    if (response.status === 401) {
      clearStoredToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { endpoint } }));
      }
    }

    throw new ApiError(
      errorDetail || `Falha na requisição (${response.status} ${response.statusText})`,
      response.status,
      errJson
    );
  }

  const method = (options.method || "GET").toUpperCase();
  const isMutation = method !== "GET" && method !== "HEAD";

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ((await response.text()) as unknown as T);

  if (isMutation) {
    // Mutações invalidam caches relacionados para evitar dados defasados ao voltar ao painel
    if (cleanEndpoint.startsWith("/api/animals") || cleanEndpoint.startsWith("/api/photos")) {
      invalidateApiCache("/api/animals");
      invalidateApiCache("/api/admin");
    } else if (cleanEndpoint.startsWith("/api/admin")) {
      invalidateApiCache("/api/admin");
      invalidateApiCache("/api/animals");
    }
  }

  return result;
}

/**
 * Leitura GET com cache em memória (SWR) e deduplicação de requisições concorrentes.
 * Entrega imediatamente o cache local se disponível e revalida em segundo plano quando expirado.
 */
export function getApiCacheSnapshot<T = any>(endpoint: string): T | null {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const entry = responseCache.get(cleanEndpoint) ?? readSessionApiCache(cleanEndpoint);
  return entry ? (entry.data as T) : null;
}

export async function apiFetchCached<T = any>(
  endpoint: string,
  ttlMs = 15_000
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const cached = responseCache.get(cleanEndpoint) ?? readSessionApiCache(cleanEndpoint);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const inflight = inflightRequests.get(cleanEndpoint);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = apiFetch<T>(cleanEndpoint)
    .then((data) => {
      const now = Date.now();
      responseCache.set(cleanEndpoint, { data, timestamp: now });
      writeSessionApiCache(cleanEndpoint, data, now);
      return data;
    })
    .finally(() => {
      inflightRequests.delete(cleanEndpoint);
    });

  inflightRequests.set(cleanEndpoint, promise);
  return promise;
}

/** Pre-aquece em background a rota GET caso nao haja cache recente */
export function prefetchApi(endpoint: string, ttlMs = 15_000): void {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  void apiFetchCached(endpoint, ttlMs).catch(() => {});
}

/**
 * Envia código RFID (lido via ESP32 Bluetooth ou manual) para identificação global
 * e adesão automática à Guarda Compartilhada.
 */
export async function scanRfidTag(rfid: string): Promise<RfidScanResult> {
  return apiFetch<RfidScanResult>("/api/animals/rfid-scan", {
    method: "POST",
    body: { rfid },
  });
}

/**
 * Convida manualmente um colaborador para a guarda compartilhada de um animal.
 */
export async function addCollaborator(
  animalId: string,
  payload: { email?: string; userId?: number }
): Promise<{ added: boolean; message: string; custody?: any }> {
  return apiFetch(`/api/animals/${encodeURIComponent(animalId)}/collaborators`, {
    method: "POST",
    body: payload,
  });
}

/**
 * Remove um colaborador da guarda compartilhada de um animal.
 */
export async function removeCollaborator(
  animalId: string,
  targetUserId: number
): Promise<{ success: boolean; message: string; custody?: any }> {
  return apiFetch(
    `/api/animals/${encodeURIComponent(animalId)}/collaborators/${targetUserId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Transfere a guarda definitiva / propriedade principal do animal para outro produtor.
 */
export async function transferOwnership(
  animalId: string,
  newOwnerId: number
): Promise<{ success: boolean; message: string; custody?: any }> {
  return apiFetch(`/api/animals/${encodeURIComponent(animalId)}/transfer-ownership`, {
    method: "POST",
    body: { newOwnerId },
  });
}

/**
 * Realiza upload multipart de imagens com suporte a progresso e Bearer token.
 */
export async function apiUpload<T = any>(endpoint: string, formData: FormData): Promise<T> {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers = new Headers();
  const token = getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = "";
    let errJson: any = null;
    try {
      errJson = await response.json();
      errorDetail = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }

    if (response.status === 401) {
      clearStoredToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { endpoint } }));
      }
    }

    throw new ApiError(
      errorDetail || `Falha no upload (${response.status})`,
      response.status,
      errJson
    );
  }

  invalidateApiCache("/api/animals");
  invalidateApiCache("/api/admin");
  return (await response.json()) as T;
}

/* ── Helpers tipados de Saúde, Localização, Observações Gerais e ICS (RF08 / ICS) ── */

export async function createVaccineRecord(
  animalId: string,
  payload: {
    name: string;
    dose?: string | null;
    batch?: string | null;
    appliedAt?: string;
    nextDueAt?: string | null;
    notes?: string | null;
  }
): Promise<VaccineRecord> {
  return apiFetch<VaccineRecord>(
    `/api/animals/${encodeURIComponent(animalId)}/vaccines`,
    { method: "POST", body: payload }
  );
}

export async function deleteVaccineRecord(
  animalId: string,
  vaccineId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/animals/${encodeURIComponent(animalId)}/vaccines/${encodeURIComponent(vaccineId)}`,
    { method: "DELETE" }
  );
}

export async function createDiseaseRecord(
  animalId: string,
  payload: {
    name: string;
    symptoms?: string | null;
    treatment?: string | null;
    status?: DiseaseStatus;
    diagnosedAt?: string;
    recoveredAt?: string | null;
    notes?: string | null;
  }
): Promise<DiseaseRecord> {
  return apiFetch<DiseaseRecord>(
    `/api/animals/${encodeURIComponent(animalId)}/diseases`,
    { method: "POST", body: payload }
  );
}

export async function updateDiseaseRecord(
  animalId: string,
  diseaseId: string,
  payload: {
    status?: DiseaseStatus;
    treatment?: string | null;
    recoveredAt?: string | null;
    notes?: string | null;
  }
): Promise<DiseaseRecord> {
  return apiFetch<DiseaseRecord>(
    `/api/animals/${encodeURIComponent(animalId)}/diseases/${encodeURIComponent(diseaseId)}`,
    { method: "PATCH", body: payload }
  );
}

export async function deleteDiseaseRecord(
  animalId: string,
  diseaseId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/animals/${encodeURIComponent(animalId)}/diseases/${encodeURIComponent(diseaseId)}`,
    { method: "DELETE" }
  );
}

export async function listAnimalLocations(
  animalId: string
): Promise<AnimalLocationLog[]> {
  return apiFetch<AnimalLocationLog[]>(
    `/api/animals/${encodeURIComponent(animalId)}/locations`
  );
}

export async function createAnimalLocationLog(
  animalId: string,
  payload: {
    location: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    reason?: string | null;
  }
): Promise<AnimalLocationLog> {
  return apiFetch<AnimalLocationLog>(
    `/api/animals/${encodeURIComponent(animalId)}/locations`,
    { method: "POST", body: payload }
  );
}

export interface SequentialRecalibrationResult {
  updatedCount: number;
  failedCount: number;
  totalCount: number;
  results: Array<{
    id: string;
    newScore: number;
    photo?: any;
  }>;
}

/**
 * Recalibra uma lista de fotos executando `POST /api/photos/:id/recalibrate` estritamente
 * uma imagem por vez em série, garantindo 100% de paridade e zero travamentos por lote.
 */
export async function recalibratePhotosSequentially(
  photoIds: string[],
  onProgress?: (progress: {
    current: number;
    total: number;
    photoId: string;
    newScore: number | null;
  }) => void
): Promise<SequentialRecalibrationResult> {
  const uniqueIds = Array.from(new Set(photoIds.filter(Boolean)));
  const results: SequentialRecalibrationResult["results"] = [];
  let failedCount = 0;

  for (let i = 0; i < uniqueIds.length; i++) {
    const photoId = uniqueIds[i];
    try {
      const res = await apiFetch<any>(
        `/api/photos/${encodeURIComponent(photoId)}/recalibrate`,
        { method: "POST" }
      );
      const nextScore =
        typeof res?.newScore === "number"
          ? res.newScore
          : typeof res?.score === "number"
          ? res.score
          : 0;
      results.push({ id: photoId, newScore: nextScore, photo: res?.photo });
      onProgress?.({
        current: i + 1,
        total: uniqueIds.length,
        photoId,
        newScore: nextScore,
      });
    } catch {
      failedCount++;
      onProgress?.({
        current: i + 1,
        total: uniqueIds.length,
        photoId,
        newScore: null,
      });
    }
  }

  return {
    updatedCount: results.length,
    failedCount,
    totalCount: uniqueIds.length,
    results,
  };
}

export async function createObservationRecord(
  animalId: string,
  payload: {
    category?: ObservationCategory;
    title?: string | null;
    content: string;
    observedAt?: string;
  }
): Promise<AnimalObservation> {
  return apiFetch<AnimalObservation>(
    `/api/animals/${encodeURIComponent(animalId)}/observations`,
    { method: "POST", body: payload }
  );
}

export async function updateObservationRecord(
  animalId: string,
  observationId: string,
  payload: {
    category?: ObservationCategory;
    title?: string | null;
    content?: string;
  }
): Promise<AnimalObservation> {
  return apiFetch<AnimalObservation>(
    `/api/animals/${encodeURIComponent(animalId)}/observations/${encodeURIComponent(observationId)}`,
    { method: "PATCH", body: payload }
  );
}

export async function deleteObservationRecord(
  animalId: string,
  observationId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/animals/${encodeURIComponent(animalId)}/observations/${encodeURIComponent(observationId)}`,
    { method: "DELETE" }
  );
}
