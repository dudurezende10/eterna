// Montagem no servidor, E0 (plano docs/planos/2026-11-11-montagem-no-servidor.md): paridade entre o canvas do navegador
// (fiaMontar, a referência) e a porta em Python (agente/eterna-montagem.py). 6 recortes sintéticos (nunca foto de cliente)
// em 6 fundos (os 5 ativos + o Pódio) = 36 casos, na prévia e no corte de impressão 10x15.
//   P1 layout: a medida e os rostos do navegador entram no layout do Python; tudo igual com diferença <= 1e-6
//   P2 medida: medir do Python contra o fiaMedir na mesma PNG: box com até 1 px, trunc e modo iguais
//   P3 imagem: PNG sem JPEG no meio: erro médio <= 2,0, no máximo 1,5% dos pontos com diferença > 16, caixa do grupo com
//      até 0,4% da largura; Telão: os limites dentro da tela e nada mexido fora dela; halo no fundo branco de teste
//   critérios 7 a 9: tabela de regras igual à do app, FUNDOS_SHA do agente igual aos arquivos de img/, só numpy, PIL, cv2 e stdlib
// MONTAGEM_SAIDA=<pasta> guarda as imagens e o resumo.json; MONTAGEM_FOLHA=<arquivo.jpg> gera a folha lado a lado (D5).
// MONTAGEM_RAPIDO=1 roda só a prévia (sem o corte de impressão de 5000 px).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');const os=require('os');const crypto=require('crypto');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RAIZ=path.join(__dirname,'..');
const GUARDA=process.env.MONTAGEM_SAIDA||'';const TMP=GUARDA||fs.mkdtempSync(path.join(os.tmpdir(),'mont-paridade-'));fs.mkdirSync(TMP,{recursive:true});
const FOLHA=process.env.MONTAGEM_FOLHA||'';const RAPIDO=!!process.env.MONTAGEM_RAPIDO;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const PY=path.join(RAIZ,'agente','eterna-montagem.py'),AJ=path.join(__dirname,'_montagem_paridade.py');
const py=(args,input)=>execFileSync('python3',args,{input:input||'',maxBuffer:1<<28}).toString();
const pyLinhas=(args,input)=>py(args,input).trim().split('\n').map(l=>JSON.parse(l));
const LIM={mae:2.0,frac16:.015,caixa:.004,layout:1e-6,halo:-12};
const FUNDOS=['campeao2','mirante','arq1950','tunel','telao','podio'];const ATIVOS=FUNDOS.slice(0,5);
const igual=(a,b)=>{if(typeof a==='number'&&typeof b==='number')return a===b;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;
  if(Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return J(ka)===J(kb)&&ka.every(k=>igual(a[k],b[k]));};
(async()=>{
// ---- critério 9: só numpy, PIL, cv2 e a biblioteca padrão; nada do agente
const fonte=fs.readFileSync(PY,'utf8');const mods=[...new Set([...fonte.matchAll(/^\s*(?:import|from)\s+([A-Za-z0-9_]+)/gm)].map(m=>m[1]))];
const PERMITIDOS=['os','sys','json','math','time','re','hashlib','tempfile','threading','resource','ctypes','numpy','PIL','cv2'];
ok(mods.every(m=>PERMITIDOS.includes(m)),'9: o eterna-montagem.py importa fora da lista (numpy, PIL, cv2, stdlib): '+J(mods.filter(m=>!PERMITIDOS.includes(m))));
ok(!/socket|urllib|http\.|subprocess/.test(fonte),'9: o processo de montagem não abre porta, não baixa e não abre outro processo');
// ---- critério 8: FUNDOS_SHA do agente igual aos arquivos de img/
const ag=fs.readFileSync(path.join(RAIZ,'agente','eterna-agente.py'),'utf8');const mSha=ag.match(/^FUNDOS_SHA = (\{[\s\S]*?\})/m);let SHA={};
try{SHA=JSON.parse(mSha[1]);}catch(e){ok(false,'8: FUNDOS_SHA não abriu no eterna-agente.py');}
const mapa=n=>{const b=ag.match(new RegExp('^'+n+' = \\{([\\s\\S]*?)\\}','m'));return Object.fromEntries([...b[1].matchAll(/"([a-z0-9]+)":\s*"(img\/[^"]+)"/g)].map(x=>[x[1],x[2]]));};
const PREVIA=mapa('FUNDOS_PREVIA'),IMPRESSAO=mapa('FUNDOS_IMPRESSAO');const arqs=[...new Set([...Object.values(PREVIA),...Object.values(IMPRESSAO)])].sort();
ok(J(Object.keys(SHA).sort())===J(arqs),'8: FUNDOS_SHA cobre todos os arquivos de FUNDOS_PREVIA e FUNDOS_IMPRESSAO: '+J(arqs.filter(a=>!SHA[a])));
arqs.forEach(a=>{const h=crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ,a))).digest('hex');ok(SHA[a]===h,'8: SHA de '+a+' diferente do arquivo (rode agente/gerar-fundos-sha.py)');});
FUNDOS.forEach(bg=>ok(PREVIA[bg],'8: o fundo '+bg+' está no mapa aprovado do agente'));
// ---- figuras
const CASOS=JSON.parse(py([AJ,'figuras',path.join(TMP,'recortes')]));const HALO=CASOS.halo;delete CASOS.halo;const NOMES=Object.keys(CASOS);
ok(NOMES.length===6,'6 recortes sintéticos: '+NOMES.length);
const REGRAS=pyLinhas([PY,'--regras'])[0];
const b=await chromium.launch();const errs=[];const notas={};
try{
  const ctx=await b.newContext({viewport:{width:1280,height:800},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const recorte=r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}const c=q.pid==='halo'?HALO:CASOS[q.pid];if(!c)return r.fulfill({status:404,body:'{}'});
    r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(q.lado===3000?c.hi:c.previa)});};
  await ctx.route(ORIG+'/recorte',recorte);
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:404,body:'{}'}));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForFunction(()=>window.ETERNA&&ETERNA.fiaMontar&&ETERNA.FIA_ROSTOS,null,{timeout:20000});
  // ---- critério 7: tabela de regras do Python igual à do app
  const app=await pg.evaluate(()=>{const E=ETERNA;const telao={};E.BGS.forEach(b=>{if(b.telao)telao[b.id]=b.telao;});
    return {regras:E.FIA_REGRAS,padrao:E.FIA_PADRAO,base:E.FIA_BASE,telao,mono:E.BGS.filter(b=>b.mono).map(b=>b.id).sort(),imp:E.IMP_PX,arquivos:Object.fromEntries(E.BGS.map(b=>[b.id,[b.file,b.fileHi||null]]))};});
  for(const k of ['regras','padrao','base','telao','mono','imp'])ok(igual(REGRAS[k],app[k]),'7: tabela "'+k+'" do Python diferente da do app: '+J(REGRAS[k]).slice(0,200)+' x '+J(app[k]).slice(0,200));
  const mexida=JSON.parse(J(app.regras));mexida.tunel.meio.alt+=.01;ok(!igual(REGRAS.regras,mexida),'7: um número mudado num dos lados precisa quebrar a comparação');
  FUNDOS.forEach(bg=>{ok(app.arquivos[bg]&&app.arquivos[bg][0]===PREVIA[bg],'7: arquivo da prévia de '+bg+' igual no app e no agente');
    ok(app.arquivos[bg]&&(app.arquivos[bg][1]||app.arquivos[bg][0])===(IMPRESSAO[bg]||PREVIA[bg]),'7: arquivo de impressão de '+bg+' igual no app e no agente');});
  // o fundo como o navegador o decodifica (para a caixa do grupo e o "nada mexido fora da tela")
  const salvaPng=(arq,durl)=>fs.writeFileSync(arq,Buffer.from(durl.split(',')[1],'base64'));
  const fundoCanvas={};
  for(const bg of FUNDOS){const d=await pg.evaluate(async f=>{const im=new Image();im.src=f;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c.toDataURL('image/png');},PREVIA[bg]);
    fundoCanvas[bg]=path.join(TMP,'fundo-canvas-'+bg+'.png');salvaPng(fundoCanvas[bg],d);}
  // a medida do navegador (fiaMedir) de cada recorte, nos dois tamanhos
  const medidas={};
  for(const n of NOMES)for(const lado of [2400,3000])medidas[n+'|'+lado]=await pg.evaluate(async([pid,lado])=>{const r=await fetch(location.origin+'/recorte',{method:'POST',body:JSON.stringify({pid,lado})});const u=URL.createObjectURL(await r.blob());
    const im=new Image();im.src=u;await im.decode();const m=ETERNA.fiaMedir(im);URL.revokeObjectURL(u);return m;},[n,lado]);
  // ---- P2: medida
  const pm=pyLinhas([PY,'--teste'],J(NOMES.flatMap(n=>[2400,3000].map(lado=>({recorte:lado===3000?CASOS[n].hi:CASOS[n].previa,so_medir:true})))));
  let i=0;let p2max=0;for(const n of NOMES)for(const lado of [2400,3000]){const a=medidas[n+'|'+lado],p=pm[i++].m;const d=Math.max(...['x','y','w','h'].map(k=>Math.abs(a.box[k]-p.box[k])));p2max=Math.max(p2max,d);
    ok(a.w===p.w&&a.h===p.h&&Math.abs(a.k-p.k)<1e-12,'P2 '+n+' '+lado+': tamanho da medida igual');ok(d<=1,'P2 '+n+' '+lado+': box com até 1 px: '+J(a.box)+' x '+J(p.box));ok(a.trunc===p.trunc,'P2 '+n+' '+lado+': trunc igual');}
  notas.p2_box_max_px=p2max;
  // ---- canvas: prévia (fiaMontar) e corte de impressão (compHi)
  await pg.evaluate(()=>{const o=HTMLCanvasElement.prototype.toDataURL;window.__hi=null;HTMLCanvasElement.prototype.toDataURL=function(t,q){
    if(t==='image/jpeg'&&this.width*this.height===1844*1240&&Math.max(this.width,this.height)===1844)window.__hi=o.call(this,'image/png');return o.call(this,t,q);};});
  const C=[];
  for(const n of NOMES)for(const bg of FUNDOS){const c={n,bg,id:n+'-'+bg,ro:CASOS[n].rostos};C.push(c);
    const r=await pg.evaluate(async([pid,bg,ro])=>{const E=ETERNA;E.FIA_ROSTOS['ag_'+pid]=Promise.resolve(ro);const t0=performance.now();const r=await E.fiaMontar('ag_'+pid,bg);if(!r.canvas)return {err:r.err||r.pending||'?'};
      return {png:r.canvas.toDataURL('image/png'),w:r.w,h:r.h,layout:r.layout,ms:Math.round(performance.now()-t0)};},[n,bg,c.ro]);
    if(r.err){ok(false,'canvas '+c.id+': '+r.err);continue;}
    c.canvas=path.join(TMP,'canvas-'+c.id+'.png');salvaPng(c.canvas,r.png);c.w=r.w;c.h=r.h;c.L=r.layout;c.msCanvas=r.ms;
    if(!RAPIDO){const h=await pg.evaluate(async([pid,bg])=>{window.__hi=null;const r=await ETERNA.compHi('ag_'+pid,bg);if(!r.url)return {err:r.err||r.pending||'?'};return {png:window.__hi,w:r.w,h:r.h,layout:r.layout,avisos:r.avisos};},[n,bg]);
      if(h.err||!h.png){ok(false,'canvas hi '+c.id+': '+(h.err||'sem imagem'));continue;}
      c.canvasHi=path.join(TMP,'canvas-hi-'+c.id+'.png');salvaPng(c.canvasHi,h.png);c.LHi=h.layout;c.hiW=h.w;c.hiH=h.h;}}
  // ---- Python: as mesmas entradas do canvas (recorte de 2400 e fundo da prévia) e o caminho do servidor (3000 e 5000)
  const fundoArq=(bg,hi)=>path.join(RAIZ,hi?(IMPRESSAO[bg]||PREVIA[bg]):PREVIA[bg]);
  const vivos=C.filter(c=>c.canvas);
  const p1=pyLinhas([PY,'--teste'],J(vivos.flatMap(c=>[{recorte:CASOS[c.n].previa,fundo:fundoArq(c.bg),bg:c.bg,m:medidas[c.n+'|2400'],rostos:c.ro,so_layout:true}].concat(
    c.LHi?[{recorte:CASOS[c.n].hi,fundo:fundoArq(c.bg,true),bg:c.bg,m:medidas[c.n+'|3000'],rostos:c.ro,so_layout:true}]:[]))));
  const CAMPOS=L=>[L.corte,L.corteFinal,L.zoom,L.s,L.src.x,L.src.y,L.src.w,L.src.h,L.src.corteFinal,L.dst.x,L.dst.y,L.dst.w,L.dst.h].concat(L.tela?[L.tela.w,L.tela.h]:[]);
  let p1max=0;i=0;const confereL=(nome,a,p)=>{if(!p||!p.ok){ok(false,'P1 '+nome+': o Python não devolveu o layout');return;}const x=CAMPOS(a),y=CAMPOS(p.layout);const d=Math.max(...x.map((v,k)=>Math.abs(v-y[k])));p1max=Math.max(p1max,d);
    ok(a.modo===p.layout.modo&&x.length===y.length&&d<=LIM.layout&&J(a.mono||null)===J(p.layout.mono||null),'P1 '+nome+': layout igual (modo '+a.modo+' x '+p.layout.modo+', maior diferença '+d+')');};
  for(const c of vivos){confereL(c.id,c.L,p1[i++]);if(c.LHi)confereL(c.id+' hi',c.LHi,p1[i++]);}
  notas.p1_layout_max=p1max;
  const t0=Date.now();
  const pa=pyLinhas([PY,'--teste'],J(vivos.map(c=>({recorte:CASOS[c.n].previa,fundo:fundoArq(c.bg),bg:c.bg,rostos:c.ro,saida:(c.py=path.join(TMP,'py-'+c.id+'.png'))}))));
  vivos.forEach((c,k)=>{c.pa=pa[k];ok(pa[k].ok,'Python '+c.id+': '+J(pa[k]).slice(0,160));if(pa[k].ok)ok(pa[k].layout.modo===c.L.modo,'P2 '+c.id+': modo igual com a medida do Python ('+pa[k].layout.modo+' x '+c.L.modo+')');});
  const comHi=vivos.filter(c=>c.canvasHi);
  const pb=comHi.length?pyLinhas([PY,'--teste'],J(comHi.map(c=>({recorte:CASOS[c.n].hi,fundo:fundoArq(c.bg,true),bg:c.bg,rostos:c.ro,impressao:(c.pyHi=path.join(TMP,'py-hi-'+c.id+'.png')),reduzida:[(c.pySrv=path.join(TMP,'py-srv-'+c.id+'.png')),c.w,c.h]})))):[];
  comHi.forEach((c,k)=>{c.pb=pb[k];ok(pb[k].ok,'Python hi '+c.id+': '+J(pb[k]).slice(0,160));});
  notas.python_s=Math.round((Date.now()-t0)/100)/10;
  // ---- P3: imagem
  const quadDe=c=>{const t=REGRAS.telao[c.bg];if(!t)return null;const k=c.w/t.w;return t.quad.map(([x,y])=>[x*k,y*k]);};
  const jobs=[];vivos.forEach(c=>{if(c.pa&&c.pa.ok)jobs.push({id:'previa|'+c.id,a:c.canvas,b:c.py,fundo_a:fundoCanvas[c.bg],fundo_b:fundoArq(c.bg),quad:quadDe(c),sem_caixa:c.L.zoom<1});
    if(c.pb&&c.pb.ok){jobs.push({id:'impressao|'+c.id,a:c.canvasHi,b:c.pyHi});jobs.push({id:'servidor|'+c.id,a:c.canvas,b:c.pySrv});}});
  // quanto o arquivo de 5000 px de cada fundo difere do de 2400 px (é a diferença que o "servidor" abaixo carrega)
  if(!RAPIDO)FUNDOS.forEach(bg=>{const c=vivos.find(x=>x.bg===bg);if(c&&IMPRESSAO[bg])jobs.push({id:'fundos|'+bg,a:fundoCanvas[bg],b:fundoArq(bg,true),b_reduz:[c.w,c.h]});});
  const res=JSON.parse(py([AJ,'compara'],J(jobs)));const R={};res.forEach(r=>{R[r.id]=r;});
  const pior={previa:{mae:0,frac16:0,caixa:0},impressao:{mae:0,frac16:0},servidor:{mae:0,frac16:0}};const soma={previa:[0,0],impressao:[0,0],servidor:[0,0]};
  for(const c of vivos){const p=R['previa|'+c.id];if(!p)continue;if(p.erro){ok(false,'P3 '+c.id+': '+p.erro);continue;}
    const tel=!!REGRAS.telao[c.bg];const mae=tel?p.mae_dentro:p.mae,f16=tel?p.frac16_dentro:p.frac16;c.p3={mae,frac16:f16,caixa:p.caixa_desvio};
    pior.previa.mae=Math.max(pior.previa.mae,mae);pior.previa.frac16=Math.max(pior.previa.frac16,f16);soma.previa[0]+=mae;soma.previa[1]++;
    ok(mae<=LIM.mae,'P3 '+c.id+': erro médio '+mae+' (limite '+LIM.mae+')');ok(f16<=LIM.frac16,'P3 '+c.id+': '+(f16*100).toFixed(2)+'% dos pontos com diferença > 16 (limite 1,5%)');
    if(c.L.zoom>=1){ok(p.caixa_desvio!=null&&p.caixa_desvio<=LIM.caixa,'P3 '+c.id+': caixa do grupo com desvio '+p.caixa_desvio+' (limite 0,4% da largura): '+J(p.caixa_a)+' x '+J(p.caixa_b));if(p.caixa_desvio!=null)pior.previa.caixa=Math.max(pior.previa.caixa,p.caixa_desvio);}
    if(tel){ok(p.fora_a===0,'5: Telão '+c.id+': o canvas não mexe fora da tela (maior diferença '+p.fora_a+')');ok(p.fora_b===0,'5: Telão '+c.id+': o Python não mexe fora da tela (maior diferença '+p.fora_b+')');notas.telao_fundo_mae=p.fundo_mae;}
    notas.fundo_decod_mae=Math.max(notas.fundo_decod_mae||0,p.fundo_mae||0);
    for(const t of ['impressao','servidor']){const q=R[t+'|'+c.id];if(!q)continue;if(q.erro){ok(false,'P3 '+t+' '+c.id+': '+q.erro);continue;}c[t]={mae:q.mae,frac16:q.frac16};
      pior[t].mae=Math.max(pior[t].mae,q.mae);pior[t].frac16=Math.max(pior[t].frac16,q.frac16);soma[t][0]+=q.mae;soma[t][1]++;
      // "servidor" = o arquivo final do servidor (recorte de 3000 e fundo de 5000 px) reduzido, contra a prévia do canvas (2400): informativo,
      // porque soma a diferença entre os dois ARQUIVOS de fundo (notas.fundos_5000_x_2400); o critério 3 vale para as mesmas entradas e para a impressão
      if(t==='impressao'){ok(q.mae<=LIM.mae,'P3 '+t+' '+c.id+': erro médio '+q.mae+' (limite '+LIM.mae+')');ok(q.frac16<=LIM.frac16,'P3 '+t+' '+c.id+': '+(q.frac16*100).toFixed(2)+'% dos pontos com diferença > 16 (limite 1,5%)');}
      if(t==='impressao')ok(q.w===c.hiW&&q.h===c.hiH&&q.w===1844&&q.h===1240,'3: corte de impressão em 1844x1240: '+q.w+'x'+q.h);}}
  notas.fundos_5000_x_2400={};FUNDOS.forEach(bg=>{const f=R['fundos|'+bg];if(f&&!f.erro)notas.fundos_5000_x_2400[bg]={mae:f.mae,frac16:f.frac16};});
  notas.casos=vivos.length;notas.pior=pior;notas.media={previa:soma.previa[1]?+(soma.previa[0]/soma.previa[1]).toFixed(3):null,impressao:soma.impressao[1]?+(soma.impressao[0]/soma.impressao[1]).toFixed(3):null,servidor:soma.servidor[1]?+(soma.servidor[0]/soma.servidor[1]).toFixed(3):null};
  // cobertura: os casos pegam o que o plano pede
  const modoDe=(n,bg)=>(vivos.find(c=>c.n===n&&c.bg===bg)||{L:{}}).L;
  ok(modoDe('familia','arq1950').modo==='largo'&&modoDe('familia','arq1950').zoom===.8,'cobertura: família larga no 1950 cai na regra 10 (largo, zoom 0,8): '+J(modoDe('familia','arq1950').modo));
  ok(modoDe('meio3','tunel').modo==='meio'&&modoDe('casal','tunel').modo==='inteiro','cobertura: meio corpo e corpo inteiro');
  ok(modoDe('crianca','tunel').corteFinal>.62+.02&&modoDe('crianca','tunel').rostos===2,'cobertura: o corte desce pelo rosto da criança: '+J([modoDe('crianca','tunel').corteFinal,modoDe('crianca','tunel').rostos]));
  ok(vivos.some(c=>c.L.dst.w>=c.w*.999&&!REGRAS.telao[c.bg]),'cobertura: um grupo ocupa a largura toda');
  // ---- critério 4: halo no fundo branco de teste (outra página: o fundo do Túnel trocado por branco)
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));const branco=path.join(TMP,'recortes','branco_2400.png');
  await pg2.route('**/'+PREVIA.tunel,r=>r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(branco)}));
  await pg2.goto(U);await pg2.waitForFunction(()=>window.ETERNA&&ETERNA.fiaMontar&&ETERNA.FIA_ROSTOS,null,{timeout:20000});
  const hc=await pg2.evaluate(async()=>{ETERNA.FIA_ROSTOS['ag_halo']=Promise.resolve([]);const r=await ETERNA.fiaMontar('ag_halo','tunel');return r.canvas?r.canvas.toDataURL('image/png'):null;});
  ok(!!hc,'4: montagem da prova do halo no canvas');
  if(hc){const ca=path.join(TMP,'canvas-halo.png'),pyh=path.join(TMP,'py-halo.png');salvaPng(ca,hc);
    const ph=pyLinhas([PY,'--teste'],J([{recorte:HALO.previa,fundo:branco,bg:'tunel',rostos:[],saida:pyh}]))[0];ok(ph.ok,'4: montagem da prova do halo no Python');
    const hr=JSON.parse(py([AJ,'compara'],J([{id:'c',a:ca,halo:HALO.cor},{id:'p',a:pyh,halo:HALO.cor},{id:'x',a:ca,b:pyh}])));
    notas.halo={canvas:hr[0].halo_min,python:hr[1].halo_min,mae:hr[2].mae};
    ok(hr[1].halo_min>=LIM.halo,'4: halo: nenhum ponto da borda mais escuro que a pessoa e que o fundo no Python (mínimo '+hr[1].halo_min+')');
    ok(hr[2].mae<=LIM.mae&&hr[2].frac16<=LIM.frac16,'4: prova do halo igual ao canvas: '+J(hr[2]));}
  await pg2.close();
  // ---- critério 6 (rostos): a leitura do YuNet do Python existe e, sem o modelo, devolve nulo (segue sem rostos)
  const yn=path.join(RAIZ,'vendor','rostos','face_detection_yunet_2023mar.onnx');
  const rr=pyLinhas([PY,'--teste'],J([{recorte:CASOS.crianca.previa,so_rostos:true,yunet:yn},{recorte:CASOS.crianca.previa,so_rostos:true,yunet:path.join(TMP,'nao-existe.onnx')}]));
  ok(rr[0].ok&&Array.isArray(rr[0].rostos),'6: a leitura de rostos do Python roda com o YuNet do repositório: '+J(rr[0]).slice(0,120));ok(rr[1].ok&&rr[1].rostos===null,'6/21: sem o modelo, rostos nulo');
  notas.ms_canvas_medio=Math.round(vivos.reduce((s,c)=>s+(c.msCanvas||0),0)/Math.max(1,vivos.length));
  notas.ms_python_previa=Math.round(vivos.reduce((s,c)=>s+((c.pa&&c.pa.ms&&c.pa.ms.total)||0),0)/Math.max(1,vivos.length));
  if(comHi.length){notas.ms_python_5000=Math.round(comHi.reduce((s,c)=>s+((c.pb.ms&&c.pb.ms.total)||0),0)/comHi.length);notas.pico_mb=Math.max(...comHi.map(c=>c.pb.pico_mb||0));}
  const resumo={quando:new Date().toISOString(),limites:LIM,notas,casos:vivos.map(c=>({id:c.id,n:c.n,bg:c.bg,modo:c.L.modo,corteFinal:c.L.corteFinal,previa:c.p3||null,impressao:c.impressao||null,servidor:c.servidor||null,canvas:c.canvas,py:c.py,pySrv:c.pySrv||null}))};
  fs.writeFileSync(path.join(TMP,'resumo.json'),J(resumo,null,1));
  // ---- folha lado a lado (D5): 2 figuras em cada fundo ativo, com o Telão
  if(FOLHA){const nome={campeao2:'Noite de campeão',mirante:'Mirante ao pôr do sol',arq1950:'Arquibancada 1950',tunel:'Saída do túnel',telao:'Telão do Maracanã'};
    const escolha=bg=>bg==='arq1950'?['familia','casal']:bg==='telao'?['meio3','crianca']:bg==='mirante'?['casal','sozinha']:bg==='tunel'?['crianca','estoura']:['meio3','familia'];
    const pct=v=>(v*100).toFixed(2).replace('.',',')+'%';const nn=v=>String(v).replace('.',',');
    const linhas=ATIVOS.flatMap(bg=>escolha(bg).map(n=>vivos.find(c=>c.n===n&&c.bg===bg)).filter(c=>c&&c.p3).map(c=>({a:c.canvas,b:c.pySrv||c.py,rotulo:nome[bg]+' · '+CASOS[c.n].nota+' · '+c.L.modo+(c.L.corteFinal<1?' (corte '+nn(c.L.corteFinal.toFixed(2))+')':''),
      numeros:'mesmas entradas: erro médio '+nn(c.p3.mae.toFixed(2))+' de 255, '+pct(c.p3.frac16)+' dos pontos acima de 16'+(c.p3.caixa!=null?', caixa '+pct(c.p3.caixa):'')+(c.servidor?' · arquivo do servidor (fundo de 5000 px, reduzido): '+nn(c.servidor.mae.toFixed(2))+', '+pct(c.servidor.frac16)+(notas.fundos_5000_x_2400[c.bg]?' (só o fundo: '+nn(notas.fundos_5000_x_2400[c.bg].mae.toFixed(2))+')':''):'')+(c.impressao?' · impressão 10x15: '+nn(c.impressao.mae.toFixed(2))+', '+pct(c.impressao.frac16):'')})));
    const rod=['Limites do plano: erro médio até 2,0 (escala 0 a 255), até 1,5% dos pontos com diferença acima de 16, caixa do grupo até 0,4% da largura.',
      vivos.length+' casos (6 figuras x 6 fundos). Pior caso na prévia: erro médio '+nn(pior.previa.mae.toFixed(2))+', '+pct(pior.previa.frac16)+', caixa '+pct(pior.previa.caixa)+(soma.impressao[1]?'. Na impressão: '+nn(pior.impressao.mae.toFixed(2))+', '+pct(pior.impressao.frac16):'')+'.',
      'Layout (posição e tamanho do grupo): diferença máxima '+p1max.toExponential(1)+'. Figuras desenhadas para o teste; nenhuma foto de cliente.',
      'A coluna da direita é o arquivo que o servidor guarda (recorte de 3000 px e fundo de 5000 px, o da impressão), reduzido. A diferença maior nesse número vem do arquivo do fundo:',
      'o de 5000 px não é idêntico ao de 2400 px que a prévia do navegador usa hoje ("só o fundo"). Com as mesmas entradas, navegador e servidor dão a mesma imagem.'];
    try{py([AJ,'folha',FOLHA],J({titulo:'Eterna · montagem dos fundos de IA: navegador x servidor',rodape:rod,linhas}));notas.folha=FOLHA;}catch(e){ok(false,'folha lado a lado: '+String(e.message).slice(0,200));}}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();if(!GUARDA)try{fs.rmSync(TMP,{recursive:true,force:true});}catch(e){}}
if(fails.length){console.log('FALHA montagem-paridade: '+fails.length+' · '+fails.slice(0,12).join(' · ')+' · '+J(notas));process.exit(1);}
console.log('OK montagem-paridade (canvas x Python: regras, FUNDOS_SHA, P1 layout, P2 medida, P3 imagem na prévia e na impressão, Telão, halo) '+J(notas));
})();
