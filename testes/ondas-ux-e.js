// v94-ux parte E: Posto de venda como tela única e Fundo de IA só na Venda manual (critérios E1 a E11 do plano
// docs/planos/2026-11-09-ondas-ux.md). Sem agente: o "agente" é só o page.route na própria origem (/file/, /thumb/).
// E2 (SIM igual ao da v93): a mesma venda é confirmada pelo bloco "Agora no Checkout" e, numa segunda sessão igual, pela
// função da v83/v93 (pendConfirmar) chamada direto; o resultado é comparado campo a campo, menos datas, ids e códigos.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-e-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,400),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);
const IMG=fs.readFileSync(TMP+'/a.jpg');
async function rotas(ctx){await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));}
function vigia(pg,n){pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(n+': '+e.message));return pg;}
async function entrar(pg,email){await require('./_entrar')(pg,email);return pg.evaluate(()=>!!ETERNA.state.user);}
async function sair(pg){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(350);}
const sim=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')));
const txt=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\s+/g,' '):'';},s);
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;if(ETERNA.state.kiosk.step!=='code'){ETERNA.state.kiosk.step='code';ETERNA.render();}});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(500);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.state.kiosk.step='cart';ETERNA.render();},[card,n]);await L.waitForTimeout(200);}
// v96-ux: o Checkout não escolhe pacote nem meio (v96). "ljPagar" = o cliente toca em Continuar e o vendedor (janela A, Posto) escolhe o Ideal e o meio
let POSTO=null;
async function ljPagar(L,m){await L.evaluate(()=>ETERNA.lojaPedir());await L.waitForTimeout(400);const id=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);if(!id||!POSTO)return;
  await POSTO.evaluate(([id,m])=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(!r||!r.escolha)return;ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:{card:'cartao',cash:'dinheiro',pix:'pix'}[m]||m});},[id,m]);await L.waitForTimeout(500);}
const pendDe=(pg,card)=>pg.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&(x.estado==='aguardando'||x.estado==='escolha')),card);
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(await pg.evaluate(fn,arg))return true;await sleep(120);}return false;};
// resultado de uma venda confirmada, sem datas, ids, códigos nem o número da sessão
async function venda(pg,card,id){return pg.evaluate(([card,id])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[card];const r=S.caixaDin.find(x=>x.id===id);
  const fila=JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').filter(e=>e.venda===id||e.id===id||(e.dados&&e.dados.card===card)).map(e=>e.tipo||e.t||e.acao);
  return {s:{status:s.status,payment:s.payment,total:s.total,nFotos:s.nFotos,prints:s.prints,cart:s.cart,nSel:(s.selected||[]).length,seller:s.seller,posto:s.posto,pag:s.pag&&{prov:s.pag.prov,ref:s.pag.ref,porNome:s.pag.porNome},imp:s.impressao&&s.impressao.estado,vendedor:s.vendedor,din:s.din||null,vendaIdOk:s.vendaId===id},
    r:{estado:r.estado,ref:r.ref,meio:r.meio,prov:r.prov,porNome:r.porNome,motivo:r.motivo,total:r.total,prints:r.prints},stock:S.stock['Caixa 1'],fila};},[card,id]);}
