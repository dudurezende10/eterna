// v99.44.0 (testador, 24/11): "Treino mais claro" com o agente DE VERDADE (HOME temporário com cara de servidor, login com senha),
// em 1280×900 e 390×844. O treino-claro.js cobre a tela com agente falso; aqui o que vale é o servidor:
// - Gramado + resposta 3 (Não + motivos) chega ao treino.db; trocar de ponto grava ia nulo; Enter sem escolha não grava nada;
// - digitar na observação enquanto o /status chega e a tela redesenha não perde texto nem foco;
// - IA automática: o Admin muda (POST /treino/config 200), a Supervisora só vê (pílulas; a rota dá 403 so_admin), o Fotógrafo não vê a tela;
// - sim/autoAj pela sincronização é recusado para quem não é Admin;
// - Minhas fotos: Admin e Supervisora sem o seletor Fotógrafo, com as sessões de hoje de todos; o Fotógrafo só com as dele.
// Fotos: JPEG liso gerado (testes/_v9944_servidor.py). V9944_PRINTS=1 grava capturas em testes/prints/ (prefixo v9944-).
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');const crypto=require('crypto');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const AG=path.join(__dirname,'..','agente','eterna-agente.py');const AJ=path.join(__dirname,'_v9944_servidor.py');const SHOTS=path.join(__dirname,'prints');
let json_ftp;const notas=[];const fails=[];let VP='';const ok=(c,m)=>{if(!c)fails.push(VP+' '+m);return !!c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const livre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const sqlite=(db,sql)=>execFileSync('python3',['-I','-c','import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute(sys.argv[2]).fetchall()))',db,sql]).toString().trim();
(async()=>{const b=await chromium.launch();const errs=[];const home=fs.mkdtempSync(path.join(os.tmpdir(),'v9944-tr-'));const E=path.join(home,'Eterna');let ag=null,log='';
  const porta=await livre(),ftpP=await livre();const UA=`http://127.0.0.1:${porta}/index.html`;const senha='t'+crypto.randomBytes(9).toString('hex');
  const env={...process.env,HOME:home,USERPROFILE:home,USER:'v9944-sem-cartao',ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(ftpP),ETERNA_FTP_PASV:`${ftpP+1}-${ftpP+3}`,ETERNA_APP_ORIGIN:ORIG,
    ETERNA_SEM_OPENCV:'1',ETERNA_SEM_RECORTE:'1',INVOCATION_ID:'v9944',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};delete env.ETERNA_MODO_TESTE;
  const get=p=>new Promise(res=>{http.get({host:'127.0.0.1',port:porta,path:p},rs=>{rs.resume();rs.on('end',()=>res(rs.statusCode));}).on('error',()=>res(0));});
  const nova=async vp=>{const ctx=await b.newContext({viewport:vp,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(VP+' '+e.message));return {ctx,pg};};
  const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(150);}return false;};
  const entrar=async(pg,u)=>{await pg.goto(UA);await pg.waitForSelector('[data-act="login-usuario"]',{timeout:20000});await pg.fill('[data-act="login-usuario"]',u);await pg.fill('[data-act="login-senha"]',senha);
    await pg.click('form[data-form="login-entrar"] button[type=submit]');const e=await espera(pg,()=>!!(window.ETERNA&&ETERNA.state.user),15000);await espera(pg,()=>ETERNA.state.agent.on&&!!ETERNA.state.agent.treino,15000);return e;};
  const blur=pg=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
  const tecla=async(pg,...ks)=>{for(const k of ks){await blur(pg);await pg.keyboard.press(k);await pg.waitForTimeout(80);}};
  const semRolar=pg=>pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
  const shot=async(pg,nome)=>{if(process.env.V9944_PRINTS){fs.mkdirSync(SHOTS,{recursive:true});await pg.evaluate(()=>{const t=document.getElementById('toast');if(t)t.removeAttribute('data-on');});await pg.screenshot({path:path.join(SHOTS,nome),fullPage:true});}};
  const TR=path.join(E,'ponto','treino.db');
  try{
    {const {ctx,pg}=await nova({width:1280,height:900});await pg.goto(U);await pg.waitForTimeout(400);
      const pre=await pg.evaluate(()=>Object.fromEntries(['admin','supervisor','foto'].map(p=>[p==='foto'?'fotografo':p,{perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p)}])));fs.writeFileSync(path.join(home,'presets.json'),J(pre));await ctx.close();}
    execFileSync('python3',['-I',AJ,AG,'semeia',path.join(home,'midia'),path.join(home,'presets.json'),senha],{env,timeout:120000});
    // sessões de hoje de dois fotógrafos (Minhas fotos)
    const hoje=execFileSync('python3',['-I','-c','import time;print(time.strftime("%Y-%m-%d"))'],{env}).toString().trim();
    // hoje: fotos de dois fotógrafos chegando pela pasta do FTP (subpasta = usuário do FTP = dono), para as Sessões de hoje
    const jpg=fs.readFileSync(path.join(E,'thumbs',fs.readdirSync(path.join(E,'thumbs'))[0]));const FTPD=path.join(home,'ftp');
    json_ftp=JSON.parse(fs.readFileSync(path.join(E,'ftp.json')));json_ftp.users.yago='y'.repeat(12);fs.writeFileSync(path.join(E,'ftp.json'),J(json_ftp));
    ['carlos','yago'].forEach((f,k)=>{fs.mkdirSync(path.join(FTPD,f),{recursive:true});for(let i=0;i<3;i++)fs.writeFileSync(path.join(FTPD,f,`IMG_${8000+k*10+i}.JPG`),Buffer.concat([jpg.slice(0,jpg.length-2),Buffer.from([k,i,7]),jpg.slice(jpg.length-2)]));});
    env.ETERNA_PASTA=FTPD;
    // um dia a mais de Treino (o 390 marca outro dia)
    {const d='2026-11-19';fs.mkdirSync(path.join(E,'inbox',d),{recursive:true});const ps=['d19d19d19001','d19d19d19002','d19d19d19003','d19d19d19004'];
      ps.forEach((p,i)=>{fs.writeFileSync(path.join(E,'inbox',d,`${p}_IMG_${7000+i}.JPG`),Buffer.concat([jpg,Buffer.from([i,9])]));fs.writeFileSync(path.join(E,'thumbs',p+'.jpg'),jpg);});
      fs.writeFileSync(path.join(E,'ponto','sessoes',d+'.json'),J({dia:d,sessoes:[{card:'LPSRV1900',status:'fechada',fotos:ps,fotografo:'carlos',ia:[]}]}));}
    ag=spawn('python3',['-I','-u',AG],{env,stdio:['ignore','pipe','pipe']});ag.stdout.on('data',d=>log+=d);ag.stderr.on('data',d=>log+=d);
    {let up=false;for(let i=0;i<200&&!up;i++){await sleep(250);up=(await get('/status'))===200;}ok(up,'agente não subiu: '+log.slice(-400));}
    for(const vp of [{width:1280,height:900},{width:390,height:844}]){VP='['+vp.width+']';const P390=vp.width<400;const D2=P390?'2026-11-19':'2026-11-21';
      // ================= Admin: marcar com o servidor de verdade =================
      const {ctx,pg}=await nova(vp);ok(await entrar(pg,'admin.srv@exemplo.com'),'Admin não entrou');
      await pg.evaluate(()=>{ETERNA.state.train.aba='marcar';ETERNA.go('treino');});await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length,10000);
      const dias=await pg.evaluate(()=>ETERNA.state.train.dias.map(d=>d.dia));ok(dias.includes(D2),'/treino/dias de verdade traz o dia semeado: '+J(dias));
      await pg.evaluate(d=>{ETERNA.state.train.dia=d;},D2);await pg.selectOption('[data-act="tr-dia"]',D2).catch(()=>{});
      await pg.click('[data-act="tr-carregar"]');ok(await espera(pg,()=>ETERNA.state.train.itens.length>=4&&!ETERNA.state.train.carregando,10000),'Carregar não trouxe as fotos do dia');
      const pids=await pg.evaluate(()=>ETERNA.state.train.itens.map(x=>x.pid));
      // marcar Gramado com a resposta 3 (Não + 2 motivos), Enter
      await pg.click('[data-act="tr-go"][data-i="0"]').catch(()=>{});await tecla(pg,'g','n','x');await pg.click('[data-act="tr-iam"][data-m="cortada"]');await pg.click('[data-act="tr-iam"][data-m="luz"]');
      await shot(pg,`v9944-treino-marcar-gramado-${vp.width}.png`);
      if(P390){const hs=await pg.$$eval('[data-act="tr-ia"]',x=>x.map(b=>Math.round(b.getBoundingClientRect().height)));ok(hs.every(h=>h>=56)&&await semRolar(pg),'390: Sim/Não com 56 px e sem rolagem lateral: '+J(hs));}
      await tecla(pg,'Enter');await espera(pg,()=>ETERNA.trFila().length===0,8000);await pg.waitForTimeout(400);
      let r=JSON.parse(sqlite(TR,`select dados from rotulo where pid='${pids[0]}'`));let d=r[0]&&JSON.parse(r[0][0]);
      ok(d&&d.ponto==='gramado'&&d.ia&&d.ia.serve===false&&J((d.ia.motivos||[]).slice().sort())===J(['cortada','luz'])&&d.qual&&d.qual.nivel,'Gramado + Não + motivos gravado no treino.db: '+J(d));
      // trocar de ponto: Gramado + Sim, depois Arquibancada, Enter -> ia nulo no servidor
      await tecla(pg,'g','s','a','p','Enter');await espera(pg,()=>ETERNA.trFila().length===0,8000);await pg.waitForTimeout(400);
      r=JSON.parse(sqlite(TR,`select dados from rotulo where pid='${pids[1]}'`));d=r[0]&&JSON.parse(r[0][0]);
      ok(d&&d.ponto==='arquibancada'&&J(d.ia)===J({serve:null,motivos:[],frente:null}),'trocar de ponto grava ia nulo no servidor: '+J(d));
      // Enter sem escolha: só passa, nada no servidor nem na fila
      const nAntes=JSON.parse(sqlite(TR,'select count(*) from rotulo'))[0][0];const j0=await pg.evaluate(()=>ETERNA.state.train.j);
      await tecla(pg,'Enter');await pg.waitForTimeout(600);
      const t=await pg.evaluate(()=>({j:ETERNA.state.train.j,fila:ETERNA.trFila().length}));const nDep=JSON.parse(sqlite(TR,'select count(*) from rotulo'))[0][0];
      ok(t.j===j0+1&&t.fila===0&&nDep===nAntes,'Enter sem escolha só passa, sem gravar: '+J({...t,j0,nAntes,nDep}));
      // observação: digitar devagar com o /status chegando e a tela redesenhando
      await tecla(pg,'g','p');const obs=await pg.$('[data-act="tr-obs"]');await obs.click();const frase='luz forte no rosto, sem tremido '+vp.width;
      for(let i=0;i<frase.length;i++){await pg.keyboard.type(frase[i]);if(i%6===0)await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(110);}
      const o=await pg.evaluate(()=>{const a=document.activeElement;return {foco:a&&a.dataset&&a.dataset.act,v:a&&a.value};});
      ok(o.foco==='tr-obs'&&o.v===frase,'observação perde texto ou foco com o servidor mandando atualizações: '+J(o));
      await pg.keyboard.press('Enter');await espera(pg,()=>ETERNA.trFila().length===0,8000);await pg.waitForTimeout(400);
      r=JSON.parse(sqlite(TR,`select dados from rotulo where pid='${pids[j0+1]}'`));d=r[0]&&JSON.parse(r[0][0]);ok(d&&d.obs===frase,'observação gravada no servidor: '+J(d&&d.obs));
      // IA automática: o Admin muda pelo servidor
      await pg.evaluate(()=>ETERNA.go('ia-auto'));await espera(pg,()=>!!document.querySelector('#tr-cfg'),8000);await pg.waitForTimeout(300);
      const btns=await pg.$$eval('#tr-cfg [data-act="tr-cfg"]',x=>x.length);ok(btns>=4,'Admin vê os botões da IA automática: '+btns);
      await shot(pg,`v9944-ia-auto-admin-${vp.width}.png`);if(P390)ok(await semRolar(pg),'390: IA automática sem rolagem lateral');
      const ex0=await pg.evaluate(()=>ETERNA.state.agent.treino.analise.exposicao);
      pg.once('dialog',dl=>dl.accept());await pg.click(`#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="${ex0==='ligada'?'off':'on'}"]`);await pg.waitForTimeout(1500);
      const cfgR=await pg.evaluate(async()=>{const r=await fetch('/status',{cache:'no-store',credentials:'same-origin'});const j=await r.json();return j.treino&&j.treino.analise;});
      notas.push(VP+' exposição '+ex0+' -> '+(cfgR&&cfgR.exposicao)+' (409 critério é esperado sem medidas)');
      // ponto: Desligado manda medir e o servidor guarda; Ajuste automático: o Admin muda e vira sim/autoAj no servidor
      if(!P390){await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="off"]');await pg.waitForTimeout(1800);
        const an=await pg.evaluate(async()=>(await (await fetch('/status',{cache:'no-store'})).json()).treino.analise);ok(an&&an.ponto==='medir','Admin: Desligado grava ponto=medir no servidor: '+J(an));
        const aj0=await pg.evaluate(()=>ETERNA.SIM.autoAj);await pg.click(`#tr-cfg [data-act="tr-cfg"][data-k="ajuste"][data-v="${aj0===false?'on':'off'}"]`);await pg.waitForTimeout(4500);
        const aj=JSON.parse(sqlite(path.join(E,'ponto','estado.db'),"select valor from doc where col='sim' and id='autoAj'"));ok(aj[0]&&aj[0][0]===(aj0===false?'true':'false'),'Admin: Ajuste automático chega ao servidor (sim/autoAj): '+J({aj0,aj}));
        await shot(pg,'v9944-ia-auto-admin-depois-1280.png');}
      // Minhas fotos (Admin): sem o seletor e com as sessões dos dois fotógrafos
      await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(2500);
      const mf=await pg.evaluate(()=>({sel:!!document.querySelector('#main [data-act="imp-key"],#main select[data-act="imp-fot"]'),txt:document.querySelector('#main').innerText}));
      ok(!/\bFotógrafo\s*\n?\s*(Todos|Carlos)/.test(mf.txt)&&!mf.sel,'Admin: Minhas fotos sem o seletor Fotógrafo');
      ok(/\bYago\b/.test(mf.txt)&&/\bCarlos\b/.test(mf.txt),'Admin vê as sessões de hoje dos dois fotógrafos');
      await shot(pg,`v9944-minhas-fotos-admin-${vp.width}.png`);if(P390&&!(await semRolar(pg)))notas.push('390: Minhas fotos rola para o lado pela pílula longa da sessão (já existia em 0148c95)');
      await ctx.close();
      // ================= Supervisora =================
      {const {ctx,pg}=await nova(vp);ok(await entrar(pg,'sup.srv@exemplo.com'),'Supervisora não entrou');
        const pode=await pg.evaluate(()=>ETERNA.canView('ia-auto'));if(pode){await pg.evaluate(()=>ETERNA.go('ia-auto'));await espera(pg,()=>!!document.querySelector('#tr-cfg'),8000);}
        const s=await pg.evaluate(()=>({btn:document.querySelectorAll('#tr-cfg [data-act="tr-cfg"]').length,pil:document.querySelectorAll('#tr-cfg .pill').length}));
        ok(pode&&s.btn===0&&s.pil>=2,'Supervisora vê a IA automática só com pílulas: '+J({pode,...s}));await shot(pg,`v9944-ia-auto-supervisora-${vp.width}.png`);
        const api=await pg.evaluate(async()=>{const p=(u,b)=>fetch(u,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>null)}));
          return {cfg:await p('/treino/config',{exposicao:'medir'}),aj:await p('/ponto/docs',{docs:[{col:'sim',id:'autoAj',valor:true}]})};});
        ok(api.cfg.s===403&&(api.cfg.j||{}).error==='so_admin','Supervisora: /treino/config 403 so_admin: '+J(api.cfg));
        const aj=JSON.parse(sqlite(path.join(E,'ponto','estado.db'),"select valor from doc where col='sim' and id='autoAj'"));
        ok(!(api.aj.j&&api.aj.j.gravados)&&!(aj[0]&&aj[0][0]==='true'),'Supervisora: sim/autoAj recusado: '+J({resp:api.aj,db:aj}));
        await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(2000);const t=await pg.evaluate(()=>document.querySelector('#main').innerText);
        notas.push(VP+' Supervisora Minhas fotos: '+(t.match(/\d+ sess(ões|ão)/)||[''])[0]);await ctx.close();}
      // ================= Fotógrafo =================
      {const {ctx,pg}=await nova(vp);ok(await entrar(pg,'foto.srv@exemplo.com'),'Fotógrafo não entrou');
        const v=await pg.evaluate(()=>({ia:ETERNA.canView('ia-auto'),tr:ETERNA.canView('treino')}));ok(!v.ia,'Fotógrafo não vê a IA automática: '+J(v));
        const api=await pg.evaluate(async()=>{const r=await fetch('/treino/config',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({exposicao:'medir'})});
          const a=await fetch('/ponto/docs',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({docs:[{col:'sim',id:'autoAj',valor:true}]})});return {cfg:r.status,aj:a.status,ajj:await a.json().catch(()=>null)};});
        ok(api.cfg===403,'Fotógrafo: /treino/config recusado: '+J(api));
        const aj=JSON.parse(sqlite(path.join(E,'ponto','estado.db'),"select valor from doc where col='sim' and id='autoAj'"));ok(!(aj[0]&&aj[0][0]==='true'),'Fotógrafo: sim/autoAj recusado: '+J({api,aj}));
        await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(2500);const t=await pg.evaluate(()=>document.querySelector('#main').innerText);
        const nf=(t.match(/(\d+) sess(ões|ão) ·/)||[])[1];notas.push(VP+' Fotógrafo Minhas fotos: '+nf);ok(!/\bYago\b/.test(t.split('BIBLIOTECA')[0]||t),'Fotógrafo (Carlos) vê sessão de outro fotógrafo nas Sessões de hoje');
        await shot(pg,`v9944-minhas-fotos-fotografo-${vp.width}.png`);await ctx.close();}
    }
    ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
  }catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,700));}
  finally{try{ag&&ag.kill();}catch(e){}await b.close();try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}}
  console.log((fails.length?'FALHA':'OK')+' v9944-treino-real: Treino com o agente de verdade (Gramado e resposta 3, troca de ponto, Enter sem escolha, observação), IA automática por perfil, sim/autoAj, Minhas fotos ('+notas.join('; ')+')'+(fails.length?' · '+fails.join(' | '):''));
  process.exit(fails.length?1:0);})();

