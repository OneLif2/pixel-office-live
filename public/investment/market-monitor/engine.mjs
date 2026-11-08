import { RULES, RULESET_VERSION } from './rules.mjs';

/** Deterministic decimal half-away-from-zero. This tie convention is ours, not a
 * claim about the publisher's raw-to-display rounding. Values already at the
 * published precision are the reproducibility contract. No coercion of blanks. */
export function quantize(value, places) {
  if (!Number.isInteger(places) || places < 0 || places > 6) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  const s = String(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!match || s.length > 40) return null;
  const fraction = match[3] ?? '';
  const power = 10n ** BigInt(places);
  let scaled = BigInt(match[2]) * power + BigInt(fraction.padEnd(places, '0').slice(0, places) || '0');
  if (fraction.length > places && fraction[places] >= '5') scaled += 1n;
  const result = Number(match[1] === '-' ? -scaled : scaled) / Number(power);
  return Number.isFinite(result) ? (Object.is(result, -0) ? 0 : result) : null;
}

export function scoreValue(id, value) {
  const rule = RULES.find(r => r.id === id);
  if (!rule) return { score: null, value: null, reason: 'unknown_indicator' };
  const number = quantize(value, rule.decimals);
  // Range validation precedes quantization so impossible raw values stay invalid.
  if (number === null || Number(value) < rule.min || Number(value) > rule.max) {
    return { score: null, value: null, reason: 'invalid_value' };
  }
  const crosses = threshold => rule.direction === 'gte' ? number >= threshold : number <= threshold;
  return { score: crosses(rule.red) ? 2 : crosses(rule.yellow) ? 1 : 0, value: number, reason: null };
}

function validSession(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date;
}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  if (!validSession(value.slice(0, 10))) return NaN;
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return NaN;
  return Date.parse(value);
}
function safeSource(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export function describeBand(score) {
  if (!Number.isInteger(score) || score < 0 || score > 16) return null;
  return score <= 4 ? '0–4 分區間' : score <= 9 ? '5–9 分區間' : '10–16 分區間';
}

/** expectedSession must come from a validated exchange calendar, including its
 * after-close publication delay; never infer it as "today" or last weekday.
 * No raw-data fetching, trading, publication, or proprietary signal calculation. */
export function assess(snapshot, { now = new Date().toISOString(), expectedSession = null, maxFetchAgeHours = 48 } = {}) {
  const input = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const nowMs = instant(now);
  const problems = [];
  if (!Number.isFinite(nowMs)) problems.push('invalid_clock');
  if (!validSession(expectedSession)) problems.push('expected_session_unknown');
  if (!(typeof maxFetchAgeHours === 'number' && Number.isFinite(maxFetchAgeHours) && maxFetchAgeHours > 0 && maxFetchAgeHours <= 96)) problems.push('invalid_freshness_policy');
  if (input.schemaVersion !== 1) problems.push('invalid_schema');
  if (!validSession(input.sessionDate)) problems.push('invalid_session');
  if (input.sessionDate !== expectedSession) problems.push('session_mismatch');
  if (Number.isFinite(nowMs) && validSession(input.sessionDate) && Date.parse(input.sessionDate + 'T00:00:00Z') > nowMs) problems.push('future_session');
  if (input.mode !== 'independent') problems.push('not_independent_data');
  const rows = RULES.map(rule => {
    const observation = input.observations?.[rule.id];
    const scored = scoreValue(rule.id, observation?.value);
    const reasons = [];
    if (scored.reason) reasons.push(scored.reason);
    if (!observation || observation.sessionDate !== input.sessionDate) reasons.push('observation_session_mismatch');
    if (!safeSource(observation?.sourceUrl)) reasons.push('source_missing');
    if (observation?.quality !== 'verified') reasons.push('data_unverified');
    if (observation?.methodology !== 'documented') reasons.push('method_unresolved');
    if (observation?.dataState !== 'final') reasons.push('not_final');
    if (typeof observation?.methodId !== 'string' || !observation.methodId.trim()) reasons.push('method_id_missing');
    const observed = instant(observation?.observedAt);
    const retrieved = instant(observation?.retrievedAt);
    const available = instant(observation?.availableAt);
    if (!Number.isFinite(observed)) reasons.push('observation_time_unknown');
    if (!Number.isFinite(retrieved)) reasons.push('retrieval_time_unknown');
    if (!Number.isFinite(available)) reasons.push('availability_time_unknown');
    if (observed > nowMs || retrieved > nowMs || available > nowMs) reasons.push('future_timestamp');
    if (retrieved < observed) reasons.push('retrieved_before_observed');
    if (available < observed || retrieved < available) reasons.push('invalid_availability_order');
    if (nowMs - retrieved > maxFetchAgeHours * 3_600_000) reasons.push('stale_fetch');
    // Independent feeds must record a timestamp consistent with the declared
    // US session. Permit UTC next-day timestamps, but not earlier/stale data.
    if (Number.isFinite(observed) && validSession(input.sessionDate)) {
      const sessionStart = Date.parse(input.sessionDate + 'T00:00:00Z');
      if (observed < sessionStart || observed >= sessionStart + 48 * 3_600_000) reasons.push('timestamp_session_mismatch');
    }
    return { id: rule.id, ...scored, ready: reasons.length === 0, reasons, observation: observation ?? null };
  });
  const arithmeticComplete = rows.every(r => r.score !== null);
  const arithmeticScore = arithmeticComplete ? rows.reduce((sum, r) => sum + r.score, 0) : null;
  const ready = problems.length === 0 && rows.every(r => r.ready);
  return {
    rulesetVersion: RULESET_VERSION,
    state: ready ? 'verified_snapshot' : 'unknown',
    score: ready ? arithmeticScore : null,
    arithmeticScore,
    band: ready ? describeBand(arithmeticScore) : null,
    usableInputs: rows.filter(r => r.ready).length,
    numericInputs: rows.filter(r => r.score !== null).length,
    sessionDate: validSession(input.sessionDate) ? input.sessionDate : null,
    mode: ['independent', 'publisher', 'synthetic'].includes(input.mode) ? input.mode : 'unknown',
    problems, rows,
    // Even a complete thermometer is descriptive, never a proprietary light.
    warningLights: { earlyDecline: 'unknown', bottom: 'unknown', rally: 'unknown' },
    isLive: false,
  };
}
