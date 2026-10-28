// Galeria online por QR (critérios 1 a 14) e Loja apartada em #loja (critérios 22 a 26), no modo SIM (sem agente).
// O reconhecimento usa o mesmo do app (YuNet + SFace no navegador, índice das fotos de exemplo); a "selfie" é uma foto da própria sessão.
const {chromium}=require('playwright');const login=require('./_login');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const fails=[];const errs=[];const T0=Date.now();const dbg=s=>{if(process.env.GQ_DEBUG)console.error(((Date.now()-T0)/1000).toFixed(1)+'s '+s);};const ok=(c,m)=>{if(!c)fails.push(m);};
const ignora=t=>/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(t);
const TOKRE=/^[A-Za-z0-9_-]{22}$/,CODRE=/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
async function nova(ctx,nome,vp){const pg=await ctx.newPage();if(vp)await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!ignora(m.text()))errs.push(nome+': '+m.text())});return pg;}
// Loja de ponta a ponta em #loja: código do recibo, ✓ ✓ ✗ ✓, Pix, pagar
async function compraLoja(pg,card){await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(700);
  for(const a of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await pg.click(`[data-act="${a}"]`);
  await pg.click('.lj-next');await pg.waitForTimeout(250);await pg.click('[data-act="loja-paym"][data-m="pix"]');await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(400);}
async function fotoDe(pg,id,escala){return pg.evaluate(async([id,k])=>{const c=await ETERNA.photoCanvas(id);const x=document.createElement('canvas');x.width=c.width*k;x.height=c.height*k;x.getContext('2d').drawImage(c,0,0,x.width,x.height);return x.toDataURL('image/jpeg',.9).split(',')[1];},[id,escala||1]);}
// espera a câmera assentar (pronta ou sem câmera) antes de mandar a foto; se estourar o tempo, registra o estado
async function selfie(pg,b64){await pg.waitForFunction(()=>{const s=ETERNA.state.guest.selfie;return !s||s.err||s.ready;},null,{timeout:20000}).catch(()=>{});await pg.waitForTimeout(150);
  await pg.setInputFiles('#gq-file',{name:'selfie.jpg',mimeType:'image/jpeg',buffer:Buffer.from(b64,'base64')});
  try{await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='buscando'&&ETERNA.pub.step!=='selfie',null,{timeout:150000});}
  catch(e){const st=await pg.evaluate(()=>({pub:ETERNA.pub&&{step:ETERNA.pub.step,motivo:ETERNA.pub.motivo},face:ETERNA.state.face})).catch(()=>null);throw new Error('selfie sem resposta: '+JSON.stringify(st));}}
async function abrirGaleria(pg,tok){await pg.goto(U+'#g/'+tok);await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});}
async function consentir(pg){await pg.check('[data-act="gq-consent"]');await pg.click('#gq-agree');await pg.waitForSelector('#gq-file',{state:'attached'});}
const gqCruas=pg=>pg.evaluate(()=>{const t=document.body.innerText+' '+[...document.querySelectorAll('[title],[aria-label],[placeholder]')].map(e=>(e.title||'')+(e.getAttribute('aria-label')||'')+(e.placeholder||'')).join(' ');return (t.match(/\b(gq|lj)_[A-Za-z]+/g)||[]);});

