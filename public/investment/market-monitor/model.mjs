import { syntheticPrices } from './price-model.mjs';
import { RULES } from './rules.mjs';
import { assess, scoreValue } from './engine.mjs';
export const BAND = n => n === null ? '未知' : n <= 4 ? '0–4 低分區' : n <= 9 ? '5–9 中分區' : '10–16 高分區';
export const tone = n => n === null ? '' : n <= 4 ? 'p0' : n <= 9 ? 'p1' : 'p2';
export function rollingBreadthRatio(rows, size) {
  if (rows.length < size) return null;
  const window = rows.slice(-size);
  if (!window.every(row => Number.isFinite(row.breadth?.advancers) && Number.isFinite(row.breadth?.decliners))) return null;
  const down = window.reduce((sum, row) => sum + row.breadth.decliners, 0);
  return down > 0 ? Number((window.reduce((sum, row) => sum + row.breadth.advancers, 0) / down).toFixed(2)) : null;
}
export function demoRecords() {
  const priceMaps = Object.fromEntries(['SPY','QQQ'].map(symbol=>{const prices=syntheticPrices(symbol);return [symbol,new Map(prices.map((bar,i)=>[bar.date,{close:bar.close,changePercent:i?Number(((bar.close/prices[i-1].close-1)*100).toFixed(2)):null}]))];}));
  const rows = [], start = Date.UTC(2025, 4, 19);
  for (let day = 0; rows.length < 120; day++) {
    const date = new Date(start + day * 86400000); if ([0, 6].includes(date.getUTCDay())) continue;
    const i = rows.length, wave = (Math.sin(i / 12) + Math.sin(i / 6) * .35 + 1.35) / 2.7;
    const values = [13 + wave * 18, 4 - wave * 10, 82 - wave * 65, -4 - wave * 25, 85 - wave * 58, 6 - wave * 10, 9 + wave * 23, -wave * 15];
    const observations = Object.fromEntries(RULES.map((r, j) => [r.id, { value: Number(values[j].toFixed(r.decimals)) }]));
    const score = RULES.reduce((sum, r) => sum + scoreValue(r.id, observations[r.id].value).score, 0);
    rows.push({ mode: 'synthetic', sessionDate: date.toISOString().slice(0, 10), score, observations, prices: Object.fromEntries(['SPY','QQQ'].map(symbol=>[symbol,priceMaps[symbol].get(date.toISOString().slice(0,10))])),
      breadth: { advancers: Math.round(450 - wave * 360), decliners: Math.round(75 + wave * 650), ratio5: null, ratio10: null, above40: Number((80 - wave * 55).toFixed(1)), universeCount: 2500 }, sourceUrl: null });
    rows.at(-1).breadth.ratio5 = rollingBreadthRatio(rows, 5);
    rows.at(-1).breadth.ratio10 = rollingBreadthRatio(rows, 10);
  }
  return rows;
}
export function validateFeed(feed, now = new Date().toISOString()) {
  if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.records)) throw new Error('invalid_schema');
  if (feed.status === 'not_connected') return [];
  // Permission labels are an adapter contract, not evidence of legal clearance.
  if (feed.status !== 'ready' || feed.publicRedistributionApproved !== true || !feed.expectedSession) throw new Error('unapproved_or_unverified_source');
  const seen = new Set();
  const rows = feed.records.map(row => {
    if (seen.has(row.sessionDate)) throw new Error('duplicate_session'); seen.add(row.sessionDate);
    // Initial production adapter is deliberately fail-closed: until archival
    // provenance is audited, only the current final session can be displayed.
    const result = assess(row, { now, expectedSession: feed.expectedSession });
    if (result.score === null) throw new Error('unverified_or_stale_record');
    return { ...row, score: result.score, breadth: {}, prices: {} };
  });
  return rows.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
export function filterRecords(rows, { band = 'all', limit = 120, sort = 'desc' } = {}) {
  const latest = rows.slice(-Number(limit));
  const filtered = latest.filter(r => band === 'all' || (band === 'low' && r.score <= 4) || (band === 'mid' && r.score >= 5 && r.score <= 9) || (band === 'high' && r.score >= 10));
  return sort === 'asc' ? filtered : filtered.reverse();
}
export function makeCsv(rows, mode) {
  const columns = ['mode', 'date', 'score', 'SPY_close', 'SPY_changePct', 'QQQ_close', 'QQQ_changePct', ...RULES.map(r => r.id), 'advancers4pct', 'decliners4pct', 'ratio5', 'ratio10', 'above40pct', 'universeCount', 'sourceUrl'];
  const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return '\ufeff' + [columns, ...rows.map(r => [mode === 'demo' ? 'synthetic' : 'independent', r.sessionDate, r.score, r.prices?.SPY?.close, r.prices?.SPY?.changePercent, r.prices?.QQQ?.close, r.prices?.QQQ?.changePercent, ...RULES.map(rule => r.observations?.[rule.id]?.value), ...['advancers', 'decliners', 'ratio5', 'ratio10', 'above40', 'universeCount'].map(k => r.breadth?.[k]), mode === 'demo' ? 'synthetic:no-market-source' : r.sourceUrl])].map(row => row.map(cell).join(',')).join('\r\n');
}
