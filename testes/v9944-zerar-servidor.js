// v99.44.0 (testador, 24/11): "Zerar fase de teste" de ponta a ponta num HOME com a cara do servidor do estádio.
// - inbox, recortes, montagens e ativ-* são links para outra pasta (a "mídia"; com V9944_MIDIA apontando para outro disco, como o HD de 4 TB)
// - o agente roda num laço de reinício com INVOCATION_ID (o papel do systemd), SEM ETERNA_MODO_TESTE
// - login de verdade (usuário e senha no estado.db), Admin aperta o botão pelo app; Supervisora, Fotógrafo e "ver como" não conseguem
// - confere item por item o que foi para o arquivo e o que ficou, a volta sozinha do agente, a recarga única e a limpeza de cada
//   navegador (Admin, Posto e Checkout #loja) e o desfazer pela linha de comando.
// Nenhuma foto de visitante: JPEG liso gerado no ajudante testes/_v9944_servidor.py.
const {chromium}=require('playwright');const {spawn,execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');const crypto=require('crypto');
const S=require('./_agente_sessao');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');const AJ=path.join(__dirname,'_v9944_servidor.py');
const SHOTS=path.join(__dirname,'prints');
const fails=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const livre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
function req(porta,metodo,p,corpo,h){return new Promise(res=>{const d=corpo?Buffer.from(J(corpo)):null;const r=http.request({host:'127.0.0.1',port:porta,method:metodo,path:p,headers:Object.assign({Host:'127.0.0.1:'+porta},d?{'Content-Type':'application/json','Content-Length':d.length}:{},h||{})},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{let j=null;try{j=JSON.parse(Buffer.concat(ch).toString())}catch(e){}res({s:rs.statusCode,j});});});r.on('error',()=>res({s:0}));if(d)r.write(d);r.end();});}
(async()=>{const b=await chromium.launch();const errs=[];const home=fs.mkdtempSync(path.join(os.tmpdir(),'v9944-srv-'));const midia=process.env.V9944_MIDIA||path.join(home,'midia-hd');
  const ftp=path.join(home,'ftp-pasta');fs.mkdirSync(ftp,{recursive:true});fs.mkdirSync(midia,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
  const porta=await livre(),ftpP=await livre();const UA=`http://127.0.0.1:${porta}/index.html`;const LOG=path.join(home,'agente.log');let laco=null;
  const senha='t'+crypto.randomBytes(9).toString('hex');
  const envAg={...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(ftpP),ETERNA_FTP_PASV:`${ftpP+1}-${ftpP+3}`,ETERNA_APP_ORIGIN:ORIG,
    ETERNA_SEM_OPENCV:'1',ETERNA_SEM_RECORTE:'1',ETERNA_PASTA:ftp,USER:'v9944-sem-cartao',INVOCATION_ID:'v9944-systemd-falso',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'};
  delete envAg.ETERNA_MODO_TESTE;delete envAg.ETERNA_ZERAR_FALHA_PASSO;
  const py=(args,extra)=>execFileSync('python3',['-I',AJ,AG,...args],{env:{...envAg,...(extra||{})},timeout:120000}).toString().trim().split('\n').pop();
  const retrato=()=>JSON.parse(py(['retrato']));
  // "systemd": religa o agente sempre que ele sai (Restart=always, RestartSec curto)
  const sobeLaco=()=>{laco=spawn('bash',['-c',`while [ ! -e "$H/parar-laco" ]; do echo "== partida $(date +%s)" >> "$H/agente.log"; python3 -I -u "$AG" >> "$H/agente.log" 2>&1; echo "== saiu $?" >> "$H/agente.log"; sleep 1; done`],
    {env:{...envAg,H:home,AG},detached:true,stdio:'ignore'});};
  const paraLaco=async()=>{try{fs.writeFileSync(path.join(home,'parar-laco'),'');}catch(e){}if(laco){try{process.kill(-laco.pid,'SIGTERM');}catch(e){}}
    for(let i=0;i<40;i++){if((await req(porta,'GET','/status')).s===0)break;await sleep(250);}try{fs.unlinkSync(path.join(home,'parar-laco'));}catch(e){}laco=null;};
  const statusOk=async ms=>{const t0=Date.now();while(Date.now()-t0<(ms||60000)){const r=await req(porta,'GET','/status');if(r.s===200)return r.j;await sleep(250);}return null;};
  const logTxt=()=>{try{return fs.readFileSync(LOG,'utf8');}catch(e){return '';}};
  const nova=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1280,height:h||900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
    pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};};
  const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(200);}return false;};
  const entrar=async(pg,usuario)=>{await pg.goto(UA);await pg.waitForSelector('[data-act="login-usuario"]',{timeout:20000});await pg.fill('[data-act="login-usuario"]',usuario);await pg.fill('[data-act="login-senha"]',senha);
    await pg.click('form[data-form="login-entrar"] button[type=submit]');return espera(pg,()=>!!(window.ETERNA&&ETERNA.state.user),15000);};
  try{
    // ---------- semeadura ----------
    {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(400);
      const pre=await pg.evaluate(()=>Object.fromEntries(['admin','supervisor','foto'].map(p=>[p==='foto'?'fotografo':p,{perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p),inicio:(ETERNA.PRESETS&&ETERNA.PRESETS[p]&&ETERNA.PRESETS[p].inicio)||null}])));
      fs.writeFileSync(path.join(home,'presets.json'),J(pre));await ctx.close();}
    const sem=JSON.parse(py(['semeia',midia,path.join(home,'presets.json'),senha]));ok(sem.ok,'semeadura');
    // 2 fotos do teste chegando pela pasta do FTP (vsftpd) nas últimas 12 h: entram hoje e não podem voltar depois da zeragem
    for(let i=0;i<2;i++)fs.copyFileSync(path.join(home,'Eterna','inbox','2026-11-20',fs.readdirSync(path.join(home,'Eterna','inbox','2026-11-20'))[i]),path.join(ftp,`FTP_${i}.JPG`));
    // muda o conteúdo para não cair como repetida das da inbox (outro hash), mas segue sem rosto de ninguém
    for(let i=0;i<2;i++){const f=path.join(ftp,`FTP_${i}.JPG`);const x=fs.readFileSync(f);fs.writeFileSync(f,Buffer.concat([x.slice(0,x.length-2),Buffer.from([i,i]),x.slice(x.length-2)]));}
    sobeLaco();ok(await statusOk(60000),'o agente não subiu no laço: '+logTxt().slice(-500));
    {const t0=Date.now();while(Date.now()-t0<20000){if(fs.readdirSync(ftp).length===0||fs.existsSync(path.join(home,'Eterna','index.json')))break;await sleep(300);}await sleep(2500);}
    let A=retrato();
    ok(A.links.inbox&&A.links.recortes&&A.links.montagens,'a inbox, os recortes e as montagens são links (como no servidor)');
    const hojeInbox=(A.pastas.inbox||[]).filter(x=>!/^2026-11-2[012]/.test(x));ok(hojeInbox.length>=2,'as fotos da pasta do FTP entraram hoje: '+J(hojeInbox));
    // ---------- Supervisora, Fotógrafo e "ver como" não conseguem ----------
    const tenta=pg=>pg.evaluate(async()=>{const a=await fetch('/zerar/previa',{credentials:'same-origin'});const p=await fetch('/zerar/fase-teste',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({confirma:'ZERAR'})});
      return {previa:a.status,post:p.status,card:!!document.getElementById('zr-painel')};});
    for(const [u,nome] of [['sup.srv@exemplo.com','Supervisora'],['foto.srv@exemplo.com','Fotógrafo']]){const {ctx,pg}=await nova(390,844);ok(await entrar(pg,u),nome+' não entrou com a senha');
      await espera(pg,()=>ETERNA.state.agent.on,15000);await pg.evaluate(()=>{try{ETERNA.go('repo');}catch(e){}});await pg.waitForTimeout(600);
      const r=await tenta(pg);ok(r.previa===403&&r.post===403&&!r.card,nome+' não pode zerar: '+J(r));await ctx.close();}
    const {ctx,pg}=await nova(1280,900);ok(await entrar(pg,'admin.srv@exemplo.com'),'o Admin não entrou com a senha');
    ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.url===location.origin,20000),'o app do Admin não achou o agente');
    {const r=await pg.evaluate(async()=>{const a=await fetch('/auth/assumir',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({usuario:'sup.srv@exemplo.com'})});
      const p=await fetch('/zerar/fase-teste',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:JSON.stringify({confirma:'ZERAR'})});
      const v=await fetch('/auth/voltar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Eterna':'1'},body:'{}'});return {assumir:a.status,post:p.status,voltar:v.status};});
      ok(r.assumir===200&&r.post===403&&r.voltar===200,'"ver como" de verdade (/auth/assumir) não zera: '+J(r));}
    ok(!fs.existsSync(path.join(home,'Eterna','ponto','zerar-pedido.json')),'nenhuma recusa gravou pedido');
    // ---------- Posto (Caixa) e Checkout #loja abertos, com cópia local antiga ----------
    const CKP=S.posto(home,'Caixa 2');const {ctx:cl,pg:pl}=await nova(1280,800);await S.noNavegador(cl,porta,[CKP]);let cargasL=0;pl.on('load',()=>cargasL++);
    await pl.goto(UA+'#loja');await pl.waitForTimeout(2500);
    await pl.evaluate(()=>{const S0=ETERNA.SIM;S0.sessions=S0.sessions||{};S0.sessions.LPANTIGOSRV={status:'paga',photos:[]};ETERNA.saveSim();
      localStorage.setItem('eterna.ponto.fila.v1',JSON.stringify([{marca:'venda-antiga'}]));localStorage.setItem('eterna.faces.v3','{"antigo":1}');localStorage.setItem('eterna.treino.fila.v1',JSON.stringify([{marca:'treino'}]));});
    const lojaAntes=await pl.evaluate(()=>Object.keys(localStorage).sort());
    await pg.evaluate(()=>{ETERNA.SIM.sessions=ETERNA.SIM.sessions||{};ETERNA.SIM.sessions.LPANTIGOSRV={status:'paga',photos:[]};ETERNA.saveSim();localStorage.setItem('eterna.agcur','{"x":1}');});
    const admAntes=await pg.evaluate(()=>({keys:Object.keys(localStorage).sort(),sess:localStorage.getItem('eterna.session')}));
    // ---------- prévia pelo app ----------
    await pg.evaluate(()=>ETERNA.go('repo'));ok(await espera(pg,()=>!!document.getElementById('zr-painel'),8000),'o Admin não vê o cartão no servidor');
    await pg.click('#zr-painel [data-act="zerar-previa"]');ok(await espera(pg,()=>!!ETERNA.state.zerar.previa,10000),'a prévia não chegou');
    A=retrato();notas.push('antes: inbox '+(A.pastas.inbox||[]).length+' arquivos, '+A.sessoes+' sessões');
    await pg.click('#zr-painel [data-act="zerar-previa"]');await pg.waitForTimeout(1500);
    const pv=await pg.evaluate(()=>ETERNA.state.zerar.previa);
    ok(pv.pode===true&&(pv.bloqueios||[]).length===0,'prévia sem bloqueio no servidor com systemd: '+J(pv.bloqueios));
    const fotosDisco=(A.pastas.inbox||[]).filter(x=>/\/[0-9a-f]{12}_/.test(x)).length;
    const esp={fotos:fotosDisco,miniaturas:(A.pastas.thumbs||[]).length,sessoes:A.sessoes,vendas:2,eventos:3,pedidos:3,galerias:2,rostos:3,rostos_fotos:2,poses:2,dias_metricas:(A.pastas['ponto/metricas']||[]).length,visitas:(A.pastas['ponto/visitas']||[]).length,recortes:1,montagens:2,selfies:2,
      fotografo_dias:2,fila_nuvem:2,ativ_vendas:2,ativ_entregas:2,ativ_videos:1,cartoes_bloqueados:2};
    const dif=Object.fromEntries(Object.entries(esp).filter(([k,v])=>pv.vai[k]!==v).map(([k,v])=>[k,[pv.vai[k],v]]));
    ok(!Object.keys(dif).length,'prévia (vai) diferente do que foi semeado [tela, esperado]: '+J(dif));
    const fesp={leitores:1,treino_marcacoes:4,dias_roverpix:2,dias_entradas:2,cartoes:1,ativ_vendas_antigas:1};
    const fdif=Object.fromEntries(Object.entries(fesp).filter(([k,v])=>pv.fica[k]!==v).map(([k,v])=>[k,[pv.fica[k],v]]));ok(!Object.keys(fdif).length,'prévia (fica) [tela, esperado]: '+J(fdif));ok(pv.fica.usuarios>=3,'prévia: usuários');
    await pg.screenshot({path:path.join(SHOTS,'v9944-zerar-previa-1280.png'),fullPage:true});
    // ---------- ZERAR ----------
    let cargasAdm=0;pg.on('load',()=>cargasAdm++);cargasL=0;const partidasAntes=(logTxt().match(/== partida/g)||[]).length;
    await pg.fill('#zr-txt','ZERAR');const t0=Date.now();await pg.click('#zr-painel [data-act="zerar-ir"]');
    ok(await espera(pg,()=>!!ETERNA.state.zerar.espera,8000),'o pedido não foi aceito: '+J(await pg.evaluate(()=>ETERNA.state.zerar)));
    const zid=await pg.evaluate(()=>ETERNA.state.zerar.espera.id);await pg.screenshot({path:path.join(SHOTS,'v9944-zerar-espera-1280.png')});
    ok(await espera(pg,z=>localStorage.getItem('eterna.zerada.v1')===z&&!!window.ETERNA&&!!ETERNA.state.user,120000,zid),'a aba do Admin não limpou nem voltou em 2 min');
    const seg=Math.round((Date.now()-t0)/1000);notas.push('Admin de volta em '+seg+' s');
    const st=await statusOk(5000);ok(st&&st.zerada===zid,'/status.zerada = id: '+J(st&&st.zerada));
    const partidas=(logTxt().match(/== partida/g)||[]).length-partidasAntes;ok(partidas===1,'o laço religou o agente uma vez só (a zeragem reexecuta por execv): '+partidas);
    ok(/zerar: .* feito/.test(logTxt()),'linha de "feito" no console');
    await espera(pg,()=>ETERNA.state.agent.on,20000);await pg.waitForTimeout(6000);
    const admDep=await pg.evaluate(()=>({keys:Object.keys(localStorage).sort(),sess:localStorage.getItem('eterna.session'),sim:!!((ETERNA.SIM.sessions||{}).LPANTIGOSRV),view:ETERNA.state.view,user:!!ETERNA.state.user}));
    const LIMPA=['eterna.sim.v1','eterna.faces.v3','eterna.ponto.fila.v1','eterna.ponto.descartes.v1','eterna.ponto.conflitos.v1','eterna.edvistas.v1','eterna.agcur'];
    const sumiramAdm=admAntes.keys.filter(k=>!admDep.keys.includes(k)&&!LIMPA.includes(k));
    ok(!admDep.sim&&admDep.user&&admDep.sess===admAntes.sess&&cargasAdm===1&&!sumiramAdm.length,'Admin: limpa só o que deve, segue logado, uma recarga: '+J({sim:admDep.sim,cargasAdm,sumiramAdm,view:admDep.view}));
    ok(await espera(pl,z=>localStorage.getItem('eterna.zerada.v1')===z,60000,zid),'o Checkout #loja não limpou');await pl.waitForTimeout(8000);
    const lojaDep=await pl.evaluate(()=>({keys:Object.keys(localStorage).sort(),sim:!!(((window.ETERNA&&ETERNA.SIM.sessions)||{}).LPANTIGOSRV),fila:localStorage.getItem('eterna.ponto.fila.v1'),tr:localStorage.getItem('eterna.treino.fila.v1'),hash:location.hash}));
    const sumiramL=lojaAntes.filter(k=>!lojaDep.keys.includes(k)&&!LIMPA.includes(k));
    ok(!lojaDep.sim&&!/venda-antiga/.test(lojaDep.fila||'')&&/treino/.test(lojaDep.tr||'')&&lojaDep.hash==='#loja'&&cargasL===1&&!sumiramL.length,'Checkout: limpa só o que deve, uma recarga: '+J({...lojaDep,keys:undefined,cargasL,sumiramL}));
    await pl.screenshot({path:path.join(SHOTS,'v9944-zerar-checkout-depois-1280.png')});await cl.close();
    // ---------- item por item ----------
    const D=retrato();const arq=path.join(home,'Eterna','arquivo',zid);const am=path.join(fs.realpathSync(path.join(home,'Eterna','inbox')),'.arquivo',zid);
    const vazia=k=>{const l=(D.pastas[k]||[]).filter(x=>!x.startsWith('.'));return l;};
    for(const k of ['recortes','montagens','ativ-videos','ativ-clientes','thumbs','galerias','ponto/sessoes'])ok(D.pastas[k]&&!vazia(k).length,k+' vazia depois: '+J(vazia(k)));
    ok(!vazia('inbox').length,'inbox vazia depois (nem as do FTP voltaram): '+J(vazia('inbox')));
    const hj=new Date().toISOString().slice(0,10);ok(!(D.pastas['ponto/metricas']||[]).some(x=>x<hj.slice(0,8)+'00'&&/^2026-11-2[0-2]/.test(x)),'métricas antigas foram para o arquivo: '+J(D.pastas['ponto/metricas']));
    ok(D.links.inbox&&D.links.recortes&&D.links.montagens&&D.links['ativ-videos'],'os links para o HD continuam links');
    ok(D.pastas.impressao.join()==='imprimir.ps1','impressão: só o .ps1 ficou: '+J(D.pastas.impressao));
    for(const a of ['envio-dia.json','leitor-dia.json','ponto/visitas-log.jsonl','ponto/visitas-calibracao.jsonl'])ok(!D.arqs[a],'foi para o arquivo: '+a);
    ok(!/"fotos":6/.test(D.metricas_jsonl)&&!(A.pastas.inbox||[]).some(x=>D.metricas_jsonl.includes(x.split('/').pop().slice(0,12))),'metricas.jsonl de novo sem as linhas do teste');
    ok(fs.existsSync(path.join(arq,'home','meta.json'))&&fs.existsSync(path.join(arq,'home','metricas.jsonl')),'meta.json e metricas.jsonl no arquivo');
    for(const a of ['index.json','lgpd-excluidas.json','lgpd.log','ftp.json','agenda-fonte.json','ponto/poses-sha.json'])ok(D.arqs[a],'ficou: '+a);
    const n=D.n;ok(n.evento===0&&n.selfie===0&&n.ativ_eterna===0&&n.ativ_entrega===0&&n.ativ_pulseira===0&&n.ativ_foto===0&&n.fotografo_dia===0&&n.fotografo_mes===0&&n.montagem_vista===0
      &&n.fila===0&&n.galerias_nuvem===0&&n.videos===0&&n.pedido===0&&!n.rostos&&!n.poses&&n.feito===0&&n.arquivado===6,'tabelas que apagam: '+J(n));
    ok(n.ativ_antigo===1&&n.rotulo===4&&n.cena===A.n.cena&&n.modelo===1&&n.cartao_fase_teste===2&&n.lote_fase_teste==='cancelado','o que fica e os cartões: '+J(n));
    const shaDif=Object.keys(A.sha).filter(k=>A.sha[k]!==D.sha[k]);ok(!shaDif.length,'mudou o que devia ficar idêntico: '+J(shaDif));
    for(const k of ['roverpix','fundos','fundos-ia','ativ-demo'])ok(J(A.pastas[k])===J(D.pastas[k]),k+' igual');
    ok(fs.existsSync(path.join(arq,'bancos','vendas.db'))&&fs.existsSync(path.join(arq,'home','rostos.db'))&&fs.existsSync(path.join(arq,'home','ponto','poses.db'))&&fs.existsSync(path.join(arq,'home','galerias','vendas-online.jsonl')),'bancos, rostos, poses e vendas online no arquivo do NVMe');
    ok(fs.existsSync(path.join(am,'inbox','2026-11-20'))&&fs.readdirSync(path.join(am,'inbox','2026-11-20')).length===6&&fs.existsSync(path.join(am,'montagens','vendidas')),'originais e montagens no arquivo do HD');
    ok((fs.statSync(arq).mode&0o777)===0o700&&(fs.statSync(am).mode&0o777)===0o700,'pastas de arquivo 0700');
    if(process.env.V9944_MIDIA)ok(fs.statSync(am).dev!==fs.statSync(arq).dev,'mídia em outro disco (como o HD)');
    // ---------- as telas e as rotas depois ----------
    const rot=await pg.evaluate(async()=>{const g=async p=>{try{const r=await fetch(p,{credentials:'same-origin'});return {s:r.status,j:await r.json()};}catch(e){return {s:0};}};
      const bib=await g('/biblioteca'),ses=await g('/sessoes'),fd=await g('/fotografos/dias?de=2026-11-20&ate=2026-11-22'),pr=await g('/zerar/previa');return {bib:bib.j&&bib.j.fotos&&bib.j.fotos.length,ses:ses.j&&(ses.j.sessoes||[]).length,fd:fd.s,pr:pr.j};});
    ok(rot.bib===0&&rot.ses===0,'biblioteca e sessões vazias: '+J({bib:rot.bib,ses:rot.ses}));
    ok(rot.pr&&rot.pr.ultima&&rot.pr.ultima.id===zid&&(rot.pr.bloqueios||[]).includes('ja_zerado'),'prévia depois: última zeragem e ja_zerado');
    await pg.evaluate(()=>ETERNA.go('repo'));await pg.waitForTimeout(400);await pg.click('#zr-painel [data-act="zerar-previa"]').catch(()=>{});await espera(pg,()=>!!(ETERNA.state.zerar.previa&&ETERNA.state.zerar.previa.ultima),8000);
    await pg.screenshot({path:path.join(SHOTS,'v9944-zerar-feito-1280.png'),fullPage:true});
    for(const v of ['painel','importar','fotofila','estatisticas','posto']){await pg.evaluate(v=>ETERNA.go(v),v);await pg.waitForTimeout(900);
      const t=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(!/LPSRV|LPANTIGOSRV/.test(t),'tela '+v+' mostra sessão do teste');}
    await ctx.close();
    // ---------- desfazer (com o agente parado) ----------
    const r1=(()=>{try{execFileSync('python3',['-I',AG,'--desfazer-zeragem',zid],{env:envAg,timeout:60000});return 0;}catch(e){return e.status;}})();ok(r1===3,'desfazer com o agente no ar recusa: '+r1);
    await paraLaco();
    const r2=(()=>{try{return {rc:0,out:execFileSync('python3',['-I',AG,'--desfazer-zeragem',zid],{env:envAg,timeout:60000}).toString()};}catch(e){return {rc:e.status,out:String(e.stdout||'')+String(e.stderr||'')};}})();
    ok(r2.rc===0,'desfazer: '+J(r2).slice(0,400));
    const V=retrato();
    const volta=['inbox','recortes','montagens','ativ-videos','ativ-clientes','thumbs','galerias','ponto/sessoes'].filter(k=>J((V.pastas[k]||[]).sort())!==J((A.pastas[k]||[]).sort()));
    ok(!volta.length,'desfazer devolveu as pastas como antes: '+J(volta.map(k=>[k,(A.pastas[k]||[]).length,(V.pastas[k]||[]).length])));
    const nd=Object.keys(A.n).filter(k=>!['cartao_fase_teste','lote_fase_teste','arquivado'].includes(k)&&A.n[k]!==V.n[k]);ok(!nd.length,'desfazer: contagens dos bancos como antes: '+J(nd.map(k=>[k,A.n[k],V.n[k]])));
    sobeLaco();ok(await statusOk(60000),'o agente não subiu depois do desfazer');const st2=(await req(porta,'GET','/status')).j;ok(st2&&st2.zerada===null,'/status sem zerada depois do desfazer: '+J(st2&&st2.zerada));
    {const {ctx:c3,pg:p3}=await nova(1280,900);ok(await entrar(p3,'admin.srv@exemplo.com'),'Admin não entrou depois do desfazer');await espera(p3,()=>ETERNA.state.agent.on,15000);
      const pv2=await p3.evaluate(async()=>(await (await fetch('/zerar/previa',{credentials:'same-origin'})).json()));
      const d2=Object.keys(pv.vai).filter(k=>k!=='cartoes_bloqueados'&&pv.vai[k]!==pv2.vai[k]);ok(!d2.length,'prévia depois do desfazer igual à de antes: '+J(d2.map(k=>[k,pv.vai[k],pv2.vai[k]])));await c3.close();}
    ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
  }catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,800));}
  finally{await paraLaco();await b.close();if(!process.env.V9944_MANTER)try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}else console.log('HOME mantido: '+home);}
  console.log((fails.length?'FALHA':'OK')+' v9944-zerar-servidor: HOME com cara de servidor, laço de reinício, botão pelo Admin, só o Admin, item por item, navegadores, desfazer'+(notas.length?' ('+notas.join('; ')+')':'')+(fails.length?' · '+fails.join(' | '):''));
  process.exit(fails.length?1:0);})();
