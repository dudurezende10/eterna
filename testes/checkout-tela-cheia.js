// v96 (Eduardo, 09/11): Checkout do balcão.
// N1 a N7: na escolha a foto ocupa a tela inteira, com overlay discreto; em todas as etapas e na galeria nada rola de lado nem sai da tela.
// P1: a câmera só liga no Iniciar e desliga fora da etapa dela (e depois de um tempo sem rosto).
// P2 a P4: o Checkout não mostra pacote, preço nem forma de pagamento; o caixa escolhe no Posto de venda e o cliente vê o valor ao vivo.
// P5: alvos de toque de 72 px no Checkout. P6: a venda registrada sai igual à de antes (compara com o app da v94, b92ea0c), numa matriz de
// pacotes, meios e fotos com fundo de IA. Revisão: contador do carrinho sem ação (6), tela do valor (7), "Voltar às fotos" (8), janela antiga
// (1), segurança S1 (teto da câmera, prazo só com rosto, busca com tempo), S2 (tela parada volta ao início) e VAL_CALMO.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const os=require('os');const net=require('net');const {execFileSync,spawn}=require('child_process');
const login=require('./_login');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const RAIZ=path.join(__dirname,'..');const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const SHOTS=process.env.SHOTS||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TAMANHOS=[[1280,720],[1366,768],[1440,900],[1536,864],[1600,900],[1920,1080],[1366,657],[1536,730],[1920,969],[390,844]];
const UMA_TELA={camera:1,'camera ligada':1,codigo:1,escolha:1,'escolha marcada':1,pronto:1,valor:1,minhas:1,final:1};
const shot=async(pg,nome)=>{await pg.screenshot({path:`${PR}/${nome}`});if(SHOTS)await pg.screenshot({path:`${SHOTS}/${nome}`});};
// portas de teste a partir de 30000 (as mais baixas são de outras frentes)
const portaUsada=p=>new Promise(r=>{const s=net.createServer();s.once('error',()=>r(true));s.listen(p,'127.0.0.1',()=>s.close(()=>r(false)));});
const portaLivre=async()=>{for(let p=30000+Math.floor(Math.random()*400);p<31000;p++)if(!(await portaUsada(p)))return p;throw new Error('sem porta livre');};
const servePasta=async dir=>{const p=await portaLivre();const sv={p:spawn('python3',['-m','http.server',String(p),'--bind','127.0.0.1'],{cwd:dir,stdio:'ignore'}),dir,porta:p};servidores.push(sv);await sleep(800);return sv;};
const servidores=[];
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const errs=[];const fails=[];let n=0;let velho=null;
let ult="";const ok=(c,m)=>{n++;ult=String(m).slice(0,90);if(!c)fails.push(m);};
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
const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8).map(s=>s.card));const cardS5=cards.pop();
// sessões com 10 fotos do campo e 4 fundos de IA (modo Photoroom, como no v79), para a matriz do P6
const cardsIA=await L.evaluate(()=>{const S=ETERNA.SIM;const m0=S.fundosModo;S.fundosModo='photoroom';const r=ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=10&&ETERNA.lojaItems(s.card).filter(x=>x.t==='ai').length>=4).map(s=>s.card);S.fundosModo=m0;return r;});
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
// S1: só rosto renova o prazo (movimento não); teto absoluto desde o Iniciar, mesmo com busca em andamento
await L.evaluate(()=>ETERNA.lojaCamMs(1200));await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(300);
await L.evaluate(()=>{ETERNA.state.cam.lastTry=Date.now();});await L.waitForTimeout(400);await L.evaluate(()=>{ETERNA.state.cam.lastTry=Date.now();}); // busca por movimento (camTick → camFound)
await L.waitForTimeout(800);c=await cam();ok(!c.stream&&!c.on,'S1: movimento não renova o prazo da câmera: '+JSON.stringify(c));
await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(700);await L.evaluate(()=>{ETERNA.state.kiosk.camRosto=Date.now();});await L.waitForTimeout(800);c=await cam();ok(c.stream&&c.on,'S1: rosto visto renova o prazo: '+JSON.stringify(c));
await L.waitForTimeout(1300);c=await cam();ok(!c.stream&&!c.on,'S1: sem rosto de novo, desliga: '+JSON.stringify(c));
await L.evaluate(()=>{ETERNA.lojaCamMs(60000);ETERNA.lojaCamTeto(1500);});await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(300);await L.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.state.kiosk.camRosto=Date.now();});
await L.waitForTimeout(1700);c=await cam();ok(!c.stream&&!c.on&&c.ini,'S1: teto absoluto desliga mesmo com a busca em andamento: '+JSON.stringify(c));await L.evaluate(()=>{ETERNA.lojaCamTeto(180000);ETERNA.state.cam.busy=false;});
// S1: a busca no agente desiste sozinha (AbortController)
{const r=await L.evaluate(async()=>{const f0=window.fetch;const a0=ETERNA.state.agent;let abortou=false;window.fetch=(u,o)=>new Promise((res,rej)=>{if(o&&o.signal)o.signal.addEventListener('abort',()=>{abortou=true;rej(new DOMException('abort','AbortError'));});});
  ETERNA.state.agent=Object.assign({},a0,{on:true,url:'http://127.0.0.1:1',rostos:{ligado:true}});ETERNA.faceBuscaMs(300);const t0=Date.now();const v=await ETERNA.faceAgente([document.createElement('canvas')],false);const ms=Date.now()-t0;
  window.fetch=f0;ETERNA.state.agent=a0;ETERNA.faceBuscaMs(9000);return {v,ms,abortou};});ok(r.v===null&&r.abortou&&r.ms<2000,'S1: /rostos/buscar com tempo máximo: '+JSON.stringify(r));}
// VAL_CALMO: sem câmera, a validação de IA do navegador espera 1 min parado na tela inicial
{const r=await L.evaluate(async()=>{const k=ETERNA.state.kiosk;const corre=ms=>Promise.race([ETERNA.valLivre().then(()=>true),new Promise(r=>setTimeout(()=>r(false),ms))]);
  ETERNA.lojaReset();ETERNA.render();k.codeDesde=Date.now();const a=await corre(400);k.codeDesde=Date.now()-61000;const b=await corre(400);k.codeDesde=0;const c=await corre(300);return {a,b,c};});
  ok(!r.a&&r.b&&!r.c,'VAL_CALMO: balcão livre só depois de 1 min na tela inicial sem câmera (k.codeDesde): '+JSON.stringify(r));}
