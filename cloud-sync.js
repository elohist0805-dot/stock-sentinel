/* Stock Sentinel cloud sync: optional, no credentials committed to GitHub. */
(() => {
'use strict';
const urlKey='stock-sentinel-cloud-endpoint';
const tokenKey='stock-sentinel-cloud-session';
let token='',version=0,endpoint='',active=false,blocked=false,busy=false,dirty=false,timer=null;
const $=id=>document.getElementById(id);
const status=(text,error=false)=>{$('cloudStatus').textContent=text;$('cloudStatus').style.color=error?'#ffb0a5':'#a4cde5';};
const api=async(path,method='GET',payload=null,authenticated=true)=>{
  if(!endpoint)throw Error('請先填寫 Cloudflare Worker 網址');
  const h={'Content-Type':'application/json'};
  if(authenticated)h.Authorization='Bearer '+token;
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),15000);
  try {
    const response=await fetch(endpoint+path,{method,headers:h,body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:ctrl.signal});
    const json=await response.json().catch(()=>({}));
    if(!response.ok){const err=new Error(json.error||'HTTP '+response.status);err.status=response.status;throw err;}
    return json;
  } finally {clearTimeout(timeout);}
};
function setLoggedIn(on){
  $('cloudLogin').classList.toggle('hidden',on);
  $('cloudActions').classList.toggle('hidden',!on);
  $('cloudPass').value='';
  $('cloudEndpoint').disabled=on;
}
function snapshot(){return JSON.parse(JSON.stringify(window.stockLocal.get()));}
async function remoteRead({showConfirm=true}={}){
  if(dirty){status('尚有未同步修改，請先備份 JSON 或重新登入處理。',true);return;}
  const result=await api('/api/data');
  version=result.version;
  if(result.data){
    if(showConfirm&&snapshot().stocks.length&&JSON.stringify(result.data)!==JSON.stringify(snapshot())&&!confirm('雲端已經有資料。要以雲端資料取代本裝置目前顯示的設定嗎？\n建議先匯出本機 JSON 備份。')){status('雲端已有資料。尚未覆蓋本機內容；請先備份再選擇讀取。');active=false;return;}
    active=false;blocked=false;
    window.stockLocal.set(result.data);
    active=true;dirty=false;
    status('已連線並讀取雲端資料。版本 '+version+'｜'+(result.updatedAt||''));
  }else{
    active=false;
    status('雲端目前是空白。請先備份本機資料，再選擇「上傳本機設定作為首次雲端資料」，不會自動覆蓋。');
  }
}
async function saveCloud(){
  if(!active||blocked||busy||!dirty)return;
  busy=true;
  const data=snapshot();
  try{
    const response=await api('/api/data','PUT',{version,data});
    version=response.version;
    dirty=JSON.stringify(data)!==JSON.stringify(snapshot());
    if(!dirty)status('已同步雲端 ✓｜'+new Date().toLocaleTimeString('zh-TW'));
  }catch(e){
    blocked=true;
    if(e.status===409)status('另一裝置已更新雲端資料，已停止自動同步。請先匯出本機 JSON，然後重新登入讀取最新版本。',true);
    else status('雲端同步失敗，已保留本機設定。請檢查網路後按「重試同步」：'+e.message,true);
  }finally{busy=false;if(dirty&&!blocked)schedule();}
}
function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(saveCloud,900);}
window.stockCloudChanged=()=>{if(!active)return;dirty=true;status('本機設定已修改，正在同步…');schedule();};
$('cloudEndpoint').value=localStorage.getItem(urlKey)||'';
$('cloudLoginBtn').onclick=async()=>{
  const raw=$('cloudEndpoint').value.trim().replace(/\/+$/,'');
  if(!/^https:\/\/[a-zA-Z0-9.-]+(?:\/)?$/.test(raw)||!raw.includes('.')){status('請輸入完整 https://…workers.dev 網址',true);return;}
  endpoint=raw;
  status('正在驗證連線…');
  try{
    const result=await api('/api/login','POST',{passphrase:$('cloudPass').value},false);
    token=result.token;sessionStorage.setItem(tokenKey,JSON.stringify({endpoint,token,expiresAt:result.expiresAt}));
    localStorage.setItem(urlKey,endpoint);setLoggedIn(true);
    await remoteRead();
  }catch(e){status('登入或讀取失敗：'+e.message,true);setLoggedIn(false);}
};
$('cloudLoad').onclick=async()=>{try{await remoteRead()}catch(e){status('讀取失敗：'+e.message,true);}};
$('cloudUpload').onclick=async()=>{
  if(active){status('雲端已有資料，為避免覆蓋請勿使用首次上傳。',true);return;}
  if(!confirm('確定已在「資料備份」匯出本機 JSON？\n將目前這台裝置的資料寫入空白雲端。'))return;
  try{
    const remote=await api('/api/data');
    if(remote.data||remote.version!==0){status('雲端已有資料，禁止首次上傳覆蓋。請讀取雲端。',true);return;}
    const saved=await api('/api/data','PUT',{version:0,data:snapshot()});
    version=saved.version;active=true;blocked=false;dirty=false;status('首次雲端移轉完成。資料已存入私人資料庫。');
  }catch(e){status('移轉失敗，本機資料未刪除：'+e.message,true);}
};
$('cloudRetry').onclick=async()=>{
  if(!active)return status('尚未啟用雲端，請先登入並讀取資料。',true);
  if(blocked)return status('同步曾失敗或版本衝突；請先備份並重新登入取得最新版本。',true);
  dirty=true;await saveCloud();
};
$('cloudLogout').onclick=()=>{active=false;dirty=false;blocked=false;token='';version=0;sessionStorage.removeItem(tokenKey);setLoggedIn(false);status('已退出雲端連線。本機資料仍會留存在此瀏覽器，請留意共用電腦的隱私。');};
setLoggedIn(false);
try{
  const session=JSON.parse(sessionStorage.getItem(tokenKey)||'null');
  if(session&&session.expiresAt>Date.now()&&session.endpoint=== $('cloudEndpoint').value){
    token=session.token;endpoint=session.endpoint;setLoggedIn(true);
    remoteRead({showConfirm:true}).catch(e=>{setLoggedIn(false);status('登入已過期或雲端無法連線，請重新登入：'+e.message,true);});
  }
}catch{}
})();