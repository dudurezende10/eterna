// v100: catálogo das ativações em Preços e Checkout (aba Ativações): carga inicial, preço sugerido, editar, Hoje não vendo, produto novo e idioma.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  // preço sugerido
  const pr=await A.evaluate(()=>{const {ATIV_PADRAO,ativPreco,ativOk}=ETERNA;const P=id=>ATIV_PADRAO.find(p=>p.id===id);return {
    ast:ativPreco(P('asteroid'),{op:'Campo'}),ast4k2:ativPreco(P('asteroid'),{op:'Campo',k4:true,qtd:2}),boomChuva:ativPreco(P('boomerang'),{chuva:true}),astChuva:ativPreco(P('asteroid'),{chuva:true}),
    banco:ativPreco(P('inside_out'),{op:'Banco de Suplentes'}),snap1:ativPreco(P('snap_video'),{qtd:1}),snap3:ativPreco(P('snap_video'),{qtd:3}),snap5:ativPreco(P('snap_video'),{qtd:5}),
    extra:ativPreco({...P('boomerang'),extra:{limite:4,valor:20}},{pessoas:6}),ok:ATIV_PADRAO.every(p=>ativOk({...p,ativo:true}))};});
  ok(pr.ast===180&&pr.ast4k2===500&&pr.boomChuva===180&&pr.astChuva===null&&pr.banco===250,'drone: preço por local, 4K por vídeo, só Boomerang com chuva: '+J(pr));
  ok(pr.snap1===110&&pr.snap3===290&&pr.snap5===470,'Snap Pop por quantidade (4º e 5º + R$ 90): '+J(pr));
  ok(pr.extra===160&&pr.ok,'pessoa extra e carga inicial no formato: '+J(pr));
  // aba
  await A.evaluate(()=>{ETERNA.go('catalogo');});await A.waitForTimeout(250);
  ok(await A.$('[data-act="cat-tab"][data-t="ativ"]')!==null,'aba Ativações em Preços e Checkout');
  await A.click('[data-act="cat-tab"][data-t="ativ"]');await A.waitForTimeout(200);
  const n=await A.evaluate(()=>({d:document.querySelectorAll('#ativ-drone tbody tr').length,c:document.querySelectorAll('#ativ-chute tbody tr').length,s:document.querySelectorAll('#ativ-snap tbody tr').length}));
  ok(n.d===3&&n.c===11&&n.s===1,'carga inicial: 3 de Drone, 11 de Chute a Gol, 1 de Snap Pop: '+J(n));
  ok(/Banco de Suplentes R\$\s250/.test(await A.textContent('#ativ-drone tr[data-ativ="inside_out"]')),'preço do banco de suplentes na tabela');
  // editar
  await A.click('[data-act="ativ-editar"][data-id="boomerang"]');await A.waitForTimeout(150);
  ok(await A.$('#ativ-form')!==null,'formulário de edição');
  await A.fill('[data-act="ativ-op"][data-i="0"][data-k="preco"]','130');await A.dispatchEvent('[data-act="ativ-op"][data-i="0"][data-k="preco"]','change');
  await A.click('[data-act="ativ-salvar"]');await A.waitForTimeout(200);
  const ed=await A.evaluate(()=>({p:ETERNA.state.ativ.produtos.boomerang&&ETERNA.state.ativ.produtos.boomerang.opcoes[0].preco,form:!!document.querySelector('#ativ-form'),log:ETERNA.auditRead().some(e=>e.acao==='ativ_editar'&&e.alvo==='ativ/boomerang')}));
  ok(ed.p===130&&!ed.form&&ed.log,'preço editado, formulário fecha e fica no registro: '+J(ed));
  ok(/Campo R\$\s130/.test(await A.textContent('#ativ-drone tr[data-ativ="boomerang"]')),'tabela mostra o preço novo');
  // Hoje não vendo
  await A.click('[data-act="ativ-hoje"][data-id="boomerang"]');await A.waitForTimeout(150);
  const hj=await A.evaluate(()=>({fora:ETERNA.ativForaHoje('boomerang'),vend:ETERNA.ativVendavel(ETERNA.state.ativ.produtos.boomerang),txt:document.querySelector('#ativ-drone tr[data-ativ="boomerang"]').textContent}));
  ok(hj.fora&&!hj.vend&&/Fora hoje/.test(hj.txt)&&/Voltar a vender hoje/.test(hj.txt),'Hoje não vendo: '+J(hj));
  const amanha=await A.evaluate(()=>{const s=ETERNA.state;s.ativ.hoje.boomerang.dia='2000-01-01';return ETERNA.ativVendavel(s.ativ.produtos.boomerang);});
  ok(amanha,'no dia seguinte o produto volta sozinho');
  // produto novo, com erro de nome antes
  await A.click('[data-act="ativ-novo"][data-c="chute"]');await A.waitForTimeout(150);
  await A.click('[data-act="ativ-salvar"]');await A.waitForTimeout(150);
  ok(/Dê um nome ao produto/.test(await A.textContent('#ativ-form')),'sem nome não salva');
  await A.fill('[data-act="ativ-f"][data-k="nome"]','Bola Oficial');await A.fill('[data-act="ativ-op"][data-i="0"][data-k="preco"]','300');
  await A.selectOption('[data-act="ativ-f"][data-k="entrega"]','fisico');await A.waitForTimeout(100);
  await A.click('[data-act="ativ-salvar"]');await A.waitForTimeout(200);
  const nv=await A.evaluate(()=>ETERNA.state.ativ.produtos.bola_oficial);
  ok(nv&&nv.cat==='chute'&&nv.entrega==='fisico'&&nv.opcoes[0].preco===300&&nv.ativo,'produto novo gravado: '+J(nv));
  // nome com < é recusado
  await A.click('[data-act="ativ-editar"][data-id="bola_oficial"]');await A.waitForTimeout(100);await A.fill('[data-act="ativ-f"][data-k="nome"]','<b>x');await A.click('[data-act="ativ-salvar"]');await A.waitForTimeout(150);
  ok(await A.evaluate(()=>ETERNA.state.ativ.produtos.bola_oficial.nome)==='Bola Oficial','nome com < não entra');await A.click('[data-act="ativ-cancelar"]');
  // idioma da equipe
  await A.evaluate(()=>ETERNA.idiomaEquipe('en'));await A.waitForTimeout(200);
  const en=await A.textContent('#main');ok(/Not selling today|Sell again today/.test(en)&&/Shot on goal/.test(en)&&/Options and prices/.test(en),'aba em inglês');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes: carga inicial, preço sugerido, editar, Hoje não vendo, produto novo e idioma');process.exit(0);
})();
