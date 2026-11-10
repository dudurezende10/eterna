// v94-ux parte L: texto técnico e tamanhos (critérios L1 a L3 do plano docs/planos/2026-11-09-ondas-ux.md; o plano chama o teste de
// ux-texto.js, aqui ondas-ux-l.js como os outros da entrega). Sem agente e com um agente falso (só /status, pelo page.route).
// Exceção documentada: Estoque pode citar "DNP" (a regra não pega DNP).
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TEC=/127\.0\.0\.1|:8765|\bporta \d|~\/Eterna|\.py\b|\bFTP\b|Photoroom|Roverpix|sandbox_|\bfase [12]\b|\bv9\d\b|simula/i;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'ondas-l-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(600,900),(40,120,200)).save(sys.argv[1]+'/a.jpg',quality=70)",TMP]);const IMG=fs.readFileSync(TMP+'/a.jpg');
async function entrar(pg,email){await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
// texto visível da tela inteira (menu + tela) e o menor corpo de letra entre os elementos com texto visível
const ler=(pg,raiz,min)=>pg.evaluate(([raiz,min])=>{const R=document.querySelector(raiz)||document.body;const peq=[];
  const w=document.createTreeWalker(R,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(!n.nodeValue.trim())continue;const e=n.parentElement;if(!e||!e.getClientRects().length)continue;const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0||s.display==='none')continue;
    if(e.closest('svg,[aria-hidden="true"],.wm,.lj-eq'))continue;const fs=parseFloat(s.fontSize);if(fs<min)peq.push((e.className||e.tagName)+' '+fs+'px "'+n.nodeValue.trim().slice(0,30)+'"');}
  return {t:(document.querySelector('.app')||document.body).innerText,peq:[...new Set(peq)].slice(0,8)};},[raiz,min]);
// L3: caixa de toque ≥ 44×44 (o label que envolve o checkbox conta)
const toque=pg=>pg.evaluate(()=>{const out=[];document.querySelectorAll('button,a,input[type=checkbox]').forEach(e=>{if(!e.getClientRects().length)return;const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0)return;if(e.closest('.lj-eq'))return;
  let r=e.getBoundingClientRect();if(e.type==='checkbox'){const l=e.closest('label');if(l)r=l.getBoundingClientRect();}if(r.width<1)return;if(r.width<43.5||r.height<43.5)out.push((e.dataset.act||e.className||e.tagName)+' '+Math.round(r.width)+'×'+Math.round(r.height));});return [...new Set(out)].slice(0,8);});
