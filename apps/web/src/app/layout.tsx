import type { Metadata } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--ff-display',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--ff-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cadence — AI campaign co-pilot',
  description:
    'Describe the goal. Cadence finds the audience, writes the message, picks the channel, and tells you what worked.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <div className="flex">
          <Sidebar />
          <main className="h-screen flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
          </main>
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-ink)',
            },
          }}
        />
      </body>
    </html>
  );
}
