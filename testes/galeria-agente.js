// Galeria online por QR, agente do ponto (critérios 15 a 20): sobe o agente com HOME temporário, testa as rotas
// /g/* e /galerias/* e as regras de segurança, e derruba o agente no fim.
// Fase A (sempre): sem OpenCV (ETERNA_SEM_OPENCV=1). Fase B (se o Python tiver OpenCV): reconhecimento ligado com
// os modelos de vendor/rostos copiados para o HOME temporário, para testar acesso, pagamento e idempotência.
const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const crypto=require('crypto');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const fails=[];const notas=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function req(porta,method,p,{body,headers={}}={}){return new Promise(res=>{const data=body==null?null:(Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body)));
  const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:{...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const b=Buffer.concat(ch);let j=null;try{j=JSON.parse(b.toString())}catch(e){}res({s:rs.statusCode,b,j,h:rs.headers});});});
  r.on('error',e=>res({s:0,err:String(e)}));if(data)r.write(data);r.end();});}
const tok=()=>crypto.randomBytes(16).toString('base64url');
const ALFA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const cod=()=>{const u=crypto.randomBytes(8);let c='';for(let i=0;i<8;i++){c+=ALFA[u[i]%32];if(i===3)c+='-';}return c;};
const dia=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function manifesto(t,fotos,extra){const cr=new Date();return Object.assign({v:1,token:t,codigo:cod(),tipo:'sessao',venue:'maracana',nome:null,sessoes:['LPTESTE01'],menor:false,criada:cr.toISOString(),expira:new Date(cr.getTime()+60*864e5).toISOString(),precos:{dig:39,todas:250},moeda:'BRL',fotos,envio:{compradas:'pendente',vitrine:'pendente'}},extra||{});}
async function subir(porta,env,home){const p=spawn('python3',[AG],{env:{...process.env,HOME:home,ETERNA_PORTA:String(porta),ETERNA_APP_ORIGIN:'http://127.0.0.1:9',ETERNA_LEITORES:'1',...env},stdio:['ignore','pipe','pipe']});let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);
  for(let i=0;i<60;i++){await sleep(250);const r=await req(porta,'GET','/status');if(r.s===200)return {p,log:()=>log};}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-400));}
