import { describe, expect, it } from 'vitest';
import { isDarkColor, resolveProgramTheme, themeTextColor } from './cfb-theme';
import { cfbTeams } from './teams/cfb';

describe('resolveProgramTheme (CFB → static → fallback)', () => {
  it('prefers CFBD colors when valid', () => {
    const theme = resolveProgramTheme({
      color: '#9e1b32',
      alternateColor: '#828a8f',
      abbreviation: 'XXX',
    });
    expect(theme.source).toBe('cfbd');
    expect(theme.primary).toBe('#9E1B32');
    expect(theme.secondary).toBe('#828A8F');
  });

  it('falls back to a static cfbTeams entry by abbreviation', () => {
    const team = cfbTeams[0];
    const theme = resolveProgramTheme({
      color: null,
      alternateColor: null,
      abbreviation: team?.abbreviation ?? '',
    });
    expect(theme.source).toBe('static');
    expect(theme.primary).toBe(team?.color);
  });

  it('falls back to the neutral CFB accent for unknown programs', () => {
    const theme = resolveProgramTheme({
      color: 'not-a-hex',
      alternateColor: null,
      abbreviation: 'NOPE',
    });
    expect(theme.source).toBe('fallback');
    expect(theme.primary).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('luminance helpers', () => {
  it('treats navy as dark and white as light', () => {
    expect(isDarkColor('#0C2340')).toBe(true);
    expect(isDarkColor('#FFFFFF')).toBe(false);
    expect(themeTextColor('#0C2340')).toBe('#ffffff');
    expect(themeTextColor('#FFC72C')).toBe('#0b0f0d');
  });
});
