// v80: correções da revisão de segurança no agente (B1, I2, I3, I4, I5, I7) e a ordem do FTP no app (I1).
// Sobe o agente com HOME temporário e FTP numa porta livre (ETERNA_FTP_PORTA); o cliente FTP é o ftplib do Python.
const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const AG=path.join(__dirname,'..','agente','eterna-agente.py');const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function req(porta,method,p,{headers,body}={}){return new Promise(res=>{const data=body==null?null:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:{...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...(headers||{})}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(b)}catch(e){}res({s:rs.statusCode,h:rs.headers,b,j});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
// cliente FTP: devolve as respostas do servidor em ordem
function ftp(porta,passos){const py=`
import ftplib,io,json,sys
out=[]
p=json.loads(sys.argv[1])
f=ftplib.FTP()
try:
    f.connect('127.0.0.1',${porta},timeout=10)
    for s in p:
        k=s[0]
        try:
            if k=='login': out.append(f.login(s[1],s[2]))
            elif k=='cwd': out.append(f.cwd(s[1]))
            elif k=='feat': out.append(f.sendcmd('FEAT'))
            elif k=='stor':
                dados=bytes.fromhex(s[2])
                out.append(f.storbinary('STOR '+s[1],io.BytesIO(dados),rest=s[3] if len(s)>3 else None))
        except ftplib.all_errors as e: out.append('ERRO '+str(e))
finally:
    try: f.close()
    except Exception: pass
print(json.dumps(out))`;
  try{return JSON.parse(execFileSync('python3',['-c',py,J(passos)],{timeout:30000}).toString().trim().split('\n').pop());}catch(e){return ['FALHOU '+e.message.slice(0,200)];}}
const mkJpeg=c=>execFileSync('python3',['-c',`import io;from PIL import Image;b=io.BytesIO();Image.new('RGB',(320,200),(${c},90,160)).save(b,'JPEG',quality=80);print(b.getvalue().hex())`]).toString().trim();
const jpeg=mkJpeg(40),jpeg2=mkJpeg(120),jpeg3=mkJpeg(200); // conteúdos diferentes: o agente descarta repetidas pelo hash
async function subir(home,porta,ftpP,extra){const p=spawn('python3',[AG],{env:{...process.env,HOME:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(ftpP),ETERNA_APP_ORIGIN:'http://127.0.0.1:9',ETERNA_SEM_OPENCV:'1',...(extra||{})},stdio:['ignore','pipe','pipe']});
  let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);for(let i=0;i<60;i++){await sleep(250);if((await req(porta,'GET','/status')).s===200){await sleep(300);return {p,log:()=>log};}}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-300));}
