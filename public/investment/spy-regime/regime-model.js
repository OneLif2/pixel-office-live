(function (root) {
  "use strict";
  const DAY = 86400000;
  const WINDOW = 156;
  const REFIT = 4;
  const FLOOR = 1e-6;
  const SQRT_2PI = Math.sqrt(2 * Math.PI);

  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Expected date YYYY-MM-DD");
    const ms = Date.parse(value + "T00:00:00Z");
    if (!Number.isFinite(ms) || iso(ms) !== value) throw new Error("Invalid date: " + value);
    return ms;
  }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }

  function csvFields(line) {
    if (!/^(?:"(?:[^"]|"")*"|[^",]*)(?:,(?:"(?:[^"]|"")*"|[^",]*))*$/.test(line)) {
      throw new Error("Malformed CSV row");
    }
    return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map(v => v.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"'));
  }

  // Input is one row per completed US trading week. Holiday-shortened weeks
  // may use their actual closing date; rows are normalized to Friday labels.
  function parseCsv(csv, cutoffDate) {
    const cutoff = day(cutoffDate);
    const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if (lines.length < 2 || lines.length > 3000) throw new Error("Expected 1–2999 weekly CSV rows");
    const keys = csvFields(lines[0]).map(s=>s.toLowerCase().replace(/[^a-z]/g,""));
    const di = keys.findIndex(s=>s==="date" || s==="weekend");
    const ci = keys.findIndex(s=>s==="adjclose" || s==="adjustedclose");
    if (di < 0 || ci < 0) throw new Error("Required CSV columns: Date, Adj Close");
    return lines.slice(1).flatMap(line => {
      const cells = csvFields(line);
      if (cells.length !== keys.length) throw new Error("CSV column count differs from header");
      const date = day(cells[di]);
      const dow = new Date(date).getUTCDay();
      if (dow < 1 || dow > 5) throw new Error("Week close must be a weekday");
      const friday = date + (5-dow)*DAY;
      if (friday > cutoff) return [];
      const close = Number(cells[ci]);
      if (!/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(cells[ci]) || !Number.isFinite(close) || close <= 0) {
        throw new Error("Invalid adjusted close: " + cells[di]);
      }
      return [{weekEnd: iso(friday), spyClose: close}];
    }).sort((a,b)=>a.weekEnd.localeCompare(b.weekEnd));
  }

  function emission(x, m, v) {
    const z = x - m;
    return Math.max(1e-100, Math.exp(-z*z/(2*v))/(SQRT_2PI*Math.sqrt(v)));
  }
  function stationary(a,b) { return b/(a+b); }

  // a=P(0→1), b=P(1→0). Return scaled alphas for the training sample.
  function filter(xs, p) {
    const n = xs.length, f = new Float64Array(n), g = new Float64Array(n);
    const q = new Float64Array(n), e0 = new Float64Array(n), e1 = new Float64Array(n);
    let prior = stationary(p.a,p.b), logL = 0;
    for (let t=0;t<n;t++) {
      e0[t]=emission(xs[t],p.m0,p.v0); e1[t]=emission(xs[t],p.m1,p.v1);
      q[t]=prior*e0[t]+(1-prior)*e1[t];
      f[t]=prior*e0[t]/q[t]; g[t]=1-f[t];
      logL+=Math.log(q[t]);
      prior=f[t]*(1-p.a)+g[t]*p.b;
    }
    return {f,g,q,e0,e1,logL};
  }

  function fit(xs) {
    const n=xs.length, sorted=Array.from(xs).sort((a,b)=>a-b);
    const mean=xs.reduce((s,x)=>s+x,0)/n;
    const v=Math.max(FLOOR,xs.reduce((s,x)=>s+(x-mean)**2,0)/n);
    if (v <= FLOOR) return null;
    let best=null;
    const seeds=[
      {m0:sorted[Math.floor(n*.25)],m1:sorted[Math.floor(n*.75)],v0:v,v1:v,a:.12,b:.12},
      {m0:mean-Math.sqrt(v)*.4,m1:mean+Math.sqrt(v)*.12,v0:v*1.7,v1:v*.4,a:.20,b:.08},
      {m0:mean-Math.sqrt(v)*.7,m1:mean+Math.sqrt(v)*.35,v0:v*1.3,v1:v*.65,a:.35,b:.12}
    ];
    for (let p of seeds) {
      let prev=-Infinity;
      for (let i=0;i<45;i++) {
        const {f,g,q,e0,e1,logL}=filter(xs,p);
        if (Math.abs(logL-prev)<1e-5) break;
        prev=logL;
        let B0=1,B1=1,n0=0,n1=0,x0=0,x1=0,z0=0,z1=0,sw0=0,sw1=0,d0=0,d1=0;
        for (let t=n-1;t>=0;t--) {
          let w0=f[t]*B0,w1=g[t]*B1;
          const sum=w0+w1;
          w0/=sum; w1/=sum;
          n0+=w0; n1+=w1; x0+=w0*xs[t]; x1+=w1*xs[t];
          z0+=w0*xs[t]**2; z1+=w1*xs[t]**2;
          if (t>0) {
            const r0=e0[t]*B0/q[t], r1=e1[t]*B1/q[t];
            const next0=(1-p.a)*r0+p.a*r1, next1=p.b*r0+(1-p.b)*r1;
            const norm=f[t-1]*next0+g[t-1]*next1;
            sw0+=f[t-1]*p.a*r1/norm; sw1+=g[t-1]*p.b*r0/norm;
            d0+=f[t-1]*next0/norm; d1+=g[t-1]*next1/norm;
            B0=next0/norm; B1=next1/norm;
          }
        }
        if (Math.min(n0,n1)<5) break;
        const m0=x0/n0,m1=x1/n1;
        p={m0,m1,v0:Math.max(FLOOR,z0/n0-m0*m0),v1:Math.max(FLOOR,z1/n1-m1*m1),
          a:Math.max(.001,Math.min(.999,(sw0+.25)/(d0+.5))),
          b:Math.max(.001,Math.min(.999,(sw1+.25)/(d1+.5)))};
      }
      const model=filter(xs,p);
      if (Math.abs(p.m0-p.m1)<.0005 || Math.min(model.f.reduce((s,x)=>s+x,0),model.g.reduce((s,x)=>s+x,0))<5) continue;
      if (!best || model.logL>best.logL) best={p,alpha0:model.f[n-1],logL:model.logL};
    }
    return best;
  }

  // (A²)[i,j], conditional on the given present state, NOT first-passage.
  function twoWeek(a,b) {
    if (![a,b].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) throw new Error("Invalid transitions");
    const factor=(1-a)+(1-b);
    return {zeroToOne:a*factor,oneToZero:b*factor};
  }
  function run(input) {
    if (!Array.isArray(input) || input.length<WINDOW+2 || input.length>2999) {
      throw new Error("At least 158 consecutive completed weekly prices are required");
    }
    let last;
    const returns=[], out=[];
    let model=null,alpha0=null,refitWeek=null;
    for (const [i,row] of input.entries()) {
      const wk=day(row.weekEnd);
      if (new Date(wk).getUTCDay()!==5 || (i && wk-last!==7*DAY)) {
        throw new Error("Expected one price for every consecutive Friday-labelled week: "+row.weekEnd);
      }
      if (!Number.isFinite(row.spyClose) || row.spyClose<=0) throw new Error("Invalid positive adjusted close");
      if (i) returns.push(Math.log(row.spyClose)-Math.log(input[i-1].spyClose));
      last=wk;
      let bullToBear2w=null,bearToBull2w=null,bullProbability=null,regime=null;
      if (i>WINDOW) {
        if ((i-WINDOW-1)%REFIT===0) {
          // Fit ends at t-1; use the observation at t solely in the filter.
          model=fit(returns.slice(i-1-WINDOW,i-1));
          alpha0=model ? model.alpha0 : null;
          refitWeek=model ? input[i-1].weekEnd : null;
        }
        if (model) {
          const {a,b,m0,m1,v0,v1}=model.p, bullIsZero=m0>m1;
          const prior=alpha0*(1-a)+(1-alpha0)*b;
          const w0=prior*emission(returns[i-1],m0,v0);
          const w1=(1-prior)*emission(returns[i-1],m1,v1);
          alpha0=w0/(w0+w1);
          const p=twoWeek(a,b);
          bullToBear2w=bullIsZero?p.zeroToOne:p.oneToZero;
          bearToBull2w=bullIsZero?p.oneToZero:p.zeroToOne;
          bullProbability=bullIsZero?alpha0:1-alpha0;
          regime=bullProbability>=.60?"bull":bullProbability<=.40?"bear":"uncertain";
        }
      }
      out.push({weekEnd:row.weekEnd,spyClose:row.spyClose,bullToBear2w,bearToBull2w,bullProbability,regime,refitWeek});
    }
    return out;
  }

  const api=Object.freeze({run,parseCsv,twoWeek,window:WINDOW,refitEvery:REFIT});
  if (typeof module!=="undefined" && module.exports) module.exports=api;
  else root.SpyRegimeModel=api;
})(globalThis);
