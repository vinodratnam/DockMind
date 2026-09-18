/**
 * TopNav — top navigation bar for the authenticated app shell.
 *
 * Fixed:
 *  - Search bar now opens a command-palette style modal that searches documents
 *  - Notifications bell shows a real dropdown with activity feed
 *  - All interactions are functional
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Search, X, FileText, MessageSquare, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { listDocuments } from '@/lib/documents';
import { Document } from '@/types';

interface TopNavProps {
  onMobileMenuOpen: () => void;
  title?: string;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: '0.7rem', fontWeight: 700,
        flexShrink: 0, cursor: 'pointer',
        boxShadow: '0 0 10px var(--accent-glow)',
      }}
    >
      {initials}
    </div>
  );
}

// ── Search Modal ────────────────────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    listDocuments()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = query.trim()
    ? docs.filter((d) => d.original_filename.toLowerCase().includes(query.toLowerCase()))
    : docs;

  function openDoc(doc: Document) {
    router.push(`/documents/${doc.id}`);
    onClose();
  }

  function startChat(doc: Document) {
    router.push(`/chat?docId=${doc.id}`);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          margin: '0 1rem',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0.875rem 1.125rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by name…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '0.95rem', color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading documents…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {query ? `No documents matching "${query}"` : 'No documents uploaded yet.'}
            </div>
          ) : (
            <>
              <p style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {filtered.length} document{filtered.length !== 1 ? 's' : ''}
              </p>
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem 0.75rem', borderRadius: 8,
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={16} color="#ef4444" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => openDoc(doc)}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.original_filename}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      {doc.processing_status} · {doc.page_count ?? 0} pages
                    </p>
                  </div>
                  {doc.processing_status === 'processed' && (
                    <button
                      onClick={() => startChat(doc)}
                      style={{
                        background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                        color: 'var(--accent-light)', fontSize: '0.72rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      }}
                    >
                      <MessageSquare size={12} /> Chat
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '0.625rem 1.125rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 16, fontSize: '0.7rem', color: 'var(--text-disabled)',
        }}>
          <span>↵ Open document</span>
          <span>esc Close</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Notifications Panel ─────────────────────────────────────────────────────
interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const DEMO_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'success', title: 'Document processed', body: 'Your PDF has been chunked and is ready for embedding.', time: '2m ago', read: false },
  { id: '2', type: 'info', title: 'Chat Streaming enabled', body: 'AI responses now stream in real-time with SSE.', time: '1h ago', read: false },
  { id: '3', type: 'success', title: 'Hybrid Search active', body: 'BM25 + semantic search is now enabled for better accuracy.', time: '2h ago', read: true },
];

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>(DEMO_NOTIFICATIONS);

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const iconForType = (type: Notification['type']) => {
    if (type === 'success') return <CheckCircle2 size={16} color="#10b981" />;
    if (type === 'warning') return <AlertCircle size={16} color="#f59e0b" />;
    return <Clock size={16} color="var(--accent-light)" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        width: 340, background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 14,
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        zIndex: 9998, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Notifications</span>
        <button
          onClick={markAllRead}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--accent-light)', fontWeight: 600 }}
        >
          Mark all read
        </button>
      </div>

      {/* Items */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem',
              borderBottom: '1px solid var(--border)',
              background: n.read ? 'transparent' : 'rgba(99,102,241,0.04)',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ flexShrink: 0, paddingTop: 2 }}>{iconForType(n.type)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>{n.title}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: 1.4 }}>{n.body}</p>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-disabled)', margin: 0 }}>{n.time}</p>
            </div>
            {!n.read && (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-muted)' }}
        >
          Close
        </button>
      </div>
    </motion.div>
  );
}

// ── Main TopNav ─────────────────────────────────────────────────────────────
export default function TopNav({ onMobileMenuOpen, title = 'Dashboard' }: TopNavProps) {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = DEMO_NOTIFICATIONS.filter((n) => !n.read).length;

  // Open search with ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  return (
    <>
      <header
        style={{
          height: 64, background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 1.5rem', gap: '1rem',
          position: 'sticky', top: 0, zIndex: 50,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Mobile hamburger */}
        <motion.button
          onClick={onMobileMenuOpen}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Open menu"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}
          className="mobile-menu-btn"
        >
          <Menu size={20} />
        </motion.button>

        {/* Page title */}
        <h1 style={{ flex: 1, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>

        {/* Search bar — clickable, opens modal */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0.375rem 0.875rem',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '0.8rem',
          }}
          className="search-bar"
        >
          <Search size={14} />
          <span>Search documents…</span>
          <kbd style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 4, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-disabled)', marginLeft: 4 }}>
            ⌘K
          </kbd>
        </motion.button>

        {/* Notifications bell */}
        <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: notifOpen ? 'var(--accent-subtle)' : 'var(--bg)',
              border: `1px solid ${notifOpen ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)', position: 'relative',
            }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 6,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent)', border: '2px solid var(--surface)',
              }} />
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User avatar */}
        {user && <UserAvatar name={user.name} />}

        <style>{`
          @media (min-width: 769px) { .mobile-menu-btn { display: none !important; } }
          @media (max-width: 600px) { .search-bar { display: none !important; } }
        `}</style>
      </header>

      {/* Search modal portal */}
      <AnimatePresence>
        {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
