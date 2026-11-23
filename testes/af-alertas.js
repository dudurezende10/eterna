// 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md): alertas do fotógrafo na tela. Critérios 7 (o cartão exato "Márcio: 20
// de 100 fora da exposição: 12 estouradas, 8 escuras", grave em vermelho), 8 (o Fotógrafo e quem não tem desempenho.r não veem
// cartão af_* nem os alertas antigos por fotógrafo; a Supervisora vê), 9 (o ajuste da foto não muda a conta) e 19 (abas e cartões
// nas 5 línguas sem chave faltando). Também: período Hoje / 7 dias / 30 dias, limites com auditLog, Medição › Exposição.
// O agente é falso (page.route na própria origem); números inventados, nenhum dado de cliente.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const LIM={v:1,cliques_min:20,cliques_max:40,fam_min:5,conv_fam_pp:10,conv_fotos_pp:5,conv_fam_min:15,conv_equipe_min:3,luz_pct:15,luz_grave_pct:25,luz_fotos_min:50,
  luz:{v:1,rosto_p95_alto:250,rosto_alto_pct:8,rosto_med_baixo:50,quadro_alto_pct:12,quadro_med_alto:170,quadro_med_baixo:45,quadro_baixo_pct:30}};
function resposta(R,de,ate){const f=(k,fam,med,ab,ac,cf,ct,luz)=>({k,familias:fam,cliques:{media:med,abaixo:ab,acima:ac,chute_media:1.5,nao_contadas:3},conv:{fam:cf,fotos:ct},luz});
  return {ok:true,v:1,de,ate,limites:R.lim,exposicao:R.expo,fonte_cliques:'ponto',dias:7,
    equipe:{familias:60,fam_compraram:30,fotos:1800,fotos_vendidas:400,cliques_soma:1500,chute_soma:90},
    fotografos:[f('marcio',20,26.5,2,3,[10,20],[150,600],{n:100,escuras:8,estouradas:R.grave?17:12,sem_dado:0}),f('yago',14,16.2,9,0,[4,20],[90,600],{n:80,escuras:2,estouradas:2,sem_dado:0}),f('marinara',26,30,0,1,[16,20],[160,600],{n:90,escuras:1,estouradas:1,sem_dado:0})],
    alertas:[{tipo:'af_luz',k:'marcio',sev:R.grave?'bad':'warn',args:[R.grave?25:20,100,R.grave?17:12,8]},{tipo:'af_poucos',k:'yago',sev:'warn',args:[16.2,9,14,20]},
      {tipo:'af_conv_fam',k:'yago',sev:'warn',args:[20,50,4,20]},{tipo:'af_conv_fotos',k:'yago',sev:'warn',args:[15,22,90,600]},{tipo:'af_muitos',k:'marinara',sev:'warn',args:[45,5,12,40]}]};}
