// Montagem no servidor, E2 a E4 no app (plano docs/planos/2026-11-11-montagem-no-servidor.md): com o interruptor
// /status.montagem.checkout ligado, o Checkout e o Posto mostram a prévia do servidor (/montagens/<mid>/previa.jpg) e o
// navegador não recorta nem monta; a venda leva o aiMont; a impressão usa o arquivo do servidor. Com o interruptor desligado
// (padrão, D5), com agente antigo ou sem agente, tudo como na v97 (canvas).
// Agente falso (page.route), como em selo-edicao.js. Só imagens geradas aqui (nunca foto de convidado).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const notas={};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(6):
    im=Image.new('RGB',(900,600),(40+i*30,90,160-i*20));d=ImageDraw.Draw(im);d.ellipse([360,90,540,270],fill=(230,200,170));d.rectangle([300,280,600,600],fill=(20+i*30,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGBA',(900,600),(0,0,0,0));d=ImageDraw.Draw(im);d.ellipse([390,60,510,180],fill=(230,200,170,255));d.rectangle([330,180,570,600],fill=(40,80,140,255))
b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(1600,1067),(200,60,60));b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(1844,1240),(60,160,60));b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const IMPRESSAO=cores.pop(),PREVIA=cores.pop(),PNG=cores.pop();
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const BASES=['bas000000001','bas000000002'];const FOTOS=Array.from({length:6},(_,i)=>'pho'+String(i+1).padStart(9,'0'));
const CARD='LPMONT001';
const FEED=[{card:CARD,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:a-900,ultima_chegada:a-850,cap0:a-902,cap1:a-852,fonte_t:'cap',fechada_em:a-790,fechada_por:'pausa',
  fotos:[...BASES,...FOTOS],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:BASES.slice(),ia_regra:{n:2,motivo:null}}];
