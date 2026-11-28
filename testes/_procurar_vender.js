// Apoio dos testes de vender pelo Procurar fotos (procurar-vender.js e procurar-sem-vazar.js). Agente falso por page.route na própria
// origem (/status, /sessoes, /thumb/, /file/, /ponto/eventos, /ponto/vendas-dia), sessões e fotos simuladas, cadastros de teste.
// Vendedor e Checkout são duas páginas do MESMO contexto (mesmo computador: dividem o localStorage e o canal eterna-loja).
// Fase 2 (busca por selfie): o.rotas(caminho, pedido) devolve {corpo,status,espera} para uma rota a mais do agente falso (ou nada);
// o.rostos===false desliga o reconhecimento no /status e o.buscaVend===false a busca do vendedor no servidor; ligaSelfie liga a chave da
// tela (que nasce desligada) no index.html servido ao teste; o gravador também guarda as câmeras abertas em cada janela (window.__cams).
const entrarTeste=require('./_entrar');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const J=JSON.stringify;
const JPG=fs.readFileSync(path.join(__dirname,'..','img','ativ-snap.jpg'));
const dia=t=>{const d=new Date(t*1000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const AGORA=Date.now()/1000;const hoje=dia(AGORA);
const fotos=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(8,'0'));
// As sessões são sempre de hoje: perto da meia-noite os minutos encolhem para caber no dia (nenhuma hora cai em ontem).
const MEIA=new Date(new Date(AGORA*1000).setHours(0,0,0,0)).getTime()/1000;const VAO=Math.max(1,Math.min(20*60,AGORA-MEIA-120));const naoOntem=v=>typeof v==='number'?Math.max(v,MEIA+1):v;
function sessao(o){const t=AGORA-((o.min||5)/20)*VAO;const r=sessao0(o,t);['aberta_em','cap0','cap1','ultima_chegada'].forEach(k=>{r[k]=naoOntem(r[k]);});return r;}
function sessao0(o,t){return Object.assign({card:o.card,dia:hoje,fotografo:'samuel',fonte:'ftp',ponto:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:t-50,ultima_chegada:t,cap0:t-45,cap1:t-2,fonte_t:'cap',fechada_em:t+60,fechada_por:'pausa',fotos:[],pend:[],dec:{},ia:[],sim_abertura:null,fundida_em:null,removida:false,rev:1},o);}
// A, B, C e D livres; as outras, cada uma num estado que desliga a caixa
const C={A:'LPPVA0001',B:'LPPVB0002',C:'LPPVC0003',D:'LPPVD0004',ABERTA:'LPPVABERT',PAGA:'LPPVPAGA1',PEDIDO:'LPPVPEDI1',FORA:'LPPVFORA1',MENOR:'LPPVMENOR'};
const F={A:fotos('pvaa',4),B:fotos('pvbb',6),C:fotos('pvcc',3),D:fotos('pvdd',5),ABERTA:fotos('pvab',2),PAGA:fotos('pvpg',2),PEDIDO:fotos('pvpe',2),FORA:fotos('pvfo',2),MENOR:fotos('pvme',2)};
const ADMIN='admin.teste@exemplo.com',FOTO='fotografo.teste@exemplo.com',CAIXA='caixa.teste@exemplo.com',QUIOSQUE='quiosque.teste@exemplo.com';
function feed(){const S=[];let rev=0;const poe=(k,o)=>{S.push(sessao(Object.assign({card:C[k],fotos:F[k],rev:++rev},o)));};
  poe('A',{min:4,fotografo:'samuel',num:147});poe('B',{min:6,fotografo:'samuel'});poe('C',{min:8,fotografo:'carlos',num:201});poe('D',{min:10,fotografo:'carlos',num:202}); // A, C e D com o número da sessão; B sem (servidor antigo)
  poe('ABERTA',{min:1,status:'aberta',fechada_em:null,fechada_por:null});poe('PAGA',{min:12});poe('PEDIDO',{min:14});poe('FORA',{min:16});poe('MENOR',{min:18});return {gen:'pv1',rev,sessoes:S};}
// troca: função que recebe o index.html e devolve o que será servido (ex.: a chave desligada)
async function contexto(b,o){o=o||{};const FEED=o.feed||feed();const EVENTOS=[];const errs=[];
  const ctx=await b.newContext({viewport:{width:1366,height:820},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(()=>{Element.prototype.requestFullscreen=function(){return Promise.resolve();};
    // gravador: tudo o que passa pelo canal, as etapas do Checkout e qualquer pedaço do Procurar fotos que apareça no DOM desta janela
    window.__msgs=[];try{const ch=new BroadcastChannel('eterna-loja');ch.onmessage=e=>{try{window.__msgs.push(JSON.stringify(e.data));}catch(x){}};window.__ch=ch;}catch(e){}
    window.__steps=[];window.__bf=0;window.__tv=0;window.__cams=[];
    try{const md=navigator.mediaDevices;if(md&&md.getUserMedia){const g=md.getUserMedia.bind(md);md.getUserMedia=function(c){if(window.__camErro)return Promise.reject(new DOMException('ocupada',window.__camErro));return g(c).then(s=>{window.__cams.push(s);return s;});};}}catch(e){}
    setInterval(()=>{try{const k=window.ETERNA&&ETERNA.state.kiosk;if(k){if(!window.__steps.includes(k.step))window.__steps.push(k.step);if(k.tv)window.__tv++;}
      if(document.querySelector('#bf,#bf-barra,.bf-card,.bf-marca,.bf-mk,.bf-sess,.bf-bmini,#bf-selfie-modal,.bf-sf,.bf-sfc,.bf-bateu,[data-act^="bf-selfie"]'))window.__bf++;}catch(e){}},40);});
  if(o.troca){const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const body=o.troca(html);if(body===html)throw new Error('a troca do index.html não achou o trecho');
    await ctx.route(u=>u.pathname.endsWith('/index.html'),r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Cache-Control':'no-store'},body}):r.continue());}
  await ctx.route(ORIG+'/**',r=>{const rq=r.request();const u=new URL(rq.url());const p=u.pathname;const j=(x,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(x)});
    if(/\.(html|js|css|png|jpg|jpeg|webp|svg|json|woff2?|ico|wasm|onnx)$/.test(p))return r.fallback();
    if(p.startsWith('/auth/'))return r.fallback();
    if(p==='/status')return j({ok:true,agent:'eterna-agente',version:3,boot:FEED.gen,card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:o.rostos!==false,busca_vend:o.buscaVend!==false},sessoes:{v:2,pausa:60,rostos:true,rev:FEED.rev,gen:FEED.gen,hoje:FEED.sessoes.length,abertas:1}});
    if(p==='/sessoes'){const d=+u.searchParams.get('desde')||0;return j({ok:true,gen:FEED.gen,rev:FEED.rev,pausa:60,rostos:true,completo:!d,sessoes:FEED.sessoes.filter(x=>x.rev>d&&u.searchParams.get('ontem')!=='1')});}
    if(p.startsWith('/thumb/')||p.startsWith('/file/'))return r.fulfill({status:200,contentType:'image/jpeg',body:JPG});
    if(p==='/events')return j({events:[],next:0,total:0});
    if(p==='/ponto/vendas-dia')return j({ok:true,dia:hoje,vendas:EVENTOS.filter(e=>e.tipo==='criar').map(e=>({venda:e.venda,em:e.em,posto:'Caixa 1',saleNo:e.dados.saleNo||'',card:e.dados.card,sessoes:e.dados.sessoes||[],origem:e.dados.origem||null,meio:'pix',total:e.dados.total,prints:0,vendedor:'',cart:[],selected:[],aiSel:[],galeria:null})).concat([{venda:'vfora1',em:new Date().toISOString(),posto:'Caixa 2',saleNo:'L0-900',card:C.FORA,sessoes:[C.FORA],meio:'pix',total:100,prints:1,vendedor:'Outro posto',cart:[],selected:[],aiSel:[],galeria:null}])});
    if(p==='/ponto/eventos'){let q={};try{q=JSON.parse(rq.postData()||'{}');}catch(e){}(q.eventos||[]).forEach(e=>EVENTOS.push(e));return j({ok:true,resultados:(q.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))});}
    if(o.rotas){const x=o.rotas(p,rq);if(x){if(x.espera)return void setTimeout(()=>j(x.corpo,x.status).catch(()=>{}),x.espera);return j(x.corpo,x.status);}}
    if(rq.method()!=='GET')return j({ok:true});
    return j({erro:'sem_permissao'},403);});
  const pagina=async nome=>{const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(nome+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404|403/.test(m.text()))errs.push(nome+': '+m.text());});return pg;};
  return {ctx,FEED,EVENTOS,errs,pagina};}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||12000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(120);}return false;};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);
  await pg.evaluate(([a,f,c,q])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
    const novo=(e,n,pr,key)=>({v:2,email:e,name:n,preset:pr,key:key||null,active:true,perms:ETERNA.presetPerms(pr),menu:ETERNA.presetMenu(pr),inicio:ETERNA.PRESETS[pr].inicio||'',createdAt:'2026-11-26'});
    const adm=Object.values(U0).find(u=>u&&u.preset==='admin');U0[a]={...adm,email:a,name:'Admin de teste',key:null};
    U0[f]=novo(f,'Fotógrafo de teste','foto','samuel');U0[c]=novo(c,'Caixa de teste','venda');U0[q]=novo(q,'Checkout de teste','quiosque');
    localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[ADMIN,FOTO,CAIXA,QUIOSQUE]);
  await pg.reload();await pg.waitForTimeout(350);return entrarTeste(pg,email);}
