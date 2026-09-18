/**
 * Documents page (/documents) — lists, searches, filters and manages all user's documents.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  FileText, MessageSquare, Trash2, Loader2, Play, Database, Search, Filter, RefreshCw
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { Document, ProcessingStatus, EmbeddingStatusResponse } from '@/types';
import {
  listDocuments, getDocument, deleteDocument, processDocument, embedDocument, getEmbeddingStatus,
  formatFileSize, formatDate, statusMeta, embeddingStatusMeta,
} from '@/lib/documents';

// ── Badges ────────────────────────────────────────────────────────────────
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

// ── Single Row Element ─────────────────────────────────────────────────────
function DocumentRow({ doc, onDelete, onProcessed }: {
  doc: Document;
  onDelete: (id: number) => void;
  onProcessed: (updated: Document) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [embedStatus, setEmbedStatus] = useState<EmbeddingStatusResponse | null>(null);

  const fetchEmbedStatus = useCallback(async () => {
    if (doc.processing_status === 'processed') {
      try {
        const status = await getEmbeddingStatus(doc.id);
        setEmbedStatus(status);
      } catch {
        // failed silently
      }
    }
  }, [doc.id, doc.processing_status]);

  useEffect(() => {
    fetchEmbedStatus();
  }, [fetchEmbedStatus]);

  async function handleProcess() {
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

  async function handleEmbed() {
    setIndexing(true);
    try {
      await embedDocument(doc.id);
      await fetchEmbedStatus();
    } catch {
      // error shown
    } finally {
      setIndexing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${doc.original_filename}"? This will delete all text chunks and vectors too.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteDocument(doc.id);
      onDelete(doc.id);
    } catch {
      setDeleting(false);
    }
  }

  const canProcess = doc.processing_status === 'uploaded' || doc.processing_status === 'failed';
  const canEmbed = doc.processing_status === 'processed' && (!embedStatus?.is_complete);

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        borderBottom: '1px solid var(--border)',
        height: '4.5rem',
      }}
    >
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <FileText size={18} color="#ef4444" />
          </div>
          <div style={{ minWidth: 0 }}>
            <Link href={`/documents/${doc.id}`} style={{ textDecoration: 'none' }}>
              <p style={{
                fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: 'pointer'
              }} className="hover-link">
                {doc.original_filename}
              </p>
            </Link>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {formatFileSize(doc.file_size)} · Uploaded {formatDate(doc.created_at)}
            </p>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <StatusBadge status={doc.processing_status} />
          {embedStatus && (
            <EmbedStatusBadge status={embedStatus.is_complete ? 'embedded' : (embedStatus.embedded > 0 ? 'embedding' : 'pending')} />
          )}
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {doc.page_count !== null ? `${doc.page_count} pages` : '—'}
      </td>
      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {doc.chunk_count !== null ? `${doc.chunk_count} chunks` : '—'}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {/* Start Chat button */}
          {doc.processing_status === 'processed' && (
            <Link href={`/chat?docId=${doc.id}`}>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                title="Start scoped chat"
                style={{
                  background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                  color: 'var(--accent-light)', fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <MessageSquare size={13} /> Chat
              </motion.button>
            </Link>
          )}

          {/* Process button */}
          {canProcess && (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleProcess} disabled={processing}
              style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 6, padding: '6px 12px', cursor: processing ? 'not-allowed' : 'pointer',
                color: 'var(--accent-light)', fontSize: '0.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              {processing ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
              Process
            </motion.button>
          )}

          {/* Index button */}
          {canEmbed && (
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={handleEmbed} disabled={indexing}
              style={{
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 6, padding: '6px 12px', cursor: indexing ? 'not-allowed' : 'pointer',
                color: '#10b981', fontSize: '0.75rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              {indexing ? <Loader2 size={13} className="spin" /> : <Database size={13} />}
              Index
            </motion.button>
          )}

          {/* Delete button */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleDelete} disabled={deleting}
            style={{
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6, padding: '6px', cursor: deleting ? 'not-allowed' : 'pointer',
              color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {deleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
          </motion.button>
        </div>
      </td>
    </motion.tr>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadDocumentsList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDocuments();
      setDocuments(data);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocumentsList();
  }, [loadDocumentsList]);

  function handleDelete(id: number) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function handleProcessed(updated: Document) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.processing_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell title="My Documents">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', flexWrap: 'wrap'
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              My Library
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
              Manage, process, index, and query all your uploaded PDFs.
            </p>
          </div>
          <Link href="/upload">
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
              className="btn-primary"
            >
              Upload PDF
            </motion.button>
          </Link>
        </div>

        {/* Filters and search */}
        <div style={{
          display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap',
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: '0.75rem 1rem', borderRadius: 12
        }}>
          {/* Search bar */}
          <div style={{
            position: 'relative', flex: 1, minWidth: '200px',
            display: 'flex', alignItems: 'center'
          }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
            <input
              type="text"
              placeholder="Search documents by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8,
                background: 'var(--surface-overlay)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8,
                background: 'var(--surface-overlay)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Refresh button */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={loadDocumentsList}
            title="Refresh document list"
            style={{
              padding: 9, borderRadius: 8, background: 'var(--surface-overlay)',
              border: '1px solid var(--border)', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </motion.button>
        </div>

        {/* Content Panel */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '6rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader2 size={32} color="var(--accent)" />
              </motion.div>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
              <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1.25rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                No documents found
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto 1.5rem auto' }}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No uploaded files match your search criteria. Try modifying your filter conditions.'
                  : 'Start building your enterprise knowledge base by uploading your first PDF document.'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/upload">
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="btn-primary"
                  >
                    Upload Document
                  </motion.button>
                </Link>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.01)',
                    height: '2.5rem',
                  }}>
                    <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                    <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                    <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages</th>
                    <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chunks</th>
                    <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredDocs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onDelete={handleDelete}
                        onProcessed={handleProcessed}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hover-link:hover {
          color: var(--accent-light) !important;
          text-decoration: underline !important;
        }
      `}</style>
    </AppShell>
  );
}
