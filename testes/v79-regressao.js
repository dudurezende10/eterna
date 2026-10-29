// v79: dinheiro aguardando caixa (1.1 a 1.15), interruptor do ajuste automático no Upload (2.1 a 2.7), botão Início da equipe
// no Checkout (3.1 a 3.6) e valor do pacote no carrinho (4.1 a 4.9). Regras do Eduardo (28/10): as fotos com fundo de IA contam
// dentro do pacote; Ideal só pelo preço; catálogo novo (Tribuna 12 fotos R$ 220, Maracanã 9 R$ 190, Gramado 6 R$ 150, Zona Mista 3 só
// digitais R$ 110, Arquibancada 1 R$ 70, foto adicional digital e impressa R$ 35). Caso do print = 4 do campo + 4 com fundo de IA = 8 fotos
// → Ideal Maracanã R$ 190 com 8 impressas (Gramado + 2 adicionais = R$ 220, também 8 impressas). Economia contra a compra avulsa
// real (Arquibancada + adicionais): 70 + 7 × 35 = 315 − 190 = R$ 125. Também cobre as correções da revisão (B1, I1 a I6, N1, N4, N6, revisor 1 a 12).
// Checkout (#loja) e Caixa ficam em duas janelas do mesmo navegador (mesmo contexto do Playwright). Prints em testes/prints/v79-*.png.
const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PRECO={mais:250,tribuna:220,maracana:190,gramado:150,zona:110,arq:70,extra:35,dig:39};
let fase='início';
function vigia(pg,nome){pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(`${nome}: ${e.message}`));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(`${nome}: ${m.text()}`);});return pg;}
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1280,height:h||900}});return ctx;}
async function pagina(ctx,nome){return vigia(await ctx.newPage(),nome);}
async function login(pg,email){await pg.goto(U);await pg.waitForTimeout(350);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.reload();await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
async function codigo(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
const txt=(pg,sel)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\s+/g,' ').trim():null;},sel);
const toastTxt=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent.replace(/\s+/g,' '));
const sim=pg=>pg.evaluate(()=>JSON.parse(JSON.stringify(ETERNA.SIM)));
async function verView(pg,v){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(150);}
// abre a sessão no Checkout pelo código do recibo e marca nPh fotos do campo e nAI com fundo de IA
async function lojaSessao(pg,card,nPh,nAI){await pg.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true; /* a câmera simulada acha um rosto sozinha: no teste, a sessão vem pelo código */const k=ETERNA.state.kiosk;if(k.step!=='code'){k.step='code';ETERNA.render();}});
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(700);
  for(let t=0;t<3;t++){const r=await pg.evaluate(([card,nPh,nAI])=>{const it=ETERNA.lojaItems(card);const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);
      it.filter(x=>x.t==='ph').slice(0,nPh).forEach(x=>pk[x.k]='ok');it.filter(x=>x.t==='ai').slice(0,nAI).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;
      const c=ETERNA.lojaCart(card);return [c.nPh,c.nAI];},[card,nPh,nAI]);
    if(r[0]===nPh&&r[1]===nAI)break;await pg.waitForTimeout(700);}
  await pg.evaluate(()=>{ETERNA.state.kiosk.step='cart';ETERNA.render();});await pg.waitForTimeout(250);}
async function carrinho(pg){return pg.evaluate(()=>{const q=s=>[...document.querySelectorAll(s)];const T=e=>e?e.innerText.replace(/\s+/g,' ').trim():'';
  return {on:(document.querySelector('.lj-pkg.on')||{dataset:{}}).dataset.id,ideal:(q('.lj-pkg').find(b=>b.querySelector('.lj-badge'))||{dataset:{}}).dataset.id,
    extras:Object.fromEntries(q('.lj-pkg').map(b=>[b.dataset.id,T(b.querySelector('.lj-pkgx'))])),sum:q('.lj-sumrow').map(T),total:T(document.querySelector('.lj-total b')),
    save:T(document.querySelector('.lj-save')),incl:T(document.querySelector('.lj-incl')),fine:q('.lj-order .lj-fine').map(T),btn:T(document.querySelector('.lj-paybtn')),
    sw:document.documentElement.scrollWidth<=innerWidth+1,raw:/\b(sumPkg|sumExtra|roomFor|pkgPlusExtra|payBtnCash|cashNote|ljCash|ljStaff)/.test(document.body.innerText)};});}
// v83: cartão e PIX ficam aguardando; o vendedor confirma "Pago na maquininha" na outra janela (Caixa)
async function maquininha(A,B){await sleep(500);const id=await A.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);await B.waitForSelector(`[data-act="pend-pos"][data-id="${id}"]`,{timeout:3000}).catch(()=>null);
  await B.click(`[data-act="pend-pos"][data-id="${id}"]`);await B.click(`[data-act="pend-pos-ok"][data-id="${id}"]`);await B.waitForTimeout(400);}
async function pagar(pg,m){await pg.click(`[data-act="loja-paym"][data-m="${m}"]`);await pg.waitForTimeout(120);await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(500);}