const ORDEM=['campeao2','mirante','arq1950','tunel','telao'];const BASE_DE=bg=>bg==='arq1950'?BASES[0]:BASES[1];
// o servidor falso: estado de cada montagem base|fundo e um mid por montagem
const hex=s=>Buffer.from(s).toString('hex').padEnd(32,'0').slice(0,32);
const SRV={modo:'novo',checkout:true,estado:{},pedidos:[],listas:0,previas:[],impressoes:[],recortes:0,x:[],limite:false,parado:false};
const todas=est=>{BASES.forEach(b=>ORDEM.forEach(f=>{SRV.estado[b+'|'+f]=est;}));};
const midDe=k=>hex(k.replace('|','').slice(3));
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'bmont',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  ...(SRV.modo==='antigo'?{}:{montagem:{v:1,ligada:true,checkout:SRV.checkout,imprime:true,versao:'m1',filho:{vivo:!SRV.parado,reinicios:0},parado:SRV.parado,fila:0,feitas_hoje:10,erros_hoje:0,ms_medio:800,pico_mb:480,guardado_gb:.1,livre_gb:200,pausa_disco:false,fundos:ORDEM,fundos_faltando:[],alertas:SRV.alertas||[]}}),
  sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'bmont',hoje:1,abertas:0,dias:1,visitas:{n:0,rev:0}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  let FORA=false;const EVENTOS=[];
  // um contexto novo por cenário (localStorage limpo: a venda de um cenário não aparece no seguinte)
  const novoCtx=async()=>{const ctx=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>FORA?r.abort():r.fulfill({status:200,contentType:'application/json',body:J(st())}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'bmont',rev:1,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/visitas*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rev:0,completo:true,visitas:[]})}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(4)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(4)%cores.length]});});
  await ctx.route(ORIG+'/recorte',r=>{SRV.recortes++;r.fulfill({status:200,contentType:'image/png',body:PNG});});
  await ctx.route(ORIG+'/photoroom/**',r=>r.fulfill({status:409,contentType:'application/json',body:'{}'}));
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:J({rosto:true,fotos:FOTOS.slice(0,3).map(id=>({id,sim:.7}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}(j.eventos||[]).forEach(e=>EVENTOS.push(e));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  await ctx.route(ORIG+'/ponto/montagens',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"vistas":0}'}));
  await ctx.route(ORIG+'/montagens/lista',r=>{const q=r.request();SRV.listas++;SRV.x.push(q.headers()['x-eterna']);let j={};try{j=JSON.parse(q.postData()||'{}');}catch(e){}SRV.pedidos.push(j);
    if(SRV.limite)return r.fulfill({status:429,contentType:'application/json',body:'{"error":"limite"}'});
    const fs=j.fundos||ORDEM;const itens=[];(j.bases||[]).forEach(p=>fs.forEach(f=>{const k=p+'|'+f;const e=SRV.estado[k]||'indisponivel';itens.push({base:p,fundo:f,mid:e==='pronta'?midDe('ag_'+k):null,estado:e,motivo:e==='erro'?'sem_pessoa':null,w:e==='pronta'?5000:null,h:e==='pronta'?3333:null});}));
    r.fulfill({status:200,contentType:'application/json',body:J({versao:1,itens})});});
  await ctx.route(ORIG+'/montagens/*/previa.jpg',r=>{SRV.previas.push(r.request().url().split('/').slice(-2)[0]);r.fulfill({status:200,contentType:'image/jpeg',body:PREVIA});});
  await ctx.route(ORIG+'/montagens/*/impressao.jpg',r=>{if(SRV.semImpressao)return r.fulfill({status:409,contentType:'application/json',body:'{"error":"nao_vendida"}'});SRV.impressoes.push(r.request().url().split('/').slice(-2)[0]);r.fulfill({status:200,contentType:'image/jpeg',body:IMPRESSAO});});
    return ctx;};
  let ctx=await novoCtx();
  const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(120);}return false;};
  const nova=async()=>{await ctx.close();ctx=await novoCtx();const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+'#loja');
    ok(await espera(pg,c=>!!ETERNA.SIM.sessions[c],20000,CARD),'a leva do servidor chegou ao SIM');ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,10000),'agente com o recorte pronto');
    await pg.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.ljEdEsperaMs(1500);ETERNA.montDeNovoMs(250);},[CARD,[...BASES,...FOTOS]]);
    return pg;};
  // (a leva vem do agente falso a cada leitura das sessões: se o código cair no meio de uma leitura, tenta de novo)
  const abrir=async pg=>{for(let i=0;i<4;i++){await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(120);await pg.fill('#kcode',CARD);
    if(i===0)await pg.evaluate(()=>ETERNA.render()); // redesenho no meio da digitação (validação de foto nova, leitura do agente): o código digitado fica
    await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(250);
    if(await pg.evaluate(c=>ETERNA.state.kiosk.code===c,CARD))return;
    notas.abrir_de_novo=(notas.abrir_de_novo||[]).concat(await pg.evaluate(c=>({tem:!!ETERNA.SIM.sessions[c],lista:ETERNA.demoSessions().some(x=>x.card===c),campo:(document.querySelector('#kcode')||{}).value,passo:ETERNA.state.kiosk.step}),CARD));await pg.waitForTimeout(400);}};
  const K=pg=>pg.evaluate(()=>{const k=ETERNA.state.kiosk;const its=ETERNA.lojaItems(k.code);const x=its[k.ver];return {ver:k.ver,k:x&&x.k,t:x&&x.t,n:its.length};});
  const tela=pg=>pg.evaluate(()=>{const el=document.querySelector('#lj-lb .lj-lbimg.ai .compimg');return el?{ok:el.classList.contains('ok'),bg:el.style.backgroundImage,mk:!!el.querySelector('.lj-aimk'),ed:!!document.querySelector('#lj-lb .lj-lbimg.ai .lj-ed'),ar:getComputedStyle(el.parentElement).getPropertyValue('--ar').trim()}:null;});

  // ===== com o interruptor ligado (montSrv) =====
  todas('fila');
  let pg=await nova();
  ok(await pg.evaluate(()=>ETERNA.montSrv()),'montSrv() verdadeiro com montagem ligada e checkout ligado');
  // 1 (selo): a ordem não muda
  const ord=await pg.evaluate(c=>ETERNA.lojaItems(c).map(x=>x.t==='ai'?'ai:'+x.bg+':'+x.id.slice(3):'ph:'+x.id.slice(3)),CARD);
  ok(J(ord)===J([...ORDEM.map(bg=>'ai:'+bg+':'+BASE_DE(bg)),...FOTOS.map(id=>'ph:'+id)]),'26: montagens primeiro, na ordem dos fundos, e as fotos depois: '+J(ord));
  // 25: ainda na fila: "Preparando sua foto especial" com o selo, na 1ª montagem
  await abrir(pg);let k=await K(pg);let t=await tela(pg);
  ok(k.ver===0&&k.t==='ai'&&t&&t.mk&&t.ed&&!t.ok,'25: na fila, abre na 1ª montagem com o Preparando e o selo: '+J({k,t}));
  ok(SRV.listas>=1&&SRV.x.every(x=>x==='1')&&SRV.pedidos.some(p=>p.pedir===true),'24: o Checkout pede a lista ao servidor com X-Eterna e pedir: '+J(SRV.pedidos.slice(0,2)));
  ok(SRV.pedidos.every(p=>Object.keys(p).every(c=>['bases','fundos','pedir'].includes(c))&&p.bases.every(x=>/^[0-9a-z]{6,40}$/.test(x))),'24: o corpo só leva bases (sem ag_), fundos e pedir: '+J(SRV.pedidos[0]));
  // 25: fica pronta com o cliente olhando: a imagem entra sem redesenhar a tela e sem trocar de item
  await pg.evaluate(()=>{document.querySelector('#lj-lb').dataset.marca='1';ETERNA.ljEdEsperaMs(600000);});
  await abrir(pg);await pg.evaluate(()=>{document.querySelector('#lj-lb').dataset.marca='1';});todas('pronta');
  ok(await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg.ai .compimg.ok'),8000),'25: a montagem aparece quando o servidor termina');
  t=await tela(pg);k=await K(pg);const marca=await pg.evaluate(()=>(document.querySelector('#lj-lb')||{dataset:{}}).dataset.marca);
  const mid0=midDe('ag_'+BASES[1]+'|campeao2');
  ok(t.ok&&t.bg.includes('/montagens/'+mid0+'/previa.jpg')&&k.ver===0&&marca==='1'&&t.ed&&+t.ar>1,'24/25: a imagem é a prévia do servidor, no mesmo item, sem redesenhar: '+J({t,k,marca}));
  ok(SRV.previas.includes(mid0),'24: a prévia foi buscada em /montagens/<mid>/previa.jpg');
  // 26: com tudo pronto, abre na 1ª montagem; a grade mostra as 5 com a imagem do servidor
  await pg.evaluate(()=>ETERNA.ljEdEsperaMs(1500));await pg.waitForTimeout(700);await abrir(pg);k=await K(pg);t=await tela(pg);
  ok(k.ver===0&&t.ok,'26: com as montagens prontas, abre na 1ª montagem já com a imagem: '+J({k,t}));
  await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});
  ok(await espera(pg,()=>document.querySelectorAll('.lj-gcard .compimg.ok').length===5,8000),'26: a grade mostra as 5 montagens do servidor');
  const g=await pg.evaluate(()=>[...document.querySelectorAll('.lj-gcard .compimg.ok')].map(e=>e.style.backgroundImage));
  ok(g.every(x=>/\/montagens\/[0-9a-f]{32}\/previa\.jpg/.test(x)),'24: todas as miniaturas vêm de /montagens/<mid>/previa.jpg: '+J(g.slice(0,2)));
  ok(SRV.recortes===0,'24: nenhum POST /recorte no Checkout com o servidor montando: '+SRV.recortes);
  notas.listas_ate_aqui=SRV.listas;
  // 32: o pedido grava aiMont com um mid por item de aiSel; selected, aiSel e n iguais aos da v97
  const esc=['ai:ag_'+BASES[1]+'|campeao2','ai:ag_'+BASES[0]+'|arq1950','ag_'+FOTOS[0],'ag_'+FOTOS[1],'ag_'+FOTOS[2]];
  await abrir(pg);
  await pg.evaluate(ks=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);ks.forEach(x=>pk[x]='ok');ETERNA.lojaSync(k.code);ETERNA.lojaPedir();},esc);
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'&&(ETERNA.SIM.caixaDin||[]).length>0,8000),'32: pedido feito no Checkout: '+J(await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,ch:ETERNA.lojaCart(k.code).ch.length,din:(ETERNA.SIM.caixaDin||[]).length,pedindo:ETERNA.state.lojaPedindo,toast:(document.querySelector('.toast')||{}).textContent};})));
  const ped=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,n:r.n,sel:(r.selected||[]).slice().sort(),ai:(r.aiSel||[]).slice().sort(),aiMont:r.aiMont||null};});
  const aiEsp=[BASES[1]+'|campeao2',BASES[0]+'|arq1950'].map(x=>'ag_'+x).sort();
  ok(ped.n===5&&J(ped.sel)===J(esc.slice(2).sort())&&J(ped.ai)===J(aiEsp),'32: selected, aiSel e n iguais aos da v97: '+J(ped));
  ok(ped.aiMont&&J(Object.keys(ped.aiMont).sort())===J(aiEsp)&&aiEsp.every(x=>ped.aiMont[x]===midDe(x)),'32: aiMont com o mid de cada montagem marcada: '+J(ped.aiMont));
  // 34 / Posto: as miniaturas do pedido vêm do servidor; o caixa confirma e o evento "criar" leva o aiMont
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push('posto: '+e.message));pg2.on('dialog',d=>d.accept());await pg2.setViewportSize({width:1600,height:1000});
  await require('./_login.js')(pg2);await pg2.evaluate(()=>{localStorage.removeItem('eterna.session');ETERNA.go('posto');});
  ok(await espera(pg2,()=>ETERNA.montSrv(),10000),'Posto: montSrv() verdadeiro');
  await pg2.evaluate(()=>{ETERNA.montDeNovoMs(250);ETERNA.simFresh();ETERNA.go('posto');});
  ok(await espera(pg2,id=>{const el=document.querySelector(`[data-pend="${id}"]`);return !!el&&el.querySelectorAll('.pend-th.ai .compimg.ok').length===2;},10000,ped.id),'34: o pedido no Posto mostra as 2 montagens');
  const p34=await pg2.evaluate(id=>[...document.querySelector(`[data-pend="${id}"]`).querySelectorAll('.pend-th.ai .compimg.ok')].map(e=>e.style.backgroundImage),ped.id);
  ok(p34.every(x=>/\/montagens\/[0-9a-f]{32}\/previa\.jpg/.test(x)),'34: miniaturas do pedido no Posto com a montagem do servidor: '+J(p34)+J(await pg2.evaluate(()=>({v:ETERNA.state.view,srv:ETERNA.montSrv(),rota:ETERNA.state.lojaRota}))));
  ok(SRV.recortes===0,'24: nenhum POST /recorte no Posto: '+SRV.recortes);
  await pg2.evaluate(id=>ETERNA.pendEscolher(id,{pkg:'gramado',meio:'dinheiro'}),ped.id);await pg2.waitForTimeout(300);
  const conf=await pg2.evaluate(id=>ETERNA.pendConfirmar(id,{}),ped.id);ok(conf!==false,'32: o caixa confirma a venda');
  ok(await espera(pg2,()=>true,400)&&await (async()=>{const t0=Date.now();while(Date.now()-t0<8000){if(EVENTOS.some(e=>e.tipo==='criar'))return true;await pg2.waitForTimeout(150);}return false;})(),'32: o evento criar chegou ao servidor');
  const cr=EVENTOS.find(e=>e.tipo==='criar');
  ok(cr&&J((cr.dados.aiSel||[]).slice().sort())===J(aiEsp)&&cr.dados.aiMont&&aiEsp.every(x=>cr.dados.aiMont[x]===midDe(x))&&Object.keys(cr.dados.aiMont).length===2,'32: o evento criar leva aiSel (formato de sempre) e aiMont: '+J(cr&&{ai:cr.dados.aiSel,m:cr.dados.aiMont}));
  const sv=await pg2.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {ai:(s.aiSel||[]).slice().sort(),m:s.aiMont||null,st:s.status};},CARD);
  ok(J(sv.ai)===J(aiEsp)&&sv.m&&aiEsp.every(x=>sv.m[x]===midDe(x)),'32: a sessão paga guarda o aiMont: '+J(sv));
  notas.venda={card:CARD,ai:aiEsp};
  // ===== E3 (36): a impressão da venda usa o corte 10x15 do servidor; nenhum compHi =====
  const r36=SRV.recortes;
  const p36=await pg2.evaluate(async([ai,ph])=>{const r=await ETERNA.printMontar([...ai.map(k=>{const [id,bg]=k.split('|');return {k:'ai:'+k,t:'ai',id,bg};}),{k:ph,t:'ph',id:ph}]);const root=document.getElementById('print-root');
    const o={ok:r.ok,falhasIA:r.falhasIA,imgs:[...root.querySelectorAll('img')].map(i=>({t:i.dataset.t,src:i.src,mont:i.dataset.mont||null,w:i.naturalWidth,h:i.naturalHeight})),ed:root.querySelectorAll('.lj-ed,.eco-ed,.lj-edn').length};root.remove();document.body.classList.remove('pr-on');return o;},[aiEsp,'ag_'+FOTOS[0]]);
  const ai36=p36.imgs.filter(x=>x.t==='ai');
  ok(p36.ok.length===3&&!p36.falhasIA.length&&ai36.length===2&&ai36.every((x,i)=>x.src.endsWith('/montagens/'+midDe(aiEsp[i])+'/impressao.jpg')&&x.mont===midDe(aiEsp[i])&&x.w===1844&&x.h===1240),'36: as 2 montagens da venda vêm de /montagens/<mid>/impressao.jpg, 1844x1240: '+J(p36));
  ok(SRV.recortes===r36&&aiEsp.every(x=>SRV.impressoes.includes(midDe(x)))&&p36.ed===0,'36/39: nenhum compHi (nenhum recorte pedido) e nenhum selo na impressão: '+J({rec:SRV.recortes-r36,imp:SRV.impressoes}));
  // o arquivo do servidor não vem (venda ainda não chegou ao servidor): a impressão cai no canvas de sempre, sem travar o caixa
  SRV.semImpressao=true;
  const p36b=await pg2.evaluate(async k=>{const [id,bg]=k.split('|');const r=await ETERNA.printMontar([{k:'ai:'+k,t:'ai',id,bg}]);const root=document.getElementById('print-root');const im=root.querySelector('img');const o={ok:r.ok.length,src:im?im.src.slice(0,22):null,w:im&&im.naturalWidth};root.remove();document.body.classList.remove('pr-on');return o;},'ag_'+BASES[1]+'|tunel');
  ok(p36b.ok===1&&/^data:image\/jpeg/.test(p36b.src||'')&&p36b.w===1844&&SRV.recortes>r36,'36: sem o arquivo do servidor, a impressão usa o canvas (compHi): '+J(p36b));
  SRV.semImpressao=false;
  await pg2.close();await pg.close();

  // 29: servidor com a montagem ligada e sem terminar (filho parado): Preparando e, sem toque, a tela vai para a 1ª foto; nada no navegador
  todas('fila');SRV.parado=true;const r0=SRV.recortes;pg=await nova();
  await abrir(pg);t=await tela(pg);k=await K(pg);ok(k.ver===0&&t&&t.mk&&!t.ok,'29: montagem que não termina: Preparando na 1ª montagem: '+J({k,t}));
  await pg.waitForTimeout(2200);k=await K(pg);
  ok(k.ver===5&&k.t==='ph'&&k.n===11,'29: depois da espera sem toque, a tela vai para a 1ª foto e as montagens continuam na lista: '+J(k));
  ok(SRV.recortes===r0,'29: nenhuma montagem feita no navegador');
  // 28: limite (429): a tela segue com as fotos, sem erro e sem tirar as montagens da venda
  SRV.limite=true;await abrir(pg);await pg.waitForTimeout(900);k=await K(pg);const n28=await pg.evaluate(()=>ETERNA.FIA_RUIM.size);
  ok(k.n===11&&n28===0,'28: com 429 a tela segue com as fotos e nenhuma montagem é marcada como ruim: '+J({k,n28}));
  SRV.limite=false;SRV.parado=false;
  // erro do servidor (sem pessoa): a montagem sai da venda, como hoje
  todas('pronta');ORDEM.forEach(f=>{SRV.estado[BASES[1]+'|'+f]='erro';});
  await pg.evaluate(()=>{Object.keys(ETERNA.MONT).forEach(k=>delete ETERNA.MONT[k]);});await abrir(pg);await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});
  ok(await espera(pg,([c,b0])=>{const ai=ETERNA.lojaItems(c).filter(x=>x.t==='ai');return ai.length===5&&ai.every(x=>x.id==='ag_'+b0);},8000,[CARD,BASES[0]]),'erro sem_pessoa numa base: os fundos passam a usar a outra base (como hoje): '+J(await pg.evaluate(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ai').map(x=>x.id),CARD)));
  ok(await espera(pg,()=>document.querySelectorAll('.lj-gcard .compimg.ok').length===5,8000),'e as 5 montagens da outra base aparecem, do servidor');
  await pg.close();

  // ===== 27: base preferida com olhos fechados: a montagem da outra base já está pronta =====
  todas('pronta');pg=await nova();
  await pg.evaluate(id=>{ETERNA.SIM.invalid=ETERNA.SIM.invalid||{};ETERNA.SIM.invalid[id]='olhos';const s=ETERNA.SIM.sessions[ETERNA.state.kiosk.code||'LPMONT001'];localStorage.setItem('eterna.sim.v1',JSON.stringify(ETERNA.SIM));},'ag_'+BASES[1]);
  await abrir(pg);
  const its27=await pg.evaluate(c=>ETERNA.lojaItems(c).filter(x=>x.t==='ai').map(x=>x.id.slice(3)+'|'+x.bg),CARD);
  notas.c27=its27;
  if(its27.length&&its27.every(x=>x.startsWith(BASES[0]))){ok(await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg.ai .compimg.ok'),6000),'27: a montagem da outra base aparece na hora');
    t=await tela(pg);ok(t&&t.bg.includes('/montagens/'+midDe('ag_'+its27[0])+'/previa.jpg'),'27: e é a do servidor: '+J(t));}
  else notas.c27_nota='a marca de olhos fechados do teste não trocou a base (lojaAI decide); coberto no servidor pelas 10 montagens por visita';
  await pg.close();

  // ===== 30: interruptor desligado (padrão, D5) e agente antigo: tudo como na v97 (canvas) =====
  for(const modo of ['desligado','antigo']){SRV.modo=modo==='antigo'?'antigo':'novo';SRV.checkout=false;const l0=SRV.listas,p0=SRV.previas.length,rc0=SRV.recortes;todas('pronta');
    pg=await nova();ok(!(await pg.evaluate(()=>ETERNA.montSrv())),'30 ('+modo+'): montSrv() falso');
    await abrir(pg);ok(await espera(pg,()=>!!document.querySelector('#lj-lb .lj-lbimg.ai .compimg.ok'),20000),'30 ('+modo+'): a montagem aparece (canvas)');
    t=await tela(pg);ok(t&&/^url\("?blob:/.test(t.bg),'30 ('+modo+'): a imagem é a do canvas do navegador: '+J(t&&t.bg.slice(0,40)));
    ok(SRV.listas===l0&&SRV.previas.length===p0&&SRV.recortes>rc0,'30 ('+modo+'): nenhuma chamada a /montagens e o recorte veio do /recorte: '+J({listas:SRV.listas-l0,previas:SRV.previas.length-p0,recortes:SRV.recortes-rc0}));
    await pg.evaluate(ks=>{const k=ETERNA.state.kiosk;const pk=ETERNA.lojaPick(k.code);ks.forEach(x=>pk[x]='ok');ETERNA.lojaSync(k.code);ETERNA.lojaPedir();},esc.slice(0,3));
    ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'&&(ETERNA.SIM.caixaDin||[]).length>0,8000),'30 ('+modo+'): pedido feito');
    const p30=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {tem:'aiMont' in r&&r.aiMont!==undefined,ai:(r.aiSel||[]).length};});
    ok(!p30.tem&&p30.ai===2,'30 ('+modo+'): pedido sem aiMont, com o aiSel de sempre: '+J(p30));
    ok(/não é impressa e ainda não vai para a galeria/.test(await pg.evaluate(()=>ETERNA.pendMontAviso({aiSel:['ag_x|tunel'],selected:[],fav:[],pkg:'zona',prints:0}))),'30 ('+modo+'): com a montagem do servidor desligada o aviso do pacote só digital continua (v97)');
    await pg.close();}
  SRV.modo='novo';SRV.checkout=true;

  // ===== 31: sem agente: sem montagem, sem selo, sem título =====
  FORA=true;await ctx.close();ctx=await novoCtx();pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U+'#loja');await pg.waitForTimeout(1500);
  const p31=await pg.evaluate(()=>({srv:ETERNA.montSrv(),on:ETERNA.state.agent.on,ed:document.querySelectorAll('.lj-ed,.lj-edh').length}));
  ok(!p31.srv&&!p31.on&&p31.ed===0,'31: sem agente, sem montagem do servidor, sem selo e sem título: '+J(p31));
  await pg.close();FORA=false;

  // ===== Painel de controle: a lista de fundos do Checkout vai para o servidor com ids resolvidos =====
  await ctx.close();ctx=await novoCtx();const pa=await ctx.newPage();pa.on('pageerror',e=>errs.push('admin: '+e.message));await require('./_login.js')(pa);
  const f=await pa.evaluate(()=>{const gravados=[];const db=ETERNA.state.db;ETERNA.state.db={doc:c=>({set:v=>{gravados.push([c,JSON.parse(JSON.stringify(v))]);}})};
    const a=ETERNA.fundosAtivosSrv();ETERNA.state.fundosCfg=null;const r1=ETERNA.fundosCfgSalva();const r2=ETERNA.fundosCfgSalva();ETERNA.state.db=db;return {a,r1,r2,gravados,on:ETERNA.bgOn()};});
  ok(f.on.includes('campeao')&&J(f.a)===J(ORDEM)&&f.r1===true&&f.r2===false&&f.gravados.filter(x=>x[0]==='config/fundos').length===1&&J(f.gravados[0][1].ativos)===J(ORDEM)&&!!f.gravados[0][1].por&&f.gravados.some(x=>/^usuarios_log\//.test(x[0])&&x[1].acao==='fundos_lista'),
    'fundosCfgSalva grava config/fundos com os ids resolvidos (campeao vira campeao2), uma vez só: '+J(f));
  ok(await espera(pa,()=>ETERNA.state.agent.on&&!!ETERNA.state.agent.montagem,10000),'admin: agente com a montagem no /status');
  const painel=await pa.evaluate(()=>{ETERNA.go('chroma');return document.body.innerText;});
  ok(/Montagens no servidor: fila 0 · feitas hoje 10 · média 0,8 s · 0,1 GB guardados · o Checkout mostra as do servidor/.test(painel),'Fundos de IA mostra a linha das montagens do servidor: '+J((painel.match(/Montagens no servidor[^\n]*/)||[''])[0]));
  // ===== E4/D7: alerta no Posto para venda paga com montagem que o servidor não fez =====
  SRV.alertas=[{venda:'L0-077',fundo:'tunel',estado:'erro'}];
  ok(await espera(pa,()=>((ETERNA.state.agent.montagem||{}).alertas||[]).length===1,45000),'D7: o /status trouxe o alerta');
  const al=await pa.evaluate(()=>{ETERNA.go('posto');const e=document.querySelector('.mont-alerta');return e?e.innerText:null;});
  ok(al&&/Edição Maracanã não ficou pronta/.test(al)&&/Venda L0-077 · Saída do túnel: a montagem falhou/.test(al)&&/ofereça outra foto/.test(al),'D7: o Posto mostra o alerta da venda com a montagem que falhou: '+J(al));
  SRV.alertas=[];
  ok(await pa.evaluate(()=>ETERNA.montEntregaDigital())===true,'E4: montEntregaDigital() verdadeiro com o servidor entregando (o aviso de pacote só digital do Posto único sai)');
  // integração (simulação v97): com o servidor entregando, o aviso do pacote só digital e o selo "sem a Edição Maracanã" somem
  const av=await pa.evaluate(([c,b])=>{const S=ETERNA.SIM;const r={id:'L00-montsrv0a01',card:c,codigo:'MONS-2345',criada:new Date().toISOString(),estado:'escolha',escolha:true,n:2,nSes:2,selected:['ag_pho000000001'],aiSel:['ag_'+b+'|tunel'],fav:[],pkg:'zona',prints:0,total:110,meio:null,canal:'checkout',iniciado:'aguardando',saleNo:'L0-901'};
    S.caixaDin=[r];ETERNA.saveSim();ETERNA.go('posto');const it=document.querySelector('[data-pend="L00-montsrv0a01"]');return {fn:ETERNA.pendMontAviso(r),item:!!it,aviso:it?it.querySelectorAll('.pend-mont').length:-1,selo:it?it.querySelectorAll('.pend-semmont').length:-1};},[CARD,BASES[1]]);
  ok(av.fn===''&&av.item&&av.aviso===0&&av.selo===0,'integração: com a montagem do servidor ligada, o pedido com pacote só digital não mostra o aviso nem o selo: '+J(av));
  await pa.evaluate(()=>{ETERNA.SIM.caixaDin=[];ETERNA.saveSim();});
  // v98 (Eduardo, 12/11): Venda manual sem Fundo de IA. As montagens da sessão aparecem na grade como fotos; a marcada vai na venda como
  // aiSel "<foto>|<fundo>" e conta no pacote (sem impressão a mais, sem ir para a frente da fila, sem item no carrinho)
  ok(await espera(pa,c=>!!ETERNA.SIM.sessions[c],15000,CARD),'Venda manual: a leva do servidor chegou ao Posto');
  await pa.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);ETERNA.saveSim();ETERNA.montDeNovoMs(250);ETERNA.go('posto');},[CARD,[...BASES,...FOTOS]]);
  const nEv=EVENTOS.length;
  await pa.click('.posto-rodape [data-act="posto-manual"]');await pa.waitForTimeout(250);
  await pa.fill('#posto-manual #ck-code',CARD);await pa.waitForTimeout(300);
  await pa.click(`#posto-manual [data-act="checkout-pick"][data-card="${CARD}"]`);await pa.waitForTimeout(250);
  await pa.waitForSelector('#posto-manual [data-act="fila-ai"]',{timeout:15000}).catch(()=>{});
  ok(await pa.evaluate(()=>!document.querySelector('#posto-manual [data-act="fila-bg"]')&&!/Fundo de IA/.test(document.querySelector('#posto-manual').textContent)),'Venda manual: sem o bloco Fundo de IA');
  if(await pa.$('#posto-manual [data-act="fila-ai"]')){
    const g=await pa.evaluate(()=>{const f=[...document.querySelectorAll('#posto-manual .photos > *')];return {ai:f.filter(x=>x.dataset.act==='fila-ai').length,ph:f.filter(x=>x.dataset.act==='fila-sel').length,selo:!!document.querySelector('#posto-manual [data-act="fila-ai"] .lj-ed')};});
    ok(g.ai>=1&&g.ph>=1&&g.selo,'Venda manual: montagens e fotos na mesma grade, montagem com o selo: '+J(g));
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="fila-ai"]').click());await pa.waitForTimeout(250);
    ok(!(await pa.$('#posto-manual .pend-mont')),'Venda manual com montagem e o servidor entregando: sem o aviso');
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="fila-sel"]').click());await pa.waitForTimeout(150);
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="fila-add"][data-id="gramado"]').click());await pa.waitForTimeout(150);
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="checkout-step"][data-s="3"]').click());await pa.waitForTimeout(250);
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="caixa-pay"][data-m="Dinheiro"]').click());await pa.waitForTimeout(150);
    await pa.evaluate(()=>document.querySelector('#posto-manual [data-act="caixa-confirm"]').click());
    ok(await (async()=>{const t0=Date.now();while(Date.now()-t0<8000){if(EVENTOS.slice(nEv).some(e=>e.tipo==='criar'))return true;await pa.waitForTimeout(150);}return false;})(),'Venda manual: o evento criar chegou ao servidor');
    const cm=EVENTOS.slice(nEv).find(e=>e.tipo==='criar');const sm=await pa.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {st:s.status,bg:s.bg||null,ai:s.aiSel||[],sel:s.selected||[],prints:s.prints,fav:s.fav||[],imp:s.impressao&&s.impressao.alvo,cart:(s.cart||[]).map(x=>x.id),total:s.total,n:s.nFotos};},CARD);
    ok(cm&&(cm.dados.aiSel||[]).length===1&&/^ag_[0-9a-z]{6,40}\|[a-z0-9]+$/.test(cm.dados.aiSel[0])&&cm.dados.canal==='balcao'&&cm.dados.nAI===1&&cm.dados.nPh===1&&!(cm.dados.cart||[]).some(x=>x.id==='fundo'),'Venda manual: o evento criar leva o aiSel no formato <foto>|<fundo>, sem item fundo: '+J(cm&&{ai:cm.dados.aiSel,canal:cm.dados.canal,nAI:cm.dados.nAI,nPh:cm.dados.nPh,cart:cm.dados.cart}));
    ok(sm.st==='paga'&&sm.ai.length===1&&sm.sel.length===1&&sm.n===2&&sm.prints===2&&sm.imp===2&&!sm.fav.length&&sm.bg===null&&J(sm.cart)===J(['gramado'])&&sm.total===150,'Venda manual: a montagem conta como foto do pacote (2 fotos, 2 impressas, só o pacote no carrinho): '+J(sm));}
  else ok(false,'Venda manual: as montagens não apareceram na grade para o teste: '+J(await pa.evaluate(()=>(document.querySelector('#posto-manual')||{innerText:''}).innerText.slice(0,300))));
  await pa.close();
  // ===== E4 (46): na galeria #g a montagem comprada tem o selo e o nome do fundo, nas 5 línguas =====
  const pgq=await ctx.newPage();pgq.on('pageerror',e=>errs.push('galeria: '+e.message));await pgq.goto(U+'#g/tokMontagemTeste000001');await pgq.waitForFunction(()=>window.ETERNA&&ETERNA.pub,null,{timeout:15000});await pgq.waitForTimeout(600);
  const NOMES={pt:'Saída do túnel',en:'Out of the tunnel',es:'Salida del túnel',fr:'Sortie du tunnel',de:'Aus dem Spielertunnel'},SELO={pt:'Edição Maracanã',en:'Maracanã Edition',es:'Edición Maracanã',fr:'Édition Maracanã',de:'Maracanã-Edition'};
  for(const lg of ['pt','en','es','fr','de']){
    const q=await pgq.evaluate(([lg,mid])=>{const p=ETERNA.pub;Object.assign(p,{modo:'agente',step:'galeria',acesso:'x',galAt:Date.now(),sel:{},gal:{tipo:'sessao',menor:false,expira:new Date(Date.now()+864e5).toISOString(),estado:'pronta',precos:{dig:39,todas:250},
        fotos:[{pid:mid,t:'ai',bg:'tunel',direito:'comprada',vitrine:'/thumb/pho000000001',original:'/file/pho000000001',chegando:false},{pid:'ag_pho000000002',direito:'comprada',vitrine:'/thumb/pho000000002',original:'/file/pho000000002',chegando:false}]}});
      ETERNA.state.lang=lg;ETERNA.render();const its=[...document.querySelectorAll('.gq-item')];return its.map(i=>({ed:(i.querySelector('.gq-ed')||{}).textContent||null,nm:(i.querySelector('.gq-edn')||{}).textContent||null,dl:!!i.querySelector('[data-act="gq-dl"]'),ai:!!i.querySelector('.gq-ph.gq-ai')}));},[lg,midDe('ag_'+BASES[1]+'|tunel')]);
    ok(q.length===2&&q[0].ed===SELO[lg]&&q[0].nm===NOMES[lg]&&q[0].dl&&q[0].ai&&q[1].ed===null&&q[1].nm===null&&q[1].dl,'46 ('+lg+'): a montagem comprada com o selo, o nome do fundo e o botão de baixar; a foto comum sem selo: '+J(q));}
  await pgq.close();
  ok(!notas.abrir_de_novo,'o código da leva abre na 1ª tentativa, mesmo com a tela redesenhada no meio da digitação: '+J(notas.abrir_de_novo));
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,700));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA montagem-checkout: '+fails.length+' · '+fails.slice(0,10).join(' | ')+' · '+J(notas));process.exit(1);}
console.log('OK montagem-checkout: critérios 24 a 32, 34, 36 e 46 do plano da montagem no servidor (prévia do servidor no Checkout e no Posto, Preparando, aiMont, 429, filho parado, interruptor desligado, agente antigo, sem agente, config/fundos, impressão pelo servidor, alerta no Posto, selo na galeria em 5 línguas) '+J(notas));})();
