// v91 parte B (Eduardo, 01/11): no Checkout, a selfie traz TODAS as fotos da pessoa no dia, de várias sessões (outro
// fotógrafo, outro ponto, 10 min depois), numa galeria só; "talvez" pede confirmação foto por foto; a compra com fotos das
// duas sessões é uma venda só, com as duas sessões. Agente falso (page.route): /status, /sessoes, /thumb/, /rostos/buscar,
// /ponto/eventos. Rostos e miniaturas simulados, nunca foto de convidado. Prints em SESSOES_PRINTS (padrão testes/prints/).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.SESSOES_PRINTS||path.join(__dirname,'prints');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(10):
    im=Image.new('RGB',(300,200),(40+i*20,90+(i*31)%110,160-i*10));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(20+i*18,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
// sessão A: família no Terminal Campo (Carlos); B: a mesma pessoa 10 min depois no Campo 4 (Samuel)
const A=['aaa000000001','aaa000000002','aaa000000003','aaa000000004','aaa000000005','aaa000000006'];
const B=['bbb000000001','bbb000000002','bbb000000003','bbb000000004'];
const ses=(card,fotos,who,ponto,t0,rev)=>({card,dia:hoje,fotografo:who,fonte:'ftp',ponto,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev});
const FEED=[ses('LPTFAMA01',A,'carlos','terminal',a-1500,1),ses('LPTSOLO02',B,'samuel','campo4',a-900,2)];
// busca da selfie: A1, A2, A3 e B1, B2 claras (>= 0,45); A4 e B3 talvez (0,38 a 0,45); o resto não é ela
const SIMS={aaa000000001:.71,aaa000000002:.66,aaa000000003:.58,aaa000000004:.41,bbb000000001:.69,bbb000000002:.62,bbb000000003:.40};
let VARIAS=false;const EVENTOS=[];
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,agent:'eterna-agente',version:3,boot:'b91',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:2,gen:'b91',hoje:2,abertas:0,dias:1}})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,gen:'b91',rev:2,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-2),16)%cores.length]});});
  await ctx.route(ORIG+'/file/**',r=>{const id=r.request().url().split('/').pop();r.fulfill({status:200,contentType:'image/jpeg',body:cores[parseInt(id.slice(-2),16)%cores.length]});});
  await ctx.route(ORIG+'/rostos/buscar',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(VARIAS?{varias:true,fotos:[]}:{rosto:true,fotos:Object.entries(SIMS).map(([id,sim])=>({id,sim}))})}));
  await ctx.route(ORIG+'/ponto/eventos',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}(j.eventos||[]).forEach(e=>EVENTOS.push(e));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,resultados:(j.eventos||[]).map(e=>({idem:e.idem,s:'ok'}))})});});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|404/.test(m.text()))errs.push(m.text());});
  await pg.goto(U+'#loja');
  const espera=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(200);}return false;};
  ok(await espera(()=>{const S=ETERNA.SIM.sessions;return !!(S.LPTFAMA01&&S.LPTSOLO02);},15000),'as duas sessões do servidor chegaram ao SIM');
  // a validação de IA do navegador roda sobre os quadrados de cor: aqui as fotos contam como válidas
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};['LPTFAMA01','LPTSOLO02'].forEach(c=>S.sessions[c].photos.forEach(p=>delete p.invalid));});
  // uma pessoa por vez: com dois rostos, a busca não junta nada
  VARIAS=true;
  const rv=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;return ETERNA.faceFind([c],x=>/^LPT/.test(x.card));});
  ok(rv.varias===true&&!rv.res,'antifraude: duas pessoas na câmera não buscam: '+JSON.stringify(rv));
  VARIAS=false;
  // a busca acha as duas sessões (pontos diferentes, 10 min de diferença)
  const r=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const r=await ETERNA.faceFind([c],x=>/^LPT/.test(x.card));ETERNA.lojaJuntar(r.res,r.talvez);return {res:r.res.map(x=>x.card).sort(),tv:r.talvez.map(x=>x.card).sort(),step:ETERNA.state.kiosk.step};});
  ok(r.res.join()==='LPTFAMA01,LPTSOLO02'&&r.tv.join()==='LPTFAMA01,LPTSOLO02','a selfie acha as duas sessões: '+JSON.stringify(r));
  // "talvez": confirmação por foto (marca/desmarca), não escolha de sessão
  ok(r.step==='talvez','fotos talvez pedem confirmação: '+r.step);
  await pg.waitForTimeout(300);
  const tvTxt=await pg.textContent('#main');ok(/Estas também são suas\?/.test(tvTxt),'pergunta "Estas também são suas?"');
  ok(await pg.$$eval('.lj-tv .lj-gok',x=>x.length)===2,'duas fotos talvez na tela: '+await pg.$$eval('.lj-tv .lj-gok',x=>x.length));
  fs.mkdirSync(PRINTS,{recursive:true});await pg.screenshot({path:path.join(PRINTS,'v91-checkout-talvez.png')});
  await pg.click('.lj-tv .lj-gok[data-id="ag_aaa000000004"]');await pg.waitForTimeout(150);
  await pg.click('.lj-tv .lj-gok[data-id="ag_bbb000000003"]');await pg.waitForTimeout(150);
  await pg.click('.lj-tv .lj-gok[data-id="ag_bbb000000003"]');await pg.waitForTimeout(150); // desmarca
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.tv.sel.join())==='ag_aaa000000004','marca e desmarca por foto: '+await pg.evaluate(()=>ETERNA.state.kiosk.tv.sel.join()));
  await pg.click('[data-act="kiosk-tv-ok"]');await pg.waitForTimeout(400);
  // galeria única com as fotos das duas sessões, por hora, com o rótulo de cada bloco
  const k=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,so:k.so,fotos:ETERNA.lojaFotos(k.code).map(p=>p.id+'@'+p.ses)};});
  ok(k.step==='review'&&k.code==='LPTFAMA01'&&k.so&&k.so.cards.join()==='LPTFAMA01,LPTSOLO02','galeria única, venda na primeira sessão: '+JSON.stringify({step:k.step,code:k.code,so:k.so}));
  const esperadas=['ag_aaa000000001@LPTFAMA01','ag_aaa000000002@LPTFAMA01','ag_aaa000000003@LPTFAMA01','ag_aaa000000004@LPTFAMA01','ag_bbb000000001@LPTSOLO02','ag_bbb000000002@LPTSOLO02'];
  ok(k.fotos.join()===esperadas.join(),'só as fotos dela (claras + talvez confirmada), da mais antiga para a mais nova: '+k.fotos.join());
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.ver=null;ETERNA.render();});await pg.waitForTimeout(300);
  const blk=await pg.$$eval('.lj-grid .lj-blk',x=>x.map(e=>e.textContent));
  ok(blk.length===2&&/Terminal Campo/.test(blk[0])&&/Foto Campo 4/.test(blk[1]),'rótulo discreto de ponto e hora em cada bloco: '+JSON.stringify(blk));
  await pg.screenshot({path:path.join(PRINTS,'v91-checkout-duas-sessoes.png')});
  // compra com fotos das duas sessões: uma venda só, com as duas sessões
  for(const id of ['ag_aaa000000001','ag_aaa000000004','ag_bbb000000002']){const i=await pg.evaluate(id=>ETERNA.lojaItems(ETERNA.state.kiosk.code).findIndex(x=>x.k===id),id);await pg.click(`.lj-gok[data-i="${i}"]`);await pg.waitForTimeout(120);}
  await pg.click('.lj-foot [data-act="loja-cart"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step)==='cart','carrinho aberto');
  const tot=await pg.evaluate(()=>ETERNA.lojaCart(ETERNA.state.kiosk.code));
  ok(await pg.evaluate(()=>{const c=ETERNA.lojaCart(ETERNA.state.kiosk.code);return c.n===3&&c.total===ETERNA.lojaIdeal(3).custo;}),'preço do pacote pela quantidade de fotos (3): '+JSON.stringify({n:tot.n,total:tot.total}));
  await pg.click('[data-act="loja-paym"][data-m="pix"]');await pg.waitForTimeout(150);await pg.click('[data-act="loja-checkout"]');
  ok(await espera(()=>ETERNA.state.kiosk.step==='done'),'pedido feito');
  const rec=await pg.evaluate(()=>{const r=ETERNA.SIM.caixaDin[0];return {id:r.id,card:r.card,sessoes:r.sessoes,selected:r.selected,n:r.n,token:r.token};});
  ok(rec.card==='LPTFAMA01'&&(rec.sessoes||[]).join()==='LPTFAMA01,LPTSOLO02'&&rec.selected.sort().join()==='ag_aaa000000001,ag_aaa000000004,ag_bbb000000002'&&rec.n===3,'uma venda só com as duas sessões e as 3 fotos: '+JSON.stringify(rec));
  {const t0=Date.now();while(Date.now()-t0<8000&&!EVENTOS.some(e=>e.tipo==='criar'))await pg.waitForTimeout(200);}
  const ev=EVENTOS.find(e=>e.tipo==='criar');
  ok(ev&&(ev.dados.sessoes||[]).join()==='LPTFAMA01,LPTSOLO02'&&ev.dados.card==='LPTFAMA01','evento "criar" no servidor (vendas.db) com as duas sessões: '+JSON.stringify(ev&&ev.dados&&{card:ev.dados.card,sessoes:ev.dados.sessoes}));
  // confirmação no posto: venda paga, fotos vendidas nas duas sessões, galeria com as fotos dela da outra sessão
  // o vendedor confirma no Posto de venda (outra janela do mesmo navegador, logada)
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U);await pg2.waitForTimeout(400);
  await pg2.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg2.click('button[type=submit]');await pg2.waitForTimeout(200);
  {const otp=await pg2.$('.otp');if(otp){await pg2.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg2.waitForTimeout(500);}}
  const conf=await pg2.evaluate(id=>{ETERNA.simFresh();const okc=ETERNA.pendConfirmar(id,{ref:'123456'});
    const s=ETERNA.SIM.sessions.LPTFAMA01;const sold=ETERNA.vendidasTodas();const tok=ETERNA.SIM.caixaDin[0].token;ETERNA.galAtualizar(tok);const m=ETERNA.SIM.galerias[tok];
    return {okc,status:s.status,sessoes:s.sessoes,soldB:sold.has('ag_bbb000000002'),statusB:ETERNA.SIM.sessions.LPTSOLO02.status,gs:m.sessoes,gB:m.fotos.filter(f=>f.sessao==='LPTSOLO02').map(f=>f.id+':'+f.direito)};},rec.id);await pg2.close();
  {const g=await pg.evaluate(()=>{ETERNA.simFresh();const tok=ETERNA.SIM.caixaDin[0].token;ETERNA.galAtualizar(tok);const m=ETERNA.SIM.galerias[tok];return {gs:m.sessoes,gB:m.fotos.filter(f=>f.sessao==='LPTSOLO02').map(f=>f.id+':'+f.direito)};});conf.gs=g.gs;conf.gB=g.gB;}
  ok(conf.okc&&conf.status==='paga'&&(conf.sessoes||[]).join()==='LPTFAMA01,LPTSOLO02','pagamento confirmado na sessão da venda: '+JSON.stringify(conf));
  ok(conf.soldB&&conf.statusB!=='paga','a foto da outra sessão conta como vendida, sem marcar a outra sessão como paga: '+JSON.stringify(conf));
  ok(conf.gs.join()==='LPTFAMA01,LPTSOLO02'&&conf.gB.sort().join()==='ag_bbb000000001:venda,ag_bbb000000002:comprada','galeria online: da outra sessão só as fotos dela, a comprada como comprada: '+JSON.stringify(conf.gB));
  // pelo código do recibo continua abrindo a sessão inteira daquele código
  await pg.evaluate(()=>{ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.waitForTimeout(200);
  await pg.fill('#kcode','LPTSOLO02');await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(300);
  const cod=await pg.evaluate(()=>{const k=ETERNA.state.kiosk;return {so:k.so,n:ETERNA.lojaFotos(k.code).length};});
  ok(cod.so===null&&cod.n===4,'código do recibo abre a sessão inteira: '+JSON.stringify(cod));
  // "talvez" sem nenhuma clara e nada marcado: volta para a câmera
  const vazio=await pg.evaluate(()=>{ETERNA.state.kiosk.step='code';ETERNA.lojaJuntar([],[{card:'LPTSOLO02',fotos:['ag_bbb000000003'],sc:.4}]);const s1=ETERNA.state.kiosk.step;const tv=ETERNA.state.kiosk.tv;ETERNA.lojaAbrirSo(tv.ids.concat(tv.sel),tv.cardOf);return [s1,ETERNA.state.kiosk.step,ETERNA.state.cam.status];});
  ok(vazio[0]==='talvez'&&vazio[1]==='code'&&/nomatch|nocam/.test(vazio[2]),'talvez sem confirmação volta à câmera: '+vazio.join());
  await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const okk=!fails.filter(Boolean).length;console.log(`${okk?'OK':'FALHA'} checkout-varias-sessoes: selfie junta as sessões do dia, talvez por foto, uma venda com as duas sessões${okk?'':' · '+fails.filter(Boolean).slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
