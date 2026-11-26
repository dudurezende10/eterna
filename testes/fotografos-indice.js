// 25/11 (Eduardo, primeiro dia só com o Eterna): Fotógrafos › Índice mostrava todo mundo "sem dados" no dia do Eterna, porque lia só o
// histórico da Roverpix que está no navegador. Agora os dias do Eterna vêm do servidor do ponto (GET /fotografos/dias, o pedido da aba
// Estatísticas). Cobre: 1) com o servidor respondendo o dia, o Índice mostra os fotógrafos com números, inclusive quem não está na lista
// fixa do app; quem não trabalhou segue "sem dados"; o detalhe por pessoa e o Exportar leem o mesmo dado. 2) sem servidor (desligado ou
// com erro), o aviso "Sem conexão com o servidor do ponto". 3) período da Roverpix igual a antes, com ou sem servidor.
// Agente falso (page.route); números inventados.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());
// o dia do servidor: média da receita de quem produziu = (600+300+0+300)/4 = 300 -> Yago 200, Marinara 100, Samuel 0, Hugo 100.
// "sem fotógrafo" e __proto__ não são pessoa e não entram na média; "novato" está no servidor sem produção e não vira cartão com número.
const POR={yago:{fotos:120,sessoes:6,sessoes_com_venda:3,vendas:3,faturamento:600,fotos_vendidas:12},
  marinara:{fotos:80,sessoes:4,sessoes_com_venda:2,vendas:2,faturamento:300,fotos_vendidas:6},
  samuel:{fotos:60,sessoes:5,sessoes_com_venda:0,vendas:0,faturamento:0,fotos_vendidas:0},
  hugo:{fotos:90,sessoes:3,sessoes_com_venda:1,vendas:1,faturamento:300,fotos_vendidas:4},
  novato:{fotos:0,sessoes:0,sessoes_com_venda:0,vendas:0,faturamento:0,fotos_vendidas:0},
  'sem fotógrafo':{fotos:10,sessoes:2,sessoes_com_venda:2,vendas:2,faturamento:900,fotos_vendidas:5},
  '__proto__':{fotos:9,sessoes:9,faturamento:5000}};
