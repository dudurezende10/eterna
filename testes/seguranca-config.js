// Nome de fotógrafo vindo de fora (Roverpix) aparece como texto nas telas da equipe (Upload automático), nunca como HTML.
// Sem agente: os dados ao vivo da Roverpix entram por ETERNA.applyLive, como o livePoll faz com /roverpix/data.
const entrarTeste=require('./_entrar');const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const b=await chromium.launch();const errs=[];
try{const ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(10000);
  pg.on('pageerror',e=>errs.push(e.message));await pg.addInitScript(()=>{window.__xss=0;window.alert=()=>{window.__xss++;};});
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(400);
  ok(await entrarTeste(pg,await entrarTeste.adminFicticio(pg)),'admin entrou');
  const MAL='<img src=x onerror=alert(1)>Zé Mal';
  await pg.evaluate(MAL=>{const d=new Date().toISOString().slice(0,10);const daily={approaches:1,viewed:1,converted:0,sales:0,revenue:0,prints:0,reprints:0,photos:3,photosSold:0,pax:null};
    ETERNA.applyLive({updated:d,days:{[d]:{daily,sellers:{},payments:{},products:{},rows:{zemal:{photos:3,cards:1,cardsSold:0,photosSold:0,revenue:0}},people:{zemal:{name:MAL,human:true,pdv:''}},orders:[]}}});
    ETERNA.go('importar');},MAL);await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>({img:document.querySelectorAll('#main img[src="x"], #main [onerror]').length,txt:[...document.querySelectorAll('#main option, #main .chip')].map(o=>o.textContent).filter(t=>/Mal/.test(t)),xss:window.__xss}));
  ok(r.img===0&&r.xss===0,'nome com HTML virou elemento no Upload: '+JSON.stringify(r));// 24/11 (Eduardo): Minhas fotos não tem mais o seletor Fotógrafo; o nome é conferido como texto na tela Fotógrafos (Índice)
  await pg.evaluate(()=>{ETERNA.state.fg.aba='indice';ETERNA.go('fotografos');});await pg.waitForTimeout(600);
  const r2=await pg.evaluate(()=>({img:document.querySelectorAll('#main img[src="x"], #main [onerror]').length,txt:(document.querySelector('#main')||{}).textContent||'',xss:window.__xss}));
  ok(r2.img===0&&r2.xss===0&&/<img src=x/i.test(r2.txt),'o nome aparece como texto em Fotógrafos: '+JSON.stringify({img:r2.img,xss:r2.xss,tem:(r2.txt.match(/.{0,40}Mal/)||[""])[0]}));
}catch(e){fails.push('exceção: '+e.message.split('\n')[0]);}
await b.close();const okA=!fails.length&&!errs.length;console.log(`${okA?'OK':'FALHA'} seguranca-config: nome da Roverpix como texto no Upload e em Fotógrafos (Índice)${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okA?0:1);})();
