// v78: área de Permissões (critérios 1 a 20 do plano de permissões) e menus novos (plano dos menus), no modo SIM.
const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1280,height:h||1000}});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});return {ctx,pg};}
async function sair(pg){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.reload();await pg.waitForTimeout(350);}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user))await sair(pg);
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
async function semear(pg,fn){await pg.goto(U);await pg.waitForTimeout(300);await pg.evaluate(fn);await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.reload();await pg.waitForTimeout(400);}
const nav=pg=>pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));
const toastTxt=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent);
async function abrirPerm(pg,email){await pg.evaluate(()=>{ETERNA.state.perm.tab='usuario';ETERNA.state.view='permissoes';ETERNA.render();});await pg.click(`[data-act="perm-sel"][data-e="${email}"]`);await pg.waitForTimeout(120);}
const ck=(pg,m,op)=>pg.click(`.perm-tbl input[data-act="perm-op"][data-m="${m}"][data-op="${op}"]`);
const draft=pg=>pg.evaluate(()=>JSON.parse(JSON.stringify(ETERNA.state.perm.draft)));
const MENUS={Dashboard:['painel','bandeiras','estoque','fotografos','vendas','vendas-lista','galerias'],Curadoria:['revisao','treino','alertas'],'Fotógrafo':['diario','importar','escala'],'Configurações':['repo','identidade','catalogo','chroma','ajustes','usuarios','permissoes'],'Laboratório':['vestiario','fundos-teste']};
(async()=>{const b=await chromium.launch();
try{
  // ---------- 1, 2, 3, 4, 19 e menus: admin ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');
    const grupos=await pg.$$eval('#nav .navg',gs=>gs.map(g=>({g:g.querySelector('.grp').textContent.trim(),vs:[...g.querySelectorAll('button[data-v]')].map(x=>x.dataset.v)})));
    ok(JSON.stringify(grupos.map(x=>x.g))===JSON.stringify(Object.keys(MENUS)),'menus: grupos '+JSON.stringify(grupos.map(x=>x.g)));
    grupos.forEach(x=>ok(JSON.stringify(x.vs)===JSON.stringify(MENUS[x.g]),'menus: itens de '+x.g+' '+JSON.stringify(x.vs)));
    const vs=await nav(pg);['set','fluxo','convidado','quiosque','perfis'].forEach(v=>ok(!vs.includes(v),'menus: '+v+' não deveria estar no menu'));
    ok(await pg.$('#rail-ck [data-act="loja-abrir"]'),'menus: botão Abrir Checkout fora dos menus');
    // menus abrem e fecham: o do item atual fica aberto
    await pg.evaluate(()=>ETERNA.go('perfis'));await pg.waitForTimeout(100); // v80: o admin começa no Painel; os menus fechados valem no Início
    ok(await pg.$eval('#nav [data-v="painel"]',e=>e.offsetParent===null),'menus: no Início os menus começam fechados');await pg.click('#nav .grp[data-g="Dashboard"]');await pg.click('#nav [data-v="painel"]');await pg.waitForTimeout(100);
    let ab=await pg.$$eval('#nav .navg',gs=>gs.map(g=>!g.querySelector('.navitems').hidden));ok(ab[0]&&!ab[1]&&!ab[3],'menus: só o Dashboard aberto no Painel '+JSON.stringify(ab));
    await pg.click('#nav .grp[data-g="Curadoria"]');await pg.waitForTimeout(80);ab=await pg.$$eval('#nav .navg',gs=>gs.map(g=>!g.querySelector('.navitems').hidden));ok(ab[1],'menus: clicar em Curadoria abre');
    await pg.click('#nav .grp[data-g="Curadoria"]');await pg.waitForTimeout(80);ab=await pg.$$eval('#nav .navg',gs=>gs.map(g=>!g.querySelector('.navitems').hidden));ok(!ab[1],'menus: clicar de novo fecha');
    // Início pelo logo, sem item no menu
    await pg.click('#rail-brand');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.view)==='perfis','menus: logo abre o Início');
    // telas removidas não abrem nem pelo endereço
    for(const v of ['fluxo','convidado']){await pg.evaluate(v=>{location.hash='#'+v;},v);await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.view)!==v,'menus: #'+v+' abriu');}
    await pg.evaluate(()=>{location.hash='#set';});await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.view)==='importar','menus: link antigo #set deveria cair no Upload automático');
    // 1
    await pg.evaluate(()=>{location.hash='#permissoes';});await pg.waitForTimeout(200);const t1=await pg.textContent('#main');ok(!/Algo falhou/.test(t1)&&await pg.evaluate(()=>ETERNA.state.view)==='permissoes','1: #permissoes não abriu');
    // 2
    await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(150);
    const th=await pg.$$eval('.perm-tbl thead th',e=>e.slice(1).map(x=>x.innerText.replace(/\s+/g,' ').trim()));
    ok(JSON.stringify(th)===JSON.stringify(['Criar C · Create','Ver R · Read','Alterar U · Update','Excluir D · Delete']),'2: cabeçalho '+JSON.stringify(th));
    ok(th.every(x=>x.length>1),'2: célula de cabeçalho com só uma letra');ok(/Create \(criar\), Read \(ver\), Update \(alterar\) e Delete \(excluir\)/.test(await pg.textContent('#main')),'2: legenda');
    // 3
    const r3=await pg.evaluate(()=>{const out={};document.querySelectorAll('.perm-row').forEach(tr=>{const m=tr.dataset.m;const tds=[...tr.children].slice(1);out[m]={na:tds.map(td=>!!td.querySelector('.perm-na')&&!td.querySelector('input')),desc:tr.querySelector('.perm-desc').innerText};});return out;});
    const MI=await pg.evaluate(()=>ETERNA.MODULE_INFO);
    Object.entries(r3).forEach(([m,x])=>['c','r','u','d'].forEach((k,i)=>{if(MI[m][k])ok(x.desc.includes(MI[m][k])&&!x.na[i],`3: ${m}.${k} sem descrição visível ou sem checkbox`);else ok(x.na[i],`3: ${m}.${k} deveria ser .perm-na`);}));
    ok(r3.financeiro&&r3.financeiro.na[0]&&r3.financeiro.na[2]&&!r3.financeiro.na[1]&&!r3.financeiro.na[3],'3: Números de vendas '+JSON.stringify(r3.financeiro&&r3.financeiro.na));
    ok(r3.permissoes&&r3.permissoes.na[0]&&r3.permissoes.na[3],'3: Permissões '+JSON.stringify(r3.permissoes&&r3.permissoes.na));
    // 4
    await ck(pg,'estoque','u');let d4=await draft(pg);ok(d4.perms.estoque.u&&d4.perms.estoque.r,'4: Alterar sem Ver deveria ligar Ver');
    ok(d4.menu.includes('bandeiras')&&d4.menu.includes('estoque'),'4: ligar Ver põe as telas do módulo no menu');
    await ck(pg,'set','r');d4=await draft(pg);ok(!d4.perms.set.r&&!d4.perms.set.c&&!d4.perms.set.u&&!d4.perms.set.d&&!d4.menu.includes('importar'),'4: desligar Ver deveria limpar C/U/D e as telas '+JSON.stringify(d4.perms.set));
    // a linha "Aparece no menu" só existe com Ver ligado: liga uma tela de Relatórios (Ver desligado) direto pelo evento
    d4=await draft(pg);ok(!d4.perms.relatorios.r,'4: pré Relatórios desligado');
    await pg.evaluate(()=>{const i=document.createElement('input');i.type='checkbox';i.dataset.act='perm-view';i.dataset.v='alertas';document.querySelector('#main').appendChild(i);i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
    d4=await draft(pg);ok(d4.perms.relatorios.r&&d4.menu.includes('alertas'),'4: ligar uma tela deveria ligar Ver');
    await ck(pg,'permissoes','r');d4=await draft(pg);ok(d4.perms.permissoes.r&&d4.perms.permissoes.u,'4: em Permissões, Ver liga Alterar');
    await ck(pg,'permissoes','u');d4=await draft(pg);ok(!d4.perms.permissoes.r&&!d4.perms.permissoes.u,'4: em Permissões, desligar Alterar desliga Ver');
    await pg.click('[data-act="perm-discard"]');await pg.waitForTimeout(100);
    // 19 consistência
    const r19=await pg.evaluate(async()=>{const E=ETERNA;const bad=[];const W=E.WRITE_OPS;
      E.MODULES.forEach(([m,,vs])=>{const I=E.MODULE_INFO[m];if(!I||!I.desc)bad.push('sem MODULE_INFO '+m);vs.forEach(v=>{if(!E.VIEWS.find(x=>x[0]===v)&&!['checkout','fila','caixa'].includes(v))bad.push('tela sem VIEWS '+v);});});
      E.VIEWS.forEach(([v])=>{if(v!=='perfis'&&!E.MODULE_OF[v])bad.push('tela sem módulo '+v);});
      for(const [m,,vs] of E.MODULES){for(const v of vs){if(v==='quiosque')continue;E.state.view=v;E.render();await new Promise(r=>setTimeout(r,60));
        const acts=new Set([...document.querySelectorAll('#main [data-act]')].map(x=>x.dataset.act));acts.forEach(a=>{if(a==='reset'||!W[a])return;const mm=(E.ACT_MOD&&E.ACT_MOD[a])||m; /* v81: ação com módulo próprio (ACT_MOD), como o guardAct */if(!E.MODULE_INFO[mm][W[a]])bad.push(`${v}: ${a} pede ${W[a]} e ${mm} não tem a letra`);});
        if(/Algo falhou/.test(document.querySelector('#main').textContent))bad.push('quebrou '+v);}}
      return bad;});
    ok(!r19.length,'19: '+r19.join(' | '));
    await ctx.close();}
  // ---------- 5, 14: admin tira o Upload do Carlos e liga o Excluir; auditoria; Carlos sem o item ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');
    await pg.evaluate(()=>{window.__db=[];ETERNA.state.db={doc:p=>({set:o=>window.__db.push([p,JSON.parse(JSON.stringify(o))])})};});
    await abrirPerm(pg,'carlos@eterna.photo');const n0=await pg.evaluate(()=>ETERNA.auditRead().length);
    await ck(pg,'set','d');await pg.click('.perm-tbl input[data-act="perm-view"][data-v="importar"]');
    const d5=await draft(pg);ok(d5.perms.set.d&&d5.perms.set.r&&!d5.menu.includes('importar'),'5: pré '+JSON.stringify(d5));
    ok(/alterações não salvas/.test(await pg.textContent('#main')),'14: pill de alterações não salvas');
    await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(150);
    const l14=await pg.evaluate(()=>ETERNA.auditRead());ok(l14.length===n0+1,'14: uma entrada por gravação: '+(l14.length-n0));
    const e=l14[0]||{};ok(e.por==='eduardo@eduardorezende.com'&&e.alvo==='carlos@eterna.photo'&&e.acao==='permissoes','14: entrada '+JSON.stringify(e).slice(0,200));
    ok((e.mudancas||[]).some(c=>c.campo==='perms.set.d'&&c.de===false&&c.para===true),'14: perms.set.d false→true');
    ok((e.mudancas||[]).some(c=>c.campo==='menu'&&(c.sai||[]).includes('importar')),'14: menu.sai com importar');
    ok(!/"(code|codigo|token|ip)"/i.test(JSON.stringify(e)),'14: auditoria com código, token ou IP');
    const dbl=await pg.evaluate(id=>window.__db.find(x=>x[0]==='usuarios_log/'+id),e.id);ok(dbl&&JSON.stringify(dbl[1])===JSON.stringify(e),'14: state.db usuarios_log/<id> com o mesmo objeto');
    // salvar sem mudança não grava
    await pg.evaluate(()=>{const b=document.querySelector('[data-act="perm-save"]');b.disabled=false;b.click();});await pg.waitForTimeout(100);
    ok(await pg.evaluate(()=>ETERNA.auditRead().length)===n0+1,'14: salvar sem mudança gravou no histórico');
    await pg.click('[data-act="perm-tab"][data-t="historico"]');await pg.waitForTimeout(100);const h14=await pg.textContent('.perm-log');ok(/Eduardo Rezende/.test(h14)&&/Carlos/.test(h14)&&/mudou as permissões de/.test(h14),'14: frase do Histórico: '+h14.slice(0,160));
    await pg.screenshot({path:P+'/permissoes-historico.png'});
    // nome com HTML aparece como texto
    await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.click('[data-act="user-new"]');
    await pg.fill('[data-act="user-field"][data-k="name"]','<img src=x onerror="window.__xss=1">');await pg.fill('[data-act="user-field"][data-k="email"]','xss@eterna.photo');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(150);
    await pg.evaluate(()=>{ETERNA.state.view='permissoes';ETERNA.state.perm.tab='historico';ETERNA.render();});await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>!window.__xss&&!document.querySelector('#main img[src="x"]')&&document.querySelector('#main').innerText.includes('<img src=x')),'14: nome com <img onerror> executou ou não apareceu como texto');
    await pg.evaluate(()=>{ETERNA.state.db=null;});
    // Carlos sem o Upload
    await entrar(pg,'carlos@eterna.photo');const v5=await nav(pg);ok(!v5.includes('importar')&&v5.includes('diario')&&v5.includes('escala'),'5: menu do Carlos '+JSON.stringify(v5));
    await pg.evaluate(()=>{ETERNA.state.view='importar';ETERNA.render();});ok(await pg.evaluate(()=>ETERNA.state.view)!=='importar','5: render() deixou abrir o Upload');
    await pg.evaluate(()=>{location.hash='#importar';});await pg.waitForTimeout(150);ok(/Sem acesso a esta tela/.test(await toastTxt(pg))&&await pg.evaluate(()=>ETERNA.state.view)!=='importar','5: #importar deveria dar "Sem acesso a esta tela"');
    await ctx.close();}
  // ---------- 6, 17 e o check-in da câmera no Upload automático: Carlos com a semente limpa ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'carlos@eterna.photo');
    const v6=await nav(pg);ok(v6.length&&v6.every(v=>['diario','importar','escala'].includes(v)),'6: menu do fotógrafo '+JSON.stringify(v6));
    ok(!(await pg.$$eval('#nav .grp',e=>e.map(x=>x.textContent.trim()))).includes('Dashboard'),'6: fotógrafo não vê o Dashboard (nem Fotógrafos)');
    ok(await pg.evaluate(()=>ETERNA.state.view)==='importar','6: depois do login o fotógrafo cai no Upload automático: '+await pg.evaluate(()=>ETERNA.state.view));
    ok(!(await pg.$('#rail-ck [data-act="loja-abrir"]')),'6: fotógrafo não vê Abrir Checkout');
    const m6=await pg.textContent('#main');ok(!/Check-in/.test(m6)&&!/Câmera de Carlos hoje/.test(m6)&&!/sem câmera/.test(m6),'6: o cartão de check-in da câmera saiu do Upload automático (v80)');ok(!/Servidor FTP do estádio/.test(m6),'6: o FTP do estádio saiu do Upload automático (v80)');ok(await pg.$('[data-act="set-switch"]')&&await pg.$('[data-act="set-logout"]'),'6: troca e saída do fotógrafo no Upload automático');
    // v80: sem check-in; uma câmera que mandou foto hoje não pede "É a minha"
    const serie='R6TESTE0042';await pg.evaluate(s=>{const d=new Date();const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');ETERNA.state.lib.push({id:'t1',day,serie:s,t:Date.now()/1000,autor:'',modelo:'EOS R6'});ETERNA.render();},serie);
    ok(!(await pg.$('[data-act="cam-mine"]'))&&!(await pg.$('select[data-act="cam-who"]')),'upload: botão "É a minha" e select de câmera não deveriam existir mais');
    await pg.screenshot({path:P+'/permissoes-upload-checkin.png'});
    await pg.evaluate(()=>{ETERNA.state.view='perfis';ETERNA.render();});ok(!/R\$/.test(await pg.textContent('#main')),'6: Início do fotógrafo com R$');
    // troca de fotógrafo volta para o Upload automático
    await pg.evaluate(()=>{ETERNA.state.view='importar';ETERNA.render();});await pg.click('[data-act="set-switch"]');await pg.waitForTimeout(150);ok(/Trocar fotógrafo/.test(await pg.textContent('#main'))&&await pg.evaluate(()=>ETERNA.state.auth_next)==='importar','troca: tela de login deveria voltar para o Upload automático');
    // 17
    await semear(pg,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));U['carlos@eterna.photo'].inicio='diario';localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    await entrar(pg,'carlos@eterna.photo');ok(await pg.evaluate(()=>ETERNA.state.view)==='diario','17: inicio=diario');
    await semear(pg,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));U['carlos@eterna.photo'].inicio='vendas';localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    await entrar(pg,'carlos@eterna.photo');ok(await pg.evaluate(()=>ETERNA.state.view)==='perfis','17: inicio não permitido deveria cair no padrão: '+await pg.evaluate(()=>ETERNA.state.view));
    await ctx.close();}
  // ---------- 7: atendimento e venda ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'loja@eterna.photo');const v7=await nav(pg);
    ['vendas-lista','vendas','fotografos','painel','alertas','revisao','usuarios','permissoes','bandeiras','galerias'].forEach(v=>ok(!v7.includes(v),'7: atendimento vê '+v));
    ok(!(await pg.$$eval('#nav .grp',e=>e.map(x=>x.textContent.trim()))).includes('Dashboard'),'7: atendimento sem Dashboard');
    ok(await pg.$('#rail-ck [data-act="loja-abrir"]'),'7: atendimento tem Abrir Checkout');ok(await pg.evaluate(()=>ETERNA.canView('vendas-lista'))===false,'7: canView(vendas-lista)');
    await pg.evaluate(()=>{ETERNA.state.view='perfis';ETERNA.render();});ok(!/R\$/.test(await pg.textContent('#main')),'7: Início do atendimento com R$');
    {const [J2]=await Promise.all([ctx.waitForEvent('page'),pg.click('#rail-ck [data-act="loja-abrir"]')]);await J2.waitForLoadState();await J2.waitForTimeout(300); // v81: janela à parte
    ok(await J2.evaluate(()=>ETERNA.state.lojaRota&&location.hash==='#loja'),'7: Abrir Checkout deveria abrir #loja numa janela à parte');ok(await pg.evaluate(()=>!ETERNA.state.lojaRota&&!!ETERNA.state.user),'7: a aba do atendimento continua logada');}
    await ctx.close();}
  // ---------- 8, 16: supervisor ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'supervisor@eterna.photo');const v8=await nav(pg);
    ok(v8.includes('vendas-lista')&&v8.includes('vendas')&&!v8.includes('usuarios')&&!v8.includes('permissoes'),'8: menu do supervisor '+JSON.stringify(v8));
    await pg.evaluate(()=>{ETERNA.state.view='vendas-lista';ETERNA.render();const b=document.createElement('button');b.dataset.act='sales-cancel';b.id='t8';document.querySelector('#main').appendChild(b);});
    await pg.evaluate(()=>document.querySelector('#t8').click());await pg.waitForTimeout(80);ok(/Sem permissão/.test(await toastTxt(pg)),'8: Cancelar venda deveria ser barrado: '+await toastTxt(pg));
    const r16=await pg.evaluate(()=>{const before=JSON.stringify(ETERNA.state.perm.draft);const i=document.createElement('input');i.type='checkbox';i.dataset.act='perm-op';i.dataset.m='set';i.dataset.op='d';document.querySelector('#main').appendChild(i);i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));return {checked:i.checked,same:before===JSON.stringify(ETERNA.state.perm.draft)};});
    ok(!r16.checked&&r16.same,'16: change sem permissoes.u deveria voltar o checkbox '+JSON.stringify(r16));
    await ctx.close();}
  // ---------- 9: migração do formato v77 ----------
  {const {ctx,pg}=await nova(b);
    await semear(pg,()=>{const NONE={c:false,r:false,u:false,d:false},RW={c:true,r:true,u:true,d:false},ALL={c:true,r:true,u:true,d:true};const mods=['set','diario','desempenho','venda','quiosque','galeria','galerias','qualidade','relatorios','configuracao','catalogo','estoque','usuarios'];
      const pp=o=>Object.fromEntries(mods.map(m=>[m,o[m]||NONE]));
      const U={'eduardo@eduardorezende.com':{email:'eduardo@eduardorezende.com',name:'Eduardo Rezende',preset:'admin',perms:pp(Object.fromEntries(mods.map(m=>[m,ALL]))),active:true,createdAt:'2026-10-26T12:00:00.000Z'},
        'loja@eterna.photo':{email:'loja@eterna.photo',name:'Loja · vendedores',preset:'venda',perms:pp({venda:RW,catalogo:{c:false,r:true,u:false,d:false},galeria:{c:false,r:true,u:false,d:false}}),active:true},
        'mix@eterna.photo':{email:'mix@eterna.photo',name:'Mix',preset:'custom',perms:pp({venda:RW,configuracao:{c:false,r:true,u:false,d:false}}),active:true},
        'carlos@eterna.photo':{email:'carlos@eterna.photo',name:'Carlos',preset:'foto',key:'carlos',perms:pp({set:RW,diario:RW,desempenho:{c:false,r:true,u:false,d:false}}),active:true}};
      localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    const r9=await pg.evaluate(()=>{const U=ETERNA.USERS;return {n:Object.keys(U).length,v2:Object.values(U).every(u=>u.v===2),mixFin:U['mix@eterna.photo'].perms.financeiro.r,mixMenu:U['mix@eterna.photo'].menu,mixEsc:U['mix@eterna.photo'].perms.escala.r,mixCfgU:U['mix@eterna.photo'].perms.configuracao.u,lojaFin:U['loja@eterna.photo'].perms.financeiro.r,carlosMenu:U['carlos@eterna.photo'].menu,carlosIni:U['carlos@eterna.photo'].inicio,saved:JSON.parse(localStorage.getItem('eterna.users.v1'))['mix@eterna.photo'].v};});
    ok(r9.n===4&&r9.v2,'9: usuários sumiram ou sem v:2 '+JSON.stringify(r9));ok(r9.mixFin===true&&r9.mixMenu.includes('vendas-lista')&&r9.mixMenu.includes('checkout'),'9: personalizado com venda deveria ganhar Números de vendas e a Lista '+JSON.stringify(r9.mixMenu));
    ok(r9.mixEsc===true&&r9.mixCfgU===false,'9: personalizado: Configuração R vira Escala R, sem ganhar Alterar');ok(r9.lojaFin===false,'9: loja@ (perfil venda) não deveria ver Números de vendas');
    ok(JSON.stringify(r9.carlosMenu)===JSON.stringify(['diario','importar','escala'])&&r9.carlosIni==='importar','9: fotógrafo migrado '+JSON.stringify(r9.carlosMenu)+' '+r9.carlosIni);ok(r9.saved===2,'9: migração não gravou');
    await ctx.close();}
  // ---------- 10, 11: travas do administrador ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');await abrirPerm(pg,'eduardo@eduardorezende.com');
    const u0=await pg.evaluate(()=>JSON.stringify(ETERNA.USERS['eduardo@eduardorezende.com']));
    await ck(pg,'permissoes','r');await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(100);
    ok(/outro administrador/.test(await toastTxt(pg))&&await pg.evaluate(()=>JSON.stringify(ETERNA.USERS['eduardo@eduardorezende.com']))===u0,'10: tirar o próprio Ver de Permissões: '+await toastTxt(pg));
    await pg.click('[data-act="perm-discard"]');await pg.click('.perm-tbl input[data-act="perm-view"][data-v="usuarios"]');await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(100);
    ok(/outro administrador/.test(await toastTxt(pg))&&await pg.evaluate(()=>JSON.stringify(ETERNA.USERS['eduardo@eduardorezende.com']))===u0,'10: tirar Usuários do próprio menu');
    const r11=await pg.evaluate(()=>{const E=ETERNA;const U=JSON.parse(JSON.stringify(E.USERS));Object.values(U).forEach(u=>{if(u.preset==='admin')u.active=false;});const a=E.USERS['carlos@eterna.photo'];return E.permValidate(E.state.user,a,a,U);});
    ok(r11.motivo==='sem_admin','11: permValidate sem admin: '+JSON.stringify(r11));
    await semear(pg,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));Object.values(U).forEach(u=>{if(u.preset==='admin')u.active=false;});localStorage.setItem('eterna.users.v1',JSON.stringify(U));localStorage.removeItem('eterna.users.log.v1');});
    const r11b=await pg.evaluate(()=>({ok:ETERNA.adminCount(ETERNA.USERS),ed:ETERNA.USERS['eduardo@eduardorezende.com'].active,log:ETERNA.auditRead().map(e=>e.acao)}));
    ok(r11b.ok>=1&&r11b.ed===true&&r11b.log.includes('recuperacao'),'11: recuperação do administrador '+JSON.stringify(r11b));
    await ctx.close();}
  // ---------- 12: gerente sem financeiro não escala privilégio ----------
  {const {ctx,pg}=await nova(b);
    await semear(pg,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));const N={c:false,r:false,u:false,d:false};const p={};Object.keys(U['eduardo@eduardorezende.com'].perms).forEach(m=>p[m]={...N});p.usuarios={c:true,r:true,u:true,d:true};p.permissoes={c:false,r:true,u:true,d:false};p.set={c:false,r:true,u:false,d:false};
      U['gerente@eterna.photo']={v:2,email:'gerente@eterna.photo',name:'Gerente',preset:'custom',key:null,perms:p,menu:['usuarios','permissoes','importar'],inicio:null,active:true,createdAt:new Date().toISOString(),lastLogin:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    await entrar(pg,'gerente@eterna.photo');await abrirPerm(pg,'carlos@eterna.photo');
    ok(await pg.$eval('.perm-tbl input[data-act="perm-op"][data-m="financeiro"][data-op="r"]',e=>e.disabled),'12: Ver de Números de vendas deveria estar desativado');
    const r12=await pg.evaluate(()=>{const E=ETERNA;const a=E.USERS['carlos@eterna.photo'];const d=JSON.parse(JSON.stringify(a));d.perms.financeiro.r=true;d.menu=d.menu.concat(['vendas']);return E.permValidate(E.state.user,a,d,Object.assign({},E.USERS,{[a.email]:d}));});
    ok(r12.motivo==='sem_poder','12: dar Números de vendas: '+JSON.stringify(r12));
    await pg.click('[data-act="perm-sel"][data-e="eduardo@eduardorezende.com"]');await pg.waitForTimeout(100);
    const ro12=await pg.evaluate(()=>({alert:/acessos que você não tem/.test(document.querySelector('#main').innerText),all:[...document.querySelectorAll('.perm-tbl input')].every(i=>i.disabled),save:document.querySelector('[data-act="perm-save"]').disabled}));
    ok(ro12.alert&&ro12.all&&ro12.save,'12: editor do Eduardo deveria ser só leitura '+JSON.stringify(ro12));
    const r12b=await pg.evaluate(()=>{const E=ETERNA;const a=E.USERS['eduardo@eduardorezende.com'];const d=JSON.parse(JSON.stringify(a));d.name='X';return E.permValidate(E.state.user,a,d,Object.assign({},E.USERS,{[a.email]:d})).motivo;});ok(r12b==='alvo_maior','12: alvo_maior '+r12b);
    await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.click('[data-act="user-new"]');const op12=await pg.$$eval('[data-act="user-preset"] option',e=>e.map(x=>x.value));
    ok(!op12.includes('admin')&&!op12.includes('supervisor'),'12: perfis oferecidos ao gerente '+JSON.stringify(op12));
    await ctx.close();}
  // ---------- 13, 20: cadastro e revogação entre abas ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});
    await pg.click('[data-act="user-new"]');await pg.fill('[data-act="user-field"][data-k="name"]','Teste');await pg.fill('[data-act="user-field"][data-k="email"]','teste@eterna.photo');await pg.selectOption('[data-act="user-preset"]','foto');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(120);
    ok(await pg.$('[data-act="user-sel"][data-e="teste@eterna.photo"]')&&await pg.evaluate(()=>ETERNA.USERS['teste@eterna.photo'].preset)==='foto','13: criar teste@');
    ok(await pg.evaluate(()=>ETERNA.auditRead()[0].acao)==='criar','13: auditoria criar');
    await pg.click('[data-act="user-new"]');await pg.fill('[data-act="user-field"][data-k="name"]','Dup');await pg.fill('[data-act="user-field"][data-k="email"]','teste@eterna.photo');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);ok(/já tem acesso/.test(await toastTxt(pg)),'13: e-mail duplicado');
    await pg.fill('[data-act="user-field"][data-k="email"]','invalido');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);ok(/inválido/.test(await toastTxt(pg)),'13: e-mail inválido');
    await pg.click('[data-act="user-cancel"]');await pg.click('[data-act="user-sel"][data-e="teste@eterna.photo"]');await pg.fill('[data-act="user-field"][data-k="name"]','Teste Dois');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);
    ok(await pg.evaluate(()=>ETERNA.USERS['teste@eterna.photo'].name)==='Teste Dois','13: mudar o nome');
    await pg.click('[data-act="user-sel"][data-e="eduardo@eduardorezende.com"]');ok(!(await pg.$('[data-act="user-active"]'))&&!(await pg.$('[data-act="user-del-ask"]')),'13: na própria linha não pode Desativar nem Excluir');
    await pg.screenshot({path:P+'/permissoes-usuarios.png'});
    // 20: B logada como Carlos; A desativa o Carlos
    const pb=await ctx.newPage();pb.on('pageerror',e=>errs.push('B: '+e.message));await pb.goto(U);await pb.waitForTimeout(300);await pb.evaluate(()=>localStorage.removeItem('eterna.session'));await pb.reload();await pb.waitForTimeout(300);
    await pb.fill('[data-act="login-email"]','carlos@eterna.photo');await pb.click('button[type=submit]');await pb.waitForTimeout(150);const cb=(await pb.textContent('.otp')).replace(/\s/g,'');await pb.fill('[data-act="login-code"]',cb);await pb.waitForTimeout(400);
    ok(await pb.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email)==='carlos@eterna.photo','20: pré B logada como Carlos');
    await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.click('[data-act="user-active"]');await pb.waitForTimeout(1000);
    const r20=await pb.evaluate(()=>({user:!!ETERNA.state.user,login:!!document.querySelector('[data-act="login-email"]'),t:document.querySelector('#toast').textContent}));
    ok(!r20.user&&r20.login&&/Seu acesso foi removido/.test(r20.t),'20: B deveria voltar ao login '+JSON.stringify(r20));
    // desativado não entra; reativar volta
    const entrou=await entrar(pb,'carlos@eterna.photo');ok(!entrou&&/Este e-mail não tem acesso/.test(await pb.textContent('#main')),'13: desativado entrou');
    await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.click('[data-act="user-active"]');await pg.waitForTimeout(80);ok(await pg.evaluate(()=>ETERNA.USERS['carlos@eterna.photo'].active)===true,'13: reativar');
    // excluir só depois de confirmar
    await pg.click('[data-act="user-sel"][data-e="teste@eterna.photo"]');await pg.click('[data-act="user-del-ask"]');ok(await pg.evaluate(()=>!!ETERNA.USERS['teste@eterna.photo']),'13: excluiu sem confirmar');
    await pg.click('[data-act="user-del-ok"]');await pg.waitForTimeout(80);const r13=await pg.evaluate(()=>({gone:!ETERNA.USERS['teste@eterna.photo'],log:ETERNA.auditRead()[0]}));
    ok(r13.gone&&r13.log.acao==='excluir'&&r13.log.antes&&r13.log.antes.name==='Teste Dois','13: excluir com retrato no histórico '+JSON.stringify(r13.log).slice(0,160));
    await ctx.close();}
  // ---------- 15: cadastro só leitura; Permissões só com Ver e Alterar ----------
  {const {ctx,pg}=await nova(b);
    await semear(pg,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));const N={c:false,r:false,u:false,d:false};const mk=(e,p,menu)=>{const q={};Object.keys(U['eduardo@eduardorezende.com'].perms).forEach(m=>q[m]={...N});Object.assign(q,p);U[e]={v:2,email:e,name:e.split('@')[0],preset:'custom',key:null,perms:q,menu,inicio:null,active:true,createdAt:new Date().toISOString(),lastLogin:null};};
      mk('leitor@eterna.photo',{usuarios:{c:false,r:true,u:false,d:false}},['usuarios','permissoes']);mk('auditor@eterna.photo',{usuarios:{c:false,r:true,u:false,d:false},permissoes:{c:false,r:true,u:false,d:false}},['usuarios','permissoes']);localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    await entrar(pg,'leitor@eterna.photo');const v15=await nav(pg);ok(v15.includes('usuarios')&&!v15.includes('permissoes'),'15: leitor '+JSON.stringify(v15));
    await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');
    ok(!(await pg.$('[data-act="user-new"]'))&&!(await pg.$('[data-act="user-save"]'))&&!(await pg.$('[data-act="user-active"]'))&&!(await pg.$('[data-act="user-del-ask"]')),'15: leitor com botões de gravar');
    await entrar(pg,'auditor@eterna.photo');ok(!(await nav(pg)).includes('permissoes')&&await pg.evaluate(()=>ETERNA.canView('permissoes'))===false,'15: Permissões só com Ver, sem Alterar');
    await ctx.close();}
  // ---------- correções da revisão: segurança B1 (carlos@ no Início disparando cadastro e permissões pelo DOM) ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'carlos@eterna.photo');await pg.evaluate(()=>{ETERNA.state.view='perfis';ETERNA.render();});
    const a0=await pg.evaluate(()=>({u:JSON.stringify(ETERNA.USERS),l:ETERNA.auditRead().length}));
    await pg.evaluate(()=>{const E=ETERNA,S=E.state;const clk=a=>{const b=document.createElement('button');b.dataset.act=a;document.querySelector('#main').appendChild(b);b.click();};
      S.users.draft={email:'marinara@eterna.photo',email0:'marinara@eterna.photo',name:'Marinara',key:'marinara',preset:'foto'};clk('user-active');
      S.users.draft={email:'samuel@eterna.photo',email0:'samuel@eterna.photo',name:'Samuel',key:'samuel',preset:'foto'};S.users.delAsk=true;clk('user-del-ok');
      S.users.draft={email:'novo@eterna.photo',email0:null,name:'Novo',key:null,preset:'foto'};clk('user-save');
      S.users.draft={email:'yago@eterna.photo',email0:'yago@eterna.photo',name:'Hack',key:'yago',preset:'foto'};clk('user-save');
      const u=E.USERS['yago@eterna.photo'];S.perm.sel=u.email;S.perm.draft={email:u.email,preset:'custom',perms:JSON.parse(JSON.stringify(u.perms)),menu:u.menu.filter(v=>v!=='importar'),inicio:null};clk('perm-save');
      S.perm.presetPick='admin';clk('perm-preset-apply');clk('perm-save');clk('user-new');});
    const a1=await pg.evaluate(()=>({u:JSON.stringify(ETERNA.USERS),l:ETERNA.auditRead().length}));
    ok(a1.u===a0.u&&a1.l===a0.l,'B1: carlos@ pelo DOM mudou USERS ou o histórico');
    const r1=await pg.evaluate(()=>{const E=ETERNA;const V=(a,d)=>{const U=Object.assign({},E.USERS);if(d)U[(d||a).email]=d;else delete U[a.email];return E.permValidate(E.state.user,a,d,U).motivo;};const m=E.USERS['marinara@eterna.photo'];
      return {desativar:V(m,Object.assign({},m,{active:false})),excluir:V(m,null),criar:E.permValidate(E.state.user,null,{email:'z@eterna.photo',perms:{},menu:[]},E.USERS).motivo,menu:V(m,Object.assign({},m,{menu:[]}))};});
    ok(Object.values(r1).every(x=>x==='sem_permissao'),'B1: permValidate deveria dar sem_permissao '+JSON.stringify(r1));
    await ctx.close();}
  // ---------- segurança 2, 5 e sugestões: login grava só lastLogin; e-mail inválido fora; storage null; Padrão = Início; sem acesso ----------
  {const {ctx,pg}=await nova(b);await entrar(pg,'eduardo@eduardorezende.com');
    await pg.evaluate(()=>{window.__db=[];ETERNA.state.db={doc:p=>({set:o=>window.__db.push([p,o])})};});
    await pg.click('#venue-sub [data-act="role-exit"]');await pg.fill('[data-act="login-email"]','carlos@eterna.photo');await pg.click('button[type=submit]');await pg.waitForTimeout(150);
    await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(300);
    const d2=await pg.evaluate(()=>window.__db.map(x=>x[0]));ok(d2.length===1&&d2[0]==='usuarios_login/'+encodeURIComponent('carlos@eterna.photo')&&!d2.some(p=>p.startsWith('usuarios/')),'S2: login deveria gravar só usuarios_login '+JSON.stringify(d2));
    await pg.evaluate(()=>{ETERNA.state.db=null;});
    const n0=await pg.evaluate(()=>Object.keys(ETERNA.USERS).length);
    await pg.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'eterna.users.v1',newValue:null})));ok(await pg.evaluate(()=>Object.keys(ETERNA.USERS).length)===n0&&await pg.evaluate(()=>!!ETERNA.state.user),'sugestão: storage com newValue null zerou os usuários');
    ok(await pg.evaluate(()=>{const u=JSON.parse(JSON.stringify(ETERNA.USERS['eduardo@eduardorezende.com']));u.inicio=null;return ETERNA.presetMatch(u);})==='admin','sugestão: Padrão e Início deveriam valer igual no perfil Admin');
    await semear(pg,()=>{let t=localStorage.getItem('eterna.users.v1');const fake=JSON.stringify({v:2,email:'__proto__',name:'Oculto',preset:'admin',perms:{},menu:[],active:true});t=t.replace(/^\{/,'{"__proto__":'+fake+',"x@eterna.photo":{"email":"y@eterna.photo","name":"Troca","preset":"admin","active":true},');localStorage.setItem('eterna.users.v1',t);});
    const r5=await pg.evaluate(()=>({keys:Object.keys(ETERNA.USERS).filter(k=>!/@/.test(k)||k==='x@eterna.photo'),proto:Object.getPrototypeOf(ETERNA.USERS)===Object.prototype}));ok(!r5.keys.length&&r5.proto,'S5: chave que não é e-mail deveria sair '+JSON.stringify(r5));
    // cadastro "sem acesso ainda": mensagem em vez de login ou Início vazio
    await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.click('[data-act="user-new"]');
    await pg.fill('[data-act="user-field"][data-k="name"]','Nova');await pg.fill('[data-act="user-field"][data-k="email"]','nova@eterna.photo');await pg.selectOption('[data-act="user-preset"]','custom');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(100);
    await entrar(pg,'nova@eterna.photo');ok(await pg.evaluate(()=>ETERNA.state.view)==='semacesso'&&/Seu acesso ainda não foi liberado\. Peça ao administrador\./.test(await pg.textContent('#main')),'sugestão: sem acesso deveria ver a mensagem: '+await pg.evaluate(()=>ETERNA.state.view));
    await pg.reload();await pg.waitForTimeout(400);ok(await pg.evaluate(()=>ETERNA.state.view)==='semacesso','sugestão: recarregar sem acesso abriu outra tela');
    await ctx.close();}
  // ---------- celular: cabeçalho fixo compacto e menu em gaveta (375×667 e 390×844) ----------
  for(const [w,h] of [[375,667],[390,844]]){const {ctx,pg}=await nova(b,w,h);await entrar(pg,'eduardo@eduardorezende.com');const t=`gaveta ${w}x${h}`;
    await pg.evaluate(()=>{ETERNA.state.view='usuarios';ETERNA.render();});await pg.evaluate(()=>window.scrollTo(0,500));await pg.waitForTimeout(150);
    const f0=await pg.evaluate(()=>{const r=document.querySelector('.rail').getBoundingClientRect();return {h:r.height,top:r.top,gav:getComputedStyle(document.querySelector('#railgav')).display,itens:[...document.querySelectorAll('#nav button')].filter(x=>x.getClientRects().length).length,exp:document.querySelector('#menu-btn').getAttribute('aria-expanded'),sw:document.documentElement.scrollWidth<=innerWidth,ck:!!document.querySelector('#rail-ck [data-act="loja-abrir"]').getClientRects().length};});
    ok(f0.h<=72&&f0.top<=1&&f0.gav==='none'&&!f0.itens&&f0.exp==='false'&&f0.sw&&f0.ck,`${t}: cabeçalho fechado ${JSON.stringify(f0)}`);
    await pg.screenshot({path:`${P}/v78-cel-gaveta-${w}-fechada.png`});
    await pg.click('#menu-btn');await pg.waitForTimeout(150);
    const f1=await pg.evaluate(()=>{const g=document.querySelector('#railgav');const vis=x=>!!x.getClientRects().length;return {exp:document.querySelector('#menu-btn').getAttribute('aria-expanded'),grupos:[...document.querySelectorAll('#nav .grp')].filter(vis).map(x=>x.textContent.trim()),atual:vis(document.querySelector('#nav [data-v="usuarios"]')),foco:g.contains(document.activeElement),sw:document.documentElement.scrollWidth<=innerWidth};});
    ok(f1.exp==='true'&&f1.grupos.length===5&&f1.atual&&f1.foco&&f1.sw,`${t}: gaveta aberta ${JSON.stringify(f1)}`);
    await pg.screenshot({path:`${P}/v78-cel-gaveta-${w}-aberta.png`});
    await pg.click('#nav .grp[data-g="Dashboard"]');await pg.click('#nav [data-v="painel"]');await pg.waitForTimeout(150);
    ok(await pg.evaluate(()=>ETERNA.state.view==='painel'&&!document.body.hasAttribute('data-drawer')&&getComputedStyle(document.querySelector('#railgav')).display==='none'),`${t}: tocar num item deveria navegar e fechar a gaveta`);
    await pg.click('#menu-btn');await pg.keyboard.press('Escape');await pg.waitForTimeout(100);
    ok(await pg.evaluate(()=>!document.body.hasAttribute('data-drawer')&&document.activeElement===document.querySelector('#menu-btn')),`${t}: Esc deveria fechar e devolver o foco ao Menu`);
    await pg.click('#menu-btn');await pg.mouse.click(w-15,h-60);await pg.waitForTimeout(100);
    ok(await pg.evaluate(()=>!document.body.hasAttribute('data-drawer')),`${t}: tocar fora deveria fechar a gaveta`);
    await ctx.close();}
  // desktop e tablet continuam com a barra lateral (sem botão Menu)
  {const {ctx,pg}=await nova(b,1024,1366);await entrar(pg,'eduardo@eduardorezende.com');const r=await pg.evaluate(()=>({menu:!!document.querySelector('#menu-btn').getClientRects().length,nav:!!document.querySelector('#nav .grp').getClientRects().length}));ok(!r.menu&&r.nav,'tablet: barra lateral sem botão Menu '+JSON.stringify(r));await ctx.close();}
  // ---------- 18: sem rolagem lateral, matriz em cards no celular ----------
  for(const [n,w,h] of [['cel',390,844],['tab',1024,1366],['desk',1440,900]]){const {ctx,pg}=await nova(b,w,h);await entrar(pg,'eduardo@eduardorezende.com');
    for(const v of ['permissoes','usuarios']){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);if(v==='permissoes')await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');else await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(150);
      const sw=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));ok(sw.sw<=sw.iw,`18: ${v} ${n} com rolagem lateral ${JSON.stringify(sw)}`);
      if(v==='permissoes'&&n==='cel')ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.perm-tbl thead')).display==='none'&&getComputedStyle(document.querySelector('.perm-row')).display==='block'),'18: matriz em cards no celular');
      await pg.screenshot({path:`${P}/permissoes-${v}-${n}.png`,fullPage:n!=='desk'});}
    await ctx.close();}
}catch(e){fails.push('erro: '+e.message.split('\n').filter(x=>x.trim()).slice(0,3).join(' / '));}
await b.close();const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} permissoes: critérios 1 a 20 e menus da v78${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})();