async function agente(ctx,R){const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});
  R.pedidos=[];R.posts=[];R.lim=JSON.parse(J(LIM));R.expo='ligada';R.grave=false;R.luzPassa=false;
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'baf',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},
    treino:{v:1,rotulos:0,analise:{ponto:'medir',exposicao:R.expo==='ligada'?'ligada':R.expo},modelo_ponto:null,ajuste:null},luz:{v:1,medidas_hoje:0,fila:0,ms_med:null,varredura:{pendentes:0},opencv:true}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/metricas/dia*',r=>js(r,{ok:true,dias:[]}));
  await ctx.route(ORIG+'/treino/medida*',r=>js(r,{v:1,erro:'sem_numpy'}));
  await ctx.route(ORIG+'/fotografos/alertas*',r=>{const q=new URL(r.request().url()).searchParams;R.pedidos.push([q.get('de'),q.get('ate')]);js(r,resposta(R,q.get('de'),q.get('ate')));});
  await ctx.route(ORIG+'/fotografos/luz/medida*',r=>js(r,{v:1,limites:R.lim.luz,classes:{escura:{n:31,precisao:R.luzPassa?0.9:0.6,revocacao:0.8},estourada:{n:30,precisao:0.92,revocacao:0.75}},boas_n:160,sem_medida:2,
    matriz:{},grade:{rosto_med_baixo:[30,40,50,60,70].map(v=>({valor:v,classe:'escura',precisao:0.8,revocacao:0.7,atual:v===R.lim.luz.rosto_med_baixo})),quadro_alto_pct:[7,10,12,14,17].map(v=>({valor:v,classe:'estourada',precisao:0.9,revocacao:0.7,atual:v===R.lim.luz.quadro_alto_pct}))},
    criterio:R.luzPassa?{passa:true,falta:[]}:{passa:false,falta:[{k:'precisao_escura',tem:0.6,precisa:0.85},{k:'boas',tem:120,precisa:150}]}}));
  await ctx.route(ORIG+'/fotografos/config',r=>{const b=JSON.parse(r.request().postData()||'{}');R.posts.push({h:r.request().headers(),b});
    if(b.cliques_min!=null&&b.cliques_min>=(b.cliques_max||R.lim.cliques_max))return js(r,{ok:false,error:'campo',campo:'cliques_min'},400);
    const antes=JSON.parse(J(R.lim));Object.entries(b).forEach(([k,v])=>{if(k==='luz')Object.assign(R.lim.luz,v);else R.lim[k]=v;});js(r,{ok:true,limites:R.lim,antes,mudou:Object.keys(b),por:'x',em:'2026-11-23T12:00:00Z'});});}
