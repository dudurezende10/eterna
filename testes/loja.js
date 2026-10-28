// Loja de ponta a ponta: código do recibo → ✓/✗ → carrinho → pagamento → tela final; em 3 tamanhos e idiomas
const {chromium}=require('playwright');const login=require('./_login');const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];const fails=[];fs.mkdirSync(__dirname+'/prints',{recursive:true});
for(const [name,w,h,l] of [['desk',1440,900,'pt'],['tab',1024,1366,'en'],['cel',390,844,'de']]){
  const pg=await b.newPage({viewport:{width:w,height:h}});pg.on('pageerror',e=>errs.push(name+': '+e.message));
  await login(pg);await pg.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');ETERNA.state.view='quiosque';ETERNA.state.kiosk.full=true;ETERNA.render();});await pg.waitForTimeout(800);
  const card=await pg.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=8).card);
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(1500);
  for(const a of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await pg.click(`[data-act="${a}"]`);
  await pg.screenshot({path:`${__dirname}/prints/loja-${name}-fotos.png`});
  await pg.click('.lj-next');await pg.waitForTimeout(400);await pg.click(`[data-act="lang"][data-l="${l}"]`);await pg.click('[data-act="loja-paym"][data-m="pix"]');await pg.waitForTimeout(300);
  await pg.screenshot({path:`${__dirname}/prints/loja-${name}-pagamento.png`});
  await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(600);await pg.screenshot({path:`${__dirname}/prints/loja-${name}-pronto.png`});
  const r=await pg.evaluate(c=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c];return {status:s.status,pay:s.payment,sel:(s.selected||[]).length,step:ETERNA.state.kiosk.step};},card);
  if(r.status!=='paga'||r.sel!==3||r.step!=='done')fails.push(name+': '+JSON.stringify(r));
  await pg.close();}
await b.close();const ok=!fails.length&&!errs.length;console.log(`${ok?'OK':'FALHA'} loja: 3 tamanhos${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok?0:1);})();
