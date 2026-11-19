// 18/11 (plano "bases dos fundos de IA só com foto do gramado", fatia B, critérios 22 a 24): Treino da IA › Medição. A aba abre
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
async function agente(ctx,R){R.cfg=[];R.medida=0;R.amostra=[];R.analise={ponto:'medir',exposicao:'desligada'};R.passa=false;R.abaixo=null;R.lv=null;R.semRot=false;
  const js=(r,b,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(b)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bM',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gM',hoje:0,abertas:0},
    treino:{v:1,rotulos:107,analise:R.analise,ajuste:null,modelo_ponto:{v:1,pronto:true,erro:null,provedor:'cuda',modelo:'clip-b32',versao:MEDIDA.versao,ligada_versao:R.lv,abaixo:R.abaixo,aviso:null,fila:0,feitas_hoje:812,ms_medio:14,criterio_passa:R.passa}}}));
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
  await ctx.route(ORIG+'/treino/config',r=>{const b=r.request().postDataJSON();R.cfg.push(b);
    if(b.forcar){if(R.semRot)return js(r,{ok:false,error:'rotulos',falta:[{k:'rot_outra_lidas',tem:0,precisa:1}]},409);
      R.analise.ponto='ligada';R.lv='c1-clip-b32-k7-l070-p080-forcada1';R.abaixo={por:R.email,em:'2026-11-18T22:30:00Z'};
      return js(r,{ok:true,analise:Object.assign({},R.analise),por:R.email,em:R.abaixo.em,abaixo:R.abaixo,ponto_versao:R.lv});}
    if(b.ponto==='ligada'&&!R.passa)return js(r,{ok:false,error:'criterio',falta:MEDIDA.criterio.falta},409);Object.assign(R.analise,b);js(r,{ok:true,analise:Object.assign({},R.analise),por:'quem',em:'x'});});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);R.email=email;await entrarTeste(pg,email);await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.treino);
  await pg.evaluate(()=>ETERNA.go('treino'));await pg.waitForTimeout(300);
  ok(J(await pg.$$eval('[data-act="tr-aba"]',x=>x.map(b=>b.dataset.a)))===J(['marcar','medida','outubro']),'abas com a Medição');
  // 24: Ligada travado abaixo do critério, com a explicação
  const lig=await pg.$eval('[data-act="tr-analise"][data-k="ponto"][data-v="ligada"]',x=>({dis:x.disabled,t:x.title}));
  ok(lig.dis&&/critério/.test(lig.t),'24: Ligada do ponto desativado com a explicação: '+J(lig));
  const ex=await pg.$eval('[data-act="tr-analise"][data-k="exposicao"][data-v="ligada"]',x=>x.disabled);ok(ex,'a exposição não liga (ainda sem medida)');
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
  // 24: 409 do servidor -> aviso e Medição
  await pg.evaluate(()=>{ETERNA.state.agent.treino.modelo_ponto.criterio_passa=true;ETERNA.render();});
  await pg.click('[data-act="tr-analise"][data-k="ponto"][data-v="ligada"]');await pg.waitForTimeout(500);
  const t409=await pg.evaluate(()=>({toast:document.getElementById('toast').textContent,aba:ETERNA.state.train.aba,ponto:ETERNA.state.agent.treino.analise.ponto}));
  ok(/critério/.test(t409.toast)&&t409.aba==='medida'&&t409.ponto==='medir','24: 409 criterio vira o aviso e abre a Medição: '+J(t409));
  // 18/11 (Eduardo, ligar já): "Ligar mesmo assim" só para quem tem configuracao.u, com confirmação; ligado assim, o selo
  // "Ligado abaixo da meta por <nome> em <data>" e o que falta continuam na Medição
  await pg.evaluate(()=>{const t=ETERNA.state.train;t.aba='medida';ETERNA.render();});await espera(pg,()=>document.querySelector('.tr-med-faltas'));
  ok(await pg.$('[data-act="tr-forcar"]'),'o botão Ligar mesmo assim aparece abaixo do critério para quem tem configuracao.u');
  const semPerm=await pg.evaluate(()=>{const u=ETERNA.state.user;const p0=u.perms.configuracao;u.perms.configuracao={c:false,r:true,u:false,d:false};ETERNA.render();
    const tem=!!document.querySelector('[data-act="tr-forcar"]');u.perms.configuracao=p0;ETERNA.render();return tem;});
  ok(!semPerm,'sem configuracao.u o botão não aparece');
  let dlg=null;pg.once('dialog',d=>{dlg=d.message();d.dismiss();});const n0=R.cfg.length;
  await pg.click('[data-act="tr-forcar"]');await pg.waitForTimeout(300);
  ok(dlg==='O acerto ainda está abaixo da meta. Algumas fotos fora do gramado podem virar fundo de IA. Ligar mesmo assim?'&&R.cfg.length===n0,'a confirmação diz o risco e Cancelar não liga: '+J(dlg));
  R.semRot=true;pg.once('dialog',d=>d.accept());await pg.click('[data-act="tr-forcar"]');await pg.waitForTimeout(500);
  const tRot=await pg.evaluate(()=>({toast:document.getElementById('toast').textContent,ponto:ETERNA.state.agent.treino.analise.ponto}));
  ok(/gramado e de pelo menos um outro ponto/.test(tRot.toast)&&/outro ponto marcadas e já lidas/.test(tRot.toast)&&tRot.ponto==='medir','409 rotulos vira o aviso do que falta: '+J(tRot));
  R.semRot=false;pg.once('dialog',d=>d.accept());await pg.click('[data-act="tr-forcar"]');
  await espera(pg,()=>document.querySelector('.tr-med-abaixo'));
  const lg=await pg.evaluate(()=>({selo:(document.querySelector('.tr-med-abaixo')||{}).textContent||'',ponto:ETERNA.state.agent.treino.analise.ponto,nome:ETERNA.state.user.name,
    faltas:document.querySelectorAll('.tr-med-faltas li').length,botao:(document.querySelector('[data-act="tr-forcar"]')||{}).textContent||null,toast:document.getElementById('toast').textContent}));
  ok(J(R.cfg[R.cfg.length-1])===J({ponto:'ligada',forcar:true}),'o POST leva forcar: '+J(R.cfg.slice(-1)));
  ok(lg.ponto==='ligada'&&lg.selo.startsWith('Ligado abaixo da meta por '+lg.nome+' em ')&&/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(lg.selo),'selo Ligado abaixo da meta por <nome> em <data>: '+J(lg));
  ok(lg.faltas===7,'continua mostrando quanto falta: '+lg.faltas);
  ok(lg.botao==='Ligar de novo com as marcações de agora','ligado, a versão medida diferente da ligada oferece religar: '+J(lg.botao));
  ok(/abaixo da meta/.test(lg.toast),'aviso de ligado abaixo da meta: '+J(lg.toast));
  if(process.env.ETERNA_PRINT){await pg.waitForTimeout(300);await pg.screenshot({path:require('path').join(process.env.ETERNA_PRINT,'treino-medicao-abaixo.png'),fullPage:true});}
  // 5 línguas de cada chave nova
  const sem=await pg.evaluate(()=>Object.keys(ETERNA.EQ).filter(k=>/^(tr_med_|tr_aba_medida|tr_an_criterio|tr_an_expo_sem|tr_m_duvidas|up_iam_cena_|up_iam_sem_gramado)/.test(k)).filter(k=>!Array.isArray(ETERNA.EQ[k])||ETERNA.EQ[k].length!==5||ETERNA.EQ[k].some(v=>v==null||v==='')));
  ok(!sem.length,'cada chave nova do EQ com 5 textos: '+J(sem));
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,500));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' treino-medida: aba Medição (situação, critério, faltam por classe, matriz, pistas, erros), lupa, Abrir no Marcar, Ligada travado e 409, Ligar mesmo assim (permissão, confirmação, selo)'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
