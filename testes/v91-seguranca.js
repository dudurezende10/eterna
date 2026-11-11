// v91, devolução da segurança e sugestões do revisor (01/11), e janela da selfie (Eduardo, 01/11 16:46 e 16:51):
// v94-ux (parte I): a janela da selfie fica na aba Checkout de Preços e Checkout
//  B4: "Sim, sou eu" no "Esta sessão também é sua?" põe só as fotos em dúvida daquela sessão, nunca a sessão inteira;
//  B5: quem aparece claro só no FUNDO de uma foto (rosto < metade do maior; principal:false do agente) não abre a sessão
//      inteira: entram só as fotos claras dela, com galeria própria na venda;
//  IMPORTANTE 1: sessão de menor achada sozinha também vende com galeria própria (m.venda, m.so);
//  janela: no Checkout a selfie só considera sessões com a última foto nos últimos N minutos (padrão 90; 0 = dia todo),
//      ajustável no Painel de controle (só quem altera Configurações), gravada no servidor do ponto e lida em outro navegador;
//  contador do campo de código no sessionStorage (recarregar não zera); teto de 10 min da validação com o balcão ocupado;
//  aviso "Achamos você" fora da barra do ✗/✓; ponto · hora dentro da própria imagem;
//  bug antigo do validateReal (const big engolida pelo comentário): foto com olhos fechados é marcada (detector simulado).
// Agente falso (page.route), com /ponto/docs em memória compartilhado entre os navegadores.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.SESSOES_PRINTS||path.join(__dirname,'prints');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const imgs=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(300,200),(60,110,150));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170))
b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(3000,2000),(30,60,110));d=ImageDraw.Draw(im);d.ellipse([1300,300,1700,700],fill=(230,200,170));d.rectangle([1100,720,1900,2000],fill=(40,80,140))
b=io.BytesIO();im.save(b,'JPEG',quality=90);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const [MINI,GRANDE]=imgs;
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
// A: família dela (clara, principal); F: outra família, ela clara só no fundo; T: só "talvez"; M: menor, ela clara;
// W: família dela há 80 min (entra); V: há 2 h (fora da janela de 90 min)
const A=ids('aaa',6),F=ids('fff',5),T=ids('ttt',5),M=ids('mmm',4),W=ids('www',3),V=ids('vvv',4);
const ses=(card,fotos,who,ponto,cap1,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:cap1-60,ultima_chegada:cap1+2,cap0:cap1-50,cap1,fonte_t:'cap',fechada_em:cap1+62,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev});
const FEED=[ses('LPSFAMA01',A,'carlos','terminal',a-1500,1),ses('LPSFUND02',F,'samuel','campo4',a-1200,2),ses('LPSTALV03',T,'yago','campo2',a-1000,3),
  ses('LPSMENO04',M,'yago','campo2',a-900,4),ses('LPSOITE05',W,'carlos','terminal',a-80*60,5),ses('LPSVELH06',V,'carlos','terminal',a-120*60,6)];
