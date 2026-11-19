// 18/11: leitores de cartão do gramado na tela (critérios 25 a 28 do plano docs/planos/2026-11-18-leitor-cartao-gramado.md).
// Painel "Leitores de cartão" em Painel de controle › Avançado (configuracao.r vê, configuracao.u cadastra, gera código e desativa),
// linha do leitor em Minhas fotos para o Fotógrafo (set.r), textos lt_* nas 5 línguas. Agente falso por page.route na própria origem.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const agora=()=>Math.floor(Date.now()/1000);
const COMPLETA=()=>[
  {id:'l_aaaa0001',nome:'Gramado 1',situacao:'ligado',ultimo_contato:agora()-5,cartao:{rotulo:'EOS_DIGITAL',estado:'lendo',total:340,copiadas:20,ja_tinha:100,enviadas:6,sem_dono:2,puladas:1,em:agora()-60},
   fila:{n:34,mb:510.4,parada_s:0},erro:null,versao:'2026-11-18',livre_gb:120,maquina:'GRAMADO-PC1',ip_ultimo:'192.168.10.41',criado_por:'admin',criado_em:agora()-3600,ativado_em:agora()-3500,revogado_em:null},
  {id:'l_aaaa0002',nome:'Gramado 2',situacao:'desligado',ultimo_contato:agora()-400,cartao:{rotulo:'CARLOS',estado:'pronto',total:50,copiadas:5,ja_tinha:45,enviadas:5,sem_dono:0,em:agora()-500},
   fila:{n:3,mb:40,parada_s:900},erro:'rede',versao:'2026-11-18',livre_gb:80,maquina:'GRAMADO-PC2',ip_ultimo:'192.168.10.42',criado_por:'admin',criado_em:agora()-3600,ativado_em:agora()-3500,revogado_em:null},
  {id:'l_aaaa0003',nome:'Gramado 3',situacao:'aguardando',ultimo_contato:null,cartao:null,fila:null,erro:null,versao:null,livre_gb:null,maquina:null,ip_ultimo:null,criado_por:'admin',criado_em:agora()-60,ativado_em:null,revogado_em:null},
  {id:'l_aaaa0004',nome:'Antigo',situacao:'revogado',ultimo_contato:agora()-90000,cartao:null,fila:{n:5,mb:12,parada_s:null},erro:null,versao:'2026-11-18',livre_gb:null,maquina:'VELHO',ip_ultimo:'192.168.10.9',criado_por:'admin',criado_em:agora()-99999,ativado_em:agora()-99000,revogado_em:agora()-86400}];
// o que o servidor manda para quem só tem Upload (set.r): sem IP, máquina, versão e sem os desativados
const REDUZIDA=()=>COMPLETA().filter(x=>x.situacao!=='revogado').map(x=>({id:x.id,nome:x.nome,situacao:x.situacao,ultimo_contato:x.ultimo_contato,
  cartao:x.cartao?{rotulo:x.cartao.rotulo,estado:x.cartao.estado,em:x.cartao.em,total:x.cartao.total,copiadas:x.cartao.copiadas}:null,fila:x.fila?{n:x.fila.n,parada_s:x.fila.parada_s}:null,erro:x.erro}));
