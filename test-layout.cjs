const assert=require('node:assert/strict');const {cells,search,normalizeAddress}=require('./layout.js');
assert.equal(cells.length,450);assert.equal(new Set(cells.map(c=>c.id)).size,450);
assert.equal(cells.filter(c=>c.street==='S1').length,50);
for(let n=2;n<=5;n++)assert.equal(cells.filter(c=>c.street==='S'+n).length,100);
assert.equal(search('S3, K7')[0].id,'S3-K-7');assert.equal(search('S3-K-7')[0].id,'S3-K-7');assert.equal(search('S3 K7')[0].id,'S3-K-7');assert.equal(search('S1-K-7').length,0);assert.equal(search('S3-I-7').length,0);assert.equal(search('DEMO-003').length,0);assert.equal(normalizeAddress('s5,a10'),'S5-A-10');console.log('OK: 450 уникальных адресов, поиск и ограничения S1.');

const {points,route}=require('./layout.js');assert.equal(points.length,7);for(const point of points)for(const cell of cells){const p=route(point,cell);assert.deepEqual(p[0],{x:point.x,z:point.z});assert.equal(p.at(-1).z,cell.z);for(let i=1;i<p.length;i++){assert(p[i].x===p[i-1].x||p[i].z===p[i-1].z);if(p[i].x!==p[i-1].x)assert.equal(p[i].z,3);}}console.log('OK: 3150 маршрутов');


const {racks,streets,RACK_WIDTH,AISLE_WIDTH}=require('./layout.js');
const sorted=[...racks].sort((a,b)=>a.x-b.x);let paired=0;for(let i=0;i<sorted.length-1;i++){const a=sorted[i],b=sorted[i+1];if(a.street!==b.street){assert(Math.abs(b.x-a.x-RACK_WIDTH)<1e-8);paired++;}else{assert(Math.abs(b.x-a.x-RACK_WIDTH-AISLE_WIDTH)<1e-8);}}assert.equal(paired,4);assert(AISLE_WIDTH>2.36);console.log('OK: 4 пары вплотную, широкие проходы');

const {applyInventory}=require('./layout.js');const inventory={S1:{A:{2:'Тестовая деталь AP MZ 1402 C\nКапот'},K:{7:'Недопустимая ячейка'}},S3:{K:{7:'APMZ1402C Бампер'}},S5:{F:{9:'  '}}};assert.deepEqual(applyInventory(inventory),{occupied:2,lines:3,total:450});assert.equal(search('APMZ1402C').length,2);assert.equal(search('капот')[0].id,'S1-A-2');assert.deepEqual(search('S3,K7')[0].items,['APMZ1402C Бампер']);assert.deepEqual(applyInventory({S3:{K:{7:'Новый товар'}}}),{occupied:1,lines:1,total:450});assert.equal(search('APMZ1402C').length,0);assert.equal(search('Новый товар')[0].id,'S3-K-7');assert.equal(applyInventory(null).occupied,0);assert.equal(search('Новый товар').length,0);console.log('OK: inventory update and clearing');

const {walkingPlan}=require('./layout.js');for(const p of points.filter(p=>streets.some(s=>s.id===p.id)))for(const c of cells){const plan=walkingPlan(p,c,route,streets);assert.deepEqual(plan[0].pose.eye,[p.x,14,p.z]);assert.deepEqual(plan[1].pose.eye,[p.x,1.68,p.z]);const last=plan.at(-1);assert.equal(last.pose.eye[0],streets.find(s=>s.id===c.street).x);assert.equal(last.pose.eye[2],c.z);assert.equal(last.phase,'arrive');for(const step of plan.filter(s=>s.phase==='walk'||s.phase==='turn'))assert.equal(step.pose.eye[1],1.68);}assert.deepEqual(walkingPlan(null,cells[0],route,streets),[]);assert.deepEqual(walkingPlan(points[0],cells[0],route,streets),[]);console.log('OK: walking routes');


const {mapLinkQuery,exactArticleMatches}=require('./layout.js');assert.deepEqual(mapLinkQuery('?cell=S1-A-2&cell=S1-K-2&cell=S3-K-7&cell=S1-A-2').addresses.map(c=>c.id),['S1-A-2','S3-K-7']);assert.equal(mapLinkQuery('?article=FP+4819+311').article,'FP 4819 311');applyInventory({S1:{A:{2:'APBM2802 Крыло',3:'APBM2802A Крыло',4:'FP 4819 311 Крыло',5:'КН3755 280 Капот'}}});assert.deepEqual(exactArticleMatches('APBM2802').map(c=>c.id),['S1-A-2']);assert.deepEqual(exactArticleMatches('FP 4819 311').map(c=>c.id),['S1-A-4']);assert.deepEqual(exactArticleMatches('КН3755 280').map(c=>c.id),['S1-A-5']);applyInventory(null);

