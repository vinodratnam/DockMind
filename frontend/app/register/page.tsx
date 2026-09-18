/**
 * Register page (/register)
 *
 * Features:
 *   - Name / Email / Password / Confirm-password form
 *   - Password strength indicator
 *   - Inline field validation
 *   - API error handling (e.g. duplicate email)
 */
'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/theme/ThemeToggle';

function PasswordStrength({ password }: { password: string }) {
  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors  = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

  if (!password) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= strength ? colors[strength] : 'var(--border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: colors[strength] }}>{labels[strength]}</p>
    </div>
  );
}

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, authLoading, router]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.length < 2)       errs.name     = 'Name must be at least 2 characters';
    if (!email)                                  errs.email    = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (!password || password.length < 8)        errs.password = 'Password must be at least 8 characters';
    if (password !== confirm)                    errs.confirm  = 'Passwords do not match';
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      await register(name.trim(), email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fieldProps(key: string) {
    return {
      onChange: () => setFieldErrors((fe) => { const n = { ...fe }; delete n[key]; return n; }),
    };
  }

  if (authLoading) return null;

  const perks = [
    'Free forever tier',
    'Up to 10 documents',
    'No credit card required',
  ];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 1.5rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      {/* Top bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={13} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>DocMind AI</span>
        </Link>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: 880, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }} className="register-grid">
        {/* Left — perks */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="register-perks"
        >
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Start your AI-powered document journey
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem', fontSize: '0.95rem' }}>
            Join teams that use DocMind AI to turn their document libraries into instant, accurate knowledge bases.
          </p>
          {perks.map((perk) => (
            <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <CheckCircle2 size={18} color="var(--success)" />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{perk}</span>
            </div>
          ))}
        </motion.div>

        {/* Right — form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '2.5rem',
          }}
        >
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.375rem', color: 'var(--text-primary)' }}>
              Create your account
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Free forever. No credit card needed.</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ marginBottom: '1.25rem', padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', fontSize: '0.875rem' }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Full name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="register-name" type="text" value={name} onChange={(e) => { setName(e.target.value); fieldProps('name').onChange(); }} placeholder="Jane Doe" className="input-field" style={{ paddingLeft: 42, borderColor: fieldErrors.name ? 'var(--error)' : undefined }} autoComplete="name" />
              </div>
              {fieldErrors.name && <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--error)' }}>{fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="register-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); fieldProps('email').onChange(); }} placeholder="you@company.com" className="input-field" style={{ paddingLeft: 42, borderColor: fieldErrors.email ? 'var(--error)' : undefined }} autoComplete="email" />
              </div>
              {fieldErrors.email && <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--error)' }}>{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="register-password" type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); fieldProps('password').onChange(); }} placeholder="Min. 8 characters" className="input-field" style={{ paddingLeft: 42, paddingRight: 42, borderColor: fieldErrors.password ? 'var(--error)' : undefined }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass((s) => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <PasswordStrength password={password} />
              {fieldErrors.password && <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--error)' }}>{fieldErrors.password}</p>}
            </div>

            {/* Confirm */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="register-confirm" type={showPass ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); fieldProps('confirm').onChange(); }} placeholder="Repeat password" className="input-field" style={{ paddingLeft: 42, borderColor: fieldErrors.confirm ? 'var(--error)' : undefined }} autoComplete="new-password" />
              </div>
              {fieldErrors.confirm && <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--error)' }}>{fieldErrors.confirm}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{ width: '100%', padding: '0.875rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px var(--accent-glow)', letterSpacing: '-0.01em' }}
            >
              {loading ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={18} /></motion.div>Creating account…</>
              ) : (
                <>Create free account <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </motion.div>
      </div>

      <style>{`
        .register-grid { grid-template-columns: 1fr 1fr; }
        .register-perks { display: block; }
        @media (max-width: 700px) {
          .register-grid { grid-template-columns: 1fr !important; }
          .register-perks { display: none !important; }
        }
      `}</style>
    </div>
  );
}
