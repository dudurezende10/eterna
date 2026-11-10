// v96 (Eduardo, 09/11): Checkout do balcão.
// N1 a N7: na escolha a foto ocupa a tela inteira, com overlay discreto; em todas as etapas e na galeria nada rola de lado nem sai da tela.
// P1: a câmera só liga no Iniciar e desliga fora da etapa dela (e depois de um tempo sem rosto).
// P2 a P4: o Checkout não mostra pacote, preço nem forma de pagamento; o caixa escolhe no Posto de venda e o cliente vê o valor ao vivo.
// P5: alvos de toque de 72 px no Checkout. P6: a venda registrada sai igual à de antes (compara com o app da v94, b92ea0c).
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const os=require('os');const net=require('net');const {execFileSync,spawn}=require('child_process');
const login=require('./_login');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const RAIZ=path.join(__dirname,'..');const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const SHOTS=process.env.SHOTS||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TAMANHOS=[[1280,720],[1366,768],[1440,900],[1536,864],[1600,900],[1920,1080],[1366,657],[1536,730],[1920,969],[390,844]];
const UMA_TELA={camera:1,'camera ligada':1,codigo:1,escolha:1,'escolha marcada':1,pronto:1,valor:1,minhas:1,final:1};
const shot=async(pg,nome)=>{await pg.screenshot({path:`${PR}/${nome}`});if(SHOTS)await pg.screenshot({path:`${SHOTS}/${nome}`});};
const portaLivre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const errs=[];const fails=[];let n=0;let velho=null;
const ok=(c,m)=>{n++;if(!c)fails.push(m);};
try{
const ctx=await b.newContext({locale:'pt-BR',permissions:['camera']});
const nova=async(c,nome,vp)=>{const pg=await c.newPage();await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;};
// medição: rolagem do documento, rolagem interna visível, botões fora da tela, alvos de toque pequenos, câmera ligada
const medir=(pg,umaTela)=>pg.evaluate(umaTela=>{const W=innerWidth,H=innerHeight,d=document.documentElement;
  const vis=e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0;};
  const rolaY=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1)return p;}return null;};
  const root=document.querySelector('.lj,.gq')||document.body;const loja=root.classList.contains('lj');const fora=[],peq=[];
  root.querySelectorAll('button,a,input,.lj-langs').forEach(e=>{if(!vis(e))return;const r=e.getBoundingClientRect();const nome=(e.className||e.tagName)+':'+(e.dataset.act||'')+':'+(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,18);
    if(r.left<-1||r.right>W+1)fora.push(nome+' x '+Math.round(r.left)+'..'+Math.round(r.right));
    else if(!rolaY(e)&&(r.top<-1||r.bottom>H+1))fora.push(nome+' y '+Math.round(r.top)+'..'+Math.round(r.bottom));
    if(loja&&e.tagName==='BUTTON'&&(r.width<71.5||r.height<71.5))peq.push(nome+' '+Math.round(r.width)+'×'+Math.round(r.height));});
  const rolam=[];if(umaTela)root.querySelectorAll('*').forEach(e=>{const s=getComputedStyle(e);if(/auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1&&vis(e))rolam.push((e.className||e.tagName)+' '+e.scrollHeight+'>'+e.clientHeight);});
  const docY=d.scrollHeight>H+1||document.body.scrollHeight>H+1;
  return {sw:d.scrollWidth,W,H,semX:d.scrollWidth<=W&&document.body.scrollWidth<=W,docY,fora,rolam,peq,cam:!!(window.ETERNA&&ETERNA.state.cam&&ETERNA.state.cam.stream)};},umaTela);
