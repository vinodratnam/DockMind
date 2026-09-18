/**
 * Settings page (/settings) — allows the user to customize account settings, RAG parameters, and view system status.
 */
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, User, Sliders, Shield, Database, Cpu, Check, Activity, Save
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { VectorStoreHealth } from '@/types';
import { getVectorStoreHealth } from '@/lib/documents';

export default function SettingsPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<VectorStoreHealth | null>(null);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.25);
  const [isSaved, setIsSaved] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    async function loadHealth() {
      try {
        const h = await getVectorStoreHealth();
        setHealth(h);
      } catch {
        // failed silently
      } finally {
        setLoadingHealth(false);
      }
    }
    loadHealth();

    // Load custom RAG settings from localStorage if set
    const savedTopK = localStorage.getItem('rag_top_k');
    const savedThreshold = localStorage.getItem('rag_threshold');
    if (savedTopK) setTopK(parseInt(savedTopK, 10));
    if (savedThreshold) setThreshold(parseFloat(savedThreshold));
  }, []);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('rag_top_k', topK.toString());
    localStorage.setItem('rag_threshold', threshold.toString());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }

  return (
    <AppShell title="Settings">
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '1.5rem',
      }} className="settings-grid">
        
        {/* Left Column: Settings Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* RAG Settings */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '1.5rem' }}
          >
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Sliders size={18} color="var(--accent)" /> RAG Parameters
            </h3>
            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                {/* Top K */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Search Results (Top-K)
                    </label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-light)' }}>
                      {topK} chunks
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%', accentColor: 'var(--accent)', cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                    Number of matching context text chunks to send to the Gemini AI model. Higher values give more context but use more tokens.
                  </span>
                </div>

                {/* Similarity Threshold */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Similarity Threshold
                    </label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-light)' }}>
                      {threshold.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.9"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    style={{
                      width: '100%', accentColor: 'var(--accent)', cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                    Minimum match score required to retrieve a chunk. Chunks with scores lower than this will be ignored to prevent unrelated results.
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', maxWidth: '180px'
                }}
              >
                {isSaved ? (
                  <>
                    <Check size={16} /> Saved!
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save settings
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>

          {/* User Profile Settings */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card"
              style={{ padding: '1.5rem' }}
            >
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <User size={18} color="var(--accent)" /> Account Settings
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Full Name</span>
                  <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Email Address</span>
                  <span style={{ color: 'var(--text-primary)' }}>{user.email}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Role Access</span>
                  <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={12} color="#10b981" /> Developer / Administrator
                  </span>
                </div>
              </div>
            </motion.div>
          )}

        </div>

        {/* Right Column: Connection Health Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Connection Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card"
            style={{ padding: '1.5rem', background: 'rgba(16,185,129,0.01)' }}
          >
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="#10b981" /> Core Services
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                color: health?.connected ? '#10b981' : '#ef4444',
                background: health?.connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${health?.connected ? '#10b981' : '#ef4444'}40`
              }}>
                {health?.connected ? 'SYSTEM HEALTHY' : 'ERROR'}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.8rem' }}>
              {/* Qdrant DB connection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-overlay)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                <Database size={20} color={health?.connected ? '#10b981' : '#ef4444'} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Qdrant Vector Database</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {health?.connected ? `Running in ${health.qdrant_mode} mode · ${health.vector_count} points` : 'Vector database disconnected.'}
                  </p>
                </div>
              </div>

              {/* Gemini Model config */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-overlay)', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                <Cpu size={20} color={health?.connected ? 'var(--accent)' : '#ef4444'} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Google Gemini LLM</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {health?.connected ? 'Model: Gemini 2.5 Flash (Grounded)' : 'Google AI key unconfigured.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>

      </div>

      <style>{`
        .settings-grid { grid-template-columns: 1.5fr 1fr; }
        @media (max-width: 750px) { .settings-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppShell>
  );
}
