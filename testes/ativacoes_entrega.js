// v100 (fase 4): tela Entrega dos vídeos. Fila do dia por serviço, Cliente chegou, Voo feito com piloto/drone/bateria do
// cadastro. Fluxo do computador: o vídeo solto na tela sobe na hora, a pessoa confere, escolhe a venda do dia (lixeira cancela),
// marca o voo se faltar, lê o cartão (sem câmera: leitor ou link colado; cartão já usado é recusado) e entrega. Baixa da
// medalha, cadastro de pilotos, permissão (só Ver não mostra o fluxo) e idioma.
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
     entregas:[{qr:QRV,codigo:'ABCD-EFGH',n:1,bytes:2097152,duracao:20,nuvem:false,subindo:null}],fisicos:[{i:0,nome:'Medalha',entregue:false}],entregue_em:null},
    {id:'TDRONE002D',tipo:'drone',criado:HOJE+'T10:15:00',itens:[{produto:'boomerang',op:'Campo',qtd:1,pessoas:3,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null},
    {id:'TSNAP0001S',tipo:'snap',criado:HOJE+'T10:20:00',itens:[{produto:'snap_video',op:'Brasil',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Vendedora Um',videos:1,entregas:[],fisicos:[],entregue_em:null}]};
  const posts=[];let video=null;
  await ctx.route(/\/ativ\/fila\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J(D)}));
  await ctx.route(/\/ativ\/etapa$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);const v=D.vendas.find(x=>x.id===c.id);
    if(c.etapa==='recebido')v.recebido_em=HOJE+'T10:20:00';if(c.etapa==='voo')Object.assign(v,{voo_em:HOJE+'T10:30:00',piloto:c.piloto,drone:c.drone,bateria:c.bateria});
    if(c.etapa==='item'){v.fisicos[c.i].entregue=true;v.entregue_em=HOJE+'T11:00:00';}r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
  await ctx.route(/\/ativ\/cadastros$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);D.cadastros[c.tipo].push({nome:c.nome,ativo:true});r.fulfill({status:200,contentType:'application/json',body:J({ok:true,cadastros:D.cadastros})});});
  await ctx.route(/\/ativ\/video$/,r=>{video={n:(r.request().postDataBuffer()||Buffer.alloc(0)).length,xe:r.request().headers()['x-eterna']};
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rascunho:'0123456789abcdef',bytes:video.n,duracao:30})});});
  await ctx.route(/\/ativ\/video\/liga$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);const v=D.vendas.find(x=>x.id===c.venda);
    v.entregas.push({qr:c.qr,codigo:'WXYZ-2345',n:1,bytes:300000,duracao:30,nuvem:false,subindo:null});v.entregue_em=HOJE+'T10:40:00';
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,qr:c.qr,codigo:'WXYZ-2345',n:1})});});
  await ctx.route(/\/ativ\/cancelar$/,r=>{const c=JSON.parse(r.request().postData());posts.push(c);D.vendas=D.vendas.filter(x=>x.id!==c.id);r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);await E(A,adm);
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;s.ae.fila=true;ETERNA.go('ativ-entrega');});await A.waitForTimeout(600);
  const txt=async s=>(await A.textContent(s))||'';
  ok(/Entrega dos vídeos/.test(await txt('#main .head'))&&/Vídeos na fila da nuvem: 1/.test(await txt('#main .head')),'título e situação da nuvem: '+await txt('#main .head'));
  ok(/Drone · 2/.test(await txt('#main'))&&/Chute a Gol · 1/.test(await txt('#main'))&&/Snap Pop · 1/.test(await txt('#main')),'pendentes por serviço');
  const card='[data-ae-venda="TDRONE001D"]';
  // v99.23.6: arquivo no S3 mas página recusada pela nuvem: erro em vermelho no cartão e no topo, nunca "Na nuvem"
  Object.assign(D.vendas[1].entregas[0],{nuvem:true,pagina:{ok:false,erro:'HTTP Error 400: Bad Request',tentativas:4}});await A.evaluate(async()=>{await ETERNA.aePull();ETERNA.render();});
  await A.click('[data-act="ae-cat"][data-c="chute"]');await A.waitForTimeout(100);
  ok(/A nuvem recusou a página do cliente \(4 tentativas\)/.test(await txt('[data-ae-venda="TCHUTE001C"] [data-ae-pag="erro"]'))&&!/Na nuvem/.test(await txt('[data-ae-venda="TCHUTE001C"]')),'página recusada: erro no cartão, sem "Na nuvem"');
  ok(/1 vídeo sem página na nuvem: avise a TI/.test(await txt('[data-ae-pag-topo]')),'página recusada: aviso no topo');
  Object.assign(D.vendas[1].entregas[0],{nuvem:false,pagina:null});await A.evaluate(async()=>{await ETERNA.aePull();ETERNA.render();});
  await A.click('[data-act="ae-cat"][data-c="drone"]');await A.waitForTimeout(100);
  // uma fila por ativação, como a Fila de fotos: Próximo a voar, Voando, Entrega do vídeo, Entregue
  const cols=async()=>A.$$eval('[data-ae-col] h2',x=>x.map(h=>h.childNodes[0].textContent.trim()));
  ok(J(await cols())===J(['Próximo a voar','Voando','Entrega do vídeo','Entregue']),'colunas do Drone: '+J(await cols()));
  const naCol=async(id,c)=>!!(await A.$(`[data-ae-col="${c}"] [data-ae-venda="${id}"]`));
  ok(await naCol('TDRONE001D','proximo')&&/Asteroid · Campo · 2 pessoas/.test(await txt(card))&&await A.$(card+' [data-act="ae-recebido"]')===null,'drone em Próximo a voar, só com Decolar: '+await txt(card));
  await A.click(card+' [data-act="ae-voo"]');await A.waitForTimeout(100);
  ok((await A.$$('[data-ae-voo="bateria"] option')).length===2,'bateria inativa fora da lista');
  await A.click('[data-act="ae-voo-ok"]');await A.waitForTimeout(100);ok(posts.length===0,'voo sem piloto não vai');
  await A.selectOption('[data-ae-voo="piloto"]','Piloto Um');await A.selectOption('[data-ae-voo="drone"]','007');await A.selectOption('[data-ae-voo="bateria"]','3');
  await A.click('[data-act="ae-voo-ok"]');await A.waitForTimeout(300);
  ok(J(posts[0])===J({id:'TDRONE001D',etapa:'voo',piloto:'Piloto Um',drone:'007',bateria:'3'})&&/piloto Piloto Um · drone 007 · bateria 3/.test(await txt(card))&&await naCol('TDRONE001D','andamento'),'decolou: vai para Voando: '+J(posts[0]));
  ok(/Aguardando vídeo/.test(await txt(card)),'em Voando, espera o vídeo');
  // Snap Pop: Começar leva para Gravando
  await A.click('[data-act="ae-cat"][data-c="snap"]');await A.waitForTimeout(100);
  ok(J(await cols())===J(['Próximo a gravar','Gravando','Entrega do vídeo','Entregue'])&&await A.$('#ae-cad')===null,'colunas do Snap Pop, sem cadastro de drones');
  await A.click('[data-ae-venda="TSNAP0001S"] [data-act="ae-recebido"]');await A.waitForTimeout(300);
  ok(J(posts[1])===J({id:'TSNAP0001S',etapa:'recebido'})&&await naCol('TSNAP0001S','andamento'),'Começar: Snap Pop em Gravando');
  await A.click('[data-act="ae-cat"][data-c="drone"]');await A.waitForTimeout(100);
  // fluxo do computador: o vídeo solto na tela sobe na hora
  ok(await A.$('#ae-drop')!==null,'área para soltar o vídeo');
  await A.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(300000)],'DJI_0001.MP4',{type:'video/mp4'}));
    document.getElementById('ae-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});await A.waitForTimeout(800);
  ok(video&&video.n===300000&&video.xe==='1','vídeo sobe ao ser solto: '+J(video));
  ok(await A.$('#ae-nv video')!==null&&/Vídeo no servidor · 30 s/.test(await txt('#ae-nv')),'vídeo para conferir, já no servidor: '+await txt('#ae-nv'));
  ok(await A.$('[data-act="ae-nv-liga"][disabled]')!==null,'sem venda e cartão não entrega');
  ok(J(await A.$$eval('[data-act="ae-nv-venda"]',x=>x.map(b=>b.dataset.id)))===J(['TDRONE001D','TSNAP0001S','TDRONE002D']),'vendas do dia que esperam vídeo, de todos os serviços (as que já voaram ou começaram primeiro)');
  // lixeira
  await A.click('[data-act="ae-nv-lixo"][data-id="TSNAP0001S"]');await A.click('[data-act="ae-nv-lixo-ok"]');await A.waitForTimeout(100);
  ok(!posts.some(p=>p.motivo!==undefined),'cancelar pede motivo');
  await A.fill('[data-ae-cmotivo]','cliente desistiu');await A.click('[data-act="ae-nv-lixo-ok"]');await A.waitForTimeout(300);
  ok(J(posts.slice(-1)[0])===J({id:'TSNAP0001S',motivo:'cliente desistiu'})&&await A.$('[data-act="ae-nv-venda"][data-id="TSNAP0001S"]')===null,'venda cancelada pela lixeira: '+J(posts));
  // drone sem voo marcado: piloto, drone e bateria antes de entregar
  await A.click('[data-act="ae-nv-venda"][data-id="TDRONE002D"]');await A.waitForTimeout(100);
  ok(await A.$('#ae-nv-voo [data-ae-voo="piloto"]')!==null,'drone sem voo pede piloto, drone e bateria');
  await A.evaluate(()=>{delete window.BarcodeDetector;navigator.mediaDevices.getUserMedia=()=>Promise.reject(new Error('sem câmera'));});await A.click('[data-act="ae-cam"]');await A.waitForTimeout(800);
  ok(/não lê QR pela câmera/.test(await txt('#ae-nv')),'sem câmera: avisa e oferece o leitor');
  await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRV);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  ok(/já foi usado/.test(await txt('#ae-nv')),'cartão já usado recusado na hora: '+await txt('#ae-nv'));
  await A.fill('[data-act="ae-qr-txt"]','qualquer coisa');await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  ok(/Não é o QR de um cartão Eterna/.test(await txt('#ae-nv')),'texto que não é QR do cartão');
  await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRN);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(100);
  ok(/Cartão [A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/.test(await txt('#ae-nv')),'cartão lido, com o código impresso: '+await txt('#ae-nv'));
  const n0=posts.length;await A.click('[data-act="ae-nv-liga"]');await A.waitForTimeout(200);
  ok(posts.length===n0&&/Escolha piloto, drone e bateria/.test(await txt('#ae-nv')),'sem o voo não entrega');
  await A.selectOption('#ae-nv-voo [data-ae-voo="piloto"]','Piloto Um');await A.selectOption('#ae-nv-voo [data-ae-voo="drone"]','007');await A.selectOption('#ae-nv-voo [data-ae-voo="bateria"]','3');
  await A.click('[data-act="ae-nv-liga"]');await A.waitForTimeout(500);
  ok(J(posts.slice(-2))===J([{id:'TDRONE002D',etapa:'voo',piloto:'Piloto Um',drone:'007',bateria:'3'},{rascunho:'0123456789abcdef',venda:'TDRONE002D',qr:QRN}]),'voo e depois o vídeo ligado à venda e ao cartão: '+J(posts.slice(-2)));
  ok(await A.$('#ae-nv')===null&&await A.$('#ae-drop')!==null,'entregue: a tela volta para soltar o próximo vídeo');
  ok(await naCol('TDRONE002D','entregue')&&/Entregue às/.test(await txt('[data-ae-venda="TDRONE002D"]'))&&/WXYZ-2345/.test(await txt('[data-ae-venda="TDRONE002D"]')),'drone entregue, com o cartão: '+await txt('#main'));
  // chute: medalha
  await A.click('[data-act="ae-cat"][data-c="chute"]');await A.waitForTimeout(100);
  const cc='[data-ae-venda="TCHUTE001C"]';
  ok(/ABCD-EFGH/.test(await txt(cc))&&/Na fila da nuvem/.test(await txt(cc))&&await naCol('TCHUTE001C','delivery'),'chute com vídeo na fila da nuvem e medalha pendente: '+await txt(cc));
  await A.check(cc+' [data-act="ae-item"]');await A.waitForTimeout(400);
  ok(J(posts.slice(-1)[0])===J({id:'TCHUTE001C',etapa:'item',i:0})&&await naCol('TCHUTE001C','entregue'),'baixa da medalha: vai para Entregue: '+J(posts));
  await A.click('[data-act="ae-cat"][data-c="drone"]');await A.waitForTimeout(100);
  // cadastro
  await A.click('[data-act="ae-cad"]');await A.fill('[data-ae-novo="piloto"]','Piloto Dois');await A.click('[data-act="ae-cad-add"][data-t="piloto"]');for(let i=0;i<30&&!/Piloto Dois/.test(await txt('#ae-cad'));i++)await A.waitForTimeout(100);
  ok(J(posts.slice(-1)[0])===J({tipo:'piloto',nome:'Piloto Dois',ativo:true})&&/Piloto Dois/.test(await txt('#ae-cad')),'piloto cadastrado: '+J(posts.slice(-2))+' | '+(await txt('#ae-cad')).replace(/\s+/g,' ').slice(0,200));
  // só Ver: nenhum botão
  await A.evaluate(()=>{const u=ETERNA.state.user;u.perms={...u.perms,ativentrega:{c:false,r:true,u:false,d:false}};ETERNA.go('ativ-entrega');});await A.click('[data-act="ae-cat"][data-c="drone"]');await A.waitForTimeout(100);
  D.vendas[0].entregue_em=null;D.vendas[0].entregas=[];await A.evaluate(()=>ETERNA.aePull());await A.waitForTimeout(300);
  ok(await A.$('#ae-drop')===null&&await A.$('[data-act="ae-voo"]')===null&&await A.$('#ae-cad')===null,'só Ver: sem soltar vídeo, sem botões nem cadastro');
  await A.evaluate(()=>ETERNA.idiomaEquipe('en'));await A.waitForTimeout(200);
  ok(/Video delivery/.test(await txt('#main'))&&/Waiting for the video/.test(await txt('#main')),'tela em inglês');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ativacoes_entrega: '+fails.join(' || '));process.exit(1);}
console.log('OK ativacoes_entrega: fila por serviço, cliente chegou, voo com cadastro, vídeo solto sobe na hora, vendas do dia com lixeira, voo antes de entregar, cartão por leitor (usado recusado), medalha, cadastro, permissão e idioma');process.exit(0);
})();
