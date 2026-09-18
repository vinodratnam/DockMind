/**
 * Architecture Overview section — shows the RAG pipeline diagram
 * with animated step-by-step flow from document upload to AI answer.
 */
'use client';

import { motion } from 'framer-motion';
import { Upload, Cpu, Database, MessageSquare, ArrowRight } from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
}

const STEPS: Step[] = [
  {
    icon: <Upload size={20} />,
    label: '1. Upload',
    description: 'Drag & drop your PDFs, Word docs, and text files.',
    color: '#6366f1',
  },
  {
    icon: <Cpu size={20} />,
    label: '2. Process',
    description: 'Documents are chunked, embedded, and indexed.',
    color: '#8b5cf6',
  },
  {
    icon: <Database size={20} />,
    label: '3. Store',
    description: 'Vectors are stored in a high-performance database.',
    color: '#06b6d4',
  },
  {
    icon: <MessageSquare size={20} />,
    label: '4. Chat',
    description: 'Ask questions — get grounded, accurate answers.',
    color: '#10b981',
  },
];

export default function ArchOverview() {
  return (
    <section
      style={{
        padding: '6rem 1.5rem',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="badge badge-accent" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            Architecture
          </span>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '1rem',
              color: 'var(--text-primary)',
            }}
          >
            Built on a{' '}
            <span className="gradient-text">production-ready</span> RAG pipeline
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Every component is designed for scale — from single-user projects to
            enterprise deployments processing millions of documents.
          </p>
        </div>

        {/* Pipeline steps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {STEPS.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: 200,
                  padding: '0 0.5rem',
                }}
              >
                {/* Icon circle */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: `${step.color}18`,
                    border: `2px solid ${step.color}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: step.color,
                    marginBottom: '1rem',
                    boxShadow: `0 0 24px ${step.color}22`,
                    position: 'relative',
                  }}
                >
                  {step.icon}
                  {/* Pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6 }}
                    style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      border: `1px solid ${step.color}50`,
                    }}
                  />
                </motion.div>

                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
                  {step.label}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {step.description}
                </p>
              </motion.div>

              {/* Arrow connector */}
              {i < STEPS.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  whileInView={{ opacity: 1, scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                    marginBottom: '2.75rem',
                    transformOrigin: 'left',
                  }}
                >
                  <ArrowRight size={20} />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        {/* Tech stack badges */}
        <div style={{ marginTop: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            POWERED BY
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Next.js 15', 'FastAPI', 'PostgreSQL', 'pgvector', 'LangChain', 'OpenAI'].map((tech) => (
              <span key={tech} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
