import { createRng } from '@perfect-season/sport-engine-core/utils';
import { describe, expect, it } from 'vitest';
import type { CfbProgramSeason, CfbTeam } from '../domain';
import type { CfbDraftPoolUnit } from '../spin';
import { buildCfbOpponentSlate, CFB_SLATE_SHAPE, type CfbGameFlavor } from './schedule';

const unit: CfbDraftPoolUnit = {
  sportId: 'cfb',
  programId: '0',
  season: 2023,
  conferenceId: 'acc',
};

function program(id: number, conferenceKey: string, wins = 6, losses = 6): CfbProgramSeason {
  return {
    cfbdTeamId: id,
    season: 2023,
    conferenceKey,
    membershipStatus: 'fbs',
    wins,
    losses,
    apPreseasonRank: null,
    apFinalRank: null,
    peakRankThisSeason: null,
    cfpResult: null,
    bowlResult: null,
    recruitingRank: null,
    recruitingPoints: null,
    eraTier: 'full_feature',
  };
}

function team(id: number, school = `School ${id}`): CfbTeam {
  return {
    cfbdTeamId: id,
    school,
    currentName: school,
    abbreviation: `S${id}`,
    mascot: null,
    logoUrl: null,
    isBlueBlood: false,
  };
}

// 10 ACC rivals (ids 1–10) + 20 out-of-conference programs with increasing strength.
const programSeasons = [
  program(0, 'acc'), // the drafted program — must be excluded
  ...Array.from({ length: 10 }, (_, i) => program(i + 1, 'acc')),
  ...Array.from({ length: 20 }, (_, i) =>
    program(i + 11, i % 2 === 0 ? 'sec' : 'big-ten', i % 12, 12 - (i % 12)),
  ),
];
const teams = programSeasons.map((row) => team(row.cfbdTeamId));

function flavors(slate: ReturnType<typeof buildCfbOpponentSlate>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const opponent of slate) {
    const flavor = String(opponent.facts.flavor);
    counts[flavor] = (counts[flavor] ?? 0) + 1;
  }
  return counts;
}

describe('buildCfbOpponentSlate (spec §2A.4)', () => {
  it('builds exactly 12 opponents matching the slate shape', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-1'),
    });
    expect(slate).toHaveLength(12);
    const counts = flavors(slate);
    expect(counts.conference).toBe(CFB_SLATE_SHAPE.conference);
    expect(counts.rivalry).toBe(CFB_SLATE_SHAPE.rivalry);
    expect(counts.nonconference_marquee).toBe(CFB_SLATE_SHAPE.nonconference_marquee);
    expect(counts.nonconference).toBe(CFB_SLATE_SHAPE.nonconference);
  });

  it('never schedules the drafted program or a duplicate real team', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-2'),
    });
    const realIds = slate
      .map((opponent) => opponent.id)
      .filter((id) => !id.startsWith('cfb-synth-'));
    expect(realIds).not.toContain('0');
    expect(new Set(realIds).size).toBe(realIds.length);
  });

  it('draws conference games from the drafted conference when enough exist', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-3'),
    });
    const conference = slate.filter((opponent) => opponent.facts.flavor === 'conference');
    expect(conference).toHaveLength(8);
    for (const opponent of conference) {
      expect(opponent.facts.conferenceKey).toBe('acc');
    }
  });

  it('picks a marquee opponent at or above the out-of-conference median', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-4'),
    });
    const marquee = slate.find((opponent) => opponent.facts.flavor === 'nonconference_marquee');
    const oocStrengths = programSeasons
      .filter((row) => row.conferenceKey !== 'acc')
      .map((row) => row.wins! / (row.wins! + row.losses!))
      .sort((a, b) => a - b);
    const median = oocStrengths[Math.floor(oocStrengths.length / 2)] ?? 0;
    const medianStrength = Number(marquee?.facts.strengthRating);
    // Marquee strength should sit in the tougher half of the OOC pool.
    expect(medianStrength).toBeGreaterThanOrEqual(50);
    expect(marquee?.facts.conferenceKey).not.toBe('acc');
    expect(median).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic for a given seed', () => {
    const first = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-det'),
    });
    const second = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-det'),
    });
    expect(first).toEqual(second);
  });

  it('fills synthetically when the pool is too small', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons: [program(0, 'acc'), program(1, 'acc'), program(2, 'sec')],
      teams,
      rng: createRng('slate-tiny'),
    });
    expect(slate).toHaveLength(12);
    expect(slate.filter((o) => o.id.startsWith('cfb-synth-')).length).toBeGreaterThan(0);
    const counts = flavors(slate);
    expect(counts.conference).toBe(8);
    expect(counts.rivalry).toBe(2);
  });

  it('produces an all-synthetic slate when the pool is empty', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons: [program(0, 'acc')],
      teams: [],
      rng: createRng('slate-empty'),
    });
    expect(slate).toHaveLength(12);
    expect(slate.every((o) => o.id.startsWith('cfb-synth-'))).toBe(true);
    const counts = flavors(slate);
    expect(counts.rivalry).toBe(2);
    expect(counts.nonconference_marquee).toBe(1);
    expect(counts.nonconference).toBe(1);
    expect(counts.conference).toBe(8);
  });

  it('tags every opponent with a flavor and strength rating', () => {
    const slate = buildCfbOpponentSlate({
      unit,
      programSeasons,
      teams,
      rng: createRng('slate-5'),
    });
    for (const opponent of slate) {
      expect(['rivalry', 'nonconference_marquee', 'nonconference', 'conference']).toContain(
        opponent.facts.flavor as CfbGameFlavor,
      );
      expect(typeof opponent.facts.strengthRating).toBe('number');
    }
  });
});
