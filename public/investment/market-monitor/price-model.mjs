// All bundled OHLC and events below are deterministic synthetic UI fixtures.
// No provider data, ticker-specific returns or proprietary signals are used.
export const PRICE_SYMBOLS = Object.freeze(['SPY', 'QQQ']);
export function validBar(bar) {
  return bar && typeof bar.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bar.date) &&
    Number.isFinite(Date.parse(bar.date + 'T00:00:00Z')) && new Date(bar.date + 'T00:00:00Z').toISOString().slice(0, 10) === bar.date &&
    ['open', 'high', 'low', 'close'].every(k => typeof bar[k] === 'number' && Number.isFinite(bar[k]) && bar[k] > 0) &&
    bar.low <= Math.min(bar.open, bar.close) && bar.high >= Math.max(bar.open, bar.close) && bar.high >= bar.low;
}
export function syntheticPrices(symbol) {
  if (!PRICE_SYMBOLS.includes(symbol)) throw new Error('unknown_symbol');
  const bars = [], start = Date.UTC(2013, 0, 2), end = Date.UTC(2025, 9, 31), tech = symbol === 'QQQ';
  let previous = tech ? 64 : 115;
  for (let stamp = start; stamp <= end; stamp += 86400000) {
    const d = new Date(stamp); if ([0, 6].includes(d.getUTCDay())) continue;
    const i = bars.length, drift = (tech ? .00064 : .00045), cycle = Math.sin(i / 37) * .003 + Math.cos(i / 9) * .0035 + Math.sin(i / 2.1) * .004;
    const regime = i % 610 > 510 ? -.004 : 0;
    const open = previous * (1 + Math.sin(i * 1.73) * .0028), close = open * Math.exp(drift + cycle * (tech ? 1.28 : 1) + regime);
    const high = Math.max(open, close) * (1.0035 + Math.abs(Math.sin(i * .31)) * .006), low = Math.min(open, close) * (1 - .003 - Math.abs(Math.cos(i * .27)) * .006);
    const rounded = Object.fromEntries(Object.entries({open, high, low, close}).map(([k,v]) => [k, Number(v.toFixed(2))]));
    bars.push({date:d.toISOString().slice(0,10),...rounded,mode:'synthetic'}); previous = close;
  }
  return bars;
}
export function mondayOf(date) {
  const d = new Date(date + 'T00:00:00Z'), weekday = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - weekday); return d.toISOString().slice(0,10);
}
export function aggregateWeekly(bars) {
  const weeks=[];
  for (const bar of bars) {
    if (!validBar(bar)) throw new Error('invalid_ohlc');
    const weekStart = mondayOf(bar.date), last=weeks.at(-1);
    if (last?.weekStart===weekStart) {last.high=Math.max(last.high,bar.high);last.low=Math.min(last.low,bar.low);last.close=bar.close;last.date=bar.date;last.sessions++;}
    else weeks.push({...bar,weekStart,firstDate:bar.date,sessions:1});
  }
  return weeks;
}
export function periodBars(bars, years) {
  if (!bars.length || years === 'all') return bars.slice();
  const yearCount=Number(years); if (![1,3,5,10].includes(yearCount)) throw new Error('invalid_period');
  const cutoff=new Date(bars.at(-1).date+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-yearCount);
  return bars.filter(b=>b.date>=cutoff.toISOString().slice(0,10));
}
export function syntheticEvents(bars) {
  const kinds=['early','bottom','rally'];
  return bars.filter((_,i)=>i>100 && i%113===27).map((bar,i)=>({id:`synthetic-${bar.date}`,date:bar.date,type:kinds[i%3],variant:Math.floor(i/3)%2?'secondary':'primary',mode:'synthetic',label:'版面示範，並非觸發訊號'}));
}
export function windowBounds(total,count,end=total-1) {
  if(!total)return {start:0,end:-1,count:0};const size=Math.max(1,Math.min(total,Math.round(count)));const last=Math.max(size-1,Math.min(total-1,Math.round(end)));return {start:last-size+1,end:last,count:size};
}
export function scaleY(value,low,high,scale,top=24,bottom=300) {
  if (![value,low,high].every(v=>typeof v==='number'&&Number.isFinite(v))||high<=low||value<=0||low<=0) throw new Error('invalid_scale');
  const transform=scale==='log'?Math.log:(v=>v);return bottom-(transform(value)-transform(low))/(transform(high)-transform(low))*(bottom-top);
}
export function eventsInBar(events,bar,timeframe) {
  return events.filter(event => timeframe==='daily'?event.date===bar.date:event.date>=bar.firstDate&&event.date<=bar.date);
}

export function barIndexAt(pixelX,displayWidth,logicalWidth,start,count) {
  if(!count || displayWidth<=0) return -1;
  const local=pixelX*logicalWidth/displayWidth;
  const proportion=(local-48)/(logicalWidth-62);
  return start+Math.max(0,Math.min(count-1,Math.floor(proportion*count)));
}
