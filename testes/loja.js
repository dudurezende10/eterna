// v96: Checkout sem pacote nem pagamento (o caixa escolhe no Posto). Loja de ponta a ponta na rota pública #loja (sem login, tela cheia): código do recibo → ✓/✗ → carrinho → pagamento → tela final (v83: PIX aguardando a maquininha); em 3 tamanhos e idiomas
const {chromium}=require('playwright');const fs=require('fs');
// v96: em tela estreita (390) as bandeiras ficam recolhidas no botão com a bandeira atual. O teste toca como o cliente: se a bandeira não está
// visível, toca no botão recolhido (.lj-lgbtn), confere que as bandeiras abriram e toca na bandeira (clique real do Playwright, sem .click() no DOM)
const idioma=async(pg,l)=>{const sel=`[data-act="lang"][data-l="${l}"]`;const r={recolhida:false,abriu:false};
  if(!(await pg.locator(sel).first().isVisible())){r.recolhida=true;const bt=pg.locator('.lj-lgbtn:visible').first();if(!(await bt.count()))return r;await bt.click();await pg.waitForTimeout(150);r.abriu=await pg.locator(sel).first().isVisible();if(!r.abriu)return r;}
  await pg.locator(sel).first().click();return r;};
(async()=>{const b=await chromium.launch();const errs=[];const fails=[];fs.mkdirSync(__dirname+'/prints',{recursive:true});
for(const [name,w,h,l] of [['desk',1440,900,'pt'],['tab',1024,1366,'en'],['cel',390,844,'de']]){
  const pg=await b.newPage({viewport:{width:w,height:h}});pg.on('pageerror',e=>errs.push(name+': '+e.message));
  await pg.goto((process.env.U||'http://127.0.0.1:8890/index.html')+'#loja');await pg.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await pg.reload();await pg.waitForTimeout(800);
  const card=await pg.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=8).card);
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(1500);
  for(const a of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await pg.click(`[data-act="${a}"]`);
  await pg.screenshot({path:`${__dirname}/prints/loja-${name}-fotos.png`});
  // v96: sem pacote e sem pagamento no Checkout; o Continuar manda a escolha ao atendente
  await pg.click('.lj-next');await pg.waitForTimeout(600);const lg=await idioma(pg,l);await pg.waitForTimeout(200);
  if(name==='cel'&&!(lg.recolhida&&lg.abriu))fails.push(name+': bandeiras deveriam estar recolhidas e abrir pelo botão: '+JSON.stringify(lg));await pg.screenshot({path:`${__dirname}/prints/loja-${name}-pronto.png`});
  // v96: o pedido fica aguardando o caixa escolher pacote e meio (sem valor, sem meio, sem QR e sem contagem)
  const r=await pg.evaluate(c=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[c];const p=S.caixaDin.find(x=>x.card===c&&(x.estado==='escolha'||x.estado==='aguardando'))||{};return {status:s.status,meio:p.meio,sel:(s.selected||[]).length,step:ETERNA.state.kiosk.step,wait:!!(ETERNA.state.kiosk.paid||{}).wait,qr:!!document.querySelector('#lqr'),volta:!!document.querySelector('#lj-volta-n'),user:!!ETERNA.state.user,sw:document.documentElement.scrollWidth<=innerWidth,nav:document.querySelector('#nav').offsetParent!==null,raw:/ljPos|ljPay|ljReady|ljYour/.test(document.body.innerText),preco:/R\$/.test(document.body.innerText),total:p.total,lang:ETERNA.state.lang};},card);
  if(r.lang!==l||r.preco||r.total!=null||r.status!=='aguardando'||r.meio!=null||r.sel!==3||r.step!=='done'||!r.wait||r.qr||r.volta||r.user||!r.sw||r.nav||r.raw)fails.push(name+': '+JSON.stringify(r));
  await pg.close();}
await b.close();const ok=!fails.length&&!errs.length;console.log(`${ok?'OK':'FALHA'} loja: 3 tamanhos${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok?0:1);})();
