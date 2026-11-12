// v100: Resumo das ativações (tela de celular do gestor): período dia/semana/mês, setas, data, Hoje, totais e quebras por pagamento,
// vendedor, serviço e país. Dados inventados servidos no lugar de /ativ/vendas.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const V=(id,tipo,dia,valor,pag,vend,pais,itens,videos)=>({origem:'antigo',id,tipo,dia,criado:dia+'T10:00:00',itens,valor,pagamento:pag,vendedor:vend,vendedor_n:null,pessoas:1,videos,pais,idioma:'Português'});
const DADOS=[V('drone-1','drone','2026-10-06',180,'PIX','Vendedora Um','Chile',[{produto:'asteroid',op:'Campo',qtd:1}],1),
  V('drone-2','drone','2026-10-06',250,'Crédito','Vendedor Dois','Brasil',[{produto:'inside_out',op:'Banco de Suplentes',qtd:1}],1),
  V('drone-3','drone','2026-10-07',120,'PIX','Vendedora Um','Chile',[{produto:'boomerang',op:'Arquibancada',qtd:1}],1),
  V('chute-1','chute','2026-10-06',110,'Débito','Vendedor Dois','Argentina',[{produto:'3 Chutes',op:'',qtd:1}],0)];
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pedidos=[];
  await ctx.route(/\/ativ\/vendas\?/,r=>{const u=new URL(r.request().url());const de=u.searchParams.get('de'),ate=u.searchParams.get('ate');pedidos.push(de+'|'+ate);
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,vendas:DADOS.filter(v=>v.dia>=de&&v.dia<=ate)})});});
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  // período
  const per=await A.evaluate(()=>{const s=ETERNA.state.ar,r={};s.dia='2026-10-08';s.per='semana';r.sem=ETERNA.arPeriodo();s.per='mes';r.mes=ETERNA.arPeriodo();s.dia='2026-02-10';r.fev=ETERNA.arPeriodo();s.per='dia';r.dia=ETERNA.arPeriodo();return r;});
  ok(J(per.sem)===J(['2026-10-05','2026-10-11'])&&J(per.mes)===J(['2026-10-01','2026-10-31'])&&J(per.fev)===J(['2026-02-01','2026-02-28'])&&J(per.dia)===J(['2026-02-10','2026-02-10']),'períodos: '+J(per));
  ok(await A.evaluate(()=>ETERNA.canView('ativ-resumo')&&ETERNA.userMenu?true:ETERNA.canView('ativ-resumo')),'admin vê o Resumo das ativações');
  // tela no dia 06/10, Drone
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;s.ar.dia='2026-10-06';s.ar.per='dia';s.ar.tipo='drone';ETERNA.go('ativ-resumo');});await A.waitForTimeout(500);
  const t1=await A.evaluate(()=>({tot:document.querySelector('#ar-total').textContent,pag:document.querySelector('#ar-pag').textContent,vend:document.querySelector('#ar-vend').textContent,serv:document.querySelector('#ar-serv').textContent,pais:document.querySelector('#ar-pais').textContent,larg:document.documentElement.scrollWidth}));
  ok(/R\$\s?430/.test(t1.tot)&&/Vendas\s*2/.test(t1.tot),'total do dia (Drone): '+t1.tot);
  ok(/PIX/.test(t1.pag)&&/Crédito/.test(t1.pag)&&!/Débito/.test(t1.pag),'por pagamento só do Drone: '+t1.pag);
  ok(/Vendedora Um/.test(t1.vend)&&/Vendedor Dois/.test(t1.vend)&&/Inside Out · Banco de Suplentes/i.test(t1.serv)&&/Chile/.test(t1.pais),'vendedor, serviço e país: '+J(t1));
  ok(t1.larg<=392,'cabe no celular sem rolar de lado: '+t1.larg);
  // todos os serviços
  await A.selectOption('[data-act="ar-tipo"]','todos');await A.waitForTimeout(150);
  ok(/R\$\s?540/.test(await A.textContent('#ar-total')),'todos os serviços no dia: '+await A.textContent('#ar-total'));
  // semana
  await A.click('[data-act="ar-per"][data-p="semana"]');await A.waitForTimeout(400);
  ok(/R\$\s?660/.test(await A.textContent('#ar-total'))&&pedidos.includes('2026-10-05|2026-10-11'),'semana: '+await A.textContent('#ar-total')+' '+J(pedidos));
  // seta para a semana anterior: sem vendas
  await A.click('[data-act="ar-mover"][data-n="-1"]');await A.waitForTimeout(400);
  ok(/R\$\s?0/.test(await A.textContent('#ar-total'))&&/Nenhuma venda/.test(await A.textContent('#ar-pag')),'semana anterior vazia');
  // data escolhida e Hoje
  await A.click('[data-act="ar-per"][data-p="dia"]');await A.fill('[data-act="ar-data"]','2026-10-07');await A.dispatchEvent('[data-act="ar-data"]','change');await A.waitForTimeout(400);
  ok(/R\$\s?120/.test(await A.textContent('#ar-total')),'data escolhida: '+await A.textContent('#ar-total'));
  await A.click('[data-act="ar-hoje"]');await A.waitForTimeout(300);
  ok(await A.evaluate(()=>ETERNA.state.ar.dia===ETERNA.venueToday()),'Hoje volta para o dia de hoje');
  // sem servidor
  await A.evaluate(()=>{const s=ETERNA.state;s.ar.cache={};s.ar.dia='2026-10-06';});await ctx.unroute(/\/ativ\/vendas\?/);await ctx.route(/\/ativ\/vendas\?/,r=>r.fulfill({status:500,body:'x'}));
  await A.evaluate(()=>ETERNA.arPull(true));await A.waitForTimeout(400);
  ok(/servidor do ponto/.test(await A.textContent('#main')),'aviso sem servidor');
  // idioma
  await A.evaluate(()=>ETERNA.idiomaEquipe('es'));await A.waitForTimeout(200);
  ok(/Resumen de activaciones/.test(await A.textContent('#main')),'tela em espanhol');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes_resumo: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes_resumo: períodos, totais, pagamento, vendedor, serviço, país, setas, data, Hoje, sem servidor e idioma');process.exit(0);
})();
