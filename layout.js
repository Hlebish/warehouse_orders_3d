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
    cells.push({id,street:'S'+s,side,letter,n,x:rackX,y:.55+i*.88,z,w:1.23,h:.76,d:1.51,items:[]});
   }
  });
 }
}
function normalizeAddress(value){const m=String(value).toUpperCase().trim().match(/^S\s*([1-5])\s*[,;\s-]*([A-HJK])\s*[-,\s]*([1-9]|10)$/);return m?'S'+m[1]+'-'+m[2]+'-'+m[3]:null;}
function applyInventory(data){
 let occupied=0,lines=0;
 for(const c of cells){
  const raw=data?.[c.street]?.[c.letter]?.[String(c.n)];
  c.items=typeof raw==='string'?raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean):[];
  if(c.items.length){occupied++;lines+=c.items.length;}
 }
 return {occupied,lines,total:cells.length};
}
function search(value){
 const q=String(value).trim().toUpperCase();if(!q)return [];
 const addr=normalizeAddress(q);if(addr)return cells.filter(c=>c.id===addr);
 const compact=s=>s.toUpperCase().replace(/[^A-Z0-9]/g,'');
 const article=compact(q),isArticle=/^[A-Z0-9\s._-]+$/.test(q)&&/[A-Z]/.test(article)&&/\d/.test(article)&&article.length>=4;
 const normal=s=>s.toUpperCase().replace(/Ё/g,'Е').replace(/[^A-ZА-ЯІЇЄҐ0-9]+/g,' ').trim();
 const words=normal(q).split(/\s+/).filter(Boolean);
 return cells.filter(c=>c.items.some(item=>isArticle?compact(item).includes(article):words.length&&words.every(word=>normal(item).includes(word))));
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
function occlusion(cells,racks){
 const key=c=>c.street+':'+c.side+':'+(c.n<=3?'1-3':'4-10');
 const sections=racks.flatMap(r=>[[1,3],[4,10]].map(([first,last])=>{
  const members=cells.filter(c=>c.street===r.street&&c.side===r.side&&c.n>=first&&c.n<=last);
  const zMin=Math.min(...members.map(c=>c.z))-.83,zMax=Math.max(...members.map(c=>c.z))+.83;
  return {id:key(members[0]),members,x:r.x,z:(zMin+zMax)/2,w:RACK_WIDTH,h:4.6,d:zMax-zMin};
 }));
 function hit(eye,target,center,half){
  let lo=0,hi=1;
  for(let i=0;i<3;i++){
   const d=target[i]-eye[i],min=center[i]-half[i],max=center[i]+half[i];
   if(Math.abs(d)<1e-9){if(eye[i]<min||eye[i]>max)return null;continue;}
   let t1=(min-eye[i])/d,t2=(max-eye[i])/d;
   lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));
   if(lo>hi)return null;
  }return lo;
 }
 // Match actual rendered cell boxes, beams, and shelves, not a solid rack envelope.
 const geometry=sections.map(s=>{
  const parts=s.members.map(c=>({id:c.id,center:[c.x,c.y,c.z],half:[c.w/2,c.h/2,c.d/2]}));
  const put=(x,y,z,w,h,d)=>parts.push({center:[x,y,z],half:[w/2,h/2,d/2]});
  const depth=s.d-.02;
  for(const x of [s.x-RACK_WIDTH/2+.0425,s.x+RACK_WIDTH/2-.0425]){
   for(const z of [s.z-depth/2,s.z+depth/2])put(x,2.3,z,.085,4.6,.085);
   for(let i=0;i<=5;i++)put(x,.12+i*.88,s.z,.08,.085,depth);
  }
  for(const c of s.members.filter(c=>c.letter===s.members[0].letter)){
   for(let i=0;i<=5;i++)put(s.x,.12+i*.88,c.z,RACK_WIDTH,.07,1.64);
  }
  return {...s,parts};
 });
 function blockers(eye,cell){
  if(!cell)return [];
  const center=[cell.x,cell.y,cell.z],half=[cell.w/2,cell.h/2,cell.d/2];
  const samples=[center,...[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[center[0]+x*half[0]*.68,center[1]+y*half[1]*.68,center[2]+z*half[2]*.68])))];
  const votes=new Map();let blockedRays=0;
  for(let i=0;i<samples.length;i++){
   const target=samples[i],entry=hit(eye,target,center,half);
   if(entry===null||entry<=1e-5)continue;
   let blocked=false;
   for(const s of geometry){
    const bound=hit(eye,target,[s.x,s.h/2,s.z],[s.w/2+.05,s.h/2+.05,s.d/2+.05]);
    if(bound===null||bound>=entry-1e-5)continue;
    const intersects=s.parts.some(b=>{if(b.id===cell.id)return false;const t=hit(eye,target,b.center,b.half);return t!==null&&t<entry-1e-5;});
    if(!intersects)continue;
    blocked=true;const v=votes.get(s.id)||{count:0,center:false};v.count++;v.center ||= i===0;votes.set(s.id,v);
   }
   if(blocked)blockedRays++;
  }
  // Ignore edge-only grazing. If multiple racks jointly hide most of the target,
  // reveal only the sections contributing materially to that occlusion.
  return [...votes].filter(([,v])=>v.center||v.count>=5||(blockedRays>=5&&v.count>=2)).map(([id])=>id);
 }
 return {key,sections,blockers};
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
 const normalize=s=>String(s||'').normalize('NFKC').trim().toUpperCase();
 const ap=s=>normalize(s).match(/^A[ \t-]*P[ \t-]*[A-Z][ \t-]*[A-Z][ \t-]*\d(?:[ \t-]*\d)*(?:[A-Z][A-Z0-9]*|-[A-Z][A-Z0-9]*|[ \t-]+[A-Z]\d*(?![A-Z0-9]))?/);
 const compact=s=>normalize(s).replace(/[^\p{L}\p{N}]/gu,'');
 const q=compact(ap(value)?.[0]||value);
 if(!q)return [];
 return cells.filter(c=>c.items.some(line=>{
  const code=ap(line);
  if(code||ap(q))return !!code&&compact(code[0])===q;
  const tokens=normalize(line).match(/[\p{L}\p{N}]+/gu)||[];
  for(let i=0;i<tokens.length;i++){let joined='';for(let j=i;j<Math.min(i+5,tokens.length);j++){joined+=tokens[j];if(joined===q)return true;if(joined.length>=q.length)break;}}
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
 const ratio=Math.max(.01,aspect),tan=Math.tan(halfFov),margin=.58;
 const x=Math.max(Math.abs(-16.5-point.x),Math.abs(16.5-point.x));
 const z=Math.max(Math.abs(-12.6-point.z),Math.abs(11.4-point.z));
 const distance=4.6+Math.max(x/(ratio*tan*margin),z/(tan*margin));
 return {target:[point.x,0,point.z],yaw:0,pitch:Math.PI/2,distance};
}

const layout={cells,racks,streets,search,normalizeAddress,applyInventory,walkingPlan,orderStreetStart,streetOverviewPose,exactArticleMatches,mapLinkQuery,STREET_SPACING,RACK_WIDTH,RACK_OFFSET,AISLE_WIDTH,...navigation(streets),...occlusion(cells,racks)}; if(typeof module!=='undefined')module.exports=layout;else root.WarehouseLayout=layout;
})(globalThis);
