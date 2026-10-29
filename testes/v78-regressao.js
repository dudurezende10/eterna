// v78 (testador): o que o permissoes.js não cobre. Menus de cada perfil (grupos, itens, ordem, abrir e fechar, grupo vazio some),
// links antigos (#set, #fluxo, #convidado) com e sem login, Upload automático (check-in pelo admin, supervisor só leitura, Sair),
// Permissões ("não se aplica" legível, tela inicial e menu pela tela), cadastro (cancelar exclusão), e-mail fora do cadastro,
// textos da equipe sem "loja" e sem telas que saíram, "Fila do balcão". Prints em testes/prints/v78-*.png.
const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1280,height:h||1000}});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});return {ctx,pg};}
async function sair(pg){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.reload();await pg.waitForTimeout(350);}
async function codigo(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user))await sair(pg);return codigo(pg,email);}
const grupos=pg=>pg.$$eval('#nav .navg',gs=>gs.map(g=>[g.querySelector('.grp').textContent.trim(),[...g.querySelectorAll('button[data-v]')].map(x=>x.dataset.v)]));
const abrirTodos=pg=>pg.evaluate(()=>document.querySelectorAll('#nav .navitems').forEach(x=>x.hidden=false));
const view=pg=>pg.evaluate(()=>ETERNA.state.view);
const J=JSON.stringify;
const PERFIS={
  'eduardo@eduardorezende.com':{n:'admin',g:[['Dashboard',['painel','bandeiras','estoque','fotografos','vendas','vendas-lista','galerias']],['Curadoria',['revisao','treino','alertas']],['Fotógrafo',['diario','importar','escala']],['Configurações',['repo','identidade','catalogo','chroma','ajustes','usuarios','permissoes']],['Laboratório',['vestiario','fundos-teste']]],ini:'painel',ck:true},
  'carlos@eterna.photo':{n:'fotografo',g:[['Fotógrafo',['diario','importar','escala']]],ini:'importar',ck:false},
  'loja@eterna.photo':{n:'atendimento',g:[['Configurações',['catalogo']]],ini:'posto',ck:true}, // v83: Atendimento e venda começa no Posto de venda
  'supervisor@eterna.photo':{n:'supervisor',g:[['Dashboard',['painel','bandeiras','estoque','fotografos','vendas','vendas-lista','galerias']],['Curadoria',['revisao','treino','alertas']],['Fotógrafo',['diario','importar','escala']],['Configurações',['repo','identidade','catalogo','chroma','ajustes']],['Laboratório',['vestiario','fundos-teste']]],ini:'painel',ck:true},
  'qualidade@eterna.photo':{n:'validador',g:[['Curadoria',['revisao','treino']],['Fotógrafo',['diario']]],ini:'revisao',ck:false},
};
(async()=>{const b=await chromium.launch();
try{
  // ---------- A. menu de cada perfil: grupos, itens, ordem, tela inicial, Abrir Checkout, telas abrem sem erro, prints ----------
  for(const [email,X] of Object.entries(PERFIS)){const {ctx,pg}=await nova(b,1440,1000);const entrou=await entrar(pg,email);ok(entrou,`A ${X.n}: não entrou`);if(!entrou){await ctx.close();continue;}
    ok(await view(pg)===X.ini,`A ${X.n}: tela depois do login ${await view(pg)} (esperado ${X.ini})`);
    // reabrir o app (sessão de 12 h ainda valendo, sem #hash): continua na tela inicial do perfil (D10: o fotógrafo não sai da atividade)
    await pg.goto('about:blank');await pg.goto(U);await pg.waitForTimeout(400);ok(await view(pg)===X.ini,`A ${X.n}: reabrir o app logado (sem #) caiu em ${await view(pg)} (esperado ${X.ini})`);
    if(await view(pg)!=='perfis'){await pg.click('#rail-brand');await pg.waitForTimeout(120);}
    const gs=await grupos(pg);ok(J(gs)===J(X.g),`A ${X.n}: menus ${J(gs)}`);
    ok(!!(await pg.$('#rail-ck [data-act="loja-abrir"]'))===X.ck,`A ${X.n}: botão Abrir Checkout ${X.ck?'faltando':'não deveria aparecer'}`);
    ok(!(await pg.$('#nav [data-v="quiosque"]')),`A ${X.n}: Checkout como item de menu`);
    // Início pelo logo
    await pg.click('#rail-brand');await pg.waitForTimeout(120);ok(await view(pg)==='perfis',`A ${X.n}: logo não abriu o Início (${await view(pg)})`);
    const ini=await pg.textContent('#main');if(X.n!=='admin'&&X.n!=='supervisor')ok(!/R\$/.test(ini),`A ${X.n}: Início com R$`);
    await abrirTodos(pg);await pg.screenshot({path:`${P}/v78-menu-${X.n}.png`});
    // cada tela permitida abre sem "Algo falhou"; as do grupo vazio não abrem nem pelo endereço
    const meus=gs.flatMap(g=>g[1]);const quebradas=[];
    for(const v of meus){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(60);if(/Algo falhou/.test(await pg.textContent('#main'))||await view(pg)!==v)quebradas.push(v);}
    ok(!quebradas.length,`A ${X.n}: telas que não abriram: ${quebradas.join(',')}`);
    const fora=PERFIS['eduardo@eduardorezende.com'].g.flatMap(g=>g[1]).filter(v=>!meus.includes(v));const vazou=[];
    for(const v of fora){await pg.evaluate(v=>{location.hash='#'+v;},v);await pg.waitForTimeout(80);if(await view(pg)===v)vazou.push(v);}
    ok(!vazou.length,`A ${X.n}: telas fora do menu abriram pelo endereço: ${vazou.join(',')}`);
    await ctx.close();}
  // quiosque@: cai direto no Checkout em tela cheia
  {const {ctx,pg}=await nova(b);await entrar(pg,'quiosque@eterna.photo');await pg.waitForTimeout(300);
    const q=await pg.evaluate(()=>({lj:!!ETERNA.state.lojaRota,h:location.hash,nav:document.querySelector('#nav').offsetParent!==null}));ok(q.lj&&q.h==='#loja'&&!q.nav,'A quiosque: deveria abrir #loja em tela cheia '+J(q));
    await ctx.close();}
  // ---------- B. abrir e fechar: aria-expanded, o grupo da tela atual abre, os outros fecham ao trocar ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.go('perfis'));await pg.waitForTimeout(100); // v80: o admin começa no Painel
    const est=()=>pg.$$eval('#nav .navg',gs=>gs.map(g=>[g.querySelector('.grp').getAttribute('aria-expanded'),g.querySelector('.navitems').hidden]));
    let s=await est();ok(s.every(([a,h])=>a==='false'&&h),'B: no Início todos fechados '+J(s));
    await pg.click('#nav .grp[data-g="Configurações"]');await pg.waitForTimeout(60);s=await est();ok(s[3][0]==='true'&&!s[3][1],'B: Configurações abre com aria-expanded=true '+J(s[3]));
    await pg.click('#nav .grp[data-g="Laboratório"]');await pg.waitForTimeout(60);s=await est();ok(s[3][0]==='true'&&s[4][0]==='true','B: dois grupos abertos ao mesmo tempo '+J(s));
    await pg.click('#nav [data-v="permissoes"]');await pg.waitForTimeout(100);s=await est();ok(s[3][0]==='true'&&s.filter(x=>x[0]==='true').length===1,'B: ao abrir Permissões só Configurações fica aberto '+J(s));
    ok(await pg.$eval('#nav [data-v="permissoes"]',e=>e.getAttribute('aria-current'))==='page','B: item atual sem aria-current=page');
    await pg.click('#nav .grp[data-g="Configurações"]');await pg.waitForTimeout(60);s=await est();ok(s[3][0]==='false'&&s[3][1],'B: dá para fechar o grupo da tela atual '+J(s[3]));
    // cliques repetidos
    for(let i=0;i<5;i++)await pg.click('#nav .grp[data-g="Dashboard"]');s=await est();ok(s[0][0]==='true','B: 5 cliques no Dashboard deveriam deixar aberto '+J(s[0]));
    await ctx.close();}
  // ---------- C. links antigos ----------
  {const {ctx,pg}=await nova(b);
    const casos=[['eduardo@eduardorezende.com','set','importar'],['eduardo@eduardorezende.com','fluxo','painel'],['eduardo@eduardorezende.com','convidado','painel'],['carlos@eterna.photo','convidado','importar'],['carlos@eterna.photo','fluxo','importar'],['loja@eterna.photo','set','posto']];
    for(const [email,h,esp] of casos){await pg.goto(U);await pg.waitForTimeout(200);await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto('about:blank');await pg.goto(U+'#'+h);await pg.waitForTimeout(300);
      await codigo(pg,email);const r=await pg.evaluate(()=>({v:ETERNA.state.view,h:location.hash,f:/Algo falhou/.test(document.querySelector('#main').textContent)}));
      ok(r.v===esp&&!r.f&&r.h==='#'+esp,`C: sem login, #${h} e entrar como ${email} deveria cair em ${esp}: ${J(r)}`);}
    // já logado, abrir a página com o link antigo
    await entrar(pg,'eduardo@eduardorezende.com');
    for(const [h,esp] of [['fluxo','painel'],['convidado','painel'],['set','importar'],['set/x','importar'],['venda','checkout']]){await pg.goto('about:blank');await pg.goto(U+'#'+h);await pg.waitForTimeout(300);const r=await pg.evaluate(()=>({v:ETERNA.state.view,h:location.hash,u:!!ETERNA.state.user}));ok(r.v===esp&&r.u,`C: logado, abrir #${h} deveria cair em ${esp}: ${J(r)}`);}
    await ctx.close();}
  // ---------- D. Upload automático: check-in pelo admin (select), supervisor só leitura, Sair ----------
  {const {ctx,pg}=await nova(b,1440,1000);await entrar(pg,'eduardo@eduardorezende.com');const serie='R6ADMIN0007';
    const poe=s=>pg.evaluate(s=>{const d=new Date();const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');ETERNA.state.lib.push({id:'t'+s,day,serie:s,t:Date.now()/1000,autor:'',modelo:'EOS R6'});ETERNA.state.view='importar';ETERNA.render();},s);
    // v80: o cartão de check-in da câmera saiu do Upload; o fotógrafo vem do usuário/subpasta do FTP e do nome gravado na câmera
    await poe(serie);let mu=await pg.textContent('#main');ok(!(await pg.$('select[data-act="cam-who"]'))&&!(await pg.$('[data-act="cam-mine"]'))&&!/Check-in ·|Câmeras de hoje/.test(mu),'D: admin ainda vê o check-in da câmera no Upload');
    ok(!/Servidor FTP do estádio/.test(mu),'D: o FTP do estádio saiu do Upload (vai para o Painel de controle)');
    ok(!(await pg.$('[data-act="set-switch"]'))&&!(await pg.$('[data-act="set-logout"]')),'D: admin (sem fotógrafo vinculado) não deveria ver Trocar fotógrafo nem Sair do fotógrafo');
    await pg.screenshot({path:`${P}/v78-upload-checkin-admin.png`,fullPage:true});
    await entrar(pg,'supervisor@eterna.photo');await poe('R6SUP0001');ok(!(await pg.$('select[data-act="cam-who"]')),'D: supervisor ainda vê o select de câmera');
    // Carlos: Sair volta ao login
    await entrar(pg,'carlos@eterna.photo');ok(await view(pg)==='importar','D: Carlos não entrou no Upload');await pg.screenshot({path:`${P}/v78-upload-checkin-fotografo.png`,fullPage:true});
    await pg.click('[data-act="set-logout"]');await pg.waitForTimeout(150);const r=await pg.evaluate(()=>({u:!!ETERNA.state.user,login:!!document.querySelector('[data-act="login-email"]'),s:localStorage.getItem('eterna.session')}));ok(!r.u&&r.login&&!r.s,'D: Sair do Upload deveria voltar ao login '+J(r));
    // Trocar fotógrafo: Marinara entra e cai no Upload automático
    await codigo(pg,'carlos@eterna.photo');await pg.click('[data-act="set-switch"]');await pg.waitForTimeout(150);await codigo(pg,'marinara@eterna.photo');
    ok(await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email)==='marinara@eterna.photo'&&await view(pg)==='importar','D: depois de Trocar fotógrafo a Marinara deveria cair no Upload');
    await ctx.close();}
  // ---------- E. Permissões: "não se aplica" legível, tela inicial e menu pela tela; prints desktop e celular ----------
  for(const [n,w,h] of [['desk',1440,900],['cel',390,844]]){const {ctx,pg}=await nova(b,w,h);await entrar(pg,'eduardo@eduardorezende.com');
    await pg.evaluate(()=>{ETERNA.state.view='permissoes';ETERNA.render();});await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(150);
    const na=await pg.evaluate(()=>{const row=document.querySelector('.perm-row[data-m="financeiro"]');return {txt:row?row.innerText:'',titles:row?[...row.querySelectorAll('.perm-na')].map(x=>x.title):[]};});
    if(n==='cel')ok(/Criar · não se aplica/.test(na.txt)&&/Alterar · não se aplica/.test(na.txt),'E cel: "não se aplica" deveria estar escrito no card de Números de vendas: '+na.txt.replace(/\s+/g,' ').slice(0,200));
    else ok(na.titles.length===2&&na.titles.every(t=>/Não se aplica/.test(t)),'E desk: célula "não se aplica" sem título explicativo '+J(na.titles));
    const sw=await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);ok(sw,`E ${n}: Permissões com rolagem lateral`);
    await pg.screenshot({path:`${P}/v78-permissoes-${n}.png`,fullPage:n==='cel'});
    if(n==='desk'){await pg.click('[data-act="perm-tab"][data-t="perfis"]').catch(()=>{});await pg.waitForTimeout(100);const pf=await pg.textContent('#main');ok(/Fotógrafo/.test(pf)&&/Atendimento e venda/.test(pf)&&/Validador/.test(pf),'E: aba Perfis prontos sem os perfis');await pg.screenshot({path:`${P}/v78-permissoes-perfis.png`,fullPage:true});
      // tela inicial e menu pela tela: Carlos com Diário como tela inicial e sem Escala
      await pg.click('[data-act="perm-tab"][data-t="usuario"]');await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(100);
      const ops=await pg.$$eval('[data-act="perm-inicio"] option',e=>e.map(x=>x.value));ok(ops.includes('diario')&&!ops.includes('vendas'),'E: opções de tela inicial '+J(ops));
      await pg.selectOption('[data-act="perm-inicio"]','diario');await pg.click('.perm-tbl input[data-act="perm-view"][data-v="escala"]');await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(150);
      const cu=await pg.evaluate(()=>{const u=ETERNA.USERS['carlos@eterna.photo'];return {ini:u.inicio,menu:u.menu,preset:u.preset};});ok(cu.ini==='diario'&&!cu.menu.includes('escala')&&cu.preset==='custom','E: gravar tela inicial e menu '+J(cu));
      await pg.click('[data-act="perm-tab"][data-t="historico"]');await pg.waitForTimeout(100);await pg.screenshot({path:`${P}/v78-permissoes-historico.png`});
      await entrar(pg,'carlos@eterna.photo');const g=await grupos(pg);ok(await view(pg)==='diario'&&J(g)===J([['Fotógrafo',['diario','importar']]]),'E: Carlos deveria entrar no Diário sem Escala: '+await view(pg)+' '+J(g));}
    await ctx.close();}
  // ---------- F. cadastro: cancelar exclusão; e-mail fora do cadastro; tela "sem acesso" ----------
  {const {ctx,pg}=await nova(b,1280,900);await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});
    await pg.click('[data-act="user-sel"][data-e="yago@eterna.photo"]');await pg.click('[data-act="user-del-ask"]');ok(await pg.$('[data-act="user-del-ok"]')&&await pg.$('[data-act="user-del-no"]'),'F: confirmar e cancelar exclusão');
    await pg.click('[data-act="user-del-no"]');await pg.waitForTimeout(80);ok(await pg.evaluate(()=>!!ETERNA.USERS['yago@eterna.photo'])&&!(await pg.$('[data-act="user-del-ok"]')),'F: cancelar exclusão');
    // desativar o outro admin (hello@) pode; depois o Eduardo segue admin; reativar
    await pg.click('[data-act="user-sel"][data-e="hello@eterna.photo"]');await pg.click('[data-act="user-active"]');await pg.waitForTimeout(80);ok(await pg.evaluate(()=>ETERNA.USERS['hello@eterna.photo'].active===false&&ETERNA.adminCount(ETERNA.USERS)===1),'F: desativar o outro admin');
    await pg.click('[data-act="user-sel"][data-e="hello@eterna.photo"]');await pg.click('[data-act="user-active"]');await pg.waitForTimeout(80);ok(await pg.evaluate(()=>ETERNA.USERS['hello@eterna.photo'].active===true),'F: reativar o outro admin');
    // e-mail fora do cadastro
    await sair(pg);await pg.fill('[data-act="login-email"]','alguem@gmail.com');await pg.click('button[type=submit]');await pg.waitForTimeout(200);
    // o código é mostrado igual para qualquer e-mail (não revela quem tem cadastro); o login é que recusa
    const otpF=await pg.$('.otp');if(otpF){await pg.fill('[data-act="login-code"]',(await otpF.textContent()).replace(/\s/g,''));await pg.waitForTimeout(400);}
    const fe=await pg.evaluate(()=>({u:!!ETERNA.state.user,t:document.querySelector('#main').innerText,s:localStorage.getItem('eterna.session')}));ok(!fe.u&&!fe.s&&/não tem acesso/.test(fe.t),'F: e-mail fora do cadastro deveria ser recusado '+J({u:fe.u,s:fe.s}));
    // sessão forjada com e-mail fora do cadastro
    await pg.evaluate(()=>localStorage.setItem('eterna.session',JSON.stringify({email:'alguem@gmail.com',at:new Date().toISOString()})));await pg.reload();await pg.waitForTimeout(300);ok(!(await pg.evaluate(()=>!!ETERNA.state.user)),'F: sessão forjada com e-mail fora do cadastro entrou');
    // tela "sem acesso": cadastro sem nenhuma tela
    await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.click('[data-act="user-new"]');
    await pg.fill('[data-act="user-field"][data-k="name"]','Sem Tela');await pg.fill('[data-act="user-field"][data-k="email"]','semtela@eterna.photo');await pg.selectOption('[data-act="user-preset"]','custom');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(100);
    await entrar(pg,'semtela@eterna.photo');const sa=await pg.evaluate(()=>({v:ETERNA.state.view,t:document.querySelector('#main').innerText,nav:document.querySelector('#nav').offsetParent!==null}));
    ok(sa.v==='semacesso'&&/Seu acesso ainda não foi liberado/.test(sa.t)&&!sa.nav,'F: tela sem acesso '+J({v:sa.v,nav:sa.nav}));await pg.screenshot({path:`${P}/v78-sem-acesso.png`});
    await pg.click('[data-act="role-exit"]');await pg.waitForTimeout(120);ok(await pg.$('[data-act="login-email"]'),'F: Sair da tela sem acesso deveria voltar ao login');
    for(const w of [390,1024]){await pg.setViewportSize({width:w,height:844});await codigo(pg,'semtela@eterna.photo');ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'F: sem acesso com rolagem lateral em '+w);if(w===390)await pg.screenshot({path:`${P}/v78-sem-acesso-cel.png`});await pg.click('[data-act="role-exit"]');await pg.waitForTimeout(100);}
    await ctx.close();}
  // ---------- G. textos da equipe: "Checkout" no lugar de "loja"; nada apontando para telas que saíram; "Fila do balcão" ----------
  {const {ctx,pg}=await nova(b,1440,1000);await entrar(pg,'eduardo@eduardorezende.com');
    const telas=PERFIS['eduardo@eduardorezende.com'].g.flatMap(g=>g[1]).concat(['perfis','checkout','fila','caixa']);const achados=[];
    for(const v of telas){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(60);
      if(v==='galerias'){for(const t of ['sessoes','grupos','envio','cortesias']){await pg.evaluate(t=>{ETERNA.state.gal.tab=t;ETERNA.render();},t).catch(()=>{});await pg.waitForTimeout(40);achados.push(...await pg.evaluate(v=>{const t=document.querySelector('#main').innerText.replace(/[\w.+-]+@[\w.-]+/g,'');return [...t.matchAll(/.{0,40}\bloja\b.{0,30}/gi)].map(m=>v+': '+m[0]);},v+'/'+t));}continue;}
      achados.push(...await pg.evaluate(v=>{const t=(document.querySelector('#main').innerText+' '+document.querySelector('#nav').innerText).replace(/[\w.+-]+@[\w.-]+/g,'').replace(/Checkout da loja/g,'');const out=[]; // nome do usuário quiosque@ na semente (dado, não rótulo de tela)
        [...t.matchAll(/.{0,40}\bloja\b.{0,30}/gi)].forEach(m=>out.push(v+': '+m[0]));
        [...t.matchAll(/.{0,30}(\bno Fluxo\b|Anfitrião no set|galeria do convidado|Fila da loja).{0,30}/gi)].forEach(m=>out.push(v+': '+m[0]));return out;},v));}
    ok(!achados.length,'G: textos com "loja" ou telas que saíram: '+[...new Set(achados.map(x=>x.replace(/\s+/g,' ')))].slice(0,12).join(' || '));
    await pg.evaluate(()=>{ETERNA.state.view='fila';ETERNA.render();});ok(/Fila do balcão/i.test(await pg.textContent('#main')),'G: tela Fila sem o título "Fila do balcão"');
    await pg.evaluate(()=>{ETERNA.state.view='checkout';ETERNA.render();});ok(/Venda no balcão/.test(await pg.textContent('#main')),'G: tela de venda sem "Venda no balcão"');
    await ctx.close();}
}catch(e){fails.push('erro: '+e.message.split('\n').filter(x=>x.trim()).slice(0,3).join(' / '));}
await b.close();const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} v78-regressao: menus por perfil, links antigos, Upload, Permissões, cadastro, sem acesso, textos${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})();
