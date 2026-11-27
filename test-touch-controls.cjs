const assert=require('node:assert/strict');
const {createInput,classify}=require('./touch-controls.js');
const p=(x,y)=>({x,y,button:0,type:'touch'});
const b=[p(-40,0),p(40,0)];
const rotate=(a,s=1,x=0,y=0)=>b.map(v=>p(v.x*s*Math.cos(a)+x,v.x*s*Math.sin(a)+y));
for(const [pair,want] of [[rotate(.4),'twist'],[rotate(-.4),'twist'],[rotate(.25,1.04,3,2),'twist'],[rotate(0,1,14,3),'pan'],[rotate(.02,1,14,3),'pan'],[rotate(0,1.4),'pinch'],[rotate(0,.6),'pinch'],[rotate(.02),null],[[p(-30,0),b[1]],'pinch'],[[b[0],p(-40+80*Math.cos(.3),80*Math.sin(.3))],'twist']])assert.equal(classify(b,pair),want);
function fixture(){const events=[];return {events,c:createInput(e=>events.push(e))};}
for(const [kind,pair] of [['pan',rotate(0,1,20,8)],['pinch',rotate(0,1.5)],['twist',rotate(.4)],['twist',rotate(-.4)]]){
 const {c,events}=fixture();c.down(1,b[0]);c.down(2,b[1]);
 c.move(1,pair[0]);c.flush(0);assert.equal(events.length,0);
 c.move(2,pair[1]);c.flush(16);assert.equal(events.length,0);
 c.flush(100);assert.equal(events.length,1);assert.equal(events[0].kind,kind);
 c.move(1,p(10,30));c.move(2,p(70,40));c.flush(116);assert.equal(events[1].kind,kind);
 c.up(2,p(70,40),120);c.move(1,p(11,31));c.flush(130);assert.equal(events.length,2);
 c.move(1,p(25,40));c.flush(146);assert.equal(events.at(-1).kind,'orbit');c.up(1,p(25,40),150);assert(!events.some(e=>e.kind==='tap'));
}
{
 const {c,events}=fixture();c.down(1,p(0,0));c.move(1,p(2,1));c.flush(16);c.up(1,p(2,1),20);assert.equal(events[0].kind,'tap');
 c.down(1,p(0,0));c.move(1,p(15,10));c.flush(30);assert.equal(events.at(-1).kind,'orbit');c.down(2,p(60,0));c.down(3,p(80,0));c.move(1,p(20,12));c.flush(50);assert.equal(events.length,2);c.reset();c.flush(100);assert.equal(events.length,2);
}
{
 const {c,events}=fixture();c.down(1,b[0]);c.down(2,b[1]);c.move(1,p(-30,0));c.flush(0);c.move(1,p(-36,-16));c.move(2,p(36,16));c.flush(16);c.flush(100);assert.equal(events[0].kind,'twist');
}
console.log('Touch controls passed');
