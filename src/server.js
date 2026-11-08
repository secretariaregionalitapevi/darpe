'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),publicDir=path.join(root,'public');
const env=path.join(root,'.env');
if(fs.existsSync(env))for(const line of fs.readFileSync(env,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_0-9]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
async function readBody(req){let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>100000)throw Object.assign(Error('Dados maiores que o limite permitido.'),{status:413});chunks.push(part);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Object.assign(Error('Dados inválidos.'),{status:400});}}
const actions=new Set(['contexto','pessoas','atendimentos','exportar-pdf']);
async function central(action,req,query='',body){
 const base=process.env.PRINCIPAL_URL;
 if(!base)throw Object.assign(Error('Configure a conexão com o sistema regional.'),{status:503});
 const url=new URL(`/darpe/mobile/api/${action}/${query}`,base);
 return fetch(url,{method:req.method,headers:{Authorization:String(req.headers.authorization||''),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(45000)});
}
async function handler(req,res){
 res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','same-origin');
 try{
  const url=new URL(req.url,'http://internal');
  if(!['GET','POST','PATCH'].includes(req.method))return json(res,405,{error:'Método não permitido.'});
  if(['POST','PATCH'].includes(req.method)){
   const origin=req.headers.origin;
   if(origin){const expected=process.env.APP_ORIGIN;const forwarded=String(req.headers['x-forwarded-host']||req.headers.host||'');const originHost=new URL(origin).host;const isSameHost=Boolean(forwarded&&(originHost===forwarded||forwarded.split(':')[0]===originHost));const isExpected=Boolean(expected&&expected.split(',').map(s=>s.trim()).includes(origin));if(!isSameHost&&!isExpected)return json(res,403,{error:'Origem não autorizada.'});}
  }
  if(['/api/mobile/login','/api/mobile/refresh'].includes(url.pathname)&&req.method==='POST'){
   const data=await readBody(req),refresh=url.pathname.endsWith('refresh');
   const supabase=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
   if(!supabase||!anon)return json(res,503,{error:'Autenticação não configurada.'});
   const response=await fetch(`${supabase.replace(/\/$/,'')}/auth/v1/token?grant_type=${refresh?'refresh_token':'password'}`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify(refresh?{refresh_token:data.refresh_token}:{email:data.email,password:data.password}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)return json(res,401,{error:'Não foi possível entrar. Confira e-mail e senha ou renove a sessão.'});
   const session=await response.json();
   const check=await central('contexto',{method:'GET',headers:{authorization:`Bearer ${session.access_token}`}});
   if(!check.ok){const result=await check.json();return json(res,check.status,{error:result.error||'Acesso DARPE não autorizado.'});}
   return json(res,200,{access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in});
  }
  const match=url.pathname.match(/^\/api\/darpe\/(contexto|pessoas|atendimentos|exportar-pdf)\/$/);
  if(match&&actions.has(match[1])){
   if(!String(req.headers.authorization||'').startsWith('Bearer '))return json(res,401,{error:'Faça login para continuar.'});
   if(['POST','PATCH'].includes(req.method)&&match[1]!=='atendimentos')return json(res,405,{error:'Método não permitido.'});
   if(req.method==='PATCH'&&match[1]!=='atendimentos')return json(res,405,{error:'Método não permitido.'});
   if(match[1]==='exportar-pdf'&&req.method!=='GET')return json(res,405,{error:'Método não permitido.'});
   const response=await central(match[1],req,url.search,['POST','PATCH'].includes(req.method)?await readBody(req):undefined);
   if(match[1]==='exportar-pdf'&&response.ok){
    res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/pdf','Content-Disposition':response.headers.get('content-disposition')||'attachment; filename="papeleta.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return res.end(Buffer.from(await response.arrayBuffer()));
   }
   return json(res,response.status,await response.json());
  }
  if(req.method!=='GET')return json(res,405,{error:'Método não permitido.'});
  const aliases={'/':'index.html','/login':'login.html','/atendimento':'atendimento.html'};
  const relative=aliases[url.pathname]||decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(publicDir,relative);
  if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Página não encontrada.'});
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.ttf':'font/ttf'};
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(file));
 }catch(error){json(res,error.status||503,{error:error.status?error.message:'Não foi possível acessar o sistema regional. Tente novamente.'});}
}
if(require.main===module)http.createServer(handler).listen(Number(process.env.PORT||3001),()=>console.log('APP_DARPE disponível na porta '+(process.env.PORT||3001)));
module.exports=handler;
