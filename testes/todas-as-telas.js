// abre cada tela do menu e falha se aparecer "Algo falhou" ou erro de JavaScript
const {chromium}=require('playwright');const login=require('./_login');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:1000}});const errs=[];
pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
await login(pg);const vs=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));const bad=[];
for(const v of vs){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(120);const t=await pg.textContent('#main');if(/Algo falhou/.test(t))bad.push(v);}
// v97: Estatísticas › Jogos e ano a ano (seção g, só Admin) e o painel da fonte dos jogos em Preços e Checkout › Checkout
for(const s of ['g']){await pg.evaluate(s=>{ETERNA.state.es.sec=s;ETERNA.state.view='estatisticas';ETERNA.render();},s);await pg.waitForTimeout(150);if(/Algo falhou/.test(await pg.textContent('#main'))||!(await pg.$('[data-act="es-sec"][data-s="g"]')))bad.push('estatisticas/'+s);}
await pg.evaluate(()=>{ETERNA.state.es.sec='a';ETERNA.state.catTab='checkout';ETERNA.state.view='catalogo';ETERNA.render();});await pg.waitForTimeout(120);if(/Algo falhou/.test(await pg.textContent('#main'))||!(await pg.$('#ag-fontes-bloco')))bad.push('catalogo (fonte dos jogos)');
// rota pública da galeria por QR com um token que não existe, sem login: abre sem erro e mostra "não encontrada"
const pp=await b.newPage();pp.on('pageerror',e=>errs.push('#g: '+e.message));await pp.goto((process.env.U||'http://127.0.0.1:8890/index.html')+'#g/'+'Zz'.repeat(11));await pp.waitForTimeout(1500);
const gq=await pp.evaluate(()=>({step:ETERNA.pub&&ETERNA.pub.step,h:location.hash,user:!!ETERNA.state.user}));if(gq.step!=='nao_existe'||!/^#g\//.test(gq.h)||gq.user)bad.push('#g/<inexistente> '+JSON.stringify(gq));
if(!vs.includes('galerias'))bad.push('menu sem galerias');
// v78: Permissões no menu; Fluxo, Anfitrião no set, Convidado e o Checkout (Loja) fora do menu; telas sem item (Início, balcão, fila, caixa) abrem sem erro
if(!vs.includes('permissoes'))bad.push('menu sem permissoes');['set','fluxo','convidado','quiosque','perfis'].forEach(v=>{if(vs.includes(v))bad.push('menu com '+v);});
for(const v of ['perfis','checkout','fila','caixa','posto']){ // v83: Posto de venda (sem item no menu, aberto pelo Abrir Checkout)
await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(120);if(/Algo falhou/.test(await pg.textContent('#main')))bad.push(v);}
if(!(await pg.$('.rail [data-act="loja-abrir"]')))bad.push('sem botão Abrir Checkout'); // v94-ux: no Admin, o Abrir Checkout fica no rodapé do menu (#nav .nav-ck)
await b.close();const ok=!bad.length&&!errs.length;console.log(`${ok?'OK':'FALHA'} todas-as-telas: ${vs.length} telas${bad.length?' · quebradas: '+bad.join(', '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok?0:1);})();
