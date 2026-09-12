import type { SchemePreset } from '@perfect-season/sport-engine-core';
import { SCHEME_PRESETS as NFL_SCHEME_PRESETS } from '@perfect-season/sport-engine-nfl';

// "Spread Defense" is CFB copy for the Nickel shape only — slot ids, codes,
// and eligible positions are identical to the NFL presets (spec §2A.6).
export const CFB_SCHEME_PRESETS: readonly SchemePreset[] = NFL_SCHEME_PRESETS.map((preset) =>
  preset.id === 'nickel'
    ? {
        ...preset,
        name: 'Spread Defense',
        description:
          'Pass-heavy sub-package with three cornerbacks — CFB copy for the Nickel shape.',
      }
    : preset,
);
