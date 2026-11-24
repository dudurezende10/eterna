// P1 de poses (plano docs/planos/2026-11-23-poses-estatistica.md): cartão "Classificação de poses" em Sistema › Fundos de IA
// (técnico), view chroma, com agente falso (page.route). Confere:
//  1. o cartão mostra o modo, a janela, o modelo e a última noite do /status.poses, com os 3 botões (Desligada, Sombra, Ligada)
//  2. trocar o modo pede confirmação; cancelar não manda nada; confirmar manda POST /poses/config {modo} e grava o registro
//     poses_modo (de, para) no histórico
//  3. Ligada sem a medida: 409 criterio vira o aviso "faltam N" e o modo não muda nem vai para o histórico; 403 e 429 avisam
//  4. cliques repetidos enquanto o servidor responde: um pedido só
//  5. ETERNA_POSES=0 (forcada) aparece no cartão; motivo de cada parou_por em palavras, sem chave crua
//  6. sem Painel de controle em Alterar, ou sem ser Admin (24/11: Supervisora com Alterar), só o texto (sem botões); sem configuracao.r, agente antigo (sem poses) ou agente fora:
//     nenhum cartão
//  7. 4 línguas da equipe (a 5ª coluna do dicionário também preenchida) sem chave faltando, e o registro poses_modo traduzido no histórico
//  8. 390 px e 768 px sem rolagem lateral (prints em testes/prints/)
//  9. Fotógrafos no menu da Curadoria (não no Dashboard), aberto com desempenho.r
// Nenhuma foto: o cartão só tem números e códigos.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const login=require('./_login.js');
const fs=require('fs'),path=require('path');const P=path.join(__dirname,'prints');fs.mkdirSync(P,{recursive:true});
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const PS={v:1,modo:'desligada',forcada:false,versao:'a1b2c3d4',modelo:{ok:false,erro:'sem_modelo',nome:'qwen3vl-8b-q4',pronto:false,carga_ms:null},
  janela:{ini:'20:00',fim:'07:00'},na_janela:false,pendentes:0,parado:false,rodando:false,noite:{ini:null,fim:null,feitas:0,duvidas:0,erros:0,ms_med:0,parou_por:null}};
