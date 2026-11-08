const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const handler=require('../src/server');

async function run(fn){
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await fn(`http://127.0.0.1:${server.address().port}`);}
 finally{await new Promise(resolve=>server.close(resolve));}
}

test('PATCH de atendimento é encaminhado com o corpo ao servidor principal',()=>run(async base=>{
 const originalFetch=global.fetch,originalUrl=process.env.PRINCIPAL_URL;
 process.env.PRINCIPAL_URL='https://principal.invalid';
 let forwarded;
 global.fetch=async(url,options)=>{
  if(String(url).startsWith(base))return originalFetch(url,options);
  forwarded={url:String(url),options};
  return new Response(JSON.stringify({item:{id:'record'}}),{status:200});
 };
 try{
  const response=await originalFetch(base+'/api/darpe/atendimentos/',{
   method:'PATCH',
   headers:{Authorization:'Bearer token','Content-Type':'application/json'},
   body:JSON.stringify({id:'record',local:'Unidade revisada'}),
  });
  assert.equal(response.status,200);
  assert.equal(forwarded.options.method,'PATCH');
  assert.deepEqual(JSON.parse(forwarded.options.body),{id:'record',local:'Unidade revisada'});
  assert.equal(forwarded.url,'https://principal.invalid/darpe/mobile/api/atendimentos/');
 }finally{
  global.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.PRINCIPAL_URL;
  else process.env.PRINCIPAL_URL=originalUrl;
 }
}));

test('PDF individual é encaminhado sem converter o binário em JSON',()=>run(async base=>{
 const originalFetch=global.fetch,originalUrl=process.env.PRINCIPAL_URL;
 process.env.PRINCIPAL_URL='https://principal.invalid';
 let forwarded;
 global.fetch=async(url,options)=>{
  if(String(url).startsWith(base))return originalFetch(url,options);
  forwarded=String(url);
  return new Response(Buffer.from('%PDF-1.4 test'),{
   status:200,
   headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':"attachment; filename*=UTF-8''Papeleta_DARPE_07_11_2026.pdf",
   },
  });
 };
 try{
  const response=await originalFetch(base+'/api/darpe/exportar-pdf/?id=record',{
   headers:{Authorization:'Bearer token'},
  });
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.match(response.headers.get('content-disposition'),/Papeleta_DARPE/);
  assert.equal(await response.text(),'%PDF-1.4 test');
  assert.equal(forwarded,'https://principal.invalid/darpe/mobile/api/exportar-pdf/?id=record');
 }finally{
  global.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.PRINCIPAL_URL;
  else process.env.PRINCIPAL_URL=originalUrl;
 }
}));