function fotosNoInbox(home,itens){const d=path.join(home,'Eterna','inbox',dia());fs.mkdirSync(d,{recursive:true});for(const [pid,buf] of itens)fs.writeFileSync(path.join(d,pid+'_IMG.jpg'),buf);}
function jpegsLisos(n){const out=execFileSync('python3',['-c',`
import sys,io,base64
from PIL import Image
for i in range(${n}):
    b=io.BytesIO();Image.new('RGB',(1600,1067),(30+i*40,90,160)).save(b,'JPEG',quality=85);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n');return out.map(x=>Buffer.from(x,'base64'));}
const lerManifesto=(home,t)=>JSON.parse(fs.readFileSync(path.join(home,'Eterna','galerias',t,'sessao.json'),'utf8'));
const segredo=home=>Buffer.from(JSON.parse(fs.readFileSync(path.join(home,'Eterna','galeria-segredo.json'),'utf8')).segredo,'hex');
const assinar=(home,t,pid,v,exp)=>crypto.createHmac('sha256',segredo(home)).update(`${t}|${pid}|${v}|${exp}`).digest('hex');
async function esperarEnvio(porta,home,t){for(let i=0;i<80;i++){try{const m=lerManifesto(home,t);if(m.envio&&m.envio.vitrine==='ok'&&m.envio.compradas==='ok')return m;}catch(e){}await sleep(250);}return lerManifesto(home,t);}

(async()=>{const procs=[];const homes=[];
try{
  // ---------------- Fase A: sem OpenCV ----------------
  const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-ag-'));homes.push(H);const P=8799;
  const pids=['a1b2c3d4e5f6','0a1b2c3d4e5f','f6e5d4c3b2a1','1234567890ab'];fotosNoInbox(H,pids.map((p,i)=>[p,jpegsLisos(4)[i]]));
  const A=await subir(P,{ETERNA_SEM_OPENCV:'1'},H);procs.push(A.p);
  const st=(await req(P,'GET','/status')).j;ok(st&&st.galerias&&st.galerias.vitrine_marca===false,'15: /status sem galerias.vitrine_marca:false');ok(st&&st.rostos&&st.rostos.ligado===false,'pré: reconhecimento deveria estar desligado');
  const T=tok();const fotos=[{id:'ag_'+pids[0],sessao:'LPTESTE01',direito:'comprada',canal:'loja'},{id:'ag_'+pids[1],sessao:'LPTESTE01',direito:'cortesia',canal:null,cortesia:{motivo:'escola',por:'eduardo@eduardorezende.com',em:new Date().toISOString()}},{id:'ag_'+pids[2],sessao:'LPTESTE01',direito:'venda',canal:null},{id:'ag_'+pids[3],sessao:'LPTESTE01',direito:'venda',canal:null}];
  const M=manifesto(T,fotos);
  // 15. origem
  let r=await req(P,'POST','/galerias/publicar',{body:{manifesto:M},headers:{Origin:'https://evil.example'}});ok(r.s===403,'15: publicar com Origin evil deveria dar 403, deu '+r.s);
  ok(!fs.existsSync(path.join(H,'Eterna','galerias',T)),'15: publicar recusado não pode gravar');
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:M}});ok(r.s===200&&r.j&&r.j.ok&&r.j.token===T,'15: publicar sem Origin deveria dar 200, deu '+r.s);
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:M},headers:{Origin:'http://127.0.0.1:'+P}});ok(r.s===200,'15: publicar com origem local deveria dar 200, deu '+r.s);
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:M},headers:{Origin:'http://127.0.0.1:'+P+'0'}});ok(r.s===403,'15: origem parecida com a local deveria dar 403, deu '+r.s);
  r=await req(P,'GET','/galerias/vendas?desde=0',{headers:{Origin:'https://evil.example'}});ok(r.s===403,'15: vendas com Origin evil deveria dar 403, deu '+r.s);
  r=await req(P,'GET','/galerias/vendas?desde=0',{headers:{Host:'evil.example:'+P}});ok(r.s===403,'S8: DNS rebinding (Host de outro domínio) deveria dar 403, deu '+r.s);
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:M},headers:{Host:'evil.example'}});ok(r.s===403,'S8: publicar com Host de outro domínio deveria dar 403, deu '+r.s);
  // S9: rotas de foto e de rosto sem CORS aberto
  r=await req(P,'GET','/biblioteca',{headers:{Origin:'https://evil.example'}});ok(r.s===403&&!r.h['access-control-allow-origin'],'S9: /biblioteca com Origin evil deveria dar 403 sem CORS, deu '+r.s);
  r=await req(P,'GET','/biblioteca',{headers:{Origin:'http://127.0.0.1:9'}});ok(r.s===200&&r.h['access-control-allow-origin']==='http://127.0.0.1:9'&&r.h['access-control-allow-private-network']==='true','S9: /biblioteca deveria aceitar a origem do app publicado (ETERNA_APP_ORIGIN), deu '+r.s);
  r=await req(P,'GET','/biblioteca');ok(r.s===200&&!r.h['access-control-allow-origin'],'S9: /biblioteca sem Origin (mesma origem) não deveria mandar CORS');
  r=await req(P,'GET','/thumb/'+pids[2],{headers:{Origin:'https://evil.example'}});ok(r.s===403,'S9: /thumb com Origin evil deveria dar 403, deu '+r.s);
  r=await req(P,'GET','/file/'+pids[2],{headers:{Origin:'https://evil.example'}});ok(r.s===403,'S9: /file com Origin evil deveria dar 403, deu '+r.s);
  r=await req(P,'POST','/rostos/buscar',{body:{imagens:[]},headers:{Origin:'http://127.0.0.1:9'}});ok(r.s===403,'S9: /rostos/buscar só aceita a origem local, deu '+r.s);
  r=await req(P,'OPTIONS','/file/'+pids[2],{headers:{Origin:'https://evil.example','Access-Control-Request-Method':'GET'}});ok(!r.h['access-control-allow-origin']&&!r.h['access-control-allow-private-network'],'S9: preflight de /file não pode liberar outra origem');
  r=await req(P,'POST','/galerias/publicar',{body:{manifesto:{...M,token:'../../etc'}}});ok(r.s===400,'15: manifesto com token inválido deveria dar 400, deu '+r.s);
  const MM=await esperarEnvio(P,H,T);ok(MM.envio.vitrine==='ok'&&MM.envio.compradas==='ok','pré: envio deveria ficar ok: '+JSON.stringify(MM.envio));
  ok(fs.existsSync(path.join(H,'Eterna','galerias',T,'original',pids[0]+'.jpg'))&&fs.existsSync(path.join(H,'Eterna','galerias',T,'original',pids[1]+'.jpg')),'pré: originais da comprada e da cortesia deveriam subir');
  ok(!fs.existsSync(path.join(H,'Eterna','galerias',T,'original',pids[2]+'.jpg')),'pré: original de foto à venda não pode subir');
  // 16. info
  r=await req(P,'GET','/g/'+T+'/info');ok(r.s===200&&r.j.ok&&r.j.estado==='pronta','16: info deveria dar 200 pronta, deu '+r.s+' '+(r.b||'').toString().slice(0,120));
  ok(r.j&&!('sessoes' in r.j)&&!('fotos' in r.j)&&!('codigo' in r.j),'16: info expõe sessoes/fotos/codigo: '+JSON.stringify(r.j));
  for(const p of ['/g/../info','/g/..%2F..%2Fetc%2Fpasswd/info','/g/'+T.slice(0,21)+'/info','/g/'+T+'x/info','/g/'+'../../../../etc/passwd'+'/info']){r=await req(P,'GET',p);ok(r.s===404,'16: '+p+' deveria dar 404, deu '+r.s);}
  const TE=tok();await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(TE,fotos.slice(2),{expira:new Date(Date.now()-1000).toISOString()})}});
  r=await req(P,'GET','/g/'+TE+'/info');ok(r.s===410,'16: manifesto expirado deveria dar 410, deu '+r.s);
  r=await req(P,'GET','/g/'+tok()+'/info');ok(r.s===404,'16: token inexistente deveria dar 404, deu '+r.s);
  r=await req(P,'GET','/g/codigo/'+M.codigo);ok(r.s===200&&r.j.token===T,'16: código curto deveria devolver o token');
  // S2 e NOTA 2: encerrar não é desfeito ao republicar; código de galeria encerrada não devolve token
  const TX=tok();const MX=manifesto(TX,fotos.slice(2));await req(P,'POST','/galerias/publicar',{body:{manifesto:MX}});
  r=await req(P,'POST','/galerias/encerrar',{body:{token:TX}});ok(r.s===200,'S2: encerrar deveria dar 200, deu '+r.s);
  await req(P,'POST','/galerias/publicar',{body:{manifesto:MX}});r=await req(P,'GET','/g/'+TX+'/info');ok(r.s===410,'S2: republicar desfez o encerrar, info deu '+r.s);
  const MX2=manifesto(TX,fotos.slice(2),{expira:new Date(Date.now()+120*864e5).toISOString()});await req(P,'POST','/galerias/publicar',{body:{manifesto:MX2}});r=await req(P,'GET','/g/'+TX+'/info');ok(r.s===410,'S2: republicar com validade maior desfez o encerrar, deu '+r.s);
  r=await req(P,'GET','/g/codigo/'+MX.codigo);ok(r.s===404,'NOTA 2: código de galeria encerrada deveria dar 404, deu '+r.s);
  r=await req(P,'GET','/g/codigo/'+manifesto(TE,[]).codigo);ok(r.s===404,'NOTA 2: código inexistente 404');
  // 17. foto assinada
  const exp=Math.floor(Date.now()/1000)+600;const url=(pid,v,e,sig)=>`/g/${T}/foto/${pid}?v=${v}&exp=${e}`+(sig==null?'':`&sig=${sig}`);
  r=await req(P,'GET',url(pids[2],'vitrine',exp,assinar(H,T,pids[2],'vitrine',exp)));ok(r.s===200&&r.h['content-type']==='image/jpeg','17: vitrine assinada deveria dar 200, deu '+r.s);
  r=await req(P,'GET',url(pids[0],'original',exp,assinar(H,T,pids[0],'original',exp)));ok(r.s===200,'17: original de foto comprada assinado deveria dar 200, deu '+r.s);
  r=await req(P,'GET',url(pids[2],'vitrine',exp,null));ok(r.s===403,'17: sem sig deveria dar 403, deu '+r.s);
  r=await req(P,'GET',url(pids[2],'vitrine',exp,'%C3%A9'.repeat(32)));ok(r.s===403,'NOTA 1: sig fora do formato deveria dar 403 sem derrubar a conexão, deu '+r.s);
  r=await req(P,'GET',url(pids[2],'vitrine',exp,'zz'));ok(r.s===403,'NOTA 1: sig curta deveria dar 403, deu '+r.s);
  const s0=assinar(H,T,pids[2],'vitrine',exp);r=await req(P,'GET',url(pids[2],'vitrine',exp,s0.slice(0,-1)+(s0.slice(-1)==='0'?'1':'0')));ok(r.s===403,'17: sig alterada deveria dar 403, deu '+r.s);
  const ev=Math.floor(Date.now()/1000)-5;r=await req(P,'GET',url(pids[2],'vitrine',ev,assinar(H,T,pids[2],'vitrine',ev)));ok(r.s===403,'17: exp vencido deveria dar 403, deu '+r.s);
  r=await req(P,'GET',url(pids[2],'original',exp,s0));ok(r.s===403,'17: trocar v=vitrine por v=original deveria dar 403, deu '+r.s);
  r=await req(P,'GET',url(pids[2],'original',exp,assinar(H,T,pids[2],'original',exp)));ok(r.s===403,'17: original de foto à venda, mesmo assinado, deveria dar 403, deu '+r.s);
  r=await req(P,'GET',`/g/${TE}/foto/${pids[2]}?v=vitrine&exp=${exp}&sig=${assinar(H,TE,pids[2],'vitrine',exp)}`);ok(r.s===403,'17: assinatura de outro token não vale, deu '+r.s);
  r=await req(P,'GET',url('ffffffffffff','vitrine',exp,assinar(H,T,'ffffffffffff','vitrine',exp)));ok(r.s===403,'17: pid fora do token deveria dar 403, deu '+r.s);
  // 18. rosto sem OpenCV
  r=await req(P,'POST','/g/'+T+'/rosto',{body:{versao:'2026-10-27',idioma:'pt',imagem:'data:image/jpeg;base64,AAAA'}});ok(r.s===400,'18: sem consentimento deveria dar 400, deu '+r.s);
  r=await req(P,'POST','/g/'+T+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:'data:image/jpeg;base64,'+jpegsLisos(1)[0].toString('base64')}});
  ok(r.s===503&&r.j&&r.j.motivo==='processando'&&!r.j.acesso&&!r.j.galeria,'18: sem OpenCV deveria dar 503 processando sem acesso, deu '+r.s+' '+JSON.stringify(r.j));
  r=await req(P,'POST','/g/'+T+'/rosto',{body:'{"consentimento":true,"imagem":"'+'A'.repeat(2*1024*1024+10)+'"}'});ok(r.s===413,'18: corpo acima de 2 MB deveria dar 413, deu '+r.s);
  ok(!fs.existsSync(path.join(H,'Eterna','galerias','consentimentos.jsonl'))||!/data:image/.test(fs.readFileSync(path.join(H,'Eterna','galerias','consentimentos.jsonl'),'utf8')),'18: imagem não pode ir para o log de consentimento');
  // 19. acesso forjado
  r=await req(P,'POST','/g/'+T+'/pagamento',{body:{acesso:'forjado-'+crypto.randomBytes(12).toString('hex'),pids:['ag_'+pids[2]],metodo:'pix',idem:crypto.randomUUID()}});ok(r.s===401,'19: acesso forjado deveria dar 401, deu '+r.s);
  r=await req(P,'POST','/g/'+T+'/galeria',{body:{acesso:'x'}});ok(r.s===401,'19: galeria com acesso forjado deveria dar 401, deu '+r.s);
  r=await req(P,'POST','/pagamento/webhook/mercadopago',{body:{}});ok(r.s===501,'19: webhook reservado deveria dar 501, deu '+r.s);
  // 20. comprada online não regride
  const T2=tok();const f2=[{id:'ag_'+pids[2],sessao:'LPTESTE01',direito:'comprada',canal:'online'},{id:'ag_'+pids[3],sessao:'LPTESTE01',direito:'venda',canal:null}];
  await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(T2,f2)}});
  await req(P,'POST','/galerias/publicar',{body:{manifesto:manifesto(T2,[{...f2[0],direito:'venda',canal:null},f2[1]])}});
  const m2=lerManifesto(H,T2);const x2=m2.fotos.find(f=>f.id==='ag_'+pids[2]);ok(x2&&x2.direito==='comprada'&&x2.canal==='online','20: republicar com venda deveria manter comprada: '+JSON.stringify(x2));
  r=await req(P,'GET','/galerias/status');ok(r.s===200&&Array.isArray(r.j.galerias)&&r.j.galerias.every(g=>!('token' in g)),'pré: /galerias/status deveria listar só token8');
  {const net=require('net');const socks=[];for(let i=0;i<20;i++){const s=net.connect(P,'127.0.0.1');s.on('error',()=>{});s.write('POST /g/'+T+'/rosto HTTP/1.1\r\nHost: 127.0.0.1:'+P+'\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n');socks.push(s);}
    r=await req(P,'GET','/status');ok(r.s===200,'S6: o agente parou de responder com conexões presas');socks.forEach(s=>s.destroy());}
  A.p.kill('SIGTERM');

  // ---------------- Fase B: reconhecimento ligado (OpenCV) ----------------
  let temCV=true;try{execFileSync('python3',['-c','import cv2, numpy'],{stdio:'ignore'});}catch(e){temCV=false;}
  if(!temCV){notas.push('fase B pulada: Python sem OpenCV');}
  else{const H2=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-ag-'));homes.push(H2);const P2=8798;
    fs.mkdirSync(path.join(H2,'Eterna','modelos'),{recursive:true});for(const f of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',f),path.join(H2,'Eterna','modelos',f));
    // fotos com rosto: fotos de exemplo do app, ampliadas (o servidor de testes do rodar.sh serve o index.html)
    const {chromium}=require('playwright');const b=await chromium.launch();const pg=await b.newPage();await pg.goto(process.env.U||'http://127.0.0.1:8890/index.html');await pg.waitForTimeout(500);
    const imgs=await pg.evaluate(async()=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const ss=ETERNA.demoSessions().filter(s=>s.photos.length>=3);const pick=[];
      const keys=new Set();for(const s of ss){if(keys.has(s.key))continue;const id=s.photos.map(p=>p.id).find(id=>(ETERNA.FACEIDX[id]||[]).length===1);if(id){pick.push(id);keys.add(s.key);}if(pick.length>=3)break;}
      const out=[];for(const id of pick){const c=await ETERNA.photoCanvas(id);const k=document.createElement('canvas');k.width=c.width*2;k.height=c.height*2;k.getContext('2d').drawImage(c,0,0,k.width,k.height);out.push(k.toDataURL('image/jpeg',.88));}return out;});
    await b.close();
    const bufs=imgs.map(u=>Buffer.from(u.split(',')[1],'base64'));const pp=['b1b2b3b4b5b6','c1c2c3c4c5c6','e1e2e3e4e5e6'];fotosNoInbox(H2,pp.map((p,i)=>[p,bufs[i]]).concat([['d1d2d3d4d5d6',jpegsLisos(1)[0]]]));
    const B=await subir(P2,{},H2);procs.push(B.p);let lig=false;
    for(let i=0;i<160;i++){const s=(await req(P2,'GET','/status')).j;if(s&&s.rostos&&s.rostos.ligado&&s.rostos.lidas>=4){lig=true;break;}await sleep(500);}
    if(!lig){notas.push('fase B: reconhecimento não ligou ('+B.log().slice(-200).replace(/\n/g,' ')+')');}
    else{const T3=tok();const f3=[{id:'ag_'+pp[0],sessao:'LPB',direito:'comprada',canal:'loja'},{id:'ag_'+pp[1],sessao:'LPB',direito:'venda',canal:null},{id:'ag_d1d2d3d4d5d6',sessao:'LPB',direito:'venda',canal:null}];
      await req(P2,'POST','/galerias/publicar',{body:{manifesto:manifesto(T3,f3,{sessoes:['LPB'],precos:{dig:39,todas:60}})}});await esperarEnvio(P2,H2,T3);
      r=await req(P2,'POST','/g/'+T3+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:'data:image/jpeg;base64,'+jpegsLisos(1)[0].toString('base64')}});
      ok(r.s===200&&r.j.ok===false&&r.j.motivo==='sem_rosto'&&r.j.restam===4,'18b: imagem sem rosto deveria dar sem_rosto com restam 4: '+r.s+' '+JSON.stringify(r.j));
      // S5: PNG pequeno que declara 20000 x 20000 é recusado sem decodificar
      {const png=Buffer.alloc(33+100);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png,0);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(20000,16);png.writeUInt32BE(20000,20);png[24]=8;png[25]=2;
        const t0=Date.now();r=await req(P2,'POST','/g/'+T3+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:'data:image/png;base64,'+png.toString('base64')}});
        ok(r.s===200&&r.j.motivo==='sem_rosto'&&Date.now()-t0<5000,'S5: imagem de 400 MP deveria ser recusada: '+r.s+' '+JSON.stringify(r.j));ok((await req(P2,'GET','/status')).s===200,'S5: o agente caiu com a imagem enorme');}
      r=await req(P2,'POST','/g/'+T3+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:'data:image/jpeg;base64,'+bufs[0].toString('base64')}});
      if(!(r.s===200&&r.j.ok)){notas.push('fase B: o rosto não bateu ('+r.s+' '+JSON.stringify(r.j)+'): pagamento não testado');}
      else{const ac=r.j.acesso;const g=r.j.galeria;ok(g.fotos.length===3&&g.fotos.find(f=>f.direito==='comprada').original&&!g.fotos.find(f=>f.direito==='venda').original,'19b: galeria deveria ter original só da comprada');
        const vit=g.fotos.find(f=>f.direito==='venda').vitrine;r=await req(P2,'GET',vit);ok(r.s===200,'19b: link de vitrine devolvido deveria abrir, deu '+r.s);
        const cs=fs.readFileSync(path.join(H2,'Eterna','galerias','consentimentos.jsonl'),'utf8');ok(/"tipo": "titular"/.test(cs)&&!/data:image|base64/.test(cs),'19b: consentimento registrado sem imagem');
        const idem=crypto.randomUUID();const corpo={acesso:ac,pids:['ag_'+pp[1]],metodo:'pix',idem,total:1};
        r=await req(P2,'POST','/g/'+T3+'/pagamento',{body:corpo});ok(r.s===200&&r.j.ok&&r.j.pedido.total===39&&r.j.pedido.status==='aprovado'&&r.j.pedido.teste===true,'19: total do cliente deveria ser ignorado (39) e a venda simulada marcada como teste, veio '+JSON.stringify(r.j&&r.j.pedido));
        ok(r.j&&r.j.galeria.fotos.find(f=>f.pid==='ag_'+pp[1]).direito==='comprada','19: foto paga deveria virar comprada');
        r=await req(P2,'POST','/g/'+T3+'/pagamento',{body:corpo});ok(r.s===200&&r.j.ok,'19: repetir o idem deveria responder ok');
        const vs=(await req(P2,'GET','/galerias/vendas?desde=0')).j.vendas;ok(vs.length===1&&vs[0].canal==='online'&&vs[0].total===39&&vs[0].teste===true,'19: mesmo idem deveria registrar uma venda só: '+JSON.stringify(vs));
        r=await req(P2,'POST','/g/'+T3+'/pagamento',{body:{acesso:ac,pids:['ag_'+pp[1]],metodo:'pix',idem:crypto.randomUUID()}});ok(r.s===400,'19: foto já comprada não está à venda (400), deu '+r.s);
        r=await req(P2,'POST','/g/'+T3+'/pagamento',{body:{acesso:ac,pids:['ag_ffffffffffff'],metodo:'pix',idem:crypto.randomUUID()}});ok(r.s===400,'19: pid fora do acesso deveria dar 400, deu '+r.s);
        // 20 (b): republicar do app com a foto comprada online como venda mantém comprada
        await req(P2,'POST','/galerias/publicar',{body:{manifesto:manifesto(T3,f3.map(f=>({...f,direito:f.direito==='comprada'?'comprada':'venda',canal:f.direito==='comprada'?'loja':null})),{sessoes:['LPB'],precos:{dig:39,todas:60}})}});
        const m3=lerManifesto(H2,T3);ok(m3.fotos.find(f=>f.id==='ag_'+pp[1]).direito==='comprada','20: compra online regrediu depois de republicar');}
      // S1: grupo de escola: no máximo 2 crianças diferentes por (ip, token) em 24 h; a mesma criança de novo continua valendo
      const T4=tok();await req(P2,'POST','/galerias/publicar',{body:{manifesto:manifesto(T4,pp.map(p=>({id:'ag_'+p,sessao:'LPB',direito:'venda',canal:null})),{tipo:'evento',nome:'Escola',menor:true,sessoes:['LPB']})}});await esperarEnvio(P2,H2,T4);
      const sel=async b=>(await req(P2,'POST','/g/'+T4+'/rosto',{body:{consentimento:true,versao:'2026-10-27',idioma:'pt',imagem:'data:image/jpeg;base64,'+b.toString('base64')}}));
      const e1=await sel(bufs[0]),e2=await sel(bufs[1]),e3=await sel(bufs[2]),e4=await sel(bufs[0]);
      const so=x=>x.s+(x.j&&x.j.galeria?':'+x.j.galeria.fotos.map(f=>f.pid).join(','):'')+(x.j&&x.j.motivo?':'+x.j.motivo:'');
      if(!(e1.s===200&&e1.j.ok&&e2.s===200&&e2.j.ok))notas.push('S1: os rostos de teste não bateram no grupo ('+so(e1)+' '+so(e2)+')');
      else{ok(e1.j.galeria.fotos.every(f=>f.pid==='ag_'+pp[0])&&e2.j.galeria.fotos.every(f=>f.pid==='ag_'+pp[1]),'S1: evento abriu fotos de outra criança: '+so(e1)+' '+so(e2));
        ok(e3.s===429&&e3.j.motivo==='bloqueado','S1: a terceira criança diferente do mesmo IP deveria dar 429, deu '+so(e3));ok(e4.s===200&&e4.j.ok,'S1: a mesma criança de novo deveria abrir, deu '+so(e4));
        const cs=fs.readFileSync(path.join(H2,'Eterna','galerias','consentimentos.jsonl'),'utf8');ok(/"tipo": "responsavel"/.test(cs),'S1: consentimento do responsável no grupo');}}
    B.p.kill('SIGTERM');}
}catch(e){fails.push('erro: '+(e&&e.stack||e));}
finally{for(const p of procs){try{p.kill('SIGKILL')}catch(e){}}for(const h of homes){try{fs.rmSync(h,{recursive:true,force:true})}catch(e){}}}
const okAll=!fails.length;console.log(`${okAll?'OK':'FALHA'} galeria-agente: critérios 15 a 20${notas.length?' · '+notas.join(' · '):''}${fails.length?' · '+fails.slice(0,6).join(' | '):''}`);process.exit(okAll?0:1);})();
