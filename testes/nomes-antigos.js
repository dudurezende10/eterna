// v97: nomes antigos não podem aparecer em texto visível de nenhuma tela ("Painel de controle" virou "Preços e Checkout", "Vendas e caixa" virou "Vendedores", o título "Computador do ponto" virou "Posto de venda · nome").
// Percorre o menu inteiro como o todas-as-telas.js (logado como Admin), mais as abas de Preços e Checkout e as seções das Estatísticas.
const {chromium}=require('playwright');const login=require('./_login');
const VELHOS=[/painel de controle/i,/vendas e caixa/i,/Computador do ponto/]; // o título "Computador do ponto" saiu com o Posto único; a frase "o computador do ponto não está respondendo" (minúscula) continua
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1280,height:1000}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await login(pg);const bad=[];
// texto que a pessoa lê: innerText (só o que está na tela) mais rótulos de dica e de leitor de tela
const visivel=()=>pg.evaluate(()=>{const t=[document.body.innerText];document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(e=>{if(e.offsetParent!==null)t.push(e.getAttribute('title')||'',e.getAttribute('aria-label')||'',e.getAttribute('placeholder')||'');});return t.join('\n');});
const confere=async onde=>{const t=await visivel();for(const r of VELHOS){const m=t.match(r);if(m){const i=m.index;bad.push(onde+': "'+t.slice(Math.max(0,i-40),i+m[0].length+40).replace(/\s+/g,' ')+'"');}}};
const vs=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));
if(vs.length<10)bad.push('menu com só '+vs.length+' telas');
for(const v of vs){await pg.evaluate(v=>{ETERNA.state.view=v;ETERNA.render();},v);await pg.waitForTimeout(120);await confere(v);}
// abas de Preços e Checkout
const abas=await pg.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();return [...document.querySelectorAll('#main [data-act="cat-tab"]')].map(x=>x.dataset.t);});
if(!abas.length)bad.push('Preços e Checkout sem abas para o Admin');
for(const a of abas){await pg.evaluate(a=>{ETERNA.state.catTab=a;ETERNA.state.view='catalogo';ETERNA.render();},a);await pg.waitForTimeout(120);await confere('catalogo/'+a);}
// seções das Estatísticas
for(const s of ['a','b','c','d','e','f','g']){await pg.evaluate(s=>{ETERNA.state.es.sec=s;ETERNA.state.view='estatisticas';ETERNA.render();},s);await pg.waitForTimeout(120);await confere('estatisticas/'+s);}
const ok=!bad.length&&!errs.length;
console.log(`${ok?'OK':'FALHA'} nomes-antigos: ${vs.length} telas, ${abas.length} abas de Preços e Checkout e 7 seções das Estatísticas sem "Painel de controle", "Vendas e caixa" nem "Computador do ponto"${bad.length?' · '+bad.slice(0,8).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);
await b.close();process.exit(ok?0:1);})();