const abrir=async(pg,h)=>{await pg.goto('about:blank');await pg.goto(U+h);await pg.waitForTimeout(450);};
// a página recarrega: espera o agente falso devolver as sessões e a lista aparecer
const procurar=async(pg,n)=>{await abrir(pg,'#procurar');return espera(pg,n=>document.querySelectorAll('#bf-lista .bf-card').length>=n,20000,n||9);};
const todas=Object.values(C);
const ligaSelfie=h=>h.replace('const PROCURAR_SELFIE_ON=false;','const PROCURAR_SELFIE_ON=true;');
const chegou=(pg,ms)=>espera(pg,cs=>cs.every(c=>ETERNA.SRV.sess[c])&&cs.filter(c=>ETERNA.SRV.sess[c].status==='fechada').every(c=>{const s=ETERNA.SIM.sessions[c];return s&&(s.photos||[]).length;}),ms||25000,todas);
// estados das sessões que não são livres: gravados no SIM pela janela do vendedor (a do Checkout adota pelo evento storage)
async function semear(V,L){await V.evaluate(C=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));
    ETERNA.simOf(C.PAGA).status='paga';ETERNA.simOf(C.PEDIDO).status='aguardando';S.sessions[C.MENOR].menor=true;ETERNA.saveSim();},C);
  if(L)return espera(L,C=>{const S=ETERNA.SIM.sessions;return S[C.PAGA]&&S[C.PAGA].status==='paga'&&S[C.MENOR]&&S[C.MENOR].menor===true;},8000,C);return true;}
