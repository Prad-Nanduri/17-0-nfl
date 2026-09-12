'use client';

import { useState } from 'react';
import type {
  DraftOrder,
  Difficulty,
  RatingMode,
  SchemeId,
} from '@perfect-season/sport-engine-core';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dropdown } from '../ui/dropdown';
import type { ClientDraft } from './types';

export const DIFFICULTY_COPY = {
  easy: '1 reroll',
  normal: 'No rerolls',
  hard: 'No rerolls · ratings hidden',
} as const satisfies Record<Difficulty, string>;

const orderOptions: readonly {
  value: DraftOrder;
  label: string;
  description: string;
}[] = [
  {
    value: 'squad_first',
    label: 'Squad-First',
    description: 'Choose any open slot after each reveal.',
  },
  {
    value: 'position_first',
    label: 'Position-First',
    description: 'The next reveal decides your open slot.',
  },
];
const difficultyOptions: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
];
const ratingOptions: readonly { value: RatingMode; label: string }[] = [
  { value: 'career_season', label: 'Career-Season' },
  { value: 'prime', label: 'Prime' },
];
const schemeOptions = [
  { value: '4-3', label: 'Base 4-3' },
  { value: '3-4', label: 'Base 3-4' },
  { value: 'nickel', label: 'Nickel' },
] as const;

function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  descriptions,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  descriptions?: Readonly<Record<T, string>>;
}) {
  return (
    <fieldset>
      <legend className="text-small font-bold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sport has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface cursor-pointer rounded-control border p-3 transition-colors ${
              value === option.value
                ? 'border-sport bg-sport/10'
                : 'border-line bg-surface hover:border-sport/60'
            }`}
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-small font-bold">{option.label}</span>
            {descriptions?.[option.value] ? (
              <span className="mt-1 block text-caption text-muted">
                {descriptions[option.value]}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DraftSetup({ onStarted }: { onStarted: (draft: ClientDraft) => void }) {
  const [draftOrder, setDraftOrder] = useState<DraftOrder>('squad_first');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [ratingMode, setRatingMode] = useState<RatingMode>('career_season');
  const [schemeId, setSchemeId] = useState<SchemeId>('4-3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDraft() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/nfl/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftOrder, difficulty, ratingMode, schemeId }),
      });
      const payload = (await response.json()) as { draft?: ClientDraft; error?: string };
      if (!response.ok || payload.draft === undefined)
        throw new Error(payload.error ?? 'Could not start draft');
      onStarted(payload.draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start draft');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card elevation="raised" className="mx-auto max-w-3xl p-5 md:p-8">
      <p className="eyebrow text-sport">NFL / Core draft</p>
      <h1 className="display-heading mt-3 text-heading">Set the rules.</h1>
      <p className="mt-3 max-w-copy text-small text-muted">
        Build a 24-player roster from every available franchise season.
      </p>
      <div className="mt-8 grid gap-7">
        <RadioGroup
          label="Draft order"
          value={draftOrder}
          options={orderOptions}
          onChange={setDraftOrder}
          descriptions={{
            squad_first: 'Choose any open slot after each reveal.',
            position_first: 'The next reveal decides your open slot.',
          }}
        />
        <RadioGroup
          label="Difficulty"
          value={difficulty}
          options={difficultyOptions}
          onChange={setDifficulty}
          descriptions={DIFFICULTY_COPY}
        />
        <RadioGroup
          label="Rating mode"
          value={ratingMode}
          options={ratingOptions}
          onChange={setRatingMode}
        />
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <div>
            <p className="text-small font-bold">Scheme</p>
            <p className="mt-1 text-caption text-muted">Your 24 slots follow this alignment.</p>
          </div>
          <Dropdown
            label="Scheme"
            value={schemeId}
            options={schemeOptions}
            onValueChange={(value) => setSchemeId(value as SchemeId)}
          />
        </div>
        {error ? (
          <p className="text-small text-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button onClick={startDraft} loading={loading} className="w-full sm:w-auto">
          Start draft
        </Button>
      </div>
    </Card>
  );
}
