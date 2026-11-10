// v94-ux, revisão das ondas 1 e 2: NSU que não some no bloco "Agora no Checkout" (3), sem faixa antes da primeira tentativa (4)
// e o modo demonstração (7: sessão demo vira teste e não sobe; desliga no logout e expira em 4 h; auditoria com o posto).
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-rev-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,400),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);
const IMG=fs.readFileSync(TMP+'/a.jpg');
async function rotas(ctx){await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));}
function vigia(pg,n){pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(n+': '+e.message));return pg;}
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
async function sair(pg){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.waitForTimeout(350);}
const sim=pg=>pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')));
const txt=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\s+/g,' '):'';},s);
async function ljSessao(L,card,n){await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;if(ETERNA.state.kiosk.step!=='code'){ETERNA.state.kiosk.step='code';ETERNA.render();}});
  await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(500);
  await L.evaluate(([card,n])=>{const it=ETERNA.lojaItems(card).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(card);Object.keys(pk).forEach(k=>delete pk[k]);it.slice(0,n).forEach(x=>pk[x.k]='ok');ETERNA.state.kiosk.pkg=null;ETERNA.state.kiosk.pay=null;ETERNA.state.kiosk.step='cart';ETERNA.render();},[card,n]);await L.waitForTimeout(200);}
// v96-ux: o Checkout não escolhe pacote nem meio (v96); o vendedor (janela A, Posto) escolhe o Ideal e o meio
let POSTO=null;
async function ljPagar(L,m){await L.evaluate(()=>ETERNA.lojaPedir());await L.waitForTimeout(400);const id=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);if(!id||!POSTO)return;
  await POSTO.evaluate(([id,m])=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);if(!r||!r.escolha)return;ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:{card:'cartao',cash:'dinheiro',pix:'pix'}[m]||m});},[id,m]);await L.waitForTimeout(500);}
const pendDe=(pg,card)=>pg.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&(x.estado==='aguardando'||x.estado==='escolha')),card);
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(await pg.evaluate(fn,arg))return true;await sleep(120);}return false;};
// resultado de uma venda confirmada, sem datas, ids, códigos nem o número da sessão
async function venda(pg,card,id){return pg.evaluate(([card,id])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[card];const r=S.caixaDin.find(x=>x.id===id);
  const fila=JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').filter(e=>e.venda===id||e.id===id||(e.dados&&e.dados.card===card)).map(e=>e.tipo||e.t||e.acao);
  return {s:{status:s.status,payment:s.payment,total:s.total,nFotos:s.nFotos,prints:s.prints,cart:s.cart,nSel:(s.selected||[]).length,seller:s.seller,posto:s.posto,pag:s.pag&&{prov:s.pag.prov,ref:s.pag.ref,porNome:s.pag.porNome},imp:s.impressao&&s.impressao.estado,vendedor:s.vendedor,din:s.din||null,vendaIdOk:s.vendaId===id},
    r:{estado:r.estado,ref:r.ref,meio:r.meio,prov:r.prov,porNome:r.porNome,motivo:r.motivo,total:r.total,prints:r.prints},stock:S.stock['Caixa 1'],fila};},[card,id]);}

