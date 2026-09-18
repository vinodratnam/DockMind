/**
 * Axios client configured with:
 *   - Base URL from environment
 *   - Request interceptor: attaches JWT access token from localStorage
 *   - Response interceptor: handles 401 → triggers logout
 *
 * Import `api` for all HTTP calls in services/hooks.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor ────────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Only runs on the client side (localStorage is unavailable on the server)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('docmind_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor ───────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear local credentials and redirect to login
      localStorage.removeItem('docmind_access_token');
      localStorage.removeItem('docmind_refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
