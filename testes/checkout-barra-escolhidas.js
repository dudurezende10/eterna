// 17/11: barra das escolhidas na tela cheia do Checkout (plano da barra das escolhidas; Eduardo: monitor de toque 16:9, X de 48 px com Desfazer
// por 5 s, ordem de escolha, contador do topo mantido). Regra do Eduardo (17/11): a foto não encolhe com a barra e nada cobre mais da foto do que antes.
// Agente falso (page.route), como em selo-edicao.js: /status, /sessoes, /recorte, /thumb/, /file/. Só imagens geradas aqui (nunca foto de convidado).
// Contexto com toque (hasTouch). BARRA_PRINTS=<pasta> grava as capturas de 1920×1080 (coluna) e 1024×768 (faixa) com 8 escolhidas.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const PRINTS=process.env.BARRA_PRINTS||'';
const fails=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m);};const J=JSON.stringify;const notas={};
// 6 fotos deitadas (900×600), 2 em pé (600×900) e a pessoa recortada (PNG) para as montagens
const img=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
def foto(w,h,i):
    im=Image.new('RGB',(w,h),(40+i*25,90,160-i*15));d=ImageDraw.Draw(im);d.rectangle([0,0,w-1,h-1],outline=(255,255,255),width=6);d.ellipse([w*.4,h*.15,w*.6,h*.45],fill=(230,200,170));d.rectangle([w*.33,h*.47,w*.67,h],fill=(20+i*25,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
for i in range(6):foto(900,600,i)
for i in range(2):foto(600,900,i)
im=Image.new('RGBA',(900,600),(0,0,0,0));d=ImageDraw.Draw(im);d.ellipse([390,60,510,180],fill=(230,200,170,255));d.rectangle([330,180,570,600],fill=(40,80,140,255))
b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const PNG=img.pop();const DEITADA=img.slice(0,6),EMPE=img.slice(6);
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const BASES=['bas000000001','bas000000002'];const FOTOS=Array.from({length:14},(_,i)=>'pho'+String(i+1).padStart(9,'0'));
const VERT=new Set([FOTOS[4],FOTOS[9]]); // fotos em pé
const CARD='LPBARRA01';
const FEED=[{card:CARD,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:a-900,ultima_chegada:a-850,cap0:a-902,cap1:a-852,fonte_t:'cap',fechada_em:a-790,fechada_por:'pausa',
  fotos:[...BASES,...FOTOS],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:BASES.slice(),ia_regra:{n:2,motivo:null}}];
const imgDe=id=>VERT.has(id)?EMPE[FOTOS.indexOf(id)%2]:DEITADA[(id.charCodeAt(11)||0)%6];
const REQ={file:0,thumb:0};
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'b97',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'b97',hoje:1,abertas:0,dias:1,visitas:{n:0,rev:0}}});
const rota=async ctx=>{await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b97',rev:1,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/thumb/**',r=>{REQ.thumb++;r.fulfill({status:200,contentType:'image/jpeg',body:imgDe(r.request().url().split('/').pop())});});
  await ctx.route(ORIG+'/file/**',r=>{REQ.file++;r.fulfill({status:200,contentType:'image/jpeg',body:imgDe(r.request().url().split('/').pop())});});
  await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:200,contentType:'image/png',body:PNG}).catch(()=>{}));
  await ctx.route(ORIG+'/photoroom/**',r=>r.fulfill({status:409,contentType:'application/json',body:'{}'}));
  await ctx.route(ORIG+'/ponto/**',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});};
const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(120);}return false;};
// prepara a página: sessão do agente falso no SIM, fotos com /thumb/, montagens prontas
const prepara=async pg=>{await pg.goto(U+'#loja');
  if(!await espera(pg,c=>!!ETERNA.SIM.sessions[c],20000,CARD))throw new Error('a leva do servidor não chegou ao SIM');
  await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,10000);
  await pg.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.ljEdEsperaMs(600000);},[CARD,[...BASES,...FOTOS]]);
  await pg.evaluate(async c=>{for(const x of ETERNA.lojaItems(c).filter(x=>x.t==='ai'))await ETERNA.compose(x.id,x.bg);},CARD);};
const abrir=async pg=>{await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(100);await pg.fill('#kcode',CARD);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(250);};
const ver=async(pg,i)=>{await pg.evaluate(i=>{const el=document.createElement('button');el.dataset.act='kiosk-ver';el.dataset.i=String(i);document.body.appendChild(el);el.click();el.remove();},i);await pg.waitForTimeout(120);};
const marca=(pg,ks)=>pg.evaluate(ks=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);Object.keys(pk).forEach(x=>delete pk[x]);ks.forEach(x=>pk[x]='ok');ETERNA.lojaSync(k.code);ETERNA.render();},ks);
const B=pg=>pg.evaluate(()=>{const l=document.querySelector('#lj-esc .lj-esc-l');const vz=document.querySelector('#lj-esc .lj-esc-vz');const c=document.querySelector('#lj-esc .lj-esc-i.cur');
  return {ks:l?[...l.children].map(e=>e.dataset.k):null,h:(document.querySelector('#lj-esc .lj-esc-h')||{}).innerText||'',vz:!!vz&&!vz.hidden&&vz.getBoundingClientRect().height>0?vz.textContent:null,
    pill:(document.querySelector('#lj-lb .lj-cartpill b')||{}).textContent,pillOn:!!document.querySelector('#lj-lb .lj-cartpill.on'),next:(document.querySelector('#lj-lb .lj-ovnext')||{}).innerText||null,
    cur:c?c.dataset.k:null,curAria:c?c.querySelector('.lj-esc-v').getAttribute('aria-current'):null,nAria:document.querySelectorAll('#lj-esc [aria-current]').length,
    ver:ETERNA.state.kiosk.ver,cnt:(document.querySelector('#lj-lb .lj-lbcnt')||{}).textContent,desf:!!document.querySelector('#lj-esc .lj-esc-desf')};});
