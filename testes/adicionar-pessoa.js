// v99.2 (Ronaldo, 11/11): selfie no Checkout abre só as fotos da pessoa (nunca a leva inteira) e o botão
// "Adicionar outra pessoa" soma as fotos da selfie seguinte às já abertas, mantendo as marcas. Sem agente.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();const errs=[];
try{const ctx=await b.newContext({viewport:{width:1366,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(400);await entrarTeste(pg,'eduardo@eduardorezende.com');
  await pg.evaluate(()=>ETERNA.go('quiosque'));await pg.waitForTimeout(300);
  // duas sessões de demonstração: A (pessoa 1) e B (pessoa 2); A tem fotos de outra pessoa na mesma leva
  const ss=await pg.evaluate(()=>ETERNA.demoSessions().filter(s=>s.status!=='paga'&&s.photos.length>=4).slice(0,2).map(s=>({card:s.card,ids:s.photos.map(p=>p.id)})));
  ok(ss.length===2,'duas sessões de demonstração: '+J(ss.map(s=>s.card)));
  const [A,B]=ss;
  // 1: a selfie acha 2 fotos de A com rosto principal: abre só essas 2, nunca a leva inteira
  await pg.evaluate(([A])=>{ETERNA.lojaJuntar([{card:A.card,fotos:A.ids.slice(0,2),sc:.8,pri:2}],[],{});},[A]);await pg.waitForTimeout(300);
  let k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,ids:k.so&&k.so.ids,visita:k.so&&k.so.visita};});
  ok(k.code===A.card&&J(k.ids)===J(A.ids.slice(0,2))&&!k.visita,'1: só as 2 fotos achadas, sem a leva: '+J(k));
  // marca a primeira foto
  await pg.evaluate(()=>{const b=document.querySelector('#main [data-act="kiosk-tog"]')||document.querySelector('[data-act="kiosk-tog"]');if(b)b.click();});await pg.waitForTimeout(200);
  const marcas0=await pg.evaluate(c=>Object.keys((ETERNA.SIM.sessions[c]||{}).pick||{}).length,A.card);
  // 2: o botão aparece e leva para a câmera da outra pessoa
  const bt=await pg.$('[data-act="kiosk-mais"]');ok(!!bt,'2: botão Adicionar outra pessoa na escolha');
  if(bt){await bt.click();await pg.waitForTimeout(300);}
  k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,mais:!!k.mais,camOn:!!k.camOn,txt:(document.querySelector('.lj-sub')||{}).textContent||'',volta:!!document.querySelector('[data-act="kiosk-mais-volta"]')};});
  ok(k.step==='code'&&k.mais&&k.volta&&/outra pessoa/.test(k.txt),'2: tela da selfie da outra pessoa com Voltar às minhas fotos: '+J(k));
  // 3: Voltar às minhas fotos devolve tudo como estava
  await pg.click('[data-act="kiosk-mais-volta"]');await pg.waitForTimeout(250);
  k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,ids:k.so&&k.so.ids,mais:!!k.mais};});
  ok(k.step==='review'&&k.code===A.card&&J(k.ids)===J(A.ids.slice(0,2))&&!k.mais,'3: volta às mesmas fotos: '+J(k));
  // 4: de novo, e a selfie da pessoa 2 acha 3 fotos de B: soma (A 2 + B 3), âncora A, marca mantida
  await pg.click('[data-act="kiosk-mais"]');await pg.waitForTimeout(250);
  await pg.evaluate(([B])=>{ETERNA.lojaJuntar([{card:B.card,fotos:B.ids.slice(0,3),sc:.8,pri:3}],[],{});},[B]);await pg.waitForTimeout(300);
  k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,ids:k.so&&k.so.ids,cards:k.so&&k.so.cards,mais:!!k.mais,camOn:!!k.camOn};});
  const esp=new Set([...A.ids.slice(0,2),...B.ids.slice(0,3)]);
  ok(k.code===A.card&&k.ids&&k.ids.length===5&&k.ids.every(x=>esp.has(x))&&!k.mais&&!k.camOn,'4: soma A 2 + B 3, âncora A: '+J(k));
  const marcas1=await pg.evaluate(c=>Object.keys((ETERNA.SIM.sessions[c]||{}).pick||{}).length,A.card);
  ok(marcas1===marcas0,'4: marcas mantidas: '+marcas0+' -> '+marcas1);
  // 5: depois de somar, o botão continua (uma terceira pessoa)
  ok(!!(await pg.$('[data-act="kiosk-mais"]')),'5: botão segue para mais uma pessoa');
  ok(!errs.length,'erros de página: '+J(errs));
}catch(e){fails.push('exceção: '+e.message.split('\n')[0]);}
await b.close();
console.log(fails.length?'FALHA adicionar-pessoa: '+fails.join(' || '):'OK adicionar-pessoa: selfie só com as fotos da pessoa, Adicionar outra pessoa soma, Voltar às minhas fotos, marcas mantidas');
process.exit(fails.length?1:0);})();
