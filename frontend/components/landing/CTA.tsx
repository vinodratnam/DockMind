/**
 * CTA (Call-To-Action) section — final conversion push before footer.
 */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CTA() {
  return (
    <section style={{ padding: '6rem 1.5rem' }}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'relative',
            borderRadius: 24,
            padding: 'clamp(3rem, 6vw, 5rem)',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 50%, rgba(6,182,212,0.1) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Background glow */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(40px)',
            }}
          />

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <span className="badge badge-accent">
                <Sparkles size={12} />
                Start for free today
              </span>
            </div>

            <h2
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                marginBottom: '1.25rem',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              Ready to make your documents{' '}
              <span className="gradient-text">talk back?</span>
            </h2>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'clamp(1rem, 2vw, 1.125rem)',
                maxWidth: 480,
                margin: '0 auto 2.5rem',
                lineHeight: 1.7,
              }}
            >
              Join thousands of teams turning static documents into dynamic knowledge. 
              Start free, upgrade when you scale.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                    borderRadius: 12,
                    padding: '1rem 2.25rem',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 32px var(--accent-glow)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Create free account
                  <ArrowRight size={18} />
                </motion.button>
              </Link>

              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-ghost"
                  style={{ padding: '1rem 2.25rem', fontSize: '1rem' }}
                >
                  Sign in
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
