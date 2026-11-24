// 24/11: o campo de observação do Treino (aba Marcar) tem id por foto (tr-obs-<pid>) e data-keep. Um render() no meio da digitação
// (volta do trEnviar, agentPoll) não tira o foco do campo, então as letras seguem no texto e não viram atalho (P, N, D, G, S, X…);
// e a observação de uma foto não passa para a próxima. Agente falso por page.route (como no treino-claro.js); fotos de 1 pixel.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const DIA='2026-11-23';const PIDS=Array.from({length:3},(_,i)=>(0xabc000000000+i+1).toString(16));
const ITENS=PIDS.map((p,i)=>({pid:p,card:'LPOB0000',fotografo:'carlos',t:Date.parse(DIA+'T13:00:00Z')/1000+i*20,ordem:i+1,n_sessao:3,rostos:1,rotulo:null}));
const espera=async(pg,fn,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
(async()=>{const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1280,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const posts=[];const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bO',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gO',hoje:0,abertas:0},
    treino:{v:1,rotulos:0,analise:{ponto:'medir',exposicao:'medir'},ajuste:null,modelo_ponto:{v:1,pronto:true,erro:null,congelados:null,provedor:'cpu',modelo:'clip-b32',versao:'v-teste',ligada_versao:null,abaixo:null,aviso:null,fila:0,feitas_hoje:0,ms_medio:10,criterio_passa:false}}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'gO',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]}));
  await ctx.route(ORIG+'/fila-fotografo',r=>js(r,{ok:true,grupos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs?*',r=>js(r,{ok:true,docs:[]}));
  await ctx.route(ORIG+'/ponto/docs',r=>js(r,{ok:true,gravados:0,recusados:0}));
  await ctx.route(ORIG+'/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  await ctx.route(ORIG+'/file/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:PX}));
  await ctx.route(ORIG+'/fotografos/**',r=>js(r,{ok:false,error:'sem'},404));
  await ctx.route(ORIG+'/treino/dias',r=>js(r,{v:1,dias:[{dia:DIA,fotos:3,sessoes:1,rotuladas:0}]}));
  await ctx.route(ORIG+'/treino/medida?*',r=>js(r,{v:1,classes:[],rotulos:{},metas:{},faltam:{},n:0,matriz:{},classe:{},sinais:{},erros:[],criterio:{passa:false,falta:[]},modelo_ok:true}));
  await ctx.route(ORIG+'/treino/amostra?*',r=>{const q=new URL(r.request().url()).searchParams;js(r,{v:1,dia:q.get('dia'),modo:q.get('modo'),semente:'abc',total_dia:3,itens:ITENS});});
  await ctx.route(ORIG+'/treino/rotulo',r=>{const o=r.request().postDataJSON();posts.push(o);js(r,{ok:true,doc:Object.assign({v:1,dia:DIA,fotografo:'carlos',por:'quem',em:'2026-11-24T11:00:00.00'+posts.length,origem:'mao',lote:null},o)});});
  await ctx.route(ORIG+'/treino/config',r=>js(r,{ok:false,error:'so_admin'},403));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.waitForTimeout(300);const email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);
  await espera(pg,()=>ETERNA.state.agent.on&&ETERNA.state.agent.treino);
  await pg.evaluate(()=>{ETERNA.state.train.aba='marcar';ETERNA.go('treino');});await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
  await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===3&&!ETERNA.state.train.carregando);await pg.waitForTimeout(150);
  const id0='tr-obs-'+PIDS[0],id1='tr-obs-'+PIDS[1];
  const est=()=>pg.evaluate(([p,id])=>{const r=ETERNA.state.train.rasc[p]||{};const a=document.activeElement;const el=document.getElementById(id);
    return {foco:a?a.id:'',val:el?el.value:null,sel:a&&a.selectionStart,ponto:r.ponto||null,nivel:r.nivel||null,duvida:!!r.duvida,serve:r.serve==null?null:r.serve,obs:r.obs||'',j:ETERNA.state.train.j};},[PIDS[0],id0]);
  // 1: o campo tem id por foto e data-keep
  ok(await pg.$eval('[data-act="tr-obs"]',(x,id)=>x.id===id&&x.hasAttribute('data-keep'),id0),'1: tr-obs com id tr-obs-<pid> e data-keep');
  // 2: digita, redesenha a tela, continua digitando: o foco fica no campo e as letras não viram atalho
  await pg.click('[data-act="tr-obs"]');await pg.keyboard.type('luz ');
  await pg.evaluate(()=>ETERNA.render());
  {const e=await est();ok(e.foco===id0&&e.val==='luz '&&e.sel===4,'2: depois do render() o foco e o cursor continuam no campo: '+J(e));}
  await pg.keyboard.type('pndgsxa');
  await pg.evaluate(()=>ETERNA.render());await pg.keyboard.type('z');await pg.evaluate(()=>ETERNA.render());
  {const e=await est();ok(e.foco===id0&&e.val==='luz pndgsxaz'&&e.obs==='luz pndgsxaz','2: as letras seguem no texto: '+J(e));
    ok(e.ponto===null&&e.nivel===null&&!e.duvida&&e.serve===null&&e.j===0,'2: nenhuma letra virou atalho (ponto, qualidade, dúvida, pergunta 3, foto): '+J(e));}
  ok(!(await pg.$('[data-act="tr-ia"]')),'2: G digitado no campo não marcou Gramado');
  // 3: a observação de uma foto não passa para a próxima
  await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(200);
  {const v=await pg.evaluate(([a,b])=>{const x=document.getElementById(b);return {velho:!!document.getElementById(a),novo:x?x.value:null,foco:(document.activeElement||{}).id||''};},[id0,id1]);
    ok(!v.velho&&v.novo===''&&v.foco!==id1,'3: a foto 2 abre com o campo vazio e sem o foco herdado: '+J(v));}
  await pg.click('[data-act="tr-obs"]');await pg.keyboard.type('ok');await pg.evaluate(()=>ETERNA.render());
  ok(await pg.evaluate(id=>document.activeElement&&document.activeElement.id===id&&document.activeElement.value==='ok',id1),'3: na foto 2 o foco também sobrevive ao render()');
  await pg.click('[data-act="tr-prev"]');await pg.waitForTimeout(200);
  ok(await pg.evaluate(id=>{const x=document.getElementById(id);return !!x&&x.value==='luz pndgsxaz';},id0),'3: voltar à foto 1 mostra a observação dela');
  ok(!errs.length,'sem erro de página: '+errs.join(' | '));
  await b.close();
  if(fails.length){console.log('FALHA treino-obs-foco: '+fails.join(' | '));process.exit(1);}
  console.log('OK treino-obs-foco: foco no campo de observação sobrevive ao render(), letras não viram atalho, observação fica em cada foto');
})().catch(e=>{console.log('FALHA treino-obs-foco: '+e.message);process.exit(1);});
