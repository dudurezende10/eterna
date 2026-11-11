// v97 (plano docs/planos/2026-11-10-recorte-birefnet-sessoes.md, E5 e E6): o Checkout abre a VISITA inteira (levas da mesma
// família ligadas pelo agente), o Posto junta e separa levas, e as bases de IA nunca deixam o Checkout sem montagem.
// Critérios 15, 16, 17 (bases), 18, 19, 21, 22 (selfie), 26 (menor), 27 e 28 (Juntar e Separar com o cliente na tela e com
// pedido aberto), 29 (sem venda u), 30 (código LP). Agente falso (page.route): /status, /sessoes, /visitas, /visitas/juntar,
// /visitas/separar, /rostos/buscar, /recorte, /thumb/, /file/. Só imagens geradas aqui (nunca foto de convidado).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const notas={};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(6):
    im=Image.new('RGB',(300,200),(40+i*30,90,160-i*20));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(20+i*30,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGBA',(600,400),(0,0,0,0));d=ImageDraw.Draw(im);d.ellipse([260,40,340,120],fill=(230,200,170,255));d.rectangle([220,120,380,400],fill=(40,80,140,255))
b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const PNG=cores.pop();
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
// A: a família com o Carlos; B: a família com o Samuel 8 min depois; C: o filho sozinho com a Marinara; D: outra família no
// mesmo minuto (Yago); E: leva de menor; F: a família de novo com o Yago, sem rosto em comum (só junta pelo Posto)
const L={A:ids('aaa',4),B:ids('bbb',3),C:ids('ccc',2),D:ids('ddd',3),E:ids('eee',2),F:ids('fff',2)};
const CARD={A:'LPVISAA01',B:'LPVISBB02',C:'LPVISCC03',D:'LPVISDD04',E:'LPVISEE05',F:'LPVISFF06'};
const ses=(card,fotos,who,ponto,t0,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev,ia:[],ia_regra:{n:2,motivo:'poucas_fotos'}});
const FEED=[ses(CARD.A,L.A,'carlos','terminal',a-1500,1),ses(CARD.B,L.B,'samuel','campo4',a-1000,2),ses(CARD.C,L.C,'marinara','campo2',a-900,3),
  ses(CARD.D,L.D,'yago','campo3',a-1500,4),ses(CARD.E,L.E,'yago','campo3',a-1400,5),ses(CARD.F,L.F,'yago','campo3',a-600,6)];
