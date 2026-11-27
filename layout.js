/* Адреса соответствуют действующей карте Hlebish/warehouse-map.
   Геометрия — условная, по приложенной схеме. Все размеры в метрах. */
(function(root){
const levels={left:['A','B','C','D','E'],right:['F','G','H','J','K']};
const STREET_SPACING=6.2, RACK_WIDTH=1.44, RACK_OFFSET=(STREET_SPACING-RACK_WIDTH)/2;
const AISLE_WIDTH=2*RACK_OFFSET-RACK_WIDTH;
const cells=[], racks=[], streets=[];
for(let s=1;s<=5;s++){
 const x=(s-3)*STREET_SPACING; streets.push({id:'S'+s,x});
 for(const side of (s===1?['left']:['left','right'])){
  // S1 на схеме имеет единственный ряд справа от прохода.
  const rackX=x+(s===1||side==='right'?RACK_OFFSET:-RACK_OFFSET);
  const rack={street:'S'+s,side,x:rackX}; racks.push(rack);
  levels[side].forEach((letter,i)=>{
   for(let n=1;n<=10;n++){
    const z=n<=3?8.9-(n-1)*1.65:0.3-(n-4)*1.65;
    const id='S'+s+'-'+letter+'-'+n;
    // Long A–E sections on S1 and S5 have a double-height A.
    const tall=(s===1||s===5)&&side==='left'&&n>=4;
    if(tall&&letter==='E')continue;
    const levelStart=tall&&i>0?i+1:i,levelSpan=tall&&i===0?2:1;
    cells.push({id,street:'S'+s,side,letter,n,x:rackX,y:.55+(levelStart+(levelSpan-1)/2)*.88,z,w:1.23,h:.76+(levelSpan-1)*.88,d:1.51,levelStart,levelSpan,items:[]});
   }
  });
 }
}
function normalizeAddress(value){const m=String(value).toUpperCase().trim().match(/^S\s*([1-5])\s*[,;\s-]*([A-HJK])\s*[-,\s]*(0?[1-9]|10)$/);return m?'S'+m[1]+'-'+m[2]+'-'+Number(m[3]):null;}
// Invisible-only legacy cell strings are not physical stock.
function inventoryLines(raw){
 if(typeof raw!=='string')return [];
 return raw.split(/\r?\n/).map(line=>line.replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim()).filter(Boolean);
}
function unmappedS1E(data){return Array.from({length:7},(_,i)=>i+4).filter(n=>inventoryLines(data?.S1?.E?.[n]).length>0).length;}
function unmappedLongE(data){return ['S1','S5'].flatMap(street=>Array.from({length:7},(_,i)=>i+4).filter(n=>inventoryLines(data?.[street]?.E?.[n]).length>0).map(n=>street+'-E-'+n));}
function cellTone(cell,ready,selected,matched){
 return selected?'f5ca63':!ready?'53677a':matched&&cell.items.length?'d09e50':cell.items.length?'6bb58b':'53677a';
}
function applyInventory(data){
 let occupied=0,lines=0;
 for(const c of cells){
  const raw=data?.[c.street]?.[c.letter]?.[String(c.n)];
  const next=inventoryLines(raw);
  if(next.length!==c.items.length||next.some((line,i)=>line!==c.items[i]))c.items=next;
  if(c.items.length){occupied++;lines+=c.items.length;}
 }
 return {occupied,lines,total:cells.length};
}
// The source map imports "АРТИКУЛ — ОПИСАНИЕ" (or a standalone article).
// Legacy free-text rows are handled conservatively: never show a description as a code.
function cellArticles(items){
 const out=[];
 for(const value of items||[]){
  const text=String(value||'').trim();if(!text)continue;
  const split=text.match(/^(.*?)\s+[—–]\s+/u);
  let code=split?split[1].trim():'';
  if(!split){
   const tokens=text.split(/\s+/),parts=[];
   for(const t of tokens){
    if(!/^[\p{L}\p{N}._/+()-]+$/u.test(t))break;
    if(!/\d/.test(t)&&(!/^[A-ZА-ЯІЇЄҐ]{1,4}$/u.test(t)))break;
    parts.push(t);
   }
   code=parts.join(' ');
   if(!/\d/.test(code))code='';
   // An explicitly stored one-token article may be letters only.
   if(!code&&/^[A-ZА-ЯІЇЄҐ][A-ZА-ЯІЇЄҐ._/+()-]{1,30}$/u.test(text)&&text!=='БЕЗ АРТИКУЛА')code=text;
  }
  if(code&&!/^БЕЗ\s+АРТИКУЛА$/iu.test(code))out.push(code);
 }
 return out;
}

const normalizeCode=value=>String(value||'').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu,'');
const searchCache=new WeakMap();
const normalizeWords=s=>s.normalize('NFKC').toUpperCase().replace(/Ё/g,'Е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function searchRecords(items){
 let records=searchCache.get(items);
 if(!records){records=items.map(item=>({codes:cellArticles([item]).map(normalizeCode),compact:normalizeCode(item),words:normalizeWords(item),structured:/\s+[—–]\s+/u.test(item)}));searchCache.set(items,records);}
 return records;
}
function search(value){
 const q=String(value).normalize('NFKC').trim().toUpperCase();if(!q)return [];
 const addr=normalizeAddress(q);if(addr)return cells.filter(c=>c.id===addr);
 const article=normalizeCode(q);
 const isArticle=/^[\p{L}\p{N}\s._/+()-]+$/u.test(q)&&/\d/.test(article)&&article.length>=3;
 const words=normalizeWords(q).split(/\s+/).filter(Boolean),ranked=[];
 for(const c of cells){
  let score=0;
  for(const item of searchRecords(c.items)){
   const codes=item.codes;
   if(article&&codes.includes(article)){score=3;break;}
   if(isArticle&&codes.some(code=>code.startsWith(article)))score=Math.max(score,2);
   else if(isArticle&&codes.some(code=>code.includes(article)))score=Math.max(score,1);
   // Legacy unstructured rows can contain the article after the name.
   if(isArticle&&!item.structured&&item.compact.includes(article))score=Math.max(score,1);
   if(words.length&&words.every(word=>item.words.includes(word)))score=Math.max(score,1);
  }
  if(score)ranked.push({c,score});
 }
 return ranked.sort((a,b)=>b.score-a.score).map(r=>r.c);
}

function navigation(streets){
 const points=[{id:"entry",name:"Вход",x:-15,z:3},{id:"photo",name:"Фотозона",x:-14.2,z:8.7},...streets.map(s=>({id:s.id,name:s.id,x:s.x,z:3}))];
 function route(origin,cell){
  const aisle=streets.find(s=>s.id===cell.street);
  if(!origin||!aisle)return [];
  const result=[];
  function push(x,z){if(!result.length||result[result.length-1].x!==x||result[result.length-1].z!==z)result.push({x,z});}
  push(origin.x,origin.z);push(origin.x,3);push(aisle.x,3);push(aisle.x,cell.z);
  return result;
 }
 return {points,route};
}
function rackSections(cells,racks){
 const key=c=>c.street+':'+c.side+':'+(c.n<=3?'1-3':'4-10');
 const sections=racks.flatMap(r=>[[1,3],[4,10]].map(([first,last])=>{
  const members=cells.filter(c=>c.street===r.street&&c.side===r.side&&c.n>=first&&c.n<=last);
  const zMin=Math.min(...members.map(c=>c.z))-.83,zMax=Math.max(...members.map(c=>c.z))+.83;
  return {id:key(members[0]),members,x:r.x,z:(zMin+zMax)/2,w:RACK_WIDTH,h:4.6,d:zMax-zMin};
 }));
 return sections;
}
function walkingPlan(origin,cell,route,streets){
 if(!origin||!streets.some(s=>s.id===origin.id)||!cell)return [];
 const path=route(origin,cell),height=1.68;
 if(path.length<2)return [];
 const yawTo=(a,b)=>Math.atan2(a.x-b.x,a.z-b.z);
 const pose=(p,yaw,pitch=0,y=height)=>({eye:[p.x,y,p.z],yaw,pitch,distance:3});
 const heading=yawTo(path[0],path[1]);
 const plan=[{pose:pose(path[0],heading,1.54,14),duration:950,phase:'approach'},{pose:pose(path[0],heading,0),duration:950,phase:'descend'}];
 let yaw=heading;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],next=yawTo(a,b);
  if(Math.abs(Math.atan2(Math.sin(next-yaw),Math.cos(next-yaw)))>.001)plan.push({pose:pose(a,next),duration:450,phase:'turn'});
  plan.push({pose:pose(b,next),duration:Math.max(400,Math.hypot(b.x-a.x,b.z-a.z)*440),phase:'walk'});yaw=next;
 }
 const last=path.at(-1),lookYaw=yawTo(last,cell),lookPitch=Math.atan2(height-cell.y,Math.hypot(cell.x-last.x,cell.z-last.z));
 plan.push({pose:pose(last,lookYaw,lookPitch),duration:650,phase:'arrive'});
 return plan;
}
function exactArticleMatches(value){
 const q=normalizeCode(value);if(!q)return [];
 return cells.filter(c=>c.items.some(line=>{
  const codes=cellArticles([line]);
  if(codes.length||/\s+[—–]\s+/u.test(line))return codes.some(code=>normalizeCode(code)===q);
  // For old rows with the code after a description, use exact word groups.
  const tokens=line.normalize('NFKC').toUpperCase().match(/[\p{L}\p{N}]+/gu)||[];
  for(let i=0;i<tokens.length;i++){
   let joined='';
   for(let j=i;j<Math.min(i+5,tokens.length);j++){
    joined+=tokens[j];if(joined===q)return true;if(joined.length>=q.length)break;
   }
  }
  return false;
 }));
}
function mapLinkQuery(query){
 const params=new URLSearchParams(query),article=(params.get('article')||'').trim().slice(0,120);
 const addresses=[...new Set(params.getAll('cell').map(normalizeAddress).filter(Boolean))].map(id=>cells.find(c=>c.id===id)).filter(Boolean);
 return {article,addresses};
}

