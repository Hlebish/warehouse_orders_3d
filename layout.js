/* Адреса соответствуют действующей карте Hlebish/warehouse-map.
   Геометрия — условная, по приложенной схеме. Все размеры в метрах. */
(function(root){
const levels={left:['A','B','C','D','E'],right:['F','G','H','J','K']};
const demo={'S1-A-2':['DEMO-001 · Крыло'],'S2-G-5':['DEMO-002 · Капот'],'S3-K-7':['DEMO-003 · Бампер'],'S4-C-3':['DEMO-004 · Фара'],'S5-F-9':['DEMO-003 · Бампер']};
const cells=[], racks=[], streets=[];
for(let s=1;s<=5;s++){
 const x=(s-3)*6.2; streets.push({id:'S'+s,x});
 for(const side of (s===1?['left']:['left','right'])){
  // S1 на схеме имеет единственный ряд справа от прохода.
  const rackX=x+(s===1||side==='right'?1.9:-1.9);
  const rack={street:'S'+s,side,x:rackX}; racks.push(rack);
  levels[side].forEach((letter,i)=>{
   for(let n=1;n<=10;n++){
    const z=n<=3?8.9-(n-1)*1.65:0.3-(n-4)*1.65;
    const id='S'+s+'-'+letter+'-'+n;
    cells.push({id,street:'S'+s,side,letter,n,x:rackX,y:.55+i*.88,z,w:1.23,h:.76,d:1.51,items:demo[id]||[]});
   }
  });
 }
}
function normalizeAddress(value){const m=String(value).toUpperCase().trim().match(/^S\s*([1-5])\s*[,;\s-]*([A-HJK])\s*[-,\s]*([1-9]|10)$/);return m?'S'+m[1]+'-'+m[2]+'-'+m[3]:null;}
function search(value){const q=String(value).trim().toUpperCase();if(!q)return [];const addr=normalizeAddress(q);if(addr)return cells.filter(c=>c.id===addr);return cells.filter(c=>c.items.some(item=>item.toUpperCase().includes(q)));}
const layout={cells,racks,streets,search,normalizeAddress}; if(typeof module!=='undefined')module.exports=layout;else root.WarehouseLayout=layout;
})(globalThis);