const {orderStreetStart}=require('./layout.js');for(const c of cells){const start=orderStreetStart(c,points,route,streets);assert.equal(start.origin.id,c.street);assert.deepEqual(start.pose.eye,[streets.find(s=>s.id===c.street).x,14,3]);assert.deepEqual(start.pose,walkingPlan(start.origin,c,route,streets)[0].pose);}assert.equal(orderStreetStart(null,points,route,streets),null);console.log('OK: order street focus for all 450 cells');

const {streetOverviewPose}=require('./layout.js');for(const point of points.filter(p=>/^S[1-5]$/.test(p.id)))for(const aspect of [.32,.45,.6,1,1.5,2.2,3]){const half=65*Math.PI/360,p=streetOverviewPose(point,aspect,half);assert.deepEqual(p.target,[point.x*.15,0,-.6+(point.z+.6)*.15]);assert.equal(p.pitch,Math.PI/2);for(const x of [-16.5,16.5])for(const z of [-12.6,11.4])for(const y of [0,4.6]){assert(Math.abs(x-p.target[0])/((p.distance-y)*Math.tan(half)*aspect)<=.96000001);assert(Math.abs(z-p.target[2])/((p.distance-y)*Math.tan(half))<=.96000001);}}console.log('OK: whole warehouse visible from each street in seven screen ratios');

for(const point of points.filter(p=>/^S[1-5]$/.test(p.id)))for(const aspect of [.25,.32,.45,.6,1,1.5,2.2,3]){const p=streetOverviewPose(point,aspect,65*Math.PI/360);assert(p.distance<1000);assert(p.distance>4.6);}

for(const aspect of [.25,.32,.45,.6,1,1.5,2.2,3]){const all=points.filter(p=>/^S[1-5]$/.test(p.id));const height=streetOverviewPose(all[0],aspect,65*Math.PI/360).distance;for(const i of [0,1,2,3,4,3,2,1,0,4,4,2,0])assert.equal(streetOverviewPose(all[i],aspect,65*Math.PI/360).distance,height);}console.log('OK: constant street scale through repeated selections');

// All seven navigation points fit the complete warehouse at a fixed scale.
for(const aspect of [.25,.32,.45,.58,.6,.8,1,1.5,2.2,3]){const half=65*Math.PI/360,baseline=streetOverviewPose(points[0],aspect,half).distance;for(const point of points){const p=streetOverviewPose(point,aspect,half);assert.equal(p.distance,baseline);for(const x of [-16.5,16.5])for(const z of [-12.6,11.4])for(const y of [0,4.6]){assert(Math.abs(x-p.target[0])/((p.distance-y)*Math.tan(half)*aspect)<=.96000001);assert(Math.abs(z-p.target[2])/((p.distance-y)*Math.tan(half))<=.96000001);}if(aspect<=.8)assert(33/(2*p.distance*Math.tan(half)*aspect)>.73);}}
console.log('OK: larger portrait framing and constant scale for all navigation points');

const {sections}=require('./layout.js');assert.equal(sections.length,18);assert.equal(sections.flatMap(s=>s.members).length,450);assert.equal(new Set(sections.flatMap(s=>s.members.map(c=>c.id))).size,450);assert(!('blockers' in require('./layout.js')));console.log('OK: all rack sections rendered, no occlusion mechanism');

const {cellArticles}=require('./layout.js');assert.deepEqual(cellArticles(['APBM2802 — Крыло','APBM2802A — Крыло алюминиевое','FP 4819 311 — Крыло','S BD S875 — Колодки','КН3755 280 Капот','AP MZ 1402 C','000123 — Деталь','БЕЗ АРТИКУЛА — Капот','Капот','APAU1603-2']),['APBM2802','APBM2802A','FP 4819 311','S BD S875','КН3755 280','AP MZ 1402 C','000123','APAU1603-2']);assert.deepEqual(cellArticles([]),[]);assert.deepEqual(cellArticles(['ABC — Описание','AB-1 — <script>']),['ABC','AB-1']);

const {articlePopupPosition}=require('./layout.js');
const anchor={x:150,y:200,width:55,height:24},tagRect={left:122.5,right:177.5,top:188,bottom:212},pinRect={left:120,right:180,top:216,bottom:265};
const pos=articlePopupPosition(anchor,74,47,300,500,[tagRect,pinRect]);assert(pos);assert(pos.top+47<=183||pos.left+74<=115||pos.left>=185);assert.equal(articlePopupPosition(anchor,74,47,300,500,[{left:0,right:300,top:0,bottom:500}]),null);
for(const x of [16,55,150,250,284])for(const y of [15,60,200,420,485]){const p=articlePopupPosition({x,y,width:50,height:24},80,48,300,500,[]);assert(p);assert(p.left>=5&&p.left+80<=295&&p.top>=5&&p.top+48<=495);}

