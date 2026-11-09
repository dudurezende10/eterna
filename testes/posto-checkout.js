// Postos pareados com o agente de verdade: o Admin pareia o aparelho no Painel de controle; o Checkout pareado vende sem pessoa
// conectada (sessões, fotos, venda na fila do servidor, galeria); aparelho sem pareamento vê só o aviso da equipe; venda feita com
// o agente fora do ar fica na fila e sobe quando ele volta; sessão que termina no servidor leva a equipe de volta à entrada.
const entrarTeste=require('./_entrar');const S=require('./_agente_sessao');
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const AG=path.join(__dirname,'..','agente','eterna-agente.py');const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function req(porta,method,p,{headers}={}){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:porta,method,path:p,headers:headers||{}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{const t=Buffer.concat(ch).toString();let j=null;try{j=JSON.parse(t)}catch(e){}res({s:rs.statusCode,j});});});r.on('error',e=>res({s:0}));r.end();});}
async function subir(porta,home){const p=spawn('python3',[AG],{env:{...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(porta+1000),ETERNA_APP_ORIGIN:ORIG,ETERNA_SEM_OPENCV:'1',USER:'eterna-teste-sem-cartao',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'},stdio:['ignore','pipe','pipe']});
  let log='';p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);for(let i=0;i<80;i++){await sleep(250);if((await req(porta,'GET','/status')).s===200)return p;}p.kill('SIGKILL');throw new Error('agente não subiu: '+log.slice(-300));}
const sql=(home,q)=>execFileSync('python3',['-c','import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchall();c.commit();print(r)',path.join(home,'Eterna','ponto',q.startsWith('select count(*) from evento')?'vendas.db':'estado.db'),q]).toString().trim();
function vigia(pg,nome){pg.setDefaultTimeout(10000);pg.on('pageerror',e=>errs.push(nome+': '+e.message));return pg;}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await sleep(200);}return false;};
(async()=>{const b=await chromium.launch();const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-posto-'));const porta=20000+Math.floor(Math.random()*900);let ag=null;
try{
  ag=await subir(porta,home);const A=`http://127.0.0.1:${porta}`;const adm=S.sessao(home);
  // 1. aparelho sem pareamento: o Checkout mostra só o aviso da equipe
  {const c=await b.newContext({viewport:{width:1280,height:900}});const K=vigia(await c.newPage(),'K');await K.goto(A+'/#loja');
    ok(await espera(K,()=>ETERNA.state.posto.estado==='nao',15000),'aparelho sem pareamento deveria ficar "nao": '+await K.evaluate(()=>ETERNA.state.posto.estado));
    await espera(K,()=>/ainda não foi pareado/i.test(document.body.innerText),8000);
    const t=await K.evaluate(()=>document.body.innerText);ok(/ainda não foi pareado/i.test(t)&&!(await K.$('[data-act="kiosk-emerg"]')),'Checkout sem pareamento deveria mostrar o aviso: '+t.slice(0,120).replace(/\s+/g,' '));await c.close();}
  // 2. o Admin pareia este aparelho no Painel de controle
  const cA=await b.newContext({viewport:{width:1440,height:900}});await S.noNavegador(cA,porta,[adm]);const PA=vigia(await cA.newPage(),'admin');await PA.goto(A+'/index.html');await PA.waitForTimeout(500);
  ok(await entrarTeste(PA,'eduardo@eduardorezende.com'),'admin entrou');await espera(PA,()=>ETERNA.state.agent.on,15000);
  await PA.evaluate(()=>ETERNA.go('catalogo'));ok(await espera(PA,()=>!!document.querySelector('#postos-painel [data-act="posto-parear"]'),10000),'Painel de controle sem o cartão Postos deste ponto');
  await PA.fill('#posto-nome','Checkout 1');await PA.click('[data-act="posto-parear"]');
  ok(await espera(PA,()=>ETERNA.state.posto.estado==='ok'&&ETERNA.postoDisp()&&ETERNA.postoDisp().nome==='Checkout 1',10000),'parear pela tela: '+J(await PA.evaluate(()=>ETERNA.state.posto)));
  ok(await espera(PA,()=>/Checkout 1/.test(document.querySelector('#postos-painel').textContent)&&/P1/.test(document.querySelector('#postos-painel').textContent),10000),'a lista mostra o posto pareado');
  const ckP=(await cA.cookies()).find(c=>c.name==='eterna_posto');ok(ckP&&ckP.httpOnly&&ckP.sameSite==='Strict','cookie do posto HttpOnly e Strict: '+J(ckP&&{h:ckP.httpOnly,s:ckP.sameSite}));
  ok(await PA.evaluate(()=>ETERNA.pontoModo())==='posto','pontoModo do aparelho pareado: '+await PA.evaluate(()=>ETERNA.pontoModo()));
  // 3. Checkout pareado, sem pessoa conectada: abre, lê sessões, manda a venda, publica galeria; rotas da equipe dão 401 sem derrubar a tela
  const cP=await b.newContext({viewport:{width:1280,height:900}});await cP.addCookies([{name:'eterna_posto',value:ckP.value,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'}]);
  const P=vigia(await cP.newPage(),'posto');await P.goto(A+'/#loja');
  ok(await espera(P,()=>ETERNA.state.agent.on&&ETERNA.state.posto.estado==='ok',15000),'Checkout pareado conectado: '+J(await P.evaluate(()=>({on:ETERNA.state.agent.on,p:ETERNA.state.posto}))));
  ok(await P.evaluate(()=>!!document.querySelector('[data-act="kiosk-emerg"]')&&!/não foi pareado/i.test(document.body.innerText)),'Checkout pareado mostra a tela do cliente');
  const rotas=await P.evaluate(async()=>{const o=location.origin;const st=async(u,op)=>(await ETERNA.agFetch(o+u,op)).status;
    return {sessoes:await st('/sessoes?desde=0'),status:(await (await ETERNA.agFetch(o+'/status')).json()).sessoes?'completo':'minimo',thumb:await st('/thumb/abcdef123456'),
      pub:await st('/galerias/publicar',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"manifesto":{}}'}),bib:await st('/biblioteca'),usu:await st('/ponto/docs?col=usuarios'),
      docs:await (await ETERNA.agFetch(o+'/ponto/docs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({docs:[{col:'sim',id:'prices|zona',valor:1}]})})).json()};});
  ok(rotas.sessoes===200&&rotas.status==='completo'&&rotas.thumb===404&&rotas.pub===400,'rotas do Checkout com o posto: '+J(rotas));
  ok(rotas.bib===401&&rotas.usu===403&&rotas.docs.recusados===1,'posto sem pessoa: sem biblioteca, sem usuários, não grava preço: '+J(rotas));
  await P.evaluate(()=>ETERNA.pvEvento('criar','PT-V1',{saleNo:'P1-001',card:'LPTESTE01',meio:'pix',prov:'pos-manual',total:39,nPh:1,selected:['ag_abcdef123456']}));
  ok(await espera(P,()=>ETERNA.pvFila().length===0,15000),'a venda do posto subiu: fila '+await P.evaluate(()=>ETERNA.pvFila().length));
  ok(/\(1,\)/.test(sql(home,"select count(*) from evento where venda='PT-V1'")),'venda do posto gravada no servidor');
  ok(await P.evaluate(()=>!!document.querySelector('[data-act="kiosk-emerg"]')),'o Checkout seguiu na tela do cliente depois dos 401');
  // 4. venda offline: agente fora, a venda fica na fila; agente de volta, sobe inteira
  ag.kill('SIGKILL');await sleep(800);
  await P.evaluate(()=>{ETERNA.pvEvento('criar','PT-V2',{saleNo:'P1-002',card:'LPTESTE02',meio:'cartao',prov:'pos-manual',total:60,nPh:2});ETERNA.pvEvento('cancelar','PT-V2',{motivo:'desistiu'});});
  await sleep(2500);const fila=await P.evaluate(()=>ETERNA.pvFila().length);ok(fila===2,'sem agente, a fila segura as 2: '+fila);
  ag=await subir(porta,home);
  ok(await espera(P,()=>ETERNA.pvFila().length===0,25000),'com o agente de volta, a fila sobe: '+await P.evaluate(()=>ETERNA.pvFila().length));
  ok(/\(2,\)/.test(sql(home,"select count(*) from evento where venda='PT-V2'")),'as 2 da fila offline gravadas');
  // 5. sessão que termina no servidor: a equipe volta para a entrada com aviso
  await espera(PA,()=>ETERNA.state.agent.on,15000);sql(home,'delete from sessao_login');
  await PA.evaluate(()=>ETERNA.agFetch(location.origin+'/biblioteca'));
  ok(await espera(PA,()=>!ETERNA.state.user,8000),'401 na rota da equipe deveria levar para a entrada');ok(/sessão terminou/i.test(await PA.textContent('#toast').catch(()=>'')),'aviso "Sua sessão terminou"');
  // 6. revogado: o Checkout volta para o aviso da equipe
  const pid=await P.evaluate(()=>ETERNA.postoDisp().id);const adm2=S.sessao(home,'admin-2');
  const rv=await new Promise(res=>{const d=Buffer.from(J({id:pid}));const r=http.request({host:'127.0.0.1',port:porta,method:'POST',path:'/postos/revogar',headers:{'Content-Type':'application/json','Content-Length':d.length,'X-Eterna':'1',Cookie:adm2}},rs=>{rs.resume();rs.on('end',()=>res(rs.statusCode));});r.end(d);});
  ok(rv===200,'revogar: '+rv);await P.evaluate(()=>ETERNA.postoCarregar());
  ok(await espera(P,()=>ETERNA.state.posto.estado==='nao'&&/não foi pareado/i.test(document.body.innerText),8000),'posto revogado volta para o aviso');
  await cA.close();await cP.close();
}catch(e){fails.push('exceção: '+(e.message||e).split('\n')[0]);}
try{ag&&ag.kill('SIGKILL');}catch(e){}await b.close();try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}
const e2=errs.filter(e=>!/Failed to load|ERR_|net::|onnxruntime|40[134]|50[23]/.test(e));const okA=!fails.length&&!e2.length;
console.log(`${okA?'OK':'FALHA'} posto-checkout: pareamento pela tela, Checkout pareado sem pessoa, aviso sem pareamento, venda offline, sessão terminada, revogação${fails.length?' · '+fails.slice(0,8).join(' | '):''}${e2.length?' · erros: '+e2.slice(0,3).join(' | '):''}`);process.exit(okA?0:1);})();
