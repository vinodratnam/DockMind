/**
 * Root layout — wraps the entire Next.js app.
 *
 * Provides:
 *   - Google Fonts (Inter via CSS @import)
 *   - ThemeProvider (next-themes)
 *   - AuthProvider (global auth state)
 *   - Base HTML metadata
 */
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'DocMind AI — Intelligent Document Assistant',
    template: '%s | DocMind AI',
  },
  description:
    'DocMind AI transforms your PDFs and documents into intelligent conversations using Retrieval-Augmented Generation.',
  keywords: ['AI', 'document assistant', 'RAG', 'PDF chat', 'knowledge base'],
  authors: [{ name: 'DocMind AI' }],
  openGraph: {
    title: 'DocMind AI',
    description: 'Chat with your documents using AI',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="docmind-theme"
        >
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
