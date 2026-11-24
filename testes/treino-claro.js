// 24/11 (plano docs/planos/2026-11-24-treino-mais-claro.md): Treino da IA mais claro. Na aba Marcar, as perguntas "1. Onde a foto
// foi tirada?", "2. Esta foto pode ir para o cliente?" e, só com Gramado, "3. Serve para recorte de IA?" (Sim/Não, teclas S e X,
// motivos do Não); a aba Medição vira Resultado e só mostra números; o liga e desliga da análise sai do Treino e vai para
// Configurações › Preços e Checkout › Fundos de IA (#tr-cfg), com duas posições (Ligado = ligada, Desligado = medir).
// Critérios 1 a 28 do plano, em 1280×900 e 390×844. Agente falso por page.route (como no treino-medida.js); fotos de 1 pixel.
// ETERNA_PRINT=<pasta> grava as capturas da aba Marcar com Gramado e do quadro de Configurações nos dois tamanhos.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];let VP='';const ok=(c,m)=>{if(!c)fails.push(VP+' '+m);return !!c;};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const DIA='2026-11-23';const PIDS=Array.from({length:8},(_,i)=>(0xace000000000+i+1).toString(16));
const ITENS=PIDS.map((p,i)=>({pid:p,card:'LPCL'+String(Math.floor(i/4)).padStart(4,'0'),fotografo:'carlos',t:Date.parse(DIA+'T13:00:00Z')/1000+i*20,ordem:i%4+1,n_sessao:4,rostos:2,rotulo:null}));
const MEDIDA={v:1,metodo:'sessao',versao:'v-teste-1',ligada_versao:null,classes:['gramado','arquibancada','trofeu','chute','outro'],rotulos:{gramado:42,arquibancada:26,trofeu:6,chute:4,outro:29},sem_vetor:0,
  metas:{gramado:150,arquibancada:40,trofeu:40,chute:60,outro:40},faltam:{gramado:108,arquibancada:14,trofeu:34,chute:56,outro:11},n:107,matriz:{},classe:{},gramado_base:{vp:36,fp:2,fn:6,precisao:0.9474,cobertura:0.8571,outro_como_gramado:0},
  sinais:{},erros:[],criterio:{passa:false,falta:[{k:'n',classe:'gramado',tem:42,precisa:150}]},em:'2026-11-24T10:00:00',ms:42,modelo_ok:true};
