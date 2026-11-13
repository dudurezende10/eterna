// Eduardo (11/11): na Qualidade (Curadoria) a data tem Hoje, Ontem, Últimos 7 dias, Últimos 30 dias e Data específica.
// Plano docs/planos/2026-11-11-curadoria-datas.md. Só o app, sem agente. Print em 1920x1080 em CURADORIA_PRINT (opcional).
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
// fuso do venue por padrão: a sessão local com date:'hoje' é datada pelo dia do navegador; agora = relógio parado nessa hora
async function nova(b,w,h,tz,agora){const ctx=await b.newContext({viewport:{width:w,height:h},timezoneId:tz||'America/Sao_Paulo'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(8000);if(agora)await pg.clock.setFixedTime(new Date(agora));
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
  await pg.goto(U,{waitUntil:'domcontentloaded',timeout:60000});await pg.waitForSelector('[data-act="login-usuario"]');await pg.waitForTimeout(200);
  await require('./_entrar')(pg,'eduardo@eduardorezende.com');/* v93: usuário e senha */return {ctx,pg};}
// sessões simuladas em dias diferentes (dia do venue, o mesmo Hoje da tela e do Painel): hoje (2), ontem, hoje-6, hoje-7, hoje-29 e hoje-30
const semear=pg=>pg.evaluate(()=>{const E=ETERNA;const px='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const [y,m,d0]=E.venueToday().split('-').map(Number);const dia=n=>new Date(Date.UTC(y,m-1,d0-n)).toISOString().slice(0,10);
  const dias={};const nova=(card,n,key,date,vend)=>{const photos=[1,2,3].map(i=>{const id='cd_'+card+'_'+i;E.UP[id]={src:px,name:id+'.jpg'};return {id,sold:i<=vend?1:0};});
    E.SIM.sessions[card]={key,date:date||dia(n),openedAt:new Date().toISOString(),time:'10:0'+(n%10),pdv:'Foto Campo 2',photos,status:'fechada'};dias[card]=dia(n);};
  nova('CDHOJE1',0,'carlos','hoje',0);nova('CDHOJE2',0,'samuel',null,3);nova('CDONTEM',1,'carlos',null,1);nova('CDD6',6,'carlos',null,0);nova('CDD7',7,'carlos',null,0);nova('CDD29',29,'samuel',null,0);nova('CDD30',30,'carlos',null,0);
  // revisões: uma de hoje e uma de hoje-7, as duas do Carlos
  E.state.reviews.CDHOJE1={key:'carlos',date:dia(0),card:'CDHOJE1',photos:{cd_CDHOJE1_1:1,cd_CDHOJE1_2:1},score:5,tags:[],note:''};
  E.state.reviews.CDD7={key:'carlos',date:dia(7),card:'CDD7',photos:{cd_CDD7_1:-1,cd_CDD7_2:-1},score:1,tags:[],note:''};
  E.go('revisao');return dias;});
const tela=pg=>pg.evaluate(()=>{const q=s=>[...document.querySelectorAll('#main '+s)];const t=s=>{const e=document.querySelector('#main '+s);return e?e.textContent.replace(/\s+/g,' ').trim():null;};
  return {chips:q('[data-act="rev-per"]').map(b=>[b.textContent.trim(),b.getAttribute('aria-pressed')]),sel:q('[data-act="rev-per"][aria-pressed="true"]').map(b=>b.dataset.k),
    cards:q('.scard').map(b=>b.dataset.card).sort(),linhas:q('tr[data-card]').map(b=>b.dataset.card).sort(),pill:t('.revbar .pill'),resumo:t('#rev-resumo'),titulo:t('#rev-titulo'),vazio:t('#rev-vazio'),
    campo:t('.revf .datef-t'),tiles:q('.tiles .tile').map(x=>x.textContent.replace(/\s+/g,' ').trim())};});
const per=async(pg,k)=>{await pg.click(`#main [data-act="rev-per"][data-k="${k}"]`);await pg.waitForTimeout(120);return tela(pg);};
const br=d=>d.split('-').reverse().join('/');const cd=l=>l.filter(c=>/^CD/.test(c));const ses=n=>n+' sess'+(n===1?'ão':'ões');
// a amostra importada (12 e 13/10) pode cair dentro dos 30 dias ou no dia de hoje-30: o teste soma o que for dela no período
const amostra=(pg,de,ate)=>pg.evaluate(([de,ate])=>{const l=ETERNA.revSessions().filter(s=>!/^C[DG]/.test(s.card)&&s.date>=de&&s.date<=ate);return {n:l.length,f:l.reduce((a,s)=>a+s.total,0),v:l.reduce((a,s)=>a+s.soldTotal,0)};},[de,ate]);
(async()=>{const b=await chromium.launch();
try{
  const {ctx,pg}=await nova(b,1366,768);
  // 0: sem dados de hoje (amostra de 12 e 13/10): Hoje marcado, lista vazia com a dica
  await pg.evaluate(()=>ETERNA.go('revisao'));await pg.waitForTimeout(150);let t=await tela(pg);
  ok(J(t.chips.map(c=>c[0]))===J(['Hoje','Ontem','Últimos 7 dias','Últimos 30 dias','Data específica']),'0: as cinco opções: '+J(t.chips));
  ok(J(t.sel)===J(['hoje']),'0: padrão Hoje: '+J(t.sel));ok(!t.cards.length&&!t.linhas.length&&/Nenhuma sessão neste período\. As sessões de exemplo são de 12\/10 a 13\/10/.test(t.vazio||''),'0: vazio com a dica: '+J(t.vazio));
  ok(t.campo===null,'0: campo de data só na Data específica');ok(/^Amostra · 12\/10 a 13\/10/.test(await pg.textContent('#main .head .eyebrow')),'0: Amostra com os dias calculados');
  const dias=await semear(pg);await pg.waitForTimeout(150);const hoje=dias.CDHOJE1;
  // 1: Hoje
  t=await tela(pg);ok(J(t.cards)===J(['CDHOJE1','CDHOJE2'])&&J(t.linhas)===J(t.cards),'1: Hoje só com as de hoje: '+J(t.cards)+J(t.linhas));
  ok(t.pill==='2 sessões'&&t.resumo===`Hoje, ${br(hoje)} · 2 sessões · 6 fotos · 3 vendidas`,'1: contagem e resumo: '+J([t.pill,t.resumo]));ok(t.titulo===`Sessões · Hoje, ${br(hoje)}`,'1: título com o período: '+J(t.titulo));
  ok(t.tiles.length===1&&/^Carlos.*100%.*2 boas · 0 ruins · 1 sessão( |$)/.test(t.tiles[0]),'1: cartão do fotógrafo só com a revisão de hoje: '+J(t.tiles));
  // 2: Ontem
  t=await per(pg,'ontem');ok(J(t.sel)===J(['ontem'])&&J(t.cards)===J(['CDONTEM'])&&J(t.linhas)===J(t.cards),'2: Ontem: '+J(t.cards));
  ok(t.resumo===`Ontem, ${br(dias.CDONTEM)} · 1 sessão · 3 fotos · 1 vendida`,'2: resumo: '+J(t.resumo));ok(!t.tiles.length,'2: sem revisão ontem, sem cartão: '+J(t.tiles));
  // 3: Últimos 7 dias, com hoje, sem hoje-7
  t=await per(pg,'7d');ok(J(t.cards)===J(['CDD6','CDHOJE1','CDHOJE2','CDONTEM'])&&J(t.linhas)===J(t.cards),'3: 7 dias: '+J(t.cards));
  ok(t.resumo===`Últimos 7 dias, ${br(dias.CDD6).slice(0,5)} a ${br(hoje)} · 4 sessões · 12 fotos · 4 vendidas`,'3: resumo: '+J(t.resumo));ok(t.tiles.length===1&&/ 1 sessão( |$)/.test(t.tiles[0]),'3: revisão de hoje-7 fora: '+J(t.tiles));
  // 9: Próxima sessão só anda pelo período
  {const ordem=await pg.$$eval('#main .scard',e=>e.map(x=>x.dataset.card));ok(ordem[ordem.length-1]==='CDD6'&&ordem[2]==='CDONTEM','9: da mais recente para a mais antiga: '+J(ordem));
    await pg.click(`#main .scard[data-card="${ordem[0]}"]`);await pg.waitForTimeout(100);const vis=[];for(let i=0;i<4;i++){await pg.click('#main [data-act="next"]');await pg.waitForTimeout(80);vis.push(await pg.evaluate(()=>ETERNA.state.session));}
    ok(J(vis)===J([ordem[1],ordem[2],ordem[3],ordem[0]]),'9: Próxima sessão dentro do período e na ordem da tela: '+J([ordem,vis]));await pg.click('#main [data-act="back-sessions"]');await pg.waitForTimeout(100);}
  // 4: Últimos 30 dias, com hoje-29, sem hoje-30
  const a30=await amostra(pg,dias.CDD29,hoje);t=await per(pg,'30d');ok(J(cd(t.cards))===J(['CDD29','CDD6','CDD7','CDHOJE1','CDHOJE2','CDONTEM'])&&J(t.linhas)===J(t.cards)&&t.cards.length===6+a30.n,'4: 30 dias: '+J(t.cards));
  ok(t.pill===ses(6+a30.n)&&t.resumo===`Últimos 30 dias, ${br(dias.CDD29).slice(0,5)} a ${br(hoje)} · ${ses(6+a30.n)} · ${18+a30.f} fotos · ${4+a30.v} vendidas`,'4: resumo: '+J(t.resumo));
  ok(t.tiles.length===1&&/^Carlos.*50%.*2 boas · 2 ruins · 2 sessões/.test(t.tiles[0]),'4: cartão do fotógrafo com as duas revisões: '+J(t.tiles));
  // filtros juntos: fotógrafo e venda dentro do período
  await pg.selectOption('#main [data-act="rev-key"]','samuel');await pg.waitForTimeout(100);t=await tela(pg);ok(J(cd(t.cards))===J(['CDD29','CDHOJE2']),'4: fotógrafo dentro do período: '+J(t.cards));
  await pg.selectOption('#main [data-act="rev-venda"]','sem');await pg.waitForTimeout(100);t=await tela(pg);ok(J(cd(t.cards))===J(['CDD29']),'4: venda dentro do período: '+J(t.cards));
  await pg.selectOption('#main [data-act="rev-key"]','all');await pg.selectOption('#main [data-act="rev-venda"]','all');await pg.waitForTimeout(100);
  // 8: a escolha continua depois de sair da tela e voltar
  await pg.evaluate(()=>ETERNA.go('treino'));await pg.waitForTimeout(100);await pg.evaluate(()=>ETERNA.go('revisao'));await pg.waitForTimeout(120);t=await tela(pg);
  ok(J(t.sel)===J(['30d'])&&t.cards.length===6+a30.n,'8: escolha lembrada: '+J([t.sel,t.cards.length]));
  // 5: Data específica: aparece o campo (hoje), e a data escolhida filtra
  t=await per(pg,'data');ok(J(t.sel)===J(['data'])&&t.campo===br(hoje)&&J(t.cards)===J(['CDHOJE1','CDHOJE2']),'5: campo aparece com hoje: '+J([t.sel,t.campo,t.cards]));
  const dataEm=async d=>{await pg.evaluate(d=>{const i=document.querySelector('#main [data-act="rev-date"]');i.value=d;i.dispatchEvent(new Event('change',{bubbles:true}));},d);await pg.waitForTimeout(120);return tela(pg);};
  const aD=await amostra(pg,dias.CDD30,dias.CDD30);t=await dataEm(dias.CDD30);ok(t.campo===br(dias.CDD30)&&J(cd(t.cards))===J(['CDD30'])&&t.resumo===`${br(dias.CDD30)} · ${ses(1+aD.n)} · ${3+aD.f} fotos · ${aD.v} vendidas`&&t.titulo===`Sessões · ${br(dias.CDD30)}`,'5: data de hoje-30: '+J([t.campo,t.cards,t.resumo,t.titulo]));
  const am=(await amostra(pg,'2026-10-11','2026-10-11')).n;t=await dataEm('2026-10-11');ok(am===0&&t.pill==='0 sessões'&&/Nenhuma sessão neste período/.test(t.vazio||'')&&t.titulo===null,'5: dia sem sessão: '+J([t.pill,t.vazio,t.titulo]));
  const a12=(await amostra(pg,'2026-10-12','2026-10-12')).n+(dias.CDD30==='2026-10-12'?1:0);t=await dataEm('2026-10-12');
  ok(a12>0&&t.pill===ses(a12)&&t.linhas.length===a12,'5: data da amostra (12/10): '+J([a12,t.pill,t.linhas.length]));
  ok((await pg.getAttribute('#main [data-act="rev-date"]','max'))===hoje,'5: data máxima é hoje');
  // 11: alvos de toque do filtro com 44 px ou mais; sem rolagem lateral
  const alt=await pg.$$eval('#main .revbar .chip, #main .revbar .datef, #main .revbar select',e=>e.map(x=>Math.round(x.getBoundingClientRect().height)));ok(alt.length===8&&alt.every(h=>h>=44),'11: alvos de 44 px: '+J(alt));
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'11: sem rolagem lateral em 1366');
  // 13: Lista de vendas abre a sessão; "← Sessões" volta em Data específica na data dela, com o filtro de fotos preservado
  await pg.evaluate(()=>{const E=ETERNA;E.state.revFilter.per='hoje';E.state.revFilter.key='samuel';E.state.revFilter.foto='sold';E.go('vendas-lista');const b=document.createElement('button');b.dataset.act='sales-open-session';b.dataset.card='CDD7';b.id='cd-abre';document.querySelector('#main').appendChild(b);});
  await pg.dispatchEvent('#cd-abre','click');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.view==='revisao'&&ETERNA.state.session==='CDD7'),'13: a sessão da venda abre');
  await pg.click('#main [data-act="back-sessions"]');await pg.waitForTimeout(120);t=await tela(pg);const f13=await pg.evaluate(()=>ETERNA.state.revFilter);
  ok(J(t.sel)===J(['data'])&&t.campo===br(dias.CDD7)&&cd(t.cards).includes('CDD7')&&f13.foto==='sold'&&f13.key==='all'&&f13.venda==='all','13: volta na data da sessão com foto preservado: '+J([t.sel,t.campo,t.cards,f13]));
  // 14: "Revisar fotos" de Fotógrafos nunca cai numa lista vazia
  const revisar=async(range,dia)=>{await pg.evaluate(([r,dia])=>{const E=ETERNA;E.state.revFilter.per='hoje';E.state.revFilter.venda='all';E.state.range=r;E.state.view='fotografos';E.state.person='carlos';E.state.personDay=dia;E.render();},[range,dia]);await pg.waitForTimeout(120);
    await pg.click('#main [data-act="review-person"]');await pg.waitForTimeout(150);const x=await tela(pg);x.key=await pg.evaluate(()=>ETERNA.state.revFilter.key);x.nomes=await pg.$$eval('#main .scard .name',e=>[...new Set(e.map(n=>n.textContent))]);return x;};
  t=await revisar({from:'2026-10-07',to:'2026-10-15'},null);
  if(dias.CDD29<='2026-10-07')ok(J(t.sel)===J(['30d'])&&t.cards.length>0,'14: intervalo dentro dos 30 dias: '+J([t.sel,t.cards.length]));
  else ok(J(t.sel)===J(['data'])&&t.campo==='13/10/2026'&&t.cards.length>0,'14: intervalo antigo abre no dia mais recente com sessão do fotógrafo: '+J([t.sel,t.campo,t.cards.length]));
  ok(t.key==='carlos'&&J(t.nomes)===J(['Carlos']),'14: só o fotógrafo escolhido: '+J([t.key,t.nomes]));
  t=await revisar({from:'2026-10-07',to:'2026-10-15'},'2026-10-12');ok(J(t.sel)===J(['data'])&&t.campo==='12/10/2026'&&t.cards.length>0&&J(t.nomes)===J(['Carlos']),'14: com o dia aberto, a data é a dele: '+J([t.sel,t.campo,t.cards.length]));
  t=await revisar({from:dias.CDD6,to:hoje},null);ok(J(t.sel)===J(['7d'])&&J(cd(t.cards))===J(['CDD6','CDHOJE1','CDONTEM']),'14: intervalo recente vira Últimos 7 dias: '+J([t.sel,t.cards]));
  t=await revisar({from:dias.CDD29,to:hoje},null);ok(J(t.sel)===J(['30d'])&&cd(t.cards).length===4,'14: intervalo de 30 dias vira Últimos 30 dias: '+J([t.sel,t.cards]));
  await pg.evaluate(()=>{ETERNA.state.revFilter.key='all';ETERNA.state.revFilter.per='data';ETERNA.state.revFilter.date='2026-10-12';ETERNA.go('revisao');});await pg.waitForTimeout(120);
  if(process.env.CURADORIA_PRINT){await pg.setViewportSize({width:1920,height:1080});await pg.waitForTimeout(200);await pg.screenshot({path:process.env.CURADORIA_PRINT});await pg.setViewportSize({width:1366,height:768});}
  // 10: 30 dias com milhares de sessões desenha sem travar
  const ms=await pg.evaluate(()=>{const E=ETERNA;const px=E.UP.cd_CDHOJE1_1.src;const d0=new Date();for(let i=0;i<9000;i++){const d=new Date(d0);d.setDate(d.getDate()-(i%30));const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const photos=[0,1,2,3,4,5,6,7].map(j=>{const id='cg_'+i+'_'+j;E.UP[id]={src:px,name:id+'.jpg'};return {id,sold:0};});E.SIM.sessions['CG'+i]={key:'yago',date:iso,time:'11:00',pdv:'Foto Campo 3',photos,status:'fechada'};}
    E.state.revFilter.per='30d';const t0=performance.now();E.render();return Math.round(performance.now()-t0);});
  await pg.evaluate(()=>{const S=ETERNA.SIM.sessions;Object.keys(S).forEach(c=>{if(/^CG/.test(c))delete S[c];});});
  t=await tela(pg);ok(t.pill===ses(9006+a30.n)&&t.cards.length===80&&t.linhas.length===300&&(t.titulo||'').includes(`as 300 mais recentes de ${9006+a30.n}`),'10: 9006 sessões em 30 dias: '+J([t.pill,t.cards.length,t.linhas.length,t.titulo]));
  ok(ms<3000,'10: 30 dias com 9 mil sessões em menos de 3 s: '+ms+' ms');
  await ctx.close();
  // celular: os chips quebram a linha, sem rolagem lateral
  {const {ctx:c2,pg:p2}=await nova(b,390,844);await p2.evaluate(()=>{ETERNA.state.revFilter.per='data';ETERNA.go('revisao');});await p2.waitForTimeout(200);
    ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'11: sem rolagem lateral em 390');ok((await p2.$$('#main [data-act="rev-per"]')).length===5&&!!(await p2.$('#main [data-act="rev-date"]')),'11: seletor no celular');await c2.close();}
  // 15: navegador em outro fuso perto da meia-noite (00:30 no Rio, 22:30 da véspera em Nova York): o Hoje é o do venue, como no Painel
  {const {ctx:c3,pg:p3}=await nova(b,1366,768,'America/New_York','2026-11-12T03:30:00Z');
    await p3.evaluate(()=>{const E=ETERNA;const px='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';[['TZ12','2026-11-12'],['TZ11','2026-11-11']].forEach(([card,date])=>{E.UP['tz_'+card]={src:px,name:card+'.jpg'};E.SIM.sessions[card]={key:'carlos',date,time:'00:10',pdv:'Foto Campo 2',photos:[{id:'tz_'+card,sold:0}],status:'fechada'};});E.go('revisao');});await p3.waitForTimeout(150);
    let z=await tela(p3);ok(await p3.evaluate(()=>new Date().getDate()===11&&ETERNA.venueToday()==='2026-11-12'),'15: o navegador está na véspera do venue');
    ok(J(z.cards)===J(['TZ12'])&&z.resumo==='Hoje, 12/11/2026 · 1 sessão · 1 foto · 0 vendidas','15: Hoje pelo dia do venue: '+J([z.cards,z.resumo]));
    z=await per(p3,'ontem');ok(J(z.cards)===J(['TZ11'])&&/^Ontem, 11\/11\/2026/.test(z.resumo),'15: Ontem pelo dia do venue: '+J([z.cards,z.resumo]));
    z=await per(p3,'data');ok(z.campo==='12/11/2026'&&(await p3.getAttribute('#main [data-act="rev-date"]','max'))==='2026-11-12','15: Data específica começa e termina no hoje do venue: '+J(z.campo));await c3.close();}
}catch(e){fails.push('exceção: '+(e&&e.message||e).toString().slice(0,300));}
await b.close();if(errs.length)fails.push('erros de JS: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA curadoria-datas: '+fails.join(' || '));process.exit(1);}
console.log('OK curadoria-datas: Hoje (padrão, dia do venue), Ontem, 7 e 30 dias com hoje, Data específica, números no período, escolha lembrada, Revisar de Fotógrafos, sessão da Lista de vendas, outro fuso, 9 mil sessões sem travar');})();
