// 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md, critérios 14 a 18): a seção b "Fotógrafos" saiu da Estatísticas e
// virou a aba Estatísticas da view Fotógrafos (Curadoria), com GET /fotografos/dias (desempenho.r). 14: sem o chip; es-sec b antigo,
// state.es.sec='b' e eterna.es.v1 {sec:'b'} levam à aba (com desempenho.r) ou à seção a (sem ela, e o eterna.es.v1 fica com a).
// 15: as mesmas linhas, colunas, ordem e totais da antiga seção b; ordenar por coluna. 16: desempenho.r sem estatisticas.r vê a aba;
// estatisticas.r sem desempenho.r não vê a view. 17: Exportar segue a aba; a Estatísticas exporta só em a e e. 18: a tabela
// "Por fotógrafo" do Painel some sem desempenho.r. Agente falso (page.route); números inventados.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const H=f=>({n:f.reduce((a,b)=>a+b,0),soma:0,f});
// dias sintéticos: três fotógrafos, um que não vende, um com dia sem produção e um nome proibido que nunca vira linha
const DIAS=[0,1,2,3].map(i=>({dia:addD(HOJE,-i),por_fotografo:{
  yago:{fotos:120+i,sessoes:6,sessoes_com_venda:3,vendas:3,faturamento:500.5,fotos_vendidas:12,clique_checkout_s:H([1,2,1,0,0,0,0])},
  marinara:{fotos:i===2?0:80,sessoes:i===2?0:4,sessoes_com_venda:i===2?0:1,vendas:i===2?0:1,faturamento:i===2?0:200,fotos_vendidas:i===2?0:3},
  samuel:{fotos:60,sessoes:5,sessoes_com_venda:0,vendas:0,faturamento:0,fotos_vendidas:0,clique_checkout_s:H([0,0,3,1,0,0,0])},
  '__proto__':{fotos:9,sessoes:9}}}));
async function agente(ctx,R){const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});R.dias=[];R.metricas=0;
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bfg',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},estatisticas:{v:2,migracao:{estado:'feita'}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/metricas/dia*',r=>{R.metricas++;js(r,{ok:true,dias:DIAS.map(d=>({dia:d.dia,v:2,fotos:260,sessoes:15,sessoes_com_venda:4,vendas:4,faturamento:700.5,por_fotografo:d.por_fotografo}))});});
  await ctx.route(ORIG+'/fotografos/dias*',r=>{const q=new URL(r.request().url()).searchParams;R.dias.push([q.get('de'),q.get('ate')]);js(r,{ok:true,dias:DIAS.filter(d=>d.dia>=q.get('de')&&d.dia<=q.get('ate'))});});
  await ctx.route(ORIG+'/fotografos/alertas*',r=>js(r,{ok:true,v:1,limites:{cliques_min:20,cliques_max:40},exposicao:'desligada',fonte_cliques:'todas',equipe:{familias:0},fotografos:[],alertas:[]}));}
