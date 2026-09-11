'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button } from './button';

type ToastTone = 'success' | 'error' | 'info';
interface ToastMessage {
  title: string;
  description?: string;
  tone?: ToastTone;
}
interface ToastEntry {
  id: number;
  message: ToastMessage;
}
const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);
const icons = { success: CheckCircle, error: WarningCircle, info: Info };
const tones = { success: 'text-success', error: 'text-error', info: 'text-info' };

/** Mount once at the app root; call useToast() with transient UI feedback. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const [open, setOpen] = useState(false);
  const notify = useCallback((message: ToastMessage) => {
    setEntry((previous) => ({ id: (previous?.id ?? 0) + 1, message }));
    setOpen(true);
  }, []);
  const Icon = icons[entry?.message.tone ?? 'info'];
  return (
    <ToastContext.Provider value={notify}>
      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {children}
        {entry ? (
          <ToastPrimitive.Root
            key={entry.id}
            open={open}
            onOpenChange={setOpen}
            className="panel-enter flex items-start gap-3 rounded-control border border-line bg-surface p-4 shadow-floating data-[swipe=end]:translate-x-full"
          >
            <Icon
              size={22}
              className={`mt-0.5 shrink-0 ${tones[entry.message.tone ?? 'info']}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-small font-bold">
                {entry.message.title}
              </ToastPrimitive.Title>
              {entry.message.description ? (
                <ToastPrimitive.Description className="mt-1 text-caption text-muted">
                  {entry.message.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={18} />
              </Button>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ) : null}
        <ToastPrimitive.Viewport className="fixed bottom-5 right-5 z-toast m-0 flex w-[calc(100%-2.5rem)] max-w-copy list-none flex-col outline-none sm:w-96" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast must be used within ToastProvider');
  return notify;
}
