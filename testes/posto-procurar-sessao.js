// 24/11: Procurar sessão no Posto de venda (critérios 1 a 18 do plano docs/planos/2026-11-24-procurar-sessao-posto.md).
// O agente é falso (page.route na própria origem: /status, /sessoes, /thumb/, /file/ e o resto com resposta neutra). Dados e miniaturas
// simulados (uma imagem do repositório), nunca foto de convidado.
// PS_VER=1 mostra cada conferência com o tempo; PS_PRINTS=<pasta> grava as telas de 1280 e 390 px. A pessoa do caixa é um cadastro de teste com o perfil Atendimento e venda.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.PS_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+m.slice(0,300));};const J=JSON.stringify;
const JPG=fs.readFileSync(path.join(__dirname,'..','img','ativ-snap.jpg')); // imagem do próprio repositório no lugar das miniaturas
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
let seqPid=0;const pids=n=>Array.from({length:n},()=>(0xabc000000000+(++seqPid)).toString(16));
const agora=()=>Date.now()/1000;
// t = há quantos segundos foi a última foto
function sessao(o){const a=agora();const t=o.t||300;const fotos=o.fotos||pids(o.n==null?6:o.n);return Object.assign({card:o.card,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:a-t-60,ultima_chegada:a-t,cap0:a-t-65,cap1:a-t-5,fonte_t:'cap',fechada_em:a-t+60,fechada_por:'pausa',fotos,pend:[],dec:{},ia:[],sim_abertura:null,fundida_em:null,removida:false,rev:1},o,{fotos});}
const XSS='<img src=x onerror=window.__xss=1>';
const CAIXA='caixa.teste@exemplo.com',QUIOSQUE='quiosque.teste@exemplo.com';
const CHAVE='const PROCURA_SESSAO_ON=true;';
(async()=>{
const b=await chromium.launch();const errs=[];
const novo=async(w,h,o)=>{o=o||{};const ctx=await b.newContext({viewport:{width:w||1280,height:h||800},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  if(o.desligada){const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');if(html.split(CHAVE).length!==2)throw new Error('a linha "'+CHAVE+'" tem que existir uma vez no index.html');
    const body=html.replace(CHAVE,'const PROCURA_SESSAO_ON=false;');await ctx.route(u=>u.pathname.endsWith('/index.html'),r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Cache-Control':'no-store'},body}):r.continue());}
  if(o.agente)await agente(ctx);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
const FEED={gen:'b91',rev:0,sessoes:[]};const poe=x=>{x.rev=++FEED.rev;const i=FEED.sessoes.findIndex(y=>y.card===x.card);if(i>=0)FEED.sessoes[i]=x;else FEED.sessoes.push(x);return x;};
async function agente(ctx){
  await ctx.route(ORIG+'/**',r=>{const rq=r.request();const u=new URL(rq.url());const p=u.pathname;const j=(o,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(o)});
    if(/\.(html|js|css|png|jpg|jpeg|webp|svg|json|woff2?|ico|wasm|onnx)$/.test(p))return r.fallback(); // os modelos de rosto (.bin) ficam de fora: a validação do navegador não é assunto deste teste e deixa a página lenta
    if(p.startsWith('/auth/'))return r.fallback();
    if(p==='/status')return j({ok:true,agent:'eterna-agente',version:3,boot:FEED.gen,card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:FEED.rev,gen:FEED.gen,hoje:FEED.sessoes.length,abertas:1}});
    if(p==='/sessoes'){const d=+u.searchParams.get('desde')||0;return j({ok:true,gen:FEED.gen,rev:FEED.rev,pausa:60,rostos:true,completo:!d,sessoes:FEED.sessoes.filter(x=>x.rev>d&&u.searchParams.get('ontem')!=='1')});}
    if(p.startsWith('/thumb/')||p.startsWith('/file/'))return r.fulfill({status:200,contentType:'image/jpeg',body:JPG});
    if(p==='/events')return j({events:[],next:0,total:0});
    if(rq.method()!=='GET')return j({ok:true});
    return j({erro:'sem_permissao'},403);});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||12000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(200);}return false;};
async function cadastro(pg){await pg.goto(U);await pg.waitForTimeout(350);
  await pg.evaluate(([c,q])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));const novo=(e,n,pr)=>({v:2,email:e,name:n,preset:pr,key:null,active:true,perms:ETERNA.presetPerms(pr),menu:ETERNA.presetMenu(pr),inicio:ETERNA.PRESETS[pr].inicio||'',createdAt:'2026-11-24'});
    U0[c]=novo(c,'Caixa de teste','venda');U0[q]=novo(q,'Checkout de teste','quiosque');localStorage.setItem('eterna.users.v1',J(U0));function J(x){return JSON.stringify(x);}},[CAIXA,QUIOSQUE]);
  await pg.reload();await pg.waitForTimeout(350);}
async function entrar(pg,email){await cadastro(pg);return entrarTeste(pg,email);}
const abrir=async(pg,h)=>{await pg.goto('about:blank');await pg.goto(U+h);await pg.waitForTimeout(450);};
const cartoes=pg=>pg.evaluate(()=>[...document.querySelectorAll('#ps-lista .ps-card')].map(c=>({card:c.dataset.card,est:c.dataset.est,tag:c.tagName,act:c.dataset.act||'',hora:(c.querySelector('.ps-hora')||{}).textContent||'',fot:(c.querySelector('.ps-fot')||{}).textContent||'',meta:(c.querySelector('.ps-meta')||{}).textContent||'',txt:c.textContent,
  imgs:[...c.querySelectorAll('img')].map(i=>({l:i.getAttribute('loading'),s:i.getAttribute('src'),e:i.hasAttribute('onerror')}))})));
const forjar=(pg,card)=>pg.evaluate(card=>{const x=document.createElement('button');x.dataset.act='checkout-pick';x.dataset.card=card;document.body.appendChild(x);x.click();x.remove();},card);
// o Posto se redesenha sozinho (ciclos do servidor): o clique vai direto ao elemento, sem esperar a tela parar
const clica=async(pg,sel)=>{if(!await pg.evaluate(sel=>{const x=document.querySelector(sel);if(!x)return false;x.click();return true;},sel))throw new Error('sem o elemento '+sel);};
const escolhe=(pg,v)=>pg.evaluate(v=>{const s=document.querySelector('#ps-foto');s.value=v;if(s.value!==v)throw new Error('sem a opção '+v);s.dispatchEvent(new Event('change',{bubbles:true}));},v);
const toastTxt=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
const hh=t=>{const d=new Date(t*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
try{
  // feed: 40 sessões fechadas na última 1h30 (a mais antiga com fotógrafo de nome malicioso), uma de 2 h atrás, uma aberta,
  // uma removida (LGPD), uma sem foto e uma de 2 fotos com base de IA
  const N=[];for(let i=1;i<=40;i++)N.push(poe(sessao({card:'LPPS'+String(i).padStart(5,'0'),t:i*60+30,fotografo:i===40?XSS:i%2?'carlos':'samuel',ponto:i%3?'terminal':null,n:i===3?2:6})));
  const VELHA=poe(sessao({card:'LPPSVELHA',t:7200,fotografo:'samuel'}));
  poe(sessao({card:'LPPSABERT',t:20,fotografo:'yago',status:'aberta',fechada_em:null,fechada_por:null}));
  poe(sessao({card:'LPPSREMOV',t:120,removida:true}));poe(sessao({card:'LPPSVAZIA',t:130,n:0}));
  {const f=pids(5);poe(sessao({card:'LPPSCOMIA',t:45,fotos:f,ia:f.slice(0,2)}));} // 3 fotos à venda; é a mais nova da lista (41 na janela de 1h30)
  const {ctx,pg}=await novo(1280,800,{agente:true});
  ok(await entrar(pg,CAIXA),'login do perfil Atendimento e venda');
  await abrir(pg,'#posto');
  // 1: botão no rodapé do Posto
  const b1=await pg.evaluate(()=>{const x=document.querySelector('.posto-rodape [data-act="posto-manual"]');return x?{t:x.textContent.trim(),h:x.getBoundingClientRect().height,cort:!!document.querySelector('[data-act="posto-cortesia"]'),preset:ETERNA.state.user.preset}:null;});
  ok(b1&&b1.t==='Procurar sessão'&&b1.h>=44&&!b1.cort&&b1.preset==='venda','1: botão Procurar sessão no rodapé do Posto do perfil venda: '+J(b1));
  ok(await espera(pg,()=>ETERNA.psOn()&&ETERNA.psLista().itens.length>=41),'feed do agente falso chegou ao Posto');
  await clica(pg,'.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!!document.querySelector('#posto-manual .ps-painel #ps-lista')&&!!document.querySelector('#posto-manual #ck-code')&&location.hash==='#checkout'&&!document.querySelector('#posto-manual .sess')),'1: o toque abre o bloco com Procurar sessão no lugar da lista antiga');
  // 10 (parte 1): as sessões entram neste navegador de 12 em 12 por ciclo; enquanto isso o cartão fica desabilitado
  {const c0=await cartoes(pg);const car=c0.filter(c=>c.est==='carregando');ok(c0.length===24&&c0.every(c=>c.est==='livre'||(c.est==='carregando'&&c.tag==='DIV'&&!c.act&&/Carregando fotos/.test(c.txt))),'10: na abertura, quem ainda não chegou fica em Carregando fotos: '+car.length+' de '+c0.length);}
  ok(await espera(pg,()=>ETERNA.psLista().itens.every(x=>ETERNA.psEstado(x.card)==='livre'),30000),'as sessões do feed viram sessões do Posto');
  ok(await espera(pg,()=>[...document.querySelectorAll('#ps-lista .ps-card')].every(c=>c.dataset.est==='livre')),'a lista redesenha sozinha quando as fotos chegam');
  // 2: 24 de 41 (40 + a de IA), da mais nova para a mais antiga; Mostrar mais leva ao total
  let cs=await cartoes(pg);const esp=['LPPSCOMIA'].concat(N.map(x=>x.card));
  ok(cs.length===24&&cs.map(c=>c.card).join()===esp.slice(0,24).join(),'2: 24 cartões, do mais novo para o mais antigo: '+cs.map(c=>c.card).join());
  ok(await pg.evaluate(()=>document.querySelector('#ps-n').textContent)==='24 de 41 sessões','2: contagem: '+await pg.evaluate(()=>(document.querySelector('#ps-n')||{}).textContent));
  await clica(pg,'[data-act="ps-mais"]');await pg.waitForTimeout(250);cs=await cartoes(pg);
  ok(cs.length===41&&cs.map(c=>c.card).join()===esp.join()&&!await pg.$('[data-act="ps-mais"]'),'2: Mostrar mais leva aos 41 e some: '+cs.length);
  // 3 e 6: 1h30 esconde a de 2 h; Hoje mostra; aberta, removida e sem foto nunca aparecem
  ok(!cs.some(c=>c.card==='LPPSVELHA')&&await pg.evaluate(()=>document.querySelector('[data-act="ps-jan"][data-j="90"]').getAttribute('aria-pressed'))==='true','3: padrão de 1h30 esconde a sessão de 2 h atrás');
  await clica(pg,'[data-act="ps-jan"][data-j="0"]');await pg.waitForTimeout(250);
  ok(await pg.evaluate(()=>ETERNA.state.posto.busca.n)===24,'trocar o horário volta a contagem para 24');
  await clica(pg,'[data-act="ps-mais"]');await pg.waitForTimeout(250);cs=await cartoes(pg);
  ok(cs.length===42&&cs[41].card==='LPPSVELHA','3: Hoje mostra a de 2 h atrás, por último: '+cs.length);
  ok(!cs.some(c=>['LPPSABERT','LPPSREMOV','LPPSVAZIA'].includes(c.card)),'6: aberta, removida e sem foto fora da lista');
  await clica(pg,'[data-act="ps-jan"][data-j="30"]');await pg.waitForTimeout(250);cs=await cartoes(pg);
  ok(cs.length>0&&cs.length<=24&&cs.every(c=>c.card==='LPPSCOMIA'||+c.card.slice(4)<=30),'3: últimos 30 min: '+cs.map(c=>c.card).join());
  await clica(pg,'[data-act="ps-jan"][data-j="0"]');await pg.waitForTimeout(250);
  // 4: o select só tem fotógrafo com sessão fechada hoje; escolher filtra
  const ops=await pg.$$eval('#ps-foto option',o=>o.map(x=>({v:x.value,t:x.textContent})));
  ok(ops.length===4&&ops[0].v==='todos'&&ops[0].t==='Todos'&&ops.some(o=>o.v==='carlos'&&/^Carlos \(21\)$/.test(o.t))&&ops.some(o=>o.v==='samuel'&&/^Samuel \(20\)$/.test(o.t))&&!ops.some(o=>o.v==='yago'),'4: fotógrafos do select: '+J(ops));
  await escolhe(pg,'samuel');await pg.waitForTimeout(250);cs=await cartoes(pg);
  ok(cs.length===20&&cs.every(c=>c.fot==='Samuel')&&await pg.evaluate(()=>document.querySelector('#ps-foto').value)==='samuel','4: escolher Samuel filtra: '+cs.length);
  ok(await pg.evaluate(()=>{const s=document.querySelector('#ps-foto');const o=document.createElement('option');o.value='ninguem';s.appendChild(o);s.value='ninguem';s.dispatchEvent(new Event('change',{bubbles:true}));return ETERNA.state.posto.busca.key;})==='todos','4: fotógrafo fora da lista não é aceito');
  await pg.waitForTimeout(200);await clica(pg,'[data-act="ps-mais"]');await pg.waitForTimeout(250);cs=await cartoes(pg);
  // 5: o que cada cartão mostra
  const c1=cs.find(c=>c.card==='LPPS00001'),c3=cs.find(c=>c.card==='LPPS00003'),cia=cs.find(c=>c.card==='LPPSCOMIA');
  ok(c1&&c1.hora===hh(N[0].ultima_chegada)&&c1.fot==='Carlos'&&/LPPS00001/.test(c1.meta)&&/Terminal Campo/.test(c1.meta)&&/6 fotos/.test(c1.meta)&&c1.imgs.length===4,'5: cartão com hora, fotógrafo, ponto, fotos e 4 miniaturas: '+J(c1));
  ok(c3&&!/Terminal/.test(c3.meta)&&/2 fotos/.test(c3.meta)&&c3.imgs.length===2,'5: sem ponto e com 2 fotos: '+J(c3&&{m:c3.meta,i:c3.imgs.length}));
  ok(cia&&/3 fotos/.test(cia.meta)&&cia.imgs.length===3,'5: as bases de IA não contam nem viram miniatura: '+J(cia&&{m:cia.meta,i:cia.imgs.length}));
  ok(cs.every(c=>c.imgs.length<=4&&c.imgs.every(i=>i.l==='lazy'&&/\/thumb\/[0-9a-f]+$/.test(i.s)&&!i.e)),'5: no máximo 4 miniaturas, lazy, de /thumb/, sem onerror');
  ok(await espera(pg,()=>{const i=[...document.querySelectorAll('#ps-lista .ps-card[data-card="LPPSCOMIA"] img')];return i.length===3&&i.every(x=>x.complete&&x.naturalWidth>0&&Math.abs(x.clientWidth-x.clientHeight)<=1&&getComputedStyle(x).objectFit==='contain');}),'5: miniaturas carregadas, quadradas e com a foto inteira (contain)');
  // 15: nome e chave maliciosos não viram HTML
  const cx=cs.find(c=>c.card==='LPPS00040');
  ok(cx&&cx.fot===XSS&&await pg.evaluate(()=>window.__xss===undefined&&!document.querySelector('#posto-manual img[onerror]')&&document.querySelectorAll('#posto-manual img[src="x"]').length===0),'15: fotógrafo com <img onerror> fica como texto: '+J(cx&&cx.fot));
  ok(await pg.evaluate(x=>[...document.querySelectorAll('#ps-foto option')].some(o=>o.value===x&&o.textContent.startsWith(x)),XSS),'15: a chave maliciosa fica como texto no select');
  await escolhe(pg,XSS);await pg.waitForTimeout(250);cs=await cartoes(pg);ok(cs.length===1&&cs[0].card==='LPPS00040'&&await pg.evaluate(()=>window.__xss===undefined),'15: filtrar pela chave maliciosa não executa nada');
  await escolhe(pg,'todos');await pg.waitForTimeout(250);
  // a tela do cliente não espelha a lista
  ok(await pg.evaluate(()=>!document.querySelector('#eco .ps-card,#eco .ps-thumbs,#eco [data-act="checkout-pick"]')),'o espelho do Checkout (#eco) não tem nada da lista');
  // 8: paga = selo, sem toque; checkoutPick à mão não muda a etapa
  await pg.evaluate(()=>{ETERNA.simOf('LPPS00002').status='paga';ETERNA.simOf('LPPS00004').status='aguardando';ETERNA.saveSim();ETERNA.render();});await pg.waitForTimeout(200);cs=await cartoes(pg);
  const c2=cs.find(c=>c.card==='LPPS00002'),c4=cs.find(c=>c.card==='LPPS00004');
  ok(c2&&c2.est==='paga'&&c2.tag==='DIV'&&!c2.act&&/Já vendida/.test(c2.txt),'8: sessão paga com o selo e sem data-act: '+J(c2&&{e:c2.est,t:c2.tag,a:c2.act}));
  await pg.evaluate(()=>ETERNA.checkoutPick('LPPS00002'));await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>ETERNA.state.checkout.session==null&&ETERNA.state.checkout.step===1&&!document.querySelector('.posto-manual-cod')&&ETERNA.SIM.sessions.LPPS00002.status==='paga')&&await toastTxt(pg)==='Já vendida','8: checkoutPick à mão é recusado: '+await toastTxt(pg));
  await forjar(pg,'LPPS00002');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.checkout.session==null&&!document.querySelector('.posto-manual-cod')),'8: clique forjado na paga é recusado');
  // 9: pedido em aberto
  ok(c4&&c4.est==='pedido'&&c4.tag==='DIV'&&!c4.act&&/Pedido em aberto/.test(c4.txt),'9: pedido em aberto com o selo e sem data-act: '+J(c4&&{e:c4.est,t:c4.tag,a:c4.act}));
  await pg.evaluate(()=>document.querySelector('#ps-lista .ps-card[data-card="LPPS00004"]').click());await forjar(pg,'LPPS00004');await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>ETERNA.state.checkout.session==null&&ETERNA.SIM.sessions.LPPS00004.status==='aguardando')&&await toastTxt(pg)==='Pedido em aberto','9: pedido em aberto não abre: '+await toastTxt(pg));
  // 10: no feed mas fora do SIM = "Carregando fotos" desabilitado; depois de materializar, tocável
  await pg.evaluate(()=>{delete ETERNA.SIM.sessions.LPPS00005;ETERNA.saveSim();});
  ok(await espera(pg,()=>(document.querySelector('#ps-lista .ps-card[data-card="LPPS00005"]')||{dataset:{}}).dataset.est==='carregando'),'10: o ciclo do servidor redesenha o cartão como carregando');
  cs=await cartoes(pg);const c5=cs.find(c=>c.card==='LPPS00005');ok(c5&&c5.tag==='DIV'&&!c5.act&&/Carregando fotos/.test(c5.txt),'10: Carregando fotos, sem toque: '+J(c5&&{e:c5.est,t:c5.tag}));
  await forjar(pg,'LPPS00005');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>ETERNA.state.checkout.session==null&&!ETERNA.SIM.sessions.LPPS00005)&&await toastTxt(pg)==='Carregando fotos','10: clique forjado não cria sessão vazia: '+await toastTxt(pg));
  poe(Object.assign({},N[4]));
  ok(await espera(pg,()=>{const c=document.querySelector('#ps-lista .ps-card[data-card="LPPS00005"]');return !!c&&c.dataset.est==='livre'&&c.tagName==='BUTTON'&&c.dataset.act==='checkout-pick';}),'10: depois de materializar o cartão fica tocável');
  // 7: tocar numa livre leva à etapa 2 com o código certo
  await clica(pg,'#ps-lista button.ps-card[data-card="LPPS00006"]');await pg.waitForTimeout(300);
  const e7=await pg.evaluate(()=>({cod:(document.querySelector('.posto-manual-cod')||{}).textContent,step:ETERNA.state.checkout.step,fotos:document.querySelectorAll('#posto-manual [data-act="fila-sel"]').length,lista:!!document.querySelector('#ps-lista'),st:ETERNA.SIM.sessions.LPPS00006.status}));
  ok(e7.cod==='LPPS00006'&&e7.step===2&&e7.fotos===6&&!e7.lista&&e7.st==='no checkout','7: etapa 2 com o código e as fotos: '+J(e7));
  // sessão em atendimento ("no checkout") segue tocável, com aviso
  await pg.evaluate(()=>{ETERNA.state.checkout.session=null;ETERNA.state.checkout.step=1;ETERNA.render();});await pg.waitForTimeout(200);cs=await cartoes(pg);
  {const c6=cs.find(c=>c.card==='LPPS00006');ok(c6&&c6.est==='nocheckout'&&c6.tag==='BUTTON'&&c6.act==='checkout-pick','decisão 8: no checkout segue tocável: '+J(c6&&{e:c6.est,t:c6.tag}));}
  await pg.evaluate(()=>{ETERNA.simOf('LPPS00006').status='fechada';ETERNA.saveSim();ETERNA.render();});
  // 11: o código filtra e ignora o horário
  await clica(pg,'[data-act="ps-jan"][data-j="90"]');await pg.waitForTimeout(200);
  await pg.fill('#ck-code','velha');await pg.waitForTimeout(350);cs=await cartoes(pg);
  ok(cs.length===1&&cs[0].card==='LPPSVELHA','11: parte do código acha a sessão fora do horário: '+cs.map(c=>c.card).join());
  await pg.fill('#ck-code','ZZZZ');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>!document.querySelector('#ps-lista .ps-card')&&/Nenhuma sessão com esse número ou código/.test(document.querySelector('#ps-lista').textContent)),'11: código sem sessão avisa');
  // 12: /sessoes novo com a tela aberta não apaga o texto do código nem volta a contagem para 24
  await pg.fill('#ck-code','');await pg.waitForTimeout(250);await clica(pg,'[data-act="ps-mais"]');await pg.waitForTimeout(250);
  await pg.focus('#ck-code');await pg.keyboard.type('LPPS0');await pg.waitForTimeout(350);
  const antes=(await cartoes(pg)).length;poe(sessao({card:'LPPS0NOVA',t:10,fotografo:'carlos'}));
  ok(await espera(pg,()=>!!document.querySelector('#ps-lista .ps-card[data-card="LPPS0NOVA"]')),'12: a sessão nova aparece sozinha');
  const d12=await pg.evaluate(()=>({v:document.querySelector('#ck-code').value,foco:document.activeElement&&document.activeElement.id,n:ETERNA.state.posto.busca.n,cs:document.querySelectorAll('#ps-lista .ps-card').length,cod:ETERNA.state.checkout.code}));
  ok(d12.v==='LPPS0'&&d12.foco==='ck-code'&&d12.n===48&&d12.cs===antes+1&&d12.cs>24,'12: texto, foco e contagem ficam: '+J(d12)+' antes '+antes);
  // sem mudança no feed, o ciclo não redesenha (o cartão é o mesmo elemento)
  await pg.evaluate(()=>{document.querySelector('#ps-lista').dataset.marca='1';});await pg.waitForTimeout(6000);
  ok(await pg.evaluate(()=>document.querySelector('#ps-lista').dataset.marca==='1'),'12: sem novidade, o ciclo do servidor não redesenha a lista');
  // LGPD: removida some no ciclo seguinte
  poe(Object.assign({},N[6],{removida:true}));
  ok(await espera(pg,()=>!document.querySelector('#ps-lista .ps-card[data-card="LPPS00007"]')&&!ETERNA.psLista().itens.some(x=>x.card==='LPPS00007')),'LGPD: sessão removida some no ciclo seguinte');
  await pg.fill('#ck-code','');await pg.waitForTimeout(250);
  // 14: 5 línguas, sem chave crua nem travessão
  const i18=await pg.evaluate(()=>{const ruim=[];const ks=Object.keys(ETERNA.EQ).filter(k=>k.startsWith('ps_'));for(const k of ks){const e=ETERNA.EQ[k];if(!Array.isArray(e)||e.length<5){ruim.push(k+': menos de 5');continue;}
      e.slice(0,5).forEach((v,i)=>{const t=typeof v==='function'?v(3,7):v;if(typeof t!=='string'||!t.trim()||/[–—]/.test(t)||/ps_/.test(t))ruim.push(k+'['+i+']: '+t);});}return {n:ks.length,ruim};});
  ok(i18.n>=16&&!i18.ruim.length,'14: chaves ps_* nas 5 línguas, sem travessão: '+J(i18));
  // na tela a equipe escolhe entre 4 (IDIOMAS_EQ); o alemão existe no dicionário (conferido acima) e ainda não tem bandeira
  for(const l of ['en','es','fr','pt']){await pg.evaluate(l=>{ETERNA.state.langEq=l;ETERNA.render();},l);await pg.waitForTimeout(200);
    const t=await pg.evaluate(()=>({p:document.querySelector('#posto-manual .ps-painel').textContent,h2:document.querySelector('.ps-painel h2').textContent,j:[...document.querySelectorAll('[data-act="ps-jan"]')].map(x=>x.textContent).join('|')}));
    const H={pt:'Procurar sessão',en:'Find session',es:'Buscar sesión',fr:'Chercher une séance',de:'Sitzung suchen'}[l];
    ok(t.h2===H&&!/ps_[a-z0-9]+/.test(t.p)&&!/[–—]/.test(t.p),`14: ${l} sem chave crua nem travessão: `+J({h2:t.h2,j:t.j}));}
  // 13: sem rolagem horizontal e botões com 44 px ou mais (1280 e 390)
  const medir=p=>p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,baixos:[...document.querySelectorAll('.ps-painel [data-act="ps-jan"],.ps-painel #ps-foto,.ps-painel #ck-code,.ps-painel [data-act="ps-mais"],#ps-lista button.ps-card,.ps-abrir')].map(x=>[x.dataset.act||x.id,Math.round(x.getBoundingClientRect().height)]).filter(x=>x[1]<44),n:document.querySelectorAll('#ps-lista .ps-card').length,fora:[...document.querySelectorAll('.ps-painel *')].filter(x=>x.getBoundingClientRect().right>document.documentElement.clientWidth+1).length}));
  let m=await medir(pg);ok(m.sw<=m.cw&&!m.baixos.length&&m.n>=24&&!m.fora,'13: 1280×800: '+J(m));
  const print=async n=>{if(process.env.PS_PRINTS)await pg.screenshot({path:path.join(process.env.PS_PRINTS,n+'.png'),fullPage:false});};await print('ps-1280');
  await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(350);m=await medir(pg);ok(m.sw<=m.cw&&!m.baixos.length&&m.n>=24&&!m.fora,'13: 390×844: '+J(m));await pg.evaluate(()=>document.querySelector('.ps-painel').scrollIntoView());await print('ps-390');
  await clica(pg,'[data-act="posto-manual-fechar"]');await pg.waitForTimeout(250);m=await medir(pg);
  ok(m.sw<=m.cw&&!m.baixos.length&&await pg.evaluate(()=>!!document.querySelector('.posto-rodape .ps-abrir')),'13: 390×844 com o botão do rodapé: '+J(m));
  await pg.setViewportSize({width:1280,height:800});
  // a aba do Checkout do cliente (#loja) não tem a lista nem o botão
  {const lj=await ctx.newPage();lj.on('pageerror',e=>errs.push(e.message));await lj.goto(U+'#loja');await lj.waitForTimeout(3200);
    ok(await lj.evaluate(()=>!document.querySelector('.ps-card,.ps-painel,.ps-abrir,#ps-lista,[data-act="posto-manual"]')),'#loja sem nada do Procurar sessão');await lj.close();}
  await ctx.close();
  // 18: Fotógrafo não vê o botão; #checkout cai em sem acesso; quiosque puro também não
  {const {ctx,pg}=await novo(1280,800,{agente:true});ok(await entrar(pg,'carlos@eterna.photo'),'login do fotógrafo');
    ok(await pg.evaluate(()=>!document.querySelector('[data-act="posto-manual"],.ps-abrir')),'18: Fotógrafo sem o botão');
    await abrir(pg,'#checkout');const t=await pg.evaluate(()=>({v:ETERNA.state.view,man:!!document.querySelector('#posto-manual'),ps:!!document.querySelector('.ps-painel,.ps-card')}));
    ok(!['posto','caixa','checkout'].includes(t.v)&&!t.man&&!t.ps,'18: #checkout sem acesso para o Fotógrafo: '+J(t));
    await pg.evaluate(()=>{const x=document.createElement('button');x.dataset.act='posto-manual';document.body.appendChild(x);x.click();x.remove();});await pg.waitForTimeout(150);
    ok(await toastTxt(pg)==='Sem acesso a esta tela'&&!await pg.$('#posto-manual'),'18: posto-manual forçado é recusado: '+await toastTxt(pg));await ctx.close();}
  {const {ctx,pg}=await novo(1280,800,{agente:true});await entrar(pg,QUIOSQUE);await pg.waitForTimeout(600);
    ok(await pg.evaluate(()=>!document.querySelector('.ps-card,.ps-painel,.ps-abrir,#ps-lista,[data-act="posto-manual"]')),'perfil Checkout (quiosque puro) sem nada do Procurar sessão');
    await pg.evaluate(()=>{const x=document.createElement('button');x.dataset.act='posto-manual';document.body.appendChild(x);x.click();x.remove();});await pg.waitForTimeout(200);
    ok(!await pg.$('#posto-manual')&&!await pg.$('.ps-painel'),'quiosque puro: posto-manual forçado não abre');await ctx.close();}
  // 17: sem agente, a lista antiga
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,CAIXA),'login sem agente');await abrir(pg,'#posto');await pg.waitForTimeout(300);
    await clica(pg,'.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(300);
    const t=await pg.evaluate(()=>({ps:!!document.querySelector('.ps-painel,#ps-lista'),sess:document.querySelectorAll('#posto-manual .sess [data-act="checkout-pick"]').length,code:!!document.querySelector('#posto-manual #ck-code'),h2:[...document.querySelectorAll('#posto-manual h2')].map(x=>x.textContent).join('|')}));
    ok(!t.ps&&t.sess===16&&t.code&&/Código|lista/i.test(t.h2),'17: sem agente vale a lista antiga de 16: '+J(t));
    const c=await pg.evaluate(()=>document.querySelector('#posto-manual .sess [data-act="checkout-pick"]').dataset.card);await clica(pg,`#posto-manual [data-act="checkout-pick"][data-card="${c}"]`);await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>(document.querySelector('.posto-manual-cod')||{}).textContent)===c,'17: a lista antiga segue abrindo a venda');await ctx.close();}
  // 16: chave desligada = Posto de antes
  {const {ctx,pg}=await novo(1280,800,{agente:true,desligada:true});ok(await entrar(pg,CAIXA),'login com a chave desligada');await abrir(pg,'#posto');
    ok(await espera(pg,()=>ETERNA.state.agent.on&&Object.keys(ETERNA.SRV.sess).length>0),'16: agente ligado com a chave desligada');
    ok(await pg.evaluate(()=>!document.querySelector('.posto-rodape')&&!document.querySelector('[data-act="posto-manual"],.ps-abrir')&&!ETERNA.psOn()),'16: sem o botão e sem o rodapé para o perfil venda');
    await abrir(pg,'#checkout');await pg.waitForTimeout(300);
    const t=await pg.evaluate(()=>({ps:!!document.querySelector('.ps-painel,#ps-lista,.ps-card,[data-act="ps-jan"],#ps-foto'),sess:document.querySelectorAll('#posto-manual .sess [data-act="checkout-pick"]').length,code:!!document.querySelector('#posto-manual #ck-code')}));
    ok(!t.ps&&t.sess===16&&t.code,'16: #checkout com a lista antiga: '+J(t));
    ok(await espera(pg,()=>ETERNA.psEstado('LPPS00002')==='livre',30000),'16: a sessão chega a este navegador');
    await pg.evaluate(()=>{ETERNA.simOf('LPPS00002').status='paga';ETERNA.saveSim();ETERNA.checkoutPick('LPPS00002');});await pg.waitForTimeout(200);
    ok(await pg.evaluate(()=>ETERNA.state.checkout.session==='LPPS00002'),'16: com a chave desligada o checkoutPick é o de antes');await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.slice(0,4).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e));}
await b.close();
console.log(fails.length?'FALHA posto-procurar-sessao: '+fails.join(' || '):'OK posto-procurar-sessao: botão no rodapé, filtros de fotógrafo e horário, cartões com miniaturas, estados (vendida, pedido, carregando), código, ciclo do servidor, 5 línguas, 390 px, chave desligada e sem agente');
process.exit(fails.length?1:0);
})();