await L.click('[data-act="kiosk-start"]');await L.waitForTimeout(400);await L.evaluate(c=>{const k=ETERNA.state.kiosk;k.code=c;k.step='gallery';ETERNA.render();},cards[0]);await L.waitForTimeout(200);
c=await cam();ok(!c.stream&&c.step==='review','P1: achou a sessão, a câmera desliga: '+JSON.stringify(c));
await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(200);c=await cam();ok(!c.stream&&c.ini,'P1: voltar ao início pelo Sair: '+JSON.stringify(c));

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
const previstos=new Set(['loja-logo','kiosk-ver','kiosk-ok','kiosk-no','lang','lj-lg','kiosk-sair','loja-cart','kiosk-fechar']);
const extras=ctl.acts.filter(x=>!previstos.has(x.split(':')[0]));ok(!extras.length,'só os controles previstos na escolha: '+extras.join(','));
ok(ctl.prev&&ctl.next&&ctl.prev.width>=72&&ctl.prev.height>=72&&ctl.next.width>=72&&ctl.prev.left<ctl.W*.15&&ctl.next.right>ctl.W*.85,'setas ‹ › nas laterais com alvo ≥ 72 px: '+JSON.stringify({p:ctl.prev,n:ctl.next}));
ok(ctl.yes&&ctl.no&&Math.abs((ctl.yes.left+ctl.yes.right)/2-ctl.W/2)<ctl.W*.08&&ctl.yes.bottom>ctl.H*.8&&ctl.yes.width>=80&&/255, 184, 0/.test(ctl.yesBg)&&Math.abs((ctl.no.top+ctl.no.bottom)/2-(ctl.yes.top+ctl.yes.bottom)/2)<20,'✓ amarelo grande no centro embaixo, ✗ ao lado: '+JSON.stringify({y:ctl.yes,n:ctl.no,bg:ctl.yesBg}));
ok(ctl.logo&&ctl.logo.op<=.7&&ctl.logo.r.height<=48&&(ctl.logo.r.left<ctl.W*.2||ctl.logo.r.right>ctl.W*.8),'logo pequeno e discreto num canto: '+JSON.stringify(ctl.logo));
ok(/^\s*1 \/ \d+\s*$/.test(ctl.cnt)&&ctl.cntFs<=16,'contador pequeno "1 / N": '+ctl.cnt+' '+ctl.cntFs);
ok(/^rgb\((10|11|12|13), (2\d|3\d|4\d|5\d|6\d), (5\d|6\d|7\d)/.test(ctl.fundo),'fundo azul escuro da marca: '+ctl.fundo);
ok(!(await L.$('#lj-lb .lj-next')),'sem foto marcada, sem botão Continuar');
await shot(L,'v96-escolha-1920.png');
// Sair (Eduardo, 10/11): botão com texto, legível, no canto do overlay, fora do ✓ ✗ e das setas
{const sb=await L.evaluate(()=>{const e=document.querySelector('#lj-lb [data-act="kiosk-sair"]');if(!e)return null;const r=e.getBoundingClientRect();const s=getComputedStyle(e);const no=document.querySelector('#lj-lb .lj-lbbar').getBoundingClientRect();
  return {t:e.innerText.trim(),fs:parseFloat(s.fontSize),op:+s.opacity,w:r.width,h:r.height,top:r.top,right:r.right,W:innerWidth,H:innerHeight,longeDoOk:r.bottom<no.top};});
  ok(sb&&sb.t==='Sair'&&sb.fs>=15&&sb.op>=.9&&sb.h>=72&&sb.top<sb.H*.15&&sb.right>sb.W*.6&&sb.longeDoOk,'Sair: botão com texto, legível, no canto de cima: '+JSON.stringify(sb));}
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
ok(await L.evaluate(()=>{const e=document.querySelector('#lj-lb .lj-langs');return !e||getComputedStyle(e).display==='none';})&&await L.isVisible('#lj-lb [data-act="lj-lg"]'),'6: no overlay as bandeiras ficam recolhidas na atual');
await L.click('#lj-lb [data-act="lj-lg"]');await L.waitForTimeout(60);await L.click('#lj-lb [data-act="lang"][data-l="en"]');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.lang)==='en'&&/See all/.test(await L.evaluate(()=>document.querySelector('#lj-lb [data-act="kiosk-fechar"]').getAttribute('aria-label'))),'bandeira no overlay troca o idioma (Ver todas em inglês)');
await L.click('#lj-lb [data-act="lj-lg"]');await L.waitForTimeout(60);await L.click('#lj-lb [data-act="lang"][data-l="pt"]');
await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(150);sp=await semPreco(L);ok(!sp.rs&&!sp.nomes.length&&!sp.el,'P2: Ver todas sem preço: '+JSON.stringify(sp));await L.click('[data-act="kiosk-ver"][data-i="1"]');await L.waitForTimeout(100);
// 1366×768: área da foto
await L.setViewportSize({width:1366,height:768});await L.waitForTimeout(250);a=await ar(L);ok(a&&(a.h>=.9*a.H||a.w>=.9*a.W),'1366×768: a foto ocupa a tela: '+JSON.stringify(a));
await shot(L,'v96-escolha-1366.png');await L.setViewportSize({width:1920,height:1080});

// ---- P2 a P4: Continuar → Pronto → caixa escolhe o pacote → cliente vê o valor ao vivo → miniaturas → confirmar → QR
await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
ok(await L.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code).ch.length)===2,'duas fotos marcadas');
// 6: o contador do carrinho não é botão e não finaliza; só um "Continuar"
const pill=await L.evaluate(()=>{const e=document.querySelector('#lj-lb .lj-cartpill');return e?{tag:e.tagName,act:e.dataset.act||null,pe:getComputedStyle(e).pointerEvents,t:e.innerText.trim()}:null;});
ok(pill&&pill.tag==='SPAN'&&!pill.act&&pill.pe==='none'&&pill.t==='2','6: contador do carrinho só mostra o número, sem ação: '+JSON.stringify(pill));
ok(await L.evaluate(()=>document.querySelectorAll('.lj [data-act="loja-cart"],.lj [data-act="kiosk-done"]').length)===1,'6: um único Continuar na escolha');
await L.evaluate(()=>{const e=document.querySelector('#lj-lb .lj-cartpill');e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await L.waitForTimeout(150);ok(await L.evaluate(()=>ETERNA.state.kiosk.step)==='review','6: tocar no contador não faz o pedido');
ok(await L.evaluate(()=>{const c=document.querySelector('#lj-lb .lj-ovtr');const r=c.getBoundingClientRect();const lb=document.querySelector('#lj-lb [data-act="kiosk-fechar"]');return r.width<=420&&r.height<=80&&!lb.innerText.trim();}),'6: idioma, início, contador e Ver todas pequenos no canto (Ver todas só com o ícone)');
await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);
let st=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,p:ETERNA.state.kiosk.paid,txt:document.querySelector('.lj').innerText.replace(/\s+/g,' ')}));
ok(st.step==='done'&&st.p&&st.p.escolha&&st.p.wait&&st.p.total==null&&/Pronto!/i.test(st.txt)&&/atendente vai finalizar sua compra/.test(st.txt)&&st.txt.includes(st.p.codigo)&&/2 fotos escolhidas/.test(st.txt),'P2: "Pronto! O atendente vai finalizar sua compra", código e 2 fotos: '+JSON.stringify(st).slice(0,300));
ok(!/vá ao caixa|no caixa/i.test(st.txt),'P2: nunca manda o cliente ao caixa');
sp=await semPreco(L);ok(!sp.rs&&!sp.nomes.length&&!sp.el,'P2: Pronto sem preço, pacote nem pagamento: '+JSON.stringify(sp));
await shot(L,'v96-pronto.png');
const id1=await pend();
let rec=await L.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id),id1);
ok(rec&&rec.estado==='escolha'&&rec.total==null&&rec.meio==null&&rec.escolha&&rec.n===2&&(rec.selected.length+rec.aiSel.length)===2&&!rec.cart.length,'P2: pendência no Posto com as fotos e sem valor: '+JSON.stringify(rec).slice(0,240));
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
ok(/Valor a pagar/.test(st)&&/O atendente vai informar a forma de pagamento/.test(st)&&/Ver minhas fotos/.test(st)&&/2 fotos/.test(st),'P4/7: "Valor a pagar", "2 fotos", "O atendente vai informar a forma de pagamento" e "Ver minhas fotos": '+st.slice(0,200));
const nomes=await L.evaluate(()=>{const t=document.querySelector('.lj').innerText;return ['Pacote','Maracanã','Gramado','Zona Mista','Arquibancada','Tribuna','adicional','R$ 35','Seu código','Voltar às fotos'].filter(x=>t.includes(x));});
ok(!nomes.length,'7: a tela do valor não mostra nome de pacote, preço unitário, código nem outros botões: '+nomes.join(','));
ok(await L.evaluate(()=>[...document.querySelectorAll('.lj-heroin button')].map(b=>b.dataset.act).join())==='kiosk-minhas','7: na tela do valor o único botão do meio é "Ver minhas fotos"');
for(const [m,t] of [['cartao',/Pague na maquininha/],['pix',/Pague com PIX na maquininha/],['dinheiro',/Pague em dinheiro ao atendente/]]){await posto(id1,{meio:m});
  for(let i=0;i<20;i++){if(await L.evaluate(m=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.meio===m,m))break;await sleep(100);}ok(t.test(await L.evaluate(()=>document.querySelector('.lj').innerText)),'7: frase do pagamento em '+m);}
