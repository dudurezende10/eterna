// Correção de 15/11 (plano docs/planos/2026-11-15-biblioteca-fotos-inteiras.md): em Minhas fotos, na Qualidade e no zoom a foto real
// aparece inteira (vertical e horizontal), e as setas do zoom da Biblioteca percorrem a lista da tela, atravessando sessões, e param no fim.
// Agente falso por page.route na própria origem. As fotos são desenhadas aqui (fundo liso, um boneco e uma moldura magenta nas 4 bordas):
// a moldura medida no print da tela diz se alguma borda foi cortada. Nunca foto de cliente.
// BIB_PRINTS=<pasta> guarda 3 prints 1920x1080 (Biblioteca, zoom de uma vertical, zoom da primeira foto com a seta).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');
const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const PRINTS=process.env.BIB_PRINTS||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-bib-'));
// 4 imagens: miniatura e original, horizontal (3:2) e vertical (2:3), como o agente entrega (até 900 px e o arquivo inteiro)
const IMG=(()=>{const out=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for w,h in ((600,400),(400,600),(1500,1000),(1000,1500)):
    im=Image.new('RGB',(w,h),(40,90,160));d=ImageDraw.Draw(im);m=round(min(w,h)*.07)
    for k in range(m):d.rectangle([k,k,w-1-k,h-1-k],outline=(255,0,255))
    r=min(w,h)*.13;d.ellipse([w/2-r,m*1.4,w/2+r,m*1.4+2*r],fill=(235,200,170));d.rectangle([w/2-r*1.5,m*1.4+2*r,w/2+r*1.5,h-m*1.4],fill=(250,250,245))
    b=io.BytesIO();im.save(b,'JPEG',quality=92);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
  return {thumb:{h:out[0],v:out[1]},file:{h:out[2],v:out[3]}};})();
// mede a moldura magenta num print: caixa que ela ocupa e a espessura dela em cada lado (0 = borda cortada), medida fora do
// centro e dos cantos de cima, onde ficam a seta do zoom, a hora e a lupa
const MEDIR=`
import sys,json
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB');W,H=im.size;px=im.load()
mg=lambda x,y:(lambda p:p[0]>190 and p[1]<110 and p[2]>190)(px[x,y])
xs=[x for x in range(W) if any(mg(x,y) for y in range(0,H,2))];ys=[y for y in range(H) if any(mg(x,y) for x in range(0,W,2))]
if not xs or not ys:print(json.dumps({'w':0,'h':0}));sys.exit()
x0,x1,y0,y1=xs[0],xs[-1],ys[0],ys[-1];cx=x0+round((x1-x0)*.62);cy=y0+round((y1-y0)*.85)
def run(pts):
    n=0
    for x,y in pts:
        if not mg(x,y):break
        n+=1
    return n
print(json.dumps({'x':x0,'y':y0,'w':x1-x0+1,'h':y1-y0+1,'W':W,'H':H,'cima':run((cx,y) for y in range(y0,y1)),'baixo':run((cx,y) for y in range(y1,y0,-1)),'esq':run((x,cy) for x in range(x0,x1)),'dir':run((x,cy) for x in range(x1,x0,-1))}))`;
let nPng=0;const medir=buf=>{const f=path.join(TMP,'m'+(++nPng)+'.png');fs.writeFileSync(f,buf);return JSON.parse(execFileSync('python3',['-c',MEDIR,f]).toString());};
// foto inteira: a moldura tem a proporção natural da foto e aparece nos 4 lados com a mesma espessura
const inteira=(m,ar)=>m.w>0&&Math.abs(m.w/m.h-ar)<0.04&&Math.min(m.cima,m.baixo,m.esq,m.dir)>=2&&Math.max(m.cima,m.baixo,m.esq,m.dir)-Math.min(m.cima,m.baixo,m.esq,m.dir)<=2;
const AR={h:1.5,v:2/3};
const agora=Date.now()/1000;const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
// 3 sessões e uma foto solta. A mais nova (LPBIBA1) tem uma foto só: era o caso da primeira miniatura sem seta.
const F=[['b1b000000001','v','carlos',40,'LPBIBA1'],['b1b000000002','h','carlos',400,'LPBIBB2'],['b1b000000003','v','carlos',410,'LPBIBB2'],['b1b000000004','h','carlos',420,'LPBIBB2'],
  ['b1b000000005','v','samuel',900,'LPBIBC3'],['b1b000000006','h','samuel',910,'LPBIBC3'],['b1b000000007','v','carlos',1500,null]]
  .map(([id,o,quem,ha,card])=>({id,o,quem,t:agora-ha,card}));
