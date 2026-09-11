import type { SportId } from '@perfect-season/sport-engine-core';

/** Static presentation metadata for one franchise or program. No ratings or eligibility. */
export interface Team {
  id: string;
  slug: string;
  abbreviation: string;
  location: string;
  name: string;
  displayName: string;
  /** NFL division or FBS conference — used only for grouping in the UI. */
  group: string;
  color: string;
  alternateColor: string;
  logo: string;
  /** Variant prepared for dark surfaces (light strokes where the primary mark would vanish). */
  logoDark: string;
}

export interface League {
  sport: SportId;
  name: string;
  shortName: string;
  teamCountLabel: string;
  logo: string;
  logoDark: string;
}
