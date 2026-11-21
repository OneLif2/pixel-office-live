import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
import test from "node:test";
import {annotationRows,bandSegments,cutoffLimits,demoRows,displayRows,priceDomain,probability,stampFor}
  from "../../public/investment/spy-regime/chart-data.mjs";

const require = createRequire(import.meta.url);
const engine = require("../../public/investment/spy-regime/regime-model.js");
const date = n=>new Date(Date.UTC(2025,0,3)+n*7*86400000).toISOString().slice(0,10);
const row = (n,price,red=.4,green=.5,regime=null)=>({weekEnd:date(n),spyClose:price,bullToBear2w:red,bearToBull2w:green,regime});

test("the cutoff is based on New York dates, not UTC/HKT or a fixed DST offset",()=>{
  assert.deepEqual(cutoffLimits(new Date("2026-11-23T03:00:00Z")),{maximum:"2026-11-21",defaultDate:"2026-11-13"});
  assert.deepEqual(cutoffLimits(new Date("2026-11-23T06:00:00Z")),{maximum:"2026-11-22",defaultDate:"2026-11-20"});
  assert.deepEqual(cutoffLimits(new Date("2026-07-06T04:05:00Z")),{maximum:"2026-07-05",defaultDate:"2026-07-03"});
});
test("latest 52 positions end on the last observation and unspecified range can show all",()=>{
  const demo=demoRows(), view=displayRows(demo,"52");
  assert.equal(view.length,52); assert.equal(view.at(-1),demo.at(-1));
  assert.deepEqual(displayRows(demo,"all"),demo);
  assert.notEqual(displayRows(demo,"all"),demo);
});
test("both explicitly requested green divergences are available without using the price axis",()=>{
  const rising=[row(0,100,.4,.6),row(1,101),row(2,103),row(3,106),row(4,111,.5,.3)];
  const falling=[row(0,100,.4,.3),row(1,99),row(2,96),row(3,93),row(4,90,.35,.5)];
  assert.ok(annotationRows(rising)[4].includes("diverge-green-falls"));
  assert.ok(annotationRows(rising)[4].includes("diverge-down"));
  assert.ok(annotationRows(falling)[4].includes("diverge-up"));
  assert.ok(!annotationRows(falling)[4].includes("diverge-green-falls"));
});
test("line-order changes only count on valid weeks; touching or gap does not count by itself",()=>{
  const rows=[row(0,100,.4,.6),row(1,101,.5,.5),row(2,100,.6,.4),row(3,100,null,null),row(4,100,.4,.6),row(6,100,.6,.4)];
  assert.deepEqual(annotationRows(rows).map(a=>a.includes("cross")),[false,false,true,false,false,false]);
  const gap=[row(0,100,.4,.6),row(1,101),row(2,103),row(4,106),row(5,111,.65,.3)];
  assert.ok(!annotationRows(gap)[4].some(a=>a.startsWith("diverge")));
});
test("regime shading starts on its confirmed observation and breaks at uncertainty and gaps",()=>{
  const Rs=["bull","bull","uncertain","bear",null,"bull"];
  const rows=Rs.map((r,i)=>row(i===5?6:i,100,.4,.6,r));
  assert.deepEqual(bandSegments(rows),[{start:0,end:2,regime:"bull"},{start:3,end:4,regime:"bear"},{start:5,end:6,regime:"bull"}]);
});
test("null never becomes a probability; model and both synthetic chart lines integrate",()=>{
  for(const invalid of [null,undefined,NaN,"0",Infinity,-.1,1.1]) assert.equal(probability(invalid),false);
  assert.equal(probability(0),true);
  const fitted=engine.run(demoRows()), recent=displayRows(fitted,"52");
  assert.equal(fitted[156].regime,null);
  assert.ok(recent.filter(r=>probability(r.bullToBear2w)&&probability(r.bearToBull2w)).length>=45);
  assert.ok(recent.every(r=>["bull","bear","uncertain",null].includes(r.regime)));
  assert.equal(Number.isNaN(stampFor("2026-02-30")),true);
  assert.ok(priceDomain(recent).min>0);
});
test("page integrates with the existing sidebar and only browser-local data handling",()=>{
  const html = readFileSync(new URL("../../public/investment/spy-regime/index.html",import.meta.url),"utf8");
  const js = readFileSync(new URL("../../public/investment/spy-regime/app.mjs",import.meta.url),"utf8");
  const index = readFileSync(new URL("../../public/investment/index.html",import.meta.url),"utf8");
  const monitor = readFileSync(new URL("../../public/investment/market-monitor/index.html",import.meta.url),"utf8");
  assert.match(html,/connect-src 'none'; form-action 'none'/);
  assert.doesNotMatch(js,/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|WebSocket)\b/);
  assert.match(html,/selected>最近 52 週/);
  assert.match(html,/尚未載入資料/);
  assert.match(index,/href="spy-regime\/"/);
  assert.match(monitor,/href="\.\.\/spy-regime\/"/);
  assert.match(html,/A²/);
  assert.match(html,/Hamilton/);
});
