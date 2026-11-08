(() => {
 'use strict';
 const root=document.querySelector('#darpe-attendance');if(!root)return;
 if(window.requireAuth&&!window.requireAuth())return;
 const $=id=>document.getElementById(id),form=$('da-form'),base=root.dataset.api;
 const roles={atendente:'Atendente responsável',oracao:'Oração',musico:'Músico',organista:'Organista',colaborador:'Colaborador',palavra:'Irmão da palavra'};
 const prayers={enfermidades:'Enfermidade(s)',acidentados:'Acidentado(s)',tribulacoes:'Tribulação(ões)',familias:'Família(s)',causas:'Causa(s)',testemunhados:'Testemunhado(s)',viagens:'Viagem(ns)'};
 const mobileForm=root.dataset.mode==='mobile-form',query=new URLSearchParams(location.search);
 let context,team=[],submissionId,busy=false,records=[],searchVersion=0,timer,editing=false,activeRecord=null;
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function feedback(type,title,message){return window.AppFeedback.show({type,title,message,toast:true});}
 async function api(action,options={}){const headers=new Headers(options.headers||{});if(options.body){headers.set('Content-Type','application/json');const csrf=form.querySelector('[name=csrfmiddlewaretoken]');if(csrf)headers.set('X-CSRFToken',csrf.value);}const response=await (window.authFetch||fetch)(base+action,{cache:'no-store',...options,headers});let data;try{data=await response.json();}catch{throw Error('Não foi possível ler a resposta do servidor.');}if(!response.ok)throw Error(data.error||'Não foi possível concluir a operação.');return data;}
 function sectorName(id){return context.setores.find(s=>s.id===Number(id))?.nome||'Setor '+id;}
 function dateLabel(value){const [y,m,d]=value.split('-');return `${d}/${m}/${y}`;}
 function show(view){$('da-editor').hidden=view!=='editor';$('da-detail').hidden=view!=='detail';root.querySelector('.da-list').hidden=view!=='list';$('da-new').hidden=view!=='list';}
 function drawTeam(){const target=$('da-team');target.replaceChildren();for(const [role,title] of Object.entries(roles)){const group=node('section',undefined,'mobile-team-role'),heading=node('div',undefined,'mobile-team-heading'),add=node('button',['atendente','palavra'].includes(role)?'Selecionar':'Adicionar','mobile-add-person');add.type='button';add.onclick=()=>{$('da-role').value=role;invalidateSearch();$('da-person-query').placeholder='Pesquisar '+title.toLowerCase();$('da-person-query').focus();$('da-person-query').scrollIntoView({block:'center',behavior:'smooth'});};heading.append(node('h3',title),add);group.append(heading);const selected=team.filter(p=>p.funcao===role);if(!selected.length)group.append(node('p','Nenhuma pessoa selecionada.','mobile-role-empty'));for(const entry of selected){const item=node('div',undefined,'da-member'),remove=node('button','×');remove.type='button';remove.setAttribute('aria-label','Remover '+entry.nome);remove.onclick=()=>{team=team.filter(p=>p!==entry);drawTeam();};item.append(node('span',entry.nome),remove);group.append(item);}target.append(group);}}
 function syncLocalities(resetCommon=false){const city=form.elements.municipio,common=form.elements.comum,scope=context.escopo;const desiredCity=city.value||(['municipal','local'].includes(scope.level)?scope.municipio:query.get('municipio')||scope.municipio)||'',desiredCommon=scope.comum||(resetCommon?'':common.value||query.get('comum')||'');const catalog=context.localidades||[];city.replaceChildren(new Option('Selecione o município',''));for(const value of [...new Set(catalog.map(r=>r.municipio))].sort((a,b)=>a.localeCompare(b,'pt-BR')))city.add(new Option(value,value));city.value=[...city.options].find(o=>o.value.toLowerCase()===desiredCity.toLowerCase())?.value||'';common.replaceChildren(new Option('Selecione a comum',''));for(const row of catalog.filter(r=>r.municipio===city.value))common.add(new Option(row.comum,row.comum));common.value=[...common.options].find(o=>o.value.toLowerCase()===desiredCommon.toLowerCase())?.value||'';city.disabled=['municipal','local'].includes(scope.level)||Boolean(scope.comum&&scope.municipio);common.disabled=Boolean(scope.comum)||scope.level==='local';}
 function invalidateSearch(){searchVersion++;clearTimeout(timer);$('da-person-results').replaceChildren();$('da-search-status').textContent='';}
 function fresh(){editing=false;activeRecord=null;$('da-editor-title').textContent='Lançar atendimento';$('da-save').lastChild.textContent=' Registrar atendimento';form.reset();form.querySelectorAll('input,select,textarea').forEach(x=>x.disabled=false);team=[];submissionId=crypto.randomUUID();const scope=context.escopo;form.elements.municipio.value=scope.municipio||'';form.elements.comum.value=scope.comum||'';form.elements.municipio.readOnly=['municipal','local'].includes(scope.level);form.elements.comum.readOnly=scope.level==='local';syncLocalities();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());form.elements.data.value=query.get('data')||today;form.elements.data.max=today;drawTeam();invalidateSearch();show('editor');}
 function edit(item){fresh();editing=true;activeRecord=item;submissionId=item.id;for(const key of ['data','hora_inicio','hora_fim','setor','local','whatsapp','telefone','municipio','comum','palavra','participacao','observacoes'])form.elements[key].value=item[key]??'';syncLocalities();form.elements.hinos.value=(item.hinos||[]).join(', ');team=(item.equipe||[]).map(person=>({...person}));for(const key of Object.keys(prayers))form.elements['pedido_'+key].value=item.pedidos_oracao?.[key]==='todas'?0:(item.pedidos_oracao?.[key]??0);$('da-all-families').checked=item.pedidos_oracao?.familias==='todas';$('da-all-families').onchange();$('da-editor-title').textContent='Editar atendimento';$('da-save').lastChild.textContent=' Salvar alterações';drawTeam();show('editor');}
 async function search(){const version=++searchVersion,query=$('da-person-query').value.trim(),role=$('da-role').value;const target=$('da-person-results');target.replaceChildren();if(query.length<2){$('da-search-status').textContent='Digite pelo menos 2 letras.';return;}$('da-search-status').textContent='Pesquisando no cadastro DARPE…';try{const data=await api('pessoas/?'+new URLSearchParams({q:query,funcao:role}));if(version!==searchVersion)return;$('da-search-status').textContent=data.items.length?'Selecione uma pessoa.':'Nenhuma pessoa ativa encontrada para esta função.';for(const person of data.items){const button=node('button',undefined,'da-person');button.type='button';button.append(node('strong',person.nome),node('small',[person.comum,person.municipio,person.instrumento].filter(Boolean).join(' · ')));button.onclick=()=>{if(team.some(x=>x.cadastro_id===person.id&&x.funcao===role))return;if(['atendente','palavra'].includes(role)&&team.some(x=>x.funcao===role)){feedback('warning','Confira a equipe','Remova a pessoa já selecionada nesta função para substituí-la.');return;}team.push({cadastro_id:person.id,funcao:role,nome:person.nome});drawTeam();$('da-person-query').value='';invalidateSearch();};target.append(button);}}catch(error){if(version===searchVersion)$('da-search-status').textContent=error.message;}}
 function detail(item){
  activeRecord=item;
  const target=$('da-detail-content');
  const back=$('da-detail-close');
  target.replaceChildren();
  target.append(back);
  const heading=node('div',undefined,'da-detail-heading');
  heading.append(
   node('span','Papeleta do atendimento','da-detail-kicker'),
   node('h2','Atendimento · '+dateLabel(item.data)),
  );
  target.append(heading);
  const actions=node('div',undefined,'da-detail-actions');
  const editButton=node('button','Editar campos','btn btn-primary');
  const pdfButton=node('button','Gerar PDF','btn btn-outline-primary');
  editButton.type=pdfButton.type='button';
  editButton.onclick=()=>edit(item);
  pdfButton.onclick=()=>downloadPdf(item,pdfButton);
  actions.append(editButton,pdfButton);
  target.append(actions);
  const sectorIcons={1:'fa-building',2:'fa-house',3:'fa-shield-halved',4:'fa-school'};
  const place=node('section',undefined,'da-detail-place');
  const placeIcon=node('span',undefined,'da-detail-place-icon');
  placeIcon.append(node('i',undefined,'fa fa-building'));
  const placeCopy=node('div',undefined,'da-detail-place-copy');
  placeCopy.append(node('span','Local atendido'),node('h3',item.local||'Local não informado'));
  place.append(placeIcon,placeCopy);
  const placeMeta=node('div',undefined,'da-detail-place-meta');
  placeMeta.append(
   node('span',undefined,'fa fa-location-dot'),
   document.createTextNode([item.municipio,item.comum].filter(Boolean).join(' · ')||'Localidade não informada'),
  );
  place.append(placeMeta);
  target.append(place);

  const overview=node('section',undefined,'da-detail-overview');
  const sector=node('article',undefined,'da-detail-overview-card da-detail-sector sector-'+item.setor);
  sector.append(node('span','Setor'));
  const sectorNameLine=node('strong');
  sectorNameLine.append(
   node('i',undefined,'fa '+(sectorIcons[item.setor]||'fa-building')),
   document.createTextNode(sectorName(item.setor)),
  );
  sector.append(sectorNameLine);
  const schedule=node('article',undefined,'da-detail-overview-card');
  schedule.append(node('span','Horário'));
  const scheduleLine=node('strong');
  scheduleLine.append(
   node('i',undefined,'fa fa-clock'),
   document.createTextNode(item.hora_inicio.slice(0,5)+' às '+item.hora_fim.slice(0,5)),
  );
  schedule.append(scheduleLine);
  overview.append(sector,schedule);
  target.append(overview);

  const teamSection=node('section',undefined,'da-detail-section');
  const teamTitle=node('div',undefined,'da-detail-section-heading');
  teamTitle.append(node('h3','Equipe do atendimento'));
  teamSection.append(teamTitle);
  const teamGrid=node('div',undefined,'da-detail-team-grid');
  const roleIcons={
   atendente:'fa-user-check',oracao:'fa-hands-praying',musico:'fa-music',
   organista:'fa-music',colaborador:'fa-people-group',palavra:'fa-user',
  };
  for(const [key,label]of Object.entries(roles)){
   const names=(item.equipe||[])
    .filter(person=>person.funcao===key)
    .map(person=>person.nome)
    .filter(Boolean);
   const roleCard=node('article',undefined,'da-detail-team-card');
   const roleHeading=node('div',undefined,'da-detail-team-label');
   roleHeading.append(
    node('i',undefined,'fa '+roleIcons[key]),
    node('span',label),
   );
   roleCard.append(roleHeading,node('p',names.join(', ')||'Não informado'));
   teamGrid.append(roleCard);
  }
  teamSection.append(teamGrid);
  target.append(teamSection);

  const paperSection=node('section',undefined,'da-detail-section');
  paperSection.append(node('div',undefined,'da-detail-section-heading'));
  paperSection.lastElementChild.append(node('h3','Registro da papeleta'));
  const hymns=(item.hinos||[]).map(number=>node('span',String(number),'da-detail-hymn'));
  const hymnCard=node('article',undefined,'da-detail-paper-card da-detail-hymns');
  hymnCard.append(node('span','Hinos'));
  const hymnList=node('div',undefined,'da-detail-hymn-list');
  if(hymns.length)hymnList.append(...hymns);
  else hymnList.append(node('span','Não informado','da-detail-empty'));
  hymnCard.append(hymnList);
  paperSection.append(hymnCard);
  const paperGrid=node('div',undefined,'da-detail-paper-grid');
  for(const [label,value,extraClass]of [
   ['Palavra',item.palavra,''],
   ['Participação',item.participacao,''],
   ['Observações',item.observacoes,''],
  ]){
   const card=node('article',undefined,'da-detail-paper-card '+extraClass);
   card.append(node('span',label),node('p',value||'Não informado',value?'':'da-detail-empty'));
   paperGrid.append(card);
  }
  paperSection.append(paperGrid);
  if(item.whatsapp||item.telefone){
   const contactGrid=node('div',undefined,'da-detail-contact-grid');
   for(const [label,value,icon]of [
    ['WhatsApp',item.whatsapp,'fa-comment'],
    ['Outro telefone',item.telefone,'fa-phone'],
   ]){
    if(!value)continue;
    const contact=node('article',undefined,'da-detail-contact');
    contact.append(node('i',undefined,'fa '+icon),node('span',label),node('strong',value));
    contactGrid.append(contact);
   }
   paperSection.append(contactGrid);
  }
  target.append(paperSection);

  const prayerSection=node('section',undefined,'da-detail-section da-detail-prayers');
  const prayerHeading=node('div',undefined,'da-detail-section-heading');
  prayerHeading.append(node('h3','Pedidos de oração'));
  prayerSection.append(prayerHeading);
  const prayerGrid=node('div',undefined,'da-detail-prayer-grid');
  for(const [key,label]of Object.entries(prayers)){
   const value=item.pedidos_oracao?.[key]??0;
   const card=node('article',undefined,'da-detail-prayer-card'+(value==='todas'?' is-all':''));
   card.append(node('span',label),node('strong',value==='todas'?'Todas':String(value)));
   prayerGrid.append(card);
  }
  prayerSection.append(prayerGrid);
  target.append(prayerSection);

  if(item.created_by_name||item.created_at){
   const metadata=node('div',undefined,'da-detail-metadata');
   if(item.created_by_name)metadata.append(node('span','Registrado por '+item.created_by_name));
   if(item.created_at)metadata.append(node('span','Registro '+new Date(item.created_at).toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',
   }).replace(',','')));
   target.append(metadata);
  }
  show('detail');
  back.focus();
 }
 async function downloadPdf(item,button){button.disabled=true;const notice=feedback('loading','Gerando papeleta PDF','Preparando o atendimento selecionado.');try{const response=await authFetch(base+'exportar-pdf/?'+new URLSearchParams({id:item.id}),{cache:'no-store'});if(!response.ok){let data;try{data=await response.json();}catch{data={};}throw Error(data.error||'Não foi possível gerar a papeleta.');}const blob=await response.blob(),url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='Papeleta_DARPE_'+item.data.split('-').reverse().join('_')+'.pdf';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.close();feedback('success','Papeleta gerada','O PDF do atendimento foi baixado.');}catch(error){notice.close();feedback('error','Falha ao gerar a papeleta',error.message);}finally{button.disabled=false;}}
 async function load(){const status=$('da-list-status');status.textContent='Carregando atendimentos…';$('da-refresh').disabled=true;try{const params=new URLSearchParams();if($('da-date').value)params.set('data',$('da-date').value);if($('da-sector-filter').value)params.set('setor',$('da-sector-filter').value);records=(await api('atendimentos/?'+params)).items;const target=$('da-records');target.replaceChildren();for(const item of records){const b=node('button',undefined,'da-record');b.type='button';const responsible=item.equipe.find(p=>p.funcao==='atendente');b.append(node('strong',dateLabel(item.data)+' · '+item.local),node('small','Setor '+item.setor+' · '+item.municipio+' · '+(responsible?.nome||'')));b.onclick=()=>detail(item);target.append(b);}status.textContent=records.length?records.length+' atendimento(s) no recorte.':'Nenhum atendimento no recorte. Use Novo atendimento para registrar uma papeleta.';return true;}catch(error){status.textContent=error.message;return false;}finally{$('da-refresh').disabled=false;}}
 form.elements.municipio.onchange=()=>syncLocalities(true);document.getElementById('mobile-logout').onclick=()=>logoutMobile();
 for(const [key,label]of Object.entries(prayers)){const wrap=node('label',label),input=node('input');input.type='number';input.min=0;input.max=99999;input.step=1;input.value='0';input.name='pedido_'+key;input.className='form-control';wrap.append(input);$('da-prayers').append(wrap);}
 $('da-all-families').onchange=()=>{form.elements.pedido_familias.disabled=$('da-all-families').checked;};
 $('da-person-query').oninput=()=>{invalidateSearch();timer=setTimeout(search,300);};$('da-role').onchange=()=>{invalidateSearch();search();};
 $('da-new').onclick=fresh;$('da-back').onclick=()=>{if(busy)return;if(editing&&activeRecord){detail(activeRecord);return;}location.assign('/');};$('da-detail-close').onclick=()=>location.assign('/');$('da-refresh').onclick=load;$('da-date').onchange=load;$('da-sector-filter').onchange=load;
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;const data=Object.fromEntries(new FormData(form));const hymnParts=String(data.hinos||'').split(/[,;\s]+/).filter(Boolean);if(hymnParts.some(x=>!/^\d+$/.test(x))){feedback('error','Confira os hinos','Separe os números dos hinos por vírgulas ou espaços.');return;}const payload={...data,municipio:form.elements.municipio.value,comum:form.elements.comum.value,id:submissionId,setor:Number(data.setor),hinos:hymnParts.map(Number),equipe:team.map(({cadastro_id,funcao})=>({cadastro_id,funcao})),pedidos_oracao:{}};for(const key of Object.keys(prayers))payload.pedidos_oracao[key]=key==='familias'&&$('da-all-families').checked?'todas':Number(data['pedido_'+key]||0);delete payload.csrfmiddlewaretoken;busy=true;$('da-save').disabled=true;$('da-back').disabled=true;$('da-save').querySelector('.da-spinner').hidden=false;form.setAttribute('aria-busy','true');const notice=feedback('loading',editing?'Salvando alterações':'Registrando atendimento','Aguarde a confirmação do sistema regional.');try{await api('atendimentos/',{method:editing?'PATCH':'POST',body:JSON.stringify(payload)});notice.close();feedback('success',editing?'Atendimento atualizado':'Atendimento registrado',editing?'As alterações foram salvas na papeleta.':'A papeleta foi salva no sistema regional.');setTimeout(()=>location.assign('/?data='+encodeURIComponent(form.elements.data.value)),1600);}catch(error){notice.close();feedback('error','Não foi possível confirmar o registro',error.message);}finally{busy=false;$('da-save').disabled=false;$('da-back').disabled=false;$('da-save').querySelector('.da-spinner').hidden=true;form.removeAttribute('aria-busy');}};
 (async()=>{try{context=await api('contexto/');for(const sector of context.setores){for(const id of ['da-sector','da-sector-filter']){const option=node('option','Setor '+sector.id+' · '+sector.nome);option.value=sector.id;$(id).append(option);}}$('da-scope').textContent='Escopo: '+[context.escopo.level,context.escopo.municipio,context.escopo.comum].filter(Boolean).join(' · ');if(mobileForm){if(query.get('registro')){await load();const record=records.find(r=>r.id===query.get('registro'));if(!record)throw Error('Atendimento não encontrado no seu escopo.');detail(record);}else fresh();}else await load();}catch(error){$('da-new').disabled=true;$('da-list-status').textContent=error.message;feedback('error','Não foi possível carregar a papeleta',error.message);$('da-save').disabled=true;}})();
})();
