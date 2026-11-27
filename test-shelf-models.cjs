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
for(const model of ['wing','hood','shelf']){
 const ids=model==='hood'?['S3-A-1','S3-B-1']:['S3-A-1'];
 const b=e.bounds(e.apply([],ids,model)[0]);let meshes=0;
 drawShelf((x,y,z,w,h,d)=>{assert([x,y,z,w,h,d].every(Number.isFinite));assert(w>0&&h>0&&d>0);},(pts)=>{assert.equal(pts.length,4);for(const p of pts){assert(p.every(Number.isFinite));assert(p[1]>=b.base-.001&&p[1]<=b.top+.001);assert(Math.abs(p[0]-b.x)<=b.w/2+.001);assert(Math.abs(p[2]-b.z)<=b.d/2+.001);}meshes++;},b,model,1,'f5ca63');
 assert(model==='shelf'?meshes===0:meshes>30);
}
assert.equal(cells.length,450);
console.log('Shelf editor and meshes OK');
