// v97-ux: Posto único (plano docs/planos/2026-11-11-posto-unico.md, critérios 2 a 20 e 22). Sem agente.
// O Posto de venda é a tela única; o Caixa (#caixa, botão amarelo) é o mesmo Posto só com o dinheiro esperando confirmação;
// a Venda manual é um bloco dentro do Posto (#checkout); a Fila do balcão saiu (#fila abre o Posto).
// Critérios 7, 11 e 15: o resultado é comparado com o da a9b4028 (v96-ux), gravado abaixo em BASE. Para gerar de novo contra outra
// versão: SNAP=1 U=http://.../index.html node testes/posto-unico.js (os roteiros usam só data-act que existem nas duas versões).
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');/* v93: usuário e senha */
const U=process.env.U||'http://127.0.0.1:8890/index.html';const SNAP=process.env.SNAP==='1';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const ADMIN='eduardo@eduardorezende.com',SUP='supervisor@eterna.photo',VEND='loja@eterna.photo',FOTO='carlos@eterna.photo',CK='quiosque@eterna.photo';
// resultado da a9b4028 para os mesmos roteiros (menos datas, ids e códigos) · v97 (junção): presets com o Chute a gol no menu do Admin e a Supervisora com set.c (envio manual), as duas únicas diferenças · v99.1 (junção com a v98/v99): venda manual com o catálogo da Imply (TRIBUNA R$ 220, fundo incluso) e o módulo Senhas de acesso da v93 (só o Admin) nos presets; a venda em dinheiro segue igual
const BASE={"din":{"s":{"status":"paga","payment":"Dinheiro","total":110,"nFotos":3,"prints":0,"cart":[{"id":"zona","v":110}],"nSel":3,"seller":"Checkout (autoatendimento)","posto":"Caixa 1","pag":{"prov":"dinheiro","ref":null,"porNome":"Eduardo Rezende"},"imp":"nao_se_aplica","vendedor":{"nome":"Eduardo Rezende","email":"eduardo@eduardorezende.com"},"din":null,"vendaIdOk":true},"stock":58,"r":{"estado":"confirmada","ref":null,"meio":"dinheiro","prov":"dinheiro","porNome":"Eduardo Rezende","motivo":null,"total":110,"prints":0},"fila":["pagar"]},"manual":{"s":{"status":"paga","payment":"PIX","total":220,"nFotos":2,"prints":2,"cart":[{"id":"tribuna","v":220},{"id":"fundo","v":0}],"nSel":2,"seller":"Thais","posto":"Caixa 1","pag":{"prov":"pos-manual","ref":null,"porNome":"Eduardo Rezende"},"imp":"pendente","vendedor":{"nome":"Eduardo Rezende","email":"eduardo@eduardorezende.com"},"din":null,"vendaIdOk":true,"bg":"campeao2","saleNo":true},"stock":58,"fila":[{"tipo":"criar","meio":"pix","prov":"pos-manual","total":220,"cart":[{"id":"tribuna","v":220},{"id":"fundo","v":0}],"prints":2,"nPh":2,"nAI":0,"canal":"balcao","nSel":2},{"tipo":"pagar","ref":null,"prov":"pos-manual"}]},"presets":{"admin":{"perms":{"estoque":{"c":true,"r":true,"u":true,"d":true},"relatorios":{"c":false,"r":true,"u":false,"d":false},"desempenho":{"c":false,"r":true,"u":false,"d":false},"financeiro":{"c":false,"r":true,"u":false,"d":true},"estatisticas":{"c":true,"r":true,"u":false,"d":false},"galerias":{"c":true,"r":true,"u":true,"d":true},"qualidade":{"c":true,"r":true,"u":true,"d":false},"diario":{"c":true,"r":true,"u":true,"d":true},"set":{"c":true,"r":true,"u":true,"d":true},"escala":{"c":false,"r":true,"u":true,"d":false},"filafoto":{"c":false,"r":true,"u":true,"d":false},"configuracao":{"c":false,"r":true,"u":true,"d":false},"catalogo":{"c":false,"r":true,"u":true,"d":false},"usuarios":{"c":true,"r":true,"u":true,"d":true},"senhas":{"c":true,"r":true,"u":true,"d":true},"permissoes":{"c":false,"r":true,"u":true,"d":false},"laboratorio":{"c":false,"r":true,"u":false,"d":false},"venda":{"c":true,"r":true,"u":true,"d":false},"quiosque":{"c":true,"r":true,"u":false,"d":false}},"menu":["bandeiras","estoque","impfila","alertas","fotografos","painel","vendas","vendas-lista","estatisticas","galerias","revisao","treino","diario","importar","ajustes","escala","calendario","fotofila","repo","identidade","chroma","catalogo","usuarios","permissoes","vestiario","chute-a-gol","fundos-teste","checkout","fila","caixa","posto","quiosque"],"inicio":"painel"},"foto":{"perms":{"estoque":{"c":false,"r":false,"u":false,"d":false},"relatorios":{"c":false,"r":false,"u":false,"d":false},"desempenho":{"c":false,"r":false,"u":false,"d":false},"financeiro":{"c":false,"r":false,"u":false,"d":false},"estatisticas":{"c":false,"r":false,"u":false,"d":false},"galerias":{"c":false,"r":false,"u":false,"d":false},"qualidade":{"c":false,"r":false,"u":false,"d":false},"diario":{"c":true,"r":true,"u":true,"d":false},"set":{"c":true,"r":true,"u":true,"d":false},"escala":{"c":false,"r":true,"u":false,"d":false},"filafoto":{"c":false,"r":true,"u":false,"d":false},"configuracao":{"c":false,"r":false,"u":false,"d":false},"catalogo":{"c":false,"r":false,"u":false,"d":false},"usuarios":{"c":false,"r":false,"u":false,"d":false},"senhas":{"c":false,"r":false,"u":false,"d":false},"permissoes":{"c":false,"r":false,"u":false,"d":false},"laboratorio":{"c":false,"r":false,"u":false,"d":false},"venda":{"c":false,"r":false,"u":false,"d":false},"quiosque":{"c":false,"r":false,"u":false,"d":false}},"menu":["diario","importar","fotofila","escala"],"inicio":"importar"},"venda":{"perms":{"estoque":{"c":false,"r":false,"u":false,"d":false},"relatorios":{"c":false,"r":false,"u":false,"d":false},"desempenho":{"c":false,"r":false,"u":false,"d":false},"financeiro":{"c":false,"r":false,"u":false,"d":false},"estatisticas":{"c":false,"r":false,"u":false,"d":false},"galerias":{"c":false,"r":false,"u":false,"d":false},"qualidade":{"c":false,"r":false,"u":false,"d":false},"diario":{"c":false,"r":false,"u":false,"d":false},"set":{"c":false,"r":false,"u":false,"d":false},"escala":{"c":false,"r":false,"u":false,"d":false},"filafoto":{"c":false,"r":true,"u":false,"d":false},"configuracao":{"c":false,"r":false,"u":false,"d":false},"catalogo":{"c":false,"r":true,"u":false,"d":false},"usuarios":{"c":false,"r":false,"u":false,"d":false},"senhas":{"c":false,"r":false,"u":false,"d":false},"permissoes":{"c":false,"r":false,"u":false,"d":false},"laboratorio":{"c":false,"r":false,"u":false,"d":false},"venda":{"c":true,"r":true,"u":true,"d":false},"quiosque":{"c":true,"r":true,"u":false,"d":false}},"menu":["quiosque","checkout","fila","caixa","posto","catalogo","fotofila"],"inicio":"posto"},"valida":{"perms":{"estoque":{"c":false,"r":false,"u":false,"d":false},"relatorios":{"c":false,"r":false,"u":false,"d":false},"desempenho":{"c":false,"r":false,"u":false,"d":false},"financeiro":{"c":false,"r":false,"u":false,"d":false},"estatisticas":{"c":false,"r":false,"u":false,"d":false},"galerias":{"c":false,"r":false,"u":false,"d":false},"qualidade":{"c":true,"r":true,"u":true,"d":false},"diario":{"c":false,"r":true,"u":false,"d":false},"set":{"c":false,"r":false,"u":false,"d":false},"escala":{"c":false,"r":false,"u":false,"d":false},"filafoto":{"c":false,"r":false,"u":false,"d":false},"configuracao":{"c":false,"r":false,"u":false,"d":false},"catalogo":{"c":false,"r":false,"u":false,"d":false},"usuarios":{"c":false,"r":false,"u":false,"d":false},"senhas":{"c":false,"r":false,"u":false,"d":false},"permissoes":{"c":false,"r":false,"u":false,"d":false},"laboratorio":{"c":false,"r":false,"u":false,"d":false},"venda":{"c":false,"r":false,"u":false,"d":false},"quiosque":{"c":false,"r":false,"u":false,"d":false}},"menu":["revisao","treino","diario"],"inicio":"revisao"},"supervisor":{"perms":{"estoque":{"c":true,"r":true,"u":true,"d":true},"relatorios":{"c":false,"r":true,"u":false,"d":false},"desempenho":{"c":false,"r":true,"u":false,"d":false},"financeiro":{"c":false,"r":true,"u":false,"d":false},"estatisticas":{"c":false,"r":false,"u":false,"d":false},"galerias":{"c":true,"r":true,"u":true,"d":false},"qualidade":{"c":false,"r":true,"u":false,"d":false},"diario":{"c":true,"r":true,"u":true,"d":true},"set":{"c":true,"r":true,"u":false,"d":false},"escala":{"c":false,"r":true,"u":true,"d":false},"filafoto":{"c":false,"r":true,"u":true,"d":false},"configuracao":{"c":false,"r":true,"u":true,"d":false},"catalogo":{"c":false,"r":true,"u":false,"d":false},"usuarios":{"c":false,"r":false,"u":false,"d":false},"senhas":{"c":false,"r":false,"u":false,"d":false},"permissoes":{"c":false,"r":false,"u":false,"d":false},"laboratorio":{"c":false,"r":true,"u":false,"d":false},"venda":{"c":true,"r":true,"u":true,"d":false},"quiosque":{"c":false,"r":false,"u":false,"d":false}},"menu":["bandeiras","estoque","impfila","alertas","fotografos","painel","vendas","vendas-lista","galerias","revisao","treino","diario","importar","ajustes","escala","calendario","fotofila","catalogo","checkout","fila","caixa","posto","quiosque"],"inicio":"painel"},"quiosque":{"perms":{"estoque":{"c":false,"r":false,"u":false,"d":false},"relatorios":{"c":false,"r":false,"u":false,"d":false},"desempenho":{"c":false,"r":false,"u":false,"d":false},"financeiro":{"c":false,"r":false,"u":false,"d":false},"estatisticas":{"c":false,"r":false,"u":false,"d":false},"galerias":{"c":false,"r":false,"u":false,"d":false},"qualidade":{"c":false,"r":false,"u":false,"d":false},"diario":{"c":false,"r":false,"u":false,"d":false},"set":{"c":false,"r":false,"u":false,"d":false},"escala":{"c":false,"r":false,"u":false,"d":false},"filafoto":{"c":false,"r":false,"u":false,"d":false},"configuracao":{"c":false,"r":false,"u":false,"d":false},"catalogo":{"c":false,"r":false,"u":false,"d":false},"usuarios":{"c":false,"r":false,"u":false,"d":false},"senhas":{"c":false,"r":false,"u":false,"d":false},"permissoes":{"c":false,"r":false,"u":false,"d":false},"laboratorio":{"c":false,"r":false,"u":false,"d":false},"venda":{"c":false,"r":false,"u":false,"d":false},"quiosque":{"c":true,"r":true,"u":false,"d":false}},"menu":["quiosque"],"inicio":"quiosque"}}};
async function nova(b,w,h){const ctx=await b.newContext({viewport:{width:w||1366,height:h||900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(8000);
  pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg};}
async function limpa(pg){await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.goto('about:blank');await pg.goto(U);await pg.waitForTimeout(400);}
async function entrar(pg,email){return entrarTeste(pg,email);}
// abre um endereço do zero (documento novo), mantendo o login
async function abrir(pg,hash){await pg.goto('about:blank');await pg.goto(U+(hash||''));await pg.waitForTimeout(450);}
const toastTxt=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent);
const tela=pg=>pg.evaluate(()=>({v:ETERNA.state.view,hash:location.hash,h1:(document.querySelector('#main h1')||{}).textContent||'',eb:(document.querySelector('#main .head .eyebrow')||{}).textContent||'',manual:!!document.querySelector('#posto-manual'),
  ids:[...document.querySelectorAll('#pend-painel [data-pend]')].map(x=>x.dataset.pend),chips:document.querySelectorAll('#main [data-act="posto-filtro"]').length,txt:document.querySelector('#main').textContent}));
// SIM do critério: 1 dinheiro pronto, 1 PIX pronto, 1 cartão pronto, 1 pedido do Checkout sem pacote e 1 com pacote e meio dinheiro
async function semear(pg){return pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const u=E.state.user;const vend={nome:u.name,email:u.email};
  const ds=E.demoSessions().filter(s=>s.status!=='paga'&&s.status!=='aberta'&&s.photos.length>=4).sort((a,b)=>a.card<b.card?-1:1);const cs=ds.slice(0,5).map(s=>s.card);
  const fotos=c=>ds.find(s=>s.card===c).photos.slice(0,3).map(p=>p.id);const agora=new Date().toISOString();
  const pronto=(id,card,meio,cod)=>({id,card,codigo:cod,criada:agora,total:110,prints:0,n:3,cart:[{id:'zona'}],selected:fotos(card),meio,prov:meio==='dinheiro'?'dinheiro':'pos-manual',estado:'aguardando',vendedor:vend,saleNo:'L0-9'+id.slice(-2)});
  const pedido=(id,card,cod)=>({id,card,codigo:cod,criada:agora,estado:'escolha',escolha:true,n:3,nSes:3,selected:fotos(card),aiSel:[],fav:[],pkg:null,total:null,meio:null,canal:'checkout',iniciado:'aguardando',vendedor:vend,saleNo:'L0-9'+id.slice(-2)});
  S.caixaDin=[pronto('L00-teste0din01',cs[0],'dinheiro','DINA-2345'),pronto('L00-teste0pix01',cs[1],'pix','PIXA-2345'),pronto('L00-teste0car01',cs[2],'cartao','CARA-2345'),pedido('L00-teste0esc01',cs[3],'ESCA-2345'),pedido('L00-teste0esc02',cs[4],'ESCB-2345')];
  localStorage.setItem('eterna.sim.v1',JSON.stringify(S));E.simFresh();
  E.pendEscolher('L00-teste0esc02',{pkg:E.lojaIdeal(3).pkg});E.pendEscolher('L00-teste0esc02',{meio:'dinheiro'});E.render();return cs;});}
