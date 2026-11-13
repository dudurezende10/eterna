// Eduardo (11/11): Escala do fotógrafo com "Hoje você está em:" e os próximos 7 dias; Admin começa em hoje com os dias
// anteriores recolhidos; Calendário de eventos no grupo Dashboard. Print do fotógrafo em 1366 em ESCALA_PRINTS (ou testes/prints).
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');/* v93: usuário e senha */const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const PR=process.env.ESCALA_PRINTS||__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1366,height:h||768}});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});return {ctx,pg};}
async function entrar(pg,email){await pg.goto(U,{waitUntil:'domcontentloaded',timeout:60000});await pg.waitForSelector('[data-act="login-usuario"]');await pg.waitForTimeout(200);
  return entrarTeste(pg,email);}
// grava a função de hoje de uma pessoa (a mesma estrutura do setFunc) e abre a Escala
const funcHoje=(pg,k,f)=>pg.evaluate(([k,f])=>{const d=new Date().toISOString().slice(0,10);const S=ETERNA.SIM;const m=S.funcao&&S.funcao.date===d?S.funcao.map:{};if(f)m[k]=f;else delete m[k];S.funcao={date:d,map:m};ETERNA.go('escala');},[k,f]);
const hero=pg=>pg.evaluate(()=>{const h=document.querySelector('#esc-hoje');return h?{t:h.innerText.replace(/\s+/g,' ').trim(),tipo:h.dataset.tipo,px:parseFloat(getComputedStyle(h.querySelector('.esc-ponto,.esc-aviso')).fontSize),peso:+getComputedStyle(h.querySelector('.esc-ponto,.esc-aviso')).fontWeight}:null;});
(async()=>{const b=await chromium.launch();
try{
  const hoje=new Date().toISOString().slice(0,10);
  // 1: fotógrafo (Carlos) no Foto Campo 2
  {const {ctx,pg}=await nova(b,1366,768);ok(await entrar(pg,'carlos@eterna.photo'),'1: Carlos entrou');
    await funcHoje(pg,'carlos',{tipo:'campo',point:'campo2'});await pg.waitForTimeout(200);
    const h=await hero(pg);ok(h&&/^Hoje você está em: Foto Campo 2$/.test(h.t),'1: frase e ponto: '+J(h));ok(h&&h.px>=32&&h.peso>=600,'1: ponto com 32 px ou mais e peso forte: '+J(h));
    const lista=await pg.$$eval('#esc-prox li',ls=>ls.map(l=>l.dataset.d));const fim=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
    ok(lista.length===7&&lista.every(d=>d>hoje)&&lista[6]===fim,'1: só os próximos 7 dias: '+J(lista));
    const r=await pg.evaluate(()=>({grade:!!document.querySelector('#main .grid-week'),ant:!!document.querySelector('#esc-anteriores'),sel:!!document.querySelector('#main select[data-act="func-set"]'),txt:document.querySelector('#main').innerText}));
    ok(!r.grade&&!r.ant&&!r.sel,'1: sem a grade da equipe nem os dias anteriores: '+J({grade:r.grade,ant:r.ant,sel:r.sel}));
    const ano=+hoje.slice(0,4),mes=+hoje.slice(5,7);const datas=[...r.txt.matchAll(/\b(\d\d)\/(\d\d)\b/g)].map(m=>`${+m[2]<mes?ano+1:ano}-${m[2]}-${m[1]}`);
    ok(datas.length>=8&&datas.every(d=>d>=hoje),'1: nenhuma data passada na tela: '+J(datas));
    ok(!/Marinara|Samuel|Yago/.test(r.txt),'1: sem nomes de outros fotógrafos');
    const lat=await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);ok(lat,'1: sem rolagem lateral em 1366');
    await pg.screenshot({path:PR+'/escala-fotografo-1366.png',fullPage:true});
    // 2: volante, folga e fora da escala
    await funcHoje(pg,'carlos',{tipo:'volante',modo:'chute'});await pg.waitForTimeout(150);let x=await hero(pg);ok(x&&/^Hoje você está como Volante Chute a gol/.test(x.t),'2: volante e modo: '+J(x));
    await funcHoje(pg,'carlos',{tipo:'folga'});await pg.waitForTimeout(150);x=await hero(pg);ok(x&&x.t==='Hoje é sua folga','2: folga: '+J(x));
    await ctx.close();}
  // 3: fotógrafo sem ponto fixo e sem função gravada hoje (Márcio)
  {const {ctx,pg}=await nova(b,390,844);ok(await entrar(pg,'marcio@eterna.photo'),'3: Márcio entrou');await funcHoje(pg,'marcio',null);await pg.waitForTimeout(200);
    const h=await hero(pg);ok(h&&h.t==='Você não está na escala de hoje. Fale com a supervisora.','3: fora da escala: '+J(h));
    ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'3: sem rolagem lateral no celular');await ctx.close();}
  // 4: Admin vê a Escala completa começando em hoje, dias anteriores recolhidos; Calendário no grupo Dashboard
  {const {ctx,pg}=await nova(b,1366,900);ok(await entrar(pg,'eduardo@eduardorezende.com'),'4: Admin entrou');await pg.evaluate(()=>ETERNA.go('escala'));await pg.waitForTimeout(250);
    const r=await pg.evaluate(()=>{const hd=[...document.querySelectorAll('#esc-semana .grid-week .hd')].map(x=>x.textContent.trim()).filter(Boolean);const d=document.querySelector('#esc-anteriores');
      const sel=document.querySelectorAll('#main select[data-act="func-set"]').length;const head=document.querySelector('#main .head .eyebrow').textContent;const hero=!!document.querySelector('#esc-hoje');
      const primeiro=[...document.querySelectorAll('#main .panel')].find(p=>p.offsetParent&&/\d\d\/\d\d/.test(p.innerText));return {hd,aberto:d&&d.open,sum:d&&d.querySelector('summary').textContent.trim(),sel,head,hero,prim:primeiro?primeiro.innerText.match(/\d\d\/\d\d/)[0]:null};});
    const dm=hoje.slice(8,10)+'/'+hoje.slice(5,7);
    ok(r.hd[0]==='hoje'&&r.hd.length===7,'4: grade começa em hoje: '+J(r.hd));ok(r.head.includes(dm)&&!/últimos 7 dias/.test(r.head),'4: topo com a data de hoje: '+r.head);
    ok(r.prim===dm,'4: primeira data visível é hoje: '+J(r.prim));
    ok(r.aberto===false&&r.sum==='Ver dias anteriores','4: dias anteriores recolhidos: '+J(r));ok(r.sel>=5&&!r.hero,'4: Admin continua com a função de cada fotógrafo: '+J(r));
    const g=await pg.$$eval('#nav .navg',gs=>gs.map(g=>[g.querySelector('.grp')?g.querySelector('.grp').textContent.trim():'',[...g.querySelectorAll('button[data-v]')].map(x=>x.dataset.v)]));
    const dash=g.find(x=>/Dashboard/.test(x[0]));const foto=g.find(x=>/Fotógrafo/.test(x[0]));
    ok(dash&&dash[1].includes('calendario'),'4: Calendário no grupo Dashboard: '+J(g));ok(foto&&!foto[1].includes('calendario'),'4: Calendário fora do grupo Fotógrafo');
    await pg.screenshot({path:PR+'/escala-admin-1366.png',fullPage:true});
    await pg.evaluate(()=>ETERNA.go('calendario'));await pg.waitForTimeout(150);ok(/Dashboard/.test(await pg.textContent('#main .head .eyebrow')),'4: Calendário com o rótulo Dashboard');
    await ctx.close();}
  // 5: Supervisora também vê a Escala completa (muda a escala)
  {const {ctx,pg}=await nova(b,1366,900);ok(await entrar(pg,'supervisor@eterna.photo'),'5: Supervisora entrou');await pg.evaluate(()=>ETERNA.go('escala'));await pg.waitForTimeout(200);
    const r=await pg.evaluate(()=>({hero:!!document.querySelector('#esc-hoje'),semana:!!document.querySelector('#esc-semana'),ant:!!document.querySelector('#esc-anteriores')}));ok(!r.hero&&r.semana&&r.ant,'5: Supervisora com a Escala completa: '+J(r));
    const v=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));ok(v.includes('calendario'),'5: Supervisora continua com o Calendário');await ctx.close();}
  // 6: menu do fotógrafo continua sem o Calendário
  {const {ctx,pg}=await nova(b);await entrar(pg,'carlos@eterna.photo');const v=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));ok(!v.includes('calendario')&&v.includes('escala'),'6: menu do fotógrafo: '+J(v));await ctx.close();}
}catch(e){fails.push('exceção: '+String(e&&e.stack||e).slice(0,600));}
await b.close();const okAll=!fails.length&&!errs.length;
console.log(`${okAll?'OK':'FALHA'} escala-fotografo: hoje em letra grande, próximos 7 dias, Admin a partir de hoje, Calendário no Dashboard${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okAll?0:1);})();