await posto(id1,{meio:'cartao'});await sleep(400);
await shot(L,'v96-valor.png');
// troca ao vivo
await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="mais"]`);await V.waitForTimeout(200);
for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pkg==='mais'))break;await sleep(100);}
const mais=await L.evaluate(()=>ETERNA.vendaCalc(2,2,'mais').total);st=await L.evaluate(()=>document.querySelector('.lj').innerText);
ok(!/Maracanã Mais/i.test(st)&&st.includes(String(mais)),'P4: o caixa troca o pacote e a tela do cliente atualiza ao vivo (só o valor): '+st.replace(/\s+/g,' ').slice(0,120));
const aud=await V.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='venda_escolha').slice(0,2).map(e=>({por:e.por,m:e.mudancas})));
ok(aud.length===2&&aud[0].por&&aud[0].m.some(c=>c.campo==='pacote'&&c.para==='Pacote Maracanã Mais')&&aud[0].m.some(c=>c.campo==='valor'&&c.para===mais),'S5: a troca de pacote vai ao registro de auditoria (quem, pacote, valor): '+JSON.stringify(aud[0]));
await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="${ideal}"]`);await V.waitForTimeout(300);
for(const [l,t,f] of [['en',/Amount to pay/,/2 photos/],['es',/Importe a pagar/,/2 fotos/],['fr',/Montant à payer/,/2 photos/],['de',/Zu zahlen/,/2 Fotos/],['pt',/Valor a pagar/,/2 fotos/]]){await L.click(`[data-act="lang"][data-l="${l}"]`);await L.waitForTimeout(60);const tx=await L.evaluate(()=>document.querySelector('.lj').innerText);ok(t.test(tx)&&f.test(tx)&&!/—|ljPay|nPhotos/.test(tx),'P4/7: valor e "N fotos" em '+l+' (sem travessão)');}
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
// revisão (10/11): a tela final do QR mostra o valor confirmado no Posto
{const q=await L.evaluate(id=>{const r=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);return {pago:(document.querySelector('.lj-pago')||{}).innerText||'',tot:r.total};},id1);
  const m=/Valor pago R\$\s?([\d.]+(?:,\d+)?)/.exec(q.pago);const v=m?Number(m[1].replace(/\./g,'').replace(',','.')):null;
  ok(q.tot>0&&v===q.tot,'revisão: tela final do QR com o valor confirmado: '+JSON.stringify(q));await shot(L,'v96-qr-final.png');}
// 8: "Voltar às fotos" na tela Pronto: reabre a escolha da mesma sessão com o que estava marcado e tira o pedido do Posto (o caixa vê o aviso)
await abrir(cards[1]);for(let i=0;i<2;i++){await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(60);}await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idV=await pend();
await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await V.waitForTimeout(300);
ok(await L.isVisible('[data-act="kiosk-voltar-fotos"]'),'8: "Voltar às fotos" na tela Pronto');
await L.click('[data-act="kiosk-voltar-fotos"]');await L.waitForTimeout(300);
let vf=await L.evaluate(id=>{const k=ETERNA.state.kiosk;const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {step:k.step,ver:k.ver,lb:!!document.querySelector('#lj-lb'),n:ETERNA.lojaCart(k.code).ch.length,est:r.estado,mot:r.motivo,st:ETERNA.SIM.sessions[k.code].status};},idV);
ok(vf.step==='review'&&vf.lb&&vf.n===2&&vf.est==='substituida'&&vf.mot==='cliente_voltou'&&vf.st!=='aguardando','8: volta à foto ampliada com as 2 marcadas e o pedido sai do Posto: '+JSON.stringify(vf));
for(let i=0;i<20;i++){if(await V.evaluate(id=>!document.querySelector(`[data-pend="${id}"]`),idV))break;await sleep(100);}
const avV=await V.evaluate(id=>({item:!!document.querySelector(`[data-pend="${id}"]`),av:(document.querySelector('.pend-avisos')||{}).innerText||''}),idV);
ok(!avV.item&&/voltou às fotos/.test(avV.av),'8: o caixa vê que o cliente voltou: '+JSON.stringify(avV));
ok(await L.evaluate(id=>!JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').some(e=>e.venda===id),idV),'8: nada foi ao servidor pelo pedido retirado');
await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idV2=await pend();ok(idV2&&idV2!==idV&&await L.evaluate(()=>ETERNA.state.kiosk.paid.n===2),'8: Continuar de novo faz um pedido novo com as mesmas fotos');
// S2: tela Pronto/valor parada: volta ao início e o Posto vê "o cliente saiu"; a pendência fica para o caixa decidir
await L.evaluate(()=>{ETERNA.lojaProntoMs(400);ETERNA.state.kiosk.toque=0;});await sleep(500);await L.evaluate(()=>ETERNA.lojaProntoOcioso());await L.waitForTimeout(200);
let s2=await L.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {step:ETERNA.state.kiosk.step,ini:!!document.querySelector('[data-act="kiosk-start"]'),est:r.estado,saiu:!!r.saiu};},idV2);
ok(s2.step==='code'&&s2.ini&&s2.est==='escolha'&&s2.saiu,'S2: sem toque, volta ao início e a pendência continua, marcada "o cliente saiu": '+JSON.stringify(s2));
for(let i=0;i<20;i++){if(await V.evaluate(id=>!!document.querySelector(`[data-pend="${id}"] .pend-saiu`),idV2))break;await sleep(100);}
ok(await V.evaluate(id=>/saiu da tela/.test((document.querySelector(`[data-pend="${id}"] .pend-saiu`)||{}).innerText||'')&&/saiu da tela do Checkout/.test((document.querySelector('.pend-avisos')||{}).innerText||''),idV2),'S2: o Posto mostra "o cliente saiu"');
await L.evaluate(()=>ETERNA.lojaProntoMs(180000));
// toque conta como presença
await abrir(cards[1]);await L.evaluate(()=>{ETERNA.lojaProntoMs(600);});await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(450);const idV3=await pend();
await L.evaluate(()=>{const k=ETERNA.state.kiosk;k.prontoDesde=Date.now()-5000;k.toque=0;});await L.keyboard.press('Shift');await L.evaluate(()=>ETERNA.lojaProntoOcioso());ok(await L.evaluate(()=>ETERNA.state.kiosk.step)==='done','S2: com toque recente a tela Pronto fica');await L.evaluate(()=>ETERNA.lojaProntoMs(180000));
await V.evaluate(ids=>{ETERNA.simFresh();ids.forEach(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(r&&r.estado==='escolha')ETERNA.dinCancelar(id);});},[idV2,idV3]);await L.waitForTimeout(300);
// S4: pedido com fotos que não batem com o número é recusado
await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(450);const idS4=await pend();
await L.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);r.n=5;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},idS4);
const s4=await V.evaluate(id=>{ETERNA.simFresh();const ok=ETERNA.pendEscolher(id,{pkg:'maracana'});const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {ok,total:r.total};},idS4);
ok(!s4.ok&&s4.total==null,'S4: n diferente das fotos do pedido é recusado: '+JSON.stringify(s4));
await V.evaluate(id=>{ETERNA.simFresh();ETERNA.dinCancelar(id);},idS4);await L.waitForTimeout(300);
// S5: o preço muda no Catálogo entre a escolha e a confirmação: a confirmação recalcula e pede para confirmar de novo (sessão própria: ela fica paga)
await abrir(cardS5);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(450);const idS5=await pend();
await posto(idS5,{pkg:'arq'});await posto(idS5,{meio:'dinheiro'});
const s5=await V.evaluate(id=>{ETERNA.simFresh();ETERNA.SIM.prices.arq=80;ETERNA.SIM.caixaDin.find(x=>x.id===id);localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));const a=ETERNA.pendConfirmar(id,{});const r1=ETERNA.SIM.caixaDin.find(x=>x.id===id);const t1=r1.total,e1=r1.estado;const b=ETERNA.pendConfirmar(id,{});const r2=ETERNA.SIM.caixaDin.find(x=>x.id===id);const s=ETERNA.SIM.sessions[r2.card];delete ETERNA.SIM.prices.arq;localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));return {a,t1,e1,b,e2:r2.estado,tot:s.total};},idS5);
ok(!s5.a&&s5.t1===80&&s5.e1==='escolha'&&s5.b&&s5.e2==='confirmada'&&s5.tot===80,'S5: confirmação recalcula o valor pelo Catálogo: '+JSON.stringify(s5));
await L.waitForTimeout(500);
// cancelamento volta ao início
await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(60);await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const id2=await pend();
await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(200);await V.click(`[data-pend="${id2}"] [data-act="din-cancel"]`);await V.waitForTimeout(100);await V.click(`[data-act="din-cancel-ok"][data-id="${id2}"]`);
for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}
ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'&&!!document.querySelector('[data-act="kiosk-start"]')),'P4: cancelado pelo caixa, o cliente volta ao início');
//@@REVISAO2
// R3: "Voltar ao início" na tela Pronto e na do valor marca "o cliente saiu" (a compra continua no Posto, que avisa)
{const saiu=async(id,sel)=>{await L.click(sel);await L.waitForTimeout(300);
    const s=await L.evaluate(id=>{const r=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);return {step:ETERNA.state.kiosk.step,est:r.estado,saiu:!!r.saiu};},id);
    for(let i=0;i<20;i++){if(await V.evaluate(id=>!!document.querySelector(`[data-pend="${id}"] .pend-saiu`),id))break;await sleep(100);}
    s.posto=await V.evaluate(id=>/saiu da tela/.test((document.querySelector(`[data-pend="${id}"] .pend-saiu`)||{}).innerText||'')&&/saiu da tela do Checkout/.test((document.querySelector('.pend-avisos')||{}).innerText||''),id);return s;};
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});
  await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idP=await pend();
  let s=await saiu(idP,'.lj-pronto .lj-restart[data-act="loja-new"]');ok(s.step==='code'&&s.est==='escolha'&&s.saiu&&s.posto,'R3: "Voltar ao início" na tela Pronto marca "o cliente saiu" e o Posto avisa: '+JSON.stringify(s));
  await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idQ=await pend();await posto(idQ,{pkg:'arq'});
  for(let i=0;i<20;i++){if(await L.evaluate(()=>!!document.querySelector('.lj-temvalor')))break;await sleep(100);}
  s=await saiu(idQ,'.lj-temvalor [data-act="loja-new"]');ok(s.step==='code'&&s.est==='escolha'&&s.saiu&&s.posto,'R3: o início na tela do valor também marca "o cliente saiu": '+JSON.stringify(s));
  await V.evaluate(ids=>{ETERNA.simFresh();ids.forEach(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(r&&r.estado==='escolha')ETERNA.dinCancelar(id);});},[idP,idQ]);await L.waitForTimeout(300);}
