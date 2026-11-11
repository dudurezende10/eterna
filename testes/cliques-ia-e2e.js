// v93 (testador): os cliques de IA com o AGENTE DE VERDADE (testes/_cliques_ia_lanca.py: recorte falso só por m.REC_FALSO_SEG),
// servindo o app (ETERNA_APP_ORIGIN = servidor do rodar.sh) e montando as sessões, a fila de recorte, o /fila-fotografo e o
// estado.db. Fotos sintéticas (PNG com uma silhueta desenhada) mandadas pelo FTP embutido (testes/_cliques_ia_semear.py).
// Só a busca do rosto da selfie é simulada (page.route em /rostos/buscar): foto sintética não tem rosto.
// Critérios do plano docs/planos/2026-11-06-dois-cliques-ia.md: 2, 3, 4 (com "sem pessoa" de verdade), 5, 8, 12 (pelo Painel,
// até o agente), 13, 14, 19, A11, A15, D2; e o que o plano não pediu: celular (390 px) e tablet (768 px) sem rolagem lateral,
// idiomas, cliques repetidos e erros de JS. Prints em testes/prints/ (não versionados).
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const PRINTS=path.join(__dirname,'prints');try{fs.mkdirSync(PRINTS,{recursive:true});}catch(e){}
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const num={};
const livre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
function req(porta,method,p,body,headers={}){return new Promise(res=>{const data=body==null?null:Buffer.from(JSON.stringify(body));
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:{...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch);let j=null;try{j=JSON.parse(b.toString())}catch(e){}res({s:rs.statusCode,j});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
const hoje=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

(async()=>{let proc=null,b=null;const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v93-app-'));let LOGA='';
try{
  const PORTA=await livre(),FTPP=await livre();const AO='http://127.0.0.1:'+PORTA;
  proc=spawn('python3',['-I','-u',path.join(__dirname,'_cliques_ia_lanca.py'),AG,'0.3'],{env:{...process.env,HOME:H,USERPROFILE:H,ETERNA_PORTA:String(PORTA),ETERNA_FTP_PORTA:String(FTPP),ETERNA_APP_ORIGIN:ORIG,ETERNA_SEM_OPENCV:'1',ETERNA_SESSAO_PAUSA:'5',ETERNA_LEITORES:'1',USER:'eterna-teste-sem-cartao',ETERNA_PRE_RECORTE:'1'},stdio:['ignore','pipe','pipe']});
  proc.stdout.on('data',d=>LOGA+=d);proc.stderr.on('data',d=>LOGA+=d);
  let up=false;for(let i=0;i<80&&!up;i++){await sleep(250);up=(await req(PORTA,'GET','/status')).s===200;}
  if(!up)throw new Error('agente não subiu: '+LOGA.slice(-400));
  // dados vazios: agente sem nenhuma foto; Upload, Fila do fotógrafo e Painel de controle abrem sem erro
  {const bv=await chromium.launch();const cv=await bv.newContext({viewport:{width:1366,height:900}});await cv.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pv=await cv.newPage();const ev=[];pv.on('pageerror',e=>ev.push(e.message));
    await pv.goto(AO+'/index.html');await pv.waitForTimeout(500);await pv.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pv.click('button[type=submit]');await pv.waitForTimeout(200);
    await pv.fill('[data-act="login-code"]',(await pv.textContent('.otp')).replace(/\s/g,''));await pv.waitForTimeout(600);
    for(const v of ['importar','fotofila','catalogo','chroma']){await pv.evaluate(v=>ETERNA.go(v),v);await pv.waitForTimeout(700);}
    const vz=await pv.evaluate(()=>{ETERNA.go('fotofila');return document.querySelector('#main').textContent;});
    ok(!ev.length&&!/Fundo IA/.test(vz),'vazio: telas da equipe sem fotos abrem sem erro: '+ev.join(' | '));await bv.close();}
  const semear=(quem,n,vazias)=>{try{return JSON.parse(execFileSync('python3',['-I',path.join(__dirname,'_cliques_ia_semear.py'),String(PORTA),String(FTPP),H,quem,String(n),vazias||''],{stdio:['ignore','pipe','pipe']}).toString().trim());}catch(e){throw new Error('semear '+quem+': '+String(e.stdout||'')+String(e.stderr||'').slice(-300)+' · agente: '+LOGA.slice(-700));}};
  const sessoes=async()=>((await req(PORTA,'GET','/sessoes')).j||{}).sessoes||[];
  const sesDe=async pid=>(await sessoes()).find(x=>(x.fotos||[]).concat(x.pend||[]).includes(pid));
  const fechada=async(pid,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||20000)){const x=await sesDe(pid);if(x&&x.status==='fechada')return x;await sleep(300);}return null;};
  const recOk=pid=>fs.existsSync(path.join(H,'Eterna','recortes',pid+'_2400.png'))&&fs.existsSync(path.join(H,'Eterna','recortes',pid+'.png'));
  const fr=await req(PORTA,'POST','/fila-fotografo/funcao',{dia:hoje(),map:{yago:{tipo:'campo',point:'campo2'},carlos:{tipo:'campo',point:'terminal'},samuel:{tipo:'volante',modo:'livre'},marinara:{tipo:'campo',point:'vestiario'},marcio:{tipo:'campo',point:'campo4'},sandessa:{tipo:'campo',point:'campo3'}}},{'X-Eterna':'1'});
  ok(fr.s===200,'função do dia: '+J(fr));
  // S: 8 fotos no campo2 (Yago); S2: base 2 sem pessoa (Carlos); S3: as duas bases sem pessoa (Márcio); volante, Vestiário e sem função
  const S=semear('yago',8);
  const t2=Date.now();let antes=null;for(let i=0;i<100&&!antes;i++){if(recOk(S[0])&&recOk(S[1])){const x=await sesDe(S[0]);antes={ms:Date.now()-t2,st:x&&x.status};}else await sleep(100);}
  const S2=semear('carlos',6,'1'),S3=semear('marcio',6,'0,1');
  const V=semear('samuel',4),W=semear('marinara',4),K=semear('klassius',4),P=semear('sandessa',2);
  ok(antes&&antes.st==='aberta'&&antes.ms<=30000,'5: recortes das 2 bases prontos com a sessão aberta: '+J(antes));
  const xS=await fechada(S[0],25000),xS2=await fechada(S2[0]),xS3=await fechada(S3[0]),xV=await fechada(V[0]),xW=await fechada(W[0]),xK=await fechada(K[0]),xP=await fechada(P[0]);
  ok(xS&&J(xS.ia)===J(S.slice(0,2))&&xS.ia_regra&&xS.ia_regra.n===2&&xS.ia_regra.motivo===null,'1: ia da sessão de 8 fotos = 2 primeiras: '+J(xS&&[xS.ia,xS.ia_regra]));
  ok(xV&&xV.ia_regra.motivo==='volante'&&xW&&xW.ia_regra.motivo==='ponto_fora'&&xK&&xK.ia_regra.motivo==='sem_funcao'&&xP&&xP.ia_regra.motivo==='poucas_fotos','8/9: motivos: '+J([xV&&xV.ia_regra,xW&&xW.ia_regra,xK&&xK.ia_regra,xP&&xP.ia_regra]));
  for(const p of S2.slice(0,2).concat(S3.slice(0,2))){for(let i=0;i<60&&!recOk(p);i++)await sleep(100);}
  const f1='ag_'+S[0],f2='ag_'+S[1];

  b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  let SIMS={};await ctx.route(AO+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:J({rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim,principal:true}))})}));
  const RECS=[];ctx.on('request',r=>{if(/\/recorte/.test(r.url()))RECS.push(r.method()+' '+r.url().replace(AO,'')+' '+(r.postData()||''));});
  const errs=[];const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push('loja: '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404|ort|wasm|face-api|models/i.test(m.text()))errs.push('loja console: '+m.text());});
  await pg.goto(AO+'/index.html#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(c=>c.every(x=>ETERNA.SIM.sessions[x]),25000,[xS.card,xS2.card,xS3.card,xV.card,xP.card]),'as sessões do agente chegaram ao SIM do Checkout');
  ok(await espera(()=>ETERNA.state.agent&&ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,10000),'Checkout vê o agente com o recorte pronto');
  // a validação de IA do navegador roda sobre desenhos: aqui as fotos contam como válidas (o teste de olhos fechados vem depois)
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));});
  const b0=await pg.evaluate(([c,f1,f2])=>{const s=ETERNA.SIM.sessions[c];const o=ETERNA.demoSessions().find(x=>x.card===c);return {ia:s.ia,n:o.photos.length,oia:o.ia,tem:o.photos.some(p=>p.id===f1||p.id===f2),total:o.total};},[xS.card,f1,f2]);
  ok(J(b0.ia)===J([f1,f2])&&b0.n===6&&!b0.tem&&b0.total===6,'2: no Checkout a sessão tem 6 fotos à venda e as 2 bases em ia: '+J(b0));
  // Checkout pelo código, com cliques repetidos no botão (19: as 5 montagens no COMP em até 4 s)
  num.kiosk_antes=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,so:k.so,cam:ETERNA.state.cam&&ETERNA.state.cam.status};});
  for(let i=0;i<20&&!(await pg.$('#kcode'));i++){await pg.evaluate(()=>{const b=document.querySelector('[data-act="kiosk-emerg"]');if(b)b.click();});await pg.waitForTimeout(150);} /* sem câmera, o Checkout já pode estar no código */
  // o código e o clique no mesmo instante (um render do Checkout no meio apaga o que foi digitado: comportamento de antes da v93)
  const t0=Date.now();await pg.evaluate(c=>{const i=document.querySelector('#kcode');i.value=c;const g=document.querySelector('[data-act="kiosk-go"]');g.click();g.click();},xS.card);await pg.click('[data-act="kiosk-go"]',{timeout:300}).catch(()=>{});
  const pronto=await pg.evaluate(async c=>{const ks=ETERNA.lojaAI(c).map(x=>x.id+'|'+x.bg);for(let i=0;i<160&&!ks.every(k=>ETERNA.COMP[k]);i++)await new Promise(r=>setTimeout(r,25));
    const rs=await Promise.all(ks.map(k=>ETERNA.COMP[k]?ETERNA.COMP[k]:{err:'sem COMP'}));const a=ETERNA.state.agent;const diag=rs.some(r=>!r||!r.url)?{on:a.on,rec:a.recorte&&a.recorte.ok,modo:ETERNA.fundosModo&&ETERNA.fundosModo(),ai:ETERNA.lojaAI(c).length,step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code,depois:await Promise.all(ks.slice(0,2).map(async k=>{const [i,b]=k.split('|');const r=await ETERNA.compose(i,b);return r&&(r.url?'url':(r.err||r.pending));}))}:null;return {n:ks.length,ok:rs.filter(r=>r&&r.url).length,err:rs.filter(r=>!r||!r.url).map(r=>r&&(r.err||r.pending)),diag};},xS.card);
  num.montagens_ms=Date.now()-t0;
  ok(pronto.n===5&&pronto.ok===5&&num.montagens_ms<=4000,'19: as 5 montagens prontas em até 4 s (agente de verdade): '+J({...pronto,ms:num.montagens_ms}));
  const it=await pg.evaluate(c=>({ai:ETERNA.lojaAI(c).map(x=>x.bg+'='+x.id),items:ETERNA.lojaItems(c).map(x=>x.t+':'+x.id),fotos:ETERNA.lojaFotos(c).map(p=>p.id),step:ETERNA.state.kiosk.step,nSes:ETERNA.lojaCart(c).nSes}),xS.card);
  const esper={arq1950:f1,podio:f1,campeao2:f2,mirante:f2,tunel:f2,telao:f2};
  ok(it.ai.length===5&&it.ai.every(x=>{const [bg,id]=x.split('=');return esper[bg]===id;}),'3: 5 montagens: 1950 e Pódio na foto 1, Campeão, Mirante e Túnel na foto 2: '+J(it.ai));
  ok(it.fotos.length===6&&!it.items.includes('ph:'+f1)&&!it.items.includes('ph:'+f2)&&it.items.filter(x=>x.startsWith('ph:')).length===6,'2: Checkout por código sem as bases como foto: '+J(it.items));
  ok(it.nSes===6,'2: contagem do "Todas" = 6: '+it.nSes);
  ok(RECS.filter(r=>/POST/.test(r)).length<=2,'cliques repetidos: no máximo 1 pedido de recorte por base: '+J(RECS));
  // percorre os itens na tela e confere o DOM: nenhuma foto à venda com a base
  const dom=[];for(let i=0;i<it.items.length;i++){await pg.evaluate(i=>{ETERNA.state.kiosk.ver=ETERNA.state.kiosk.i=i;ETERNA.render();},i);await pg.waitForTimeout(60);dom.push(await pg.evaluate(()=>[...document.querySelectorAll('#main [data-id]')].map(e=>e.dataset.id)));}
  ok(!dom.flat().some(id=>id===f1||id===f2),'2: as bases nunca aparecem como foto (data-id) na revisão');
  await pg.evaluate(()=>{ETERNA.state.kiosk.ver=ETERNA.state.kiosk.i=3;ETERNA.render();});await pg.waitForTimeout(700);await pg.screenshot({path:path.join(PRINTS,'v93-checkout-montagem.png')});
  await pg.evaluate(()=>{ETERNA.state.kiosk.list=true;ETERNA.render();});await pg.waitForTimeout(900);await pg.screenshot({path:path.join(PRINTS,'v93-checkout-todas.png')});
  num.lista_comp=await pg.evaluate(()=>[...document.querySelectorAll('[data-comp]')].map(e=>e.classList.contains('ok')?'ok':(e.textContent||'?')).join(','));await pg.evaluate(()=>{ETERNA.state.kiosk.list=false;ETERNA.render();});
  // galeria (#g), impressão e "Todas"
  const g=await pg.evaluate(([c,f1])=>{const s=ETERNA.SIM.sessions[c];const tok=ETERNA.galDaSessao(c,true);const gf=ETERNA.SIM.galerias[tok].fotos.map(f=>f.id);const sel0=s.selected;s.selected=[f1,ETERNA.lojaFotos(c)[0].id];
    const imp=ETERNA.impFotos({...s,prints:5}).todas.map(x=>x.t+':'+x.id);s.selected=sel0;delete ETERNA.SIM.galerias[tok];return {gf,imp,tok};},[xS.card,f1]);
  ok(g.gf.length===6&&!g.gf.includes(f1)&&!g.gf.includes(f2),'2: galeria #g sem as bases: '+J(g.gf));
  ok(!g.imp.includes('ph:'+f1)&&g.imp.length===1,'2: impFotos sem a base: '+J(g.imp));
  // 4 com o agente: base 2 sem pessoa (recorte vazio de verdade) e as duas sem pessoa
  const r4=async c=>{await pg.evaluate(c=>{ETERNA.lojaReset();const k=ETERNA.state.kiosk;k.code=c;k.so=null;k.step='review';k.i=0;ETERNA.render();ETERNA.iaAquecer(c);},c);
    for(let i=0;i<12;i++){await pg.evaluate(i=>{const k=ETERNA.state.kiosk;const n=ETERNA.lojaItems(k.code).length;k.ver=k.i=i%Math.max(1,n);ETERNA.render();},i);await pg.waitForTimeout(250);}
    await pg.evaluate(()=>{ETERNA.state.kiosk.list=true;ETERNA.render();});await pg.waitForTimeout(1500);await pg.screenshot({path:path.join(PRINTS,'v93-checkout-base-ruim-'+c+'.png')});
    return pg.evaluate(async c=>{const its=ETERNA.lojaAI(c);const cr={};for(const x of its){const r=await ETERNA.compose(x.id,x.bg);cr[x.id.slice(-4)+'|'+x.bg]=r&&(r.url?'url':(r.err||r.pending));}
      return {ai:ETERNA.lojaAI(c).map(x=>x.id),fotos:ETERNA.lojaFotos(c).map(p=>p.id),ruim:[...ETERNA.FIA_RUIM],cr,dom:[...document.querySelectorAll('[data-comp]')].map(e=>e.dataset.comp.slice(-14)+(e.dataset.done?'*':''))};},c);};
  const a2=await r4(xS2.card);
  ok(a2.ai.length===5&&a2.ai.every(x=>x==='ag_'+S2[0]),'4: base 2 sem pessoa: os 5 fundos usam a base 1: '+J(a2));
  const a3=await r4(xS3.card);
  // o jeito antigo (lojaAIAntigo, v84) troca a foto que a análise do navegador reprova; em desenho sintético ela pode reprovar todas (aí fica sem montagem: limite do teste, não da v93)
  num.antigo_n=a3.ai.length;ok(!a3.ai.includes('ag_'+S3[0])&&!a3.ai.includes('ag_'+S3[1])&&a3.ai.every(x=>a3.fotos.includes(x))&&a3.fotos.length===4,'4: as duas sem pessoa: jeito antigo (fotos normais do cliente, que seguem à venda): '+J(a3));
  // 4: olhos fechados na base 1 da S: tudo na base 2
  const a4=await pg.evaluate(([c,f1])=>{ETERNA.SIM.invalid[f1]='olhos fechados';const r=ETERNA.lojaAI(c).map(x=>x.id);delete ETERNA.SIM.invalid[f1];return r;},[xS.card,f1]);
  ok(a4.length===5&&a4.every(x=>x===f2),'4: olhos fechados na base 1: os 5 na base 2: '+J(a4));
  // A15 pela selfie: a sessão achada só pela base 2; inteira, sem base como foto; menor: só a base reconhecida
  SIMS={[S[1]]:.72};
  const s15=await pg.evaluate(async c=>{const cv=document.createElement('canvas');cv.width=64;cv.height=64;const k=ETERNA.state.kiosk;ETERNA.lojaReset();ETERNA.state.agent.rostos={ligado:true};
    let r=await ETERNA.faceFind([cv],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);const a={code:k.code,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id),ai:ETERNA.lojaAI(k.code).map(x=>x.id),items:ETERNA.lojaItems(k.code).map(x=>x.t+':'+x.id),tot:(ETERNA.demoSessions().find(s=>s.card===k.code)||{photos:[]}).photos.length};
    ETERNA.lojaReset();ETERNA.SIM.sessions[c].menor=true;ETERNA.state.agent.rostos={ligado:true};r=await ETERNA.faceFind([cv],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);
    const m={code:k.code,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id),ai:ETERNA.lojaAI(k.code).map(x=>x.id)};delete ETERNA.SIM.sessions[c].menor;ETERNA.lojaReset();return {a,m};},xS.card);
  // v97 (Eduardo, 10/11): a selfie abre a leva inteira (e a visita); a base continua fora das fotos
  ok(s15.a.code===xS.card&&s15.a.fotos.length===s15.a.tot&&s15.a.tot>0&&s15.a.ai.length===5&&!s15.a.items.includes('ph:'+f2)&&!s15.a.items.includes('ph:'+f1),'A15: selfie pela base: a leva inteira, 5 montagens, base nunca como foto: '+J(s15.a));
  ok(s15.m.code===xS.card&&s15.m.fotos.length===0&&s15.m.ai.length===5&&s15.m.ai.every(x=>x===f2),'A11: menor: só a base reconhecida: '+J(s15.m));
  SIMS={};
  // idiomas: Checkout com as montagens em en, es, fr, de, sem erro e sem texto novo em português
  for(const l of ['en','es','fr','de']){await pg.evaluate(([c,l])=>{ETERNA.state.lang=l;try{localStorage.setItem('eterna.lang',l);}catch(e){}const k=ETERNA.state.kiosk;k.code=c;k.so=null;k.step='review';k.list=false;k.ver=k.i=3;ETERNA.render();},[xS.card,l]);await pg.waitForTimeout(250);}
  await pg.screenshot({path:path.join(PRINTS,'v93-checkout-de.png')});
  const txtDe=await pg.evaluate(()=>document.querySelector('#main').innerText);
  ok(!/Fundo IA|corpo inteiro|fechada/.test(txtDe),'idiomas: nenhum rótulo da equipe na tela do cliente: '+txtDe.slice(0,200));
  await pg.evaluate(()=>{ETERNA.state.lang='pt';try{localStorage.setItem('eterna.lang','pt');}catch(e){}ETERNA.lojaReset();ETERNA.render();});
  // celular e tablet: revisão do Checkout sem rolagem lateral
  for(const [w,h] of [[390,844],[768,1024]]){await pg.setViewportSize({width:w,height:h});await pg.evaluate(c=>{const k=ETERNA.state.kiosk;k.code=c;k.so=null;k.step='review';k.list=false;k.ver=k.i=3;ETERNA.render();},xS.card);await pg.waitForTimeout(400);
    const sw=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));ok(sw.sw<=sw.w+1,`Checkout ${w}px sem rolagem lateral: `+J(sw));await pg.screenshot({path:path.join(PRINTS,`v93-checkout-${w}.png`)});}
  await pg.setViewportSize({width:1366,height:900});

  // ---------- equipe ----------
  const pe=await ctx.newPage();const errs2=[];pe.on('pageerror',e=>errs2.push(e.message));pe.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404|ort|wasm|face-api|models/i.test(m.text()))errs2.push('console: '+m.text());});
  await pe.goto(AO+'/index.html');await pe.waitForTimeout(500);
  await pe.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pe.click('button[type=submit]');await pe.waitForTimeout(200);
  await pe.fill('[data-act="login-code"]',(await pe.textContent('.otp')).replace(/\s/g,''));await pe.waitForTimeout(600);
  const esp2=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pe.evaluate(fn,arg))return true;await pe.waitForTimeout(200);}return false;};
  await pe.evaluate(()=>{ETERNA.state.imp.key='todos';ETERNA.state.imp.point='todos';ETERNA.go('importar');});
  ok(await esp2(c=>!!document.querySelector(`.up-sess[data-card="${c}"]`),20000,xS.card),'Upload com as sessões do agente');
  await esp2(c=>/prontas/.test((document.querySelector(`.up-sess[data-card="${c}"] .up-sess-h`)||{}).textContent||''),12000,xS.card);
  const upv=await pe.evaluate(cs=>{const h=c=>{const b=document.querySelector(`.up-sess[data-card="${c}"]`);return b?b.querySelector('.up-sess-h').textContent.replace(/\s+/g,' '):'';};
    const b=document.querySelector(`.up-sess[data-card="${cs.S}"]`);return {tags:b?[...b.querySelectorAll('.ph .tag')].map(t=>t.textContent+(t.classList.contains('tag-ia')?'#ia':'')):[],S:h(cs.S),V:h(cs.V),W:h(cs.W),K:h(cs.K),P:h(cs.P)};},{S:xS.card,V:xV.card,W:xW.card,K:xK.card,P:xP.card});
  ok(upv.tags[0]==='Fundo IA 1 · corpo inteiro#ia'&&upv.tags[1]==='Fundo IA 2 · fechada#ia'&&upv.tags.length===2,'14: tags das bases no Upload: '+J(upv.tags));
  ok(/Fundos de IA: 2 de 2 prontas/.test(upv.S),'Upload: "Fundos de IA: 2 de 2 prontas": '+upv.S);
  ok(/Volante: sem fotos de IA/.test(upv.V)&&/Ponto fora da regra/.test(upv.W)&&/Sem função do dia: fotos de IA não separadas/.test(upv.K)&&/Poucas fotos: ficaram à venda/.test(upv.P),'8: pílulas do motivo no Upload: '+J(upv));
  await pe.evaluate(c=>{const el=document.querySelector(`.up-sess[data-card="${c}"]`);if(el)el.scrollIntoView();},xS.card);await pe.screenshot({path:path.join(PRINTS,'v93-upload.png')});
  // 13: Fila do fotógrafo com sessão aberta de 1 foto (de verdade), depois as 2 prontas
  await pe.evaluate(()=>{localStorage.setItem('eterna.fotofila.tvmini','1');ETERNA.go('fotofila');});
  const Q=semear('sandessa',1);
  ok(await esp2(()=>/falta o 2º clique/.test(document.querySelector('#main').textContent),10000),'13: grupo aberto com 1 foto: "falta o 2º clique"');
  ok(await esp2(()=>document.querySelectorAll('.ff-iamk img').length>=1,6000),'13: miniatura da base com a marca Fundo IA');
  await pe.screenshot({path:path.join(PRINTS,'v93-fila-aberta.png')});
  const Q2=semear('sandessa',3);
  ok(await esp2(()=>[...document.querySelectorAll('.ff-ia')].some(x=>x.textContent==='Fundo IA ✓✓'),25000),'13: depois de pronto, "Fundo IA ✓✓": '+J(await pe.evaluate(()=>[...document.querySelectorAll('.ff-ia')].map(x=>x.textContent))));
  await pe.screenshot({path:path.join(PRINTS,'v93-fila-pronta.png')});
  for(const [w,h] of [[390,844],[768,1024]]){await pe.setViewportSize({width:w,height:h});for(const v of ['fotofila','importar','catalogo']){await pe.evaluate(v=>ETERNA.go(v),v);await pe.waitForTimeout(400);
    const sw=await pe.evaluate(()=>({sw:document.documentElement.scrollWidth,w:innerWidth}));ok(sw.sw<=sw.w+1,`${v} ${w}px sem rolagem lateral: `+J(sw));
    if(v==='catalogo'){await pe.evaluate(()=>{const e=document.querySelector('#ia-cfg');if(e)e.scrollIntoView();});}await pe.screenshot({path:path.join(PRINTS,`v93-${v}-${w}.png`)});}}
  await pe.setViewportSize({width:1366,height:900});
  // 12: Painel de controle grava no agente (state.db = agente) e vale para a próxima sessão que fechar
  await pe.evaluate(()=>ETERNA.go('catalogo'));await pe.waitForTimeout(300);
  ok(await esp2(()=>!!ETERNA.state.db,10000),'12: o app usa o estado.db do agente');
  const pts=await pe.$$eval('#ia-cfg [data-act="ia-ponto"]',xs=>xs.map(x=>x.dataset.id+':'+x.checked));
  ok(pts.join()==='terminal:true,campo2:true,campo3:true,campo4:true,vestiario:false','12: padrão nos 4 pontos de campo: '+J(pts));
  await pe.evaluate(()=>{const e=document.querySelector('#ia-cfg');if(e)e.scrollIntoView();});await pe.screenshot({path:path.join(PRINTS,'v93-painel-ia.png')});
  await pe.fill('#ia-cfg [data-act="ia-cliques"]','1');await pe.dispatchEvent('#ia-cfg [data-act="ia-cliques"]','change');
  // clique repetido no mesmo interruptor (liga e desliga) e de volta: nada quebra; termina ligado
  await pe.click('#ia-cfg [data-act="ia-ligada"]');await pe.click('#ia-cfg [data-act="ia-ligada"]');
  let srv=null;for(let i=0;i<40;i++){const r=await req(PORTA,'GET','/ponto/docs?col=config');srv=((r.j||{}).docs||[]).find(d=>d.id==='ia');if(srv&&srv.valor&&srv.valor.cliques===1&&srv.valor.ligada===true)break;await sleep(250);}
  ok(srv&&srv.valor.cliques===1&&srv.valor.ligada===true&&srv.valor.por==='eduardo@eduardorezende.com','12: a mudança chegou ao agente (config/ia): '+J(srv));
  ok(/config\/ia: de .* para .*"cliques": 1/.test(LOGA),'12: o agente registra de, para e quem no console');
  const lg=await pe.evaluate(()=>ETERNA.SIM.log.slice(0,4).map(x=>x.t));ok(lg.some(t=>/Fundos de IA: 1 primeiro clique/.test(t)),'12: log do app: '+J(lg));
  await sleep(3300);
  const N1=semear('yago',4);const xN1=await fechada(N1[0],20000);
  ok(xN1&&J(xN1.ia)===J(N1.slice(0,1))&&xN1.ia_regra.n===1,'12: 1 clique na próxima sessão que fechou: '+J(xN1&&[xN1.ia,xN1.ia_regra]));
  const xSb=(await sessoes()).find(x=>x.card===xS.card);ok(xSb&&J(xSb.ia)===J(xS.ia),'12: a sessão já fechada não mudou');
  // Upload usa a regra do servidor: a nova sessão mostra só "Fundo IA 1"
  await pe.evaluate(()=>ETERNA.go('importar'));
  ok(await esp2(c=>{const b=document.querySelector(`.up-sess[data-card="${c}"]`);return b&&[...b.querySelectorAll('.ph .tag-ia')].length===1;},15000,xN1&&xN1.card),'12/14: com 1 clique, só uma base marcada no Upload');
  // sem configuracao.u: campos desabilitados e guardAct barra (nada sobe ao agente)
  await pe.evaluate(()=>ETERNA.go('catalogo'));
  const r12=await pe.evaluate(()=>{const u=ETERNA.state.user;const p0=u.perms;u.perms={...p0,configuracao:{r:true}};ETERNA.render();const dis=[...document.querySelectorAll('#ia-cfg input')].every(x=>x.disabled);
    const el=document.querySelector('#ia-cfg [data-act="ia-cliques"]');el.disabled=false;el.value='3';el.dispatchEvent(new Event('change',{bubbles:true}));const c=ETERNA.iaCfg().cliques;u.perms=p0;ETERNA.render();return {dis,c};});
  ok(r12.dis&&r12.c===1,'12: sem configuracao.u desabilitado e barrado: '+J(r12));
  await sleep(1500);const srv2=(((await req(PORTA,'GET','/ponto/docs?col=config')).j||{}).docs||[]).find(d=>d.id==='ia');ok(srv2&&srv2.valor.cliques===1,'12: nada subiu ao agente sem permissão: '+J(srv2&&srv2.valor));
  // volta ao padrão pelo Painel
  await pe.fill('#ia-cfg [data-act="ia-cliques"]','2');await pe.dispatchEvent('#ia-cfg [data-act="ia-cliques"]','change');
  // fiaPanel (Fundos de IA) com a linha das bases
  await pe.evaluate(()=>ETERNA.go('chroma'));await pe.waitForTimeout(300);
  ok(await esp2(()=>/Fotos para IA: fila \d+ · p90 \d+ s desde a chegada · \d+ erros?/.test(document.querySelector('#main').textContent),8000),'fiaPanel: linha "Fotos para IA"');
  // sem agente: o app servido pelo rodar.sh (sem servidor do ponto); Painel de controle e Checkout sem erro
  {const cn=await b.newContext({viewport:{width:1366,height:900}});await cn.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pn=await cn.newPage();const en=[];pn.on('pageerror',e=>en.push(e.message));
    await pn.goto(U);await pn.waitForTimeout(500);await pn.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pn.click('button[type=submit]');await pn.waitForTimeout(200);
    await pn.fill('[data-act="login-code"]',(await pn.textContent('.otp')).replace(/\s/g,''));await pn.waitForTimeout(600);
    await pn.evaluate(()=>ETERNA.go('catalogo'));await pn.waitForTimeout(300);
    await pn.click('#ia-cfg [data-act="ia-volante"]');await pn.waitForTimeout(300);
    const sn=await pn.evaluate(()=>({c:ETERNA.iaCfg(),toast:(document.querySelector('#toast')||{}).textContent||'',db:!!ETERNA.state.db}));
    ok(sn.c.volante===true&&!sn.db,'sem agente: o Painel grava neste navegador: '+J(sn));
    await pn.goto(U+'#loja');await pn.waitForTimeout(1200);ok(!en.length,'sem agente: sem erro de JS: '+en.join(' | '));await cn.close();}
  ok(!errs.length,'erros de JS no Checkout: '+errs.join(' | '));ok(!errs2.length,'erros de JS nas telas da equipe: '+errs2.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e).toString().slice(0,700));try{for(const p of b?b.contexts().flatMap(c=>c.pages()):[])await p.screenshot({path:path.join(PRINTS,'v93-erro-'+Date.now()+'.png')});}catch(x){}}
finally{if(b)await b.close();if(proc){proc.kill('SIGTERM');await sleep(300);try{proc.kill('SIGKILL');}catch(e){}}try{fs.rmSync(H,{recursive:true,force:true});}catch(e){}}
if(fails.length){console.log('FALHA cliques-ia-e2e: '+fails.join(' || ')+' · '+J(num));process.exit(1);}
console.log('OK cliques-ia-e2e: agente de verdade, critérios 1 a 5, 8, 9, 12 a 14, 19, A11, A15, celular, tablet, idiomas · '+J(num));
})();
