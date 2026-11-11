// v96-ux: Minhas fotos, envio manual das fotos do cartão (critérios 1 a 15 do plano docs/planos/2026-11-11-minhas-fotos-envio-manual.md,
// com a decisão do Eduardo de 11/11: a Supervisora também envia, escolhendo o fotógrafo como o Admin).
// Parte A: agente falso por page.route na própria origem (/status com e sem "envio", /fotos/enviar com respostas por nome).
// Parte B: agente DE VERDADE (testes/_envio_lanca.py, HOME temporário, porta 45xxx) servindo o app: 6 fotos geradas aqui entram
// e a sessão atrasada do Carlos aparece em Minhas fotos. Nunca foto de cliente: JPEG liso gerado por Pillow.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const TEC=/127\.0\.0\.1|8765|porta|python|Terminal(?! Campo)|~\/Eterna|\.py\b|FTP/i;
const arq=(name,body)=>({name,mimeType:/\.png$/.test(name)?'image/png':'image/jpeg',buffer:body||PX});
// agente falso: M.resp(nome, tentativa) devolve {status, body} ou 'abort'; M.posts guarda {nome, quem, t}
function novoM(){return {posts:[],resp:null,atraso:0,status:{}};}
async function agente(ctx,M,base){base=base||ORIG;
  await ctx.route(base+'/status',r=>{const st={ok:true,agent:'eterna-agente',version:3,boot:'bE',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gE',hoje:0,abertas:0},envio:{v:1,max_mb:60,novas:0,repetidas:0,recusadas:0},...M.status};if(M.antigo)delete st.envio;
    r.fulfill({status:200,contentType:'application/json',body:J(st)});});
  await ctx.route(base+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(base+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(base+'/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"grupos":[]}'}));
  await ctx.route(base+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'gE',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]})}));
  await ctx.route(base+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  await ctx.route(base+'/fotos/enviar*',async r=>{const u=new URL(r.request().url());const nome=u.searchParams.get('nome'),quem=u.searchParams.get('quem');
    const h=r.request().headers();const n=M.posts.filter(p=>p.nome===nome).length+1;M.posts.push({nome,quem,t:Date.now(),xe:h['x-eterna'],ct:h['content-type']});
    if(M.atraso)await sleep(M.atraso);const x=M.resp?M.resp(nome,n):null;
    if(x==='abort')return r.abort('connectionreset');const st=x&&x.status||200;const body=x&&x.body||{ok:true,resultado:'new'};
    r.fulfill({status:st,contentType:'application/json',body:J(body)});});}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(250);
  if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(250);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(400);}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(100);}return false;};
const abrir=async pg=>{await pg.evaluate(()=>ETERNA.go('importar'));await espera(pg,()=>ETERNA.state.agent.tried||ETERNA.state.agent.on,6000);await pg.waitForTimeout(150);
  const l=await pg.$('#main [data-act="envio-abrir"]');if(l){await l.click();await pg.waitForTimeout(120);}return !!l;};
const faixa=pg=>pg.evaluate(()=>{const f=document.querySelector('#main .up-faixa');return f?{cls:f.className,t:f.innerText.replace(/\s+/g,' ').trim()}:null;});
// "Escolher fotos" abre o seletor do sistema (input único fora do #main, que o render não troca)
const escolher=async(pg,files)=>{const [fc]=await Promise.all([pg.waitForEvent('filechooser',{timeout:5000}),pg.click('#envio-painel [data-act="envio-escolher"]')]);await fc.setFiles(files);};
const fim=pg=>espera(pg,()=>!ETERNA.state.imp.envio&&!!ETERNA.state.imp.envioFim,30000);
const livre=()=>new Promise(r=>{const t=()=>{const p=45000+Math.floor(Math.random()*1000);const s=net.createServer();s.once('error',()=>t());s.listen(p,'127.0.0.1',()=>s.close(()=>r(p)));};t();});
function post(porta,p,body,headers){return new Promise(res=>{const data=Buffer.from(J(body));const r=http.request({host:'127.0.0.1',port:porta,method:'POST',path:p,headers:{'Content-Type':'application/json','Content-Length':data.length,...(headers||{})}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>res({s:rs.statusCode}));});r.on('error',()=>res({s:0}));r.write(data);r.end();});}
function get(porta,p){return new Promise(res=>{http.get({host:'127.0.0.1',port:porta,path:p},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{let j=null;try{j=JSON.parse(Buffer.concat(ch).toString())}catch(e){}res({s:rs.statusCode,j});});}).on('error',()=>res({s:0}));});}

