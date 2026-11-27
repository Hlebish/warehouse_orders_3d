(function(root){
 const destinations=Object.freeze({
  github:'https://hlebish.github.io/warehouse_orders/',
  firebase:'https://sklad-18f38.web.app/',
  firebaseapp:'https://sklad-18f38.firebaseapp.com/'
 });
 function returnTarget(search){
  const params=new URLSearchParams(search),site=params.get('returnSite'),order=params.get('returnOrder')||'';
  if(!Object.prototype.hasOwnProperty.call(destinations,site)||order.length>200)return null;
  return destinations[site]+(order?'?order='+encodeURIComponent(order):'');
 }
 if(typeof module!=='undefined')module.exports={returnTarget};
 else{
  const target=returnTarget(location.search),button=document.getElementById('return-order');
  if(target&&button){
   button.hidden=false;
   const goBack=()=>{location.replace(target);return true;};
   button.addEventListener('click',goBack);
   root.handleNativeBack=goBack;
  }
 }
})(globalThis);
