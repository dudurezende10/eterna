// Prints do treinamento "Da venda à entrega" (Drone, Chute a Gol e Snap Pop). Telas de verdade do app, com o servidor
// respondido aqui no navegador (dados fictícios): nada é gravado em servidor nenhum.
//   NODE_PATH=<node_modules com playwright> U=http://127.0.0.1:8894/index.html VIDEO=<um mp4 de exemplo> node capturar.js <pasta de saída>
// Para cada print grava <chave>.png e, em marcas.json, as caixas (em px da imagem) dos alvos de cada passo e o recorte.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8894/index.html';const OUT=process.argv[2]||'prints-brutos';const VIDEO=process.env.VIDEO;
fs.mkdirSync(OUT,{recursive:true});const MARCAS={};const J=JSON.stringify;
const E=require(path.join(__dirname,'..','..','..','testes','_entrar'));
const HOJE=new Date().toISOString().slice(0,10);
const mp4=VIDEO?fs.readFileSync(VIDEO):Buffer.alloc(0);

// foto de cliente fictícia (silhueta), no lugar de um rosto de verdade
const SILHUETA=()=>{const c=document.createElement('canvas');c.width=480;c.height=480;const g=c.getContext('2d');g.fillStyle='#cfd8e3';g.fillRect(0,0,480,480);
  g.fillStyle='#7a8ca3';g.beginPath();g.arc(240,190,95,0,7);g.fill();g.beginPath();g.ellipse(240,470,170,150,0,0,7);g.fill();return c.toDataURL('image/jpeg',.85);};

async function usuario(pg,email,nome,perms){await pg.evaluate(([e,n,p])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]={email:e,name:n,active:true,preset:'custom',perms:p,key:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,perms]);await pg.reload();await pg.waitForTimeout(400);}

// print: marcas = [[seletor, direção da seta, número]], recorte = seletor do bloco (ou null = tela toda)
async function shot(pg,chave,marcas,recorte,folga=24){
  if(marcas.length){await pg.evaluate(s=>{const el=document.querySelector(s);if(el)el.scrollIntoView({block:'center'});},marcas[0][0]);await pg.waitForTimeout(250);}
  const dpr=await pg.evaluate(()=>devicePixelRatio);
  const caixa=async s=>pg.evaluate(s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom];},s);
  const ms=[];for(const [s,dir,n] of marcas){const b=await caixa(s);if(!b){console.log('  sem alvo',chave,s);continue;}ms.push([b.map(v=>Math.round(v*dpr)),dir,n]);}
  const vp=pg.viewportSize();let rc=[0,0,vp.width,vp.height];
  if(recorte){const b=await caixa(recorte);if(b)rc=[Math.max(0,b[0]-folga),Math.max(0,b[1]-folga),Math.min(vp.width,b[2]+folga),Math.min(vp.height,b[3]+folga)];}
  // o recorte sempre cabe as marcas, com espaço para a seta
  for(const [b] of ms){rc=[Math.min(rc[0],b[0]/dpr-130),Math.min(rc[1],b[1]/dpr-130),Math.max(rc[2],b[2]/dpr+130),Math.max(rc[3],b[3]/dpr+130)];}
  rc=[Math.max(0,rc[0]),Math.max(0,rc[1]),Math.min(vp.width,rc[2]),Math.min(vp.height,rc[3])].map(v=>Math.round(v*dpr));
  await pg.screenshot({path:path.join(OUT,chave+'.png')});MARCAS[chave]={marcas:ms,recorte:rc};console.log('  print',chave);}

