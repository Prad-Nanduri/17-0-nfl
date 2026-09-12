import { cfbTeams } from './teams/cfb';

export interface ProgramTheme {
  readonly primary: string;
  readonly secondary: string;
  readonly source: 'cfbd' | 'static' | 'fallback';
}

const FALLBACK_PRIMARY = '#D6C282';
const FALLBACK_SECONDARY = '#655B31';

function validHex(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
}

/**
 * Resolve CFB program accents in this order: CFBD colors, static cfbTeams
 * metadata, then the existing neutral CFB accent token from globals.css.
 */
export function resolveProgramTheme(input: {
  readonly color?: string | null;
  readonly alternateColor?: string | null;
  readonly abbreviation: string;
}): ProgramTheme {
  if (validHex(input.color)) {
    return {
      primary: input.color.toUpperCase(),
      secondary: validHex(input.alternateColor)
        ? input.alternateColor.toUpperCase()
        : FALLBACK_SECONDARY,
      source: 'cfbd',
    };
  }
  const staticTeam = cfbTeams.find(
    (team) => team.abbreviation.toUpperCase() === input.abbreviation.toUpperCase(),
  );
  if (staticTeam !== undefined) {
    return { primary: staticTeam.color, secondary: staticTeam.alternateColor, source: 'static' };
  }
  return { primary: FALLBACK_PRIMARY, secondary: FALLBACK_SECONDARY, source: 'fallback' };
}

export function isDarkColor(hex: string): boolean {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const luminance =
    (0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)) / 255;
  return luminance < 0.55;
}

export function themeTextColor(primary: string): '#ffffff' | '#0b0f0d' {
  return isDarkColor(primary) ? '#ffffff' : '#0b0f0d';
}
