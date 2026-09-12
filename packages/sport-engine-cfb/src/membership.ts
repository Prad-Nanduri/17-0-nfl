import type { CfbMembershipStatus, CfbProgramSeason } from './domain';

// NCAA reclassification takes a 2-year window before full FBS membership, so a
// program absent from the year-S FBS list but present in S+1 or S+2 was already
// mid-transition in S (spec §2A.1).
const RECLASSIFICATION_LOOKAHEAD_SEASONS = 2;

export function resolveMembershipStatus(
  school: string,
  season: number,
  fbsBySeason: ReadonlyMap<number, ReadonlySet<string>>,
): CfbMembershipStatus {
  const fbsThisSeason = fbsBySeason.get(season);
  if (fbsThisSeason === undefined) {
    throw new RangeError(
      `no FBS membership list for season ${season}; never substitute another year's list (spec §2A.1)`,
    );
  }
  if (fbsThisSeason.has(school)) {
    return 'fbs';
  }
  for (let offset = 1; offset <= RECLASSIFICATION_LOOKAHEAD_SEASONS; offset += 1) {
    if (fbsBySeason.get(season + offset)?.has(school)) {
      return 'reclassifying';
    }
  }
  return 'fcs';
}

export function isSpinPoolEligible(row: CfbProgramSeason): boolean {
  return row.membershipStatus === 'fbs';
}

export function isPostseasonEligible(row: CfbProgramSeason): boolean {
  return row.membershipStatus === 'fbs';
}

export function filterSpinPool(rows: readonly CfbProgramSeason[]): CfbProgramSeason[] {
  return rows.filter(isSpinPoolEligible);
}
