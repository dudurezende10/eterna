// Realces no ajuste à mão (26/11, Eduardo): controle que escurece só as partes claras da foto, sem mexer nas médias e escuras.
// Confere: o controle aparece logo depois de Sombras, mexer grava r e marca "à mão", o filtro leva url(#hlNN) depois das sombras e
// antes da temperatura e do brightness, Restaurar original zera, ajuste antigo sem r vale 0 (mesma string de antes), o automático não
// usa Realces, o nome nas 5 línguas, a impressão e o pedido guardado levam o mesmo filtro, cabe no celular de 390 px, e a curva num
// canvas com a mesma string do filtro (claro desce, escuro e médio não mudam, branco puro fica branco).
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
(async()=>{const U=process.env.U||'http://127.0.0.1:8823/index.html';const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});const falhas=[];const ok=(c,m)=>{if(!c)falhas.push(m);return !!c;};const J=JSON.stringify;
  await p.goto(U);await p.waitForTimeout(600);const email=await entrarTeste.adminFicticio(p);ok(await entrarTeste(p,email),'entrou');
  await p.evaluate(()=>{ETERNA.state.view='ajustes';ETERNA.state.ajustes.card=null;ETERNA.state.ajustes.photo=null;ETERNA.render();});await p.waitForTimeout(200);
  await p.click('[data-act="aj-sess"]');await p.waitForTimeout(200);await p.click('[data-act="aj-open"]');await p.waitForTimeout(250);
  const id=await p.evaluate(()=>ETERNA.state.ajustes.photo);ok(!!id,'abriu a foto no editor');
  // 1. o controle aparece logo depois de Sombras, de 0 a 100 em passos de 10, começando em 0
  const ctl=await p.evaluate(()=>{const ks=[...document.querySelectorAll('[data-act="aj-range"]')].map(r=>r.dataset.k);const r=document.querySelector('[data-act="aj-range"][data-k="r"]');
    return {ks,min:r&&r.min,max:r&&r.max,step:r&&r.step,val:r&&r.value,rot:r&&r.getAttribute('aria-label'),lab:(document.querySelector('[data-ajv="r"]')||{}).textContent};});
  ok(ctl.ks.join('')==='bhrcstz','ordem dos controles: '+J(ctl.ks));ok(ctl.min==='0'&&ctl.max==='100'&&ctl.step==='10'&&ctl.val==='0','faixa do controle: '+J(ctl));ok(ctl.rot==='Realces'&&ctl.lab==='0%','rótulo e valor: '+J(ctl));
  // 2. mexer grava r, marca "à mão" e o filtro leva url(#hlNN) antes do brightness
  await p.click('[data-act="aj-step"][data-k="r"][data-dv="10"]');await p.click('[data-act="aj-step"][data-k="r"][data-dv="10"]');await p.waitForTimeout(100);
  let r=await p.evaluate(id=>{const T=ETERNA.ajT;const e=T.SIM.edits[id];const pv=document.getElementById('aj-pv');return {e:{...e},tag:T.ajTag(id),ed:T.isEdited(id),st:pv.getAttribute('style'),comp:getComputedStyle(pv,'::before').filter,lab:document.querySelector('[data-ajv="r"]').textContent,guardado:(JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}').edits||{})[id]};},id);
  ok(r.e.r===20&&r.e.auto===false&&r.e.b===100&&r.e.h===0,'o botão + grava r=20 à mão: '+J(r.e));ok(r.tag==='à mão'&&r.ed===true,'a foto fica marcada à mão: '+r.tag);ok(r.lab==='20%','o valor na tela: '+r.lab);
  ok(/--flt:\s*url\(#hl20\) brightness\(1\)/.test(r.st),'o filtro da prévia leva url(#hl20) antes do brightness: '+r.st);ok(/url\("?#hl20"?\)/.test(r.comp),'o filtro chega ao desenho da prévia: '+r.comp);
  ok(r.guardado&&r.guardado.r===20,'r fica salvo: '+J(r.guardado));
  await p.evaluate(()=>{const el=document.querySelector('[data-act="aj-range"][data-k="r"]');el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(100);
  r=await p.evaluate(id=>({r:ETERNA.ajT.SIM.edits[id].r,st:document.getElementById('aj-pv').getAttribute('style')}),id);ok(r.r===70&&/url\(#hl70\) /.test(r.st),'a barra grava r=70: '+J(r));
  for(let i=0;i<5;i++)await p.click('[data-act="aj-step"][data-k="r"][data-dv="10"]');r=await p.evaluate(id=>ETERNA.ajT.SIM.edits[id].r,id);ok(r===100,'não passa de 100: '+r);
  for(let i=0;i<12;i++)await p.click('[data-act="aj-step"][data-k="r"][data-dv="-10"]');r=await p.evaluate(id=>({r:ETERNA.ajT.SIM.edits[id].r,ed:ETERNA.ajT.isEdited(id),st:document.getElementById('aj-pv').getAttribute('style')}),id);ok(r.r===0&&r.ed===false&&!/#hl/.test(r.st),'não desce de 0 e em 0 não há filtro de realces: '+J(r));
  // 3. Restaurar original zera
  await p.click('[data-act="aj-step"][data-k="r"][data-dv="10"]');await p.click('[data-act="aj-reset"]');await p.waitForTimeout(150);
  r=await p.evaluate(id=>({r:ETERNA.ajT.editOf(id).r,ed:ETERNA.ajT.isEdited(id),val:document.querySelector('[data-act="aj-range"][data-k="r"]').value}),id);ok(r.r===0&&r.ed===false&&r.val==='0','Restaurar original zera os realces: '+J(r));
  // 4. ajuste antigo sem r, ordem dos filtros, isEdited, o automático não usa Realces, os filtros hl10 a hl100
  r=await p.evaluate(async()=>{const T=ETERNA.ajT;const o={};o.antigo=T.editStyleObj({b:120,h:40,c:110,s:100,t:10,z:100});o.zero=T.editStyleObj({b:120,h:40,r:0,c:110,s:100,t:10,z:100});o.tudo=T.editStyleObj({b:120,h:40,r:60,c:110,s:100,t:10,z:100});o.meio=T.editStyleObj({b:100,r:44,c:100});o.fora=[T.editStyleObj({r:900}),T.editStyleObj({r:-30}),T.editStyleObj({r:'x'})];
    T.SIM.edits=T.SIM.edits||{};T.SIM.edits.tst_a={b:100,h:0,c:100,s:100,t:0,z:100,x:0,y:0};o.edA=T.isEdited('tst_a');T.SIM.edits.tst_b={b:100,h:0,r:30,c:100,s:100,t:0,z:100,x:0,y:0};o.edB=T.isEdited('tst_b');delete T.SIM.edits.tst_a;delete T.SIM.edits.tst_b;
    const c=document.createElement('canvas');c.width=320;c.height=200;const x=c.getContext('2d');x.fillStyle='rgb(70,50,40)';x.fillRect(0,0,320,200);T.state.lib=T.state.lib.filter(f=>f.id!=='realce');T.state.lib.push({id:'realce',pt:'-',t:0});T.UP.ag_realce={src:c.toDataURL('image/jpeg',.9),name:'realce.jpg'};delete T.SIM.edits.ag_realce;
    o.auto={...(await T.ajAuto('ag_realce'))};T.SIM.edits.ag_realce.r=60;o.auto2={...(await T.ajAuto('ag_realce',true))};
    // 5. o pedido guardado e a impressão levam o mesmo filtro da prévia
    o.pv=T.pvDados({selected:['ag_realce'],card:'X'}).ed.ag_realce;const url0=T.state.agent.url;T.state.agent.url='';
    try{o.imp=await T.printMontar([{id:'ag_realce',k:'f1',t:'ph'}]);const im=document.querySelector('#print-root img');o.impSt=im&&im.getAttribute('style');o.previa=T.editStyleObj(T.SIM.edits.ag_realce).replace(/^;/,'');}finally{T.state.agent.url=url0;const pr=document.getElementById('print-root');if(pr)pr.remove();}
    delete T.SIM.edits.ag_realce;delete T.UP.ag_realce;T.state.lib=T.state.lib.filter(f=>f.id!=='realce');
    o.filtros=[10,20,30,40,50,60,70,80,90,100].map(h=>{const f=document.getElementById('hl'+h);return f&&f.getAttribute('color-interpolation-filters')==='sRGB'?[...f.querySelectorAll('feFuncR,feFuncG,feFuncB')].map(n=>n.getAttribute('type')+':'+n.getAttribute('tableValues')):null;});return o;});
  ok(!/#hl/.test(r.antigo)&&r.antigo===r.zero&&/--flt:url\(#sh40\) url\(#wbp10\) brightness\(1\.2\) contrast\(1\.1\)/.test(r.antigo),'ajuste antigo sem r sai igual a antes: '+r.antigo);
  ok(/--flt:url\(#sh40\) url\(#hl60\) url\(#wbp10\) brightness\(1\.2\) contrast\(1\.1\)/.test(r.tudo),'realces depois das sombras e antes da temperatura e do brightness: '+r.tudo);ok(/url\(#hl40\) /.test(r.meio),'valor quebrado cai no passo de 10: '+r.meio);
  ok(/url\(#hl100\) /.test(r.fora[0])&&!/#hl/.test(r.fora[1])&&!/#hl/.test(r.fora[2]),'valor fora da faixa fica entre 0 e 100: '+J(r.fora));
  ok(r.edA===false&&r.edB===true,'isEdited conta r: '+r.edA+' '+r.edB);ok(r.auto.b>100&&r.auto.r===0&&r.auto.auto===true,'o automático não usa Realces: '+J(r.auto));ok(r.auto2.r===60,'o automático deixa r como está: '+J(r.auto2));
  ok(r.pv&&r.pv.r===60,'o pedido guardado leva r: '+J(r.pv));ok(r.imp&&r.imp.ok.length===1&&r.impSt===r.previa&&/url\(#hl60\)/.test(r.impSt||''),'a impressão leva a mesma string da prévia: '+J([r.imp,r.impSt,r.previa]));
  r.filtros.forEach((f,i)=>{const h=(i+1)*10;if(!ok(f&&f.length===3&&f[0]===f[1]&&f[1]===f[2]&&/^table:/.test(f[0]),'filtro hl'+h+' com a mesma tabela nos três canais'))return;const v=f[0].slice(6).split(' ').map(Number);
    ok(v.length>=17&&v[0]===0&&v[v.length-1]===1,'hl'+h+': 17 pontos ou mais, 0 fica 0 e 1 fica 1');ok(v.every((y,k)=>!k||y>v[k-1]),'hl'+h+': curva sempre crescente');ok(v.every((y,k)=>{const x=k/(v.length-1);return x>.4?y<=x:Math.abs(y-x)<1e-4;}),'hl'+h+': até 40% devolve o original e acima nunca clareia');
    ok(v.every((y,k)=>!k||(y-v[k-1])*(v.length-1)>=.45),'hl'+h+': nenhum trecho chapado (inclinação de 0,45 ou mais)');});
  // 6. pixel: a mesma string do filtro num canvas
  const px=await p.evaluate(()=>{const T=ETERNA.ajT;const G=[0,40,102,204,230,255];const src=document.createElement('canvas');src.width=70;src.height=10;const sx=src.getContext('2d');G.forEach((g,i)=>{sx.fillStyle=`rgb(${g},${g},${g})`;sx.fillRect(i*10,0,10,10);});sx.fillStyle='rgb(240,200,170)';sx.fillRect(60,0,10,10);
    const mede=e=>{const flt=(/--flt:([^;]*)/.exec(T.editStyleObj(e))||[])[1];const c=document.createElement('canvas');c.width=70;c.height=10;const x=c.getContext('2d',{willReadFrequently:true});x.filter=flt;const aceito=x.filter;x.drawImage(src,0,0);return {flt,aceito,v:[0,1,2,3,4,5,6].map(i=>[...x.getImageData(i*10+5,5,1,1).data].slice(0,3))};};
    return {r0:mede({b:100,r:0,c:100,s:100,t:0}),sem:mede({b:100,c:100,s:100,t:0}),r50:mede({b:100,r:50,c:100,s:100,t:0}),r100:mede({b:100,r:100,c:100,s:100,t:0})};});
  const g=m=>m.v.slice(0,6).map(c=>c[0]);const cinza=m=>m.v.slice(0,6).every(c=>Math.abs(c[0]-c[1])<=1&&Math.abs(c[1]-c[2])<=1);
  ok(/url\(#hl100\)/.test(px.r100.flt)&&/#hl100/.test(px.r100.aceito),'o canvas aceita o filtro com url(): '+J(px.r100));
  ok(g(px.r0).join()==='0,40,102,204,230,255'&&J(px.r0.v)===J(px.sem.v)&&px.r0.flt===px.sem.flt,'realces em 0 não muda nada (igual a não ter o campo): '+J(px.r0.v));
  [px.r50,px.r100].forEach((m,i)=>{const n=i?100:50;ok(g(m)[0]===0&&Math.abs(g(m)[1]-40)<=1&&Math.abs(g(m)[2]-102)<=1,'em '+n+' o preto, o escuro (40) e o médio (102) não mudam: '+J(g(m)));ok(g(m)[5]===255,'em '+n+' o branco puro continua branco: '+g(m)[5]);ok(g(m)[3]<g(m)[4]&&g(m)[4]<g(m)[5],'em '+n+' os claros seguem em ordem: '+J(g(m)));});
  ok(Math.abs(g(px.r100)[3]-170)<=3,'80% vai a perto de 67% em 100: '+g(px.r100)[3]);ok(Math.abs(g(px.r50)[3]-187)<=3,'80% vai a perto de 73% em 50: '+g(px.r50)[3]);
  ok(Math.abs(g(px.r100)[4]-204)<=3,'90% vai a perto de 80% em 100: '+g(px.r100)[4]);ok(g(px.r50)[4]<230&&g(px.r50)[4]>g(px.r100)[4],'90% desce menos em 50: '+g(px.r50)[4]);
  ok(cinza(px.r50)&&cinza(px.r100),'cinza continua cinza (mesma curva nos três canais)');const pele=px.r100.v[6];ok(pele[0]>pele[1]&&pele[1]>pele[2]&&pele[0]<240&&pele[2]>=100,'pele clara escurece e segue com cor de pele: '+J(pele));
  // 7. nome nas línguas
  const nomes=await p.evaluate(()=>{const S=ETERNA.ajT.state;const u0=S.user.idioma,l0=S.langEq;const o={};for(const l of ['pt','en','es','fr']){S.user.idioma=l;S.langEq=l;ETERNA.render();o[l]=[...document.querySelectorAll('.ajrow .eyebrow')].map(e=>e.textContent)[2];}S.user.idioma=u0;S.langEq=l0;ETERNA.render();return o;});
  ok(J(nomes)===J({pt:'Realces',en:'Highlights',es:'Altas luces',fr:'Hautes lumières'}),'nome nas línguas da equipe: '+J(nomes));
  // o alemão não é idioma de tela da equipe hoje; o texto fica na tabela, como o de Sombras
  ok(require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').includes('aj_realces:["Realces","Highlights","Altas luces","Hautes lumières","Lichter"]'),'texto nas 5 línguas na tabela');
  // 8. celular de 390 px: o controle cabe, sem rolagem lateral, com botões de 44 px
  await p.setViewportSize({width:390,height:844});await p.evaluate(()=>ETERNA.render());await p.waitForTimeout(250);
  const cel=await p.evaluate(()=>{const row=document.querySelector('[data-act="aj-range"][data-k="r"]').closest('.ajrow');const bts=[...row.querySelectorAll('.btn')].map(b=>b.getBoundingClientRect());const rg=row.querySelector('input').getBoundingClientRect();const rr=row.getBoundingClientRect();
    return {sw:document.documentElement.scrollWidth,iw:innerWidth,bts:bts.map(b=>[Math.round(b.width),Math.round(b.height)]),rg:Math.round(rg.width),esq:Math.round(rr.left),dir:Math.round(rr.right),linhas:document.querySelectorAll('.ajrow').length};});
  ok(cel.sw<=cel.iw,'390 px sem rolagem lateral: '+J(cel));ok(cel.bts.length===2&&cel.bts.every(b=>b[0]>=44&&b[1]>=44),'botões de 44 px no celular: '+J(cel.bts));ok(cel.rg>=140&&cel.esq>=0&&cel.dir<=390&&cel.linhas===7,'a barra cabe na tela com os 7 controles: '+J(cel));
  await b.close();if(falhas.length){console.log('FALHA ajuste-realces: '+falhas.join(' | '));process.exit(1);}console.log('OK ajuste-realces: controle depois de Sombras, grava r à mão, filtro url(#hlNN) antes do brightness, restaurar zera, automático não usa, impressão e pedido com o mesmo filtro, 390 px, curva conferida no canvas');})().catch(e=>{console.log('FALHA ajuste-realces: '+e.message);process.exit(1);});
