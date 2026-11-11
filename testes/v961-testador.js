// v96.1 (Testador, 10/11): galeria de VENDA pelo QR com o agente de verdade (HOME temporário, portas 43000-43999, OpenCV ligado),
// pelo app no celular (390 px) servido pelo próprio agente:
//  - QR sem selfie mostra e baixa compradas + cortesias; à venda de ninguém aparece; "Encontrar mais fotos suas" aparece.
//  - selfie sem acerto: conta tentativa (restam 4), "Voltar às suas fotos" volta com as compradas.
//  - selfie com acerto: soma só as à venda da pessoa; a à venda de outra pessoa nunca aparece nem baixa (nem no HTML, nem com link forjado).
//  - teto: 20 selfies sem acerto de 20 IPs (127.0.0.x) e a 21ª de outro IP dá 429, quem bate também; alerta sem o token; livres continua.
//  - escola (evento): fora do teto, livres vazio, app vai direto para o consentimento.
//  - galeria vencida: livres 410 e o app mostra "expirada".
//  - app novo com o agente antigo (main 0596b50, sem /livres): cai no fluxo de selfie, sem erro.
//  - textos novos nas 5 línguas, sem travessão; tablet (820) sem rolagem lateral; cliques repetidos no "Encontrar mais".
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const crypto=require('crypto');const net=require('net');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const PR=path.join(__dirname,'prints');fs.mkdirSync(PR,{recursive:true});
const fails=[],notas=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const portaUsada=p=>new Promise(r=>{const s=net.createServer();s.once('error',()=>r(true));s.listen(p,'127.0.0.1',()=>s.close(()=>r(false)));});
async function porta(){for(;;){const p=43000+Math.floor(Math.random()*1000);if(!(await portaUsada(p)))return p;}}
function req(P,method,p,{body,ip}={}){return new Promise(res=>{const data=body==null?null:Buffer.from(JSON.stringify(body));
  const r=http.request({host:'127.0.0.1',port:P,method,path:p,localAddress:ip,headers:data?{'Content-Type':'application/json','Content-Length':data.length}:{}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch);let j=null;try{j=JSON.parse(b.toString())}catch(e){}res({s:rs.statusCode,b,j});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
const tok=()=>crypto.randomBytes(16).toString('base64url');
const dia=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function manifesto(t,fotos,extra){const cr=new Date();return Object.assign({v:1,token:t,codigo:null,tipo:'sessao',venue:'maracana',nome:null,sessoes:['LPV'],menor:false,criada:cr.toISOString(),expira:new Date(cr.getTime()+60*864e5).toISOString(),precos:{dig:39,todas:250},moeda:'BRL',fotos,envio:{compradas:'pendente',vitrine:'pendente'}},extra||{});}
async function subir(ag,P,home,origem,env){const p=spawn('python3',[ag],{env:{...process.env,HOME:home,ETERNA_PORTA:String(P),ETERNA_APP_ORIGIN:origem,ETERNA_LEITORES:'1',...(env||{})},stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);
  for(let i=0;i<80;i++){await sleep(250);const r=await req(P,'GET','/status');if(r.s===200)return {p,log:()=>log};}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-400));}
function inbox(home,itens){const d=path.join(home,'Eterna','inbox',dia());fs.mkdirSync(d,{recursive:true});for(const [pid,buf] of itens)fs.writeFileSync(path.join(d,pid+'_IMG.jpg'),buf);}
function lisos(n){return execFileSync('python3',['-c',`
import io,base64
from PIL import Image
for i in range(${n}):
    b=io.BytesIO();Image.new('RGB',(1600,1067),(30+i*40,90,160)).save(b,'JPEG',quality=85);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));}
const lerMan=(home,t)=>JSON.parse(fs.readFileSync(path.join(home,'Eterna','galerias',t,'sessao.json'),'utf8'));
async function esperarEnvio(home,t){for(let i=0;i<80;i++){try{const m=lerMan(home,t);if(m.envio&&m.envio.vitrine==='ok'&&m.envio.compradas==='ok')return;}catch(e){}await sleep(250);}}
const durl=b=>'data:image/jpeg;base64,'+b.toString('base64');
const selfie=(P,t,b,ip)=>req(P,'POST','/g/'+t+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:durl(b)},ip});

(async()=>{const procs=[],homes=[];let srv=null;let U=process.env.U;
if(!U){const p=await porta();srv=spawn('python3',['-m','http.server',String(p),'--bind','127.0.0.1'],{cwd:RAIZ,stdio:'ignore'});procs.push(srv);await sleep(800);U=`http://127.0.0.1:${p}/index.html`;}
const ORIG=new URL(U).origin;
const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
  // ---- textos novos: 5 línguas, sem travessão ----
  const html=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');
  for(const k of ['gq_findMore','gq_findMoreD','gq_backMine']){const l=html.split('\n').find(x=>x.trim().startsWith(k+':['));
    let arr=null;try{arr=eval(l.trim().slice(k.length+1).replace(/,\s*$/,''));}catch(e){}
    ok(Array.isArray(arr)&&arr.length===5&&arr.every(s=>typeof s==='string'&&s.trim().length>3),'textos: '+k+' deveria ter 5 línguas: '+(l||'').slice(0,120));
    ok(arr&&arr.every(s=>!/[—–]/.test(s)),'textos: '+k+' com travessão');}
  // ---- rostos de teste (fotos de exemplo do app, uma pessoa por sessão) ----
  const pg0=await b.newPage();await pg0.goto(U);await pg0.waitForTimeout(500);
  const imgs=await pg0.evaluate(async()=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const ss=ETERNA.demoSessions().filter(s=>s.photos.length>=3);const pick=[];const keys=new Set();
    for(const s of ss){if(keys.has(s.key))continue;const id=s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length===1);if(id){pick.push(id);keys.add(s.key);}if(pick.length>=3)break;}
    const big=async(id,esp)=>{const c=await ETERNA.photoCanvas(id);const k=document.createElement('canvas');k.width=c.width*2;k.height=c.height*2;const x=k.getContext('2d');if(esp){x.translate(k.width,0);x.scale(-1,1);}x.drawImage(c,0,0,k.width,k.height);return k.toDataURL('image/jpeg',.88);};
    const out=[];for(const id of pick)out.push(await big(id,false));out.push(await big(pick[0],true));return out;});
  await pg0.close();
  const [fA,fB,fC,fA2]=imgs.map(u=>Buffer.from(u.split(',')[1],'base64'));const [l1,l2]=lisos(2);
  const PID={A:'a0a0a0a0a0a0',B:'b0b0b0b0b0b0',C:'c0c0c0c0c0c0',A2:'a2a2a2a2a2a2',L1:'d1d1d1d1d1d1',L2:'d2d2d2d2d2d2'};
  const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v961-'));homes.push(H);
  fs.mkdirSync(path.join(H,'Eterna','modelos'),{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(H,'Eterna','modelos',f));
  inbox(H,[[PID.A,fA],[PID.B,fB],[PID.C,fC],[PID.A2,fA2],[PID.L1,l1],[PID.L2,l2]]);
  const P=await porta();const A=await subir(AG,P,H,ORIG);procs.push(A.p);
  let lig=false;for(let i=0;i<200;i++){const s=(await req(P,'GET','/status')).j;if(s&&s.rostos&&s.rostos.ligado&&s.rostos.lidas>=6){lig=true;break;}await sleep(500);}
  if(!lig)throw new Error('reconhecimento não ligou: '+A.log().slice(-300));
  const pub=async(t,fotos,extra)=>{const r=await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(t,fotos,extra)}});ok(r.s===200,'publicar '+r.s+' '+(r.b||'').toString().slice(0,120));await esperarEnvio(H,t);};
  const F=(k,d)=>({id:'ag_'+PID[k],sessao:'LPV',direito:d,canal:d==='comprada'?'loja':null,...(d==='cortesia'?{cortesia:{motivo:'teste',por:'t',em:new Date().toISOString()}}:{})});

  // ---- 1. venda: QR sem selfie, no celular ----
  const T=tok();await pub(T,[F('L1','comprada'),F('L2','cortesia'),F('A2','venda'),F('C','venda')]);
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'pt-BR',permissions:['camera'],acceptDownloads:true});
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push('galeria: '+e.message));G.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|404|onnxruntime|net::/.test(m.text()))errs.push('galeria: '+m.text());});
  await G.goto(`http://127.0.0.1:${P}/#g/${T}`);await G.waitForFunction(()=>ETERNA.pub&&!['carregando'].includes(ETERNA.pub.step),null,{timeout:20000});
  await G.waitForTimeout(400);
  const est=()=>G.evaluate(()=>({step:ETERNA.pub.step,modo:ETERNA.pub.modo,acesso:!!ETERNA.pub.acesso,restam:ETERNA.pub.restam,motivo:ETERNA.pub.motivo,
    dl:[...document.querySelectorAll('[data-act="gq-dl"]')].map(x=>x.dataset.pid).sort(),sel:[...document.querySelectorAll('[data-act="gq-sel"]')].map(x=>x.dataset.pid).sort(),
    mais:!!document.querySelector('[data-act="gq-mais"]'),voltar:!!document.querySelector('[data-act="gq-back"][data-to="galeria"]'),html:document.body.innerHTML,txt:document.body.innerText,
    larg:document.documentElement.scrollWidth>window.innerWidth+1}));
  let e=await est();await G.screenshot({path:PR+'/v961-agente-so-qr-390.png',fullPage:true});
  ok(e.modo==='agente'&&e.step==='galeria','1: QR sem selfie deveria abrir direto a galeria no modo agente: '+e.modo+' '+e.step);
  ok(e.dl.join()===['ag_'+PID.L1,'ag_'+PID.L2].sort().join(),'1: QR sem selfie deveria mostrar comprada+cortesia com Baixar: '+e.dl);
  ok(e.sel.length===0&&!e.html.includes(PID.A2)&&!e.html.includes(PID.C),'1: QR sem selfie não pode mostrar nenhuma à venda: '+e.sel);
  ok(e.mais&&/Encontrar mais fotos suas/.test(e.txt),'1: deveria aparecer "Encontrar mais fotos suas"');ok(!e.larg,'1: rolagem lateral em 390');
  {const [d]=await Promise.all([G.waitForEvent('download',{timeout:15000}).catch(()=>null),G.click(`[data-act="gq-dl"][data-pid="ag_${PID.L1}"]`)]);
    let tam=0;if(d){const p=await d.path().catch(()=>null);tam=p?fs.statSync(p).size:0;}ok(d&&tam>1000,'1: baixar a comprada só pelo QR deveria gerar o arquivo: '+(d&&d.suggestedFilename())+' '+tam);}
  // à venda de outra pessoa: nem pela rota livres, nem com link forjado
  {const r=await req(P,'GET','/g/'+T+'/livres');const ps=(r.j&&r.j.galeria.fotos||[]).map(f=>f.pid);ok(!ps.includes('ag_'+PID.C)&&!ps.includes('ag_'+PID.A2),'1: livres trouxe à venda: '+ps);
    const exp=Math.floor(Date.now()/1000)+600;const x=await req(P,'GET',`/g/${T}/foto/ag_${PID.C}?v=original&exp=${exp}&sig=${'0'.repeat(64)}`);ok(x.s===403,'1: original de à venda com sig forjada deveria dar 403: '+x.s);}
  // cliques repetidos no "Encontrar mais" e tablet
  await G.evaluate(()=>{for(let i=0;i<5;i++)document.querySelector('[data-act="gq-mais"]')&&document.querySelector('[data-act="gq-mais"]').click();});await G.waitForTimeout(200);
  e=await est();ok(e.step==='consent'&&e.voltar,'1: Encontrar mais (5 cliques) deveria abrir o consentimento com Voltar: '+e.step);await G.screenshot({path:PR+'/v961-agente-consent-390.png',fullPage:true});
  await G.click('[data-act="gq-back"][data-to="galeria"]');e=await est();ok(e.step==='galeria'&&e.dl.length===2,'1: Voltar do consentimento deveria voltar às compradas');
  // ---- 2. selfie sem acerto (B): conta tentativa e não esconde as compradas ----
  await G.click('[data-act="gq-mais"]');await G.check('[data-act="gq-consent"]');await G.click('#gq-agree');await G.waitForTimeout(300);
  await G.evaluate(u=>ETERNA.pubMatch(u),durl(fB));await G.waitForFunction(()=>ETERNA.pub.step==='nao',null,{timeout:60000}).catch(()=>{});
  e=await est();await G.screenshot({path:PR+'/v961-agente-sem-acerto-390.png',fullPage:true});
  ok(e.step==='nao'&&e.motivo==='nao_encontrado'&&e.restam===4,'2: selfie sem acerto deveria dar nao_encontrado com restam 4: '+J(e));
  ok(e.voltar,'2: selfie sem acerto deveria oferecer Voltar às suas fotos');
  await G.click('[data-act="gq-back"][data-to="galeria"]');e=await est();
  ok(e.step==='galeria'&&e.dl.length===2&&e.sel.length===0,'2: depois da selfie sem acerto as compradas continuam e nada à venda: '+e.dl+' / '+e.sel);
  // ---- 3. selfie com acerto (A): soma A2 (à venda dela), nunca C ----
  await G.click('[data-act="gq-mais"]');await G.check('[data-act="gq-consent"]');await G.click('#gq-agree');await G.waitForTimeout(300);
  await G.evaluate(u=>ETERNA.pubMatch(u),durl(fA));await G.waitForFunction(()=>ETERNA.pub.step!=='selfie'&&ETERNA.pub.step!=='buscando',null,{timeout:60000}).catch(()=>{});
  e=await est();await G.screenshot({path:PR+'/v961-agente-com-acerto-390.png',fullPage:true});
  ok(e.step==='galeria'&&e.acesso,'3: selfie de A deveria abrir a galeria com acesso: '+e.step+' '+e.motivo);
  ok(e.dl.length===2&&e.sel.join()==='ag_'+PID.A2,'3: selfie de A: compradas + só a à venda de A: dl='+e.dl+' sel='+e.sel);
  ok(!e.html.includes(PID.C),'3: à venda de outra pessoa (C) apareceu no HTML');ok(!e.mais,'3: com acesso o "Encontrar mais" deveria sumir');
  // tablet
  await G.setViewportSize({width:820,height:1180});await G.waitForTimeout(200);e=await est();ok(!e.larg,'3: rolagem lateral em 820');await G.screenshot({path:PR+'/v961-agente-com-acerto-820.png',fullPage:true});
  // 5 línguas na galeria (só QR)
  const G2=await ctx.newPage();G2.on('pageerror',x=>errs.push('galeria2: '+x.message));await G2.goto(`http://127.0.0.1:${P}/#g/${T}`);await G2.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='galeria',null,{timeout:20000}).catch(()=>{});
  for(const l of ['pt','en','es','fr','de']){await G2.evaluate(l=>{ETERNA.state.lang=l;ETERNA.render();},l);const t=await G2.evaluate(()=>document.querySelector('.gq-findmore')?document.querySelector('.gq-findmore').innerText:'');
    ok(t.length>10&&!/[—–]/.test(t),'idioma '+l+': bloco Encontrar mais vazio ou com travessão: '+J(t));if(l!=='pt')ok(!/Encontrar mais fotos suas/.test(t),'idioma '+l+': texto em português');
    await G2.screenshot({path:PR+`/v961-agente-so-qr-${l}.png`,fullPage:true});}
  await G2.close();

  // ---- 4. teto: 20 sem acerto de IPs diferentes, 21ª de outro IP 429 ----
  const T2=tok();await pub(T2,[F('L1','comprada'),F('C','venda')]);
  const rs=[];for(let i=0;i<20;i++)rs.push(await selfie(P,T2,fB,'127.0.0.'+(i+2)));
  ok(rs.every(r=>r.s===200&&r.j.motivo==='nao_encontrado'&&r.j.restam===4),'4: 20 selfies sem acerto de IPs diferentes: '+rs.map(r=>r.s+':'+(r.j&&r.j.motivo)).join(','));
  let r=await selfie(P,T2,fB,'127.0.0.40');ok(r.s===429&&r.j.motivo==='bloqueado','4: a 21ª de outro IP deveria dar 429: '+r.s+' '+J(r.j));
  if(r.j&&r.j.ate){const at=new Date(r.j.ate);const am=new Date();am.setHours(24,0,0,0);ok(Math.abs(at-am)<2000,'4: 429 deveria valer até a meia-noite: '+r.j.ate);}
  r=await selfie(P,T2,fC,'127.0.0.41');ok(r.s===429,'4: quem bate também fica parado: '+r.s);
  r=await req(P,'GET','/g/'+T2+'/livres',{ip:'127.0.0.42'});ok(r.s===200&&r.j.galeria.fotos.length===1,'4: livres continua com o teto: '+r.s);
  const al=fs.existsSync(path.join(H,'Eterna','galerias','alertas.jsonl'))?fs.readFileSync(path.join(H,'Eterna','galerias','alertas.jsonl'),'utf8'):'';
  ok((al.match(/galeria_teto_selfie/g)||[]).length===1,'4: deveria haver um alerta: '+al.slice(0,200));ok(!al.includes(T2)&&!al.includes(T2.slice(0,8))&&!A.log().includes(T2.slice(0,8)),'4: alerta/log com o token');
  ok(/ALERTA galeria/.test(A.log()),'4: alerta deveria sair no log do agente');
  r=await selfie(P,T,fA,'127.0.0.43');ok(r.s===200&&r.j.ok,'4: outra galeria não pode ser afetada: '+r.s);
  // app com a galeria parada: mostra o bloqueio e mantém as compradas
  const G3=await ctx.newPage();await G3.setViewportSize({width:390,height:844});await G3.goto(`http://127.0.0.1:${P}/#g/${T2}`);await G3.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='galeria',null,{timeout:20000}).catch(()=>{});
  await G3.click('[data-act="gq-mais"]');await G3.check('[data-act="gq-consent"]');await G3.click('#gq-agree');await G3.waitForTimeout(300);
  await G3.evaluate(u=>ETERNA.pubMatch(u),durl(fC));await G3.waitForFunction(()=>ETERNA.pub.step==='nao',null,{timeout:30000}).catch(()=>{});
  {const x=await G3.evaluate(()=>({m:ETERNA.pub.motivo,t:document.body.innerText,v:!!document.querySelector('[data-act="gq-back"][data-to="galeria"]')}));await G3.screenshot({path:PR+'/v961-agente-teto-390.png',fullPage:true});
    ok(x.m==='bloqueado'&&x.v,'4: app com teto deveria mostrar bloqueado e Voltar às suas fotos: '+J({m:x.m,v:x.v}));notas.push('texto do teto: '+J(x.t.split('\n').filter(Boolean).slice(0,3).join(' / ')));}
  await G3.close();

  // ---- 5. escola: fora do teto, sem livres, app direto no consentimento ----
  const TE=tok();await pub(TE,[F('C','venda'),F('A2','venda')],{tipo:'evento',nome:'Escola',menor:true});
  const re=[];for(let i=0;i<21;i++)re.push(await selfie(P,TE,fB,'127.0.1.'+(i+2)));
  ok(re.every(x=>x.s===200&&x.j.motivo==='nao_encontrado'),'5: escola fora do teto da venda: '+re.slice(-3).map(x=>x.s).join(','));
  r=await req(P,'GET','/g/'+TE+'/livres');ok(r.s===200&&r.j.galeria.fotos.length===0,'5: escola sem livres: '+J(r.j));
  r=await selfie(P,TE,fA,'127.0.1.60');ok(r.s===200&&r.j.ok&&r.j.galeria.fotos.map(f=>f.pid).join()==='ag_'+PID.A2,'5: escola abre só pelo rosto (A2): '+r.s+' '+J(r.j&&(r.j.galeria?r.j.galeria.fotos.map(f=>f.pid):r.j)));
  {const G4=await ctx.newPage();await G4.goto(`http://127.0.0.1:${P}/#g/${TE}`);await G4.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:20000}).catch(()=>{});
    const x=await G4.evaluate(()=>({s:ETERNA.pub.step,v:!!document.querySelector('[data-act="gq-back"][data-to="galeria"]')}));ok(x.s==='consent'&&!x.v,'5: escola deveria abrir no consentimento, sem Voltar: '+J(x));await G4.screenshot({path:PR+'/v961-agente-escola-390.png',fullPage:true});await G4.close();}

  // ---- 6. vencida: 410 ----
  const TV=tok();await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(TV,[F('L1','comprada')],{expira:new Date(Date.now()-1000).toISOString()})}});
  r=await req(P,'GET','/g/'+TV+'/livres');ok(r.s===410,'6: livres de galeria vencida deveria dar 410: '+r.s);
  const TX=tok();await pub(TX,[F('L1','comprada')]);await req(P,'POST','/galerias/encerrar',{body:{token:TX}});r=await req(P,'GET','/g/'+TX+'/livres');ok(r.s===410,'6: livres de galeria encerrada deveria dar 410: '+r.s);
  {const G5=await ctx.newPage();await G5.goto(`http://127.0.0.1:${P}/#g/${TV}`);await G5.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:20000}).catch(()=>{});ok(await G5.evaluate(()=>ETERNA.pub.step)==='expirada','6: app deveria mostrar expirada');await G5.close();}
  // repetir a rota livres 40 vezes do mesmo IP: 429 depois de 30 e nada quebra
  {const xs=[];for(let i=0;i<35;i++)xs.push((await req(P,'GET','/g/'+T+'/livres',{ip:'127.0.2.9'})).s);ok(xs.slice(0,30).every(s=>s===200)&&xs.slice(30).every(s=>s===429),'6: limite da rota livres por IP: '+xs.join(''));}
  A.p.kill('SIGTERM');

  // ---- 7. app novo com o agente antigo (main 0596b50, sem /livres) ----
  let velho=null;try{velho=execFileSync('git',['-C',RAIZ,'show','0596b50:agente/eterna-agente.py']);}catch(x){notas.push('7 pulado: commit 0596b50 indisponível');}
  if(velho){const HV=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v961v-'));homes.push(HV);const agv=path.join(HV,'agente-0596b50.py');fs.writeFileSync(agv,velho);inbox(HV,[[PID.L1,l1],[PID.C,lisos(1)[0]]]);
    const PV=await porta();const V=await subir(agv,PV,HV,ORIG,{ETERNA_SEM_OPENCV:'1'});procs.push(V.p);const TO=tok();
    await req(PV,'POST','/galerias/publicar',{body:{manifesto:manifesto(TO,[F('L1','comprada'),F('C','venda')])}});await esperarEnvio(HV,TO);
    ok((await req(PV,'GET','/g/'+TO+'/livres')).s===404,'7: pré: agente antigo sem a rota livres');
    const G6=await ctx.newPage();G6.on('pageerror',x=>errs.push('velho: '+x.message));await G6.setViewportSize({width:390,height:844});await G6.goto(`http://127.0.0.1:${PV}/#g/${TO}`);
    await G6.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:20000}).catch(()=>{});
    const x=await G6.evaluate(()=>({s:ETERNA.pub.step,m:ETERNA.pub.modo,v:!!document.querySelector('[data-act="gq-back"][data-to="galeria"]')}));
    ok(x.s==='consent'&&x.m==='agente'&&!x.v,'7: app com agente antigo deveria cair no consentimento da selfie: '+J(x));await G6.screenshot({path:PR+'/v961-agente-antigo-390.png',fullPage:true});await G6.close();V.p.kill('SIGTERM');}
  await ctx.close();
}catch(x){fails.push('erro: '+(x&&x.stack||x).toString().slice(0,500));}
finally{await b.close().catch(()=>{});for(const p of procs){try{p.kill('SIGKILL')}catch(x){}}for(const h of homes){try{fs.rmSync(h,{recursive:true,force:true})}catch(x){}}}
const okAll=!fails.length&&!errs.length;
console.log(`${okAll?'OK':'FALHA'} v961-testador: venda pelo QR com o agente de verdade (só QR, selfie sem/com acerto, teto de 20 por IPs, escola, vencida, agente antigo, 5 línguas)${fails.length?' · '+fails.slice(0,8).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);
if(notas.length)console.error('notas: '+notas.join(' · '));
process.exit(okAll?0:1);})();
function J(x){return JSON.stringify(x);}
