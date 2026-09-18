/**
 * Upload page (/upload) — protected.
 *
 * Features:
 *   - Drag-and-drop + browse file picker (PDF + images, 20 MB max)
 *   - Per-file upload progress with real API calls
 *   - Image thumbnail preview for non-PDF files
 *   - Success and error states per file
 *   - Wired to POST /api/v1/documents/upload
 */
'use client';

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, FileText, Image as ImageIcon, CheckCircle2, AlertCircle, CloudUpload, Loader2,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { uploadDocument, formatFileSize } from '@/lib/documents';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ACCEPTED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const ACCEPTED_EXTS  = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

interface SelectedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
  preview?: string; // object URL for images
}

export default function UploadPage() {
  const [files, setFiles]         = useState<SelectedFile[]>([]);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File validation & queuing ─────────────────────────────────────────
  function addFiles(raw: FileList) {
    const next: SelectedFile[] = [];
    Array.from(raw).forEach((f) => {
      let error: string | undefined;
      const ext  = (f.name.split('.').pop() ?? '').toLowerCase();
      const mime = f.type.split(';')[0].trim().toLowerCase();

      if (!ACCEPTED_MIMES.includes(mime) && !ACCEPTED_EXTS.includes(ext)) {
        error = 'Only PDF and image files (PNG, JPG, WEBP) are accepted';
      } else if (f.size > MAX_SIZE_BYTES) {
        error = `Exceeds 20 MB limit (${formatFileSize(f.size)})`;
      }

      const isImage = mime.startsWith('image/') || ['png','jpg','jpeg','webp'].includes(ext);
      const preview = isImage && !error ? URL.createObjectURL(f) : undefined;

      next.push({ id: `${f.name}-${Date.now()}`, file: f, status: error ? 'error' : 'pending', error, preview });
    });
    setFiles((prev) => [...prev, ...next]);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  // ── Upload handler ────────────────────────────────────────────────────
  async function handleUpload() {
    const pending = files.filter((f) => f.status === 'pending');
    if (!pending.length) return;
    setUploading(true);

    for (const f of pending) {
      setFiles((prev) => prev.map((pf) => (pf.id === f.id ? { ...pf, status: 'uploading' } : pf)));
      try {
        await uploadDocument(f.file);
        setFiles((prev) => prev.map((pf) => (pf.id === f.id ? { ...pf, status: 'done' } : pf)));
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? 'Upload failed. Please try again.';
        setFiles((prev) => prev.map((pf) => (pf.id === f.id ? { ...pf, status: 'error', error: msg } : pf)));
      }
    }
    setUploading(false);
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount    = files.filter((f) => f.status === 'done').length;

  return (
    <AppShell title="Upload Documents">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 4 }}>
            Upload Documents
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            PDF files &amp; images (PNG, JPG, WEBP) · Max 20 MB · Images processed via OCR automatically
          </p>
        </motion.div>

        {/* Success banner */}
        <AnimatePresence>
          {doneCount > 0 && !uploading && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                marginBottom: '1.25rem', padding: '0.875rem 1rem',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, color: 'var(--success)', fontSize: '0.875rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              {doneCount} file{doneCount !== 1 ? 's' : ''} uploaded successfully and saved to your library.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 16, padding: '3.5rem 2rem', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'var(--accent-subtle)' : 'var(--surface)',
            transition: 'all 0.2s ease', marginBottom: '1.5rem',
            boxShadow: dragging ? '0 0 30px var(--accent-glow)' : undefined,
          }}
        >
          <input
            ref={inputRef} type="file" multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            onChange={handleChange} style={{ display: 'none' }} id="file-input"
          />

          <motion.div animate={{ y: dragging ? -6 : 0 }} transition={{ duration: 0.2 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: dragging ? 'var(--accent)' : 'var(--accent-subtle)',
              border: `1px solid ${dragging ? 'var(--accent)' : 'rgba(99,102,241,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem', color: dragging ? 'white' : 'var(--accent-light)',
              transition: 'all 0.2s ease',
            }}>
              <CloudUpload size={30} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 6 }}>
              {dragging ? 'Drop files here' : 'Drag & drop PDFs or Images'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              or click to browse · PDF, PNG, JPG, WEBP supported
            </p>
            <span className="badge badge-accent" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Upload size={12} /> Select Files
            </span>
          </motion.div>
        </motion.div>

        {/* File list */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}
            >
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              <div style={{ padding: '0.5rem' }}>
                {files.map((f) => {
                  const isImage = !!f.preview;
                  return (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 0.75rem', borderRadius: 8,
                        background: f.status === 'error' ? 'rgba(239,68,68,0.06)' : 'transparent',
                      }}
                    >
                      {/* Thumbnail or icon */}
                      {isImage ? (
                        <div style={{
                          width: 40, height: 40, borderRadius: 6, overflow: 'hidden',
                          border: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
                        }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.preview} alt={f.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <span style={{ color: f.status === 'error' ? 'var(--error)' : '#ef4444', flexShrink: 0 }}>
                          <FileText size={20} />
                        </span>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.file.name}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: f.status === 'error' ? 'var(--error)' : 'var(--text-muted)' }}>
                          {f.error ?? `${formatFileSize(f.file.size)}${isImage ? ' · OCR will extract text' : ''}`}
                        </p>
                      </div>

                      {f.status === 'done'      && <CheckCircle2 size={18} color="var(--success)" />}
                      {f.status === 'error'     && <AlertCircle  size={18} color="var(--error)" />}
                      {f.status === 'uploading' && (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Loader2 size={18} color="var(--accent)" />
                        </motion.div>
                      )}
                      {f.status === 'pending' && (
                        <motion.button
                          onClick={() => removeFile(f.id)} whileHover={{ scale: 1.1 }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                        >
                          <X size={16} />
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload button */}
        {pendingCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.button
              onClick={handleUpload} disabled={uploading}
              whileHover={{ scale: uploading ? 1 : 1.02 }} whileTap={{ scale: uploading ? 1 : 0.97 }}
              style={{
                width: '100%', padding: '0.9rem',
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem',
                cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, boxShadow: '0 4px 20px var(--accent-glow)',
              }}
            >
              {uploading ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={16} /></motion.div>Uploading…</>
              ) : (
                <><Upload size={16} />Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}</>
              )}
            </motion.button>
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              After upload, go to Documents to process and index files for AI chat.
            </p>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
