import type { CfbConference } from './domain';

export function conferenceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface DefunctConferenceSeed {
  readonly name: string;
  readonly shortName: string;
  readonly abbreviation: string | null;
  readonly foundedYear: number;
  readonly dissolvedYear: number;
}

// Football conferences that no longer exist; used to backfill dates when a
// defunct name shows up on a historical team-season row (spec §2A.2, §4.3).
const DEFUNCT_SEEDS: readonly DefunctConferenceSeed[] = [
  {
    name: 'Big East',
    shortName: 'Big East',
    abbreviation: 'BE',
    foundedYear: 1991,
    dissolvedYear: 2013,
  },
  {
    name: 'Western Athletic Conference',
    shortName: 'WAC',
    abbreviation: 'WAC',
    foundedYear: 1962,
    dissolvedYear: 2012,
  },
  {
    name: 'Southwest Conference',
    shortName: 'Southwest',
    abbreviation: 'SWC',
    foundedYear: 1914,
    dissolvedYear: 1996,
  },
  {
    name: 'Big Eight',
    shortName: 'Big Eight',
    abbreviation: 'Big 8',
    foundedYear: 1907,
    dissolvedYear: 1996,
  },
  {
    name: 'Big West',
    shortName: 'Big West',
    abbreviation: 'BW',
    foundedYear: 1969,
    dissolvedYear: 2000,
  },
];

export const KNOWN_DEFUNCT_CONFERENCES: readonly CfbConference[] = DEFUNCT_SEEDS.map((seed) => ({
  conferenceKey: conferenceKey(seed.name),
  name: seed.name,
  shortName: seed.shortName,
  abbreviation: seed.abbreviation,
  isActive: false,
  foundedYear: seed.foundedYear,
  dissolvedYear: seed.dissolvedYear,
}));

const DEFUNCT_BY_KEY = new Map(KNOWN_DEFUNCT_CONFERENCES.map((c) => [c.conferenceKey, c]));

export interface CurrentConferenceInput {
  readonly name: string;
  readonly shortName?: string | null;
  readonly abbreviation?: string | null;
}

// Builds the conference dimension: every currently-active conference plus any
// conference name observed on per-season /teams rows that no longer exists
// today (spec §2A.2, §4.3).
export function buildConferenceDimension(
  currentConferences: readonly CurrentConferenceInput[],
  seenConferenceNames: ReadonlySet<string>,
): CfbConference[] {
  const byKey = new Map<string, CfbConference>();
  for (const current of currentConferences) {
    const key = conferenceKey(current.name);
    byKey.set(key, {
      conferenceKey: key,
      name: current.name,
      shortName: current.shortName ?? null,
      abbreviation: current.abbreviation ?? null,
      isActive: true,
      foundedYear: null,
      dissolvedYear: null,
    });
  }
  for (const name of seenConferenceNames) {
    const key = conferenceKey(name);
    if (byKey.has(key)) continue;
    const seed = DEFUNCT_BY_KEY.get(key);
    byKey.set(
      key,
      seed ?? {
        conferenceKey: key,
        name,
        shortName: null,
        abbreviation: null,
        isActive: false,
        foundedYear: null,
        dissolvedYear: null,
      },
    );
  }
  return [...byKey.values()].sort((a, b) => a.conferenceKey.localeCompare(b.conferenceKey));
}

export interface ConferenceDescriptor {
  readonly label: string;
  readonly footnote: string | null;
}

// Spin-card copy for "Program X (Conference Y · Season Z)" (spec §2A.2).
export function describeConference(
  conferenceKeyForSeason: string | null,
  currentConferenceKeyOfProgram: string | null,
  dimension: readonly CfbConference[],
): ConferenceDescriptor {
  if (conferenceKeyForSeason === null) {
    return { label: 'Independent', footnote: null };
  }
  const conference = dimension.find((entry) => entry.conferenceKey === conferenceKeyForSeason);
  const label = conference?.shortName ?? conference?.name ?? conferenceKeyForSeason;
  let footnote: string | null = null;
  if (conference !== undefined && !conference.isActive) {
    footnote = 'Conference no longer exists';
  } else if (
    currentConferenceKeyOfProgram !== null &&
    currentConferenceKeyOfProgram !== conferenceKeyForSeason
  ) {
    const current = dimension.find(
      (entry) => entry.conferenceKey === currentConferenceKeyOfProgram,
    );
    footnote = `Program has since moved to ${current?.shortName ?? current?.name ?? currentConferenceKeyOfProgram}`;
  }
  return { label, footnote };
}