const SRV={ps:JSON.parse(J(PS)),posts:[],resp:null,atraso:0,semPoses:false};
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>{const st={ok:true,agent:'eterna-agente',version:3,boot:'bP',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
      recorte:{ok:true,carregado:true,feitos:0,ms_medio:0,fila:0},montagem:{v:1,modo:'desligada',ok:false,motivo:'desligada'},fundos_modo:'local'};
    if(!SRV.semPoses)st.poses=SRV.ps;r.fulfill({status:200,contentType:'application/json',body:J(st)});});
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/poses/config',async r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}SRV.posts.push({j,h:r.request().headers()});
    if(SRV.atraso)await new Promise(res=>setTimeout(res,SRV.atraso));
    const x=SRV.resp||{status:200,body:{ok:true,modo:j.modo,janela:SRV.ps.janela,por:'eduardo@eduardorezende.com',em:'2026-11-23T20:00:00Z',forcada:false}};
    if(x.status===200)SRV.ps=Object.assign({},SRV.ps,{modo:j.modo});
    r.fulfill({status:x.status,contentType:'application/json',body:J(x.body)});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  const dialogs=[];let aceita=true;pg.on('dialog',d=>{dialogs.push(d.message());aceita?d.accept():d.dismiss();});
  await login(pg);
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(120);}return false;};
  ok(await espera(()=>window.ETERNA&&ETERNA.state.user&&ETERNA.state.agent.on&&ETERNA.state.agent.poses,15000),'o /status.poses chegou ao app');
  await pg.evaluate(()=>ETERNA.go('chroma'));
  ok(await espera(()=>!!document.querySelector('#ps-srv'),5000),'1: cartão #ps-srv na view chroma');
  const t1=await pg.evaluate(()=>{const c=document.querySelector('#ps-srv').parentElement.innerText;return {c,bt:[...document.querySelectorAll('[data-act="ps-modo"]')].map(x=>x.dataset.v+':'+x.getAttribute('aria-pressed'))};});
  ok(/Classificação de poses/.test(t1.c)&&/desligada \(nada roda\)/.test(t1.c)&&/Janela: das 20:00 às 07:00/.test(t1.c)&&/não está instalado/.test(t1.c)&&/ainda não rodou/.test(t1.c),'1: textos do cartão: '+t1.c.slice(0,400));
  ok(J(t1.bt)===J(['desligada:true','sombra:false','ligada:false']),'1: 3 botões, Desligada marcada: '+J(t1.bt));
  // 2: cancelar a confirmação não manda nada
  aceita=false;await pg.click('[data-act="ps-modo"][data-v="sombra"]');await pg.waitForTimeout(300);
  ok(dialogs.length===1&&/Sombra/.test(dialogs[0])&&SRV.posts.length===0,'2: confirmação cancelada não manda POST: '+J([dialogs,SRV.posts.length]));
  // confirmar
  aceita=true;const a0=await pg.evaluate(()=>ETERNA.auditRead().length);
  await pg.click('[data-act="ps-modo"][data-v="sombra"]');
  ok(await espera(()=>document.querySelector('#ps-srv')&&document.querySelector('#ps-srv').dataset.modo==='sombra',5000),'2: modo sombra na tela');
  ok(SRV.posts.length===1&&J(SRV.posts[0].j)===J({modo:'sombra'})&&SRV.posts[0].h['x-eterna']==='1','2: um POST /poses/config {modo:sombra} com X-Eterna: '+J(SRV.posts.map(x=>[x.j,x.h['x-eterna']])));
  const au=await pg.evaluate(()=>ETERNA.auditRead()[0]);const a1=await pg.evaluate(()=>ETERNA.auditRead().length);
  ok(a1===a0+1&&au.acao==='poses_modo'&&au.alvo==='config/poses'&&J(au.mudancas)===J([{campo:'modo',de:'desligada',para:'sombra'}])&&au.por==='eduardo@eduardorezende.com','2: registro poses_modo: '+J(au));
  ok(/atualizada/.test(await pg.textContent('#toast')),'2: aviso de sucesso: '+await pg.textContent('#toast'));
  // clicar no modo atual não faz nada
  await pg.click('[data-act="ps-modo"][data-v="sombra"]');await pg.waitForTimeout(200);ok(SRV.posts.length===1&&dialogs.length===2,'2: clicar no modo atual não pergunta nem manda');
  // 3: ligada sem medida -> 409 criterio
  SRV.resp={status:409,body:{ok:false,error:'criterio',falta:150}};
  await pg.click('[data-act="ps-modo"][data-v="ligada"]');await pg.waitForTimeout(500);
  ok(/faltam 150/.test(await pg.textContent('#toast'))&&await pg.evaluate(()=>document.querySelector('#ps-srv').dataset.modo)==='sombra','3: 409 criterio avisa "faltam 150" e o modo fica: '+await pg.textContent('#toast'));
  ok(await pg.evaluate(()=>ETERNA.auditRead().length)===a1,'3: 409 não vai para o histórico');
  for(const [st,re] of [[403,/Só o Admin muda/],[429,/./],[500,/Não deu/]]){SRV.resp={status:st,body:{ok:false,error:'x'}};
    await pg.click('[data-act="ps-modo"][data-v="desligada"]');await pg.waitForTimeout(400);
    ok(re.test(await pg.textContent('#toast'))&&await pg.evaluate(()=>document.querySelector('#ps-srv').dataset.modo)==='sombra','3: '+st+' avisa e não muda: '+await pg.textContent('#toast'));}
  ok(await pg.evaluate(()=>ETERNA.auditRead().length)===a1,'3: erros não vão para o histórico');
  // 4: cliques repetidos com o servidor lento
  SRV.resp=null;SRV.atraso=1200;const n4=SRV.posts.length;
  await pg.click('[data-act="ps-modo"][data-v="desligada"]');await pg.waitForTimeout(100);
  const dis=await pg.evaluate(()=>[...document.querySelectorAll('[data-act="ps-modo"]')].every(x=>x.disabled));
  for(let i=0;i<4;i++){await pg.evaluate(()=>{const x=document.querySelector('[data-act="ps-modo"][data-v="desligada"]');x&&x.click();const y=document.querySelector('[data-act="ps-modo"][data-v="ligada"]');y&&y.click();});}
  // espera condicionada (com vários navegadores em paralelo, 1,8 s fixo não bastava): o modo chega e nada mais sai depois
  const m4=await espera(()=>{const c=document.querySelector('#ps-srv');return c&&c.dataset.modo==='desligada'&&!ETERNA.state.psSalvando;},10000);
  await pg.waitForTimeout(600);SRV.atraso=0;
  ok(dis&&SRV.posts.length===n4+1,'4: botões desabilitados enquanto salva e um pedido só: '+J([dis,SRV.posts.length-n4]));
  ok(m4,'4: modo desligada depois: '+await pg.evaluate(()=>{const c=document.querySelector('#ps-srv');return c?c.dataset.modo:null;}));
  // 5: forcada e motivos
  SRV.ps=Object.assign({},SRV.ps,{modo:'desligada',forcada:true});
  await pg.evaluate(()=>ETERNA.state.agent.poses=null);
  ok(await espera(()=>{const a=ETERNA.state.agent.poses;return a&&a.forcada;},8000),'5: /status com forcada');await pg.evaluate(()=>ETERNA.render());
  ok(/ETERNA_POSES=0/.test(await pg.textContent('#ps-srv')),'5: forcada aparece: '+await pg.textContent('#ps-srv'));
  const MOT=['fora_janela','recorte_ocupado','montagem_ocupada','vram','sem_modelo','conferindo','parado','servidor','fim_fila','desligada','filho','versao'];
  const crus=await pg.evaluate(M=>{const L=ETERNA.LANGS.map(x=>x[0]);const out=[];for(const l of L){ETERNA.state.langEq=l;if(ETERNA.state.user)ETERNA.state.user.idioma=l;
      for(const k of M){const a=ETERNA.state.agent;a.poses=Object.assign({},a.poses,{modo:'sombra',forcada:false,modelo:{ok:false,erro:k,nome:'x'},noite:{ini:'2026-11-23T23:00:00Z',fim:'2026-11-24T01:00:00Z',feitas:120,duvidas:7,erros:1,ms_med:1234,parou_por:k}});
        ETERNA.render();const c=document.querySelector('#ps-srv');const t=[c,c.nextElementSibling,document.querySelector('#ps-noite')].map(x=>x?x.innerText:'').join(' | ');
        const tx=ETERNA.TE('ps_parou_'+k);if(/ps_|pm_a_|undefined|NaN|\[object/.test(t)||tx==='ps_parou_'+k||!t.includes(tx))out.push(l+':'+k+':'+t.slice(0,240));}}
    ETERNA.state.langEq='pt';if(ETERNA.state.user)ETERNA.state.user.idioma='pt';ETERNA.render();return out;},MOT);
  ok(!crus.length,'5/7: motivo em palavras, sem chave crua, nas 5 línguas: '+J(crus.slice(0,4)));
  // esc: texto estranho do servidor não vira HTML
  const x5=await pg.evaluate(()=>{const a=ETERNA.state.agent;a.poses=Object.assign({},a.poses,{janela:{ini:'<img src=x onerror=window.__xss=1>',fim:'07:00'},noite:Object.assign({},a.poses.noite,{parou_por:'<b>oi</b>'})});ETERNA.render();
    return {img:!!document.querySelector('#main img[src="x"]'),b:[...document.querySelectorAll('#ps-noite b')].length};});
  ok(!x5.img&&x5.b===0,'5: janela e motivo do servidor passam pelo esc(): '+J(x5));
  SRV.ps=Object.assign({},PS,{forcada:false});await pg.evaluate(()=>ETERNA.state.agent.poses=null);await espera(()=>ETERNA.state.agent.poses,8000);
  // 7: 5 línguas, botões e o histórico
  // a equipe escolhe entre 4 línguas (IDIOMAS_EQ); o dicionário tem a 5ª coluna (de): confere que as chaves novas têm as 5
  const d7=await pg.evaluate(()=>Object.entries(ETERNA.EQ).filter(([k])=>/^ps_|^pm_a_poses/.test(k)).filter(([k,v])=>v.length!==5||v.some(x=>!x)).map(([k])=>k));
  ok(!d7.length,'7: chaves ps_ e pm_a_poses_modo com as 5 colunas: '+J(d7));
  const L7=await pg.evaluate(()=>{const out={};for(const l of ['pt','en','es','fr']){ETERNA.idiomaEquipe(l);ETERNA.go('chroma');const c=document.querySelector('#ps-srv');
      out[l]={card:c?c.parentElement.innerText.slice(0,160):null,bt:[...document.querySelectorAll('[data-act="ps-modo"]')].map(x=>x.textContent),acao:ETERNA.auditText(ETERNA.auditRead().find(e=>e.acao==='poses_modo')).acao};}
    ETERNA.idiomaEquipe('pt');return out;});
  const esperado={pt:/mudou a classificação de poses/,en:/changed pose labeling/,es:/cambió la clasificación/,fr:/a modifié le classement/};
  for(const [l,re] of Object.entries(esperado))ok(L7[l]&&L7[l].card&&!/ps_|undefined/.test(L7[l].card)&&L7[l].bt.length===3&&L7[l].bt.every(x=>x&&!/ps_/.test(x))&&re.test(L7[l].acao),'7: '+l+': '+J(L7[l]));
  ok(new Set(Object.values(L7).map(x=>x.card)).size===4,'7: o cartão muda com a língua');
  // histórico da tela de Permissões em pt mostra o registro
  const hist=await pg.evaluate(()=>{ETERNA.state.P0=ETERNA.state.P0||{};try{ETERNA.state.permTab='historico';}catch(e){}return ETERNA.auditText(ETERNA.auditRead().find(e=>e.acao==='poses_modo'));});
  ok(/mudou a classificação de poses/.test(hist.acao)&&/desligada/.test(hist.mudou)&&/sombra/.test(hist.mudou),'7: histórico pt: '+J(hist));
  // 8: telas estreitas
  for(const w of [390,768]){await pg.setViewportSize({width:w,height:900});await pg.evaluate(()=>{ETERNA.go('chroma');});await pg.waitForTimeout(250);
    await pg.evaluate(()=>{const a=ETERNA.state.agent;a.poses=Object.assign({},a.poses,{modo:'sombra',modelo:{ok:true,erro:null,nome:'qwen3vl-8b-q4',pronto:true,carga_ms:41000},pendentes:312,rodando:true,
      noite:{ini:'2026-11-23T23:00:00Z',fim:null,feitas:1840,duvidas:96,erros:3,ms_med:1260,parou_por:null}});ETERNA.render();document.querySelector('#ps-srv').scrollIntoView({block:'center'});});
    const r8=await pg.evaluate(()=>({rola:document.documentElement.scrollWidth>window.innerWidth+1,bt:[...document.querySelectorAll('[data-act="ps-modo"]')].map(x=>{const r=x.getBoundingClientRect();return r.right<=window.innerWidth+1&&r.width>20;})}));
    ok(!r8.rola&&r8.bt.length===3&&r8.bt.every(Boolean),'8: '+w+' px sem rolagem lateral e os 3 botões visíveis: '+J(r8));
    await pg.screenshot({path:path.join(P,'poses-painel-'+w+'.png')});}
  await pg.setViewportSize({width:1366,height:900});await pg.evaluate(()=>{ETERNA.go('chroma');document.querySelector('#ps-srv').scrollIntoView({block:'center'});});await pg.waitForTimeout(200);
  await pg.screenshot({path:path.join(P,'poses-painel-1366.png')});
  // 6: só ver (configuracao.r sem u), sem configuracao.r, agente antigo e agente fora
  const r6=await pg.evaluate(()=>{const u=ETERNA.state.user;const p0=JSON.parse(JSON.stringify(u.perms));const out={};
    u.perms.configuracao={r:true,u:false};ETERNA.render();out.soVer={card:!!document.querySelector('#ps-srv'),bt:document.querySelectorAll('[data-act="ps-modo"]').length};
    ETERNA.psModoSalva('ligada');out.salvou=ETERNA.state.psSalvando;
    // 24/11 (Eduardo): só o Admin muda; a Supervisora com Painel de controle em Alterar vê o estado sem os botões
    const pr0=u.preset;u.perms=JSON.parse(JSON.stringify(p0));u.perms.configuracao={r:true,u:true};u.preset='supervisor';ETERNA.render();
    out.sup={card:!!document.querySelector('#ps-srv'),bt:document.querySelectorAll('[data-act="ps-modo"]').length,u:ETERNA.can('configuracao','u')};
    ETERNA.psModoSalva('ligada');out.supSalvou=ETERNA.state.psSalvando;u.preset=pr0;u.perms=JSON.parse(JSON.stringify(p0));
    u.perms.configuracao={r:false,u:false};ETERNA.render();out.semR=!!document.querySelector('#ps-srv');
    u.perms=p0;ETERNA.go('chroma');out.de_novo=!!document.querySelector('#ps-srv');const a=ETERNA.state.agent;const ps=a.poses;a.poses=null;ETERNA.render();out.antigo=!!document.querySelector('#ps-srv');a.poses=ps;
    ETERNA.render();out.volta1=!!document.querySelector('#ps-srv');a.on=false;ETERNA.render();out.fora=!!document.querySelector('#ps-srv');a.on=true;ETERNA.render();out.volta=!!document.querySelector('#ps-srv');out.view=ETERNA.state.view;return out;});
  ok(r6.soVer.card&&r6.soVer.bt===0&&!r6.salvou,'6: só ver: texto sem botões e psModoSalva não salva: '+J(r6));
  ok(r6.sup.card&&r6.sup.u&&r6.sup.bt===0&&!r6.supSalvou,'6 (24/11): Supervisora com Alterar vê o estado sem os botões e não salva: '+J(r6.sup));
  ok(!r6.semR&&r6.de_novo&&!r6.antigo&&r6.volta1&&!r6.fora&&r6.volta,'6: sem configuracao.r, agente antigo ou fora: sem cartão: '+J(r6));
  // 9: Fotógrafos na Curadoria
  const m9=await pg.evaluate(()=>{const V=ETERNA.VIEWS||[];const f=V.find(v=>v[0]==='fotografos');const nav=[...document.querySelectorAll('#nav [data-v="fotografos"], #nav [data-view="fotografos"]')].length;
    return {grupo:f&&f[3],can:ETERNA.canView('fotografos'),menu:ETERNA.userMenu(ETERNA.state.user).includes('fotografos'),nav};});
  ok(m9.grupo==='Curadoria'&&m9.can&&m9.menu,'9: Fotógrafos na Curadoria e aberta ao Admin: '+J(m9));
  const m9b=await pg.evaluate(()=>{const u=ETERNA.state.user;const p0=JSON.parse(JSON.stringify(u.perms));u.perms.desempenho={r:false};const sem=ETERNA.canView('fotografos');u.perms=p0;return sem;});
  ok(!m9b,'9: sem desempenho.r não abre Fotógrafos');
}catch(e){fails.push('exceção: '+(e.stack||e.message).slice(0,600));}
await b.close();
const e2=errs.filter(x=>!/ResizeObserver/.test(x));
if(e2.length)fails.push('erros na página: '+J(e2.slice(0,3)));
console.log((fails.length?'FALHA':'OK')+' poses-painel: cartão da classificação de poses (P1)'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
