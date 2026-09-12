import type {
  DraftPoolUnit,
  PlayerCandidate,
  PlayerSeason,
} from '@perfect-season/sport-engine-core';
import { getNflData } from './nfl-engine';

type NflUnit = Extract<DraftPoolUnit, { sportId: 'nfl' }>;

export function buildCandidates(unit: NflUnit, data = getNflData()): PlayerCandidate[] {
  const players = new Map(data.players.map((player) => [player.gsisId, player]));
  return data.playerSeasonStats
    .filter((row) => row.franchiseKey === unit.franchiseId && row.season === unit.season)
    .flatMap((row) => {
      const player = players.get(row.gsisId);
      if (player === undefined) return [];
      const season: PlayerSeason = {
        poolUnit: unit,
        position: row.position,
        confidenceTier: row.eraTier,
        stats: row.stats,
      };
      return [
        {
          playerId: player.gsisId,
          fullName: player.fullName,
          primaryPosition: player.primaryPosition,
          poolUnit: unit,
          seasons: [season],
          traits: {
            versatile: player.versatile,
            ngsPosition: player.ngsPosition,
            depthChartPosition: player.depthChartPosition,
            headshotUrl: player.headshotUrl,
          },
        },
      ];
    });
}

export function availableSeasons(data = getNflData()): {
  from: number;
  through: number;
} {
  const seasons = [...new Set(data.playerSeasonStats.map((row) => row.season))].sort(
    (left, right) => left - right,
  );
  const from = seasons[0];
  const through = seasons[seasons.length - 1];
  if (from === undefined || through === undefined) {
    throw new Error('No NFL player seasons are available');
  }
  return { from, through };
}
