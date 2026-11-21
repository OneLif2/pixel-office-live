import { annotationRows, bandSegments, cutoffLimits, demoRows, displayRows, priceDomain, probability, stampFor, WEEK } from "./chart-data.mjs";

const $ = id => document.getElementById(id);
const svg = $("chart-svg"), form = $("data-form"), cutoff = $("cutoff"), fileInput = $("csv-file");
const percent = new Intl.NumberFormat("zh-HK", {style:"percent",maximumFractionDigits:1});
const money = new Intl.NumberFormat("en-US", {minimumFractionDigits:2,maximumFractionDigits:2});
const domainMoney = new Intl.NumberFormat("en-US", {maximumFractionDigits:2});
const probLabel = value => probability(value) ? percent.format(value) : "—";
const priceLabel = value => Number.isFinite(value) ? "$" + money.format(value) : "—";
const labelState = value => ({bull:"偏牛",bear:"偏熊",uncertain:"未確定"})[value] || "資料不足";
const sources = { empty:"尚未選取", demo:"合成示範 · 非真實 SPY 價格", local:"本機 CSV · 來源與權限由使用者確認" };
const annotationsText = {cross:"機率線交叉", "diverge-down":"四週背馳：SPY 升、牛轉熊機率升", "diverge-up":"四週背馳：SPY 跌、熊轉牛機率升", "diverge-green-falls":"四週背馳：SPY 升、熊轉牛機率跌"};
const panDefs = [
  {field:"bullToBear2w", label:"牛轉熊", css:"down", divergences:["diverge-down"]},
  {field:"bearToBull2w", label:"熊轉牛", css:"up", divergences:["diverge-up","diverge-green-falls"]}
];
let allRows = [], viewRows = [], viewAnnotations = [], mode = "empty", selected = 0, request = 0;
let pixels = null, pointers = [], renderScheduled = false;
const sup = "http://www.w3.org/2000/svg";

function ss(tag, attrs = {}, value, node = svg) {
  const el = document.createElementNS(sup, tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,String(v)));
  if (value !== undefined) el.textContent = value;
  node.append(el);
  return el;
}
function setMessage(message = "", error = false) {
  const line = $("form-status");
  line.textContent = message; line.dataset.error = error;
}
function model() {
  if (!globalThis.SpyRegimeModel?.run || !globalThis.SpyRegimeModel?.parseCsv) {
    throw new Error("模型未載入，請重新整理頁面。");
  }
  return globalThis.SpyRegimeModel;
}
function errorText(error) {
  const value = String(error?.message || error);
  if (/^At least/.test(value)) return "至少需要 158 筆連續且已完成的週線價格（截止日前）。";
  if (/consecutive Friday/.test(value)) return "週線日期有重複或缺週。每個美股交易週只保留一筆最後交易日的價格。";
  if (/Required CSV columns/.test(value)) return "找不到日期或復權收市欄。請使用 Date, Adj Close（或 date,adj_close）。";
  if (/Invalid adjusted close|Invalid positive/.test(value)) return "復權收市價有缺值或格式錯誤，必須是有效正數。";
  if (/date|weekday/i.test(value)) return "請核對日期格式及週收市日；日期應為 YYYY-MM-DD，而且必須是工作日。";
  if (/CSV/.test(value)) return "CSV 格式不符。確認欄數一致，而且每行只放一筆週線資料。";
  return "資料未能計算。請核對檔案格式、日期和週數，再試一次。";
}