const bib=async porta=>((await req(porta,'GET','/biblioteca')).j||{}).fotos||[];
(async()=>{const procs=[];const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-seg-'));const porta=17000+Math.floor(Math.random()*900),ftpP=porta+1000;
try{
  // ---------- I7: ftp.json novo com senhas de 12+ caracteres, chmod 600, senhas fora do console ----------
  let A=await subir(home,porta,ftpP);procs.push(A.p);const cfgP=path.join(home,'Eterna','ftp.json');const cfg=JSON.parse(fs.readFileSync(cfgP,'utf8'));
  const pws=Object.values(cfg.users);ok(pws.length&&pws.every(x=>String(x).length>=12),'I7: senhas novas com menos de 12 caracteres');ok((fs.statSync(cfgP).mode&0o777)===0o600,'I7: ftp.json sem chmod 600');
  ok(!pws.some(x=>A.log().includes(x)),'I7: senha do FTP impressa no console');
  // ---------- I2: sem REST STREAM; REST 5000 recusado; arquivo que não é JPEG nem PNG não entra ----------
  const pw=cfg.users.carlos;let r=ftp(ftpP,[['login','carlos',pw],['feat'],['stor','lixo.jpg','00112233'.repeat(2000),5000],['stor','lixo2.jpg','41424344'.repeat(3000)]]);
  ok(/^230/.test(r[0])&&!/REST/.test(r[1]),'I2: FEAT ainda anuncia REST '+J(r.slice(0,2)));ok(/ERRO 550/.test(r[2]),'I2: STOR com REST 5000 deveria dar 550: '+r[2]);ok(/ERRO 426/.test(r[3]),'I2: lixo com nome .jpg deveria ser recusado: '+r[3]);
  await sleep(400);ok(!(await bib(porta)).some(f=>/lixo/.test(f.name)),'I2: lixo entrou na biblioteca');
  // ---------- B1: login carlos com CWD /marinara: a foto é do carlos ----------
  r=ftp(ftpP,[['login','carlos',pw],['cwd','/marinara'],['stor','IMG_B1.jpg',jpeg]]);ok(/^226/.test(r[2]),'B1: STOR válido não entrou '+J(r));
  let f1=null;for(let i=0;i<20&&!f1;i++){await sleep(250);f1=(await bib(porta)).find(f=>f.name==='IMG_B1.jpg');}ok(f1&&f1.origem==='carlos'&&f1.via==='ftp','B1: login carlos com CWD /marinara deveria gravar origem carlos: '+J(f1&&{o:f1.origem,v:f1.via}));
  // ---------- I7: 5 senhas erradas bloqueiam o IP, até a certa ----------
  for(let i=0;i<5;i++)ftp(ftpP,[['login','carlos','errada'+i]]);r=ftp(ftpP,[['login','carlos',pw]]);ok(/421/.test(r[0]),'I7: depois de 5 erros a senha certa deveria dar 421: '+r[0]);
  ok(!A.log().includes('errada0'),'I7: senha tentada no console');
  // ---------- I3: sem CORS * para origem de fora ----------
  for(const p of ['/metricas','/ftp-remoto/status','/photoroom/status','/roverpix/status']){const x=await req(porta,'GET',p,{headers:{Origin:'https://exemplo.com'}});ok(!x.h['access-control-allow-origin'],`I3: ${p} devolveu CORS ${x.h['access-control-allow-origin']}`);
    const l=await req(porta,'GET',p);ok(l.s===200,`I3: ${p} sem Origin (mesma origem) deveria responder 200: ${l.s}`);}
  // ---------- I4: /rostos/projecao só com ETERNA_TESTE_CARGA, por POST ----------
  ok((await req(porta,'GET','/rostos/projecao?n=6000000')).s!==200,'I4: GET /rostos/projecao ainda responde');ok((await req(porta,'POST','/rostos/projecao',{body:{n:6000000}})).s===404,'I4: POST sem ETERNA_TESTE_CARGA deveria dar 404');
  // ---------- I5: trocar servidor, porta ou usuário do FTP remoto exige senha nova ----------
  fs.writeFileSync(path.join(home,'Eterna','ftp-remoto.json'),J({host:'127.0.0.1',port:1,user:'estadio',password:'segredo-salvo',dir:'',tls:false}));
  let c=await req(porta,'POST','/ftp-remoto/config',{body:{host:'10.9.9.9',port:21,user:'estadio',password:''}});ok(c.s===400&&/senha/.test(c.b),'I5: host novo sem senha deveria dar 400: '+c.s+' '+c.b);
  c=await req(porta,'POST','/ftp-remoto/config',{body:{host:'127.0.0.1',port:1,user:'outro',password:''}});ok(c.s===400,'I5: usuário novo sem senha deveria dar 400: '+c.s);
  c=await req(porta,'POST','/ftp-remoto/config',{body:{host:'127.0.0.1',port:1,user:'estadio',password:''}});ok(c.s===502,'I5: mesmo servidor sem senha deveria reaproveitar a salva e tentar conectar (502 aqui): '+c.s);
  A.p.kill('SIGKILL');await sleep(400);
  // ---------- B1: login compartilhado com subpasta = fotógrafo cadastrado ----------
  cfg.users.ctp='ctp-compartilhado-123';cfg.compartilhado=['ctp'];fs.writeFileSync(cfgP,J(cfg));
  A=await subir(home,porta,ftpP);procs.push(A.p);
  r=ftp(ftpP,[['login','ctp','ctp-compartilhado-123'],['cwd','/marinara'],['stor','IMG_C1.jpg',jpeg2],['cwd','/ninguem'],['stor','IMG_C2.jpg',jpeg3]]);
  let c1=null,c2=null;for(let i=0;i<20&&!(c1&&c2);i++){await sleep(250);const L=await bib(porta);c1=L.find(f=>f.name==='IMG_C1.jpg');c2=L.find(f=>f.name==='IMG_C2.jpg');}
  ok(c1&&c1.origem==='marinara','B1: login compartilhado em /marinara deveria gravar marinara: '+J(c1&&c1.origem)+' '+J(r));ok(c2&&c2.origem==='ctp','B1: subpasta que não é fotógrafo deveria ficar com o login: '+J(c2&&c2.origem));
  // ---------- I1: no app, o login do FTP vem antes da câmera ----------
  const {chromium}=require('playwright');const b=await chromium.launch();const pg=await b.newPage();await pg.goto(U);await pg.waitForTimeout(400);
  const w=await pg.evaluate(()=>{const d=ETERNA.SIM.camDia=ETERNA.SIM.camDia||{};const day='2026-10-20';d[day]={SERIE1:'marinara'};return ETERNA.libWho({id:'x',day,serie:'SERIE1',autor:'Yago',via:'ftp',origem:'carlos'},{ses:{},sold:new Set()});});
  ok(w==='carlos','I1: FTP de carlos com câmera da Marinara deveria ser carlos: '+w);await b.close();
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
procs.forEach(p=>{try{p.kill('SIGKILL')}catch(e){}});try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}
const ok2=!fails.length;console.log(`${ok2?'OK':'FALHA'} agente-seguranca: B1, I1, I2, I3, I4, I5, I7${fails.length?' · '+fails.slice(0,10).join(' | '):''}`);process.exit(ok2?0:1);})();
