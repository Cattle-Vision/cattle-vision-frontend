"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "./types";
import {
  apiFetch,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getCachedUser,
  setCachedUser,
  invalidateApiCache,
} from "./api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshSession: (force?: boolean) => Promise<void>;
}

const AUTH_VERIFIED_AT_KEY = "cv_auth_verified_at";
const AUTH_REVALIDATE_TTL_MS = 60_000;

function markSessionVerifiedNow(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AUTH_VERIFIED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function wasSessionRecentlyVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(AUTH_VERIFIED_AT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < AUTH_REVALIDATE_TTL_MS;
  } catch {
    return false;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async (force = true) => {
    const token = getStoredToken();
    if (!token) {
      setCachedUser(null);
      setUser(null);
      setLoading(false);
      return;
    }

    // Hidrata imediatamente o perfil em cache para não bloquear o carregamento inicial
    // das páginas protegidas esperando o roundtrip de /api/auth/me.
    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
      if (!force && wasSessionRecentlyVerified()) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }
    }

    try {
      const data = await apiFetch<{ user: User }>("/api/auth/me");
      if (data?.user) {
        setUser(data.user);
        setCachedUser(data.user);
        markSessionVerifiedNow();
      } else {
        clearStoredToken();
        setUser(null);
      }
    } catch (err: any) {
      // Só encerra sessão se for rejeição explícita (401); em erro de rede offline preserva o cache.
      if (err?.status === 401 || !cached) {
        clearStoredToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession(false);
  }, [refreshSession]);

  // Interceptor global de sessão revogada / token inválido
  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredToken();
      setUser(null);
      setLoading(false);
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        const isAuthRoute = path.startsWith("/login") || path.startsWith("/register") || path === "/";
        if (!isAuthRoute) {
          window.location.href = "/login";
        }
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      if (!data?.token || !data?.user) {
        throw new Error("Resposta de autenticação inválida");
      }

      setStoredToken(data.token);
      setCachedUser(data.user);
      markSessionVerifiedNow();
      invalidateApiCache();
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: User }>("/api/auth/register", {
        method: "POST",
        body: { name, email, password },
      });

      if (!data?.token || !data?.user) {
        throw new Error("Resposta de cadastro inválida");
      }

      setStoredToken(data.token);
      setCachedUser(data.user);
      markSessionVerifiedNow();
      invalidateApiCache();
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === "ADMIN",
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um <AuthProvider />");
  }
  return context;
}
