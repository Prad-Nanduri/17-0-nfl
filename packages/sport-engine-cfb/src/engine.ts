import type {
  CompletedRoster,
  DraftPoolUnit,
  EligibilityResult,
  EarnedTrophy,
  ModeRuleset,
  OpponentContext,
  PlayerCandidate,
  PositionRating,
  RatingMode,
  RosterSlot,
  SchemePreset,
  SeasonResult,
  SimulationMode,
  SportEngine,
  SportMode,
  SpinFilters,
  SpinSeed,
  TrophyDefinition,
  TrophyEvalContext,
} from '@perfect-season/sport-engine-core';
import { loadCfbFixtureData } from './data';
import { describeConference } from './conferences';
import { cfbConfidenceTier } from './era';
import { validateSlotEligibility } from './eligibility';
import { getAvailableModes, getModeRuleset } from './modes';
import { toPositionGroup } from './positions';
import { CFB_SCHEME_PRESETS } from './schemes';
import { resolveSpinUnit } from './spin';
import { CFB_RATING_MODEL_VERSION } from './ratings/rate-season';
import { simulateCfbSeason } from './simulation/simulate-season';
import { evaluateCfbTrophies, getCfbTrophyDefinitions } from './trophies';
import {
  TEAM_LEVEL_RATING_BADGE,
  type CfbConference,
  type CfbProgramSeason,
  type CfbRating,
  type CfbRatingBadge,
  type CfbTeam,
} from './domain';

export interface CfbSportEngineOptions {
  readonly conferences: readonly CfbConference[];
  readonly teams: readonly CfbTeam[];
  readonly programSeasons: readonly CfbProgramSeason[];
  readonly ratings: readonly CfbRating[];
}

export interface CfbSpinUnitDescriptor {
  readonly title: string;
  readonly footnote: string | null;
}

function matchesPoolUnit(rating: CfbRating, poolUnit: DraftPoolUnit): boolean {
  return (
    poolUnit.sportId === 'cfb' &&
    String(rating.cfbdTeamId) === poolUnit.programId &&
    rating.season === poolUnit.season
  );
}

function selectRating(
  candidate: PlayerCandidate,
  mode: RatingMode,
  ratings: readonly CfbRating[],
): CfbRating | undefined {
  const poolUnit = candidate.poolUnit;
  if (poolUnit.sportId !== 'cfb') {
    throw new Error('CFB candidates must use a CFB pool unit');
  }
  const matching = ratings.filter((rating) => rating.cfbdPlayerId === candidate.playerId);
  if (mode === 'career_season') {
    return matching.find(
      (rating) => rating.ratingMode === 'career_season' && matchesPoolUnit(rating, poolUnit),
    );
  }
  return matching
    .filter((rating) =>
      candidate.seasons.some(
        (season) =>
          season.poolUnit.sportId === 'cfb' &&
          String(rating.cfbdTeamId) === season.poolUnit.programId &&
          rating.season === season.poolUnit.season,
      ),
    )
    .sort(
      (left, right) => right.overallRating - left.overallRating || right.season - left.season,
    )[0];
}

export class CfbSportEngine implements SportEngine {
  readonly sportId = 'cfb' as const;
  readonly displayName = 'College Football (FBS)';
  readonly rosterSlotCount = 24 as const;

  private readonly conferences: readonly CfbConference[];
  private readonly teams: readonly CfbTeam[];
  private readonly programSeasons: readonly CfbProgramSeason[];
  private readonly ratings: readonly CfbRating[];

  constructor({ conferences, teams, programSeasons, ratings }: CfbSportEngineOptions) {
    this.conferences = conferences;
    this.teams = teams;
    this.programSeasons = programSeasons;
    this.ratings = ratings;
  }

  resolveSpinUnit(seed: SpinSeed, filters: SpinFilters): Promise<DraftPoolUnit> {
    return Promise.resolve(resolveSpinUnit(seed, filters, this.programSeasons, this.teams));
  }

