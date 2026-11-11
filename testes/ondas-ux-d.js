// v94-ux parte D: Minhas fotos (critérios D1 a D7 do plano docs/planos/2026-11-09-ondas-ux.md).
// Agente falso por page.route na própria origem (/status, /events, /biblioteca, /sessoes, /thumb/); miniaturas sintéticas.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const FEED={rev:1,sessoes:[]};
const pids=(a,n)=>Array.from({length:n},(_,i)=>(0xabc000000000+a+i).toString(16));
async function agente(ctx){
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,agent:'eterna-agente',version:3,boot:'bd',card:null,copied:3,dups:1,events:0,
    ftp:{ip:'192.168.0.10',port:2121,users:['carlos','samuel'],received:9,last_user:'carlos'},rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:FEED.rev,gen:'gD',hoje:FEED.sessoes.length,abertas:1}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"grupos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,gen:'gD',rev:FEED.rev,pausa:60,rostos:true,completo:true,sessoes:FEED.sessoes})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(300);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(400);}
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(200);}return false;};
const PROIB_D1=['Simular','Testar com fotos','Limpar esta leva','Cartão no computador do ponto','Wi‑Fi do estádio','5G','O que o fotógrafo vê','O que o servidor faz','Chegaram','Repetidas'];
// "Terminal Campo" é o nome de um ponto de foto (DATA.points), não o Terminal do computador: fica fora da regex do plano
const TEC=/127\.0\.0\.1|8765|porta|python|Terminal(?! Campo)|~\/Eterna|\.py\b|FTP/i;
(async()=>{
const b=await chromium.launch();const errs=[];
const nova=async()=>{const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};};
try{
  // D1, D2, D3: Carlos sem agente
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.evaluate(()=>localStorage.removeItem('eterna.demo.v1'));
    await entrar(pg,'carlos@eterna.photo');ok(await pg.evaluate(()=>ETERNA.state.view)==='importar','D: Carlos cai em Minhas fotos');
    await espera(pg,()=>ETERNA.state.agent.tried,6000);await pg.evaluate(()=>ETERNA.render());
    const m=await pg.textContent('#main');const vis=await pg.evaluate(()=>document.body.innerText);
    PROIB_D1.forEach(t=>ok(!m.includes(t),'D1: Carlos sem agente vê "'+t+'"'));
    ok(!TEC.test(vis),'D2: texto técnico sem agente: '+(vis.match(TEC)||[])[0]);
    const off=await pg.evaluate(()=>(document.querySelector('#main .conn-off')||{}).textContent||'');
    ok(/Sem conexão com o computador do ponto/.test(off)&&/Chame a TI/.test(off),'D3: faixa vermelha com Chame a TI: '+off);
    // D5: menu, h1
    const d5=await pg.evaluate(()=>({h1:document.querySelector('#main h1').textContent,nav:[...document.querySelectorAll('#nav [data-v="importar"]')].map(x=>x.textContent).join('|')}));
    ok(d5.h1==='Minhas fotos'&&/Minhas fotos/.test(d5.nav),'D5: menu e h1 "Minhas fotos": '+JSON.stringify(d5));
    ok(!/Upload automático/.test(vis),'D5: ainda aparece "Upload automático"');
    const eb=await pg.evaluate(()=>document.querySelector('#main .head .eyebrow').textContent);ok(eb==='Fotógrafo · Carlos','D: eyebrow sem o ponto para o próprio fotógrafo: '+eb);
    await pg.goto(U+'#painel');await pg.waitForTimeout(200);await pg.goto(U+'#importar');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>ETERNA.state.view)==='importar','D5: #importar abre a tela');
    await ctx.close();}
  // D2 com agente, D4: faixa amarela e depois verde
  {const {ctx,pg}=await nova();await agente(ctx);const a=Date.now()/1000;
    FEED.sessoes=[{card:'LPK7Q2M9X',dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'campo4',trilha:'vivo',atrasada:false,status:'aberta',motivo:'rostos_novos',aberta_em:a-40,ultima_chegada:a-2,cap0:a-45,cap1:a-3,fotos:pids(0,4),pend:pids(10,2),dec:{},removida:false,rev:1}];FEED.rev=1;
    await pg.goto(U);await pg.evaluate(()=>localStorage.removeItem('eterna.demo.v1'));await entrar(pg,'carlos@eterna.photo');
    ok(await espera(pg,()=>!!document.querySelector('.up-faixa.warn')),'D4: faixa amarela com sessão recebendo');
    const f=await pg.evaluate(()=>{const e=document.querySelector('.up-faixa.warn');const i=e&&e.querySelector('.up-barra i');return {t:e?e.textContent.trim():'',w:i?i.style.width:''};});
    ok(/Recebendo 4 de 6/.test(f.t)&&f.w==='67%','D4: "Recebendo 4 de 6" com barra em 67%: '+JSON.stringify(f));
    const vis=await pg.evaluate(()=>document.body.innerText);ok(!TEC.test(vis),'D2: texto técnico com agente: '+(vis.match(TEC)||[])[0]);
    ok(!(await pg.$('details.tec')),'D6: Carlos vê Detalhes técnicos');
    PROIB_D1.forEach(t=>ok(!vis.includes(t),'D1: Carlos com agente vê "'+t+'"'));
    FEED.sessoes=[{...FEED.sessoes[0],status:'fechada',fotos:pids(0,4).concat(pids(10,2)),pend:[],fechada_em:a,fechada_por:'pausa',ultima_chegada:a-70,rev:2}];FEED.rev=2;
    ok(await espera(pg,()=>!!document.querySelector('.up-faixa.ok')),'D4: faixa verde quando a sessão fecha');
    const v=await pg.evaluate(()=>(document.querySelector('.up-faixa.ok')||{}).textContent||'');ok(/Tudo no servidor · 6 fotos hoje · 1 sessão/.test(v),'D4: texto da faixa verde: '+v);
    // D6: Admin vê Detalhes técnicos recolhido, Supervisora não
    await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.go('importar'));await espera(pg,()=>ETERNA.state.agent.on);await pg.waitForTimeout(300);
    const d6=await pg.evaluate(()=>{const d=document.querySelector('details.tec');return d?{open:d.open,t:d.textContent}:null;});
    ok(d6&&!d6.open&&/192\.168\.0\.10/.test(d6.t)&&/porta/.test(d6.t)&&/carlos, samuel/.test(d6.t),'D6: Admin com Detalhes técnicos recolhido: '+JSON.stringify(d6&&{open:d6.open,t:d6.t.slice(0,160)}));
    await entrar(pg,'supervisor@eterna.photo');await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(500);
    {const t=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(!(await pg.$('details.tec'))&&!TEC.test(t),'D6: Supervisora sem Detalhes técnicos nem texto técnico: '+(t.match(TEC)||[])[0]);}
    await ctx.close();}
  // D7: com a demonstração, a simulação funciona como na v93
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.evaluate(()=>localStorage.setItem('eterna.demo.v1','1'));
    await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.state.imp.key='samuel';ETERNA.go('importar');});await pg.waitForTimeout(400);
    const n0=await pg.evaluate(()=>Object.keys(ETERNA.SIM.sessions).length);
    await pg.click('[data-act="ing-start"]');
    ok(await espera(pg,()=>/Recebendo \d+ de \d+/.test((document.querySelector('.up-faixa.warn')||{}).textContent||''),4000),'D7: faixa "Recebendo" na simulação');
    ok(await espera(pg,()=>!ETERNA.state.ing.running,60000),'D7: a leva termina');
    const n1=await pg.evaluate(()=>Object.keys(ETERNA.SIM.sessions).length);ok(n1>n0,'D7: Simular leva cria sessões: '+n0+' → '+n1);
    ok(await pg.evaluate(()=>/Tudo no servidor/.test((document.querySelector('.up-faixa.ok')||{}).textContent||'')),'D7: faixa verde no fim da leva');
    ok(!!(await pg.$('#main [data-act="ing-reset"]'))&&/Sessões criadas nesta leva/.test(await pg.textContent('#main')),'D7: Limpar esta leva e Sessões criadas nesta leva');
    await pg.evaluate(()=>localStorage.removeItem('eterna.demo.v1'));await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-d: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-d: Minhas fotos (D1 a D7)');process.exit(0);
})();
