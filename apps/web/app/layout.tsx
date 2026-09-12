import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '../components/session/session-provider';
import { UIProvider } from '../components/ui/provider';

export const metadata: Metadata = {
  title: {
    default: 'Perfect Season | Draft it. Play it. Chase perfection.',
    template: '%s | Perfect Season',
  },
  description:
    'Draft a roster across every era of football, play the season, and chase 17-0. No signup needed.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UIProvider>
          <SessionProvider>{children}</SessionProvider>
        </UIProvider>
        <Analytics />
      </body>
    </html>
  );
}
