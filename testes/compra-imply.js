// v99: compra online pela Imply na galeria (Nuvem e Imply simuladas): cesta com os produtos da Imply, dados, ida ao checkout,
// volta por eterna.photo/g/?idpedido=..., conferência até "pago" e fotos liberadas.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const API='https://whe2hyve2j.execute-api.us-east-2.amazonaws.com';const TOK='T'.repeat(22),REF='ON-ABCDEFGHJK';
const SKU={zona:'bd52ae84'+'0'.repeat(32),extra:'5ef192a2'+'0'.repeat(32),mais:'0ef59f3f'+'0'.repeat(32)};
const CAT=[{id:'zona',sku:SKU.zona,nome:'PACOTE ZONA MISTA',preco:110,digital:3,kind:'pacote'},{id:'extra',sku:SKU.extra,nome:'1 foto (adicional) digital ou impressa',preco:35,digital:1,kind:'adicional'},{id:'mais',sku:SKU.mais,nome:'Todas as fotos digitais',preco:250,digital:'todas',kind:'pacote'}];
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const exp=new Date(Date.now()+30*864e5).toISOString();
const fotos=d=>Array.from({length:8},(_,i)=>({pid:'a0000'+i,direito:d&&d.includes(i)?'comprada':'venda',vitrine:'https://x/v'+i+'.jpg',original:d&&d.includes(i)?'https://x/o'+i+'.jpg':null}));
const gal=d=>({tipo:'sessao',menor:false,expira:exp,estado:'pronta',precos:{todas:250},catalogo:CAT,compra:true,fotos:fotos(d)});
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  await ctx.route('https://x/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  let pedidoCorpo=null,consultas=0,pago=false;
  await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const pth=u.pathname;const js=(o,st)=>r.fulfill({status:st||200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:J(o)});
    if(pth===`/g/${TOK}/info`)return js({ok:true,tipo:'sessao',menor:false,expira:exp,estado:'pronta',compra:true});
    if(pth===`/g/${TOK}/livres`)return js({galeria:{...gal(pago?[0,1,2,3]:[]),fotos:pago?fotos([0,1,2,3]).slice(0,4):[]}});
    if(pth===`/g/${TOK}/galeria`)return js({galeria:gal(pago?[0,1,2,3]:[])});
    if(pth===`/g/${TOK}/pedido`){pedidoCorpo=JSON.parse(r.request().postData());return js({ok:true,ref:REF,url:'https://imply.exemplo/checkout?x=1',total:145,fotos:4});}
    if(pth===`/g/pedido/${REF}`){consultas++;if(consultas>=2)pago=true;return js({token:TOK,estado:pago?'pago':'aguardando',total:145,fotos:4});}
    return js({error:'not found'},404);});
  await ctx.route('https://imply.exemplo/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Checkout Imply</h1>'}));
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push(e.message));
  await G.goto(U+'#g/'+TOK);await G.waitForTimeout(900);
  // sem selfie ainda: entra como se a selfie tivesse batido (acesso de 1 h)
  await G.evaluate(([t,g])=>{const p=ETERNA.state.pub;p.modo='agente';p.acesso='ACESSO-TESTE';p.gal=g;p.galAt=Date.now();p.step='galeria';ETERNA.render();},[TOK,gal([])]);await G.waitForTimeout(200);
  const txt=await G.textContent('#main');
  ok(/3 fotos por R\$\s?110(,00)? · cada foto a mais R\$\s?35(,00)? · todas por R\$\s?250(,00)?/.test(txt),'oferta com os produtos da Imply: '+(txt.match(/fotos por[^.]*\./)||[''])[0]);
  ok(/Todas por R\$\s?250(,00)?/.test(txt),'botão todas por 250');
  await G.locator('[data-act="gq-sel"]').nth(0).click();await G.waitForTimeout(80);
  let bar=await G.textContent('.gq-bar');ok(/R\$\s?110(,00)?/.test(bar)&&/mais 2 sem pagar a mais/.test(bar),'1 foto: Zona Mista 110 e dica de mais 2 sem custo: '+bar);
  for(const i of [1,2,3]){await G.locator('[data-act="gq-sel"]').nth(i).click();await G.waitForTimeout(60);}
  bar=await G.textContent('.gq-bar');ok(/4 fotos/.test(bar)&&/R\$\s?145(,00)?/.test(bar)&&!/sem pagar/.test(bar),'4 fotos: 145 (Zona Mista + 1 adicional): '+bar);
  await G.click('[data-act="gq-buy"]');await G.waitForTimeout(150);
  const f=await G.textContent('#main');
  ok(/PACOTE ZONA MISTA/.test(f)&&/1 foto \(adicional\)/.test(f)&&/Imply/.test(f)&&/Ir para o pagamento · R\$\s?145(,00)?/.test(f),'tela de dados com a cesta da Imply');
  await G.fill('#gq-nome','Cliente Teste');await G.fill('#gq-email','cliente@exemplo.com');await G.fill('#gq-doc','111.111.111-11');await G.click('[data-act="gq-pay"]');await G.waitForTimeout(150);
  ok(/Confira o documento/.test(await G.textContent('#main'))&&!pedidoCorpo,'CPF inválido barrado antes de chamar a Nuvem');
  await G.fill('#gq-doc','529.982.247-25');await G.check('#gq-mkt');
  await Promise.all([G.waitForURL(/imply\.exemplo/,{timeout:8000}),G.click('[data-act="gq-pay"]')]);
  ok(pedidoCorpo&&J(pedidoCorpo.itens)===J([{id:'zona',qtd:1},{id:'extra',qtd:1}])&&pedidoCorpo.pids.length===4&&pedidoCorpo.acesso==='ACESSO-TESTE','pedido: itens e fotos: '+J(pedidoCorpo&&{itens:pedidoCorpo.itens,pids:pedidoCorpo.pids}));
  ok(pedidoCorpo&&pedidoCorpo.cliente.cpf==='529.982.247-25'&&pedidoCorpo.cliente.email==='cliente@exemplo.com'&&pedidoCorpo.marketing===true,'pedido: dados do cliente e consentimento');
  // volta da Imply: eterna.photo/g/?idpedido=...
  await G.goto(ORIG+'/g/?idpedido='+REF);await G.waitForTimeout(600);
  ok(/#g\/pedido\/ON-ABCDEFGHJK$/.test(G.url())||/#g\/T{22}$/.test(G.url()),'/g/ leva à conferência do pedido: '+G.url());
  const t1=await G.textContent('#main');ok(/Conferindo seu pagamento/.test(t1)||/#g\/T{22}$/.test(G.url()),'mostra "Conferindo seu pagamento" enquanto a Imply não confirma');
  await G.waitForURL(new RegExp('#g/'+TOK+'$'),{timeout:12000});await G.waitForTimeout(1200);
  const st=await G.evaluate(()=>{const p=ETERNA.state.pub;return {step:p.step,acesso:p.acesso,comp:((p.gal||{}).fotos||[]).filter(f=>f.direito==='comprada').length,toast:document.querySelector('#toast').textContent};});
  ok(st.step==='galeria'&&st.comp===4&&/Pagamento aprovado/.test(st.toast),'pago: galeria com as 4 compradas e aviso: '+J(st));
  ok(consultas>=2,'conferiu na Nuvem até o pago: '+consultas);
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA compra-imply: '+fails.join(' || '));process.exit(1);}
console.log('OK compra-imply: cesta da Imply, dados, checkout, volta e liberação');process.exit(0);
})();
