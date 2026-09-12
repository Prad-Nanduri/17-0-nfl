import type {
  CompletedRoster,
  EligibilityResult,
  ModeRuleset,
  OpponentContext,
  PlayerCandidate,
  PositionRating,
  RatingMode,
  SeasonResult,
  SimulationMode,
  SportEngine,
  SportMode,
  SpinFilters,
  SpinSeed,
  TrophyDefinition,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import type {
  DraftPoolUnit,
  EarnedTrophy,
  SchemePreset,
  RosterSlot,
} from '@perfect-season/sport-engine-core';
import { toRatingPositionGroup } from './positions';
import { loadNflFixtureData } from './data';
import { nflConfidenceTier } from './era';
import { validateSlotEligibility } from './eligibility';
import { getAvailableModes, getModeRuleset } from './modes';
import { SCHEME_PRESETS } from '@perfect-season/sport-engine-core';
import { resolveSpinUnit } from './spin';
import { RATING_MODEL_VERSION } from './ratings/rate-season';
import type { NflFranchise, NflFranchiseSeason, NflRating } from './domain';
import type { LogoResolver, LogoResult } from './media/espn-logos';
import { simulateNFLSeason } from './simulation/simulate-season';
import { evaluateNflTrophies, getNflTrophyDefinitions } from './trophies';

export interface NflSportEngineOptions {
  readonly franchises: readonly NflFranchise[];
  readonly franchiseSeasons: readonly NflFranchiseSeason[];
  readonly ratings: readonly NflRating[];
  readonly logoResolver?: LogoResolver;
}

function fallbackPositionGroup(candidate: PlayerCandidate) {
  return toRatingPositionGroup({
    position: candidate.primaryPosition,
    ngsPosition:
      typeof candidate.traits.ngsPosition === 'string' ? candidate.traits.ngsPosition : null,
    depthChartPosition:
      typeof candidate.traits.depthChartPosition === 'string'
        ? candidate.traits.depthChartPosition
        : null,
  });
}

function ratingForCandidate(
  candidate: PlayerCandidate,
  mode: RatingMode,
  ratings: readonly NflRating[],
): PositionRating {
  const fallbackSeason = candidate.poolUnit.season;
  const fallbackGroup = fallbackPositionGroup(candidate);
  if (fallbackGroup === null) {
    throw new Error(`Unknown NFL position: ${candidate.primaryPosition}`);
  }
  const poolUnit = candidate.poolUnit;
  if (poolUnit.sportId !== 'nfl') {
    throw new Error('NFL candidates must use an NFL pool unit');
  }
  const matching = ratings.filter((rating) => rating.gsisId === candidate.playerId);
  const selected =
    mode === 'career_season'
      ? matching.find(
          (rating) =>
            rating.ratingMode === 'career_season' &&
            rating.franchiseKey === poolUnit.franchiseId &&
            rating.season === fallbackSeason,
        )
      : matching
          .filter((rating) =>
            candidate.seasons.some(
              (season) =>
                season.poolUnit.sportId === 'nfl' &&
                season.poolUnit.franchiseId === rating.franchiseKey &&
                season.poolUnit.season === rating.season,
            ),
          )
          .sort((left, right) => right.overall - left.overall || right.season - left.season)[0];
  return {
    positionGroup: selected?.positionGroup ?? fallbackGroup,
    mode,
    overall: selected?.overall ?? 40,
    sourceSeason: selected?.season ?? fallbackSeason,
    confidenceTier: selected?.confidenceTier ?? nflConfidenceTier(fallbackSeason),
    isTeamLevelProxy: selected?.isTeamLevelProxy ?? false,
    modelVersion: selected?.modelVersion ?? RATING_MODEL_VERSION,
  };
}

export class NflSportEngine implements SportEngine {
  readonly sportId = 'nfl' as const;
  readonly displayName = 'NFL';
  readonly rosterSlotCount = 24 as const;

  private readonly franchises: readonly NflFranchise[];
  private readonly franchiseSeasons: readonly NflFranchiseSeason[];
  private readonly ratings: readonly NflRating[];
  private readonly logoResolver: LogoResolver | null;

  constructor({ franchises, franchiseSeasons, ratings, logoResolver }: NflSportEngineOptions) {
    this.franchises = franchises;
    this.franchiseSeasons = franchiseSeasons;
    this.ratings = ratings;
    this.logoResolver = logoResolver ?? null;
  }

  resolveSpinUnit(seed: SpinSeed, filters: SpinFilters): Promise<DraftPoolUnit> {
    return Promise.resolve(resolveSpinUnit(seed, filters, this.franchiseSeasons, this.franchises));
  }

  getSchemePresets(): SchemePreset[] {
    return SCHEME_PRESETS.map((preset) => ({
      ...preset,
      slots: [...preset.slots] as unknown as SchemePreset['slots'],
    }));
  }

  validateSlotEligibility(candidate: PlayerCandidate, slot: RosterSlot): EligibilityResult {
    return validateSlotEligibility(candidate, slot);
  }

  computeRating(candidate: PlayerCandidate, mode: RatingMode): PositionRating {
    return ratingForCandidate(candidate, mode, this.ratings);
  }

  async simulateSeason(
    roster: CompletedRoster,
    mode: SimulationMode,
    opponentContext: OpponentContext,
  ): Promise<SeasonResult> {
    return simulateNFLSeason(roster, mode, opponentContext);
  }

  getAvailableModes(): SportMode[] {
    return getAvailableModes();
  }

  getModeRuleset(modeId: string): ModeRuleset {
    return getModeRuleset(modeId);
  }

  getTrophyDefinitions(): TrophyDefinition[] {
    return getNflTrophyDefinitions();
  }

  evaluateTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[] {
    return evaluateNflTrophies(result, ctx);
  }

  async getFranchiseLogo(franchiseKey: string): Promise<LogoResult> {
    const franchise = this.franchises.find((item) => item.franchiseKey === franchiseKey);
    if (franchise?.logoUrl) return { url: franchise.logoUrl, source: 'espn' };
    if (this.logoResolver !== null) return this.logoResolver.getTeamLogo(franchiseKey);
    return { url: '/logos/nfl-placeholder.svg', source: 'placeholder' };
  }
}

export function createNflSportEngine(
  options: { readonly dataDirectory?: string } = {},
): NflSportEngine {
  const data = loadNflFixtureData(options.dataDirectory);
  return new NflSportEngine(data);
}
