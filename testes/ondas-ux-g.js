// v94-ux parte G: Checkout do cliente, campo do código, pacotes, espera e tela final (critérios G1 a G6 do plano
// docs/planos/2026-11-09-ondas-ux.md). Sem agente: /file/ e /thumb/ pelo page.route; fotos de exemplo do app.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-g-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,900),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);const IMG=fs.readFileSync(TMP+'/a.jpg');
// contraste WCAG entre duas cores rgb(a) já misturadas sobre o fundo
const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]);};
const rgb=s=>{const m=String(s).match(/[\d.]+/g).map(Number);return {c:m.slice(0,3),a:m.length>3?m[3]:1};};
const mix=(fg,bg)=>fg.c.map((v,i)=>v*fg.a+bg.c[i]*(1-fg.a));
const contraste=(fg,bg)=>{const a=lum(mix(rgb(fg),rgb(bg))),b=lum(rgb(bg).c);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(450);}
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;ETERNA.lojaReset();ETERNA.render();});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(400);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.state.kiosk.step='cart';ETERNA.render();},[card,n]);await L.waitForTimeout(250);}
const pendDe=(pg,card)=>pg.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&(x.estado==='aguardando'||x.estado==='escolha')),card);
const semRolagem=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1920,height:1080}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  await entrar(A,'eduardo@eduardorezende.com');
  const L=await ctx.newPage();L.on('pageerror',e=>errs.push('L: '+e.message));await L.goto(U+'#loja');await L.waitForTimeout(900);await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=8).map(s=>s.card));ok(cards.length>=6,'poucas sessões: '+cards.length);
  // ---- G1: campo do código
  await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(200);
  const g1=await L.evaluate(()=>{const e=document.querySelector('#kcode');const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();const cs=getComputedStyle(e),ph=getComputedStyle(e,'::placeholder');
    return {w:r.width,fs:parseFloat(cs.fontSize),dif:Math.abs((r.left-p.left)-(p.right-r.right)),cor:cs.color,fundo:cs.backgroundColor,ph:ph.color,attrs:['placeholder','autocomplete','autocapitalize','spellcheck','maxlength','inputmode'].map(a=>e.getAttribute(a))};});
  const c1=contraste(g1.cor,g1.fundo),c2=contraste(g1.ph,g1.fundo);
  ok(g1.w>=420&&g1.w<=520&&g1.fs===32&&g1.dif<4,'G1: largura, fonte e centro do campo: '+J(g1));
  ok(c1>=4.5&&c2>=4.5,'G1: contraste do texto e do placeholder: '+J({c1,c2,g1}));
  ok(J(g1.attrs)===J(['XXXX-XXXX','off','characters','false','14','text']),'G1: atributos do campo: '+J(g1.attrs));
  // v96-ux: G2 a G5 (pacotes, espera com "Cancelar o pedido?", tela final com "Novo cliente") saíram: no Checkout vale a v96 (testes/checkout-tela-cheia.js)
  // ---- G6: 390×844 (v96-ux: tela Pronto da v96 no lugar da espera das ondas; a tela final é a da v96)
  await L.setViewportSize({width:390,height:844});await L.waitForTimeout(200);
  await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(150);ok(await semRolagem(L),'G6: campo sem rolagem lateral em 390');
  await ljSessao(L,cards[5],3);await L.evaluate(()=>ETERNA.lojaPedir());await L.waitForTimeout(500);ok(await semRolagem(L),'G6: tela Pronto sem rolagem lateral em 390');
  const p5=await pendDe(L,cards[5]);ok(!!p5,'G6: pedido do Checkout no Posto');
  if(p5){await A.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'dinheiro'});},p5.id);await L.waitForTimeout(600);
    ok(await semRolagem(L),'G6: tela do valor sem rolagem lateral em 390');
    await A.evaluate(id=>ETERNA.pendConfirmar(id,{}),p5.id);
    const t1=Date.now();while(Date.now()-t1<3000&&!(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img'))))await sleep(150);await L.waitForTimeout(300);
    ok(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img')),'G6: tela final com o QR');ok(await semRolagem(L),'G6: tela final em 390 sem rolagem lateral');}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-g: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-g: Checkout do cliente (G1 e G6; G2 a G5 cobertos pela v96)');process.exit(0);
})();