(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:900}});await rotas(ctx);
  const A=vigia(await ctx.newPage(),'A');await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(500);
  ok(await entrar(A,'eduardo@eduardorezende.com'),'admin não entrou');POSTO=A;
  // ---- 4: antes da primeira tentativa ao agente, sem faixa "Sem conexão"; depois dela (sem agente), com a faixa
  const r4=await A.evaluate(()=>{const a=ETERNA.state.agent;const t0=a.tried;a.on=false;a.tried=false;ETERNA.go('posto');const antes=!!document.querySelector('#main .conn-off');a.tried=true;ETERNA.render();const depois=!!document.querySelector('#main .conn-off');a.tried=t0||true;return {antes,depois};});
  ok(!r4.antes&&r4.depois,'4: faixa "Sem conexão" só depois da primeira tentativa: '+J(r4));
  // ---- 3: NSU digitado, clique fora e o #eco reescrito: o número fica
  const [L]=await Promise.all([ctx.waitForEvent('page'),A.click('.rail [data-act="loja-abrir"]')]);vigia(L,'L');await L.waitForLoadState();await L.waitForTimeout(800);
  await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;});
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=8).map(s=>s.card));
  await ljSessao(L,cards[0],4);await ljPagar(L,'card');const p0=await pendDe(L,cards[0]);ok(!!p0,'3: pendência do cartão');
  // v96-ux: pedido do Checkout (escolha:true): as ações ficam em "Aguardando pagamento" (o NSU não fica no bloco #eco)
  ok(await espera(A,id=>!!document.querySelector(`#pend-painel [data-act="pend-pos"][data-id="${id}"]`),3000,p0&&p0.id),'3: "Pago na maquininha" na lista');
  await A.click(`#pend-painel [data-act="pend-pos"][data-id="${p0.id}"]`);await A.waitForTimeout(150);
  await A.click('#pend-ref');await A.keyboard.type('123456');await A.click('#main h1');await A.waitForTimeout(100);
  await A.evaluate(()=>{ETERNA.ecoUpd(true);ETERNA.render();});await A.waitForTimeout(100);
  ok(await A.evaluate(()=>(document.querySelector('#pend-ref')||{}).value)==='123456','3: o NSU sumiu quando a tela foi redesenhada com o foco fora');
  await L.click('[data-act="lang"][data-l="en"]').catch(()=>{});await sleep(1300);
  ok(await A.evaluate(()=>(document.querySelector('#pend-ref')||{}).value)==='123456','3: o NSU sumiu com uma mudança no Checkout');
  await L.close();
  // ---- 7a: sessão criada no modo demonstração
  await A.evaluate(()=>ETERNA.go('identidade'));await A.waitForTimeout(150);await A.click('[data-act="demo-toggle"]');await A.waitForTimeout(150);
  const r7=await A.evaluate(()=>{const E=ETERNA,S=E.SIM;const ids=E.demoSessions()[0].photos.slice(0,3).map(p=>p.id);
    const fu0=JSON.stringify(S.flagUse||{}),inv0=JSON.stringify(S.invalid||{});const antes=new Set(Object.keys(S.sessions));
    E.state.ing.cur={photos:ids.map(id=>({id})),flags:{'bandeira-teste':3},start:new Date().toISOString()};E.ingClose('teste');
    const card=Object.keys(S.sessions).find(c=>!antes.has(c));const s=S.sessions[card];
    const f0=E.pvFila().length;const ev=E.pvEvento('criar','V-DEMO-1',{card});const f1=E.pvFila().length;
    s.status='paga';s.cart=[{id:'arq',v:70}];s.total=70;s.saleNo='E-DEMO';const row=E.allSalesSim().find(r=>r.card===card);
    const tokD=E.galDaVenda(card);const galFila=(S.galFila||[]).some(x=>x.token===tokD); // v96-ux (pendência das ondas): venda de sessão demo não publica a galeria
    const audit=E.auditRead().find(e=>e.acao==='modo_demo');
    return {card,demo:s&&s.demo,flag:JSON.stringify(S.flagUse||{})===fu0,inv:JSON.stringify(S.invalid||{})===inv0,teste:ev&&ev.teste,fila:f1===f0,row:row&&row.status,tokD:!!tokD,galFila,alvo:audit&&audit.alvo,posto:E.postoNome()};});
  ok(r7.demo===1,'7a: sessão do modo demonstração sem a marca demo:1: '+J(r7));
  ok(r7.flag&&r7.inv,'7a: bandeira ou foto inválida da sessão demo contaram: '+J(r7));
  ok(r7.teste&&r7.fila,'7a: venda da sessão demo foi para a fila do servidor: '+J(r7));
  ok(r7.row==='teste','7a: venda da sessão demo na receita: '+J(r7));
  ok(r7.tokD&&!r7.galFila,'7a: venda da sessão demo publicou a galeria (fila de envio): '+J(r7));
  ok(await A.evaluate(()=>{const E=ETERNA,S=E.SIM;const c=E.demoSessions().find(x=>!(S.sessions[x.card]||{}).demo).card;S.sessions[c]=Object.assign(S.sessions[c]||{},{status:'paga'});const t=E.galDaVenda(c);return (S.galFila||[]).some(x=>x.token===t);}),'7a: venda normal deixou de publicar a galeria');
  ok(r7.alvo===r7.posto&&r7.alvo!=='aparelho','7b: auditoria do modo demonstração com o posto: '+J(r7));
  // venda normal (sem demo) continua subindo
  ok(await A.evaluate(async()=>{const E=ETERNA;const ev=E.pvEvento('criar','V-REAL-1',{card:'LPNAOEXISTE'});await new Promise(r=>setTimeout(r,300));return !ev.teste&&E.pvFila().some(x=>x.venda==='V-REAL-1');}),'7a: venda normal deixou de ir para a fila');
  // ---- 7b: expira em 4 h e desliga no logout
  ok(await A.evaluate(()=>{localStorage.setItem('eterna.demo.em',String(Date.now()-4*3600e3-1000));return ETERNA.demoOn()===false&&localStorage.getItem('eterna.demo.v1')===null;}),'7b: modo demonstração não expirou em 4 h');
  await A.evaluate(()=>{localStorage.setItem('eterna.demo.v1','1');localStorage.setItem('eterna.demo.em',String(Date.now()));});ok(await A.evaluate(()=>ETERNA.demoOn()),'7b: religar');
  await A.evaluate(()=>ETERNA.logout());await A.waitForTimeout(150);ok(await A.evaluate(()=>!ETERNA.demoOn()&&localStorage.getItem('eterna.demo.v1')===null),'7b: o logout não desligou o modo demonstração');
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-revisao: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-revisao: NSU no bloco, faixa só depois da primeira tentativa, modo demonstração (teste, logout, 4 h, posto)');
})();
