// 16/11 (Eduardo): três fundos de IA no Checkout (Mirante do Rio de dia, Arquibancada 1950 toda em preto e branco e Telão do
// Maracanã com a imagem nova). Noite de campeão, Mirante ao pôr do sol e Saída do túnel vão para o Laboratório, sem apagar.
// Plano e critérios: docs/planos/2026-11-16-tres-fundos-ia.md. Recorte sintético (nunca foto de cliente).
// TRES_FUNDOS_RENDER=pasta grava as montagens de conferência (Telão com os 4 cantos ampliados, Mirante e 1950).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RENDER=process.env.TRES_FUNDOS_RENDER||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TRINCA=['mirantedia','arq1950','telao'];
// recorte "meio" (encosta embaixo) e "inteiro" (termina antes da borda): duas pessoas de camisa magenta
const [MEIO,INTEIRO,MINI]=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for fim in (1600,1480):
    im=Image.new('RGBA',(2400,1600),(0,0,0,0));d=ImageDraw.Draw(im)
    for x in (700,1300):
        d.ellipse([x+120,300,x+380,560],fill=(230,190,160,255));d.rectangle([x,560,x+500,fim],fill=(255,0,255,255))
    b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(300,200),(60,110,150));b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const recorte=r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'image/png',body:/2$/.test(q.pid||'')?INTEIRO:MEIO});};
const M1='ag_3f0000000001',I2='ag_3f0000000002';   // pid terminado em 1 = meio corpo; em 2 = corpo inteiro
const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(120);}return false;};
// agente falso com /ponto/docs em memória (critérios 4 e 6)
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const BASES=['bas000000001','bas000000002'];const FOTOS=['pho000000001','pho000000002'];const CARD='LPTRES001';
const FEED=[{card:CARD,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:a-900,ultima_chegada:a-850,cap0:a-902,cap1:a-852,fonte_t:'cap',fechada_em:a-790,fechada_por:'pausa',
  fotos:[...BASES,...FOTOS],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:BASES.slice(),ia_regra:{n:2,motivo:null}}];
