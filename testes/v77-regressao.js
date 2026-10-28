// v77, volta de correções: confirma os CORRIGIR 3 e 4 do revisor, os IMPORTANTES de segurança que os outros testes
// não cobrem (6, 9 com a origem padrão do app, 10, e o 2 depois da limpeza diária), o app servido pelo agente
// (galeria pública no modo agente, Lista de vendas com venda de teste, todas as telas e a Loja com agente) e, no modo SIM,
// o Checkout em 3 tamanhos x 5 idiomas, recarregar telas, Lista de vendas/CSV, Catálogo › Checkout e o recibo com QR.
// Sobe agentes em 8796 (sem OpenCV) e 8795 (com OpenCV, se houver), com HOME temporário, e derruba tudo no fim.
const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');const crypto=require('crypto');
const {chromium}=require('playwright');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const fails=[];const notas=[];const errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DBG=process.env.V77_DEBUG;const T0=Date.now();const dbg=s=>{if(DBG)console.error(((Date.now()-T0)/1000).toFixed(1)+'s '+s);};
const ignora=t=>/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404|403|401|400/.test(t);
function req(porta,method,p,{body,headers={}}={}){return new Promise(res=>{const data=body==null?null:(Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)));
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:{...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch);let j=null;try{j=JSON.parse(b.toString())}catch(e){}res({s:rs.statusCode,b,j,h:rs.headers});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
const tok=()=>crypto.randomBytes(16).toString('base64url');
const ALFA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const cod=()=>{const u=crypto.randomBytes(8);let c='';for(let i=0;i<8;i++){c+=ALFA[u[i]%32];if(i===3)c+='-';}return c;};
const dia=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function manifesto(t,fotos,extra){const cr=new Date();return Object.assign({v:1,token:t,codigo:cod(),tipo:'sessao',venue:'maracana',nome:null,sessoes:['LPTESTE01'],menor:false,criada:cr.toISOString(),expira:new Date(cr.getTime()+60*864e5).toISOString(),precos:{dig:39,todas:250},moeda:'BRL',fotos,envio:{compradas:'pendente',vitrine:'pendente'}},extra||{});}
async function subir(porta,env,home){const e={...process.env,HOME:home,ETERNA_PORTA:String(porta),ETERNA_LEITORES:'1',...env};for(const k of Object.keys(e))if(e[k]===undefined)delete e[k];
  const p=spawn('python3',[AG],{env:e,stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);
  for(let i=0;i<60;i++){await sleep(250);const r=await req(porta,'GET','/status');if(r.s===200)return {p,log:()=>log};}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-400));}
