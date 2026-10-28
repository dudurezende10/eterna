// abre cada tela do menu e falha se aparecer "Algo falhou" ou erro de JavaScript
const {chromium}=require('playwright');const login=require('./_login');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:1000}});const errs=[];
pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
await login(pg);const vs=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));const bad=[];
for(const v of vs){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.state.kiosk.full=false;ETERNA.render();},v);await pg.waitForTimeout(120);const t=await pg.textContent('#main');if(/Algo falhou/.test(t))bad.push(v);}
await b.close();const ok=!bad.length&&!errs.length;console.log(`${ok?'OK':'FALHA'} todas-as-telas: ${vs.length} telas${bad.length?' · quebradas: '+bad.join(', '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok?0:1);})();
