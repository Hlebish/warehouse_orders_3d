(()=>{'use strict';
const {cells,racks,streets,search,points,route,key,sections,blockers,RACK_WIDTH,applyInventory,walkingPlan}=WarehouseLayout;
const $=id=>document.getElementById(id), canvas=$('gl'), labels=$('labels');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
const ctx=gl?null:canvas.getContext('2d');if(!gl&&!ctx){$('error').hidden=false;$('error').textContent='3D-рендерер недоступен в этом браузере.';return;}
const vsrc='attribute vec3 p;attribute vec3 c;uniform vec3 eye,right,up,forward;uniform float aspect,zoom;varying vec3 color;void main(){vec3 v=p-eye;float d=dot(v,forward);gl_Position=vec4(dot(v,right)*zoom/aspect,dot(v,up)*zoom,1.002*d-.4004,d);color=c;}';
const fsrc='precision mediump float;varying vec3 color;uniform float opacity;void main(){gl_FragColor=vec4(color,opacity);}';
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
let program,P,C,uniforms,buffer;if(gl){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vsrc));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
P=gl.getAttribLocation(program,'p');C=gl.getAttribLocation(program,'c');uniforms=Object.fromEntries(['eye','right','up','forward','aspect','zoom','opacity'].map(n=>[n,gl.getUniformLocation(program,n)]));
buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(P);gl.enableVertexAttribArray(C);gl.vertexAttribPointer(P,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(C,3,gl.FLOAT,false,24,12);gl.enable(gl.DEPTH_TEST);gl.clearColor(.105,.15,.20,1);}
let selected=null, hits=[], vertices=[], count=0, dirty=true, animation=null, flight=[], routePath=[], origin=null,walking=false,walkView=false, groundCount=0, ghostKeys=new Set(), ghostVertices=[], ghostCount=0;
const mul=(a,k)=>a.map(x=>x*k),add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>mul(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cam={target:[0,0,0],yaw:.24,pitch:.78,distance:47};
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
let basis;
function camera(){const {target,yaw,pitch,distance}=cam;const eye=add(target,[distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch)]),forward=norm(sub(target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);return {eye,forward,right,up,aspect:canvas.width/canvas.height,zoom:1/Math.tan(Math.PI/8)};}
const rgb=h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];
function box(x,y,z,w,h,d,hex){const a=w/2,b=h/2,e=d/2;const v=[[-a,-b,-e],[a,-b,-e],[a,b,-e],[-a,b,-e],[-a,-b,e],[a,-b,e],[a,b,e],[-a,b,e]].map(p=>add(p,[x,y,z]));const color=rgb(hex);for(const [ids,shade] of [[[0,1,2,3],.7],[[4,5,6,7],.93],[[0,4,7,3],.76],[[1,5,6,2],.84],[[3,2,6,7],1.15],[[0,1,5,4],.55]]){let c=color.map(n=>Math.min(n*shade,1));for(const i of [0,1,2,0,2,3])vertices.push(...v[ids[i]],...c);}}
function build(){vertices=[];ghostVertices=[];box(0,-.18,-.6,33,.32,24,'536172');
 // low perimeter walls, leaving an opening at the ramp
 box(0,.22,-12.4,33,.5,.23,'8995a0');box(16.4,.22,-.6,.23,.5,24,'8995a0');box(-16.4,.22,-7.3,.23,.5,10,'8995a0');box(-16.4,.22,7.8,.23,.5,7.2,'8995a0');
 // central cross aisle, access ramp and photo zone
 box(0,.003,2.95,32,.018,3.66,'71808b');box(-15.3,.04,3.0,2,.07,2.5,'72916c');box(-14.2,.025,8.7,2.6,.04,3.7,'6c8198');
 for(const {x} of streets){box(x,.006,-.7,.07,.02,22,'a0a9a8');}
 for(let i=1;i<routePath.length;i++){const p=routePath[i-1],q=routePath[i];box((p.x+q.x)/2,.065,(p.z+q.z)/2,Math.abs(p.x-q.x)+.18,.035,Math.abs(p.z-q.z)+.18,'62ccff');}for(const p of routePath)box(p.x,.075,p.z,.29,.04,.29,'62ccff');groundCount=vertices.length;
 for(const r of racks){for(const ns of [[1,3],[4,10]]){const a=cells.find(c=>c.street===r.street&&c.side===r.side&&c.n===ns[0]),b=cells.find(c=>c.street===r.street&&c.side===r.side&&c.n===ns[1]);if(ghostKeys.has(key(a)))continue;const z=(a.z+b.z)/2,d=Math.abs(a.z-b.z)+1.64;for(const xx of [r.x-RACK_WIDTH/2+.0425,r.x+RACK_WIDTH/2-.0425]){for(const zz of [z-d/2,z+d/2])box(xx,2.3,zz,.085,4.6,.085,'bc9158');for(let i=0;i<=5;i++)box(xx,.12+i*.88,z,.08,.085,d,'bc9158');}for(let n=ns[0];n<=ns[1];n++){const q=cells.find(c=>c.street===r.street&&c.side===r.side&&c.n===n);for(let i=0;i<=5;i++)box(r.x,.12+i*.88,q.z,RACK_WIDTH,.07,1.64,'77664e');}}}
 for(const c of cells){if(c!==selected&&ghostKeys.has(key(c)))continue;box(c.x,c.y,c.z,c.w,c.h,c.d,c===selected?'f5ca63':hits.includes(c)?'d09e50':c.items.length?'6bb58b':'53677a');}
 const opaque=vertices;
 vertices=ghostVertices;
 for(const s of sections){if(!ghostKeys.has(s.id))continue;
  // A translucent volume plus thin shelf outlines. Selected cell remains solid.
  box(s.x,s.h/2,s.z,s.w,s.h,s.d,'7893aa');
  for(const x of [s.x-s.w/2+.04,s.x+s.w/2-.04]){
   for(const z of [s.z-s.d/2,s.z+s.d/2])box(x,s.h/2,z,.08,s.h,.08,'c8d9e5');
   for(let i=0;i<=5;i++)box(x,.12+i*.88,s.z,.07,.07,s.d,'c8d9e5');
  }
  for(const z of [s.z-s.d/2,s.z+s.d/2])for(let i=0;i<=5;i++)box(s.x,.12+i*.88,z,s.w,.07,.07,'c8d9e5');
 }
 vertices=opaque;count=vertices.length/6;ghostCount=ghostVertices.length/6;
 if(gl){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices.concat(ghostVertices)),gl.STATIC_DRAW);}dirty=true;
}
function refreshOcclusion(){const next=new Set(walking?[]:blockers(basis.eye,selected));if(next.size===ghostKeys.size&&[...next].every(k=>ghostKeys.has(k)))return;ghostKeys=next;build();$('ghost-info').hidden=!next.size;$('ghost-info').textContent='Прозрачные секции: '+next.size;}
const markers=points.map(p=>({point:p,pos:[p.x,p.id==='photo'?.5:1.0,p.z],el:tag(p.name,p)}));const selectionTag=tag('');selectionTag.classList.add('active');selectionTag.hidden=true;
function tag(text,point){const el=document.createElement(point?'button':'span');el.className=point?'tag scene-pin':'tag';el.textContent=text;if(point){el.type='button';el.setAttribute('aria-label','Перейти к точке '+point.name);el.setAttribute('aria-pressed',String(point.id===origin?.id));el.onclick=()=>choosePoint(point);}labels.appendChild(el);return el;}
function project(pos){let v=sub(pos,basis.eye),d=dot(v,basis.forward);if(d<.3)return null;let x=dot(v,basis.right)*basis.zoom/(basis.aspect*d),y=dot(v,basis.up)*basis.zoom/d;return [(x+1)*canvas.clientWidth/2,(1-y)*canvas.clientHeight/2];}
function place(el,p){const xy=project(p);el.hidden=!xy||xy[0]<0||xy[1]<0||xy[0]>canvas.clientWidth||xy[1]>canvas.clientHeight;if(!el.hidden){el.style.left=xy[0]+'px';el.style.top=xy[1]+'px';}}
function drawCanvas(w,h){
 ctx.fillStyle='#1b2633';ctx.fillRect(0,0,w,h);
 const faces=[],geometry=vertices.concat(ghostVertices),near=.22;
 for(let i=0;i<geometry.length;i+=36){
  const poly=[0,6,12,30].map(j=>{const v=sub(geometry.slice(i+j,i+j+3),basis.eye);return [dot(v,basis.right),dot(v,basis.up),dot(v,basis.forward)];});
  const clipped=[];
  for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],inside=p[2]>=near,next=q[2]>=near;if(inside)clipped.push(p);if(inside!==next){const t=(near-p[2])/(q[2]-p[2]);clipped.push(p.map((v,j)=>v+(q[j]-v)*t));}}
  if(clipped.length<3)continue;
  const pts=clipped.map(([x,y,d])=>[(1+x*basis.zoom/(basis.aspect*d))*w/2,(1-y*basis.zoom/d)*h/2]);
  faces.push({pts,depth:clipped.reduce((s,p)=>s+p[2],0)/clipped.length,ground:i<groundCount,order:i,color:geometry.slice(i+3,i+6),ghost:i>=vertices.length});
 }
 faces.sort((a,b)=>a.ground!==b.ground?(a.ground?-1:1):a.ground?a.order-b.order:b.depth-a.depth);
 for(const f of faces){ctx.beginPath();f.pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='rgb('+f.color.map(n=>Math.round(n*255)).join(',')+')';ctx.globalAlpha=f.ghost?.13:1;ctx.fill();}ctx.globalAlpha=1;
}
function frame(t){requestAnimationFrame(frame);flushGesture();if(animation){let u=clamp((t-animation.start)/animation.duration,0,1),k=animation.linear?u:u*u*(3-2*u);
for(const key of ['yaw','pitch','distance'])cam[key]=animation.from[key]+(animation.to[key]-animation.from[key])*k;
if(animation.eyeFrom){const eye=animation.eyeFrom.map((x,i)=>x+(animation.eyeTo[i]-x)*k);cam.target=targetFromEye(eye,cam.yaw,cam.pitch,cam.distance);}
else cam.target=animation.from.target.map((x,i)=>x+(animation.to.target[i]-x)*k);
if(u>=1){animation=null;if(flight.length){startWalkStep(flight.shift());}else if(walking){walking=false;updateActions();$('message').textContent='На месте: '+(selected?.id||'');$('route-caption').textContent='На месте · '+(selected?.id||'');}}dirty=true;}
 const ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;dirty=true;}if(!dirty)return;dirty=false;basis=camera();refreshOcclusion();dirty=false;if(gl){gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);for(const k of ['eye','right','up','forward'])gl.uniform3fv(uniforms[k],basis[k]);gl.uniform1f(uniforms.aspect,basis.aspect);gl.uniform1f(uniforms.zoom,basis.zoom);gl.uniform1f(uniforms.opacity,1);gl.drawArrays(gl.TRIANGLES,0,count);if(ghostCount){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(uniforms.opacity,.13);gl.drawArrays(gl.TRIANGLES,count,ghostCount);gl.depthMask(true);gl.disable(gl.BLEND);}}else drawCanvas(w,h);for(const m of markers){if(walking&&walkView)m.el.hidden=true;else place(m.el,m.pos);}if(selected&&!(walking&&walkView)){const xy=project([selected.x,selected.y+.56,selected.z]);const w=canvas.clientWidth,h=canvas.clientHeight;const off=!xy||xy[0]<45||xy[0]>w-45||xy[1]<24||xy[1]>h-35;selectionTag.hidden=false;selectionTag.classList.toggle('offscreen',off);selectionTag.textContent=(off?'Цель: ':'')+selected.id;selectionTag.style.left=(xy?clamp(xy[0],65,Math.max(65,w-65)):w/2)+'px';selectionTag.style.top=(xy?clamp(xy[1],48,Math.max(48,h-45)):55)+'px';}else selectionTag.hidden=true;updateCameraDot();}