// resultado de uma venda, sem datas, ids, códigos nem número de venda
async function venda(pg,card,id){return pg.evaluate(([card,id])=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const s=S.sessions[card];const r=id?S.caixaDin.find(x=>x.id===id):null;
  const fila=JSON.parse(localStorage.getItem('eterna.ponto.fila.v1')||'[]').filter(e=>id?e.venda===id:e.venda===s.vendaId);
  const o={s:{status:s.status,payment:s.payment,total:s.total,nFotos:s.nFotos,prints:s.prints,cart:s.cart,nSel:(s.selected||[]).length,seller:s.seller,posto:s.posto,pag:s.pag&&{prov:s.pag.prov,ref:s.pag.ref,porNome:s.pag.porNome},imp:s.impressao&&s.impressao.estado,vendedor:s.vendedor,din:s.din||null,vendaIdOk:id?s.vendaId===id:!!s.vendaId},stock:S.stock['Caixa 1']};
  if(r){o.r={estado:r.estado,ref:r.ref,meio:r.meio,prov:r.prov,porNome:r.porNome,motivo:r.motivo,total:r.total,prints:r.prints};o.fila=fila.map(e=>e.tipo);}
  else{o.s.bg=s.bg||null;o.s.saleNo=/^[A-Z]\d*-?\d+$/.test(s.saleNo||'');o.fila=fila.map(e=>{const d=e.dados||{};return e.tipo==='criar'?{tipo:e.tipo,meio:d.meio,prov:d.prov,total:d.total,cart:d.cart,prints:d.prints,nPh:d.nPh,nAI:d.nAI,canal:d.canal,nSel:(d.selected||[]).length}:{tipo:e.tipo,ref:d.ref,prov:d.prov};});}
  return o;},[card,id||null]);}
