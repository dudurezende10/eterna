// v94-ux parte F: um nome só, "Seu código" (critérios F1 a F4 do plano docs/planos/2026-11-09-ondas-ux.md).
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const LANGS=['pt','en','es','fr','de'];
const SEU={pt:'Seu código',en:'Your code',es:'Tu código',fr:'Votre code',de:'Dein Code'};
const ETERNA_TYPE={pt:/Digite sua sessão/,en:/Enter your session/,es:/Escribe tu sesión/,fr:/Saisissez votre session/,de:/Sitzung eingeben/}; // v97-junta (VERSOES): "Digite sua sessão" na tela inicial
const PROIB=/recibo|receipt|reçu|Beleg|pedido|\border\b|commande|Bestell/i;
const CHAVES=['receiptCode','typeCode','codeBad','cam_nomatch','cam_nocam','gq_codeH','gq_codeIs','ljYourCode','ljTypeCode']; // v96-ux: no Checkout valem as chaves da v96 (ljYourCode na tela Pronto, ljTypeCode no Iniciar)
async function entrar(pg,email){await require('./_entrar')(pg,email);}
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  await entrar(A,'eduardo@eduardorezende.com');
  // F4: chaves com 5 línguas e sem travessão
  const f4=await A.evaluate(ch=>ch.map(k=>{const e=ETERNA.I18N[k];if(!Array.isArray(e))return [k,'falta'];const t=e.map(v=>typeof v==='function'?v('ABCD-EFGH'):v);return [k,t.length===5&&t.every(x=>typeof x==='string'&&x.length>0)&&!t.some(x=>/[—–]/.test(x))?'ok':J(t)];}),CHAVES);
  f4.forEach(([k,r])=>ok(r==='ok','F4: chave '+k+': '+r));
  // uma venda paga (galeria com código) e uma pendência aberta, pelo caminho de sempre
  const dados=await A.evaluate(()=>{const S=ETERNA.SIM;const ds=ETERNA.demoSessions().filter(s=>s.photos.length>=6&&!S.sessions[s.card]);const mk=(card,id,meio)=>{const sel=ETERNA.demoSessions().find(x=>x.card===card).photos.slice(0,3).map(p=>p.id);
      S.sessions[card]={...(S.sessions[card]||{}),status:'aguardando',selected:sel,cart:[{id:'zona'}],din:id};const tok=ETERNA.galDaSessao(card,true);const g=S.galerias[tok];
      S.caixaDin.unshift({id,venue:'maracana',card,token:tok,codigo:g.codigo,criada:new Date().toISOString(),total:110,prints:0,n:3,nPh:3,nAI:0,cart:[{id:'zona'}],selected:sel,aiSel:[],fav:[],meio,prov:'pos-manual',saleNo:'L0-9'+id.slice(-2),vendedor:null,posto:'Caixa 1',estado:'aguardando'});return g.codigo;};
    const c1=mk(ds[0].card,'L00-ondasf00001','cartao');const c2=mk(ds[1].card,'L00-ondasf00002','pix');localStorage.setItem('eterna.sim.v1',JSON.stringify(S));
    const pago=ETERNA.pendConfirmar('L00-ondasf00001',{ref:''});return {pago,c1,c2,card1:ds[0].card,card2:ds[1].card,lp:ds[2].card};});
  ok(dados.pago,'venda paga para o teste');
  // F3: no Posto, a busca por XXXX-XXXX e por LP acha a pendência
  await A.evaluate(()=>ETERNA.go('posto'));await A.waitForTimeout(300);
  ok(await A.evaluate(()=>/Seu código/.test(document.querySelector('#din-q').placeholder)&&!!document.querySelector('#pend-painel .eyebrow')),'F: placeholder e rótulo "Seu código" no Posto');
  for(const q of [dados.c2,dados.card2]){await A.fill('#din-q','');await A.type('#din-q',q);await A.waitForTimeout(200);
    const ids=await A.evaluate(()=>[...document.querySelectorAll('#pend-painel [data-pend]')].map(x=>x.dataset.pend));ok(ids.length===1&&ids[0]==='L00-ondasf00002','F3: busca por '+q+': '+J(ids));}
  // recibo: "Seu código: X · eterna.photo/g · 60 dias (11/11: endereço curto)"
  await A.evaluate(c=>{ETERNA.state.caixa.session=c;ETERNA.state.posto.recibo=c;ETERNA.render();},dados.card1);await A.waitForTimeout(300);
  const rec=await A.evaluate(()=>(document.querySelector('.receipt')||{}).textContent||'');ok(new RegExp('Seu código: '+dados.c1+' · eterna\\.photo/g · 60 dias').test(rec),'F: recibo com "Seu código": '+rec.slice(-160));
  // F2 e F1 no Checkout
  const L=await ctx.newPage();L.on('pageerror',e=>errs.push('L: '+e.message));await L.goto(U+'#loja');await L.waitForTimeout(800);await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  const tenta=async v=>{await L.evaluate(()=>{ETERNA.state.kiosk.step='code';ETERNA.render();});await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',v);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(250);
    return L.evaluate(()=>({step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code,toast:document.querySelector('#toast').textContent}));};
  for(const v of [dados.lp,dados.c1,dados.c1.replace('-',''),dados.c1.toLowerCase(),' '+dados.c1.slice(0,2)+' '+dados.c1.slice(2)+' ']){const r=await tenta(v);ok(r.step==='review'||(r.step==='done'&&r.code===dados.card1),'F2: código aceito "'+v+'": '+J(r));} // sessão já paga volta direto ao QR (v85)
  let r=await tenta('ZZZZ-ZZZZ');ok(r.step==='emerg'&&/Confira seu código/.test(r.toast),'F2: inexistente recusado com "Confira seu código": '+J(r));
  for(let i=0;i<4;i++)r=await tenta('QQQQ-QQQ'+i);
  const trava=await L.evaluate(()=>JSON.parse(sessionStorage.getItem('eterna.ljcod')||'{}'));ok(trava.ate>Date.now()+50000,'F2: no 5º erro trava 1 min: '+J(trava));
  r=await tenta(dados.lp);ok(r.step==='emerg','F2: travado não abre nem código válido');
  await L.evaluate(()=>ETERNA.lojaCodReset());
  // F1: textos do cliente nas 5 línguas
  for(const lg of LANGS){const t={};
    await L.evaluate(lg=>{ETERNA.state.lang=lg;ETERNA.lojaReset();ETERNA.state.lang=lg;ETERNA.render();},lg);await L.waitForTimeout(150);t.cam=await L.evaluate(()=>document.querySelector('#main').innerText);
    await L.click('[data-act="kiosk-emerg"]');await L.waitForTimeout(100);t.cod=await L.evaluate(()=>document.querySelector('#main').innerText);
    await L.evaluate(([lg,c])=>{const k=ETERNA.state.kiosk;k.code=c.card;k.step='done';k.paid={wait:true,meio:'cartao',codigo:c.code,total:110,prints:3};ETERNA.state.lang=lg;ETERNA.render();},[lg,{card:dados.card2,code:dados.c2}]);t.espera=await L.evaluate(()=>document.querySelector('#main').innerText);
    await L.evaluate(([lg,c])=>{const k=ETERNA.state.kiosk;k.paid={wait:true,meio:'dinheiro',cash:true,codigo:c.code,total:110,prints:3};ETERNA.render();},[lg,{code:dados.c2}]);t.din=await L.evaluate(()=>document.querySelector('#main').innerText);
    await L.evaluate(([lg,c])=>{const k=ETERNA.state.kiosk;k.code=c.card;k.paid={wait:false,codigo:c.code,token:c.tok,total:110,prints:3};ETERNA.render();},[lg,{card:dados.card1,code:dados.c1,tok:null}]);t.fim=await L.evaluate(()=>document.querySelector('#main').innerText);
    await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});
    for(const [k,v] of Object.entries(t)){ok(!PROIB.test(v),`F1 ${lg} ${k}: texto com recibo/pedido: `+(v.match(PROIB)||[])[0]);}
    ['cam','cod','espera','din','fim'].forEach(k=>ok(new RegExp(SEU[lg],'i').test(t[k])||(k==='cam'&&ETERNA_TYPE[lg].test(t[k]))/* v97-junta: na tela inicial o botão é "Digite sua sessão" (ljTypeCode) */||(k==='cod'&&new RegExp(lg==='pt'?'seu código':lg==='en'?'your code':lg==='es'?'tu código':lg==='fr'?'votre code':'deinen Code','i').test(t[k])),`F1 ${lg} ${k}: falta "${SEU[lg]}": `+t[k].replace(/\s+/g,' ').slice(0,160)));}
  // galeria: tela de código
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push('G: '+e.message));await G.goto(U+'#g/abcdefghijklmnop');await G.waitForTimeout(600);
  for(const lg of LANGS){const t=await G.evaluate(lg=>{ETERNA.state.lang=lg;ETERNA.state.pub.step='codigo';ETERNA.render();return document.querySelector('#main').innerText;},lg);
    ok(!PROIB.test(t),`F1 ${lg} galeria: `+(t.match(PROIB)||[])[0]);ok(new RegExp(lg==='pt'?'seu código':lg==='en'?'your code':lg==='es'?'tu código':lg==='fr'?'votre code':'deinen Code','i').test(t),`F1 ${lg} galeria sem "seu código": `+t.replace(/\s+/g,' ').slice(0,120));}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ondas-ux-f: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-f: Seu código (F1 a F4)');process.exit(0);
})();