const tabela={};
const confere=async(pg,etapa,w,h)=>{const m=await medir(pg,!!UMA_TELA[etapa]);const prob=[];if(!m.semX)prob.push('rolagem horizontal '+m.sw+'>'+m.W);if(m.fora.length)prob.push('fora: '+m.fora.slice(0,4).join(' | '));
  if(UMA_TELA[etapa]&&(m.docY||m.rolam.length))prob.push('rolagem vertical '+(m.rolam.slice(0,2).join(' | ')||'documento'));
  if(m.peq.length)prob.push('alvo < 72 px: '+m.peq.slice(0,4).join(' | '));
  if(etapa!=='camera ligada'&&etapa!=='galeria'&&m.cam)prob.push('câmera ligada fora da etapa dela');
  (tabela[w+'×'+h]=tabela[w+'×'+h]||{})[etapa]=prob.length?'FALHA':'ok';ok(!prob.length,`${w}×${h} ${etapa}: `+prob.join(' · '));return m;};
const ar=async pg=>pg.evaluate(()=>{const i=document.querySelector('#lj-lb .lj-lbimg');if(!i)return null;const r=i.getBoundingClientRect();return {w:r.width,h:r.height,top:r.top,left:r.left,H:innerHeight,W:innerWidth};});
// P2: nada de preço, pacote ou forma de pagamento no Checkout antes do caixa escolher
const semPreco=pg=>pg.evaluate(()=>{const t=document.querySelector('.lj').innerText;const nomes=['Pacote','Maracanã Mais','Tribuna de Honra','Gramado','Zona Mista','Arquibancada','Foto adicional','Cartão','PIX','Dinheiro'];
  return {rs:/R\$/.test(t),nomes:nomes.filter(x=>t.includes(x)),el:!!document.querySelector('.lj .lj-pkg,.lj .lj-pay,.lj .lj-pays,.lj .lj-total,.lj [data-act="loja-paym"],.lj [data-act="loja-pkg"]')};});

const L=await nova(ctx,'checkout',{width:1920,height:1080});await L.goto(U+'#loja');await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8).map(s=>s.card));
const V=await nova(ctx,'posto',{width:1366,height:768});await login(V);await V.evaluate(()=>localStorage.removeItem('eterna.session'));await V.evaluate(()=>ETERNA.go('posto'));await V.waitForTimeout(400);
const cam=()=>L.evaluate(()=>({on:!!ETERNA.state.kiosk.camOn,stream:!!ETERNA.state.cam.stream,face:!!document.querySelector('#cam-face'),ini:!!document.querySelector('[data-act="kiosk-start"]'),step:ETERNA.state.kiosk.step}));
const abrir=async card=>{await L.goto(U+'#loja');await L.waitForTimeout(300);await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);};
const pend=()=>L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
const posto=async(id,o)=>V.evaluate(([id,o])=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();return ETERNA.pendEscolher(id,o);},[id,o]);
const confirma=async id=>{await V.evaluate(id=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();return ETERNA.pendConfirmar(id,{ref:''});},id);
  for(let i=0;i<30;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&!ETERNA.state.kiosk.paid.wait))break;await sleep(100);}await L.waitForTimeout(400);};

// ---- P1: câmera só depois do Iniciar
let c=await cam();ok(c.ini&&!c.on&&!c.stream&&!c.face,'P1: tela inicial com Iniciar e câmera desligada: '+JSON.stringify(c));
const ini=await L.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-start"]').getBoundingClientRect();return {h:e.height,w:e.width,alt:!!document.querySelector('[data-act="kiosk-emerg"]'),txt:document.querySelector('[data-act="kiosk-start"]').innerText.trim()};});
ok(ini.h>=120&&ini.alt&&/INICIAR/i.test(ini.txt),'P1: Iniciar grande (≥ 120 px) e "Digitar seu código": '+JSON.stringify(ini));
await shot(L,'v96-iniciar.png');
for(const [l,t] of [['en',/start/i],['es',/iniciar/i],['fr',/commencer/i],['de',/starten/i],['pt',/iniciar/i]]){await L.click(`[data-act="lang"][data-l="${l}"]`);await L.waitForTimeout(60);ok(t.test(await L.textContent('[data-act="kiosk-start"]')),'P1: Iniciar em '+l);}
await L.click('[data-act="kiosk-start"]');for(let i=0;i<20&&!(await cam()).stream;i++)await sleep(100);c=await cam();ok(c.on&&c.stream&&c.face,'P1: Iniciar liga a câmera: '+JSON.stringify(c));
await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(200);c=await cam();ok(!c.stream&&!c.on,'P1: digitar o código desliga a câmera: '+JSON.stringify(c));
await L.click('[data-act="kiosk-back"]');await L.waitForTimeout(200);c=await cam();ok(c.ini&&!c.stream,'P1: voltar mostra o Iniciar de novo: '+JSON.stringify(c));
await L.evaluate(()=>ETERNA.lojaCamMs(1200));await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(400);ok((await cam()).stream,'P1: ligou de novo');
await L.waitForTimeout(2200);c=await cam();ok(!c.stream&&!c.on&&c.ini,'P1: sem rosto por um tempo, desliga e volta ao Iniciar: '+JSON.stringify(c));await L.evaluate(()=>ETERNA.lojaCamMs(60000));
await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(400);await L.evaluate(c=>{const k=ETERNA.state.kiosk;k.code=c;k.step='gallery';ETERNA.render();},cards[0]);await L.waitForTimeout(200);
c=await cam();ok(!c.stream&&c.step==='review','P1: achou a sessão, a câmera desliga: '+JSON.stringify(c));
await L.click('#lj-lb [data-act="loja-new"]');await L.waitForTimeout(200);c=await cam();ok(!c.stream&&c.ini,'P1: voltar ao início pela casa: '+JSON.stringify(c));

