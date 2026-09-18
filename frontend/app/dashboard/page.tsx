/**
 * Dashboard page (/dashboard) — protected.
 *
 * Shows:
 *   - Welcome greeting with user name
 *   - Stats cards (documents, chunks, pages, and indexed Qdrant vectors)
 *   - Real uploaded documents with processing status badges & embedding status badges
 *   - Process, Index Vectors, and Delete actions per document
 *   - Empty state when no documents exist
 *   - Live Qdrant Vector Store health monitoring panel
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  FileText, MessageSquare, Upload, ArrowRight,
  Zap, FolderOpen, Trash2, Loader2, Play, Layers,
  Database, Activity, Check, CheckCircle2,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { Document, ProcessingStatus, VectorStoreHealth, EmbeddingStatusResponse, ChatStats } from '@/types';
import {
  listDocuments, getDocument, deleteDocument, processDocument, embedDocument, getEmbeddingStatus, getVectorStoreHealth,
  formatFileSize, formatDate, statusMeta, embeddingStatusMeta,
} from '@/lib/documents';
import { getChatStats } from '@/lib/chat';

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ProcessingStatus }) {
  const meta = statusMeta(status);
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 999, letterSpacing: '0.03em',
      color: meta.color, background: meta.bg,
      border: `1px solid ${meta.color}40`,
    }}>
      {meta.label}
    </span>
  );
}

function EmbedStatusBadge({ status }: { status: string }) {
  const meta = embeddingStatusMeta(status);
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 999, letterSpacing: '0.03em',
      color: meta.color, background: meta.bg,
      border: `1px solid ${meta.color}40`,
    }}>
      {meta.label}
    </span>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
interface StatCard { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string; }

function StatCardEl({ card, delay }: { card: StatCard; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card"
      style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>{card.label}</p>
          <p style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>{card.value}</p>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${card.color}18`, border: `1px solid ${card.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color,
        }}>{card.icon}</div>
      </div>
      {card.sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.sub}</p>}
    </motion.div>
  );
}

// ── Document card ──────────────────────────────────────────────────────────
function DocumentCard({ doc, onDelete, onProcessed, onIndexed }: {
  doc: Document;
  onDelete: (id: number) => void;
  onProcessed: (updated: Document) => void;
  onIndexed: () => void;
}) {
  const [deleting, setDeleting]   = useState(false);
  const [processing, setProcessing] = useState(false);
  const [indexing, setIndexing]     = useState(false);
  const [embedStatus, setEmbedStatus] = useState<EmbeddingStatusResponse | null>(null);

  const fetchEmbedStatus = useCallback(async () => {
    if (doc.processing_status === 'processed') {
      try {
        const es = await getEmbeddingStatus(doc.id);
        setEmbedStatus(es);
      } catch {
        // failed silently
      }
    }
  }, [doc.id, doc.processing_status]);

  useEffect(() => {
    fetchEmbedStatus();
  }, [fetchEmbedStatus]);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm(`Delete "${doc.original_filename}"? This will clean up database chunks and vector embeddings.`)) return;
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      onDelete(doc.id);
      onIndexed(); // Refresh global counts
    } catch {
      setDeleting(false);
    }
  }

  async function handleProcess(e: React.MouseEvent) {
    e.preventDefault();
    setProcessing(true);
    try {
      await processDocument(doc.id);
      const updated = await getDocument(doc.id);
      onProcessed(updated);
    } catch {
      // error shown in status
    } finally {
      setProcessing(false);
    }
  }

  async function handleEmbed(e: React.MouseEvent) {
    e.preventDefault();
    setIndexing(true);
    try {
      await embedDocument(doc.id);
      const es = await getEmbeddingStatus(doc.id);
      setEmbedStatus(es);
      onIndexed(); // Refresh global counts
    } catch {
      // error shown
    } finally {
      setIndexing(false);
    }
  }

  const canProcess = doc.processing_status === 'uploaded' || doc.processing_status === 'failed';
  const canEmbed = doc.processing_status === 'processed' && (!embedStatus?.is_complete);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1rem', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        marginBottom: '0.5rem',
      }}
    >
      {/* PDF icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <FileText size={18} color="#ef4444" />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <Link href={`/documents/${doc.id}`} style={{ textDecoration: 'none' }}>
            <p style={{
              fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {doc.original_filename}
            </p>
          </Link>
          <StatusBadge status={doc.processing_status} />
          {embedStatus && (
            <EmbedStatusBadge status={embedStatus.is_complete ? 'embedded' : (embedStatus.embedded > 0 ? 'embedding' : 'pending')} />
          )}
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {formatFileSize(doc.file_size)}
          {doc.page_count   ? ` · ${doc.page_count} pages`  : ''}
          {doc.chunk_count  ? ` · ${doc.chunk_count} chunks` : ''}
          {embedStatus?.embedded ? ` · ${embedStatus.embedded} vectors` : ''}
          {' · '}{formatDate(doc.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {/* Process button */}
        {canProcess && (
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={handleProcess} disabled={processing}
            title="Extract text & chunk"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 7, padding: '5px 10px',
              cursor: processing ? 'not-allowed' : 'pointer',
              color: 'var(--accent-light)', fontSize: '0.72rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {processing
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={13} /></motion.div>
              : <Play size={13} />
            }
            {processing ? 'Processing…' : 'Process'}
          </motion.button>
        )}

        {/* Index Vectors button */}
        {canEmbed && (
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={handleEmbed} disabled={indexing}
            title="Generate embeddings & store in Qdrant"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 7, padding: '5px 10px',
              cursor: indexing ? 'not-allowed' : 'pointer',
              color: '#10b981', fontSize: '0.72rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {indexing
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={13} /></motion.div>
              : <Database size={13} />
            }
            {indexing ? 'Indexing…' : 'Index'}
          </motion.button>
        )}

        {/* View detail */}
        {doc.processing_status === 'processed' && (
          <Link href={`/documents/${doc.id}`}>
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              style={{
                background: 'var(--accent-subtle)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 7, padding: '5px 10px',
                cursor: 'pointer', color: 'var(--accent-light)',
                fontSize: '0.72rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Layers size={13} />Chunks
            </motion.button>
          </Link>
        )}

        {/* Delete */}
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={handleDelete} disabled={deleting}
          title="Delete document & vectors"
          style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 7, padding: '5px 8px',
            cursor: deleting ? 'not-allowed' : 'pointer',
            color: '#ef4444', display: 'flex', alignItems: 'center',
          }}
        >
          {deleting
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={14} /></motion.div>
            : <Trash2 size={14} />
          }
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ icon, title, description, action, href }: {
  icon: React.ReactNode; title: string; description: string; action: string; href: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem', textAlign: 'center', gap: '1rem' }}>
      <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-light)' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 300 }}>{description}</p>
      </div>
      <Link href={href}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>
          {action}
        </motion.button>
      </Link>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments]   = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [health, setHealth]           = useState<VectorStoreHealth | null>(null);
  const [stats, setStats]             = useState<ChatStats | null>(null);

  const loadDocs = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      // show empty state
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const h = await getVectorStoreHealth();
      setHealth(h);
    } catch {
      // failed silently
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await getChatStats();
      setStats(s);
    } catch {
      // failed silently
    }
  }, []);

  useEffect(() => {
    loadDocs();
    loadHealth();
    loadStats();
  }, [loadDocs, loadHealth, loadStats]);

  function handleDelete(id: number) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function handleProcessed(updated: Document) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  const timeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const totalChunks = documents.reduce((s, d) => s + (d.chunk_count ?? 0), 0);
  const totalPages  = documents.reduce((s, d) => s + (d.page_count  ?? 0), 0);
  const processed   = documents.filter((d) => d.processing_status === 'processed').length;

  const statCards: StatCard[] = [
    { label: 'Documents',  value: documents.length, icon: <FileText size={20} />,    color: '#6366f1', sub: `${processed} processed` },
    { label: 'Total Pages', value: totalPages,       icon: <Layers size={20} />,      color: '#8b5cf6', sub: 'Across all PDFs' },
    { label: 'Text Chunks', value: totalChunks,      icon: <MessageSquare size={20} />, color: '#06b6d4', sub: 'Ready for AI' },
    {
      label: 'Qdrant Vectors',
      value: health?.vector_count !== undefined && health.vector_count !== null ? health.vector_count : '—',
      icon: <Database size={20} />,
      color: '#10b981',
      sub: health?.connected ? `${health.embedding_model?.split('/').pop()} (${health.qdrant_mode})` : 'Disconnected'
    },
  ];

  return (
    <AppShell title="Dashboard">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 4 }}>
          {timeGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {documents.length === 0
            ? 'Upload your first PDF to get started.'
            : `${documents.length} document${documents.length !== 1 ? 's' : ''} · ${totalChunks} text chunks ready.`}
        </p>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map((card, i) => <StatCardEl key={card.label} card={card} delay={i * 0.1} />)}
      </div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        style={{ marginBottom: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link href="/upload">
          <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={16} />Upload PDF
          </motion.button>
        </Link>
        <Link href="/chat">
          <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={16} />Start chat
          </motion.button>
        </Link>
      </motion.div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }} className="dashboard-grid">

        {/* Documents panel */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="var(--accent)" /> Documents ({documents.length})
            </h3>
            <Link href="/upload" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Upload <ArrowRight size={12} />
            </Link>
          </div>

          {docsLoading ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={24} color="var(--accent)" />
              </motion.div>
            </div>
          ) : documents.length === 0 ? (
            <EmptyState icon={<FolderOpen size={26} />} title="No documents yet"
              description="Upload your first PDF to start processing it with AI."
              action="Upload document" href="/upload" />
          ) : (
            <div style={{ padding: '0.75rem' }}>
              <AnimatePresence mode="popLayout">
                {documents.slice(0, 6).map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onDelete={handleDelete}
                    onProcessed={handleProcessed}
                    onIndexed={() => { loadHealth(); loadStats(); }}
                  />
                ))}
              </AnimatePresence>
              {documents.length > 6 && (
                <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                  +{documents.length - 6} more
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Vector Store Health and Chats panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Vector Store Health monitoring panel */}
          {health && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="glass-card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={16} color="#10b981" /> Vector Store Status
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: health.connected ? '#10b981' : '#ef4444' }}>
                  <Activity size={12} /> {health.connected ? 'Online' : 'Offline'}
                </span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Collection</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{health.collection}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Embedding Model</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{health.embedding_model}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Vector Dimension</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{health.vector_dimension}d ({health.distance_metric})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Qdrant Mode</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>{health.qdrant_mode}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* AI Statistics panel */}
          {stats && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
              className="glass-card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(99,102,241,0.02)', border: '1px solid rgba(99,102,241,0.1)' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                <Zap size={16} color="var(--accent)" /> AI Assistant Statistics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Questions Asked</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.questions_asked}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Avg Response Time</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.questions_asked > 0 ? `${stats.avg_response_time_ms} ms` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Retrieved Chunks</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.retrieved_chunks}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>LLM Model</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.llm_model}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: stats.most_referenced_docs.length > 0 ? '1px solid var(--border)' : 'none', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Token Usage (est.)</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.token_usage.toLocaleString()} tokens</span>
                </div>
                {stats.most_referenced_docs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Referenced Documents</span>
                    {stats.most_referenced_docs.map((doc, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', background: 'var(--surface)', padding: '4px 8px', borderRadius: 4 }}>
                        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{doc.document_name}</span>
                        <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{doc.count} refs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Recent Chats */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="glass-card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} color="var(--accent)" /> Recent Chats
              </h3>
              <Link href="/chat" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                New chat <ArrowRight size={12} />
              </Link>
            </div>
            <EmptyState icon={<Zap size={26} />} title="No conversations yet"
              description="Process a document then start chatting with it using AI."
              action="Start chatting" href="/chat" />
          </motion.div>
        </div>
      </div>

      <style>{`
        .dashboard-grid { grid-template-columns: 1.4fr 1fr; }
        @media (max-width: 750px) { .dashboard-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppShell>
  );
}
