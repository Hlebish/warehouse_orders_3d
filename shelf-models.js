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
// A broad, shaped fender envelope has a tall outer end and a concave
// upper edge, matching the folded cardboard around a wheel-arch part.
function wingPack(quad,b,base,z,side,index){
 const w=b.w-.20,h=.59-(index%3)*.023;
 const profile=[[-.5,.08,.39],[-.38,.018,.49],[-.24,0,.28],[-.10,0,.20],[.07,0,.21],[.22,.008,.32],[.35,.035,.79],[.46,.07,1],[.5,.11,.84]];
 const rows=profile.map(([u,low,high])=>[[b.x+side*u*w,base+low*h],[b.x+side*u*w,base+high*h]]);
 const lean=index%2?.11:.07,thickness=.115;
 const tint=['c5a16a','b8945f','d0af7b','bd995f','c9a873'][index%5];
 envelope(quad,rows,z,base,lean,thickness,tint,index%3===0?'ad4c43':'b08b57');
 // White/green inventory stickers on the narrow end facing the aisle.
 const [lo,hi]=rows.at(-1),x=lo[0]+side*.001;
 const sticker=(y,height,width,color)=>{
  const mid=z+lean*(y-base);
  quad([[x,y-height/2,mid-width/2],[x,y+height/2,mid-width/2],[x,y+height/2,mid+width/2],[x,y-height/2,mid+width/2]],color,1);
 };
 sticker(base+h*.57,.075,.074,'eee9d7');
 sticker(base+h*.32,.055,.065,index%2?'9edc59':'d5bd56');
}
// Hood carton: wide thin package with chamfered corners, folded seams,
// slight lean and opaque cardboard faces, as in the reference photographs.
function hoodPack(quad,b,base,z,side,index){
 const w=b.w-.13,h=1.46-(index%3)*.025;
 const rows=[[-.50,.11,.84],[-.40,.02,.98],[-.28,0,1],[.31,.008,.99],[.42,.035,.94],[.50,.15,.82]].map(([u,low,high])=>[[b.x+side*u*w,base+low*h],[b.x+side*u*w,base+high*h]]);
 const lean=.065+(index%2)*.012,thickness=.15;
 const tint=['c4a36e','d0b382','bd9b65','c9ab78'][index%4];
 envelope(quad,rows,z,base,lean,thickness,tint,'af8c59');
 // Narrow crease across the broad cardboard face and a dark printed label.
 const face=(u,y)=>[b.x+side*u*w,base+y*h,z+lean*y*h+thickness/2+.001];
 quad([face(-.01,.13),face(.005,.13),face(.005,.87),face(-.01,.87)],'a98a5e',1);
 quad([face(-.26,.58),face(.24,.58),face(.24,.69),face(-.26,.69)],'343638',1);
 quad([face(-.21,.617),face(.18,.617),face(.18,.64),face(-.21,.64)],'ded6bb',1);
 const x=b.x+side*(w/2+.001),y=base+h*.48,mid=z+lean*(y-base);
 quad([[x,y-.065,mid-.055],[x,y+.065,mid-.055],[x,y+.065,mid+.055],[x,y-.065,mid+.055]],'eee6d4',1);
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
 if(!showStock)return;
 if(model==='piston'){pistonStock(box,b,base,side);return;}
 const wing=model==='wing',count=wing?5:4,pitch=(b.d-.22)/count;
 for(let i=0;i<count;i++){
  const z=b.z+(i-(count-1)/2)*pitch-.04;
  if(wing)wingPack(quad,b,base,z,side,i);else hoodPack(quad,b,base,z,side,i);
 }
}
const api={createShelfEditor,drawShelf};
if(typeof module!=='undefined')module.exports=api;else root.WarehouseShelves=api;
})(globalThis);
