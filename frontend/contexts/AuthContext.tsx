/**
 * AuthContext — global authentication state provider.
 *
 * Provides:
 *   - Current user, tokens, loading state
 *   - login / register / logout methods
 *
 * Wrap the app in <AuthProvider> (done in app/layout.tsx).
 */
'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { User, AuthState } from '@/types';
import {
  clearTokens,
  fetchCurrentUser,
  getAccessToken,
  getRefreshToken,
  loginRequest,
  logoutUser,
  registerRequest,
  refreshTokenRequest,
  saveTokens,
} from '@/lib/auth';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                   = useState<User | null>(null);
  const [accessToken, setAccessToken]     = useState<string | null>(null);
  const [refreshToken, setRefreshToken]   = useState<string | null>(null);
  const [isLoading, setIsLoading]         = useState(true);

  // ── Bootstrap: rehydrate from localStorage on mount ──────────────────
  useEffect(() => {
    async function init() {
      const storedAccess  = getAccessToken();
      const storedRefresh = getRefreshToken();

      if (!storedAccess) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await fetchCurrentUser();
        setUser(me);
        setAccessToken(storedAccess);
        setRefreshToken(storedRefresh);
      } catch {
        // Access token may be expired — try refresh
        if (storedRefresh) {
          try {
            const tokens = await refreshTokenRequest(storedRefresh);
            saveTokens(tokens);
            const me = await fetchCurrentUser();
            setUser(me);
            setAccessToken(tokens.access_token);
            setRefreshToken(tokens.refresh_token);
          } catch {
            clearTokens();
          }
        } else {
          clearTokens();
        }
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ── login ─────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const tokens = await loginRequest(email, password);
    saveTokens(tokens);
    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  // ── register ──────────────────────────────────────────────────────────
  const register = useCallback(async (name: string, email: string, password: string) => {
    const tokens = await registerRequest(name, email, password);
    saveTokens(tokens);
    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    const me = await fetchCurrentUser();
    setUser(me);
  }, []);

  // ── logout ────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    logoutUser();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
