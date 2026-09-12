'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClientSession } from '../../app/api/session/route';
import type { SportId } from '../../lib/sport';
import { isSportLocked } from '../../lib/sport';

export type ActiveDraft = ClientSession['activeDraft'];

interface SessionContextValue {
  readonly loaded: boolean;
  readonly sport: SportId;
  readonly user: ClientSession['user'];
  readonly activeDraft: ActiveDraft;
  readonly sportLocked: boolean;
  chooseSport(sport: SportId): Promise<void>;
  setActiveDraft(draft: ActiveDraft): void;
  refresh(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSession(): Promise<ClientSession> {
  const response = await fetch('/api/session', { cache: 'no-store' });
  const payload = (await response.json()) as { session: ClientSession };
  return payload.session;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [sport, setSport] = useState<SportId>('nfl');
  const [user, setUser] = useState<ClientSession['user']>(null);
  const [activeDraft, setActiveDraft] = useState<ActiveDraft>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchSession();
      setSport(session.sport);
      setUser(session.user);
      setActiveDraft(session.activeDraft);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chooseSport = useCallback(async (next: SportId) => {
    const response = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sport: next }),
    });
    const payload = (await response.json()) as { session?: ClientSession; error?: string };
    if (!response.ok || payload.session === undefined) {
      throw new Error(payload.error ?? 'Could not switch sport');
    }
    setSport(payload.session.sport);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      loaded,
      sport,
      user,
      activeDraft,
      sportLocked: isSportLocked(activeDraft),
      chooseSport,
      setActiveDraft,
      refresh,
    }),
    [loaded, sport, user, activeDraft, chooseSport, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
