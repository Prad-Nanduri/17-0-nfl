import { describe, expect, it } from 'vitest';
import { SCHEME_PRESETS as CORE_SCHEME_PRESETS } from '@perfect-season/sport-engine-core';
import { NflSportEngine, SCHEME_PRESETS } from './index';

// Frozen snapshot of the scheme presets as they existed before the move into
// sport-engine-core (spec §2A.6) — guards against accidental data drift.
const EXPECTED_SCHEME_PRESETS = [
  {
    id: '4-3',
    name: 'Base 4-3',
    description: 'Balanced, classic defense with four defensive linemen.',
    slots: [
      {
        code: 'QB1',
        positionGroup: 'QB',
        eligiblePositions: ['QB'],
      },
      {
        code: 'RB1',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'RB2',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'WR1',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR2',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR3',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'TE1',
        positionGroup: 'TE',
        eligiblePositions: ['TE'],
      },
      {
        code: 'OT1',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'OT2',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'IOL1',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'IOL2',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'DE1',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL'],
      },
      {
        code: 'DE2',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL'],
      },
      {
        code: 'DT1',
        positionGroup: 'DL',
        eligiblePositions: ['DT', 'NT', 'DL'],
      },
      {
        code: 'DT2',
        positionGroup: 'DL',
        eligiblePositions: ['DT', 'NT', 'DL'],
      },
      {
        code: 'LB1',
        positionGroup: 'LB',
        eligiblePositions: ['LB', 'OLB', 'ILB', 'MLB'],
      },
      {
        code: 'LB2',
        positionGroup: 'LB',
        eligiblePositions: ['LB', 'OLB', 'ILB', 'MLB'],
      },
      {
        code: 'LB3',
        positionGroup: 'LB',
        eligiblePositions: ['LB', 'OLB', 'ILB', 'MLB'],
      },
      {
        code: 'CB1',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'CB2',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'S1',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'S2',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'K1',
        positionGroup: 'K',
        eligiblePositions: ['K'],
      },
      {
        code: 'P1',
        positionGroup: 'P',
        eligiblePositions: ['P'],
      },
    ],
  },
  {
    id: '3-4',
    name: 'Base 3-4',
    description: 'Three-man front that favors elite pass-rushing outside linebackers.',
    slots: [
      {
        code: 'QB1',
        positionGroup: 'QB',
        eligiblePositions: ['QB'],
      },
      {
        code: 'RB1',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'RB2',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'WR1',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR2',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR3',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'TE1',
        positionGroup: 'TE',
        eligiblePositions: ['TE'],
      },
      {
        code: 'OT1',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'OT2',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'IOL1',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'IOL2',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'DE1',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL', 'DT'],
      },
      {
        code: 'DE2',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL', 'DT'],
      },
      {
        code: 'NT1',
        positionGroup: 'DL',
        eligiblePositions: ['NT', 'DT', 'DL'],
      },
      {
        code: 'OLB1',
        positionGroup: 'LB',
        eligiblePositions: ['OLB', 'LB', 'EDGE'],
      },
      {
        code: 'OLB2',
        positionGroup: 'LB',
        eligiblePositions: ['OLB', 'LB', 'EDGE'],
      },
      {
        code: 'ILB1',
        positionGroup: 'LB',
        eligiblePositions: ['ILB', 'MLB', 'LB'],
      },
      {
        code: 'ILB2',
        positionGroup: 'LB',
        eligiblePositions: ['ILB', 'MLB', 'LB'],
      },
      {
        code: 'CB1',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'CB2',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'S1',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'S2',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'K1',
        positionGroup: 'K',
        eligiblePositions: ['K'],
      },
      {
        code: 'P1',
        positionGroup: 'P',
        eligiblePositions: ['P'],
      },
    ],
  },
  {
    id: 'nickel',
    name: 'Nickel',
    description: 'Pass-heavy sub-package with three cornerbacks.',
    slots: [
      {
        code: 'QB1',
        positionGroup: 'QB',
        eligiblePositions: ['QB'],
      },
      {
        code: 'RB1',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'RB2',
        positionGroup: 'RB',
        eligiblePositions: ['RB', 'FB', 'HB'],
      },
      {
        code: 'WR1',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR2',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'WR3',
        positionGroup: 'WR',
        eligiblePositions: ['WR'],
      },
      {
        code: 'TE1',
        positionGroup: 'TE',
        eligiblePositions: ['TE'],
      },
      {
        code: 'OT1',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'OT2',
        positionGroup: 'OL',
        eligiblePositions: ['T', 'OT', 'OL'],
      },
      {
        code: 'IOL1',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'IOL2',
        positionGroup: 'OL',
        eligiblePositions: ['G', 'OG', 'C', 'OL'],
      },
      {
        code: 'DE1',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL'],
      },
      {
        code: 'DE2',
        positionGroup: 'DL',
        eligiblePositions: ['DE', 'EDGE', 'DL'],
      },
      {
        code: 'DT1',
        positionGroup: 'DL',
        eligiblePositions: ['DT', 'NT', 'DL'],
      },
      {
        code: 'DT2',
        positionGroup: 'DL',
        eligiblePositions: ['DT', 'NT', 'DL'],
      },
      {
        code: 'LB1',
        positionGroup: 'LB',
        eligiblePositions: ['LB', 'OLB', 'ILB', 'MLB'],
      },
      {
        code: 'LB2',
        positionGroup: 'LB',
        eligiblePositions: ['LB', 'OLB', 'ILB', 'MLB'],
      },
      {
        code: 'CB1',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'CB2',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'NCB',
        positionGroup: 'CB',
        eligiblePositions: ['CB', 'DB'],
      },
      {
        code: 'S1',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'S2',
        positionGroup: 'S',
        eligiblePositions: ['S', 'FS', 'SS', 'SAF', 'DB'],
      },
      {
        code: 'K1',
        positionGroup: 'K',
        eligiblePositions: ['K'],
      },
      {
        code: 'P1',
        positionGroup: 'P',
        eligiblePositions: ['P'],
      },
    ],
  },
];

describe('NFL scheme presets after the core move (spec §2A.6)', () => {
  it('serves the pre-move preset data verbatim through the engine', () => {
    const engine = new NflSportEngine({ franchises: [], franchiseSeasons: [], ratings: [] });
    expect(engine.getSchemePresets()).toStrictEqual(EXPECTED_SCHEME_PRESETS);
  });

  it('re-exports the exact core SCHEME_PRESETS array', () => {
    expect(SCHEME_PRESETS).toBe(CORE_SCHEME_PRESETS);
  });
});
