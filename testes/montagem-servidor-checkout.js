// Montagem no servidor, E2 (plano docs/planos/2026-11-16-montagem-no-servidor.md; regra do Eduardo: o recorte e a montagem
// dos fundos de IA são feitos e guardados no servidor, o Checkout e o Posto só mostram e imprimem). Agente falso (page.route).
//  1. chave "ligada" (agente com montagem.imprime): o Checkout mostra as montagens do servidor (GET /montagem/...?t=p), um
//     pedido só ao /montagens/pedir, nenhum POST /recorte, ETERNA.fiaMontagens.canvas === 0
//  2. montagem ainda na fila (202): o item espera e aparece quando o servidor termina (sem canvas)
//  3. servidor fora (503) mais tempo que a espera: o item fica em "Preparando" e tenta de novo; NUNCA monta no navegador;
//     quando o servidor volta, a montagem aparece
//  4. 404 (sem pessoa, foto que não é base): o item sai da venda (fiaFalhou), sem canvas
//  5. impressão: compHi devolve o 10x15 do servidor (?t=i, a versão da prévia; 409 de versão trocada pede a atual) e o
//     #print-root do printMontar tem a imagem 1844x1240; servidor fora na impressão: a foto de IA falha (não vai canvas)
//  6. fundo que o servidor não sabe montar (fora de montagem.montaveis) não entra na venda com a chave ligada
//  7. foto de exemplo (sem ag_): não pede nada ao servidor
//  8. chave trocada para "sombra" no /status: em até 2 leituras o app volta ao canvas (fiaMontar) sem recarregar;
//     agente antigo (sem montagem.imprime) com "ligada": canvas, como sempre
// Nenhuma foto de convidado: quadrados de cor desenhados na hora.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const [JPG,PV,HI]=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
def j(w,h,c):
    im=Image.new('RGB',(w,h),c);d=ImageDraw.Draw(im);d.ellipse([w*.4,h*.3,w*.6,h*.6],fill=(230,200,170));b=io.BytesIO();im.save(b,'JPEG',quality=80);return base64.b64encode(b.getvalue()).decode()