// R1: o caixa escolhe o meio antes do pacote. Nada de "R$ 0" nem "Dinheiro": o pedido segue "Escolha do pacote pendente", sem valor e fora das somas
{await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idR=await pend();
  await posto(idR,{meio:'dinheiro'});await L.waitForTimeout(300);
  const r1=await V.evaluate(id=>{ETERNA.simFresh();const S=ETERNA.SIM;const r=S.caixaDin.find(x=>x.id===id);
    r.vendedor={email:ETERNA.state.user.email,nome:ETERNA.state.user.name}; // só na memória: Minhas vendas (e, abaixo, o alerta de atraso)
    ETERNA.state.view='posto';ETERNA.render();const it=document.querySelector(`[data-pend="${id}"]`);const item=it?it.innerText:'';const mv=(document.querySelector('#minhas-vendas')||{}).innerText||'';
    const row=ETERNA.allSales().find(x=>x.no===id)||{};const csv=ETERNA.salesCSV([row]).split('\n')[1]||'';
    const cr=r.criada;r.criada=new Date(Date.now()-20*60e3).toISOString();const al=ETERNA.alerts().filter(a=>a.t.includes(r.codigo)).map(a=>a.t+' '+a.d).join(' | ');r.criada=cr;
    ETERNA.state.view='vendas-lista';ETERNA.render();const lista=document.querySelector('#main').innerText;const linhaLista=[...document.querySelectorAll('#main tr')].map(t=>t.innerText).find(t=>t.includes(r.card))||'';
    ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();
    return {item,mv,pay:row.pay,total:row.total,csv,al,linhaLista};},idR);
  const zero=t=>/R\$\s?0(,00)?\b/.test(t);
  ok(!zero(r1.item)&&!/Recebi/.test(r1.item)&&/sem valor/.test(r1.item),'R1: no Posto, meio antes do pacote fica sem valor e sem "Recebi": '+r1.item.replace(/\s+/g,' ').slice(0,160));
  ok(r1.pay==='Escolha do pacote pendente'&&r1.total==null&&!/Dinheiro/.test(r1.csv)&&/;"";/.test(r1.csv),'R1: Lista e CSV com "Escolha do pacote pendente" e sem valor: '+JSON.stringify({pay:r1.pay,total:r1.total,csv:r1.csv.slice(0,200)}));
  ok(/escolha do pacote/.test(r1.al)&&!/Dinheiro esperando/.test(r1.al)&&!zero(r1.al),'R1: Alertas falam da escolha do pacote, sem "R$ 0": '+r1.al);
  ok(/Escolha do pacote pendente/.test(r1.mv)&&!zero(r1.mv),'R1: Minhas vendas sem "R$ 0": '+r1.mv.replace(/\s+/g,' ').slice(0,200));
  ok(!r1.linhaLista||(!zero(r1.linhaLista)&&!/Dinheiro/.test(r1.linhaLista)),'R1: linha da Lista de vendas sem "Dinheiro R$ 0": '+r1.linhaLista.replace(/\s+/g,' ').slice(0,160));
  // logs: cancelar e virada do dia
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.dinCancelar(id);},idR);await L.waitForTimeout(300);
  const lc=await V.evaluate(()=>ETERNA.SIM.log[0].t);ok(/antes da escolha do pacote/.test(lc)&&!zero(lc),'R1: log do cancelamento sem "R$ 0": '+lc);
  await abrir(cards[1]);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idR2=await pend();await posto(idR2,{meio:'pix'});
  const lv=await V.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);r.criada=new Date(Date.now()-2*864e5).toISOString();ETERNA.dinVirada();const r2=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {t:ETERNA.SIM.log[0].t,est:r2.estado};},idR2);
  ok(lv.est==='nao_paga'&&/sem pacote escolhido/.test(lv.t)&&!zero(lv.t),'R1: log da virada do dia sem "R$ 0": '+JSON.stringify(lv));
  for(let i=0;i<20;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}}