// ---- N1 a N4: escolha em tela cheia (1920×1080)
await abrir(cards[0]);
ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='review'&&ETERNA.state.kiosk.ver===0),'abre direto na foto ampliada');
await L.waitForTimeout(600);
let a=await ar(L);ok(a&&a.h>=.9*a.H&&a.left>=-1&&a.left+a.w<=a.W+1,'1920×1080: a foto ocupa ≥ 90% da altura: '+JSON.stringify(a));
const ctl=await L.evaluate(()=>{const lb=document.querySelector('#lj-lb');const R=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null;};
  const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const acts=[...document.querySelectorAll('.lj button')].filter(vis).map(b=>b.dataset.act+(b.dataset.l?':'+b.dataset.l:''));
  const img=R('#lj-lb .lj-lbimg');const cobre=s=>[...document.querySelectorAll(s)].filter(vis).some(e=>{const r=e.getBoundingClientRect();return img&&!(r.right<=img.left||img.right<=r.left||r.bottom<=img.top||img.bottom<=r.top);});
  return {acts,titulo:!!document.querySelector('.lj-title')&&vis(document.querySelector('.lj-title')),steps:!![...document.querySelectorAll('.lj-steps')].filter(vis).length,top:!![...document.querySelectorAll('.lj-top')].filter(vis).length,
    prev:R('.lj-lbnav.prev'),next:R('.lj-lbnav.next'),yes:R('#lj-lb .lj-yes'),no:R('#lj-lb .lj-no'),logo:(()=>{const e=document.querySelector('#lj-lb .lj-ovlogo');return e?{r:e.getBoundingClientRect().toJSON(),op:+getComputedStyle(e).opacity}:null;})(),
    cnt:(document.querySelector('#lj-lb .lj-lbcnt')||{}).textContent||'',cntFs:document.querySelector('#lj-lb .lj-lbcnt')?parseFloat(getComputedStyle(document.querySelector('#lj-lb .lj-lbcnt')).fontSize):0,
    yesBg:document.querySelector('#lj-lb .lj-yes')?getComputedStyle(document.querySelector('#lj-lb .lj-yes')).backgroundColor:'',fundo:getComputedStyle(lb).backgroundColor,
    cobreTopo:cobre('.lj-top,.lj-steps,.lj-title'),W:innerWidth,H:innerHeight};});
