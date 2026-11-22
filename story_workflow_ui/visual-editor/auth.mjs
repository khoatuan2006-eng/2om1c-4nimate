import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {isLocalWrite,jsonResponse} from './http-policy.mjs';

const cookieName='studio_session';
const digest=value=>createHash('sha256').update(value).digest('hex');
const loginPage=message=>`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Đăng nhập Studio</title><style>body{font:16px system-ui;background:#151820;color:#eee;display:grid;place-items:center;min-height:95vh}form{max-width:360px;padding:24px}input,button{box-sizing:border-box;width:100%;padding:12px;margin:8px 0}p{line-height:1.5}</style><form method="post" action="/auth/login"><h1>Đăng nhập Studio</h1><p role="alert">${message}</p><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required maxlength="1024" autofocus></label><button>Đăng nhập</button></form></html>`;

/** Local single-user authentication. The runtime remains bound to loopback. */
export function createAuth({password=process.env.EDITOR_PASSWORD,sessionMs=8*60*60*1000,now=Date.now}={}){
 if(password===undefined)return {enabled:false,handle(req,res){if((req.url??'').split('?')[0]==='/auth/status'){jsonResponse(res,200,{enabled:false,authenticated:true});return true;}return false;}};
 if(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>1024)throw Error('EDITOR_PASSWORD cần từ 12 ký tự và tối đa 1024 byte.');
 const salt=randomBytes(32),expected=scryptSync(password,salt,32),probeHash=digest('Bearer '+password),sessions=new Map();
 let failures=0,blockedUntil=0;
 const cookie=(token,age)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`;
 const tokenOf=req=>{const entry=(req.headers.cookie??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='));return entry?.slice(cookieName.length+1)??'';};
 const html=(res,status,message='')=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'same-origin'});res.end(loginPage(message));};
 const redirect=(res,target)=>{res.writeHead(303,{Location:target,'Cache-Control':'no-store'});res.end();};
 const valid=req=>{const stamp=now();for(const [key,expiry] of sessions)if(expiry<=stamp)sessions.delete(key);return (sessions.get(digest(tokenOf(req)))??0)>stamp;};
 return {enabled:true,handle(req,res){
  const path=(req.url??'/').split('?')[0];
  if(path==='/auth/status'&&req.method==='GET'){jsonResponse(res,200,{enabled:true,authenticated:valid(req)});return true;}
  // Launcher probes can authenticate health only; this credential never grants media/API access.
  if(path==='/api/health'&&['GET','HEAD'].includes(req.method)&&timingSafeEqual(Buffer.from(digest(req.headers.authorization??'')),Buffer.from(probeHash)))return false;
  if(path==='/auth/login'){
   if(req.method==='GET'){if(valid(req))redirect(res,'/');else html(res,200);return true;}
   if(req.method!=='POST'){jsonResponse(res,405,{error:'Phương thức không hợp lệ.'});return true;}
   if(!isLocalWrite(req)){jsonResponse(res,403,{error:'Nguồn đăng nhập không hợp lệ.'});return true;}
   if(now()<blockedUntil){res.setHeader('Retry-After',String(Math.ceil((blockedUntil-now())/1000)));jsonResponse(res,429,{error:'Thử đăng nhập lại sau một phút.'});req.resume();return true;}
   if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){jsonResponse(res,415,{error:'Định dạng đăng nhập không hợp lệ.'});req.resume();return true;}
   let chunks=[],size=0,oversized=false;
   req.on('data',chunk=>{size+=chunk.length;if(size>4096){oversized=true;chunks=[];}else if(!oversized)chunks.push(chunk);});
   req.on('end',()=>{
    if(oversized){jsonResponse(res,413,{error:'Yêu cầu đăng nhập quá dài.'});return;}
    const supplied=new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('password')??'';
    if(Buffer.byteLength(supplied)>1024||!timingSafeEqual(scryptSync(supplied,salt,32),expected)){
     if(++failures>=5){blockedUntil=now()+60000;failures=0;}
     html(res,401,'Mật khẩu chưa đúng.');return;
    }
    failures=0;blockedUntil=0;valid(req);
    // Rotate this browser's old session and bound memory use.
    sessions.delete(digest(tokenOf(req)));if(sessions.size>=100)sessions.delete(sessions.keys().next().value);
    const token=randomBytes(32).toString('base64url');sessions.set(digest(token),now()+sessionMs);
    res.setHeader('Set-Cookie',cookie(token,Math.floor(sessionMs/1000)));redirect(res,'/');
   });return true;
  }
  if(path==='/auth/logout'){
   if(req.method!=='POST'||!isLocalWrite(req)){jsonResponse(res,403,{error:'Yêu cầu đăng xuất không hợp lệ.'});return true;}
   sessions.delete(digest(tokenOf(req)));res.setHeader('Set-Cookie',cookie('',0));redirect(res,'/auth/login');return true;
  }
  if(valid(req))return false;
  if(['GET','HEAD'].includes(req.method)&&req.headers.accept?.includes('text/html'))redirect(res,'/auth/login');
  else jsonResponse(res,401,{error:'Vui lòng đăng nhập Studio.',code:'AUTH_REQUIRED'});
  return true;
 }};
}
