// v99.20: vídeo das ativações na galeria do cliente (#g/<token>). O cartão é a chave: aceite de imagem + e-mail, sem selfie;
// player com o link assinado, play registrado, Baixar pela galeria (registra o download). A API da nuvem é simulada aqui.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8894/index.html';
const API='https://api-teste.invalid';const TOK='V'.repeat(22);
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const errs=[];
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'pt-BR'});
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  let chegou=false;const chamadas=[];
  await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const body=r.request().postData()?JSON.parse(r.request().postData()):null;chamadas.push([u.pathname,body]);
    const gal=a=>({tipo:'video',servico:'drone',expira:'2026-12-12T12:00:00',estado:chegou?'pronta':'chegando',
      videos:[{id:TOK,n:1,duracao:30,bytes:1000,chegando:!chegou,url:chegou?API+'/arquivo.mp4':null,baixar:chegou?'/g/'+TOK+'/baixar?v='+TOK+'&a='+a:null}]});
    const js=(o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(o)});
    if(u.pathname.endsWith('/info'))return js({ok:true,tipo:'video',menor:false,expira:'2026-12-12T12:00:00',estado:'chegando',servico:'drone',compra:false});
    if(u.pathname.endsWith('/video')){if(!body.consentimento||!/@/.test(body.email))return js({error:'x',campo:'email'},400);return js({ok:true,acesso:'AC1',exp:'2026-12-12T12:00:00Z',galeria:gal('AC1')});}
    if(u.pathname.endsWith('/galeria'))return body.acesso==='AC1'?js({galeria:gal('AC1')}):js({error:'x'},401);
    if(u.pathname.endsWith('/evento'))return js({ok:true});
    if(u.pathname.endsWith('/arquivo.mp4'))return r.fulfill({status:200,contentType:'video/mp4',body:''});
    return js({error:'not found'},404);});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#g/'+TOK);await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
  ok(await pg.evaluate(()=>ETERNA.pub.step)==='video_aceite','abre no aceite do vídeo, sem selfie: '+await pg.evaluate(()=>ETERNA.pub.step));
  const txt=await pg.textContent('body');
  ok(/Seu vídeo do Drone/.test(txt)&&/Autorizo o uso da minha imagem neste vídeo/.test(txt),'título do serviço e aceite de imagem');
  ok(await pg.$eval('#gv-go',e=>e.disabled),'sem o aceite, o botão fica desligado');
  await pg.fill('#gv-email','sem-arroba');await pg.check('[data-act="gv-consent"]');
  ok(await pg.inputValue('#gv-email')==='sem-arroba','marcar o aceite não apaga o e-mail digitado');
  await pg.click('#gv-go');await pg.waitForTimeout(200);
  ok(/Confira o e-mail/.test(await pg.textContent('body')),'e-mail inválido avisado');
  await pg.fill('#gv-email','cliente@exemplo.com');await pg.click('#gv-go');
  await pg.waitForFunction(()=>ETERNA.pub.step==='video',null,{timeout:5000});
  const env=chamadas.find(c=>c[0].endsWith('/video'));
  ok(env&&env[1].consentimento===true&&env[1].email==='cliente@exemplo.com'&&env[1].marketing===false,'aceite e e-mail enviados');
  ok(/Seu vídeo está chegando/.test(await pg.textContent('body')),'vídeo ainda subindo: "está chegando"');
  // chegou: a página confere sozinha (aqui adiantado) e mostra o player e o Baixar
  chegou=true;await pg.evaluate(async()=>{const p=ETERNA.pub;await ETERNA.pubVideoRenova(p);ETERNA.render();});
  const v=await pg.$('video[data-gv-v]');ok(!!v,'player do vídeo');
  const href=await pg.$eval('.gq-gvdl',a=>a.href);
  ok(href===API+'/g/'+TOK+'/baixar?v='+TOK+'&a=AC1','Baixar passa pela galeria (registra o download): '+href);
  await pg.evaluate(()=>document.querySelector('video[data-gv-v]').dispatchEvent(new Event('play')));await pg.waitForTimeout(200);
  await pg.evaluate(()=>document.querySelector('video[data-gv-v]').dispatchEvent(new Event('play')));await pg.waitForTimeout(200);
  const plays=chamadas.filter(c=>c[0].endsWith('/evento'));
  ok(plays.length===1&&plays[0][1].tipo==='video_play'&&plays[0][1].acesso==='AC1','play registrado uma vez: '+plays.length);
  ok(await pg.evaluate(()=>!!localStorage.getItem('eterna.gv.VVVVVVVVVV')),'acesso guardado neste aparelho');
  // voltar ao cartão no mesmo aparelho: não pede o aceite de novo
  await pg.goto(U+'#g/'+'W'.repeat(22));await pg.waitForTimeout(300);await pg.goto(U+'#g/'+TOK);await pg.waitForTimeout(500);await pg.reload();
  await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
  ok(await pg.evaluate(()=>ETERNA.pub.step)==='video','mesmo aparelho volta direto ao vídeo: '+await pg.evaluate(()=>new Date().toISOString()+' '+localStorage.getItem('eterna.gv.VVVVVVVVVV'))+await pg.evaluate(()=>ETERNA.pub.step+' '+JSON.stringify(Object.entries(localStorage).filter(e=>/gv/.test(e[0])))));
  {const t=await pg.innerText('body');ok(!/\bgv_[a-z_A-Z]+/.test(t),'sem chave de texto crua: '+(t.match(/\bgv_[a-z_A-Z]+/)||[''])[0]);}
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('galeria_video: tudo certo');})();