// B2: marca velha de outra pessoa da mesma sessão não entra no pedido. A marca e sai; B abre por selfie, marca 1 e continua: pedido só com a foto de B
{const cB=cards[1];await abrir(cB);const todas=await L.evaluate(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').map(x=>x.id),cB);
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
  ok(await L.evaluate(c=>Object.keys(ETERNA.lojaPick(c)).length,cB)===2,'B2: A marcou 2');
  await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(100);ok(await L.isVisible('.lj-ask [data-act="kiosk-sair-sim"]'),'B2: Sair com fotos marcadas pede confirmação');
  await L.click('.lj-ask [data-act="kiosk-sair-sim"]');await L.waitForTimeout(200);
  const lim=await L.evaluate(c=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c]||{};return {pk:Object.keys(s.pick||{}).length,sel:(s.selected||[]).length};},cB);
  ok(lim.pk===0&&lim.sel===0,'B2: voltar ao início sem pedido limpa as marcas da sessão: '+JSON.stringify(lim));
  // marcas que sobraram de outra janela (fechada no meio da escolha): fotos que B não vê
  const velhas=todas.slice(0,2),deB=todas.slice(4,6);
  await L.evaluate(([c,v])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[c]=S.sessions[c]||{};s.pick={[v[0]]:'ok',[v[1]]:'fav'};s.selected=v.slice();s.fav=[v[1]];localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();},[cB,velhas]);
  ok(await L.evaluate(c=>Object.keys(ETERNA.lojaPick(c)).length,cB)===2&&!(await L.evaluate(()=>ETERNA.state.kiosk.code)),'B2: marcas velhas na sessão antes da selfie de B');
  await L.evaluate(([c,ids])=>ETERNA.lojaAbrirSo({[c]:ids},c),[cB,deB]);
  await L.waitForTimeout(500);
  const ab=await L.evaluate(c=>({step:ETERNA.state.kiosk.step,itens:ETERNA.lojaItems(c).filter(x=>x.t==='ph').map(x=>x.id),pk:Object.keys(ETERNA.lojaPick(c))}),cB);
  ok(ab.step==='review'&&ab.itens.join()===deB.join()&&!ab.pk.length,'B2: abrir por selfie limpa as marcas velhas e mostra só as fotos de B: '+JSON.stringify(ab));
  // mesmo que uma marca velha reapareça (outra janela gravou), ela fica fora do pedido
  await L.evaluate(([c,v])=>{const pk=ETERNA.lojaPick(c);pk[v[0]]='ok';pk[v[1]]='fav';},[cB,velhas]);
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
  const ses=await L.evaluate(c=>ETERNA.SIM.sessions[c].selected.slice(),cB);ok(ses.join()===deB[0],'B2: lojaSync ignora marca de foto que o cliente não vê: '+ses.join());
  await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idB2=await pend();
  const rB=await L.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id),idB2);
  ok(rB&&rB.n===1&&rB.selected.join()===deB[0]&&!rB.aiSel.length&&!(rB.fav||[]).length,'B2: pedido n:1 só com a foto de B: '+JSON.stringify(rB&&{n:rB.n,sel:rB.selected,fav:rB.fav}));
  await posto(idB2,{pkg:'arq'});await posto(idB2,{meio:'dinheiro'});await confirma(idB2);
  const fim=await L.evaluate(([id,c])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);return {est:r.estado,sel:S.sessions[c].selected,st:S.sessions[c].status};},[idB2,cB]);
  ok(fim.est==='confirmada'&&fim.st==='paga'&&fim.sel.join()===deB[0],'B2: o Posto confirma e a venda fica só com a foto de B: '+JSON.stringify(fim));}
// B2 (revisão 3): escolher a sessão entre as candidatas da câmera (cam-pick) também limpa as marcas velhas
{const cP=cards[6]||cards[4];await L.goto(U+'#loja');await L.waitForTimeout(200);await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});
  const ids=await L.evaluate(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').map(x=>x.id),cP);
  await L.evaluate(([c,v])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[c]=S.sessions[c]||{};s.pick={[v[0]]:'ok'};s.selected=[v[0]];localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();},[cP,ids]);
  const r=await L.evaluate(([c,v])=>{const E=ETERNA;E.state.cam.cands=[{card:c,fotos:v}];const b=document.createElement('button');b.dataset.act='cam-pick';b.dataset.card=c;document.querySelector('.lj').appendChild(b);b.click();
    const s=JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c]||{};return {step:E.state.kiosk.step,code:E.state.kiosk.code,pk:Object.keys(E.lojaPick(c)).length,gr:Object.keys(s.pick||{}).length,sel:(s.selected||[]).length};},[cP,ids]);
  ok(r.code===cP&&r.pk===0&&r.gr===0&&r.sel===0,'B2: cam-pick limpa as marcas velhas antes de abrir a sessão: '+JSON.stringify(r));
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});}