function fotosNoInbox(home,itens){const d=path.join(home,'Eterna','inbox',dia());fs.mkdirSync(d,{recursive:true});for(const [pid,buf] of itens)fs.writeFileSync(path.join(d,pid+'_IMG.jpg'),buf);}
function jpegsLisos(n){const out=execFileSync('python3',['-c',`
import io,base64
from PIL import Image
for i in range(${n}):
    b=io.BytesIO();Image.new('RGB',(1600,1067),(30+i*40,90,160)).save(b,'JPEG',quality=85);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n');return out.map(x=>Buffer.from(x,'base64'));}
const lerManifesto=(home,t)=>JSON.parse(fs.readFileSync(path.join(home,'Eterna','galerias',t,'sessao.json'),'utf8'));
async function esperarEnvio(home,t){for(let i=0;i<80;i++){try{const m=lerManifesto(home,t);if(m.envio&&m.envio.vitrine==='ok'&&m.envio.compradas==='ok')return m;}catch(e){}await sleep(250);}return null;}
const threads=pid=>{try{return +(/Threads:\s+(\d+)/.exec(fs.readFileSync('/proc/'+pid+'/status','utf8'))[1]);}catch(e){return -1;}};
async function nova(ctx,nome,vp){const pg=await ctx.newPage();if(vp)await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!ignora(m.text()))errs.push(nome+': '+m.text())});return pg;}
async function login(pg,U){await pg.goto(U);await pg.waitForTimeout(500);if(await pg.evaluate(()=>!!ETERNA.state.user))return;await pg.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.click('button[type=submit]');await pg.waitForTimeout(200);
  const c=(await pg.textContent('.otp')).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(500);}
// chaves de I18N que aparecem cruas no DOM (só as com cara de chave: camelCase ou com _)
const cruas=pg=>pg.evaluate(ks=>{const t=' '+document.body.innerText+' '+[...document.querySelectorAll('[title],[aria-label],[placeholder]')].map(e=>(e.title||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.placeholder||'')).join(' ')+' ';return ks.filter(k=>new RegExp('[^A-Za-z0-9_]'+k+'[^A-Za-z0-9_]').test(t));},KEYS);
const HTML=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');
const I18N=(()=>{const i=HTML.indexOf('const I18N={');const j=HTML.indexOf('\n};\n',i);return Function('PL','return '+HTML.slice(i+'const I18N='.length,j+3).trim().replace(/;$/,''))((n,a,b)=>n===1?a:b);})();
const LI={pt:0,en:1,es:2,fr:3,de:4};const TT=(k,l)=>{const v=I18N[k][LI[l]||0];return typeof v==='function'?v(1):v;};
const KEYS=Object.keys(I18N).filter(k=>/[A-Z_]/.test(k));
const semRolagem=pg=>pg.evaluate(()=>({s:document.documentElement.scrollWidth,i:innerWidth,ok:document.documentElement.scrollWidth<=innerWidth}));

(async()=>{const procs=[];const homes=[];let srv=null;let b=null;
let U=process.env.U;
try{
  if(!U){const P0=8794;srv=spawn('python3',['-m','http.server',String(P0)],{cwd:RAIZ,stdio:'ignore'});procs.push(srv);await sleep(800);U=`http://127.0.0.1:${P0}/index.html`;}
  const ORIG=new URL(U).origin;b=await chromium.launch();

  // =============== A. agente sem OpenCV, origem do app padrão (https://eterna.photo) ===============
  dbg('A');
  const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v77-'));homes.push(H);const P=8796;
  const pids=['a1b2c3d4e5f6','0a1b2c3d4e5f','f6e5d4c3b2a1'];fotosNoInbox(H,pids.map((p,i)=>[p,jpegsLisos(3)[i]]));
  // galeria já encerrada antes de o agente subir (como depois de um "Encerrar" de ontem)
  const TZ=tok();const fz=[{id:'ag_'+pids[2],sessao:'LPZ',direito:'venda',canal:null}];const MZ=manifesto(TZ,fz,{sessoes:['LPZ']});
  fs.mkdirSync(path.join(H,'Eterna','galerias',TZ),{recursive:true});fs.writeFileSync(path.join(H,'Eterna','galerias',TZ,'sessao.json'),JSON.stringify({...MZ,expira:new Date(Date.now()-3600e3).toISOString(),encerrada:true}));
  // galeria vencida pela data (não encerrada), também apagada pela limpeza diária
  const TEX=tok();const MEX=manifesto(TEX,fz,{sessoes:['LPX']});fs.mkdirSync(path.join(H,'Eterna','galerias',TEX),{recursive:true});fs.writeFileSync(path.join(H,'Eterna','galerias',TEX,'sessao.json'),JSON.stringify({...MEX,criada:new Date(Date.now()-61*864e5).toISOString(),expira:new Date(Date.now()-864e5).toISOString()}));
  const A=await subir(P,{ETERNA_SEM_OPENCV:'1',ETERNA_APP_ORIGIN:undefined},H);procs.push(A.p);
  let r=await req(P,'GET','/g/'+TZ+'/info');ok(r.s===410,'S2: galeria encerrada antes de subir deveria dar 410, deu '+r.s);
  // ---- S9: app publicado em https://eterna.photo continua liberado; origem do agente funciona; outra origem 403
  for(let i=0;i<40;i++){r=await req(P,'GET','/biblioteca');if(r.s===200&&JSON.stringify(r.j||{}).includes(pids[0]))break;await sleep(250);}
  const bibl=JSON.stringify(r.j||{});ok(bibl.includes(pids[0]),'pré: biblioteca não listou as fotos do inbox');
  for(const o of ['https://eterna.photo','http://127.0.0.1:'+P,'http://localhost:'+P]){
    r=await req(P,'GET','/biblioteca',{headers:{Origin:o}});ok(r.s===200&&r.h['access-control-allow-origin']===o,'S9: /biblioteca com Origin '+o+' deveria dar 200 com CORS dessa origem, deu '+r.s+' '+r.h['access-control-allow-origin']);
    r=await req(P,'GET','/thumb/'+pids[0],{headers:{Origin:o}});ok(r.s===200&&r.h['access-control-allow-origin']===o,'S9: /thumb com Origin '+o+' deveria dar 200, deu '+r.s);
    r=await req(P,'GET','/file/'+pids[0],{headers:{Origin:o}});ok(r.s===200&&r.h['access-control-allow-origin']===o,'S9: /file com Origin '+o+' deveria dar 200, deu '+r.s);}
  r=await req(P,'OPTIONS','/biblioteca',{headers:{Origin:'https://eterna.photo','Access-Control-Request-Method':'GET','Access-Control-Request-Private-Network':'true'}});ok(r.h['access-control-allow-origin']==='https://eterna.photo'&&r.h['access-control-allow-private-network']==='true','S9: preflight do app publicado deveria liberar a rede privada');
  for(const o of ['https://evil.example','https://eterna.photo.evil.example','null','http://127.0.0.1:'+(P+1)]){
    for(const rota of ['/biblioteca','/thumb/'+pids[0],'/file/'+pids[0]]){r=await req(P,'GET',rota,{headers:{Origin:o}});ok(r.s===403&&!r.h['access-control-allow-origin'],'S9: '+rota+' com Origin '+o+' deveria dar 403, deu '+r.s);}}
  // (c) Host exigido nas rotas de foto (DNS rebinding): Host de outro domínio 403, Host do agente 200
  for(const rota of ['/biblioteca','/thumb/'+pids[0],'/file/'+pids[0]]){
    for(const hst of ['evil.example:'+P,'evil.example','127.0.0.1:'+(P+1)]){r=await req(P,'GET',rota,{headers:{Host:hst}});ok(r.s===403,'(c): '+rota+' com Host '+hst+' deveria dar 403, deu '+r.s);}
    r=await req(P,'GET',rota,{headers:{Host:'evil.example:'+P,Origin:'https://eterna.photo'}});ok(r.s===403,'(c): '+rota+' com Host estranho e Origin do app deveria dar 403, deu '+r.s);
    for(const hst of ['127.0.0.1:'+P,'localhost:'+P]){r=await req(P,'GET',rota,{headers:{Host:hst}});ok(r.s===200,'(c): '+rota+' com Host '+hst+' deveria dar 200, deu '+r.s);}}
  r=await req(P,'POST','/rostos/buscar',{body:{imagens:[]},headers:{Origin:'https://eterna.photo'}});ok(r.s===403,'S9: /rostos/buscar só aceita origem local, com eterna.photo deu '+r.s);
  // ---- S8: Host estranho nas outras rotas locais da galeria
  for(const [m,p_,bd] of [['GET','/galerias/vendas?desde=0'],['GET','/galerias/status'],['POST','/galerias/encerrar',{token:TZ}]]){r=await req(P,m,p_,{body:bd,headers:{Host:'evil.example:'+P}});ok(r.s===403,'S8: '+p_+' com Host de outro domínio deveria dar 403, deu '+r.s);}
  r=await req(P,'GET','/galerias/vendas?desde=0',{headers:{Host:'127.0.0.1:'+P}});ok(r.s===200,'S8: Host local deveria dar 200, deu '+r.s);
  // ---- NOTA 1: sig não-ASCII dá 403 e não vai traceback para a saída
  const TA=tok();const fa=[{id:'ag_'+pids[0],sessao:'LPA',direito:'comprada',canal:'loja'},{id:'ag_'+pids[1],sessao:'LPA',direito:'venda',canal:null}];
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(TA,fa,{sessoes:['LPA']})}});ok(r.s===200,'pré: publicar deveria dar 200, deu '+r.s);
  r=await req(P,'GET',`/g/${TA}/foto/${pids[1]}?v=vitrine&exp=${Math.floor(Date.now()/1000)+600}&sig=${'%C3%A9'.repeat(64)}`);ok(r.s===403,'NOTA 1: sig não-ASCII deveria dar 403, deu '+r.s);
  ok((await req(P,'GET','/status')).s===200,'NOTA 1: o agente parou depois da sig não-ASCII');await sleep(200);ok(!/Traceback/.test(A.log()),'NOTA 1: traceback na saída do agente: '+A.log().slice(-300));
  // ---- S2 depois da limpeza diária: a primeira publicação depois de subir roda a limpeza, que apaga as galerias expiradas/encerradas.
  // Republicar o manifesto antigo da galeria encerrada (outro aparelho, validade original) não pode reabri-la.
  await esperarEnvio(H,TA);await sleep(500);
  const lapide=async(nome,t,M,porta)=>{const apagada=!fs.existsSync(path.join(H,'Eterna','galerias',t));const pb=await req(porta,'POST','/galerias/publicar',{body:{manifesto:M}});
    const pb2=await req(porta,'POST','/galerias/publicar',{body:{manifesto:{...M,expira:new Date(Date.now()+200*864e5).toISOString()}}});const ri=await req(porta,'GET','/g/'+t+'/info');const rc=await req(porta,'GET','/g/codigo/'+M.codigo);
    const ex=fs.existsSync(path.join(H,'Eterna','galerias',t,'sessao.json'))?lerManifesto(H,t):null;
    ok(apagada&&pb.s===410&&pb2.s===410&&ri.s===410&&rc.s===404&&(!ex||ex.encerrada||new Date(ex.expira)<new Date()),'S2/lápide ('+nome+'): depois da limpeza diária, republicar o manifesto antigo: '+JSON.stringify({apagada,publicar:pb.s,publicarValidadeMaior:pb2.s,info:ri.s,codigo:rc.s,reabriu:!!(ex&&!ex.encerrada&&new Date(ex.expira)>new Date())}));};
  await lapide('encerrada',TZ,MZ,P);await lapide('expirada pela data',TEX,MEX,P);
  const lp=JSON.parse(fs.readFileSync(path.join(H,'Eterna','galerias','encerradas.json'),'utf8'));ok(lp[TZ]&&lp[TEX]&&!JSON.stringify(lp).includes('data:image'),'S2/lápide: encerradas.json deveria ter as duas lápides');
  // encerrar hoje uma galeria viva: republicar continua 410 (sem limpeza), código 404
  const TY=tok();const MY=manifesto(TY,fz,{sessoes:['LPY']});await req(P,'POST','/galerias/publicar',{body:{manifesto:MY}});r=await req(P,'POST','/galerias/encerrar',{body:{token:TY}});ok(r.s===200,'S2: encerrar deveria dar 200');
  await req(P,'POST','/galerias/publicar',{body:{manifesto:MY}});ok((await req(P,'GET','/g/'+TY+'/info')).s===410&&(await req(P,'GET','/g/codigo/'+MY.codigo)).s===404,'S2: encerrada hoje reabriu ao republicar (antes da limpeza)');
  // ---- S6: conexão que declara corpo e não manda é encerrada pelo agente (timeout de 20 s); as threads voltam
  dbg('S6');
  {const t0=threads(A.p.pid);const socks=[];const fechou=[];const ini=Date.now();
    for(let i=0;i<30;i++){const s=net.connect(P,'127.0.0.1');s.on('error',()=>{});s.on('data',()=>{});s.on('close',()=>fechou.push(Date.now()-ini));s.write('POST /galerias/publicar HTTP/1.1\r\nHost: 127.0.0.1:'+P+'\r\nContent-Type: application/json\r\nContent-Length: 5000\r\n\r\n{"a":');socks.push(s);}
    await sleep(1500);const t1=threads(A.p.pid);ok((await req(P,'GET','/status')).s===200,'S6: o agente parou de responder com 30 conexões lentas');
    for(let i=0;i<27&&fechou.length<30;i++)await sleep(1000);const t2=threads(A.p.pid);
    ok(fechou.length===30&&Math.max(...fechou)<26000,'S6: conexões lentas deveriam ser encerradas em ~20 s: fechadas '+fechou.length+'/30, a mais lenta em '+(fechou.length?Math.max(...fechou):'-')+' ms');
    ok(t2>0&&t2<=t0+3,'S6: threads deveriam voltar ao normal: antes '+t0+', com as conexões '+t1+', depois '+t2);socks.forEach(s=>s.destroy());}
  A.p.kill('SIGTERM');await sleep(800);
  // reinício do agente (mesmo HOME): a lápide sobrevive; a limpeza da primeira publicação apaga a encerrada de hoje e cria a lápide dela
  dbg('reinicio');
  {const A2=await subir(P,{ETERNA_SEM_OPENCV:'1',ETERNA_APP_ORIGIN:undefined},H);procs.push(A2.p);
    r=await req(P,'GET','/g/'+TZ+'/info');ok(r.s===410,'S2/lápide: depois de reiniciar, info da encerrada deveria dar 410, deu '+r.s);
    r=await req(P,'POST','/galerias/publicar',{body:{manifesto:MZ}});ok(r.s===410,'S2/lápide: depois de reiniciar, publicar a encerrada deveria dar 410, deu '+r.s);
    const TN=tok();r=await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(TN,fa,{sessoes:['LPN']})}});ok(r.s===200,'S2: galeria nova continua publicando (200), deu '+r.s);await esperarEnvio(H,TN);await sleep(500);
    await lapide('encerrada hoje, limpa depois de reiniciar',TY,MY,P);
    r=await req(P,'GET','/g/'+TN+'/info');ok(r.s===200,'S2: galeria nova não pode ser afetada pela lápide, info deu '+r.s);
    A2.p.kill('SIGTERM');}

  // =============== S10: limpeza diária agendada (galeria_loop com relógio simulado) e limpar_rostos apaga > 60 dias ===============
  dbg('S10');
  {const H3=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v77-'));homes.push(H3);
    const py=`
import importlib.util, queue, time, types, json, sys
spec = importlib.util.spec_from_file_location("ag", ${JSON.stringify(AG)}); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
# 1) limpar_rostos de verdade: apaga leitura com mais de 60 dias, mantém a de 59 dias
db = m.rostos_db(); d = lambda n: time.strftime("%Y-%m-%d", time.localtime(time.time() - n * 86400))
for pid, n in (("velha", 61), ("nova", 59)):
    db.execute("insert into foto values (?,?,?,?)", (pid, d(n), 1, 0)); db.execute("insert into rosto values (?,?,?,?)", (pid, d(n), 10, b"x"))
db.commit(); m.limpar_rostos(db)
fica = sorted(r[0] for r in db.execute("select pid from rosto")) + sorted(r[0] for r in db.execute("select pid from foto"))
# 2) galeria_loop: com o agente ligado 3 dias seguidos (relógio simulado), a limpeza roda uma vez por dia
relogio = [time.time()]; chamadas = []; exp = []
class Fim(BaseException): pass
class Fila:
    n = 0
    def get(self, timeout=None):
        Fila.n += 1
        if Fila.n > 3 * 144 + 2: raise Fim()
        relogio[0] += 600; raise queue.Empty()
m.gal_fila = Fila(); m.rostos["ligado"] = True
m.limpar_rostos = lambda *a: chamadas.append(relogio[0])
m.REPO.listar_expiradas = lambda agora: (exp.append(agora), [])[1]
m.time = types.SimpleNamespace(time=lambda: relogio[0], strftime=time.strftime, localtime=time.localtime, gmtime=time.gmtime, sleep=lambda s: None)
try: m.galeria_loop()
except Fim: pass
print(json.dumps({"fica": fica, "limpezas": len(chamadas), "expiradas": len(exp)}))`;
    let o=null;try{o=JSON.parse(execFileSync('python3',['-c',py],{env:{...process.env,HOME:H3,ETERNA_SEM_OPENCV:'1'},timeout:60000}).toString().trim().split('\n').pop());}catch(e){fails.push('S10: harness falhou: '+String(e.stderr||e).slice(0,300));}
    if(o){ok(o.fica.join(',')==='nova,nova','S10: limpar_rostos deveria apagar só a leitura com mais de 60 dias: ficou '+o.fica.join(','));
      ok(o.limpezas>=3&&o.limpezas<=4&&o.expiradas>=3,'S10: em 3 dias ligado a limpeza deveria rodar 3 vezes (uma por dia): rostos '+o.limpezas+', galerias '+o.expiradas);}}

  // =============== B. app servido pelo agente, com OpenCV: galeria no modo agente, R3, R4, S3 ===============
  dbg('B');
  let temCV=true;try{execFileSync('python3',['-c','import cv2, numpy'],{stdio:'ignore'});}catch(e){temCV=false;}
  const H2=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v77-'));homes.push(H2);const P2=8795;const UA=`http://127.0.0.1:${P2}/index.html`;
  let imgs=[];
  if(temCV){fs.mkdirSync(path.join(H2,'Eterna','modelos'),{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(H2,'Eterna','modelos',f));
    const pg=await b.newPage();await pg.goto(U);await pg.waitForTimeout(500);
    imgs=await pg.evaluate(async()=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const ss=ETERNA.demoSessions().filter(s=>s.photos.length>=3);const pick=[];
      const keys=new Set();for(const s of ss){if(keys.has(s.key))continue;const id=s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length===1);if(id){pick.push(id);keys.add(s.key);}if(pick.length>=3)break;}
      const out=[];for(const id of pick){const c=await ETERNA.photoCanvas(id);const k=document.createElement('canvas');k.width=c.width*2;k.height=c.height*2;k.getContext('2d').drawImage(c,0,0,k.width,k.height);out.push(k.toDataURL('image/jpeg',.88).split(',')[1]);}return out;});await pg.close();}
  const bufs=imgs.map(x=>Buffer.from(x,'base64'));const pp=['b1b2b3b4b5b6','c1c2c3c4c5c6','e1e2e3e4e5e6','d1d2d3d4d5d6'];
  fotosNoInbox(H2,bufs.length>=3?pp.slice(0,3).map((p,i)=>[p,bufs[i]]).concat([[pp[3],jpegsLisos(1)[0]]]):pp.map((p,i)=>[p,jpegsLisos(4)[i]]));
  // galeria encerrada no HOME do agente B: a limpeza da primeira publicação cria a lápide; o app tem que tratar o 410
  const TZ2=tok();const MZ2=manifesto(TZ2,[{id:'ag_'+pp[3],sessao:'LPZ2',direito:'venda',canal:null}],{sessoes:['LPZ2']});fs.mkdirSync(path.join(H2,'Eterna','galerias',TZ2),{recursive:true});fs.writeFileSync(path.join(H2,'Eterna','galerias',TZ2,'sessao.json'),JSON.stringify({...MZ2,encerrada:true,expira:new Date(Date.now()-60e3).toISOString()}));
  const B=await subir(P2,{ETERNA_APP_ORIGIN:ORIG,...(temCV?{}:{ETERNA_SEM_OPENCV:'1'})},H2);procs.push(B.p);
  let lig=false;if(temCV){for(let i=0;i<160;i++){const s=(await req(P2,'GET','/status')).j;if(s&&s.rostos&&s.rostos.ligado&&s.rostos.lidas>=4){lig=true;break;}await sleep(500);}}
  const ctxA=await b.newContext({viewport:{width:390,height:844},locale:'pt-BR'});
  await ctxA.addInitScript(()=>{window.__toasts=[];document.addEventListener('DOMContentLoaded',()=>{const t=document.querySelector('#toast');if(t)new MutationObserver(()=>{if(t.textContent)window.__toasts.push(t.textContent);}).observe(t,{childList:true,characterData:true,subtree:true});});});
  const AVISO='Agente do ponto conectado';
  if(!lig){notas.push('B: galeria no modo agente não testada (sem OpenCV ou reconhecimento não ligou)');}
  else{const TB=tok();const fb=[{id:'ag_'+pp[0],sessao:'LPB',direito:'comprada',canal:'loja'},{id:'ag_'+pp[1],sessao:'LPB',direito:'venda',canal:null},{id:'ag_'+pp[3],sessao:'LPB',direito:'venda',canal:null},{id:'ag_'+pp[2],sessao:'LPB',direito:'cortesia',canal:null,cortesia:{motivo:'escola',por:'eduardo@eduardorezende.com',em:new Date().toISOString()}}];
    await req(P2,'POST','/galerias/publicar',{body:{manifesto:manifesto(TB,fb,{sessoes:['LPB']})}});ok(!!(await esperarEnvio(H2,TB)),'pré B: envio da galeria não ficou ok');
    const G=await nova(ctxA,'galeria-agente');const reqs=[];G.on('request',q=>{if(/\/g\//.test(q.url()))reqs.push(q.method()+' '+q.url().replace(/^https?:\/\/[^/]+/,'').replace(/\?.*/,''));});
    await G.goto(UA+'#g/'+TB);await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
    ok(await G.evaluate(()=>ETERNA.pub.modo==='agente'&&ETERNA.pub.step==='consent'),'B: galeria pelo agente deveria abrir o consentimento no modo agente: '+JSON.stringify(await G.evaluate(()=>({m:ETERNA.pub.modo,s:ETERNA.pub.step}))));
    await G.screenshot({path:PR+'/v77-agente-consentimento.png'});
    await G.check('[data-act="gq-consent"]');await G.click('#gq-agree');await G.waitForSelector('#gq-file',{state:'attached'});await G.waitForTimeout(400);
    await G.setInputFiles('#gq-file',{name:'s.jpg',mimeType:'image/jpeg',buffer:bufs[0]});
    await G.waitForFunction(()=>ETERNA.pub&&!['buscando','selfie'].includes(ETERNA.pub.step),null,{timeout:60000}).catch(()=>{});
    const gb=await G.evaluate(()=>({step:ETERNA.pub.step,motivo:ETERNA.pub.motivo,dl:[...document.querySelectorAll('[data-act="gq-dl"]')].map(x=>x.dataset.pid),sel:[...document.querySelectorAll('[data-act="gq-sel"]')].map(x=>x.dataset.pid)}));
    ok(gb.step==='galeria'&&gb.dl.length===2&&gb.sel.length===2,'B: galeria no modo agente: '+JSON.stringify(gb));
    await G.waitForTimeout(600);await G.screenshot({path:PR+'/v77-agente-galeria.png',fullPage:true});
    if(gb.step==='galeria'){
      // ---- CORRIGIR 4a: com mais de 12 min de galeria, Baixar pede links novos antes de baixar
      dbg('R4a');reqs.length=0;await G.evaluate(()=>{ETERNA.pub.galAt=Date.now()-13*60000;});
      let d1=null;try{[d1]=await Promise.all([G.waitForEvent('download',{timeout:8000}),G.click(`[data-act="gq-dl"][data-pid="${gb.dl[0]}"]`)]);}catch(e){}
      const iG=reqs.findIndex(x=>/^POST .*\/galeria$/.test(x)),iF=reqs.findIndex(x=>/^GET .*\/foto\//.test(x));
      ok(d1&&iG>=0&&iF>iG,'R4: com a galeria aberta há 13 min, Baixar deveria pedir /galeria e depois baixar: '+JSON.stringify({download:!!d1,reqs}));
      // ---- CORRIGIR 4b: link vencido (403 no download) pede links novos e tenta de novo uma vez
      dbg('R4b');reqs.length=0;let vez=0;await G.route('**/g/'+TB+'/foto/**',rt=>{if(rt.request().url().includes('v=original')&&vez++===0)return rt.fulfill({status:403,contentType:'application/json',body:'{"error":"link vencido"}'});return rt.continue();});
      let d2=null;try{[d2]=await Promise.all([G.waitForEvent('download',{timeout:8000}),G.click(`[data-act="gq-dl"][data-pid="${gb.dl[0]}"]`)]);}catch(e){}
      ok(d2&&reqs.some(x=>/^POST .*\/galeria$/.test(x))&&vez>=2,'R4: download que falhou (403) deveria renovar os links e baixar na segunda tentativa: '+JSON.stringify({download:!!d2,vez,reqs}));
      if(d2){const fp=await d2.path();ok(fs.statSync(fp).size>10000,'R4: arquivo baixado vazio');}
      await G.unroute('**/g/'+TB+'/foto/**');
      // ---- CORRIGIR 3: pagamento recusado mostra mensagem traduzida, sem o texto cru do servidor
      dbg('R3');await G.waitForFunction(()=>ETERNA.state.agent&&ETERNA.state.agent.on,null,{timeout:15000}).catch(()=>{});await G.waitForTimeout(600);
      {const ts=await G.evaluate(()=>window.__toasts);ok(await G.evaluate(()=>ETERNA.state.agent.on)&&!ts.includes(AVISO),'(a): galeria pública (#g) não pode mostrar "'+AVISO+'": '+JSON.stringify(ts));}await G.waitForFunction(()=>!document.querySelector('#toast').hasAttribute('data-on'),null,{timeout:5000}).catch(()=>{});await G.route('**/g/'+TB+'/pagamento',rt=>rt.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'foto fora do acesso ou não está à venda'})}));
      for(const l of ['pt','en','de']){await G.click(`.lj-langs [data-l="${l}"]`);await G.waitForTimeout(100);
        if(await G.evaluate(()=>ETERNA.pub.step)!=='pagar'){await G.evaluate(()=>{ETERNA.pub.sel={};ETERNA.render();});await G.click(`[data-act="gq-sel"][data-pid="${gb.sel[0]}"]`);await G.click('[data-act="gq-buy"]');await G.click('[data-act="gq-paym"][data-m="pix"]');}
        if(l==='pt')await G.screenshot({path:PR+'/v77-agente-pagar.png'});
        await G.click('[data-act="gq-pay"]');await G.waitForTimeout(400);const t3=await G.evaluate(e=>({toast:document.querySelector('#toast').textContent,esp:e,on:document.querySelector('#toast').hasAttribute('data-on')}),TT('gq_payFail',l));
        ok(t3.on&&t3.toast===t3.esp&&!/fora do acesso/.test(t3.toast),'R3: erro de pagamento em '+l+' deveria mostrar gq_payFail traduzido: '+JSON.stringify(t3));}
      await G.unroute('**/g/'+TB+'/pagamento');await G.click('.lj-langs [data-l="pt"]');
      ok(Array.isArray(I18N.gq_payFail)&&I18N.gq_payFail.length===5&&I18N.gq_payFail.every(x=>x&&!/[—–]/.test(x))&&Array.isArray(I18N.gq_again)&&I18N.gq_again.length===5,'R3: gq_payFail deveria existir nas 5 línguas, sem travessão');
      // ---- S3: pagamento simulado de verdade: aprovado, marcado teste
      dbg('S3');if(await G.evaluate(()=>ETERNA.pub.step)!=='pagar'){await G.evaluate(()=>{ETERNA.pub.sel={};ETERNA.render();});await G.click(`[data-act="gq-sel"][data-pid="${gb.sel[0]}"]`);await G.click('[data-act="gq-buy"]');await G.click('[data-act="gq-paym"][data-m="pix"]');}
      const [pres]=await Promise.all([G.waitForResponse(rs=>/\/pagamento$/.test(rs.url()),{timeout:8000}).catch(()=>null),G.click('[data-act="gq-pay"]')]);const pj=pres?await pres.json().catch(()=>null):null;await G.waitForTimeout(400);
      ok(pj&&pj.ok&&pj.pedido&&pj.pedido.teste===true&&pj.pedido.total===39,'S3: pagamento simulado pelo agente deveria vir aprovado com teste:true e total 39: '+JSON.stringify(pj&&pj.pedido));
      ok(await G.evaluate(p=>ETERNA.pub.step==='galeria'&&!!document.querySelector(`[data-act="gq-dl"][data-pid="${p}"]`),gb.sel[0]),'S3: foto paga deveria ir para Suas fotos');
      // ---- CORRIGIR 4c: acesso vencido (401) volta para a selfie, com aviso próprio (não "esse rosto não aparece")
      dbg('R4c');await G.evaluate(()=>{ETERNA.pub.acesso='forjado-acesso-vencido';ETERNA.pub.galAt=Date.now()-13*60000;});await G.click(`[data-act="gq-dl"][data-pid="${gb.dl[0]}"]`);await G.waitForTimeout(800);
      const r4=await G.evaluate(([again,noMatch])=>({step:ETERNA.pub.step,txt:document.body.innerText,again,noMatch,ph:document.querySelectorAll('.gq-ph').length,acesso:ETERNA.pub.acesso}),[TT('gq_again','pt'),TT('gq_noMatch','pt')]);
      ok(r4.step==='selfie'&&r4.txt.includes(r4.again)&&!r4.txt.includes(r4.noMatch)&&r4.ph===0&&!r4.acesso,'R4: acesso vencido (401) deveria voltar para a selfie com gq_again: '+JSON.stringify({...r4,txt:r4.txt.slice(0,160)}));
      await G.screenshot({path:PR+'/v77-agente-acesso-vencido.png'});
      // pagamento com acesso vencido também volta para a selfie
      await G.setInputFiles('#gq-file',{name:'s.jpg',mimeType:'image/jpeg',buffer:bufs[0]});await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='galeria',null,{timeout:60000}).catch(()=>{});
      if(await G.evaluate(()=>ETERNA.pub.step==='galeria'&&!!document.querySelector('[data-act="gq-sel"]'))){await G.evaluate(()=>{ETERNA.pub.sel={};ETERNA.render();});await G.click('[data-act="gq-sel"]');await G.click('[data-act="gq-buy"]');await G.click('[data-act="gq-paym"][data-m="pix"]');
        await G.evaluate(()=>{ETERNA.pub.acesso='forjado-acesso-vencido';});await G.click('[data-act="gq-pay"]');await G.waitForTimeout(600);ok(await G.evaluate(()=>ETERNA.pub.step==='selfie'),'R4: pagamento com acesso vencido deveria voltar para a selfie');}
      else notas.push('R4: segunda selfie não abriu a galeria; pagamento com 401 não testado');
      // ---- S3 na Lista de vendas (app com agente): venda online de teste, fora da receita
      const AD=await nova(ctxA,'admin-agente',{width:1440,height:900});await login(AD,UA);
      await AD.waitForFunction(()=>(ETERNA.SIM.vendasOnline||[]).some(x=>x.token),null,{timeout:40000}).catch(()=>{});
      const s3=await AD.evaluate(()=>{const v=(ETERNA.SIM.vendasOnline||[]).filter(x=>x.token);ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.state.sales.canal='online';ETERNA.state.view='vendas-lista';ETERNA.render();
        const tiles=[...document.querySelectorAll('.tile')].map(t=>t.innerText.replace(/\s+/g,' '));const rows=[...document.querySelectorAll('#main tbody tr')].map(t=>t.innerText.replace(/\s+/g,' '));return {v,tiles,rows,zero:'Receita R$ 0'};});
      ok(s3.v.length===1&&s3.v[0].teste===true,'S3: venda do agente deveria entrar em SIM.vendasOnline com teste:true: '+JSON.stringify(s3.v));
      ok(s3.rows.length===1&&/teste/.test(s3.rows[0])&&s3.tiles.some(t=>t.toLowerCase()===s3.zero.toLowerCase())&&s3.tiles.some(t=>/^Vendas 0$/i.test(t)),'S3: na Lista de vendas (canal Online) a venda de teste deveria aparecer como teste e ficar fora da receita: '+JSON.stringify(s3));
      await AD.screenshot({path:PR+'/v77-agente-lista-vendas.png'});
      // app: publicar um token com lápide recebe 410 e a fila marca "encerrada" (sem ficar tentando de novo)
      await AD.evaluate(M=>{ETERNA.SIM.galerias[M.token]=M;ETERNA.galPublicar(M.token);},MZ2);
      const f410=await AD.waitForFunction(t=>{const it=(ETERNA.SIM.galFila||[]).find(x=>x.token===t);return it&&it.estado==='encerrada'?it:null;},TZ2,{timeout:30000}).then(h=>h.jsonValue()).catch(()=>null);
      const fe=await AD.evaluate(t=>(ETERNA.SIM.galFila||[]).find(x=>x.token===t),TZ2);ok(f410&&!f410.erro,'App 410: fila deveria marcar a galeria com lápide como encerrada: '+JSON.stringify(fe));
      r=await req(P2,'GET','/g/'+TZ2+'/info');ok(r.s===410,'App 410: a galeria com lápide continua 410 depois do app republicar, deu '+r.s);
      await AD.evaluate(()=>{ETERNA.state.view='galerias';ETERNA.state.gal.tab='envio';ETERNA.render();});await AD.waitForTimeout(200);
      const linhaE=await AD.evaluate(t=>[...document.querySelectorAll('#main tbody tr')].map(x=>x.innerText.replace(/\s+/g,' ')).find(x=>x.includes(t.slice(0,8))),TZ2);ok(linhaE&&/encerrada/i.test(linhaE)&&!/Tentar agora/.test(linhaE),'App 410: aba Envio deveria mostrar "encerrada" sem "Tentar agora": '+linhaE);
      await AD.screenshot({path:PR+'/v77-agente-envio-encerrada.png',fullPage:true});await AD.close();}
    await G.close();}
  // ---- todas as telas e a Loja com o agente ligado (app servido pelo agente)
  dbg('telas com agente');
  {const pg=await nova(ctxA,'telas-agente',{width:1280,height:900});await login(pg,UA);const on=await pg.waitForFunction(()=>ETERNA.state.agent&&ETERNA.state.agent.on,null,{timeout:15000}).then(()=>true).catch(()=>false);ok(on,'com agente: o app servido pelo agente deveria ver o agente ligado');
    const vs=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));const bad=[];
    for(const v of vs){if(v==='quiosque')continue;await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(150);if(/Algo falhou/.test(await pg.textContent('#main')))bad.push(v);}
    ok(!bad.length&&vs.length>=20,'com agente: telas quebradas: '+bad.join(',')+' (de '+vs.length+')');
    {const LJ=await nova(ctxA,'loja-agente-fresca',{width:1280,height:900});await LJ.goto(UA+'#loja');const on2=await LJ.waitForFunction(()=>ETERNA.state.agent&&ETERNA.state.agent.on,null,{timeout:15000}).then(()=>true).catch(()=>false);await LJ.waitForTimeout(600);
      const ts=await LJ.evaluate(()=>window.__toasts);ok(on2&&!ts.includes(AVISO),'(a): #loja não pode mostrar "'+AVISO+'": '+JSON.stringify({on2,ts}));await LJ.close();}
    {const ST=await nova(ctxA,'equipe-agente',{width:1280,height:900});await ST.goto(UA);await ST.waitForFunction(()=>ETERNA.state.agent&&ETERNA.state.agent.on,null,{timeout:15000}).catch(()=>{});await ST.waitForTimeout(600);const ts=await ST.evaluate(()=>window.__toasts);if(!ts.includes(AVISO))notas.push('(a): nas telas da equipe o aviso "'+AVISO+'" também não apareceu ('+JSON.stringify(ts)+')');await ST.close();}
    await pg.goto(UA+'#loja');await pg.waitForTimeout(800);const lj=await pg.evaluate(()=>({rota:ETERNA.state.lojaRota,step:ETERNA.state.kiosk.step}));ok(lj.rota&&lj.step==='code','com agente: #loja deveria abrir a câmera da Loja: '+JSON.stringify(lj));
    const card=await pg.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8&&(ETERNA.SIM.sessions[s.card]||{}).status!=='paga')[0].card);
    await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(800);for(const a of ['kiosk-ok','kiosk-ok','kiosk-no','kiosk-ok'])await pg.click(`[data-act="${a}"]`);
    await pg.click('.lj-next');await pg.waitForTimeout(250);await pg.click('[data-act="loja-paym"][data-m="pix"]');await pg.click('[data-act="loja-checkout"]');await pg.waitForTimeout(600);
    const dn=await pg.evaluate(()=>({step:ETERNA.state.kiosk.step,qr:!!document.querySelector('#lqr canvas,#lqr img'),title:(document.querySelector('#lqr')||{}).title,fila:(ETERNA.SIM.galFila||[]).filter(x=>{const m=ETERNA.SIM.galerias[x.token];return m&&!m.fotos.every(f=>/^ag_/.test(f.id));}).map(x=>x.estado)}));
    ok(dn.step==='done'&&dn.qr&&/^https:\/\/eterna\.photo\/#g\/[A-Za-z0-9_-]{22}$/.test(dn.title||''),'com agente: compra na Loja deveria terminar com o QR da galeria: '+JSON.stringify(dn));
    ok(dn.fila.length&&dn.fila.every(e=>e==='local'),'com agente: sessão de exemplo (sprites) deveria ficar local na fila (D14): '+JSON.stringify(dn.fila));
    await pg.close();}
  await ctxA.close();B.p.kill('SIGTERM');

  // =============== C. modo SIM (servidor estático, sem agente) ===============
  dbg('C');
  const ctx=await b.newContext({locale:'pt-BR'});
  // ---- Checkout (#loja) em 390, 1024 e 1440 px nos 5 idiomas: todas as etapas, bandeiras SVG, sem chave crua, sem rolagem horizontal
  {const L=await nova(ctx,'checkout',{width:390,height:844});await L.goto(U+'#loja');await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
    const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6).map(s=>s.card));let ci=0;
    for(const [n,w,h] of [['cel',390,844],['tab',1024,1366],['desk',1440,900]]){await L.setViewportSize({width:w,height:h});
      for(const l of ['pt','en','es','fr','de']){const card=cards[ci++%cards.length];
        await L.goto(U+'#loja');await L.waitForTimeout(400);await L.click(`.lj-langs [data-l="${l}"]`);await L.waitForTimeout(80);
        const etapa=async nome=>{const sr=await semRolagem(L);const cr=await cruas(L);const fl=await L.evaluate(()=>{const x=document.querySelector('.lj-langs');return x?{svg:x.querySelectorAll('button svg').length,txt:x.innerText.trim(),sel:[...x.querySelectorAll('button')].filter(b=>b.getAttribute('aria-pressed')==='true'||b.classList.contains('on')).map(b=>b.dataset.l)}:null;});
          ok(sr.ok,`Checkout ${w}px ${l} ${nome}: rolagem horizontal `+JSON.stringify(sr));ok(!cr.length,`Checkout ${w}px ${l} ${nome}: chave crua `+cr.join(','));
          if(fl)ok(fl.svg===5&&!fl.txt,`Checkout ${w}px ${l} ${nome}: bandeiras `+JSON.stringify(fl));
          if(l==='pt'||(n==='cel'&&(l==='de'||l==='fr')))await L.screenshot({path:`${PR}/v77-checkout-${n}-${l}-${nome}.png`});};
        await etapa('camera');
        await L.click('[data-act="kiosk-emerg"]');await etapa('codigo');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);
        if(await L.evaluate(()=>ETERNA.state.kiosk.step)!=='review'){fails.push(`Checkout ${w}px ${l}: código ${card} não abriu as fotos`);continue;}
        await L.click('[data-act="kiosk-ok"]');await L.click('[data-act="kiosk-ok"]');await L.click('[data-act="kiosk-no"]');await etapa('fotos');
        await L.click('.lj-next');await L.waitForTimeout(250);await L.click('[data-act="loja-paym"][data-m="pix"]');await etapa('pagamento');
        await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(500);const fim=await L.evaluate(()=>({step:ETERNA.state.kiosk.step,qr:!!document.querySelector('#lqr canvas,#lqr img'),cod:(document.querySelector('.lj-qrcode')||{}).textContent||''}));
        ok(fim.step==='done'&&fim.qr&&/[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/.test(fim.cod),`Checkout ${w}px ${l}: tela final sem QR ou código `+JSON.stringify(fim));await etapa('pronto');
        await L.click('.lj-restart');}}
    await L.close();}
  // ---- recarregar telas da equipe nunca cai na Loja; caixa e recibo com QR; Lista de vendas, CSV e Catálogo
  dbg('reload');
  {const A1=await nova(ctx,'admin',{width:1440,height:900});await login(A1,U);
    const vs=(await A1.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v))).filter(v=>v!=='quiosque').concat(['checkout','caixa','fila']);const caiu=[];
    for(const v of vs){const noMenu=await A1.$(`#nav button[data-v="${v}"]`);if(noMenu){await A1.evaluate(()=>{ETERNA.state.view='perfis';ETERNA.render();});await A1.click(`#nav button[data-v="${v}"]`);}else await A1.evaluate(v=>{localStorage.setItem('eterna.view',v);ETERNA.state.view=v;ETERNA.render();},v);await A1.waitForTimeout(80);await A1.reload();await A1.waitForTimeout(450);const st=await A1.evaluate(()=>({v:ETERNA.state.view,lj:!!ETERNA.state.lojaRota,h:location.hash,user:!!ETERNA.state.user,ok:!/Algo falhou/.test(document.querySelector('#main').textContent)}));
      if(st.lj||st.h==='#loja'||st.v==='quiosque'||!st.user||!st.ok)caiu.push(v+':'+JSON.stringify(st));}
    ok(!caiu.length,'Reload: telas que caíram na Loja, perderam o login ou quebraram: '+caiu.join(' | '));
    // compra na Loja (SIM) para ter recibo: depois Recibo na Lista de vendas abre o Checkout com o QR da galeria
    const L=await nova(ctx,'loja2',{width:1280,height:900});await L.goto(U+'#loja');await L.waitForTimeout(500);const card=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6&&(ETERNA.SIM.sessions[s.card]||{}).status!=='paga')[0].card);
    await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);for(const a of ['kiosk-ok','kiosk-ok','kiosk-ok'])await L.click(`[data-act="${a}"]`);await L.click('.lj-next');await L.waitForTimeout(250);await L.click('[data-act="loja-paym"][data-m="pix"]');await L.click('[data-act="loja-checkout"]');await L.waitForTimeout(500);
    const tokL=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.token);await L.close();
    await A1.reload();await A1.waitForTimeout(400);await A1.evaluate(()=>{ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.state.sales.canal='all';ETERNA.state.view='vendas-lista';ETERNA.render();});
    await A1.click(`[data-act="sales-receipt"][data-card="${card}"]`);await A1.waitForTimeout(500);
    const rc=await A1.evaluate(()=>{const q=document.querySelector('#qrbox');return {v:ETERNA.state.view,qr:!!(q&&q.querySelector('canvas,img')),title:q&&q.title,txt:(document.querySelector('.receipt')||{}).textContent||''};});
    ok(rc.qr&&rc.title==='https://eterna.photo/#g/'+tokL,'Recibo: QR do recibo deveria apontar para a galeria da venda: '+JSON.stringify({...rc,txt:rc.txt.slice(0,80),tokL}));
    const codL=await A1.evaluate(t=>ETERNA.SIM.galerias[t]&&ETERNA.SIM.galerias[t].codigo,tokL);ok(codL&&rc.txt.includes(codL),'Recibo: o recibo deveria trazer o código curto da galeria '+codL);
    await A1.screenshot({path:PR+'/v77-recibo-checkout.png'});
    // (b) vendedor das vendas da Loja: "Checkout (autoatendimento)" no recibo, na Lista de vendas e no CSV
    ok(/Vendedor: Checkout \(autoatendimento\)/.test(rc.txt),'(b): recibo da venda da Loja deveria ter "Vendedor: Checkout (autoatendimento)": '+(rc.txt.match(/Vendedor:.*/)||[''])[0]);
    {const sv=await A1.evaluate(c=>ETERNA.SIM.sessions[c].seller,card);ok(sv==='Checkout (autoatendimento)','(b): SIM.sessions.seller da venda da Loja: '+sv);}
    {const row=await A1.evaluate(c=>{ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.state.sales.q=c;ETERNA.state.sales.canal='all';ETERNA.state.view='vendas-lista';ETERNA.render();const r=[...document.querySelectorAll('#main tbody tr')].map(t=>t.innerText.replace(/\s+/g,' '));ETERNA.state.sales.q='';ETERNA.state.view='checkout';ETERNA.render();return r;},card);
      ok(row.some(r=>/^E\d+ /.test(r)&&r.includes('Checkout (autoatendimento)')),'(b): Lista de vendas deveria mostrar o vendedor da Loja: '+JSON.stringify(row));}
    await A1.reload();await A1.waitForTimeout(450);ok(await A1.evaluate(()=>!ETERNA.state.lojaRota&&location.hash!=='#loja'&&ETERNA.state.view==='checkout'),'R1: reload depois do Recibo caiu na Loja ou saiu do Checkout');
    // Caixa: recibo da sessão paga com QR
    await A1.evaluate(c=>{ETERNA.state.caixa.session=c;ETERNA.state.view='caixa';ETERNA.render();},card);await A1.waitForTimeout(300);const cx=await A1.evaluate(()=>{const q=document.querySelector('#qrbox');return {qr:!!(q&&q.querySelector('canvas,img')),title:q&&q.title};});
    ok(cx.qr&&cx.title==='https://eterna.photo/#g/'+tokL,'Caixa: recibo com QR da galeria: '+JSON.stringify(cx));await A1.screenshot({path:PR+'/v77-recibo-caixa.png'});
    // Caixa: pagamento no caixa cria a galeria e o QR
    const card2=await A1.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6&&!['paga','cancelada'].includes((ETERNA.SIM.sessions[s.card]||{}).status))[3].card);
    await A1.evaluate(c=>{const S=ETERNA.SIM;const s=S.sessions[c]=S.sessions[c]||{};s.selected=ETERNA.demoSessions().find(x=>x.card===c).photos.slice(0,3).map(p=>p.id);s.cart=[{id:'zona'}];s.status='no caixa';ETERNA.state.caixa.session=c;ETERNA.state.caixa.pay='PIX';ETERNA.state.caixa.tef=false;ETERNA.state.view='caixa';ETERNA.render();},card2);
    await A1.click('[data-act="caixa-confirm"]');await A1.waitForTimeout(400);const cx2=await A1.evaluate(c=>{const q=document.querySelector('#qrbox');const t=ETERNA.galDaSessao(c);const m=t&&ETERNA.SIM.galerias[t];return {qr:!!(q&&q.querySelector('canvas,img')),title:q&&q.title,t,compradas:m?m.fotos.filter(f=>f.direito==='comprada').length:0,fila:(ETERNA.SIM.galFila||[]).some(x=>x.token===t)};},card2);
    ok(cx2.qr&&cx2.t&&cx2.title==='https://eterna.photo/#g/'+cx2.t&&cx2.compradas===3&&cx2.fila,'Caixa: receber no caixa deveria criar e publicar a galeria com as 3 fotos compradas e o QR: '+JSON.stringify(cx2));
    // Lista de vendas: venda online de teste fora da receita; CSV
    const receita=()=>A1.evaluate(()=>{ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.state.sales.canal='all';ETERNA.state.view='vendas-lista';ETERNA.render();const t=[...document.querySelectorAll('.tile')].map(x=>x.innerText.replace(/\s+/g,' '));return {rec:t.find(x=>/receita/i.test(x)),vendas:t.find(x=>/^vendas/i.test(x))};});
    const antes=await receita();
    await A1.evaluate(c=>{const m=ETERNA.SIM.galerias[ETERNA.galDaSessao(c)];ETERNA.SIM.vendasOnline=(ETERNA.SIM.vendasOnline||[]).concat([{id:'O901',token:m.token,card:c,pids:[m.fotos[0].id],n:1,total:39,pay:'Pix online',at:new Date().toISOString(),canal:'online',status:'paga',teste:true}]);},card);
    await A1.evaluate(()=>{ETERNA.state.sales.canal='all';ETERNA.state.view='vendas-lista';ETERNA.render();});
    const depois=await receita();const linha=await A1.evaluate(()=>{ETERNA.state.sales.canal='online';ETERNA.render();return 1;}).then(()=>A1.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(t=>t.innerText.replace(/\s+/g,' ')).find(t=>/O901/.test(t))));await A1.evaluate(()=>{ETERNA.state.sales.canal='all';ETERNA.render();});
    ok(antes.rec&&antes.rec===depois.rec&&antes.vendas===depois.vendas&&linha&&/teste/.test(linha)&&/Online/.test(linha),'S3: venda online de teste deveria aparecer como teste e ficar fora da receita: '+JSON.stringify({antes,depois,linha:String(linha)}));
    const [dl]=await Promise.all([A1.waitForEvent('download'),A1.click('[data-act="sales-csv"]')]);const csv=fs.readFileSync(await dl.path(),'utf8').split('\n');
    ok(/;"?canal"?$/.test(csv[0].trim())&&csv.some(l=>/"O901".*"teste";"online"/.test(l))&&csv.some(l=>/"loja"\s*$/.test(l)),'CSV: coluna canal e venda de teste: '+csv[0]+' / '+(csv.find(l=>/O901/.test(l))||'sem O901'));
    await A1.screenshot({path:PR+'/v77-lista-vendas.png'});
    // Catálogo › Checkout: campo novo, limites 5 a 120
    await A1.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();});const vals=[];
    for(const [v,esp] of [['2',5],['500',120],['45',45],['abc',5],['7.6',8]]){await A1.fill('#loja-fim',v).catch(async()=>{await A1.evaluate(x=>{const i=document.querySelector('#loja-fim');i.value=x;},v);});await A1.evaluate(()=>document.querySelector('#loja-fim').dispatchEvent(new Event('change',{bubbles:true})));await A1.waitForTimeout(80);vals.push([v,await A1.evaluate(()=>ETERNA.SIM.lojaFimSeg),esp]);}
    ok(vals.every(([v,g,e])=>g===e),'Catálogo: tempo da tela final deveria ficar entre 5 e 120: '+JSON.stringify(vals));
    await A1.fill('#loja-fim','30');await A1.evaluate(()=>document.querySelector('#loja-fim').dispatchEvent(new Event('change',{bubbles:true})));
    await A1.evaluate(()=>document.querySelector('#loja-fim').scrollIntoView({block:'center'}));await A1.screenshot({path:PR+'/v77-catalogo-checkout.png'});
    const semPerm=await A1.evaluate(()=>{const u=ETERNA.state.user;const p0=u.perms;u.perms=JSON.parse(JSON.stringify(p0||{}));try{u.perms.catalogo={c:false,r:true,u:false,d:false};ETERNA.render();const i=document.querySelector('#loja-fim');const v0=ETERNA.SIM.lojaFimSeg;if(i){i.disabled=false;i.value='77';i.dispatchEvent(new Event('change',{bubbles:true}));}return {dis:i?i.disabled:null,existe:!!i,gravou:ETERNA.SIM.lojaFimSeg!==v0};}finally{u.perms=p0;ETERNA.render();}});
    ok(semPerm.existe&&!semPerm.gravou,'Catálogo: sem catalogo.u o tempo da tela final não pode ser gravado: '+JSON.stringify(semPerm));
    // Galerias online: abas (prints)
    await A1.evaluate(()=>{ETERNA.state.view='galerias';ETERNA.render();});
    for(const t of ['sessoes','grupos','envio','cortesias']){const b2=await A1.$(`[data-act="gal-tab"][data-v="${t}"]`);if(!b2){fails.push('Galerias: aba '+t+' não existe');continue;}await b2.click();await A1.waitForTimeout(150);ok(!/Algo falhou/.test(await A1.textContent('#main')),'Galerias: aba '+t+' quebrou');await A1.screenshot({path:`${PR}/v77-galerias-${t}.png`,fullPage:true});}
    await A1.close();}
  // ---- galeria pública no SIM: prints de consentimento, galeria e pagar (celular)
  dbg('prints SIM');
  {const G=await nova(ctx,'galeria-sim',{width:390,height:844});await G.goto(U);await G.waitForTimeout(400);const t=await G.evaluate(()=>Object.values(ETERNA.SIM.galerias||{}).find(m=>m.tipo==='sessao'&&m.fotos.some(f=>f.direito==='venda'))?.token);
    if(t){await G.goto(U+'#g/'+t);await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='consent',null,{timeout:15000}).catch(()=>{});await G.screenshot({path:PR+'/v77-sim-consentimento.png'});
      await G.evaluate(()=>{ETERNA.pub.step='galeria';ETERNA.render();});await G.waitForTimeout(300);await G.screenshot({path:PR+'/v77-sim-galeria.png',fullPage:true});
      await G.click('[data-act="gq-sel"]');await G.click('[data-act="gq-buy"]');await G.waitForTimeout(150);await G.click('[data-act="gq-paym"][data-m="pix"]');ok(await G.evaluate(()=>ETERNA.pub.step==='pagar'),'SIM: etapa pagar');await G.screenshot({path:PR+'/v77-sim-pagar.png'});
      const sr=await semRolagem(G);ok(sr.ok,'SIM: pagar com rolagem horizontal '+JSON.stringify(sr));}
    await G.close();}
  await ctx.close();
}catch(e){fails.push('erro: '+(e&&e.stack||e).toString().slice(0,500));}
finally{try{if(b)await b.close();}catch(e){}for(const p of procs){try{p.kill('SIGKILL')}catch(e){}}for(const h of homes){try{fs.rmSync(h,{recursive:true,force:true})}catch(e){}}}
const okAll=!fails.length&&!errs.length;console.log(`${okAll?'OK':'FALHA'} v77-regressao: revisor 3 e 4, segurança 2/6/8/9/10, app com agente, Checkout 3x5, reload, vendas, Catálogo, recibo${notas.length?' · '+notas.join(' · '):''}${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,4).join(' | '):''}`);process.exit(okAll?0:1);})();
