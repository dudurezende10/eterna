// 28/11: chave do segundo verificador de rostos em Configurações > Checkout (docs/planos/2026-11-27-segundo-verificador-de-rostos.md).
// Só o Admin vê; o valor mostrado é o do servidor do ponto (GET /rostos2) e a troca vai por POST /rostos2 {ligado}.
// Servidor antigo (sem a rota): nada aparece. Agente falso (page.route).
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
let R2={ligado:false,chave:false,busca:false,corte:.88,por:'ronaldo',em:null,pronto:false,motivo:'desligado pela chave',lidas:10,falta_hoje:7,hoje_coberto:false};let TEM=true;const POSTS=[];
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'br2',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
  sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'br2',hoje:0,abertas:0,dias:1,visitas:{n:0,rev:0,rosto:false,rosto_em:null,calibracao:0}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'br2',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]})}));
  await ctx.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/rostos2',r=>{const q=r.request();if(!TEM)return r.fulfill({status:404,contentType:'application/json',body:'{"error":"nao"}'});
    if(q.method()==='POST'){let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}POSTS.push({j,x:q.headers()['x-eterna']});if('ligado' in j)R2=Object.assign({},R2,{chave:j.ligado===true,ligado:j.ligado===true,pronto:j.ligado===true});if('busca' in j)R2=Object.assign({},R2,{busca:j.busca===true});}
    r.fulfill({status:200,contentType:'application/json',body:J(Object.assign({ok:true},R2))});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await require('./_login.js')(pg);
  const esp=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(150);}return false;};
  ok(await esp(()=>ETERNA.state.agent&&ETERNA.state.agent.on,15000),'o painel achou o servidor do ponto');
  await pg.evaluate(()=>{ETERNA.state.catTab='checkout';ETERNA.go('catalogo');});
  ok(await esp(()=>{const c=document.querySelector('#r2-painel [data-act="r2-ligado"]');return c&&!c.checked&&!c.disabled;}),'a chave aparece desligada, como está no servidor');
  ok(await pg.evaluate(()=>/Desligado/.test(document.querySelector('#r2-painel .pill').textContent)),'estado: desligado');
  await pg.click('#r2-painel [data-act="r2-ligado"]');
  ok(await esp(()=>{const c=document.querySelector('#r2-painel [data-act="r2-ligado"]');return c&&c.checked&&!c.disabled;}),'depois do clique fica ligada');
  ok(POSTS.length===1&&POSTS[0].x==='1'&&POSTS[0].j.ligado===true&&Object.keys(POSTS[0].j).join()==='ligado','POST /rostos2 só com ligado: '+J(POSTS));
  ok(await pg.evaluate(()=>/faltam 7/.test(document.querySelector('#r2-painel .pill').textContent)),'ligada com o dia ainda em leitura: mostra quantas faltam');
  ok(await pg.evaluate(()=>{const c=document.querySelector('#r2-painel [data-act="r2-busca"]');return c&&!c.checked&&!c.disabled;}),'Procurar fotos: chave própria, desligada');
  await pg.click('#r2-painel [data-act="r2-busca"]');
  ok(await esp(()=>{const c=document.querySelector('#r2-painel [data-act="r2-busca"]');return c&&c.checked;})&&POSTS.length===2&&J(POSTS[1].j)==='{"busca":true}','Procurar fotos: POST só com busca: '+J(POSTS));
  await pg.click('#r2-painel [data-act="r2-busca"]');
  ok(await esp(()=>{const c=document.querySelector('#r2-painel [data-act="r2-busca"]');return c&&!c.checked;})&&POSTS.length===3&&POSTS[2].j.busca===false,'Procurar fotos: desligar: '+J(POSTS));
  await pg.click('#r2-painel [data-act="r2-ligado"]');
  ok(await esp(()=>{const c=document.querySelector('#r2-painel [data-act="r2-ligado"]');return c&&!c.checked;})&&POSTS.length===4&&POSTS[3].j.ligado===false,'desligar: '+J(POSTS));
  ok(await pg.evaluate(()=>{const c=document.querySelector('#r2-painel [data-act="r2-busca"]');return c&&c.disabled;}),'principal desligada: Procurar fotos travado');
  // não Admin: sem o painel
  const naoAdm=await pg.evaluate(()=>{const u=ETERNA.state.user;const o=JSON.parse(JSON.stringify(u));o.preset='supervisor';o.menu=['catalogo'];o.perms={configuracao:{c:false,r:true,u:true,d:false},catalogo:{c:false,r:true,u:true,d:false}};
    ETERNA.state.user=o;ETERNA.render();const tem=!!document.getElementById('r2-painel');ETERNA.state.user=u;ETERNA.render();return tem;});
  ok(naoAdm===false,'não Admin: sem a chave');
  // servidor do ponto sem a rota: nada aparece
  TEM=false;await pg.evaluate(()=>{ETERNA.state.r2Em=0;ETERNA.render();});
  ok(await esp(()=>!document.getElementById('r2-painel')),'servidor sem a função: sem painel');
  await pg.close();await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const f=fails.filter(Boolean);const okk=!f.length;console.log(`${okk?'OK':'FALHA'} rosto2-painel: chave do segundo verificador em Configurações, só do Admin, valor do servidor${okk?'':' · '+f.slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
