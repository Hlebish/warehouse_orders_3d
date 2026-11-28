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
assert.equal(e.index(s).size,22);assert.deepEqual(e.pick(s,[],'S3-B-1'),['S3-A-1','S3-B-1']);
assert.equal(e.apply(s,['S3-B-1'],'wing'),null);
assert.deepEqual(e.apply(s,['S3-B-1','S3-A-1'],'default'),[]);
assert.deepEqual(e.validate([{ids:['bogus'],model:'wing'},{ids:['S1-A-1','S1-B-1'],model:'wing'},{ids:['S1-A-1'],model:'__proto__'}]),[]);
assert.equal(e.validate([...s,...s]).length,1);
for(const c of cells){
 const wing=e.apply([], [c.id],'wing');if(c.levelSpan===2){assert.equal(wing,null);assert(e.apply([], [c.id],'hood'));continue;}assert(wing);const b=e.bounds(wing[0]);assert.equal(b.cells.length,1);
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
assert.equal(cells.length,430);
console.log('Reference shelf models and editor passed');

for(const model of ['wing','hood','piston']){
 const b=e.bounds(e.apply([],model==='hood'?['S3-A-1','S3-B-1']:['S3-A-1'],model)[0]);
 let boxes=[],quads=0;
 drawShelf((...v)=>boxes.push(v),()=>quads++,b,model,1,'53677a',false);
 assert.equal(quads,0);
 const stock=boxes.filter(v=>['126d83','197f92','1d7183','268b9a'].includes(v[6]));
 if(model==='piston'){
  assert(stock.length>50);
  const full=[];drawShelf((...v)=>full.push(v),()=>{},b,model,1,'53677a',true);
  assert.deepEqual(boxes,full);
 }else{assert.equal(boxes.length,9);assert.equal(stock.length,0);}
 assert(!boxes.some(v=>v[6]==='6bb58b'));
}

const {packingPlan}=require('./shelf-models.js');
const layouts={wing:new Set(),hood:new Set()};
for(const c of cells)for(const model of ['wing','hood']){
 const above=e.neighbor(c.id,1);
 if(model==='hood'&&!above&&c.levelSpan!==2||model==='wing'&&c.levelSpan===2)continue;
 const b=e.bounds(e.apply([],model==='hood'&&c.levelSpan!==2?[c.id,above]:[c.id],model)[0]);
 const plan=packingPlan(b,model);
 assert.deepEqual(plan,packingPlan(b,model));
 assert.equal(new Set(plan.map(p=>p.variant)).size,3);
 assert(plan.length>=(model==='wing'?4:3)&&plan.length<=(model==='wing'?6:4));
 layouts[model].add(JSON.stringify(plan.map(p=>p.variant)));
 for(let i=1;i<plan.length;i++){
  const a=plan[i-1],v=plan[i];
  assert(v.z-a.z>(v.depth+a.depth)/2);
 }
 // Validate all six silhouettes and all seeded arrangements, including
 // top/bottom levels and mirrored aisle sides.
 for(const side of [-1,1]){
  let valid=true;
  drawShelf(()=>{},pts=>{for(const p of pts)if(!p.every(Number.isFinite)||p[1]<b.base-.001||p[1]>b.top+.001||Math.abs(p[0]-b.x)>b.w/2+.001||Math.abs(p[2]-b.z)>b.d/2+.001)valid=false;},b,model,side,'53677a');
  assert(valid);
 }
}
assert(layouts.wing.size>12);assert(layouts.hood.size>6);
assert.deepEqual(packingPlan(e.bounds(e.apply([],['S3-A-1'],'piston')[0]),'piston'),[]);

// Empty piston landmarks must not imply an occupied address; other models remain conditional.
const {applyInventory,cellTone}=require('./layout.js');
applyInventory(null);
const pc=cells.find(c=>c.id==='S3-A-1');assert.equal(pc.items.length,0);assert.equal(cellTone(pc,true,false,false),'53677a');
for(const model of ['wing','hood','piston']){
 const b=e.bounds(e.apply([],model==='hood'?['S3-A-1','S3-B-1']:['S3-A-1'],model)[0]);
 const mesh=flag=>{let boxes=0,quads=0;drawShelf(()=>boxes++,()=>quads++,b,model,1,'53677a',flag);return {boxes,quads};};
 if(model==='piston')assert.deepEqual(mesh(false),mesh(true));else{assert.equal(mesh(false).quads,0);assert(mesh(true).quads>0);}
}

for(let n=4;n<=10;n++){
 const a='S1-A-'+n,b='S1-B-'+n,d='S1-D-'+n;
 assert.equal(e.index([]).get(a).model,'hood');
 assert.equal(e.canUse([a],'hood'),true);assert.equal(e.canUse([a],'wing'),false);assert.equal(e.canUse([a],'piston'),false);
 assert.equal(e.extend([],[a],1),null);assert.equal(e.extend([],[b],-1),null);assert.equal(e.neighbor(d,1),null);
 assert.deepEqual(e.validate([{ids:[a,b],model:'hood'}]),[{ids:[a],model:'hood'}]);
 assert.deepEqual(e.validate([{ids:['S1-E-'+n],model:'wing'}]),[]);
 const bounds=e.bounds(e.index([]).get(a));assert(Math.abs(bounds.h-1.64)<1e-8);
 let visible=0;drawShelf(()=>{},pts=>{assert(pts.every(p=>p[1]>=bounds.base-.001&&p[1]<=bounds.top+.001));visible++;},bounds,'hood',-1,'53677a',true);assert(visible>0);
}
for(let n=1;n<=3;n++){
 const a='S1-A-'+n,b='S1-B-'+n;
 assert(!e.index([]).has(a));assert.equal(e.canUse([a],'wing'),true);assert.equal(e.canUse([a],'hood'),false);
 assert.deepEqual(e.validate([{ids:[a,b],model:'hood'}]),[{ids:[a,b],model:'hood'}]);
 assert.equal(e.neighbor('S1-D-'+n,1),'S1-E-'+n);
}

for(let n=1;n<=10;n++){
 const a='S5-A-'+n,b='S5-B-'+n,d='S5-D-'+n;
 assert.equal(e.index([]).get(a).model,'hood');assert.equal(e.canUse([a],'hood'),true);assert.equal(e.canUse([a],'wing'),false);assert.equal(e.canUse([a],'piston'),false);
 assert.equal(e.extend([],[a],1),null);assert.equal(e.extend([],[b],-1),null);assert.equal(e.neighbor(d,1),null);
 assert.deepEqual(e.validate([{ids:[a,b],model:'hood'}]),[{ids:[a],model:'hood'}]);
 assert.deepEqual(e.validate([{ids:['S5-E-'+n],model:'wing'}]),[]);
 const bounds=e.bounds(e.index([]).get(a));assert(Math.abs(bounds.h-1.64)<1e-8);
 assert.equal(e.neighbor('S5-J-'+n,1),'S5-K-'+n);
 assert(e.canUse(['S5-F-'+n],'wing'));
}

 // Bumper assignment, persistence and geometry on all single-height addresses.
 for(const c of cells){
  const entry=e.apply([],[c.id],'bumper');
  if(c.levelSpan===2){assert.equal(entry,null);continue;}
  assert.deepEqual(e.validate(JSON.parse(JSON.stringify(entry))),entry);
  const b=e.bounds(entry[0]);
  for(const side of [-1,1]){
   const snapshot=flag=>{const boxes=[],quads=[];drawShelf((...v)=>boxes.push(v),(...v)=>quads.push(v),b,'bumper',side,'53677a',flag);return {boxes,quads};};
   const empty=snapshot(false),full=snapshot(true);
   assert.equal(empty.boxes.length,9);assert.equal(empty.quads.length,0);
   assert.equal(full.quads.length,4*(8*8+6+4));assert.deepEqual(full,snapshot(true));
   const groups=Array.from({length:4},(_,i)=>full.quads.slice(i*74,(i+1)*74).flatMap(q=>q[0]));
   for(let i=0;i<groups.length;i++){
    const points=groups[i];
    assert(points.every(p=>p.every(Number.isFinite)&&p[1]>=b.base-.001&&p[1]<=b.top+.001&&Math.abs(p[0]-b.x)<=b.w/2+.001&&Math.abs(p[2]-b.z)<=b.d/2+.001));
    if(i)assert(Math.max(...groups[i-1].map(p=>p[2]))<Math.min(...points.map(p=>p[2])));
   }
  }
 }
 assert.equal(e.apply([],['S3-A-1','S3-B-1'],'bumper'),null);

for(let n=1;n<=3;n++){
 const f='S4-F-'+n,g='S4-G-'+n,j='S4-J-'+n;
 assert.equal(e.index([]).get(f).model,'hood');
 assert(e.canUse([f],'hood'));assert(!e.canUse([f],'wing'));assert(!e.canUse([f],'piston'));assert(!e.canUse([f],'bumper'));
 assert.equal(e.extend([],[f],1),null);assert.equal(e.extend([],[g],-1),null);assert.equal(e.neighbor(j,1),null);
 for(const model of ['hood','shelf'])assert.deepEqual(e.validate([{ids:[f,g],model}]),[{ids:[f],model}]);
 assert.deepEqual(e.validate([{ids:['S4-K-'+n],model:'wing'}]),[]);
 const b=e.bounds(e.index([]).get(f));assert(Math.abs(b.h-1.64)<1e-8);
 for(const side of [-1,1]){
  let quads=0;drawShelf(()=>{},pts=>{assert(pts.every(p=>p[1]>=b.base-.001&&p[1]<=b.top+.001));quads++;},b,'hood',side,'53677a',true);assert(quads>0);
 }
}
for(let n=4;n<=10;n++){
 const f='S4-F-'+n,g='S4-G-'+n;assert(!e.index([]).has(f));assert(e.canUse([f],'wing'));assert(e.canUse([f],'bumper'));assert(!e.canUse([f],'hood'));
 assert.deepEqual(e.validate([{ids:[f,g],model:'hood'}]),[{ids:[f,g],model:'hood'}]);assert.equal(e.neighbor('S4-J-'+n,1),'S4-K-'+n);
}
