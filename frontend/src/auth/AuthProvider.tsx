import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api/api";
import { api, tokenStore } from "../api/client";
import { AuthContext } from "./context";
import type { User } from "../types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => tokenStore.get() !== null);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<User>("/api/auth/me")
      .then((response) => setUser(response.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, displayName: string, password: string) => {
    const result = await authApi.register(email, displayName, password);
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
