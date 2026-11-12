// v99.24: lotes de cartões com QR pelo servidor. Configurações › Preços e Checkout › Avançado: a lista dos lotes, um lote na gráfica
// por vez (o botão passa a baixar o mesmo arquivo), Marcar recebido e Cancelar lote; e a página do cliente aceita o código de 12 letras.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1100,height:1200},acceptDownloads:true});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  let lotes=[],posts=[];const csv='token;codigo;qr\nAbcdefghijklmnopqrstuv;ABCD-EFGH-JKLM;https://eterna.photo/#g/Abcdefghijklmnopqrstuv';
  await ctx.route(/\/ativ\/cartoes$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,lotes,max:10000})}));
  await ctx.route(/\/ativ\/cartoes\/lote$/,r=>{const c=JSON.parse(r.request().postData());posts.push(['lote',c]);let l=lotes.find(x=>x.situacao==='grafica');const novo=!l;
    if(!l){l={id:'L20261112-180000',n:c.n,em:'2026-11-12T18:00:00',por:'adm',situacao:'grafica',mudou_em:null,mudou_por:null,baixado_n:0,usados:0};lotes.unshift(l);}l.baixado_n++;
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,lote:l.id,novo,n:l.n,csv,lotes})});});
  await ctx.route(/\/ativ\/cartoes\/situacao$/,r=>{const c=JSON.parse(r.request().postData());posts.push(['sit',c]);const l=lotes.find(x=>x.id===c.lote);Object.assign(l,{situacao:c.situacao,mudou_em:'2026-11-12T19:00:00',mudou_por:'adm'});
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,lotes})});});
  await ctx.route(/\/g\/codigo\//,r=>r.fulfill({status:/ABCD-EFGH-JKLM$/.test(r.request().url())?200:404,contentType:'application/json',body:J({token:'Abcdefghijklmnopqrstuv'})}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));A.on('dialog',d=>d.accept());
  await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;s.catTab='avancado';ETERNA.go('catalogo');});await A.waitForTimeout(800);
  const txt=async s=>(await A.textContent(s))||'';
  ok(await A.$('#cartao-n')&&!(await A.$('[data-cartao-lotes]')),'sem lote: campo de quantidade e nenhuma tabela');
  await A.fill('#cartao-n','3000');
  const [d1]=await Promise.all([A.waitForEvent('download'),A.click('[data-act="cartao-lote"]')]);await A.waitForTimeout(400);
  ok(d1.suggestedFilename()==='cartoes-qr-L20261112-180000-3000.csv'&&posts[0][1].n===3000,'gera o lote pelo servidor e baixa: '+d1.suggestedFilename());
  ok(!(await A.$('#cartao-n'))&&await A.$('[data-cartao-mesmo]')&&/Baixar de novo o lote na gráfica \(3000\)/.test(await txt('#main')),'com lote na gráfica: só baixar o mesmo de novo');
  ok(/Na gráfica/.test(await txt('[data-lote="L20261112-180000"]'))&&/1×/.test(await txt('[data-lote="L20261112-180000"]')),'tabela com o lote na gráfica e 1 download');
  const [d2]=await Promise.all([A.waitForEvent('download'),A.click('[data-act="cartao-lote"]')]);await A.waitForTimeout(400);
  ok(lotes.length===1&&lotes[0].baixado_n===2&&/2×/.test(await txt('[data-lote="L20261112-180000"]')),'clicar de novo não cria lote novo');
  await A.click('[data-act="cartao-situacao"][data-s="recebido"]');await A.waitForTimeout(400);
  ok(/Recebido/.test(await txt('[data-lote="L20261112-180000"]'))&&await A.$('#cartao-n'),'marcado recebido: pode gerar o próximo');
  await A.click('[data-act="cartao-situacao"][data-s="cancelado"]');await A.waitForTimeout(400);
  ok(/Cancelado/.test(await txt('[data-lote="L20261112-180000"]'))&&!(await A.$('[data-lote="L20261112-180000"] [data-act]')),'cancelado: sem mais ações');
  // página do cliente: código de 12 letras
  const P=await ctx.newPage();P.on('pageerror',e=>errs.push(e.message));await P.goto(U+'#g');await P.waitForSelector('#gq-code');
  ok(await P.$eval('#gq-code',x=>x.maxLength)===14,'campo do código aceita XXXX-XXXX-XXXX');
  await P.fill('#gq-code','abcdefghjklm');await P.click('[data-act="gq-code-go"]');await P.waitForTimeout(600);
  ok(P.url().endsWith('#g/Abcdefghijklmnopqrstuv'),'código de 12 letras (sem traços) abre o cartão: '+P.url());
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('OK cartoes_lote: lote pelo servidor, um na gráfica por vez, recebido e cancelado, código de 12 na página do cliente');})();
