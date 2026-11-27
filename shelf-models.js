/* Visual shelf customizations only. Never changes inventory addresses. */
(function(root){
const MODELS=Object.freeze({shelf:[1,2],wing:[1],hood:[2]});
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
// Each panel is a shallow, closed mesh with shaped sides, rather than a filled cuboid.
// Quads use the same vertex format as the main scene and work in Canvas fallback.
function wingMesh(quad,x,y,z,side,color){
 // The curved open edge forms the wheel-arch notch. Flat flange along the back.
 const count=12,rows=[];
 for(let i=0;i<=count;i++){
  const t=-1+2*i/count,zz=z+t*.67;
  const arch=Math.abs(t)<.72?.39*Math.sqrt(Math.max(0,1-(t/.72)**2)):0;
  const taper=.10*Math.abs(t)**2,back=-.46+taper,front=.47-arch-taper;
  const yy=y+.035*(1-t*t);
  rows.push([[x+side*back,yy,zz],[x+side*front,yy+.065,zz]]);
 }
 for(let i=1;i<rows.length;i++){
  const [a,b]=rows[i-1],[c,d]=rows[i],down=p=>[p[0],p[1]-.028,p[2]];
  quad([a,b,d,c],color,1.12);quad([down(a),down(c),down(d),down(b)],color,.65);
  quad([a,c,down(c),down(a)],color,.82);quad([b,down(b),down(d),d],color,.91);
  if(i===1)quad([a,down(a),down(b),b],color,.8);
  if(i===rows.length-1)quad([c,d,down(d),down(c)],color,.8);
 }
}
function hoodMesh(quad,x,base,z,side,color){
 // Stamped hood: tapered corners, raised middle and two pressed shoulders.
 const rows=[];
 for(const [t,width] of [[0,.54],[.12,.65],[.85,.68],[1,.57]]){
  const yy=base+.10+t*1.38,xx=x-side*t*.17;
  rows.push([-1,-.55,0,.55,1].map(u=>[xx+side*.075*(1-u*u),yy,z+u*width]));
 }
 const back=p=>[p[0]-side*.032,p[1],p[2]];
 for(let i=1;i<rows.length;i++)for(let j=1;j<rows[i].length;j++){
  const a=rows[i-1][j-1],b=rows[i-1][j],c=rows[i][j],d=rows[i][j-1];
  quad([a,b,c,d],color,j===2||j===3?1.12:.94);quad([back(a),back(d),back(c),back(b)],color,.72);
  if(j===1)quad([a,d,back(d),back(a)],color,.83);
  if(j===rows[i].length-1)quad([b,back(b),back(c),c],color,.85);
  if(i===1)quad([a,back(a),back(b),b],color,.8);
  if(i===rows.length-1)quad([d,c,back(c),back(d)],color,.9);
 }
}
function drawShelf(box,quad,b,model,side,accent){
 // A shallow front label rail indicates occupancy/selection without obscuring parts.
 box(b.x+side*.57,b.base+.055,b.z,.065,.10,b.d-.06,accent);
 if(model==='wing'){
  for(let i=0;i<4;i++)wingMesh(quad,b.x,b.base+.12+i*.14,b.z,side,['a7b1bc','8f9eab','bac3cc','9caab6'][i]);
 }else if(model==='hood'){
  // Three separate panels leaning toward the back, with protective spacers.
  for(let i=0;i<3;i++){
   hoodMesh(quad,b.x+side*(-.30+i*.31),b.base,b.z,side,['9daab7','bcc6cf','8999a8'][i]);
   box(b.x+side*(-.30+i*.31),b.base+.05,b.z,.11,.10,1.30,'655d51');
  }
 }
}
const api={createShelfEditor,drawShelf};
if(typeof module!=='undefined')module.exports=api;else root.WarehouseShelves=api;
})(globalThis);
