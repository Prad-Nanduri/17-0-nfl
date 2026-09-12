'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { CandidateCard } from './candidate-card';
import type { ClientDraft, DraftCandidate } from './types';
import { SCHEME_PRESETS } from '@perfect-season/sport-engine-nfl/src/schemes';

function SlotTile({
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
  onPlace: () => void;
}) {
  const droppable = useDroppable({ id: code });
  return (
    <button
      ref={droppable.setNodeRef}
      type="button"
      onClick={onPlace}
      aria-disabled={!eligible && candidate === undefined}
      className={`min-h-24 rounded-control border p-3 text-left transition-colors ${
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
          <span className="flex items-center gap-2">
            <Check size={15} className="text-success" aria-hidden="true" />
            {candidate.fullName}
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
}

export function DraftBoard({
  draft,
  candidates,
  targetSlotCode,
  selectedCandidateId,
  onPlace,
}: {
  draft: ClientDraft;
  candidates: readonly DraftCandidate[];
  targetSlotCode: string | null;
  selectedCandidateId: string | null;
  onPlace: (candidateId: string, slotCode: string) => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const scheme = SCHEME_PRESETS.find((item) => item.id === draft.schemeId);
  if (scheme === undefined) return null;
  const dragging = candidates.find((candidate) => candidate.playerId === draggingId);

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    if (event.over) void onPlace(String(event.active.id), String(event.over.id));
  }

  const groups: readonly { label: string; start: number; end: number }[] = [
    { label: 'Offense', start: 0, end: 11 },
    { label: 'Defense', start: 11, end: scheme.slots.length - 2 },
    { label: 'Specialists', start: scheme.slots.length - 2, end: scheme.slots.length },
  ];
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Card className="p-4 md:p-5">
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
                  const candidate = candidates.find(
                    (item) => item.playerId === selectedCandidateId,
                  );
                  const eligible =
                    candidate?.eligibleSlots.some((item) => item.slotCode === slot.code) ?? false;
                  return (
                    <SlotTile
                      key={slot.code}
                      code={slot.code}
                      label={slot.eligiblePositions.join(' / ')}
                      candidate={picked}
                      eligible={draggingId === null || eligible}
                      onClock={targetSlotCode === slot.code}
                      onPlace={() => {
                        if (selectedCandidateId && eligible)
                          void onPlace(selectedCandidateId, slot.code);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>
      <DragOverlay>
        {dragging ? (
          <div className="rotate-2 opacity-90">
            <CandidateCard candidate={dragging} selected onSelect={() => undefined} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
