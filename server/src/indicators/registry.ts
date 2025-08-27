import { macdIndicator } from './sets/macd';
import { supertrendIndicator } from './sets/supertrend';
import { rangeFilterIndicator } from './sets/rangeFilter';

export interface Indicator {
  name: string;
  compute(state: any, config?: any): any;
}

const registry = new Map<string, Indicator>([
  ['MACD', macdIndicator],
  ['Supertrend', supertrendIndicator],
  ['Range Filter', rangeFilterIndicator]
]);

export function getIndicator(name: string): Indicator | undefined { return registry.get(name); }
export function listIndicators(): string[] { return Array.from(registry.keys()); }
export function registerIndicator(ind: Indicator){ registry.set(ind.name, ind); }