  // §2A.2 spin-card copy: "Program X (Conference Y · Season Z)" + footnote.
  describeSpinUnit(unit: DraftPoolUnit): CfbSpinUnitDescriptor {
    if (unit.sportId !== 'cfb') {
      throw new Error('describeSpinUnit requires a CFB pool unit');
    }
    const team = this.teams.find((item) => String(item.cfbdTeamId) === unit.programId);
    const school = team?.school ?? unit.programId;
    const currentSeason = this.programSeasons
      .filter((row) => String(row.cfbdTeamId) === unit.programId)
      .sort((left, right) => right.season - left.season)[0];
    const descriptor = describeConference(
      unit.conferenceId,
      currentSeason?.conferenceKey ?? null,
      this.conferences,
    );
    return {
      title: `${school} (${descriptor.label} · ${unit.season})`,
      footnote: descriptor.footnote,
    };
  }

  getSchemePresets(): SchemePreset[] {
    return CFB_SCHEME_PRESETS.map((preset) => ({
      ...preset,
      slots: [...preset.slots] as unknown as SchemePreset['slots'],
    }));
  }

  validateSlotEligibility(candidate: PlayerCandidate, slot: RosterSlot): EligibilityResult {
    return validateSlotEligibility(candidate, slot);
  }

  computeRating(candidate: PlayerCandidate, mode: RatingMode): PositionRating {
    const poolUnit = candidate.poolUnit;
    if (poolUnit.sportId !== 'cfb') {
      throw new Error('CFB candidates must use a CFB pool unit');
    }
    const fallbackGroup = toPositionGroup(candidate.primaryPosition);
    if (fallbackGroup === null) {
      throw new Error(`Unknown CFB position: ${candidate.primaryPosition}`);
    }
    const selected = selectRating(candidate, mode, this.ratings);
    const group = fallbackGroup;
    return {
      positionGroup: group,
      mode,
      overall: selected?.overallRating ?? 40,
      sourceSeason: selected?.season ?? poolUnit.season,
      confidenceTier: selected?.confidenceTier ?? cfbConfidenceTier(poolUnit.season),
      isTeamLevelProxy: selected?.isTeamLevelProxy ?? (group === 'OL' || group === 'DL'),
      modelVersion: selected?.modelVersion ?? CFB_RATING_MODEL_VERSION,
    };
  }

  // UI hook for the §2A.6 "Team-Level Rating" badge (PositionRating has no
  // badges field, so the badge rides on this engine-specific method).
  getRatingBadges(candidate: PlayerCandidate, mode: RatingMode): readonly CfbRatingBadge[] {
    const selected = selectRating(candidate, mode, this.ratings);
    if (selected !== undefined) return selected.badges;
    const group = toPositionGroup(candidate.primaryPosition);
    return group === 'OL' || group === 'DL' ? [TEAM_LEVEL_RATING_BADGE] : [];
  }

  async simulateSeason(
    roster: CompletedRoster,
    mode: SimulationMode,
    opponentContext: OpponentContext,
  ): Promise<SeasonResult> {
    return simulateCfbSeason(roster, mode, opponentContext);
  }

  getAvailableModes(): SportMode[] {
    return getAvailableModes();
  }

  getModeRuleset(modeId: string): ModeRuleset {
    return getModeRuleset(modeId);
  }

  getTrophyDefinitions(): TrophyDefinition[] {
    return getCfbTrophyDefinitions();
  }

  evaluateTrophies(result: SeasonResult, ctx: TrophyEvalContext): EarnedTrophy[] {
    return evaluateCfbTrophies(result, ctx);
  }
}

export function createCfbSportEngine(
  options: { readonly dataDirectory?: string } = {},
): CfbSportEngine {
  const data = loadCfbFixtureData(options.dataDirectory);
  return new CfbSportEngine(data);
}
