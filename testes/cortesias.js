// v99: cortesias no fluxo de venda (Cortesia SAC com motivo). v99.3: CORTESIA PORTA-RETRATO parada, sem o Porta-retrato no catálogo.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  await require('./_entrar')(A,'eduardo@eduardorezende.com');
  // catálogo: as duas cortesias, sem valor; Porta-retrato traz o brinde
  const ds=await A.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6&&s.status!=='paga'&&!ETERNA.SIM.sessions[s.card]).slice(0,2).map(s=>s.card));
  ok(ds.length===2,'duas sessões livres: '+J(ds));
  const abrir=async card=>{await A.evaluate(c=>{ETERNA.go('checkout');},card);await A.waitForTimeout(200);await A.evaluate(c=>{const k=ETERNA.state;k.checkout.session=c;k.checkout.step=2;k.fila.session=c;k.caixa.session=c;ETERNA.render();},card);await A.waitForTimeout(200);};
  const escolher=async n=>{for(let i=0;i<n;i++){await A.locator('[data-act="fila-sel"]').nth(i).click();await A.waitForTimeout(60);}};
  // 1) Cortesia SAC
  await abrir(ds[0]);await escolher(3);
  ok(await A.$('[data-act="fila-add"][data-id="cort_sac"]')!==null,'botão Cortesia SAC na Venda manual');
  ok(await A.$('[data-act="fila-add"][data-id="cort_porta"]')===null,'CORTESIA PORTA-RETRATO não tem botão');
  await A.click('[data-act="fila-add"][data-id="arq"]');await A.click('[data-act="fila-add"][data-id="cort_sac"]');await A.waitForTimeout(100);
  let cart=await A.evaluate(c=>ETERNA.SIM.sessions[c].cart.map(x=>x.id),ds[0]);ok(J(cart)===J(['cort_sac']),'Cortesia SAC ocupa o lugar do pacote: '+J(cart));
  await A.click('[data-act="checkout-step"][data-s="3"]');await A.waitForTimeout(150);
  ok(await A.$('#cort-mot')!==null&&await A.$('[data-act="caixa-pay"]')===null,'pagamento vira motivo da cortesia');
  ok(/Registrar cortesia e imprimir/.test(await A.textContent('[data-act="caixa-confirm"]')),'botão Registrar cortesia');
  await A.click('[data-act="caixa-confirm"]');await A.waitForTimeout(150);
  ok(await A.evaluate(c=>ETERNA.SIM.sessions[c].status,ds[0])!=='paga','sem o que aconteceu não registra');
  await A.selectOption('#cort-mot','espera');await A.fill('#cort-nota','esperou 40 min pela impressão');await A.click('[data-act="caixa-confirm"]');await A.waitForTimeout(400);
  const r1=await A.evaluate(c=>{const s=ETERNA.SIM.sessions[c];const tok=ETERNA.galDaSessao(c);const g=tok&&ETERNA.SIM.galerias[tok];return {st:s.status,pay:s.payment,total:s.total,prints:s.prints,cort:s.cortesia,dir:g?g.fotos.filter(f=>f.direito!=='venda').map(f=>f.direito):null,rec:(document.querySelector('.receipt')||{}).textContent||''};},ds[0]);
  ok(r1.st==='paga'&&r1.pay==='Cortesia'&&r1.total===0&&r1.prints===3,'Cortesia SAC registrada: '+J(r1));
  ok(r1.cort&&r1.cort.motivo==='espera'&&/40 min/.test(r1.cort.nota)&&r1.cort.por,'motivo, nota e quem: '+J(r1.cort));
  ok(r1.dir&&r1.dir.length===3&&r1.dir.every(d=>d==='cortesia'),'galeria: 3 fotos digitais como cortesia: '+J(r1.dir));
  ok(/Cortesia SAC/.test(r1.rec)&&/Pagamento: Cortesia/.test(r1.rec),'recibo da cortesia: '+r1.rec.slice(0,200));
  // 2) v99.3: sem o produto Porta-retrato no catálogo, a CORTESIA PORTA-RETRATO fica parada (não entra sozinha em venda nenhuma)
  await abrir(ds[1]);await escolher(1);
  ok(await A.$('[data-act="fila-add"][data-id="porta"]')===null,'Porta-retrato fora do catálogo (v99.3)');
  await A.click('[data-act="fila-add"][data-id="arq"]');await A.waitForTimeout(100);
  await A.click('[data-act="checkout-step"][data-s="3"]');await A.waitForTimeout(150);await A.click('[data-act="caixa-pay"][data-m="PIX"]');await A.click('[data-act="caixa-confirm"]');await A.waitForTimeout(400);
  const r2=await A.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {st:s.status,cart:s.cart.map(x=>x.id+':'+x.v),total:s.total,prints:s.prints};},ds[1]);
  ok(r2.st==='paga'&&J(r2.cart)===J(['arq:70'])&&r2.total===70&&r2.prints===1,'venda normal sem cortesia do porta-retrato: '+J(r2));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA cortesias: '+fails.join(' || '));process.exit(1);}
console.log('OK cortesias: Cortesia SAC; CORTESIA PORTA-RETRATO parada');process.exit(0);
})();
