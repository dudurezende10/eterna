// v96-ux (Eduardo, 11/11): Minhas fotos do fotógrafo. Nome e ponto como texto (sem seletor) para o Fotógrafo; Admin e
// Supervisora com os seletores. Agente falso por page.route na própria origem; nada de foto de cliente.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const LIB={fotos:[]};
async function agente(ctx){
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bF',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gF',hoje:0,abertas:0},envio:{v:1,max_mb:60,novas:0,repetidas:0,recusadas:0}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:J(LIB)}));
  await ctx.route(ORIG+'/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"grupos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'gF',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(250);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(250);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(400);
  await pg.evaluate(()=>ETERNA.go('importar'));const t0=Date.now();while(Date.now()-t0<6000&&!(await pg.evaluate(()=>ETERNA.state.agent.on)))await pg.waitForTimeout(150);await pg.waitForTimeout(200);}
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async()=>{const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await agente(ctx);const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};};
try{
  // ---------- nome e ponto do fotógrafo ----------
  {const {ctx,pg}=await nova();await entrar(pg,'carlos@eterna.photo');
    const r=await pg.evaluate(()=>({sel:document.querySelectorAll('#main select[data-act="imp-key"],#main select[data-act="imp-point"]').length,fixo:[...document.querySelectorAll('#main .imp-fixo')].map(x=>x.innerText.replace(/\s+/g,' ').trim()),key:ETERNA.state.imp.key,point:ETERNA.state.imp.point}));
    ok(r.sel===0,'NP1: fotógrafo sem seletor de nome e ponto: '+r.sel);
    ok(r.fixo[0]==='Fotógrafo Carlos'&&/^Ponto .+/.test(r.fixo[1]||'')&&r.key==='carlos','NP1: nome e ponto como texto: '+J(r));
    // disparar imp-key e imp-point por fora da tela não muda nada
    const d=await pg.evaluate(()=>{const mk=(act,v)=>{const s=document.createElement('select');s.dataset.act=act;s.innerHTML=`<option value="${v}">${v}</option>`;s.value=v;document.body.appendChild(s);s.dispatchEvent(new Event('change',{bubbles:true}));s.remove();};
      const p0=ETERNA.state.imp.point;mk('imp-key','samuel');mk('imp-point','vestiario');ETERNA.render();return {key:ETERNA.state.imp.key,point:ETERNA.state.imp.point,p0};});
    ok(d.key==='carlos'&&d.point===d.p0,'NP2: imp-key e imp-point por JS não mudam nada: '+J(d));
    // ponto vem da Escala: campo, volante e folga
    const pts=await pg.evaluate(()=>{const S=ETERNA.SIM;const hoje=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');})();const out={};
      const txt=()=>{ETERNA.render();const f=[...document.querySelectorAll('#main .imp-fixo')];return f[1]?f[1].innerText.replace(/\s+/g,' ').trim():'';};
      const antes=S.funcao;const dk=ETERNA.todayKey?ETERNA.todayKey():null;
      const poe=m=>{S.funcao={date:dk,map:{carlos:m}};};
      if(dk){poe({tipo:'campo',point:'vestiario'});out.campo=[txt(),ETERNA.state.imp.point];poe({tipo:'volante',modo:'livre'});out.volante=[txt(),ETERNA.state.imp.point];poe({tipo:'folga'});out.folga=[txt(),ETERNA.state.imp.point];}
      S.funcao=antes;ETERNA.render();return out;});
    if(pts.campo){ok(/^Ponto Vesti/.test(pts.campo[0])&&pts.campo[1]==='vestiario','NP3: campo mostra o ponto: '+J(pts.campo));
      ok(pts.volante[0]==='Ponto Volante'&&pts.volante[1]==='todos','NP3: volante: '+J(pts.volante));
      ok(pts.folga[0]==='Ponto Sem ponto na escala hoje'&&pts.folga[1]==='todos','NP3: folga: '+J(pts.folga));}
    else fails.push('NP3: todayKey não exposto no ETERNA');
    ok(!!(await pg.$('#main [data-act="set-switch"]'))&&!!(await pg.$('#main [data-act="set-logout"]')),'NP: Trocar fotógrafo e Sair continuam');
    await ctx.close();}
  for(const email of ['eduardo@eduardorezende.com','supervisor@eterna.photo']){const {ctx,pg}=await nova();await entrar(pg,email);
    const n=await pg.evaluate(()=>({k:!!document.querySelector('#main select[data-act="imp-key"]'),p:!!document.querySelector('#main select[data-act="imp-point"]'),f:document.querySelectorAll('#main .imp-fixo').length}));
    ok(n.k&&n.p&&!n.f,'NP4: '+email+' com os dois seletores: '+J(n));
    await pg.selectOption('#main select[data-act="imp-key"]','marinara');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.imp.key)==='marinara','NP4: '+email+' troca o fotógrafo');
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA minhas-fotos-fotografo: '+fails.join(' || '));process.exit(1);}
console.log('OK minhas-fotos-fotografo: nome e ponto do fotógrafo como texto, Admin e Supervisora com seletores');process.exit(0);
})();
