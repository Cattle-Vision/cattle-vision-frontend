/**
 * Cliente HTTP Universal e Adaptador de Comunicação Cross-Origin (`src/lib/api.ts`)
 *
 * Responsável por conectar o Frontend Next.js ao Servidor de API (Backend).
 * Suporta instâncias rodando em:
 * - PCs e servidores locais diferentes (ex: backend em 192.168.1.100:3001)
 * - Vercel Serverless / Domínios separados (ex: api.meusite.com)
 * - Docker Compose em redes bridge ou hosts físicos independentes
 *
 * Gerencia tokens de autenticação JWT Bearer no localStorage (`cv_token`).
 */

const TOKEN_KEY = "cattle_vision_jwt_token";

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
 * Remove o token JWT ao realizar logout.
 */
export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error("Erro ao remover token:", err);
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: any;
}

/**
 * Realiza chamadas HTTP com injeção automática de Bearer Token e cabeçalhos CORS.
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
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `Falha na requisição (${response.status} ${response.statusText})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
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
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail || `Falha no upload (${response.status})`);
  }

  return (await response.json()) as T;
}
