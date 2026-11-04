// Idioma da equipe e idioma do cliente são separados: trocar um nunca muda o outro. A moeda é da unidade e não muda com o idioma.
const fs=require('fs'),path=require('path');
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const b=await chromium.launch();
try{
  // todo texto usado existe no dicionário, nos 5 idiomas
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const usadas=[...new Set([...html.matchAll(/\bTE\('([a-z_0-9]+)'/g)].map(m=>m[1]))];
  const pg=await b.newPage({viewport:{width:1280,height:900}});pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);
  // bandeiras no mesmo conjunto e ordem de parceiros.vivamaracana.com.br
  ok((await pg.$$eval('[data-act="idioma-equipe"]',b=>b.map(x=>x.dataset.l).join()))==='pt,en,es,fr','bandeiras fora da ordem');
  ok(await pg.$eval('[data-act="idioma-equipe"][data-l="pt"]',b=>b.getAttribute('aria-pressed'))==='true','português não vem marcado');
  const falta=await pg.evaluate(u=>{const {EQ,LANGS}=ETERNA;const f=u.filter(k=>!EQ[k]);Object.entries(EQ).forEach(([k,v])=>{if(v.length!==LANGS.length||v.some(x=>!x))f.push(k+' incompleto');});return f;},usadas);
  ok(!falta.length,'textos faltando: '+falta.join(', '));
  // sem escolha, a equipe abre em português; o seletor muda a tela de entrada e não mexe no idioma do cliente
  ok(/Entrar/.test(await pg.textContent('#main')),'padrão da equipe é português');
  await pg.evaluate(()=>{ETERNA.state.lang='fr';});
  await pg.click('[data-act="idioma-equipe"][data-l="en"]');await pg.waitForTimeout(100);
  ok(/Sign in/.test(await pg.textContent('#main'))&&/I forgot my password/.test(await pg.textContent('#main')),'seletor não traduz a entrada');
  ok(await pg.evaluate(()=>document.documentElement.lang)==='en-US','idioma da página não acompanha');
  ok(await pg.evaluate(()=>ETERNA.state.lang)==='fr','trocar o idioma da equipe mudou o do cliente');
  ok(await pg.evaluate(()=>localStorage.getItem('eterna.lang'))===null,'a equipe gravou no idioma do cliente');
  // o que foi digitado continua, e a moeda não muda com o idioma
  await pg.fill('[data-act="login-usuario"]','abc');await pg.click('[data-act="idioma-equipe"][data-l="es"]');await pg.waitForTimeout(100);
  ok(await pg.inputValue('[data-act="login-usuario"]')==='abc','trocar o idioma apagou o usuário');
  await pg.click('[data-act="idioma-equipe"][data-l="en"]');await pg.waitForTimeout(50);
  ok(await pg.evaluate(()=>ETERNA.fmtR(1234).replace(/\s/g,' '))==='R$ 1,234','valor em inglês: '+await pg.evaluate(()=>ETERNA.fmtR(1234)));
  await pg.click('[data-act="idioma-equipe"][data-l="pt"]');await pg.waitForTimeout(50);
  ok(await pg.evaluate(()=>ETERNA.fmtR(1234).replace(/\s/g,' '))==='R$ 1.234','valor em português');
  // erro devolvido pelo servidor como código aparece no idioma da pessoa
  await pg.click('[data-act="idioma-equipe"][data-l="fr"]');await pg.waitForTimeout(50);
  ok(/10 caractères/.test(await pg.evaluate(()=>ETERNA.authErro({erro:'fraca',motivo:'curta',status:400}))),'código do servidor não traduz');
  await pg.click('[data-act="idioma-equipe"][data-l="pt"]');await pg.waitForTimeout(50);
  // dentro do sistema: o idioma do cadastro vale mais que o do aparelho, e o seletor grava no cadastro
  ok(await entrarTeste(pg,'eduardo@eduardorezende.com'),'entrar');
  await pg.evaluate(()=>{ETERNA.state.user.idioma='es';ETERNA.render();});await pg.waitForTimeout(100);
  ok(/salir/.test(await pg.textContent('#venue-sub')),'idioma do cadastro não vale');
  ok(await pg.evaluate(()=>ETERNA.state.lang)==='fr','entrar mudou o idioma do cliente');
  await pg.click('#venue-sub [data-act="idioma-equipe"][data-l="en"]');await pg.waitForTimeout(100);
  ok(await pg.evaluate(()=>ETERNA.USERS['eduardo@eduardorezende.com'].idioma)==='en','seletor não grava no cadastro');
  ok(/sign out/.test(await pg.textContent('#venue-sub')),'seletor do menu não traduz');
  // o cliente troca o Checkout: a equipe segue no idioma dela, e o valor na tela do cliente segue o idioma do cliente
  const r=await pg.evaluate(()=>{const {T,TE,fmtR,localeTela}=ETERNA;const s=ETERNA.state;s.lojaRota=true;s.lang='de';const cli=[T('gq_notFound'),fmtR(1234).replace(/\s/g,' '),localeTela()];const eq=TE('entrar');s.lojaRota=false;const fora=[fmtR(1234).replace(/\s/g,' '),localeTela(),s.lang];return {cli,eq,fora};});
  ok(r.cli[1]==='R$ 1.234'&&r.cli[2]==='de-DE','tela do cliente não segue o idioma do cliente: '+r.cli.join(' / '));
  ok(r.eq==='Sign in','o idioma do cliente mudou o da equipe: '+r.eq);
  ok(r.fora[0]==='R$ 1,234'&&r.fora[1]==='en-US'&&r.fora[2]==='de','ao voltar, equipe no idioma dela: '+r.fora.join(' / '));
  // ?lang= no endereço, como em parceiros.vivamaracana.com.br
  const pg2=await b.newPage({viewport:{width:1280,height:900}});await pg2.goto(U+'?lang=es');await pg2.evaluate(()=>{localStorage.removeItem('eterna.equipe.idioma');});await pg2.reload();await pg2.waitForTimeout(400);ok(/Olvidé mi contraseña/.test(await pg2.textContent('#main')),'?lang=es não vale');await pg2.close();
  ok(!errs.length,'erros na página: '+errs.join(' | ').slice(0,300));
}catch(e){fails.push('exceção: '+e.message.slice(0,300));}
await b.close();
if(fails.length){console.log('FALHA idiomas: '+fails.join(' | '));process.exit(1);}
console.log('OK idiomas: equipe e cliente separados, seletor, cadastro, moeda da unidade e códigos do servidor');
})();
