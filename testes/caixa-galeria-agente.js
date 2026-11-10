// Caixa que acabou de entrar confirma "Pago na maquininha" na hora (antes de a aba carregar as sessões do servidor): a galeria
// da venda tem que ser publicada, com as fotos compradas. Várias rodadas, com o agente de verdade (HOME temporário):
// Caixa numa aba nova do próprio aparelho pareado do Checkout, entrando a cada rodada.
// Também: aviso de aparelho não pareado (botões legíveis e centralizados em 1280/820/390) e clique repetido em Parear.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PR=path.join(__dirname,'prints');fs.mkdirSync(PR,{recursive:true});
const fails=[],errs=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SENHA='rio.anil.4410.serra';const RODADAS=+(process.env.RODADAS||6);
function req(porta,method,p,{headers,body}={}){return new Promise(res=>{const d=body?Buffer.from(typeof body==='string'?body:J(body)):null;
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:Object.assign({},d?{'Content-Type':'application/json','Content-Length':d.length}:{},headers||{})},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const t=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(t)}catch(e){}res({s:rs.statusCode,j,t,h:rs.headers});});});
  r.on('error',()=>res({s:0}));if(d)r.write(d);r.end();});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await sleep(200);}return false;};
function vigia(pg,nome){pg.setDefaultTimeout(10000);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;}
const toastTxt=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'').catch(()=>'');
const IMG=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-cg-img-'));
execFileSync('python3',['-c',`
import cv2,sys
R,D=sys.argv[1],sys.argv[2];im=cv2.imread(R+'/sprites/c04.webp')
cells={'a1':(100,480,260,720),'a2':(1080,480,1440,720),'a3':(1900,480,2060,720),'b1':(1440,240,1800,480),'b2':(360,240,720,480)}
for k,(x0,y0,x1,y1) in cells.items():
    cv2.imwrite(D+'/'+k+'.jpg',cv2.resize(im[y0:y1,x0:x1],None,fx=6,fy=6,interpolation=cv2.INTER_CUBIC),[cv2.IMWRITE_JPEG_QUALITY,92])
`,RAIZ,IMG]);
function modelos(home){const d=path.join(home,'Eterna','modelos');fs.mkdirSync(d,{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(d,f));}
const BASE=24000+Math.floor(Math.random()*40)*20;const PORTA=BASE+3,FTPP=BASE+4,PASV=`${BASE+5}-${BASE+14}`;
const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-cg-'));modelos(home);
const ENV={...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(PORTA),ETERNA_FTP_PORTA:String(FTPP),ETERNA_FTP_PASV:PASV,ETERNA_APP_ORIGIN:ORIG,ETERNA_SESSAO_PAUSA:'3',
  ETERNA_IMPRESSORA:'DNP Teste',ETERNA_IMPRESSORA_TESTE:'1',USER:'eterna-teste-sem-cartao',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};
let ag=null,agLog='';
async function subir(){ag=spawn('python3',[AG],{env:ENV,stdio:['ignore','pipe','pipe']});ag.stdout.on('data',d=>agLog+=d);ag.stderr.on('data',d=>agLog+=d);
  for(let i=0;i<80;i++){await sleep(250);if((await req(PORTA,'GET','/status')).s===200)return;}throw new Error('agente não subiu: '+agLog.slice(-300));}
const sql=(db,q)=>execFileSync('python3',['-c','import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchall();c.commit();print(json.dumps(r))',path.join(home,'Eterna','ponto',db),q]).toString().trim();
const A=`http://127.0.0.1:${PORTA}`;
function manifesto(tok){const ach=[];const anda=d=>{let l=[];try{l=fs.readdirSync(d,{withFileTypes:true});}catch(e){return;}for(const e of l){const p=path.join(d,e.name);if(e.isDirectory()){if(e.name===tok&&fs.existsSync(path.join(p,'sessao.json')))ach.push(path.join(p,'sessao.json'));else anda(p);}}};anda(path.join(home,'Eterna'));
  return ach.length?JSON.parse(fs.readFileSync(ach[0],'utf8')):null;}
async function entrar(pg,usuario,senha,nova){await pg.fill('[data-act="login-usuario"]',usuario);await pg.fill('[data-act="login-senha"]',senha);await pg.click('button[type=submit]');
  if(nova){if(!await espera(pg,()=>ETERNA.state.auth.step==='trocar',8000))return false;await pg.fill('[data-act="login-nova"]',nova);await pg.fill('[data-act="login-nova2"]',nova);await pg.click('button[type=submit]');}
  return espera(pg,()=>!!ETERNA.state.user,8000);}
async function cadastrar(pg,usuario,nome,preset){await pg.evaluate(()=>{ETERNA.go('usuarios');ETERNA.state.users.draft=null;ETERNA.render();});await pg.click('[data-act="user-new"]');
  await pg.fill('[data-act="user-field"][data-k="name"]',nome);await pg.fill('[data-act="user-field"][data-k="email"]',usuario);await pg.selectOption('[data-act="user-preset"]',preset);
  await pg.click('[data-act="user-save"]');
  if(!await espera(pg,u=>ETERNA.state.users.senha&&ETERNA.state.users.senha.usuario===u,14000,usuario)){fails.push('senha provisória na criação de '+usuario+': '+await toastTxt(pg));return null;}
  const s=await pg.evaluate(()=>ETERNA.state.users.senha.valor);await pg.click('[data-act="user-senha-ok"]');return s;}
function ftpEnvia(usuario,arquivos){const users=JSON.parse(fs.readFileSync(path.join(home,'Eterna','ftp.json'),'utf8')).users;
  return execFileSync('python3',['-c',`
import ftplib,sys,os
f=ftplib.FTP();f.connect('127.0.0.1',int(sys.argv[1]),timeout=20);f.login(sys.argv[2],sys.argv[3]);f.set_pasv(True);out=[]
for a in sys.argv[4:]:
    with open(a,'rb') as x: out.append(f.storbinary('STOR '+os.path.basename(a),x)[:3])
f.quit();print(','.join(out))`,String(FTPP),usuario,users[usuario],...arquivos]).toString().trim();}
// cópia com nome novo (o FTP/biblioteca não junta arquivo repetido)
function copia(base,n){const d=path.join(IMG,base+'_'+n+'.jpg');const b=fs.readFileSync(path.join(IMG,base+'.jpg'));fs.writeFileSync(d,Buffer.concat([b,Buffer.from([0xff,0xd9,n&255,(n>>8)&255])]));return d;}
async function geom(pg){return pg.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {l:Math.round(b.left),r:Math.round(innerWidth-b.right),t:Math.round(b.top),b:Math.round(innerHeight-b.bottom),w:Math.round(b.width)};};
  const h=document.querySelector('.lj-naopar .lj-h1');const bt=[...document.querySelectorAll('[data-act="posto-tentar"],[data-act="loja-sair"]')];
  return {h:h&&r(h),bt:bt.map(b=>{const c=getComputedStyle(b);return {...r(b),cor:c.color,fundo:c.backgroundColor,borda:c.borderTopColor,t:b.textContent};}),ta:h&&getComputedStyle(h).textAlign,
    corpo:getComputedStyle(document.querySelector('.lj-naopar')).backgroundImage.slice(0,40)+' '+getComputedStyle(document.querySelector('.lj-naopar')).backgroundColor,sb:document.documentElement.scrollWidth-innerWidth};});}

