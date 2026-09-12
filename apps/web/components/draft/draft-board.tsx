'use client';

import { memo, useCallback, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Check } from '@phosphor-icons/react';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import type { ClientDraft, DraftCandidate } from './types';
import { SCHEME_PRESETS } from '@perfect-season/sport-engine-core';

const SlotTile = memo(function SlotTile({
  code,
  label,
  candidate,
  eligible,
  onClock,
  onPlace,
}: {
  code: string;
  label: string;
  candidate: ClientDraft['picks'][string] | undefined;
  eligible: boolean;
  onClock: boolean;
  onPlace: (slotCode: string) => void;
}) {
  const droppable = useDroppable({ id: code, disabled: !eligible || candidate !== undefined });
  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      onClick={() => onPlace(code)}
      aria-disabled={!eligible && candidate === undefined}
      className={`min-h-24 min-w-0 rounded-control border p-3 text-left transition-colors ${
        candidate
          ? 'border-success bg-success/10'
          : eligible
            ? 'border-sport bg-sport/10 hover:bg-sport/20'
            : 'border-line bg-subtle/50 opacity-45'
      } ${droppable.isOver ? 'ring-2 ring-sport' : ''}`}
    >
      <span className="flex items-center justify-between gap-2 text-caption font-bold uppercase tracking-wide">
        {code}
        {onClock ? <Badge tone="sport">On the clock</Badge> : null}
      </span>
      <span className="mt-3 block text-small font-bold">
        {candidate ? (
          <span className="flex min-w-0 items-center gap-2">
            <Check size={15} className="shrink-0 text-success" aria-hidden="true" />
            <span className="truncate">{candidate.fullName}</span>
          </span>
        ) : (
          label
        )}
      </span>
      {candidate?.rating ? (
        <span className="mt-1 block text-caption text-muted">
          Rating {candidate.rating.overall}
        </span>
      ) : null}
    </button>
  );
});

export function DraftBoard({
  draft,
  candidates,
  targetSlotCode,
  selectedCandidateId,
  draggingId,
  onPlace,
}: {
  draft: ClientDraft;
  candidates: readonly DraftCandidate[];
  targetSlotCode: string | null;
  selectedCandidateId: string | null;
  draggingId: string | null;
  onPlace: (candidateId: string, slotCode: string) => Promise<void>;
}) {
  const scheme = SCHEME_PRESETS.find((item) => item.id === draft.schemeId);
  const activeCandidateId = draggingId ?? selectedCandidateId;
  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.playerId === activeCandidateId),
    [candidates, activeCandidateId],
  );
  const eligibleSlotCodes = useMemo(
    () =>
      new Set(
        activeCandidate?.eligibleSlots
          .filter(
            ({ slotCode }) =>
              draft.picks[slotCode] === undefined &&
              (targetSlotCode === null || targetSlotCode === slotCode),
          )
          .map(({ slotCode }) => slotCode),
      ),
    [activeCandidate, draft.picks, targetSlotCode],
  );
  const handlePlace = useCallback(
    (slotCode: string) => {
      if (selectedCandidateId && eligibleSlotCodes.has(slotCode))
        void onPlace(selectedCandidateId, slotCode);
    },
    [eligibleSlotCodes, onPlace, selectedCandidateId],
  );
  if (scheme === undefined) return null;

  const groups: readonly { label: string; start: number; end: number }[] = [
    { label: 'Offense', start: 0, end: 11 },
    { label: 'Defense', start: 11, end: scheme.slots.length - 2 },
    { label: 'Specialists', start: scheme.slots.length - 2, end: scheme.slots.length },
  ];
  return (
    <Card
      className="min-w-0 border-t-2 border-[var(--program-primary)] p-4 md:p-5"
      style={
        draft.sportId === 'cfb'
          ? { borderTopColor: 'var(--program-primary)', borderTopWidth: '2px' }
          : undefined
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-sport">Roster board</p>
          <h2 className="display-heading mt-2 text-title">{scheme.name}</h2>
        </div>
        <Badge>{Object.keys(draft.picks).length}/24 filled</Badge>
      </div>
      <div className="mt-5 grid gap-6">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`group-${group.label}`}>
            <h3 id={`group-${group.label}`} className="text-small font-bold">
              {group.label}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {scheme.slots.slice(group.start, group.end).map((slot) => {
                const picked = draft.picks[slot.code];
                const eligible = eligibleSlotCodes.has(slot.code);
                return (
                  <SlotTile
                    key={slot.code}
                    code={slot.code}
                    label={slot.eligiblePositions.join(' / ')}
                    candidate={picked}
                    eligible={activeCandidate === undefined || eligible}
                    onClock={targetSlotCode === slot.code}
                    onPlace={handlePlace}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
