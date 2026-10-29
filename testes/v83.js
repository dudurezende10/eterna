// v83 etapa 1 (um notebook, sem agente): pagamento aguardando (14 a 20), venda acompanhada (21 e 22), impressão 10×15 (23 a 26),
// Minhas vendas de hoje (34), fila local de eventos, alertas locais e foto com fundo de IA impressa com o fundo de 5000 px.
// O "agente" aqui é só o page.route do Playwright na própria origem (/file/, /thumb/, /photoroom/*): nenhuma rede de verdade.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// imagens de teste (geradas aqui; não são fotos de ninguém): deitada 1500×1000, em pé 1000×1500, recorte transparente 5000×3333 e 2400×1600
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v83-'));
execFileSync('python3',['-c',`
from PIL import Image,ImageDraw
import sys
d=sys.argv[1]
Image.new('RGB',(1500,1000),(40,120,200)).save(d+'/land.jpg',quality=80)
Image.new('RGB',(1000,1500),(200,120,40)).save(d+'/port.jpg',quality=80)
for w,h,n in ((5000,3333,'hi'),(2400,1600,'lo')):
  im=Image.new('RGBA',(w,h),(0,0,0,0));ImageDraw.Draw(im).rectangle([w*.4,h*.4,w*.6,h],fill=(250,30,30,255));im.save(d+'/rec-'+n+'.png',optimize=True)
Image.new('RGB',(5000,3333),(20,160,60)).save(d+'/opaca.png',optimize=True)
`,TMP]);
const IMG={land:fs.readFileSync(TMP+'/land.jpg'),port:fs.readFileSync(TMP+'/port.jpg'),hi:fs.readFileSync(TMP+'/rec-hi.png'),lo:fs.readFileSync(TMP+'/rec-lo.png'),op:fs.readFileSync(TMP+'/opaca.png')};
const composeLog=[];let composeFalha=false,composeOpaca=false;
async function rotas(ctx){
  await ctx.route(ORIG+'/file/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:/^p/.test(id)?IMG.port:IMG.land});});
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:/^p/.test(id)?IMG.port:IMG.land});});
  await ctx.route(ORIG+'/photoroom/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({configured:true,calls:0})}));
  await ctx.route(ORIG+'/photoroom/compose',r=>{let b={};try{b=JSON.parse(r.request().postData()||'{}');}catch(e){}composeLog.push({W:b.W,H:b.H,bg:b.bg,pid:b.pid||null,b64:!!b.image_b64,hi:!!b.hi,recorte:!!b.recorte});
    if(composeFalha)return r.fulfill({status:200,contentType:'application/json',body:J({ok:false,error:'falha de teste'})});
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,url:'/photoroom/result/'+(composeOpaca?'op':b.W>=4000?'hi':'lo')+'.png'})});});
  await ctx.route(ORIG+'/photoroom/result/**',r=>{const u=r.request().url();r.fulfill({status:200,contentType:'image/png',body:/op\.png$/.test(u)?IMG.op:/hi\.png$/.test(u)?IMG.hi:IMG.lo});});}
function vigia(pg,nome){pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(`${nome}: ${e.message}`));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API|ERR_|net::|onnxruntime|404|status of 50/.test(m.text()))errs.push(`${nome}: ${m.text()}`);});return pg;}
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
const sim=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')));
const toastTxt=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent);
const txt=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\s+/g,' '):'';},s);
// Checkout: abre a sessão pelo código, marca n fotos do campo e vai para o carrinho
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;const k=ETERNA.state.kiosk;if(k.step!=='code'){ETERNA.state.kiosk.step='code';ETERNA.render();}});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(500);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.state.kiosk.step='cart';ETERNA.render();},[card,n]);await L.waitForTimeout(200);}
async function ljPagar(L,m){await L.click(`[data-act="loja-paym"][data-m="${m}"]`);await L.waitForTimeout(120);await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(400);}
const pendDe=(pg,card)=>pg.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&x.estado==='aguardando'),card);
// venda injetada direto no SIM (sessão com fotos ag_ servidas pelo page.route), pendência aguardando
async function injPend(pg,o){return pg.evaluate(o=>{const S=ETERNA.SIM;const card=o.card;S.sessions[card]={key:'carlos',pdv:'Foto Campo 2',time:'10:00',date:'hoje',status:'aguardando',selected:o.sel.slice(),aiSel:(o.ai||[]).slice(),fav:(o.fav||[]).slice(),cart:o.cart,photos:o.sel.concat(o.extra||[]).map(id=>({id,sold:0})),din:o.id};
  o.sel.concat(o.extra||[]).forEach(id=>{ETERNA.UP[id]={src:location.origin+'/thumb/'+id.slice(3),name:id};});
  const tok=ETERNA.galDaSessao(card,true);const g=S.galerias[tok];
  S.caixaDin.unshift({id:o.id,venue:'maracana',card,token:tok,codigo:g.codigo,criada:o.criada||new Date().toISOString(),total:o.total,prints:o.prints,n:o.sel.length+(o.ai||[]).length,nPh:o.sel.length,nAI:(o.ai||[]).length,cart:o.cart,selected:o.sel.slice(),aiSel:(o.ai||[]).slice(),fav:(o.fav||[]).slice(),meio:o.meio||'pix',prov:'pos-manual',saleNo:o.saleNo||'L0-9'+String(Math.floor(Math.random()*90+10)),vendedor:o.vend||null,posto:'Caixa 1',estado:'aguardando',fechada:null,por:null,porNome:null,motivo:null});
  localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.render();return g.codigo;},o);}
async function confirmar(A,id,ref){await A.click(`[data-act="pend-pos"][data-id="${id}"]`);await A.waitForTimeout(100);if(ref!=null)await A.fill('#pend-ref',ref);await A.click(`[data-act="pend-pos-ok"][data-id="${id}"]`);await A.waitForTimeout(250);}
async function imprimir(A,card){await A.evaluate(()=>{window.__prints=0;window.print=()=>{window.__prints++;};});await A.click(`[data-act="imp-print"][data-card="${card}"]`);
  await A.waitForSelector(`[data-act="imp-ok"][data-card="${card}"]`,{timeout:20000}).catch(()=>null);}
