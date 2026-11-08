import { syntheticPrices, syntheticEvents, periodBars, aggregateWeekly, windowBounds, scaleY, eventsInBar, barIndexAt } from './price-model.mjs';
const NAMES = { early:'早期跌', bottom:'見底', rally:'升浪確認' };
const COLORS = { early:'#ac6654', bottom:'#65834d', rally:'#5e8093' };
const format = value => Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export function initPriceChart(onRequestDemo) {
  const $ = id=>document.getElementById(id), host=$('price-chart');
  let mode='real',symbol='SPY',years='3',type='candles',scale='log',showMarkers=true,bars=[],events=[],bounds={start:0,end:-1,count:0},selected=-1,drag=null,chartWidth=850;
  const cache=new Map();
  const timeframe=()=>years==='1'?'daily':'weekly';
  function rebuild() {
    if(mode==='demo') {
      if(!cache.has(symbol)) cache.set(symbol,syntheticPrices(symbol));
      const full=cache.get(symbol),period=periodBars(full,years); bars=timeframe()==='daily'?period:aggregateWeekly(period);events=syntheticEvents(full);
    } else { bars=[];events=[]; }
    bounds=windowBounds(bars.length,bars.length);selected=bounds.end;render();
  }
  function visibleBars(){return bars.slice(bounds.start,bounds.end+1);}
  function setWindow(count,end=bounds.end){bounds=windowBounds(bars.length,count,end);selected=Math.max(bounds.start,Math.min(bounds.end,selected));render();}
  function zoom(factor){if(!bars.length)return;setWindow(Math.max(12,Math.round(bounds.count*factor)));}
  function pan(direction){if(!bars.length)return;setWindow(bounds.count,bounds.end+Math.round(Math.max(1,bounds.count*.2))*direction);}
  function select(index){if(!bars.length)return;selected=Math.max(bounds.start,Math.min(bounds.end,index));renderPlot();renderDetails();}
  function renderDetails() {
    const row=bars[selected],meta=$('price-ohlc');meta.replaceChildren();
    const values=row?[['示範日期',row.date],['開',format(row.open)],['高',format(row.high)],['低',format(row.low)],['收',format(row.close)]]:[['日期','—'],['開','—'],['高','—'],['低','—'],['收','—']];
    for(const [label,value] of values){const span=document.createElement('span');span.textContent=label+' '+value;meta.append(span);}
    const picked=row&&showMarkers?eventsInBar(events,row,timeframe()):[];
    $('price-event-detail').textContent=!row?'未知。沒有已核實的訊號資料。':!showMarkers?'示範標記已隱藏。正式訊號仍為未知。':picked.length?picked.map(e=>`${e.date} · ${NAMES[e.type]} · ${e.variant==='primary'?'主燈樣式':'副燈樣式'}，僅示範位置，沒有真實觸發或回測結果。`).join(' '):'這根合成 K 線沒有示範標記。這不表示真實市場「未亮燈」；正式訊號仍未知。';
  }
  function renderPlot() {
    host.replaceChildren();
    if(!bars.length){const box=document.createElement('div');box.className='price-empty';const title=document.createElement('strong');title.textContent=symbol+' 價格尚未接通';const text=document.createElement('p');text.textContent='沒有已核實、可公開分發的 OHLC 資料。正式行情與警號保持未知，不用示範值補上。';const button=document.createElement('button');button.className='button';button.type='button';button.textContent='試看合成 K 線';button.addEventListener('click',onRequestDemo);box.append(title,text,button);host.append(box);return;}
    const visible=visibleBars(),width=Math.max(280,host.clientWidth||850);chartWidth=width;const height=host.clientHeight||340,top=24,bottom=height-30,left=48,right=width-14,span=right-left;
    const lows=visible.map(b=>b.low),highs=visible.map(b=>b.high),low=Math.min(...lows)*.96,high=Math.max(...highs)*1.05;
    const y=v=>scaleY(v,low,high,scale,top,bottom),x=i=>left+(i+.5)/visible.length*span,NS='http://www.w3.org/2000/svg';
    const svgEl=(tag,attrs={},text='')=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;return el;};
    const svg=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${symbol} 合成示範，${timeframe()==='daily'?'日':'週'}線，${scale==='log'?'對數':'線性'}刻度。${visible[0].date} 至 ${visible.at(-1).date}，非真實市場價格。`});
    svg.append(svgEl('title',{},'合成示範 K 線，非歷史行情或投資訊號'));
    for(let i=0;i<=4;i++){const value=scale==='log'?Math.exp(Math.log(low)+(Math.log(high)-Math.log(low))*i/4):low+(high-low)*i/4;svg.append(svgEl('line',{x1:left,x2:right,y1:y(value),y2:y(value),stroke:'#dce2d1','stroke-dasharray':'3 5'}));svg.append(svgEl('text',{x:left-7,y:y(value)+3,'text-anchor':'end'},value>=1000?String(Math.round(value)):value.toFixed(1)));}
    svg.append(svgEl('text',{x:(left+right)/2,y:(top+bottom)/2,'text-anchor':'middle',class:'price-watermark'},'合成示範 · 非真實行情'));
    if(type==='line'){const d=visible.map((bar,i)=>(i?'L':'M')+x(i).toFixed(2)+' '+y(bar.close).toFixed(2)).join(' ');svg.append(svgEl('path',{d,fill:'none',stroke:'#657f52','stroke-width':1.8}));}
    else{const candleWidth=Math.max(.7,Math.min(11,span/visible.length*.64));visible.forEach((bar,i)=>{const rising=bar.close>=bar.open,color=rising?'#6c8757':'#b46f5d';svg.append(svgEl('line',{x1:x(i),x2:x(i),y1:y(bar.high),y2:y(bar.low),stroke:color,'stroke-width':Math.max(.6,Math.min(1.2,candleWidth))}));svg.append(svgEl('rect',{x:x(i)-candleWidth/2,y:Math.min(y(bar.open),y(bar.close)),width:candleWidth,height:Math.max(1,Math.abs(y(bar.open)-y(bar.close))),fill:rising?'#fffef8':color,stroke:color,'stroke-width':.8}));});}
    if(showMarkers)visible.forEach((bar,i)=>eventsInBar(events,bar,timeframe()).forEach((event,offset)=>{
      const px=x(i),py=event.type==='early'?Math.max(11,y(bar.high)-10-offset*11):Math.min(bottom+9,y(bar.low)+11+offset*11),color=COLORS[event.type],fill=event.variant==='primary'?color:'#fffef8';
      const attrs={fill,stroke:color,'stroke-width':1.4};let mark;
      if(event.type==='early')mark=svgEl('path',{...attrs,d:`M${px},${py-5} L${px-5},${py+4} L${px+5},${py+4} Z`});
      else if(event.type==='bottom')mark=svgEl('circle',{...attrs,cx:px,cy:py,r:4});
      else mark=svgEl('path',{...attrs,d:`M${px},${py-5} L${px-5},${py} L${px},${py+5} L${px+5},${py} Z`});
      mark.append(svgEl('title',{},`${event.date} ${NAMES[event.type]} ${event.variant==='primary'?'主燈':'副燈'}樣式，合成示範`));svg.append(mark);
    }));
    const local=Math.max(0,Math.min(visible.length-1,selected-bounds.start)),row=visible[local];svg.append(svgEl('line',{x1:x(local),x2:x(local),y1:top,y2:bottom,stroke:'#8a9c7c','stroke-dasharray':'4 4'}));svg.append(svgEl('circle',{cx:x(local),cy:y(row.close),r:3.5,fill:'#526e47',stroke:'#fffef8','stroke-width':1}));
    svg.append(svgEl('text',{x:left,y:height-7},visible[0].date));svg.append(svgEl('text',{x:right,y:height-7,'text-anchor':'end'},visible.at(-1).date));host.append(svg);
  }
  function render() {
    $('price-state').textContent=mode==='demo'?'合成價格 / 合成標記':'正式價格未接通';
    $('price-notice').className='price-notice'+(mode==='demo'?' synthetic':'');
    $('price-notice').textContent=mode==='demo'?'全圖為合成示範：SPY／QQQ 代號、日期、OHLC 與主／副燈標記只用來測試介面，不是這些 ETF 的真實走勢，也不是原站訊號。':'尚未接通具有公開分發授權的 SPY / QQQ 價格資料。正式價格與警號皆為未知。';
    $('price-symbol-title').textContent=symbol+(mode==='demo'?' · 合成':'');$('price-timeframe').textContent=(timeframe()==='daily'?'日線':'週線')+' · '+(scale==='log'?'對數刻度':'線性刻度');
    $('price-source').textContent=mode==='demo'?'來源：本頁原創固定數學函數；沒有真實價格來源或市場擷取時間。合成週一至週五日期不代表交易日曆。主／副燈僅圖形樣式，不存在已驗證觸發、假警號或未來績效。':'來源：尚未接通。未將任何會員事件或專有回測搬入本頁。';
    $('price-visible').textContent=bars.length?`${bounds.count} 根${timeframe()==='daily'?'日':'週'} K / ${bars.length} 根 · 合成`:'尚無價格記錄';
    $('price-window').textContent=bars.length?bars[bounds.start].date+' → '+bars[bounds.end].date:'—';
    const slider=$('price-pan');slider.min=Math.max(0,bounds.count-1);slider.max=Math.max(0,bars.length-1);slider.value=Math.max(0,bounds.end);slider.disabled=!bars.length||bounds.count===bars.length;
    $('price-prev').disabled=!bars.length||bounds.start===0;$('price-next').disabled=!bars.length||bounds.end===bars.length-1;$('price-zoom-in').disabled=!bars.length||bounds.count<=12;$('price-zoom-out').disabled=!bars.length||bounds.count>=bars.length;$('price-reset').disabled=!bars.length;$('price-markers').disabled=!bars.length;
    document.querySelectorAll('[data-price-symbol]').forEach(b=>{const active=b.dataset.priceSymbol===symbol;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('[data-price-years]').forEach(b=>{const active=b.dataset.priceYears===years;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderPlot();renderDetails();
  }
  document.querySelectorAll('[data-price-symbol]').forEach(b=>b.addEventListener('click',()=>{symbol=b.dataset.priceSymbol;rebuild();}));
  document.querySelectorAll('[data-price-years]').forEach(b=>b.addEventListener('click',()=>{years=b.dataset.priceYears;rebuild();}));
  $('price-type').addEventListener('change',e=>{type=e.target.value;render();});$('price-scale').addEventListener('change',e=>{scale=e.target.value;render();});$('price-markers').addEventListener('change',e=>{showMarkers=e.target.checked;render();});
  $('price-zoom-in').addEventListener('click',()=>zoom(.7));$('price-zoom-out').addEventListener('click',()=>zoom(1/.7));$('price-prev').addEventListener('click',()=>pan(-1));$('price-next').addEventListener('click',()=>pan(1));$('price-reset').addEventListener('click',()=>{bounds=windowBounds(bars.length,bars.length);selected=bounds.end;render();});$('price-pan').addEventListener('input',e=>setWindow(bounds.count,Number(e.target.value)));
  function indexAt(clientX){const rect=host.getBoundingClientRect();return barIndexAt(clientX-rect.left,rect.width,chartWidth,bounds.start,bounds.count);}
  host.addEventListener('pointerdown',e=>{if(!bars.length||e.button!==0)return;drag={x:e.clientX,end:bounds.end,moved:false};if(host.setPointerCapture)host.setPointerCapture(e.pointerId);});
  host.addEventListener('pointermove',e=>{if(!drag)return;const delta=e.clientX-drag.x;if(Math.abs(delta)>5)drag.moved=true;if(drag.moved){const renderedWidth=host.getBoundingClientRect().width||chartWidth;const movement=Math.round(delta/renderedWidth*chartWidth/Math.max(1,chartWidth-62)*bounds.count);setWindow(bounds.count,drag.end-movement);}});
  host.addEventListener('pointerup',e=>{if(!drag)return;const moved=drag.moved;drag=null;if(!moved)select(indexAt(e.clientX));if(host.hasPointerCapture?.(e.pointerId))host.releasePointerCapture(e.pointerId);});host.addEventListener('pointercancel',()=>{drag=null;});
  host.addEventListener('wheel',e=>{if(!e.altKey||!bars.length)return;e.preventDefault();zoom(e.deltaY<0?.8:1.25);},{passive:false});
  host.addEventListener('keydown',e=>{if(!bars.length)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=selected+(e.key==='ArrowLeft'?-1:1);if(next<bounds.start)pan(-1);else if(next>bounds.end)pan(1);select(next);}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.7);}else if(e.key==='-'){e.preventDefault();zoom(1/.7);}else if(e.key==='Home'){e.preventDefault();select(bounds.start);}else if(e.key==='End'){e.preventDefault();select(bounds.end);}});
  window.addEventListener('resize',renderPlot);render();
  return {setMode(next){const requested=next==='demo'?'demo':'real';if(requested!==mode){mode=requested;rebuild();}}};
}