// revisão (10/11): "Voltar às fotos" inativo quando o caixa já escolheu o meio (ou o pacote); escolha parada não volta ao início (A3 cancelado);
// a câmera descarta o resultado de uma busca que começou com outra câmera (k.camOn falso ou outro Iniciar)
{const cR=cards[3]||cards[2];await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idT=await pend();
  ok(!(await L.isDisabled('[data-act="kiosk-voltar-fotos"]')),'revisão: "Voltar às fotos" ativo enquanto o caixa não mexeu');
  await posto(idT,{meio:'pix'});for(let i=0;i<30;i++){if(await L.evaluate(()=>!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.meio)))break;await sleep(100);}
  const vt=await L.evaluate(id=>{const b=document.querySelector('[data-act="kiosk-voltar-fotos"]');const tx=(document.querySelector('.lj-tarde')||{}).innerText||'';const dis=!b&&/finalizando/.test(tx);ETERNA.lojaVoltarFotos();const r=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);
    return {dis,step:ETERNA.state.kiosk.step,est:r.estado,meio:r.meio,toast:document.querySelector('#toast').textContent};},idT);
  ok(vt.dis&&vt.step==='done'&&vt.est==='escolha'&&vt.meio==='pix'&&/finalizando/.test(vt.toast),'revisão: com o meio escolhido no Posto, "Voltar às fotos" dá lugar ao aviso "O atendente já está finalizando sua compra" e o pedido fica com o caixa: '+JSON.stringify(vt));
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.dinCancelar(id);},idT);for(let i=0;i<30;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'))break;await sleep(100);}
  // Eduardo (10/11): escolha parada 90 s sem toque volta ao Iniciar e apaga as marcas (substitui o "A3 cancelado" de 27/10); toque renova
  await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(100);
  const ocio=async grade=>{if(grade){await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(100);}return L.evaluate(c=>{const E=ETERNA,k=E.state.kiosk;const r={};
    k.toque=0;k.escolhaDesde=Date.now()-89000;r.a89=E.lojaEscolhaOciosa();
    k.escolhaDesde=Date.now()-91000;document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));r.toque=E.lojaEscolhaOciosa();r.step1=k.step;
    k.toque=0;document.dispatchEvent(new TouchEvent('touchmove',{bubbles:true}));r.arrasto=E.lojaEscolhaOciosa();
    k.toque=0;k.prontoDesde=0;r.pronto=E.lojaProntoOcioso();
    k.toque=Date.now()-91000;k.escolhaDesde=Date.now()-120000;r.b=E.lojaEscolhaOciosa();r.step=k.step;r.code=k.code;r.foto=!!document.querySelector('#lj-lb,.lj-grid,.lj-gcard');
    const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[c]||{};r.pk=Object.keys(s.pick||{}).length;r.sel=(s.selected||[]).length;r.ini=!!document.querySelector('[data-act="kiosk-start"]');return r;},cR);};
  for(const grade of [false,true]){if(grade){await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(100);}const oc=await ocio(grade);
    ok(!oc.a89&&!oc.toque&&!oc.arrasto&&oc.step1==='review'&&!oc.pronto&&oc.b&&oc.step==='code'&&!oc.code&&!oc.foto&&oc.pk===0&&oc.sel===0&&oc.ini,`escolha${grade?' (Ver todas)':''} parada 90 s sem toque volta ao Iniciar sem foto na tela e apaga as marcas; toque e arrasto renovam: `+JSON.stringify(oc));}
  // Sair (Eduardo, 10/11): sem marca volta direto; com marca pede confirmação (Não continua, Sim apaga); em 5 línguas
  await abrir(cR);await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(150);ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'&&!ETERNA.state.kiosk.code&&!document.querySelector('.lj-ask')),'Sair sem foto marcada volta direto ao Iniciar');
  await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(150);
  {const tx=await L.evaluate(()=>(document.querySelector('.lj-ask')||{}).innerText||'');ok(/Sair e apagar as fotos marcadas\?/.test(tx)&&/Sim, sair/.test(tx)&&/Não, continuar escolhendo/.test(tx),'Sair com foto marcada pergunta antes: '+tx.replace(/\s+/g,' '));}
  await shot(L,'v96-sair-confirma.png');
  for(const [l,t] of [['en',/Exit and clear the photos you marked\?/],['es',/¿Salir y borrar las fotos marcadas\?/],['fr',/Quitter et effacer les photos choisies/],['de',/Beenden und die markierten Fotos löschen\?/],['pt',/Sair e apagar/]]){await L.evaluate(l=>{ETERNA.state.lang=l;ETERNA.render();},l);const tx=await L.evaluate(()=>document.querySelector('.lj').innerText);ok(t.test(tx)&&!/—|ljSair/.test(tx),'Sair: confirmação em '+l);}
  await L.click('.lj-ask [data-act="kiosk-sair-nao"]');await L.waitForTimeout(100);ok(await L.evaluate(c=>ETERNA.state.kiosk.step==='review'&&!document.querySelector('.lj-ask')&&ETERNA.lojaCart(c).ch.length===1,cR),'Sair: "Não" continua na escolha com as marcas');
  await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(100);await L.click('.lj-ask [data-act="kiosk-sair-sim"]');await L.waitForTimeout(150);
  ok(await L.evaluate(c=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c]||{};return ETERNA.state.kiosk.step==='code'&&!Object.keys(s.pick||{}).length&&!!document.querySelector('[data-act="kiosk-start"]');},cR),'Sair: "Sim" volta ao Iniciar e apaga as marcas');
  // com pedido aberto o prazo da escolha não vale e o Sair avisa o Posto ("o cliente saiu", lojaSaiu)
  await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idA=await pend();
  {const pa=await L.evaluate(id=>{const E=ETERNA,k=E.state.kiosk;k.step='review';k.ver=0;k.toque=0;k.escolhaDesde=Date.now()-300000;const r={ocio:E.lojaEscolhaOciosa(),step:k.step};
      E.lojaSairCli(true);const p=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);r.depois=k.step;r.est=p.estado;r.saiu=!!p.saiu;return r;},idA);
    ok(!pa.ocio&&pa.step==='review'&&pa.depois==='code'&&pa.est==='escolha'&&pa.saiu,'com pedido aberto o prazo da escolha não vale e o Sair marca "o cliente saiu": '+JSON.stringify(pa));}
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.dinCancelar(id);},idA);
  // Esc na tela Pronto também marca "o cliente saiu"
  await abrir(cR);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(500);const idE=await pend();
  await L.keyboard.press('Escape');await L.waitForTimeout(200);
  ok(await L.evaluate(id=>{const p=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id);return !!p.saiu&&p.estado==='escolha'&&ETERNA.state.kiosk.step==='code';},idE),'Esc na tela Pronto marca "o cliente saiu"');
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.dinCancelar(id);},idE);
  // câmera: busca começada com a câmera de um Iniciar anterior não abre sessão
  const cm=await L.evaluate(async()=>{const E=ETERNA,k=E.state.kiosk,c=E.state.cam;E.state.view='quiosque';E.lojaReset();const st=c.stream;c.stream=null;c.busy=false;
    k.step='code';k.camOn=true;k.camDesde=Date.now()-5000;E.camFound();k.camOn=false;k.camOn=true;k.camDesde=Date.now(); // desligou e outro Iniciar ligou
    await new Promise(r=>setTimeout(r,1300));const a={step:k.step,code:k.code};
    c.busy=false;E.camFound();await new Promise(r=>setTimeout(r,1300));const b={step:k.step,code:k.code};c.stream=st;k.camOn=false;E.lojaReset();E.render();return {a,b};});
  ok(cm.a.step==='code'&&!cm.a.code&&cm.b.step!=='code'&&cm.b.code,'revisão: a câmera descarta o resultado da busca de outro Iniciar (e aceita o da câmera atual): '+JSON.stringify(cm));}

if(!process.env.RAPIDO){
// ---- P6: a venda registrada sai igual à de antes (app da v94) para a mesma escolha, pacote e meio
// v96: matriz (o.nPh fotos do campo + o.nAI com fundo de IA, pacote o.pkg, meio o.meio). As fotos são marcadas do mesmo jeito nos dois apps
const venda=async(pg,vend,antigo,o)=>{const card=cardsIA[0];await pg.goto(pg.url().split('#')[0]+'#loja');await pg.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');localStorage.removeItem('eterna.ponto.fila.v1');});await pg.reload();await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ETERNA.SIM.fundosModo='photoroom';localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));});await pg.reload();await pg.waitForTimeout(700); // fundos de IA sem o recorte do agente (como no v79)
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(700);
  const m=await pg.evaluate(([card,nPh,nAI])=>{const it=ETERNA.lojaItems(card);const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);
    it.filter(x=>x.t==='ph').slice(0,nPh).forEach(x=>pk[x.k]='ok');it.filter(x=>x.t==='ai').slice(0,nAI).forEach(x=>pk[x.k]='ok');ETERNA.render();const c=ETERNA.lojaCart(card);return [c.nPh,c.nAI];},[card,o.nPh,o.nAI]);
  if(m[0]!==o.nPh||m[1]!==o.nAI)return {erro:'marcou '+JSON.stringify(m)};
  if(antigo){await pg.evaluate(()=>{ETERNA.state.kiosk.step='cart';ETERNA.render();});await pg.waitForTimeout(300);await pg.click(`[data-act="loja-pkg"][data-id="${o.pkg}"]`);await pg.click(`[data-act="loja-paym"][data-m="${{cartao:'card',pix:'pix',dinheiro:'cash'}[o.meio]}"]`);await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(600);}
  else{await pg.click('#lj-lb .lj-next');await pg.waitForTimeout(600);}
  const id=await pg.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);if(!id)return {erro:'sem pedido'};
  const conf=await vend.evaluate(([id,o,antigo])=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();if(!antigo){ETERNA.pendEscolher(id,{pkg:o.pkg});ETERNA.pendEscolher(id,{meio:o.meio});}return ETERNA.pendConfirmar(id,{ref:o.meio==='dinheiro'?'':'123456'});},[id,o,antigo]);await pg.waitForTimeout(500);
  if(!conf)return {erro:'não confirmou'};
  return pg.evaluate(([id,card])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);const s=S.sessions[card];const fila=JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').filter(e=>e.venda===id);
    const tira=(o,ks)=>{o=JSON.parse(JSON.stringify(o||{}));ks.forEach(k=>delete o[k]);return o;};
    return {rec:tira(r,['id','criada','fechada','token','codigo','t0','escolha','pkg','nSes','lang','pvCriado','saleNo']),saleNo:String(r.saleNo).replace(/\d+$/,''),
      ses:tira(s,['paidAt','caixaEm','vendaId','galVenda','pick','pag','impressao','din','saleNo']),pag:tira(s.pag,['em']),
      evs:fila.map(e=>({tipo:e.tipo,seq:e.seq,por:e.por,dados:tira(e.dados,['saleNo','galeria','t0'])})),criarAntesDoPagar:fila.length===2&&fila[0].tipo==='criar'&&Date.parse(fila[0].em)<=Date.parse(fila[1].em)};},[id,card]);};
