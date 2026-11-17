// 17/11 (Ronaldo): "+1 foto cortesia" na venda paga do Checkout. O cliente escolhe uma foto a mais; o atendente que pode dar cortesia
// registra o motivo e o que houve; o pacote é calculado com uma foto a menos; a confirmação grava quem deu, quanto valeu e quando.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{const ctx=await b.newContext({viewport:{width:1366,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(400);
  await entrarTeste(pg,'eduardo@eduardorezende.com');
  // A = 4 fotos (ganha a cortesia e paga 3), B = 1 foto (sem cortesia), C = 3 fotos (dá e retira)
  await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const ds=E.demoSessions().filter(s=>s.status!=='paga'&&s.status!=='aberta'&&s.photos.length>=6).sort((a,b)=>a.card<b.card?-1:1);
    const ped=(id,s,n,cod)=>({id,card:s.card,codigo:cod,criada:new Date().toISOString(),estado:'escolha',escolha:true,n,nSes:n,selected:s.photos.slice(0,n).map(p=>p.id),aiSel:[],fav:[],pkg:null,total:null,meio:null,canal:'checkout',iniciado:'aguardando',saleNo:'L0-9'+id.slice(-2)});
    S.caixaDin=[ped('L00-cort000a01',ds[0],4,'CORA-2345'),ped('L00-cort000b02',ds[1],1,'CORB-2345'),ped('L00-cort000c03',ds[2],3,'CORC-2345')];
    localStorage.setItem('eterna.sim.v1',JSON.stringify(S));E.simFresh();E.go('posto');});
  const A='L00-cort000a01',B='L00-cort000b02',C='L00-cort000c03';const P='';
  const sel=async id=>{const s=`[data-act="pend-sel"][data-id="${id}"]`;if(await pg.locator(s).count()){await pg.click(s);await pg.waitForTimeout(200);}};
  const R=id=>pg.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));return S.caixaDin.find(x=>x.id===id);},id);
  await sel(A);
  ok(await pg.locator(`${P}[data-act="pend-cort"][data-id="${A}"]`).count()===1,'1: "+1 foto cortesia" aparece no passo do pacote');
  await pg.click(`${P}[data-act="pend-cort"][data-id="${A}"]`);await pg.waitForTimeout(150);
  await pg.click(`${P}[data-act="pend-cort-ok"][data-id="${A}"]`);await pg.waitForTimeout(150);
  ok(!(await R(A)).cortFoto,'2: sem escrever o que houve, a cortesia não entra');
  await pg.selectOption('#pend-cort-mot','espera');await pg.fill('#pend-cort-nota','esperou 40 min pela impressão');
  await pg.click(`${P}[data-act="pend-cort-ok"][data-id="${A}"]`);await pg.waitForTimeout(200);
  let r=await R(A);
  ok(r.cortFoto&&r.cortFoto.motivo==='espera'&&r.cortFoto.por==='eduardo@eduardorezende.com'&&r.cortFoto.n===1&&r.cortFoto.em,'3: cortesia guardada com motivo, quem e quando: '+J(r.cortFoto));
  const zona=await pg.evaluate(id=>[...document.querySelectorAll(`[data-act="pend-pkg"][data-id="${id}"]`)].find(x=>x.textContent.includes('Zona Mista')).dataset.p,A);
  const esp=await pg.evaluate(z=>{const E=ETERNA;return {c3:E.vendaCalc(3,3,z),c4:E.vendaCalc(4,4,z)};},zona);
  await pg.click(`${P}[data-act="pend-pkg"][data-id="${A}"][data-p="${zona}"]`);await pg.waitForTimeout(200);
  r=await R(A);
  ok(r.total===esp.c3.total&&r.prints===esp.c3.prints+1&&r.cart.some(x=>x.id==='cort_foto'&&x.v===0),'4: o pacote cobra 3 fotos e a cortesia sai impressa, sem valor: '+J({total:r.total,prints:r.prints,cart:r.cart,esp:esp.c3.total}));
  ok(/Cortesia\s*1 foto cortesia/.test(await pg.locator(`[data-pend="${A}"]`).last().textContent()),'4: o resumo do pagamento diz que há 1 foto cortesia');
  await pg.click(`${P}[data-act="pend-meio"][data-id="${A}"][data-m="dinheiro"]`);await pg.waitForTimeout(200);
  await pg.click(`[data-act="din-confirm"][data-id="${A}"]`);await pg.waitForTimeout(400);
  const fim=await pg.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);return {r,s:S.sessions[r.card],log:(S.cortesiaLog||[])[0]};},A);
  const valor=esp.c4.total-esp.c3.total;
  ok(fim.r.estado==='confirmada'&&fim.s.status==='paga'&&fim.s.selected.length===4,'5: a venda é confirmada com as 4 fotos escolhidas');
  ok(fim.s.cortFoto&&fim.s.cortFoto.valor===valor&&fim.log&&fim.log.onde==='checkout'&&fim.log.valor===valor&&fim.log.por==='eduardo@eduardorezende.com'&&fim.log.venda===fim.s.saleNo&&fim.log.motivo==='espera',
    '6: registro de quem deu, quanto valeu ('+valor+') e quando, ligado à venda: '+J(fim.log));
  // B: com 1 foto não há o que dar (a cortesia é dentro da venda paga)
  await sel(B);
  ok(await pg.locator(`${P}[data-act="pend-cort"][data-id="${B}"]`).count()===0,'7: pedido de 1 foto não mostra a cortesia');
  // C: dar e retirar antes de confirmar
  await sel(C);await pg.click(`${P}[data-act="pend-cort"][data-id="${C}"]`);await pg.waitForTimeout(150);
  await pg.fill('#pend-cort-nota','foto saiu tremida');await pg.click(`${P}[data-act="pend-cort-ok"][data-id="${C}"]`);await pg.waitForTimeout(200);
  ok(!!(await R(C)).cortFoto,'8: cortesia dada no pedido C');
  await pg.click(`${P}[data-act="pend-cort-rm"][data-id="${C}"]`);await pg.waitForTimeout(200);
  ok(!(await R(C)).cortFoto,'8: e retirada antes de confirmar');
  // aba Cortesias: a do Checkout com venda e valor
  await pg.evaluate(()=>{ETERNA.state.gal=ETERNA.state.gal||{};ETERNA.state.gal.tab='cortesias';ETERNA.go('galerias');});await pg.waitForTimeout(300);
  const t=(await pg.textContent('#main')).replace(/\s+/g,' ');
  ok(/1 foto cortesia/.test(t)&&/Espera longa/.test(t)&&/esperou 40 min/.test(t)&&new RegExp('R\\$\\s?'+valor).test(t),'9: aba Cortesias mostra a do Checkout com motivo, nota e valor');
  const falta=await pg.evaluate(()=>['po_cort_mais1','po_cort_foto','po_cort_dar','po_cort_retirar','po_cort_dada','po_cort_retirada','ga_valor'].filter(k=>{const a=ETERNA.EQ[k];return !a||a.length<5||a.some(x=>!x);}));
  ok(!falta.length,'10: textos nos 5 idiomas: '+J(falta));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA cortesia-checkout: '+fails.join(' || '));process.exit(1);}
console.log('OK cortesia-checkout: +1 foto cortesia na venda paga, com motivo, quem, quanto e quando');process.exit(0);
})();
