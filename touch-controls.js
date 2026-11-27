/* Warehouse camera input: independent orbit, pan, pinch and twist.
   Input is sampled once per frame, in CSS pixels. No renderer dependencies. */
(function(root){
 const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const metrics=p=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,len:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),angle:Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x)});
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function classify(base,next){
  const a=metrics(base),b=metrics(next);
  if(a.len<16||b.len<16)return null;
  const u={x:next[0].x-base[0].x,y:next[0].y-base[0].y},v={x:next[1].x-base[1].x,y:next[1].y-base[1].y};
  const m=Math.hypot(u.x,u.y),n=Math.hypot(v.x,v.y);
  const pan=dist(a,b),zoom=Math.abs(b.len-a.len)/2,turn=Math.abs(angle(b.angle-a.angle)),twist=turn*(a.len+b.len)/4;
  const parallel=m>=3&&n>=3&&(u.x*v.x+u.y*v.y)/(m*n)>.8;
  // Strong rotation can use one stationary finger as a pivot.
  if(turn>=.09&&twist>=4&&twist>=zoom*1.35&&twist>=pan*.75)return 'twist';
  // Pan requires both fingers to travel in the same direction.
  if(parallel&&pan>=5&&zoom<=pan*.42&&twist<=pan*.42)return 'pan';
  if(zoom>=4&&zoom>=twist*1.15&&zoom>=pan*.72&&turn<.24)return 'pinch';
  return null;
 }
 function createInput(emit){
  const pointers=new Map();
  let baseline=[],previous=[],mode=null,changed=false,tapAllowed=false,candidate=null,candidateAt=0,seen=new Set(),pairReleased=false;
  const snapshot=()=>Array.from(pointers.values(),p=>({...p}));
  function rebase(){
   baseline=snapshot();previous=baseline;mode=null;changed=false;candidate=null;candidateAt=0;seen.clear();
  }
  function down(id,p){
   if(pointers.has(id))return;
   if(pointers.size===0)pairReleased=false;
   tapAllowed=pointers.size===0&&p.button===0;
   pointers.set(id,{...p});rebase();
  }
  function move(id,p){
   const old=pointers.get(id);if(!old)return;
   if(old.x===p.x&&old.y===p.y)return;
   pointers.set(id,{...old,...p});seen.add(id);changed=true;
  }
  function flush(now,ending=false){
   const n=pointers.size;
   if(n<1||n>2||(!changed&&!candidate))return;
   const next=snapshot();
   if(n===1){
    if(pairReleased)return;
    const p=next[0],b=baseline[0],prev=previous[0];
    if(!mode){
     if(dist(p,b)<(p.type==='mouse'?2:5))return;
     mode=p.button===2||p.shift?'mousePan':'orbit';tapAllowed=false;
     // Remove the touch slop from the first delta rather than jumping through it.
     const d=dist(p,b),slop=p.type==='mouse'?2:5,keep=Math.max(0,1-slop/d);
     emit({kind:mode,dx:(p.x-b.x)*keep,dy:(p.y-b.y)*keep});previous=next;changed=false;return;
    }
    if(changed)emit({kind:mode,dx:p.x-prev.x,dy:p.y-prev.y});
    previous=next;changed=false;return;
   }
   tapAllowed=false;
   const a=metrics(previous),b=metrics(next);
   if(b.len<16){rebase();return;}
   if(metrics(baseline).len<16){rebase();return;}
   if(!mode){
    const kind=classify(baseline,next);
    if(!kind){candidate=null;return;}
    if(candidate!==kind){candidate=kind;candidateAt=now;}
    // Wait briefly for asynchronous touch updates, even if one finger
    // is stationary. No camera motion until a mode has been confirmed.
    const both=seen.size===2;
    const wait=kind==='pan'?40:24;
    if(!ending&&(now-candidateAt<wait||(!both&&now-candidateAt<(kind==='pinch'?55:70))))return;
    mode=kind;candidate=null;
    // The first accepted frame is intentionally limited. Earlier ambiguous
    // movement must not become one sudden zoom/pan/rotation.
    if(mode==='pan'){const d=dist(a,b),gain=d>0?Math.min(1,10/d):0;emit({kind:mode,dx:(b.x-a.x)*gain,dy:(b.y-a.y)*gain});}
    else if(mode==='pinch'){const r=Math.log(a.len/b.len);emit({kind:mode,ratio:Math.exp(Math.max(-.12,Math.min(.12,r))),center:metrics(baseline)});}
    else if(mode==='twist'){const d=angle(b.angle-a.angle);emit({kind:mode,angle:Math.max(-.13,Math.min(.13,d))});}
    previous=next;changed=false;return;
   }
   if(changed){
    if(mode==='pan')emit({kind:mode,dx:b.x-a.x,dy:b.y-a.y});
    else if(mode==='pinch'&&a.len>=16)emit({kind:mode,ratio:a.len/b.len,center:metrics(baseline)});
    else if(mode==='twist'&&a.len>=16)emit({kind:mode,angle:angle(b.angle-a.angle)});
   }
   previous=next;changed=false;
  }
  function up(id,p,now,cancel=false){
   if(!pointers.has(id))return;
   if(!cancel){move(id,p);flush(now,false);}
   if(pointers.size>=2)pairReleased=true;
   const click=!cancel&&pointers.size===1&&tapAllowed&&!mode&&dist(p,baseline[0])<5;
   const pointId=baseline[0]?.pointId||null;
   pointers.delete(id);tapAllowed=false;rebase();
   if(click)emit({kind:'tap',x:p.x,y:p.y,pointId});
  }
  function reset(){pointers.clear();tapAllowed=false;pairReleased=false;rebase();}
  return {down,move,up,flush,reset,has:id=>pointers.has(id)};
 }
 const api={createInput,classify,metrics};
 if(typeof module!=='undefined')module.exports=api;else root.WarehouseTouch=api;
})(globalThis);
