// v97 (plano docs/planos/2026-11-11-selo-edicao-maracana.md): selo "Edição Maracanã" nas montagens de IA. Checkout com as
// montagens no início, juntas, com título na grade, selo e nome do fundo; abertura na 1ª montagem pronta e espera de 8 s (no teste,
// ljEdEsperaMs); âncora da tela; vistas contadas na tela cheia e mandadas ao servidor do ponto; Posto e eco com o selo; Estatísticas.
// Agente falso (page.route), como em visitas-checkout.js: /status, /sessoes, /recorte (com espera por base, para segurar a montagem),
// /thumb/, /file/, /rostos/buscar, /ponto/eventos, /ponto/montagens. Só imagens geradas aqui (nunca foto de convidado).
// SELO_PRINTS=<pasta> grava os prints de 1920 do início do Checkout (tela cheia na 1ª montagem e a grade).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const PRINTS=process.env.SELO_PRINTS||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const notas={};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(6):
    im=Image.new('RGB',(900,600),(40+i*30,90,160-i*20));d=ImageDraw.Draw(im);d.ellipse([360,90,540,270],fill=(230,200,170));d.rectangle([300,280,600,600],fill=(20+i*30,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGBA',(900,600),(0,0,0,0));d=ImageDraw.Draw(im);d.ellipse([390,60,510,180],fill=(230,200,170,255));d.rectangle([330,180,570,600],fill=(40,80,140,255))
b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const PNG=cores.pop();
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const BASES=['bas000000001','bas000000002'];const FOTOS=Array.from({length:6},(_,i)=>'pho'+String(i+1).padStart(9,'0'));
const CARD='LPSELO001';
const FEED=[{card:CARD,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:a-900,ultima_chegada:a-850,cap0:a-902,cap1:a-852,fonte_t:'cap',fechada_em:a-790,fechada_por:'pausa',
  fotos:[...BASES,...FOTOS],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:BASES.slice(),ia_regra:{n:2,motivo:null}}];
// ordem dos fundos ativos (BG_DEF) e a base de cada um (FIA_BASE: arq1950 usa a 1ª, os outros a 2ª)
const ORDEM=['campeao2','mirante','arq1950','tunel','telao'];const BASE_DE=bg=>bg==='arq1950'?BASES[0]:BASES[1];
const NOMES={pt:['Noite de campeão','Mirante ao pôr do sol','Arquibancada 1950','Saída do túnel','Telão do Maracanã'],en:["Champions' night",'Lookout at sunset','1950 Stands','Out of the tunnel','Maracanã big screen'],
  es:['Noche de campeón','Mirador al atardecer','Tribuna de 1950','Salida del túnel','Pantalla gigante del Maracanã'],fr:['Nuit de champion','Belvédère au coucher du soleil','Tribunes de 1950','Sortie du tunnel','Écran géant du Maracanã'],
  de:['Meisternacht','Aussichtspunkt bei Sonnenuntergang','Tribüne 1950','Aus dem Spielertunnel','Maracanã-Großbildleinwand']};
const SELO={pt:'Edição Maracanã',en:'Maracanã Edition',es:'Edición Maracanã',fr:'Édition Maracanã',de:'Maracanã-Edition'};
const TIT={pt:'Suas fotos especiais',en:'Your special photos',es:'Tus fotos especiales',fr:'Vos photos spéciales',de:'Ihre besonderen Fotos'};
const SEP={pt:'Suas fotos de hoje',en:'Your photos from today',es:'Tus fotos de hoy',fr:'Vos photos du jour',de:'Ihre Fotos von heute'};
let REC_OK=true;const HOLD=new Set();let ESPERA=[];const MONT={fora:true,posts:[],x:[]};
const solta=pid=>{HOLD.delete(pid);const w=ESPERA;ESPERA=[];w.forEach(f=>f());};
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'b97',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:REC_OK,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'b97',hoje:1,abertas:0,dias:1,visitas:{n:0,rev:0}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'b97',rev:1,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(4)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(4)%cores.length]});});
  await ctx.route(ORIG+'/recorte',async r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}while(HOLD.has(q.pid))await new Promise(f=>ESPERA.push(f));r.fulfill({status:200,contentType:'image/png',body:PNG}).catch(()=>{});});
  await ctx.route(ORIG+'/photoroom/**',r=>{fails.push('fetch ao Photoroom: '+r.request().url());r.fulfill({status:409,contentType:'application/json',body:'{}'});});
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:J({rosto:true,fotos:FOTOS.slice(0,3).map(id=>({id,sim:.7}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  await ctx.route(ORIG+'/ponto/montagens',r=>{const q=r.request();if(MONT.fora)return r.abort();let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}MONT.posts.push(j);MONT.x.push(q.headers()['x-eterna']);
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,vistas:j.vistas})});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('checkout: '+e.message));
  await pg.goto(U+'#loja');
  const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(120);}return false;};
  ok(await espera(pg,c=>!!ETERNA.SIM.sessions[c],20000,CARD),'a leva do servidor chegou ao SIM');
  ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,10000),'agente com o recorte pronto');
  await pg.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.ljEdEsperaMs(1500);ETERNA.edEnviaMs(150,400);},[CARD,[...BASES,...FOTOS]]);
  const abrir=async()=>{await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(120);await pg.fill('#kcode',CARD);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(200);};
  const K=()=>pg.evaluate(()=>{const k=ETERNA.state.kiosk;const its=ETERNA.lojaItems(k.code);const x=its[k.ver];return {ver:k.ver,i:k.i,k:x&&x.k,t:x&&x.t,n:its.length,cnt:(document.querySelector('.lj-lbcnt')||{}).innerText};});
  const vistas=()=>pg.evaluate(()=>{const L=ETERNA.edLer();return Object.values(L.dias).reduce((s,n)=>s+n,0);});
  const ver=async i=>{await pg.evaluate(i=>{const el=document.createElement('button');el.dataset.act='kiosk-ver';el.dataset.i=String(i);document.body.appendChild(el);el.click();el.remove();},i);await pg.waitForTimeout(150);};

  // 1: ordem fixa: as 5 montagens na ordem de bgOn, depois as 6 fotos comuns
  const ord=await pg.evaluate(c=>ETERNA.lojaItems(c).map(x=>x.t==='ai'?'ai:'+x.bg+':'+x.id.slice(3):'ph:'+x.id.slice(3)),CARD);
  ok(J(ord)===J([...ORDEM.map(bg=>'ai:'+bg+':'+BASE_DE(bg)),...FOTOS.map(id=>'ph:'+id)]),'1: montagens primeiro, na ordem de bgOn, e as 6 fotos depois: '+J(ord));
  const its0=await pg.evaluate(c=>ETERNA.lojaItems(c).map(x=>({k:x.k,lb:x.lb||null,edIni:!!x.edIni,edFotos:!!x.edFotos})),CARD);
  ok(its0[0].edIni&&its0.filter(x=>x.edIni).length===1&&its0[5].edFotos&&its0.filter(x=>x.edFotos).length===1&&its0.every(x=>!x.lb),'1/A8: marcas edIni e edFotos e montagem sem "ponto · hora": '+J(its0));

  // 3/4: nenhuma montagem pronta (as duas bases seguras no recorte): abre na 1ª montagem, com o "Preparando" e o selo
  BASES.forEach(x=>HOLD.add(x));
  await abrir();let k=await K();
  const prep=await pg.evaluate(()=>({mk:!!document.querySelector('#lj-lb .lj-lbimg.ai .lj-aimk'),ed:(document.querySelector('#lj-lb .lj-lbimg.ai .lj-ed')||{}).textContent,nm:(document.querySelector('#lj-lb .lj-edn')||{}).textContent}));
  ok(k.ver===0&&k.t==='ai'&&prep.mk&&/edição maracanã/i.test(prep.ed||'')&&prep.nm==='Noite de campeão','3: em preparo, abre na 1ª montagem com o Preparando, o selo e o nome do fundo: '+J({k,prep}));
  ok(await vistas()===0,'15: montagem em preparo não conta como vista');
  await pg.waitForTimeout(2000);k=await K();
  ok(k.ver===5&&k.t==='ph'&&k.k==='ag_'+FOTOS[0],'4: sem montagem pronta e sem toque, depois da espera a tela vai para a 1ª foto comum: '+J(k));
  // 4: com um toque antes da espera, a tela não anda sozinha
  await abrir();await pg.mouse.move(960,540);await pg.mouse.down();await pg.mouse.up();await pg.waitForTimeout(2000);k=await K();
  ok(k.ver===0&&k.t==='ai','4: com um toque antes da espera, a tela fica na montagem: '+J(k));
  // 4: a Arquibancada 1950 (1ª base) fica pronta durante a espera: a tela vai para ela (a 1ª montagem pronta)
  // (a espera do teste fica longa e o fim dela é chamado à mão depois que a montagem ficou pronta: o tempo da montagem no navegador varia)
  await pg.evaluate(()=>ETERNA.ljEdEsperaMs(600000));await abrir();solta(BASES[0]);await pg.evaluate(id=>ETERNA.compose(id,'arq1950'),'ag_'+BASES[0]);
  k=await K();ok(k.ver===0,'4: antes da espera, a tela fica na montagem em preparo: '+J(k));
  await pg.evaluate(()=>{ETERNA.lojaEdEspera(ETERNA.state.kiosk.edAbriu);ETERNA.ljEdEsperaMs(1500);});await pg.waitForTimeout(200);k=await K();
  ok(k.ver===2&&k.k==='ai:ag_'+BASES[0]+'|arq1950','4: depois da espera, a tela vai para a 1ª montagem pronta: '+J(k));
  const v0=await vistas();ok(v0===1,'15: a montagem pronta que apareceu na tela cheia conta 1: '+v0);
  // 3: a montagem fica pronta com o cliente olhando: mesmo item, sem redesenhar a tela
  await ver(0);await pg.evaluate(()=>{document.querySelector('#lj-lb').dataset.marca='1';});solta(BASES[1]);
  ok(await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg.ai .compimg.ok'),15000),'3: a montagem aparece quando fica pronta');
  const p3=await pg.evaluate(()=>({marca:(document.querySelector('#lj-lb')||{dataset:{}}).dataset.marca,ar:getComputedStyle(document.querySelector('#lj-lb .lj-lbimg.ai')).getPropertyValue('--ar').trim(),ed:!!document.querySelector('#lj-lb .lj-ed')}));
  k=await K();ok(k.ver===0&&p3.marca==='1'&&p3.ed&&+p3.ar>1,'3: no mesmo lugar, sem redesenhar, com o selo e a proporção da montagem: '+J({k,p3}));
  ok(await vistas()===v0+1,'15: a montagem que ficou pronta na tela conta (compHydrate): '+(await vistas()));
  // todas prontas (o resto das montagens)
  await pg.evaluate(async([its])=>{for(const x of its)await ETERNA.compose(x[0],x[1]);},[ORDEM.map(bg=>['ag_'+BASE_DE(bg),bg])]);

  // 2: com as montagens prontas, o código e a selfie abrem na 1ª montagem, com o selo e o nome do fundo
  await abrir();k=await K();
  const p2=await pg.evaluate(()=>({ed:(document.querySelector('#lj-lb .lj-ed')||{}).textContent,nm:(document.querySelector('#lj-lb .lj-edn')||{}).textContent,lb:!!document.querySelector('#lj-lb .lj-lbsrc:not(.lj-edn)')}));
  ok(k.ver===0&&k.t==='ai'&&/edição maracanã/i.test(p2.ed||'')&&p2.nm==='Noite de campeão'&&!p2.lb,'2: o código abre na 1ª montagem com selo e nome do fundo (sem ponto · hora): '+J({k,p2}));
  const sf=await pg.evaluate(async()=>{ETERNA.lojaReset();const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>!x.demo);ETERNA.lojaJuntar(r.res,r.talvez,r.sims);await new Promise(f=>setTimeout(f,150));const k=ETERNA.state.kiosk;const its=ETERNA.lojaItems(k.code);return {code:k.code,ver:k.ver,t:its[k.ver]&&its[k.ver].t,step:k.step};});
  ok(sf.code===CARD&&sf.ver===0&&sf.t==='ai','2: a selfie abre na 1ª montagem: '+J(sf));

  // 15: vista uma vez por atendimento e por montagem; a grade não conta; outro atendimento conta de novo
  await abrir();let c0=await vistas();await ver(1);await ver(0);await ver(1);await ver(0);
  ok(await vistas()===c0+1,'15: a 1ª montagem (já contada na abertura) e a 2ª, vistas 3 vezes cada, somam 1 a mais: '+J({c0,c1:await vistas()}));
  await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});await pg.waitForTimeout(300);
  ok(await vistas()===c0+1,'15: a grade não conta');
  await abrir();ok(await vistas()===c0+2,'15: outro atendimento conta de novo: '+(await vistas()));
  // 16: fora do Checkout (#loja) nada é contado
  const f16=await pg.evaluate(()=>{const r=ETERNA.state.lojaRota;ETERNA.state.lojaRota=false;const x=ETERNA.edVista('ai:qualquer|tunel');ETERNA.state.lojaRota=r;return x;});
  ok(f16===false,'16: fora do #loja, edVista não conta');
  // 17: agente fora: guarda no navegador; de volta, manda o total (o mesmo número, sem contar duas vezes)
  await pg.waitForTimeout(700);const tot=await vistas();ok(MONT.posts.length===0&&tot>0,'17: agente fora, nada chega e o total fica no navegador: '+tot);
  MONT.fora=false;await pg.evaluate(()=>ETERNA.edVistasEnviar());
  ok(MONT.posts.length>=1&&MONT.posts[MONT.posts.length-1].vistas===tot&&MONT.x.every(x=>x==='1')&&/^[a-z0-9]{12}$/.test(MONT.posts[0].terminal)&&Object.keys(MONT.posts[0]).sort().join()==='dia,terminal,vistas','17: com o agente de volta, manda o total, com X-Eterna e só dia, terminal e vistas: '+J(MONT.posts));
  const n17=MONT.posts.length;await pg.evaluate(()=>ETERNA.edVistasEnviar());ok(MONT.posts.length===n17+1&&MONT.posts[n17].vistas===tot,'17: o envio repetido manda o mesmo total');
  const ls=await pg.evaluate(()=>({t:localStorage.getItem('eterna.terminal.v1'),v:JSON.parse(localStorage.getItem('eterna.edvistas.v1'))}));
  ok(ls.v&&ls.v.terminal===ls.t&&Object.keys(ls.v).sort().join()==='dias,terminal','17: localStorage só com o terminal e o número por dia: '+J(ls));

  // 5: âncora: na 3ª foto comum, a 2ª montagem falha; a tela fica na mesma foto e as marcas ficam
  await abrir();await ver(7);await pg.evaluate(id=>{const k=ETERNA.state.kiosk;ETERNA.lojaPick(k.code)[id]='ok';ETERNA.lojaSync(k.code);ETERNA.render();},'ag_'+FOTOS[2]);
  // (com uma base ruim o fundo usa a outra base; as duas ruins tiram o Mirante da lista)
  let a5=await K();await pg.evaluate(ks=>ks.forEach(k=>ETERNA.fiaFalhou(k)),BASES.map(x=>'ag_'+x+'|mirante'));await pg.waitForTimeout(200);let b5=await K();
  const pk5=await pg.evaluate(id=>ETERNA.lojaPick(ETERNA.state.kiosk.code)[id],'ag_'+FOTOS[2]);
  ok(a5.k==='ag_'+FOTOS[2]&&b5.k===a5.k&&b5.n===10&&b5.cnt==='7 / 10'&&pk5==='ok','5: montagem falhou: a mesma foto na tela, contador ajustado e a marca fica: '+J({a5,b5,pk5}));
  await pg.evaluate(ks=>{ks.forEach(k=>ETERNA.FIA_RUIM.delete(k));ETERNA.render();},BASES.map(x=>'ag_'+x+'|mirante'));await pg.waitForTimeout(150);const c5=await K();
  ok(c5.k===a5.k&&c5.n===11&&c5.cnt==='8 / 11','5: montagem nova no início: a mesma foto continua na tela: '+J(c5));
  await ver(8);const d5=await K();ok(d5.k==='ag_'+FOTOS[3],'5: as setas continuam andando um item: '+J(d5));
  await pg.evaluate(id=>{const k=ETERNA.state.kiosk;delete ETERNA.lojaPick(k.code)[id];ETERNA.lojaSync(k.code);},'ag_'+FOTOS[2]);

  // 7/8: grade e as 5 línguas
  for(const lg of ['pt','en','es','fr','de']){
    await abrir();await pg.evaluate(lg=>{ETERNA.state.lang=lg;ETERNA.render();},lg);await pg.waitForTimeout(150);
    const fs1=await pg.evaluate(()=>({ed:(document.querySelector('#lj-lb .lj-ed')||{}).textContent,nm:(document.querySelector('#lj-lb .lj-edn')||{}).textContent}));
    await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});await pg.waitForTimeout(150);
    const g=await pg.evaluate(()=>{const grid=document.querySelector('.lj-grid');const kids=[...grid.children];const iH=kids.findIndex(x=>x.classList.contains('lj-edh'));const iC=kids.findIndex(x=>x.classList.contains('lj-gcard'));
      const iS=kids.findIndex(x=>x.classList.contains('lj-edfotos'));const cards=[...grid.querySelectorAll('.lj-gcard')];const i6=kids.indexOf(cards[5]);
      return {iH,iC,iS,i6,eb:(grid.querySelector('.lj-edeb')||{}).textContent,h3:(grid.querySelector('.lj-edh h3')||{}).textContent,sep:(grid.querySelector('.lj-edfotos')||{}).textContent,
        tags:cards.slice(0,5).map(c=>(c.querySelector('.lj-tag')||{}).textContent.trim()),eds:cards.map(c=>!!c.querySelector('.lj-ed')),txt:document.querySelector('.lj').innerText};});
    ok(fs1.ed===SELO[lg]&&fs1.nm===NOMES[lg][0],'8 '+lg+': selo e nome do fundo na tela cheia: '+J(fs1));
    ok(g.iH===0&&g.iC===1&&g.eb===SELO[lg]&&g.h3===TIT[lg]&&g.sep===SEP[lg]&&g.iS===g.i6-1&&J(g.tags)===J(NOMES[lg])&&J(g.eds)===J([true,true,true,true,true,false,false,false,false,false,false]),'7/8 '+lg+': grade com o título, o selo nas 5 montagens, o nome do fundo e o separador: '+J({...g,txt:undefined}));
    ok(!/[—–]/.test(fs1.ed+fs1.nm+g.eb+g.h3+g.sep+g.tags.join(''))&&!/\bed(Selo|Titulo|Fotos)\b|\bbg(Arq1950|Mirante|Campeao|Tunel|Podio)\b/.test(g.txt),'8 '+lg+': sem travessão e sem chave crua');}
  await pg.evaluate(()=>{ETERNA.state.lang='pt';ETERNA.render();});

  // 9: selo no canto da imagem, dentro dela, sem encostar no logo nem nos controles, em 4 tamanhos
  for(const [w,h] of [[1280,800],[1920,1080],[820,1180],[390,844]]){
    await pg.setViewportSize({width:w,height:h});await abrir();await espera(pg,()=>!!document.querySelector('#lj-lb .compimg.ok'),8000);await pg.waitForTimeout(200);
    const r=await pg.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,r:b.right,b:b.bottom,w:b.width,h:b.height};};const ed=document.querySelector('#lj-lb .lj-ed');
      return {img:R('#lj-lb .lj-lbimg.ai'),ed:R('#lj-lb .lj-ed'),logo:R('#lj-lb .lj-ovtl .lj-ovlogo'),tl:R('#lj-lb .lj-ovtl'),tr:R('#lj-lb .lj-ovtr'),nm:R('#lj-lb .lj-edn'),corte:ed&&ed.scrollWidth>ed.clientWidth+1,fs:ed&&parseFloat(getComputedStyle(ed).fontSize),lh:ed&&parseFloat(getComputedStyle(ed).lineHeight)};});
    const dentro=(x,y)=>x&&y&&x.x>=y.x-1&&x.y>=y.y-1&&x.r<=y.r+1&&x.b<=y.b+1;const cruza=(x,y)=>x&&y&&x.x<y.r&&y.x<x.r&&x.y<y.b&&y.y<x.b;
    ok(dentro(r.ed,r.img)&&dentro(r.nm,r.img)&&!cruza(r.ed,r.logo)&&!cruza(r.ed,r.tl)&&!cruza(r.ed,r.tr)&&!r.corte&&r.ed.h<r.fs*2.6&&r.ed.y-r.img.y<2,'9 '+w+'×'+h+': selo no canto de cima da imagem, sem encostar no logo nem nos controles, sem quebra: '+J(r));
    if(PRINTS&&w===1920){fs.mkdirSync(PRINTS,{recursive:true});await pg.screenshot({path:path.join(PRINTS,'checkout-1920-tela-cheia-1a-montagem.png')});
      await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});await espera(pg,()=>document.querySelectorAll('.lj-gimg .compimg.ok').length>=5,8000);await pg.waitForTimeout(300);
      await pg.screenshot({path:path.join(PRINTS,'checkout-1920-grade-inicio.png')});
      await pg.evaluate(()=>{ETERNA.state.kiosk.ver=2;ETERNA.state.kiosk.i=2;ETERNA.render();});await espera(pg,()=>!!document.querySelector('#lj-lb .compimg.ok'),8000);await pg.waitForTimeout(300);
      await pg.screenshot({path:path.join(PRINTS,'checkout-1920-tela-cheia-arquibancada.png')});}
  }
  await pg.setViewportSize({width:1920,height:1080});

  // 12 (eco): o Posto vê o selo na montagem que o cliente olha
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push('posto: '+e.message));pg2.on('dialog',d=>d.accept());await pg2.setViewportSize({width:1600,height:1000});
  await require('./_login.js')(pg2);await pg2.evaluate(()=>{localStorage.removeItem('eterna.session');ETERNA.go('posto');});await pg2.waitForTimeout(400);
  await abrir();await ver(0);
  ok(await espera(pg2,()=>!!document.querySelector('#eco .eco-big .eco-ed'),8000),'12: eco da tela do cliente com o selo na montagem atual');
  const eco=await pg2.evaluate(()=>{const e=document.querySelector('#eco .eco-big .eco-ed');return e&&{t:e.textContent,title:e.title,tag:!!document.querySelector('#eco .eco-tag')};});
  ok(eco&&eco.t==='Edição Maracanã'&&eco.title==='Noite de campeão'&&!eco.tag,'12: eco com "Edição Maracanã" e o nome do fundo no title: '+J(eco));
  // 11: marcar 2 montagens e 3 fotos: o pedido tem as mesmas fotos, aiSel, n e valor (só a ordem mudou)
  const esc11=['ai:ag_'+BASES[1]+'|campeao2','ai:ag_'+BASES[0]+'|arq1950','ag_'+FOTOS[0],'ag_'+FOTOS[1],'ag_'+FOTOS[2]];
  await pg.evaluate(ks=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);ks.forEach(x=>pk[x]='ok');ETERNA.lojaSync(k.code);const c=ETERNA.lojaCart(k.code);ETERNA.lojaPedir();window.__c11=c;return true;},esc11);
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'&&(ETERNA.SIM.caixaDin||[]).length>0,8000),'11: pedido feito no Checkout');
  const ped=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;const c=window.__c11;const r=ETERNA.SIM.caixaDin[0];const v=ETERNA.vendaCalc(5,c.nSes,'gramado');return {n:r.n,sel:(r.selected||[]).slice().sort(),ai:(r.aiSel||[]).slice().sort(),nSes:r.nSes,cn:c.n,cnSes:c.nSes,ch:c.ch.map(x=>x.t),v:v.total,id:r.id,step:k.step};});
  ok(ped.n===5&&J(ped.sel)===J(esc11.slice(2).sort())&&J(ped.ai)===J([BASES[1]+'|campeao2',BASES[0]+'|arq1950'].map(x=>'ag_'+x).sort())&&ped.cn===5&&ped.cnSes===8&&J(ped.ch)===J(['ai','ai','ph','ph','ph'])&&ped.v===150&&ped.step==='done','11: pedido com as mesmas fotos, aiSel, n e valor; Ver minhas fotos com as montagens primeiro: '+J(ped));
  // 12: no Posto, cada miniatura de montagem do pedido tem o selo e o nome do fundo no title
  await pg2.evaluate(()=>{ETERNA.simFresh();ETERNA.go('posto');});await pg2.waitForTimeout(600);
  const p12=await pg2.evaluate(id=>{const el=document.querySelector(`[data-pend="${id}"]`);if(!el)return null;return [...el.querySelectorAll('.pend-th.ai')].map(t=>({ed:(t.querySelector('.lj-ed')||{}).textContent,title:(t.querySelector('.laibadge')||{}).title,corte:(()=>{const e=t.querySelector('.lj-ed');return e?e.scrollWidth>e.clientWidth+1:true;})()}));},ped.id);
  ok(p12&&p12.length===2&&p12.every(x=>x.ed==='Edição Maracanã'&&!x.corte)&&J(p12.map(x=>x.title).sort())===J(['Arquibancada 1950','Noite de campeão']),'12: miniaturas de montagem do pedido com o selo e o nome do fundo: '+J(p12));
  if(PRINTS)await pg2.locator(`[data-pend="${ped.id}"]`).screenshot({path:path.join(PRINTS,'posto-pedido-com-selo.png'),timeout:5000}).catch(()=>{});
  // o caixa escolhe o pacote no Posto: o Checkout mostra o valor e o "Ver minhas fotos"
  await pg2.evaluate(id=>ETERNA.pendEscolher(id,{pkg:'gramado',meio:'pix'}),ped.id);
  ok(await espera(pg,()=>!!document.querySelector('[data-act="kiosk-minhas"]'),12000),'10: o Checkout mostra "Ver minhas fotos" depois do pacote');
  // 10: Ver minhas fotos: as montagens primeiro, com o selo inteiro
  await pg.click('[data-act="kiosk-minhas"]').catch(e=>fails.push('10: sem o botão Ver minhas fotos'));await pg.waitForTimeout(300);
  const m10=await pg.evaluate(()=>[...document.querySelectorAll('.lj-mth')].map(b=>{const e=b.querySelector('.lj-ed');const im=b.querySelector('.lj-mimg').getBoundingClientRect();const r=e&&e.getBoundingClientRect();return {ai:!!b.querySelector('.lj-mimg.ai'),ed:!!e,corte:e?e.scrollWidth>e.clientWidth+1||r.right>im.right+1||r.x<im.x-1:false,h:r&&r.height,fs:e&&parseFloat(getComputedStyle(e).fontSize)};}));
  ok(m10.length===5&&J(m10.map(x=>x.ai))===J([true,true,false,false,false])&&m10.every(x=>x.ed===x.ai&&!x.corte&&(!x.ed||x.h<x.fs*2.6)),'10: Ver minhas fotos com as montagens primeiro e o selo inteiro: '+J(m10));
  if(PRINTS)await pg.screenshot({path:path.join(PRINTS,'checkout-1920-ver-minhas-fotos.png')});
  await pg2.close();

  // 6: nenhuma montagem (agente sem recorte): sem selo, título nem separador; abre na 1ª foto, como na v96
  REC_OK=false;ok(await espera(pg,()=>!ETERNA.state.agent.recorte.ok,12000),'6: o agente ficou sem recorte');
  await abrir();k=await K();
  const p6=await pg.evaluate(()=>({ed:document.querySelectorAll('.lj-ed').length}));await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});await pg.waitForTimeout(150);
  const g6=await pg.evaluate(()=>({ed:document.querySelectorAll('.lj-ed').length,h:document.querySelectorAll('.lj-edh,.lj-edfotos').length,n:document.querySelectorAll('.lj-gcard').length}));
  ok(k.ver===0&&k.t==='ph'&&k.n===6&&p6.ed===0&&g6.ed===0&&g6.h===0&&g6.n===6,'6: sem montagem: sem selo, título nem separador, abre na 1ª foto: '+J({k,p6,g6}));
  REC_OK=true;

  // 18: Estatísticas (Admin): tabela por dia, "sem registro" antes da versão, total e taxa
  const p18=await pg.evaluate(()=>{const D=ETERNA.esDados([{dia:'2026-11-09',v:2,vendas:3,faturamento:300},{dia:'2026-11-10',v:2,vendas:4,faturamento:400,montagens:{vistas:40,compradas:10}},{dia:'2026-11-11',v:2,vendas:1,faturamento:100,montagens:{vistas:10,compradas:0}}]);
    const h=ETERNA.esEdPainel(D);const d=document.createElement('div');d.innerHTML=h;return {h2:d.querySelector('h2').textContent,linhas:[...d.querySelectorAll('tbody tr')].map(t=>[...t.children].map(c=>c.textContent))};});
  ok(/Edição Maracanã: montagens vistas × compradas/.test(p18.h2)&&J(p18.linhas)===J([['11/11/2026','10','0','0%'],['10/11/2026','40','10','25%'],['09/11/2026','sem registro'],['Total do período','50','10','20%']]),'18: painel por dia com vistas, compradas, taxa, "sem registro" e total: '+J(p18));
  const pe=await b.newPage();pe.on('pageerror',e=>errs.push('estatisticas: '+e.message));await require('./_login.js')(pe);
  const e18=await pe.evaluate(async()=>{ETERNA.go('estatisticas');await new Promise(f=>setTimeout(f,600));return {view:ETERNA.state.view,tem:!!document.querySelector('.es-ed'),canSup:(()=>{const v=ETERNA.MODULE_OF.estatisticas;return v;})()};});
  ok(e18.view==='estatisticas'&&e18.tem,'18: o Admin vê o painel nas Estatísticas: '+J(e18));
  await pe.close();
  await pg.close();
  const pi=await ctx.newPage();pi.on('pageerror',e=>errs.push('impressao: '+e.message));await pi.goto(U);
  ok(await espera(pi,()=>ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,12000),'13: agente na página da impressão');
  // 13/14: impressão: nada de selo no #print-root
  const p13=await pi.evaluate(async([b0,b1])=>{await ETERNA.printMontar([{k:'ai:'+b1+'|campeao2',t:'ai',id:b1,bg:'campeao2'},{k:'ai:'+b0+'|arq1950',t:'ai',id:b0,bg:'arq1950'}]);const r=document.getElementById('print-root');const o={tem:!!r,ed:r?r.querySelectorAll('.lj-ed,.eco-ed,.lj-edn').length:-1,txt:r?r.innerText:''};if(r)r.remove();document.body.classList.remove('pr-on');return o;},['ag_'+BASES[0],'ag_'+BASES[1]]);
  ok(p13.tem&&p13.ed===0&&!/Edição/.test(p13.txt),'13: impressão sem o selo nem o nome do fundo: '+J(p13));
  await pi.close();
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA selo-edicao: '+fails.join(' | ')+' · '+J(notas));process.exit(1);}
console.log('OK selo-edicao: critérios 1 a 18 do plano do selo Edição Maracanã (ordem, abertura, espera, âncora, grade, 5 línguas, posição, Ver minhas fotos, pedido, Posto, impressão, vistas, Estatísticas)');})();