print(j(300,200,(60,110,150)));print(j(1200,856,(20,90,40)));print(j(1844,1240,(90,40,20)))`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
const ses=(card,fotos,t0,rev,x)=>({card,dia:hoje,fotografo:'yago',fonte:'ftp',ponto:null,funcao:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev,ia:[],ia_regra:null,...x});
const COM=ids('c3c',6),OUT=ids('d4d',5);
const FEED=[ses('LPMTGSRV1',COM,a-600,1,{ia:COM.slice(0,2),ia_regra:{n:2,motivo:null}}),ses('LPMTGSRV2',OUT,a-300,2,{ia:OUT.slice(0,2),ia_regra:{n:2,motivo:null}})];
const ATIVOS=['mirantedia','arq1950','telao','tunel'],TODOS=['arq1950','campeao2','mirante','mirantedia','podio','telao','tunel'];
// o que o servidor falso responde (o teste muda no meio)
const SRV={modo:'ligada',imprime:true,montaveis:TODOS,versao:'1a2b3c4d',p:{},i:{},pedir:[],get:[],recorte:0,statusN:0};
const estado=(k,t)=>(SRV[t][k]!==undefined?SRV[t][k]:SRV[t]['*']!==undefined?SRV[t]['*']:200);
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>{SRV.statusN++;const mt={v:1,modo:SRV.modo,ok:true,motivo:null,versao:'m2',fundos:Object.fromEntries(ATIVOS.map(f=>[f,SRV.versao])),filho:{vivo:true,reinicios:0},parado:null,fila:0,feitas:0,erros:0,ms_medio:400,atraso_p50_s:3,atraso_p90_s:6,guardado_gb:0,livre_gb:100,piso_gb:10,pausa_disco:false,no_hd:true};
    if(SRV.imprime)Object.assign(mt,{imprime:true,montaveis:SRV.montaveis,ativos:ATIVOS});
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bM',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
    sessoes:{v:2,pausa:60,rostos:true,rev:2,gen:'bM',hoje:2,abertas:0,dias:1},recorte:{ok:true,carregado:true,feitos:4,ms_medio:900,fila:0,ia:{ligada:true,fila:0,feitos:4,erros:0}},montagem:mt,fundos_modo:'local'})});});
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'bM',rev:2,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/recorte',r=>{SRV.recorte++;r.fulfill({status:503,contentType:'application/json',body:'{"error":"x"}'});});
  await ctx.route(ORIG+'/montagens/pedir',r=>{let j={};try{j=JSON.parse(r.request().postData()||'{}');}catch(e){}SRV.pedir.push(j);
    const itens=[];(j.pids||[]).forEach(p=>(j.fundos||[]).forEach(f=>itens.push({pid:p,fundo:f,versao:SRV.versao,estado:'fila',p:false,i:false,w:1200,h:856})));
    r.fulfill({status:200,contentType:'application/json',body:J({ok:true,v:1,itens})});});
  await ctx.route(ORIG+'/montagem/**',r=>{const u=new URL(r.request().url());const [,,pid,arq]=u.pathname.split('/');const f=arq.replace(/\.jpg$/,'');const t=u.searchParams.get('t');const v=u.searchParams.get('v');
    SRV.get.push({pid,f,t,v});const k=pid+'|'+f;let st=estado(k,t);
    if(typeof st==='object'&&st.n!=null){st.n--;st=st.n>=0?202:200;}
    if(st===200&&v&&v!==SRV.versao)st=409;
    if(st===200)return r.fulfill({status:200,headers:{'Content-Type':'image/jpeg','X-Eterna-Montagem':SRV.versao,'Cache-Control':'private, no-store'},body:t==='i'?HI:PV});
    r.fulfill({status:st,contentType:'application/json',body:J(st===202?{estado:'fila'}:st===409?{error:'versao'}:st===404?{error:'not found'}:{error:'montagem_parada'})});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>window.ETERNA&&['LPMTGSRV1','LPMTGSRV2'].every(c=>ETERNA.SIM.sessions[c])&&ETERNA.mtgSrv&&ETERNA.mtgSrv(),20000),'as sessões chegaram e a chave ligada vale (mtgSrv)');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};S.bgOn2=['mirantedia','arq1950','telao','tunel'];S.bgTunelV2=true;Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));ETERNA.state.agent.recorte={ok:true,carregado:true};ETERNA.mtgTempos(1500,100,300,3000);});
  const conta=()=>pg.evaluate(()=>({...ETERNA.fiaMontagens}));
  // ---- 1. Checkout com a chave ligada: as 4 montagens do servidor, sem canvas e sem recorte
  const its=await pg.evaluate(()=>ETERNA.lojaAI('LPMTGSRV1').map(x=>({id:x.id,bg:x.bg,k:x.k})));
  ok(its.length===4&&J(its.map(x=>x.bg))===J(['mirantedia','arq1950','telao','tunel']),'1: uma montagem por fundo ativo (4, com o túnel): '+J(its));
  ok(its.find(x=>x.bg==='tunel').id===its.find(x=>x.bg==='arq1950').id&&its.find(x=>x.bg==='telao').id===its.find(x=>x.bg==='mirantedia').id,'1: túnel e 1950 com a 1ª base, Mirante e Telão com a 2ª (FIA_BASE)');
  await pg.evaluate(()=>ETERNA.iaAquecer('LPMTGSRV1'));
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.code='LPMTGSRV1';k.so=null;k.step='review';k.i=0;ETERNA.render();});
  ok(await espera(()=>ETERNA.lojaAI('LPMTGSRV1').every(ETERNA.fiaPronta),8000),'1: as 4 montagens prontas (fiaPronta)');
  await pg.waitForTimeout(500);
  const c1=await conta();
  ok(c1.servidor===4&&c1.canvas===0&&SRV.recorte===0,'1: 4 do servidor, nenhuma no canvas, nenhum POST /recorte: '+J([c1,SRV.recorte]));
  ok(SRV.pedir.length===1&&J(SRV.pedir[0].tipos)===J(['p'])&&SRV.pedir[0].pids.length===2&&SRV.pedir[0].fundos.length===4,'1: um pedido só ao /montagens/pedir com as 2 bases e os 4 fundos: '+J(SRV.pedir));
  ok(SRV.get.filter(g=>g.t==='p').length===4,'1: 4 prévias baixadas do servidor: '+J(SRV.get));
  const urls=await pg.evaluate(()=>its0=ETERNA.lojaAI('LPMTGSRV1').map(x=>ETERNA.COMPURL[x.id+'|'+x.bg]));
  ok(urls.every(u=>/^blob:/.test(u)),'1: a prévia mostrada é o arquivo do servidor (blob:): '+J(urls));
  const tela=await pg.evaluate(()=>[...document.querySelectorAll('[data-comp]')].filter(e=>e.classList.contains('ok')).length);
  ok(tela>=1,'1: o Checkout desenhou a montagem do servidor na tela: '+tela);
  // ---- 2. 202 duas vezes e depois pronta
  const [b1,b2]=await pg.evaluate(()=>ETERNA.SIM.sessions.LPMTGSRV2.ia.map(x=>x.replace(/^ag_/,'')));
  SRV.p[b1+'|mirantedia']={n:2};
  const r2=await pg.evaluate(async id=>{const r=await ETERNA.compose('ag_'+id,'mirantedia');return {url:!!r.url,srv:r.srv,w:r.w,h:r.h,v:r.versao};},b1);
  ok(r2.url&&r2.srv&&r2.w===1200&&r2.h===856&&r2.v===SRV.versao,'2: depois de 2 respostas 202 a montagem aparece (servidor): '+J(r2));
  // ---- 3. servidor fora (503) mais tempo que a espera: "Preparando", sem canvas; depois volta
  SRV.p[b1+'|arq1950']=503;
  const c3a=await conta();
  const r3=await pg.evaluate(async id=>ETERNA.compose('ag_'+id,'arq1950'),b1);
  const c3b=await conta();
  ok(r3.pending==='servidor'&&c3b.canvas===c3a.canvas&&SRV.recorte===0,'3: servidor fora: pendente, nunca no canvas: '+J([r3,c3a,c3b]));
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.code='LPMTGSRV2';k.so=null;k.step='review';k.i=0;ETERNA.render();});
  await pg.waitForTimeout(600);
  const prep=await pg.evaluate(id=>{const el=document.querySelector(`[data-comp="ag_${id}|arq1950"]`);return el?{ok:el.classList.contains('ok'),pend:el.classList.contains('pend'),txt:el.textContent}:null;},b1);
  ok(!prep||(!prep.ok&&!prep.pend),'3: na tela o item segue em "Preparando" (não sai da venda): '+J(prep));
  const it3=await pg.evaluate(()=>ETERNA.lojaItems('LPMTGSRV2').filter(x=>x.t==='ai').map(x=>x.k));ok(it3.includes('ai:ag_'+b1+'|arq1950'),'3: o item continua na venda: '+J(it3));
  SRV.p[b1+'|arq1950']=200;
  ok(await espera(id=>!!ETERNA.COMPURL['ag_'+id+'|arq1950'],8000,b1),'3: o servidor volta e a montagem aparece sozinha');
  ok((await conta()).canvas===0,'3: nenhuma montagem no canvas');
  // ---- 4. 404: sai da venda
  SRV.p[b2+'|mirante']=404;
  const r4=await pg.evaluate(async id=>ETERNA.compose('ag_'+id,'mirante'),b2);
  ok(r4.err==='sem_pessoa','4: 404 do servidor vira sem_pessoa: '+J(r4));
  // ---- 5. impressão: o 10x15 do servidor, com a versão da prévia
  const g0=SRV.get.length;
  const r5=await pg.evaluate(async id=>{const r=await ETERNA.compHi('ag_'+id,'mirantedia');return {url:String(r.url||'').slice(0,23),w:r.w,h:r.h,fonte:r.fonte,av:r.avisos,err:r.err};},b1);
  const gi=SRV.get.slice(g0).filter(g=>g.t==='i');
  ok(r5.url==='data:image/jpeg;base64,'&&r5.w===1844&&r5.h===1240&&r5.fonte==='servidor'&&J(r5.av)==='[]','5: compHi devolve o 10x15 do servidor: '+J(r5));
  ok(gi.length===1&&gi[0].v===SRV.versao,'5: a impressão pede a mesma versão da prévia: '+J(gi));
  const pr=await pg.evaluate(async id=>{const res=await ETERNA.printMontar([{t:'ai',id:'ag_'+id,bg:'mirantedia',k:'ai:ag_'+id+'|mirantedia'}]);const im=document.querySelector('#print-root img');
    const o={ok:res.ok,falhas:res.falhasIA,w:im&&im.naturalWidth,h:im&&im.naturalHeight,fundo:im&&im.dataset.fundo};document.getElementById('print-root')?.remove();return o;},b1);
  ok(pr.ok.length===1&&pr.w===1844&&pr.h===1240&&pr.fundo==='servidor','5: #print-root com a montagem do servidor em 1844x1240: '+J(pr));
  // versão trocada no meio: 409 com a versão antiga, pede a atual
  SRV.versao='99887766';
  const r5b=await pg.evaluate(async id=>{const r=await ETERNA.compHi('ag_'+id,'mirantedia');return {ok:!!r.url,v:r.versao};},b1);
  ok(r5b.ok&&r5b.v==='99887766','5: versão trocada (409): a impressão sai com a versão atual: '+J(r5b));
  // servidor fora na impressão: falha a foto de IA, sem canvas
  SRV.i[b2+'|mirantedia']=503;const c5=await conta();
  const r5c=await pg.evaluate(async id=>{const res=await ETERNA.printMontar([{t:'ai',id:'ag_'+id,bg:'mirantedia',k:'ai:ag_'+id+'|mirantedia'}]);document.getElementById('print-root')?.remove();return res.falhasIA;},b2);
  ok(r5c.length===1&&(await conta()).canvas===c5.canvas,'5: servidor fora na impressão: a foto de IA falha, sem canvas: '+J(r5c));
  // ---- 6. fundo que o servidor não monta: fora da venda (ligada)
  SRV.montaveis=TODOS.filter(f=>f!=='tunel');
  ok(await espera(()=>!ETERNA.mtgFundo('tunel'),8000),'6: o /status novo chegou');
  const r6=await pg.evaluate(()=>ETERNA.lojaAI('LPMTGSRV1').map(x=>x.bg));
  ok(J(r6)===J(['mirantedia','arq1950','telao']),'6: o túnel sai da venda quando o servidor não sabe montá-lo: '+J(r6));
  SRV.montaveis=TODOS;await espera(()=>ETERNA.mtgFundo('tunel'),8000);
  // ---- 7. foto de exemplo: nada pedido
  const g7=SRV.get.length;const r7=await pg.evaluate(async()=>ETERNA.compose('ex_123','mirantedia'));
  ok(r7.pending==='exemplo'&&SRV.get.length===g7,'7: foto de exemplo não pede nada ao servidor: '+J(r7));
  // ---- 8. chave em sombra: volta ao canvas em até 2 leituras do /status; agente antigo: canvas
  const n8=SRV.statusN;SRV.modo='sombra';
  ok(await espera(()=>!ETERNA.mtgSrv(),8000)&&SRV.statusN-n8<=3,'8: em sombra o app deixa de ler o servidor em até 2 leituras: '+(SRV.statusN-n8));
  ok(await pg.evaluate(()=>!ETERNA.COMPURL[Object.keys(ETERNA.COMPURL)[0]]||Object.keys(ETERNA.COMPURL).length===0),'8: a troca da chave limpa as montagens guardadas');
  const c8=await conta();const g8=SRV.get.length;await pg.evaluate(async id=>ETERNA.compose('ag_'+id,'telao'),b1);
  ok((await conta()).canvas===c8.canvas+1&&SRV.get.length===g8,'8: em sombra o compose volta ao fiaMontar (canvas)');
  SRV.modo='ligada';SRV.imprime=false;await pg.waitForTimeout(3000);
  ok(await pg.evaluate(()=>!ETERNA.mtgSrv()),'8: agente sem montagem.imprime (antigo) com "ligada": canvas, como sempre');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e.message).slice(0,600));}
finally{await b.close();}
if(fails.length){console.log('FALHA montagem-servidor-checkout: '+fails.length+' · '+fails.slice(0,10).join(' · '));process.exit(1);}
console.log('OK montagem-servidor-checkout (ligada: Checkout com as montagens do servidor, fila, servidor fora sem canvas, 404, impressão 10x15 com a versão, fundo fora do servidor, exemplo, sombra e agente antigo voltam ao canvas)');
})();
