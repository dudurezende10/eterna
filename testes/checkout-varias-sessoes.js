// v91 parte B (Eduardo, 01/11; revisões de segurança B1 a B3 e de código C2 e C3). No Checkout, a selfie traz todas as sessões
// do dia em que a pessoa aparece com certeza (>= FACE_SIM), cada uma INTEIRA (a família junta no balcão), e abre direto na
// primeira foto ampliada (tela cheia), com ponto · hora na foto. Sessão só com "talvez" pergunta "Esta sessão também é sua?"
// (até 3 miniaturas pequenas), nunca para sessão de menor. A venda fica na sessão com mais fotos claras dela, com galeria
// própria; a família dona da outra sessão ainda compra depois e nenhuma foto comprada por outro vira "comprada" na galeria.
// Agente falso (page.route): /status, /sessoes, /thumb/, /file/, /rostos/buscar, /ponto/eventos. Rostos e fotos simulados.
// Mede o tempo do resultado da busca até a primeira foto ampliada na tela, com 3.000 fotos no dia.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.SESSOES_PRINTS||path.join(__dirname,'prints');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const num={};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(10):
    im=Image.new('RGB',(300,200),(40+i*20,90+(i*31)%110,160-i*10));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(20+i*18,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(3000,2000),(30,60,110));d=ImageDraw.Draw(im);d.ellipse([1300,300,1700,700],fill=(230,200,170));d.rectangle([1100,720,1900,2000],fill=(40,80,140))