(async()=>{const b=await chromium.launch();const errs=[];let proc=null;const HB=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-envio-app-'));let LOGA='';
const nova=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1366,height:h||900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  pg.on('dialog',d=>d.dismiss().catch(()=>{}));return {ctx,pg};};
try{
  // ---------- 1, 6, 7, 9, 14, 15: Carlos com agente ----------
  {const {ctx,pg}=await nova();const M=novoM();await agente(ctx,M);await entrar(pg,'carlos@eterna.photo');
    await espera(pg,()=>ETERNA.state.agent.on&&!!ETERNA.state.agent.envio);
    const lk=await pg.evaluate(()=>{const l=document.querySelector('#main [data-act="envio-abrir"]');return l?{t:l.textContent,n:(l.parentElement.querySelector('.note')||{}).textContent}:null;});
    ok(lk&&lk.t==='Enviar fotos do cartão manualmente'&&lk.n==='Use só se o cartão não foi lido.','1: link e nota: '+J(lk));
    ok(!(await pg.$('#main .envio-drop')),'1: área só depois de abrir');
    await pg.click('#main [data-act="envio-abrir"]');await pg.waitForTimeout(100);
    const a1=await pg.evaluate(()=>({d:(document.querySelector('#main .envio-drop')||{}).textContent,b:[...document.querySelectorAll('#envio-painel .btn')].map(x=>x.textContent.trim()),i:!!document.querySelector('#envio-painel [data-act="envio-escolher"]')}));
    ok(a1.d==='Solte aqui as fotos do cartão'&&a1.b.includes('Escolher fotos')&&a1.i,'1: área e Escolher fotos: '+J(a1));
    ok(!TEC.test(await pg.evaluate(()=>document.body.innerText)),'D2: texto técnico com o painel aberto');
    // 6: 4 JPEG + 1 .png + 1 .txt renomeado (agente responde 415)
    M.atraso=250;M.resp=n=>n==='f.jpg'?{status:415,body:{erro:'nao_jpeg'}}:null;
    await escolher(pg,[arq('a.jpg'),arq('b.jpg'),arq('c.jpg'),arq('d.jpg'),arq('e.png'),arq('f.jpg',Buffer.from('texto'))]);
    ok(await espera(pg,()=>/Enviando \d+ de 6/.test((document.querySelector('#main .up-faixa.warn')||{}).textContent||''),4000),'6: faixa "Enviando N de 6"');
    const dis=await pg.evaluate(()=>(document.querySelector('#main .envio-drop')||{}).getAttribute('aria-disabled'));ok(dis==='true','6: área desativada durante o envio: '+dis);
    ok(!!(await pg.$('#envio-painel [data-act="envio-parar"]')),'6: botão Parar durante o envio');
    ok(await fim(pg),'6: envio termina');const f6=await faixa(pg);
    ok(f6&&/ok/.test(f6.cls)&&/Enviadas 4 de 6/.test(f6.t)&&/2 não eram foto/.test(f6.t),'6: faixa final: '+J(f6));
    const fl=await pg.$$eval('#envio-painel .envio-falhas li',x=>x.map(e=>e.textContent));
    ok(fl.length===2&&fl.some(x=>/^e\.png/.test(x))&&fl.some(x=>/^f\.jpg/.test(x)),'6: lista de recusadas: '+J(fl));
    ok(M.posts.length===5&&!M.posts.some(p=>p.nome==='e.png'),'6: só 5 POSTs e sem o .png: '+J(M.posts.map(p=>p.nome)));
    ok(M.posts.every(p=>p.quem==='carlos'&&p.xe==='1'&&p.ct==='image/jpeg'),'6: POST com quem=carlos, X-Eterna e image/jpeg: '+J(M.posts[0]));
    ok(J(M.posts.map(p=>p.nome).slice(0,2).sort())===J(['a.jpg','b.jpg']),'decisão 10: em ordem de nome');
    // 14: auditLog sem nome de arquivo
    const au=await pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='fotos_envio_manual'));
    ok(au.length===1&&au[0].alvo==='carlos'&&au[0].mudancas[0].para===4&&au[0].total===6&&!/\.jpg|\.png/.test(J(au)),'14: auditLog: '+J(au));
    // 7: extensões do cartão
    M.posts.length=0;M.atraso=0;M.resp=null;
    await escolher(pg,[arq('foto.Jpg'),arq('A.JPG'),arq('b.jpeg'),arq('C.JPEG'),arq('d.jpg')]);await fim(pg);
    ok(J(M.posts.map(p=>p.nome).sort())===J(['A.JPG','C.JPEG','b.jpeg','d.jpg']),'7: enviados: '+J(M.posts.map(p=>p.nome)));
    const f7=await faixa(pg);ok(/Enviadas 4 de 5/.test(f7.t)&&/1 não era foto/.test(f7.t),'7: foto.Jpg conta como não era foto: '+J(f7));
    // 9: dup
    M.posts.length=0;M.resp=n=>n==='x2.jpg'?{status:200,body:{ok:true,resultado:'dup'}}:null;
    await escolher(pg,[arq('x1.jpg'),arq('x2.jpg')]);await fim(pg);
    const f9=await faixa(pg);ok(/ok/.test(f9.cls)&&/Enviadas 1 de 2/.test(f9.t)&&/1 já estava no servidor/.test(f9.t)&&!/não entr/.test(f9.t),'9: dup não é erro: '+J(f9));
    ok(!(await pg.$('#envio-painel .envio-falhas')),'9: dup fora da lista de recusadas');
    // 8: soltar 2 JPEG na área; soltar fora não sai do app
    M.posts.length=0;M.resp=null;const href=await pg.evaluate(()=>location.href);
    const dr=await pg.evaluate(()=>{const z=document.querySelector('#main .envio-drop');const dt=new DataTransfer();['s1.jpg','s2.jpg'].forEach(n=>dt.items.add(new File([new Uint8Array([255,216,255,217])],n,{type:'image/jpeg'})));
      const ov=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt});z.dispatchEvent(ov);const on=z.classList.contains('on');
      const d=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt});z.dispatchEvent(d);
      const dt2=new DataTransfer();dt2.items.add(new File([new Uint8Array([1])],'fora.jpg',{type:'image/jpeg'}));const d2=new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt2});const h1=document.querySelector('#main h1');h1.dispatchEvent(d2);
      const o2=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt2});h1.dispatchEvent(o2);
      return {on,dp:d.defaultPrevented,fora:d2.defaultPrevented,foraOver:o2.defaultPrevented};});
    await fim(pg);await pg.waitForTimeout(100);
    ok(dr.on&&dr.dp&&J(M.posts.map(p=>p.nome).sort())===J(['s1.jpg','s2.jpg']),'8: soltar 2 na área envia 2: '+J({dr,p:M.posts.map(p=>p.nome)}));
    ok(dr.fora&&dr.foraOver&&await pg.evaluate(()=>location.href)===href,'8: soltar fora não navega: '+J(dr));
    // 15: sem rolagem lateral com o painel aberto
    for(const w of [390,768,1366]){await pg.setViewportSize({width:w,height:900});await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(80);
      const sx=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(sx<=1&&!!(await pg.$('#envio-painel')),'15: rolagem lateral em '+w+' px: '+sx);}
    await pg.setViewportSize({width:1366,height:900});
    // 13: Carlos sempre manda quem=carlos, mesmo trocando o seletor
    await pg.selectOption('#main select[data-act="imp-key"]','samuel');await pg.waitForTimeout(100);M.posts.length=0;
    await escolher(pg,[arq('k1.jpg')]);await fim(pg);
    ok(M.posts.length===1&&M.posts[0].quem==='carlos','13: Carlos com o seletor em Samuel manda quem=carlos: '+J(M.posts));
    // 12: Parar durante o envio
    M.posts.length=0;M.atraso=400;const muitos=Array.from({length:12},(_,i)=>arq('p'+String(i).padStart(2,'0')+'.jpg'));
    await escolher(pg,muitos);
    await espera(pg,()=>ETERNA.state.imp.envio&&ETERNA.state.imp.envio.feitas>=1,5000);const nAntes=M.posts.length;
    await pg.click('#envio-painel [data-act="envio-parar"]');const tClick=Date.now();await fim(pg);
    const depois=M.posts.filter(p=>p.t>=tClick).length;
    ok(depois<=2&&M.posts.length<12,'12: depois do Parar no máximo 2 POSTs: '+J({antes:nAntes,depois,total:M.posts.length}));
    const fal=await pg.evaluate(()=>ETERNA.state.imp.envioFim.faltam.length);ok(fal===12-M.posts.length,'12: as que faltaram ficam guardadas: '+fal);
    ok(!!(await pg.$('#envio-painel [data-act="envio-repetir"]')),'12: botão Tentar de novo depois do Parar');
    // 10: 403 para tudo na primeira foto
    M.posts.length=0;M.atraso=150;M.resp=()=>({status:403,body:{erro:'origem'}});
    await escolher(pg,Array.from({length:6},(_,i)=>arq('g'+i+'.jpg')));await fim(pg);
    const f10=await faixa(pg);
    ok(/bad/.test(f10.cls)&&/Sem permissão para enviar fotos neste computador\. Chame a TI\./.test(f10.t),'10: faixa vermelha do 403: '+J(f10));
    ok(M.posts.length<=2,'10: nenhum POST a mais depois do 403: '+M.posts.length);
    // 507
    M.posts.length=0;M.atraso=0;M.resp=()=>({status:507,body:{erro:'disco'}});
    await escolher(pg,[arq('h1.jpg'),arq('h2.jpg'),arq('h3.jpg')]);await fim(pg);
    const f507=await faixa(pg);ok(/bad/.test(f507.cls)&&/O computador do ponto está sem espaço\. Chame a TI\./.test(f507.t),'507: '+J(f507));
    // 11: rede caindo em 2 de 6 (as duas últimas): 3 tentativas cada, depois Tentar de novo só com elas
    M.posts.length=0;M.resp=(n)=>/^r[45]\.jpg$/.test(n)?'abort':null;
    await escolher(pg,Array.from({length:6},(_,i)=>arq('r'+i+'.jpg')));await fim(pg);
    const tent=n=>M.posts.filter(p=>p.nome===n).length;
    ok(tent('r4.jpg')===3&&tent('r5.jpg')===3&&['r0.jpg','r1.jpg','r2.jpg','r3.jpg'].every(n=>tent(n)===1),'11: tentativas: '+J(['r0.jpg','r1.jpg','r2.jpg','r3.jpg','r4.jpg','r5.jpg'].map(tent)));
    const f11=await faixa(pg);ok(/bad/.test(f11.cls)&&/Sem conexão com o computador do ponto\. 2 fotos não foram enviadas\./.test(f11.t),'11: faixa da rede: '+J(f11));
    const rb=await pg.evaluate(()=>(document.querySelector('#envio-painel [data-act="envio-repetir"]')||{}).textContent);ok(rb==='Tentar de novo as 2 que faltaram','11: botão: '+rb);
    M.posts.length=0;M.resp=null;await pg.click('#envio-painel [data-act="envio-repetir"]');await fim(pg);
    ok(J(M.posts.map(p=>p.nome).sort())===J(['r4.jpg','r5.jpg']),'11: Tentar de novo manda só as 2: '+J(M.posts.map(p=>p.nome)));
    ok(/Enviadas 2 de 2/.test((await faixa(pg)).t),'11: depois do Tentar de novo, Enviadas 2 de 2');
    // Fechar
    await pg.click('#envio-painel [data-act="envio-fechar"]');await pg.waitForTimeout(100);ok(!(await pg.$('#envio-painel'))&&!!(await pg.$('#main [data-act="envio-abrir"]')),'Fechar volta ao link');
    await ctx.close();}
  // ---------- 2, 13: Admin e Supervisora escolhem o fotógrafo; sem set.c, vendedor e caixa sem o link ----------
  for(const email of ['eduardo@eduardorezende.com','supervisor@eterna.photo']){const {ctx,pg}=await nova();const M=novoM();await agente(ctx,M);await entrar(pg,email);
    ok(await abrir(pg),'2: '+email+' vê o link');await espera(pg,()=>!!ETERNA.state.agent.envio);
    await pg.selectOption('#main select[data-act="imp-key"]','todos');await pg.waitForTimeout(120);
    const t=await pg.evaluate(()=>(document.querySelector('#envio-painel')||{}).innerText||'');
    ok(/Escolha o fotógrafo acima\./.test(t)&&!(await pg.$('#envio-painel input[type=file]'))&&!(await pg.$('#envio-painel [data-act="envio-escolher"]'))&&!(await pg.$('#envio-painel .envio-drop')),'13: '+email+' com Todos: '+t.slice(0,120));
    await pg.evaluate(()=>ETERNA.fotosEnviar([new File([new Uint8Array([255,216,255,217])],'z.jpg',{type:'image/jpeg'})]));await pg.waitForTimeout(150);
    ok(M.posts.length===0,'13: '+email+' com Todos: nenhuma foto aceita');
    await pg.selectOption('#main select[data-act="imp-key"]','samuel');await pg.waitForTimeout(120);
    await escolher(pg,[arq('m1.jpg'),arq('m2.jpg')]);await fim(pg);
    ok(M.posts.length===2&&M.posts.every(p=>p.quem==='samuel'),'13: '+email+' escolhendo Samuel: '+J(M.posts));
    const au=await pg.evaluate(()=>ETERNA.auditRead().find(e=>e.acao==='fotos_envio_manual'));ok(au&&au.alvo==='samuel'&&au.por===email&&au.mudancas[0].para===2,'14: auditLog com quem mandou e para quem: '+J(au));
    if(/supervisor/.test(email)){
      // sem set.c (usuário personalizado): sem link
      await pg.evaluate(()=>{ETERNA.state.user.perms.set.c=false;ETERNA.render();});await pg.waitForTimeout(80);
      ok(!(await pg.$('#main [data-act="envio-abrir"]'))&&!(await pg.$('#envio-painel')),'2: usuário sem set.c não vê o link');
      const r=await pg.evaluate(()=>ETERNA.envioPode());ok(r.motivo==='perm','2: envioPode sem set.c: '+J(r));}
    await ctx.close();}
  for(const email of ['loja@eterna.photo','qualidade@eterna.photo']){const {ctx,pg}=await nova();const M=novoM();await agente(ctx,M);await entrar(pg,email);
    await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(250);
    ok(!(await pg.$('[data-act="envio-abrir"]'))&&!(await pg.evaluate(()=>ETERNA.envioPode().ok)),'2: '+email+' sem o link');await ctx.close();}
  // migração: Supervisora salva antes da v96-ux ganha set.c uma vez, com registro
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(250);
    await pg.evaluate(()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1')||'null');if(!U)return;const s=U['supervisor@eterna.photo'];s.perms.set={c:false,r:true,u:false,d:false};delete s.menv96;
      U['gerente@eterna.photo']={...JSON.parse(JSON.stringify(s)),email:'gerente@eterna.photo',name:'Gerente',preset:'custom'};localStorage.setItem('eterna.users.v1',JSON.stringify(U));localStorage.removeItem('eterna.users.log.v1');});
    await pg.reload();await pg.waitForTimeout(400);
    const m=await pg.evaluate(()=>{const U=ETERNA.USERS;return {sup:U['supervisor@eterna.photo'].perms.set,ger:U['gerente@eterna.photo']&&U['gerente@eterna.photo'].perms.set,l:ETERNA.auditRead().filter(e=>e.acao==='migracao_v96_envio').map(e=>e.alvo)};});
    ok(m.sup.c&&!m.sup.u&&m.ger&&!m.ger.c&&J(m.l)===J(['supervisor@eterna.photo']),'decisão 3: migração da Supervisora: '+J(m));
    await pg.reload();await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='migracao_v96_envio').length)===1,'decisão 3: migração roda uma vez');
    await ctx.close();}
  // ---------- 3: sem agente ----------
  {const {ctx,pg}=await nova();await ctx.route(ORIG+'/status',r=>r.abort());await ctx.route(ORIG+'/events*',r=>r.abort());await entrar(pg,'carlos@eterna.photo');
    await espera(pg,()=>ETERNA.state.agent.tried,6000);await pg.evaluate(()=>ETERNA.render());
    ok(!!(await pg.$('#main [data-act="envio-abrir"]')),'3: link aparece sem agente');await pg.click('#main [data-act="envio-abrir"]');await pg.waitForTimeout(100);
    const off=await pg.evaluate(()=>(document.querySelector('#envio-painel .conn-off')||{}).textContent||'');
    ok(/Sem conexão com o computador do ponto/.test(off)&&/Chame a TI/.test(off),'3: painel com .conn-off: '+off);
    ok(!(await pg.$('#envio-painel .envio-drop'))&&!(await pg.$('#envio-painel input[type=file]'))&&!(await pg.$('#envio-painel [data-act="envio-escolher"]')),'3: sem área e sem arquivo');
    ok(!TEC.test(await pg.evaluate(()=>document.body.innerText)),'D2: sem agente, texto técnico');await ctx.close();}
  // ---------- 4: agente fora da origem da página ----------
  {const {ctx,pg}=await nova();const M=novoM();const OUT='http://127.0.0.1:45991';await agente(ctx,M,OUT);await ctx.addInitScript(o=>{window.ETERNA_AGENTE=o;},OUT);
    await entrar(pg,'carlos@eterna.photo');await espera(pg,()=>ETERNA.state.agent.on,6000);ok(await abrir(pg),'4: link');
    const t=await pg.evaluate(()=>(document.querySelector('#envio-painel')||{}).innerText||'');
    ok(/O computador do ponto não está respondendo\. Chame a TI\./.test(t)&&!TEC.test(await pg.evaluate(()=>document.body.innerText))&&!(await pg.$('#envio-painel input[type=file]'))&&!(await pg.$('#envio-painel [data-act="envio-escolher"]')),'4: Carlos fora da origem: '+t);
    const r=await pg.evaluate(()=>ETERNA.envioPode());ok(r.motivo==='origem','4: envioPode: '+J(r));
    await entrar(pg,'eduardo@eduardorezende.com');await espera(pg,()=>ETERNA.state.agent.on,6000);await abrir(pg);
    const ta=await pg.evaluate(()=>(document.querySelector('#envio-painel')||{}).innerText||'');ok(/endereço do computador do ponto/.test(ta)&&ta.includes(OUT),'4: Admin vê a dica do endereço: '+ta);
    ok(M.posts.length===0,'4: nenhum POST');await ctx.close();}
  // ---------- 5: agente antigo (sem envio no /status) ----------
  {const {ctx,pg}=await nova();const M=novoM();M.antigo=true;await agente(ctx,M);await entrar(pg,'carlos@eterna.photo');await espera(pg,()=>ETERNA.state.agent.on);ok(await abrir(pg),'5: link');
    const t=await pg.evaluate(()=>(document.querySelector('#envio-painel')||{}).innerText||'');
    ok(/O computador do ponto precisa ser atualizado para receber fotos por aqui\. Chame a TI\./.test(t)&&!(await pg.$('#envio-painel input[type=file]'))&&!(await pg.$('#envio-painel [data-act="envio-escolher"]')),'5: agente antigo: '+t);
    await pg.evaluate(()=>ETERNA.fotosEnviar([new File([new Uint8Array([255,216,255,217])],'z.jpg',{type:'image/jpeg'})]));await pg.waitForTimeout(150);ok(M.posts.length===0,'5: nenhum POST');await ctx.close();}

  // ---------- B: agente de verdade servindo o app ----------
  {const PORTA=await livre(),FTPP=await livre();const AO='http://127.0.0.1:'+PORTA;
    proc=spawn('python3',['-I','-u',path.join(__dirname,'_envio_lanca.py'),AG,'2'],{env:{...process.env,HOME:HB,USERPROFILE:HB,ETERNA_PORTA:String(PORTA),ETERNA_FTP_PORTA:String(FTPP),ETERNA_APP_ORIGIN:ORIG,ETERNA_SEM_OPENCV:'1',ETERNA_SESSAO_PAUSA:'8',ETERNA_LEITORES:'1',USER:'eterna-teste-sem-cartao'},stdio:['ignore','pipe','pipe']});
    proc.stdout.on('data',d=>LOGA+=d);proc.stderr.on('data',d=>LOGA+=d);
    let up=false;for(let i=0;i<120&&!up;i++){await sleep(250);up=(await get(PORTA,'/status')).s===200;}
    if(!up)throw new Error('agente não subiu: '+LOGA.slice(-400));
    // função do dia (como a Escala manda): o Carlos no campo4, o ponto que a tela Minhas fotos dele filtra
    const hj=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
    ok((await post(PORTA,'/fila-fotografo/funcao',{dia:hj,map:{carlos:{tipo:'campo',point:'campo4'}}},{'X-Eterna':'1'})).s===200,'B: função do dia');
    const DIR=path.join(HB,'fotos-geradas');fs.mkdirSync(DIR,{recursive:true});
    execFileSync('python3',['-I','-c',`
import io,os,sys,time,random
from PIL import Image
d=sys.argv[1]
for i in range(6):
    im=Image.new("RGB",(320,240),tuple(random.randint(30,220) for _ in range(3)))
    for k in range(40):
        r=os.urandom(4);im.putpixel((int.from_bytes(r[:2],"big")%320,int.from_bytes(r[2:],"big")%240),(r[0],r[1],r[2]))
    ex=Image.Exif();ex.get_ifd(0x8769)[0x9003]=time.strftime("%Y:%m:%d %H:%M:%S",time.localtime(time.time()-7200+i))
    im.save(os.path.join(d,"IMG_%04d.JPG"%(i+1)),"JPEG",quality=85,exif=ex.tobytes())
`,DIR]);
    const {ctx,pg}=await nova();await pg.goto(AO+'/index.html');await pg.waitForTimeout(400);
    await pg.fill('[data-act="login-email"]','carlos@eterna.photo');await pg.click('button[type=submit]');await pg.waitForTimeout(150);
    await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(500);
    ok(await espera(pg,()=>ETERNA.state.agent.on&&!!ETERNA.state.agent.envio,10000),'B: agente de verdade com /status.envio');
    ok(await abrir(pg),'B: link');
    await escolher(pg,fs.readdirSync(DIR).sort().map(n=>path.join(DIR,n)));
    ok(await fim(pg),'B: envio termina');const fb=await faixa(pg);ok(/Enviadas 6 de 6/.test(fb.t),'B: Enviadas 6 de 6: '+J(fb)+' · '+LOGA.slice(-300));
    const ses=await espera(pg,()=>[...document.querySelectorAll('#main .up-sess')].some(e=>/Carlos/.test(e.textContent)&&/6 fotos/.test(e.textContent)&&/atrasada/.test(e.textContent)),15000);
    ok(ses,'B: sessão atrasada do Carlos com 6 fotos em Minhas fotos: '+await pg.evaluate(()=>[...document.querySelectorAll('#main .up-sess')].map(e=>e.innerText.slice(0,120)).join(' | ')));
    const st=(await get(PORTA,'/status')).j||{};ok(st.envio&&st.envio.novas===6,'B: /status.envio.novas = 6: '+J(st.envio));
    // de novo: 6 repetidas
    const em0=await pg.evaluate(()=>ETERNA.state.imp.envioFim&&ETERNA.state.imp.envioFim.em);
    await escolher(pg,fs.readdirSync(DIR).sort().map(n=>path.join(DIR,n)));
    await espera(pg,em0=>!ETERNA.state.imp.envio&&ETERNA.state.imp.envioFim&&ETERNA.state.imp.envioFim.em!==em0,20000,em0);
    const fr=await faixa(pg);ok(/Enviadas 0 de 6/.test(fr.t)&&/6 já estavam no servidor/.test(fr.t),'B: mesmas 6 de novo: '+J(fr));
    ok(!/IMG_000/.test(LOGA),'B: console do agente sem o nome das fotos');
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();if(proc)proc.kill();try{fs.rmSync(HB,{recursive:true,force:true});}catch(e){}}
if(fails.length){console.log('FALHA envio-manual: '+fails.join(' || '));process.exit(1);}
console.log('OK envio-manual: Minhas fotos, envio manual do cartão (critérios 1 a 15, Supervisora, agente de verdade)');process.exit(0);
})();
