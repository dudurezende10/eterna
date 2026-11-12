// v99.20: vídeo das ativações na galeria do cliente (#g/<token>). O cartão é a chave: aceite de imagem + e-mail, sem selfie;
// player com o link assinado, play registrado, Baixar pela galeria (registra o download). A API da nuvem é simulada aqui.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8894/index.html';
const API='https://api-teste.invalid';const TOK='V'.repeat(22),TT='T'.repeat(22);
// v99.23: a galeria do Tour vem junto com o vídeo (acesso próprio, sem selfie): 2 compradas e 3 à venda
const TGAL={tipo:'sessao',menor:false,expira:'2026-12-12T12:00:00',estado:'pronta',precos:{dig:30,todas:90},catalogo:[],compra:true,
  fotos:[['ag_c1','comprada'],['ag_v1','venda'],['ag_c2','comprada'],['ag_v2','venda'],['ag_v3','venda']].map(([pid,d])=>({pid,direito:d,vitrine:API+'/v/'+pid+'.jpg',original:d==='comprada'?API+'/a/'+pid+'.jpg':null,chegando:false}))};
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const errs=[];
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'pt-BR'});
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  let chegou=false,semFotos=true;const chamadas=[];
  await ctx.route(API+'/**',async r=>{const u=new URL(r.request().url());const body=r.request().postData()?JSON.parse(r.request().postData()):null;chamadas.push([u.pathname,body]);
    const gal=a=>({tipo:'video',servico:'drone',expira:'2026-12-12T12:00:00',estado:chegou?'pronta':'chegando',
      videos:[{id:TOK,n:1,duracao:30,bytes:1000,chegando:!chegou,url:chegou?API+'/arquivo.mp4':null,baixar:chegou?'/g/'+TOK+'/baixar?v='+TOK+'&a='+a:null}],
      ...(chegou?{tour:semFotos?{token:TT,n:4}:{token:TT,n:5,acesso:'TA1',galeria:TGAL}}:{})});
    const js=(o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:JSON.stringify(o)});
    if(u.pathname==='/g/'+TT+'/info')return js({ok:true,tipo:'sessao',menor:false,expira:'2026-12-12T12:00:00',estado:'pronta',compra:true});
    if(u.pathname==='/g/'+TT+'/galeria')return body.acesso==='TA1'?js({galeria:TGAL}):js({error:'x'},401);
    if(u.pathname==='/g/'+TT+'/livres')return js({galeria:Object.assign({},TGAL,{fotos:[]})});
    if(/\.jpg$/.test(u.pathname))return r.fulfill({status:200,contentType:'image/jpeg',body:''});
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
  // v99.22: fotos do Tour achadas pela foto da venda
  ok(/Encontramos 4 fotos suas do Tour/.test(await pg.textContent('body')),'atalho das fotos do Tour');
  ok(await pg.$eval('[data-gv-tour] a',a=>a.getAttribute('href'))==='#g/'+'T'.repeat(22),'atalho leva à galeria das fotos');
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
  // v99.23: as fotos do Tour ali mesmo, sem botão no meio
  semFotos=false;await pg.evaluate(async()=>{await ETERNA.pubVideoRenova(ETERNA.pub);ETERNA.render();});
  {const t=await pg.innerText('[data-gv-tour]');
  ok(/Encontramos 5 fotos suas do Tour/.test(t)&&/Toque numa foto para comprar/.test(t),'fotos do Tour na página do vídeo: '+t.slice(0,90));
  ok(await pg.$$eval('[data-gv-tour] .gq-item',e=>e.length)===5,'as 5 miniaturas');
  ok(JSON.stringify(await pg.$$eval('[data-gv-tour] a.gq-dl',a=>a.map(x=>x.href)))===JSON.stringify([API+'/a/ag_c1.jpg',API+'/a/ag_c2.jpg']),'compradas primeiro, com Baixar do original');
  ok(await pg.$$eval('[data-gv-tour] .gq-tourph .wm',e=>e.length)===3,'à venda com marca d\'água');
  ok(!(await pg.$('[data-gv-tour] a[href^="#g/"]')),'sem o botão Ver minhas fotos quando as fotos já vêm');}
  await pg.click('[data-gv-tour] .gq-tourph[data-pid="ag_v2"]');
  await pg.waitForFunction(TT=>ETERNA.pub&&ETERNA.pub.token===TT&&ETERNA.pub.step==='galeria',TT,{timeout:8000}).catch(()=>{});
  ok(await pg.evaluate(()=>ETERNA.pub.step)==='galeria','tocar na foto abre a galeria do Tour direto, sem selfie: '+await pg.evaluate(()=>ETERNA.pub.step));
  ok(JSON.stringify(await pg.evaluate(()=>ETERNA.pub.sel))==='{"ag_v2":true}','a foto tocada já vem marcada para comprar');
  ok(chamadas.some(c=>c[0]==='/g/'+TT+'/galeria'&&c[1]&&c[1].acesso==='TA1'),'galeria do Tour com o acesso vindo do vídeo');
  ok(await pg.$eval('[data-gv-volta]',a=>a.getAttribute('href')).catch(()=>null)==='#g/'+TOK,'Voltar ao vídeo');
  ok(!(await pg.$('[data-act="gq-mais"]')),'sem pedir selfie para achar mais');
  await pg.screenshot({path:process.env.SHOT||'gv-tour-galeria.png'}).catch(()=>{});
  await pg.click('[data-gv-volta]');await pg.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step==='video',null,{timeout:8000}).catch(()=>{});
  ok(await pg.evaluate(()=>ETERNA.pub.step)==='video','volta ao vídeo sem pedir o aceite de novo');
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.join(' | '));
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('galeria_video: tudo certo');})();
