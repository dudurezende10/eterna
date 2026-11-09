// v94-ux parte H: menu e nomes (critérios H1 a H8 do plano docs/planos/2026-11-09-ondas-ux.md). Só o app, sem agente.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
async function nova(b,w=1366,h=768){const ctx=await b.newContext({viewport:{width:w,height:h}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(350);return {ctx,pg};}
const itens=pg=>pg.$$eval('#nav button[data-v]',bs=>bs.map(b=>({v:b.dataset.v,t:(b.querySelector('span')||b).textContent.trim(),title:b.getAttribute('title')||''})));
// perfis da v93 (antes da parte H), para o H7: ninguém ganha tela nem letra
const RO={c:false,r:true,u:false,d:false},RW={c:true,r:true,u:true,d:false},ALLP={c:true,r:true,u:true,d:true};
const V93={
  foto:{perms:{set:RW,diario:RW,escala:RO,filafoto:RO},menu:['diario','importar','fotofila','escala']},
  venda:{perms:{venda:RW,quiosque:RW,catalogo:RO,filafoto:RO},menu:['quiosque','checkout','fila','caixa','posto','catalogo','fotofila']},
  valida:{perms:{qualidade:ALLP,diario:RO},menu:['revisao','treino','diario']},
  supervisor:{perms:{relatorios:RO,desempenho:RO,financeiro:RO,diario:ALLP,set:RO,venda:RW,qualidade:RO,estoque:ALLP,configuracao:RW,escala:RW,laboratorio:RO,catalogo:RO,galerias:RW,filafoto:{c:false,r:true,u:true,d:false}},menu:'*'},
  quiosque:{perms:{quiosque:RW},menu:['quiosque']},
};
const PERFIS=[['eduardo@eduardorezende.com','admin'],['carlos@eterna.photo','foto'],['loja@eterna.photo','venda'],['qualidade@eterna.photo','valida'],['supervisor@eterna.photo','supervisor']];
(async()=>{const b=await chromium.launch();
try{
  for(const [email,k] of PERFIS){const {ctx,pg}=await nova(b);ok(await entrar(pg,email),k+': não entrou');
    const its=await itens(pg);
    // H1: sem <small>, todo item com title
    ok(!(await pg.$('#nav small'))&&its.every(x=>x.title),'H1 '+k+': item com <small> ou sem title: '+J(its));
    // H2: texto do item = h1 da tela (sem diferença de maiúsculas)
    const dif=[];for(const x of its){await pg.evaluate(v=>ETERNA.go(v),x.v);await pg.waitForTimeout(80);const h1=await pg.evaluate(()=>{const h=document.querySelector('#main h1');return h?h.textContent.trim():'';});if(h1.toLowerCase()!==x.t.toLowerCase())dif.push(x.v+': "'+x.t+'" ≠ "'+h1+'"');}
    ok(!dif.length,'H2 '+k+': menu ≠ título: '+dif.join(' | '));
    const grps=await pg.$$eval('#nav .grp',g=>g.map(x=>x.textContent.trim()));
    if(k==='venda'){ok(!grps.length&&J(its.map(x=>x.t))===J(['Posto de venda','Fila do fotógrafo','Preços']),'H3 vendedor: '+J({grps,its}));
      ok(await pg.$('#rail-ck [data-act="loja-abrir"]')&&!(await pg.$('#rail-ck [data-v]')),'H4: vendedor com o botão grande Abrir Checkout e sem o botão Posto de venda');}
    if(k==='foto')ok(!grps.length&&its.length<=5&&its.length>0,'H3 fotógrafo: sem grupos e até 5 itens: '+J({grps,n:its.length}));
    if(k==='valida')ok(!grps.length,'H3: validador (3 telas) sem grupos');
    if(k==='admin'||k==='supervisor'){ok(!(await pg.$('#rail-ck [data-act="loja-abrir"]'))&&!(await pg.$('#rail-ck [data-v]')),'H4 '+k+': botões grandes no topo');
      ok(await pg.$('#nav .nav-ck[data-act="loja-abrir"]'),'H4 '+k+': sem "Abrir Checkout" no rodapé do menu');}
    if(k==='admin'){
      // H6: no Painel, o grupo Sistema fechado
      await pg.evaluate(()=>ETERNA.go('painel'));await pg.waitForTimeout(100);
      const g=await pg.$$eval('#nav .navg',gs=>gs.map(x=>[x.querySelector('.grp').textContent.trim(),x.querySelector('.grp').getAttribute('aria-expanded')]));
      ok(J(g.map(x=>x[0]))===J(['Venda','Dashboard','Curadoria','Fotógrafo','Configurações','Sistema'])&&g.find(x=>x[0]==='Sistema')[1]==='false'&&g.find(x=>x[0]==='Dashboard')[1]==='true','H6: grupos e Sistema fechado no Painel: '+J(g));
      // H1: com todos os grupos fechados menos um, cabe sem rolar em 1366×768
      const rola=await pg.evaluate(()=>{const g=document.querySelector('#railgav');const r=document.querySelector('.rail');return {g:g.scrollHeight-g.clientHeight,r:r.scrollHeight-r.clientHeight,doc:document.querySelector('.rail').getBoundingClientRect().bottom<=innerHeight+1};});
      ok(rola.g<=1&&rola.r<=1,'H1: menu do Admin rola em 1366×768: '+J(rola));
      // H8: links antigos
      const casos=[['importar','importar'],['caixa','caixa'],['checkout','checkout'],['fila','fila'],['posto','posto'],['catalogo','catalogo'],['vendas','vendas'],['revisao','revisao'],['ajustes','ajustes'],['escala','escala'],['semana','painel'],['set','importar']];
      for(const [h,esp] of casos){await pg.evaluate(()=>ETERNA.go('perfis'));await pg.evaluate(h=>{location.hash='#'+h;},h);await pg.waitForTimeout(120);const r=await pg.evaluate(()=>({v:ETERNA.state.view,f:/Algo falhou/.test(document.querySelector('#main').textContent)}));ok(r.v===esp&&!r.f,'H8: #'+h+' deveria abrir '+esp+': '+J(r));}}
    if(k==='supervisor'){const vs=its.map(x=>x.v);ok(!['repo','identidade','chroma','vestiario','fundos-teste','usuarios','permissoes'].some(v=>vs.includes(v)),'H5: supervisora com tela do Sistema: '+J(vs));}
    await ctx.close();}
  // H5 e H7 (funções puras)
  {const {ctx,pg}=await nova(b);
    const r=await pg.evaluate(V93=>{const E=ETERNA;const out={};
      const antes=k=>({preset:'custom',perms:E.permNorm(V93[k].perms),menu:V93[k].menu==='*'?E.ALL_VIEWS.slice():V93[k].menu.slice()});
      Object.keys(V93).forEach(k=>{const dep={preset:k,perms:E.presetPerms(k),menu:E.presetMenu(k)};out[k]=E.accExtra(dep,antes(k));});
      out.supPerms=JSON.stringify(E.presetPerms('supervisor'))===JSON.stringify(E.permNorm(V93.supervisor.perms));
      out.adminTudo=E.ALL_VIEWS.every(v=>E.presetMenu('admin').includes(v));return out;},V93);
    ok(['foto','venda','valida','supervisor','quiosque'].every(k=>J(r[k])==='[]'),'H7: accExtra(depois, antes) não vazio: '+J(r));
    ok(r.supPerms,'H5: perms da Supervisora mudaram');ok(r.adminTudo,'H7: Admin sem alguma tela');
    // H5: migração única da supervisora salva com o menu da v93; personalizado com repo não muda
    await pg.evaluate(()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));const s=U['supervisor@eterna.photo'];const SIS=['repo','identidade','chroma','vestiario','fundos-teste'];s.menu=ETERNA.ALL_VIEWS.filter(v=>ETERNA.presetMenu('supervisor').includes(v)||SIS.includes(v)); /* menu da v93 */s.inicio='repo';delete s.msis94;
      U['gerente@eterna.photo']={...JSON.parse(JSON.stringify(s)),email:'gerente@eterna.photo',name:'Gerente',preset:'custom',inicio:null};U['sup2@eterna.photo']={...JSON.parse(JSON.stringify(s)),email:'sup2@eterna.photo',name:'Sup 2',inicio:null};
      localStorage.setItem('eterna.users.v1',JSON.stringify(U));localStorage.removeItem('eterna.users.log.v1');});
    await pg.reload();await pg.waitForTimeout(400);
    const m1=await pg.evaluate(()=>{const U=ETERNA.USERS;const l=ETERNA.auditRead().filter(e=>e.acao==='migracao_v94');return {n:l.length,alvos:l.map(e=>e.alvo).sort(),sup:U['supervisor@eterna.photo'].menu,ini:U['supervisor@eterna.photo'].inicio,ger:U['gerente@eterna.photo'].menu,m:U['supervisor@eterna.photo'].msis94,preset:ETERNA.presetMatch(U['sup2@eterna.photo'])};});
    ok(m1.n===2&&J(m1.alvos)===J(['sup2@eterna.photo','supervisor@eterna.photo']),'H5: 1 linha migracao_v94 por supervisora salva: '+J(m1));
    ok(!['repo','identidade','chroma','vestiario','fundos-teste'].some(v=>m1.sup.includes(v))&&m1.ini===null&&m1.m===1,'H5: menu e tela inicial da supervisora migrados: '+J(m1));
    ok(m1.ger.includes('repo')&&m1.ger.includes('identidade'),'H7: personalizado com repo não muda: '+J(m1.ger));
    ok(m1.preset==='supervisor','H5: supervisora migrada continua com o perfil Supervisor: '+m1.preset);
    await pg.reload();await pg.waitForTimeout(400);
    ok(await pg.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='migracao_v94').length)===2,'H5: recarregar migrou de novo');
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-h: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-h: menu e nomes, menu = título, vendedor e fotógrafo sem grupos, Abrir Checkout, Supervisora sem Sistema (migração única), ninguém ganha acesso, links antigos');
})();
