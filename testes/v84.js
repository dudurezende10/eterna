// v84: recorte local dos fundos de IA (sem Photoroom). Agente: POST /recorte com rembg (ISNet + u2net_human_seg), cache,
// acesso só local, 503 sem os modelos. App: montagem no canvas com as regras de docs/fundos-ia-regras.md, impressão com o
// fundo de 5000 px e o interruptor "Montagem dos fundos" no Painel de controle.
// Fotos: só as de exemplo do repositório (sprites/c00.webp), ampliadas; nenhuma foto de convidado de fora do repo.
// Memória: só isnet-general-use e u2net_human_seg (nunca birefnet). Sem rembg no ambiente, a parte do recorte real é pulada com aviso.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const fails=[],errs=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function req(porta,method,p,{body,headers={}}={}){return new Promise(res=>{const data=body==null?null:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:{...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch);let j=null;try{j=JSON.parse(b.toString())}catch(e){}res({s:rs.statusCode,b,j,h:rs.headers});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
const dia=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
async function subir(porta,env,home){const p=spawn('python3',[AG],{env:{...process.env,HOME:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(porta+1000),ETERNA_APP_ORIGIN:'http://127.0.0.1:9',ETERNA_LEITORES:'1',ETERNA_SEM_OPENCV:'1',...env},stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);
  for(let i=0;i<80;i++){await sleep(250);const r=await req(porta,'GET','/status');if(r.s===200)return {p,log:()=>log};}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-400));}
const png=b=>({w:b.readUInt32BE(16),h:b.readUInt32BE(20),tipo:b[25]}); // IHDR; tipo 6 = RGBA
const PORTA=+(process.env.PORTA_V84||8840+Math.floor(Math.random()*40));
const REAL_HOME=os.homedir();
const PIDS={meio:'a84000000001',inteiro:'a84000000002',oculos:'a84000000003'};

