const statusSemMontagem=require('./_status_agente.js');
// Saída do túnel v2 (Eduardo, 16/11 18:57; regra 22; docs/planos/2026-11-16-tunel-v2.md): imagem nova no mesmo id `tunel`,
// 4º fundo ativo (Mirante do Rio, Maracanã 1950, Telão, Saída do túnel). Posição: centro, encostado embaixo, NADA do recorte
// acima de 23,4% da altura (a faixa "Born to Score"), nem braço erguido; até 92% da largura; casal e pessoa sozinha (estreito)
// cortados no quadril (74%); grupo largo inteiro; corpo inteiro do joelho para cima. Impressão 10×15 com a faixa inteira.
// Lista salva: a trinca de antes (sim/bgOn2) vale com o túnel até alguém mexer na lista (marca bgTunelV2); lista personalizada
// não muda. Venda antiga com |tunel continua montando e imprimindo. Recortes sintéticos (nunca foto de cliente).
const {chromium}=require('playwright');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const QUATRO=['mirantedia','arq1950','telao','tunel'],TRINCA=['mirantedia','arq1950','telao'];
const LIM=.234;   // regra 22: topo do recorte em 23,4% do alto ou abaixo
(async()=>{const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(60000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);

  // ---------- 1. navegador limpo: os 4, nesta ordem ----------
  const c1=await pg.evaluate(()=>({on:ETERNA.bgOn(),ai:ETERNA.aiBgs().map(x=>x.id),opts:ETERNA.bgOpts().map(o=>o.id),sim2:ETERNA.SIM.bgOn2,marca:ETERNA.SIM.bgTunelV2}));
  ok(J(c1.on)===J(QUATRO)&&J(c1.ai.slice().sort())===J(QUATRO.slice().sort())&&J(c1.opts.slice().sort())===J(QUATRO.slice().sort())&&c1.sim2==null&&c1.marca==null,'1: navegador limpo com os 4 fundos na ordem do Checkout: '+J(c1));

  // ---------- 2. catálogo, nomes, regra e base ----------
  const c2=await pg.evaluate(()=>{const t=ETERNA.bgOf('tunel');const o={};['pt','en','es','fr','de'].forEach(l=>{ETERNA.state.lang=l;o[l]=ETERNA.bgNomeCli(t);});ETERNA.state.lang='pt';
    return {t:{file:t.file,hi:t.fileHi,inativo:t.inativo,impAlto:t.impAlto,luz:t.luz,dir:t.dir,pos:t.pos,nome:t.nome,ativo:ETERNA.bgAtivo(t)},nomes:o,regra:ETERNA.FIA_REGRAS.tunel,base:ETERNA.FIA_BASE.tunel};});
  ok(c2.t.file==='img/bg-tunel-v2.jpg'&&c2.t.hi==='img/fundos-5k/tunel-v2.jpg'&&!c2.t.inativo&&c2.t.ativo&&c2.t.impAlto===true&&c2.t.luz==='fim'&&c2.t.dir==='esquerda'&&c2.t.nome==='bgTunel'&&c2.t.pos.cx===.5&&c2.t.pos.top===LIM&&c2.t.pos.base===1,'2: túnel v2 no catálogo, ativo, com os arquivos novos: '+J(c2.t));
  ok(J(c2.nomes)===J({pt:'Saída do túnel',en:'Out of the tunnel',es:'Salida del túnel',fr:'Sortie du tunnel',de:'Aus dem Spielertunnel'}),'2: nome nas 5 línguas: '+J(c2.nomes));
  ok(J(c2.regra)===J({meio:{corte:1,alt:.766,larg:.92,cx:.5},inteiro:{corte:.62,alt:.766,larg:.92,cx:.5},estreito:{corte:.74,alt:.766,larg:.92,cx:.5}}),'2: FIA_REGRAS.tunel (regra 22): '+J(c2.regra));
  ok(c2.base===0,'2: túnel com a 1ª base, como o 1950: '+c2.base);
  const tam=await pg.evaluate(async()=>{const r={};for(const f of ['img/bg-tunel-v2.jpg','img/fundos-5k/tunel-v2.jpg','img/bg-tunel.jpg','img/fundos-5k/tunel.jpg']){const im=new Image();im.src=f;await im.decode().catch(()=>{});r[f]=[im.naturalWidth,im.naturalHeight];}return r;});
  ok(J(tam['img/bg-tunel-v2.jpg'])===J([2400,1600])&&J(tam['img/fundos-5k/tunel-v2.jpg'])===J([5000,3333])&&tam['img/bg-tunel.jpg'][0]===2400&&tam['img/fundos-5k/tunel.jpg'][0]===5000,'2: arquivos (novos e antigos no repositório): '+J(tam));

  // ---------- 3. lista salva (bgOn2) e marca bgTunelV2 ----------
  const lista=async(v,marca,ativo)=>{await pg.evaluate(([v,marca,ativo])=>{const s={};if(v!==undefined)s.bgOn2=v;if(marca)s.bgTunelV2=true;if(ativo)s.bgAtivo=ativo;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));},[v,marca,ativo]);
    await pg.reload();await pg.waitForTimeout(350);return pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');return {on:ETERNA.bgOn(),salvo:s.bgOn2,marca:s.bgTunelV2};});};
  let r=await lista(TRINCA);
  ok(J(r.on)===J(QUATRO)&&J(r.salvo)===J(TRINCA)&&r.marca==null,'3: trinca salva antes do túnel vale com o túnel (sem gravar nada): '+J(r));
  r=await lista(['telao','mirantedia','arq1950']);
  ok(J(r.on)===J(['telao','mirantedia','arq1950','tunel']),'3: trinca em outra ordem também ganha o túnel no fim: '+J(r));
  r=await lista(['mirantedia','telao']);
  ok(J(r.on)===J(['mirantedia','telao']),'3: lista personalizada não muda: '+J(r));
  r=await lista(['mirantedia','arq1950','telao','campeao']);
  ok(J(r.on)===J(TRINCA),'3: lista de 4 com um fundo do Laboratório não é a trinca: não ganha o túnel: '+J(r));
  r=await lista([]);
  ok(J(r.on)===J([]),'3: lista vazia de propósito continua vazia: '+J(r));
  r=await lista(TRINCA,true);
  ok(J(r.on)===J(TRINCA),'3: com a marca (escolha feita depois do túnel v2), a trinca vale como está: '+J(r));
  r=await lista(undefined,false,{tunel:false});
  ok(J(r.on)===J(QUATRO),'3: escolha antiga "túnel no Laboratório" (era do túnel antigo) não vale antes da marca: '+J(r));
  r=await lista(undefined,true,{tunel:false});
  ok(J(r.on)===J(TRINCA),'3: depois da marca, túnel no Laboratório vale: '+J(r));

  // clique no Painel de controle com a trinca salva: grava a lista que estava na tela e a marca
  await login(pg);
  const painel=async()=>{await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(200);await pg.click('#main [data-act="cat-tab"][data-t="fundos"]');await pg.waitForTimeout(200);
    return pg.evaluate(()=>({pill:(document.querySelector('#cat-fundos .head .pill')||{}).textContent,on:[...document.querySelectorAll('#cat-fundos [data-act="bg-on"][aria-pressed="true"]')].map(x=>x.dataset.id)}));};
  const salvo=()=>pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));return {s2:s.bgOn2,marca:s.bgTunelV2,at:s.bgAtivo,on:ETERNA.bgOn()};});
  await pg.evaluate(t=>{const S=ETERNA.SIM;S.bgOn2=t.slice();delete S.bgTunelV2;S.bgAtivo={};localStorage.setItem('eterna.sim.v1',JSON.stringify(S));},TRINCA);
  let p=await painel();ok(p.pill==='4 de 5 ativos'&&J(p.on.slice().sort())===J(QUATRO.slice().sort()),'3: Painel de controle mostra "4 de 5 ativos": '+J(p));
  await pg.click('#cat-fundos [data-act="bg-on"][data-id="telao"]');await pg.waitForTimeout(200);
  let s=await salvo();ok(J(s.s2)===J(['mirantedia','arq1950','tunel'])&&s.marca===true&&J(s.on)===J(s.s2),'3: desligar o Telão grava a lista da tela (com o túnel) e a marca: '+J(s));
  await pg.click('#cat-fundos [data-act="bg-on"][data-id="tunel"]');await pg.waitForTimeout(200);
  s=await salvo();ok(J(s.s2)===J(['mirantedia','arq1950'])&&J(s.on)===J(s.s2),'3: desligar o túnel: '+J(s));
  await pg.click('#cat-fundos [data-act="bg-on"][data-id="telao"]');await pg.waitForTimeout(200);
  s=await salvo();ok(J(s.s2)===J(TRINCA)&&J(s.on)===J(TRINCA),'3: escolher a trinca de propósito (com a marca) fica a trinca: '+J(s));
  await pg.reload();await pg.waitForTimeout(400);s=await salvo();ok(J(s.on)===J(TRINCA)&&s.marca===true,'3: depois de recarregar, a escolha continua: '+J(s));
  // Laboratório › mover outro fundo com uma escolha antiga "túnel no Laboratório": o túnel continua ativo
  await pg.evaluate(()=>{const S=ETERNA.SIM;delete S.bgOn2;delete S.bgTunelV2;S.bgAtivo={tunel:false};localStorage.setItem('eterna.sim.v1',JSON.stringify(S));});
  await pg.evaluate(()=>ETERNA.go('fundos-teste'));await pg.waitForTimeout(300);
  const lab=await pg.evaluate(()=>({tunelEmTeste:!!document.querySelector('[data-act="bg-ativar"][data-id="tunel"]'),tunelAtivo:!!document.querySelector('[data-act="bg-lab"][data-id="tunel"]')}));
  ok(!lab.tunelEmTeste&&lab.tunelAtivo,'3: túnel na lista de ativos do Laboratório, não em teste: '+J(lab));
  await pg.click('[data-act="bg-ativar"][data-id="campeao2"]');await pg.waitForTimeout(250);
  s=await salvo();ok(J(s.on)===J([...QUATRO,'campeao'])&&s.marca===true&&!(s.at&&s.at.tunel===false),'3: ativar outro fundo não tira o túnel (a escolha antiga sai junto com a marca): '+J(s));
  await pg.evaluate(()=>{const S=ETERNA.SIM;delete S.bgOn2;delete S.bgTunelV2;S.bgAtivo={};localStorage.setItem('eterna.sim.v1',JSON.stringify(S));});

  // ---------- 4. posição (fiaLayout) com recortes sintéticos ----------
  const L=await pg.evaluate(async([LIM])=>{const E=ETERNA;const W=2400,H=1600;
    const rec=(bw,bh,forma)=>{const c=document.createElement('canvas');c.width=2400;c.height=1600;const x=c.getContext('2d');x.fillStyle='#f0f';const x0=Math.round((2400-bw)/2),y0=1600-bh;
      if(forma==='t'){x.fillRect(x0,y0+Math.round(bh*.22),bw,Math.round(bh*.12));x.fillRect(1200-Math.round(bh*.2),y0,Math.round(bh*.4),bh);}
      else if(forma==='solto'){x.fillRect(x0,y0,bw,bh-120);}else x.fillRect(x0,y0,bw,bh);return c;};
    const braco=()=>{const c=rec(1500,700);const g=c.getContext('2d');g.fillStyle='#f0f';g.fillRect(600,300,90,620);return c;};
    const casalBraco=()=>{const c=rec(644,1000);const g=c.getContext('2d');g.fillStyle='#f0f';g.fillRect(900,250,60,400);return c;};
    const o={};const um=(c,ro)=>{const m=E.fiaMedir(c);const L=E.fiaLayout(m,'tunel',W,H,ro);return {q:+(m.box.w/m.box.h).toFixed(3),trunc:m.trunc,modo:L.modo,est:L.estreito,corte:L.corte,topo:L.dst.y/H,base:(L.dst.y+L.dst.h)/H,larg:L.dst.w/W,cx:(L.dst.x+L.dst.w/2)/W};};
    o.casal=um(rec(644,1080));o.sozinha=um(rec(1492,1016,'t'));o.grupo=um(rec(2156,1468));o.braco=um(braco());o.casalBraco=um(casalBraco());o.inteiro=um(rec(700,1300,'solto'));
    let topoMin=1,largMax=0,baseMin=1;for(let i=30;i<=260;i+=5)for(const ro of [null,[{top:.55,bot:.75,h:.2}]]){const m=E.fiaMedir(rec(i*10,i>160?600:1000));const L=E.fiaLayout(m,'tunel',W,H,ro);topoMin=Math.min(topoMin,L.dst.y/H);largMax=Math.max(largMax,L.dst.w/W);baseMin=Math.min(baseMin,(L.dst.y+L.dst.h)/H);}
    o.faixa={topoMin,largMax,baseMin};window.__recBraco=braco().toDataURL('image/png');return o;},[LIM]);
  const perto=(a,b,t)=>Math.abs(a-b)<=(t||.002);
  {const c=L.casal;ok(c.est===1&&c.corte===.74&&perto(c.topo,LIM)&&perto(c.base,1,.001)&&perto(c.cx,.5)&&c.larg<.5,'4 casal (estreito): corte no quadril (74%), topo a 23,4%, encostado embaixo, no centro: '+J(c));}
  for(const n of ['sozinha','grupo']){const c=L[n];ok(c.est===0&&c.corte===1&&c.modo==='meio'&&perto(c.topo,LIM)&&perto(c.base,1,.001)&&c.larg<=.92+.001&&perto(c.cx,.5)&&c.larg>.7,'4 '+n+' (largo): recorte inteiro, topo a 23,4% (a faixa limita antes da largura), no centro: '+J(c));}
  for(const n of ['braco','casalBraco']){const c=L[n];ok(c.topo>=LIM-.0005&&perto(c.base,1,.001)&&c.larg<=.92+.001,'4 '+n+': a mão erguida (topo do recorte) fica em 23,4% ou abaixo: '+J(c));}
  {const c=L.inteiro;ok(!c.trunc&&c.modo==='inteiro'&&c.corte===.62&&c.topo>=LIM-.0005&&perto(c.base,1,.001),'4 corpo inteiro: do joelho para cima (62%), encostado embaixo, abaixo da faixa: '+J(c));}
  ok(L.faixa.topoMin>=LIM-.0005&&L.faixa.largMax<=.92+.001&&L.faixa.baseMin>=.999,'4: em toda a faixa de proporções (0,30 a 2,60), com e sem rosto no corte, topo em 23,4% ou abaixo, largura até 92%, encostado embaixo: '+J(L.faixa));

  // ---------- 5. montagem e impressão de verdade com o braço erguido ----------
  const pngB=(await pg.evaluate(()=>window.__recBraco)).split(',')[1];
  await ctx.route(ORIG+'/recorte',q=>q.fulfill({status:200,contentType:'image/png',body:Buffer.from(pngB,'base64')}));
  await pg.evaluate(()=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};});
  await statusSemMontagem(ctx,ORIG,pg); // o agente responde sem `montagem` (modo conhecido): o navegador monta no canvas
  const z=await pg.evaluate(async([LIM])=>{const E=ETERNA,B=E.bgOf('tunel');const carrega=async u=>{const im=new Image();im.src=u;await im.decode();return im;};
    const dados=(im,sx,sy,sw,sh,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';x.drawImage(im,sx,sy,sw,sh,0,0,w,h);return x.getImageData(0,0,w,h).data;};
    const r=await E.fiaMontar('ag_7b0000000001','tunel');if(!r.canvas)return {falha:r};const W=r.w,H=r.h;const A=r.canvas.getContext('2d').getImageData(0,0,W,H).data;const pl=await carrega(B.file);const P=dados(pl,0,0,W,H,W,H);
    // linha y inteira acima de 23,4% (y+1 <= 0,234 H): igual ao fundo puro
    let acima=0,abaixo=0;const lim=Math.floor(H*LIM);for(let y=0;y<H;y++)for(let x=0;x<W;x+=2){const i=(y*W+x)*4;const d=Math.max(Math.abs(A[i]-P[i]),Math.abs(A[i+1]-P[i+1]),Math.abs(A[i+2]-P[i+2]));if(d>12){if(y<lim)acima++;else abaixo++;}}
    const o={W,H,lim,acima,abaixo,topo:r.layout.dst.y/H,fonte:r.fonte};
    // impressão 10×15: fundo de 5000 px; o corte é só nas laterais (o arquivo é 1,5 e o papel 1,487) e a faixa sai inteira
    const h=await E.compHi('ag_7b0000000001','tunel');if(!h.url)return {...o,hi:h};const im=await carrega(h.url);const D=dados(im,0,0,h.w,h.h,h.w,h.h);
    const hp=await carrega(B.fileHi);const hw=hp.naturalWidth,hh=hp.naturalHeight;const k=Math.max(h.w/hw,h.h/hh);const sw=h.w/k,sh=h.h/k;
    const F=dados(hp,(hw-sw)/2,0,sw,sh,h.w,h.h);  // o que a impressão tem que mostrar no alto: o arquivo com o mesmo corte
    const fx=Math.round(h.h*.20);let soma=0,n=0;for(let y=0;y<fx;y++)for(let x=0;x<h.w;x+=3){const i=(y*h.w+x)*4;soma+=Math.abs(D[i]-F[i])+Math.abs(D[i+1]-F[i+1])+Math.abs(D[i+2]-F[i+2]);n+=3;}
    // letras da faixa (claras ou amarelas no verde escuro, de 22% a 78% da largura e até 19,5% da altura, antes do céu): primeira e última linha e extremos na horizontal, na impressão e no arquivo
    const letras=(Q,w,hgt)=>{let y0=-1,y1=-1,x0=w,x1=-1;for(let y=0;y<Math.round(hgt*.195);y++)for(let x=Math.round(w*.22);x<w*.78;x++){const i=(y*w+x)*4;if(Q[i]>170&&Q[i+1]>120){if(y0<0)y0=y;y1=y;x0=Math.min(x0,x);x1=Math.max(x1,x);}}return {y0:y0/hgt,y1:y1/hgt,x0:x0/w,x1:x1/w};};
    const Fa=dados(hp,0,0,hw,hh,Math.round(hw/4),Math.round(hh/4));
    return {...o,imp:{w:h.w,h:h.h,av:h.avisos,fonte:h.fonte,sh,hh,dif:soma/n,letras:letras(D,h.w,h.h),arq:letras(Fa,Math.round(hw/4),Math.round(hh/4)),hw,hhh:hh}};},[LIM]);
  if(!z||z.falha||!z.imp||!z.imp.w)ok(false,'5: a montagem com braço erguido não saiu: '+J(z).slice(0,300));
  else{ok(z.acima===0&&z.abaixo>2000&&z.topo>=LIM-.0005&&z.fonte==='img/bg-tunel-v2.jpg','5: braço erguido: nenhum ponto do recorte acima de 23,4% da altura (linhas 0 a '+(z.lim-1)+' iguais ao fundo): '+J({acima:z.acima,abaixo:z.abaixo,topo:z.topo}));
    const I=z.imp;ok(I.w===1844&&I.h===1240&&!(I.av||[]).length&&I.fonte==='img/fundos-5k/tunel-v2.jpg'&&I.hw===5000&&I.hhh===3333,'5: impressão 10×15 com o fundo de 5000 px, sem aviso: '+J(I));
    ok(Math.abs(I.sh-I.hh)<.5&&I.dif<4,'5: impressão sem corte no alto (altura inteira do arquivo; só as laterais saem): os 20% de cima iguais ao arquivo (dif. média '+I.dif.toFixed(2)+'): '+J({sh:I.sh,hh:I.hh}));
    ok(I.letras.y0>.02&&Math.abs(I.letras.y0-I.arq.y0)<.005&&Math.abs(I.letras.y1-I.arq.y1)<.005&&I.letras.x0>.22&&I.letras.x1<.78&&Math.abs(I.letras.x0-I.arq.x0)<.01&&Math.abs(I.letras.x1-I.arq.x1)<.01,'5: a faixa inteira na impressão (letras de '+(I.letras.y0*100).toFixed(1)+'% a '+(I.letras.y1*100).toFixed(1)+'% da altura, como no arquivo): '+J({imp:I.letras,arq:I.arq}));}

  // ---------- 6. venda antiga com |tunel continua montando e imprimindo (agora com a imagem nova) ----------
  const ant=await pg.evaluate(async()=>{const id='ag_7b0000000001';const pv=await ETERNA.fiaMontar(id,'tunel');
    const res=await ETERNA.printMontar([{k:'ai:'+id+'|tunel',t:'ai',id,bg:'tunel'}]);const root=document.getElementById('print-root');
    const o={pv:pv.canvas?[pv.w,pv.h]:pv,ok:res.ok.length,falhasIA:res.falhasIA,falhas:res.falhas,fundos:root?[...root.querySelectorAll('img')].map(i=>i.dataset.fundo):[],nome:ETERNA.bgNomeCli(ETERNA.bgOf('tunel'))};if(root)root.remove();document.body.classList.remove('pr-on');return o;});
  ok(J(ant.pv)===J([2400,1600])&&ant.ok===1&&!ant.falhasIA.length&&!ant.falhas.length&&J(ant.fundos)===J(['img/fundos-5k/tunel-v2.jpg'])&&ant.nome==='Saída do túnel','6: ai:<foto>|tunel de venda antiga monta e imprime com o fundo novo: '+J(ant));
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
console.log(`${fails.length?'FALHA':'OK'} tunel-v2: Saída do túnel v2 como 4º fundo (ordem, nomes, base), trinca salva ganha o túnel até a próxima escolha, nada acima de 23,4% nem com braço erguido, estreito no quadril e largo inteiro, impressão com a faixa inteira, venda antiga com |tunel${fails.length?' · '+fails.join(' | '):''}`);process.exit(fails.length?1:0);})();
