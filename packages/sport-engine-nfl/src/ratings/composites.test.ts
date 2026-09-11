import { describe, expect, it } from 'vitest';
import { COMPOSITES } from './composites';

describe('NFL rating composites', () => {
  it('has weights summing to one for every position group', () => {
    for (const components of Object.values(COMPOSITES)) {
      expect(components.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
    }
  });
});
