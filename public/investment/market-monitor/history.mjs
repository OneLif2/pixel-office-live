import { RULES } from './rules.mjs';
const indicatorLabels=['VIX 5日均','指數 / 50日線','30大 >50日線 %','30大距52週高 %','30大 >200日線 %','50 / 200日線 %','21日波幅 %','標普距高位 %'];
export const HISTORY_COLUMNS = [
  {id:'date',label:'日期',text:'正式模式應使用美股交易日，並與所有欄位的資料日一致。預設由最新至最舊。示範日期只是合成工作日，未套用交易所假期，不是真實交易日記錄。'},
  {id:'score',label:'0–16 分',text:'8 項指標各為 0、1 或 2 分；2 分門檻優先，等號包括在內。全部有效才合計，缺值不是 0 分。0–4、5–9、10–16 是描述分數的區間，不是跌市機率或三組專有警號。'},
  {id:'SPY',label:'SPY',text:'SPY 收市值及相對上一筆的變化。示範模式使用與本頁 K 線相同的合成 OHLC，不是真實 ETF 價格；正式數據及價格調整口徑尚未接通。'},
  {id:'QQQ',label:'QQQ',text:'QQQ 收市值及相對上一筆的變化。示範模式使用與本頁 K 線相同的合成 OHLC，不是真實 ETF 價格；正式數據及價格調整口徑尚未接通。'},
  ...RULES.map((rule,i)=>({id:rule.id,label:indicatorLabels[i],text:`${rule.label}。1 分：${rule.direction==='gte'?'≥':'≤'} ${rule.yellow}${rule.unit==='%'?'%':''}；2 分：${rule.direction==='gte'?'≥':'≤'} ${rule.red}${rule.unit==='%'?'%':''}；其餘有效值 0 分。先判斷 2 分，邊界含等號。${rule.convention}`})),
  {id:'advancers',label:'升 ≥4% 家數',text:'目標欄位：合資格股票單日升幅至少 4% 的家數；原站 ≥300 家加深顏色。原站公開篩選為收市價 ≥ US$5、20 日平均成交量 ≥ 30 萬股，並稱約 2,500 隻活躍美股；本頁未取得或核實同一逐日股票集合，所以正式家數、實際樣本數與覆蓋率仍未知。'},
  {id:'decliners',label:'跌 ≥4% 家數',text:'目標欄位：合資格股票單日跌幅至少 4% 的家數；原站 ≥300 家加深顏色。需與升幅家數使用同一日、同一合資格股票集合及價格口徑。示範家數為合成值，不能視作已驗證的約 2,500 隻股票結果。'},
  {id:'ratio5',label:'5 日升跌比',text:'本頁定義：最近 5 筆升 ≥4% 家數合計 ÷ 同期跌 ≥4% 家數合計，不是逐日比率的平均。原站顏色門檻：<0.5 紅色，≥2 綠色。不足 5 筆或分母為 0 時顯示未知。示範依合成家數計算；正式資料母體、缺值與交易日處理仍待核實。'},
  {id:'ratio10',label:'10 日升跌比',text:'本頁定義：最近 10 筆升 ≥4% 家數合計 ÷ 同期跌 ≥4% 家數合計，不是逐日比率的平均。原站顏色門檻：<1 紅色，≥2 綠色。不足 10 筆或分母為 0 時顯示未知。示範依合成家數計算；正式資料母體、缺值與交易日處理仍待核實。'},
  {id:'above40',label:'站穩 40日線 %',text:'觀察合資格股票站在 40 日線以上的比例；原站低於 20% 以深綠標示極端超賣，這不等於低風險或買入訊號。正式股票集合、價格調整及是否另有持續站穩條件仍待核實；本頁不把「30大」廣度與約 2,500 股母體混為一談。示範百分比是合成值，未由真實股票計算。'},
];
export function initHistoryHelp() {
  const row=document.getElementById('history-columns'),help=document.getElementById('history-help');
  let activeButton=null, suppressFocus=false;
  const close=()=>{const returnFocus=help.contains(document.activeElement),previous=activeButton;help.hidden=true;activeButton=null;row.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));if(returnFocus&&previous){suppressFocus=true;previous.focus();suppressFocus=false;}};
  function show(column,button,scroll=false){activeButton=button;document.getElementById('history-help-title').textContent=column.label;document.getElementById('history-help-text').textContent=column.text;help.hidden=false;row.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));if(scroll&&typeof help.scrollIntoView==='function')help.scrollIntoView({block:'nearest',behavior:'auto'});}
  row.replaceChildren(...HISTORY_COLUMNS.map(column=>{const th=document.createElement('th');th.scope='col';const button=document.createElement('button');button.type='button';button.className='column-help';button.dataset.column=column.id;button.title=column.text;button.textContent=column.label+' ⓘ';button.setAttribute('aria-label',column.label+'，查看欄位與門檻說明');button.setAttribute('aria-controls','history-help');button.setAttribute('aria-expanded','false');button.addEventListener('mouseenter',()=>show(column,button));button.addEventListener('focus',()=>{if(!suppressFocus)show(column,button);});button.addEventListener('click',()=>show(column,button,true));button.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});th.append(button);return th;}));
  document.getElementById('history-help-close').addEventListener('click',close);
  help.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
  return {close};
}
