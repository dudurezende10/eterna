// v87: Fila do fotógrafo. Parte 1: o agente (testes/fila_fotografo_agente.py, critérios 1 a 13, HOME temporário).
// Parte 2: o app no Playwright com o /fila-fotografo simulado (critérios 14 a 22), e os prints de desktop e tela cheia em
// FOTOFILA_PRINTS (padrão: testes/prints/). Dados e miniaturas simulados (quadrados de cor), nunca foto de convidado.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const PRINTS=process.env.FOTOFILA_PRINTS||path.join(__dirname,'prints');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};

(async()=>{
// ---------- parte 1: agente ----------
{const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-ff-'));const porta=String(+(process.env.PORTA_FF||8740+Math.floor(Math.random()*40)));let out;
  try{out=execFileSync('python3',['-I',path.join(__dirname,'fila_fotografo_agente.py'),AG,porta],{env:{...process.env,HOME:H},timeout:180000}).toString().trim().split('\n').pop();}
  catch(e){out=JSON.stringify({ok:false,falhas:[String(e.stdout||e.message).slice(-400)]});}
  let j;try{j=JSON.parse(out);}catch(e){j={ok:false,falhas:['saída: '+out.slice(-300)]};}
  (j.falhas||[]).forEach(f=>fails.push('agente: '+f));if(!j.ok&&!(j.falhas||[]).length)fails.push('agente: falhou sem detalhe');
  try{fs.rmSync(H,{recursive:true,force:true});}catch(e){}}

// ---------- parte 2: app ----------
// miniaturas simuladas: quadrados de cor (JPEG) gerados aqui
const cores=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
for i in range(8):
    im=Image.new('RGB',(160,160),(40+i*25,90+i*12,170-i*15));d=ImageDraw.Draw(im);d.ellipse([50,30,110,90],fill=(230,200,170));d.rectangle([40,95,120,160],fill=(20+i*20,60,120))
    b=io.BytesIO();im.save(b,'JPEG',quality=80);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim().split('\n').map(x=>Buffer.from(x,'base64'));
const pids=n=>Array.from({length:n},(_,i)=>(0xabc000000000+n*16+i).toString(16));
function feed(extra){const a=Date.now()/1000;return {ok:true,agora:a,rev:88,pausa:20,pronta_min:15,grupos:[
  {id:'G014',estado:'fotografando',fotografo:'carlos',fonte:'ftp',funcao:{tipo:'campo',point:'terminal'},inicio:a-40,ultima_chegada:a-2,ultimo_clique:a-3,pronta_em:null,n:7,pids:pids(6)},
  {id:'G015',estado:'fotografando',fotografo:null,fonte:'câmera ···1234',funcao:null,inicio:a-12,ultima_chegada:a-1,ultimo_clique:a-2,pronta_em:null,n:3,pids:pids(3)},
  {id:'G012',estado:'subindo',fotografo:'yago',fonte:'ftp',funcao:{tipo:'volante',modo:'chute'},inicio:a-200,ultima_chegada:a-5,ultimo_clique:a-60,pronta_em:null,n:11,pids:pids(6)},
  {id:'G013',estado:'subindo',fotografo:'sandessa',fonte:'cartão',funcao:{tipo:'folga'},inicio:a-150,ultima_chegada:a-4,ultimo_clique:a-90,pronta_em:null,n:24,pids:pids(5)},
  {id:'G010',estado:'pronta',fotografo:'marinara',fonte:'ftp',funcao:{tipo:'campo',point:'vestiario'},inicio:a-700,ultima_chegada:a-500,ultimo_clique:a-510,pronta_em:a-480,n:9,pids:pids(4)}, // pids numa pronta: o app não pode mostrar
  {id:'G011',estado:'pronta',fotografo:'samuel',fonte:'ftp',funcao:null,inicio:a-400,ultima_chegada:a-300,ultimo_clique:a-305,pronta_em:a-280,n:6,pids:[]},
  ...(extra||[])]};}
const b=await chromium.launch();const errs=[];
const novo=async(w,h)=>{const ctx=await b.newContext({viewport:{width:w||1440,height:h||900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>{localStorage.removeItem('eterna.session');});await pg.goto(U);await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const otp=await pg.$('.otp');if(!otp)return false;await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
const navVs=pg=>pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));
try{
  // agente simulado: GET da fila, miniaturas e POST da função (o POST muda a função dos grupos novos)
  let modo='ok';const posts=[];let funcNova=null;
  const {ctx,pg}=await novo();
  await ctx.route('**/fila-fotografo',r=>{if(modo==='off')return r.abort('connectionrefused');const extra=funcNova?[{id:'G016',estado:'fotografando',fotografo:'carlos',fonte:'ftp',funcao:funcNova,inicio:Date.now()/1000-3,ultima_chegada:Date.now()/1000-1,ultimo_clique:Date.now()/1000-1,pronta_em:null,n:1,pids:pids(1)}]:[];
    r.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(feed(extra))});});
  await ctx.route('**/thumb/**',r=>{const i=parseInt(r.request().url().slice(-1),16)%cores.length;r.fulfill({status:200,contentType:'image/jpeg',body:cores[i]});});
  await ctx.route('**/fila-fotografo/funcao',r=>{const q=r.request();let body=null;try{body=JSON.parse(q.postData()||'null');}catch(e){}posts.push({h:q.headers(),body});
    const c=body&&body.map&&body.map.carlos;if(c)funcNova=c;r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
  ok(await entrar(pg,'eduardo@eduardorezende.com'),'login do admin');
  // 14: no grupo Fotógrafo, logo abaixo do Upload automático
  await pg.evaluate(()=>{ETERNA.state.view='importar';ETERNA.render();});await pg.waitForTimeout(150);
  const vs=await navVs(pg);ok(vs.indexOf('fotofila')===vs.indexOf('importar')+1,'14: fotofila logo abaixo do Upload automático: '+vs.join(','));
  const grp=await pg.evaluate(()=>ETERNA.VIEWS.find(v=>v[0]==='fotofila'));ok(grp&&grp[3]==='Fotógrafo'&&grp[1]==='Fila do fotógrafo','14: grupo Fotógrafo: '+JSON.stringify(grp));
  ok(await pg.evaluate(()=>ETERNA.MODULE_OF.fotofila==='filafoto'&&!!ETERNA.MODULE_INFO.filafoto.r&&!ETERNA.MODULE_INFO.filafoto.c&&!ETERNA.MODULE_INFO.filafoto.u&&!ETERNA.MODULE_INFO.filafoto.d),'14/22: módulo filafoto só com Ver');
  await pg.click('#nav button[data-v="fotofila"]');await pg.waitForTimeout(900);
  ok(await pg.evaluate(()=>location.hash)==='#fotofila'||await pg.evaluate(()=>ETERNA.state.view)==='fotofila','abre a tela');
  // 15: três colunas com contadores
  const cols=await pg.$$eval('.if-board .if-col',cs=>cs.map(c=>({h:c.querySelector('h2').childNodes[0].textContent.trim(),n:(c.querySelector('.if-cnt')||{}).textContent,cards:c.querySelectorAll('.ff-card').length,agora:c.classList.contains('agora'),thumbs:[...c.querySelectorAll('.ff-thumbs img')].map(i=>i.naturalWidth),txt:c.textContent})));
  ok(cols.length===3&&cols.map(c=>c.h).join('|')==='Clicando agora|Chegando|Já no Checkout','15/D5: nomes das colunas: '+cols.map(c=>c.h).join('|'));
  ok(cols.map(c=>c.n).join(',')==='2,2,2'&&cols.map(c=>c.cards).join(',')==='2,2,2'&&cols[1].agora,'15: contadores e coluna do meio destacada: '+JSON.stringify(cols.map(c=>[c.n,c.cards,c.agora])));
  // 16: fotógrafo e de onde vem
  const t=cols.map(c=>c.txt.replace(/\s+/g,' ')).join(' # ');
  ['Carlos (campo · Terminal Campo)','Yago (volante · chute a gol)','Marinara (set interno · Vestiário)','Samuel (campo · Foto Campo 4)','Sem fotógrafo · câmera ···1234 (sem ponto)','Sandessa (sem ponto)','De folga na Escala','7 fotos','início '].forEach(s=>ok(t.includes(s),'16: falta "'+s+'" em: '+t.slice(0,400)));
  // 17: miniaturas só nas duas primeiras colunas, até 6, carregadas
  await pg.waitForTimeout(400);
  const th=await pg.$$eval('.if-board .if-col',cs=>cs.map(c=>[...c.querySelectorAll('.ff-thumbs img')].map(i=>i.naturalWidth)));
  ok(th[0].length===9&&th[1].length===11&&th[2].length===0,'17: miniaturas por coluna (6+3, 6+5, 0): '+th.map(x=>x.length));
  ok(th[0].concat(th[1]).every(w=>w>0),'17: miniaturas carregadas (naturalWidth>0)');
  ok(await pg.$$eval('.ff-card',cs=>cs.every(c=>c.querySelectorAll('.ff-thumbs img').length<=6)),'17: até 6 por grupo');
  // 21: nada de T(), nem nome de arquivo ou e-mail no painel
  const html=await pg.$eval('#main',e=>e.innerHTML);ok(!/\.jpe?g|@|LP[A-Z0-9]{6}/i.test(html.replace(/\/thumb\/[0-9a-f]+/g,'')),'21: HTML com nome de arquivo, e-mail ou código LP');
  const src=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8');const fn=src.slice(src.indexOf('function vFotoFila('),src.indexOf('function vEstoque('));ok(fn.length>200&&!/\bT\(/.test(fn),'21: vFotoFila não usa T()');
  fs.mkdirSync(PRINTS,{recursive:true});await pg.screenshot({path:path.join(PRINTS,'fotofila-desktop.png')});
  // 18: tela cheia sem menu e sem miniaturas por padrão; interruptor lembrado; Esc devolve o menu
  await pg.click('[data-act="fotofila-tv"]');await pg.waitForTimeout(700);
  let st=await pg.evaluate(()=>({tv:document.body.classList.contains('if-tv'),rail:getComputedStyle(document.querySelector('.rail')).display,th:document.querySelectorAll('.ff-thumbs img').length}));
  ok(st.tv&&st.rail==='none'&&st.th===0,'18: tela cheia sem menu e sem miniaturas: '+JSON.stringify(st));
  await pg.screenshot({path:path.join(PRINTS,'fotofila-tela-cheia.png')});
  await pg.click('[data-act="fotofila-mini"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.querySelectorAll('.ff-thumbs img').length)===20,'18: o interruptor liga as miniaturas na tela cheia');
  await pg.screenshot({path:path.join(PRINTS,'fotofila-tela-cheia-miniaturas.png')});
  await pg.evaluate(()=>{if(document.fullscreenElement)return document.exitFullscreen();});await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
  st=await pg.evaluate(()=>({tv:document.body.classList.contains('if-tv'),rail:getComputedStyle(document.querySelector('.rail')).display}));
  ok(!st.tv&&st.rail!=='none','18: Esc tira if-tv e o menu volta: '+JSON.stringify(st));
  await pg.reload();await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>localStorage.getItem('eterna.fotofila.tvmini'))==='1','18: interruptor lembrado depois de recarregar');
  await pg.evaluate(()=>{ETERNA.state.view='fotofila';ETERNA.render();});await pg.waitForTimeout(600);
  await pg.click('[data-act="fotofila-tv"]');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>document.querySelectorAll('.ff-thumbs img').length)===20,'18: depois de recarregar, a tela cheia já abre com as miniaturas');
  await pg.click('[data-act="fotofila-mini"]');await pg.waitForTimeout(200);
  // sair da tela por outro caminho (go) também tira a tela cheia
  await pg.evaluate(()=>ETERNA.go('importar'));await pg.waitForTimeout(200);ok(!(await pg.evaluate(()=>document.body.classList.contains('if-tv'))),'go() tira if-tv');
  await pg.evaluate(()=>ETERNA.go('fotofila'));await pg.waitForTimeout(700);
  // 19: agente fora do ar: aviso, último dado na tela e nenhum erro
  modo='off';await pg.waitForTimeout(2600);
  const off=await pg.evaluate(()=>({note:(document.querySelector('#main [role="alert"]')||{}).textContent||'',cards:document.querySelectorAll('.ff-card').length}));
  ok(/^Sem conexão com o servidor · atualizado há \d+ s$/.test(off.note.trim())&&off.cards===6,'19: aviso e último dado: '+JSON.stringify(off));
  modo='ok';await pg.waitForTimeout(2300);ok(!(await pg.$('#main [role="alert"]')),'19: aviso some quando o agente volta');
  // 20: trocar a função na Escala manda o POST com X-Eterna: 1; a TV (outro navegador) mostra o novo ponto no grupo seguinte
  await pg.evaluate(()=>ETERNA.go('escala'));await pg.waitForTimeout(300);
  const sel=await pg.$('select[data-act="func-set"][data-k="carlos"]');ok(!!sel,'20: seletor da função do Carlos na Escala');
  if(sel){await sel.selectOption('v:livre');await pg.waitForTimeout(500);}
  const p=posts[posts.length-1];
  ok(p&&p.h['x-eterna']==='1'&&p.body&&p.body.map&&p.body.map.carlos&&p.body.map.carlos.tipo==='volante'&&p.body.map.carlos.modo==='livre'&&/^\d{4}-\d\d-\d\d$/.test(p.body.dia)&&!('from' in p.body.map.carlos),'20: POST da função: '+JSON.stringify(p));
  {const tv=await novo(1920,1080);await tv.ctx.route('**/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feed(funcNova?[{id:'G016',estado:'fotografando',fotografo:'carlos',fonte:'ftp',funcao:funcNova,inicio:Date.now()/1000-3,ultima_chegada:Date.now()/1000-1,ultimo_clique:Date.now()/1000-1,pronta_em:null,n:1,pids:[]}]:[]))}));
    await tv.ctx.route('**/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:cores[0]}));
    await entrar(tv.pg,'loja@eterna.photo');await tv.pg.evaluate(()=>ETERNA.go('fotofila'));await tv.pg.waitForTimeout(900);
    const tt=(await tv.pg.textContent('#main')).replace(/\s+/g,' ');ok(tt.includes('Carlos (volante · livre)')&&tt.includes('Carlos (campo · Terminal Campo)'),'20: a TV mostra o novo ponto só no grupo novo: '+tt.slice(0,300));
    await tv.ctx.close();}
  await ctx.close();
  // 14: perfis da D6 veem; Validador não; perfil sem filafoto.r cai em semacesso
  for(const [email,ve] of [['carlos@eterna.photo',true],['loja@eterna.photo',true],['supervisor@eterna.photo',true],['qualidade@eterna.photo',false]]){
    const {ctx,pg}=await novo();await ctx.route('**/fila-fotografo',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feed())}));await ctx.route('**/thumb/**',r=>r.fulfill({status:200,contentType:'image/jpeg',body:cores[1]}));
    ok(await entrar(pg,email),'login '+email);await pg.waitForTimeout(200);const v=await navVs(pg);ok(v.includes('fotofila')===ve,`14: ${email} ${ve?'deveria':'não deveria'} ver a Fila do fotógrafo: ${v.join(',')}`);
    await pg.evaluate(()=>{location.hash='#fotofila';});await pg.reload();await pg.waitForTimeout(700);const view=await pg.evaluate(()=>ETERNA.state.view);ok((view==='fotofila')===ve,`14: ${email} pelo #fotofila abriu ${view}`);
    await ctx.close();}
  {const {ctx,pg}=await novo();await pg.goto(U);await pg.waitForTimeout(400);
    // usuário salvo antes da v87 (menu sem a tela) ganha o item uma vez; perfil personalizado sem filafoto.r cai em semacesso
    await pg.evaluate(()=>{const us=JSON.parse(localStorage.getItem('eterna.users.v1'));const c=us['carlos@eterna.photo'];c.menu=c.menu.filter(v=>v!=='fotofila');delete c.mff87;delete c.perms.filafoto;
      const n=JSON.parse(JSON.stringify(c));n.email='semfila@eterna.photo';n.name='Sem fila';n.key=null;n.preset='custom';n.mff87=1;Object.keys(n.perms).forEach(m=>n.perms[m]={c:false,r:false,u:false,d:false});n.menu=['fotofila'];n.inicio=null;us[n.email]=n;
      localStorage.setItem('eterna.users.v1',JSON.stringify(us));localStorage.removeItem('eterna.session');});
    await entrar(pg,'carlos@eterna.photo');ok((await navVs(pg)).includes('fotofila'),'14: usuário salvo antes da v87 ganha a Fila do fotógrafo');
    await entrar(pg,'semfila@eterna.photo');await pg.evaluate(()=>{location.hash='#fotofila';});await pg.reload();await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>ETERNA.state.view)==='semacesso'&&!(await navVs(pg)).includes('fotofila'),'14: sem filafoto.r cai em semacesso: '+await pg.evaluate(()=>ETERNA.state.view));
    await ctx.close();}
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
errs.forEach(e=>fails.push('erro no console: '+e));
const okk=!fails.length;console.log(`${okk?'OK':'FALHA'} fila-fotografo: agente (critérios 1 a 13) e app (14 a 22)${okk?'':' · '+fails.slice(0,6).join(' | ')}`);process.exit(okk?0:1);
})();