// app da v94 servido de uma pasta temporária (outra origem: outro localStorage)
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v94-'));fs.writeFileSync(path.join(dir,'index.html'),execFileSync('git',['show','b92ea0c:index.html'],{cwd:RAIZ,maxBuffer:64*1024*1024}));
for(const d of ['img','sprites','vendor'])fs.symlinkSync(path.join(RAIZ,d),path.join(dir,d));
const pv94=(await servePasta(dir)).porta;
const U94=`http://127.0.0.1:${pv94}/index.html`;
const ctx94=await b.newContext({locale:'pt-BR'});const L94=await nova(ctx94,'v94 checkout',{width:1920,height:1080});await L94.goto(U94+'#loja');
const V94=await nova(ctx94,'v94 posto',{width:1366,height:768});const uAnt=process.env.U;process.env.U=U94;await login(V94);process.env.U=uAnt;await V94.evaluate(()=>localStorage.removeItem('eterna.session'));
const L2=await nova(ctx,'checkout 2',{width:1920,height:1080});await L2.goto(U+'#loja');
const dif=(x,y,p='')=>{const out=[];const ks=new Set([...Object.keys(x||{}),...Object.keys(y||{})]);for(const q of ks){const a1=x?x[q]:undefined,b1=y?y[q]:undefined;if(a1&&b1&&typeof a1==='object'&&typeof b1==='object')out.push(...dif(a1,b1,p+q+'.'));else if(JSON.stringify(a1)!==JSON.stringify(b1))out.push(p+q+': '+JSON.stringify(a1)+' ≠ '+JSON.stringify(b1));}return out;};
// matriz: fotos do campo + com fundo de IA, pacote e meio (Ideal, adicionais, Zona + 1, teto de impressas, Todas sem impressas, IA no pacote, Dinheiro)
const MATRIZ=[[3,0,'maracana','pix'],[4,4,'maracana','dinheiro'],[4,4,'gramado','cartao'],[4,0,'zona','pix'],[7,0,'tribuna','dinheiro'],[3,1,'mais','cartao'],[1,0,'arq','dinheiro'],[10,0,'tribuna','pix']];
for(const [nPh,nAI,pkg,meio] of MATRIZ){const tag=`${nPh}+${nAI} ${pkg} ${meio}`;
  const antes=await venda(L94,V94,true,{nPh,nAI,pkg,meio});const agora=await venda(L2,V,false,{nPh,nAI,pkg,meio});
  if(!antes||!agora||antes.erro||agora.erro){ok(false,`P6 ${tag}: não fez a venda: ${JSON.stringify({a:antes&&antes.erro,b:agora&&agora.erro})}`);continue;}
  const d1=dif(antes,agora);ok(!d1.length,`P6 ${tag}: venda igual à da v94 (registro, sessão, eventos criar e pagar): `+d1.slice(0,8).join(' | '));
  ok(agora.rec.n===nPh+nAI&&agora.rec.nAI===nAI&&agora.ses.status==='paga',`P6 ${tag}: registro com ${nPh+nAI} fotos (${nAI} com fundo de IA): `+JSON.stringify({n:agora.rec.n,nAI:agora.rec.nAI}));
  ok(agora.criarAntesDoPagar&&agora.evs[0].por.nome===null,`P6 ${tag}: "criar" com a hora do pedido e sem autor, antes do "pagar": `+JSON.stringify(agora.evs.map(e=>[e.tipo,e.por])));}
// 1 (janela antiga): o app da v94/v95 recusa um SIM gravado pela v96 (pedido sem pacote não vira "Dinheiro R$ 0" no Posto antigo)
{await L2.evaluate(()=>{localStorage.removeItem('eterna.sim.v1');});await L2.reload();await L2.waitForTimeout(600);await L2.click('[data-act="kiosk-emerg"]');await L2.fill('#kcode',cards[2]);await L2.click('[data-act="kiosk-go"]');await L2.waitForTimeout(600);
  await L2.click('#lj-lb [data-act="kiosk-ok"]');await L2.click('#lj-lb .lj-next');await L2.waitForTimeout(500);
  const novo=await L2.evaluate(()=>localStorage.getItem('eterna.sim.v1'));ok(JSON.parse(novo).catalogoV===3,'1: o SIM da v96 sai com a marca catalogoV 3');
  await V94.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});
  const j=await V94.evaluate(nv=>{const n0=(ETERNA.SIM.caixaDin||[]).length;window.dispatchEvent(new StorageEvent('storage',{key:'eterna.sim.v1',newValue:nv}));return {antiga:!!ETERNA.state.janelaAntiga,n:(ETERNA.SIM.caixaDin||[]).length===n0,txt:/R\$\s?0(,00)?\b/.test(document.querySelector('#main').innerText)};},novo);
  ok(j.antiga&&j.n&&!j.txt,'1: o Posto antigo (v94) não adota o SIM da v96 e cai no aviso de janela antiga: '+JSON.stringify(j));
  const k=await L2.evaluate(()=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));S.catalogoV=2;window.dispatchEvent(new StorageEvent('storage',{key:'eterna.sim.v1',newValue:JSON.stringify(S)}));return !!ETERNA.state.janelaAntiga;});
  ok(k,'1: a v96 também recusa o SIM gravado por uma janela antiga (catalogoV 2) e marca a janela antiga');}
