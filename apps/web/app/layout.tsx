import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { UIProvider } from '../components/ui/provider';

export const metadata: Metadata = {
  title: { default: 'Perfect Season | Greatness. Your call.', template: '%s | Perfect Season' },
  description:
    'A football draft-and-simulation platform. Explore the visual preview of Perfect Season.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