(async()=>{const b=await chromium.launch();
try{
  // ---------- 1. sem cdnjs no index.html; QR desenhado mesmo com o cdnjs bloqueado ----------
  dbg('1. sem cdnjs no index.html; QR desenhado');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');ok(!/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs/.test(html),'1: index.html ainda referencia o qrcodejs do cdnjs');
  const ctx=await b.newContext({viewport:{width:1280,height:900},locale:'pt-BR'});await ctx.route('**/cdnjs.cloudflare.com/**',r=>r.abort());
  const L=await nova(ctx,'loja');await L.goto(U+'#loja');await L.waitForTimeout(600);await L.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');});await L.reload();await L.waitForTimeout(800);
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8).map(s=>s.card));const card=cards[0];
  await compraLoja(L,card);
  const q1=await L.evaluate(()=>{const el=document.querySelector('#lqr');return {temQR:!!(el&&el.querySelector('canvas,img')),title:el&&el.title,paid:ETERNA.state.kiosk.paid,txt:(document.querySelector('.lj-qrcode')||{}).textContent||'',step:ETERNA.state.kiosk.step};});
  ok(q1.step==='done','pré: Loja não chegou ao fim: '+q1.step);ok(q1.temQR,'1: #lqr sem canvas/img depois do pagamento');
  // ---------- 2 e 3. token, código curto e texto do QR ----------
  dbg('2 e 3. token, código curto e texto do QR');
  const tok=q1.paid&&q1.paid.token;ok(TOKRE.test(tok||''),'2: token fora do formato: '+tok);ok(tok&&tok!==card&&!tok.includes(card),'2: token igual ao LP ou contendo o LP');
  const sim1=await L.evaluate(t=>{const S=ETERNA.SIM;return {m:S.galerias[t]};},tok);ok(sim1.m&&sim1.m.sessoes[0]===card&&sim1.m.tipo==='sessao','2: manifesto da sessão não está em SIM.galerias');
  const cod=(q1.txt.match(/Código (\S+)/)||[])[1];ok(CODRE.test(cod||''),'3: código curto fora do formato: '+q1.txt);ok(cod===q1.paid.codigo,'3: código da tela diferente do manifesto');
  ok(q1.title==='https://eterna.photo/#g/'+tok,'3: texto do QR: '+q1.title);
  // ---------- 24. tela final volta sozinha em 5 s; "Voltar ao início" volta antes (criterio 4 substituído pelo adendo A4) ----------
  dbg('24. tela final volta sozinha em 5 s; "Vo');
  // relógio parado antes da compra: o tempo real gasto nos cliques não conta na tela final (adendo 3: 30 s, configurável)
  // o relógio do Playwright vale para o contexto inteiro: a Loja com relógio roda num contexto próprio
  const ctxC=await b.newContext({viewport:{width:1280,height:900},locale:'pt-BR'});const C=await nova(ctxC,'clock');await C.clock.install();await C.goto(U+'#loja');await C.waitForTimeout(500);await C.clock.pauseAt(new Date(Date.now()+60000));
  const card2=cards[1]||cards[0];await compraLoja(C,card2);const tok2=await C.evaluate(()=>ETERNA.state.kiosk.paid.token);
  ok(TOKRE.test(tok2||'')&&tok2!==tok,'2: dois pagamentos deveriam gerar tokens diferentes');
  ok((await C.textContent('#lj-volta-n')).trim()==='30','24: a contagem deveria começar em 30');
  await C.clock.runFor(25000);ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='done','24: aos 25 s a tela final deveria continuar');
  const n3=await C.textContent('#lj-volta-n');ok(/^[3-5]$/.test((n3||'').trim()),'24: contagem visível aos 25 s deveria mostrar uns 5 s, mostra '+n3);
  await C.clock.runFor(5300);ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='code','24: aos 30 s deveria voltar para a câmera');
  ok(await C.evaluate(()=>!ETERNA.state.kiosk.timer),'24: o timer da tela final deveria morrer ao voltar');
  // tempo configurável no Catálogo (seção Checkout): 10 s
  dbg('catalogo 10s');
  {const A0=await nova(ctxC,'catalogo');await login(A0);await A0.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();});await A0.fill('#loja-fim','10');await A0.press('#loja-fim','Tab');await A0.waitForTimeout(150);
    ok(await A0.evaluate(()=>ETERNA.SIM.lojaFimSeg)===10,'24: o Catálogo não gravou o tempo da tela final');await A0.evaluate(()=>localStorage.removeItem('eterna.session'));await A0.close();
    await C.reload();await C.waitForTimeout(400);await C.clock.pauseAt(new Date(Date.now()+120000));await compraLoja(C,card2);
    await C.clock.runFor(9000);ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='done','24: com 10 s, aos 9 s a tela final deveria continuar');
    await C.clock.runFor(1300);ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='code','24: com 10 s, deveria voltar aos 10 s');}
  // botão antes do tempo
  const card3=cards[2]||cards[0];await compraLoja(C,card3);await C.clock.runFor(1000);await C.click('.lj-restart');ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='code','24: "Voltar ao início" deveria voltar na hora');
  // ---------- 23. 5 minutos parado nas fotos não mudam de etapa (A3 cancelado) ----------
  dbg('23. 5 minutos parado nas fotos não mudam');
  await C.click('[data-act="kiosk-emerg"]');await C.fill('#kcode',card3);await C.click('[data-act="kiosk-go"]');await C.clock.runFor(1000);
  ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='review','23: não abriu as fotos');await C.clock.runFor(5*60*1000);ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='review','23: 5 min parado nas fotos mudaram a etapa');
  // A6: voltar manual nas fotos, no carrinho e no código
  await C.click('[data-act="loja-new"]');ok(await C.evaluate(()=>ETERNA.state.kiosk.step==='code'&&!ETERNA.state.kiosk.code),'A6: voltar nas fotos não limpou o cliente');
  await C.click('[data-act="kiosk-emerg"]');await C.fill('#kcode',card3);await C.click('[data-act="kiosk-go"]');await C.clock.runFor(800);await C.click('[data-act="kiosk-ok"]');await C.click('.lj-next');await C.clock.runFor(300);
  await C.click('.lj-checkout [data-act="loja-new"]');ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='code','A6: voltar no carrinho não voltou para a câmera');
  await C.click('[data-act="kiosk-emerg"]');ok(await C.isVisible('[data-act="kiosk-back"]'),'A6: sem botão de voltar na etapa do código');await C.click('[data-act="kiosk-back"]');ok(await C.evaluate(()=>ETERNA.state.kiosk.step)==='code','A6: voltar no código');
  await C.close();await ctxC.close();
  // ---------- 5. galeria pública sem login: consentimento ----------
  dbg('5. galeria pública sem login: consentime');
  const G=await nova(ctx,'galeria',{width:390,height:844});await abrirGaleria(G,tok);
  const g5=await G.evaluate(()=>({h:location.hash,step:ETERNA.pub.step,ph:document.querySelectorAll('.gq-ph').length,dis:document.querySelector('#gq-agree').disabled,user:!!ETERNA.state.user}));
  ok(g5.step==='consent'&&g5.h==='#g/'+tok&&g5.ph===0&&g5.dis&&!g5.user,'5: consentimento sem login: '+JSON.stringify(g5));
  await G.check('[data-act="gq-consent"]');ok(!(await G.evaluate(()=>document.querySelector('#gq-agree').disabled)),'5: botão continua desativado depois de marcar');
  await G.click('#gq-agree');await G.waitForSelector('#gq-file',{state:'attached'});
  // ---------- 7. rosto de fora da sessão: nao_encontrado, tentativas caem, depois bloqueio ----------
  dbg('7. rosto de fora da sessão: nao_encontra');
  const fora=await G.evaluate(async c=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const ss=ETERNA.demoSessions();const meu=ss.find(s=>s.card===c);
    const cand=[];for(const s of ss){if(s.card===c||s.key===meu.key)continue;const id=s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length);if(id)cand.push(id);if(cand.length>=8)break;}
    for(const id of cand){const cv=await ETERNA.photoCanvas(id);const r=await ETERNA.faceFind(cv,x=>x.card===c);if(!r.semRosto&&!(r.list[0]&&r.list[0].sc>=.45))return id;}return null;},card);
  ok(!!fora,'pré: não achei foto de alguém fora da sessão');
  const foraB64=fora&&await fotoDe(G,fora);
  if(foraB64){await selfie(G,foraB64);const g7=await G.evaluate(()=>({step:ETERNA.pub.step,motivo:ETERNA.pub.motivo,restam:ETERNA.pub.restam,ph:document.querySelectorAll('.gq-ph').length,txt:document.body.innerText}));
    ok(g7.step==='nao'&&g7.motivo==='nao_encontrado'&&g7.restam===4&&g7.ph===0&&/não aparece nas fotos desta visita/i.test(g7.txt)&&/4 tentativas/.test(g7.txt),'7: primeira falha: '+JSON.stringify({...g7,txt:g7.txt.slice(0,120)}));
    // ---------- 8. nada de imagem guardada ----------
    const g8=await G.evaluate(()=>{const all=JSON.stringify(ETERNA.pub)+JSON.stringify(ETERNA.state.guest.selfie||null);let st='';for(const s of [localStorage,sessionStorage])for(let i=0;i<s.length;i++)st+=s.getItem(s.key(i));return /data:image/.test(all)||/data:image/.test(st);});
    ok(!g8,'8: string data:image em state.pub, guest.selfie ou storage');}
  // ---------- 6. selfie de alguém da sessão ----------
  dbg('6. selfie de alguém da sessão');
  const meuId=await G.evaluate(c=>{const s=ETERNA.demoSessions().find(x=>x.card===c);return s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length);},card);
  const meuB64=await fotoDe(G,meuId);
  await G.click('[data-act="gq-retry"]');await G.waitForSelector('#gq-file',{state:'attached'});await selfie(G,meuB64);
  const g6=await G.evaluate(c=>{const s=ETERNA.demoSessions().find(x=>x.card===c);const sel=(ETERNA.SIM.sessions[c]||{}).selected||[];return {step:ETERNA.pub.step,n:s.photos.length,sel:sel.length,dl:document.querySelectorAll('[data-act="gq-dl"]').length,wm:document.querySelectorAll('.gq-ph .wm').length,yours:[...document.querySelectorAll('[data-act="gq-dl"]')].map(b=>b.dataset.pid)};},card);
  ok(g6.step==='galeria'&&g6.sel===3&&g6.dl===3&&g6.wm===g6.n-3,'6: galeria depois da selfie: '+JSON.stringify(g6));
  ok(!(await G.evaluate(()=>{let st='';for(const s of [localStorage,sessionStorage])for(let i=0;i<s.length;i++)st+=s.getItem(s.key(i));return /data:image/.test(JSON.stringify(ETERNA.pub)+JSON.stringify(ETERNA.state.guest.selfie||null)+st);})),'8: imagem guardada depois do acerto');
  // ---------- 13. cinco idiomas, sem chave crua ----------
  dbg('13. cinco idiomas, sem chave crua');
  for(const l of ['en','es','fr','de','pt']){await G.click(`.lj-langs [data-l="${l}"]`);await G.waitForTimeout(80);const cr=await gqCruas(G);ok(!cr.length,'13: chave crua em '+l+': '+cr.slice(0,3).join(','));}
  const en=await G.evaluate(()=>{const b=document.querySelector('.lj-langs [data-l="en"]');b.click();return document.body.innerText;});ok(/Your photos/i.test(en),'13: inglês não trocou os textos');await G.click('.lj-langs [data-l="pt"]');
  // ---------- 14. data "Disponível até" = criada + 60 dias ----------
  dbg('14. data "Disponível até" = criada + 60 ');
  const g14=await G.evaluate(t=>{const m=ETERNA.SIM.galerias[t];const d=new Date(new Date(m.criada).getTime()+60*864e5).toLocaleDateString('pt-BR');return {ok:document.querySelector('.gq-until').textContent.includes(d),txt:document.querySelector('.gq-until').textContent,d};},tok);
  ok(g14.ok,'14: data de validade: '+JSON.stringify(g14));
  // ---------- 10 e 11. compra na galeria ----------
  dbg('10 e 11. compra na galeria');
  const g11=await G.evaluate(()=>{document.querySelector('[data-act="gq-all"]').click();const n=document.querySelectorAll('.gq-sel.on').length;return {n,bar:document.querySelector('.gq-bar').innerText,dig:ETERNA.SIM.prices.dig,};});
  const precos=await G.evaluate(()=>({dig:(ETERNA.SIM.prices.dig!=null?ETERNA.SIM.prices.dig:39),mais:(ETERNA.SIM.prices.mais!=null?ETERNA.SIM.prices.mais:250)}));
  const esperado=Math.min(g11.n*precos.dig,precos.mais);ok(g11.bar.replace(/\./g,'').includes('R$ '+esperado),'11: todas deveria cobrar '+esperado+': '+g11.bar);
  await G.screenshot({path:PR+'/galeria-cel-galeria.png',fullPage:false});
  await G.evaluate(()=>{ETERNA.pub.sel={};ETERNA.render();});const umPid=await G.evaluate(()=>{const b=document.querySelector('[data-act="gq-sel"]');b.click();return b.dataset.pid;});
  await G.click('[data-act="gq-buy"]');await G.click('[data-act="gq-paym"][data-m="pix"]');await G.click('[data-act="gq-pay"]');await G.waitForTimeout(300);
  const g10=await G.evaluate(p=>({vs:ETERNA.SIM.vendasOnline,yours:[...document.querySelectorAll('[data-act="gq-dl"]')].map(b=>b.dataset.pid),step:ETERNA.pub.step}),umPid);
  ok(g10.vs.length===1&&g10.vs[0].canal==='online'&&g10.vs[0].total===precos.dig&&g10.vs[0].n===1&&g10.vs[0].teste===true,'10: venda online: '+JSON.stringify(g10.vs));ok(g10.step==='galeria'&&g10.yours.includes(umPid),'10: foto comprada não foi para Suas fotos');
  // ---------- 26. bandeiras ----------
  dbg('26. bandeiras');
  const f26=await G.evaluate(()=>{const l=document.querySelector('.lj-langs');return {svgs:l.querySelectorAll('button svg').length,txt:l.innerText.trim(),names:[...l.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))};});
  ok(f26.svgs===5&&!/\b(PT|EN|ES|FR|DE)\b/.test(f26.txt)&&f26.names.join(',')==='Português,English,Español,Français,Deutsch','26: seletor de bandeiras na galeria: '+JSON.stringify(f26));
  // ---------- 9 e 10 na administração ----------
  dbg('9 e 10 na administração');
  const A=await nova(ctx,'admin',{width:1440,height:900});await login(A);await A.evaluate(()=>{ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.state.view='vendas-lista';ETERNA.render();});await A.waitForTimeout(200);
  await A.click('[data-act="sales-canal"][data-v="online"]');const v10=await A.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(tr=>tr.innerText));
  ok(v10.length===1&&/Online/.test(v10[0])&&/teste/.test(v10[0])&&!/Recibo|Cancelar/.test(v10[0]),'10: filtro Online na Lista de vendas: '+JSON.stringify(v10).slice(0,200));
  const [dl]=await Promise.all([A.waitForEvent('download'),A.click('[data-act="sales-csv"]')]);const csv=fs.readFileSync(await dl.path(),'utf8');ok(/;"?canal"?/.test(csv.split('\n')[0])&&/online/.test(csv),'10: CSV sem a coluna canal');
  await A.evaluate(()=>{ETERNA.state.view='galerias';ETERNA.render();});await A.fill('[data-act="gal-q"]',card);await A.click(`[data-act="gal-open"][data-card="${card}"]`);
  const venda=await A.evaluate(()=>{const b=document.querySelector('.galph.venda');return b&&b.dataset.pid;});const comprada=await A.evaluate(()=>{const b=document.querySelector('.galph.comprada');return b?{dis:b.disabled}:null;});
  ok(comprada&&comprada.dis,'9: foto comprada não deveria ter a opção de cortesia');
  await A.click(`.galph[data-pid="${venda}"]`);await A.selectOption('#gal-motivo','escola');await A.fill('#gal-nota','turma A');await A.click('[data-act="gal-cort-ok"]');
  const c9=await A.evaluate(()=>ETERNA.SIM.cortesiaLog[0]);ok(c9&&c9.por==='eduardo@eduardorezende.com'&&c9.motivo==='escola'&&c9.acao==='deu'&&c9.pid===venda,'9: log da cortesia: '+JSON.stringify(c9));
  await A.screenshot({path:PR+'/galeria-admin-sessao.png'});
  await G.reload();await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='consent');await consentir(G);await selfie(G,meuB64);
  const g9=await G.evaluate(p=>{const it=[...document.querySelectorAll('.gq-item')].find(x=>x.querySelector(`[data-act="gq-dl"][data-pid="${p}"]`));return {ok:!!it,gift:it&&/Cortesia/.test(it.innerText)};},venda);ok(g9.ok&&g9.gift,'9: cortesia deveria aparecer em Suas fotos com o selo: '+JSON.stringify(g9));
  await A.click(`.galph[data-pid="${venda}"]`);await A.click('[data-act="gal-cort-rm"]');const c9b=await A.evaluate(()=>ETERNA.SIM.cortesiaLog[0]);ok(c9b&&c9b.acao==='retirou'&&c9b.pid===venda,'9: retirar cortesia: '+JSON.stringify(c9b));
  // ---------- 12. grupo de escola com 2 sessões ----------
  dbg('12. grupo de escola com 2 sessões');
  const par=await A.evaluate(async()=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const ss=ETERNA.demoSessions().filter(s=>s.photos.some(p=>(ETERNA.FACEIDX[p.id]||[]).length));const by={};
    ss.forEach(s=>{const d=s.date==='hoje'?'hoje':s.date;(by[d]=by[d]||[]).push(s)});for(const [d,l] of Object.entries(by)){for(let i=0;i<l.length;i++)for(let j=0;j<l.length;j++){if(i===j||l[i].key===l[j].key)continue;return {d,a:l[i].card,b:l[j].card};}}return null;});
  ok(!!par,'pré: não achei duas sessões no mesmo dia');
  if(par){await A.click('[data-act="gal-tab"][data-v="grupos"]');await A.click('[data-act="gal-ev-novo"]');const dISO=par.d==='hoje'?await A.evaluate(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}):par.d;
    await A.fill('#gal-ev-nome','Escola Teste');await A.evaluate(d=>{const i=document.querySelector('[data-act="gal-ev-data"]');i.value=d;i.dispatchEvent(new Event('change',{bubbles:true}));},dISO);
    await A.check(`[data-act="gal-ev-ses"][data-card="${par.a}"]`);await A.check(`[data-act="gal-ev-ses"][data-card="${par.b}"]`);await A.click('[data-act="gal-ev-salvar"]');
    const ev=await A.evaluate(p=>{const S=ETERNA.SIM;const m=Object.values(S.galerias).find(x=>x.tipo==='evento'&&x.nome==='Escola Teste');return m&&{tok:m.token,ses:m.sessoes,menor:m.menor,ma:!!S.sessions[p.a].menor,mb:!!S.sessions[p.b].menor};},par);
    ok(ev&&ev.ses.length===2&&ev.menor&&ev.ma&&ev.mb,'12: grupo: '+JSON.stringify(ev));
    await A.screenshot({path:PR+'/galeria-admin-grupos.png'});
    if(ev){const E=await nova(ctx,'evento',{width:390,height:844});await abrirGaleria(E,ev.tok);ok(/responsável/.test(await E.textContent('.gq-consent')),'12: consentimento do grupo deveria ser o do responsável');
      await consentir(E);const idA=await E.evaluate(a=>{const s=ETERNA.demoSessions().find(x=>x.card===a);return s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length);},par.a);
      await selfie(E,await fotoDe(E,idA));
      const g12=await E.evaluate(async([a,b])=>{const pids=[...document.querySelectorAll('.gq-ph')].length;const shown=ETERNA.pub.match||[];const sa=ETERNA.demoSessions().find(x=>x.card===a).photos.map(p=>p.id);const sb=ETERNA.demoSessions().find(x=>x.card===b).photos.map(p=>p.id);
        return {step:ETERNA.pub.step,n:shown.length,ph:pids,todasA:shown.every(id=>sa.includes(id)),nenhumaB:!shown.some(id=>sb.includes(id))};},[par.a,par.b]);
      const sims=await E.evaluate(async([a,b,id])=>{const c=await ETERNA.photoCanvas(id);const r=await ETERNA.faceFind(c,x=>x.card===a||x.card===b);return (ETERNA.pub.match||[]).map(p=>r.sims[p]);},[par.a,par.b,idA]);
      ok(g12.step==='galeria'&&g12.n>0&&g12.ph===g12.n&&g12.todasA&&g12.nenhumaB&&sims.every(s=>s>=.5),'12: evento mostrou fotos erradas: '+JSON.stringify({...g12,sims}));
      await E.screenshot({path:PR+'/galeria-cel-evento.png'});await E.close();}}
  // ---------- 7 (bloqueio): 5 falhas ----------
  dbg('7 (bloqueio): 5 falhas');
  if(foraB64){const B=await nova(ctx,'bloqueio');await abrirGaleria(B,tok);await consentir(B);let last=null;
    for(let i=0;i<5;i++){if(i){await B.click('[data-act="gq-retry"]');await B.waitForSelector('#gq-file',{state:'attached'});}await selfie(B,foraB64);last=await B.evaluate(()=>({m:ETERNA.pub.motivo,r:ETERNA.pub.restam,t:document.body.innerText}));}
    ok(last.m==='bloqueado'&&/Muitas tentativas/i.test(last.t)&&!(await B.$('[data-act="gq-retry"]')),'7: depois de 5 falhas deveria bloquear: '+JSON.stringify({m:last.m,r:last.r}));await B.close();}
  // ---------- 14. sem rolagem horizontal em 3 tamanhos; prints ----------
  dbg('14. sem rolagem horizontal em 3 tamanhos');
  for(const [n,w,h] of [['cel',390,844],['tab',1024,1366],['desk',1440,900]]){await G.setViewportSize({width:w,height:h});await G.waitForTimeout(150);
    const sw=await G.evaluate(()=>({s:document.documentElement.scrollWidth,i:innerWidth,g:Math.max(...[...document.querySelectorAll('.gq *')].map(e=>e.getBoundingClientRect().right))}));ok(sw.s<=sw.i&&sw.g<=sw.i+1,`14: galeria com rolagem horizontal em ${w}px: `+JSON.stringify(sw));
    await G.screenshot({path:`${PR}/galeria-${n}.png`});
    await A.setViewportSize({width:w,height:h});await A.evaluate(()=>{ETERNA.state.gal.tab='sessoes';ETERNA.render();});await A.waitForTimeout(100);
    const sa=await A.evaluate(()=>({s:document.documentElement.scrollWidth,i:innerWidth}));ok(sa.s<=sa.i,`14: view galerias com rolagem horizontal em ${w}px: `+JSON.stringify(sa));await A.screenshot({path:`${PR}/galeria-admin-${n}.png`});}
  // ---------- CORRIGIR 2: venda da Loja cancelada tira o download da galeria ----------
  dbg('CORRIGIR 2: venda da Loja cancelada tira');
  await A.setViewportSize({width:1440,height:900});await A.evaluate(()=>{ETERNA.state.view='vendas-lista';ETERNA.state.sales.canal='all';ETERNA.render();});
  await A.click(`[data-act="sales-cancel"][data-card="${card}"]`);const r2=await A.evaluate(t=>ETERNA.SIM.galerias[t].fotos.filter(f=>f.direito==='comprada').map(f=>f.canal),tok);
  ok(r2.every(c=>c==='online')&&r2.length===1,'R2: depois de cancelar a venda da Loja, só a compra online deveria continuar comprada: '+JSON.stringify(r2));
  // ---------- 22, 25, 26 na Loja ----------
  dbg('22, 25, 26 na Loja');
  const N=await b.newContext({locale:'pt-BR'});const L2=await nova(N,'loja-sem-login');
  for(const [n,w,h] of [['cel',390,844],['tab',1024,1366],['desk',1440,900]]){await L2.setViewportSize({width:w,height:h});await L2.goto(U+'#loja');await L2.waitForTimeout(500);
    const l22=await L2.evaluate(()=>({step:ETERNA.state.kiosk.step,lj:!!document.querySelector('.lj.lj-full'),nav:!!document.querySelector('#nav')&&document.querySelector('#nav').offsetParent!==null,s:document.documentElement.scrollWidth,i:innerWidth,user:!!ETERNA.state.user,h:location.hash,full:!document.querySelector('[data-act="loja-full"]')}));
    ok(l22.step==='code'&&l22.lj&&!l22.nav&&l22.s<=l22.i&&!l22.user&&l22.h==='#loja'&&l22.full,`22: #loja em ${w}px: `+JSON.stringify(l22));await L2.screenshot({path:`${PR}/loja-rota-${n}.png`});}
  const f22=await L2.evaluate(()=>{const l=document.querySelector('.lj-langs');return {svgs:l.querySelectorAll('button svg').length,txt:l.innerText.trim()};});ok(f22.svgs===5&&!f22.txt,'26: bandeiras na Loja: '+JSON.stringify(f22));
  await L2.click('.lj-langs [data-l="es"]');ok(/Tus fotos/i.test(await L2.textContent('.lj-h1')),'26: trocar a bandeira não trocou o idioma');
  ok(!(await L2.$('[data-act="loja-list"]')),'S4b: "Sessões esperando" visível para o cliente');
  await L2.keyboard.press('Escape');ok(await L2.evaluate(()=>ETERNA.state.view==='entrar'&&!ETERNA.state.lojaRota),'25: Esc sem login deveria ir para o login');
  await login(L2);await L2.goto(U+'#loja');await L2.waitForTimeout(400);ok(await L2.evaluate(()=>ETERNA.state.lojaRota&&!!ETERNA.state.user),'25: logado, #loja deveria abrir a Loja');
  await L2.keyboard.press('Escape');await L2.waitForTimeout(150);const e25=await L2.evaluate(()=>({lj:ETERNA.state.lojaRota,v:ETERNA.state.view,user:!!ETERNA.state.user,login:!!document.querySelector('[data-act="login-email"]')}));ok(!e25.lj&&e25.v==='entrar'&&!e25.user&&e25.login,'25: Esc logado deveria ir para o login (nunca para o app): '+JSON.stringify(e25));
  // CORRIGIR 1: recarregar com eterna.view=checkout (ou quiosque) não abre a Loja para a equipe
  await login(L2);await L2.evaluate(()=>{localStorage.setItem('eterna.view','checkout');location.hash='';});await L2.reload();await L2.waitForTimeout(500);ok(await L2.evaluate(()=>!ETERNA.state.lojaRota&&location.hash!=='#loja'),'R1: reload com eterna.view=checkout abriu a Loja');
  await L2.evaluate(()=>{localStorage.setItem('eterna.view','quiosque');history.replaceState(null,'','#');});await L2.reload();await L2.waitForTimeout(500);ok(await L2.evaluate(()=>!ETERNA.state.lojaRota&&ETERNA.state.view!=='quiosque'),'R1: reload com eterna.view=quiosque abriu a Loja');
  await L2.evaluate(()=>{ETERNA.state.view='perfis';ETERNA.render();});ok(!(await L2.$('#nav [data-v="quiosque"]')),'v78: Checkout não é item do menu');await L2.click('#rail-ck [data-act="loja-abrir"]');await L2.waitForTimeout(300);ok(await L2.evaluate(()=>ETERNA.state.lojaRota&&location.hash==='#loja'),'A1: botão Abrir Checkout deveria levar a #loja');
  for(let i=0;i<3;i++)await L2.click('.lj-logo');await L2.waitForTimeout(150);const p25=await L2.evaluate(()=>({painel:!!document.querySelector('.lj-equipe'),lista:!!document.querySelector('.lj-equipe [data-act="loja-list"]'),lj:ETERNA.state.lojaRota}));
  ok(p25.painel&&p25.lista&&p25.lj,'25/S4b: 3 toques no logo deveriam abrir o painel da equipe: '+JSON.stringify(p25));
  await L2.click('.lj-equipe [data-act="loja-list"]');ok(await L2.$$eval('.lj-equipe [data-act="loja-open"]',e=>e.length)>0,'S4b: painel sem a lista de sessões esperando');
  await L2.click('[data-act="loja-sair"]');await L2.waitForTimeout(150);ok(await L2.evaluate(()=>!ETERNA.state.lojaRota&&ETERNA.state.view==='entrar'&&!ETERNA.state.user),'25: "Sair" do painel deveria ir para o login');
  await N.close();
  await ctx.close();
}catch(e){fails.push('erro: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();const okAll=!fails.length&&!errs.length;console.log(`${okAll?'OK':'FALHA'} galeria-qr: critérios 1 a 14 e 22 a 26${fails.length?' · '+fails.slice(0,6).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okAll?0:1);})();
