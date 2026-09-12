'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react';
import { SPORTS } from '../../lib/sport';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useSession } from './session-provider';

type Status = 'linked' | 'invalid' | 'disabled' | 'noguest' | null;

const toneClass = { success: 'text-success', error: 'text-error', info: 'text-info' } as const;

const statusCopy: Record<
  Exclude<Status, null>,
  { tone: 'success' | 'error' | 'info'; text: string }
> = {
  linked: { tone: 'success', text: 'Your drafts now follow this email.' },
  invalid: { tone: 'error', text: 'That link has expired or was already used. Request a new one.' },
  disabled: { tone: 'info', text: 'Accounts are not enabled on this deployment yet.' },
  noguest: { tone: 'error', text: 'Open the link in the same browser you drafted in.' },
};

export function AccountPanel({ status }: { status: Status }) {
  const { user, sport, loaded, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'success' | 'error' | 'info';
    text: string;
  } | null>(status ? statusCopy[status] : null);

  useEffect(() => {
    if (status === 'linked') void refresh();
  }, [status, refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { sent?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Could not send the link');
      setMessage({ tone: 'success', text: `Check ${email} for your sign-in link.` });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not send the link',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loaded && user?.email) {
    return (
      <Card elevation="raised" className="max-w-copy p-6">
        <Badge tone="success">
          <CheckCircle size={14} aria-hidden="true" />
          Account linked
        </Badge>
        <h2 className="display-heading mt-4 text-title">{user.email}</h2>
        <p className="mt-2 text-small text-muted">
          Default sport: {SPORTS[user.defaultSport ?? sport].longLabel}. It is pre-selected every
          time you come back; the header toggle still switches per session.
        </p>
        {message ? (
          <p className={`mt-4 text-small ${toneClass[message.tone]}`}>{message.text}</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card elevation="raised" className="max-w-copy p-6">
      <Badge tone="neutral">Optional</Badge>
      <h2 className="display-heading mt-4 text-title">Keep your drafts.</h2>
      <p className="mt-2 text-small text-muted">
        You are playing as a guest, which is all the game needs. Add an email and we will send a
        one-tap sign-in link; your current sport ({SPORTS[sport].longLabel}) becomes your default.
      </p>
      <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="account-email">
          Email address
        </label>
        <input
          id="account-email"
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
      </form>
      {message ? (
        <p role="status" className={`mt-4 text-small ${toneClass[message.tone]}`}>
          {message.text}
        </p>
      ) : null}
    </Card>
  );
}
