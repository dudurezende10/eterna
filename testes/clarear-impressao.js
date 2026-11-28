// 27/11 (Eduardo): o vendedor clareia a foto para imprimir (Exposição, Sombras e Altas luzes, numa janela do Posto) e o ajuste da
// foto chega ao arquivo da impressão (impJpegs). Confere: o botão aparece na miniatura da impressão para quem vende, a janela tem só os
// três controles, mexer grava sim/edits da foto à mão sem tocar nos outros campos, "Voltar ao original" zera só os três, Esc fecha,
// fica registrado na auditoria, e o JPEG da impressão sai mais claro com o ajuste do que sem ele.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
(async()=>{const U=process.env.U||'http://127.0.0.1:8823/index.html';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900},locale:'pt-BR'});const falhas=[];const ok=(c,m)=>{if(!c)falhas.push(m);return !!c;};const J=JSON.stringify;
  const erros=[];p.on('pageerror',e=>erros.push(String(e)));
  await p.goto(U);await p.waitForTimeout(600);const email=await entrarTeste.adminFicticio(p);ok(await entrarTeste(p,email),'entrou');
  await p.evaluate(()=>{ETERNA.state.view='ajustes';ETERNA.state.ajustes.card=null;ETERNA.state.ajustes.photo=null;ETERNA.render();});await p.waitForTimeout(200);
  await p.click('[data-act="aj-sess"]');await p.waitForTimeout(200);await p.click('[data-act="aj-open"]');await p.waitForTimeout(250);
  const id=await p.evaluate(()=>ETERNA.state.ajustes.photo);ok(!!id,'achou uma foto');
  await p.evaluate(id=>{const T=ETERNA.ajT;const e=T.editOf(id);e.c=120;e.z=130;e.b=100;e.h=0;e.r=0;},id);
  // 1. o botão aparece na miniatura de foto da impressão para quem vende, e não para foto com fundo de IA
  const th=await p.evaluate(id=>{const T=ETERNA.ajT;return {ph:T.impThumb({t:'ph',id,k:id},false,'imp-pick','LPX'),ia:T.impThumb({t:'ai',id,bg:'telao',k:'ai:'+id},false,'imp-pick','LPX'),pode:T.paPode(id)};},id);
  ok(th.pode&&/data-act="pa-abrir"/.test(th.ph)&&/imp-thw/.test(th.ph)&&!/pa-abrir/.test(th.ia),'botão Clarear na miniatura de foto, não na de IA: '+J(th).slice(0,200));
  // 2. a janela tem só Exposição, Sombras e Altas luzes
  await p.evaluate(id=>ETERNA.ajT.paAbrir(id),id);await p.waitForTimeout(150);
  let r=await p.evaluate(()=>{const m=document.getElementById('pa-modal');return {ks:[...m.querySelectorAll('input[data-pak]')].map(i=>i.dataset.pak),rot:[...m.querySelectorAll('.eyebrow')].map(x=>x.textContent),foco:document.activeElement&&document.activeElement.dataset.pak};});
  ok(J(r.ks)===J(['b','h','r'])&&J(r.rot)===J(['Exposição','Sombras','Altas luzes'])&&r.foco==='b','três controles: '+J(r));
  // 3. mexer grava à mão sem tocar nos outros campos
  await p.click('#pa-modal [data-pas="b"][data-dv="5"]');await p.click('#pa-modal [data-pas="b"][data-dv="5"]');await p.click('#pa-modal [data-pas="h"][data-dv="10"]');
  await p.evaluate(()=>{const el=document.querySelector('#pa-modal input[data-pak="r"]');el.value='30';el.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(100);
  r=await p.evaluate(id=>{const e=ETERNA.ajT.SIM.edits[id];return {e:{...e},pv:document.getElementById('pa-pv').getAttribute('style'),lab:document.querySelector('#pa-modal [data-pav="b"]').textContent};},id);
  ok(r.e.b===110&&r.e.h===10&&r.e.r===30&&r.e.c===120&&r.e.z===130&&r.e.auto===false,'grava b, h, r à mão e mantém contraste e corte: '+J(r.e));ok(/url\(#sh10\)/.test(r.pv)&&/url\(#hl30\)/.test(r.pv)&&r.lab==='110%','prévia e valor: '+r.pv.slice(0,120));
  // 4. limites
  for(let i=0;i<20;i++)await p.click('#pa-modal [data-pas="b"][data-dv="5"]');r=await p.evaluate(id=>ETERNA.ajT.SIM.edits[id].b,id);ok(r===180,'exposição não passa de 180: '+r);
  // 5. a impressão sai com o ajuste: o JPEG com ajuste é mais claro que sem
  const luz=await p.evaluate(async id=>{const T=ETERNA.ajT;const med=async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=60;c.height=40;const x=c.getContext('2d');x.drawImage(im,0,0,60,40);const d=x.getImageData(0,0,60,40).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4)/3;};
    const um=async ed=>{await T.printMontar([{k:id,id,t:'ph'}],ed);const root=document.getElementById('print-root');const im=root&&root.querySelector('img');if(im&&!im.complete)await new Promise(r=>{im.onload=im.onerror=r;});const j=T.impJpegs();const v=j.length?await med(j[0]):null;if(root)root.remove();return v;};
    const com=await um({[id]:{...T.SIM.edits[id]}});const sem=await um({});return {com,sem};},id);
  ok(luz.com!=null&&luz.sem!=null&&luz.com>luz.sem+8,'o JPEG da impressão sai mais claro com o ajuste: '+J(luz));
  // 6. voltar ao original zera só os três; Esc fecha e registra na auditoria
  await p.click('#pa-modal [data-pa="zerar"]');r=await p.evaluate(id=>({...ETERNA.ajT.SIM.edits[id]}),id);ok(r.b===100&&r.h===0&&r.r===0&&r.c===120&&r.z===130,'voltar ao original zera só os três: '+J(r));
  await p.click('#pa-modal [data-pas="b"][data-dv="5"]');await p.keyboard.press('Escape');await p.waitForTimeout(150);
  r=await p.evaluate(()=>({aberto:!!document.getElementById('pa-modal'),log:(ETERNA.auditRead()||[]).find(x=>x.acao==='ajuste_impressao')}));ok(!r.aberto&&r.log&&r.log.mudancas[0].para==='105/0/0','Esc fecha e registra: '+J(r).slice(0,220));
  // 7. sem permissão de venda em Alterar não aparece
  r=await p.evaluate(id=>{const T=ETERNA.ajT;const st=ETERNA.state;st.assumido=true;const v=T.paPode(id);st.assumido=null;return v;},id);ok(r===false,'em "ver como" não aparece');
  await p.setViewportSize({width:390,height:844});await p.evaluate(id=>ETERNA.ajT.paAbrir(id),id);await p.waitForTimeout(150);
  r=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,mh:Math.min(...[...document.querySelectorAll('#pa-modal .ajrow .btn')].map(x=>x.getBoundingClientRect().height))}));ok(r.sw<=390&&r.mh>=44,'cabe em 390 px com botões de 44 px: '+J(r));
  ok(!erros.length,'sem erro na página: '+erros.join(' | '));
  await b.close();if(falhas.length){console.log('FALHA clarear-impressao: '+falhas.join(' | '));process.exit(1);}console.log('OK clarear-impressao: botão na miniatura, três controles, grava à mão sem mexer no resto, limites, JPEG da impressão com o ajuste, voltar ao original, Esc e auditoria, permissão, 390 px');})();