async function agente(ctx,R,o){o=o||{};const js=(r,x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(x)});R.dias=[];
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bfi',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},estatisticas:{v:2,migracao:{estado:'feita'}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/metricas/dia*',r=>js(r,{ok:true,dias:[]}));
  await ctx.route(ORIG+'/fotografos/alertas*',r=>js(r,{ok:true,v:1,limites:{cliques_min:20,cliques_max:40},exposicao:'desligada',fonte_cliques:'todas',equipe:{familias:0},fotografos:[],alertas:[]}));
  await ctx.route(ORIG+'/fotografos/dias*',r=>{const q=new URL(r.request().url()).searchParams;const de=q.get('de'),ate=q.get('ate');R.dias.push([de,ate]);if(R.quebra)return js(r,{erro:'x'},500);
    const dias=[];if(HOJE>=de&&HOJE<=ate)dias.push({dia:HOJE,por_fotografo:POR});
    (R.extra||[]).forEach(d=>{if(d>=de&&d<=ate)dias.push({dia:d,por_fotografo:{yago:{fotos:999,sessoes:99,sessoes_com_venda:99,vendas:99,faturamento:99999,fotos_vendidas:999}}});});js(r,{ok:true,dias});});}
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async comAgente=>{const ctx=await b.newContext({viewport:{width:1366,height:950},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};if(comAgente)await agente(ctx,R);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg,R};};
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg.evaluate(fn).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
const entra=async pg=>{await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);};
const abre=(pg,de,ate)=>pg.evaluate(([de,ate])=>{ETERNA.state.range={from:de,to:ate};ETERNA.state.person=null;ETERNA.state.personDay=null;ETERNA.state.fg.aba='indice';ETERNA.state.fg.est.chave=null;ETERNA.state.fg.est.errEm=0;ETERNA.go('fotografos');},[de,ate]);
const cartoes=pg=>pg.evaluate(()=>[...document.querySelectorAll('.cards .pcard')].map(c=>({k:c.dataset.key,nome:c.querySelector('.nm').textContent.trim(),idx:c.querySelector('.idx').textContent.trim(),txt:c.textContent})));
const linhas=pg=>pg.evaluate(()=>[...document.querySelectorAll('#main .panel table tbody tr')].map(tr=>({k:tr.dataset.key,c:[...tr.children].map(td=>td.textContent.trim())})));
try{
  // ---------- 1: o dia do Eterna vem do servidor do ponto ----------
  {const {ctx,pg,R}=await nova(true);await entra(pg);await espera(pg,()=>ETERNA.state.agent.on);
    ok(HOJE>=await pg.evaluate(()=>ETERNA.FG_ETERNA_DESDE),'o teste precisa rodar num dia do Eterna (a partir de FG_ETERNA_DESDE)');
    await abre(pg,HOJE,HOJE);ok(await espera(pg,()=>!!document.querySelector('.pcard[data-key="hugo"]')),'1: o Índice não mostrou quem só existe no servidor (hugo)');
    ok(R.dias.length&&R.dias[R.dias.length-1][0]===HOJE&&R.dias[R.dias.length-1][1]===HOJE,'1: o Índice pede /fotografos/dias no período da tela: '+J(R.dias));
    const cs=await cartoes(pg);const c=k=>cs.find(x=>x.k===k)||{};
    ok(c('yago').idx==='200'&&c('marinara').idx==='100'&&c('samuel').idx==='0'&&c('hugo').idx==='100','1: índices do dia (100 = média da equipe): '+J(cs.map(x=>[x.k,x.idx])));
    ok(/600/.test(c('yago').txt)&&/50%/.test(c('yago').txt)&&!/sem dados/.test(c('yago').txt),'1: o cartão do Yago tem os números do servidor: '+J(c('yago').txt));
    ok(/^Hugo/.test(c('hugo').nome||''),'1: nome de quem só existe no servidor: '+J(c('hugo').nome));
    ok(c('sandessa').idx==='sem dados'&&/Sem sessões/.test(c('sandessa').txt),'1: quem não trabalhou segue sem dados: '+J(c('sandessa')));
    ok(!cs.some(x=>/proto|sem fot|novato/i.test(x.k+x.nome)),'1: chave proibida, "sem fotógrafo" e quem não produziu não viram cartão: '+J(cs.map(x=>x.k)));
    ok(cs[0].k==='yago'&&cs.findIndex(x=>x.idx==='sem dados')>cs.findIndex(x=>x.k==='samuel'),'1: ordem pelo índice, sem dados no fim: '+J(cs.map(x=>x.k)));
    const tb=await linhas(pg);const ty=tb.find(l=>l.k==='yago'),th=tb.find(l=>l.k==='hugo');
    ok(ty&&ty.c[1]==='200'&&ty.c[2]==='1'&&ty.c[3]==='120'&&ty.c[4]==='6'&&ty.c[6]==='50%'&&/^12 \(10%\)$/.test(ty.c[7])&&/600/.test(ty.c[9]),'1: linha do Yago na tabela: '+J(ty));
    ok(th&&th.c[1]==='100'&&th.c[4]==='3'&&/300/.test(th.c[9]),'1: linha do Hugo na tabela: '+J(th));
    ok(!(await pg.$('#fg-idx-sem'))&&!/Sem dados neste período/i.test(await pg.textContent('.rangebar')),'1: com o servidor, nem o aviso de conexão nem o de período sem dados');
    // o detalhe por pessoa: o dia a dia e o dia aberto (sem lista sessão a sessão, que o servidor não dá por aqui)
    await pg.click('.pcard[data-key="hugo"]');await pg.waitForTimeout(150);
    ok(/^Hugo/.test(await pg.textContent('#main h1'))&&await pg.evaluate(()=>document.querySelectorAll('tr[data-act="person-day"]').length===1),'1: detalhe do Hugo com o dia do servidor');
    const dl=await pg.evaluate(()=>[...document.querySelector('tr[data-act="person-day"]').children].map(td=>td.textContent.trim()));
    ok(dl[1]==='100'&&/300/.test(dl[2])&&dl[3]==='3'&&dl[4]==='1'&&dl[6]==='90'&&/^4 /.test(dl[8]),'1: linha do dia no detalhe: '+J(dl));
    await pg.click('tr[data-act="person-day"]');await pg.waitForTimeout(150);
    ok(await pg.$('#fg-idx-dia')&&/servidor do ponto/.test(await pg.textContent('#fg-idx-dia')),'1: abrir o dia não quebra e diz de onde vem o dado');
    const rel=await pg.evaluate(()=>{const a=ETERNA.REL.fotografos();ETERNA.state.person=null;ETERNA.state.personDay=null;const b=ETERNA.REL.fotografos();return {a:a.abas.map(x=>x.linhas.length),b:b.abas[0].linhas.map(l=>l[0]+':'+l[1])};});
    ok(rel.a[0]===1&&rel.b.some(x=>/^Hugo.*:100$/.test(x))&&rel.b.some(x=>x==='Yago:200'),'1: o Exportar leva os mesmos números: '+J(rel));
    // ---------- 3: período da Roverpix igual a antes, mesmo com o servidor devolvendo esses dias ----------
    const per=await pg.evaluate(()=>{const r=ETERNA.fgIndiceRef();return {de:r.de,ate:r.ate};});R.extra=[per.de,per.ate];
    await abre(pg,per.de,per.ate);await espera(pg,()=>ETERNA.state.fg.est.chave===ETERNA.state.range.from+'|'+ETERNA.state.range.to);await pg.waitForTimeout(150);
    const cmp=await pg.evaluate(()=>{const rf=ETERNA.fgIndiceRef(),a=rf.stats,humans=rf.humans,D=ETERNA.fgIndiceDados();return {igual:humans.every(k=>JSON.stringify(a[k])===JSON.stringify(D.stats[k])),n:D.list.length,h:humans.length,com:D.list.filter(s=>s.index!=null).length,srv:D.srvDias.size};});
    ok(cmp.igual&&cmp.n===cmp.h&&cmp.com>0&&cmp.srv===0,'3: período da Roverpix com os mesmos números de antes (o servidor não entra nesses dias): '+J(cmp));
    ok(!(await pg.$('#fg-idx-sem'))&&(await cartoes(pg)).some(x=>/^\d+$/.test(x.idx)),'3: cartões com índice e sem aviso');
    // período misto: os dias da Roverpix mais o dia do Eterna
    await abre(pg,per.ate,HOJE);ok(await espera(pg,()=>ETERNA.state.fg.est.chave===ETERNA.state.range.from+'|'+ETERNA.state.range.to&&ETERNA.fgIndiceDados().srvDias.size===1),'3: período misto lê o dia do Eterna do servidor');
    const mis=await pg.evaluate(()=>{const D=ETERNA.fgIndiceDados();const a=ETERNA.fgIndiceRef().stats;const y=D.stats.yago;return {dias:y.days,antes:a.yago.days,rec:y.revenue-a.yago.revenue};});
    ok(mis.dias===mis.antes+1&&mis.rec===600,'3: período misto soma os dias da Roverpix e o dia do servidor: '+J(mis));
    // ---------- 2b: o servidor responde com erro ----------
    R.quebra=true;await abre(pg,HOJE,HOJE);ok(await espera(pg,()=>!!document.querySelector('#fg-idx-sem')),'2: com erro do servidor, o aviso de conexão');
    ok(/Sem conexão com o servidor do ponto/.test(await pg.textContent('#fg-idx-sem')),'2: texto do aviso: '+J(await pg.textContent('#fg-idx-sem').catch(()=>'')));
    await ctx.close();}
  // ---------- 2: sem o servidor do ponto ----------
  {const {ctx,pg}=await nova(false);await entra(pg);await pg.waitForTimeout(300);
    ok(!(await pg.evaluate(()=>ETERNA.state.agent.on)),'2: este contexto não tem servidor');
    await abre(pg,HOJE,HOJE);await pg.waitForTimeout(250);
    ok(await pg.$('#fg-idx-sem')&&/Sem conexão com o servidor do ponto/.test(await pg.textContent('#fg-idx-sem')),'2: sem servidor, o aviso "Sem conexão com o servidor do ponto"');
    ok(!(await cartoes(pg)).some(x=>/^\d+$/.test(x.idx)),'2: sem servidor, nenhum número inventado no dia do Eterna');
    // período da Roverpix sem servidor: como antes, sem aviso
    const per=await pg.evaluate(()=>{const r=ETERNA.fgIndiceRef();return {de:r.de,ate:r.ate};});await abre(pg,per.de,per.ate);await pg.waitForTimeout(200);
    const cmp=await pg.evaluate(()=>{const rf=ETERNA.fgIndiceRef(),a=rf.stats,humans=rf.humans,D=ETERNA.fgIndiceDados();return {igual:humans.every(k=>JSON.stringify(a[k])===JSON.stringify(D.stats[k])),com:D.list.filter(s=>s.index!=null).length};});
    ok(cmp.igual&&cmp.com>0&&!(await pg.$('#fg-idx-sem')),'3: sem servidor, o período da Roverpix segue igual e sem aviso: '+J(cmp));
    await ctx.close();}
}catch(e){fails.push('exceção: '+(e.stack||e).toString().slice(0,600));}
await b.close();
const okT=!fails.length&&!errs.length;console.log(`${okT?'OK':'FALHA'} fotografos-indice: o Índice lê os dias do Eterna do servidor do ponto${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okT?0:1);})();
