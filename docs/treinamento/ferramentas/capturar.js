// Prints do treinamento "Da venda à entrega" (Drone, Chute a Gol e Snap Pop). Telas de verdade do app, com o servidor
// respondido aqui no navegador (dados fictícios): nada é gravado em servidor nenhum.
//   NODE_PATH=<node_modules com playwright> U=http://127.0.0.1:8894/index.html VIDEO=<um mp4 de exemplo> FOTOS=<0.jpg a 4.jpg e silhueta.jpg> CAMERA=<silhueta .mjpeg> node capturar.js <pasta de saída>
// Para cada print grava <chave>.png e, em marcas.json, as caixas (em px da imagem) dos alvos de cada passo e o recorte.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8894/index.html';const OUT=process.argv[2]||'prints-brutos';const VIDEO=process.env.VIDEO;
const J=JSON.stringify;
const E=require(path.join(__dirname,'..','..','..','testes','_entrar'));
const HOJE=new Date().toISOString().slice(0,10);
const mp4=VIDEO?fs.readFileSync(VIDEO):Buffer.alloc(0);
// fotos do Tour fictícias (FOTOS=<pasta com 0.jpg a 4.jpg>), no lugar de fotos de clientes
const FOTOS=[0,1,2,3,4].map(i=>process.env.FOTOS?fs.readFileSync(path.join(process.env.FOTOS,i+'.jpg')):Buffer.alloc(0));

const P=require('./print_tela')(OUT);const {usuario,shot}=P;
const CAM=process.env.CAMERA; // CAMERA=<.mjpeg com uma silhueta>: a câmera da entrega mostra a silhueta, nunca um rosto de verdade

