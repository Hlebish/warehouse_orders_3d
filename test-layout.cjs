const assert=require('node:assert/strict');const {cells,search,normalizeAddress}=require('./layout.js');
assert.equal(cells.length,450);assert.equal(new Set(cells.map(c=>c.id)).size,450);
assert.equal(cells.filter(c=>c.street==='S1').length,50);
for(let n=2;n<=5;n++)assert.equal(cells.filter(c=>c.street==='S'+n).length,100);
assert.equal(search('S3, K7')[0].id,'S3-K-7');assert.equal(search('S3-K-7')[0].id,'S3-K-7');assert.equal(search('S3 K7')[0].id,'S3-K-7');assert.equal(search('S1-K-7').length,0);assert.equal(search('S3-I-7').length,0);assert.equal(search('DEMO-003').length,2);assert.equal(normalizeAddress('s5,a10'),'S5-A-10');console.log('OK: 450 уникальных адресов, поиск и ограничения S1.');
