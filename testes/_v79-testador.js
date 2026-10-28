// Conferência do testador na v79 (1440 e 390): Ideal 4/7/8/13, economia, dinheiro → Caixa em outra janela, sessão paga reaberta,
// botão da equipe só na câmera, recarregar /#loja e ?x#caixa na aba do Checkout, interruptor do ajuste no Upload, tela final 390 pt/de.
const {chromium}=require('playwright');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8971/index.html';const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
const fails=[],errs=[],notas=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
function vigia(pg,nome){pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(`${nome}: ${e.message}`));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(`${nome}: ${m.text()}`);});return pg;}
async function codigo(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
const ruim=async(pg,onde)=>{const t=await pg.evaluate(()=>document.body.innerText);const m=t.match(/\b(null|NaN|undefined)\b|\[object Object\]/);ok(!m,`${onde}: texto visível com "${m&&m[0]}" ... ${m?t.slice(Math.max(0,m.index-60),m.index+40).replace(/\s+/g,' '):''}`);};
const semRolagem=async(pg,onde)=>ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${onde}: rolagem horizontal`);
async function sessao(pg,card,nPh,nAI){await pg.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;const k=ETERNA.state.kiosk;if(k.step!=='code'){k.step='code';ETERNA.render();}});
  await pg.click('[data-act="kiosk-emerg"]');await pg.fill('#kcode',card);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(700);
  for(let t=0;t<4;t++){const r=await pg.evaluate(([card,nPh,nAI])=>{const it=ETERNA.lojaItems(card);const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);
      it.filter(x=>x.t==='ph').slice(0,nPh).forEach(x=>pk[x.k]='ok');it.filter(x=>x.t==='ai').slice(0,nAI).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;
      const c=ETERNA.lojaCart(card);return [c.nPh,c.nAI];},[card,nPh,nAI]);if(r[0]===nPh&&r[1]===nAI)break;await pg.waitForTimeout(700);}
  await pg.evaluate(()=>{ETERNA.state.kiosk.step='cart';ETERNA.render();});await pg.waitForTimeout(300);}
const carr=pg=>pg.evaluate(()=>{const q=s=>[...document.querySelectorAll(s)];const T=e=>e?e.innerText.replace(/\s+/g,' ').trim():'';
  return {on:(document.querySelector('.lj-pkg.on')||{dataset:{}}).dataset.id,ideal:(q('.lj-pkg').find(b=>b.querySelector('.lj-badge'))||{dataset:{}}).dataset.id,
    sum:q('.lj-sumrow').map(T),total:T(document.querySelector('.lj-total b')),save:T(document.querySelector('.lj-save')),incl:T(document.querySelector('.lj-incl')),btn:T(document.querySelector('.lj-paybtn'))};});
(async()=>{const b=await chromium.launch();
try{
  for(const [W,H] of [[1440,900],[390,844]]){const tag=W;
    const ctx=await b.newContext({viewport:{width:W,height:H}});const A=vigia(await ctx.newPage(),`A${tag}`);
    await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(600);
    ok(await codigo(A,'eduardo@eduardorezende.com'),`${tag}: admin não entrou`);
    // Abrir Checkout pelo botão (na 390 o menu é gaveta, mas o botão fica na barra)
    const temBtn=await A.evaluate(()=>!!document.querySelector('[data-act="loja-abrir"]'));ok(temBtn,`${tag}: sem botão Abrir Checkout`);
    await A.evaluate(()=>document.querySelector('[data-act="loja-abrir"]').click());await A.waitForTimeout(700);
    await A.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
    const st=await A.evaluate(()=>({h:location.hash,v:ETERNA.state.view,btn:!!document.querySelector('.lj-staffhome'),txt:(document.querySelector('.lj-staffhome')||{}).innerText}));
    ok(st.h==='#loja'&&st.btn&&/Equipe: voltar ao app/.test(st.txt||''),`${tag}: na câmera o botão "Equipe: voltar ao app" deveria aparecer: `+J(st));
    await A.screenshot({path:`${P}/t79-${tag}-camera-equipe.png`});await ruim(A,`${tag} câmera`);await semRolagem(A,`${tag} câmera`);
    // um toque arma, segundo volta ao app logado
    await A.click('.lj-staffhome');await A.waitForTimeout(150);ok(/Toque de novo/.test(await A.evaluate(()=>document.querySelector('.lj-staffhome').innerText)),`${tag}: primeiro toque não armou`);
    await A.screenshot({path:`${P}/t79-${tag}-camera-armado.png`});
    await A.click('.lj-staffhome');await A.waitForTimeout(500);
    const volta=await A.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view,h:location.hash,tab:sessionStorage.getItem('eterna.lojaTab')}));
    ok(volta.u&&volta.v!=='quiosque'&&volta.v!=='entrar'&&volta.tab===null,`${tag}: dois toques deveriam voltar ao app logado: `+J(volta));
    // abrir de novo; primeiro toque de cliente (contingência) some com o botão
    await A.evaluate(()=>document.querySelector('[data-act="loja-abrir"]').click());await A.waitForTimeout(600);
    await A.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
    await A.click('[data-act="kiosk-emerg"]');await A.waitForTimeout(250);
    ok(!(await A.$('.lj-staffhome')),`${tag}: depois do primeiro toque de cliente o botão deveria sumir`);
    await A.evaluate(()=>{ETERNA.state.kiosk.step='code';ETERNA.render();});await A.waitForTimeout(150);
    ok(!(await A.$('.lj-staffhome')),`${tag}: voltando à câmera o botão não deveria reaparecer`);
    // sessões
    const cards=await A.evaluate(()=>ETERNA.demoSessions().map(s=>s.card).filter(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').length>=13).slice(0,8));
    ok(cards.length>=6,`${tag}: poucas sessões com 13 fotos: `+cards.length);
    const casos=[[4,0,'zona',145,'1 foto impressa',30],[7,0,'gramado',185,'7 fotos impressas',95],[8,0,'maracana',190,'8 fotos impressas',125],[4,4,'maracana',190,'8 fotos impressas',125],[13,0,'mais',250,null,null]];
    let i=0;for(const [nPh,nAI,pk,tot,imp,sv] of casos){const card=cards[i++];await sessao(A,card,nPh,nAI);const c=await carr(A);
      await A.screenshot({path:`${P}/t79-${tag}-carrinho-${nPh}${nAI?'+'+nAI+'ia':''}.png`,fullPage:true});
      ok(c.on===pk&&c.ideal===pk,`${tag} ${nPh}+${nAI}: Ideal/marcado ${c.ideal}/${c.on}, esperado ${pk}`);
      ok(c.total===`R$ ${tot}`,`${tag} ${nPh}+${nAI}: total ${c.total}, esperado R$ ${tot}`);
      if(imp)ok(c.incl.includes(imp),`${tag} ${nPh}+${nAI}: impressas "${c.incl}" deveria ter "${imp}"`);
      let esp=sv;if(sv===null){const nSes=await A.evaluate(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').length,card);esp=Math.max(0,70+(nSes-1)*35-250);notas.push(`${tag} 13 fotos: sessão com ${nSes} fotos, economia esperada ${esp}; tela "${c.save}"; resumo ${J(c.sum)}; leva "${c.incl}"`);}
      ok(esp>0?c.save===`economia de R$ ${esp}`:!c.save,`${tag} ${nPh}+${nAI}: economia "${c.save}", esperado R$ ${esp}`);
      if(nPh===4&&!nAI)ok(J(c.sum)===J(['Pacote 3 fotos R$ 110','1 foto adicional × R$ 35 R$ 35'])||c.sum.length===2,`${tag} 4: resumo ${J(c.sum)}`);
      if(nPh===4&&!nAI)notas.push(`${tag} 4 fotos: resumo ${J(c.sum)} leva "${c.incl}"`);
      if(nPh===7)notas.push(`${tag} 7 fotos: resumo ${J(c.sum)}`);
      await ruim(A,`${tag} carrinho ${nPh}+${nAI}`);await semRolagem(A,`${tag} carrinho ${nPh}+${nAI}`);}
    // ---- Dinheiro → Caixa em outra janela
    const card=cards[5]||cards[0];await sessao(A,card,4,0);
    await A.click('[data-act="loja-paym"][data-m="cash"]');await A.waitForTimeout(150);
    const bt=await carr(A);ok(/Finalizar e pagar R\$ 145 no caixa/.test(bt.btn),`${tag}: botão do dinheiro "${bt.btn}"`);
    await A.click('[data-act="loja-checkout"]');await A.waitForTimeout(700);
    await A.screenshot({path:`${P}/t79-${tag}-dinheiro-final-pt.png`});await ruim(A,`${tag} final dinheiro`);await semRolagem(A,`${tag} final dinheiro`);
    const fim=await A.evaluate(()=>({t:document.body.innerText.replace(/\s+/g,' '),wait:!!document.querySelector('.lj-cashdone .lj-pendbig'),ok:!!document.querySelector('.lj-okbig')}));
    ok(fim.wait&&!fim.ok&&/Pague no caixa/i.test(fim.t)&&/R\$ 145/.test(fim.t)&&/[A-Z0-9]{4}-[A-Z0-9]{4}/.test(fim.t)&&!/Obrigad/.test(fim.t),`${tag}: tela final do dinheiro: `+fim.t.slice(0,300));
    const B=vigia(await ctx.newPage(),`B${tag}`);await B.goto(U);await B.waitForTimeout(500);
    const bUser=await B.evaluate(()=>!!ETERNA.state.user);if(!bUser)ok(await codigo(B,'loja@eterna.photo'),`${tag}: Atendimento não entrou`);
    notas.push(`${tag}: janela B abriu ${bUser?'já logada (sessão salva)':'no login'}`);
    await B.evaluate(()=>{ETERNA.state.view='caixa';ETERNA.render();});await B.waitForTimeout(300);
    const cod=await A.evaluate(()=>ETERNA.SIM.caixaDin[0]&&ETERNA.SIM.caixaDin[0].codigo);
    ok((await B.evaluate(()=>document.body.innerText)).includes(cod),`${tag}: Caixa não mostra o código ${cod}`);
    await B.screenshot({path:`${P}/t79-${tag}-caixa-aguardando.png`,fullPage:true});await ruim(B,`${tag} caixa`);await semRolagem(B,`${tag} caixa`);
    const rc=await B.$('[data-act="din-confirm"]');ok(!!rc,`${tag}: sem botão Recebi`);
    if(rc){await rc.click();await B.waitForTimeout(400);await rc.click().catch(()=>{});await B.waitForTimeout(600);}
    await B.screenshot({path:`${P}/t79-${tag}-caixa-confirmado.png`,fullPage:true});await ruim(B,`${tag} caixa confirmado`);
    const sb=await B.evaluate(c=>({st:ETERNA.SIM.sessions[c].status,pay:ETERNA.SIM.sessions[c].payment,sale:ETERNA.SIM.sessions[c].saleNo,por:ETERNA.SIM.sessions[c].caixaPor,est:ETERNA.SIM.caixaDin[0].estado,n:ETERNA.SIM.caixaDin.length}),card);
    ok(sb.st==='paga'&&sb.pay==='Dinheiro'&&sb.sale&&sb.est==='confirmada',`${tag}: depois do Recebi: `+J(sb));
    await A.waitForTimeout(800);const sa=await A.evaluate(c=>ETERNA.SIM.sessions[c].status,card);ok(sa==='paga',`${tag}: janela do Checkout não adotou o SIM: ${sa}`);
    // sessão paga reaberta
    await A.evaluate(()=>{const k=ETERNA.state.kiosk;k.step='code';k.code='';ETERNA.render();});await A.waitForTimeout(200);
    await A.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});await A.click('[data-act="kiosk-emerg"]');await A.fill('#kcode',card);await A.click('[data-act="kiosk-go"]');await A.waitForTimeout(800);
    await A.screenshot({path:`${P}/t79-${tag}-ja-paga.png`});
    const jp=await A.evaluate(()=>({t:document.body.innerText.replace(/\s+/g,' '),pay:!!document.querySelector('[data-act="loja-checkout"]'),step:ETERNA.state.kiosk.step}));
    ok(/já foram compradas/i.test(jp.t)&&!jp.pay,`${tag}: sessão paga reaberta deveria bloquear: `+J({step:jp.step,pay:jp.pay,t:jp.t.slice(0,160)}));
    // força o carrinho
    await A.evaluate(()=>{ETERNA.state.kiosk.step='cart';ETERNA.render();});await A.waitForTimeout(150);
    ok(!(await A.$('[data-act="loja-checkout"]')),`${tag}: carrinho de sessão paga com botão de pagar`);
    const antes=await A.evaluate(()=>ETERNA.SIM.caixaDin.length);await A.evaluate(()=>{ETERNA.state.kiosk.step='cart';});
    await A.evaluate(()=>{ETERNA.state.kiosk.pay='cash';const x=document.createElement('button');x.dataset.act='loja-checkout';document.body.appendChild(x);x.click();x.remove();});await A.waitForTimeout(200);
    ok(await A.evaluate(()=>ETERNA.SIM.caixaDin.length)===antes,`${tag}: lojaPay('cash') em sessão paga criou pendência`);
    // ---- recarregar /#loja e ?x#caixa na aba do Checkout
    await A.reload();await A.waitForTimeout(700);
    let r=await A.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view,h:location.hash,staff:!!document.querySelector('.lj-staffhome')}));
    ok(!r.u&&r.v==='quiosque'&&!r.staff,`${tag}: recarregar #loja: `+J(r));
    await A.goto(U.replace('index.html','index.html?x')+'#caixa');await A.waitForTimeout(700);
    r=await A.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view,h:location.hash,main:document.body.innerText.slice(0,80)}));
    ok(!r.u&&r.v==='quiosque',`${tag}: ?x#caixa na aba do Checkout: `+J(r));await A.screenshot({path:`${P}/t79-${tag}-x-caixa.png`});
    // Esc → login
    await A.keyboard.press('Escape');await A.waitForTimeout(400);r=await A.evaluate(()=>({u:!!ETERNA.state.user,v:ETERNA.state.view}));notas.push(`${tag} Esc após reload: `+J(r));
    await ctx.close();}

  // ---- tela final do dinheiro em 390: pt e de; aba nova aberta direto em /#loja
  for(const lg of ['pt','de','en','es','fr']){const ctx=await b.newContext({viewport:{width:390,height:844}});const A=vigia(await ctx.newPage(),'390'+lg);
    await A.goto(U+'#loja');await A.waitForTimeout(900);
    const cards=await A.evaluate(()=>ETERNA.demoSessions().map(s=>s.card).filter(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ph').length>=8));
    await A.evaluate(lg=>{ETERNA.state.lang=lg;},lg);
    await A.evaluate(lg=>{const b=document.querySelector(`[data-act="lang"][data-l="${lg}"],[data-lang="${lg}"]`);if(b)b.click();},lg);
    await sessao(A,cards[1],8,0);await A.evaluate(lg=>{ETERNA.state.lang=lg;ETERNA.render();},lg);await A.waitForTimeout(150);await A.screenshot({path:`${P}/t79-390-carrinho-${lg}.png`,fullPage:true});await ruim(A,`390 ${lg} carrinho`);await semRolagem(A,`390 ${lg} carrinho`);
    await A.click('[data-act="loja-paym"][data-m="cash"]');await A.waitForTimeout(150);await A.click('[data-act="loja-checkout"]');await A.waitForTimeout(700);
    await A.screenshot({path:`${P}/t79-390-dinheiro-final-${lg}.png`});
    const g=await A.evaluate(()=>{const c=document.querySelector('.lj-qrcode');const bt=[...document.querySelectorAll('[data-act="loja-new"]')].pop();const r=bt&&bt.getBoundingClientRect();
      return {lang:ETERNA.state.lang,t:document.body.innerText.replace(/\s+/g,' ').slice(0,260),btnIn:r?r.bottom<=innerHeight&&r.top>=0:null,btn:bt&&bt.innerText,sw:document.documentElement.scrollWidth<=innerWidth+1,sh:document.documentElement.scrollHeight,codeH:c?c.getBoundingClientRect().height:null,code:c&&c.innerText};});
    notas.push(`390 ${lg}: `+J(g));ok(g.sw,`390 ${lg}: rolagem horizontal na tela final`);ok(g.btnIn!==false,`390 ${lg}: botão final fora da tela`);
    ok(!/\bljCash|payBtnCash|cashNote|gq_/.test(g.t),`390 ${lg}: chave crua`);await ruim(A,`390 ${lg} final`);
    await ctx.close();}

  // ---- Upload: interruptor do ajuste automático para o Fotógrafo
  {const ctx=await b.newContext({viewport:{width:1440,height:900}});const F=vigia(await ctx.newPage(),'carlos');await F.goto(U);await F.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await F.reload();await F.waitForTimeout(500);
    ok(await codigo(F,'carlos@eterna.photo'),'Carlos não entrou');await F.waitForTimeout(400);
    const v=await F.evaluate(()=>ETERNA.state.view);if(v!=='importar'){await F.evaluate(()=>{ETERNA.state.view='importar';ETERNA.render();});await F.waitForTimeout(300);}
    notas.push('Carlos começa em '+v);
    const p=await F.evaluate(()=>{const e=document.querySelector('#aj-auto');const all=[...document.querySelectorAll('#main .panel')];return e?{t:e.innerText.replace(/\s+/g,' '),pos:all.indexOf(e),btn:e.querySelector('[data-act="aj-autotoggle"]').innerText,dis:e.querySelector('[data-act="aj-autotoggle"]').disabled}:null;});
    ok(p&&/Ajuste automático da IA/i.test(p.t)&&p.btn==='Ligado'&&!p.dis,'Upload: painel do ajuste para o Fotógrafo: '+J(p));notas.push('painel ajuste: '+J(p));
    await F.screenshot({path:`${P}/t79-1440-upload-ajuste.png`});
    await F.click('[data-act="aj-autotoggle"]');await F.waitForTimeout(300);
    const p2=await F.evaluate(()=>({aj:ETERNA.SIM.autoAj,t:document.querySelector('#aj-auto').innerText.replace(/\s+/g,' ')}));
    ok(p2.aj===false&&/Desligado por Carlos às \d\d:\d\d/.test(p2.t),'Upload: desligar: '+J(p2));
    await F.screenshot({path:`${P}/t79-1440-upload-ajuste-off.png`});await ruim(F,'Upload carlos');
    // cliques repetidos
    for(let k=0;k<4;k++){await F.click('[data-act="aj-autotoggle"]');await F.waitForTimeout(60);}
    ok(await F.evaluate(()=>ETERNA.SIM.autoAj)===false,'Upload: 4 cliques seguidos deveriam voltar ao mesmo estado');
    ok(!(await F.evaluate(()=>[...document.querySelectorAll('nav [data-v="ajustes"],.nav [data-v="ajustes"]')].length)),'Fotógrafo vê Ajuste automático no menu');
    await F.setViewportSize({width:390,height:844});await F.waitForTimeout(300);await F.screenshot({path:`${P}/t79-390-upload-ajuste.png`});await semRolagem(F,'Upload 390');await ruim(F,'Upload 390');
    await ctx.close();}
}catch(e){fails.push('exceção: '+(e.stack||e).toString().split('\n').filter(l=>/testador|Timeout/.test(l)).join(' / ').slice(0,600));}
await b.close();
console.log(notas.join('\n'));
const ok2=!fails.length&&!errs.length;console.log(`${ok2?'OK':'FALHA'} v79-testador${fails.length?' · '+fails.join(' | '):''}${errs.length?' · erros: '+errs.slice(0,6).join(' | '):''}`);process.exit(ok2?0:1);})();
