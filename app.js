(()=>{'use strict';
const {cells,racks,streets,search,cellArticles,cellFocusPose,linkedCellMatches,routeDistance,articlePopupPosition,points,route,sections,RACK_WIDTH,applyInventory,walkingPlan,orderStreetStart,streetOverviewPose,exactArticleMatches,mapLinkQuery}=WarehouseLayout;
const $=id=>document.getElementById(id), canvas=$('gl'), labels=$('labels'), stage=$('stage');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
const ctx=gl?null:canvas.getContext('2d');if(!gl&&!ctx){$('error').hidden=false;$('error').textContent='3D-рендерер недоступен в этом браузере.';return;}
const vsrc='attribute vec3 p;attribute vec3 c;uniform vec3 eye,right,up,forward;uniform float aspect,zoom;varying vec3 color;void main(){vec3 v=p-eye;float d=dot(v,forward);gl_Position=vec4(dot(v,right)*zoom/aspect,dot(v,up)*zoom,1.00040008*d-.40008002,d);color=c;}';
const fsrc='precision mediump float;varying vec3 color;void main(){gl_FragColor=vec4(color,1.0);}';
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
let program,P,C,uniforms,buffer,contextLost=false;
function initGL(){if(gl){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vsrc));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
P=gl.getAttribLocation(program,'p');C=gl.getAttribLocation(program,'c');uniforms=Object.fromEntries(['eye','right','up','forward','aspect','zoom'].map(n=>[n,gl.getUniformLocation(program,n)]));
buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(P);gl.enableVertexAttribArray(C);gl.vertexAttribPointer(P,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(C,3,gl.FLOAT,false,24,12);gl.enable(gl.DEPTH_TEST);gl.clearColor(.105,.15,.20,1);}}
try{initGL();}catch(e){$('error').hidden=false;$('error').textContent='Не удалось запустить 3D-графику. Обновите страницу или откройте карту в Chrome.';console.error(e);return;}
let selected=null, hits=[], vertices=[], count=0, dirty=true, animation=null, flight=[], routePath=[], origin=null,walking=false,walkView=false, groundCount=0;
let frameQueued=false,routeArrived=false,routeStep=0,routeSteps=0,hiddenAt=null;
function scheduleFrame(){if(!frameQueued&&!contextLost){frameQueued=true;requestAnimationFrame(frame);}}
function invalidate(){dirty=true;scheduleFrame();}
const mul=(a,k)=>a.map(x=>x*k),add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>mul(a,1/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const HALF_FOV=65*Math.PI/360;
const cam={target:[0,0,0],yaw:.24,pitch:.78,distance:47};
const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
let basis;
function cameraAxes(yaw,pitch){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch);
 // Exact vertical view: no floating point height drift or singular cross product.
 const cp=Math.abs(Math.abs(pitch)-Math.PI/2)<1e-9?0:Math.cos(pitch);
 return {right:[cy,0,-sy],up:[-sy*sp,cp,-cy*sp],forward:[-sy*cp,-sp,-cy*cp]};
}
function camera(){const {target,yaw,pitch,distance}=cam;const axes=cameraAxes(yaw,pitch);const eye=sub(target,mul(axes.forward,distance));return {eye,...axes,aspect:canvas.width/canvas.height,zoom:1/Math.tan(HALF_FOV)};}
const rgb=h=>[parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];
function box(x,y,z,w,h,d,hex){const a=w/2,b=h/2,e=d/2;const v=[[-a,-b,-e],[a,-b,-e],[a,b,-e],[-a,b,-e],[-a,-b,e],[a,-b,e],[a,b,e],[-a,b,e]].map(p=>add(p,[x,y,z]));const color=rgb(hex);for(const [ids,shade] of [[[0,1,2,3],.7],[[4,5,6,7],.93],[[0,4,7,3],.76],[[1,5,6,2],.84],[[3,2,6,7],1.15],[[0,1,5,4],.55]]){let c=color.map(n=>Math.min(n*shade,1));for(const i of [0,1,2,0,2,3])vertices.push(...v[ids[i]],...c);}}
// Orientation landmarks only: approximate geometry, no extra stock cells.
function buildLandmarks(){
 // Open north end: show adjoining warehouse floor continuing beyond our racks.
 box(0,-.18,-16.6,33,.32,8,'465664');
 // Side walls continue in the same direction, without a closing end wall.
 for(const x of [-16.4,16.4])box(x,.22,-16.6,.23,.5,8,'8995a0');
 // Subtle boundary stripe and longitudinal guide lines on the adjoining floor.
 box(0,.003,-12.6,32.7,.018,.13,'9eacb6');
 for(const {x} of streets)box(x,.006,-16.6,.07,.02,8,'788994');
 // Staircase at the south end of S5. It sits outside the addressable floor.
 const x=12.4,z=11.4,steps=7,rise=.20,run=.32,width=1.65;
 box(x,-.18,z+1.12,2.25,.32,2.5,'536172');
 for(let i=0;i<steps;i++){
  const height=(i+1)*rise;
  box(x,height/2,z+(i+.5)*run,width,height,run,'a1adb8');
  box(x,height+.006,z+(i+1)*run-.04,width,.012,.055,'d3dce2');
 }
 for(const side of [-1,1]){
  const xx=x+side*(width/2+.065);
  for(let i=0;i<steps;i+=2){
   const height=(i+1)*rise;
   box(xx,height+.43,z+(i+.5)*run,.065,.86,.065,'8995a0');
  }
 }
}
function build(){vertices=[];box(0,-.18,-.6,33,.32,24,'536172');
 buildLandmarks();
 // low perimeter walls, leaving an opening at the ramp and adjoining warehouse
 box(16.4,.22,-.6,.23,.5,24,'8995a0');box(-16.4,.22,-7.3,.23,.5,10,'8995a0');box(-16.4,.22,7.8,.23,.5,7.2,'8995a0');
 // central cross aisle, access ramp and photo zone
 box(0,.003,2.95,32,.018,3.66,'71808b');box(-15.3,.04,3.0,2,.07,2.5,'72916c');box(-14.2,.025,8.7,2.6,.04,3.7,'6c8198');
 for(const {x} of streets){box(x,.006,-.7,.07,.02,22,'a0a9a8');}
 for(let i=1;i<routePath.length;i++){const p=routePath[i-1],q=routePath[i];box((p.x+q.x)/2,.051,(p.z+q.z)/2,Math.abs(p.x-q.x)+.32,.025,Math.abs(p.z-q.z)+.32,'25485d');box((p.x+q.x)/2,.075,(p.z+q.z)/2,Math.abs(p.x-q.x)+.18,.035,Math.abs(p.z-q.z)+.18,'62ccff');}
 if(routePath.length){const first=routePath[0],last=routePath.at(-1);box(first.x,.10,first.z,.52,.06,.52,'a9e878');box(last.x,.10,last.z,.58,.06,.58,'f5ca63');}
 groundCount=vertices.length;
 const matches=new Set(hits);
 for(const s of sections){
  const d=s.d-.02;
  for(const xx of [s.x-RACK_WIDTH/2+.0425,s.x+RACK_WIDTH/2-.0425]){
   for(const zz of [s.z-d/2,s.z+d/2])box(xx,2.3,zz,.085,4.6,.085,'bc9158');
   for(let i=0;i<=5;i++)box(xx,.12+i*.88,s.z,.08,.085,d,'bc9158');
  }
  for(const q of s.members.filter(c=>c.letter===s.members[0].letter))for(let i=0;i<=5;i++)box(s.x,.12+i*.88,q.z,RACK_WIDTH,.07,1.64,'77664e');
  for(const c of s.members)box(c.x,c.y,c.z,c.w,c.h,c.d,c===selected?'f5ca63':matches.has(c)?'d09e50':c.items.length?'6bb58b':'53677a');
 }
 count=vertices.length/6;
 if(gl){if(!contextLost){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);}vertices=[];}
 invalidate();
}
const markers=points.map(p=>({point:p,pos:[p.x,p.id==='photo'?.5:1.0,p.z],el:tag(p.name,p)}));const selectionTag=tag('');selectionTag.classList.add('active');selectionTag.hidden=true;
const landmarkLabels=[
 {pos:[0,.1,-16.6],el:tag('↑ Продолжение склада')},
 {pos:[12.4,1.5,12.65],el:tag('Лестница')}
];
for(const m of landmarkLabels){m.el.classList.add('landmark-tag');m.el.hidden=true;}
const articlePopup=document.createElement('div');articlePopup.className='cell-article-popup';articlePopup.hidden=true;articlePopup.setAttribute('aria-label','Артикулы выбранной ячейки');labels.appendChild(articlePopup);let popupRows=0,popupWidth=0,popupHeight=0;
function renderArticlePopup(){
 articlePopup.replaceChildren();popupRows=0;popupWidth=0;popupHeight=0;if(!selected||!inventoryReady){articlePopup.hidden=true;return;}
 const articles=cellArticles(selected.items),rows=articles.slice(0,5);
 if(!rows.length)rows.push(selected.items.length?'Нет артикулов':'Пусто');
 if(articles.length>5)rows.push('+'+(articles.length-5)+' ещё');
 for(const text of rows){const row=document.createElement('div');row.textContent=text;articlePopup.appendChild(row);}popupRows=rows.length;
}
function placeArticlePopup(xy,off,w,h){
 if(!popupRows||off||!xy||w<80){articlePopup.hidden=true;return;}
 // Measure intrinsic dimensions only when contents or viewport width changes.
 if(!popupWidth||popupWidth>w-10){
  articlePopup.hidden=false;articlePopup.style.maxWidth=Math.min(112,w-10)+'px';
  popupWidth=articlePopup.offsetWidth;popupHeight=articlePopup.offsetHeight;
 }
 const rect=labels.getBoundingClientRect();
 const visible=[selectionTag,...markers.map(m=>m.el),...landmarkLabels.map(m=>m.el),$('route-overlay'),$('result-panel'),stage.querySelector('.map-tools'),stage.querySelector('.legend')];
 const obstacles=visible.filter(el=>el&&!el.hidden&&el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {left:r.left-rect.left,right:r.right-rect.left,top:r.top-rect.top,bottom:r.bottom-rect.top};});
 const pos=articlePopupPosition({x:xy[0],y:xy[1],width:selectionTag.offsetWidth,height:selectionTag.offsetHeight},popupWidth,popupHeight,w,h,obstacles);
 if(!pos){articlePopup.hidden=true;return;}
 articlePopup.hidden=false;articlePopup.style.left=pos.left+'px';articlePopup.style.top=pos.top+'px';
}
function tag(text,point){const el=document.createElement(point?'button':'span');el.className=point?'tag scene-pin':'tag';el.textContent=text;if(point){el.type='button';el.setAttribute('aria-label','Перейти к точке '+point.name);el.setAttribute('aria-pressed',String(point.id===origin?.id));el.dataset.pointId=point.id;el.onclick=e=>{if(e.detail===0)choosePoint(point);};}labels.appendChild(el);return el;}
function project(pos){let v=sub(pos,basis.eye),d=dot(v,basis.forward);if(d<.3)return null;let x=dot(v,basis.right)*basis.zoom/(basis.aspect*d),y=dot(v,basis.up)*basis.zoom/d;return [(x+1)*canvas.clientWidth/2,(1-y)*canvas.clientHeight/2];}
function place(el,p){const xy=project(p);el.hidden=!xy||xy[0]<0||xy[1]<0||xy[0]>canvas.clientWidth||xy[1]>canvas.clientHeight;if(!el.hidden){el.style.left=xy[0]+'px';el.style.top=xy[1]+'px';}}
function drawCanvas(w,h){
 ctx.fillStyle='#1b2633';ctx.fillRect(0,0,w,h);
 const faces=[],geometry=vertices,near=.22;
 for(let i=0;i<geometry.length;i+=36){
  const poly=[0,6,12,30].map(j=>{const v=sub(geometry.slice(i+j,i+j+3),basis.eye);return [dot(v,basis.right),dot(v,basis.up),dot(v,basis.forward)];});
  const clipped=[];
  for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],inside=p[2]>=near,next=q[2]>=near;if(inside)clipped.push(p);if(inside!==next){const t=(near-p[2])/(q[2]-p[2]);clipped.push(p.map((v,j)=>v+(q[j]-v)*t));}}
  if(clipped.length<3)continue;
  const pts=clipped.map(([x,y,d])=>[(1+x*basis.zoom/(basis.aspect*d))*w/2,(1-y*basis.zoom/d)*h/2]);
  faces.push({pts,depth:clipped.reduce((s,p)=>s+p[2],0)/clipped.length,ground:i<groundCount,order:i,color:geometry.slice(i+3,i+6)});
 }
 faces.sort((a,b)=>a.ground!==b.ground?(a.ground?-1:1):a.ground?a.order-b.order:b.depth-a.depth);
 for(const f of faces){ctx.beginPath();f.pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='rgb('+f.color.map(n=>Math.round(n*255)).join(',')+')';ctx.fill();}
}
// Use the physical display resolution, bounded by a GPU-friendly pixel budget.
function renderPixelRatio(width,height,dpr,webgl){
 const area=Math.max(1,width*height);
 return Math.min(Math.max(1,dpr),webgl?3:2,Math.sqrt((webgl?3200000:1600000)/area));
}
function frame(t){frameQueued=false;if(contextLost||document.hidden)return;flushGesture();if(animation||touch.active())scheduleFrame();if(animation){let u=clamp((t-animation.start)/animation.duration,0,1),k=animation.linear?u:u*u*(3-2*u);
for(const key of ['yaw','pitch','distance'])cam[key]=animation.from[key]+(animation.to[key]-animation.from[key])*k;
if(animation.eyeFrom){const eye=animation.eyeFrom.map((x,i)=>x+(animation.eyeTo[i]-x)*k);cam.target=targetFromEye(eye,cam.yaw,cam.pitch,cam.distance);}
else cam.target=animation.from.target.map((x,i)=>x+(animation.to.target[i]-x)*k);
if(walking&&routeSteps)$('route-progress').value=Math.min(100,(routeStep-1+u)/routeSteps*100);
if(u>=1){animation=null;if(flight.length){startWalkStep(flight.shift());}else if(walking){walking=false;routeArrived=true;updateActions();$('message').textContent='На месте: '+(selected?.id||'');$('route-caption').textContent='На месте · '+(selected?.id||'');}}dirty=true;}
 const ratio=renderPixelRatio(canvas.clientWidth,canvas.clientHeight,devicePixelRatio||1,!!gl),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;dirty=true;}if(!dirty)return;dirty=false;basis=camera();if(gl){gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);for(const k of ['eye','right','up','forward'])gl.uniform3fv(uniforms[k],basis[k]);gl.uniform1f(uniforms.aspect,basis.aspect);gl.uniform1f(uniforms.zoom,basis.zoom);gl.drawArrays(gl.TRIANGLES,0,count);}else drawCanvas(w,h);for(const m of markers){if(walking&&walkView)m.el.hidden=true;else place(m.el,m.pos);}for(const m of landmarkLabels)place(m.el,m.pos);if(selected&&!(walking&&walkView)){const xy=project([selected.x,selected.y+.56,selected.z]);const w=canvas.clientWidth,h=canvas.clientHeight;const off=!xy||xy[0]<45||xy[0]>w-45||xy[1]<24||xy[1]>h-35;selectionTag.hidden=false;selectionTag.classList.toggle('offscreen',off);selectionTag.textContent=(off?'Цель: ':'')+selected.id;selectionTag.style.left=(xy?clamp(xy[0],65,Math.max(65,w-65)):w/2)+'px';selectionTag.style.top=(xy?clamp(xy[1],48,Math.max(48,h-45)):55)+'px';placeArticlePopup([xy?clamp(xy[0],65,Math.max(65,w-65)):w/2,xy?clamp(xy[1],48,Math.max(48,h-45)):55],off,w,h);}else{selectionTag.hidden=true;articlePopup.hidden=true;}}