async function agente(ctx,M){
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bL',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gL',hoje:0,abertas:0},envio:{v:1,max_mb:60,novas:0,repetidas:0,recusadas:0}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"grupos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'gL',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]})}));
  await ctx.route(ORIG+'/postos',r=>r.fulfill({status:200,contentType:'application/json',body:'{"postos":[]}'}));
  await ctx.route(ORIG+'/leitores',r=>{M.gets++;r.fulfill({status:200,contentType:'application/json',body:J({leitores:M.lista()})});});
  await ctx.route(ORIG+'/leitores/criar',r=>{const b=r.request().postDataJSON()||{};M.posts.push(['criar',b,r.request().headers()['x-eterna']]);
    if(b.nome==='Carlos')return r.fulfill({status:400,contentType:'application/json',body:'{"erro":"nome"}'});
    r.fulfill({status:200,contentType:'application/json',body:J({leitor:{id:'l_bbbb0001',nome:b.nome},codigo:'ABCD-EFGH-JKLM-NPQR-STUV',expira:agora()+600})});});
  await ctx.route(ORIG+'/leitores/codigo',r=>{M.posts.push(['codigo',r.request().postDataJSON()]);r.fulfill({status:200,contentType:'application/json',body:J({codigo:'WXYZ-2345-6789-ABCD-EFGH',expira:agora()+600})});});
  await ctx.route(ORIG+'/leitores/revogar',r=>{M.posts.push(['revogar',r.request().postDataJSON()]);r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
const painel=pg=>pg.evaluate(()=>{const e=document.querySelector('#leitores-painel');return e?{t:e.innerText.replace(/\s+/g,' '),criar:!!e.querySelector('[data-act="leitor-criar"]'),codigo:e.querySelectorAll('[data-act="leitor-codigo"]').length,revogar:e.querySelectorAll('[data-act="leitor-revogar"]').length}:null;});
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async(M)=>{const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await agente(ctx,M);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.dismiss().catch(()=>{}));await pg.goto(U);await pg.waitForTimeout(300);return {ctx,pg};};
try{
  // ---------- 28: chaves lt_* nas 5 línguas ----------
  {const M={lista:COMPLETA,gets:0,posts:[]};const {ctx,pg}=await nova(M);
    const r=await pg.evaluate(()=>{const EQ=ETERNA.EQ;const ks=Object.keys(EQ).filter(k=>k.startsWith('lt_'));return {n:ks.length,ruins:ks.filter(k=>!Array.isArray(EQ[k])||EQ[k].length!==5||EQ[k].some(v=>v==null||v===''))};});
    ok(r.n>=40&&!r.ruins.length,'28: chaves lt_* fora das 5 línguas: '+J(r));
    const usadas=await pg.evaluate(()=>{const src=[...document.scripts].map(s=>s.textContent).join('\n');return [...new Set((src.match(/TE\('lt_[a-z_]+'/g)||[]).map(x=>x.slice(4,-1)))].filter(k=>!ETERNA.EQ[k]);});
    ok(!usadas.length,'28: chave lt_* usada e não definida: '+J(usadas));
    // ---------- 25: Admin vê o painel com os botões ----------
    const ADM=await entrarTeste.adminFicticio(pg);ok(await entrarTeste(pg,ADM),'admin entrou');
    await pg.evaluate(()=>{ETERNA.state.catTab='avancado';ETERNA.go('catalogo');});
    ok(await espera(pg,()=>{const e=document.querySelector('#leitores-painel');return e&&/Gramado 1/.test(e.innerText);},8000),'25: painel Leitores de cartão não apareceu para o Admin');
    let p=await painel(pg);
    ok(p&&p.criar&&p.codigo===3&&p.revogar===3,'25: botões do Admin: '+J(p&&{criar:p.criar,codigo:p.codigo,revogar:p.revogar}));
    ok(p&&/Leitores de cartão/i.test(p.t)&&/Ligado/.test(p.t)&&/Desligado desde/.test(p.t)&&/Aguardando instalação/.test(p.t)&&/Desativado/.test(p.t),'25: situações em palavras: '+(p&&p.t.slice(0,400)));
    ok(p&&/lendo 120 de 340/.test(p.t)&&/100 já estavam/.test(p.t)&&/2 sem fotógrafo/.test(p.t)&&/34 fotos na fila · 510 MB/.test(p.t)&&/pronto/.test(p.t),'25: último cartão e fila: '+(p&&p.t));
    ok(p&&/1 não abriu no cartão/.test(p.t)&&/5 fotos na fila · 12 MB/.test(p.t)&&/fila parada há mais de 10 min/.test(p.t)&&/Sem conexão com o servidor/.test(p.t)&&/GRAMADO-PC1/.test(p.t)&&/2026-11-18/.test(p.t),'25: aviso, máquina e versão para o Admin: '+(p&&p.t));
    ok(p&&!/lt_[a-z]/.test(p.t),'28: chave crua no painel: '+(p&&p.t));
    // cadastrar: nome recusado e depois o código (só na memória)
    await pg.fill('#leitor-nome','Carlos');await pg.click('[data-act="leitor-criar"]');
    ok(await espera(pg,()=>/não pode ser o nome de um fotógrafo/.test(document.querySelector('#toast').textContent),4000),'nome de fotógrafo: aviso');
    await pg.fill('#leitor-nome','Gramado 4');await pg.click('[data-act="leitor-criar"]');
    ok(await espera(pg,()=>!!document.querySelector('#lt-codigo')&&document.querySelector('#lt-codigo').textContent==='ABCD-EFGH-JKLM-NPQR-STUV',4000),'código na tela depois de cadastrar');
    p=await painel(pg);ok(/Código de ativação de Gramado 4/.test(p.t)&&/Vale até/.test(p.t)&&/Baixar o instalador/.test(p.t),'caixa do código: '+p.t.slice(0,300));
    ok(M.posts.filter(x=>x[0]==='criar').every(x=>x[2]==='1'),'X-Eterna no cadastro');
    const ls=await pg.evaluate(()=>JSON.stringify(localStorage)+JSON.stringify(sessionStorage));
    ok(!ls.includes('ABCD-EFGH')&&!ls.includes('ABCDEFGH'),'o código foi parar no localStorage');
    const log=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>/^leitor_/.test(e.acao)));
    ok(log.length===1&&log[0].acao==='leitor_criado'&&log[0].nome==='Gramado 4'&&!J(log).includes('ABCD'),'auditLog do cadastro: '+J(log));
    await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(150);
    ok(await pg.evaluate(()=>ETERNA.state.leitores.codigo===null),'o código não sumiu ao trocar de tela');
    // novo código e desativar com confirmação
    await pg.evaluate(()=>{ETERNA.state.catTab='avancado';ETERNA.go('catalogo');});await espera(pg,()=>!!document.querySelector('#leitores-painel [data-act="leitor-codigo"]'),4000);
    await pg.click('#leitores-painel [data-act="leitor-codigo"][data-id="l_aaaa0002"]');
    ok(await espera(pg,()=>{const c=document.querySelector('#lt-codigo');return c&&c.textContent==='WXYZ-2345-6789-ABCD-EFGH';},4000),'novo código na tela');
    await pg.click('#leitores-painel [data-act="leitor-revogar"][data-id="l_aaaa0001"]');
    ok(await espera(pg,()=>/Desativar o leitor Gramado 1\?/.test(document.querySelector('#leitores-painel').innerText),3000)&&!M.posts.some(x=>x[0]==='revogar'),'desativar pede confirmação antes');
    await pg.click('#leitores-painel [data-act="leitor-revogar-sim"]');
    ok(await espera(pg,()=>/Leitor desativado/.test(document.querySelector('#toast').textContent),4000)&&M.posts.some(x=>x[0]==='revogar'&&x[1].id==='l_aaaa0001'),'desativar: '+J(M.posts));
    const log2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>/^leitor_/.test(e.acao)).map(e=>e.acao));
    ok(log2.includes('leitor_codigo')&&log2.includes('leitor_revogado'),'auditLog de código e desativação: '+J(log2));
    // 28: as outras línguas da equipe, sem chave crua
    for(const lg of ['en','es','fr']){ // a equipe usa pt, en, es e fr (IDIOMAS_EQ); o de existe no EQ e é conferido acima
      const t=await pg.evaluate(l=>{ETERNA.state.user.idioma=l;ETERNA.render();const e=document.querySelector('#leitores-painel');return e?e.innerText:'';},lg);
      ok(t&&!/lt_[a-z]/.test(t)&&!/Leitores de cartão/i.test(t),'28: painel em '+lg+': '+t.slice(0,120));}
    // 25: só configuracao.r (Ver): o painel aparece, sem cadastrar, novo código nem desativar
    const so=await pg.evaluate(()=>{const u=ETERNA.state.user;u.idioma='pt';u.perms=JSON.parse(JSON.stringify(u.perms));u.perms.configuracao={r:true};ETERNA.render();
      const e=document.querySelector('#leitores-painel');return e?{t:/Gramado 1/.test(e.innerText),criar:!!e.querySelector('[data-act="leitor-criar"]'),botoes:e.querySelectorAll('[data-act="leitor-codigo"],[data-act="leitor-revogar"],[data-act="leitor-revogar-sim"]').length}:null;});
    ok(so&&so.t&&!so.criar&&so.botoes===0,'25: só configuracao.r: '+J(so));
    await ctx.close();}
  // ---------- 27: Fotógrafo vê a linha em Minhas fotos, sem IP, máquina nem versão ----------
  {const M={lista:REDUZIDA,gets:0,posts:[]};const {ctx,pg}=await nova(M);
    ok(await entrarTeste(pg,'carlos@eterna.photo'),'fotógrafo entrou');await pg.evaluate(()=>ETERNA.go('importar'));
    ok(await espera(pg,()=>ETERNA.state.agent.on&&!!document.querySelector('#main .lt-faixa'),8000),'27: a linha do leitor não apareceu em Minhas fotos');
    const f=await pg.evaluate(()=>[...document.querySelectorAll('#main .lt-faixa .up-faixa')].map(x=>({t:x.innerText.trim(),warn:x.classList.contains('warn')})));
    ok(f.length===2&&f[0].t==='Leitor Gramado 1: ligado · 34 fotos na fila'&&!f[0].warn,'27: linha do leitor ligado: '+J(f));
    ok(f[1]&&/^Leitor Gramado 2: desligado desde .* · 3 fotos na fila$/.test(f[1].t)&&f[1].warn,'27: leitor desligado em amarelo: '+J(f[1]));
    const t=await pg.evaluate(()=>document.querySelector('#main').innerText);
    ok(!/192\.168|GRAMADO-PC|2026-11-18|Gramado 3|Antigo/.test(t),'27: Minhas fotos mostra IP, máquina, versão ou leitor não instalado');
    ok(!(await pg.evaluate(()=>ETERNA.canView('catalogo'))),'27: fotógrafo vê o Painel de controle');
    // fila parada há mais de 10 min fica amarela mesmo ligado
    M.lista=()=>REDUZIDA().map(x=>x.id==='l_aaaa0001'?{...x,fila:{n:34,parada_s:700}}:x);await pg.evaluate(()=>{ETERNA.leitoresPoll(true);});
    ok(await espera(pg,()=>{const x=document.querySelector('#main .lt-faixa .up-faixa');return x&&x.classList.contains('warn')&&/fila parada/.test(x.innerText);},5000),'27: fila parada há mais de 10 min não ficou amarela');
    ok(M.gets>0,'27: /leitores não foi pedido');
    await ctx.close();}
  // ---------- sem leitor instalado: nada em Minhas fotos ----------
  {const M={lista:()=>[],gets:0,posts:[]};const {ctx,pg}=await nova(M);
    ok(await entrarTeste(pg,'carlos@eterna.photo'),'fotógrafo entrou (sem leitor)');await pg.evaluate(()=>ETERNA.go('importar'));await espera(pg,()=>ETERNA.state.agent.on,6000);await pg.waitForTimeout(400);
    ok(!(await pg.$('#main .lt-faixa')),'sem leitor, a linha não aparece');await ctx.close();}
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,500));}
ok(!errs.length,'erros na página: '+J(errs.slice(0,3)));
await b.close();
console.log((fails.length?'FALHA':'OK')+' leitores: painel Leitores de cartão (ver e alterar), código só na memória, desativar com confirmação, linha em Minhas fotos sem IP nem máquina, textos nas 5 línguas (critérios 25 a 28)'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
