// Regra 20 (Eduardo, 16/11/2026; docs/planos/2026-11-16-proporcao-montagens.md): proporção da pessoa nas montagens.
// Recorte LARGO (grupo, bandeira aberta, braços abertos): a largura limita e nada muda no Mirante do Rio nem no Telão: o
// resultado tem que ser igual, número a número, à conta de antes (refeita aqui com os números antigos). Recorte ESTREITO
// (casal, pessoa sozinha) do joelho para cima: no Mirante do Rio corta no quadril (74%) com o topo no mesmo lugar; no Telão
// corta no peito e enche a tela. Entre os dois não há salto; a largura nunca passa do teto do caso largo; nenhum rosto é cortado.
// Regra 21 (fundo novo "Maracanã 1950", mesmo id arq1950): centro, encostado embaixo, até 92% da largura e NADA do recorte acima
// de 32% da altura (o título fica no céu), nem braço erguido; estreito corta no quadril; a impressão 10×15 guarda o título inteiro.
// Vale para a prévia (fiaMontar) e para a impressão (compHi). Recortes sintéticos com as proporções das fotos de calibração
// (644×1080, 1492×1016 e 2156×1468), nunca foto de cliente.
const {chromium}=require('playwright');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
// números de antes da regra 20 (commit 8bd5389): a entrada "meio" de cada fundo
const ANTES={mirantedia:{corte:1,alt:.80,larg:.92,cx:.45},telao:{corte:.80,alt:.90,larg:.90,cx:.5}};
const ESTREITO={mirantedia:{corte:.74,alt:.80,larg:.92},telao:{corte:.47,alt:.90,larg:.90}};
(async()=>{const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(60000);pg.on('pageerror',e=>errs.push(e.message));await login(pg);
  // o /recorte devolve o recorte estreito (casal: dois retângulos lado a lado, 644×1080, encostado embaixo), desenhado na página
  const png=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1600;const x=c.getContext('2d');x.fillStyle='#f0f';x.fillRect(878,520,644,1080);return c.toDataURL('image/png').split(',')[1];});
  await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from(png,'base64')}));
  await pg.evaluate(()=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};});
  const r=await pg.evaluate(async([ANTES])=>{const E=ETERNA;const o={regras:{},casos:{},faixa:{},rosto:{},montar:{}};
    // recorte sintético: caixa bw×bh encostada na borda de baixo de um quadro 2400×1600; "t" = braços abertos (barra no alto e tronco estreito)
    const rec=(bw,bh,forma)=>{const c=document.createElement('canvas');c.width=2400;c.height=1600;const x=c.getContext('2d');x.fillStyle='#f0f';const x0=Math.round((2400-bw)/2),y0=1600-bh;
      if(forma==='t'){x.fillRect(x0,y0+Math.round(bh*.22),bw,Math.round(bh*.12));x.fillRect(1200-Math.round(bh*.2),y0,Math.round(bh*.4),bh);}else x.fillRect(x0,y0,bw,bh);return c;};
    // a conta de antes da regra 20, com os números antigos (sem rosto: nos casos largos do Mirante o corte é 1 e no Telão o teste não passa rostos)
    const antes=(m,a,W,H)=>{const yc=Math.round(Math.min(m.h,m.box.y+m.box.h*a.corte));let p=m.w,q=-1;for(let y=m.box.y;y<yc;y++){const l=m.rows[y];if(l){p=Math.min(p,l[0]);q=Math.max(q,l[1]);}}
      const src={x:p/m.k,y:m.box.y/m.k,w:(q-p+1)/m.k,h:(yc-m.box.y)/m.k};const s=Math.min(a.alt*H/src.h,a.larg*W/src.w);const dw=src.w*s,dh=src.h*s;let x=a.cx*W-dw/2;x=dw<=W?Math.max(0,Math.min(W-dw,x)):(W-dw)/2;return {src,dst:{x,y:H-dh,w:dw,h:dh},s};};
    const igual=(L,A)=>['x','y','w','h'].every(k=>L.src[k]===A.src[k]&&L.dst[k]===A.dst[k])&&L.s===A.s;
    // quadro de cada fundo: o Mirante é o arquivo; no Telão é a tela (vem do layout de uma montagem de verdade)
    const mt=await E.fiaMontar('ag_9a0000000001','telao');const Q={mirantedia:[2400,1711],telao:mt.layout?[mt.layout.tela.w,mt.layout.tela.h]:null};o.Q=Q;if(!Q.telao)return o;
    for(const bg of ['mirantedia','telao','arq1950']){const R=E.FIA_REGRAS[bg];o.regras[bg]={meio:R.meio,est:R.estreito||null};}
    const CASOS={casal:[644,1080],sozinha:[1492,1016,'t'],grupo:[2156,1468]};
    for(const bg of ['mirantedia','telao']){const [W,H]=Q[bg];o.casos[bg]={};
      for(const [n,[bw,bh,f]] of Object.entries(CASOS)){const m=E.fiaMedir(rec(bw,bh,f));const L=E.fiaLayout(m,bg,W,H);const A=antes(m,ANTES[bg],W,H);
        o.casos[bg][n]={q:m.box.w/m.box.h,trunc:m.trunc,modo:L.modo,est:L.estreito,corte:L.corte,cf:L.corteFinal,src:L.src,dst:L.dst,s:L.s,antes:A,igual:igual(L,A),W,H};}
      // faixa: razão de 0,40 a 1,70 em passos de 0,01 (altura fixa de 1000): tamanho sem salto, largura dentro do teto, largo igual ao de antes
      let ant=null,salto=0,teto=0,difLargo=0,nLargo=0,nEst=0,cresce=0;for(let i=40;i<=170;i++){const m=E.fiaMedir(rec(i*10,1000));const L=E.fiaLayout(m,bg,W,H);const q=m.box.w/m.box.h;
        if(ant!=null)salto=Math.max(salto,Math.abs(L.s/ant-1));ant=L.s;teto=Math.max(teto,L.dst.w/W);
        if(q>=E.FIA_ESTREITO_ATE){nLargo++;const A=antes(m,ANTES[bg],W,H);if(!igual(L,A)||L.estreito!==0)difLargo++;}
        if(q<=E.FIA_ESTREITO_DE){nEst++;if(L.estreito!==1)difLargo+=1000;const A=antes(m,ANTES[bg],W,H);if(L.s>A.s*1.2)cresce++;}}
      o.faixa[bg]={salto,teto,difLargo,nLargo,nEst,cresce};
      // rosto bem na linha do corte: a linha desce até abaixo dele (proteção de rosto mantida no caso estreito)
      const m=E.fiaMedir(rec(644,1080));const y0=m.box.y/m.h,hh=m.box.h/m.h;const ce=E.FIA_REGRAS[bg].estreito.corte;const ro=[{top:y0+hh*(ce-.12),bot:y0+hh*(ce+.08),h:hh*.20}];const L=E.fiaLayout(m,bg,W,H,ro);const L0=E.fiaLayout(m,bg,W,H);
      o.rosto[bg]={cf:L.corteFinal,cf0:L0.corteFinal,fim:(L.src.y+L.src.h)/m.H,rostoFim:ro[0].bot,dentro:L.dst.h<=E.FIA_REGRAS[bg].estreito.alt*H+1&&L.dst.w<=E.FIA_REGRAS[bg].estreito.larg*W+1};
      // prévia e impressão com o recorte estreito servido pelo /recorte
      const pv=await E.fiaMontar('ag_9a0000000001',bg);const hi=await E.compHi('ag_9a0000000001',bg);
      o.montar[bg]={pv:pv.layout?{est:pv.layout.estreito,corte:pv.layout.corte,w:pv.w,h:pv.h}:pv,hi:hi.layout?{est:hi.layout.estreito,corte:hi.layout.corte,w:hi.w,h:hi.h,av:hi.avisos}:hi};}
    // ---- Maracanã 1950 (regra 21) ----
    {const bg='arq1950',B=E.bgOf(bg),R=E.FIA_REGRAS[bg];const pl=new Image();pl.src=B.file;await pl.decode();const W=pl.naturalWidth,H=pl.naturalHeight;const hi=new Image();hi.src=B.fileHi;await hi.decode();
      const x=o.m1950={file:B.file,hi:B.fileHi,W,H,hw:hi.naturalWidth,hh:hi.naturalHeight,regra:R,casos:{}};
      // braço erguido: tronco largo e um braço fino que sobe bem acima das cabeças (o topo da caixa é a mão)
      const braco=()=>{const c=rec(1500,700);const g=c.getContext('2d');g.fillStyle='#f0f';g.fillRect(600,300,90,620);return c;};
      for(const [n,c] of [['casal',rec(644,1080)],['sozinha',rec(1492,1016,'t')],['grupo',rec(2156,1468)],['braco',braco()]]){const m=E.fiaMedir(c);const L=E.fiaLayout(m,bg,W,H);x.casos[n]={q:m.box.w/m.box.h,modo:L.modo,est:L.estreito,corte:L.corte,zoom:L.zoom,topo:L.dst.y/H,base:(L.dst.y+L.dst.h)/H,larg:L.dst.w/W,cx:(L.dst.x+L.dst.w/2)/W};}
      // faixa inteira de razões, com e sem rosto na linha do corte: o topo nunca sobe de 34%
      let topoMin=1,largMax=0;for(let i=30;i<=260;i+=5)for(const ro of [null,[{top:.55,bot:.75,h:.2}]]){const m=E.fiaMedir(rec(i*10,i>160?600:1000));const L=E.fiaLayout(m,bg,W,H,ro);topoMin=Math.min(topoMin,L.dst.y/H);largMax=Math.max(largMax,L.dst.w/W);}x.topoMin=topoMin;x.largMax=largMax;
      // montagem de verdade com o braço erguido: nenhum ponto do recorte (magenta vira cinza médio; comparado com o fundo puro) acima de 32%
      window.__recBraco=braco().toDataURL('image/png');}
    o.de=E.FIA_ESTREITO_DE;o.ate=E.FIA_ESTREITO_ATE;return o;},[ANTES]);
  // o /recorte passa a devolver o recorte de braço erguido; a prévia e a impressão do Maracanã 1950 com ele
  await ctx.unroute(ORIG+'/recorte');const pngB=(await pg.evaluate(()=>window.__recBraco)).split(',')[1];await ctx.route(ORIG+'/recorte',q=>q.fulfill({status:200,contentType:'image/png',body:Buffer.from(pngB,'base64')}));
  const z=await pg.evaluate(async()=>{const E=ETERNA,bg='arq1950',B=E.bgOf(bg);const carrega=async u=>{const im=new Image();im.src=u;await im.decode();return im;};const dados=(im,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);return x.getImageData(0,0,w,h).data;};
    const r=await E.fiaMontar('ag_9a0000000002',bg);if(!r.canvas)return {falha:r};const W=r.w,H=r.h;const A=r.canvas.getContext('2d').getImageData(0,0,W,H).data;const P=dados(await carrega(B.file),W,H);
    // fundo puro em cinza para comparar (o fiaPB converte o quadro inteiro; o arquivo já é cinza)
    let acima=0,abaixo=0,cor=0;const lim=Math.floor(H*.32);for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const i=(y*W+x)*4;if(Math.abs(A[i]-A[i+1])>2||Math.abs(A[i+1]-A[i+2])>2)cor++;const d=Math.abs(A[i]-P[i]);if(d>12){if(y<lim)acima++;else abaixo++;}}
    const L=r.layout;const o={W,H,acima,abaixo,cor,topo:L.dst.y/H,mono:L.mono,fonte:r.fonte};
    // impressão: 1844×1240 do fundo de 5000 px; o título (letras claras no céu escuro, no alto e no centro) inteiro, com folga do alto
    const h=await E.compHi('ag_9a0000000002',bg);if(!h.url)return {...o,hi:h};const im=await carrega(h.url);const D=dados(im,h.w,h.h);let y0=-1;for(let y=0;y<Math.round(h.h*.2)&&y0<0;y++){let n=0;for(let x=Math.round(h.w*.3);x<h.w*.7;x++){if(D[(y*h.w+x)*4]>190)n++;}if(n>3)y0=y;}
    // a mesma medida no arquivo de 5000 px: a 1ª linha clara do título, para saber onde ela tem que cair na impressão
    const hp=await carrega(B.fileHi);const hw=hp.naturalWidth,hh=hp.naturalHeight;const F=dados(hp,hw,hh);let f0=-1;for(let y=0;y<Math.round(hh*.2)&&f0<0;y++){let n=0;for(let x=Math.round(hw*.3);x<hw*.7;x++){if(F[(y*hw+x)*4]>190)n++;}if(n>8)f0=y;}
    return {...o,imp:{w:h.w,h:h.h,av:h.avisos,fonte:h.fonte,titulo:y0,tituloArq:f0/hh,est:h.layout.estreito}};});
  r.z=z;
  {const x=r.m1950,C=x.casos;
    ok(x.file==='img/bg-maracana1950.jpg'&&x.hi==='img/fundos-5k/maracana1950.jpg'&&x.W===2400&&x.hw===5000&&Math.abs(x.W/x.H-x.hw/x.hh)<.002,'1950: arquivos novos (2400 e 5000 px, mesma proporção): '+J([x.file,x.hi,x.W,x.H,x.hw,x.hh]));
    ok(J(x.regra)===J({mono:{contraste:1.1},meio:{corte:1,alt:.66,larg:.92,cx:.5},inteiro:{corte:.62,alt:.66,larg:.92,cx:.5},estreito:{corte:.74,alt:.66,larg:.92,cx:.5}})&&!x.regra.largo,'1950: regra 21 (sem o modo largo com zoom do fundo antigo): '+J(x.regra));
    ok(C.casal.est===1&&C.casal.corte===.74&&Math.abs(C.casal.topo-.34)<.002&&Math.abs(C.casal.base-1)<.001&&Math.abs(C.casal.cx-.5)<.002,'1950 casal (estreito): corte no quadril, topo a 34%, encostado embaixo, no centro: '+J(C.casal));
    {const c=C.braco;ok(c.modo==='meio'&&c.corte>=.74&&c.zoom===1&&c.topo>=.34-.001&&Math.abs(c.base-1)<.001&&c.larg<=.92+.001,'1950 braço erguido: a mão (topo do recorte) fica em 34% ou abaixo: '+J(c));}
    for(const n of ['sozinha','grupo']){const c=C[n];ok(c.est===0&&c.corte===1&&c.zoom===1&&c.modo==='meio'&&c.topo>=.34-.001&&Math.abs(c.base-1)<.001&&c.larg<=.92+.001&&Math.abs(c.cx-.5)<.002,'1950 '+n+' (largo): recorte inteiro, limitado pela largura (92%) ou pelo topo a 34%, sem zoom do fundo: '+J(c));}
    ok(x.topoMin>=.34-.001&&x.largMax<=.92+.001,'1950: em toda a faixa de proporções, com e sem rosto no corte, o topo fica em 34% ou abaixo e a largura até 92%: '+J([x.topoMin,x.largMax]));
    if(!z||z.falha||!z.imp||!z.imp.w)ok(false,'1950: a montagem com braço erguido não saiu: '+J(z).slice(0,300));
    else{ok(z.acima===0&&z.abaixo>2000&&z.topo>=.34-.001,'1950 braço erguido: nenhum ponto do recorte acima de 32% da altura (a pessoa está abaixo): '+J({acima:z.acima,abaixo:z.abaixo,topo:z.topo}));
      ok(z.cor===0&&z.mono&&z.mono.contraste===1.1&&z.fonte==='img/bg-maracana1950.jpg','1950: a montagem inteira em tons de cinza, pessoa incluída: '+J({cor:z.cor,mono:z.mono}));
      ok(z.imp.w===1844&&z.imp.h===1240&&!(z.imp.av||[]).length&&z.imp.fonte==='img/fundos-5k/maracana1950.jpg','1950: impressão 10×15 com o fundo de 5000 px, sem aviso: '+J(z.imp));
      ok(z.imp.titulo>=40&&z.imp.titulo<=120&&z.imp.tituloArq>.04&&z.imp.tituloArq<.07,'1950: o título inteiro dentro da impressão, com folga do alto (1ª linha do título a '+z.imp.titulo+' px de 1240; no arquivo a '+(z.imp.tituloArq*100).toFixed(1)+'% do alto): '+J(z.imp));}}
  if(!r.Q||!r.Q.telao)throw new Error('o Telão não montou: '+J(r).slice(0,300));
  // as entradas "meio" não mudaram; o caso estreito existe só no Mirante do Rio e no Telão
  for(const bg of ['mirantedia','telao'])ok(J(r.regras[bg].meio)===J(ANTES[bg])&&r.regras[bg].est&&r.regras[bg].est.corte===ESTREITO[bg].corte&&r.regras[bg].est.alt===ESTREITO[bg].alt&&r.regras[bg].est.larg===ANTES[bg].larg,bg+': a entrada "meio" tem que ser a de antes e a "estreito" a aprovada: '+J(r.regras[bg]));
  ok(r.de===.7&&r.ate===1.2,'faixa entre o estreito e o largo: razão 0,70 a 1,20: '+J([r.de,r.ate]));
  for(const bg of ['mirantedia','telao']){const C=r.casos[bg],e=ESTREITO[bg],a=ANTES[bg];
    // largos: iguais à conta de antes, número a número
    for(const n of ['sozinha','grupo']){const c=C[n];ok(c.trunc&&c.modo==='meio'&&Math.abs(c.q-1.47)<.02&&c.est===0&&c.corte===a.corte&&c.igual,bg+' '+n+' (largo, razão '+c.q.toFixed(2)+'): tem que sair igual a antes: '+J({est:c.est,corte:c.corte,dst:c.dst,antes:c.antes.dst}));}
    // estreito: corte novo, topo no lugar de sempre, encostado embaixo, maior que antes e dentro do teto de largura
    const c=C.casal;const topo=c.dst.y/c.H,larg=c.dst.w/c.W;
    ok(c.trunc&&c.modo==='meio'&&Math.abs(c.q-.60)<.02&&c.est===1&&c.corte===e.corte&&Math.abs(c.cf-e.corte)<.01,bg+' casal (estreito, razão '+c.q.toFixed(2)+'): corte '+e.corte+': '+J({est:c.est,corte:c.corte,cf:c.cf}));
    ok(Math.abs(topo-(1-e.alt))<.002&&Math.abs(c.dst.y+c.dst.h-c.H)<=1&&Math.abs(topo-c.antes.dst.y/c.H)<.002,bg+' casal: topo no mesmo lugar de antes ('+(1-e.alt).toFixed(2)+' do alto) e encostado embaixo: '+J({topo,antes:c.antes.dst.y/c.H}));
    ok(Math.abs(c.s/c.antes.s-a.corte/e.corte)<.01&&larg<=a.larg+.001,bg+' casal: a pessoa cresce '+(a.corte/e.corte).toFixed(2)+'× e não passa do teto de largura: '+J({cresceu:c.s/c.antes.s,larg}));
    if(bg==='telao')ok(larg>=.55&&larg<=.70&&c.antes.dst.w/c.W<.40,'telao casal: perto de 2/3 da largura da tela (antes 36%): '+J({larg,antes:c.antes.dst.w/c.W}));
    const f=r.faixa[bg];ok(f.salto<.03&&f.teto<=a.larg+.001&&f.difLargo===0&&f.nLargo>=40&&f.nEst>=25&&f.cresce===f.nEst,bg+': sem salto entre os casos (passo de 0,01 na razão muda o tamanho menos de 3%), largura até o teto, largo igual a antes: '+J(f));
    const ro=r.rosto[bg];ok(ro.cf0<ro.cf&&ro.fim>=ro.rostoFim&&ro.dentro,bg+': o corte desce para não passar pelo rosto e o grupo continua dentro do quadro: '+J(ro));
    const mo=r.montar[bg];ok(mo.pv&&mo.pv.est===1&&mo.pv.corte===e.corte&&mo.hi&&mo.hi.est===1&&mo.hi.corte===e.corte&&mo.hi.w===1844&&mo.hi.h===1240&&!(mo.hi.av||[]).length,bg+': a prévia e a impressão usam o caso estreito: '+J(mo));}
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
console.log(`${fails.length?'FALHA':'OK'} proporcao-montagens: recorte largo igual a antes e recorte estreito maior (quadril no Mirante do Rio, peito no Telão), sem salto, com teto de largura e sem cortar rosto, na prévia e na impressão; Maracanã 1950 abaixo do título, com o título inteiro na impressão${fails.length?' · '+fails.join(' | '):''}`);process.exit(fails.length?1:0);})();