function targetFromEye(eye,yaw,pitch,distance){return sub(eye,[distance*Math.sin(yaw)*Math.cos(pitch),distance*Math.sin(pitch),distance*Math.cos(yaw)*Math.cos(pitch)]);}
function move(to,duration=550){animation={start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:duration,from:{...cam,target:[...cam.target]},to:{...cam,...to,yaw:cam.yaw+wrapAngle((to.yaw??cam.yaw)-cam.yaw)}};scheduleFrame();}
function stopFlight(){const was=walking;flight=[];animation=null;walking=false;hiddenAt=null;if(was){invalidate();updateActions();$('route-caption').textContent='Маршрут остановлен';}}
const WALK_SPEEDS=[.5,.75,1,1.25,1.5,2,3];
function validWalkSpeed(value){const n=Number(value);return WALK_SPEEDS.includes(n)?n:3;}
let walkSpeed=3;
try{walkSpeed=validWalkSpeed(localStorage.getItem('warehouse3d.walkSpeed'));}catch{}
function retimeWalk(step,now,speed){
 if(!step||step.phase!=='walk'||step.reducedMotion)return;
 const progress=clamp((now-step.start)/step.duration,0,1);
 step.duration=step.baseDuration/speed;
 step.start=now-progress*step.duration;
}
function setWalkSpeed(value){
 walkSpeed=validWalkSpeed(value);
 $('walk-speed').value=String(walkSpeed);
 retimeWalk(animation,performance.now(),walkSpeed);
 try{localStorage.setItem('warehouse3d.walkSpeed',String(walkSpeed));}catch{}
}
function startWalkStep(step){routeStep++;const p=step.pose;const from=camera().eye;move({target:targetFromEye(p.eye,p.yaw,p.pitch,p.distance),yaw:p.yaw,pitch:p.pitch,distance:p.distance},step.phase==='walk'?step.duration/walkSpeed:step.duration);animation.phase=step.phase;animation.baseDuration=step.duration;animation.reducedMotion=animation.duration===1;animation.eyeFrom=from;animation.eyeTo=p.eye;animation.linear=step.phase==='walk';walkView=step.phase!=='approach';$('route-caption').textContent=step.phase==='approach'?'К точке '+origin.name:step.phase==='descend'?'Спуск к началу маршрута':step.phase==='arrive'?'Поворот к '+selected.id:step.phase==='turn'?'Поворот в проход':'Движение по проходу';}
function overview(top=false){stopFlight();walkView=false;const fit=wideStreetPose({x:0,z:-.6});move(top?fit:{target:[0,0,-.5],yaw:.24,pitch:.78,distance:Math.max(47,fit.distance)});}
function clearRoute(rebuild=true){stopFlight();routePath=[];routeArrived=false;routeStep=0;routeSteps=0;if(rebuild)build();updateNavigationMarkers();updateActions();}
let inventoryReady=false,lastQuery='',linkedOrder=null,resultsExpanded=true,manualOrigin=false,lastClearedCell=null;
function linkedHits(){return linkedCellMatches(linkedOrder,inventoryReady);}
function focusOrderStreet(cell){
 const start=orderStreetStart(cell,points,route,streets);
 if(!start)return;
 stopFlight();origin=start.origin;walkView=false;
 Object.assign(cam,wideStreetPose(origin));
 basis=camera();invalidate();
}
function renderCellDetail(){renderArticlePopup();}
function select(c){clearRoute(false);selected=c;if(linkedOrder&&!manualOrigin)focusOrderStreet(c);renderCellDetail();build();updateNavigationMarkers();updateActions();}
function renderMatches(){const result=$('results');result.replaceChildren();
 for(const c of hits){const b=document.createElement('button');b.type='button';b.textContent=c.id;b.dataset.cellId=c.id;b.onclick=()=>{resultsExpanded=false;if(c===selected){updateSearchChooser();invalidate();}else select(c);};result.append(b);}
}
function updateSearchChooser(){
 const multiple=hits.length>1;
 $('result-panel').hidden=!lastQuery||(!multiple&&!!selected);
 $('results').hidden=!multiple||!resultsExpanded;
 $('toggle-results').hidden=!multiple;
 $('toggle-results').textContent=multiple?(selected?.id||'Адреса')+' · '+hits.length+(resultsExpanded?' ▴':' ▾'):'';
 $('toggle-results').setAttribute('aria-expanded',String(multiple&&resultsExpanded));
 $('result-count').hidden=multiple;
 $('result-count').textContent='Поиск';
 $('message').hidden=multiple;
 for(const b of $('results').children){const active=b.dataset.cellId===selected?.id;b.setAttribute('aria-pressed',String(active));if(active&&resultsExpanded){const list=$('results');if(b.offsetTop<list.scrollTop)list.scrollTop=b.offsetTop;else if(b.offsetTop+b.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=b.offsetTop+b.offsetHeight-list.clientHeight;}}
}
function focusSelected(){
 if(!selected)return;
 const pose=cellFocusPose(selected);if(!pose)return;
 stopFlight();walkView=false;move(pose,450);
}
$('toggle-results').onclick=()=>{resultsExpanded=!resultsExpanded;updateSearchChooser();invalidate();};
$('focus-cell').onclick=focusSelected;
function refreshInventory(data,ready){
 const wasReady=inventoryReady,previous=selected,oldHits=hits,oldItems=cells.map(c=>c.items);
 inventoryReady=ready;const stats=applyInventory(ready?data:null);
 const inventoryChanged=wasReady!==ready||cells.some((c,i)=>c.items!==oldItems[i]);
 if(!inventoryChanged)return;
 $('stock-badge').textContent=ready?stats.occupied+' / '+stats.total+' занято':'450 ячеек';
 if(lastQuery){
  hits=linkedOrder?linkedHits():search(lastQuery);renderMatches();
  if(!selected||!hits.includes(selected)){clearRoute(false);selected=hits[0]||null;if(linkedOrder&&selected&&!manualOrigin)focusOrderStreet(selected);}
  
  $('message').textContent=ready?(hits.length?'Найдено: '+hits.length:linkedOrder?'Артикул не найден в текущих остатках. Проверьте адрес в заказе.':'Совпадений нет.'):'Для поиска товара необходимо подключение.';
 }
 renderCellDetail();
 const geometryChanged=previous!==selected||oldHits.length!==hits.length||oldHits.some((c,i)=>c!==hits[i])||cells.some((c,i)=>!!c.items.length!==!!oldItems[i].length);
 if(geometryChanged)build();else invalidate();
 updateNavigationMarkers();updateActions();
}
window.WarehouseInventory={refresh:refreshInventory};
function runSearch(q){linkedOrder=null;manualOrigin=false;resultsExpanded=true;clearRoute(false);lastQuery=q.trim().slice(0,120);hits=search(q);renderMatches();if(!hits.length){selected=null;renderArticlePopup();$('message').textContent=/^S\s*[1-5]\s*[-,; ]*\s*[A-Z]/i.test(lastQuery)?'Такой ячейки нет на карте.':inventoryReady?'Совпадений нет.':'Для поиска товара войдите через Google.';build();updateNavigationMarkers();updateActions();return;}$('message').textContent='Найдено: '+hits.length+'. Выберите действие.';select(hits[0]);}
function hasStreetOrigin(){return !!origin&&streets.some(s=>s.id===origin.id);}
function updateActions(){
 $('route-origin').value=hasStreetOrigin()?origin.id:'';$('route-origin').disabled=walking;
 // Direct taps and single matches need only the anchored cell popup.
 // Multiple search addresses or a failed search use an out-of-flow overlay.
 updateSearchChooser();
 $('restore-cell').hidden=!!selected||!lastClearedCell||!!lastQuery;
 $('restore-cell').textContent=lastClearedCell?'↶ '+lastClearedCell:'';
 $('restore-cell').setAttribute('aria-label','Вернуть выделение '+(lastClearedCell||''));
 $('focus-cell').hidden=!selected;
 $('focus-cell').disabled=walking;
 $('route-cell').disabled=!walking&&!selected;
 $('route-cell').textContent=walking?'■ Остановить':'▶ В путь';
 $('clear-route').hidden=!routePath.length;
 const distance=selected&&hasStreetOrigin()?routeDistance(route(origin,selected)):0;
 $('route-distance').hidden=!(selected&&hasStreetOrigin());$('route-distance').textContent='≈ '+Math.round(distance)+' м по схеме';
 $('route-progress').hidden=!walking;if(!walking)$('route-progress').value=routeArrived?100:0;
 if(!walking)$('route-caption').textContent=routeArrived&&selected?'На месте · '+selected.id:!hasStreetOrigin()?'Выберите S1–S5':!selected?'Выберите ячейку':origin.name+' → '+selected.id;
}
function wideStreetPose(p){const rect=canvas.getBoundingClientRect();const w=rect.width||canvas.clientWidth||window.innerWidth||380,h=rect.height||canvas.clientHeight||window.innerHeight||640;return streetOverviewPose(p,Math.max(.25,w/Math.max(1,h)),HALF_FOV);}
function navigationDistance(width,height){const aspect=Math.max(.25,canvas.clientWidth/Math.max(1,canvas.clientHeight));return Math.max(height,width/aspect)/(2*Math.tan(HALF_FOV));}
function flyRoute(){
 if(walking){stopFlight();return;}
 if(!selected)return;
 if(!hasStreetOrigin()){$('route-caption').textContent='Сначала выберите свою улицу S1–S5';$('route-origin').focus();return;}
 stopFlight();const plan=walkingPlan(origin,selected,route,streets);if(!plan.length)return;
 routePath=route(origin,selected);walking=true;routeArrived=false;routeStep=0;walkView=false;flight=plan;
 const first=flight[0].pose,eye=camera().eye;
 if(Math.hypot(...eye.map((v,i)=>v-first.eye[i]))<.01&&Math.abs(wrapAngle(cam.yaw-first.yaw))<.01&&Math.abs(cam.pitch-first.pitch)<.01){flight.shift();walkView=true;}
 routeSteps=flight.length;build();updateNavigationMarkers();updateActions();startWalkStep(flight.shift());
 $('message').textContent='Маршрут: '+origin.name+' → '+selected.id;
}
function updateNavigationMarkers(){for(const m of markers)m.el.setAttribute('aria-pressed',String(m.point.id===origin?.id));}
function choosePoint(p){manualOrigin=true;clearRoute(false);walkView=false;origin=p;if(hasStreetOrigin()){try{localStorage.setItem('warehouse3d.origin',p.id);}catch{}}build();updateNavigationMarkers();updateActions();move(wideStreetPose(p),650);$('message').textContent='Точка отправления: '+p.name+'. '+(!hasStreetOrigin()?'Для маршрута выберите S1–S5.':selected?'Можно проложить путь.':'Найдите ячейку.');}
function clearSelection(){if(selected)lastClearedCell=selected.id;resultsExpanded=true;manualOrigin=false;clearRoute(false);selected=null;renderArticlePopup();selectionTag.hidden=true;hits=[];lastQuery='';linkedOrder=null;$('results').hidden=true;$('search').value='';updateSearchReset();$('message').textContent='Выделение снято.';build();updateNavigationMarkers();updateActions();}
function restoreLastCell(){
 if(selected||!lastClearedCell||lastQuery)return;
 const cell=cells.find(c=>c.id===lastClearedCell);if(!cell)return;
 // Restore the physical address only, never a stale article match or old route.
 linkedOrder=null;hits=[];lastQuery='';resultsExpanded=true;manualOrigin=false;
 $('search').value='';updateSearchReset();renderMatches();select(cell);
}
$('restore-cell').onclick=restoreLastCell;
$('clear-selection').onclick=clearSelection;$('route-cell').onclick=flyRoute;$('clear-route').onclick=()=>{clearRoute();$('message').textContent='Маршрут убран.';};
function updateSearchReset(){$('reset-search').hidden=!$('search').value;}
$('search').addEventListener('input',updateSearchReset);
$('reset-search').onclick=()=>{clearSelection();releaseSearchFocus();};
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.activeElement===$('search'))releaseSearchFocus();else if(selected||lastQuery||routePath.length){e.preventDefault();clearSelection();}});
$('search-form').onsubmit=e=>{e.preventDefault();releaseSearchFocus();if(!$('search').value.trim()){clearSelection();return;}runSearch($('search').value);};$('overview').onclick=()=>overview();$('top').onclick=()=>overview(true);function zoom(f){stopFlight();cam.distance=clamp(cam.distance*f,2.8,Math.max(100,wideStreetPose({x:12.4,z:3}).distance*1.25));invalidate();}$('plus').onclick=()=>zoom(.8);$('minus').onclick=()=>zoom(1.25);
function rayPick(x,y){const rect=canvas.getBoundingClientRect();let nx=2*(x-rect.left)/rect.width-1,ny=1-2*(y-rect.top)/rect.height;const dir=norm(add(add(basis.forward,mul(basis.right,nx*basis.aspect/basis.zoom)),mul(basis.up,ny/basis.zoom)));let best=Infinity,hit=null;for(const c of cells){let lo=0,hi=Infinity;for(let i=0;i<3;i++){let center=[c.x,c.y,c.z][i],size=[c.w,c.h,c.d][i]/2,origin=basis.eye[i];if(Math.abs(dir[i])<1e-8){if(origin<center-size||origin>center+size){hi=-1;break;}continue;}let a=(center-size-origin)/dir[i],b=(center+size-origin)/dir[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}if(lo<=hi&&lo<best){best=lo;hit=c;}}if(hit){hits=[];lastQuery='';linkedOrder=null;manualOrigin=false;$('search').value='';updateSearchReset();$('results').hidden=true;$('message').textContent='Выбрано на модели.';select(hit);}else if(selected||lastQuery||routePath.length)clearSelection();}
// Pan in the camera's viewing plane, including world height when tilted.
function pan(dx,dy){
 const scale=2*cam.distance*Math.tan(HALF_FOV)/Math.max(1,canvas.clientHeight);
 const {right,up}=cameraAxes(cam.yaw,cam.pitch);
 cam.target=add(cam.target,add(mul(right,-dx*scale),mul(up,dy*scale)));
 invalidate();
}
function constrainTouchTarget(){
 const bounds=[[-20,20],[-3,9],[-23,15]];
 cam.target=cam.target.map((v,i)=>clamp(v,bounds[i][0],bounds[i][1]));
}
function planeOffset(state,point,width,height){
 const axes=cameraAxes(state.yaw,state.pitch);
 const scale=2*state.distance*Math.tan(HALF_FOV)/Math.max(1,height);
 return add(mul(axes.right,(point.x-width/2)*scale),mul(axes.up,(height/2-point.y)*scale));
}
function pinchAt(state,point,width,height,ratio){
 const anchor=add(state.target,planeOffset(state,point,width,height));
 state.distance=clamp(state.distance*ratio,2.8,Math.max(100,wideStreetPose({x:12.4,z:3}).distance*1.25));
 state.target=sub(anchor,planeOffset(state,point,width,height));
}
// Orbit sensitivity follows viewport height (like standard orbit controls),
// bounded so a small landscape viewport cannot make rotation excessively fast.
function orbitDrag(dx,dy){
 const speed=clamp(Math.PI/Math.max(1,canvas.clientHeight),.003,.006);
 cam.yaw=wrapAngle(cam.yaw-dx*speed);
 cam.pitch=clamp(cam.pitch+dy*speed*.85,0,Math.PI/2);invalidate();
}
const touch=WarehouseTouch.createInput(action=>{
 if(action.kind==='tap'){const point=points.find(p=>p.id===action.pointId);if(point)choosePoint(point);else if(basis)rayPick(action.x,action.y);return;}
 stopFlight();
 if(action.kind==='orbit')orbitDrag(action.dx,action.dy);
 else if(action.kind==='mousePan')pan(action.dx,action.dy);
 else if(action.kind==='pan'){pan(action.dx*.8,action.dy*.8);constrainTouchTarget();}
 else if(action.kind==='pinch'){
  const rect=canvas.getBoundingClientRect();
  pinchAt(cam,{x:action.center.x-rect.left,y:action.center.y-rect.top},canvas.clientWidth,canvas.clientHeight,Math.pow(action.ratio,.72));constrainTouchTarget();
 }else if(action.kind==='twist')cam.yaw=wrapAngle(cam.yaw+action.angle*.8);
 invalidate();
});
function flushGesture(){touch.flush(performance.now());}
const pointer=e=>({x:e.clientX,y:e.clientY,button:e.button,type:e.pointerType,shift:e.shiftKey});
// Canvas and navigation labels share a pointer surface. The original
// label is only activated on a confirmed single tap, never during a pinch.
// PreventDefault in the camera gesture handler suppresses native focus changes.
function releaseSearchFocus(){
 const input=$('search');
 if(document.activeElement===input)input.blur();
}
// Dismiss the keyboard even when touching navigation controls on the map,
// without consuming the first pointer or clearing the query/selected cell.
stage.addEventListener('pointerdown',releaseSearchFocus,{capture:true});
stage.addEventListener('pointerdown',e=>{
 const pin=e.target.closest?.('.scene-pin');
 if(e.target!==canvas&&!pin)return;
 if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
 e.preventDefault();
 if(resultsExpanded&&hits.length>1){resultsExpanded=false;updateSearchChooser();invalidate();}
 flushGesture();stopFlight();
 touch.down(e.pointerId,{...pointer(e),pointId:pin?.dataset.pointId||null});
 try{stage.setPointerCapture(e.pointerId);}catch{}
 scheduleFrame();
});
stage.addEventListener('pointermove',e=>{if(touch.has(e.pointerId)){touch.move(e.pointerId,{x:e.clientX,y:e.clientY});scheduleFrame();}});
function finishPointer(e,cancel=false){touch.up(e.pointerId,{x:e.clientX,y:e.clientY},performance.now(),cancel);}
stage.addEventListener('pointerup',e=>finishPointer(e));
stage.addEventListener('pointercancel',e=>finishPointer(e,true));
stage.addEventListener('lostpointercapture',e=>finishPointer(e,true));
window.addEventListener('blur',()=>touch.reset());
document.addEventListener('visibilitychange',()=>{if(document.hidden){touch.reset();if(animation)hiddenAt=performance.now();}else{if(animation&&hiddenAt!==null)animation.start+=performance.now()-hiddenAt;hiddenAt=null;invalidate();}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
stage.addEventListener('wheel',e=>{if(e.target!==canvas&&!e.target.closest?.('.scene-pin'))return;e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
$('walk-speed').value=String(walkSpeed);$('walk-speed').onchange=e=>setWalkSpeed(e.target.value);
$('route-origin').onchange=e=>{const point=points.find(p=>p.id===e.target.value&&streets.some(s=>s.id===p.id));if(point)choosePoint(point);else{clearRoute(false);origin=null;try{localStorage.removeItem('warehouse3d.origin');}catch{}build();updateNavigationMarkers();updateActions();}};
try{const saved=localStorage.getItem('warehouse3d.origin');origin=points.find(p=>p.id===saved&&streets.some(s=>s.id===p.id))||null;}catch{}
cam.distance=canvas.clientWidth/canvas.clientHeight<1.15?60:47;
const incoming=mapLinkQuery(location.search);
if(incoming.addresses.length||incoming.article){
 linkedOrder=incoming;resultsExpanded=false;lastQuery=incoming.article||incoming.addresses[0].id;$('search').value=lastQuery;
 hits=linkedHits();renderMatches();
 if(hits.length){selected=hits[0];focusOrderStreet(selected);renderCellDetail();$('message').textContent='Из заказа · '+hits.length+' адрес(а)';}
 else{$('message').textContent='После подключения к Warehouse Map проверим точный артикул.';}
}
updateSearchReset();build();updateNavigationMarkers();updateActions();
// Refit once the linked-result panel has taken its final layout space.
if(linkedOrder&&selected&&origin)Object.assign(cam,wideStreetPose(origin));
// Idle map does not run a permanent animation loop. Resize and restore wake it.
if(typeof ResizeObserver==='function')new ResizeObserver(invalidate).observe(stage);
window.addEventListener('resize',invalidate);
window.visualViewport?.addEventListener('resize',invalidate);
canvas.addEventListener('webglcontextlost',e=>{
 e.preventDefault();contextLost=true;stopFlight();touch.reset();
 $('error').hidden=false;$('error').textContent='Графический контекст потерян. Восстанавливаем карту…';
});
canvas.addEventListener('webglcontextrestored',()=>{
 try{contextLost=false;initGL();build();$('error').hidden=true;invalidate();}
 catch(e){contextLost=true;$('error').hidden=false;$('error').textContent='Не удалось восстановить 3D. Обновите страницу.';}
});
scheduleFrame();
})();
