/**
 * Authentication helper functions.
 *
 * Token storage strategy:
 *   - Access token: localStorage (short-lived, ~30 min)
 *   - Refresh token: localStorage (longer-lived, 7 days)
 *
 * In a production app, consider httpOnly cookies for refresh tokens.
 */
import { TokenResponse, User } from '@/types';
import api from './api';

const ACCESS_KEY  = 'docmind_access_token';
const REFRESH_KEY = 'docmind_refresh_token';

// ── Token storage ──────────────────────────────────────────────────────
export function saveTokens(tokens: TokenResponse): void {
  localStorage.setItem(ACCESS_KEY,  tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

// ── API calls ──────────────────────────────────────────────────────────
export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function loginRequest(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
  return data;
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/register', { name, email, password });
  return data;
}

export async function refreshTokenRequest(refreshToken: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

export async function logoutUser(): Promise<void> {
  clearTokens();
}
