const ALLOWED_ORIGIN = 'https://elohist0805-dot.github.io';
const ENCODER = new TextEncoder();
function cors(request) {
  const origin = request.headers.get('Origin');
  return origin === ALLOWED_ORIGIN ? {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  } : {};
}
function json(request, data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{
    ...cors(request), 'Content-Type':'application/json;charset=UTF-8',
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
  }});
}
function base64url(bytes) {
  let binary=''; for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode64url(s) {
  const a=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
  return Uint8Array.from(a, c=>c.charCodeAt(0));
}
async function hmac(secret, message) {
  const key=await crypto.subtle.importKey('raw',ENCODER.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,ENCODER.encode(message)));
}
async function sha(text) {return new Uint8Array(await crypto.subtle.digest('SHA-256',ENCODER.encode(text)));}
function equal(a,b) {
  if(a.length!==b.length) return false;
  let result=0;for(let i=0;i<a.length;i++) result|=a[i]^b[i];
  return result===0;
}
async function authorized(request,env) {
  const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('Authorization')||'');
  if(!match) return false;
  const [payload,signature]=match[1].split('.');
  if(!payload||!signature) return false;
  try {
    const sig=await hmac(env.SESSION_SECRET,payload);
    if(!equal(sig,decode64url(signature)))return false;
    const body=JSON.parse(new TextDecoder().decode(decode64url(payload)));
    return body.v===1 && Number.isSafeInteger(body.exp) && body.exp>Date.now() && body.exp<Date.now()+10*3600000+60000;
  } catch {return false;}
}
async function issue(env) {
  const payload=base64url(ENCODER.encode(JSON.stringify({v:1,exp:Date.now()+10*3600000,nonce:crypto.randomUUID()})));
  const sig=base64url(await hmac(env.SESSION_SECRET,payload));
  return {token:payload+'.'+sig,expiresAt:Date.now()+10*3600000};
}
async function login(req,env) {
  const ip=req.headers.get('CF-Connecting-IP')||'unknown';
  const hash=base64url(await hmac(env.SESSION_SECRET,'ip:'+ip));
  const now=Math.floor(Date.now()/1000);
  const recent=await env.DB.prepare('SELECT attempts,first_at,blocked_until FROM login_limits WHERE id=?').bind(hash).first();
  if(recent?.blocked_until>now)return json(req,{error:'嘗試次數過多，請稍後再試'},429);
  let body;
  try{body=await req.json();}catch{return json(req,{error:'資料格式錯誤'},400);}
  const candidate=String(body?.passphrase||'');
  if(candidate.length>256)return json(req,{error:'驗證失敗'},401);
  const correct=await sha(env.LOGIN_PASSPHRASE);
  const supplied=await sha(candidate);
  if(!equal(correct,supplied)){
    const attempts=(recent && now-recent.first_at<900?recent.attempts:0)+1;
    const firstAt=(recent && now-recent.first_at<900)?recent.first_at:now;
    const block=attempts>=5?now+900:0;
    await env.DB.prepare('INSERT INTO login_limits (id,attempts,first_at,blocked_until) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET attempts=excluded.attempts,first_at=excluded.first_at,blocked_until=excluded.blocked_until').bind(hash,attempts,firstAt,block).run();
    return json(req,{error: attempts>=5?'驗證失敗，請十五分鐘後再試':'驗證失敗'},401);
  }
  await env.DB.prepare('DELETE FROM login_limits WHERE id=?').bind(hash).run();
  return json(req,await issue(env));
}
function validateData(d) {
  if(!d||typeof d!=='object'||!Array.isArray(d.stocks)||!Array.isArray(d.trades)||d.stocks.length>500||d.trades.length>10000||typeof d.auto!=='boolean')return false;
  return d.stocks.every(s=>s&&typeof s==='object'&&typeof s.code==='string'&&/^\d{4,6}[A-Za-z]?$/.test(s.code)&&typeof s.name==='string'&&s.name.length<=100&&['上市','上櫃'].includes(s.market))
    && d.trades.every(t=>t&&typeof t==='object');
}
export default {
  async fetch(req,env) {
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
    if(req.headers.get('Origin')!==ALLOWED_ORIGIN)return json(req,{error:'來源不允許'},403);
    if(!env.DB||!env.SESSION_SECRET||!env.LOGIN_PASSPHRASE||env.SESSION_SECRET.length<32||env.LOGIN_PASSPHRASE.length<12)
      return json(req,{error:'伺服器尚未完成安全設定'},503);
    const path=new URL(req.url).pathname;
    try{
      if(path==='/api/health'&&req.method==='GET') return json(req,{ok:true,version:1});
      if(path==='/api/login'&&req.method==='POST')return await login(req,env);
      if(!await authorized(req,env))return json(req,{error:'登入已過期，請重新驗證'},401);
      if(path==='/api/data'&&req.method==='GET'){
        const row=await env.DB.prepare('SELECT version,payload,updated_at FROM private_data WHERE id=1').first();
        return json(req,{version:row?.version||0,data:row?JSON.parse(row.payload):null,updatedAt:row?.updated_at||null});
      }
      if(path==='/api/data'&&req.method==='PUT'){
        const raw=await req.text();
        if(raw.length>250000)return json(req,{error:'資料超過儲存上限'},413);
        let body;try{body=JSON.parse(raw);}catch{return json(req,{error:'JSON 格式錯誤'},400);}
        if(!Number.isSafeInteger(body?.version)||body.version<0||!validateData(body.data))return json(req,{error:'資料格式或版本錯誤'},400);
        const payload=JSON.stringify(body.data);
        if(payload.length>240000)return json(req,{error:'資料過大'},413);
        const current=await env.DB.prepare('SELECT version FROM private_data WHERE id=1').first();
        if((current?.version||0)!==body.version)return json(req,{error:'另一裝置已有更新，請先重新讀取雲端資料',version:current?.version||0},409);
        const now=new Date().toISOString();
        let result;
        if(current){
          result=await env.DB.prepare('UPDATE private_data SET version=version+1,payload=?,updated_at=? WHERE id=1 AND version=?').bind(payload,now,body.version).run();
        }else{
          result=await env.DB.prepare('INSERT OR IGNORE INTO private_data(id,version,payload,updated_at) VALUES(1,1,?,?)').bind(payload,now).run();
        }
        if(!result.meta?.changes)return json(req,{error:'資料已被其他裝置更新，請重新載入',conflict:true},409);
        return json(req,{version:body.version+1,updatedAt:now});
      }
      return json(req,{error:'沒有此服務'},404);
    }catch(err){
      console.error('API failure',String(err));
      return json(req,{error:'伺服器暫時無法處理要求'},500);
    }
  }
};