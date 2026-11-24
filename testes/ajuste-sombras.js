// Sombras no Ajuste automático (24/11, Eduardo): controle que clareia só as partes escuras da foto, sem mexer nas claras.
// Confere: o controle aparece entre Exposição e Contraste, mexer grava h e marca "à mão", o filtro leva url(#shNN) antes do
// brightness, Restaurar original zera, ajuste antigo sem h vale 0, o automático não usa Sombras, e a curva num canvas com a mesma
// string do filtro (cinza escuro sobe, claro não muda, preto fica preto).
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
(async()=>{const U=process.env.U||'http://127.0.0.1:8823/index.html';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const falhas=[];const ok=(c,m)=>{if(!c)falhas.push(m);return !!c;};const J=JSON.stringify;
  await p.goto(U);await p.waitForTimeout(600);const email=await entrarTeste.adminFicticio(p);ok(await entrarTeste(p,email),'entrou');
  await p.evaluate(()=>{ETERNA.state.view='ajustes';ETERNA.state.ajustes.card=null;ETERNA.state.ajustes.photo=null;ETERNA.render();});await p.waitForTimeout(200);
  await p.click('[data-act="aj-sess"]');await p.waitForTimeout(200);await p.click('[data-act="aj-open"]');await p.waitForTimeout(250);
  const id=await p.evaluate(()=>ETERNA.state.ajustes.photo);ok(!!id,'abriu a foto no editor');
  // 1. o controle aparece, entre Exposição e Contraste, de 0 a 100 em passos de 10, começando em 0
  const ctl=await p.evaluate(()=>{const ks=[...document.querySelectorAll('[data-act="aj-range"]')].map(r=>r.dataset.k);const r=document.querySelector('[data-act="aj-range"][data-k="h"]');
    return {ks,min:r&&r.min,max:r&&r.max,step:r&&r.step,val:r&&r.value,rot:r&&r.getAttribute('aria-label'),lab:(document.querySelector('[data-ajv="h"]')||{}).textContent};});
  ok(ctl.ks.join('')==='bhcstz','ordem dos controles: '+J(ctl.ks));ok(ctl.min==='0'&&ctl.max==='100'&&ctl.step==='10'&&ctl.val==='0','faixa do controle: '+J(ctl));ok(ctl.rot==='Sombras'&&ctl.lab==='0%','rótulo e valor: '+J(ctl));
  // 2. mexer grava h, marca "à mão" e o filtro leva url(#shNN) antes do brightness
  await p.click('[data-act="aj-step"][data-k="h"][data-dv="10"]');await p.click('[data-act="aj-step"][data-k="h"][data-dv="10"]');await p.waitForTimeout(100);
  let r=await p.evaluate(id=>{const T=ETERNA.ajT;const e=T.SIM.edits[id];const pv=document.getElementById('aj-pv');return {e:{...e},tag:T.ajTag(id),ed:T.isEdited(id),st:pv.getAttribute('style'),comp:getComputedStyle(pv,'::before').filter,lab:document.querySelector('[data-ajv="h"]').textContent,nota:document.getElementById('aj-st').textContent,guardado:(JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}').edits||{})[id]};},id);
  ok(r.e.h===20&&r.e.auto===false&&r.e.b===100,'o botão + grava h=20 à mão: '+J(r.e));ok(r.tag==='à mão'&&r.ed===true,'a foto fica marcada à mão: '+r.tag);ok(r.lab==='20%','o valor na tela: '+r.lab);
  ok(/--flt:\s*url\(#sh20\) brightness\(1\)/.test(r.st),'o filtro da prévia leva url(#sh20) antes do brightness: '+r.st);ok(/url\("?#sh20"?\)/.test(r.comp),'o filtro chega ao desenho da prévia: '+r.comp);
  ok(r.guardado&&r.guardado.h===20,'h fica salvo: '+J(r.guardado));
  await p.evaluate(()=>{const el=document.querySelector('[data-act="aj-range"][data-k="h"]');el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(100);
  r=await p.evaluate(id=>({h:ETERNA.ajT.SIM.edits[id].h,st:document.getElementById('aj-pv').getAttribute('style')}),id);ok(r.h===70&&/url\(#sh70\) /.test(r.st),'a barra grava h=70: '+J(r));
  for(let i=0;i<5;i++)await p.click('[data-act="aj-step"][data-k="h"][data-dv="10"]');r=await p.evaluate(id=>ETERNA.ajT.SIM.edits[id].h,id);ok(r===100,'não passa de 100: '+r);
  for(let i=0;i<12;i++)await p.click('[data-act="aj-step"][data-k="h"][data-dv="-10"]');r=await p.evaluate(id=>({h:ETERNA.ajT.SIM.edits[id].h,ed:ETERNA.ajT.isEdited(id),st:document.getElementById('aj-pv').getAttribute('style')}),id);ok(r.h===0&&r.ed===false&&!/#sh/.test(r.st),'não desce de 0 e em 0 não há filtro de sombras: '+J(r));
  // 3. Restaurar original zera
  await p.click('[data-act="aj-step"][data-k="h"][data-dv="10"]');await p.click('[data-act="aj-reset"]');await p.waitForTimeout(150);
  r=await p.evaluate(id=>({h:ETERNA.ajT.editOf(id).h,ed:ETERNA.ajT.isEdited(id),val:document.querySelector('[data-act="aj-range"][data-k="h"]').value}),id);ok(r.h===0&&r.ed===false&&r.val==='0','Restaurar original zera as sombras: '+J(r));
  // 4. ajuste antigo sem h, ordem com a temperatura, e o automático não usa Sombras
  r=await p.evaluate(async()=>{const T=ETERNA.ajT;const o={};o.antigo=T.editStyleObj({b:120,c:110,s:100,t:0,z:100});o.tudo=T.editStyleObj({b:120,h:40,c:110,s:100,t:10,z:100});o.meio=T.editStyleObj({b:100,h:44,c:100});
    T.SIM.edits=T.SIM.edits||{};T.SIM.edits.tst_a={b:100,c:100,s:100,t:0,z:100,x:0,y:0};o.edA=T.isEdited('tst_a');T.SIM.edits.tst_b={b:100,h:30,c:100,s:100,t:0,z:100,x:0,y:0};o.edB=T.isEdited('tst_b');delete T.SIM.edits.tst_a;delete T.SIM.edits.tst_b;
    const c=document.createElement('canvas');c.width=320;c.height=200;const x=c.getContext('2d');x.fillStyle='rgb(70,50,40)';x.fillRect(0,0,320,200);T.state.lib=T.state.lib.filter(f=>f.id!=='sombra');T.state.lib.push({id:'sombra',pt:'-',t:0});T.UP.ag_sombra={src:c.toDataURL('image/jpeg',.9),name:'sombra.jpg'};delete T.SIM.edits.ag_sombra;
    o.auto={...(await T.ajAuto('ag_sombra'))};T.SIM.edits.ag_sombra.h=60;o.auto2={...(await T.ajAuto('ag_sombra',true))};delete T.SIM.edits.ag_sombra;delete T.UP.ag_sombra;T.state.lib=T.state.lib.filter(f=>f.id!=='sombra');
    o.filtros=[10,20,30,40,50,60,70,80,90,100].map(h=>{const f=document.getElementById('sh'+h);return f&&f.getAttribute('color-interpolation-filters')==='sRGB'?[...f.querySelectorAll('feFuncR,feFuncG,feFuncB')].map(n=>n.getAttribute('type')+':'+n.getAttribute('tableValues')):null;});return o;});
  ok(!/#sh/.test(r.antigo)&&/--flt:brightness\(1\.2\)/.test(r.antigo),'ajuste antigo sem h não leva sombras: '+r.antigo);ok(/--flt:url\(#sh40\) url\(#wbp10\) brightness\(1\.2\) contrast\(1\.1\)/.test(r.tudo),'sombras antes da temperatura e do brightness: '+r.tudo);ok(/url\(#sh40\) /.test(r.meio),'valor quebrado cai no passo de 10: '+r.meio);
  ok(r.edA===false&&r.edB===true,'isEdited conta h: '+r.edA+' '+r.edB);ok(r.auto.b>100&&r.auto.h===0&&r.auto.auto===true,'o automático não usa Sombras: '+J(r.auto));ok(r.auto2.h===60,'o automático deixa h como está: '+J(r.auto2));
  r.filtros.forEach((f,i)=>{const h=(i+1)*10;if(!ok(f&&f.length===3&&f[0]===f[1]&&f[1]===f[2]&&/^table:/.test(f[0]),'filtro sh'+h+' com a mesma tabela nos três canais'))return;const v=f[0].slice(6).split(' ').map(Number);
    ok(v.length>=17&&v[0]===0&&v[v.length-1]===1,'sh'+h+': 17 pontos ou mais, 0 fica 0 e 1 fica 1');ok(v.every((y,k)=>!k||y>v[k-1]),'sh'+h+': curva sempre crescente');ok(v.every((y,k)=>{const x=k/(v.length-1);return x<.6?y>=x:Math.abs(y-x)<1e-4;}),'sh'+h+': acima de 60% devolve o original');});
  // 5. pixel: a mesma string do filtro num canvas
  const px=await p.evaluate(()=>{const T=ETERNA.ajT;const src=document.createElement('canvas');src.width=40;src.height=10;const sx=src.getContext('2d');[0,40,51,220].forEach((g,i)=>{sx.fillStyle=`rgb(${g},${g},${g})`;sx.fillRect(i*10,0,10,10);});
    const mede=e=>{const flt=(/--flt:([^;]*)/.exec(T.editStyleObj(e))||[])[1];const c=document.createElement('canvas');c.width=40;c.height=10;const x=c.getContext('2d',{willReadFrequently:true});x.filter=flt;const aceito=x.filter;x.drawImage(src,0,0);return {flt,aceito,v:[0,1,2,3].map(i=>[...x.getImageData(i*10+5,5,1,1).data].slice(0,3))};};
    return {h0:mede({b:100,c:100,s:100,t:0}),h50:mede({b:100,h:50,c:100,s:100,t:0}),h100:mede({b:100,h:100,c:100,s:100,t:0})};});
  const g=m=>m.v.map(c=>c[0]);const cinza=m=>m.v.every(c=>Math.abs(c[0]-c[1])<=1&&Math.abs(c[1]-c[2])<=1);
  ok(/url\(#sh100\)/.test(px.h100.flt)&&/#sh100/.test(px.h100.aceito),'o canvas aceita o filtro com url(): '+J(px.h100));
  ok(g(px.h0).join()==='0,40,51,220','sem sombras o canvas não muda: '+J(px.h0.v));
  ok(g(px.h100)[0]===0&&g(px.h50)[0]===0,'preto continua preto: '+J([px.h50.v[0],px.h100.v[0]]));
  ok(g(px.h100)[1]>=75&&g(px.h100)[1]<=100,'cinza 40 sobe em 100: '+g(px.h100)[1]);ok(g(px.h50)[1]>=55&&g(px.h50)[1]<g(px.h100)[1],'cinza 40 sobe menos em 50: '+g(px.h50)[1]);
  ok(Math.abs(g(px.h100)[2]-99)<=3,'20% vai a perto de 39% em 100: '+g(px.h100)[2]);ok(Math.abs(g(px.h50)[2]-75)<=3,'20% vai a perto de 29,5% em 50: '+g(px.h50)[2]);
  ok(Math.abs(g(px.h100)[3]-220)<=2&&Math.abs(g(px.h50)[3]-220)<=2,'claro 220 muda no máximo 2 níveis: '+g(px.h50)[3]+' '+g(px.h100)[3]);ok(cinza(px.h50)&&cinza(px.h100),'cinza continua cinza (mesma curva nos três canais)');
  await b.close();if(falhas.length){console.log('FALHA ajuste-sombras: '+falhas.join(' | '));process.exit(1);}console.log('OK ajuste-sombras: controle entre Exposição e Contraste, grava h à mão, filtro url(#shNN) antes do brightness, restaurar zera, automático não usa, curva conferida no canvas');})().catch(e=>{console.log('FALHA ajuste-sombras: '+e.message);process.exit(1);});
