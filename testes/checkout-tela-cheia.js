// v95 (Eduardo, 09/11): na escolha do Checkout a foto ocupa a tela inteira, com overlay discreto (setas, ✓, ✗, logo, contador,
// idioma, início, carrinho, Ver todas, Continuar). Em todas as etapas e na galeria: sem rolagem horizontal e nenhum botão fora da tela.
const {chromium}=require('playwright');const fs=require('fs');const login=require('./_login');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const SHOTS=process.env.SHOTS||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TAMANHOS=[[1280,720],[1366,768],[1440,900],[1536,864],[1600,900],[1920,1080],[1366,657],[1536,730],[1920,969],[390,844]];
const UMA_TELA={camera:1,codigo:1,escolha:1,espera:1,final:1};
(async()=>{const b=await chromium.launch();const errs=[];const fails=[];let n=0;
const ok=(c,m)=>{n++;if(!c)fails.push(m);};
const ctx=await b.newContext({locale:'pt-BR'});
const nova=async(nome,vp)=>{const pg=await ctx.newPage();await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;};
// medição: rolagem do documento, rolagem interna visível, botões fora da tela
const medir=(pg,umaTela)=>pg.evaluate(umaTela=>{const W=innerWidth,H=innerHeight,d=document.documentElement;
  const vis=e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0;};
  const rolaY=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1)return p;}return null;};
  const root=document.querySelector('.lj,.gq')||document.body;const fora=[];
  root.querySelectorAll('button,a,input,.lj-langs').forEach(e=>{if(!vis(e))return;const r=e.getBoundingClientRect();const nome=(e.className||e.tagName)+':'+(e.dataset.act||'')+':'+(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,18);
    if(r.left<-1||r.right>W+1)fora.push(nome+' x '+Math.round(r.left)+'..'+Math.round(r.right));
    else if(!rolaY(e)&&(r.top<-1||r.bottom>H+1))fora.push(nome+' y '+Math.round(r.top)+'..'+Math.round(r.bottom));});
  const rolam=[];if(umaTela)root.querySelectorAll('*').forEach(e=>{const s=getComputedStyle(e);if(/auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1&&vis(e))rolam.push((e.className||e.tagName)+' '+e.scrollHeight+'>'+e.clientHeight);});
  const docY=d.scrollHeight>H+1||document.body.scrollHeight>H+1;
  return {sw:d.scrollWidth,W,H,semX:d.scrollWidth<=W&&document.body.scrollWidth<=W,docY,fora,rolam};},umaTela);
const tabela={};
const confere=async(pg,etapa,w,h)=>{const m=await medir(pg,!!UMA_TELA[etapa]);const prob=[];if(!m.semX)prob.push('rolagem horizontal '+m.sw+'>'+m.W);if(m.fora.length)prob.push('fora: '+m.fora.slice(0,4).join(' | '));
  if(UMA_TELA[etapa]&&(m.docY||m.rolam.length))prob.push('rolagem vertical '+(m.rolam.slice(0,2).join(' | ')||'documento'));
  (tabela[w+'×'+h]=tabela[w+'×'+h]||{})[etapa]=prob.length?'FALHA':'ok';ok(!prob.length,`${w}×${h} ${etapa}: `+prob.join(' · '));return m;};
const ar=async pg=>pg.evaluate(()=>{const i=document.querySelector('#lj-lb .lj-lbimg');if(!i)return null;const r=i.getBoundingClientRect();return {w:r.width,h:r.height,top:r.top,left:r.left,H:innerHeight,W:innerWidth};});

const L=await nova('checkout',{width:1920,height:1080});await L.goto(U+'#loja');await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8).map(s=>s.card));
const V=await nova('vendedor',{width:1280,height:900});await login(V);await V.evaluate(()=>localStorage.removeItem('eterna.session'));
const abrir=async card=>{await L.goto(U+'#loja');await L.waitForTimeout(300);await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);};

