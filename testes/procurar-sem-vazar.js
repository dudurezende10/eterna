// 26/11 (plano docs/planos/2026-11-26-procurar-vender.md, critérios 14 a 19): a seleção de sessões é só do vendedor. Nada da lista,
// das sessões não marcadas ou da marcação chega à janela do cliente (#loja), ao canal eterna-loja ou ao que fica guardado no navegador,
// além dos códigos marcados. Vendedor e Checkout são duas páginas do mesmo contexto; um gravador em cada uma guarda tudo o que passa
// pelo canal, as etapas do Checkout e qualquer pedaço do Procurar fotos no DOM (testes/_procurar_vender.js). SV_VER=1 mostra as conferências.
const {chromium}=require('playwright');
const {U,J,C,F,CAIXA,QUIOSQUE,contexto,dupla,entrar,procurar,espera,chegou,toque,marca,aviso,quiosque}=require('./_procurar_vender');
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.SV_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+String(m).slice(0,260));};
const MARCADAS=['A','C'];const FORA=Object.keys(C).filter(k=>!MARCADAS.includes(k));
// tudo o que denuncia uma sessão não marcada: o código e o id de cada foto dela
const PROIBIDO=FORA.flatMap(k=>[C[k],...F[k]]);const acha=txt=>PROIBIDO.filter(p=>txt.includes(p));
const conta=txt=>PROIBIDO.reduce((n,p)=>n+txt.split(p).length-1,0);
// o estado do Checkout em texto (sem nós do DOM, relógios nem a câmera)
const kioskTxt=pg=>pg.evaluate(()=>{const visto=new Set();return JSON.stringify(ETERNA.state.kiosk,(k,v)=>{if(v&&typeof v==='object'){if(visto.has(v)||v.nodeType||(typeof MediaStream!=='undefined'&&v instanceof MediaStream))return undefined;visto.add(v);}return typeof v==='function'?undefined:v;})||'';});
const guardado=pg=>pg.evaluate(()=>{const de=s=>{const o={};for(let i=0;i<s.length;i++){const k=s.key(i);o[k]=String(s.getItem(k));}return o;};return {local:de(localStorage),sessao:de(sessionStorage)};});
// o que a janela mostra: o corpo inteiro (com avisos e janelas por cima), sem o código do programa
const limpo=pg=>pg.evaluate(()=>({html:(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script,style').forEach(e=>e.remove());return c.innerHTML;})(),step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code||'',so:!!ETERNA.state.kiosk.so,fotos:document.querySelectorAll('#main img[src*="/thumb/"],#main img[src*="/file/"],#main .lj-lbimg,#main [style*="/thumb/"],#main [style*="/file/"],#main .ph').length}));
(async()=>{const b=await chromium.launch();const errs=[];
try{
  const x=await dupla(b);errs.push(x.errs);const {V,L}=x;
  ok(await procurar(V),'a lista do vendedor tem as 9 sessões');
  ok(await V.evaluate(C=>[C.A,C.B,C.C,C.D].every(c=>{const m=document.querySelector('#bf-lista .bf-mk[data-card="'+c+'"] .bf-marca');return m&&!m.disabled;}),C),'4 sessões livres na tela do vendedor');
  // o que já estava guardado antes de o vendedor mexer: as sessões do dia já ficam no SIM de todo navegador do ponto (não é a seleção)
  const g0=await guardado(V);const gL0=await guardado(L);
  // ---------- 18: o vendedor procura, marca e desmarca; o Checkout fica parado no início, sem foto ----------
  const parado=async quando=>{const r=await limpo(L);ok(r.step==='code'&&!r.code&&!r.so&&r.fotos===0&&!/\/thumb\/|\/file\/|ag_pv/.test(r.html)&&!Object.values(C).some(c=>r.html.includes(c)),'18: '+quando+', o Checkout segue no início, sem foto e sem código de sessão: '+J({step:r.step,fotos:r.fotos}));};
  await parado('com a lista aberta no vendedor');
  await marca(V,C.A);await marca(V,C.B);await parado('com duas marcadas');
  await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='carlos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);await marca(V,C.C);await marca(V,C.D);
  await V.focus('#bf-cod');await V.keyboard.type('PVB');await V.waitForTimeout(300);await V.fill('#bf-cod','');await V.waitForTimeout(300);
  await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='todos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);
  await toque(V,'#bf-lista .bf-card[data-card="'+C.D+'"] .bf-abre');await V.waitForTimeout(250);await toque(V,'.bf-sess .bf-marca');await toque(V,'[data-act="bf-voltar"]');await V.waitForTimeout(250); // desmarca a D pela sessão aberta
  await marca(V,C.B); // desmarca a B
  await L.waitForTimeout(5400); // um ciclo do relógio do Checkout
  await parado('depois de marcar 4, filtrar, abrir uma sessão e desmarcar 2');
  ok(await V.evaluate(C=>ETERNA.state.procurar.sel.slice().sort().join()===[C.A,C.C].join(),C),'ficaram marcadas só A e C: '+J(await V.evaluate(()=>ETERNA.state.procurar.sel)));
  {const g=await guardado(V);const gl=await guardado(L);const tV=J(g),tL=J(gl);
    ok(conta(J(g.local))<=conta(J(g0.local))&&conta(J(g.sessao))===0&&conta(J(gl.sessao))===0,'16: marcar e desmarcar não grava nada no navegador: '+J({antes:conta(J(g0.local)),depois:conta(J(g.local))}));
    ok(!/procurar|"sel"|bf-|bf_/.test(Object.keys(g.local).concat(Object.keys(g.sessao),Object.keys(gl.sessao)).join(' '))&&!/"sel":\[|state\.procurar/.test(tV+tL),'16: nenhuma chave guardada é da seleção: '+Object.keys(g.local).join(' '));}
  // ---------- Iniciar ----------
  await toque(V,'#bf-barra [data-act="bf-vender"]');
  ok(await espera(L,()=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so,8000),'o Checkout abre a escolha');
  ok(await espera(L,()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'17: abre direto na foto ampliada');
  const confere=async quando=>{const k=await quiosque(L);const r=await limpo(L);const kt=await kioskTxt(L);
    ok(k.cards&&k.cards.slice().sort().join()===[C.A,C.C].join()&&k.fotos.length===F.A.length+F.C.length&&k.fotos.every(f=>F.A.concat(F.C).includes(f.slice(3))),'16: '+quando+', o Checkout tem só as fotos das marcadas: '+J(k.cards));
    ok(!acha(r.html).length,'16: '+quando+', o HTML do Checkout não tem código nem foto de sessão não marcada: '+J(acha(r.html)));
    ok(kt.length>50&&!acha(kt).length,'16: '+quando+', o estado do Checkout não tem código nem foto de sessão não marcada: '+J(acha(kt)));
    ok(!/pode_ser|"nivel"|"sim"|"busca"|Pode ser|Certeza/.test(kt)&&!/pode_ser|Pode ser|Certeza|Esta sessão também é sua/.test(r.html),'17: '+quando+', sem selo de nível e sem a pergunta da sessão');
    const txt=await L.evaluate(()=>document.getElementById('main').textContent);ok(!Object.values(C).some(c=>txt.includes(c)),'17: '+quando+', nenhum código de sessão escrito na tela do cliente');};
  await confere('ao abrir');
  // o cliente escolhe e pede; o Posto confirma: do início ao fim
  await L.click('#lj-lb [data-act="kiosk-ok"]');await confere('com uma foto escolhida');
  await L.click('#lj-lb .lj-next');ok(await espera(L,()=>!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend),8000),'pedido feito no Checkout');
  {const r=await limpo(L);const kt=await kioskTxt(L);ok(!acha(r.html).length&&!acha(kt).length,'16: na tela do pedido, nada das não marcadas: '+J(acha(r.html).concat(acha(kt))));}
  const pend=await L.evaluate(()=>ETERNA.state.kiosk.paid.pend);
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await V.waitForTimeout(400);
  ok(await V.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});return ETERNA.pendConfirmar(id,{ref:'123456'})!==false;},pend),'o Posto confirma o pagamento');
  ok(await espera(L,()=>ETERNA.state.kiosk.step==='done'&&!!(ETERNA.state.kiosk.paid&&!ETERNA.state.kiosk.paid.wait),12000),'o Checkout mostra o fim da venda');
  {const r=await limpo(L);const kt=await kioskTxt(L);ok(!acha(r.html).length&&!acha(kt).length,'16: na tela final, nada das não marcadas: '+J(acha(r.html).concat(acha(kt))));}
  // ---------- 16: o que ficou guardado no navegador ----------
  {const g=await guardado(V);const gl=await guardado(L);
    ok(conta(J(gl.sessao))===0&&conta(J(g.sessao))===0,'16: o sessionStorage das duas janelas não tem nada das não marcadas: '+J(acha(J(gl.sessao)+J(g.sessao))));
    const pior=Object.keys(g.local).filter(k=>conta(g.local[k])>conta(g0.local[k]||''));
    ok(!pior.length,'16: nenhuma chave do localStorage ganhou código ou foto de sessão não marcada com a venda: '+J(pior));
    const fora=Object.keys(g.local).filter(k=>k!=='eterna.sim.v1'&&conta(g.local[k])>0);
    ok(!fora.length,'16: fora o SIM (as sessões do dia, que já estavam lá), nenhuma chave cita sessão não marcada: '+J(fora));
    const au=JSON.parse(g.local['eterna.users.log.v1']||'[]').filter(e=>e.acao==='procurar_vender');ok(au.length===1&&!acha(J(au)).length&&J(au).includes(C.A)&&J(au).includes(C.C),'a auditoria guarda só as sessões marcadas: '+J(au.map(e=>e.mudancas)));
    ok(J(Object.keys(gL0.sessao).sort())===J(Object.keys(gl.sessao).sort()),'o Checkout não ganhou chave nova no sessionStorage: '+J(Object.keys(gl.sessao)));}
  // ---------- 15: tudo o que passou pelo canal ----------
  {const msgs=[...new Set((await L.evaluate(()=>window.__msgs.slice())).concat(await V.evaluate(()=>window.__msgs.slice())))];const tudo=msgs.join('\n');const ms=msgs.map(m=>JSON.parse(m));
    const abrir=ms.filter(m=>m.tipo==='abrir'),abriu=ms.filter(m=>m.tipo==='abriu');
    ok(abrir.length===1&&abriu.length===1&&abriu[0].ok===true&&abriu[0].id===abrir[0].id,'15: um pedido e uma resposta no canal: '+J([abrir.length,abriu.length]));
    ok(abrir[0]&&J(Object.keys(abrir[0]).sort())===J(['cards','em','id','origem','para','tipo'])&&abrir[0].cards.slice().sort().join()===[C.A,C.C].join()&&abrir[0].origem==='procurar'&&/^[a-z0-9]{12}$/.test(abrir[0].id),'15: o pedido leva só os códigos marcados, a origem, o destinatário e a hora: '+J(abrir[0]));
    ok(abriu[0]&&J(Object.keys(abriu[0]).sort())===J(['id','motivo','ok','tipo']),'15: a resposta leva só ok e o motivo: '+J(abriu[0]));
    ok(ms.length>3&&!acha(tudo).length,'15: nenhuma mensagem cita sessão ou foto não marcada ('+ms.length+' mensagens): '+J(acha(tudo)));
    ok(!/pode_ser|"nivel"|"sim"|"busca"|"sel"|"nota"/.test(tudo),'15: nenhuma mensagem tem nível, nota, seleção ou id de busca');}
  // ---------- 17 e 14: do início ao fim ----------
  {const r=await L.evaluate(()=>({steps:window.__steps.slice(),bf:window.__bf,tv:window.__tv}));
    ok(!r.steps.includes('talvez')&&r.tv===0&&r.steps.every(s=>['code','gallery','review','cart','done'].includes(s)),'17: o Checkout nunca passou pela pergunta "talvez": '+J(r.steps));
    ok(r.bf===0,'14: do início ao fim, a janela do cliente nunca teve a lista, a barra ou a caixa do Procurar fotos no DOM: '+r.bf);
    ok((await V.evaluate(()=>window.__bf))>0,'14: (o gravador funciona: na janela do vendedor ele viu a lista)');}
  // ---------- 19: a janela do cliente e o perfil Checkout não têm a tela ----------
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});
  {const r=await L.evaluate(c=>{ETERNA.go('procurar');ETERNA.bfMarca(c);const o={bf:!!document.querySelector('#bf,#bf-barra,.bf-card,.bf-marca'),pode:ETERNA.bfPodeVender(),view:ETERNA.state.view,sel:ETERNA.state.procurar.sel.length,user:!!ETERNA.state.user};
      location.hash='#procurar';return o;},C.B);await L.waitForTimeout(500);const d=await L.evaluate(()=>({bf:!!document.querySelector('#bf,#bf-barra,.bf-card,.bf-marca'),loja:!!ETERNA.state.lojaRota||!ETERNA.state.user}));
    ok(!r.bf&&r.pode===false&&r.view!=='procurar'&&r.sel===0&&!r.user&&!d.bf&&d.loja,'19: na aba #loja, go("procurar") não desenha a tela e bfPodeVender() é falso: '+J([r,d]));
    ok(await L.evaluate(async c=>{const v=await ETERNA.bfVender([c],'procurar');return v===false;},C.B),'19: bfVender não faz nada na aba do cliente');}
  {const y=await contexto(b);errs.push(y.errs);const pg=await y.pagina('perfil-checkout');await entrar(pg,QUIOSQUE);await pg.waitForTimeout(600);await chegou(pg);
    const r=await pg.evaluate(c=>{ETERNA.go('procurar');ETERNA.bfMarca(c);return {bf:!!document.querySelector('#bf,#bf-barra,.bf-card,.bf-marca'),pode:ETERNA.bfPodeVender(),view:ETERNA.state.view,sel:ETERNA.state.procurar.sel.length,g:ETERNA.state.user?ETERNA.guardAct('bf-vender'):false};},C.A);
    ok(!r.bf&&r.pode===false&&r.view!=='procurar'&&r.sel===0&&r.g===false,'19: no perfil Checkout, a tela não desenha e bfPodeVender() é falso: '+J(r));await y.ctx.close();}
  ok(!errs.flat().length,'erros de página: '+errs.flat().join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA procurar-sem-vazar: '+fails.join(' || '));process.exit(1);}
console.log('OK procurar-sem-vazar: a seleção fica só com o vendedor (DOM, estado e sessionStorage do Checkout, canal e localStorage sem nada das não marcadas), Checkout parado até o Iniciar, sem "talvez", tela fechada para #loja e para o perfil Checkout');process.exit(0);})();
