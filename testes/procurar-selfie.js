// 26/11 (fase 2 do plano docs/planos/2026-11-26-procurar-vender.md, critérios 29 a 31 e a parte de tela dos 23 a 28): "Procurar por selfie"
// no Procurar fotos. Modal de câmera na janela do vendedor (sem campo de arquivo; solta a câmera ao fechar), lista "Certeza" (já marcadas)
// antes de "Pode ser" (desmarcadas), fotos em que o rosto apareceu em destaque, "Adicionar pelos filtros" mantendo a seleção e a barra,
// "Iniciar venda" abrindo o Checkout com exatamente o conjunto final (origem procurar_selfie), aviso do rosto maior, recusas do servidor,
// câmera ocupada, chave desligada e nada do resultado na janela do cliente, no canal ou no que o navegador guarda.
// Agente falso e câmera falsa do Chromium (testes/_procurar_vender.js). PS_VER=1 mostra cada conferência.
const {chromium}=require('playwright');
const {ligaSelfie,U,J,C,F,ADMIN,FOTO,CAIXA,QUIOSQUE,contexto,dupla,entrar,procurar,espera,chegou,toque,marca,aviso,quiosque}=require('./_procurar_vender');
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.PS_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+String(m).slice(0,300));};
const BUSCA='0a1b2c3d4e5f6071';const igual=(a,b)=>a.slice().sort().join()===b.slice().sort().join();
const ses=(k,nivel,nb,mais)=>Object.assign({card:C[k],nivel,status:'fechada',fotografo:'samuel',ponto:null,cap0:0,cap1:0,n:F[k].length,bateu:F[k].slice(-nb).map(id=>({id}))},mais||{});
const ate=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||6000)){if(fn())return true;await new Promise(r=>setTimeout(r,80));}return false;};
// A e C com certeza, a ABERTA com certeza (não pode entrar ainda), B e D "pode ser"; a de MENOR nunca viria do servidor (aqui vem, para a tela provar que não marca)
const RESP0=()=>({ok:true,busca:BUSCA,rosto:true,varias:false,fila:0,sessoes:[ses('A','certeza',2),ses('C','certeza',1),ses('ABERTA','certeza',1,{status:'aberta'}),ses('MENOR','certeza',1),ses('B','pode_ser',1),ses('D','pode_ser',1)]});
// o que denuncia o resultado da busca fora da janela do vendedor
const SEGREDO=/pode_ser|"nivel"|"bateu"|"busca"|"sim"|0a1b2c3d4e5f6071|"selfie"|bf-sf|bf_selfie/;
const guardado=pg=>pg.evaluate(()=>{const de=s=>{const o={};for(let i=0;i<s.length;i++){const k=s.key(i);o[k]=String(s.getItem(k));}return o;};return {local:de(localStorage),sessao:de(sessionStorage)};});
const kioskTxt=pg=>pg.evaluate(()=>{const visto=new Set();return JSON.stringify(ETERNA.state.kiosk,(k,v)=>{if(v&&typeof v==='object'){if(visto.has(v)||v.nodeType||(typeof MediaStream!=='undefined'&&v instanceof MediaStream))return undefined;visto.add(v);}return typeof v==='function'?undefined:v;})||'';});
const corpoHtml=pg=>pg.evaluate(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script,style').forEach(e=>e.remove());return c.innerHTML;});
const modal=pg=>pg.evaluate(()=>{const m=document.querySelector('#bf-selfie-modal');const a=ETERNA.bfSelfieAberto();const vivas=(window.__cams||[]).filter(s=>s.getTracks().some(t=>t.readyState==='live')).length;
  return {el:!!m,cam:a.cam,busy:a.busy,vivas,abertas:(window.__cams||[]).length,arquivo:m?m.querySelectorAll('input').length:0,msg:m?m.querySelector('.bf-sf-msg').textContent:'',erro:m?m.querySelector('.bf-sf-msg').hasAttribute('data-erro'):false,
    buscar:m?!m.querySelector('[data-bs="buscar"]').disabled:false,deNovo:m?!m.querySelector('[data-bs="cam"]').hidden:false};});
const abreModal=async pg=>{await toque(pg,'[data-act="bf-selfie"]');return espera(pg,()=>ETERNA.bfSelfieAberto().cam&&!document.querySelector('#bf-selfie-modal [data-bs="buscar"]').disabled&&document.querySelector('#bf-selfie-modal video').videoWidth>0,10000);};
const buscaSelfie=async pg=>{if(!await abreModal(pg))throw new Error('a câmera do modal não abriu');await toque(pg,'#bf-selfie-modal [data-bs="buscar"]');};
const lista=pg=>pg.evaluate(()=>{const p=ETERNA.state.procurar;const cs=n=>[...document.querySelectorAll('.bf-sf-lista[data-nivel="'+n+'"] .bf-sfc')].map(k=>({card:k.dataset.card,on:(k.querySelector('.bf-marca')||{getAttribute:()=>null}).getAttribute('aria-pressed')==='true',
    off:!!(k.querySelector('.bf-marca')&&k.querySelector('.bf-marca').disabled),bateu:k.querySelectorAll('.bf-bateu').length,minis:[...k.querySelectorAll('.bf-mini')].map(b=>(b.classList.contains('bf-bateu')?'*':'')+b.dataset.pid),est:(k.querySelector('.bf-est')||{textContent:''}).textContent}));
  const hs=[...document.querySelectorAll('.bf-sf .bf-sf-h')].map(h=>h.dataset.nivel);
  return {tela:!!document.querySelector('.bf-sf'),ordem:hs,certeza:cs('certeza'),pode:cs('pode_ser'),sel:p.sel.slice(),tem:!!p.selfie,ver:p.selfieVer,barra:(document.querySelector('#bf-barra-n')||{textContent:''}).textContent,
    varias:(document.querySelector('#bf-sf-varias')||{textContent:''}).textContent,txt:(document.querySelector('.bf-sf')||{textContent:''}).textContent};});
const ARGS=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'];
(async()=>{const b=await chromium.launch({args:ARGS});const errs=[];
try{
  // ================= o fluxo inteiro: vendedor e Checkout no mesmo computador =================
  {const pedidos=[],marcar=[];let RESP=RESP0();let proxima=null;
    const rotas=(p,rq)=>{if(p==='/rostos/sessoes'){pedidos.push({corpo:rq.postData()||'',xe:rq.headers()['x-eterna']});const r=proxima||{corpo:RESP};proxima=null;return r;}
      if(p==='/rostos/sessoes/marcar'){marcar.push(rq.postData()||'');return {corpo:{ok:true}};}return null;};
    const x=await dupla(b,{rotas,troca:ligaSelfie});errs.push(x.errs);const {V,L}=x;ok(await procurar(V),'a lista do vendedor aparece');
    const g0=await guardado(V);
    ok(await V.evaluate(()=>!!document.querySelector('#bf [data-act="bf-selfie"]')&&ETERNA.bfSelfiePode()&&!ETERNA.WRITE_OPS['bf-selfie']),'o botão Procurar por selfie fica junto dos filtros');
    // ---------- 29: o modal ----------
    ok(await abreModal(V),'29: o modal abre a câmera na janela do vendedor');
    {const m=await modal(V);ok(m.el&&m.cam&&m.arquivo===0&&m.vivas===1&&m.buscar&&!m.deNovo&&!m.erro,'29: modal sem campo de arquivo, com a câmera ao vivo: '+J(m));
      ok(await V.evaluate(()=>document.querySelectorAll('input[type=file]').length===0||![...document.querySelectorAll('input[type=file]')].some(i=>i.closest('#bf-selfie-modal'))),'29: nenhum input de arquivo no modal');
      ok(await V.evaluate(()=>{const m=document.querySelector('#bf-selfie-modal');return m.getAttribute('role')==='dialog'&&m.getAttribute('aria-modal')==='true'&&!!document.getElementById(m.getAttribute('aria-labelledby'));}),'o modal é um diálogo com título');}
    {const r=await V.evaluate(()=>{const m=document.querySelector('#bf-selfie-modal');const v=m.querySelector('video');return {peca:(m.querySelector('.bf-sf-peca')||{textContent:''}).textContent,desc:m.getAttribute('aria-describedby'),tr:getComputedStyle(v).transform,foco:!!document.activeElement&&m.contains(document.activeElement)};});
      ok(r.peca==='Peça ao cliente antes de apontar a câmera.'&&r.desc==='bf-sf-peca','3: o modal traz a linha fixa "Peça ao cliente antes de apontar a câmera.": '+J(r.peca));
      ok(r.tr==='none','12: o vídeo não é espelhado (o vendedor filma outra pessoa): '+r.tr);
      const focos=[];for(let i=0;i<5;i++){await V.keyboard.press(i===3?'Shift+Tab':'Tab');focos.push(await V.evaluate(()=>{const m=document.querySelector('#bf-selfie-modal');return m.contains(document.activeElement)?document.activeElement.dataset.bs:'FORA';}));}
      ok(r.foco&&!focos.includes('FORA')&&new Set(focos).size===2,'12: o foco entra no modal e o Tab fica preso nos botões dele: '+J(focos));}
    await toque(V,'#bf-selfie-modal [data-bs="fechar"]');
    {const m=await modal(V);ok(!m.el&&!m.cam&&m.vivas===0&&m.abertas>=1,'29: fechar solta a câmera: '+J(m));}
    ok(await espera(V,()=>!!document.activeElement&&document.activeElement.dataset.act==='bf-selfie',3000),'12: ao fechar, o foco volta ao botão Procurar por selfie');
    ok(pedidos.length===0&&await V.evaluate(()=>!ETERNA.state.procurar.selfie),'fechar sem procurar não busca nada');
    ok(await abreModal(V),'o modal abre de novo');await V.evaluate(()=>document.activeElement&&document.activeElement.blur());await V.keyboard.press('Escape');await V.waitForTimeout(150);
    {const m=await modal(V);ok(!m.el&&m.vivas===0,'12: Esc fecha o modal de qualquer lugar da página e solta a câmera: '+J(m));}
    // ---------- a busca ----------
    await buscaSelfie(V);ok(await espera(V,()=>!!document.querySelector('.bf-sf'),8000),'a lista das sessões achadas aparece');
    {const m=await modal(V);ok(!m.el&&m.vivas===0,'29: achou: o modal fecha e a câmera é solta: '+J(m));}
    {const q=pedidos[0]||{};let c={};try{c=JSON.parse(q.corpo);}catch(e){}
      ok(pedidos.length===1&&q.xe==='1'&&J(Object.keys(c))===J(['imagens'])&&Array.isArray(c.imagens)&&c.imagens.length===3&&c.imagens.every(i=>/^data:image\/jpeg;base64,/.test(i)&&i.length>2000&&i.length<900000),
        'a busca manda só 3 quadros da câmera: '+J({n:(c.imagens||[]).length,chaves:Object.keys(c),tam:(c.imagens||[]).map(i=>i.length)}));}
    let l=await lista(V);
    ok(J(l.ordem)===J(['certeza','pode_ser']),'29: Certeza vem antes de Pode ser: '+J(l.ordem));
    ok(J(l.certeza.map(c=>c.card))===J([C.A,C.C,C.ABERTA,C.MENOR])&&J(l.pode.map(c=>c.card))===J([C.B,C.D]),'as sessões de cada bloco, na ordem do servidor: '+J([l.certeza.map(c=>c.card),l.pode.map(c=>c.card)]));
    ok(l.certeza[0].on&&l.certeza[1].on&&igual(l.sel,[C.A,C.C]),'29: as de Certeza que podem entrar chegam marcadas: '+J(l.sel));
    ok(!l.pode[0].on&&!l.pode[1].on&&!l.pode[0].off,'29: as de Pode ser chegam desmarcadas (e podem ser marcadas)');
    ok(!l.certeza[2].on&&l.certeza[2].off&&/fechar/.test(l.certeza[2].est),'sessão aberta: caixa desligada, com o motivo em palavras: '+J(l.certeza[2]));
    ok(!l.certeza[3].on&&l.certeza[3].off&&/protegida/i.test(l.certeza[3].est),'sessão de menor (que o servidor nunca manda) não é marcada nem pode ser: '+J(l.certeza[3]));
    ok(l.certeza[0].bateu===2&&J(l.certeza[0].minis.slice(0,2))===J(F.A.slice(-2).map(p=>'*'+p))&&l.certeza[0].minis.length===F.A.length&&l.pode[0].bateu===1&&l.pode[0].minis[0]==='*'+F.B[F.B.length-1]&&l.pode[0].minis.length===F.B.length,
      'as fotos em que o rosto apareceu vêm primeiro, em destaque, seguidas das outras da sessão: '+J([l.certeza[0].minis,l.pode[0].minis]));
    ok(!/"sim"/.test((pedidos[0]||{}).corpo||'')&&await V.evaluate(()=>!JSON.stringify(ETERNA.state.procurar.selfie).includes('sim')),'4: nem a resposta nem a memória da tela têm nota');
    ok(/2 sess/.test(l.barra)&&!l.varias&&!/0[.,][37]\d|pode_ser|certeza\b|%/.test(l.txt.replace(/Certeza/g,'')),'a barra conta as 2 marcadas; a tela mostra o nível em palavras, sem nota: '+J(l.barra));
    // nada disso saiu da janela do vendedor
    {const g=await guardado(V),gl=await guardado(L);const h=await corpoHtml(L);const kt=await kioskTxt(L);const st=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code||'',bf:window.__bf,cams:window.__cams.length}));
      ok(!SEGREDO.test(J(g))&&!SEGREDO.test(J(gl)),'o resultado da busca não vai ao localStorage nem ao sessionStorage (vendedor e Checkout)');
      ok(J(Object.keys(g.local).sort())===J(Object.keys(g0.local).sort())&&J(Object.keys(g.sessao).sort())===J(Object.keys(g0.sessao).sort()),'a busca não cria chave nova no navegador: '+J(Object.keys(g.local).filter(k=>!(k in g0.local))));
      ok(st.step==='code'&&!st.code&&st.bf===0&&st.cams===0&&!SEGREDO.test(h)&&!SEGREDO.test(kt)&&!Object.values(C).some(c=>h.includes(c)),'18: enquanto o vendedor busca, o Checkout segue no início, sem nada da busca e sem abrir câmera: '+J(st));
      const sim=await V.evaluate(()=>JSON.stringify(ETERNA.SIM));ok(!SEGREDO.test(sim),'o resultado da busca não vai ao SIM');
      const ms=(await L.evaluate(()=>window.__msgs.slice())).concat(await V.evaluate(()=>window.__msgs.slice())).join('\n');ok(!SEGREDO.test(ms)&&!/"tipo":"abrir"/.test(ms),'nada da busca passou pelo canal');}
    // ---------- abrir uma sessão achada e voltar ----------
    await toque(V,'.bf-sf .bf-sfc[data-card="'+C.B+'"] .bf-abre');await V.waitForTimeout(250);
    ok(await V.evaluate(n=>!!document.querySelector('.bf-sess')&&document.querySelectorAll('.bf-sess .photos .ph').length===n,F.B.length),'o vendedor abre a sessão achada para conferir todas as fotos');
    await toque(V,'[data-act="bf-voltar"]');await V.waitForTimeout(250);l=await lista(V);ok(l.tela&&igual(l.sel,[C.A,C.C]),'Voltar devolve à lista da selfie, com as marcadas');
    // ---------- 30: desmarca uma Certeza (a família vizinha) e marca um Pode ser (a taça) ----------
    const no=await V.evaluate(()=>document.querySelector('.bf-sf'));
    await toque(V,'.bf-sf .bf-mk[data-card="'+C.C+'"] .bf-marca');await toque(V,'.bf-sf .bf-mk[data-card="'+C.B+'"] .bf-marca');l=await lista(V);
    ok(igual(l.sel,[C.A,C.B])&&l.certeza[0].on&&!l.certeza[1].on&&l.pode[0].on&&!l.pode[1].on&&/2 sess/.test(l.barra),'30: desmarcou uma Certeza e marcou um Pode ser: '+J(l.sel));
    ok(await V.evaluate(()=>{ETERNA.render();return !!document.querySelector('.bf-sf .bf-marca[aria-pressed="true"]');})&&no,'marcar não desmonta a lista (o próximo desenho é o mesmo)');
    // ---------- 31: Adicionar pelos filtros ----------
    await toque(V,'[data-act="bf-selfie-filtros"]');await V.waitForTimeout(300);
    {const r=await V.evaluate(()=>({filtros:!!document.querySelector('#bf-lista .bf-card'),sf:!!document.querySelector('.bf-sf'),sel:ETERNA.state.procurar.sel.slice(),barra:(document.querySelector('#bf-barra-n')||{textContent:''}).textContent,oculta:document.querySelector('#bf-barra').hidden,
        volta:!!document.querySelector('[data-act="bf-selfie-ver"]'),tem:!!ETERNA.state.procurar.selfie}));
      ok(r.filtros&&!r.sf&&igual(r.sel,[C.A,C.B])&&/2 sess/.test(r.barra)&&!r.oculta&&r.volta&&r.tem,'31: Adicionar pelos filtros mostra os filtros e mantém a seleção e a barra: '+J(r));}
    ok(await V.evaluate(([a,b])=>['true','true'].join()===[a,b].map(c=>document.querySelector('#bf-lista .bf-mk[data-card="'+c+'"] .bf-marca').getAttribute('aria-pressed')).join(),[C.A,C.B]),'31: nos filtros, as sessões marcadas pela selfie aparecem marcadas');
    await marca(V,C.D);ok(await V.evaluate(c=>ETERNA.state.procurar.sel.includes(c)&&/3 sess/.test(document.querySelector('#bf-barra-n').textContent),C.D),'31: marcou mais uma pelos filtros; a barra conta 3');
    await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='carlos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);
    ok(await V.evaluate(()=>ETERNA.state.procurar.sel.length===3&&!!ETERNA.state.procurar.selfie),'31: trocar o filtro mantém a seleção e o resultado da selfie');
    await toque(V,'[data-act="bf-selfie-ver"]');await V.waitForTimeout(300);l=await lista(V);
    ok(l.tela&&igual(l.sel,[C.A,C.B,C.D])&&l.certeza[0].on&&!l.certeza[1].on&&l.pode[0].on&&l.pode[1].on&&/3 sess/.test(l.barra),'31: de volta à lista da selfie, tudo como estava (a D, marcada nos filtros, também é da selfie): '+J(l.sel));
    await toque(V,'.bf-sf .bf-mk[data-card="'+C.D+'"] .bf-marca'); // tira a D (pode ser que não era)
    await toque(V,'[data-act="bf-selfie-filtros"]');await V.waitForTimeout(250);await V.evaluate(()=>{const s=document.querySelector('#bf-foto');s.value='todos';s.dispatchEvent(new Event('change',{bubbles:true}));});await V.waitForTimeout(300);
    await V.evaluate(()=>{ETERNA.state.procurar.hora='dia';});await V.evaluate(()=>document.querySelector('[data-act="bf-hora"][data-h="dia"]').click());await V.waitForTimeout(300);
    // ---------- 30: Iniciar venda (a partir dos filtros, com a seleção feita na selfie) ----------
    const FINAL=[C.A,C.B];const FORA=Object.keys(C).filter(k=>!FINAL.includes(C[k]));const PROIB=FORA.flatMap(k=>[C[k],...F[k]]);const acha=t=>PROIB.filter(p=>t.includes(p));
    ok(await V.evaluate(f=>ETERNA.state.procurar.sel.slice().sort().join()===f.slice().sort().join(),FINAL),'o conjunto final é A (certeza) e B (pode ser): '+J(await V.evaluate(()=>ETERNA.state.procurar.sel)));
    await toque(V,'#bf-barra [data-act="bf-vender"]');
    ok(await espera(L,()=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&!!ETERNA.state.kiosk.so,8000),'30: o Checkout abre a escolha');
    ok(await espera(L,()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'17: abre direto na foto ampliada');
    {const k=await quiosque(L);const h=await corpoHtml(L);const kt=await kioskTxt(L);
      ok(k.cards&&igual(k.cards,FINAL)&&k.visita===false&&k.origem==='procurar_selfie'&&k.fotos.length===F.A.length+F.B.length&&k.fotos.every(f=>F.A.concat(F.B).includes(f.slice(3))),'30: o Checkout abre com exatamente o conjunto final, sessões inteiras, origem procurar_selfie: '+J([k.cards,k.origem,k.fotos.length]));
      ok(!acha(h).length&&!acha(kt).length,'16: o Checkout não tem código nem foto das não marcadas (inclui a Certeza desmarcada): '+J(acha(h).concat(acha(kt))));
      ok(!/pode_ser|"nivel"|"bateu"|"busca"|"sim"|0a1b2c3d4e5f6071|Pode ser|Certeza|Esta sessão também é sua/.test(kt+h),'17: sem nível, nota, id da busca ou pergunta de sessão na janela do cliente');}
    ok(await espera(V,()=>!ETERNA.state.procurar.selfie&&ETERNA.state.procurar.sel.length===0&&!document.querySelector('.bf-sf')&&!document.querySelector('[data-act="bf-selfie-ver"]'),6000),'com a venda aberta, o resultado da selfie e a seleção saem da tela do vendedor');
    ok(/Aberto no Checkout/.test(await aviso(V)),'o vendedor vê "Aberto no Checkout": '+await aviso(V));
    ok(await ate(()=>marcar.length>=1)&&marcar.length===1&&(()=>{try{const m=JSON.parse(marcar[0]);return J(Object.keys(m).sort())===J(['busca','cards'])&&m.busca===BUSCA&&igual(m.cards,FINAL);}catch(e){return false;}})(),'o servidor recebe quais das achadas foram marcadas (uma vez): '+J(marcar));
    // o canal: só os códigos marcados
    {const msgs=[...new Set((await L.evaluate(()=>window.__msgs.slice())).concat(await V.evaluate(()=>window.__msgs.slice())))];const tudo=msgs.join('\n');const ms=msgs.map(m=>JSON.parse(m));const ab=ms.filter(m=>m.tipo==='abrir');
      ok(ab.length===1&&J(Object.keys(ab[0]).sort())===J(['cards','em','id','origem','para','tipo'])&&igual(ab[0].cards,FINAL)&&ab[0].origem==='procurar_selfie','15: o pedido leva só os códigos marcados e a origem: '+J(ab[0]));
      ok(!acha(tudo).length&&!/pode_ser|"nivel"|"sim"|"busca"|"sel"|"nota"|"bateu"|0a1b2c3d4e5f6071/.test(tudo),'15: nenhuma mensagem do canal tem nível, nota, id da busca ou sessão não marcada: '+J(acha(tudo)));}
    // o cliente escolhe, pede, o Posto confirma: a venda leva a origem
    await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');ok(await espera(L,()=>!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend),8000),'pedido feito no Checkout');
    const pend=await L.evaluate(()=>ETERNA.state.kiosk.paid.pend);await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await V.waitForTimeout(400);
    ok(await V.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(!r||r.origem!=='procurar_selfie'||r.sessoes.length!==2)return false;ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});return ETERNA.pendConfirmar(id,{ref:'123456'})!==false;},pend),'10: o pedido grava as 2 sessões e a origem procurar_selfie, e o Posto confirma');
    {const t0=Date.now();while(Date.now()-t0<10000&&!x.EVENTOS.some(e=>e.tipo==='criar'))await V.waitForTimeout(150);}
    ok(x.EVENTOS.some(e=>e.tipo==='criar'&&e.dados.origem==='procurar_selfie'&&igual(e.dados.sessoes||[],FINAL)),'10: o evento criar leva origem procurar_selfie e as sessões: '+J(x.EVENTOS.filter(e=>e.tipo==='criar').map(e=>[e.dados.origem,e.dados.sessoes])));
    {const g=await guardado(V),gl=await guardado(L);ok(!/pode_ser|"nivel"|"bateu"|"busca"|0a1b2c3d4e5f6071|"selfie"/.test(J(g)+J(gl)),'16: depois da venda, nada do resultado da busca ficou guardado no navegador');
      const au=JSON.parse(g.local['eterna.users.log.v1']||'[]').filter(e=>e.acao==='procurar_vender');ok(au.length===2&&au.every(e=>e.origem==='procurar_selfie')&&!J(au).includes(BUSCA)&&!J(au).includes(C.C)&&!J(au).includes(C.D),'a auditoria guarda a origem e só as sessões marcadas, sem o id da busca: '+J(au.map(e=>e.mudancas)));}
    {const r=await L.evaluate(()=>({steps:window.__steps.slice(),bf:window.__bf,tv:window.__tv,cams:window.__cams.length}));
      ok(!r.steps.includes('talvez')&&r.tv===0&&r.bf===0&&r.cams===0,'14 e 17: do início ao fim, a janela do cliente nunca teve o modal, a lista da selfie nem a pergunta "talvez", e não abriu câmera: '+J(r));
      ok((await V.evaluate(()=>window.__bf))>0,'(o gravador funciona: na janela do vendedor ele viu a tela)');}
    // ---------- regra 3: havia mais de um rosto: a tela avisa ----------
    await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});ok(await procurar(V),'de volta ao Procurar fotos');
    ok(await V.evaluate(()=>!ETERNA.state.procurar.selfie&&!document.querySelector('.bf-sf')),'sair da tela apagou o resultado da selfie');
    RESP=Object.assign(RESP0(),{busca:'1'.repeat(16),varias:true,sessoes:[ses('C','certeza',1),ses('D','pode_ser',1)]});
    await buscaSelfie(V);ok(await espera(V,()=>!!document.querySelector('#bf-sf-varias'),8000),'varias:true: a lista vem com o aviso');l=await lista(V);
    ok(/Usei o rosto maior\. Se não for o cliente, enquadre só ele\./.test(l.varias),'aviso "Usei o rosto maior. Se não for o cliente, enquadre só ele.": '+J(l.varias));
    ok(l.sel.length===0&&l.certeza.length===1&&!l.certeza[0].on&&!l.certeza[0].off&&/mais de uma pessoa/.test(l.txt)&&await V.evaluate(()=>document.querySelector('#bf-barra').hidden),'1: com mais de um rosto, NADA vem marcado (nem a Certeza); o vendedor marca à mão: '+J(l.sel));
    await toque(V,'.bf-sf .bf-mk[data-card="'+C.C+'"] .bf-marca');
    ok(l.certeza.concat(l.pode).every(c=>c.card!==C.A&&c.card!==C.B),'(A e B, já vendidas, não estão neste resultado)');
    // nova selfie (outro cliente): saem as marcadas da busca anterior e entra a Certeza nova
    await toque(V,'.bf-sf .bf-mk[data-card="'+C.D+'"] .bf-marca');ok(igual((await lista(V)).sel,[C.C,C.D]),'marcou também o Pode ser');
    RESP=Object.assign(RESP0(),{busca:'2'.repeat(16),sessoes:[ses('D','certeza',1),ses('A','certeza',1)]});
    await toque(V,'.bf-sf [data-act="bf-selfie"]');ok(await espera(V,()=>ETERNA.bfSelfieAberto().cam&&!document.querySelector('#bf-selfie-modal [data-bs="buscar"]').disabled&&document.querySelector('#bf-selfie-modal video').videoWidth>0,10000),'Nova selfie abre o modal a partir da lista');
    await toque(V,'#bf-selfie-modal [data-bs="buscar"]');ok(await espera(V,()=>{const s=ETERNA.state.procurar.selfie;return !!s&&s.itens.length===2&&s.itens[0].card&&!document.querySelector('#bf-selfie-modal');},8000),'nova selfie com outro resultado');l=await lista(V);
    ok(igual(l.sel,[C.D])&&!l.varias&&l.certeza.length===2&&l.certeza[1].card===C.A&&!l.certeza[1].on&&l.certeza[1].off,'nova selfie: sai a sessão da busca anterior (C), entra a Certeza nova (D); a já vendida (A) vem com a caixa desligada: '+J([l.sel,l.certeza[1]]));
    await toque(V,'[data-act="bf-selfie-limpa"]');await V.waitForTimeout(250);
    ok(await V.evaluate(()=>{const p=ETERNA.state.procurar;return !p.selfie&&p.sel.length===0&&!!document.querySelector('#bf-lista')&&!document.querySelector('[data-act="bf-selfie-ver"]')&&document.querySelector('#bf-barra').hidden;}),'Descartar resultado tira as sessões da selfie e volta aos filtros');
    // ---------- recusas do servidor: a mensagem fica no modal e nada entra na tela ----------
    const recusa=async(resp,re,nome)=>{proxima=resp;await buscaSelfie(V);const okm=await espera(V,()=>{const m=document.querySelector('#bf-selfie-modal .bf-sf-msg');return !!m&&m.hasAttribute('data-erro');},8000);const m=await modal(V);
      ok(okm&&re.test(m.msg)&&m.el&&m.cam&&m.buscar&&await V.evaluate(()=>!ETERNA.state.procurar.selfie&&!document.querySelector('.bf-sf')&&ETERNA.state.procurar.sel.length===0),nome+': '+J(m.msg));await toque(V,'#bf-selfie-modal [data-bs="fechar"]');};
    await recusa({corpo:{ok:false,erro:'muitas_buscas'},status:429},/Muitas buscas/,'26: 429 vira "Muitas buscas em pouco tempo"');
    await recusa({corpo:{ok:false,erro:'desligado'},status:503},/desligada no servidor/,'503 vira "busca por selfie desligada"');
    await recusa({corpo:{error:'not found'},status:404},/desligada no servidor/,'404 (rota desligada) vira "busca por selfie desligada"');
    await recusa({corpo:{ok:false,erro:'busca'},status:500},/não respondeu/,'500 vira "não respondeu"');
    await recusa({corpo:{erro:'sem_permissao'},status:403},/não tem permissão/,'15: 403 vira "Você não tem permissão...", sem lista');
    await recusa({corpo:{ok:false,erro:'limite_dia'},status:429},/Limite de buscas por selfie de hoje atingido\. Procure pelos filtros e avise a supervisão\./,'7: 429 limite_dia tem texto próprio');
    await recusa({corpo:{ok:false,erro:'grande'},status:413},/não respondeu/,'413 não mostra lista');
    await recusa({corpo:{ok:true,busca:'3'.repeat(16),rosto:false,varias:false,fila:0,sessoes:[]}},/Não achei um rosto/,'sem rosto');
    await recusa({corpo:{ok:true,busca:'3'.repeat(16),rosto:true,varias:false,fila:0,sessoes:[]}},/Nenhuma sessão de hoje/,'rosto que não está em nenhuma sessão');
    await recusa({corpo:{ok:true,busca:'3'.repeat(16),rosto:true,varias:true,fila:0,sessoes:[]}},/mais de uma pessoa/,'vários rostos e nenhuma sessão');
    await recusa({corpo:{ok:true,busca:'<img src=x onerror=alert(1)>',rosto:true,sessoes:[{card:'<b>x</b>',nivel:'certeza',bateu:[]},{card:C.A,nivel:'outro',bateu:[]},null,7,{card:C.A}]}},/Nenhuma sessão de hoje/,'resposta fora do formato não entra na tela');
    // resposta que chega depois de o vendedor fechar o modal é descartada
    proxima={corpo:RESP0(),espera:900};await buscaSelfie(V);await V.waitForTimeout(150);ok((await modal(V)).busy,'a busca está em andamento');await V.keyboard.press('Escape');await V.waitForTimeout(1400);
    ok(await V.evaluate(()=>!ETERNA.state.procurar.selfie&&!document.querySelector('.bf-sf')&&ETERNA.state.procurar.sel.length===0)&&(await modal(V)).vivas===0,'resposta que chega com o modal já fechado é descartada');
    // ---------- câmera ocupada (o Checkout com ela): aviso claro, o Checkout não é tocado ----------
    await V.evaluate(()=>{window.__camErro='NotReadableError';});await toque(V,'[data-act="bf-selfie"]');
    ok(await espera(V,()=>{const m=document.querySelector('#bf-selfie-modal .bf-sf-msg');return !!m&&m.hasAttribute('data-erro');},6000),'câmera ocupada: o modal mostra o erro');
    {const m=await modal(V);ok(/câmera está em uso/.test(m.msg)&&!m.cam&&!m.buscar&&m.deNovo&&m.vivas===0,'câmera ocupada: "A câmera está em uso...", Procurar desligado e Tentar a câmera de novo: '+J(m));}
    await V.evaluate(()=>{window.__camErro=null;});await toque(V,'#bf-selfie-modal [data-bs="cam"]');
    ok(await espera(V,()=>ETERNA.bfSelfieAberto().cam&&!document.querySelector('#bf-selfie-modal [data-bs="buscar"]').disabled,8000),'Tentar a câmera de novo abre quando ela fica livre');
    await V.evaluate(()=>{window.__camErro='NotAllowedError';});await toque(V,'#bf-selfie-modal [data-bs="fechar"]');await toque(V,'[data-act="bf-selfie"]');
    ok(await espera(V,()=>{const m=document.querySelector('#bf-selfie-modal .bf-sf-msg');return !!m&&/não abriu/.test(m.textContent);},6000),'câmera sem permissão: "A câmera não abriu..."');await V.evaluate(()=>{window.__camErro=null;});
    {const st=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,cams:window.__cams.length,bf:window.__bf}));ok(st.step==='code'&&st.cams===0&&st.bf===0,'com a câmera ocupada ou negada no vendedor, o Checkout segue igual: '+J(st));}
    // ---------- sair da tela ou da conta com o modal aberto ou com resultado ----------
    await toque(V,'#bf-selfie-modal [data-bs="fechar"]');ok(await abreModal(V),'modal aberto para sair da tela');await V.evaluate(()=>ETERNA.go('posto'));ok(await espera(V,()=>!document.querySelector('#bf-selfie-modal'),3000),'o modal some ao sair da tela');
    {const m=await modal(V);ok(!m.el&&m.vivas===0,'sair da tela fecha o modal e solta a câmera: '+J(m));}
    ok(await procurar(V),'Procurar fotos de novo');RESP=RESP0();await buscaSelfie(V);ok(await espera(V,()=>!!document.querySelector('.bf-sf'),8000),'resultado na tela');
    // 9: uma sessão da lista é vendida em outro posto: o cartão dela acompanha (caixa desligada, "Já vendida"), sem o vendedor sair da lista
    {const antes=await V.evaluate(c=>{const k=document.querySelector('.bf-sf .bf-sfc[data-card="'+c+'"]');return {off:k.querySelector('.bf-marca').disabled,est:(k.querySelector('.bf-est')||{textContent:''}).textContent};},C.D);
      x.EVENTOS.push({tipo:'criar',idem:'vfora9:1',venda:'vfora9',em:new Date().toISOString(),dados:{card:C.D,sessoes:[C.D],total:50,saleNo:'L0-909',canal:'balcao'}});
      await V.evaluate(()=>{ETERNA.MVS.t=0;});await toque(V,'.bf-sf .bf-mk[data-card="'+C.C+'"] .bf-marca'); // qualquer toque na lista pede as vendas do dia
      const mudou=await espera(V,c=>{const k=document.querySelector('.bf-sf .bf-sfc[data-card="'+c+'"]');return !!k&&k.querySelector('.bf-marca').disabled&&/vendida/i.test((k.querySelector('.bf-est')||{textContent:''}).textContent);},8000,C.D);
      ok(!antes.off&&!antes.est&&mudou&&await V.evaluate(()=>!!document.querySelector('.bf-sf')&&!!ETERNA.state.procurar.selfie),'9: sessão da lista vendida em outro posto: o cartão passa a "Já vendida" com a caixa desligada: '+J(antes));}
    await V.evaluate(()=>ETERNA.logout());await V.waitForTimeout(700);
    ok(await V.evaluate(()=>!ETERNA.state.user&&!ETERNA.state.procurar.selfie&&ETERNA.state.procurar.sel.length===0&&!document.querySelector('.bf-sf,#bf-selfie-modal')),'sair da conta apaga o resultado da selfie e a seleção');
    // ---------- 19: a janela do cliente não tem a busca ----------
    {const r=await L.evaluate(()=>{ETERNA.bfSelfie();return {modal:!!document.querySelector('#bf-selfie-modal'),pode:ETERNA.bfSelfiePode(),cams:window.__cams.length,bt:!!document.querySelector('[data-act^="bf-selfie"]')};});
      ok(!r.modal&&r.pode===false&&r.cams===0&&!r.bt,'19: na aba #loja, bfSelfie() não abre nada e bfSelfiePode() é falso: '+J(r));}
    ok((await L.evaluate(()=>window.__bf))===0,'14: até o fim, nada do Procurar fotos nem da selfie no DOM do cliente');
    await x.ctx.close();}
  // ================= venda de uma sessão sem o Checkout aberto: Venda manual, e o servidor recebe a marcação =================
  {const marcar=[];const x=await contexto(b,{troca:h=>ligaSelfie(h).replace('const BF_SEL_MAX=8,','const BF_SEL_MAX=1,'),rotas:(p,rq)=>p==='/rostos/sessoes'?{corpo:Object.assign(RESP0(),{sessoes:[ses('A','certeza',1),ses('C','certeza',1),ses('B','pode_ser',1)]})}:p==='/rostos/sessoes/marcar'?(marcar.push(rq.postData()),marcar.length===1?{corpo:{ok:false,erro:'registro'},status:500}:{corpo:{ok:true}}):null});errs.push(x.errs);
    const pg=await x.pagina('sem-checkout');ok(await entrar(pg,CAIXA),'login sem Checkout aberto');await chegou(pg);await procurar(pg);await pg.waitForTimeout(5600); // passa o prazo de espera pelo anúncio do Checkout
    await buscaSelfie(pg);ok(await espera(pg,()=>!!document.querySelector('.bf-sf'),8000),'lista da selfie sem o Checkout');
    ok(await pg.evaluate(a=>ETERNA.state.procurar.sel.join()===a,C.A)&&/No máximo 1 sess/.test(await aviso(pg)),'13: mais Certezas do que cabem numa venda: marca até o teto e avisa (teste com o teto em 1): '+await aviso(pg));
    await toque(pg,'#bf-barra [data-act="bf-vender"]');
    ok(await espera(pg,()=>ETERNA.state.view==='posto'&&!ETERNA.state.procurar.selfie,6000),'uma sessão e nenhum Checkout aberto: segue pela Venda manual e o resultado da selfie some');
    ok(await ate(()=>marcar.length>=2,6000)&&JSON.parse(marcar[0]).busca===BUSCA&&J(JSON.parse(marcar[0]).cards)===J([C.A])&&marcar[1]===marcar[0],'a marcação vai ao servidor também pela Venda manual; 14: falhou, tenta de novo: '+J(marcar));
    await pg.waitForTimeout(2600);ok(marcar.length===2,'14: é uma segunda tentativa só: '+marcar.length);
    await x.ctx.close();}
  // ================= quem não vê o botão =================
  {const x=await contexto(b,{troca:ligaSelfie});errs.push(x.errs);const pg=await x.pagina('fotografo');ok(await entrar(pg,FOTO),'login do fotógrafo');await procurar(pg,5);
    const r=await pg.evaluate(()=>{ETERNA.bfSelfie();const bt=document.querySelectorAll('[data-act^="bf-selfie"]').length;document.body.insertAdjacentHTML('beforeend','<button id="forja" data-act="bf-selfie">x</button>');document.getElementById('forja').click();document.getElementById('forja').remove();
      return {bt,pode:ETERNA.bfSelfiePode(),modal:!!document.querySelector('#bf-selfie-modal'),cams:window.__cams.length};});
    ok(r.bt===0&&r.pode===false&&!r.modal&&r.cams===0,'fotógrafo sem venda: sem o botão; chamada direta e clique forjado não abrem o modal nem a câmera: '+J(r));await x.ctx.close();}
  {const x=await contexto(b,{troca:ligaSelfie});errs.push(x.errs);const pg=await x.pagina('admin');ok(await entrar(pg,ADMIN),'login do Admin');await chegou(pg);await procurar(pg);
    const r=await pg.evaluate(()=>{ETERNA.state.assumido={por:'admin.teste@exemplo.com',em:new Date().toISOString()};ETERNA.render();ETERNA.bfSelfie();const bt=document.querySelectorAll('[data-act^="bf-selfie"]').length;
      document.body.insertAdjacentHTML('beforeend','<button id="forja" data-act="bf-selfie">x</button>');document.getElementById('forja').click();document.getElementById('forja').remove();
      const o={bt,pode:ETERNA.bfSelfiePode(),modal:!!document.querySelector('#bf-selfie-modal'),cams:window.__cams.length};ETERNA.state.assumido=null;ETERNA.render();return o;});
    ok(r.bt===0&&r.pode===false&&!r.modal&&r.cams===0,'em "ver como": sem o botão; chamada direta e clique forjado não abrem o modal nem a câmera: '+J(r));await x.ctx.close();}
  {const x=await contexto(b,{troca:ligaSelfie});errs.push(x.errs);const pg=await x.pagina('perfil-checkout');await entrar(pg,QUIOSQUE);await pg.waitForTimeout(600);await chegou(pg);
    const r=await pg.evaluate(()=>{ETERNA.go('procurar');ETERNA.bfSelfie();return {bt:document.querySelectorAll('[data-act^="bf-selfie"]').length,pode:ETERNA.bfSelfiePode(),modal:!!document.querySelector('#bf-selfie-modal'),cams:window.__cams.length};});
    ok(r.bt===0&&r.pode===false&&!r.modal&&r.cams===0,'19: no perfil Checkout não há botão nem busca: '+J(r));await x.ctx.close();}
  // ================= servidor com o reconhecimento ou com a busca do vendedor desligados: o botão nem aparece =================
  for(const [nome,op] of [['reconhecimento desligado',{rostos:false}],['busca do vendedor desligada no servidor (como nasce)',{buscaVend:false}]]){let n=0;
    const x=await contexto(b,Object.assign({troca:ligaSelfie,rotas:p=>p==='/rostos/sessoes'?(n++,{corpo:{error:'not found'},status:404}):null},op));errs.push(x.errs);const pg=await x.pagina('servidor-desligado');ok(await entrar(pg,CAIXA),'login: '+nome);await chegou(pg);await procurar(pg);
    const r=await pg.evaluate(()=>{ETERNA.bfSelfie();document.body.insertAdjacentHTML('beforeend','<button id="forja" data-act="bf-selfie">x</button>');document.getElementById('forja').click();document.getElementById('forja').remove();
      return {bt:document.querySelectorAll('#main [data-act^="bf-selfie"]').length,pode:ETERNA.bfSelfiePode(),modal:!!document.querySelector('#bf-selfie-modal'),cams:window.__cams.length,marca:document.querySelectorAll('#bf-lista .bf-marca').length};});
    ok(r.bt===0&&r.pode===false&&!r.modal&&r.cams===0&&n===0&&r.marca>0,'B1: '+nome+': sem o botão, sem câmera e sem chamada ao servidor; os filtros e o Marcar seguem: '+J(r));await x.ctx.close();}
  // ================= 10: a câmera do modal nunca fica presa (prazo rearmado ao fim de uma busca sem resultado) =================
  {const x=await contexto(b,{troca:h=>ligaSelfie(h).replace('BF_SF_CAM_MS=60000','BF_SF_CAM_MS=2500'),rotas:p=>p==='/rostos/sessoes'?{corpo:{ok:false,erro:'limite_dia'},status:429}:null});errs.push(x.errs);
    const pg=await x.pagina('prazo');ok(await entrar(pg,CAIXA),'login para o prazo da câmera');await chegou(pg);await procurar(pg);
    ok(await abreModal(pg),'modal aberto (prazo de 2,5 s neste teste)');await pg.waitForTimeout(1500);await toque(pg,'#bf-selfie-modal [data-bs="buscar"]');
    ok(await espera(pg,()=>{const m=document.querySelector('#bf-selfie-modal .bf-sf-msg');return !!m&&/Limite de buscas/.test(m.textContent);},5000),'busca recusada, o modal segue aberto com o aviso');
    await pg.waitForTimeout(1500);{const m=await modal(pg);ok(m.el&&m.cam,'10: a busca sem resultado rearma o prazo (o modal ainda está aberto depois do prazo original): '+J(m));}
    ok(await espera(pg,()=>!document.querySelector('#bf-selfie-modal'),4000)&&(await modal(pg)).vivas===0,'10: e, parado, o modal fecha sozinho e solta a câmera');await x.ctx.close();}
  // ================= chave da tela desligada (como nasce): a tela é a da v99.104.0 =================
  {let n=0;const x=await contexto(b,{rotas:p=>p==='/rostos/sessoes'?(n++,{corpo:RESP0()}):null});errs.push(x.errs);
    const pg=await x.pagina('chave');ok(await entrar(pg,CAIXA),'login com a chave desligada');await chegou(pg);await procurar(pg);
    ok(/const PROCURAR_SELFIE_ON=false;/.test(require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8')),'B1: no index.html a chave nasce desligada');
    const html=await pg.evaluate(()=>document.querySelector('#bf').outerHTML);
    const r=await pg.evaluate(c=>{ETERNA.bfSelfie();document.body.insertAdjacentHTML('beforeend','<button id="forja" data-act="bf-selfie">x</button><button id="forja2" data-act="bf-selfie-ver">x</button>');document.getElementById('forja').click();document.getElementById('forja2').click();
      const o={bt:document.querySelectorAll('#main [data-act^="bf-selfie"],.bf-sf').length,pode:ETERNA.bfSelfiePode(),modal:!!document.querySelector('#bf-selfie-modal'),cams:window.__cams.length,marca:document.querySelectorAll('#bf-lista .bf-marca').length,vende:ETERNA.bfPodeVender()};document.getElementById('forja').remove();document.getElementById('forja2').remove();return o;},C.A);
    ok(r.bt===0&&r.pode===false&&!r.modal&&r.cams===0&&n===0&&r.marca>0&&r.vende===true,'B1: chave desligada: sem botão, sem modal, sem câmera e sem chamada; Marcar e a venda da fase 1 seguem: '+J(r));
    ok(!/selfie|bf-sf/.test(html),'B1: chave desligada: o HTML da tela não tem nada da selfie');
    await marca(pg,C.A);ok(await pg.evaluate(()=>/1 sess/.test(document.querySelector('#bf-barra-n').textContent)),'com a chave desligada, marcar e a barra funcionam como na fase 1');await x.ctx.close();}
  ok(!errs.flat().length,'erros de página: '+errs.flat().join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA procurar-selfie: '+fails.join(' || '));process.exit(1);}
console.log('OK procurar-selfie: modal de câmera só na janela do vendedor (sem arquivo, solta a câmera), Certeza marcada antes de Pode ser desmarcado, fotos do rosto em destaque, Adicionar pelos filtros, Checkout aberto só com o conjunto final (procurar_selfie), aviso do rosto maior, recusas, câmera ocupada, chave desligada e nada da busca fora da janela do vendedor');process.exit(0);})();
