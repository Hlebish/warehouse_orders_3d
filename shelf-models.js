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
// Upright, solid cardboard cartons with open tops, folded lips and labels.
// Parts have closed, shaped meshes; no overlapping cartons or mid-level shelf.
function carton(box,x,base,z,w,h,d,side,tint){
 const t=.024;
 box(x,base+t/2,z,w,t,d,tint);
 for(const s of [-1,1]){
  box(x+s*(w/2-t/2),base+h/2,z,t,h,d,tint);
  box(x,base+h/2,z+s*(d/2-t/2),w-2*t,h,t,'b58b56');
  // Reinforced upper rims.
  box(x+s*(w/2-t/2),base+h-t/2,z,.035,t,d,'d0aa77');
  box(x,base+h-t/2,z+s*(d/2-t/2),w-2*t,t,.035,'c9a16c');
 }
 // Packing tape and shipping label on the aisle-facing narrow end.
 const front=x+side*(w/2+.003);
 box(front,base+h*.5,z,.008,h*.91,.05,'dcc194');
 box(front+side*.005,base+h*.71,z-.045,.008,Math.min(.10,h*.22),Math.min(.12,d*.45),'f2e7cc');
 box(front+side*.010,base+h*.71,z-.045,.008,Math.min(.035,h*.08),Math.min(.075,d*.30),'77756c');
}
// Extrude each shaped metal strip along Z, creating a closed 3D panel.
function solidPanel(quad,rows,color,thickness){
 const back=p=>[p[0],p[1],p[2]-thickness];
 for(let i=1;i<rows.length;i++)for(let j=1;j<rows[i].length;j++){
  const a=rows[i-1][j-1],b=rows[i-1][j],c=rows[i][j],d=rows[i][j-1];
  quad([a,b,c,d],color,1.12);quad([back(a),back(d),back(c),back(b)],color,.72);
  if(j===1)quad([a,d,back(d),back(a)],color,.83);
  if(j===rows[i].length-1)quad([b,back(b),back(c),c],color,.88);
  if(i===1)quad([a,back(a),back(b),b],color,.8);
  if(i===rows.length-1)quad([d,c,back(c),back(d)],color,.9);
 }
}
function wingMesh(quad,x,base,z,mirror,color){
 const rows=[];
 for(let i=0;i<=16;i++){
  const t=-1+i/8,xx=x+mirror*t*.49;
  const arch=Math.abs(t)<.72?.31*Math.sqrt(Math.max(0,1-(t/.72)**2)):0;
  const low=base+.045+arch,high=base+.60-.065*t*t;
  const crown=.045*(1-t*t);
  rows.push([[xx,low,z+crown*.4],[xx,(low+high)/2,z+crown],[xx,high,z+crown*.3]]);
 }
 solidPanel(quad,rows,color,.028);
}
function hoodMesh(quad,x,base,z,color){
 const rows=[];
 for(const [t,width] of [[0,.43],[.10,.49],[.82,.50],[1,.43]]){
  const y=base+.055+t*1.46;
  rows.push([-1,-.55,0,.55,1].map(u=>[x+u*width,y,z-.10*t+.060*(1-u*u)]));
 }
 solidPanel(quad,rows,color,.035);
}
function drawShelf(box,quad,b,model,side,accent){
 box(b.x+side*.57,b.base+.055,b.z,.065,.10,b.d-.06,accent);
 if(model==='shelf')return;
 const wing=model==='wing',count=wing?4:3;
 const pitch=(b.d-.12)/count,depth=pitch-.045;
 const base=b.base+.025,w=b.w-.13,height=wing?.46:1.24;
 for(let i=0;i<count;i++){
  const z=b.z+(i-(count-1)/2)*pitch;
  carton(box,b.x,base,z,w,height,depth,side,['b59060','c19a68','af8656','c9a16d'][i]);
  const metal=['a7b1bc','8f9eab','bac3cc','9caab6'][i];
  if(wing)wingMesh(quad,b.x,base,z,i%2?1:-1,metal);
  else hoodMesh(quad,b.x,base,z+.035,metal);
 }
}
const api={createShelfEditor,drawShelf};
if(typeof module!=='undefined')module.exports=api;else root.WarehouseShelves=api;
})(globalThis);
