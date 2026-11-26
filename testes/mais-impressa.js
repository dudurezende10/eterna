// Eduardo (25/11): o Pacote Maracanã Mais passa a ter todas as fotos digitais e 1 foto impressa. O preço não muda.
// Cobre: venda Mais = 1 impressa na fila; Mais + 2 Fotos adicionais = 3; a favorita imprime primeiro; galeria online = 0 impressas. Sem agente.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(400);
  await entrarTeste(pg,'eduardo@eduardorezende.com');
  // a conta: Catálogo, vendaCalc e a soma com adicional, cortesia e porta-retrato
  const c=await pg.evaluate(()=>{const E=ETERNA;const f=(n,pkg,q)=>{const v=E.vendaCalc(n,n,pkg,false,q);return {total:v.total,prints:v.prints,cart:v.cart.map(x=>x.id).join('+')};};
    return {price:E.priceOf('mais'),so:f(5,'mais'),uma:f(1,'mais'),com2:f(5,'mais',{mais:1,extra:2}),cort:(()=>{const v=E.vendaCalcCort({card:'x',cortFoto:{n:1,fotos:['a']},pkgs:{mais:1}},5,'mais');return {total:v.total,prints:v.prints};})(),
      zona:f(3,'zona').prints,gramado:f(4,'gramado').prints};});
    ok(c.price===250&&J(c.so)===J({total:250,prints:1,cart:'mais'})&&c.uma.prints===1,'Mais sozinho: R$ 250 e 1 impressa: '+J(c));
  ok(J(c.com2)===J({total:320,prints:3,cart:'mais+extra+extra'}),'Mais + 2 adicionais: R$ 320 e 3 impressas: '+J(c.com2));
  ok(c.cort.total===250&&c.cort.prints===2,'Mais + 1 foto cortesia: 2 impressas, mesmo valor: '+J(c.cort));
  ok(c.zona===0&&c.gramado===4,'os outros pacotes não mudam: '+J(c));
  // Posto: dois pedidos do Checkout com 5 fotos. A = só o Mais (favorita = 3ª foto); B = Mais + 2 Fotos adicionais
  await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const ds=E.demoSessions().filter(s=>s.status!=='paga'&&s.status!=='aberta'&&s.photos.length>=6).sort((a,b)=>a.card<b.card?-1:1);
    const ped=(id,s,cod,fav)=>({id,card:s.card,codigo:cod,criada:new Date().toISOString(),estado:'escolha',escolha:true,n:5,nSes:s.photos.length,selected:s.photos.slice(0,5).map(p=>p.id),aiSel:[],fav:fav?[s.photos[2].id]:[],pkg:null,total:null,meio:null,canal:'checkout',iniciado:'aguardando',saleNo:'L0-8'+id.slice(-2)});
    S.caixaDin=[ped('L00-mais000a01',ds[0],'MAIA-2345',true),ped('L00-mais000b02',ds[1],'MAIB-2345',false)];
    localStorage.setItem('eterna.sim.v1',JSON.stringify(S));E.simFresh();E.go('posto');});
  const A='L00-mais000a01',B='L00-mais000b02';
  const mais=async(id,p)=>{await pg.click(`.pend-esc[data-pend="${id}"] [data-act="pend-pkg-q"][data-p="${p}"][aria-label="+1"]`);await pg.waitForTimeout(200);};
  const ped=id=>pg.evaluate(id=>{const r=ETERNA.SIM.caixaDin.find(x=>x.id===id);const it=document.querySelector(`.pend-esc[data-pend="${id}"]`);
    const li=it&&[...it.querySelectorAll('.pend-itens li')].find(x=>/Maracanã Mais/.test(x.textContent));return {total:r.total,prints:r.prints,cart:(r.cart||[]).map(x=>x.id).join('+'),desc:li?(li.querySelector('small')||{}).textContent:'',nota:it?it.querySelector('.note').textContent:''};},id);
  const pagar=async id=>{await pg.click(`.pend-esc[data-pend="${id}"] .pc-pagar`);await pg.waitForTimeout(200);await pg.click(`.pend-esc [data-act="pend-meio"][data-id="${id}"][data-m="dinheiro"]`);await pg.waitForTimeout(200);
    await pg.click(`[data-act="din-confirm"][data-id="${id}"]`);await pg.waitForTimeout(400);
    return pg.evaluate(id=>{const E=ETERNA;const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);const s=S.sessions[r.card]||{};const im=s.impressao||{};const f=E.impFotos(s);const sel=E.impSel(r.card,E.SIM.sessions[r.card]);
      return {estado:r.estado,status:s.status,total:s.total,prints:s.prints,imp:im.estado,alvo:im.alvo,fila:f.fotos.map(x=>x.k),sel:sel.sel.map(x=>x.k),max:sel.max,pode:sel.pode.length,selected:s.selected||[],fav:s.fav||[]};},id);};
  const abrir=async id=>{if(!await pg.$(`.pend-esc[data-pend="${id}"]`)){await pg.click(`.pend-row[data-pend="${id}"]`);await pg.waitForTimeout(250);}};
  await abrir(A);let a=await ped(A);ok(a.desc==='Todas as fotos digitais e 1 foto impressa'&&a.total===null,'Posto: a linha do Mais diz o que o pacote tem: '+J(a));
  await mais(A,'mais');a=await ped(A);ok(a.total===250&&a.prints===1&&a.cart==='mais'&&/1 impressa/.test(a.nota),'A: Mais escolhido = R$ 250 e 1 impressa no pedido: '+J(a));
  const va=await pagar(A);
  ok(va.estado==='confirmada'&&va.status==='paga'&&va.prints===1&&va.imp==='pendente'&&va.alvo===1,'A: venda paga grava 1 impressa e entra na fila de impressão com 1 foto: '+J(va));
  ok(va.fila.length===1&&va.fila[0]===va.selected[2]&&va.max===1&&va.pode===5&&J(va.sel)===J(va.fila),'A: imprime a favorita e o atendente pode trocar entre as 5 na fila: '+J(va));
  await abrir(B);await mais(B,'mais');await mais(B,'extra');await mais(B,'extra');const pb=await ped(B);
  ok(pb.total===320&&pb.prints===3&&pb.cart==='mais+extra+extra','B: Mais + 2 adicionais = R$ 320 e 3 impressas: '+J(pb));
  const vb=await pagar(B);
  ok(vb.status==='paga'&&vb.prints===3&&vb.imp==='pendente'&&vb.alvo===3&&J(vb.fila)===J(vb.selected.slice(0,3)),'B: 3 fotos na fila, pela ordem das escolhidas: '+J(vb));
  // galeria online: "todas" comprada em casa não tem impressa e o texto da oferta não fala em impressão
  const on=await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const card=S.caixaDin[0].card;S.vendasOnline=[{id:'O901',token:'t',card,pids:['a','b'],n:2,total:250,pay:'Pix online',at:new Date().toISOString(),canal:'online',status:'paga',todas:true,teste:true}];
    const v=E.allSales().find(x=>x.no==='O901')||{};const txt=[0,1,2,3,4].map(()=>E.T('gq_offer',3,'R$ 110','R$ 35','R$ 250')).join(' ')+' '+E.T('gq_all','R$ 250');
    return {prints:v.prints,items:v.items,canal:v.canal,promete:/impress|print|imprim|druck/i.test(txt)};});
  ok(on.prints===0&&J(on.items)===J(['mais'])&&on.canal==='online'&&!on.promete,'galeria online: "todas" segue com 0 impressas e sem prometer impressão: '+J(on));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+e.message);}
await b.close();
console.log(fails.length?'FALHA mais-impressa:\n - '+fails.join('\n - '):'OK mais-impressa: Maracanã Mais com 1 impressa (fila, adicionais, favorita) e galeria online sem impressa');
process.exit(fails.length?1:0);})();
