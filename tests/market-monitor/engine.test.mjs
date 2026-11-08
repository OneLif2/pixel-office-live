import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RULES } from '../../public/investment/market-monitor/rules.mjs';
import { scoreValue, quantize, assess, describeBand } from '../../public/investment/market-monitor/engine.mjs';
import { syntheticSnapshot, EMPTY_SNAPSHOT } from './fixtures.mjs';
const context = { now: '2026-11-07T12:00:00Z', expectedSession: '2026-11-06' };
function validSnapshot() {
  const data = syntheticSnapshot(); data.mode = 'independent'; data.sessionDate = context.expectedSession;
  for (const item of Object.values(data.observations)) Object.assign(item, {
    sessionDate: data.sessionDate, quality: 'verified', methodology: 'documented', methodId: 'test-only-v1',
    sourceUrl: 'https://example.org/test-only', observedAt: '2026-11-06T21:15:00Z',
    availableAt: '2026-11-06T21:30:00Z', retrievedAt: '2026-11-06T22:00:00Z', dataState: 'final',
  });
  return data;
}
for (const rule of RULES) {
  test(`${rule.id}: inclusive thresholds, red precedence, values on both sides`, () => {
    const quantum = 10 ** -rule.decimals, direction = rule.direction === 'gte' ? 1 : -1;
    for (const [value, expected] of [
      [rule.yellow - direction * quantum, 0], [rule.yellow, 1],
      [rule.yellow + direction * quantum, 1], [rule.red - direction * quantum, 1],
      [rule.red, 2], [rule.red + direction * quantum, 2],
    ]) assert.equal(scoreValue(rule.id, String(quantize(value, rule.decimals))).score, expected, `${value}`);
  });
  test(`${rule.id}: rejects missing, NaN, infinity, coercion and range failures`, () => {
    for (const value of [null, undefined, '', ' ', true, false, NaN, Infinity, [], {}, 'abc', rule.min - 0.001, rule.max + 0.001]) {
      assert.equal(scoreValue(rule.id, value).score, null, String(value));
    }
  });
}
test('deterministic decimal rounding, with publisher tie convention explicitly unverified', () => {
  assert.equal(quantize('16.995', 2), 17);
  assert.equal(quantize('-2.995', 2), -3);
  assert.equal(quantize('1.005', 2), 1.01);
  assert.equal(quantize('-0.005', 2), -0.01);
  assert.equal(quantize('16.994', 2), 16.99);
  assert.equal(quantize('1e99', 2), null);
  assert.equal(quantize('1', -1), null);
});
test('clear/missing remains unknown and never silently zero', () => {
  const empty = assess(EMPTY_SNAPSHOT, context); assert.equal(empty.score, null); assert.equal(empty.arithmeticScore, null);
  const data = validSnapshot(); delete data.observations.vix5d;
  const result = assess(data, context); assert.equal(result.score, null); assert.equal(result.numericInputs, 7);
});
test('complete verified snapshot sums eight independent components, never proprietary lights', () => {
  const result = assess(validSnapshot(), context);
  assert.equal(result.score, 8); assert.equal(result.state, 'verified_snapshot'); assert.equal(result.isLive, false);
  assert.deepEqual(result.warningLights, { earlyDecline: 'unknown', bottom: 'unknown', rally: 'unknown' });
});
test('synthetic 0/8/16 all blocked from verified market score', () => {
  for (const [scenario, score] of [['low', 0], ['middle', 8], ['high', 16]]) {
    const result = assess(syntheticSnapshot(scenario), context);
    assert.equal(result.arithmeticScore, score); assert.equal(result.score, null); assert.equal(result.state, 'unknown');
  }
});
test('single published fixture reproduces 10, not an independent live score', async () => {
  const fixture = JSON.parse(await readFile(new URL('./publisher-example.json', import.meta.url), 'utf8'));
  const result = assess(fixture, context);
  assert.equal(result.arithmeticScore, fixture.publishedScore); assert.equal(result.score, null);
  assert.deepEqual(result.rows.map(r => r.score), [1, 2, 1, 2, 2, 0, 1, 1]);
});
const rejected = [
  ['quality', 'suspect', 'data_unverified'], ['quality', 'unverified', 'data_unverified'],
  ['methodology', 'unresolved', 'method_unresolved'], ['methodId', '', 'method_id_missing'],
  ['sourceUrl', 'javascript:alert(1)', 'source_missing'], ['sourceUrl', 'https://user:secret@example.org', 'source_missing'],
  ['sessionDate', '2026-11-05', 'observation_session_mismatch'],
  ['observedAt', null, 'observation_time_unknown'], ['observedAt', '2026-11-06', 'observation_time_unknown'],
  ['observedAt', '2026-02-30T21:00:00Z', 'observation_time_unknown'],
  ['observedAt', '2026-11-08T00:00:00Z', 'future_timestamp'],
  ['observedAt', '2026-11-05T21:15:00Z', 'timestamp_session_mismatch'],
  ['retrievedAt', '2026-11-06T20:00:00Z', 'retrieved_before_observed'],
  ['retrievedAt', null, 'retrieval_time_unknown'], ['retrievedAt', '2026-11-08T12:00:00Z', 'future_timestamp'],
  ['dataState', 'preliminary', 'not_final'], ['availableAt', null, 'availability_time_unknown'],
  ['availableAt', '2026-11-06T23:00:00Z', 'invalid_availability_order'],
  ['availableAt', '2026-11-06T20:00:00Z', 'invalid_availability_order'],
  ['availableAt', '2026-11-08T20:00:00Z', 'future_timestamp'],
];
for (const [field, value, reason] of rejected) test(`reject ${field}: ${reason} (${value})`, () => {
  const data = validSnapshot(); data.observations.vix5d[field] = value;
  const result = assess(data, context); assert.equal(result.score, null);
  assert(result.rows[0].reasons.includes(reason), JSON.stringify(result.rows[0].reasons));
});
test('stale fetch blocks even when data matches expected trading session', () => {
  const result = assess(validSnapshot(), { ...context, now: '2026-11-09T12:00:00Z' });
  assert.equal(result.score, null); assert(result.rows[0].reasons.includes('stale_fetch'));
});
test('calendar explicitly supports weekend Friday data, but next-session mismatch blocks', () => {
  assert.equal(assess(validSnapshot(), context).score, 8);
  assert.equal(assess(validSnapshot(), { ...context, expectedSession: '2026-11-09' }).score, null);
  assert.equal(assess(validSnapshot()).score, null);
});
test('invalid clocks, dates, freshness policy, schema and mixed provenance fail closed', () => {
  for (const options of [{ now: 'invalid' }, { expectedSession: null }, { expectedSession: '2026-02-30' }, { maxFetchAgeHours: Infinity }, { maxFetchAgeHours: -1 }, { maxFetchAgeHours: 999 }]) {
    assert.equal(assess(validSnapshot(), { ...context, ...options }).score, null);
  }
  for (const patch of [{ schemaVersion: 2 }, { mode: 'publisher' }, { sessionDate: '2026-02-30' }, { sessionDate: '2026-11-08' }]) {
    assert.equal(assess({ ...validSnapshot(), ...patch }, context).score, null);
  }
});
test('no input mutation and all 6,561 combinations stay within 0–16', () => {
  const data = validSnapshot(), before = JSON.stringify(data); assess(data, context); assert.equal(JSON.stringify(data), before);
  for (let mask = 0; mask < 3 ** 8; mask++) {
    let n = mask, total = 0;
    for (const rule of RULES) {
      const wanted = n % 3; n = Math.floor(n / 3); total += wanted;
      const value = wanted === 2 ? rule.red : wanted === 1 ? rule.yellow : rule.yellow + (rule.direction === 'gte' ? -1 : 1);
      data.observations[rule.id].value = value;
    }
    assert.equal(assess(data, context).score, total);
  }
});
test('neutral numeric bands never invent warning probabilities', () => {
  assert.equal(describeBand(0), '0–4 分區間'); assert.equal(describeBand(4), '0–4 分區間');
  assert.equal(describeBand(5), '5–9 分區間'); assert.equal(describeBand(9), '5–9 分區間');
  assert.equal(describeBand(10), '10–16 分區間'); assert.equal(describeBand(16), '10–16 分區間');
  for (const x of [null, -1, 17, 1.5, NaN]) assert.equal(describeBand(x), null);
});
test('non-canonical rollover timestamps fail closed', () => {
  const data = validSnapshot(); data.observations.vix5d.observedAt = '2026-11-06T24:00:00Z';
  assert.equal(assess(data, context).score, null);
});
