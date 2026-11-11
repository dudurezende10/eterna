// v97 (Revisor, 10/11): Separar no Posto mexe só no pedido do botão. Duas famílias com pedidos abertos que têm fotos da
// mesma leva B: Separar B no pedido de Y tira as fotos de B só de Y; o pedido de X fica igual. Gravação que falha desfaz.
// Sessões de demonstração do próprio app (sem foto de convidado), sem agente.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{
const b=await chromium.launch();const errs=[];
try{
  const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await require('./_login.js')(pg);
  const r=await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;const ses=E.demoSessions().filter(s=>(s.photos||[]).length>=2).slice(0,3);if(ses.length<3)return {erro:'poucas sessões de demonstração'};
    const [A,B,C]=ses;const ids=s=>s.photos.map(p=>p.id);
    const ped=(id,cod,cards,fotos)=>({id,codigo:cod,estado:'escolha',escolha:true,card:cards[0],sessoes:cards,selected:fotos,aiSel:[],fav:[],n:fotos.length,pkg:'p3',cart:[{x:1}],total:99,prints:null,at:new Date().toISOString()});
    const X=ped('pX','X01',[A.card,B.card],[...ids(A).slice(0,2),...ids(B).slice(0,2)]);
    const Y=ped('pY','Y01',[C.card,B.card],[...ids(C).slice(0,2),...ids(B).slice(0,1)]);
    S.caixaDin=[X,Y];localStorage.setItem('eterna.sim.v1',JSON.stringify(S));
    const xAntes=JSON.stringify(X);
    const n=E.pendTiraLeva(B.card,'pY');
    const S2=E.SIM;const x2=S2.caixaDin.find(p=>p.id==='pX'),y2=S2.caixaDin.find(p=>p.id==='pY');
    const gravado=JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(p=>p.id==='pY');
    // gravação que falha: desfaz o pedido
    const Z=ped('pZ','Z01',[A.card,B.card],[...ids(A).slice(0,1),...ids(B).slice(0,2)]);S2.caixaDin.push(Z);localStorage.setItem('eterna.sim.v1',JSON.stringify(S2));
    const set0=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='eterna.sim.v1')throw new Error('cheio');return set0.call(this,k,v);};
    let nf;try{nf=E.pendTiraLeva(B.card,'pZ');}finally{Storage.prototype.setItem=set0;}
    const z2=E.SIM.caixaDin.find(p=>p.id==='pZ');
    return {n,xIgual:JSON.stringify(x2)===xAntes,y:{sel:y2.selected,ses:y2.sessoes,pkg:y2.pkg,n:y2.n},semB:y2.selected.every(i=>!ids(B).includes(i)),yC:ids(C).slice(0,2).every(i=>y2.selected.includes(i)),
      gravado:gravado&&gravado.selected.length===2,nf,zIgual:z2&&z2.selected.length===3&&z2.pkg==='p3'};});
  ok(!r.erro,r.erro);
  ok(r.n===1&&r.semB&&r.yC&&r.y.pkg===null&&r.y.n===2&&!r.y.ses.includes(undefined),'Y perde só as fotos da leva B: '+J(r));
  ok(r.xIgual,'o pedido de X não muda: '+J(r));
  ok(r.gravado,'o pedido de Y foi gravado no SIM');
  ok(r.nf===-1&&r.zIgual,'gravação que falha desfaz o pedido: '+J({nf:r.nf,z:r.zIgual}));
  // item 6: bases reabertas pelo servidor entram no app, a não ser que alguma já esteja vendida ou num pedido aberto
  const ia=await pg.evaluate(()=>{const E=ETERNA,S=E.SIM;S.caixaDin=[];const mk=(card,n)=>({card,srv:true,status:'fechada',ia:[],photos:Array.from({length:n},(_,i)=>({id:'ag_'+card.toLowerCase()+i}))});
    S.sessions.LPREAB01=mk('LPREAB01',5);S.sessions.LPREAB02=mk('LPREAB02',5);S.sessions.LPREAB03=mk('LPREAB03',5);
    S.sessions.LPVEND01={card:'LPVEND01',status:'paga',selected:['ag_lpreab020'],photos:[]};
    S.caixaDin=[{id:'pW',estado:'escolha',escolha:true,selected:['ag_lpreab031']}];
    const x=(c,re)=>({card:c,ia:[c.toLowerCase()+'0',c.toLowerCase()+'1'],ia_regra:re});
    E.srvIaCompleta(x('LPREAB01',{n:2,motivo:null,reaberta:'separar'}));E.srvIaCompleta(x('LPREAB02',{n:2,motivo:null,reaberta:'separar'}));
    E.srvIaCompleta(x('LPREAB03',{n:2,motivo:null,reaberta:'separar'}));
    S.sessions.LPREAB04=mk('LPREAB04',5);E.srvIaCompleta(x('LPREAB04',{n:2,motivo:null}));
    return [1,2,3,4].map(i=>(S.sessions['LPREAB0'+i].ia||[]).length);});
  ok(J(ia)===J([2,0,0,0]),'6: bases reabertas entram; vendida, em pedido aberto ou sem "reaberta" não: '+J(ia));
  const src=await pg.evaluate(()=>document.documentElement.innerHTML.includes("pendTiraLeva(c,d.id)"));
  ok(src,'o Separar do Posto passa o id do pedido');
}catch(e){fails.push('exceção: '+e.message);}
await b.close();
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA visitas-separar-pedido: '+fails.join(' | '));process.exit(1);}
console.log('OK visitas-separar-pedido: Separar mexe só no pedido do botão, o outro pedido aberto fica igual, gravação que falha desfaz');
})();
