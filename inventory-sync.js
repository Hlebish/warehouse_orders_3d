(()=>{'use strict';
const $=id=>document.getElementById(id);
const config={
    apiKey: "AIzaSyAFd_IPlACJlpxeGsNE7Iq3dQm-VYu5Ba4",
    authDomain: "warehouse-map-b6ed6.firebaseapp.com",
    databaseURL: "https://warehouse-map-b6ed6-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "warehouse-map-b6ed6",
    storageBucket: "warehouse-map-b6ed6.firebasestorage.app",
    messagingSenderId: "196261680344",
    appId: "1:196261680344:web:fdd54671cf57690744f3ad",
    measurementId: "G-7GZFEYSDSJ"
};
const state=(kind,title,detail)=>{document.querySelector('.syncbar').dataset.state=kind;$('sync-status').textContent=title;$('sync-detail').textContent=detail;};
const buttons=(logged,retry=false)=>{$('login').hidden=logged;$('logout').hidden=!logged;$('retry-sync').hidden=!retry;};
const refresh=(data,ready)=>window.WarehouseInventory?.refresh(data,ready);
let auth,db,cellsRef,connectedRef,valueHandler,errorHandler,connectionHandler,epoch=0,connected=false,received=false,logged=false,blocked=false;
function detach(){epoch++;if(cellsRef&&valueHandler)cellsRef.off('value',valueHandler);if(connectedRef&&connectionHandler)connectedRef.off('value',connectionHandler);cellsRef=connectedRef=valueHandler=errorHandler=connectionHandler=null;connected=false;received=false;blocked=false;}
function showConnection(){if(!logged||blocked)return;if(!connected){state('offline',received?'Нет связи · последние данные':'Подключение к базе…',received?'Показаны последние полученные данные, изменения пока не поступают.':'Ожидаем соединение с Warehouse Map.');}else if(received){state('live','Warehouse Map · синхронизировано','Обновление ячеек в реальном времени · только чтение.');}else state('loading','Загрузка ячеек…','Получаем содержимое склада.');}
function errorText(e){switch(e?.code){case 'auth/unauthorized-domain':return 'Разрешите hlebish.github.io в Firebase Authentication → Settings → Authorized domains.';case 'auth/popup-blocked':return 'Разрешите всплывающие окна или откройте страницу в Chrome.';case 'auth/popup-closed-by-user':return 'Окно входа закрыто. Повторите вход.';case 'auth/network-request-failed':return 'Проверьте подключение к интернету.';default:return e?.message||'Не удалось подключиться.';}}
function listen(user){
 detach();refresh(null,false);logged=!!user;buttons(logged);
 if(!user){state('login','Войдите в Warehouse Map','Используйте тот же аккаунт Google, что и на рабочей карте.');return;}
 const current=epoch;
 state('loading','Подключение к Warehouse Map…','Получаем содержимое ячеек.');
 cellsRef=db.ref('warehouse/cells');connectedRef=db.ref('.info/connected');
 connectionHandler=snap=>{if(current!==epoch)return;connected=snap.val()===true;showConnection();};
 valueHandler=snap=>{if(current!==epoch||blocked)return;received=true;refresh(snap.val(),true);showConnection();};
 errorHandler=()=>{if(current!==epoch)return;blocked=true;received=false;refresh(null,false);state('error','Нет доступа к ячейкам','Проверьте аккаунт и действующие права Warehouse Map.');buttons(true,true);};
 connectedRef.on('value',connectionHandler);
 cellsRef.on('value',valueHandler,errorHandler);
}
try{
 if(!window.firebase)throw Error('Firebase SDK не загрузился. Проверьте интернет.');
 if(!firebase.apps.length)firebase.initializeApp(config);
 auth=firebase.auth();db=firebase.database();
 $('login').onclick=async()=>{const b=$('login');b.disabled=true;try{const provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await auth.signInWithPopup(provider);}catch(e){state('error','Ошибка входа',errorText(e));}finally{b.disabled=false;}};
 $('logout').onclick=async()=>{try{await auth.signOut();}catch(e){state('error','Ошибка выхода',errorText(e));}};
 $('retry-sync').onclick=()=>listen(auth.currentUser);
 auth.onAuthStateChanged(listen,e=>{detach();logged=false;refresh(null,false);buttons(false);state('error','Ошибка авторизации',errorText(e));});
}catch(e){refresh(null,false);state('error','Подключение недоступно',errorText(e));$('retry-sync').hidden=false;$('retry-sync').onclick=()=>location.reload();}
})();
