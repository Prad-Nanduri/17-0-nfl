'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useSession } from './session-provider';

/** Links into the draft room for the session's current sport. */
export function PlayLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const { sport } = useSession();
  return <Link href={`/play/${sport}`} {...props} />;
}
