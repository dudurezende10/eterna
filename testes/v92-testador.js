// v92, testador: Estatísticas e Calendário de ponta a ponta com o agente de verdade (HOME temporário), o app aberto pelo
// agente (ETERNA_APP_ORIGIN = servidor do rodar.sh). Plano docs/planos/2026-11-05-estatisticas.md.
// Checkout em espanhol pela tela (critério 3) e confirmação no Caixa; balcão em inglês; resumo v2 no /metricas/dia
// (idioma, canal, produto, cliente_s, pagamento_s só do Checkout, por_confirmador); 12 pela tela (Estatísticas = Servidor do
// ponto no Painel); 21; 22 a 25 pelo agente (rede: só origem, dia e seg; reimportar; catraca acima do bip; pico);
// calendário da Supervisora gravado no estado.db e lido de outro aparelho; nenhuma chamada a /ponto/presenca; sem textos de
// presença nas telas; celular (390) e tablet (820) sem rolagem lateral; cliques repetidos; aviso de fuso com o agente em UTC.
// Dados sintéticos; nenhum dado de cliente. Prints em testes/prints/ (não versionados).
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const {spawn}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const AGP=path.join(__dirname,'..','agente','eterna-agente.py');const PR=path.join(__dirname,'prints');fs.mkdirSync(PR,{recursive:true});
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const S=require('./_agente_sessao');const CKS={},POSTOS={}; // por agente: sessão de admin e posto pareado (as rotas da equipe pedem sessão; o Checkout, posto)
function req(porta,metodo,p,body,headers){return new Promise(res=>{const data=body!=null?Buffer.from(J(body)):null;const r=http.request({host:'127.0.0.1',port:porta,method:metodo,path:p,headers:{...(CKS[porta]?{Cookie:CKS[porta],...(metodo==='POST'?{'X-Eterna':'1'}:{})}:{}),...(headers||{}),...(data?{'Content-Type':'application/json','Content-Length':data.length}:{})}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const t=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(t);}catch(e){}res({s:rs.statusCode,h:rs.headers,t,j});});});r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
async function subir(porta,home,extra){fs.mkdirSync(path.join(home,'Eterna'),{recursive:true});fs.writeFileSync(path.join(home,'Eterna','ftp.json'),J({users:{carlos:'x'.repeat(12)}}));
  const env={...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(porta+1000),ETERNA_APP_ORIGIN:ORIG,ETERNA_SEM_OPENCV:'1',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost',...(extra||{})};
  if(!(extra&&extra.ETERNA_TZ))delete env.ETERNA_TZ;delete env.ETERNA_ORIGENS;delete env.ETERNA_BUCKET;
  CKS[porta]=S.sessao(home);POSTOS[porta]=S.posto(home,'Checkout v92');
  const p=spawn('python3',['-I',AGP],{env,stdio:['ignore','pipe','pipe']});p.log='';p.stdout.on('data',d=>p.log+=d);p.stderr.on('data',d=>p.log+=d);
  for(let i=0;i<80;i++){await sleep(250);if((await req(porta,'GET','/status')).s===200)return p;}return p;}
(async()=>{const b=await chromium.launch();const ags=[];const homes=[];const presenca=[];const medidas={};
const nova=async(w,h,ag)=>{const ctx=await b.newContext({viewport:{width:w||1440,height:h||950},locale:'pt-BR'});if(ag)await S.noNavegador(ctx,ag,[CKS[ag],POSTOS[ag]]);await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  ctx.on('request',r=>{if(/presenca/.test(r.url()))presenca.push(r.method()+' '+r.url());});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
const {adminFicticio,ADMIN_TESTE:ADMT}=require('./_entrar'); // administrador fictício (nenhum e-mail de pessoa nos testes)
async function entrar(pg,base,email){await pg.evaluate(()=>localStorage.removeItem('eterna.session')).catch(()=>{});await pg.goto(base);await pg.waitForTimeout(500);if(email===ADMT)await adminFicticio(pg);
  await require('./_entrar')(pg,email);return pg.evaluate(()=>!!ETERNA.state.user);}
const agOn=async pg=>{for(let i=0;i<40;i++){if(await pg.evaluate(()=>!!(ETERNA.state.agent&&ETERNA.state.agent.on)))return true;await sleep(250);}return false;};
const semLateral=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
const PRES=/presen[cç]a|\bfaltas?\b|atras(o|ad)|abono|abonar|folgas? fixas?|horário dos turnos|ponto oficial|escalad[oa]/i;
try{
  const porta=19500+Math.floor(Math.random()*400);const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v92t-'));homes.push(home);
  const ag=await subir(porta,home);ags.push(ag);const A=`http://127.0.0.1:${porta}`;const UA=A+'/index.html';
  ok((await req(porta,'GET','/status')).s===200,'agente subiu: '+ag.log.slice(-300));
  // ---------- 3: Checkout em espanhol pela tela ----------
  const {ctx,pg}=await nova(1440,950,porta);const evs=[];
  ctx.on('request',r=>{if(r.url().endsWith('/ponto/eventos')&&r.method()==='POST'){try{evs.push(...(JSON.parse(r.postData()).eventos||[]));}catch(e){}}});
  await pg.goto(UA+'#loja');await pg.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await pg.reload();await pg.waitForTimeout(900);
  const card=await pg.evaluate(()=>ETERNA.demoSessions().find(s=>s.photos.length>=8).card);
  await pg.click(`[data-act="lang"][data-l="es"]`).catch(()=>{});
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(1500);
  for(const a of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await pg.click(`[data-act="${a}"]`);
  await pg.waitForTimeout(400);// cliente leva alguns segundos antes de pagar
  // v96: o Continuar faz o pedido (sem pacote e sem pagamento no Checkout); o "criar" sai quando o caixa confirma, com a hora do pedido
  await pg.click('#lj-lb [data-act="lj-lg"]');await pg.click(`#lj-lb [data-act="lang"][data-l="es"]`);await pg.click('.lj-next');await pg.click('.lj-next').catch(()=>{});await pg.waitForTimeout(400); // clique repetido no Continuar; v96: idioma pelo botão da bandeira atual (bandeiras recolhidas no overlay)
  ok((await pg.evaluate(c=>JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.filter(x=>x.card===c&&x.estado==='escolha').length,card))===1,'3: um pedido só com o clique repetido no Continuar');
  await pg.screenshot({path:PR+'/v92t-checkout-es.png'});
  // ---------- Caixa: o Admin confirma o PIX (pagar) ----------
  const pa=await ctx.newPage();pa.on('pageerror',e=>errs.push(e.message));ok(await entrar(pa,UA,ADMT),'admin entrou pelo agente');ok(await agOn(pa),'app ligado ao agente');
  const pid=await pa.evaluate(()=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=(S.caixaDin||[]).find(x=>x.estado==='aguardando'||x.estado==='escolha');return r&&r.id;});
  const conf=await pa.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});return ETERNA.pendConfirmar(id,{ref:'123456'});},pid);ok(conf!==false,'Caixa confirmou o PIX: '+J(conf));
  for(let i=0;i<40&&!evs.some(e=>e.tipo==='pagar');i++)await sleep(200);
  const crK=evs.filter(e=>e.tipo==='criar'&&e.dados&&e.dados.card===card);const ck=crK[0];
  ok(crK.length===1,'3: um "criar" só: '+crK.length);
  ok(ck&&ck.dados.lang==='es'&&ck.dados.canal==='checkout'&&Array.isArray(ck.dados.cart)&&ck.dados.cart.length>0&&ck.dados.t0&&Date.parse(ck.dados.t0)<Date.parse(ck.em),'3: venda do Checkout pela tela chega com lang es, canal checkout, cart e t0 antes de em: '+J(ck&&{lang:ck.dados.lang,canal:ck.dados.canal,cart:ck.dados.cart,t0:ck.dados.t0,em:ck.em}));
  // ---------- balcão em inglês (caixaConfirm) ----------
  const card2=await pa.evaluate(()=>{const E=ETERNA;const c=E.demoSessions().filter(s=>s.photos.length>=3&&!['paga','cancelada','aguardando'].includes((E.SIM.sessions[s.card]||{}).status))[3].card;const S=E.SIM;const s=S.sessions[c]=S.sessions[c]||{};
    s.selected=E.demoSessions().find(x=>x.card===c).photos.slice(0,3).map(p=>p.id);s.cart=[{id:'zona'}];s.status='no caixa';E.state.lang='en';E.state.caixa.session=c;E.state.caixa.pay='PIX';E.state.caixa.tef=false;E.state.view='caixa';E.render();return c;});
  await pa.click('[data-act="caixa-confirm"]');for(let i=0;i<40&&!evs.some(e=>e.tipo==='criar'&&e.dados&&e.dados.card===card2);i++)await sleep(200);await pa.evaluate(()=>{ETERNA.state.lang='pt';});
  const bl=evs.find(e=>e.tipo==='criar'&&e.dados&&e.dados.card===card2);ok(bl&&bl.dados.canal==='balcao'&&bl.dados.lang==null,'3: balcão em inglês: canal balcao, sem lang: '+J(bl&&bl.dados&&{canal:bl.dados.canal,lang:bl.dados.lang}));
  // ---------- resumo v2 de hoje no agente ----------
  for(let i=0;i<50&&evs.filter(e=>e.tipo==='pagar').length<2;i++)await sleep(200); // o pagar do balcão sai no lote seguinte da fila
  const DV=ck?diaSP(Date.parse(ck.em)):HOJE; // o dia da própria venda (perto da meia-noite, HOJE do início do teste pode ser ontem)
  await sleep(400);const md=(await req(porta,'GET',`/metricas/dia?de=${DV}&ate=${DV}`)).j;const d0=(md&&md.dias||[])[0]||{};
  ok(d0.v===2&&d0.vendas===2,'resumo de hoje v2 com 2 vendas: '+J({v:d0.v,vendas:d0.vendas,fat:d0.faturamento,evs:evs.map(e=>e.tipo+':'+e.venda+':'+((e.dados||{}).card||''))}));
  ok(J(Object.keys(d0.por_idioma||{}))===J(['es'])&&(d0.por_canal||{}).checkout&&d0.por_canal.checkout.vendas===1&&(d0.por_canal||{}).balcao&&d0.por_canal.balcao.vendas===1,'21: idioma só do Checkout (es) e canais: '+J({i:d0.por_idioma,c:d0.por_canal}));
  ok(d0.tempos&&d0.tempos.cliente_s.n===1&&d0.tempos.pagamento_s.n===1,'c/R3: cliente_s e pagamento_s só da venda do Checkout: '+J(d0.tempos&&{c:d0.tempos.cliente_s,p:d0.tempos.pagamento_s}));
  ok(d0.por_confirmador&&Object.keys(d0.por_confirmador).length===1&&!Object.values(d0.por_vendedor||{}).some(v=>'pagamento_s' in v),'R4: por_confirmador com quem confirmou; por_vendedor sem tempo: '+J({c:d0.por_confirmador,v:d0.por_vendedor}));
  const prodIds=Object.keys(d0.por_produto||{});ok(prodIds.length>0&&!prodIds.includes('sem_detalhe'),'14: produtos da v92 com id, sem "sem detalhe": '+J(d0.por_produto));
  // ---------- 12 pela tela: Estatísticas (sem Roverpix) = Servidor do ponto · todos os caixas no Painel ----------
  await pa.evaluate(h=>{const E=ETERNA;E.state.range={from:h,to:h};E.state.srvMet.chave=null;E.go('painel');},DV); // o Painel guarda o resumo por 60 s (v90)let srvTxt='';
  for(let i=0;i<30;i++){srvTxt=await pa.evaluate(()=>{const s=[...document.querySelectorAll('section')].find(x=>/Servidor do ponto · todos os caixas/.test(x.textContent));return s?s.querySelector('.pn-take').textContent:'';});if(/R\$\s?[1-9]/.test(srvTxt))break;await sleep(250);}
  await pa.evaluate(()=>{const E=ETERNA;E.state.es.rover=false;E.state.es.sec='a';E.go('estatisticas');});let kpi='';
  for(let i=0;i<30;i++){kpi=await pa.evaluate(()=>{const e=document.querySelector('.pn-kpi[data-k="fat"] .pn-big');return e?e.textContent:'';});if(/[1-9]/.test(kpi))break;await sleep(250);}
  const rs=s=>(String(s).match(/R\$\s?[\d.,]+/)||[''])[0].replace(/\D/g,'');
  ok(rs(srvTxt)&&rs(srvTxt)===rs(kpi),'12: faturamento das Estatísticas = Servidor do ponto · todos os caixas: '+J({srv:srvTxt.slice(0,60),kpi}));
  await pa.screenshot({path:PR+'/v92t-estat-a.png',fullPage:true});
  await pa.click('[data-act="es-sec"][data-s="e"]');await pa.waitForTimeout(150);const te=await pa.textContent('#main');ok(/Espanhol/.test(te)&&/Outras línguas \(provável estrangeiro\)/.test(te)&&!/Inglês/.test(te),'21: Visitantes mostra Espanhol (Checkout) e não o inglês do balcão');
  await pa.click('[data-act="es-sec"][data-s="c"]');await pa.waitForTimeout(150);const tc=await pa.$$eval('.es-t',x=>x.map(e=>e.textContent));
  ok(/n\s*1/.test(tc[0]||'')&&/n\s*1/.test(tc[1]||'')&&/sem dado ainda/.test(tc[4]||''),'c: Rapidez com cliente e confirmação n=1; impressão "sem dado ainda": '+J(tc.map(x=>x.slice(0,60))));
  // cliques repetidos nos chips e no interruptor
  for(let i=0;i<3;i++){await pa.click('[data-act="es-sec"][data-s="d"]');await pa.click('[data-act="es-rover"]');}await pa.waitForTimeout(200);
  ok(await pa.evaluate(()=>ETERNA.state.es.sec==='d'&&ETERNA.state.es.rover===true),'cliques repetidos: seção d e Roverpix ligada (3 trocas)');await pa.click('[data-act="es-rover"]');
  // ---------- 22 a 25 pelo agente: Movimento ----------
  await pa.evaluate(([de,ate])=>{ETERNA.state.range={from:de,to:ate};ETERNA.render();},[addD(HOJE,-6),HOJE]);
  await pa.click('[data-act="es-sec"][data-s="f"]');await pa.waitForTimeout(600);let tf=await pa.textContent('#main');
  ok(/Sem dados de entrada ainda\. Quando chegar o arquivo do bip ou das catracas, importe aqui\./.test(tf)&&/Retrato de outubro/.test(tf)&&/Nenhuma importação ainda/.test(tf),'22: Movimento vazio com o agente de verdade: '+tf.slice(0,200));
  const ent=[];ctx.on('request',r=>{if(r.url().endsWith('/ponto/entradas')&&r.method()==='POST')ent.push(r.postData());});
  const ontem=addD(HOJE,-1);const [y,mo,dd]=ontem.split('-');
  const linhas=['data_hora;origem;ingresso;cpf;nome',...Array.from({length:9},(_,i)=>`${dd}/${mo}/${y} 10:41:${String(10+i)};bip;ING-5544${i};987.654.321-0${i};Fulano ${i}`),...Array.from({length:20},(_,i)=>`${ontem} 09:${String(10+i)}:00;bip;ING-7${i};111.111.111-1${i%10};Beltrano`)];
  const csv=Buffer.from(linhas.join('\r\n'));
  await pa.setInputFiles('[data-act="es-importar"]',{name:'bip.csv',mimeType:'text/csv',buffer:csv});for(let i=0;i<30&&!(await pa.$('#es-pico'));i++)await sleep(200);
  const corpo=ent[0]?JSON.parse(ent[0]):{};ok(ent.length===1&&J(Object.keys(corpo).sort())===J(['arquivo','dia','origem','por','seg'])&&!/ING-|\d{3}\.\d{3}\.\d{3}-\d{2}|Fulano|Beltrano|cpf|ingresso/i.test(ent.join('')),'23: pela rede só origem, dia e seg (mais arquivo e por): '+(ent[0]||'').slice(0,160));
  tf=await pa.textContent('#main');ok(/pico 10:41, 9 pessoas/.test(tf)&&/bip\.csv/.test(tf),'25: pico 10:41, 9 pessoas com o agente de verdade: '+tf.slice(0,240));
  const tot1=(await req(porta,'GET',`/metricas/dia?de=${ontem}&ate=${ontem}`)).j.dias[0].entradas;
  await pa.setInputFiles('[data-act="es-importar"]',{name:'bip.csv',mimeType:'text/csv',buffer:csv});await sleep(1200);
  const tot2=(await req(porta,'GET',`/metricas/dia?de=${ontem}&ate=${ontem}`)).j.dias[0].entradas;ok(tot1&&tot2&&tot1.total===29&&tot2.total===29,'24: reimportar o mesmo arquivo não duplica: '+J([tot1&&tot1.total,tot2&&tot2.total]));
  await pa.setInputFiles('[data-act="es-importar"]',{name:'catraca.csv',mimeType:'text/csv',buffer:Buffer.from(`data_hora,origem\n${ontem} 09:00:00,catraca\n${ontem} 09:00:30,catraca\n${ontem} 11:00:00,catraca\n`)});await sleep(1200);
  const tot3=(await req(porta,'GET',`/metricas/dia?de=${ontem}&ate=${ontem}`)).j.dias[0].entradas;ok(tot3&&tot3.fonte==='catraca'&&tot3.total===3&&tot3.por_origem.bip===29,'24: catraca acima do bip no mesmo dia: '+J(tot3&&{f:tot3.fonte,t:tot3.total,o:tot3.por_origem}));
  await pa.evaluate(()=>{ETERNA.state.es.chave=null;ETERNA.esPull(true);});await sleep(700);tf=await pa.textContent('#main');
  ok(/catraca\.csv/.test(tf)&&/Funil/.test(tf),'f: importações listadas e funil');
  // a coluna Quando das últimas importações na hora do Rio (não em UTC)
  const imp0=(await req(porta,'GET','/ponto/entradas/importacoes')).j.importacoes[0];const quando=await pa.evaluate(()=>{const t=[...document.querySelectorAll('section')].find(x=>/Últimas importações/.test(x.textContent));const td=t&&t.querySelector('tbody tr td');return td?td.textContent.trim():'';});
  const hmRio=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(imp0.em));const dRio=diaSP(Date.parse(imp0.em));
  ok(quando.includes(hmRio)&&(quando.includes(dRio)||quando.includes(dRio.split('-').reverse().join('/'))||quando.includes(dRio.slice(5).split('-').reverse().join('/'))),'f: "Quando" das importações na hora do Rio: tela '+J(quando)+', em '+imp0.em+', Rio '+dRio+' '+hmRio);await pa.screenshot({path:PR+'/v92t-estat-f.png',fullPage:true});
  // 29: nada de rosto, e-mail, CPF ou ingresso no resumo
  const todo=(await req(porta,'GET',`/metricas/dia?de=${addD(HOJE,-3)}&ate=${HOJE}`)).t;ok(!/@|ING-|\d{3}\.\d{3}\.\d{3}-\d{2}|emb|vetor|selfie/i.test(todo),'29: resumo sem e-mail, CPF, ingresso ou rosto');
  // ---------- sem presença nas telas do Admin ----------
  const telas=['estatisticas','calendario','escala','catalogo','painel','fotografos','permissoes'];const comPres=[];
  for(const v of telas){await pa.evaluate(v=>ETERNA.go(v),v);await pa.waitForTimeout(150);if(v==='estatisticas'){for(const s of ['a','b','c','d','e','f']){await pa.click(`[data-act="es-sec"][data-s="${s}"]`);await pa.waitForTimeout(80);const t=await pa.textContent('#main');const m=t.match(PRES);if(m)comPres.push(v+'/'+s+': '+m[0]);}continue;}
    const t=await pa.textContent('#main');const m=t.match(PRES);if(m&&!(v==='escala'&&/^escalad/i.test(m[0])))comPres.push(v+': '+m[0]+' … '+t.slice(Math.max(0,t.search(PRES)-40),t.search(PRES)+40));}
  ok(!comPres.length,'sem presença: nenhum texto de presença, falta, atraso, abono, folga fixa ou turno nas telas: '+J(comPres));
  await ctx.close();
  // ---------- Calendário: a Supervisora cria no servidor; outro aparelho vê ----------
  {const {ctx:c2,pg:p2}=await nova(1440,950,porta);ok(await entrar(p2,UA,'supervisor@eterna.photo'),'supervisora entrou');await agOn(p2);await p2.evaluate(()=>ETERNA.go('calendario'));await p2.waitForTimeout(200);
    await p2.click('[data-act="ag-novo"]');await p2.fill('#ag-f-data',addD(HOJE,3));await p2.fill('#ag-f-hora','21:30');await p2.selectOption('#ag-f-tipo','jogo');await p2.fill('#ag-f-mandante','Flu');await p2.fill('#ag-f-visitante','<img src=x onerror=window.__x=1>Vasco');await p2.fill('#ag-f-competicao','Carioca');
    await p2.dblclick('[data-act="ag-salvar"]').catch(()=>{});
    // o evento salvo não pode sumir da tela enquanto o app sincroniza com o servidor (1ª leitura da coleção agenda)
    const amostra=[];for(let i=0;i<32;i++){amostra.push(await p2.evaluate(()=>Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='jogo').length));await sleep(250);}
    ok(amostra.every(x=>x===1),'D3: o jogo salvo pela Supervisora some do calendário durante a 1ª sincronização (quantidade a cada 250 ms por 8 s): '+amostra.join(''));
    const n=await p2.evaluate(()=>Object.values(ETERNA.AGENDA).filter(a=>a.origem!=='feriados').length);ok(n===1,'cliques repetidos no Salvar criam um evento só: '+n); // v97: os feriados entram sozinhos pelo servidor
    let docs=null;for(let i=0;i<20;i++){const r=await req(porta,'GET','/ponto/docs?col=agenda');docs=r.j&&r.j.docs&&r.j.docs.filter(d=>d.valor&&d.valor.origem!=='feriados');if(docs&&docs.length)break;await sleep(250);}
    const dv=docs&&docs[0]&&docs[0].valor;ok(docs&&docs.length===1&&dv.mandante==='Fluminense'&&!/[<>]/.test(J(dv)),'17/D3: evento da Supervisora no estado.db do servidor, limpo: '+J(dv));
    // v97: com o servidor, os feriados (deste ano e do próximo) vêm sozinhos e o botão manual some
    let nf=0;for(let i=0;i<20&&nf<30;i++){nf=await p2.evaluate(()=>Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='feriado').length);if(nf<30)await sleep(250);}
    ok(nf===30&&!(await p2.$('[data-act="ag-feriados"]')),'19 (v97): feriados automáticos do servidor, sem duplicar e sem o botão manual: '+nf);
    await p2.screenshot({path:PR+'/v92t-calendario.png',fullPage:true});
    for(const [nm,w,h] of [['cel',390,844],['tab',820,1180]]){await p2.setViewportSize({width:w,height:h});await p2.waitForTimeout(200);ok(await semLateral(p2),`${nm}: Calendário sem rolagem lateral`);await p2.screenshot({path:PR+`/v92t-calendario-${nm}.png`,fullPage:true});}
    await c2.close();
    // outro aparelho (contexto novo, sem cópia local): o Admin vê o evento vindo do servidor
    const {ctx:c3,pg:p3}=await nova(1440,950,porta);await entrar(p3,UA,ADMT);await agOn(p3);let vis=0;
    for(let i=0;i<30&&!vis;i++){vis=await p3.evaluate(()=>Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='jogo').length);if(!vis)await sleep(250);}ok(vis===1,'D3: o evento chega a outro aparelho pelo servidor: '+vis);
    await p3.evaluate(()=>{ETERNA.state.es.sec='d';ETERNA.state.es.rover=false;ETERNA.go('estatisticas');});await p3.waitForTimeout(500);ok(!(await p3.evaluate(()=>window.__x)),'XSS: visitante com <img onerror> não executa');
    // dois aparelhos: editar e apagar em um chega ao outro; o apagado não volta (agAplicaSnap como o simAplica)
    {const {ctx:c5,pg:p5}=await nova(1440,950,porta);await entrar(p5,UA,'supervisor@eterna.photo');await agOn(p5);let v5=0;for(let i=0;i<40&&!v5;i++){v5=await p5.evaluate(()=>Object.values(ETERNA.AGENDA).filter(a=>a.tipo==='jogo').length);if(!v5)await sleep(250);}
      const jid=await p3.evaluate(()=>{const a=Object.values(ETERNA.AGENDA).find(x=>x.tipo==='jogo');ETERNA.agGrava(Object.assign({},a,{competicao:'Copa Rio'}));return a.id;});
      let comp='';for(let i=0;i<60&&comp!=='Copa Rio';i++){comp=await p5.evaluate(id=>(ETERNA.AGENDA[id]||{}).competicao,jid);if(comp!=='Copa Rio')await sleep(250);}ok(comp==='Copa Rio','sync: edição em um aparelho chega ao outro: '+comp);
      await p3.evaluate(id=>ETERNA.agApagar(id),jid);let ainda=true;for(let i=0;i<60&&ainda;i++){ainda=await p5.evaluate(id=>!!ETERNA.AGENDA[id],jid);if(ainda)await sleep(250);}ok(!ainda,'sync: apagado em um aparelho some do outro');
      const volta=[];for(let i=0;i<24;i++){volta.push(await p3.evaluate(id=>ETERNA.AGENDA[id]?1:0,jid));await sleep(250);}ok(!volta.includes(1),'sync: o apagado aqui não volta: '+volta.join(''));
      await c5.close();}
    // celular e tablet: Estatísticas, todas as seções
    for(const [nm,w,h] of [['cel',390,844],['tab',820,1180]]){await p3.setViewportSize({width:w,height:h});
      for(const s of ['a','b','c','d','e','f']){await p3.evaluate(s=>{ETERNA.state.es.sec=s;ETERNA.render();},s);await p3.waitForTimeout(120);ok(await semLateral(p3),`${nm}: Estatísticas seção ${s} sem rolagem lateral`);if(s==='a'||s==='b'||s==='f')await p3.screenshot({path:PR+`/v92t-estat-${s}-${nm}.png`,fullPage:true});}}
    // idioma da equipe em inglês não quebra as telas internas
    await p3.setViewportSize({width:1440,height:950});const li=await p3.evaluate(()=>{const E=ETERNA;E.state.lang='en';const r=[];for(const v of ['estatisticas','calendario']){E.go(v);r.push(!!document.querySelector('#main h1'));}E.state.lang='pt';E.render();return r;});ok(li.every(Boolean),'idioma en não quebra Estatísticas e Calendário');
    await c3.close();}
  // ---------- dados vazios: agente novo sem nada ----------
  {const h2=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v92t-'));homes.push(h2);const p2=porta+1;const a2=await subir(p2,h2,{ETERNA_TZ:'UTC'});ags.push(a2);
    const {ctx:c4,pg:p4}=await nova(1440,950,p2);await entrar(p4,`http://127.0.0.1:${p2}/index.html`,ADMT);await agOn(p4);
    await p4.evaluate(()=>{ETERNA.state.es.rover=false;ETERNA.state.es.sec='a';ETERNA.go('estatisticas');});await p4.waitForTimeout(800);
    const r=await p4.evaluate(()=>({fuso:!!document.getElementById('es-fuso'),txt:document.querySelector('#main').textContent}));
    ok(r.fuso,'fuso: agente de verdade com ETERNA_TZ=UTC mostra o aviso de fuso');ok(!/Algo falhou|NaN|undefined|Infinity/.test(r.txt),'vazio: seção a sem NaN/undefined');
    for(const s of ['b','c','d','e','f']){await p4.click(`[data-act="es-sec"][data-s="${s}"]`);await p4.waitForTimeout(150);const t=await p4.textContent('#main');ok(!/Algo falhou|NaN|undefined|Infinity/.test(t),'vazio: seção '+s+' sem NaN/undefined/erro: '+(t.match(/NaN|undefined|Infinity|Algo falhou/)||[''])[0]);}
    await p4.screenshot({path:PR+'/v92t-estat-vazio-c.png',fullPage:true});await c4.close();}
  ok(!presenca.length,'sem presença: o app nunca chamou /ponto/presenca: '+J(presenca.slice(0,3)));
}catch(e){fails.push('exceção: '+String(e&&e.stack||e).slice(0,500));}
for(const a of ags)try{a.kill('SIGKILL');}catch(e){}for(const h of homes)try{fs.rmSync(h,{recursive:true,force:true});}catch(e){}
await b.close();const e2=errs.filter(x=>!/Failed to fetch|NetworkError|127\.0\.0\.1:1[89]\d\d\d/.test(x));const okAll=!fails.length&&!e2.length;
console.log(`${okAll?'OK':'FALHA'} v92-testador: Checkout em espanhol pela tela, Caixa, balcão, resumo v2, 12 pela tela, 21 a 25 e 29 com o agente de verdade, calendário no servidor, sem presença, celular e tablet, vazio, fuso${fails.length?' · '+fails.join(' | '):''}${e2.length?' · erros: '+e2.slice(0,3).join(' | '):''}`);
process.exit(okAll?0:1);})();
