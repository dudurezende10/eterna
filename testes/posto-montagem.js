// Eduardo (11/11): o Posto avisa o caixa quando o pedido tem foto com fundo de IA (Edição Maracanã, aiSel) e o pacote não a imprime.
// A montagem ainda não vai para a galeria do QR e só chega ao cliente impressa. O aviso não bloqueia a venda.
// Pedido com 1 montagem + 2 fotos: Zona Mista e Maracanã Mais avisam; Gramado não; pedido sem montagem nunca avisa. Sem agente.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const UM='Este pedido tem 1 foto Edição Maracanã. Neste pacote ela não é impressa e ainda não vai para a galeria. Ofereça um pacote com impressão.';
const DOIS='Este pedido tem 2 fotos Edição Maracanã. Neste pacote elas não são impressas e ainda não vão para a galeria. Ofereça um pacote com impressão.';
(async()=>{const b=await chromium.launch();
try{const ctx=await b.newContext({viewport:{width:1366,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(400);
  await pg.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.click('button[type=submit]');await pg.waitForTimeout(150);await pg.fill('[data-act="login-code"]',(await pg.textContent('.otp')).replace(/\s/g,''));await pg.waitForTimeout(450);
  // pedidos do Checkout: A = 2 fotos + 1 montagem; B = 3 fotos, sem montagem; C = 1 foto + 2 montagens; D = 4 fotos + 1 montagem
  const pk=await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const bg=E.bgOn()[0].id||E.bgOn()[0];const ds=E.demoSessions().filter(s=>s.status!=='paga'&&s.status!=='aberta'&&s.photos.length>=6).sort((a,b)=>a.card<b.card?-1:1);
    const ped=(id,s,nPh,nAI,cod)=>({id,card:s.card,codigo:cod,criada:new Date().toISOString(),estado:'escolha',escolha:true,n:nPh+nAI,nSes:nPh+nAI,selected:s.photos.slice(0,nPh).map(p=>p.id),aiSel:s.photos.slice(nPh,nPh+nAI).map(p=>p.id+'|'+bg),fav:[],pkg:null,total:null,meio:null,canal:'checkout',iniciado:'aguardando',saleNo:'L0-9'+id.slice(-2)});
    S.caixaDin=[ped('L00-mont000a01',ds[0],2,1,'MONA-2345'),ped('L00-mont000b02',ds[1],3,0,'MONB-2345'),ped('L00-mont000c03',ds[2],1,2,'MONC-2345'),ped('L00-mont000d04',ds[3],4,1,'MOND-2345')];
    localStorage.setItem('eterna.sim.v1',JSON.stringify(S));E.simFresh();E.go('posto');
    const id=n=>[...document.querySelectorAll('[data-pend="L00-mont000a01"] .pend-pkg')].map(x=>[x.querySelector('b').textContent,x.dataset.p]).find(x=>x[0].includes(n))[1];
    return {zona:id('Zona Mista'),mais:id('Maracanã Mais'),gramado:id('Gramado')};});
  const A='L00-mont000a01',B='L00-mont000b02',C='L00-mont000c03',D='L00-mont000d04';
  const ver=id=>pg.evaluate(id=>{const it=document.querySelector(`#pend-painel [data-pend="${id}"]`);const av=it.querySelector('.pend-mont');
    return {aviso:av?av.textContent:'',selos:[...it.querySelectorAll('.pend-pkg')].filter(x=>x.querySelector('.pend-semmont')).map(x=>x.querySelector('b').textContent.replace('Pacote ','')).sort(),seloTxt:(it.querySelector('.pend-semmont')||{}).textContent||'',depoisDosPacotes:!!av&&av.previousElementSibling&&av.previousElementSibling.classList.contains('pend-pkgs')};},id);
  const escolher=async(id,p)=>{await pg.click(`#pend-painel [data-act="pend-pkg"][data-id="${id}"][data-p="${p}"]`);await pg.waitForTimeout(200);};
  // sem pacote escolhido: sem aviso; selo só nos pacotes só digitais do pedido com montagem
  let a=await ver(A);ok(a.aviso===''&&J(a.selos)===J(['Maracanã Mais','Zona Mista'])&&a.seloTxt==='sem a Edição Maracanã','A sem pacote: selo nos só digitais, sem aviso: '+J(a));
  let s=await ver(B);ok(s.aviso===''&&!s.selos.length,'B (sem montagem) sem pacote: nada: '+J(s));
  // A: Zona Mista e Maracanã Mais avisam; Gramado não
  await escolher(A,pk.zona);a=await ver(A);ok(a.aviso===UM&&a.depoisDosPacotes,'A com Zona Mista: aviso logo abaixo dos pacotes: '+J(a));
  await escolher(A,pk.mais);a=await ver(A);ok(a.aviso===UM,'A com Maracanã Mais: aviso: '+J(a));
  await escolher(A,pk.gramado);a=await ver(A);ok(a.aviso===''&&J(a.selos)===J(['Maracanã Mais','Zona Mista']),'A com Gramado: sem aviso: '+J(a));
  // B: pedido sem montagem nunca avisa
  for(const p of [pk.zona,pk.mais,pk.gramado]){await escolher(B,p);s=await ver(B);ok(s.aviso===''&&!s.selos.length,'B (sem montagem) com '+p+': '+J(s));}
  // C: plural
  await escolher(C,pk.zona);s=await ver(C);ok(s.aviso===DOIS,'C (2 montagens) com Zona Mista: plural: '+J(s));
  // D: Zona Mista com 5 itens imprime só os 2 adicionais e a montagem fica no fim da fila: não é impressa
  await escolher(D,pk.zona);s=await ver(D);const dp=await pg.evaluate(id=>ETERNA.SIM.caixaDin.find(x=>x.id===id).prints,D);
  ok(dp===2&&s.aviso==='1 foto Edição Maracanã não será impressa neste pacote.','D: montagem que não cabe nas impressões: '+J({dp,s}));
  ok(await pg.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return ETERNA.pendMontSemImp(r,2)===1&&ETERNA.pendMontSemImp(Object.assign({},r,{fav:['ai:'+r.aiSel[0]]}),2)===0&&ETERNA.pendMontSemImp(r,5)===0&&ETERNA.pendMontSemImp(r,0)===1;},D),'D: a conta segue a ordem da impressão (favorita imprime primeiro)');
  await escolher(D,pk.gramado);s=await ver(D);ok(s.aviso==='','D com Gramado: tudo impresso, sem aviso: '+J(s));
  // o aviso não bloqueia a venda
  await escolher(A,pk.zona);await pg.click(`#pend-painel [data-act="pend-meio"][data-id="${A}"][data-m="dinheiro"]`);await pg.waitForTimeout(200);
  ok(await pg.evaluate(id=>{const b=document.querySelector(`[data-act="din-confirm"][data-id="${id}"]`);return !!b&&!b.disabled;},A),'A: o botão de confirmar continua ativo com o aviso');
  await pg.click(`[data-act="din-confirm"][data-id="${A}"]`);await pg.waitForTimeout(400);
  ok(await pg.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);return r.estado==='confirmada'&&S.sessions[r.card].status==='paga'&&S.sessions[r.card].aiSel.length===1;},A),'A: a venda com o aviso é confirmada normalmente');
  // v98 (Eduardo, 12/11): a Venda manual não tem mais Fundo de IA; com a montagem do servidor desligada não há montagem nem aviso ali
  await pg.click('.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(250);
  const c=await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="checkout-pick"]')].map(x=>x.dataset.card).sort()[0]);await pg.click(`#posto-manual [data-act="checkout-pick"][data-card="${c}"]`);await pg.waitForTimeout(1200);
  const vm=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');return {aviso:!!m.querySelector('.pend-mont'),bg:!!m.querySelector('[data-act="fila-bg"]'),ai:m.querySelectorAll('[data-act="fila-ai"]').length,txt:/Fundo de IA/.test(m.textContent),fotos:m.querySelectorAll('[data-act="fila-sel"]').length};});
  ok(!vm.aviso&&!vm.bg&&!vm.ai&&!vm.txt&&vm.fotos>0,'Venda manual: sem Fundo de IA, sem montagem (servidor desligado) e sem aviso: '+J(vm));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA posto-montagem: '+fails.join(' || '));process.exit(1);}
console.log('OK posto-montagem: aviso da Edição Maracanã no pedido do Checkout (pacote só digital, impressões que não cabem, sem montagem); Venda manual sem Fundo de IA');process.exit(0);
})();