(async()=>{const b=await chromium.launch();const ctxs=[];const novo=async(o)=>{const c=await b.newContext(Object.assign({viewport:{width:1280,height:900},locale:'pt-BR'},o||{}));ctxs.push(c);return c;};
try{
  const cli=execFileSync('python3',[AG,'--criar-admin','admin.teste','Admin de teste'],{env:ENV}).toString();const prov=(cli.match(/troque na primeira entrada: (\S+)/)||[])[1];await subir();
  const cAd=await novo();const AD=vigia(await cAd.newPage(),'admin');await AD.goto(A+'/index.html');await AD.waitForTimeout(500);
  ok(await entrar(AD,'admin.teste',prov,SENHA),'admin entra');await espera(AD,()=>ETERNA.state.agent.on,15000);
  const sv=await cadastrar(AD,'venda.teste','Venda de teste','venda');if(!sv)throw new Error('sem vendedor');

  // T1: aviso de não pareado, botões legíveis e centralizados
  const cK=await novo();const KA=vigia(await cK.newPage(),'naopar');await KA.goto(A+'/#loja');
  ok(await espera(KA,()=>ETERNA.state.posto.estado==='nao'&&!!document.querySelector('.lj-naopar'),15000),'T1: aviso de não pareado');
  for(const [w,h] of [[1280,900],[820,1180],[390,844]]){await KA.setViewportSize({width:w,height:h});await KA.waitForTimeout(300);const g=await geom(KA);
    await KA.screenshot({path:path.join(PR,`cg-naopar-${w}.png`)});
    ok(g.sb<=1,`T1 ${w}: sem rolagem lateral ${g.sb}`);
    ok(g.h&&Math.abs(g.h.l-g.h.r)<=4,`T1 ${w}: título centralizado (margens ${g.h&&g.h.l}/${g.h&&g.h.r})`);
    ok(g.ta==='center',`T1 ${w}: texto centralizado (${g.ta})`);
    ok(g.bt.length===2&&g.bt.every(x=>x.cor!==x.fundo),`T1 ${w}: botões legíveis ${J(g.bt)}`);
    const L=Math.min(...g.bt.map(x=>x.l)),R=Math.min(...g.bt.map(x=>x.r));ok(Math.abs(L-R)<=4,`T1 ${w}: botões centralizados no conjunto (${L}/${R})`);
    ok(g.bt.every(x=>x.l>=0&&x.r>=0),`T1 ${w}: botões dentro da tela`);}
  await KA.setViewportSize({width:1280,height:900});
  // "Tentar de novo" sem pareamento: segue no aviso, sem erro
  await KA.click('[data-act="posto-tentar"]');await KA.waitForTimeout(800);ok(await KA.evaluate(()=>!!document.querySelector('.lj-naopar')),'T1: Tentar de novo sem pareamento mantém o aviso');

  // T2: Parear com clique duplo de verdade (mouse) e cliques repetidos
  await KA.click('[data-act="loja-sair"]');await KA.waitForTimeout(400);ok(await entrar(KA,'admin.teste',SENHA),'admin entra no aparelho do Checkout');
  await KA.evaluate(()=>ETERNA.go('catalogo'));ok(await espera(KA,()=>!!document.querySelector('#postos-painel [data-act="posto-parear"]')&&Array.isArray(ETERNA.state.posto.lista),15000),'T2: cartão Postos');
  await KA.fill('#posto-nome','Checkout 1');await KA.dblclick('[data-act="posto-parear"]');await KA.click('[data-act="posto-parear"]',{timeout:300}).catch(()=>{});
  ok(await espera(KA,()=>!ETERNA.state.user&&ETERNA.state.posto.estado==='ok',10000),'T2: pareado e conta saiu');
  ok(JSON.parse(sql('estado.db','select count(*) from posto'))[0][0]===1,'T2: dblclick + clique cria 1 posto: '+sql('estado.db','select id,nome from posto'));
  // servidor: 5 pedidos simultâneos com a mesma sessão e nome -> 1 posto; nome diferente -> outro posto
  const ckA=(await cAd.cookies()).find(c=>c.name==='eterna_sessao').value;
  const rs=await Promise.all([1,2,3,4,5].map(()=>req(PORTA,'POST','/postos/parear',{headers:{Cookie:'eterna_sessao='+ckA,Origin:A,'X-Eterna':'1'},body:{nome:'Caixa X'}})));
  ok(rs.every(r=>r.s===200)&&new Set(rs.map(r=>r.j.posto.id)).size===1,'T2: 5 pedidos simultâneos dão o mesmo posto: '+J(rs.map(r=>r.s+':'+(r.j&&r.j.posto&&r.j.posto.id))));
  const rOutro=await req(PORTA,'POST','/postos/parear',{headers:{Cookie:'eterna_sessao='+ckA,Origin:A,'X-Eterna':'1'},body:{nome:'Caixa Y'}});ok(rOutro.s===200&&rOutro.j.posto.id!==rs[0].j.posto.id,'T2: nome diferente cria outro posto');
  // revoga o "Caixa Y" e pareia de novo com o mesmo nome em seguida: não pode devolver o posto revogado
  const rv=await req(PORTA,'POST','/postos/revogar',{headers:{Cookie:'eterna_sessao='+ckA,Origin:A,'X-Eterna':'1'},body:{id:rOutro.j.posto.id}});
  const rDe=await req(PORTA,'POST','/postos/parear',{headers:{Cookie:'eterna_sessao='+ckA,Origin:A,'X-Eterna':'1'},body:{nome:'Caixa Y'}});
  const ckDe=((rDe.h['set-cookie']||[])[0]||'').split(';')[0];const euDe=await req(PORTA,'GET','/postos/eu',{headers:{Cookie:ckDe}});
  if(!ok(rv.s===200&&rDe.s===200&&euDe.s===200,'T2: revogar e parear de novo com o mesmo nome em 15 s dá um posto que funciona: revogar '+rv.s+' parear '+rDe.s+' '+J(rDe.j&&rDe.j.posto)+' /postos/eu '+euDe.s))0;

  // Checkout pareado
  const K=vigia(await cK.newPage(),'checkout');await KA.close();await K.goto(A+'/#loja');
  ok(await espera(K,()=>ETERNA.state.agent.on&&ETERNA.state.posto.estado==='ok'&&!!document.querySelector('[data-act="kiosk-emerg"]'),15000),'Checkout pareado abre');
  const fot=['carlos','marinara','samuel','yago'];let primeiraVez=true;
  for(let r=0;r<RODADAS;r++){
    const f=fot[r%fot.length];const arqs=r%2?[copia('b1',r*10+1)]:[copia('a1',r*10+1),copia('a2',r*10+2)];
    await sleep(3500);const fr=ftpEnvia(f,arqs);ok(/^226/.test(fr),`R${r}: FTP ${f}: ${fr}`);
    // espera a sessão nova fechar no servidor e aparecer no Checkout
    let card=null;for(let i=0;i<120&&!card;i++){await sleep(500);card=await K.evaluate(([f,n])=>{const ja=new Set(JSON.parse(sessionStorage.getItem('cg-usados')||'[]'));
      const c=Object.keys(ETERNA.SIM.sessions).find(c=>/^LP/.test(c)&&!ja.has(c)&&ETERNA.SIM.sessions[c].status!=='paga'&&ETERNA.SIM.sessions[c].status!=='aguardando'&&(ETERNA.SIM.sessions[c].photos||[]).length===n&&!!ETERNA.demoSessions().find(s=>s.card===c));
      if(c){ja.add(c);sessionStorage.setItem('cg-usados',JSON.stringify([...ja]));}return c||null;},[f,arqs.length]);}
    if(!ok(card,`R${r}: sessão nova de ${f} no Checkout`))continue;
    await K.click('[data-act="loja-new"]').catch(()=>{});await K.waitForTimeout(200);
    await K.evaluate(()=>{ETERNA.state.cam.busy=true;});await K.click('[data-act="kiosk-emerg"]');await K.fill('#kcode',card);await K.click('[data-act="kiosk-go"]');
    if(!ok(await espera(K,()=>ETERNA.state.kiosk.step==='review',5000),`R${r}: código abre (${card}) toast ${await toastTxt(K)}`))continue;
    await K.click('[data-act="kiosk-tog"][data-i="0"]').catch(async()=>{await K.click('[data-act="kiosk-ok"]');});await K.waitForTimeout(100);
    await K.evaluate(()=>document.querySelector('[data-act="loja-cart"]:not([disabled])').click());await K.waitForTimeout(150);
    await K.click(`[data-act="loja-paym"][data-m="${r%2?'card':'pix'}"]`);await K.click('[data-act="loja-checkout"]');
    ok(await espera(K,()=>ETERNA.state.kiosk.step==='done',5000),`R${r}: pendência criada`);
    const pend=await K.evaluate(c=>ETERNA.SIM.caixaDin.find(x=>x.card===c&&x.estado==='aguardando'),card);
    ok(await espera(K,()=>ETERNA.pvFila().length===0,15000),`R${r}: criar sobe`);
    const sel=pend?pend.selected||[]:[];
    // Caixa: aba nova no aparelho pareado (o Caixa usa o mesmo aparelho do Checkout), entrando de novo a cada rodada
    let cC=null;await cK.clearCookies({name:'eterna_sessao'});const CX=vigia(await cK.newPage(),'caixa'+r);
    await CX.goto(A+'/index.html');await CX.waitForSelector('[data-act="login-usuario"]');
    const okE=primeiraVez?await entrar(CX,'venda.teste',sv,SENHA+'v'):await entrar(CX,'venda.teste',SENHA+'v');primeiraVez=false;ok(okE,`R${r}: vendedor entra`);
    // confirma assim que a pendência aparece
    ok(await espera(CX,id=>!!document.querySelector(`[data-act="pend-pos"][data-id="${id}"]`),15000,pend.id),`R${r}: pendência no Caixa`);
    const carregada=await CX.evaluate(c=>{const x=ETERNA.demoSessions().find(s=>s.card===c);return x?x.photos.length:0;},card);
    await CX.click(`[data-act="pend-pos"][data-id="${pend.id}"]`);await CX.click(`[data-act="pend-pos-ok"][data-id="${pend.id}"]`);
    ok(await espera(CX,c=>ETERNA.SIM.sessions[c].status==='paga',5000,card),`R${r}: paga no Caixa`);
    const tok=await CX.evaluate(c=>ETERNA.SIM.sessions[c].galVenda||ETERNA.galDaSessao(c),card);const t0=Date.now();let gi=null;
    for(let i=0;i<80;i++){gi=await req(PORTA,'GET','/g/'+tok+'/info');if(gi.s===200)break;await sleep(500);}
    const est=await CX.evaluate(t=>({fotos:((ETERNA.SIM.galerias||{})[t]||{}).fotos,fila:(ETERNA.SIM.galFila||[]).find(x=>x.token===t)}),tok).catch(()=>null);
    ok(gi.s===200,`R${r} (fotos na aba no clique: ${carregada}): galeria publicada: ${gi.s} ${J(est)}`);
    notas.push(`R${r}: aba tinha ${carregada} foto(s); galeria em ${Date.now()-t0} ms`);
    if(gi.s===200){let m=null;for(let i=0;i<20;i++){m=manifesto(tok);if(m)break;await sleep(250);}
      const comp=m?(m.fotos||[]).filter(x=>x.direito==='comprada').map(x=>x.id):[];
      ok(m&&(m.fotos||[]).length===arqs.length&&comp.length===sel.length&&sel.every(id=>comp.includes(id)),`R${r}: manifesto com ${arqs.length} fotos e as ${sel.length} compradas: ${J(m&&m.fotos)} sel ${J(sel)}`);}
    // a sessão no Caixa fica paga e com as fotos (o registro da venda não se perde quando as fotos chegam)
    ok(await espera(CX,c=>{const s=ETERNA.SIM.sessions[c];return s&&s.status==='paga'&&(s.photos||[]).length>0&&s.saleNo;},20000,card),`R${r}: sessão paga com as fotos no Caixa: `+J(await CX.evaluate(c=>{const s=ETERNA.SIM.sessions[c]||{};return {st:s.status,n:(s.photos||[]).length,no:s.saleNo};},card)));
    await CX.screenshot({path:path.join(PR,`cg-caixa-r${r}.png`)});
    await CX.close();if(cC)await cC.close();
  }
}catch(e){fails.push('exceção: '+(e.message||e).split('\n').slice(0,2).join(' ')+' @ '+String(e.stack||'').split('\n').find(l=>/caixa-galeria/.test(l)));}
try{ag&&ag.kill('SIGKILL');}catch(e){}for(const c of ctxs)await c.close().catch(()=>{});await b.close();
if(/Traceback/.test(agLog))notas.push('traceback no agente: '+agLog.slice(agLog.indexOf('Traceback'),agLog.indexOf('Traceback')+300).replace(/\s+/g,' '));
try{fs.rmSync(home,{recursive:true,force:true});fs.rmSync(IMG,{recursive:true,force:true});}catch(e){}
const e2=errs.filter(e=>!/Failed to load|ERR_|net::|onnxruntime|40[134]|50[23]/.test(e));const okA=!fails.length&&!e2.length;
console.log(`${okA?'OK':'FALHA'} caixa-galeria-agente: aviso de não pareado, clique repetido em Parear, galeria da venda com o Caixa confirmando logo depois de entrar (${RODADAS} rodadas)${fails.length?' · '+fails.join(' | '):''}${e2.length?' · erros: '+e2.slice(0,4).join(' | '):''}${notas.length?' · notas: '+notas.join(' | '):''}`);process.exit(okA?0:1);})();
