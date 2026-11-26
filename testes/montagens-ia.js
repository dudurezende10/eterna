// 26/11 (plano docs/planos/2026-11-26-montagens-ia-curadoria.md): a tela Curadoria › Montagens de IA.
//  1 menu: depois da Lixeira da IA para Admin e Supervisora (também a já gravada, pela migração); Fotógrafo, venda e Validador não veem
//  2 lista: lotes de 24 com rolagem contínua, cartão com a montagem, a original, o fundo, a sessão, o fotógrafo e a hora; contadores
//  3 filtros: dia (vai ao servidor), fundo, situação (padrão Sem nota) e fotógrafo
//  4 nota: Boa; Ruim com motivos (chips, vários); trocar; desfazer; a nota fica à vista; o POST leva pid, fundo, v, motivos e idem
//  5 falha do POST desfaz com aviso; 404 avisa; "ver como" não grava; só Ver (qualidade.r) não tem botões
//  6 estados vazios: sem servidor, erro, montagem desligada, ainda sem montagens hoje, dia fora da guarda, filtro vazio
//  7 zoom com a montagem e a original; 390 px com duas colunas, sem rolagem lateral e botões de 44 px; 5 línguas sem chave crua nem travessão
// O agente é falso (page.route na própria origem; o servidor de verdade está em testes/montagens_ia_agente.py). Nenhuma foto de cliente:
// as imagens são desenhadas aqui. MN_PRINTS=<pasta> guarda os prints (sem a variável, nenhum print é gravado).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.MN_PRINTS||'';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const ONTEM=addD(HOJE,-1),ANTE=addD(HOJE,-2);
const JPG=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(600,400),(30,90,60));d=ImageDraw.Draw(im);d.ellipse([250,80,350,200],fill=(200,170,140));d.rectangle([220,200,380,400],fill=(240,240,235))
b=io.BytesIO();im.save(b,'JPEG',quality=85);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim();
const FOTO=Buffer.from(JPG,'base64');
const FUNDOS=['mirantedia','arq1950','telao','tunel'];
const pidDe=i=>'c0ffee'+String(i).padStart(6,'0');
// hoje: 15 bases x 4 fundos = 60 montagens (marcio nas 10 primeiras bases, yago nas outras); ontem: 1
function base(dia){const its=[];
  if(dia===HOJE)for(let i=0;i<15;i++)FUNDOS.forEach((f,k)=>its.push({pid:pidDe(i),fundo:f,sessao:'LP'+String(100+i),fotografo:i<10?'marcio':'yago',hora:'10:'+String(59-i).padStart(2,'0'),t:1000-i,preferida:k!==2,vendida:i===0&&k===0,nota:null}));
  else if(dia===ONTEM)its.push({pid:pidDe(900),fundo:'telao',sessao:'LP900',fotografo:'marcio',hora:'16:20',t:10,preferida:true,vendida:false,nota:null});
  return its;}
function lista(R,dia,de){const todos=R.vazio?[]:base(dia).map(x=>Object.assign({},x,{nota:R.notas[x.pid+'|'+x.fundo]||null}));
  const b=todos.filter(x=>x.nota&&x.nota.v==='boa').length,r=todos.filter(x=>x.nota&&x.nota.v==='ruim').length;const guarda=dia<ANTE;
  return {v:1,dia,hoje:HOJE,modo:R.modo,guarda_dias:2,fundos:FUNDOS,motivos:['pequena','recorte','corte','lugar','luz','outro'],itens:guarda?[]:todos.slice(de,de+R.max),de,total:todos.length,mais:!guarda&&de+R.max<todos.length,
    motivo:guarda?'guarda':todos.length?null:R.modo==='desligada'?'desligada':'nenhuma',n:{prontas:todos.length,sem_nota:todos.length-b-r,boas:b,ruins:r}};}
