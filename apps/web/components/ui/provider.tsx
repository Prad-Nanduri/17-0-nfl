'use client';

import { IconContext } from '@phosphor-icons/react';
import { MotionConfig } from 'framer-motion';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ToastProvider } from './toast';

const iconDefaults = { weight: 'regular', size: 20 } as const;
const AppearanceContext = createContext<{
  theme: string;
  setTheme: (theme: string) => void;
} | null>(null);

export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error('useAppearance must be used within UIProvider');
  return appearance;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('system');
  useEffect(() => {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  return (
    <AppearanceContext.Provider value={{ theme, setTheme }}>
      <IconContext.Provider value={iconDefaults}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </IconContext.Provider>
    </AppearanceContext.Provider>
  );
}