function targetFromEye(eye,yaw,pitch,distance){return sub(eye,[distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch)]);}
function move(to,duration=550){animation={start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:duration,from:{...cam,target:[...cam.target]},to:{...cam,...to,yaw:cam.yaw+wrapAngle((to.yaw??cam.yaw)-cam.yaw)}};}
function stopFlight(){const was=walking;flight=[];animation=null;walking=false;if(was){dirty=true;updateActions();$('route-caption').textContent='Маршрут остановлен';}}
function startWalkStep(step){const p=step.pose;const from=camera().eye;move({target:targetFromEye(p.eye,p.yaw,p.pitch,p.distance),yaw:p.yaw,pitch:p.pitch,distance:p.distance},step.duration);animation.eyeFrom=from;animation.eyeTo=p.eye;animation.linear=step.phase==='walk';walkView=step.phase!=='approach';$('route-caption').textContent=step.phase==='approach'?'К точке '+origin.name:step.phase==='descend'?'Спуск к началу маршрута':step.phase==='arrive'?'Поворот к '+selected.id:step.phase==='turn'?'Поворот в проход':'Движение по проходу';}
function overview(top=false){stopFlight();walkView=false;move({target:[0,0,-.5],yaw:top?0:.24,pitch:top?1.54:.78,distance:canvas.clientWidth/canvas.clientHeight<1.15?60:47});}
function clearRoute(rebuild=true){stopFlight();routePath=[];if(rebuild)build();drawMini();updateActions();}
let inventoryReady=false,lastQuery='';
function renderCellDetail(){
 if(!selected)return;
 $('address').textContent=selected.id;
 $('detail').textContent=!inventoryReady?'Содержимое ячейки будет доступно после подключения к Warehouse Map.':selected.items.length?selected.items.join('\n'):'Ячейка пустая.';
}
function select(c){clearRoute(false);selected=c;renderCellDetail();build();drawMini();updateActions();}
function renderMatches(){const result=$('results');result.replaceChildren();result.hidden=hits.length<2;
 for(const c of hits){const b=document.createElement('button');b.type='button';b.textContent=c.id+(inventoryReady?' · '+c.items.length+' поз.':'');b.onclick=()=>select(c);result.append(b);}
}
function refreshInventory(data,ready){
 inventoryReady=ready;const stats=applyInventory(ready?data:null);
 $('occupied-count').textContent=ready?String(stats.occupied):'—';
 $('stock-badge').textContent=ready?stats.occupied+' / '+stats.total+' занято':'450 ячеек';
 if(lastQuery){
  hits=search(lastQuery);renderMatches();
  if(!selected||!hits.includes(selected)){clearRoute(false);selected=hits[0]||null;}
  if(!selected){$('address').textContent='Не найдено';$('detail').textContent=ready?'Совпадений нет.': 'Войдите в Warehouse Map для поиска товаров.';}
  $('message').textContent=ready?'Найдено: '+hits.length: 'Для поиска товара необходимо подключение.';
 }
 renderCellDetail();build();drawMini();updateActions();
}
window.WarehouseInventory={refresh:refreshInventory};
function runSearch(q){clearRoute(false);lastQuery=q.trim();hits=search(q);renderMatches();if(!hits.length){selected=null;$('address').textContent='Не найдено';$('detail').textContent=inventoryReady?'Проверьте адрес, артикул или название детали.':'Для поиска товара войдите через Google. Адрес ячейки можно найти без входа.';$('message').textContent='Совпадений нет.';build();drawMini();updateActions();return;}$('message').textContent='Найдено: '+hits.length+'. Выберите действие.';select(hits[0]);}
function hasStreetOrigin(){return !!origin&&streets.some(s=>s.id===origin.id);}
function updateActions(){$('show-cell').disabled=!selected;$('route-cell').disabled=!walking&&(!selected||!hasStreetOrigin());$('route-cell').textContent=walking?'Остановить':'Проложить путь';$('clear-route').hidden=!routePath.length;$('clear-selection').hidden=!selected;$('route-caption').textContent=!hasStreetOrigin()?'Выберите S1–S5':!selected?'Выберите ячейку':origin.name+' → '+selected.id;}
function showCell(){if(!selected)return;clearRoute(false);build();drawMini();updateActions();$('message').textContent='Ячейка '+selected.id+' отмечена на модели и мини-карте. Камера не перемещается.';}
function navigationDistance(width,height){const aspect=Math.max(.25,canvas.clientWidth/Math.max(1,canvas.clientHeight));return Math.max(height,width/aspect)/(2*Math.tan(Math.PI/8));}
function flyRoute(){
 if(walking){stopFlight();return;}
 if(!selected||!hasStreetOrigin())return;
 stopFlight();const plan=walkingPlan(origin,selected,route,streets);if(!plan.length)return;
 routePath=route(origin,selected);walking=true;walkView=false;flight=plan;
 build();drawMini();updateActions();startWalkStep(flight.shift());
 $('message').textContent='Маршрут: '+origin.name+' → '+selected.id;
}
const miniSvg=$('mini-svg'),miniPins=$('mini-pins'),NS='http://www.w3.org/2000/svg';
const miniXY=(x,z)=>[(x+17)*10,(z+13)*10];
function shape(tag,attrs){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));miniSvg.append(node);return node;}
const pinButtons=new Map();
for(const p of points){const special=p.id==='entry'||p.id==='photo';const b=document.createElement('button');b.type='button';b.className=special?'mini-special-button':'map-pin';b.textContent=p.name;b.title=p.name;b.setAttribute('aria-label','Перейти к точке '+p.name);if(!special){const [x,y]=miniXY(p.x,p.z);b.style.left=x/340*100+'%';b.style.top=y/250*100+'%';}b.onclick=()=>choosePoint(p);(special?$('mini-special'):miniPins).append(b);pinButtons.set(p.id,b);}
let cameraDot;
function drawMini(){miniSvg.replaceChildren();shape('rect',{x:5,y:5,width:330,height:240,rx:7,fill:'#162330','fill-opacity':.48,stroke:'#8395a7','stroke-opacity':.7});shape('rect',{x:7,y:141.2,width:326,height:36.6,fill:'#8696a3','fill-opacity':.16});for(const r of racks){for(const ns of [[1,3],[4,10]]){const a=cells.find(c=>c.street===r.street&&c.side===r.side&&c.n===ns[0]),b=cells.find(c=>c.street===r.street&&c.side===r.side&&c.n===ns[1]);const [x,y]=miniXY(r.x-RACK_WIDTH/2,Math.min(a.z,b.z)-.82);shape('rect',{x,y,width:RACK_WIDTH*10,height:(Math.abs(a.z-b.z)+1.64)*10,rx:2,fill:'#b0bdc9','fill-opacity':.40,stroke:'#d1dce5','stroke-opacity':.52});}}
for(const p of points.filter(p=>p.id==='entry'||p.id==='photo')){const [x,y]=miniXY(p.x,p.z);shape('circle',{cx:x,cy:y,r:5,fill:p.id===origin?.id?'#83d8ff':'#a0b2c4',stroke:'#132433','stroke-width':2});}
if(routePath.length){let coords=routePath.map(p=>miniXY(p.x,p.z).join(',')).join(' ');if(selected)coords+=' '+miniXY(selected.x,selected.z).join(',');shape('polyline',{points:coords,fill:'none',stroke:'#62ccff','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round'});}
if(selected){const [x,y]=miniXY(selected.x,selected.z);shape('rect',{x:x-7,y:y-8,width:14,height:16,rx:2,fill:'#f5ca63',stroke:'#fff2bc','stroke-width':2});}
cameraDot=shape('circle',{cx:0,cy:0,r:4.5,fill:'#fff',stroke:'#131d27','stroke-width':1.5});updateCameraDot();
for(const p of points)pinButtons.get(p.id).setAttribute('aria-pressed',String(p.id===origin?.id));for(const m of markers)m.el.setAttribute('aria-pressed',String(m.point.id===origin?.id));$('mini-origin').textContent='Откуда: '+(hasStreetOrigin()?origin.name:'выберите S1–S5');$('origin-info').textContent=hasStreetOrigin()?'Откуда: '+origin.name+'.':'Выберите улицу S1–S5 на 3D-карте или мини-карте.';}
function updateCameraDot(){if(!cameraDot)return;const p=walkView&&basis?basis.eye:cam.target;const [x,y]=miniXY(p[0],p[2]);cameraDot.setAttribute('cx',clamp(x,5,335));cameraDot.setAttribute('cy',clamp(y,5,245));}
function choosePoint(p){clearRoute(false);walkView=false;origin=p;build();drawMini();updateActions();move({target:[p.x*.72,.3,p.z*.72],yaw:.12,pitch:1.20,distance:navigationDistance(29,25)},650);$('message').textContent='Точка отправления: '+p.name+'. '+(!hasStreetOrigin()?'Для маршрута выберите S1–S5.':selected?'Можно проложить путь.':'Найдите ячейку.');}
$('clear-selection').onclick=()=>{clearRoute(false);selected=null;hits=[];lastQuery='';$('address').textContent='Не выбрана';$('detail').textContent='Нажмите на ячейку или найдите её по адресу.';$('results').hidden=true;$('search').value='';$('message').textContent='Выделение снято.';build();drawMini();updateActions();};$('show-cell').onclick=showCell;$('route-cell').onclick=flyRoute;$('clear-route').onclick=()=>{clearRoute();$('message').textContent='Маршрут убран.';};$('mini-toggle').onclick=()=>{const open=$('mini-body').hidden;$('mini-body').hidden=!open;$('minimap').classList.toggle('collapsed',!open);$('mini-chevron').textContent=open?'−':'+';$('mini-toggle').setAttribute('aria-expanded',String(open));$('mini-toggle').setAttribute('aria-label',open?'Свернуть мини-карту':'Развернуть мини-карту');};
$('search-form').onsubmit=e=>{e.preventDefault();runSearch($('search').value);};$('example').onclick=()=>{$('search').value='S3, K7';runSearch($('search').value);};$('overview').onclick=()=>overview();$('top').onclick=()=>overview(true);function zoom(f){stopFlight();cam.distance=clamp(cam.distance*f,2.8,100);dirty=true;}$('plus').onclick=()=>zoom(.8);$('minus').onclick=()=>zoom(1.25);
function rayPick(x,y){const rect=canvas.getBoundingClientRect();let nx=2*(x-rect.left)/rect.width-1,ny=1-2*(y-rect.top)/rect.height;const dir=norm(add(add(basis.forward,mul(basis.right,nx*basis.aspect/basis.zoom)),mul(basis.up,ny/basis.zoom)));let best=Infinity,hit=null;for(const c of cells){if(c!==selected&&ghostKeys.has(key(c)))continue;let lo=0,hi=Infinity;for(let i=0;i<3;i++){let center=[c.x,c.y,c.z][i],size=[c.w,c.h,c.d][i]/2,origin=basis.eye[i];if(Math.abs(dir[i])<1e-8){if(origin<center-size||origin>center+size){hi=-1;break;}continue;}let a=(center-size-origin)/dir[i],b=(center+size-origin)/dir[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}if(lo<=hi&&lo<best){best=lo;hit=c;}}if(hit){hits=[];lastQuery='';$('results').hidden=true;$('message').textContent='Выбрано на модели.';select(hit);}}
// Pan in the camera's viewing plane, including world height when tilted.
function pan(dx,dy){
 const scale=2*cam.distance*Math.tan(Math.PI/8)/Math.max(1,canvas.clientHeight);
 const right=[Math.cos(cam.yaw),0,-Math.sin(cam.yaw)];
 const up=[-Math.sin(cam.yaw)*Math.sin(cam.pitch),Math.cos(cam.pitch),-Math.cos(cam.yaw)*Math.sin(cam.pitch)];
 cam.target=add(cam.target,add(mul(right,-dx*scale),mul(up,dy*scale)));
 dirty=true;
}
function gestureDelta(prev,next){
 const dx=(next[0].x+next[1].x-prev[0].x-prev[1].x)/2,dy=(next[0].y+next[1].y-prev[0].y-prev[1].y)/2;
 const ax=prev[1].x-prev[0].x,ay=prev[1].y-prev[0].y,bx=next[1].x-next[0].x,by=next[1].y-next[0].y;
 const before=Math.hypot(ax,ay),after=Math.hypot(bx,by);
 return {dx,dy,zoom:before>8&&after>8?before/after:1,twist:before>8&&after>8?Math.atan2(ax*by-ay*bx,ax*bx+ay*by):0};
}
const pointers=new Map();let start=null,moved=false,previousPair=null,pairDirty=false,orbitMode=false;
const pair=()=>[...pointers.values()].map(p=>({...p}));
function resetPair(){previousPair=pointers.size===2?pair():null;pairDirty=false;}
function flushGesture(){
 if(!pairDirty||pointers.size!==2||!previousPair)return;
 const next=pair(),g=gestureDelta(previousPair,next);previousPair=next;pairDirty=false;
 stopFlight();
 cam.distance=clamp(cam.distance*g.zoom,2.8,100);
 if(orbitMode){
  cam.yaw=wrapAngle(cam.yaw-g.dx*.007-g.twist);
  cam.pitch=clamp(cam.pitch+g.dy*.006,.09,1.54);
 }else{
  pan(g.dx,g.dy);
  cam.yaw=wrapAngle(cam.yaw-g.twist);
 }
 dirty=true;
}
$('gesture-mode').onclick=()=>{
 flushGesture();orbitMode=!orbitMode;resetPair();
 $('gesture-mode').textContent=orbitMode?'2 пальца: поворот':'2 пальца: сдвиг';
 $('gesture-mode').setAttribute('aria-pressed',String(orbitMode));
 $('hint').textContent=orbitMode?'2 пальца — поворот и наклон · щипок — зум':'2 пальца — сдвиг, скручивание — поворот, щипок — зум';
};
canvas.addEventListener('pointerdown',e=>{
 flushGesture();stopFlight();canvas.setPointerCapture(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===1){start={x:e.clientX,y:e.clientY,button:e.button};moved=false;}else moved=true;
 resetPair();
});
canvas.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 const old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){pairDirty=true;moved=true;}
 else if(pointers.size===1&&start){
  if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)moved=true;
  if(moved){if(start.button===2||e.shiftKey)pan(dx,dy);else{cam.yaw=wrapAngle(cam.yaw-dx*.007);cam.pitch=clamp(cam.pitch+dy*.006,.09,1.54);}dirty=true;}
 }
});
function finishPointer(e,cancel=false){
 if(!pointers.has(e.pointerId))return;
 flushGesture();
 if(!cancel&&pointers.size===1&&!moved&&start&&start.button===0&&basis)rayPick(e.clientX,e.clientY);
 pointers.delete(e.pointerId);resetPair();
 if(pointers.size===1){const p=pointers.values().next().value;start={x:p.x,y:p.y,button:0};moved=true;}
 else if(!pointers.size){start=null;moved=false;}
 else moved=true;
}
canvas.addEventListener('pointerup',e=>finishPointer(e));
canvas.addEventListener('pointercancel',e=>finishPointer(e,true));
canvas.addEventListener('lostpointercapture',e=>finishPointer(e,true));canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
cam.distance=canvas.clientWidth/canvas.clientHeight<1.15?60:47;build();drawMini();updateActions();requestAnimationFrame(frame);
})();
