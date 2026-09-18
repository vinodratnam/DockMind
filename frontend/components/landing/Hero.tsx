/**
 * Landing page Hero section.
 * Large headline, sub-copy, CTA buttons, and an animated glow orb.
 */
'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '90vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        padding: '6rem 1.5rem',
      }}
    >
      {/* Background glow orb */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(60px)',
        }}
      />
      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)',
          opacity: 0.4,
        }}
      />

      <div className="container" style={{ position: 'relative', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <motion.div variants={container} initial="hidden" animate="show">
          {/* Badge */}
          <motion.div variants={item} style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <span className="badge badge-accent">
              <Sparkles size={12} />
              Powered by RAG Architecture
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: '1.5rem',
              color: 'var(--text-primary)',
            }}
          >
            Your Documents,{' '}
            <span className="gradient-text">Intelligently</span>
            <br />
            Understood
          </motion.h1>

          {/* Sub-copy */}
          <motion.p
            variants={item}
            style={{
              fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
              color: 'var(--text-secondary)',
              maxWidth: 580,
              margin: '0 auto 2.5rem',
              lineHeight: 1.7,
            }}
          >
            DocMind AI transforms your PDFs, docs, and files into intelligent
            conversations. Ask questions, get answers — powered by next-generation
            Retrieval-Augmented Generation.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={item}
            style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <Link href="/register">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0.875rem 2rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 24px var(--accent-glow)',
                  letterSpacing: '-0.01em',
                }}
              >
                Get started free
                <ArrowRight size={16} />
              </motion.button>
            </Link>

            <Link href="#features">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="btn-ghost"
                style={{ padding: '0.875rem 2rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Zap size={16} />
                See how it works
              </motion.button>
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.p
            variants={item}
            style={{
              marginTop: '2rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            No credit card required · Free forever tier available
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
