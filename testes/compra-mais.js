// Comprar mais fotos: cliente que já pagou compra de novo na mesma sessão. Venda nova, só fotos ainda não compradas, preço de Foto adicional e tempos no pedido.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-mais-'));
execFileSync('python3',['-c',`from PIL import Image;import sys;Image.new('RGB',(1000,1500),(200,120,40)).save(sys.argv[1]+'/p.jpg',quality=80)`,TMP]);const IMG=fs.readFileSync(TMP+'/p.jpg');
const CARD='LPTESTE01';const IDS=['ag_a1','ag_a2','ag_a3','ag_a4','ag_a5'];
const vigia=(pg,n)=>{pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(`${n}: ${e.message}`));return pg;};
const sim=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')));
async function escolhe(L,ids){await L.evaluate(ids=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);Object.keys(pk).forEach(x=>delete pk[x]);ids.forEach(i=>pk[i]='ok');k.pkg=null;k.pay=null;k.step='cart';ETERNA.render();},ids);await L.waitForTimeout(200);}
async function paga(A,L,card){await L.click('[data-act="loja-paym"][data-m="card"]');await L.waitForTimeout(120);await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(500);
  const p=(await sim(L)).caixaDin.find(x=>x.card===card&&x.estado==='aguardando');ok(p,'pedido de '+card);if(!p)return null;
  await A.click(`[data-act="pend-pos"][data-id="${p.id}"]`);await A.waitForTimeout(150);if(await A.$('#pend-ref'))await A.fill('#pend-ref','123456');await A.click(`[data-act="pend-pos-ok"][data-id="${p.id}"]`);
  await L.waitForSelector('#lqr',{timeout:5000}).catch(()=>null);return p;}
(async()=>{const b=await chromium.launch();try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  for(const r of ['/file/**','/thumb/**'])await ctx.route(ORIG+r,q=>q.fulfill({status:200,contentType:'image/jpeg',body:IMG}));
  const A=vigia(await ctx.newPage(),'A');await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(500);
  await entrarTeste(A,'eduardo@eduardorezende.com');
  const [L]=await Promise.all([ctx.waitForEvent('page'),A.click('#rail-ck [data-act="loja-abrir"]')]);vigia(L,'L');await L.waitForLoadState();await L.waitForTimeout(800);
  const carrega=(pg)=>pg.evaluate(([card,ids])=>{ids.forEach(id=>{ETERNA.UP[id]={src:location.origin+'/thumb/'+id.slice(3),name:id};});},[CARD,IDS]);
  await carrega(A);await carrega(L);
  await L.evaluate(([card,ids])=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;const S=ETERNA.SIM;S.sessions[card]={key:'carlos',pdv:'Foto Campo 2',time:'10:00',date:'hoje',status:'fechada',selected:[],bg:null,cart:[],photos:ids.map(id=>({id,sold:0}))};localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.state.kiosk.step='code';ETERNA.render();},[CARD,IDS]);
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',CARD);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(400);
  // primeira compra: 2 fotos com pacote
  await escolhe(L,IDS.slice(0,2));ok(await L.$('.lj-pkgs'),'primeira compra mostra os pacotes');
  const p1=await paga(A,L,CARD);const s1=await sim(L);ok(s1.sessions[CARD].status==='paga','primeira venda paga');
  ok(p1&&p1.tempos&&p1.tempos.inicio&&p1.tempos.escolha,'pedido leva os tempos: '+J(p1&&p1.tempos));
  ok(await L.$('[data-act="loja-mais"]'),'tela final com Comprar mais fotos');
  // segunda compra: só as 3 que faltam, sem pacote, preço de Foto adicional
  await L.click('[data-act="loja-mais"]');await L.waitForTimeout(300);
  const m=await L.evaluate(()=>{const k=ETERNA.state.kiosk;return {code:k.code,step:k.step,itens:ETERNA.lojaItems(k.code).filter(x=>x.t==='ph').map(x=>x.id)};});
  ok(m.code===CARD+'M2','sessão da compra extra: '+m.code);ok(J(m.itens)===J(IDS.slice(2)),'só as fotos não compradas: '+J(m.itens));
  await escolhe(L,[IDS[2]]);ok(!(await L.$('.lj-pkgs')),'compra extra não pede pacote');
  const c2=await L.evaluate(()=>{const k=ETERNA.state.kiosk;const c=ETERNA.lojaCart(k.code);return {pkg:c.pkg,extra:c.extra,prints:c.prints,total:c.total,preco:ETERNA.priceOf('extra')};});
  ok(c2.pkg===null&&c2.extra===1&&c2.prints===1&&c2.total===c2.preco,'preço da compra extra: '+J(c2));
  const p2=await paga(A,L,m.code);const s2=await sim(L);const v1=s2.sessions[CARD],v2=s2.sessions[m.code];
  ok(v2&&v2.status==='paga'&&J(v2.selected)===J([IDS[2]])&&v2.pai===CARD,'segunda venda: '+J(v2&&{st:v2.status,sel:v2.selected,pai:v2.pai}));
  ok(v1.status==='paga'&&J(v1.selected)===J(IDS.slice(0,2)),'primeira venda não muda: '+J(v1.selected));
  ok(v1.saleNo&&v2.saleNo&&v1.saleNo!==v2.saleNo&&v1.vendaId!==v2.vendaId,'número próprio: '+J([v1.saleNo,v2.saleNo]));
  ok(v2.impressao&&v2.impressao.estado==='pendente','impressão própria: '+J(v2.impressao));
  ok(p2&&p2.tempos&&p2.tempos.inicio,'compra extra leva os tempos');
  // terceira compra leva o resto; depois disso o botão some
  await L.click('[data-act="loja-mais"]');await L.waitForTimeout(300);const c3=await L.evaluate(()=>ETERNA.state.kiosk.code);ok(c3===CARD+'M3','terceira: '+c3);
  await escolhe(L,IDS.slice(3));await paga(A,L,c3);ok(!(await L.$('[data-act="loja-mais"]')),'tudo comprado: sem o botão');
  // nunca abre foto fora do que a selfie achou
  await L.evaluate(([card,ids])=>{const k=ETERNA.state.kiosk;k.code=card;k.so={card,cards:[card],ids:ids.slice(0,1)};},[CARD,IDS]);
  ok((await L.evaluate(()=>ETERNA.lojaMaisIds())).length===0,'selfie: só as fotos dela');
  if(errs.length)fails.push('erros: '+errs.join(' | ').slice(0,400));
}catch(e){fails.push('exceção: '+e.message.slice(0,300));}await b.close();
if(fails.length){console.log('FALHA compra-mais: '+fails.join(' · '));process.exit(1);}console.log('OK compra-mais: segunda venda na mesma sessão, só fotos novas, preço de adicional, tempos e botão some');})();
