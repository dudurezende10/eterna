// Prints do manual "Fotos do Tour: da foto à venda online". Telas de verdade do app no modo sem servidor (dados de demonstração,
// com fotos fictícias no lugar das de clientes): nada é gravado em servidor nenhum.
//   NODE_PATH=<node_modules com playwright> U=http://127.0.0.1:8890/index.html SPRITES=<pasta do sprites_ficticias.py> CAMERA=<silhueta .mjpeg> node capturar-fotos.js <pasta de saída>
const {chromium}=require('playwright');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const OUT=process.argv[2]||'prints-fotos';
const P=require('./print_tela')(OUT);const {usuario,shot,fotosFicticias}=P;
const E=require(path.join(__dirname,'..','..','..','testes','_entrar'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VENDA={venda:{c:true,r:true,u:true,d:false},quiosque:{c:true,r:true,u:true,d:false},catalogo:{c:false,r:true,u:false,d:false},filafoto:{c:false,r:true,u:false,d:false}};

(async()=>{const b=await chromium.launch({channel:process.env.CANAL||'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',...(process.env.CAMERA?['--use-file-for-fake-video-capture='+process.env.CAMERA]:[])]});
try{
  const ctx=await b.newContext({locale:'pt-BR',permissions:['camera']});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await fotosFicticias(ctx);
  // ---------------- notebook do vendedor: entrar e Posto de venda ----------------
  const V=await ctx.newPage();await V.setViewportSize({width:1366,height:768});await V.goto(U);
  await V.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await V.reload();await V.waitForTimeout(400);
  const VEND='carla.dias';await usuario(V,VEND,'Carla Dias',VENDA,'venda');
  await V.fill('[data-act="login-usuario"]',VEND);await V.fill('[data-act="login-senha"]','••••••••');
  await shot(V,'f01-entrar',[['[data-act="login-usuario"]','direita','1'],['[data-act="login-senha"]','direita','2'],['button[type=submit]','direita','3']],'button[type=submit]',230);
  await E(V,VEND);await V.waitForTimeout(400);
  const liga=pg=>pg.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;});await liga(V);
  await V.evaluate(()=>ETERNA.go('posto'));await V.waitForTimeout(500);
  await shot(V,'f02-posto',[['[data-act="loja-abrir"]','direita','1']],null);
  // ---------------- monitor do cliente: Checkout ----------------
  // Abrir Checkout: a janela do cliente (no posto ela vai sozinha para o monitor do cliente)
  const [L]=await Promise.all([ctx.waitForEvent('page'),V.click('[data-act="loja-abrir"]')]);await L.setViewportSize({width:1366,height:768});await L.waitForTimeout(1200);
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6&&s.status!=='paga').map(s=>s.card));
  await shot(L,'f03-iniciar',[['[data-act="kiosk-start"]','cima','1'],['[data-act="kiosk-emerg"]','baixo','2']],null);
  await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(300);await L.fill('#kcode',cards[0]);
  await shot(L,'f04-codigo',[['#kcode','cima','1'],['[data-act="kiosk-go"]','baixo','2']],null);
  await L.click('[data-act="kiosk-go"]');for(let i=0;i<30&&await L.evaluate(()=>ETERNA.state.kiosk.step)!=='review';i++)await sleep(100);await L.waitForTimeout(800);
  await shot(L,'f05-escolha',[['#lj-lb [data-act="kiosk-ok"]','cima','1'],['#lj-lb [data-act="kiosk-no"]','cima','2'],['#lj-lb [data-act="kiosk-ver"]','baixo','3']],null);
  for(let i=0;i<6;i++){await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(250);}
  await shot(L,'f06-continuar',[['#lj-lb .lj-next','cima','1']],null);
  await L.click('#lj-lb .lj-next');await L.waitForTimeout(700);
  await shot(L,'f07-pronto',[],null);
  const id=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
  // ---------------- Posto: pacote, pagamento, confirmar ----------------
  await V.bringToFront();await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(500);
  if(await V.$(`[data-act="pend-sel"][data-id="${id}"]`)){await V.click(`[data-act="pend-sel"][data-id="${id}"]`);await V.waitForTimeout(300);}
  const ideal=await V.evaluate(()=>ETERNA.lojaIdeal(6).pkg);
  await shot(V,'f08-pacote',[[`[data-act="pend-sel"][data-id="${id}"]`,'direita','1'],[`[data-act="pend-pkg"][data-p="${ideal}"]`,'cima','2']],null);
  await V.click(`[data-act="pend-pkg"][data-p="${ideal}"]`);await V.waitForTimeout(500);
  await shot(V,'f09-pagamento',[['[data-act="pend-meio"][data-m="cartao"]','cima','1']],null);
  await L.bringToFront();await L.waitForTimeout(400);await shot(L,'f10-valor',[],null);
  await V.bringToFront();await V.click('[data-act="pend-meio"][data-m="cartao"]');await V.waitForTimeout(500);
  await shot(V,'f11-confirmar',[['[data-act="pend-pos-ok"]','cima','1'],['[data-act="din-cancel"]','esquerda','2']],null);
  await V.click('[data-act="pend-pos-ok"]');await V.waitForTimeout(600);
  const tok=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.token);
  await L.bringToFront();for(let i=0;i<30;i++){if(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img')))break;await sleep(100);}await L.waitForTimeout(400);
  await shot(L,'f12-final',[['#lqr','esquerda','1']],null);
  // ---------------- Posto: imprimir, recibo e cancelar ----------------
  await V.bringToFront();await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(400);
  await shot(V,'f13-imprimir',[['[data-act="imp-print"]','cima','1']],null);
  await V.click('[data-act="imp-print"]').catch(()=>{});await V.waitForTimeout(1500);
  await shot(V,'f14-saiu',[['[data-act="imp-ok"]','cima','1'],['[data-act="imp-falha"]','cima','2']],null);
  if(await V.$('[data-act="imp-ok"]'))await V.click('[data-act="imp-ok"]');await V.waitForTimeout(500);
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(300);
  await shot(V,'f15-minhas',[['#minhas-vendas button:not([data-act="venda-cancel"])','cima','1'],['#minhas-vendas [data-act="venda-cancel"]','cima','2']],'.mv-det',40);
  if(await V.$('#minhas-vendas [data-act="venda-cancel"]')){await V.click('#minhas-vendas [data-act="venda-cancel"]');await V.waitForTimeout(300);await V.fill('#venda-canc-mot','Cliente desistiu');
    await shot(V,'f16-cancelar-venda',[['#venda-canc-mot','cima','1'],['[data-act="venda-cancel-ok"]','baixo','2']],'.mv-det',40);
    await V.click('.vc-conf [data-act="venda-cancel"]');await V.waitForTimeout(200);}
  // pedido que o cliente desistiu antes de pagar
  await L.bringToFront();await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.waitForTimeout(300);await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',cards[1]);await L.click('[data-act="kiosk-go"]');
  for(let i=0;i<30&&await L.evaluate(()=>ETERNA.state.kiosk.step)!=='review';i++)await sleep(100);await L.waitForTimeout(400);
  for(let i=0;i<2;i++){await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(200);}await L.click('#lj-lb .lj-next');await L.waitForTimeout(600);
  const id2=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
  await V.bringToFront();await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(400);await V.click(`[data-act="pend-sel"][data-id="${id2}"]`);await V.waitForTimeout(300);
  await V.click('[data-act="din-cancel"]');await V.waitForTimeout(300);
  await shot(V,'f17-cancelar-compra',[['[data-act="din-cancel-ok"]','cima','1']],null);
  await V.click('[data-act="din-cancel-ok"]');await V.waitForTimeout(400);
  // ---------------- celular do cliente: galeria do QR ----------------
  const G=await ctx.newPage();await G.setViewportSize({width:390,height:844});await G.goto(U+'#g/'+tok);
  await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});await G.waitForTimeout(800);
  await shot(G,'g01-abrir',[['[data-act="gq-dl"]','baixo','1'],['[data-act="gq-dlall"]','cima','2']],null);
  await G.evaluate(()=>{const e=document.querySelector('[data-act="gq-mais"]');if(e)e.scrollIntoView({block:'center'});});await G.waitForTimeout(200);
  await shot(G,'g01b-mais',[['[data-act="gq-mais"]','cima','1']],null);
  if(await G.$('[data-act="gq-mais"]')){await G.click('[data-act="gq-mais"]');await G.waitForTimeout(500);}
  await shot(G,'g01c-aceite',[['[data-act="gq-consent"]','cima','1'],['#gq-agree','cima','2']],null);
  if(await G.$('[data-act="gq-consent"]')){await G.check('[data-act="gq-consent"]');if(await G.locator('#gq-esc-email').count())await G.fill('#gq-esc-email','cliente@exemplo.com');await G.click('#gq-agree');}
  await G.waitForTimeout(1200);
  await shot(G,'g02-selfie',[],null);
  // a selfie acha as fotos dele (aqui marcadas à mão: as fotos fictícias não têm rosto)
  await G.evaluate(c=>{const p=ETERNA.pub;p.match=ETERNA.demoSessions().find(s=>s.card===c).photos.map(x=>x.id);p.step='galeria';ETERNA.render();},cards[0]);await G.waitForTimeout(1200);
  await G.evaluate(()=>{const e=document.querySelector('[data-act="gq-sel"]');if(e)e.scrollIntoView({block:'center'});});await G.waitForTimeout(300);
  await shot(G,'g03-comprar',[['[data-act="gq-sel"]','baixo','1']],null);
  if(await G.$('[data-act="gq-sel"]')){await G.click('[data-act="gq-sel"]');await G.waitForTimeout(400);}
  await shot(G,'g03b-levar',[['[data-act="gq-buy"]','cima','1']],null);
  if(await G.$('[data-act="gq-buy"]')){await G.click('[data-act="gq-buy"]');await G.waitForTimeout(800);}
  await shot(G,'g04-pagar',[['[data-act="gq-pay"]','cima','1']],null);
  P.grava();
}catch(e){console.log('ERRO',e.stack||e);process.exitCode=1;}
finally{P.grava();await b.close();}})();
