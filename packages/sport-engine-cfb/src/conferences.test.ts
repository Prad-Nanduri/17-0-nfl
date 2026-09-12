import { describe, expect, it } from 'vitest';
import type { CfbProgramSeason } from './domain';
import {
  KNOWN_DEFUNCT_CONFERENCES,
  buildConferenceDimension,
  conferenceKey,
  describeConference,
} from './conferences';

describe('conferenceKey', () => {
  it('slugifies names', () => {
    expect(conferenceKey('Big East')).toBe('big-east');
    expect(conferenceKey('Sun Belt')).toBe('sun-belt');
    expect(conferenceKey('AAC')).toBe('aac');
    expect(conferenceKey('  Mountain West ')).toBe('mountain-west');
    expect(conferenceKey('Big 12')).toBe('big-12');
  });
});

describe('buildConferenceDimension (spec §2A.2, §4.3)', () => {
  const current = [
    { name: 'ACC', shortName: 'ACC', abbreviation: 'ACC' },
    { name: 'Sun Belt', shortName: 'Sun Belt', abbreviation: 'SBC' },
  ];

  it('marks current conferences active and historical-only names inactive', () => {
    const dimension = buildConferenceDimension(current, new Set(['ACC', 'Big East', 'Mystery']));
    const byKey = new Map(dimension.map((entry) => [entry.conferenceKey, entry]));
    expect(byKey.get('acc')?.isActive).toBe(true);
    expect(byKey.get('big-east')?.isActive).toBe(false);
    expect(byKey.get('mystery')?.isActive).toBe(false);
  });

  it('uses the defunct seed for founding/dissolution years', () => {
    const dimension = buildConferenceDimension(current, new Set(['Big East']));
    const bigEast = dimension.find((entry) => entry.conferenceKey === 'big-east');
    expect(bigEast?.foundedYear).toBe(1991);
    expect(bigEast?.dissolvedYear).toBe(2013);
    expect(KNOWN_DEFUNCT_CONFERENCES.some((c) => c.conferenceKey === 'big-east')).toBe(true);
  });

  it('gives each season its own conferenceKey when a program realigns', () => {
    const row2012: CfbProgramSeason = {
      cfbdTeamId: 7,
      season: 2012,
      conferenceKey: conferenceKey('Big East'),
      membershipStatus: 'fbs',
      wins: null,
      losses: null,
      apPreseasonRank: null,
      apFinalRank: null,
      peakRankThisSeason: null,
      cfpResult: null,
      bowlResult: null,
      recruitingRank: null,
      recruitingPoints: null,
      eraTier: 'full_feature',
    };
    const row2013: CfbProgramSeason = {
      ...row2012,
      season: 2013,
      conferenceKey: conferenceKey('ACC'),
    };
    expect(row2012.conferenceKey).toBe('big-east');
    expect(row2013.conferenceKey).toBe('acc');
  });
});

describe('describeConference (spec §2A.2)', () => {
  const dimension = buildConferenceDimension(
    [{ name: 'ACC', shortName: 'ACC', abbreviation: 'ACC' }],
    new Set(['Big East']),
  );

  it('flags defunct conferences', () => {
    const descriptor = describeConference('big-east', 'acc', dimension);
    expect(descriptor.label).toBe('Big East');
    expect(descriptor.footnote).toBe('Conference no longer exists');
  });

  it('flags programs that moved to a different current conference', () => {
    const descriptor = describeConference('sun-belt', 'acc', [
      ...dimension,
      {
        conferenceKey: 'sun-belt',
        name: 'Sun Belt',
        shortName: 'Sun Belt',
        abbreviation: 'SBC',
        isActive: true,
        foundedYear: null,
        dissolvedYear: null,
      },
    ]);
    expect(descriptor.footnote).toBe('Program has since moved to ACC');
  });

  it('has no footnote when the program is still in that conference', () => {
    expect(describeConference('acc', 'acc', dimension).footnote).toBeNull();
  });
});