ok(!ctl.titulo&&!ctl.steps&&!ctl.top&&!ctl.cobreTopo,'sem cabeçalho, título ou barra de etapas sobre a foto: '+JSON.stringify({t:ctl.titulo,s:ctl.steps,top:ctl.top}));
const previstos=new Set(['loja-logo','kiosk-ver','kiosk-ok','kiosk-no','lang','lj-lg','loja-new','loja-cart','kiosk-fechar']);
const extras=ctl.acts.filter(x=>!previstos.has(x.split(':')[0]));ok(!extras.length,'só os controles previstos na escolha: '+extras.join(','));
ok(ctl.prev&&ctl.next&&ctl.prev.width>=72&&ctl.prev.height>=72&&ctl.next.width>=72&&ctl.prev.left<ctl.W*.15&&ctl.next.right>ctl.W*.85,'setas ‹ › nas laterais com alvo ≥ 72 px: '+JSON.stringify({p:ctl.prev,n:ctl.next}));
ok(ctl.yes&&ctl.no&&Math.abs((ctl.yes.left+ctl.yes.right)/2-ctl.W/2)<ctl.W*.08&&ctl.yes.bottom>ctl.H*.8&&ctl.yes.width>=80&&/255, 184, 0/.test(ctl.yesBg)&&Math.abs((ctl.no.top+ctl.no.bottom)/2-(ctl.yes.top+ctl.yes.bottom)/2)<20,'✓ amarelo grande no centro embaixo, ✗ ao lado: '+JSON.stringify({y:ctl.yes,n:ctl.no,bg:ctl.yesBg}));
ok(ctl.logo&&ctl.logo.op<=.7&&ctl.logo.r.height<=48&&(ctl.logo.r.left<ctl.W*.2||ctl.logo.r.right>ctl.W*.8),'logo pequeno e discreto num canto: '+JSON.stringify(ctl.logo));
ok(/^\s*1 \/ \d+\s*$/.test(ctl.cnt)&&ctl.cntFs<=16,'contador pequeno "1 / N": '+ctl.cnt+' '+ctl.cntFs);
ok(/^rgb\((10|11|12|13), (2\d|3\d|4\d|5\d|6\d), (5\d|6\d|7\d)/.test(ctl.fundo),'fundo azul escuro da marca: '+ctl.fundo);
ok(!(await L.$('#lj-lb .lj-next')),'sem foto marcada, sem botão Continuar');
await shot(L,'v96-escolha-1920.png');
// teclado: → ← Enter
await L.keyboard.press('ArrowRight');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.kiosk.ver)===1,'→ vai para a próxima');
await L.keyboard.press('ArrowLeft');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.kiosk.ver)===0,'← volta');
await L.keyboard.press('Enter');await L.waitForTimeout(120);
let k=await L.evaluate(()=>{const k=ETERNA.state.kiosk;return {ver:k.ver,n:ETERNA.lojaCart(k.code).ch.length};});ok(k.ver===1&&k.n===1,'Enter marca ✓ e passa para a próxima: '+JSON.stringify(k));
const cont=await L.evaluate(()=>{const e=document.querySelector('#lj-lb .lj-next');if(!e)return null;const r=e.getBoundingClientRect();return {t:e.innerText.replace(/\s+/g,' ').trim(),r:r.toJSON(),W:innerWidth,H:innerHeight};});
ok(cont&&/Continuar · 1 foto/.test(cont.t)&&cont.r.right>cont.W*.7&&cont.r.bottom>cont.H*.85,'"Continuar · N fotos" discreto no canto inferior direito: '+JSON.stringify(cont));
let sp=await semPreco(L);ok(!sp.rs&&!sp.nomes.length&&!sp.el,'P2: escolha sem preço, pacote nem pagamento: '+JSON.stringify(sp));
// marcar e desmarcar
await L.click('#lj-lb .lj-lbnav.prev');await L.waitForTimeout(80);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
ok(await L.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code).ch.length)===0,'✓ de novo desmarca');
await L.click('#lj-lb [data-act="kiosk-no"]');await L.waitForTimeout(80);
ok(await L.evaluate(()=>{const k=ETERNA.state.kiosk;const it=ETERNA.lojaItems(k.code)[0];return ETERNA.lojaPick(k.code)[it.k]==='no';}),'✗ marca "não quero"');
// deslizar no toque
const v0=await L.evaluate(()=>ETERNA.state.kiosk.ver);
await L.evaluate(()=>{const el=document.querySelector('#lj-lb .lj-lbmid');const t=(x)=>new Touch({identifier:1,target:el,clientX:x,clientY:400});el.dispatchEvent(new TouchEvent('touchstart',{touches:[t(800)],changedTouches:[t(800)],bubbles:true}));el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[t(500)],bubbles:true}));});
await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.kiosk.ver)===v0+1,'deslizar para a esquerda vai para a próxima');
// idioma pelo overlay
await L.click('#lj-lb [data-act="lang"][data-l="en"]');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.lang)==='en'&&/See all/.test(await L.evaluate(()=>document.querySelector('#lj-lb [data-act="kiosk-fechar"]').getAttribute('aria-label'))),'bandeira no overlay troca o idioma (Ver todas em inglês)');
await L.click('#lj-lb [data-act="lang"][data-l="pt"]');
await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(150);sp=await semPreco(L);ok(!sp.rs&&!sp.nomes.length&&!sp.el,'P2: Ver todas sem preço: '+JSON.stringify(sp));await L.click('[data-act="kiosk-ver"][data-i="1"]');await L.waitForTimeout(100);
// 1366×768: área da foto
await L.setViewportSize({width:1366,height:768});await L.waitForTimeout(250);a=await ar(L);ok(a&&(a.h>=.9*a.H||a.w>=.9*a.W),'1366×768: a foto ocupa a tela: '+JSON.stringify(a));
await shot(L,'v96-escolha-1366.png');await L.setViewportSize({width:1920,height:1080});

