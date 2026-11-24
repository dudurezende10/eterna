// 18/11 (plano "bases dos fundos de IA só com foto do gramado", fatia B, critérios 22 a 24): Treino da IA › Resultado (a antiga
// Medição; desde 24/11 o interruptor e o "ligar mesmo assim" ficam em Configurações › IA automática, #tr-cfg, só o Admin). A aba abre
// sem erro com a situação, o critério (quanto falta por classe), o gramado como base, o acerto por classe, a matriz marcado ×
// reconhecido, as pistas da imagem e a lista dos erros; a miniatura de um erro abre a lupa e "Abrir no Marcar" leva à foto na
// aba Marcar; abaixo do critério o botão Ligada do ponto fica desativado com a explicação, e o 409 do servidor mostra o aviso
// e abre a Medição. Cada chave nova do EQ tem 5 textos. Agente falso por page.route; miniaturas desenhadas na hora.
// ETERNA_PRINT=<pasta> grava uma captura da aba (dados de teste).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;
const CORES={gramado:[40,140,50],arquibancada:[40,60,160],trofeu:[200,170,40],chute:[25,85,35],outro:[128,128,128]};
const THUMB={};for(const [k,c] of Object.entries(CORES))THUMB[k]=Buffer.from(execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(300,200),(${c.join(',')}));d=ImageDraw.Draw(im);d.ellipse([132,40,168,76],fill=(230,200,170));d.rectangle([122,78,178,200],fill=(200,40,40))
b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim(),'base64');
const DIA='2026-11-17';const pid=i=>(0xabd000000000+i).toString(16);
const CLS=['gramado','arquibancada','trofeu','chute','outro'];
const ROT={gramado:42,arquibancada:26,trofeu:6,chute:4,outro:29};
const MX={gramado:{gramado:38,arquibancada:1,trofeu:0,chute:3,outro:0,fora:0},arquibancada:{gramado:0,arquibancada:24,trofeu:0,chute:0,outro:1,fora:1},
  trofeu:{gramado:0,arquibancada:1,trofeu:4,chute:0,outro:0,fora:1},chute:{gramado:2,arquibancada:0,trofeu:0,chute:2,outro:0,fora:0},outro:{gramado:0,arquibancada:0,trofeu:0,chute:0,outro:28,fora:1}};
const ERROS=[{pid:pid(1),dia:DIA,card:'LPMED0001',marcado:'chute',previsto:'gramado',conf:0.82},{pid:pid(2),dia:DIA,card:'LPMED0002',marcado:'gramado',previsto:'chute',conf:0.71},
  {pid:pid(3),dia:DIA,card:'LPMED0003',marcado:'arquibancada',previsto:'outro',conf:0.64},{pid:pid(4),dia:DIA,card:'LPMED0004',marcado:'trofeu',previsto:'fora',conf:0}];
const CLASSE_DE={[pid(1)]:'chute',[pid(2)]:'gramado',[pid(3)]:'arquibancada',[pid(4)]:'trofeu'};
const MEDIDA={v:1,metodo:'sessao',versao:'c1-clip-b32-k7-l070-p080-9f8e7d6c',ligada_versao:null,classes:CLS,rotulos:ROT,sem_vetor:0,metas:{gramado:150,arquibancada:40,trofeu:40,chute:60,outro:40},
  faltam:{gramado:108,arquibancada:14,trofeu:34,chute:56,outro:11},params:{k:7,limiar:0.7,sim_piso:0.8,verde_min:0.03,flash_min:0.4},n:107,matriz:MX,
  classe:{gramado:{n:42,precisao:0.95,cobertura:0.9048},arquibancada:{n:26,precisao:0.9231,cobertura:0.9231},trofeu:{n:6,precisao:1,cobertura:0.6667},chute:{n:4,precisao:0.4,cobertura:0.5},outro:{n:29,precisao:0.9655,cobertura:0.9655}},
  gramado_base:{vp:36,fp:2,fn:6,precisao:0.9474,cobertura:0.8571,outro_como_gramado:0},
  sinais:{verde:{alvo:'gramado',contra:'resto',auc:0.88,media:{},veto:{min:0.03,ligado:true,tira_fp:1,perde_vp:0}},flash:{alvo:'gramado',contra:'chute',auc:0.93,media:{},veto:{min:0.4,ligado:true,tira_fp:1,perde_vp:0}},
    cadeiras:{alvo:'arquibancada',contra:'resto',auc:0.79,media:{},veto:null},dourado:{alvo:'trofeu',contra:'resto',auc:0.91,media:{},veto:null}},
  erros:ERROS,criterio:{passa:false,falta:[{k:'n',classe:'gramado',tem:42,precisa:150},{k:'n',classe:'arquibancada',tem:26,precisa:40},{k:'n',classe:'trofeu',tem:6,precisa:40},{k:'n',classe:'chute',tem:4,precisa:60},{k:'n',classe:'outro',tem:29,precisa:40},
    {k:'precisao',tem:0.9474,precisa:0.98},{k:'prosp_n',tem:12,precisa:100}]},em:'2026-11-18T10:00:00',ms:42};
