import {
  createSportEngineRegistry,
  type SportEngineRegistry,
} from '@perfect-season/sport-engine-core';
import { getCfbEngine } from './cfb-engine';
import { getNflEngine } from './nfl-engine';

export function getSportEngineRegistry(): SportEngineRegistry {
  return createSportEngineRegistry({ nfl: getNflEngine(), cfb: getCfbEngine() });
}
