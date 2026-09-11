import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NflLegacyPlayerCareer, NflRating } from '../domain';
import { nflConfidenceTier } from '../era';

const dataDir = resolve(import.meta.dirname, '../../data/legacy');
const careers = JSON.parse(
  readFileSync(resolve(dataDir, 'legacy_player_careers.json'), 'utf8'),
) as NflLegacyPlayerCareer[];
const ratings = JSON.parse(
  readFileSync(resolve(dataDir, 'legacy_ratings.json'), 'utf8'),
) as NflRating[];
const names = new Map(careers.map((career) => [career.gsisId, career.fullName]));

function rating(name: string): NflRating {
  const row = ratings.find((item) => names.get(item.gsisId) === name);
  if (!row) throw new Error(`Missing legacy rating for ${name}`);
  return row;
}

describe('legacy rating fixtures', () => {
  it('keeps representative historical careers highly rated', () => {
    expect(rating('Barry Sanders').overall).toBeGreaterThanOrEqual(90);
    expect(rating('Barry Sanders').overall).toBeGreaterThan(rating('Curtis Adams').overall);
    expect(rating('Jerry Rice').overall).toBeGreaterThanOrEqual(95);
    expect(rating('John Elway').overall).toBeGreaterThanOrEqual(90);
  });

  it('marks legacy careers and keeps the NFL cutoff behavior explicit', () => {
    expect(ratings.every((item) => item.confidenceTier === 'legacy')).toBe(true);
    expect(nflConfidenceTier(1998)).toBe('legacy');
    expect(nflConfidenceTier(1999)).toBe('full_feature');
  });
});