function orderStreetStart(cell,points,route,streets){
 const origin=cell&&points.find(p=>p.id===cell.street);
 if(!origin)return null;
 const plan=walkingPlan(origin,cell,route,streets);
 return plan.length?{origin,pose:plan[0].pose}:null;
}

// Fit the whole warehouse envelope while staying directly over the street.
function streetOverviewPose(point,aspect,halfFov){
 // Keep a common scale for every navigation point, with a modest
 // focus bias towards that point. Full centering on an edge street
 // required excessive zoom-out, especially in portrait mode.
 const ratio=Math.max(.01,aspect),tan=Math.tan(halfFov),margin=.96,bias=.15;
 const centerZ=-.6;
 const maxX=Math.max(15,...streets.map(s=>Math.abs(s.x)));
 const maxZ=Math.max(Math.abs(3-centerZ),Math.abs(8.7-centerZ));
 const x=16.5+bias*maxX,z=12+bias*maxZ;
 const distance=4.6+Math.max(x/(ratio*tan*margin),z/(tan*margin));
 return {target:[point.x*bias,0,centerZ+(point.z-centerZ)*bias],yaw:0,pitch:Math.PI/2,distance};
}

// Find the closest compact popup position that does not cover controls.
function articlePopupPosition(anchor,width,height,w,h,obstacles){
 const pad=5,gap=5;
 if(width>w-pad*2||height>h-pad*2)return null;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const x=anchor.x,y=anchor.y,r=anchor.width/2,b=anchor.height/2;
 const candidates=[
 [x-width/2,y+b+gap],[x-width/2,y-b-height-gap],
 [x+r+gap,y-height/2],[x-r-width-gap,y-height/2],
 [x+r+gap,y+b+gap],[x-r-width-gap,y+b+gap],
 [x+r+gap,y-b-height-gap],[x-r-width-gap,y-b-height-gap]
 ];
 // If the eight nearby positions are blocked, try the edges of every
 // obstacle. This finds free space elsewhere without covering controls.
 const xs=[pad,w-width-pad,x-width/2],ys=[pad,h-height-pad,y-height/2];
 for(const o of obstacles){xs.push(o.left-width-gap,o.right+gap);ys.push(o.top-height-gap,o.bottom+gap);}
 for(const cx of xs)for(const cy of ys)candidates.push([cx,cy]);
 const seen=new Set(),valid=[];
 for(const [cx,cy] of candidates){
  const left=clamp(cx,pad,w-width-pad),top=clamp(cy,pad,h-height-pad);
  const key=left+':'+top;if(seen.has(key))continue;seen.add(key);
  if(obstacles.some(o=>left<o.right+gap&&left+width>o.left-gap&&top<o.bottom+gap&&top+height>o.top-gap))continue;
  const distance=Math.hypot(left+width/2-x,top+height/2-y);
  valid.push({left,top,distance});
 }
 valid.sort((a,b)=>a.distance-b.distance);
 return valid.length?{left:valid[0].left,top:valid[0].top}:null;
}

