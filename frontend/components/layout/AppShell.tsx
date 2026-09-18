/**
 * AppShell — wraps all authenticated pages.
 *
 * Composes:
 *   - AuthGuard (redirects if not logged in)
 *   - Sidebar (collapsible navigation)
 *   - TopNav (top bar)
 *   - Main content area
 */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const [collapsed, setCollapsed]       = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);

  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)' }}>
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main area */}
        <motion.div
          animate={{ marginLeft: collapsed ? 64 : 260 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            overflow: 'hidden',
          }}
          className="main-area"
        >
          <TopNav
            onMobileMenuOpen={() => setMobileOpen(true)}
            title={title}
          />
          <main
            style={{
              flex: 1,
              padding: '2rem',
              overflowY: 'auto',
            }}
          >
            {children}
          </main>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .main-area { margin-left: 0 !important; }
        }
      `}</style>
    </AuthGuard>
  );
}
