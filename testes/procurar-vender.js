// 26/11 (plano docs/planos/2026-11-26-procurar-vender.md, critérios 1 a 12): vender a partir do Procurar fotos. O vendedor marca as
// sessões na tela dele, "Iniciar venda com N sessões" abre o Checkout (janela #loja do mesmo computador, canal eterna-loja) só com as
// marcadas, unidas e inteiras; "Vender esta sessão" na sessão aberta; a venda leva origem "procurar"; auditoria procurar_vender.
// Agente falso e dados simulados (testes/_procurar_vender.js). PV_VER=1 mostra cada conferência.
const {chromium}=require('playwright');
const {hoje,U,J,C,F,ADMIN,FOTO,CAIXA,contexto,dupla,entrar,abrir,procurar,espera,chegou,semear,toque,marca,aviso,quiosque}=require('./_procurar_vender');
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
  // ---------- revisão: resposta atrasada e janela do vendedor recarregada logo depois do Iniciar ----------
  // Os prazos não são alteráveis na página: o teste serve o index.html com o prazo trocado (como a chave desligada, mais abaixo).
  const PRAZOS='const BF_ECO_MS=5500,BF_ABRIR_MS=6000;';const linhas=V=>V.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='procurar_vender'));
  const envios=a=>a.filter(e=>e.mudancas[0].campo==='sessoes'),fins=a=>a.filter(e=>e.mudancas[0].campo==='resultado');
  const olheiro=V=>V.evaluate(()=>{window.__avisos=[];new MutationObserver(()=>{const t=document.querySelector('#toast').textContent;if(t&&window.__avisos[window.__avisos.length-1]!==t)window.__avisos.push(t);}).observe(document.querySelector('#toast'),{childList:true,characterData:true,subtree:true});});
  {const x=await dupla(b,{troca:h=>h.replace(PRAZOS,'const BF_ECO_MS=5500,BF_ABRIR_MS=1;')});errs.push(x.errs);const {V,L}=x;
    const abriu=(c,ms)=>espera(L,c=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so&&ETERNA.state.kiosk.so.cards.join()===c,ms||9000,c);
    ok(await procurar(V),'lista (prazo curto)');ok((await V.evaluate(()=>ETERNA.bfTempos().espera))===1&&await V.evaluate(()=>typeof ETERNA.bfAbrirMs==='undefined'&&typeof ETERNA.bfEcoMs==='undefined'),'os prazos não são alteráveis pela página (só leitura)');
    await espera(V,()=>!!(ETERNA.state.eco&&ETERNA.state.eco.m),9000);await olheiro(V);
    // 1: o vendedor desiste de esperar e o Checkout abre mesmo assim: a resposta atrasada grava o desfecho e limpa a seleção
    await marca(V,C.A);await toque(V,'#bf-barra [data-act="bf-vender"]');ok(await abriu(C.A),'revisão 1: o Checkout abriu depois do prazo do vendedor');
    ok(await espera(V,()=>ETERNA.state.procurar.sel.length===0&&document.querySelector('#bf-barra').hidden,5000),'revisão 1: a resposta atrasada limpa a seleção');
    {const a=await linhas(V);const e=envios(a),f=fins(a);const av=await V.evaluate(()=>window.__avisos.slice());
      ok(e.length===1&&e[0].por===CAIXA&&e[0].alvo==='sessoes/'+C.A&&e[0].resultado==='enviado'&&/^[a-z0-9]{12}$/.test(e[0].pedido||''),'a auditoria do envio é gravada antes de falar com o Checkout: '+J(e));
      ok(f.length===1&&f[0].pedido===e[0].pedido&&f[0].mudancas[0].para==='aberto'&&f[0].mudancas[0].de==='enviado'&&f[0].por===CAIXA,'revisão 1: o desfecho (aberto) entra numa segunda linha, ligada pelo mesmo pedido, uma vez só: '+J(f));
      ok(av.some(t=>/não respondeu/.test(t))&&/Aberto no Checkout/.test(av[av.length-1]||''),'revisão 1: o aviso final é "Aberto no Checkout" (antes: não respondeu): '+J(av));}
    // Iniciar e recarregar a janela do vendedor no mesmo instante: o Checkout abre e o registro do envio existe
    await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await espera(V,()=>{const e=ETERNA.state.eco;return e&&e.m&&e.m.step==='code'&&Date.now()-e.at<3000;},9000);
    await marca(V,C.C);await V.evaluate(()=>{document.querySelector('#bf-barra [data-act="bf-vender"]').click();location.reload();});ok(await abriu(C.C),'Iniciar e recarregar: o Checkout abriu');
    await V.waitForLoadState('load');await V.waitForTimeout(600);
    {const a=await linhas(V);const e=envios(a).filter(y=>y.alvo==='sessoes/'+C.C);ok(e.length===1&&e[0].por===CAIXA&&e[0].resultado==='enviado'&&e[0].origem==='procurar'&&e[0].posto,'Iniciar e recarregar: existe o registro do envio, com quem, posto e sessão: '+J(e));
      ok(fins(a).filter(y=>y.pedido===e[0].pedido).length<=1,'Iniciar e recarregar: o desfecho, se a resposta chegou antes de a janela fechar, entra uma vez só');}
    await x.ctx.close();}
  // ---------- revisão: vendedor recém-recarregado, recusas, sair da tela com pedido pendente, selo e miniatura riscada ----------
  {const x=await dupla(b,{troca:h=>h.replace(PRAZOS,'const BF_ECO_MS=600000,BF_ABRIR_MS=6000;')});errs.push(x.errs);const {V,L,FEED}=x;const audit=async()=>envios(await linhas(V));
    const abriu=(c,ms)=>espera(L,c=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so&&ETERNA.state.kiosk.so.cards.join()===c,ms||9000,c);
    const zera=async()=>{await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await espera(V,()=>{const e=ETERNA.state.eco;return e&&e.m&&e.m.step==='code'&&Date.now()-e.at<3000;},9000);};
    {const t=await V.evaluate(()=>ETERNA.bfTempos());ok(t.vale<t.espera&&t.vale>=2000&&t.espera===6000,'revisão 1: a mensagem vale menos do que o vendedor espera: '+J(t));}
    // 7: janela do vendedor que ainda não ouviu o Checkout (o prazo de 5,5 s desde a carga vem esticado no index.html servido, e o anúncio já ouvido é apagado)
    ok(await procurar(V),'lista depois de recarregar');
    await V.evaluate(c=>{ETERNA.state.eco=null;ETERNA.bfMarca(c);document.querySelector('#bf-barra [data-act="bf-vender"]').click();},C.B);
    ok(await V.evaluate(()=>document.querySelector('#bf-barra [data-act="bf-vender"]').disabled&&ETERNA.state.view==='procurar'),'revisão 7: sem ter ouvido o Checkout ainda, o vendedor espera (botão em espera, sem cair na Venda manual)');
    ok(await abriu(C.B),'revisão 7: quando o Checkout se anuncia, a venda abre nele');ok(await espera(V,()=>ETERNA.state.view==='procurar'&&ETERNA.state.procurar.sel.length===0,4000),'revisão 7: o vendedor continua no Procurar fotos, com a seleção limpa');
    await V.waitForTimeout(300);await zera();await olheiro(V);
    // recusa do próprio Checkout (cliente no meio da selfie): desfecho "recusado: ocupado" na auditoria
    await L.evaluate(()=>{ETERNA.state.kiosk.camOn=true;});await marca(V,C.A);await toque(V,'#bf-barra [data-act="bf-vender"]');
    ok(await espera(V,()=>!ETERNA.state.procurar.pedido,5000)&&/Checkout está com cliente/.test(await aviso(V)),'Checkout com a câmera ligada: o vendedor vê ocupado: '+await aviso(V));await L.evaluate(()=>{ETERNA.state.kiosk.camOn=false;});
    {const a=await linhas(V);const e=envios(a)[0],f=fins(a)[0];ok(e&&f&&e.alvo==='sessoes/'+C.A&&f.pedido===e.pedido&&f.mudancas[0].para==='recusado: ocupado'&&await V.evaluate(c=>ETERNA.state.procurar.sel.join()===c,C.A),'a recusa também fica na auditoria, ligada ao envio, e a seleção fica: '+J(f&&f.mudancas));}
    // revisão 3 da reconferência: resposta "expirado" (Checkout lento, entre a validade e o prazo): o texto é o de "não respondeu"
    {const antes=await V.evaluate(()=>{const n=window.__msgs.length;ETERNA.state.eco.m.tab='zzzzzzzz';document.querySelector('#bf-barra [data-act="bf-vender"]').click();return n;}); // endereçado a uma janela que não existe: ninguém responde
      ok(await espera(V,n=>window.__msgs.slice(n).some(s=>s.includes('"abrir"')),3000,antes),'pedido no ar');
      const id=await V.evaluate(n=>JSON.parse(window.__msgs.slice(n).find(s=>s.includes('"abrir"'))).id,antes);await L.evaluate(id=>window.__ch.postMessage({tipo:'abriu',id,ok:false,motivo:'expirado'}),id);
      ok(await espera(V,()=>!ETERNA.state.procurar.pedido,3000)&&/não respondeu/.test(await aviso(V))&&!/Atualize a lista/.test(await aviso(V)),'resposta "expirado": o vendedor vê "O Checkout não respondeu": '+await aviso(V));
      const f=fins(await linhas(V))[0];ok(f&&f.pedido===id&&f.mudancas[0].para==='recusado: expirado','e a auditoria guarda "recusado: expirado": '+J(f&&f.mudancas));
      await marca(V,C.A);await espera(V,()=>{const e=ETERNA.state.eco;return e&&e.m&&e.m.tab!=='zzzzzzzz';},9000);}
    const n0=(await audit()).length;const t0=(await linhas(V)).length;
    // resposta "abriu ok" que não é de um pedido desta janela: nada acontece
    {const nAv=await V.evaluate(()=>window.__avisos.filter(t=>/Aberto no Checkout/.test(t)).length);
      await marca(V,C.C);await L.evaluate(()=>{window.__ch.postMessage({tipo:'abriu',id:'naoeumpedido',ok:true,motivo:null});window.__ch.postMessage({tipo:'abriu',id:'abcdefabcdef',ok:true,motivo:null});});await V.waitForTimeout(500);
      const r=await V.evaluate(()=>({sel:ETERNA.state.procurar.sel.slice(),av:window.__avisos.filter(t=>/Aberto no Checkout/.test(t)).length}));
      ok((await linhas(V)).length===t0&&r.sel.join()===C.C&&r.av===nAv,'resposta de um pedido que esta janela não fez não audita, não limpa a seleção e não avisa: '+J(r));}
    await marca(V,C.C); // desmarca, para o caso seguinte marcar de novo
    // 2: o vendedor sai da tela com o pedido ainda no ar
    await marca(V,C.C);await V.evaluate(()=>{document.querySelector('#bf-barra [data-act="bf-vender"]').click();ETERNA.go('posto');});ok(await abriu(C.C),'revisão 2: o Checkout abriu com o vendedor já em outra tela');
    ok(await espera(V,n=>ETERNA.auditRead().filter(e=>e.acao==='procurar_vender').length===n,5000,t0+2),'revisão 2: Iniciar e ir para o Posto no mesmo instante grava o envio e o desfecho: '+J((await linhas(V)).map(e=>e.mudancas[0].para)));
    {const a=await linhas(V);const e=envios(a)[0],f=fins(a)[0];ok(e&&f&&e.por===CAIXA&&e.alvo==='sessoes/'+C.C&&e.via==='checkout'&&f.pedido===e.pedido&&f.mudancas[0].para==='aberto'&&f.por===CAIXA&&(await audit()).length===n0+1,'revisão 2: com quem pediu, a sessão e o desfecho "aberto": '+J([e&&e.alvo,f&&f.mudancas]));}
    await zera();
    // 8: a sessão aberta fecha: o selo e a caixa do cartão mudam sem redesenhar a lista; marcada que foi vendida fica riscada na barra
    await V.evaluate(()=>ETERNA.go('procurar'));await V.waitForTimeout(400);await V.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='s';});
    ok(await V.evaluate(c=>{const k=document.querySelector('#bf-lista .bf-card[data-card="'+c+'"]');return /aberta · recebendo/.test(k.textContent)&&k.querySelector('.bf-marca').disabled;},C.ABERTA),'antes: a sessão aberta tem o selo e a caixa desligada');
    {const s=FEED.sessoes.find(y=>y.card===C.ABERTA);s.status='fechada';s.fechada_em=Date.now()/1000;s.fechada_por='pausa';s.rev=++FEED.rev;}
    ok(await espera(V,c=>{const k=document.querySelector('#bf-lista .bf-card[data-card="'+c+'"]');return k&&!/aberta · recebendo|entra quando fechar/.test(k.textContent)&&!k.querySelector('.bf-marca').disabled;},15000,C.ABERTA),'revisão 8: quando a sessão fecha, o selo some e a caixa acende sozinha');
    ok(await V.evaluate(()=>document.querySelector('#bf-lista').dataset.marca==='s'),'revisão 8: a lista não foi redesenhada');
    await marca(V,C.D);await V.evaluate(c=>{ETERNA.simOf(c).status='paga';ETERNA.saveSim();ETERNA.bfEstUpd();},C.D);
    {const r=await V.evaluate(c=>{const m=document.querySelector('#bf-barra .bf-bmini[data-card="'+c+'"]');const k=document.querySelector('#bf-lista .bf-card[data-card="'+c+'"]');return {inv:m.classList.contains('inv'),rot:m.getAttribute('aria-label'),selo:/Já vendida/.test(k.textContent),lista:document.querySelector('#bf-lista').dataset.marca};},C.D);
      ok(r.inv&&/não pode mais entrar/.test(r.rot)&&r.selo&&r.lista==='s','revisão 8: a marcada que foi vendida fica riscada na barra e o cartão ganha "Já vendida": '+J(r));}
    await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(300);ok(/Sessão 202 já foi vendida/.test(await aviso(V)),'revisão 9: o aviso diz "Sessão 202": '+await aviso(V));
    await V.evaluate(()=>ETERNA.render());await V.waitForTimeout(150);ok(await V.evaluate(()=>document.querySelector('#bf-lista').dataset.marca==='s'),'depois de tudo, um redesenho geral ainda não troca a lista');
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
  {const r=await V.evaluate(C=>{const m=c=>document.querySelector('#bf-barra .bf-bmini[data-card="'+c+'"]');return {txt:m(C.A).querySelector('.bf-bcod').textContent,img:!!m(C.A).querySelector('img'),rot:m(C.A).getAttribute('aria-label'),
      h:Math.min(...[...document.querySelectorAll('#bf-lista .bf-marca')].map(b=>Math.round(b.getBoundingClientRect().height)))};},C);
    ok(r.txt==='147'&&r.img&&r.rot==='Desmarcar sessão 147','a barra mostra a miniatura e o número da sessão (147): '+J(r));
    ok(r.h>=44,'revisão 4: a caixa Marcar tem 44 px ou mais de altura: '+r.h);}
  // revisão 5: em 390 px a barra não cresce com o número de marcadas (uma linha de miniaturas com rolagem lateral)
  {await V.setViewportSize({width:390,height:800});await V.waitForTimeout(250);
    const mede=()=>V.evaluate(()=>{const b=document.querySelector('#bf-barra'),m=b.querySelector('.bf-bminis');return {h:Math.round(b.getBoundingClientRect().height),rola:m.scrollWidth>m.clientWidth+2,ox:getComputedStyle(m).overflowX,wrap:getComputedStyle(m).flexWrap,sw:document.documentElement.scrollWidth<=innerWidth+1,
      toque:Math.min(...[...b.querySelectorAll('button')].map(x=>Math.round(x.getBoundingClientRect().height)))};});
    const m2=await mede();
    const m8=await (async()=>{await V.evaluate(()=>{const p=ETERNA.state.procurar;window.__era=p.sel.slice();p.sel=p.sel.concat(['LPX00001','LPX00002','LPX00003','LPX00004','LPX00005','LPX00006']);ETERNA.render();});await V.waitForTimeout(200);const r=await mede();
      await V.evaluate(()=>{ETERNA.state.procurar.sel=window.__era;ETERNA.state.procurar.inv={};ETERNA.render();});await V.waitForTimeout(200);return r;})();
    ok(m2.h<=200&&m8.h===m2.h&&m8.rola&&m8.ox==='auto'&&m8.wrap==='nowrap'&&m2.sw&&m8.sw&&m2.toque>=44&&m8.toque>=44,'revisão 5: em 390 px a barra tem a mesma altura com 2 e com 8 marcadas, com rolagem lateral: '+J([m2,m8]));
    await V.setViewportSize({width:1366,height:420});await V.waitForTimeout(200);await V.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='1';document.querySelector('#bf-lista .bf-card').dataset.marca='1';});} // (a medida com 8 redesenhou a lista de propósito)
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
  const manda=async(m)=>{const n0=await V.evaluate(()=>window.__msgs.length);await V.evaluate(m=>window.__ch.postMessage(m),m);
    if(!await espera(L,id=>window.__msgs.some(s=>{try{const q=JSON.parse(s);return q.tipo==='abriu'&&q.id===id;}catch(e){return false;}}),m.semResposta?700:4000,m.id))await V.waitForTimeout(50); // sem resposta esperada: só o prazo curto
    const resp=(await L.evaluate(()=>window.__msgs.slice())).map(s=>JSON.parse(s)).filter(q=>q.tipo==='abriu'&&q.id===m.id);const k=await quiosque(L);return {resp:resp[resp.length-1]||null,parado:k.step==='code'&&!k.cards&&!k.code};};
  {const base=n=>({tipo:'abrir',id:id12(n),para:tab,cards:[C.A,C.C],origem:'procurar',em:Date.now()});const R={};
    R.semId=await manda(Object.assign(base(1),{id:'curto',semResposta:1}));R.nove=await manda(Object.assign(base(2),{cards:['LPX00001','LPX00002','LPX00003','LPX00004','LPX00005','LPX00006','LPX00007','LPX00008','LPX00009']}));
    R.velha=await manda(Object.assign(base(3),{em:Date.now()-4500}));/* entre a validade (4 s) e a espera do vendedor (6 s): não abre */R.outra=await manda(Object.assign(base(4),{para:'zzzzzzzz',semResposta:1}));R.menor=await manda(Object.assign(base(5),{cards:[C.A,C.MENOR]}));
    R.minusc=await manda(Object.assign(base(6),{cards:['lppva0001']}));R.origem=await manda(Object.assign(base(7),{origem:'outra'}));R.repete=await manda(Object.assign(base(8),{cards:[C.A,C.A]}));R.vazia=await manda(Object.assign(base(9),{cards:[]}));
    R.paga=await manda(Object.assign(base(10),{cards:[C.A,C.PAGA]}));R.pedido=await manda(Object.assign(base(11),{cards:[C.PEDIDO]}));R.semSessao=await manda(Object.assign(base(12),{cards:['LPNAOEXISTE']}));R.texto=await manda(Object.assign(base(13),{cards:'LPPVA0001'}));
    await L.evaluate(()=>{ETERNA.state.kiosk.camOn=true;});R.camera=await manda(base(14));await L.evaluate(()=>{ETERNA.state.kiosk.camOn=false;});
    ok(R.camera.resp&&R.camera.resp.ok===false&&R.camera.resp.motivo==='ocupado','9: com a câmera ligada (cliente no meio da selfie) o Checkout responde ocupado: '+J(R.camera.resp));
    ok(Object.values(R).every(r=>r.parado),'9: nenhuma mensagem recusada muda o Checkout: '+J(R));
    ok(R.semId.resp===null&&R.outra.resp===null,'9: sem id válido ou para outra janela, o Checkout nem responde');
    ok(['nove','minusc','origem','repete','vazia','texto'].every(k=>R[k].resp&&R[k].resp.ok===false&&R[k].resp.motivo==='invalido'),'9: 9 sessões e formato errado: invalido: '+J(R));
    ok(R.velha.resp&&R.velha.resp.ok===false&&R.velha.resp.motivo==='expirado','9: mensagem com mais de 4 s (a validade): recusada como expirada: '+J(R.velha.resp));
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
  {const todas=await linhas(V);const au=envios(todas);const fim=fins(todas);ok(fim.length===1&&au[0]&&fim[0].pedido===au[0].pedido&&fim[0].mudancas[0].para==='aberto','11: o desfecho "aberto" ligado ao envio: '+J(fim.map(e=>e.mudancas)));
    ok(au.length===1&&au[0].por===CAIXA&&au[0].alvo==='sessoes/'+C.A&&au[0].mudancas[0].para===hoje+'-147 ('+C.A+') + '+hoje+'-201 ('+C.C+')'&&au[0].posto&&au[0].porNome==='Caixa de teste'&&au[0].origem==='procurar'&&au[0].n===2,'11: auditoria procurar_vender com quem, posto e sessões: '+J(au));}
  // ---------- 7: Checkout com cliente ----------
  await marca(V,C.D);const antes=J(await quiosque(L));await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(700);
  ok(J(await quiosque(L))===antes&&await V.evaluate(C=>ETERNA.state.procurar.sel.join()===C.D,C),'7: com cliente no Checkout nada muda na tela dele e a seleção fica: '+await aviso(V));
  ok(/Checkout está com cliente/.test(await aviso(V)),'7: o vendedor vê o aviso de Checkout ocupado: '+await aviso(V));
  ok((await linhas(V)).length===2,'7: venda que nem chegou a ser enviada não vai para a auditoria');
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
  await V.evaluate(()=>{ETERNA.state.posto.cortesia=true;}); // revisão 3: a Cortesia tinha ficado ligada no Posto
  await toque(V,'#bf-barra .bf-bmini[data-card="'+C.B+'"]');await toque(V,'#bf-barra [data-act="bf-vender"]');await V.waitForTimeout(500);
  {const r=await V.evaluate(c=>({view:ETERNA.state.view,ses:ETERNA.state.checkout.session,step:ETERNA.state.checkout.step,manual:!!ETERNA.state.posto.manual,sel:ETERNA.state.procurar.sel.length,cort:!!ETERNA.state.posto.cortesia,cart:(ETERNA.simOf(c).cart||[]).map(x=>x.id)}),C.D);
    ok(r.view==='posto'&&r.ses===C.D&&r.step===2&&r.manual&&r.sel===0,'8: sem Checkout e com 1 sessão, abre a Venda manual nela: '+J(r));
    ok(r.cort===false&&!r.cart.includes('cort_sac'),'revisão 3: a venda aberta pelo Procurar fotos nunca nasce como Cortesia: '+J(r));}
  // ---------- textos nas 5 línguas ----------
  {const fs=require('fs');const dic=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').split('\n').filter(l=>/^  bf_(marcar|marcada|desmarcar|n_marcadas|vender_n|vender_uma|limpar|inteiras|abra_ck|ck_ocupado|ck_abriu|ck_sem_resposta|aberta_espera|max|protegida|inv|rec_[a-z]+):\[/.test(l));
    const sessPausaTxt=()=>'3 min';const val=dic.map(l=>{const m=/^  (bf_[a-z_]+):(\[.*\]),\s*$/.exec(l);return m&&[m[1],new Function('sessPausaTxt','return '+m[2])(sessPausaTxt).map(t=>typeof t==='function'?t(2):t)];});
    ok(val.length===22&&val.every(d=>d&&d[1].length===5&&d[1].every(t=>typeof t==='string'&&t.trim()&&!/—|–|undefined/.test(t))),'22 textos novos nas 5 línguas, sem travessão: '+val.length);}
  ok(!errs.flat().length,'erros de página: '+errs.flat().join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
const f=fails.filter(Boolean);
if(f.length){console.log('FALHA procurar-vender: '+f.join(' || '));process.exit(1);}
console.log('OK procurar-vender: marcar sem redesenhar, barra, estados em palavras, Iniciar abre só as marcadas no Checkout (unidas, inteiras, sem visita), recusas, origem no pedido e no evento, auditoria, chave');process.exit(0);})();
