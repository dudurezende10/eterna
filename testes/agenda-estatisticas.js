// v97: Calendário que se preenche sozinho, fonte dos jogos (chave da API-Football em Configurações › Painel de controle, Eduardo 10/11) e Estatísticas › Jogos e ano a ano
// (plano docs/planos/2026-11-10-agenda-estatisticas.md, critérios 2, 6 (tela), 8 a 10, 18 a 20 e os da chave pela tela;
// os do agente estão em testes/agenda_agente.py). Agente falso (page.route na própria origem), chave falsa, dados sintéticos.
// Com SHOTS=<pasta>, grava os prints agenda-*.png.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const SHOTS=process.env.SHOTS||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const CHAVE='FalsaChaveDoTeste0000000000wxyz';
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const ANO=+HOJE.slice(0,4);const menos1=iso=>{const a=(+iso.slice(0,4)-1)+iso.slice(4);return addD(a,0)===a?a:addD((+iso.slice(0,4)-1)+'-03-01',-1);};
// feriados do agente (o mesmo cálculo do servidor), para o critério 2 e para o calendário dos prints
const AGT=path.join(__dirname,'..','agente','eterna-agente.py');const HTMP=fs.mkdtempSync(path.join(os.tmpdir(),'agenda-'));
const FER=JSON.parse(execFileSync('python3',['-I','-c',`import importlib.util,json,sys
sp=importlib.util.spec_from_file_location('ag',sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
print(json.dumps({str(a):m.feriados_de(a) for a in range(2026,2036)}))`,AGT],{env:Object.assign({},process.env,{HOME:HTMP,USERPROFILE:HTMP,ETERNA_SEM_OPENCV:'1'}),stdio:['ignore','pipe','ignore']}).toString().trim().split('\n').pop());
fs.rmSync(HTMP,{recursive:true,force:true});
const agid=n=>'ag_'+require('crypto').createHash('sha1').update(n).digest('hex').slice(0,12);
// agenda do servidor: feriados de 2026 e 2027 e 3 jogos automáticos
function agendaSrv(){const docs=[];['2026','2027'].forEach(a=>FER[a].forEach(([data,nome])=>{const id=agid('feriado|'+data);docs.push({id,valor:{id,data,hora:'',tipo:'feriado',mandante:'',visitante:'',competicao:'',obs:nome,origem:'feriados',por:'Eterna',em:'2026-11-10T09:00:00Z'}});}));
  [[1501,HOJE.slice(0,8)+'08','16:00','Flamengo','Palmeiras','Brasileirão Série A'],[1502,HOJE.slice(0,8)+'19','21:30','Fluminense','Vasco da Gama','Brasileirão Série A'],[1503,HOJE.slice(0,8)+'26','19:00','Botafogo','Flamengo','Copa do Brasil']].forEach(([f,data,hora,m,v,c])=>{const id=agid('af|'+f);
    docs.push({id,valor:{id,data,hora,tipo:'jogo',mandante:m,visitante:v,competicao:c,obs:'',origem:'api',por:'Eterna',em:'2026-11-10T09:00:00Z',ext:'af:'+f}});});
  const id='ag_00000000000a';docs.push({id,valor:{id,data:HOJE.slice(0,8)+'22',hora:'20:00',tipo:'show',mandante:'',visitante:'',competicao:'',obs:'Show no gramado',origem:'manual',por:'Supervisora',em:'2026-11-10T09:00:00Z'}});return docs;}
