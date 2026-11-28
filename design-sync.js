(()=>{'use strict';
const ui=window.WarehouseDesign,$=id=>document.getElementById(id);
if(!ui||!window.firebase?.apps?.length)return;
let ref=null,handler=null,known=null,ready=false,busy=false,epoch=0;
function buttons(){$('design-publish').disabled=!ready||busy;$('design-load').disabled=!ready||busy||known===null;}
function decode(raw){if(typeof raw!=='string'||raw.length>100000)return null;try{const a=JSON.parse(raw);return Array.isArray(a)&&a.length<=450?a:null;}catch{return null;}}
function receive(snap){known=snap.val();ready=true;buttons();
 if(known===null){ui.status('Общая схема ещё не опубликована.');return;}
 const parsed=decode(known);if(!parsed){ui.status('Ошибка формата общей схемы.');return;}
 if(JSON.stringify(ui.get())===known){ui.saved();ui.status('Общая схема синхронизирована.');return;}
 if(ui.dirty()){ui.status('Есть локальные изменения. Опубликуйте их или загрузите общую схему.');return;}
 ui.status(ui.apply(parsed,false)?'Общая схема загружена.':'Не удалось загрузить общую схему.');
}
firebase.auth().onAuthStateChanged(user=>{
 epoch++;if(ref&&handler)ref.off('value',handler);ref=null;handler=null;known=null;ready=false;busy=false;buttons();
 if(!user){ui.status('Войдите для синхронизации схемы.');return;}
 const id=epoch;ref=firebase.database().ref('warehouse3d/layout');
 handler=snap=>{if(id===epoch&&!busy)receive(snap);};
 ref.on('value',handler,()=>{if(id!==epoch)return;ready=false;buttons();ui.status('Облачная схема недоступна. Можно перенести код вручную.');});
});
window.WarehouseDesignCloud={
 load(){if(!ready||known===null||busy)return;if(ui.dirty()&&!confirm('Заменить локальные изменения общей схемой?'))return;const parsed=decode(known);ui.status(parsed&&ui.apply(parsed,false)?'Общая схема загружена.':'Не удалось загрузить схему.');},
 async publish(){
  if(!ready||busy||!ref)return;
  const data=JSON.stringify(ui.get()),expected=known,id=epoch,currentRef=ref;
  if(expected!==null&&data!==expected&&!confirm('Опубликовать эту схему для всех устройств склада?'))return;
  if(expected===null&&!ui.get().length&&!confirm('Опубликовать пустую схему?'))return;
  busy=true;buttons();
  try{const result=await currentRef.transaction(value=>value===expected?data:undefined,undefined,false);
   if(id!==epoch)return;
   known=result.snapshot.val();
   if(result.committed){if(JSON.stringify(ui.get())===data)ui.saved();ui.status('Общая схема опубликована.');}
   else ui.status('Схема изменилась на другом устройстве. Загрузите её перед публикацией.');
  }catch(e){if(id===epoch)ui.status('Не удалось опубликовать. Проверьте права Firebase.');}
  finally{if(id===epoch){busy=false;buttons();}}
 }
};
})();
