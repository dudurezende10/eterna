// 18/11: chinês simplificado (zh-CN) para o cliente: Checkout, galeria online e vídeo das ativações. A equipe segue nos 5 idiomas.
// No Checkout em chinês, alemão e francês o português vem pequeno embaixo (.leg-pt) para o atendente orientar; na galeria e no vídeo, só chinês.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const API='https://api-teste.invalid';const TOK='V'.repeat(22);
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const SEM_PT=()=>{const c=document.querySelector('#main').cloneNode(true);c.querySelectorAll('.leg-pt').forEach(x=>x.remove());return c.textContent;};const HAN=/[一-鿿]/;const PT=/\b(você|seu|suas|fotos|código|Olhe|Digite|Pague|Voltar|Autorizo|vídeo)\b/i;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(a=>{window.ETERNA_AGENTE=a;},API);
  await ctx.route(API+'/**',r=>{const u=new URL(r.request().url());const js=o=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if(u.pathname.endsWith('/info'))return js({ok:true,tipo:'video',menor:false,expira:'2026-12-12T12:00:00',estado:'chegando',servico:'drone',compra:false});
    return r.fulfill({status:404,contentType:'application/json',body:'{}'});});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');await pg.waitForTimeout(800);
  // 1. dicionário: todo texto do cliente tem chinês, sem marcador sobrando
  const dic=await pg.evaluate(()=>{const E=ETERNA,r={semZh:[],ruim:[]};E.state.lang='zh';
    for(const k of Object.keys(E.I18N)){if(E.I18N_ZH[k]==null)r.semZh.push(k); // Maracanã 1950, PIX e CPF ficam como estão
      const v=E.T(k,3,'R$ 30,00','R$ 60,00','R$ 90,00');
      if(['bgArq1950','pix','gq_cpf'].includes(k))continue;if(typeof v!=='string'||!/[一-鿿]|^[\s✓·\d,.:R$-]*$/.test(v)||/undefined|\{\w+\}/.test(v))r.ruim.push(k+'='+v);}
    r.equipe=E.TE('ga_valor');r.langs=E.LANGS.length;E.state.lang='pt';return r;});
  ok(!dic.semZh.length,'1: textos do cliente sem chinês: '+J(dic.semZh));
  ok(!dic.ruim.length,'1: textos chineses com problema: '+J(dic.ruim));
  ok(dic.langs===5&&!HAN.test(dic.equipe),'1: a equipe não muda de idioma com o cliente: '+J([dic.langs,dic.equipe]));
  // 2. Checkout: bandeira 中文 no seletor; escolhida, a tela fica em chinês
  await pg.evaluate(()=>{if(ETERNA.state.cam)ETERNA.state.cam.busy=true;ETERNA.lojaReset();ETERNA.render();});await pg.waitForTimeout(200);
  ok(await pg.locator('[data-act="lang"][data-l="zh"]').count()>0,'2: botão do chinês no seletor de idiomas do Checkout');
  ok(await pg.evaluate(()=>(document.querySelector('[data-act="lang"][data-l="zh"] svg')||{innerHTML:''}).innerHTML.match(/<polygon/g).length)===5,'2: bandeira com as 5 estrelas');
  await pg.evaluate(()=>{ETERNA.state.lang='zh';ETERNA.render();});await pg.waitForTimeout(200);
  let t=await pg.evaluate(`(${SEM_PT})()`);
  ok(HAN.test(t)&&!PT.test(t),'2: Checkout em chinês: '+t.replace(/\s+/g,' ').slice(0,200));
  let leg=await pg.evaluate(()=>[...document.querySelectorAll('#main .leg-pt')].map(x=>x.textContent));
  ok(leg.includes('Viva essa história')&&leg.includes('Suas fotos estão aqui')&&leg.includes('Iniciar'),'2: português pequeno embaixo para o atendente: '+J(leg));
  ok(await pg.evaluate(()=>document.documentElement.lang)==='zh-CN','2: página zh-CN para a letra chinesa');
  await pg.click('[data-act="kiosk-emerg"]');await pg.waitForTimeout(150);t=await pg.evaluate(`(${SEM_PT})()`);
  ok(HAN.test(t)&&!PT.test(t),'2: digitar o código em chinês: '+t.replace(/\s+/g,' ').slice(0,200));
  leg=await pg.evaluate(()=>[...document.querySelectorAll('#main .leg-pt')].map(x=>x.textContent));ok(leg.includes('Digite seu código'),'2: legenda no código: '+J(leg));
  await pg.evaluate(()=>{ETERNA.state.lang='en';ETERNA.render();});ok(await pg.locator('.leg-pt').count()===0,'2: em inglês não há legenda');
  for(const lg of ['de','fr']){await pg.evaluate(lg=>{ETERNA.state.lang=lg;ETERNA.render();},lg);
    leg=await pg.evaluate(()=>[...document.querySelectorAll('#main .leg-pt')].map(x=>x.textContent));ok(leg.includes('Digite seu código'),'2: legenda em português também no '+lg+': '+J(leg));}
  await pg.evaluate(()=>{ETERNA.state.lang='es';ETERNA.render();});ok(await pg.locator('.leg-pt').count()===0,'2: em espanhol não há legenda');
  // 3. galeria online
  const G=await ctx.newPage();G.on('pageerror',e=>errs.push('G: '+e.message));await G.goto(U+'#g/abcdefghijklmnop');await G.waitForTimeout(600);
  t=await G.evaluate(()=>{ETERNA.state.lang='zh';ETERNA.state.pub.step='codigo';ETERNA.render();return document.querySelector('#main').innerText;});
  ok(HAN.test(t)&&!PT.test(t),'3: galeria em chinês: '+t.replace(/\s+/g,' ').slice(0,200));
  ok(await G.locator('.leg-pt').count()===0,'3: galeria no celular do cliente sem legenda em português');
  ok(await G.evaluate(()=>document.documentElement.lang)==='zh-CN','3: página zh-CN: '+await G.evaluate(()=>document.documentElement.lang));
  ok(/YaHei|PingFang/.test(await G.evaluate(()=>getComputedStyle(document.body).fontFamily)),'3: fonte chinesa na lista');
  // 4. vídeo: quem abriu em chinês volta em chinês
  const V=await ctx.newPage();V.on('pageerror',e=>errs.push('V: '+e.message));await V.goto(U);await V.evaluate(()=>localStorage.setItem('eterna.lang','zh'));
  await V.goto(U+'#g/'+TOK);await V.reload();await V.waitForFunction(()=>ETERNA.pub&&ETERNA.pub.step!=='carregando',null,{timeout:15000});
  t=await V.evaluate(()=>document.querySelector('#main').innerText);
  ok(await V.evaluate(()=>ETERNA.pub.step)==='video_aceite'&&HAN.test(t)&&!PT.test(t),'4: vídeo em chinês: '+t.replace(/\s+/g,' ').slice(0,200));
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA idioma-chines: '+fails.join(' || '));process.exit(1);}
console.log('OK idioma-chines: Checkout, galeria e vídeo em chinês; equipe nos 5 idiomas');process.exit(0);
})();