function setDataset(rows, dataMode) {
  allRows = rows; mode = dataMode;
  $("range-mode").value = "52";
  $("annotations").checked = false;
  $("annotation-help").hidden = true;
  $("status-badge").dataset.mode = dataMode;
  $("status-badge").textContent = ({empty:"尚未載入資料", demo:"合成示範 · 非真實行情", local:"本機研究 · 非即時行情"})[mode];
  $("data-as-of").textContent = "來源：" + sources[mode] + "。資料截至：" +
    (allRows.at(-1)?.weekEnd ? allRows.at(-1).weekEnd + "（週五標籤）" : "—");
  $("results").hidden = !allRows.length;
  $("chart-options").hidden = !allRows.length;
  $("empty").hidden = Boolean(allRows.length);
  $("clear-button").disabled = !allRows.length;
  updateView();
}
function updateView() {
  viewRows = displayRows(allRows,$("range-mode").value);
  viewAnnotations = annotationRows(allRows).slice(allRows.length-viewRows.length);
  selected = Math.max(viewRows.length-1,0);
  const slider = $("week-slider");
  slider.max = selected;
  slider.value = selected;
  renderTable();
  renderChart();
  renderSelection();
}
function renderTable() {
  const tbody = $("week-table");
  tbody.replaceChildren();
  for (const row of viewRows.slice(-12).reverse()) {
    const tr = document.createElement("tr");
    [row.weekEnd,probLabel(row.bullToBear2w),probLabel(row.bearToBull2w),labelState(row.regime),priceLabel(row.spyClose)]
      .forEach((v,i)=>{const cell = document.createElement(i ? "td" : "th"); if (!i) cell.scope="row";cell.textContent=v;tr.append(cell);});
    tbody.append(tr);
  }
}
function renderSelection() {
  const row = viewRows[selected];
  if (!row) {
    for (const id of ["metric-btb","metric-btbull","metric-regime","metric-price","week-caption","detail"]) $(id).textContent = "—";
    $("week-slider").removeAttribute("aria-valuetext");
    return;
  }
  $("metric-btb").textContent = probLabel(row.bullToBear2w);
  $("metric-btbull").textContent = probLabel(row.bearToBull2w);
  $("metric-regime").textContent = labelState(row.regime);
  $("metric-price").textContent = priceLabel(row.spyClose);
  $("week-caption").textContent = row.weekEnd;
  $("week-slider").value = selected;
  $("week-slider").setAttribute("aria-valuetext",row.weekEnd);
  const notes = $("annotations").checked ? (viewAnnotations[selected] || []).map(mark=>annotationsText[mark]) : [];
  $("detail").textContent = (probability(row.bullProbability)
    ? "模型過濾後的偏牛機率：" + probLabel(row.bullProbability) + "。擬合資料截至：" + row.refitWeek + "（週標籤）。"
    : "這週沒有有效的模型估計；不以零補空值。") + (notes.length ? " 未驗證：" + notes.join("；") + "。" : "");
  if (pixels) for (const pointer of pointers) {
    const x = pixels.coord(selected);
    pointer.setAttribute("x1",x);
    pointer.setAttribute("x2",x);
  }
}
function scrubTo(i) {
  const index = Math.min(viewRows.length-1,Math.max(0,i));
  if (index === selected || index < 0) return;
  selected = index;
  renderSelection();
}
function drawPath(field, css, rows, coord, valueY) {
  let data = "", previous = null;
  for (let i = 0; i<rows.length; i++) {
    const row = rows[i], value = row[field], time = stampFor(row.weekEnd);
    if (field === "spyClose" ? !Number.isFinite(value) : !probability(value)) { previous = null; continue; }
    const x = coord(i), y = valueY(value);
    data += (previous !== null && time - previous === WEEK ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2);
    previous = time;
  }
  if (data) ss("path",{d:data,fill:"none",class:css,"stroke-width":css==="price-line"?1.55:2.5,"vector-effect":"non-scaling-stroke","stroke-linejoin":"round"});
}
function renderChart() {
  pixels = null; pointers = [];
  svg.replaceChildren();
  if (!viewRows.length) return;
  const width = Math.max(290,$("chart-frame").clientWidth - 2), small = width < 480;
  const panelH = small ? 215 : 250, groupGap = 19, height = 2 * panelH + groupGap + 20;
  svg.setAttribute("viewBox","0 0 " + width + " " + height);
  const left = small ? 36 : 51, right = width - (small ? 54 : 71), plotWidth = right-left;
  const first = stampFor(viewRows[0].weekEnd), last = stampFor(viewRows.at(-1).weekEnd);
  const denom = Math.max(last-first + .78*WEEK,WEEK);
  const tx = time => left + (time - first)/denom * plotWidth;
  const coord = i => tx(stampFor(viewRows[i].weekEnd));
  const range = priceDomain(viewRows), mark = $("annotations").checked;
  pixels = {left,right,width,coord};
  ss("title",{id:"svg-title"},"SPY 雙狀態 HMM：兩張每週機率圖");
  ss("desc",{id:"svg-description"},"上圖牛轉熊，下圖熊轉牛。兩圖左軸都是百分率，右軸是灰色 SPY 美元復權收市。綠和紅底代表當週偏牛和偏熊的過濾狀態。詳情及最近十二週數值列於圖後。");
  const tickIndices = [...new Set(Array.from({length:small?3:5},(_,i)=>Math.round(i*(viewRows.length-1)/(small?2:4))))];
  const bands = bandSegments(viewRows);
  panDefs.forEach((def,j)=>{
    const top = j*(panelH+groupGap) + 45, bottom=top+panelH-59, span=bottom-top;
    const yp = p => bottom-span*p;
    const yc = v => bottom - span*(v-range.min)/(range.max-range.min);
    ss("text",{x:left,y:top-22,class:"axis axis-title"},def.label+" · 兩週機率");
    ss("text",{x:right,y:top-22,"text-anchor":"end",class:"axis axis-title"},"SPY（美元）");
    ss("rect",{x:left,y:top,width:plotWidth,height:span,fill:"#fcfdf8"});
    for (const band of bands) {
      const x = coord(band.start);
      const end = Math.min(right, tx(stampFor(viewRows[band.end-1].weekEnd) + WEEK));
      ss("rect",{x,y:top,width:Math.max(0,end-x),height:span,fill:band.regime==="bull"?"#e1eddb":"#f3dfd7"});
    }
    for (let i=0; i<=4; i++) {
      const p=i/4, y=yp(p);
      ss("line",{x1:left,y1:y,x2:right,y2:y,class:i===0||i===4?"reference":"grid"});
      ss("text",{x:left-5,y:y+4,"text-anchor":"end",class:"axis"},Math.round(p*100)+"%");
      ss("text",{x:right+4,y:y+4,class:"axis"},domainMoney.format(range.min+p*(range.max-range.min)));
    }
    for (const i of tickIndices) {
      const x=coord(i);
      ss("line",{x1:x,y1:top,x2:x,y2:bottom,class:"grid"});
      const label = viewRows[i].weekEnd;
      ss("text",{x,y:bottom+18,class:"axis","text-anchor":i===0?"start":i===viewRows.length-1?"end":"middle"},label);
    }
    drawPath("spyClose","price-line",viewRows,coord,yc);
    drawPath(def.field,def.css+"-line",viewRows,coord,yp);
    if (mark) viewRows.forEach((row,i)=>{
      const signs = viewAnnotations[i];
      if (!probability(row[def.field]) || !signs?.length) return;
      const x=coord(i), y=yp(row[def.field]);
      if (signs.includes("cross")) ss("path",{d:"M"+x+","+(y-5)+" l5,5 -5,5 -5,-5 z",class:"annotation-mark"});
      if (def.divergences.some(sign=>signs.includes(sign))) ss("circle",{cx:x,cy:signs.includes("cross")?Math.min(bottom-5,y+10):y,r:3,class:"annotation-mark"});
    });
    const lastRow = viewRows.at(-1), p = lastRow[def.field], x = coord(viewRows.length-1);
    if (probability(p)) {
      ss("circle",{cx:x,cy:yp(p),r:3.8,class:def.css+"-line",fill:"#fffef9","stroke-width":1.6,"stroke-dasharray":"none"});
      ss("text",{x:x-6,y:Math.min(bottom-7,Math.max(top+13,yp(p)-7)),class:"axis endpoint "+def.css+"-endpoint","text-anchor":"end"},probLabel(p));
    }
    ss("circle",{cx:x,cy:yc(lastRow.spyClose),r:2.75,class:"price-line",fill:"#fffef9","stroke-width":1.3});
    pointers.push(ss("line",{x1:coord(selected),y1:top,x2:coord(selected),y2:bottom,class:"crosshair","pointer-events":"none"}));
  });
}
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(()=>{renderScheduled=false; renderChart();});
}
function atPointer(event) {
  if (!pixels || viewRows.length < 2) return;
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width) return;
  const x = (event.clientX - bounds.left) * pixels.width / bounds.width;
  if (x < pixels.left || x > pixels.right) return;
  let l=0,r=viewRows.length-1;
  while (l<r) {
    const mid=Math.floor((l+r)/2);
    if (pixels.coord(mid)<x) l=mid+1;
    else r=mid;
  }
  scrubTo(l && Math.abs(pixels.coord(l-1)-x) <= Math.abs(pixels.coord(l)-x) ? l-1 : l);
}

