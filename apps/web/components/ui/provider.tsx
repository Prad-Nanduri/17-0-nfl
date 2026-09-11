'use client';

import { IconContext } from '@phosphor-icons/react';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { ToastProvider } from './toast';

const iconDefaults = { weight: 'regular', size: 20 } as const;

export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={iconDefaults}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </IconContext.Provider>
  );
}
