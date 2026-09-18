/**
 * Chat & RAG API helper functions.
 *
 * All calls go through the Axios `api` client which auto-attaches
 * the JWT access token and handles 401 → redirect to /login.
 */
import { AskRequest, AskResponse, Chat, Message, ChatStats } from '@/types';
import api from './api';

/** List all chat sessions for the current user. */
export async function listChats(): Promise<Chat[]> {
  const { data } = await api.get<Chat[]>('/chats/');
  return data;
}

/** Create a new chat session. */
export async function createChat(title: string = 'New Chat'): Promise<Chat> {
  const { data } = await api.post<Chat>('/chats/', { title });
  return data;
}

/** Get a single chat by ID. */
export async function getChat(id: number): Promise<Chat> {
  const { data } = await api.get<Chat>(`/chats/${id}`);
  return data;
}

/** Rename a chat. */
export async function renameChat(id: number, title: string): Promise<Chat> {
  const { data } = await api.patch<Chat>(`/chats/${id}`, { title });
  return data;
}

/** Delete a chat and all its messages. */
export async function deleteChat(id: number): Promise<void> {
  await api.delete(`/chats/${id}`);
}

/** Get all messages for a chat (with sources parsed). */
export async function getChatMessages(chatId: number): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`/chats/${chatId}/messages`);
  return data;
}

/**
 * Send a question through the RAG pipeline.
 *
 * Embeds the question → searches Qdrant → builds prompt → calls Gemini.
 * Returns the answer + citations.
 */
export async function askQuestion(payload: AskRequest): Promise<AskResponse> {
  const { data } = await api.post<AskResponse>('/chats/ask', payload);
  return data;
}

/** Get RAG statistics for the user's dashboard. */
export async function getChatStats(): Promise<ChatStats> {
  const { data } = await api.get<ChatStats>('/chats/stats');
  return data;
}

/**
 * Stream a RAG response using Server-Sent Events.
 *
 * Yields:
 *   { type: 'token', text: string }      — each text chunk from Gemini
 *   { type: 'sources', data: object }    — final metadata event
 *   { type: 'done' }                     — stream finished
 *
 * Uses native fetch instead of EventSource so we can POST with JWT headers.
 */
export async function* askQuestionStream(
  payload: AskRequest,
): AsyncGenerator<
  | { type: 'token'; text: string }
  | { type: 'sources'; data: Record<string, unknown> }
  | { type: 'done' }
> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('docmind_access_token')
    : null;

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/chats/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6); // strip 'data: '

      if (payload === '[DONE]') {
        yield { type: 'done' };
        return;
      }

      if (payload.startsWith('[SOURCES] ')) {
        try {
          const meta = JSON.parse(payload.slice(10));
          yield { type: 'sources', data: meta };
        } catch {
          // ignore parse errors
        }
        continue;
      }

      // Regular text chunk — unescape \\n back to \n
      const text = payload.replace(/\\n/g, '\n');
      if (text) yield { type: 'token', text };
    }
  }

  yield { type: 'done' };
}