// ---- P2 a P4: Continuar → Pronto → caixa escolhe o pacote → cliente vê o valor ao vivo → miniaturas → confirmar → QR
await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
ok(await L.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code).ch.length)===2,'duas fotos marcadas');await L.click('#lj-lb .lj-cartpill');await L.waitForTimeout(500);
let st=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,p:ETERNA.state.kiosk.paid,txt:document.querySelector('.lj').innerText.replace(/\s+/g,' ')}));
ok(st.step==='done'&&st.p&&st.p.escolha&&st.p.wait&&st.p.total==null&&/Pronto!/i.test(st.txt)&&/atendente vai finalizar sua compra/.test(st.txt)&&st.txt.includes(st.p.codigo)&&/2 fotos escolhidas/.test(st.txt),'P2: "Pronto! O atendente vai finalizar sua compra", código e 2 fotos: '+JSON.stringify(st).slice(0,300));
ok(!/vá ao caixa|no caixa/i.test(st.txt),'P2: nunca manda o cliente ao caixa');
sp=await semPreco(L);ok(!sp.rs&&!sp.nomes.length&&!sp.el,'P2: Pronto sem preço, pacote nem pagamento: '+JSON.stringify(sp));
await shot(L,'v96-pronto.png');
const id1=await pend();
let rec=await L.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id),id1);
ok(rec&&rec.estado==='aguardando'&&rec.total==null&&rec.meio==null&&rec.escolha&&rec.n===2&&(rec.selected.length+rec.aiSel.length)===2&&!rec.cart.length,'P2: pendência no Posto com as fotos e sem valor: '+JSON.stringify(rec).slice(0,240));
ok(await L.evaluate(id=>!JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').some(e=>e.venda===id),id1),'P2: nada vai ao servidor antes do caixa confirmar');
// Posto (1366×768): fotos escolhidas, pacotes e meios
await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await V.waitForTimeout(400);
const pv=await V.evaluate(id=>{const it=document.querySelector(`[data-pend="${id}"]`);return it?{ths:it.querySelectorAll('.pend-th').length,pkgs:[...it.querySelectorAll('[data-act="pend-pkg"]')].map(b=>b.dataset.p),meios:[...it.querySelectorAll('[data-act="pend-meio"]')].map(b=>b.dataset.m),conf:!!it.querySelector('[data-act="pend-pos"],[data-act="din-confirm"]')}:null;},id1);
ok(pv&&pv.ths===2&&pv.pkgs.length===6&&pv.meios.join()==='cartao,pix,dinheiro'&&!pv.conf,'P3: Posto mostra as 2 fotos, os 6 pacotes e os 3 meios, sem confirmar antes da escolha: '+JSON.stringify(pv));
const ideal=await V.evaluate(()=>ETERNA.lojaIdeal(2).pkg);
await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="${ideal}"]`);await V.waitForTimeout(400);
await V.locator(`[data-pend="${id1}"]`).scrollIntoViewIfNeeded();await shot(V,'v96-posto.png');
const esperado=await L.evaluate(p=>ETERNA.vendaCalc(2,2,p),ideal);
for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.total!=null))break;await sleep(100);}
st=await L.evaluate(()=>document.querySelector('.lj').innerText.replace(/\s+/g,' '));
ok(st.replace(/ /g,' ').includes('R$ '+esperado.total),'P4: cliente vê o valor do pacote: '+st.slice(0,200));
ok(/Valor a pagar/.test(st)&&/Pague na maquininha/.test(st)&&/Ver minhas fotos/.test(st),'P4: "Valor a pagar", "Pague na maquininha" e "Ver minhas fotos": '+st.slice(0,200));
await shot(L,'v96-valor.png');
// troca ao vivo
await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="mais"]`);await V.waitForTimeout(200);
for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pkg==='mais'))break;await sleep(100);}
const mais=await L.evaluate(()=>ETERNA.vendaCalc(2,2,'mais').total);st=await L.evaluate(()=>document.querySelector('.lj').innerText);
ok(/Maracanã Mais/i.test(st)&&st.includes(String(mais)),'P4: o caixa troca o pacote e a tela do cliente atualiza ao vivo: '+st.replace(/\s+/g,' ').slice(0,120));
await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="${ideal}"]`);await V.waitForTimeout(300);
for(const [l,t] of [['en',/Amount to pay/],['es',/Importe a pagar/],['fr',/Montant à payer/],['de',/Zu zahlen/],['pt',/Valor a pagar/]]){await L.click(`[data-act="lang"][data-l="${l}"]`);await L.waitForTimeout(60);const tx=await L.evaluate(()=>document.querySelector('.lj').innerText);ok(t.test(tx)&&!/—/.test(tx),'P4: valor em '+l+' (sem travessão)');}
// miniaturas
await L.click('[data-act="kiosk-minhas"]');await L.waitForTimeout(300);
ok(await L.evaluate(()=>document.querySelectorAll('.lj-minhas .lj-mth').length)===2,'P4: "Ver minhas fotos" mostra as 2 escolhidas');await shot(L,'v96-miniaturas.png');
await L.click('.lj-minhas [data-act="kiosk-minhas-i"][data-i="0"]');await L.waitForTimeout(150);ok(!!(await L.$('.lj-minhas .lj-mbig')),'P4: toque amplia');
await L.click('[data-act="kiosk-minhas-x"]');await L.waitForTimeout(100);ok(await L.evaluate(()=>document.querySelectorAll('.lj-minhas .lj-mth').length)===2,'P4: fechar a ampliada volta à grade');
await L.click('[data-act="kiosk-minhas-x"]');await L.waitForTimeout(100);ok(!(await L.$('.lj-minhas')),'P4: fechar volta ao valor');
// confirmar → QR
await V.click(`[data-pend="${id1}"] [data-act="pend-meio"][data-m="pix"]`);await V.waitForTimeout(200);
await V.click(`[data-pend="${id1}"] [data-act="pend-pos"]`);await V.waitForTimeout(100);await V.click(`[data-act="pend-pos-ok"][data-id="${id1}"]`);
for(let i=0;i<30;i++){if(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img')))break;await sleep(100);}
ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='done'&&!ETERNA.state.kiosk.paid.wait&&!!document.querySelector('#lqr canvas,#lqr img')),'P4: confirmado no Posto, o cliente vai para a tela final com QR');
// cancelamento volta ao início
await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(60);await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const id2=await pend();
await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(200);await V.click(`[data-pend="${id2}"] [data-act="din-cancel"]`);await V.waitForTimeout(100);await V.click(`[data-act="din-cancel-ok"][data-id="${id2}"]`);
for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}
ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'&&!!document.querySelector('[data-act="kiosk-start"]')),'P4: cancelado pelo caixa, o cliente volta ao início');

// ---- P6: a venda registrada sai igual à de antes (app da v94) para a mesma escolha, pacote e meio
const venda=async(pg,vend,antigo)=>{const card=cards[2];await pg.goto(pg.url().split('#')[0]+'#loja');await pg.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');localStorage.removeItem('eterna.ponto.fila.v1');});await pg.reload();await pg.waitForTimeout(800);
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(700);
  for(let i=0;i<3;i++){await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(60);}
  const pkg='maracana';
  if(antigo){await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(300);await pg.click(`[data-act="loja-pkg"][data-id="${pkg}"]`);await pg.click('[data-act="loja-paym"][data-m="pix"]');await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(600);}
  else{await pg.click('#lj-lb .lj-next');await pg.waitForTimeout(600);}
  const id=await pg.evaluate(()=>ETERNA.state.kiosk.paid.pend);
  await vend.evaluate(([id,pkg,antigo])=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();if(!antigo){ETERNA.pendEscolher(id,{pkg});ETERNA.pendEscolher(id,{meio:'pix'});}return ETERNA.pendConfirmar(id,{ref:'123456'});},[id,pkg,antigo]);await pg.waitForTimeout(500);
  return pg.evaluate(([id,card])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);const s=S.sessions[card];const fila=JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').filter(e=>e.venda===id);
    const tira=(o,ks)=>{o=JSON.parse(JSON.stringify(o||{}));ks.forEach(k=>delete o[k]);return o;};
    return {rec:tira(r,['id','criada','fechada','token','codigo','t0','escolha','pkg','nSes','lang','pvCriado','saleNo']),saleNo:String(r.saleNo).replace(/\d+$/,''),
      ses:tira(s,['paidAt','caixaEm','vendaId','galVenda','pick','pag','impressao','din','saleNo']),pag:tira(s.pag,['em']),
      evs:fila.map(e=>({tipo:e.tipo,seq:e.seq,por:e.por,dados:tira(e.dados,['saleNo','galeria','t0'])})),criarAntesDoPagar:fila.length===2&&fila[0].tipo==='criar'&&Date.parse(fila[0].em)<=Date.parse(fila[1].em)};},[id,card]);};
// app da v94 servido de uma pasta temporária (outra origem: outro localStorage)
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v94-'));fs.writeFileSync(path.join(dir,'index.html'),execFileSync('git',['show','b92ea0c:index.html'],{cwd:RAIZ,maxBuffer:64*1024*1024}));
for(const d of ['img','sprites','vendor'])fs.symlinkSync(path.join(RAIZ,d),path.join(dir,d));
const pv94=await portaLivre();velho={p:spawn('python3',['-m','http.server',String(pv94),'--bind','127.0.0.1'],{cwd:dir,stdio:'ignore'}),dir};await sleep(800);
const U94=`http://127.0.0.1:${pv94}/index.html`;
const ctx94=await b.newContext({locale:'pt-BR'});const L94=await nova(ctx94,'v94 checkout',{width:1920,height:1080});await L94.goto(U94+'#loja');
const V94=await nova(ctx94,'v94 posto',{width:1366,height:768});const uAnt=process.env.U;process.env.U=U94;await login(V94);process.env.U=uAnt;await V94.evaluate(()=>localStorage.removeItem('eterna.session'));
const antes=await venda(L94,V94,true);
const L2=await nova(ctx,'checkout 2',{width:1920,height:1080});await L2.goto(U+'#loja');
const agora=await venda(L2,V,false);
const dif=(x,y,p='')=>{const out=[];const ks=new Set([...Object.keys(x||{}),...Object.keys(y||{})]);for(const q of ks){const a1=x?x[q]:undefined,b1=y?y[q]:undefined;if(a1&&b1&&typeof a1==='object'&&typeof b1==='object')out.push(...dif(a1,b1,p+q+'.'));else if(JSON.stringify(a1)!==JSON.stringify(b1))out.push(p+q+': '+JSON.stringify(a1)+' ≠ '+JSON.stringify(b1));}return out;};
const d1=dif(antes,agora);ok(!d1.length,'P6: venda igual à da v94 (registro, sessão, eventos criar e pagar): '+d1.slice(0,8).join(' | '));
ok(agora.criarAntesDoPagar&&agora.evs[0].por.nome===null,'P6: "criar" com a hora do pedido e sem autor, antes do "pagar": '+JSON.stringify(agora.evs.map(e=>[e.tipo,e.por])));
await ctx94.close();await L2.close();

