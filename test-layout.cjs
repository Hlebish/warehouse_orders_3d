const assert=require('node:assert/strict');const {cells,search,normalizeAddress}=require('./layout.js');
assert.equal(cells.length,450);assert.equal(new Set(cells.map(c=>c.id)).size,450);
assert.equal(cells.filter(c=>c.street==='S1').length,50);
for(let n=2;n<=5;n++)assert.equal(cells.filter(c=>c.street==='S'+n).length,100);
assert.equal(search('S3, K7')[0].id,'S3-K-7');assert.equal(search('S3-K-7')[0].id,'S3-K-7');assert.equal(search('S3 K7')[0].id,'S3-K-7');assert.equal(search('S1-K-7').length,0);assert.equal(search('S3-I-7').length,0);assert.equal(search('DEMO-003').length,2);assert.equal(normalizeAddress('s5,a10'),'S5-A-10');console.log('OK: 450 уникальных адресов, поиск и ограничения S1.');

const {points,route}=require('./layout.js');assert.equal(points.length,7);for(const point of points)for(const cell of cells){const p=route(point,cell);assert.deepEqual(p[0],{x:point.x,z:point.z});assert.equal(p.at(-1).z,cell.z);for(let i=1;i<p.length;i++){assert(p[i].x===p[i-1].x||p[i].z===p[i-1].z);if(p[i].x!==p[i-1].x)assert.equal(p[i].z,3);}}console.log('OK: 3150 маршрутов');
