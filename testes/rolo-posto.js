// v96 (Eduardo, 10/11): "Registrar troca de rolo" à mão do caixa no Posto, no painel Impressão 10×15 e no Caixa.
// Caixa sem permissão de Estoque registra a troca do próprio posto; não registra a de outro; Cancelar não muda nada; contador volta a 700; auditLog rolo_troca.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
async function nova(b){const ctx=await b.newContext({viewport:{width:1366,height:1000}});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.reload();await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
const estoque=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')).stock);
const pôr=(pg,v)=>pg.evaluate(v=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));Object.assign(S.stock,v);localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();ETERNA.render();},v);
const audit=pg=>pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='rolo_troca'));
const toast=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent);
const injetar=(pg,act,extra)=>pg.evaluate(([a,x])=>{const bt=document.createElement('button');bt.dataset.act=a;Object.assign(bt.dataset,x||{});document.querySelector('#main').appendChild(bt);bt.click();},[act,extra]);
(async()=>{const b=await chromium.launch();
try{
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'loja@eterna.photo'),'caixa não entrou');
    const pr=await pg.evaluate(()=>({venda:ETERNA.can('venda','c'),estoque:ETERNA.can('estoque','u'),posto:ETERNA.canView('posto')}));ok(pr.venda&&!pr.estoque&&pr.posto,'o caixa do teste tem venda c, sem estoque u: '+J(pr));
    await pg.evaluate(()=>{localStorage.removeItem('eterna.users.log.v1');ETERNA.go('posto');});await pg.waitForTimeout(150);
    await pôr(pg,{'Caixa 1':25,'Caixa 2':30});
    // selo tocável e "Troquei o rolo" com o rolo baixo (um só, no cabeçalho)
    const ui=await pg.evaluate(()=>({selos:[...document.querySelectorAll('.rolo-selo')].map(x=>x.textContent),troquei:document.querySelectorAll('[data-act="rolo-troca"].rolo-troquei').length}));
    ok(ui.selos.length>=1&&ui.selos.every(t=>/Rolo: 25 de 700/.test(t))&&ui.troquei===1,'Posto: selo tocável e "Troquei o rolo" com o rolo baixo: '+J(ui));
    // cancelar não muda nada
    await pg.click('.posto-head .rolo-selo');await pg.waitForTimeout(100);
    const tx=await pg.evaluate(()=>(document.querySelector('.rolo-ask')||{}).innerText||'');
    ok(/Trocou o rolo da impressora deste posto\?/i.test(tx)&&/O contador volta para 700/.test(tx)&&/Sim, troquei/.test(tx)&&/Cancelar/.test(tx)&&!/—/.test(tx),'confirmação curta: '+tx.replace(/\s+/g,' '));
    ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.dataset.act==='rolo-troca-nao'),'a confirmação abre com o foco em Cancelar');
    await pg.click('.rolo-ask [data-act="rolo-troca-nao"]');await pg.waitForTimeout(100);
    let s=await estoque(pg);ok(s['Caixa 1']===25&&!(await pg.$('.rolo-ask'))&&!(await audit(pg)).length,'Cancelar não muda nada: '+J(s));
    await pg.click('.rolo-troquei');await pg.waitForTimeout(100);await pg.keyboard.press('Escape');await pg.waitForTimeout(100);
    s=await estoque(pg);ok(s['Caixa 1']===25&&!(await pg.$('.rolo-ask')),'Esc fecha sem mudar: '+J(s));
    // outro posto: recusado
    await pg.click('.rolo-troquei');await pg.waitForTimeout(100);
    await pg.evaluate(()=>{document.querySelector('.rolo-ask [data-act="rolo-troca-sim"]').dataset.posto='Caixa 2';});await pg.click('.rolo-ask [data-act="rolo-troca-sim"]');await pg.waitForTimeout(100);
    s=await estoque(pg);ok(s['Caixa 1']===25&&s['Caixa 2']===30&&!(await audit(pg)).length&&/vale só para Caixa 1/.test(await toast(pg)),'outro posto recusado: '+J(s)+' '+(await toast(pg)));
    // Estoque (stock-swap) segue fechado para quem não tem estoque u
    await injetar(pg,'stock-swap');await pg.waitForTimeout(100);s=await estoque(pg);ok(s['Caixa 1']===25,'stock-swap sem estoque u não troca: '+J(s));
    // Sim: contador volta a 700, log, auditLog
    await pg.click('.rolo-troquei');await pg.waitForTimeout(100);await pg.click('.rolo-ask [data-act="rolo-troca-sim"]');await pg.waitForTimeout(150);
    s=await estoque(pg);const a=await audit(pg);const lg=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')).log[0].t);
    ok(s['Caixa 1']===700&&s['Caixa 2']===30,'Sim: contador do próprio posto volta a 700: '+J(s));
    ok(a.length===1&&a[0].por==='loja@eterna.photo'&&a[0].posto==='Caixa 1'&&a[0].mudancas[0].de===25&&a[0].mudancas[0].para===700,'auditLog rolo_troca com quem, posto e valor anterior: '+J(a));
    ok(/Rolo trocado em Caixa 1/.test(lg)&&/Rolo de Caixa 1: 700/.test(await toast(pg)),'log e aviso da troca');
    ok(await pg.evaluate(()=>!document.querySelector('.rolo-troquei')&&/Rolo: 700 de 700/.test(document.querySelector('.posto-head').innerText)),'com o rolo cheio some o "Troquei o rolo"');
    // painel Impressão 10×15 e Caixa também têm o selo tocável
    await pôr(pg,{'Caixa 1':10});
    ok(await pg.evaluate(()=>!!document.querySelector('#imp-painel .rolo-selo')),'Impressão 10×15: selo tocável');
    await pg.click('#imp-painel .rolo-selo');await pg.waitForTimeout(100);ok(!!(await pg.$('.rolo-ask')),'Impressão 10×15: o selo abre a confirmação');await pg.click('.rolo-ask [data-act="rolo-troca-nao"]');
    await pg.evaluate(()=>ETERNA.go('caixa'));await pg.waitForTimeout(150);
    if(await pg.evaluate(()=>ETERNA.state.view==='caixa')){const c=await pg.evaluate(()=>({selo:!!document.querySelector('.head .rolo-selo'),troquei:!!document.querySelector('.head .rolo-troquei')}));ok(c.selo&&c.troquei,'Caixa: selo tocável e "Troquei o rolo": '+J(c));}
    await ctx.close();}
  // sem venda c: selo sem botão e a ação recusada
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'carlos@eterna.photo'),'carlos não entrou');
    await pôr(pg,{'Caixa 1':20});await injetar(pg,'rolo-troca-sim',{posto:'Caixa 1'});await pg.waitForTimeout(100);
    const s=await estoque(pg);ok(s['Caixa 1']===20,'sem venda c a troca é recusada: '+J(s));await ctx.close();}
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
await b.close();const ok2=!fails.length&&!errs.length;console.log(`${ok2?'OK':'FALHA'} rolo-posto: troca de rolo pelo caixa no próprio posto, outro posto recusado, Cancelar, 700, auditLog${fails.length?' · '+fails.slice(0,10).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok2?0:1);})();