async function agente(ctx,R){
  Object.assign(R,{posts:[],cfg:[],rot:{},analise:{ponto:'medir',exposicao:'medir'},passa:true,abaixo:null,lv:null,cong:null,semRot:false,expoCrit:false,dlgs:[],dlgOk:false});
  const js=(r,b,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(b)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bC',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gC',hoje:0,abertas:0},
    treino:{v:1,rotulos:12,analise:Object.assign({},R.analise),ajuste:null,modelo_ponto:{v:1,pronto:true,erro:null,congelados:R.cong,provedor:'cpu',modelo:'clip-b32',versao:MEDIDA.versao,ligada_versao:R.lv,abaixo:R.abaixo,aviso:null,fila:0,feitas_hoje:10,ms_medio:14,criterio_passa:R.passa}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'gC',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]}));
  await ctx.route(ORIG+'/fila-fotografo',r=>js(r,{ok:true,grupos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs?*',r=>js(r,{ok:true,docs:[]}));
  await ctx.route(ORIG+'/ponto/docs',r=>js(r,{ok:true,gravados:0,recusados:0}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  await ctx.route(ORIG+'/fotografos/**',r=>js(r,{ok:false,error:'sem'},404));
  await ctx.route(ORIG+'/treino/dias',r=>js(r,{v:1,dias:[{dia:DIA,fotos:8,sessoes:2,rotuladas:0}]}));
  await ctx.route(ORIG+'/treino/medida?*',r=>js(r,Object.assign({},MEDIDA,{ligada_versao:R.lv,ligada_abaixo:R.abaixo})));
  await ctx.route(ORIG+'/treino/amostra?*',r=>{const q=new URL(r.request().url()).searchParams;js(r,{v:1,dia:q.get('dia'),modo:q.get('modo'),semente:'abc',total_dia:8,itens:ITENS.map(x=>R.rot[x.pid]?Object.assign({},x,{rotulo:R.rot[x.pid]}):x)});});
  await ctx.route(ORIG+'/treino/rotulo',r=>{const b=r.request().postDataJSON();R.posts.push(b);
    const doc=Object.assign({v:1,dia:DIA,fotografo:'carlos',por:'quem',em:'2026-11-24T11:00:00.'+String(R.posts.length).padStart(3,'0'),origem:'mao',lote:null},b,{base_em:undefined});R.rot[b.pid]=doc;js(r,{ok:true,doc});});
  await ctx.route(ORIG+'/treino/config',r=>{const b=r.request().postDataJSON();R.cfg.push(b);
    if(b.forcar){if(R.semRot)return js(r,{ok:false,error:'rotulos',falta:[{k:'rot_outra_lidas',tem:0,precisa:1}]},409);
      R.analise.ponto='ligada';R.lv='v-teste-forcada';R.abaixo={por:R.email,em:'2026-11-24T13:30:00Z'};R.cong=120;
      return js(r,{ok:true,analise:Object.assign({},R.analise),por:R.email,em:R.abaixo.em,abaixo:R.abaixo,ponto_versao:R.lv,congelados:R.cong});}
    if(b.ponto==='ligada'&&!R.passa)return js(r,{ok:false,error:'criterio',falta:MEDIDA.criterio.falta},409);
    if(b.exposicao==='ligada'&&R.expoCrit)return js(r,{ok:false,error:'criterio',falta:[{k:'escuras',tem:3,precisa:30},{k:'precisao_escura',tem:0.6,precisa:0.9}]},409);
    if(b.ponto==='ligada'){R.lv='v-teste-1';R.abaixo=null;R.cong=150;}if(b.ponto==='medir'){R.lv=null;R.abaixo=null;R.cong=null;}
    Object.assign(R.analise,b);js(r,{ok:true,analise:Object.assign({},R.analise),por:'quem',em:'x',ponto_versao:b.ponto==='ligada'?R.lv:null,congelados:R.cong});});
}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
const PROIBIDO=/Medição|Measurement|Medición|\bMesure\b|\bMessung\b|Só medir|Measure only|Reconhecer o ponto|Medir a exposição|\btr_[a-z]|undefined|NaN/;
(async()=>{const b=await chromium.launch();
const nova=async(vp)=>{const ctx=await b.newContext({viewport:vp,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(VP+' '+e.message));pg.on('dialog',d=>{R.dlgs.push(d.message());R.dlgOk?d.accept():d.dismiss();});return {ctx,pg,R};};
const entrar=async(pg,email)=>{await pg.goto(U);await pg.waitForTimeout(300);if(!email)email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.treino,8000);return email;};
const blur=pg=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
const tecla=async(pg,...ks)=>{for(const k of ks){await blur(pg);await pg.keyboard.press(k);await pg.waitForTimeout(60);}};
const toast=pg=>pg.evaluate(()=>(document.getElementById('toast')||{}).textContent||'');
const semToast=pg=>pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.textContent='';});
const rasc=(pg,i)=>pg.evaluate(p=>{const r=ETERNA.state.train.rasc[p];return r?{ponto:r.ponto,serve:r.serve,iaMot:(r.iaMot||[]).slice()}:null;},PIDS[i]);
const semRolar=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const audN=pg=>pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='treino_analise').length);
const irCfg=async pg=>{await pg.evaluate(()=>{ETERNA.state.catTab='fundos';ETERNA.go('catalogo');});await espera(pg,()=>!!document.querySelector('#tr-cfg'));};
const irTreino=async(pg,aba)=>{await pg.evaluate(a=>{ETERNA.state.train.aba=a||'marcar';ETERNA.go('treino');},aba);await espera(pg,()=>!!document.querySelector('[data-act="tr-aba"]'));};
// muda a situação do servidor (o /status falso e a cópia da tela) e redesenha
const situa=async(pg,R,an,extra)=>{Object.assign(R.analise,an);Object.assign(R,extra||{});
  await pg.evaluate(([an,mp])=>{const tr=ETERNA.state.agent.treino;tr.analise=Object.assign({},an);tr.modelo_ponto=Object.assign({},tr.modelo_ponto||{},mp);ETERNA.render();},[R.analise,{criterio_passa:R.passa,abaixo:R.abaixo,congelados:R.cong,ligada_versao:R.lv}]);};
const prs=(pg,k)=>pg.evaluate(k=>['on','off'].map(v=>{const x=document.querySelector(`#tr-cfg [data-act="tr-cfg"][data-k="${k}"][data-v="${v}"]`);return x?x.getAttribute('aria-pressed'):null;}),k);
async function rodada(vp,nome){VP='['+nome+']';const P390=vp.width<=400;
  // ================= Admin =================
  {const {ctx,pg,R}=await nova(vp);R.email=await entrar(pg);
    await irTreino(pg);await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===8&&!ETERNA.state.train.carregando);await pg.waitForTimeout(150);
    // 1: títulos e notas das perguntas 1 e 2
    const tx=await pg.textContent('#main');
    ok(/1\. Onde a foto foi tirada\?/.test(tx)&&/2\. Esta foto pode ir para o cliente\?/.test(tx)&&/Só as fotos do Gramado podem virar fundo de IA/.test(tx)&&/Vale para a foto como ela é: foco, luz, olhos, enquadramento/.test(tx),'1: títulos das perguntas 1 e 2 com a nota de cada uma');
    // 2: sem ponto e nos outros pontos não existe a pergunta 3; com Gramado (G) aparece
    let sem3=!(await pg.$('[data-act="tr-ia"]'));
    for(const k of ['a','t','c','o']){await tecla(pg,k);if(await pg.$('[data-act="tr-ia"]'))sem3=false;}
    ok(sem3,'2: sem ponto, Arquibancada, Troféu, Chute a Gol e Outro: sem a pergunta 3');
    await tecla(pg,'g');
    const q3=await pg.evaluate(()=>({h:(document.querySelector('.tr-ia-h')||{}).textContent||'',b:[...document.querySelectorAll('[data-act="tr-ia"]')].map(x=>x.dataset.v+':'+x.textContent.trim())}));
    ok(q3.h==='3. Serve para recorte de IA?'&&J(q3.b)===J(['sim:Sim (S)','nao:Não (X)']),'2: com Gramado aparecem a pergunta 3 e Sim e Não: '+J(q3));
    // 3: Não (X) mostra os 5 motivos; Sim (S) esconde e zera; motivo com Sim marcado passa para Não
    await tecla(pg,'x');
    const mot=await pg.$$eval('[data-act="tr-iam"]',x=>x.map(b=>b.dataset.m+':'+b.textContent));
    ok(J(mot)===J(['cortada:Pessoa cortada na borda','chao:Corpo inteiro com chão','luz:Luz ruim para recorte','gente_atras:Gente atrás','outro:Outro'])&&(await rasc(pg,0)).serve===false,'3: Não mostra os 5 motivos: '+J(mot));
    // 27: a 390 px a pergunta 3 aberta não faz a página rolar para o lado; Sim e Não com 56 px ou mais
    {const hs=await pg.$$eval('[data-act="tr-ia"]',x=>x.map(b=>Math.round(b.getBoundingClientRect().height)));ok(hs.length===2&&hs.every(h=>h>=56),'27: Sim e Não com pelo menos 56 px: '+J(hs));
      ok(await semRolar(pg),'27: aba Marcar com a pergunta 3 aberta sem rolar para o lado');}
    await pg.click('[data-act="tr-iam"][data-m="cortada"]');
    if(process.env.ETERNA_PRINT){await pg.click('[data-act="tr-iam"][data-m="gente_atras"]');await blur(pg);await pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.removeAttribute('data-on');window.scrollTo(0,0);});await pg.waitForTimeout(200);
      await pg.screenshot({path:path.join(process.env.ETERNA_PRINT,`treino-claro-marcar-gramado-${vp.width}.png`),fullPage:true});await pg.click('[data-act="tr-iam"][data-m="gente_atras"]');}
    await tecla(pg,'s');
    {const r=await rasc(pg,0);ok(r.serve===true&&!r.iaMot.length&&!(await pg.$('[data-act="tr-iam"]'))&&await pg.$eval('[data-act="tr-ia"][data-v="sim"]',x=>x.getAttribute('aria-pressed'))==='true','3: Sim (S) esconde os motivos e zera a lista: '+J(r));}
    await pg.evaluate(()=>{const b=document.createElement('button');b.dataset.act='tr-iam';b.dataset.m='luz';b.id='tx-iam';document.querySelector('#main').appendChild(b);b.click();});
    {const r=await rasc(pg,0);ok(r.serve===false&&J(r.iaMot)===J(['luz']),'3: tocar num motivo com Sim marcado passa para Não: '+J(r));}
    await pg.evaluate(()=>{const b=document.createElement('button');b.dataset.act='tr-iam';b.dataset.m='nao_existe';b.id='tx-iam2';document.querySelector('#main').appendChild(b);b.click();});
    ok(J((await rasc(pg,0)).iaMot)===J(['luz']),'motivo fora da lista fixa é ignorado');
    // 4: Gramado + Não + Pessoa cortada na borda + Gente atrás + Enter
    await pg.click('[data-act="tr-iam"][data-m="luz"]');await pg.click('[data-act="tr-iam"][data-m="cortada"]');await pg.click('[data-act="tr-iam"][data-m="gente_atras"]');
    await tecla(pg,'Enter');await espera(pg,()=>ETERNA.trFila().length===0,5000);
    {const p=R.posts[0]||{};const ia=p.ia||{};ok(R.posts.length===1&&p.pid===PIDS[0]&&p.ponto==='gramado'&&ia.serve===false&&J((ia.motivos||[]).slice().sort())===J(['cortada','gente_atras'])&&ia.frente===null,'4: Enter manda ia = {serve:false, motivos:[cortada, gente_atras], frente:null}: '+J(p));}
    // 5: Gramado + Sim, troca para Arquibancada: ia nulo; voltar para Gramado mostra Sim de novo
    ok(await pg.evaluate(()=>ETERNA.state.train.j)===1,'Enter foi para a foto 2');
    await tecla(pg,'g','s','a');ok(!(await pg.$('[data-act="tr-ia"]')),'5: Arquibancada esconde a pergunta 3');
    await tecla(pg,'g');ok(await pg.$eval('[data-act="tr-ia"][data-v="sim"]',x=>x.getAttribute('aria-pressed'))==='true','5: voltar para Gramado mostra Sim marcado de novo');
    await tecla(pg,'a','Enter');await espera(pg,()=>ETERNA.trFila().length===0,5000);
    {const p=R.posts[1]||{};ok(R.posts.length===2&&p.pid===PIDS[1]&&p.ponto==='arquibancada'&&J(p.ia)===J({serve:null,motivos:[],frente:null}),'5: fora do Gramado o ia vai nulo: '+J(p));}
    // 8: S e X fora do Gramado não fazem nada
    await tecla(pg,'a','s','x');{const r=await rasc(pg,2);ok(r&&r.ponto==='arquibancada'&&r.serve===null&&!(await pg.$('[data-act="tr-ia"]')),'8: S e X fora do Gramado não fazem nada: '+J(r));}
    await tecla(pg,'a'); // tira a escolha: a foto 3 sai sem gravar
    // 6: foto já gravada: abrir sem mudar nada não grava; mudar só a resposta 3 e ir para a próxima grava
    await pg.evaluate(p=>{delete ETERNA.state.train.rasc[p];},PIDS[0]);
    await pg.click('[data-act="tr-go"][data-i="0"]');await pg.waitForTimeout(150);
    {const r=await rasc(pg,0);ok(r&&r.serve===false&&J(r.iaMot.slice().sort())===J(['cortada','gente_atras'])&&await pg.$eval('[data-act="tr-ia"][data-v="nao"]',x=>x.getAttribute('aria-pressed'))==='true','6: a foto gravada abre com a resposta 3 do servidor: '+J(r));}
    await tecla(pg,'ArrowRight');await tecla(pg,'ArrowLeft');await pg.waitForTimeout(300);
    ok(R.posts.length===2,'6: abrir a foto gravada sem mudar nada não grava: '+R.posts.length);
    await tecla(pg,'s','ArrowRight');await espera(pg,()=>ETERNA.trFila().length===0,5000);await pg.waitForTimeout(150);
    {const p=R.posts[2]||{};ok(R.posts.length===3&&p.pid===PIDS[0]&&p.ponto==='gramado'&&J(p.ia)===J({serve:true,motivos:[],frente:null}),'6: mudar só a resposta 3 e ir para a próxima grava: '+J(p));}
    // 7: Z desfaz e o POST leva o ia anterior
    await tecla(pg,'z');await espera(pg,()=>ETERNA.trFila().length===0,5000);await pg.waitForTimeout(150);
    {const p=R.posts[3]||{};const ia=p.ia||{};ok(R.posts.length===4&&p.pid===PIDS[0]&&ia.serve===false&&J((ia.motivos||[]).slice().sort())===J(['cortada','gente_atras']),'7: Z regrava o ia anterior: '+J(p));}
    // Eduardo, 24/11 10:44: Enter numa foto sem nenhuma escolha só passa para a próxima (como Próxima); nada é gravado nem vai para a fila
    {await pg.click('[data-act="tr-go"][data-i="4"]');const p0=R.posts.length;await tecla(pg,'Enter');await pg.waitForTimeout(300);
      const t=await pg.evaluate(()=>({j:ETERNA.state.train.j,fila:ETERNA.trFila().length}));
      ok(t.j===5&&t.fila===0&&R.posts.length===p0,'Enter sem escolha só passa para a próxima, sem gravar: '+J(t));
      await tecla(pg,'Enter');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>ETERNA.state.train.j)===6&&R.posts.length===p0,'Enter sem escolha de novo: mais uma foto, nada gravado');
      ok(/sem nenhuma escolha, só passa/.test(await pg.textContent('#main')),'o texto das teclas diz que Enter sem escolha só passa');}
    // 11 e 21: o Treino não tem mais o interruptor; o aviso aparece nas 3 abas com o ponto fora de Ligado
    for(const a of ['marcar','medida','outubro']){await pg.click(`[data-act="tr-aba"][data-a="${a}"]`);await pg.waitForTimeout(200);
      const t=await pg.evaluate(()=>({an:!!document.querySelector('#main .tr-an'),x:!!document.querySelector('[data-act="tr-analise"],[data-act="tr-forcar"],[data-act="tr-cfg"]'),av:(document.querySelector('.tr-aviso-desl')||{}).textContent||'',abrir:!!document.querySelector('.tr-aviso-desl [data-act="tr-cfg-abrir"]')}));
      ok(!t.an&&!t.x,'11: '+a+': sem .tr-an, tr-analise, tr-forcar e tr-cfg');
      ok(/Fundos de IA automáticos desligados: o Checkout está sem fundos de IA\./.test(t.av)&&t.abrir,'21: '+a+': aviso dos Fundos de IA desligados com Abrir em Configurações');
      if(P390)ok(await semRolar(pg),'27: aba '+a+' com o aviso sem rolar para o lado');}
    // 10 (pt) e 12: Resultado com a pílula e a nota de onde ligar
    await pg.click('[data-act="tr-aba"][data-a="medida"]');await espera(pg,()=>!!document.querySelector('.tr-med-tiles'));
    {const t=await pg.evaluate(()=>({aba:document.querySelector('[data-act="tr-aba"][data-a="medida"]').textContent,pil:(document.querySelector('.tr-med .head .pill')||{}).textContent,
      nota:(document.querySelector('.tr-res-onde .note')||{}).textContent,abrir:!!document.querySelector('.tr-res-onde [data-act="tr-cfg-abrir"]')}));
      ok(t.aba==='Resultado'&&t.pil==='Desligado'&&t.nota==='Aqui você só confere. Ligar e desligar fica em Configurações › Preços e Checkout › Fundos de IA.'&&t.abrir,'12: Resultado com a pílula Desligado, a nota e Abrir em Configurações: '+J(t));}
    await pg.click('.tr-res-onde [data-act="tr-cfg-abrir"]');await espera(pg,()=>!!document.querySelector('#tr-cfg'));await pg.waitForTimeout(200);
    {const t=await pg.evaluate(()=>{const r=document.getElementById('tr-cfg').getBoundingClientRect();return {v:ETERNA.state.view,tab:ETERNA.state.catTab,vis:r.top<innerHeight&&r.bottom>0};});
      ok(t.v==='catalogo'&&t.tab==='fundos'&&t.vis,'12: Abrir em Configurações abre Preços e Checkout › Fundos de IA com o #tr-cfg visível: '+J(t));}
    // 13: as duas linhas, cada uma com Ligado e Desligado, acima do #ia-cfg
    {const t=await pg.evaluate(()=>{const c=document.getElementById('tr-cfg'),ia=document.getElementById('ia-cfg');return {nomes:[...c.querySelectorAll('.tr-an-k')].map(x=>x.textContent),
      bt:[...c.querySelectorAll('[data-act="tr-cfg"]')].map(x=>x.dataset.k+':'+x.dataset.v+':'+x.textContent),antes:!!ia&&!!(c.compareDocumentPosition(ia)&Node.DOCUMENT_POSITION_FOLLOWING),h:(c.querySelector('h2')||{}).textContent};});
      ok(J(t.nomes)===J(['Fundos de IA automáticos','Alerta de foto escura ou estourada'])&&J(t.bt)===J(['ponto:on:Ligado','ponto:off:Desligado','exposicao:on:Ligado','exposicao:off:Desligado'])&&t.antes&&t.h==='Análise automática das fotos','13: quadro com as duas linhas acima do #ia-cfg: '+J(t));}
    // 14: ligações entre botão e servidor
    ok(J(await prs(pg,'ponto'))===J(['false','true']),'14: medir = só Desligado marcado');
    ok(/Desligado: o Checkout está sem fundos de IA\./.test(await pg.textContent('#tr-cfg .tr-cfg-ponto-off').catch(()=>'')),'21: pílula vermelha com o ponto Desligado');
    await situa(pg,R,{ponto:'ligada'});ok(J(await prs(pg,'ponto'))===J(['true','false'])&&!(await pg.$('#tr-cfg .tr-cfg-ponto-off')),'14 e 21: ligada = só Ligado marcado, sem a pílula');
    await situa(pg,R,{ponto:'desligada'});
    {const t=await pg.evaluate(()=>{const b=document.querySelector('#tr-cfg .tr-an-b[data-k="ponto"]');return b.textContent;});
      ok(J(await prs(pg,'ponto'))===J(['false','false'])&&/Parado no servidor/.test(t)&&/O servidor não está analisando, então o Resultado fica sem números\. Escolha Ligado ou Desligado\./.test(t),'14: desligada = nenhum marcado, Parado no servidor e a nota');}
    await situa(pg,R,{ponto:'medir'});
    // 15: exposição em medir; Ligado com o servidor aceitando; Desligado sem confirmação
    {const a0=await audN(pg);const c0=R.cfg.length;R.dlgs.length=0;await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="on"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.exposicao==='ligada');await pg.waitForTimeout(150);
      const au=await pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='treino_analise')[0]);
      ok(J(R.cfg.slice(c0))===J([{exposicao:'ligada'}])&&await audN(pg)===a0+1&&au&&au.mudancas[0].campo==='analise.exposicao'&&au.mudancas[0].de==='medir'&&au.mudancas[0].para==='ligada'&&!R.dlgs.length,'15: Ligado manda {exposicao:"ligada"} com auditLog de medir para ligada: '+J({cfg:R.cfg.slice(c0),au}));
      await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="off"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.exposicao==='medir');
      ok(J(R.cfg.slice(c0))===J([{exposicao:'ligada'},{exposicao:'medir'}])&&!R.dlgs.length,'15: Desligado manda {exposicao:"medir"} sem confirmação: '+J(R.cfg.slice(c0)));}
    // 16: exposição com 409 criterio: aviso, lista no quadro, fica em Configurações, sem auditLog
    {R.expoCrit=true;const a0=await audN(pg);await semToast(pg);await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="on"]');await espera(pg,()=>!!document.querySelector('#tr-cfg .tr-cfg-falta'));
      const t=await pg.evaluate(()=>({li:[...document.querySelectorAll('#tr-cfg .tr-cfg-falta li')].map(x=>x.textContent),v:ETERNA.state.view,ex:ETERNA.state.agent.treino.analise.exposicao}));
      ok(/^O alerta só liga quando o servidor acerta o bastante\./.test(await toast(pg))&&t.li.length===2&&/Escura: 3 de 30/.test(t.li[0])&&t.v==='catalogo'&&t.ex==='medir'&&await audN(pg)===a0,'16: 409 da exposição: aviso, o que falta no quadro, sem trocar de tela e sem auditLog: '+J(t)+' '+await toast(pg));
      R.expoCrit=false;}
    // 17: ponto em medir com o critério passando: Ligado sem confirmação
    {R.dlgs.length=0;const c0=R.cfg.length;await situa(pg,R,{ponto:'medir'},{passa:true});await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.ponto==='ligada');
      ok(J(R.cfg.slice(c0))===J([{ponto:'ligada'}])&&!R.dlgs.length,'17: Ligado com o critério passando manda {ponto:"ligada"} sem confirmação: '+J(R.cfg.slice(c0)));}
    // 21: ligado, sem o aviso no Treino; 22: caixa dos primeiros cliques desmarcada
    ok(!(await pg.$('#tr-cfg .tr-cfg-ponto-off'))&&!(await pg.$('#tr-cfg .tr-cfg-ia-caixa')),'21 e 22: ligado sem a pílula e, com a caixa marcada, sem o aviso da caixa');
    await pg.evaluate(()=>{ETERNA.state.iaCfgAntes=ETERNA.state.iaCfg;ETERNA.state.iaCfg=Object.assign({},ETERNA.iaCfg(),{ligada:false});ETERNA.render();});
    ok(/também precisam da caixa Separar os primeiros cliques de cada sessão/.test(await pg.textContent('#tr-cfg .tr-cfg-ia-caixa').catch(()=>'')),'22: ponto Ligado e caixa desmarcada: tr_cfg_ia_caixa');
    await pg.evaluate(()=>{ETERNA.state.iaCfg=ETERNA.state.iaCfgAntes;delete ETERNA.state.iaCfgAntes;ETERNA.render();});
    await irTreino(pg,'marcar');ok(!(await pg.$('.tr-aviso-desl')),'21: com o ponto Ligado o Treino não tem o aviso');await irCfg(pg);
    // 20: ponto ligado, Desligado pede confirmação
    {R.dlgs.length=0;R.dlgOk=false;const c0=R.cfg.length;await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="off"]');await pg.waitForTimeout(300);
      ok(R.dlgs[0]==='Desligar os Fundos de IA automáticos? Os próximos visitantes ficam sem fundos de IA no Checkout. Para ligar de novo, o servidor usa as marcações daquele momento.'&&R.cfg.length===c0,'20: Desligado abre a confirmação e Cancelar não manda nada: '+J(R.dlgs));
      R.dlgOk=true;await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="off"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.ponto==='medir');R.dlgOk=false;
      ok(J(R.cfg.slice(c0))===J([{ponto:'medir'}]),'20: OK manda {ponto:"medir"}: '+J(R.cfg.slice(c0)));}
    // 18 e 19: ponto em medir com o critério não passando: confirmação de hoje; 409 rotulos; depois liga abaixo da meta
    {await situa(pg,R,{ponto:'medir'},{passa:false});R.dlgs.length=0;const c0=R.cfg.length;
      ok(/O acerto ainda não chegou à meta/.test(await pg.textContent('#tr-cfg')),'18: nota de que o acerto não chegou à meta');
      await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await pg.waitForTimeout(300);
      ok(R.dlgs[0]==='O acerto ainda está abaixo da meta. Algumas fotos fora do gramado podem virar fundo de IA. Ligar mesmo assim?'&&R.cfg.length===c0,'18: Ligado abre a confirmação de hoje e Cancelar não manda nada: '+J(R.dlgs));
      R.semRot=true;R.dlgOk=true;await semToast(pg);await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await espera(pg,()=>!!document.querySelector('#tr-cfg .tr-med-forcar-aviso'));
      const t=await pg.evaluate(()=>{const a=document.querySelector('#tr-cfg .tr-med-forcar-aviso');return {txt:a.textContent,html:a.innerHTML,li:a.querySelectorAll('li').length};});
      ok(await toast(pg)==='Não ligou. O que falta está logo abaixo.'&&t.li===1&&/outro ponto marcadas e já lidas pelo reconhecimento: 0 \(precisa 1\)/.test(t.txt)&&!/&amp;|&lt;/.test(t.html),'19: 409 rotulos: aviso e a lista em texto puro em #tr-cfg: '+J(t));
      R.semRot=false;await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]');await espera(pg,()=>!!document.querySelector('#tr-cfg .tr-med-abaixo'));R.dlgOk=false;
      const lg=await pg.evaluate(()=>({selo:document.querySelector('#tr-cfg .tr-med-abaixo').textContent,rel:(document.querySelector('#tr-cfg [data-act="tr-forcar"]')||{}).textContent||'',nome:ETERNA.state.user.name,av:!!document.querySelector('#tr-cfg .tr-med-forcar-aviso')}));
      ok(J(R.cfg.slice(c0))===J([{ponto:'ligada',forcar:true},{ponto:'ligada',forcar:true}])&&lg.selo.startsWith('Ligado abaixo da meta por '+lg.nome+' em ')&&/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(lg.selo)&&lg.rel==='Ligar de novo com as marcações de agora'&&!lg.av,'18: OK manda forcar, depois o selo e o religar em #tr-cfg: '+J({cfg:R.cfg.slice(c0),lg}));}
    // 27: o quadro a 390 px não faz a página rolar para o lado
    ok(await semRolar(pg),'27: Configurações › Fundos de IA sem rolar para o lado');
    if(process.env.ETERNA_PRINT){await pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.removeAttribute('data-on');window.scrollTo(0,0);});await pg.waitForTimeout(200);
      await pg.screenshot({path:path.join(process.env.ETERNA_PRINT,`treino-claro-fundos-ia-${vp.width}.png`),fullPage:true});}
    // 26: sem servidor
    {const t=await pg.evaluate(()=>{const a=ETERNA.state.agent;const on=a.on;a.on=false;ETERNA.render();const c=document.getElementById('tr-cfg');const r={txt:c?c.textContent:'',bt:c?c.querySelectorAll('button').length:-1};a.on=on;ETERNA.render();return r;});
      ok(/A marcação usa as fotos do servidor do ponto/.test(t.txt)&&t.bt===0,'26: sem servidor, o quadro mostra tr_sem_servidor e nenhum botão: '+J(t));}
    // 10: 5 línguas no Treino (Marcar com Gramado e Resultado) e em Configurações › Fundos de IA
    {const ruim=[];const RES={pt:'Resultado',en:'Results',es:'Resultado',fr:'Résultat',de:'Ergebnis'};await situa(pg,R,{ponto:'medir',exposicao:'medir'},{abaixo:null,cong:null,lv:null,passa:false});
      for(const l of ['pt','en','es','fr','de']){await pg.evaluate(l=>{ETERNA.state.user.idioma=l;},l);
        for(const [v,a] of [['treino','marcar'],['treino','medida'],['catalogo','fundos']]){
          await pg.evaluate(([v,a,p])=>{if(v==='treino'){ETERNA.state.train.aba=a;ETERNA.state.train.j=0;ETERNA.state.train.rasc[p]={ponto:'gramado',nivel:'fraca',motivos:['olhos'],duvida:false,obs:'',base:null,serve:false,iaMot:['chao']};}else ETERNA.state.catTab=a;ETERNA.state.view=v;ETERNA.render();},[v,a,PIDS[0]]);await pg.waitForTimeout(150);
          const tx=await pg.textContent('#main');const m=tx.match(new RegExp(PROIBIDO.source,'g'));if(m)ruim.push(l+'/'+v+'/'+a+': '+[...new Set(m)].join(','));
          if(v==='treino'&&a==='medida'){const ab=await pg.textContent('[data-act="tr-aba"][data-a="medida"]');const eq=l!=='de';/* IDIOMAS_EQ: pt, en, es, fr */if(ab!==(eq?RES[l]:RES.pt))ruim.push(l+': aba '+ab);}}}
      // o alemão não é língua da equipe (a tela cai no português): os textos em alemão são conferidos direto no EQ
      const eqRuim=await pg.evaluate(src=>{const re=new RegExp(src);const E=ETERNA.EQ;return Object.keys(E).filter(k=>/^(tr_|cf_ia_sem_escala|vd_treino|pm_a_treino)/.test(k)&&!['tr_medindo','tr_medir'].includes(k))
        .filter(k=>(Array.isArray(E[k])?E[k]:[]).some(v=>re.test(typeof v==='function'?v('a','b','c','d'):String(v))));},PROIBIDO.source.replace('|\\btr_[a-z]|undefined|NaN',''));
      if(eqRuim.length)ruim.push('EQ: '+eqRuim.join(','));
      ok(await pg.evaluate(()=>ETERNA.TE('tr_aba_medida'))&&J(await pg.evaluate(()=>ETERNA.EQ.tr_aba_medida))===J(Object.values(RES)),'10: tr_aba_medida = Resultado, Results, Resultado, Résultat, Ergebnis');
      await pg.evaluate(()=>{ETERNA.state.user.idioma='pt';});
      ok(!ruim.length,'10: nas 5 línguas, sem Medição, Só medir, nomes antigos nem chave crua: '+ruim.join(' | '));}
    // 25 e 9: "ver como" da Supervisora: só pílulas; trCfgMuda não manda nada; a pergunta 3 trava como as outras e nada é gravado
    {await pg.route('**/auth/assumir',r=>{const c=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:c.usuario,cadastro:null,assumido_por:R.email,assumido_nome:'Admin de teste'})});});
      await pg.route('**/auth/voltar',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:R.email,cadastro:null})}));
      await pg.evaluate(()=>ETERNA.go('usuarios'));await pg.click('[data-act="user-sel"][data-e="supervisor@eterna.photo"]');await pg.click('[data-act="user-assumir"]');
      ok(await espera(pg,()=>!!ETERNA.state.assumido&&ETERNA.state.user.email==='supervisor@eterna.photo'),'"ver como": entrou como a Supervisora');
      await irCfg(pg);const c0=R.cfg.length,p0=R.posts.length;
      const t=await pg.evaluate(()=>{const c=document.getElementById('tr-cfg');return {bt:c?c.querySelectorAll('button').length:-1,pil:c?[...c.querySelectorAll('.pill')].map(x=>x.textContent):[]};});
      await semToast(pg);await pg.evaluate(()=>ETERNA.trCfgMuda('ponto',true));await pg.waitForTimeout(300);
      ok(t.bt===0&&t.pil.includes('Desligado')&&R.cfg.length===c0&&/Só visualização/.test(await toast(pg)),'25: "ver como": #tr-cfg só com pílulas; trCfgMuda não manda nada e avisa: '+J(t)+' '+await toast(pg));
      await irTreino(pg,'marcar');await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===8&&!ETERNA.state.train.carregando);
      await pg.click('[data-act="tr-go"][data-i="5"]');await semToast(pg);await tecla(pg,'Enter');await pg.waitForTimeout(200);
      ok(await pg.evaluate(()=>ETERNA.state.train.j)===6&&R.posts.length===p0&&!(await pg.evaluate(()=>ETERNA.trFila())).length&&!/Só visualização/.test(await toast(pg)),'"ver como": Enter sem escolha só navega, sem gravar');
      await pg.click('[data-act="tr-go"][data-i="5"]');await tecla(pg,'g');
      const tr=await pg.evaluate(()=>({p:document.querySelector('[data-act="tr-ponto"]').disabled,ia:[...document.querySelectorAll('[data-act="tr-ia"]')].map(x=>x.disabled)}));
      ok(tr.ia.length===2&&tr.ia.every(x=>x===tr.p),'9: "ver como": Sim e Não travados como os outros botões: '+J(tr));
      await tecla(pg,'x');if(await pg.$('[data-act="tr-iam"][data-m="chao"]:not([disabled])'))await pg.click('[data-act="tr-iam"][data-m="chao"]');await tecla(pg,'Enter','ArrowRight');await pg.waitForTimeout(400);
      ok(R.posts.length===p0&&!(await pg.evaluate(()=>ETERNA.trFila())).length,'9: "ver como": nada é gravado nem posto na fila: '+J(R.posts.slice(p0)));
      await pg.evaluate(()=>{const b=document.querySelector('[data-act="assumir-voltar"]');if(b)b.click();});await espera(pg,()=>!ETERNA.state.assumido);}
    await ctx.close();}
  // ================= Supervisora: usa os 4 botões; com configuracao.r sem u, só pílulas =================
  {const {ctx,pg,R}=await nova(vp);await entrar(pg,'supervisor@eterna.photo');await irCfg(pg);
    ok((await pg.$$('#tr-cfg [data-act="tr-cfg"]')).length===4,'23: Supervisora vê os 4 botões');
    await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="on"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.exposicao==='ligada');
    ok(J(R.cfg)===J([{exposicao:'ligada'}]),'23: Supervisora usa o botão: '+J(R.cfg));
    const t=await pg.evaluate(()=>{const u=ETERNA.state.user;u.perms.configuracao={c:false,r:true,u:false,d:false};ETERNA.render();const c=document.getElementById('tr-cfg');
      const r={tem:!!c,bt:c?c.querySelectorAll('button').length:-1,pil:c?[...c.querySelectorAll('.pill')].map(x=>x.textContent):[]};
      const b=document.createElement('button');b.dataset.act='tr-cfg';b.dataset.k='ponto';b.dataset.v='on';document.querySelector('#main').appendChild(b);b.click();return r;});
    await pg.waitForTimeout(300);
    ok(t.tem&&t.bt===0&&t.pil.includes('Ligado')&&t.pil.includes('Desligado')&&R.cfg.length===1,'23: configuracao.r sem u: só as pílulas, e o tr-cfg injetado não gera POST: '+J(t)+' '+J(R.cfg));
    await ctx.close();}
  // ================= Validador: sem #tr-cfg; no Treino o aviso sem o botão =================
  {const {ctx,pg,R}=await nova(vp);await entrar(pg,'qualidade@eterna.photo');await irTreino(pg,'marcar');
    const t=await pg.evaluate(()=>({av:(document.querySelector('.tr-aviso-desl')||{}).textContent||'',abrir:!!document.querySelector('[data-act="tr-cfg-abrir"]'),cfg:!!document.querySelector('#tr-cfg')}));
    ok(/Fundos de IA automáticos desligados/.test(t.av)&&!t.abrir&&!t.cfg,'24: Validador vê o aviso sem Abrir em Configurações: '+J(t));
    await pg.evaluate(()=>{ETERNA.state.catTab='fundos';ETERNA.go('catalogo');});await pg.waitForTimeout(300);ok(!(await pg.$('#tr-cfg')),'24: Validador não vê o #tr-cfg');
    await ctx.close();}
}
try{
  await rodada({width:1280,height:900},'1280');
  await rodada({width:390,height:844},'390');
  VP='';
  // 28: chaves novas e mudadas com 5 textos, sem vazio e sem travessão
  {const ctx=await b.newContext();const pg=await ctx.newPage();await pg.goto(U);await pg.waitForTimeout(300);
    const r=await pg.evaluate(()=>{const E=ETERNA.EQ;const ks=['tr_ponto_h','tr_qual_h','tr_aba_medida','tr_pode_nao','vd_treino','tr_med_h','tr_med_criterio_ok','tr_med_criterio_falta','tr_med_forcar_nao','tr_med_forcar_nota','tr_med_abaixo_nota','tr_an_criterio','tr_an_expo_sem','tr_an_h','tr_an_nota','tr_an_ponto','tr_an_exposicao','tr_analise_ok','tr_analise_erro','pm_a_treino_analise','cf_ia_sem_escala','tr_teclas',
      'tr_ponto_nota','tr_qual_nota','tr_ia_h','tr_ia_nota','tr_ia_sim','tr_ia_nao','tr_ia_porque','tr_ia_m_cortada','tr_ia_m_chao','tr_ia_m_luz','tr_ia_m_gente_atras','tr_ia_m_outro','tr_cfg_on','tr_cfg_off','tr_cfg_parado','tr_cfg_parado_nota','tr_cfg_ponto_nota','tr_cfg_expo_nota','tr_cfg_ponto_off','tr_cfg_abaixo_nota','tr_cfg_desl_conf','tr_cfg_ia_caixa','tr_cfg_abrir','tr_aviso_desl','tr_res_onde'];
      const ruins=ks.filter(k=>!Array.isArray(E[k])||E[k].length!==5||E[k].some(v=>{const t=typeof v==='function'?v('a','b','c'):v;return !t||/—/.test(t);}));
      const saiu=['tr_an_o_que','tr_an_medir','tr_an_desligada','tr_an_ligada','tr_med_forcar'].filter(k=>E[k]);
      return {n:ks.length,ruins,saiu,motivos:ETERNA.TR_IA_MOTIVOS.every(m=>/^[a-z][a-z0-9_]{0,23}$/.test(m))&&ETERNA.TR_IA_MOTIVOS.length<=8};});
    ok(!r.ruins.length&&!r.saiu.length&&r.motivos,'28: chaves com 5 textos, sem vazio e sem travessão; as antigas saíram; motivos na regra do agente: '+J(r));
    await ctx.close();}
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push(VP+' exceção: '+(e&&e.stack||e).toString().slice(0,600));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' treino-claro: perguntas 1 a 3 do Marcar (S, X, motivos, troca de ponto, Z, ver como), aba Resultado, interruptor em Configurações › Fundos de IA (duas posições, confirmações, 409, permissões, sem servidor), 5 línguas, 390 e 1280 px'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
