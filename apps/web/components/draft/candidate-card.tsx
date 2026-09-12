'use client';

import { LockKey } from '@phosphor-icons/react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '../ui/badge';
import type { DraftCandidate } from './types';
import Image from 'next/image';

export function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: DraftCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const draggable = useDraggable({ id: candidate.playerId, data: { candidate } });
  const style = draggable.transform
    ? { transform: CSS.Translate.toString(draggable.transform) }
    : undefined;
  return (
    <button
      ref={draggable.setNodeRef}
      type="button"
      style={style}
      {...draggable.attributes}
      {...draggable.listeners}
      onClick={onSelect}
      className={`flex min-w-56 touch-none items-center gap-3 rounded-control border bg-surface p-3 text-left transition-colors ${
        selected ? 'border-sport bg-sport/10' : 'border-line hover:border-sport/60'
      }`}
      aria-label={`${candidate.fullName}, ${candidate.primaryPosition}`}
    >
      {candidate.headshotUrl ? (
        <Image
          src={candidate.headshotUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          unoptimized
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-subtle text-caption font-bold">
          {candidate.fullName.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-bold">{candidate.fullName}</span>
        <span className="block text-caption text-muted">{candidate.primaryPosition}</span>
      </span>
      {candidate.rating === null ? (
        <Badge tone="neutral">
          <LockKey size={13} aria-hidden="true" />
          Hidden
        </Badge>
      ) : (
        <Badge tone={candidate.rating >= 90 ? 'success' : 'neutral'}>{candidate.rating}</Badge>
      )}
    </button>
  );
}