const xDe=(pg,k)=>pg.locator(`#lj-esc .lj-esc-i[data-k="${k}"] .lj-esc-x`);
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR',hasTouch:true});await rota(ctx);
  await ctx.addInitScript(()=>{Element.prototype.requestFullscreen=undefined;}); // a tela cheia do navegador (lojaTelaCheia) impediria trocar o tamanho da janela no teste
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await prepara(pg);
  const ITS=await pg.evaluate(c=>ETERNA.lojaItems(c).map(x=>({k:x.k,t:x.t,id:x.id,bg:x.bg})),CARD);const NI=ITS.length;
  ok(NI>=12&&ITS.filter(x=>x.t==='ai').length>=3,'sessão com 12 itens ou mais e montagens: '+NI);
  const iDe=id=>ITS.findIndex(x=>x.id==='ag_'+id&&x.t==='ph');
  await abrir(pg);

  // 3: sem escolha: barra visível, texto do vazio, zero miniaturas, sem Continuar
  let s=await B(pg);const r3=await pg.evaluate(()=>{const r=document.querySelector('#lj-esc').getBoundingClientRect();return {w:r.width,h:r.height};});
  ok(r3.w>0&&r3.h>0&&s.vz==='Suas fotos escolhidas aparecem aqui'&&s.ks.length===0&&!s.next,'3: sem escolha, barra com o vazio, sem miniatura e sem Continuar: '+J({r3,s}));

  // 1: 1920×1080 a barra à direita, sem sobrepor e sem rolagem do documento; 1024×768 e 390×844 embaixo
  const lado=()=>pg.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect();const lb=R('#lj-lb'),e=R('#lj-esc'),d=document.documentElement;
    return {lb:[lb.left,lb.top,lb.right,lb.bottom].map(Math.round),e:[e.left,e.top,e.right,e.bottom].map(Math.round),rola:d.scrollHeight>innerHeight+1||d.scrollWidth>innerWidth+1,W:innerWidth,H:innerHeight};});
  let l1=await lado();ok(l1.e[0]>=l1.lb[2]-1&&l1.e[2]<=l1.W+1&&l1.e[1]<=1&&l1.e[3]>=l1.H-1&&!l1.rola,'1: 1920×1080, barra à direita da foto, sem sobrepor e sem rolagem: '+J(l1));
  for(const [w,h] of [[1024,768],[390,844]]){await pg.setViewportSize({width:w,height:h});await pg.waitForTimeout(200);l1=await lado();
    ok(l1.e[1]>=l1.lb[3]-1&&l1.e[3]<=l1.H+1&&l1.e[0]<=1&&l1.e[2]>=l1.W-1&&!l1.rola,`1: ${w}×${h}, barra embaixo da foto: `+J(l1));}
  await pg.setViewportSize({width:1920,height:1080});await pg.waitForTimeout(200);

  // regra do Eduardo (17/11): a foto não encolhe com a barra (16:9, foto deitada 3:2 e em pé, ±1 px) e os controles não cobrem mais da foto do que antes.
  // "Sem a barra" = a mesma tela sem a classe lj-fs e sem o #lj-lb (o CSS de antes, intacto)
  const mede=()=>pg.evaluate(()=>{const fs=document.querySelector('.lj-fs');const e=document.querySelector('#lj-esc');const im=()=>document.querySelector('#lj-lb .lj-lbimg').getBoundingClientRect();
    const sels='#lj-lb .lj-ovtr,#lj-lb .lj-lbnav,#lj-lb .lj-lbcnt,#lj-lb .lj-ovtl .lj-ovlogo,#lj-lb .lj-ovnext,#lj-lb .lj-lbbar .lj-actions';
    const cobre=A=>[...document.querySelectorAll(sels)].map(x=>x.getBoundingClientRect()).reduce((t,r)=>t+Math.max(0,Math.min(r.right,A.right)-Math.max(r.left,A.left))*Math.max(0,Math.min(r.bottom,A.bottom)-Math.max(r.top,A.top)),0);
    const a=im();const ca=cobre(a);fs.classList.remove('lj-fs');e.style.display='none';const b=im();const cb=cobre(b);fs.classList.add('lj-fs');e.style.display='';
    return {com:[a.width,a.height].map(x=>+x.toFixed(1)),sem:[b.width,b.height].map(x=>+x.toFixed(1)),cobreCom:Math.round(ca),cobreSem:Math.round(cb),fit:document.querySelector('#lj-lb .lj-lbimg').classList.contains('fit')};});
  const iH=iDe(FOTOS[0]),iV=iDe(FOTOS[4]);await marca(pg,[ITS[2].k,ITS[5].k,ITS[iH].k,ITS[iV].k]); // com Continuar na tela
  notas.encolhe={};
  for(const [w,h] of [[1920,1080],[1366,768],[1280,720],[1024,768],[1920,1200],[390,844]]){await pg.setViewportSize({width:w,height:h});
    for(const [i,nome] of [[iH,'deitada'],[iV,'em pé']]){await ver(pg,i);await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg.fit'),5000);await pg.waitForTimeout(100);const m=await mede();
      const enc=+(100*(1-m.com[0]/m.sem[0])).toFixed(1);notas.encolhe[`${w}×${h} ${nome}`]=enc;
      if(Math.abs(w/h-16/9)<.01){ok(m.fit&&Math.abs(m.com[0]-m.sem[0])<=1&&Math.abs(m.com[1]-m.sem[1])<=1,`regra 17/11: ${w}×${h}, foto ${nome} do mesmo tamanho com e sem a barra: `+J(m));
        ok(m.cobreCom<=m.cobreSem+1,`regra 17/11: ${w}×${h}, foto ${nome}: os controles não cobrem mais da foto do que antes: `+J(m));}
      if(Math.abs(w/h-16/9)<.01&&nome==='deitada'){const c=await pg.evaluate(()=>{const R=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect():null;};const e=R('#lj-esc'),i=R('#lj-lb .lj-lbimg'),W=innerWidth;
          const dentro=r=>r&&((r.left>=e.left-1&&r.right<=W+1)||(r.right<=i.right+1&&r.left>=i.left-1));return {tr:dentro(R('#lj-lb .lj-ovtr')),nx:dentro(R('#lj-lb .lj-ovnext')),trR:R('#lj-lb .lj-ovtr').toJSON(),nxR:R('#lj-lb .lj-ovnext').toJSON(),e:e.left};});
        ok(c.tr&&c.nx,`regra 17/11: ${w}×${h}, o canto de cima e o Continuar inteiros (dentro da foto ou dentro da coluna), sem atravessar a borda: `+J(c));
        if(w===1920)notas.deitada1920=m;}
      else if(nome==='deitada'&&(w===1024||w===390))ok(Math.abs(m.com[0]-m.sem[0])<=1,`regra 17/11: ${w}×${h}, foto deitada sem encolher (a faixa usa a sobra de baixo): `+J(m));}}
  await pg.setViewportSize({width:1920,height:1080});await marca(pg,[]);await ver(pg,0);

  // 2: trocar de foto deitada para em pé não muda a barra
  await ver(pg,iH);const e2a=await pg.evaluate(()=>document.querySelector('#lj-esc').getBoundingClientRect().toJSON());await ver(pg,iV);const e2b=await pg.evaluate(()=>document.querySelector('#lj-esc').getBoundingClientRect().toJSON());
  ok(J(e2a)===J(e2b),'2: deitada para em pé, a barra não muda de lugar nem de tamanho: '+J({e2a,e2b}));

  // 4: marcar 10 com ✓, fora da ordem da galeria: 10 miniaturas na ordem em que foram marcadas, contador da barra e do topo
  const ORD=[iDe(FOTOS[5]),iDe(FOTOS[1]),0,iDe(FOTOS[8]),iDe(FOTOS[3]),2,iDe(FOTOS[11]),iDe(FOTOS[0]),iDe(FOTOS[6]),iV];
  for(const i of ORD){await ver(pg,i);await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(60);}
  s=await B(pg);const K10=ORD.map(i=>ITS[i].k);
  ok(J(s.ks)===J(K10)&&s.h==='10 fotos escolhidas'&&s.pill==='10'&&s.pillOn&&/Continuar · 10 fotos/.test(s.next||'')&&!s.vz,'4: 10 miniaturas na ordem de escolha, "10 fotos escolhidas" e 10 no topo: '+J(s));
  // 10/11/12: montagem pronta e contida, foto em pé inteira, só /thumb/
  const m10=await pg.evaluate(([kAi,kV])=>{const c=document.querySelector(`#lj-esc .lj-esc-i[data-k="${CSS.escape(kAi)}"] .compimg`);const key=kAi.slice(3);
    const v=document.querySelector(`#lj-esc .lj-esc-i[data-k="${CSS.escape(kV)}"] .lj-esc-img`);const urls=[];document.querySelectorAll('#lj-esc *').forEach(e=>{const bg=getComputedStyle(e).backgroundImage;(bg.match(/url\("?([^")]+)"?\)/g)||[]).forEach(u=>urls.push(u));});
    return {pronta:!!c&&c.classList.contains('ok')&&c.style.backgroundImage.includes(ETERNA.COMPURL[key]),bsAi:c&&getComputedStyle(c).backgroundSize,bsV:v&&getComputedStyle(v).backgroundSize,
      file:urls.filter(u=>u.includes('/file/')),fotos:urls.filter(u=>u.includes(location.origin)&&!u.includes("/img/")&&!u.includes("blob:")),n:urls.length};},[ITS[0].k,ITS[iV].k]);
  ok(m10.pronta&&m10.bsAi==='contain'&&/^ai:ag_bas\d+\|\w+$/.test(ITS[0].k),'10: montagem escolhida com a montagem pronta (COMPURL), contida, chave ai:<foto>|<fundo>: '+J(m10));
  ok(m10.bsV==='contain','11: foto em pé inteira na miniatura (contain): '+m10.bsV);
  ok(!m10.file.length&&m10.fotos.length===8&&m10.fotos.every(u=>u.includes('/thumb/')),'12: na barra só /thumb/, nunca /file/: '+J(m10));
  // 14: alvos de toque
  const m14=await pg.evaluate(()=>{const R=e=>e.getBoundingClientRect();const cs=[...document.querySelectorAll('#lj-esc .lj-esc-i')].map(R);
    const x=[...document.querySelectorAll('#lj-esc .lj-esc-x')].map(R),v=[...document.querySelectorAll('#lj-esc .lj-esc-v')].map(R);
    let gap=1e9;cs.forEach(a=>cs.forEach(b=>{if(a===b)return;if(Math.abs(a.top-b.top)<1&&b.left>a.left)gap=Math.min(gap,b.left-a.right);if(Math.abs(a.left-b.left)<1&&b.top>a.top)gap=Math.min(gap,b.top-a.bottom);}));
    const peq=[...document.querySelectorAll('.lj button')].filter(e=>{const r=R(e);return r.width>0&&!e.classList.contains('lj-esc-x')&&getComputedStyle(e).visibility!=='hidden'&&(r.width<71.5||r.height<71.5);}).map(e=>e.className+':'+e.dataset.act);
    return {xMin:Math.min(...x.map(r=>Math.min(r.width,r.height))),vMin:Math.min(...v.map(r=>Math.min(r.width,r.height))),gap:+gap.toFixed(1),peq};});
  ok(m14.xMin>=48&&m14.vMin>=72&&m14.gap>=7.5&&!m14.peq.length,'14: X ≥ 48 px, miniatura ≥ 72 px, 8 px entre células, nenhum outro botão abaixo de 72: '+J(m14));
  // 24: sem barra de rolagem visível, pan-y na coluna
  const m24=await pg.evaluate(()=>{const l=document.querySelector('#lj-esc .lj-esc-l');const s=getComputedStyle(l);return {sb:l.offsetWidth-l.clientWidth,ta:s.touchAction,sw:s.scrollbarWidth};});
  ok(m24.sb===0&&m24.ta==='pan-y'&&m24.sw==='none','24: coluna sem barra de rolagem visível e com pan-y: '+J(m24));
  // 16: idioma: a barra muda de língua sem recriar as miniaturas
  await pg.evaluate(()=>{document.querySelectorAll('#lj-esc .lj-esc-i').forEach(e=>{e.__no=e.dataset.k;});window.__nos=[...document.querySelectorAll('#lj-esc .lj-esc-i')];});
  await pg.evaluate(()=>{ETERNA.state.lang='en';ETERNA.render();});await pg.waitForTimeout(100);
  const m16=await pg.evaluate(()=>({h:document.querySelector('#lj-esc .lj-esc-h').innerText,x:document.querySelector('#lj-esc .lj-esc-x').getAttribute('aria-label'),al:document.querySelector('#lj-esc').getAttribute('aria-label'),mesmos:[...document.querySelectorAll('#lj-esc .lj-esc-i')].every((e,i)=>e===window.__nos[i])}));
  ok(m16.h==='10 photos chosen'&&m16.x==='Remove photo 1 from your chosen photos'&&m16.al==='Chosen photos'&&m16.mesmos,'16: inglês na barra, com os mesmos nós: '+J(m16));
  const textos=await pg.evaluate(()=>{const ks=['ljEscLista','ljEscVazio','ljEscTirada','ljEscDesfazer'];const o=[];for(const l of ['pt','en','es','fr','de']){ETERNA.state.lang=l;ks.forEach(k=>o.push(ETERNA.T(k)));o.push(ETERNA.T('ljEscVer',3),ETERNA.T('ljEscTirar',3));}ETERNA.state.lang='pt';ETERNA.render();return o;});
  ok(textos.length===30&&textos.every(t=>t&&!/[—–]/.test(t)&&!/caixa/i.test(t)&&!/^lj/.test(t)),'16: textos da barra nas 5 línguas, sem travessão e sem "caixa": '+J(textos));

  // 8: tocar numa miniatura leva a tela cheia para aquela foto, com .cur e aria-current; as setas movem o .cur
  const k8=K10[3],i8=ITS.findIndex(x=>x.k===k8);
  await pg.click(`#lj-esc .lj-esc-i[data-k="${k8}"] .lj-esc-v`);await pg.waitForTimeout(120);s=await B(pg);
  ok(s.ver===i8&&s.cnt===`${i8+1} / ${NI}`&&s.cur===k8&&s.curAria==='true'&&s.nAria===1,'8: a miniatura leva àquela foto, com .cur e aria-current: '+J(s));
  await pg.click('#lj-lb .lj-lbnav.next');await pg.waitForTimeout(120);s=await B(pg);const sNext=s;
  await pg.click('#lj-lb .lj-lbnav.prev');await pg.waitForTimeout(120);s=await B(pg);
  ok(sNext.ver===i8+1&&sNext.cur===(K10.includes(ITS[i8+1].k)?ITS[i8+1].k:null)&&s.ver===i8&&s.cur===k8,'8: as setas movem o .cur: '+J({sNext,s}));
  // 9: depois do redesenho inteiro (setas), as células são as mesmas
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#lj-esc .lj-esc-i')].every((e,i)=>e===window.__nos[i])&&window.__nos.every(e=>e.isConnected)),'9: depois das setas, as mesmas células (sem recriar)');

  // 5: o exemplo do Eduardo: com 10, tirar 2 (uma pelo X, outra pelo ✓ da foto em exibição): 8 na hora, sem render, sem baixar foto
  const k5x=K10[6],k5v=K10[1];await ver(pg,ITS.findIndex(x=>x.k===k5v));await pg.waitForTimeout(400);
  const req0={...REQ};const nReq=[];const onReq=q=>{if(/\/(file|thumb)\//.test(q.url()))nReq.push(q.url());};pg.on('request',onReq);
  const m5=await pg.evaluate(([kx])=>{const l=document.querySelector('#lj-esc .lj-esc-l');const antes=[...l.children];const im=document.querySelector('#lj-lb .lj-lbimg');im.__marca=1;
    let mut=0;const mo=new MutationObserver(r=>{mut+=r.length;});mo.observe(document.getElementById('main'),{childList:true});
    const t=performance.now();document.querySelector(`#lj-esc .lj-esc-i[data-k="${CSS.escape(kx)}"] .lj-esc-x`).click();document.querySelector('#lj-lb [data-act="kiosk-ok"]').click();const dt=performance.now()-t;
    mut+=mo.takeRecords().length;mo.disconnect();const fica=[...l.children];const im2=document.querySelector('#lj-lb .lj-lbimg');
    return {dt:+dt.toFixed(1),n:fica.length,h:document.querySelector('#lj-esc .lj-esc-h .lj-esc-n').textContent,pill:document.querySelector('#lj-lb .lj-cartpill b').textContent,mesmaFoto:im2===im&&im2.__marca===1,mut,
      mesmos:fica.every(e=>antes.includes(e)),yes:document.querySelector('#lj-lb .lj-yes').classList.contains('on'),next:(document.querySelector('#lj-lb .lj-ovnext')||{}).innerText};},[k5x]);
  await pg.waitForTimeout(400);pg.off('request',onReq);
  ok(m5.n===8&&m5.h==='8 fotos escolhidas'&&m5.pill==='8'&&m5.dt<300&&/8 fotos/.test(m5.next||''),'5: com 10, tirar 2 deixa 8 na barra e no topo em menos de 300 ms: '+J(m5));
  ok(m5.mesmaFoto&&m5.mut===0&&m5.mesmos&&!m5.yes,'5: sem render (#main intacto), mesma foto grande, as 8 que ficaram são os mesmos nós, ✓ apagado: '+J(m5));
  ok(REQ.file===req0.file&&REQ.thumb===req0.thumb&&!nReq.length,'5: nenhum pedido novo a /file/ nem a /thumb/: '+J({req0,REQ,nReq}));
  const K8=(await B(pg)).ks;ok(J(K8)===J(K10.filter(k=>k!==k5x&&k!==k5v)),'5: as 8 na mesma ordem: '+J(K8));
  // o pick e o pedido seguem a barra (aiSel/selected do SIM)
  const sim5=await pg.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {sel:s.selected.length+s.aiSel.length};},CARD);ok(sim5.sel===8,'5: o SIM ficou com 8 escolhidas: '+J(sim5));

  // 6: tirar pelo X a foto em exibição: ✓ apaga, a foto grande (e a marca d'água, que desde 17/11 fica sempre) não é trocada
  const k6=K8[0];await ver(pg,ITS.findIndex(x=>x.k===k6));await pg.waitForTimeout(450);
  await pg.evaluate(()=>{const im=document.querySelector('#lj-lb .lj-lbimg');im.__marca=6;});const y6=await pg.evaluate(()=>document.querySelector('#lj-lb .lj-yes').classList.contains('on'));
  await xDe(pg,k6).click();await pg.waitForTimeout(100);
  const m6=await pg.evaluate(()=>{const im=document.querySelector('#lj-lb .lj-lbimg');return {mesma:im.__marca===6,wm:!!im.querySelector('.wm'),yes:document.querySelector('#lj-lb .lj-yes').classList.contains('on'),cur:!!document.querySelector('#lj-esc .lj-esc-i.cur')};});
  ok(y6&&!m6.yes&&m6.mesma&&m6.wm&&!m6.cur,'6: X na foto em exibição apaga o ✓ sem trocar a foto grande: '+J({y6,m6}));
  // 10: tirar uma montagem pelo X tira do aiSel
  await pg.waitForTimeout(450);const kAi=K8.find(k=>/^ai:/.test(k));await xDe(pg,kAi).click();await pg.waitForTimeout(100);
  const m10b=await pg.evaluate(([c,k])=>ETERNA.SIM.sessions[c].aiSel.includes(k.slice(3)),[CARD,kAi]);ok(!m10b,'10: a montagem tirada pelo X sai do aiSel');

  // 22: Desfazer: devolve a foto na mesma posição; sem toque, some em 5 s (no teste, 0,8 s) e a foto fica fora; a foto grande não muda
  await pg.waitForTimeout(450);const k22a=(await B(pg)).ks;const k22=k22a[2];
  await pg.evaluate(()=>{document.querySelector('#lj-lb .lj-lbimg').__marca=22;});await xDe(pg,k22).click();await pg.waitForTimeout(100);
  const d1=await pg.evaluate(()=>{const b=document.querySelector('#lj-esc .lj-esc-desf');const r=b&&b.getBoundingClientRect();return {txt:document.querySelector('#lj-esc .lj-esc-h').innerText,h:r&&r.height,w:r&&r.width,foco:document.activeElement===b};});
  ok(/Foto tirada/.test(d1.txt)&&/Desfazer/.test(d1.txt)&&d1.h>=72&&d1.w>=72,'22: "Foto tirada" e Desfazer de 72 px: '+J(d1));
  await pg.click('#lj-esc .lj-esc-desf');await pg.waitForTimeout(100);s=await B(pg);
  const mf22=await pg.evaluate(()=>document.querySelector('#lj-lb .lj-lbimg').__marca===22);
  ok(J(s.ks)===J(k22a)&&s.h===`${k22a.length} fotos escolhidas`&&!s.desf&&mf22,'22: Desfazer devolve na mesma posição e o contador volta, sem trocar a foto grande: '+J(s));
  await pg.evaluate(()=>ETERNA.ljDesfMs(800));await pg.waitForTimeout(450);await xDe(pg,k22).click();await pg.waitForTimeout(100);ok((await B(pg)).desf,'22: o Desfazer aparece de novo');
  await pg.waitForTimeout(1100);s=await B(pg);
  ok(!s.desf&&!s.ks.includes(k22)&&s.ks.length===k22a.length-1&&await pg.evaluate(()=>document.querySelector('#lj-lb .lj-lbimg').__marca===22),'22: sem toque o Desfazer some e a foto fica fora: '+J(s));
  await pg.evaluate(()=>ETERNA.ljDesfMs(5000));

  // 7: tirada e marcada de novo volta no fim; tirar todas: vazio e sem Continuar; marcar de novo: volta
  await pg.waitForTimeout(450);let k7=(await B(pg)).ks;const kv=k7[0];await xDe(pg,kv).click();await pg.waitForTimeout(100);await ver(pg,ITS.findIndex(x=>x.k===kv));await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(100);
  s=await B(pg);ok(J(s.ks)===J([...k7.slice(1),kv]),'7: tirada e marcada de novo, volta no fim da ordem: '+J({antes:k7,s:s.ks}));
  for(const k of s.ks){await pg.waitForTimeout(430);await xDe(pg,k).click();}await pg.waitForTimeout(100);s=await B(pg);
  ok(s.ks.length===0&&s.vz==='Suas fotos escolhidas aparecem aqui'&&!s.next&&!s.pillOn,'7: tirando a última: vazio e o Continuar some: '+J(s));
  await ver(pg,iDe(FOTOS[2]));await pg.click('#lj-lb [data-act="kiosk-ok"]');await pg.waitForTimeout(100);s=await B(pg);
  ok(s.ks.length===1&&s.ks[0]==='ag_'+FOTOS[2]&&/Continuar · 1 foto/.test(s.next||''),'7: marcar de novo põe a miniatura e o Continuar: '+J(s));

  // 15: teclado: Enter na miniatura navega; Enter no X tira e não marca a foto em exibição
  await marca(pg,K10);await ver(pg,0);await pg.waitForTimeout(450);
  await pg.focus(`#lj-esc .lj-esc-i[data-k="${K10[4]}"] .lj-esc-v`);await pg.keyboard.press('Enter');await pg.waitForTimeout(120);s=await B(pg);
  ok(s.ver===ITS.findIndex(x=>x.k===K10[4])&&s.ks.length===10,'15: Enter na miniatura vai para a foto e não marca nada: '+J(s));
  await pg.focus(`#lj-esc .lj-esc-i[data-k="${K10[5]}"] .lj-esc-x`);await pg.keyboard.press('Enter');await pg.waitForTimeout(120);s=await B(pg);
  const pk15=await pg.evaluate(k=>ETERNA.lojaPick(ETERNA.state.kiosk.code)[k],K10[4]);
  ok(s.ks.length===9&&!s.ks.includes(K10[5])&&pk15==='ok','15: Enter no X tira aquela e não mexe na foto em exibição: '+J({s,pk15}));
  const a15=await pg.evaluate(()=>({sem:[...document.querySelectorAll('#lj-esc button')].filter(b=>!b.getAttribute('aria-label')&&!b.innerText.trim()).length,st:document.querySelector('#lj-esc .lj-esc-h').getAttribute('role')}));
  ok(a15.sem===0&&a15.st==='status','15: todos os botões com nome e contador em role=status: '+J(a15));

  // 20/21: toque, sem passar o mouse: o X sempre visível; tap tira; dois taps em 150 ms tiram uma só
  await marca(pg,K10);await pg.waitForTimeout(450);
  const v20=await pg.evaluate(()=>[...document.querySelectorAll('#lj-esc .lj-esc-x')].map(x=>{const s=getComputedStyle(x),i=getComputedStyle(x.querySelector('.lj-esc-xc'));return +s.opacity===1&&s.visibility==='visible'&&+i.opacity===1&&s.display!=='none';}));
  ok(v20.length===10&&v20.every(Boolean),'20: o X de toda miniatura visível sem hover: '+J(v20));
  const cX=k=>pg.evaluate(k=>{const r=document.querySelector(`#lj-esc .lj-esc-i[data-k="${CSS.escape(k)}"] .lj-esc-x .lj-esc-xc`).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},k);
  let p=await cX(K10[2]);await pg.touchscreen.tap(p.x,p.y);await pg.waitForTimeout(150);s=await B(pg);
  ok(s.ks.length===9&&!s.ks.includes(K10[2]),'20: tap no X tira a foto: '+J(s.ks));
  await pg.waitForTimeout(450);p=await cX(K10[1]);await pg.touchscreen.tap(p.x,p.y);await pg.waitForTimeout(150);await pg.touchscreen.tap(p.x,p.y);await pg.waitForTimeout(150);s=await B(pg);
  ok(s.ks.length===8&&!s.ks.includes(K10[1]),'21: dois taps no mesmo ponto em 150 ms tiram uma foto só: '+J(s.ks));
  // 25: rolar ou tocar a barra conta como cliente presente
  const t25=await pg.evaluate(()=>{ETERNA.state.kiosk.toque=1;return 1;});const bx=await pg.evaluate(()=>{const r=document.querySelector('#lj-esc .lj-esc-l').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+40};});
  await pg.mouse.move(bx.x,bx.y);await pg.mouse.wheel(0,200);await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.kiosk.toque>1e12),'25: rolar a barra renova o toque do cliente');

  // 9 e 24 na faixa (1024×768): a rolagem da faixa sobrevive ao redesenho inteiro; pan-x
  await marca(pg,K10);await pg.setViewportSize({width:1024,height:768});await ver(pg,ITS.findIndex(x=>!K10.includes(x.k)));await pg.waitForTimeout(250);
  const m9=await pg.evaluate(()=>{const l=document.querySelector('#lj-esc .lj-esc-l');l.style.scrollBehavior='auto';l.scrollLeft=100;l.style.scrollBehavior='';window.__nos=[...l.children];const s=getComputedStyle(l);return {sl:l.scrollLeft,max:l.scrollWidth-l.clientWidth,ta:s.touchAction,sb:l.offsetHeight-l.clientHeight};});
  await pg.click('#lj-lb .lj-lbnav.next');await pg.waitForTimeout(200);
  const m9b=await pg.evaluate(()=>{const l=document.querySelector('#lj-esc .lj-esc-l');return {sl:l.scrollLeft,mesmos:[...l.children].every((e,i)=>e===window.__nos[i])};});
  ok(m9.max>100&&m9.sl===100&&Math.abs(m9b.sl-100)<=2&&m9b.mesmos,'9: na faixa, a rolagem e as células ficam depois das setas: '+J({m9,m9b}));
  ok(m9.ta==='pan-x'&&m9.sb===0,'24: faixa com pan-x e sem barra de rolagem: '+J(m9));
  await pg.setViewportSize({width:1920,height:1080});await pg.waitForTimeout(150);

  // 18: Continuar com as da barra: o pedido grava as mesmas; "Voltar às fotos" reabre com elas
  const kb=(await B(pg)).ks;await pg.evaluate(()=>ETERNA.lojaPedir());await pg.waitForTimeout(400);
  const p18=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[ETERNA.SIM.caixaDin.length-1];return {n:r.n,ks:[...r.selected,...r.aiSel.map(x=>'ai:'+x)].sort(),step:ETERNA.state.kiosk.step};});
  ok(p18.n===kb.length&&J(p18.ks)===J(kb.slice().sort()),'18: o pedido grava as mesmas escolhidas da barra: '+J({p18,kb}));
  await pg.click('[data-act="kiosk-voltar-fotos"]').catch(()=>{});await pg.waitForTimeout(300);
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;if(k.ver==null){k.ver=0;k.i=0;ETERNA.render();}});await pg.waitForTimeout(150);s=await B(pg);
  ok(J(s.ks.slice().sort())===J(kb.slice().sort()),'18: "Voltar às fotos" reabre com as mesmas na barra: '+J(s.ks));

  // 19: Sair, escolha parada e novo cliente com o mesmo código: a barra começa vazia, nada do anterior
  await marca(pg,K10);await pg.evaluate(()=>{document.querySelector('#lj-esc').__velho=1;});
  await pg.evaluate(()=>ETERNA.lojaSairCli(true));await pg.waitForTimeout(200);await abrir(pg);s=await B(pg);
  ok(s.ks.length===0&&s.vz&&await pg.evaluate(()=>!document.querySelector('#lj-esc').__velho),'19: depois do Sair, o cliente seguinte (mesmo código) vê a barra vazia, em outro nó: '+J(s));
  await marca(pg,K10);await pg.evaluate(()=>{ETERNA.lojaEscolhaMs(1);ETERNA.state.kiosk.toque=0;ETERNA.state.kiosk.escolhaDesde=1;ETERNA.lojaEscolhaOciosa();ETERNA.lojaEscolhaMs(90000);});await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step==='code'&&!document.querySelector('#lj-esc')),'19: escolha parada volta ao início sem a barra');
  await abrir(pg);s=await B(pg);ok(s.ks.length===0&&s.vz,'19: depois da escolha parada, a barra começa vazia: '+J(s));
  await marca(pg,K10.slice(0,3));await pg.waitForTimeout(450);await xDe(pg,K10[0]).click();await pg.waitForTimeout(80);
  await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await abrir(pg);s=await B(pg);
  ok(s.ks.length===0&&!s.desf,'19: o Desfazer de um cliente não aparece para o seguinte: '+J(s));
  await pg.close();

  // capturas para o Eduardo (deviceScaleFactor 2): 8 escolhidas, com 2 montagens, coluna em 1920×1080 e faixa em 1024×768
  if(PRINTS){fs.mkdirSync(PRINTS,{recursive:true});
    // a mesma foto deitada (3:2) em 1920×1080 com a barra e, para comparar, com a tela de antes (sem a classe lj-fs e sem a barra)
    {const c2=await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2,locale:'pt-BR',hasTouch:true});await rota(c2);await c2.addInitScript(()=>{Element.prototype.requestFullscreen=undefined;});
      const p2=await c2.newPage();p2.on('pageerror',e=>errs.push('print: '+e.message));await prepara(p2);await abrir(p2);
      await marca(p2,[ITS[0].k,ITS[1].k,...[1,2,4,5,7,9].map(j=>ITS[iDe(FOTOS[j])].k)]);await ver(p2,iDe(FOTOS[0]));
      await espera(p2,()=>document.querySelectorAll('#lj-esc .compimg.ok').length>=2&&!!document.querySelector('#lj-lb .lj-lbimg.fit'),8000);await p2.waitForTimeout(600);
      const med=await p2.evaluate(()=>{const r=()=>{const x=document.querySelector('#lj-lb .lj-lbimg').getBoundingClientRect();return {x:+x.left.toFixed(1),y:+x.top.toFixed(1),w:+x.width.toFixed(1),h:+x.height.toFixed(1)};};const a=r();
        const fs=document.querySelector('.lj-fs'),e=document.querySelector('#lj-esc');fs.classList.remove('lj-fs');e.style.display='none';const b=r();fs.classList.add('lj-fs');e.style.display='';return {comBarra:a,semBarra:b};});
      notas.captura1920=med;await p2.screenshot({path:path.join(PRINTS,'barra-1920x1080-foto-deitada.png')});
      // um redesenho no meio (sessões do agente) devolveria a classe: o observador tira de novo até a captura
      await p2.evaluate(()=>{const tira=()=>{const f=document.querySelector('.lj-fs');if(f)f.classList.remove('lj-fs');const e=document.querySelector('#lj-esc');if(e&&e.style.display!=='none')e.style.display='none';};tira();new MutationObserver(tira).observe(document.getElementById('main'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});});await p2.waitForTimeout(200);
      await p2.screenshot({path:path.join(PRINTS,'barra-1920x1080-foto-deitada-sem-barra-comparacao.png')});await c2.close();}
    for(const [w,h,nome] of [[1920,1080,'barra-1920x1080-coluna.png'],[1024,768,'barra-1024x768-faixa.png']]){
      const c2=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,locale:'pt-BR',hasTouch:true});await rota(c2);await c2.addInitScript(()=>{Element.prototype.requestFullscreen=undefined;});
      const p2=await c2.newPage();p2.on('pageerror',e=>errs.push('print: '+e.message));await prepara(p2);await abrir(p2);
      const ks=[ITS[0].k,ITS[1].k,...[0,2,4,5,7,9].map(j=>ITS[iDe(FOTOS[j])].k)];await marca(p2,ks);await ver(p2,iDe(FOTOS[3]));
      await espera(p2,()=>document.querySelectorAll('#lj-esc .compimg.ok').length>=2&&!!document.querySelector('#lj-lb .lj-lbimg.fit'),8000);await p2.waitForTimeout(600);
      await p2.screenshot({path:path.join(PRINTS,nome)});await c2.close();}}
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA checkout-barra-escolhidas: '+fails.join(' | ')+' · '+J(notas));process.exit(1);}
console.log(`OK checkout-barra-escolhidas: ${n} verificações (critérios 1 a 12, 14 a 16, 18 a 22, 24 e 25 do plano; foto do mesmo tamanho com a barra em 16:9) · foto encolhida (%): `+J(notas.encolhe)+' · 1920×1080 deitada: '+J(notas.deitada1920)+(notas.captura1920?' · captura: '+J(notas.captura1920):''));})();