// {id:[sim, principal]}
let SIMS={};const base={[A[0]]:[.71,true],[A[1]]:[.66,true],[F[1]]:[.70,false],[F[3]]:[.62,false],[T[0]]:[.42,true],[T[2]]:[.40,true],[M[1]]:[.68,true],[W[0]]:[.69,true],[V[0]]:[.72,true]};
const DOCS={};let DREV=0; // estado.db falso: col -> id -> {valor, rev}
const contexto=async(b,errs)=>{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,agent:'eterna-agente',version:3,boot:'b91',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:6,gen:'b91',hoje:6,abertas:0,dias:1,janela_min:90,janela_padrao:90,janela_fixa:false}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,gen:'b91',rev:6,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:MINI}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:GRANDE}));
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rosto:true,fotos:Object.entries(SIMS).map(([id,[sim,principal]])=>({id,sim,principal}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  await ctx.route(ORIG+'/ponto/docs/revs',r=>{const revs={};for(const [c,m] of Object.entries(DOCS))revs[c]=Math.max(0,...Object.values(m).map(x=>x.rev));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,revs})});});
  await ctx.route(ORIG+'/ponto/docs*',r=>{const q=r.request();if(q.method()==='POST'){let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}(j.docs||[]).forEach(d=>{DOCS[d.col]=DOCS[d.col]||{};DOCS[d.col][d.id]={valor:d.valor,rev:++DREV};});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rev:DREV})});}
    const col=new URL(q.url()).searchParams.get('col');const m=DOCS[col]||{};r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rev:Math.max(0,...Object.values(m).map(x=>x.rev)),docs:Object.entries(m).filter(([,x])=>x.valor!=null).map(([id,x])=>({id,valor:x.valor}))})});});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(m.text());});
  return {ctx,pg};};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const {ctx,pg}=await contexto(b,errs);
  await pg.goto(U+'#loja');
  ok(await espera(pg,()=>{const S=ETERNA.SIM.sessions;return ['LPSFAMA01','LPSFUND02','LPSTALV03','LPSMENO04','LPSOITE05','LPSVELH06'].every(c=>S[c]);},20000),'as sessões do servidor chegaram ao SIM');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));S.sessions.LPSMENO04.menor=true;});
  ok(await pg.evaluate(()=>ETERNA.SIM.sessions.LPSVELH06.cap1>0&&ETERNA.sesUltima('LPSVELH06')<Date.now()-110*60e3),'a sessão do servidor guarda a hora do último clique (cap1)');
  const busca=()=>pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);const okj=ETERNA.lojaJuntar(r.res,r.talvez,r.sims);
    const k=ETERNA.state.kiosk;return {okj,res:r.res.map(x=>x.card+':'+x.pri).sort(),tv:r.talvez.map(x=>x.card).sort(),step:k.step,ask:(k.tv||{ask:[]}).ask.map(q=>q.card)};});
  // ---------- janela 90 min (padrão do /status): V (2 h) fora, W (80 min) dentro ----------
  SIMS={...base};
  let r=await busca();
  ok(r.res.join()==='LPSFAMA01:2,LPSFUND02:0,LPSMENO04:1,LPSOITE05:1','janela de 90 min: sessão de 2 h atrás fora, de 80 min dentro; principal contado por sessão: '+JSON.stringify(r.res));
  ok(r.step==='talvez'&&r.ask.join()==='LPSTALV03','"talvez" pergunta pela sessão T: '+JSON.stringify(r));
  // ---------- B4: "Sim" põe só as fotos em dúvida de T ----------
  await pg.waitForTimeout(200);await pg.click('[data-act="kiosk-tv-sim"]');
  ok(await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg'),5000),'depois do "Sim" abre na foto ampliada');
  const k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;const by={};ETERNA.lojaFotos(k.code).forEach(p=>{(by[p.ses]=by[p.ses]||[]).push(p.id.slice(3));});return {code:k.code,by};});
  ok((k.by.LPSTALV03||[]).sort().join()==='ttt000000001,ttt000000003','B4: o "Sim" põe só as 2 fotos "talvez" de T, nunca a sessão inteira: '+JSON.stringify(k.by.LPSTALV03));
  // v97 (Eduardo, 10/11): leva em que ela é rosto principal abre inteira (e a visita dela); fundo (B5), menor e "talvez" continuam só com as fotos achadas
  ok((k.by.LPSFAMA01||[]).length===6,'família dela (A, principal): v97, a leva inteira: '+(k.by.LPSFAMA01||[]).length);
  ok((k.by.LPSFUND02||[]).sort().join()==='fff000000002,fff000000004','B5: F (ela só no fundo) entra só com as fotos claras dela: '+JSON.stringify(k.by.LPSFUND02));
  ok((k.by.LPSMENO04||[]).join()==='mmm000000002','menor: só a foto clara dela: '+JSON.stringify(k.by.LPSMENO04));
  ok((k.by.LPSOITE05||[]).length===3&&!k.by.LPSVELH06,'W (80 min) inteira (v97), V (2 h) fora');
  // aviso "Achamos você" fora da barra do ✗/✓ e do botão Ver todas; ponto · hora dentro da imagem
  const lay=await pg.evaluate(()=>{const R=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null;};return {t:R('#toast'),bar:R('.lj-lbbar'),x:R('.lj-lbx'),no:R('.lj-no'),on:document.querySelector('#toast').hasAttribute('data-on'),txt:document.querySelector('#toast').textContent};});
  const cruza=(p,q)=>p&&q&&!(p.right<=q.left||q.right<=p.left||p.bottom<=q.top||q.bottom<=p.top);
  ok(lay.on&&/Achamos/.test(lay.txt),'aviso "Achamos você" na tela: '+lay.txt);
  ok(lay.t&&lay.bar&&lay.t.bottom<=lay.bar.top&&!cruza(lay.t,lay.no)&&!cruza(lay.t,lay.x),'o aviso não fica em cima do ✗/✓ nem do Ver todas: '+JSON.stringify({t:lay.t,bar:lay.bar&&lay.bar.top}));
  ok(await espera(pg,()=>{const i=document.querySelector('.lj-lbimg');return i&&i.classList.contains('fit');},4000),'a foto real ampliada ganha a proporção dela');
  const rot=await pg.evaluate(()=>{const s=document.querySelector('.lj-lbsrc'),i=document.querySelector('.lj-lbimg');if(!s||!i)return null;const p=s.getBoundingClientRect(),q=i.getBoundingClientRect();return {dentro:s.parentElement===i&&p.left>=q.left&&p.right<=q.right&&p.top>=q.top&&p.bottom<=q.bottom,ar:q.width/q.height,txt:s.textContent};});
  ok(rot&&rot.dentro&&Math.abs(rot.ar-1.5)<.03,'ponto · hora inteiro dentro da imagem (3:2): '+JSON.stringify(rot));
  await pg.waitForTimeout(2600);
  fs.mkdirSync(PRINTS,{recursive:true});
  // ---------- venda com B5 e T: galeria própria só com o que entrou ----------
  await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(100);
  await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(250);/* v96: o Continuar já faz o pedido (pacote e meio no Posto) */
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'),'pedido feito');
  const g1=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];const m=ETERNA.SIM.galerias[r.token];return {venda:!!m.venda,so:m.so};});
  ok(g1.venda&&(g1.so.LPSFUND02||[]).length===2&&(g1.so.LPSTALV03||[]).length===2&&(g1.so.LPSFAMA01||[]).length===6,'galeria da venda só com o que entrou de F e T (v97: A inteira): '+JSON.stringify(g1.so&&Object.fromEntries(Object.entries(g1.so).map(([c,l])=>[c,l.length]))));
  // ---------- B5 sozinho: ela clara só no fundo de F ----------
  SIMS={[F[1]]:[.70,false],[F[3]]:[.62,false]};
  r=await busca();
  const f=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {code:k.code,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id.slice(3)).sort()};});
  ok(f.code==='LPSFUND02'&&f.fotos.join()==='fff000000002,fff000000004','B5: só no fundo de uma família grande, a sessão não abre inteira: '+JSON.stringify(f));
  await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(100);await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(250);/* v96: o Continuar já faz o pedido (pacote e meio no Posto) */
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'),'pedido de F feito');
  const g2=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];const m=ETERNA.SIM.galerias[r.token];return {card:r.card,venda:!!m.venda,so:m.so};});
  ok(g2.card==='LPSFUND02'&&g2.venda&&(g2.so.LPSFUND02||[]).sort().join()==='ag_fff000000002,ag_fff000000004','B5: venda de F com galeria própria só com as fotos dela: '+JSON.stringify(g2));
  // ---------- IMPORTANTE 1: sessão de menor achada sozinha ----------
  SIMS={[M[1]]:[.68,true]};
  r=await busca();
  await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(100);await pg.click('#lj-lb [data-act="loja-cart"]');await pg.waitForTimeout(250);/* v96: o Continuar já faz o pedido (pacote e meio no Posto) */
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'),'pedido da menor feito');
  const g3=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];const m=ETERNA.SIM.galerias[r.token];return {card:r.card,sessoes:r.sessoes,venda:!!m.venda,so:m.so};});
  ok(g3.card==='LPSMENO04'&&g3.venda&&JSON.stringify(g3.so)==='{"LPSMENO04":["ag_mmm000000002"]}','IMPORTANTE 1: menor sozinha = galeria própria só com a foto dela: '+JSON.stringify(g3));
  // ---------- janela 0 (dia todo) e 15 min ----------
  SIMS={...base};
  await pg.evaluate(()=>{ETERNA.state.buscaCfg={janela_min:0,em:new Date().toISOString()};});
  const r0=await pg.evaluate(async()=>{const c=document.createElement('canvas');const r=await ETERNA.faceFind([c],x=>!x.demo);return r.res.map(x=>x.card).sort();});
  ok(r0.includes('LPSVELH06')&&r0.includes('LPSOITE05'),'janela 0 = dia todo (inclui a de 2 h): '+r0.join());
  await pg.evaluate(()=>{ETERNA.state.buscaCfg={janela_min:22,em:new Date().toISOString()};});
  const r22=await pg.evaluate(async()=>{const c=document.createElement('canvas');const r=await ETERNA.faceFind([c],x=>!x.demo);return r.res.map(x=>x.card).sort();});
  ok(r22.join()==='LPSFUND02,LPSMENO04','janela de 22 min: a de 20 min entra, a de 25 min sai: '+r22.join());
  await pg.evaluate(()=>{ETERNA.state.buscaCfg=null;});
  // ---------- contador do campo de código sobrevive ao recarregar ----------
  await pg.evaluate(()=>{ETERNA.lojaCodReset();ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(150);
  for(let i=0;i<3;i++){await pg.fill('#kcode','ZZZZ-ZZZ'+i);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(60);}
  await pg.reload();await espera(pg,()=>!!window.ETERNA,8000);
  ok(await pg.evaluate(()=>ETERNA.LJ_COD.erros)===3,'recarregar não zera as tentativas erradas: '+await pg.evaluate(()=>ETERNA.LJ_COD.erros));
  await pg.evaluate(()=>{ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(150);
  for(let i=0;i<2;i++){await pg.fill('#kcode','ZZZZ-ZZY'+i);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(60);}
  await pg.reload();await espera(pg,()=>!!window.ETERNA&&ETERNA.demoSessions().some(s=>s.card==='LPSFAMA01')&&ETERNA.demoSessions().some(s=>s.card==='LPSVELH06'),15000);
  ok(await pg.evaluate(()=>ETERNA.LJ_COD.ate>Date.now()+30e3&&ETERNA.lojaCodigo('LPSFAMA01')===null),'a trava de 1 minuto continua depois de recarregar');
  await pg.evaluate(()=>ETERNA.lojaCodReset());
  ok(await pg.evaluate(()=>!!ETERNA.lojaCodigo('LPSFAMA01')),'depois da trava, o código do recibo abre (qualquer sessão do dia, fora da janela também)');
  ok(await pg.evaluate(()=>!!ETERNA.lojaCodigo('LPSVELH06')),'código do recibo de 2 h atrás abre');
  // ---------- teto da validação com o balcão ocupado ----------
  const teto=await pg.evaluate(async()=>{const k=ETERNA.state.kiosk;k.step='review';ETERNA.valOcup(0);let pronto=false;ETERNA.valLivre().then(()=>pronto=true);await new Promise(r=>setTimeout(r,1600));const antes=pronto;
    ETERNA.valOcup(Date.now()-ETERNA.VAL_TETO-1000);await new Promise(r=>setTimeout(r,1000));const depois=pronto;k.step='code';ETERNA.valOcup(0);return {antes,depois,teto:ETERNA.VAL_TETO};});
  ok(!teto.antes&&teto.depois&&teto.teto===600000,'validação espera o balcão ocupado e valida mesmo assim depois de 10 min: '+JSON.stringify(teto));
  // ---------- Painel de controle: a janela mudada por um Admin vale em outro navegador ----------
  const adm=await contexto(b,errs);const P=adm.pg;
  await P.goto(U);await P.waitForTimeout(400);
  await entrarTeste(P,'eduardo@eduardorezende.com');
  // v96.1 (Testador): 45 s. Com a máquina carregada (2 CPUs, outras suítes ao lado) a página fica ocupada 12 a 24 s logo depois do login e o
  // dbLigar (a cada 5 s) só roda depois; igual na v96 (0596b50). O que se testa é que liga, não em quanto tempo.
  ok(await espera(P,()=>!!ETERNA.state.db,45000),'o Painel liga no servidor do ponto (estado.db)');
  await P.evaluate(()=>{ETERNA.state.catTab='checkout';ETERNA.state.view='catalogo';ETERNA.render();});await P.waitForTimeout(300);
  ok(await P.$('#busca-janela')&&/Procurar fotos dos últimos/.test(await P.textContent('#main')),'campo "Procurar fotos dos últimos __ minutos" no Painel de controle');
  ok(await P.inputValue('#busca-janela')==='90','padrão 90 minutos');
  // sem permissão de alterar Configurações: o campo fica desligado e a troca é barrada
  const sem=await P.evaluate(async()=>{const u=ETERNA.state.user;const bak=JSON.stringify(u.perms);u.perms.configuracao={c:false,r:true,u:false,d:false};ETERNA.render();const i=document.querySelector('#busca-janela');const dis=i.disabled;
    i.disabled=false;i.value='30';i.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));const v=ETERNA.buscaJanelaMin();u.perms=JSON.parse(bak);ETERNA.render();return {dis,v};});
  ok(sem.dis&&sem.v===90,'sem Configurações (alterar): campo desligado e troca barrada: '+JSON.stringify(sem));
  await P.evaluate(v=>{const i=document.querySelector('#busca-janela');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));},'30');await P.waitForTimeout(200);
  ok(await P.evaluate(()=>ETERNA.buscaJanelaMin())===30,'Admin muda para 30 minutos');
  ok(await P.evaluate(()=>{const e=ETERNA.auditRead()[0];return e&&e.acao==='busca_janela'&&e.mudancas[0].de===90&&e.mudancas[0].para===30;}),'registro de quem mudou (auditLog)');
  ok(await espera(P,()=>true,100)&&await (async()=>{const t0=Date.now();while(Date.now()-t0<8000){if(DOCS.config&&DOCS.config.busca&&DOCS.config.busca.valor&&DOCS.config.busca.valor.janela_min===30)return true;await P.waitForTimeout(200);}return false;})(),'gravado no servidor do ponto (config/busca)');
  await P.evaluate(v=>{const i=document.querySelector('#busca-janela');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));},'5');await P.waitForTimeout(150);
  ok(await P.evaluate(()=>ETERNA.buscaJanelaMin())===15,'menos de 15 vira 15');
  await P.evaluate(v=>{const i=document.querySelector('#busca-janela');i.value=v;i.dispatchEvent(new Event('change',{bubbles:true}));},'30');await P.waitForTimeout(150);
  // outro navegador (o Checkout, sem login) lê do servidor do ponto
  const ck=await contexto(b,errs);await ck.pg.goto(U+'#loja');await ck.pg.evaluate(()=>{ETERNA.state.kiosk.step='review';}); /* balcão ocupado: a validação de IA (face-api) não disputa o processador do teste */
  ok(await espera(ck.pg,()=>ETERNA.buscaJanelaMin()===30,40000),'a janela mudada no Painel vale no Checkout de outro navegador: '+await ck.pg.evaluate(()=>ETERNA.buscaJanelaMin()));
  await P.evaluate(()=>{const i=document.querySelector('#busca-janela-dia');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});await P.waitForTimeout(200);
  ok(await espera(ck.pg,()=>ETERNA.buscaJanelaMin()===0,40000),'"Dia todo" vale no outro navegador');
  await ck.ctx.close();await adm.ctx.close();await ctx.close();
  // ---------- bug antigo do validateReal: olhos fechados são marcados (detector simulado) ----------
  const c2=await b.newContext({viewport:{width:1200,height:800}});await c2.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await c2.addInitScript(()=>{const olho=h=>[{x:0,y:0},{x:3,y:h},{x:6,y:h},{x:9,y:0},{x:6,y:-h},{x:3,y:-h}];
    const rosto=(w,h)=>({detection:{box:{width:w,area:w*w}},landmarks:{getLeftEye:()=>olho(h),getRightEye:()=>olho(h)}});
    window.__rostos=[];window.__rosto=rosto;
    window.faceapi={tf:{ready:async()=>{}},nets:{ssdMobilenetv1:{loadFromUri:async()=>{}},faceLandmark68Net:{loadFromUri:async()=>{}},faceRecognitionNet:{loadFromUri:async()=>{}}},
      SsdMobilenetv1Options:function(){},detectAllFaces:()=>({withFaceLandmarks:async()=>window.__rostos.slice()})};});
  const p2=await c2.newPage();p2.on('pageerror',e=>errs.push(e.message));await p2.goto(U);await p2.waitForTimeout(500);
  const vr=await p2.evaluate(async()=>{const id=ETERNA.demoSessions().flatMap(s=>s.photos).map(p=>p.id).find(Boolean);
    window.__rostos=[window.__rosto(120,.2)];const fech=await ETERNA.validateReal([id]);
    window.__rostos=[window.__rosto(120,1.5)];const aber=await ETERNA.validateReal([id]);
    window.__rostos=[window.__rosto(120,1.5),window.__rosto(40,.2)];const fundo=await ETERNA.validateReal([id]);
    return {id,fech:fech[id]||null,aber:aber[id]||null,fundo:fundo[id]||null};});
  ok(vr.fech==='olhos fechados','validateReal: foto com olhos fechados é marcada: '+JSON.stringify(vr));
  ok(!vr.aber&&!vr.fundo,'validateReal: olhos abertos (e olho fechado só no fundo) não marcam: '+JSON.stringify(vr));
  await c2.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,500));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const ff=fails.filter(Boolean);const okk=!ff.length;console.log(`${okk?'OK':'FALHA'} v91-seguranca: B4, B5, IMPORTANTE 1, janela da selfie (Painel), código, teto da validação, aviso e rótulo, olhos fechados${okk?'':' · '+ff.slice(0,8).join(' | ')}`);process.exit(okk?0:1);
})();
