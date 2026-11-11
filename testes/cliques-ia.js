// v93 (Eduardo, 06/11 07:54; plano docs/planos/2026-11-06-dois-cliques-ia.md): os 2 primeiros cliques de cada sessão de ponto
// de campo são só base dos fundos de IA. Critérios do app: 2 (fora da venda normal), 3 (5 montagens com a base certa), 4 (base
// ruim usa a outra; as duas ruins = jeito antigo), A11 e D2, 8 e 14 (Upload: tags e pílulas), 12 (Painel de controle e guardAct),
// 13 (Fila do fotógrafo) e 19 (as 5 montagens prontas no COMP em até 4 s depois de o código achar a sessão).
// Agente falso (page.route): /status com o recorte pronto, /sessoes, /thumb/, /file/, /recorte (PNG sintético de uma silhueta),
// /fila-fotografo. Nenhuma foto de convidado: quadrados de cor e uma silhueta desenhada.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const num={};const J=JSON.stringify;
const [JPG,SIL]=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(300,200),(60,110,150));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(30,60,120))
b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
s=Image.new('RGBA',(1600,2400),(0,0,0,0));d=ImageDraw.Draw(s);d.ellipse([650,200,950,520],fill=(230,200,170,255));d.rectangle([520,520,1080,1500],fill=(30,60,140,255));d.rectangle([580,1500,780,2399],fill=(20,20,40,255));d.rectangle([820,1500,1020,2399],fill=(20,20,40,255))
b=io.BytesIO();s.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
const ses=(card,fotos,who,funcao,t0,rev,x)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto:funcao&&funcao.tipo==='campo'?funcao.point:null,funcao,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev,ia:[],ia_regra:null,...x});
const A=ids('aaa',8),V=ids('bbb',5),W=ids('ccc',4),S=ids('ddd',3),N=ids('eee',4),O=ids('fff',1);
const FEED=[ses('LPTIACAM1',A,'yago',{tipo:'campo',point:'campo2'},a-900,1,{ia:A.slice(0,2),ia_regra:{n:2,motivo:null}}),
  ses('LPTIAVOL2',V,'samuel',{tipo:'volante',modo:'livre'},a-800,2,{ia_regra:{n:0,motivo:'volante'}}),
  ses('LPTIAVES3',W,'marinara',{tipo:'campo',point:'vestiario'},a-700,3,{ia_regra:{n:0,motivo:'ponto_fora'}}),
  ses('LPTIAPOU4',S,'carlos',{tipo:'campo',point:'terminal'},a-600,4,{ia_regra:{n:2,motivo:'poucas_fotos'}}),
  ses('LPTIASEM5',N,'carlos',{tipo:'campo',point:'terminal'},a-500,5,{ia_regra:{n:0,motivo:'sem_funcao'}}),
  ses('LPTIAABR6',O,'yago',{tipo:'campo',point:'campo2'},a-20,6,{status:'aberta',fechada_em:null,fechada_por:null})];
const FILA={ok:true,agora:a,rev:6,pausa:60,pronta_min:15,grupos:[
  {id:'LPTIAABR6',estado:'fotografando',fotografo:'yago',fonte:'ftp',funcao:{tipo:'campo',point:'campo2'},inicio:a-20,ultima_chegada:a-19,ultimo_clique:a-20,pronta_em:null,n:1,pids:O.slice(),ia:{n:2,motivo:null,pids:O.slice(),prontas:0}},
  {id:'LPTIACAM1',estado:'pronta',fotografo:'yago',fonte:'ftp',funcao:{tipo:'campo',point:'campo2'},inicio:a-900,ultima_chegada:a-850,ultimo_clique:a-852,pronta_em:a-790,n:8,pids:[],ia:{n:2,motivo:null,pids:[],prontas:2}}]};