function usuario(pg,email,nome,preset,extra){return pg.evaluate(([e,n,p,x])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]=Object.assign({v:2,email:e,name:n,active:true,preset:p,perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p),key:null},x||{});localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,preset,extra]);}
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async()=>{const ctx=await b.newContext({viewport:{width:1366,height:950},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg,R};};
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg.evaluate(fn).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
const cartoes=pg=>pg.$$eval('#main .alert',x=>x.map(e=>({sev:[...e.classList].find(c=>c==='bad'||c==='warn'||c==='good'),t:e.querySelector('b').textContent,d:e.querySelector('p').textContent})));
try{
  // ---------- 7: Admin vê o cartão exato; período; rodapé com a fonte; os alertas antigos por fotógrafo somem ----------
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);
    await espera(pg,()=>ETERNA.state.agent.on);
    const antigos=await pg.evaluate(()=>ETERNA.alerts().map(a=>a.t));
    await pg.evaluate(()=>ETERNA.go('alertas'));ok(await espera(pg,()=>!!ETERNA.state.af.j),'7: os dados do servidor não chegaram');await pg.waitForTimeout(150);
    let cs=await cartoes(pg);const luz=cs.find(c=>/fora da exposição/.test(c.t));
    ok(luz&&luz.t==='Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras'&&luz.sev==='warn','7: o cartão exato: '+J(luz));
    ok(R.pedidos.length&&R.pedidos[0][0]===addD(HOJE,-6)&&R.pedidos[0][1]===HOJE,'AF-D8: padrão 7 dias no fuso do venue: '+J(R.pedidos));
    const t=cs.map(c=>c.t);
    ok(t.includes('Yago: 16,2 cliques por família (9 de 14 famílias abaixo de 20)')&&t.includes('Marinara: 45 cliques por família (5 de 12 famílias acima de 40)')&&t.includes('Yago: 20% das famílias compraram (equipe 50%) · 4 de 20')
      &&t.includes('Yago: 15% das fotos vendidas (equipe 22%) · 90 de 600 fotos vendidas'),'cartões de cliques e conversão: '+J(t));
    const dd=cs.filter(c=>/família|fotos vendidas/.test(c.t)).map(c=>c.d);
    ok(dd.some(d=>/7 dias · conta gramado, troféu e arquibancada; chute à parte/.test(d))&&dd.some(d=>/vendas online fora/.test(d)),'rodapé: período, fonte e vendas online fora: '+J(dd));
    const velhos=['fotos por sessão em','abaixo dos colegas','caiu nos dois últimos dias','lidera a semana','conversão de'];
    ok(antigos.some(x=>velhos.some(v=>x.includes(v)))&&!t.some(x=>velhos.some(v=>x.includes(v))),'AF-D8: os alertas antigos da Roverpix somem com os dados do servidor: '+J(antigos.slice(0,4)));
    ok(/Dados do servidor do ponto · atualizado \d\d:\d\d/.test(await pg.textContent('.af-srv')),'linha "Dados do servidor do ponto · atualizado hh:mm"');
    ok(!/presen|falta |atraso|turno|\bhoras?\b/i.test(t.join(' ')+dd.join(' ')),'nenhum texto de hora, presença ou falta');
    await pg.click('[data-act="af-per"][data-p="hoje"]');await espera(pg,()=>ETERNA.state.af.chave&&ETERNA.state.af.chave.startsWith(ETERNA.venueToday()));
    ok(J(R.pedidos[R.pedidos.length-1])===J([HOJE,HOJE]),'Hoje: de e até hoje: '+J(R.pedidos));
    await pg.click('[data-act="af-per"][data-p="30d"]');await pg.waitForTimeout(300);ok(J(R.pedidos[R.pedidos.length-1])===J([addD(HOJE,-29),HOJE]),'30 dias');
    // grave a partir de 25%
    R.grave=true;await espera(pg,()=>!ETERNA.state.af.busy);await pg.evaluate(()=>ETERNA.afPull(true));await pg.waitForTimeout(300);cs=await cartoes(pg);
    const g=cs.find(c=>/fora da exposição/.test(c.t));ok(g&&g.sev==='bad'&&g.t==='Márcio: 25 de 100 fora da exposição: 17 estouradas, 8 escuras'&&cs[0].t===g.t,'7: 25% é grave e vem antes: '+J(g));
    R.grave=false;await espera(pg,()=>!ETERNA.state.af.busy);await pg.evaluate(()=>ETERNA.afPull(true));await espera(pg,()=>!ETERNA.state.af.busy&&ETERNA.state.af.j.alertas[0].sev==='warn');
    // ---------- 9: o ajuste da foto (automático ou à mão) não muda a conta: a tela não refaz nada no navegador ----------
    const n0=R.pedidos.length;const antes=await pg.textContent('#main .alerts');
    await pg.evaluate(()=>{const S=ETERNA.SIM;S.edits=S.edits||{};S.edits['ag_aaaaaaaaaaaa']={b:60,c:20,s:0,auto:true};S.edits['ag_bbbbbbbbbbbb']={b:25,c:0,s:0};ETERNA.saveSim();ETERNA.render();});await pg.waitForTimeout(200);
    ok(await pg.textContent('#main .alerts')===antes&&R.pedidos.length===n0,'9: ajuste não muda o cartão nem pede de novo');
    // ---------- aba Cliques, conversão e exposição: tabela, equipe, Em teste ----------
    await pg.evaluate(()=>{ETERNA.state.af.per='7d';ETERNA.state.fg.aba='af';ETERNA.go('fotografos');});await espera(pg,()=>document.querySelector('.af-tabela'));
    const tab=await pg.evaluate(()=>({abas:[...document.querySelectorAll('[data-act="fg-aba"]')].map(x=>x.dataset.a),cab:[...document.querySelectorAll('.af-tabela thead th')].map(x=>x.textContent),
      linhas:[...document.querySelectorAll('.af-tabela tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim()))}));
    ok(J(tab.abas)===J(ETERNA_ABAS(tab.abas))&&tab.abas.includes('af')&&tab.abas[0]==='indice','abas da view Fotógrafos: '+J(tab.abas));
    ok(tab.linhas.length===4&&tab.linhas[3][0]==='Equipe'&&tab.linhas[0][0]==='Márcio'&&tab.linhas.find(l=>l[0]==='Márcio')[6]==='20%20 de 100: 12 estouradas, 8 escuras','tabela da AF com a equipe no fim: '+J(tab.linhas));
    ok(/Famílias/.test(tab.cab.join('|'))&&!/Em teste/.test(tab.cab.join('|')),'Ligada: sem o selo Em teste');
    ok(tab.linhas.find(l=>l[0]==='Yago')[2].includes('9 abaixo de 20 · 0 acima de 40'),'cliques com abaixo e acima');
    R.expo='medir';await espera(pg,()=>!ETERNA.state.af.busy);await pg.evaluate(()=>ETERNA.afPull(true));await pg.waitForTimeout(300);
    ok(/Em teste/.test(await pg.textContent('.af-tabela thead')),'6: medir: a coluna tem "Em teste"');
    R.expo='desligada';await espera(pg,()=>!ETERNA.state.af.busy);await pg.evaluate(()=>ETERNA.afPull(true));await pg.waitForTimeout(300);
    ok(!/Fora da exposição/.test(await pg.textContent('.af-tabela thead')),'desligada: sem a coluna de exposição');R.expo='ligada';await pg.evaluate(()=>ETERNA.afPull(true));await pg.waitForTimeout(200);
    // ---------- limites: POST só com o que mudou, auditLog com o anterior e o novo; 400 mostra o campo ----------
    await pg.fill('#af-lim input[data-k="cliques_min"]','18');await pg.click('[data-act="af-cfg-salvar"]');await pg.waitForTimeout(400);
    const p1=R.posts[R.posts.length-1];const au=await pg.evaluate(()=>ETERNA.auditRead().find(e=>e.acao==='fotografos_limites'));
    ok(p1&&J(p1.b)===J({cliques_min:18})&&p1.h['x-eterna']==='1','limites: POST só com o que mudou: '+J(p1&&p1.b));
    ok(au&&au.alvo==='config/fotografos'&&J(au.mudancas)===J([{campo:'cliques_min',de:20,para:18}]),'11: auditLog com o anterior e o novo: '+J(au));
    await pg.fill('#af-lim input[data-k="cliques_min"]','50');await pg.click('[data-act="af-cfg-salvar"]');await pg.waitForTimeout(300);
    ok(/Valor recusado: Cliques por família: mínimo/.test(await pg.textContent('#toast').catch(()=>'')),'11: 400 mostra o campo');
    // ---------- Medição › Exposição: critério, grade e "Usar estes limites" ----------
    await pg.evaluate(()=>{ETERNA.state.train.aba='medida';ETERNA.go('treino');});await espera(pg,()=>document.querySelector('.tr-luz-cls'));
    ok(await pg.$eval('[data-act="tr-analise"][data-k="exposicao"][data-v="ligada"]',x=>x.disabled===false||x.getAttribute('aria-pressed')==='true'),'exposição Ligada (do /status) não fica travada');
    const lz=await pg.evaluate(()=>({cls:[...document.querySelectorAll('.tr-luz-cls tbody tr')].map(tr=>tr.textContent),falta:[...document.querySelectorAll('.tr-luz-faltas li')].map(x=>x.textContent)}));
    ok(lz.cls.length===2&&/Escura31/.test(lz.cls[0].replace(/\s/g,''))&&lz.falta.some(x=>/Precisão de Escura: 60%/.test(x))&&lz.falta.some(x=>/Boas: 120 de 150/.test(x)),'Medição › Exposição: classes e o que falta: '+J(lz));
    ok(await pg.$eval('[data-act="tr-luz-usar"]',x=>x.disabled),'Usar estes limites travado sem escolha');
    await pg.click('[data-act="tr-luz-val"][data-k="rosto_med_baixo"][data-v="40"]');await pg.click('[data-act="tr-luz-usar"]');await pg.waitForTimeout(400);
    const p2=R.posts[R.posts.length-1];ok(p2&&J(p2.b)===J({luz:{rosto_med_baixo:40}}),'Usar estes limites grava pelo mesmo POST: '+J(p2&&p2.b));
    const au2=await pg.evaluate(()=>ETERNA.auditRead().find(e=>e.acao==='fotografos_limites'));ok(au2&&J(au2.mudancas)===J([{campo:'luz.rosto_med_baixo',de:50,para:40}]),'auditLog da luz: '+J(au2));
    // ---------- 19: abas, cartões e Medição nas 5 línguas, sem chave faltando ----------
    const falta=[];for(const l of ['pt','en','es','fr','de']){await pg.evaluate(l=>{ETERNA.state.user.idioma=l;},l);
      for(const [v,prep] of [['alertas',''],...(await pg.evaluate(()=>ETERNA.FG_ABAS)).map(a=>['fotografos',a]),['treino','medida']]){
        await pg.evaluate(([v,a])=>{if(v==='fotografos')ETERNA.state.fg.aba=a;if(v==='treino')ETERNA.state.train.aba='medida';ETERNA.state.view=v;ETERNA.render();},[v,prep]);await pg.waitForTimeout(120);
        const tx=await pg.textContent('#main');const m=tx.match(/\b(af|fg|tr_luz|tr_an)_[a-z0-9_]+\b|undefined|NaN|Algo falhou/g);if(m)falta.push(l+'/'+v+'/'+prep+': '+[...new Set(m)].join(','));}}
    ok(!falta.length,'19: chave faltando: '+falta.join(' | '));
    await ctx.close();}
  // ---------- 8: Supervisora vê; Fotógrafo e quem tem Alertas sem desempenho.r não veem nada por fotógrafo ----------
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);await usuario(pg,'sup.teste@exemplo.com','Supervisora de teste','supervisor');await pg.reload();await pg.waitForTimeout(300);
    await entrarTeste(pg,'sup.teste@exemplo.com');await espera(pg,()=>ETERNA.state.agent.on);await pg.evaluate(()=>ETERNA.go('alertas'));await espera(pg,()=>!!ETERNA.state.af.j);await pg.waitForTimeout(150);
    ok((await cartoes(pg)).some(c=>c.t==='Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras'),'8: a Supervisora vê o cartão');await ctx.close();}
  for(const [email,nome,preset,extra,rot] of [['fot.teste@exemplo.com','Fotógrafo de teste','foto',{key:'carlos'},'Fotógrafo'],
      ['rel.teste@exemplo.com','Relatórios sem desempenho','supervisor',{perms:null,menu:['alertas','painel']},'Alertas sem desempenho.r']]){
    const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    if(extra.perms===null){extra.perms=await pg.evaluate(()=>{const p=ETERNA.presetPerms('supervisor');p.desempenho={c:false,r:false,u:false,d:false};return p;});}
    await usuario(pg,email,nome,preset,extra);await pg.reload();await pg.waitForTimeout(300);await entrarTeste(pg,email);await espera(pg,()=>ETERNA.state.agent.on);
    if(await pg.evaluate(()=>ETERNA.canView('alertas'))){await pg.evaluate(()=>ETERNA.go('alertas'));await pg.waitForTimeout(400);}
    // mesmo com dados do servidor na memória (outra pessoa no mesmo aparelho), nada por fotógrafo aparece
    await pg.evaluate(()=>{ETERNA.state.af.j={v:1,fotografos:[],alertas:[{tipo:'af_luz',k:'marcio',sev:'warn',args:[20,100,12,8]}],limites:{},equipe:{}};});
    const al=await pg.evaluate(()=>ETERNA.alerts().map(a=>a.t));const nomes=['Carlos','Marinara','Samuel','Yago','Márcio','Klacius','Sandessa'];
    ok(!al.some(t=>nomes.some(n=>t.startsWith(n+':')||t.startsWith(n+' lidera'))),'8: '+rot+' não vê alerta por fotógrafo: '+J(al));
    ok(!R.pedidos.length,'8: '+rot+' não pede /fotografos/alertas: '+J(R.pedidos));
    ok(!(await pg.evaluate(()=>ETERNA.canView('fotografos'))),'8: '+rot+' não vê a view Fotógrafos');
    await ctx.close();}
}catch(e){fails.push('exceção: '+(e.stack||e).toString().slice(0,600));}
await b.close();
const okT=!fails.length&&!errs.length;console.log(`${okT?'OK':'FALHA'} af-alertas: cartões af_* (7), permissão (8), ajuste não muda a conta (9), 5 línguas (19), período, limites e Medição › Exposição${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okT?0:1);})();
function ETERNA_ABAS(a){return a;}
