import { RULES } from './rules.mjs';
import { scoreValue } from './engine.mjs';
import { BAND, tone, demoRecords, validateFeed, filterRecords, makeCsv } from './model.mjs';
const $ = id => document.getElementById(id);
let mode = 'real', records = [], production = [], selected = -1, range = 60, request = 0, feedError = false, lastFeed = null;
const number = (value, decimals = 0) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals}) : '—';
for (let i = 0; i < 16; i++) $('segments').appendChild(document.createElement('i'));
function markMode() {
  $('mode-real').classList.toggle('active', mode === 'real'); $('mode-real').setAttribute('aria-pressed', String(mode === 'real'));
  $('mode-demo').classList.toggle('active', mode === 'demo'); $('mode-demo').setAttribute('aria-pressed', String(mode === 'demo'));
  $('data-badge').textContent = mode === 'demo' ? '◈ 合成示範 · 非行情' : production.length ? '● 已核實日期快照' : '● 正式資料未接通';
  const notice = $('data-notice'); notice.className = 'notice' + (mode === 'demo' ? ' demo' : feedError ? ' error' : '');
  notice.textContent = mode === 'demo' ? '示範模式：所有日期、分數及市場廣度均由固定函數合成，並非真實歷史或投資訊號。三個專有警號仍維持未知。' : feedError ? '資料檔讀取失敗或未通過驗證，未沿用舊數字。可重新讀取，或切換示範查看介面。' : production.length ? '這是有日期的收市快照，並非即時行情。分數只描述市況；警號模型尚未啟用。' : '正式行情尚未接通。未核實來源、授權與計算口徑前維持未知；灰色不代表安全。可按「試看示範」體驗完整圖表與記錄。';
}
function selectedRow() { return records[selected] ?? null; }
function renderScore() {
  const row = selectedRow(), score = row?.score ?? null;
  $('score').textContent = score === null ? '—' : score; $('band').textContent = BAND(score); $('band').className = 'pill point ' + tone(score);
  [...$('segments').children].forEach((el, i) => el.style.background = score !== null && i < score ? (i < 4 ? '#9fb783' : i < 9 ? '#d6bc6f' : '#c88970') : '');
  $('score-description').textContent = mode === 'demo' && row ? '合成示範分數。以八項門檻加總，僅展示介面與計分行為，不代表任何交易日的真實市場。' : row ? '已核實日期快照，不是即時訊號。請查閱每項數據的來源與時間。' : '輸入不足時不計總分，也不以 0 代替缺值。';
  $('source-count').textContent = `完整指標 ${row ? 8 : 0} / 8${mode === 'demo' ? ' · 合成' : ''}`;
  $('asof').textContent = row ? (mode === 'demo' ? '示範日期：' : '交易日：') + row.sessionDate : '交易日：尚無';
  $('updated-at').textContent = mode === 'demo' ? '合成資料，無市場擷取時間' : row ? '來源擷取：' + (row.observations?.vix5d?.retrievedAt ?? '尚無') : '擷取時間：尚無';
  $('selected-date').textContent = row ? row.sessionDate + (mode === 'demo' ? ' · 合成' : '') : '—';
  const comparisons = [[1, '上一筆'], [5, '約一週前'], [20, '約一個月前'], [252, '約一年前']];
  $('comparisons').replaceChildren(...comparisons.map(([lag, label]) => {
    const prev = records[selected - lag], el = document.createElement('div'); el.className = 'comparison';
    const left = document.createElement('span'); left.textContent = label; const small = document.createElement('small'); small.textContent = prev?.sessionDate ?? '資料不足'; left.append(small);
    const value = document.createElement('strong'); value.textContent = prev?.score ?? '—';
    const delta = document.createElement('span'); delta.className = 'delta'; const d = row && prev ? row.score - prev.score : null; delta.textContent = d === null ? '—' : d === 0 ? '持平' : (d > 0 ? '↑ 高 ' : '↓ 低 ') + Math.abs(d) + ' 分'; el.append(left, value, delta); return el;
  }));
  ['advancers', 'decliners', 'ratio5', 'ratio10', 'above40'].forEach(key => $(key).textContent = number(row?.breadth?.[key], key.startsWith('ratio') ? 2 : key === 'above40' ? 1 : 0));
  $('universe-note').textContent = mode === 'demo' ? '示範樣本數 2,500 只是合成設定，並非實際股票集合；資格、覆蓋率與價格全部未接入。大型股指標與全市場廣度是不同母體。' : '廣度資料未接通；樣本數、資格條件與覆蓋率尚未驗證。';
}
function renderIndicators() {
  const row = selectedRow();
  $('indicators').replaceChildren(...RULES.map((rule, i) => {
    const scored = scoreValue(rule.id, row?.observations?.[rule.id]?.value), card = document.createElement('article'); card.className = 'indicator';
    const top = document.createElement('div'); top.className = 'indicator-top'; const num = document.createElement('span'); num.textContent = String(i + 1).padStart(2, '0'); const point = document.createElement('span'); point.className = 'point ' + (scored.score === null ? '' : 'p' + scored.score); point.textContent = scored.score === null ? '未知' : scored.score + ' 分' + (mode === 'demo' ? ' · 示範' : ''); top.append(num, point);
    const title = document.createElement('h3'); title.textContent = rule.label; const value = document.createElement('div'); value.className = 'indicator-value'; value.textContent = number(scored.value, rule.decimals); const unit = document.createElement('small'); unit.textContent = rule.unit; value.append(unit);
    const thresholds = document.createElement('p'); thresholds.className = 'thresholds'; const op = rule.direction === 'gte' ? '≥' : '≤'; thresholds.textContent = `1 分 ${op} ${rule.yellow} · 2 分 ${op} ${rule.red}`;
    const details = document.createElement('details'), summary = document.createElement('summary'), description = document.createElement('p'); summary.textContent = '口徑與來源'; description.textContent = rule.convention + ` 顯示 ${rule.decimals} 位小數。`;
    const source = document.createElement('p'); source.textContent = mode === 'demo' ? '數據來源：固定函數合成；無真實行情來源。' : '目前未接通已驗證數據來源。'; details.append(summary, description, source); const observation = row?.observations?.[rule.id]; if (mode === 'real' && observation) { source.textContent = '數據來源：'; const link = document.createElement('a'); link.href = observation.sourceUrl; link.textContent = new URL(observation.sourceUrl).hostname + ' ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link); const times = document.createElement('p'); times.textContent = `交易日 ${observation.sessionDate}；觀察 ${observation.observedAt}；可得 ${observation.availableAt}；擷取 ${observation.retrievedAt}。`; details.append(times); } card.append(top, title, value, thresholds, details); return card;
  }));
}
function renderChart() {
  const visible = records.slice(-range), host = $('chart'); host.replaceChildren();
  $('chart-caption').textContent = visible.length ? (mode === 'demo' ? '合成示範 · ' : '收市快照 · ') + visible[0].sessionDate + ' 至 ' + visible.at(-1).sessionDate : '尚無正式歷史資料';
  const slider = $('date-slider'); slider.max = Math.max(0, visible.length - 1); slider.disabled = !visible.length; slider.value = Math.max(0, selected - (records.length - visible.length));
  if (!visible.length) { const empty = document.createElement('div'); empty.className = 'empty'; const strong = document.createElement('strong'); strong.textContent = '留白，也是資料品質的一部分。'; const p = document.createElement('p'); p.textContent = '正式資料接通後，這裡會顯示同一口徑的歷史。'; empty.append(strong, p); host.append(empty); return; }
  const NS = 'http://www.w3.org/2000/svg'; const el = (name, attrs = {}, text = '') => { const e = document.createElementNS(NS, name); Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, String(v))); if (text) e.textContent = text; return e; };
  const width = Math.max(280, host.clientWidth || 850), right = width - 18;
  const svg = el('svg', {viewBox:`0 0 ${width} 235`, role:'img', 'aria-label':`${mode === 'demo' ? '合成示範' : '已核實日期快照'}分數走勢，${visible.length} 筆。可用下方滑桿選取記錄。`});
  svg.append(el('title', {}, mode === 'demo' ? '合成示範：非真實市場走勢' : '市況分數走勢'));
  const x = i => 32 + i / Math.max(1, visible.length - 1) * (width - 50), y = score => 204 - score / 16 * 180;
  [[10,16,'#f5e9e1'],[5,10,'#f6f0dd'],[0,5,'#edf2e6']].forEach(([a,b,c]) => svg.append(el('rect',{x:32,y:y(b),width:width-50,height:y(a)-y(b),fill:c,opacity:.55})));
  [0,4,8,12,16].forEach(n => { svg.append(el('line',{x1:32,x2:right,y1:y(n),y2:y(n),stroke:'#dbe2d1','stroke-dasharray':'3 5'})); svg.append(el('text',{x:10,y:y(n)+4},String(n))); });
  const path = visible.map((r,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(r.score).toFixed(2)).join(' '); svg.append(el('path',{d:path,fill:'none',stroke:'#617d4e','stroke-width':2.5,'stroke-linejoin':'round'}));
  const at = Math.min(visible.length-1, Math.max(0, selected - (records.length-visible.length))), row=visible[at]; svg.append(el('line',{x1:x(at),x2:x(at),y1:20,y2:204,stroke:'#8a9b7b','stroke-dasharray':'4 4'})); svg.append(el('circle',{cx:x(at),cy:y(row.score),r:5,fill:'#526e47',stroke:'#fffef8','stroke-width':2}));
  svg.append(el('text',{x:32,y:228},visible[0].sessionDate)); svg.append(el('text',{x:right,y:228,'text-anchor':'end'},visible.at(-1).sessionDate)); host.append(svg);
}
function historyRows() { return filterRecords(records, { band:$('history-band').value, limit:Number($('history-limit').value), sort:$('history-sort').value }); }
function renderHistory() {
  const rows=historyRows(); $('history-count').textContent=records.length ? `${rows.length} 筆顯示 / ${records.length} 筆${mode==='demo'?'合成示範':'核實記錄'}` : '尚無正式記錄';
  $('table-caption').textContent=mode==='demo'?'以下全部為合成示範，並非真實歷史。日期僅供操作展示。':'數值依其來源與日期閱讀，不是即時行情。'; $('export').disabled=!rows.length;
  $('history-body').replaceChildren(...rows.map(row=>{ const tr=document.createElement('tr'); const cells=[row.sessionDate,row.score,...RULES.map(r=>number(row.observations?.[r.id]?.value,r.decimals)),...['advancers','decliners','ratio5','ratio10','above40'].map(k=>number(row.breadth?.[k],k.startsWith('ratio')?2:k==='above40'?1:0))]; cells.forEach((val,i)=>{ const td=document.createElement('td'); if(i===1){const badge=document.createElement('span');badge.className='point '+tone(row.score);badge.textContent=val;td.append(badge);}else td.textContent=val; tr.append(td);}); return tr;}));
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=15;td.textContent=records.length?'此區間沒有符合條件的記錄。':'尚無已驗證歷史資料。可切換示範查看篩選與匯出功能。';tr.append(td);$('history-body').append(tr);}
}
function render() { markMode(); renderScore(); renderIndicators(); renderChart(); renderHistory(); }
function switchMode(next) { mode=next; records=mode==='demo'?demoRecords():production; selected=records.length-1; render(); }
async function load() {
  const id=++request; $('reload').disabled=true; $('reload').textContent='讀取中…';
  try { const response=await fetch('./data/monitor.json',{cache:'no-store'}); if(!response.ok)throw new Error('http'); const feed=await response.json();const valid=validateFeed(feed);if(id!==request)return;lastFeed=feed;production=valid;feedError=false; }
  catch { if(id!==request)return;production=[];lastFeed=null;feedError=true; }
  finally { if(id===request){$('reload').disabled=false;$('reload').textContent='↻ 重新讀取';if(mode==='real'){records=production;selected=records.length-1;}render();} }
}
$('mode-real').addEventListener('click',()=>switchMode('real')); $('mode-demo').addEventListener('click',()=>switchMode('demo')); $('reload').addEventListener('click',load);
document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{range=Number(button.dataset.range);selected=Math.max(records.length-Math.min(range,records.length),selected);document.querySelectorAll('[data-range]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderScore();renderIndicators();renderChart();}));
$('date-slider').addEventListener('input',()=>{selected=records.length-Math.min(range,records.length)+Number($('date-slider').value);renderScore();renderIndicators();renderChart();});
['history-band','history-limit','history-sort'].forEach(id=>$(id).addEventListener('change',renderHistory));
$('export').addEventListener('click',()=>{const rows=historyRows();if(!rows.length)return;const blob=new Blob([makeCsv(rows,mode)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`market-monitor-${mode==='demo'?'SYNTHETIC-DEMO':'snapshot'}-${rows[0].sessionDate}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// Reassess age without relabeling a repeated fetch as fresh market data.
setInterval(()=>{if(!lastFeed||!production.length)return;try{production=validateFeed(lastFeed);}catch{production=[];feedError=true;}if(mode==='real'){records=production;selected=Math.min(selected,records.length-1);render();}},60000);
window.addEventListener('resize', renderChart);
render();load();
