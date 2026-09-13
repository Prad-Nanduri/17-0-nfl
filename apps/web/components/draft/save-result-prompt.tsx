'use client';

import { useState, type FormEvent } from 'react';
import { EnvelopeSimple, X } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { fetchJson } from '../../lib/api-client';
import { useSession } from '../session/session-provider';

type Phase = 'idle' | 'sent' | 'skipped';

/**
 * Optional post-draft claim (spec §0.5): attach a display name to this result
 * via the standard magic-link flow. Skipping is a fully supported path — the
 * result stays on the leaderboard under its generated guest alias.
 */
export function SaveResultPrompt({ draftId }: { draftId: string }) {
  const { user, loaded } = useSession();
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already-verified accounts persist results under their name automatically.
  if (phase === 'skipped' || (loaded && user?.email)) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fetchJson<{ sent?: boolean }>('/api/results/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId, displayName, email }),
      });
      setPhase('sent');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the link');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'sent') {
    return (
      <Card elevation="raised" className="p-6 lg:col-span-2">
        <p className="eyebrow text-sport">Check your email</p>
        <p className="mt-2 text-small text-muted">
          We sent a sign-in link to <span className="font-semibold text-ink">{email}</span>. Click
          it and this season shows on the leaderboard as{' '}
          <span className="font-semibold text-ink">{displayName.trim()}</span>.
        </p>
      </Card>
    );
  }

  return (
    <Card elevation="raised" className="p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-sport">Optional</p>
          <h2 className="display-heading mt-2 text-title">Save this result under your name?</h2>
          <p className="mt-2 text-small text-muted">
            It is already on the leaderboard under a guest alias. Add a name and email to claim it —
            we will send a one-tap sign-in link. Skipping changes nothing.
          </p>
        </div>
        <button
          type="button"
          aria-label="Skip saving this result"
          onClick={() => setPhase('skipped')}
          className="rounded-control p-2 text-muted hover:bg-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="claim-name">
          Display name
        </label>
        <input
          id="claim-name"
          type="text"
          required
          maxLength={40}
          autoComplete="nickname"
          placeholder="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="min-h-12 flex-1 basis-[10rem] rounded-control border border-line bg-surface px-4 text-small text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        />
        <label className="sr-only" htmlFor="claim-email">
          Email address
        </label>
        <input
          id="claim-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-12 flex-1 basis-[14rem] rounded-control border border-line bg-surface px-4 text-small text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        />
        <Button type="submit" loading={busy}>
          <EnvelopeSimple size={18} aria-hidden="true" />
          Send magic link
        </Button>
        <button type="button" onClick={() => setPhase('skipped')} className="text-link self-center">
          Skip
        </button>
      </form>
      {error ? (
        <p role="status" className="mt-4 text-small text-error">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
