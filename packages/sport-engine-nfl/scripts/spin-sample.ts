import { createSeed } from '@perfect-season/sport-engine-core/utils';
import { createNflSportEngine } from '../src/engine';

const engine = createNflSportEngine();
const counts = new Map<string, number>();
for (let i = 0; i < 20; i += 1) {
  const unit = await engine.resolveSpinUnit(createSeed('spin-sample', i), {
    modeId: 'core',
    criteria: {},
  });
  counts.set(unit.franchiseId, (counts.get(unit.franchiseId) ?? 0) + 1);
}
console.log('Franchise counts:');
for (const [franchise, count] of [...counts].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`${franchise}: ${count}`);
}
console.log(`Distinct franchises: ${counts.size}`);
