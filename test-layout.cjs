const assert=require('node:assert/strict');const {cells,search,normalizeAddress}=require('./layout.js');
assert.equal(cells.length,450);assert.equal(new Set(cells.map(c=>c.id)).size,450);
assert.equal(cells.filter(c=>c.street==='S1').length,50);
for(let n=2;n<=5;n++)assert.equal(cells.filter(c=>c.street==='S'+n).length,100);
assert.equal(search('S3, K7')[0].id,'S3-K-7');assert.equal(search('S3-K-7')[0].id,'S3-K-7');assert.equal(search('S3 K7')[0].id,'S3-K-7');assert.equal(search('S1-K-7').length,0);assert.equal(search('S3-I-7').length,0);assert.equal(search('DEMO-003').length,0);assert.equal(normalizeAddress('s5,a10'),'S5-A-10');console.log('OK: 450 уникальных адресов, поиск и ограничения S1.');

const {points,route}=require('./layout.js');assert.equal(points.length,7);for(const point of points)for(const cell of cells){const p=route(point,cell);assert.deepEqual(p[0],{x:point.x,z:point.z});assert.equal(p.at(-1).z,cell.z);for(let i=1;i<p.length;i++){assert(p[i].x===p[i-1].x||p[i].z===p[i-1].z);if(p[i].x!==p[i-1].x)assert.equal(p[i].z,3);}}console.log('OK: 3150 маршрутов');

const {blockers,key,sections}=require('./layout.js');assert.equal(sections.length,18);const target=search('S3, F5')[0];assert.equal(blockers([target.x-1.5,target.y,target.z],target).length,0);assert(blockers([-14,target.y,target.z],target).length>0);const lower=search('S3,A5')[0];assert(blockers([lower.x,15,lower.z],lower).includes(key(lower)));assert.deepEqual(blockers([0,10,0],null),[]);console.log('OK: occlusion');

const {racks,streets,RACK_WIDTH,AISLE_WIDTH}=require('./layout.js');
const sorted=[...racks].sort((a,b)=>a.x-b.x);let paired=0;for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];if(a.street!==b.street){assert(Math.abs(b.x-a.x-RACK_WIDTH)<1e-8);paired++;}else{assert(Math.abs(b.x-a.x-RACK_WIDTH-AISLE_WIDTH)<1e-8);}}assert.equal(paired,4);assert(AISLE_WIDTH>2.36);console.log('OK: 4 пары вплотную, широкие проходы');

const {applyInventory}=require('./layout.js');const inventory={S1:{A:{2:'Тестовая деталь AP MZ 1402 C\nКапот'},K:{7:'Недопустимая ячейка'}},S3:{K:{7:'APMZ1402C Бампер'}},S5:{F:{9:'  '}}};assert.deepEqual(applyInventory(inventory),{occupied:2,lines:3,total:450});assert.equal(search('APMZ1402C').length,2);assert.equal(search('капот')[0].id,'S1-A-2');assert.deepEqual(search('S3,K7')[0].items,['APMZ1402C Бампер']);assert.deepEqual(applyInventory({S3:{K:{7:'Новый товар'}}}),{occupied:1,lines:1,total:450});assert.equal(search('APMZ1402C').length,0);assert.equal(search('Новый товар')[0].id,'S3-K-7');assert.equal(applyInventory(null).occupied,0);assert.equal(search('Новый товар').length,0);console.log('OK: inventory update and clearing');
