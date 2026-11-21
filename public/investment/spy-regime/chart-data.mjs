export const DAY = 86400000;
export const WEEK = 7 * DAY;
const nyDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

export function isoDay(time) { return new Date(time).toISOString().slice(0,10); }
export function stampFor(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const stamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(stamp) && isoDay(stamp) === value ? stamp : NaN;
}
export function cutoffLimits(now = new Date()) {
  const fields = Object.fromEntries(nyDate.formatToParts(now).map(part => [part.type, part.value]));
  const today = stampFor(fields.year + "-" + fields.month + "-" + fields.day);
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
  return { maximum: isoDay(today - DAY), defaultDate: isoDay(monday - 3 * DAY) };
}
export function displayRows(rows, weeks) {
  if (weeks === "all" || !rows.length) return rows.slice();
  const first = stampFor(rows.at(-1).weekEnd) - (Number(weeks) - 1) * WEEK;
  return rows.filter(row => stampFor(row.weekEnd) >= first);
}
export function probability(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
export function bandSegments(rows) {
  const segments = [];
  for (const [i,row] of rows.entries()) {
    if (row.regime !== "bull" && row.regime !== "bear") continue;
    const previous = segments.at(-1);
    const consecutive = i && stampFor(row.weekEnd) - stampFor(rows[i-1].weekEnd) === WEEK;
    if (consecutive && previous?.end === i && previous.regime === row.regime) previous.end = i + 1;
    else segments.push({ start:i, end:i + 1, regime:row.regime });
  }
  return segments;
}
export function annotationRows(rows) {
  let previousSign = 0;
  return rows.map((row,i) => {
    const previous = rows[i-1], prior = rows[i-4], result = [];
    if (!previous || stampFor(row.weekEnd) - stampFor(previous.weekEnd) !== WEEK) previousSign = 0;
    if (probability(row.bullToBear2w) && probability(row.bearToBull2w)) {
      const delta = row.bullToBear2w - row.bearToBull2w;
      const sign = Math.abs(delta) < 1e-10 ? 0 : Math.sign(delta);
      if (previousSign && sign && sign !== previousSign) result.push("cross");
      if (sign) previousSign = sign;
    } else previousSign = 0;
    if (prior && rows.slice(i-3,i+1).every((next,j) => stampFor(next.weekEnd) - stampFor(rows[i-4+j].weekEnd) === WEEK)) {
      if (row.spyClose > prior.spyClose && probability(row.bullToBear2w) && probability(prior.bullToBear2w) &&
          row.bullToBear2w > prior.bullToBear2w) result.push("diverge-down");
      if (probability(row.bearToBull2w) && probability(prior.bearToBull2w)) {
        if (row.spyClose < prior.spyClose && row.bearToBull2w > prior.bearToBull2w) result.push("diverge-up");
        if (row.spyClose > prior.spyClose && row.bearToBull2w < prior.bearToBull2w) result.push("diverge-green-falls");
      }
    }
    return result;
  });
}

export function priceDomain(rows) {
  const prices = rows.map(row => row.spyClose).filter(p=>typeof p === "number" && Number.isFinite(p) && p > 0);
  if (!prices.length) return {min:0,max:1};
  const min = Math.min(...prices), max = Math.max(...prices);
  const buffer = Math.max((max-min)*.08,Math.min(max,min)*.008,.00001);
  return {min:Math.max(0,min-buffer),max:Math.min(Number.MAX_VALUE,max+buffer)};
}
export function demoRows() {
  const values = [], from = Date.UTC(2020,0,3);
  let seed = 0x58642, price = 270;
  function rand() { seed = (1664525 * seed + 1013904223) >>> 0; return (seed + 1) / 4294967297; }
  for (let i=0; i<285; i++) {
    const draw = Math.sqrt(-2 * Math.log(rand())) * Math.cos(2*Math.PI*rand());
    const negative = [1,3,5].includes(Math.trunc(i/22) % 8);
    if (i) price *= Math.exp(negative ? -.012 + draw*.035 : .006 + draw*.011);
    values.push({weekEnd:isoDay(from + WEEK*i),spyClose:Math.round(price*100)/100});
  }
  return values;
}
