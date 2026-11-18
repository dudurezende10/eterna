// Escala desligada (Eduardo, 16/11/2026; plano docs/planos/2026-11-16-escala-desligada.md). O app como vai ao ar (ESCALA_ON=false):
// a Escala some do menu, de Permissões e do endereço #escala; quem começava nela entra na tela do perfil; o Calendário de eventos
// continua para Admin e Supervisora; o módulo de permissão mantém o id e se chama "Calendário de eventos"; Minhas fotos e a Fila
// do fotógrafo abrem sem ponto e sem texto de escala; o painel dos fundos de IA perde as caixas de ponto; nada manda função ao agente.
// No fim, a mesma janela recebe a página com a chave ligada (testes/_escala.js): tudo volta, com o menu gravado no lugar.
// Sem dado real: usuários de exemplo do index.html e agente simulado por rota.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');const escalaLigada=require('./_escala');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const ESC=/escala|schedule|planning|dienstplan|turnos|função do dia|role of the day|función del día|rôle du jour|tagesaufgabe/i;
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1366,height:h||900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});return {ctx,pg};}
async function entrar(pg,email){await pg.goto(U,{waitUntil:'domcontentloaded',timeout:60000});await pg.waitForSelector('#main');await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(300);}
  return entrarTeste(pg,email);}