// Exact article outranks suffixes and descriptions; live refresh keeps unchanged cell arrays.
applyInventory({S1:{A:{1:'APBM2802A — Крыло',2:'APBM2802 — Крыло',3:'FP 4819 311 — Бампер',4:'FP 4819 311 A — Бампер',5:'КН3755 280 — Капот',6:'БЕЗ АРТИКУЛА — APBM2802'}},S2:{A:{1:'APBM2802 — Другой товар'}}});
assert.deepEqual(search('APBM2802').slice(0,2).map(c=>c.id),['S1-A-2','S2-A-1']);
assert.deepEqual(exactArticleMatches('APBM2802').map(c=>c.id),['S1-A-2','S2-A-1']);
assert.deepEqual(exactArticleMatches('FP 4819 311').map(c=>c.id),['S1-A-3']);
assert.deepEqual(exactArticleMatches('КН3755 280').map(c=>c.id),['S1-A-5']);
const sameCell=search('S1-A-2')[0],sameItems=sameCell.items;
applyInventory({S1:{A:{2:'APBM2802 — Крыло'}}});assert.equal(sameCell.items,sameItems);
applyInventory(null);assert.equal(sameCell.items.length,0);

const {cellFocusPose,linkedCellMatches}=require('./layout.js');
for(const c of cells){
 const p=cellFocusPose(c),s=streets.find(s=>s.id===c.street);
 const eye=[p.target[0]+p.distance*Math.sin(p.yaw)*Math.cos(p.pitch),p.target[1]+p.distance*Math.sin(p.pitch),p.target[2]+p.distance*Math.cos(p.yaw)*Math.cos(p.pitch)];
 assert(Math.abs(eye[0]-s.x)<1e-8);assert(Math.abs(eye[1]-c.y-.28)<1e-8);assert(Math.abs(eye[2]-c.z)<1e-8);assert.deepEqual(p.target,[c.x,c.y,c.z]);
}
const stale=mapLinkQuery('?article=APBM2802&cell=S3-K-7');
assert.deepEqual(linkedCellMatches(stale,false).map(c=>c.id),['S3-K-7']);
assert.deepEqual(linkedCellMatches(stale,true),[]);
applyInventory({S2:{A:{2:'APBM2802 — Крыло'}}});
assert.deepEqual(linkedCellMatches(stale,true).map(c=>c.id),['S2-A-2']);
assert.deepEqual(linkedCellMatches(mapLinkQuery('?cell=S3-K-7'),true).map(c=>c.id),['S3-K-7']);
applyInventory(null);

const {routeDistance}=require('./layout.js');assert.equal(normalizeAddress('S3 G07'),'S3-G-7');assert.equal(normalizeAddress('S1 A01'),'S1-A-1');assert.equal(normalizeAddress('S1 A00'),null);assert.equal(routeDistance([]),0);assert.equal(routeDistance([{x:0,z:0},{x:3,z:0},{x:3,z:4}]),7);
for(const c of cells){const p=points.find(p=>p.id===c.street);assert(Math.abs(routeDistance(route(p,c))-Math.abs(c.z-p.z))<1e-8);}
applyInventory({S1:{A:{1:'Другой товар ABC',2:'ABC — Товар',3:'APBM2802A — Деталь',4:'APBM2802 — Деталь'}}});
assert.equal(search('ABC')[0].id,'S1-A-2');assert.equal(search('APBM2802')[0].id,'S1-A-4');assert.equal(search('APBM2802')[0].id,'S1-A-4');
applyInventory({S1:{A:{1:'ABC — Товар'}}});assert.equal(search('ABC')[0].id,'S1-A-1');assert.equal(search('APBM2802').length,0);applyInventory(null);

const {inventoryLines,cellTone}=require('./layout.js');
assert.deepEqual(inventoryLines(' \n\u200b\u2060\n\uFEFF\n\t'),[]);
assert.deepEqual(inventoryLines(' APBM2802 — Крыло \n\u200b\n APBM2802A '),['APBM2802 — Крыло','APBM2802A']);
assert.equal(inventoryLines(null).length,0);
applyInventory({S3:{A:{1:'\u200b',2:'APBM2802 — Крыло'}}});
const empty=search('S3-A-1')[0],filled=search('S3-A-2')[0];
assert.equal(empty.items.length,0);assert.equal(cellTone(empty,true,false,false),'53677a');assert.equal(cellTone(empty,true,false,true),'53677a');assert.equal(cellTone(filled,true,false,false),'6bb58b');assert.equal(cellTone(filled,false,false,false),'53677a');assert.equal(cellTone(empty,true,true,false),'f5ca63');
applyInventory(null);assert.equal(cellTone(filled,true,false,false),'53677a');
const blockedNear={x:150,y:200,width:40,height:20};
const onlyTop=[{left:0,right:300,top:105,bottom:500}];
const free=articlePopupPosition(blockedNear,75,40,300,500,onlyTop);
assert(free);assert(free.top+40<=100);
