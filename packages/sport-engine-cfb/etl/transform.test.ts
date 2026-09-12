import { describe, expect, it } from 'vitest';
import { filterSpinPool } from '../src/membership';
import { loadFixtureRawSeason } from './fixtures';
import { transformSeason } from './transform';

const raw = loadFixtureRawSeason(2023);

const output = transformSeason(raw, 2023);
const program = (schoolId: number) =>
  output.programSeasons.find((row) => row.cfbdTeamId === schoolId);

describe('transformSeason — membership (spec §2A.1)', () => {
  it('marks Reclass State reclassifying in 2023 (FBS from 2024)', () => {
    expect(program(2)?.membershipStatus).toBe('reclassifying');
    expect(program(1)?.membershipStatus).toBe('fbs');
  });

  it('excludes the reclassifying program from the spin pool', () => {
    const pool = filterSpinPool(output.programSeasons);
    expect(pool.map((row) => row.cfbdTeamId)).not.toContain(2);
    expect(pool.map((row) => row.cfbdTeamId)).toEqual(expect.arrayContaining([1, 3, 4, 5]));
  });
});

describe('transformSeason — conferences (spec §2A.2, §4.3)', () => {
  it('marks the defunct Big East inactive with seeded years', () => {
    const bigEast = output.conferences.find((c) => c.conferenceKey === 'big-east');
    expect(bigEast?.isActive).toBe(false);
    expect(bigEast?.foundedYear).toBe(1991);
    expect(bigEast?.dissolvedYear).toBe(2013);
  });

  it('keeps current conferences active and tags each program-season', () => {
    expect(output.conferences.find((c) => c.conferenceKey === 'acc')?.isActive).toBe(true);
    expect(program(4)?.conferenceKey).toBe('acc');
    expect(program(3)?.conferenceKey).toBe('big-east');
  });
});

describe('transformSeason — polls (spec §4.3)', () => {
  it('routes AP and CFP polls into separate tables', () => {
    expect(output.apRankings.length).toBe(6);
    const cfpWeek2 = output.cfpRankings.filter((row) => row.week === 2);
    expect(cfpWeek2.map((row) => row.cfbdTeamId).sort()).toEqual([3, 4]);
  });

  it('maps postseason polls to week 99 with isFinal', () => {
    const finalAp = output.apRankings.filter((row) => row.isFinal);
    expect(finalAp.length).toBeGreaterThan(0);
    expect(finalAp.every((row) => row.week === 99)).toBe(true);
    expect(output.cfpRankings.filter((row) => row.isFinal)[0]?.week).toBe(99);
  });

  it('derives preseason/final/peak AP ranks', () => {
    expect(program(1)?.apPreseasonRank).toBe(20);
    expect(program(1)?.apFinalRank).toBe(12);
    expect(program(1)?.peakRankThisSeason).toBe(10);
    expect(program(4)?.apFinalRank).toBe(1);
    expect(program(2)?.apFinalRank).toBeNull();
    expect(program(2)?.peakRankThisSeason).toBeNull();
  });
});

describe('transformSeason — games and postseason (spec §2A.4)', () => {
  it('classifies game types', () => {
    const byId = new Map(output.games.map((game) => [game.cfbdGameId, game.gameType]));
    expect(byId.get(1001)).toBe('regular');
    expect(byId.get(1003)).toBe('conference_championship');
    expect(byId.get(2001)).toBe('bowl');
    expect(byId.get(2002)).toBe('cfp');
    expect(byId.get(2004)).toBe('national_championship');
  });

  it('derives cfp results', () => {
    expect(program(4)?.cfpResult).toBe('champion');
    expect(program(3)?.cfpResult).toBe('runner_up');
    expect(program(1)?.cfpResult).toBe('semifinal');
    expect(program(5)?.cfpResult).toBe('semifinal');
    // Reclassifying programs are excluded from postseason pools entirely.
    expect(program(2)?.cfpResult).toBeNull();
  });

  it('derives wins/losses and bowl results from completed games', () => {
    expect(program(4)).toMatchObject({ wins: 3, losses: 0, bowlResult: null });
    expect(program(1)).toMatchObject({ bowlResult: 'won' });
  });
});

describe('transformSeason — players and stats', () => {
  it('skips unknown positions and joins recruiting data', () => {
    const ids = output.players.map((player) => player.cfbdPlayerId);
    expect(ids).not.toContain('p-ath');
    expect(output.rowCounts['players.skippedUnknownPosition']).toBe(1);
    const lineman = output.players.find((player) => player.cfbdPlayerId === 'p-ol1');
    expect(lineman).toMatchObject({
      positionGroup: 'OL',
      recruitingClassYear: 2020,
      recruitStars: 5,
    });
  });

  it('pivots player stats into per-player rows and flags OL rows as proxies', () => {
    const qb = output.playerSeasonStats.find((row) => row.cfbdPlayerId === 'p-qb1');
    expect(qb?.stats['passing.YDS']).toBe(3500);
    expect(qb?.stats['passing.TD']).toBe(30);
    expect(qb?.games).toBe(13);
    expect(qb?.isTeamLevelProxy).toBe(false);
    const ol = output.playerSeasonStats.find((row) => row.cfbdPlayerId === 'p-ol1');
    // Roster player with no stat rows still gets a row, flagged as proxy.
    expect(ol?.isTeamLevelProxy).toBe(true);
    expect(ol?.gamesStarted).toBeNull();
    expect(ol?.allConference).toBe(false);
    expect(ol?.allAmerican).toBe(false);
  });
});

describe('transformSeason — team line stats (spec §2A.6 inputs)', () => {
  it('combines rushing sacks, pass attempts, and advanced stuff rates', () => {
    const stable = output.teamLineStats.find((row) => row.cfbdTeamId === 1);
    expect(stable).toMatchObject({
      offenseSacksAllowed: 18,
      offensePassAttempts: 380,
      offenseStuffRateAllowed: 0.14,
      defenseSacks: 30,
      defenseStuffRate: 0.22,
      defenseOpponentPassAttempts: null,
    });
  });
});
