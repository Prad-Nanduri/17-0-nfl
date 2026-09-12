import { describe, expect, it } from 'vitest';
import { cfbPositionGroup, normalizeCfbPosition, toPositionGroup } from './positions';

describe('toPositionGroup', () => {
  it('maps CFB positions to shared position groups', () => {
    expect(toPositionGroup('QB')).toBe('QB');
    expect(toPositionGroup('OT')).toBe('OL');
    expect(toPositionGroup('EDGE')).toBe('LB');
    expect(toPositionGroup('DB')).toBe('S');
    expect(toPositionGroup('MLB')).toBe('LB');
  });

  it('applies aliases', () => {
    expect(toPositionGroup('PK')).toBe('K');
    expect(toPositionGroup('HB')).toBe('RB');
    expect(toPositionGroup('SAF')).toBe('S');
  });

  it('returns null for unknown or empty positions', () => {
    expect(toPositionGroup('ATH')).toBeNull();
    expect(toPositionGroup('')).toBeNull();
    expect(toPositionGroup(null)).toBeNull();
    expect(toPositionGroup(undefined)).toBeNull();
  });

  it('cfbPositionGroup is the same function (ETL import name)', () => {
    expect(cfbPositionGroup('WR')).toBe('WR');
    expect(cfbPositionGroup(null)).toBeNull();
  });
});

describe('normalizeCfbPosition', () => {
  it('trims, uppercases, and applies aliases', () => {
    expect(normalizeCfbPosition(' pk ')).toBe('K');
    expect(normalizeCfbPosition('hb')).toBe('RB');
    expect(normalizeCfbPosition('sAf')).toBe('S');
    expect(normalizeCfbPosition('QB')).toBe('QB');
  });
});
