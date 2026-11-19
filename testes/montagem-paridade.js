// Montagem no servidor, E1 (plano docs/planos/2026-11-16-montagem-no-servidor.md): paridade entre o canvas do navegador
// (fiaMontar e compHi, a referência) e a porta em Python (agente/eterna-montagem.py). 8 recortes sintéticos (nunca foto de
// cliente). Critérios 3 a 12 do plano:
//   3  tabelas: --regras igual, campo a campo, a FIA_REGRAS, FIA_PADRAO, FIA_ESTREITO_DE/ATE, FIA_BASE, IMP_PX e a file,
//      fileHi, mono, impAlto e telao de DATA.backgrounds; um número trocado quebra a comparação
//   4  P1 layout: a medida e os rostos do navegador entram no layout do Python: 8 recortes x 7 fundos com diferença <= 1e-6
//   5  P2 medida: medir do Python contra o fiaMedir na mesma PNG: box com até 1 px, trunc e modo iguais
//   6  P3 imagem (sem JPEG no meio), 8 recortes x 3 fundos ativos, prévia e impressão: caixa da pessoa com até 3 px de
//      desvio em cada lado na prévia, erro médio por canal <= 2,0 e no máximo 1,5% dos pontos com diferença > 16.
//      O Python faz o caminho do servidor: recebe o recorte de 3000 px e reduz a 2400 em memória para a prévia
//   7  os casos obrigatórios (estreito, braços abertos, grupo, 0,85, 0,95, corpo inteiro em pé, braço erguido, criança)
//   8  Maracanã 1950 em preto e branco de verdade, nada acima de 32% da altura, título inteiro na impressão
//   9  Telão: nada mexido fora da tela, casal com 55% a 65% da largura da tela, impressão cortada no meio
//   10 Mirante do Rio: impressão presa embaixo, com o Cristo dentro do corte
//   11 proteção de rosto igual à do navegador; sem o modelo de rostos, monta e registra rostos nulo
//   12 halo: nenhum ponto da borda mais escuro que a pessoa e que o fundo branco de teste
//   D8 corte do joelho (v99.35.0): o tEXt "eterna" do PNG do recorte (joelho, pernas) corta o corpo inteiro na linha dos
//      joelhos, igual ao fiaPngInfo + fiaJoelho do navegador, na prévia e na impressão; sem pernas inteiras ou com chão
//      abaixo dos pés, não corta. Os 4 fundos ativos de hoje (com a Saída do túnel v2, corte 10x15 preso no alto).
// MONTAGEM_SAIDA=<pasta> guarda as imagens e o resumo.json. MONTAGEM_RAPIDO=1 roda só a prévia.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');
const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RAIZ=path.join(__dirname,'..');
const GUARDA=process.env.MONTAGEM_SAIDA||'';const TMP=GUARDA||fs.mkdtempSync(path.join(os.tmpdir(),'mtg-paridade-'));fs.mkdirSync(TMP,{recursive:true});
const RAPIDO=!!process.env.MONTAGEM_RAPIDO;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const PY=path.join(RAIZ,'agente','eterna-montagem.py'),AJ=path.join(__dirname,'_montagem_paridade.py');
const py=(args,input)=>execFileSync('python3',args,{input:input||'',maxBuffer:1<<28}).toString();
const pyLinhas=(args,input)=>py(args,input).trim().split('\n').map(l=>JSON.parse(l));
const LIM={mae:2.0,frac16:.015,caixa:3,layout:1e-6,halo:-12,cinza:2,fora:2};
const ATIVOS=['mirantedia','arq1950','telao','tunel'];const FUNDOS=['mirantedia','arq1950','telao','campeao2','mirante','tunel','podio'];
const igual=(a,b)=>{if(typeof a==='number'&&typeof b==='number')return a===b;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return J(ka)===J(kb)&&ka.every(k=>igual(a[k],b[k]));};
(async()=>{const notas={};
// ---- o processo de montagem só usa numpy, Pillow, OpenCV e a biblioteca padrão; não abre porta, não baixa, não abre processo
const fonte=fs.readFileSync(PY,'utf8');const mods=[...new Set([...fonte.matchAll(/^\s*(?:import|from)\s+([A-Za-z0-9_]+)/gm)].map(m=>m[1]))];
const PERMITIDOS=['os','sys','json','math','time','re','tempfile','threading','resource','ctypes','numpy','PIL','cv2'];
ok(mods.every(m=>PERMITIDOS.includes(m)),'o eterna-montagem.py importa fora da lista (numpy, PIL, cv2, stdlib): '+J(mods.filter(m=>!PERMITIDOS.includes(m))));
ok(!/\bsocket\b|urllib|http\.|subprocess|\beval\(|\bexec\(/.test(fonte),'o processo de montagem não abre porta, não baixa e não abre outro processo');
const req=fs.readFileSync(path.join(RAIZ,'servidor','linux','requisitos.txt'),'utf8');
ok(/^numpy==/m.test(req)&&/^pillow==/m.test(req)&&/^opencv-python-headless==/m.test(req),'numpy, pillow e opencv-python-headless estão nos requisitos do servidor (nenhum pacote novo)');
// ---- figuras
const CASOS=JSON.parse(py([AJ,'figuras',path.join(TMP,'recortes')]));const HALO=CASOS.halo;delete CASOS.halo;const ASPEROS={};Object.keys(CASOS).filter(n=>CASOS[n].so_medida).forEach(n=>{ASPEROS[n]=CASOS[n];delete CASOS[n];});const JOELHOS={};Object.keys(CASOS).filter(n=>CASOS[n].joelho).forEach(n=>{JOELHOS[n]=CASOS[n];delete CASOS[n];});const NOMES=Object.keys(CASOS);
ok(NOMES.length===8,'8 recortes sintéticos: '+NOMES.length);
const REGRAS=pyLinhas([PY,'--regras'])[0];const arqFundo=(bg,hi)=>path.join(RAIZ,REGRAS.fundos[bg][hi?'hi':'previa']);
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1280,height:800},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pidDe=n=>'9b00000000'+(n==='halo'?'ff':ASPEROS[n]?'e'+Object.keys(ASPEROS).indexOf(n):JOELHOS[n]?'d'+Object.keys(JOELHOS).indexOf(n):('0'+NOMES.indexOf(n).toString(16)).slice(-2));const casoDe={};NOMES.forEach(n=>{casoDe[pidDe(n)]=CASOS[n];});casoDe[pidDe('halo')]=HALO;Object.keys(ASPEROS).forEach(n=>{casoDe[pidDe(n)]=ASPEROS[n];});Object.keys(JOELHOS).forEach(n=>{casoDe[pidDe(n)]=JOELHOS[n];});
  const recorte=r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}const c=casoDe[q.pid];if(!c)return r.fulfill({status:404,body:'{}'});
    r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(q.lado===3000?c.hi:c.previa)});};
  await ctx.route(ORIG+'/recorte',recorte);
  // o agente responde o /status sem `montagem` (agente que não monta): o navegador monta no canvas (desde a revisão da E2, só
  // com o modo do servidor conhecido; sem nenhum /status o canvas não monta)
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bP',card:null,copied:0,dups:0,events:0,recorte:{ok:true,carregado:true},fundos_modo:'local'})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  const pg=await ctx.newPage();pg.setDefaultTimeout(120000);pg.on('pageerror',e=>errs.push(e.message));await login(pg);
  await pg.waitForFunction(()=>window.ETERNA&&ETERNA.fiaMontar&&ETERNA.FIA_ROSTOS&&ETERNA.FIA_PADRAO,null,{timeout:20000});
  await pg.evaluate(()=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};});
  await pg.waitForFunction(()=>ETERNA.mtgCanvasOk(),null,{timeout:20000});
  // ---- critério 3: tabelas do Python iguais às do app
  const app=await pg.evaluate(()=>{const E=ETERNA;const fundos={};E.BGS.forEach(b=>{fundos[b.id]={previa:b.file,hi:b.fileHi||b.file,mono:!!b.mono,impAlto:!!b.impAlto,telao:b.telao||null};});
    return {regras:E.FIA_REGRAS,padrao:E.FIA_PADRAO,estreito:[E.FIA_ESTREITO_DE,E.FIA_ESTREITO_ATE],base:E.FIA_BASE,imp:E.IMP_PX,fundos,ativos:E.BG_DEF,lados:[2400,3000]};});
  for(const k of ['regras','padrao','estreito','base','imp'])ok(igual(REGRAS[k],app[k]),'3: tabela "'+k+'" do Python diferente da do app: '+J(REGRAS[k]).slice(0,200)+' x '+J(app[k]).slice(0,200));
  ok(J(Object.keys(REGRAS.fundos).sort())===J(FUNDOS.slice().sort()),'3: os 7 fundos com montagem local: '+J(Object.keys(REGRAS.fundos)));
  FUNDOS.forEach(bg=>ok(igual(REGRAS.fundos[bg],app.fundos[bg]),'3: fundo '+bg+' (file, fileHi, mono, impAlto, telao) diferente do app: '+J(REGRAS.fundos[bg])+' x '+J(app.fundos[bg])));
  ok(J(app.ativos)===J(ATIVOS)&&REGRAS.versao==='m2'&&REGRAS.lado_previa===2400&&REGRAS.medida===600&&REGRAS.alfa===128,'3: fundos ativos, versão e medidas fixas: '+J([app.ativos,REGRAS.versao]));
  const mexe=(o,f)=>{const c=JSON.parse(J(o));f(c);return c;};
  ok(!igual(REGRAS.regras,mexe(app.regras,c=>{c.telao.estreito.corte+=.01;}))&&!igual(REGRAS.fundos.telao,mexe(app.fundos.telao,c=>{c.telao.quad[2][1]+=1;}))
    &&!igual(REGRAS.estreito,[.71,1.2])&&!igual(REGRAS.base,mexe(app.base,c=>{c.telao=0;}))&&!igual(REGRAS.fundos.arq1950,mexe(app.fundos.arq1950,c=>{c.impAlto=false;})),'3: um número mudado num dos lados precisa quebrar a comparação');
  // regras que o plano fixa (o fundo novo do 1950 sem "largo" e sem zoom; o estreito nos 3 ativos)
  ok(J(REGRAS.joelho)===J([.35,.97])&&REGRAS.regras.tunel.meio.alt===.766&&REGRAS.regras.tunel.estreito.corte===.74&&REGRAS.base.tunel===0&&REGRAS.fundos.tunel.impAlto===true&&/tunel-v2/.test(REGRAS.fundos.tunel.previa),'3: túnel v2 (regra 22, 1ª base, impressão presa no alto) e limites do joelho: '+J([REGRAS.regras.tunel,REGRAS.joelho]));
  ok(!REGRAS.regras.arq1950.largo&&REGRAS.regras.arq1950.meio.alt===.66&&REGRAS.regras.arq1950.estreito.corte===.74&&REGRAS.regras.telao.estreito.corte===.47&&REGRAS.regras.mirantedia.estreito.corte===.74
    &&!Object.values(REGRAS.regras).some(r=>Object.values(r).some(x=>x&&x.zoom)),'3: regras de hoje (1950 novo, estreito nos 3 ativos, sem zoom)');
  // os fundos como o navegador os decodifica (para a caixa da pessoa e o "nada mexido fora da tela") e o tamanho de cada um
  const salvaPng=(arq,durl)=>fs.writeFileSync(arq,Buffer.from(durl.split(',')[1],'base64'));
  const fundoCanvas={},dims={};
  for(const bg of FUNDOS){const d=await pg.evaluate(async([f,png])=>{const im=new Image();im.src=f;await im.decode();if(!png)return {w:im.naturalWidth,h:im.naturalHeight};const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return {w:c.width,h:c.height,png:c.toDataURL('image/png')};},[REGRAS.fundos[bg].previa,ATIVOS.includes(bg)]);
    dims[bg]=[d.w,d.h];if(d.png){fundoCanvas[bg]=path.join(TMP,'fundo-canvas-'+bg+'.png');salvaPng(fundoCanvas[bg],d.png);}}
  // ---- a medida do navegador (fiaMedir) de cada recorte, nos dois tamanhos
  const medidas={};
  for(const n of NOMES)for(const lado of [2400,3000])medidas[n+'|'+lado]=await pg.evaluate(async([pid,lado])=>{const r=await fetch(location.origin+'/recorte',{method:'POST',body:JSON.stringify({pid,lado})});const u=URL.createObjectURL(await r.blob());
    const im=new Image();im.src=u;await im.decode();const m=ETERNA.fiaMedir(im);URL.revokeObjectURL(u);return m;},[pidDe(n),lado]);
  // ---- critério 5 (P2): medida. O Python mede a cópia de 2400 que ele mesmo reduz do recorte de 3000 (o caminho do servidor)
  const pm=pyLinhas([PY,'--teste'],J(NOMES.flatMap(n=>[{recorte:CASOS[n].previa,so_medir:true},{recorte:CASOS[n].hi,reduzir:true,so_medir:true},{recorte:CASOS[n].hi,so_medir:true}])));
  let i=0;let p2max=0;for(const n of NOMES)for(const [lado,rot] of [[2400,'arquivo de 2400'],[2400,'reduzido em memória'],[3000,'3000']]){const a=medidas[n+'|'+lado],p=pm[i++].m;
    if(!ok(a&&p,'P2 '+n+' '+rot+': sem medida'))continue;const d=Math.max(...['x','y','w','h'].map(k=>Math.abs(a.box[k]-p.box[k])));p2max=Math.max(p2max,d);
    ok(a.W===p.W&&a.H===p.H&&a.w===p.w&&a.h===p.h&&Math.abs(a.k-p.k)<1e-12,'P2 '+n+' '+rot+': tamanho da medida igual: '+J([a.W,a.H,a.w,a.h])+' x '+J([p.W,p.H,p.w,p.h]));ok(d<=1,'P2 '+n+' '+rot+': box com até 1 px: '+J(a.box)+' x '+J(p.box));ok(a.trunc===p.trunc,'P2 '+n+' '+rot+': trunc igual');}
  notas.p2_box_max_px=p2max;
  // borda áspera (alfa com ruído no limiar): a medida igual linha a linha no recorte de lados pares; no de lado ímpar, box com até 1 px e 99% das linhas iguais
  for(const n of Object.keys(ASPEROS))for(const lado of [2400,3000]){const a=await pg.evaluate(async([pid,lado])=>{const r=await fetch(location.origin+'/recorte',{method:'POST',body:JSON.stringify({pid,lado})});const u=URL.createObjectURL(await r.blob());
      const im=new Image();im.src=u;await im.decode();const m=ETERNA.fiaMedir(im);URL.revokeObjectURL(u);return m;},[pidDe(n),lado]);
    const p=pyLinhas([PY,'--teste'],J([{recorte:lado===3000?ASPEROS[n].hi:ASPEROS[n].previa,so_medir:true,linhas:true}]))[0].m;if(!ok(a&&p&&a.rows.length===p.rows.length,'P2 '+n+' '+lado+': sem medida'))continue;
    const dif=a.rows.filter((r,k)=>J(r)!==J(p.rows[k])).length;const d=Math.max(...['x','y','w','h'].map(k=>Math.abs(a.box[k]-p.box[k])));notas['p2_'+n+'_'+lado]=dif+'/'+a.rows.length;
    const par=a.W%2===0&&a.H%2===0;ok(a.trunc===p.trunc&&d<=(par?0:1)&&dif<=(par?0:a.rows.length*.01),'P2 '+n+' '+lado+' ('+a.W+'x'+a.H+'): medida de borda áspera igual à do navegador: '+dif+' linhas diferentes de '+a.rows.length+', box '+J(a.box)+' x '+J(p.box));}
  // ---- canvas: a prévia (fiaMontar) e o corte de impressão (compHi) nos 3 fundos ativos; o Telão dá o tamanho da tela
  await pg.evaluate(()=>{const o=HTMLCanvasElement.prototype.toDataURL;window.__hi=null;HTMLCanvasElement.prototype.toDataURL=function(t,q){
    if(t==='image/jpeg'&&this.width*this.height===1844*1240&&Math.max(this.width,this.height)===1844)window.__hi=o.call(this,'image/png');return o.call(this,t,q);};});
  const C=[];let tela=null;
  for(const n of NOMES)for(const bg of ATIVOS){const c={n,bg,id:n+'-'+bg,ro:CASOS[n].rostos};C.push(c);
    const r=await pg.evaluate(async([pid,bg,ro])=>{const E=ETERNA;E.FIA_ROSTOS['ag_'+pid]=Promise.resolve(ro);const t0=performance.now();const r=await E.fiaMontar('ag_'+pid,bg);if(!r.canvas)return {err:r.err||r.pending||'?'};
      return {png:r.canvas.toDataURL('image/png'),w:r.w,h:r.h,layout:r.layout,ms:Math.round(performance.now()-t0)};},[pidDe(n),bg,c.ro]);
    if(r.err){ok(false,'canvas '+c.id+': '+r.err);continue;}
    c.canvas=path.join(TMP,'canvas-'+c.id+'.png');salvaPng(c.canvas,r.png);c.w=r.w;c.h=r.h;c.L=r.layout;c.msCanvas=r.ms;if(bg==='telao')tela=r.layout.tela;
    if(!RAPIDO){const h=await pg.evaluate(async([pid,bg])=>{window.__hi=null;const r=await ETERNA.compHi('ag_'+pid,bg);if(!r.url)return {err:r.err||r.pending||'?'};return {png:window.__hi,w:r.w,h:r.h,layout:r.layout,avisos:r.avisos};},[pidDe(n),bg]);
      if(h.err||!h.png){ok(false,'canvas hi '+c.id+': '+(h.err||'sem imagem'));continue;}ok(!(h.avisos||[]).length,'canvas hi '+c.id+': impressão com o fundo de 5000 px (avisos '+J(h.avisos)+')');
      c.canvasHi=path.join(TMP,'canvas-hi-'+c.id+'.png');salvaPng(c.canvasHi,h.png);c.LHi=h.layout;c.hiW=h.w;c.hiH=h.h;}}
  const vivos=C.filter(c=>c.canvas);ok(vivos.length===8*ATIVOS.length&&tela,(8*ATIVOS.length)+' montagens do canvas (8 recortes x '+ATIVOS.length+' fundos): '+vivos.length);
  // ---- critério 4 (P1): layout puro, 8 recortes x 7 fundos, com a medida e os rostos do navegador
  dims.telao=tela?[tela.w,tela.h]:null;
  const LB=await pg.evaluate(([NOMES,FUNDOS,medidas,dims,ROS])=>{const E=ETERNA;const o={};for(const n of NOMES)for(const bg of FUNDOS){const m=medidas[n+'|2400'];const [W,H]=dims[bg];let L=E.fiaLayout(m,bg,W,H);const ro=ROS[n];
    if(L.corte<1&&ro.length)L=E.fiaLayout(m,bg,W,H,ro);o[n+'|'+bg]=L;}return o;},[NOMES,FUNDOS,medidas,dims,Object.fromEntries(NOMES.map(n=>[n,CASOS[n].rostos]))]);
  const pares=NOMES.flatMap(n=>FUNDOS.map(bg=>[n,bg]));
  const p1=pyLinhas([PY,'--teste'],J(pares.map(([n,bg])=>({recorte:CASOS[n].previa,fundo:arqFundo(bg),bg,m:medidas[n+'|2400'],rostos:CASOS[n].rostos,so_layout:true}))
    .concat(vivos.filter(c=>c.LHi).map(c=>({recorte:CASOS[c.n].hi,fundo:arqFundo(c.bg,true),bg:c.bg,m:medidas[c.n+'|3000'],rostos:c.ro,so_layout:true})))));
  const CAMPOS=L=>[L.estreito,L.corte,L.corteFinal,L.zoom,L.s,L.src.x,L.src.y,L.src.w,L.src.h,L.src.corteFinal,L.dst.x,L.dst.y,L.dst.w,L.dst.h];
  let p1max=0;const confereL=(nome,a,p,telaA)=>{if(!p||!p.ok){ok(false,'P1 '+nome+': o Python não devolveu o layout: '+J(p).slice(0,120));return;}const x=CAMPOS(a).concat(telaA?[telaA.w,telaA.h]:[]),y=CAMPOS(p.layout).concat(p.layout.tela?[p.layout.tela.w,p.layout.tela.h]:[]);
    const d=x.length===y.length?Math.max(...x.map((v,k)=>Math.abs(v-y[k]))):Infinity;p1max=Math.max(p1max,d);
    ok(a.modo===p.layout.modo&&d<=LIM.layout&&J(a.mono||null)===J(p.layout.mono||null),'P1 '+nome+': layout igual (modo '+a.modo+' x '+p.layout.modo+', maior diferença '+d+')');};
  pares.forEach(([n,bg],k)=>confereL(n+'-'+bg,LB[n+'|'+bg],p1[k],bg==='telao'?tela:null));
  vivos.filter(c=>c.LHi).forEach((c,k)=>confereL(c.id+' hi',c.LHi,p1[pares.length+k],c.LHi.tela||null));
  // o layout que o fiaMontar usou de verdade é o mesmo da função pura (a montagem não toma outro caminho)
  vivos.forEach(c=>ok(Math.max(...CAMPOS(c.L).map((v,k)=>Math.abs(v-CAMPOS(LB[c.n+'|'+c.bg])[k])))<=LIM.layout,'P1 '+c.id+': o layout da montagem do canvas é o da função pura'));
  notas.p1_layout_max=p1max;notas.p1_casos=pares.length;
  // ---- Python pelo caminho do servidor: prévia = recorte de 3000 reduzido em memória + fundo de prévia; impressão = 3000 + fundo de 5000 px
  const t0=Date.now();
  const pa=pyLinhas([PY,'--teste'],J(vivos.map(c=>({recorte:CASOS[c.n].hi,reduzir:true,fundo:arqFundo(c.bg),bg:c.bg,rostos:c.ro,saida:(c.py=path.join(TMP,'py-'+c.id+'.png'))}))));
  vivos.forEach((c,k)=>{c.pa=pa[k];if(ok(pa[k].ok,'Python '+c.id+': '+J(pa[k]).slice(0,160))){ok(pa[k].layout.modo===c.L.modo,'P2 '+c.id+': modo igual com a medida do Python ('+pa[k].layout.modo+' x '+c.L.modo+')');
    ok(pa[k].w===c.w&&pa[k].h===c.h,'6: prévia do Python no tamanho do fundo: '+pa[k].w+'x'+pa[k].h+' x '+c.w+'x'+c.h);}});
  const comHi=vivos.filter(c=>c.canvasHi);
  const pb=comHi.length?pyLinhas([PY,'--teste'],J(comHi.map(c=>({recorte:CASOS[c.n].hi,fundo:arqFundo(c.bg,true),bg:c.bg,rostos:c.ro,impressao:(c.pyHi=path.join(TMP,'py-hi-'+c.id+'.png'))})))):[];
  comHi.forEach((c,k)=>{c.pb=pb[k];ok(pb[k].ok,'Python hi '+c.id+': '+J(pb[k]).slice(0,160));if(pb[k].ok)ok(pb[k].layout.modo===c.LHi.modo,'P2 '+c.id+' hi: modo igual ('+pb[k].layout.modo+' x '+c.LHi.modo+')');});
  notas.python_s=Math.round((Date.now()-t0)/100)/10;
  // ---- critério 6 (P3): imagem
  const quadDe=c=>{const t=REGRAS.fundos[c.bg].telao;if(!t)return null;const k=c.w/t.w;return t.quad.map(([x,y])=>[x*k,y*k]);};
  const jobs=[];vivos.forEach(c=>{if(c.pa&&c.pa.ok)jobs.push({id:'previa|'+c.id,a:c.canvas,b:c.py,fundo_a:fundoCanvas[c.bg],fundo_b:arqFundo(c.bg),quad:quadDe(c)});
    if(c.pb&&c.pb.ok)jobs.push({id:'impressao|'+c.id,a:c.canvasHi,b:c.pyHi});});
  // critério 8: preto e branco de verdade no 1950, prévia e impressão, dos dois lados
  vivos.filter(c=>c.bg==='arq1950').forEach(c=>{if(c.pa&&c.pa.ok){jobs.push({id:'cinza|py|'+c.id,a:c.py,cinza:true});jobs.push({id:'cinza|canvas|'+c.id,a:c.canvas,cinza:true});}if(c.pb&&c.pb.ok)jobs.push({id:'cinza|pyhi|'+c.id,a:c.pyHi,cinza:true});});
  // critérios 8, 9 e 10: onde o 10x15 corta (uma faixa sem pessoa da impressão igual ao fundo cortado no alto, no meio ou embaixo)
  const CORTE={arq1950:{pos:'alto',faixa:[0,0,1,.28],cinza:true},telao:{pos:'meio',faixa:[0,0,.14,1]},mirantedia:{pos:'baixo',faixa:[0,0,1,.12]},tunel:{pos:'alto',faixa:[0,0,1,.2],semCorte:true}};
  comHi.forEach(c=>{if(c.pb&&c.pb.ok){jobs.push({id:'corte|py|'+c.id,a:c.pyHi,corte:{fundo:arqFundo(c.bg,true),...CORTE[c.bg]}});jobs.push({id:'corte|canvas|'+c.id,a:c.canvasHi,corte:{fundo:arqFundo(c.bg,true),...CORTE[c.bg]}});}});
  const res=JSON.parse(py([AJ,'compara'],J(jobs)));const R={};res.forEach(r=>{R[r.id]=r;});
  const por={};ATIVOS.forEach(bg=>{por[bg]={previa:{caixa_px:0,mae:0,frac16:0},impressao:{mae:0,frac16:0}};});
  for(const c of vivos){const p=R['previa|'+c.id];if(!p)continue;if(p.erro){ok(false,'P3 '+c.id+': '+p.erro);continue;}const T=por[c.bg].previa;
    c.p3={mae:p.mae,frac16:p.frac16,caixa:p.caixa_px};T.mae=Math.max(T.mae,p.mae);T.frac16=Math.max(T.frac16,p.frac16);if(p.caixa_px!=null)T.caixa_px=Math.max(T.caixa_px,p.caixa_px);
    ok(p.mae<=LIM.mae,'P3 '+c.id+': erro médio '+p.mae+' (limite '+LIM.mae+')');ok(p.frac16<=LIM.frac16,'P3 '+c.id+': '+(p.frac16*100).toFixed(2)+'% dos pontos com diferença > 16 (limite 1,5%)');
    ok(p.caixa_px!=null&&p.caixa_px<=LIM.caixa,'P3 '+c.id+': caixa da pessoa com desvio de '+p.caixa_px+' px (limite 3): '+J(p.caixa_a)+' x '+J(p.caixa_b));
    if(c.bg==='telao'){T.mae_tela=Math.max(T.mae_tela||0,p.mae_dentro);T.frac16_tela=Math.max(T.frac16_tela||0,p.frac16_dentro);
      ok(p.mae_dentro<=LIM.mae&&p.frac16_dentro<=LIM.frac16,'P3 '+c.id+': só dentro da tela: erro médio '+p.mae_dentro+', '+(p.frac16_dentro*100).toFixed(2)+'% acima de 16');
      ok(p.fora_b===0,'9: Telão '+c.id+': o Python não mexe fora da tela (igual ao arquivo do fundo aberto por ele; maior diferença '+p.fora_b+')');
      ok(p.fora_a===0,'9: Telão '+c.id+': o canvas não mexe fora da tela (maior diferença '+p.fora_a+')');
      ok(p.fora_ab<=LIM.fora,'9: Telão '+c.id+': fora da tela, Python e navegador com até 2 por canal: '+p.fora_ab);notas.telao_fora_max=Math.max(notas.telao_fora_max||0,p.fora_ab);}
    if(c.bg==='arq1950'){ok(p.caixa_a&&p.caixa_b&&p.caixa_a[1]>=.32*c.h&&p.caixa_b[1]>=.32*c.h,'8: 1950 '+c.id+': nada do recorte acima de 32% da altura: topo em '+J([p.caixa_a&&p.caixa_a[1],p.caixa_b&&p.caixa_b[1]])+' de '+c.h);
      for(const l of ['py','canvas','pyhi']){const g=R['cinza|'+l+'|'+c.id];if(!g)continue;ok(!g.erro&&g.cinza_png<=LIM.cinza&&g.cinza_jpeg<=LIM.cinza,'8: 1950 '+c.id+' ('+l+'): |R-G| e |G-B| até 2 no PNG e no JPEG: '+J(g));notas.cinza_max=Math.max(notas.cinza_max||0,g.cinza_png||0,g.cinza_jpeg||0);}}
    const q=R['impressao|'+c.id];if(q){if(q.erro){ok(false,'P3 impressão '+c.id+': '+q.erro);}else{const TI=por[c.bg].impressao;c.imp={mae:q.mae,frac16:q.frac16};TI.mae=Math.max(TI.mae,q.mae);TI.frac16=Math.max(TI.frac16,q.frac16);
      ok(q.mae<=LIM.mae,'P3 impressão '+c.id+': erro médio '+q.mae+' (limite '+LIM.mae+')');ok(q.frac16<=LIM.frac16,'P3 impressão '+c.id+': '+(q.frac16*100).toFixed(2)+'% dos pontos com diferença > 16 (limite 1,5%)');
      ok(q.w===1844&&q.h===1240&&c.hiW===1844&&c.hiH===1240,'6: corte de impressão em 1844x1240: '+q.w+'x'+q.h);}}
    for(const l of ['py','canvas']){const k=R['corte|'+l+'|'+c.id];if(!k)continue;const pos=CORTE[c.bg].pos;const outras=['alto','meio','baixo'].filter(x=>x!==pos).map(x=>k['corte_'+x]);
      const semCorte=CORTE[c.bg].semCorte; // fundo já na proporção 3:2 (túnel v2, 5000x3333): o 10x15 não corta nada; vale só ser igual ao fundo
      ok(!k.erro&&k['corte_'+pos]<=LIM.mae&&(semCorte?outras.every(v=>Math.abs(v-k['corte_'+pos])<1e-9):outras.every(v=>v>k['corte_'+pos]*3+2)),(c.bg==='arq1950'?'8: 1950 com o título inteiro (corte tira de baixo)':c.bg==='tunel'?'túnel com a faixa inteira (fundo já em 3:2, o 10x15 não corta)':c.bg==='telao'?'9: Telão cortado no meio da altura':'10: Mirante do Rio preso embaixo')+' na impressão ('+l+') '+c.id+': '+J(k));}}
  notas.por_fundo=por;notas.casos=vivos.length;
  // ---- critério 7: os casos obrigatórios caem onde o plano diz
  const Lde=(n,bg)=>(vivos.find(c=>c.n===n&&c.bg===bg)||{L:{}}).L;const q=n=>{const m=medidas[n+'|2400'];return m.box.w/m.box.h;};
  ok(q('casal')<.70&&Math.abs(q('casal')-644/1080)<.03&&Lde('casal','mirantedia').modo==='meio'&&Lde('casal','mirantedia').estreito===1&&Math.abs(Lde('casal','mirantedia').corteFinal-.74)<.01&&Math.abs(Lde('casal','telao').corteFinal-.47)<.01,'7: casal estreito (644x1080): estreito inteiro, corte no quadril e no peito: '+J([q('casal'),Lde('casal','mirantedia').corteFinal,Lde('casal','telao').corteFinal]));
  ok(Math.abs(q('bracos')-1492/1016)<.05&&Lde('bracos','mirantedia').estreito===0&&Lde('bracos','mirantedia').corteFinal===1,'7: braços abertos (1492x1016): a regra de sempre: '+J([q('bracos'),Lde('bracos','mirantedia').estreito]));
  ok(Math.abs(q('grupo')-2156/1468)<.05&&Lde('grupo','telao').estreito===0&&Math.abs(Lde('grupo','telao').corte-.80)<1e-9,'7: grupo (2156x1468): a regra de sempre: '+J([q('grupo'),Lde('grupo','telao').corte]));
  for(const [n,alvo] of [['q085',.85],['q095',.95]]){const e=Lde(n,'mirantedia').estreito;ok(Math.abs(q(n)-alvo)<.03&&e>0&&e<1&&Lde(n,'telao').corte>.47&&Lde(n,'telao').corte<.80,'7: razão '+alvo+': entre o estreito e a regra de sempre: '+J([q(n),e,Lde(n,'telao').corte]));}
  ok(Lde('q085','mirantedia').estreito>Lde('q095','mirantedia').estreito,'7: de 0,85 para 0,95 o estreito diminui');
  ok(ATIVOS.every(bg=>Lde('empe',bg).modo==='inteiro')&&medidas['empe|2400'].W===1600&&medidas['empe|2400'].H===2400&&!medidas['empe|2400'].trunc,'7: corpo inteiro em foto em pé (1600x2400), sem encostar embaixo: '+J([medidas['empe|2400'].W,medidas['empe|2400'].H,Lde('empe','telao').modo]));
  ok(medidas['braco|2400'].box.y<medidas['casal|2400'].box.y*.4&&Lde('braco','arq1950').modo==='meio','7: braço erguido: o topo da caixa é a mão: '+J(medidas['braco|2400'].box));
  // ---- critério 9: casal estreito com 55% a 65% da largura da tela (canvas e Python)
  {const c=vivos.find(x=>x.n==='casal'&&x.bg==='telao');const fa=c&&c.L.dst.w/c.L.tela.w,fb=c&&c.pa&&c.pa.ok&&c.pa.layout.dst.w/c.pa.layout.tela.w;notas.casal_telao=[+(+fa).toFixed(3),+(+fb).toFixed(3)];
    ok(fa>=.55&&fa<=.65&&fb>=.55&&fb<=.65,'9: casal estreito com 55% a 65% da largura da tela: canvas '+fa+', Python '+fb);}
  // ---- critério 10: o Cristo (topo em y=156 de 1711 na prévia de 2400 px) fica dentro do 10x15 preso embaixo
  {const [W,H]=dims.mirantedia;const k=Math.max(1844/W,1240/H);const tira=H-1240/k;notas.mirante_tira_px=+tira.toFixed(1);ok(tira<156*H/1711-40&&tira>0,'10: o corte do Mirante tira '+tira.toFixed(0)+' px do alto: o Cristo (y=156) continua dentro, com folga');}
  // ---- critério 11: proteção de rosto (criança com o rosto na linha de corte), igual nos dois lados
  for(const bg of ATIVOS){const c=vivos.find(x=>x.n==='crianca'&&x.bg===bg);if(!c||!c.pa||!c.pa.ok)continue;const m=medidas['crianca|2400'];const R0=REGRAS.regras[bg].inteiro.corte;const f=CASOS.crianca.rostos[1];
    for(const [l,L] of [['canvas',c.L],['Python',c.pa.layout]]){const yc=m.box.y+L.corteFinal*m.box.h;
      ok(L.modo==='inteiro'&&L.rostos===2&&L.corteFinal>R0+.02&&yc>=(f.bot+.15*f.h)*m.h-1,'11: '+bg+' ('+l+'): o corte desce além do rosto da criança + 15%: corteFinal '+L.corteFinal+' x regra '+R0+', linha '+yc.toFixed(1)+' x '+((f.bot+.15*f.h)*m.h).toFixed(1));}
    ok(Math.abs(c.L.corteFinal-c.pa.layout.corteFinal)<=.004,'11: '+bg+': corteFinal igual ao do navegador: '+c.L.corteFinal+' x '+c.pa.layout.corteFinal);}
  // sem o modelo de rostos: monta sem rostos e registra nulo; com o modelo do repositório a leitura roda
  const yn=path.join(RAIZ,'vendor','rostos','face_detection_yunet_2023mar.onnx');const semYn=path.join(TMP,'nao-existe.onnx');
  const rr=pyLinhas([PY,'--teste'],J([{recorte:CASOS.crianca.previa,so_rostos:true,yunet:yn},{recorte:CASOS.crianca.previa,so_rostos:true,yunet:semYn},
    {recorte:CASOS.crianca.hi,reduzir:true,fundo:arqFundo('mirantedia'),bg:'mirantedia',yunet:semYn,saida:path.join(TMP,'py-sem-modelo.png')},
    {recorte:CASOS.crianca.previa,so_frente:true,detectados:[{w:100,pts:[[10,10],[50,10],[30,30]]},{w:60,pts:[[110,10],[150,10],[131,30]]},{w:20,pts:[[0,0],[10,0],[40,0]]}]},
    {recorte:CASOS.crianca.previa,so_frente:true,detectados:[{w:100,pts:[[10,10],[50,10],[30,30]]},{w:80,pts:[[110,10],[150,10],[146,30]]}]},
    {recorte:CASOS.crianca.previa,so_frente:true,detectados:[]},{recorte:CASOS.crianca.previa,so_frente:true,yunet:semYn}]));
  ok(rr[0].ok&&Array.isArray(rr[0].rostos),'11: a leitura de rostos do Python roda com o YuNet do repositório: '+J(rr[0]).slice(0,120));ok(rr[1].ok&&rr[1].rostos===null,'11: sem o modelo, rostos nulo');
  ok(rr[2].ok&&rr[2].layout.rostos===null&&Math.abs(rr[2].layout.corteFinal-.62)<.01,'11: sem o modelo monta sem rostos (corte da regra) e registra rostos nulo: '+J(rr[2].layout&&[rr[2].layout.rostos,rr[2].layout.corteFinal]));
  // frente (só medida na E1): rosto principal = largura >= 50% do maior; de frente = nariz a até 0,35 da distância entre os olhos
  ok(igual(rr[3].frente,{rostos:2,frontais:2,ok:true})&&igual(rr[4].frente,{rostos:2,frontais:1,ok:false})&&igual(rr[5].frente,{rostos:0,frontais:0,ok:false})&&rr[6].frente===null,'frente: critério do agente: '+J([rr[3].frente,rr[4].frente,rr[5].frente,rr[6].frente]));
  // ---- D8: corte do joelho. Medida (fiaPngInfo + fiaJoelho no navegador x png_info + joelho no Python), layout e imagem nos
  // 4 fundos ativos, prévia (o Python reduz o de 3000 em memória e mantém o tEXt) e impressão
  for(const n of Object.keys(JOELHOS)){const c=JOELHOS[n];
    const a=await pg.evaluate(async([pid])=>{const out={};for(const lado of [2400,3000]){const r=await fetch(location.origin+'/recorte',{method:'POST',body:JSON.stringify({pid,lado})});const bl=await r.blob();const info=await ETERNA.fiaPngInfo(bl);
      const u=URL.createObjectURL(bl);const im=new Image();im.src=u;await im.decode();const m0=ETERNA.fiaMedir(im);const m=ETERNA.fiaJoelho(m0,info);URL.revokeObjectURL(u);out[lado]={info,box0:m0.box,box:m.box,trunc:m.trunc,joelho:m.joelho||null};}return out;},[pidDe(n)]);
    const p=pyLinhas([PY,'--teste'],J([{recorte:c.hi,reduzir:true,so_medir:true,joelho:true},{recorte:c.hi,reduzir:true,so_medir:true},{recorte:c.hi,so_medir:true,joelho:true}]));
    ok(igual(a[2400].info,c.joelho)&&igual(p[0].info,c.joelho),'D8 '+n+': o joelho do PNG chega aos dois lados (também na cópia de 2400): '+J([a[2400].info,p[0].info]));
    for(const [lado,k] of [[2400,0],[3000,2]]){const d=Math.max(...['x','y','w','h'].map(q=>Math.abs(a[lado].box[q]-p[k].m.box[q])));
      ok(d<=1&&a[lado].trunc===p[k].m.trunc,'D8 '+n+' '+lado+': medida com o joelho igual à do navegador: '+J(a[lado].box)+' x '+J(p[k].m.box));}
    const cortou=a[2400].box.h<a[2400].box0.h*.85&&p[0].m.box.h<p[1].m.box.h*.85;
    ok(c.corta?cortou:igual(a[2400].box,a[2400].box0)&&igual(p[0].m.box,p[1].m.box),'D8 '+n+': '+(c.corta?'corta na linha dos joelhos':'não corta')+': '+J([a[2400].box0.h,a[2400].box.h,p[1].m.box.h,p[0].m.box.h]));
    for(const bg of ATIVOS){const id=n+'-'+bg;
      const r=await pg.evaluate(async([pid,bg])=>{const E=ETERNA;E.FIA_ROSTOS['ag_'+pid]=Promise.resolve([]);const r=await E.fiaMontar('ag_'+pid,bg);if(!r.canvas)return {err:r.err||r.pending||'?'};
        window.__hi=null;const h=await E.compHi('ag_'+pid,bg);return {png:r.canvas.toDataURL('image/png'),layout:r.layout,hi:window.__hi,hiLayout:h.layout};},[pidDe(n),bg]);
      if(!ok(!r.err&&r.png,'D8 canvas '+id+': '+r.err))continue;const ca=path.join(TMP,'canvas-'+id+'.png'),cah=path.join(TMP,'canvas-hi-'+id+'.png'),pp=path.join(TMP,'py-'+id+'.png'),pph=path.join(TMP,'py-hi-'+id+'.png');salvaPng(ca,r.png);if(r.hi)salvaPng(cah,r.hi);
      const [pa,pb]=pyLinhas([PY,'--teste'],J([{recorte:c.hi,reduzir:true,fundo:arqFundo(bg),bg,rostos:[],saida:pp},{recorte:c.hi,fundo:arqFundo(bg,true),bg,rostos:[],impressao:pph}]));
      if(!ok(pa.ok&&pb.ok,'D8 Python '+id+': '+J([pa,pb]).slice(0,160)))continue;
      ok(pa.layout.modo===r.layout.modo&&Math.abs(pa.layout.corteFinal-r.layout.corteFinal)<=.01&&Math.abs(pa.layout.dst.h-r.layout.dst.h)<=3&&Math.abs(pa.layout.dst.w-r.layout.dst.w)<=3,'D8 '+id+': layout igual ao do navegador: '+J([r.layout.modo,r.layout.corteFinal,r.layout.dst])+' x '+J([pa.layout.modo,pa.layout.corteFinal,pa.layout.dst]));
      const cmp=JSON.parse(py([AJ,'compara'],J([{id:'p',a:ca,b:pp,fundo_a:fundoCanvas[bg],fundo_b:arqFundo(bg),quad:quadDe({bg,w:pa.w})}].concat(r.hi?[{id:'i',a:cah,b:pph}]:[]))));
      ok(!cmp[0].erro&&cmp[0].mae<=LIM.mae&&cmp[0].frac16<=LIM.frac16&&cmp[0].caixa_px!=null&&cmp[0].caixa_px<=LIM.caixa,'D8 '+id+': prévia igual à do navegador: '+J(cmp[0]).slice(0,200));
      if(r.hi)ok(!cmp[1].erro&&cmp[1].mae<=LIM.mae&&cmp[1].frac16<=LIM.frac16,'D8 '+id+': impressão igual à do navegador: '+J(cmp[1]).slice(0,200));else ok(false,'D8 '+id+': sem a impressão do canvas');
      notas['joelho_'+id]=[+cmp[0].mae.toFixed(2),cmp[1]?+cmp[1].mae.toFixed(2):null];}}
  // ---- critério 12: halo no fundo branco de teste (outra página: o fundo do Túnel trocado por branco)
  const pg2=await ctx.newPage();pg2.setDefaultTimeout(120000);pg2.on('pageerror',e=>errs.push(e.message));const branco=path.join(TMP,'recortes','branco_2400.png');
  await pg2.route('**/'+REGRAS.fundos.tunel.previa,r=>r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(branco)}));
  await pg2.goto(U);await pg2.waitForFunction(()=>window.ETERNA&&ETERNA.fiaMontar&&ETERNA.FIA_ROSTOS,null,{timeout:20000});
  const hc=await pg2.evaluate(async pid=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};ETERNA.FIA_ROSTOS['ag_'+pid]=Promise.resolve([]);const r=await ETERNA.fiaMontar('ag_'+pid,'tunel');return r.canvas?r.canvas.toDataURL('image/png'):null;},pidDe('halo'));
  if(ok(!!hc,'12: montagem da prova do halo no canvas')){const ca=path.join(TMP,'canvas-halo.png'),pyh=path.join(TMP,'py-halo.png');salvaPng(ca,hc);
    const ph=pyLinhas([PY,'--teste'],J([{recorte:HALO.hi,reduzir:true,fundo:branco,bg:'tunel',rostos:[],saida:pyh}]))[0];ok(ph.ok,'12: montagem da prova do halo no Python');
    const hr=JSON.parse(py([AJ,'compara'],J([{id:'c',a:ca,halo:HALO.cor},{id:'p',a:pyh,halo:HALO.cor},{id:'x',a:ca,b:pyh}])));
    notas.halo={canvas:hr[0].halo_min,python:hr[1].halo_min,mae:hr[2].mae};
    ok(hr[1].halo_min>=LIM.halo,'12: halo: nenhum ponto da borda mais escuro que a pessoa e que o fundo no Python (mínimo '+hr[1].halo_min+')');
    ok(hr[2].mae<=LIM.mae&&hr[2].frac16<=LIM.frac16,'12: prova do halo igual ao canvas: '+J(hr[2]));}
  await pg2.close();
  notas.ms_canvas_medio=Math.round(vivos.reduce((s,c)=>s+(c.msCanvas||0),0)/Math.max(1,vivos.length));
  const media=(l,f)=>{const v=l.filter(f);return v.length?Math.round(v.reduce((s,c)=>s+c.x,0)/v.length):null;};
  notas.ms_python_previa=Object.fromEntries(ATIVOS.map(bg=>[bg,media(vivos.map(c=>({bg:c.bg,x:(c.pa&&c.pa.ms&&c.pa.ms.total)||0})),c=>c.bg===bg)]));
  if(comHi.length){notas.ms_python_impressao=Object.fromEntries(ATIVOS.map(bg=>[bg,media(comHi.map(c=>({bg:c.bg,x:(c.pb&&c.pb.ms&&c.pb.ms.total)||0})),c=>c.bg===bg)]));notas.pico_mb=Math.max(...comHi.map(c=>(c.pb&&c.pb.pico_mb)||0));}
  if(GUARDA)fs.writeFileSync(path.join(TMP,'resumo.json'),J({quando:new Date().toISOString(),limites:LIM,notas,casos:vivos.map(c=>({id:c.id,n:c.n,bg:c.bg,modo:c.L.modo,estreito:c.L.estreito,corteFinal:c.L.corteFinal,previa:c.p3||null,impressao:c.imp||null,canvas:c.canvas,py:c.py}))},null,1));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();if(!GUARDA)try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}}
if(fails.length){console.log('FALHA montagem-paridade: '+fails.length+' · '+fails.slice(0,12).join(' · ')+' · '+J(notas));process.exit(1);}
console.log('OK montagem-paridade (canvas x Python: tabelas, P1 layout em 8 recortes x 7 fundos, P2 medida, P3 imagem na prévia e na impressão, 1950 em preto e branco, Telão, Mirante, rosto, halo) '+J(notas));
})();