// série diária sintética: últimos 28 dias (3 jogos no mesmo dia da semana, o resto normal), os mesmos 28 dias do ano anterior e um janeiro só no ano anterior
function serie(){const A=[],B=[];const jogos=new Set([addD(HOJE,-7),addD(HOJE,-14),addD(HOJE,-21)]);
  for(let i=27;i>=0;i--){const d=addD(HOJE,-i);const j=jogos.has(d);const x={dia:d,tipo:j?'jogo':'normal',marcas:{jogo:+j,vespera:0,feriado:0,show:0,fechado:0,fds:0},eventos:j?['Jogo · Flamengo × Palmeiras · Brasileirão']:[],fonte_vendas:'eterna',vendas:j?15:10,receita:j?3000:2000,fotos:j?700:500,sessoes:j?120:100,sessoes_com_venda:j?15:10,entradas:j?1650:1100,entradas_fonte:'bip',clima:null};
    if(i===3)x.eventos=['=1+1'];(+d.slice(0,4)===ANO?A:B).push(x);
    const p=menos1(d);(+p.slice(0,4)===ANO?A:B).push({dia:p,tipo:'normal',marcas:{jogo:0,vespera:0,feriado:0,show:0,fechado:0,fds:0},eventos:[],fonte_vendas:'roverpix',vendas:8,receita:1500,fotos:400,sessoes:90,sessoes_com_venda:8,entradas:1000,entradas_fonte:'bilheteria',clima:null});}
  B.push({dia:(ANO-1)+'-01-15',tipo:'normal',marcas:{},eventos:[],fonte_vendas:'roverpix',vendas:5,receita:900,fotos:200,sessoes:50,sessoes_com_venda:5,entradas:null,entradas_fonte:null,clima:null});
  return {[ANO]:A.sort((a,b)=>a.dia.localeCompare(b.dia)),[ANO-1]:B.sort((a,b)=>a.dia.localeCompare(b.dia))};}
(async()=>{
const b=await chromium.launch();const errs=[];
const nova=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1440,height:h||1000},locale:'pt-BR',acceptDownloads:true});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>{localStorage.removeItem('eterna.session');});await pg.goto(U);await pg.waitForTimeout(350);}
  await require('./_entrar')(pg,email);return pg.evaluate(()=>!!ETERNA.state.user);};
// agente falso
async function agente(ctx,o){o=o||{};const AG={fonte:[],testar:0,atualizar:0,totais:[],chave:!!o.chave};const S=serie();
  const st=()=>({ok:true,feriados_ate:2027,jogos:AG.chave?{fonte:'api-football',chave:true,env:false,final:CHAVE.slice(-4),salva_em:'2026-11-10T19:05:00Z',salva_por:'Eduardo Rezende',ultima:'2026-11-10T19:06:00Z',ok:true,erro:null,n_por_ano:{[ANO]:34},ja_no_calendario:1,teste:AG.teste||null,rodando:false}:{fonte:'nenhuma',chave:false,ultima:null,ok:null,erro:null,n_por_ano:{},ja_no_calendario:0,teste:null},dias:{desde:'2026-11-10'}});
  const js=(r,x,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(x)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'b97',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},estatisticas:{v:2,migracao:{estado:'feita'}},agenda:{feriados_ate:2027,jogos:{fonte:AG.chave?'api-football':'nenhuma',chave:AG.chave}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{agenda:5}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>{if(r.request().method()==='POST')return js(r,{ok:true,gravados:1});const col=new URL(r.request().url()).searchParams.get('col');js(r,{ok:true,rev:col==='agenda'?5:0,docs:col==='agenda'&&o.agenda?agendaSrv():[]});});
  await ctx.route(ORIG+'/metricas/dia*',r=>js(r,{ok:true,dias:[]}));
  await ctx.route(ORIG+'/ponto/entradas/importacoes',r=>js(r,{ok:true,importacoes:[]}));
  await ctx.route(ORIG+'/ponto/entradas/totais',r=>{const bd=JSON.parse(r.request().postData()||'{}');AG.totais.push({h:r.request().headers(),bd});js(r,{ok:true,aceitos:bd.dias.length,recusados:[],importacao:'imp_x'});});
  await ctx.route(ORIG+'/agenda/status',r=>js(r,st()));
  await ctx.route(ORIG+'/agenda/atualizar',r=>{AG.atualizar++;AG.hAt=r.request().headers();js(r,{ok:true,ja_rodando:false});});
  await ctx.route(ORIG+'/agenda/testar',r=>{AG.testar++;AG.teste={em:'2026-11-10T19:07:00Z',ok:true,temporada:ANO,n:34,erro:null};js(r,AG.teste);});
  await ctx.route(ORIG+'/agenda/fonte',r=>{const bd=JSON.parse(r.request().postData()||'{}');AG.fonte.push({h:r.request().headers(),bd});
    if(bd.acao==='salvar'){AG.chave=true;return js(r,{ok:true,chave:true,final:String(bd.chave).slice(-4)});}if(bd.acao==='remover'){AG.chave=false;return js(r,{ok:true,chave:false});}js(r,{error:'x'},400);});
  await ctx.route(ORIG+'/estatisticas/dias*',r=>{const a=+new URL(r.request().url()).searchParams.get('ano');js(r,{ok:true,ano:a,desde:'2026-11-10',calc_em:'2026-11-10T19:00:00Z',dias:S[a]||[]});});
  return AG;}
