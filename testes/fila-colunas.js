// Fila de impressão: a coluna verde só tem o que está pronto para retirar. Erro vai para a faixa de cima; cancelada não aparece.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const SHOT=process.env.SHOT;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const b=await chromium.launch();try{
  const A=await (await b.newContext({viewport:{width:1363,height:640}})).newPage();A.setDefaultTimeout(8000);A.on('pageerror',e=>errs.push(e.message));
  const agora=Date.now()/1000;const P=(id,venda,estado,feitas,fotos,erro)=>({id,venda,estado,feitas,fotos,erro:erro||'',posto:'Caixa 1',vendedor:'Ronaldo',criado:agora-600,inicio:agora-500,fim:agora-300,impressora:'DNP'});
  const pedidos=[P(1,'L0-001','impresso',2,2),P(2,'L0-002','impresso',4,4),P(3,'L0-003','erro',1,2,'FOTO a.jpg 22:35:07 ERRO b.jpg: saiu da fila'),P(4,'L0-004','cancelado',0,1),P(5,'L0-005','cancelado',1,2),P(6,'L0-006','erro',0,1,'ERRO c.jpg: sem papel'),P(7,'L0-006','impresso',1,1)];
  await A.route('**/impressao/fila*',r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({agora,pedidos,impressora:'DNP',impressoras:['DNP'],estados:{}})}));
  await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(500);
  await entrarTeste(A,'eduardo@eduardorezende.com');
  await A.evaluate(([agora,pedidos])=>{ETERNA.state.impFila={agora,pedidos,impressora:'DNP',impressoras:['DNP'],estados:{}};location.hash='#impfila';},[agora,pedidos]);await A.waitForTimeout(500);
  const v=await A.evaluate(()=>{const t=s=>[...document.querySelectorAll(s)].map(e=>e.textContent);const col=document.querySelector('.if-col.pronta');return {verde:t('.if-col.pronta .if-num'),vermelho:t('.if-erros .if-num'),tudo:document.querySelector('.if-wrap')?.textContent||'',estoura:col?col.scrollWidth>col.clientWidth+1:null,botao:t('.if-erros [data-a="faltantes"]')};});
  ok(JSON.stringify(v.verde.sort())===JSON.stringify(['L0-001','L0-002','L0-006']),'coluna verde: '+v.verde);
  ok(JSON.stringify(v.vermelho)===JSON.stringify(['L0-003']),'faixa de erro: '+v.vermelho);
  ok(!v.tudo.includes('L0-004')&&!v.tudo.includes('L0-005'),'cancelada no painel');
  ok(!/cancelad/i.test(v.tudo),'texto de cancelada no painel');
  ok(v.botao[0]==='Imprimir a que faltou','botão de faltante: '+v.botao);
  if(SHOT)await A.screenshot({path:SHOT});
  if(errs.length)fails.push('erros: '+errs.join(' | ').slice(0,300));
}catch(e){fails.push('exceção: '+e.message.slice(0,300));}await b.close();
if(fails.length){console.log('FALHA fila-colunas: '+fails.join(' · '));process.exit(1);}console.log('OK fila-colunas: verde só com prontas, erro na faixa, cancelada fora');})();