(async()=>{const b=await chromium.launch({channel:process.env.CANAL||'chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',...(CAM?['--use-file-for-fake-video-capture='+CAM]:[])]}); // Chrome de verdade: o Chromium dos testes não toca MP4 (H.264)
try{
  // ---------------- VENDA (tablet) ----------------
  {const ctx=await b.newContext({viewport:{width:800,height:1280},deviceScaleFactor:1.5,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const enviadas=[];
    await ctx.route(/\/ativ\/venda$/,r=>{const j=JSON.parse(r.request().postData());j.vendas.forEach(v=>enviadas.push(v));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,recebidas:j.vendas.map(v=>v.id),recusadas:[]})});});
    await ctx.route(/\/ativ\/minhas\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,todos:true,vendas:enviadas.map(v=>({...v,pulseiras:(v.pulseiras||[]).map((p,k)=>({numero:String(p&&p.n||p),slot:k+1})),origem:'eterna',situacao:'ativa',cliente_foto:undefined}))})}));
    await ctx.route(/\/ativ\/cancelar$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true})}));
    await ctx.route(/\/ativ\/demo\/lista$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,videos:[]})}));
    const A=await ctx.newPage();await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('eterna-ativ');});await A.reload();await A.waitForTimeout(400);
    const VEND='ana.souza';await usuario(A,VEND,'Ana Souza',{ativvenda:{c:true,r:true,u:false,d:false}});
    await A.fill('[data-act="login-usuario"]',VEND);await A.fill('[data-act="login-senha"]','••••••••');
    await shot(A,'v01-entrar',[['[data-act="login-usuario"]','direita','1'],['[data-act="login-senha"]','direita','2'],['button[type=submit]','direita','3']],'button[type=submit]',230);
    await E(A,VEND);await A.waitForTimeout(300);
    await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;});
    if(await A.evaluate(()=>ETERNA.state.view)!=='ativ-venda'){const m=await A.$('[data-v="ativ-venda"]');if(m){await shot(A,'v02-menu',[['[data-v="ativ-venda"]','direita','1']],'[data-v="ativ-venda"]',200);await A.click('[data-v="ativ-venda"]');}else await A.evaluate(()=>ETERNA.go('ativ-venda'));}
    await A.waitForTimeout(400);
    await shot(A,'v03-servico',[['[data-act="av-cat"][data-c="drone"]','baixo','1'],['[data-act="av-pessoas"][data-v="2"]','baixo','2']],'#av-prod');
    await A.click('[data-act="av-pessoas"][data-v="2"]');await A.waitForTimeout(150);
    await shot(A,'v04-produto',[['[data-av-card="asteroid"] [data-act="av-local"]','direita','1'],['[data-av-card="asteroid"] [data-act="av-k4"]','baixo','2'],['[data-av-card="asteroid"] [data-act="av-demo"]','esquerda','3'],['[data-av-card="asteroid"] [data-act="av-add"]','baixo','4']],'[data-av-card="asteroid"]',40);
    await A.click('[data-av-card="asteroid"] [data-act="av-add"]');await A.waitForTimeout(150);
    await A.click('[data-act="av-cat"][data-c="chute"]');await A.waitForTimeout(150);await A.click('[data-act="av-pessoas"][data-v="1"]').catch(()=>{});
    await shot(A,'v05-chute',[['[data-act="av-sub"][data-v="c3"]','baixo','1'],['[data-act="av-sub"][data-v="prod"]','baixo','2']],'#av-prod');
    await A.click('[data-act="av-add"][data-id="c3"]');await A.waitForTimeout(150);
    await A.click('[data-act="av-sub"][data-v="prod"]');await A.waitForTimeout(100);
    await A.click('[data-act="av-add"][data-id="medalha"]').catch(()=>{});await A.waitForTimeout(150);
    await A.click('[data-act="av-cat"][data-c="snap"]');await A.waitForTimeout(150);
    await shot(A,'v06-snap',[['[data-act="av-cat"][data-c="snap"]','baixo','1']],'#av-prod');
    await A.click('[data-act="av-cat"][data-c="drone"]');await A.waitForTimeout(150);
    await A.fill('#av-ing','1123K7PM2QXA');await A.fill('[data-act="av-nome"]','Mariana Costa');
    await A.selectOption('[data-act="av-pais"]','Brasil').catch(()=>{});await A.selectOption('[data-act="av-idioma"]','Português').catch(()=>{});await A.waitForTimeout(150);
    await shot(A,'v07-cliente',[['#av-ing','baixo','1'],['[data-act="av-ing-cam"]','baixo','2'],['[data-act="av-nome"]','baixo','3'],['[data-act="av-pais"]','cima','4'],['[data-act="av-idioma"]','cima','5']],'#av-cliente');
    await A.click('[data-act="av-pag"][data-p="PIX"]');await A.waitForTimeout(150);
    await A.fill('[data-act="av-pul"][data-i="0"][data-k="0"]','1042');await A.press('[data-act="av-pul"][data-i="0"][data-k="0"]','Enter');await A.waitForTimeout(100);
    await shot(A,'v09-pulseira',[['[data-act="av-pul"][data-i="0"][data-k="0"]','baixo','1'],['[data-act="av-pul-cam"][data-i="0"][data-k="0"]','esquerda','2']],'#av-cart');
    {const ps=await A.$$('[data-act="av-pul"]');for(let k=1;k<ps.length;k++){await ps[k].fill(String(1042+k));await ps[k].press('Enter');await A.waitForTimeout(80);}}
    await shot(A,'v09-resumo',[['[data-av-linha="0"]','esquerda','1'],['[data-act="av-tirar"][data-i="0"]','esquerda','2'],['#av-total','esquerda','3']],'#av-cart');
    await shot(A,'v10-pagamento',[['[data-act="av-pag"][data-p="PIX"]','baixo','1'],['[data-act="av-registrar"]','cima','2']],'#av-pag');
    await A.click('[data-act="av-registrar"]');await A.waitForTimeout(500);
    await shot(A,'v11-registrada',[['#toast','cima','1']],'#toast',260);
    await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(800);
    await shot(A,'v12-minhas',[['[data-act="av-aba"][data-v="minhas"]','baixo','1'],['#av-minhas-q','cima','2'],['table.av-tab','baixo','3']],'#av-minhas, #main');
    // cancelar: só o supervisor
    const SUP='paula.reis';await A.evaluate(()=>ETERNA.logout());await A.waitForTimeout(300);await usuario(A,SUP,'Paula Reis',{ativvenda:{c:true,r:true,u:true,d:true}});await E(A,SUP);await A.waitForTimeout(300);
    await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;ETERNA.go('ativ-venda');});await A.waitForTimeout(400);
    await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(800);
    await shot(A,'v13-cancelar',[['[data-act="av-cancelar"]','esquerda','1']],'#av-minhas');
    await A.click('[data-act="av-cancelar"]');await A.waitForTimeout(1500);await A.fill('[data-act="av-cmotivo"]','Cliente desistiu antes do voo');
    await shot(A,'v14-motivo',[['[data-act="av-cmotivo"]','baixo','1'],['[data-act="av-cancel-ok"]','baixo','2']],'#av-minhas');
    await A.click('[data-act="av-cancel-ok"]');await A.waitForTimeout(400);
    await shot(A,'v15-cancelada',[['#toast','cima','1']],'#av-minhas');
    await ctx.close();}

  // ---------------- ENTREGA (computador do campo) ----------------
  {const ctx=await b.newContext({viewport:{width:1100,height:860},deviceScaleFactor:1.5,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const QRN='N'.repeat(21)+'2';
    const D={ok:true,nuvem:{ligada:true,fila:0},cadastros:{piloto:[{nome:'Carlos',ativo:true},{nome:'Rafaela',ativo:true}],drone:['006','007','141','228'].map(n=>({nome:n,ativo:true})),bateria:Array.from({length:8},(_,i)=>({nome:String(i+1),ativo:true}))},vendas:[
      {id:'TDRONE001D',tipo:'drone',criado:HOJE+'T10:05:00',itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:2,videos:1,k4:true}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null,cliente:'Mariana Costa'},
      {id:'TDRONE002D',tipo:'drone',criado:HOJE+'T10:15:00',itens:[{produto:'boomerang',op:'Arquibancada',qtd:1,pessoas:3,videos:1}],pagamento:'Crédito',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null,cliente:'Paulo Mendes'},
      {id:'TDRONE003D',tipo:'drone',criado:HOJE+'T09:40:00',itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,
       entregas:[{qr:'K'.repeat(21)+'3',codigo:'KP7M-3QXA-H2RT',n:1,bytes:3135031,duracao:28,nuvem:true,subindo:null,cliente:{aberto:HOJE+'T10:01:00',aceite:HOJE+'T10:01:30',play:HOJE+'T10:02:00',baixou:HOJE+'T10:03:00',baixou_n:1}}],fisicos:[],voo_em:HOJE+'T09:50:00',piloto:'Carlos',drone:'007',bateria:'2',entregue_em:HOJE+'T09:58:00',cliente:'Joana Ribeiro'},
      {id:'TCHUTE001C',tipo:'chute',criado:HOJE+'T10:10:00',itens:[{produto:'c3',op:'',qtd:1,pessoas:1,videos:1},{produto:'medalha',op:'',qtd:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,
       entregas:[{qr:'Q'.repeat(21)+'1',codigo:'ABCD-EFGH-JKLM',n:1,bytes:2097152,duracao:20,nuvem:true,subindo:null}],fisicos:[{i:1,nome:'Medalha',entregue:false}],entregue_em:null,cliente:'Mariana Costa'},
      {id:'TSNAP0001S',tipo:'snap',criado:HOJE+'T10:20:00',itens:[{produto:'snap_video',op:'Brasil',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],entregue_em:null,cliente:'Lucas Pereira'}]};
    // v99.25: uma pulseira por vídeo
    const PU=(numero,x)=>({numero,slot:1,conflito:false,voo_em:null,qr:null,...(x||{})});
    D.rascunhos={};D.vendas[0].pulseiras=[PU('1042')];D.vendas[1].pulseiras=[PU('1050',{voo_em:HOJE+'T10:24:00',piloto:'Rafaela',drone:'141',bateria:'5'})];
    D.vendas[2].pulseiras=[PU('1031',{qr:'K'.repeat(21)+'3'})];D.vendas[3].pulseiras=[PU('1043',{qr:'Q'.repeat(21)+'1'})];D.vendas[4].pulseiras=[PU('1060')];
    await ctx.route(/\/ativ\/fila\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J(D)}));
    await ctx.route(/\/ativ\/etapa$/,r=>{const c=JSON.parse(r.request().postData());const v=D.vendas.find(x=>x.id===c.id);
      if(c.etapa==='recebido')v.recebido_em=HOJE+'T10:22:00';if(c.etapa==='voo')Object.assign(v.pulseiras.find(p=>p.numero===c.pulseira)||v,{voo_em:HOJE+'T10:30:00',piloto:c.piloto,drone:c.drone,bateria:c.bateria});
      if(c.etapa==='item'){v.fisicos[0].entregue=true;v.entregue_em=HOJE+'T10:45:00';}r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
    await ctx.route(/\/ativ\/video$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rascunho:'0123456789abcdef',bytes:mp4.length,duracao:28})}));
    await ctx.route(/\/ativ\/video\/liga$/,r=>{const c=JSON.parse(r.request().postData());const v=D.vendas.find(x=>x.id===c.venda);
      v.entregas.push({qr:c.qr,codigo:'WXYZ-2345-6789',n:1,bytes:mp4.length,duracao:28,nuvem:true,pagina:{ok:true},subindo:null,em:HOJE+'T10:40:00',pulseira:c.pulseira,cliente:{}});v.entregue_em=HOJE+'T10:40:00';
      const pp=v.pulseiras.find(p=>p.numero===c.pulseira);if(pp)pp.qr=c.qr;
      r.fulfill({status:200,contentType:'application/json',body:J({ok:true,qr:c.qr,codigo:'WXYZ-2345-6789',n:1})});});
    const SIL=fs.readFileSync(path.join(process.env.FOTOS||'.','silhueta.jpg'));
    await ctx.route(/\/ativ\/cliente-foto/,r=>{if(r.request().method()==='POST'){const c=JSON.parse(r.request().postData());const v=D.vendas.find(x=>x.id===c.id);if(v)v.foto=true;return r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});}
      r.fulfill({status:200,contentType:'image/jpeg',body:SIL});});
    await ctx.route(/\/ativ\/cancelar$/,r=>{const c=JSON.parse(r.request().postData());D.vendas=D.vendas.filter(x=>x.id!==c.id);r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
    await ctx.route(/\/exemplo\.mp4$/,r=>r.fulfill({status:200,contentType:'video/mp4',body:mp4}));
    const A=await ctx.newPage();await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
    const ENT='bruno.lima';await usuario(A,ENT,'Bruno Lima',{ativentrega:{c:true,r:true,u:true,d:false}});await E(A,ENT);
    await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;});
    if(await A.evaluate(()=>ETERNA.state.view)!=='ativ-entrega'){const m=await A.$('[data-v="ativ-entrega"]');if(m){await shot(A,'e01-menu',[['[data-v="ativ-entrega"]','direita','1']],'[data-v="ativ-entrega"]',200);await A.click('[data-v="ativ-entrega"]');}else await A.evaluate(()=>ETERNA.go('ativ-entrega'));}
    await A.waitForTimeout(800);
    const pul=async n=>{await A.fill('#ae-pul-txt',n);await A.press('#ae-pul-txt','Enter');await A.waitForTimeout(400);};
    await shot(A,'e02-pulseira',[['#ae-pul-txt','baixo','1'],['[data-act="ae-pul-cam"]','baixo','2'],['#ae-agora [data-act="ae-at-abre"]','cima','3']],'#ae-pul, #ae-agora');
    await pul('1042');
    await A.selectOption('#ae-at-voo [data-ae-voo="piloto"]','Carlos');await A.selectOption('#ae-at-voo [data-ae-voo="drone"]','007');await A.selectOption('#ae-at-voo [data-ae-voo="bateria"]','3');
    await shot(A,'e03-decolar',[['#ae-at .pill','baixo','1'],['#ae-at-voo [data-ae-voo="piloto"]','baixo','2'],['#ae-at-voo [data-ae-voo="bateria"]','baixo','3'],['[data-act="ae-at-voo"]','cima','4']],'#ae-at');
    await A.click('[data-act="ae-at-voo"]');await A.waitForTimeout(500);
    await shot(A,'e04-soltar',[['#ae-drop','cima','1']],'#ae-at');
    await A.evaluate(async()=>{const b=await (await fetch('/exemplo.mp4')).arrayBuffer();const dt=new DataTransfer();dt.items.add(new File([b],'DJI_0042.MP4',{type:'video/mp4'}));
      document.getElementById('ae-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
    await A.waitForTimeout(1200);D.rascunhos={'0123456789abcdef':{feito:true,total:mp4.length,enviado:mp4.length}};await A.evaluate(()=>ETERNA.aePull());await A.waitForTimeout(600);
    await A.evaluate(()=>{const v=document.querySelector('#ae-at video');if(v){v.currentTime=6;}});await A.waitForTimeout(800);
    await shot(A,'e05-conferir',[['#ae-at video','direita','1'],['#ae-rasc-nuvem','cima','2']],'#ae-at');
    await shot(A,'e06-cartao',[['[data-act="ae-cam"]','direita','1'],['[data-act="ae-qr-txt"]','direita','2']],'#ae-at');
    await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRN);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(200);
    await shot(A,'e06b-foto',[['[data-act="ae-fc-abre"]','cima','1']],'#ae-at');
    await A.click('[data-act="ae-fc-abre"]');await A.waitForTimeout(1800);
    await shot(A,'e06c-camera',[['[data-act="ae-fc-tira"]','baixo','2'],['#ae-fc-cam','direita','1']],'#ae-fc');
    await A.click('[data-act="ae-fc-tira"]');await A.waitForTimeout(800);await A.evaluate(()=>ETERNA.aePull());await A.waitForTimeout(600);
    await A.waitForSelector('[data-act="ae-nv-liga"]:not([disabled])',{timeout:15000});
    await shot(A,'e07-entregar',[['[data-act="ae-nv-liga"]','direita','1']],'#ae-at');
    await A.click('[data-act="ae-nv-liga"]');await A.waitForTimeout(900);
    await shot(A,'e08-entregue',[['#ae-at .pill.good','esquerda','1'],['#ae-at button.primary[data-act="ae-at-fecha"]','cima','2']],'#ae-at');
    await A.click('#ae-at button.primary[data-act="ae-at-fecha"]');await A.waitForTimeout(300);
    await pul('1043');
    await shot(A,'e10-medalha',[['#ae-at [data-act="ae-item"]','baixo','1']],'#ae-at',60);
    await A.click('#ae-at button.primary[data-act="ae-at-fecha"]');await A.waitForTimeout(300);
    await pul('1060');
    await shot(A,'e11-snap',[['#ae-at [data-act="ae-recebido"]','baixo','1']],'#ae-at');
    await ctx.close();}

  // ---------------- CLIENTE (celular) ----------------
  {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const API='https://api-exemplo.invalid',TOK='W'.repeat(22);
    const TGAL={tipo:'sessao',menor:false,expira:new Date(Date.now()+60*864e5).toISOString(),estado:'pronta',precos:{dig:30,todas:90},catalogo:[],compra:true,
      fotos:[['ag_c1','comprada'],['ag_v1','venda'],['ag_v2','venda'],['ag_v3','venda'],['ag_v4','venda']].map(([pid,d],i)=>({pid,direito:d,vitrine:API+'/v/'+(i%5)+'.jpg',original:d==='comprada'?API+'/a/'+(i%5)+'.jpg':null,chegando:false}))};await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
    await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const js=o=>r.fulfill({status:200,contentType:'application/json',body:J(o)});
      const gal={tipo:'video',servico:'drone',expira:new Date(Date.now()+30*864e5).toISOString(),estado:'pronta',videos:[{id:TOK,n:1,duracao:28,bytes:mp4.length,chegando:false,url:API+'/arquivo.mp4',baixar:'/g/'+TOK+'/baixar?v='+TOK+'&a=AC1'}],tour:{token:'T'.repeat(22),n:5,acesso:'TA1',galeria:TGAL}};
      if(u.pathname.endsWith('/info'))return js({ok:true,tipo:'video',menor:false,expira:gal.expira,estado:'pronta',servico:'drone',compra:false});
      if(u.pathname.endsWith('/video'))return js({ok:true,acesso:'AC1',exp:gal.expira,galeria:gal});
      if(u.pathname.endsWith('/galeria'))return js({galeria:gal});
      if(u.pathname.endsWith('/evento'))return js({ok:true});
      if(u.pathname.endsWith('/arquivo.mp4'))return r.fulfill({status:200,contentType:'video/mp4',body:mp4});
      const fj=u.pathname.match(/\/[va]\/(\d)\.jpg$/);if(fj)return r.fulfill({status:200,contentType:'image/jpeg',body:FOTOS[+fj[1]]});
      return js({});});
    const C=await ctx.newPage();await C.goto(U+'#g/'+TOK);await C.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
    await C.fill('#gv-email','mariana@exemplo.com');await C.check('[data-act="gv-consent"]');
    await shot(C,'c01-aceite',[['[data-act="gv-consent"]','baixo','1'],['#gv-email','cima','2'],['#gv-go','baixo','3']],null);
    await C.click('#gv-go');await C.waitForFunction(()=>ETERNA.pub.step==='video',null,{timeout:5000});await C.waitForTimeout(1500);
    await C.evaluate(()=>{const v=document.querySelector('video[data-gv-v]');if(v)v.currentTime=6;});await C.waitForTimeout(1000);
    await shot(C,'c02-video',[['video[data-gv-v]','cima','1'],['.gq-gvdl','baixo','2']],null);
    await C.evaluate(()=>document.querySelector('[data-gv-tour]').scrollIntoView({block:'end'}));await C.waitForTimeout(200);
    await shot(C,'c03-fotos-tour',[['[data-gv-tour] a.gq-dl','cima','1'],['[data-gv-tour] .gq-tourph','baixo','2'],['[data-gv-tour] button[data-act="gv-tour"]','cima','3']],null);
    await ctx.close();}
}catch(e){console.log('ERRO',e.stack||e);process.exitCode=1;}
finally{P.grava();await b.close();}})();