// roteiro do critério 7: "Recebi R$ X" no Caixa (mesmos data-act na a9b4028)
async function roteiroDin(pg){await pg.evaluate(()=>ETERNA.go('caixa'));await pg.waitForTimeout(200);await pg.click('[data-act="din-confirm"][data-id="L00-teste0din01"]');await pg.waitForTimeout(400);}
// roteiro do critério 11: Venda manual de ponta a ponta (sessão, 2 fotos, pacote, Fundo de IA, PIX, recibo). Devolve a sessão vendida
async function roteiroManual(pg){await pg.evaluate(()=>ETERNA.go('checkout'));await pg.waitForTimeout(250);
  const card=await pg.evaluate(()=>{const b=[...document.querySelectorAll('#main [data-act="checkout-pick"]')].map(x=>x.dataset.card).sort()[0];return b;});
  await pg.click(`#main [data-act="checkout-pick"][data-card="${card}"]`);await pg.waitForTimeout(250);
  for(let i=0;i<2;i++){await pg.evaluate(i=>{const f=[...document.querySelectorAll('#main [data-act="fila-sel"]')].filter(x=>!x.dataset.sel)[0];f.click();},i);await pg.waitForTimeout(120);}
  await pg.evaluate(()=>document.querySelectorAll('#main .prod[data-act="fila-add"]')[2].click());await pg.waitForTimeout(120); // terceiro pacote do Catálogo
  await pg.waitForSelector('#main [data-act="fila-bg"]',{timeout:8000}).catch(()=>{});await pg.evaluate(()=>{const g=document.querySelector('#main [data-act="fila-bg"]');if(g)g.click();});await pg.waitForTimeout(200); // o Fundo de IA aparece depois da leitura das fotos (aiPrep)
  await pg.click('#main [data-act="checkout-step"][data-s="3"]');await pg.waitForTimeout(200);
  await pg.click('#main [data-act="caixa-pay"][data-m="PIX"]');await pg.waitForTimeout(120);
  await pg.click('#main [data-act="caixa-confirm"]');await pg.waitForTimeout(700);return card;}
const presetsSnap=pg=>pg.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(ETERNA.PRESETS).map(([k,p])=>[k,{perms:ETERNA.presetPerms(k),menu:ETERNA.presetMenu(k),inicio:p.inicio||null}]))));
// cadastro personalizado gravado direto (o migrateUsers normaliza no carregamento)
async function personalizado(pg,email,perms,menu){await pg.evaluate(([email,perms,menu])=>{const U=JSON.parse(localStorage.getItem('eterna.users.v1'));const u=U[email];u.preset='custom';u.perms=Object.assign(ETERNA.presetPerms('zzz'),perms);u.menu=menu;u.inicio='';localStorage.setItem('eterna.users.v1',JSON.stringify(U));localStorage.removeItem('eterna.session');},[email,perms,menu]);await abrir(pg,'');}
// clique forçado numa ação que a tela não mostra (o mesmo que chamar pelo console)
const forcar=(pg,act,data)=>pg.evaluate(([act,data])=>{const b=document.createElement('button');b.dataset.act=act;Object.assign(b.dataset,data||{});document.querySelector('#main').appendChild(b);b.click();b.remove();},[act,data||{}]);