(async()=>{const procs=[];let b=null;
try{
  // ---------- 1. Python: regra 12, teto de 6000 px, cache, EXIF, fila, sem import no topo ----------
  {const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v84-py-'));let out='';
    try{out=execFileSync('python3',['-I',path.join(__dirname,'v84_agente.py'),AG],{env:{...process.env,HOME:H,ETERNA_SEM_OPENCV:'1'},timeout:120000}).toString().trim().split('\n').pop();}catch(e){out=J({ok:false,falhas:[String(e.message).slice(0,300)]});}
    let j={};try{j=JSON.parse(out);}catch(e){j={ok:false,falhas:[out]};}ok(j.ok,'1: testes Python do agente: '+J(j.falhas));}

  // fotos de exemplo do repositório: meio corpo (encosta embaixo) e corpo inteiro, ampliadas para 3000×2000
  const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v84-'));const inbox=path.join(H,'Eterna','inbox',dia());fs.mkdirSync(inbox,{recursive:true});
  execFileSync('python3',['-c',`
import sys
from PIL import Image
sh=Image.open(sys.argv[1]).convert('RGB')
for nome,(c,r) in (('${PIDS.meio}',(2,0)),('${PIDS.inteiro}',(3,0)),('${PIDS.oculos}',(3,2))):
    sh.crop((c*360,r*240,c*360+360,r*240+240)).resize((3000,2000),Image.LANCZOS).save(sys.argv[2]+'/'+nome+'_IMG.jpg',quality=90)
`,path.join(RAIZ,'sprites','c00.webp'),inbox]);
  const FOTO={meio:fs.readFileSync(path.join(inbox,PIDS.meio+'_IMG.jpg')),inteiro:fs.readFileSync(path.join(inbox,PIDS.inteiro+'_IMG.jpg'))};

  // ---------- 2. agente com rembg de verdade ----------
  const temRembg=(()=>{try{execFileSync('python3',['-c','import rembg, onnxruntime'],{stdio:'ignore'});}catch(e){return false;}
    return ['isnet-general-use','u2net_human_seg'].every(n=>fs.existsSync(path.join(REAL_HOME,'.rembg','models',n,n+'.onnx'))||fs.existsSync(path.join(REAL_HOME,'.u2net',n+'.onnx')));})();
  const CUT={};
  if(!temRembg){notas.push('rembg ou modelos ausentes: recorte real pulado');}
  else{const A=await subir(PORTA,{REMBG_HOME:path.join(REAL_HOME,'.rembg'),U2NET_HOME:path.join(REAL_HOME,'.u2net')},H);procs.push(A.p);
    let st=(await req(PORTA,'GET','/status')).j;ok(st.recorte&&st.recorte.ok===true&&st.recorte.carregado===false,'2: /status com recorte pronto e ainda não carregado: '+J(st.recorte));
    ok(/Recorte local:\s+pronto/.test(A.log()),'2: console mostra o recorte: '+A.log().slice(0,600));
    for(const k of ['meio','inteiro','oculos']){const t0=Date.now();const r=await req(PORTA,'POST','/recorte',{body:{pid:PIDS[k]}});const ms=Date.now()-t0;
      const d=r.s===200?png(r.b):{};ok(r.s===200&&/image\/png/.test(r.h['content-type'])&&d.w===3000&&d.h===2000&&d.tipo===6,`2: recorte ${k} em PNG RGBA 3000×2000: `+J({s:r.s,d,j:r.j}));
      CUT[k]=r.b;notas.push(`recorte ${k}: ${ms} ms`);}
    ok(fs.existsSync(path.join(H,'Eterna','recortes',PIDS.meio+'.png')),'2: cache em ~/Eterna/recortes/<pid>.png');
    // regra 12 e limpeza: o rosto com óculos escuros fica opaco; fora da pessoa, RGB zerado; nada de meio-transparente longe da pessoa
    {const f=path.join(H,'oculos.png');fs.writeFileSync(f,CUT.oculos);let out='';
      try{out=execFileSync('python3',['-c',`
import sys,json,cv2,numpy as np
from PIL import Image
im=Image.open(sys.argv[1]);a=np.asarray(im.getchannel('A'));rgb=np.asarray(im.convert('RGB'))
src=np.asarray(Image.open(sys.argv[2]).convert('RGB'))[:,:,::-1].copy()
det=cv2.FaceDetectorYN.create(sys.argv[3],'',(src.shape[1],src.shape[0]),0.6,0.3,50);_,fs=det.detect(src)
r={'rostos':0 if fs is None else len(fs),'fora_rgb':int(rgb[a==0].max()) if (a==0).any() else 0,'meio':float(((a>0)&(a<255)).mean())}
if fs is not None:
    x,y,w,h=[int(v) for v in fs[0][:4]];r['opaco']=float((a[y+h//5:y+h*3//5,x:x+w]>=230).mean())
print(json.dumps(r))`,f,path.join(inbox,PIDS.oculos+'_IMG.jpg'),path.join(RAIZ,'vendor','rostos','face_detection_yunet_2023mar.onnx')]).toString().trim();}catch(e){out=J({erro:String(e.message).slice(0,200)});}
      const o=JSON.parse(out);if(o.erro&&/cv2/.test(o.erro))notas.push('sem OpenCV: óculos não conferidos');
      else ok(o.rostos>=1&&o.opaco>=.97&&o.fora_rgb===0&&o.meio<.02,'2: óculos inteiros (regra 12), RGB zerado fora e sem fantasma: '+out);}
    // regra 13: o que está com o convidado sai junto e sólido: a taça que ele segura ou encosta e a bandeira aberta saindo da silhueta
    {fs.writeFileSync(path.join(H,'r-meio.png'),CUT.meio);fs.writeFileSync(path.join(H,'r-inteiro.png'),CUT.inteiro);let out='';
      try{out=execFileSync('python3',['-c',`
import sys,json,numpy as np
from PIL import Image
def zona(f,b):
    a=np.asarray(Image.open(f).getchannel('A'));x0,y0,x1,y1=b;r=a[y0:y1,x0:x1];return [round(float((r>=230).mean()),3),round(float(((r>0)&(r<230)).mean()),3)]
print(json.dumps({'taca_encostada':zona(sys.argv[2],(1250,850,1400,1100)),'taca_ao_lado':zona(sys.argv[1],(950,1150,1200,1550)),'bandeira':zona(sys.argv[1],(2120,1000,2380,1700))}))`,path.join(H,'r-meio.png'),path.join(H,'r-inteiro.png')]).toString().trim();}catch(e){out=J({erro:String(e.message).slice(0,200)});}
      const z=JSON.parse(out);ok(z.taca_encostada&&['taca_encostada','taca_ao_lado','bandeira'].every(k=>z[k][0]>=.97&&z[k][1]<=.02),'2: taça e bandeira aberta inteiras e sólidas no recorte (regra 13): '+out);}
    let r=await req(PORTA,'POST','/recorte',{body:{pid:PIDS.meio,lado:2400}});ok(r.s===200&&png(r.b).w===2400&&fs.existsSync(path.join(H,'Eterna','recortes',PIDS.meio+'_2400.png')),'2: recorte de 2400 px da prévia, com cache separado: '+J({s:r.s,d:r.s===200&&png(r.b)}));
    r=await req(PORTA,'POST','/recorte',{body:{pid:PIDS.meio,lado:6000}});ok(r.s===400,'2: lado fora de 2400/3000: '+r.s);
    r=await req(PORTA,'POST','/photoroom/compose',{body:{bg:'campeao2',pid:PIDS.meio}});ok(r.s===409&&r.j&&r.j.error==='photoroom_desligado','2: Photoroom recusado com o modo local: '+J({s:r.s,j:r.j}));
    r=await req(PORTA,'POST','/fundos/modo',{body:{modo:'photoroom'},headers:{Origin:'https://exemplo.com'}});ok(r.s===403,'2: /fundos/modo de fora: '+r.s);
    r=await req(PORTA,'POST','/fundos/modo',{body:{modo:'photoroom'}});const st2=(await req(PORTA,'GET','/status')).j;
    const r2=await req(PORTA,'POST','/photoroom/compose',{body:{bg:'campeao2',pid:PIDS.meio}});
    ok(r.s===200&&st2.fundos_modo==='photoroom'&&r2.s!==409,'2: com o modo Photoroom gravado pelo app, o agente libera: '+J({s:r.s,m:st2.fundos_modo,c:r2.s}));
    await req(PORTA,'POST','/fundos/modo',{body:{modo:'local'}});
    r=await req(PORTA,'POST','/recorte',{headers:{Origin:'https://exemplo.com'},body:{pid:PIDS.meio}});ok(!r.h['access-control-allow-origin'],'2: /recorte sem CORS para fora');
    let t0=Date.now();r=await req(PORTA,'POST','/recorte',{body:{pid:'ag_'+PIDS.meio}});ok(r.s===200&&Date.now()-t0<1500&&r.b.equals(CUT.meio),'2: segundo pedido sai do cache: '+(Date.now()-t0)+' ms');
    st=(await req(PORTA,'GET','/status')).j;ok(st.recorte.carregado===true&&st.recorte.feitos===3&&st.recorte.ms_medio>0,'2: /status conta 2 recortes: '+J(st.recorte));notas.push('média do agente: '+st.recorte.ms_medio+' ms');
    r=await req(PORTA,'GET','/recorte/'+PIDS.meio+'.png');ok(r.s===200&&r.b.equals(CUT.meio),'2: GET /recorte/<pid>.png: '+r.s);
    r=await req(PORTA,'GET','/recorte/'+PIDS.meio+'.png',{headers:{Origin:'https://exemplo.com'}});ok(r.s===403,'2: GET com origem de fora: '+r.s);
    r=await req(PORTA,'GET','/recorte/..%2f..%2fetc.png');ok(r.s===404,'2: GET com nome inválido: '+r.s);
    r=await req(PORTA,'POST','/recorte',{body:{pid:PIDS.meio},headers:{Origin:'https://exemplo.com'}});ok(r.s===403,'2: POST com origem de fora: '+r.s);
    r=await req(PORTA,'POST','/recorte',{body:{pid:PIDS.meio},headers:{Host:'exemplo.com:'+PORTA}});ok(r.s===403,'2: POST com Host forjado: '+r.s);
    r=await req(PORTA,'POST','/recorte',{body:{pid:'../x'}});ok(r.s===400,'2: pid inválido: '+r.s);
    r=await req(PORTA,'POST','/recorte',{body:{pid:'ffffffffffff'}});ok(r.s===404,'2: pid fora da biblioteca: '+r.s);
    A.p.kill('SIGKILL');}

  // ---------- 3. agente sem os modelos: 503 com o comando de instalação ----------
  {const H2=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v84b-'));const ib=path.join(H2,'Eterna','inbox',dia());fs.mkdirSync(ib,{recursive:true});fs.writeFileSync(path.join(ib,PIDS.meio+'_IMG.jpg'),FOTO.meio);
    const vazio=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v84-sem-'));const B=await subir(PORTA+1,{REMBG_HOME:vazio,U2NET_HOME:vazio},H2);procs.push(B.p);
    const st=(await req(PORTA+1,'GET','/status')).j;ok(st.ok&&st.recorte&&st.recorte.ok===false&&/modelos/.test(st.recorte.motivo),'3: /status recorte {ok:false,motivo}: '+J(st.recorte));
    const r=await req(PORTA+1,'POST','/recorte',{body:{pid:PIDS.meio}});
    ok(r.s===503&&r.j&&r.j.error==='recorte_indisponivel'&&/instalar-recorte/.test(r.j.como)&&/rembg==2\.0\.86/.test(r.j.como)&&!/\[cli\]/.test(r.j.como)&&/não instalado/.test(r.j.motivo),'3: 503 recorte_indisponivel: '+J({s:r.s,j:r.j}));
    ok(/Recorte local:\s+indisponível/.test(B.log()),'3: console avisa');B.p.kill('SIGKILL');}

  // ---------- 4. app: montagem no canvas com as regras ----------
  if(!CUT.meio){execFileSync('python3',['-c',`
import sys
from PIL import Image,ImageDraw
for n,box in (('meio',[1200,500,1800,2000]),('inteiro',[1300,300,1700,1800])):
    im=Image.new('RGBA',(3000,2000),(0,0,0,0));ImageDraw.Draw(im).rectangle(box,fill=(200,30,30,255));im.save(sys.argv[1]+'/'+n+'.png')
`,H]);CUT.meio=fs.readFileSync(H+'/meio.png');CUT.inteiro=fs.readFileSync(H+'/inteiro.png');}
  // grupo largo de corpo inteiro (formas, sem pessoa): mais largo que alto depois do corte, para a regra 10 do 1950
  execFileSync('python3',['-c',`
import sys
from PIL import Image,ImageDraw
im=Image.new('RGBA',(3000,2000),(0,0,0,0));d=ImageDraw.Draw(im)
for i in range(6):
    x=200+i*450;d.ellipse([x+60,600,x+260,800],fill=(220,180,150,255));d.rectangle([x,800,x+320,1850],fill=(30,30,200,255))
im.save(sys.argv[1]+'/largo.png')
`,H]);CUT.largo=fs.readFileSync(H+'/largo.png');
  // família larga com uma criança baixa (feita do recorte de uma foto de exemplo do repo): o corte de 55% passaria pelo rosto dela
  if(CUT.oculos){fs.writeFileSync(H+'/oc.png',CUT.oculos);execFileSync('python3',['-c',`
import sys
from PIL import Image
p=Image.open(sys.argv[1]);p=p.crop(p.getchannel('A').getbbox())
out=Image.new('RGBA',(3000,2000),(0,0,0,0))
def pos(h,x,y):
    q=p.resize((int(p.width*h/p.height),h),Image.LANCZOS);out.alpha_composite(q,(x,y))
for i in range(3): pos(1350,80+i*700,120)
pos(560,2180,860)
out.save(sys.argv[2])
`,H+'/oc.png',H+'/crianca.png']);CUT.crianca=fs.readFileSync(H+'/crianca.png');}
  const recLog=[],prLog=[],modoLog=[];
  b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await ctx.route(ORIG+'/recorte',r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}recLog.push(q.pid);
    const body=q.pid===PIDS.meio?CUT.meio:q.pid===PIDS.inteiro?CUT.inteiro:q.pid==='c84000000003'?CUT.largo:q.pid==='e84000000005'?CUT.crianca:null;
    if(q.pid==='d84000000004')return r.fulfill({status:503,contentType:'application/json',body:J({error:'recorte_indisponivel',motivo:'modelos não baixados',como:'x'})});
    if(!body)return r.fulfill({status:404,contentType:'application/json',body:'{}'});r.fulfill({status:200,contentType:'image/png',body});});
  await ctx.route(ORIG+'/photoroom/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({configured:true,calls:0})}));
  await ctx.route(ORIG+'/photoroom/compose',r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}prLog.push(q);r.fulfill({status:200,contentType:'application/json',body:J({ok:false,error:'teste'})});});
  const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);
  // tela de entrada: o e-mail já vem focado; na etapa do código, o código
  const foco=await pg.evaluate(()=>({v:ETERNA.state.view,act:document.activeElement&&document.activeElement.dataset.act}));ok(foco.v==='entrar'&&foco.act==='login-email','0: ao abrir sem sessão, o campo de e-mail já vem focado: '+J(foco));
  await pg.type('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.evaluate(()=>ETERNA.render());
  ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.dataset.act)!=='login-code','0: outro render da entrada não pula para outro campo');
  await pg.click('button[type=submit]');await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.dataset.act)==='login-code','0: na etapa do código, o campo do código vem focado');
  await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);
  const mont=(id,bg)=>pg.evaluate(async([id,bg])=>{const r=await ETERNA.fiaMontar(id,bg);if(!r.canvas)return r;const c=r.canvas,x=c.getContext('2d');const L=r.layout;
    // cinza: R, G e B iguais (±2) numa grade; diferença do fundo puro no meio da borda de baixo do grupo
    let cinza=true;const d=x.getImageData(0,0,c.width,c.height).data;for(let yy=0;yy<c.height;yy+=37)for(let xx=0;xx<c.width;xx+=41){const k=(yy*c.width+xx)*4;if(Math.abs(d[k]-d[k+1])>2||Math.abs(d[k+1]-d[k+2])>2)cinza=false;}
    return {w:r.w,h:r.h,modo:L.modo,corte:L.corte,zoom:L.zoom,dst:L.dst,src:L.src,cinza,fonte:r.fonte};},[id,bg]);
  const near=(a,b,t)=>Math.abs(a-b)<=t;
  // meio corpo no Campeão: encostado embaixo, até 88% da altura e 92% da largura
  const m1=await mont('ag_'+PIDS.meio,'campeao2');
  ok(m1.modo==='meio'&&m1.corte===1&&near(m1.dst.y+m1.dst.h,m1.h,1)&&m1.dst.h<=.88*m1.h+1&&m1.dst.w<=.92*m1.w+1&&(near(m1.dst.h,.88*m1.h,2)||near(m1.dst.w,.92*m1.w,2))&&m1.w===2400&&!m1.cinza,'4: meio corpo no Campeão encostado embaixo: '+J(m1));
  // corpo inteiro no Campeão: cortado no joelho (62% do recorte), encostado embaixo, até 85% da altura
  const m2=await mont('ag_'+PIDS.inteiro,'campeao2');
  ok(m2.modo==='inteiro'&&m2.corte===.62&&near(m2.dst.y+m2.dst.h,m2.h,1)&&m2.dst.h<=.85*m2.h+1&&m2.dst.w<=.95*m2.w+1,'4: corpo inteiro no Campeão cortado no joelho: '+J(m2));
  const fullH=await pg.evaluate(async id=>{const r=await fetch('/recorte',{method:'POST',body:JSON.stringify({pid:id})});const im=await createImageBitmap(await r.blob());const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
    const m=ETERNA.fiaMedir(c);return m&&{h:m.box.h/m.k,y:m.box.y/m.k,trunc:m.trunc};},PIDS.inteiro);
  ok(fullH&&!fullH.trunc&&near(m2.src.h,fullH.h*.62,fullH.h*.02),'4: a parte mantida é 62% da altura da pessoa: '+J({src:m2.src,fullH}));
  // Mirante: corpo inteiro do joelho para cima, centro em 45%
  const m3=await mont('ag_'+PIDS.inteiro,'mirante');const cx3=(m3.dst.x+m3.dst.w/2)/m3.w;
  ok(m3.modo==='inteiro'&&m3.corte===.62&&near(m3.dst.y+m3.dst.h,m3.h,1)&&(near(cx3,.45,.01)||m3.dst.x<=0.5||near(m3.dst.x+m3.dst.w,m3.w,1)),'4: Mirante joelho e centro 45%: '+J({m3,cx3}));
  // Túnel: teto de 75% da altura; corpo inteiro no joelho
  const m4=await mont('ag_'+PIDS.meio,'tunel'),m4b=await mont('ag_'+PIDS.inteiro,'tunel');
  ok(m4.modo==='meio'&&m4.dst.h<=.75*m4.h+1&&near(m4.dst.y+m4.dst.h,m4.h,1)&&m4b.corte===.62&&m4b.dst.h<=.75*m4b.h+1,'4: Túnel com teto de 75%: '+J({m4:m4.dst,m4b:m4b.dst,h:m4.h}));
  // 1950: tudo em preto e branco; corpo inteiro 60%/78%; meio corpo no umbigo (72%)
  const m5=await mont('ag_'+PIDS.inteiro,'arq1950'),m6=await mont('ag_'+PIDS.meio,'arq1950');
  ok(m5.cinza&&m6.cinza,'4: o 1950 sai inteiro em preto e branco: '+J({m5:m5.cinza,m6:m6.cinza}));
  ok((m5.modo==='inteiro'&&m5.corte===.6&&m5.dst.h<=.78*m5.h+1||m5.modo==='largo'&&m5.corte===.55)&&near(m5.dst.y+m5.dst.h,m5.h,1),'4: 1950 corpo inteiro 60%/78% (ou largo): '+J(m5));
  ok(m6.modo==='meio'&&m6.corte===.72&&near(m6.dst.y+m6.dst.h,m6.h,1),'4: 1950 meio corpo no umbigo: '+J(m6));
  // família larga no 1950: zoom do fundo (80%), corte a 55%, até 105% da largura; no Campeão, sem zoom
  const m7=await mont('ag_c84000000003','arq1950'),m7c=await mont('ag_c84000000003','campeao2');
  ok(m7.modo==='largo'&&m7.zoom===.8&&m7.corte===.55&&m7.dst.w<=1.05*m7.w+1&&near(m7.dst.y+m7.dst.h,m7.h,1)&&m7.cinza&&m7c.zoom===1&&m7c.modo==='inteiro','4: família larga no 1950 com zoom do fundo: '+J({m7,m7c:[m7c.modo,m7c.zoom]}));
  // D5 / regra 10: a linha de corte desce até a base do rosto mais baixo + 15% (função pura e, com foto de exemplo, pelo YuNet do app)
  const pura=await pg.evaluate(()=>{const h=100,w=150,rows=[];for(let y=0;y<h;y++)rows.push(y>=10&&y<90?[5,145]:null);const m={W:1500,H:1000,w,h,k:.1,rows,box:{x:5,y:10,w:141,h:80},trunc:false};
    const a=ETERNA.fiaLayout(m,'arq1950',5000,3571),b=ETERNA.fiaLayout(m,'arq1950',5000,3571,[{top:.5,bot:.6,h:.1}]);return {a:[a.modo,a.corteFinal],b:[b.modo,b.corteFinal,b.src.y+b.src.h]};});
  ok(pura.a[0]==='largo'&&near(pura.a[1],.55,.02)&&near(pura.b[2]*0.1,61.5,1.5),'4: corte desce até a base do rosto + 15%: '+J(pura));
  if(CUT.crianca){const mc=await pg.evaluate(async()=>{const r=await ETERNA.fiaMontar('ag_e84000000005','arq1950');return r.layout?{modo:r.layout.modo,cf:r.layout.corteFinal,ro:r.layout.rostos}:r;});
    ok(mc.modo==="largo"&&mc.ro>=4&&mc.cf>.57,'4: família larga no 1950 com criança baixa: o corte desce e o rosto dela fica inteiro: '+J(mc));}
  // contraste do grupo no 1950 (+10%) e nenhum filtro no Campeão
  const rg=await pg.evaluate(()=>JSON.stringify(ETERNA.FIA_REGRAS));ok(/"arq1950":\{"mono":\{"contraste":1.1\}/.test(rg)&&!/campeao2":\{"mono/.test(rg),'4: contraste +10% só no 1950: '+rg.slice(0,200));
  // impressão: fundo de 5000 px (fileHi) e pelo menos 1844×1240 em 10×15
  const hi=await pg.evaluate(async id=>{const r=await ETERNA.compHi(id,'campeao2');return {w:r.w,h:r.h,fonte:r.fonte,url:(r.url||'').slice(0,23),err:r.err,pend:r.pending,av:r.avisos};},'ag_'+PIDS.meio);
  ok(hi.fonte==='img/fundos-5k/campeao.jpg'&&Math.max(hi.w,hi.h)>=1844&&Math.min(hi.w,hi.h)>=1240&&hi.url==='data:image/jpeg;base64,'&&!(hi.av||[]).length,'4: impressão do fileHi com 1844×1240 ou mais: '+J(hi));
  // impressão da v83 (printMontar) com a montagem local
  const pm=await pg.evaluate(async id=>{const r=await ETERNA.printMontar([{k:'ai:'+id+'|arq1950',t:'ai',id,bg:'arq1950'}],{});const im=document.querySelector('#print-root .pr-pg img');const out={ok:r.ok,falhasIA:r.falhasIA,fundo:im&&im.dataset.fundo,w:im&&im.naturalWidth,h:im&&im.naturalHeight};document.getElementById('print-root').remove();return out;},'ag_'+PIDS.inteiro);
  ok(pm.ok.length===1&&!pm.falhasIA.length&&pm.fundo==='img/fundos-5k/pb1950.jpg'&&pm.w>=1844,'4: a impressão da v83 imprime a foto de IA com a montagem local: '+J(pm));
  ok(!prLog.length,'4: nenhum pedido ao Photoroom na montagem local: '+prLog.length);
  // recorte não instalado: a prévia mostra o aviso, sem erro
  const p503=await pg.evaluate(async()=>{const r=await ETERNA.compose('ag_d84000000004','campeao2');const el=document.createElement('span');el.className='compimg';el.dataset.comp='ag_d84000000004|mirante';document.body.appendChild(el);ETERNA.compHydrate();
    await new Promise(z=>setTimeout(z,800));const t=el.innerText;el.remove();return {r,t};});
  ok(p503.r.pending==='recorte'&&/Recorte local não instalado/.test(p503.t),'4: 503 vira aviso de recorte não instalado: '+J(p503));
  const pex=await pg.evaluate(()=>ETERNA.compose('c00x','campeao2'));ok(pex.pending==='exemplo','4: foto de exemplo (sem pid do agente) não pede recorte: '+J(pex));

  // ---------- 5a. Checkout: só oferece fundo de IA com o recorte pronto; carregando nas 5 línguas; item que falhou sai ----------
  const ck=await pg.evaluate(async([a,b])=>{const S=ETERNA.SIM;const card='LPV84CK';const ids=['ag_'+a,'ag_d84000000004','ag_'+b];S.sessions[card]={key:'carlos',pdv:'Foto Campo 2',time:'10:00',date:'hoje',status:'pronta',selected:[],cart:[],photos:ids.map(id=>({id,sold:0}))};
    ids.forEach(id=>{ETERNA.UP[id]={src:location.origin+'/file/'+id.slice(3),name:id};});const ag=ETERNA.state.agent;
    ag.on=true;ag.recorte={ok:false,motivo:'não instalado: modelos não baixados (x)'};const sem=ETERNA.lojaItems(card).filter(x=>x.t==='ai').length;
    ag.recorte={ok:true};const it=ETERNA.lojaItems(card).filter(x=>x.t==='ai');const ruim={id:'ag_d84000000004',bg:'campeao2',k:'ai:ag_d84000000004|campeao2'};ETERNA.lojaPick(card)[ruim.k]='ok';if(!it.some(x=>x.k===ruim.k))it.push(ruim);
    it.forEach(x=>{const el=document.createElement('span');el.className='compimg';el.dataset.comp=x.id+'|'+x.bg;document.body.appendChild(el);});ETERNA.compHydrate();
    await new Promise(z=>setTimeout(z,2500));ag.on=true;ag.recorte={ok:true};/* o agentPoll da página de teste desliga o agente */const depois=ETERNA.lojaItems(card).filter(x=>x.t==='ai');document.querySelectorAll('body>.compimg').forEach(e=>e.remove());
    const res=[];for(const x of it)res.push(await ETERNA.compose(x.id,x.bg).then(r=>r.url?'ok':(r.err||r.pending)));return {res,sem,com:it.length,ruim:!!ruim,depois:depois.length,temRuim:depois.some(x=>x.id==='ag_d84000000004'),pick:Object.keys(ETERNA.lojaPick(card))};},[PIDS.meio,PIDS.inteiro]);
  ok(ck.sem===0,'5a: sem o recorte pronto, o Checkout não oferece fundo de IA: '+J(ck));
  ok(ck.com>1&&!ck.temRuim&&!ck.pick.some(k=>/d84000000004/.test(k)),'5a: item que falhou (503) sai da venda e da escolha: '+J(ck));
  const i18=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8').match(/aiMaking:\[([^\]]*)\]/);ok(i18&&i18[1].split("','").length===5&&/lj-spin/.test(fs.readFileSync(path.join(RAIZ,'index.html'),'utf8')),'5a: "Preparando sua foto especial" nas 5 línguas, com indicador: '+(i18&&i18[1]));
  await pg.evaluate(()=>{ETERNA.state.agent.on=false;ETERNA.state.agent.recorte=null;});

  // ---------- 5. interruptor no Painel de controle ----------
  await pg.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(otp){await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);}
  await pg.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();});await pg.waitForTimeout(200);
  const t5=await pg.evaluate(()=>{const p=document.querySelector('#fundos-modo');return p&&{txt:p.innerText,loc:p.querySelector('[data-m="local"]').getAttribute('aria-pressed'),pr:p.querySelector('[data-m="photoroom"]').getAttribute('aria-pressed')};});
  ok(t5&&/Montagem dos fundos/i.test(t5.txt)&&/Local \(padrão\)/i.test(t5.txt)&&t5.loc==='true'&&t5.pr==='false','5: painel Montagem dos fundos com Local marcado: '+J(t5));
  await ctx.route(ORIG+'/fundos/modo',r=>{modoLog.push(JSON.parse(r.request().postData()||'{}').modo);r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
  await pg.click('#fundos-modo [data-m="photoroom"]');await pg.waitForTimeout(200);
  let s5=await pg.evaluate(()=>({m:ETERNA.fundosModo(),sim:JSON.parse(localStorage.getItem('eterna.sim.v1')).fundosModo}));ok(s5.m==='photoroom'&&s5.sim==='photoroom','5: Photoroom ligado e salvo: '+J(s5));
  await pg.evaluate(async id=>{await ETERNA.compose(id,'mirante');},'ag_'+PIDS.meio);ok(prLog.length===1&&prLog[0].bg==='mirante','5: com Photoroom, a montagem volta a chamar /photoroom/compose: '+J(prLog));
  await pg.click('#fundos-modo [data-m="local"]');await pg.waitForTimeout(200);s5=await pg.evaluate(()=>ETERNA.fundosModo());ok(s5==='local'&&J(modoLog)===J(['photoroom','local']),'5: volta para local e o agente recebe os dois modos: '+J(modoLog));
  await pg.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await pg.waitForTimeout(200);ok(/Recorte local/i.test(await pg.evaluate(()=>document.querySelector('#main').innerText)),'5: Fundos de IA mostra o Recorte local');
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{procs.forEach(p=>{try{p.kill('SIGKILL');}catch(e){}});if(b)await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA v84: recorte local e montagem dos fundos · '+fails.join(' | '));process.exit(1);}
console.log('OK v84: recorte local (ISNet + u2net_human_seg), regras de montagem, impressão com fileHi, 503 e interruptor'+(notas.length?' · '+notas.join(' · '):''));})();
