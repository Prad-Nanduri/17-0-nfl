'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trophy } from '@phosphor-icons/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { useToast } from '../ui/toast';
import type { CSSProperties } from 'react';
import type { CfbLabeledResult } from '../../lib/cfb-game-labels';
import { cfbOpponentStrength } from '../../lib/cfb-game-labels';
import type { ClientDraft } from './types';

function recordLabel(record: { wins: number; losses: number; ties: number }) {
  return `${record.wins}-${record.losses}-${record.ties}`;
}

export function CfbSeasonResults({
  draft,
  result,
}: {
  draft: ClientDraft;
  result: CfbLabeledResult;
}) {
  const notify = useToast();
  const imageUrl = `/api/cfb/drafts/${draft.id}/og`;
  const undefeated =
    result.season.record.wins === 12 &&
    result.season.record.losses === 0 &&
    result.season.record.ties === 0;
  async function copyImageLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${imageUrl}`);
      notify({ title: 'Image link copied', tone: 'success' });
    } catch {
      notify({ title: 'Could not copy image link', tone: 'error' });
    }
  }
  return (
    <main
      id="main"
      className="page-container pb-section pt-8"
      data-sport="cfb"
      style={
        (draft.theme
          ? {
              '--program-primary': draft.theme.primary,
              '--program-secondary': draft.theme.secondary,
            }
          : undefined) as CSSProperties | undefined
      }
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow border-b-2 border-[var(--program-primary)] text-sport">
            CFB Core Draft · Season results
          </p>
          <h1 className="display-heading mt-2 text-heading">Your program season</h1>
        </div>
        <Link href="/play/cfb" className="text-link">
          Start another draft
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card elevation="raised" className="p-6 lg:col-span-2">
          <p className="eyebrow text-sport">Quick Season · 12 games</p>
          <p className="display-heading mt-2 text-scoreboard text-heading">
            {recordLabel(result.season.record)}
          </p>
          <p className="mt-2 text-large font-semibold text-ink">
            {undefeated ? 'Undefeated & Untied' : 'Season complete'}
          </p>
          <p className="mt-3 text-small text-muted">
            Points for/against:{' '}
            <span className="font-bold text-ink">
              {result.season.pointsFor} / {result.season.pointsAgainst}
            </span>
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Trophy size={22} className="text-sport" aria-hidden="true" />
            <h2 className="text-large font-bold text-heading">Trophies</h2>
          </div>
          {result.trophies.length === 0 ? (
            <p className="mt-5 text-small text-muted">No trophies this season</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {result.trophies.map((trophy) => (
                <li
                  key={trophy.code}
                  data-testid={`trophy-${trophy.code}`}
                  className="rounded-control border border-line bg-subtle p-3 font-bold"
                >
                  {trophy.code.replaceAll('_', ' ')}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <p className="eyebrow text-sport">Season MVP</p>
          <div className="mt-4">
            <h2 className="text-title font-bold text-heading">{result.mvp.fullName}</h2>
            <p className="text-small text-muted">
              {result.mvp.primaryPosition} · {result.mvp.rating}
            </p>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-large font-bold text-heading">Season path</h2>
          <dl className="mt-4 space-y-2 text-small">
            <div className="flex justify-between border-b border-line py-2">
              <dt>Conference championship</dt>
              <dd className="font-semibold">N/A (Quick Season)</dd>
            </div>
            <div className="flex justify-between border-b border-line py-2">
              <dt>CFP / bowl</dt>
              <dd className="font-semibold">N/A (Quick Season)</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt>Ranking movement</dt>
              <dd className="font-semibold">N/A (ranking system not built yet)</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-large font-bold text-heading">12-game log</h2>
          <div className="mt-4 space-y-2">
            {result.season.stages
              .flatMap((stage) => stage.games)
              .map((game, index) => (
                <div
                  key={`${game.opponentId}-${index}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-control border border-line px-3 py-2 text-caption"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{game.opponentName}</span>
                    {cfbOpponentStrength(game) !== null ? (
                      <span className="text-micro text-muted">
                        opp. strength {cfbOpponentStrength(game)}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    {game.pointsFor}-{game.pointsAgainst}
                  </span>
                  <span
                    className={
                      game.outcome === 'win' ? 'font-bold text-success' : 'font-bold text-error'
                    }
                  >
                    {game.outcome.toUpperCase()}
                  </span>
                </div>
              ))}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-large font-bold text-heading">Share your season</h2>
          <Image
            src={imageUrl}
            alt={`CFB season result ${recordLabel(result.season.record)}`}
            width={600}
            height={315}
            unoptimized
            className="mt-4 h-auto w-full rounded-panel border border-line"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => void copyImageLink()}>
              Copy image link
            </Button>
            <Link href="/play/cfb" className="text-link self-center">
              Start another draft
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