const OR=Object.fromEntries(F.map(f=>[f.id,f.o]));
const daLib=f=>({id:f.id,name:'T_'+f.id+'.JPG',day:hoje,t:f.t,cap:0,size:1000,origem:f.quem,via:'ftp',serie:'',autor:'',dono:''});
const LIB={fotos:F.map(daLib)};
// o /file/ de teste conta cada pedido e pode responder como o agente no limite (429) ou sem o arquivo (404)
const ARQ={modo:'ok',pedidos:[]};const pedidosDe=id=>ARQ.pedidos.filter(x=>x===id).length;
const SESS=['LPBIBA1','LPBIBB2','LPBIBC3'].map((card,i)=>{const fs_=F.filter(f=>f.card===card).sort((a,b)=>a.t-b.t);return {card,dia:hoje,fotografo:fs_[0].quem,fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:fs_[0].t,ultima_chegada:fs_[fs_.length-1].t,cap0:fs_[0].t,cap1:fs_[fs_.length-1].t,fonte_t:'cap',fechada_em:fs_[fs_.length-1].t+60,fechada_por:'pausa',fotos:fs_.map(f=>f.id),pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:i+1};});
async function agente(ctx){const j=(r,o)=>r.fulfill({status:200,contentType:'application/json',body:J(o)});
  await ctx.route(ORIG+'/status',r=>j(r,{ok:true,agent:'eterna-agente',version:3,boot:'bB',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:3,gen:'gB',hoje:3,abertas:0}}));
  await ctx.route(ORIG+'/events*',r=>j(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>j(r,LIB));
  await ctx.route(ORIG+'/fila-fotografo',r=>j(r,{ok:true,grupos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>{const desde=+new URL(r.request().url()).searchParams.get('desde')||0;j(r,{ok:true,gen:'gB',rev:3,pausa:60,rostos:true,completo:!desde,sessoes:SESS.filter(x=>x.rev>desde)});});
  for(const k of ['thumb','file'])await ctx.route(ORIG+'/'+k+'/**',r=>{const id=r.request().url().split('/').pop().split('?')[0];const o=OR[id];if(k==='file'){ARQ.pedidos.push(id);if(ARQ.modo!=='ok')return r.fulfill({status:+ARQ.modo,contentType:'application/json',body:'{"erro":"teste"}'});}
    return o?r.fulfill({status:200,contentType:'image/jpeg',body:IMG[k][o]}):r.fulfill({status:404,body:''});});}
const esperaNo=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(fn())return true;await new Promise(r=>setTimeout(r,50));}return false;};
const pintou=pg=>pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
// miniaturas de fundo não têm evento de carga: confere pelos recursos que o navegador já baixou
const miniaturasBaixadas=async(pg,n)=>{const okk=await espera(pg,n=>new Set(performance.getEntriesByType('resource').filter(e=>/\/thumb\//.test(e.name)&&e.responseEnd>0).map(e=>e.name)).size>=n,n);await pintou(pg);return okk;};
const espera=async(pg,fn,arg,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
// estado do zoom: legenda, setas, a foto atual e a caixa dela na tela
const zoom=pg=>pg.evaluate(()=>{const mo=document.querySelector('#modal');const im=document.querySelector('#modal-img');const r=im.getBoundingClientRect();
  return {aberto:mo.hasAttribute('data-open'),cap:document.querySelector('#modal-cap').textContent,prev:!document.querySelector('#modal-prev').hidden,next:!document.querySelector('#modal-next').hidden,
    img:im.style.getPropertyValue('--img'),arn:+im.style.getPropertyValue('--arn')||0,x:r.left,y:r.top,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight};});
const idDoZoom=z=>(/\/thumb\/([0-9a-f]+)/.exec(z.img)||[])[1]||'';
// o zoom abre com a miniatura; fica pronto quando a proporção foi medida e o original, pedido depois de parado na foto, entrou por cima
const zoomAberto=async(pg,id)=>{await espera(pg,id=>{const im=document.querySelector('#modal-img');return im.style.getPropertyValue('--img').includes('/thumb/'+id)&&+im.style.getPropertyValue('--arn')>0;},id);await pintou(pg);return zoom(pg);};
const zoomPronto=async(pg,id)=>{await espera(pg,id=>{const im=document.querySelector('#modal-img');return im.style.getPropertyValue('--img').includes('/file/'+id)&&+im.style.getPropertyValue('--arn')>0;},id);await pintou(pg);return zoom(pg);};
const semRolagemLateral=pg=>pg.evaluate(()=>document.scrollingElement.scrollWidth<=innerWidth+1);
(async()=>{const b=await chromium.launch();const errs=[];
const nova=async(w,h,toque)=>{const ctx=await b.newContext({viewport:{width:w,height:h},locale:'pt-BR',hasTouch:!!toque});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await agente(ctx);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};};
async function entrar(pg,quem){await pg.goto(U);await pg.waitForTimeout(300);const email=quem==='admin'?await entrarTeste.adminFicticio(pg):quem;ok(await entrarTeste(pg,email),'login: '+quem);
  await pg.evaluate(()=>{ETERNA.state.imp.key='todos';ETERNA.state.imp.point='todos';ETERNA.go('importar');});
  ok(await espera(pg,n=>ETERNA.state.agent.on&&ETERNA.state.lib.length===n,LIB.fotos.length),'agente ligado e Biblioteca carregada');
  ok(await espera(pg,()=>!!document.querySelector('#lib-painel .ph,#lib-minhas .ph')),'Biblioteca na tela');await miniaturasBaixadas(pg,await pg.$$eval('#lib-painel .ph,#lib-minhas .ph',b=>b.length));}
const libIds=(pg,sel)=>pg.$$eval(sel+' .ph',bs=>bs.map(x=>x.dataset.id.slice(3)));
// mede cada miniatura do seletor pelo print do próprio botão
async function miniaturas(pg,sel,nome){let n=0; // a tela se redesenha sozinha: cada miniatura é procurada de novo pelo id
  for(const id of await libIds(pg,sel)){const q=`${sel} .ph[data-id="ag_${id}"]`;
    const box=await pg.evaluate(q=>{const e=document.querySelector(q);e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};},q);
    const m=medir(await pg.screenshot({clip:box}));
    ok(inteira(m,AR[OR[id]]),`${nome}: miniatura ${id} (${OR[id]==='v'?'vertical':'horizontal'}) cortada ou fora de proporção: ${J(m)}`);
    ok(Math.abs(box.width-box.height)<=1,`${nome}: célula da miniatura não é quadrada: ${Math.round(box.width)}x${Math.round(box.height)}`);n++;}
  return n;}
try{
  // ---------- Admin em 1920: Biblioteca, zoom e setas ----------
  {const {ctx,pg}=await nova(1920,1080);await entrar(pg,'admin');
    const ordem=await libIds(pg,'#lib-painel');
    ok(ordem.join()===F.map(f=>f.id).join(),'B1: Biblioteca da mais nova para a mais antiga: '+ordem.join());
    ok(await miniaturas(pg,'#lib-painel','B2 Biblioteca')===7,'B2: 7 miniaturas na Biblioteca');
    // grade alinhada: todas as células com o mesmo tamanho e as linhas na mesma altura
    const cel=await pg.$$eval('#lib-painel .ph',bs=>bs.map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),Math.round(r.top)];}));
    ok(new Set(cel.map(c=>c[0]+'x'+c[1])).size===1&&new Set(cel.map(c=>c[2])).size===1,'B3: grade alinhada (células iguais): '+J(cel));
    // sessões de hoje: as mesmas fotos inteiras (são <img>)
    ok(await espera(pg,()=>document.querySelectorAll('#up-sessoes .up-sess').length===3),'S0: três blocos de sessão');
    await pg.evaluate(()=>document.querySelectorAll('.up-sess .ph img').forEach(i=>{i.loading='eager';}));
    ok(await espera(pg,()=>[...document.querySelectorAll('.up-sess .ph img')].every(i=>i.complete&&i.naturalWidth>0)),'S0: miniaturas das sessões carregadas');
    ok(await miniaturas(pg,'#up-sessoes','S1 Sessões de hoje')===6,'S1: 6 miniaturas nas sessões');
    if(PRINTS){fs.mkdirSync(PRINTS,{recursive:true});await pg.evaluate(()=>window.scrollTo(0,document.querySelector('#lib-painel').getBoundingClientRect().top+scrollY-20));await pg.waitForTimeout(200);await pg.screenshot({path:path.join(PRINTS,'biblioteca-1920.png')});}
    // primeira foto (sozinha na sessão dela): tem a seta da direita e não tem a da esquerda. O zoom abre com a miniatura, sem pedir o original na hora
    ARQ.pedidos.length=0;await pg.click(`#lib-painel .ph[data-id="ag_${ordem[0]}"] .zoom`);let z=await zoomAberto(pg,ordem[0]);
    ok(z.aberto&&!z.img.includes('/file/')&&!ARQ.pedidos.length,'Z0: o zoom abre só com a miniatura: '+z.img+' · pedidos '+ARQ.pedidos.length);
    let m0=medir(await pg.screenshot());ok(inteira(m0,AR.v),'Z0: a miniatura no zoom já aparece inteira: '+J(m0));
    z=await zoomPronto(pg,ordem[0]);
    ok(z.aberto&&z.next&&!z.prev,'Z1: primeira foto com a seta da direita e sem a da esquerda: '+J([z.prev,z.next]));
    const hh=t=>new Date(t*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    ok(z.cap==='Biblioteca · foto 1 de 7 · '+hh(F[0].t),'Z2: título com a posição e a hora: '+z.cap);
    ok(z.img.includes('/file/'+ordem[0])&&z.img.includes('/thumb/'+ordem[0]),'Z3: zoom com o original por cima da miniatura: '+z.img);
    let m=medir(await pg.screenshot());
    ok(inteira(m,AR.v)&&m.x>=0&&m.y>=0&&m.x+m.w<=1920&&m.y+m.h<=1080,'Z4: zoom da vertical inteiro: '+J(m));
    ok(m.h>=1080-140&&m.h<=1080,'Z5: a vertical ocupa a altura da tela: '+m.h);
    if(PRINTS)await pg.screenshot({path:path.join(PRINTS,'zoom-primeira-seta-1920.png')});
    // setas até o fim, na ordem da tela, atravessando as sessões
    const visto=[idDoZoom(z)];
    for(let i=1;i<7;i++){await pg.click('#modal-next');z=await zoomPronto(pg,ordem[i]);visto.push(idDoZoom(z));
      if(i===1){m=medir(await pg.screenshot());ok(inteira(m,AR.h)&&m.x>=0&&m.x+m.w<=1920&&m.y+m.h<=1080,'Z6: zoom da horizontal inteiro: '+J(m));ok(m.w>=1300,'Z6: a horizontal ocupa a tela: '+m.w);}
      if(i===2&&PRINTS)await pg.screenshot({path:path.join(PRINTS,'zoom-vertical-1920.png')});
      ok(z.prev&&z.next===(i<6),`N1: setas na foto ${i+1}: `+J([z.prev,z.next]));ok(z.cap==='Biblioteca · foto '+(i+1)+' de 7 · '+hh(F[i].t),'N2: título na foto '+(i+1)+': '+z.cap);}
    ok(visto.join()===ordem.join(),'N3: as setas seguem a ordem da tela e atravessam as sessões: '+visto.join());
    ok(!z.next&&z.prev,'N4: na última a seta da direita some e a da esquerda fica');
    await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(150);z=await zoom(pg);ok(idDoZoom(z)===ordem[6]&&/foto 7 de 7/.test(z.cap),'N5: → na última não volta para a primeira: '+z.cap);
    await pg.keyboard.press('ArrowLeft');z=await zoomPronto(pg,ordem[5]);ok(idDoZoom(z)===ordem[5],'N6: ← volta uma foto');
    for(let i=0;i<8;i++)await pg.keyboard.press('ArrowLeft');z=await zoomPronto(pg,ordem[0]);ok(idDoZoom(z)===ordem[0]&&!z.prev&&z.next,'N7: ← para na primeira');
    await pg.keyboard.press('Escape');await pg.waitForTimeout(150);ok(!(await zoom(pg)).aberto,'N8: Esc fecha');
    // filtro: só o Samuel; as setas percorrem só o que o filtro mostra
    await pg.click('#lib-painel [data-act="lib-f"][data-k="who"][data-v="samuel"]');await espera(pg,()=>document.querySelectorAll('#lib-painel .ph').length===2);
    const filt=await libIds(pg,'#lib-painel');ok(filt.join()==='b1b000000005,b1b000000006','F1: filtro do fotógrafo: '+filt.join());
    await pg.click(`#lib-painel .ph[data-id="ag_${filt[0]}"]`);z=await zoomPronto(pg,filt[0]);ok(/foto 1 de 2/.test(z.cap)&&z.next&&!z.prev,'F2: zoom com as 2 fotos do filtro: '+z.cap);
    await pg.click('#modal-next');z=await zoomPronto(pg,filt[1]);ok(idDoZoom(z)===filt[1]&&!z.next,'F3: para na última do filtro');
    await pg.keyboard.press('Escape');await pg.click('#lib-painel [data-act="lib-f"][data-k="who"][data-v="todos"]');await espera(pg,()=>document.querySelectorAll('#lib-painel .ph').length===7);
    // bloco de sessão: as setas ficam dentro da sessão e também param
    await pg.click('.up-sess[data-card="LPBIBB2"] .ph >> nth=0');z=await zoomPronto(pg,'b1b000000004');
    ok(/LPBIBB2 · foto 1 de 3/.test(z.cap)&&z.next&&!z.prev,'S2: zoom da sessão, primeira com a seta da direita: '+z.cap);
    const ses=[idDoZoom(z)];for(const id of ['b1b000000003','b1b000000002']){await pg.click('#modal-next');z=await zoomAberto(pg,id);ses.push(idDoZoom(z));}
    ok(ses.join()==='b1b000000004,b1b000000003,b1b000000002'&&!z.next&&z.prev&&/LPBIBB2 · foto 3 de 3/.test(z.cap),'S3: setas só dentro da sessão, parando no fim: '+ses.join()+' · '+z.cap);
    await pg.keyboard.press('Escape');
    // sessão de uma foto só: sem setas (não há outra foto)
    await pg.click('.up-sess[data-card="LPBIBA1"] .ph >> nth=0');z=await zoomPronto(pg,'b1b000000001');ok(/foto 1 de 1/.test(z.cap)&&!z.next&&!z.prev,'S4: sessão de uma foto sem setas: '+z.cap);
    await pg.keyboard.press('Escape');
    // ---------- Qualidade: foto inteira na grade e no zoom, com as ferramentas ----------
    await pg.evaluate(()=>{ETERNA.go('revisao');ETERNA.state.session='LPBIBB2';ETERNA.render();});await espera(pg,()=>document.querySelectorAll('#main .photos .ph').length===3);await pintou(pg);
    const q=await libIds(pg,'#main .photos');ok(q.length===3,'Q0: a sessão aberta na Qualidade tem as 3 fotos: '+q.join());
    await miniaturas(pg,'#main .photos','Q1 Qualidade');
    await pg.click(`#main .photos .ph[data-id="ag_${q[1]}"] .zoom`);z=await zoomPronto(pg,q[1]);
    m=medir(await pg.screenshot());ok(inteira(m,AR[OR[q[1]]])&&m.y>=0&&m.y+m.h<=1080,'Q2: zoom da Qualidade inteiro: '+J(m));
    ok(await pg.evaluate(()=>{const r=document.querySelector('#modal-tools .tb.good').getBoundingClientRect();return r.height>0&&r.bottom<=innerHeight;}),'Q3: Boa e Ruim visíveis sem rolar');
    await pg.click('#modal-tools .tb.good');
    ok(await espera(pg,()=>document.querySelector('#modal-tools .tb.good').getAttribute('aria-pressed')==='true',null,3000),'Q4: avaliar no zoom continua funcionando');
    z=await zoom(pg);ok(z.aberto&&z.arn>0,'Q5: a foto segue na proporção depois de avaliar');
    await pg.keyboard.press('Escape');await ctx.close();}
  // ---------- Fotógrafo em 390 px com toque: Minhas fotos de hoje, deslizar e sem rolagem lateral ----------
  {const {ctx,pg}=await nova(390,844,true);await entrar(pg,'carlos@eterna.photo');
    ok(await espera(pg,()=>!!document.querySelector('#lib-minhas')),'M0: fotógrafo vê Minhas fotos de hoje');
    const ordem=await libIds(pg,'#lib-minhas');
    ok(ordem.join()==='b1b000000001,b1b000000004,b1b000000003,b1b000000002,b1b000000007','M1: fotos do Carlos na ordem da tela (por sessão): '+ordem.join());
    await miniaturas(pg,'#lib-minhas','M2 Minhas fotos em 390');
    ok(await semRolagemLateral(pg),'M3: 390 px sem rolagem lateral em Minhas fotos');
    await pg.click(`#lib-minhas .ph[data-id="ag_${ordem[0]}"]`);let z=await zoomPronto(pg,ordem[0]);
    ok(z.cap.startsWith('Minhas fotos de hoje · foto 1 de 5 · ')&&z.next&&!z.prev,'M4: zoom do fotógrafo percorre as 5 fotos da tela: '+z.cap);
    let m=medir(await pg.screenshot());ok(inteira(m,AR.v)&&m.x>=0&&m.x+m.w<=390&&m.y>=0&&m.y+m.h<=844,'M5: zoom da vertical inteiro em 390: '+J(m));
    ok(await semRolagemLateral(pg),'M6: 390 px sem rolagem lateral com o zoom aberto');
    const desliza=async dx=>{await pg.evaluate(dx=>{const mo=document.querySelector('#modal');const t=x=>new Touch({identifier:1,target:mo,clientX:x,clientY:400});
      mo.dispatchEvent(new TouchEvent('touchstart',{touches:[t(200)],changedTouches:[t(200)],bubbles:true}));mo.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[t(200+dx)],bubbles:true}));},dx);await pg.waitForTimeout(150);};
    await desliza(80);z=await zoom(pg);ok(idDoZoom(z)===ordem[0],'M7: deslizar para a direita na primeira não dá a volta');
    const visto=[idDoZoom(z)];for(let i=1;i<5;i++){await desliza(-80);z=await zoomPronto(pg,ordem[i]);visto.push(idDoZoom(z));
      if(i===1){m=medir(await pg.screenshot());ok(inteira(m,AR.h)&&m.x>=0&&m.x+m.w<=390,'M8: zoom da horizontal inteiro em 390: '+J(m));}}
    ok(visto.join()===ordem.join(),'M9: deslizar atravessa as sessões na ordem da tela: '+visto.join());
    await desliza(-80);z=await zoom(pg);ok(idDoZoom(z)===ordem[4]&&/foto 5 de 5/.test(z.cap)&&!z.next&&z.prev,'M10: deslizar na última para: '+z.cap);
    await ctx.close();}
  // ---------- tablet 1024x768: grade e zoom ----------
  {const {ctx,pg}=await nova(1024,768);await entrar(pg,'admin');await miniaturas(pg,'#lib-painel','T1 Biblioteca no tablet');
    ok(await semRolagemLateral(pg),'T2: tablet sem rolagem lateral');
    await pg.click('#lib-painel .ph >> nth=1');let z=await zoomPronto(pg,'b1b000000002');let m=medir(await pg.screenshot());
    ok(inteira(m,AR.h)&&m.x>=0&&m.x+m.w<=1024&&m.y>=0&&m.y+m.h<=768,'T3: zoom da horizontal inteiro no tablet: '+J(m));
    await pg.click('#modal-next');z=await zoomPronto(pg,'b1b000000003');m=medir(await pg.screenshot());
    ok(inteira(m,AR.v)&&m.y>=0&&m.y+m.h<=768,'T4: zoom da vertical inteiro no tablet: '+J(m));await ctx.close();}
  // ---------- recorte, /file/ no limite, mais de 400 fotos e seta segurada ----------
  {const {ctx,pg}=await nova(1366,900);await entrar(pg,'admin');
    // miniatura com "Recorte (zoom)" de 200%: a janela é a caixa da própria foto (a moldura sai, as faixas escuras da célula ficam)
    await pg.evaluate(()=>{ETERNA.SIM.edits=ETERNA.SIM.edits||{};ETERNA.SIM.edits.ag_b1b000000001={b:100,c:100,s:100,t:0,z:200,x:0,y:0};ETERNA.render();});
    ok(await espera(pg,()=>{const e=document.querySelector('#lib-painel .ph[data-id="ag_b1b000000001"]');return !!e&&e.style.getPropertyValue('--ri')!=='';}),'R0: miniatura recortada com a caixa da foto');await pintou(pg);
    const rec=async clip=>{const f=path.join(TMP,'r'+(++nPng)+'.png');fs.writeFileSync(f,await pg.screenshot(clip?{clip}:{}));return JSON.parse(execFileSync('python3',['-c',`
import sys,json
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGB');W,H=im.size;px=im.load()
print(json.dumps({'faixa':px[round(W*.06),round(H*.6)],'centro':px[W//2,round(H*.6)],'magenta':sum(1 for x in range(0,W,2) for y in range(0,H,2) if px[x,y][0]>190 and px[x,y][1]<110 and px[x,y][2]>190)}))`,f]).toString());};
    const box=await pg.evaluate(()=>{const e=document.querySelector('#lib-painel .ph[data-id="ag_b1b000000001"]');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};});
    let r=await rec(box);
    ok(r.magenta===0&&Math.max(...r.faixa)<60&&Math.min(...r.centro)>200,'R1: miniatura recortada mostra a janela da foto, sem invadir as faixas da célula: '+J(r));
    await pg.click('#lib-painel .ph[data-id="ag_b1b000000001"] .zoom');let z=await zoomPronto(pg,'b1b000000001');r=await rec();
    ok(r.magenta===0&&Math.abs(z.w/z.h-AR.v)<0.02,'R2: o zoom mostra o mesmo recorte, na caixa da foto: '+J([r.magenta,z.w,z.h]));
    await pg.keyboard.press('Escape');await pg.evaluate(()=>{delete ETERNA.SIM.edits.ag_b1b000000001;ETERNA.render();});
    // /file/ respondendo 404 e 429: a miniatura fica, um pedido só por abertura, e reabrir tenta de novo
    for(const [modo,id,o] of [['404','b1b000000002','h'],['429','b1b000000003','v']]){ARQ.modo=modo;ARQ.pedidos.length=0;
      await pg.click(`#lib-painel .ph[data-id="ag_${id}"] .zoom`);z=await zoomAberto(pg,id);
      ok(await esperaNo(()=>pedidosDe(id)===1),`E1 ${modo}: o original é pedido depois de parado na foto`);
      await pg.waitForTimeout(700); // tempo para um pedido repetido aparecer, se houvesse laço
      z=await zoom(pg);const m=medir(await pg.screenshot());
      ok(pedidosDe(id)===1&&ARQ.pedidos.length===1,`E2 ${modo}: sem repetir o pedido: `+ARQ.pedidos.join());
      ok(z.aberto&&!z.img.includes('/file/')&&inteira(m,AR[o]),`E3 ${modo}: a miniatura continua na tela, inteira: `+z.img+' '+J(m));
      await pg.keyboard.press('Escape');await pg.click(`#lib-painel .ph[data-id="ag_${id}"] .zoom`);await zoomAberto(pg,id);
      ok(await esperaNo(()=>pedidosDe(id)===2),`E4 ${modo}: reabrir a foto tenta o original de novo`);
      ARQ.modo='ok';await pg.keyboard.press('Escape');await pg.click(`#lib-painel .ph[data-id="ag_${id}"] .zoom`);z=await zoomPronto(pg,id);
      ok(z.img.includes('/file/'+id)&&pedidosDe(id)===3,`E5 ${modo}: com o agente respondendo, o original entra: `+pedidosDe(id));await pg.keyboard.press('Escape');}
    // mais de 400 fotos: a grade e o zoom ficam nas 400 mais novas
    for(let i=0;i<443;i++){const id='b2b'+String(i).padStart(9,'0');OR[id]=i%3?'h':'v';LIB.fotos.push(daLib({id,quem:'samuel',t:agora-2000-i*5}));}
    await pg.evaluate(async()=>{await ETERNA.libLoad();ETERNA.render();});
    ok(await espera(pg,()=>document.querySelectorAll('#lib-painel .ph').length===400),'G1: 450 fotos na Biblioteca, 400 na grade: '+await pg.$$eval('#lib-painel .ph',b=>b.length));
    ok(await pg.evaluate(()=>/450/.test(document.querySelector('#lib-painel .head').textContent)&&[...document.querySelectorAll('#lib-painel .note')].some(n=>/400/.test(n.textContent))),'G2: total de 450 e o aviso das 400');
    const ordem=await libIds(pg,'#lib-painel');
    ARQ.pedidos.length=0;await pg.click(`#lib-painel .ph[data-id="ag_${ordem[0]}"] .zoom`);z=await zoomPronto(pg,ordem[0]);
    ok(/foto 1 de 400/.test(z.cap),'G3: o zoom percorre as 400 da tela: '+z.cap);
    // seta segurada por 30 fotos: o original só é pedido onde a pessoa para
    ARQ.pedidos.length=0;for(let i=0;i<30;i++){await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(30);}
    z=await zoomPronto(pg,ordem[30]);
    ok(/foto 31 de 400/.test(z.cap)&&idDoZoom(z)===ordem[30],'V1: 30 passos chegam à foto 31: '+z.cap);
    ok(ARQ.pedidos.length<=2&&pedidosDe(ordem[30])===1,'V2: segurar a seta por 30 fotos pede no máximo 2 originais: '+ARQ.pedidos.length+' ('+ARQ.pedidos.join()+')');
    await pg.keyboard.press('Escape');await pg.click('#lib-painel [data-act="lib-f"][data-k="venda"][data-v="nao"]');
    ok(await espera(pg,()=>document.querySelectorAll('#lib-painel .ph').length===400),'G4: filtro com mais de 400 segue com 400 na grade');
    LIB.fotos.length=7;await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();fs.rmSync(TMP,{recursive:true,force:true});}
if(fails.length){console.log('FALHA biblioteca-fotos-inteiras: '+fails.join(' || '));process.exit(1);}
console.log('OK biblioteca-fotos-inteiras: miniaturas e zoom com a foto inteira (vertical e horizontal), setas na primeira e na última, Biblioteca atravessa as sessões na ordem da tela e para no fim, original só depois de parado na foto (404, 429 e seta segurada), recorte na miniatura, mais de 400 fotos, 390 px sem rolagem lateral');process.exit(0);
})();
