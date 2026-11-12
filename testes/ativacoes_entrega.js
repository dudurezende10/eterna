// v100 (fase 4): tela Entrega dos vídeos. Fila do dia por serviço, Cliente chegou, Voo feito com piloto/drone/bateria do
// cadastro, cartão com QR (sem câmera: leitor ou link colado; cartão já usado é recusado na hora), vídeo enviado com o QR e a
// venda, baixa da medalha, cadastro de pilotos, permissão (só Ver não mostra botão) e idioma.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:800,height:1200}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const HOJE=new Date().toISOString().slice(0,10);
  const QRV='Q'.repeat(21)+'1',QRN='N'.repeat(21)+'2';
  const D={ok:true,nuvem:{ligada:true,fila:1},cadastros:{piloto:[{nome:'Piloto Um',ativo:true}],drone:[{nome:'007',ativo:true}],bateria:[{nome:'3',ativo:true},{nome:'4',ativo:false}]},vendas:[
    {id:'TDRONE001D',tipo:'drone',criado:HOJE+'T10:05:00',itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:2,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null},
    {id:'TCHUTE001C',tipo:'chute',criado:HOJE+'T10:10:00',itens:[{produto:'c5mv',op:'',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,
     entregas:[{qr:QRV,codigo:'ABCD-EFGH',n:1,bytes:2097152,duracao:20,nuvem:false,subindo:null}],fisicos:[{i:0,nome:'Medalha',entregue:false}],entregue_em:null}]};
  const posts=[];let video=null;
  await ctx.route(/\/ativ\/fila\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J(D)}));
  await ctx.route(/\/ativ\/etapa$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);const v=D.vendas.find(x=>x.id===c.id);
    if(c.etapa==='recebido')v.recebido_em=HOJE+'T10:20:00';if(c.etapa==='voo')Object.assign(v,{voo_em:HOJE+'T10:30:00',piloto:c.piloto,drone:c.drone,bateria:c.bateria});
    if(c.etapa==='item'){v.fisicos[c.i].entregue=true;v.entregue_em=HOJE+'T11:00:00';}r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
  await ctx.route(/\/ativ\/cadastros$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);D.cadastros[c.tipo].push({nome:c.nome,ativo:true});r.fulfill({status:200,contentType:'application/json',body:J({ok:true,cadastros:D.cadastros})});});
  await ctx.route(/\/ativ\/video\?/,r=>{const u=new URL(r.request().url());video={venda:u.searchParams.get('venda'),qr:u.searchParams.get('qr'),n:(r.request().postDataBuffer()||Buffer.alloc(0)).length,xe:r.request().headers()['x-eterna']};
    const v=D.vendas.find(x=>x.id===video.venda);v.entregas.push({qr:video.qr,codigo:'WXYZ-2345',n:1,bytes:video.n,duracao:30,nuvem:false,subindo:null});v.entregue_em=HOJE+'T10:40:00';
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,qr:video.qr,codigo:'WXYZ-2345',n:1})});});
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;ETERNA.go('ativ-entrega');});await A.waitForTimeout(600);
  const txt=async s=>(await A.textContent(s))||'';
  ok(/Entrega dos vídeos/.test(await txt('#main .head'))&&/Vídeos aguardando internet: 1/.test(await txt('#main .head')),'título e situação da nuvem: '+await txt('#main .head'));
  ok(/Drone · 1/.test(await txt('#main'))&&/Chute a Gol · 1/.test(await txt('#main')),'pendentes por serviço');
  const card='[data-ae-venda="TDRONE001D"]';
  ok(/Aguardando o cliente/.test(await txt(card))&&/Asteroid · Campo · 2 pessoas/.test(await txt(card))&&await A.$(card+' [data-act="ae-entregar"]')===null,'drone antes do voo, sem botão de entregar: '+await txt(card));
  await A.click(card+' [data-act="ae-recebido"]');await A.waitForTimeout(300);
  ok(posts[0]&&posts[0].etapa==='recebido'&&/Aguardando voo/.test(await txt(card)),'cliente chegou: '+J(posts));
  await A.click(card+' [data-act="ae-voo"]');await A.waitForTimeout(100);
  ok((await A.$$('[data-ae-voo="bateria"] option')).length===2,'bateria inativa fora da lista');
  await A.click('[data-act="ae-voo-ok"]');await A.waitForTimeout(100);ok(posts.length===1,'voo sem piloto não vai');
  await A.selectOption('[data-ae-voo="piloto"]','Piloto Um');await A.selectOption('[data-ae-voo="drone"]','007');await A.selectOption('[data-ae-voo="bateria"]','3');
  await A.click('[data-act="ae-voo-ok"]');await A.waitForTimeout(300);
  ok(J(posts[1])===J({id:'TDRONE001D',etapa:'voo',piloto:'Piloto Um',drone:'007',bateria:'3'})&&/piloto Piloto Um · drone 007 · bateria 3/.test(await txt(card)),'voo feito: '+J(posts[1]));
  // entregar: sem câmera neste navegador, leitor ou link
  await A.click(card+' [data-act="ae-entregar"]');await A.waitForTimeout(100);
  await A.evaluate(()=>{delete window.BarcodeDetector;});await A.click('[data-act="ae-cam"]');await A.waitForTimeout(150);
  ok(/não lê QR pela câmera/.test(await txt('#ae-entrega')),'sem câmera: avisa e oferece o leitor');
  await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRV);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  ok(/já foi usado/.test(await txt('#ae-entrega')),'cartão já usado recusado na hora');
  await A.fill('[data-act="ae-qr-txt"]','qualquer coisa');await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  ok(/Não é o QR de um cartão Eterna/.test(await txt('#ae-entrega')),'texto que não é QR do cartão');
  await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRN);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  const cod=await A.evaluate(q=>ETERNA.cartaoCodigo?ETERNA.cartaoCodigo(q):null,QRN);
  ok(/Escolher o vídeo/.test(await txt('#ae-entrega')),'cartão lido: passo do vídeo');
  await A.setInputFiles('[data-act="ae-arquivo"]',{name:'DJI_0001.MP4',mimeType:'video/mp4',buffer:Buffer.alloc(300000,1)});await A.waitForTimeout(800);
  ok(video&&video.venda==='TDRONE001D'&&video.qr===QRN&&video.n===300000&&video.xe==='1','vídeo enviado com a venda e o QR: '+J(video));
  await A.click('[data-act="ae-ver"][data-v="entregues"]');await A.waitForTimeout(100);
  ok(/Entregue/.test(await txt(card))&&/WXYZ-2345/.test(await txt(card)),'drone entregue, com o cartão: '+await txt('#main'));
  // chute: medalha
  await A.click('[data-act="ae-ver"][data-v="pendentes"]');await A.click('[data-act="ae-cat"][data-c="chute"]');await A.waitForTimeout(100);
  const cc='[data-ae-venda="TCHUTE001C"]';
  ok(/ABCD-EFGH/.test(await txt(cc))&&/Aguardando internet/.test(await txt(cc))&&/Entrega pendente/.test(await txt(cc)),'chute com vídeo na fila da nuvem e medalha pendente: '+await txt(cc));
  await A.check(cc+' [data-act="ae-item"]');await A.waitForTimeout(400);
  ok(J(posts.slice(-1)[0])===J({id:'TCHUTE001C',etapa:'item',i:0}),'baixa da medalha: '+J(posts));
  // cadastro
  await A.click('[data-act="ae-cad"]');await A.fill('[data-ae-novo="piloto"]','Piloto Dois');await A.click('[data-act="ae-cad-add"][data-t="piloto"]');await A.waitForTimeout(300);
  ok(J(posts.slice(-1)[0])===J({tipo:'piloto',nome:'Piloto Dois',ativo:true})&&/Piloto Dois/.test(await txt('#ae-cad')),'piloto cadastrado');
  // só Ver: nenhum botão
  await A.evaluate(()=>{const u=ETERNA.state.user;u.perms={...u.perms,ativentrega:{c:false,r:true,u:false,d:false}};ETERNA.go('ativ-entrega');});await A.click('[data-act="ae-cat"][data-c="drone"]');await A.waitForTimeout(100);
  D.vendas[0].entregue_em=null;D.vendas[0].entregas=[];await A.evaluate(()=>ETERNA.aePull());await A.waitForTimeout(300);
  ok(await A.$('[data-act="ae-entregar"]')===null&&await A.$('#ae-cad')===null,'só Ver: sem botões nem cadastro');
  await A.evaluate(()=>ETERNA.idiomaEquipe('en'));await A.waitForTimeout(200);
  ok(/Video delivery/.test(await txt('#main'))&&/Waiting for the video/.test(await txt('#main')),'tela em inglês');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes_entrega: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes_entrega: fila por serviço, cliente chegou, voo com cadastro, cartão por leitor (usado recusado), vídeo enviado, medalha, cadastro, permissão e idioma');process.exit(0);
})();
