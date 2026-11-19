// 18/11 (Ronaldo, em atendimento): o cliente saiu da tela do Checkout (tempo parado ou Sair) e o caixa ainda está com ele.
// "Chamar de volta ao Checkout" no pedido marcado "saiu da tela" reabre o monitor na espera do pagamento daquele pedido.
const {chromium}=require('playwright');const login=require('./_login');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch();const errs=[],fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
try{
  const ctx=await b.newContext({locale:'pt-BR'});await ctx.addInitScript(()=>{Element.prototype.requestFullscreen=function(){return Promise.resolve();};});
  const nova=async(nome,vp)=>{const pg=await ctx.newPage();await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;};
  const L=await nova('checkout',{width:1920,height:1080});await L.goto(U+'#loja');await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
  const card=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8)[0].card);
  const V=await nova('posto',{width:1366,height:768});await login(V);await V.evaluate(()=>ETERNA.go('posto'));await V.waitForTimeout(400);
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);
  const id=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);ok(!!id,'pedido criado no Checkout');
  // o cliente fica parado na tela Pronto além do prazo: volta ao início e o pedido fica "saiu da tela"
  await L.evaluate(()=>{const k=ETERNA.state.kiosk;k.toque=0;k.prontoDesde=Date.now()-10*60e3;});
  for(let i=0;i<80;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}
  ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'),'parado além do prazo, o Checkout volta ao início');
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');ETERNA.render();});await V.waitForTimeout(300);
  const cb=`:not(.pend-row)[data-pend="${id}"] [data-act="pend-chamar"]`;const bt=await V.$(cb);
  ok(bt&&(await bt.innerText()).trim()==='Chamar de volta ao Checkout','o pedido que saiu da tela mostra "Chamar de volta ao Checkout"');
  // sem venda u, nada de botão
  const semU=await V.evaluate(sel=>{const u=ETERNA.state.user;const p0=u.perms.venda;u.perms.venda=Object.assign({},p0,{u:false});ETERNA.render();const b=!!document.querySelector(sel);u.perms.venda=p0;ETERNA.render();return b;},cb);
  ok(!semU,'sem venda u o botão não aparece');
  await V.click(cb);for(let i=0;i<80;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='done'))break;await sleep(100);}
  const ch=await L.evaluate(id=>{const k=ETERNA.state.kiosk;const r=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);return {step:k.step,pend:k.paid&&k.paid.pend,wait:!!(k.paid&&k.paid.wait),saiu:!!r.saiu,cham:!!r.chamar,est:r.estado};},id);
  ok(ch.step==='done'&&ch.pend===id&&ch.wait&&!ch.saiu&&ch.cham&&ch.est==='escolha','o monitor volta para a espera do mesmo pedido e o "saiu da tela" some: '+J(ch));
  const au=await V.evaluate(()=>ETERNA.auditRead().find(e=>e.acao==='checkout_chamar'));ok(au&&/^venda\//.test(au.alvo),'vai ao registro de auditoria: '+J(au));
  // o mesmo chamado não reabre de novo depois que o cliente sai outra vez
  await L.evaluate(()=>{const k=ETERNA.state.kiosk;k.toque=0;k.prontoDesde=Date.now()-10*60e3;});
  for(let i=0;i<80;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}await sleep(5600);
  ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'),'o chamado vale uma vez: saindo de novo, o Checkout fica no início');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA checkout-chamar: '+fails.join(' || '));process.exit(1);}
console.log('OK checkout-chamar: saiu da tela, o caixa chama de volta, o monitor reabre a espera do pedido, auditoria');process.exit(0);})();
