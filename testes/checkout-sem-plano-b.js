// 18/11 (plano "bases dos fundos de IA só com foto do gramado", fatia A; Eduardo D1: sem plano B). Critérios do app:
//  1. sessão fechada pelo servidor com ia=[] e fotos reais ag_ com gente: lojaItems sem nenhum item t:'ai'; o Checkout abre
//     direto nas fotos, sem o "Suas fotos especiais";
//  2. com ia preenchida: uma montagem por fundo de bgOn(), com a base de FIA_BASE (as mesmas de antes);
//  3. com FIA_ANTIGO_ON=true, lojaAI devolve o mesmo que o jeito antigo (lojaAIAntigo) para a mesma sessão;
//  4. venda já paga com montagem continua na impressão (impFotos);
//  5. cf_ia_sem_escala e up_iam_sem_ponto têm 5 textos e nenhum fala em "duas primeiras fotos do cliente".
// Agente falso (page.route). Nenhuma foto de convidado: quadrados de cor e uma silhueta desenhada na hora.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const [JPG,SIL]=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(300,200),(60,110,150));d=ImageDraw.Draw(im);d.ellipse([120,30,180,90],fill=(230,200,170));d.rectangle([100,95,200,200],fill=(30,60,120))
b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())
s=Image.new('RGBA',(1600,2400),(0,0,0,0));d=ImageDraw.Draw(s);d.ellipse([650,200,950,520],fill=(230,200,170,255));d.rectangle([520,520,1080,2399],fill=(30,60,140,255))
b=io.BytesIO();s.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const hoje=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const a=Date.now()/1000;
const ids=(p,n)=>Array.from({length:n},(_,i)=>p+String(i+1).padStart(9,'0'));
const ses=(card,fotos,t0,rev,x)=>({card,dia:hoje,fotografo:'yago',fonte:'ftp',ponto:null,funcao:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0,ultima_chegada:t0+50,cap0:t0-2,cap1:t0+48,fonte_t:'cap',fechada_em:t0+110,fechada_por:'pausa',fotos,pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev,ia:[],ia_regra:null,...x});
const SEM=ids('a1a',6),COM=ids('b2b',8);
const FEED=[ses('LPSEMGRA1',SEM,a-900,1,{ia:[],ia_regra:{n:2,motivo:'sem_gramado'}}),
  ses('LPCOMGRA2',COM,a-600,2,{ia:COM.slice(1,3),ia_regra:{n:2,motivo:null}})];
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,agent:'eterna-agente',version:3,boot:'bA',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},
    sessoes:{v:2,pausa:60,rostos:true,rev:2,gen:'bA',hoje:2,abertas:0,dias:1},recorte:{ok:true,carregado:true,feitos:4,ms_medio:900,fila:0,ia:{ligada:true,fila:0,feitos:4,erros:0}},fundos_modo:'local'})}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  await ctx.route(ORIG+'/biblioteca',r=>r.fulfill({status:200,contentType:'application/json',body:'{"fotos":[]}'}));
  await ctx.route(ORIG+'/sessoes*',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,gen:'bA',rev:2,pausa:60,rostos:true,completo:true,sessoes:FEED})}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:JPG}));
  await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:200,contentType:'image/png',body:SIL}));
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');
  const espera=async(fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn))return true;await pg.waitForTimeout(150);}return false;};
  ok(await espera(()=>window.ETERNA&&['LPSEMGRA1','LPCOMGRA2'].every(c=>ETERNA.SIM.sessions[c]),20000),'as sessões do servidor chegaram ao SIM');
  await pg.evaluate(()=>{const S=ETERNA.SIM;S.invalid={};Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>delete p.invalid));ETERNA.state.agent.recorte={ok:true,carregado:true};});
  ok(await pg.evaluate(()=>ETERNA.FIA_ANTIGO_ON===false),'a chave do jeito antigo nasce desligada');
  // 1. sem bases: nada de montagem
  const r1=await pg.evaluate(()=>{const its=ETERNA.lojaItems('LPSEMGRA1');return {ai:its.filter(x=>x.t==='ai').length,ph:its.filter(x=>x.t==='ph').length,lojaAI:ETERNA.lojaAI('LPSEMGRA1').length};});
  ok(r1.ai===0&&r1.lojaAI===0&&r1.ph===6,'1: sem bases do servidor, nenhuma montagem e as 6 fotos à venda: '+J(r1));
  await pg.evaluate(()=>{const k=ETERNA.state.kiosk;k.code='LPSEMGRA1';k.so=null;k.step='review';k.i=0;ETERNA.render();});
  await pg.waitForTimeout(400);
  const tela=await pg.evaluate(()=>({edh:!!document.querySelector('.lj-edh'),txt:document.body.innerText.includes(ETERNA.T('edTitulo'))}));
  ok(!tela.edh&&!tela.txt,'1: o Checkout abre direto nas fotos, sem o "Suas fotos especiais": '+J(tela));
  // 2. com bases: uma por fundo, a base certa
  const r2=await pg.evaluate(()=>{const its=ETERNA.lojaAI('LPCOMGRA2');const on=ETERNA.bgOn();const ia=ETERNA.SIM.sessions.LPCOMGRA2.ia;
    return {n:its.length,on:on.length,certas:its.every(x=>x.id===ia[Math.min(x.bg in ETERNA.FIA_BASE?ETERNA.FIA_BASE[x.bg]:1,ia.length-1)]),fora:ETERNA.lojaItems('LPCOMGRA2').filter(x=>x.t==='ph'&&ia.includes(x.id)).length};});
  ok(r2.n===r2.on&&r2.n>0&&r2.certas&&r2.fora===0,'2: uma montagem por fundo de bgOn com a base de FIA_BASE, as bases fora da venda: '+J(r2));
  // D4b: as duas bases barradas pela validação (olhos fechados) continuam como última alternativa
  const r2b=await pg.evaluate(()=>{const ia=ETERNA.SIM.sessions.LPCOMGRA2.ia;ia.forEach(id=>ETERNA.SIM.invalid[id]='olhos fechados');const n=ETERNA.lojaAI('LPCOMGRA2').length;ia.forEach(id=>delete ETERNA.SIM.invalid[id]);return n;});
  ok(r2b===r2.on,'2: base com olhos fechados segue como última alternativa (D4b): '+r2b);
  // 3. com a chave ligada, o jeito antigo de antes
  const r3=await pg.evaluate(()=>{ETERNA.FIA_ANTIGO_ON=true;const novo=ETERNA.lojaAI('LPSEMGRA1');const igual=JSON.stringify(novo.map(x=>[x.id,x.bg,x.k]));
    const k=ETERNA.lojaItems('LPSEMGRA1').filter(x=>x.t==='ai').length;ETERNA.FIA_ANTIGO_ON=false;return {n:novo.length,igual,k,on:ETERNA.bgOn().length,depois:ETERNA.lojaAI('LPSEMGRA1').length};});
  const ant=await pg.evaluate(()=>{ETERNA.FIA_ANTIGO_ON=true;const x=JSON.stringify(ETERNA.lojaAI('LPSEMGRA1').map(y=>[y.id,y.bg,y.k]));ETERNA.FIA_ANTIGO_ON=false;return x;});
  ok(r3.n===r3.on&&r3.k===r3.on&&r3.igual===ant&&r3.depois===0,'3: FIA_ANTIGO_ON=true devolve o jeito antigo (uma por fundo com as 2 primeiras); desligada de novo, nada: '+J(r3));
  // 4. venda já paga com montagem continua na impressão
  const r4=await pg.evaluate(()=>{const s=ETERNA.SIM.sessions.LPSEMGRA1;const ph=s.photos?s.photos[0].id:'ag_a1a000000001';
    const imp=ETERNA.impFotos({status:'paga',selected:[],aiSel:[ph+'|mirantedia'],prints:3});return imp.todas.filter(x=>x.t==='ai').map(x=>x.id+'|'+x.bg);});
  ok(r4.length===1&&/\|mirantedia$/.test(r4[0]),'4: montagem paga continua na impressão: '+J(r4));
  // 5. textos
  const r5=await pg.evaluate(()=>['cf_ia_sem_escala','up_iam_sem_ponto'].map(k=>({k,n:(ETERNA.EQ[k]||[]).filter(x=>typeof x==='string'&&x.trim()).length,velho:(ETERNA.EQ[k]||[]).some(x=>/duas primeiras fotos do cliente|first two photos|dos primeras fotos|deux premières photos|ersten zwei Fotos/i.test(x))})));
  ok(r5.every(x=>x.n===5&&!x.velho),'5: textos novos nas 5 línguas, sem as "duas primeiras fotos": '+J(r5));
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' checkout-sem-plano-b: sem bases do servidor, nada de montagem; com bases, as mesmas; FIA_ANTIGO_ON devolve o jeito antigo; venda paga imprime; textos'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);})();
