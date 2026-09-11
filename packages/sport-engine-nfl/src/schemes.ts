import type { RosterLineup, RosterSlot, SchemePreset } from '@perfect-season/sport-engine-core';

function slot(
  code: string,
  positionGroup: RosterSlot['positionGroup'],
  eligiblePositions: readonly string[],
): RosterSlot {
  return { code, positionGroup, eligiblePositions };
}

function lineup(...slots: RosterSlot[]): RosterLineup<RosterSlot> {
  if (slots.length !== 24) {
    throw new RangeError('NFL schemes must contain exactly 24 roster slots');
  }
  return slots as unknown as RosterLineup<RosterSlot>;
}

const offense = [
  slot('QB1', 'QB', ['QB']),
  slot('RB1', 'RB', ['RB', 'FB', 'HB']),
  slot('RB2', 'RB', ['RB', 'FB', 'HB']),
  slot('WR1', 'WR', ['WR']),
  slot('WR2', 'WR', ['WR']),
  slot('WR3', 'WR', ['WR']),
  slot('TE1', 'TE', ['TE']),
  slot('OT1', 'OL', ['T', 'OT', 'OL']),
  slot('OT2', 'OL', ['T', 'OT', 'OL']),
  slot('IOL1', 'OL', ['G', 'OG', 'C', 'OL']),
  slot('IOL2', 'OL', ['G', 'OG', 'C', 'OL']),
] as const;

const specialists = [slot('K1', 'K', ['K']), slot('P1', 'P', ['P'])] as const;

export const SCHEME_PRESETS: readonly SchemePreset[] = [
  {
    id: '4-3',
    name: 'Base 4-3',
    description: 'Balanced, classic defense with four defensive linemen.',
    slots: lineup(
      ...offense,
      slot('DE1', 'DL', ['DE', 'EDGE', 'DL']),
      slot('DE2', 'DL', ['DE', 'EDGE', 'DL']),
      slot('DT1', 'DL', ['DT', 'NT', 'DL']),
      slot('DT2', 'DL', ['DT', 'NT', 'DL']),
      slot('LB1', 'LB', ['LB', 'OLB', 'ILB', 'MLB']),
      slot('LB2', 'LB', ['LB', 'OLB', 'ILB', 'MLB']),
      slot('LB3', 'LB', ['LB', 'OLB', 'ILB', 'MLB']),
      slot('CB1', 'CB', ['CB', 'DB']),
      slot('CB2', 'CB', ['CB', 'DB']),
      slot('S1', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      slot('S2', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      ...specialists,
    ),
  },
  {
    id: '3-4',
    name: 'Base 3-4',
    description: 'Three-man front that favors elite pass-rushing outside linebackers.',
    slots: lineup(
      ...offense,
      slot('DE1', 'DL', ['DE', 'EDGE', 'DL', 'DT']),
      slot('DE2', 'DL', ['DE', 'EDGE', 'DL', 'DT']),
      slot('NT1', 'DL', ['NT', 'DT', 'DL']),
      slot('OLB1', 'LB', ['OLB', 'LB', 'EDGE']),
      slot('OLB2', 'LB', ['OLB', 'LB', 'EDGE']),
      slot('ILB1', 'LB', ['ILB', 'MLB', 'LB']),
      slot('ILB2', 'LB', ['ILB', 'MLB', 'LB']),
      slot('CB1', 'CB', ['CB', 'DB']),
      slot('CB2', 'CB', ['CB', 'DB']),
      slot('S1', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      slot('S2', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      ...specialists,
    ),
  },
  {
    id: 'nickel',
    name: 'Nickel',
    description: 'Pass-heavy sub-package with three cornerbacks.',
    slots: lineup(
      ...offense,
      slot('DE1', 'DL', ['DE', 'EDGE', 'DL']),
      slot('DE2', 'DL', ['DE', 'EDGE', 'DL']),
      slot('DT1', 'DL', ['DT', 'NT', 'DL']),
      slot('DT2', 'DL', ['DT', 'NT', 'DL']),
      slot('LB1', 'LB', ['LB', 'OLB', 'ILB', 'MLB']),
      slot('LB2', 'LB', ['LB', 'OLB', 'ILB', 'MLB']),
      slot('CB1', 'CB', ['CB', 'DB']),
      slot('CB2', 'CB', ['CB', 'DB']),
      slot('NCB', 'CB', ['CB', 'DB']),
      slot('S1', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      slot('S2', 'S', ['S', 'FS', 'SS', 'SAF', 'DB']),
      ...specialists,
    ),
  },
];
