// 25/11 (plano docs/planos/2026-11-25-fotos-vizinhas-checkout.md, critérios 11 e 12). No Checkout, a selfie abre as fotos em
// que o rosto bateu e também as fotos vizinhas que o servidor do ponto devolve no campo "vizinhas" do /rostos/buscar (a
// família de costas, de perfil, olhando longe; mesma sessão e sessão seguinte do mesmo fotógrafo). O pedido chega ao Posto
// com todas. Só "talvez" não puxa vizinha; sessão de menor, sessão paga, base de IA e foto desconhecida nunca entram; sem o
// campo (servidor antigo ou chave desligada) tudo fica como antes. O interruptor fica no Painel de controle, só para o Admin.
// Agente falso (page.route): /status, /sessoes, /thumb/, /file/, /rostos/buscar, /ponto/eventos, /vizinhas/config. Fotos simuladas.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(6):
    im=Image.new('RGB',(300,200),(40+i*30,90+(i*31)%110,160-i*12));d=ImageDraw.Draw(im);d.rectangle([100,60,200,200],fill=(20+i*18,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
// R: sessão reconhecida do Carlos (R1 e R2 claras, R3 talvez, R4 e R5 de costas); N: a sessão seguinte do Carlos, 200 s depois
// (N1 e N2 vizinhas; N3 tem o rosto de outra pessoa e o servidor não devolve); T: sessão de outro fotógrafo só com "talvez";
// M: sessão de menor; P: sessão já paga
const R=ids('aaa',5),N=ids('bbb',3),T=ids('ccc',3),M=ids('ddd',2),P=ids('eee',2);
const ses=(card,fotos,who,ponto,t0,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev});
const FEED=[ses('LPVZREC01',R,'carlos','terminal',a-1500,1),ses('LPVZNEI02',N,'carlos','terminal',a-1250,2),ses('LPVZTAL03',T,'yago','campo2',a-900,3),ses('LPVZMEN04',M,'carlos','terminal',a-800,4),ses('LPVZPAG05',P,'carlos','terminal',a-700,5)];
const VIZ_PADRAO=[{id:R[3],card:'LPVZREC01',mesma:true},{id:R[4],card:'LPVZREC01',mesma:true},{id:N[0],card:'LPVZNEI02',mesma:false},{id:N[1],card:'LPVZNEI02',mesma:false}];
let SIMS={[R[0]]:.71,[R[1]]:.66,[R[2]]:.41};let VIZ=VIZ_PADRAO;const BUSCAS=[];const EVENTOS=[];const POSTS=[];
let CHAVE={ligada:true,forcada:false,em:null};let COM_CHAVE=true;
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'bviz',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
  sessoes:Object.assign({v:2,pausa:60,rostos:true,rev:5,gen:'bviz',hoje:5,abertas:0,dias:1,visitas:{n:0,rev:0,rosto:false,rosto_em:null,calibracao:0}},COM_CHAVE?{vizinhas:CHAVE}:{})});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'bviz',rev:5,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-2),16)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:cores[0]}));
  await ctx.route(ORIG+'/rostos/buscar',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}BUSCAS.push({todo:j.todo===true,grupo:j.grupo===true});
    const resp={rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim})),limite:.45,janela_min:150,fila:0};
    if(VIZ&&!j.todo){resp.vizinhas=VIZ;resp.viz={ligada:true,n:VIZ.length,ms:1,corte:null};}
    r.fulfill({status:200,contentType:'application/json',body:J(resp)});});
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}(j.eventos||[]).forEach(e=>EVENTOS.push(e));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  await ctx.route(ORIG+'/vizinhas/config',r=>{const q=r.request();let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}POSTS.push({j,x:q.headers()['x-eterna']});
    CHAVE={ligada:j.ligada===true,forcada:false,em:'2026-11-25T23:00:00'};r.fulfill({status:200,contentType:'application/json',body:J({ok:true,ligada:CHAVE.ligada,forcada:false,em:CHAVE.em,por:'admin'})});});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(m.text());});
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>{const S=ETERNA.SIM.sessions;return ['LPVZREC01','LPVZNEI02','LPVZTAL03','LPVZMEN04','LPVZPAG05'].every(c=>S[c]);},20000),'as sessões do servidor chegaram ao SIM');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));S.sessions.LPVZMEN04.menor=true;S.sessions.LPVZPAG05.status='paga';});
  const selfie=(comViz)=>pg.evaluate(async(comViz)=>{ETERNA.lojaReset();const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);
    const okj=comViz?ETERNA.lojaJuntar(r.res,r.talvez,r.sims,r.viz):ETERNA.lojaJuntar(r.res,r.talvez,r.sims);const k=ETERNA.state.kiosk;
    return {okj,nviz:(r.viz||[]).length,step:k.step,code:k.code,cards:k.so&&k.so.cards,fotos:k.code?ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3,6)+p.id.slice(-1)):[],ask:((k.tv||{}).ask||[]).map(q=>q.card+':'+q.todas.length)};},comViz);
  const SO_ROSTO='aaa1,aaa2,aaa3';const COM_VIZ='aaa1,aaa2,aaa3,aaa4,aaa5,bbb1,bbb2';
  // ---------- antes: sem as vizinhas (chamada antiga do lojaJuntar e servidor sem o campo) ----------
  let r=await selfie(false);
  ok(r.okj&&r.fotos.join()===SO_ROSTO&&(r.cards||[]).join()==='LPVZREC01','sem passar as vizinhas, a selfie abre só as fotos do rosto: '+J(r));
  VIZ=null;r=await selfie(true);
  ok(r.okj&&r.nviz===0&&r.fotos.join()===SO_ROSTO,'servidor sem o campo vizinhas (antigo ou chave desligada): tudo como antes: '+J(r));
  VIZ=VIZ_PADRAO;
  // ---------- 11: reconhecidas e vizinhas, em ordem de clique, sessão por sessão ----------
  r=await selfie(true);
  ok(r.okj&&r.nviz===4&&BUSCAS.length&&BUSCAS.every(x=>!x.todo),'o Checkout busca sem todo e recebe as vizinhas: '+J(r)+J(BUSCAS));
  ok(r.fotos.join()===COM_VIZ&&(r.cards||[]).join()==='LPVZREC01,LPVZNEI02'&&r.code==='LPVZREC01','reconhecidas e vizinhas juntas, na ordem do clique, venda na sessão reconhecida: '+J(r));
  ok(await espera(()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'abre direto na foto ampliada');
  const tela=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {n:ETERNA.lojaItems(k.code).filter(x=>x.t==='ph').length,txt:document.getElementById('main').textContent};});
  ok(tela.n===7&&!/LPVZ/.test(tela.txt),'7 fotos na escolha e nenhum código de sessão na tela do cliente: '+tela.n);
  // escolhe uma reconhecida, uma de costas da mesma sessão e uma da sessão vizinha; o pedido leva as três
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.ver=null;ETERNA.render();});await pg.waitForTimeout(200);
  for(const id of ['ag_'+R[0],'ag_'+R[4],'ag_'+N[0]]){const i=await pg.evaluate(id=>ETERNA.lojaItems(ETERNA.state.kiosk.code).findIndex(x=>x.k===id),id);await pg.click(`.lj-gok[data-i="${i}"]`);await pg.waitForTimeout(120);}
  await pg.click('.lj-foot [data-act="loja-cart"]');await pg.waitForTimeout(300);
  ok(await espera(()=>ETERNA.state.kiosk.step==='done'),'pedido feito');
  const rec=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,card:r.card,n:r.n,sessoes:r.sessoes,sel:(r.selected||[]).slice().sort()};});
  ok(rec.card==='LPVZREC01'&&rec.n===3&&(rec.sessoes||[]).join()==='LPVZREC01,LPVZNEI02'&&rec.sel.join()===['ag_'+R[0],'ag_'+R[4],'ag_'+N[0]].sort().join(),'o pedido chega ao Posto com as 3 fotos e as duas sessões: '+J(rec));
  // o Posto (outra janela, logada) confirma: a venda sai com as vizinhas
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await require('./_login.js')(pg2);
  const conf=await pg2.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(!r)return null;ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});const c=ETERNA.pendConfirmar(id,{ref:'123456'});
    const s=ETERNA.SIM.sessions[r.card];return {c:!!c,st:s.status,n:r.n};},rec.id);
  ok(conf&&conf.c&&conf.st==='paga'&&conf.n===3,'o Posto confirma o pedido com as vizinhas: '+J(conf));
  {const t0=Date.now();while(Date.now()-t0<8000&&!EVENTOS.some(e=>e.tipo==='criar'))await pg.waitForTimeout(200);}
  const ev=EVENTOS.find(e=>e.tipo==='criar');
  ok(ev&&(ev.dados.sessoes||[]).join()==='LPVZREC01,LPVZNEI02'&&ev.dados.card==='LPVZREC01','a venda vai ao servidor com as duas sessões: '+J(ev&&ev.dados&&{c:ev.dados.card,s:ev.dados.sessoes}));

  // ---------- 12 e proteções (cada caso direto no lojaJuntar, com a sessão reconhecida ainda sem pagar) ----------
  await pg.evaluate(()=>{ETERNA.simFresh();const s=ETERNA.SIM.sessions.LPVZREC01;s.status='fechada';ETERNA.SIM.caixaDin=[];ETERNA.saveSim();ETERNA.lojaReset();});
  const junta=(res,tv,viz)=>pg.evaluate(([res,tv,viz])=>{ETERNA.lojaReset();const okj=ETERNA.lojaJuntar(res,tv,{},viz);const k=ETERNA.state.kiosk;
    return {okj,step:k.step,cards:(k.so&&k.so.cards)||[],fotos:k.code?ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3,6)+p.id.slice(-1)):[],ask:((k.tv||{}).ask||[]).map(q=>q.card+':'+q.todas.length+':'+q.fotos.length)};},[res,tv,viz]);
  const clara=[{card:'LPVZREC01',fotos:['ag_'+R[0],'ag_'+R[1]],sc:.71,pri:2}];
  // só "talvez": não abre nada e não puxa vizinha
  r=await junta([],[{card:'LPVZREC01',fotos:['ag_'+R[2]],sc:.41}],VIZ_PADRAO);
  ok(r.okj===false&&r.step==='code'&&!r.cards.length,'12: só "talvez" não puxa vizinha (segue o "É uma destas?" de antes): '+J(r));
  SIMS={[R[2]]:.41,[T[0]]:.42};r=await selfie(true);
  ok(r.okj===false&&r.step==='code','12: busca só com "talvez" e vizinhas na resposta: nada abre: '+J(r));
  SIMS={[R[0]]:.71,[R[1]]:.66,[R[2]]:.41};
  // menor, paga, sessão desconhecida, foto que não é da sessão, base de IA, item torto: ficam fora
  await pg.evaluate(id=>{ETERNA.SIM.sessions.LPVZNEI02.ia=[id];},'ag_'+N[2]);
  r=await junta(clara,[],[{id:M[0],card:'LPVZMEN04'},{id:P[0],card:'LPVZPAG05'},{id:'fff000000001',card:'LPNAOEXISTE'},{id:T[0],card:'LPVZNEI02'},{id:N[2],card:'LPVZNEI02'},null,{id:5,card:'LPVZNEI02'},{id:N[1],card:'LPVZNEI02'}]);
  ok(r.okj&&r.fotos.join()==='aaa1,aaa2,bbb2'&&r.cards.join()==='LPVZREC01,LPVZNEI02','menor, paga, desconhecida, foto de outra sessão, base de IA e item torto ficam fora: '+J(r));
  await pg.evaluate(()=>{ETERNA.SIM.sessions.LPVZNEI02.ia=[];});
  // teto no navegador (200 itens, o maior que o servidor aceita) e lista que não é lista
  r=await junta(clara,[],Array.from({length:200},()=>({id:'zzz',card:'LPVZREC01'})).concat(VIZ_PADRAO));
  ok(r.okj&&r.fotos.join()==='aaa1,aaa2','só os 200 primeiros itens contam: '+J(r.fotos));
  r=await junta(clara,[],Array.from({length:80},()=>({id:'zzz',card:'LPVZREC01'})).concat(VIZ_PADRAO));
  ok(r.okj&&r.fotos.join()==='aaa1,aaa2,aaa4,aaa5,bbb1,bbb2','80 itens e mais os bons: entram: '+J(r.fotos));
  r=await junta(clara,[],{id:R[3],card:'LPVZREC01'});
  ok(r.okj&&r.fotos.join()==='aaa1,aaa2','vizinhas fora do formato: ignoradas: '+J(r.fotos));
  // sessão que ainda vai ser perguntada: a pergunta é a de sempre; as vizinhas dela só entram com o Sim
  const tvT=[{card:'LPVZTAL03',fotos:['ag_'+T[0]],sc:.42}];const vizT=VIZ_PADRAO.concat([{id:T[1],card:'LPVZTAL03',mesma:false}]);
  r=await junta(clara,tvT,vizT);
  ok(r.okj&&r.step==='talvez'&&r.ask.join()==='LPVZTAL03:2:1','a pergunta "Esta sessão também é sua?" continua, com 1 miniatura: '+J(r));
  await pg.waitForTimeout(200);await pg.click('[data-act="kiosk-tv-nao"]');await pg.waitForTimeout(300);
  let f=await pg.evaluate(()=>ETERNA.lojaFotos(ETERNA.state.kiosk.code).map(p=>p.id.slice(3,6)+p.id.slice(-1)).join());
  ok(f==='aaa1,aaa2,aaa4,aaa5,bbb1,bbb2','Não: a sessão em dúvida fica fora inteira; as outras vizinhas ficam: '+f);
  r=await junta(clara,tvT,vizT);await pg.waitForTimeout(200);await pg.click('[data-act="kiosk-tv-sim"]');await pg.waitForTimeout(300);
  f=await pg.evaluate(()=>ETERNA.lojaFotos(ETERNA.state.kiosk.code).map(p=>p.id.slice(3,6)+p.id.slice(-1)).join());
  ok(f==='aaa1,aaa2,aaa4,aaa5,bbb1,bbb2,ccc1,ccc2','Sim: entram a foto em dúvida e a vizinha daquela sessão: '+f);

  // ---------- interruptor no Painel de controle, só para o Admin ----------
  ok(await (async()=>{const t0=Date.now();while(Date.now()-t0<15000){if(await pg2.evaluate(()=>!!(ETERNA.state.agent.on&&ETERNA.state.agent.sessoes&&ETERNA.state.agent.sessoes.vizinhas)))return true;await pg2.waitForTimeout(150);}return false;})(),'o /status traz a chave');
  // ---------- Adicionar outra pessoa: cada selfie traz as vizinhas dela e a soma não perde nem repete ----------
  const soma=()=>pg.evaluate(()=>{const k=ETERNA.state.kiosk;const f=ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3,6)+p.id.slice(-1));return {step:k.step,code:k.code,cards:(k.so&&k.so.cards)||[],fotos:f.join(),unicas:new Set(f).size===f.length,mais:!!k.mais};});
  const outra=async(res,viz)=>{await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.ver=null;ETERNA.render();});await pg.waitForTimeout(150);await pg.click('[data-act="kiosk-mais"]');await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>!!ETERNA.state.kiosk.mais),'tela da selfie da outra pessoa');await pg.evaluate(([res,viz])=>{ETERNA.lojaJuntar(res,[],{},viz);},[res,viz]);await pg.waitForTimeout(300);return soma();};
  await pg.evaluate(()=>{ETERNA.SIM.sessions.LPVZPAG05.status='fechada';});
  r=await junta(clara,[],[{id:R[3],card:'LPVZREC01',mesma:true},{id:N[0],card:'LPVZNEI02',mesma:false}]);
  ok(r.fotos.join()==='aaa1,aaa2,aaa4,bbb1','pessoa 1 com as vizinhas dela: '+J(r.fotos));
  // pessoa 2: reconhecida em T1, com vizinhas T2 e de novo a N1 (repetida) e a N2
  let s2=await outra([{card:'LPVZTAL03',fotos:['ag_'+T[0]],sc:.7,pri:1}],[{id:T[1],card:'LPVZTAL03',mesma:true},{id:N[0],card:'LPVZNEI02',mesma:false},{id:N[1],card:'LPVZNEI02',mesma:false}]);
  ok(s2.code==='LPVZREC01'&&s2.fotos==='aaa1,aaa2,aaa4,bbb1,bbb2,ccc1,ccc2'&&s2.unicas&&s2.cards.join()==='LPVZREC01,LPVZNEI02,LPVZTAL03'&&!s2.mais,'pessoa 2: as vizinhas da primeira ficam, as dela somam, sem repetir: '+J(s2));
  // pessoa 3: reconhecida em P1 com a vizinha P2; nada das duas primeiras some
  let s3=await outra([{card:'LPVZPAG05',fotos:['ag_'+P[0]],sc:.7,pri:1}],[{id:P[1],card:'LPVZPAG05',mesma:true}]);
  ok(s3.code==='LPVZREC01'&&s3.fotos==='aaa1,aaa2,aaa4,bbb1,bbb2,ccc1,ccc2,eee1,eee2'&&s3.unicas,'pessoa 3: reconhecidas e vizinhas das três pessoas: '+J(s3));
  // foto do grupo: uma busca só (grupo:true) com duas pessoas em fotos diferentes traz as vizinhas das duas
  SIMS={[R[0]]:.71,[T[0]]:.64};VIZ=[{id:R[3],card:'LPVZREC01',mesma:true},{id:N[0],card:'LPVZNEI02',mesma:false},{id:T[1],card:'LPVZTAL03',mesma:true}];
  const grp=await pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo,true);ETERNA.lojaJuntar(r.res,r.talvez,r.sims,r.viz);const k=ETERNA.state.kiosk;
    return {fotos:k.code?ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3,6)+p.id.slice(-1)).join():'',cards:(k.so&&k.so.cards)||[]};});
  ok(grp.fotos==='aaa1,aaa4,bbb1,ccc1,ccc2'&&BUSCAS[BUSCAS.length-1].grupo===true&&!BUSCAS[BUSCAS.length-1].todo,'foto do grupo: vizinhas das duas pessoas: '+J(grp)+J(BUSCAS.slice(-1)));
  SIMS={[R[0]]:.71,[R[1]]:.66,[R[2]]:.41};VIZ=VIZ_PADRAO;
  // fora do Checkout (Posto, galerias) a busca vai com todo:true e nunca traz vizinhas
  const n0=BUSCAS.length;
  const fora=await pg2.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);return (r.viz||[]).length;});
  ok(BUSCAS.length===n0+1&&BUSCAS[n0].todo===true&&fora===0,'12: fora do Checkout a busca vai com todo:true e sem vizinhas: '+J(BUSCAS.slice(n0))+' '+fora);
  await pg2.evaluate(()=>{ETERNA.state.catTab='checkout';ETERNA.go('catalogo');});await pg2.waitForTimeout(400);
  const painel=await pg2.evaluate(()=>{const p=document.getElementById('viz-painel');const c=p&&p.querySelector('[data-act="viz-ligada"]');const v=document.getElementById('vis-rosto');
    return p&&{txt:p.textContent,checked:c.checked,dis:c.disabled,depois:!!(v&&(v.compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING))};});
  ok(painel&&/Fotos vizinhas na selfie do Checkout/.test(painel.txt)&&painel.checked===true&&painel.dis===false&&painel.depois&&!/—/.test(painel.txt),'Admin vê o interruptor ligado, ao lado do de visitas, sem travessão: '+J(painel));
  await pg2.click('[data-act="viz-ligada"]');
  const esp2=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg2.evaluate(fn))return true;await pg2.waitForTimeout(150);}return false;};
  ok(await esp2(()=>{const c=document.querySelector('#viz-painel [data-act="viz-ligada"]');return c&&!c.checked&&!c.disabled;}),'depois do clique fica desligado');
  ok(POSTS.length===1&&POSTS[0].x==='1'&&POSTS[0].j.ligada===false&&!('por' in POSTS[0].j),'POST /vizinhas/config com X-Eterna e ligada booleano (quem mudou vem da sessão): '+J(POSTS));
  ok(await pg2.evaluate(()=>(ETERNA.auditRead?ETERNA.auditRead():[]).filter(x=>x&&(x.acao||x.a||x.action)==='vizinhas_checkout').length)>=1,'auditoria vizinhas_checkout');
  await pg2.click('[data-act="viz-ligada"]');
  ok(await esp2(()=>{const c=document.querySelector('#viz-painel [data-act="viz-ligada"]');return c&&c.checked&&!c.disabled;})&&POSTS.length===2&&POSTS[1].j.ligada===true,'religar: '+J(POSTS));
  // os textos da equipe: 5 colunas no dicionário (pt, en, es, fr, de), sem travessão; a tela muda com o idioma de quem usa
  const dic=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').split('\n').filter(l=>/^  cf_viz_[a-z_]+:\[/.test(l)).map(l=>{const m=/^  (cf_viz_[a-z_]+):(\[.*\]),\s*$/.exec(l);return m&&[m[1],new Function('return '+m[2])()];});
  ok(dic.length===7&&dic.every(d=>d&&d[1].length===5&&d[1].every(t=>typeof t==='string'&&t.trim()&&!/—|–/.test(t))&&new Set(d[1]).size===5),'7 textos da equipe nas 5 línguas, sem travessão: '+dic.length);
  const txt=await pg2.evaluate(()=>{const u=ETERNA.state.user;const L=u.idioma;const out=[];for(const l of ['pt','en','es','fr']){u.idioma=l;out.push(ETERNA.vizPanel());}u.idioma=L;return out;});
  ok(new Set(txt).size===4&&txt.every(t=>t&&!/—|undefined|cf_viz_/.test(t)),'o painel muda com o idioma da equipe: '+new Set(txt).size);
  // não Admin: sem o painel e sem POST
  const naoAdm=await pg2.evaluate(async()=>{const u=ETERNA.state.user;const outro=JSON.parse(JSON.stringify(u));outro.preset='supervisor';outro.menu=['catalogo'];outro.perms={configuracao:{c:false,r:true,u:true,d:false},catalogo:{c:false,r:true,u:true,d:false}};
    ETERNA.state.user=outro;const html=ETERNA.vizPanel();await ETERNA.vizSalva(false);ETERNA.state.user=u;return {html};});
  ok(naoAdm.html===''&&POSTS.length===2,'não Admin: sem interruptor e sem POST: '+J({h:naoAdm.html.slice(0,40),n:POSTS.length}));
  // desligada pela variável do servidor: interruptor travado com o aviso; servidor sem a função: sem painel
  const forc=await pg2.evaluate(async()=>{const v=ETERNA.state.agent.sessoes.vizinhas;const g=Object.assign({},v);Object.assign(v,{ligada:false,forcada:true});ETERNA.render();const c=document.querySelector('#viz-painel [data-act="viz-ligada"]');
    const o={dis:c&&c.disabled,chk:c&&c.checked,txt:/ETERNA_VIZINHAS=0/.test(document.getElementById('viz-painel').textContent)};await ETERNA.vizSalva(true);Object.assign(v,g);
    const s=ETERNA.state.agent.sessoes;delete s.vizinhas;o.semFuncao=ETERNA.vizPanel();s.vizinhas=v;ETERNA.render();return o;});
  ok(forc.dis===true&&forc.chk===false&&forc.txt&&POSTS.length===2&&forc.semFuncao==='','variável do servidor: travado com aviso, sem POST; servidor sem a função: sem painel: '+J(forc));
  await pg2.close();await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const f=fails.filter(Boolean);const okk=!f.length;console.log(`${okk?'OK':'FALHA'} checkout-vizinhas: reconhecidas e vizinhas no Checkout, pedido no Posto com todas, "talvez" não puxa, proteções, chave só do Admin${okk?'':' · '+f.slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
