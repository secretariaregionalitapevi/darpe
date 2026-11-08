const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

const root=path.join(__dirname,'..');
const record={
 id:'record-1',
 data:'2026-11-07',
 hora_inicio:'10:00',
 hora_fim:'11:00',
 setor:1,
 local:'Clínica da Vovó',
 municipio:'ITAPEVI',
 comum:'BR-22-0673 - VILA DOUTOR CARDOSO',
 equipe:[
  {cadastro_id:'attendant',funcao:'atendente',nome:'FLAVIO ALVES SIQUEIRA'},
  {cadastro_id:'prayer',funcao:'oracao',nome:'BRUNO DE ARAÚJO DIAS SALGADO'},
  {cadastro_id:'collaborator',funcao:'colaborador',nome:'MARCIO RAFAEL DA SILVA'},
  {cadastro_id:'word',funcao:'palavra',nome:'DANIEL MATHIAS BICUDO'},
 ],
 hinos:[374,148],
 palavra:'Atos 3',
 participacao:'40 internos',
 observacoes:'Observação preenchida',
 pedidos_oracao:{
  enfermidades:10,acidentados:2,tribulacoes:14,familias:'todas',
  causas:17,testemunhados:5,viagens:19,
 },
};

test('abrir atendimento carrega papeleta completa e oferece editar e PDF',async()=>{
 const html=fs.readFileSync(path.join(root,'public/atendimento.html'),'utf8');
 const script=fs.readFileSync(path.join(root,'public/scripts/darpe-atendimentos.js'),'utf8');
 const dom=new JSDOM(html,{
  url:'http://app.test/atendimento?registro='+record.id,
  runScripts:'outside-only',
 });
 const {window}=dom;
 window.Headers=Headers;
 window.crypto.randomUUID=require('node:crypto').randomUUID;
 window.requireAuth=()=>true;
 window.logoutMobile=()=>{};
 window.AppFeedback={show:()=>({close(){}})};
 window.HTMLElement.prototype.scrollIntoView=()=>{};
 window.HTMLAnchorElement.prototype.click=()=>{};
 window.URL.createObjectURL=()=> 'blob:test';
 window.URL.revokeObjectURL=()=>{};
 window.authFetch=async url=>{
  if(String(url).includes('exportar-pdf'))return new Response('%PDF-test',{status:200});
  const body=String(url).includes('contexto')
   ?{escopo:{level:'regional'},setores:[{id:1,nome:'Sistemas de Ressocialização e Socioeducativos'}],localidades:[]}
   :{items:[record]};
  return new Response(JSON.stringify(body),{status:200});
 };
 try{
  window.eval(script);
  await new Promise(resolve=>setTimeout(resolve,30));
  const document=window.document;
  const details=document.getElementById('da-detail-content');
  const text=details.textContent;
  assert.equal(document.getElementById('da-detail').hidden,false);
  assert.match(text,/Atendimento · 07\/11\/2026/);
  for(const value of [
   'Editar campos','Gerar PDF','Sistemas de Ressocialização e Socioeducativos',
   'Clínica da Vovó','ITAPEVI',
   'BR-22-0673 - VILA DOUTOR CARDOSO','10:00 às 11:00',
   'FLAVIO ALVES SIQUEIRA','BRUNO DE ARAÚJO DIAS SALGADO',
   'MARCIO RAFAEL DA SILVA','DANIEL MATHIAS BICUDO',
   'Atos 3','40 internos','Observação preenchida','Todas',
  ])assert(text.includes(value),value);
  assert.deepEqual(
   [...details.querySelectorAll('.da-detail-hymn')].map(hymn=>hymn.textContent),
   ['374','148'],
  );

  const editButton=details.querySelector('.da-detail-actions .btn-primary');
  assert(editButton);
  editButton.click();
  assert.equal(document.getElementById('da-editor').hidden,false);
  assert.equal(document.querySelector('[name="local"]').value,record.local);
  assert.equal(document.querySelector('[name="hinos"]').value,'374, 148');
  assert.equal(document.querySelector('[name="pedido_enfermidades"]').value,'10');
  assert.equal(document.getElementById('da-all-families').checked,true);
  assert(details.querySelector('.da-detail-actions .btn-outline-primary'));
 }finally{
  window.close();
 }
});

test('clicar no cartão abre a papeleta pelo identificador do atendimento',async()=>{
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const script=fs.readFileSync(path.join(root,'public/scripts/mobile-home.js'),'utf8');
 const dom=new JSDOM(html,{
  url:'http://app.test/?data='+record.data,
  runScripts:'outside-only',
 });
 const {window}=dom;
 window.requireAuth=()=>true;
 window.logoutMobile=()=>{};
 window.mobileSession={get:()=>null};
 window.authFetch=async url=>{
  const body=String(url).includes('contexto')
   ?{usuario:{nome:'Operador'},escopo:{level:'regional'},setores:[{id:1,nome:'Setor 1'}],localidades:[]}
   :{items:[record]};
  return new Response(JSON.stringify(body),{status:200});
 };
 try{
  window.eval(script);
  await new Promise(resolve=>setTimeout(resolve,30));
  const cardLink=window.document.querySelector('.mobile-card-main');
  assert(cardLink);
  assert.equal(cardLink.href,'http://app.test/atendimento?registro='+record.id);
 }finally{
  window.close();
 }
});
