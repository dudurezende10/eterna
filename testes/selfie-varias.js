// v96.1 (Testador): o aviso "uma pessoa por vez" da selfie da galeria (selfieVarias) usa a régua do servidor do ponto (buscar_em:
// imagem inteira reduzida a 1600, nota >= .7, rosto >= 60 px, segundo rosto >= metade do maior). Antes, com imagem acima de 1000 px,
// o navegador lia também 4 recortes e achava rosto falso no fundo: "várias pessoas" numa selfie em que o agente vê 1.
// Fotos de exemplo ampliadas 2x (1440 px). Com OpenCV no Python, cada foto é lida também pelo YuNet do agente: o navegador nunca pode
// dizer "várias" onde o agente diz 1 (o contrário só deixa o servidor conferir).
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const RAIZ=path.join(__dirname,'..');
const fails=[];const notas=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const b=await chromium.launch();const D=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-sv-'));try{
  const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U);await pg.waitForTimeout(800);
  const r=await pg.evaluate(async()=>{const ids=[...new Set(ETERNA.demoSessions().flatMap(s=>s.photos.map(p=>p.id)))].slice(0,80);const out=[];
    for(const id of ids){const c=await ETERNA.photoCanvas(id);if(!c)continue;const k=document.createElement('canvas');k.width=c.width*2;k.height=c.height*2;k.getContext('2d').drawImage(c,0,0,k.width,k.height);
      out.push({id,varias:await ETERNA.selfieVarias(k),img:k.toDataURL('image/jpeg',.9).split(',')[1],w:k.width});}return out;});
  ok(r.length>=40&&r.every(x=>x.w>1000),'pré: fotos de exemplo ampliadas acima de 1000 px: '+r.length);
  ok(r.some(x=>x.varias),'selfieVarias deveria avisar em pelo menos uma foto com duas pessoas');ok(!errs.length,'erros na página: '+errs.slice(0,2).join(' | '));
  let temCV=true;try{execFileSync('python3',['-c','import cv2'],{stdio:'ignore'});}catch(e){temCV=false;}
  if(!temCV)notas.push('sem OpenCV no Python: comparação com o agente pulada');
  else{r.forEach((x,i)=>fs.writeFileSync(path.join(D,i+'.jpg'),Buffer.from(x.img,'base64')));
    const py=`
import cv2, sys, json
d, n = sys.argv[1], int(sys.argv[2])
det = cv2.FaceDetectorYN.create(sys.argv[3], "", (320, 320), 0.7, 0.3, 5000)
out = []
for i in range(n):
    img = cv2.imread("%s/%d.jpg" % (d, i)); h, w = img.shape[:2]; k = min(1.0, 1600 / max(h, w))
    if k < 1: img = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    det.setInputSize((img.shape[1], img.shape[0])); _, f = det.detect(img)
    ws = sorted([float(x[2]) for x in (f if f is not None else []) if x[2] >= 60], reverse=True)
    out.append(0 if not ws else 2 if len(ws) >= 2 and ws[1] >= 0.5 * ws[0] else 1)
print(json.dumps(out))`;
    const ag=JSON.parse(execFileSync('python3',['-I','-c',py,D,String(r.length),path.join(RAIZ,'vendor','rostos','face_detection_yunet_2023mar.onnx')]).toString());
    const falsos=r.filter((x,i)=>x.varias&&ag[i]===1).map(x=>x.id.slice(0,8));
    ok(!falsos.length,'navegador disse "várias pessoas" onde o agente vê 1: '+falsos.join(','));
    const iguais=r.filter((x,i)=>ag[i]&&x.varias===(ag[i]===2)).length,lidas=ag.filter(Boolean).length;
    ok(iguais>=lidas*.9,'navegador e agente deveriam concordar em 90% das fotos com rosto: '+iguais+' de '+lidas);}
}catch(e){fails.push('erro: '+(e&&e.stack||e).toString().slice(0,400));}
fs.rmSync(D,{recursive:true,force:true});await b.close();const okAll=!fails.length;
console.log(`${okAll?'OK':'FALHA'} selfie-varias: aviso de várias pessoas na selfie da galeria com a régua do agente${notas.length?' · '+notas.join(' · '):''}${fails.length?' · '+fails.slice(0,4).join(' | '):''}`);process.exit(okAll?0:1);})();
