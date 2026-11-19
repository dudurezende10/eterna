// 18/11 (revisão): nome gravado na câmera (autor, dono) -> fotógrafo. A tabela testes/_nomes_camera.json roda aqui contra o camWho
// do app e em testes/sessoes_agente.py contra o ff_quem_como do agente; os dois têm de dar o mesmo resultado esperado.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const CASOS=JSON.parse(fs.readFileSync(path.join(__dirname,'_nomes_camera.json'),'utf8')).casos;
(async()=>{const b=await chromium.launch();const fails=[];
try{const ctx=await b.newContext({locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForFunction(()=>window.ETERNA&&typeof ETERNA.camWho==='function',null,{timeout:15000});
  const r=await pg.evaluate(c=>c.map(([a,d,esp])=>[a,d,esp,ETERNA.camWho('1234','2026-11-18',a,d)||null]),CASOS);
  const dif=r.filter(x=>x[2]!==x[3]);if(dif.length)fails.push('camWho diferente do esperado (tabela comum com o agente): '+JSON.stringify(dif));
  if(errs.length)fails.push('erros de página: '+errs.join(' | '));
  await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
if(fails.length){console.log('FALHA nomes-camera: '+fails.join(' || '));process.exit(1);}
console.log('OK nomes-camera: '+CASOS.length+' nomes da câmera dão o mesmo fotógrafo no app e no agente');process.exit(0);})();
