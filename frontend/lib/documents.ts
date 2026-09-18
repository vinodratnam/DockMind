/**
 * Document API helper functions.
 *
 * All calls go through the Axios `api` client which auto-attaches
 * the JWT access token and handles 401 → redirect to /login.
 */
import { Document, DocumentChunk, ProcessResponse, EmbedResponse, EmbeddingStatusResponse, VectorStoreHealth } from '@/types';
import api from './api';

/**
 * Upload a single PDF file to the backend.
 * Uses multipart/form-data — the access token is attached by the Axios interceptor.
 */
export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await api.post<Document>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Fetch the authenticated user's document list (newest first).
 */
export async function listDocuments(): Promise<Document[]> {
  const { data } = await api.get<Document[]>('/documents/');
  return data;
}

/**
 * Fetch metadata for a single document by ID.
 */
export async function getDocument(id: number): Promise<Document> {
  const { data } = await api.get<Document>(`/documents/${id}`);
  return data;
}

/**
 * Trigger the PDF processing pipeline (extract text + chunk).
 */
export async function processDocument(id: number): Promise<ProcessResponse> {
  const { data } = await api.post<ProcessResponse>(`/documents/${id}/process`);
  return data;
}

/**
 * Fetch all text chunks for a processed document.
 */
export async function getDocumentChunks(id: number): Promise<DocumentChunk[]> {
  const { data } = await api.get<DocumentChunk[]>(`/documents/${id}/chunks`);
  return data;
}

/**
 * Trigger vector embedding generation and Qdrant indexing for a document.
 */
export async function embedDocument(id: number, force: boolean = false): Promise<EmbedResponse> {
  const { data } = await api.post<EmbedResponse>(`/documents/${id}/embed`, null, {
    params: { force },
  });
  return data;
}

/**
 * Fetch detailed embedding statistics for a document.
 */
export async function getEmbeddingStatus(id: number): Promise<EmbeddingStatusResponse> {
  const { data } = await api.get<EmbeddingStatusResponse>(`/documents/${id}/embed-status`);
  return data;
}

/**
 * Fetch Qdrant collection health status.
 */
export async function getVectorStoreHealth(): Promise<VectorStoreHealth> {
  const { data } = await api.get<VectorStoreHealth>('/vector-store/health');
  return data;
}

/**
 * Permanently delete a document (record + file on disk + Qdrant vectors).
 */
export async function deleteDocument(id: number): Promise<void> {
  await api.delete(`/documents/${id}`);
}

/**
 * Format a byte count into a human-readable string (e.g. "2.3 MB").
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Format an ISO timestamp to a short, friendly date string.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Return a display label + color for a processing status.
 */
export function statusMeta(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'processed':  return { label: 'Processed',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    case 'processing': return { label: 'Processing', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    case 'failed':     return { label: 'Failed',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  };
    default:           return { label: 'Uploaded',   color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
  }
}

export function embeddingStatusMeta(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'embedded':   return { label: 'Embedded',   color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    case 'embedding':  return { label: 'Embedding',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
    case 'failed':     return { label: 'Failed',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  };
    default:           return { label: 'Pending',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  }
}
