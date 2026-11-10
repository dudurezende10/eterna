// Com o agente de verdade (HOME temporário): pareamento repetido (clique duplo, dois logins do mesmo admin, revogar e parear de
// novo, direto e atrás de um proxy HTTPS local) e código do recibo no Checkout pareado com as fotos ainda carregando.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const RAIZ=path.join(__dirname,'..');const AG=process.env.AG_ARQ||path.join(RAIZ,'agente','eterna-agente.py');const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PR=path.join(__dirname,'prints');fs.mkdirSync(PR,{recursive:true});
const fails=[],errs=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SENHA='mar.sereno.5821.ponte';
function req(porta,method,p,{headers,body}={}){return new Promise(res=>{const d=body?Buffer.from(typeof body==='string'?body:J(body)):null;
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:Object.assign({},d?{'Content-Type':'application/json','Content-Length':d.length}:{},headers||{})},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const t=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(t)}catch(e){}res({s:rs.statusCode,j,t,h:rs.headers});});});
  r.on('error',()=>res({s:0}));if(d)r.write(d);r.end();});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await sleep(100);}return false;};
function vigia(pg,nome){pg.setDefaultTimeout(10000);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;}
const toastTxt=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'').catch(()=>'');
const IMG=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-pc-img-'));
execFileSync('python3',['-c',`
import cv2,sys
R,D=sys.argv[1],sys.argv[2];im=cv2.imread(R+'/sprites/c04.webp')
cells={'a1':(100,480,260,720),'a2':(1080,480,1440,720),'b1':(1440,240,1800,480),'b2':(360,240,720,480)}
for k,(x0,y0,x1,y1) in cells.items():
    cv2.imwrite(D+'/'+k+'.jpg',cv2.resize(im[y0:y1,x0:x1],None,fx=6,fy=6,interpolation=cv2.INTER_CUBIC),[cv2.IMWRITE_JPEG_QUALITY,92])
`,RAIZ,IMG]);
function modelos(home){const d=path.join(home,'Eterna','modelos');fs.mkdirSync(d,{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(d,f));}
const BASE=+(process.env.PORTA_BASE||(28100+Math.floor(Math.random()*40)*20));const PORTA=BASE,FTPP=BASE+1,PASV=`${BASE+2}-${BASE+12}`,TLSP=BASE+15;
const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-pc-'));modelos(home);
if(path.resolve(home)===path.resolve(os.userInfo().homedir))throw new Error('HOME do agente não é temporário');
const ENV={...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(PORTA),ETERNA_FTP_PORTA:String(FTPP),ETERNA_FTP_PASV:PASV,ETERNA_APP_ORIGIN:ORIG,ETERNA_SESSAO_PAUSA:'3',
  ETERNA_ORIGENS:'https://posto.eterna.photo',USER:'eterna-teste-sem-cartao',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};
let ag=null,agLog='';
async function subir(){ag=spawn('python3',[AG],{env:ENV,stdio:['ignore','pipe','pipe']});ag.stdout.on('data',d=>agLog+=d);ag.stderr.on('data',d=>agLog+=d);
  for(let i=0;i<80;i++){await sleep(250);if((await req(PORTA,'GET','/status')).s===200)return;}throw new Error('agente não subiu: '+agLog.slice(-300));}
const sql=(db,q)=>execFileSync('python3',['-c','import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchall();c.commit();print(json.dumps(r))',path.join(home,'Eterna','ponto',db),q]).toString().trim();
const A=`http://127.0.0.1:${PORTA}`;
async function entrar(pg,usuario,senha,nova){await pg.fill('[data-act="login-usuario"]',usuario);await pg.fill('[data-act="login-senha"]',senha);await pg.click('button[type=submit]');
  if(nova){if(!await espera(pg,()=>ETERNA.state.auth.step==='trocar',8000))return false;await pg.fill('[data-act="login-nova"]',nova);await pg.fill('[data-act="login-nova2"]',nova);await pg.click('button[type=submit]');}
  return espera(pg,()=>!!ETERNA.state.user,8000);}
function ftpEnvia(usuario,arquivos){const users=JSON.parse(fs.readFileSync(path.join(home,'Eterna','ftp.json'),'utf8')).users;
  return execFileSync('python3',['-c',`
import ftplib,sys,os
f=ftplib.FTP();f.connect('127.0.0.1',int(sys.argv[1]),timeout=20);f.login(sys.argv[2],sys.argv[3]);f.set_pasv(True);out=[]
for a in sys.argv[4:]:
    with open(a,'rb') as x: out.append(f.storbinary('STOR '+os.path.basename(a),x)[:3])
f.quit();print(','.join(out))`,String(FTPP),usuario,users[usuario],...arquivos.map(a=>path.join(IMG,a+'.jpg'))]).toString().trim();}
// parear pela rota, a partir da página (mesmo cookie do navegador), com Host/Origin da página
const parearPg=(pg,nome)=>pg.evaluate(async n=>{const r=await fetch('/postos/parear',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({nome:n})});return {s:r.status,j:await r.json().catch(()=>null)};},nome);
const euPg=pg=>pg.evaluate(async()=>{const r=await fetch('/postos/eu',{credentials:'same-origin',cache:'no-store'});return {s:r.status,j:await r.json().catch(()=>null)};});
const ckPosto=async ctx=>((await ctx.cookies()).find(c=>c.name==='eterna_posto')||{}).value;

