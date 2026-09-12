import { describe, expect, it } from 'vitest';
import type { CfbDraftPoolUnit } from './draft-store';
import { getSportAdapter } from './sport-adapter';

const unit = (programId: string): CfbDraftPoolUnit => ({
  sportId: 'cfb',
  programId,
  season: 2023,
  conferenceId: null,
});

describe('CFB draft adapter', () => {
  it('suppresses placeholder proxies for position groups with real candidates', () => {
    // Fixture program 4 has a real QB (p-qb1) rated for 2023.
    const candidates = getSportAdapter('cfb').buildCandidates(unit('4'));
    expect(candidates.some((candidate) => candidate.playerId === 'p-qb1')).toBe(true);
    expect(
      candidates.some(
        (candidate) =>
          candidate.playerId.startsWith('cfb-proxy-') && candidate.primaryPosition === 'QB',
      ),
    ).toBe(false);
  });

  it('keeps team-level proxies for uncovered line positions and marks other placeholders', () => {
    const candidates = getSportAdapter('cfb').buildCandidates(unit('4'));
    const ot = candidates.find(
      (candidate) =>
        candidate.playerId.startsWith('cfb-proxy-') && candidate.primaryPosition === 'OT',
    );
    expect(ot?.traits.isTeamLevelProxy).toBe(true);
    expect(ot?.traits.badges).toContain('Team-Level Rating');
    const rb = candidates.find(
      (candidate) =>
        candidate.playerId.startsWith('cfb-proxy-') && candidate.primaryPosition === 'RB',
    );
    expect(rb?.traits.synthetic).toBe(true);
    expect(rb?.traits.badges).toContain('Placeholder (no player data)');
    expect(rb?.fullName).not.toContain('(placeholder)');
  });

  it('re-spins without exclusions once the fbs spin pool is exhausted', async () => {
    const adapter = getSportAdapter('cfb');
    // The fixture pool holds 4 spin-eligible fbs program-seasons.
    const used = [unit('1'), unit('3'), unit('4'), unit('5')];
    const resolved = await adapter.resolveSpinUnit('seed:exhausted', used);
    expect(resolved.sportId).toBe('cfb');
  });

  it('honors exclusions while the pool still has unused units', async () => {
    const adapter = getSportAdapter('cfb');
    const used = [unit('1'), unit('3'), unit('5')];
    const resolved = await adapter.resolveSpinUnit('seed:partial', used);
    expect(resolved.sportId).toBe('cfb');
    if (resolved.sportId === 'cfb') {
      expect(resolved.programId).toBe('4');
    }
  });
});
