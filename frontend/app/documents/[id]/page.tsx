/**
 * Document Detail page (/documents/[id]) — protected.
 *
 * Shows:
 *   - Document metadata (filename, size, pages, chunks, dates)
 *   - Processing status badge with Process button
 *   - Vector store indexing status (Qdrant) with Embed button & force checkbox
 *   - Interactive Embedding Inspector showing chunk content, embedding status, vector dimensions
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  FileText, ArrowLeft, Play, Layers, Loader2,
  Calendar, HardDrive, BookOpen, Cpu, ChevronDown, ChevronUp, AlertTriangle,
  Database, CheckCircle2, Shield, Settings, Info,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { Document, DocumentChunk, ProcessResponse, EmbeddingStatusResponse, EmbedResponse } from '@/types';
import {
  getDocument, getDocumentChunks, processDocument, embedDocument, getEmbeddingStatus,
  formatFileSize, formatDate, statusMeta, embeddingStatusMeta,
} from '@/lib/documents';

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`,
    }}>
      {meta.label}
    </span>
  );
}

function EmbedStatusBadge({ status }: { status: string }) {
  const meta = embeddingStatusMeta(status);
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`,
    }}>
      {meta.label}
    </span>
  );
}

// ── Meta row ───────────────────────────────────────────────────────────────
function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.625rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--accent-light)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Chunk card ─────────────────────────────────────────────────────────────
function ChunkCard({ chunk }: { chunk: DocumentChunk }) {
  const [expanded, setExpanded] = useState(false);
  const preview = chunk.content.slice(0, 250);
  const hasMore = chunk.content.length > 250;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        border: '1px solid var(--border)', borderRadius: 10,
        overflow: 'hidden', marginBottom: '0.625rem',
      }}
    >
      {/* Chunk header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.5rem 0.875rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-light)', background: 'var(--accent-subtle)', padding: '2px 7px', borderRadius: 6 }}>
            #{chunk.chunk_index + 1}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Page {chunk.page_number} · {chunk.character_count} chars · ~{chunk.estimated_token_count} tokens
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Vector status:</span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              color: embeddingStatusMeta(chunk.embedding_status).color,
              background: embeddingStatusMeta(chunk.embedding_status).bg,
            }}>
              {chunk.embedding_status}
            </span>
          </span>
          {chunk.embedding_status === 'embedded' && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.2)' }}>
              dim: 384
            </span>
          )}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem' }}
          >
            {expanded ? <><ChevronUp size={13} />Less</> : <><ChevronDown size={13} />More</>}
          </button>
        )}
      </div>

      {/* Chunk content */}
      <div style={{ padding: '0.75rem 0.875rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
        {expanded ? chunk.content : preview}
        {hasMore && !expanded && <span style={{ color: 'var(--text-muted)' }}>…</span>}
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DocumentDetailPage() {
  const params   = useParams();
  const router   = useRouter();
  const docId    = Number(params?.id);

  const [doc,    setDoc]    = useState<Document | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [embedStatus, setEmbedStatus] = useState<EmbeddingStatusResponse | null>(null);
  const [forceEmbed, setForceEmbed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [processing, setProcessing]   = useState(false);
  const [embedding, setEmbedding]     = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResponse | null>(null);
  const [embedResult, setEmbedResult] = useState<EmbedResponse | null>(null);
  const [error, setError]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    try {
      const d = await getDocument(docId);
      setDoc(d);
      if (d.processing_status === 'processed') {
        setChunksLoading(true);
        const c = await getDocumentChunks(docId);
        setChunks(c);
        const es = await getEmbeddingStatus(docId);
        setEmbedStatus(es);
        setChunksLoading(false);
      }
    } catch {
      setError('Document not found or you do not have access.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { load(); }, [load]);

  async function handleProcess() {
    if (!doc) return;
    setProcessing(true);
    setProcessResult(null);
    try {
      const result = await processDocument(doc.id);
      setProcessResult(result);
      // Refresh doc + chunks
      const updated = await getDocument(doc.id);
      setDoc(updated);
      setChunksLoading(true);
      const newChunks = await getDocumentChunks(doc.id);
      setChunks(newChunks);
      const es = await getEmbeddingStatus(doc.id);
      setEmbedStatus(es);
      setChunksLoading(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Processing failed.';
      setError(msg);
    } finally {
      setProcessing(false);
    }
  }

  async function handleEmbed() {
    if (!doc) return;
    setEmbedding(true);
    setEmbedResult(null);
    try {
      const result = await embedDocument(doc.id, forceEmbed);
      setEmbedResult(result);
      // Refresh chunks and status
      setChunksLoading(true);
      const newChunks = await getDocumentChunks(doc.id);
      setChunks(newChunks);
      const es = await getEmbeddingStatus(doc.id);
      setEmbedStatus(es);
      setChunksLoading(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Embedding failed.';
      setError(msg);
    } finally {
      setEmbedding(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Document">
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 size={32} color="var(--accent)" />
          </motion.div>
        </div>
      </AppShell>
    );
  }

  if (error || !doc) {
    return (
      <AppShell title="Document">
        <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: '3rem', textAlign: 'center' }}>
          <AlertTriangle size={40} color="var(--error)" style={{ marginBottom: 12 }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>{error ?? 'Document not found.'}</p>
          <Link href="/dashboard">
            <button className="btn-primary" style={{ marginTop: 8 }}>Back to dashboard</button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const canProcess = doc.processing_status === 'uploaded' || doc.processing_status === 'failed';
  const canEmbed   = doc.processing_status === 'processed' && (!embedStatus?.is_complete || forceEmbed);
  const sm = statusMeta(doc.processing_status);

  return (
    <AppShell title={doc.original_filename}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          style={{ marginBottom: '1.5rem' }}>
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={24} color="#ef4444" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                {doc.original_filename}
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={doc.processing_status} />
                {embedStatus && (
                  <EmbedStatusBadge status={embedStatus.is_complete ? 'embedded' : (embedStatus.embedded > 0 ? 'embedding' : 'pending')} />
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {canProcess && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleProcess} disabled={processing}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.65rem 1.25rem' }}
              >
                {processing
                  ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={16} /></motion.div> Processing…</>
                  : <><Play size={16} /> Process PDF</>
                }
              </motion.button>
            )}

            {doc.processing_status === 'processed' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={forceEmbed}
                      onChange={(e) => setForceEmbed(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Force re-index
                  </label>
                  <motion.button
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={handleEmbed} disabled={embedding}
                    className="btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '0.65rem 1.25rem',
                      background: 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
                    }}
                  >
                    {embedding
                      ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={16} /></motion.div> Indexing…</>
                      : <><Database size={16} /> Generate Embeddings</>
                    }
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Process result banner */}
        <AnimatePresence>
          {processResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginBottom: '1.5rem', padding: '0.875rem 1rem',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, color: 'var(--success)', fontSize: '0.875rem',
              }}
            >
              ✓ Processing complete — {processResult.page_count} pages, {processResult.chunk_count} chunks extracted in {processResult.processing_time_seconds}s
            </motion.div>
          )}
        </AnimatePresence>

        {/* Embed result banner */}
        <AnimatePresence>
          {embedResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginBottom: '1.5rem', padding: '0.875rem 1rem',
                background: embedResult.skipped ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.1)',
                border: embedResult.skipped ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, color: embedResult.skipped ? 'var(--accent-light)' : 'var(--success)', fontSize: '0.875rem',
              }}
            >
              {embedResult.skipped ? (
                <span>ℹ Duplicate prevention: {embedResult.skip_reason}</span>
              ) : (
                <span>✓ Vector store indexing complete — {embedResult.chunk_count} chunks embedded into model <strong>{embedResult.model_name}</strong> ({embedResult.vector_dim}d, Cosine metric) in {embedResult.processing_time_seconds}s</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: '1.5rem', padding: '0.875rem 1rem',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, color: 'var(--error)', fontSize: '0.875rem',
              }}
            >
              <strong>Error:</strong> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '1.25rem', alignItems: 'start' }} className="detail-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Metadata card */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Document Metadata
              </h3>
              <MetaRow icon={<HardDrive size={15} />}  label="Size"         value={formatFileSize(doc.file_size)} />
              <MetaRow icon={<BookOpen size={15} />}   label="Pages"        value={doc.page_count  ?? '—'} />
              <MetaRow icon={<Layers size={15} />}     label="Chunks"       value={doc.chunk_count ?? '—'} />
              <MetaRow icon={<Cpu size={15} />}        label="Status"       value={sm.label} />
              <MetaRow icon={<Calendar size={15} />}   label="Uploaded"     value={formatDate(doc.created_at)} />
              <MetaRow icon={<Calendar size={15} />}   label="Processed"    value={formatDate(doc.processed_at)} />
              <div style={{ marginTop: 8, padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stored as:</span>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>
                  {doc.stored_filename}
                </p>
              </div>
            </motion.div>

            {/* Qdrant Store metadata card */}
            {embedStatus && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
                className="glass-card" style={{ padding: '1.25rem 1.5rem', background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.1)' }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={16} color="var(--accent)" /> Qdrant Indexing Info
                </h3>
                <MetaRow icon={<CheckCircle2 size={15} />} label="Indexed Count" value={`${embedStatus.embedded} / ${embedStatus.total} chunks`} />
                <MetaRow icon={<Shield size={15} />}       label="Model"         value="BAAI/bge-small-en-v1.5" />
                <MetaRow icon={<Settings size={15} />}     label="Dimension"     value="384 (Cosine similarity)" />
                <MetaRow icon={<Info size={15} />}         label="Payload Schema" value="Version 1" />
                {embedStatus.last_embedded_at && (
                  <MetaRow icon={<Calendar size={15} />}   label="Last Indexed"  value={formatDate(embedStatus.last_embedded_at)} />
                )}
              </motion.div>
            )}
          </div>

          {/* Chunks panel */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            {doc.processing_status !== 'processed' ? (
              <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                {doc.processing_status === 'processing' ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: 12 }}>
                      <Loader2 size={28} color="var(--accent)" />
                    </motion.div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Processing PDF…</p>
                  </>
                ) : (
                  <>
                    <Layers size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>No chunks yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Click <strong>Process PDF</strong> to extract text and generate chunks.
                    </p>
                  </>
                )}
              </div>
            ) : chunksLoading ? (
              <div className="glass-card" style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 size={24} color="var(--accent)" />
                </motion.div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={15} color="var(--accent)" />
                    Embedding Inspector ({chunks.length} Chunks)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ~{Math.round(chunks.reduce((s, c) => s + c.estimated_token_count, 0) / 1000)}k total tokens
                  </span>
                </div>
                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                  <AnimatePresence>
                    {chunks.map((c) => <ChunkCard key={c.id} chunk={c} />)}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      <style>{`
        .detail-grid { grid-template-columns: 1fr 1.8fr; }
        @media (max-width: 700px) { .detail-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppShell>
  );
}
