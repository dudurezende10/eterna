// 24/11 (plano docs/planos/2026-11-24-zerar-fase-teste.md): o cartão "Zerar fase de teste" no fim do Repositório, com o agente DE
// VERDADE (HOME temporário, modo de teste) servindo o app. Critérios 1 (só o Admin; Supervisor, "ver como" e app aberto por outra
// origem não veem), 2 (as línguas da equipe da tela, sem chave crua; as chaves têm as 5 do EQ), 3 (prévia), 4 (sem ZERAR exato nenhum POST sai) e o fluxo inteiro: o
// teste faz o papel do systemd e religa o agente; a aba do Admin e um Checkout #loja com cópia local antiga limpam só as chaves da
// zeragem e recarregam uma vez (22, 23). Nenhum dado de cliente: JPEG liso gerado aqui, ids inventados.
const {chromium}=require('playwright');const {spawn}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const net=require('net');
const entrarTeste=require('./_entrar');const S=require('./_agente_sessao');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const AG=path.join(__dirname,'..','agente','eterna-agente.py');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const livre=()=>new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
function get(porta,p){return new Promise(res=>{http.get({host:'127.0.0.1',port:porta,path:p},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>{let j=null;try{j=JSON.parse(Buffer.concat(ch).toString())}catch(e){}res({s:rs.statusCode,j});});}).on('error',()=>res({s:0}));});}
// um JPEG liso de 1 px (não é foto de ninguém)
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
function usuario(pg,email,nome,preset){return pg.evaluate(([e,n,p])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]={v:2,email:e,name:n,active:true,preset:p,perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p),key:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,preset]);}
(async()=>{const b=await chromium.launch();const errs=[];const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-zerar-'));let ag=null,log='';const porta=await livre(),ftp=await livre();
  const UA=`http://127.0.0.1:${porta}/index.html`;
  const sobe=async()=>{ag=spawn('python3',['-I','-u',AG],{env:{...process.env,HOME:home,USERPROFILE:home,ETERNA_PORTA:String(porta),ETERNA_FTP_PORTA:String(ftp),ETERNA_FTP_PASV:`${ftp+1}-${ftp+3}`,ETERNA_APP_ORIGIN:ORIG,
    ETERNA_SEM_OPENCV:'1',ETERNA_SEM_RECORTE:'1',ETERNA_MODO_TESTE:'1',ETERNA_ZERAR_HOJE:'2026-11-24',ETERNA_ZERAR_LIBERA:'',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'},stdio:['ignore','pipe','pipe']});
    ag.stdout.on('data',d=>log+=d);ag.stderr.on('data',d=>log+=d);for(let i=0;i<120;i++){await sleep(250);if((await get(porta,'/status')).s===200)return true;}return false;};
  const nova=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1366,height:h||900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
    pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};};
  const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(150);}return false;};
  const painel=pg=>pg.evaluate(()=>{const p=document.getElementById('zr-painel');return p?[...p.querySelectorAll('h2,h3,p,li,label,div.zr-aviso,div.zr-feito,div.zr-espera,button')].filter(e=>!e.querySelector('li')).map(e=>e.textContent.replace(/\s+/g,' ').trim()).join(' · '):null;});
  try{
    // semeadura: 2 fotos na inbox, uma sessão de outro dia e um pedido do Checkout
    const E=path.join(home,'Eterna');const dia='2026-11-20';fs.mkdirSync(path.join(E,'inbox',dia),{recursive:true});fs.mkdirSync(path.join(E,'ponto','sessoes'),{recursive:true});
    ['b0b0b0b0b001','b0b0b0b0b002'].forEach((p,i)=>fs.writeFileSync(path.join(E,'inbox',dia,`${p}_IMG_${i}.jpg`),PX));
    fs.writeFileSync(path.join(E,'ponto','sessoes',dia+'.json'),J({dia,sessoes:[{card:'LPZRTELA1',pids:['b0b0b0b0b001']}]}));
    fs.writeFileSync(path.join(E,'ftp.json'),J({users:{carlos:'x'.repeat(12)}}));
    ok(await sobe(),'o agente não subiu: '+log.slice(-400));const CK=S.sessao(home);const POSTO=S.posto(home,'Checkout de teste');

    // ---------- 1: aberto por outra origem (o site), o Admin não vê o cartão ----------
    {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);
      await pg.evaluate(()=>ETERNA.go('repo'));await pg.waitForTimeout(600);ok(await pg.$('#main h1')&&(await painel(pg))===null,'1: app de outra origem não mostra o cartão');await ctx.close();}

    // ---------- Admin no servidor: cartão, prévia, 5 línguas, ZERAR exato ----------
    const {ctx,pg}=await nova();await S.noNavegador(ctx,porta,[CK]);const posts=[];pg.on('request',r=>{if(/\/zerar\/fase-teste$/.test(r.url())&&r.method()==='POST')posts.push(r.url());});
    await pg.goto(UA);await pg.waitForTimeout(500);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);
    ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.url===location.origin,15000),'o app não achou o agente na própria origem');
    await pg.evaluate(()=>ETERNA.go('repo'));await espera(pg,()=>!!document.getElementById('zr-painel'),5000);
    let t=await painel(pg);ok(t&&/Zerar fase de teste/.test(t)&&/30 dias/.test(t)&&await pg.$('#zr-painel [data-act="zerar-previa"]'),'1: o Admin vê o cartão com a nota e o botão da prévia: '+t);
    const ult=await pg.evaluate(()=>{const p=document.getElementById('zr-painel');return p&&p===document.querySelector('#main').lastElementChild;});ok(ult,'1: o cartão fica no fim do Repositório');
    await pg.click('#zr-painel [data-act="zerar-previa"]');ok(await espera(pg,()=>!!ETERNA.state.zerar.previa,8000),'3: a prévia não chegou');await pg.waitForTimeout(150);
    const pv=await pg.evaluate(()=>ETERNA.state.zerar.previa);
    const li=await pg.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#zr-painel .zr-lista li')].map(l=>[l.closest('.zr-cols>div').querySelector('h3').textContent+'|'+l.dataset.k,l.querySelector('b').textContent])));
    const fmt=n=>new Intl.NumberFormat('pt-BR').format(n);
    ok(pv&&pv.vai.fotos>=2&&pv.vai.sessoes>=1&&Object.entries(pv.vai).every(([k,n])=>li['Vai para o arquivo|'+k]===fmt(n))&&Object.entries(pv.fica).every(([k,n])=>li['Fica como está|'+k]===fmt(n)),'3: contagens na tela iguais às do servidor: '+J({li,pv}));
    t=await painel(pg);ok(/Vai para o arquivo/.test(t)&&/Fica como está/.test(t)&&/Para confirmar, digite ZERAR/.test(t)&&await pg.$('#zr-painel [data-act="zerar-ir"].danger'),'3: listas, campo e botão vermelho: '+t);
    ok(!/—/.test(t),'texto sem travessão');
    // 2: as línguas da equipe na tela, sem chave crua
    const LS=await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]));ok(LS.length>=4,'línguas da equipe: '+J(LS));
    const vistos={};for(const l of [...LS.filter(x=>x!=='pt'),'pt']){await pg.evaluate(l=>{ETERNA.state.langEq=l;if(ETERNA.state.user)ETERNA.state.user.idioma=l;ETERNA.render();},l);await pg.waitForTimeout(80);
      const x=await painel(pg);vistos[l]=x;ok(x&&!/\bzr_[a-z_]+/.test(x),'2: chave crua em '+l+': '+x);}
    ok(new Set(Object.values(vistos)).size===LS.length,'2: o cartão muda com a língua: '+J(Object.keys(vistos)));
    const de=await pg.evaluate(()=>ETERNA.EQ.zr_titulo[ETERNA.LANGS.findIndex(x=>x[0]==='de')]);ok(de==='Testphase zurücksetzen','2: chaves com a 5ª língua (de) também');
    // revisão 24/11: o bloqueio "prazo" (botão só até 25/11) tem texto nas 5 línguas, sem travessão
    const pz=await pg.evaluate(()=>ETERNA.EQ.zr_bq_prazo);ok(Array.isArray(pz)&&pz.length===5&&pz.every(x=>x&&!/—/.test(x))&&/25\/11/.test(pz[0]),'prazo: zr_bq_prazo nas 5 línguas: '+J(pz));
    // 4: sem ZERAR exato, nenhum POST
    for(const v of ['zerar',' ZERAR ','ZERAR.','']){await pg.fill('#zr-txt',v);await pg.click('#zr-painel [data-act="zerar-ir"]');await pg.waitForTimeout(200);
      ok(/Digite ZERAR, em letras maiúsculas/.test(await painel(pg)),'4: aviso para "'+v+'"');}
    ok(posts.length===0,'4: saiu POST sem ZERAR exato: '+posts.length);
    // revisão 24/11: o texto digitado no #zr-txt (id + data-keep) e o foco sobrevivem a um redesenho da tela
    await pg.fill('#zr-txt','');await pg.click('#zr-txt');await pg.keyboard.type('ZER');await pg.evaluate(()=>ETERNA.render());await pg.keyboard.type('AR');
    {const k=await pg.evaluate(()=>{const a=document.activeElement;return {foco:a&&a.id,v:(document.getElementById('zr-txt')||{}).value};});ok(k.foco==='zr-txt'&&k.v==='ZERAR','zr-txt guarda texto e foco no render(): '+J(k));}
    // revisão 24/11: 403, 400 e 429 com aviso próprio (o servidor de verdade não é chamado aqui: a resposta vem do page.route)
    {const ROTA=`http://127.0.0.1:${porta}/zerar/fase-teste`;
      for(const [st,re] of [[403,/Só o Admin, no computador do servidor do ponto, pode zerar/],[400,/O servidor não aceitou a confirmação/],[429,/Muitas tentativas seguidas/],[500,/Não consegui falar com o servidor do ponto/]]){
        await pg.route(ROTA,r=>r.fulfill({status:st,contentType:'application/json',body:'{"error":"x"}'}));
        await pg.fill('#zr-txt','ZERAR');await pg.click('#zr-painel [data-act="zerar-ir"]');await espera(pg,()=>!ETERNA.state.zerar.enviando&&!!ETERNA.state.zerar.erro,5000);
        const x=await painel(pg);ok(re.test(x),'zerarIr '+st+': aviso próprio: '+x);await pg.unroute(ROTA);}
      for(const l of ['en','es','fr','de'])ok(await pg.evaluate(l=>{const i=ETERNA.LANGS.findIndex(x=>x[0]===l);return ['zr_erro_403','zr_erro_400','zr_erro_429'].every(k=>{const v=ETERNA.EQ[k]&&ETERNA.EQ[k][i];return typeof v==='string'&&v.length>10&&!/—/.test(v);});},l),'avisos do zerarIr em '+l);
      posts.length=0;await pg.evaluate(()=>{ETERNA.state.zerar.erro=null;ETERNA.render();});await pg.fill('#zr-txt','');}
    // 1: "ver como" e Supervisor não veem
    await pg.evaluate(()=>{ETERNA.state.assumido={usuario:'x',nome:'X'};ETERNA.render();});ok((await painel(pg))===null,'1: em "ver como" o cartão some');
    await pg.evaluate(()=>{ETERNA.state.assumido=null;ETERNA.render();});ok((await painel(pg))!==null,'o cartão volta fora do "ver como"');
    {const {ctx:c2,pg:p2}=await nova();await S.noNavegador(c2,porta,[CK]);await p2.goto(UA);await p2.waitForTimeout(400);await usuario(p2,'sup.zr@exemplo.com','Supervisora','supervisor');await p2.reload();await p2.waitForTimeout(300);
      await entrarTeste(p2,'sup.zr@exemplo.com');await espera(p2,()=>ETERNA.state.agent.on,10000);
      const v=await p2.evaluate(()=>{const ok=ETERNA.canView?ETERNA.canView('repo'):null;ETERNA.go('repo');return ok;});await p2.waitForTimeout(400);
      ok((await painel(p2))===null,'1: a Supervisora não vê o cartão (vê a tela: '+v+')');await c2.close();}

    // ---------- 22 e 23: Checkout #loja com cópia local antiga ----------
    const {ctx:cl,pg:pl}=await nova();await S.noNavegador(cl,porta,[POSTO]);let cargas=0;pl.on('load',()=>cargas++);
    await pl.goto(UA+'#loja');await pl.waitForTimeout(1500);
    await pl.evaluate(()=>{const S0=ETERNA.SIM;S0.sessions=S0.sessions||{};S0.sessions.LPANTIGOZR={status:'paga',photos:[]};ETERNA.saveSim();
      localStorage.setItem('eterna.edvistas.v1',JSON.stringify({marca:'antiga'}));localStorage.setItem('eterna.treino.fila.v1',JSON.stringify([{marca:'treino'}]));localStorage.setItem('eterna.idioma.teste','es');});
    await pg.evaluate(()=>{ETERNA.SIM.sessions=ETERNA.SIM.sessions||{};ETERNA.SIM.sessions.LPANTIGOZR={status:'paga',photos:[]};ETERNA.saveSim();});
    const sessAntes=await pg.evaluate(()=>localStorage.getItem('eterna.session'));
    // ---------- fluxo inteiro: ZERAR, o servidor sai, o teste religa ----------
    cargas=0;let cargasAdm=0;pg.on('load',()=>cargasAdm++);
    await pg.fill('#zr-txt','ZERAR');await pg.click('#zr-painel [data-act="zerar-ir"]');
    ok(await espera(pg,()=>!!ETERNA.state.zerar.espera,8000),'o pedido não foi aceito: '+J(await pg.evaluate(()=>ETERNA.state.zerar)));
    const zid=await pg.evaluate(()=>ETERNA.state.zerar.espera&&ETERNA.state.zerar.espera.id);ok(/^fase-teste-\d{8}-\d{4}$/.test(zid||''),'id da zeragem: '+zid);
    ok(/O servidor está reiniciando/.test(await painel(pg)||''),'tela de espera: '+await painel(pg));
    ok(posts.length===1,'um POST só: '+posts.length);
    const aud=await pg.evaluate(()=>{const l=JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]');return l.find(x=>x.acao==='zerar_fase_teste');});
    ok(aud&&aud.contagens&&aud.contagens.fotos===pv.vai.fotos&&Object.values(aud.contagens).every(x=>typeof x==='number'),'auditLog só com números: '+J(aud));
    const saiu=await new Promise(r=>{const t=setTimeout(()=>r(false),6000);ag.once('exit',()=>{clearTimeout(t);r(true);});});ok(saiu,'7: o agente não saiu em 5 s');
    await sleep(500);ok(await sobe(),'o agente não voltou depois da zeragem: '+log.slice(-600));
    ok((await get(porta,'/status')).j.zerada===zid,'/status.zerada');
    ok(await espera(pg,z=>localStorage.getItem('eterna.zerada.v1')===z&&!!window.ETERNA&&ETERNA.state.view==='repo'&&!!document.getElementById('zr-painel'),60000,zid),'22: a aba do Admin não limpou e voltou');
    await espera(pg,()=>ETERNA.state.agent.on,15000);
    const adm=await pg.evaluate(()=>({sim:!!(ETERNA.SIM.sessions||{}).LPANTIGOZR,sess:localStorage.getItem('eterna.session')}));
    ok(!adm.sim&&adm.sess===sessAntes&&cargasAdm===1,'22: Admin sem a sessão antiga, com o login e uma recarga só: '+J({...adm,sess:!!adm.sess,cargasAdm}));
    await pg.click('#zr-painel [data-act="zerar-previa"]').catch(()=>{});await espera(pg,()=>!!(ETERNA.state.zerar.previa&&ETERNA.state.zerar.previa.ultima),8000);
    t=await painel(pg);ok(/Zerado em \d\d\/\d\d\/\d{4} \d\d:\d\d por admin-teste\. Arquivo no servidor: arquivo\/fase-teste-/.test(t)&&/guardado até \d\d\/\d\d\/\d{4}/.test(t)
      &&/A fase de teste já foi zerada/.test(t)&&!(await pg.$('#zr-txt')),'cartão depois: zerado, uso único, sem campo: '+t);
    ok(await espera(pl,z=>localStorage.getItem('eterna.zerada.v1')===z,60000,zid),'22: o Checkout não limpou');await pl.waitForTimeout(8000);
    const loja=await pl.evaluate(()=>({sim:!!((window.ETERNA&&ETERNA.SIM.sessions)||{}).LPANTIGOZR,ed:localStorage.getItem('eterna.edvistas.v1')||'',tr:localStorage.getItem('eterna.treino.fila.v1'),
      id:localStorage.getItem('eterna.idioma.teste'),rota:location.hash}));
    ok(!loja.sim&&!/antiga/.test(loja.ed)&&/treino/.test(loja.tr||'')&&loja.id==='es'&&loja.rota==='#loja'&&cargas===1,'22: Checkout limpo só nas chaves da zeragem, uma recarga: '+J({...loja,cargas}));
    await cl.close();
    // 23: nenhuma sessão nem foto do teste nas telas do servidor
    const bib=await pg.evaluate(async()=>{const r=await fetch('/biblioteca',{credentials:'same-origin'});return r.status===200?(await r.json()).fotos.length:-1;});
    ok(bib===0,'23: biblioteca vazia depois: '+bib);
    await ctx.close();
    ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
  }catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,600));}
  finally{try{ag&&ag.kill();}catch(e){}await b.close();try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}}
  console.log((fails.length?'FALHA':'OK')+' zerar-fase-teste: cartão só do Admin (outra origem, ver como, Supervisora), línguas da equipe, prévia, ZERAR exato, fluxo com o agente religado, limpeza do Admin e do Checkout #loja'+(fails.length?' · '+fails.join(' | '):''));
  process.exit(fails.length?1:0);})();