const raiz=pg=>pg.evaluate(()=>[...document.querySelectorAll('#print-root .pr-pg')].map(p=>{const i=p.querySelector('img');return {k:p.dataset.k,land:p.classList.contains('land'),src:i.src.slice(0,60),fundo:i.dataset.fundo||'',t:i.dataset.t,w:i.naturalWidth,h:i.naturalHeight};}));
function pdfPaginas(buf){const s=buf.toString('latin1');const n=(s.match(/\/Type\s*\/Page[^s]/g)||[]).length;const mb=[...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m=>[+m[3]-+m[1],+m[4]-+m[2]]);return {n,mb};}
const MM=v=>v*72/25.4;
// o app tira body.pr-on no afterprint; para gerar o PDF do que foi impresso, o teste põe a classe de volta só durante o page.pdf
async function pdfImpresso(A,o){await A.evaluate(()=>document.body.classList.add('pr-on'));const r=await A.pdf(o||{preferCSSPageSize:true,printBackground:true});await A.evaluate(()=>document.body.classList.remove('pr-on'));return r;}

(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});await rotas(ctx);
  const A=vigia(await ctx.newPage(),'A');await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(500);
  ok(await entrar(A,'eduardo@eduardorezende.com'),'admin não entrou');
  // "Abrir Checkout": janela nova do cliente e o admin cai no Posto de venda; o vendedor fica gravado
  const [L]=await Promise.all([ctx.waitForEvent('page'),A.click('#rail-ck [data-act="loja-abrir"]')]);vigia(L,'L');await L.waitForLoadState();await L.waitForTimeout(800);
  const a0=await A.evaluate(()=>({v:ETERNA.state.view,vend:JSON.parse(localStorage.getItem('eterna.posto.vendedor')||'null'),eco:!!document.querySelector('#eco')}));
  ok(a0.v==='posto'&&a0.vend&&a0.vend.email==='eduardo@eduardorezende.com'&&a0.eco,'abrir: admin deveria cair no Posto de venda com o vendedor gravado: '+J(a0));
  await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=8).map(s=>s.card));ok(cards.length>=8,'poucas sessões de exemplo: '+cards.length);

  // ---- 21: venda acompanhada (foto em tela, escolhidas, pacote com Ideal, total) em até 1 s
  const reqs=[];const rq=r=>{if(r.method()!=='GET')reqs.push(r.method()+' '+r.url());};A.on('request',rq);L.on('request',rq);
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',cards[0]);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(600);
  for(const x of ['kiosk-ok','kiosk-ok','kiosk-no'])await L.click(`[data-act="${x}"]`);await L.waitForTimeout(700);
  const lk=await L.evaluate(()=>({i:ETERNA.state.kiosk.i,n:ETERNA.lojaItems(ETERNA.state.kiosk.code).length}));
  let eco=await txt(A,'#eco');ok(eco.includes(`Foto ${lk.i+1} de ${lk.n}`)&&/Escolhidas · 2/i.test(eco),'21: Posto deveria mostrar a foto em tela e 2 escolhidas: '+eco.slice(0,200));
  ok(await A.evaluate(()=>!!document.querySelector('#eco .eco-big')),'21: foto grande no painel');
  await L.click('.lj-next');await L.waitForTimeout(700);eco=await txt(A,'#eco');
  ok(/Ideal/.test(eco)&&/Total/.test(eco)&&/R\$ \d+/.test(eco)&&/Pacote e pagamento/.test(eco),'21: carrinho no painel (pacote com Ideal e total): '+eco.slice(0,240));
  await A.screenshot({path:`${P}/v83-posto-eco.png`,fullPage:true});

  // ---- 14: cartão aguardando, sem QR, sem contagem, sem estoque, sem galFila
  const s0=await sim(L);const fila0=(s0.galFila||[]).length;const est0=s0.stock['Caixa 1'];
  await ljPagar(L,'card');
  const l14=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,wait:!!(ETERNA.state.kiosk.paid||{}).wait,qr:!!document.querySelector('#lqr'),volta:!!document.querySelector('#lj-volta-n'),timer:!!ETERNA.state.kiosk.timer,t:document.body.innerText.replace(/\s+/g,' ')}));
  const s14=await sim(L);const p14=s14.caixaDin.find(x=>x.card===cards[0]&&x.estado==='aguardando')||{};
  ok(await L.evaluate(()=>/Pagamento/.test((document.querySelector('.lj-steps .cur')||{}).innerText||'')),'indicador: aguardando o pagamento, a etapa atual é Pagamento');
  ok(l14.step==='done'&&l14.wait&&!l14.qr&&!l14.volta&&!l14.timer,'14: tela do cartão aguardando: '+J({...l14,t:''}));
  ok(/Pague na maquininha/i.test(l14.t)&&new RegExp('R\\$\\s'+p14.total).test(l14.t),'14: "Pague na maquininha" e o valor: '+l14.t.slice(0,240));
  ok(s14.sessions[cards[0]].status==='aguardando'&&p14.meio==='cartao'&&p14.prov==='pos-manual'&&/^L0-\d{3}$/.test(p14.saleNo||'')&&/^L00-[a-z0-9]{10,}$/.test(p14.id||''),'14: pendência do cartão: '+J({st:s14.sessions[cards[0]].status,meio:p14.meio,prov:p14.prov,no:p14.saleNo,id:p14.id}));
  ok(s14.stock['Caixa 1']===est0&&(s14.galFila||[]).length===fila0,'14: estoque e galFila não podem mudar: '+J({e:[est0,s14.stock['Caixa 1']],f:[fila0,(s14.galFila||[]).length]}));
  ok(p14.vendedor&&p14.vendedor.email==='eduardo@eduardorezende.com','14: vendedor declarado na pendência');
  await L.screenshot({path:`${P}/v83-checkout-cartao-aguardando.png`});
  await A.waitForTimeout(400);ok(await A.evaluate(id=>!!document.querySelector(`[data-pend="${id}"].alvo`),p14.id),'21: pendência destacada no Posto de venda');

  // ---- 21 (NSU): digitar no campo enquanto o cliente navega não perde o texto
  await A.click(`[data-act="pend-pos"][data-id="${p14.id}"]`);await A.waitForTimeout(100);await A.click('#pend-ref');await A.keyboard.type('1234');
  await L.click('[data-act="loja-new"]');await L.waitForTimeout(200);await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',cards[1]);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(500);
  for(const x of ['kiosk-ok','kiosk-next','kiosk-ok'])await L.click(`[data-act="${x}"]`);await L.waitForTimeout(900);
  await A.keyboard.type('56');ok(await A.evaluate(()=>document.querySelector('#pend-ref')&&document.querySelector('#pend-ref').value)==='123456','21: o NSU digitado se perdeu enquanto o cliente navegava');
  // a pendência segue com o vendedor mesmo com o cliente em outra sessão; o Checkout desta compra já saiu (loja-new) e volta só pelo código
  // ---- 15: Pago na maquininha com NSU 123456
  await A.click(`[data-act="pend-pos-ok"][data-id="${p14.id}"]`);await A.waitForTimeout(300);
  const s15=await sim(A);const v15=s15.sessions[cards[0]];
  ok(v15.status==='paga'&&v15.payment==='Cartão (maquininha)'&&v15.pag&&v15.pag.ref==='123456'&&v15.saleNo===p14.saleNo&&v15.impressao&&v15.impressao.estado==='pendente','15: venda paga com NSU: '+J({st:v15.status,pay:v15.payment,pag:v15.pag,no:v15.saleNo,imp:v15.impressao}));
  ok(s15.stock['Caixa 1']===est0,'15: confirmar não baixa estoque');
  // 15: a janela do Checkout que está esperando passa à tela do QR em até 2 s (nova pendência, Checkout parado no "aguardando")
  await ljSessao(L,cards[2],4);await ljPagar(L,'card');const p15=await pendDe(L,cards[2]);
  await A.waitForTimeout(300);await confirmar(A,p15.id,'');
  let t0=Date.now(),l15=null;while(Date.now()-t0<2000){l15=await L.evaluate(()=>({qr:!!document.querySelector('#lqr'),volta:!!document.querySelector('#lj-volta-n'),wait:!!(ETERNA.state.kiosk.paid||{}).wait,timer:!!ETERNA.state.kiosk.timer}));if(l15.qr)break;await sleep(100);}
  ok(l15&&l15.qr&&l15.volta&&!l15.wait&&l15.timer,'15: Checkout deveria virar a tela do QR com a contagem em até 2 s: '+J(l15));
  await L.screenshot({path:`${P}/v83-checkout-confirmado.png`});

  // ---- 16: NSU com cara de cartão e curto recusados; vazio aceito
  await L.click('[data-act="loja-new"]');await ljSessao(L,cards[3],3);await ljPagar(L,'card');const p16=await pendDe(L,cards[3]);await A.waitForTimeout(300);
  await A.click(`[data-act="pend-pos"][data-id="${p16.id}"]`);await A.fill('#pend-ref','4111111111111111');await A.click(`[data-act="pend-pos-ok"][data-id="${p16.id}"]`);await A.waitForTimeout(200);
  let e16=await A.evaluate(()=>({t:document.querySelector('#toast').textContent,err:(document.querySelector('.pend-err')||{}).innerText||''}));const st16=(await sim(A)).caixaDin.find(x=>x.id===p16.id);
  ok(/parece número de cartão/.test(e16.t+e16.err)&&st16.estado==='aguardando'&&!JSON.stringify(await sim(A)).includes('4111111111111111')&&!JSON.stringify(await A.evaluate(()=>ETERNA.pvFila())).includes('4111111111111111'),'16: número de cartão deveria ser recusado e não gravado: '+J(e16));
  await A.fill('#pend-ref','12');await A.click(`[data-act="pend-pos-ok"][data-id="${p16.id}"]`);await A.waitForTimeout(200);
  ok(/4 a 12/.test(await toastTxt(A))&&(await sim(A)).caixaDin.find(x=>x.id===p16.id).estado==='aguardando','16: "12" deveria ser recusado');
  await A.fill('#pend-ref','');await A.click(`[data-act="pend-pos-ok"][data-id="${p16.id}"]`);await A.waitForTimeout(250);
  const v16=(await sim(A)).sessions[cards[3]];ok(v16.status==='paga'&&v16.pag&&v16.pag.ref===null,'16: vazio deveria ser aceito: '+J(v16.pag));

  // ---- 17: PIX mostra ljPosPixH; Dinheiro mantém os textos da v79 e passa à tela do QR na confirmação
  await L.click('[data-act="loja-new"]');await ljSessao(L,cards[4],3);await ljPagar(L,'pix');
  ok(/Pague com PIX na maquininha/i.test(await txt(L,'body'))&&!(await L.$('#lqr')),'17: tela do PIX');const p17=await pendDe(L,cards[4]);ok(p17&&p17.meio==='pix','17: pendência PIX');
  await A.waitForTimeout(300);await confirmar(A,p17.id,'778899');ok((await sim(A)).sessions[cards[4]].payment==='PIX (maquininha)','17: PIX (maquininha)');
  await L.click('[data-act="loja-new"]');await ljSessao(L,cards[5],3);await ljPagar(L,'cash');
  const l17=await L.evaluate(()=>({t:document.body.innerText.replace(/\s+/g,' '),cash:!!document.querySelector('.lj-cashdone .lj-pendbig'),qr:!!document.querySelector('#lqr')}));
  ok(l17.cash&&/Pague no caixa/i.test(l17.t)&&/[A-Z0-9]{4}-[A-Z0-9]{4}/.test(l17.t)&&!l17.qr,'17: dinheiro com os textos da v79, sem QR enquanto espera: '+l17.t.slice(0,200));
  const p17d=await pendDe(L,cards[5]);await A.waitForTimeout(300);
  ok(!(await A.$(`[data-act="pend-pos"][data-id="${p17d.id}"]`))&&!!(await A.$(`[data-act="din-confirm"][data-id="${p17d.id}"]`)),'17: dinheiro usa "Recebi", não a maquininha');
  await A.click(`[data-act="din-confirm"][data-id="${p17d.id}"]`);await A.waitForTimeout(300);
  t0=Date.now();let q17=false;while(Date.now()-t0<2000){q17=await L.evaluate(()=>!!document.querySelector('#lqr'));if(q17)break;await sleep(100);}ok(q17,'17: dinheiro confirmado deveria passar à tela do QR');

  // ---- 18: o vendedor cancela: Checkout volta ao carrinho da mesma sessão com o aviso
  await L.click('[data-act="loja-new"]');await ljSessao(L,cards[6],3);await ljPagar(L,'card');const p18=await pendDe(L,cards[6]);await A.waitForTimeout(300);
  await A.click(`[data-act="din-cancel"][data-id="${p18.id}"]`);await A.click(`[data-act="din-cancel-ok"][data-id="${p18.id}"]`);await A.waitForTimeout(500);
  const l18=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code,t:(document.querySelector('.lj-aviso')||{}).innerText||''}));const s18=await sim(A);
  ok(l18.step==='cart'&&l18.code===cards[6]&&/O pagamento foi cancelado/.test(l18.t),'18: Checkout deveria voltar ao carrinho com o aviso: '+J(l18));
  ok(s18.caixaDin.find(x=>x.id===p18.id).estado==='cancelada'&&s18.sessions[cards[6]].status!=='paga','18: pendência cancelada sem virar venda');
  await L.screenshot({path:`${P}/v83-checkout-cancelado.png`});

  // ---- fila local de eventos (G, só local): criar, pagar, cancelar em ordem, idem único
  const fila=await A.evaluate(()=>ETERNA.pvFila());const idems=new Set(fila.map(e=>e.idem));
  const doId=id=>fila.filter(e=>e.venda===id).map(e=>e.tipo+':'+e.seq).join(',');
  ok(idems.size===fila.length&&doId(p14.id)==='criar:1,pagar:2'&&doId(p18.id)==='criar:1,cancelar:2','G: fila local: '+J({p14:doId(p14.id),p18:doId(p18.id),n:fila.length}));
  ok(fila.every(e=>!JSON.stringify(e).includes('@')),'G: a fila não pode levar e-mail');
  const ev14=fila.find(e=>e.venda===p14.id&&e.tipo==='pagar');ok(ev14&&ev14.dados.ref==='123456'&&ev14.dados.prov==='pos-manual','G: pagar com ref e prov: '+J(ev14&&ev14.dados));

  // ---- 22: fechar a janela do Checkout: "Checkout fechado ou parado" em até 15 s; nada foi para o agente
  await L.close();t0=Date.now();let f22=false;while(Date.now()-t0<15500){f22=/Checkout fechado ou parado/.test(await txt(A,'#eco'));if(f22)break;await sleep(250);}
  ok(f22,'22: painel deveria mostrar "Checkout fechado ou parado"');A.off('request',rq);
  const rq2=reqs.filter(r=>!/\/photoroom\//.test(r)); // prévias dos fundos de IA do Checkout (não são dados do painel)
  ok(!rq2.length,'22: nenhuma requisição de escrita levou os dados do painel: '+J(rq2.slice(0,5)));

  // ---- 19: quem só tem venda.r não vê os botões; forçar pend-pos-ok cai em "Sem permissão"
  await injPend(A,{card:'LPV83R',id:'L00-v83r0000aaaa',sel:['ag_a00000000019'],cart:[{id:'arq',v:70}],total:70,prints:1});
  const r19=await A.evaluate(()=>{const u=ETERNA.state.user;const bk=JSON.stringify(u.perms);u.perms.venda={c:false,r:true,u:false,d:false};ETERNA.state.view='posto';ETERNA.render();
    const vis=!!document.querySelector('[data-act="pend-pos"],[data-act="din-confirm"],[data-act="imp-print"]');const bt=document.createElement('button');bt.dataset.act='pend-pos-ok';bt.dataset.id='L00-v83r0000aaaa';document.body.appendChild(bt);bt.click();bt.remove();
    const t=document.querySelector('#toast').textContent;const est=ETERNA.SIM.caixaDin.find(x=>x.id==='L00-v83r0000aaaa').estado;u.perms=JSON.parse(bk);ETERNA.render();return {vis,t,est};});
  ok(!r19.vis&&/Sem permissão/.test(r19.t)&&r19.est==='aguardando','19: só venda.r: '+J(r19));

  // ---- 20: chaves ljPos* e ljPayCancelled nos 5 idiomas, sem chave crua, em 390, 768 e 1366; nenhum "2 minutos"
  const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');ok(!/2 minut|2 Minut/i.test(src),'20: ainda há "2 minutos" no index.html');
  {const c2=await b.newContext();await rotas(c2);const K=vigia(await c2.newPage(),'K');await K.goto(U+'#loja');await K.waitForTimeout(700);
    const card=await K.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=8).card);
    for(const [w,h] of [[390,844],[768,1024],[1366,800]]){await K.setViewportSize({width:w,height:h});
      for(const lg of ['pt','en','es','fr','de'])for(const meio of ['cartao','pix','aviso']){
        const r=await K.evaluate(([card,lg,meio])=>{const k=ETERNA.state.kiosk;k.code=card;ETERNA.state.lang=lg;if(meio==='aviso'){const pk=ETERNA.lojaPick(card);const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');it.slice(0,3).forEach(x=>pk[x.k]='ok');k.step='cart';k.paid=null;k.aviso='ljPayCancelled';}
          else{k.step='done';k.aviso=null;k.paid={wait:true,meio,pend:'x',total:190,prints:5,n:5,codigo:'ABCD-2345'};}
          ETERNA.render();const t=document.body.innerText;const el=document.querySelector(meio==='aviso'?'.lj-aviso':'.lj-waitcard');const r=el&&el.getBoundingClientRect();
          const h=document.querySelector('.lj-h1');return {h1:meio==='aviso'||!!h&&h.scrollWidth<=h.clientWidth+1&&h.getBoundingClientRect().right<=innerWidth+1,raw:/ljPos|ljPay|undefined|NaN/.test(t),sw:document.documentElement.scrollWidth<=innerWidth+1,box:!!r&&r.right<=innerWidth+1&&r.left>=-1,dois:/2 min|2 Minuten/i.test(t),t:(el||{}).innerText||''};},[card,lg,meio]);
        ok(!r.raw&&r.sw&&r.box&&!r.dois&&r.t.length>8&&r.h1,`20: ${w} ${lg} ${meio}: `+J(r));
        if(w===390&&meio!=='aviso')await K.screenshot({path:`${P}/v83-390-${meio}-${lg}.png`});}}
    await c2.close();}

  // ---- 23: venda paga com 5 impressas: 5 páginas 10×15 com /file/<hex>, foto deitada girada
  const F5=['ag_aaaa00000001','ag_pbbb00000002','ag_aaaa00000003','ag_aaaa00000004','ag_aaaa00000005','ag_aaaa00000006'];
  await A.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});
  await injPend(A,{card:'LPV83A',id:'L00-v83a0000aaaa',sel:F5.slice(0,5),extra:[F5[5]],cart:[{id:'gramado',v:150}],total:150,prints:5,fav:['ag_aaaa00000004'],vend:{email:'eduardo@eduardorezende.com',nome:'Eduardo Rezende'}});
  await confirmar(A,'L00-v83a0000aaaa','445566');
  const est23=(await sim(A)).stock['Caixa 1'];
  const bt23=await txt(A,'[data-act="imp-print"][data-card="LPV83A"]');ok(/Imprimir 5 fotos \(10×15\)/.test(bt23),'23: botão "Imprimir 5 fotos (10×15)": '+bt23);
  await imprimir(A,'LPV83A');const r23=await raiz(A);
  ok(r23.length===5&&r23.every(x=>/\/file\/[0-9a-f]{12}$/.test(new URL(x.src.length<60?x.src:x.src,ORIG).pathname)||x.src.includes('/file/')),'23: #print-root com 5 páginas em /file/<hex>: '+J(r23));
  ok(r23[0]&&r23[0].k==='ag_aaaa00000004','23: favorita primeiro: '+J(r23.map(x=>x.k)));
  ok(r23.filter(x=>x.land).length===4&&r23.find(x=>x.k==='ag_pbbb00000002'&&!x.land),'23: só as deitadas com .land: '+J(r23.map(x=>[x.k,x.land])));
  ok(await A.evaluate(()=>window.__prints)===1,'23: window.print uma vez');ok(!(await A.evaluate(()=>document.body.classList.contains('pr-on'))),'23: pr-on sai depois do afterprint');
  const pdf=await pdfImpresso(A);fs.writeFileSync(`${P}/v83-impressao-5.pdf`,pdf);const pp=pdfPaginas(pdf);
  ok(pp.n===5&&pp.mb.length>=5&&pp.mb.every(([w,h])=>Math.abs(w-MM(102))<2&&Math.abs(h-MM(152))<2),'23: PDF com 5 páginas de 102×152 mm: '+J(pp));
  await A.evaluate(()=>document.body.classList.add('pr-on'));await A.emulateMedia({media:'print'});const g23=await A.evaluate(()=>{const p=document.querySelector('#print-root .pr-pg.land');const bx=p.querySelector('.pr-box').getBoundingClientRect();const pg=p.getBoundingClientRect();const im=p.querySelector('img');return {pw:pg.width,ph:pg.height,bw:bx.width,bh:bx.height,fit:getComputedStyle(im).objectFit,tf:getComputedStyle(p.querySelector('.pr-box')).transform};});await A.emulateMedia({media:null});await A.evaluate(()=>document.body.classList.remove('pr-on'));
  ok(Math.abs(g23.bw-g23.pw)<2&&Math.abs(g23.bh-g23.ph)<2&&g23.fit==='cover'&&g23.tf!=='none','23: foto deitada girada preenchendo a página: '+J(g23));
  // ---- 24: Saiu certo baixa exatamente 5, uma vez só
  await A.click('[data-act="imp-ok"][data-card="LPV83A"]');await A.waitForTimeout(250);let s24=await sim(A);
  ok(s24.sessions.LPV83A.impressao.estado==='impressa'&&s24.stock['Caixa 1']===est23-5,'24: Saiu certo deveria baixar 5: '+J({e:[est23,s24.stock['Caixa 1']],imp:s24.sessions.LPV83A.impressao.estado}));
  await A.evaluate(()=>{const bt=document.createElement('button');bt.dataset.act='imp-ok';bt.dataset.card='LPV83A';document.body.appendChild(bt);bt.click();bt.remove();});await A.waitForTimeout(150);
  await A.reload();await A.waitForTimeout(500);await A.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});s24=await sim(A);
  ok(s24.stock['Caixa 1']===est23-5&&!(await A.$('#print-root')),'24: repetir ou recarregar não baixa de novo: '+s24.stock['Caixa 1']);
  // reimpressão (R4): o vendedor escolhe a foto; "Não saiu" não baixa; "Saiu certo" baixa 1 e grava a lista exata; entra no CSV
  const reimp=async(k,res)=>{await A.click('[data-act="imp-reprint"][data-card="LPV83A"]');await A.waitForTimeout(100);await A.click(`[data-act="imp-repick"][data-card="LPV83A"][data-k="${k}"]`);await A.click('[data-act="imp-motivo"][data-m="falhou"]');
    await A.evaluate(()=>{window.print=()=>{};});await A.click('[data-act="imp-reprint-ok"][data-card="LPV83A"]');await A.waitForSelector(`[data-act="${res}"][data-card="LPV83A"]`,{timeout:15000});
    const r=await raiz(A);ok((await sim(A)).stock['Caixa 1']===est23-5-(res==='imp-falha'?0:0),'24: a reimpressão não baixa antes do Saiu certo');await A.click(`[data-act="${res}"][data-card="LPV83A"]`);await A.waitForTimeout(250);return r;};
  const rf=await reimp('ag_aaaa00000003','imp-falha');s24=await sim(A);
  ok(rf.length===1&&rf[0].k==='ag_aaaa00000003'&&s24.stock['Caixa 1']===est23-5&&s24.sessions.LPV83A.impressoes.some(x=>x.reimpressao&&x.resultado==='nao_saiu'&&J(x.fotos)===J(['ag_aaaa00000003'])),'24: reimpressão "Não saiu" não baixa: '+J({rf,e:s24.stock['Caixa 1']}));
  const rk=await reimp('ag_aaaa00000003','imp-ok');s24=await sim(A);
  const re24=(s24.sessions.LPV83A.impressoes||[]).filter(x=>x.reimpressao&&x.resultado==='ok');
  ok(rk.length===1&&s24.stock['Caixa 1']===est23-6&&re24.length===1&&re24[0].n===1&&re24[0].motivo==='falhou'&&J(re24[0].fotos)===J(['ag_aaaa00000003']),'24: reimpressão de 1 (falhou) com a lista exata: '+J({e:s24.stock['Caixa 1'],re24}));
  // limite: até prints (5) por reimpressão; a grade só mostra as já impressas
  await A.click('[data-act="imp-reprint"][data-card="LPV83A"]');await A.waitForTimeout(80);ok(await A.evaluate(()=>document.querySelectorAll('[data-act="imp-repick"][data-card="LPV83A"]').length)===5,'24: grade da reimpressão com as 5 impressas');await A.click('[data-act="imp-reprint-no"]');
  const csv=await A.evaluate(()=>ETERNA.salesCSV(ETERNA.allSales()));const hdr=csv.split('\n')[0];const lin=csv.split('\n').find(l=>l.includes('LPV83A'))||'';
  ok(/;"?posto"?;"?pagamento_ref"?;"?impressao"?$/.test(hdr)&&/reimpressão 1 \(falhou\)/.test(lin)&&lin.includes('445566')&&!lin.includes('@'),'24: CSV com posto;pagamento_ref;impressao e a reimpressão: '+J({hdr:hdr.slice(-60),lin:lin.slice(-160)}));
  // "Não saiu": volta a pendente sem baixar
  await injPend(A,{card:'LPV83B',id:'L00-v83b0000aaaa',sel:F5.slice(0,3),cart:[{id:'zona',v:110}],total:110,prints:3});await confirmar(A,'L00-v83b0000aaaa','');
  const e24b=(await sim(A)).stock['Caixa 1'];await imprimir(A,'LPV83B');await A.click('[data-act="imp-falha"][data-card="LPV83B"]');await A.waitForTimeout(250);const s24b=await sim(A);
  ok(s24b.sessions.LPV83B.impressao.estado==='pendente'&&s24b.stock['Caixa 1']===e24b&&s24b.sessions.LPV83B.impressoes.some(x=>x.resultado==='nao_saiu'),'24: Não saiu volta a pendente sem baixar: '+J(s24b.sessions.LPV83B.impressao));

  // ---- 25 (Eduardo, 29/10: foto com fundo de IA imprime): 3 do campo + 1 de IA num pacote de 4: imprime as 4 com a montagem do fundo de 5000 px
  composeLog.length=0;composeFalha=false;
  await injPend(A,{card:'LPV83C',id:'L00-v83c0000aaaa',sel:F5.slice(0,3),ai:['ag_aaaa00000001|campeao2'],cart:[{id:'gramado',v:150}],total:150,prints:4});await confirmar(A,'L00-v83c0000aaaa','');
  const s25=(await sim(A)).sessions.LPV83C;ok(s25.impressao.semFoto===0&&s25.impressao.alvo===4,'25: semFoto 0 e 4 para imprimir: '+J(s25.impressao));
  ok(await A.evaluate(()=>!!document.querySelector('[data-imp="LPV83C"] .imp-ia')),'25: a foto de IA aparece na grade com o selo IA');
  await imprimir(A,'LPV83C');const r25=await raiz(A);const ia=r25.find(x=>x.t==='ai');
  ok(r25.length===4&&ia&&/^data:image\/jpeg/.test(ia.src)&&ia.fundo==='img/fundos-5k/campeao.jpg'&&Math.max(ia.w,ia.h)>=1800,'25: 4 páginas, a de IA montada do fileHi com 1800 px ou mais: '+J(r25.map(x=>({k:x.k,t:x.t,fundo:x.fundo,w:x.w,h:x.h}))));
  ok(composeLog.some(c=>c.W===5000&&c.bg==='campeao2'&&c.pid==='aaaa00000001'&&c.hi&&c.recorte),'25: montagem pedida na resolução do fundo de 5000 px com a foto original: '+J(composeLog));
  const pdf25=await pdfImpresso(A);fs.writeFileSync(`${P}/v83-impressao-ia.pdf`,pdf25);ok(pdfPaginas(pdf25).n===4,'25: PDF com 4 páginas: '+J(pdfPaginas(pdf25)));
  const e25=(await sim(A)).stock['Caixa 1'];await A.click('[data-act="imp-ok"][data-card="LPV83C"]');await A.waitForTimeout(200);const s25b=await sim(A);
  ok(s25b.sessions.LPV83C.impressao.estado==='impressa'&&s25b.stock['Caixa 1']===e25-4,'25: Saiu certo baixa 4');
  // montagem que falha: as outras imprimem, a de IA fica para "tente de novo"
  composeFalha=true;await injPend(A,{card:'LPV83D',id:'L00-v83d0000aaaa',sel:F5.slice(0,3),ai:['ag_aaaa00000003|campeao2'],cart:[{id:'gramado',v:150}],total:150,prints:4});await confirmar(A,'L00-v83d0000aaaa','');
  await imprimir(A,'LPV83D');const r25d=await raiz(A);const t25d=await txt(A,'[data-imp="LPV83D"]');
  ok(r25d.length===3&&!r25d.some(x=>x.t==='ai')&&/Não deu para montar o fundo: tente de novo/.test(t25d),'25: montagem que falha: '+J({n:r25d.length,t:t25d.slice(0,200)}));
  const e25d=(await sim(A)).stock['Caixa 1'];await A.click('[data-act="imp-ok"][data-card="LPV83D"]');await A.waitForTimeout(200);const s25d=await sim(A);
  ok(s25d.sessions.LPV83D.impressao.estado==='pendente'&&s25d.stock['Caixa 1']===e25d-3&&/Não deu para montar o fundo/.test(await txt(A,'[data-imp="LPV83D"]')),'25: depois do Saiu certo falta a de IA: '+J(s25d.sessions.LPV83D.impressao));
  composeFalha=false;

  // ---- 26: trocar quais imprimir sem passar de prints; o PDF tem as escolhidas
  await injPend(A,{card:'LPV83E',id:'L00-v83e0000aaaa',sel:F5.slice(0,5),cart:[{id:'zona',v:110},{id:'extra',v:35},{id:'extra',v:35}],total:180,prints:2});await confirmar(A,'L00-v83e0000aaaa','');
  const pk=k=>A.click(`[data-act="imp-pick"][data-card="LPV83E"][data-k="${k}"]`);
  await pk(F5[2]);await A.waitForTimeout(80);ok(/Já são 2/.test(await toastTxt(A)),'26: marcar a terceira deveria ser barrado');
  await pk(F5[0]);await pk(F5[2]);await A.waitForTimeout(80);
  ok(/Imprimir 2 fotos/.test(await txt(A,'[data-act="imp-print"][data-card="LPV83E"]')),'26: continua em 2');
  await imprimir(A,'LPV83E');const r26=await raiz(A);ok(J(r26.map(x=>x.k).sort())===J([F5[1],F5[2]].sort()),'26: impressas as escolhidas: '+J(r26.map(x=>x.k)));
  const pdf26=await pdfImpresso(A,{preferCSSPageSize:true});ok(pdfPaginas(pdf26).n===2,'26: PDF com 2 páginas: '+J(pdfPaginas(pdf26)));
  await A.click('[data-act="imp-ok"][data-card="LPV83E"]');await A.waitForTimeout(150);
  await A.screenshot({path:`${P}/v83-posto-impressao.png`,fullPage:true});

  // ---- fila: impressao e rolo; troca de rolo por postoNome
  await A.evaluate(()=>{ETERNA.state.view='estoque';ETERNA.render();});await A.click('[data-act="stock-swap"]');await A.waitForTimeout(150);
  const fl=await A.evaluate(()=>ETERNA.pvFila());ok(fl.some(e=>e.tipo==='impressao'&&e.venda==='L00-v83a0000aaaa'&&e.dados.resultado==='ok'&&e.dados.n===5)&&fl.some(e=>e.tipo==='impressao'&&e.dados.reimpressao&&e.dados.motivo==='falhou')&&fl.some(e=>e.tipo==='impressao'&&e.dados.resultado==='nao_saiu')&&fl.some(e=>e.tipo==='rolo'&&e.venda==='L00'),'G: eventos de impressão e rolo na fila');
  ok((await sim(A)).stock['Caixa 1']===700,'rolo trocado em Caixa 1 (local/off): 700 da DNP RX1HS');

  // ---- alertas locais: pendência antiga, paga sem impressão há mais de 10 min, rolo abaixo de 40, semFoto
  const al=await A.evaluate(()=>{const S=ETERNA.SIM;const v=new Date(Date.now()-20*60000).toISOString();const r=S.caixaDin.find(x=>x.id==='L00-v83r0000aaaa');r.criada=v;
    S.sessions.LPV83B.paidAt=new Date(Date.now()-15*60000).toISOString();S.stock['Caixa 1']=30;S.sessions.LPV83E.impressao.semFoto=1;return ETERNA.alerts().map(a=>a.sev+' '+a.t);});
  ok(al.some(t=>/maquininha há 2\d min/.test(t))&&al.some(t=>/LPV83B|L0-\d+.*sem impressão/.test(t)||/paga há 1\d min e ainda sem impressão/.test(t))&&al.some(t=>/Caixa 1: rolo com 30/.test(t))&&al.some(t=>/^bad .*sem foto/.test(t)),'alertas locais: '+J(al.filter(t=>/maquininha|impress|rolo|sem foto/.test(t))));

  // ---- R1(c): o Photoroom devolve a foto já montada (opaca): imprime em 1800 px ou mais e registra o aviso
  await A.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});
  composeOpaca=true;composeLog.length=0;await injPend(A,{card:'LPV83F',id:'L00-v83f0000aaaa',sel:F5.slice(0,1),ai:['ag_aaaa00000005|campeao2'],cart:[{id:'arq',v:70},{id:'extra',v:35}],total:105,prints:2});await confirmar(A,'L00-v83f0000aaaa','');
  await imprimir(A,'LPV83F');const r25o=await raiz(A);const iao=r25o.find(x=>x.t==='ai');
  ok(r25o.length===2&&iao&&Math.max(iao.w,iao.h)>=1800&&composeLog.some(c=>c.hi&&c.recorte&&c.W===5000),'R1(c): resposta opaca imprime em alta: '+J({r25o,composeLog}));
  await A.click('[data-act="imp-ok"][data-card="LPV83F"]');await A.waitForTimeout(200);const s25o=(await sim(A)).sessions.LPV83F;
  ok(s25o.impressao.estado==='impressa'&&s25o.impressoes.slice(-1)[0].avisos.includes('montagem_opaca'),'R1(c): aviso montagem_opaca no registro: '+J(s25o.impressoes.slice(-1)[0]));composeOpaca=false;
  // ---- R1(a): o agente usa o mapa fixo de fundos aprovados (Noite de campeão sem a taça na prévia e o de 5000 px na impressão)
  {const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v83-ag-'));let out='';
    try{out=execFileSync('python3',['-I','-c',`
import importlib.util,hashlib,json,sys
sp=importlib.util.spec_from_file_location('ag',sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
h=lambda b:hashlib.sha256(b).hexdigest()
r={'previa':h(m.bg_bytes('campeao2')),'hi':h(m.bg_bytes('campeao2',True))}
try:
  m.bg_bytes('campeaoarg');r['fora']='aceito'
except ValueError: r['fora']='recusado'
try:
  m.pr_compose(b'x','campeao2',6000,4000,{});r['teto']='aceito'
except ValueError: r['teto']='recusado'
print(json.dumps(r))`,path.join(__dirname,'..','agente','eterna-agente.py')],{env:{...process.env,HOME:H,ETERNA_SEM_OPENCV:'1',ETERNA_APP_ORIGIN:ORIG},timeout:60000}).toString().trim().split('\n').pop();}catch(e){out='erro '+String(e.message).slice(0,200);}
    const sha=p=>require('crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',p))).digest('hex');let j={};try{j=JSON.parse(out);}catch(e){}
    ok(j.previa===sha('img/bg-campeao-v81.jpg')&&j.previa!==sha('img/bg-campeao2.jpg')&&j.hi===sha('img/fundos-5k/campeao.jpg')&&j.fora==='recusado'&&j.teto==='recusado','R1(a): mapa de fundos do agente: '+out);
    fs.rmSync(H,{recursive:true,force:true});}
  // ---- S1: mensagem forjada no canal não injeta HTML no Posto de venda
  {await A.evaluate(()=>{ETERNA.state.view='posto';ETERNA.render();});const X=vigia(await ctx.newPage(),'X');await X.goto(U+'#loja');await X.waitForTimeout(400);
    await X.evaluate(()=>{const c=new BroadcastChannel('eterna-loja');const card=ETERNA.demoSessions()[0].card;
      c.postMessage({tipo:'estado',em:Date.now(),step:'cart',lang:'pt',card,i:'<img src=x onerror="window.__xss=1">',n:3,pkg:'arq',ideal:'arq',total:'<b id=xss2>',prints:'<img id=xss3 src=x onerror="window.__xss=1">',
        lines:[{t:'pkg',n:'<img id=xss4 src=x onerror="window.__xss=1">',v:70},{t:'extra',n:'<img id=xss5 src=x onerror="window.__xss=1">',v:'<i id=xss6>'}],esc:[{t:'ph',id:'"><img id=xss7 src=x>'}],pay:'<b>'});});
    await A.waitForTimeout(600);await X.close();
    const x=await A.evaluate(()=>({xss:!!window.__xss,el:!!document.querySelector('#xss2,#xss3,#xss4,#xss5,#xss6,#xss7,#eco img'),eco:document.querySelector('#eco').innerHTML.slice(0,300)}));
    ok(!x.xss&&!x.el,'S1: mensagem forjada injetou HTML: '+J(x));}
  // ---- S2: sem TEF real, o Caixa não tem caminho de pagamento automático
  {const r=await A.evaluate(()=>{const S=ETERNA.SIM;const c=ETERNA.demoSessions().find(s=>(S.sessions[s.card]||{}).status!=='paga').card;const s=S.sessions[c]=S.sessions[c]||{};s.selected=[];s.cart=[{id:'arq'}];s.status='no caixa';
      ETERNA.state.caixa.session=c;ETERNA.state.caixa.pay='PIX';ETERNA.state.caixa.tef=true;ETERNA.state.view='caixa';ETERNA.render();
      const vis=!!document.querySelector('[data-act="caixa-mode"][data-m="tef"],[data-act="caixa-tef"]');const bt=document.createElement('button');bt.dataset.act='caixa-tef';document.body.appendChild(bt);bt.click();bt.remove();
      return {vis,t:document.querySelector('#toast').textContent,c,tef:!!ETERNA.PAG_PROV.tef};});
    await A.waitForTimeout(6000);const st=(await A.evaluate(c=>(ETERNA.SIM.sessions[c]||{}).status,r.c));
    ok(!r.vis&&!r.tef&&/TEF ainda não disponível/.test(r.t)&&st!=='paga','S2: TEF simulado: '+J({...r,st}));}
  // ---- R2: fila local com no máximo 7 dias e 2000 eventos; o descarte fica registrado
  {const r=await A.evaluate(async()=>{const velho=new Date(Date.now()-9*864e5).toISOString(),hoje=new Date().toISOString();const l=[];for(let i=0;i<50;i++)l.push({idem:'V:'+i,venda:'V',seq:i+1,tipo:'criar',em:velho,dados:{}});for(let i=0;i<2100;i++)l.push({idem:'N:'+i,venda:'N',seq:i+1,tipo:'criar',em:hoje,dados:{}});
      localStorage.setItem('eterna.ponto.fila.v1',JSON.stringify(l));localStorage.removeItem('eterna.ponto.descartes.v1');ETERNA.pvEvento('rolo','L00',{capacidade:700});await new Promise(z=>setTimeout(z,200));
      const f=ETERNA.pvFila();return {n:f.length,velho:f.some(e=>e.venda==='V'),ult:f[f.length-1].tipo,desc:JSON.parse(localStorage.getItem('eterna.ponto.descartes.v1')||'[]')[0]};});
    ok(r.n===2000&&!r.velho&&r.ult==='rolo'&&r.desc&&r.desc.n===151,'R2: limite da fila: '+J(r));
    ok(!/eventos? esperando/.test(await txt(A,'#main')),'R2: a pílula de eventos esperando fica escondida nesta etapa');}
  // ---- 34: Minhas vendas de hoje para Atendimento e venda: valor de cada venda, nenhuma soma; outro vendedor não vê
  await A.evaluate(()=>{const S=ETERNA.SIM;const h=new Date().toISOString();
    S.caixaDin.unshift({id:'L00-v83m0000aaa1',card:'LPV83M1',codigo:'MMMM-1111',criada:h,total:190,prints:5,n:5,cart:[],selected:[],aiSel:[],meio:'cartao',prov:'pos-manual',saleNo:'L0-501',vendedor:{email:'loja@eterna.photo',nome:'Atendimento e venda'},estado:'aguardando'});
    S.caixaDin.unshift({id:'L00-v83m0000aaa2',card:'LPV83M2',codigo:'MMMM-2222',criada:h,total:250,prints:0,n:9,cart:[],selected:[],aiSel:[],meio:'pix',prov:'pos-manual',saleNo:'L0-502',vendedor:{email:'loja@eterna.photo',nome:'Atendimento e venda'},estado:'cancelada'});
    S.caixaDin.unshift({id:'L00-v83m0000aaa3',card:'LPV83M3',codigo:'MMMM-3333',criada:h,total:777,prints:0,n:9,cart:[],selected:[],aiSel:[],meio:'pix',prov:'pos-manual',saleNo:'L0-503',vendedor:{email:'outra@eterna.photo',nome:'Outra'},estado:'aguardando'});
    S.stock['Caixa 1']=200;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));history.replaceState(null,'','#');localStorage.removeItem('eterna.view');localStorage.removeItem('eterna.session');});
  await A.reload();await A.waitForTimeout(400);ok(await entrar(A,'loja@eterna.photo'),'34: Atendimento e venda não entrou');
  const v34=await A.evaluate(()=>({v:ETERNA.state.view,mv:(document.querySelector('#minhas-vendas')||{}).innerText||'',head:(document.querySelector('.posto-head')||{}).innerText||''}));
  ok(v34.v==='posto','34: Atendimento e venda começa no Posto de venda: '+v34.v);
  ok(/L0-501/.test(v34.mv)&&/R\$\s190/.test(v34.mv)&&/R\$\s250/.test(v34.mv)&&!/L0-503|777/.test(v34.mv),'34: minhas vendas com o valor de cada uma, sem as de outro vendedor: '+v34.mv.slice(0,300));
  ok(!/total|ticket|soma/i.test(v34.mv+v34.head),'34: nenhuma soma, ticket ou "Total": '+v34.mv.slice(0,300));
  await A.screenshot({path:`${P}/v83-posto-atendimento.png`,fullPage:true});
  await ctx.close();
}catch(e){fails.push('exceção: '+String(e.stack||e).split('\n').slice(0,3).join(' / ').slice(0,500));}
await b.close();try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}
const okk=!fails.length&&!errs.length;console.log(`${okk?'OK':'FALHA'} v83: critérios 14 a 26 e 34, fila local, alertas locais, IA impressa com fundo de 5000 px${fails.length?' · '+fails.slice(0,12).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,4).join(' | '):''}`);process.exit(okk?0:1);})();
