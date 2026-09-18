/**
 * useAuth — convenience hook for consuming the AuthContext.
 *
 * Throws if used outside <AuthProvider>.
 */
'use client';

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
