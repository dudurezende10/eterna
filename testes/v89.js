// v89: na tela de entrada o campo de e-mail fica com o foco mesmo se algo (extensão, preenchimento automático) tirar o foco logo depois
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
(async()=>{const b=await chromium.launch();const f=[];const ok=(c,m)=>{if(!c)f.push(m);};
try{
  for(const vp of [{width:1440,height:900},{width:390,height:844}]){
    const p=await b.newPage({viewport:vp});
    // simula uma extensão que rouba o foco 50 ms depois de carregar
    await p.addInitScript(()=>{window.addEventListener('load',()=>setTimeout(()=>{const x=document.createElement('button');x.id='ext';document.body.appendChild(x);x.focus();},50));});
    await p.goto(U);await p.waitForTimeout(2000);
    const r=await p.evaluate(()=>document.activeElement&&document.activeElement.dataset.act);
    ok(r==='login-email','foco no e-mail depois de extensão roubar ('+vp.width+'): '+r);
    await p.keyboard.type('a@b.co');ok(await p.evaluate(()=>document.querySelector('[data-act="login-email"]').value)==='a@b.co','digita direto ('+vp.width+')');
    // quem já está digitando em outro campo não perde o foco
    await p.evaluate(()=>{const i=document.createElement('input');i.id='outro';document.body.appendChild(i);i.focus();});
    await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(100);
    ok(await p.evaluate(()=>document.activeElement.id)==='outro','não rouba foco de outro campo ('+vp.width+')');
    await p.close();}
}catch(e){f.push('exceção: '+e.message);}
await b.close();
console.log(f.length?'FALHA v89: foco no e-mail da entrada · '+f.join(' / '):'OK v89: foco no e-mail da entrada (com extensão roubando o foco, desktop e celular)');process.exit(f.length?1:0);})();
