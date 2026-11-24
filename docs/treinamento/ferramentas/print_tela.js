// Comum aos roteiros de prints dos manuais (capturar.js, capturar-fotos.js): usuário fictício, print com as caixas dos alvos e
// fotos fictícias no lugar das fotos de demonstração (que são de clientes de verdade).
const fs=require('fs');const path=require('path');

module.exports=function(OUT){
  fs.mkdirSync(OUT,{recursive:true});const MARCAS={};
  // perfil pronto do app (PRESETS) ou permissões soltas
  async function usuario(pg,email,nome,perms,preset){await pg.evaluate(([e,n,p,pr])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
    U0[e]={email:e,name:n,active:true,preset:pr||'custom',perms:p,key:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,perms,preset]);await pg.reload();await pg.waitForTimeout(400);}
  // marcas = [[seletor, direção da seta, número]]; recorte = seletor do bloco (ou null = tela toda)
  async function shot(pg,chave,marcas,recorte,folga=24){
    // a faixa vermelha "o computador do ponto não está respondendo" é do modo sem servidor dos prints, não do dia a dia: some antes de medir
    await pg.evaluate(()=>{if(!document.getElementById('sem-faixa')){const st=document.createElement('style');st.id='sem-faixa';st.textContent='.conn-off{display:none!important}';document.head.appendChild(st);}});
    if(marcas.length){await pg.evaluate(s=>{const el=document.querySelector(s);if(el)el.scrollIntoView({block:'center'});},marcas[0][0]);await pg.waitForTimeout(250);}
    const dpr=await pg.evaluate(()=>devicePixelRatio);
    const caixa=async s=>pg.evaluate(s=>{const el=[...document.querySelectorAll(s)].find(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});if(!el)return null;const r=el.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom];},s);
    const ms=[];for(const [s,dir,n] of marcas){const b=await caixa(s);if(!b){console.log('  sem alvo',chave,s);continue;}ms.push([b.map(v=>Math.round(v*dpr)),dir,n]);}
    const vp=pg.viewportSize();let rc=[0,0,vp.width,vp.height];
    if(recorte){const b=await caixa(recorte);if(b)rc=[Math.max(0,b[0]-folga),Math.max(0,b[1]-folga),Math.min(vp.width,b[2]+folga),Math.min(vp.height,b[3]+folga)];}
    for(const [b] of ms){rc=[Math.min(rc[0],b[0]/dpr-130),Math.min(rc[1],b[1]/dpr-130),Math.max(rc[2],b[2]/dpr+130),Math.max(rc[3],b[3]/dpr+130)];}
    rc=[Math.max(0,rc[0]),Math.max(0,rc[1]),Math.min(vp.width,rc[2]),Math.min(vp.height,rc[3])].map(v=>Math.round(v*dpr));
    await pg.screenshot({path:path.join(OUT,chave+'.png')});MARCAS[chave]={marcas:ms,recorte:rc};console.log('  print',chave);}
  // SPRITES=<pasta do sprites_ficticias.py>: as fotos de demonstração viram fotos fictícias
  async function fotosFicticias(ctx){const d=process.env.SPRITES;if(!d)throw new Error('SPRITES não definida: rode ferramentas/sprites_ficticias.py');
    await ctx.route(/\/sprites\/(c\d+\.webp)(\?.*)?$/,r=>{const f=r.request().url().match(/\/sprites\/(c\d+\.webp)/)[1];r.fulfill({status:200,contentType:'image/webp',body:fs.readFileSync(path.join(d,f))});});}
  const grava=()=>fs.writeFileSync(path.join(OUT,'marcas.json'),JSON.stringify(MARCAS,null,1));
  return {usuario,shot,fotosFicticias,grava,MARCAS};};
