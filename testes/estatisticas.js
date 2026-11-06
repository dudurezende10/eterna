// v92: Estatísticas, Calendário de eventos, folgas fixas, turnos, presença e sessão que vence na virada do dia
// (plano docs/planos/2026-11-05-estatisticas.md, critérios 1 a 3, 8 a 15, 17 a 25, 27 e 28; os do agente estão em
// testes/estatisticas_agente.py). O agente é falso (page.route na própria origem); dados sintéticos, nenhum dado de cliente.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const medidas={};
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const H=(f)=>({n:f.reduce((a,b)=>a+b,0),soma:0,f});
// dia v2 do servidor
function dia(iso,o){o=o||{};return Object.assign({v:2,dia:iso,fotos:300,sessoes:20,sessoes_com_venda:5,vendas:5,faturamento:1000,fotos_vendidas:30,online:{vendas:1,faturamento:39,fotos:1},
  por_fotografo:{carlos:{fotos:300,sessoes:20,sessoes_com_venda:5,vendas:5,faturamento:1000,fotos_vendidas:30,primeira_foto:null,clique_checkout_s:H([3,5,1,0,0,0,0])}},
  por_vendedor:{Ana:{vendas:5,faturamento:1000,fotos_vendidas:30,pagamento_s:H([1,2,1,0,0,0,0])}},por_posto:{'Caixa 1':{vendas:5,faturamento:1000,fotos_vendidas:30}},por_meio:{pix:{vendas:3,faturamento:600,fotos_vendidas:18},cartao:{vendas:2,faturamento:400,fotos_vendidas:12}},
  por_hora:{'10':{vendas:3,faturamento:600,sessoes:10,fotos:150},'15':{vendas:2,faturamento:400,sessoes:10,fotos:150}},por_produto:{tribuna:{n:2,receita:440},maracana:{n:2,receita:380},sem_detalhe:{n:1,receita:180}},
  por_canal:{checkout:{vendas:4,faturamento:820},balcao:{vendas:1,faturamento:180}},por_idioma:{pt:{vendas:3,faturamento:600},es:{vendas:1,faturamento:220}},
  tempos:{cliente_s:H([0,2,2,0,0,0,0]),pagamento_s:H([1,2,1,0,0,0,0]),clique_checkout_s:H([3,5,1,0,0,0,0]),transferencia_s:H([9,0,0,0,0,0,0])},presenca:{},entradas:null},o);}
(async()=>{
const b=await chromium.launch();const errs=[];
const nova=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1440,height:h||1000},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>{localStorage.removeItem('eterna.session');});await pg.goto(U);await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
const nav=pg=>pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));
// agente falso
const AG={dias:[],pres:[],ent:[],imps:[],eventos:[]};
async function agente(ctx){const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'b92',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},estatisticas:{v:2,migracao:{estado:'feita'}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{const bd=JSON.parse(r.request().postData()||'{}');AG.eventos.push(...(bd.eventos||[]));js(r,{ok:true,resultados:(bd.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))});});
  await ctx.route(ORIG+'/metricas/dia*',r=>{const q=new URL(r.request().url()).searchParams;const de=q.get('de'),ate=q.get('ate');js(r,{ok:true,dias:AG.dias.filter(d=>d.dia>=de&&d.dia<=ate)});});
  await ctx.route(ORIG+'/ponto/presenca',r=>{AG.pres.push({h:r.request().headers(),b:r.request().postData()});js(r,{ok:true,dia:HOJE,primeiro:Date.now()/1000});});
  await ctx.route(ORIG+'/ponto/entradas/importacoes',r=>js(r,{ok:true,importacoes:AG.imps}));
  await ctx.route(ORIG+'/ponto/entradas',r=>{const raw=r.request().postData()||'';AG.ent.push({h:r.request().headers(),raw});const bd=JSON.parse(raw);AG.imps.unshift({id:'imp_x',em:'2026-11-05T12:00:00Z',por:bd.por,arquivo:bd.arquivo,origem:bd.origem,dias:[bd.dia],aceitas:bd.seg.length,recusadas:0});js(r,{ok:true,aceitas:bd.seg.length,recusadas:0,dia:bd.dia,origem:bd.origem});});}
