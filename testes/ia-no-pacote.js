// v98 (Eduardo, 12/11; plano docs/planos/2026-11-12-ia-no-pacote.md): a montagem de IA (Edição Maracanã) é uma foto do pacote.
// Mesma grade das outras fotos, ocupa uma vaga, sem preço nem item "Fundo de IA". Passou do pacote: a foto adicional de sempre.
// Cobre: escolha mista dentro do pacote, estouro, pacote só digital, Maracanã Mais, Venda manual sem Fundo de IA, catálogo antigo
// migrado e venda antiga com o item ainda legível. Agente falso (page.route), como em montagem-checkout.js. Só imagens geradas aqui.
// PRINTS=<pasta> grava 2 imagens 1920x1080 (Checkout com a grade mista e Venda manual).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const PRINTS=process.env.PRINTS||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(6):
    im=Image.new('RGB',(900,600),(40+i*30,90,160-i*20));d=ImageDraw.Draw(im);d.ellipse([360,90,540,270],fill=(230,200,170));d.rectangle([300,280,600,600],fill=(20+i*30,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
im=Image.new('RGB',(1600,1067),(200,60,60));d=ImageDraw.Draw(im);d.ellipse([700,200,900,400],fill=(230,200,170));d.rectangle([640,400,960,1067],fill=(30,60,120));b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const PREVIA=cores.pop();
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const BASES=['bas000000001','bas000000002'];const FOTOS=Array.from({length:8},(_,i)=>'pho'+String(i+1).padStart(9,'0'));
const CARD='LPIAPAC01';
const FEED=[{card:CARD,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:a-900,ultima_chegada:a-850,cap0:a-902,cap1:a-852,fonte_t:'cap',fechada_em:a-790,fechada_por:'pausa',
  fotos:[...BASES,...FOTOS],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:BASES.slice(),ia_regra:{n:2,motivo:null}}];
const ORDEM=['campeao2','mirante','arq1950','tunel','telao'];
const hex=s=>Buffer.from(s).toString('hex').padEnd(32,'0').slice(0,32);const midDe=k=>hex(k.replace('|','').slice(3));
const SRV={checkout:true,fora:false};
const st=()=>({ok:true,agent:'eterna-agente',version:3,boot:'biap',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},recorte:{ok:true,carregado:true,provedor:'cpu',modelo:'birefnet-general'},fundos_modo:'local',
  montagem:{v:1,ligada:true,checkout:SRV.checkout,imprime:true,versao:'m1',filho:{vivo:true,reinicios:0},parado:false,fila:0,feitas_hoje:10,erros_hoje:0,ms_medio:800,pico_mb:480,guardado_gb:.1,livre_gb:200,pausa_disco:false,fundos:ORDEM,fundos_faltando:[],alertas:[]},
  sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'biap',hoje:1,abertas:0,dias:1,visitas:{n:0,rev:0}}});
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const EVENTOS=[];
  const novoCtx=async()=>{const ctx=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const js=(r,o)=>r.fulfill({status:200,contentType:'application/json',body:typeof o==='string'?o:J(o)});
    await ctx.route(ORIG+'/status',r=>SRV.fora?r.abort():js(r,st()));
    await ctx.route(ORIG+'/events*',r=>js(r,'{"events":[],"next":0,"total":0}'));
    await ctx.route(ORIG+'/biblioteca',r=>js(r,'{"fotos":[]}'));
    await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'biap',rev:1,pausa:60,rostos:true,completo:true,sessoes:FEED}));
    await ctx.route(ORIG+'/visitas*',r=>js(r,{ok:true,rev:0,completo:true,visitas:[]}));
    const img=r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[id.charCodeAt(11)%cores.length]});};
    await ctx.route(ORIG+'/thumb/**',img);await ctx.route(ORIG+'/file/**',img);
    await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
    await ctx.route(ORIG+'/photoroom/**',r=>r.fulfill({status:409,contentType:'application/json',body:'{}'}));
    await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}(j.eventos||[]).forEach(e=>EVENTOS.push(e));js(r,{ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))});});
    await ctx.route(ORIG+'/ponto/montagens',r=>js(r,'{"ok":true,"vistas":0}'));
    await ctx.route(ORIG+'/montagens/lista',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}const fs=j.fundos||ORDEM;const itens=[];
      (j.bases||[]).forEach(p=>fs.forEach(f=>{itens.push({base:p,fundo:f,mid:midDe('ag_'+p+'|'+f),estado:'pronta',motivo:null,w:5000,h:3333});}));js(r,{versao:1,itens});});
    await ctx.route(ORIG+'/montagens/*/previa.jpg',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PREVIA}));
    await ctx.route(ORIG+'/montagens/*/impressao.jpg',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PREVIA}));
    return ctx;};
  const espera=async(p,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(120);}return false;};
  const preparar=(pg)=>pg.evaluate(([c,ids])=>{const S=ETERNA.SIM;S.invalid={};ids.forEach(id=>{ETERNA.UP['ag_'+id]={src:location.origin+'/thumb/'+id,name:id};});(S.sessions[c].photos||[]).forEach(p=>delete p.invalid);localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.montDeNovoMs(250);if(ETERNA.ljEdEsperaMs)ETERNA.ljEdEsperaMs(600000);},[CARD,[...BASES,...FOTOS]]);
  // Checkout (#loja) num contexto novo, com a leva do servidor falso
  const checkout=async()=>{const ctx=await novoCtx();const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('checkout: '+e.message));await pg.goto(U+'#loja');
    ok(await espera(pg,c=>!!ETERNA.SIM.sessions[c],20000,CARD),'a leva do servidor chegou ao Checkout');ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.recorte&&ETERNA.state.agent.recorte.ok,10000),'agente pronto');await preparar(pg);return {ctx,pg};};
  const abrir=async pg=>{for(let i=0;i<4;i++){await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(120);await pg.fill('#kcode',CARD);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(250);
    if(await pg.evaluate(c=>ETERNA.state.kiosk.code===c,CARD))return;await pg.waitForTimeout(400);}};
  const marcar=(pg,nAI,nPh)=>pg.evaluate(([nAI,nPh])=>{const k=ETERNA.state.kiosk;const its=ETERNA.lojaItems(k.code);const pk=ETERNA.lojaPick(k.code);Object.keys(pk).forEach(x=>delete pk[x]);
    its.filter(x=>x.t==='ai').slice(0,nAI).forEach(x=>pk[x.k]='ok');its.filter(x=>x.t==='ph').slice(0,nPh).forEach(x=>pk[x.k]='ok');ETERNA.lojaSync(k.code);const c=ETERNA.lojaCart(k.code);
    return {n:c.n,nAI:c.nAI,nPh:c.nPh,pkg:c.pkg,extra:c.extra,total:c.total,prints:c.prints,cart:c.cart.map(x=>x.id),lines:c.lines.map(l=>l.t)};},[nAI,nPh]);
  const posto=async ctx=>{const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('posto: '+e.message));pg.on('dialog',d=>d.accept());await require('./_login.js')(pg);
    await pg.evaluate(()=>{localStorage.removeItem('eterna.session');ETERNA.montDeNovoMs(250);ETERNA.simFresh();ETERNA.go('posto');});return pg;};
  // pedido do Checkout e venda confirmada no Posto com o pacote dado. Devolve o que ficou gravado e o evento "criar"
  const vender=async(nAI,nPh,pkg,tag)=>{const {ctx,pg}=await checkout();await abrir(pg);const c=await marcar(pg,nAI,nPh);
    await pg.evaluate(()=>ETERNA.lojaPedir());ok(await espera(pg,()=>ETERNA.state.kiosk.step==='done'&&(ETERNA.SIM.caixaDin||[]).length>0,8000),tag+': pedido feito no Checkout');
    const id=await pg.evaluate(()=>ETERNA.SIM.caixaDin[0].id);const pg2=await posto(ctx);ok(await espera(pg2,()=>ETERNA.montSrv()===true||ETERNA.state.agent.on,10000),tag+': Posto com o agente');
    ok(await espera(pg2,id=>!!document.querySelector(`[data-pend="${id}"]`),10000,id),tag+': o pedido aparece no Posto');
    await pg2.evaluate(([id,pkg])=>ETERNA.pendEscolher(id,{pkg,meio:'dinheiro'}),[id,pkg]);await pg2.waitForTimeout(300);
    const pend=await pg2.evaluate(id=>{const el=document.querySelector(`[data-pend="${id}"]`);const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);return {ths:el.querySelectorAll('.pend-th').length,ai:el.querySelectorAll('.pend-th.ai').length,aviso:(el.querySelector('.pend-mont')||{}).textContent||'',selo:el.querySelectorAll('.pend-semmont').length,txt:/Fundo de IA/.test(el.textContent),total:r.total,prints:r.prints,cart:(r.cart||[]).map(x=>x.id)};},id);
    const n0=EVENTOS.length;const conf=await pg2.evaluate(id=>ETERNA.pendConfirmar(id,{}),id);ok(conf!==false,tag+': o caixa confirma');
    ok(await (async()=>{const t0=Date.now();while(Date.now()-t0<8000){if(EVENTOS.slice(n0).some(e=>e.tipo==='criar'))return true;await pg2.waitForTimeout(150);}return false;})(),tag+': o evento criar chegou ao servidor');
    const cr=(EVENTOS.slice(n0).find(e=>e.tipo==='criar')||{dados:{}}).dados;
    const ses=await pg2.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {ordem:ETERNA.impFotos(s).fotos.map(x=>x.t).join(','),fav:(s.fav||[]).length,nGal:ETERNA.nGalVenda(s),st:s.status,total:s.total,prints:s.prints,n:s.nFotos,cart:(s.cart||[]).map(x=>x.id),ai:(s.aiSel||[]).length,sel:(s.selected||[]).length,imp:s.impressao&&s.impressao.estado,alvo:s.impressao&&s.impressao.alvo,recibo:(document.querySelector('.receipt')||{}).textContent||''};},CARD);
    await ctx.close();return {c,pend,cr,ses};};

  // ===== 1. Checkout: grade mista e a conta do pacote (montagem = foto) =====
  {const {ctx,pg}=await checkout();ok(await pg.evaluate(()=>ETERNA.montSrv()),'1: montagem do servidor ligada');await abrir(pg);
    await pg.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});
    ok(await espera(pg,()=>document.querySelectorAll('.lj-gcard .compimg.ok').length===5,10000),'1: a grade mostra as 5 montagens');
    const g=await pg.evaluate(()=>{const cs=[...document.querySelectorAll('.lj-gcard')];return {n:cs.length,ai:cs.filter(x=>x.querySelector('.compimg')).length,selo:document.querySelectorAll('.lj-gcard .lj-ed').length,tit:(document.querySelector('.lj-edh')||{}).textContent||'',preco:/R\$\s*40/.test(document.querySelector('.lj').textContent),fundo:/Fundo de IA|AI background/.test(document.querySelector('.lj').textContent)};});
    ok(g.n===13&&g.ai===5&&g.selo===5&&/Suas fotos especiais/.test(g.tit)&&!g.preco&&!g.fundo,'1: montagens e fotos na mesma grade, com o selo e o título, sem preço próprio: '+J(g));
    // escolha mista dentro do pacote: 2 montagens + 4 fotos = Pacote Gramado (6), sem adicional e sem item de fundo
    let c=await marcar(pg,2,4);ok(c.n===6&&c.nAI===2&&c.nPh===4&&c.pkg==='gramado'&&c.extra===0&&c.total===150&&c.prints===6&&J(c.cart)===J(['gramado'])&&J(c.lines)===J(['pkg']),'1: 4 fotos + 2 montagens = Pacote Gramado, R$ 150, 6 impressas, só o pacote no carrinho: '+J(c));
    await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(600);
    const pill=await pg.evaluate(()=>(document.querySelector('.lj-cartpill b')||{}).textContent);ok(pill==='6','1: o contador do carrinho mostra 6: '+pill);
    if(PRINTS)await pg.screenshot({path:path.join(PRINTS,'checkout-grade-mista.png')});
    // a conta é a mesma para qualquer mistura com o mesmo n
    const mix=[];for(const [x,y] of [[0,6],[1,5],[5,1]]){const r=await marcar(pg,x,y);mix.push([r.pkg,r.total,r.prints,r.extra].join('/'));}
    ok(mix.every(x=>x==='gramado/150/6/0'),'1: 6 fotos custam o mesmo com 0, 1 ou 5 montagens: '+J(mix));
    // ===== 2. estouro do pacote: a 7ª foto é a adicional de R$ 35, seja montagem ou foto normal =====
    const est=await pg.evaluate(()=>{const v=(n,p)=>{const c=ETERNA.vendaCalc(n,n,p);return {total:c.total,extra:c.extra,prints:c.prints,cart:c.cart.map(x=>x.id)};};return {g7:v(7,'gramado'),ideal7:ETERNA.lojaIdeal(7),extra:ETERNA.priceOf('extra')};});
    ok(est.extra===35&&est.g7.total===185&&est.g7.extra===1&&est.g7.prints===7&&J(est.g7.cart)===J(['gramado','extra']),'2: 7 fotos no Gramado = R$ 150 + 1 adicional de R$ 35, 7 impressas: '+J(est));
    const e1=await marcar(pg,2,5),e2=await marcar(pg,0,7);await pg.evaluate(()=>{ETERNA.state.kiosk.pkg='gramado';});const e3=await marcar(pg,3,4),e4=await marcar(pg,0,7);await pg.evaluate(()=>{ETERNA.state.kiosk.pkg=null;});
    ok(e1.total===e2.total&&e1.pkg===e2.pkg&&e1.extra===e2.extra&&e1.n===7,'2: o ideal de 7 fotos é o mesmo com ou sem montagem: '+J([e1,e2]));
    ok(e3.total===185&&e4.total===185&&e3.extra===1&&e4.extra===1&&!e3.cart.includes('fundo')&&J(e3.cart)===J(e4.cart),'2: no Gramado com 7, uma adicional, igual para montagem e foto normal: '+J([e3,e4]));
    // ===== 4. Maracanã Mais: sem adicional; as montagens escolhidas entram =====
    const mais=await pg.evaluate(()=>{const c=ETERNA.vendaCalc(9,13,'mais');return {total:c.total,extra:c.extra,prints:c.prints,cart:c.cart.map(x=>x.id)};});
    ok(mais.total===250&&mais.extra===0&&mais.prints===0&&J(mais.cart)===J(['mais']),'4: Maracanã Mais com 9 fotos (com montagens): R$ 250, sem adicional: '+J(mais));
    ok(await pg.evaluate(()=>!ETERNA.DATA.catalog.some(c=>c.id==='fundo')&&!ETERNA.DATA.catalog.some(c=>/fundo/i.test(c.name))),'catálogo padrão sem Fundo de IA');
    // textos do cliente nas 5 línguas: selo e título continuam; nada de preço à parte, travessão ou "caixa" nos textos da montagem
    const tx=await pg.evaluate(()=>['edSelo','edTitulo','edFotos','aiMaking','bgIA'].map(k=>ETERNA.I18N[k]));
    ok(tx.every(v=>Array.isArray(v)&&v.length===5&&v.every(t=>t&&!/—|–|R\$|40|caixa|cashier/i.test(t))),'textos da montagem nas 5 línguas, sem preço e sem travessão: '+J(tx));
    await ctx.close();}

  // ===== 1 (venda): 2 montagens + 4 fotos, Pacote Gramado, de ponta a ponta =====
  {const r=await vender(2,4,'gramado','mista');
    ok(r.pend.ths===6&&r.pend.ai===2&&!r.pend.txt&&r.pend.aviso===''&&r.pend.total===150&&r.pend.prints===6&&J(r.pend.cart)===J(['gramado']),'1: no Posto o pedido tem 6 fotos (2 montagens), R$ 150, 6 impressas, sem linha de fundo: '+J(r.pend));
    ok(r.cr.nAI===2&&r.cr.nPh===4&&r.cr.total===150&&r.cr.prints===6&&J((r.cr.cart||[]).map(x=>x.id))===J(['gramado'])&&(r.cr.aiSel||[]).length===2&&r.cr.aiMont&&Object.keys(r.cr.aiMont).length===2,'1: o evento criar leva 2 montagens no aiSel/aiMont e só o pacote no carrinho: '+J(r.cr));
    ok(r.ses.st==='paga'&&r.ses.n===6&&r.ses.prints===6&&r.ses.alvo===6&&r.ses.imp==='pendente'&&J(r.ses.cart)===J(['gramado']),'1: venda paga com 6 fotos e 6 impressões (as 2 montagens imprimem como as outras): '+J(r.ses));
    ok(r.ses.ordem==='ph,ph,ph,ph,ai,ai'&&r.ses.fav===0&&r.ses.nGal===6,'1: ordem de impressão de sempre (fotos, depois montagens; nenhuma montagem passa à frente) e 6 fotos na galeria: '+J([r.ses.ordem,r.ses.fav,r.ses.nGal]));}
  // ===== 3. pacote só digital (Zona Mista): a montagem vai como as outras, sem aviso e sem impressão =====
  {const r=await vender(2,1,'zona','zona');
    ok(r.c.n===3&&r.pend.total===110&&r.pend.prints===0&&r.pend.aviso===''&&r.pend.selo===0&&J(r.pend.cart)===J(['zona']),'3: Zona Mista com 2 montagens + 1 foto: R$ 110, sem impressão, sem aviso: '+J(r.pend));
    ok(r.cr.nAI===2&&r.cr.nPh===1&&r.cr.prints===0&&(r.cr.aiSel||[]).length===2&&Object.keys(r.cr.aiMont||{}).length===2&&r.ses.st==='paga'&&r.ses.imp==='nao_se_aplica','3: a venda leva as 2 montagens ao servidor (galeria) e não imprime: '+J([r.cr,r.ses]));}
  // ===== 4. Maracanã Mais de ponta a ponta =====
  {const r=await vender(3,4,'mais','mais');
    ok(r.pend.total===250&&r.pend.prints===0&&J(r.pend.cart)===J(['mais'])&&r.pend.aviso===''&&r.cr.nAI===3&&r.cr.nPh===4&&(r.cr.aiSel||[]).length===3&&r.ses.st==='paga'&&r.ses.total===250,'4: Maracanã Mais com 3 montagens + 4 fotos: R$ 250, as montagens vão na venda: '+J([r.pend,r.cr]));}

  // ===== 5. Venda manual: sem Fundo de IA; montagens na grade, contando no pacote =====
  {const ctx=await novoCtx();const pg=await posto(ctx);ok(await espera(pg,c=>!!ETERNA.SIM.sessions[c]&&ETERNA.montSrv(),20000,CARD),'5: Posto com a leva e a montagem do servidor');await preparar(pg);await pg.evaluate(()=>ETERNA.go('posto'));
    await pg.evaluate(()=>document.querySelector('.posto-rodape [data-act="posto-manual"]').click());await pg.waitForTimeout(250);await pg.evaluate(c=>{ETERNA.state.checkout.code=c;ETERNA.render();},CARD);await pg.waitForTimeout(300);
    await pg.evaluate(c=>document.querySelector(`#posto-manual [data-act="checkout-pick"][data-card="${c}"]`).click(),CARD);await pg.waitForTimeout(250);
    ok(await espera(pg,()=>document.querySelectorAll('#posto-manual [data-act="fila-ai"] .compimg.ok').length===5,15000),'5: as 5 montagens da sessão aparecem na grade da Venda manual');
    const vm=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');const f=[...m.querySelectorAll('.photos > *')];return {ai:f.filter(x=>x.dataset.act==='fila-ai').length,ph:f.filter(x=>x.dataset.act==='fila-sel').length,selo:m.querySelectorAll('[data-act="fila-ai"] .lj-ed').length,bg:!!m.querySelector('[data-act="fila-bg"]'),txt:/Fundo de IA/.test(m.textContent),r40:/R\$\s*40/.test(m.textContent),chips:[...m.querySelectorAll('.chips [data-act="fila-add"]')].map(x=>x.dataset.id)};});
    ok(vm.ai===5&&vm.ph===8&&vm.selo===5&&!vm.bg&&!vm.txt&&!vm.r40&&J(vm.chips)===J(['extra']),'5: montagens e fotos na mesma grade; nada de Fundo de IA nem de R$ 40; adicional só a Foto adicional: '+J(vm));
    // 2 montagens + 5 fotos no Gramado: 1 além do carrinho; com a Foto adicional fecha
    for(let i=0;i<2;i++){await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="fila-ai"]')].filter(x=>!x.dataset.sel)[0].click());await pg.waitForTimeout(120);}
    for(let i=0;i<5;i++){await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="fila-sel"]')].filter(x=>!x.dataset.sel)[0].click());await pg.waitForTimeout(80);}
    await pg.evaluate(()=>document.querySelector('#posto-manual [data-act="fila-add"][data-id="gramado"]').click());await pg.waitForTimeout(200);
    let v=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');return {passou:(m.querySelector('.vm-passou')||{}).textContent||'',marc:m.querySelectorAll('[data-act="fila-ai"][data-sel="1"]').length,cab:([...m.querySelectorAll('.head .note')].map(x=>x.textContent).find(t=>/escolhidas/.test(t))||'')};});
    ok(/1 foto além do carrinho/.test(v.passou)&&/Some a Foto adicional ou troque para um pacote maior/.test(v.passou)&&v.marc===2&&/7 escolhidas/.test(v.cab),'5: 7 escolhidas (2 montagens) no Gramado: avisa 1 foto além do carrinho: '+J(v));
    await pg.evaluate(()=>document.querySelector('#posto-manual [data-act="fila-add"][data-id="extra"]').click());await pg.waitForTimeout(200);
    v=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');return {passou:!!m.querySelector('.vm-passou'),total:(m.querySelector('.total b')||{}).textContent||''};});
    ok(!v.passou&&/185/.test(v.total),'5: com a Foto adicional o carrinho cobre as 7, R$ 185: '+J(v));
    // a Venda manual só soma uma Foto adicional: a 8ª foto pede um pacote maior
    await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="fila-sel"]')].filter(x=>!x.dataset.sel)[0].click());await pg.waitForTimeout(150);
    const p8=await pg.evaluate(()=>(document.querySelector('#posto-manual .vm-passou')||{}).textContent||'');
    ok(/1 foto além do carrinho/.test(p8)&&/Troque para um pacote maior/.test(p8)&&!/Some a Foto adicional/.test(p8),'5: com a adicional já no carrinho, a 8ª foto orienta a trocar o pacote: '+p8);
    await pg.evaluate(()=>{const f=[...document.querySelectorAll('#posto-manual [data-act="fila-sel"]')].filter(x=>x.dataset.sel);f[f.length-1].click();});await pg.waitForTimeout(150);
    if(PRINTS){await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');if(m)m.scrollIntoView({block:'start'});});await pg.waitForTimeout(500);await pg.screenshot({path:path.join(PRINTS,'venda-manual.png')});}
    await pg.evaluate(()=>document.querySelector('#posto-manual [data-act="checkout-step"][data-s="3"]').click());await pg.waitForTimeout(250);
    const res=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');return {ai:m.querySelectorAll('.photos .vm-ai').length,ph:m.querySelectorAll('.photos .ph:not(.vm-ai)').length,linhas:[...m.querySelectorAll('.cartline span')].map(x=>x.textContent),tot:(m.querySelector('.total .note')||{}).textContent||''};});
    ok(res.ai===2&&res.ph===5&&J(res.linhas)===J(['Pacote Gramado','Foto adicional'])&&/7 fotos · 7 impressões/.test(res.tot),'5: resumo com as 7 fotos, sem linha de fundo: '+J(res));
    await pg.evaluate(()=>document.querySelector('#posto-manual [data-act="caixa-pay"][data-m="Dinheiro"]').click());await pg.waitForTimeout(150);const n0=EVENTOS.length;
    // revisão: o computador do ponto fora na hora de confirmar: não confirma calado, não zera as montagens, avisa o caixa
    const AVISO='O computador do ponto não respondeu. As fotos Edição Maracanã marcadas não podem ser confirmadas agora. Tente de novo em instantes.';
    SRV.fora=true;await pg.evaluate(()=>{ETERNA.state.agent.on=false;ETERNA.render();document.querySelector('#posto-manual [data-act="caixa-confirm"]').click();});await pg.waitForTimeout(900);
    const fo=await pg.evaluate(c=>{const s=ETERNA.SIM.sessions[c];const m=document.querySelector('#posto-manual');return {on:ETERNA.state.agent.on,st:s.status,ai:(s.aiSel||[]).length,presa:ETERNA.vmAiPresa(c),toast:(document.querySelector('#toast')||{}).textContent||'',aviso:(m.querySelector('.vm-semagente')||{}).textContent||'',sair:!!m.querySelector('[data-act="fila-ai-limpa"]'),res:m.querySelectorAll('.photos .vm-ai').length};},CARD);
    ok(fo.on===false&&fo.st!=='paga'&&fo.ai===2&&fo.presa&&fo.toast===AVISO&&fo.aviso.includes(AVISO)&&fo.sair&&fo.res===2&&!EVENTOS.slice(n0).some(e=>e.tipo==='criar'),'2 (revisão): agente fora na confirmação: a venda não fecha, as 2 montagens ficam marcadas e o caixa é avisado: '+J(fo));
    SRV.fora=false;ok(await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.montSrv(),30000),'2 (revisão): o agente volta');
    ok(await espera(pg,()=>!document.querySelector('#posto-manual .vm-semagente')&&!!document.querySelector('#posto-manual [data-act="caixa-confirm"]'),8000)||await pg.evaluate(()=>{ETERNA.render();return !document.querySelector('#posto-manual .vm-semagente');}),'2 (revisão): com o agente de volta o aviso some');
    await pg.evaluate(()=>document.querySelector('#posto-manual [data-act="caixa-confirm"]').click());
    ok(await (async()=>{const t0=Date.now();while(Date.now()-t0<8000){if(EVENTOS.slice(n0).some(e=>e.tipo==='criar'))return true;await pg.waitForTimeout(150);}return false;})(),'5: o evento criar da Venda manual chegou');
    const cr=(EVENTOS.slice(n0).find(e=>e.tipo==='criar')||{dados:{}}).dados;const s=await pg.evaluate(c=>{const s=ETERNA.SIM.sessions[c];return {st:s.status,total:s.total,n:s.nFotos,prints:s.prints,alvo:s.impressao.alvo,cart:s.cart.map(x=>x.id),bg:s.bg===undefined,fav:(s.fav||[]).length,rec:(document.querySelector('#posto-manual .receipt')||{}).textContent||''};},CARD);
    ok(cr.canal==='balcao'&&cr.nAI===2&&cr.nPh===5&&cr.total===185&&cr.prints===7&&(cr.aiSel||[]).length===2&&Object.keys(cr.aiMont||{}).length===2&&J((cr.cart||[]).map(x=>x.id))===J(['gramado','extra']),'5: a Venda manual manda as 2 montagens no aiSel, sem item de fundo e sem impressão a mais: '+J(cr));
    ok(s.st==='paga'&&s.total===185&&s.n===7&&s.prints===7&&s.alvo===7&&s.bg&&!s.fav&&!/Fundo/.test(s.rec),'5: venda paga com 7 fotos e 7 impressões; recibo sem Fundo de IA; montagem sem preferência na fila: '+J(s));
    // revisão: recibo da venda paga com o agente fora: conta pelo que a venda gravou (5 fotos + 2 montagens)
    SRV.fora=true;const rc=await pg.evaluate(c=>{ETERNA.state.agent.on=false;ETERNA.render();const s=ETERNA.SIM.sessions[c];return {on:ETERNA.state.agent.on,nGal:s.nGal,fn:ETERNA.nGalVenda(s),tela:(document.querySelector('#posto-manual .qr .note')||{}).textContent||'',antiga:ETERNA.nGalVenda({selected:['a'],aiSel:['x|tunel'],aiMont:{'x|tunel':'m'}}),antigaSem:ETERNA.nGalVenda({selected:['a'],aiSel:['x|tunel']})};},CARD);SRV.fora=false;
    ok(rc.on===false&&rc.nGal===7&&rc.fn===7&&/7 fotos em alta/.test(rc.tela)&&rc.antiga===2&&rc.antigaSem===1,'2 (revisão): recibo com o agente fora mostra as 7 fotos gravadas na venda: '+J(rc));
    await ctx.close();}

  // ===== 3b. montagem do servidor desligada (modo v97): o aviso do Posto continua e a Venda manual não tem montagem =====
  {SRV.checkout=false;const ctx=await novoCtx();const pg=await posto(ctx);ok(await espera(pg,c=>!!ETERNA.SIM.sessions[c]&&ETERNA.state.agent.on,20000,CARD),'3b: Posto com a leva');await preparar(pg);
    const av=await pg.evaluate(([c,b])=>{const S=ETERNA.SIM;const r={id:'L00-iapac000a01',card:c,codigo:'IAPA-2345',criada:new Date().toISOString(),estado:'escolha',escolha:true,n:2,nSes:2,selected:['ag_pho000000001'],aiSel:['ag_'+b+'|tunel'],fav:[],pkg:'zona',prints:0,total:110,meio:null,canal:'checkout',iniciado:'aguardando',saleNo:'L0-902'};
      S.caixaDin=[r];ETERNA.saveSim();ETERNA.go('posto');const it=document.querySelector('[data-pend="L00-iapac000a01"]');return {srv:ETERNA.montSrv(),aviso:it?(it.querySelector('.pend-mont')||{}).textContent||'':null,selo:it?it.querySelectorAll('.pend-semmont').length:-1};},[CARD,BASES[1]]);
    ok(av.srv===false&&/Este pedido tem 1 foto Edição Maracanã\. Neste pacote ela não é impressa e ainda não vai para a galeria/.test(av.aviso||'')&&av.selo===2,'3b: com a montagem do servidor desligada o aviso ao caixa continua: '+J(av));
    await pg.evaluate(()=>{ETERNA.SIM.caixaDin=[];ETERNA.saveSim();ETERNA.go('posto');});
    await pg.evaluate(()=>document.querySelector('.posto-rodape [data-act="posto-manual"]').click());await pg.waitForTimeout(250);await pg.evaluate(c=>{ETERNA.state.checkout.code=c;ETERNA.render();},CARD);await pg.waitForTimeout(300);await pg.evaluate(c=>document.querySelector(`#posto-manual [data-act="checkout-pick"][data-card="${c}"]`).click(),CARD);await pg.waitForTimeout(800);
    const vm=await pg.evaluate(()=>{const m=document.querySelector('#posto-manual');return {ai:m.querySelectorAll('[data-act="fila-ai"]').length,ph:m.querySelectorAll('[data-act="fila-sel"]').length,txt:/Fundo de IA/.test(m.textContent),aviso:!!m.querySelector('.pend-mont')};});
    ok(vm.ai===0&&vm.ph===8&&!vm.txt&&!vm.aviso,'3b: Venda manual sem montagem e sem Fundo de IA com o servidor desligado: '+J(vm));
    SRV.checkout=true;await ctx.close();}

  // ===== 6 e 7. aparelho com o catálogo antigo e venda antiga com o item (sem agente) =====
  {const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push('migração: '+e.message));
    await require('./_login.js')(pg);
    const cs=await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const ds=E.demoSessions().filter(s=>s.status!=='paga'&&s.status!=='aberta'&&s.photos.length>=4).sort((a,b)=>a.card<b.card?-1:1);const [A,B,C,D]=ds;
      S.prices={fundo:45,gramado:155};const at=new Date().toISOString();
      Object.assign(E.simOf?E.simOf(A.card):(S.sessions[A.card]=S.sessions[A.card]||{}),{status:'paga',payment:'PIX',paidAt:at,saleNo:'E901',total:230,nFotos:2,prints:2,cart:[{id:'maracana',v:190},{id:'fundo',v:40}],selected:A.photos.slice(0,2).map(p=>p.id),bg:'campeao2',seller:'Thais'});
      Object.assign(E.simOf?E.simOf(B.card):(S.sessions[B.card]=S.sessions[B.card]||{}),{status:'paga',payment:'Dinheiro',paidAt:at,saleNo:'E902',cart:[{id:'arq'},{id:'fundo'}],selected:[B.photos[0].id],bg:'tunel',seller:'Thais'}); // venda bem antiga: sem v e sem total
      Object.assign(E.simOf?E.simOf(C.card):(S.sessions[C.card]=S.sessions[C.card]||{}),{status:'no checkout',cart:[{id:'gramado'},{id:'fundo'}],selected:[C.photos[0].id],bg:'mirante'});
      Object.assign(E.simOf?E.simOf(D.card):(S.sessions[D.card]=S.sessions[D.card]||{}),{status:'cancelada',payment:'PIX',paidAt:at,saleNo:'E903',total:190,nFotos:2,prints:2,cart:[{id:'gramado',v:150},{id:'fundo',v:40}],selected:D.photos.slice(0,2).map(p=>p.id),bg:'tunel',seller:'Thais'}); // cancelada também é histórico
      localStorage.setItem('eterna.sim.v1',JSON.stringify(S));return [A.card,B.card,C.card,D.card];});
    const antes=await pg.evaluate(cs=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));return cs.map(c=>!!(S.sessions[c]&&S.sessions[c].cart));},cs);ok(antes.every(Boolean),'6: semente gravada: '+J(antes));
    await pg.reload();await pg.waitForFunction(()=>window.ETERNA&&ETERNA.SIM,null,{timeout:15000});await pg.waitForTimeout(600);
    const mg=await pg.evaluate(([A,B,C,D])=>{const E=ETERNA;const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const a=S.sessions[A],b=S.sessions[B],c=S.sessions[C],d=S.sessions[D];
      return {dCart:d.cart,dBg:d.bg,dSt:d.status,dTotal:E.saleTotal(d),precoFundo:S.prices.fundo,gramado:S.prices.gramado,cCart:(c.cart||[]).map(x=>x.id),cBg:'bg' in c,aCart:a.cart,aBg:a.bg,aTotal:E.saleTotal(a),bCart:(b.cart||[]).map(x=>x.id),bTotal:E.saleTotal(b),
        nome:E.catName('fundo'),preco:E.priceOf('fundo'),cat:E.DATA.catalog.some(x=>x.id==='fundo'),denovo:E.catMigraFundo()};},cs);
    ok(mg.precoFundo===45&&mg.gramado===155&&J(mg.cCart)===J(['gramado'])&&!mg.cBg&&mg.denovo===false,'6: catálogo antigo migrado: só a venda em aberto perde o item e o fundo; os preços editados ficam; rodar de novo não muda nada: '+J(mg));
    ok(mg.dSt==='cancelada'&&J(mg.dCart)===J([{id:'gramado',v:150},{id:'fundo',v:40}])&&mg.dBg==='tunel'&&mg.dTotal===190,'6 (revisão): venda cancelada é histórico e não é migrada (itens fecham com o total): '+J([mg.dCart,mg.dBg,mg.dTotal]));
    // janela antiga ainda aberta regrava o item numa venda em aberto: o simFresh e o ouvinte storage limpam de novo
    const jan=await pg.evaluate(C=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));S.sessions[C].cart=[{id:'gramado'},{id:'fundo'}];S.sessions[C].bg='mirante';localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();const c=ETERNA.SIM.sessions[C];return {cart:c.cart.map(x=>x.id),bg:'bg' in c};},cs[2]);
    ok(J(jan.cart)===J(['gramado'])&&!jan.bg,'6 (revisão): item regravado por janela antiga sai de novo no simFresh: '+J(jan));
    ok(J(mg.aCart)===J([{id:'maracana',v:190},{id:'fundo',v:40}])&&mg.aBg==='campeao2'&&mg.aTotal===230&&J(mg.bCart)===J(['arq','fundo'])&&mg.bTotal===115&&mg.nome==='Fundo de IA'&&mg.preco===45&&!mg.cat,'7: venda antiga intacta, com nome e valor do item (R$ 230; a sem preço gravado lê o preço editado, 70 + 45): '+J(mg));
    ok(await pg.evaluate(()=>{const S=ETERNA.SIM;const p=S.prices.fundo;delete S.prices.fundo;const v=ETERNA.priceOf('fundo');S.prices.fundo=p;return v;})===40,'7: sem preço editado, o item antigo vale R$ 40');
    // Lista de vendas e CSV
    await pg.evaluate(()=>ETERNA.go('vendas-lista'));await pg.waitForTimeout(400);
    const li=await pg.evaluate(([A,B])=>{const rows=ETERNA.allSales().filter(r=>(r.card===A&&r.no==='E901')||(r.card===B&&r.no==='E902'));const csv=ETERNA.salesCSV(rows);return {n:rows.length,tot:rows.map(r=>r.total).sort(),csv:csv.split('\n').slice(1),tela:/Fundo de IA/.test(document.querySelector('#main').textContent)};},cs);
    ok(li.n===2&&J(li.tot)===J([115,230])&&li.csv.every(l=>/Fundo de IA/.test(l))&&li.csv.some(l=>/Pacote Maracanã \+ Fundo de IA/.test(l)&&/"230"/.test(l)),'7: Lista de vendas e CSV seguem mostrando o item da venda antiga: '+J(li));
    // recibo da venda antiga
    const rec=await pg.evaluate(c=>{ETERNA.go('posto');const b=document.createElement('button');b.dataset.act='caixa-open';b.dataset.card=c;document.querySelector('#main').appendChild(b);b.click();return (document.querySelector('.receipt')||{}).textContent||'';},cs[0]);
    ok(/Fundo de IA/.test(rec)&&/230/.test(rec),'7: recibo da venda antiga com a linha Fundo de IA e o total: '+rec.replace(/\n/g,' | ').slice(0,300));
    // Painel (dashboard) lendo a venda antiga: o produto "Fundo de IA" continua com nome e receita no período
    const pn=await pg.evaluate(()=>{const d=new Date();const h=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');let D=null,erro='';try{D=ETERNA.painelDados({from:h,to:h});}catch(e){erro=String(e);}
      const ps=(D&&(D.produtos||D.prs||(D.eterna&&D.eterna.produtos)))||[];const f=ps.find(x=>x.id==='fundo');return {erro,chaves:D?Object.keys(D).slice(0,30):[],f:f?{nome:f.nome,receita:f.receita,pacotes:f.pacotes}:null};});
    ok(!pn.erro&&pn.f&&pn.f.nome==='Fundo de IA'&&pn.f.receita>=85,'7: o Painel lê a venda antiga com o item Fundo de IA (nome e receita): '+J(pn));
    // Painel de controle (catálogo) e Fundos de IA sem o produto
    await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(400);
    const cat=await pg.evaluate(()=>({linhas:[...document.querySelectorAll('#main [data-act="price"]')].map(x=>x.dataset.id),manual:/só na Venda manual/.test(document.querySelector('#main').textContent)}));
    ok(cat.linhas.length>=8&&!cat.linhas.includes('fundo')&&!cat.manual,'6: o Painel de controle não lista mais o Fundo de IA: '+J(cat));
    await pg.evaluate(()=>ETERNA.go('chroma'));await pg.waitForTimeout(400);
    const ch=await pg.evaluate(()=>{const t=document.querySelector('#main').textContent;return {vend:/Montagens vendidas/.test(t),r40:/R\$\s*40/.test(t),balcao:/Escolhidas no balcão/.test(t),antigas:/2 vendas antigas com o item Fundo de IA/.test(t)};});
    ok(ch.vend&&!ch.r40&&!ch.balcao&&ch.antigas,'5 (números): Fundos de IA mostra montagens vendidas, sem receita própria: '+J(ch));
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ia-no-pacote: '+fails.join(' || '));process.exit(1);}
console.log('OK ia-no-pacote: montagem como foto do pacote (grade mista, estouro com adicional, Zona Mista, Maracanã Mais), Venda manual sem Fundo de IA, catálogo antigo migrado e venda antiga legível');process.exit(0);
})();