// Look at the aisle-facing side of the cell, without changing route origin.
function cellFocusPose(cell){
 const aisle=cell&&streets.find(s=>s.id===cell.street);if(!aisle)return null;
 const eye=[aisle.x,cell.y+.28,cell.z],target=[cell.x,cell.y,cell.z];
 const dx=eye[0]-target[0],dy=eye[1]-target[1],dz=eye[2]-target[2];
 return {target,yaw:Math.atan2(dx,dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),distance:Math.hypot(dx,dy,dz)};
}
function linkedCellMatches(link,ready){
 if(!link)return [];
 return ready&&link.article?exactArticleMatches(link.article):link.addresses;
}
function routeDistance(path){return path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.z-path[i].z),0);}
const layout={unmappedS1E,unmappedLongE,inventoryLines,cellTone,routeDistance,cellFocusPose,linkedCellMatches,articlePopupPosition,cells,racks,streets,search,cellArticles,normalizeAddress,applyInventory,walkingPlan,orderStreetStart,streetOverviewPose,exactArticleMatches,mapLinkQuery,STREET_SPACING,RACK_WIDTH,RACK_OFFSET,AISLE_WIDTH,...navigation(streets),sections:rackSections(cells,racks)}; if(typeof module!=='undefined')module.exports=layout;else root.WarehouseLayout=layout;
})(globalThis);
