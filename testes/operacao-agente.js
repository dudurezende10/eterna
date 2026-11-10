// Operação do ponto de ponta a ponta com o agente de verdade (HOME temporário), sem simular rotas: entradas com senha conferida
// no servidor, cadastro da equipe pela tela, fotos chegando pelo FTP embutido (modo passivo), Upload do fotógrafo, pareamento
// pelo Painel de controle e pelo link do servidor, Checkout pareado sem pessoa (selfie pela câmera e código), Caixa com
// "Pago na maquininha", impressão pelo servidor, galeria publicada, venda com o agente fora do ar, sessão vencida, recusas com
// aviso, Painel, Estatísticas e Preços, celular e tablet. Endereço com certificado (posto.eterna.photo) num proxy HTTPS local.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PR=path.join(__dirname,'prints');fs.mkdirSync(PR,{recursive:true});
const fails=[],errs=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SENHA='vento.cobalto.9271.lago';
function req(porta,method,p,{headers,body}={}){return new Promise(res=>{const d=body?Buffer.from(typeof body==='string'?body:J(body)):null;
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:Object.assign({},d?{'Content-Type':'application/json','Content-Length':d.length}:{},headers||{})},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const t=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(t)}catch(e){}res({s:rs.statusCode,j,t,h:rs.headers});});});
  r.on('error',()=>res({s:0}));if(d)r.write(d);r.end();});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await sleep(200);}return false;};
function vigia(pg,nome){pg.setDefaultTimeout(10000);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;}
const toastTxt=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'').catch(()=>'');

// imagens de teste: recortes ampliados das folhas de exemplo do repositório (sprites/c04.webp). "a" = a mesma pessoa em 3 fotos,
// "b1" e "b2" = outra pessoa. A selfie é um recorte do rosto de a2 espelhado, num vídeo y4m para a câmera falsa do Chromium.
const IMG=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-op-img-'));
execFileSync('python3',['-c',`
import cv2,sys,numpy as np
R,D=sys.argv[1],sys.argv[2];im=cv2.imread(R+'/sprites/c04.webp')
cells={'a1':(100,480,260,720),'a2':(1080,480,1440,720),'a3':(1900,480,2060,720),'b1':(1440,240,1800,480),'b2':(360,240,720,480)}
for k,(x0,y0,x1,y1) in cells.items():
    cv2.imwrite(D+'/'+k+'.jpg',cv2.resize(im[y0:y1,x0:x1],None,fx=6,fy=6,interpolation=cv2.INTER_CUBIC),[cv2.IMWRITE_JPEG_QUALITY,92])
cv2.imwrite(D+'/c1.jpg',cv2.flip(cv2.imread(D+'/b1.jpg'),1),[cv2.IMWRITE_JPEG_QUALITY,88])
a2=cv2.imread(D+'/a2.jpg');cx,cy=1092,448;s=cv2.flip(cv2.resize(a2[cy-330:cy+270,cx-400:cx+400],(640,480)),1)
f=open(D+'/selfie.y4m','wb');f.write(b'YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\\n')
fr=lambda x:f.write(b'FRAME\\n'+cv2.cvtColor(x,cv2.COLOR_BGR2YUV_I420).tobytes())
for i in range(10): fr(np.roll(s,i*60,axis=1)//2)
for i in range(40): fr(s)
f.close()
`,RAIZ,IMG]);

