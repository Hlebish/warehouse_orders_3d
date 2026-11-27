/* Visual shelf customizations only. Never changes inventory addresses. */
(function(root){
const MODELS=Object.freeze({shelf:[1,2],wing:[1],hood:[2],piston:[1]});
function createShelfEditor(cells){
 const byId=new Map(cells.map(c=>[c.id,c]));
 const sameBay=(a,b)=>a&&b&&a.street===b.street&&a.side===b.side&&a.n===b.n;
 const adjacent=(a,b)=>sameBay(a,b)&&Math.abs(Math.abs(a.y-b.y)-.88)<1e-6;
 function neighbor(id,dir){const c=byId.get(id);return cells.find(b=>adjacent(c,b)&&Math.sign(b.y-c.y)===dir)?.id||null;}
 function pair(ids){if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length)return null;const cs=ids.map(id=>byId.get(id));if(cs.some(c=>!c)||cs.length===2&&!adjacent(cs[0],cs[1]))return null;return cs.sort((a,b)=>a.y-b.y).map(c=>c.id);}
 function validate(raw){
  const out=[],used=new Set();
  if(!Array.isArray(raw))return out;
  for(const e of raw.slice(0,cells.length)){
   const ids=pair(e?.ids),model=e?.model;
   if(!ids||!Object.hasOwn(MODELS,model)||!MODELS[model].includes(ids.length)||ids.some(id=>used.has(id)))continue;
   ids.forEach(id=>used.add(id));out.push({ids,model});
  }
  return out;
 }
 function index(entries){return new Map(entries.flatMap(e=>e.ids.map(id=>[id,e])));}
 function group(entries,id){return entries.find(e=>e.ids.includes(id))?.ids.slice()||[id];}
 function pick(entries,current,id,replace=false){
  if(!byId.has(id))return current.slice();
  const g=group(entries,id);
  if(!replace&&current.length===1&&g.length===1&&!current.includes(id)){
   const p=pair([...current,id]);if(p)return p;
  }
  return g;
 }
 function extend(entries,current,dir){
  if(current.length!==1)return null;
  const id=neighbor(current[0],dir);if(!id||group(entries,id).length>1)return null;
  return pair([current[0],id]);
 }
 function apply(entries,ids,model){
  ids=pair(ids);if(!ids)return null;
  if(model!=='default'&&(!Object.hasOwn(MODELS,model)||!MODELS[model].includes(ids.length)))return null;
  // A two-level shelf is indivisible until explicitly reset. Do not silently erase half.
  if(entries.some(e=>e.ids.some(id=>ids.includes(id))&&e.ids.some(id=>!ids.includes(id))))return null;
  const next=entries.filter(e=>!e.ids.some(id=>ids.includes(id)));
  if(model!=='default')next.push({ids,model});
  return validate(next);
 }
 function bounds(entry){const cs=entry.ids.map(id=>byId.get(id));const c=cs[0],last=cs.at(-1);return {x:c.x,z:c.z,y:(c.y+last.y)/2,w:c.w,h:last.y-c.y+c.h,d:c.d,base:c.y-c.h/2,top:last.y+last.h/2,cells:cs};}
 return {validate,index,group,pick,extend,apply,bounds,neighbor};
}
// Reference: tightly packed shaped cardboard envelopes, wooden pallets and teal piston cartons.
function pallet(box,b){
 const base=b.base+.005,w=b.w-.09,d=b.d-.06;
 // Solid wooden stringers and spaced deck boards.
 for(const z of [-.43,0,.43])box(b.x,base+.035,b.z+z*d,w,.07,.10,'957247');
 for(let i=0;i<5;i++)box(b.x+(i-2)*w/5,base+.087,b.z,w/5-.025,.034,d,'b18d59');
 return base+.104;
}
// Extrude a piecewise-profiled envelope along the stacking axis; the top
// leans slightly sideways. The shaped silhouette is preserved on both faces.
function envelope(quad,rows,z,base,lean,thickness,color,accent){
 const front=p=>[p[0],p[1],z+lean*(p[1]-base)+thickness/2];
 const back=p=>[p[0],p[1],z+lean*(p[1]-base)-thickness/2];
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1][0],b=rows[i-1][1],c=rows[i][1],d=rows[i][0];
  const tint=i===1||i===rows.length-1?accent:color;
  quad([front(a),front(b),front(c),front(d)],tint,1.03);
  quad([back(a),back(d),back(c),back(b)],tint,.89);
  quad([front(b),back(b),back(c),front(c)],color,1.17);
  quad([front(a),front(d),back(d),back(a)],color,.76);
  if(i===1)quad([front(a),back(a),back(b),front(b)],accent,.96);
  if(i===rows.length-1)quad([front(d),front(c),back(c),back(d)],accent,.92);
 }
}
// Three distinct silhouettes per category, inspired by the warehouse photos.
// Profile columns: normalized horizontal position, lower edge, upper edge.
const WING_PROFILES=[
 [[-.5,.08,.39],[-.38,.018,.49],[-.24,0,.28],[-.10,0,.20],[.07,0,.21],[.22,.008,.32],[.35,.035,.79],[.46,.07,1],[.5,.11,.84]],
 [[-.5,.12,.72],[-.38,.025,.87],[-.23,0,.52],[-.08,0,.38],[.10,0,.36],[.27,.015,.60],[.40,.035,1],[.50,.12,.91]],
 [[-.5,.13,.53],[-.41,.04,.65],[-.26,0,.42],[-.09,0,.25],[.10,0,.30],[.25,.025,.59],[.38,.04,.88],[.47,.065,1],[.50,.12,.86]]
];
const HOOD_PROFILES=[
 [[-.50,.11,.84],[-.40,.02,.98],[-.28,0,1],[.31,.008,.99],[.42,.035,.94],[.50,.15,.82]],
 [[-.50,.19,.71],[-.39,.035,.91],[-.25,0,1],[.24,0,1],[.40,.035,.91],[.50,.19,.71]],
 [[-.50,.045,.92],[-.43,.012,.98],[-.32,0,1],[.32,0,1],[.43,.012,.98],[.50,.045,.92]]
];
const WING_STYLE=[
 {width:.96,height:.62,depth:.118,color:'c5a16a',accent:'ad4c43'},
 {width:.88,height:.555,depth:.105,color:'b99460',accent:'c7a36f'},
 {width:1,height:.59,depth:.132,color:'d0af7b',accent:'a38b64'}
];
const HOOD_STYLE=[
 {width:.97,height:1.49,depth:.145,color:'c4a36e',accent:'af8c59'},
 {width:.91,height:1.46,depth:.165,color:'d0b382',accent:'a9895d'},
 {width:1,height:1.44,depth:.125,color:'bd9b65',accent:'c6a477'}
];
// Stable pseudo-random arrangement keyed to the physical address, not frame
// time or inventory. A shuffled cycle guarantees all three variants per shelf.
function shelfSeed(b,model){
 const key=(b.cells?.map(c=>c.id).join('+')||[b.x,b.y,b.z].join(','))+'|'+model;
 let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
 return hash>>>0;
}
function packingPlan(b,model){
 if(model!=='wing'&&model!=='hood')return [];
 let seed=shelfSeed(b,model);
 const random=()=>{seed=(seed+0x6D2B79F5)>>>0;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
 const wing=model==='wing',styles=wing?WING_STYLE:HOOD_STYLE;
 const count=wing?4+Math.floor(random()*3):3+Math.floor(random()*2);
 const lean=(wing?.065:.045)+random()*(wing?.045:.030);
 const pitch=(b.d-.26)/count,origin=b.z-lean*(wing?.62:1.49)/2;
 let order=[],out=[];
 for(let i=0;i<count;i++){
  if(!order.length){order=[0,1,2];for(let j=2;j>0;j--){const k=Math.floor(random()*(j+1));[order[j],order[k]]=[order[k],order[j]];}}
  const variant=order.pop(),style=styles[variant];
  out.push({variant,z:origin+(i-(count-1)/2)*pitch,lean,width:style.width*(wing?b.w-.20:b.w-.13),height:style.height,depth:style.depth,color:style.color,accent:style.accent,sticker:random()<.5?'9edc59':'d5bd56'});
 }
 return out;
}
function wingPack(quad,b,base,side,p){
 const {width:w,height:h,z,lean,depth,variant,color,accent}=p;
 const rows=WING_PROFILES[variant].map(([u,low,high])=>[[b.x+side*u*w,base+low*h],[b.x+side*u*w,base+high*h]]);
 envelope(quad,rows,z,base,lean,depth,color,accent);
 const x=rows.at(-1)[0][0]+side*.001;
 const sticker=(y,height,width,tint)=>{
  const mid=z+lean*(y-base);
  quad([[x,y-height/2,mid-width/2],[x,y+height/2,mid-width/2],[x,y+height/2,mid+width/2],[x,y-height/2,mid+width/2]],tint,1);
 };
 sticker(base+h*.57,.075,.074,'eee9d7');
 sticker(base+h*.32,.055,.065,p.sticker);
}
function hoodPack(quad,b,base,side,p){
 const {width:w,height:h,z,lean,depth,variant,color,accent}=p;
 const rows=HOOD_PROFILES[variant].map(([u,low,high])=>[[b.x+side*u*w,base+low*h],[b.x+side*u*w,base+high*h]]);
 envelope(quad,rows,z,base,lean,depth,color,accent);
 const face=(u,y)=>[b.x+side*u*w,base+y*h,z+lean*y*h+depth/2+.001];
 // Distinct cardboard seam and printing patterns on the three packages.
 const stripe=variant===1?-.25:variant===2?.21:-.01;
 quad([face(stripe,.22),face(stripe+.015,.22),face(stripe+.015,.80),face(stripe,.80)],'a98a5e',1);
 const ink=variant===1?'93453c':'343638';
 const labelY=variant===2?.43:.60;
 quad([face(-.26,labelY),face(.24,labelY),face(.24,labelY+.10),face(-.26,labelY+.10)],ink,1);
 quad([face(-.21,labelY+.032),face(.18,labelY+.032),face(.18,labelY+.054),face(-.21,labelY+.054)],'ded6bb',1);
 const x=b.x+side*(w/2+.001),y=base+h*.48,mid=z+lean*(y-base);
 quad([[x,y-.065,mid-.045],[x,y+.065,mid-.045],[x,y+.065,mid+.045],[x,y-.065,mid+.045]],'eee6d4',1);
}
function pistonStock(box,b,base,side){
 const cols=5,rows=3,w=(b.w-.13)/rows,d=(b.d-.13)/cols,h=.095;
 const heights=[[3,5,4,2,5],[4,6,3,5,4],[5,3,6,4,2]];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const x=b.x+side*(r-(rows-1)/2)*w,z=b.z+(c-(cols-1)/2)*d;
  for(let level=0;level<heights[r][c];level++){
   const y=base+(level+.5)*h;
   const color=['126d83','197f92','1d7183','268b9a'][(r+c+level)%4];
   box(x,y,z,w-.018,h-.008,d-.014,color);
   // Pale product stickers on the aisle side; white diagonal branding
   // is suggested by two small printed strips on the exposed top carton.
   if(r===rows-1)box(x+side*(w/2-.007),y+.004,z,.009,h*.63,d*.72,'c6d8d6');
   if(level===heights[r][c]-1){
    box(x,y+h/2-.002,z-d*.18,w*.62,.006,.018,'91bfc1');
    box(x+w*.12,y+h/2-.002,z+d*.12,w*.35,.006,.014,'91bfc1');
   }
  }
 }
}
function drawShelf(box,quad,b,model,side,accent,showStock=true){
 box(b.x+side*.57,b.base+.055,b.z,.065,.10,b.d-.06,accent);
 if(model==='shelf')return;
 const base=pallet(box,b);
 // Pistons are stored outside the address inventory: always show their assigned model.
 if(model==='piston'){pistonStock(box,b,base,side);return;}
 if(!showStock)return;
 for(const pack of packingPlan(b,model)){
  if(model==='wing')wingPack(quad,b,base,side,pack);else hoodPack(quad,b,base,side,pack);
 }
}
const api={createShelfEditor,drawShelf,packingPlan};
if(typeof module!=='undefined')module.exports=api;else root.WarehouseShelves=api;
})(globalThis);
