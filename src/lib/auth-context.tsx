"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type AuthUser = {
  id: string;
  username: string;
  role: string;
};

type AuthContextValue = {
  /** Current authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** True until the initial /api/auth/verify roundtrip resolves. */
  loading: boolean;
  /** Re-fetch the current user from the server. Call this after login. */
  refresh: () => Promise<AuthUser | null>;
  /** Hit the logout endpoint, clear local state. */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * App-wide auth state. The session token lives in an HttpOnly cookie that JS
 * cannot read — this provider derives user identity by asking the server who
 * the cookie belongs to via /api/auth/verify, and exposes that to the rest of
 * the React tree. There is intentionally no localStorage involvement: the
 * server is the only source of truth.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/verify", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user as AuthUser;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* network failure — local state still cleared below */
    }
    setUser(null);
  }, []);

  useEffect(() => {
    // One-time sweep of legacy localStorage keys from the pre-cookie auth era.
    // Harmless if absent; keeps returning users from carrying stale fragments.
    try {
      localStorage.removeItem("gmtti_token");
      localStorage.removeItem("gmtti_role");
      localStorage.removeItem("gmtti_user_id");
    } catch {
      /* SSR or storage disabled — ignore */
    }
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>");
  }
  return ctx;
}
