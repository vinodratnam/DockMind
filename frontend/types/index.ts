/**
 * Shared TypeScript types for DocMind AI frontend.
 * All API response shapes and UI state types are defined here.
 */

// ── Auth ─────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ── Documents ─────────────────────────────────────────────────────────
export type ProcessingStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

export interface Document {
  id: number;
  user_id: number;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  // Pipeline fields
  processing_status: ProcessingStatus;
  page_count: number | null;
  chunk_count: number | null;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

export type EmbeddingStatus = 'pending' | 'embedding' | 'embedded' | 'failed';

export interface DocumentChunk {
  id: number;
  document_id: number;
  page_number: number;
  chunk_index: number;
  content: string;
  character_count: number;
  estimated_token_count: number;
  embedding_status: EmbeddingStatus;
  embedded_at: string | null;
  created_at: string;
}

export interface ProcessResponse {
  document_id: number;
  status: string;
  page_count: number;
  chunk_count: number;
  processing_time_seconds: number;
}

export interface EmbedResponse {
  document_id: number;
  chunk_count: number;
  vector_dim: number;
  model_name: string;
  processing_time_seconds: number;
  status: string;
  skipped: boolean;
  skip_reason: string | null;
}

export interface EmbeddingStatusResponse {
  document_id: number;
  total: number;
  embedded: number;
  pending: number;
  failed: number;
  is_complete: boolean;
  last_embedded_at: string | null;
}

export interface VectorStoreHealth {
  connected: boolean;
  collection: string | null;
  vector_dimension: number | null;
  distance_metric: string | null;
  embedding_model: string | null;
  vector_count: number | null;
  collection_status: string | null;
  qdrant_mode: string | null;
  error: string | null;
}

// ── Chats & RAG ───────────────────────────────────────────────────────
export interface Chat {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Source {
  document_id: number | null;
  document_name: string;
  page_number: number;
  chunk_index: number;
  score: number;
  text_preview: string;
}

export interface Message {
  id: number;
  chat_id: number;
  role: MessageRole;
  content: string;
  sources: Source[];
  created_at: string;
}

// ── RAG request/response ──────────────────────────────────────────────
export interface AskRequest {
  question: string;
  document_ids?: number[] | null;
  chat_id?: number | null;
  top_k?: number | null;
  score_threshold?: number | null;
}

export interface RetrievalStats {
  chunks_retrieved: number;
  embedding_latency_ms: number;
  qdrant_latency_ms: number;
  gemini_latency_ms: number;
  total_latency_ms: number;
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  chat_id: number | null;
  message_id: number | null;
  usage: UsageStats;
  retrieval_stats: RetrievalStats;
}

// ── UI Chat Message (client-side with pending state) ──────────────────
export interface UIMessage {
  id: string;             // Temp ID for optimistic UI
  role: MessageRole;
  content: string;
  sources: Source[];
  created_at: string;
  isPending?: boolean;    // True while waiting for first token
  isStreaming?: boolean;  // True while tokens are arriving (SSE)
  isError?: boolean;
  retrieval_stats?: RetrievalStats;
  usage?: UsageStats;
}

// ── API Errors ─────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  status: number;
}

// ── UI State ──────────────────────────────────────────────────────────
export interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
}

// ── RAG Stats ─────────────────────────────────────────────────────────
export interface ReferencedDoc {
  document_name: string;
  count: number;
}

export interface ChatStats {
  questions_asked: number;
  avg_response_time_ms: number;
  retrieved_chunks: number;
  embedding_model: string;
  llm_model: string;
  token_usage: number;
  most_referenced_docs: ReferencedDoc[];
}

