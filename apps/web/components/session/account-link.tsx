'use client';

import Link from 'next/link';
import { UserCircle } from '@phosphor-icons/react';
import { useSession } from './session-provider';

/** Header entry to the optional guest → account upgrade; shows the email once linked. */
export function AccountLink({ active }: { active: boolean }) {
  const { user } = useSession();
  const label = user?.email ? user.email.split('@')[0] : 'Save progress';
  return (
    <Link
      href="/account"
      aria-current={active ? 'page' : undefined}
      aria-label={user?.email ? `Account: ${user.email}` : 'Save progress with an account'}
      className={`hidden min-h-11 items-center gap-1.5 text-small font-semibold transition-colors hover:text-action sm:inline-flex ${active ? 'text-action' : 'text-muted'}`}
    >
      <UserCircle size={18} aria-hidden="true" />
      <span className="max-w-[9rem] truncate">{label}</span>
    </Link>
  );
}
