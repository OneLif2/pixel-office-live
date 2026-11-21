const {test}=require("node:test");
const assert=require("node:assert/strict");
const {run,parseCsv,twoWeek}=require("../../public/investment/spy-regime/regime-model.js");
const rows=(n)=>{
  let price=100, random=47;
  return Array.from({length:n},(_,i)=>{
    random=(1664525*random+1013904223)>>>0;
    price*=Math.exp((i%48<12?-.045:.014)+(random/2**32-.5)*.025);
    return {weekEnd:new Date(Date.UTC(2018,0,5+7*i)).toISOString().slice(0,10),spyClose:price};
  });
};
test("two-week endpoint is matrix square, not probability of any switch",()=>{
  const r=twoWeek(.05,.30);
  assert.ok(Math.abs(r.zeroToOne-.0825)<1e-14);
  assert.ok(Math.abs(r.oneToZero-.495)<1e-14);
  assert.equal(twoWeek(1,1).zeroToOne,0);
  assert.throws(()=>twoWeek(-.4,.3));
});
test("prefix invariant and only previous week can train the transition model",()=>{
  const x=rows(360);
  const all=run(x);
  assert.deepEqual(all.slice(0,292),run(x.slice(0,292)));
  assert.ok(all.slice(0,157).every(r=>r.regime===null));
  assert.ok(all.slice(157).every(r=>r.refitWeek<r.weekEnd &&
    [r.bullToBear2w,r.bearToBull2w,r.bullProbability].every(p=>p>=0 && p<=1)));
  assert.ok(all.some(r=>r.regime==="bear"));
  assert.ok(all.some(r=>r.regime==="bull"));
  assert.equal(all[157].bearToBull2w,all[160].bearToBull2w);
  assert.notEqual(all[157].refitWeek,all[161].refitWeek);
});
test("constant input is unclassified, and missing or duplicate weeks fail closed",()=>{
  const x=rows(180);
  assert.ok(run(x.map(r=>({...r,spyClose:100}))).every(r=>r.bullProbability===null));
  assert.throws(()=>run(x.slice(0,150)),/158/);
  assert.throws(()=>run(x.filter((r,i)=>i!==160)),/consecutive/);
  assert.throws(()=>run([...x.slice(0,160),x[159],...x.slice(160)]),/consecutive/);
});
test("CSV accepts adjusted close only, holiday dates, newest first and cutoff",()=>{
  assert.deepEqual(parseCsv('\uFEFF"Date","Adj Close"\r\n"2026-11-27",102\r\n2026-11-20,101\n2026-11-12,100','2026-11-20'),[
    {weekEnd:"2026-11-13",spyClose:100},{weekEnd:"2026-11-20",spyClose:101}
  ]);
  assert.throws(()=>parseCsv("Date,Close\n2026-11-20,1","2026-11-20"),/Required/);
  assert.throws(()=>parseCsv("Date,Adj Close\n2026-02-30,1","2026-11-20"),/Invalid date/);
  assert.throws(()=>parseCsv("Date,Adj Close\n2026-11-20,,2","2026-11-20"),/column/);
});
