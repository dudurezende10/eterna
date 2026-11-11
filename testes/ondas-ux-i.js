// v94-ux parte I: Preços e Checkout em abas, Fundos de IA, Permissões (critérios I1 a I5 do plano docs/planos/2026-11-09-ondas-ux.md). Só o app.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
async function nova(b,semear){const ctx=await b.newContext({viewport:{width:1366,height:768}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(350);if(semear){await pg.evaluate(semear);await pg.reload();await pg.waitForTimeout(350);}return {ctx,pg};}
const abas=pg=>pg.$$eval('#main [data-act="cat-tab"]',bs=>bs.map(b=>b.textContent.trim()));
const aba=async(pg,t)=>{await pg.click(`#main [data-act="cat-tab"][data-t="${t}"]`);await pg.waitForTimeout(120);};
const toast=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
const TEC=/127\.0\.0\.1|Photoroom|\bFTP\b|sandbox_/;
(async()=>{const b=await chromium.launch();
try{
  // ---- I1, I3, I5: Admin
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'eduardo@eduardorezende.com'),'admin não entrou');await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(150);
    ok(J(await abas(pg))===J(['Preços','Checkout','Fundos de IA','Avançado']),'I1: abas do Admin: '+J(await abas(pg)));
    const i5=await pg.evaluate(()=>({sel:document.querySelectorAll('#main [data-act="cat-tab"][aria-selected="true"]').length,outros:!!document.querySelector('#busca-janela,#ia-cfg,#fundos-modo,#cat-fundos,[data-act="rf-save"],[data-act="cartao-lote"]'),h:document.querySelector('#main').scrollHeight,th:[...document.querySelectorAll('#main th')].map(x=>x.textContent)}));
    ok(i5.sel===1&&!i5.outros,'I5: só a aba Preços visível: '+J(i5));ok(i5.h<900,'I5: altura da aba Preços >= 900 px: '+i5.h);ok(i5.th.includes('Na semana'),'I: cabeçalho "Na semana": '+J(i5.th));
    for(const t of ['precos','checkout','fundos']){await aba(pg,t);const tx=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(!TEC.test(tx),'I3: texto técnico na aba '+t+': '+(tx.match(TEC)||[''])[0]);}
    await aba(pg,'checkout');ok(await pg.$('#busca-janela')&&await pg.$('#loja-fim')&&await pg.$('#main [data-v="calendario"]'),'I: aba Checkout com tempo da tela final, janela da selfie e Calendário');
    await aba(pg,'fundos');ok((await pg.$$('#cat-fundos [data-act="bg-on"]')).length===5&&await pg.$('#ia-cfg'),'I2: aba Fundos de IA com os 5 fundos e as fotos para os fundos de IA');
    await aba(pg,'avancado');ok(!(await pg.$('#fundos-modo'))&&await pg.$('[data-act="cartao-lote"]'),'I: aba Avançado com os cartões com QR, sem o painel do modo de montagem (v97: a montagem é sempre local)');
    // ACT_MOD fixo para as ações de Preços e Checkout
    const am=await pg.evaluate(()=>{const A=ETERNA.ACT_MOD;return ['bg-on','cartao-lote','loja-fim','price','price-reset'].map(k=>k+':'+A[k]);});
    ok(J(am)===J(['bg-on:configuracao','cartao-lote:catalogo','loja-fim:catalogo','price:catalogo','price-reset:catalogo']),'I: ACT_MOD '+J(am));
    // I4: Permissões
    await pg.evaluate(()=>ETERNA.go('permissoes'));await pg.waitForTimeout(150);await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(150);
    const p1=await pg.evaluate(()=>({t:document.querySelector('#main').innerText,open:document.querySelector('details.perm-fino').open,leg:!!document.querySelector('.perm-legenda'),th:[...document.querySelectorAll('.perm-tbl th')].map(x=>x.textContent)}));
    ok(!/\b(Create|Read|Update|Delete)\b/.test(p1.t)&&!p1.leg,'I4: texto em inglês ou legenda em Permissões');ok(p1.open===false,'I4: Ajuste fino aberto para perfil pronto');
    ok(J(p1.th.slice(1))===J(['Criar','Ver','Alterar','Excluir']),'I4: cabeçalhos da grade: '+J(p1.th));
    // salvar pela grade (abre o Ajuste fino, liga Ver em Alertas)
    await pg.click('details.perm-fino>summary');await pg.waitForTimeout(80);await pg.click('[data-act="perm-op"][data-m="relatorios"][data-op="r"]');await pg.waitForTimeout(120);
    ok(await pg.evaluate(()=>document.querySelector('details.perm-fino').open),'I4: personalizado (rascunho) com o Ajuste fino aberto');
    await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(200);
    const s1=await pg.evaluate(()=>{const u=ETERNA.USERS['carlos@eterna.photo'];return {r:u.perms.relatorios.r,preset:u.preset,log:ETERNA.auditRead().filter(e=>e.alvo==='carlos@eterna.photo'&&e.acao==='permissoes').length};});
    ok(s1.r&&s1.preset==='custom'&&s1.log===1,'I4: salvar pela grade: '+J(s1));
    await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(80);ok(await pg.evaluate(()=>document.querySelector('details.perm-fino').open),'I4: personalizado salvo abre o Ajuste fino');
    // Aplicar perfil volta ao Fotógrafo (passa pelo permValidate)
    await pg.selectOption('[data-act="perm-preset"]','foto');await pg.waitForTimeout(80);await pg.click('[data-act="perm-preset-apply"]');await pg.waitForTimeout(150);
    if(await pg.$('[data-act="perm-save"]:not([disabled])')){await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(200);}
    ok(await pg.evaluate(()=>ETERNA.USERS['carlos@eterna.photo'].preset==='foto'&&!ETERNA.USERS['carlos@eterna.photo'].perms.relatorios.r),'I4: Aplicar perfil não voltou ao Fotógrafo');
    // recusa com o texto de sempre: tirar Permissões de si mesmo
    await pg.click('[data-act="perm-sel"][data-e="eduardo@eduardorezende.com"]');await pg.waitForTimeout(150);
    if(!(await pg.evaluate(()=>document.querySelector('details.perm-fino').open))){await pg.click('details.perm-fino>summary');await pg.waitForTimeout(80);}
    await pg.click('[data-act="perm-op"][data-m="permissoes"][data-op="u"]');await pg.waitForTimeout(100);await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(150);
    ok(/Você não pode tirar de você mesmo o acesso a Usuários e Permissões/.test(await toast(pg)),'I4: recusa auto_bloqueio com o texto de sempre: '+await toast(pg));
    await ctx.close();}
  // ---- I1 e I2: Supervisora (4 abas; liga e desliga um fundo)
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'supervisor@eterna.photo'),'supervisora não entrou');await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(150);
    ok(J(await abas(pg))===J(['Preços','Checkout','Fundos de IA','Avançado']),'I1: abas da Supervisora: '+J(await abas(pg)));
    ok(await pg.evaluate(()=>[...document.querySelectorAll('[data-act="price"]')].every(i=>i.disabled)),'I1: Supervisora (catalogo só leitura) com preço editável');
    await aba(pg,'fundos');const b0=await pg.evaluate(()=>ETERNA.SIM.bgOn?ETERNA.SIM.bgOn.slice():null);
    const id=await pg.$eval('#cat-fundos [data-act="bg-on"][aria-pressed="true"]',e=>e.dataset.id);await pg.click(`#cat-fundos [data-act="bg-on"][data-id="${id}"]`);await pg.waitForTimeout(150);
    const b1=await pg.evaluate(()=>ETERNA.SIM.bgOn.slice());ok(!b1.includes(id),'I2: Supervisora não desligou o fundo '+id+': '+J({b0,b1}));
    ok(await pg.$eval(`#cat-fundos [data-act="bg-on"][data-id="${id}"]`,e=>/Inativo/.test(e.textContent)),'I2: fundo desligado aparece Inativo');
    await pg.click(`#cat-fundos [data-act="bg-on"][data-id="${id}"]`);await pg.waitForTimeout(150);ok(await pg.evaluate(id=>ETERNA.SIM.bgOn.includes(id),id),'I2: religar o fundo');
    ok(!(await pg.$('#nav [data-v="chroma"]')),'I: Supervisora sem Fundos de IA (técnico) no menu');
    await ctx.close();}
  // ---- I1: vendedor (só a tabela, título Preços, sem abas, inputs desligados)
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'loja@eterna.photo'),'vendedor não entrou');await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(150);
    const v=await pg.evaluate(()=>({h1:document.querySelector('#main h1').textContent,tabs:document.querySelectorAll('#main [data-act="cat-tab"]').length,ins:[...document.querySelectorAll('[data-act="price"]')].map(i=>i.disabled),reset:!!document.querySelector('[data-act="price-reset"]'),t:document.querySelector('#main').innerText}));
    ok(v.h1==='Preços'&&v.tabs===0&&v.ins.length&&v.ins.every(Boolean)&&!v.reset,'I1: vendedor: '+J({...v,t:undefined}));ok(!TEC.test(v.t),'I3: texto técnico para o vendedor');
    // forçar o input de preço sem catalogo.u: recusa
    const p0=await pg.evaluate(()=>JSON.stringify(ETERNA.SIM.prices||{}));
    await pg.evaluate(()=>{const i=document.querySelector('[data-act="price"]');i.disabled=false;i.value='1';i.dispatchEvent(new Event('input',{bubbles:true}));});await pg.waitForTimeout(100);
    ok(await pg.evaluate(()=>JSON.stringify(ETERNA.SIM.prices||{}))===p0,'I: vendedor mudou preço forçando o campo');
    await ctx.close();}
  // ---- I2: catalogo.u sem configuracao.u: ligar fundo recusa com o toast de sempre
  {const {ctx,pg}=await nova(b,()=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));const q={};Object.keys(U['eduardo@eduardorezende.com'].perms).forEach(m=>q[m]={c:false,r:false,u:false,d:false});q.catalogo={c:false,r:true,u:true,d:false};q.configuracao={c:false,r:true,u:false,d:false};
      U['precos@eterna.photo']={v:2,email:'precos@eterna.photo',name:'Preços',preset:'custom',key:null,perms:q,menu:['catalogo'],inicio:null,active:true,createdAt:new Date().toISOString(),lastLogin:null,mv:83,msis94:1};localStorage.setItem('eterna.users.v1',JSON.stringify(U));});
    ok(await entrar(pg,'precos@eterna.photo'),'precos@ não entrou');await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(150);
    ok(J(await abas(pg))===J(['Preços','Checkout','Fundos de IA','Avançado']),'I: abas de quem tem catalogo.u e configuracao.r: '+J(await abas(pg)));
    await aba(pg,'fundos');const b0=await pg.evaluate(()=>JSON.stringify(ETERNA.SIM.bgOn||null));const id=await pg.$eval('#cat-fundos [data-act="bg-on"]',e=>e.dataset.id);
    await pg.click(`#cat-fundos [data-act="bg-on"][data-id="${id}"]`);await pg.waitForTimeout(150);
    ok(await toast(pg)==='Sem permissão para alterar em Configurações do venue'&&await pg.evaluate(()=>JSON.stringify(ETERNA.SIM.bgOn||null))===b0,'I2: catalogo.u sem configuracao.u ligou fundo: '+await toast(pg));
    await aba(pg,'avancado');const t=await pg.evaluate(()=>document.querySelector('#main').textContent);ok(/Cartões com QR impresso/.test(t)&&!(await pg.$('[data-act="fundos-modo"]:not([disabled])')),'I: Avançado sem configuracao.u: cartões sim, montagem desligada');
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-i: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-i: Preços e Checkout em abas, Fundos de IA na aba, ACT_MOD fixo, Permissões com Ajuste fino e sem inglês');
})();
