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

/** Cache em memória estilo stale-while-revalidate para navegação instantânea entre rotas */
const responseCache = new Map<string, { data: unknown; timestamp: number }>();
const inflightRequests = new Map<string, Promise<unknown>>();

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
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
  if (typeof process.env.NEXT_PUBLIC_API_URL === "string" && process.env.NEXT_PUBLIC_API_URL.trim() !== "") {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    // Se estiver no browser e não tiver env, verifica se há variável injetada ou fallback local
    return window.location.port === "3000"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "";
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
    responseCache.clear();
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
  const entry = responseCache.get(cleanEndpoint);
  return entry ? (entry.data as T) : null;
}

export async function apiFetchCached<T = any>(
  endpoint: string,
  ttlMs = 15_000
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const cached = responseCache.get(cleanEndpoint);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const inflight = inflightRequests.get(cleanEndpoint);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const promise = apiFetch<T>(cleanEndpoint)
    .then((data) => {
      responseCache.set(cleanEndpoint, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      inflightRequests.delete(cleanEndpoint);
    });

  inflightRequests.set(cleanEndpoint, promise);
  return promise;
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