function modelos(home){const d=path.join(home,'Eterna','modelos');fs.mkdirSync(d,{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(d,f));}
const BASE=24000+Math.floor(Math.random()*40)*20;const PORTA=BASE,FTPP=BASE+1,PASV=`${BASE+2}-${BASE+12}`,TLSP=BASE+15;
const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-op-'));modelos(home);
const ENV={...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(PORTA),ETERNA_FTP_PORTA:String(FTPP),ETERNA_FTP_PASV:PASV,ETERNA_APP_ORIGIN:ORIG,ETERNA_SESSAO_PAUSA:'3',
  ETERNA_IMPRESSORA:'DNP Teste',ETERNA_IMPRESSORA_TESTE:'1',ETERNA_ORIGENS:'https://posto.eterna.photo',USER:'eterna-teste-sem-cartao',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};
let ag=null,agLog='';
async function subir(){ag=spawn('python3',[AG],{env:ENV,stdio:['ignore','pipe','pipe']});ag.stdout.on('data',d=>agLog+=d);ag.stderr.on('data',d=>agLog+=d);
  for(let i=0;i<80;i++){await sleep(250);if((await req(PORTA,'GET','/status')).s===200)return;}throw new Error('agente não subiu: '+agLog.slice(-300));}
const sql=(db,q)=>execFileSync('python3',['-c','import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchall();c.commit();print(json.dumps(r))',path.join(home,'Eterna','ponto',db),q]).toString().trim();
const A=`http://127.0.0.1:${PORTA}`;

async function entrar(pg,usuario,senha,nova){await pg.fill('[data-act="login-usuario"]',usuario);await pg.fill('[data-act="login-senha"]',senha);await pg.click('button[type=submit]');
  if(nova){if(!await espera(pg,()=>ETERNA.state.auth.step==='trocar',8000))return false;await pg.fill('[data-act="login-nova"]',nova);await pg.fill('[data-act="login-nova2"]',nova);await pg.click('button[type=submit]');}
  return espera(pg,()=>!!ETERNA.state.user,8000);}
async function cadastrar(pg,usuario,nome,preset,key){await pg.evaluate(()=>{ETERNA.go('usuarios');ETERNA.state.users.draft=null;ETERNA.render();});await pg.click('[data-act="user-new"]');
  await pg.fill('[data-act="user-field"][data-k="name"]',nome);await pg.fill('[data-act="user-field"][data-k="email"]',usuario);await pg.selectOption('[data-act="user-preset"]',preset);
  if(key)await pg.selectOption('[data-act="user-key"]',key);await pg.click('[data-act="user-save"]');
  if(!await espera(pg,u=>ETERNA.state.users.senha&&ETERNA.state.users.senha.usuario===u,10000,usuario)){ // o cadastro novo ainda subindo: gera de novo pela ficha
    notas.push('senha provisória de '+usuario+' na criação: "'+await toastTxt(pg)+'"; gerada de novo pela ficha');await sleep(2000);
    await pg.evaluate(u=>{ETERNA.state.users.draft=null;ETERNA.render();},usuario);await pg.click(`[data-act="user-sel"][data-e="${usuario}"]`);await pg.click('[data-act="user-senha"]');
    if(!await espera(pg,u=>ETERNA.state.users.senha&&ETERNA.state.users.senha.usuario===u,10000,usuario))return null;}
  const s=await pg.evaluate(()=>ETERNA.state.users.senha.valor);await pg.click('[data-act="user-senha-ok"]');return s;}
function ftpEnvia(usuario,arquivos){const users=JSON.parse(fs.readFileSync(path.join(home,'Eterna','ftp.json'),'utf8')).users;
  return execFileSync('python3',['-c',`
import ftplib,sys,os
f=ftplib.FTP();f.connect('127.0.0.1',int(sys.argv[1]),timeout=20);f.login(sys.argv[2],sys.argv[3]);f.set_pasv(True);out=[]
for a in sys.argv[4:]:
    with open(a,'rb') as x: out.append(f.storbinary('STOR '+os.path.basename(a),x)[:3])
f.quit();print(','.join(out))`,String(FTPP),usuario,users[usuario],...arquivos.map(a=>path.join(IMG,a+'.jpg'))]).toString().trim();}

(async()=>{const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+path.join(IMG,'selfie.y4m')]});let b2=null,proxy=null;
const ctxs=[];const novo=async(o)=>{const c=await b.newContext(Object.assign({viewport:{width:1440,height:900},locale:'pt-BR'},o||{}));await c.grantPermissions(['camera'],{origin:A});ctxs.push(c);return c;};
try{
  // 0. servidor novo: o primeiro administrador sai do console do servidor, com senha provisória
  const cli=execFileSync('python3',[AG,'--criar-admin','admin.teste','Admin de teste'],{env:ENV}).toString();const prov=(cli.match(/troque na primeira entrada: (\S+)/)||[])[1];
  ok(prov,'--criar-admin deveria mostrar a senha provisória: '+cli.slice(0,120));await subir();
  const st0=await req(PORTA,'GET','/status');ok(st0.s===200&&!st0.j.ftp&&!st0.j.inbox&&!st0.j.users,'/status anônimo mínimo: '+Object.keys(st0.j||{}).join(','));

  // 1. Admin entra (senha provisória -> cria a dele) e cadastra a equipe pela tela, com a senha provisória de cada um
  const cAd=await novo();const AD=vigia(await cAd.newPage(),'admin');await AD.goto(A+'/index.html');await AD.waitForTimeout(500);
  ok(await entrar(AD,'admin.teste',prov,SENHA),'admin entra com a senha provisória e cria a senha dele');
  await espera(AD,()=>ETERNA.state.agent.on,15000);
  const ckAd=(await cAd.cookies()).find(c=>c.name==='eterna_sessao');ok(ckAd&&ckAd.httpOnly&&ckAd.sameSite==='Strict'&&!ckAd.secure,'cookie de sessão HttpOnly/Strict (sem Secure em http): '+J(ckAd&&{h:ckAd.httpOnly,s:ckAd.sameSite,sec:ckAd.secure}));
  const SEN={};
  for(const [u,n,p,k] of [['carlos.teste','Carlos de teste','foto','carlos'],['venda.teste','Venda de teste','venda',null],['super.teste','Supervisora de teste','supervisor',null]]){
    SEN[u]=await cadastrar(AD,u,n,p,k);if(!ok(SEN[u],'cadastro de '+u+' pela tela com senha provisória: '+await toastTxt(AD))){
      notas.push('DEBUG recusados='+await AD.evaluate(()=>localStorage.getItem('eterna.db.recusados.v1'))+' docs='+sql('estado.db',"select col,id from doc where col='usuarios'")+' authlog='+execFileSync('python3',['-c','import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);print(c.execute("select name from sqlite_master").fetchall())',path.join(home,'Eterna','ponto','estado.db')]).toString());throw new Error('parar');}}
  const cads=JSON.parse(sql('estado.db',"select id from doc where col='usuarios' and valor is not null"));
  ok(['carlos.teste','venda.teste','super.teste'].every(u=>cads.some(r=>r[0]===u)),'cadastros gravados no servidor: '+J(cads));
  await AD.screenshot({path:path.join(PR,'op-usuarios.png')});

  // 2. fotos pelo FTP embutido (passivo): pessoa "a" com o Carlos; pessoa "b" com a Marinara e o Samuel (sessões separadas)
  const f1=ftpEnvia('carlos',['a1','a2','a3']);ok(f1==='226,226,226','FTP carlos: 3 fotos 226: '+f1);
  const f2=ftpEnvia('marinara',['b1']);const f3=ftpEnvia('samuel',['b2']);const f4=ftpEnvia('yago',['c1']);ok(f2==='226'&&f3==='226'&&f4==='226','FTP marinara/samuel/yago: '+f2+' '+f3+' '+f4);
  const ftpPort=execFileSync('python3',['-c',`
import ftplib,sys
f=ftplib.FTP();f.connect('127.0.0.1',int(sys.argv[1]),timeout=10);f.login(sys.argv[2],sys.argv[3])
try: print(f.sendcmd('PORT 127,0,0,1,200,10'))
except ftplib.error_perm as e: print(str(e))`,String(FTPP),'carlos',JSON.parse(fs.readFileSync(path.join(home,'Eterna','ftp.json'),'utf8')).users.carlos]).toString().trim();
  ok(/^502/.test(ftpPort),'FTP modo ativo (PORT) recusado com 502: '+ftpPort);

  // 3. o fotógrafo entra e vê as fotos dele chegando no Upload automático
  const cF=await novo();const FO=vigia(await cF.newPage(),'fotografo');await FO.goto(A+'/index.html');await FO.waitForTimeout(400);
  ok(await entrar(FO,'carlos.teste',SEN['carlos.teste'],SENHA+'f'),'fotógrafo entra (senha provisória -> a dele)');
  ok(await espera(FO,()=>ETERNA.state.view==='importar',5000),'fotógrafo começa no Upload automático: '+await FO.evaluate(()=>ETERNA.state.view));
  ok(await espera(FO,()=>ETERNA.state.agent.on&&(ETERNA.state.lib||[]).length>=6,20000),'Upload: biblioteca do agente com as 6 fotos: '+await FO.evaluate(()=>(ETERNA.state.lib||[]).length));
  const thumbs=await espera(FO,()=>[...document.querySelectorAll('#main [style*="/thumb/"], #main img[src*="/thumb/"]')].length>=3,15000);
  ok(thumbs,'Upload mostra miniaturas das fotos do FTP');
  const quem=await FO.evaluate(()=>(ETERNA.state.lib||[]).map(f=>ETERNA.libWho(f)).join(','));ok(/carlos/.test(quem),'fotos do FTP atribuídas ao login (carlos): '+quem);
  // sessões fechadas (pausa 3 s + rosto)
  ok(await espera(FO,()=>{const s=ETERNA.SRV&&ETERNA.SRV.sess;return s&&Object.values(s).filter(x=>x.status==='fechada').length>=4;},45000),'4 sessões fechadas no servidor: '+await FO.evaluate(()=>JSON.stringify(Object.values(ETERNA.SRV&&ETERNA.SRV.sess||{}).map(x=>x.status))).catch(()=>'?'));
  await FO.screenshot({path:path.join(PR,'op-upload-fotografo.png'),fullPage:false});
  // perfil sem permissão: o fotógrafo não abre Painel de controle e a gravação de preço é recusada com aviso
  ok(await FO.evaluate(()=>!ETERNA.canView('catalogo')),'fotógrafo não vê Painel de controle');
  await FO.waitForTimeout(3500);await FO.evaluate(()=>ETERNA.state.db.doc('sim/prices|zona').set(1));
  ok(await espera(FO,()=>/não foi aceita/.test((document.querySelector('#toast')||{}).textContent||''),10000),'preço gravado pelo fotógrafo: recusa com aviso: '+await toastTxt(FO));
  const r403=await FO.evaluate(async()=>(await ETERNA.agFetch(location.origin+'/metricas/dia')).status);ok(r403===403,'fotógrafo em /metricas/dia: 403 '+r403);
  ok(await FO.evaluate(()=>!!ETERNA.state.user),'403 não derruba a sessão do fotógrafo');

  // 4. pareamento pelo Painel de controle no aparelho do Checkout; a conta do Admin sai do aparelho depois
  const cK=await novo({viewport:{width:1280,height:900}});const KA=vigia(await cK.newPage(),'checkout-admin');await KA.goto(A+'/#loja');
  ok(await espera(KA,()=>ETERNA.state.posto.estado==='nao'&&/ainda não foi pareado/i.test(document.body.innerText),15000),'Checkout sem pareamento: aviso da equipe');
  await KA.screenshot({path:path.join(PR,'op-nao-pareado-1280.png')});
  await KA.setViewportSize({width:390,height:844});await KA.screenshot({path:path.join(PR,'op-nao-pareado-390.png')});
  const sobra=await KA.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok(sobra<=1,'aviso de não pareado sem rolagem lateral em 390 px: '+sobra);await KA.setViewportSize({width:1280,height:900});
  const btnNP=await KA.evaluate(()=>[...document.querySelectorAll('[data-act="posto-tentar"],[data-act="loja-sair"]')].map(b=>{const c=getComputedStyle(b);return {t:b.textContent,cor:c.color,fundo:c.backgroundColor};}));
  ok(btnNP.length===2&&btnNP.every(x=>x.cor!==x.fundo),'botões do aviso de não pareado legíveis (cor do texto diferente do fundo): '+J(btnNP));
  await KA.click('[data-act="loja-sair"]');await KA.waitForTimeout(400);ok(await entrar(KA,'admin.teste',SENHA),'admin sai do aviso pelo botão Sair e entra no aparelho do Checkout');
  await KA.evaluate(()=>ETERNA.go('catalogo'));ok(await espera(KA,()=>!!document.querySelector('#postos-painel [data-act="posto-parear"]')&&Array.isArray(ETERNA.state.posto.lista),15000),'cartão Postos deste ponto');
  await KA.waitForTimeout(300);await KA.fill('#posto-nome','Checkout 1');
  await KA.screenshot({path:path.join(PR,'op-postos-painel.png')});
  await KA.evaluate(()=>{const b=document.querySelector('[data-act="posto-parear"]');b.click();b.click();}); // clique duplo
  ok(await espera(KA,()=>!ETERNA.state.user&&ETERNA.state.posto.estado==='ok',10000),'depois de parear, o admin sai e o posto fica ok: '+J(await KA.evaluate(()=>ETERNA.state.posto)));
  const nPostos=JSON.parse(sql('estado.db','select count(*) from posto'))[0][0];ok(nPostos===1,'clique repetido em Parear cria 1 posto só: '+nPostos);
  ok(/Sua conta saiu/.test(await toastTxt(KA)),'aviso de que a conta saiu: '+await toastTxt(KA));
  const authEu=await KA.evaluate(async()=>(await fetch('/auth/eu',{credentials:'same-origin'})).status);ok(authEu===401,'sessão do admin encerrada no servidor depois de parear: '+authEu);
  ok(JSON.parse(await KA.evaluate(()=>localStorage.getItem('eterna.posto.v1'))||'{}').nome==='Checkout 1','posto guardado no aparelho');

  // 5. Checkout pareado, sem ninguém conectado: selfie pela câmera acha a pessoa "a"
  const K=vigia(await cK.newPage(),'checkout');await K.goto(A+'/#loja');await KA.close();
  ok(await espera(K,()=>ETERNA.state.agent.on&&ETERNA.state.posto.estado==='ok'&&!!document.querySelector('[data-act="kiosk-emerg"]'),15000),'Checkout pareado abre a tela do cliente');
  ok(await espera(K,()=>Object.keys(ETERNA.SIM.sessions||{}).filter(c=>(ETERNA.SIM.sessions[c].photos||[]).some(p=>/^ag_/.test(p.id||p))).length>=3||Object.values(ETERNA.SRV&&ETERNA.SRV.sess||{}).filter(x=>x.status==='fechada').length>=3,20000),'Checkout recebe as sessões do servidor');
  let stR=null;for(let i=0;i<120;i++){stR=(await req(PORTA,'GET','/status',{headers:{Cookie:'eterna_sessao=x'}})).j;const s2=await K.evaluate(()=>ETERNA.state.agent.rostos);if(s2&&s2.ligado)break;await sleep(500);}
  const achou=await espera(K,()=>['gallery','review','talvez'].includes(ETERNA.state.kiosk.step),25000);
  if(!achou){notas.push('a câmera falsa não disparou sozinha; camFound chamado');await K.evaluate(()=>ETERNA.camFound());}
  ok(await espera(K,()=>['gallery','review'].includes(ETERNA.state.kiosk.step)&&ETERNA.state.kiosk.so,20000),'selfie acha a sessão da pessoa a: '+J(await K.evaluate(()=>({st:ETERNA.state.kiosk.step,cam:ETERNA.state.cam.status}))));
  const so=await K.evaluate(()=>{const k=ETERNA.state.kiosk;return {card:k.code,ids:(k.so||{}).ids||[],n:ETERNA.lojaItems(k.code).length};});
  ok(so.n===3,'selfie: as 3 fotos da pessoa a, nenhuma da b: '+J(so));
  await K.screenshot({path:path.join(PR,'op-checkout-selfie-fotos.png')});
  // escolhe 2 fotos (uma pelo ✓ da foto ampliada, outra na grade) e paga com cartão
  await K.click('[data-act="kiosk-ok"]').catch(()=>{});await K.click('[data-act="kiosk-fechar"]').catch(()=>{});await K.waitForTimeout(200);
  await K.click('[data-act="kiosk-tog"][data-i="1"]');await K.waitForTimeout(150);
  ok(await K.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code).ch.length)===2,'2 fotos marcadas');
  await K.click('.lj-foot [data-act="loja-cart"]');await K.waitForTimeout(200);await K.click('[data-act="loja-paym"][data-m="card"]');await K.waitForTimeout(150);
  await K.screenshot({path:path.join(PR,'op-checkout-carrinho.png')});
  await K.evaluate(()=>{const b=document.querySelector('[data-act="loja-checkout"]');b.click();b.click();}); // clique duplo
  ok(await espera(K,()=>ETERNA.state.kiosk.step==='done'&&ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.wait,8000),'cartão: Checkout espera a maquininha');
  const cardA=so.card;const pendA=await K.evaluate(c=>ETERNA.SIM.caixaDin.filter(r=>r.card===c&&r.estado==='aguardando').map(r=>({id:r.id,saleNo:r.saleNo,total:r.total})),cardA);
  const numP=await K.evaluate(()=>ETERNA.postoDisp().num);ok(pendA.length===1&&pendA[0].saleNo.startsWith('P'+numP+'-'),'1 pendência (clique duplo não duplica), número P'+numP+'-: '+J(pendA));
  ok(await espera(K,()=>ETERNA.pvFila().length===0,15000),'evento criar sobe do posto');
  const evA=JSON.parse(sql('vendas.db',`select tipo,count(*) from evento where venda='${pendA[0]&&pendA[0].id}' group by tipo`));ok(J(evA)===J([['criar',1]]),'servidor com 1 criar da venda A: '+J(evA));
  await K.screenshot({path:path.join(PR,'op-checkout-aguardando.png')});
  // volta ao início e acha a pessoa "b" (Marinara) pelo código da sessão
  await K.click('[data-act="loja-new"]');await K.waitForTimeout(300);
  const cardB=await K.evaluate(()=>Object.keys(ETERNA.SIM.sessions).find(c=>{const s=ETERNA.SIM.sessions[c];return /^LP/.test(c)&&s.status!=='aguardando'&&s.status!=='paga'&&(s.photographer==='marinara'||s.foto==='marinara'||s.key==='marinara');})||null);
  const cards=await K.evaluate(()=>Object.entries(ETERNA.SIM.sessions).filter(([c])=>/^LP/.test(c)).map(([c,s])=>({c,st:s.status||'',p:s.photographer||s.key||s.foto||'',n:(s.photos||[]).length})));
  const cB=cardB||(cards.find(x=>x.c!==cardA&&x.n===1)||{}).c;ok(cB,'sessão da pessoa b no Checkout: '+J(cards));
  K.setDefaultTimeout(4000);await K.evaluate(()=>{ETERNA.state.cam.busy=true;});await K.click('[data-act="kiosk-emerg"]');await K.fill('#kcode','LPXXXXX99');await K.click('[data-act="kiosk-go"]');
  ok(/não|invalid|código/i.test(await toastTxt(K)),'código errado avisa: '+await toastTxt(K));
  await K.fill('#kcode',cB.toLowerCase());await K.click('[data-act="kiosk-go"]');ok(await espera(K,()=>ETERNA.state.kiosk.step==='review',5000),'código da sessão abre as fotos: '+cB+' '+J(cards)+' toast '+await toastTxt(K)+' step '+await K.evaluate(()=>ETERNA.state.kiosk.step));
  await K.click('[data-act="kiosk-tog"][data-i="0"]').catch(async()=>{await K.click('[data-act="kiosk-ok"]');});await K.waitForTimeout(150);
  await K.evaluate(()=>document.querySelector('[data-act="loja-cart"]:not([disabled])').click());await K.waitForTimeout(200);await K.click('[data-act="loja-paym"][data-m="cash"]');await K.click('[data-act="loja-checkout"]');
  ok(await espera(K,()=>ETERNA.state.kiosk.step==='done',5000),'dinheiro: aguardando caixa');const pendB=await K.evaluate(c=>(ETERNA.SIM.caixaDin.find(r=>r.card===c&&r.estado==='aguardando')||{}).id,cB);
  ok(await espera(K,()=>ETERNA.pvFila().length===0,15000),'evento criar da venda B sobe');

  // 6. Caixa: vendedor entra no mesmo aparelho (outra aba), confirma "Pago na maquininha" com NSU, imprime e a galeria é publicada
  const CX=vigia(await cK.newPage(),'caixa');await CX.goto(A+'/index.html');await CX.waitForTimeout(400);
  ok(await entrar(CX,'venda.teste',SEN['venda.teste'],SENHA+'v'),'vendedor entra');ok(await espera(CX,()=>ETERNA.state.view==='posto',5000),'vendedor começa no Posto de venda: '+await CX.evaluate(()=>ETERNA.state.view));
  ok(await espera(CX,()=>document.querySelectorAll('#pend-painel [data-pend]').length===2,8000),'Caixa vê as 2 pendências: '+await CX.evaluate(()=>document.querySelectorAll('#pend-painel [data-pend]').length));
  await CX.screenshot({path:path.join(PR,'op-caixa-pendencias.png')});
  ok(await espera(CX,c=>{const s=ETERNA.demoSessions().find(x=>x.card===c);return s&&s.photos.length===3;},20000,cardA),'Caixa carrega as sessões do servidor');
  await CX.click(`[data-act="pend-pos"][data-id="${pendA[0].id}"]`);await CX.fill('#pend-ref','4111111111111111');await CX.click(`[data-act="pend-pos-ok"][data-id="${pendA[0].id}"]`);
  ok(/parece número de cartão/.test(await toastTxt(CX)),'NSU com número de cartão recusado: '+await toastTxt(CX));
  await CX.fill('#pend-ref','123456');await CX.evaluate(id=>{const b=document.querySelector(`[data-act="pend-pos-ok"][data-id="${id}"]`);b.click();b.click();},pendA[0].id);
  ok(await espera(CX,c=>ETERNA.SIM.sessions[c].status==='paga',5000,cardA),'venda A paga no Caixa');
  ok(await espera(CX,()=>ETERNA.pvFila().length===0,15000),'evento pagar sobe');
  const evA2=JSON.parse(sql('vendas.db',`select tipo,count(*) from evento where venda='${pendA[0].id}' group by tipo order by tipo`));ok(J(evA2)===J([['criar',1],['pagar',1]]),'servidor: criar e pagar uma vez cada (clique duplo): '+J(evA2));
  const tokA=await CX.evaluate(c=>ETERNA.SIM.sessions[c].galVenda||ETERNA.galDaSessao(c),cardA);
  let gi=null;const tG=Date.now();for(let i=0;i<120;i++){gi=await req(PORTA,'GET','/g/'+tokA+'/info');if(gi.s===200)break;await sleep(250);}
  ok(gi.s===200,'galeria da venda A publicada no servidor: '+gi.s+' '+J(await CX.evaluate(t=>({fotos:(ETERNA.SIM.galerias[t]||{}).fotos,fila:(ETERNA.SIM.galFila||[]).find(x=>x.token===t)}),tokA)));
  notas.push('galeria publicada em '+(Date.now()-tG)+' ms');ok(gi.j&&gi.j.compra===false,'galeria sem compra online (pagamento desligado): '+J(gi.j&&gi.j.compra));
  // imprime pela impressora do servidor (simulada)
  ok(await espera(CX,c=>!!document.querySelector(`[data-act="imp-print"][data-card="${c}"]`),8000,cardA),'botão Imprimir da venda A');
  await CX.click(`[data-act="imp-print"][data-card="${cardA}"]`);
  ok(await espera(CX,()=>/Enviado para DNP Teste/.test((document.querySelector('#toast')||{}).textContent||''),30000),'impressão enviada ao servidor: '+await toastTxt(CX));
  const fila=await req(PORTA,'GET','/impressao/fila',{headers:{Cookie:'eterna_sessao='+((await cK.cookies()).find(c=>c.name==='eterna_sessao')||{}).value}});ok(fila.s===200&&J(fila.j).includes(pendA[0].saleNo),'fila da impressora com a venda A: '+fila.s+' '+J(fila.j).slice(0,160));
  // dinheiro da venda B
  await CX.click(`[data-act="din-confirm"][data-id="${pendB}"]`);ok(await espera(CX,c=>ETERNA.SIM.sessions[c].status==='paga',5000,cB),'dinheiro da venda B recebido');
  ok(await espera(CX,()=>ETERNA.pvFila().length===0,15000),'pagar B sobe');
  ok(await espera(K,()=>ETERNA.state.kiosk.step==='done'&&ETERNA.state.kiosk.paid&&!ETERNA.state.kiosk.paid.wait,8000),'Checkout (venda B na tela) vira a tela do QR depois da confirmação no Caixa');
  await K.screenshot({path:path.join(PR,'op-checkout-qr.png')});
  // vendedor sem permissão: preço e Painel de controle recusados com aviso
  const pr0=await CX.evaluate(()=>ETERNA.canView('catalogo'));
  await CX.waitForTimeout(3000);await CX.evaluate(()=>ETERNA.state.db.doc('sim/prices|zona').set(2));
  ok(await espera(CX,()=>/não foi aceita/.test((document.querySelector('#toast')||{}).textContent||''),10000),'vendedor mudando preço: recusa com aviso: '+await toastTxt(CX)+' (vê Painel de controle: '+pr0+')');

  // 7. venda offline: agente fora; Checkout gera pendência; volta e sobe uma vez só
  ag.kill('SIGKILL');await sleep(800);await K.click('[data-act="loja-new"]').catch(()=>{});await K.waitForTimeout(300);
  const cC=await K.evaluate(a=>Object.keys(ETERNA.SIM.sessions).find(c=>/^LP/.test(c)&&!a.includes(c)&&ETERNA.SIM.sessions[c].status!=='paga'&&ETERNA.SIM.sessions[c].status!=='aguardando'),[cardA,cB]);ok(cC,'terceira sessão para a venda offline');
  await K.click('[data-act="kiosk-emerg"]');await K.fill('#kcode',cC);await K.click('[data-act="kiosk-go"]');await K.waitForTimeout(200);
  await K.click('[data-act="kiosk-tog"][data-i="0"]').catch(async()=>{await K.click('[data-act="kiosk-ok"]');});await K.evaluate(()=>document.querySelector('[data-act="loja-cart"]:not([disabled])').click());
  await K.click('[data-act="loja-paym"][data-m="pix"]');await K.click('[data-act="loja-checkout"]');
  ok(await espera(K,()=>ETERNA.state.kiosk.step==='done',5000),'offline: Checkout gera a pendência');
  const pendC=await K.evaluate(c=>ETERNA.SIM.caixaDin.find(r=>r.card===c&&r.estado==='aguardando'),cC);ok(pendC&&pendC.saleNo.startsWith('P'+numP+'-'),'offline: número de venda com o posto guardado (P'+numP+'-): '+(pendC&&pendC.saleNo));
  await sleep(2500);ok(await K.evaluate(()=>ETERNA.pvFila().length)===1,'offline: a venda fica na fila: '+await K.evaluate(()=>ETERNA.pvFila().length));
  await subir();
  ok(await espera(K,()=>ETERNA.pvFila().length===0,30000),'agente de volta: a fila sobe');
  await K.reload();await K.waitForTimeout(6000);
  const evC=JSON.parse(sql('vendas.db',`select count(*) from evento where venda='${pendC.id}'`))[0][0];ok(evC===1,'venda offline gravada uma vez só: '+evC);

  // 8. sessão vencida no servidor: aviso, entrada de novo, fila preservada (aparelho sem posto)
  sql('estado.db','delete from sessao_login');await AD.reload();await AD.waitForTimeout(1500);
  ok(await espera(AD,()=>!ETERNA.state.user,10000),'sessão vencida: volta para a entrada');
  const tAviso=await toastTxt(AD);if(!/sessão terminou/i.test(tAviso))notas.push('ao recarregar com sessão vencida não houve o aviso "Sua sessão terminou" (toast: '+tAviso+')');
  await AD.evaluate(()=>ETERNA.pvEvento('criar','SV-TESTE-1',{saleNo:'L0-900',card:'LPSV0001',meio:'pix',prov:'pos-manual',total:35,nPh:1}));
  await sleep(2500);ok(await AD.evaluate(()=>ETERNA.pvFila().length)===1,'sem sessão e sem posto, o evento fica na fila: '+await AD.evaluate(()=>ETERNA.pvFila().length));
  ok(await entrar(AD,'admin.teste',SENHA),'admin entra de novo');ok(await espera(AD,()=>ETERNA.pvFila().length===0,20000),'depois de entrar, a fila sobe');
  ok(JSON.parse(sql('vendas.db',"select count(*) from evento where venda='SV-TESTE-1'"))[0][0]===1,'evento da sessão vencida gravado uma vez');
  // Caixa com sessão vencida no aparelho pareado: aviso e volta para a entrada
  sql('estado.db','delete from sessao_login');await CX.evaluate(()=>ETERNA.agFetch(location.origin+'/biblioteca'));
  ok(await espera(CX,()=>!ETERNA.state.user,8000)&&/sessão terminou/i.test(await toastTxt(CX)),'Caixa com sessão vencida: "Sua sessão terminou": '+await toastTxt(CX));
  ok(await K.evaluate(()=>ETERNA.state.posto.estado==='ok'&&!!document.querySelector('[data-act="kiosk-emerg"],[data-act="loja-new"]')),'o Checkout pareado segue de pé');

  // 9. Supervisora e Admin: Painel, Estatísticas, Preços
  const cS=await novo();const SU=vigia(await cS.newPage(),'supervisora');await SU.goto(A+'/index.html');await SU.waitForTimeout(400);
  ok(await entrar(SU,'super.teste',SEN['super.teste'],SENHA+'s'),'supervisora entra');ok(await espera(SU,()=>ETERNA.state.view==='painel',5000),'supervisora começa no Painel');
  await SU.waitForTimeout(1500);const tP=await SU.evaluate(()=>document.querySelector('#main').innerText);ok(/painel/i.test(tP)&&!/undefined|NaN/.test(tP),'Painel da supervisora sem undefined/NaN: '+(tP.match(/.{0,60}(undefined|NaN).{0,40}/)||[''])[0].replace(/\s+/g,' '));
  await SU.screenshot({path:path.join(PR,'op-painel-supervisora.png')});
  ok(await SU.evaluate(()=>!ETERNA.canView('estatisticas')),'supervisora não vê Estatísticas');
  await SU.evaluate(()=>ETERNA.go('catalogo'));await SU.waitForTimeout(800);
  const supP=await SU.evaluate(()=>({inp:[...document.querySelectorAll('[data-act="price"]')].filter(x=>!x.disabled&&!x.readOnly).length,postos:!!document.querySelector('#postos-painel'),parear:!!document.querySelector('[data-act="posto-parear"]')}));
  if(supP.inp)notas.push('supervisora (catálogo só leitura) vê os campos de preço editáveis: '+supP.inp);ok(supP.postos&&supP.parear,'supervisora: preços só leitura, vê e pode parear postos (configuracao.u): '+J(supP));
  await espera(SU,()=>!!ETERNA.state.db,15000);await SU.waitForTimeout(3000);
  const pid0=await SU.evaluate(()=>{const i=document.querySelector('[data-act="price"]');return i&&{id:i.dataset.id,v:i.value};});
  if(pid0){await SU.fill(`[data-act="price"][data-id="${pid0.id}"]`,'5');
    ok(await espera(SU,()=>/não foi aceita|Sem permissão/.test((document.querySelector('#toast')||{}).textContent||''),10000),'supervisora digitando preço (só leitura): aviso: '+await toastTxt(SU));
    await SU.waitForTimeout(3000);const loc=await SU.evaluate(id=>ETERNA.priceOf(id),pid0.id);
    ok(String(loc)===String(pid0.v),'preço recusado não fica valendo neste aparelho: antes '+pid0.v+', agora '+loc);
    const srv=sql('estado.db',`select valor from doc where col='sim' and id='prices|${pid0.id}'`);ok(!/^\[\["5"\]\]$|^\[\[5\]\]$/.test(srv),'preço da supervisora não chega ao servidor: '+srv);}
  // a limpeza das sessões no passo 8 também derrubou a do admin: ele recebe o aviso na próxima chamada e entra de novo
  await AD.evaluate(()=>ETERNA.agFetch(location.origin+'/biblioteca'));ok(await espera(AD,()=>!ETERNA.state.user,8000),'admin com sessão vencida volta para a entrada');ok(await entrar(AD,'admin.teste',SENHA),'admin entra de novo (2)');
  await AD.evaluate(()=>ETERNA.go('estatisticas'));await AD.waitForTimeout(2500);const tE=await AD.evaluate(()=>document.querySelector('#main').innerText);
  ok(/estatísticas/i.test(tE)&&!/undefined|NaN/.test(tE),'Estatísticas do admin abrem');await AD.screenshot({path:path.join(PR,'op-estatisticas.png')});
  const met=await AD.evaluate(async()=>{const r=await ETERNA.agFetch(location.origin+'/metricas/dia?dias=1');return {s:r.status,t:(await r.text()).slice(0,4000)};});ok(met.s===200,'admin lê /metricas/dia: '+met.s);
  await AD.evaluate(()=>ETERNA.go('catalogo'));await AD.waitForTimeout(800);
  const preco=await AD.evaluate(()=>{const i=[...document.querySelectorAll('[data-act="price"]')].find(x=>!x.disabled);if(!i)return null;i.value='77';i.dispatchEvent(new Event('input',{bubbles:true}));return i.dataset.id;});
  ok(preco,'admin tem campo de preço editável');await AD.waitForTimeout(4000);
  const precoSrv=sql('estado.db',`select valor from doc where col='sim' and id='prices|${preco}'`);ok(/77/.test(precoSrv),'preço do admin gravado no servidor: '+precoSrv);
  ok(!/não foi aceita/.test(await toastTxt(AD)),'sem aviso de recusa para o admin');

  // 10. pareamento pelo link do servidor (--parear-posto): botão, uso único, 10 min; revogação pelo Painel
  const lk=execFileSync('python3',[AG,'--parear-posto','Caixa 2'],{env:ENV}).toString();const url=(lk.match(/http:\/\/\S+/)||[])[0];ok(url,'link do --parear-posto: '+lk.slice(0,100));
  const cL=await novo();const L=vigia(await cL.newPage(),'link');const r1=await L.goto(url);
  ok(r1.status()===200&&await L.isVisible('button[type=submit]'),'link abre a página com o botão');
  const prev=await req(PORTA,'GET',url.replace(A,''));ok(prev.s===200,'abrir o link de novo (prévia) não gasta o código: '+prev.s);
  await L.click('button[type=submit]');await L.waitForLoadState();ok(/Aparelho pareado/.test(await L.textContent('body')),'botão pareia o aparelho');
  const ckL=(await cL.cookies()).find(c=>c.name==='eterna_posto');ok(ckL&&ckL.httpOnly&&ckL.sameSite==='Strict','cookie do posto pelo link HttpOnly/Strict');
  const r2=await req(PORTA,'GET',url.replace(A,''));ok(r2.s===410,'link usado: 410: '+r2.s);
  const lk2=execFileSync('python3',[AG,'--parear-posto','Caixa 3'],{env:ENV}).toString();const url2=(lk2.match(/http:\/\/\S+/)||[])[0];
  sql('estado.db','update posto_convite set expira=expira-601 where usado is null');const r3=await req(PORTA,'GET',url2.replace(A,''));ok(r3.s===410,'link depois de 10 min: 410: '+r3.s);
  const LK=vigia(await cL.newPage(),'link-checkout');await LK.goto(A+'/#loja');ok(await espera(LK,()=>ETERNA.state.posto.estado==='ok'&&ETERNA.postoDisp().nome==='Caixa 2',15000),'Checkout pareado pelo link');
  await AD.waitForTimeout(10500);await AD.evaluate(()=>ETERNA.go('catalogo'));if(!ok(await espera(AD,()=>/Caixa 2/.test((document.querySelector('#postos-painel')||{}).textContent||''),12000),'lista mostra Caixa 2'))await AD.screenshot({path:path.join(PR,'op-erro-lista.png')});
  const pid2=await LK.evaluate(()=>ETERNA.postoDisp().id);await AD.click(`[data-act="posto-revogar"][data-id="${pid2}"]`);await AD.waitForTimeout(800);
  ok(/revogado/i.test(await toastTxt(AD)),'revogar pelo Painel: '+await toastTxt(AD));
  await LK.evaluate(()=>ETERNA.postoCarregar());ok(await espera(LK,()=>ETERNA.state.posto.estado==='nao'&&/não foi pareado/i.test(document.body.innerText),8000),'posto revogado volta para o aviso');
  ok(await LK.evaluate(()=>localStorage.getItem('eterna.posto.v1'))===null,'revogado: o aparelho esquece o posto');

  // 11. telas novas em celular e tablet, idiomas do Checkout
  for(const [w,h] of [[390,844],[820,1180]]){await K.setViewportSize({width:w,height:h});await K.click('[data-act="loja-new"]').catch(()=>{});await K.waitForTimeout(400);
    const sb=await K.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok(sb<=1,`Checkout pareado em ${w}px sem rolagem lateral: ${sb}`);await K.screenshot({path:path.join(PR,`op-checkout-${w}.png`)});
    await AD.setViewportSize({width:w,height:h});await AD.evaluate(()=>ETERNA.go('catalogo'));await AD.waitForTimeout(600);
    const sp=await AD.evaluate(()=>{const e=document.querySelector('#postos-painel');return e?Math.round(e.getBoundingClientRect().right-innerWidth):null;});ok(sp!=null&&sp<=1,`cartão Postos em ${w}px dentro da tela: ${sp}`);
    await AD.evaluate(()=>document.querySelector('#postos-painel').scrollIntoView());await AD.screenshot({path:path.join(PR,`op-postos-${w}.png`)});}
  await K.setViewportSize({width:1280,height:900});
  // 12. endereço com certificado: https://posto.eterna.photo num proxy local (Host repassado, X-Forwarded-Proto: https)
  {const crt=path.join(IMG,'c.pem'),key=path.join(IMG,'k.pem');execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',crt,'-days','1','-subj','/CN=posto.eterna.photo'],{stdio:'ignore'});
    const px=path.join(IMG,'proxy.py');fs.writeFileSync(px,`
import http.client,ssl,sys
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
AG=int(sys.argv[1])
class P(BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def log_message(self,*a): pass
    def go(self):
        n=int(self.headers.get('Content-Length') or 0);b=self.rfile.read(n) if n else None
        h={k:v for k,v in self.headers.items() if k.lower() not in ('connection','keep-alive','transfer-encoding','x-forwarded-proto')};h['X-Forwarded-Proto']='https'
        c=http.client.HTTPConnection('127.0.0.1',AG,timeout=60);c.request(self.command,self.path,body=b,headers=h);r=c.getresponse();d=r.read();c.close()
        self.send_response(r.status)
        for k,v in r.getheaders():
            if k.lower() not in ('content-length','connection','transfer-encoding','keep-alive'): self.send_header(k,v)
        self.send_header('Content-Length',str(len(d)));self.end_headers();self.wfile.write(d)
    do_GET=do_POST=do_HEAD=do_OPTIONS=go
s=ThreadingHTTPServer(('127.0.0.1',int(sys.argv[2])),P);x=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);x.load_cert_chain(sys.argv[3],sys.argv[4]);s.socket=x.wrap_socket(s.socket,server_side=True);s.serve_forever()
`);proxy=spawn('python3',[px,String(PORTA),String(TLSP),crt,key],{stdio:'ignore'});await sleep(800);
    b2=await chromium.launch({env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/_proxy$/i.test(k))),args:['--no-proxy-server','--host-resolver-rules=MAP posto.eterna.photo:443 127.0.0.1:'+TLSP]});const H='https://posto.eterna.photo';
    const cH=await b2.newContext({ignoreHTTPSErrors:true,locale:'pt-BR',viewport:{width:1280,height:900}});const HA=vigia(await cH.newPage(),'https-admin');await HA.goto(H+'/index.html');await HA.waitForTimeout(800);
    ok(await espera(HA,o=>ETERNA.state.agent.url===o,10000,H),'endereço sem porta: o app acha o agente pela própria origem: '+await HA.evaluate(()=>ETERNA.state.agent.url));
    ok(await entrar(HA,'admin.teste',SENHA),'admin entra por https://posto.eterna.photo');ok(await espera(HA,()=>ETERNA.state.agent.on,15000),'agente conectado pelo endereço com certificado');
    const ckH=(await cH.cookies()).find(c=>c.name==='eterna_sessao');ok(ckH&&ckH.secure&&ckH.httpOnly,'cookie de sessão com Secure em https: '+J(ckH&&{sec:ckH.secure,h:ckH.httpOnly}));
    await HA.evaluate(()=>ETERNA.go('catalogo'));ok(await espera(HA,()=>!!document.querySelector('#posto-nome')&&Array.isArray(ETERNA.state.posto.lista),15000),'Postos deste ponto pelo endereço com certificado');await HA.waitForTimeout(300);
    await HA.fill('#posto-nome','Checkout HTTPS');await HA.click('[data-act="posto-parear"]');ok(await espera(HA,()=>!ETERNA.state.user&&ETERNA.state.posto.estado==='ok',10000),'pareado por https e a conta saiu');
    const ckPH=(await cH.cookies()).find(c=>c.name==='eterna_posto');ok(ckPH&&ckPH.secure&&ckPH.httpOnly&&ckPH.sameSite==='Strict','cookie do posto com Secure em https: '+J(ckPH&&{sec:ckPH.secure}));
    const HK=vigia(await cH.newPage(),'https-checkout');await HK.goto(H+'/#loja');
    ok(await espera(HK,()=>ETERNA.state.agent.on&&ETERNA.state.posto.estado==='ok'&&!!document.querySelector('[data-act="kiosk-emerg"]'),15000),'Checkout pareado por https abre');
    const cY=await HK.evaluate(()=>{const L=Object.entries(ETERNA.SIM.sessions).filter(([c,s])=>/^LP/.test(c)&&s.status!=='paga'&&s.status!=='aguardando');return L.length?L[0][0]:null;});
    const temY=await espera(HK,()=>Object.entries(ETERNA.SIM.sessions).some(([c,s])=>/^LP/.test(c)&&s.status!=='paga'&&s.status!=='aguardando'),20000);ok(temY,'Checkout https recebe sessões');
    const cY2=cY||await HK.evaluate(()=>Object.entries(ETERNA.SIM.sessions).find(([c,s])=>/^LP/.test(c)&&s.status!=='paga'&&s.status!=='aguardando')[0]);
    await HK.evaluate(()=>{ETERNA.state.cam.busy=true;});await HK.click('[data-act="kiosk-emerg"]');await HK.fill('#kcode',cY2);await HK.click('[data-act="kiosk-go"]');await HK.waitForTimeout(300);
    await HK.click('[data-act="kiosk-tog"][data-i="0"]').catch(async()=>{await HK.click('[data-act="kiosk-ok"]');});await HK.evaluate(()=>document.querySelector('[data-act="loja-cart"]:not([disabled])').click());
    await HK.click('[data-act="loja-paym"][data-m="pix"]');await HK.click('[data-act="loja-checkout"]');ok(await espera(HK,()=>ETERNA.state.kiosk.step==='done',5000),'venda pelo Checkout https');
    const pY=await HK.evaluate(c=>ETERNA.SIM.caixaDin.find(r=>r.card===c&&r.estado==='aguardando'),cY2);ok(await espera(HK,()=>ETERNA.pvFila().length===0,15000),'venda https sobe ao servidor');
    const posY=JSON.parse(sql('vendas.db',`select count(*) from evento where venda='${pY&&pY.id}'`))[0][0];ok(posY===1,'evento da venda https gravado: '+posY);
    const img=await HK.evaluate(async()=>{const id=Object.keys(ETERNA.UP).find(k=>/^ag_/.test(k));if(!id)return null;const r=await fetch(ETERNA.UP[id].src.replace('/thumb/','/file/'),{credentials:'same-origin'});return {u:ETERNA.UP[id].src.slice(0,30),s:r.status};});
    ok(img&&img.s===200&&/^https:\/\/posto\.eterna\.photo/.test(img.u),'fotos do Checkout https vêm da própria origem: '+J(img));
    await HK.screenshot({path:path.join(PR,'op-https-checkout.png')});
    // Caixa que acabou de entrar confirma na hora (antes de a aba carregar as sessões): a galeria da venda precisa ser publicada
    const HC=vigia(await cH.newPage(),'https-caixa');await HC.goto(H+'/index.html');await HC.waitForTimeout(300);ok(await entrar(HC,'venda.teste',SENHA+'v'),'vendedor entra por https');
    ok(await espera(HC,id=>!!document.querySelector(`[data-act="pend-pos"][data-id="${id}"]`),10000,pY.id),'pendência da venda https no Caixa');
    const carregada=await HC.evaluate(c=>{const x=ETERNA.demoSessions().find(s=>s.card===c);return x?x.photos.length:0;},cY2);
    await HC.click(`[data-act="pend-pos"][data-id="${pY.id}"]`);await HC.click(`[data-act="pend-pos-ok"][data-id="${pY.id}"]`);
    ok(await espera(HC,c=>ETERNA.SIM.sessions[c].status==='paga',5000,cY2),'venda https paga');
    const tokY=await HC.evaluate(c=>ETERNA.SIM.sessions[c].galVenda||ETERNA.galDaSessao(c),cY2);let gY=null;for(let i=0;i<60;i++){gY=await req(PORTA,'GET','/g/'+tokY+'/info');if(gY.s===200)break;await sleep(500);}
    ok(gY.s===200,'galeria publicada mesmo com o Caixa confirmando logo depois de entrar (fotos da sessão na aba no clique: '+carregada+'): '+gY.s+' · '+J(await HC.evaluate(t=>({fotos:(ETERNA.SIM.galerias[t]||{}).fotos,fila:(ETERNA.SIM.galFila||[]).find(x=>x.token===t)}),tokY)));
    // outro endereço (eterna.photo pública) não fala com o agente
    const st=await req(PORTA,'GET','/sessoes?desde=0',{headers:{Host:'posto.eterna.photo',Cookie:'eterna_posto='+ckPH.value,Origin:'https://eterna.photo'}});ok(st.s===403,'Origin de outro site com o cookie do posto: 403: '+st.s);
    const st2=await req(PORTA,'GET','/sessoes?desde=0',{headers:{Host:'outro.exemplo',Cookie:'eterna_posto='+ckPH.value}});ok(st2.s===403,'Host desconhecido: 403: '+st2.s);}
  for(const l of ['en','es','fr','de','pt']){await K.evaluate(l=>{ETERNA.state.lang=l;ETERNA.render();},l);const t=await K.evaluate(()=>document.body.innerText);ok(!/undefined/.test(t)&&t.length>20,'Checkout pareado em '+l);}
}catch(e){for(const c of ctxs)for(const pg of c.pages())await pg.screenshot({path:path.join(PR,'op-erro-'+ctxs.indexOf(c)+'-'+c.pages().indexOf(pg)+'.png')}).catch(()=>{});fails.push('exceção: '+(e.message||e).split('\n').slice(0,2).join(' ')+' @ '+String(e.stack||'').split('\n').find(l=>/operacao-agente/.test(l)));}
try{ag&&ag.kill('SIGKILL');}catch(e){}for(const c of ctxs)await c.close().catch(()=>{});await b.close();if(b2)await b2.close().catch(()=>{});try{proxy&&proxy.kill();}catch(e){}
if(/Traceback/.test(agLog))notas.push('traceback no agente: '+agLog.slice(agLog.indexOf('Traceback'),agLog.indexOf('Traceback')+300).replace(/\s+/g,' '));
try{fs.rmSync(home,{recursive:true,force:true});fs.rmSync(IMG,{recursive:true,force:true});}catch(e){}
const e2=errs.filter(e=>!/Failed to load|ERR_|net::|onnxruntime|40[134]|50[23]/.test(e));const okA=!fails.length&&!e2.length;
console.log(`${okA?'OK':'FALHA'} operacao-agente: entrada real, cadastro, FTP passivo, Upload, pareamento (Painel e link), Checkout pareado (selfie e código), Caixa, impressão, galeria, offline, sessão vencida, recusas, Painel, Estatísticas, Preços, 390/820 px, idiomas${fails.length?' · '+fails.join(' | '):''}${e2.length?' · erros: '+e2.slice(0,4).join(' | '):''}${notas.length?' · notas: '+notas.join(' | '):''}`);process.exit(okA?0:1);})();
