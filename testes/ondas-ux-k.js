// v94-ux parte K: Checkout no celular e bandeiras (critérios K1 a K3 do plano docs/planos/2026-11-09-ondas-ux.md). Sem agente.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-k-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,900),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);const IMG=fs.readFileSync(TMP+'/a.jpg');
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(450);}
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;ETERNA.lojaReset();ETERNA.render();});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(400);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.state.kiosk.ver=null;ETERNA.state.kiosk.step='cart';ETERNA.render();},[card,n]);await L.waitForTimeout(250);}
const bandeiras=pg=>pg.evaluate(()=>[...document.querySelectorAll('.lj-langs button')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}));
const semRolagem=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);await entrar(A,'eduardo@eduardorezende.com');
  const L=await ctx.newPage();L.on('pageerror',e=>errs.push('L: '+e.message));await L.goto(U+'#loja');await L.waitForTimeout(900);
  const card=await L.evaluate(()=>{const s=ETERNA.demoSessions().map(s=>[s.card,ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length]).find(x=>x[1]>=6);return s&&s[0];});ok(card,'sem sessão com 6 fotos');
  // K1: ordem no celular
  await ljSessao(L,card,4);await L.click('[data-act="loja-paym"][data-m="pix"]');await L.waitForTimeout(150);
  const k1=await L.evaluate(()=>{const y=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().top+scrollY+(e.closest('.lj')?e.closest('.lj').scrollTop:0)):null;};return {pkg:y('.lj-pkg'),pay:y('.lj-pay'),total:y('.lj-total'),btn:y('.lj-paybtn'),incl:y('.lj-incl'),minis:y('.lj-minis')};});
  ok(k1.pkg<k1.pay&&k1.pay<k1.total&&k1.total<k1.btn&&k1.btn<k1.incl&&k1.minis<k1.pkg,'K1: ordem no celular (fotos, pacote, pagamento, total, botão, o que inclui): '+J(k1));
  ok(await semRolagem(L),'K3: carrinho com rolagem lateral em 390');
  // K2: "Todas as N fotos" nas 5 línguas
  const nSes=await L.evaluate(c=>ETERNA.lojaCart(c).nSes,card);
  const esp={pt:`Todas as ${nSes} fotos`,en:`All ${nSes} photos`,es:`Las ${nSes} fotos`,fr:`Les ${nSes} photos`,de:`Alle ${nSes} Fotos`};
  for(const [lg,t] of Object.entries(esp)){await L.click(`.lj-langs [data-l="${lg}"]`);await L.waitForTimeout(120);
    const r=await L.evaluate(()=>{const q=document.querySelector('.lj-pkg[data-id="mais"]');return {b:q.querySelector('.lj-pkgd b').textContent,n:q.querySelector('.lj-pkgn').textContent};});
    ok(r.b===t&&r.n===String(nSes),'K2 '+lg+': '+J(r)+' esperado '+t);}
  await L.click('.lj-langs [data-l="pt"]');await L.waitForTimeout(100);
  await L.click('.lj-pkg[data-id="mais"]');await L.waitForTimeout(150);
  ok(await L.evaluate(n=>[...document.querySelectorAll('.lj-sumrow')].some(r=>r.textContent.includes(`Todas as ${n} fotos`)),nSes),'K2: resumo com "Todas as N fotos"');
  ok(!(await L.evaluate(()=>/Todas as fotos do tour/.test(document.querySelector('#main').innerText))),'K2: ainda aparece "Todas as fotos do tour"');
  // K3: bandeiras 44×44 e sem rolagem em 390, 768, 1366, 1920 (câmera, carrinho e galeria)
  for(const [w,h] of [[390,844],[768,1024],[1366,768],[1920,1080]]){await L.setViewportSize({width:w,height:h});
    await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.waitForTimeout(150);
    let bs=await bandeiras(L);ok(bs.length===5&&bs.every(([x,y])=>x>=44&&y>=44),`K3 ${w}: bandeiras na câmera ${J(bs)}`);ok(await semRolagem(L),`K3 ${w}: câmera com rolagem lateral`);
    await ljSessao(L,card,3);bs=await bandeiras(L);ok(bs.length===5&&bs.every(([x,y])=>x>=44&&y>=44),`K3 ${w}: bandeiras no carrinho ${J(bs)}`);ok(await semRolagem(L),`K3 ${w}: carrinho com rolagem lateral`);
    if(w===390){const lin=await L.evaluate(()=>{const l=document.querySelector('.lj-top .lj-langs').getBoundingClientRect(),g=document.querySelector('.lj-top .lj-logo').getBoundingClientRect();return {l:l.top,g:g.bottom,cx:Math.abs((l.left+l.right)/2-innerWidth/2)};});ok(lin.l>=lin.g-1&&lin.cx<8,'K3: em 390 o idioma tem linha própria, centrada: '+J(lin));}}
  // galeria (gq-) em 390
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push('G: '+e.message));await G.setViewportSize({width:390,height:844});await G.goto(U+'#g/tokenqualquer123456');await G.waitForTimeout(600);
  const gb=await bandeiras(G);ok(gb.length===5&&gb.every(([x,y])=>x>=44&&y>=44),'K3: bandeiras da galeria em 390: '+J(gb));ok(await semRolagem(G),'K3: galeria com rolagem lateral em 390');
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-k: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-k: carrinho no celular na ordem certa, "Todas as N fotos" nas 5 línguas, bandeiras de 44 px sem rolagem lateral');
})();
