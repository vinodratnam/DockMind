/**
 * LandingNav — client-side navbar for the landing page.
 * Kept as a separate client component to allow hover event handlers.
 */
'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';

export default function LandingNav() {
  const navLinks = ['Features', 'Architecture', 'Pricing', 'Docs'];

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,15,0.85)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 64,
          gap: '1.5rem',
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
          >
            <Sparkles size={15} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            DocMind AI
          </span>
        </Link>

        {/* Nav links (desktop) */}
        <div
          style={{ flex: 1, display: 'flex', gap: '1.5rem', marginLeft: '1rem' }}
          className="nav-links"
        >
          {navLinks.map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)')}
            >
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          <ThemeToggle />
          <Link href="/login">
            <button className="btn-ghost" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              Sign in
            </button>
          </Link>
          <Link href="/register">
            <button className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              Get started
            </button>
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) { .nav-links { display: none !important; } }
      `}</style>
    </nav>
  );
}
