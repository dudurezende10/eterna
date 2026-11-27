// 26/11 (plano docs/planos/2026-11-26-procurar-vender.md, critérios 1 a 12): vender a partir do Procurar fotos. O vendedor marca as
// sessões na tela dele, "Iniciar venda com N sessões" abre o Checkout (janela #loja do mesmo computador, canal eterna-loja) só com as
// marcadas, unidas e inteiras; "Vender esta sessão" na sessão aberta; a venda leva origem "procurar"; auditoria procurar_vender.
// Agente falso e dados simulados (testes/_procurar_vender.js). PV_VER=1 mostra cada conferência.
const {chromium}=require('playwright');
const {U,J,C,F,ADMIN,FOTO,CAIXA,contexto,dupla,entrar,abrir,procurar,espera,chegou,semear,toque,marca,aviso,quiosque}=require('./_procurar_vender');
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.PV_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+String(m).slice(0,260));};
const ag=l=>l.map(p=>'ag_'+p);const igual=(a,b)=>a.slice().sort().join()===b.slice().sort().join();
(async()=>{const b=await chromium.launch();const errs=[];
try{
  // ---------- 1: quem vê Marcar ----------
  {const x=await contexto(b);errs.push(x.errs);const pg=await x.pagina('fotografo');ok(await entrar(pg,FOTO),'login do fotógrafo de teste');await procurar(pg,5);
    const r=await pg.evaluate(()=>({tela:!!document.querySelector('#bf-lista .bf-card'),marca:document.querySelectorAll('.bf-marca,.bf-mk,#bf-barra').length,pode:ETERNA.bfPodeVender(),g1:ETERNA.guardAct('bf-vender'),g2:ETERNA.guardAct('bf-vender-uma')}));
    ok(r.tela&&r.marca===0&&r.pode===false&&r.g1===false&&r.g2===false,'1: fotógrafo sem venda vê a tela sem Marcar e as ações são barradas: '+J(r));
    await pg.evaluate(c=>ETERNA.bfMarca(c),C.A);ok(await pg.evaluate(()=>ETERNA.state.procurar.sel.length)===0,'1: bfMarca não marca para quem não vende');
    await x.ctx.close();}
  {const x=await contexto(b);errs.push(x.errs);const pg=await x.pagina('admin');ok(await entrar(pg,ADMIN),'login do Admin de teste');await chegou(pg);await procurar(pg);
    ok(await pg.evaluate(()=>document.querySelectorAll('#bf-lista .bf-marca').length>0&&ETERNA.bfPodeVender()),'1: quem tem venda em Criar vê Marcar nos cartões');
    const r=await pg.evaluate(()=>{ETERNA.state.assumido={por:'admin.teste@exemplo.com',em:new Date().toISOString()};ETERNA.render();
      const o={marca:document.querySelectorAll('.bf-marca,#bf-barra').length,pode:ETERNA.bfPodeVender(),g:ETERNA.guardAct('bf-vender')};ETERNA.state.assumido=null;ETERNA.render();return o;});
    ok(r.marca===0&&r.pode===false&&r.g===false,'1: em "ver como" não há Marcar e a ação é barrada: '+J(r));
    // 3 (parte): sair da tela e trocar de pessoa zeram a seleção
    await marca(pg,C.A);ok(await pg.evaluate(()=>ETERNA.state.procurar.sel.length)===1,'marcou uma');
    await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(250);await pg.evaluate(()=>ETERNA.go('procurar'));await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>ETERNA.state.procurar.sel.length===0&&!document.querySelector('.bf-marca[aria-pressed="true"]')&&document.querySelector('#bf-barra').hidden),'3: sair da tela zera a seleção');
    await marca(pg,C.A);await pg.evaluate(()=>ETERNA.logout());await pg.waitForTimeout(700);ok(await pg.evaluate(()=>!ETERNA.state.user&&ETERNA.state.procurar.sel.length===0),'3: sair da conta zera a seleção');
    await x.ctx.close();}
  // ---------- 12: chave desligada ----------
  {const x=await contexto(b,{troca:h=>h.replace('const PROCURAR_VENDER_ON=true;','const PROCURAR_VENDER_ON=false;')});errs.push(x.errs);const pg=await x.pagina('chave');ok(await entrar(pg,CAIXA),'login com a chave desligada');await chegou(pg);await procurar(pg);
    const r=await pg.evaluate(()=>({tela:document.querySelectorAll('#bf-lista .bf-card').length,novo:document.querySelectorAll('.bf-marca,.bf-mk,#bf-barra,[data-act="bf-vender"],[data-act="bf-vender-uma"]').length,pode:ETERNA.bfPodeVender()}));
    ok(r.tela>0&&r.novo===0&&r.pode===false,'12: com PROCURAR_VENDER_ON=false a lista fica como antes: '+J(r));
    await toque(pg,'#bf-lista .bf-card[data-card="'+C.A+'"] .bf-abre');await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>!!document.querySelector('.bf-sess')&&!document.querySelector('.bf-sv,.bf-marca,#bf-barra')),'12: e a sessão aberta também');
    const L=await x.pagina('checkout-chave');await L.goto(U+'#loja');await L.waitForTimeout(500);await chegou(L);
    const tab=await L.evaluate(()=>ETERNA.ecoTab());await pg.evaluate(([tab,c])=>window.__ch.postMessage({tipo:'abrir',id:'abcdefabcdef',para:tab,cards:[c],origem:'procurar',em:Date.now()}),[tab,C.A]);await L.waitForTimeout(500);
    ok((await quiosque(L)).step==='code','12: com a chave desligada o Checkout ignora o pedido');
    await x.ctx.close();}
  // ---------- vendedor e Checkout no mesmo computador ----------
  const x=await dupla(b);errs.push(x.errs);const {V,L,EVENTOS}=x;
  // 6 (preparo): uma visita liga a sessão A (que será marcada) à B (que não será)
  await V.evaluate(C=>{ETERNA.SIM.visitas={rev:1,levas:{[C.A]:[C.A,C.B],[C.B]:[C.A,C.B]}};ETERNA.saveSim();},C);
  ok(await espera(L,C=>ETERNA.visitaDe(C.A).join()===[C.A,C.B].join(),8000,C),'6: no Checkout a visita liga A e B (o código do recibo abriria as duas)');
  ok(await procurar(V),'a lista do vendedor tem as 9 sessões');
  // ---------- 4: estados que desligam a caixa, em palavras ----------
  ok(await espera(V,c=>{const m=document.querySelector('#bf-lista .bf-mk[data-card="'+c+'"]');return m&&m.dataset.est==='paga';},10000,C.FORA),'4: a venda de outro posto chega pelo servidor e desliga a caixa sem redesenhar');
  {const r=await V.evaluate(C=>{const de=c=>{const k=document.querySelector('#bf-lista .bf-card[data-card="'+c+'"]');const b=k.querySelector('.bf-marca');return {dis:b.disabled,est:k.querySelector('.bf-mk').dataset.est,txt:k.textContent.replace(/\s+/g,' ')};};
      return {ab:de(C.ABERTA),pg:de(C.PAGA),pe:de(C.PEDIDO),fo:de(C.FORA),me:de(C.MENOR),a:de(C.A)};},C);
    ok(r.ab.dis&&r.ab.est==='aberta'&&/entra quando fechar \(até 1 min\)/.test(r.ab.txt),'4: aberta: caixa desligada e o prazo vem da pausa do servidor: '+J(r.ab));
    ok(r.pg.dis&&/Já vendida/.test(r.pg.txt)&&(r.pg.txt.match(/Já vendida/g)||[]).length===1,'4: paga: '+J(r.pg));
    ok(r.pe.dis&&/Pedido em aberto/.test(r.pe.txt),'4: com pedido: '+J(r.pe));
    ok(r.fo.dis&&/Já vendida/.test(r.fo.txt),'4: vendida em outro posto: '+J(r.fo));
    ok(r.me.dis&&/Sessão protegida/.test(r.me.txt),'4: menor: '+J(r.me));
    ok(!r.a.dis&&r.a.est===''&&/Marcar/.test(r.a.txt),'4: livre: caixa ligada: '+J(r.a));
}
  await V.evaluate(c=>ETERNA.bfMarca(c),C.MENOR);ok(await V.evaluate(()=>ETERNA.state.procurar.sel.length)===0&&/protegida/.test(await aviso(V)),'4: marcar à força uma sessão de menor é recusado com o motivo');
  // ---------- 2: marcar não redesenha a lista ----------
  await V.setViewportSize({width:1366,height:420});await V.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='1';document.querySelector('#bf-lista .bf-card').dataset.marca='1';window.scrollTo(0,160);});await V.waitForTimeout(150);
  const y0=await V.evaluate(()=>Math.round(scrollY));
  await marca(V,C.A);await marca(V,C.C);
  {const r=await V.evaluate(C=>({m1:document.querySelector('#bf-lista').dataset.marca,m2:document.querySelector('#bf-lista .bf-card').dataset.marca,y:Math.round(scrollY),sel:ETERNA.state.procurar.sel.slice(),
      pa:document.querySelector('#bf-lista .bf-mk[data-card="'+C.A+'"] .bf-marca').getAttribute('aria-pressed'),ta:document.querySelector('#bf-lista .bf-mk[data-card="'+C.A+'"] .bf-marca').textContent,
      bt:(document.querySelector('#bf-barra [data-act="bf-vender"]')||{}).textContent,n:(document.querySelector('#bf-barra-n')||{}).textContent,minis:[...document.querySelectorAll('#bf-barra .bf-bmini')].map(m=>m.dataset.card),inteiras:(document.querySelector('.bf-inteiras')||{}).textContent,
      vis:(()=>{const q=document.querySelector('#bf-barra').getBoundingClientRect();return q.bottom<=innerHeight+1&&q.height>0;})()}),C);
    ok(r.m1==='1'&&r.m2==='1'&&r.y===y0&&y0>0,'2: marcar não redesenha a lista (mesmos nós, mesma rolagem): '+J({m1:r.m1,m2:r.m2,y:r.y,y0}));
    ok(r.bt==='Iniciar venda com 2 sessões'&&r.n==='2 sessões marcadas'&&r.pa==='true'&&r.ta==='Marcada'&&igual(r.sel,[C.A,C.C])&&igual(r.minis,[C.A,C.C])&&/abrem inteiras/.test(r.inteiras),'2: a barra mostra "Iniciar venda com 2 sessões" e as marcadas: '+J(r));
    ok(r.vis,'2: a barra fica à vista no pé da tela');}
  await V.evaluate(()=>ETERNA.render());await V.waitForTimeout(200);
  ok(await V.evaluate(()=>document.querySelector('#bf-lista').dataset.marca==='1'&&document.querySelector('#bf-lista .bf-card').dataset.marca==='1'&&document.querySelectorAll('.bf-marca[aria-pressed="true"]').length===2),'2: um redesenho geral depois de marcar não troca a lista');
  await V.setViewportSize({width:1366,height:820});await V.evaluate(()=>window.scrollTo(0,0));
  // teto de 8 (com 9 sessões na tela só 4 são livres; o teto é conferido direto)
  ok(await V.evaluate(()=>{const p=ETERNA.state.procurar;const era=p.sel.slice();p.sel=['LPX00001','LPX00002','LPX00003','LPX00004','LPX00005','LPX00006','LPX00007','LPX00008'];ETERNA.bfMarca('LPPVB0002');const n=p.sel.length;p.sel=era;return n;})===8&&/No máximo 8/.test(await aviso(V)),'teto de 8 sessões por venda');
  // ---------- 3: o filtro mantém as marcadas ----------
  await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='carlos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);
  {const r=await V.evaluate(C=>({cards:[...document.querySelectorAll('#bf-lista .bf-card')].map(c=>c.dataset.card),sel:ETERNA.state.procurar.sel.slice(),bt:document.querySelector('#bf-barra [data-act="bf-vender"]').textContent,pc:document.querySelector('#bf-lista .bf-mk[data-card="'+C.C+'"] .bf-marca').getAttribute('aria-pressed')}),C);
    ok(igual(r.cards,[C.C,C.D])&&igual(r.sel,[C.A,C.C])&&r.bt==='Iniciar venda com 2 sessões'&&r.pc==='true','3: trocar o filtro mantém as marcadas e a barra: '+J(r));}
  await toque(V,'#bf-barra .bf-bmini[data-card="'+C.C+'"]');ok(await V.evaluate(C=>ETERNA.state.procurar.sel.join()===C.A&&document.querySelector('#bf-lista .bf-mk[data-card="'+C.C+'"] .bf-marca').getAttribute('aria-pressed')==='false',C),'a miniatura da barra desmarca a sessão');
  await marca(V,C.C);
  await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='todos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);
  ok(await V.evaluate(C=>document.querySelector('#bf-lista .bf-mk[data-card="'+C.A+'"] .bf-marca').getAttribute('aria-pressed')==='true',C),'3: de volta a Todos, a A continua marcada');
  // ---------- 9: mensagens que o Checkout recusa sem mudar nada ----------
  const tab=await L.evaluate(()=>ETERNA.ecoTab());const id12=n=>('recusa'+String(n).padStart(6,'0'));
  const manda=async(m)=>{const n0=await V.evaluate(()=>window.__msgs.length);await V.evaluate(m=>window.__ch.postMessage(m),m);await V.waitForTimeout(350);
    const resp=(await L.evaluate(()=>window.__msgs.slice())).map(s=>JSON.parse(s)).filter(q=>q.tipo==='abriu'&&q.id===m.id);const k=await quiosque(L);return {resp:resp[resp.length-1]||null,parado:k.step==='code'&&!k.cards&&!k.code};};
  {const base=n=>({tipo:'abrir',id:id12(n),para:tab,cards:[C.A,C.C],origem:'procurar',em:Date.now()});const R={};
    R.semId=await manda(Object.assign(base(1),{id:'curto'}));R.nove=await manda(Object.assign(base(2),{cards:['LPX00001','LPX00002','LPX00003','LPX00004','LPX00005','LPX00006','LPX00007','LPX00008','LPX00009']}));
    R.velha=await manda(Object.assign(base(3),{em:Date.now()-11000}));R.outra=await manda(Object.assign(base(4),{para:'zzzzzzzz'}));R.menor=await manda(Object.assign(base(5),{cards:[C.A,C.MENOR]}));
    R.minusc=await manda(Object.assign(base(6),{cards:['lppva0001']}));R.origem=await manda(Object.assign(base(7),{origem:'outra'}));R.repete=await manda(Object.assign(base(8),{cards:[C.A,C.A]}));R.vazia=await manda(Object.assign(base(9),{cards:[]}));
    R.paga=await manda(Object.assign(base(10),{cards:[C.A,C.PAGA]}));R.pedido=await manda(Object.assign(base(11),{cards:[C.PEDIDO]}));R.semSessao=await manda(Object.assign(base(12),{cards:['LPNAOEXISTE']}));R.texto=await manda(Object.assign(base(13),{cards:'LPPVA0001'}));
    ok(Object.values(R).every(r=>r.parado),'9: nenhuma mensagem recusada muda o Checkout: '+J(R));
    ok(R.semId.resp===null&&R.outra.resp===null,'9: sem id válido ou para outra janela, o Checkout nem responde');
    ok(['nove','velha','minusc','origem','repete','vazia','texto'].every(k=>R[k].resp&&R[k].resp.ok===false&&R[k].resp.motivo==='invalido'),'9: 9 sessões, mais de 10 s, formato errado: invalido: '+J(R));
    ok(R.menor.resp&&R.menor.resp.motivo==='protegida'&&R.paga.resp.motivo==='paga'&&R.pedido.resp.motivo==='pedido'&&R.semSessao.resp.motivo==='carregando','9: menor, paga, com pedido e desconhecida: tudo ou nada, com o motivo: '+J([R.menor.resp,R.paga.resp,R.pedido.resp,R.semSessao.resp]));
    ok(Object.values(R).every(r=>!r.resp||J(Object.keys(r.resp).sort())===J(['id','motivo','ok','tipo'])),'9: a resposta leva só tipo, id, ok e motivo');}
  // ---------- 5 e 6: Iniciar abre só as marcadas, unidas e inteiras ----------
  await toque(V,'#bf-barra [data-act="bf-vender"]');
  ok(await espera(L,()=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so,8000),'5: o Checkout vai para a escolha');
  {const k=await quiosque(L);
    ok(k.cards&&igual(k.cards,[C.A,C.C])&&k.visita===false&&k.base===null&&k.origem==='procurar'&&k.code===C.A,'5: so.cards = as marcadas, sem visita, âncora na de mais fotos: '+J(k));
    ok(igual(k.fotos,ag(F.A.concat(F.C)))&&k.fotos.length===7,'5: todas as fotos das marcadas e nenhuma de outra sessão: '+J(k.fotos));
    ok(await espera(L,()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'5: abre direto na foto ampliada');}
  ok(await espera(V,()=>ETERNA.state.procurar.sel.length===0&&document.querySelector('#bf-barra').hidden&&!document.querySelector('.bf-marca[aria-pressed="true"]'),8000),'5: no vendedor a seleção é limpa');
  ok(/Aberto no Checkout/.test(await aviso(V)),'5: o vendedor vê "Aberto no Checkout": '+await aviso(V));
  await L.waitForTimeout(5600); // um ciclo do relógio do Checkout (lojaVisitaAtualiza)
  {const k=await quiosque(L);ok(igual(k.cards,[C.A,C.C])&&!k.fotos.some(f=>ag(F.B).includes(f)),'6: a sessão ligada pela visita e não marcada não entra, nem depois: '+J(k.cards));}
  // ---------- 11: auditoria ----------
  {const au=await V.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='procurar_vender'));
    ok(au.length===1&&au[0].por===CAIXA&&au[0].alvo==='sessoes/'+C.A&&au[0].mudancas[0].para===C.A+' + '+C.C&&au[0].posto&&au[0].porNome==='Caixa de teste'&&au[0].origem==='procurar'&&au[0].n===2,'11: auditoria procurar_vender com quem, posto e sessões: '+J(au));}
  // ---------- 7: Checkout com cliente ----------
  await marca(V,C.D);const antes=J(await quiosque(L));await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(700);
  ok(J(await quiosque(L))===antes&&await V.evaluate(C=>ETERNA.state.procurar.sel.join()===C.D,C),'7: com cliente no Checkout nada muda na tela dele e a seleção fica: '+await aviso(V));
  ok(/Checkout está com cliente/.test(await aviso(V)),'7: o vendedor vê o aviso de Checkout ocupado: '+await aviso(V));
  ok(await V.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='procurar_vender').length)===1,'7: venda recusada não vai para a auditoria');
  // ---------- 10: o pedido e o evento levam as sessões e a origem ----------
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');
  ok(await espera(L,()=>!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend),8000),'10: pedido feito no Checkout');
  const pend=await L.evaluate(()=>ETERNA.state.kiosk.paid.pend);
  {const r=await L.evaluate(id=>JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id),pend);
    ok(r&&igual(r.sessoes,[C.A,C.C])&&r.origem==='procurar'&&r.canal==='checkout'&&r.card===C.A,'10: o pedido grava as 2 sessões e a origem: '+J(r&&{s:r.sessoes,o:r.origem,c:r.canal}));}
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await V.waitForTimeout(400);
  {const r=await V.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);const a=ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});const b2=ETERNA.pendEscolher(id,{meio:'pix'});const c=ETERNA.pendConfirmar(id,{ref:'123456'});return {a,b2,c};},pend);
    ok(r.c!==false,'10: o Posto confirma o pagamento: '+J(r));
    ok(await (async()=>{const t0=Date.now();while(Date.now()-t0<10000){if(EVENTOS.some(e=>e.tipo==='criar'))return true;await V.waitForTimeout(150);}return false;})(),'10: o evento criar chega ao servidor');
    const cr=EVENTOS.find(e=>e.tipo==='criar');ok(cr&&cr.dados.origem==='procurar'&&igual(cr.dados.sessoes,[C.A,C.C])&&cr.dados.canal==='checkout','10: o criar leva origem "procurar" e as 2 sessões: '+J(cr&&{o:cr.dados.origem,s:cr.dados.sessoes}));}
  // depois da venda, as duas sessões ficam com a caixa desligada no Procurar fotos
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await V.evaluate(()=>ETERNA.go('procurar'));await V.waitForTimeout(400);
  ok(await espera(V,C=>[C.A,C.C].every(c=>document.querySelector('#bf-lista .bf-mk[data-card="'+c+'"] .bf-marca').disabled),8000,C),'depois de vendidas, A e C ficam com a caixa desligada');
  // ---------- Vender esta sessão (sessão aberta) ----------
  await toque(V,'#bf-lista .bf-card[data-card="'+C.B+'"] .bf-abre');await V.waitForTimeout(250);
  {const r=await V.evaluate(()=>({v:!!document.querySelector('.bf-sess [data-act="bf-vender-uma"]:not([disabled])'),m:!!document.querySelector('.bf-sess .bf-marca'),t:(document.querySelector('.bf-sess [data-act="bf-vender-uma"]')||{}).textContent}));ok(r.v&&r.m&&r.t==='Vender esta sessão','a sessão aberta tem "Vender esta sessão" e Marcar: '+J(r));}
  ok(await espera(V,()=>{const e=ETERNA.state.eco;return e&&e.m&&e.m.step==='code'&&Date.now()-e.at<4000;},9000),'o vendedor vê o Checkout de volta ao início');
  await toque(V,'.bf-sess [data-act="bf-vender-uma"]');ok(await espera(L,()=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so,8000),'Vender esta sessão abre o Checkout');
  {const k=await quiosque(L);ok(k.cards.join()===C.B&&igual(k.fotos,ag(F.B))&&k.visita===false&&k.origem==='procurar','só a sessão aberta, inteira (a A, ligada por visita e já vendida, não entra): '+J(k));}
  {const antes=J(await quiosque(L));const r=await manda({tipo:'abrir',id:id12(20),para:tab,cards:[C.D],origem:'procurar',em:Date.now()});
    ok(r.resp&&r.resp.ok===false&&r.resp.motivo==='ocupado'&&J(await quiosque(L))===antes,'7: com cliente na escolha, o próprio Checkout recusa (ocupado) e não muda: '+J(r.resp));}
  // sessão vendida aberta na tela: o botão fica desligado
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await toque(V,'[data-act="bf-voltar"]');await V.waitForTimeout(200);await toque(V,'#bf-lista .bf-card[data-card="'+C.PAGA+'"] .bf-abre');await V.waitForTimeout(250);
  ok(await V.evaluate(()=>document.querySelector('.bf-sess [data-act="bf-vender-uma"]').disabled&&document.querySelector('.bf-sess .bf-marca').disabled),'sessão já vendida: Vender esta sessão e Marcar desligados');
  await toque(V,'[data-act="bf-voltar"]');await V.waitForTimeout(200);
  // ---------- 8: Checkout fechado ----------
  await L.close();ok(await espera(V,()=>{const e=ETERNA.state.eco;return !e||e.fim||!e.m;},8000),'8: o vendedor percebe que o Checkout fechou');
  await marca(V,C.B);await marca(V,C.D);await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(300);
  ok(/Abra o Checkout/.test(await aviso(V))&&await V.evaluate(()=>ETERNA.state.view==='procurar'&&ETERNA.state.procurar.sel.length===2),'8: sem Checkout e com 2 sessões, o aviso pede para abrir o Checkout: '+await aviso(V));
  await toque(V,'#bf-barra .bf-bmini[data-card="'+C.B+'"]');await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(500);
  {const r=await V.evaluate(()=>({view:ETERNA.state.view,ses:ETERNA.state.checkout.session,step:ETERNA.state.checkout.step,manual:!!ETERNA.state.posto.manual,sel:ETERNA.state.procurar.sel.length}));
    ok(r.view==='posto'&&r.ses===C.D&&r.step===2&&r.manual&&r.sel===0,'8: sem Checkout e com 1 sessão, abre a Venda manual nela: '+J(r));}
  // ---------- textos nas 5 línguas ----------
  {const fs=require('fs');const dic=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').split('\n').filter(l=>/^  bf_(marcar|marcada|desmarcar|n_marcadas|vender_n|vender_uma|limpar|inteiras|abra_ck|ck_ocupado|ck_abriu|ck_sem_resposta|aberta_espera|max|protegida|rec_[a-z]+):\[/.test(l));
    const sessPausaTxt=()=>'3 min';const val=dic.map(l=>{const m=/^  (bf_[a-z_]+):(\[.*\]),\s*$/.exec(l);return m&&[m[1],new Function('sessPausaTxt','return '+m[2])(sessPausaTxt).map(t=>typeof t==='function'?t(2):t)];});
    ok(val.length===21&&val.every(d=>d&&d[1].length===5&&d[1].every(t=>typeof t==='string'&&t.trim()&&!/—|–|undefined/.test(t))),'21 textos novos nas 5 línguas, sem travessão: '+val.length);}
  ok(!errs.flat().length,'erros de página: '+errs.flat().join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
const f=fails.filter(Boolean);
if(f.length){console.log('FALHA procurar-vender: '+f.join(' || '));process.exit(1);}
console.log('OK procurar-vender: marcar sem redesenhar, barra, estados em palavras, Iniciar abre só as marcadas no Checkout (unidas, inteiras, sem visita), recusas, origem no pedido e no evento, auditoria, chave');process.exit(0);})();
