// v81: (1) imagens das bandeiras corrigidas e migração da lista salva; (2) só os 4 fundos de IA aprovados; (3) Abrir Checkout em janela à parte, admin continua logado
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const FIX=Object.assign(JSON.parse(fs.readFileSync(path.join(__dirname,'..','docs','bandeiras-correcao-2026-10-28.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(__dirname,'..','docs','bandeiras-web-2026-10-28.json'),'utf8'))); // v82: as 30 sem imagem passaram a ter URL da Wikimedia
const ignora=t=>/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(t);
async function A8(pg){
  await pg.goto(U+'#fundos-teste');await pg.waitForTimeout(400);
  const t0=await pg.evaluate(()=>({v:ETERNA.state.view,txt:document.querySelector('#main').innerText,btn:!!document.querySelector('[data-act="bg-ativar"][data-id="imprensa"]'),nav:!!document.querySelector('#nav [data-v="fundos-teste"]'),on:ETERNA.bgOn(),opts:ETERNA.bgOpts().map(o=>o.id)}));
  ok(t0.v==='fundos-teste'&&/Fundos em teste/i.test(t0.txt)&&/Sala de imprensa/.test(t0.txt)&&t0.btn,'8: Laboratório › Fundos em teste com a Sala de imprensa e Ativar: '+J({v:t0.v,btn:t0.btn}));
  ok(!t0.opts.includes('imprensa')&&!t0.on.includes('imprensa'),'8: fundo em teste aparece no Checkout: '+J(t0.opts));
  const ad=await pg.evaluate(()=>{const c=[...document.querySelectorAll('#main .bglab')].find(x=>/Voo de asa-delta/.test(x.innerText));return c?{btn:!!c.querySelector('[data-act="bg-ativar"]'),txt:/precisa de montagem especial/.test(c.innerText)}:null;});
  ok(ad&&!ad.btn&&ad.txt,'8: asa-delta (sem enquadramento) sem Ativar e com aviso: '+J(ad));
  ok(await pg.evaluate(()=>ETERNA.bgOf('campeao2').luz==='sol'&&ETERNA.state&&true),'6: campeao2 com luz de dia');
  await pg.click('[data-act="bg-ativar"][data-id="imprensa"]');await pg.waitForTimeout(200);
  const t1=await pg.evaluate(()=>({on:ETERNA.bgOn(),opts:ETERNA.bgOpts().map(o=>o.id),sim:ETERNA.SIM.bgAtivo,log:ETERNA.auditRead().filter(e=>e.acao==='fundo_ativado'&&e.alvo==='fundo:imprensa').length}));
  ok(t1.opts.includes('imprensa')&&t1.on.includes('imprensa')&&t1.sim.imprensa===true&&t1.log===1,'8: Ativar deveria pôr no Checkout e no histórico: '+J(t1));
  await pg.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>/Sala de imprensa/.test(document.querySelector('#main').innerText)),'8: ativado deveria aparecer em Fundos de IA');
  await pg.click('[data-act="bg-lab"][data-id="imprensa"]');await pg.waitForTimeout(200);
  const t2=await pg.evaluate(()=>({on:ETERNA.bgOn(),opts:ETERNA.bgOpts().map(o=>o.id),sim:ETERNA.SIM.bgAtivo,log:ETERNA.auditRead().filter(e=>e.acao==='fundo_laboratorio'&&e.alvo==='fundo:imprensa').length,txt:document.querySelector('#main').innerText}));
  ok(!t2.opts.includes('imprensa')&&!t2.on.includes('imprensa')&&!('imprensa' in t2.sim)&&t2.log===1&&!/Sala de imprensa/.test(t2.txt),'8: Mover para o Laboratório deveria tirar do Checkout: '+J({on:t2.on,sim:t2.sim,log:t2.log}));
  // 7: títulos dos grupos do menu: 12px, negrito, maiúsculo, quase branco no rail do Maracanã; item normal; sem quebra nem rolagem lateral
  for(const [w,h] of [[1440,900],[1280,800],[390,844]]){await pg.setViewportSize({width:w,height:h});await pg.waitForTimeout(150);
    if(w<=900)await pg.evaluate(()=>{const m=document.querySelector('#menu-btn');if(m&&m.offsetParent)m.click();});await pg.waitForTimeout(200);
    const g=await pg.evaluate(()=>{const gs=[...document.querySelectorAll('#nav button.grp')].filter(e=>e.offsetParent);const it=document.querySelector('#nav .navitems button:not(.grp)');const cs=e=>getComputedStyle(e);
      return {n:gs.length,fs:gs.map(e=>cs(e).fontSize),fw:gs.map(e=>cs(e).fontWeight),tt:gs.map(e=>cs(e).textTransform),cor:gs.map(e=>cs(e).color),quebra:gs.filter(e=>{const sp=e.querySelector('span');return sp&&sp.getClientRects().length>1||sp.offsetHeight>22;}).map(e=>e.innerText),itw:it?cs(it).fontWeight:null,sw:document.documentElement.scrollWidth<=innerWidth};});
    ok(g.n>=4&&g.fs.every(x=>x==='12px')&&g.fw.every(x=>+x>=700)&&g.tt.every(x=>x==='uppercase'),`7 ${w}: títulos do menu `+J(g));
    ok(g.cor.every(c=>c==='rgba(255, 255, 255, 0.92)'),`7 ${w}: cor dos títulos no Maracanã `+J(g.cor));ok(!g.quebra.length&&g.sw,`7 ${w}: título quebrou linha ou rolagem lateral `+J(g.quebra));ok(g.itw==null||+g.itw<700,`7 ${w}: item do grupo em negrito`);
    if(w<=900)await pg.evaluate(()=>{const m=document.querySelector('#menu-btn');if(m&&m.offsetParent)m.click();});}
  await pg.setViewportSize({width:1440,height:900});}
(async()=>{const b=await chromium.launch();
try{
  // ---------- 1. Bandeiras ----------
  {const ctx=await b.newContext({viewport:{width:1440,height:900}});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('1: '+e.message));
    await pg.goto(U);await pg.waitForTimeout(300);
    const r=await pg.evaluate(fx=>{const by=n=>ETERNA.FLAGS.find(x=>x[0]===n);const errado=Object.entries(fx).filter(([n,f])=>by(+n)[6]!==f).map(([n])=>n);
      return {eua:by(83)[6],euaJ:fx['83'],errado,i66:by(66)[6],i70:by(70)[6],i154:by(154)[6],n:ETERNA.FLAGS.length,fix:Object.keys(ETERNA.FLAG_FIX_V81).length};},FIX);
    ok(r.eua===r.euaJ&&r.eua,'1: ETERNA.FLAGS[83 EUA] deveria ser '+r.euaJ+': '+r.eua);ok(!r.errado.length,'1: itens do JSON sem o arquivo certo: '+r.errado.join(','));
    ok(r.n===155&&r.i66==='db295695a0554504b9c373c026fead14.jpg'&&r.i154==='5c4dfdbb8d0f4e67a7b1c7ab0a85d375.webp','1: itens fora do JSON mudaram: '+J(r));
    // SIM antiga: flagList com os arquivos velhos; item 83 com foto do usuário; item 84 editado com outro arquivo
    const antes=await pg.evaluate(()=>{const L=ETERNA.FLAGS.map(x=>[...x]);Object.entries(ETERNA.FLAG_FIX_V81).forEach(([n,[velho]])=>{const f=L.find(x=>x[0]===+n);if(f)f[6]=velho;});
      const f83=L.find(x=>x[0]===83);f83[7]='data:image/png;base64,FOTOUSUARIO';const f84=L.find(x=>x[0]===84);f84[6]='meu-arquivo.jpg';
      const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');s.flagList=L;s.caixaDin=s.caixaDin||[];s.catalogoV=2;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));localStorage.removeItem('eterna.flags.v');
      localStorage.removeItem('eterna.users.log.v1');return {velho83:f83[6]};});
    await pg.reload();await pg.waitForTimeout(400);
    const m=await pg.evaluate(fx=>{const L=JSON.parse(localStorage.getItem('eterna.sim.v1')).flagList;const by=n=>L.find(x=>x[0]===n);
      const errado=Object.entries(fx).filter(([n,f])=>+n!==84&&by(+n)[6]!==f).map(([n])=>n);
      const log=ETERNA.auditRead().filter(e=>e.acao==='migracao_v81_bandeiras');return {errado,f83:by(83),f84:by(84)[6],log:log.length,itens:log[0]&&log[0].itens.length,mv:localStorage.getItem('eterna.flags.v')};},FIX);
    ok(!m.errado.length,'1: migração deixou itens com arquivo velho: '+m.errado.join(','));ok(m.f83[6]===FIX['83']&&m.f83[7]==='data:image/png;base64,FOTOUSUARIO','1: item 83 com foto do usuário: '+J(m.f83.slice(6)));
    ok(m.f84==='meu-arquivo.jpg','1: item editado com outro arquivo não pode mudar: '+m.f84);ok(m.log===1&&(m.mv==='81'||m.mv==='82'),'1: histórico migracao_v81_bandeiras uma vez: '+J(m));
    // roda uma vez só: voltar um item ao arquivo velho e recarregar não refaz nem registra de novo
    await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));const f=s.flagList.find(x=>x[0]===83);f[6]=ETERNA.FLAG_FIX_V81['83'][0];localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
    await pg.reload();await pg.waitForTimeout(300);
    const u=await pg.evaluate(()=>({f:JSON.parse(localStorage.getItem('eterna.sim.v1')).flagList.find(x=>x[0]===83)[6],log:ETERNA.auditRead().filter(e=>e.acao==='migracao_v81_bandeiras').length}));
    ok(u.f===antes.velho83&&u.log===1,'1: migração rodou duas vezes: '+J(u));
    // tela de estoque: a miniatura do item 83 é a foto do usuário
    await login(pg);await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));s.flagList.find(x=>x[0]===83)[7]='data:image/png;base64,FOTOUSUARIO';localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
    await ctx.close();}
  // ---------- 2. Fundos de IA ----------
  {const ctx=await b.newContext({viewport:{width:1440,height:900}});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('2: '+e.message));
    await login(pg);
    const r=await pg.evaluate(()=>{const S=ETERNA.SIM;delete S.bgOn;const at=ETERNA.BGS.filter(b=>!b.inativo);
      return {ativos:at.map(b=>b.id),nomes:at.map(b=>b.name),files:at.map(b=>b.file),opts:ETERNA.bgOpts().map(o=>o.name),on:ETERNA.bgOn(),ai:ETERNA.aiBgs().map(b=>b.id),total:ETERNA.BGS.length,
        pb:ETERNA.bgOf('arq1950').mono,camp:ETERNA.bgOf('campeao2').fit,mir:ETERNA.bgOf('mirante').pos.cx,tun:ETERNA.bgOf('tunel').pos,tunFit:ETERNA.bgOf('tunel').fit,tunMono:ETERNA.bgOf('tunel').mono,arg:ETERNA.bgFor('campeao','x').id};});
    ok(J(r.ativos.sort())===J(['arq1950','campeao2','mirante','tunel']),'2: ativos deveriam ser 4: '+J(r.ativos));ok(r.total>=12,'2: fundos apagados em vez de ocultos');
    ok(J(r.opts.sort())===J(['Arquibancada 1950','Mirante ao pôr do sol','Noite de campeão','Saída do túnel']),'2: bgOpts: '+J(r.opts));ok(r.ai.length===4&&r.on.length===4,'2: aiBgs/bgOn: '+J([r.ai,r.on]));
    ok(r.files.every(f=>/bg-(campeao-v81|mirantesol|pb1950|tunel)\.jpg$/.test(f)),'2: arquivos novos: '+J(r.files));ok(r.pb==='pb','2: 1950 em preto e branco');ok(!r.camp.includes('inteiro'),'2: Campeão nunca corpo inteiro');ok(r.mir===.45,'2: Mirante centro 45%');ok(r.tun.cx===.5&&r.tun.top>=.25&&r.tun.base===1&&!r.tunFit.includes('inteiro')&&r.tunMono===false,'2: túnel: '+J([r.tun,r.tunFit]));
    ok(r.arg==='campeao2','2: variação Argentina oculta cai na Noite de campeão: '+r.arg);
    for(const f of ['bg-campeao-v81.jpg','bg-mirantesol.jpg','bg-pb1950.jpg','bg-tunel.jpg']){const x=await pg.evaluate(async f=>{const im=new Image();im.src='img/'+f;await im.decode().catch(()=>{});return Math.max(im.naturalWidth,im.naturalHeight);},f);ok(x===2400,'2: '+f+' deveria ter 2400 px: '+x);}
    await pg.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await pg.waitForTimeout(300);
    const t=await pg.evaluate(()=>({n:document.querySelectorAll('#main .bgs .bg').length,txt:document.querySelector('#main').innerText,rows:document.querySelectorAll('#main table tbody tr').length}));
    ok(!/Sala de imprensa|Maracanã à noite|Gramado 1950|Terraço|Colômbia|Argentina/.test(t.txt),'2: tela Fundos de IA mostra fundo oculto');ok(/Mirante ao pôr do sol/.test(t.txt)&&/Arquibancada 1950/.test(t.txt)&&/Saída do túnel/.test(t.txt),'2: tela Fundos de IA sem os aprovados');
    // ---------- 8. Fundos em teste (Laboratório): inativo não vai ao Checkout; Ativar põe; Mover tira ----------
    await A8(pg);
    await ctx.close();}
  // ---------- 3. Abrir Checkout em janela à parte ----------
  {const ctx=await b.newContext({viewport:{width:1440,height:900}});const A=await ctx.newPage();A.on('pageerror',e=>errs.push('3A: '+e.message));
    await login(A);await A.evaluate(()=>{const t=ETERNA.venueToday();ETERNA.state.range={from:t,to:t};ETERNA.state.view='vendas-lista';ETERNA.render();});await A.waitForTimeout(200);
    const v0=await A.evaluate(()=>({view:ETERNA.state.view,hash:location.hash,user:ETERNA.state.user&&ETERNA.state.user.email}));
    const [L]=await Promise.all([ctx.waitForEvent('page'),A.click('#rail-ck [data-act="loja-abrir"]')]);L.on('pageerror',e=>errs.push('3L: '+e.message));
    await L.waitForLoadState();await L.waitForTimeout(900);
    const l=await L.evaluate(()=>({hash:location.hash,rota:ETERNA.state.lojaRota,user:!!ETERNA.state.user,view:ETERNA.state.view,tab:sessionStorage.getItem('eterna.lojaTab'),name:window.name}));
    ok(l.hash==='#loja'&&l.rota&&l.view==='quiosque'&&!l.user&&l.tab==='1'&&l.name==='eterna-checkout','3: janela nova deveria estar em #loja sem login: '+J(l));
    const a1=await A.evaluate(()=>({view:ETERNA.state.view,hash:location.hash,user:ETERNA.state.user&&ETERNA.state.user.email,rota:ETERNA.state.lojaRota}));
    ok(a1.view===v0.view&&a1.user===v0.user&&!a1.rota&&a1.hash!=='#loja','3: aba do admin mudou: '+J([v0,a1]));
    // reabrir: reutiliza a mesma janela
    const n0=ctx.pages().length;await A.click('#rail-ck [data-act="loja-abrir"]');await A.waitForTimeout(500);ok(ctx.pages().length===n0,'3: segundo clique abriu outra janela: '+ctx.pages().length);
    // compra na janela do Checkout
    const card=await L.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=8&&(ETERNA.SIM.sessions[s.card]||{}).status!=='paga').card);
    await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(1500);
    for(const x of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await L.click(`[data-act="${x}"]`);
    await L.click('.lj-next');await L.waitForTimeout(400);await L.click('[data-act="loja-paym"][data-m="pix"]');await L.waitForTimeout(300);await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(800);
    const lp=await L.evaluate(c=>({st:(JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c]||{}).status,step:ETERNA.state.kiosk.step,user:!!ETERNA.state.user}),card);
    ok(lp.st==='paga'&&lp.step==='done'&&!lp.user,'3: compra na janela do Checkout: '+J(lp));
    await A.waitForTimeout(500);
    const a2=await A.evaluate(c=>({st:(ETERNA.SIM.sessions[c]||{}).status,view:ETERNA.state.view,user:ETERNA.state.user&&ETERNA.state.user.email,txt:document.querySelector('#main').innerText.includes(c)}),card);
    ok(a2.st==='paga','3: admin não recebeu a venda sem recarregar: '+J(a2));ok(a2.view==='vendas-lista'&&a2.user===v0.user,'3: admin perdeu a tela ou o login: '+J(a2));ok(a2.txt,'3: venda '+card+' não aparece na Lista de vendas do admin');
    for(const v of ['painel','caixa']){const e=await A.evaluate(v=>{try{ETERNA.state.view=v;ETERNA.render();return document.querySelector('#main').innerText.length>50;}catch(x){return 'erro '+x.message;}},v);ok(e===true,'3: '+v+' no admin: '+e);}
    // v81 final: Esc na janela do Checkout volta ao início do #loja, sem apagar o login do admin; a janela não fica ligada ao admin (opener)
    await L.keyboard.press('Escape');await L.waitForTimeout(300);
    const le=await L.evaluate(()=>({h:location.hash,rota:ETERNA.state.lojaRota,user:!!ETERNA.state.user,step:ETERNA.state.kiosk.step,login:!!document.querySelector('[data-act="login-email"]'),op:window.opener,s:!!localStorage.getItem('eterna.session')}));
    ok(le.h==='#loja'&&le.rota&&!le.user&&le.step==='code'&&!le.login&&le.op===null&&le.s,'3: Esc na janela do Checkout: '+J(le));
    // trocar o endereço na janela do Checkout (cliente digita #caixa, ou #painel) volta ao #loja sem apagar a sessão do admin
    for(const h of ['#caixa','#painel','']){await L.evaluate(h=>{location.hash=h;},h);await L.waitForTimeout(300);
      const lh=await L.evaluate(()=>({h:location.hash,rota:ETERNA.state.lojaRota,user:!!ETERNA.state.user,s:!!localStorage.getItem('eterna.session'),din:!!document.querySelector('[data-act="din-confirm"]')}));
      ok(lh.h==='#loja'&&lh.rota&&!lh.user&&lh.s&&!lh.din,'3: troca de endereço '+J(h)+' na janela do Checkout: '+J(lh));}
    await A.reload();await A.waitForTimeout(400);ok(await A.evaluate(()=>!!ETERNA.state.user),'3: admin deveria continuar logado depois de recarregar');
    await ctx.close();
    // popup bloqueado: toast e a aba não muda
    const c2=await b.newContext({viewport:{width:1440,height:900}});const B=await c2.newPage();B.on('pageerror',e=>errs.push('3B: '+e.message));await login(B);
    await B.evaluate(()=>{window.open=()=>null;ETERNA.state.view='vendas-lista';ETERNA.render();});await B.click('#rail-ck [data-act="loja-abrir"]');await B.waitForTimeout(250);
    const bl=await B.evaluate(()=>({view:ETERNA.state.view,rota:ETERNA.state.lojaRota,toast:(document.querySelector('#toast')||document.body).innerText}));
    ok(bl.view==='vendas-lista'&&!bl.rota&&/Libere janelas pop-up/.test(bl.toast),'3: popup bloqueado: '+J({view:bl.view,rota:bl.rota}));
    // lojaEquipeOn/lojaVoltarApp continuam no caminho antigo (go('quiosque') na mesma aba)
    const eq=await B.evaluate(()=>{ETERNA.go('quiosque');return {rota:ETERNA.state.lojaRota,user:!!ETERNA.state.user};});ok(eq.rota&&eq.user,'3: go(quiosque) na mesma aba ainda funciona: '+J(eq));
    await c2.close();}
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
await b.close();const fe=errs.filter(e=>!ignora(e));const okk=!fails.length&&!fe.length;
console.log(`${okk?'OK':'FALHA'} v81: bandeiras, 4 fundos de IA, Checkout em janela à parte${fails.length?' · '+fails.slice(0,10).join(' | '):''}${fe.length?' · erros: '+fe.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})();
