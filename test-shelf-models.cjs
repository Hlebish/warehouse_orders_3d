const assert=require('node:assert/strict');
const {cells}=require('./layout.js');
const {createShelfEditor,drawShelf}=require('./shelf-models.js');
const e=createShelfEditor(cells);
assert.equal(e.neighbor('S3-H-7',1),'S3-J-7');
assert.equal(e.neighbor('S1-E-1',1),null);
assert.equal(e.neighbor('S3-F-7',-1),null);
let s=e.apply([],['S3-A-1'],'wing');assert.equal(s.length,1);
assert.equal(e.apply(s,['S3-A-1'],'hood'),null);
assert.equal(e.apply(s,['S3-A-1','S3-C-1'],'shelf'),null);
assert.equal(e.apply(s,['S3-A-1','S3-B-2'],'hood'),null);
assert.equal(e.apply(s,['S3-E-1','S3-F-1'],'hood'),null);
assert.equal(e.apply(s,['S3-A-1','S4-B-1'],'hood'),null);
assert.deepEqual(e.extend(s,['S3-A-1'],1),['S3-A-1','S3-B-1']);
s=e.apply(s,['S3-B-1','S3-A-1'],'hood');assert.deepEqual(s,[{ids:['S3-A-1','S3-B-1'],model:'hood'}]);
assert.equal(e.index(s).size,2);assert.deepEqual(e.pick(s,[],'S3-B-1'),['S3-A-1','S3-B-1']);
assert.equal(e.apply(s,['S3-B-1'],'wing'),null);
assert.deepEqual(e.apply(s,['S3-B-1','S3-A-1'],'default'),[]);
assert.deepEqual(e.validate([{ids:['bogus'],model:'wing'},{ids:['S1-A-1','S1-B-1'],model:'wing'},{ids:['S1-A-1'],model:'__proto__'}]),[]);
assert.equal(e.validate([...s,...s]).length,1);
for(const c of cells){
 const wing=e.apply([], [c.id],'wing');assert(wing);const b=e.bounds(wing[0]);assert.equal(b.cells.length,1);
 const above=e.neighbor(c.id,1);if(above){const pair=e.apply([], [c.id,above],'hood');assert(pair);const bb=e.bounds(pair[0]);assert(Math.abs(bb.h-1.64)<1e-8);}
}

assert.equal(e.apply([],['S3-A-1'],'piston')[0].model,'piston');
assert.equal(e.apply([],['S3-A-1','S3-B-1'],'piston'),null);
for(const model of ['wing','hood','piston','shelf'])for(const side of [-1,1]){
 const ids=model==='hood'?['S3-A-1','S3-B-1']:['S3-A-1'];
 const b=e.bounds(e.apply([],ids,model)[0]);const boxes=[],points=[];
 drawShelf((...v)=>boxes.push(v),(p)=>{assert.equal(p.length,4);points.push(...p);},b,model,side,'f5ca63');
 for(const [x,y,z,w,h,d] of boxes){
  assert([x,y,z,w,h,d].every(Number.isFinite));assert(w>0&&h>0&&d>0);
  assert(Math.abs(x-b.x)+w/2<=b.w/2+.001);
  assert(y-h/2>=b.base-.001&&y+h/2<=b.top+.001);
  assert(Math.abs(z-b.z)+d/2<=b.d/2+.001);
 }
 assert(points.every(p=>p.every(Number.isFinite)&&p[1]>=b.base-.001&&p[1]<=b.top+.001&&Math.abs(p[0]-b.x)<=b.w/2+.001&&Math.abs(p[2]-b.z)<=b.d/2+.001));
 if(model==='wing'||model==='hood'){
  assert(points.length>120);
  const span=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
  assert(span>(model==='wing'?.50:1.40));
 }else assert.equal(points.length,0);
 if(model==='piston'){const stock=boxes.filter(v=>['126d83','197f92','1d7183','268b9a'].includes(v[6]));assert(stock.length>50);assert(new Set(stock.map(v=>v[2])).size===5);assert(new Set(stock.map(v=>v[1])).size===6);}
}
assert.equal(cells.length,450);
console.log('Reference shelf models and editor passed');

for(const model of ['wing','hood','piston']){
 const b=e.bounds(e.apply([],model==='hood'?['S3-A-1','S3-B-1']:['S3-A-1'],model)[0]);
 let boxes=[],quads=0;
 drawShelf((...v)=>boxes.push(v),()=>quads++,b,model,1,'53677a',false);
 assert.equal(quads,0);assert.equal(boxes.length,9);assert(!boxes.some(v=>['126d83','197f92','1d7183','268b9a','6bb58b'].includes(v[6])));
}
