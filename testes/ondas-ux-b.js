// v94-ux parte B: modo demonstração explícito, por computador (critérios B1 a B4 do plano docs/planos/2026-11-09-ondas-ux.md).
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(300);}
  await require('./_entrar')(pg,email);return pg.evaluate(()=>!!ETERNA.state.user);}
const SIMUL=['ing-start','imp-files','imp-mode','ing-reset'];
const botoes=pg=>pg.evaluate(s=>s.filter(a=>document.querySelector(`#main [data-act="${a}"]`)),SIMUL);
// dispara a ação como um clique de verdade, mesmo sem o botão na tela
const disparar=(pg,a)=>pg.evaluate(a=>{const b=document.createElement('button');b.dataset.act=a;b.style.display='none';document.body.appendChild(b);b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.remove();},a);
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.removeItem('eterna.demo.v1');localStorage.removeItem('eterna.users.log.v1');});
  // B1: Admin sem a chave não vê simulação
  ok(await entrar(pg,'eduardo@eduardorezende.com'),'login admin');
  await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(300);
  let bt=await botoes(pg);ok(!bt.length,'B1: sem a chave, botões de simulação no Upload: '+bt);
  ok(!(await pg.$('.demo-faixa')),'B1: sem a chave, sem faixa cinza');
  // B3: ing-start disparado sem a chave não cria sessão e avisa
  const n0=await pg.evaluate(()=>Object.keys(ETERNA.SIM.sessions).length);
  await disparar(pg,'ing-start');await pg.waitForTimeout(2500);
  const n1=await pg.evaluate(()=>Object.keys(ETERNA.SIM.sessions).length);const tst=await pg.textContent('#toast');
  ok(n0===n1&&!(await pg.evaluate(()=>ETERNA.state.ing.running)),'B3: ing-start sem a chave criou sessão ou começou a leva: '+n0+' → '+n1);
  ok(/Só no modo demonstração/.test(tst),'B3: toast "Só no modo demonstração": '+tst);
  await disparar(pg,'imp-mode');ok(/Só no modo demonstração/.test(await pg.textContent('#toast')),'B3: imp-mode também recusa');
  // liga pela Identidade
  await pg.evaluate(()=>ETERNA.go('identidade'));await pg.waitForTimeout(200);
  ok(!!(await pg.$('[data-act="demo-toggle"]')),'B1: Admin vê o interruptor na Identidade');
  await pg.click('[data-act="demo-toggle"]');await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>localStorage.getItem('eterna.demo.v1')==='1'),'B1: demo-toggle grava a chave');
  await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(300);
  bt=await botoes(pg);ok(bt.includes('ing-start')&&bt.includes('imp-files')&&bt.includes('imp-mode'),'B1: com a chave, os botões aparecem: '+bt);
  ok(/Modo demonstração/.test(await pg.textContent('.demo-faixa').catch(()=>'')),'B1: faixa cinza com a chave');
  await pg.click('[data-act="ing-start"]');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>ETERNA.state.ing.running),'B: com a chave, Simular leva começa');
  await pg.click('[data-act="ing-stop"]').catch(()=>{});
  // desliga: B4 duas linhas de auditoria
  await pg.evaluate(()=>ETERNA.go('identidade'));await pg.waitForTimeout(200);await pg.click('[data-act="demo-toggle"]');await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>localStorage.getItem('eterna.demo.v1')===null),'B: desligar apaga a chave');
  const lg=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(x=>x.acao==='modo_demo'));
  ok(lg.length===2&&lg.some(x=>x.mudancas[0].para===true)&&lg.some(x=>x.mudancas[0].para===false),'B4: 2 linhas modo_demo: '+JSON.stringify(lg.map(x=>x.mudancas)));
  // B2: Supervisora e Fotógrafo
  for(const em of ['supervisor@eterna.photo','carlos@eterna.photo']){
    ok(await entrar(pg,em),'login '+em);
    if(await pg.evaluate(()=>ETERNA.canView('identidade'))){await pg.evaluate(()=>ETERNA.go('identidade'));await pg.waitForTimeout(200);}
    ok(!(await pg.$('[data-act="demo-toggle"]')),'B2: '+em+' vê o interruptor');
    await disparar(pg,'demo-toggle');await pg.waitForTimeout(150);
    ok(await pg.evaluate(()=>localStorage.getItem('eterna.demo.v1')===null),'B2: '+em+' ligou a chave por dispatch');}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-b: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-b: modo demonstração (B1 a B4)');process.exit(0);
})();