// o agente "ligou" A, B e C (e, por engano, a leva de menor E: o app nunca a abre pela visita)
let VIS=[{id:'VVISAA01',levas:[CARD.A,CARD.B,CARD.C,CARD.E],rev:1,inicio:a-1500,fim:a-850,grande:false,separadas:[]}];let VREV=1;
const POSTS=[];let SIMS={};let REC503=new Set();
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'b97',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  sessoes:{v:2,pausa:60,rostos:true,rev:6,gen:'b97',hoje:6,abertas:0,dias:1,visitas:{n:VIS.length,rev:VREV}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b97',rev:6,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/visitas',r=>{if(r.request().method()!=='GET')return r.fallback();r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:VREV,completo:true,visitas:VIS})});});
  await ctx.route(ORIG+'/visitas?*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:VREV,completo:true,visitas:VIS})}));
  await ctx.route(ORIG+'/visitas/*',r=>{const q=r.request();let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}const acao=q.url().split('/').pop();POSTS.push({acao,j,x:q.headers()['x-eterna']});
    if(q.headers()['x-eterna']!=='1')return r.fulfill({status:403,contentType:'application/json',body:'{"error":"origem não autorizada"}'});
    const v=VIS[0];if(acao==='juntar'){if(!v.levas.includes(j.b))v.levas.push(j.b);}else{v.levas=v.levas.filter(c=>c!==j.card);v.separadas=[j.card];}v.rev=++VREV;
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,visita:v,nova:acao==='separar'?{id:'V'+j.card.slice(2),levas:[j.card]}:undefined})});});
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(0)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(0)%cores.length]});});
  await ctx.route(ORIG+'/recorte',r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}if(REC503.has(q.pid))return r.fulfill({status:503,contentType:'application/json',body:J({error:'recorte_indisponivel',motivo:'erro ao abrir os modelos: abrindo'})});r.fulfill({status:200,contentType:'image/png',body:PNG});});
  await ctx.route(ORIG+'/photoroom/**',r=>{fails.push('fetch ao Photoroom: '+r.request().url());r.fulfill({status:409,contentType:'application/json',body:'{}'});});
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:J({rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('checkout: '+e.message));
  await pg.goto(U+'#loja');
  const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(150);}return false;};
  ok(await espera(pg,c=>Object.values(c).every(x=>ETERNA.SIM.sessions[x]),20000,CARD),'as levas do servidor chegaram ao SIM');
  ok(await espera(pg,()=>ETERNA.SIM.visitas&&ETERNA.SIM.visitas.rev===1,10000),'SIM.visitas puxado do GET /visitas: '+J(await pg.evaluate(()=>ETERNA.SIM.visitas)));
  await pg.evaluate(c=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));S.sessions[c.E].menor=true;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},CARD);
  const selfie=async(sims)=>{SIMS=sims;return pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);
    const k=ETERNA.state.kiosk;return {code:k.code,step:k.step,cards:k.so&&k.so.cards,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3))};});};
  // 18/19/21: a mãe aparece com foto clara só em A; a selfie abre A, B e C inteiras (C = o filho sozinho; fotos sem ela também)
  let s=await selfie({[L.A[0]]:.72,[L.A[1]]:.66});
  ok(s.code===CARD.A&&J(s.cards)===J([CARD.A,CARD.B,CARD.C])&&s.fotos.length===9&&L.C.every(p=>s.fotos.includes(p))&&L.A.every(p=>s.fotos.includes(p)),'18/19/21: a selfie abre a visita inteira (A, B e C, 9 fotos, sem a leva de menor): '+J(s));
  // 22: a outra família do mesmo minuto vê só a dela
  s=await selfie({[L.D[0]]:.7});
  ok(s.code===CARD.D&&(!s.cards||J(s.cards)===J([CARD.D]))&&s.fotos.length===3&&s.fotos.every(p=>/^ddd/.test(p)),'22: a outra família não vê fotos da visita: '+J(s));
  // 26: a selfie da criança (leva de menor) não abre a visita: só as fotos dela (v77)
  s=await selfie({[L.E[0]]:.7});
  ok(s.code===CARD.E&&s.fotos.join()===L.E[0],'26: leva de menor não abre a visita: '+J(s));
  // 30: o código LP de qualquer leva abre a visita inteira; o da leva de menor, só ela
  const codigo=async c=>{await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(150);await pg.fill('#kcode',c);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(300);
    return pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {code:k.code,cards:k.so&&k.so.cards,n:ETERNA.lojaFotos(k.code).length};});};
  let cg=await codigo(CARD.C);ok(cg.code===CARD.C&&J((cg.cards||[]).slice().sort())===J([CARD.A,CARD.B,CARD.C].sort())&&cg.n===9,'30: código LP da leva C abre a visita: '+J(cg));
  cg=await codigo(CARD.E);ok(cg.code===CARD.E&&!cg.cards&&cg.n===2,'30/26: código da leva de menor abre só ela: '+J(cg));
  cg=await codigo(CARD.D);ok(cg.code===CARD.D&&!cg.cards&&cg.n===3,'30: leva fora de visita: como antes: '+J(cg));

  // ---------- 27 e 28: Posto junta e separa com o cliente escolhendo ----------
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push('posto: '+e.message));pg2.on('dialog',d=>d.accept());
  await require('./_login.js')(pg2);await pg2.evaluate(()=>{localStorage.removeItem('eterna.session');ETERNA.go('posto');});await pg2.waitForTimeout(400);
  ok(await espera(pg2,()=>ETERNA.state.agent.on&&ETERNA.state.agent.sessoes&&ETERNA.SIM.visitas&&ETERNA.SIM.visitas.rev>=1,15000),'Posto com o agente e as visitas');
  s=await selfie({[L.A[0]]:.72});
  await pg.evaluate(([b0,a1])=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);pk['ag_'+b0]='ok';pk['ag_'+a1]='ok';ETERNA.lojaSync(k.code);},[L.B[0],L.A[1]]); // marcar grava (lojaSync), como no toque
  const clica=(p,act,data)=>p.evaluate(([act,data])=>{const el=document.createElement('button');el.dataset.act=act;Object.assign(el.dataset,data);document.body.appendChild(el);el.click();el.remove();},[act,data]);
  await clica(pg2,'visita-juntar',{a:CARD.A,b:CARD.F,id:'x'});await pg2.waitForTimeout(300);
  notas.toast27=await pg2.evaluate(()=>{const t=document.querySelector('#toast,.toast');return {t:t&&t.innerText,on:ETERNA.state.agent.on,ses:!!ETERNA.state.agent.sessoes,url:ETERNA.state.agent.url};});
  ok(await espera(pg,f=>ETERNA.state.kiosk.so&&ETERNA.state.kiosk.so.cards.includes(f),12000,CARD.F),'27: Juntar no Posto: o Checkout aberto mostra a leva F: '+J(await pg.evaluate(()=>ETERNA.state.kiosk.so&&ETERNA.state.kiosk.so.cards)));
  let mk=await pg.evaluate(()=>Object.keys(ETERNA.lojaPick(ETERNA.state.kiosk.code)));
  ok(mk.includes('ag_'+L.B[0])&&mk.includes('ag_'+L.A[1])&&(await pg.evaluate(()=>ETERNA.lojaFotos(ETERNA.state.kiosk.code).length))===11,'27: as marcas continuam e as fotos de F entram: '+J(mk));
  const pj=POSTS.find(p=>p.acao==='juntar');ok(pj&&pj.x==='1'&&pj.j.a===CARD.A&&pj.j.b===CARD.F&&pj.j.por&&pj.j.posto,'27: POST /visitas/juntar com X-Eterna, por e posto: '+J(pj));
  let au=await pg2.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>/^visita_/.test(e.acao)).map(e=>e.acao+':'+e.alvo));
  ok(au.includes('visita_juntar:'+CARD.F),'27: auditLog visita_juntar: '+J(au));
  await clica(pg2,'visita-separar',{card:CARD.B,id:'x'});
  ok(await espera(pg,bb=>ETERNA.state.kiosk.so&&!ETERNA.state.kiosk.so.cards.includes(bb),12000,CARD.B),'28: Separar no Posto: a leva B sai do Checkout aberto');
  mk=await pg.evaluate(()=>Object.keys(ETERNA.lojaPick(ETERNA.state.kiosk.code)));
  ok(!mk.includes('ag_'+L.B[0])&&mk.includes('ag_'+L.A[1]),'28: a marca da leva separada sai, a outra fica: '+J(mk));
  // 28: com pedido aberto: as fotos da leva separada saem do pedido e o Posto avisa
  await clica(pg2,'visita-juntar',{a:CARD.A,b:CARD.B,id:'x'});
  ok(await espera(pg,bb=>ETERNA.state.kiosk.so&&ETERNA.state.kiosk.so.cards.includes(bb),12000,CARD.B),'28: Juntar de novo desfaz o Separar');
  await pg.evaluate(b0=>{const k=ETERNA.state.kiosk;ETERNA.lojaPick(k.code)['ag_'+b0]='ok';ETERNA.lojaSync(k.code);},L.B[0]);
  await pg.evaluate(()=>ETERNA.lojaPedir&&ETERNA.lojaPedir());await pg.waitForTimeout(300);
  if(await pg.evaluate(()=>ETERNA.state.kiosk.step!=='done')){await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});await pg.click('.lj-foot [data-act="loja-cart"]').catch(()=>{});}
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done',8000),'pedido feito no Checkout');
  const ped=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,n:r.n,sel:r.selected};});
  await pg2.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await pg2.waitForTimeout(500);
  const bloco=await pg2.evaluate(id=>{const el=document.querySelector(`[data-pend="${id}"] .vis-bloco`);return el&&{txt:el.innerText,sep:[...el.querySelectorAll('[data-act="visita-separar"]')].map(x=>x.dataset.card),jun:!!el.querySelector('[data-act="visita-juntar-abrir"]')};},ped.id);
  ok(bloco&&bloco.jun&&bloco.sep.includes(CARD.B)&&!bloco.sep.includes(CARD.A)&&/Levas desta família/i.test(bloco.txt),'E6: blocos por leva no pedido, Separar fora da âncora e Juntar outra leva: '+J(bloco));
  await pg2.click(`[data-pend="${ped.id}"] [data-act="visita-separar"][data-card="${CARD.B}"]`);
  ok(await espera(pg2,([id,b0])=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return r&&!(r.selected||[]).includes('ag_'+b0);},10000,[ped.id,L.B[0]]),'28: com pedido aberto, as fotos da leva separada saem do pedido');
  const ped2=await pg2.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {n:r.n,sel:r.selected,avisos:(ETERNA.state.caixa.avisos||[]).map(a=>a.t)};},ped.id);
  ok(ped2.n===ped.n-1&&ped2.avisos.some(t=>/saiu com a leva/.test(t)),'28: o pedido conta uma foto a menos e o Posto avisa: '+J({ped,ped2}));
  au=await pg2.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>/^visita_/.test(e.acao)).map(e=>e.acao+':'+e.alvo));
  ok(au.filter(x=>x==='visita_separar:'+CARD.B).length===2,'28: auditLog visita_separar: '+J(au));
  // Juntar outra leva: lista das levas de hoje fora da visita (até 12) e o código LP
  await pg2.click(`[data-pend="${ped.id}"] [data-act="visita-juntar-abrir"]`);await pg2.waitForTimeout(200);
  const lst=await pg2.evaluate(id=>[...document.querySelectorAll(`[data-pend="${id}"] .vis-cand`)].map(x=>x.dataset.b),ped.id);
  ok(lst.includes(CARD.D)&&lst.includes(CARD.B)&&!lst.includes(CARD.A)&&!lst.includes(CARD.E)&&lst.length<=12&&await pg2.$('#vis-lp'),'E6: Juntar outra leva lista as de hoje fora da visita (sem menor) e aceita o código: '+J(lst));
  // 29: sem venda u, os botões somem e o clique é recusado sem POST
  const n0=POSTS.length;
  const sem=await pg2.evaluate(([id,c])=>{const u=ETERNA.state.user;const p0=JSON.stringify(u.perms.venda);u.perms.venda={...u.perms.venda,u:false};ETERNA.render();
    const el=document.querySelector(`[data-pend="${id}"]`);const r={sep:!!(el&&el.querySelector('[data-act="visita-separar"]')),jun:!!(el&&el.querySelector('[data-act="visita-juntar-abrir"]'))};
    const b=document.createElement('button');b.dataset.act='visita-separar';b.dataset.card=c;document.body.appendChild(b);b.click();b.remove();u.perms.venda=JSON.parse(p0);ETERNA.render();return r;},[ped.id,CARD.C]);
  await pg2.waitForTimeout(400);
  ok(!sem.sep&&!sem.jun&&POSTS.length===n0,'29: sem venda u, sem botões e sem POST: '+J({sem,posts:POSTS.length-n0}));
  // visita grande: selo no pedido
  VIS[0].grande=true;VIS[0].rev=++VREV;
  ok(await espera(pg2,id=>{const el=document.querySelector(`[data-pend="${id}"] .vis-bloco`);return el&&/Visita grande: confira/.test(el.innerText);},10000,ped.id),'E6: selo "Visita grande: confira" no pedido');
  // Servidor do ponto fora: botões inativos
  const fora=await pg2.evaluate(id=>{const a=ETERNA.state.agent;const s0=a.sessoes;a.sessoes=null;ETERNA.render();const el=document.querySelector(`[data-pend="${id}"] .vis-bloco`);const t=el&&el.innerText;const dis=el&&[...el.querySelectorAll('button')].every(b=>b.disabled);a.sessoes=s0;ETERNA.render();return {t,dis};},ped.id);
  ok(fora.dis&&/Servidor do ponto fora/.test(fora.t||''),'E6: sem agente, botões inativos com "Servidor do ponto fora": '+J(fora));

  // ---------- E5b: bases de IA ----------
  const ia=await pg.evaluate(()=>{ETERNA.fiaRecDeNovoMs(1500);ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};return true;});
  // 16: leva ag_ de 1 foto (sem bases, poucas_fotos), com recorte pronto: montagens em 10 de 10 ids (sem a nota simulada)
  const c16=await pg.evaluate(()=>{const S=ETERNA.SIM;let n=0;const r=[];for(let i=0;i<10;i++){const pid='ag_f16'+String(i).padStart(9,'0');const card='LPF16'+String(i).padStart(4,'0');ETERNA.UP[pid]={src:location.origin+'/thumb/'+pid.slice(3),name:pid};
      S.sessions[card]={key:'carlos',pdv:'Terminal Campo',point:'terminal',time:'10:00',date:'hoje',srv:true,status:'fechada',selected:[],cart:[],photos:[{id:pid,sold:0}],ia:[],iaRegra:{n:2,motivo:'poucas_fotos'}};
      const it=ETERNA.lojaAI(card);r.push(it.length);if(it.length)n++;}return {n,r};});
  ok(c16.n===10,'16: leva de 1 foto real com montagens em 10 de 10: '+J(c16));
  // 17: as 2 bases barradas pela validação e o jeito antigo vazio: montagens com a base barrada; com uma base boa, ela na frente
  const c17=await pg.evaluate(()=>{const S=ETERNA.SIM;const card='LPF17BASE';const b1='ag_f17000000001',b2='ag_f17000000002',ph='ag_f17000000003';[b1,b2,ph].forEach(id=>{ETERNA.UP[id]={src:location.origin+'/thumb/'+id.slice(3),name:id};});
    S.sessions[card]={key:'carlos',pdv:'Terminal Campo',point:'terminal',time:'10:00',date:'hoje',srv:true,status:'fechada',selected:[],cart:[],photos:[{id:ph,sold:0}],ia:[b1,b2],iaRegra:{n:2,motivo:null}};
    S.invalid=Object.assign(S.invalid||{},{[b1]:'olhos',[b2]:'olhos'});ETERNA.FIA_RUIM.add(ph);const x=ETERNA.lojaAI(card).map(i=>i.id);
    delete S.invalid[b1];const y=ETERNA.lojaAI(card).map(i=>i.id);ETERNA.FIA_RUIM.delete(ph);delete S.invalid[b2];return {x,y};});
  ok(c17.x.length>0&&c17.x.every(id=>/f1700000000[12]$/.test(id)),'17: base barrada como última alternativa: '+J(c17.x));
  ok(c17.y.length>0&&c17.y.every(id=>/f17000000001$/.test(id)),'17: com uma base boa, ela continua na frente: '+J(c17.y));
  // 15: /recorte 503 e depois 200: a foto não entra em FIA_RUIM e a montagem aparece sem recarregar
  const P15='ag_f15000000001';REC503.add(P15.slice(3));
  await pg.evaluate(p=>{ETERNA.UP[p]={src:location.origin+'/thumb/'+p.slice(3),name:p};const el=document.createElement('span');el.className='compimg';el.id='c15';el.dataset.comp=p+'|campeao2';document.body.appendChild(el);ETERNA.compHydrate();},P15);
  await pg.waitForTimeout(800);
  const c15a=await pg.evaluate(p=>({ruim:ETERNA.FIA_RUIM.has(p)||ETERNA.FIA_RUIM.has(p+'|campeao2'),t:document.querySelector('#c15').innerText}),P15);
  REC503.delete(P15.slice(3));
  const c15b=await espera(pg,()=>document.querySelector('#c15').classList.contains('ok'),12000);
  ok(!c15a.ruim&&/Recorte local indisponível/.test(c15a.t)&&c15b&&!(await pg.evaluate(p=>ETERNA.FIA_RUIM.has(p),P15)),'15: 503 e depois 200: fora do FIA_RUIM e montagem sem recarregar: '+J({c15a,c15b}));
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA visitas-checkout: '+fails.join(' | ')+' · '+J(notas));process.exit(1);}
console.log('OK visitas-checkout: critérios 15 a 19, 21, 22, 26 a 30 do plano v97 (visita no Checkout, Juntar e Separar no Posto, bases de IA)');})();
