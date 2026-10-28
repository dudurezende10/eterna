// v80: Painel no Dashboard (substitui a Semana). Critérios 1 a 29 de docs/planos/2026-10-28-v83-painel.md.
// Sobe um LIVE de teste com ETERNA.applyLive (14 e 30 dias, 2 pontos, nomes maliciosos) e o agente (critério 25) num HOME temporário.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');const {spawn}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const P=__dirname+'/prints';fs.mkdirSync(P,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function nova(b,w,h,extra){const ctx=await b.newContext({viewport:{width:w||1440,height:h||900},locale:'pt-BR',...(extra||{})});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort()); /* critério 17: fontes do Google bloqueadas */
  const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
  let dialogo=false;pg.on('dialog',d=>{dialogo=true;d.dismiss().catch(()=>{});});pg.dialogo=()=>dialogo;return {ctx,pg};}
async function sair(pg){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.goto(U);await pg.reload();await pg.waitForTimeout(350);}
async function entrar(pg,email,hash){await pg.goto(U+(hash||''));await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await sair(pg);if(hash){await pg.goto(U+hash);await pg.waitForTimeout(300);}}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(450);return pg.evaluate(()=>!!ETERNA.state.user);}
const view=pg=>pg.evaluate(()=>ETERNA.state.view);
const abrir=(pg,from,to,fonte,pdv)=>pg.evaluate(([f,t,fo,pd])=>{ETERNA.state.range={from:f,to:t};ETERNA.state.painel={fonte:fo||'tudo',pdv:pd||''};ETERNA.state.view='painel';ETERNA.render();},[from,to,fonte,pdv]);
const txt=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\s+/g,' ').trim():null;},s);
const main=pg=>pg.evaluate(()=>document.querySelector('#main').innerText);
// LIVE de teste: n dias até hoje (fuso do venue); 2 pontos (um com aspas e HTML no nome); produto com HTML; receita muda por dia
function mkLive(n,o){o=o||{};const t=ETERNA.venueToday();const add=(iso,k)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+k)).toISOString().slice(0,10);};
  const PQ='Ponto "Aspas" <b>x</b>';const per=o.orders||6;const days={};
  for(let i=0;i<n;i++){const d=add(t,-i);const base=o.queda?(100+i*15):(400-i*12);const orders=[];
    for(let k=0;k<per;k++){const pdv=k%2?'Foto Campo 2':PQ;const paga=k%5!==4;const prods=k%3===0?['Pacote Gramado']:k%3===1?['Pacote Arquibancada','Foto adicional impressa e digital']:['<img src=x onerror=alert(1)>'];
      orders.push({id:d+'-'+k,time:'10:'+String(k%60).padStart(2,'0'),card:'C'+i+'-'+k,vendor:'Ana',total:base+k,status:paga?'paga':'cancelada',prints:k%3===2?0:2,photos:k%3===0?6:2,products:prods,pay:[k%2?'pix':'credit_card'],key:k%2?'yago':'marinara',pdv});}
    const pagas=orders.filter(x=>x.status==='paga');const rev=pagas.reduce((a,x)=>a+x.total,0);const pay={};pagas.forEach(x=>{const m=x.pay[0];pay[m]=pay[m]||{count:0,amount:0};pay[m].count++;pay[m].amount+=x.total;});
    days[d]={daily:{approaches:per,viewed:per-1,converted:pagas.length,sales:pagas.length,revenue:rev,prints:pagas.reduce((a,x)=>a+x.prints,0),reprints:1,photos:200,photosSold:pagas.reduce((a,x)=>a+x.photos,0),pax:null},
      sellers:{Ana:{total:per+1,done:pagas.length,pending:0,discarded:1,canceled:per-pagas.length,revenue:rev,photosSold:0,prints:0,reprints:0}},payments:pay,products:{},
      rows:{yago:{photos:120,cards:12,cardsSold:5,photosSold:10,revenue:rev/2},marinara:{photos:80,cards:10,cardsSold:4,photosSold:8,revenue:rev/2}},
      people:{yago:{name:'Yago',human:true,pdv:'Foto Campo 2'},marinara:{name:'Marinara',human:true,pdv:PQ}},orders,sessions:[]};}
  const dt=new Date(Date.now()-(o.velho?20*60e3:60e3));const p2=x=>String(x).padStart(2,'0');
  const upd=`${dt.getFullYear()}-${p2(dt.getMonth()+1)}-${p2(dt.getDate())}T${p2(dt.getHours())}:${p2(dt.getMinutes())}:${p2(dt.getSeconds())}`;
  return {ok:true,updated:upd,status:'ok',days};}
const MK=mkLive.toString();
const live=(pg,n,o)=>pg.evaluate(([src,n,o])=>{const f=new Function('return '+src)();ETERNA.applyLive(f(n,o));return Object.keys(ETERNA.live.days).length;},[MK,n,o||{}]);
const dvz=()=>{const d=new Date();return d;};
function req(porta,p,headers){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:porta,method:'GET',path:p,headers:headers||{}},rs=>{const ch=[];rs.on('data',c=>ch.push(c));rs.on('end',()=>res({s:rs.statusCode,h:rs.headers,b:Buffer.concat(ch).toString()}));});r.on('error',e=>res({s:0,err:String(e)}));r.end();});}