const PERFIS=[['carlos@eterna.photo','foto'],['loja@eterna.photo','venda'],['qualidade@eterna.photo','valida'],['supervisor@eterna.photo','supervisor']];
(async()=>{const b=await chromium.launch();
try{
  // ---- L1 e L2 (equipe): cada perfil pronto que não é Admin, cada tela do menu, sem e com o agente
  for(const ag of [false,true]){
    for(const [email,k] of PERFIS){const ctx=await b.newContext({viewport:{width:1366,height:768}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
      if(ag)await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,card:null,copied:0,dups:0,ftp:null,rostos:null,recorte:{ok:true}})}));
      const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(k+': '+e.message));await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(350);
      ok(await entrar(pg,email),k+': não entrou');await pg.waitForTimeout(ag?600:100);
      const vs=await pg.$$eval('#nav button[data-v]',bs=>bs.map(b=>b.dataset.v));const ruins=[],peqs=[];
      for(const v of ['perfis',...vs]){await pg.evaluate(v=>ETERNA.go(v),v);await pg.waitForTimeout(250);
        const tabs=await pg.$$eval('#main [data-act="cat-tab"]',x=>x.map(e=>e.dataset.t));const passes=tabs.length?tabs:[null];
        for(const t of passes){if(t){if(t==='avancado')continue; /* Avançado é a aba técnica (plano, I3) */await pg.evaluate(t=>{ETERNA.state.catTab=t;ETERNA.render();},t);await pg.waitForTimeout(120);}
          const r=await ler(pg,'.app',12);const m=r.t.match(TEC);if(m)ruins.push(v+(t?'/'+t:'')+': "'+m[0]+'" em …'+r.t.slice(Math.max(0,m.index-40),m.index+30).replace(/\s+/g,' ')+'…');if(r.peq.length)peqs.push(v+': '+r.peq.join(' ; '));}}
      ok(!ruins.length,`L1 ${k}${ag?' (agente)':''}: texto técnico: `+ruins.join(' | '));
      if(!ag)ok(!peqs.length,`L2 ${k}: letra < 12 px: `+peqs.join(' | '));
      await ctx.close();}}
  // ---- L2 e L3 (cliente): Checkout em 1920 e 390, todas as etapas; galeria em 390
  const ctx=await b.newContext({viewport:{width:1920,height:1080}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:IMG}));
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);await entrar(A,'eduardo@eduardorezende.com');
  const L=await ctx.newPage();L.on('pageerror',e=>errs.push('L: '+e.message));await L.goto(U+'#loja');await L.waitForTimeout(900);
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>ETERNA.lojaItems(s.card).filter(x=>x.t==='ph').length>=6).map(s=>s.card));
  const etapa=async(nome)=>{await L.waitForTimeout(250);const r=await ler(L,'#main',14);const t=await toque(L);return {nome,peq:r.peq,t};};
  for(const [w,h] of [[1920,1080],[390,844]]){await L.setViewportSize({width:w,height:h});const card=cards[w===390?1:0];const res=[];
    await L.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;ETERNA.lojaReset();ETERNA.render();});res.push(await etapa('câmera'));
    await L.click('[data-act="kiosk-emerg"]');res.push(await etapa('código'));
    await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');await L.waitForTimeout(400);res.push(await etapa('escolha'));
    await L.evaluate(()=>{ETERNA.state.kiosk.ver=null;ETERNA.render();});res.push(await etapa('todas'));
    // v96-ux: etapas da v96 (sem pacote nem pagamento no cliente): Pronto, valor (o caixa escolhe no Posto) e a tela final
    await L.evaluate(c=>{const it=ETERNA.lojaItems(c).filter(x=>x.t==='ph');const pk=ETERNA.lojaPick(c);it.slice(0,4).forEach(x=>pk[x.k]='ok');ETERNA.lojaPedir();},card);await L.waitForTimeout(450);res.push(await etapa('pronto'));
    const p=await A.evaluate(c=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).find(x=>x.card===c&&(x.estado==='aguardando'||x.estado==='escolha')),card);
    if(p){await A.evaluate(id=>{ETERNA.simFresh();const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);ETERNA.pendEscolher(id,{pkg:ETERNA.lojaIdeal(r.n).pkg});ETERNA.pendEscolher(id,{meio:'cartao'});},p.id);await L.waitForTimeout(700);res.push(await etapa('valor'));
      await A.evaluate(id=>ETERNA.pendConfirmar(id,{ref:''}),p.id);}else ok(false,'L: pedido do Checkout não chegou ao Posto');
    await L.waitForTimeout(1200);res.push(await etapa('final'));
    res.forEach(r=>{ok(!r.peq.length,`L2 Checkout ${w} ${r.nome}: letra < 14 px: `+r.peq.join(' ; '));ok(!r.t.length,`L3 Checkout ${w} ${r.nome}: toque < 44 px: `+r.t.join(' ; '));});
    if(w===390){const tok=await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.token);const G=await ctx.newPage();G.on('pageerror',e=>errs.push('G: '+e.message));await G.setViewportSize({width:390,height:844});await G.goto(U+'#g/'+(tok||'tokenqualquer123456'));await G.waitForTimeout(700);
      const r=await ler(G,'#main',14);const t=await toque(G);ok(!r.peq.length,'L2 galeria 390: letra < 14 px: '+r.peq.join(' ; '));ok(!t.length,'L3 galeria 390: toque < 44 px: '+t.join(' ; '));await G.close();}}
  ok(!errs.length,'erros de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA ondas-ux-l: '+fails.join(' || '));process.exit(1);}
console.log('OK ondas-ux-l: sem texto técnico fora do Admin, letra mínima de 12 px na equipe e 14 px no cliente, alvos de 44 px no Checkout e na galeria');
})();