const nav=pg=>pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));
const lingua=(pg,lg,v)=>pg.evaluate(([lg,v])=>{ETERNA.state.user.idioma=lg;if(v)ETERNA.state.view=v;ETERNA.render();},[lg,v||'']);
(async()=>{const b=await chromium.launch();
try{
  const fonte=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  ok(fonte.split(escalaLigada.CHAVE).length===2,'a chave "const ESCALA_ON=false;" tem que existir uma vez no index.html');
  ok(/'funcao'/.test((fonte.match(/SIM_INTEIRO=\[[^\]]*\]/)||[''])[0]),'SIM.funcao tem que continuar em SIM_INTEIRO (tirar faria cada aparelho mandar apagar no servidor)');
  ok(/function vEscala\(/.test(fonte)&&/function relEscala\(/.test(fonte)&&/function funcSelect\(/.test(fonte),'nada é apagado: vEscala, relEscala e funcSelect ficam no arquivo');

  // ---------- 1 e 4: Admin sem a Escala no menu, em Permissões e no endereço; módulo "Calendário de eventos" ----------
  {const {ctx,pg}=await nova(b);const posts=[];await ctx.route('**/fila-fotografo/funcao',r=>{posts.push(1);r.fulfill({status:409,contentType:'application/json',body:'{"error":"escala_desligada"}'});});
    ok(await entrar(pg,'eduardo@eduardorezende.com'),'1: Admin entrou');
    const r=await pg.evaluate(()=>{const E=ETERNA;return {on:E.escalaOn(),views:E.VIEWS.map(v=>v[0]),mod:E.MODULES.find(m=>m[0]==='escala'),all:E.ALL_VIEWS.includes('escala'),menu:E.userMenu(E.state.user).includes('escala'),cv:E.canView('escala'),rel:!!E.REL.escala,
      foto:E.PRESETS.foto.menu,fotoPerm:E.PRESETS.foto.perms.escala,sup:E.PRESETS.supervisor.menu.includes('escala'),supCal:E.PRESETS.supervisor.menu.includes('calendario'),supPerm:E.PRESETS.supervisor.perms.escala};});
    ok(r.on===false&&!r.views.includes('escala')&&r.views.includes('calendario')&&!r.all&&!r.menu&&!r.cv&&!r.rel,'1: a Escala não pode existir nas listas de telas: '+J(r));
    ok(r.mod&&r.mod[0]==='escala'&&r.mod[1]==='Calendário de eventos'&&J(r.mod[2])===J(['calendario']),'4: o módulo mantém o id escala e só tem o Calendário: '+J(r.mod));
    ok(J(r.foto)===J(['diario','importar','fotofila'])&&r.fotoPerm.r&&!r.sup&&r.supCal&&r.supPerm.u,'perfis prontos: Fotógrafo sem a Escala no menu; Supervisora com o Calendário e escala RW: '+J([r.foto,r.sup,r.supCal]));
    const v=await nav(pg);ok(!v.includes('escala')&&v.includes('calendario')&&v.includes('fotofila'),'1: menu do Admin: '+J(v));
    // endereço #escala e go('escala')
    await pg.evaluate(()=>ETERNA.go('painel'));await pg.evaluate(()=>{location.hash='#escala';});await pg.waitForTimeout(250);
    let s=await pg.evaluate(()=>({v:ETERNA.state.view,falhou:/Algo falhou/.test(document.querySelector('#main').textContent),h1:(document.querySelector('#main h1')||{}).textContent}));
    ok(s.v!=='escala'&&!s.falhou&&!/Escala/.test(s.h1||''),'1: #escala não pode abrir a Escala: '+J(s));
    await pg.evaluate(()=>ETERNA.go('escala'));await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.view)!=='escala','1: go(escala) recusado');
    await pg.evaluate(()=>{ETERNA.state.view='escala';ETERNA.render();});await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.view)!=='escala','1: view forçada volta para a tela inicial');
    // página aberta direto em #escala (endereço antigo guardado)
    await pg.goto(U.replace(/#.*$/,'')+'#escala');await pg.waitForTimeout(500);s=await pg.evaluate(()=>({v:ETERNA.state.view,u:!!ETERNA.state.user}));ok(s.u&&s.v!=='escala','1: abrir a página em #escala: '+J(s));
    // Permissões nas 4 línguas da equipe: "Calendário de eventos", sem a palavra escala
    const NOME={pt:'Calendário de eventos',en:'Events calendar',es:'Calendario de eventos',fr:'Calendrier des événements',de:'Veranstaltungskalender'};
    for(const lg of await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]))){await lingua(pg,lg,'permissoes');
      // aba Perfis (nome do módulo, descrição e telas de cada perfil) e, na aba Por usuário, a matriz de uma pessoa (Supervisão)
      await pg.evaluate(()=>{ETERNA.state.perm.tab='perfis';ETERNA.render();});await pg.waitForTimeout(80);let t=await pg.evaluate(()=>document.querySelector('#main').innerText);
      await pg.evaluate(()=>{ETERNA.state.perm.tab='usuario';ETERNA.state.perm.q='supervisor@';ETERNA.render();});await pg.waitForTimeout(80);const sel=await pg.$('#main [data-act="perm-sel"]');ok(!!sel,'4: Permissões em '+lg+' sem a pessoa para abrir');if(sel)await sel.click();await pg.waitForTimeout(150);
      ok(!!(await pg.$('[data-act="perm-view"][data-v="calendario"]')),'4: matriz em '+lg+' sem a caixa do Calendário');t+='\n'+await pg.evaluate(()=>document.querySelector('#main').innerText);const m=t.match(ESC);
      ok(t.includes(NOME[lg]),'4: Permissões em '+lg+' sem "'+NOME[lg]+'"');ok(!m,'4: Permissões em '+lg+' ainda fala de escala: '+(m&&t.slice(Math.max(0,m.index-50),m.index+50)));
      ok(!(await pg.$('[data-act="perm-view"][data-v="escala"]')),'1: Permissões em '+lg+' com a caixa da tela Escala');}
    const dic=await pg.evaluate(()=>['mod_escala_cal','modi_escala_cal_desc','modi_escala_cal_r','modi_escala_cal_u','cf_ia_sem_escala','up_iam_sem_ponto'].map(k=>[k,ETERNA.EQ[k]]));
    ok(dic.every(([k,v])=>Array.isArray(v)&&v.length===5&&v.every(x=>typeof x==='string'&&x.length>3)),'textos novos nas 5 línguas: '+J(dic.filter(([k,v])=>!Array.isArray(v)||v.length!==5).map(x=>x[0])));
    ok(dic.slice(0,4).every(([k,v])=>!v.some(x=>ESC.test(x)))&&dic[0][1][4]===NOME.de,'4: nome e textos do módulo e do perfil Fotógrafo sem escala nem função do dia, nas 5 línguas: '+J(dic.slice(0,4).filter(([k,v])=>v.some(x=>ESC.test(x))).map(x=>x[0])));
    await lingua(pg,'pt','painel');
    ok(await pg.evaluate(()=>ETERNA.modNome('escala')==='Calendário de eventos'),'nome do módulo sem a Escala');

    // ---------- 3: Calendário de eventos continua para o Admin ----------
    await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(200);
    s=await pg.evaluate(()=>({v:ETERNA.state.view,h1:document.querySelector('#main h1').textContent,pode:ETERNA.can('escala','u'),novo:!!document.querySelector('#main [data-act="ag-novo"],#main [data-act="ag-colar"],#main [data-act="ag-importar"],#main [data-act="ag-atualizar"]'),acts:['ag-salvar','ag-apagar','ag-importar','ag-atualizar','ag-colar'].map(a=>ETERNA.ACT_MOD[a])}));
    ok(s.v==='calendario'&&/Calend/.test(s.h1)&&s.pode&&s.novo&&s.acts.every(m=>m==='escala'),'3: Calendário do Admin com as ações de gravar (módulo escala): '+J(s));

    // ---------- painel "Fotos para os fundos de IA": só o liga/desliga e a nota ----------
    for(const lg of await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]))){await lingua(pg,lg);const p=await pg.evaluate(()=>{const d=document.createElement('div');d.innerHTML=ETERNA.iaCfgPanel();return {lig:d.querySelectorAll('[data-act="ia-ligada"]').length,pts:d.querySelectorAll('[data-act="ia-ponto"],[data-act="ia-volante"],[data-act="ia-cliques"]').length,nota:(d.querySelector('#ia-sem-escala')||{}).textContent||'',esp:ETERNA.TE('cf_ia_sem_escala')};});
      ok(p.lig===1&&p.pts===0&&p.nota===p.esp&&p.nota.length>40,'fundos de IA em '+lg+': liga/desliga e nota, sem pontos nem volante: '+J([p.lig,p.pts,p.nota.slice(0,40)]));}
    await lingua(pg,'pt');
    // etiqueta do Upload para a sessão sem base
    ok(/rg\.motivo==='sem_funcao'&&!ESCALA_ON\?TE\('up_iam_sem_ponto'\)/.test(fonte)&&await pg.evaluate(()=>ETERNA.TE('up_iam_sem_ponto'))==='Fotos de IA: aguardando reconhecimento do ponto','etiqueta do Upload para sem_funcao com a Escala desligada');

    // ---------- func-set e função do dia não gravam nem chamam o agente ----------
    const f=await pg.evaluate(()=>{const S=ETERNA.SIM;const antes=J2(S.funcao);function J2(x){return JSON.stringify(x===undefined?null:x);}
      const s=document.createElement('select');s.dataset.act='func-set';s.dataset.k='carlos';s.innerHTML='<option value="c:campo2">x</option>';s.value='c:campo2';document.body.appendChild(s);s.dispatchEvent(new Event('change',{bubbles:true}));s.remove();
      return {antes,depois:J2(S.funcao)};});await pg.waitForTimeout(300);
    ok(f.antes===f.depois&&posts.length===0,'func-set com a Escala desligada não grava nem chama o agente: '+J([f,posts.length]));

    // ---------- Alertas e Vestiário sem os textos de escala ----------
    await pg.evaluate(()=>{ETERNA.state.view='alertas';ETERNA.render();});await pg.waitForTimeout(150);let t=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(!/Escala: \d+ turnos/.test(t)&&t.length>40,'Alertas sem o alerta de exemplo da escala');
    await pg.evaluate(()=>{ETERNA.state.view='vestiario';ETERNA.render();});await pg.waitForTimeout(150);t=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(!/5x2|turnos/i.test(t)&&t.length>40,'Vestiário sem o painel da escala');

    // ---------- 7: Fila do fotógrafo só com o nome (e a origem de quem não tem fotógrafo), nas 4 línguas ----------
    const a=Date.now()/1000;const feed={ok:true,agora:a,rev:5,pausa:20,pronta_min:15,grupos:[
      {id:'G1',estado:'fotografando',fotografo:'carlos',fonte:'ftp',funcao:{tipo:'campo',point:'terminal'},inicio:a-40,ultima_chegada:a-2,ultimo_clique:a-3,pronta_em:null,n:7,pids:[],ia:{n:0,motivo:'sem_funcao',pids:[],prontas:0}},
      {id:'G2',estado:'fotografando',fotografo:null,fonte:'câmera ···1234',funcao:null,inicio:a-12,ultima_chegada:a-1,ultimo_clique:a-2,pronta_em:null,n:3,pids:[],ia:{n:0,motivo:'sem_funcao',pids:[],prontas:0}},
      {id:'G3',estado:'subindo',fotografo:'sandessa',fonte:'cartão',funcao:{tipo:'folga'},inicio:a-150,ultima_chegada:a-4,ultimo_clique:a-90,pronta_em:null,n:24,pids:[],ia:{n:0,motivo:'sem_funcao',pids:[],prontas:0}},
      {id:'G4',estado:'pronta',fotografo:'yago',fonte:'ftp',funcao:{tipo:'volante',modo:'chute'},inicio:a-700,ultima_chegada:a-500,ultimo_clique:a-510,pronta_em:a-480,n:9,pids:[],ia:{n:0,motivo:'sem_funcao',pids:[],prontas:0}}]};
    await ctx.route('**/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:J(feed)}));
    await pg.evaluate(()=>ETERNA.go('fotofila'));await pg.waitForSelector('.ff-card',{timeout:6000}).catch(()=>{});
    for(const lg of await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]))){await lingua(pg,lg);await pg.waitForTimeout(80);
      const c=await pg.evaluate(()=>({nomes:[...document.querySelectorAll('.ff-card .ff-nome')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),onde:document.querySelectorAll('.ff-card .ff-onde').length,folga:document.querySelectorAll('.ff-card.folga,.ff-alerta').length,txt:document.querySelector('#main').innerText}));
      ok(c.nomes.length===4&&c.nomes.includes('Carlos')&&c.nomes.includes('Sandessa')&&c.nomes.includes('Yago')&&c.nomes.some(n=>/câmera ···1234$/.test(n)),'7: Fila em '+lg+' só com o nome e a origem: '+J(c.nomes));
      ok(c.onde===0&&c.folga===0&&!/\(.*·.*\)|sem ponto|no spot|sin punto|sans point/i.test(c.nomes.join(' '))&&!ESC.test(c.txt),'7: Fila em '+lg+' sem ponto, sem folga e sem texto de escala: '+J([c.onde,c.folga,(c.txt.match(ESC)||[])[0]]));}
    await lingua(pg,'pt');ok(posts.length===0,'nenhum POST da função do dia saiu do app: '+posts.length);
    await ctx.close();}

  // ---------- 2, 7 e 9: fotógrafo que começava na Escala; Minhas fotos sem ponto; religar devolve ----------
  {const {ctx,pg}=await nova(b);await pg.goto(U);await pg.waitForTimeout(300);
    // cadastro como estava antes do deploy: Escala no menu e como tela inicial (grava direto na cópia do aparelho)
    await pg.evaluate(()=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));const u=U0['carlos@eterna.photo'];u.menu=['diario','importar','fotofila','escala'];u.inicio='escala';localStorage.setItem('eterna.users.v1',JSON.stringify(U0));localStorage.setItem('eterna.view','escala');});
    ok(await entrar(pg,'carlos@eterna.photo'),'2: Carlos entrou');await pg.waitForTimeout(200);
    let r=await pg.evaluate(()=>{const u=ETERNA.USERS['carlos@eterna.photo'];return {v:ETERNA.state.view,falhou:/Algo falhou/.test(document.querySelector('#main').textContent),menu:u.menu,ini:u.inicio,guardado:JSON.parse(localStorage.getItem('eterna.users.v1'))['carlos@eterna.photo'].menu,vis:ETERNA.userMenu(u)};});
    ok(r.v==='importar'&&!r.falhou,'2: quem começava na Escala entra na tela inicial do perfil (Minhas fotos): '+J([r.v,r.falhou]));
    ok(r.menu.includes('escala')&&r.guardado.includes('escala')&&r.ini==='escala'&&!r.vis.includes('escala'),'1: o menu gravado guarda a Escala (não é regravado) e a tela não aparece: '+J(r));
    const v=await nav(pg);ok(J(v)===J(['diario','importar','fotofila']),'1 e 3: menu do Fotógrafo sem Escala e sem Calendário: '+J(v));
    ok(await pg.evaluate(()=>!ETERNA.canView('calendario')&&!ETERNA.canView('escala')),'3: Fotógrafo não vê o Calendário');
    for(const lg of await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]))){await lingua(pg,lg,'importar');await pg.waitForTimeout(100);
      const m=await pg.evaluate(()=>({fixo:[...document.querySelectorAll('#main .imp-fixo')].map(x=>x.innerText.replace(/\s+/g,' ').trim()),point:ETERNA.state.imp.point,key:ETERNA.state.imp.key,txt:document.querySelector('#main').innerText,sem:ETERNA.TE('mf_sem_ponto'),pt:ETERNA.TE('mf_ponto')}));
      ok(m.fixo.length===1&&/Carlos$/.test(m.fixo[0])&&m.point==='todos'&&m.key==='carlos','7: Minhas fotos em '+lg+' com o nome e sem ponto: '+J([m.fixo,m.point,m.key]));
      ok(!m.txt.includes(m.sem)&&!ESC.test(m.txt),'7: Minhas fotos em '+lg+' sem texto de escala: '+J((m.txt.match(ESC)||[])[0]));}
    await lingua(pg,'pt','importar');
    // 9: a mesma janela com a chave ligada (o mesmo que religar no código): a Escala volta, com o menu e a tela inicial gravados
    await escalaLigada(ctx);await pg.goto(U);await pg.waitForTimeout(500);
    r=await pg.evaluate(()=>({on:ETERNA.escalaOn(),u:!!ETERNA.state.user,v:ETERNA.state.view,menu:[...document.querySelectorAll('#nav button[data-v]')].map(x=>x.dataset.v),mod:ETERNA.MODULES.find(m=>m[0]==='escala'),nome:ETERNA.modNome('escala'),rel:!!ETERNA.REL.escala,foto:ETERNA.PRESETS.foto.menu}));
    ok(r.on===true&&r.u&&J(r.menu)===J(['diario','importar','fotofila','escala'])&&await pg.evaluate(()=>ETERNA.homeView())==='escala','9: religada, o Carlos tem a Escala no menu e como tela inicial, como antes: '+J(r));
    await pg.click('#nav button[data-v="escala"]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>ETERNA.state.view==='escala'&&!!document.querySelector('#esc-hoje')),'9: religada, a Escala do fotógrafo abre');
    ok(r.mod[1]==='Escala e calendário'&&J(r.mod[2])===J(['escala','calendario'])&&r.nome==='Escala e calendário'&&r.rel&&r.foto.includes('escala'),'9: religada, módulo, perfil e exportação de volta: '+J(r));
    await pg.evaluate(()=>{ETERNA.state.view='importar';ETERNA.render();});await pg.waitForTimeout(150);
    ok(/^Ponto .+/.test((await pg.$$eval('#main .imp-fixo',xs=>xs.map(x=>x.innerText.replace(/\s+/g,' ').trim())))[1]||''),'9: religada, Minhas fotos volta a mostrar o ponto');
    await ctx.close();}

  // ---------- 3: Supervisora continua com o Calendário e pode gravar; sem a Escala ----------
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'supervisor@eterna.photo'),'3: Supervisora entrou');const v=await nav(pg);
    ok(v.includes('calendario')&&!v.includes('escala'),'3: menu da Supervisora: '+J(v));await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(200);
    const s=await pg.evaluate(()=>({v:ETERNA.state.view,pode:ETERNA.can('escala','u'),bt:document.querySelectorAll('#main [data-act^="ag-"]').length}));ok(s.v==='calendario'&&s.pode&&s.bt>0,'3: Supervisora abre o Calendário e pode alterar: '+J(s));
    await ctx.close();}
}catch(e){fails.push('exceção: '+String(e&&e.stack||e).slice(0,700));}
await b.close();const okAll=!fails.length&&!errs.length;
console.log(`${okAll?'OK':'FALHA'} escala-desligada: sem Escala no menu, em Permissões e no endereço; Calendário de eventos continua; Minhas fotos e Fila sem ponto; religar devolve${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okAll?0:1);})();