try{
  // ---------- 28: sem servidor do ponto ----------
  {const {ctx,pg}=await nova();await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>{ETERNA.go('estatisticas');});await pg.waitForTimeout(300);
    const t=await pg.textContent('#main');ok(/Sem conexão com o servidor do ponto/.test(t)&&!/Algo falhou/.test(t),'28: aviso sem servidor: '+t.slice(0,200));
    for(const s of ['b','c','d','e','f']){await pg.click(`[data-act="es-sec"][data-s="${s}"]`);await pg.waitForTimeout(80);ok(!/Algo falhou/.test(await pg.textContent('#main')),'28: seção '+s+' sem servidor');}
    await ctx.close();}
  // ---------- 1: menu Estatísticas só para o Admin ----------
  {const {ctx,pg}=await nova();await agente(ctx);await entrar(pg,'eduardo@eduardorezende.com');const v=await nav(pg);
    ok(v[v.indexOf('painel')+1]==='estatisticas','1: Estatísticas logo abaixo de Painel: '+J(v));ok(v.includes('calendario'),'1: Admin vê o Calendário');
    await ctx.close();}
  for(const e of ['supervisor@eterna.photo','carlos@eterna.photo','loja@eterna.photo','qualidade@eterna.photo']){const {ctx,pg}=await nova();await agente(ctx);const en=await entrar(pg,e);ok(en,'1: entrou '+e);
    const v=await nav(pg);ok(!v.includes('estatisticas'),'1: '+e+' não vê Estatísticas');
    await pg.evaluate(()=>{location.hash='#estatisticas';});await pg.waitForTimeout(250);const st=await pg.evaluate(()=>({v:ETERNA.state.view,t:document.getElementById('toast').textContent}));
    ok(st.v!=='estatisticas'&&/Sem acesso/.test(st.t),'1: #estatisticas para '+e+' mostra sem acesso: '+J(st));
    if(e==='supervisor@eterna.photo')ok(v.includes('calendario'),'2: Supervisor vê o Calendário');
    await ctx.close();}
  // ---------- 2/17/18/19: Calendário pela Supervisora ----------
  {const {ctx,pg}=await nova();await agente(ctx);await entrar(pg,'supervisor@eterna.photo');await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(200);
    await pg.click('[data-act="ag-novo"]');await pg.fill('#ag-f-data','2026-11-08');await pg.fill('#ag-f-hora','16:00');await pg.selectOption('#ag-f-tipo','jogo');await pg.fill('#ag-f-mandante','fla');await pg.fill('#ag-f-visitante','Palmeiras');await pg.fill('#ag-f-competicao','Brasileirão');
    await pg.click('[data-act="ag-salvar"]');await pg.waitForTimeout(150);
    let A=await pg.evaluate(()=>Object.values(ETERNA.AGENDA));ok(A.length===1&&A[0].mandante==='Flamengo'&&A[0].data==='2026-11-08','2/17: Supervisora cria o evento (clube normalizado): '+J(A));
    await pg.evaluate(()=>{ETERNA.state.cal.mes='2026-11';ETERNA.render();});await pg.click(`[data-act="ag-editar"][data-id="${A[0].id}"]`);await pg.fill('#ag-f-competicao','Copa do Brasil');await pg.click('[data-act="ag-salvar"]');await pg.waitForTimeout(100);
    A=await pg.evaluate(()=>Object.values(ETERNA.AGENDA));ok(A.length===1&&A[0].competicao==='Copa do Brasil','17: editar atualiza: '+J(A));
    await pg.evaluate(()=>{ETERNA.state.cal.mes='2026-11';ETERNA.render();});await pg.click(`tr [data-act="ag-apagar"][data-id="${A[0].id}"]`);ok(await pg.evaluate(()=>Object.keys(ETERNA.AGENDA).length===1),'17: apagar pede confirmação');
    await pg.click('[data-act="ag-apagar-ok"]');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>Object.keys(ETERNA.AGENDA).length===0),'17: apagado depois da confirmação');
    const log=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').map(e=>e.acao));ok(['agenda_criar','agenda_editar','agenda_apagar'].every(a=>log.includes(a)),'17: auditLog: '+J(log.slice(0,6)));
    // 18: CSV duas vezes, data inválida e <script>
    const csv='data;hora;tipo;mandante;visitante;competicao;obs\n08/11/2026;16:00;jogo;Flamengo;Palmeiras;Brasileirão;\n2026-11-12;21:30;jogo;Fluminense;Vasco;Carioca;<script>window.__xss=1</script>\n31/02/2026;10:00;jogo;Botafogo;Flamengo;Carioca;\n2026-11-20;;feriado;;;;Consciência Negra\n';
    for(let i=0;i<2;i++){await pg.setInputFiles('[data-act="ag-importar"]',{name:'agenda.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await pg.waitForTimeout(250);}
    const r=await pg.evaluate(()=>({n:Object.keys(ETERNA.AGENDA).length,res:document.getElementById('ag-res')&&document.getElementById('ag-res').textContent,obs:Object.values(ETERNA.AGENDA).map(a=>a.obs).join('|')}));
    ok(r.n===3,'18: importar o mesmo arquivo duas vezes não duplica: '+r.n);ok(/linha 4: data inválida/.test(r.res||''),'18: data inválida na lista de recusadas: '+r.res);
    await pg.evaluate(()=>{ETERNA.state.cal.mes='2026-11';ETERNA.render();});
    const x=await pg.evaluate(()=>({xss:window.__xss,scripts:document.querySelectorAll('#main script').length,txt:document.getElementById('main').textContent}));
    ok(!x.xss&&!x.scripts&&/scriptwindow.__xss=1\/script/.test(x.txt),'18: <script> aparece como texto: '+J({xss:x.xss,s:x.scripts}));
    // 19: feriados de 2026
    const f=await pg.evaluate(()=>{const n1=ETERNA.agFeriados(2026),n2=ETERNA.agFeriados(2026);const fs=Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='feriado');return {n1,n2,datas:fs.map(a=>a.data+' '+a.obs)};});
    ok(f.datas.some(d=>d.startsWith('2026-04-03 Sexta-feira Santa'))&&f.datas.some(d=>d.startsWith('2026-06-04 Corpus Christi'))&&f.n2===0&&f.datas.filter(d=>d.startsWith('2026-11-20')).length===1,'19: feriados com 03/04 e 04/06, sem duplicar: '+J(f));
    await ctx.close();}
  // 17: sem escala.u (Fotógrafo) não grava
  {const {ctx,pg}=await nova();await agente(ctx);await entrar(pg,'carlos@eterna.photo');
    const r=await pg.evaluate(()=>{ETERNA.state.view='calendario';ETERNA.render();const tem=!!document.querySelector('[data-act="ag-novo"]');document.body.insertAdjacentHTML('beforeend','<button id="fake" data-act="ag-feriados" data-y="2026"></button>');document.getElementById('fake').click();return {tem,n:Object.keys(ETERNA.AGENDA).length,t:document.getElementById('toast').textContent};});
    ok(!r.tem&&r.n===0&&/Sem permissão/.test(r.t),'17: sem escala.u não cria: '+J(r));
    // 8: presença no login e sessão vencida
    for(let i=0;i<40&&!AG.pres.length;i++)await pg.waitForTimeout(150);
    ok(AG.pres.length>=1,'8: login do fotógrafo marca presença');const p0=AG.pres[0]||{h:{},b:'{}'};const bd=JSON.parse(p0.b||'{}');
    ok(p0.h['x-eterna']==='1'&&bd.chave==='carlos'&&Object.keys(bd).every(k=>['chave','posto'].includes(k)),'5/8: presença manda só chave e posto (sem hora do navegador): '+p0.b);
    const marcado=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.presenca.v1')||'{}'));ok(marcado.carlos===HOJE,'8: dia marcado só depois do ok: '+J(marcado));
    const n0=AG.pres.length;await pg.evaluate(()=>ETERNA.presencaMarcar());await pg.waitForTimeout(100);ok(AG.pres.length===n0,'8: não marca de novo no mesmo dia');
    await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.session'));s.at=new Date(Date.parse(ETERNA.venueToday()+'T00:00:00-03:00')-60e3).toISOString(); /* ontem 23:59 no Rio: menos de 12 h, vence pela virada do dia */localStorage.setItem('eterna.session',JSON.stringify(s));localStorage.setItem('eterna.presenca.v1','{}');});
    await pg.clock.setFixedTime(new Date(HOJE+'T09:00:00-03:00')); // 9 h depois da sessão: só a virada do dia vence (a regra antiga é de 12 h)
    await pg.goto(U);await pg.waitForTimeout(600);const st=await pg.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view,p:localStorage.getItem('eterna.presenca.v1'),s:localStorage.getItem('eterna.session')}));
    ok(!st.u&&st.v==='entrar'&&st.p==='{}'&&!st.s,'8: sessão de ontem pede login de novo e nada é marcado: '+J(st));ok(AG.pres.length===n0,'8: sem presença enviada com a sessão vencida');
    await ctx.close();}
  // ---------- funções puras: 9, 10, 11, 12, 13, 14, 15, 20, 21 ----------
  {const {ctx,pg}=await nova();await entrar(pg,'eduardo@eduardorezende.com');
    const R=await pg.evaluate(()=>{const E=ETERNA;const ep=hm=>Date.parse('2026-11-04T'+hm+':00-03:00')/1000;const fs=[{k:'carlos',nome:'Carlos'}];
      const esc1={historico:[{desde:'2026-11-01',folgas:{carlos:[1,2]}}]};
      const a=E.esPresenca({dias:['2026-11-02','2026-11-04'],fotografos:fs,funcoes:{},escala:esc1,turnos:null,presencas:{'2026-11-02':{},'2026-11-04':{}},hoje:'2026-11-05'}).carlos;
      const at=hm=>E.esPresenca({dias:['2026-11-04'],fotografos:fs,funcoes:{},escala:null,turnos:{historico:[{desde:'2026-01-01',padrao:'09:00',tolerancia:10,por_ponto:{}}]},presencas:{'2026-11-04':{carlos:{primeiro:ep(hm),fonte:'login'}}},hoje:'2026-11-05'}).carlos.dias[0];
      const h2=E.cfgNovo({historico:[{desde:'2026-11-01',folgas:{carlos:[3]}}]},'2026-11-05',{folgas:{carlos:[1,2]}},'x');
      const b=E.esPresenca({dias:['2026-11-04','2026-11-11'],fotografos:fs,funcoes:{'2026-11-11':{carlos:{tipo:'folga'}}},escala:h2,turnos:null,presencas:{'2026-11-04':{},'2026-11-11':{}},hoje:'2026-11-12'}).carlos.dias.map(x=>x.estado);
      const vol=E.esPresenca({dias:['2026-11-04'],fotografos:fs,funcoes:{'2026-11-04':{carlos:{tipo:'campo',point:'p1'}}},escala:null,turnos:{historico:[{desde:'2026-01-01',padrao:'09:00',tolerancia:10,por_ponto:{p1:'10:00'}}]},presencas:{'2026-11-04':{carlos:{primeiro:ep('10:05'),fonte:'fotos'}}},hoje:'2026-11-05'}).carlos.dias[0];
      return {a:a.dias.map(x=>x.estado),fal:a.faltas,fol:a.folgas,a908:at('09:08'),a925:at('09:25'),b,vol};});
    ok(J(R.a)===J(['folga','falta'])&&R.fal===1&&R.fol===1,'9: folga fixa seg/ter: segunda folga, quarta falta: '+J(R.a));
    ok(R.a908.estado==='presente'&&R.a908.atraso===0&&R.a925.estado==='atraso'&&R.a925.atraso===25,'10: 09:08 não é atraso, 09:25 é 25 min: '+J([R.a908,R.a925]));
    ok(J(R.b)===J(['folga','folga']),'11: mudar a folga hoje não muda a quarta anterior (e a função do dia vale por cima): '+J(R.b));
    ok(R.vol.estado==='presente'&&R.vol.inicio==='10:00'&&R.vol.marca.fonte==='fotos','S10: turno do ponto da função do dia e marca pelas fotos: '+J(R.vol));
    const D=await pg.evaluate(([d1,d2,d3])=>{const E=ETERNA;const ds=[d1,d2,d3];const T=E.srvMetSoma(ds);const x=E.esDados(ds,{rover:false});
      const f=E.esFaixas({n:3,soma:470,f:[1,1,0,0,1,0,0]});
      return {fat:x.kpi.faturamento,srv:T.faturamento+T.online.faturamento,h10:x.horas[10].vendas,sab:x.semana[6],semDet:x.semDetalhe,prods:x.produtos.map(p=>p.id),f,idi:x.idiomas};},
      [dia('2026-10-31',{por_hora:{'10':{vendas:1,faturamento:220,sessoes:3,fotos:40}},vendas:1,faturamento:220,online:{}}),dia('2026-11-02'),dia('2026-11-03',{faturamento:1234.5})]);
    ok(Math.abs(D.fat-D.srv)<1e-6,'12: faturamento das Estatísticas = Servidor do ponto · todos os caixas: '+J([D.fat,D.srv]));
    ok(D.h10===7&&D.sab.vendas===1&&D.sab.dias===1,'13: venda das 10:40 de sábado na barra das 10 h e em Sáb: '+J([D.h10,D.sab]));
    ok(D.semDet.n===3&&!D.prods.includes('sem_detalhe'),'14: vendas sem detalhe ficam à parte: '+J(D.semDet));
    ok(D.f.n===3&&D.f.mediana==='30–60 s'&&D.f.p90==='5–10 min','15: mediana 30–60 s, p90 5–10 min, n 3: '+J(D.f));
    ok(D.idi.pt.vendas===9&&D.idi.es.vendas===3,'21: idioma só do por_idioma (Checkout): '+J(D.idi));
    const G=await pg.evaluate(()=>{const E=ETERNA;const ag={a1:{id:'ag_000000000001',data:'2026-11-01',tipo:'jogo',mandante:'fla'},a2:{id:'ag_000000000002',data:'2026-11-04',tipo:'jogo',mandante:'Flamengo'}};
      const dias=[['2026-11-01',1000],['2026-11-02',300],['2026-11-03',600],['2026-11-04',2000],['2026-11-05',900]].map(([d,f])=>({dia:d,faturamento:f,vendas:f/100,sessoes:10,sessoes_com_venda:2,lingT:0,lingO:0,entradas:null}));
      return E.esGrupoDia(dias,ag).filter(g=>g.grupo==='Jogo'||g.grupo==='Mandante').map(g=>[g.nome,g.n,g.poucos,g.faturamento,g.ticket]);});
    const gj=G.find(g=>g[0]==='Com jogo'),gs=G.find(g=>g[0]==='Sem jogo'),gm=G.find(g=>g[0]==='Flamengo');
    ok(gj&&gj[1]===2&&gj[2]===true&&gj[3]===1500&&gs&&gs[1]===3&&gs[2]===false&&gs[3]===600&&gm&&gm[1]===2,'20: grupos n=2 (poucos dias) e n=3 com as médias: '+J(G));
    // 3: dados da venda (pvDados): Checkout em espanhol com canal, cart e t0; balcão sem lang
    const P=await pg.evaluate(()=>{const E=ETERNA;E.state.lang='es';const t0=new Date(Date.now()-60e3).toISOString();const a=E.pvDados({card:'LP1',canal:'checkout',t0,cart:[{id:'tribuna'}],total:220});const b=E.pvDados({card:'LP2',canal:'balcao',cart:[{id:'arq'}],total:70});E.state.lang='pt';
      E.state.kiosk.step='review';E.state.kiosk.t0=null;E.state.view='quiosque';E.render();const t1=E.state.kiosk.t0;E.lojaReset();const t2=E.state.kiosk.t0;E.state.view='painel';E.render();return {a,b,t0,t1:!!t1,t2};});
    ok(P.a.lang==='es'&&P.a.canal==='checkout'&&P.a.t0===P.t0&&P.a.cart.length===1&&P.a.cart[0].id==='tribuna'&&P.a.cart[0].v>0,'3: Checkout manda lang, canal, cart e t0: '+J(P.a));
    ok(P.b.canal==='balcao'&&P.b.lang==null&&P.b.t0==null,'3: balcão com canal e sem lang: '+J(P.b));ok(P.t1&&P.t2==null,'3: t0 gravado ao sair da etapa code e zerado no lojaReset');
    await ctx.close();}
  // ---------- tela com o servidor: 12, 14, 21, 22, 23, 25, 27, folgas fixas e turnos ----------
  {const {ctx,pg}=await nova();await agente(ctx);AG.dias=[];for(let i=0;i<366;i++)AG.dias.push(dia(addD(HOJE,-i)));
    await entrar(pg,'eduardo@eduardorezende.com');await pg.waitForTimeout(500);
    await pg.evaluate(([de,ate])=>{const E=ETERNA;E.state.range={from:de,to:ate};E.state.es.sec='a';E.state.es.rover=false;E.go('estatisticas');},[addD(HOJE,-365),HOJE]);
    const tq=Date.now();for(let i=0;i<80&&!(await pg.evaluate(()=>(ETERNA.state.es.dias||[]).length===366));i++)await pg.waitForTimeout(100);medidas.carga_ms=Date.now()-tq; // espera o agente falso conectar e o /metricas/dia de 366 dias

    const m=await pg.evaluate(()=>{const E=ETERNA;const t={};for(const s of ['a','b','c','d','e','f']){E.state.es.sec=s;const t0=performance.now();E.render();t[s]=Math.round(performance.now()-t0);}E.state.es.sec='a';E.render();
      return {t,n:(E.state.es.dias||[]).length,kpi:document.querySelector('.pn-kpi[data-k="fat"] .pn-big').textContent,semdet:(document.querySelector('.es-semdet')||{}).textContent||''};});
    medidas.render_ms=m.t;ok(m.n===366,'27: 366 dias carregados: '+m.n);ok(Math.max(...Object.values(m.t))<300,'27: cada seção desenha em menos de 300 ms: '+J(m.t));
    ok(/366 vendas sem detalhe de produto \(antes da v92\)/.test(m.semdet),'14: nota sem detalhe: '+m.semdet);
    const esperado=366*(1000+39);ok(m.kpi.replace(/\D/g,'')===String(esperado),'12: KPI de faturamento = servidor: '+m.kpi);
    // e) visitantes
    await pg.click('[data-act="es-sec"][data-s="e"]');const te=await pg.textContent('#main');ok(/Português/.test(te)&&/Outras línguas \(provável estrangeiro\)/.test(te),'21: rótulos de idioma');
    // b) fotógrafos: tabela ordenável e dia a dia
    await pg.click('[data-act="es-sec"][data-s="b"]');await pg.click('[data-act="es-ord"][data-c="nome"]');await pg.click('.es-link[data-k="carlos"]');await pg.waitForTimeout(80);
    const tb=await pg.textContent('#main');ok(/Presença pelo login e pelas fotos no Eterna\. Não substitui o ponto oficial\./.test(tb)&&/Carlos · dia a dia/.test(tb),'b: texto S2 e dia a dia');
    // f) movimento sem dados, com import, CSV com colunas extras (23)
    await pg.click('[data-act="es-sec"][data-s="f"]');await pg.waitForTimeout(150);let tf=await pg.textContent('#main');
    ok(/Sem dados de entrada ainda\. Quando chegar o arquivo do bip ou das catracas, importe aqui\./.test(tf)&&await pg.$('[data-act="es-importar"]')&&await pg.$('.es-out'),'22: aviso, botão de importar e retrato de outubro à parte');
    const semC=await pg.evaluate(()=>{const u=ETERNA.state.user;const o=u.perms.estatisticas.c;u.perms.estatisticas.c=false;ETERNA.render();const tem=!!document.querySelector('[data-act="es-importar"]');u.perms.estatisticas.c=o;ETERNA.render();return tem;});
    ok(!semC,'22: sem estatisticas.c não aparece o botão de importar');
    const ontem=addD(HOJE,-1);const [y,mo,dd]=ontem.split('-');
    const csv=['data_hora;origem;ingresso;cpf',...Array.from({length:9},(_,i)=>`${dd}/${mo}/${y} 10:41:0${i};bip;ING-99887${i};123.456.789-0${i}`),`${ontem} 09:01:00;bip;ING-1;111.222.333-44`,`31/02/2026 10:00:00;bip;ING-2;555.666.777-88`].join('\n');
    await pg.setInputFiles('[data-act="es-importar"]',{name:'bilheteria.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await pg.waitForTimeout(500);
    const env=AG.ent.map(e=>e.raw).join('\n');const corpo=AG.ent[0]?JSON.parse(AG.ent[0].raw):{};
    ok(AG.ent.length===1&&Object.keys(corpo).sort().join()==='arquivo,dia,origem,por,seg'&&!/ING-|\d{3}\.\d{3}\.\d{3}-\d{2}|cpf|ingresso/i.test(env)&&AG.ent[0].h['x-eterna']==='1','23: só origem, dia e segundos (com arquivo e por) saem do navegador: '+env.slice(0,200));
    ok(corpo.seg&&corpo.seg.length===10&&corpo.dia===ontem,'23: 10 entradas do dia certo: '+J(corpo.seg));
    const res=await pg.evaluate(()=>(document.getElementById('es-imp-res')||{}).textContent||'');ok(/10 entradas aceitas/.test(res)&&/linha 12: data_hora inválida/.test(res),'23: resumo com as recusadas: '+res);
    await pg.setInputFiles('[data-act="es-importar"]',{name:'bilheteria.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await pg.waitForTimeout(400);ok(AG.ent.length===2&&AG.ent[1].raw===AG.ent[0].raw,'24: o mesmo arquivo manda o mesmo dia de novo (o agente substitui)');
    // 25: pico na tela
    AG.dias[1]=dia(ontem,{entradas:{fonte:'bip',total:812,por_origem:{bip:812},por_hora:{'09':95,'10':300},pico_min:{hhmm:'10:41',n:9},pico_15:{hhmm:'10:30',n:88},primeira:'09:01',ultima:'16:58',minutos:478,media_min:1.7}});
    await pg.evaluate(()=>{ETERNA.state.es.chave=null;ETERNA.esPull(true);});await pg.waitForTimeout(600);tf=await pg.textContent('#main');
    ok(/pico 10:41, 9 pessoas/.test(tf)&&/Funil/.test(tf)&&/Últimas importações/.test(tf)&&/bilheteria\.csv/.test(tf),'25: pico 10:41, 9 pessoas e importações: '+tf.slice(0,160));
    // folgas fixas (Escala) e horário dos turnos (Painel de controle)
    await pg.evaluate(()=>ETERNA.go('escala'));await pg.click('[data-act="folga-fixa"][data-k="carlos"][data-d="1"]');await pg.click('[data-act="folga-fixa"][data-k="carlos"][data-d="2"]');
    const ec=await pg.evaluate(()=>({c:ETERNA.ESC_CFG,log:JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>e.acao==='folga_fixa').length}));
    const ult=ec.c&&ec.c.historico[ec.c.historico.length-1];ok(ult&&ult.desde===HOJE&&J(ult.folgas.carlos)===J([1,2])&&ec.c.historico.length===1&&ec.log===2,'9/11: folgas fixas gravadas com desde = hoje e auditLog: '+J(ec));
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.fill('#turno-padrao','08:30');await pg.fill('#turno-tol','15');await pg.click('[data-act="turno-salvar"]');
    const tc=await pg.evaluate(()=>ETERNA.TURNOS_CFG);ok(tc&&tc.historico[0].padrao==='08:30'&&tc.historico[0].tolerancia===15,'turnos: Admin salva o horário: '+J(tc));
    ok(await pg.$('#main [data-act="view"][data-v="calendario"]'),'D3: atalho do Calendário no Painel de controle');
    await ctx.close();}
  // turnos: Supervisor só vê
  {const {ctx,pg}=await nova();await agente(ctx);await entrar(pg,'supervisor@eterna.photo');const r=await pg.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();return {btn:!!document.querySelector('[data-act="turno-salvar"]'),dis:document.getElementById('turno-padrao').disabled};});
    ok(!r.btn&&r.dis,'S8: horário dos turnos só com catalogo.u');await ctx.close();}
}catch(e){fails.push('exceção: '+String(e&&e.stack||e).slice(0,600));}
await b.close();
const e2=errs.filter(x=>!/Failed to fetch|NetworkError/.test(x));
const okAll=!fails.length&&!e2.length;
console.log(`${okAll?'OK':'FALHA'} estatisticas: critérios 1 a 3, 8 a 15, 17 a 25, 27 e 28 (v92) · render ${J(medidas.render_ms||{})}${fails.length?' · '+fails.join(' | '):''}${e2.length?' · erros: '+e2.slice(0,3).join(' | '):''}`);
process.exit(okAll?0:1);})();
