'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './button';

export interface ModalProps {
  trigger: ReactElement;
  title: string;
  description: string;
  children: ReactNode;
}

/** Pass a Button as trigger; Radix traps focus and restores it on Escape or dismissal. */
export function Modal({ trigger, title, description, children }: ModalProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-enter fixed inset-0 z-overlay bg-primary-950/60" />
        <Dialog.Content className="fixed inset-0 z-modal m-auto h-fit max-h-[calc(100dvh-2.5rem)] w-[calc(100%-2.5rem)] max-w-copy overflow-y-auto rounded-panel bg-surface p-6 shadow-floating sm:p-10">
          <div className="panel-enter relative">
            <Dialog.Title className="display-heading pr-10 text-heading">{title}</Dialog.Title>
            <Dialog.Description className="mt-4 text-small text-muted">
              {description}
            </Dialog.Description>
            <div className="mt-6">{children}</div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close dialog"
                className="absolute right-0 top-0"
              >
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
