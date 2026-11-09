// v94-ux parte J: Lista de vendas (critérios J1 a J4 do plano docs/planos/2026-11-09-ondas-ux.md). Só o app, dados de exemplo (412 vendas).
const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1366,height:768},acceptDownloads:true});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(350);ok(await entrar(pg,'eduardo@eduardorezende.com'),'admin não entrou');
  await pg.evaluate(()=>{ETERNA.state.range={from:'2026-01-01',to:'2099-12-31'};ETERNA.go('vendas-lista');});await pg.waitForTimeout(250);
  const linhas=()=>pg.evaluate(()=>document.querySelectorAll('#main tbody tr').length);const pag=()=>pg.evaluate(()=>{const e=document.querySelector('.sl-pag .note');return e?e.textContent:'';});
  const n=await pg.evaluate(()=>ETERNA.allSales().length);ok(n===412,'base com 412 vendas: '+n);
  // J1
  ok(await linhas()===50&&await pag()==='Página 1 de 9','J1: página 1: '+J([await linhas(),await pag()]));
  for(let i=0;i<8;i++){await pg.click('.sl-pag [data-act="sales-page"]:not([disabled]):last-of-type');await pg.waitForTimeout(80);}
  ok(await pag()==='Página 9 de 9'&&await linhas()===12&&await pg.$('.sl-pag [data-act="sales-page"]:last-of-type[disabled]'),'J1: página 9 com 12 linhas: '+J([await pag(),await linhas()]));
  await pg.click('.sl-pag [data-act="sales-page"]:first-of-type');await pg.waitForTimeout(80);ok(await pag()==='Página 8 de 9','J1: Anterior');
  await pg.selectOption('select[data-act="sales-status"]','paga');await pg.waitForTimeout(150);ok(/^Página 1 de /.test(await pag())&&await pg.evaluate(()=>ETERNA.state.sales.status)==='paga','J1: trocar o filtro volta à página 1: '+await pag());
  await pg.selectOption('select[data-act="sales-seller"]','Thais');await pg.waitForTimeout(150);
  const t1=await pg.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].every(tr=>/Thais/.test(tr.innerText)));ok(t1,'J1: filtro Vendedor pelo select');
  await pg.fill('[data-act="sales-q"]','R1015-41');await pg.waitForTimeout(150);ok(await linhas()>=1&&await linhas()<=11,'busca: '+await linhas());
  await pg.evaluate(()=>{Object.assign(ETERNA.state.sales,{day:'all',seller:'all',pay:'all',q:'',canal:'all',status:'all',page:0});ETERNA.render();});await pg.waitForTimeout(150);
  // J2 e J3
  const lay=await pg.evaluate(()=>{const th=document.querySelector('#main thead th:last-child').getBoundingClientRect();const tb=document.querySelector('.sl-tbl');const tl=[...document.querySelectorAll('.sl-tiles .tile')].map(t=>Math.round(t.getBoundingClientRect().top));
    return {dir:th.right,iw:innerWidth,sw:document.documentElement.scrollWidth,tab:tb.getBoundingClientRect().width,wrap:tb.parentElement.clientWidth,tiles:tl,cols:[...document.querySelectorAll('#main thead th')].map(x=>x.textContent)};});
  ok(lay.dir<=lay.iw&&lay.sw<=lay.iw&&lay.tab<=lay.wrap+1,'J2: tabela inteira em 1366: '+J(lay));
  ok(lay.tiles.length===4&&new Set(lay.tiles).size===1,'J3: 4 cartões numa linha: '+J(lay.tiles));
  ok(!lay.cols.some(c=>/Ponto|Fotógrafo/i.test(c)),'J: sem as colunas Ponto e Fotógrafo: '+J(lay.cols));
  // J4
  const vis=await pg.evaluate(()=>document.querySelector('#main').innerText+[...document.querySelectorAll('#main option')].map(o=>o.textContent).join(' '));ok(!/simula/i.test(vis),'J4: "(simulação)" na tela');
  const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('[data-act="sales-csv"]')]);const csv=fs.readFileSync(await dl.path(),'utf8').replace(/^﻿/,'').trim().split('\n');
  ok(csv.length===413&&csv[0].split(';').length===19&&/ponto/.test(csv[0])&&/fotografo/.test(csv[0]),'J4: CSV com todas as linhas e as 19 colunas: '+J({n:csv.length,h:csv[0]}));
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-j: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-j: Lista de vendas com 4 cartões, filtros em select, 50 por página e a tabela inteira em 1366');
})();
