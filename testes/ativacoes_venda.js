// v100 (fase 2): venda das ativações no tablet, local first. Nenhuma venda se perde: sem rede ela fica no tablet (duas
// cópias), sobrevive a recarregar a página e a sair da conta, segue sozinha quando a rede volta e não duplica; com o
// armazenamento cheio numa das cópias a outra segura; sem nenhuma, o carrinho continua na tela. Também: preço fixo do
// catálogo, Cortesia com motivo e nota, venda igual em 2 minutos pede confirmação, uma venda por serviço, idioma.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:800,height:1200}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  let rede=false;const recebidas=new Map();
  await ctx.route(/\/ativ\/venda$/,r=>{if(!rede)return r.abort('internetdisconnected');const j=JSON.parse(r.request().postData());const ids=[];j.vendas.forEach(v=>{recebidas.set(v.id,v);ids.push(v.id);});
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,recebidas:ids,recusadas:[]})});});
  await ctx.route(/\/ativ\/minhas\?/,r=>r.abort());
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('eterna-ativ');});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  const abre=async()=>{await A.evaluate(()=>ETERNA.go('ativ-venda'));await A.waitForTimeout(200);};
  await abre();
  ok(await A.evaluate(()=>ETERNA.canView('ativ-venda')),'admin vê Ativações');
  // carrinho: Asteroid (Campo) com 4K e 2 vídeos + 3 Chutes
  await A.click('[data-act="av-add"][data-id="asteroid"]');await A.waitForTimeout(80);
  await A.click('[data-act="av-mais"][data-i="0"][data-k="qtd"]');await A.check('[data-act="av-k4"][data-i="0"]');await A.waitForTimeout(80);
  ok(/R\$\s?500/.test(await A.textContent('#av-total')),'Asteroid ×2 com 4K = 500: '+await A.textContent('#av-total'));
  await A.click('[data-act="av-cat"][data-c="chute"]');await A.click('[data-act="av-add"][data-id="c3"]');await A.waitForTimeout(80);
  ok(/R\$\s?610/.test(await A.textContent('#av-total')),'total pelo catálogo, 500 + 110: '+await A.textContent('#av-total'));
  ok(await A.$('#av-cart input[type="number"]')===null,'preço fixo: o vendedor não digita valor');
  // sem pagamento não registra
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(100);
  ok(/forma de pagamento/.test(await A.textContent('#av-erro')),'pede pagamento');
  await A.click('[data-act="av-pag"][data-p="PIX"]');await A.click('[data-act="av-pais"][data-v="Chile"]');await A.click('[data-act="av-idioma"][data-v="Espanhol"]');
  // SEM REDE: registra no tablet
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(600);
  let s=await A.evaluate(async()=>({ls:ETERNA.asLer(),cart:ETERNA.state.av.cart.length}));
  ok(s.ls.length===2&&s.ls.every(x=>x.est==='pendente')&&s.cart===0,'sem rede: duas vendas (Drone e Chute) guardadas no tablet: '+J(s));
  const d=s.ls.find(x=>x.v.tipo==='drone'),c=s.ls.find(x=>x.v.tipo==='chute');
  ok(d&&c&&d.v.id.slice(0,-1)===c.v.id.slice(0,-1)&&d.v.valor===500&&c.v.valor===110&&c.v.sugerido===110&&d.v.pais==='Chile'&&d.v.idioma==='Espanhol'&&d.v.itens[0].videos===2&&d.v.itens[0].k4,'uma venda por serviço, mesmo número, valores e cliente: '+J(s.ls.map(x=>x.v)));
  ok(/Sem conexão/.test(await A.textContent('#main'))&&/Aguardando envio/.test(await A.textContent('#av-minhas')),'tela avisa sem conexão e mostra aguardando envio');
  // a cópia do IndexedDB
  const idb=await A.evaluate(()=>new Promise(res=>{const r=indexedDB.open('eterna-ativ',1);r.onsuccess=()=>{const q=r.result.transaction('saida').objectStore('saida').get('lista');q.onsuccess=()=>res(JSON.parse(q.result||'[]').length);};r.onerror=()=>res(-1);}));
  ok(idb===2,'segunda cópia no IndexedDB: '+idb);
  // recarregar a página e sair da conta não perdem nada; com o localStorage apagado, a cópia do IndexedDB devolve
  await A.reload();await A.waitForTimeout(500);
  ok((await A.evaluate(()=>ETERNA.asLer().length))===2,'depois de recarregar');
  await A.evaluate(()=>ETERNA.logout());await A.waitForTimeout(200);
  ok((await A.evaluate(()=>ETERNA.asLer().length))===2,'sair da conta não apaga a caixa de saída');
  await A.evaluate(()=>localStorage.removeItem('eterna.ativ.saida.v1'));await A.reload();await A.waitForTimeout(600);
  ok((await A.evaluate(()=>ETERNA.asLer().length))===2,'localStorage apagado: o IndexedDB devolve as vendas');
  await E(A,adm);await abre();
  // a REDE VOLTA: envia sozinho, sem duplicar
  rede=true;await A.evaluate(()=>ETERNA.asEnviar());await A.waitForTimeout(500);await A.evaluate(()=>ETERNA.asEnviar());await A.waitForTimeout(300);
  s=await A.evaluate(()=>ETERNA.asLer());
  ok(recebidas.size===2&&s.every(x=>x.est==='enviada'),'rede voltou: enviadas, servidor recebeu 2: '+recebidas.size+' '+J(s.map(x=>x.est)));
  ok(/Tudo enviado/.test(await A.textContent('#main'))&&/Enviada ao servidor/.test(await A.textContent('#av-minhas')),'tela mostra tudo enviado');
  // venda igual em 2 minutos pede confirmação
  const vende=async()=>{await A.click('[data-act="av-cat"][data-c="drone"]');await A.click('[data-act="av-add"][data-id="boomerang"]');await A.click('[data-act="av-pag"][data-p="Dinheiro"]');await A.click('[data-act="av-registrar"]');await A.waitForTimeout(400);};
  await vende();await vende();
  ok(await A.$('#av-dup')!==null&&(await A.evaluate(()=>ETERNA.state.av.cart.length))===1,'venda igual pede confirmação e o carrinho fica');
  await A.click('[data-act="av-dup-sim"]');await A.waitForTimeout(500);
  ok((await A.evaluate(()=>ETERNA.asLer().length))===4,'confirmou: registrou de novo');
  // Cortesia exige motivo e nota
  await A.click('[data-act="av-add"][data-id="asteroid"]');await A.click('[data-act="av-pag"][data-p="Cortesia"]');await A.waitForTimeout(80);await A.click('[data-act="av-registrar"]');await A.waitForTimeout(150);
  ok(/motivo e a nota/.test(await A.textContent('#av-erro')),'cortesia sem motivo');
  await A.selectOption('[data-act="av-cmot"]',{index:1});await A.fill('[data-act="av-cnota"]','Equipe da TV');await A.click('[data-act="av-registrar"]');await A.waitForTimeout(500);
  const ct=await A.evaluate(()=>ETERNA.asLer().find(x=>x.v.pagamento==='Cortesia'));
  ok(ct&&ct.v.valor===0&&ct.v.cortesia_nota==='Equipe da TV'&&ct.v.cortesia_motivo&&ct.v.sugerido===180,'cortesia gravada com valor 0, sugerido e nota: '+J(ct&&ct.v));
  // armazenamento: sem localStorage a cópia do IndexedDB segura; sem nenhum, o carrinho fica
  rede=false;
  await A.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='eterna.ativ.saida.v1')throw new Error('QuotaExceededError');return window.__set.call(this,k,v);};});
  await A.click('[data-act="av-add"][data-id="boomerang"]');await A.click('[data-act="av-pag"][data-p="Débito"]');await A.click('[data-act="av-registrar"]');await A.waitForTimeout(500);
  ok((await A.evaluate(()=>ETERNA.state.av.saida.length))===6&&(await A.evaluate(()=>ETERNA.state.av.cart.length))===0,'localStorage cheio: gravou no IndexedDB');
  await A.evaluate(()=>{window.__idb=indexedDB.open;indexedDB.open=()=>{throw new Error('sem IndexedDB');};});
  await A.click('[data-act="av-add"][data-id="boomerang"]');await A.click('[data-act="av-pag"][data-p="Crédito"]');await A.click('[data-act="av-registrar"]');await A.waitForTimeout(500);
  ok((await A.evaluate(()=>ETERNA.state.av.cart.length))===1&&/não pôde ser gravada/.test(await A.textContent('#av-erro')),'sem nenhum armazenamento: avisa e o carrinho continua');
  await A.evaluate(()=>{Storage.prototype.setItem=window.__set;indexedDB.open=window.__idb;});
  // idioma
  await A.evaluate(()=>ETERNA.idiomaEquipe('en'));await A.waitForTimeout(200);
  ok(/My sales today/.test(await A.textContent('#main'))&&/Payment/.test(await A.textContent('#main')),'tela em inglês');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes_venda: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes_venda: sem rede guarda no tablet (duas cópias), recarregar e sair não perdem, reenvio sem duplicar, cortesia, venda igual, armazenamento cheio');process.exit(0);
})();