// ---- N7 e P5: cada tamanho × etapa
let ci=3;
for(const [w,h] of TAMANHOS){await L.setViewportSize({width:w,height:h});const card=cards[ci++%cards.length];
  await L.goto(U+'#loja');await L.waitForTimeout(250);await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.waitForTimeout(150);
  await confere(L,'camera',w,h);
  await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(500);await confere(L,'camera ligada',w,h);
  await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(80);await confere(L,'codigo',w,h);
  await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(600);
  if(await L.evaluate(()=>ETERNA.state.kiosk.step)!=='review'){ok(false,`${w}×${h}: código não abriu`);continue;}
  await confere(L,'escolha',w,h);
  if(w===1536&&h===730)await shot(L,'v96-escolha-1536x730.png');
  if(w===390)await shot(L,'v96-escolha-390.png');
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await confere(L,'escolha marcada',w,h);
  if(w<=1100){const lg=await L.$('#lj-lb [data-act="lj-lg"]');ok(!!lg&&await lg.isVisible(),`${w}: bandeiras recolhidas no botão de idioma`);if(lg){await lg.click();await L.waitForTimeout(80);await confere(L,'idiomas abertos',w,h);await L.click('#lj-lb [data-act="lang"][data-l="de"]');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.lang)==='de',`${w}: botão de idioma abre as bandeiras`);await L.click('#lj-lb [data-act="lj-lg"]');await L.click('#lj-lb [data-act="lang"][data-l="pt"]');}}
  await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(150);await confere(L,'todas',w,h);
  await L.click('.lj-next');await L.waitForTimeout(500);await confere(L,'pronto',w,h);
  const id=await pend();await posto(id,{pkg:await L.evaluate(()=>ETERNA.lojaIdeal(2).pkg)});await posto(id,{meio:'pix'});
  for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.total!=null))break;await sleep(100);}
  await confere(L,'valor',w,h);await L.screenshot({path:`${PR}/v96-valor-${w}x${h}.png`});
  await L.click('[data-act="kiosk-minhas"]');await L.waitForTimeout(250);await confere(L,'minhas',w,h);await L.click('[data-act="kiosk-minhas-x"]');
  await confirma(id);await confere(L,'final',w,h);await L.screenshot({path:`${PR}/v96-final-${w}x${h}.png`});
  const tok=await L.evaluate(()=>(ETERNA.state.kiosk.paid||{}).token||null);
  if(tok){const G=await nova(ctx,'galeria',{width:w,height:h});await G.goto(U+'#g/'+tok);await G.waitForTimeout(700);await confere(G,'galeria',w,h);await G.close();}
  else tabela[w+'×'+h].galeria='sem token';
}
const etapas=['camera','camera ligada','codigo','escolha','escolha marcada','todas','pronto','valor','minhas','final','galeria'];
console.log('tamanho | '+etapas.join(' | '));for(const t of Object.keys(tabela))console.log(t+' | '+etapas.map(e=>tabela[t][e]||'-').join(' | '));
}catch(e){fails.push('exceção: '+String(e.message||e).split('\n').slice(0,3).join(' / '));}
finally{await b.close().catch(()=>{});if(velho){try{velho.p.kill('SIGTERM');}catch(e){}try{fs.rmSync(velho.dir,{recursive:true,force:true});}catch(e){}}}
const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} checkout-tela-cheia: ${n} verificações (tela cheia, Iniciar, sem preço no Checkout, caixa escolhe o pacote, venda igual à v94, 10 tamanhos)${fails.length?' · '+fails.slice(0,14).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})();
