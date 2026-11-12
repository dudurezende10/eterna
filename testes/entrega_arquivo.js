// v99.23.3: escolher o vídeo pela janela de arquivo. A janela aberta por mais de 10 s (a fila e a situação do servidor redesenham
// a tela) não perde a escolha; arquivo que não é .mp4/.mov ganha aviso fixo com o nome; o mesmo arquivo pode ser escolhido de novo.
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
  await A.evaluate(()=>{const s=ETERNA.state;setInterval(()=>{s.agent.on=true;},20);s.agent.on=true;ETERNA.go('ativ-entrega');});await A.waitForTimeout(600);
  const txt=async s=>(await A.textContent(s))||'';
  const [fc]=await Promise.all([A.waitForEvent('filechooser'),A.click('#ae-drop')]);
  await A.waitForTimeout(12000);
  await fc.setFiles({name:'DJI_0001.LRF',mimeType:'application/octet-stream',buffer:Buffer.alloc(3000,1)});await A.waitForTimeout(400);
  ok(/DJI_0001\.LRF.*não é vídeo \.mp4 ou \.mov/.test(await txt('#ae-drop-err'))&&!video,'formato errado: aviso fixo com o nome do arquivo');
  const [fc2]=await Promise.all([A.waitForEvent('filechooser'),A.click('#ae-drop')]);
  await A.waitForTimeout(12000);
  await fc2.setFiles({name:'DJI_0001.MP4',mimeType:'video/mp4',buffer:Buffer.alloc(3000,1)});await A.waitForTimeout(800);
  ok(video&&video.n===3000&&await A.evaluate(()=>!!ETERNA.state.ae.nv),'janela aberta 12 s: o vídeo escolhido sobe mesmo assim');
  ok(await A.evaluate(()=>document.getElementById('ae-file').value)==='','campo limpo: o mesmo arquivo pode ser escolhido de novo');
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('OK entrega_arquivo: janela de arquivo aberta 12 s não perde o vídeo, formato errado avisado, mesmo arquivo de novo');})();
