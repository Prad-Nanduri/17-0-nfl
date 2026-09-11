# Shared simulation

`@perfect-season/simulation` contains the sport-agnostic season simulation
building blocks used by sport engines. Each sport supplies a
`SportSimulationConfig` with possessions, scoring probabilities, rating/Elo
conversion, variance, overtime, and synthetic-opponent settings.

The game guardrail weights the roster at 80% and the injected opponent
variation at 20%. The winner is decided from the Elo win probability first;
scores are then sampled around that result drive by drive. Strength tilt adjusts
favored and underdog scoring probabilities while preserving a valid
distribution. Overtime follows the supplied tie and period limits.

The package boundary is enforced by ESLint and `src/boundary.test.ts`; shared
simulation cannot import either sport engine. Run `npm run verify:guardrail`
from this package to simulate two 1,000-season groups and print distribution
statistics for the 80/20 guardrail.
