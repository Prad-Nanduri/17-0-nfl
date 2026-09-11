import type { PositionGroup } from '@perfect-season/sport-engine-core';

export interface CompositeComponent {
  readonly statKey: string;
  readonly weight: number;
  readonly invert: boolean;
}

const component = (statKey: string, weight: number, invert = false): CompositeComponent => ({
  statKey,
  weight,
  invert,
});

export const COMPOSITES: Readonly<Record<PositionGroup, readonly CompositeComponent[]>> = {
  QB: [
    component('anyPerAttempt', 0.4),
    component('tdRate', 0.2),
    component('intRate', 0.15, true),
    component('completionPct', 0.15),
    component('rushingEpa', 0.1),
  ],
  RB: [
    component('yardsPerCarry', 0.35),
    component('rushYardsShare', 0.25),
    component('receivingYards', 0.2),
    component('brokenTackleRate', 0.2),
  ],
  WR: [
    component('yardsPerRouteProxy', 0.3),
    component('targetShare', 0.25),
    component('receivingYards', 0.25),
    component('receivingTds', 0.2),
  ],
  TE: [
    component('yardsPerRouteProxy', 0.3),
    component('targetShare', 0.25),
    component('receivingYards', 0.25),
    component('receivingTds', 0.2),
  ],
  OL: [
    component('teamPressureRateAllowed', 0.5, true),
    component('teamYardsBeforeContactPerAtt', 0.3),
    component('penalties', 0.2, true),
  ],
  DL: [
    component('pressureRate', 0.35),
    component('sacks', 0.25),
    component('runStopProxy', 0.2),
    component('tacklesForLoss', 0.2),
  ],
  LB: [
    component('tackles', 0.3),
    component('runStopProxy', 0.25),
    component('coverageProxy', 0.25),
    component('tacklesForLoss', 0.2),
  ],
  CB: [
    component('coverageProxy', 0.35),
    component('interceptions', 0.25),
    component('passDefended', 0.2),
    component('tackles', 0.2),
  ],
  S: [
    component('coverageProxy', 0.35),
    component('interceptions', 0.25),
    component('passDefended', 0.2),
    component('tackles', 0.2),
  ],
  K: [
    component('accuracyByDistance', 0.5),
    component('kickoffTouchbackRate', 0.3),
    component('clutchFgPct', 0.2),
  ],
  P: [component('inside20Rate', 0.5), component('netAvg', 0.3), component('clutchNetAvg', 0.2)],
};
