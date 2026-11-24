// v99.44.0 (testador, 24/11): Lixeira da IA, Parte A (modo Teste), com o agente DE VERDADE e o leitor de rostos real (OpenCV + YuNet
// de vendor/rostos). Fotos geradas (testes/_v9944_servidor.py imagens: a ilustração gerada img/ativ-snap.jpg ampliada, escurecida,
// estourada e borrada, e o fundo img/bg-mirantedia.jpg sem ninguém); nenhuma foto de visitante. Chegam pela pasta do FTP do fotógrafo.
// Confere: o que entra na lixeira (e o que não entra), a contagem do menu (7 dias), "Não é ruim" (servidor, contagem sem recarregar,
// segundo clique igual), o Checkout com todas as fotos em Teste, a chave com Ligado travado (409 em_breve) e as permissões
// (Supervisora vê e recupera mas não muda a chave; Fotógrafo não vê; "ver como" não grava). 1280 e 390 px.
// Sem OpenCV no ambiente: avisa e sai OK sem rodar.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');const crypto=require('crypto');
const S=require('./_agente_sessao');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RAIZ=path.join(__dirname,'..');
const AG=path.join(RAIZ,'agente','eterna-agente.py');const AJ=path.join(__dirname,'_v9944_servidor.py');const SHOTS=path.join(__dirname,'prints');
const notas=[],fails=[];let VP='';const ok=(c,m)=>{if(!c)fails.push(VP+' '+m);return !!c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const livre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const sqlite=(db,sql)=>JSON.parse(execFileSync('python3',['-I','-c','import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute(sys.argv[2]).fetchall()))',db,sql]).toString().trim());
try{execFileSync('python3',['-I','-c','import cv2,numpy']);}catch(e){console.log('OK v9944-lixeira-real: AVISO sem OpenCV, nada rodou');process.exit(0);}
(async()=>{const b=await chromium.launch();const errs=[];const home=fs.mkdtempSync(path.join(os.tmpdir(),'v9944-lx-'));const E=path.join(home,'Eterna');let ag=null,log='';
  const porta=await livre(),ftpP=await livre();const UA=`http://127.0.0.1:${porta}/index.html`;const senha='t'+crypto.randomBytes(9).toString('hex');
  const env={...process.env,HOME:home,USERPROFILE:home,USER:'v9944-sem-cartao',ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(ftpP),ETERNA_FTP_PASV:`${ftpP+1}-${ftpP+3}`,ETERNA_APP_ORIGIN:ORIG,
    ETERNA_SEM_RECORTE:'1',INVOCATION_ID:'v9944',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};delete env.ETERNA_MODO_TESTE;delete env.ETERNA_SEM_OPENCV;delete env.ETERNA_LIXEIRA;
  const req=(metodo,p,corpo,ck)=>new Promise(res=>{const d=corpo?Buffer.from(J(corpo)):null;const r=http.request({host:'127.0.0.1',port:porta,method:metodo,path:p,headers:Object.assign({Host:'127.0.0.1:'+porta},ck?{Cookie:ck}:{},d?{'Content-Type':'application/json','Content-Length':d.length,'X-Eterna':'1'}:{})},
    rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{let j=null;try{j=JSON.parse(Buffer.concat(ch).toString())}catch(e){}res({s:rs.statusCode,j});});});r.on('error',()=>res({s:0}));if(d)r.write(d);r.end();});
  const nova=async vp=>{const ctx=await b.newContext({viewport:vp,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(VP+' '+e.message));return {ctx,pg};};
  const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(200);}return false;};
  const entrar=async(pg,u)=>{await pg.goto(UA);await pg.waitForSelector('[data-act="login-usuario"]',{timeout:20000});await pg.fill('[data-act="login-usuario"]',u);await pg.fill('[data-act="login-senha"]',senha);
    await pg.click('form[data-form="login-entrar"] button[type=submit]');const e=await espera(pg,()=>!!(window.ETERNA&&ETERNA.state.user),15000);await espera(pg,()=>ETERNA.state.agent.on&&!!ETERNA.state.agent.lixeira,15000);return e;};
  const semRolar=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  const shot=async(pg,nome)=>{fs.mkdirSync(SHOTS,{recursive:true});await pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.removeAttribute('data-on');});await pg.screenshot({path:path.join(SHOTS,nome),fullPage:true});};
  try{
    {const {ctx,pg}=await nova({width:1280,height:900});await pg.goto(U);await pg.waitForTimeout(400);
      const pre=await pg.evaluate(()=>Object.fromEntries(['admin','supervisor','foto','valida'].map(p=>[p==='foto'?'fotografo':p,{perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p)}])));fs.writeFileSync(path.join(home,'presets.json'),J(pre));await ctx.close();}
    execFileSync('python3',['-I',AJ,AG,'semeia',path.join(home,'midia'),path.join(home,'presets.json'),senha],{env:{...env,ETERNA_SEM_OPENCV:'1'},timeout:120000});
    fs.mkdirSync(path.join(E,'modelos'),{recursive:true});for(const m of ['face_detection_yunet_2023mar.onnx','face_recognition_sface_2021dec.onnx'])fs.copyFileSync(path.join(RAIZ,'vendor','rostos',m),path.join(E,'modelos',m));
    const FTPD=path.join(home,'ftp');const IMG=JSON.parse(execFileSync('python3',['-I',AJ,AG,'imagens',path.join(FTPD,'carlos')],{env:{...env,ETERNA_SEM_OPENCV:'1'},timeout:120000}).toString().trim().split('\n').pop());
    env.ETERNA_PASTA=FTPD;
    ag=spawn('python3',['-I','-u',AG],{env,stdio:['ignore','pipe','pipe']});ag.stdout.on('data',d=>log+=d);ag.stderr.on('data',d=>log+=d);
    const CKA=S.sessao(home,'admin-lx');let st=null;{const t0=Date.now();while(Date.now()-t0<180000){const r=await req('GET','/status',null,CKA);if(r.s===200){st=r.j;if(st.lixeira&&st.lixeira.hoje>=4&&(st.rostos||{}).fila===0)break;}await sleep(1000);}}
    ok(st&&st.lixeira&&st.lixeira.on,'/status.lixeira ligado: '+J(st&&st.lixeira));await sleep(7000); // gravação em lote (5 s)
    st=(await req('GET','/status',null,CKA)).j;notas.push('status.lixeira='+J(st.lixeira));
    // nome de cada foto -> pid (metricas.jsonl do agente)
    const nomes={};fs.readFileSync(path.join(E,'metricas.jsonl'),'utf8').split('\n').filter(Boolean).forEach(l=>{try{const x=JSON.parse(l);if(x.pid&&x.nome)nomes[x.nome.toUpperCase()]=x.pid;}catch(e){}});
    const pid={};Object.entries(IMG).forEach(([k,a])=>pid[k]=nomes[path.basename(a).toUpperCase()]);ok(Object.values(pid).every(Boolean),'todas as fotos chegaram: '+J(pid));
    const lx=sqlite(path.join(E,'ponto','treino.db'),'select pid, mot from lixeira');const mot=Object.fromEntries(lx.map(([p,m])=>[p,m]));
    const tab=Object.fromEntries(Object.entries(pid).map(([k,p])=>[k,mot[p]===undefined?'sem linha':mot[p]]));notas.push('vereditos='+J(tab));
    ok(tab.boa===null&&tab.boa2===null,'fotos boas fora da lixeira: '+J(tab));
    ok(/^escura/.test(tab.escura||''),'escura entra com escura primeiro: '+tab.escura);
    ok(/^estourada/.test(tab.estourada||''),'estourada entra com estourada primeiro: '+tab.estourada);
    ok(/desfocada/.test(tab.borrada||''),'borrada entra com desfocada: '+tab.borrada);
    ok(tab.sem_ninguem==='sem_ninguem','sem ninguém entra com sem_ninguem: '+tab.sem_ninguem);
    const naLixeira=sqlite(path.join(E,'ponto','treino.db'),"select count(*) from lixeira where mot is not null and rec_por is null and dia >= date('now','localtime','-6 days')")[0][0];ok(st.lixeira.n7===naLixeira,'/status.lixeira.n7 = fotos na lixeira: '+J({n7:st.lixeira.n7,naLixeira}));
    // ---------- Admin 1280 e 390 ----------
    let recuperou=null;
    for(const vp of [{width:1280,height:900},{width:390,height:844}]){VP='['+vp.width+']';const P390=vp.width<400;
      const {ctx,pg}=await nova(vp);ok(await entrar(pg,'admin.srv@exemplo.com'),'Admin não entrou');
      if(P390){await pg.click('.menu-toggle').catch(()=>{});await pg.waitForTimeout(300);}
      const pill=await pg.evaluate(()=>{const x=document.querySelector('#nav [data-v="lixeira"] #rail-lx');return x?x.textContent:null;});const n7=(await req('GET','/status',null,CKA)).j.lixeira.n7;
      ok(pill===String(n7),'contagem no menu = n7 do servidor: '+J({pill,n7}));
      const ordem=await pg.evaluate(()=>[...document.querySelectorAll('#nav [data-v]')].map(x=>x.dataset.v));ok(ordem.indexOf('lixeira')===ordem.indexOf('alertas')+1,'Lixeira logo depois de Alertas: '+J(ordem.slice(0,12)));
      await pg.evaluate(()=>ETERNA.go('lixeira'));await espera(pg,()=>!!(ETERNA.state.lx&&ETERNA.state.lx.j),10000);await pg.waitForTimeout(800);
      const itens=await pg.$$eval('#main [data-act="lx-rec"]',x=>x.map(b=>b.dataset.pid));const hojeN=Object.values(pid).filter(p=>mot[p]&&p!==recuperou).length;ok(itens.length===hojeN,'tela (hoje) com um botão por foto da lixeira de hoje: '+J({itens:itens.length,hojeN}));
      ok(!itens.includes(pid.boa)&&!itens.includes(pid.boa2),'as boas não aparecem na tela');
      const txt=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(/Em teste: estas fotos continuam à venda/.test(txt)&&/Carlos/.test(txt)&&!/\blx_[a-z]|undefined|NaN|—/.test(txt),'pílula Teste, fotógrafo, sem chave crua nem travessão');
      if(P390){ok(await semRolar(pg),'390: Lixeira sem rolagem lateral');const hs=await pg.$$eval('#main [data-act="lx-rec"]',x=>x.map(b=>Math.round(b.getBoundingClientRect().height)));ok(hs.every(h=>h>=44),'390: Não é ruim com 44 px: '+J(hs));}
      await shot(pg,`v9944-lixeira-admin-${vp.width}.png`);
      // filtro por motivo
      await pg.click('#main [data-act="lx-mot"][data-m="estourada"]');await pg.waitForTimeout(300);const so=await pg.$$eval('#main [data-act="lx-rec"]',x=>x.map(b=>b.dataset.pid));
      ok(so.length>=1&&so.includes(pid.estourada)&&!so.includes(pid.sem_ninguem),'chip estourada filtra: '+J(so));await pg.click('#main [data-act="lx-mot"][data-m="todos"]');await pg.waitForTimeout(300);
      if(!P390){// "Não é ruim" na escura: servidor, contagem sem recarregar, segundo clique igual
        let cargas=0;pg.on('load',()=>cargas++);const antes=await pg.evaluate(()=>(document.querySelector('#rail-lx')||{}).textContent);
        await pg.click(`#main [data-act="lx-rec"][data-pid="${pid.escura}"]`);await pg.waitForTimeout(1200);
        const linha=sqlite(path.join(E,'ponto','treino.db'),`select rec_por, rec_em from lixeira where pid='${pid.escura}'`)[0];const lg=sqlite(path.join(E,'ponto','treino.db'),`select acao, por from lixeira_log where pid='${pid.escura}'`);
        ok(linha&&linha[0]==='admin.srv@exemplo.com'&&linha[1]&&lg.length===1&&lg[0][0]==='recuperar','Não é ruim grava quem e quando: '+J({linha,lg}));
        ok(await espera(pg,a=>{const x=document.querySelector('#rail-lx');return (x?+x.textContent:0)===(+a)-1;},12000,antes),'a contagem do menu cai sem recarregar');ok(cargas===0,'sem recarregar a página');
        const t2=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(/Recuperada por/.test(t2)&&!(await pg.$(`#main [data-act="lx-rec"][data-pid="${pid.escura}"]`)),'a foto fica como recuperada, sem botão');
        const r2=await req('POST','/lixeira/recuperar',{pid:pid.escura},CKA);ok(r2.s===200&&r2.j&&r2.j.igual===true,'segundo clique responde igual: '+J(r2));
        recuperou=pid.escura;
        // chave: Teste marcado, Ligado travado; POST ligada 409 em_breve; medir 200
        await pg.evaluate(()=>ETERNA.go('ia-auto'));await pg.waitForTimeout(800);
        const ch=await pg.evaluate(()=>[...document.querySelectorAll('[data-act="lx-cfg"]')].map(b=>({v:b.dataset.v,p:b.getAttribute('aria-pressed'),d:b.disabled})));
        ok(J(ch)===J([{v:'medir',p:'true',d:false},{v:'ligada',p:'false',d:true}]),'chave: Teste marcado e Ligado travado: '+J(ch));
        await shot(pg,'v9944-lixeira-chave-admin-1280.png');
        const l1=await pg.evaluate(async()=>{const r=await fetch('/lixeira/config',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({modo:'ligada'})});return {s:r.status,j:await r.json()};});
        ok(l1.s===409&&l1.j.error==='em_breve','POST ligada = 409 em_breve: '+J(l1));
        // ver como a Supervisora: não grava
        const vc=await pg.evaluate(async p=>{const H={'Content-Type':'application/json','X-Eterna':'1'};await fetch('/auth/assumir',{method:'POST',credentials:'same-origin',headers:H,body:JSON.stringify({usuario:'sup.srv@exemplo.com'})});
          const r=await fetch('/lixeira/recuperar',{method:'POST',credentials:'same-origin',headers:H,body:JSON.stringify({pid:p})});const c=await fetch('/lixeira/config',{method:'POST',credentials:'same-origin',headers:H,body:JSON.stringify({modo:'medir'})});
          await fetch('/auth/voltar',{method:'POST',credentials:'same-origin',headers:H,body:'{}'});return {rec:r.status,cfg:c.status};},pid.estourada);
        ok(vc.rec===403&&vc.cfg===403&&sqlite(path.join(E,'ponto','treino.db'),`select rec_por from lixeira where pid='${pid.estourada}'`)[0][0]===null,'"ver como" não grava na lixeira: '+J(vc));
        // tela no "ver como": o clique dá o aviso e não grava
        await pg.evaluate(()=>{ETERNA.state.assumido={usuario:'sup.srv@exemplo.com',nome:'Supervisora'};ETERNA.go('lixeira');});await pg.waitForTimeout(800);
        const bt=await pg.$(`#main [data-act="lx-rec"][data-pid="${pid.estourada}"]`);if(bt){await bt.click();await pg.waitForTimeout(600);}
        ok(sqlite(path.join(E,'ponto','treino.db'),`select rec_por from lixeira where pid='${pid.estourada}'`)[0][0]===null,'clique no "ver como" não grava');await pg.evaluate(()=>{ETERNA.state.assumido=null;});}
      await ctx.close();}
    VP='';
    // ---------- Supervisora: vê e recupera, não muda a chave ----------
    {const {ctx,pg}=await nova({width:1280,height:900});ok(await entrar(pg,'sup.srv@exemplo.com'),'Supervisora não entrou');
      const v=await pg.evaluate(()=>({lx:ETERNA.canView('lixeira'),ia:ETERNA.canView('ia-auto')}));ok(v.lx,'Supervisora vê a Lixeira: '+J(v));
      if(v.ia){await pg.evaluate(()=>ETERNA.go('ia-auto'));await pg.waitForTimeout(800);const c=await pg.$$('[data-act="lx-cfg"]');ok(!c.length,'Supervisora sem os botões da chave');await shot(pg,'v9944-lixeira-chave-supervisora-1280.png');}
      const r=await pg.evaluate(async p=>{const H={'Content-Type':'application/json','X-Eterna':'1'};const c=await fetch('/lixeira/config',{method:'POST',credentials:'same-origin',headers:H,body:JSON.stringify({modo:'medir'})});
        const x=await fetch('/lixeira/recuperar',{method:'POST',credentials:'same-origin',headers:H,body:JSON.stringify({pid:p})});return {cfg:c.status,cfgj:await c.json(),rec:x.status};},pid.sem_ninguem);
      ok(r.cfg===403&&r.cfgj.error==='so_admin'&&r.rec===200,'Supervisora: chave 403 so_admin, Não é ruim 200: '+J(r));await ctx.close();}
    // ---------- Fotógrafo: sem a tela e sem a rota ----------
    {const {ctx,pg}=await nova({width:390,height:844});ok(await entrar(pg,'foto.srv@exemplo.com'),'Fotógrafo não entrou');
      const r=await pg.evaluate(async()=>{const g=await fetch('/lixeira',{credentials:'same-origin'});return {v:ETERNA.canView('lixeira'),g:g.status,pill:!!document.querySelector('#rail-lx')};});
      ok(!r.v&&r.g===403&&!r.pill,'Fotógrafo sem a Lixeira: '+J(r));await ctx.close();}
    // ---------- Checkout em Teste: a leva mostra todas as 6 fotos ----------
    {const CKP=S.posto(home,'Caixa LX');const {ctx,pg}=await nova({width:1280,height:800});await S.noNavegador(ctx,porta,[CKP]);await pg.goto(UA+'#loja');
      const ses=(await req('GET','/sessoes',null,S.sessao(home,'admin-lx2'))).j;const meus=new Set(Object.values(pid));
      const cards=((ses&&ses.sessoes)||[]).filter(s=>(s.fotos||s.pids||[]).some(p=>meus.has(p))).map(s=>s.card);ok(cards.length>=1,'as levas do Carlos existem: '+J(cards));
      ok(await espera(pg,cs=>!!window.ETERNA&&cs.every(c=>!!ETERNA.SIM.sessions[c]),30000,cards),'as levas chegaram ao Checkout');await pg.waitForTimeout(3000);
      const r=await pg.evaluate(cs=>{const n=cs.flatMap(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').map(x=>x.id));return {n,inv:Object.keys(ETERNA.SIM.invalid||{}),dis:Object.keys(ETERNA.SIM.discarded||{})};},cards);
      const nome=Object.fromEntries(Object.entries(pid).map(([k,p])=>['ag_'+p,k]));
      notas.push('Checkout ('+cards.length+' levas): mostra '+r.n.map(x=>nome[x]||x).join(',')+'; inválidas pelo navegador: '+(r.inv.map(x=>nome[x]||x).join(',')||'nenhuma'));
      ok(Object.values(pid).every(p=>r.n.includes('ag_'+p)),'em Teste o Checkout mostra todas as fotos das levas (também as da lixeira): '+J(r.n.map(x=>nome[x]||x)));
      await ctx.close();}
    ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
    ok(!/Traceback/.test(log),'erro no console do agente: '+(log.match(/Traceback[\s\S]{0,300}/)||[''])[0]);
  }catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,700));}
  finally{try{ag&&ag.kill();}catch(e){}await b.close();if(!process.env.V9944_MANTER)try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}else console.log('HOME: '+home);}
  console.log((fails.length?'FALHA':'OK')+' v9944-lixeira-real: leitor de rostos real, vereditos, menu de 7 dias, Não é ruim, Checkout com todas em Teste, chave travada e permissões ('+notas.join('; ')+')'+(fails.length?' · '+fails.join(' | '):''));
  process.exit(fails.length?1:0);})();
