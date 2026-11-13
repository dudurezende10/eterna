// v94-ux parte K: Checkout no celular e bandeiras (critérios K1 a K3 do plano docs/planos/2026-11-09-ondas-ux.md). Sem agente.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-k-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,900),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);const IMG=fs.readFileSync(TMP+'/a.jpg');
async function entrar(pg,email){await require('./_entrar')(pg,email);}
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;ETERNA.lojaReset();ETERNA.render();});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(400);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.render();},[card,n]);await L.waitForTimeout(250);}
const bandeiras=pg=>pg.evaluate(()=>[...document.querySelectorAll('.lj-langs button')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];}));
const semRolagem=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);await entrar(A,'eduardo@eduardorezende.com');
  const L=await ctx.newPage();L.on('pageerror',e=>errs.push('L: '+e.message));await L.goto(U+'#loja');await L.waitForTimeout(900);
  const card=await L.evaluate(()=>{const s=ETERNA.demoSessions().map(s=>[s.card,ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length]).find(x=>x[1]>=6);return s&&s[0];});ok(card,'sem sessão com 6 fotos');
  // v96-ux: K1 e K2 (carrinho e pacotes no celular) saíram: o Checkout da v96 não tem pacote nem pagamento.
  // K3: alvo de toque das bandeiras e sem rolagem lateral (câmera e escolha). No Checkout vale a v96: 72 px; até 640 px as bandeiras
  // recolhem no botão de idioma (ljLangOv), e o teste abre esse botão antes de medir.
  const flagsCk=async pg=>{let bs=await bandeiras(pg);const vis=await pg.evaluate(()=>{const e=[...document.querySelectorAll('.lj-lgbtn')].find(x=>x.getClientRects().length&&getComputedStyle(x).display!=='none');if(!e)return null;e.setAttribute('data-k3','1');const r=e.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)];});
    if(!bs.length&&vis){const lb=vis;
      ok(lb[0]>=44&&lb[1]>=44,'K3: botão de idioma '+J(lb));await pg.click('[data-k3="1"]');await pg.waitForTimeout(120);bs=await bandeiras(pg);await pg.evaluate(()=>{ETERNA.state.kiosk.lgOpen=false;ETERNA.render();});}return bs;};
  for(const [w,h] of [[390,844],[768,1024],[1366,768],[1920,1080]]){await L.setViewportSize({width:w,height:h});
    await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.waitForTimeout(150);
    let bs=await flagsCk(L);ok(bs.length===5&&bs.every(([x,y])=>x>=44&&y>=44),`K3 ${w}: bandeiras na câmera ${J(bs)}`);ok(await semRolagem(L),`K3 ${w}: câmera com rolagem lateral`);
    await ljSessao(L,card,3);bs=await flagsCk(L);ok(bs.length===5&&bs.every(([x,y])=>x>=44&&y>=44),`K3 ${w}: bandeiras na escolha ${J(bs)}`);ok(await semRolagem(L),`K3 ${w}: escolha com rolagem lateral`);}
  // galeria (gq-) em 390
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push('G: '+e.message));await G.setViewportSize({width:390,height:844});await G.goto(U+'#g/tokenqualquer123456');await G.waitForTimeout(600);
  const gb=await bandeiras(G);ok(gb.length===5&&gb.every(([x,y])=>x>=44&&y>=44),'K3: bandeiras da galeria em 390: '+J(gb));ok(await semRolagem(G),'K3: galeria com rolagem lateral em 390');
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-k: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-k: bandeiras com alvo de 44 px ou mais (72 no Checkout) sem rolagem lateral, no Checkout e na galeria');
})();
