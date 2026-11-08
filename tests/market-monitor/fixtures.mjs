import { RULES } from '../../public/investment/market-monitor/rules.mjs';
export function syntheticSnapshot(kind = 'middle') {
  const data = {
    schemaVersion: 1, mode: 'synthetic', sessionDate: '2000-01-03',
    description: '合成測試值，並非歷史或即時行情。', observations: {},
  };
  for (const rule of RULES) {
    const value = kind === 'low' ? (rule.direction === 'gte' ? rule.yellow - 1 : rule.yellow + 1) : kind === 'high' ? rule.red : rule.yellow;
    data.observations[rule.id] = { value, sessionDate: data.sessionDate, sourceUrl: null,
      quality: 'synthetic', methodology: 'unresolved', methodId: null, observedAt: null, retrievedAt: null };
  }
  if (kind === 'missing') delete data.observations.vix5d;
  return data;
}
export const EMPTY_SNAPSHOT = Object.freeze({ schemaVersion: 1, mode: 'unconnected', observations: {} });
