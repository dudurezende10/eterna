// v99.108: selfie sem código na galeria pública (#g). A opção só aparece quando a nuvem anuncia; o cliente escolhe o dia,
// dá o aceite, tira a selfie e, achando, entra na galeria dele pelo fluxo normal (sem código). Não achou: só informa, com o
// e-mail de ajuda. A API da nuvem é simulada aqui. Plano docs/planos/2026-11-27-selfie-na-galeria.md
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const API='https://api-teste.invalid';const TS='S'.repeat(22);
const DIAS=Array.from({length:30},(_,i)=>new Date(Date.now()-i*86400e3-3*3600e3).toISOString().slice(0,10));
const GAL={tipo:'sessao',menor:false,expira:'2026-12-20T12:00:00',estado:'pronta',precos:{dig:30,todas:90},catalogo:[],compra:true,
  fotos:[['ag_c1','comprada'],['ag_v1','venda'],['ag_v2','venda']].map(([pid,d])=>({pid,direito:d,vitrine:API+'/v/'+pid+'.jpg',original:d==='comprada'?API+'/a/'+pid+'.jpg':null,chegando:false}))};
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  let anuncia=0,resultado='achou',consultas=0;const chamadas=[];
  await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const body=r.request().postData()?JSON.parse(r.request().postData()):null;chamadas.push([u.pathname,body]);
    const js=(o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(o)});
    if(u.pathname==='/g/selfie/dias')return anuncia===0?js({message:'Not Found'},404):js({ok:true,dias:DIAS,ligada:anuncia===2});
    if(u.pathname==='/g/selfie/pedido')return js({ok:true,pedido:'P'.repeat(24),estado:'esperando'});
    if(u.pathname==='/g/selfie/estado'){consultas++;if(consultas<2)return js({estado:'buscando'});
      return resultado==='achou'?js({estado:'achou',token:TS,acesso:'SFA1',exp:'2026-12-20T12:00:00Z',n:3}):js({estado:resultado});}
    if(u.pathname==='/g/'+TS+'/info')return js({ok:true,tipo:'sessao',menor:false,expira:GAL.expira,estado:'pronta',compra:true});
    if(u.pathname==='/g/'+TS+'/galeria')return body&&body.acesso==='SFA1'?js({galeria:GAL}):js({error:'x'},401);
    if(/\.jpg$/.test(u.pathname))return r.fulfill({status:200,contentType:'image/jpeg',body:''});
    return js({error:'not found'},404);});
  const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.on('pageerror',e=>errs.push(e.message));
  const abreCodigo=async()=>{await pg.goto(U+'#g');await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='codigo');await pg.waitForTimeout(400);};
  // 1. nuvem antiga (sem a rota) e estádio fora do ar: nada aparece
  await abreCodigo();
  ok(!(await pg.$('[data-act="gq-sf"]'))&&/Digite seu código/i.test(await pg.textContent('body')),'1: nuvem sem a rota: só o código');
  anuncia=1;await pg.reload();await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='codigo');await pg.waitForTimeout(400);
  ok(!(await pg.$('[data-act="gq-sf"]')),'1: estádio sem buscar pedidos: a opção não aparece');
  // 2. nuvem anuncia: a alternativa aparece na mesma tela do código
  anuncia=2;await pg.reload();await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='codigo');
  await pg.waitForSelector('[data-act="gq-sf"]',{timeout:5000}).catch(()=>{});await pg.waitForTimeout(1200); // o anúncio fica 1 min guardado
  const t2=await pg.textContent('body');
  ok(!!(await pg.$('[data-act="gq-sf"]'))&&/Não tem o código\?/.test(t2)&&/Encontrar minhas fotos pela selfie/.test(t2)&&/Digite seu código/i.test(t2)&&!!(await pg.$('[data-act="gq-qr"]')),'2: código e QR continuam, e a selfie aparece como alternativa');
  // 3. dia + aceite: 30 dias, hoje primeiro; sem aceite o botão fica desligado; e-mail conferido
  await pg.click('[data-act="gq-sf"]');await pg.waitForSelector('#gq-sf-dia');
  const ops=await pg.$$eval('#gq-sf-dia option',os=>os.map(o=>[o.value,o.textContent]));
  ok(ops.length===30&&ops[0][0]===DIAS[0]&&ops[0][1]==='Hoje'&&ops[1][1]==='Ontem'&&ops[29][0]===DIAS[29],'3: últimos 30 dias, hoje e ontem por nome: '+J(ops.slice(0,3)));
  ok(/Autorizo o uso da foto do meu rosto exclusivamente para localizar as minhas fotos do dia escolhido/.test(await pg.textContent('body'))&&/apagada logo depois da busca/.test(await pg.textContent('body')),'3: aceite da selfie sem código');
  ok(await pg.$eval('#gq-agree',e=>e.disabled),'3: sem o aceite, o botão fica desligado');
  await pg.selectOption('#gq-sf-dia',DIAS[3]);await pg.check('[data-act="gq-consent"]');await pg.fill('#gq-esc-email','sem-arroba');await pg.click('#gq-agree');await pg.waitForTimeout(200);
  ok(/Confira o e-mail/.test(await pg.textContent('body'))&&await pg.evaluate(()=>ETERNA.pub.step)==='sf_dia','3: e-mail inválido avisado');
  await pg.fill('#gq-esc-email','cliente@exemplo.com');await pg.click('#gq-agree');
  await pg.waitForFunction(()=>ETERNA.pub.step==='selfie');
  ok(!chamadas.some(c=>/\/g\/codigo\//.test(c[0])),'3: nenhum código pedido');
  // 4. a selfie vai como pedido do dia; "Procurando suas fotos…"; achou: a galeria dele, no fluxo normal
  const foto=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d');x.fillStyle='#c8a080';x.fillRect(0,0,1200,900);return c.toDataURL('image/jpeg',.9);});
  await pg.evaluate(u=>ETERNA.pubMatch(u),foto);
  await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='sf_busca',null,{timeout:30000}).catch(()=>{});
  ok(/Procurando suas fotos/.test(await pg.textContent('body')),'4: procurando suas fotos');
  const env=chamadas.find(c=>c[0]==='/g/selfie/pedido');
  ok(env&&env[1].consentimento===true&&env[1].dia===DIAS[3]&&env[1].email==='cliente@exemplo.com'&&/^data:image\/jpeg/.test(env[1].imagem)&&env[1].marketing===true,'4: pedido com o dia, o aceite e o e-mail: '+J(env&&Object.assign({},env[1],{imagem:(env[1].imagem||'').slice(0,20)})));
  const dims=env&&await pg.evaluate(u=>new Promise(ok=>{const i=new Image();i.onload=()=>ok([i.width,i.height]);i.src=u;}),env[1].imagem);
  ok(dims&&Math.max(...dims)<=640,'4: selfie reduzida a 640 px: '+J(dims));
  await pg.waitForFunction(t=>location.hash==='#g/'+t&&ETERNA.pub&&ETERNA.pub.step==='galeria',TS,{timeout:15000}).catch(()=>{});
  const g4=await pg.evaluate(()=>({step:ETERNA.pub.step,tok:ETERNA.pub.token,acesso:ETERNA.pub.acesso,dl:document.querySelectorAll('[data-act="gq-dl"]').length,wm:document.querySelectorAll('.gq-ph .wm').length,txt:document.body.innerText}));
  ok(g4.step==='galeria'&&g4.tok===TS&&g4.acesso==='SFA1','4: achou, abre a galeria dele com o acesso da nuvem: '+J({step:g4.step,tok:g4.tok}));
  ok(g4.dl===1&&g4.wm===2,'4: comprada para baixar, as outras à venda com marca: '+J({dl:g4.dl,wm:g4.wm}));
  ok(!chamadas.some(c=>c[0]==='/g/'+TS+'/rosto'),'4: não pede outra selfie dentro da galeria');
  ok(!/data:image/.test(await pg.evaluate(()=>{let s='';for(const st of [localStorage,sessionStorage])for(let i=0;i<st.length;i++)s+=st.getItem(st.key(i));return s+JSON.stringify(ETERNA.pub);})),'4: selfie não fica no navegador');
  // 5. não achou: só informa, com o e-mail de ajuda; tentar outro dia volta à escolha
  resultado='nao';consultas=0;await abreCodigo();await pg.waitForSelector('[data-act="gq-sf"]');await pg.click('[data-act="gq-sf"]');
  await pg.check('[data-act="gq-consent"]');await pg.fill('#gq-esc-email','cliente@exemplo.com');await pg.click('#gq-agree');await pg.waitForFunction(()=>ETERNA.pub.step==='selfie');
  await pg.evaluate(u=>ETERNA.pubMatch(u),foto);await pg.waitForFunction(()=>ETERNA.pub.step==='sf_nao',null,{timeout:30000}).catch(()=>{});
  const t5=await pg.textContent('body');
  ok(/Não encontramos suas fotos nesse dia/.test(t5)&&/mande para nós a selfie e o dia da visita/.test(t5)&&!!(await pg.$('.gq-help a[href="mailto:contato@vivamaracana.com.br"]')),'5: não achou, com o e-mail de ajuda');
  ok(!(await pg.$('input[type=file]:not(#gq-qr-img)'))&&!chamadas.some(c=>/naoachei|equipe/.test(c[0])),'5: nada é enviado para a equipe');
  await pg.click('[data-act="gq-sf-de-novo"]');ok(await pg.evaluate(()=>ETERNA.pub.step)==='sf_dia','5: tentar outro dia');
  await pg.click('[data-act="gq-sf-volta"]');ok(await pg.evaluate(()=>ETERNA.pub.step)==='codigo'&&!!(await pg.$('#gq-code')),'5: voltar ao código');
  // 6. idiomas: os textos novos existem em todos os idiomas do cliente
  const falta=await pg.evaluate(()=>{const E=ETERNA,f=[];Object.keys(E.I18N).filter(k=>/^gq_sf/.test(k)).forEach(k=>{if(E.I18N[k].length!==5||E.I18N[k].some(x=>!x))f.push(k+' 5');if(E.I18N_ZH[k]==null)f.push(k+' zh');});return f;});
  ok(!falta.length,'6: textos sem tradução: '+J(falta));
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+J(errs.slice(0,3)));
console.log(fails.length?'FALHA galeria-selfie-dia: '+fails.join(' | '):'OK galeria-selfie-dia: alternativa só com a nuvem anunciando, dia e aceite, procurando, galeria normal ao achar e o "não achamos" com o e-mail de ajuda');
process.exit(fails.length?1:0);})();
