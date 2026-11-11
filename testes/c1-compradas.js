// v96.1 (Testador, C1; decisão do Eduardo, 10/11): na galeria do QR de uma venda, o QR sozinho abre e baixa as compradas e as cortesias,
// sem selfie (o pai que pagou e não aparece nas fotos); a selfie só acrescenta as à venda em que a pessoa aparece; selfie sem acerto
// não esconde as compradas; à venda de outra pessoa nunca aparece.
// Modo SIM (sem agente). Compra pelo Checkout (#loja) só das fotos da sessão em que o rosto da selfie NÃO bate.
const {chromium}=require('playwright');const login=require('./_login');const fs=require('fs');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const PR=__dirname+'/prints';fs.mkdirSync(PR,{recursive:true});
const fails=[];const errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const ignora=t=>/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(t);
async function nova(ctx,nome,vp){const pg=await ctx.newPage();if(vp)await pg.setViewportSize(vp);pg.on('pageerror',e=>errs.push(nome+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!ignora(m.text()))errs.push(nome+': '+m.text())});return pg;}
async function pagoNaMaquininha(pg){const ctx=pg.context();const V=await nova(ctx,'vendedor');await login(V);await V.evaluate(()=>localStorage.removeItem('eterna.session'));
  const id=await pg.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);if(!id)return;
  await V.evaluate(id=>{ETERNA.simFresh();if(ETERNA.state.view!=='posto'){ETERNA.state.view='posto';ETERNA.render();}const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(r&&r.escolha){ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'pix'});}return ETERNA.pendConfirmar(id,{ref:''});},id);
  for(let i=0;i<20;i++){if(await pg.evaluate(()=>!!document.querySelector('#lqr')))break;await pg.waitForTimeout(100);}await pg.waitForTimeout(600);}
async function fotoDe(pg,id){return pg.evaluate(async id=>{let c=null;for(let i=0;i<10&&!c;i++){c=await ETERNA.photoCanvas(id);if(!c)await new Promise(r=>setTimeout(r,400));}return c.toDataURL('image/jpeg',.9);},id);}

