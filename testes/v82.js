// v82: bandeiras com URL completa da Wikimedia (docs/bandeiras-web-2026-10-28.json); domínio fora da lista não vira src; migração não mexe em foto enviada (campo 7)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const WEB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','docs','bandeiras-web-2026-10-28.json'),'utf8'));
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  // não depende da rede: imagens externas respondem 404 (cai no onerror)
  await ctx.route(/^https:\/\/(upload\.wikimedia\.org|maracafly\.com\.br|evil\.example)\//,r=>r.fulfill({status:404,body:''}));
  await pg.goto(U);await pg.waitForTimeout(300);
  // 1. FLAGS: os 30 com a URL do JSON; 114 (Porto)
  const r=await pg.evaluate(w=>{const by=n=>ETERNA.FLAGS.find(x=>x[0]===n);return {porto:by(114)[6],nome:by(114)[1],errado:Object.entries(w).filter(([n,u])=>by(+n)[6]!==u).map(([n])=>n),src:ETERNA.flagSrc(by(114)[6]),
    evil:ETERNA.flagSrc('https://evil.example/x.png'),arq:ETERNA.flagSrc('abc.webp'),mf:ETERNA.flagSrc('https://maracafly.com.br/static/bandeiras/a.png'),sub:ETERNA.flagSrc('https://upload.wikimedia.org.evil.example/x.png')};},WEB);
  ok(r.porto===WEB['114']&&r.nome==='Porto'&&r.src===WEB['114'],'1: item 114 (Porto) deveria apontar para a URL do JSON: '+J(r));
  ok(!r.errado.length,'1: itens do JSON sem a URL: '+r.errado.join(','));
  ok(!/^https:\/\/evil\.example/.test(r.evil)&&r.evil.startsWith('https://maracafly.com.br/static/bandeiras/'),'1: outro domínio não pode virar src: '+r.evil);
  ok(!r.sub.startsWith('https://upload.wikimedia.org.evil'),'1: subdomínio falso virou src: '+r.sub);
  ok(r.arq==='https://maracafly.com.br/static/bandeiras/abc.webp'&&r.mf==='https://maracafly.com.br/static/bandeiras/a.png','1: nome de arquivo/URL do maracafly: '+J([r.arq,r.mf]));
  // 2. migração: lista salva antiga (v81), item 114 vazio, 113 com arquivo velho da v81, 116 com foto enviada, 118 editado com outro arquivo, 43 vazio
  await pg.evaluate(()=>{const L=ETERNA.FLAGS.map(x=>[...x]);const by=n=>L.find(x=>x[0]===n);
    Object.keys(ETERNA.FLAG_WEB_V82).forEach(n=>{by(+n)[6]='';});const fx=ETERNA.FLAG_FIX_V81['113'];if(fx)by(113)[6]=fx[0];
    by(116)[7]='data:image/png;base64,FOTOUSUARIO';by(118)[6]='meu-arquivo.jpg';
    const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');s.flagList=L;s.caixaDin=s.caixaDin||[];s.catalogoV=2;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));
    localStorage.setItem('eterna.flags.v','81');localStorage.removeItem('eterna.users.log.v1');});
  await pg.reload();await pg.waitForTimeout(400);
  const m=await pg.evaluate(w=>{const L=JSON.parse(localStorage.getItem('eterna.sim.v1')).flagList;const by=n=>L.find(x=>x[0]===n);
    const log=ETERNA.auditRead().filter(e=>e.acao==='migracao_v82_bandeiras');
    return {f114:by(114)[6],f113:by(113)[6],f43:by(43)[6],f116:by(116).slice(6),f118:by(118)[6],log:log.length,mv:localStorage.getItem('eterna.flags.v'),
      faltam:Object.entries(w).filter(([n,u])=>![116,118].includes(+n)&&by(+n)[6]!==u).map(([n])=>n)};},WEB);
  ok(m.f114===WEB['114']&&m.f113===WEB['113']&&m.f43===WEB['43']&&!m.faltam.length,'2: migração deveria pôr as URLs: '+J(m));
  ok(m.f116[0]===''&&m.f116[1]==='data:image/png;base64,FOTOUSUARIO','2: migração não pode mexer em item com foto enviada (imgData): '+J(m.f116));
  ok(m.f118==='meu-arquivo.jpg','2: item editado com outro arquivo não pode mudar: '+m.f118);
  ok(m.log===1&&m.mv==='82','2: histórico migracao_v82_bandeiras uma vez e chave 82: '+J({log:m.log,mv:m.mv}));
  await pg.reload();await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='migracao_v82_bandeiras').length)===1,'2: migração rodou duas vezes');
  // 3. tela de estoque: src de domínio estranho não aparece; imagem que falha some sem mudar o tamanho
  await login(pg);
  await pg.evaluate(()=>{const s=ETERNA.SIM;s.flagList.find(x=>x[0]===118)[6]='https://evil.example/x.png';});
  await pg.evaluate(()=>{ETERNA.state.view='bandeiras';ETERNA.state.flagFilter='todas';ETERNA.render();});await pg.waitForTimeout(600);
  const t=await pg.evaluate(()=>{const im=[...document.querySelectorAll('#main img')];return {evil:im.filter(i=>/evil\.example/.test(i.getAttribute('src'))&&!i.getAttribute('src').startsWith('https://maracafly.com.br/')).length,
    wiki:im.filter(i=>i.src.startsWith('https://upload.wikimedia.org/')&&i.complete).map(i=>({vis:getComputedStyle(i).visibility,w:i.getBoundingClientRect().width,h:i.getBoundingClientRect().height})),sw:document.documentElement.scrollWidth<=innerWidth};});
  ok(t.evil===0,'3: src com domínio estranho na tela: '+t.evil);
  ok(t.wiki.length>0&&t.wiki.every(x=>x.vis==='hidden'&&x.w===36&&x.h===24)&&t.sw,'3: imagem que não carrega deveria sumir mantendo 36x24: '+J(t).slice(0,300));
  await ctx.close();
}catch(e){fails.push('erro: '+e.stack);}
await b.close();
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHA v82:\n - '+fails.join('\n - '));process.exit(1);}console.log('OK v82: URL da Wikimedia, domínio bloqueado, migração sem mexer em foto enviada');})();
