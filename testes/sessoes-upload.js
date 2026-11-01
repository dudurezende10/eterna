// v90: Sessões de hoje no Upload automático (critérios 21 a 25 do plano docs/planos/2026-10-30-sessoes-por-rosto-e-tempo.md).
// O agente é falso (page.route na própria origem: /status, /events, /biblioteca, /sessoes, /thumb/). Dados e miniaturas
// simulados (quadrados de cor), nunca foto de convidado. Prints em SESSOES_PRINTS (padrão: testes/prints/).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.SESSOES_PRINTS||path.join(__dirname,'prints');
const fails=[];let volMs=null;const ok=(c,m)=>{if(!c)fails.push(m);};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(12):
    im=Image.new('RGB',(240,160),(30+i*18,80+(i*29)%120,170-i*9));d=ImageDraw.Draw(im);d.ellipse([90,25,150,85],fill=(230,200,170));d.rectangle([70,90,170,160],fill=(20+i*15,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
let seqPid=0;const pids=n=>Array.from({length:n},()=>(0xabc000000000+(++seqPid)).toString(16));
const agora=()=>Date.now()/1000;
function sessao(o){const a=agora();const fotos=o.fotos||pids(o.n||6);return Object.assign({card:o.card,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:a-300,ultima_chegada:a-240,cap0:a-305,cap1:a-245,fonte_t:'cap',fechada_em:a-180,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1},o,{fotos});}
(async()=>{
const b=await chromium.launch();const errs=[];
const novo=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1440,height:h||1000},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>{localStorage.removeItem('eterna.session');});await pg.goto(U);await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
// agente falso: o feed muda conforme o teste (FEED.sessoes) e o rev sobe a cada troca
const FEED={gen:'b90',rev:10,rostos:true,sessoes:[],semSessoes:false};
async function agente(ctx){
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,agent:'eterna-agente',version:3,boot:'b90',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:FEED.rostos},
    sessoes:FEED.semSessoes?undefined:{v:2,pausa:60,rostos:FEED.rostos,rev:FEED.rev,gen:FEED.gen,hoje:FEED.sessoes.length,abertas:1}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>{const desde=+new URL(r.request().url()).searchParams.get('desde')||0;
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,gen:FEED.gen,rev:FEED.rev,pausa:60,rostos:FEED.rostos,completo:!desde,sessoes:FEED.sessoes.filter(x=>x.rev>desde)})});});
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-3),16)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:cores[0]}));}
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(200);}return false;};
try{
  const {ctx,pg}=await novo();await agente(ctx);
  const a=agora();
  const S_ABERTA=sessao({card:'LPK7Q2M9X',fotografo:'carlos',ponto:'terminal',status:'aberta',motivo:'rostos_novos',sim_abertura:.12,aberta_em:a-50,ultima_chegada:a-3,cap0:a-55,cap1:a-6,fechada_em:null,fechada_por:null,n:7,rev:12});
  S_ABERTA.pend=pids(2);
  const S_SEP=sessao({card:'LPH3D8W2R',fotografo:'carlos',ponto:'terminal',status:'separada',motivo:'pausa',aberta_em:a-150,ultima_chegada:a-55,cap0:a-158,cap1:a-60,fechada_em:null,fechada_por:null,n:5,rev:11});
  const S_FECH=sessao({card:'LPN4T6Y8B',fotografo:'samuel',ponto:'campo4',status:'fechada',motivo:'inicio',atrasada:true,trilha:'atrasada',fonte:'cartão',n:9,rev:10});
  FEED.sessoes=[S_ABERTA,S_SEP,S_FECH];FEED.rev=12;
  ok(await entrar(pg,'eduardo@eduardorezende.com'),'login do admin');
  await pg.evaluate(()=>{ETERNA.state.imp.key='todos';ETERNA.state.imp.point='todos';ETERNA.go('importar');});
  ok(await espera(pg,()=>document.querySelectorAll('#up-sessoes .up-sess').length===3),'21: três blocos de sessão no Upload: '+await pg.evaluate(()=>document.querySelectorAll('.up-sess').length));
  // 21: cabeçalho completo e só a aberta com "on"
  const blocos=await pg.$$eval('.up-sess',bs=>bs.map(b=>({card:b.dataset.card,on:b.classList.contains('on'),h:b.querySelector('.up-sess-h').textContent.replace(/\s+/g,' ').trim(),th:b.querySelectorAll('.ph').length,pend:b.querySelectorAll('.ph[data-pend="1"]').length})));
  ok(blocos.map(x=>x.card).join(',')==='LPK7Q2M9X,LPH3D8W2R,LPN4T6Y8B','21: do mais novo para o mais antigo: '+blocos.map(x=>x.card));
  ok(blocos.filter(x=>x.on).map(x=>x.card).join()==='LPK7Q2M9X','21: só a aberta tem a classe on: '+JSON.stringify(blocos.map(x=>[x.card,x.on])));
  const hh=t=>new Date(t*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  [[0,['LPK7Q2M9X','Carlos','Terminal Campo',hh(S_ABERTA.cap0)+'–'+hh(S_ABERTA.cap1),'9 fotos','rostos novos','aberta · recebendo']],
   [1,['LPH3D8W2R','Carlos','Terminal Campo','5 fotos','pausa de 1 min','fechando']],
   [2,['LPN4T6Y8B','Samuel','Foto Campo 4','9 fotos','primeira do dia','atrasada','fechada · 1 min sem foto','Abrir sessão']]].forEach(([i,ss])=>ss.forEach(t=>ok(blocos[i]&&blocos[i].h.includes(t),`21: falta "${t}" no cabeçalho ${i}: ${blocos[i]&&blocos[i].h}`)));
  ok(blocos[0]&&blocos[0].th===9&&blocos[0].pend===2,'21: pendentes com "lendo rostos": '+JSON.stringify(blocos[0]));
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.up-sess .ph[data-pend="1"] .tag')].every(t=>t.textContent==='lendo rostos')),'21: tag lendo rostos');
  ok(!(await pg.$('#up-sessoes .up-aviso')),'aviso de rostos desligados só sem rostos');
  ok(!/Sessão em formação|Sessões criadas nesta leva/.test(await pg.textContent('#main')),'21: o painel antigo sai com o agente de sessões');
  // a fechada virou sessão do SIM com os dados do agente (revisão 6)
  const sim=await pg.evaluate(()=>ETERNA.SIM.sessions.LPN4T6Y8B);
  ok(sim&&sim.srv&&sim.key==='samuel'&&sim.point==='campo4'&&sim.pdv==='Foto Campo 4'&&sim.source==='cartao'&&sim.motivo==='inicio'&&Math.abs(new Date(sim.closedAt).getTime()/1000-S_FECH.fechada_em)<1&&sim.photos.length===9,
     'revisão 6: sessão do SIM com ponto, fechamento, origem, fotógrafo e motivo do agente: '+JSON.stringify(sim&&{key:sim.key,point:sim.point,source:sim.source,motivo:sim.motivo,closedAt:sim.closedAt,n:sim.photos.length}));
  ok(await pg.evaluate(()=>!ETERNA.SIM.sessions.LPK7Q2M9X&&!ETERNA.SIM.sessions.LPH3D8W2R),'S8: aberta e separada não entram no SIM');
  // 22: miniaturas carregadas, modal grande, setas só na sessão
  await pg.evaluate(()=>document.querySelector('.up-sess').scrollIntoView());await pg.waitForTimeout(600);
  const nw=await pg.$$eval('.up-sess .ph img',is=>is.map(i=>{i.scrollIntoView();return i.loading==='lazy';}));ok(nw.length===23&&nw.every(Boolean),'22: miniaturas com loading lazy: '+nw.length);
  await pg.waitForTimeout(800);
  ok(await espera(pg,()=>[...document.querySelectorAll('.up-sess .ph img')].every(i=>i.complete&&i.naturalWidth>0)),'22: toda miniatura com naturalWidth > 0');
  await pg.evaluate(()=>window.scrollTo(0,document.querySelector('#up-sessoes').offsetTop-20));await pg.waitForTimeout(300);
  fs.mkdirSync(PRINTS,{recursive:true});
  await pg.screenshot({path:path.join(PRINTS,'v90-upload-sessoes.png')});
  await pg.click('.up-sess[data-card="LPH3D8W2R"] .ph >> nth=1');await pg.waitForTimeout(300);
  const cap0=await pg.textContent('#modal-cap');ok(/LPH3D8W2R · foto 2 de 5/.test(cap0)&&await pg.evaluate(()=>document.querySelector('#modal').classList.contains('open')||getComputedStyle(document.querySelector('#modal')).display!=='none'),'22: clicar abre o modal grande da sessão: '+cap0);
  await pg.screenshot({path:path.join(PRINTS,'v90-upload-modal.png')});
  const caps=[];for(let i=0;i<5;i++){await pg.click('#modal-next');await pg.waitForTimeout(80);caps.push(await pg.textContent('#modal-cap'));}
  ok(caps.every(c=>/LPH3D8W2R/.test(c))&&/foto 2 de 5/.test(caps[4])&&/foto 1 de 5/.test(caps[3]),'22: as setas percorrem só a sessão: '+caps.join(' | '));
  await pg.keyboard.press('Escape');await pg.waitForTimeout(200);
  // 23: filtros Fotógrafo e Ponto
  await pg.selectOption('select[data-act="imp-key"]','samuel');await pg.waitForTimeout(300);
  ok((await pg.$$eval('.up-sess',bs=>bs.map(b=>b.dataset.card))).join()==='LPN4T6Y8B','23: filtro Fotógrafo');
  await pg.selectOption('select[data-act="imp-key"]','todos');await pg.waitForTimeout(200);
  await pg.selectOption('select[data-act="imp-point"]','terminal');await pg.waitForTimeout(300);
  ok((await pg.$$eval('.up-sess',bs=>bs.map(b=>b.dataset.card))).join()==='LPK7Q2M9X,LPH3D8W2R','23: filtro Ponto');
  await pg.selectOption('select[data-act="imp-point"]','todos');await pg.waitForTimeout(300);
  // Abrir sessão (só leitura) leva à sessão na Qualidade
  await pg.click('[data-act="up-sess-abrir"][data-card="LPN4T6Y8B"]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>ETERNA.state.view==='revisao'&&ETERNA.state.session==='LPN4T6Y8B'),'Abrir sessão leva à sessão: '+await pg.evaluate(()=>ETERNA.state.view+' '+ETERNA.state.session));
  ok(!(await pg.evaluate(()=>'up-sess-abrir' in ETERNA.WRITE_OPS||'up-sess-mais' in ETERNA.WRITE_OPS||'up-sess-tudo' in ETERNA.WRITE_OPS)),'ações só de leitura fora do WRITE_OPS');
  await pg.evaluate(()=>{ETERNA.state.session=null;ETERNA.go('importar');});await pg.waitForTimeout(300);
  // fusão (S7): a separada some quando vem removida; LGPD na fechada: as fotos saem do SIM (sem venda paga)
  S_SEP.removida=true;S_SEP.fundida_em='LPK7Q2M9X';S_SEP.status='fechada';S_SEP.rev=13;S_ABERTA.fotos=S_ABERTA.fotos.concat(S_SEP.fotos);S_ABERTA.rev=14;
  S_FECH.fotos=S_FECH.fotos.slice(2);S_FECH.rev=15;FEED.rev=15;
  ok(await espera(pg,()=>!document.querySelector('.up-sess[data-card="LPH3D8W2R"]')&&document.querySelectorAll('.up-sess[data-card="LPK7Q2M9X"] .ph').length===14),'S7: a separada fundida some e a aberta mostra as fotos juntas');
  ok(await espera(pg,()=>ETERNA.SIM.sessions.LPN4T6Y8B.photos.length===7),'revisão 5: LGPD tira as fotos da sessão do SIM sem venda: '+await pg.evaluate(()=>ETERNA.SIM.sessions.LPN4T6Y8B.photos.length));
  // aviso de rostos desligados
  FEED.rostos=false;FEED.rev=16;S_ABERTA.rev=16;
  ok(await espera(pg,()=>/Rostos desligados neste computador: as sessões estão sendo separadas só por tempo \(1 minuto\)\./.test((document.querySelector('#up-sessoes .up-aviso')||{}).textContent||'')),'aviso de rostos desligados');
  FEED.rostos=true;
  // celular: cabeçalho quebra a linha sem estourar
  await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(300);await pg.evaluate(()=>window.scrollTo(0,document.querySelector('#up-sessoes').offsetTop-10));await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.up-sess')].every(b=>b.scrollWidth<=b.clientWidth+1)&&document.querySelector('#up-sessoes').scrollWidth<=document.querySelector('#up-sessoes').clientWidth+1),'celular: painel e blocos sem rolagem lateral');
  await pg.screenshot({path:path.join(PRINTS,'v90-upload-celular.png')});
  await pg.setViewportSize({width:1440,height:1000});
  // 24: volume (120 sessões, 3.000 fotos)
  const muitas=[];for(let i=0;i<120;i++){const n=i===0?100:24+(i%3);muitas.push(sessao({card:'LPV'+String(i).padStart(6,'0'),fotografo:['carlos','samuel','yago'][i%3],ponto:['terminal','campo4','campo2'][i%3],status:i===0?'aberta':i<3?'separada':'fechada',motivo:i%2?'pausa':'rostos_novos',aberta_em:a-i*90,cap0:a-i*90-5,cap1:a-i*90+40,n,rev:100+i}));}
  const tot=muitas.reduce((s,x)=>s+x.fotos.length,0);
  FEED.gen='b90-volume';FEED.sessoes=muitas;FEED.rev=300;
  ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length===120,15000),'24: feed de 120 sessões carregado');
  const vol=await pg.evaluate(()=>{const t0=performance.now();ETERNA.render();const ms=performance.now()-t0;const bs=[...document.querySelectorAll('.up-sess')];return {ms,blocos:bs.length,max:Math.max(...bs.map(b=>b.querySelectorAll('.ph').length)),mais:!!document.querySelector('[data-act="up-sess-mais"]'),tudo:!!document.querySelector('[data-act="up-sess-tudo"]')};});
  ok(tot>=3000&&vol.blocos===30&&vol.max<=48&&vol.mais&&vol.tudo,'24: 30 blocos com até 48 miniaturas, "Ver mais 30" e "+N": '+JSON.stringify(vol)+' fotos '+tot);
  volMs=vol.ms;ok(vol.ms<150,'24: render do Upload em menos de 150 ms: '+vol.ms.toFixed(1)+' ms');
  await pg.waitForTimeout(2600);ok(await pg.$$eval('.up-sess',bs=>bs.length)===30,'24: continua com 30 blocos depois do próximo ciclo: '+await pg.evaluate(()=>ETERNA.state.view+' '+document.querySelectorAll('.up-sess').length+' '+Object.keys(ETERNA.SRV.sess).length));
  await pg.evaluate(()=>document.querySelector('[data-act="up-sess-mais"]').click()); // a tela redesenha a cada sessão validada: clique diretoawait pg.waitForTimeout(300);ok(await pg.$$eval('.up-sess',bs=>bs.length)===60,'24: Ver mais 30');
  await pg.evaluate(()=>document.querySelector('.up-sess[data-card="LPV000000"] [data-act="up-sess-tudo"]').click());await pg.waitForTimeout(300);ok(await pg.$$eval('.up-sess[data-card="LPV000000"] .ph',x=>x.length)===100,'24: +N mostra todas da sessão');
  await ctx.close();
  // 25: agente antigo (sem st.sessoes) e sem agente: o painel antigo continua
  {const {ctx,pg}=await novo();FEED.semSessoes=true;await agente(ctx);await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(3000);
    const r=await pg.evaluate(()=>{const s=ETERNA.state;s.ing.cur={photos:[{id:'c01_0',sold:0}],flags:{},start:new Date().toISOString()};ETERNA.render();return {on:s.agent.on,ses:!!s.agent.sessoes,painel:!!document.querySelector('#up-sessoes'),antigo:/Sessão em formação/.test(document.querySelector('#main').textContent)};});
    ok(r.on&&!r.ses&&!r.painel&&r.antigo,'25: agente sem sessões mantém "Sessão em formação": '+JSON.stringify(r));await ctx.close();}
  {const {ctx,pg}=await novo();await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(500);
    ok(!(await pg.$('#up-sessoes'))&&await pg.evaluate(()=>!ETERNA.state.agent.on),'25: sem agente, sem o painel novo');await ctx.close();}
  // o Upload do fotógrafo: começa no nome dele e vê as sessões dele
  {FEED.semSessoes=false;FEED.gen='b90-foto';FEED.sessoes=[S_ABERTA,S_FECH];FEED.rev=400;S_ABERTA.rev=399;S_FECH.rev=400;
    const {ctx,pg}=await novo();await agente(ctx);await entrar(pg,'carlos@eterna.photo');await pg.evaluate(()=>{ETERNA.state.imp.point='todos';ETERNA.go('importar');});
    ok(await espera(pg,()=>[...document.querySelectorAll('.up-sess')].map(b=>b.dataset.card).join()==='LPK7Q2M9X'),'fotógrafo vê as sessões dele no Upload');await ctx.close();}
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const okk=!fails.length;console.log(`${okk?'OK':'FALHA'} sessoes-upload: critérios 21 a 25 (Sessões de hoje no Upload, filtros, modal, volume, compatibilidade)${volMs!=null?' · render com 120 sessões: '+volMs.toFixed(0)+' ms':''}${okk?'':' · '+fails.slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
