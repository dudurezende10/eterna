// 16/11 (plano "Curadoria › Treino da IA", F1): a tela de treino marca fotos reais do servidor. Abas Marcar e Outubro (exemplo);
// dia, fotógrafo e modo; foto inteira com lupa; eixo Ponto com botões grandes e teclas G A T C O; P, N, 1 a 9, D, Enter, setas e Z;
// gravação otimista com fila só de texto (eterna.treino.fila.v1); nenhuma foto guardada no aparelho; o interruptor da análise
// (/treino/config, só com Painel de controle em Alterar, auditLog; desde 24/11 em Configurações › Preços e Checkout › Fundos de IA, #tr-cfg); a Supervisora marca (preset e migração única); a coleção
// treino só é lida por quem tem Qualidade e IA em Ver. Agente falso por page.route na própria origem; fotos = 1 pixel.
const {chromium}=require('playwright');const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};const J=JSON.stringify;
const PX=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');
const DIA='2026-11-15';const PIDS=Array.from({length:12},(_,i)=>(0xabc000000000+i+1).toString(16));
const ITENS=PIDS.map((p,i)=>({pid:p,card:'LPTR'+String(Math.floor(i/6)).padStart(4,'0'),fotografo:i<6?'carlos':'yago',t:Date.parse(DIA+'T13:00:00Z')/1000+i*20,ordem:i%6+1,n_sessao:6,rostos:2,rotulo:null}));
async function agente(ctx,R){
  R.posts=[];R.thumbs=[];R.cfg=[];R.cols=new Set();R.amostra=[];R.rotuloStatus=200;R.rot={};R.guarda=false;R.atraso=0;R.ordem=[];R.analise={ponto:'desligada',exposicao:'desligada'};
  const js=(r,b,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(b)});
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bT',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gT',hoje:0,abertas:0},
    treino:{v:1,rotulos:7,analise:R.analise,modelo_ponto:null,ajuste:null}}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'gT',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]}));
  await ctx.route(ORIG+'/fila-fotografo',r=>js(r,{ok:true,grupos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs?*',r=>{const c=new URL(r.request().url()).searchParams.get('col');R.cols.add(c);js(r,{ok:true,docs:[]});});
  await ctx.route(ORIG+'/ponto/docs',r=>{let n=0;try{n=(r.request().postDataJSON().docs||[]).length;}catch(e){}js(r,{ok:true,gravados:n,recusados:0});});
  await ctx.route(ORIG+'/thumb/**',r=>{R.thumbs.push(new URL(r.request().url()).pathname.split('/').pop());r.fulfill({status:200,contentType:'image/jpeg',body:PX});});
  await ctx.route(ORIG+'/treino/dias',r=>js(r,{v:1,dias:[{dia:DIA,fotos:12,sessoes:2,rotuladas:0},{dia:'2026-11-14',fotos:30,sessoes:5,rotuladas:3}]}));
  await ctx.route(ORIG+'/treino/amostra?*',r=>{const q=new URL(r.request().url()).searchParams;R.amostra.push(Object.fromEntries(q));js(r,{v:1,dia:q.get('dia'),modo:q.get('modo'),semente:'abc',total_dia:12,itens:ITENS.map(x=>R.rot[x.pid]?Object.assign({},x,{rotulo:R.rot[x.pid]}):x)});});
  await ctx.route(ORIG+'/treino/rotulo',async r=>{const b=r.request().postDataJSON();const h=r.request().headers();R.posts.push({b,x:h['x-eterna']});
    if(R.atraso)await new Promise(ok=>setTimeout(ok,R.atraso));R.ordem.push('rotulo');
    if(R.rotuloStatus===409)return js(r,{ok:false,error:'outro_marcou',doc:{v:1,pid:b.pid,ponto:'arquibancada',qual:{nivel:null,motivos:[],ajuste:[]},ia:{serve:null,motivos:[],frente:null},duvida:false,obs:'',por:'outra.pessoa',em:'2026-11-16T10:00:00.000'}},409);
    if(R.rotuloStatus!==200)return js(r,{ok:false,error:'servidor'},R.rotuloStatus);
    // como o treino_valida: a observação volta sem caracteres de controle e sem espaços nas pontas
    const doc=Object.assign({v:1,dia:DIA,fotografo:'carlos',card:'LPTR0000',ordem:1,por:'quem',em:'2026-11-16T11:00:00.'+String(R.posts.length).padStart(3,'0'),origem:'mao',lote:null},b,{base_em:undefined,obs:String(b.obs||'').replace(/[\u0000-\u001f\u007f]/g,'').trim()});
    if(R.guarda)R.rot[b.pid]=doc;js(r,{ok:true,doc});});
  await ctx.route(ORIG+'/treino/config',r=>{const b=r.request().postDataJSON();R.cfg.push(b);Object.assign(R.analise,b);js(r,{ok:true,analise:Object.assign({},R.analise),por:'quem',em:'x'});});
}
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
(async()=>{const b=await chromium.launch();
const nova=async(opts)=>{const ctx=await b.newContext(Object.assign({viewport:{width:1366,height:900},locale:'pt-BR'},opts||{}));await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));return {ctx,pg,R};};
// 24/11 (integração v99.43): com a máquina carregada o login e o 1º /status passam dos 350 ms do _entrar e dos 8 s; espera os dois
const entrar=async(pg,email,admin)=>{await pg.goto(U);await pg.waitForTimeout(300);if(admin)email=await entrarTeste.adminFicticio(pg);await entrarTeste(pg,email);
  await espera(pg,()=>!!ETERNA.state.user,15000);await espera(pg,()=>ETERNA.state.agent.on,20000);};
try{
  // ---------- Admin: abas, interruptor, carregar, teclado ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,null,true);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    const abas=await pg.$$eval('[data-act="tr-aba"]',x=>x.map(b=>b.dataset.a));
    ok(J(abas)===J(['marcar','medida','outubro']),'abas Marcar, Resultado (data-a medida) e Outubro (sem abas vazias): '+J(abas));
    ok(await pg.textContent('[data-act="tr-aba"][data-a="medida"]')==='Resultado','24/11: a aba que era Medição se chama Resultado');
    // 24/11: o interruptor saiu do Treino e foi para Configurações › Preços e Checkout › Fundos de IA (#tr-cfg)
    ok(!await pg.$('.tr-an')&&!await pg.$('[data-act="tr-analise"]')&&!await pg.$('[data-act="tr-cfg"]'),'o Treino não tem mais o interruptor');
    ok(/Fundos de IA automáticos desligados/.test(await pg.textContent('.tr-aviso-desl').catch(()=>''))&&await pg.$('.tr-aviso-desl [data-act="tr-cfg-abrir"]'),'Treino: aviso dos Fundos de IA desligados com Abrir em Configurações');
    await pg.evaluate(()=>{ETERNA.state.catTab='fundos';ETERNA.go('catalogo');});await espera(pg,()=>document.querySelector('#tr-cfg'));
    const an=await pg.evaluate(()=>[...document.querySelectorAll('#tr-cfg [data-act="tr-cfg"]')].map(b=>b.dataset.k+':'+b.dataset.v+':'+b.getAttribute('aria-pressed')));
    ok(an.length===4&&an.every(x=>x.endsWith(':false')),'Configurações: 2 botões por linha, nenhum marcado com o servidor em desligada: '+J(an));
    ok(/Parado no servidor/.test(await pg.textContent('#tr-cfg'))&&/Desligado, o servidor continua analisando em silêncio/.test(await pg.textContent('#tr-cfg')),'texto claro do quadro e a pílula Parado no servidor');
    await pg.click('#tr-cfg [data-act="tr-cfg"][data-k="exposicao"][data-v="off"]');await espera(pg,()=>ETERNA.state.agent.treino.analise.exposicao==='medir');
    const aud=await pg.evaluate(()=>{const l=JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]');return l.find(e=>e.acao==='treino_analise');});
    ok(J(R.cfg)===J([{exposicao:'medir'}])&&aud&&aud.mudancas[0].campo==='analise.exposicao'&&aud.mudancas[0].para==='medir','Admin põe a exposição em Desligado ({exposicao:"medir"}) com auditLog: '+J(R.cfg)+' '+J(aud));
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>document.querySelector('[data-act="tr-dia"]'));
    // dia, fotógrafo e modo; Carregar
    ok(await pg.$eval('[data-act="tr-dia"]',s=>s.options.length===2&&s.value==='2026-11-15'),'seletor de dias com sessão (o mais recente primeiro)');
    await pg.selectOption('[data-act="tr-modo"]','ia');await pg.selectOption('[data-act="tr-foto"]','carlos');
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    ok(R.amostra.length===1&&R.amostra[0].dia===DIA&&R.amostra[0].modo==='ia'&&R.amostra[0].fotografo==='carlos'&&R.amostra[0].n==='150','pedido da amostra: '+J(R.amostra));
    const img=await pg.$eval('.tr-foto img',i=>i.getAttribute('src'));ok(img===ORIG+'/thumb/'+PIDS[0],'foto inteira pelo /thumb/: '+img);
    ok(await pg.$eval('.tr-foto img',i=>getComputedStyle(i).objectFit)==='contain','foto inteira (contain)');
    await espera(pg,(p)=>true,300);await pg.waitForTimeout(400);
    ok(PIDS.slice(1,4).every(p=>R.thumbs.includes(p)),'pré-carga das 3 próximas: '+J(R.thumbs));
    // botões grandes
    const tam=await pg.$$eval('[data-act="tr-ponto"]',x=>x.map(b=>{const r=b.getBoundingClientRect();return Math.min(r.width,r.height);}));
    ok(tam.length===5&&tam.every(h=>h>=56),'eixo Ponto com 5 botões de 56 px ou mais: '+J(tam));
    // teclado: G, P, Enter
    await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
    await pg.keyboard.press('g');await pg.keyboard.press('p');
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="gramado"]',b=>b.getAttribute('aria-pressed'))==='true','G marca gramado');
    await pg.keyboard.press('Enter');await espera(pg,()=>ETERNA.state.train.j===1);await espera(pg,(n)=>true,10);await pg.waitForTimeout(300);
    const p1=R.posts[0]&&R.posts[0].b;
    ok(p1&&p1.pid===PIDS[0]&&p1.v===1&&p1.ponto==='gramado'&&J(p1.qual)===J({nivel:'boa',motivos:[],ajuste:[]})&&p1.duvida===false&&J(p1.ia)===J({serve:null,motivos:[],frente:null})&&R.posts[0].x==='1'&&!('por' in p1)&&!('em' in p1),
      'Enter grava (pode = boa) e avança: '+J(R.posts[0]));
    // N, 1, 3, D, A, Enter
    await pg.keyboard.press('a');await pg.keyboard.press('n');await pg.keyboard.press('1');await pg.keyboard.press('3');await pg.keyboard.press('d');await pg.keyboard.press('Enter');
    await espera(pg,()=>ETERNA.state.train.j===2);await pg.waitForTimeout(300);
    const p2=R.posts[1]&&R.posts[1].b;
    ok(p2&&p2.pid===PIDS[1]&&p2.ponto==='arquibancada'&&p2.qual.nivel==='fraca'&&J(p2.qual.motivos)===J(['desfocada','cortada'])&&p2.duvida===true,'não pode = fraca com os motivos; D dúvida: '+J(p2));
    // setas e Z
    await pg.keyboard.press('ArrowLeft');ok(await pg.evaluate(()=>ETERNA.state.train.j)===1,'seta volta');await pg.keyboard.press('ArrowRight');
    await pg.keyboard.press('z');await espera(pg,()=>ETERNA.state.train.j===1);await pg.waitForTimeout(300);
    const p3=R.posts[2]&&R.posts[2].b;
    ok(p3&&p3.pid===PIDS[1]&&p3.ponto===null&&p3.qual.nivel===null&&p3.duvida===false&&p3.base_em,'Z desfaz (regrava a marcação anterior, vazia, com a base certa): '+J(p3));
    const cont=await pg.textContent('.bar .val');const mini=await pg.$eval('[data-act="tr-go"][data-i="1"]',b=>b.style.borderColor);
    ok(cont==='1/12'&&!/good/.test(mini),'a marcação desfeita (vazia) não conta como marcada: '+cont+' '+mini);
    // conflito: outra pessoa marcou antes
    R.rotuloStatus=409;await pg.keyboard.press('o');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);
    ok(/Outra pessoa \(outra\.pessoa\) marcou/.test(await pg.textContent('#toast')),'409: avisa que outra pessoa marcou: '+await pg.textContent('#toast'));
    ok(await pg.evaluate(p=>ETERNA.state.train.docs[p].ponto==='arquibancada'&&ETERNA.trFila().length===0,PIDS[1]),'409: fica a marcação do servidor e a fila esvazia');
    // fila: servidor fora; nada de foto na fila
    R.rotuloStatus=503;await pg.evaluate(()=>ETERNA.go('treino'));await pg.evaluate(()=>{ETERNA.state.train.j=3;ETERNA.render();});
    await pg.keyboard.press('t');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);
    const fila=await pg.evaluate(k=>localStorage.getItem(k),'eterna.treino.fila.v1');
    ok(fila&&JSON.parse(fila).length===1&&JSON.parse(fila)[0].corpo.ponto==='trofeu','sem servidor a marcação fica na fila: '+fila);
    ok(!/https?:|thumb|file\/|data:image|blob:|\.jpg/i.test(fila),'a fila é só texto, sem imagem nem URL de foto: '+fila);
    ok(/esperando o servidor/.test(await pg.textContent('#main')),'a tela mostra quantas esperam o servidor');
    R.rotuloStatus=200;await pg.evaluate(()=>ETERNA.trEnviar());await espera(pg,()=>ETERNA.trFila().length===0,5000);
    ok(await pg.evaluate(()=>ETERNA.trFila().length)===0&&R.posts.some(x=>x.b.ponto==='trofeu'&&x.b.pid===PIDS[3]),'servidor de volta: a fila sobe');
    // lupa: zoom existente com a lista da aba
    await pg.click('.tr-foto');await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open')&&ETERNA.state&&true),'lupa abre o zoom');
    await pg.keyboard.press('Escape');
    // nenhuma foto no aparelho
    const guarda=await pg.evaluate(async()=>{const all=[];for(const st of [localStorage,sessionStorage])for(let i=0;i<st.length;i++){const k=st.key(i);all.push(k+'='+st.getItem(k));}
      const ck=('caches' in self)?(await caches.keys()).length:0;return {txt:all.filter(x=>/data:image|blob:|\/thumb\/|\/file\//.test(x)).map(x=>x.slice(0,80)),ck};});
    ok(!guarda.txt.length&&guarda.ck===0,'nenhuma foto nem endereço de foto guardado no aparelho: '+J(guarda));
    // Outubro: só leitura; exportar só Admin, sem observações; import só nessa aba
    await pg.click('[data-act="tr-aba"][data-a="outubro"]');
    ok(await pg.$('[data-act="train-v"]')===null&&await pg.$('[data-act="train-r"]')===null&&await pg.$('[data-act="train-export"]')!==null&&await pg.$('[data-act="train-import"]')!==null,'Outubro: sem botões de marcar, com exportar e importar');
    await pg.evaluate(()=>{const L=ETERNA.trainOut();ETERNA.state.train.labels[L[0].id]={id:L[0].id,card:L[0].card,key:L[0].key,verdict:'nao',reasons:['olhos'],note:'texto livre',at:'2026-10-20T10:00:00Z'};});
    const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('[data-act="train-export"]')]);
    const txt=require('fs').readFileSync(await dl.path(),'utf8');
    const aud2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').find(e=>e.acao==='treino_exportado'));
    ok(!/texto livre|"note"/.test(txt)&&/"olhos"/.test(txt)&&aud2,'exportar sem observações e com auditLog: '+txt.slice(0,120)+' '+J(aud2));
    await pg.click('[data-act="tr-aba"][data-a="marcar"]');
    ok(await pg.$('[data-act="train-import"]')===null&&await pg.$('[data-act="train-export"]')===null,'Marcar sem importar nem exportar');
    ok(R.cols.has('treino'),'Admin lê a coleção treino');
    await ctx.close();}
  // ---------- toque (celular): botões e tap ----------
  {const {ctx,pg,R}=await nova({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await entrar(pg,null,true);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.tap('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    await pg.tap('[data-act="tr-ponto"][data-p="chute"]');await pg.tap('[data-act="tr-q"][data-v="boa"]');await pg.tap('[data-act="tr-ok"]');await pg.waitForTimeout(400);
    ok(R.posts.length===1&&R.posts[0].b.ponto==='chute'&&R.posts[0].b.qual.nivel==='boa','toque: chute a gol, pode e confirmar: '+J(R.posts));
    const tam=await pg.$$eval('.tr-big',x=>x.map(b=>{const r=b.getBoundingClientRect();return Math.round(Math.min(r.width,r.height));}));
    ok(tam.every(h=>h>=56),'no celular os botões seguem com 56 px ou mais: '+J(tam));
    await ctx.close();}
  // ---------- 23/11: sair da foto grava a escolha (Próxima, setas, grade, Carregar, aba, tela, recarregar); Z desfaz ----------
  {const {ctx,pg,R}=await nova();const dlg=[];pg.on('dialog',d=>{dlg.push(d.message());d.dismiss().catch(()=>{});});await entrar(pg,null,true);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    const borda=i=>pg.$eval(`[data-act="tr-go"][data-i="${i}"]`,b=>b.style.borderColor+(b.classList.contains('tr-mini-nova')?' nova':''));
    const blur=()=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
    // Pode e Próxima
    await pg.click('[data-act="tr-q"][data-v="boa"]');
    const b0=await borda(0);ok(/bad/.test(b0)&&/nova/.test(b0),'grade: foto atual com escolha ainda não gravada em outra cor (vermelho tracejado): '+b0);
    ok(R.posts.length===0,'escolher sem sair da foto ainda não grava: '+J(R.posts));
    await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0&&!ETERNA.state.train.docs[ETERNA.state.train.itens[0].pid].pend);
    ok(R.posts.length===1&&R.posts[0].b.pid===PIDS[0]&&R.posts[0].b.qual.nivel==='boa'&&await pg.evaluate(()=>ETERNA.state.train.j)===1,'Pode e Próxima: grava e vai para a seguinte: '+J(R.posts));
    const b0b=await borda(0);ok(/good/.test(b0b)&&!/nova/.test(b0b),'grade: a foto gravada fica verde: '+b0b);
    // seta
    await blur();await pg.keyboard.press('p');await pg.keyboard.press('ArrowRight');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===2);await pg.waitForTimeout(200);
    ok(R.posts.length===2&&R.posts[1].b.pid===PIDS[1]&&R.posts[1].b.qual.nivel==='boa','P e seta para a direita gravam: '+J(R.posts.map(x=>x.b.pid)));
    ok(/good/.test(await borda(1)),'grade: verde depois da seta');
    // número da grade
    await pg.keyboard.press('n');await pg.keyboard.press('1');await pg.click('[data-act="tr-go"][data-i="5"]');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===5);await pg.waitForTimeout(200);
    ok(R.posts.length===3&&R.posts[2].b.pid===PIDS[2]&&R.posts[2].b.qual.nivel==='fraca'&&J(R.posts[2].b.qual.motivos)===J(['desfocada']),'Não pode, motivo e toque no número gravam: '+J(R.posts[2]&&R.posts[2].b));
    ok(/good/.test(await borda(2)),'grade: verde depois do toque no número');
    // passar sem tocar nada não grava; Próxima não pula as marcadas
    await blur();await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowRight');await pg.keyboard.press('ArrowLeft');await pg.click('[data-act="tr-next"]');await pg.click('[data-act="tr-prev"]');await pg.waitForTimeout(400);
    ok(R.posts.length===3&&await pg.evaluate(()=>ETERNA.trFila().length)===0,'passar pelas fotos sem tocar nada não faz POST: '+R.posts.length);
    await pg.click('[data-act="tr-go"][data-i="0"]');await pg.click('[data-act="tr-next"]');
    ok(await pg.evaluate(()=>ETERNA.state.train.j)===1&&R.posts.length===3,'Próxima vai para a seguinte mesmo marcada, sem gravar de novo o que não mudou');
    // escolha igual à gravada não grava de novo; mudar a gravada grava
    await blur();await pg.keyboard.press('p');await pg.keyboard.press('p');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(300);
    ok(R.posts.length===3,'tirar e pôr de novo a mesma escolha não grava: '+R.posts.length);
    // Z desfaz a gravação feita pela Próxima
    await pg.click('[data-act="tr-go"][data-i="6"]');await blur();await pg.keyboard.press('g');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===7);await pg.waitForTimeout(200);
    ok(R.posts.length===4&&R.posts[3].b.pid===PIDS[6]&&R.posts[3].b.ponto==='gramado','G e Próxima gravam: '+J(R.posts[3]&&R.posts[3].b));
    await blur();await pg.keyboard.press('z');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===6);await pg.waitForTimeout(200);
    const z=R.posts[4]&&R.posts[4].b;
    ok(R.posts.length===5&&z.pid===PIDS[6]&&z.ponto===null&&z.qual.nivel===null&&z.base_em&&await pg.evaluate(()=>ETERNA.state.train.j)===6,'Z desfaz a gravação feita pela Próxima e volta para a foto: '+J(z));
    {const b6=await borda(6);ok(!/good|warn|bad/.test(b6),'grade: a foto desfeita não fica verde: '+b6);}
    // Carregar, outra aba e outra tela também gravam
    await pg.click('[data-act="tr-go"][data-i="8"]');await blur();await pg.keyboard.press('a');await pg.click('[data-act="tr-aba"][data-a="medida"]');await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(300);
    ok(R.posts.length===6&&R.posts[5].b.pid===PIDS[8]&&R.posts[5].b.ponto==='arquibancada','trocar para a aba Resultado grava: '+J(R.posts.map(x=>x.b.pid)));
    await pg.click('[data-act="tr-aba"][data-a="marcar"]');await pg.click('[data-act="tr-go"][data-i="9"]');await blur();await pg.keyboard.press('t');
    await pg.evaluate(()=>ETERNA.go('painel'));await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(300);
    ok(R.posts.length===7&&R.posts[6].b.pid===PIDS[9]&&R.posts[6].b.ponto==='trofeu','sair da tela do Treino grava: '+J(R.posts.map(x=>x.b.pid)));
    await pg.evaluate(()=>ETERNA.go('treino'));await pg.click('[data-act="tr-go"][data-i="10"]');await blur();await pg.keyboard.press('o');await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===0);await pg.waitForTimeout(300);
    ok(R.posts.length===8&&R.posts[7].b.pid===PIDS[10]&&R.posts[7].b.ponto==='outro','Carregar de novo grava a escolha da foto de antes: '+J(R.posts.map(x=>x.b.pid)));
    // recarregar a página: vai para a fila local, sem pergunta do navegador
    R.rotuloStatus=503;await pg.click('[data-act="tr-go"][data-i="11"]');await blur();await pg.keyboard.press('c');
    await pg.reload();await pg.waitForTimeout(600);
    const fl=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.treino.fila.v1')||'[]'));
    ok(fl.length===1&&fl[0].pid===PIDS[11]&&fl[0].corpo.ponto==='chute'&&!dlg.length,'recarregar com escolha não gravada: fica na fila local, sem diálogo: '+J(fl)+' '+J(dlg));
    R.rotuloStatus=200;await espera(pg,()=>ETERNA.state.agent.on,8000);await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.trFila().length===0,5000);
    ok(R.posts.some(x=>x.b.pid===PIDS[11]&&x.b.ponto==='chute'),'a fila de antes de recarregar sobe ao abrir o Treino');
    // sair da conta
    await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    const nAntes=R.posts.length;await pg.click('[data-act="tr-go"][data-i="4"]');await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());await pg.keyboard.press('d');
    await pg.evaluate(()=>ETERNA.logout());await pg.waitForTimeout(800);
    const sai=R.posts.slice(nAntes).find(x=>x.b.pid===PIDS[4]);const fs2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.treino.fila.v1')||'[]'));
    ok((sai&&sai.b.duvida===true)||fs2.some(x=>x.pid===PIDS[4]&&x.corpo.duvida===true),'sair da conta grava a escolha (POST ou fila): '+J(R.posts.slice(nAntes).map(x=>x.b))+' '+J(fs2));
    await ctx.close();}
  // ---------- sem qualidade.u: sair da foto não grava nem avisa ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,null,true);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    await pg.evaluate(()=>{ETERNA.state.user.perms.qualidade=Object.assign({},ETERNA.state.user.perms.qualidade,{u:false});const t=ETERNA.state.train;const r=t.rasc[t.itens[0].pid];r.nivel='boa';r.ponto='gramado';ETERNA.render();});
    await pg.evaluate(()=>document.querySelector('#toast')&&(document.querySelector('#toast').textContent=''));
    await pg.click('[data-act="tr-next"]');await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());await pg.keyboard.press('ArrowRight');await pg.click('[data-act="tr-go"][data-i="0"]');
    await pg.evaluate(()=>ETERNA.go('painel'));await pg.waitForTimeout(500);
    ok(R.posts.length===0&&await pg.evaluate(()=>ETERNA.trFila().length)===0,'sem qualidade.u: Próxima, seta, grade e sair da tela não fazem POST: '+J(R.posts));
    ok(!/permiss/i.test(await pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'')),'sem qualidade.u: nenhum aviso a cada passo');
    await ctx.close();}
  // ---------- revisão 23/11: rascunho velho depois de Carregar, observação com espaço, recusa, "ver como", aba escondida, Z, Sair ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,null,true);
    const borda=i=>pg.$eval(`[data-act="tr-go"][data-i="${i}"]`,b=>b.style.borderColor+(b.classList.contains('tr-mini-nova')?' nova':''));
    const blur=()=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
    const toastTxt=()=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');const semToast=()=>pg.evaluate(()=>{const t=document.querySelector('#toast');if(t)t.textContent='';});
    const lab=(pid,ponto,em,por)=>({v:1,pid,ponto,qual:{nivel:'boa',motivos:[],ajuste:[]},ia:{serve:null,motivos:[],frente:null},duvida:false,obs:'',por,em});
    const carregar=async n=>{await pg.click('[data-act="tr-carregar"]');const t0=Date.now();while(R.amostra.length<n&&Date.now()-t0<8000)await pg.waitForTimeout(50);
      await espera(pg,()=>!ETERNA.state.train.carregando&&ETERNA.state.train.itens.length===12,8000);await pg.waitForTimeout(150);};
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    R.rot[PIDS[0]]=lab(PIDS[0],'gramado','2026-11-16T09:00:00.000','ana');R.rot[PIDS[7]]=lab(PIDS[7],'gramado','2026-11-16T09:00:00.000','ana');
    await carregar(1);
    ok(await pg.evaluate(p=>{const r=ETERNA.state.train.rasc[p];return !!r&&r.ponto==='gramado'&&r.base==='2026-11-16T09:00:00.000';},PIDS[0]),'a foto aberta tem o rascunho com a base do servidor');
    // 1. mudou em outro aparelho e a foto volta por um Carregar: a tela mostra o servidor e Próxima não grava o valor velho
    R.rot[PIDS[0]]=Object.assign(lab(PIDS[0],'arquibancada','2026-11-16T10:00:00.000','bia'),{qual:{nivel:'fraca',motivos:['desfocada'],ajuste:[]}});
    await carregar(2);
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="arquibancada"]',b=>b.getAttribute('aria-pressed'))==='true'&&!/nova/.test(await borda(0)),'depois de Carregar a foto mostra o rótulo novo do servidor, sem tracejado: '+await borda(0));
    await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(400);
    ok(R.posts.length===0,'rascunho velho de antes do Carregar não vira gravação com Próxima: '+J(R.posts.map(x=>x.b)));
    // a escolha que já subiu continua valendo depois de Carregar (mesma base)
    R.guarda=true;await blur();await pg.keyboard.press('c');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(200);
    ok(R.posts.length===1&&R.posts[0].b.pid===PIDS[1]&&R.posts[0].b.ponto==='chute','C e Próxima gravam: '+J(R.posts.map(x=>x.b.pid)));
    await carregar(3);await pg.click('[data-act="tr-go"][data-i="1"]');
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="chute"]',b=>b.getAttribute('aria-pressed'))==='true','a escolha que já subiu aparece depois de Carregar');
    await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(400);
    ok(R.posts.length===1,'a escolha que já subiu não grava de novo depois de Carregar: '+R.posts.length);
    // a escolha que ainda está só na fila também continua (amarela, sem gravar de novo)
    R.guarda=false;R.rotuloStatus=503;await blur();await pg.keyboard.press('t');await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(400);
    const f1=await pg.evaluate(()=>ETERNA.trFila());
    await carregar(4);await pg.click('[data-act="tr-go"][data-i="2"]');
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="trofeu"]',b=>b.getAttribute('aria-pressed'))==='true'&&/warn/.test(await borda(2)),'a escolha ainda na fila aparece depois de Carregar, amarela: '+await borda(2));
    await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(300);
    const f2=await pg.evaluate(()=>ETERNA.trFila());
    ok(f1.length===1&&f2.length===1&&f2[0].pid===PIDS[2]&&f2[0].t===f1[0].t&&f2[0].corpo.ponto==='trofeu','a escolha na fila não é regravada depois de Carregar: '+J([f1,f2]));
    R.rotuloStatus=200;await pg.evaluate(()=>ETERNA.trEnviar());await espera(pg,()=>ETERNA.trFila().length===0,5000);const nA=R.posts.length;
    // 2. observação: "ok " grava uma vez ("ok", como o servidor guarda) e passar de novo não grava; só espaços não grava
    await pg.click('[data-act="tr-go"][data-i="4"]');await pg.fill('[data-act="tr-obs"]','ok ');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(200);
    ok(R.posts.length===nA+1&&R.posts[nA].b.pid===PIDS[4]&&R.posts[nA].b.obs==='ok','observação "ok " grava uma vez, sem o espaço: '+J(R.posts.slice(nA).map(x=>x.b.obs)));
    await pg.click('[data-act="tr-prev"]');await pg.click('[data-act="tr-next"]');await pg.click('[data-act="tr-prev"]');await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(400);
    ok(R.posts.length===nA+1,'passar de novo pela foto com "ok " não faz POST: '+J(R.posts.slice(nA).map(x=>x.b.obs)));
    await pg.click('[data-act="tr-go"][data-i="5"]');await pg.fill('[data-act="tr-obs"]','   ');await pg.click('[data-act="tr-next"]');await pg.waitForTimeout(400);
    ok(R.posts.length===nA+1&&await pg.evaluate(()=>ETERNA.trFila().length)===0&&!/good|warn/.test(await borda(5)),'observação só de espaços não grava: '+J(R.posts.slice(nA).map(x=>x.b)));
    // 4. recusa do servidor (403): a miniatura não fica verde; volta ao que o servidor tem
    R.rotuloStatus=403;const nB=R.posts.length;await semToast();
    await pg.click('[data-act="tr-go"][data-i="6"]');await blur();await pg.keyboard.press('g');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(300);
    ok(R.posts.length===nB+1&&/recusou/.test(await toastTxt()),'403: avisa que o servidor recusou: '+await toastTxt());
    {const b6=await borda(6);const d6=await pg.evaluate(p=>ETERNA.state.train.docs[p]||null,PIDS[6]);
      ok(!/good|warn/.test(b6)&&!d6,'403 sem rótulo no servidor: a miniatura não fica verde e a foto segue sem marcação: '+b6+' '+J(d6));}
    await blur();await pg.keyboard.press('a');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0);await pg.waitForTimeout(300);
    {const d7=await pg.evaluate(p=>ETERNA.state.train.docs[p]||null,PIDS[7]);
      ok(R.posts.length===nB+2&&d7&&d7.ponto==='gramado'&&!d7.pend,'403 com rótulo no servidor: volta ao do servidor (gramado), sem pendência: '+J(d7));}
    await pg.click('[data-act="tr-go"][data-i="7"]');
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="gramado"]',b=>b.getAttribute('aria-pressed'))==='true'&&!/nova/.test(await borda(7)),'voltando à foto recusada, a tela mostra o que o servidor tem');
    R.rotuloStatus=200;
    // 4. "ver como" (Admin vê como o Validador): sair da foto não grava nem avisa, a fila pendente da pessoa fica intacta e Voltar não grava no nome do Admin
    await pg.route('**/auth/assumir',r=>{const c=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:c.usuario,cadastro:null,assumido_por:'admin.teste@exemplo.com',assumido_nome:'Admin de teste'})});});
    await pg.route('**/auth/voltar',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:'admin.teste@exemplo.com',cadastro:null})}));
    const nC=R.posts.length;await pg.evaluate(()=>ETERNA.go('usuarios'));await pg.click('[data-act="user-sel"][data-e="qualidade@eterna.photo"]');await pg.click('[data-act="user-assumir"]');
    ok(await espera(pg,()=>!!ETERNA.state.assumido&&ETERNA.state.user.email==='qualidade@eterna.photo'),'"ver como": entrou como o Validador');
    const FV=[{pid:PIDS[11],u:'qualidade@eterna.photo',t:5,corpo:{pid:PIDS[11],v:1,ponto:'outro',ia:{serve:null,motivos:[],frente:null},qual:{nivel:null,motivos:[],ajuste:[]},duvida:false,obs:'',base_em:null}}];
    await pg.evaluate(f=>localStorage.setItem('eterna.treino.fila.v1',JSON.stringify(f)),FV);
    await pg.evaluate(()=>ETERNA.go('treino'));await semToast();await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>!ETERNA.state.train.carregando&&ETERNA.state.train.itens.length===12);await pg.waitForTimeout(500);
    {const f=await pg.evaluate(()=>ETERNA.trFila());ok(J(f)===J(FV)&&!/recusou/.test(await toastTxt())&&R.posts.length===nC,'"ver como": Carregar não mexe na fila pendente da pessoa nem avisa recusa: '+J(f)+' '+await toastTxt());}
    await pg.click('[data-act="tr-go"][data-i="9"]');await blur();await pg.keyboard.press('c');await pg.click('[data-act="tr-next"]');await blur();await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(400);
    ok(R.posts.length===nC&&J(await pg.evaluate(()=>ETERNA.trFila()))===J(FV)&&!/recusou/.test(await toastTxt())&&!/good|warn/.test(await borda(9)),'"ver como": sair da foto não grava, não avisa e não pinta de verde: '+await toastTxt()+' '+await borda(9));
    // 24/11 (testador): Enter e Z no "ver como" não gravam (o atalho chamava trConfirmar/trDesfazer direto, sem o guardAct)
    await pg.evaluate(p=>ETERNA.state.train.desfaz.push({pid:p,j:3,ant:null}),PIDS[3]);await semToast();
    await blur();await pg.keyboard.press('Enter');await pg.waitForTimeout(200);const tE=await toastTxt();const jE=await pg.evaluate(()=>ETERNA.state.train.j);
    await semToast();await blur();await pg.keyboard.press('z');await pg.waitForTimeout(400);const tZ=await toastTxt();
    ok(R.posts.length===nC&&J(await pg.evaluate(()=>ETERNA.trFila()))===J(FV)&&jE===9&&/Só visualização/.test(tE)&&/Só visualização/.test(tZ),'"ver como": Enter e Z não gravam nem mexem na fila, avisam que é só visualização: '+J([tE,tZ,jE,R.posts.length-nC]));
    await pg.evaluate(()=>{ETERNA.state.train.desfaz.length=0;});
    // a foto 9 segue aberta com a escolha (C) feita no "ver como": Voltar para o Admin não a grava no nome dele
    await pg.click('[data-act="assumir-voltar"]');await espera(pg,()=>!ETERNA.state.assumido&&ETERNA.state.user.email==='admin.teste@exemplo.com');await pg.waitForTimeout(500);
    await pg.evaluate(()=>ETERNA.go('treino'));await pg.waitForTimeout(300);await pg.evaluate(()=>ETERNA.go('painel'));await pg.waitForTimeout(300);
    ok(R.posts.length===nC,'Voltar do "ver como" não grava no nome do Admin o que foi escolhido lá: '+J(R.posts.slice(nC).map(x=>x.b)));
    // a pendência da Validadora (FV, mostrada no Carregar do "ver como") não fica na tela do Admin nem entra na gravação dele
    ok(await pg.evaluate(p=>!(p in ETERNA.state.train.docs)&&!ETERNA.state.train.itens.length,PIDS[11]),'Voltar do "ver como": a pendência da Validadora não fica na tela do Admin: '+J(await pg.evaluate(p=>ETERNA.state.train.docs[p]||null,PIDS[11])));
    await pg.evaluate(()=>ETERNA.go('treino'));await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>!ETERNA.state.train.carregando&&ETERNA.state.train.itens.length===12);await pg.waitForTimeout(300);
    await pg.click('[data-act="tr-go"][data-i="11"]');
    ok(await pg.$eval('[data-act="tr-ponto"][data-p="outro"]',b=>b.getAttribute('aria-pressed'))!=='true'&&!/warn/.test(await borda(11)),'Admin no Treino: a foto da pendência da Validadora não mostra a escolha dela: '+await borda(11));
    await blur();await pg.keyboard.press('p');await pg.click('[data-act="tr-next"]');await espera(pg,p=>!ETERNA.trFila().some(x=>x.pid===p&&x.u==='admin.teste@exemplo.com'),5000,PIDS[11]);await pg.waitForTimeout(300);
    {const g=R.posts.slice(nC).map(x=>x.b);ok(g.length===1&&g[0].pid===PIDS[11]&&g[0].ponto===null&&g[0].qual.nivel==='boa','Admin passa pela foto: grava só a escolha dele, sem o "outro" da Validadora: '+J(g));}
    await pg.evaluate(()=>{localStorage.setItem('eterna.treino.fila.v1','[]');ETERNA.go('treino');});
    // 5. aba escondida (iOS sem pagehide): vai para a fila uma vez só
    R.rotuloStatus=503;const nD=R.posts.length;await pg.click('[data-act="tr-go"][data-i="10"]');await blur();await pg.keyboard.press('o');
    const esconde=()=>pg.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
    await esconde();const g1=await pg.evaluate(()=>ETERNA.trFila());
    await esconde();await pg.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await pg.waitForTimeout(300);const g2=await pg.evaluate(()=>ETERNA.trFila());
    await pg.evaluate(()=>{delete document.visibilityState;});
    ok(g1.length===1&&g1[0].pid===PIDS[10]&&g1[0].corpo.ponto==='outro','aba escondida: a escolha vai para a fila local: '+J(g1));
    ok(g2.length===1&&g2[0].t===g1[0].t&&R.posts.length===nD+1,'esconder de novo e o pagehide não gravam em duplicidade: '+J(g2)+' posts '+(R.posts.length-nD));
    R.rotuloStatus=200;await pg.evaluate(()=>ETERNA.trEnviar());await espera(pg,()=>ETERNA.trFila().length===0,5000);
    await ctx.close();}
  // ---------- 24/11 (testador): Enter e Z no "ver como"; Voltar, Sair e a pessoa vista entra de verdade: nada sobe no nome dela ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,null,true);const adm=await pg.evaluate(()=>ETERNA.state.user.email);
    const blur=()=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
    await pg.route('**/auth/assumir',r=>{const c=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:c.usuario,cadastro:null,assumido_por:adm,assumido_nome:'Admin de teste'})});});
    await pg.route('**/auth/voltar',r=>r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:adm,cadastro:null})}));
    await pg.evaluate(()=>ETERNA.go('usuarios'));await pg.click('[data-act="user-sel"][data-e="qualidade@eterna.photo"]');await pg.click('[data-act="user-assumir"]');
    ok(await espera(pg,()=>!!ETERNA.state.assumido&&ETERNA.state.user.email==='qualidade@eterna.photo'),'"ver como" (Enter/Z): entrou como o Validador');
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12&&!ETERNA.state.train.carregando);await pg.waitForTimeout(200);
    // G e Enter na foto 0; um Desfazer pendente e Z; G, P, N, D, 1 e setas na foto 1
    await blur();await pg.keyboard.press('g');await pg.keyboard.press('Enter');await pg.waitForTimeout(200);
    await pg.evaluate(p=>ETERNA.state.train.desfaz.push({pid:p,j:0,ant:null}),PIDS[0]);await blur();await pg.keyboard.press('z');await pg.waitForTimeout(200);
    for(const k of ['ArrowRight','a','p','n','1','d','ArrowRight','ArrowLeft','ArrowLeft'])await pg.keyboard.press(k);await pg.waitForTimeout(400);
    ok(R.posts.length===0&&(await pg.evaluate(()=>ETERNA.trFila())).length===0,'"ver como": Enter, Z, letras e setas não gravam nem põem na fila: '+J(await pg.evaluate(()=>ETERNA.trFila())));
    ok(await pg.evaluate(()=>ETERNA.state.train.j)===0,'"ver como": as setas navegam, Enter não avança');
    await pg.click('[data-act="assumir-voltar"]');await espera(pg,()=>!ETERNA.state.assumido&&ETERNA.state.user.email===adm);await pg.waitForTimeout(400);
    await pg.evaluate(()=>ETERNA.logout());await pg.waitForTimeout(1200);
    await pg.goto(U);await pg.waitForTimeout(300);await entrarTeste(pg,'qualidade@eterna.photo');await espera(pg,()=>ETERNA.state.agent.on,8000);
    await pg.evaluate(()=>ETERNA.go('treino'));await pg.waitForTimeout(2000);
    ok(await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email)==='qualidade@eterna.photo'&&(await pg.evaluate(()=>ETERNA.trFila())).length===0&&R.posts.length===0,
      'Voltar, Sair e o Validador entra de verdade: a fila está vazia e nenhum POST /treino/rotulo sobe com a escolha do Admin: '+J(R.posts.map(x=>x.b)));
    await ctx.close();}
  // ---------- revisão 23/11: Z com escolha na foto atual; Sair espera o POST ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,null,true);
    const borda=i=>pg.$eval(`[data-act="tr-go"][data-i="${i}"]`,b=>b.style.borderColor+(b.classList.contains('tr-mini-nova')?' nova':''));
    const blur=()=>pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    await pg.click('[data-act="tr-go"][data-i="6"]');await blur();await pg.keyboard.press('g');await pg.click('[data-act="tr-next"]');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===7);
    // marca na 7 e aperta Z: a 7 é gravada (entra no Desfazer) e a 6 é desfeita; a tela volta para a 6
    await blur();await pg.keyboard.press('a');await pg.keyboard.press('z');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===6);await pg.waitForTimeout(200);
    {const z=R.posts.slice(1).map(x=>x.b);const g7=z.find(b=>b.pid===PIDS[7]),v6=z.find(b=>b.pid===PIDS[6]);
      ok(R.posts.length===3&&g7&&g7.ponto==='arquibancada'&&v6&&v6.ponto===null&&v6.qual.nivel===null,'Z com escolha na foto atual: grava a 7 e desfaz a 6: '+J(z));
      ok(/good/.test(await borda(7))&&!/good|warn/.test(await borda(6))&&await pg.evaluate(()=>ETERNA.state.train.j)===6,'depois do primeiro Z: a 7 verde, a 6 sem marcação e a tela na 6: '+await borda(7)+' '+await borda(6));}
    // segundo Z desfaz a 7 (a gravação feita pelo primeiro Z) e volta para ela; a 6 desfeita não grava de novo
    await blur();await pg.keyboard.press('z');await espera(pg,()=>ETERNA.trFila().length===0&&ETERNA.state.train.j===7);await pg.waitForTimeout(200);
    {const z=R.posts[3]&&R.posts[3].b;
      ok(R.posts.length===4&&z.pid===PIDS[7]&&z.ponto===null&&z.qual.nivel===null&&!/good|warn/.test(await borda(7)),'segundo Z desfaz a 7 e não regrava a 6: '+J(R.posts.slice(3).map(x=>x.b)));}
    await blur();await pg.keyboard.press('z');await pg.waitForTimeout(300);
    ok(R.posts.length===4&&/Nada para desfazer|nada/i.test(await pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'')),'terceiro Z: nada para desfazer');
    // 3. sair da conta espera o POST da escolha (até 2 s) antes do /auth/sair
    await pg.route('**/auth/sair',r=>{R.ordem.push('sair');r.fallback();});
    R.atraso=600;R.ordem.length=0;await pg.click('[data-act="tr-go"][data-i="3"]');await blur();await pg.keyboard.press('t');
    await pg.evaluate(()=>ETERNA.logout());await pg.waitForTimeout(1500);
    ok(J(R.ordem)===J(['rotulo','sair'])&&R.posts.some(x=>x.b.pid===PIDS[3]&&x.b.ponto==='trofeu')&&await pg.evaluate(()=>ETERNA.trFila().length)===0,'sair da conta: o POST da escolha termina antes do /auth/sair: '+J(R.ordem));
    ok(await pg.evaluate(()=>!ETERNA.state.user&&ETERNA.state.view==='entrar'&&!Object.keys(ETERNA.state.train.docs).length),'sair da conta: a tela troca na hora e a próxima pessoa não recebe a marcação');
    // servidor fora: não segura mais de 2 s e a escolha fica na fila
    R.atraso=0;R.rotuloStatus=503;await entrarTeste(pg,'admin.teste@exemplo.com');await espera(pg,()=>ETERNA.state.agent.on,8000);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    R.ordem.length=0;await pg.click('[data-act="tr-go"][data-i="8"]');await blur();await pg.keyboard.press('c');
    const t0=Date.now();await pg.evaluate(()=>ETERNA.logout());await espera(pg,()=>true,10);
    while(Date.now()-t0<4000&&!R.ordem.includes('sair'))await pg.waitForTimeout(50);
    const fs3=await pg.evaluate(()=>ETERNA.trFila());
    ok(R.ordem.includes('sair')&&Date.now()-t0<2800&&fs3.some(x=>x.pid===PIDS[8]&&x.corpo.ponto==='chute'),'sem servidor: o /auth/sair não espera além de 2 s e a escolha fica na fila: '+J(R.ordem)+' '+(Date.now()-t0)+'ms '+J(fs3.map(x=>x.pid)));
    // /auth/sair que nunca responde: o login seguinte entra (o fetch do /auth/sair tem limite)
    await pg.route('**/auth/sair',()=>{R.ordem.push('mudo');});
    R.rotuloStatus=200;await pg.evaluate(()=>localStorage.setItem('eterna.treino.fila.v1','[]'));
    await entrarTeste(pg,'admin.teste@exemplo.com');await espera(pg,()=>!!ETERNA.state.user,3000);
    await pg.evaluate(()=>ETERNA.logout());const t1=Date.now();await entrarTeste(pg,'admin.teste@exemplo.com');
    {const entrou=await espera(pg,()=>!!ETERNA.state.user&&!ETERNA.state.auth.busy,8000);
      ok(entrou&&R.ordem.includes('mudo'),'/auth/sair mudo: o login seguinte entra mesmo assim ('+(Date.now()-t1)+' ms, '+J(R.ordem)+')');}
    await ctx.close();}
  // ---------- Supervisora: marca, muda o interruptor; migração única ----------
  {const {ctx,pg,R}=await nova();await pg.goto(U);await pg.waitForTimeout(200);
    // cadastro antigo da Supervisora, sem qualidade.u (antes de 16/11)
    await pg.evaluate(()=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));const s=U0['supervisor@eterna.photo'];
      s.perms.qualidade={c:false,r:true,u:false,d:false};delete s.mtr16;const c=U0['qualidade@eterna.photo'];localStorage.setItem('eterna.users.v1',JSON.stringify(U0));localStorage.removeItem('eterna.users.log.v1');});
    await pg.reload();await pg.waitForTimeout(300);
    const mig=await pg.evaluate(()=>{const u=ETERNA.USERS['supervisor@eterna.photo'];const l=JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>e.acao==='migracao_treino16');return {u:u.perms.qualidade,m:u.mtr16,n:l.length,alvo:l[0]&&l[0].alvo,pre:ETERNA.PRESETS.supervisor.perms.qualidade};});
    ok(mig.u.u===true&&mig.u.r===true&&!mig.u.c&&!mig.u.d&&mig.m===1&&mig.n===1&&mig.alvo==='supervisor@eterna.photo'&&mig.pre.u===true&&!mig.pre.c,'migração única dá qualidade.u à Supervisora, com auditoria: '+J(mig));
    await pg.reload();await pg.waitForTimeout(300);
    ok(await pg.evaluate(()=>JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(e=>e.acao==='migracao_treino16').length)===1,'a migração roda uma vez só');
    await entrarTeste(pg,'supervisor@eterna.photo');await espera(pg,()=>ETERNA.state.agent.on,8000);
    // marcação que ficou na fila antes de recarregar a página sobe ao abrir a tela (sem precisar Carregar)
    await pg.evaluate(p=>localStorage.setItem('eterna.treino.fila.v1',JSON.stringify([{pid:p,u:'supervisor@eterna.photo',t:1,corpo:{pid:p,v:1,ponto:'outro',ia:{serve:null,motivos:[],frente:null},qual:{nivel:null,motivos:[],ajuste:[]},duvida:false,obs:'',base_em:null}}])),PIDS[5]);
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    ok(await espera(pg,()=>ETERNA.trFila().length===0,5000)&&R.posts.length===1&&R.posts[0].b.pid===PIDS[5],'fila de antes de recarregar sobe ao abrir a tela: '+J(R.posts));R.posts.length=0;
    await pg.click('[data-act="tr-carregar"]');await espera(pg,()=>ETERNA.state.train.itens.length===12);
    await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());await pg.keyboard.press('c');await pg.keyboard.press('Enter');await pg.waitForTimeout(400);
    ok(R.posts.length===1&&R.posts[0].b.ponto==='chute','Supervisora marca: '+J(R.posts));
    await pg.evaluate(()=>{ETERNA.state.catTab='fundos';ETERNA.go('catalogo');});await espera(pg,()=>document.querySelector('#tr-cfg'));
    ok((await pg.$$('#tr-cfg [data-act="tr-cfg"]')).length===4,'Supervisora (Painel de controle em Alterar) vê os 4 botões em Configurações › Fundos de IA');
    await ctx.close();}
  // ---------- Validador: marca, mas não muda o interruptor ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,'qualidade@eterna.photo');
    await pg.evaluate(()=>ETERNA.go('treino'));await espera(pg,()=>ETERNA.state.train.dias&&ETERNA.state.train.dias.length);
    ok(!await pg.$('#tr-cfg')&&!await pg.$('[data-act="tr-cfg"]')&&!await pg.$('.tr-aviso-desl [data-act="tr-cfg-abrir"]')&&/Fundos de IA automáticos desligados/.test(await pg.textContent('.tr-aviso-desl').catch(()=>'')),'sem Painel de controle: nada do interruptor, só o aviso sem o botão');
    await pg.evaluate(()=>{const b=document.createElement('button');b.dataset.act='tr-cfg';b.dataset.k='ponto';b.dataset.v='on';b.id='tx';document.querySelector('#main').appendChild(b);b.click();});await pg.waitForTimeout(300);
    ok(R.cfg.length===0,'tr-cfg sem configuracao.u não chega ao servidor: '+J(R.cfg));
    await ctx.close();}
  // ---------- quem não tem Qualidade e IA em Ver não lê a coleção treino ----------
  {const {ctx,pg,R}=await nova();await entrar(pg,'carlos@eterna.photo');await pg.waitForTimeout(3500);
    ok(await pg.evaluate(()=>!ETERNA.can('qualidade','r')),'o fotógrafo não tem Qualidade e IA');
    ok(R.cols.size>0&&!R.cols.has('treino'),'a coleção treino não é lida por quem não tem qualidade.r: '+J([...R.cols]));
    await ctx.close();}
  // ---------- textos novos nas 5 línguas, sem travessão ----------
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(200);
    const r=await pg.evaluate(()=>{const E=ETERNA.EQ;const ks=Object.keys(E).filter(k=>/^tr_(an|aba|p_|m_|dia|fila|teclas|conflito|eyebrow2|out_nota|amostra|sem_servidor|cfg_|ia_|ponto_nota|qual_nota|aviso_desl|res_onde)/.test(k));
      return {n:ks.length,ruins:ks.filter(k=>E[k].length!==5||E[k].some(v=>{const t=typeof v==='function'?v(1,2,3):v;return !t||/[—–]/.test(t);}))};});
    ok(r.n>=25&&!r.ruins.length,'textos do treino nas 5 línguas, sem travessão: '+J(r));
    await ctx.close();}
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,600));}
await b.close();
console.log((fails.length?'FALHA':'OK')+' treino: Marcar com fotos do servidor (teclado, toque, fila só de texto, nada de foto no aparelho), interruptor da análise, Supervisora marca, Outubro só leitura'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);
})();