async function agente(ctx,R){const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});
  Object.assign(R,{listas:[],posts:[],notas:{},modo:'sombra',max:2000,vazio:false,falha:0,previas:[],erroLista:false,semAgente:false});
  await ctx.route(ORIG+'/status',r=>R.semAgente?r.abort():js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bmn',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},
    treino:{v:1,rotulos:0,analise:{ponto:'medir',exposicao:'medir'},modelo_ponto:null,ajuste:null},lixeira:{v:1,on:true,modo:'medir',rev:1,hoje:0,n7:0,dias:7,valendo:[],hoje_fora:0},
    montagem:{v:1,modo:R.modo,ok:true,motivo:null,versao:'m2',imprime:true,montaveis:FUNDOS,ativos:FUNDOS,fila:0,feitas:0,erros:0},
    sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'bmn',hoje:1,abertas:0,dias:1}}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'bmn',rev:1,pausa:60,rostos:true,completo:true,sessoes:[]}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/metricas/dia*',r=>js(r,{ok:true,dias:[]}));
  await ctx.route(ORIG+'/fotografos/alertas*',r=>js(r,{ok:true,v:1,fotografos:[],alertas:[],equipe:{}}));
  await ctx.route(ORIG+'/lixeira*',r=>js(r,{v:1,dia:HOJE,on:true,modo:'medir',valendo:[],n:0,recuperadas:0,itens:[],dias:[],mais:false}));
  await ctx.route(ORIG+'/thumb/*',r=>r.fulfill({status:200,contentType:'image/jpeg',body:FOTO}));
  await ctx.route(ORIG+'/file/*',r=>r.fulfill({status:200,contentType:'image/jpeg',body:FOTO}));
  await ctx.route(ORIG+'/montagens/previa/**',r=>{R.previas.push(new URL(r.request().url()).pathname);r.fulfill({status:200,contentType:'image/jpeg',body:FOTO});});
  await ctx.route(ORIG+'/montagens/nota',r=>{const b=JSON.parse(r.request().postData()||'{}');R.posts.push({h:r.request().headers(),b});
    if(R.falha){const st=R.falha;return js(r,{ok:false,error:st===404?'montagem':'erro no servidor'},st);}
    const k=b.pid+'|'+b.fundo;if(b.v===null)delete R.notas[k];else R.notas[k]={v:b.v,motivos:b.motivos||[],por:'admin.teste@exemplo.com',nome:'Admin de teste',em:new Date().toISOString(),atual:true};
    js(r,{ok:true,nota:R.notas[k]||null});});
  await ctx.route(ORIG+'/montagens/dia*',r=>{const q=new URL(r.request().url()).searchParams;const dia=q.get('dia')||HOJE,de=+(q.get('de')||0);R.listas.push({dia,de});
    if(R.erroLista)return js(r,{error:'erro no servidor'},500);js(r,lista(R,dia,de));});}
function usuario(pg,email,nome,preset,extra){return pg.evaluate(([e,n,p,x])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]=Object.assign({v:2,email:e,name:n,active:true,preset:p,perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p),key:null},x||{});localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,preset,extra]);}
(async()=>{if(PRINTS)fs.mkdirSync(PRINTS,{recursive:true});const b=await chromium.launch();const errs=[];
const print=async(pg,nome,o)=>{if(PRINTS)await pg.screenshot(Object.assign({path:path.join(PRINTS,nome)},o||{}));};
const nova=async(vp,prep)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);if(prep)prep(R);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg,R};};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
const entra=async(pg,email,nome,preset,extra,semAgente)=>{await pg.goto(U);await pg.waitForTimeout(300);if(preset==='admin'){email=await entrarTeste.adminFicticio(pg);}else{await usuario(pg,email,nome,preset,extra);await pg.reload();await pg.waitForTimeout(300);}
  await entrarTeste(pg,email);await espera(pg,()=>!!ETERNA.state.user,15000);if(!semAgente)await espera(pg,()=>ETERNA.state.agent.on,20000);return email;};