(async()=>{const b=await chromium.launch({channel:process.env.CANAL||'chrome'}); // Chrome de verdade: o Chromium dos testes não toca MP4 (H.264)
try{
  // ---------------- VENDA (tablet) ----------------
  {const ctx=await b.newContext({viewport:{width:800,height:1280},deviceScaleFactor:1.5,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const enviadas=[];
    await ctx.route(/\/ativ\/venda$/,r=>{const j=JSON.parse(r.request().postData());j.vendas.forEach(v=>enviadas.push(v));r.fulfill({status:200,contentType:'application/json',body:J({ok:true,recebidas:j.vendas.map(v=>v.id),recusadas:[]})});});
    await ctx.route(/\/ativ\/minhas\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,vendas:enviadas.map(v=>({...v,situacao:'ativa',cliente_foto:undefined}))})}));
    await ctx.route(/\/ativ\/demo\/lista$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,videos:[]})}));
    const A=await ctx.newPage();await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();indexedDB.deleteDatabase('eterna-ativ');});await A.reload();await A.waitForTimeout(400);
    const VEND='ana.souza';await usuario(A,VEND,'Ana Souza',{ativvenda:{c:true,r:true,u:false,d:false}});
    await A.fill('[data-act="login-usuario"]',VEND);await A.fill('[data-act="login-senha"]','••••••••');
    await shot(A,'v01-entrar',[['[data-act="login-usuario"]','direita','1'],['[data-act="login-senha"]','direita','2'],['button[type=submit]','direita','3']],'button[type=submit]',230);
    await E(A,VEND);await A.waitForTimeout(300);
    await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;});
    if(await A.evaluate(()=>ETERNA.state.view)!=='ativ-venda'){const m=await A.$('[data-v="ativ-venda"]');if(m){await shot(A,'v02-menu',[['[data-v="ativ-venda"]','direita','1']],'[data-v="ativ-venda"]',200);await m.click();}else await A.evaluate(()=>ETERNA.go('ativ-venda'));}
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
    await A.fill('[data-act="av-nome"]','Mariana Costa');await A.waitForTimeout(100);
    await shot(A,'v07-cliente-nome',[['[data-act="av-nome"]','baixo','1'],['#av-cliente .btn.ghost','baixo','2']],'#av-cliente');
    await A.evaluate(f=>{ETERNA.state.av.foto=f;ETERNA.render();},await A.evaluate(SILHUETA));await A.waitForTimeout(150);
    await A.check('[data-act="av-busca"]');await A.selectOption('[data-act="av-pais"]','Brasil').catch(()=>{});await A.selectOption('[data-act="av-idioma"]','Português').catch(()=>{});await A.waitForTimeout(100);
    await shot(A,'v08-cliente-foto',[['#av-foto-img','cima','1'],['[data-act="av-busca"]','esquerda','2'],['[data-act="av-pais"]','baixo','3'],['[data-act="av-idioma"]','baixo','4']],'#av-cliente');
    await A.click('[data-act="av-pag"][data-p="PIX"]');await A.waitForTimeout(150);
    await shot(A,'v09-resumo',[['[data-av-linha="0"]','esquerda','1'],['[data-act="av-tirar"][data-i="0"]','esquerda','2'],['#av-total','esquerda','3']],'#av-cart');
    await shot(A,'v10-pagamento',[['[data-act="av-pag"][data-p="PIX"]','baixo','1'],['[data-act="av-registrar"]','cima','2']],'#av-pag');
    await A.click('[data-act="av-registrar"]');await A.waitForTimeout(500);
    await shot(A,'v11-registrada',[['#toast','cima','1']],'#toast',260);
    await A.click('[data-act="av-aba"][data-v="minhas"]');await A.waitForTimeout(800);
    await shot(A,'v12-minhas',[['[data-act="av-aba"][data-v="minhas"]','baixo','1']],'#av-minhas, #main');
    await ctx.close();}

  // ---------------- ENTREGA (computador do campo) ----------------
  {const ctx=await b.newContext({viewport:{width:1100,height:860},deviceScaleFactor:1.5,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const QRN='N'.repeat(21)+'2';
    const D={ok:true,nuvem:{ligada:true,fila:0},cadastros:{piloto:[{nome:'Carlos',ativo:true},{nome:'Rafaela',ativo:true}],drone:['006','007','141','228'].map(n=>({nome:n,ativo:true})),bateria:Array.from({length:8},(_,i)=>({nome:String(i+1),ativo:true}))},vendas:[
      {id:'TDRONE001D',tipo:'drone',criado:HOJE+'T10:05:00',itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:2,videos:1,k4:true}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null,cliente:'Mariana Costa'},
      {id:'TDRONE002D',tipo:'drone',criado:HOJE+'T10:15:00',itens:[{produto:'boomerang',op:'Arquibancada',qtd:1,pessoas:3,videos:1}],pagamento:'Crédito',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],recebido_em:null,voo_em:null,entregue_em:null,cliente:'Paulo Mendes'},
      {id:'TDRONE003D',tipo:'drone',criado:HOJE+'T09:40:00',itens:[{produto:'asteroid',op:'Campo',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,
       entregas:[{qr:'K'.repeat(21)+'3',codigo:'KP7M-3QXA',n:1,bytes:3135031,duracao:28,nuvem:true,subindo:null,cliente:{aberto:HOJE+'T10:01:00',aceite:HOJE+'T10:01:30',play:HOJE+'T10:02:00',baixou:HOJE+'T10:03:00',baixou_n:1}}],fisicos:[],voo_em:HOJE+'T09:50:00',piloto:'Carlos',drone:'007',bateria:'2',entregue_em:HOJE+'T09:58:00',cliente:'Joana Ribeiro'},
      {id:'TCHUTE001C',tipo:'chute',criado:HOJE+'T10:10:00',itens:[{produto:'c3',op:'',qtd:1,pessoas:1,videos:1},{produto:'medalha',op:'',qtd:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,
       entregas:[{qr:'Q'.repeat(21)+'1',codigo:'ABCD-EFGH',n:1,bytes:2097152,duracao:20,nuvem:true,subindo:null}],fisicos:[{i:1,nome:'Medalha',entregue:false}],entregue_em:null,cliente:'Mariana Costa'},
      {id:'TSNAP0001S',tipo:'snap',criado:HOJE+'T10:20:00',itens:[{produto:'snap_video',op:'Brasil',qtd:1,pessoas:1,videos:1}],pagamento:'PIX',vendedor:'Ana Souza',videos:1,entregas:[],fisicos:[],entregue_em:null,cliente:'Lucas Pereira'}]};
    await ctx.route(/\/ativ\/fila\?/,r=>r.fulfill({status:200,contentType:'application/json',body:J(D)}));
    await ctx.route(/\/ativ\/etapa$/,r=>{const c=JSON.parse(r.request().postData());const v=D.vendas.find(x=>x.id===c.id);
      if(c.etapa==='recebido')v.recebido_em=HOJE+'T10:22:00';if(c.etapa==='voo')Object.assign(v,{voo_em:HOJE+'T10:30:00',piloto:c.piloto,drone:c.drone,bateria:c.bateria});
      if(c.etapa==='item'){v.fisicos[0].entregue=true;v.entregue_em=HOJE+'T10:45:00';}r.fulfill({status:200,contentType:'application/json',body:J({ok:true})});});
    await ctx.route(/\/ativ\/video$/,r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,rascunho:'0123456789abcdef',bytes:mp4.length,duracao:28})}));
    await ctx.route(/\/ativ\/video\/liga$/,r=>{const c=JSON.parse(r.request().postData());const v=D.vendas.find(x=>x.id===c.venda);
      v.entregas.push({qr:c.qr,codigo:'WXYZ-2345',n:1,bytes:mp4.length,duracao:28,nuvem:true,subindo:null});v.entregue_em=HOJE+'T10:40:00';
      r.fulfill({status:200,contentType:'application/json',body:J({ok:true,qr:c.qr,codigo:'WXYZ-2345',n:1})});});
    await ctx.route(/\/exemplo\.mp4$/,r=>r.fulfill({status:200,contentType:'video/mp4',body:mp4}));
    const A=await ctx.newPage();await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
    const ENT='bruno.lima';await usuario(A,ENT,'Bruno Lima',{ativentrega:{c:true,r:true,u:true,d:false}});await E(A,ENT);
    await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;});
    if(await A.evaluate(()=>ETERNA.state.view)!=='ativ-entrega'){const m=await A.$('[data-v="ativ-entrega"]');if(m){await shot(A,'e01-menu',[['[data-v="ativ-entrega"]','direita','1']],'[data-v="ativ-entrega"]',200);await m.click();}else await A.evaluate(()=>ETERNA.go('ativ-entrega'));}
    await A.waitForTimeout(800);
    const card='[data-ae-venda="TDRONE001D"]';
    await shot(A,'e02-fila',[['[data-act="ae-cat"][data-c="drone"]','direita','1'],[card+' [data-act="ae-voo"]','direita','2']],'.ae-board');
    await A.click(card+' [data-act="ae-voo"]');await A.waitForTimeout(200);
    await A.selectOption(card+' [data-ae-voo="piloto"]','Carlos');await A.selectOption(card+' [data-ae-voo="drone"]','007');await A.selectOption(card+' [data-ae-voo="bateria"]','3');
    await shot(A,'e03-decolar',[[card+' [data-ae-voo="piloto"]','esquerda','1'],[card+' [data-ae-voo="drone"]','esquerda','2'],[card+' [data-ae-voo="bateria"]','esquerda','3'],[card+' [data-act="ae-voo-ok"]','esquerda','4']],card,60);
    await A.click(card+' [data-act="ae-voo-ok"]');await A.waitForTimeout(400);
    await shot(A,'e04-voando',[['[data-ae-col="andamento"] '+card,'baixo','1']],'[data-ae-col="andamento"]',40);
    await shot(A,'e05-soltar',[['#ae-drop','cima','1']],'#ae-drop',60);
    await A.evaluate(async()=>{const r=await fetch('/exemplo.mp4');const bl=await r.blob();const dt=new DataTransfer();dt.items.add(new File([bl],'DJI_0001.MP4',{type:'video/mp4'}));
      document.getElementById('ae-drop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
    await A.waitForTimeout(1500);await A.evaluate(()=>{const v=document.querySelector('#ae-nv video');if(v){v.currentTime=6;}});await A.waitForTimeout(800);
    await shot(A,'e06-conferir',[['#ae-nv video','direita','1'],['[data-act="ae-nv-venda"][data-id="TDRONE001D"]','esquerda','2']],'#ae-nv');
    await A.click('[data-act="ae-nv-venda"][data-id="TDRONE001D"]');await A.waitForTimeout(200);
    await shot(A,'e07-cartao',[['[data-act="ae-cam"]','direita','1'],['[data-act="ae-qr-txt"]','direita','2']],'#ae-nv');
    await A.fill('[data-act="ae-qr-txt"]','https://eterna.photo/#g/'+QRN);await A.press('[data-act="ae-qr-txt"]','Enter');await A.waitForTimeout(200);
    await shot(A,'e08-entregar',[['[data-act="ae-nv-liga"]','direita','1']],'#ae-nv');
    await A.click('[data-act="ae-nv-liga"]');await A.waitForTimeout(800);
    await shot(A,'e09-entregue',[['[data-ae-col="delivery"] '+card+', [data-ae-col="entregue"] '+card,'esquerda','1'],['[data-ae-col="entregue"] [data-ae-venda="TDRONE003D"]','esquerda','2']],null);
    await A.click('[data-act="ae-cat"][data-c="chute"]');await A.waitForTimeout(300);
    await shot(A,'e10-medalha',[['[data-ae-venda="TCHUTE001C"] [data-act="ae-item"]','baixo','1']],'[data-ae-venda="TCHUTE001C"]',60);
    await A.click('[data-act="ae-cat"][data-c="snap"]');await A.waitForTimeout(300);
    await shot(A,'e11-snap',[['[data-ae-venda="TSNAP0001S"] [data-act="ae-recebido"]','direita','1']],null);
    await ctx.close();}

  // ---------------- CLIENTE (celular) ----------------
  {const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    const API='https://api-exemplo.invalid',TOK='W'.repeat(22);await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
    await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const js=o=>r.fulfill({status:200,contentType:'application/json',body:J(o)});
      const gal={tipo:'video',servico:'drone',expira:new Date(Date.now()+30*864e5).toISOString(),estado:'pronta',videos:[{id:TOK,n:1,duracao:28,bytes:mp4.length,chegando:false,url:API+'/arquivo.mp4',baixar:'/g/'+TOK+'/baixar?v='+TOK+'&a=AC1'}],tour:{token:'T'.repeat(22),n:6}};
      if(u.pathname.endsWith('/info'))return js({ok:true,tipo:'video',menor:false,expira:gal.expira,estado:'pronta',servico:'drone',compra:false});
      if(u.pathname.endsWith('/video'))return js({ok:true,acesso:'AC1',exp:gal.expira,galeria:gal});
      if(u.pathname.endsWith('/galeria'))return js({galeria:gal});
      if(u.pathname.endsWith('/evento'))return js({ok:true});
      if(u.pathname.endsWith('/arquivo.mp4'))return r.fulfill({status:200,contentType:'video/mp4',body:mp4});
      return js({});});
    const C=await ctx.newPage();await C.goto(U+'#g/'+TOK);await C.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
    await C.fill('#gv-email','mariana@exemplo.com');await C.check('[data-act="gv-consent"]');
    await shot(C,'c01-aceite',[['[data-act="gv-consent"]','baixo','1'],['#gv-email','cima','2'],['#gv-go','baixo','3']],null);
    await C.click('#gv-go');await C.waitForFunction(()=>ETERNA.pub.step==='video',null,{timeout:5000});await C.waitForTimeout(1500);
    await C.evaluate(()=>{const v=document.querySelector('video[data-gv-v]');if(v)v.currentTime=6;});await C.waitForTimeout(1000);
    await shot(C,'c02-video',[['video[data-gv-v]','cima','1'],['.gq-gvdl','baixo','2']],null);
    await C.evaluate(()=>document.querySelector('[data-gv-tour]').scrollIntoView({block:'end'}));await C.waitForTimeout(200);
    await shot(C,'c03-fotos-tour',[['[data-gv-tour] a','cima','1']],null);
    await ctx.close();}
}catch(e){console.log('ERRO',e.stack||e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(OUT,'marcas.json'),JSON.stringify(MARCAS,null,1));await b.close();}})();
