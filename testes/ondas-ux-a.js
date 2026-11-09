// v94-ux parte A (G1): fontes da marca locais (critérios A1 a A5 do plano docs/planos/2026-11-09-ondas-ux.md).
// A rede externa das fontes do Google fica bloqueada; as fontes precisam vir de vendor/fonts/.
const {chromium}=require('playwright');const {spawn}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RAIZ=path.join(__dirname,'..');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(400);}
const fontesOk=pg=>pg.evaluate(async()=>{await document.fonts.load('800 40px "Big Shoulders Display"');await document.fonts.load('400 16px Inter');await document.fonts.ready;
  const h=document.querySelector('h1');return {bsd:document.fonts.check('800 40px "Big Shoulders Display"'),inter:document.fonts.check('400 16px Inter'),h1:h?getComputedStyle(h).fontFamily:''};});
(async()=>{
const b=await chromium.launch();const errs=[];let ag=null;const H=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-a-'));
try{
  // A4: arquivos
  const D=path.join(RAIZ,'vendor','fonts');const ws=['big-shoulders-display-latin-600-normal','big-shoulders-display-latin-700-normal','big-shoulders-display-latin-800-normal','inter-latin-400-normal','inter-latin-500-normal','inter-latin-600-normal','inter-latin-700-normal'].map(n=>n+'.woff2');
  ok(ws.every(f=>fs.existsSync(path.join(D,f))),'A4: faltam .woff2 em vendor/fonts');
  ok(fs.existsSync(path.join(D,'LICENSE'))&&/Open Font License/.test(fs.readFileSync(path.join(D,'LICENSE'),'utf8'))&&fs.existsSync(path.join(D,'LICENSE-NOTE.md')),'A4: LICENSE (OFL) e LICENSE-NOTE.md');
  const soma=ws.reduce((s,f)=>s+(fs.existsSync(path.join(D,f))?fs.statSync(path.join(D,f)).size:0),0);ok(soma<200*1024,'A4: soma dos .woff2 abaixo de 200 KB: '+soma);
  const html=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');
  ok(!/Cormorant|Barlow/.test(html),'A: ainda há Cormorant ou Barlow no index.html');
  ok((html.match(/@font-face\{/g)||[]).length===7,'A: 7 @font-face');
  // A1, A2: rede das fontes do Google bloqueada e contada
  const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});let ext=[];
  await ctx.route(/fonts\.g[a-z]*\.com/,r=>{ext.push(r.request().url());r.abort();});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');await pg.waitForTimeout(900);
  let f=await fontesOk(pg);ok(f.bsd&&f.inter,'A1: fontes no #loja '+JSON.stringify(f));
  const ljh=await pg.evaluate(()=>{const e=document.querySelector('.lj-h1,.lj-h2');return e?getComputedStyle(e).fontFamily:'';});ok(/^"?Big Shoulders Display/.test(ljh),'A1: título do Checkout em Big Shoulders: '+ljh);
  ok(ext.length===0,'A2: requisição externa de fonte no #loja: '+ext.join(' '));
  await pg.goto('about:blank');await pg.goto(U);await pg.waitForTimeout(500);
  await pg.evaluate(()=>{try{sessionStorage.removeItem('eterna.lojaTab')}catch(e){}});await pg.goto(U);await pg.waitForTimeout(400);
  if(!(await pg.evaluate(()=>!!ETERNA.state.user)))await entrar(pg,'eduardo@eduardorezende.com');
  await pg.evaluate(()=>ETERNA.go('painel'));await pg.waitForTimeout(500);
  f=await fontesOk(pg);ok(f.bsd&&f.inter&&/^"?Big Shoulders Display/.test(f.h1),'A1: fontes no Painel e h1 em Big Shoulders '+JSON.stringify(f));
  ok(ext.length===0,'A2: requisição externa de fonte no Painel: '+ext.join(' '));
  await pg.goto(U+'#g/abcdefghijklmnop');await pg.waitForTimeout(800);ok(ext.length===0,'A2: requisição externa de fonte no #g: '+ext.join(' '));
  // A3: Lollapalooza carrega o Archivo Black do Google só com a marca ativa
  await pg.goto(U);await pg.waitForTimeout(500);await pg.evaluate(()=>ETERNA.go('identidade'));await pg.waitForTimeout(300);
  const temLolla=await pg.$('[data-act="venue-pick"][data-id="lolla"]');ok(!!temLolla,'A3: botão Lollapalooza na Identidade');
  if(temLolla){await temLolla.click();await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>{const l=document.getElementById('font-lolla');return !!l&&/Archivo\+Black/.test(l.href);}),'A3: <link id="font-lolla"> com a marca Lollapalooza');
    await pg.click('[data-act="venue-pick"][data-id="maracana"]');await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>!document.getElementById('font-lolla')),'A3: o link some ao voltar para Maracanã');}
  ext=[];await pg.goto(U+'#loja');await pg.waitForTimeout(600);ok(ext.length===0,'A2: depois de voltar ao Maracanã, nenhuma fonte externa: '+ext.join(' '));
  await ctx.close();
  // A5: o agente serve a fonte pelo proxy do app
  const P=8000+Math.floor(Math.random()*500)+300,FP=P+1;
  ag=spawn('python3',[path.join(RAIZ,'agente','eterna-agente.py')],{env:{...process.env,HOME:H,ETERNA_PORTA:String(P),ETERNA_FTP_PORTA:String(FP),ETERNA_APP_ORIGIN:ORIG,ETERNA_SEM_OPENCV:'1',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'},stdio:['ignore','pipe','pipe']});
  let log='';ag.stdout.on('data',d=>log+=d);ag.stderr.on('data',d=>log+=d);
  const get=p=>new Promise(res=>{const r=http.get({host:'127.0.0.1',port:P,path:p},rs=>{const c=[];rs.on('data',x=>c.push(x));rs.on('end',()=>res({s:rs.statusCode,h:rs.headers,b:Buffer.concat(c)}));});r.on('error',()=>res({s:0,h:{},b:Buffer.alloc(0)}));});
  let r={s:0};for(let i=0;i<40&&r.s===0;i++){await sleep(300);r=await get('/status');}
  r=await get('/vendor/fonts/inter-latin-400-normal.woff2');
  ok(r.s===200&&/font\/woff2/.test(r.h['content-type']||'')&&r.b.length===fs.statSync(path.join(D,'inter-latin-400-normal.woff2')).size,'A5: agente serve a fonte: '+r.s+' '+r.h['content-type']+' '+r.b.length+(r.s!==200?' '+log.slice(-300):''));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{if(ag)ag.kill();await b.close();try{fs.rmSync(H,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-a: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-a: fontes locais (A1 a A5)');process.exit(0);
})();