(async()=>{const b=await chromium.launch();
try{
  const SO=(process.env.V79_SO||'1,2,3').split(',');
  if(SO.includes('1')){
  // =================== Item 4 e item 1: Checkout (janela A) e Caixa (janelas B e C) no mesmo navegador ===================
  fase='preparação';
  const ctx=await nova(b,1366,900);
  const A=await pagina(ctx,'A #loja');await A.goto(U+'#loja');await A.evaluate(()=>{localStorage.clear();});await A.reload();await A.waitForTimeout(1200);
  const cards=await A.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=10&&ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=10&&ETERNA.lojaItems(s.card).filter(x=>x.t==='ai').length>=4).map(s=>s.card).slice(0,6));
  ok(cards.length>=5,'pré: faltam sessões com 10 fotos e 4 fundos de IA: '+J(cards));
  const [C1,C2,C3,C4,C5]=cards;

  // ---- 4.6 e 4.7: Ideal por número de fotos (campo + IA), preços padrão e preço do extra trocado
  fase='4.6';
  const esp={1:['arq',0,70],2:['arq',1,105],3:['zona',0,110],4:['zona',1,145],5:['gramado',0,150],6:['gramado',0,150],7:['gramado',1,185],8:['maracana',0,190],9:['maracana',0,190],10:['tribuna',0,220],11:['tribuna',0,220],12:['tribuna',0,220],13:['mais',0,250],20:['mais',0,250]};
  const ideal=await A.evaluate(ns=>ns.map(n=>{const x=ETERNA.lojaIdeal(n);return [n,x.pkg,x.extra,x.custo];}),Object.keys(esp).map(Number));
  ideal.forEach(([n,p,e,c])=>ok(J([p,e,c])===J(esp[n]),`4.6: Ideal com ${n} fotos ${J([p,e,c])} (esperado ${J(esp[n])})`));
  const ideal45=await A.evaluate(()=>{ETERNA.SIM.prices.extra=45;const r=ETERNA.lojaIdeal(4);delete ETERNA.SIM.prices.extra;return r;});
  const empate=await A.evaluate(()=>{ETERNA.SIM.prices.gramado=145;const r=ETERNA.lojaIdeal(4);delete ETERNA.SIM.prices.gramado;return r;});
  ok(empate.pkg==='gramado'&&empate.custo===145,'D11: empate de preço (Zona + 1 = Gramado a R$ 145) deveria ir para o que dá mais impressas: '+J(empate));
  ok(ideal45.pkg==='gramado'&&ideal45.custo===150,'4.7: com a adicional a R$ 45 e 4 fotos o Ideal deveria ser 6 fotos R$ 150 (Zona + 1 = R$ 155): '+J(ideal45));

  // ---- Caixa aberto antes do pedido (janela B, Atendimento e venda)
  fase='1.6 abrir caixa';
  const B=await pagina(ctx,'B caixa');ok(await login(B,'loja@eterna.photo'),'1.6: Atendimento não entrou');
  const rail0=await B.evaluate(()=>!!document.querySelector('#rail-ck [data-act="view"][data-v="caixa"]'));ok(rail0,'1.6: barra sem o botão Caixa para o Atendimento');
  await B.click('#rail-ck [data-v="caixa"]');await B.waitForTimeout(250);ok(await B.evaluate(()=>ETERNA.state.view)==='caixa','1.6: botão Caixa não abriu o Caixa');
  ok(/Nenhum pagamento esperando/.test(await txt(B,'#main')),'1.6: Caixa vazio deveria dizer "Nenhum pagamento esperando." (v83)');

  // ---- 4.1 a 4.5: caso do print (4 do campo + 4 com fundo de IA)
  fase='4.1';
  await A.bringToFront();await lojaSessao(A,C1,4,4);
  let c=await carrinho(A);await A.screenshot({path:`${P}/v79-carrinho-ideal.png`});
  ok(c.on==='maracana'&&c.ideal==='maracana','4.1: pacote marcado e Ideal deveriam ser o Maracanã (9 fotos): '+J({on:c.on,ideal:c.ideal}));
  ok(J(c.extras)===J({mais:'',tribuna:'',maracana:'',gramado:'+ 2 adicionais de R$ 35',zona:'+ 5 adicionais de R$ 35',arq:'+ 7 adicionais de R$ 35'}),'4.1: adicionais de cada pacote: '+J(c.extras));
  ok(J(c.sum)===J(['Pacote 9 fotos R$ 190']),'4.2: resumo linha a linha: '+J(c.sum));
  ok(c.total==='R$ 190','4.2: total deveria ser R$ 190: '+c.total);
  ok(/8 fotos impressas/.test(c.incl)&&/4 fotos digitais/.test(c.incl)&&/4 fotos com fundo de IA/.test(c.incl),'4.3: O que você leva: '+c.incl);
  ok(c.save==='economia de R$ 125','N6: economia contra Arquibancada + 7 adicionais (70 + 245 − 190 = R$ 125): '+c.save);
  ok(c.fine.some(x=>x==='Cabem mais 1 foto neste pacote sem pagar mais.'),'4.4: sobra 1 no Maracanã: '+J(c.fine));
  ok(!c.sum.some(x=>/fundo de IA/.test(x)),'regra (a): fundo de IA não pode virar linha paga no resumo');
  fase='4.4';
  await A.click('[data-act="loja-pkg"][data-id="gramado"]');await A.waitForTimeout(150);c=await carrinho(A);
  ok(J(c.sum)===J(['Pacote 6 fotos R$ 150','2 fotos adicionais × R$ 35 R$ 70'])&&c.total==='R$ 220'&&/8 fotos impressas/.test(c.incl)&&c.save==='economia de R$ 95'&&c.ideal==='maracana','4.4: Gramado com 8 escolhidas (adicional digital e impressa): '+J(c));
  await A.click('[data-act="loja-pkg"][data-id="maracana"]');await A.waitForTimeout(100);
  // 4 fotos (só campo): Ideal Zona Mista + 1 adicional (R$ 145, 1 impressa); tocando em 6 fotos: sobra 2 e impressas = 4, não 6
  await lojaSessao(A,C1,4,0);c=await carrinho(A);
  ok(c.ideal==='zona'&&c.on==='zona'&&J(c.sum)===J(['Pacote 3 fotos R$ 110','1 foto adicional × R$ 35 R$ 35'])&&c.total==='R$ 145'&&/1 foto impressa/.test(c.incl)&&c.save==='economia de R$ 30','4.6: 4 fotos no Ideal Zona Mista + 1 adicional: '+J(c));
  await A.click('[data-act="loja-pkg"][data-id="gramado"]');await A.waitForTimeout(150);c=await carrinho(A);
  ok(c.ideal==='zona'&&J(c.sum)===J(['Pacote 6 fotos R$ 150'])&&c.total==='R$ 150'&&/4 fotos impressas/.test(c.incl)&&c.save==='economia de R$ 25'&&c.fine.some(x=>/Cabem mais 2 fotos neste pacote sem pagar mais/.test(x)),'4.4: 6 fotos com 4 escolhidas: '+J(c));
  fase='4.5';
  await lojaSessao(A,C1,4,4);await A.click('[data-act="loja-pkg"][data-id="mais"]');await A.waitForTimeout(150);c=await carrinho(A);
  const nSes=await A.evaluate(c=>ETERNA.lojaCart(c).nSes,C1);const save45=PRECO.arq+(nSes-1)*PRECO.extra-PRECO.mais;
  ok(J(c.sum)===J(['Pacote todas as fotos R$ 250'])&&c.total==='R$ 250'&&!/impressa/.test(c.incl),'4.5: Todas: '+J(c));
  ok(save45>0?c.save===`economia de R$ ${save45.toLocaleString('pt-BR')}`:c.save==='','4.5: economia do Todas ('+nSes+' fotos): '+c.save);
  // 1 foto: sem economia
  await lojaSessao(A,C1,1,0);c=await carrinho(A);ok(c.on==='arq'&&c.save===''&&c.total==='R$ 70'&&/1 foto impressa/.test(c.incl),'4.6: com 1 foto não aparece economia: '+J(c));
  // catálogo novo: Tribuna com 10 fotos (10 impressas) e Todas com 13
  await lojaSessao(A,C1,10,0);c=await carrinho(A);ok(c.on==='tribuna'&&c.total==='R$ 220'&&/10 fotos impressas/.test(c.incl)&&c.fine.some(x=>/Cabem mais 2 fotos/.test(x)),'4.6: 10 fotos no Tribuna: '+J(c));
  await lojaSessao(A,C1,9,4);c=await carrinho(A);ok(c.on==='mais'&&c.total==='R$ 250'&&!/impressa/.test(c.incl),'4.6: 13 fotos no Todas: '+J(c));
  await lojaSessao(A,C1,7,0);c=await carrinho(A);ok(c.on==='gramado'&&c.total==='R$ 185'&&/7 fotos impressas/.test(c.incl),'4.6: 7 fotos no Gramado + 1: '+J(c));
  await A.click('[data-act="loja-pkg"][data-id="tribuna"]');await A.waitForTimeout(120);c=await carrinho(A);ok(c.total==='R$ 220'&&/7 fotos impressas/.test(c.incl)&&c.ideal==='gramado','4.4: Tribuna com 7 fotos imprime 7, não 12: '+J(c));
  fase='4.9';
  await lojaSessao(A,C1,4,4);
  for(const l of ['en','es','fr','de','pt']){await A.click(`[data-act="lang"][data-l="${l}"]`);await A.waitForTimeout(80);c=await carrinho(A);ok(!c.raw&&c.sum.length===1,`4.9: carrinho em ${l} com chave crua ou sem resumo: ${J(c.sum)}`);}
  for(const [w,h] of [[390,844],[768,1024],[1366,900]]){await A.setViewportSize({width:w,height:h});await A.waitForTimeout(150);c=await carrinho(A);ok(c.sw,`4.9: rolagem horizontal no carrinho em ${w}px`);if(w===390)await A.screenshot({path:`${P}/v79-carrinho-390.png`,fullPage:true});}

  // ---- 1.1: Dinheiro mostra o botão e a nota; Cartão e PIX seguem iguais
  fase='1.1';
  await A.click('[data-act="loja-paym"][data-m="pix"]');await A.waitForTimeout(80);c=await carrinho(A);ok(/^Pagar R\$ 190/.test(c.btn)&&!c.fine.some(x=>/confirmada no caixa/.test(x)),'1.1: botão do PIX: '+c.btn);
  ok(c.fine.some(x=>/Pagamento seguro na maquininha do atendente/.test(x)),'rev 12 (v83, sem prometer tempo): com impressas e PIX aparece o aviso da maquininha: '+J(c.fine));
  ok(await A.evaluate(()=>document.querySelector('.lj-total b').textContent.includes('R$\u00a0')),'rev 12: fmtR com espaço fixo');
  await A.click('[data-act="loja-paym"][data-m="cash"]');await A.waitForTimeout(80);c=await carrinho(A);
  ok(!c.fine.some(x=>/2 minutos/.test(x)),'rev 12: em Dinheiro não aparece "impressas prontas em 2 minutos": '+J(c.fine));
  ok(/^Finalizar e pagar R\$ 190 no caixa/.test(c.btn),'1.1: botão do Dinheiro: '+c.btn);ok(c.fine.includes('Em dinheiro, a compra é confirmada no caixa.'),'1.1: nota do dinheiro: '+J(c.fine));
  await A.screenshot({path:`${P}/v79-carrinho-dinheiro.png`});

  // ---- 1.2 a 1.4: pedido em Dinheiro
  fase='1.4';
  const antes=await sim(A);const ai0=J((antes.ai||{})[C1]||null);
  await A.click('[data-act="loja-checkout"]');await A.waitForTimeout(500);
  const fim=await A.evaluate(()=>({step:ETERNA.state.kiosk.step,pend:!!document.querySelector('.lj-pendbig'),okbig:!!document.querySelector('.lj-okbig'),h1:document.querySelector('.lj-h1').innerText.replace(/\s+/g,' ').toLowerCase(),t:document.querySelector('#main').innerText.replace(/\s+/g,' '),cod:(document.querySelector('.lj-qrcode')||{}).innerText||'',qr:!!document.querySelector('#lqr')}));
  ok(fim.step==='done'&&fim.pend&&!fim.okbig,'1.2: tela final do dinheiro com ícone próprio e sem o check: '+J(fim));
  ok(fim.h1==='pague no caixa em dinheiro'&&/pague R\$ 190/.test(fim.t)&&/8 impressas/.test(fim.t)&&/^Código [A-Z2-9]{4}-[A-Z2-9]{4}$/.test(fim.cod)&&!fim.qr,'1.2 (v83: sem QR enquanto espera): título, valor e código: '+J(fim));
  ok(!/Obrigado|2 minutos/.test(fim.t),'1.2: não pode aparecer Obrigado nem "2 minutos" no dinheiro');
  await A.screenshot({path:`${P}/v79-dinheiro-pt.png`});
  for(const l of ['en','es','fr','de']){await A.click(`[data-act="lang"][data-l="${l}"]`);await A.waitForTimeout(80);const t=await txt(A,'#main');ok(!/ljCash|gq_codeIs|payBtnCash/.test(t)&&/190/.test(t),`1.2: tela do dinheiro em ${l}: ${t.slice(0,120)}`);if(l==='de')await A.screenshot({path:`${P}/v79-dinheiro-de.png`});}
  ok(await A.evaluate(()=>!document.querySelector('#lqr')&&/[A-Z2-9]{4}-[A-Z2-9]{4}/.test((document.querySelector('.lj-qrcode')||{}).innerText||'')),'1.2: trocar de idioma mantém o código (sem QR enquanto espera)');
  const depois=await sim(A);const r1=depois.caixaDin[0];const s1=depois.sessions[C1];
  ok(s1.status==='aguardando'&&s1.din===r1.id&&r1.estado==='aguardando'&&r1.card===C1&&r1.total===190&&r1.prints===8&&r1.n===8,'1.4: sessão aguardando e registro: '+J({st:s1.status,r1}));
  ok(depois.stock['Caixa 1']===antes.stock['Caixa 1'],'1.4: estoque não pode mudar antes da confirmação');
  ok(J((depois.ai||{})[C1]||null)===ai0||!((depois.ai||{})[C1]||{bought:[]}).bought.length,'1.4: aiOf().bought não pode mudar');
  ok(!s1.saleNo&&/^L0-\d{3}$/.test(r1.saleNo||'')&&!(depois.galFila||[]).some(x=>x.token===r1.token),'1.4: sessão sem saleNo (v83: o número fica na pendência) e sem galeria na fila de envio');
  ok(!/@/.test(J(r1).replace(/"por":null/,'')),'D8: registro sem e-mail antes de fechar');
  const cod1=r1.codigo,tok1=r1.token;

  // ---- 1.6: aparece no Caixa sem recarregar (evento storage), busca com e sem hífen
  fase='1.6';
  await sleep(1500);const cx=await txt(B,'#main');
  ok(cx.includes(cod1)&&cx.includes(C1)&&cx.includes('R$ 190')&&/há \d+ min/.test(cx)&&/8 fotos · 8 impressas/.test(cx),'1.6: pendência no Caixa sem recarregar: '+cx.slice(0,300));
  ok(await B.evaluate(()=>document.querySelectorAll('.din-item .ph').length)>=1,'1.6: miniaturas das fotos na pendência');
  ok(await B.evaluate(()=>(document.querySelector('#rail-din')||{}).textContent)==='1','1.6: número de pendências na barra');
  await B.fill('#din-q',cod1.replace('-','').toLowerCase());await B.waitForTimeout(150);ok((await txt(B,'.din-list')||'').includes(cod1),'1.6: busca sem hífen não achou');
  await B.fill('#din-q','ZZZZ');await B.waitForTimeout(150);ok(/Nenhum pagamento com esse código/.test(await txt(B,'#main')),'1.6: busca errada deveria esvaziar');
  await B.fill('#din-q',cod1);await B.waitForTimeout(150);ok((await txt(B,'.din-list')||'').includes(cod1),'1.6: busca com hífen não achou');
  await B.fill('#din-q','');await B.waitForTimeout(100);await B.screenshot({path:`${P}/v79-caixa-aguardando.png`});

  // ---- 1.3: a tela final do dinheiro volta sozinha (tempo configurado)
  fase='1.3';
  // v83 (D5): enquanto espera o pagamento não há contagem; a tela fica até o vendedor confirmar ou o cliente tocar em Voltar ao início
  await A.evaluate(()=>{ETERNA.SIM.lojaFimSeg=5;});await sleep(5600);
  ok(await A.evaluate(()=>ETERNA.state.kiosk.step==='done'&&!ETERNA.state.kiosk.timer),'1.3: tela do dinheiro aguardando não pode voltar sozinha');
  await A.click('[data-act="loja-new"]');await A.waitForTimeout(150);ok(await A.evaluate(()=>ETERNA.state.kiosk.step)==='code','1.3: Voltar ao início');

  // ---- 1.5: galeria no mesmo computador
  fase='1.5';
  const G=await pagina(ctx,'G #g');await G.goto(U);await G.evaluate(()=>localStorage.setItem('eterna.lang','pt'));await G.goto(U+'#g/'+tok1);await G.waitForTimeout(1800);
  const g1=await G.evaluate(()=>({step:ETERNA.pub&&ETERNA.pub.step,t:document.querySelector('#main').innerText.replace(/\s+/g,' '),ph:document.querySelectorAll('.gq .ph,.gq-ph,[data-act="gq-buy"],[data-act="gq-pay"]').length}));
  ok(g1.step==='aguarda_caixa'&&/Seu pagamento em dinheiro está esperando o caixa|YOUR CASH PAYMENT IS WAITING AT THE COUNTER/i.test(g1.t)&&g1.ph===0,'1.5: galeria deveria esperar o caixa: '+J(g1));

  // ---- 1.7: Recebi R$ X
  fase='1.7';
  const est0=(await sim(B)).stock['Caixa 1'];
  await B.click(`[data-act="din-confirm"][data-id="${r1.id}"]`);await B.waitForTimeout(400);
  const d7=await sim(B);const s7=d7.sessions[C1];const r7=d7.caixaDin.find(x=>x.id===r1.id);
  ok(s7.status==='paga'&&s7.payment==='Dinheiro'&&s7.saleNo&&s7.caixaPor==='Atendimento e venda'&&Math.abs(Date.parse(s7.paidAt)-Date.now())<10000&&s7.prints===8,'1.7: sessão paga em Dinheiro: '+J(s7));
  ok(d7.stock['Caixa 1']===est0&&d7.sessions[C1].impressao&&d7.sessions[C1].impressao.estado==='pendente',`1.7 (v83): confirmar não baixa o rolo; a venda fica para imprimir (${est0} → ${d7.stock['Caixa 1']})`);
  ok(r7.estado==='confirmada'&&r7.porNome==='Atendimento e venda'&&r7.por==='loja@eterna.photo'&&r7.saleNo===s7.saleNo,'1.7: registro confirmado: '+J(r7));
  const gal7=d7.galerias[tok1];ok((d7.galFila||[]).some(x=>x.token===tok1),'1.7: galeria publicada (fila)');
  ok(J(gal7.fotos.filter(f=>f.direito==='comprada').map(f=>f.id).sort())===J(s7.selected.slice().sort()),'1.7: compradas = selected');
  ok(((d7.ai||{})[C1]||{bought:[]}).bought.length===4,'1.7: 4 fundos de IA comprados na confirmação');
  const rec=await txt(B,'.receipt');ok(/Recebido por Atendimento e venda às \d\d:\d\d/.test(rec)&&/Impressões: 8/.test(rec)&&/TOTAL\s+R\$ 190/.test(rec),'1.7: recibo: '+rec);
  await B.screenshot({path:`${P}/v79-caixa-recibo.png`});
  await sleep(600);const g10=await G.evaluate(()=>ETERNA.pub&&ETERNA.pub.step);ok(g10==='consent','rev 10: a galeria deveria sair do "esperando o caixa" sem recarregar: '+g10);await G.close();
  ok(s7.total===190&&s7.cart.every(x=>typeof x.v==='number'),'I4: venda grava total e preço por item: '+J({t:s7.total,cart:s7.cart}));
  await sleep(400);const dA=await sim(A);ok(dA.sessions[C1].status==='paga'&&dA.caixaDin.find(x=>x.id===r1.id).estado==='confirmada','1.7: a janela do Checkout deveria adotar o SIM novo');

  // ---- I6: mudança que não aparece não redesenha; I2: SIM de janela antiga não é adotado
  fase='I2';
  const O=await pagina(ctx,'O outra');await O.goto(U);await O.waitForTimeout(500);
  await B.evaluate(()=>{document.querySelector('#main').dataset.marca='1';});
  await O.evaluate(()=>{const o=JSON.parse(localStorage.getItem('eterna.sim.v1'));o.log.unshift({t:'teste I6',at:new Date().toISOString()});localStorage.setItem('eterna.sim.v1',JSON.stringify(o));});await sleep(300);
  ok(await B.evaluate(()=>document.querySelector('#main').dataset.marca==='1'&&ETERNA.SIM.log[0].t==='teste I6'),'I6: mudança só no registro não deveria redesenhar o Caixa (mas adota o SIM)');
  await O.evaluate(()=>{const o=JSON.parse(localStorage.getItem('eterna.sim.v1'));delete o.caixaDin;delete o.catalogoV;localStorage.setItem('eterna.sim.v1',JSON.stringify(o));});await sleep(300);
  const i2=await B.evaluate(()=>({n:(ETERNA.SIM.caixaDin||[]).length,t:document.querySelector('#toast').textContent,al:ETERNA.alerts().some(a=>/janela antiga/.test(a.t))}));
  ok(i2.n>0&&/Há uma janela antiga do Eterna aberta\. Recarregue as outras janelas\./.test(i2.t)&&i2.al,'I2: SIM sem caixaDin não pode ser adotado: '+J(i2));
  await B.evaluate(()=>{localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));ETERNA.state.janelaAntiga=0;});await O.close();await sleep(300);
  ok((await sim(A)).caixaDin.length>0,'I2: a janela do Checkout também não pode perder o caixa');
  // ---- I6: a janela do Checkout não roda o ajuste automático
  await A.evaluate(()=>{const c=document.createElement('canvas');c.width=60;c.height=40;c.getContext('2d').fillRect(0,0,60,40);ETERNA.UP['ag_i6']={src:c.toDataURL(),name:'i6.jpg'};ETERNA.state.lib=[{id:'i6',day:'2000-01-01',t:0}];ETERNA.ajQueue();});await sleep(800);
  ok(!(await A.evaluate(()=>!!(ETERNA.SIM.edits||{})['ag_i6'])),'I6: ajQueue não pode rodar na janela do Checkout');await A.evaluate(()=>{ETERNA.state.lib=[];});

  // ---- 1.8: idempotência com duas janelas de Caixa
  fase='1.8';
  const Cx=await pagina(ctx,'C caixa');await Cx.goto(U+'#caixa');await Cx.waitForTimeout(500);ok(await Cx.evaluate(()=>ETERNA.state.view)==='caixa','1.8: segunda janela do Caixa');
  await A.bringToFront();await lojaSessao(A,C2,3,0);await pagar(A,'cash');const r8=(await sim(A)).caixaDin[0];await sleep(600);
  ok(await Cx.evaluate(id=>!!document.querySelector(`[data-act="din-confirm"][data-id="${id}"]`),r8.id),'1.8: a pendência deveria aparecer na segunda janela');
  if(!(await B.waitForSelector(`[data-act="din-confirm"][data-id="${r8.id}"]`,{timeout:3000}).catch(()=>null)))fails.push('1.8 diag: '+J(await B.evaluate(()=>({v:ETERNA.state.view,ae:document.activeElement&&document.activeElement.tagName+'#'+document.activeElement.id,ids:ETERNA.SIM.caixaDin.map(r=>r.id+':'+r.estado),ls:JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.map(r=>r.id+':'+r.estado)}))));
  await B.click(`[data-act="din-confirm"][data-id="${r8.id}"]`);await B.waitForTimeout(300);
  const e8=await sim(B);await Cx.evaluate(id=>ETERNA.dinConfirmar(id),r8.id);await Cx.waitForTimeout(150);const t8=await toastTxt(Cx);
  ok(/^Já confirmada por Atendimento e venda às \d\d:\d\d$/.test(t8),'1.8: segunda confirmação: '+t8);
  const f8=await sim(Cx);ok(f8.stock['Caixa 1']===e8.stock['Caixa 1']&&f8.sessions[C2].saleNo===e8.sessions[C2].saleNo,'1.8: estoque e saleNo mudaram duas vezes');
  ok(!(await Cx.evaluate(id=>!!document.querySelector(`[data-act="din-confirm"][data-id="${id}"]`),r8.id)),'1.8: confirmada não pode continuar na lista da segunda janela');

  // ---- I3: armazenamento cheio no Checkout e no Caixa: nada muda e avisa
  fase='I3';
  const i3a=(await sim(A)).caixaDin.length;
  await lojaSessao(A,C3,2,0);
  await A.evaluate(()=>{window._si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='eterna.sim.v1')throw new DOMException('cheio','QuotaExceededError');return window._si.call(this,k,v);};});
  await pagar(A,'cash');
  const i3=await A.evaluate(c=>({t:document.querySelector('#toast').textContent,st:(ETERNA.SIM.sessions[c]||{}).status,n:ETERNA.SIM.caixaDin.length,step:ETERNA.state.kiosk.step,al:ETERNA.alerts().some(a=>/Armazenamento do navegador cheio/.test(a.t))}),C3);
  await A.evaluate(()=>{Storage.prototype.setItem=window._si;});
  ok(/Não conseguimos registrar o pedido\. Fale com a equipe no balcão\./.test(i3.t)&&i3.st!=='aguardando'&&i3.n===i3a&&i3.step!=='done'&&i3.al,'I3: Checkout sem gravar: '+J(i3));
  await lojaSessao(A,C3,2,0);await pagar(A,'cash');const rI3=(await sim(A)).caixaDin[0];await sleep(600);
  await B.evaluate(()=>{window._si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='eterna.sim.v1')throw new DOMException('cheio','QuotaExceededError');return window._si.call(this,k,v);};});
  await B.click(`[data-act="din-confirm"][data-id="${rI3.id}"]`);await B.waitForTimeout(200);
  const i3b=await B.evaluate(id=>({t:document.querySelector('#toast').textContent,e:ETERNA.SIM.caixaDin.find(x=>x.id===id).estado}),rI3.id);
  await B.evaluate(()=>{Storage.prototype.setItem=window._si;});
  ok(i3b.t==='Não gravou, tente de novo'&&i3b.e==='aguardando','I3: Caixa sem gravar: '+J(i3b));
  await B.click(`[data-act="din-cancel"][data-id="${rI3.id}"]`);await B.waitForTimeout(100);await B.click(`[data-act="din-cancel-ok"][data-id="${rI3.id}"]`);await B.waitForTimeout(200);

  // ---- 1.9: cancelar com segunda confirmação
  fase='1.9';
  await lojaSessao(A,C3,2,0);await pagar(A,'cash');const r9=(await sim(A)).caixaDin[0];await sleep(600);
  await B.click(`[data-act="din-cancel"][data-id="${r9.id}"]`);await B.waitForTimeout(150);
  ok(/Cancelar esta compra\? Ela não vira venda\./.test(await txt(B,'.din-list')),'1.9: falta a segunda confirmação do cancelar');
  ok((await sim(B)).caixaDin.find(x=>x.id===r9.id).estado==='aguardando','1.9: o primeiro toque não pode cancelar');
  await B.click(`[data-act="din-cancel-ok"][data-id="${r9.id}"]`);await B.waitForTimeout(250);
  const d9=await sim(B);const x9=d9.caixaDin.find(x=>x.id===r9.id);
  ok(x9.estado==='cancelada'&&x9.motivo==='cancelada_no_caixa'&&x9.porNome==='Atendimento e venda'&&x9.fechada&&d9.sessions[C3].status==='pronta'&&!d9.sessions[C3].din,'1.9: cancelada: '+J({x9,st:d9.sessions[C3].status}));

  // ---- 1.13: pendência substituída por PIX na mesma sessão
  fase='1.13';
  await lojaSessao(A,C4,3,1);await pagar(A,'cash');const r13=(await sim(A)).caixaDin[0];
  await lojaSessao(A,C4,3,1);await pagar(A,'pix');await sleep(500);
  const x13a=(await sim(B)).caixaDin.find(x=>x.id===r13.id);ok(x13a.estado==='substituida'&&x13a.motivo==='novo_pedido','1.13 (v83): o PIX vira pedido novo e substitui a pendência do dinheiro: '+J(x13a));
  await maquininha(A,B);
  const d13=await sim(B);const x13=d13.caixaDin.find(x=>x.id===r13.id);
  ok(x13.estado==='substituida'&&d13.sessions[C4].status==='paga'&&d13.sessions[C4].payment==='PIX (maquininha)','1.13: PIX confirmado na maquininha: '+J({x13,st:d13.sessions[C4].status,pay:d13.sessions[C4].payment}));
  ok(!(await B.evaluate(id=>!!document.querySelector(`[data-act="din-confirm"][data-id="${id}"]`),r13.id)),'1.13: substituída não pode ficar no Caixa');
  ok(d13.sessions[C4].prints===1,'4.8 (regra a, catálogo novo): 3 do campo + 1 de IA = Zona Mista (só digital) + 1 adicional impressa: '+d13.sessions[C4].prints);

  // ---- 4.8: PIX no caso do print baixa 8 impressas
  fase='4.8';
  const e48=(await sim(A)).stock['Caixa 1'];await lojaSessao(A,C5,4,4);await pagar(A,'pix');await maquininha(A,B);const d48=await sim(A);
  ok(d48.stock['Caixa 1']===e48&&d48.sessions[C5].impressao.estado==='pendente'&&d48.sessions[C5].impressao.alvo===8&&d48.sessions[C5].prints===8&&d48.sessions[C5].status==='paga','4.8: PIX do caso do print: '+J({de:e48,para:d48.stock['Caixa 1'],p:d48.sessions[C5].prints}));
  ok(await A.evaluate(()=>!ETERNA.lojaEquipeOn()),'3.5: #loja sem login não tem modo equipe');
  // ---- revisor 1: sessão paga (PIX) reaberta no Checkout não paga de novo, nem em Dinheiro
  fase='rev1';
  const pago=(await sim(A)).sessions[C5];await lojaSessao(A,C5,4,4);
  const r1v=await A.evaluate(()=>({m:(document.querySelector('.lj-paidmsg')||{}).textContent||'',pay:!!document.querySelector('.lj-paybtn')}));
  ok(r1v.m==='Estas fotos já foram compradas. Fale com a equipe para comprar mais.'&&!r1v.pay,'rev 1: sessão paga reaberta: '+J(r1v));
  await A.click('[data-act="lang"][data-l="de"]');await A.waitForTimeout(80);ok(/schon gekauft/i.test(await txt(A,'.lj-paidmsg')||''),'rev 1: mensagem em alemão');await A.click('[data-act="lang"][data-l="pt"]');
  await A.evaluate(()=>{ETERNA.state.kiosk.pay='cash';const b=document.createElement('button');b.dataset.act='loja-checkout';b.id='forca1';document.body.appendChild(b);b.click();b.remove();});await A.waitForTimeout(200);
  const depoisPago=await sim(A);ok(depoisPago.sessions[C5].status==='paga'&&depoisPago.sessions[C5].saleNo===pago.saleNo&&!depoisPago.caixaDin.some(x=>x.card===C5&&x.estado==='aguardando'),'rev 1: Dinheiro numa sessão paga não pode desfazer a venda: '+J({st:depoisPago.sessions[C5].status}));
  await A.evaluate(()=>{ETERNA.state.kiosk.step='code';ETERNA.render();});

  // ---- 1.10 e 1.11: Lista de vendas, CSV e Alertas (admin, outra janela do mesmo navegador)
  fase='1.10';
  const C6=await A.evaluate(used=>ETERNA.demoSessions().filter(s=>s.photos.length>=3&&!used.includes(s.card))[0].card,cards);
  await A.setViewportSize({width:390,height:844});await A.waitForTimeout(100);
  await lojaSessao(A,C6,3,0);await pagar(A,'cash');const r10=(await sim(A)).caixaDin[0];
  fase='rev2';
  for(const l of ['pt','de']){await A.click(`[data-act="lang"][data-l="${l}"]`);await A.waitForTimeout(120);
    const lay=await A.evaluate(()=>{const R=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect():null;};const cod=document.querySelector('.lj-qrcode');const fs=parseFloat(getComputedStyle(cod).fontSize);
      const top=R('.lj-top'),ic=R('.lj-pendbig'),bt=R('.lj-restart');return {umaLinha:R('.lj-qrcode').height<fs*1.6,abaixo:ic.top>=top.bottom-1,btn:bt.right<=innerWidth+1&&bt.left>=-1&&bt.bottom<=innerHeight+1,sw:document.documentElement.scrollWidth<=innerWidth+1};});
    ok(lay.umaLinha&&lay.abaixo&&lay.btn&&lay.sw,`rev 2: tela final do dinheiro em 390×844 (${l}): ${J(lay)}`);await A.screenshot({path:`${P}/v79-dinheiro-390-${l}.png`});}
  await A.click('[data-act="lang"][data-l="pt"]');await A.setViewportSize({width:1366,height:900});
  const D=await pagina(ctx,'D admin');ok(await login(D,'eduardo@eduardorezende.com'),'1.10: admin não entrou');
  // catálogo novo do Tour em Catálogo e preços: 9 produtos, nesta ordem, com os preços novos
  await verView(D,'catalogo');const catv=await D.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(r=>[r.querySelector('.name').textContent,+r.querySelector('input[data-act="price"]').value]));
  ok(J(catv)===J([['Pacote Maracanã Mais',250],['Pacote Tribuna de Honra',220],['Pacote Maracanã',190],['Pacote Gramado',150],['Pacote Zona Mista',110],['Pacote Arquibancada',70],['Foto adicional',35],['Fundo de IA',40],['Foto digital avulsa (galeria online)',39]]),'catálogo novo: '+J(catv));
  const lista=async()=>{await D.evaluate(()=>{const t=new Date();const h=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');ETERNA.state.range={from:h,to:h};ETERNA.state.view='vendas-lista';ETERNA.render();});await D.waitForTimeout(200);
    return D.evaluate(()=>{const tl={};document.querySelectorAll('.tile').forEach(t=>{tl[t.querySelector('.eyebrow').textContent.trim()]=t.querySelector('.v').textContent.trim();});return {tl,rows:[...document.querySelectorAll('#main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' '))};});};
  let L=await lista();const rowAg=L.rows.find(r=>r.includes(r10.id));
  ok(rowAg&&/aguardando caixa/.test(rowAg)&&/Dinheiro/.test(rowAg),'1.10: pendência na lista com "aguardando caixa": '+rowAg);
  ok(L.rows.some(r=>r.includes(r9.id)&&/não paga/.test(r)),'1.9: cancelada aparece como "não paga" na lista');
  ok(!L.rows.some(r=>r.includes(r13.id)),'1.13: substituída não vira linha');
  ok(L.rows.filter(r=>r.includes(C4)).length===1,'1.13: a venda aparece uma vez só');
  ok(L.tl['Aguardando caixa']==='1','1.10: bloco Aguardando caixa: '+J(L.tl));
  const fotosAg=await D.evaluate(id=>ETERNA.allSales().find(r=>r.no===id).photos,r10.id);ok(fotosAg===3,'rev 11: fotos na pendente: '+fotosAg);
  const rec0=L.tl['Receita'],v0=L.tl['Vendas'];
  await D.click('[data-act="sales-status"][data-v="aguardando"]');await D.waitForTimeout(150);
  const Lf=await D.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ')));ok(Lf.length===1&&Lf[0].includes(r10.id),'1.10: filtro Aguardando caixa: '+J(Lf));
  await D.click('[data-act="sales-status"][data-v="nao_paga"]');await D.waitForTimeout(150);
  const Ln=await D.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ')));ok(Ln.some(r=>r.includes(r9.id))&&Ln.every(r=>/não paga/.test(r)),'1.10: filtro Não pagas: '+J(Ln));
  await D.click('[data-act="sales-status"][data-v="all"]');await D.waitForTimeout(100);await D.screenshot({path:`${P}/v79-lista-vendas.png`});
  const csv=await D.evaluate(()=>ETERNA.salesCSV(ETERNA.allSales()));const lin=csv.split('\n');
  ok(lin[0].includes(';caixa;caixa_em;')&&lin[0].endsWith(';posto;pagamento_ref;impressao'),'1.10: CSV sem as colunas caixa e caixa_em: '+lin[0]);
  ok(lin.some(l=>l.includes(r10.id)&&l.includes('"aguardando"'))&&lin.some(l=>l.includes(r9.id)&&l.includes('"nao_paga"')),'1.10: CSV com aguardando e nao_paga');
  const lC1=lin.find(l=>l.includes(`"${C1}"`)&&l.includes('"paga"'));ok(lC1&&lC1.includes('"Atendimento e venda"')&&!/@/.test(lC1),'1.10: CSV com o nome de quem recebeu, nunca o e-mail: '+lC1);
  ok(!/loja@eterna\.photo/.test(csv),'D8: e-mail do operador no CSV');
  // confirmar soma uma vez
  await B.click(`[data-act="din-confirm"][data-id="${r10.id}"]`);await B.waitForTimeout(400);L=await lista();
  const num=s=>+String(s).replace(/\D/g,'');ok(num(L.tl['Receita'])===num(rec0)+r10.total&&num(L.tl['Vendas'])===num(v0)+1,'1.10: depois de confirmar, receita e vendas somam uma vez: '+J({antes:[rec0,v0],depois:[L.tl['Receita'],L.tl['Vendas']]}));
  ok(L.tl['Aguardando caixa']==='0','1.10: Aguardando caixa zerado depois de confirmar');
  const fotosPg=await D.evaluate(c=>ETERNA.allSales().find(r=>r.card===c&&r.status==='paga').photos,C6);ok(fotosPg===3,'rev 11: fotos na paga iguais às da pendente: '+fotosPg);
  // I4: trocar o preço depois não muda a venda nem a receita
  const i4=await D.evaluate(c=>{ETERNA.SIM.prices.maracana=999;const r=ETERNA.allSales().find(x=>x.card===c&&x.status==='paga');delete ETERNA.SIM.prices.maracana;return r.total;},C1);ok(i4===190,'I4: venda paga a R$ 190 não pode virar preço novo: '+i4);
  // N4: CSV não deixa célula virar fórmula
  const n4=await D.evaluate(()=>ETERNA.salesCSV([{no:'=1+1',date:'hoje',time:'',card:'@x',pdv:'-y',key:'',seller:'+z',items:[],photos:0,prints:0,pay:'',total:0,status:'paga'}]).split('\n')[1]);
  ok(/^"'=1\+1";"hoje";"";"'@x";"'-y";/.test(n4)&&n4.includes(`"'+z"`),'N4: CSV com = + - @: '+n4);
  // revisor 3: Fundos de IA sem R$ 40 no Checkout
  await verView(D,'chroma');const ch3=await txt(D,'#main');ok(/incluídas no pacote/.test(ch3)&&/No Checkout, as fotos com fundo de IA entram no pacote/.test(ch3),'rev 3: Fundos de IA: '+ch3.slice(0,200));
  fase='1.11';
  await A.bringToFront();const C7=await A.evaluate(used=>ETERNA.demoSessions().filter(s=>s.photos.length>=3&&!used.includes(s.card))[0].card,[...cards,C6]);
  await lojaSessao(A,C7,2,0);await pagar(A,'cash');const r11=(await sim(A)).caixaDin[0];await sleep(500);
  const al=await D.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);r.criada=new Date(Date.now()-20*60000).toISOString();return ETERNA.alerts().map(a=>a.sev+' '+a.t);},r11.id);
  ok(al.some(a=>new RegExp(`^bad Dinheiro esperando no caixa há 20 min · código ${r11.codigo}$`).test(a)),'1.11: alerta de 15 min: '+J(al.slice(0,3)));
  // ---- 1.12: virada do dia no dinTick (dinVirada) e no boot
  fase='1.12';
  const v12=await D.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);r.criada=new Date(Date.now()-86400000).toISOString();ETERNA.dinVirada();const s=ETERNA.SIM.sessions[r.card];return {r:JSON.parse(JSON.stringify(r)),st:s.status,din:s.din||null};},r11.id);
  ok(v12.r.estado==='nao_paga'&&v12.r.por==='sistema'&&v12.r.motivo==='fim_do_dia'&&v12.st==='pronta'&&!v12.din,'1.12: virada no dinTick: '+J(v12));
  await lojaSessao(A,C7,2,0);await pagar(A,'cash');const r12=(await sim(A)).caixaDin[0];
  await A.evaluate(id=>{const o=JSON.parse(localStorage.getItem('eterna.sim.v1'));o.caixaDin.find(x=>x.id===id).criada=new Date(Date.now()-86400000).toISOString();o.prices=Object.assign({},o.prices,{maracana:160,gramado:155});localStorage.setItem('eterna.sim.v1',JSON.stringify(o));localStorage.removeItem('eterna.catalogo.v');},r12.id);
  const D2=await pagina(ctx,'D2 boot');await D2.goto(U);await D2.waitForTimeout(600);
  const b12=await D2.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {e:r.estado,por:r.por,m:r.motivo,st:ETERNA.SIM.sessions[r.card].status};},r12.id);
  ok(b12.e==='nao_paga'&&b12.por==='sistema'&&b12.m==='fim_do_dia'&&b12.st==='pronta','1.12: virada no boot: '+J(b12));
  const mig=await D2.evaluate(()=>({p:ETERNA.SIM.prices,v:ETERNA.SIM.catalogoV,l:ETERNA.SIM.log.slice(0,3).map(x=>x.t)}));ok(mig.p.maracana==null&&mig.p.gramado===155&&mig.v===2&&mig.l.some(t=>/^Catálogo novo do Tour: preços editados de Pacote Maracanã voltaram/.test(t)),'catálogo novo: preço editado do Maracanã antigo deveria sair uma vez: '+J(mig));await D2.close();
  // retenção (D8): fechadas há mais de 30 dias saem
  const ret=await D.evaluate(()=>{ETERNA.SIM.caixaDin.push({id:'Dvelho',card:'X',estado:'cancelada',criada:new Date(Date.now()-40*864e5).toISOString(),fechada:new Date(Date.now()-40*864e5).toISOString()});ETERNA.dinVirada();return ETERNA.SIM.caixaDin.some(x=>x.id==='Dvelho');});
  ok(!ret,'D8: registro fechado há 40 dias deveria sair');

  // ---- 1.14: permissões do caixa
  fase='1.14';
  await A.bringToFront();await lojaSessao(A,C7,2,0);await pagar(A,'cash');const r14=(await sim(A)).caixaDin[0];await sleep(500);
  await D.evaluate(()=>{ETERNA.state.gal.tab='sessoes';ETERNA.state.gal.q='';ETERNA.state.view='galerias';ETERNA.render();});await D.waitForTimeout(150);
  const g11=await D.evaluate(()=>[...document.querySelectorAll('#main .pill')].map(x=>x.textContent));ok(!g11.includes('aguardando'),'rev 11: Galerias com status cru: '+J(g11.filter(x=>/aguard/.test(x))));
  for(const [email,pode] of [['carlos@eterna.photo',false],['qualidade@eterna.photo',false],['quiosque@eterna.photo',false],['supervisor@eterna.photo',true]]){
    const cx2=await nova(b,1280,900);await cx2.addInitScript(s=>{if(!sessionStorage.getItem('semeado')){localStorage.setItem('eterna.sim.v1',s);sessionStorage.setItem('semeado','1');}},await A.evaluate(()=>localStorage.getItem('eterna.sim.v1')));
    const pg=await pagina(cx2,'1.14 '+email);ok(await login(pg,email),'1.14: não entrou '+email);
    await pg.evaluate(()=>{if(ETERNA.state.lojaRota)return;ETERNA.state.view='caixa';ETERNA.render();});await pg.waitForTimeout(200);
    const vis=await pg.evaluate(()=>!!document.querySelector('[data-act="din-confirm"]'));ok(vis===pode,`1.14: ${email} ${pode?'deveria':'não deveria'} ver o botão Recebi`);
    if(!pode){await pg.evaluate(id=>{const bt=document.createElement('button');bt.dataset.act='din-confirm';bt.dataset.id=id;bt.id='forca';document.body.appendChild(bt);},r14.id);await pg.evaluate(()=>document.querySelector('#forca').click());await pg.waitForTimeout(150);
      const t=await toastTxt(pg);const e=await pg.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id).estado,r14.id);ok(/Sem permissão/.test(t)&&e==='aguardando',`1.14: ${email} forçando o clique: ${t} / ${e}`);
      const e2=await pg.evaluate(id=>{ETERNA.dinConfirmar(id);return ETERNA.SIM.caixaDin.find(x=>x.id===id).estado;},r14.id);ok(e2==='aguardando',`1.14: ${email} chamando dinConfirmar pelo console confirmou`);}
    else{await pg.click(`[data-act="din-confirm"][data-id="${r14.id}"]`);await pg.waitForTimeout(300);ok(await pg.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id).estado,r14.id)==='confirmada','1.14: supervisor deveria confirmar');}
    await cx2.close();}

  // ---- 1.15: sair do #loja por endereço, voltar do navegador ou #g leva ao login e apaga a sessão salva
  fase='1.15';
  for(const modo of ['hash-caixa','voltar','g']){const cx3=await nova(b,1280,900);const pg=await pagina(cx3,'1.15 '+modo);ok(await login(pg,'eduardo@eduardorezende.com'),'1.15: admin não entrou');
    if(modo==='voltar'){await pg.evaluate(()=>ETERNA.go('quiosque'));await pg.waitForTimeout(300); /* v81: o botão abre janela à parte; o Checkout na mesma aba segue por go('quiosque') */ok(await pg.evaluate(()=>ETERNA.state.lojaRota),'1.15: Abrir Checkout');await pg.goBack();await pg.waitForTimeout(400);}
    else{await pg.goto(U+'#loja');await pg.reload();await pg.waitForTimeout(500);ok(await pg.evaluate(()=>ETERNA.state.lojaRota&&!ETERNA.state.user),'1.15/I1: #loja aberto direto não carrega a sessão salva');
      if(modo==='hash-caixa')await pg.evaluate(()=>{location.hash='#caixa';});else await pg.evaluate(t=>{location.hash='#g/'+t;},tok1);await pg.waitForTimeout(500);}
    const r=await pg.evaluate(()=>({u:!!ETERNA.state.user,s:localStorage.getItem('eterna.session'),v:ETERNA.state.view,loja:ETERNA.state.lojaRota,pub:!!ETERNA.pub,login:!!document.querySelector('[data-act="login-email"]'),din:!!document.querySelector('[data-act="din-confirm"]')}));
    // v81: na aba do Checkout aberta direto (sem login), trocar o endereço não apaga a sessão salva (é o mesmo navegador do admin): #caixa volta ao #loja; #g abre a galeria
    if(modo==='voltar')ok(!r.u&&!r.s&&!r.loja&&!r.din&&r.login&&r.v==='entrar',`1.15 ${modo}: ${J(r)}`);
    else if(modo==='hash-caixa'){const h=await pg.evaluate(()=>location.hash);ok(!r.u&&r.s&&r.loja&&!r.din&&r.v==='quiosque'&&h==='#loja',`1.15/v81 ${modo}: ${J(r)} ${h}`);}
    else ok(!r.u&&r.s&&!r.loja&&!r.din&&r.pub,`1.15/v81 ${modo}: ${J(r)}`);
    if(modo==='g'){await pg.evaluate(()=>{location.hash='#caixa';});await pg.waitForTimeout(400);const r2=await pg.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view,din:!!document.querySelector('[data-act="din-confirm"]')}));ok(!r2.u&&!r2.din,'1.15: depois do #g, #caixa abriu a equipe: '+J(r2));}
    await cx3.close();}
  await ctx.close();}

  // =================== Item 2: interruptor do ajuste automático ===================
  fase='2.1';
  if(SO.includes('2')){const cx=await nova(b,1280,1000);const pg=await pagina(cx,'2 carlos');ok(await login(pg,'carlos@eterna.photo'),'2: Carlos não entrou');
    ok(await pg.evaluate(()=>ETERNA.state.view)==='importar','2.1: Carlos deveria começar no Upload');
    let t=await txt(pg,'#aj-auto');ok(t&&/Ajuste automático da IA/i.test(t)&&/Vale para o ponto inteiro/.test(t)&&/Ligado$/.test(t),'2.1: painel no Upload: '+t);
    ok(await pg.evaluate(()=>{const a=document.querySelector('#aj-auto'),c=document.querySelector('#main .panel:not(#aj-auto)');return !!a&&(!c||a.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING);}),'2.1: painel deveria vir antes do check-in da câmera');
    // foto nova do agente simulada: imagem escura numa biblioteca de teste
    const foto=async id=>pg.evaluate(id=>{const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');x.fillStyle='#2a2622';x.fillRect(0,0,300,200);x.fillStyle='#4a4038';x.fillRect(60,40,180,120);
      ETERNA.UP['ag_'+id]={src:c.toDataURL('image/jpeg',.9),name:id+'.jpg'};ETERNA.state.lib=(ETERNA.state.lib||[]).concat([{id,day:'2000-01-01',t:0}]);},id);
    await pg.click('[data-act="aj-autotoggle"]');await pg.waitForTimeout(200);
    t=await txt(pg,'#aj-auto');const s2=await sim(pg);
    ok(s2.autoAj===false&&/Desligado por Carlos às \d\d:\d\d/.test(t)&&/Ajuste automático desligado/.test(await toastTxt(pg)),'2.2: desligar: '+t);
    ok(s2.autoAjPor&&s2.autoAjPor.por==='carlos@eterna.photo'&&s2.autoAjPor.on===false,'2.2: quem mexeu: '+J(s2.autoAjPor));
    ok(/^Ajuste automático desligado por Carlos$/.test(s2.log[0].t),'2.4: registro: '+s2.log[0].t);
    await foto('v79t1');await pg.evaluate(()=>ETERNA.ajQueue());await pg.waitForTimeout(3500);
    ok(!(await pg.evaluate(()=>!!(ETERNA.SIM.edits||{})['ag_v79t1'])),'2.2: com o ajuste desligado a foto nova não pode ganhar ajuste');
    await pg.screenshot({path:`${P}/v79-upload-ajuste-desligado.png`});
    // 2.5: trocar de fotógrafo mantém desligado
    await pg.click('[data-act="set-switch"]');await pg.waitForTimeout(200);
    await pg.fill('[data-act="login-email"]','marinara@eterna.photo');await pg.click('button[type=submit]');await pg.waitForTimeout(150);const cc=(await pg.textContent('.otp')).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',cc);await pg.waitForTimeout(400);
    t=await txt(pg,'#aj-auto');ok(/Desligado por Carlos/.test(t)&&/Desligado$/.test(t),'2.5: trocar de fotógrafo deveria manter desligado: '+t);
    ok(!(await pg.$('#nav [data-v="ajustes"]'))&&!(await pg.evaluate(()=>ETERNA.canView('ajustes'))),'2.6: Fotógrafo com Ajuste automático no menu');
    await pg.evaluate(()=>{location.hash='#ajustes';});await pg.waitForTimeout(250);ok(await pg.evaluate(()=>ETERNA.state.view)!=='ajustes','2.6: #ajustes abriu para o Fotógrafo');
    // 2.3: religar ajusta as fotos que chegaram desligado
    await verView(pg,'importar');await pg.click('[data-act="aj-autotoggle"]');await pg.waitForTimeout(200);let ed=null;
    for(let i=0;i<20&&!ed;i++){await pg.waitForTimeout(500);ed=await pg.evaluate(()=>(ETERNA.SIM.edits||{})['ag_v79t1']||null);}
    ok(ed&&ed.auto===true,'2.3: religar deveria ajustar a foto que chegou desligado: '+J(ed));
    ok(/Ligado por Marinara/.test(await txt(pg,'#aj-auto')),'2.3: "Ligado por Marinara"');
    await pg.click('[data-act="aj-autotoggle"]');await pg.waitForTimeout(150); // deixa desligado para o admin conferir
    // 2.5: admin em Configurações › Ajuste automático vê o mesmo estado
    await pg.click('[data-act="set-logout"]');await pg.waitForTimeout(200);ok(await login(pg,'eduardo@eduardorezende.com'),'2.5: admin não entrou');await verView(pg,'ajustes');
    t=await txt(pg,'#aj-auto');ok(/Desligado por Marinara/.test(t),'2.5: admin em Ajuste automático: '+t);
    // 2.7: supervisor só leitura
    await pg.evaluate(()=>localStorage.removeItem('eterna.session'));ok(await login(pg,'supervisor@eterna.photo'),'2.7: supervisor não entrou');await verView(pg,'importar');
    ok(await pg.evaluate(()=>document.querySelector('[data-act="aj-autotoggle"]').disabled),'2.7: botão deveria estar desabilitado para o supervisor');
    await pg.evaluate(()=>document.querySelector('[data-act="aj-autotoggle"]').removeAttribute('disabled'));await pg.click('[data-act="aj-autotoggle"]');await pg.waitForTimeout(150);
    ok((await toastTxt(pg))==='Sem permissão para alterar em Upload, câmeras e ajustes'&&(await sim(pg)).autoAj===false,'2.7: clique forçado do supervisor: '+await toastTxt(pg));
    ok(await pg.evaluate(()=>{ETERNA.ajAutoSet(true);return ETERNA.SIM.autoAj;})===false,'N1: ajAutoSet pelo console sem set.u ligou o ajuste');
    await cx.close();}

  // =================== Item 3: botão da equipe no Checkout (B1: só na câmera, antes de qualquer toque de cliente) ===================
  fase='3.1';
  if(SO.includes('3')){const cx=await nova(b,1280,900);const pg=await pagina(cx,'3 admin');ok(await login(pg,'eduardo@eduardorezende.com'),'3: admin não entrou');
    await verView(pg,'vendas-lista');const card=await pg.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=4).card);
    const abrir=async()=>{await pg.evaluate(()=>{ETERNA.state.view='vendas-lista';ETERNA.render();});await pg.evaluate(()=>ETERNA.go('quiosque'));await pg.waitForTimeout(300); /* v81: Checkout na mesma aba (o botão abre janela à parte) */await pg.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});}; // a câmera simulada acha um rosto sozinha em ~5 s (isso é cliente e tira o botão)
    const btn=()=>pg.evaluate(()=>{const e=document.querySelector('.lj-staffhome');return e?{t:e.innerText.trim(),armed:e.classList.contains('armed')}:null;});
    await abrir();ok(J(await btn())===J({t:'Equipe: voltar ao app',armed:false}),'3.1/B1: botão fixo em português na câmera: '+J(await btn()));
    await pg.click('[data-act="lang"][data-l="en"]');await pg.waitForTimeout(80);ok((await btn()||{}).t==='Equipe: voltar ao app','B1: o rótulo não muda com o idioma do cliente');
    await pg.screenshot({path:`${P}/v79-checkout-equipe.png`});
    fase='3.2';
    await pg.click('.lj-staffhome');await pg.waitForTimeout(100);ok(J(await btn())===J({t:'Toque de novo: voltar ao app da equipe',armed:true}),'3.2: primeiro toque deveria armar: '+J(await btn()));
    await pg.waitForTimeout(3300);ok(J(await btn())===J({t:'Equipe: voltar ao app',armed:false})&&await pg.evaluate(()=>ETERNA.state.lojaRota),'3.2: depois de 3 s deveria desarmar sem sair');
    await pg.click('.lj-staffhome');await pg.waitForTimeout(3200);await pg.click('.lj-staffhome');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.lojaRota),'3.2: dois toques com mais de 3 s não podem sair');
    await pg.waitForTimeout(3300);
    fase='3.1b';
    await pg.click('.lj-staffhome');await pg.waitForTimeout(150);await pg.click('.lj-staffhome');await pg.waitForTimeout(300);
    let r=await pg.evaluate(()=>({v:ETERNA.state.view,u:!!ETERNA.state.user,loja:ETERNA.state.lojaRota,h:location.hash,s:!!localStorage.getItem('eterna.session'),saida:ETERNA.state.lojaSaidaEquipe,aba:sessionStorage.getItem('eterna.lojaTab')}));
    ok(r.v==='vendas-lista'&&r.u&&!r.loja&&r.h==='#vendas-lista'&&r.s&&r.saida===false&&!r.aba,'3.1/rev 9: dois toques voltam à Lista de vendas logado, sem marca de saída nem de aba do Checkout: '+J(r));
    await pg.evaluate(()=>{location.hash='#perfis';});await pg.waitForTimeout(250);ok(await pg.evaluate(()=>!!ETERNA.state.user),'3.1: depois de voltar, trocar de tela deslogou');
    // B1: some na escolha e no carrinho e não volta depois que um cliente mexeu
    fase='B1';
    await abrir();await pg.click('[data-act="kiosk-emerg"]');await pg.waitForTimeout(100);ok(!(await btn()),'B1: tocar em "código do recibo" já é cliente');
    await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(400);ok(!(await btn()),'B1: sem botão na escolha');
    await pg.evaluate(c=>{const it=ETERNA.lojaItems(c);const pk=ETERNA.lojaPick(c);pk[it[0].k]='ok';ETERNA.state.kiosk.step='cart';ETERNA.render();},card);await pg.waitForTimeout(150);ok(!(await btn()),'B1: sem botão no carrinho');
    await pg.click('.lj-back0');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>ETERNA.state.kiosk.step)==='code'&&!(await btn()),'B1: de volta à câmera depois de um cliente, o botão não volta');
    await pg.evaluate(()=>{ETERNA.state.lojaEquipeAte=Date.now()+60000;ETERNA.state.kiosk.step='review';});ok(!(await pg.evaluate(()=>ETERNA.lojaEquipeOn())),'B1: lojaEquipeOn só no passo da câmera');
    await abrir();await pg.evaluate(()=>{ETERNA.state.cam.busy=false;});await pg.waitForFunction(()=>ETERNA.state.kiosk.step!=='code',null,{timeout:15000}).catch(()=>{});
    await pg.evaluate(()=>{ETERNA.state.kiosk.step='code';ETERNA.render();});ok(!(await btn()),'B1: a câmera achar o cliente também tira o botão');
    // 3.3: depois da primeira compra o botão some
    fase='3.3';
    await abrir();await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(400);
    await pg.evaluate(()=>{ETERNA.state.kiosk.step='cart';ETERNA.render();});await pg.waitForTimeout(150);await pagar(pg,'card');
    await pg.click('.lj-restart');await pg.waitForTimeout(250);ok(!(await btn()),'3.3: depois da compra o botão deveria sumir');
    // I1: recarregar a janela do Checkout não entra logado (a sessão salva continua para as outras janelas)
    fase='I1';
    await pg.reload();await pg.waitForTimeout(600);
    r=await pg.evaluate(()=>({u:!!ETERNA.state.user,loja:ETERNA.state.lojaRota,h:location.hash,s:!!localStorage.getItem('eterna.session')}));ok(!r.u&&r.loja&&r.h==='#loja'&&r.s,'I1: recarregar o Checkout aberto pela equipe: '+J(r));
    await pg.goto(U+'#caixa');await pg.reload();await pg.waitForTimeout(600);
    r=await pg.evaluate(()=>({u:!!ETERNA.state.user,loja:ETERNA.state.lojaRota,din:!!document.querySelector('[data-act="din-confirm"]')}));ok(!r.u&&r.loja&&!r.din,'I1: #caixa recarregado na aba do Checkout: '+J(r));
    // 3.6 (v81): na aba do Checkout sem login, Esc só volta ao início do #loja e não apaga a sessão salva (o admin usa o mesmo navegador); a saída da equipe é pelo painel (3 toques no logo) › Sair do Checkout, que vai ao login e apaga
    await pg.keyboard.press('Escape');await pg.waitForTimeout(250);r=await pg.evaluate(()=>({v:ETERNA.state.view,u:!!ETERNA.state.user,s:!!localStorage.getItem('eterna.session'),h:location.hash}));ok(r.v==='quiosque'&&!r.u&&r.s&&r.h==='#loja','3.6/v81: Esc na aba do Checkout deveria ficar no #loja: '+J(r));
    await pg.evaluate(()=>{ETERNA.state.kiosk.equipe=true;ETERNA.render();});await pg.waitForTimeout(100);await pg.click('[data-act="loja-sair"]');await pg.waitForTimeout(250);
    r=await pg.evaluate(()=>({v:ETERNA.state.view,u:!!ETERNA.state.user,s:localStorage.getItem('eterna.session')}));ok(r.v==='entrar'&&!r.u&&!r.s,'3.6: Sair do Checkout deveria ir ao login: '+J(r));
    // 3.4: depois de 10 min some e o clique não faz nada (login nesta aba devolve a aba à equipe)
    fase='3.4';
    await pg.reload();await pg.waitForTimeout(400);ok(await pg.evaluate(()=>ETERNA.state.lojaRota&&!ETERNA.state.user),'I1: depois do Esc, recarregar a aba do Checkout volta ao Checkout, sem login');
    await pg.evaluate(()=>{ETERNA.state.kiosk.equipe=true;ETERNA.render();});await pg.waitForTimeout(100);await pg.click('[data-act="loja-sair"]');await pg.waitForTimeout(200);ok(await codigo(pg,'eduardo@eduardorezende.com'),'3.4: admin não entrou');ok(await pg.evaluate(()=>!sessionStorage.getItem('eterna.lojaTab')),'I1: login na aba tira a marca do Checkout');
    await abrir();ok(!!(await btn()),'3.4: botão deveria aparecer');
    await pg.evaluate(()=>{ETERNA.state.lojaEquipeAte=Date.now()-1;});await pg.click('.lj-staffhome');await pg.waitForTimeout(80);
    ok(!(await btn())&&await pg.evaluate(()=>ETERNA.state.lojaRota),'3.4: depois de 10 min o botão some e o clique não sai');
    await cx.close();
    // 3.5: #loja direto com sessão salva (aba sem marca) e recarregado: entra logado, mas sem botão
    fase='3.5';
    {const c2=await nova(b,1280,900);const p2=await pagina(c2,'3.5 direto');ok(await login(p2,'eduardo@eduardorezende.com'),'3.5: admin não entrou');
      await p2.goto(U+'#loja');await p2.reload();await p2.waitForTimeout(500);
      ok(await p2.evaluate(()=>ETERNA.state.lojaRota&&!ETERNA.state.user&&!document.querySelector('.lj-staffhome')&&sessionStorage.getItem('eterna.lojaTab')==='1'),'3.5/I1: #loja direto e recarregado: sem login e sem botão');
      await p2.goto(U.replace('index.html','index.html?y')+'#caixa');await p2.waitForTimeout(600);
      const ic=await p2.evaluate(()=>({u:!!ETERNA.state.user,loja:ETERNA.state.lojaRota,v:ETERNA.state.view,din:!!document.querySelector('[data-act="din-confirm"]'),s:!!localStorage.getItem('eterna.session')}));
      ok(!ic.u&&ic.loja&&!ic.din&&ic.s,'I1: depois de /#loja direto, carregar ?y#caixa continua no Checkout sem login: '+J(ic));
      const c3=await p2.context().newPage();await c3.goto(U+'#vendas-lista');await c3.waitForTimeout(400);ok(await c3.evaluate(()=>!!ETERNA.state.user),'I1: uma aba nova da equipe continua logada');await c3.close();
      // entrar em #loja pelo endereço numa aba logada também marca a aba
      const c4=await p2.context().newPage();await c4.goto(U+'#perfis');await c4.waitForTimeout(400);await c4.evaluate(()=>{location.hash='#loja';});await c4.waitForTimeout(300);
      ok(await c4.evaluate(()=>sessionStorage.getItem('eterna.lojaTab')==='1'),'I1: hashchange para #loja marca a aba');await c4.reload();await c4.waitForTimeout(400);ok(await c4.evaluate(()=>!ETERNA.state.user&&ETERNA.state.lojaRota),'I1: recarregar depois de entrar em #loja pelo endereço não entra logado');
      await c2.close();}
    const cq=await nova(b,1280,900);const pq=await pagina(cq,'3.5 quiosque');ok(await login(pq,'quiosque@eterna.photo'),'3.5: quiosque não entrou');
    ok(await pq.evaluate(()=>ETERNA.state.lojaRota)&&!(await pq.evaluate(()=>!!document.querySelector('.lj-staffhome'))),'3.5: perfil Checkout não pode ter o botão');
    await pq.keyboard.press('Escape');await pq.waitForTimeout(250);ok(await pq.evaluate(()=>ETERNA.state.view==='entrar'&&!ETERNA.state.user),'3.5: Esc do perfil Checkout leva ao login');
    await cq.close();}
}catch(e){fails.push(`erro em ${fase}: ${e.message.split('\n').slice(0,3).join(' ')}`);}
await b.close();
const ok2=!fails.length&&!errs.length;
console.log(`${ok2?'OK':'FALHA'} v79-regressao: dinheiro aguardando caixa, ajuste automático no Upload, botão da equipe, valor do pacote, correções da revisão${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,4).join(' | '):''}`);process.exit(ok2?0:1);})();