(async()=>{const b=await chromium.launch();
try{
  // ---- E1 e E10: Atendimento e venda
  {const ctx=await b.newContext({viewport:{width:1440,height:900}});await rotas(ctx);const V=vigia(await ctx.newPage(),'V');await V.goto(U);await V.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await V.reload();await V.waitForTimeout(400);
    ok(await entrar(V,'loja@eterna.photo'),'E1: vendedor não entrou');
    const e1=await V.evaluate(()=>({v:ETERNA.state.view,h1:document.querySelector('#main h1').textContent,eb:document.querySelector('#main .head .eyebrow').textContent}));
    ok(e1.v==='posto'&&e1.h1==='Posto de venda'&&e1.eb==='Caixa 1','E1: '+J(e1));
    // E10: barra com Abrir Checkout e Posto de venda (PIX conta)
    // v96-ux (Eduardo, 10/11, cace1c4): os dois botões amarelos no alto do menu, Abrir Checkout e Caixa, para quem pode usá-los
    // v94-ux (parte H): o botão "Posto de venda" da barra saiu (o Posto está no menu); o número fica no item do menu (#nav [data-v="posto"] #rail-din)
    await V.evaluate(()=>{const S=ETERNA.SIM;S.caixaDin.unshift({id:'L00-teste0pix1',card:'LPTESTEPIX',codigo:'ABCD-EFGH',criada:new Date().toISOString(),total:70,prints:1,n:1,cart:[{id:'arq'}],selected:[],meio:'pix',prov:'pos-manual',estado:'aguardando'});localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.render();});
    const e10=await V.evaluate(()=>({ck:!!document.querySelector('#rail-ck [data-act="loja-abrir"]'),posto:(document.querySelector('#nav [data-v="posto"]')||{}).innerText||'',caixa:!!document.querySelector('#rail-ck [data-v="caixa"]'),din:(document.querySelector('#rail-din')||{}).textContent||'',t:document.querySelector('#rail-ck').innerText}));
    ok(e10.ck&&/Posto de venda/.test(e10.posto)&&e10.din==='1'&&e10.caixa&&/\bCaixa\b/.test(e10.t),'E10: barra do vendedor: '+J(e10));
    await ctx.close();}
  const ctx=await b.newContext({viewport:{width:1440,height:900}});await rotas(ctx);
  const A=vigia(await ctx.newPage(),'A');await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(500);
  ok(await entrar(A,'eduardo@eduardorezende.com'),'admin não entrou');POSTO=A;
  const [L]=await Promise.all([ctx.waitForEvent('page'),A.click('.rail [data-act="loja-abrir"]')]);vigia(L,'L');await L.waitForLoadState();await L.waitForTimeout(800);
  ok(await A.evaluate(()=>ETERNA.state.view)==='posto','E: abrir Checkout leva o admin ao Posto');
  await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=8).map(s=>s.card));ok(cards.length>=6,'poucas sessões de exemplo: '+cards.length);
  ok(await A.evaluate(()=>/Agora no Checkout/.test(document.querySelector('#main').textContent)),'E: título "Agora no Checkout"');
  // ---- E2 (v96-ux): o pedido do Checkout (escolha:true) tem pacote e meio escolhidos no Posto; as ações ficam em "Aguardando pagamento"
  // e o bloco "Agora no Checkout" mostra só o código (ecoPendR exclui escolha:true)
  await ljSessao(L,cards[0],4);await ljPagar(L,'card');const p0=await pendDe(L,cards[0]);ok(!!p0,'E2: pendência do cartão');
  ok(await espera(A,id=>!!document.querySelector(`#pend-painel [data-act="pend-pos"][data-id="${id}"]`),3000,p0&&p0.id),'E2: "Pago na maquininha" em Aguardando pagamento');
  ok(await espera(A,c=>((document.querySelector('#eco .eco-cod')||{}).textContent||'')===c,3000,p0.codigo),'E2: código no bloco Agora no Checkout');
  const e2=await A.evaluate(()=>({ecoBtn:document.querySelectorAll('#eco button').length,acoesLista:document.querySelectorAll('#pend-painel [data-act="pend-pos"]').length}));
  ok(e2.ecoBtn===0&&e2.acoesLista===1,'E2: ações só na lista (pedido do Checkout): '+J(e2));
  await A.click(`#pend-painel [data-act="pend-pos"][data-id="${p0.id}"]`);await A.waitForTimeout(150);
  ok(await A.evaluate(()=>document.querySelectorAll('#pend-ref').length===1&&!!document.querySelector('#pend-painel #pend-ref')),'risco 4: um só #pend-ref');
  // ---- E8: digitando o NSU, a troca de idioma no Checkout não apaga
  await A.click('#pend-ref');await A.keyboard.type('1234');
  await L.click('[data-act="lang"][data-l="en"]').catch(()=>L.evaluate(()=>{ETERNA.state.lang='en';ETERNA.render();}));await sleep(1300);
  await A.keyboard.type('56');ok(await A.evaluate(()=>(document.querySelector('#pend-ref')||{}).value)==='123456','E8: o NSU digitado se perdeu com a troca de idioma');
  await A.click(`[data-act="pend-pos-ok"][data-id="${p0.id}"]`);await A.waitForTimeout(400);
  ok(await espera(L,()=>!!document.querySelector('#lqr'),2500),'E2: o Checkout vai ao QR');
  const r1=await venda(A,cards[0],p0.id);
  ok(r1.s.status==='paga'&&r1.r.estado==='confirmada'&&r1.s.pag.ref==='123456','E2: venda paga pelo bloco: '+J(r1));
  // mesma venda numa segunda sessão, pelo caminho da v93 (pendConfirmar direto)
  await L.click('[data-act="loja-new"]').catch(()=>{});await L.evaluate(()=>{ETERNA.state.lang='pt';});
  await ljSessao(L,cards[1],4);await ljPagar(L,'card');const p1=await pendDe(L,cards[1]);await A.waitForTimeout(400);
  await A.evaluate(id=>ETERNA.pendConfirmar(id,{ref:'123456'}),p1.id);await A.waitForTimeout(300);const r2=await venda(A,cards[1],p1.id);
  ok(J(r1)===J(r2),'E2: SIM igual ao caminho da v93: '+J(r1)+' ≠ '+J(r2));
  // ---- E3: com 2 pendências, o bloco de cima não tem botões; as duas aparecem com as ações
  await L.click('[data-act="loja-new"]').catch(()=>{});await ljSessao(L,cards[2],3);await ljPagar(L,'pix');const p2=await pendDe(L,cards[2]);
  ok(await espera(A,id=>!!document.querySelector(`#pend-painel [data-act="pend-pos"][data-id="${id}"]`)&&!document.querySelector('#eco button'),3000,p2.id),'E3 (v96-ux): pedido do Checkout: ações na lista, nenhuma no bloco');
  await A.evaluate(()=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));S.caixaDin.unshift({id:'L00-teste0din01',card:'LPTESTEDIN',codigo:'WXYZ-2345',criada:new Date().toISOString(),total:110,prints:0,n:3,cart:[{id:'zona'}],selected:[],meio:'dinheiro',prov:'dinheiro',estado:'aguardando'});localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();ETERNA.render();});
  ok(await espera(A,()=>!document.querySelector('#eco [data-act]')||!document.querySelector('#eco button'),3000),'E3: com 2 pendências o bloco de cima não tem botões');
  const e3=await A.evaluate(([a,b])=>({a:!!document.querySelector(`#pend-painel [data-act="pend-pos"][data-id="${a}"]`),b:!!document.querySelector(`#pend-painel [data-act="din-confirm"][data-id="${b}"]`),ecoBtn:document.querySelectorAll('#eco button').length}),[p2.id,'L00-teste0din01']);
  ok(e3.a&&e3.b&&e3.ecoBtn===0,'E3: as duas na lista com as ações: '+J(e3));
  // ---- E4: Cancelar compra em linha separada, à direita, ≥ 24 px da principal; principal com 56 px; dois toques
  const e4=await A.evaluate(id=>{const it=document.querySelector(`#pend-painel [data-pend="${id}"]`);const m=it.querySelector('.pend-main'),c=it.querySelector('.link-danger');if(!m||!c)return null;const a=m.getBoundingClientRect(),d=c.getBoundingClientRect(),p=it.getBoundingClientRect();
    return {h:a.height,gap:d.top-a.bottom,dir:p.right-d.right,esq:d.left-p.left,txt:c.textContent};},'L00-teste0din01');
  ok(e4&&e4.h>=56&&e4.gap>=24&&e4.dir<40&&e4.esq>e4.dir&&e4.txt==='Cancelar compra','E4: posição do Cancelar compra: '+J(e4));
  await A.click('#pend-painel [data-act="din-cancel"][data-id="L00-teste0din01"]');await A.waitForTimeout(150);
  ok(await A.evaluate(()=>!!document.querySelector('#pend-painel [data-act="din-cancel-ok"]'))&&(await pendDe(A,'LPTESTEDIN')),'E4: o cancelamento pede o segundo toque');
  await A.click('[data-act="din-cancel-no"]');await A.waitForTimeout(150);
  // ---- E5: filtro Dinheiro no Posto; #caixa abre a tela Caixa de antes (v96-ux, Eduardo, cdcf4b5) com o dinheiro aguardando
  await A.click('[data-act="posto-filtro"][data-f="dinheiro"]');await A.waitForTimeout(150);
  let e5=await A.evaluate(()=>[...document.querySelectorAll('#pend-painel [data-pend]')].map(x=>x.dataset.pend));ok(e5.length===1&&e5[0]==='L00-teste0din01','E5: filtro Dinheiro: '+J(e5));
  await A.click('[data-act="posto-filtro"][data-f="todos"]');await A.waitForTimeout(150);
  await A.evaluate(()=>{location.hash='#caixa';});await A.waitForTimeout(400);
  e5=await A.evaluate(()=>({v:ETERNA.state.view,h1:document.querySelector('#main h1').textContent,ids:[...document.querySelectorAll('#pend-painel [data-pend]')].map(x=>x.dataset.pend),on:(document.querySelector('[data-act="posto-filtro"][aria-pressed="true"]')||{}).dataset}));
  ok(e5.v==='caixa'&&e5.h1==='Caixa'&&e5.ids.includes('L00-teste0din01'),'E5: #caixa abre a tela Caixa com o dinheiro aguardando: '+J(e5));
  // ---- E6: rolo 120 neutro, 99 amarelo, 39 vermelho em Posto, Estoque e Venda manual; nunca verde
  for(const [n,cls] of [[120,'neutral'],[99,'warn'],[39,'bad']]){
    await A.evaluate(n=>{ETERNA.SIM.stock['Caixa 1']=n;localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));ETERNA.go('posto');},n);await A.waitForTimeout(150);
    const ps=await A.evaluate(()=>[...document.querySelectorAll('#main .pill')].filter(p=>/Rolo:/.test(p.textContent)).map(p=>p.className));
    ok(ps.length>=1&&ps.length<=2&&ps.every(c=>c.includes(cls)&&!c.includes('good')),`E6: rolo ${n} no Posto (v96-ux: selo no cabeçalho e no Imprimir, como na v96; ${cls}): `+J(ps));
    await A.evaluate(()=>ETERNA.go('checkout'));await A.waitForTimeout(150);
    const pc=await A.evaluate(()=>[...document.querySelectorAll('#main .pill')].filter(p=>/Rolo:/.test(p.textContent)).map(p=>p.className));ok(pc.length===1&&pc[0].includes(cls),`E6: rolo ${n} na Venda manual: `+J(pc));
    await A.evaluate(()=>ETERNA.go('estoque'));await A.waitForTimeout(150);
    const es=await A.evaluate(()=>{const t=[...document.querySelectorAll('#main .tile')].find(x=>/Caixa 1/.test(x.textContent));return t?{c:t.querySelector('.v').style.color,d:t.querySelector('.d').textContent}:null;});
    const esp=n<40?['var(--bad)','Trocar antes do pico']:n<100?['var(--warn)','Trocar logo']:['inherit',''];
    ok(es&&es.c===esp[0]&&(!esp[1]||es.d===esp[1]),`E6: rolo ${n} no Estoque: `+J(es));}
  await A.evaluate(()=>{ETERNA.SIM.stock['Caixa 1']=600;localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));ETERNA.go('posto');});await A.waitForTimeout(150);
  // ---- E7: agente fora com último dado
  await A.evaluate(()=>{ETERNA.state.agent.on=false;ETERNA.state.agent.lastOk=Date.now()-120000;ETERNA.render();});
  const e7=await A.evaluate(()=>({off:(document.querySelector('#main .conn-off')||{}).textContent||'',good:document.querySelectorAll('#main .posto-head .pill.good').length,ag:/agente ligado|sem agente/.test(document.querySelector('#main').innerText)}));
  ok(/Sem conexão com o computador do ponto · último dado às \d\d:\d\d/.test(e7.off)&&e7.good===0&&!e7.ag,'E7: '+J(e7));
  // ---- E9: Venda manual pelo link do Posto; fundo de IA nunca no Checkout do cliente
  await A.click('.posto-rodape [data-act="view"][data-v="checkout"]');await A.waitForTimeout(200);
  const e9=await A.evaluate(()=>({v:ETERNA.state.view,h1:document.querySelector('#main h1').textContent,eb:document.querySelector('#main .head .eyebrow').textContent}));
  ok(e9.v==='checkout'&&e9.h1==='Venda manual'&&/quando o Checkout está fora/.test(e9.eb),'E9: Venda manual: '+J(e9));
  ok(await A.evaluate(()=>ETERNA.lojaIdeal&&true),'E9: lojaIdeal');
  await A.evaluate(()=>ETERNA.go('catalogo'));await A.waitForTimeout(200);
  // v98.1 (Ronaldo, 11/11): produto que não existe na Imply não é cadastrado; o Fundo de IA saiu da tabela de preços
  ok(!(await A.evaluate(()=>[...document.querySelectorAll('#main tr')].some(x=>/Fundo de IA/i.test(x.textContent)))),'E9: Fundo de IA fora da tabela de preços (v98.1)');
  const big=await L.evaluate(()=>{const s=ETERNA.demoSessions().map(s=>[s.card,ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length]).sort((a,b)=>b[1]-a[1])[0];return s;});
  for(const n of [1,6,Math.min(15,big[1])]){await L.click('[data-act="loja-new"]').catch(()=>{});await ljSessao(L,big[0],n);
    const t=await L.evaluate(()=>document.querySelector('#main').innerText);const lines=await L.evaluate(c=>JSON.stringify(ETERNA.lojaCart(c).lines),big[0]).catch(()=>null);
    ok(!/Fundo de IA[^\n]*R\$|R\$[^\n]*Fundo de IA/i.test(t)&&!/fundo/i.test(String(lines)),`E9: Checkout com ${n} fotos mostra Fundo de IA com preço: `+t.slice(0,200));}
  // ---- E11: Recibo em Minhas vendas abre o recibo com QR e Mostrar ao cliente
  await A.evaluate(()=>ETERNA.go('posto'));await A.waitForTimeout(200);
  ok(await A.evaluate(()=>{const d=document.querySelector('details.mv-det');return !!d&&d.open&&!!d.querySelector('#minhas-vendas');}),'E: Minhas vendas de hoje dentro de <details> aberto');
  const rb=await A.$(`#minhas-vendas [data-act="caixa-open"][data-card="${cards[0]}"]`);ok(!!rb,'E11: botão Recibo na venda paga');
  if(rb){await rb.click();await A.waitForTimeout(500);
    const e11=await A.evaluate(()=>({v:ETERNA.state.view,rec:/Recibo ·/.test(document.querySelector('#main').textContent),qr:!!document.querySelector('#qrbox canvas,#qrbox img,#qrbox svg,#qrbox table'),mostrar:!!document.querySelector('#main [data-act="eco-qr"]')}));
    ok(e11.v==='posto'&&e11.rec&&e11.qr&&e11.mostrar,'E11: recibo com QR e Mostrar ao cliente em cima do Posto: '+J(e11));}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-e: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-e: Posto de venda (E1 a E11)');process.exit(0);
})();