const ANTIGA=['campeao','mirante','arq1950','tunel','telao'];
const DOCS={sim:{bgOn:{valor:ANTIGA,rev:1},bgPodioV86:{valor:true,rev:2},bgTelaoV97:{valor:true,rev:3}}};let DREV=3;const POSTS=[];
(async()=>{const b=await chromium.launch();const errs=[];
try{
  // ================= A. sem agente: catálogo, lista salva, nomes, montagens =================
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/recorte',recorte);
  const pg=await ctx.newPage();pg.setDefaultTimeout(20000);pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);

  // 1: navegador limpo
  const c1=await pg.evaluate(()=>({on:ETERNA.bgOn(),opts:ETERNA.bgOpts().map(o=>o.id),sim2:ETERNA.SIM.bgOn2,sim:ETERNA.SIM.bgOn}));
  ok(J(c1.on)===J(TRINCA)&&J(c1.opts.slice().sort())===J(TRINCA.slice().sort())&&c1.sim2==null&&c1.sim==null,'1: navegador limpo com a trinca: '+J(c1));

  // 2: os três que saíram continuam em DATA.backgrounds, no Laboratório
  const c2=await pg.evaluate(()=>({total:ETERNA.BGS.length,lab:['campeao2','mirante','tunel'].map(i=>{const x=ETERNA.bgOf(i);return !!x&&x.inativo===true&&!ETERNA.bgAtivo(x);}),arq:['img/bg-campeao-v81.jpg','img/bg-mirantesol.jpg','img/bg-tunel.jpg'].every((f,i)=>ETERNA.bgOf(['campeao2','mirante','tunel'][i]).file===f)}));
  ok(c2.total>=16&&c2.lab.every(Boolean)&&c2.arq,'2: Campeão, Mirante ao pôr do sol e Túnel seguem no catálogo, inativos: '+J(c2));
  for(const f of ['img/bg-telao.jpg','img/bg-campeao-v81.jpg','img/bg-mirantesol.jpg','img/bg-tunel.jpg','img/fundos-5k/campeao.jpg','img/fundos-5k/mirantesol.jpg','img/fundos-5k/tunel.jpg'])ok(fs.existsSync(path.join(__dirname,'..',f)),'2: arquivo antigo apagado: '+f);

  // 7: nomes para o cliente nas 5 línguas
  const c7=await pg.evaluate(ids=>{const o={};['pt','en','es','fr','de'].forEach(l=>{ETERNA.state.lang=l;o[l]=ids.map(i=>ETERNA.bgNomeCli(ETERNA.bgOf(i)));});ETERNA.state.lang='pt';return o;},TRINCA);
  ok(J(c7)===J({pt:['Mirante do Rio','Arquibancada 1950','Telão do Maracanã'],en:['Rio lookout','1950 Stands','Maracanã big screen'],es:['Mirador de Río','Tribuna de 1950','Pantalla gigante del Maracanã'],
    fr:['Belvédère de Rio','Tribunes de 1950','Écran géant du Maracanã'],de:['Aussichtspunkt über Rio','Tribüne 1950','Maracanã-Großbildleinwand']}),'7: nomes nas 5 línguas: '+J(c7));

  // 3: aparelho com a lista antiga salva (SIM.bgOn): mostra a trinca e não cria bgOn2 sozinho
  for(const [nome,lista] of [['5 fundos',['campeao','mirante','arq1950','tunel','telao']],['4 fundos',['campeao','mirante','arq1950','tunel']],['com pódio',['campeao','podio','mirante','arq1950','tunel']],['lista vazia',[]]]){
    await pg.evaluate(l=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');s.bgOn=l;delete s.bgOn2;delete s.bgPodioV86;delete s.bgTelaoV97;localStorage.removeItem('eterna.bgpodio.v');localStorage.removeItem('eterna.bgtelao.v');localStorage.setItem('eterna.sim.v1',JSON.stringify(s));},lista);
    await pg.reload();await pg.waitForTimeout(400);
    const r=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');return {on:ETERNA.bgOn(),mem:ETERNA.SIM.bgOn2,salvo2:s.bgOn2,salvo:s.bgOn};});
    ok(J(r.on)===J(TRINCA)&&r.mem==null&&r.salvo2==null&&J(r.salvo)===J(lista),'3 ('+nome+'): a trinca, sem criar bgOn2 e sem mexer na lista antiga: '+J(r));}

  // 5: bgOn2 que não é lista de textos não quebra: vale o padrão
  await login(pg);
  for(const v of [1,'telao',{a:1},[1,2],[['telao']],null]){
    const r=await pg.evaluate(v=>{ETERNA.SIM.bgOn2=v;const o={on:ETERNA.bgOn()};try{ETERNA.go('chroma');o.chroma=document.querySelector('#main').innerText.length>100;ETERNA.go('catalogo');o.cat=true;}catch(e){o.err=String(e.message);}return o;},v);
    ok(J(r.on)===J(TRINCA)&&r.chroma&&r.cat&&!r.err,'5: bgOn2='+J(v)+' vale o padrão e a tela abre: '+J(r));}
  // lista com id que não existe ou inativo: fica o que vale; só inválidos: volta ao padrão; vazia de propósito: vazia
  const c5=await pg.evaluate(()=>{const S=ETERNA.SIM,o=[];S.bgOn2=['telao','naoexiste','mirante'];o.push(ETERNA.bgOn());S.bgOn2=['campeao','tunel'];o.push(ETERNA.bgOn());S.bgOn2=[];o.push(ETERNA.bgOn());delete S.bgOn2;return o;});
  ok(J(c5)===J([['telao'],TRINCA,[]]),'5: lista com fundo que não vale: '+J(c5));

  // 12: Painel de controle "3 de 5 ativos"; ligar e desligar grava bgOn2; mover do Laboratório para ativo e histórico
  await pg.evaluate(()=>{delete ETERNA.SIM.bgOn2;delete ETERNA.SIM.bgOn;localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));localStorage.removeItem('eterna.users.log.v1');ETERNA.go('catalogo');});await pg.waitForTimeout(200);
  await pg.click('#main [data-act="cat-tab"][data-t="fundos"]');await pg.waitForTimeout(200);
  const p12=await pg.evaluate(()=>({pill:(document.querySelector('#cat-fundos .head .pill')||{}).textContent,n:document.querySelectorAll('#cat-fundos [data-act="bg-on"]').length,on:document.querySelectorAll('#cat-fundos [data-act="bg-on"][aria-pressed="true"]').length}));
  ok(p12.pill==='3 de 5 ativos'&&p12.n===3&&p12.on===3,'12: Painel de controle com "3 de 5 ativos": '+J(p12));
  await pg.click('#cat-fundos [data-act="bg-on"][data-id="telao"]');await pg.waitForTimeout(200);
  const d12=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));return {s2:s.bgOn2,s1:s.bgOn,on:ETERNA.bgOn(),pill:document.querySelector('#cat-fundos .head .pill').textContent};});
  ok(J(d12.s2)===J(['mirantedia','arq1950'])&&d12.s1==null&&J(d12.on)===J(d12.s2)&&d12.pill==='2 de 5 ativos','12: desligar grava bgOn2 (e nada em bgOn): '+J(d12));
  await pg.click('#cat-fundos [data-act="bg-on"][data-id="telao"]');await pg.waitForTimeout(200);
  const l12=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));return {s2:s.bgOn2,s1:s.bgOn};});
  ok(J(l12.s2)===J(['mirantedia','arq1950','telao'])&&l12.s1==null,'12: ligar de novo grava bgOn2: '+J(l12));
  await pg.evaluate(()=>ETERNA.go('fundos-teste'));await pg.waitForTimeout(300);
  const t12=await pg.evaluate(()=>({txt:document.querySelector('#main').innerText,bt:['campeao2','mirante','tunel'].map(i=>!!document.querySelector('[data-act="bg-ativar"][data-id="'+i+'"]'))}));
  ok(/Noite de campeão/.test(t12.txt)&&/Mirante ao pôr do sol/.test(t12.txt)&&/Saída do túnel/.test(t12.txt)&&t12.bt.every(Boolean),'2: os três aparecem em Laboratório › Fundos em teste com Ativar: '+J(t12.bt));
  await pg.click('[data-act="bg-ativar"][data-id="campeao2"]');await pg.waitForTimeout(250);
  const m12=await pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));return {on:ETERNA.bgOn(),s2:s.bgOn2,s1:s.bgOn,at:s.bgAtivo,log:ETERNA.auditRead().filter(e=>e.acao==='fundo_ativado'&&e.alvo==='fundo:campeao2').length};});
  ok(J(m12.on)===J([...TRINCA,'campeao'])&&J(m12.s2)===J(m12.on)&&m12.s1==null&&m12.at.campeao2===true&&m12.log===1,'12: mover do Laboratório para ativo põe no Checkout (bgOn2) e registra no histórico: '+J(m12));
  await pg.click('[data-act="bg-lab"][data-id="campeao2"]');await pg.waitForTimeout(250);
  ok(J(await pg.evaluate(()=>ETERNA.bgOn()))===J(TRINCA),'12: de volta ao Laboratório, a trinca');
  await pg.evaluate(()=>{delete ETERNA.SIM.bgOn2;ETERNA.SIM.bgAtivo={};localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));});

  // ---------- montagens (recorte sintético) ----------
  await pg.evaluate(()=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};});
  const cena=`async function carrega(src){return await new Promise(z=>{const i=new Image();i.onload=()=>z(i);i.onerror=()=>z(null);i.src=src;});}
    function dados(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
    function tela(im){const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);return c;}`;

  // 8: Mirante do Rio
  const mi=await pg.evaluate(async([m1,i2])=>{const o={};for(const [n,id] of [['meio',m1],['inteiro',i2]]){const r=await ETERNA.fiaMontar(id,'mirantedia');if(!r.canvas){o[n]=r;continue;}const L=r.layout;o[n]={w:r.w,h:r.h,modo:L.modo,corte:L.corte,dst:L.dst,fonte:r.fonte};}
    const b=ETERNA.bgOf('mirantedia');o.bg={file:b.file,hi:b.fileHi,pos:b.pos,regra:ETERNA.FIA_REGRAS.mirantedia,velha:ETERNA.FIA_REGRAS.mirante,base:ETERNA.FIA_BASE.mirantedia};return o;},[M1,I2]);
  ok(mi.bg.file==='img/bg-mirantedia.jpg'&&mi.bg.hi==='img/fundos-5k/mirantedia.jpg'&&J(mi.bg.regra)===J(mi.bg.velha)&&J(mi.bg.regra)===J({meio:{corte:1,alt:.8,larg:.92,cx:.45},inteiro:{corte:.62,alt:.8,larg:.92,cx:.45}})&&mi.bg.base===1,'8: Mirante do Rio com a regra 5 em entrada própria e a 2ª base: '+J(mi.bg));
  for(const n of ['meio','inteiro']){const m=mi[n];if(!m||!m.dst){ok(false,'8 '+n+': não montou: '+J(m));continue;}const cx=(m.dst.x+m.dst.w/2)/m.w;
    ok(m.w===2400&&m.h===1711,'8 '+n+': prévia 2400×1711: '+J([m.w,m.h]));
    ok(m.modo===n&&m.corte===(n==='meio'?1:.62),'8 '+n+': modo e corte: '+J([m.modo,m.corte]));
    ok(Math.abs(m.dst.y+m.dst.h-m.h)<=1&&m.dst.h<=.8*m.h+1&&m.dst.w<=.92*m.w+1&&Math.abs(cx-.45)<=.01,'8 '+n+': encostado embaixo, até 80% da altura e 92% da largura, centro em 45%: '+J({dst:m.dst,cx}));}
  // impressão: fundo de 5000 px, 1844×1240 sem aviso; o corte 10×15 tira o alto e o Cristo (topo em y=156 de 1711, x=2095, na prévia de 2400 px) fica inteiro no quadro
  const CRISTO={x:2095,y:156};
  const mh=await pg.evaluate(async([id,C,cena])=>{eval(cena);const r=await ETERNA.compHi(id,'mirantedia');if(!r.url)return r;const im=await carrega(r.url);const d=dados(tela(im));
    const hi=await carrega(r.fonte);const W=2400,H=W*hi.naturalHeight/hi.naturalWidth,sh=W*r.h/r.w,topo=H-sh,k=r.w/W;const px=(X,Y)=>{const i=(Math.round(Y)*d.width+Math.round(X))*4;return [d.data[i],d.data[i+1],d.data[i+2]];};
    return {w:r.w,h:r.h,av:r.avisos,fonte:r.fonte,hw:hi.naturalWidth,hh:hi.naturalHeight,pw:(await carrega('img/bg-mirantedia.jpg')).naturalHeight,topo,yc:(C.y-topo)*k,estatua:px(C.x*k,(C.y-topo+14)*k),ceu:px((C.x-120)*k,(C.y-topo-20)*k)};},[M1,CRISTO,cena]);
  ok(mh.w===1844&&mh.h===1240&&!(mh.av||[]).length&&mh.fonte==='img/fundos-5k/mirantedia.jpg'&&mh.hw===5000&&mh.hh===3565&&Math.abs(mh.hw/mh.hh-2400/mh.pw)<.002,'8: impressão 10×15 do Mirante do Rio com o fundo de 5000 px (mesma proporção da prévia), sem aviso: '+J(mh));
  ok(mh.topo<=CRISTO.y-40&&mh.yc>=30&&mh.estatua&&mh.ceu&&mh.estatua[2]-mh.estatua[0]<70&&mh.ceu[2]-mh.ceu[0]>90,'8: o Cristo inteiro dentro da impressão (topo a '+Math.round(mh.yc||0)+' px da borda de 1240): '+J(mh));

  // 9: Telão novo
  const te=await pg.evaluate(async([id,cena,grava])=>{eval(cena);const T=ETERNA.bgOf('telao');const r=await ETERNA.fiaMontar(id,'telao');if(!r.canvas)return r;const c=r.canvas;const pl=await carrega(T.file);
    const A=dados(c),B=dados(tela(pl));const k=c.width/T.telao.w;const q=T.telao.quad.map(([x,y])=>[x*k,y*k]);
    // distância com sinal a cada lado (positiva para dentro; cantos em ordem horária na tela)
    const dentro=(X,Y)=>Math.min(...q.map((p,i)=>{const n=q[(i+1)%4];const dx=n[0]-p[0],dy=n[1]-p[1];return (dx*(Y-p[1])-dy*(X-p[0]))/Math.hypot(dx,dy);}));
    let fora=0,pior=0,mud=0,nd=0;for(let Y=0;Y<c.height;Y+=5)for(let X=0;X<c.width;X+=5){const s=dentro(X,Y);const i=(Y*c.width+X)*4;const df=Math.max(Math.abs(A.data[i]-B.data[i]),Math.abs(A.data[i+1]-B.data[i+1]),Math.abs(A.data[i+2]-B.data[i+2]));
      if(s<-4){fora++;if(df>pior)pior=df;}else if(s>8){nd++;if(df>2)mud++;}}
    // a pessoa (magenta) dentro da tela, perto da base, a 30% da largura
    const bx=(q[2][0]+q[3][0])/2,by=(q[2][1]+q[3][1])/2,tx=(q[0][0]+q[1][0])/2,ty=(q[0][1]+q[1][1])/2;const lx=q[3][0]+(q[2][0]-q[3][0])*.3,ly=q[3][1]+(q[2][1]-q[3][1])*.3;
    const P=[Math.round(lx+(tx-bx)*.08),Math.round(ly+(ty-by)*.08)];const ip=(P[1]*c.width+P[0])*4;
    // magenta fora da tela seria a pessoa vazando para a moldura (o fiaWarp cobre até 2,5 px do filete escuro, de propósito; daí os 4 px)
    let vaza=0;for(let Y=0;Y<c.height;Y+=3)for(let X=0;X<c.width;X+=3){if(dentro(X,Y)>=-4)continue;const i=(Y*c.width+X)*4;if(A.data[i]>200&&A.data[i+2]>200&&A.data[i+1]<90)vaza++;}
    const L=r.layout;return {w:r.w,h:r.h,pw:pl.naturalWidth,ph:pl.naturalHeight,file:T.file,hi:T.fileHi,tw:T.telao.w,th:T.telao.h,quad:T.telao.quad,fora,pior,nd,mud,vaza,pc:[A.data[ip],A.data[ip+1],A.data[ip+2]],L:{modo:L.modo,tela:L.tela,dst:L.dst},
      png:grava?c.toDataURL('image/png'):null};},[M1,cena,!!RENDER]);
  ok(te.file==='img/bg-telao-v2.jpg'&&te.hi==='img/bg-telao-v2.jpg'&&te.tw===4096&&te.th===2924&&J(te.quad)===J([[884,181],[3485,525],[3582,1931],[848,1681]]),'9: Telão com o arquivo novo e os cantos medidos no original de 4096 px: '+J({f:te.file,q:te.quad}));
  ok(te.w===2576&&te.h===1839&&te.pw===2576&&te.ph===1839,'9: prévia do Telão em 2576×1839: '+J([te.w,te.h,te.pw,te.ph]));
  ok(te.fora>50000&&te.pior<=2,'9: fora do quadrilátero a foto fica igual ao arquivo (até 2 por canal; '+te.fora+' pontos): pior '+te.pior);
  ok(te.vaza===0,'9: a pessoa não passa para a moldura: '+te.vaza+' pontos');
  ok(te.pc&&te.pc[0]>180&&te.pc[2]>180&&te.pc[1]<120&&te.mud>te.nd*.2,'9: a pessoa aparece dentro da tela: '+J({pc:te.pc,mud:te.mud,nd:te.nd}));
  ok(te.L&&te.L.modo==='meio'&&Math.abs(te.L.dst.y+te.L.dst.h-te.L.tela.h)<=1&&te.L.dst.h<=.9*te.L.tela.h+1&&te.L.dst.w<=.9*te.L.tela.w+1,'9: do peito para cima, encostada embaixo da tela, com as margens da regra 17: '+J(te.L));
  const th=await pg.evaluate(async id=>{const r=await ETERNA.compHi(id,'telao');return {w:r.w,h:r.h,av:r.avisos,f:r.fonte};},M1);
  ok(th.w===1844&&th.h===1240&&!(th.av||[]).length&&th.f==='img/bg-telao-v2.jpg','9: impressão 10×15 do Telão sem aviso: '+J(th));

  // 10: Arquibancada 1950 toda em preto e branco (fundo e pessoa), na prévia e na impressão, com e sem `filter` no canvas
  const pb={};
  for(const sem of [false,true]){
    pb[sem]=await pg.evaluate(async([id,sem,cena,grava])=>{eval(cena);ETERNA.fiaSemFiltro(sem);const o={};
      const mede=(d,tol)=>{let pior=0,n=0,soma=0,rosa=0;for(let Y=3;Y<d.height;Y+=11)for(let X=3;X<d.width;X+=11){const i=(Y*d.width+X)*4;const r=d.data[i],g=d.data[i+1],b=d.data[i+2];const df=Math.max(r,g,b)-Math.min(r,g,b);if(df>pior)pior=df;n++;soma+=r;if(df>tol)rosa++;}return {pior,n,media:soma/n,cor:rosa};};
      const r=await ETERNA.fiaMontar(id,'arq1950');if(!r.canvas)return r;const d=dados(r.canvas);o.pre=mede(d,2);o.w=r.w;o.h=r.h;o.mono=r.layout.mono;
      // a pessoa está lá (camisa magenta vira cinza médio, diferente do fundo): ponto no meio do grupo
      const L=r.layout.dst;const i=(Math.round(L.y+L.h*.8)*d.width+Math.round(L.x+L.w*.25))*4;o.pessoa=[d.data[i],d.data[i+1],d.data[i+2]];
      const h=await ETERNA.compHi(id,'arq1950');if(!h.url)return {...o,hi:h};const im=await carrega(h.url);o.imp=mede(dados(tela(im)),4);o.iw=h.w;o.ih=h.h;o.av=h.avisos;
      if(grava)o.jpg=r.canvas.toDataURL('image/jpeg',.9);ETERNA.fiaSemFiltro(false);return o;},[M1,sem,cena,!!RENDER&&!sem]);
    const p=pb[sem],nome=sem?'sem filter (Safari, iPad)':'com filter';
    if(!p.pre||!p.imp){ok(false,'10 '+nome+': não montou: '+J(p).slice(0,300));continue;}
    ok(p.w===2400&&p.mono&&p.mono.contraste===1.1&&p.pre.n>20000&&p.pre.pior<=2&&p.pre.cor===0,'10 '+nome+': prévia do 1950 com R, G e B iguais em todo ponto (±2): '+J(p.pre));
    ok(p.iw===1844&&p.ih===1240&&!(p.av||[]).length&&p.imp.pior<=4&&p.imp.cor===0,'10 '+nome+': impressão do 1950 com R, G e B iguais (±4): '+J(p.imp));
    ok(p.pessoa&&p.pessoa[0]>40&&p.pessoa[0]<200,'10 '+nome+': a pessoa está na montagem, em cinza: '+J(p.pessoa));}
  if(pb[false].pre&&pb[true].pre)ok(Math.abs(pb[false].pre.media-pb[true].pre.media)<=3&&Math.abs(pb[false].pessoa[0]-pb[true].pessoa[0])<=6,'10: os dois caminhos dão o mesmo cinza: '+J([pb[false].pre.media,pb[true].pre.media,pb[false].pessoa,pb[true].pessoa]));
  const ff=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.fillStyle='#f0f';x.fillRect(0,0,2,2);ETERNA.fiaSemFiltro(true);const a=ETERNA.fiaPB(c).getContext('2d').getImageData(0,0,1,1).data;ETERNA.fiaSemFiltro(false);const b=ETERNA.fiaPB(c).getContext('2d').getImageData(0,0,1,1).data;return [Array.from(a),Array.from(b)];});
  ok(ff[0][0]===ff[0][1]&&ff[0][1]===ff[0][2]&&Math.abs(ff[0][0]-73)<=1&&Math.abs(ff[1][0]-ff[0][0])<=2&&ff[0][3]===255,'10: fiaPB ponto a ponto (0,2126 R + 0,7152 G + 0,0722 B) igual ao grayscale(1): '+J(ff));
  // os coloridos continuam coloridos
  const cor=await pg.evaluate(async id=>{const r=await ETERNA.fiaMontar(id,'mirantedia');const L=r.layout.dst;const d=r.canvas.getContext('2d').getImageData(Math.round(L.x+L.w*.25),Math.round(L.y+L.h*.8),1,1).data;return [d[0],d[1],d[2]];},M1);
  ok(cor[0]>200&&cor[2]>200&&cor[1]<90,'10: no Mirante a pessoa continua em cor: '+J(cor));

  // 11: montagem vendida antes com os fundos que saíram (e com o Telão) continua montando e imprimindo
  const ant=await pg.evaluate(async id=>{const o={pre:{}};for(const bg of ['campeao2','mirante','tunel','telao']){const r=await ETERNA.fiaMontar(id,bg);o.pre[bg]=r.canvas?[r.w,r.h]:r;}
    const res=await ETERNA.printMontar(['campeao2','mirante','tunel','telao'].map(bg=>({k:'ai:'+id+'|'+bg,t:'ai',id,bg})));const root=document.getElementById('print-root');
    o.imp={ok:res.ok.length,falhasIA:res.falhasIA,falhas:res.falhas,pgs:root?root.querySelectorAll('.pr-pg').length:0,fundos:root?[...root.querySelectorAll('img')].map(i=>i.dataset.fundo):[]};if(root)root.remove();document.body.classList.remove('pr-on');return o;},M1);
  ok(Object.values(ant.pre).every(v=>Array.isArray(v)&&v[0]>=2400),'11: prévia com os ids antigos: '+J(ant.pre));
  ok(ant.imp.ok===4&&!ant.imp.falhasIA.length&&!ant.imp.falhas.length&&ant.imp.pgs===4&&J(ant.imp.fundos)===J(['img/fundos-5k/campeao.jpg','img/fundos-5k/mirantesol.jpg','img/fundos-5k/tunel.jpg','img/bg-telao-v2.jpg']),'11: printMontar com |campeao2, |mirante, |tunel e |telao sem falhasIA: '+J(ant.imp));

  // montagens de conferência (critério 9: olhar os 4 cantos)
  if(RENDER){fs.mkdirSync(RENDER,{recursive:true});const b64=u=>Buffer.from(String(u).split(',')[1],'base64');
    fs.writeFileSync(path.join(RENDER,'telao-montagem.png'),b64(te.png));
    const mj=await pg.evaluate(async id=>(await ETERNA.fiaMontar(id,'mirantedia')).canvas.toDataURL('image/jpeg',.9),M1);fs.writeFileSync(path.join(RENDER,'mirante-do-rio-meio-corpo.jpg'),b64(mj));
    if(pb[false].jpg)fs.writeFileSync(path.join(RENDER,'arquibancada-1950-preto-e-branco.jpg'),b64(pb[false].jpg));
    execFileSync('python3',['-c',`
import sys
from PIL import Image,ImageChops
d=sys.argv[1];m=Image.open(d+'/telao-montagem.png').convert('RGB');p=Image.open(sys.argv[2]).convert('RGB')
k=m.width/4096.0;q=[(884,181),(3485,525),(3582,1931),(848,1681)]
df=ImageChops.difference(m,p).convert('L').point(lambda v:255 if v>2 else 0)
for i,(n,(x,y)) in enumerate(zip(('sup-esq','sup-dir','inf-dir','inf-esq'),q)):
    x=int(round(x*k));y=int(round(y*k));cx=(x-60,y-60,x+60,y+60)
    m.crop(cx).resize((480,480),Image.NEAREST).save(d+'/telao-canto-%d-%s.png'%(i+1,n))
    # o mesmo canto: em vermelho, todo ponto que mudou em relação ao arquivo do fundo
    a=p.crop(cx).resize((480,480),Image.NEAREST);v=Image.new('RGB',(480,480),(255,0,0));a.paste(v,(0,0),df.crop(cx).resize((480,480),Image.NEAREST).point(lambda t:110 if t else 0));a.save(d+'/telao-canto-%d-%s-mudou.png'%(i+1,n))
m.resize((1288,920),Image.LANCZOS).save(d+'/telao-montagem-1288.jpg',quality=88)`,RENDER,path.join(__dirname,'..','img','bg-telao-v2.jpg')]);}
  await ctx.close();

  // ================= B. com o servidor (agente falso): lista antiga no servidor e as 2 bases de IA =================
  const cb=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await cb.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const st={ok:true,agent:'eterna-agente',version:3,boot:'b3f',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
    sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'b3f',hoje:1,abertas:0,dias:1,visitas:{n:0,rev:0}}};
  await cb.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st)}));
  await cb.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await cb.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await cb.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b3f',rev:1,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await cb.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await cb.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:MINI}));
  await cb.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:MINI}));
  await cb.route(ORIG+'/recorte',recorte);
  await cb.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  await cb.route(ORIG+'/ponto/montagens',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"vistas":0}'}));
  await cb.route(ORIG+'/ponto/docs/revs',r=>{const revs={};for(const [c,m] of Object.entries(DOCS))revs[c]=Math.max(0,...Object.values(m).map(x=>x.rev));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,revs})});});
  await cb.route(ORIG+'/ponto/docs*',r=>{const q=r.request();if(q.method()==='POST'){let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}(j.docs||[]).forEach(d=>{POSTS.push(d);DOCS[d.col]=DOCS[d.col]||{};DOCS[d.col][d.id]={valor:d.valor,rev:++DREV};});return r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:DREV,gravados:(j.docs||[]).length,recusados:0})});}
    const col=new URL(q.url()).searchParams.get('col');const m=DOCS[col]||{};r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:Math.max(0,...Object.values(m).map(x=>x.rev)),docs:Object.entries(m).filter(([,x])=>x.valor!=null).map(([id,x])=>({id,valor:x.valor}))})});});
  const p2=await cb.newPage();p2.setDefaultTimeout(20000);p2.on('pageerror',e=>errs.push('servidor: '+e.message));
  await login(p2);
  // 4: a lista antiga do servidor chega (primeira leitura: o servidor vale por cima) e o Checkout segue com a trinca
  ok(await espera(p2,()=>Array.isArray(ETERNA.SIM.bgOn)&&ETERNA.SIM.bgOn.length===5,20000),'4: a lista antiga do servidor (sim/bgOn) chegou ao aparelho');
  ok(await espera(p2,c=>!!ETERNA.SIM.sessions[c]&&ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,20000,CARD),'6: a sessão do servidor chegou e o recorte está pronto');
  await p2.waitForTimeout(2500);   // tempo de o aparelho mandar o que quisesse mandar
  const s4=await p2.evaluate(()=>({on:ETERNA.bgOn(),mem:ETERNA.SIM.bgOn,mem2:ETERNA.SIM.bgOn2}));
  const mex=POSTS.filter(d=>d.col==='sim'&&/^(bgOn|bgOn2|bgPodioV86|bgTelaoV97)$/.test(d.id));
  ok(J(s4.on)===J(TRINCA)&&J(s4.mem)===J(ANTIGA)&&s4.mem2==null,'4: com o sim/bgOn antigo no servidor, o Checkout segue com a trinca: '+J(s4));
  ok(!mex.length&&J(DOCS.sim.bgOn.valor)===J(ANTIGA)&&DOCS.sim.bgOn2===undefined,'4: o aparelho não apaga nem troca o sim/bgOn do servidor (e não cria bgOn2): '+J(mex));
  // 6: sessão com 2 bases de IA: 3 montagens na ordem da trinca; 1950 com a 1ª base, as outras com a 2ª
  await p2.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);},[CARD,[...BASES,...FOTOS]]);
  const c6=await p2.evaluate(c=>({ai:ETERNA.lojaAI(c).map(x=>x.bg+'='+x.id+'#'+x.k),items:ETERNA.lojaItems(c).map(x=>x.t+':'+(x.bg||'')+':'+x.id)}),CARD);
  const [b1,b2]=BASES.map(x=>'ag_'+x);
  ok(J(c6.ai)===J(['mirantedia='+b2+'#ai:'+b2+'|mirantedia','arq1950='+b1+'#ai:'+b1+'|arq1950','telao='+b2+'#ai:'+b2+'|telao']),'6: 3 montagens na ordem Mirante do Rio, 1950, Telão; 1950 com a 1ª base: '+J(c6.ai));
  ok(c6.items.length===5&&J(c6.items.slice(0,3).map(x=>x.split(':')[1]))===J(TRINCA)&&c6.items.slice(3).every(x=>x.startsWith('ph:')),'6: no Checkout, as 3 montagens primeiro e depois as fotos (bases fora da venda): '+J(c6.items));
  // 12 no servidor: ligar e desligar manda sim/bgOn2 e nada em sim/bgOn
  await p2.evaluate(()=>ETERNA.go('catalogo'));await p2.waitForTimeout(200);await p2.click('#main [data-act="cat-tab"][data-t="fundos"]');await p2.waitForTimeout(200);
  await p2.click('#cat-fundos [data-act="bg-on"][data-id="arq1950"]');
  const t0=Date.now();while(Date.now()-t0<8000&&!POSTS.some(d=>d.col==='sim'&&d.id==='bgOn2'))await p2.waitForTimeout(150);
  const g12=POSTS.filter(d=>d.col==='sim'&&/^bgOn/.test(d.id));
  ok(g12.length>=1&&g12.every(d=>d.id==='bgOn2')&&J(g12[g12.length-1].valor)===J(['mirantedia','telao'])&&J(DOCS.sim.bgOn.valor)===J(ANTIGA),'12: desligar um fundo grava sim/bgOn2 no servidor e deixa o sim/bgOn como estava: '+J(g12));
  await cb.close();
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA tres-fundos: '+fails.join(' | '));process.exit(1);}
console.log('OK tres-fundos: trinca no Checkout (Mirante do Rio, 1950, Telão), lista em bgOn2 sem migração, antigos no Laboratório e ainda imprimindo, 1950 todo em preto e branco com e sem filter, Telão novo nos 4 cantos');})();