const limits = cutoffLimits();
cutoff.value = limits.defaultDate;
cutoff.max = limits.maximum;
form.addEventListener("submit", async event=>{
  event.preventDefault();
  const token = ++request;
  const file = fileInput.files?.[0], date = cutoff.value;
  if (!file) { setMessage("先選取一個週線 CSV 檔案。",true); return; }
  if (file.size > 512000) { setMessage("檔案超過 512 KB。請只保留每週的日期和復權收市欄。",true); return; }
  if (!Number.isFinite(stampFor(date)) || date > cutoffLimits().maximum) {
    setMessage("請選擇早於紐約今日的有效截止日。",true); return;
  }
  setMessage("正在此瀏覽器讀取檔案…");
  try {
    const content = await file.text();
    if (token !== request) return;
    const engine = model();
    const result = engine.run(engine.parseCsv(content,date));
    if (token !== request) return;
    setDataset(result,"local");
    const usable = result.filter(row=>probability(row.bullToBear2w)).length;
    setMessage("本機讀取 " + result.length + " 週；其中 " + usable + " 週有模型估計。未上傳資料。");
  } catch (error) {
    if (token === request) {
      setDataset([],"empty");
      setMessage(errorText(error),true);
    }
  }
});
$("demo-button").addEventListener("click",()=>{
  ++request;
  fileInput.value = "";
  try { setDataset(model().run(demoRows()),"demo"); setMessage("已載入合成示範。所有數字均非真實行情。"); }
  catch (error) { setDataset([],"empty"); setMessage(errorText(error),true); }
});
$("clear-button").addEventListener("click",()=>{
  ++request;
  fileInput.value = "";
  setDataset([],"empty");
  setMessage("已清除瀏覽器中的資料。");
});
fileInput.addEventListener("change",()=>{ ++request; setMessage(fileInput.files?.length ? "已選取 CSV。按「讀取 CSV 並計算」才會處理。" : ""); });
$("range-mode").addEventListener("change",updateView);
$("week-slider").addEventListener("input",event=>scrubTo(Number(event.currentTarget.value)));
$("annotations").addEventListener("change",event=>{
  $("annotation-help").hidden = !event.currentTarget.checked;
  renderChart(); renderSelection();
});
svg.addEventListener("pointermove",event=>{if (event.pointerType==="mouse") atPointer(event);});
svg.addEventListener("pointerup",atPointer);
if ("ResizeObserver" in globalThis) new ResizeObserver(scheduleRender).observe($("chart-frame"));
else addEventListener("resize",scheduleRender);
