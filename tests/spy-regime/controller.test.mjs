import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {demoRows} from "../../public/investment/spy-regime/chart-data.mjs";

class El {
  constructor(id="") {
    this.id=id; this.children=[]; this.dataset={}; this.attrs={}; this.handlers={};
    this.files=[]; this.textContent=""; this.value=""; this.hidden=false;
    this.clientWidth=382;
  }
  addEventListener(name,action){this.handlers[name]=action;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  removeAttribute(k){delete this.attrs[k];}
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;}
  getBoundingClientRect(){return {left:0,width:this.clientWidth};}
  dispatch(type,options={}){return this.handlers[type]?.({currentTarget:this,preventDefault(){},...options});}
}
const elements=new Map();
const get=id=>{
  if(!elements.has(id))elements.set(id,new El(id));
  return elements.get(id);
};
globalThis.document={
  getElementById:get, createElement:tag=>new El(tag), createElementNS:(_ns,tag)=>new El(tag)
};
globalThis.ResizeObserver=class{observe(){}};
globalThis.SpyRegimeModel=createRequire(import.meta.url)("../../public/investment/spy-regime/regime-model.js");
get("cutoff");
await import("../../public/investment/spy-regime/app.mjs");

test("UI controller renders and resets 2 panels and makes a local CSV usable",async()=>{
  const svg=get("chart-svg"), f=get("csv-file");
  assert.equal(svg.children.length,0);
  get("demo-button").dispatch("click");
  assert.equal(get("status-badge").dataset.mode,"demo");
  assert.match(get("data-as-of").textContent,/非真實 SPY/);
  assert.equal(get("week-slider").max,51);
  assert.equal(get("week-table").children.length,12);
  assert.equal(svg.children.filter(c=>c.id==="path" && c.attrs.class==="price-line").length,2);
  assert.equal(svg.children.filter(c=>c.id==="path" && /^[a-z]+-line$/.test(c.attrs.class) && c.attrs.class!=="price-line").length,2);
  assert.equal(svg.children.filter(c=>c.id==="text" && /endpoint/.test(c.attrs.class)).length,2);
  const latest=get("week-caption").textContent;
  const slider=get("week-slider");
  slider.value=0; slider.dispatch("input");
  assert.notEqual(get("week-caption").textContent,latest);
  get("annotations").dispatch("change");
  get("clear-button").dispatch("click");
  assert.equal(get("results").hidden,true);
  assert.equal(svg.children.length,0);
  assert.equal(get("metric-price").textContent,"—");
  assert.equal(get("week-slider").attrs["aria-valuetext"],undefined);

  f.files=[{size:80,text:async()=>"Date,Close\n2025-01-03,500"}];
  await get("data-form").dispatch("submit");
  assert.equal(get("form-status").dataset.error,true);
  assert.equal(get("results").hidden,true);
  f.files=[{size:50000,text:async()=>"Date,Adj Close\n"+demoRows().map(r=>r.weekEnd+","+r.spyClose).join("\n")}];
  await get("data-form").dispatch("submit");
  assert.equal(get("status-badge").dataset.mode,"local");
  assert.match(get("data-as-of").textContent,/週五標籤/);
  assert.match(get("form-status").textContent,/未上傳/);
  get("range-mode").value="all"; get("range-mode").dispatch("change");
  assert.equal(get("week-slider").max,284);
  assert.equal(svg.children.some(x=>Object.values(x.attrs).some(v=>v.includes("NaN"))),false);

  // A pending file read must not repopulate a chart the user clears.
  let finish;
  f.files=[{size:30,text:()=>new Promise(resolve=>{finish=resolve;})}];
  const wait=get("data-form").dispatch("submit");
  get("clear-button").dispatch("click");
  finish("Date,Close\n2025-01-03,500"); await wait;
  assert.equal(get("status-badge").dataset.mode,"empty");
  assert.equal(get("form-status").dataset.error,false);
});
