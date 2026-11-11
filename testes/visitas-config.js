// v97 (Segurança, 10/11, B1): interruptor "Juntar a família pelo rosto (em teste)" em Configurações › Painel de controle.
// Só o Admin vê; o valor vem do /status (sessoes.visitas.rosto, desligado por padrão); a mudança vai por POST /visitas/config
// com X-Eterna: 1 e auditoria. Agente falso (page.route), sem foto nenhuma.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
let ROSTO=false;const POSTS=[];let GETS=0;
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'b97c',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  sessoes:{v:2,pausa:60,rostos:true,rev:0,gen:'b97c',hoje:0,abertas:0,dias:1,visitas:{n:0,rev:0,rosto:ROSTO,rosto_em:null,calibracao:0}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b97c',rev:0,pausa:60,rostos:true,completo:true,sessoes:[]})}));
  await ctx.route(ORIG+'/visitas',r=>{GETS++;r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})});});
  await ctx.route(ORIG+'/visitas?*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/visitas/config',r=>{const q=r.request();let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}POSTS.push({j,x:q.headers()['x-eterna']});
    if(q.headers()['x-eterna']!=='1')return r.fulfill({status:403,contentType:'application/json',body:'{"error":"origem não autorizada"}'});
    ROSTO=j.rosto===true;r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rosto:ROSTO,em:'2026-11-11T10:00:00',por:j.por})});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await require('./_login.js')(pg);
  const espera=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>ETERNA.state.agent.on&&ETERNA.state.agent.sessoes&&ETERNA.state.agent.sessoes.visitas,15000),'agente falso conectado');
  await pg.evaluate(()=>(ETERNA.state.catTab='avancado',ETERNA.go('catalogo')));await pg.waitForTimeout(400);
  const painel=await pg.evaluate(()=>{const p=document.getElementById('vis-rosto');const c=p&&p.querySelector('[data-act="vis-rosto"]');return p&&{txt:p.textContent,checked:c.checked,dis:c.disabled};});
  ok(painel&&/Juntar a família pelo rosto \(em teste\)/.test(painel.txt)&&/desligado até a calibração/.test(painel.txt)&&painel.checked===false&&painel.dis===false,'Admin vê o interruptor desligado: '+J(painel));
  await pg.click('[data-act="vis-rosto"]');
  ok(await espera(()=>{const c=document.querySelector('#vis-rosto [data-act="vis-rosto"]');return c&&c.checked&&!c.disabled;},5000),'depois do clique o interruptor fica ligado');
  ok(POSTS.length===1&&POSTS[0].x==='1'&&POSTS[0].j.rosto===true&&typeof POSTS[0].j.por==='string','POST /visitas/config com X-Eterna e rosto booleano: '+J(POSTS));
  const aud=await pg.evaluate(()=>(ETERNA.auditRead?ETERNA.auditRead():[]).filter(x=>x&&(x.acao||x.a||x.action)==='visitas_rosto').length);
  ok(aud>=1,'auditoria visitas_rosto: '+aud);
  await pg.click('[data-act="vis-rosto"]');
  ok(await espera(()=>{const c=document.querySelector('#vis-rosto [data-act="vis-rosto"]');return c&&!c.checked&&!c.disabled;},5000)&&POSTS.length===2&&POSTS[1].j.rosto===false,'desligar de novo: '+J(POSTS));
  // não Admin: sem o painel; o clique forjado não manda nada
  const naoAdm=await pg.evaluate(async()=>{const u=ETERNA.state.user;const outro=JSON.parse(JSON.stringify(u));outro.menu=['catalogo'];outro.perms={configuracao:{c:false,r:true,u:true,d:false},catalogo:{c:false,r:true,u:true,d:false}};
    ETERNA.state.user=outro;const html=ETERNA.visRostoPanel();await ETERNA.visRostoSalva(true);ETERNA.state.user=u;return {html,adm:ETERNA.isAdminUser?ETERNA.isAdminUser(outro):null};});
  ok(naoAdm.html===''&&POSTS.length===2,'não Admin: sem interruptor e sem POST: '+J({h:naoAdm.html.slice(0,40),n:POSTS.length}));
  // revisão: agente reiniciado (gen novo) com o mesmo rev das visitas: o app puxa de novo
  await pg.evaluate(()=>ETERNA.visPull());await pg.waitForTimeout(300);const g0=GETS;
  await pg.evaluate(()=>ETERNA.visPull());await pg.waitForTimeout(300);
  ok(GETS===g0,'mesmo gen e rev: não puxa de novo: '+(GETS-g0));
  await pg.evaluate(()=>{ETERNA.state.agent.sessoes.gen='b97-reiniciado';return ETERNA.visPull();});await pg.waitForTimeout(300);
  ok(GETS===g0+1,'gen novo com o mesmo rev: puxa de novo: '+(GETS-g0));
  // servidor do ponto fora: interruptor inativo
  await pg.evaluate(()=>{ETERNA.state.agent.sessoes=null;ETERNA.render();});await pg.waitForTimeout(200);
  const fora=await pg.evaluate(()=>{const c=document.querySelector('#vis-rosto [data-act="vis-rosto"]');return c&&c.disabled&&/Servidor do ponto fora/.test(document.getElementById('vis-rosto').textContent);});
  ok(fora,'sem o agente: interruptor inativo com o aviso');
}catch(e){fails.push('exceção: '+e.message);}
await b.close();
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA visitas-config: '+fails.join(' | '));process.exit(1);}
console.log('OK visitas-config: interruptor da ligação pelo rosto só para o Admin, desligado por padrão, POST com X-Eterna e auditoria (B1)');
})();
