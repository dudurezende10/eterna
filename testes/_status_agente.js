// /status de um agente que não monta (sem `montagem`): desde a revisão da E2 da montagem no servidor o navegador só monta no
// canvas com o modo do servidor conhecido nesta página (mtgCanvasOk); sem nenhum /status respondido, nada é montado.
// Uso: await statusSemMontagem(ctx, ORIG, pg) — roteia /status e /events e espera o ETERNA.mtgCanvasOk() (pg opcional).
module.exports=async function statusSemMontagem(ctx,ORIG,pg,extra){
  await ctx.route(ORIG+'/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(Object.assign({ok:true,agent:'eterna-agente',version:3,boot:'bT',card:null,copied:0,dups:0,events:0,recorte:{ok:true,carregado:true},fundos_modo:'local'},extra||{}))}));
  await ctx.route(ORIG+'/events*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"events":[],"next":0,"total":0}'}));
  if(pg)await pg.waitForFunction(()=>window.ETERNA&&ETERNA.mtgCanvasOk&&ETERNA.mtgCanvasOk(),null,{timeout:20000});};
