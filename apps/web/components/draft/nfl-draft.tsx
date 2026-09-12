'use client';

import { useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [spin, setSpin] = useState<DraftSpin | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [fullGauntlet, setFullGauntlet] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

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

  function handleDragStart(event: DragStartEvent) {
    const candidateId = String(event.active.id);
    setDraggingId(candidateId);
    setSelectedCandidateId(candidateId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    if (event.over) void placeCandidate(String(event.active.id), String(event.over.id));
  }

  const draggingCandidate = spin?.candidates.find((candidate) => candidate.playerId === draggingId);
  const complete = activeDraft.status === 'complete';
  async function simulateSeason() {
    setLoading(true);
    try {
      const response = await fetch(`/api/nfl/drafts/${activeDraft.id}/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullGauntlet }),
      });
      await responseJson(response);
      router.push(`/play/nfl/results/${activeDraft.id}`);
    } catch (error) {
      notify({
        title: 'Simulation unavailable',
        description: error instanceof Error ? error.message : 'Could not simulate season',
        tone: 'error',
      });
      setLoading(false);
    }
  }
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
            <div className="flex flex-col items-end gap-3">
              <p className="text-caption text-muted">Aggregate rating</p>
              <p className="font-display text-scoreboard font-semibold text-sport">
                {activeDraft.aggregateRating?.toFixed(1)}
              </p>
              <label className="flex items-center gap-2 text-caption text-muted">
                <input
                  type="checkbox"
                  checked={fullGauntlet}
                  onChange={(event) => setFullGauntlet(event.target.checked)}
                  className="h-4 w-4 accent-action"
                />
                Full Gauntlet (playoffs)
              </label>
              <Button onClick={() => void simulateSeason()} loading={loading}>
                Simulate season
              </Button>
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
            <div className="grid min-w-0 grid-cols-1 gap-5">
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
                  <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-2">
                    {spin.candidates.map((candidate) => (
                      <CandidateCard
                        key={candidate.playerId}
                        candidate={candidate}
                        franchise={spin.franchise}
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
              draggingId={draggingId}
              onPlace={placeCandidate}
            />
          </div>
          <DragOverlay>
            {draggingCandidate ? (
              <div className="rotate-2 opacity-90">
                <CandidateCard
                  candidate={draggingCandidate}
                  franchise={spin?.franchise ?? null}
                  selected
                  onSelect={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}