function usuario(pg,email,nome,perms,menu){return pg.evaluate(([e,n,p,m])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]={v:2,email:e,name:n,active:true,preset:'custom',perms:p,menu:m,key:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,perms,menu]);}
// o que a antiga seção b mostrava: soma por fotógrafo (sem __proto__), dias com produção, conversão, R$ por sessão
function esperado(){const fot={};const dias={};DIAS.forEach(d=>Object.entries(d.por_fotografo).forEach(([k,v])=>{if(k==='__proto__')return;const a=fot[k]||(fot[k]={sessoes:0,fotos:0,vendas:0,faturamento:0,scv:0});
  a.sessoes+=v.sessoes;a.fotos+=v.fotos;a.vendas+=v.vendas;a.faturamento+=v.faturamento;a.scv+=v.sessoes_com_venda;if(v.fotos>0||v.sessoes>0)dias[k]=(dias[k]||0)+1;}));return {fot,dias};}
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async()=>{const ctx=await b.newContext({viewport:{width:1366,height:950},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg,R};};
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg.evaluate(fn).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
const tabela=pg=>pg.evaluate(()=>({cab:[...document.querySelectorAll('.es-fotos thead th')].map(x=>x.textContent.trim().replace(/ [▲▼]$/,'')),linhas:[...document.querySelectorAll('.es-fotos tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim()))}));
const periodo=`ETERNA.state.range={from:'${addD(HOJE,-6)}',to:'${HOJE}'};`;
try{
  // ---------- Admin: 14, 15, 17 ----------
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);await espera(pg,()=>ETERNA.state.agent.on);
    await pg.evaluate(p=>{new Function(p)();ETERNA.state.es.sec='a';ETERNA.go('estatisticas');},periodo);await pg.waitForTimeout(250);
    // 14: sem o chip; o clique num es-sec b antigo leva à aba
    ok(!(await pg.$('[data-act="es-sec"][data-s="b"]'))&&!(await pg.evaluate(()=>ETERNA.esSecoes().some(s=>s[0]==='b'))),'14: a Estatísticas ainda tem o chip Fotógrafos');
    await pg.evaluate(()=>{const x=document.createElement('button');x.dataset.act='es-sec';x.dataset.s='b';x.id='b-velho';x.textContent='Fotógrafos';document.querySelector('#main').appendChild(x);x.click();});
    ok(await espera(pg,()=>ETERNA.state.view==='fotografos'&&ETERNA.state.fg.aba==='estatisticas'),'14: es-sec b antigo vai para Fotógrafos › Estatísticas: '+J(await pg.evaluate(()=>[ETERNA.state.view,ETERNA.state.fg.aba])));
    ok(await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.es.v1')).sec==='a'&&ETERNA.state.es.sec==='a'),'14: eterna.es.v1 regravado com a');
    await pg.evaluate(()=>{ETERNA.state.fg.aba='indice';ETERNA.state.es.sec='b';ETERNA.go('estatisticas');});
    ok(await espera(pg,()=>ETERNA.state.view==='fotografos'&&ETERNA.state.fg.aba==='estatisticas'),'14: state.es.sec b vai para a aba');
    await pg.evaluate(()=>{ETERNA.state.fg.aba='indice';localStorage.setItem('eterna.fg.v1',JSON.stringify({aba:'indice'}));localStorage.setItem('eterna.es.v1',JSON.stringify({sec:'b',rover:false}));});await pg.reload();await pg.waitForTimeout(400);
    await pg.evaluate(()=>ETERNA.go('estatisticas'));ok(await espera(pg,()=>ETERNA.state.view==='fotografos'&&ETERNA.state.fg.aba==='estatisticas'),'14: eterna.es.v1 {sec:b} vai para a aba');
    ok(await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.fg.v1')).aba==='estatisticas'&&JSON.parse(localStorage.getItem('eterna.es.v1')).sec==='a'),'14: a aba fica guardada e o eterna.es.v1 com a');
    // 15: mesmas linhas, colunas, ordem e totais
    const m0=R.metricas;await pg.evaluate(p=>{new Function(p)();ETERNA.state.fg.est.chave=null;ETERNA.render();},periodo);await espera(pg,()=>(ETERNA.state.fg.est.dias||[]).length===4&&document.querySelectorAll('.es-fotos tbody tr').length>=3);
    ok(R.dias.length&&R.dias[R.dias.length-1][0]===addD(HOJE,-6)&&R.dias[R.dias.length-1][1]===HOJE&&R.metricas===m0,'a aba lê /fotografos/dias no período da tela (e não o /metricas/dia): '+J([R.dias,R.metricas]));
    let t=await tabela(pg);const E=esperado();
    ok(J(t.cab)===J(['Fotógrafo','Dias com produção','Sessões','Fotos','Fotos/sessão','Vendas','Conversão','R$/sessão','Faturamento','Clique → Checkout']),'15: colunas da antiga seção b: '+J(t.cab));
    const nomes=t.linhas.map(l=>l[0]);const fat=k=>E.fot[k].faturamento;
    ok(['Yago','Marinara','Samuel'].every(n=>nomes.includes(n))&&!nomes.some(n=>/proto/.test(n)),'15: linhas: '+J(nomes));
    const ord=nomes.filter(n=>['Yago','Marinara','Samuel'].includes(n));ok(J(ord)===J(['Yago','Marinara','Samuel']),'15: ordem padrão por faturamento: '+J(ord));
    const y=t.linhas.find(l=>l[0]==='Yago'),m=t.linhas.find(l=>l[0]==='Marinara');
    ok(y[1]==='4'&&y[2]==='24'&&y[3].replace(/\D/g,'')===String(E.fot.yago.fotos)&&y[6]==='50%'&&y[8].replace(/\D/g,'')===String(Math.round(fat('yago')))&&y[9]!=='—','15: números do Yago: '+J(y));
    ok(m[1]===String(E.dias.marinara)&&m[1]==='3'&&m[2]==='12','15: dias com produção da Marinara (um dia sem produção): '+J(m));
    // ordenar por coluna funciona igual (es-ord): sessões desc, de novo asc
    await pg.click('[data-act="es-ord"][data-c="sessoes"]');t=await tabela(pg);const s1=t.linhas.map(l=>+l[2].replace(/\D/g,''));ok(s1.every((v,i)=>!i||s1[i-1]>=v),'15: sessões em ordem decrescente: '+J(s1));
    await pg.click('[data-act="es-ord"][data-c="sessoes"]');t=await tabela(pg);const s2=t.linhas.map(l=>+l[2].replace(/\D/g,''));ok(s2.every((v,i)=>!i||s2[i-1]<=v),'15: de novo, crescente: '+J(s2));
    await pg.click('.es-link[data-k="yago"]');await pg.waitForTimeout(100);ok(/Yago · dia a dia/.test(await pg.textContent('#main'))&&await pg.evaluate(()=>document.querySelectorAll('#es-foto-dia tbody tr').length===4),'15: dia a dia do fotógrafo');
    // 17: Exportar segue a aba
    const r17=await pg.evaluate(()=>{const F=ETERNA.state.fg;const out={};for(const a of ETERNA.FG_ABAS){F.aba=a;const R=ETERNA.REL.fotografos();out[a]={id:R.id,col:(R.abas[0]||{colunas:[]}).colunas.map(c=>c.t||c.nome||c),n:R.abas.length};}F.aba='estatisticas';return out;});
    ok(r17.indice.id==='fotografos-indice'&&r17.indice.col.length===15&&r17.estatisticas.id==='fotografos-estatisticas'&&r17.estatisticas.col.length===10&&r17.estatisticas.n===2&&r17.af.id==='fotografos-af','17: o arquivo da aba aberta: '+J(r17));
    ok(await pg.$('.head .rel-exp'),'17: Fotógrafos › Estatísticas com o Exportar');
    const pode=await pg.evaluate(()=>{const o={};for(const s of ['a','c','d','e','f']){ETERNA.state.es.sec=s;o[s]=ETERNA.relPode('estatisticas');}ETERNA.state.es.sec='a';return o;});
    ok(J(pode)===J({a:true,c:false,d:false,e:true,f:false}),'17: Exportar da Estatísticas só em a e e: '+J(pode));
    // 18: Admin vê a tabela Por fotógrafo do Painel
    await pg.evaluate(p=>{new Function(p)();ETERNA.go('painel');},periodo);await espera(pg,()=>/Por fotógrafo/.test(document.querySelector('#main').textContent),6000);
    ok(/Por fotógrafo/.test(await pg.textContent('#main')),'18: Admin vê Por fotógrafo no Painel');
    await ctx.close();}
  // ---------- 16 e 18: só desempenho.r vê a aba com dados; estatisticas.r sem desempenho.r não vê a view nem Por fotógrafo; b vira a ----------
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    const N={c:false,r:false,u:false,d:false},RO={c:false,r:true,u:false,d:false};
    const so=await pg.evaluate(N=>{const p={};ETERNA.MODULES.forEach(([m])=>{p[m]=Object.assign({},N);});return p;},N);
    await usuario(pg,'des.teste@exemplo.com','Só desempenho',Object.assign({},so,{desempenho:RO}),['fotografos']);
    await usuario(pg,'est.teste@exemplo.com','Estatísticas sem desempenho',Object.assign({},so,{estatisticas:RO,financeiro:RO,relatorios:RO}),['estatisticas','painel','alertas','fotografos']);
    await pg.reload();await pg.waitForTimeout(300);await entrarTeste(pg,'des.teste@exemplo.com');await espera(pg,()=>ETERNA.state.agent.on);
    await pg.evaluate(p=>{new Function(p)();ETERNA.state.fg.aba='estatisticas';ETERNA.go('fotografos');},periodo);
    ok(await espera(pg,()=>ETERNA.state.view==='fotografos'&&document.querySelectorAll('.es-fotos tbody tr').length>=3),'16: desempenho.r sem estatisticas.r abre a aba com dados: '+J(await pg.evaluate(()=>[ETERNA.state.view,ETERNA.can('estatisticas','r'),(ETERNA.state.fg.est.dias||[]).length])));
    ok(!(await pg.evaluate(()=>ETERNA.can('estatisticas','r'))),'16: o usuário de teste não tem estatisticas.r');
    await pg.evaluate(()=>{localStorage.removeItem('eterna.session');});await ctx.close();}
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    const N={c:false,r:false,u:false,d:false},RO={c:false,r:true,u:false,d:false};
    const so=await pg.evaluate(N=>{const p={};ETERNA.MODULES.forEach(([m])=>{p[m]=Object.assign({},N);});return p;},N);
    await usuario(pg,'est.teste@exemplo.com','Estatísticas sem desempenho',Object.assign({},so,{estatisticas:RO,financeiro:RO,relatorios:RO}),['estatisticas','painel','alertas','fotografos']);
    await pg.evaluate(()=>localStorage.setItem('eterna.es.v1',JSON.stringify({sec:'b',rover:false})));await pg.reload();await pg.waitForTimeout(300);
    await entrarTeste(pg,'est.teste@exemplo.com');await espera(pg,()=>ETERNA.state.agent.on);
    ok(!(await pg.evaluate(()=>ETERNA.canView('fotografos'))),'16: estatisticas.r sem desempenho.r não vê a view Fotógrafos');
    await pg.evaluate(p=>{new Function(p)();ETERNA.go('estatisticas');},periodo);await pg.waitForTimeout(400);
    ok(await pg.evaluate(()=>ETERNA.state.view==='estatisticas'&&ETERNA.state.es.sec==='a'&&JSON.parse(localStorage.getItem('eterna.es.v1')).sec==='a'),'14: sem desempenho.r, {sec:b} abre a seção a e o eterna.es.v1 fica com a: '+J(await pg.evaluate(()=>[ETERNA.state.view,ETERNA.state.es.sec,localStorage.getItem('eterna.es.v1')])));
    await pg.evaluate(()=>{const x=document.createElement('button');x.dataset.act='es-sec';x.dataset.s='b';x.id='b-velho';x.textContent='Fotógrafos';document.querySelector('#main').appendChild(x);x.click();});await pg.waitForTimeout(200);
    ok(await pg.evaluate(()=>ETERNA.state.view==='estatisticas'&&ETERNA.state.es.sec==='a'),'14: sem desempenho.r, o clique no b antigo fica na seção a');
    await pg.evaluate(p=>{new Function(p)();ETERNA.go('painel');},periodo);await espera(pg,()=>!!ETERNA.state.srvMet.dias,6000);await pg.waitForTimeout(200);
    const tx=await pg.textContent('#main');ok(/Por vendedor|Por ponto|Sessões/.test(tx)&&!/Por fotógrafo/.test(tx),'18: sem desempenho.r o Painel não mostra Por fotógrafo');
    ok(!R.dias.length,'16: sem desempenho.r nada pede /fotografos/dias: '+J(R.dias));
    await ctx.close();}
}catch(e){fails.push('exceção: '+(e.stack||e).toString().slice(0,600));}
await b.close();
const okT=!fails.length&&!errs.length;console.log(`${okT?'OK':'FALHA'} fotografos-abas: seção b virou a aba Estatísticas de Fotógrafos (critérios 14 a 18)${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okT?0:1);})();
