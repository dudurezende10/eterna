// 18/11 (Ronaldo): cancelar venda de foto já paga. Vendedor: só as próprias vendas do dia, em Minhas vendas de hoje.
// Admin: qualquer venda, qualquer dia. A venda fica cancelada (não some), a impressão que não saiu para, o servidor recebe "cancelar",
// vai para a auditoria; o motivo é opcional.
const {chromium}=require('playwright');const login=require('./_login');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
(async()=>{const b=await chromium.launch();const errs=[],fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
try{
  const ctx=await b.newContext({locale:'pt-BR'});const pg=await ctx.newPage();await pg.setViewportSize({width:1366,height:900});pg.on('pageerror',e=>errs.push(e.message));
  await login(pg);await pg.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');});await pg.reload();await pg.waitForTimeout(600);
  const cards=await pg.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=3).slice(0,3).map(s=>s.card));
  // três vendas pagas: minha de hoje, minha de ontem e de outra pessoa hoje; o usuário vira vendedor (Venda criar, ver, alterar)
  const adm=await pg.evaluate(cards=>{const u=ETERNA.state.user;const hoje=new Date().toISOString(),ontem=new Date(Date.now()-86400e3).toISOString();
    const pagar=(c,quem,quando,no)=>{const s=ETERNA.simOf(c);Object.assign(s,{status:'paga',paidAt:quando,saleNo:no,vendaId:'L00-vc'+no,vendedor:{email:quem,nome:quem},total:90,payment:'PIX',cart:[{id:'gramado'}],selected:[],impressao:{estado:'pendente',alvo:2,feitas:[]}});};
    pagar(cards[0],u.email,hoje,'P1-001');pagar(cards[1],u.email,ontem,'P1-002');pagar(cards[2],'outra@exemplo.com',hoje,'P1-003');ETERNA.saveSim();
    const r=cards.map(c=>ETERNA.vendaPodeCancelar(c));
    ETERNA.state.user=Object.assign({},u,{perms:{venda:{c:true,r:true,u:true,d:false},quiosque:{c:true,r:true,u:true,d:false}}});return r;},cards);
  ok(J(adm)===J([true,true,true]),'Admin cancela qualquer venda, de qualquer dia: '+J(adm));
  const ven=await pg.evaluate(cards=>cards.map(c=>ETERNA.vendaPodeCancelar(c)),cards);
  ok(J(ven)===J([true,false,false]),'vendedor: só a própria venda de hoje: '+J(ven));
  await pg.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});await pg.waitForTimeout(300);
  ok(await pg.locator(`#minhas-vendas [data-act="venda-cancel"][data-card="${cards[0]}"]`).count()===1,'"Cancelar venda" em Minhas vendas de hoje');
  await pg.click(`#minhas-vendas [data-act="venda-cancel"][data-card="${cards[0]}"]`);await pg.waitForTimeout(150);
  ok(await pg.locator('#venda-canc-mot').count()===1&&(await pg.evaluate(c=>ETERNA.SIM.sessions[c].status,cards[0]))==='paga','pede confirmação antes de cancelar');
  await pg.fill('#venda-canc-mot','cliente desistiu');await pg.click(`[data-act="venda-cancel-ok"][data-card="${cards[0]}"]`);await pg.waitForTimeout(300);
  const r=await pg.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {st:s.status,mot:s.cancelada&&s.cancelada.motivo,imp:s.impressao.estado,ev:ETERNA.pvFila().some(e=>e.tipo==='cancelar'&&e.venda==='L00-vcP1-001'),au:ETERNA.auditRead().some(e=>e.acao==='venda_cancelada'&&e.alvo==='venda/P1-001')};},cards[0]);
  ok(r.st==='cancelada'&&r.mot==='cliente desistiu'&&r.imp==='cancelada'&&r.ev&&r.au,'cancelada, com motivo, impressão parada, servidor avisado e auditoria: '+J(r));
  ok(await pg.locator(`[data-act="venda-cancel"][data-card="${cards[0]}"]`).count()===0,'venda cancelada não oferece cancelar de novo');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA venda-cancelar: '+fails.join(' || '));process.exit(1);}
console.log('OK venda-cancelar: vendedor só a própria do dia, Admin qualquer uma, confirmação, impressão parada, servidor e auditoria');process.exit(0);
})();