(async()=>{const b=await chromium.launch();let b2=null,proxy=null;const ctxs=[];
const novo=async(o,br)=>{const c=await (br||b).newContext(Object.assign({viewport:{width:1280,height:900},locale:'pt-BR'},o||{}));ctxs.push(c);return c;};
try{
  const cli=execFileSync('python3',[AG,'--criar-admin','admin.teste','Admin de teste'],{env:ENV}).toString();const prov=(cli.match(/troque na primeira entrada: (\S+)/)||[])[1];await subir();
  // ---------- 1. pareamento ----------
  // dois navegadores (contextos) com o mesmo admin, cada um com o seu login, no mesmo IP (127.0.0.1, como atrás de um proxy)
  const c1=await novo();const P1=vigia(await c1.newPage(),'nav1');await P1.goto(A+'/index.html');await P1.waitForTimeout(400);
  ok(await entrar(P1,'admin.teste',prov,SENHA),'admin entra no navegador 1');
  const c2=await novo();const P2=vigia(await c2.newPage(),'nav2');await P2.goto(A+'/index.html');await P2.waitForTimeout(400);
  ok(await entrar(P2,'admin.teste',SENHA),'admin entra no navegador 2');
  // 1a. clique duplo com o mesmo login (dois pedidos simultâneos do mesmo navegador) -> o mesmo posto e o mesmo cookie
  const [d1,d2]=await P1.evaluate(async()=>{const f=()=>fetch('/postos/parear',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({nome:'Caixa Dupla'})}).then(async r=>({s:r.status,j:await r.json()}));return Promise.all([f(),f()]);});
  ok(d1.s===200&&d2.s===200&&d1.j.posto.id===d2.j.posto.id,'clique duplo simultâneo, mesmo login: mesmo posto: '+J([d1,d2]));
  const k1=await ckPosto(c1);
  const d3=await parearPg(P1,'Caixa Dupla');ok(d3.s===200&&d3.j.posto.id===d1.j.posto.id&&await ckPosto(c1)===k1,'terceiro clique em seguida, mesmo login: mesmo posto e cookie: '+J(d3));
  // 1b. outro login do mesmo admin, mesmo nome, < 15 s, mesmo IP -> posto e cookie diferentes
  const e1=await parearPg(P2,'Caixa Dupla');const k2=await ckPosto(c2);
  ok(e1.s===200&&e1.j.posto.id!==d1.j.posto.id&&k2&&k2!==k1,'segundo login do mesmo admin no mesmo IP: posto e cookie diferentes: '+J(e1));
  ok((await euPg(P1)).j.posto.id===d1.j.posto.id&&(await euPg(P2)).j.posto.id===e1.j.posto.id,'cada navegador é o seu posto em /postos/eu');
  ok(JSON.parse(sql('estado.db',"select count(*) from posto where nome='Caixa Dupla'"))[0][0]===2,'2 postos Caixa Dupla no banco: '+sql('estado.db',"select id from posto where nome='Caixa Dupla'"));
  // 1c. parear -> revogar -> parear o mesmo nome < 15 s, com o mesmo login (pela rota) -> posto novo, /postos/eu 200, cookie antigo 401
  const r0=await parearPg(P1,'Caixa R');const kR0=await ckPosto(c1);
  const rv=await P1.evaluate(async id=>(await fetch('/postos/revogar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({id})})).status,r0.j.posto.id);
  ok(rv===200,'revogar: '+rv);
  const r1=await parearPg(P1,'Caixa R');const kR1=await ckPosto(c1);
  ok(r1.s===200&&r1.j.posto.id!==r0.j.posto.id&&kR1!==kR0,'parear de novo depois de revogar (<15 s, mesmo login): posto novo: '+J([r0.j,r1.j]));
  ok((await euPg(P1)).s===200,'/postos/eu com o cookie novo: 200');
  const velho=await req(PORTA,'GET','/postos/eu',{headers:{Host:'127.0.0.1:'+PORTA,Cookie:'eterna_posto='+kR0}});ok(velho.s===401,'cookie antigo (revogado) em /postos/eu: 401: '+velho.s);
  const velhoS=await req(PORTA,'GET','/sessoes?desde=0',{headers:{Host:'127.0.0.1:'+PORTA,Cookie:'eterna_posto='+kR0}});ok(velhoS.s===401,'cookie antigo (revogado) em /sessoes: 401: '+velhoS.s);
  // revogado pelo outro navegador (outro login) e pareado de novo pelo primeiro em seguida
  const r2=await parearPg(P1,'Caixa R');ok(r2.j.posto.id===r1.j.posto.id,'clique repetido depois do novo pareamento: o mesmo posto novo');
  await P2.evaluate(async id=>fetch('/postos/revogar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({id})}),r1.j.posto.id);
  const r3=await parearPg(P1,'Caixa R');ok(r3.s===200&&r3.j.posto.id!==r1.j.posto.id&&(await euPg(P1)).s===200,'revogado por outro navegador e pareado de novo: posto novo: '+J(r3.j));
  // 1d. pela tela: clique duplo no botão -> 1 posto; a conta sai; revogar pelo outro navegador e parear de novo (entra de novo) -> posto novo
  const c3=await novo();const P3=vigia(await c3.newPage(),'nav3');await P3.goto(A+'/index.html');await P3.waitForTimeout(400);ok(await entrar(P3,'admin.teste',SENHA),'admin entra no navegador 3');
  await P3.evaluate(()=>ETERNA.go('catalogo'));ok(await espera(P3,()=>!!document.querySelector('#posto-nome')&&Array.isArray(ETERNA.state.posto.lista),15000),'cartão Postos (nav3)');await P3.waitForTimeout(300);
  await P3.fill('#posto-nome','Checkout T');const antesT=JSON.parse(sql('estado.db',"select count(*) from posto where nome='Checkout T'"))[0][0];
  await P3.evaluate(()=>{const b=document.querySelector('[data-act="posto-parear"]');b.click();b.click();b.click();});
  ok(await espera(P3,()=>!ETERNA.state.user&&ETERNA.state.posto.estado==='ok',10000),'pela tela: pareado e a conta saiu');
  const nT=JSON.parse(sql('estado.db',"select count(*) from posto where nome='Checkout T'"))[0][0];ok(antesT===0&&nT===1,'clique triplo pela tela: 1 posto: '+nT);
  const t0id=await P3.evaluate(()=>ETERNA.state.posto.disp.id);const kT0=await ckPosto(c3);
  await P2.evaluate(async id=>fetch('/postos/revogar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({id})}),t0id);
  await P3.reload();await P3.waitForTimeout(800);
  ok(await entrar(P3,'admin.teste',SENHA),'nav3 entra de novo depois da revogação');await P3.evaluate(()=>ETERNA.go('catalogo'));
  ok(await espera(P3,()=>!!document.querySelector('#posto-nome'),15000),'cartão Postos (nav3, de novo)');await P3.fill('#posto-nome','Checkout T');await P3.click('[data-act="posto-parear"]');
  ok(await espera(P3,()=>!ETERNA.state.user&&ETERNA.state.posto.estado==='ok',10000),'pareado de novo pela tela');
  ok(await P3.evaluate(()=>ETERNA.state.posto.disp.id)!==t0id&&await ckPosto(c3)!==kT0,'pela tela, depois de revogar: posto novo');
  ok((await req(PORTA,'GET','/postos/eu',{headers:{Host:'127.0.0.1:'+PORTA,Cookie:'eterna_posto='+kT0}})).s===401,'cookie revogado da tela: 401');

  // 1e. atrás de um proxy HTTPS local (Host e X-Forwarded-Proto repassados; todos os clientes chegam do mesmo IP)
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
    const hx=[];for(let i=0;i<2;i++){const c=await novo({ignoreHTTPSErrors:true},b2);const p=vigia(await c.newPage(),'https'+i);await p.goto(H+'/index.html');await p.waitForTimeout(800);ok(await entrar(p,'admin.teste',SENHA),'https: admin entra no navegador '+i);hx.push([c,p]);}
    const [h1,h2]=await Promise.all(hx.map(([c,p])=>parearPg(p,'Tablet Proxy')));
    const hk1=await ckPosto(hx[0][0]),hk2=await ckPosto(hx[1][0]);
    ok(h1.s===200&&h2.s===200&&h1.j.posto.id!==h2.j.posto.id&&hk1!==hk2,'proxy: dois logins ao mesmo tempo, mesmo nome: postos e cookies diferentes: '+J([h1.j,h2.j]));
    const sec=(await hx[0][0].cookies()).find(c=>c.name==='eterna_posto');ok(sec&&sec.secure&&sec.httpOnly,'proxy: cookie do posto Secure/HttpOnly');
    const [h3,h4]=await hx[0][1].evaluate(async()=>{const f=()=>fetch('/postos/parear',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({nome:'Tablet Proxy'})}).then(async r=>({s:r.status,j:await r.json()}));return Promise.all([f(),f()]);});
    ok(h3.j.posto.id===h1.j.posto.id&&h4.j.posto.id===h1.j.posto.id,'proxy: clique duplo com o mesmo login: o mesmo posto: '+J([h3.j,h4.j]));
    await hx[0][1].evaluate(async id=>fetch('/postos/revogar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({id})}),h1.j.posto.id);
    const h5=await parearPg(hx[0][1],'Tablet Proxy');ok(h5.s===200&&h5.j.posto.id!==h1.j.posto.id&&(await euPg(hx[0][1])).s===200,'proxy: revogar e parear de novo < 15 s: posto novo e /postos/eu 200: '+J(h5.j));
    const old=await req(PORTA,'GET','/postos/eu',{headers:{Host:'posto.eterna.photo','X-Forwarded-Proto':'https',Cookie:'eterna_posto='+hk1}});ok(old.s===401,'proxy: cookie revogado 401: '+old.s);
    ok((await euPg(hx[1][1])).j.posto.id===h2.j.posto.id,'proxy: o posto do outro navegador continua');}

  // ---------- 2. código no Checkout pareado ----------
  const f1=ftpEnvia('carlos',['a1','a2']);const f2=ftpEnvia('marinara',['b1']);ok(f1==='226,226'&&f2==='226','FTP: '+f1+' '+f2);
  // espera as sessões fecharem no servidor
  let sess=[];for(let i=0;i<120;i++){const r=await req(PORTA,'GET','/sessoes?desde=0',{headers:{Host:'127.0.0.1:'+PORTA,Cookie:'eterna_posto='+await ckPosto(c3)}});sess=((r.j||{}).sessoes||[]).filter(x=>x.status==='fechada');if(sess.length>=2)break;await sleep(500);}
  ok(sess.length>=2,'2 sessões fechadas no servidor: '+sess.length);
  const LA=(sess.find(x=>x.fotos.length===2)||sess[0]).card,LB=(sess.find(x=>x.card!==LA)||{}).card;
  // Checkout pareado (nav3): primeira carga com /sessoes e /biblioteca lentos (rede ruim): a aba ainda não conhece as fotos
  const cK=c3;const K=vigia(await cK.newPage(),'checkout');
  const atraso={ms:0};await K.route(/\/(sessoes|biblioteca)(\?|$)/,async r=>{if(atraso.ms)await sleep(atraso.ms);r.continue();});
  await K.goto(A+'/#loja');
  ok(await espera(K,()=>ETERNA.state.agent.on&&ETERNA.state.posto.estado==='ok'&&!!document.querySelector('[data-act="kiosk-emerg"]'),15000),'Checkout pareado abre');
  ok(await espera(K,(c)=>!!ETERNA.SIM.sessions[c]&&(ETERNA.SIM.sessions[c].photos||[]).length>0,20000,LA),'Checkout materializa a sessão '+LA);
  await K.evaluate(()=>{ETERNA.state.cam.busy=true;});
  // 2a. recarrega com /sessoes e /biblioteca demorando 2,5 s: a sessão está no SIM (localStorage) mas sem foto carregada
  atraso.ms=2500;await K.reload();await K.waitForTimeout(300);
  await espera(K,()=>!!ETERNA.state.agent.sessoes,8000);
  await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();});
  await K.click('[data-act="kiosk-emerg"]');await K.fill('#kcode',LA.toLowerCase());
  const sobj=await K.evaluate(c=>{const L=ETERNA.demoSessions();return !!L.find(s=>s.card===c);},LA);
  const tA=Date.now();await K.click('[data-act="kiosk-go"]');await sleep(150);
  const btA=await K.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-go"]');return e&&{dis:e.disabled,t:e.textContent.trim(),cod:document.querySelector('#kcode').value};});
  if(sobj)notas.push('2a: a sessão já tinha foto carregada no clique (cenário de espera não exercitado nesta rodada)');
  else ok(btA&&btA.dis&&btA.t==='Buscando suas fotos…'&&btA.cod.toUpperCase()===LA,'2a: botão desativado com "Buscando suas fotos…": '+J(btA));
  await K.screenshot({path:path.join(PR,'seg-codigo-buscando-1280.png')});
  ok(await espera(K,c=>ETERNA.state.kiosk.step==='review'&&ETERNA.state.kiosk.code===c,6000,LA),'2a: sessão abre quando as fotos chegam: '+await K.evaluate(()=>ETERNA.state.kiosk.step)+' '+await toastTxt(K));
  const dA=Date.now()-tA;ok(dA<=4800,'2a: abriu em até ~4 s: '+dA+' ms');ok(!/não encontrado/i.test(await toastTxt(K)),'2a: sem "não encontrado"');
  ok(await K.evaluate(()=>ETERNA.LJ_COD.erros)===0,'2a: nenhuma tentativa errada contada');
  await K.screenshot({path:path.join(PR,'seg-codigo-aberto-1280.png')});
  // 2b. nas 5 línguas: o botão de espera com o texto da língua (sessão recarregada de novo, com atraso)
  for(const [l,tx] of [['en','Finding your photos…'],['es','Buscando tus fotos…'],['fr','Recherche de vos photos…'],['de','Deine Fotos werden gesucht…']]){
    await K.reload();await K.waitForTimeout(300);await espera(K,()=>!!ETERNA.state.agent.sessoes,8000);
    await K.evaluate(l=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.state.lang=l;ETERNA.state.kiosk.step='emerg';ETERNA.render();},l);await K.fill('#kcode',LA);
    const tem=await K.evaluate(c=>!!ETERNA.demoSessions().find(s=>s.card===c),LA);await K.click('[data-act="kiosk-go"]');await sleep(120);
    const bt=await K.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-go"]');return e&&{dis:e.disabled,t:e.textContent.trim()};});
    if(!tem)ok(bt&&bt.dis&&bt.t===tx,'2b '+l+': '+J(bt));else notas.push('2b '+l+': fotos já carregadas');
    if(l==='de'){await K.setViewportSize({width:390,height:844});await K.screenshot({path:path.join(PR,'seg-codigo-buscando-de-390.png')});const sb=await K.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok(sb<=1,'390 px sem rolagem lateral no botão de espera (de): '+sb);await K.setViewportSize({width:1280,height:900});}
    ok(await espera(K,c=>ETERNA.state.kiosk.step==='review',6000,LA),'2b '+l+': abre depois');}
  await K.evaluate(()=>{ETERNA.state.lang='pt';});
  // 2c. código desconhecido: aviso na hora
  atraso.ms=0;await K.reload();await K.waitForTimeout(300);await espera(K,c=>!!ETERNA.demoSessions().find(s=>s.card===c),10000,LA);
  const naHora=async(c,msg)=>{await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();const t=document.querySelector('#toast');if(t)t.textContent='';});
    await K.fill('#kcode',c);const t0=Date.now();await K.click('[data-act="kiosk-go"]');const foi=await espera(K,()=>/não encontrado/i.test((document.querySelector('#toast')||{}).textContent||''),5000);const dt=Date.now()-t0;
    ok(foi&&dt<1200&&await K.evaluate(()=>!ETERNA.state.kiosk.codEsp&&ETERNA.state.kiosk.step==='emerg'),msg+': '+dt+' ms · '+await toastTxt(K));return dt;};
  await naHora('LPZZZZZ99','2c: código desconhecido avisa na hora');
  await naHora('ABCD-EFGH','2c: código de galeria desconhecido avisa na hora');
  // 2d. sessão com todas as fotos descartadas (pela Qualidade) avisa na hora
  await K.evaluate(c=>{const s=ETERNA.SIM.sessions[c];(s.photos||[]).forEach(p=>{ETERNA.SIM.discarded[p.id]=true;});},LB);
  await naHora(LB,'2d: sessão com todas as fotos descartadas avisa na hora');
  // 2f. trava de 5 erros continua
  await K.evaluate(()=>{ETERNA.lojaCodReset();ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});
  for(let i=0;i<5;i++){await K.fill('#kcode','LPNADA00'+i);await K.click('[data-act="kiosk-go"]');await sleep(150);}
  ok(/aguarde|espere|minuto|wait/i.test(await toastTxt(K))&&await K.evaluate(()=>ETERNA.LJ_COD.ate>Date.now()),'2f: 5 erros travam: '+await toastTxt(K));
  await K.fill('#kcode',LA);await K.click('[data-act="kiosk-go"]');await sleep(200);
  ok(await K.evaluate(()=>ETERNA.state.kiosk.step==='emerg'),'2f: travado, nem o código certo abre');
  // persiste ao recarregar (sessionStorage)
  await K.reload();await K.waitForTimeout(500);ok(await K.evaluate(()=>ETERNA.LJ_COD.ate>Date.now()),'2f: trava continua depois de recarregar');
  await K.evaluate(()=>ETERNA.lojaCodReset());
  // 2g. voltar ao início no meio da espera: a sessão do anterior não abre
  atraso.ms=3000;
  // restaura o dia da sessão LA e as fotos de LB
  await K.evaluate(([a,b])=>{delete ETERNA.SIM.sessions[a].closedAt;(ETERNA.SIM.sessions[b].photos||[]).forEach(p=>{delete ETERNA.SIM.discarded[p.id];});ETERNA.saveSim&&ETERNA.saveSim();},[LA,LB]).catch(()=>{});
  await K.evaluate(([a,b])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));delete S.sessions[a].closedAt;(S.sessions[b].photos||[]).forEach(p=>{delete S.discarded[p.id];});localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},[LA,LB]);
  await K.reload();await K.waitForTimeout(300);await espera(K,()=>!!ETERNA.state.agent.sessoes,8000);
  await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await K.fill('#kcode',LA);
  const temG=await K.evaluate(c=>!!ETERNA.demoSessions().find(s=>s.card===c),LA);await K.click('[data-act="kiosk-go"]');await sleep(300);
  const espG=await K.evaluate(()=>ETERNA.state.kiosk.codEsp);
  await K.click('[data-act="kiosk-back"]');await sleep(100);
  await K.click('[data-act="kiosk-emerg"]').catch(()=>{});
  await sleep(5000);
  if(temG||!espG)notas.push('2g: a espera não começou (fotos já carregadas: '+temG+')');
  ok(await K.evaluate(()=>ETERNA.state.kiosk.step!=='review'&&!ETERNA.state.kiosk.code),'2g: voltar ao início no meio da espera não abre a sessão do anterior: '+await K.evaluate(()=>ETERNA.state.kiosk.step+' '+ETERNA.state.kiosk.code));
  const btG=await K.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-go"]');return e&&{dis:e.disabled,t:e.textContent.trim(),v:document.querySelector('#kcode').value};});
  ok(!btG||(!btG.dis&&!btG.v),'2g: o campo do próximo cliente vem limpo e com o botão ativo: '+J(btG));
  // 2h. outro dia + fotos não carregadas: aviso na hora (sem esperar 4 s)
  await K.evaluate(c=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));S.sessions[c].closedAt=new Date(Date.now()-3*86400e3).toISOString();localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},LA);
  await K.reload();await K.waitForTimeout(300);await espera(K,()=>!!ETERNA.state.agent.sessoes,8000);
  {await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await K.fill('#kcode',LA);const t0=Date.now();await K.click('[data-act="kiosk-go"]');
    const foi=await espera(K,()=>/não encontrado/i.test((document.querySelector('#toast')||{}).textContent||''),6000);const dt=Date.now()-t0;
    ok(foi&&dt<1500,'2h: sessão de outro dia sem foto carregada avisa na hora: '+dt+' ms · '+await toastTxt(K));}
  // 2i. todas descartadas + fotos não carregadas: aviso na hora
  await K.evaluate(c=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));(S.sessions[c].photos||[]).forEach(p=>{S.discarded[p.id]=true;});localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},LB);
  await K.reload();await K.waitForTimeout(300);await espera(K,()=>!!ETERNA.state.agent.sessoes,8000);
  {await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await K.fill('#kcode',LB);const t0=Date.now();await K.click('[data-act="kiosk-go"]');
    const foi=await espera(K,()=>/não encontrado/i.test((document.querySelector('#toast')||{}).textContent||''),6000);const dt=Date.now()-t0;
    ok(foi&&dt<1500,'2i: sessão com todas as fotos descartadas sem foto carregada avisa na hora: '+dt+' ms · '+await toastTxt(K));}
  // 2j. erro durante a espera (agente cai no meio): o botão não trava
  await K.evaluate(([a,b])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));delete S.sessions[a].closedAt;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},[LA,LB]);
  atraso.ms=0;await K.unroute(/\/(sessoes|biblioteca)(\?|$)/);await K.route(/\/(sessoes|biblioteca)(\?|$)/,r=>r.abort('connectionreset'));
  await K.reload();await K.waitForTimeout(800);
  {await K.evaluate(()=>{ETERNA.state.cam.busy=true;ETERNA.lojaCodReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();const t=document.querySelector('#toast');if(t)t.textContent='';});await K.fill('#kcode',LA);
    const tem=await K.evaluate(c=>!!ETERNA.demoSessions().find(s=>s.card===c),LA);const t0=Date.now();await K.click('[data-act="kiosk-go"]');
    const fim=await espera(K,()=>!ETERNA.state.kiosk.codEsp,7000);const dt=Date.now()-t0;
    const bt=await K.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-go"]');return e&&{dis:e.disabled,t:e.textContent.trim()};});
    if(tem)notas.push('2j: fotos já carregadas');
    ok(fim&&dt<=5500&&bt&&!bt.dis,'2j: /sessoes e /biblioteca falhando durante a espera: a espera acaba e o botão volta: '+dt+' ms '+J(bt)+' · '+await toastTxt(K));}
  await K.unroute(/\/(sessoes|biblioteca)(\?|$)/);
  // tablet 820 e celular 390: tela do código
  for(const w of [820,390]){await K.setViewportSize({width:w,height:w===390?844:1180});await K.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await K.screenshot({path:path.join(PR,`seg-codigo-${w}.png`)});
    ok(await K.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'tela do código sem rolagem lateral em '+w);}
}catch(e){fails.push('exceção: '+(e.stack||e.message).slice(0,500));}
try{ag&&ag.kill('SIGKILL');}catch(e){}for(const c of ctxs)await c.close().catch(()=>{});await b.close();if(b2)await b2.close().catch(()=>{});try{proxy&&proxy.kill();}catch(e){}
try{fs.rmSync(home,{recursive:true,force:true});fs.rmSync(IMG,{recursive:true,force:true});}catch(e){}
const e2=errs.filter(e=>!/Failed to fetch|NetworkError|net::/i.test(e));
console.log(`${fails.length||e2.length?'FALHA':'OK'} seg-pareamento-codigo-agente: pareamento repetido (clique duplo, dois logins, revogar e parear, proxy HTTPS) e código do Checkout com fotos carregando${fails.length?' · '+fails.join(' | '):''}${e2.length?' · erros: '+e2.slice(0,4).join(' | '):''}${notas.length?' · notas: '+notas.join(' | '):''}`);process.exit(fails.length||e2.length?1:0);})();
