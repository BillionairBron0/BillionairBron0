// Indicator registry: each indicator exposes { compute(engineState, config) }
import { macdIndicator } from './sets/macd.js';
import { supertrendIndicator } from './sets/supertrend.js';
import { rangeFilterIndicator } from './sets/rangeFilter.js';

const registry = new Map([
  ['MACD', macdIndicator],
  ['Supertrend', supertrendIndicator],
  ['Range Filter', rangeFilterIndicator]
]);

export function getIndicator(name) { return registry.get(name); }
export function listIndicators() { return Array.from(registry.keys()); }