let RECORTES=0;const PEDIDOS=[];let SIMS={};
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'b93',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
    sessoes:{v:2,pausa:60,rostos:true,rev:6,gen:'b93',hoje:6,abertas:1,dias:1},recorte:{ok:true,carregado:true,feitos:4,ms_medio:7000,fila:0,ia:{ligada:true,fila:1,feitos:4,erros:0,atraso_p50_s:9.5,atraso_p90_s:21.2}},fundos_modo:'local'})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b93',rev:6,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:J({rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim}))})}));
  await ctx.route(ORIG+'/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:J(FILA)}));
  await ctx.route(ORIG+'/recorte',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}PEDIDOS.push(j.pid+'|'+j.lado);RECORTES++;r.fulfill({status:200,contentType:'image/png',body:SIL});});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404|ort|wasm/i.test(m.text()))errs.push(m.text());});
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>['LPTIACAM1','LPTIAVOL2','LPTIAPOU4'].every(c=>ETERNA.SIM.sessions[c]),20000),'as sessões do servidor chegaram ao SIM');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));ETERNA.state.agent.recorte={ok:true,carregado:true};});
  const base=await pg.evaluate(()=>{const s=ETERNA.SIM.sessions.LPTIACAM1;const o=ETERNA.demoSessions().find(x=>x.card==='LPTIACAM1');return {ia:s.ia,n:o.photos.length,oia:o.ia,tem:o.photos.some(p=>s.ia.includes(p.id))};});
  ok(base.ia.join()==='ag_'+A[0]+',ag_'+A[1],'ingClose grava ia: '+J(base));
  ok(base.n===6&&!base.tem&&base.oia.length===2,'2: as 2 bases fora de photos (6 à venda) e em ia: '+J(base));
  const tot=await pg.evaluate(()=>ETERNA.demoSessions().find(x=>x.card==='LPTIACAM1').total);ok(tot===6,'total do demoSessions sem as bases: '+tot);
  // navegador antigo: sessão fechada sem ia ganha as bases no próximo srvPull
  const velho=await pg.evaluate(async()=>{const s=ETERNA.SIM.sessions.LPTIACAM1;const ia0=s.ia;delete s.ia;ETERNA.SRV.rev=0;await ETERNA.srvPull(true);return {ia:s.ia,igual:JSON.stringify(s.ia)===JSON.stringify(ia0)};});
  ok(velho.igual,'srvPull completa a ia da sessão materializada sem ela: '+J(velho));
  // segurança: base vendida por navegador antigo (sessão paga sem ia) não some da galeria, nem depois do srvPull e da republicação
  const paga=await pg.evaluate(async([f1])=>{const s=ETERNA.SIM.sessions.LPTIACAM1;const ia0=s.ia,st0=s.status,sel0=s.selected;const n1=ETERNA.demoSessions().find(x=>x.card==='LPTIACAM1').photos.find(p=>p.id!==f1&&!ia0.includes(p.id)).id;
    delete s.ia;s.status='paga';s.selected=[f1,n1];const tok=ETERNA.galDaSessao('LPTIACAM1',true);
    const g1=ETERNA.SIM.galerias[tok].fotos.filter(f=>f.id===f1).map(f=>f.direito);ETERNA.SRV.rev=0;await ETERNA.srvPull(true);const iaDepois=s.ia;
    s.ia=ia0;ETERNA.galAtualizar(tok);ETERNA.galPublicar(tok);const g2=ETERNA.SIM.galerias[tok].fotos.filter(f=>f.id===f1).map(f=>f.direito);
    const g3=ETERNA.SIM.galerias[tok].fotos.filter(f=>f.id===ia0[1]).length;
    const imp=ETERNA.impFotos({...s,prints:5}).todas.map(x=>x.id);const impNaoPaga=ETERNA.impFotos({...s,status:'fechada',prints:5}).todas.map(x=>x.id);
    s.status=st0;s.selected=sel0;delete ETERNA.SIM.galerias[tok];ETERNA.SIM.galFila=(ETERNA.SIM.galFila||[]).filter(x=>x.token!==tok);return {g1,iaDepois:iaDepois===undefined,g2,g3,imp:imp.includes(f1),impNaoPaga:impNaoPaga.includes(f1)};},['ag_'+A[0]]);
  ok(paga.g1.join()==='comprada'&&paga.iaDepois&&paga.g2.join()==='comprada'&&paga.g3===0&&paga.imp&&!paga.impNaoPaga,'segurança: base paga fica na galeria e na impressão (srvPull não mexe em sessão paga; republicação mantém); a não vendida fica fora: '+J(paga));
  const pou=await pg.evaluate(()=>ETERNA.demoSessions().find(x=>x.card==='LPTIAPOU4').photos.length);ok(pou===3,'9: poucas fotos: as 3 à venda: '+pou);
  // Checkout pelo código (19: as 5 montagens começam já, sem esperar o item aparecer)
  await pg.fill('#kcode','LPTIACAM1').catch(()=>{});
  const temCampo=await pg.$('#kcode');
  const t0=Date.now();
  if(temCampo)await pg.click('[data-act="kiosk-go"]');else await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.code='LPTIACAM1';k.so=null;k.step='review';k.i=0;ETERNA.render();ETERNA.iaAquecer('LPTIACAM1');});
  const pronto=await pg.evaluate(async()=>{const its=ETERNA.lojaAI('LPTIACAM1');const t=performance.now();const ks=its.map(x=>x.id+'|'+x.bg);
    const rs=await Promise.race([Promise.all(ks.map(async k=>{for(let i=0;i<80&&!ETERNA.COMP[k];i++)await new Promise(r=>setTimeout(r,50));return ETERNA.COMP[k]?await ETERNA.COMP[k]:{err:'sem COMP'};})),new Promise(r=>setTimeout(()=>r(null),8000))]);
    return {n:ks.length,ok:rs?rs.filter(r=>r&&r.url).length:0,ms:performance.now()-t,err:rs?rs.filter(r=>!r||!r.url).map(r=>r&&(r.err||r.pending)):['tempo']};});
  num.montagens_ms=Date.now()-t0;
  ok(pronto.n===5&&pronto.ok===5,'19: as 5 montagens prontas no COMP: '+J(pronto));
  ok(num.montagens_ms<=4000,'19: em até 4 s depois do código: '+num.montagens_ms+' ms');
  // 3: uma por fundo, com a base indicada
  const it=await pg.evaluate(()=>({ai:ETERNA.lojaAI('LPTIACAM1').map(x=>x.bg+'='+x.id+'@'+x.ses),items:ETERNA.lojaItems('LPTIACAM1').map(x=>x.t+':'+x.id),fotos:ETERNA.lojaFotos('LPTIACAM1').map(p=>p.id),on:ETERNA.bgOn()}));
  const f1='ag_'+A[0],f2='ag_'+A[1];
  const esper={arq1950:f1,podio:f1,campeao2:f2,mirante:f2,tunel:f2,telao:f2};
  ok(it.ai.length===5&&new Set(it.ai.map(x=>x.split('=')[0])).size===5&&it.ai.every(x=>{const [bg,r]=x.split('=');return esper[bg]===r.split('@')[0]&&r.endsWith('@LPTIACAM1');}),'3: 5 montagens, 1950 e Pódio na foto 1, as outras na foto 2: '+J(it.ai));
  ok(it.fotos.length===6&&!it.fotos.includes(f1)&&!it.fotos.includes(f2),'2: Checkout com as 6 fotos normais: '+J(it.fotos));
  ok(it.items.filter(x=>x.startsWith('ph:')).length===6&&!it.items.includes('ph:'+f1)&&!it.items.includes('ph:'+f2),'2: as bases nunca como foto na revisão: '+J(it.items));
  ok(PEDIDOS.every(p=>p.endsWith('|2400'))&&new Set(PEDIDOS.map(p=>p.split('|')[0])).size===2,'19: só os recortes das 2 bases: '+J(PEDIDOS));
  // 4: base 2 com olhos fechados = tudo na base 1; as duas ruins = jeito antigo (2 fotos normais)
  const r4=await pg.evaluate(([f1,f2])=>{ETERNA.SIM.invalid[f2]='olhos fechados';const um=ETERNA.lojaAI('LPTIACAM1').map(x=>x.id);ETERNA.FIA_RUIM.add(f1);const ant=ETERNA.lojaAI('LPTIACAM1').map(x=>x.id);
    delete ETERNA.SIM.invalid[f2];ETERNA.FIA_RUIM.delete(f1);return {um,ant};},[f1,f2]);
  ok(r4.um.length===5&&r4.um.every(x=>x===f1),'4: base ruim usa a outra: '+J(r4.um));
  ok(r4.ant.length>0&&!r4.ant.includes(f1)&&!r4.ant.includes(f2)&&r4.ant.every(x=>it.fotos.slice(0,2).includes(x)),'4: as duas ruins: jeito antigo com as 2 primeiras fotos normais: '+J(r4.ant));
  // A11: sessão de menor achada pela selfie sem a base em so.ids = sem as bases; D2: âncora sem ia passa para a próxima sessão
  const r11=await pg.evaluate(([f1,f2])=>{const k=ETERNA.state.kiosk;const so0=k.so;const card='LPTIACAM1';const fotos=ETERNA.lojaFotos(card).map(p=>p.id);
    k.so={card,cards:[card],ids:fotos.slice(0,3).concat([f2])};const s1=ETERNA.lojaAIBase(card);
    k.so={card:'LPTIASEM5',cards:['LPTIASEM5','LPTIACAM1'],ids:ETERNA.lojaIdsSo({LPTIASEM5:['x'],LPTIACAM1:[f1,f2]})};const s2=ETERNA.lojaAIBase('LPTIASEM5');const ai2=ETERNA.lojaAI('LPTIASEM5').length;
    k.so=so0;return {s1,s2,ai2};},[f1,f2]);
  ok(r11.s1.bases.join()===f2,'A11: só a base que está em so.ids: '+J(r11.s1));
  ok(r11.s2.ses==='LPTIACAM1'&&r11.s2.bases.length===2&&r11.ai2===5,'D2: âncora sem ia usa a próxima sessão (um conjunto de 5): '+J(r11));
  // A15 (R3): pela selfie, sessão achada só pela base de IA; nenhuma base como foto; sessão de menor só com a base reconhecida
  SIMS={[A[1]]:.72};
  const r15=await pg.evaluate(async([f1,f2])=>{const c=document.createElement('canvas');c.width=64;c.height=64;const k=ETERNA.state.kiosk;
    let r=await ETERNA.faceFind([c],x=>!x.demo);const achou=(r.res||[]).map(x=>x.card);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);
    const a={achou,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id),items:ETERNA.lojaItems(k.code).map(x=>x.t+':'+x.id),code:k.code,tot:(ETERNA.demoSessions().find(s=>s.card===k.code)||{photos:[]}).photos.length};
    ETERNA.lojaReset();ETERNA.SIM.sessions.LPTIACAM1.menor=true;
    r=await ETERNA.faceFind([c],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);
    const b={code:k.code,ids:k.so&&k.so.ids,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id),ai:ETERNA.lojaAI(k.code).map(x=>x.id)};
    delete ETERNA.SIM.sessions.LPTIACAM1.menor;ETERNA.lojaReset();return {a,b};},[f1,f2]);
  ok(r15.a.achou.join()==='LPTIACAM1'&&r15.a.code==='LPTIACAM1','A15: a selfie acha a sessão só pela base: '+J(r15.a.achou));
  // v97 (Eduardo, 10/11): a selfie abre a leva inteira (e a visita); a base continua fora das fotos
  ok(r15.a.fotos.length===r15.a.tot&&r15.a.tot>0&&!r15.a.items.includes('ph:'+f1)&&!r15.a.items.includes('ph:'+f2)&&r15.a.items.filter(x=>x.startsWith('ai:')).length===5,'A15: a leva inteira, nenhuma base como foto, com as 5 montagens: '+J(r15.a));
  ok(r15.b.code==='LPTIACAM1'&&r15.b.fotos.length===0&&r15.b.ai.length===5&&r15.b.ai.every(x=>x===f2),'A15: menor: só a base reconhecida nas montagens, nenhuma foto de fora: '+J(r15.b));
  SIMS={};
  // "Todas" conta só as fotos normais (+ as montagens escolhidas)
  const nSes=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.code='LPTIACAM1';k.so=null;return ETERNA.lojaCart('LPTIACAM1').nSes;});
  ok(nSes===6,'2: contagem do "Todas" sem as bases: '+nSes);
  // impressão, galeria e "Todas"
  const r2=await pg.evaluate(([f1,f2])=>{const s=ETERNA.SIM.sessions.LPTIACAM1;const sel0=s.selected;s.selected=[f1,ETERNA.lojaFotos('LPTIACAM1')[0].id];const imp=ETERNA.impFotos({...s,prints:5}).todas.map(x=>x.t+':'+x.id);s.selected=sel0;
    const tok=ETERNA.galDaSessao('LPTIACAM1',true);const g=ETERNA.SIM.galerias[tok].fotos.map(f=>f.id);return {imp,g};},[f1,f2]);
  ok(!r2.imp.includes('ph:'+f1)&&r2.imp.length===1,'2: impFotos tira a base: '+J(r2.imp));
  ok(r2.g.length===6&&!r2.g.includes(f1)&&!r2.g.includes(f2),'2: galeria sem as bases: '+J(r2.g));
  ok(!errs.length,'erros no Checkout: '+errs.join(' | '));

  // ---------- equipe: Upload, Fila do fotógrafo, Painel de controle ----------
  const pe=await ctx.newPage();const errs2=[];pe.on('pageerror',e=>errs2.push(e.message));
  await pe.goto(U);await pe.waitForTimeout(400);
  await pe.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pe.click('button[type=submit]');await pe.waitForTimeout(150);
  await pe.fill('[data-act="login-code"]',(await pe.textContent('.otp')).replace(/\s/g,''));await pe.waitForTimeout(500);
  const esp2=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pe.evaluate(fn))return true;await pe.waitForTimeout(150);}return false;};
  await pe.evaluate(()=>{ETERNA.state.imp.key='todos';ETERNA.state.imp.point='todos';ETERNA.go('importar');});
  ok(await esp2(()=>document.querySelectorAll('#up-sessoes .up-sess').length>=6,15000),'Upload com as sessões');
  await pe.waitForTimeout(400);
  const up=await pe.evaluate(()=>{const h=c=>{const b=document.querySelector(`.up-sess[data-card="${c}"]`);return b?b.querySelector('.up-sess-h').textContent.replace(/\s+/g,' '):'';};
    const b=document.querySelector('.up-sess[data-card="LPTIACAM1"]');const tags=b?[...b.querySelectorAll('.ph .tag')].map(t=>t.textContent+(t.classList.contains('tag-ia')?'#ia':'')):[];
    const ab=document.querySelector('.up-sess[data-card="LPTIAABR6"]');return {tags,cam:h('LPTIACAM1'),vol:h('LPTIAVOL2'),ves:h('LPTIAVES3'),pou:h('LPTIAPOU4'),sem:h('LPTIASEM5'),abr:ab?[...ab.querySelectorAll('.ph .tag')].map(t=>t.textContent):[]};});
  ok(up.tags[0]==='Fundo IA 1 · corpo inteiro#ia'&&up.tags[1]==='Fundo IA 2 · fechada#ia'&&up.tags.length===2,'14: tags das bases no Upload: '+J(up.tags));
  ok(/Fundos de IA: 2 de 2 prontas/.test(up.cam),'Upload: pílula das bases prontas: '+up.cam);
  ok(/Volante: sem fotos de IA/.test(up.vol)&&/Ponto fora da regra/.test(up.ves)&&/Poucas fotos: ficaram à venda/.test(up.pou)&&/Sem função do dia: fotos de IA não separadas/.test(up.sem),'8: pílulas do motivo: '+J([up.vol,up.ves,up.pou,up.sem]));
  ok(up.abr.join()==='Fundo IA?','Upload: sessão aberta marca a 1ª como Fundo IA?: '+J(up.abr));
  const tagIA=await pe.evaluate(()=>{return [...document.querySelectorAll('.ph .tag')].filter(t=>t.textContent==='IA').length;});
  ok(tagIA===0,'14: nenhuma base com a tag "IA" do ajuste automático');
  // testador v93: a tag longa não é cortada pela miniatura nem fica por cima da lupa (1366, 768 e 390 px, sem rolagem lateral)
  for(const w of [1366,768,390]){await pe.setViewportSize({width:w,height:900});await pe.waitForTimeout(250);
    const g=await pe.evaluate(()=>{const b=document.querySelector('.up-sess[data-card="LPTIACAM1"]');const out=[];
      (b?[...b.querySelectorAll('.ph .tag-ia')]:[]).forEach(t=>{const ph=t.closest('.ph').getBoundingClientRect(),r=t.getBoundingClientRect(),z=t.closest('.ph').querySelector('.zoom');const zr=z?z.getBoundingClientRect():null;
        out.push({txt:t.textContent,title:t.title,dentro:r.left>=ph.left-0.5&&r.right<=ph.right+0.5,lupa:!zr||r.right<=zr.left+0.5,elip:getComputedStyle(t).textOverflow==='ellipsis'});});
      return {out,rola:document.documentElement.scrollWidth>window.innerWidth+1};});
    ok(g.out.length===2&&g.out.every(x=>x.dentro&&x.lupa&&x.elip&&x.title===x.txt),'14 ('+w+' px): tag das bases dentro da miniatura, fora da lupa, com o texto inteiro no title: '+J(g.out));
    ok(!g.rola,'14 ('+w+' px): Upload sem rolagem lateral');}
  await pe.setViewportSize({width:1366,height:900});await pe.waitForTimeout(150);
  // 13: Fila do fotógrafo
  await pe.evaluate(()=>{localStorage.setItem('eterna.fotofila.tvmini','1');ETERNA.go('fotofila');});
  ok(await esp2(()=>/falta o 2º clique/.test(document.querySelector('#main').textContent),8000),'13: grupo aberto com 1 foto: "falta o 2º clique"');
  const ff=await pe.evaluate(()=>({t:document.querySelector('#main').textContent,mk:document.querySelectorAll('.ff-iamk img').length,ia:[...document.querySelectorAll('.ff-ia')].map(x=>x.textContent)}));
  ok(ff.ia.includes('Fundo IA ✓✓'),'13: pronto: Fundo IA ✓✓: '+J(ff.ia));
  ok(ff.mk===1,'13: a miniatura da base com a marca, com as miniaturas ligadas: '+ff.mk);
  await pe.evaluate(()=>{localStorage.setItem('eterna.fotofila.tvmini','0');ETERNA.render();});
  ok(await pe.evaluate(()=>document.querySelectorAll('.ff-iamk, .ff-thumbs img').length)===0,'13: sem miniaturas com ffMiniOn desligado');
  // fiaPanel
  const fp=await pe.evaluate(()=>{ETERNA.go('chroma');return document.querySelector('#main').textContent;});
  ok(/Fotos para IA: fila 1 · p90 21 s desde a chegada · 0 erros/.test(fp),'fiaPanel mostra a fila das bases: '+(fp.match(/Fotos para IA[^.]*/)||[''])[0]);
  // 12: Painel de controle
  await pe.evaluate(()=>ETERNA.go('catalogo'));await pe.waitForTimeout(200);
  ok(await pe.$('#ia-cfg'),'12: painel "Fotos para os fundos de IA" no Painel de controle');
  const pts=await pe.$$eval('#ia-cfg [data-act="ia-ponto"]',xs=>xs.map(x=>x.dataset.id+':'+x.checked));
  ok(pts.join()==='terminal:true,campo2:true,campo3:true,campo4:true,vestiario:false','12: padrão nos 4 pontos de campo, sem o Vestiário: '+J(pts));
  await pe.fill('#ia-cfg [data-act="ia-cliques"]','1');await pe.dispatchEvent('#ia-cfg [data-act="ia-cliques"]','change');await pe.waitForTimeout(200);
  await pe.click('#ia-cfg [data-act="ia-ponto"][data-id="vestiario"]');await pe.waitForTimeout(200);
  const c12=await pe.evaluate(()=>({c:ETERNA.iaCfg(),ls:JSON.parse(localStorage.getItem('eterna.ia.v1')||'null'),log:ETERNA.SIM.log.slice(0,3).map(x=>x.t),audit:ETERNA.auditRead().slice(0,2).map(x=>x.acao||x.tipo||x.a||'')}));
  ok(c12.c.cliques===1&&c12.c.pontos.includes('vestiario')&&c12.ls&&c12.ls.cliques===1&&c12.ls.por==='eduardo@eduardorezende.com','12: gravado com quem mudou: '+J(c12.c));
  ok(c12.log.some(t=>/Fundos de IA: 1 primeiro clique/.test(t)),'12: mudança no log: '+J(c12.log));
  await pe.click('#ia-cfg [data-act="ia-ligada"]');await pe.waitForTimeout(150);
  ok(await pe.evaluate(()=>ETERNA.iaCfg().ligada===false&&JSON.parse(localStorage.getItem('eterna.ia.v1')).ligada===false),'12: desligar grava a regra');
  // sem configuracao.u: campos desabilitados e guardAct barra
  const r12=await pe.evaluate(()=>{const u=ETERNA.state.user;const p0=u.perms;u.perms={...p0,configuracao:{r:true}};ETERNA.render();const dis=[...document.querySelectorAll('#ia-cfg input')].every(x=>x.disabled);
    const el=document.querySelector('#ia-cfg [data-act="ia-ligada"]');el.disabled=false;el.checked=!el.checked;el.dispatchEvent(new Event('change',{bubbles:true}));const lig=ETERNA.iaCfg().ligada;u.perms=p0;ETERNA.render();return {dis,lig,w:ETERNA.WRITE_OPS['ia-ligada'],m:ETERNA.ACT_MOD['ia-cliques']};});
  ok(r12.dis&&r12.lig===false&&r12.w==='u'&&r12.m==='configuracao','12: sem configuracao.u, desabilitado e barrado: '+J(r12));
  ok(!errs2.length,'erros nas telas da equipe: '+errs2.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e).toString().slice(0,600));}
finally{await b.close();}
if(fails.length){console.log('FALHA cliques-ia: '+fails.join(' || '));process.exit(1);}
console.log('OK cliques-ia: critérios 2, 3, 4, 8, 9, 12, 13, 14 e 19 do plano v93 (A11, D2) · '+J(num));
})();
