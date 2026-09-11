import { describe, expect, it } from 'vitest';
import { toPositionGroup, toRatingPositionGroup } from './positions';

describe('toPositionGroup', () => {
  it.each([
    ['QB', 'QB'],
    ['RB', 'RB'],
    ['fb', 'RB'],
    ['WR', 'WR'],
    ['TE', 'TE'],
    ['OT', 'OL'],
    ['C', 'OL'],
    ['EDGE', 'DL'],
    ['MLB', 'LB'],
    ['DB', 'CB'],
    ['SS', 'S'],
    ['SAFETY', 'S'],
    ['SLOT_CB', 'CB'],
    ['INTERIOR_LINE', 'DL'],
    ['K', 'K'],
    ['P', 'P'],
  ])('maps %s to %s', (position, expected) => {
    expect(toPositionGroup(position)).toBe(expected);
  });

  it('returns null for unsupported positions', () => {
    expect(toPositionGroup('LS')).toBeNull();
    expect(toPositionGroup('')).toBeNull();
  });

  it.each([
    [{ position: 'LB', ngsPosition: null, depthChartPosition: 'OLB' }, 'DL'],
    [{ position: 'LB', ngsPosition: 'EDGE', depthChartPosition: 'OLB' }, 'DL'],
    [{ position: 'LB', ngsPosition: 'MLB', depthChartPosition: 'ILB' }, 'LB'],
    [{ position: 'LB', ngsPosition: 'MLB', depthChartPosition: 'OLB' }, 'LB'],
  ])('maps rating role %j to %s', (input, expected) => {
    expect(toRatingPositionGroup(input)).toBe(expected);
  });
});