(async()=>{const b=await chromium.launch();let agente=null;const home=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-painel-'));
try{
  // ---------- 1, 2, 4, 27: admin ----------
  const {ctx,pg}=await nova(b,1440,900);ok(await entrar(pg,'eduardo@eduardorezende.com'),'2: admin não entrou');
  ok(await view(pg)==='painel'&&await pg.evaluate(()=>location.hash)==='#painel','2: admin deveria cair em #painel: '+await view(pg));
  const dash=await pg.$$eval('#nav .navg',gs=>{const g=gs.find(x=>x.querySelector('.grp').textContent.trim()==='Dashboard');return g?[...g.querySelectorAll('button[data-v]')].map(x=>x.textContent.trim().split('\n')[0]):[];});
  const dashV=await pg.$$eval('#nav .navg',gs=>{const g=gs.find(x=>x.querySelector('.grp').textContent.trim()==='Dashboard');return g?[...g.querySelectorAll('button[data-v]')].map(x=>x.dataset.v):[];});
  ok(J(dashV)===J(['painel','bandeiras','estoque','fotografos','vendas','vendas-lista','galerias']),'1: ordem do Dashboard '+J(dashV));ok(!(await pg.$('#nav [data-v="semana"]')),'1: Semana ainda no menu');
  await pg.click('#rail-brand');await pg.waitForTimeout(120);ok(await view(pg)==='perfis','2: logo deveria abrir o Início');
  await pg.evaluate(()=>{location.hash='#semana';});await pg.waitForTimeout(200);ok(await view(pg)==='painel','4: #semana deveria abrir o Painel: '+await view(pg));
  // FTP sem o agente: o cartão aparece no Painel de controle, desligado, com a pílula e a nota
  await pg.evaluate(()=>ETERNA.go('catalogo'));await pg.waitForTimeout(120);
  const fo=await pg.evaluate(()=>{const p=document.querySelector('.rftp-off');return p&&{t:p.textContent,dis:[...p.querySelectorAll('input')].every(i=>i.disabled),save:!!p.querySelector('[data-act="rf-save"]')};});
  ok(fo&&/Servidor FTP do estádio/.test(fo.t)&&/agente desconectado/.test(fo.t)&&/Abra o Eterna pelo agente do ponto \(http:\/\/127\.0\.0\.1:8765\) neste computador para configurar o FTP\. A senha fica só nesse computador\./.test(fo.t)&&fo.dis&&!fo.save,'FTP sem agente: '+J(fo&&{dis:fo.dis,save:fo.save}));
  // 27: Vendas e caixa só com vendedores e o link para o Painel; o Painel sem a tabela de vendedores
  await pg.evaluate(()=>{ETERNA.state.range={from:'2026-10-07',to:'2026-10-15'};ETERNA.state.view='vendas';ETERNA.render();});await pg.waitForTimeout(120);
  const vh=await pg.$$eval('#main h2',e=>e.map(x=>x.textContent.trim()));ok(vh.includes('Vendedores')&&!vh.includes('Pagamentos')&&!vh.includes('Produtos'),'27: Vendas e caixa '+J(vh));ok(await pg.$('#main [data-act="view"][data-v="painel"]'),'27: Vendas e caixa sem o link para o Painel');
  // ---------- 6, 7, 8, 9: modo importado, 07 a 15/10, fonte Roverpix ----------
  await abrir(pg,'2026-10-07','2026-10-15','roverpix');await pg.waitForTimeout(150);
  const k=async kk=>(await txt(pg,`.pn-kpi[data-k="${kk}"]`)||'').replace(/\u00a0/g,' ');
  const kr=await k('receita'),kf=await k('fotos'),ks=await k('sessoes'),kg=await k('gasto');
  ok(/R\$ ?115\.397/.test(kr)&&/Ticket médio R\$ 133/.test(kr)&&/868 vendas/.test(kr),'6: Faturamento '+kr);
  ok(/28\.793/.test(kf)&&/6\.811 vendidas/.test(kf)&&/24%/.test(kf),'6: Fotos '+kf);ok(/2\.408/.test(ks)&&/1\.349 compraram/.test(ks)&&/56%/.test(ks),'6: Sessões '+ks);ok(/R\$ ?16\b/.test(kg)&&/7\.300 visitantes/.test(kg),'6: Gasto por visitante '+kg);
  const dz=await pg.$$eval('.pn-donut-row',rs=>rs.map(r=>({c:r.querySelector('.c b')?r.querySelector('.c b').textContent:'',pcs:[...r.querySelectorAll('.pn-leg .pc')].map(x=>x.textContent),leg:r.querySelector('.pn-leg').innerText})));
  ok(dz[0]&&dz[0].c==='67%'&&dz[0].pcs[2]==='<1%'&&/868/.test(dz[0].leg)&&/424/.test(dz[0].leg),'7: rosca Vendas '+J(dz[0]));
  dz.forEach((d,i)=>{const s=d.pcs.reduce((a,x)=>a+(parseInt(x)||0),0);ok(s===100||d.pcs.includes('<1%'),'7: rosca '+i+' não soma 100: '+J(d.pcs));});
  const rk=await pg.$$eval('.pn-rank li',ls=>ls.map(l=>({nm:l.querySelector('.nm').childNodes[0].textContent.trim(),det:(l.querySelector('.nm small')||{}).textContent||'',rv:l.querySelector('.rv').textContent.replace(/\u00a0/g,' '),top:l.classList.contains('top'),off:l.classList.contains('off')})));
  const nomes=rk.map(r=>r.nm);['Maracanã Mais','Tribuna de Honra','Maracanã','Gramado','Zona Mista','Arquibancada','Foto adicional','Outros (catálogo antigo)'].forEach(n=>ok(nomes.includes(n),'8: ranking sem '+n+' '+J(nomes)));
  ok(rk[0]&&rk[0].nm==='Maracanã Mais'&&rk[0].top&&/104 pacotes · 3\.294 fotos/.test(rk[0].det)&&rk[0].rv==='R$ 26.000','8: Maracanã Mais '+J(rk[0]));
  const fa=rk.find(r=>r.nm==='Foto adicional');ok(fa&&/268 unid\./.test(fa.det)&&fa.rv==='R$ 6.515','8: Foto adicional '+J(fa));ok(!nomes.some(n=>/cortesia/i.test(n)),'8: cortesia no ranking');
  const offI=rk.map((r,i)=>r.off?i:-1).filter(i=>i>=0);ok(offI.length&&offI.every(i=>i>=rk.length-offI.length)&&rk.filter(r=>r.off).every(r=>r.rv==='sem venda'),'8: itens sem venda no fim com "sem venda"');
  const somas=await pg.evaluate(()=>{const D=ETERNA.painelDados({from:'2026-10-07',to:'2026-10-15',fonte:'roverpix'});return {rk:D.produtos.reduce((a,p)=>a+p.receita,0)};});ok(Math.abs(somas.rk-(115397-0))<=1,'8: soma do ranking '+somas.rk+' (produtos sem cortesia somam 115.397)');
  const pay=await pg.evaluate(()=>({tot:document.querySelector('.pn-pay tfoot .rcv').textContent.replace(/\u00a0/g,' '),cc:[...document.querySelectorAll('.pn-pay tbody tr:not(.barrow)')].map(r=>r.innerText.replace(/\s+/g,' ')).find(x=>/Cartão de crédito/.test(x)),take:[...document.querySelectorAll('.pn-panel')].find(p=>/Pagamentos/.test(p.querySelector('h2').textContent)).querySelector('.pn-take').textContent}));
  ok(pay.tot==='R$ 115.397'&&/56%/.test(pay.cc)&&/Cartão de crédito responde por 56%/.test(pay.take),'9: pagamentos '+J(pay));
  await pg.screenshot({path:P+'/painel-1440.png',fullPage:true});
  // 22: parte do período importado: pill "total de 07/10 a 15/10" e sem seta
  await abrir(pg,'2026-10-10','2026-10-12','roverpix');await pg.waitForTimeout(100);
  const p22=await pg.evaluate(()=>({pills:[...document.querySelectorAll('.pn-total')].map(x=>x.textContent),setas:[...document.querySelectorAll('.pn-comp .pn-delta,.pn-bottom .pn-delta')].length}));ok(p22.pills.length===4&&p22.pills.every(x=>/total de 07\/10 a 15\/10/.test(x))&&!p22.setas,'22: '+J(p22));
  // 19: 1 dia sem Receita por dia; N dias, N colunas, só melhor e pior com valor, título com o melhor dia
  await abrir(pg,'2026-10-10','2026-10-10','roverpix');await pg.waitForTimeout(80);ok(!(await pg.$('.pn-rd')),'19: Receita por dia com 1 dia');
  await abrir(pg,'2026-10-07','2026-10-15','roverpix');await pg.waitForTimeout(80);
  const p19=await pg.evaluate(()=>({n:document.querySelectorAll('.pn-day').length,v:document.querySelectorAll('.pn-day .val').length,best:document.querySelector('.pn-day.best .val').textContent,t:document.querySelector('.pn-rd .pn-take').textContent}));
  ok(p19.n===9&&p19.v===2&&/18\.682/.test(p19.best)&&/Melhor dia sáb 10\/10, R\$\s18\.682/.test(p19.t),'19: '+J(p19));
  // 23: CSV
  const csv=await pg.evaluate(()=>{const D=ETERNA.painelDados({from:'2026-10-07',to:'2026-10-15',fonte:'roverpix'});return {c:ETERNA.painelCSV(D),k:D.kpi,inj:ETERNA.painelCSV({dias:[{date:'=1+1',pax:1,sessoes:1,viram:1,compraram:1,fotos:1,fotosVendidas:1,vendas:1,receita:1}],kpi:{receita:1,vendas:1,fotosVendidas:1}})};});
  const ls=csv.c.split('\n');const tot=ls[ls.length-1].split(';');
  ok(ls.length===11&&ls[0].split(';').length===9&&tot[0]==='total'&&+tot[8]===csv.k.receita&&+tot[7]===csv.k.vendas&&+tot[2]===csv.k.sessoes,'23: CSV '+J(ls.slice(-2)));ok(/(^|\n)'=1\+1;/.test(csv.inj),'23: célula com = sem aspa simples');
  const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('[data-act="pn-csv"]')]);ok(dl.suggestedFilename()==='eterna-painel-2026-10-07_2026-10-15.csv','23: nome do arquivo '+dl.suggestedFilename());
  // 12 (sem LIVE): select de ponto desabilitado com a explicação
  const p12=await pg.evaluate(()=>({dis:document.querySelector('[data-act="pn-pdv"]').disabled,nota:document.querySelector('.pn-notas').textContent}));ok(p12.dis&&/filtro de ponto/.test(p12.nota),'12: ponto sem LIVE '+J(p12));
  // 20: svg, aria-pressed, teclado, dica com foco, sem amarelo ou cinza museu em texto sobre branco
  const a20=await pg.evaluate(()=>{const svgs=[...document.querySelectorAll('#main .pn svg[role="img"]')];const roles=[...document.querySelectorAll('.pn-donut svg')].every(s=>s.getAttribute('role')==='img'&&/\d/.test(s.getAttribute('aria-label')||''));
    const chips=[...document.querySelectorAll('.rangebar button[data-act^="range"]')].every(c=>c.hasAttribute('aria-pressed')),seg=[...document.querySelectorAll('[data-act="pn-fonte"]')].every(c=>c.hasAttribute('aria-pressed'));
    const ruins=[];document.querySelectorAll('#main *').forEach(el=>{if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const c=getComputedStyle(el).color;if(c==='rgb(255, 184, 0)'||c==='rgb(217, 217, 214)')ruins.push(el.className+':'+el.textContent.slice(0,20));});
    return {n:svgs.length,roles,chips,seg,ruins};});
  ok(a20.n>=2&&a20.roles&&a20.chips&&a20.seg&&!a20.ruins.length,'20: '+J(a20));
  await pg.focus('[data-act="range"][data-f="'+await pg.evaluate(()=>ETERNA.venueToday())+'"]');await pg.keyboard.press('Enter');await pg.waitForTimeout(120);
  ok(await pg.evaluate(()=>ETERNA.state.range.from===ETERNA.venueToday()&&ETERNA.state.range.to===ETERNA.venueToday()),'20: chip Hoje pelo teclado');
  await abrir(pg,'2026-10-07','2026-10-15','tudo');await pg.focus('[data-act="pn-fonte"][data-v="eterna"]');await pg.keyboard.press('Enter');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.painel.fonte==='eterna'&&document.querySelector('[data-act="pn-fonte"][data-v="eterna"]').getAttribute('aria-pressed')==='true'),'20: fonte pelo teclado');
  await abrir(pg,'2026-10-07','2026-10-15','roverpix');await pg.focus('.pn-day.best');await pg.waitForTimeout(80);const tip=await pg.evaluate(()=>{const t=document.getElementById('tip');return {h:t.hidden,t:t.textContent};});ok(!tip.h&&/18\.682/.test(tip.t),'20: dica com foco '+J(tip));
  // 21: hoje sem LIVE e sem venda do Eterna: só os cartões com "—" e o alerta com o botão para o período importado
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.sessions={};S.vendasOnline=[];S.caixaDin=[];});const hoje=await pg.evaluate(()=>ETERNA.venueToday());
  await abrir(pg,hoje,hoje,'tudo');await pg.waitForTimeout(80);
  const p21=await pg.evaluate(()=>({kp:[...document.querySelectorAll('.pn-kpi .pn-big')].map(x=>x.textContent),btn:!!document.querySelector('.pn .alert [data-act="range"]'),bt:(document.querySelector('.pn .alert [data-act="range"]')||{}).textContent,outros:document.querySelectorAll('.pn-donut,.pn-rank,.pn-pay,.pn-funnel').length}));
  ok(p21.kp.length===4&&p21.kp.every(x=>x==='—')&&p21.btn&&/Ver 07\/10 a 15\/10/.test(p21.bt)&&!p21.outros,'21: '+J(p21));
  await pg.click('.pn .alert [data-act="range"]');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>ETERNA.state.range.from==='2026-10-07'&&ETERNA.state.range.to==='2026-10-15'),'21: o botão deveria mudar o período');
  // 10: venda simulada no Checkout hoje (Gramado, PIX, R$ 150); online de teste; dinheiro aguardando caixa
  await pg.evaluate(()=>{const S=ETERNA.SIM;const at=new Date().toISOString();S.sessions['LPTPAINEL1']={key:'carlos',pdv:'Foto Campo 2',time:'10:00',date:'hoje',status:'paga',selected:[],cart:[{id:'gramado',v:150}],total:150,payment:'PIX',paidAt:at,nFotos:6,prints:6,saleNo:'E900',seller:'Checkout'};
    S.vendasOnline.push({id:'ON-T1',card:'LPTPAINEL1',n:2,total:78,pay:'simulado',teste:true,at});
    S.caixaDin.push({id:'D-T1',card:'LPTPAINEL2',estado:'aguardando',criada:at,total:70,cart:[{id:'arq',v:70}],codigo:'ABCD-1234',n:1,prints:1});localStorage.setItem('eterna.sim.v1',JSON.stringify(S));});
  await abrir(pg,hoje,hoje,'eterna');await pg.waitForTimeout(100);
  const e10=await pg.evaluate(h=>{const D=ETERNA.painelDados({from:h,to:h,fonte:'eterna'});const g=D.produtos.find(p=>p.id==='gramado');const px=D.pagamentos.find(p=>p.id==='pix');return {r:D.kpi.receita,v:D.kpi.vendas,g:g&&g.pacotes,px:px&&[px.transacoes,px.recebido],tot:D.pagamentos.reduce((a,p)=>a+p.recebido,0),ag:D.aguardandoCaixa,nota:(document.querySelector('.pn-bottom')||{}).innerText||''};},hoje);
  ok(e10.r===150&&e10.v===1&&e10.g===1&&J(e10.px)===J([1,150])&&e10.tot===150,'10: fonte Eterna '+J(e10));ok(e10.ag.n===1&&e10.ag.total===70&&/Dinheiro aguardando caixa: 1/.test(e10.nota),'10: dinheiro aguardando só na nota '+J(e10.ag));
  ok(/R\$ ?150/.test((await k('receita'))),'10: cartão de Faturamento com a venda do Eterna');
  ok(await pg.evaluate(h=>ETERNA.painelDados({from:h,to:h,fonte:'roverpix'}).kpi.receita===0,hoje),'10: fonte Roverpix mostrou a venda do Eterna');
  // 14 (sem LIVE): 4 atalhos × 3 fontes; Fotógrafos e Vendas; Klássius e Sandessa "sem dados" apagados
  const ruim=/\b(null|NaN|undefined|Infinity)\b/;const chips=async()=>pg.$$eval('.rangebar [data-act="range"]',e=>e.slice(0,4).map(x=>[x.dataset.f,x.dataset.t]));
  for(const [f,t] of await chips())for(const fo of ['tudo','roverpix','eterna']){await abrir(pg,f,t,fo);const m=await main(pg);ok(!ruim.test(m),`14: Painel sem LIVE ${f}..${t} ${fo}: `+(m.match(ruim)||[''])[0]);}
  await pg.evaluate(()=>{ETERNA.state.range={from:'2026-10-07',to:'2026-10-15'};ETERNA.state.view='fotografos';ETERNA.render();});await pg.waitForTimeout(100);ok(!ruim.test(await main(pg)),'14: Fotógrafos com null/NaN');
  const kl=await pg.evaluate(()=>[...document.querySelectorAll('.pcard')].filter(c=>/Kl[aá]ssius|Sandessa/.test(c.querySelector('.nm').textContent)).map(c=>{const i=c.querySelector('.idx');return [i.textContent,i.classList.contains('none'),getComputedStyle(i).color];}));
  ok(kl.length===2&&kl.every(([t,n,c])=>t==='sem dados'&&n&&c!=='rgb(179, 64, 42)'),'14: Klássius e Sandessa '+J(kl));
  await pg.screenshot({path:P+'/fotografos-1440.png',fullPage:true});
  // 16: tabelas de Fotógrafos e Vendas sem corte a 1440
  const tw=async()=>pg.$$eval('#main .tablewrap',e=>e.map(x=>x.scrollWidth<=x.clientWidth+1));ok((await tw()).every(Boolean),'16: tabela de Fotógrafos cortada');
  await pg.evaluate(()=>{ETERNA.state.view='vendas';ETERNA.render();});await pg.waitForTimeout(80);ok(!ruim.test(await main(pg)),'14: Vendas com null/NaN');ok((await tw()).every(Boolean),'16: tabela de Vendedores cortada');
  // 13: navegador em inglês: datas em dd/mm/aaaa em Painel, Fotógrafos, Vendas, Qualidade e Galerias
  {const {ctx:c2,pg:p2}=await nova(b,1440,900,{locale:'en-US'});await entrar(p2,'eduardo@eduardorezende.com');const mmdd=/\b10\/(0[7-9]|1[0-5])\/2026\b/;
    for(const v of ['painel','fotografos','vendas']){await p2.evaluate(v=>{ETERNA.state.range={from:'2026-10-07',to:'2026-10-15'};ETERNA.state.view=v;ETERNA.render();},v);await p2.waitForTimeout(80);
      const d=await p2.$$eval('.rangebar .datef-t',e=>e.map(x=>x.textContent));ok(J(d)===J(['07/10/2026','15/10/2026']),'13: datas em '+v+' '+J(d));ok(!mmdd.test(await main(p2)),'13: data mm/dd em '+v);}
    await p2.evaluate(()=>{ETERNA.state.revFilter.date='2026-10-12';ETERNA.state.view='revisao';ETERNA.render();});await p2.waitForTimeout(100);ok((await p2.$$eval('.datef-t',e=>e.map(x=>x.textContent))).includes('12/10/2026'),'13: data na Qualidade');
    await p2.evaluate(()=>{ETERNA.state.gal.tab='grupos';ETERNA.state.view='galerias';ETERNA.render();});await p2.waitForTimeout(80);const nv=await p2.$('[data-act="gal-ev-novo"]');if(nv){await nv.click();await p2.waitForTimeout(100);await p2.evaluate(()=>{const i=document.querySelector('[data-act="gal-ev-data"]');i.value='2026-10-09';i.dispatchEvent(new Event('change',{bubbles:true}));});await p2.waitForTimeout(100);
      ok((await p2.$$eval('.datef-t',e=>e.map(x=>x.textContent))).includes('09/10/2026'),'13: data no grupo de Galerias');}else ok(false,'13: Galerias sem "novo grupo"');
    await c2.close();}
  // ---------- LIVE de teste ----------
  ok(await live(pg,14)===14,'LIVE de 14 dias não entrou');await pg.evaluate(()=>{ETERNA.state.view='painel';ETERNA.render();});await pg.waitForTimeout(80);
  // 11: 7 dias com o período anterior inteiro: seta e % batem; 30 dias: sem seta
  const t7=await pg.evaluate(()=>{const t=ETERNA.venueToday();const a=ETERNA.painelDados({from:t,to:t,fonte:'roverpix'});return t;});
  await pg.click('[data-act="range"]:nth-of-type(3)');await pg.waitForTimeout(80);await pg.evaluate(()=>{ETERNA.state.painel.fonte='roverpix';ETERNA.render();});await pg.waitForTimeout(80);
  const d11=await pg.evaluate(()=>{const r=ETERNA.state.range;const D=ETERNA.painelDados({from:r.from,to:r.to,fonte:'roverpix'});const el=document.querySelector('.pn-kpi[data-k="receita"] .pn-delta');return {cur:D.kpi.receita,prev:D.prevKpi&&D.prevKpi.receita,txt:el&&el.textContent,cls:el&&el.className,dias:D.range.dias};});
  const esp=Math.round(Math.abs(d11.cur-d11.prev)/d11.prev*100);ok(d11.dias===7&&d11.prev>0&&d11.txt&&d11.txt.includes(esp+'%')&&/up|down/.test(d11.cls)&&((d11.cur>d11.prev)===/▲/.test(d11.txt)),'11: seta de 7 dias '+J(d11)+' esperado '+esp);
  await pg.screenshot({path:P+'/painel-live-1440.png',fullPage:true});
  // revisão 4: fonte Tudo com venda do Eterna no período: sem seta de faturamento (o anterior só tem a Roverpix); sessões continuam com seta
  await pg.evaluate(()=>{ETERNA.state.painel.fonte='tudo';ETERNA.render();});await pg.waitForTimeout(80);
  const r4=await pg.evaluate(()=>({rec:!!document.querySelector('.pn-kpi[data-k="receita"] .pn-delta'),ses:!!document.querySelector('.pn-kpi[data-k="sessoes"] .pn-delta'),et:ETERNA.painelDados({from:ETERNA.state.range.from,to:ETERNA.state.range.to,fonte:'eterna'}).kpi.vendas}));
  ok(r4.et>0&&!r4.rec&&r4.ses,'revisão 4: '+J(r4));await pg.evaluate(()=>{ETERNA.state.painel.fonte='roverpix';});
  await pg.evaluate(()=>{const t=ETERNA.venueToday();const[y,m,d]=t.split('-').map(Number);ETERNA.state.range={from:new Date(Date.UTC(y,m-1,d-29)).toISOString().slice(0,10),to:t};ETERNA.render();});await pg.waitForTimeout(80);ok(!(await pg.$('.pn-delta')),'11: 30 dias sem o anterior nos dados não deveria ter seta');
  // queda: ▼ com --pn-down, nunca vermelho
  await live(pg,14,{queda:true});await pg.evaluate(()=>{const t=ETERNA.venueToday();const[y,m,d]=t.split('-').map(Number);ETERNA.state.range={from:new Date(Date.UTC(y,m-1,d-6)).toISOString().slice(0,10),to:t};ETERNA.render();});await pg.waitForTimeout(80);
  const dn=await pg.evaluate(()=>{const e=document.querySelector('.pn-kpi[data-k="receita"] .pn-delta');return e&&{t:e.textContent,c:getComputedStyle(e).color,cls:e.className};});ok(dn&&/▼/.test(dn.t)&&/down/.test(dn.cls)&&dn.c==='rgb(37, 40, 42)','11: queda '+J(dn));
  // 12 (com LIVE): Foto Campo 2 = soma das orders pagas daquele ponto; funil com a nota
  await live(pg,14);await pg.evaluate(()=>{const t=ETERNA.venueToday();const[y,m,d]=t.split('-').map(Number);ETERNA.state.range={from:new Date(Date.UTC(y,m-1,d-6)).toISOString().slice(0,10),to:t};ETERNA.state.painel={fonte:'roverpix',pdv:'Foto Campo 2'};ETERNA.render();});await pg.waitForTimeout(100);
  const p12b=await pg.evaluate(()=>{const r=ETERNA.state.range;const D=ETERNA.painelDados({from:r.from,to:r.to,fonte:'roverpix',pdv:'Foto Campo 2'});let s=0;Object.entries(ETERNA.live.days).forEach(([d,a])=>{if(d>=r.from&&d<=r.to)a.orders.filter(o=>o.pdv==='Foto Campo 2'&&o.status==='paga').forEach(o=>s+=o.total);});
    return {r:D.kpi.receita,s,dis:document.querySelector('[data-act="pn-pdv"]').disabled,sel:document.querySelector('[data-act="pn-pdv"]').value,nota:(document.querySelector('.pn-funnel')||{}).innerText||''};});
  ok(p12b.r===p12b.s&&p12b.r>0&&!p12b.dis&&p12b.sel==='Foto Campo 2'&&/Viram no balcão" não é separado por ponto/.test(p12b.nota),'12: ponto com LIVE '+J(p12b));
  // 24: produto e ponto maliciosos viram texto (dica, option, ranking)
  await pg.evaluate(()=>{ETERNA.state.painel={fonte:'roverpix',pdv:'Ponto "Aspas" <b>x</b>'};ETERNA.render();});await pg.waitForTimeout(100);
  const x24=await pg.evaluate(()=>({opt:[...document.querySelectorAll('[data-act="pn-pdv"] option')].map(o=>o.textContent).includes('Ponto "Aspas" <b>x</b>'),sel:document.querySelector('[data-act="pn-pdv"]').value,img:document.querySelectorAll('#main img[src="x"]').length,b:document.querySelectorAll('#main option b, .pn-rank b').length,outros:[...document.querySelectorAll('.pn-rank li.old .bar')].map(e=>e.getAttribute('data-tip')).join('')}));
  await pg.focus('.pn-rank li.old .bar').catch(()=>{});await pg.waitForTimeout(80);const tip24=await pg.evaluate(()=>document.getElementById('tip').textContent);
  ok(x24.opt&&x24.sel==='Ponto "Aspas" <b>x</b>'&&!x24.img&&!x24.b&&/<img src=x onerror=alert\(1\)>/.test(x24.outros)&&/<img src=x/.test(tip24)&&!pg.dialogo(),'24: '+J(x24)+' dica '+tip24);
  // 14 (com LIVE): 4 atalhos × 3 fontes
  for(const [f,t] of await chips())for(const fo of ['tudo','roverpix','eterna']){await abrir(pg,f,t,fo,'');const m=await main(pg);ok(!ruim.test(m),`14: Painel com LIVE ${f}..${t} ${fo}: `+(m.match(ruim)||[''])[0]);}
  // 26: LIVE com mais de 15 min
  await live(pg,14,{velho:true});await abrir(pg,await pg.evaluate(()=>ETERNA.venueToday()),await pg.evaluate(()=>ETERNA.venueToday()),'tudo');const st26=await pg.evaluate(()=>(document.querySelector('.pn-head .pill.warn')||{}).textContent||'');ok(/Roverpix desatualizado desde \d\d:\d\d/.test(st26),'26: '+st26);
  // 28: 30 dias × 400 pedidos em menos de 50 ms
  await live(pg,30,{orders:400});const ms=await pg.evaluate(()=>{const t=ETERNA.venueToday();const[y,m,d]=t.split('-').map(Number);ETERNA.state.range={from:new Date(Date.UTC(y,m-1,d-29)).toISOString().slice(0,10),to:t};ETERNA.state.painel={fonte:'tudo',pdv:''};ETERNA.vPainel();const r=[];for(let i=0;i<5;i++){const a=performance.now();ETERNA.vPainel();r.push(performance.now()-a);}r.sort((a,b)=>a-b);return r[2];});
  ok(ms<50,'28: vPainel com 30 dias × 400 pedidos levou '+ms.toFixed(1)+' ms');
  await ctx.close();
  // ---------- 15, 17, 18, 29: tamanhos (modo importado) ----------
  for(const [w,h] of [[1440,900],[1024,768],[768,1024],[390,844]]){const {ctx:c3,pg:p3}=await nova(b,w,h);await entrar(p3,'eduardo@eduardorezende.com');
    for(const v of ['painel','fotografos','vendas'].concat(w===390?['catalogo']:[])){await p3.evaluate(v=>{ETERNA.state.range={from:'2026-10-07',to:'2026-10-15'};ETERNA.state.painel={fonte:'tudo',pdv:''};ETERNA.state.view=v;ETERNA.render();},v);await p3.waitForTimeout(120);
      ok(await p3.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`15: rolagem lateral em ${v} ${w}×${h}`);}
    await p3.evaluate(()=>{ETERNA.state.view='painel';ETERNA.render();});await p3.waitForTimeout(150);
    const g=await p3.evaluate(()=>{const top=s=>[...document.querySelectorAll(s)].map(e=>Math.round(e.getBoundingClientRect().top));const one=e=>{const cs=getComputedStyle(e);const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.2;return e.getBoundingClientRect().height<1.5*lh;};
      const comp=[...document.querySelectorAll('.pn-comp > .pn-panel')];const cw=document.querySelector('.pn-comp').getBoundingClientRect().width;
      return {k:top('.pn-kpi'),c:comp.map(e=>Math.round(e.getBoundingClientRect().top)),fw:Math.round(comp[2].getBoundingClientRect().width),cw:Math.round(cw),uma:[...document.querySelectorAll('.pn-big')].every(one)};});
    ok(g.uma,`17: valor do cartão quebrou linha em ${w}`);
    if(w===1440){ok(new Set(g.k).size===1&&new Set(g.c).size===1,'18: 1440 '+J(g));const fl=await p3.evaluate(()=>[...document.querySelectorAll('.rangebar .chips,.rangebar .dates,.filtros-end')].map(e=>Math.round(e.getBoundingClientRect().top+e.getBoundingClientRect().height/2)));ok(Math.max(...fl)-Math.min(...fl)<=3,'revisão 2: filtros em mais de uma linha a 1440 '+J(fl));}
    else if(w>=768)ok(g.k[0]===g.k[1]&&g.k[2]===g.k[3]&&g.k[2]>g.k[0]&&g.c[0]===g.c[1]&&g.c[2]>g.c[0]&&Math.abs(g.fw-g.cw)<=2,`18: ${w} `+J(g));
    else ok(new Set(g.k).size===4&&new Set(g.c).size===3,'18: 390 '+J(g));
    await p3.screenshot({path:`${P}/painel-${w}.png`,fullPage:true});
    // tile .v numa linha (Fotógrafos, detalhe de uma pessoa)
    await p3.evaluate(()=>{ETERNA.state.view='fotografos';ETERNA.state.person='samuel';ETERNA.render();});await p3.waitForTimeout(80);
    ok(await p3.evaluate(()=>[...document.querySelectorAll('.tile .v')].every(e=>{const cs=getComputedStyle(e);const lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize);return e.getBoundingClientRect().height<1.5*lh;})),`17: .tile .v quebrou linha em ${w}`);
    // 20: dica com toque (390)
    if(w===390){const {ctx:c4,pg:p4}=await nova(b,390,844,{hasTouch:true,isMobile:true});await entrar(p4,'eduardo@eduardorezende.com');await abrir(p4,'2026-10-07','2026-10-15','roverpix');await p4.waitForTimeout(120);
      await p4.tap('.pn-day.best');await p4.waitForTimeout(120);const tt=await p4.evaluate(()=>{const t=document.getElementById('tip');return {h:t.hidden,t:t.textContent};});ok(!tt.h&&/18\.682/.test(tt.t),'20: dica com toque '+J(tt));await c4.close();}
    await c3.close();}
  // ---------- 3, 4, 5: migração, acesso por perfil ----------
  {const {ctx:c5,pg:p5}=await nova(b,1280,900);await p5.goto(U);await p5.waitForTimeout(300);
    await p5.evaluate(()=>{const U0=JSON.parse(JSON.stringify(ETERNA.USERS));const a=U0['eduardo@eduardorezende.com'];delete a.mv;a.menu=a.menu.filter(v=>v!=='painel').concat(['semana']);a.inicio='semana';
      const s=U0['supervisor@eterna.photo'];delete s.mv;s.menu=s.menu.filter(v=>v!=='painel').concat(['semana']);s.inicio='perfis';
      const n=x=>({c:false,r:false,u:false,d:false,...x});
      U0['rel@eterna.photo']={v:2,email:'rel@eterna.photo',name:'Só relatórios',preset:'custom',key:null,perms:{relatorios:n({r:true})},menu:['semana','alertas'],inicio:'semana',active:true,createdAt:'2026-10-27T10:00:00.000Z',createdBy:'teste',lastLogin:null};
      U0['fin@eterna.photo']={v:2,email:'fin@eterna.photo',name:'Financeiro',preset:'custom',key:null,perms:{financeiro:n({r:true})},menu:['semana','vendas'],inicio:null,active:true,createdAt:'2026-10-27T10:00:00.000Z',createdBy:'teste',lastLogin:null};
      localStorage.setItem('eterna.users.v1',JSON.stringify(U0));localStorage.removeItem('eterna.users.log.v1');localStorage.removeItem('eterna.session');});
    await p5.reload();await p5.waitForTimeout(400);
    const m3=await p5.evaluate(()=>{const U0=ETERNA.USERS;const a=U0['eduardo@eduardorezende.com'],s=U0['supervisor@eterna.photo'],r=U0['rel@eterna.photo'],f=U0['fin@eterna.photo'];
      return {a:[a.menu.includes('painel'),a.menu.includes('semana'),a.inicio,ETERNA.presetMatch(a)],s:[s.menu.includes('painel'),s.inicio,ETERNA.presetMatch(s)],r:[r.menu.includes('painel'),r.menu.includes('semana'),r.inicio],f:[f.menu.includes('painel'),f.menu.includes('semana')],log:ETERNA.auditRead().filter(e=>e.acao==='migracao_v83').map(e=>e.alvo)};});
    ok(J(m3.a)===J([true,false,'painel','admin']),'3: admin migrado '+J(m3.a));ok(J(m3.s)===J([true,'painel','supervisor']),'3: supervisor migrado '+J(m3.s));ok(J(m3.r)===J([false,false,null]),'3: sem financeiro.r não ganha o Painel '+J(m3.r));ok(J(m3.f)===J([true,false]),'3: financeiro.r ganha o Painel '+J(m3.f));
    ok(m3.log.includes('eduardo@eduardorezende.com')&&m3.log.includes('rel@eterna.photo'),'3: histórico sem migracao_v83 '+J(m3.log));
    // a migração roda uma vez: recarregar não cria outra entrada
    await p5.reload();await p5.waitForTimeout(300);ok(await p5.evaluate(()=>ETERNA.auditRead().filter(e=>e.acao==='migracao_v83').length)===m3.log.length,'3: migração rodou de novo');
    // a marca da migração volta para o servidor: a cópia sincronizada não migra (nem registra) de novo
    const wb=await p5.evaluate(async()=>{const calls=[];ETERNA.state.db={doc:p=>({set:x=>calls.push([p,JSON.parse(JSON.stringify(x))])})};const U0=ETERNA.USERS;const s=U0['supervisor@eterna.photo'];
      const copia=JSON.parse(JSON.stringify(s));delete copia.mv;copia.menu=copia.menu.filter(v=>v!=='painel').concat(['semana']);U0['supervisor@eterna.photo']=copia;const n0=ETERNA.auditRead().filter(e=>e.acao==='migracao_v83').length;
      ETERNA.migrateUsers(false);await new Promise(r=>setTimeout(r,50));const volta=calls.find(([p,x])=>p==='usuarios/'+encodeURIComponent('supervisor@eterna.photo')&&x.mv===83&&!x.menu.includes('semana'));
      U0['supervisor@eterna.photo']=volta?JSON.parse(JSON.stringify(volta[1])):U0['supervisor@eterna.photo'];ETERNA.migrateUsers(false);await new Promise(r=>setTimeout(r,50));const n1=ETERNA.auditRead().filter(e=>e.acao==='migracao_v83').length;ETERNA.state.db=null;return {volta:!!volta,dif:n1-n0};});
    ok(wb.volta&&wb.dif===1,'nota: migração deveria gravar mv=83 de volta e registrar uma vez só '+J(wb));
    const cv=async email=>{await entrar(p5,email);return p5.evaluate(()=>ETERNA.canView('painel'));};
    for(const e of ['loja@eterna.photo','carlos@eterna.photo','qualidade@eterna.photo','rel@eterna.photo'])ok(!(await cv(e)),'5: '+e+' vê o Painel');
    ok(await cv('fin@eterna.photo'),'5: personalizado com financeiro.r e painel no menu deveria ver o Painel');
    ok(await cv('supervisor@eterna.photo')&&await view(p5)==='painel','2: supervisor deveria cair no Painel: '+await view(p5));
    // 4: atendimento em #painel cai na tela inicial dele, sem "Faturamento"
    await entrar(p5,'loja@eterna.photo','#painel');await p5.waitForTimeout(200);const lv=await view(p5);ok(lv!=='painel'&&!/Faturamento/.test(await main(p5)),'4: loja@ em #painel '+lv);
    await c5.close();}
  // ---------- 25: agente sem CORS aberto em /roverpix/* ----------
  {const porta=18000+Math.floor(Math.random()*2000);const agg=path.join(home,'Eterna','roverpix','agg');fs.mkdirSync(agg,{recursive:true});
    fs.writeFileSync(path.join(agg,'2026-10-20.json'),JSON.stringify({daily:{approaches:3,viewed:3,converted:2,sales:2,revenue:300,prints:2,reprints:0,photos:30,photosSold:6,pax:null},sellers:{},payments:{pix:{count:2,amount:300}},products:{},rows:{},people:{},orders:[]}));
    const uo=new URL(U);agente=spawn('python3',[path.join(__dirname,'..','agente','eterna-agente.py')],{env:{...process.env,HOME:home,ETERNA_PORTA:String(porta),ETERNA_APP_ORIGIN:uo.origin,ETERNA_SEM_OPENCV:'1',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'},stdio:['ignore','pipe','pipe']});let log='';agente.stdout.on('data',d=>log+=d);agente.stderr.on('data',d=>log+=d);
    let up=false;for(let i=0;i<60&&!up;i++){await sleep(250);up=(await req(porta,'/status')).s===200;}ok(up,'25: agente não subiu '+log.slice(-300));
    if(up){const fora=await req(porta,'/roverpix/data',{Origin:'https://exemplo.com'});ok(!fora.h['access-control-allow-origin'],'25: /roverpix/data com origem estranha devolveu CORS '+fora.h['access-control-allow-origin']);
      const fs2=await req(porta,'/roverpix/status',{Origin:'https://exemplo.com'});ok(!fs2.h['access-control-allow-origin'],'25: /roverpix/status com origem estranha devolveu CORS');
      const app=await req(porta,'/roverpix/data',{Origin:uo.origin});ok(app.h['access-control-allow-origin']===uo.origin,'25: ETERNA_APP_ORIGIN perdeu o acesso '+J(app.h['access-control-allow-origin']));
      const loc=await req(porta,'/roverpix/data');ok(loc.s===200&&/"ok": true/.test(loc.b),'25: mesma origem sem Origin deveria funcionar '+loc.s);
      // app aberto pelo agente: livePoll lê /roverpix/status e /roverpix/data
      const {ctx:c6,pg:p6}=await nova(b,1280,900);await p6.goto(`http://127.0.0.1:${porta}/index.html`);let lv=false;for(let i=0;i<40&&!lv;i++){await sleep(250);lv=await p6.evaluate(()=>!!(window.ETERNA&&ETERNA.live)).catch(()=>false);}
      ok(lv,'25: app aberto em 127.0.0.1 não carregou o LIVE pelo livePoll');
      // v80: o cartão do FTP do estádio fica em Configurações › Painel de controle (configuracao.r para ver, .u para alterar), não no Upload
      const UA=`http://127.0.0.1:${porta}/index.html`;const ent=async e=>{await p6.evaluate(()=>localStorage.removeItem('eterna.session'));await p6.goto(UA);await p6.waitForTimeout(500);await p6.fill('[data-act="login-email"]',e);await p6.click('button[type=submit]');await p6.waitForTimeout(150);const c=(await p6.textContent('.otp')).replace(/\s/g,'');await p6.fill('[data-act="login-code"]',c);await p6.waitForTimeout(500);};
      await ent('eduardo@eduardorezende.com');await p6.evaluate(()=>ETERNA.go('catalogo'));let ft=null;for(let i=0;i<20&&!ft;i++){await sleep(250);ft=await p6.$('[data-act="rf-save"]');}
      const tc=await p6.textContent('#main');ok(ft&&/Servidor FTP do estádio/.test(tc)&&/Painel de controle/.test(tc),'FTP: admin deveria ver o FTP no Painel de controle');
      await p6.evaluate(()=>ETERNA.go('importar'));await sleep(600);ok(!/Servidor FTP do estádio/.test(await p6.textContent('#main')),'FTP: o cartão do FTP ainda está no Upload automático');
      // só configuracao.r: vê o FTP sem poder alterar
      await p6.evaluate(()=>{const n=x=>({c:false,r:false,u:false,d:false,...x});const U0=JSON.parse(JSON.stringify(ETERNA.USERS));U0['cfgler@eterna.photo']={v:2,mv:83,email:'cfgler@eterna.photo',name:'Só ver config',preset:'custom',key:null,perms:{configuracao:n({r:true}),catalogo:n({r:true})},menu:['catalogo','repo'],inicio:null,active:true,createdAt:'2026-10-27T10:00:00.000Z',createdBy:'teste',lastLogin:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));});
      await ent('cfgler@eterna.photo');await p6.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();});let vi=false;for(let i=0;i<20&&!vi;i++){await sleep(250);vi=await p6.evaluate(()=>{ETERNA.render();return /Servidor FTP do estádio/.test(document.querySelector('#main').textContent)&&!document.querySelector('.rftp-off');});} // espera o agente conectar (sem ele o cartão aparece desligado)
      const ro=await p6.evaluate(()=>({save:!!document.querySelector('[data-act="rf-save"]'),dis:['rf-host','rf-user','rf-pass'].every(i=>{const e=document.getElementById(i);return e&&e.disabled;}),pill:/somente leitura/.test(document.querySelector('#main').textContent)}));
      ok(vi&&!ro.save&&ro.dis&&ro.pill,'revisão 11: FTP com só configuracao.r deveria ser só leitura '+J({vi,...ro}));
      await ent('loja@eterna.photo');await p6.evaluate(()=>{ETERNA.state.view='catalogo';ETERNA.render();});await sleep(800);await p6.evaluate(()=>ETERNA.render());ok(!/Servidor FTP do estádio/.test(await p6.textContent('#main')),'FTP: atendimento (sem configuracao.r) vê o FTP');
      await c6.close();}}
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
if(agente)agente.kill('SIGKILL');try{fs.rmSync(home,{recursive:true,force:true});}catch(e){}
await b.close();const errsF=errs.filter(e=>!/agente|8765|127\.0\.0\.1:1[89]\d\d\d/.test(e));
const ok2=!fails.length&&!errsF.length;console.log(`${ok2?'OK':'FALHA'} painel: critérios 1 a 29, Vendas e caixa, datas, migração, agente${fails.length?' · '+fails.slice(0,12).join(' | '):''}${errsF.length?' · erros: '+errsF.slice(0,3).join(' | '):''}`);process.exit(ok2?0:1);})();