// vendedor logado e Checkout aberto no mesmo contexto, com as sessões já nos dois
async function dupla(b,o){const x=await contexto(b,o);const V=await x.pagina('vendedor');if(!await entrar(V,(o&&o.quem)||CAIXA))throw new Error('o vendedor de teste não entrou');
  const L=await x.pagina('checkout');await L.goto(U+'#loja');await L.waitForTimeout(500);
  if(!await chegou(V)||!await chegou(L))throw new Error('as sessões do agente falso não chegaram às duas janelas');
  if(!await semear(V,L))throw new Error('o estado das sessões não chegou ao Checkout');
  if(!await espera(V,()=>{const e=ETERNA.state.eco;return !!(e&&e.m&&!e.fim&&e.m.tab);},12000))throw new Error('o vendedor não ouviu o Checkout pelo canal');
  return Object.assign(x,{V,L});}
const toque=async(pg,sel)=>{if(!await pg.evaluate(sel=>{const x=document.querySelector(sel);if(!x||x.disabled)return false;x.click();return true;},sel))throw new Error('sem o elemento (ou desligado) '+sel);await pg.waitForTimeout(150);};
const marca=(pg,card)=>toque(pg,'#bf-lista .bf-mk[data-card="'+card+'"] .bf-marca');
const aviso=pg=>pg.evaluate(()=>{const t=document.querySelector('#toast');return t&&t.hasAttribute('data-on')?t.textContent:'';});
const quiosque=pg=>pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code||'',cards:k.so?k.so.cards.slice():null,visita:k.so?k.so.visita:null,base:k.so?k.so.base:null,origem:k.so?k.so.origem||null:null,
  fotos:k.code?ETERNA.lojaItems(k.code).filter(x=>x.t==='ph').map(x=>x.id):[]};});
module.exports={ligaSelfie,hoje,U,ORIG,J,C,F,ADMIN,FOTO,CAIXA,QUIOSQUE,contexto,dupla,entrar,abrir,procurar,espera,chegou,semear,toque,marca,aviso,quiosque,todas};
