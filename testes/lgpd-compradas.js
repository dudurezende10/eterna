// Apagar fotos a pedido do cliente (LGPD) preserva o que foi comprado. Venda de visita: duas levas (A da família, B dela);
// a venda fica na âncora B e leva uma foto da leva A. Apagar pela leva A (que não fica 'paga') tira só as fotos não compradas:
// a comprada e a cortesia continuam na sessão, não vão no pedido de exclusão (o arquivo fica no servidor) e a galeria paga
// continua aberta e é publicada de novo. Com pedido aberto no Posto usando as fotos, a exclusão é recusada. Sessão sem
// compra continua como antes: todas as fotos saem e a galeria dela é encerrada.
// Sessão paga (a âncora B): o botão aparece enquanto sobra foto não comprada; apaga só essas e o recibo continua na tela.
// Servidor que preservou foto que a tela ainda não sabia que era do cliente (compra online de agora): a tela busca as vendas
// online, refaz a conta e só tira o que o servidor apagou; a galeria que o servidor manteve não é marcada como encerrada.
// Agente falso (page.route), como em checkout-varias-sessoes.js.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(4):
    im=Image.new('RGB',(300,200),(40+i*20,90+(i*31)%110,160-i*10));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(20+i*18,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
const A=ids('aaa',6),B=ids('bbb',4),C=ids('ccc',5),D=ids('ddd',4);
const ses=(card,fotos,who,ponto,t0,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev});
const FEED=[ses('LPTFAMA01',A,'carlos','terminal',a-1500,1),ses('LPTSOLO02',B,'samuel','campo4',a-900,2),ses('LPTOUTR03',C,'yago','campo2',a-700,3),ses('LPTQUAR04',D,'yago','campo3',a-600,4)];
const SIMS={[A[0]]:.71,[A[1]]:.66,[B[0]]:.69,[B[1]]:.62,[B[2]]:.58};
let LG=[];let PRES=null; // PRES = {ids, tokens(), venda}: o servidor preserva estas fotos, mantém a galeria e passa a listar a venda online
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const js=(r,o)=>r.fulfill({status:200,contentType:'application/json',body:J(o)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'blg',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:3,gen:'blg',hoje:3,abertas:0,dias:1}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'blg',rev:3,pausa:60,rostos:true,completo:true,sessoes:FEED}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-2),16)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:cores[0]}));
  await ctx.route(ORIG+'/rostos/buscar',r=>js(r,{rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim}))}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}js(r,{ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))});});
  await ctx.route(ORIG+'/lgpd/excluir',r=>{const j=JSON.parse(r.request().postData()||'{}');LG.push(j);
    if(PRES){const pr=(j.pids||[]).filter(x=>PRES.ids.includes(x));PRES.listar=true;return js(r,{ok:true,fotos:(j.pids||[]).length-pr.length,nuvem:0,galerias:0,preservadas:pr.length,galerias_mantidas:(j.tokens||[]).length,falhas:[]});} // só as contagens: a tela descobre quais pela venda online
    js(r,{ok:true,fotos:(j.pids||[]).length,nuvem:0,galerias:(j.tokens||[]).length,falhas:[]});});
  await ctx.route(ORIG+'/galerias/vendas*',r=>js(r,PRES&&PRES.listar?{vendas:[PRES.venda],next:1}:{vendas:[],next:0}));
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(m.text());});
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg,p)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await (p||pg).evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>{const S=ETERNA.SIM.sessions;return ['LPTFAMA01','LPTSOLO02','LPTOUTR03'].every(c=>S[c]);},20000),'as sessões do servidor chegaram ao SIM');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));});
  // a selfie abre as levas A e B; ela escolhe A1 e B2 e manda ao atendente
  const r=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);return {okj:ETERNA.lojaJuntar(r.res,r.talvez,r.sims),res:r.res.map(x=>x.card).sort()};});
  ok(r.okj&&r.res.join()==='LPTFAMA01,LPTSOLO02','a selfie acha as duas levas: '+J(r));
  ok(await espera(()=>!!document.querySelector('#lj-lb .lj-lbimg'),6000),'abre na foto ampliada');
  const irPara=async k=>{const i=await pg.evaluate(k=>ETERNA.lojaItems(ETERNA.state.kiosk.code).findIndex(x=>x.k===k),k);
    for(let n=0;n<40&&await pg.evaluate(()=>ETERNA.state.kiosk.ver)!==i;n++){await pg.click(await pg.evaluate(i=>ETERNA.state.kiosk.ver<i,i)?'#lj-lb .lj-lbnav.next':'#lj-lb .lj-lbnav.prev');await pg.waitForTimeout(60);}};
  await irPara('ag_aaa000000001');await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(120);
  await irPara('ag_bbb000000002');await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(120);
  await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(300);
  ok(await espera(()=>ETERNA.state.kiosk.step==='done'),'pedido feito');
  const rec=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,card:r.card,sel:r.selected.slice().sort(),token:r.token};});
  ok(rec.card==='LPTSOLO02'&&rec.sel.join()==='ag_aaa000000001,ag_bbb000000002','uma venda só, ancorada em B, com uma foto de A: '+J(rec));
  // o Posto (outra janela, admin)
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U);await pg2.waitForTimeout(400);
  await pg2.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg2.click('button[type=submit]');await pg2.waitForTimeout(200);
  {const otp=await pg2.$('.otp');if(otp){await pg2.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg2.waitForTimeout(500);}}
  const apagar=async card=>{await pg2.evaluate(card=>{ETERNA.simFresh();const b=document.createElement('button');b.dataset.act='lgpd-excluir';b.dataset.card=card;document.body.appendChild(b);b.click();b.remove();},card);await pg2.waitForTimeout(700);
    return pg2.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');};
  const sA=()=>pg2.evaluate(()=>{ETERNA.simFresh();const s=ETERNA.SIM.sessions.LPTFAMA01;return {fotos:s.photos.map(p=>p.id.slice(3,6)+p.id.slice(-1)).join(),lgpd:s.lgpd?{n:s.lgpd.n,ficaram:s.lgpd.ficaram}:null};});
  // 1. pedido aberto com foto da leva A: recusa, nada vai ao servidor
  let t=await apagar('LPTFAMA01');let s=await sA();
  ok(LG.length===0&&/pedido aberto/.test(t)&&!s.lgpd&&s.fotos==='aaa1,aaa2,aaa3,aaa4,aaa5,aaa6','1: com pedido aberto usando as fotos, não apaga: '+J({n:LG.length,t,s}));
  // 2. venda paga pela âncora B
  ok(await pg2.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});return ETERNA.pendConfirmar(id,{ref:'123456'});},rec.id),'pagamento confirmado');
  const st=await pg2.evaluate(()=>{ETERNA.simFresh();const S=ETERNA.SIM.sessions;return S.LPTFAMA01.status+' '+S.LPTSOLO02.status;});
  ok(/ paga$/.test(st)&&!/^paga/.test(st),'2: só a âncora B fica paga; a leva A não: '+st);
  // cortesia numa foto da leva A (A3) e uma galeria só da sessão C, sem compra
  const tokC=await pg2.evaluate(()=>{ETERNA.simFresh();const S=ETERNA.SIM;S.sessions.LPTFAMA01.cort={ag_aaa000000003:{em:new Date().toISOString(),por:'teste',motivo:'teste'}};const t=ETERNA.galDaSessao('LPTOUTR03',true);ETERNA.galAtualizar(t);ETERNA.saveSim();return t;});
  const pl=await pg2.evaluate(()=>{const p=ETERNA.lgpdPlano('LPTFAMA01');return {sai:p.pids.map(x=>x.slice(-1)).join(''),fica:p.fica.map(x=>x.slice(-1)).join(''),pedido:p.pedido};});
  ok(pl.sai==='2456'&&pl.fica==='13'&&!pl.pedido,'3: saem só as não compradas; a comprada (A1) e a cortesia (A3) ficam: '+J(pl));
  // 4. o diálogo conta só o que sai e avisa do que fica
  ok(await espera(()=>ETERNA.demoSessions().some(s=>s.card==='LPTFAMA01'&&s.photos.length===6),20000,null,pg2),'4: o Posto já tem as fotos da leva A do servidor');
  await pg2.evaluate(()=>ETERNA.go('checkout'));await pg2.waitForTimeout(400);
  if(await pg2.$('#main [data-act="checkout-pick"][data-card="LPTFAMA01"]'))await pg2.click('#main [data-act="checkout-pick"][data-card="LPTFAMA01"]');
  else await pg2.evaluate(()=>{const b=document.createElement('button');b.dataset.act='checkout-pick';b.dataset.card='LPTFAMA01';document.body.appendChild(b);b.click();b.remove();});
  await pg2.waitForTimeout(400);
  ok(await pg2.$('#posto-manual [data-act="lgpd-pedir"]'),'4: botão de apagar na Venda manual da leva A');
  if(await pg2.$('#posto-manual [data-act="lgpd-pedir"]')){await pg2.click('#posto-manual [data-act="lgpd-pedir"]');await pg2.waitForTimeout(200);
    const dlg=await pg2.evaluate(()=>(document.querySelector('.mx')||{}).textContent||'');
    ok(/As 4 fotos da sessão LPTFAMA01 saem/.test(dlg)&&/2 fotos compradas ou de cortesia ficam com o cliente e a galeria dele continua aberta/.test(dlg),'4: diálogo com a contagem do que sai e do que fica: '+dlg.replace(/\s+/g,' ').slice(0,400));
    await pg2.click('.mx [data-act="lgpd-excluir"]');await pg2.waitForTimeout(700);t=await pg2.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');}
  else t=await apagar('LPTFAMA01');
  // 5. apagou pela leva A: a comprada e a cortesia ficam, a galeria paga continua aberta e volta à fila de publicação
  s=await sA();const p1=LG[0]||{pids:[],tokens:[]};
  ok(LG.length===1&&p1.pids.slice().sort().join()==='ag_aaa000000002,ag_aaa000000004,ag_aaa000000005,ag_aaa000000006','5: o pedido ao servidor leva só as 4 não compradas (o arquivo da comprada fica): '+J(p1.pids));
  ok(!p1.tokens.includes(rec.token),'5: a galeria paga não vai no pedido de encerrar: '+J(p1.tokens));
  ok(s.fotos==='aaa1,aaa3'&&s.lgpd&&s.lgpd.n===4&&s.lgpd.ficaram===2,'5: a sessão fica com a comprada e a cortesia: '+J(s));
  ok(/Apagadas: 4 fotos/.test(t)&&/2 compradas ficaram/.test(t),'5: aviso com as duas contagens: '+t);
  const g=await pg2.evaluate(tok=>{ETERNA.simFresh();const S=ETERNA.SIM;const m=S.galerias[tok];const it=(S.galFila||[]).find(x=>x.token===tok);const B=S.sessions.LPTSOLO02;
    return {enc:!!m.encerrada,fotos:m.fotos.map(f=>f.id.slice(3,6)+f.id.slice(-1)+':'+f.direito).join(),fila:it?it.estado:null,stB:B.status,selB:(B.selected||[]).slice().sort().join()};},rec.token);
  ok(!g.enc&&/aaa1:comprada/.test(g.fotos)&&/bbb2:comprada/.test(g.fotos)&&!/aaa[2456]/.test(g.fotos),'5: galeria paga aberta, com as compradas e sem as apagadas: '+J(g));
  ok(g.fila&&g.fila!=='encerrada','5: galeria paga publicada de novo (fila): '+g.fila);
  ok(g.stB==='paga'&&g.selB==='ag_aaa000000001,ag_bbb000000002','5: a venda continua com as 2 fotos: '+J(g));
  const selo=await pg2.evaluate(()=>(document.querySelector('.lgpd-selo')||{}).textContent||'');
  ok(/4 fotos desta sessão foram apagadas/.test(selo)&&/As 2 fotos compradas ou de cortesia continuam com o cliente/.test(selo),'5: selo da sessão com as duas contagens: '+selo);
  // 6. de novo: nada para apagar, nada vai ao servidor
  t=await apagar('LPTFAMA01');ok(LG.length===1&&/Nada para apagar/.test(t),'6: só compradas e cortesia: nada para apagar: '+J({n:LG.length,t}));
  // 7. sessão sem compra (C): como antes, tudo sai e a galeria dela é encerrada
  t=await apagar('LPTOUTR03');const p2=LG[1]||{pids:[],tokens:[]};
  const c=await pg2.evaluate(tok=>{ETERNA.simFresh();const S=ETERNA.SIM;return {n:S.sessions.LPTOUTR03.photos.length,lgpd:S.sessions.LPTOUTR03.lgpd&&S.sessions.LPTOUTR03.lgpd.n,fic:S.sessions.LPTOUTR03.lgpd&&S.sessions.LPTOUTR03.lgpd.ficaram,enc:!!S.galerias[tok].encerrada};},tokC);
  ok(p2.pids.length===5&&p2.tokens.join()===tokC&&c.n===0&&c.lgpd===5&&!c.fic&&c.enc,'7: sessão sem compra: as 5 fotos saem e a galeria é encerrada: '+J({p2,c,t}));
  // 9. o servidor preserva uma foto que esta tela não sabia que era do cliente (compra online feita agora na galeria da sessão D)
  const tokD=await pg2.evaluate(()=>{ETERNA.simFresh();const t=ETERNA.galDaSessao('LPTQUAR04',true);ETERNA.galAtualizar(t);ETERNA.saveSim();return t;});
  PRES={ids:['ag_ddd000000002'],venda:{id:'O0001',token:tokD,sessoes:['LPTQUAR04'],pids:['ag_ddd000000002'],n:1,total:39,metodo:'pix',em:new Date().toISOString(),canal:'online',teste:true}};
  t=await apagar('LPTQUAR04');await pg2.waitForTimeout(500);t=await pg2.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'')||t;const p9=LG[LG.length-1]||{pids:[],tokens:[]};PRES=null;
  ok(p9.pids.length===4&&p9.tokens.join()===tokD,'9: a tela pede as 4 fotos e o fim da galeria (ainda não sabia da compra): '+J(p9));
  const d9=await pg2.evaluate(tok=>{ETERNA.simFresh();const S=ETERNA.SIM;const s=S.sessions.LPTQUAR04;const m=S.galerias[tok];const it=(S.galFila||[]).find(x=>x.token===tok);
    return {fotos:s.photos.map(p=>p.id.slice(-1)).join(''),n:s.lgpd&&s.lgpd.n,fic:s.lgpd&&s.lgpd.ficaram,enc:!!m.encerrada,gal:m.fotos.map(f=>f.id.slice(-1)+':'+f.direito).join(),fila:it?it.estado:null,on:(S.vendasOnline||[]).some(v=>v.id==='O0001')};},tokD);
  ok(d9.on&&d9.fotos==='2'&&d9.n===3&&d9.fic===1,'9: sai da sessão só o que o servidor apagou; a comprada online fica: '+J(d9));
  ok(!d9.enc&&d9.gal==='2:comprada'&&d9.fila&&d9.fila!=='encerrada','9: a galeria que o servidor manteve continua aberta, só com a comprada, e é publicada de novo: '+J(d9));
  ok(/Apagadas: 3 fotos/.test(t)&&/1 comprada ficou/.test(t)&&!/fora do ar/.test(t),'9: aviso com a conta certa: '+t);
  // 8. sessão paga (âncora B, 4 fotos, 1 comprada): o cliente comprou parte e pede para apagar o resto
  const plB=await pg2.evaluate(()=>{ETERNA.simFresh();const p=ETERNA.lgpdPlano('LPTSOLO02');return {sai:p.pids.map(x=>x.slice(-1)).join(''),fica:p.fica.map(x=>x.slice(-1)).join(''),pedido:p.pedido};});
  ok(plB.sai==='134'&&plB.fica==='2'&&!plB.pedido,'8: na sessão paga saem só as 3 não compradas: '+J(plB));
  const abrir=async card=>{await pg2.evaluate(()=>ETERNA.go('checkout'));await pg2.waitForTimeout(300);
    await pg2.evaluate(card=>{const b=document.createElement('button');b.dataset.act='checkout-pick';b.dataset.card=card;document.body.appendChild(b);b.click();b.remove();},card);await pg2.waitForTimeout(400);};
  await abrir('LPTSOLO02');
  ok(await pg2.$('#posto-manual [data-act="lgpd-pedir"][data-card="LPTSOLO02"]'),'8: botão de apagar na sessão paga com fotos não compradas');
  const nLG=LG.length;
  if(await pg2.$('#posto-manual [data-act="lgpd-pedir"]')){await pg2.click('#posto-manual [data-act="lgpd-pedir"]');await pg2.waitForTimeout(200);
    const dlg=await pg2.evaluate(()=>(document.querySelector('.mx')||{}).textContent||'');
    ok(/As 3 fotos da sessão LPTSOLO02 saem/.test(dlg)&&/1 foto comprada ou de cortesia fica com o cliente/.test(dlg),'8: diálogo diz quantas saem e quantas ficam: '+dlg.replace(/\s+/g,' ').slice(0,400));
    await pg2.click('.mx [data-act="lgpd-excluir"]');await pg2.waitForTimeout(700);t=await pg2.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');}
  const p8=LG[nLG]||{pids:[],tokens:[]};
  ok(LG.length===nLG+1&&p8.pids.slice().sort().join()==='ag_bbb000000001,ag_bbb000000003,ag_bbb000000004'&&!p8.tokens.includes(rec.token),'8: o pedido leva só as 3 não compradas e não encerra a galeria paga: '+J(p8));
  const b8=await pg2.evaluate(tok=>{ETERNA.simFresh();const S=ETERNA.SIM;const B=S.sessions.LPTSOLO02;const m=S.galerias[tok];
    return {st:B.status,fotos:B.photos.map(p=>p.id.slice(-1)).join(''),sel:(B.selected||[]).slice().sort().join(),cart:(B.cart||[]).some(c=>c.apagada),n:B.lgpd&&B.lgpd.n,fic:B.lgpd&&B.lgpd.ficaram,enc:!!m.encerrada,gal:m.fotos.map(f=>f.id.slice(3,6)+f.id.slice(-1)+':'+f.direito).join(),
      recibo:!!document.querySelector('#posto-manual [data-act="checkout-next-guest"]'),selo:!!document.querySelector('#posto-manual .lgpd-selo'),btn:!!document.querySelector('#posto-manual [data-act="lgpd-pedir"]')};},rec.token);
  ok(b8.st==='paga'&&b8.fotos==='2'&&b8.sel==='ag_aaa000000001,ag_bbb000000002'&&!b8.cart&&b8.n===3&&b8.fic===1,'8: a venda continua paga, com a comprada e o carrinho intactos: '+J(b8));
  ok(!b8.enc&&/bbb2:comprada/.test(b8.gal)&&/aaa1:comprada/.test(b8.gal)&&!/bbb[134]/.test(b8.gal),'8: a galeria paga continua, sem as apagadas: '+J(b8));
  ok(b8.recibo&&b8.selo&&!b8.btn,'8: o recibo continua na tela, com o aviso, e o botão some (nada mais para apagar): '+J(b8));
  ok(/Apagadas: 3 fotos/.test(t)&&/1 comprada ficou/.test(t),'8: aviso com as duas contagens: '+t);
  t=await apagar('LPTSOLO02');ok(LG.length===nLG+1&&/Venda paga: as fotos ficam com o cliente/.test(t),'8: de novo na sessão paga: nada vai ao servidor: '+J({n:LG.length,t}));
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e));}
finally{await b.close();}
console.log(fails.length?'FALHA lgpd-compradas: '+fails.join(' · '):'OK lgpd-compradas: apagar a pedido do cliente preserva compradas e cortesias, mantém a galeria paga, recusa com pedido aberto, segue o que o servidor preservou e atende a sessão paga');
process.exit(fails.length?1:0);})();
