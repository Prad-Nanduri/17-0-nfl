import { describe, expect, it } from 'vitest';
import { toPositionGroup } from './positions';

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
    ['K', 'K'],
    ['P', 'P'],
  ])('maps %s to %s', (position, expected) => {
    expect(toPositionGroup(position)).toBe(expected);
  });

  it('returns null for unsupported positions', () => {
    expect(toPositionGroup('LS')).toBeNull();
    expect(toPositionGroup('')).toBeNull();
  });
});