const ligado=pg=>pg.waitForFunction(()=>ETERNA.state.agent.on&&ETERNA.state.db&&ETERNA.state.db.agente,null,{timeout:8000}).catch(()=>{});
try{
  // ---------- 2: feriados do agente e do app iguais de 2026 a 2035 ----------
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    const app=await pg.evaluate(()=>{const o={};for(let a=2026;a<=2035;a++)o[a]=ETERNA.feriadosDe(a);return o;});
    ok(J(app)===J(FER),'2: feriados_de do agente e feriadosDe do app iguais de 2026 a 2035');await ctx.close();}
  // ---------- 8: sem servidor ----------
  {const {ctx,pg}=await nova();await entrar(pg,'eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(200);
    const r=await pg.evaluate(()=>({sem:!!document.getElementById('ag-sem-servidor'),fer:!!document.querySelector('[data-act="ag-feriados"]')}));
    ok(r.sem&&r.fer,'8: sem servidor aparece o aviso e o botão de feriados fica: '+J(r));
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(150);const fb=await pg.evaluate(()=>(document.getElementById('ag-fontes-bloco')||{}).textContent||'');
    ok(/servidor do ponto/.test(fb)&&!(await pg.$('#ag-chave')),'chave: sem servidor o painel não mostra o campo da chave');
    await pg.evaluate(()=>{ETERNA.state.es.sec='g';ETERNA.go('estatisticas');});await pg.waitForTimeout(200);ok(!!(await pg.$('#es-g-sem')),'18: Jogos e ano a ano sem servidor mostra o aviso');
    await ctx.close();}
  // ---------- 8, 6, 9 e chave: Admin com servidor, sem chave ----------
  {const {ctx,pg}=await nova();const AG=await agente(ctx,{agenda:true});await entrar(pg,'eduardo@eduardorezende.com');await ligado(pg);
    await pg.evaluate(()=>{ETERNA.state.cal.mes=null;ETERNA.go('calendario');});await pg.waitForSelector('#ag-fontes',{timeout:5000}).catch(()=>{});await pg.waitForTimeout(400);
    let r=await pg.evaluate(()=>({sem:!!document.getElementById('ag-sem-servidor'),f:(document.getElementById('ag-fontes')||{}).textContent||'',at:!!document.querySelector('[data-act="ag-atualizar"]'),fer:!!document.querySelector('[data-act="ag-feriados"]'),bl:!!document.getElementById('ag-fontes-bloco'),ch:!!document.getElementById('ag-chave'),n:Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='feriado').length}));
    ok(!r.sem&&/Feriados automáticos até 2027/.test(r.f)&&/fonte não configurada, peça ao Admin/.test(r.f),'8/6: com servidor, sem aviso e com a linha das fontes: '+J(r));
    ok(!r.at&&!r.fer,'6: sem chave não aparece "Atualizar jogos agora"; com servidor some o botão manual de feriados: '+J(r));
    ok(!r.bl&&!r.ch&&r.n===30,'chave: o Calendário não tem a chave (Eduardo, 10/11); tem os 30 feriados do servidor: '+J(r));
    const lin=await pg.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(t=>t.textContent).join('\n'));ok(/Automático · jogos/.test(lin)&&/Automático · feriados/.test(lin),'origem dos automáticos na lista do mês');
    if(SHOTS){await pg.screenshot({path:path.join(SHOTS,'agenda-calendario.png'),fullPage:true});}
    // chave: salvar, em Configurações › Painel de controle, logo abaixo do painel Checkout
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForSelector('#ag-chave',{timeout:5000}).catch(()=>{});
    ok(await pg.evaluate(()=>{const ps=[...document.querySelectorAll('#main .panel')];const i=ps.findIndex(p=>/^Checkout/.test((p.querySelector('h2')||{}).textContent||''));return i>=0&&ps[i+1]&&ps[i+1].id==='ag-fontes-bloco'&&/Calendário de eventos · fonte dos jogos/.test(ps[i+1].textContent);}),'chave: painel "Calendário de eventos · fonte dos jogos" logo abaixo do Checkout');
    await pg.fill('#ag-chave',CHAVE);await pg.click('[data-act="ag-chave-salvar"]');await pg.waitForTimeout(700);
    const fz=AG.fonte[0]||{};ok(fz.bd&&fz.bd.chave===CHAVE&&fz.bd.acao==='salvar'&&fz.bd.quem==='eduardo@eduardorezende.com'&&fz.h['x-eterna']==='1','chave: o POST leva a chave, o e-mail do Admin e X-Eterna: '+J(fz.bd&&{acao:fz.bd.acao,quem:fz.bd.quem}));
    r=await pg.evaluate(k=>({st:(document.getElementById('ag-chave-st')||{}).textContent||'',campo:!!document.getElementById('ag-chave'),ls:Object.keys(localStorage).some(x=>String(localStorage.getItem(x)).includes(k)),ss:Object.keys(sessionStorage).some(x=>String(sessionStorage.getItem(x)).includes(k)),
      sim:JSON.stringify(ETERNA.SIM).includes(k),cal:JSON.stringify(Object.assign({},ETERNA.state.cal)).includes(k),html:document.documentElement.outerHTML.includes(k),log:ETERNA.auditRead().filter(e=>/agenda_chave/.test(e.acao)).map(e=>e.acao),logk:JSON.stringify(ETERNA.auditRead()).includes(k.slice(-4))}),CHAVE);
    ok(/Chave configurada/.test(r.st)&&r.st.includes('····'+CHAVE.slice(-4))&&!r.campo,'chave: a tela mostra só "Chave configurada ····"+4 últimos: '+J(r.st));
    ok(!r.ls&&!r.ss&&!r.sim&&!r.cal&&!r.html,'chave: a chave não fica no localStorage, sessionStorage, SIM, state nem na página: '+J(r));
    ok(J(r.log)===J(['agenda_chave_salvar'])&&!r.logk,'chave: salvar no registro de auditoria, sem a chave: '+J(r.log));
    await pg.click('[data-act="ag-chave-testar"]');await pg.waitForTimeout(500);ok(AG.testar===1&&/34 jogos no Maracanã/.test(await pg.textContent('#ag-teste')),'chave: Testar agora mostra o resultado');
    if(SHOTS){await pg.evaluate(()=>document.getElementById('ag-fontes-bloco').scrollIntoView({block:'center'}));await pg.screenshot({path:path.join(SHOTS,'agenda-fontes.png')});}
    await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(300);
    r=await pg.evaluate(()=>({at:!!document.querySelector('[data-act="ag-atualizar"]'),f:(document.getElementById('ag-fontes')||{}).textContent||''}));ok(r.at&&/atualizados em/.test(r.f)&&/34 em/.test(r.f),'6: com chave aparece "Atualizar jogos agora" e a linha dos jogos: '+J(r));
    await pg.click('[data-act="ag-atualizar"]');await pg.waitForTimeout(300);ok(AG.atualizar===1&&AG.hAt['x-eterna']==='1','Atualizar jogos agora manda o POST com X-Eterna');
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(200);
    // trocar e remover
    await pg.click('[data-act="ag-chave-trocar"]');await pg.waitForTimeout(100);await pg.fill('#ag-chave','OutraChaveFalsa0000000000000abcd');await pg.click('[data-act="ag-chave-salvar"]');await pg.waitForTimeout(500);
    await pg.click('[data-act="ag-chave-remover"]');await pg.waitForTimeout(100);ok(!!(await pg.$('#ag-chave-conf')),'chave: Remover pede confirmação');await pg.click('[data-act="ag-chave-remover-ok"]');await pg.waitForTimeout(500);
    r=await pg.evaluate(()=>({log:ETERNA.auditRead().filter(e=>/agenda_chave/.test(e.acao)).map(e=>e.acao),campo:!!document.getElementById('ag-chave')}));
    ok(J(r.log.slice(0,3))===J(['agenda_chave_remover','agenda_chave_trocar','agenda_chave_salvar'])&&r.campo,'chave: trocar e remover no registro; depois de remover volta o campo: '+J(r.log));
    await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(200);
    // 9: colar lista do Google Sheets (TAB)
    const txt=[HOJE.slice(0,8)+'05\t16:00\tjogo\tfla\tPalmeiras\tBrasileirão',`${HOJE.slice(8,10)}/${HOJE.slice(5,7)}/${ANO}\t\tshow\t\t\t\tShow de teste`,'2026-12-01\t19:00\tevento\t\t\t\tFeira','31/02/2026\t10:00\tjogo\tBotafogo\tVasco\tCarioca'].join('\n');
    await pg.click('[data-act="ag-colar"]');await pg.fill('#ag-colar-txt',txt);await pg.click('[data-act="ag-colar-ok"]');await pg.waitForTimeout(200);
    let res=await pg.textContent('#ag-res');ok(/3 novos/.test(res)&&/linha 4: data inválida/.test(res),'9: colar 3 linhas com TAB cria 3 e lista a data inválida: '+res);
    await pg.click('[data-act="ag-colar"]');await pg.fill('#ag-colar-txt',txt);await pg.click('[data-act="ag-colar-ok"]');await pg.waitForTimeout(200);
    res=await pg.textContent('#ag-res');ok(/0 novos/.test(res)&&/3 já iguais/.test(res),'9: colar de novo dá 3 iguais: '+res);
    // risco 4: jogo automático com a data mudada vira manual; editado só na hora fica automático com o nome da pessoa
    r=await pg.evaluate(id=>{const E=ETERNA;E.state.cal.form={id};E.render();document.getElementById('ag-f-hora').value='18:00';document.querySelector('[data-act="ag-salvar"]').click();const a=E.AGENDA[id];
      E.state.cal.form={id};E.render();document.getElementById('ag-f-data').value=a.data.slice(0,8)+'09';document.querySelector('[data-act="ag-salvar"]').click();const b=E.AGENDA[id];return {a:{o:a.origem,p:a.por,ext:a.ext,h:a.hora},b:{o:b.origem,ext:b.ext||null}};},agid('af|1501'));
    ok(r.a.o==='api'&&r.a.p==='Eduardo Rezende'&&r.a.ext==='af:1501'&&r.a.h==='18:00'&&r.b.o==='manual'&&r.b.ext===null,'risco 4: editar a hora mantém automático com o nome; mudar a data vira manual: '+J(r));
    await ctx.close();}
  // ---------- 10: Supervisora e Atendimento ----------
  {const {ctx,pg}=await nova();const AG=await agente(ctx,{chave:true});await entrar(pg,'supervisor@eterna.photo');await ligado(pg);await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(600);
    const r=await pg.evaluate(()=>({col:!!document.querySelector('[data-act="ag-colar"]'),at:!!document.querySelector('[data-act="ag-atualizar"]'),bl:!!document.getElementById('ag-fontes-bloco'),ch:!!document.getElementById('ag-chave')}));
    ok(r.col&&r.at,'10: Supervisora vê Colar lista e Atualizar jogos: '+J(r));ok(!r.bl&&!r.ch,'chave: o Calendário não mostra a chave a quem edita o calendário: '+J(r));
    await pg.click('[data-act="ag-colar"]');await pg.fill('#ag-colar-txt','2026-12-02;20:00;show;;;;Show');await pg.click('[data-act="ag-colar-ok"]');await pg.waitForTimeout(150);ok(/1 novos/.test(await pg.textContent('#ag-res')),'10: Supervisora usa Colar lista');
    // quem altera Configurações vê o painel (a Supervisora tem configuracao.u); quem só lê Configurações não vê nem consegue mandar
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(300);ok(!!(await pg.$('#ag-fontes-bloco')),'chave: quem altera Configurações vê o painel da fonte dos jogos');
    const t=await pg.evaluate(()=>{const E=ETERNA;const u=JSON.parse(JSON.stringify(E.state.user));u.perms.configuracao={c:false,r:true,u:false,d:false};E.state.user=u;const vazio=E.agBlocoFontes()==='';E.render();const tem=!!document.getElementById('ag-fontes-bloco');
      document.body.insertAdjacentHTML('beforeend','<input id="ag-chave2" value="x"><button id="fk" data-act="ag-chave-salvar"></button>');document.getElementById('fk').click();return new Promise(ok=>setTimeout(()=>ok({vazio,tem,t:document.getElementById('toast').textContent}),300));});
    ok(AG.fonte.length===0&&t.vazio&&!t.tem&&/Sem permissão/.test(t.t),'chave: quem só lê Configurações não vê o painel nem manda a chave: '+J(t));
    await ctx.close();}
  {const {ctx,pg}=await nova();await agente(ctx,{chave:true});await entrar(pg,'loja@eterna.photo');
    const r=await pg.evaluate(()=>{const n=Object.keys(ETERNA.AGENDA).length;document.body.insertAdjacentHTML('beforeend','<textarea id="ag-colar-txt">2026-12-03;20:00;show;;;;X</textarea><button id="fk" data-act="ag-colar-ok"></button>');document.getElementById('fk').click();
      return {can:ETERNA.canView('calendario'),n0:n,n:Object.keys(ETERNA.AGENDA).length,t:document.getElementById('toast').textContent};});
    ok(!r.can&&r.n===r.n0&&/Sem permissão/.test(r.t),'10: Atendimento e venda não vê o calendário e ag-colar-ok é barrado pelo guardAct: '+J(r));await ctx.close();}
  // ---------- 18, 19, 20: Jogos e ano a ano ----------
  {const {ctx,pg}=await nova();await agente(ctx);await entrar(pg,'eduardo@eduardorezende.com');await ligado(pg);
    await pg.evaluate(()=>{ETERNA.state.es.sec='g';ETERNA.go('estatisticas');});await pg.waitForSelector('#es-tend',{timeout:6000}).catch(()=>{});await pg.waitForTimeout(300);
    const S=serie();const A=S[ANO];const cur=A.filter(d=>d.dia>=addD(HOJE,-27));const m=(cur.reduce((s,d)=>s+d.entradas,0)+S[ANO-1].filter(d=>d.dia>=addD(HOJE,-27)).reduce((s,d)=>s+d.entradas,0))/28; // janela pode cruzar o ano
    const esperado=Math.round(Math.abs(100*(m-1000)/1000));
    const r=await pg.evaluate(()=>({tend:(document.getElementById('es-tend')||{}).textContent||'',cards:[...document.querySelectorAll('.es-g-card')].map(c=>c.textContent.replace(/\s+/g,' ')),par:(document.getElementById('es-pareado')||{}).textContent||'',main:document.getElementById('main').textContent,chips:[...document.querySelectorAll('[data-act="es-sec"]')].map(x=>x.dataset.s)}));
    ok(new RegExp('subindo '+esperado+'%').test(r.tend)&&/contra os mesmos 28 dias de/.test(r.tend),'18: faixa "subindo '+esperado+'%" contra o ano anterior: '+r.tend);
    ok(r.cards.length===2&&/Visitantes por dia\s*1\.650/.test(r.cards[0])&&/Vendas por dia\s*15/.test(r.cards[0])&&/Conversão\s*12,5%/.test(r.cards[0])&&/R\$\s?3\.000/.test(r.cards[0]),'18: cartão do dia de jogo com as médias: '+r.cards[0]);
    ok(/Visitantes por dia\s*1\.100/.test(r.cards[1])&&/Vendas por dia\s*10/.test(r.cards[1])&&/Conversão\s*10%/.test(r.cards[1])&&/R\$\s?2\.000/.test(r.cards[1]),'18: cartão do dia normal: '+r.cards[1]);
    ok(/50% mais visitantes e 50% mais vendas/.test(r.par)&&/3 jogos/.test(r.par),'18: esPareado no mesmo dia da semana: '+r.par);
    ok(r.chips.includes('g'),'Admin vê a seção Jogos e ano a ano');
    const P=await pg.evaluate(([A,B])=>{const E=ETERNA;const L=E.esDiasLimpa(A),M=E.esDiasLimpa(B);const mm=E.esMesAMes(L,M);return {jan:mm[0],pt:E.esPorTipo(L).map(x=>[x.tipo,x.dias,x.poucos]),
      pou:E.esTendencia(L.slice(-5),L[L.length-1].dia),per:E.esTendencia(L,L[L.length-1].dia)};},[S[ANO],S[ANO-1]]);
    ok(P.jan.var.vendas===null&&P.jan.b.vendas===5&&P.jan.a.vendas===null,'18: mês a mês sem dado no ano escolhido fica sem variação (nunca 0%): '+J(P.jan));
    ok(P.pt.some(x=>x[0]==='jogo'&&x[1]===3&&x[2]===false),'18: por tipo do dia: '+J(P.pt));ok(P.pou.poucos===true,'18: menos de 14 dias com visitantes = poucos');
    if(SHOTS){await pg.screenshot({path:path.join(SHOTS,'agenda-jogos-ano-a-ano.png'),fullPage:true});}
    // 20: CSV
    const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}),pg.click('[data-act="es-dias-csv"]')]);const csv=fs.readFileSync(await dl.path(),'utf8').replace(/^﻿/,'');const L=csv.split('\n');
    ok(L.length===A.length+1&&L[0]==='dia;tipo;eventos;visitantes;fonte_visitantes;vendas;fotos;sessoes;sessoes_com_venda;fonte_vendas;receita','20/19: uma linha por dia, ; e coluna receita para o Admin: '+L[0]+' · '+L.length);
    ok(L.some(l=>l.includes(";'=1+1;")),'20: evento =1+1 sai como \'=1+1');
    // 19: quem não é Admin não vê R$
    const nr=await pg.evaluate(()=>{const E=ETERNA;const u=E.state.user;const sup=JSON.parse(JSON.stringify(E.USERS['supervisor@eterna.photo']));sup.perms.estatisticas={c:false,r:true,u:false,d:false};E.state.user=sup;
      const html=E.esSecG();const csv=E.esDiasCSV(E.state.es.anos[+E.venueToday().slice(0,4)].dias,false);E.state.es.sec='g';E.render();const v={html:/R\$/.test(html),csv:csv.split('\n')[0],sec:E.state.es.sec,chips:[...document.querySelectorAll('[data-act="es-sec"]')].map(x=>x.dataset.s)};E.state.user=u;E.render();return v;});
    ok(!nr.html&&!/receita/.test(nr.csv),'19: sem Admin, nenhum R$ na seção e o CSV sem receita: '+J(nr));
    ok(await pg.evaluate(()=>{const E=ETERNA;const u=E.state.user;const sup=JSON.parse(JSON.stringify(E.USERS['supervisor@eterna.photo']));sup.perms.estatisticas={c:false,r:true,u:false,d:false};E.state.user=sup;const s=E.esSecoes().map(x=>x[0]);E.state.user=u;return !s.includes('g')&&s.includes('a');}),'5 (Eduardo): a seção Jogos e ano a ano é só do Admin');
    // f: total por dia (bilheteria)
    await pg.evaluate(()=>{ETERNA.state.es.sec='f';ETERNA.go('estatisticas');});await pg.waitForTimeout(150);
    const AGt=await (async()=>{await pg.setInputFiles('[data-act="es-importar-totais"]',{name:'visitantes.csv',mimeType:'text/csv',buffer:Buffer.from('dia;total\n02/11/2026;1.830\n2026-11-03;1500\n31/02/2026;10\n2026-11-04;-5\n')});await pg.waitForTimeout(500);return pg.textContent('#es-tot-res').catch(()=>'');})();
    ok(/2 dias aceitos/.test(AGt)&&/2 linhas recusadas/.test(AGt),'f: total por dia importado com as recusadas: '+AGt);
    await ctx.close();}
}catch(e){fails.push('exceção: '+e.message.split('\n')[0]);}
await b.close();
const errosV=errs.filter(e=>!/eterna\.photo|ERR_|status of 404/.test(e));if(errosV.length)fails.push('erros de JavaScript: '+errosV.slice(0,3).join(' | '));
console.log(`${fails.length?'FALHA':'OK'} agenda-estatisticas${fails.length?': '+fails.slice(0,8).join(' · '):': feriados iguais, aviso sem servidor, fontes, chave pela tela, Colar lista, permissões e Jogos e ano a ano'}`);process.exit(fails.length?1:0);})();
