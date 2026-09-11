import type { Difficulty, Opponent, Site } from '@perfect-season/sport-engine-core';
import type { DeterministicRng } from '@perfect-season/sport-engine-core/utils';
import { ratingToElo, type SportSimulationConfig } from './config';
import { normal } from './guardrail';

export interface ScheduledGame {
  readonly opponent: Opponent;
  readonly site: Site;
}

export interface ScheduleRequest {
  readonly games: number;
  readonly difficulty: Difficulty;
  readonly opponents: readonly Opponent[];
  readonly config: SportSimulationConfig;
  readonly rng: DeterministicRng;
}

function clampRating(value: number): number {
  return Math.min(99, Math.max(0, value));
}

function shuffledSites(games: number, rng: DeterministicRng): readonly Site[] {
  const sites: Site[] = [
    ...Array.from({ length: Math.ceil(games / 2) }, () => 'home' as const),
    ...Array.from({ length: Math.floor(games / 2) }, () => 'away' as const),
  ];
  for (let index = sites.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.integer(0, index + 1);
    const current = sites[index];
    const swap = sites[swapIndex];
    if (current === undefined || swap === undefined) {
      throw new Error('Site selection failed');
    }
    sites[index] = swap;
    sites[swapIndex] = current;
  }
  return sites;
}

function chooseOpponents(request: ScheduleRequest): readonly Opponent[] {
  if (request.opponents.length === 0) {
    return Array.from({ length: request.games }, (_, index) => ({
      id: `synthetic-${index + 1}`,
      name: `Synthetic opponent ${index + 1}`,
      rating: ratingToElo(
        clampRating(
          normal(request.rng) * request.config.opponentDistribution.sdRating +
            request.config.opponentDistribution.meanRating,
        ),
        request.config.ratingScale,
      ),
      site: 'neutral',
      facts: { synthetic: true },
    }));
  }
  if (request.opponents.length < request.games) {
    return Array.from({ length: request.games }, () => {
      const index = request.rng.integer(0, request.opponents.length);
      const opponent = request.opponents[index];
      if (opponent === undefined) throw new Error('Opponent selection failed');
      return opponent;
    });
  }
  const available = [...request.opponents];
  const selected: Opponent[] = [];
  while (selected.length < request.games) {
    const index = request.rng.integer(0, available.length);
    const opponent = available.splice(index, 1)[0];
    if (opponent === undefined) throw new Error('Opponent selection failed');
    selected.push(opponent);
  }
  return selected;
}

export function generateSchedule(request: ScheduleRequest): readonly ScheduledGame[] {
  if (!Number.isSafeInteger(request.games) || request.games < 0) {
    throw new RangeError('Schedule games must be a non-negative integer');
  }
  const opponents = chooseOpponents(request);
  const sites = shuffledSites(request.games, request.rng);
  return opponents.map((opponent, index) => {
    const site = sites[index];
    if (site === undefined) throw new Error('Site assignment failed');
    const rating =
      opponent.rating +
      request.config.difficultyOffsets[request.difficulty] *
        request.config.ratingScale.eloPerRatingPoint;
    return {
      site,
      opponent: { ...opponent, rating, site },
    };
  });
}
