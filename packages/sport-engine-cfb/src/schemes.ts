import {
  SCHEME_PRESETS,
  type SchemeId,
  type SchemePreset,
} from '@perfect-season/sport-engine-core';

// CFB display copy for the shared preset shapes (spec §2A.6) — data is not forked.
export const CFB_SCHEME_DISPLAY_NAMES: Readonly<Partial<Record<SchemeId, string>>> = {
  nickel: 'Spread Defense',
};

export function cfbSchemeDisplayName(preset: SchemePreset): string {
  return CFB_SCHEME_DISPLAY_NAMES[preset.id] ?? preset.name;
}

export const CFB_SCHEME_PRESETS: readonly SchemePreset[] = SCHEME_PRESETS.map((preset) => ({
  ...preset,
  name: cfbSchemeDisplayName(preset),
}));