async function agente(ctx,R){R.cfg=[];R.medida=0;R.amostra=[];R.analise={ponto:'medir',exposicao:'desligada'};R.passa=false;R.abaixo=null;R.lv=null;R.semRot=false;R.cong=null;R.semMod=false;R.atraso=0;
  const js=(r,b,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(b)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bM',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gM',hoje:0,abertas:0},
    treino:{v:1,rotulos:107,analise:R.analise,ajuste:null,modelo_ponto:{v:1,pronto:!R.semMod,erro:R.semMod?'sem_modelo':null,congelados:R.cong,provedor:'cuda',modelo:'clip-b32',versao:MEDIDA.versao,ligada_versao:R.lv,abaixo:R.abaixo,aviso:R.semMod?'sem_modelo':null,fila:0,feitas_hoje:812,ms_medio:14,criterio_passa:R.passa}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'gM',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]}));
  await ctx.route(ORIG+'/fila-fotografo',r=>js(r,{ok:true,grupos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs?*',r=>js(r,{ok:true,docs:[]}));
  await ctx.route(ORIG+'/ponto/docs',r=>js(r,{ok:true,gravados:0,recusados:0}));
  await ctx.route(ORIG+'/thumb/**',r=>{const p=new URL(r.request().url()).pathname.split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:THUMB[CLASSE_DE[p]||'gramado']});});
  await ctx.route(ORIG+'/file/**',r=>{const p=new URL(r.request().url()).pathname.split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:THUMB[CLASSE_DE[p]||'gramado']});});
  await ctx.route(ORIG+'/treino/dias',r=>js(r,{v:1,dias:[{dia:DIA,fotos:40,sessoes:8,rotuladas:20}]}));
  await ctx.route(ORIG+'/treino/medida?*',r=>{R.medida++;const m=new URL(r.request().url()).searchParams.get('metodo');js(r,Object.assign({},MEDIDA,{metodo:m,ligada_versao:R.lv,ligada_abaixo:R.abaixo,modelo_ok:true}));});
  await ctx.route(ORIG+'/treino/amostra?*',r=>{const q=new URL(r.request().url()).searchParams;R.amostra.push(Object.fromEntries(q));
    js(r,{v:1,dia:q.get('dia'),modo:q.get('modo'),semente:'abc',total_dia:4,itens:ERROS.map((e,i)=>({pid:e.pid,card:e.card,fotografo:'carlos',t:1763380000+i*20,ordem:1,n_sessao:3,rostos:2,rotulo:{v:1,pid:e.pid,ponto:e.marcado,qual:{nivel:null,motivos:[],ajuste:[]},ia:{serve:null,motivos:[],frente:null},duvida:false,obs:'',por:'quem',em:'2026-11-17T10:00:00.000'}}))});});
  await ctx.route(ORIG+'/treino/config',async r=>{const b=r.request().postDataJSON();R.cfg.push(b);
    if(b.forcar&&R.atraso)await new Promise(ok_=>setTimeout(ok_,R.atraso));
    if(R.limite)return js(r,{ok:false,error:'limite'},429);
    if(b.forcar&&R.igual)return js(r,{ok:true,analise:Object.assign({},R.analise),por:R.email,em:R.abaixo.em,abaixo:R.abaixo,ponto_versao:R.lv,congelados:R.cong,igual:true});
    if(b.forcar){if(R.semRot)return js(r,{ok:false,error:'rotulos',falta:[{k:'rot_outra_lidas',tem:0,precisa:1}]},409);
      R.analise.ponto='ligada';R.lv='c1-clip-b32-k7-l070-p080-forcada1';R.abaixo={por:R.email,em:'2026-11-18T22:30:00Z'};R.cong=312;
      return js(r,{ok:true,analise:Object.assign({},R.analise),por:R.email,em:R.abaixo.em,abaixo:R.abaixo,ponto_versao:R.lv,congelados:R.cong});}
    if(b.ponto==='ligada'&&!R.passa)return js(r,{ok:false,error:'criterio',falta:MEDIDA.criterio.falta},409);Object.assign(R.analise,b);js(r,{ok:true,analise:Object.assign({},R.analise),por:'quem',em:'x'});});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);R.email=email;await entrarTeste(pg,email);await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.treino);
  await pg.evaluate(()=>ETERNA.go('treino'));await pg.waitForTimeout(300);
  ok(J(await pg.$$eval('[data-act="tr-aba"]',x=>x.map(b=>b.dataset.a)))===J(['marcar','medida','outubro']),'abas com o Resultado');
  ok(await pg.textContent('[data-act="tr-aba"][data-a="medida"]')==='Resultado','24/11: a aba se chama Resultado');
  // 24 (24/11): o interruptor está em Configurações › Fundos de IA; abaixo do critério, Ligado abre a confirmação (sem travar)
  const irCfg=async()=>{await pg.evaluate(()=>ETERNA.go('ia-auto'));await espera(pg,()=>document.querySelector('#tr-cfg [data-act="tr-cfg"]'));};
  await irCfg();
  const lig=await pg.$eval('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]',x=>({dis:x.disabled,p:x.getAttribute('aria-pressed')}));
  ok(!lig.dis&&lig.p==='false','24: Ligado do ponto não fica travado: '+J(lig));
  {let d0=null;pg.once('dialog',d=>{d0=d.message();d.dismiss();});const c0=R.cfg.length;await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await pg.waitForTimeout(300);
    ok(/abaixo da meta/.test(d0||'')&&R.cfg.length===c0,'24: Ligado com o critério não passando abre a confirmação; Cancelar não manda nada: '+J(d0));}
  const ex=await pg.$eval('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="on"]',x=>x.disabled);ok(!ex,'a exposição também não fica travada (o servidor confere)');
  await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>document.querySelector('[data-act="tr-aba"]'));
  // 22: a aba abre com tudo
  await pg.click('[data-act="tr-aba"][data-a="medida"]');await espera(pg,()=>document.querySelector('.tr-med-mx'));
  const t=await pg.evaluate(()=>({mx:document.querySelectorAll('.tr-med-mx tbody tr').length,cols:document.querySelectorAll('.tr-med-mx thead th').length,ok:[...document.querySelectorAll('.tr-med-mx td.ok')].length,
    acerto:document.querySelectorAll('.tr-med-acerto tbody tr').length,erros:document.querySelectorAll('.tr-med-e').length,faltas:document.querySelectorAll('.tr-med-faltas li').length,
    sinais:document.querySelectorAll('.tr-med-sinais tbody tr').length,txt:document.querySelector('#main').innerText}));
  ok(t.mx===5&&t.cols===7&&t.ok===5,'22: matriz 5 × 6 (com "outro lugar") e a diagonal marcada: '+J({mx:t.mx,cols:t.cols,ok:t.ok}));
  ok(t.acerto===5&&t.erros===4&&t.faltas===7&&t.sinais===4,'22: acerto por classe, erros, o que falta e as pistas: '+J({a:t.acerto,e:t.erros,f:t.faltas,s:t.sinais}));
  ok(/Gramado: 42 de 150 marcadas/.test(t.txt)&&/Chute a gol: 4 de 60|chute: 4 de 60/i.test(t.txt)&&/94,7%/.test(t.txt)&&/Flash na pessoa/.test(t.txt),'22: textos da Medição (faltam por classe, precisão, pistas): '+t.txt.slice(0,600));
  ok(R.medida>=1,'a aba pede /treino/medida');
  if(process.env.ETERNA_PRINT){await pg.waitForTimeout(500);await pg.screenshot({path:require('path').join(process.env.ETERNA_PRINT,'treino-medicao.png'),fullPage:true});}
  // método
  const m0=R.medida;await pg.click('[data-act="tr-med-metodo"][data-m="prospectivo"]');await espera(pg,(n)=>ETERNA.state.train.med.j&&ETERNA.state.train.med.j.metodo==='prospectivo',4000);
  ok(R.medida>m0,'o método "Depois de reconhecidas" pede de novo');
  // 23: lupa e Abrir no Marcar
  await pg.click('.tr-med-e .tr-med-th');await pg.waitForTimeout(400);
  const lupa=await pg.evaluate(()=>{const mo=document.getElementById('modal');return {on:mo&&(mo.classList.contains('on')||getComputedStyle(mo).display!=='none'),cap:(document.getElementById('modal-cap')||{}).textContent||''};});
  ok(lupa.on,'23: a miniatura do erro abre a lupa: '+J(lupa));
  await pg.keyboard.press('Escape');await pg.waitForTimeout(200);
  await pg.click('.tr-med-e:nth-child(2) [data-act="tr-med-ir"]');await espera(pg,()=>ETERNA.state.train.aba==='marcar'&&ETERNA.state.train.itens.length);
  const ir=await pg.evaluate(()=>({aba:ETERNA.state.train.aba,dia:ETERNA.state.train.dia,atual:(ETERNA.trAtual()||{}).pid,src:(document.querySelector('.tr-foto img')||{}).src}));
  ok(ir.aba==='marcar'&&ir.dia===DIA&&ir.atual===ERROS[1].pid&&R.amostra.some(q=>q.marcadas==='1'),'23: Abrir no Marcar mostra a foto na aba Marcar: '+J(ir)+' '+J(R.amostra));
  // 24: 409 do servidor -> aviso, e a tela fica em Configurações
  await irCfg();await pg.evaluate(()=>{ETERNA.state.agent.treino.modelo_ponto.criterio_passa=true;ETERNA.render();});
  await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await pg.waitForTimeout(500);
  const t409=await pg.evaluate(()=>({toast:document.getElementById('toast').textContent,view:ETERNA.state.view,aba:ETERNA.state.train.aba,ponto:ETERNA.state.agent.treino.analise.ponto,cp:ETERNA.state.agent.treino.modelo_ponto.criterio_passa}));
  ok(/abaixo da meta\. Toque em Ligado de novo/.test(t409.toast)&&t409.view==='ia-auto'&&t409.aba==='marcar'&&t409.ponto==='medir'&&t409.cp===false&&J(R.cfg[R.cfg.length-1])===J({ponto:'ligada'}),'24: 409 criterio vira o aviso e não troca de tela nem de aba: '+J(t409));
  // 18/11 (Eduardo, ligar já): "Ligar mesmo assim" só para quem tem configuracao.u, com confirmação; ligado assim, o selo
  // "Ligado abaixo da meta por <nome> em <data>" e o que falta continuam na Medição
  const LIGA='#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]';
  ok(await pg.$(LIGA)&&/O acerto ainda não chegou à meta/.test(await pg.textContent('#tr-cfg')),'abaixo do critério, Ligado aparece com a nota para quem tem configuracao.u');
  const semPerm=await pg.evaluate(()=>{const u=ETERNA.state.user;const p0=u.perms.configuracao,pr0=u.preset,m0=u.menu;u.preset='supervisor';delete u.menu;ETERNA.render(); // 24/11: só o Admin muda
    const tem=!!document.querySelector('#tr-cfg [data-act="tr-cfg"][data-k="ponto"]')||!!document.querySelector('[data-act="tr-forcar"]');const pil=(document.querySelector('#tr-cfg')||{}).textContent||'';u.perms.configuracao=p0;u.preset=pr0;if(m0!==undefined)u.menu=m0;ETERNA.render();return tem||!/Desligado/.test(pil);});
  ok(!semPerm,'quem não é Admin não vê os botões (só a pílula)');
  let dlg=null;pg.once('dialog',d=>{dlg=d.message();d.dismiss();});const n0=R.cfg.length;
  await pg.click(LIGA);await pg.waitForTimeout(300);
  ok(dlg==='O acerto ainda está abaixo da meta. Algumas fotos fora do gramado podem virar fundo de IA. Ligar mesmo assim?'&&R.cfg.length===n0,'a confirmação diz o risco e Cancelar não liga: '+J(dlg));
  R.semRot=true;pg.once('dialog',d=>d.accept());await pg.click(LIGA);await pg.waitForTimeout(500);
  await espera(pg,()=>document.querySelector('#tr-cfg .tr-med-forcar-aviso'));
  const tRot=await pg.evaluate(()=>{const a=document.querySelector('#tr-cfg .tr-med-forcar-aviso');return {toast:document.getElementById('toast').textContent,ponto:ETERNA.state.agent.treino.analise.ponto,view:ETERNA.state.view,
    aviso:a?a.textContent:'',itens:a?a.querySelectorAll('li').length:0,html:a?a.innerHTML:''};});
  ok(/gramado e de pelo menos um outro ponto/.test(tRot.aviso)&&/outro ponto marcadas e já lidas pelo reconhecimento: 0 \(precisa 1\)/.test(tRot.aviso)&&tRot.itens===1&&!/&amp;|&lt;/.test(tRot.html)
    &&tRot.toast==='Não ligou. O que falta está logo abaixo.'&&tRot.ponto==='medir'&&tRot.view==='ia-auto','409 rotulos: o que falta fica em Configurações, em texto puro: '+J(tRot));
  R.semRot=false;R.atraso=900;pg.once('dialog',d=>d.accept());await pg.click(LIGA);await pg.waitForTimeout(250);
  const voo=await pg.evaluate(()=>{const b=document.querySelector('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');if(b)b.click();return {dis:b&&b.disabled};}); // 2º clique no meio do pedido
  ok(voo.dis===true,'o botão fica travado enquanto o pedido está em voo: '+J(voo));
  await espera(pg,()=>document.querySelector('#tr-cfg .tr-med-abaixo'));
  const lg=await pg.evaluate(()=>({selo:(document.querySelector('#tr-cfg .tr-med-abaixo')||{}).textContent||'',ponto:ETERNA.state.agent.treino.analise.ponto,nome:ETERNA.state.user.name,
    aviso:!!document.querySelector('#tr-cfg .tr-med-forcar-aviso'),botao:(document.querySelector('#tr-cfg [data-act="tr-forcar"]')||{}).textContent||null,toast:document.getElementById('toast').textContent,
    on:(document.querySelector('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]')||{}).getAttribute?.('aria-pressed')}));
  ok(J(R.cfg[R.cfg.length-1])===J({ponto:'ligada',forcar:true}),'o POST leva forcar: '+J(R.cfg.slice(-1)));
  ok(lg.ponto==='ligada'&&lg.selo.startsWith('Ligado abaixo da meta por '+lg.nome+' em ')&&/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(lg.selo),'selo Ligado abaixo da meta por <nome> em <data>: '+J(lg));
  ok(!lg.aviso&&lg.on==='true','ligado: o Ligado fica marcado e o aviso do 409 sai: '+J(lg));
  ok(lg.botao==='Ligar de novo com as marcações de agora','ligado, a versão medida diferente da ligada oferece religar: '+J(lg.botao));
  ok(/abaixo da meta/.test(lg.toast),'aviso de ligado abaixo da meta: '+J(lg.toast));
  ok(R.cfg.filter(b=>b.forcar).length===2,'um clique, um pedido (o botão travado não manda outro): '+R.cfg.filter(b=>b.forcar).length);
  ok(!await pg.$('.tr-med-zero')&&!await pg.$('.tr-med-sem-modelo'),'com fotos congeladas e modelo instalado, sem os avisos');
  if(process.env.ETERNA_PRINT){await pg.waitForTimeout(300);await pg.screenshot({path:require('path').join(process.env.ETERNA_PRINT,'treino-medicao-abaixo.png'),fullPage:true});}
  ok(await pg.evaluate(()=>ETERNA.state.agent.treino.modelo_ponto.congelados)===312,'a resposta do POST atualiza as fotos congeladas na hora');
  // revisão: Ligada igual (nada mudou) não vai para o auditLog; 429 tem aviso próprio
  const nAud=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>e.acao==='treino_analise').length);
  R.atraso=0;const a0=await nAud();R.igual=true;pg.once('dialog',d=>d.accept());await pg.click('#tr-cfg [data-act="tr-forcar"]');await pg.waitForTimeout(500);
  const ig=await pg.evaluate(()=>document.getElementById('toast').textContent);const a1=await nAud();R.igual=false;
  ok(/Nada mudou/.test(ig)&&a1===a0,'Ligada igual: aviso de que nada mudou e nada no auditLog: '+J({ig,a0,a1}));
  R.limite=true;pg.once('dialog',d=>d.accept());await pg.click('#tr-cfg [data-act="tr-forcar"]');await pg.waitForTimeout(500);
  const lm=await pg.evaluate(()=>document.getElementById('toast').textContent);R.limite=false;
  ok(lm==='Muitas mudanças seguidas, espere um minuto','429: muitas mudanças seguidas: '+J(lm));
  // revisão: com 0 fotos congeladas (modelo instalado), o aviso de ligar de novo
  R.cong=0;await pg.evaluate(()=>{Object.assign(ETERNA.state.agent.treino.modelo_ponto,{congelados:0});ETERNA.render();});
  await espera(pg,()=>document.querySelector('.tr-med-zero'));
  const z0=await pg.evaluate(()=>({zero:(document.querySelector('.tr-med-zero')||{}).textContent||'',sm:!!document.querySelector('.tr-med-sem-modelo')}));
  ok(z0.zero==='Ligado com 0 fotos: ligue de novo'&&!z0.sm,'0 fotos congeladas: Ligado com 0 fotos: '+J(z0));
  // sem modelo: só "Modelo não instalado... Depois de instalar, ligue de novo" (sem o aviso de 0 fotos)
  R.semMod=true;await pg.evaluate(()=>{Object.assign(ETERNA.state.agent.treino.modelo_ponto,{erro:'sem_modelo',aviso:'sem_modelo',congelados:0});ETERNA.render();});
  await espera(pg,()=>document.querySelector('.tr-med-sem-modelo'));
  const z=await pg.evaluate(()=>({zero:!!document.querySelector('.tr-med-zero'),sm:(document.querySelector('.tr-med-sem-modelo')||{}).textContent||''}));
  ok(!z.zero&&z.sm==='Modelo não instalado: nada é reconhecido. Depois de instalar, ligue de novo','sem modelo: só a pílula de instalar e ligar de novo: '+J(z));
  // 5 línguas de cada chave nova
  const sem=await pg.evaluate(()=>Object.keys(ETERNA.EQ).filter(k=>/^(tr_med_|tr_aba_medida|tr_an_criterio|tr_an_expo_sem|tr_m_duvidas|up_iam_cena_|up_iam_sem_gramado|tr_cfg_|tr_ia_|tr_ponto_nota|tr_qual_nota|tr_aviso_desl|tr_res_onde)/.test(k)).filter(k=>!Array.isArray(ETERNA.EQ[k])||ETERNA.EQ[k].length!==5||ETERNA.EQ[k].some(v=>v==null||v===''||(typeof v==='string'&&/—/.test(v)))));
  ok(!sem.length,'cada chave nova do EQ com 5 textos: '+J(sem));
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,500));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' treino-medida: aba Resultado (situação, critério, faltam por classe, matriz, pistas, erros), lupa, Abrir no Marcar, Ligado com confirmação e 409 em Configurações, ligar mesmo assim (permissão, confirmação, selo)'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
