'use client';
/**
 * Chat page (/chat) — Enterprise RAG AI Assistant.
 *
 * Features:
 *  - Document selector (limit search to specific docs)
 *  - Conversation window with auto-scroll
 *  - Typing / thinking indicator
 *  - AI answers with Markdown rendering
 *  - Citation cards with score, page, preview
 *  - Copy answer to clipboard
 *  - Chat history sidebar
 *  - Create / rename / delete chat sessions
 *  - Responsive premium design
 */
import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Bot, User, Plus, MessageSquare, Trash2, FileText,
  ChevronDown, ChevronRight, Copy, Check, AlertCircle,
  Sparkles, Clock, Database, Zap, BookOpen, X, Edit2,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { Chat, Document, Source, UIMessage } from '@/types';
import { listDocuments } from '@/lib/documents';
import {
  askQuestion, askQuestionStream, createChat, deleteChat, getChatMessages,
  listChats, renameChat,
} from '@/lib/chat';

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT: Source Citation Card
// ══════════════════════════════════════════════════════════════════════════
function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(source.score * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 6,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '8px 12px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 20, height: 20, borderRadius: 4, flexShrink: 0,
            background: 'var(--accent-subtle)', border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent-light)',
          }}>{index + 1}</span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {source.document_name}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            p.{source.page_number}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700,
            color: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#6b7280',
            background: pct >= 80 ? 'rgba(16,185,129,0.1)' : pct >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {pct}% match
          </span>
          {expanded ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '8px 12px 10px',
              borderTop: '1px solid var(--border)',
              fontSize: '0.75rem', color: 'var(--text-secondary)',
              lineHeight: 1.6, fontStyle: 'italic',
            }}>
              "{source.text_preview}"
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT: Message Bubble
// ══════════════════════════════════════════════════════════════════════════
function MessageBubble({ msg }: { msg: UIMessage }) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.role === 'user';

  function handleCopy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 12,
        marginBottom: '1.5rem',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
          : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        boxShadow: `0 4px 12px ${isUser ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`,
      }}>
        {isUser ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: '85%' }}>
        {/* Streaming / typing indicator */}
        {msg.isPending && !msg.isStreaming && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0px 14px 14px 14px',
            padding: '14px 18px',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }}
                />
              ))}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Searching documents & generating answer…
            </span>
          </div>
        )}

        {/* Error */}
        {msg.isError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '0px 14px 14px 14px', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--error)', fontSize: '0.85rem',
          }}>
            <AlertCircle size={16} />
            {msg.content}
          </div>
        )}

        {/* Normal message (or live streaming) */}
        {(!msg.isPending || msg.isStreaming) && !msg.isError && (
          <>
            <div style={{
              background: isUser
                ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.12) 100%)'
                : 'var(--surface)',
              border: isUser
                ? '1px solid rgba(99,102,241,0.2)'
                : '1px solid var(--border)',
              borderRadius: isUser ? '14px 0px 14px 14px' : '0px 14px 14px 14px',
              padding: '12px 16px',
            }}>
              {isUser ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                  {msg.content}
                </p>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.7 }}
                  className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                  {/* Streaming cursor */}
                  {msg.isStreaming && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      style={{ display: 'inline-block', width: 2, height: '1em', background: '#10b981', marginLeft: 2, verticalAlign: 'text-bottom' }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Actions + meta */}
            {!isUser && (
              <div style={{ marginTop: 8 }}>
                {/* Action row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Copy button */}
                  <button onClick={handleCopy} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.7rem', color: 'var(--text-muted)', padding: '3px 6px',
                    borderRadius: 4, transition: 'color 0.2s',
                  }}>
                    {copied ? <><Check size={12} color="#10b981" /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>

                  {/* Sources toggle */}
                  {msg.sources && msg.sources.length > 0 && (
                    <button onClick={() => setShowSources(!showSources)} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: showSources ? 'var(--accent-subtle)' : 'none',
                      border: showSources ? '1px solid rgba(99,102,241,0.25)' : 'none',
                      cursor: 'pointer', fontSize: '0.7rem',
                      color: showSources ? 'var(--accent-light)' : 'var(--text-muted)',
                      padding: '3px 8px', borderRadius: 4,
                    }}>
                      <BookOpen size={12} /> {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  {/* Stats */}
                  {msg.retrieval_stats && (
                    <>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Database size={10} /> {msg.retrieval_stats.chunks_retrieved} chunks
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {msg.retrieval_stats.total_latency_ms}ms
                      </span>
                    </>
                  )}
                  {msg.usage && msg.usage.total_tokens > 0 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Zap size={10} /> {msg.usage.total_tokens} tokens
                    </span>
                  )}
                </div>

                {/* Sources accordion */}
                <AnimatePresence>
                  {showSources && msg.sources && msg.sources.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden', marginTop: 8 }}
                    >
                      <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Citations
                      </p>
                      {msg.sources.map((s, i) => (
                        <SourceCard key={i} source={s} index={i} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT: Document Selector
// ══════════════════════════════════════════════════════════════════════════
function DocumentSelector({
  documents,
  selected,
  onChange,
}: {
  documents: Document[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const embedded = documents.filter(d => d.processing_status === 'processed');

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: selected.length > 0 ? 'var(--accent-subtle)' : 'var(--surface)',
          border: `1px solid ${selected.length > 0 ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
          borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
          fontSize: '0.78rem', fontWeight: 600,
          color: selected.length > 0 ? 'var(--accent-light)' : 'var(--text-muted)',
        }}
      >
        <FileText size={14} />
        {selected.length === 0
          ? 'All documents'
          : `${selected.length} doc${selected.length > 1 ? 's' : ''}`}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            style={{
              position: 'absolute', bottom: '110%', left: 0,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: '8px', minWidth: 260, zIndex: 100,
              maxHeight: 280, overflowY: 'auto',
            }}
          >
            <button
              onClick={() => onChange([])}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '7px 10px', cursor: 'pointer', borderRadius: 6,
                fontSize: '0.78rem', color: selected.length === 0 ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontWeight: selected.length === 0 ? 700 : 400,
              }}
            >
              🔍 Search all documents
            </button>
            {embedded.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 10px' }}>
                No indexed documents yet. Upload + embed documents first.
              </p>
            )}
            {embedded.map(doc => (
              <button
                key={doc.id}
                onClick={() => toggle(doc.id)}
                style={{
                  width: '100%', textAlign: 'left', background: selected.includes(doc.id) ? 'var(--accent-subtle)' : 'none',
                  border: 'none', padding: '7px 10px', cursor: 'pointer', borderRadius: 6,
                  fontSize: '0.78rem', color: selected.includes(doc.id) ? 'var(--accent-light)' : 'var(--text-secondary)',
                  fontWeight: selected.includes(doc.id) ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  background: selected.includes(doc.id) ? 'var(--accent)' : 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected.includes(doc.id) && <Check size={10} color="white" />}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.original_filename}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function ChatPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const [chats, setChats]               = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages]         = useState<UIMessage[]>([]);
  const [question, setQuestion]         = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [documents, setDocuments]       = useState<Document[]>([]);
  const [isAsking, setIsAsking]         = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editTitle, setEditTitle]       = useState('');

  // Load documents + chats
  useEffect(() => {
    listDocuments().then(setDocuments).catch(() => {});
    listChats().then(setChats).catch(() => {});
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    getChatMessages(activeChatId).then(msgs => {
      setMessages(msgs.map(m => ({
        id:    String(m.id),
        role:  m.role,
        content: m.content,
        sources: m.sources || [],
        created_at: m.created_at,
      })));
    }).catch(() => {});
  }, [activeChatId]);

  // Send question through RAG streaming pipeline
  async function handleAsk() {
    const q = question.trim();
    if (!q || isAsking) return;

    setQuestion('');
    setIsAsking(true);

    // Optimistic user message
    const userMsg: UIMessage = {
      id:    `user-${Date.now()}`,
      role:  'user',
      content: q,
      sources: [],
      created_at: new Date().toISOString(),
    };

    // Streaming AI message (starts empty, fills token by token)
    const streamingMsgId = `stream-${Date.now()}`;
    const streamingMsg: UIMessage = {
      id:    streamingMsgId,
      role:  'assistant',
      content: '',
      sources: [],
      created_at: new Date().toISOString(),
      isPending: true,
      isStreaming: false,
    };

    setMessages(prev => [...prev, userMsg, streamingMsg]);

    try {
      // Ensure we have a chat session
      let chatId = activeChatId;
      if (!chatId) {
        const newChat = await createChat(q.slice(0, 50));
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        chatId = newChat.id;
      }

      const stream = askQuestionStream({
        question: q,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
        chat_id: chatId,
      });

      for await (const event of stream) {
        if (event.type === 'token') {
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId
              ? { ...m, isPending: false, isStreaming: true, content: m.content + event.text }
              : m
          ));
        } else if (event.type === 'sources') {
          const meta = event.data as {
            sources?: Source[];
            message_id?: number;
            retrieval_stats?: UIMessage['retrieval_stats'];
            usage?: UIMessage['usage'];
          };
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId
              ? {
                  ...m,
                  isStreaming: false,
                  isPending: false,
                  id: String(meta.message_id || streamingMsgId),
                  sources: meta.sources || [],
                  retrieval_stats: meta.retrieval_stats,
                  usage: meta.usage,
                }
              : m
          ));
        } else if (event.type === 'done') {
          // Finalize any remaining streaming state
          setMessages(prev => prev.map(m =>
            m.id === streamingMsgId ? { ...m, isStreaming: false, isPending: false } : m
          ));
        }
      }

      // Refresh chat list
      listChats().then(setChats).catch(() => {});

    } catch (err: unknown) {
      const detail = (err as { message?: string })?.message
        ?? 'Failed to get an answer. Please try again.';
      const errorMsg: UIMessage = {
        id:    `err-${Date.now()}`,
        role:  'assistant',
        content: detail,
        sources: [],
        created_at: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => prev.filter(m => m.id !== streamingMsgId).concat(errorMsg));
    } finally {
      setIsAsking(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  async function handleNewChat() {
    setActiveChatId(null);
    setMessages([]);
  }

  async function handleDeleteChat(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteChat(id).catch(() => {});
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  }

  async function handleRename(id: number) {
    if (!editTitle.trim()) { setEditingChatId(null); return; }
    const updated = await renameChat(id, editTitle.trim()).catch(() => null);
    if (updated) {
      setChats(prev => prev.map(c => c.id === id ? updated : c));
    }
    setEditingChatId(null);
  }

  const exampleQuestions = [
    'What are the main topics in my documents?',
    'Summarize the key findings from the uploaded papers.',
    'What are the requirements mentioned in this document?',
    'Explain the methodology described in the report.',
  ];

  return (
    <AppShell title="AI Chat">
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: 0, margin: '-1.5rem', overflow: 'hidden' }}>

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <motion.div
          animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            overflow: 'hidden', flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border)' }}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleNewChat}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
                border: 'none', borderRadius: 8, padding: '10px 16px',
                cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: '0.85rem',
              }}
            >
              <Plus size={16} /> New Chat
            </motion.button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {chats.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                No conversations yet
              </p>
            )}
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 7, marginBottom: 2,
                  background: activeChatId === chat.id ? 'var(--accent-subtle)' : 'transparent',
                  border: activeChatId === chat.id ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <MessageSquare size={14} color={activeChatId === chat.id ? 'var(--accent-light)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />

                {editingChatId === chat.id ? (
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => handleRename(chat.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(chat.id); }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)',
                      borderRadius: 4, padding: '2px 6px', fontSize: '0.78rem',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                ) : (
                  <span style={{
                    flex: 1, fontSize: '0.78rem', fontWeight: 500,
                    color: activeChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {chat.title}
                  </span>
                )}

                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingChatId(chat.id); setEditTitle(chat.title); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 3, color: 'var(--text-muted)', opacity: 0.6 }}
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={e => handleDeleteChat(chat.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 3, color: '#ef4444', opacity: 0.6 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Chat area ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--background)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
              >
                <MessageSquare size={18} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={16} color="white" />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    DocMind AI Assistant
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Powered by Gemini 2.5 Flash + RAG
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: '0.68rem', color: '#10b981', background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)', padding: '3px 8px', borderRadius: 4, fontWeight: 600,
              }}>
                ● Online
              </span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            {/* Welcome screen */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: '3rem' }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 40px rgba(16,185,129,0.3)',
                }}>
                  <Sparkles size={32} color="white" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Ask your documents anything
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                  I'll search through your uploaded documents and give you grounded answers with citations.
                  I <strong>only</strong> answer from your documents — no hallucinations.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left' }}>
                  {exampleQuestions.map((q, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setQuestion(q); inputRef.current?.focus(); }}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                        fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'left',
                        lineHeight: 1.4, transition: 'all 0.2s',
                      }}
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--background)',
          }}>
            {/* Document selector */}
            <div style={{ marginBottom: 10 }}>
              <DocumentSelector
                documents={documents}
                selected={selectedDocIds}
                onChange={setSelectedDocIds}
              />
            </div>

            {/* Input box */}
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '10px 12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents…"
                rows={1}
                disabled={isAsking}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  resize: 'none', fontSize: '0.9rem', color: 'var(--text-primary)',
                  lineHeight: 1.5, minHeight: 24, maxHeight: 120, overflowY: 'auto',
                  fontFamily: 'inherit',
                }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleAsk}
                disabled={isAsking || !question.trim()}
                style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isAsking || !question.trim()
                    ? 'var(--border)'
                    : 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
                  border: 'none', cursor: isAsking || !question.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {isAsking
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Sparkles size={16} color="var(--text-muted)" />
                    </motion.div>
                  : <Send size={16} color={!question.trim() ? 'var(--text-muted)' : 'white'} />
                }
              </motion.button>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
              Press Enter to send · Shift+Enter for new line · Answers sourced exclusively from your documents
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .markdown-body p { margin: 0 0 0.75em 0; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5em; margin: 0.5em 0; }
        .markdown-body li { margin-bottom: 0.25em; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          color: var(--text-primary); font-weight: 700;
          margin: 0.75em 0 0.4em;
        }
        .markdown-body h1 { font-size: 1.1em; }
        .markdown-body h2 { font-size: 1em; }
        .markdown-body h3 { font-size: 0.95em; }
        .markdown-body code {
          background: rgba(99,102,241,0.1); padding: 1px 5px; border-radius: 4px;
          font-family: monospace; font-size: 0.9em; color: var(--accent-light);
        }
        .markdown-body pre {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 12px; overflow-x: auto; margin: 0.75em 0;
        }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body strong { color: var(--text-primary); font-weight: 700; }
        .markdown-body blockquote {
          border-left: 3px solid var(--accent); padding-left: 12px;
          color: var(--text-muted); margin: 0.5em 0; font-style: italic;
        }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .markdown-body td, .markdown-body th {
          border: 1px solid var(--border); padding: 6px 10px; font-size: 0.85em;
        }
        .markdown-body th { background: var(--surface); font-weight: 700; }
      `}</style>
    </AppShell>
  );
}
