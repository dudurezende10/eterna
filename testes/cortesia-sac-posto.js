// 18/11 (Ronaldo): a Cortesia SAC volta no mesmo lugar do antigo botão da Venda manual (rodapé do Posto), fácil de achar;
// o bloco abre já como cortesia: ao escolher a sessão, a Cortesia SAC entra no lugar do pacote e o pagamento pede só o motivo.
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
  await A.evaluate(()=>{ETERNA.go('posto');});await A.waitForTimeout(300);
  const bt=A.locator('.posto-rodape [data-act="posto-cortesia"]');
  ok(await bt.count()===1&&await bt.isVisible(),'botão Cortesia no rodapé do Posto');
  await bt.click();await A.waitForTimeout(250);
  ok(await A.locator('#posto-manual.posto-cortesia').count()===1,'abre o bloco já como Cortesia');
  ok(await A.locator('.posto-rodape [data-act="posto-cortesia"]').count()===0,'com o bloco aberto o botão some');
  const card=await A.evaluate(()=>{const s=ETERNA.demoSessions().find(s=>s.photos.length>=3&&s.status!=='paga'&&!ETERNA.SIM.sessions[s.card]);return s&&s.card;});
  await A.evaluate(c=>{const sim=ETERNA.simOf(c);sim.cart=[{id:'arq'}];ETERNA.saveSim();},card);
  await A.fill('#ck-code',card);await A.waitForTimeout(200);
  await A.click(`[data-act="checkout-pick"][data-card="${card}"]`);await A.waitForTimeout(250);
  const cart=await A.evaluate(c=>ETERNA.SIM.sessions[c].cart.map(x=>x.id),card);
  ok(J(cart)===J(['cort_sac']),'ao escolher a sessão, a Cortesia SAC entra no lugar do pacote: '+J(cart));
  await A.click('[data-act="checkout-step"][data-s="3"]');await A.waitForTimeout(200);
  ok(await A.locator('#cort-mot').count()===1,'pagamento pede o motivo da cortesia');
  await A.click('[data-act="posto-manual-fechar"]');await A.waitForTimeout(200);
  await A.evaluate(()=>{ETERNA.go('posto');});await A.waitForTimeout(200);
  ok(await A.locator('.posto-rodape [data-act="posto-cortesia"]').count()===1&&!(await A.evaluate(()=>ETERNA.state.posto.cortesia)),'fechar volta o botão e sai do modo cortesia');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA cortesia-sac-posto: '+fails.join(' || '));process.exit(1);}
console.log('OK cortesia-sac-posto: botão no rodapé do Posto, bloco já como cortesia, Cortesia SAC no lugar do pacote, motivo no pagamento');process.exit(0);
})();