await ctx94.close();await L2.close();
// B1: Posto da v95 aberto e não recarregado, na MESMA origem do Checkout da v96 (mesmo localStorage): o pedido sem pacote nasce em 'escolha',
// que a v95 não lista nem confirma (lá viraria "Recebi R$ 0" e entregaria as fotos). Defesa extra: confirmado sem o "criar" da v96 não libera o QR
{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v95-'));fs.copyFileSync(path.join(RAIZ,'index.html'),path.join(dir,'index.html'));
  fs.writeFileSync(path.join(dir,'v95.html'),execFileSync('git',['show','f4ac8df:index.html'],{cwd:RAIZ,maxBuffer:64*1024*1024}));
  for(const d of ['img','sprites','vendor'])fs.symlinkSync(path.join(RAIZ,d),path.join(dir,d));
  const sv=await servePasta(dir);const base=`http://127.0.0.1:${sv.porta}/`;const ctxM=await b.newContext({locale:'pt-BR'});
  const P95=await nova(ctxM,'v95 posto',{width:1366,height:768});const uAnt=process.env.U;process.env.U=base+'v95.html';await login(P95);process.env.U=uAnt;await P95.evaluate(()=>localStorage.removeItem('eterna.session'));
  await P95.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});
  const C=await nova(ctxM,'checkout mesma origem',{width:1920,height:1080});await C.goto(base+'index.html#loja');await C.waitForTimeout(700);
  const P96=await nova(ctxM,'posto v96 mesma origem',{width:1366,height:768});process.env.U=base+'index.html';await login(P96);process.env.U=uAnt;await P96.evaluate(()=>localStorage.removeItem('eterna.session'));await P96.evaluate(()=>ETERNA.go('posto'));
  await C.click('[data-act="kiosk-emerg"]');await C.fill('#kcode',cards[2]);await C.click('[data-act="kiosk-go"]');await C.waitForTimeout(700);
  await C.click('#lj-lb [data-act="kiosk-ok"]');await C.click('#lj-lb .lj-next');await C.waitForTimeout(600);const idB=await C.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
  const lido=()=>C.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);return {est:r&&r.estado,st:r&&S.sessions[r.card].status,cv:S.catalogoV};},idB);
  ok(idB&&(await lido()).est==='escolha','B1: o pedido do Checkout sem pacote nasce em "escolha": '+JSON.stringify(await lido()));
  const p95=await P95.evaluate(id=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();const lista=!!document.querySelector(`[data-pend="${id}"]`);const txt=document.querySelector('#main').innerText;
    const a=ETERNA.dinConfirmar(id);const b2=ETERNA.pendConfirmar(id,{ref:''});ETERNA.render();const rs=/Recebi R\$\s?0/.test(document.querySelector('#main').innerText);
    return {lista,recebi:/Recebi R\$\s?0|R\$\s?0,00/.test(txt)||rs,a:a||false,b:b2||false};},idB);
  const dep=await lido();
  ok(!p95.lista&&!p95.recebi&&!p95.a&&!p95.b&&dep.est==='escolha'&&dep.st!=='paga','B1: o Posto da v95 não lista nem confirma o pedido em "escolha" (nada de "Recebi R$ 0"): '+JSON.stringify({p95,dep}));
  // o Posto da v96 na mesma origem lista e escolhe normalmente
  const p96=await P96.evaluate(id=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();return !!document.querySelector(`[data-pend="${id}"] [data-act="pend-pkg"]`);},idB);ok(p96,'B1: o Posto da v96 lista o pedido em "escolha" com os pacotes');
  // defesa extra: uma janela antiga grava o pedido como confirmado (sem pvCriado). O Checkout não libera o QR; o Posto mostra alerta grave e janela antiga
  await P95.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);Object.assign(r,{estado:'confirmada',fechada:new Date().toISOString(),meio:'dinheiro'});S.sessions[r.card].status='paga';localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},idB);
  await C.waitForTimeout(600);await C.evaluate(()=>{ETERNA.lojaPendCheck();ETERNA.render();});
  const cq=await C.evaluate(()=>({wait:!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.wait),qr:!!document.querySelector('#lqr'),step:ETERNA.state.kiosk.step}));
  ok(cq.wait&&!cq.qr,'B1: confirmado por janela antiga, o Checkout não libera o QR: '+JSON.stringify(cq));
  await P96.waitForTimeout(300);const pg=await P96.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();return {antiga:!!ETERNA.state.janelaAntiga,grave:((document.querySelector('.pend-grave')||{}).innerText||''),al:ETERNA.alerts().some(a=>a.sev==='bad'&&/janela antiga/.test(a.t)&&/confirmado/.test(a.t))};});
  ok(pg.antiga&&/janela antiga/.test(pg.grave)&&/O QR não foi mostrado ao cliente/.test(pg.grave)&&pg.al,'B1: o Posto da v96 mostra o alerta grave e a janela antiga: '+JSON.stringify(pg));
  // simFresh também percebe (Posto que relê sem evento storage)
  ok(await P96.evaluate(()=>{ETERNA.state.janelaAntiga=0;ETERNA.simFresh();return !!ETERNA.state.janelaAntiga;}),'B1: simFresh marca a janela antiga ao achar o pedido confirmado sem o "criar"');
  // revisão 3: o mesmo pedido confirmado por janela antiga ontem não liga o aviso nem o alerta hoje (simFresh, evento storage, Alertas, Posto)
  {const y=await P96.evaluate(()=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const ontem=new Date(Date.now()-864e5).toISOString();S.caixaDin.filter(r=>r.escolha&&r.estado==='confirmada'&&!r.pvCriado).forEach(r=>{r.fechada=ontem;r.criada=ontem;});const nv=JSON.stringify(S);localStorage.setItem('eterna.sim.v1',nv);
      ETERNA.state.janelaAntiga=0;ETERNA.simFresh();const a=!!ETERNA.state.janelaAntiga;ETERNA.state.janelaAntiga=0;window.dispatchEvent(new StorageEvent('storage',{key:'eterna.sim.v1',newValue:nv}));const b=!!ETERNA.state.janelaAntiga;
      const al=ETERNA.alerts().some(x=>/janela antiga/.test(x.t));ETERNA.state.view='posto';ETERNA.render();return {a,b,al,grave:!!document.querySelector('.pend-grave')};});
    ok(!y.a&&!y.b&&!y.al&&!y.grave,'revisão 3: pedido de ontem confirmado por janela antiga não liga o alerta hoje: '+JSON.stringify(y));}
  await ctxM.close();}

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
  ok(await L.evaluate(()=>{const e=document.querySelector('#lj-lb [data-act="kiosk-sair"]');if(!e)return false;const r=e.getBoundingClientRect();return e.innerText.trim()==='Sair'&&r.right<=innerWidth&&r.top>=0;}),`${w}×${h}: botão Sair com texto à vista na escolha`);
  if(w===1536&&h===730)await shot(L,'v96-escolha-1536x730.png');
  if(w===390)await shot(L,'v96-escolha-390.png');
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await confere(L,'escolha marcada',w,h);
  {const lg=await L.$('#lj-lb [data-act="lj-lg"]');ok(!!lg&&await lg.isVisible(),`${w}: bandeiras recolhidas no botão de idioma`);if(lg){await lg.click();await L.waitForTimeout(80);await confere(L,'idiomas abertos',w,h);await L.click('#lj-lb [data-act="lang"][data-l="de"]');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.lang)==='de',`${w}: botão de idioma abre as bandeiras`);await L.click('#lj-lb [data-act="lj-lg"]');await L.click('#lj-lb [data-act="lang"][data-l="pt"]');}}
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
} // RAPIDO=1 pula a matriz da v94, a mesma origem com a v95 e os 10 tamanhos (só para iterar; a suíte roda tudo)
}catch(e){fails.push('exceção (depois de: '+ult+'): '+String(e.message||e).split('\n').slice(0,3).join(' / '));}
finally{await b.close().catch(()=>{});for(const sv of servidores){try{sv.p.kill('SIGTERM');}catch(e){}try{fs.rmSync(sv.dir,{recursive:true,force:true});}catch(e){}}}
const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} checkout-tela-cheia: ${n} verificações (tela cheia, Iniciar, sem preço no Checkout, caixa escolhe o pacote, venda igual à v94 em ${8} combinações, janela antiga, revisão 6 a 8, S1 a S5, 10 tamanhos)${fails.length?' · '+fails.slice(0,14).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})();