b=io.BytesIO();im.save(b,'JPEG',quality=90);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const GRANDE=cores.pop(); // original de 3000 x 2000 (o /file/ da câmera)
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
// A: família no Terminal Campo (Carlos, mais cedo); B: ela sozinha 10 min depois no Campo 4 (Samuel); C: outra família no Campo 2
// em que ela só "talvez" aparece; D: sessão de menor em que ela "talvez" aparece (nunca pergunta)
const A=ids('aaa',6),B=ids('bbb',4),C=ids('ccc',5),D=ids('ddd',3);
const ses=(card,fotos,who,ponto,t0,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev});
const FEED=[ses('LPTFAMA01',A,'carlos','terminal',a-1500,1),ses('LPTSOLO02',B,'samuel','campo4',a-900,2),ses('LPTOUTR03',C,'yago','campo2',a-700,3),ses('LPTMENO04',D,'yago','campo2',a-650,4)];
// ela: A1, A2 claras (2); B1, B2, B3 claras (3: âncora, mesmo sendo a mais nova); A3 talvez; C1, C2 talvez; D1 talvez
let SIMS={[A[0]]:.71,[A[1]]:.66,[A[2]]:.41,[B[0]]:.69,[B[1]]:.62,[B[2]]:.58,[C[0]]:.42,[C[1]]:.40,[D[0]]:.43};
let VARIAS=false;const EVENTOS=[];
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,agent:'eterna-agente',version:3,boot:'b91',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:4,gen:'b91',hoje:4,abertas:0,dias:1}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,gen:'b91',rev:4,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-2),16)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:GRANDE}));
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(VARIAS?{rosto:true,varias:true,fotos:[]}:{rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}(j.eventos||[]).forEach(e=>EVENTOS.push(e));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(m.text());});
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>{const S=ETERNA.SIM.sessions;return ['LPTFAMA01','LPTSOLO02','LPTOUTR03','LPTMENO04'].every(c=>S[c]);},20000),'as sessões do servidor chegaram ao SIM');
  // a validação de IA do navegador roda sobre quadrados de cor: aqui as fotos contam como válidas. D é sessão de menor.
  // Mais 116 sessões de 25 fotos: o dia com 3.000 fotos (a busca e o desenho do Checkout com o volume de verdade)
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));S.sessions.LPTMENO04.menor=true;
    const url=ETERNA.state.agent.url;for(let i=0;i<116;i++){const card='LPV'+String(i).padStart(6,'0');const ph=[];for(let j=0;j<25;j++){const pid='e'+String(i).padStart(4,'0')+String(j).padStart(7,'0');ETERNA.UP['ag_'+pid]={src:url+'/thumb/'+pid,name:pid};ph.push({id:'ag_'+pid,sold:0});}
      S.sessions[card]={key:'carlos',pdv:'Terminal Campo',point:'terminal',time:'10:00',date:'hoje',srv:true,status:'fechada',selected:[],cart:[],photos:ph,openedAt:new Date(Date.now()-5*3600e3+i*60e3).toISOString()};}});
  num.fotos_no_dia=await pg.evaluate(()=>ETERNA.demoSessions().filter(s=>!s.demo).reduce((n,s)=>n+s.photos.length,0));
  const busca=()=>pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;return ETERNA.faceFind([c],x=>!x.demo);});
  // uma pessoa por vez: com dois rostos, a busca não junta nada
  VARIAS=true;const rv=await busca();ok(rv.varias===true&&!rv.res,'antifraude: duas pessoas na câmera não buscam: '+JSON.stringify(rv));VARIAS=false;
  // só "talvez" em sessão nenhuma clara: fluxo antigo (lojaJuntar devolve false)
  const so_tv=await pg.evaluate(()=>ETERNA.lojaJuntar([],[{card:'LPTOUTR03',fotos:['ag_ccc000000001'],sc:.42}],{}));ok(so_tv===false,'sem foto clara: segue o "É uma destas?" de antes');
  // busca + abertura: do resultado até a primeira foto ampliada na tela (a captura dos 3 quadros fica fora)
  const r=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;ETERNA.state.cam.busy=true; /* como o camFound: a validação de IA do Checkout pausa */await new Promise(r=>setTimeout(r,300));const t0=performance.now();const r=await ETERNA.faceFind([c],x=>!x.demo);const t1=performance.now();
    ETERNA.state.cam.busy=false;const okj=ETERNA.lojaJuntar(r.res,r.talvez,r.sims);return {okj,ms_busca:t1-t0,ms_juntar:performance.now()-t1,res:r.res.map(x=>x.card).sort(),tv:r.talvez.map(x=>x.card).sort(),step:ETERNA.state.kiosk.step,ask:(ETERNA.state.kiosk.tv||{ask:[]}).ask.map(q=>q.card+':'+q.fotos.length)};});
  num.app_busca_ms=Math.round(r.ms_busca);
  ok(r.okj&&r.res.join()==='LPTFAMA01,LPTSOLO02','a selfie acha as duas sessões com foto clara: '+JSON.stringify(r));
  ok(r.step==='talvez'&&r.ask.join()==='LPTOUTR03:2','"talvez" pergunta pela sessão (C), nunca pela de menor (D): '+JSON.stringify(r.ask));
  await pg.waitForTimeout(250);
  const txt=await pg.textContent('#main');ok(/Esta sessão também é sua\?/.test(txt),'pergunta "Esta sessão também é sua?"');ok(!/LPT|LPV/.test(txt),'nenhum código de sessão na tela do cliente');
  ok(await pg.$$eval('.lj-tvph',x=>x.length)===2&&await pg.$$eval('.lj-tvph',x=>x.every(e=>e.getBoundingClientRect().width<=160)),'até 3 miniaturas pequenas');
  fs.mkdirSync(PRINTS,{recursive:true});await pg.screenshot({path:path.join(PRINTS,'v91-checkout-talvez.png')});
  const t2=Date.now();await pg.click('[data-act="kiosk-tv-nao"]');
  ok(await espera(()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'depois da selfie abre direto na foto ampliada (tela cheia)');
  num.app_tela_cheia_ms=Date.now()-t2;
  const k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,ver:k.ver,code:k.code,cards:k.so&&k.so.cards,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3,6)),lb:(document.querySelector('.lj-lbsrc')||{}).textContent||'',cnt:(document.querySelector('.lj-lbcnt')||{}).textContent||'',toast:(document.querySelector('#toast')||{}).textContent||''};});
  ok(k.step==='review'&&k.ver===0&&k.code==='LPTSOLO02','venda na sessão com mais fotos claras (B), não na primeira por hora: '+JSON.stringify({step:k.step,ver:k.ver,code:k.code}));
  // v97 (Eduardo, 10/11): no Checkout a selfie abre as levas inteiras em que ela aparece com foto clara (e as da visita); muda a regra da v95
  ok((k.cards||[]).join()==='LPTFAMA01,LPTSOLO02'&&k.fotos.join()==='aaa,aaa,aaa,aaa,aaa,aaa,bbb,bbb,bbb,bbb','v97: as levas A e B inteiras, em ordem de hora, sem C: '+k.fotos.join());
  ok(/Terminal Campo/.test(k.lb),'ponto · hora na própria foto ampliada: '+k.lb);ok(!/LP/.test(k.toast),'mensagem de achado sem códigos: '+k.toast);
  await pg.waitForTimeout(400);await pg.screenshot({path:path.join(PRINTS,'v91-checkout-telacheia.png')});
  // a foto grande da primeira já veio pré-carregada
  num.foto_grande_pronta=await espera(()=>{const u=ETERNA.state.agent.url+'/file/aaa000000001';return [...performance.getEntriesByType('resource')].some(e=>e.name===u&&e.responseEnd>0);},3000);
  // escolher em tela cheia: ✓ em A1 (avança), setas até a B2 e ✓
  await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(120);
  const iB=await pg.evaluate(()=>ETERNA.lojaItems(ETERNA.state.kiosk.code).findIndex(x=>x.k==='ag_bbb000000002'));
  for(let i=0;i<40&&await pg.evaluate(()=>ETERNA.state.kiosk.ver)<iB;i++){await pg.click('#lj-lb .lj-lbnav.next');await pg.waitForTimeout(60);}
  const lbB=await pg.textContent('.lj-lbsrc');ok(/Foto Campo 4/.test(lbB),'percorre as fotos das duas sessões na tela cheia: '+lbB);
  await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(120);
  ok((await pg.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code).ch.map(x=>x.k).sort().join()))==='ag_aaa000000001,ag_bbb000000002','duas fotos escolhidas em tela cheia');
  // v96: sem pacote e sem pagamento no Checkout; o Continuar manda as 2 fotos ao atendente, que escolhe pacote e meio no Posto
  await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(300);
  ok(await espera(()=>ETERNA.state.kiosk.step==='done'),'pedido feito');
  ok(await pg.evaluate(()=>{const p=ETERNA.state.kiosk.paid;const r=ETERNA.SIM.caixaDin[0];return p.escolha&&p.total==null&&r.n===2&&ETERNA.vendaCalc(2,2,ETERNA.lojaIdeal(2).pkg).total===ETERNA.lojaIdeal(2).custo;}),'pedido de 2 fotos sem valor; o preço pela quantidade sai no Posto');
  const rec=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];const m=ETERNA.SIM.galerias[r.token];return {id:r.id,card:r.card,sessoes:r.sessoes,sel:r.selected.slice().sort(),token:r.token,codigo:r.codigo,venda:!!m.venda,gs:m.sessoes,stA:ETERNA.SIM.sessions.LPTFAMA01.status,stC:ETERNA.SIM.sessions.LPTOUTR03.status};});
  ok(rec.card==='LPTSOLO02'&&(rec.sessoes||[]).join()==='LPTFAMA01,LPTSOLO02'&&rec.sel.join()==='ag_aaa000000001,ag_bbb000000002','uma venda só, ancorada em B, com as duas sessões: '+JSON.stringify(rec));
  ok(rec.venda&&rec.gs.join()==='LPTSOLO02,LPTFAMA01','galeria própria da venda (âncora primeiro): '+JSON.stringify(rec.gs));
  ok(rec.stA!=='aguardando'&&rec.stA!=='paga'&&rec.stC!=='aguardando','B1: a sessão da família (A) e a outra (C) não ficam aguardando: '+rec.stA+' '+rec.stC);
  // o vendedor confirma no Posto de venda (outra janela do mesmo navegador, logada)
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U);await pg2.waitForTimeout(400);
  await pg2.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg2.click('button[type=submit]');await pg2.waitForTimeout(200);
  {const otp=await pg2.$('.otp');if(otp){await pg2.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg2.waitForTimeout(500);}}
  const confirma=id=>pg2.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});return ETERNA.pendConfirmar(id,{ref:'123456'});},id);
  ok(await confirma(rec.id),'pagamento confirmado');
  // v96 (revisão 2): preço de várias sessões no Posto: o Ideal pelas 2 fotos escolhidas (das duas sessões), venda com esse valor
  {const v=await pg2.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);const s=ETERNA.SIM.sessions[r.card];const id2=ETERNA.lojaIdeal(2);
    return {n:r.n,ses:(r.sessoes||[]).length,tot:r.total,ideal:id2.custo,pkg:r.pkg,ipkg:id2.pkg,st:s.status,stot:s.total,nSes:r.nSes,todas:ETERNA.vendaCalc(r.n,r.nSes,'mais').save===Math.max(0,70+(r.nSes-1)*35-250) /* Arquibancada + adicionais contra o Todas (catálogo do Tour) */};},rec.id);
    ok(v.n===2&&v.ses===2&&v.pkg===v.ipkg&&v.tot===v.ideal&&v.st==='paga'&&v.stot===v.ideal&&v.nSes>=2&&v.todas,'v96: várias sessões: pacote Ideal para as 2 fotos, valor gravado na venda e "Todas" contando as fotos das sessões: '+JSON.stringify(v));}
  // v96: o "criar" sai na confirmação, com a hora do pedido
  {const t0=Date.now();while(Date.now()-t0<8000&&!EVENTOS.some(e=>e.tipo==='criar'))await pg.waitForTimeout(200);}
  const ev=EVENTOS.find(e=>e.tipo==='criar');ok(ev&&(ev.dados.sessoes||[]).join()==='LPTFAMA01,LPTSOLO02'&&ev.dados.card==='LPTSOLO02','evento "criar" (vendas.db) com as duas sessões');
  // v92 (critério 3 pelo lojaPedido de verdade): canal, idioma, carrinho e t0 antes do pedido
  ok(ev&&ev.dados.canal==='checkout'&&ev.dados.lang==='pt'&&Array.isArray(ev.dados.cart)&&ev.dados.cart.length>0&&ev.dados.t0&&Date.parse(ev.dados.t0)<=Date.parse(ev.em),'v92: o Checkout manda canal, lang, cart e t0 anterior ao pedido: '+JSON.stringify(ev&&{canal:ev.dados.canal,lang:ev.dados.lang,t0:ev.dados.t0,em:ev.em}));
  const galDela=()=>pg.evaluate(tok=>{ETERNA.simFresh();ETERNA.galAtualizar(tok);const m=ETERNA.SIM.galerias[tok];return m.fotos.map(f=>f.id.slice(3)+':'+f.direito);},rec.token);
  let gd=await galDela();
  ok(gd.filter(x=>/comprada/.test(x)).sort().join()==='aaa000000001:comprada,bbb000000002:comprada'&&gd.length===10,'v97: galeria da venda com as levas inteiras do Checkout, as 2 dela compradas: '+gd.join());
  // C3: ela volta ao Checkout: B (já paga) sai e A aparece sem a foto que ela já comprou
  SIMS={[A[0]]:.71,[A[1]]:.66,[B[0]]:.69,[B[1]]:.62,[B[2]]:.58};
  const voltaJ=()=>pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');const r=await ETERNA.faceFind([c],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);const k=ETERNA.state.kiosk;return {code:k.code,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3)).sort()};});
  const volta=await voltaJ();
  ok(volta.code==='LPTFAMA01'&&volta.fotos.join()==='aaa000000002,aaa000000003,aaa000000004,aaa000000005,aaa000000006','C3: quem volta só vê o que ainda não foi comprado (v97: a leva A inteira): '+JSON.stringify(volta));
  // B1: a família de A ainda compra depois (selfie clara só em A)
  SIMS={[A[3]]:.72,[A[4]]:.66};
  const fam=await pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');const r=await ETERNA.faceFind([c],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);const k=ETERNA.state.kiosk;return {code:k.code,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3))};});
  ok(fam.code==='LPTFAMA01'&&fam.fotos.join()==='aaa000000002,aaa000000003,aaa000000004,aaa000000005,aaa000000006','a família de A compra depois: sessão A sem a foto já vendida (v97: inteira): '+JSON.stringify(fam));
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.ver=null;ETERNA.render();});await pg.waitForTimeout(200);
  {const i=await pg.evaluate(()=>ETERNA.lojaItems(ETERNA.state.kiosk.code).findIndex(x=>x.k==='ag_aaa000000005'));await pg.click(`.lj-gok[data-i="${i}"]`);await pg.waitForTimeout(120);}
  await pg.click('.lj-foot [data-act="loja-cart"]');await pg.waitForTimeout(250); // v96: o Continuar já faz o pedido
  ok(await espera(()=>ETERNA.state.kiosk.step==='done'),'pedido da família de A feito (nada barrou)');
  const recA=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,card:r.card,token:r.token};});
  ok(recA.card==='LPTFAMA01'&&recA.token!==rec.token,'venda da família de A na sessão A, com outra galeria');
  ok(await confirma(recA.id),'pagamento da família de A confirmado');
  gd=await galDela();
  ok(!gd.includes('aaa000000005:comprada'),'B2: a foto que a família de A comprou não vira "comprada" na galeria dela: '+gd.join());
  const gA=await pg.evaluate(tok=>{ETERNA.simFresh();ETERNA.galAtualizar(tok);return ETERNA.SIM.galerias[tok].fotos.filter(f=>f.direito==='comprada').map(f=>f.id.slice(3));},recA.token);
  ok(gA.join()==='aaa000000005','B2: na galeria da família de A, só a foto dela comprada: '+gA.join());
  // C3: depois que a família pagou A, nada sobra para ela: mostra de novo o QR da venda DELA (a sessão âncora)
  SIMS={[A[0]]:.71,[A[1]]:.66,[B[0]]:.69,[B[1]]:.62,[B[2]]:.58};
  await voltaJ();
  ok(await espera(()=>ETERNA.state.kiosk.step==='done',3000)&&await pg.evaluate(t=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.token===t,rec.token),'C3: tudo comprado = "já pago" com o QR da venda dela');
  // C2: um pedido novo sem pagar refaz a galeria da venda do zero
  const c2=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.galTok=null;k.so={card:'LPTOUTR03',cards:['LPTOUTR03','LPTFAMA01'],ids:['ag_ccc000000001','ag_aaa000000002']};
    const t1=ETERNA.galDaVendaJunta('LPTOUTR03',['LPTOUTR03','LPTFAMA01'],['ag_ccc000000001','ag_aaa000000002']);
    const t2=ETERNA.galDaVendaJunta('LPTOUTR03',['LPTOUTR03'],['ag_ccc000000002']);const m=ETERNA.SIM.galerias[t2];return {mesmo:t1===t2,ses:m.sessoes,so:m.so};});
  ok(c2.mesmo&&c2.ses.join()==='LPTOUTR03'&&JSON.stringify(c2.so)==='{"LPTOUTR03":["ag_ccc000000002"]}','C2: pedido não pago refaz sessões e escolha do zero: '+JSON.stringify(c2));
  // código: o da galeria da venda abre só a escolha daquela venda (paga: mostra o QR de novo); código errado 5 vezes trava
  await pg.evaluate(()=>{ETERNA.state.kiosk.step='emerg';ETERNA.state.kiosk.so=null;ETERNA.render();});await pg.waitForTimeout(200);
  await pg.fill('#kcode',rec.codigo);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(400);
  const cg=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,cards:k.so&&k.so.cards,code:k.code};});
  ok(cg.code==='LPTSOLO02'&&(cg.cards||[]).join()==='LPTSOLO02,LPTFAMA01'&&cg.step==='done','código da galeria da venda: a mesma venda, já paga = QR de novo: '+JSON.stringify(cg));
  await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(150);
  for(let i=0;i<5;i++){await pg.fill('#kcode','ZZZZ-ZZZ'+i);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(60);}
  await pg.fill('#kcode','LPTOUTR03');await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step)==='emerg','5 códigos errados travam o campo por 1 minuto');
  await pg.evaluate(()=>ETERNA.lojaCodReset());
  await pg.fill('#kcode','LPTOUTR03');await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(300);
  const cod=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {so:k.so,n:ETERNA.lojaFotos(k.code).length,step:k.step};});
  ok(cod.so===null&&cod.n===5&&cod.step==='review','código do recibo abre a sessão inteira daquele código: '+JSON.stringify(cod));
  await pg2.close();await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const f=fails.filter(Boolean);const okk=!f.length;console.log(`${okk?'OK':'FALHA'} checkout-varias-sessoes: família inteira, tela cheia, talvez por sessão, venda ancorada, B1 a B3, C2, C3 · ${JSON.stringify(num)}${okk?'':' · '+f.slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