const menu=pg=>pg.$$eval('#nav [data-act="view"]',x=>x.map(e=>e.dataset.v));
const cartoes=pg=>pg.$$eval('#mn-lista .mn-item',x=>x.length).catch(()=>0);
const conta=pg=>pg.$$eval('#mn-conta .mn-nums',x=>x.map(l=>[...l.querySelectorAll('.mn-num b')].map(e=>+e.textContent)));
const abre=async(pg,n)=>{await pg.evaluate(()=>ETERNA.go('montagens'));return espera(pg,n=>document.querySelectorAll('#mn-lista .mn-item').length===n,8000,n==null?24:n);};
const K=(i,f)=>pidDe(i)+'|'+f;const sel=(act,k)=>`[data-act="${act}"][data-k="${k}"]`;
try{
  // ---------- 1 a 7: Admin a 1280 px ----------
  {const {ctx,pg,R}=await nova({width:1280,height:900});await entra(pg,null,null,'admin');
    ok(await abre(pg),'2: o primeiro lote tem 24 montagens: '+await cartoes(pg));
    const mv=await menu(pg);ok(mv.indexOf('montagens')===mv.indexOf('lixeira')+1&&mv.indexOf('lixeira')>=0,'1: Montagens de IA logo depois da Lixeira no menu do Admin: '+J(mv));
    const h1=(await pg.textContent('#main h1')).trim();ok(h1==='Montagens de IA','título: '+h1);ok(/Curadoria/i.test(await pg.textContent('#main .eyebrow')),'cabeçalho da Curadoria');
    ok(J(await conta(pg))===J([[60,60,0,0]]),'2: contadores do dia (prontas, sem nota, boas, ruins): '+J(await conta(pg)));
    ok(R.listas.length===1&&R.listas[0].dia===HOJE,'2: um pedido da lista, de hoje: '+J(R.listas));
    const c0=await pg.$eval('#mn-lista .mn-item',e=>({k:e.dataset.k,m:e.querySelector('.mn-m').getAttribute('src'),o:e.querySelector('.mn-o').getAttribute('src'),t:e.querySelector('.mn-info').textContent.replace(/\s+/g,' ').trim(),
      n:e.querySelector('.mn-nota').textContent.trim(),b:[...e.querySelectorAll('.mn-bts .btn')].map(x=>x.textContent)}));
    ok(c0.k===K(0,'mirantedia')&&c0.m.endsWith('/montagens/previa/'+pidDe(0)+'/mirantedia.jpg')&&c0.o.endsWith('/thumb/'+pidDe(0)),'2: o cartão mostra a prévia do servidor e a original: '+J(c0));
    ok(/Mirante do Rio/.test(c0.t)&&/LP100 · .+ · 10:59/.test(c0.t)&&/Já vendida/.test(c0.t)&&c0.n==='Sem nota'&&J(c0.b)===J(['Boa','Ruim']),'2: fundo, sessão, fotógrafo, hora, vendida e os dois botões: '+J(c0));
    ok(/foto reserva/.test(await pg.textContent(`.mn-item[data-k="${K(0,'telao')}"] .mn-info`)),'2: a base que não é a preferida do fundo avisa');
    // rolagem contínua: mais lotes de 24, sem pedir a lista de novo
    await pg.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===48),'2: a rolagem traz o segundo lote: '+await cartoes(pg));
    await pg.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===60&&!document.getElementById('mn-fim')),'2: e o resto, até acabar: '+await cartoes(pg));
    ok(R.listas.length===1,'2: a rolagem não vai ao servidor');await pg.evaluate(()=>window.scrollTo(0,0));
    // 3: filtros
    await pg.click('[data-act="mn-fundo"][data-f="telao"]');ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===15),'3: fundo Telão = 15: '+await cartoes(pg));
    ok(J(await conta(pg))===J([[60,60,0,0],[15,15,0,0]]),'3: contadores do dia e do filtro: '+J(await conta(pg)));
    const fo=await pg.$$eval('[data-act="mn-fot"] option',x=>x.map(o=>o.value));ok(J(fo)===J(['todos','marcio','yago']),'3: fotógrafos do dia: '+J(fo));
    await pg.selectOption('[data-act="mn-fot"]','yago');ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===5),'3: Telão do yago = 5: '+await cartoes(pg));
    await pg.click('[data-act="mn-sit"][data-s="boa"]');ok(await espera(pg,()=>/Nenhuma montagem neste filtro/.test(document.querySelector('#main').textContent)),'6: filtro sem montagem mostra o vazio');
    await pg.click('[data-act="mn-sit"][data-s="todas"]');await pg.click('[data-act="mn-fundo"][data-f="todos"]');await pg.selectOption('[data-act="mn-fot"]','todos');
    ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===24),'3: Todas volta aos lotes de 24');
    await pg.click('[data-act="mn-sit"][data-s="sem"]');await espera(pg,()=>document.querySelector('[data-act="mn-sit"][data-s="sem"]').getAttribute('aria-pressed')==='true');
    const dias=await pg.$$eval('[data-act="mn-dia"] option',x=>x.map(o=>o.value));ok(J(dias)===J([HOJE,ONTEM,ANTE]),'3: dias da guarda no filtro: '+J(dias));
    // 4: Boa
    const k1=K(0,'mirantedia');await pg.click(sel('mn-boa',k1));
    ok(await espera(pg,k=>{const e=document.querySelector(`.mn-item[data-k="${k}"]`);return e&&e.classList.contains('mn-boa')&&/Boa/.test(e.querySelector('.mn-nota .pill').textContent)&&!e.querySelector('.mn-boa[disabled]');},5000,k1),'4: a montagem fica como Boa e continua à vista');
    const p0=R.posts[0]||{b:{}};ok(R.posts.length===1&&p0.b.pid===pidDe(0)&&p0.b.fundo==='mirantedia'&&p0.b.v==='boa'&&J(p0.b.motivos)==='[]'&&/^[A-Za-z0-9_-]{8,64}$/.test(p0.b.idem||'')
      &&J(Object.keys(p0.b).sort())===J(['fundo','idem','motivos','pid','v'])&&p0.h['x-eterna']==='1','4: o POST leva pid, fundo, v, motivos e idem: '+J(p0.b));
    ok(/por Admin de teste às \d\d:\d\d/.test(await pg.textContent(`.mn-item[data-k="${k1}"] .mn-nota`)),'4: quem marcou e a hora');
    ok(J(await conta(pg))===J([[60,59,1,0]]),'4: os contadores mudam sem recarregar: '+J(await conta(pg)));
    ok(R.listas.length===1&&(await cartoes(pg))===24,'4: dar nota não redesenha nem pede a lista');
    await pg.click(sel('mn-boa',k1));await pg.waitForTimeout(200);ok(R.posts.length===1,'4: Boa de novo não grava outra vez');
    // 4: Ruim com motivos
    const k2=K(0,'arq1950');await pg.click(sel('mn-ruim',k2));
    ok(await espera(pg,k=>document.querySelectorAll(`.mn-item[data-k="${k}"] [data-act="mn-mot"]`).length===6,3000,k2),'4: Ruim abre os 6 motivos');ok(R.posts.length===1,'4: abrir os motivos ainda não grava');
    const mt=await pg.$$eval(`.mn-item[data-k="${k2}"] [data-act="mn-mot"]`,x=>x.map(e=>e.textContent));
    ok(J(mt)===J(['Pessoa pequena','Recorte com sujeira ou falha na borda','Corte errado: perna, braço ou cabeça','Não é gramado: arquibancada ou sentado','Luz: escura, estourada ou cor','Outro']),'4: os motivos fixos: '+J(mt));
    await pg.click(`${sel('mn-mot',k2)}[data-m="luz"]`);await pg.click(`${sel('mn-mot',k2)}[data-m="pequena"]`);await pg.click(`${sel('mn-mot',k2)}[data-m="outro"]`);await pg.click(`${sel('mn-mot',k2)}[data-m="outro"]`);
    ok(J(await pg.$$eval(`.mn-item[data-k="${k2}"] [data-act="mn-mot"][aria-pressed="true"]`,x=>x.map(e=>e.dataset.m)))===J(['pequena','luz']),'4: vários motivos marcados; tocar de novo desmarca');
    await pg.click(sel('mn-grava',k2));
    ok(await espera(pg,k=>{const e=document.querySelector(`.mn-item[data-k="${k}"]`);return e&&e.classList.contains('mn-ruim')&&/Pessoa pequena, Luz: escura, estourada ou cor/.test(e.querySelector('.mn-nota').textContent)&&!e.querySelector('[data-act="mn-mot"]');},5000,k2),'4: fica Ruim com os motivos e o painel fecha');
    const p1=R.posts[1]||{b:{}};ok(R.posts.length===2&&p1.b.v==='ruim'&&J(p1.b.motivos)===J(['pequena','luz'])&&p1.b.fundo==='arq1950'&&p1.b.idem!==p0.b.idem,'4: o POST do ruim leva os motivos na ordem fixa: '+J(p1.b));
    ok(J(await conta(pg))===J([[60,58,1,1]]),'4: contadores com a ruim: '+J(await conta(pg)));
    // trocar: a Boa vira Ruim, com os motivos de antes vazios; a Ruim abre com os motivos já marcados
    await pg.click(sel('mn-ruim',k2));ok(J(await pg.$$eval(`.mn-item[data-k="${k2}"] [data-act="mn-mot"][aria-pressed="true"]`,x=>x.map(e=>e.dataset.m)))===J(['pequena','luz']),'4: reabrir mostra os motivos gravados');
    await pg.click(sel('mn-ruim',k1));ok((await pg.$$(`.mn-item[data-k="${k2}"] [data-act="mn-mot"]`)).length===0&&(await pg.$$(`.mn-item[data-k="${k1}"] [data-act="mn-mot"]`)).length===6,'4: um painel de motivos por vez');
    await pg.click(sel('mn-fecha',k1));ok((await pg.$$('[data-act="mn-mot"]')).length===0&&R.posts.length===2,'4: Cancelar fecha sem gravar');
    await pg.click(sel('mn-boa',k2));ok(await espera(pg,k=>document.querySelector(`.mn-item[data-k="${k}"]`).classList.contains('mn-boa'),5000,k2),'4: trocar de Ruim para Boa');
    ok(R.posts.length===3&&R.posts[2].b.v==='boa'&&J(await conta(pg))===J([[60,58,2,0]]),'4: a troca grava e acerta os contadores: '+J(await conta(pg)));
    // desfazer
    await pg.click(sel('mn-desfaz',k2));ok(await espera(pg,k=>{const e=document.querySelector(`.mn-item[data-k="${k}"]`);return !e.classList.contains('mn-boa')&&/Sem nota/.test(e.querySelector('.mn-nota').textContent)&&!e.querySelector('[data-act="mn-desfaz"]');},5000,k2),'4: desfazer volta para Sem nota');
    ok(R.posts.length===4&&R.posts[3].b.v===null&&J(R.posts[3].b.motivos)==='[]'&&J(await conta(pg))===J([[60,59,1,0]]),'4: o desfazer vai ao servidor com v null: '+J(R.posts[3]&&R.posts[3].b));
    // 5: falha do POST desfaz com aviso
    const k3=K(0,'telao');R.falha=500;await pg.click(sel('mn-boa',k3));
    ok(await espera(pg,()=>/A nota não foi gravada\. Tente de novo\./.test(document.querySelector('#toast').textContent)),'5: a falha avisa: '+await pg.textContent('#toast'));
    ok(await espera(pg,k=>{const e=document.querySelector(`.mn-item[data-k="${k}"]`);return !e.classList.contains('mn-boa')&&/Sem nota/.test(e.querySelector('.mn-nota').textContent)&&!e.querySelector('.mn-boa[disabled]');},5000,k3)&&J(await conta(pg))===J([[60,59,1,0]]),'5: a falha desfaz a nota na tela e nos contadores: '+J(await conta(pg)));
    await pg.click(sel('mn-ruim',k1));await pg.click(`${sel('mn-mot',k1)}[data-m="corte"]`);await pg.click(sel('mn-grava',k1));
    ok(await espera(pg,k=>{const e=document.querySelector(`.mn-item[data-k="${k}"]`);return e.classList.contains('mn-boa')&&!e.querySelector('.mn-boa[disabled]');},5000,k1)&&J(await conta(pg))===J([[60,59,1,0]]),'5: a troca que falha volta para a nota de antes (Boa)');
    R.falha=404;await pg.click(sel('mn-boa',k3));ok(await espera(pg,()=>/Esta montagem não está mais no servidor/.test(document.querySelector('#toast').textContent)),'5: 404 avisa que a montagem saiu');R.falha=0;
    await espera(pg,k=>!document.querySelector(`.mn-item[data-k="${k}"] .mn-boa[disabled]`),3000,k3);
    // 5: ver como não grava (o guardAct recusa antes do POST)
    const n1=R.posts.length;await pg.evaluate(()=>{ETERNA.state.assumido={por:'x',nome:'X'};});await pg.click(sel('mn-boa',k3));await pg.waitForTimeout(200);
    ok(R.posts.length===n1&&/Só visualização/.test(await pg.textContent('#toast')),'5: ver como não grava');await pg.evaluate(()=>{ETERNA.state.assumido=null;});
    // 7: zoom com a montagem e a original
    await pg.click(sel('mn-zoom',k1));ok(await espera(pg,()=>document.querySelector('#modal').hasAttribute('data-open')),'7: tocar na montagem abre o zoom');
    const z1=await pg.evaluate(()=>({img:document.querySelector('#modal-img').style.getPropertyValue('--img'),cap:document.querySelector('#modal-cap').textContent}));
    ok(z1.img.includes('/montagens/previa/'+pidDe(0)+'/mirantedia.jpg')&&/Mirante do Rio · LP100 · .+ · 10:59 · 1\/2/.test(z1.cap),'7: primeiro a montagem: '+J(z1));
    await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(150);
    const z2=await pg.evaluate(()=>({img:document.querySelector('#modal-img').style.getPropertyValue('--img'),cap:document.querySelector('#modal-cap').textContent}));
    ok(z2.img.includes('/file/'+pidDe(0))&&/Foto original · LP100 .+ 2\/2/.test(z2.cap),'7: depois a foto original: '+J(z2));
    await print(pg,'montagens-zoom-1280.png');await pg.keyboard.press('Escape');await pg.waitForTimeout(150);ok(!(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open'))),'7: Esc fecha');
    await print(pg,'montagens-1280.png',{fullPage:true});
    // Atualizar relê do servidor: a que ganhou nota sai do Sem nota; Boas mostra a gravada
    await pg.click('[data-act="mn-reler"]');ok(await espera(pg,k=>document.querySelectorAll('#mn-lista .mn-item').length===24&&!document.querySelector(`.mn-item[data-k="${k}"]`),8000,k1),'3: Atualizar relê do servidor e a que já tem nota sai do Sem nota');
    ok(R.listas.length===2,'3: Atualizar faz um pedido novo: '+R.listas.length);
    await pg.click('[data-act="mn-sit"][data-s="boa"]');ok(await espera(pg,k=>document.querySelectorAll('#mn-lista .mn-item').length===1&&!!document.querySelector(`.mn-item[data-k="${k}"].mn-boa`),5000,k1),'3: Boas mostra a nota que veio do servidor');
    await pg.click('[data-act="mn-sit"][data-s="sem"]');
    // dia: ontem vai ao servidor
    await pg.selectOption('[data-act="mn-dia"]',ONTEM);ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===1),'3: o filtro de dia busca o outro dia');
    ok(R.listas.some(x=>x.dia===ONTEM),'3: o dia vai para o servidor: '+J(R.listas.slice(-1)));
    await pg.selectOption('[data-act="mn-dia"]',ANTE);ok(await espera(pg,()=>/Nenhuma montagem guardada neste dia/.test(document.querySelector('#main').textContent)),'6: dia sem montagem guardada');
    // 6: dia fora da guarda (resposta do servidor com o motivo)
    await pg.evaluate(d=>{const L=ETERNA.state.mn;L.dia=d;L.j=null;ETERNA.render();},addD(HOJE,-5));
    ok(await espera(pg,()=>/As montagens deste dia já saíram do servidor: ele guarda por 2 dias\./.test(document.querySelector('#main').textContent)),'6: dia fora da guarda diz o motivo: '+(await pg.textContent('#main')).slice(0,300));
    // 6: ainda sem montagens hoje; montagem desligada; erro do servidor
    R.vazio=true;await pg.evaluate(()=>{ETERNA.mnZera();ETERNA.render();});
    ok(await espera(pg,()=>/Ainda não há montagens hoje\. O servidor só monta as sessões de hoje/.test(document.querySelector('#main').textContent)),'6: ainda sem montagens hoje');
    ok((await pg.getAttribute('.mn-vazio','data-m'))==='hoje'&&J(await conta(pg))===J([[0,0,0,0]]),'6: vazio de hoje com os contadores em zero');
    R.modo='desligada';ok(await espera(pg,()=>(ETERNA.state.agent.montagem||{}).modo==='desligada',15000),'6: o /status traz a chave desligada');
    await pg.evaluate(()=>{ETERNA.mnZera();ETERNA.render();});
    ok(await espera(pg,()=>/A montagem no servidor está desligada, por isso não há montagens para ver/.test(document.querySelector('#main').textContent)),'6: montagem no servidor desligada');
    R.vazio=false;await pg.evaluate(()=>{ETERNA.mnZera();ETERNA.render();});
    ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===24&&/Estas são as que já estavam prontas/.test(document.querySelector('#main').textContent)),'6: desligada com montagens prontas: mostra e avisa');
    R.modo='sombra';R.erroLista=true;await pg.evaluate(()=>{ETERNA.mnZera();ETERNA.render();});
    ok(await espera(pg,()=>/Não deu para falar com o servidor/.test(document.querySelector('#main').textContent)&&!!document.querySelector('[data-act="mn-reler"]')),'6: erro do servidor com Tentar de novo');
    R.erroLista=false;await pg.click('[data-act="mn-reler"]');ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===24),'6: Tentar de novo carrega');
    // paginação da lista (o servidor manda em pedaços)
    R.max=25;await pg.evaluate(()=>{ETERNA.mnZera();ETERNA.render();});const l0=R.listas.length;
    ok(await espera(pg,()=>{const j=ETERNA.state.mn.j;return !!j&&j.itens.length===60;}),'2: a lista em pedaços é juntada: '+J(R.listas.slice(l0)));
    ok(J(R.listas.slice(l0).map(x=>x.de))===J([0,25,50]),'2: os pedidos seguintes levam o "de": '+J(R.listas.slice(l0)));R.max=2000;
    // nada no localStorage nem no SIM
    const guard=await pg.evaluate(()=>{const s=JSON.stringify(Object.entries(localStorage));return {ls:/c0ffee0000|mn-[a-z0-9]+-/.test(s),sim:/c0ffee0000/.test(JSON.stringify(ETERNA.SIM))};});
    ok(!guard.ls&&!guard.sim,'a nota não fica no localStorage nem no SIM: '+J(guard));
    // 7: textos nas outras línguas
    await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===24);await pg.click(sel('mn-ruim',K(1,'telao')));
    for(const l of ['en','es','fr','de']){await pg.evaluate(l=>ETERNA.idiomaEquipe(l),l);await pg.waitForTimeout(150);const t=await pg.textContent('#main');
      ok(!/\bmn_[a-z_]+/.test(t)&&!/[—–]/.test(t),'7 ('+l+'): sem chave crua nem travessão: '+(t.match(/\bmn_[a-z_]+|[—–]/)||[''])[0]);}
    await pg.evaluate(()=>ETERNA.idiomaEquipe('fr'));await pg.waitForTimeout(150);const fr=await pg.textContent('#main h1');ok(/Montages IA/.test(fr),'7: título em francês: '+fr);
    await pg.evaluate(()=>ETERNA.idiomaEquipe('pt'));
    const chaves=await pg.evaluate(()=>{const f=[];let n=0;for(const k of Object.keys(ETERNA.EQ||{}))if(/^(mn_|v_montagens|vd_montagens)/.test(k)){n++;const e=ETERNA.EQ[k];if(!Array.isArray(e)||e.length!==5||e.some(x=>x==null||x===''))f.push(k);else e.forEach(x=>{const s=typeof x==='function'?x(1,2):x;if(/[—–]/.test(s))f.push(k+' travessão');});}return {f,n};});
    ok(chaves.n>=40&&!chaves.f.length,'7: as chaves mn_* nas 5 línguas e sem travessão: '+J(chaves));
    ok(R.previas.length>0&&R.previas.every(p=>/^\/montagens\/previa\/[0-9a-f]{12}\/[a-z0-9]+\.jpg$/.test(p)),'2: as imagens vêm só da rota de prévia: '+J(R.previas.slice(0,2)));
    await ctx.close();}
  // ---------- 7: 390 px ----------
  {const {ctx,pg}=await nova({width:390,height:844});await entra(pg,null,null,'admin');ok(await abre(pg),'7: a tela abre em 390 px');
    await pg.click(sel('mn-boa',K(0,'mirantedia')));await espera(pg,k=>!!document.querySelector(`.mn-item[data-k="${k}"].mn-boa [data-act="mn-desfaz"]:not([disabled])`),5000,K(0,'mirantedia'));
    await pg.click(sel('mn-ruim',K(0,'arq1950')));await pg.waitForTimeout(150);
    const m=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,cols:getComputedStyle(document.querySelector('.mn-grade')).gridTemplateColumns.split(' ').length,
      bt:[...document.querySelectorAll('#main .mn-bts .btn, #main .mn-mot .chip, #main .mn-chips .chip, #main .mn-desf, #main .mn-sel select')].map(e=>Math.round(e.getBoundingClientRect().height))}));
    ok(m.sw<=m.iw,'7: 390 px sem rolagem lateral: '+J({sw:m.sw,iw:m.iw}));ok(m.cols===2,'7: duas colunas em 390 px: '+m.cols);ok(m.bt.length>60&&m.bt.every(h=>h>=44),'7: botões, chips e seletores com 44 px: '+J([...new Set(m.bt)]));
    await print(pg,'montagens-390.png',{fullPage:true});await ctx.close();}
  // ---------- 6: sem o servidor do ponto ----------
  {const {ctx,pg}=await nova(null,R=>{R.semAgente=true;});await entra(pg,null,null,'admin',null,true);await pg.evaluate(()=>ETERNA.go('montagens'));await pg.waitForTimeout(400);
    const t=await pg.textContent('#main');ok(/As montagens ficam no servidor do ponto\. Abra o Eterna pelo servidor para ver\./.test(t)&&!(await pg.$('#mn-lista')),'6: servidor do ponto fora: '+t.slice(0,200));await ctx.close();}
  // ---------- 1: Supervisora (pronta e já gravada pela migração) vê e marca ----------
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    const r=await pg.evaluate(()=>({sup:ETERNA.presetMenu('supervisor'),val:ETERNA.presetMenu('valida'),foto:ETERNA.presetMenu('foto'),venda:ETERNA.presetMenu('venda'),qq:ETERNA.presetMenu('quiosque')}));
    ok(r.sup.indexOf('montagens')===r.sup.indexOf('lixeira')+1&&!r.val.includes('montagens')&&!r.foto.includes('montagens')&&!r.venda.includes('montagens')&&!r.qq.includes('montagens'),'1: perfis prontos: '+J(r.sup));
    const mig=await pg.evaluate(()=>{const x={v:2,email:'sup@exemplo.com',name:'Sup',active:true,preset:'supervisor',perms:ETERNA.presetPerms('supervisor'),menu:ETERNA.presetMenu('supervisor').filter(v=>v!=='montagens'),mv:83,mtr16:1,msis94:1,menv96:1,msup98:1,mlx24:1};
      const y=ETERNA.migrateUser(JSON.parse(JSON.stringify(x)));const y2=ETERNA.migrateUser(JSON.parse(JSON.stringify(y)));const v=JSON.parse(JSON.stringify(x));v.preset='valida';v.menu=['revisao','treino','diario'];const w=ETERNA.migrateUser(v);
      const c=JSON.parse(JSON.stringify(x));c.preset='custom';const z=ETERNA.migrateUser(c);return {menu:y.menu,m:y.mmn26,de_novo:y2.menu.filter(v=>v==='montagens').length,val:w.menu,custom:z.menu};});
    ok(mig.menu.indexOf('montagens')===mig.menu.indexOf('lixeira')+1&&mig.m===1&&mig.de_novo===1,'1: a Supervisora já gravada ganha a tela depois da Lixeira, uma vez só: '+J(mig.menu));
    ok(!mig.val.includes('montagens')&&!mig.custom.includes('montagens'),'1: Validador e personalizado não mudam');await ctx.close();}
  {const {ctx,pg,R}=await nova();await entra(pg,'supervisora.mn@exemplo.com','Supervisora Teste','supervisor');ok(await abre(pg),'1: a Supervisora abre a tela');
    const mv=await menu(pg);ok(mv.includes('montagens')&&(await pg.$$('[data-act="mn-boa"]')).length===24,'1: a Supervisora vê e pode marcar: '+J(mv));
    await pg.click(sel('mn-boa',K(0,'tunel')));for(let i=0;i<50&&!R.posts.length;i++)await pg.waitForTimeout(100);ok(R.posts.length===1&&R.posts[0].b.fundo==='tunel','1: a nota da Supervisora vai ao servidor: '+R.posts.length);await ctx.close();}
  // ---------- 5: só Ver (qualidade.r): vê as montagens e as notas, sem botões ----------
  {const {ctx,pg,R}=await nova(null,R=>{R.notas[K(0,'mirantedia')]={v:'ruim',motivos:['recorte'],por:'outra@exemplo.com',nome:'Outra Pessoa',em:new Date().toISOString(),atual:false};});
    await entra(pg,'leitora.mn@exemplo.com','Leitora Teste','custom',{perms:{qualidade:{c:false,r:true,u:false,d:false}},menu:['revisao','montagens']});
    await pg.evaluate(()=>{ETERNA.state.mn.sit='todas';ETERNA.go('montagens');});ok(await espera(pg,()=>document.querySelectorAll('#mn-lista .mn-item').length===24,8000),'5: quem só vê abre a lista');
    const t=await pg.textContent(`.mn-item[data-k="${K(0,'mirantedia')}"]`);
    ok((await pg.$$('#main [data-act="mn-boa"], #main [data-act="mn-ruim"], #main [data-act="mn-desfaz"]')).length===0&&/Ruim/.test(t)&&/por Outra Pessoa às/.test(t)&&/Recorte com sujeira/.test(t)&&/A montagem foi refeita depois desta nota/.test(t),'5: só Ver: nota, quem marcou e aviso de refeita, sem botões: '+t.replace(/\s+/g,' ').slice(0,260));
    ok(J(await conta(pg))===J([[60,59,0,1]])&&R.posts.length===0,'5: contadores com a nota que veio do servidor');await ctx.close();}
  // ---------- 1: Fotógrafo, venda e Validador não veem o menu nem a tela ----------
  for(const [pr,email] of [['foto','fotografo.mn@exemplo.com'],['venda','venda.mn@exemplo.com'],['valida','validador.mn@exemplo.com']]){
    const {ctx,pg,R}=await nova();await entra(pg,email,'Pessoa '+pr,pr);await pg.evaluate(()=>ETERNA.go('montagens'));await pg.waitForTimeout(300);
    const v=await pg.evaluate(()=>({v:ETERNA.state.view,c:ETERNA.canView('montagens')}));const mv=await menu(pg);
    ok(v.v!=='montagens'&&!v.c&&!mv.includes('montagens')&&!R.listas.length,'1: '+pr+' não vê as Montagens de IA: '+J(v));await ctx.close();}
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,600));}
await b.close();
const erros=errs.filter(e=>!/favicon/.test(e));ok(!erros.length,'erros no console: '+J(erros.slice(0,3)));
console.log(fails.length?'FALHA montagens-ia: '+fails.join(' | '):'OK montagens-ia: Curadoria › Montagens de IA (menu, lista em lotes, filtros, nota boa e ruim com motivos, desfazer, falha do POST, vazios, zoom, 390 px e línguas)');
process.exit(fails.length?1:0);})();
