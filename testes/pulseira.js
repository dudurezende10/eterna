// v99.25: pulseira numerada por vídeo. No tablet: um campo por vídeo (o leitor digita e o Enter pula para o próximo), número
// obrigatório, repetido na venda recusado, já usado em outra compra avisado e bloqueado; a venda vai com as pulseiras.
// Na entrega: a tela começa lendo a pulseira, abre o atendimento daquela pessoa (foto, nome, pulseira), Decolar grava o voo
// na pulseira, o vídeo solto já é dela (sem escolher venda), mostra a subida para a nuvem, lê o cartão e entrega; depois
// Próximo cliente. A faixa "Agora" mostra quem está voando; número em duas vendas pede escolher pelo rosto.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:800,height:1200}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const HOJE=new Date().toISOString().slice(0,10);
  // ---------------- TABLET ----------------
  const enviadas=[];
  await ctx.route(/\/ativ\/venda$/,r=>{const j=JSON.parse(r.request().postData());j.vendas.forEach(v=>enviadas.push(v));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,recebidas:j.vendas.map(v=>v.id),recusadas:[]})});});
  await ctx.route(/\/ativ\/minhas\?/,r=>r.abort());
  await ctx.route(/\/ativ\/pulseira\?n=/,r=>{const n=new URL(r.request().url()).searchParams.get('n');
    const vendas=n==='555'?[{venda:'TXYZ1234AB9D',slot:1,dia:HOJE,situacao:'ativa'}]:n==='31'?[{venda:'TPUL00000AD',slot:1,dia:HOJE,situacao:'ativa'},{venda:'TPUL00000BD',slot:1,dia:HOJE,situacao:'ativa'}]:[];
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,numero:n,vendas})});});
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('eterna-ativ');});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;ETERNA.go('ativ-venda');});await A.waitForTimeout(300);
  await A.click('[data-act="av-add"][data-id="asteroid"]');await A.click('[data-act="av-add"][data-id="asteroid"]');await A.waitForTimeout(100);
  ok((await A.$$('[data-act="av-pul"]')).length===2&&/Pulseira 1 de 2/.test(await A.textContent('#av-cart')),'dois vídeos, dois campos de pulseira');
  await A.click('[data-act="av-pag"][data-p="PIX"]');await A.fill('[data-act="av-nome"]','Cliente Teste');await A.evaluate(()=>{ETERNA.state.av.foto='data:image/jpeg;base64,/9j/2Q==';});
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(150);
  ok(/Leia a pulseira de cada item/.test(await A.textContent('#av-erro'))&&!enviadas.length,'sem pulseira não registra');
  await A.fill('[data-act="av-pul"][data-k="0"]','00123');await A.press('[data-act="av-pul"][data-k="0"]','Enter');await A.waitForTimeout(100);
  ok(await A.evaluate(()=>document.activeElement.dataset.k)==='1','Enter do leitor pula para a pulseira seguinte');
  await A.keyboard.type('123');await A.click('[data-act="av-registrar"]');await A.waitForTimeout(150);
  ok(/A mesma pulseira está em dois itens/.test(await A.textContent('#av-erro')),'0123 e 123 são a mesma pulseira');
  await A.fill('[data-act="av-pul"][data-k="1"]','555');await A.press('[data-act="av-pul"][data-k="1"]','Tab');await A.waitForTimeout(400);
  ok(/Pulseira já usada na venda nº 234AB9/.test(await A.textContent('[data-av-pul-aviso="0-1"]')),'pulseira já usada avisada na hora: '+await A.textContent('[data-av-pul-aviso="0-1"]'));
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(150);
  ok(/já foi usada em outra venda/.test(await A.textContent('#av-erro'))&&!enviadas.length,'pulseira usada não registra');
  await A.fill('[data-act="av-pul"][data-k="1"]','777');await A.press('[data-act="av-pul"][data-k="1"]','Tab');await A.waitForTimeout(300);
  await A.click('[data-act="av-registrar"]');await A.waitForTimeout(800);
  ok(enviadas.length===1&&J(enviadas[0].pulseiras.map(p=>p.n))===J(['123','777'])&&enviadas[0].pulseiras.every(p=>p.meio==='digitado'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(p.em)),'venda enviada com as pulseiras: '+J(enviadas.map(v=>v.pulseiras)));
  await A.close();

  // ---------------- ENTREGA ----------------
  const QRN='N'.repeat(21)+'2';
  const D={ok:true,nuvem:{ligada:true,fila:0},rascunhos:{},cadastros:{piloto:[{nome:'Piloto Um',ativo:true}],drone:[{nome:'007',ativo:true}],bateria:[{nome:'3',ativo:true}]},vendas:[
    {id:'TPUL00001D',tipo:'drone',criado:HOJE+'T10:05:00',cliente:'Cliente Um',foto:false,itens:[{produto:'asteroid',op:'Campo',qtd:2,pessoas:2,videos:2}],pagamento:'PIX',vendedor:'Vendedora Um',videos:2,entregas:[],fisicos:[],
     pulseiras:[{numero:'123',slot:1,conflito:false,voo_em:null,qr:null},{numero:'777',slot:2,conflito:false,voo_em:HOJE+'T10:20:00',piloto:'Piloto Um',drone:'007',bateria:'3',qr:null}],recebido_em:null,voo_em:null,entregue_em:null},
    {id:'TPUL00000AD',tipo:'drone',criado:HOJE+'T09:00:00',cliente:'Cliente Dois',foto:false,itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,entregas:[],fisicos:[],
     pulseiras:[{numero:'31',slot:1,conflito:true,voo_em:null,qr:null}],entregue_em:null},
    {id:'TPUL00000BD',tipo:'drone',criado:HOJE+'T09:30:00',cliente:'Cliente Três',foto:false,itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,entregas:[],fisicos:[],
     pulseiras:[{numero:'31',slot:1,conflito:true,voo_em:null,qr:null}],entregue_em:null}]};
  const posts=[];
  await ctx.route(/\/ativ\/fila\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J(D)}));
  await ctx.route(/\/ativ\/etapa$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);const v=D.vendas.find(x=>x.id===c.id);const p=v.pulseiras.find(x=>x.numero===c.pulseira);
    if(c.etapa==='voo'&&p)Object.assign(p,{voo_em:HOJE+'T10:30:00',piloto:c.piloto,drone:c.drone,bateria:c.bateria});r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
  await ctx.route(/\/ativ\/video$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rascunho:'0123456789abcdef',bytes:300000,duracao:30})}));
  await ctx.route(/\/ativ\/video\/liga$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);const v=D.vendas.find(x=>x.id===c.venda);
    v.entregas.push({qr:c.qr,codigo:'WXYZ-2345-6789',n:1,bytes:300000,duracao:30,nuvem:true,pagina:{ok:true},subindo:null,em:HOJE+'T10:41:00',pulseira:c.pulseira,cliente:{}});v.pulseiras.find(x=>x.numero===c.pulseira).qr=c.qr;
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,qr:c.qr,codigo:'WXYZ-2345-6789',n:1})});});
  const P=await ctx.newPage();P.on('pageerror',e=>errs.push(e.message));await P.goto(U);await P.waitForTimeout(500);if(await P.$('[data-act="login-usuario"]'))await E(P,adm);
  await P.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;ETERNA.go('ativ-entrega');});await P.waitForTimeout(600);
  P.setDefaultTimeout(3000);const txt=async s=>(await P.textContent(s))||'';
  ok(await P.$('#ae-pul')&&await P.evaluate(()=>document.activeElement.id)==='ae-pul-txt','começa pela pulseira, com o campo pronto para o leitor');
  ok(await P.$('.ae-board')===null&&await P.$('#ae-drop')===null,'sem a fila completa nem escolher venda na tela inicial');
  ok(/Cliente Um/.test(await txt('#ae-agora'))&&/Pulseira 777 · voando desde 10:20/.test(await txt('#ae-agora')),'faixa Agora com quem está voando: '+await txt('#ae-agora'));
  await P.keyboard.type('0999');await P.keyboard.press('Enter');await P.waitForTimeout(300);
  ok(/Nenhuma venda com a pulseira 999/.test(await txt('#ae-pul-err')),'pulseira sem venda: '+await txt('#ae-pul'));
  await P.fill('#ae-pul-txt','31');await P.press('#ae-pul-txt','Enter');await P.waitForTimeout(200);
  ok(/aparece em duas vendas/.test(await txt('#ae-pul'))&&(await P.$$('[data-act="ae-pul-opc"]')).length===2,'número em duas vendas: escolher pelo rosto');
  await P.fill('#ae-pul-txt','00123');await P.press('#ae-pul-txt','Enter');await P.waitForTimeout(200);
  ok(await P.$('#ae-at[data-ae-at="123"]')&&/Cliente Um/.test(await txt('#ae-at'))&&/Pulseira 123 · vídeo 1 de 2/.test(await txt('#ae-at')),'atendimento aberto pela pulseira: '+await txt('#ae-at'));
  ok(await P.$('[data-act="ae-nv-venda"]')===null,'sem "para qual venda é este vídeo"');
  await P.click('[data-act="ae-at-voo"]');await P.waitForTimeout(100);ok(!posts.length,'Decolar sem piloto não vai');
  await P.selectOption('#ae-at-voo [data-ae-voo="piloto"]','Piloto Um');await P.selectOption('#ae-at-voo [data-ae-voo="drone"]','007');await P.selectOption('#ae-at-voo [data-ae-voo="bateria"]','3');
  await P.evaluate(()=>{document.activeElement&&document.activeElement.blur();ETERNA.render();});await P.waitForTimeout(100);
  ok(await P.$eval('#ae-at-voo [data-ae-voo="bateria"]',x=>x.value)==='3','a atualização da tela não apaga piloto, drone e bateria escolhidos');
  await P.click('[data-act="ae-at-voo"]');await P.waitForTimeout(400);
  ok(J(posts[0])===J({id:'TPUL00001D',etapa:'voo',piloto:'Piloto Um',drone:'007',bateria:'3',pulseira:'123'})&&/Voo às 10:30/.test(await txt('#ae-at')),'Decolar grava o voo na pulseira: '+J(posts[0]));
  await P.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(300000)],'DJI_0002.MP4',{type:'video/mp4'}));
    document.getElementById('ae-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});await P.waitForTimeout(600);
  ok(await P.$('#ae-at video')&&/Vídeo no servidor · 30 s/.test(await txt('#ae-at')),'vídeo solto no atendimento: '+await txt('#ae-at'));
  D.rascunhos={'0123456789abcdef':{feito:false,total:300000,enviado:150000}};await P.evaluate(()=>ETERNA.aePull());await P.waitForTimeout(200);
  ok(/Enviando à nuvem 50%/.test(await txt('#ae-rasc-nuvem')),'subida para a nuvem já começa: '+await txt('#ae-rasc-nuvem'));
  D.rascunhos={'0123456789abcdef':{feito:true,total:300000,enviado:300000}};await P.evaluate(()=>ETERNA.aePull());await P.waitForTimeout(200);
  ok(/Já na nuvem/.test(await txt('#ae-rasc-nuvem')),'vídeo já na nuvem antes do cartão');
  ok(await P.$('[data-act="ae-nv-liga"][disabled]'),'sem cartão não entrega');
  await P.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRN);await P.press('[data-act="ae-qr-txt"]','Enter');await P.waitForTimeout(100);
  await P.click('[data-act="ae-nv-liga"]');await P.waitForTimeout(500);
  ok(J(posts.slice(-1)[0])===J({rascunho:'0123456789abcdef',venda:'TPUL00001D',qr:QRN,pulseira:'123'}),'entrega com a pulseira: '+J(posts.slice(-1)));
  ok(/Vídeo entregue/.test(await txt('#ae-at'))&&/WXYZ-2345-6789/.test(await txt('#ae-at'))&&/Na nuvem/.test(await txt('#ae-at')),'atendimento mostra o vídeo entregue e na nuvem: '+await txt('#ae-at'));
  await P.click('#ae-at button.primary[data-act="ae-at-fecha"]');await P.waitForTimeout(200);
  ok(await P.$('#ae-at')===null&&await P.$('#ae-pul'),'Próximo cliente volta para a leitura da pulseira');
  await P.click('#ae-agora [data-act="ae-at-abre"][data-n="777"]');await P.waitForTimeout(200);
  ok(await P.$('#ae-at[data-ae-at="777"]')&&/Voo às 10:20/.test(await txt('#ae-at')),'tocar na faixa Agora abre o atendimento');
  await P.click('#ae-at [data-act="ae-at-fecha"]');await P.click('[data-act="ae-fila"]');await P.waitForTimeout(200);
  ok(await P.$('.ae-board')&&await P.$('#ae-drop'),'fila completa (e o fluxo de venda sem pulseira) recolhida num botão');
  // idioma
  await P.evaluate(()=>{ETERNA.state.ae.fila=false;ETERNA.setLangEq&&ETERNA.setLangEq('en');});
}catch(e){fails.push('erro: '+e.message+' '+(e.stack.match(/pulseira\.js:\d+/)||[''])[0]);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('OK pulseira: tablet com uma pulseira por vídeo (leitor, repetida, já usada), entrega que começa pela pulseira, voo na pulseira, nuvem antes do cartão, próximo cliente, faixa Agora');})();
