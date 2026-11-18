// 17/11: escola pelo voucher na galeria do cliente (nuvem simulada). O localizador entra no mesmo campo do código (e pelo link
// #g/<localizador>); depois da selfie, a criança escolhe uma foto grátis; a escolhida sai sem marca e o download é registrado.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const API='https://api.escola.teste';const TOK='S'.repeat(22),LOC='1112ABCD1234';
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const exp=new Date(Date.now()+30*864e5).toISOString();
const ESC={nome:'EE Teste',dia:'2026-11-12'};
const gal=crt=>({tipo:'evento',menor:true,expira:exp,estado:'pronta',precos:{dig:39,todas:250},catalogo:[],compra:false,
  escola:{...ESC,cortesia:crt||null,pode_escolher:!crt},
  fotos:Array.from({length:4},(_,i)=>{const p='ag_c0000'+i,g=p===crt;return {pid:p,direito:g?'cortesia':'venda',vitrine:'https://x/v'+i+'.jpg',original:g?'https://x/o'+i+'.jpg':null};})});
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  await ctx.route('https://x/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  const pedidos=[];let corpoCrt=null,baixou=null,codigos=[];
  await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const pth=u.pathname;const js=(o,st)=>r.fulfill({status:st||200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:J(o)});
    pedidos.push(pth);
    if(pth.startsWith('/g/codigo/')){const c=decodeURIComponent(pth.slice(10));codigos.push(c);return c===LOC?js({token:TOK,escola:ESC}):js({error:'not found'},404);}
    if(pth===`/g/${TOK}/info`)return js({ok:true,tipo:'evento',menor:true,expira:exp,estado:'pronta',compra:false});
    if(pth===`/g/${TOK}/galeria`)return js({galeria:gal(corpoCrt&&corpoCrt.foto)});
    if(pth===`/g/${TOK}/cortesia`){corpoCrt=JSON.parse(r.request().postData());return js({ok:true,foto:corpoCrt.foto,galeria:gal(corpoCrt.foto)});}
    if(pth===`/g/${TOK}/evento`){baixou=JSON.parse(r.request().postData());return js({ok:true});}
    return js({error:'not found'},404);});
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push(e.message));
  // 1. o localizador digitado no campo do código abre a galeria da visita
  await G.goto(U+'#g');await G.waitForTimeout(700);
  await G.fill('#gq-code','1112abcd1234');await G.click('[data-act="gq-code-go"]');
  await G.waitForURL(new RegExp('#g/'+TOK+'$'),{timeout:6000}).catch(()=>{});
  ok(new RegExp('#g/'+TOK+'$').test(G.url())&&codigos.includes(LOC),'1: localizador no campo do código abre a galeria: '+G.url()+' '+J(codigos));
  // 2. o link da escola (#g/<localizador>) busca sozinho
  codigos=[];await G.goto(U+'#g/'+LOC.toLowerCase());await G.waitForURL(new RegExp('#g/'+TOK+'$'),{timeout:6000}).catch(()=>{});
  ok(new RegExp('#g/'+TOK+'$').test(G.url()),'2: o link com o localizador abre a galeria sozinho: '+G.url());
  // 3. código errado continua dando "não encontrado"
  await G.goto(U+'#g');await G.waitForTimeout(400);await G.fill('#gq-code','ZZZZ99999999');await G.click('[data-act="gq-code-go"]');await G.waitForTimeout(500);
  ok(/Galeria não encontrada/.test(await G.textContent('#main')),'3: localizador sem galeria: não encontrada');
  // 3b. 18/11: o e-mail do responsável vem junto com a autorização, antes da selfie
  await G.goto(U+'#g/'+TOK);await G.reload();await G.waitForFunction(()=>ETERNA.state.pub&&ETERNA.state.pub.step==='consent',null,{timeout:8000}).catch(()=>{});
  ok(await G.locator('#gq-esc-email').count()===1,'3b: e-mail do responsável na autorização');
  await G.click('[data-act="gq-consent"]');await G.fill('#gq-esc-email','pai');await G.click('#gq-agree');await G.waitForTimeout(150);
  ok(/Confira o e-mail/.test(await G.textContent('#main'))&&await G.evaluate(()=>ETERNA.state.pub.step)==='consent','3b: e-mail inválido não passa da autorização');
  await G.fill('#gq-esc-email','mae@exemplo.com');await G.click('#gq-agree');await G.waitForTimeout(200);
  ok(await G.evaluate(()=>ETERNA.state.pub.step==='selfie'&&ETERNA.state.pub.cli.email==='mae@exemplo.com'),'3b: com e-mail, segue para a selfie');
  await G.evaluate(g=>{const p=ETERNA.state.pub;p.modo='agente';p.acesso='ACESSO-ESC';p.gal=g;p.galAt=Date.now();p.step='galeria';ETERNA.render();},gal(null));await G.waitForTimeout(150);
  let t3=await G.textContent('#main');ok(!/Nenhuma foto liberada/.test(t3)&&!/Toque em ✓/.test(t3),'3b: sem texto repetido na galeria da escola');
  await G.locator('[data-act="gq-gratis"]').first().click();await G.waitForTimeout(150);
  ok(await G.locator('#gq-gr-email').count()===0,'3b: na foto grátis o e-mail não é pedido de novo');
  await G.evaluate(()=>{const p=ETERNA.state.pub;p.cli=null;p.gratis=null;p.step="galeria";});
  // 4. depois da selfie (simulada): escolha da grátis
  await G.goto(U+'#g/'+TOK);await G.waitForTimeout(800);
  await G.evaluate(g=>{const p=ETERNA.state.pub;p.modo='agente';p.acesso='ACESSO-ESC';p.gal=g;p.galAt=Date.now();p.step='galeria';ETERNA.render();},gal(null));await G.waitForTimeout(200);
  let txt=await G.textContent('#main');
  ok(/EE Teste/.test(txt)&&/Escolha sua foto grátis/.test(txt)&&(await G.locator('[data-act="gq-gratis"]').count())===4,'4: nome da escola, aviso e "Quero esta grátis" em cada foto');
  await G.locator('[data-act="gq-gratis"]').nth(2).click();await G.waitForTimeout(150);
  txt=await G.textContent('#main');ok(/A escolha é final/.test(txt)&&await G.locator('#gq-gr-email').count(),'4: confirmação com e-mail e aviso de escolha final');
  await G.fill('#gq-gr-email','pai');await G.click('[data-act="gq-gratis-ok"]');await G.waitForTimeout(150);
  ok(/Confira o e-mail/.test(await G.textContent('#main'))&&!corpoCrt,'4: e-mail inválido barrado antes da nuvem');
  await G.fill('#gq-gr-email','pai@exemplo.com');await G.click('[data-act="gq-gratis-ok"]');await G.waitForTimeout(500);
  ok(corpoCrt&&corpoCrt.foto==='ag_c00002'&&corpoCrt.email==='pai@exemplo.com'&&corpoCrt.acesso==='ACESSO-ESC','4: a nuvem recebe a foto, o e-mail e o acesso: '+J(corpoCrt));
  const st=await G.evaluate(()=>({step:ETERNA.state.pub.step,toast:document.querySelector('#toast').textContent,gr:document.querySelectorAll('[data-act="gq-gratis"]').length,badge:document.querySelectorAll('.gq-badge').length}));
  ok(st.step==='galeria'&&/Foto grátis liberada/.test(st.toast)&&st.gr===0&&st.badge===1,'4: volta à galeria com a grátis em "Suas fotos" e sem novos botões: '+J(st));
  // 5. o download da grátis é registrado
  await G.click('[data-act="gq-dl"]');await G.waitForTimeout(500);
  ok(baixou&&baixou.tipo==='foto_baixada'&&baixou.foto==='ag_c00002','5: download registrado na nuvem: '+J(baixou));
  // 6. idiomas: os textos novos existem nos 5
  const falta=await G.evaluate(()=>['gq_gratisH','gq_gratisD','gq_gratisBtn','gq_gratisConf','gq_gratisFinal','gq_gratisOk','gq_gratisRep','gq_gratisEsgot'].filter(k=>{const a=ETERNA.I18N?ETERNA.I18N[k]:null;return a&&a.slice(0,5).some(x=>!x);}));
  ok(!falta.length,'6: textos nos 5 idiomas: '+J(falta));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA escola-galeria: '+fails.join(' || '));process.exit(1);}
console.log('OK escola-galeria: localizador no campo do código e pelo link, foto grátis com e-mail, download registrado');process.exit(0);
})();
