// 24/11 (plano docs/planos/2026-11-24-lixeira-ia.md, Parte A): a tela Curadoria › Lixeira da IA. Critérios 8 (menu do Admin e da
// Supervisora, também a já gravada pela migração; não aparece para Validador, Fotógrafo, Atendimento e venda e Checkout), 9 (número
// de hoje no item do menu; sem nenhuma, nada; "Não é ruim" diminui sem recarregar), 10 (miniatura, motivo, fotógrafo e hora; dia
// com os últimos 30 dias e a contagem; chips de motivo; a lupa percorre a lista filtrada), 11 (na tela: recuperada, igual, 404),
// 13 (na tela: "ver como" não grava), 15 (a régua aberta pede /lixeira/medida e mostra a conta) e 19 (5 línguas sem chave crua nem
// travessão; 390 px sem rolagem lateral e botões de 44 px; 1280 px com a grade da Qualidade).
// O agente é falso (page.route na própria origem; o servidor de verdade está em testes/lixeira_agente.py). Nenhuma foto de cliente:
// as miniaturas são desenhadas aqui. LX_PRINTS=<pasta> guarda os prints (padrão testes/prints).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const entrarTeste=require('./_entrar');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const PRINTS=process.env.LX_PRINTS||path.join(__dirname,'prints');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);return c;};const J=JSON.stringify;
const diaSP=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
const HOJE=diaSP(Date.now());const addD=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
const ONTEM=addD(HOJE,-1);
const JPG=execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGB',(600,400),(30,40,60));d=ImageDraw.Draw(im);d.ellipse([250,80,350,200],fill=(200,170,140));d.rectangle([220,200,380,400],fill=(240,240,235))
b=io.BytesIO();im.save(b,'JPEG',quality=85);print(base64.b64encode(b.getvalue()).decode())`]).toString().trim();
const FOTO=Buffer.from(JPG,'base64');
const P1='a1b2c3d40001',P2='a1b2c3d40002',P3='a1b2c3d40003',P4='a1b2c3d40004';
function lista(R,dia){const base=dia===HOJE?[
    {pid:P1,mot:['escura'],em:new Date(Date.now()-60e3).toISOString(),fotografo:'marcio',card:'LP0001',ordem:1,treino:'fraca',rec:null,m:{nq:900,nr:300,n:1,nb:1}},
    {pid:P2,mot:['desfocada'],em:new Date(Date.now()-120e3).toISOString(),fotografo:'yago',card:'LP0002',ordem:2,treino:'boa',rec:null,m:{nq:8,nr:5,n:1,nb:1}},
    {pid:P3,mot:['sem_ninguem','escura'],em:new Date(Date.now()-180e3).toISOString(),fotografo:null,card:null,ordem:null,treino:null,rec:null,m:{nq:900,nr:null,n:0,nb:0}}]
    :dia===ONTEM?[{pid:P4,mot:['estourada'],em:new Date(Date.now()-86400e3).toISOString(),fotografo:'marcio',card:'LP0009',ordem:1,treino:null,rec:null,m:{}}]:[];
  const its=base.map(x=>Object.assign({},x,R.rec[x.pid]?{rec:R.rec[x.pid]}:{}));its.sort((a,b)=>(!!a.rec)-(!!b.rec));
  const n=its.filter(x=>!x.rec).length;return {v:1,dia,on:true,modo:'medir',valendo:[],n,recuperadas:its.length-n,itens:its,
    dias:[{dia:HOJE,n:3-Object.keys(R.rec).filter(p=>p!==P4).length},{dia:ONTEM,n:R.rec[P4]?0:1}],mais:false};}
async function agente(ctx,R){const js=(r,o,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(o)});
  R.listas=[];R.posts=[];R.cfg=[];R.modo='medir';R.medidas=0;R.rec={};R.hoje=3;R.n7=4;R.rev=1;R.sumiu=false;
  await ctx.route(ORIG+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'blx',card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:false},
    treino:{v:1,rotulos:0,analise:{ponto:'medir',exposicao:'medir'},modelo_ponto:null,ajuste:null},lixeira:{v:1,on:true,modo:R.modo,rev:R.rev,hoje:R.hoje,n7:R.n7,dias:7,valendo:[],hoje_fora:0},
    sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'blx',hoje:1,abertas:0,dias:1}}));
  await ctx.route(ORIG+'/sessoes*',r=>js(r,{ok:true,gen:'blx',rev:1,pausa:60,rostos:true,completo:true,sessoes:R.feed||[]}));
  await ctx.route(ORIG+'/events*',r=>js(r,{events:[],next:0,total:0}));
  await ctx.route(ORIG+'/biblioteca',r=>js(r,{fotos:[]}));
  await ctx.route(ORIG+'/ponto/docs/revs',r=>js(r,{ok:true,revs:{}}));
  await ctx.route(ORIG+'/ponto/docs*',r=>r.request().method()==='POST'?js(r,{ok:true,gravados:1}):js(r,{ok:true,rev:0,docs:[]}));
  await ctx.route(ORIG+'/metricas/dia*',r=>js(r,{ok:true,dias:[]}));
  await ctx.route(ORIG+'/fotografos/alertas*',r=>js(r,{ok:true,v:1,fotografos:[],alertas:[],equipe:{}}));
  await ctx.route(ORIG+'/thumb/*',r=>r.fulfill({status:200,contentType:'image/jpeg',body:FOTO}));
  await ctx.route(ORIG+'/file/*',r=>r.fulfill({status:200,contentType:'image/jpeg',body:FOTO}));
  await ctx.route(ORIG+'/lixeira/config',r=>{const b=JSON.parse(r.request().postData()||'{}');R.cfg.push(b);
    if(b.modo==='ligada')return js(r,{ok:false,error:'em_breve'},409);if(b.modo===R.modo)return js(r,{ok:true,igual:true,cfg:{modo:R.modo}});R.modo=b.modo;js(r,{ok:true,cfg:{modo:R.modo}});});
  await ctx.route(ORIG+'/lixeira/medida',r=>{R.medidas++;js(r,{v:1,lim:{},crit:{n:20,precisao:0.95},sem_medida:0,recuperadas:1,motivos:{
    escura:{n:23,certas:21,erradas:2,precisao:0.913,passa:false,falta:[{k:'precisao',tem:0.913,precisa:0.95}],mesmo_motivo:16},
    estourada:{n:5,certas:5,erradas:0,precisao:1,passa:false,falta:[{k:'n',tem:5,precisa:20}],mesmo_motivo:5},
    desfocada:{n:0,certas:0,erradas:0,precisao:null,passa:false,falta:[{k:'n',tem:0,precisa:20}],mesmo_motivo:0},
    sem_ninguem:{n:0,certas:0,erradas:0,precisao:null,passa:false,falta:[{k:'n',tem:0,precisa:20}],mesmo_motivo:0}}});});
  await ctx.route(ORIG+'/lixeira/recuperar',r=>{const b=JSON.parse(r.request().postData()||'{}');R.posts.push({h:r.request().headers(),b});
    if(R.sumiu)return js(r,{ok:false,error:'pid'},404);
    if(R.rec[b.pid])return js(r,{ok:true,igual:true,rec:R.rec[b.pid]});
    R.rec[b.pid]={por:'admin.teste@exemplo.com',nome:'Admin de teste',em:new Date().toISOString()};if(b.pid!==P4)R.hoje--;R.n7--;R.rev++;js(r,{ok:true,rec:R.rec[b.pid]});});
  await ctx.route(new RegExp('^'+ORIG.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/lixeira(\\?.*)?$'),r=>{const q=new URL(r.request().url()).searchParams;const dia=q.get('dia')||HOJE;R.listas.push(dia);js(r,lista(R,dia));});}
function usuario(pg,email,nome,preset,extra){return pg.evaluate(([e,n,p,x])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
  U0[e]=Object.assign({v:2,email:e,name:n,active:true,preset:p,perms:ETERNA.presetPerms(p),menu:ETERNA.presetMenu(p),key:null},x||{});localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[email,nome,preset,extra]);}
(async()=>{fs.mkdirSync(PRINTS,{recursive:true});const b=await chromium.launch();const errs=[];
const nova=async(vp)=>{const ctx=await b.newContext({viewport:vp||{width:1280,height:900},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const R={};await agente(ctx,R);const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime|JSON/.test(m.text()))errs.push(m.text());});return {ctx,pg,R};};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||5000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
const entra=async(pg,email,nome,preset,extra)=>{await pg.goto(U);await pg.waitForTimeout(300);if(preset==='admin'){email=await entrarTeste.adminFicticio(pg);}else{await usuario(pg,email,nome,preset,extra);await pg.reload();await pg.waitForTimeout(300);}
  await entrarTeste(pg,email);await espera(pg,()=>!!ETERNA.state.user,15000);await espera(pg,()=>ETERNA.state.agent.on,20000);return email;};
const menu=pg=>pg.$$eval('#nav [data-act="view"]',x=>x.map(e=>e.dataset.v));
try{
  // ---------- 8, 9, 10, 11 e 15: Admin a 1280 px ----------
  {const {ctx,pg,R}=await nova({width:1280,height:900});await entra(pg,null,null,'admin');
    await pg.evaluate(()=>ETERNA.go('lixeira'));ok(await espera(pg,()=>document.querySelectorAll('.lx-item').length===3,8000),'10: as 3 fotos de hoje não apareceram');
    const mv=await menu(pg);ok(mv.indexOf('lixeira')===mv.indexOf('alertas')+1,'8: Lixeira da IA logo depois de Alertas no menu do Admin: '+J(mv));
    ok(await espera(pg,()=>{const p=document.querySelector('#nav [data-v="lixeira"] #rail-lx');return p&&p.textContent==='4'&&p.getAttribute('aria-label')==='4 fotos na lixeira nos últimos 7 dias';}),'9: o item do menu mostra os 7 dias (4)');
    const h1=(await pg.textContent('#main h1')).trim();ok(h1==='Lixeira da IA','título: '+h1);
    ok(/Em teste: estas fotos continuam à venda/.test(await pg.textContent('#main .lx-modo')),'pílula Em teste');
    const cards=await pg.$$eval('.lx-item',x=>x.map(e=>({tag:(e.querySelector('.ph .tag')||{}).textContent,info:e.querySelector('.lx-info').textContent.replace(/\s+/g,' ').trim(),
      img:!!e.querySelector('.ph[data-real]')||/thumb/.test(e.querySelector('.ph').getAttribute('style')||''),btn:!!e.querySelector('[data-act="lx-rec"]')})));
    ok(cards[0].tag==='Muito escura'&&/^Márcio · \d\d:\d\d\s*Muito escura/.test(cards[0].info)&&/Treino: não pode/.test(cards[0].info)&&cards[0].img&&cards[0].btn,'10: miniatura, motivo, fotógrafo, hora e Treino: '+J(cards[0]));
    ok(cards[1].tag==='Tremida ou desfocada'&&/Treino: pode/.test(cards[1].info),'10: desfocada com Treino pode: '+J(cards[1]));
    ok(cards[2].tag==='Sem ninguém na foto'&&/^Sem fotógrafo/.test(cards[2].info)&&/Sem ninguém na foto, Muito escura/.test(cards[2].info),'10: sem fotógrafo e os dois motivos: '+J(cards[2]));
    const opts=await pg.$$eval('[data-act="lx-dia"] option',x=>x.map(o=>[o.value,o.textContent]));
    ok(opts.length===30&&opts[0][0]===HOJE&&opts[0][1]===HOJE.slice(8)+'/'+HOJE.slice(5,7)+'/'+HOJE.slice(0,4)+' · 3'&&opts[1][1].endsWith(' · 1')&&opts[29][0]===addD(HOJE,-29)&&opts[29][1].endsWith(' · 0'),
      '10: os últimos 30 dias com a contagem (dd/mm/aaaa): '+J(opts.slice(0,2))+J(opts[29]));
    // chips de motivo e a lupa na lista filtrada
    await pg.click('[data-act="lx-mot"][data-m="escura"]');ok((await pg.$$('.lx-item')).length===2,'10: o chip Muito escura deixa 2 fotos');
    await pg.click('.lx-item .ph');ok(await espera(pg,()=>document.querySelector('#modal').hasAttribute('data-open')),'10: a lupa abre');
    const zm=await pg.evaluate(()=>({n:ETERNA.lxModalN()}));
    ok(zm.n===2,'10: a lupa percorre a lista filtrada (2 fotos): '+J({n:zm.n}));
    await pg.keyboard.press('Escape');await pg.waitForTimeout(150);
    await pg.click('[data-act="lx-mot"][data-m="estourada"]');ok(/Nenhuma foto com este motivo/.test(await pg.textContent('#main')),'10: chip sem foto mostra o vazio');
    await pg.click('[data-act="lx-mot"][data-m="todos"]');
    // dia: ontem
    await pg.selectOption('[data-act="lx-dia"]',ONTEM);ok(await espera(pg,()=>document.querySelectorAll('.lx-item').length===1),'10: o filtro de dia busca o outro dia');
    ok(R.listas.includes(ONTEM),'10: o dia vai para o servidor');
    await pg.selectOption('[data-act="lx-dia"]',HOJE);await espera(pg,()=>document.querySelectorAll('.lx-item').length===3);
    await pg.screenshot({path:path.join(PRINTS,'lixeira-1280.png'),fullPage:true});
    // 1280: a grade como a da Qualidade (colunas de pelo menos 170 px)
    const g=await pg.evaluate(()=>{const e=document.querySelector('.lx-grade');return {cols:getComputedStyle(e).gridTemplateColumns.split(' ').map(parseFloat),w:e.clientWidth};});
    ok(g.cols.length>=4&&g.cols.every(c=>c>=170),'19: 1280 px com a grade da Qualidade: '+J(g));
    // 11: Não é ruim
    const n0=R.posts.length;await pg.click(`[data-act="lx-rec"][data-pid="${P1}"]`);
    ok(await espera(pg,()=>!!document.querySelector('.lx-item.lx-feita')),'11: a foto fica como recuperada');
    ok(R.posts.length===n0+1&&R.posts[n0].b.pid===P1&&J(Object.keys(R.posts[n0].b))===J(['pid']),'11: o POST leva só o pid: '+J(R.posts[n0]&&R.posts[n0].b));
    ok(/Anotado\. A foto já estava à venda\./.test(await pg.textContent('#toast')),'11: toast de Teste');
    const fim=await pg.$$eval('.lx-item',x=>x.map(e=>e.classList.contains('lx-feita')));ok(J(fim)===J([false,false,true]),'11: a recuperada vai para o fim: '+J(fim));
    ok(/Recuperada por Admin de teste às \d\d:\d\d/.test(await pg.textContent('.lx-item.lx-feita')),'11: quem e a hora');
    ok(await espera(pg,()=>{const p=document.querySelector('#nav [data-v="lixeira"] #rail-lx');return p&&p.textContent==='3';}),'9: o número do menu cai para 3 sem recarregar');
    ok((await pg.$$('.lx-item.lx-feita [data-act="lx-rec"]')).length===0,'11: recuperada sem botão');
    // 404: a foto já saiu
    R.sumiu=true;await pg.click(`[data-act="lx-rec"][data-pid="${P2}"]`);await pg.waitForTimeout(250);ok(/Esta foto já saiu da lixeira\./.test(await pg.textContent('#toast')),'11: 404 avisa');R.sumiu=false;
    await espera(pg,()=>document.querySelectorAll('.lx-item').length===3);
    // 15: a régua só é pedida ao abrir
    ok(R.medidas===0,'15: a régua não é pedida antes de abrir');
    await pg.click('.lx-regua summary');ok(await espera(pg,()=>/23 fotos marcadas no Treino, 91% eram mesmo ruins/.test((document.querySelector('.lx-regua')||{}).textContent||'')),'15: a régua da escura');
    const rg=await pg.textContent('.lx-regua');ok(/Faltam 15 fotos marcadas no Treino para medir/.test(rg)&&/Faltam 20 fotos/.test(rg)&&/Não é ruim/.test(rg),'15: o que falta e a nota: '+rg.slice(0,300));
    ok(R.medidas===1,'15: um pedido');
    // 13: ver como não grava (o guardAct recusa antes do POST)
    const n1=R.posts.length;await pg.evaluate(()=>{ETERNA.state.assumido={por:'x',nome:'X'};});await pg.click(`[data-act="lx-rec"][data-pid="${P2}"]`);await pg.waitForTimeout(200);
    ok(R.posts.length===n1&&/Só visualização/.test(await pg.textContent('#toast')),'13: ver como não grava');await pg.evaluate(()=>{ETERNA.state.assumido=null;});
    // 19: textos nas outras línguas
    for(const l of ['en','es','fr']){await pg.evaluate(l=>ETERNA.idiomaEquipe(l),l);await pg.waitForTimeout(150);const t=await pg.textContent('#main');
      ok(!/\blx_[a-z_]+/.test(t)&&!/[—–]/.test(t),'19 ('+l+'): sem chave crua nem travessão: '+(t.match(/\blx_[a-z_]+|[—–]/)||[''])[0]);}
    const fr=await pg.textContent('#main h1');ok(/Corbeille de l'IA/.test(fr),'19: título em francês: '+fr);
    await pg.evaluate(()=>ETERNA.idiomaEquipe('pt'));
    const chaves=await pg.evaluate(()=>{const f=[];for(const k of Object.keys(ETERNA.EQ||{}))if(/^(lx_|v_lixeira|vd_lixeira)/.test(k)){const e=ETERNA.EQ[k];if(!Array.isArray(e)||e.length!==5||e.some(x=>x==null||x===''))f.push(k);else e.forEach(x=>{const s=typeof x==='function'?x(1,2):x;if(/[—–]/.test(s))f.push(k+' travessão');});}return {f,n:Object.keys(ETERNA.EQ||{}).filter(k=>/^lx_/.test(k)).length};});
    ok(!chaves.n||!chaves.f.length,'19: as chaves lx_* nas 5 línguas e sem travessão: '+J(chaves.f));
    // ---------- 13: a chave em Configurações › IA automática (Admin) ----------
    await pg.evaluate(()=>ETERNA.go('ia-auto'));ok(await espera(pg,()=>!!document.querySelector('#lx-cfg')),'13: o bloco da Lixeira em IA automática');
    const ch=await pg.evaluate(()=>{const q=v=>document.querySelector(`#lx-cfg [data-act="lx-cfg"][data-v="${v}"]`);return {t:q('medir')&&q('medir').getAttribute('aria-pressed'),td:q('medir')&&q('medir').disabled,l:!!q('ligada'),ld:q('ligada')&&q('ligada').disabled,txt:document.querySelector('#lx-cfg').textContent};});
    ok(ch.t==='true'&&!ch.td&&ch.l&&ch.ld&&/Lixeira da IA/.test(ch.txt)&&/O Ligado chega na próxima versão\./.test(ch.txt)&&/Em Teste, a IA só separa as fotos para conferir\. Ligado, elas saem do Checkout\./.test(ch.txt),'13: Teste valendo, Ligado travado com o aviso: '+J(ch));
    const m0=(await menu(pg));ok(m0.indexOf('ia-auto')>=0,'13: IA automática no menu do Admin');
    await pg.click('#lx-cfg [data-act="lx-cfg"][data-v="medir"]');await pg.waitForTimeout(250);ok(R.cfg.length===1&&R.cfg[0].modo==='medir'&&/Nada mudou/.test(await pg.textContent('#toast')),'13: Teste de novo = igual: '+J(R.cfg));
    await pg.evaluate(()=>ETERNA.lxCfg('ligada'));await pg.waitForTimeout(150);ok(R.cfg.length===1&&/O Ligado chega na próxima versão/.test(await pg.textContent('#toast')),'13: Ligado travado não vai ao servidor');
    await pg.evaluate(()=>{ETERNA.state.assumido={por:'x',nome:'X'};});await pg.evaluate(()=>ETERNA.lxCfg('medir'));await pg.waitForTimeout(150);
    ok(R.cfg.length===1&&/Só visualização/.test(await pg.textContent('#toast')),'13: ver como não muda a chave');await pg.evaluate(()=>{ETERNA.state.assumido=null;ETERNA.render();});
    await pg.screenshot({path:path.join(PRINTS,'lixeira-chave-1280.png'),fullPage:true});
    await ctx.close();}
  // ---------- 19: 390 px ----------
  {const {ctx,pg,R}=await nova({width:390,height:844});await entra(pg,null,null,'admin');
    await pg.evaluate(()=>ETERNA.go('lixeira'));await espera(pg,()=>document.querySelectorAll('.lx-item').length===3,8000);await pg.click('.lx-regua summary');await espera(pg,()=>/91%/.test(document.querySelector('.lx-regua').textContent));
    const m=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,bt:[...document.querySelectorAll('[data-act="lx-rec"],[data-act="lx-mot"],[data-act="lx-dia"],.lx-regua summary')].map(e=>Math.round(e.getBoundingClientRect().height)),
      cols:getComputedStyle(document.querySelector('.lx-grade')).gridTemplateColumns.split(' ').length}));
    ok(m.sw<=m.iw,'19: 390 px sem rolagem lateral: '+J(m));ok(m.bt.every(h=>h>=44),'19: botões com 44 px: '+J(m.bt));ok(m.cols===2,'19: duas colunas em 390 px: '+m.cols);
    await pg.screenshot({path:path.join(PRINTS,'lixeira-390.png'),fullPage:true});
    await pg.evaluate(()=>ETERNA.go('ia-auto'));await espera(pg,()=>!!document.querySelector('#lx-cfg'));
    const k=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,h:[...document.querySelectorAll('#lx-cfg [data-act="lx-cfg"]')].map(e=>Math.round(e.getBoundingClientRect().height))}));
    ok(k.sw<=k.iw&&k.h.length===2,'19: a chave em 390 px sem rolagem lateral: '+J(k));
    await pg.evaluate(()=>document.querySelector('#lx-cfg').scrollIntoView());await pg.screenshot({path:path.join(PRINTS,'lixeira-chave-390.png')});
    await ctx.close();}
  // ---------- 12: em Teste, com a lixeira cheia, o Checkout mostra todas as fotos da leva ----------
  {const {ctx,pg,R}=await nova();const t0=Date.now()/1000;
    R.feed=[{card:'LPLIXO001',dia:HOJE,fotografo:'marcio',fonte:'ftp',ponto:null,funcao:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',aberta_em:t0-300,ultima_chegada:t0-250,cap0:t0-302,cap1:t0-252,fonte_t:'cap',fechada_em:t0-190,fechada_por:'pausa',
      fotos:[P1,P2,P3,'a1b2c3d40005'],pend:[],dec:{},sim_abertura:null,fundida_em:null,removida:false,rev:1,ia:[],ia_regra:{n:2,motivo:'sem_funcao'}}];R.n7=3;
    await pg.goto(U+'#loja');
    ok(await espera(pg,()=>!!(window.ETERNA&&ETERNA.SIM.sessions.LPLIXO001),20000),'12: a leva chegou ao Checkout');
    const n=await pg.evaluate(()=>{ETERNA.SIM.invalid={};return ETERNA.lojaItems('LPLIXO001').filter(x=>x.t==='ph').map(x=>x.id);});
    ok(n.length===4&&['a1b2c3d40001','a1b2c3d40002','a1b2c3d40003'].every(p=>n.includes('ag_'+p)),'12: em Teste o Checkout mostra as 4 fotos, também as 3 da lixeira: '+J(n));
    ok(!R.listas.length,'12: o Checkout nem pede a lista da lixeira');
    await ctx.close();}
  // ---------- 8: Supervisora (pronta e já gravada pela migração) vê; Validador, Fotógrafo, venda e Checkout não ----------
  {const {ctx,pg}=await nova();await pg.goto(U);await pg.waitForTimeout(300);
    const r=await pg.evaluate(()=>({sup:ETERNA.presetMenu('supervisor'),val:ETERNA.presetMenu('valida'),foto:ETERNA.presetMenu('foto'),venda:ETERNA.presetMenu('venda'),qq:ETERNA.presetMenu('quiosque')}));
    ok(r.sup.includes('lixeira')&&!r.val.includes('lixeira')&&!r.foto.includes('lixeira')&&!r.venda.includes('lixeira')&&!r.qq.includes('lixeira'),'8: perfis prontos: '+J(r));
    const mig=await pg.evaluate(()=>{const x={v:2,email:'sup@exemplo.com',name:'Sup',active:true,preset:'supervisor',perms:ETERNA.presetPerms('supervisor'),menu:ETERNA.presetMenu('supervisor').filter(v=>v!=='lixeira'),mv:83,mtr16:1,msis94:1,menv96:1,msup98:1};
      const y=ETERNA.migrateUser(JSON.parse(JSON.stringify(x)));const v=JSON.parse(JSON.stringify(x));v.preset='valida';v.menu=['revisao','treino','diario'];const w=ETERNA.migrateUser(v);
      const c=JSON.parse(JSON.stringify(x));c.preset='custom';const z=ETERNA.migrateUser(c);return {menu:y.menu,mlx:y.mlx24,val:w.menu,custom:z.menu};});
    ok(mig.menu.indexOf('lixeira')===mig.menu.indexOf('alertas')+1&&mig.mlx===1,'8: a Supervisora já gravada ganha a tela depois de Alertas: '+J(mig.menu));
    ok(!mig.val.includes('lixeira')&&!mig.custom.includes('lixeira'),'8: Validador e personalizado não mudam');
    await ctx.close();}
  {const {ctx,pg}=await nova();await entra(pg,'supervisora.lx@exemplo.com','Supervisora Teste','supervisor');
    await pg.evaluate(()=>ETERNA.go('lixeira'));await espera(pg,()=>document.querySelectorAll('.lx-item').length===3,8000);
    const mv=await menu(pg);ok(mv.includes('lixeira')&&(await pg.$$('[data-act="lx-rec"]')).length===3,'8: a Supervisora vê e pode recuperar: '+J(mv));
    await pg.evaluate(()=>ETERNA.go('ia-auto'));await espera(pg,()=>!!document.querySelector('#lx-cfg'));
    const sc=await pg.evaluate(()=>({chips:document.querySelectorAll('#lx-cfg [data-act="lx-cfg"]').length,txt:document.querySelector('#lx-cfg').textContent,v:ETERNA.state.view}));
    ok(sc.v==='ia-auto'&&sc.chips===0&&/Teste/.test(sc.txt)&&/Só o Admin muda a Lixeira da IA\./.test(sc.txt),'13: a Supervisora vê a chave e o estado, sem mudar: '+J(sc));
    await pg.evaluate(()=>ETERNA.lxCfg('medir'));await pg.waitForTimeout(150);ok(/Só o Admin muda a Lixeira da IA/.test(await pg.textContent('#toast')),'13: a Supervisora não grava pela tela');
    await ctx.close();}
  for(const [pr,email] of [['valida','validador.lx@exemplo.com'],['foto','fotografo.lx@exemplo.com'],['venda','venda.lx@exemplo.com']]){
    const {ctx,pg}=await nova();await entra(pg,email,'Pessoa '+pr,pr);await pg.evaluate(()=>ETERNA.go('lixeira'));await pg.waitForTimeout(250);
    const v=await pg.evaluate(()=>ETERNA.state.view);const mv=await menu(pg);
    ok(v!=='lixeira'&&!mv.includes('lixeira')&&!(await pg.$('#rail-lx')),'8: '+pr+' não vê a Lixeira: '+v);await ctx.close();}
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,600));}
await b.close();
const erros=errs.filter(e=>!/favicon/.test(e));ok(!erros.length,'erros no console: '+J(erros.slice(0,3)));
console.log(fails.length?'FALHA lixeira: '+fails.join(' | '):'OK lixeira: Curadoria › Lixeira da IA (critérios 8 a 13 com a chave, 15 e 19; prints em '+PRINTS+')');
process.exit(fails.length?1:0);})();
