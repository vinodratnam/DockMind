/**
 * Features section — highlights the 6 core capabilities of DocMind AI.
 */
'use client';

import { motion, type Variants } from 'framer-motion';
import {
  Brain,
  Search,
  Shield,
  Zap,
  FileStack,
  MessagesSquare,
} from 'lucide-react';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const FEATURES: Feature[] = [
  {
    icon: <Brain size={22} />,
    title: 'RAG-Powered Understanding',
    description:
      'Retrieval-Augmented Generation grounds every answer in your actual documents — no hallucinations, just facts.',
    color: '#6366f1',
  },
  {
    icon: <Search size={22} />,
    title: 'Semantic Search',
    description:
      'Search by meaning, not just keywords. Find exactly the passage you need across hundreds of documents.',
    color: '#8b5cf6',
  },
  {
    icon: <FileStack size={22} />,
    title: 'Multi-Document Context',
    description:
      'Ask questions that span multiple files. DocMind AI synthesises context across your entire library.',
    color: '#06b6d4',
  },
  {
    icon: <MessagesSquare size={22} />,
    title: 'Natural Chat Interface',
    description:
      'Converse naturally with your documents. Follow-up questions, clarifications, and summaries — all in one thread.',
    color: '#10b981',
  },
  {
    icon: <Zap size={22} />,
    title: 'Instant Responses',
    description:
      'Optimised vector retrieval means answers in milliseconds, even over large document collections.',
    color: '#f59e0b',
  },
  {
    icon: <Shield size={22} />,
    title: 'Enterprise Security',
    description:
      'JWT authentication, encrypted storage, and strict access controls keep your sensitive documents safe.',
    color: '#ef4444',
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
};

export default function Features() {
  return (
    <section id="features" style={{ padding: '6rem 1.5rem' }}>
      <div className="container">
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <span className="badge badge-accent" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            Features
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
            Everything you need to unlock{' '}
            <span className="gradient-text">document intelligence</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            A complete AI document platform built for teams who need accurate,
            fast, and secure answers from their knowledge base.
          </p>
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              whileHover={{ y: -4 }}
              className="glass-card"
              style={{ padding: '1.75rem' }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${feature.color}18`,
                  border: `1px solid ${feature.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: feature.color,
                  marginBottom: '1.25rem',
                }}
              >
                {feature.icon}
              </div>

              <h3
                style={{
                  fontWeight: 700,
                  fontSize: '1rem',
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              >
                {feature.title}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.65 }}>
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