(async()=>{const b=await chromium.launch();
try{
  if(SNAP){const {ctx,pg}=await nova(b);await limpa(pg);await entrar(pg,ADMIN);const cs=await semear(pg);await roteiroDin(pg);const din=await venda(pg,cs[0],'L00-teste0din01');
    const card=await roteiroManual(pg);const manual=await venda(pg,card);const presets=JSON.parse(await presetsSnap(pg));console.log(J({din,manual,presets}));await ctx.close();await b.close();process.exit(0);}

  // ================= Atendimento e venda: critérios 2 a 13 =================
  {const {ctx,pg}=await nova(b);await limpa(pg);ok(await entrar(pg,VEND),'vendedor não entrou');
    // 2: cai no Posto, um selo de rolo, três blocos, sem chips
    let t=await tela(pg);const rolo=await pg.evaluate(()=>[...document.querySelectorAll('#main .pill')].filter(p=>/Rolo:/.test(p.textContent)).length);
    ok(t.v==='posto'&&t.eb==='Caixa 1'&&t.h1==='Posto de venda'&&rolo===1&&/Agora no Checkout/.test(t.txt)&&/Aguardando pagamento/.test(t.txt)&&/Imprimir/.test(t.txt)&&t.chips===0,'2: Posto do vendedor: '+J({v:t.v,eb:t.eb,h1:t.h1,rolo,chips:t.chips}));
    ok(!/Computador do ponto/.test(t.txt),'extra: "Computador do ponto" ainda aparece');
    // 3: botão amarelo sem número quando não há dinheiro; com o SIM do critério, 2
    ok(await pg.evaluate(()=>!!document.querySelector('#rail-ck [data-v="caixa"]')&&!document.querySelector('#rail-cx')&&document.querySelector('#rail-ck [data-v="caixa"]').getAttribute('aria-label')==='Caixa'),'3: sem dinheiro esperando, o botão Caixa aparece sem número');
    const cs=await semear(pg);
    const n3=await pg.evaluate(()=>({cx:(document.querySelector('#rail-ck [data-v="caixa"] #rail-cx')||{}).textContent||'',din:(document.querySelector('#nav [data-v="posto"] #rail-din')||{}).textContent||'',al:document.querySelector('#rail-ck [data-v="caixa"]').getAttribute('aria-label')}));
    ok(n3.cx==='2'&&n3.din==='5'&&n3.al==='Caixa, 2 em dinheiro para confirmar','3 e decisão 4: Caixa só com o dinheiro (2) e o item do menu com todas (5): '+J(n3));
    t=await tela(pg);ok(t.ids.length===5&&t.ids.includes('L00-teste0esc01'),'6: o pedido sem pacote aparece no Posto: '+J(t.ids));
    // pedido do Checkout sem pacote: Cancelar compra como link vermelho afastado (padrão da Onda 1)
    const cn=await pg.evaluate(()=>{const it=document.querySelector('#pend-painel [data-pend="L00-teste0esc01"]');const c=it&&it.querySelector('.pend-cancel .link-danger[data-act="din-cancel"]');return c?{txt:c.textContent,btn:it.querySelectorAll('.btn[data-act="din-cancel"]').length,h:c.getBoundingClientRect().height}:null;});
    ok(cn&&cn.txt==='Cancelar compra'&&cn.btn===0&&cn.h>=44,'pedido do Checkout: Cancelar compra como link vermelho: '+J(cn));
    // 4: botão amarelo abre o Caixa
    await pg.click('#rail-ck [data-v="caixa"]');await pg.waitForTimeout(250);t=await tela(pg);
    const n4=await pg.evaluate(()=>({n:(document.querySelector('#pend-painel .head .pill')||{}).textContent||'',cur:document.querySelector('#rail-ck [data-v="caixa"]').getAttribute('aria-current'),rolo:[...document.querySelectorAll('#main .pill')].filter(p=>/Rolo:/.test(p.textContent)).length}));
    ok(t.v==='caixa'&&t.hash==='#caixa'&&t.h1==='Caixa'&&t.eb==='Posto de venda · Caixa 1'&&J(t.ids.slice().sort())===J(['L00-teste0din01','L00-teste0esc02'])&&n4.n==='2'&&n4.cur==='page'&&n4.rolo===1,'4: vista Caixa: '+J({v:t.v,hash:t.hash,h1:t.h1,eb:t.eb,ids:t.ids,n4}));
    ok(!t.ids.includes('L00-teste0esc01')&&!t.ids.includes('L00-teste0pix01')&&!t.ids.includes('L00-teste0car01'),'6: pedido sem pacote, PIX ou cartão no Caixa: '+J(t.ids));
    const chip=await pg.evaluate(()=>{const c=[...document.querySelectorAll('#main [data-act="posto-filtro"]')];const r=c[0]&&c[0].getBoundingClientRect();return {n:c.length,f:c[0]&&c[0].dataset.f,txt:c[0]&&c[0].textContent.trim(),svg:!!(c[0]&&c[0].querySelector('svg')),h:r&&r.height};});
    ok(chip.n===1&&chip.f==='todos'&&chip.txt==='Dinheiro'&&chip.svg&&chip.h>=44,'4 e decisão 1: um chip só, "Dinheiro ✕", com 44 px: '+J(chip));
    // 5: o chip volta ao Posto completo
    await pg.click('#main [data-act="posto-filtro"]');await pg.waitForTimeout(250);t=await tela(pg);
    ok(t.v==='posto'&&t.hash==='#posto'&&t.h1==='Posto de venda'&&t.ids.length===5&&t.chips===0,'5: "Dinheiro ✕" volta ao Posto: '+J({v:t.v,hash:t.hash,h1:t.h1,n:t.ids.length,chips:t.chips}));
    // 7: confirmar no Caixa: número cai para 1 e nenhum recibo abre (decisão 3)
    await roteiroDin(pg);
    const n7=await pg.evaluate(()=>({cx:(document.querySelector('#rail-cx')||{}).textContent||'',rec:!!document.querySelector('.posto-recibo'),ses:ETERNA.state.caixa.session,pr:ETERNA.state.posto.recibo,v:ETERNA.state.view,qr:!!document.querySelector('#qrbox')}));
    ok(n7.cx==='1'&&!n7.rec&&!n7.qr&&n7.ses==null&&n7.pr==null&&n7.v==='caixa','7: depois do "Recebi", número 1 e nenhum recibo: '+J(n7));
    const r7=await venda(pg,cs[0],'L00-teste0din01');const esp7=JSON.parse(J(BASE.din));esp7.s.pag.porNome=esp7.r.porNome='Atendimento e venda';esp7.s.vendedor={nome:'Atendimento e venda',email:VEND};
    ok(J(r7)===J(esp7),'7: SIM e fila iguais aos da a9b4028: '+J(r7)+' ≠ '+J(esp7));
    // decisão 3 no Posto: confirmar o dinheiro do pedido do Checkout também não abre recibo
    await pg.click('#main [data-act="posto-filtro"]');await pg.waitForTimeout(200);await pg.click('[data-act="din-confirm"][data-id="L00-teste0esc02"]');await pg.waitForTimeout(400);
    const n7b=await pg.evaluate(()=>({cx:!!document.querySelector('#rail-cx'),rec:!!document.querySelector('.posto-recibo'),din:(document.querySelector('#rail-din')||{}).textContent||'',paga:JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id==='L00-teste0esc02').estado}));
    ok(!n7b.cx&&!n7b.rec&&n7b.din==='3'&&n7b.paga==='confirmada','decisão 3: no Posto o dinheiro confirmado não abre recibo e o Caixa fica sem número: '+J(n7b));
    // 8: #fila (endereço e eterna.view gravado) abre o Posto completo, endereço #posto
    await abrir(pg,'#fila');t=await tela(pg);ok(t.v==='posto'&&t.hash==='#posto'&&!t.manual&&!/Sessões prontas|Enviar ao caixa/.test(t.txt),'8: #fila abre o Posto: '+J({v:t.v,hash:t.hash,manual:t.manual}));
    await pg.evaluate(()=>localStorage.setItem('eterna.view','fila'));await abrir(pg,'');t=await tela(pg);ok(t.v==='posto'&&t.hash==='#posto'&&!t.manual,'8: eterna.view=fila abre o Posto: '+J({v:t.v,hash:t.hash}));
    // 9: #checkout e #venda abrem o Posto com a Venda manual; recarregar mantém
    for(const h of ['#checkout','#venda']){await abrir(pg,h);t=await tela(pg);const c9=await pg.evaluate(()=>({cam:ETERNA.camWanted(),h2:(document.querySelector('#posto-manual h2')||{}).textContent,code:!!document.querySelector('#posto-manual #ck-code'),face:!!document.querySelector('#posto-manual #cam-face')}));
      ok(t.v==='posto'&&t.manual&&t.hash==='#checkout'&&t.h1==='Posto de venda'&&c9.cam&&c9.h2==='Venda manual'&&c9.code&&c9.face,`9: ${h} abre o Posto com a Venda manual: `+J({v:t.v,hash:t.hash,c9}));}
    await pg.reload();await pg.waitForTimeout(450);t=await tela(pg);ok(t.v==='posto'&&t.manual&&t.hash==='#checkout'&&await pg.evaluate(()=>!!document.querySelector('#posto-manual #ck-code')),'9: recarregar mantém a Venda manual na etapa 1: '+J({v:t.v,hash:t.hash,manual:t.manual}));
    ok(/Agora no Checkout/.test(t.txt)&&/Aguardando pagamento/.test(t.txt)&&t.ids.length===3,'9: com a Venda manual aberta os blocos do Posto continuam na tela');
    // 13: digitar o código enquanto o Checkout muda de etapa (canal e redesenho): texto e foco ficam
    await pg.click('#ck-code');await pg.keyboard.type('LP');
    await pg.evaluate(()=>{const c=new BroadcastChannel('eterna-loja');c.postMessage({tipo:'estado',em:Date.now(),step:'code',lang:'en'});ETERNA.render();});await pg.waitForTimeout(400);await pg.keyboard.type('1');
    await pg.evaluate(()=>{window.dispatchEvent(new StorageEvent('storage',{key:'eterna.sim.v1',newValue:localStorage.getItem('eterna.sim.v1')}));ETERNA.render();});await pg.waitForTimeout(300);await pg.keyboard.type('0');
    const c13=await pg.evaluate(()=>({v:(document.querySelector('#ck-code')||{}).value,foco:document.activeElement&&document.activeElement.id}));ok(c13.v==='LP10'&&c13.foco==='ck-code','13: texto e foco no #ck-code: '+J(c13));
    await pg.evaluate(()=>{ETERNA.state.checkout.code='';});
    // 10: link abre o bloco sem trocar de view; Fechar devolve a sessão ao estado anterior
    await abrir(pg,'#posto');t=await tela(pg);ok(t.v==='posto'&&!t.manual,'10: #posto sem a Venda manual');
    const lk=await pg.evaluate(()=>{const l=document.querySelector('.posto-rodape [data-act="posto-manual"]');return l?{t:l.textContent,h:l.getBoundingClientRect().height}:null;});ok(lk&&lk.t==='Venda manual (quando o Checkout está fora)'&&lk.h>=44,'10: link da Venda manual: '+J(lk));
    await pg.click('.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(250);t=await tela(pg);ok(t.v==='posto'&&t.manual&&t.hash==='#checkout'&&!await pg.$('.posto-rodape [data-act="posto-manual"]'),'10: o link abre o bloco no Posto: '+J({v:t.v,hash:t.hash,manual:t.manual}));
    const c10=await pg.evaluate(()=>{const b=[...document.querySelectorAll('#posto-manual [data-act="checkout-pick"]')].map(x=>x.dataset.card).sort()[0];return {card:b,antes:(ETERNA.SIM.sessions[b]||{}).status||ETERNA.demoSessions().find(s=>s.card===b).status};});
    await pg.click(`#posto-manual [data-act="checkout-pick"][data-card="${c10.card}"]`);await pg.waitForTimeout(250);
    const m10=await pg.evaluate(c=>({st:ETERNA.SIM.sessions[c].status,sess:!!document.querySelector('#posto-manual .posto-manual-sess'),cod:(document.querySelector('#posto-manual .posto-manual-cod')||{}).textContent,h1:document.querySelectorAll('#main h1').length,lgpd:!!document.querySelector('#posto-manual [data-act="lgpd-pedir"]'),outra:(document.querySelector('#posto-manual [data-act="checkout-back"]')||{}).textContent}),c10.card);
    ok(m10.st==='no checkout'&&m10.sess&&m10.cod===c10.card&&m10.h1===1&&m10.outra==='← Outra sessão','10: etapa 2 dentro do bloco, sem segundo h1: '+J(m10));ok(!m10.lgpd,'14: vendedor sem o botão LGPD');
    // 12: com a Venda manual numa sessão, Recibo e "Vindas da Fila do balcão" desabilitados; caixa-open forçado é recusado
    await pg.evaluate(()=>{const S=ETERNA.SIM;const c=ETERNA.demoSessions().filter(s=>s.status==='pronta'||s.status==='fechada').map(s=>s.card).sort().pop();const s=S.sessions[c]=S.sessions[c]||{};s.status='no caixa';s.cart=[{id:'zona'}];s.selected=[];localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.render();});await pg.waitForTimeout(150);
    const c12=await pg.evaluate(()=>({rec:[...document.querySelectorAll('#minhas-vendas [data-act="caixa-open"]')].map(x=>x.disabled),fila:[...document.querySelectorAll('#main .scard[data-act="caixa-open"]')].map(x=>x.disabled),ses:ETERNA.state.caixa.session}));
    ok(c12.rec.length>=1&&c12.rec.every(Boolean)&&c12.fila.length>=1&&c12.fila.every(Boolean),'12: Recibo e Vindas da Fila do balcão desabilitados: '+J(c12));
    await forcar(pg,'caixa-open',{card:cs[0]});await pg.waitForTimeout(150);
    ok(await toastTxt(pg)==='Feche a venda manual antes de abrir outro recibo'&&await pg.evaluate(()=>ETERNA.state.caixa.session)===c12.ses&&c12.ses===c10.card,'12: caixa-open forçado não troca a sessão: '+await toastTxt(pg));
    await pg.click('[data-act="posto-manual-fechar"]');await pg.waitForTimeout(250);t=await tela(pg);
    const d10=await pg.evaluate(c=>({st:ETERNA.SIM.sessions[c].status,ses:ETERNA.state.checkout.session,cx:ETERNA.state.caixa.session,rec:[...document.querySelectorAll('#minhas-vendas [data-act="caixa-open"]')].some(x=>x.disabled)}),c10.card);
    ok(t.v==='posto'&&!t.manual&&t.hash==='#posto'&&['pronta','fechada'].includes(d10.st)&&d10.ses==null&&d10.cx==null&&!d10.rec,'10: Fechar venda manual devolve a sessão: '+J({d10,antes:c10.antes,hash:t.hash}));
    // Recibo em Minhas vendas abre em cima do Posto (com a Venda manual sem sessão, o Recibo fecha o bloco)
    await pg.click('.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(200);await pg.click(`#minhas-vendas [data-act="caixa-open"][data-card="${cs[0]}"]`);await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>!!document.querySelector('.posto-recibo #qrbox')&&!document.querySelector('#posto-manual')&&ETERNA.state.view==='posto'),'8 (plano): Venda manual e Recibo não convivem: o Recibo fecha o bloco');
    await pg.click('.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(200);ok(await pg.evaluate(()=>!document.querySelector('.posto-recibo')&&!!document.querySelector('#posto-manual')&&ETERNA.state.caixa.session==null),'8 (plano): abrir a Venda manual fecha o recibo');
    await pg.click('[data-act="posto-manual-fechar"]');
    // 22: 390 e 1920 sem rolagem horizontal no Posto, no Caixa e na Venda manual
    for(const [w,h] of [[390,844],[1920,1080]]){await pg.setViewportSize({width:w,height:h});
      for(const hs of ['#posto','#caixa','#checkout']){await abrir(pg,hs);const sw=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth}));ok(sw.sw<=sw.iw+1,`22: rolagem horizontal em ${hs} a ${w} px: `+J(sw));
        if(hs==='#caixa'){const hc=await pg.evaluate(()=>{const c=document.querySelector('#main [data-act="posto-filtro"]');return c?c.getBoundingClientRect().height:0;});ok(hc>=44,`22: chip Dinheiro com ${hc} px a ${w} px`);}
        if(hs==='#checkout'){const hf=await pg.evaluate(()=>{const c=document.querySelector('[data-act="posto-manual-fechar"]');return c?c.getBoundingClientRect().height:0;});ok(hf>=44,`22: Fechar venda manual com ${hf} px a ${w} px`);}}}
    await ctx.close();}

  // ================= Admin: critérios 11, 14, 15, 18, 19, 20 =================
  {const {ctx,pg}=await nova(b);await limpa(pg);ok(await entrar(pg,ADMIN),'admin não entrou');const cs=await semear(pg);
    // 14
    const a14=await pg.evaluate(()=>({item:!!document.querySelector('#nav [data-v="posto"]'),grp:(()=>{const i=document.querySelector('#nav [data-v="posto"]');const g=i&&i.closest('.navg');return g&&g.querySelector('.grp')?g.querySelector('.grp').textContent.trim():'';})(),ck:!!document.querySelector('#rail-ck [data-act="loja-abrir"]'),cx:!!document.querySelector('#rail-ck [data-v="caixa"]')}));
    ok(a14.item&&a14.grp==='Venda'&&a14.ck&&a14.cx,'14: admin: item Posto de venda e botões amarelos: '+J(a14));
    // 18: Início
    await pg.evaluate(()=>ETERNA.go('perfis'));await pg.waitForTimeout(200);
    const a18=await pg.evaluate(()=>({card:([...document.querySelectorAll('#main .role .t')].find(x=>/^Caixa/.test(x.textContent))||{}).textContent,pill:([...document.querySelectorAll('#main .head .pill')].find(x=>/aguardando/.test(x.textContent))||{}).textContent,cx:(document.querySelector('#rail-cx')||{}).textContent,txt:document.querySelector('#main').innerText}));
    ok(a18.card==='Caixa · 2 em dinheiro para confirmar'&&a18.cx==='2'&&a18.pill==='5 aguardando pagamento'&&!/aguardando caixa|aguardando dinheiro/.test(a18.txt),'18: Início: '+J({card:a18.card,pill:a18.pill,cx:a18.cx}));
    // 19: Lista de vendas
    const lista=st=>pg.evaluate(st=>{ETERNA.state.range.from='2000-01-01';ETERNA.state.range.to='2099-12-31';ETERNA.state.sales.status=st;ETERNA.state.sales.page=0;ETERNA.go('vendas-lista');ETERNA.render();},st);await lista('aguardando');await pg.waitForTimeout(300);
    const linhas=()=>pg.evaluate(()=>[...document.querySelectorAll('#main tbody tr')].map(tr=>({t:tr.innerText.replace(/\s+/g,' '),chips:[...tr.querySelectorAll('[data-act="view"]')].map(x=>x.dataset.v+':'+x.textContent)})).filter(x=>x.chips.length));
    const a19=await linhas();const de=k=>a19.filter(x=>new RegExp(k).test(x.t)).map(x=>x.chips.join());
    ok(a19.length===5&&J(a19.filter(x=>x.chips[0]==='caixa:Caixa').length)==='2'&&a19.filter(x=>x.chips[0]==='posto:Posto').length===3&&de('PIX').every(c=>c==='posto:Posto')&&de('Cartão').every(c=>c==='posto:Posto')&&de('Escolha do pacote pendente').every(c=>c==='posto:Posto'),'19: chips Caixa (dinheiro) e Posto (PIX, cartão, sem pacote): '+J(a19));
    await pg.click('#main tbody [data-act="view"][data-v="caixa"]');await pg.waitForTimeout(250);ok((await tela(pg)).v==='caixa','19: o chip Caixa abre o Caixa');
    await lista('aguardando');await pg.waitForTimeout(250);await pg.click('#main tbody [data-act="view"][data-v="posto"]');await pg.waitForTimeout(250);ok((await tela(pg)).v==='posto','19: o chip Posto abre o Posto');
    // 7 (admin, valores da a9b4028)
    await roteiroDin(pg);const r7=await venda(pg,cs[0],'L00-teste0din01');ok(J(r7)===J(BASE.din),'7 (admin): SIM e fila iguais aos da a9b4028: '+J(r7));
    await pg.evaluate(c=>{ETERNA.state.sales.status='all';ETERNA.state.sales.q=c;ETERNA.state.sales.page=0;ETERNA.go('vendas-lista');ETERNA.render();},cs[0]);await pg.waitForTimeout(300);
    const rb=await pg.$(`#main tbody [data-act="sales-receipt"][data-card="${cs[0]}"]`);ok(!!rb,'19: Recibo da venda paga na lista');
    if(rb){await rb.click();await pg.waitForTimeout(400);const t=await tela(pg);ok(t.v==='posto'&&t.hash==='#posto'&&!t.manual&&await pg.evaluate(()=>!!document.querySelector('.posto-recibo #qrbox')&&/Recibo ·/.test(document.querySelector('.posto-recibo').textContent)),'19: Recibo abre em cima do Posto: '+J({v:t.v,hash:t.hash}));
      await pg.click('[data-act="posto-recibo-fechar"]');await pg.waitForTimeout(150);}
    // 20: agente desligado
    for(const v of ['posto','caixa']){await pg.evaluate(v=>{ETERNA.go(v);ETERNA.state.agent.on=false;ETERNA.state.agent.tried=true;ETERNA.state.agent.lastOk=Date.now()-120000;ETERNA.render();},v);await pg.waitForTimeout(150);
      const a20=await pg.evaluate(()=>({off:(document.querySelector('#main .conn-off')||{}).textContent||'',good:document.querySelectorAll('#main .posto-head .pill.good').length,cx:(document.querySelector('#rail-cx')||{}).textContent}));
      ok(/O computador do ponto não está respondendo\. Chame a TI\./.test(a20.off)&&a20.good===0&&a20.cx==='1',`20: agente desligado no ${v}: `+J(a20));}
    // 11: Venda manual de ponta a ponta dentro do Posto, igual à a9b4028
    const card=await roteiroManual(pg);let t=await tela(pg);
    const a11=await pg.evaluate(()=>({rec:!!document.querySelector('#posto-manual #qrbox')&&/Recibo ·/.test(document.querySelector('#posto-manual').textContent),prox:!!document.querySelector('#posto-manual [data-act="checkout-next-guest"]'),fora:document.querySelectorAll('.posto-recibo').length}));
    ok(t.v==='posto'&&t.manual&&a11.rec&&a11.prox&&a11.fora===0,'11: recibo com QR dentro do bloco: '+J({v:t.v,a11}));
    const r11=await venda(pg,card);ok(BASE.manual&&J(r11)===J(BASE.manual),'11: venda manual igual à da a9b4028: '+J(r11)+' ≠ '+J(BASE.manual));
    await pg.click('#posto-manual [data-act="checkout-next-guest"]');await pg.waitForTimeout(250);t=await tela(pg);
    ok(t.v==='posto'&&t.manual&&t.hash==='#checkout'&&await pg.evaluate(()=>!!document.querySelector('#posto-manual #ck-code')&&ETERNA.state.checkout.session==null),'11: Próximo convidado mantém o bloco na etapa 1');
    // 14: admin tem o botão LGPD na etapa 2; a confirmação abre e o Cancelar fecha
    const cl=await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="checkout-pick"]')].map(x=>x.dataset.card).sort()[0]);await pg.click(`#posto-manual [data-act="checkout-pick"][data-card="${cl}"]`);await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>(document.querySelector('#posto-manual [data-act="lgpd-pedir"]')||{}).textContent)==='Cliente pediu: apagar as fotos','14: admin com o botão LGPD na Venda manual');
    ok(await pg.evaluate(()=>!!document.querySelector('#posto-manual [data-act="fila-bg"]')||/Fundo de IA/.test(document.querySelector('#posto-manual').textContent)),'11: Fundo de IA na Venda manual');
    await pg.click('#posto-manual [data-act="lgpd-pedir"]');await pg.waitForTimeout(150);ok(await pg.evaluate(()=>!!document.querySelector('.mx [data-act="lgpd-excluir"]')),'LGPD: a confirmação abre na Venda manual');
    await pg.click('.mx [data-act="lgpd-nao"]');await pg.waitForTimeout(150);ok(await pg.evaluate(c=>!document.querySelector('.mx')&&!ETERNA.SIM.sessions[c].lgpd,cl),'LGPD: Cancelar não apaga');
    await pg.click('[data-act="posto-manual-fechar"]');await pg.waitForTimeout(150);
    // 15: PRESETS iguais aos da a9b4028 e a lista do módulo em Permissões
    const pr=await presetsSnap(pg);ok(BASE.presets&&pr===J(BASE.presets),'15: PRESETS (perms, menu, início) mudaram em relação à a9b4028');
    await pg.evaluate(()=>{ETERNA.state.perm.tab='usuario';ETERNA.state.view='permissoes';ETERNA.render();});await pg.click(`[data-act="perm-sel"][data-e="${VEND}"]`);await pg.evaluate(()=>document.querySelectorAll('details.perm-fino').forEach(d=>d.open=true));await pg.waitForTimeout(150);
    const a15=await pg.evaluate(()=>{const c=document.querySelector('[data-act="perm-view"][data-v="posto"]');const tr=c&&c.closest('tr');return tr?[...tr.querySelectorAll('label')].map(l=>l.textContent.trim()):null;});
    ok(J(a15)===J(['Venda manual (link dentro do Posto)','Caixa (botão amarelo Caixa)','Posto de venda']),'15: lista do módulo Posto de venda em Permissões: '+J(a15));
    ok(/Caixa \(botão amarelo: o Posto só com o dinheiro\) e Venda manual \(dentro do Posto\)/.test(await pg.evaluate(()=>ETERNA.MODULE_INFO.venda.desc))&&!/Fila do balcão/.test(await pg.evaluate(()=>document.querySelector('#main').innerText)),'15: texto do módulo sem Fila do balcão');
    // salvar um cadastro que tinha fila no menu: sem erro e o fila continua gravado
    await pg.click('.perm-tbl input[data-act="perm-view"][data-v="checkout"]');await pg.waitForTimeout(80);await pg.click('[data-act="perm-save"]');await pg.waitForTimeout(250);
    const s15=await pg.evaluate(e=>({menu:ETERNA.USERS[e].menu,toast:document.querySelector('#toast').textContent}),VEND);
    ok(s15.menu.includes('fila')&&!s15.menu.includes('checkout')&&s15.menu.includes('posto')&&!/erro|não/i.test(s15.toast),'15: salvar com fila no menu: '+J(s15));
    await ctx.close();}

  // ================= Supervisora, Fotógrafo e Checkout: critério 14 =================
  {const {ctx,pg}=await nova(b);await limpa(pg);ok(await entrar(pg,SUP),'supervisora não entrou');
    await pg.evaluate(()=>ETERNA.go('posto'));await pg.waitForTimeout(200);
    const s14=await pg.evaluate(()=>({item:!!document.querySelector('#nav [data-v="posto"]'),ck:!!document.querySelector('#rail-ck [data-act="loja-abrir"]'),cx:!!document.querySelector('#rail-ck [data-v="caixa"]'),link:!!document.querySelector('.posto-rodape [data-act="posto-manual"]'),v:ETERNA.state.view,galU:ETERNA.can('galerias','u')}));
    ok(s14.item&&s14.ck&&s14.cx&&s14.link&&s14.v==='posto','14: supervisora: '+J(s14));
    await pg.click('.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(200);const c=await pg.evaluate(()=>[...document.querySelectorAll('#posto-manual [data-act="checkout-pick"]')].map(x=>x.dataset.card).sort()[0]);await pg.click(`#posto-manual [data-act="checkout-pick"][data-card="${c}"]`);await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>!!document.querySelector('#posto-manual [data-act="lgpd-pedir"]'))===s14.galU&&s14.galU,'14: supervisora com o botão LGPD (galerias u): '+J(s14));
    await ctx.close();}
  for(const [em,nome] of [[FOTO,'fotógrafo'],[CK,'Checkout']]){const {ctx,pg}=await nova(b);await limpa(pg);ok(await entrar(pg,em),nome+' não entrou');
    const f=await pg.evaluate(()=>({item:!!document.querySelector('#nav [data-v="posto"]'),cx:!!document.querySelector('#rail-ck [data-v="caixa"]'),posto:ETERNA.canView('posto'),caixa:ETERNA.canView('caixa'),manual:ETERNA.canView('checkout')}));
    ok(!f.item&&!f.cx&&!f.posto&&!f.caixa&&!f.manual,`14: ${nome} sem Posto, Caixa e Venda manual: `+J(f));
    if(em===FOTO){ // 16: sem venda.r, os quatro endereços não abrem o Posto
      for(const h of ['#posto','#caixa','#checkout','#fila']){await abrir(pg,h);const t=await tela(pg);ok(!['posto','caixa','checkout','fila'].includes(t.v)&&!t.manual&&!/Aguardando pagamento/.test(t.txt),`16: sem venda.r, ${h} abriu ${t.v}`);}
      await pg.evaluate(()=>ETERNA.go('posto'));await pg.waitForTimeout(100);ok(await toastTxt(pg)==='Sem acesso a esta tela','16: go(posto) sem venda.r: '+await toastTxt(pg));
      await pg.evaluate(()=>ETERNA.go('checkout'));await pg.waitForTimeout(100);ok(await toastTxt(pg)==='Sem acesso a esta tela'&&await pg.evaluate(()=>!ETERNA.state.posto.manual),'16: go(checkout) sem venda.r');}
    await ctx.close();}

  // ================= Cadastros personalizados: critérios 16 e 17 =================
  {const {ctx,pg}=await nova(b);await limpa(pg);
    const RW={c:true,r:true,u:true,d:false};
    await personalizado(pg,VEND,{venda:RW},['caixa']);ok(await entrar(pg,VEND),'personalizado (só caixa) não entrou');await semear(pg);await pg.evaluate(()=>ETERNA.go('posto'));await pg.waitForTimeout(200);
    const p16=await pg.evaluate(()=>({item:!!document.querySelector('#nav [data-v="posto"]'),cx:!!document.querySelector('#rail-ck [data-v="caixa"]'),link:!!document.querySelector('[data-act="posto-manual"]'),v:ETERNA.state.view,menu:ETERNA.userMenu(ETERNA.state.user)}));
    ok(p16.item&&p16.cx&&!p16.link&&p16.v==='posto'&&J(p16.menu)===J(['caixa']),'16: menu só com caixa: vê o Posto e o botão amarelo, sem o link: '+J(p16));
    await abrir(pg,'#checkout');let t=await tela(pg);ok(t.v==='posto'&&!t.manual&&t.hash==='#posto','16: #checkout abre o Posto sem o bloco: '+J({v:t.v,hash:t.hash,manual:t.manual}));
    await forcar(pg,'posto-manual');await pg.waitForTimeout(120);ok(await toastTxt(pg)==='Sem acesso à Venda manual'&&!await pg.$('#posto-manual')&&await pg.evaluate(()=>!ETERNA.state.posto.manual),'16 e risco 2: posto-manual forçado é recusado: '+await toastTxt(pg));
    // 17: só ver
    await personalizado(pg,VEND,{venda:{c:false,r:true,u:false,d:false}},['posto','caixa','checkout']);ok(await entrar(pg,VEND),'personalizado (só ver) não entrou');await pg.evaluate(()=>{const S=ETERNA.SIM;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));});
    for(const v of ['posto','caixa']){await pg.evaluate(v=>ETERNA.go(v),v);await pg.waitForTimeout(200);
      const p17=await pg.evaluate(()=>({v:ETERNA.state.view,n:document.querySelectorAll('#pend-painel [data-pend]').length,conf:document.querySelectorAll('#main [data-act="din-confirm"],#main [data-act="pend-pos"],#main [data-act="din-cancel"]').length,dis:[...document.querySelectorAll('#main .pend-pkg,#main .pend-meio')].every(x=>x.disabled),cx:!!document.querySelector('#rail-ck [data-v="caixa"]')}));
      ok(p17.v===v&&p17.n>=1&&p17.conf===0&&p17.dis&&!p17.cx,`17: só ver no ${v}: `+J(p17));}
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA posto-unico: '+fails.join(' || '));process.exit(1);}
console.log('OK posto-unico: Posto de venda único, Caixa só com o dinheiro, Venda manual dentro do Posto (critérios 2 a 20 e 22)');process.exit(0);
})();
