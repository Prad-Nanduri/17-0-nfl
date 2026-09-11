import { describe, expect, it } from 'vitest';
import { cfbTeams, findTeam, groupTeams, nflTeams, requireTeam } from './index';

describe('team reference data', () => {
  it('covers every NFL franchise and FBS program', () => {
    expect(nflTeams).toHaveLength(32);
    expect(cfbTeams).toHaveLength(136);
  });

  it('has unique ids and slugs per league', () => {
    for (const teams of [nflTeams, cfbTeams]) {
      expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
      expect(new Set(teams.map((t) => t.slug)).size).toBe(teams.length);
    }
  });

  it('points every mark at a light and dark variant', () => {
    for (const team of [...nflTeams, ...cfbTeams]) {
      expect(team.logo).toMatch(/^https:\/\/a\.espncdn\.com\/i\/teamlogos\/.+\/500\/.+\.png$/);
      expect(team.logoDark).toMatch(
        /^https:\/\/a\.espncdn\.com\/i\/teamlogos\/.+\/500-dark\/.+\.png$/,
      );
    }
  });

  it('groups NFL teams into 8 divisions of 4 and FBS into 11 conference buckets', () => {
    const divisions = groupTeams(nflTeams);
    expect(divisions).toHaveLength(8);
    expect(divisions.every((d) => d.teams.length === 4)).toBe(true);
    expect(groupTeams(cfbTeams)).toHaveLength(11);
  });

  it('resolves slugs and fails loudly for unknown ones', () => {
    expect(findTeam('nfl', 'green-bay-packers')?.abbreviation).toBe('GB');
    expect(findTeam('cfb', 'not-a-team')).toBeUndefined();
    expect(() => requireTeam('nfl', 'not-a-team')).toThrow(/Unknown nfl team/);
  });
});
