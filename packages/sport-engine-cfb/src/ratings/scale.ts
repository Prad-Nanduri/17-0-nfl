export function zScores(values: readonly (number | null)[]): (number | null)[] {
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (finite.length === 0) {
    return values.map(() => null);
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / finite.length;
  const standardDeviation = Math.sqrt(variance);
  return values.map((value) =>
    value === null || !Number.isFinite(value)
      ? null
      : standardDeviation === 0
        ? 0
        : (value - mean) / standardDeviation,
  );
}

export function percentileRank(values: readonly number[]): number[] {
  return values.map((value) => {
    const less = values.filter((candidate) => candidate < value).length;
    const ties = values.filter((candidate) => candidate === value).length;
    return (less + 0.5 * ties) / values.length;
  });
}

export function toRatingScale(percentile: number): number {
  if (!Number.isFinite(percentile)) {
    throw new RangeError('percentile must be finite');
  }
  return Math.max(40, Math.min(99, Math.round(40 + percentile * 59)));
}
