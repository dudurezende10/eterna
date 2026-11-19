// 18/11 (plano "bases dos fundos de IA só com foto do gramado", fatia C, lado do app): critérios 30 (a sessão que fechou com
// cena_pendente ganha as bases depois, reaberta "cena", e o app adota; base em pedido aberto barra), 34 (bases fora da venda,
// como montagens) e 35 (pílulas novas do Upload nas 5 línguas), e o D8 novo: foto de corpo inteiro que encosta embaixo com as
// pernas inteiras vira do joelho para cima na montagem (joelho do MoveNet no tEXt "eterna" do PNG do recorte, fiaPngInfo e
// fiaJoelho). Agente falso por page.route; silhueta desenhada na hora, nenhuma foto de convidado.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
// corpo inteiro: cabeça, tronco e pernas até a borda de baixo (1600 × 2400); com e sem o tEXt do joelho (70% da altura)
const [JPG,SIL_J,SIL]=execFileSync('python3',['-c',`
import io,base64,json
from PIL import Image,ImageDraw
from PIL.PngImagePlugin import PngInfo
im=Image.new('RGB',(300,200),(40,140,50));b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
s=Image.new('RGBA',(1600,2400),(0,0,0,0));d=ImageDraw.Draw(s);d.ellipse([700,100,900,320],fill=(230,200,170,255));d.rectangle([600,320,1000,1300],fill=(30,60,140,255));d.rectangle([620,1300,780,2399],fill=(20,20,40,255));d.rectangle([820,1300,980,2399],fill=(20,20,40,255))
p=PngInfo();p.add_text('eterna',json.dumps({'v':1,'joelho':0.7,'pernas':True}))
b=io.BytesIO();s.save(b,'PNG',pnginfo=p);print(base64.b64encode(b.getvalue()).decode())
b=io.BytesIO();s.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
const ses=(card,fotos,t0,rev,x)=>({card,dia:hoje,fotografo:'yago',fonte:'ftp',ponto:null,funcao:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev,ia:[],ia_regra:null,...x});
const P=ids('c3c',6),Q=ids('d4d',6);
let FEED=[ses('LPPENDE01',P,a-900,1,{ia:[],ia_regra:{n:2,motivo:'cena_pendente'}}),ses('LPPENDE02',Q,a-800,2,{ia:[],ia_regra:{n:2,motivo:'cena_pendente'}})];let REV=2;
let JOELHO=true;
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bC',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
    sessoes:{v:2,pausa:60,rostos:true,rev:REV,gen:'bC',hoje:2,abertas:0,dias:1},recorte:{ok:true,carregado:true,feitos:4,ms_medio:900,fila:0,ia:{ligada:true,fila:0,feitos:4,erros:0}},fundos_modo:'local'})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'bC',rev:REV,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:200,contentType:'image/png',body:JOELHO?SIL_J:SIL}));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>window.ETERNA&&['LPPENDE01','LPPENDE02'].every(c=>ETERNA.SIM.sessions[c]),20000),'as sessões do servidor chegaram');
  await pg.evaluate(()=>{ETERNA.SIM.invalid={};ETERNA.state.agent.recorte={ok:true,carregado:true};});
  ok(await pg.evaluate(()=>ETERNA.lojaAI('LPPENDE01').length===0&&ETERNA.lojaItems('LPPENDE01').filter(x=>x.t==='ph').length===6),'pendente: sem montagem e as 6 fotos à venda');
  // 30: o servidor preenche (reaberta cena): o app adota; base num pedido aberto barra
  await pg.evaluate(([p,q])=>{ETERNA.SIM.caixaDin=(ETERNA.SIM.caixaDin||[]).concat([{id:'pd-teste',estado:'aguardando',selected:['ag_'+q[1]],card:'LPPENDE02',t:Date.now()}]);},[P,Q]);
  FEED=[ses('LPPENDE01',P,a-900,3,{ia:[P[2],P[3]],ia_regra:{n:2,motivo:null,reaberta:'cena'}}),ses('LPPENDE02',Q,a-800,4,{ia:[Q[1],Q[4]],ia_regra:{n:2,motivo:null,reaberta:'cena'}})];REV=4;
  await pg.evaluate(async()=>{ETERNA.SRV.rev=0;await ETERNA.srvPull(true);});
  const r30=await pg.evaluate(()=>({p:ETERNA.SIM.sessions.LPPENDE01.ia,q:ETERNA.SIM.sessions.LPPENDE02.ia,
    fotos:ETERNA.lojaItems('LPPENDE01').filter(x=>x.t==='ph').map(x=>x.id),ai:ETERNA.lojaAI('LPPENDE01').map(x=>x.id),on:ETERNA.bgOn().length}));
  ok(J(r30.p)===J(['ag_'+P[2],'ag_'+P[3]]),'30: reaberta cena: o app adota as bases de gramado: '+J(r30.p));
  ok(!(r30.q||[]).length,'30: base num pedido aberto: o app não adota: '+J(r30.q));
  ok(r30.fotos.length===4&&!r30.fotos.includes('ag_'+P[2])&&r30.ai.length===r30.on&&r30.on>0,'34: as bases saem da venda e viram montagens: '+J(r30));
  // D8: corpo inteiro encostado embaixo com pernas inteiras = do joelho para cima
  const d8=await pg.evaluate(async(id)=>{const m1=await ETERNA.compose(id,'mirantedia');const L1=m1.layout;
    const info=await ETERNA.fiaPngInfo(await (await fetch('/recorte',{method:'POST',body:'{}'})).blob());
    const c=document.createElement('canvas');c.width=160;c.height=240;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(60,10,40,230);
    const m=ETERNA.fiaMedir(c);const mj=ETERNA.fiaJoelho(m,{joelho:.7,pernas:true}),ms=ETERNA.fiaJoelho(m,{joelho:.7,pernas:false}),mt=ETERNA.fiaJoelho({...m,trunc:false},{joelho:.7,pernas:true});
    return {info,trunc:m.trunc,h:m.box.h,hj:mj.box.h,yj:mj.joelho,sem:ms===m,semTrunc:mt.box.h===m.box.h,srcH:L1&&L1.src.h,corte:L1&&L1.corteFinal};},'ag_'+P[2]);
  ok(d8.info&&d8.info.joelho===0.7&&d8.info.pernas===true,'D8: fiaPngInfo lê o tEXt "eterna" do PNG: '+J(d8.info));
  ok(d8.trunc&&d8.hj<d8.h&&Math.abs(d8.yj-168)<=1&&d8.sem&&d8.semTrunc,'D8: fiaJoelho corta na linha do joelho só com pernas inteiras e encostado embaixo: '+J(d8));
  JOELHO=false;
  const d8b=await pg.evaluate(async(id)=>{const r=await ETERNA.compose(id,'mirantedia');return r.layout&&r.layout.src.h;},'ag_'+P[3]);
  // mesmo recorte (2300 px de silhueta): com o joelho a 70% a caixa vai até 1680 (1580 px); o estreito (regra 20) corta os dois em 74%
  ok(d8.srcH&&d8b&&Math.abs(d8.srcH/d8b-1580/2300)<0.02,'D8: a montagem usa só do joelho para cima; o recorte antigo, sem o joelho, segue como era: '+J({com:d8.srcH,sem:d8b}));
  // 35: pílulas novas nas 5 línguas
  const r35=await pg.evaluate(()=>['cena_desligada','cena_medir','sem_gramado','cena_pendente','cena_indisponivel'].map(k=>({k,m:!!ETERNA.UP_IA_MOTIVO[k],n:(ETERNA.EQ['up_iam_'+k]||[]).filter(x=>typeof x==='string'&&x).length})));
  ok(r35.every(x=>x.m&&x.n===5),'35: pílulas novas do Upload nas 5 línguas: '+J(r35));
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,500));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' gramado-checkout: bases que chegam depois (reaberta cena, pedido aberto barra), bases fora da venda, joelho na montagem (D8), pílulas novas'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
