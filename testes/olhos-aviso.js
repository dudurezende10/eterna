// 16/11 (Eduardo): olho fechado é só aviso. A foto com SIM.invalid "olhos fechados" aparece no Checkout e pode ser vendida;
// sessão com todas assim abre pelo código e pela selfie; Minhas fotos mostra o aviso (5 línguas) sem apagar a miniatura;
// foto descartada continua fora; entre duas bases de IA, a de olhos abertos continua preferida.
// Sem agente e sem foto de cliente: miniaturas são um GIF de 1 px.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;
const MINI='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
(async()=>{
const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:800},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');await pg.waitForTimeout(500);
  await pg.evaluate(m=>{const S=ETERNA.SIM;const base={key:null,pdv:'',time:'10:00',date:'hoje',status:'fechada',selected:[],bg:null,cart:[],closedAt:new Date().toISOString()};
    const fotos=(p,n)=>Array.from({length:n},(_,i)=>({id:'ag_'+p+String(i+1).padStart(9,'0'),sold:0}));
    S.sessions.LPOLHO001=Object.assign({},base,{photos:fotos('olh',3)});
    S.sessions.LPOLHO002=Object.assign({},base,{photos:fotos('tod',2)});
    S.sessions.LPOLHO003=Object.assign({},base,{photos:fotos('dsc',2)});
    S.sessions.LPOLHO004=Object.assign({},base,{photos:fotos('iaa',4),ia:['ag_iaa000000001','ag_iaa000000002']});
    S.invalid=Object.assign(S.invalid||{},{ag_olh000000002:'olhos fechados',ag_tod000000001:'olhos fechados',ag_tod000000002:'olhos fechados',ag_dsc000000001:'olhos fechados'});
    S.discarded=Object.assign(S.discarded||{},{ag_dsc000000001:true,ag_dsc000000002:true,ag_olh000000003:true});
    Object.values(S.sessions).forEach(s=>(s.photos||[]).forEach(p=>{ETERNA.UP[p.id]={src:m,name:p.id};}));
    ETERNA.lojaCodReset();},MINI);
  // 1) a foto com olhos fechados está à venda; a descartada não
  const s1=await pg.evaluate(()=>{const o=ETERNA.demoSessions().find(x=>x.card==='LPOLHO001');return o?o.photos.map(p=>p.id):null;});
  ok(s1&&s1.includes('ag_olh000000002')&&s1.includes('ag_olh000000001'),'foto com olhos fechados aparece na sessão do Checkout: '+J(s1));
  ok(s1&&!s1.includes('ag_olh000000003'),'foto descartada continua fora: '+J(s1));
  const its=await pg.evaluate(()=>ETERNA.lojaItems('LPOLHO001').filter(x=>x.t!=='ai').map(x=>x.id));
  ok(its.includes('ag_olh000000002'),'foto com olhos fechados entre os itens do Checkout (pode ser vendida): '+J(its));
  // 2) sessão com todas as fotos de olhos fechados abre pelo código
  const abreCod=async c=>{await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.fill('#kcode',c);await pg.click('[data-act="kiosk-go"]');await pg.waitForTimeout(400);};
  await abreCod('LPOLHO002');
  const st=await pg.evaluate(()=>({step:ETERNA.state.kiosk.step,code:ETERNA.state.kiosk.code,toast:(document.querySelector('#toast')||{}).textContent||''}));
  ok(st.code==='LPOLHO002'&&st.step!=='emerg'&&!/não encontrado/i.test(st.toast),'sessão com todas de olhos fechados abre pelo código: '+J(st));
  const fotosCod=await pg.evaluate(()=>ETERNA.lojaItems('LPOLHO002').filter(x=>x.t!=='ai').map(x=>x.id));
  ok(fotosCod.length===2,'as duas fotos de olhos fechados no Checkout: '+J(fotosCod));
  // 3) pela selfie (lojaJuntar com o resultado da busca)
  const sf=await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='code';const r=ETERNA.lojaJuntar([{card:'LPOLHO002',fotos:['ag_tod000000001','ag_tod000000002'],sim:.9}]);const k=ETERNA.state.kiosk;return {r,code:k.code,so:k.so&&k.so.ids,step:k.step};});
  ok(sf.r&&sf.code==='LPOLHO002'&&sf.so&&sf.so.length===2,'sessão com todas de olhos fechados abre pela selfie: '+J(sf));
  // 4) sessão com todas descartadas: não abre (o descarte segue valendo)
  await pg.evaluate(()=>ETERNA.lojaCodReset());await abreCod('LPOLHO003');
  const st3=await pg.evaluate(()=>({step:ETERNA.state.kiosk.step,toast:(document.querySelector('#toast')||{}).textContent||''}));
  ok(st3.step==='emerg'&&/não encontrado/i.test(st3.toast),'sessão com todas descartadas continua fora: '+J(st3));
  // 5) base de IA: a de olhos abertos continua preferida
  const ai=await pg.evaluate(()=>{const a=ETERNA.state.agent;a.on=true;a.recorte={ok:true,carregado:true};const S=ETERNA.SIM;
    S.invalid.ag_iaa000000002='olhos fechados';const x=ETERNA.lojaAI('LPOLHO004').map(i=>i.id);
    delete S.invalid.ag_iaa000000002;S.invalid.ag_iaa000000001='olhos fechados';const y=ETERNA.lojaAI('LPOLHO004').map(i=>i.id);
    S.invalid.ag_iaa000000002='olhos fechados';const z=ETERNA.lojaAI('LPOLHO004').map(i=>i.id);
    delete S.invalid.ag_iaa000000001;delete S.invalid.ag_iaa000000002;a.on=false;return {x,y,z};});
  ok(ai.x.length>0&&ai.x.every(i=>i==='ag_iaa000000001'),'base 2 de olhos fechados: todas as montagens na base 1: '+J(ai.x));
  ok(ai.y.length>0&&ai.y.every(i=>i==='ag_iaa000000002'),'base 1 de olhos fechados: todas as montagens na base 2: '+J(ai.y));
  ok(ai.z.length>0,'as duas de olhos fechados: ainda há montagem (jeito antigo ou última alternativa): '+J(ai.z));
  // 6) textos do aviso nas 5 línguas, sem travessão
  const tx=await pg.evaluate(()=>ETERNA.LANGS.map(([l])=>{const i=ETERNA.LANGS.findIndex(x=>x[0]===l);return ['mf_aviso_olhos','mf_val_ok'].map(k=>ETERNA.EQ[k][i]).concat([ETERNA.EQ.mf_val_aviso[i](2),ETERNA.EQ.mf_val_t[i]('LP1',3)]);}));
  ok(tx.length===5&&tx.every(r=>r.every(t=>t&&!/[—–]/.test(t)))&&new Set(tx.map(r=>r[0])).size===5,'aviso nas 5 línguas, sem travessão: '+J(tx));
  ok(tx[0][2].includes('Seguem à venda')&&!/barrou|fora da fila/i.test(tx.flat().join(' ')),'a validação avisa e não barra: '+tx[0][2]);
  // 7) Minhas fotos: etiqueta de aviso, miniatura sem apagar (sem data-off)
  // (outra aba: a aba do Checkout nunca entra logada)
  const pg2=await ctx.newPage();pg2.on('pageerror',e=>errs.push(e.message));await pg2.goto(U);await pg2.waitForTimeout(300);
  const adm=await entrarTeste.adminFicticio(pg2);await entrarTeste(pg2,adm);
  for(const [l,i] of [['pt',0],['en',1],['fr',3]]) /* a equipe escolhe entre pt, en, es e fr; as 5 línguas estão no passo 6 */{
    const mf=await pg2.evaluate(([m,l])=>{const E=ETERNA;E.idiomaEquipe&&E.idiomaEquipe(l);E.state.agent.on=false;E.state.agent.sessoes=null;
      E.UP.ag_mfa000000001={src:m,name:'a'};E.UP.ag_mfa000000002={src:m,name:'b'};
      E.state.ing.done=[{card:'LPMF00001',n:2,how:'teste',flag:null,photos:[{id:'ag_mfa000000001',invalid:'olhos fechados'},{id:'ag_mfa000000002'}]}];
      E.go('importar');E.render();const bs=[...document.querySelectorAll('#main .photos.small .ph')].filter(x=>x.innerHTML.includes('ag_mfa')||(x.getAttribute('style')||'').includes('data:image'));
      const all=[...document.querySelectorAll('#main .photos.small .ph')];return all.map(x=>({off:x.getAttribute('data-off'),aviso:x.getAttribute('data-aviso'),tag:(x.querySelector('.tag')||{}).textContent||''}));},[MINI,l]);
    const esp=await pg2.evaluate(i=>ETERNA.EQ.mf_aviso_olhos[i],i);
    const comAviso=mf.filter(x=>x.aviso==='1');
    ok(comAviso.length===1&&comAviso[0].tag===esp&&mf.every(x=>x.off!=='1'),'Minhas fotos ('+l+'): aviso "'+esp+'" sem apagar a miniatura: '+J(mf));
  }
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+e.message);}
await b.close();
console.log((fails.length?'FALHA':'OK')+' olhos-aviso: olho fechado é só aviso, a foto segue no Checkout'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);
})();