(async()=>{const b=await chromium.launch();try{
 const ctx=await b.newContext({viewport:{width:1280,height:900},locale:'pt-BR'});
 const L=await nova(ctx,'loja');await L.goto(U+'#loja');await L.waitForTimeout(600);await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
 const card=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=8)[0].card);
 const P=await nova(ctx,'plain');await P.goto(U);await P.waitForTimeout(600);
 // selfie = uma foto da sessão com um rosto só; "sem" = fotos da sessão em que esse rosto não bate
 const info=await P.evaluate(async c=>{await ETERNA.faceIndexAll();await new Promise(r=>setTimeout(r,300));await ETERNA.faceq;const s=ETERNA.demoSessions().find(x=>x.card===c);
   for(const id of s.photos.map(p=>p.id).filter(id=>(ETERNA.FACEIDX[id]||[]).length===1)){const r=await ETERNA.faceFind(await ETERNA.photoCanvas(id),x=>x.card===c);if(r.varias||r.semRosto)continue;
     return {meu:id,sem:s.photos.map(p=>p.id).filter(p=>!((r.sims[p]||0)>=.45)),com:s.photos.map(p=>p.id).filter(p=>(r.sims[p]||0)>=.45)};}},card);
 ok(info&&info.sem.length>=2&&info.com.length>=1,'preparo: sessão sem fotos suficientes sem a pessoa: '+JSON.stringify(info&&{sem:info.sem.length,com:info.com.length}));
 const compra=info.sem.slice(0,info.sem.length-1),outra=info.sem[info.sem.length-1]; // uma foto sem a pessoa fica à venda: não pode aparecer
 await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(700);
 const items=await L.evaluate(c=>ETERNA.lojaItems(c).map(x=>x.k),card);
 await L.evaluate(c=>{const pk=ETERNA.lojaPick(c);for(const k of Object.keys(pk))delete pk[k];},card);
 for(let i=0;i<items.length;i++){await L.evaluate(i=>{ETERNA.state.kiosk.i=i;ETERNA.render();},i);if(compra.includes(items[i]))await L.click('[data-act="kiosk-ok"]');}
 await L.click('.lj-next');await L.waitForTimeout(400);await pagoNaMaquininha(L);
 const tok=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.token);ok(!!tok,'venda sem token de galeria');
 // cortesia numa foto à venda em que a pessoa aparece não muda nada; numa em que não aparece, ela entra (manifesto do SIM)
 const G=await nova(ctx,'galeria',{width:390,height:844});await G.goto(U+'#g/'+tok);await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
 const sel=await fotoDe(G,info.meu);
 // só o QR (sem selfie): as compradas aparecem e baixam; nenhuma à venda
 const g0=await G.evaluate(()=>({step:ETERNA.pub.step,venda:ETERNA.pubGaleria().fotos.filter(f=>f.direito==='venda').length,dl:[...document.querySelectorAll('[data-act="gq-dl"]')].map(b=>b.dataset.pid),mais:!!document.querySelector('[data-act="gq-mais"]')}));
 await G.screenshot({path:PR+'/c1-galeria-so-qr.png',fullPage:true});
 ok(g0.step==='galeria'&&compra.every(id=>g0.dl.includes(id)),'só pelo QR as compradas deveriam aparecer com Baixar: '+JSON.stringify(g0));
 ok(g0.venda===0&&!g0.dl.includes(outra),'só pelo QR nenhuma à venda deveria aparecer: '+g0.venda);
 ok(g0.mais,'só pelo QR deveria aparecer o botão Encontrar mais fotos suas');
 {const [d0]=await Promise.all([G.waitForEvent('download',{timeout:15000}).catch(()=>null),G.click(`[data-act="gq-dl"][data-pid="${compra[0]}"]`)]);
  ok(!!d0,'só pelo QR baixar a comprada deveria gerar o arquivo');}
 // selfie sem rosto: as compradas continuam ao voltar
 await G.click('[data-act="gq-mais"]');await G.check('[data-act="gq-consent"]');await G.click('#gq-agree');await G.waitForSelector('#gq-st',{state:'attached'});
 await G.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#456';x.fillRect(0,0,400,300);return ETERNA.pubMatch(c.toDataURL('image/jpeg',.9));});
 await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='nao',null,{timeout:60000}).catch(()=>{});
 ok(await G.evaluate(()=>!!document.querySelector('[data-act="gq-back"][data-to="galeria"]')),'selfie sem acerto deveria oferecer Voltar às suas fotos');
 await G.click('[data-act="gq-back"][data-to="galeria"]');
 ok(await G.evaluate(ids=>ids.every(id=>!!document.querySelector(`[data-act="gq-dl"][data-pid="${id}"]`)),compra),'depois da selfie sem acerto as compradas deveriam continuar');
 await G.click('[data-act="gq-mais"]');await G.check('[data-act="gq-consent"]');await G.click('#gq-agree');await G.waitForSelector('#gq-st',{state:'attached'});
 await G.waitForFunction(()=>{const s=ETERNA.state.guest.selfie;return !s||s.err||s.ready;},null,{timeout:20000}).catch(()=>{});
 await G.evaluate(u=>ETERNA.pubMatch(u),sel);await G.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='buscando'&&ETERNA.pub.step!=='selfie',null,{timeout:150000});
 const g=await G.evaluate(t=>{const m=ETERNA.SIM.galerias[t];return {step:ETERNA.pub.step,comprada:m.fotos.filter(f=>f.direito==='comprada').map(f=>f.id),
   dl:[...document.querySelectorAll('[data-act="gq-dl"]')].map(b=>b.dataset.pid),itens:document.querySelectorAll('.gq-item').length,
   venda:(ETERNA.pubGaleria?ETERNA.pubGaleria().fotos:[]).filter(f=>f.direito==='venda').map(f=>f.pid),nada:/Nenhuma foto liberada/i.test(document.body.innerText)};},tok);
 await G.screenshot({path:PR+'/c1-galeria-compradas.png',fullPage:true});
 ok(g.step==='galeria','selfie deveria abrir a galeria: '+g.step);
 ok(compra.every(id=>g.comprada.includes(id)),'as compradas deveriam estar no manifesto como comprada');
 ok(compra.length&&compra.every(id=>g.dl.includes(id))&&!g.nada,'C1: compradas sem o rosto da pessoa deveriam aparecer com Baixar: '+JSON.stringify({compra:compra.length,dl:g.dl.length,nada:g.nada}));
 ok(!g.venda.includes(outra)&&!g.dl.includes(outra),'à venda sem a pessoa (outro cliente) não pode aparecer');
 ok(g.venda.length&&g.venda.every(id=>info.com.includes(id)),'à venda mostradas deveriam ser só as em que a pessoa aparece: '+g.venda.length);
 // baixar a comprada funciona (no SIM vira um download do navegador)
 const [d]=await Promise.all([G.waitForEvent('download',{timeout:15000}).catch(()=>null),G.click(`[data-act="gq-dl"][data-pid="${compra[0]}"]`)]);
 ok(!!d&&/viva-maracana-\d+\.jpg/.test(d.suggestedFilename()),'baixar a comprada sem o rosto deveria gerar o arquivo');
 // compra no balcão depois da selfie (outra foto vira cortesia): entra sem nova selfie
 await G.evaluate(([t,id])=>{const f=ETERNA.SIM.galerias[t].fotos.find(x=>x.id===id);f.direito='cortesia';f.cortesia={por:'teste'};ETERNA.render();},[tok,outra]);
 ok(await G.evaluate(id=>!!document.querySelector(`[data-act="gq-dl"][data-pid="${id}"]`),outra),'cortesia sem o rosto da pessoa deveria aparecer para baixar');
 await ctx.close();
}catch(e){fails.push('erro: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();const okAll=!fails.length&&!errs.length;console.log(`${okAll?'OK':'FALHA'} c1-compradas: compradas e cortesias sem o rosto aparecem e baixam, à venda só com a pessoa${fails.length?' · '+fails.slice(0,6).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(okAll?0:1);})();
