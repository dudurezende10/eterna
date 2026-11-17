// 17/11: Estatísticas › Escolas. O servidor do ponto (falso, page.route na própria origem) traz o funil de cada visita de escola;
// a tela soma as visitas, mostra a etapa a etapa e, ao abrir uma visita, cada criança com a foto grátis, se baixou e se comprou.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const ESC=[
  {localizador:'1112ABCD1234',escola:'EE Teste',dia:'2026-11-12',horarios:['09:15'],pessoas:50,fotos:800,criada:'2026-11-12T15:00:00Z',
   numeros:{voucher:'1112ABCD1234',pessoas:50,fotos:800,lidas:800,primeiro:'2026-11-12T16:00:00Z',ultimo:'2026-11-13T22:00:00Z',
     funil:{digitado:30,aparelhos:28,selfies:25,sem_foto:3,criancas:20,repetidas:2,esgotadas:0,baixadas:15,compras:4,fotos_compradas:9,valor:390},
     criancas:[{em:'2026-11-12T16:10:00Z',foto:'ag_c00001',fotos:12,baixou:true,comprou:true,valor:250,comprador:'p***@x.com'},
               {em:'2026-11-12T16:20:00Z',foto:'ag_c00002',fotos:8,baixou:false,comprou:false,valor:0,comprador:null}]}},
  {localizador:'1110EFGH5678',escola:'Colégio Dois',dia:'2026-11-10',horarios:['10:00'],pessoas:30,fotos:400,criada:'2026-11-10T15:00:00Z',numeros:null}];
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1440,height:1000},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const js=(r,x,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(x)});let pedidos=0;
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'esc',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},estatisticas:{v:2,migracao:{estado:'feita'}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/escolas',r=>{pedidos++;js(r,{ok:true,ligado:true,ultima:'2026-11-17T12:00:00Z',erro:null,numeros_em:'2026-11-17T12:00:00Z',escolas:ESC});});
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(350);await require('./_entrar')(pg,'eduardo@eduardorezende.com');
  await pg.waitForFunction(()=>ETERNA.state.agent.on,null,{timeout:8000}).catch(()=>{});
  await pg.evaluate(()=>{ETERNA.state.es.sec='h';ETERNA.go('estatisticas');});await pg.waitForSelector('#es-esc-lista',{timeout:6000}).catch(()=>{});
  const t=await pg.evaluate(()=>({main:document.getElementById('main').textContent.replace(/\s+/g,' '),chips:[...document.querySelectorAll('[data-act="es-sec"]')].map(x=>x.textContent),
    fun:[...document.querySelectorAll('#es-esc-funil tbody tr')].map(r=>r.textContent.replace(/\s+/g,' ').trim())}));
  ok(t.chips.includes('Escolas')&&pedidos>=1,'1: seção Escolas na Estatística, lida do servidor do ponto: '+J(t.chips));
  ok(/Visitas de escola\s*2/.test(t.main)&&/80 pessoas no voucher/.test(t.main),'2: soma das visitas e das pessoas');
  ok(t.fun.length===5&&/Localizador digitado\s*30/.test(t.fun[0])&&/Selfie encontrada\s*25\s*83,3%/.test(t.fun[1])&&/Foto grátis escolhida\s*20\s*80%/.test(t.fun[2])&&/Compra paga\s*4\s*26,7%/.test(t.fun[4]),'3: funil etapa a etapa: '+J(t.fun));
  ok(/EE Teste/.test(t.main)&&/Colégio Dois/.test(t.main)&&/12\/11\/2026/.test(t.main),'4: cada visita na lista, a mais nova em cima');
  await pg.click('[data-act="es-esc"][data-k="1112ABCD1234"]');await pg.waitForTimeout(250);
  const d=await pg.evaluate(()=>{const s=document.getElementById('es-esc-det');return s?{txt:s.textContent.replace(/\s+/g,' '),imgs:[...s.querySelectorAll('img')].map(i=>i.getAttribute('src'))}:null;});
  ok(d&&/Fotos lidas na nuvem\s*800 \/ 800/.test(d.txt)&&/Mesma criança de novo\s*2/.test(d.txt),'5: detalhe da visita com leitura e repetidas: '+(d&&d.txt.slice(0,200)));
  ok(d&&/Sim\s*Sim/.test(d.txt)&&/p\*\*\*@x\.com/.test(d.txt)&&/Não\s*Não/.test(d.txt)&&d.imgs.length===2&&/\/thumb\/c00001$/.test(d.imgs[0]),'6: cada criança: foto grátis, baixou, comprou e comprador mascarado, em palavras: '+J(d&&d.imgs));
  await pg.click('[data-act="es-esc"][data-k="1110EFGH5678"]');await pg.waitForTimeout(250);
  ok(/A nuvem ainda não mandou os números desta visita/.test(await pg.textContent('#es-esc-det')),'7: visita sem números ainda');
  const falta=await pg.evaluate(()=>Object.keys(ETERNA.EQ||{}).filter(k=>/^es_esc_|^es_sec_h$/.test(k)).filter(k=>ETERNA.EQ[k].length<5||ETERNA.EQ[k].some(x=>!x)));
  ok(!falta.length,'8: textos nos 5 idiomas: '+J(falta));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA escola-painel: '+fails.join(' || '));process.exit(1);}
console.log('OK escola-painel: Estatísticas › Escolas com funil, visitas e cada criança');process.exit(0);
})();
