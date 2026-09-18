import type { Metadata } from 'next';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import ArchOverview from '@/components/landing/ArchOverview';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';
import LandingNav from '@/components/landing/LandingNav';

export const metadata: Metadata = {
  title: 'DocMind AI — Chat with your Documents using AI',
};

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <LandingNav />

      {/* ── Page sections ── */}
      <main style={{ flex: 1 }}>
        <Hero />
        <Features />
        <ArchOverview />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
