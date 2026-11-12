// v100 (fase 2): venda das ativações no tablet, local first. Nenhuma venda se perde: sem rede ela fica no tablet (duas
// cópias), sobrevive a recarregar a página e a sair da conta, segue sozinha quando a rede volta e não duplica; com o
// armazenamento cheio numa das cópias a outra segura; sem nenhuma, o carrinho continua na tela. Também: preço fixo do
// catálogo, Cortesia com motivo e nota, venda igual em 2 minutos pede confirmação, uma venda por serviço, idioma.
// E a tela (Ronaldo, 12/11): título sem "ativações", nome do vendedor no topo, serviço > pessoas e vídeo > venda > cliente
// (país e idioma em lista) > pagamento, sem guia e sem agendamento, Minhas vendas numa aba, vídeo de demonstração guardado
// no tablet e tocado de lá, e o botão Cancelar só para quem tem a permissão.
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
  let demoPedidos=0;
  await ctx.route(/\/ativ\/demo\/lista$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,videos:[{nome:'asteroid_campo_3.mp4',tamanho:9,versao:1}]})}));
  await ctx.route(/\/ativ\/demo\/asteroid_campo_3\.mp4$/,r=>{demoPedidos++;r.fulfill({status:200,contentType:'video/mp4',body:Buffer.from('ftypmp42x')});});
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('eterna-ativ');});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  const abre=async()=>{await A.evaluate(()=>ETERNA.go('ativ-venda'));await A.waitForTimeout(200);};
  await abre();
  ok(await A.evaluate(()=>ETERNA.canView('ativ-venda')),'admin vê a venda');
  const cab=await A.textContent('#main .head');
  ok(/Drone, Chute a Gol e Snap Pop/.test(cab)&&!/Ativa/.test(cab)&&/vendedor/.test(await A.textContent('#av-quem')),'título com os três serviços, sem ativações, e o vendedor no topo: '+cab);
  ok(await A.$('[data-act="av-guia"]')===null&&await A.$('[data-act="av-quando"]')===null,'sem guia e sem agendar voo');
  const ordem=await A.evaluate(()=>['av-prod','av-cart','av-cliente','av-pag'].map(id=>document.getElementById(id).getBoundingClientRect().top));
  ok(ordem.every((y,i)=>!i||y>ordem[i-1]),'ordem: serviço, venda, cliente, pagamento: '+J(ordem));
  ok((await A.$$('select[data-act="av-pais"] option')).length>150&&(await A.$$('select[data-act="av-idioma"] option')).length===8,'país em lista com todos os países, idioma com os principais e Outro');
  // vídeo de demonstração: 3 pessoas, copiado para o tablet e tocado de lá
  await A.evaluate(async()=>{ETERNA.state.agent.on=true;await ETERNA.avDemoCopia();});
  ok(demoPedidos===1,'vídeo copiado uma vez: '+demoPedidos);
  await A.evaluate(async()=>{await ETERNA.avDemoCopia();});ok(demoPedidos===1,'mesma versão não baixa de novo');
  await A.click('[data-act="av-pessoas"][data-v="3"]');await A.click('[data-act="av-demo"][data-id="asteroid"]');await A.waitForTimeout(300);
  ok(/^blob:/.test(await A.getAttribute('#av-demo video','src')||''),'vídeo de 3 pessoas tocado do tablet');
  await A.click('[data-act="av-demo-fechar"]');await A.click('[data-act="av-demo"][data-id="boomerang"]');await A.waitForTimeout(300);
  ok(await A.$('#av-demo video')===null&&/ainda não está no tablet/.test(await A.textContent('#av-demo')),'vídeo que não existe: aviso, sem ficar carregando');
  await A.click('[data-act="av-demo-fechar"]');await A.click('[data-act="av-pessoas"][data-v="1"]');
  await A.evaluate(()=>{ETERNA.state.agent.on=false;});
  // carrinho: Asteroid (Campo) com 4K e 2 vídeos + 3 Chutes
  await A.click('[data-act="av-add"][data-id="asteroid"]');await A.waitForTimeout(80);
  await A.click('[data-act="av-mais"][data-i="0"][data-k="qtd"]');await A.check('[data-act="av-k4"][data-i="0"]');await A.waitForTimeout(80);
  ok(/R\$\s?500/.test(await A.textContent('#av-total')),'Asteroid ×2 com 4K = 500: '+await A.textContent('#av-total'));
  await A.click('[data-act="av-cat"][data-c="chute"]');await A.click('[data-act="av-add"][data-id="c3"]');await A.waitForTimeout(80);
  ok(J(await A.$$eval('[data-act="av-sub"]',x=>x.map(b=>b.textContent)))===J(['3 Chutes','5 Chutes','Produtos']),'Chute a Gol em abas: 3 Chutes, 5 Chutes, Produtos');
  ok(await A.$('[data-act="av-add"][data-id="c5"]')===null,'5 Chutes fica na aba dele');
  await A.click('[data-act="av-sub"][data-v="prod"]');ok(await A.$('[data-act="av-add"][data-id="medalha"]')!==null&&await A.$('[data-act="av-add"][data-id="c3"]')===null,'aba Produtos: medalha e bolas');
  await A.click('[data-act="av-sub"][data-v="c3"]');
  ok(/R\$\s?610/.test(await A.textContent('#av-total')),'total pelo catálogo, 500 + 110: '+await A.textContent('#av-total'));
  ok(await A.$('#av-cart input[type="number"]')===null,'preço fixo: o vendedor não digita valor');
  // sem pagamento não registra
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(100);
  ok(/forma de pagamento/.test(await A.textContent('#av-erro')),'pede pagamento');
  await A.click('[data-act="av-pag"][data-p="PIX"]');await A.selectOption('[data-act="av-pais"]','Chile');await A.selectOption('[data-act="av-idioma"]','Espanhol');
  // SEM REDE: registra no tablet
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(600);
  let s=await A.evaluate(async()=>({ls:ETERNA.asLer(),cart:ETERNA.state.av.cart.length}));
  ok(s.ls.length===2&&s.ls.every(x=>x.est==='pendente')&&s.cart===0,'sem rede: duas vendas (Drone e Chute) guardadas no tablet: '+J(s));
  const d=s.ls.find(x=>x.v.tipo==='drone'),c=s.ls.find(x=>x.v.tipo==='chute');
  ok(d&&c&&d.v.id.slice(0,-1)===c.v.id.slice(0,-1)&&d.v.valor===500&&c.v.valor===110&&c.v.sugerido===110&&d.v.pais==='Chile'&&d.v.idioma==='Espanhol'&&d.v.itens[0].videos===2&&d.v.itens[0].k4,'uma venda por serviço, mesmo número, valores e cliente: '+J(s.ls.map(x=>x.v)));
  await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(100);
  ok(/Sem conexão/.test(await A.textContent('#main'))&&/Aguardando envio/.test(await A.textContent('#av-minhas'))&&await A.$('#av-prod')===null,'aba Minhas vendas: sem conexão e aguardando envio');
  await A.click('[data-act="av-aba"][data-v="nova"]');
  // a cópia do IndexedDB
  const idb=await A.evaluate(()=>new Promise(res=>{const r=indexedDB.open('eterna-ativ',2);r.onsuccess=()=>{const q=r.result.transaction('saida').objectStore('saida').get('lista');q.onsuccess=()=>res(JSON.parse(q.result||'[]').length);};r.onerror=()=>res(-1);}));
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
  await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(100);
  ok(/Tudo enviado/.test(await A.textContent('#main'))&&/Enviada ao servidor/.test(await A.textContent('#av-minhas')),'tela mostra tudo enviado');
  ok((await A.$$('[data-act="av-cancelar"]')).length===2,'admin vê Cancelar');
  await A.evaluate(()=>{const u=ETERNA.state.user;u.perms={...u.perms,ativvenda:{c:true,r:true,u:false,d:false},financeiro:{c:false,r:false,u:false,d:false}};});await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(100);
  ok((await A.$$('[data-act="av-cancelar"]')).length===0,'vendedor sem a permissão não vê Cancelar');
  await A.evaluate(()=>{const u=ETERNA.state.user;u.perms={...u.perms,ativvenda:{c:true,r:true,u:true,d:true},financeiro:{c:true,r:true,u:true,d:true}};});
  await A.click('[data-act="av-aba"][data-v="nova"]');
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
  ok(/My sales/.test(await A.textContent('#main'))&&/Payment/.test(await A.textContent('#main'))&&/Shot on goal/.test(await A.textContent('#main .head')),'tela em inglês');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes_venda: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes_venda: sem rede guarda no tablet (duas cópias), recarregar e sair não perdem, reenvio sem duplicar, cortesia, venda igual, armazenamento cheio');process.exit(0);
})();
