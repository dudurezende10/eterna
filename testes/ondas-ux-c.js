// v94-ux parte C: sem conexão nunca verde (critérios C1 a C4 do plano docs/planos/2026-11-09-ondas-ux.md).
// Agente falso por page.route num endereço diferente da página (como o app aberto pelo eterna.photo falando com 127.0.0.1:8765).
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const AG='http://127.0.0.1:8899';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
let modo='off';
const feed=()=>({ok:true,agora:Date.now()/1000,grupos:[{id:'LPK7Q2M9X',estado:'pronta',fotografo:'carlos',fonte:'ftp',inicio:Date.now()/1000-200,ultima_chegada:Date.now()/1000-100,pronta_em:Date.now()/1000-60,n:6,pids:[]}]});
async function agente(ctx){
  await ctx.route(AG+'/**',r=>r.abort()); // o resto do agente fica fora (registrada antes: as rotas de baixo vencem)
  const resp=(r,body)=>modo==='ok'?r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)}):r.abort();
  await ctx.route(AG+'/status',r=>resp(r,{ok:true,agent:'eterna-agente',version:3,boot:'bc',card:null,copied:0,dups:0,events:0,ftp:null}));
  await ctx.route(AG+'/events*',r=>resp(r,{events:[],next:0,total:0}));
  await ctx.route(AG+'/biblioteca',r=>resp(r,{fotos:[]}));
  await ctx.route(AG+'/fila-fotografo',r=>resp(r,feed()));
  await ctx.route(AG+'/impressao/fila',r=>resp(r,{ok:true,agora:Date.now()/1000,pedidos:[],impressoras:['DNP 1'],estados:{'DNP 1':{estado:'livre'}}}));
}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(300);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(400);}
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||6000)){if(await pg.evaluate(fn))return Date.now()-t0;await pg.waitForTimeout(150);}return -1;};
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await agente(ctx);
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},AG);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>localStorage.removeItem('eterna.demo.v1'));
  await entrar(pg,'eduardo@eduardorezende.com');
  // C1: Fila do fotógrafo com o agente fora
  modo='off';await pg.evaluate(()=>ETERNA.go('fotofila'));
  ok(await espera(pg,()=>!!document.querySelector('.conn-off'))>=0,'C1: faixa vermelha na Fila do fotógrafo sem agente');
  let st=await pg.evaluate(()=>({good:document.querySelectorAll('.if-head .pill.good').length,txt:(document.querySelector('.conn-off')||{}).textContent||'',note:document.querySelectorAll('#main .note[role="alert"]').length}));
  ok(st.good===0&&/Sem conexão com o computador do ponto/.test(st.txt)&&!/último dado/.test(st.txt)&&st.note===0,'C1: sem pill good, com faixa: '+JSON.stringify(st));
  // sucesso e queda: "último dado às HH:MM"
  modo='ok';ok(await espera(pg,()=>!document.querySelector('.conn-off'))>=0,'C3: faixa some quando o agente volta');
  ok(await pg.evaluate(()=>document.querySelectorAll('.ff-card').length===1),'C1: cartão com o dado do agente');
  // C3: o agentPoll continua tentando fora do Upload (agente em outro endereço, como pelo eterna.photo)
  ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.lastOk>0,6000)>=0,'C3: agentPoll conecta fora do Upload: '+JSON.stringify(await pg.evaluate(()=>({on:ETERNA.state.agent.on,url:ETERNA.state.agent.url,view:ETERNA.state.view}))));
  modo='off';ok(await espera(pg,()=>!!document.querySelector('.conn-off'))>=0,'C1: faixa volta na queda');
  st=await pg.evaluate(()=>({good:document.querySelectorAll('.if-head .pill.good').length,txt:document.querySelector('.conn-off').textContent,cards:document.querySelectorAll('.ff-card').length}));
  ok(st.good===0&&/Sem conexão com o computador do ponto · último dado às \d\d:\d\d/.test(st.txt)&&st.cards===1,'C1: último dado às HH:MM e colunas com o último dado: '+JSON.stringify(st));
  // C3: volta em até 4 s sem recarregar
  modo='ok';const ms=await espera(pg,()=>!document.querySelector('.conn-off'),4000);ok(ms>=0,'C3: a faixa some em até 4 s');
  // C2: Fila de impressão
  modo='off';await pg.evaluate(()=>ETERNA.go('impfila'));
  ok(await espera(pg,()=>!!document.querySelector('.conn-off'))>=0,'C2: faixa na Fila de impressão');
  st=await pg.evaluate(()=>({txt:document.querySelector('#main').textContent,off:(document.querySelector('.conn-off')||{}).textContent||'',good:document.querySelectorAll('#main .pill.good').length}));
  ok(!/Tudo impresso/.test(st.txt)&&/Sem conexão com o servidor de impressão/.test(st.off)&&st.good===0,'C2: sem "Tudo impresso" e sem verde: '+JSON.stringify({off:st.off,good:st.good}));
  modo='ok';ok(await espera(pg,()=>!document.querySelector('.conn-off')&&/Tudo impresso/.test(document.querySelector('#main').textContent),4000)>=0,'C3: Fila de impressão volta em até 4 s');
  // C4: demonstração sem agente: faixa cinza, não a vermelha
  modo='off';await pg.evaluate(()=>{localStorage.setItem('eterna.demo.v1','1');ETERNA.go('fotofila');});
  ok(await espera(pg,()=>!!document.querySelector('.conn-demo'))>=0,'C4: faixa cinza na demonstração');
  ok(!(await pg.$('.conn-off')),'C4: sem faixa vermelha na demonstração');
  await pg.evaluate(()=>localStorage.removeItem('eterna.demo.v1'));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-c: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-c: sem conexão nunca verde (C1 a C4)');process.exit(0);
})();