// ---- 1. escolha em tela cheia (1920×1080): área da foto, só os controles previstos, teclado, marcar e desmarcar
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
await L.screenshot({path:`${PR}/v95-escolha-1920.png`});if(SHOTS)await L.screenshot({path:`${SHOTS}/v95-escolha-1920.png`});
// teclado: → ← Enter
await L.keyboard.press('ArrowRight');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.kiosk.ver)===1,'→ vai para a próxima');
await L.keyboard.press('ArrowLeft');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.kiosk.ver)===0,'← volta');
await L.keyboard.press('Enter');await L.waitForTimeout(120);
let k=await L.evaluate(()=>{const k=ETERNA.state.kiosk;return {ver:k.ver,n:ETERNA.lojaCart(k.code).ch.length};});ok(k.ver===1&&k.n===1,'Enter marca ✓ e passa para a próxima: '+JSON.stringify(k));
ok(!!(await L.$('#lj-lb .lj-next')),'com foto marcada aparece o Continuar');
const cont=await L.evaluate(()=>{const e=document.querySelector('#lj-lb .lj-next');const r=e.getBoundingClientRect();return {t:e.innerText.replace(/\s+/g,' ').trim(),r:r.toJSON(),W:innerWidth,H:innerHeight};});
ok(/Continuar · 1 foto/.test(cont.t)&&cont.r.right>cont.W*.7&&cont.r.bottom>cont.H*.85,'"Continuar · N fotos" discreto no canto inferior direito: '+JSON.stringify(cont));
// marcar e desmarcar pelo clique
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
// 1366×768: área da foto
await L.setViewportSize({width:1366,height:768});await L.waitForTimeout(250);a=await ar(L);ok(a&&a.h>=.9*a.H||a&&a.w>=.9*a.W,'1366×768: a foto ocupa a tela: '+JSON.stringify(a));
await L.screenshot({path:`${PR}/v95-escolha-1366.png`});if(SHOTS)await L.screenshot({path:`${SHOTS}/v95-escolha-1366.png`});
// carrinho e pagamento seguem funcionando
await L.setViewportSize({width:1920,height:1080});await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);
await L.click('#lj-lb [data-act="loja-cart"].lj-cartpill');await L.waitForTimeout(200);ok(await L.evaluate(()=>ETERNA.state.kiosk.step)==='cart','o carrinho do overlay abre o pagamento');
await L.click('[data-act="kiosk-review"]');await L.waitForTimeout(150);await L.click('#lj-lb .lj-next');await L.waitForTimeout(200);
await L.click('[data-act="loja-paym"][data-m="pix"]');await L.waitForTimeout(100);await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(400);
let r=await L.evaluate(c=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const p=(S.caixaDin||[]).find(x=>x.card===c&&x.estado==='aguardando')||{};return {step:ETERNA.state.kiosk.step,wait:!!(ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.wait),meio:p.meio,sel:(S.sessions[c].selected||[]).length};},cards[0]);
ok(r.step==='done'&&r.wait&&r.meio==='pix'&&r.sel===2,'pagamento PIX aguardando a maquininha com 2 fotos: '+JSON.stringify(r));

// ---- 2. cada tamanho × etapa
let ci=1;
for(const [w,h] of TAMANHOS){await L.setViewportSize({width:w,height:h});const card=cards[ci++%cards.length];
  await L.goto(U+'#loja');await L.waitForTimeout(250);await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.waitForTimeout(150);
  await confere(L,'camera',w,h);
  await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(80);await confere(L,'codigo',w,h);
  await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(600);
  if(await L.evaluate(()=>ETERNA.state.kiosk.step)!=='review'){ok(false,`${w}×${h}: código não abriu`);continue;}
  await confere(L,'escolha',w,h);
  if(w===1536&&h===730){await L.screenshot({path:`${PR}/v95-escolha-1536x730.png`});if(SHOTS)await L.screenshot({path:`${SHOTS}/v95-escolha-1536x730.png`});}
  if(w===390){await L.screenshot({path:`${PR}/v95-escolha-390.png`});if(SHOTS)await L.screenshot({path:`${SHOTS}/v95-escolha-390.png`});}
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(80);await confere(L,'escolha marcada',w,h);
  if(w===390){const lg=await L.$('#lj-lb [data-act="lj-lg"]');if(lg){await lg.click();await L.waitForTimeout(80);await confere(L,'idiomas abertos',w,h);await L.click('#lj-lb [data-act="lang"][data-l="de"]');await L.waitForTimeout(80);ok(await L.evaluate(()=>ETERNA.state.lang)==='de','390: botão de idioma abre as bandeiras');await L.click('#lj-lb [data-act="lj-lg"]');await L.click('#lj-lb [data-act="lang"][data-l="pt"]');}}
  await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(150);await confere(L,'todas',w,h);
  await L.click('.lj-next');await L.waitForTimeout(200);await L.click('[data-act="loja-paym"][data-m="pix"]');await L.waitForTimeout(100);await confere(L,'pagamento',w,h);
  await L.screenshot({path:`${PR}/v95-pagamento-${w}x${h}.png`});
  await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(400);await confere(L,'espera',w,h);
  const id=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.state.view='posto';ETERNA.render();return ETERNA.pendConfirmar(id,{ref:''});},id);
  for(let i=0;i<30;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&!ETERNA.state.kiosk.paid.wait))break;await sleep(100);}await L.waitForTimeout(500);
  await confere(L,'final',w,h);await L.screenshot({path:`${PR}/v95-final-${w}x${h}.png`});
  const tok=await L.evaluate(()=>(ETERNA.state.kiosk.paid||{}).token||null);
  if(tok){const G=await nova('galeria',{width:w,height:h});await G.goto(U+'#g/'+tok);await G.waitForTimeout(700);await confere(G,'galeria',w,h);await G.close();}
  else tabela[w+'×'+h].galeria='sem token';
}
await b.close();
const etapas=['camera','codigo','escolha','escolha marcada','todas','pagamento','espera','final','galeria'];
console.log('tamanho | '+etapas.join(' | '));for(const t of Object.keys(tabela))console.log(t+' | '+etapas.map(e=>tabela[t][e]||'-').join(' | '));
const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} checkout-tela-cheia: ${n} verificações${fails.length?' · '+fails.slice(0,12).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okk?0:1);})().catch(e=>{console.log('FALHA checkout-tela-cheia: '+e.message);process.exit(1);});
