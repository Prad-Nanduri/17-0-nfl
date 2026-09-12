'use client';

import { useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { DraftSetup } from './draft-setup';
import { CandidateCard } from './candidate-card';
import { DraftBoard } from './draft-board';
import { SpinWheel } from './spin-wheel';
import type { ClientDraft, DraftSpin } from './types';

async function responseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Request failed');
  return payload;
}

export function NflDraft() {
  const notify = useToast();
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [spin, setSpin] = useState<DraftSpin | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  if (draft === null) {
    return (
      <main id="main" className="page-container pb-section pt-8">
        <div className="mb-5">
          <Link href="/" className="text-link">
            <ArrowLeft size={16} aria-hidden="true" /> Back to the game
          </Link>
        </div>
        <DraftSetup onStarted={setDraft} />
      </main>
    );
  }
  const activeDraft = draft;

  async function requestSpin(reroll: boolean): Promise<DraftSpin> {
    setLoading(true);
    try {
      const suffix = reroll ? '&reroll=1' : '';
      const payload = await responseJson<{ spin: DraftSpin; draft: ClientDraft }>(
        await fetch(`/api/nfl/spin?draftId=${encodeURIComponent(activeDraft.id)}${suffix}`),
      );
      setDraft(payload.draft);
      setSpin(payload.spin);
      setSelectedCandidateId(null);
      return payload.spin;
    } finally {
      setLoading(false);
    }
  }

  async function placeCandidate(candidateId: string, slotCode: string) {
    if (spin === null) return;
    setLoading(true);
    try {
      const payload = await responseJson<{ draft: ClientDraft; warnings: string[] }>(
        await fetch(`/api/nfl/drafts/${activeDraft.id}/picks`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slotCode, playerId: candidateId, spinSeed: spin.spinSeed }),
        }),
      );
      setDraft(payload.draft);
      setSpin(null);
      setSelectedCandidateId(null);
      for (const warning of payload.warnings) {
        notify({ title: 'Versatile placement', description: warning, tone: 'info' });
      }
    } catch (error) {
      notify({
        title: 'Pick unavailable',
        description: error instanceof Error ? error.message : 'Could not place player',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  const complete = activeDraft.status === 'complete';
  return (
    <main id="main" className="page-container overflow-x-hidden pb-section pt-7" data-sport="nfl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to the game
        </Link>
        <Badge tone="sport">{complete ? 'Draft complete' : 'Draft in progress'}</Badge>
      </div>
      <div className="mt-7">
        {complete ? (
          <Card
            elevation="raised"
            className="mb-7 flex flex-wrap items-center justify-between gap-5 p-5"
          >
            <div>
              <p className="eyebrow text-sport">Roster complete</p>
              <h1 className="display-heading mt-2 text-heading">Your season starts now.</h1>
              <p className="mt-2 text-small text-muted">
                {activeDraft.schemeId} · {activeDraft.ratingMode.replace('_', '-')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-caption text-muted">Aggregate rating</p>
              <p className="font-display text-scoreboard font-semibold text-sport">
                {activeDraft.aggregateRating?.toFixed(1)}
              </p>
              <Button
                variant="secondary"
                size="small"
                onClick={() => {
                  setDraft(null);
                  setSpin(null);
                }}
              >
                Start another draft
              </Button>
            </div>
          </Card>
        ) : null}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <div className="grid gap-5">
            <SpinWheel
              draftId={activeDraft.id}
              spin={spin}
              rerollsRemaining={activeDraft.rerollsRemaining}
              loading={loading}
              onSpin={requestSpin}
              onError={(message) =>
                notify({ title: 'Spin unavailable', description: message, tone: 'error' })
              }
            />
            {spin ? (
              <section aria-labelledby="candidates-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="candidates-heading" className="text-small font-bold">
                    Choose your player
                  </h2>
                  <p className="text-caption text-muted">
                    Tap a player, then tap a highlighted slot.
                  </p>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-2">
                  {spin.candidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.playerId}
                      candidate={candidate}
                      selected={candidate.playerId === selectedCandidateId}
                      onSelect={() => setSelectedCandidateId(candidate.playerId)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <DraftBoard
            draft={activeDraft}
            candidates={spin?.candidates ?? []}
            targetSlotCode={spin?.targetSlotCode ?? null}
            selectedCandidateId={selectedCandidateId}
            onPlace={placeCandidate}
          />
        </div>
      </div>
    </main>
  );
}
