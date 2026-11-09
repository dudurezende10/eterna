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
async function ljPagar(L,m){await L.click(`[data-act="loja-paym"][data-m="${m}"]`);await L.waitForTimeout(120);await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(500);}
const pendDe=(pg,card)=>pg.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&x.estado==='aguardando'),card);
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
  // ---- G2: 6 pacotes em 2 fileiras em 1920×1080 com 6 fotos
  await ljSessao(L,cards[0],6);
  const g2=await L.evaluate(()=>{const ps=[...document.querySelectorAll('.lj-pkg')];const tops=[...new Set(ps.map(p=>Math.round(p.getBoundingClientRect().top)))];const fs=s=>Math.min(...[...document.querySelectorAll(s)].map(e=>parseFloat(getComputedStyle(e).fontSize)));
    return {n:ps.length,filas:tops.length,num:fs('.lj-pkgn'),preco:fs('.lj-pkgp'),desc:Math.min(fs('.lj-pkgd b'),fs('.lj-pkgd small')),alt:document.querySelector('.lj-co').getBoundingClientRect().height/innerHeight};});
  ok(g2.n===6&&g2.filas===2&&g2.num>=48&&g2.preco>=32&&g2.desc>=16&&g2.alt>0.7,'G2: pacotes no monitor: '+J(g2));
  // ---- G3: espera do pagamento (Cartão, PIX e Dinheiro)
  for(const [i,m] of [[1,'card'],[2,'pix'],[3,'cash']]){await ljSessao(L,cards[i],4);await ljPagar(L,m);const p=await pendDe(L,cards[i]);
    const g3=await L.evaluate(()=>{const c=document.querySelector('.lj-waitcode');return {step:ETERNA.state.kiosk.step,wait:!!(ETERNA.state.kiosk.paid||{}).wait,cta:document.querySelectorAll('.lj-cta').length,fs:c?parseFloat(getComputedStyle(c).fontSize):0,cod:c?c.textContent:'',t:document.querySelector('#main').innerText};});
    ok(g3.step==='done'&&g3.wait&&g3.cta===0&&g3.fs>=56&&g3.cod===p.codigo&&/Mostre este código ao atendente/.test(g3.t)&&/SEU CÓDIGO|Seu código/.test(g3.t),'G3 '+m+': espera sem botão amarelo e com o código grande: '+J({...g3,t:g3.t.slice(0,160)}));
    await L.click('.lj-ic[data-act="loja-sair-ask"]');await L.waitForTimeout(150);
    const mx=await L.evaluate(()=>{const x=document.querySelector('.lj-mx');return x?x.innerText:'';});ok(/Cancelar o pedido\?/i.test(mx)&&/Se você já pagou, chame o atendente antes de sair\./.test(mx),'G3 '+m+': a casa abre "Cancelar o pedido?": '+mx);
    if(i===1){await L.click('[data-act="loja-sair-no"]');await L.waitForTimeout(150);
      ok(await L.evaluate(()=>!document.querySelector('.lj-mx')&&ETERNA.state.kiosk.step==='done'&&ETERNA.state.kiosk.paid.wait),'G3: "Não, continuar aqui" fecha e mantém a espera');
      await L.click('.lj-ic[data-act="loja-sair-ask"]');await L.waitForTimeout(150);}
    await L.click('.lj-mx [data-act="loja-new"]');await L.waitForTimeout(200);
    ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'),'G3 '+m+': "Sim, sair" volta à câmera');
    ok((await pendDe(A,cards[i]))&&(await pendDe(A,cards[i])).id===p.id,'G3 '+m+': a pendência continua aguardando no Posto');}
  // ---- G4 e G5: tela final em 1920×1080
  await ljSessao(L,cards[4],4);await ljPagar(L,'card');const p4=await pendDe(L,cards[4]);
  await A.evaluate(id=>ETERNA.pendConfirmar(id,{ref:''}),p4.id);
  const t0=Date.now();while(Date.now()-t0<3000&&!(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img'))))await sleep(150);
  await L.waitForTimeout(300);
  const g4=await L.evaluate(()=>{const q=document.querySelector('#lqr');const r=q.getBoundingClientRect();const card=q.closest('.lj-qrcard');const k=ETERNA.state.kiosk;
    return {w:r.width,h:r.height,title:q.title,tok:k.paid&&k.paid.token,foto:!!(card&&card.querySelector('.lj-qrfoto')),cta:document.querySelectorAll('.lj-cta').length,ic:(()=>{const i=document.querySelector('.lj-dlic');if(!i)return null;const s=getComputedStyle(i);return {w:i.getBoundingClientRect().width,bg:s.backgroundColor};})()};});
  ok(g4.w>=320&&g4.w<=400&&Math.abs(g4.w-g4.h)<2,'G4: QR entre 320 e 400 px: '+J(g4));
  ok(g4.tok&&g4.title&&g4.title.endsWith('#g/'+g4.tok),'G4: o QR aponta para a galeria da venda: '+J({t:g4.title,tok:g4.tok}));
  ok(g4.foto,'G4: a foto escolhida no mesmo cartão do QR');
  ok(g4.ic&&Math.round(g4.ic.w)===32&&g4.ic.bg==='rgb(19, 64, 120)','G: ícone do celular em círculo azul de 32 px: '+J(g4.ic));
  const nv=await L.evaluate(()=>{const n=document.querySelector('.lj-novo');if(!n)return null;const r=n.getBoundingClientRect();return {h:r.height,fs:parseFloat(getComputedStyle(n).fontSize),t:n.textContent,dir:innerWidth-r.right,baixo:innerHeight-r.bottom};});
  ok(g4.cta===0&&nv&&nv.h>=44&&nv.fs<=16&&nv.t==='Novo cliente'&&nv.dir<60&&nv.baixo<60,'G5: "Novo cliente" pequeno no canto, sem botão amarelo: '+J({cta:g4.cta,nv}));
  ok(await L.evaluate(()=>!!document.querySelector('#lj-volta-n')),'G: a contagem continua');
  await L.click('.lj-novo');await L.waitForTimeout(200);ok(await L.evaluate(()=>ETERNA.state.kiosk.step==='code'),'G5: "Novo cliente" volta à câmera');
  // ---- G6: 390×844
  await L.setViewportSize({width:390,height:844});await L.waitForTimeout(200);
  await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(150);ok(await semRolagem(L),'G6: campo sem rolagem lateral em 390');
  await ljSessao(L,cards[5],3);await ljPagar(L,'cash');ok(await semRolagem(L),'G6: espera sem rolagem lateral em 390');
  const fsw=await L.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.lj-waitcode')).fontSize));ok(fsw>=36,'G6: código da espera legível em 390: '+fsw);
  const p5=await pendDe(L,cards[5]);await A.evaluate(id=>ETERNA.pendConfirmar(id,{}),p5.id);
  const t1=Date.now();while(Date.now()-t1<3000&&!(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img'))))await sleep(150);await L.waitForTimeout(300);
  const g6=await L.evaluate(()=>{const r=document.querySelector('#lqr').getBoundingClientRect();return {w:r.width,sw:document.documentElement.scrollWidth<=innerWidth+1};});
  ok(g6.sw&&g6.w>=240,'G6: tela final em 390 sem rolagem e QR ≥ 240: '+J(g6));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-g: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-g: Checkout do cliente (G1 a G6)');process.exit(0);
})();
