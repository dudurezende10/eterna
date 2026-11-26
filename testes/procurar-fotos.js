// 25/11: tela Procurar fotos (menu Fotógrafo, #procurar) e Minhas fotos sem o seletor Fotógrafo.
// 26/11: a tela também para o atendimento e venda (quem tem o Posto), com todos os fotógrafos e só para olhar.
// O agente é falso (page.route na própria origem: /status, /sessoes, /thumb/, /file/ e o resto com resposta neutra). Dados e miniaturas
// simulados (uma imagem do repositório), nunca foto de convidado. Os cadastros são de teste.
// BF_VER=1 mostra cada conferência com o tempo.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.BF_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+m.slice(0,300));};const J=JSON.stringify;
const JPG=fs.readFileSync(path.join(__dirname,'..','img','ativ-snap.jpg'));
const dia=t=>{const d=new Date(t*1000);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const AGORA=Date.now()/1000;const hoje=dia(AGORA);
let seqPid=0;const pids=n=>Array.from({length:n},()=>(0xabd000000000+(++seqPid)).toString(16));
// min = há quantos minutos foi a última foto. O dia é sempre hoje (a hora cheia sai do horário, mesmo que o teste rode de madrugada).
function sessao(o){const t=AGORA-(o.min||5)*60;const fotos=o.fotos||pids(o.n==null?6:o.n);return Object.assign({card:o.card,dia:hoje,fotografo:'samuel',fonte:'ftp',ponto:null,trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:t-50,ultima_chegada:t,cap0:t-45,cap1:t-2,fonte_t:'cap',fechada_em:t+60,fechada_por:'pausa',fotos,pend:[],dec:{},ia:[],sim_abertura:null,fundida_em:null,removida:false,rev:1},o,{fotos});}
const hora=x=>Math.max(x.cap1,x.ultima_chegada);const hCheia=x=>new Date(hora(x)*1000).getHours();
const XSS='<img src=x onerror=window.__xss=1>';
const ADMIN='admin.teste@exemplo.com',FOTO='fotografo.teste@exemplo.com',CAIXA='caixa.teste@exemplo.com',QUIOSQUE='quiosque.teste@exemplo.com',HUGO='hugo.teste@exemplo.com',VKEY='vendedor.vinculo@exemplo.com',FOTOPOSTO='fotografo.posto@exemplo.com',VALIDA='validador.teste@exemplo.com',CAMPO='campo.teste@exemplo.com',ATIV='ativ.teste@exemplo.com',ANTIGO='caixa.antigo@exemplo.com',PERSO='caixa.personalizado@exemplo.com';
(async()=>{
const b=await chromium.launch();const errs=[];
const FEED={gen:'bf1',rev:0,sessoes:[]};const poe=x=>{x.rev=++FEED.rev;const i=FEED.sessoes.findIndex(y=>y.card===x.card);if(i>=0)FEED.sessoes[i]=x;else FEED.sessoes.push(x);return x;};
async function agente(ctx){
  await ctx.route(ORIG+'/**',r=>{const rq=r.request();const u=new URL(rq.url());const p=u.pathname;const j=(o,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(o)});
    if(/\.(html|js|css|png|jpg|jpeg|webp|svg|json|woff2?|ico|wasm|onnx)$/.test(p))return r.fallback();
    if(p.startsWith('/auth/'))return r.fallback();
    if(p==='/status')return j({ok:true,agent:'eterna-agente',version:3,boot:FEED.gen,card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:FEED.rev,gen:FEED.gen,hoje:FEED.sessoes.length,abertas:0}});
    if(p==='/sessoes'){const d=+u.searchParams.get('desde')||0;return j({ok:true,gen:FEED.gen,rev:FEED.rev,pausa:60,rostos:true,completo:!d,sessoes:FEED.sessoes.filter(x=>x.rev>d&&u.searchParams.get('ontem')!=='1')});}
    if(p.startsWith('/thumb/')||p.startsWith('/file/'))return r.fulfill({status:200,contentType:'image/jpeg',body:JPG});
    if(p==='/events')return j({events:[],next:0,total:0});
    if(rq.method()!=='GET')return j({ok:true});
    return j({erro:'sem_permissao'},403);});}
const novo=async(w,h,comAgente)=>{const ctx=await b.newContext({viewport:{width:w,height:h},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());if(comAgente!==false)await agente(ctx);
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||12000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(150);}return false;};
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);
  await pg.evaluate(([a,f,c,q,h,vk,an,pe,fp,va,ca,at])=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
    const novo=(e,n,pr,key)=>({v:2,email:e,name:n,preset:pr,key:key||null,active:true,perms:ETERNA.presetPerms(pr),menu:ETERNA.presetMenu(pr),inicio:ETERNA.PRESETS[pr].inicio||'',createdAt:'2026-11-25'});
    const adm=Object.values(U0).find(u=>u&&u.preset==='admin');U0[a]={...adm,email:a,name:'Admin de teste',key:null};
    U0[f]=novo(f,'Fotógrafo de teste','foto','samuel');U0[c]=novo(c,'Caixa de teste','venda');U0[q]=novo(q,'Checkout de teste','quiosque');U0[h]=novo(h,'Hugo de Teste','foto','hugo');
    // 26/11: vendedor com vínculo de fotógrafo; atendente gravado antes (menu antigo, sem a marca da migração); personalizado com o Posto e sem a tela (já migrado)
    const semBf=m=>m.filter(v=>v!=='procurar');U0[vk]=novo(vk,'Vendedor com vínculo','venda','samuel');U0[va]=novo(va,'Validador de teste','valida');U0[ca]=novo(ca,'Campo de teste','campo');U0[at]=novo(at,'Vendedor de ativações','ativ');
    {const pf=ETERNA.presetPerms('foto'),pv=ETERNA.presetPerms('venda');const perms={};Object.keys(pf).forEach(m=>{perms[m]={};['c','r','u','d'].forEach(k=>{perms[m][k]=!!(pf[m][k]||pv[m][k]);});});
      U0[fp]=Object.assign(novo(fp,'Fotógrafo com Posto','foto','samuel'),{preset:'custom',perms,menu:[...new Set([...ETERNA.presetMenu('foto'),...ETERNA.presetMenu('venda')])]});}
    const JA={mv:83,mfl81:1,mcg97:1,mpv83:1,mst92:1,mav100:1,mav101:1,mae1511:1,mae102:1,mar100:1,mff87:1,msis94:1,menv96:1,mtr16:1,mlx24:1,mmn26:1,msup98:1}; // as migrações de antes já feitas, como no cadastro de verdade
    if(!U0[an])U0[an]=Object.assign(novo(an,'Atendente antigo','venda'),JA,{menu:semBf(ETERNA.presetMenu('venda'))});
    U0[pe]=Object.assign(novo(pe,'Personalizado de teste','venda'),{preset:'custom',menu:semBf(ETERNA.presetMenu('venda')),mpf26:1});
    localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[ADMIN,FOTO,CAIXA,QUIOSQUE,HUGO,VKEY,ANTIGO,PERSO,FOTOPOSTO,VALIDA,CAMPO,ATIV]);
  await pg.reload();await pg.waitForTimeout(350);return entrarTeste(pg,email);}
const abrir=async(pg,h)=>{await pg.goto('about:blank');await pg.goto(U+h);await pg.waitForTimeout(450);};
const cartoes=pg=>pg.evaluate(()=>[...document.querySelectorAll('#bf-lista .bf-card')].map(c=>({card:c.dataset.card,hora:(c.querySelector('.ps-hora')||{}).textContent||'',fot:(c.querySelector('.ps-fot')||{}).textContent||'',nf:(c.querySelector('.bf-nf')||{}).textContent||'',txt:c.textContent,
  imgs:[...c.querySelectorAll('img')].map(i=>({l:i.getAttribute('loading'),s:i.getAttribute('src')}))})));
const clica=async(pg,sel)=>{if(!await pg.evaluate(sel=>{const x=document.querySelector(sel);if(!x)return false;x.click();return true;},sel))throw new Error('sem o elemento '+sel);await pg.waitForTimeout(200);};
const escolhe=async(pg,id,v)=>{await pg.evaluate(([id,v])=>{const s=document.querySelector(id);s.value=v;if(s.value!==v)throw new Error('sem a opção '+v+' em '+id);s.dispatchEvent(new Event('change',{bubbles:true}));},[id,v]);await pg.waitForTimeout(200);};
const est=pg=>pg.evaluate(()=>({n:(document.querySelector('#bf-n')||{}).textContent||'',hora:([...document.querySelectorAll('[data-act="bf-hora"]')].find(x=>x.getAttribute('aria-pressed')==='true')||{dataset:{}}).dataset.h||'',fim:!!document.querySelector('#bf-fim'),y:Math.round(scrollY),aviso:(document.querySelector('#bf-aviso')||{}).textContent||''}));
const fundo=async pg=>{await pg.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await pg.waitForTimeout(250);};
try{
  // feed: 180 sessões (120 do Samuel, 30 do Carlos, 30 do "hugo", que só existe no cadastro de usuários), uma sem fotógrafo e uma com
  // nome malicioso; mais uma removida, uma sem foto e uma de ontem, que nunca aparecem
  const S=[];const quem=i=>i%6===0?'carlos':i%6===3?'hugo':'samuel';let i=0;const mais=(min)=>{i++;S.push(poe(sessao({card:'LPBF'+String(i).padStart(5,'0'),min,fotografo:quem(i)})));};
  for(let k=1;k<=10;k++)mais(k*2);            // últimos 30 min
  for(let k=1;k<=10;k++)mais(35+k*2);         // entre 30 min e 1 h
  for(let k=1;k<=20;k++)mais(70+k*4);         // entre 1 h e 3 h
  for(let k=1;k<=140;k++)mais(200+k*3);       // mais de 3 h
  S.push(poe(sessao({card:'LPBFSEMFO',min:5.5,fotografo:''})));S.push(poe(sessao({card:'LPBFXSS00',min:6.5,fotografo:XSS,n:9})));
  poe(sessao({card:'LPBFREMOV',min:3,removida:true}));poe(sessao({card:'LPBFVAZIA',min:3,n:0}));poe(sessao({card:'LPBFONTEM',min:3,dia:dia(AGORA-86400)}));
  const desc=l=>l.slice().sort((p,q)=>hora(q)-hora(p)).map(x=>x.card);const ate=m=>S.filter(x=>hora(x)>=AGORA-m*60);const de=k=>S.filter(x=>x.fotografo===k);
  const {ctx,pg}=await novo(1280,800);
  ok(await entrar(pg,ADMIN),'login do Admin de teste');
  // Minhas fotos: sem o seletor Fotógrafo, com todos; o cabeçalho não diz o nome de um fotógrafo
  await abrir(pg,'#importar');
  {const r=await pg.evaluate(()=>({sel:!!document.querySelector('#main [data-act="imp-key"]'),key:ETERNA.state.imp.key,eb:(document.querySelector('#main .head .eyebrow')||{}).textContent||''}));
    ok(!r.sel&&r.key==='todos'&&/Todos os fotógrafos/.test(r.eb)&&!/Samuel/i.test(r.eb),'Minhas fotos do Admin: sem seletor, com todos: '+J(r));}
  ok(await espera(pg,n=>Object.keys(ETERNA.SRV.sess).length>=n,20000,S.length),'feed do agente falso chegou');
  await pg.evaluate(()=>{ETERNA.simOf('LPBF00002').status='paga';ETERNA.saveSim();});
  // menu: Procurar fotos logo abaixo de Minhas fotos
  const nav=await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v));ok(nav.indexOf('procurar')===nav.indexOf('importar')+1&&nav.includes('importar'),'menu: procurar logo depois de importar: '+nav.join());
  await clica(pg,'#nav button[data-v="procurar"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>location.hash==='#procurar'&&document.querySelector('#main h1').textContent==='Procurar fotos'),'abre em #procurar com o título');
  // padrão com Todos: última 1 hora; sem botão de página
  let cs=await cartoes(pg),e=await est(pg);
  ok(e.hora==='m60'&&cs.map(c=>c.card).join()===desc(ate(60)).join()&&e.n===ate(60).length+' sessões'&&!e.fim,'Todos abre na última 1 hora, mais nova primeiro: '+J(e)+' '+cs.length+' de '+ate(60).length);
  ok(!await pg.$('[data-act="bf-mais"],[data-act="ps-mais"]'),'sem botão de paginação');
  ok(!cs.some(c=>['LPBFREMOV','LPBFVAZIA','LPBFONTEM'].includes(c.card)),'removida, sem foto e de ontem fora da lista');
  await clica(pg,'[data-act="bf-hora"][data-h="m30"]');cs=await cartoes(pg);ok(cs.map(c=>c.card).join()===desc(ate(30)).join()&&cs.length===12,'Últimos 30 min: '+cs.length);
  await clica(pg,'[data-act="bf-hora"][data-h="m180"]');await fundo(pg);await fundo(pg);cs=await cartoes(pg);e=await est(pg);ok(cs.map(c=>c.card).join()===desc(ate(180)).join()&&e.n===ate(180).length+' sessões'&&cs.length===42,'Últimas 3 horas: '+cs.length+' '+e.n);
  await pg.evaluate(()=>window.scrollTo(0,0));
  // o que cada cartão mostra
  await clica(pg,'[data-act="bf-hora"][data-h="m30"]');cs=await cartoes(pg);
  {const c1=cs.find(c=>c.card==='LPBF00001'),c2=cs.find(c=>c.card==='LPBF00002'),cx=cs.find(c=>c.card==='LPBFXSS00'),sf=cs.find(c=>c.card==='LPBFSEMFO');const hh=t=>{const d=new Date(t*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
    const x1=S[0];const hi=hh(x1.cap0),hf=hh(hora(x1));
    ok(c1&&c1.hora===(hi===hf?hf:hi+' a '+hf)&&c1.fot==='Samuel'&&c1.nf==='6 fotos'&&/LPBF00001/.test(c1.txt)&&!/Já vendida/.test(c1.txt),'cartão: hora inicial e final, fotógrafo, código e fotos: '+J(c1&&{h:c1.hora,f:c1.fot,n:c1.nf}));
    ok(c2&&/Já vendida/.test(c2.txt),'selo Já vendida na sessão paga');
    ok(cx&&cx.fot===XSS&&cx.imgs.length===6&&cx.nf==='9 fotos'&&await pg.evaluate(()=>window.__xss===undefined&&!document.querySelector('#bf img[onerror]')),'nome malicioso fica como texto; no máximo 6 miniaturas: '+J(cx&&{f:cx.fot,i:cx.imgs.length}));
    ok(sf&&sf.fot==='Sem fotógrafo','sessão sem fotógrafo: '+J(sf&&sf.fot));
    ok(cs.every(c=>c.imgs.length<=6&&c.imgs.every(i=>i.l==='lazy'&&/\/thumb\/[0-9a-f]+$/.test(i.s))),'miniaturas lazy, de /thumb/');
    ok(await espera(pg,()=>{const i=[...document.querySelectorAll('#bf-lista .bf-card[data-card="LPBF00001"] img')];return i.length===6&&i.every(x=>x.complete&&x.naturalWidth>0&&getComputedStyle(x).objectFit==='contain');}),'miniaturas com a foto inteira (contain)');}
  // fotógrafos do seletor: só quem tem sessão hoje, com a contagem; o "hugo" pelo cadastro de usuários
  const ops=await pg.$$eval('#bf-foto option',o=>o.map(x=>({v:x.value,t:x.textContent})));
  ok(ops.length===6&&ops[0].v==='todos'&&ops[0].t==='Todos ('+S.length+')'&&ops.some(o=>o.v==='samuel'&&o.t==='Samuel (120)')&&ops.some(o=>o.v==='carlos'&&o.t==='Carlos (30)')&&ops.some(o=>o.v==='hugo'&&o.t==='Hugo de Teste (30)')&&ops.some(o=>o.v===''&&o.t==='Sem fotógrafo (1)')&&ops.some(o=>o.v===XSS&&o.t===XSS+' (1)'),'seletor de fotógrafo: '+J(ops));
  ok(await pg.evaluate(()=>{const s=document.querySelector('#bf-foto');const o=document.createElement('option');o.value='ninguem';s.appendChild(o);s.value='ninguem';s.dispatchEvent(new Event('change',{bubbles:true}));return ETERNA.state.procurar.key;})==='todos','fotógrafo fora da lista não é aceito');
  // fotógrafo escolhido: dia todo, tudo do filtro por rolagem contínua, sem redesenhar o que já está na tela
  await escolhe(pg,'#bf-foto','samuel');cs=await cartoes(pg);e=await est(pg);const SAM=desc(de('samuel'));
  ok(e.hora==='dia'&&e.n==='120 sessões'&&cs.length>=24&&cs.length<120&&cs.length%24===0&&e.fim&&cs.every(c=>c.fot==='Samuel')&&cs.map(c=>c.card).join()===SAM.slice(0,cs.length).join(),'Samuel abre no dia todo com o primeiro lote: '+cs.length+' '+J(e));
  await pg.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='1';document.querySelector('#bf-lista .bf-card').dataset.marca='1';});
  {let ant=cs.length,yAnt=0,voltas=0,cresceu=true,desceu=true;while(ant<120&&voltas++<12){await fundo(pg);const n=(await cartoes(pg)).length;const y=(await est(pg)).y;if(n<=ant)cresceu=false;if(y<yAnt||y===0)desceu=false;ant=n;yAnt=y;}
    cs=await cartoes(pg);e=await est(pg);
    ok(cresceu&&desceu&&cs.length===120&&cs.map(c=>c.card).join()===SAM.join()&&!e.fim,'a rolagem traz os lotes seguintes até os 120, sem perder a posição: '+cs.length+' y '+e.y);
    ok(await pg.evaluate(()=>document.querySelector('#bf-lista').dataset.marca==='1'&&document.querySelector('#bf-lista .bf-card').dataset.marca==='1'),'os lotes entram sem redesenhar os cartões que já estavam na tela');
    const imgs=await pg.evaluate(()=>document.querySelectorAll('#bf-lista img').length);ok(imgs===720,'6 miniaturas por cartão, todas lazy: '+imgs);}
  // hora cheia (seletor recolhido)
  {const h0=hCheia(S[100]);const espH=desc(de('samuel').filter(x=>hCheia(x)===h0));await pg.evaluate(()=>window.scrollTo(0,0));await escolhe(pg,'#bf-hc',String(h0));await fundo(pg);await fundo(pg);cs=await cartoes(pg);e=await est(pg);
    ok(espH.length>0&&cs.map(c=>c.card).join()===espH.join()&&e.hora===''&&e.n.startsWith(espH.length+' '),'hora cheia '+h0+'h: '+cs.length+' de '+espH.length);
    await pg.evaluate(()=>window.scrollTo(0,0));await clica(pg,'[data-act="bf-hora"][data-h="dia"]');}
  // código: filtra, mantém o foco e o texto, ignora a hora
  await clica(pg,'[data-act="bf-hora"][data-h="m30"]');await pg.focus('#bf-cod');await pg.keyboard.type('bf00151');await pg.waitForTimeout(250);cs=await cartoes(pg);
  {const d=await pg.evaluate(()=>({v:document.querySelector('#bf-cod').value,foco:document.activeElement&&document.activeElement.id}));
    ok(cs.length===1&&cs[0].card==='LPBF00151'&&d.v==='bf00151'&&d.foco==='bf-cod','código acha a sessão fora do horário, com foco e texto no campo: '+J(d)+' '+cs.map(c=>c.card).join());}
  await pg.fill('#bf-cod','ZZZZ');await pg.waitForTimeout(250);ok(await pg.evaluate(()=>!document.querySelector('#bf-lista .bf-card')&&!!document.querySelector('#bf-vazia')),'código sem sessão avisa');
  await pg.fill('#bf-cod','');await pg.waitForTimeout(250);await clica(pg,'[data-act="bf-hora"][data-h="dia"]');
  // ordem invertida
  await clica(pg,'[data-act="bf-ord"][data-o="asc"]');cs=await cartoes(pg);ok(cs[0].card===SAM[SAM.length-1]&&cs.map(c=>c.card).join()===SAM.slice().reverse().slice(0,cs.length).join(),'mais antiga primeiro: '+cs[0].card);
  await clica(pg,'[data-act="bf-ord"][data-o="desc"]');
  // abrir a sessão e voltar: mesma posição e mesmos filtros
  await fundo(pg);await fundo(pg);const nAntes=(await cartoes(pg)).length;const alvo=SAM[40];
  await pg.evaluate(c=>document.querySelector('#bf-lista .bf-card[data-card="'+c+'"]').scrollIntoView({block:'center'}),alvo);await pg.waitForTimeout(200);const y0=(await est(pg)).y;
  // tocar na miniatura do cartão abre a foto grande; as setas ficam na sessão; fechar não redesenha nem rola
  {await pg.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='z';});const pidEsp=S.find(x=>x.card===alvo).fotos;
    await pg.evaluate(c=>{const m=document.querySelectorAll('#bf-lista .bf-card[data-card="'+c+'"] .bf-mini')[2];delete ETERNA.ajT.UP['ag_'+m.dataset.pid];m.click();},alvo);await pg.waitForTimeout(350);
    const z=()=>pg.evaluate(()=>({aberto:document.querySelector('#modal').hasAttribute('data-open'),cap:document.querySelector('#modal-cap').textContent,img:document.querySelector('#modal-img').outerHTML.match(/\/(?:thumb|file)\/([0-9a-f]+)/g)||[],view:ETERNA.state.view,sess:!!document.querySelector('.bf-sess')}));
    let m=await z();ok(m.aberto&&!m.sess&&m.cap.includes('Samuel · '+alvo)&&/foto 3 de 6/.test(m.cap)&&m.img.some(u=>u.endsWith(pidEsp[2])),'miniatura do cartão abre o zoom na foto certa, com fotógrafo, código e hora: '+J(m));
    await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(200);m=await z();ok(/foto 4 de 6/.test(m.cap)&&m.img.some(u=>u.endsWith(pidEsp[3])),'próxima: foto 4 da mesma sessão: '+m.cap);
    for(let k=0;k<5;k++){await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(80);}m=await z();ok(/foto 6 de 6/.test(m.cap)&&m.cap.includes(alvo),'as setas param na última foto da sessão: '+m.cap);
    await pg.keyboard.press('ArrowLeft');await pg.waitForTimeout(150);m=await z();ok(/foto 5 de 6/.test(m.cap),'anterior: '+m.cap);
    await pg.keyboard.press('Escape');await pg.waitForTimeout(250);const d=await pg.evaluate(()=>({aberto:document.querySelector('#modal').hasAttribute('data-open'),marca:document.querySelector('#bf-lista').dataset.marca,y:Math.round(scrollY),key:document.querySelector('#bf-foto').value,n:document.querySelectorAll('#bf-lista .bf-card').length}));
    ok(!d.aberto&&d.marca==='z'&&d.y===y0&&d.key==='samuel'&&d.n===nAntes,'fechar o zoom deixa a lista como estava (mesmos nós, rolagem e filtros): '+J(d)+' y antes '+y0);
    const t=await pg.evaluate(()=>({mini:[...document.querySelectorAll('#bf-lista .bf-mini')].slice(0,60).filter(x=>{const r=x.getBoundingClientRect();return r.width<44||r.height<44;}).length,abre:[...document.querySelectorAll('#bf-lista .bf-abre')].slice(0,20).filter(x=>x.getBoundingClientRect().height<44).length}));ok(!t.mini&&!t.abre,'áreas de toque com 44 px ou mais (1280): '+J(t));}
  await clica(pg,'#bf-lista .bf-card[data-card="'+alvo+'"] .bf-abre');await pg.waitForTimeout(250);
  {const a=await pg.evaluate(()=>({card:(document.querySelector('.bf-sess')||{dataset:{}}).dataset.card,fotos:document.querySelectorAll('.bf-sess .photos .ph').length,imgs:[...document.querySelectorAll('.bf-sess .photos .ph img')].every(i=>getComputedStyle(i).objectFit==='contain'&&i.getAttribute('loading')==='lazy'),h:location.hash,view:ETERNA.state.view,venda:!!document.querySelector('#main [data-act="checkout-pick"],#main [data-act="fila-sel"],#posto-manual'),lista:!!document.querySelector('#bf-lista'),y:scrollY}));
    ok(a.card===alvo&&a.fotos===6&&a.imgs&&a.h==='#procurar'&&a.view==='procurar'&&!a.venda&&!a.lista&&a.y===0,'abre as fotos da sessão na própria tela, sem tela de venda: '+J(a));}
  await clica(pg,'.bf-sess .photos .ph');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open')),'o toque na foto abre o zoom');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(200);if(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open')))await pg.evaluate(()=>document.querySelector('#modal').removeAttribute('data-open'));
  await clica(pg,'[data-act="bf-voltar"]');await pg.waitForTimeout(250);cs=await cartoes(pg);e=await est(pg);
  ok(Math.abs(e.y-y0)<=2&&cs.length===nAntes&&e.hora==='dia'&&await pg.evaluate(()=>document.querySelector('#bf-foto').value)==='samuel','Voltar devolve à lista na mesma posição e com os mesmos filtros: y '+e.y+' (antes '+y0+'), '+cs.length+' cartões');
  // sessão nova chegando: a lista não muda, a rolagem não muda, o foco fica; só o aviso aparece
  await pg.evaluate(()=>{document.querySelector('#bf-lista').dataset.marca='2';});await pg.focus('#bf-cod');await pg.evaluate(y=>window.scrollTo(0,y),y0);await pg.waitForTimeout(150);const y1=(await est(pg)).y;
  poe(sessao({card:'LPBFNOVA1',min:0.2,fotografo:'samuel'}));poe(sessao({card:'LPBFNOVA2',min:0.1,fotografo:'samuel'}));poe(sessao({card:'LPBFNOVA3',min:0.1,fotografo:'carlos'}));
  ok(await espera(pg,()=>/2 sessões novas/.test((document.querySelector('#bf-aviso')||{}).textContent||'')&&!!document.querySelector('#bf-aviso [data-act="bf-atualizar"]')),'aviso "2 sessões novas" com Atualizar (só as do filtro): '+(await est(pg)).aviso);
  await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(3000); // mais um ciclo do servidor e um redesenho geral
  {const d=await pg.evaluate(()=>({marca:document.querySelector('#bf-lista').dataset.marca,n:document.querySelectorAll('#bf-lista .bf-card').length,nova:!!document.querySelector('#bf-lista [data-card^="LPBFNOVA"]'),foco:document.activeElement&&document.activeElement.id,y:Math.round(scrollY),cont:document.querySelector('#bf-n').textContent}));
    ok(d.marca==='2'&&d.n===nAntes&&!d.nova&&d.foco==='bf-cod'&&d.y===y1&&d.cont==='120 sessões','a lista não se mexe sozinha (mesmos nós, mesma rolagem, foco no campo): '+J(d)+' y antes '+y1);}
  await clica(pg,'[data-act="bf-atualizar"]');await pg.waitForTimeout(250);cs=await cartoes(pg);e=await est(pg);
  ok(cs[0].card==='LPBFNOVA2'&&cs[1].card==='LPBFNOVA1'&&e.n==='122 sessões'&&e.aviso===''&&e.y===0,'Atualizar traz as novas para o topo e some com o aviso: '+J(e)+' '+cs.slice(0,2).map(c=>c.card).join());
  // sessão removida no servidor (LGPD) sai da tela sem esperar o Atualizar
  poe(Object.assign({},S.find(x=>x.card===SAM[0]),{removida:true}));
  ok(await espera(pg,c=>!document.querySelector('#bf-lista [data-card="'+c+'"]'),12000,SAM[0]),'sessão removida no servidor sai da lista na hora');
  // 390 px: sem rolagem horizontal, na lista e na sessão aberta; botões com 44 px ou mais
  await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(350);
  {const m=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,baixos:[...document.querySelectorAll('#bf [data-act="bf-hora"],#bf [data-act="bf-ord"],#bf select,#bf #bf-cod,#bf .bf-abre,#bf .bf-mini')].filter(x=>x.getBoundingClientRect().height<44||x.getBoundingClientRect().width<44).map(x=>x.id||x.dataset.h||x.dataset.o),fora:[...document.querySelectorAll('#bf *')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).length,n:document.querySelectorAll('#bf-lista .bf-card').length}));
    ok(m.sw<=m.cw&&!m.baixos.length&&!m.fora&&m.n>=24,'390×844 na lista: '+J(m));}
  if(process.env.BF_PRINTS)await pg.screenshot({path:path.join(process.env.BF_PRINTS,'bf-390.png')});
  await clica(pg,'#bf-lista .bf-card .bf-abre');await pg.waitForTimeout(250);
  {const m=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,n:document.querySelectorAll('.bf-sess .ph').length}));ok(m.sw<=m.cw&&m.n===6,'390×844 na sessão aberta: '+J(m));}
  await clica(pg,'[data-act="bf-voltar"]');await pg.setViewportSize({width:1280,height:800});await pg.waitForTimeout(250);
  if(process.env.BF_PRINTS)await pg.screenshot({path:path.join(process.env.BF_PRINTS,'bf-1280.png')});
  // textos nas línguas da equipe, sem chave crua nem travessão
  for(const l of ['pt','en','es','fr']){const t=await pg.evaluate(l=>{ETERNA.state.langEq=l;if(ETERNA.state.user)ETERNA.state.user.idioma=l;ETERNA.render();return {h:document.querySelector('#main h1').textContent,p:document.querySelector('#bf').innerText};},l);
    ok(t.h&&!/\b(bf|ps|v|up)_[a-z0-9_]+/.test(t.p+t.h)&&!/[–—]/.test(t.p),l+': sem chave crua nem travessão: '+t.h);}
  await pg.evaluate(()=>{ETERNA.state.langEq='pt';ETERNA.state.user.idioma='pt';ETERNA.render();});
  ok(await pg.evaluate(()=>window.__xss===undefined),'nada do servidor virou HTML');
  await ctx.close();
  // fotógrafo logado: só as dele, sem seletor, dia todo; não abre sessão de outro; Minhas fotos no próprio nome
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,FOTO),'login do fotógrafo de teste (Samuel)');
    await abrir(pg,'#importar');{const r=await pg.evaluate(()=>({sel:!!document.querySelector('#main [data-act="imp-key"]'),key:ETERNA.state.imp.key,fixo:(document.querySelector('#main .imp-fixo')||{}).textContent||'',eb:(document.querySelector('#main .head .eyebrow')||{}).textContent||''}));
      ok(!r.sel&&r.key==='samuel'&&/Samuel/.test(r.fixo)&&/Samuel/.test(r.eb),'Minhas fotos do fotógrafo: no próprio nome, sem seletor: '+J(r));}
    ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length>=180,20000),'feed chegou ao fotógrafo');
    ok((await pg.$$eval('#nav button[data-v]',e=>e.map(x=>x.dataset.v))).includes('procurar'),'fotógrafo tem Procurar fotos no menu');
    await clica(pg,'#nav button[data-v="procurar"]');await pg.waitForTimeout(300);await fundo(pg);await fundo(pg);await fundo(pg);await fundo(pg);await fundo(pg);const cs=await cartoes(pg);const e=await est(pg);
    const r=await pg.evaluate(()=>({sel:!!document.querySelector('#bf-foto'),fixo:(document.querySelector('#bf .imp-fixo')||{}).textContent||'',base:ETERNA.bfBase().every(x=>x.fotografo==='samuel'),n:ETERNA.bfBase().length}));
    ok(!r.sel&&/Samuel/.test(r.fixo)&&r.base&&e.hora==='dia'&&cs.length===r.n&&cs.length>=120&&cs.every(c=>c.fot==='Samuel'),'fotógrafo vê só as próprias sessões, sem seletor, no dia todo: '+cs.length+' '+J(r));
    await pg.evaluate(()=>{window.scrollTo(0,0);const x=document.createElement('button');x.dataset.act='bf-abrir';x.dataset.card='LPBF00006';document.querySelector('#bf').appendChild(x);x.click();x.remove();const s=document.createElement('select');s.dataset.act='bf-foto';s.innerHTML='<option value="carlos">c</option>';document.querySelector('#bf').appendChild(s);s.dispatchEvent(new Event('change',{bubbles:true}));});await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>!document.querySelector('.bf-sess')&&ETERNA.state.procurar.key==='todos'&&!document.querySelector('#bf-lista [data-card="LPBF00006"]')&&[...document.querySelectorAll('#bf-lista .ps-fot')].every(x=>x.textContent==='Samuel')),'clique e filtro forjados não mostram sessão de outro fotógrafo');
    await ctx.close();}
  // fotógrafo cujo cadastro não está na base histórica P (Hugo): preso à própria chave nas duas telas, como qualquer fotógrafo
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,HUGO),'login do Hugo (fora da base histórica)');
    ok(await pg.evaluate(()=>!ETERNA.P.hugo&&ETERNA.impPreso()==='hugo'),'Hugo não está na base histórica e fica preso à própria chave');
    await abrir(pg,'#importar');ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length>=180,20000),'feed chegou ao Hugo');
    ok(await espera(pg,()=>document.querySelectorAll('#up-sessoes .up-sess[data-card]').length>0,8000),'Minhas fotos do Hugo mostrou sessões');
    {const r=await pg.evaluate(()=>{const cs=[...document.querySelectorAll('#up-sessoes .up-sess[data-card]')].map(x=>x.dataset.card);const L=ETERNA.upSessLista();
        return {sel:!!document.querySelector('#main [data-act="imp-key"]'),key:ETERNA.state.imp.key,fixo:(document.querySelector('#main .imp-fixo')||{}).textContent||'',n:cs.length,total:L.length,
          dele:cs.every(c=>(ETERNA.SRV.sess[c]||{}).fotografo==='hugo'),lista:L.every(x=>x.fotografo==='hugo'),outro:!!document.querySelector('#main [data-card="LPBF00001"],#main [data-card="LPBF00006"]')};});
      ok(!r.sel&&r.key==='hugo'&&/Hugo de Teste/.test(r.fixo)&&r.n>0&&r.total===30&&r.dele&&r.lista&&!r.outro,'Minhas fotos do Hugo: só as sessões dele, no próprio nome, sem seletor: '+J(r));}
    await clica(pg,'#nav button[data-v="procurar"]');await pg.waitForTimeout(300);await fundo(pg);await fundo(pg);await fundo(pg);const cs=await cartoes(pg);const e=await est(pg);
    const r=await pg.evaluate(()=>({sel:!!document.querySelector('#bf-foto'),fixo:(document.querySelector('#bf .imp-fixo')||{}).textContent||'',base:ETERNA.bfBase().every(x=>x.fotografo==='hugo'),n:ETERNA.bfBase().length}));
    ok(!r.sel&&/Hugo de Teste/.test(r.fixo)&&r.base&&r.n===30&&e.hora==='dia'&&cs.length===30&&cs.every(c=>c.fot==='Hugo de Teste'),'Hugo vê só as próprias sessões, sem seletor, no dia todo: '+cs.length+' '+J(r)+' '+J(e));
    // LPBF00001 é do Samuel e LPBF00006 é do Carlos
    await pg.evaluate(()=>{window.scrollTo(0,0);for(const c of ['LPBF00001','LPBF00006']){const x=document.createElement('button');x.dataset.act='bf-abrir';x.dataset.card=c;document.querySelector('#bf').appendChild(x);x.click();x.remove();}
      for(const v of ['samuel','carlos','todos']){const s=document.createElement('select');s.dataset.act='bf-foto';s.innerHTML='<option value="'+v+'">x</option>';document.querySelector('#bf').appendChild(s);s.dispatchEvent(new Event('change',{bubbles:true}));}});await pg.waitForTimeout(250);
    {const f=await pg.evaluate(()=>({sess:!!document.querySelector('.bf-sess'),key:ETERNA.state.procurar.key,sel:!!document.querySelector('#bf-foto'),n:document.querySelectorAll('#bf-lista .bf-card').length,
        fots:[...new Set([...document.querySelectorAll('#bf-lista .ps-fot')].map(x=>x.textContent))],base:ETERNA.bfBase().every(x=>x.fotografo==='hugo'),itens:ETERNA.state.procurar.snap.itens.every(x=>x.fotografo==='hugo'),outro:!!document.querySelector('#bf-lista [data-card="LPBF00001"],#bf-lista [data-card="LPBF00006"]')}));
      ok(!f.sess&&f.key==='todos'&&!f.sel&&f.n>0&&f.fots.length===1&&f.fots[0]==='Hugo de Teste'&&f.base&&f.itens&&!f.outro,'Hugo: clique e bf-foto forjados não mostram sessão de outro fotógrafo: '+J(f));}
    await ctx.close();}
  // 26/11 (Eduardo): atendimento e venda vê Procurar fotos, com todos os fotógrafos, só para olhar, sem ganhar Minhas fotos
  // CAIXA = perfil pronto; VKEY = vendedor com vínculo de fotógrafo no cadastro (não é fotógrafo: não fica preso)
  for(const [email,nome] of [[CAIXA,'Atendimento e venda'],[VKEY,'Vendedor com vínculo de fotógrafo']]){const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,email),'login: '+nome);
    ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length>=180,20000),nome+': feed chegou');
    {const r=await pg.evaluate(()=>({nav:[...document.querySelectorAll('#nav button[data-v]')].map(x=>x.dataset.v),pode:ETERNA.canView('procurar'),imp:ETERNA.canView('importar'),preso:ETERNA.impPreso(),grupo:(ETERNA.viewsMenu().find(v=>v[0]==='procurar')||[])[3],
        fot:['diario','importar','fotofila','ajustes'].filter(v=>ETERNA.canView(v))}));
      ok(r.pode&&!r.imp&&r.preso===null&&!r.fot.length&&r.nav.includes('procurar')&&r.nav.indexOf('procurar')===r.nav.indexOf('posto')+1&&!r.nav.includes('importar')&&r.grupo==='Venda',nome+': Procurar fotos no menu logo depois do Posto, no grupo Venda, sem Minhas fotos nem o resto do Fotógrafo: '+J(r));}
    await abrir(pg,'#importar');ok(await pg.evaluate(()=>ETERNA.state.view!=='importar'&&!document.querySelector('#up-sessoes,[data-act="envio-escolher"]')),nome+': #importar não abre');ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length>=180,20000),nome+': feed chegou de novo');
    await clica(pg,'#nav button[data-v="procurar"]');await pg.waitForTimeout(300);
    {const ops=await pg.$$eval('#bf-foto option',o=>o.map(x=>x.value));const cs=await cartoes(pg);const e=await est(pg);
      const r=await pg.evaluate(()=>({h:location.hash,eb:(document.querySelector('#main .head .eyebrow')||{}).textContent||'',fixo:!!document.querySelector('#bf .imp-fixo'),quem:!!document.querySelector('#main .setwho,#main [data-act="set-switch"],#main [data-act="set-logout"]'),
        fots:[...new Set(ETERNA.bfBase().map(x=>x.fotografo))].length,chips:document.querySelectorAll('#bf [data-act="bf-hora"]').length,cod:!!document.querySelector('#bf-cod'),hc:!!document.querySelector('#bf-hc'),ro:/Somente leitura/.test(document.querySelector('#venue-sub').textContent)}));
      ok(r.h==='#procurar'&&r.eb==='Venda'&&!r.fixo&&!r.quem&&ops.includes('todos')&&ops.includes('samuel')&&ops.includes('carlos')&&ops.includes('hugo')&&r.fots>=4&&r.chips===4&&r.cod&&r.hc&&e.hora==='m60'&&cs.length>0&&new Set(cs.map(c=>c.fot)).size>1,nome+': vê todos os fotógrafos, com seletor, períodos, código e hora, como o Admin: '+J(r)+' '+J(ops)+' '+cs.length);}
    await escolhe(pg,'#bf-foto','carlos');{const cs=await cartoes(pg);const e=await est(pg);ok(e.hora==='dia'&&cs.length>0&&cs.every(c=>c.fot==='Carlos'),nome+': escolhe um fotógrafo e vê o dia dele: '+cs.length);}
    // nenhuma ação que grava na tela, nem com clique forjado; zoom e Ver sessão sem ferramentas
    {const r=await pg.evaluate(()=>({tela:[...document.querySelectorAll('#main [data-act]')].map(x=>x.dataset.act).filter(a=>ETERNA.WRITE_OPS[a]),forj:['m-discard','m-rate','m-adjust','imp-files','envio-files','envio-escolher','ing-start','ing-reset','aj-discard','reset','save'].filter(a=>ETERNA.guardAct(a)),set:['c','u','d'].filter(k=>ETERNA.can('set',k))}));
      ok(!r.tela.length&&!r.forj.length&&!r.set.length,nome+': só leitura (nenhuma ação que grava na tela, forjada também não passa): '+J(r));}
    await clica(pg,'#bf-lista .bf-card .bf-mini');await pg.waitForTimeout(350);
    ok(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open')&&!document.querySelector('#modal-tools').innerHTML.trim()&&/Carlos/.test(document.querySelector('#modal-cap').textContent)),nome+': a miniatura abre a foto grande, sem ferramentas');
    await pg.keyboard.press('Escape');await pg.waitForTimeout(200);if(await pg.evaluate(()=>document.querySelector('#modal').hasAttribute('data-open')))await pg.evaluate(()=>document.querySelector('#modal').removeAttribute('data-open'));
    await clica(pg,'#bf-lista .bf-card .bf-abre');await pg.waitForTimeout(250);
    ok(await pg.evaluate(()=>!!document.querySelector('.bf-sess')&&document.querySelectorAll('.bf-sess .photos .ph').length===6&&![...document.querySelectorAll('#main [data-act]')].some(x=>ETERNA.WRITE_OPS[x.dataset.act])),nome+': Ver sessão abre as fotos, sem ação que grava');
    await clica(pg,'[data-act="bf-voltar"]');
    // com o Checkout do cliente aberto neste computador (atendente conectado), nada da tela aparece para o cliente
    if(email===CAIXA){await pg.goto('about:blank');await pg.goto(U+'#loja');await pg.waitForTimeout(2500);
      ok(await pg.evaluate(()=>!!ETERNA.state.lojaRota&&document.body.hasAttribute('data-loja')&&!document.querySelector('#bf,.bf-card')&&![...document.querySelectorAll('[data-v="procurar"]')].some(x=>x.getClientRects().length)),'Checkout do cliente aberto com o atendente conectado: sem Procurar fotos à vista');}
    await ctx.close();}
  // quem já estava cadastrado no perfil (menu antigo, sem a marca) ganha a tela sem recadastro, uma vez, logo depois do Posto
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,ANTIGO),'login: atendente cadastrado antes');
    const r=await pg.evaluate(e=>{const u=ETERNA.USERS[e];return {menu:u.menu,marca:u.mpf26,preset:u.preset,casa:ETERNA.presetMatch(u),nlog:JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(l=>l.acao==='migracao_procurar26').length,pode:ETERNA.canView('procurar'),imp:ETERNA.canView('importar'),set:ETERNA.can('set','r'),nav:[...document.querySelectorAll('#nav button[data-v]')].map(x=>x.dataset.v),
      log:(()=>{const x=JSON.parse(JSON.stringify(u));x.email='outro.antigo@exemplo.com';delete x.mpf26;x.menu=x.menu.filter(v=>v!=='procurar');ETERNA.migrateUser(x);return x.menu.includes('procurar')&&!JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').some(l=>l.acao==='migracao_procurar26');})()};},ANTIGO);
    ok(r.marca===1&&r.menu.indexOf('procurar')===r.menu.indexOf('posto')+1&&!r.menu.includes('importar')&&r.preset==='venda'&&r.casa==='venda'&&r.pode&&!r.imp&&!r.set&&r.nav.includes('procurar')&&r.log&&r.nlog===0,'atendente antigo ganha só Procurar fotos e continua no perfil; no navegador de quem não altera Permissões a migração não deixa linha no histórico: '+J(r));
    // tirada de propósito em Permissões: a marca fica e a tela não volta na carga seguinte
    await pg.evaluate(e=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1'));U0[e].menu=U0[e].menu.filter(v=>v!=='procurar');U0[e].preset='custom';localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},ANTIGO);
    await pg.reload();await pg.waitForTimeout(600);await abrir(pg,'#procurar');
    {const d=await pg.evaluate(e=>({u:!!ETERNA.state.user,menu:ETERNA.USERS[e].menu.includes('procurar'),pode:ETERNA.canView('procurar'),view:ETERNA.state.view,nav:!!document.querySelector('#nav button[data-v="procurar"]'),tela:!!document.querySelector('#bf')}),ANTIGO);
      ok(d.u&&!d.menu&&!d.pode&&d.view!=='procurar'&&!d.nav&&!d.tela,'quem teve a tela tirada não ganha de volta ao recarregar: '+J(d));}
    await ctx.close();}
  // fotógrafo que também tem o Posto (vínculo e módulo de Minhas fotos): continua preso às próprias sessões em Procurar fotos
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,FOTOPOSTO),'login: fotógrafo com Posto');ok(await espera(pg,()=>Object.keys(ETERNA.SRV.sess).length>=180,20000),'feed chegou ao fotógrafo com Posto');
    await clica(pg,'#nav button[data-v="procurar"]');await pg.waitForTimeout(300);await fundo(pg);await fundo(pg);const cs=await cartoes(pg);
    await pg.evaluate(()=>{window.scrollTo(0,0);const x=document.createElement('button');x.dataset.act='bf-abrir';x.dataset.card='LPBF00006';document.querySelector('#bf').appendChild(x);x.click();x.remove();const s=document.createElement('select');s.dataset.act='bf-foto';s.innerHTML='<option value="carlos">c</option>';document.querySelector('#bf').appendChild(s);s.dispatchEvent(new Event('change',{bubbles:true}));});await pg.waitForTimeout(250);
    const r=await pg.evaluate(()=>({preso:ETERNA.impPreso(),posto:ETERNA.canView('posto'),imp:ETERNA.canView('importar'),menu:ETERNA.state.user.menu.includes('procurar'),sel:!!document.querySelector('#bf-foto'),sess:!!document.querySelector('.bf-sess'),key:ETERNA.state.procurar.key,base:ETERNA.bfBase().length>0&&ETERNA.bfBase().every(x=>x.fotografo==='samuel'),fots:[...new Set([...document.querySelectorAll('#bf-lista .ps-fot')].map(x=>x.textContent))]}));
    ok(r.preso==='samuel'&&r.posto&&r.imp&&r.menu&&!r.sel&&!r.sess&&r.key==='todos'&&r.base&&cs.length>0&&cs.every(c=>c.fot==='Samuel')&&r.fots.join()==='Samuel','fotógrafo com Posto vê só as próprias sessões, sem seletor, nem com clique forjado: '+J(r)+' '+cs.length);await ctx.close();}
  // Validador, Equipe de campo e vendedor de Drone, Chute a Gol e Snap Pop: #procurar não abre
  for(const [email,nome] of [[VALIDA,'Validador'],[CAMPO,'Equipe de campo'],[ATIV,'Vendedor Drone, Chute a Gol e Snap Pop']]){const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,email),'login: '+nome);
    await abrir(pg,'#procurar');const r=await pg.evaluate(e=>({u:!!ETERNA.state.user,pode:ETERNA.canView('procurar'),view:ETERNA.state.view,h:location.hash,nav:!!document.querySelector('#nav button[data-v="procurar"]'),tela:!!document.querySelector('#bf'),menu:(ETERNA.USERS[e].menu||[]).includes('procurar')}),email);
    ok(r.u&&!r.pode&&r.view!=='procurar'&&r.h!=='#procurar'&&!r.nav&&!r.tela&&!r.menu,nome+' não abre #procurar: '+J(r));await ctx.close();}
  // perfil personalizado com o Posto e sem a tela (já migrado) e Checkout do cliente não veem; sem o Posto ninguém ganha
  for(const [email,nome] of [[PERSO,'Personalizado sem a tela'],[QUIOSQUE,'Checkout']]){const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,email),'login: '+nome);
    await abrir(pg,'#procurar');const r=await pg.evaluate(e=>({pode:ETERNA.canView('procurar'),view:ETERNA.state.view,nav:!!document.querySelector('#nav button[data-v="procurar"]'),tela:!!document.querySelector('#bf'),menu:(ETERNA.USERS[e].menu||[]).includes('procurar')}),email);
    ok(!r.pode&&r.view!=='procurar'&&!r.nav&&!r.tela&&!r.menu,nome+' não vê Procurar fotos: '+J(r));
    if(email===PERSO){const m=await pg.evaluate(()=>{const mk=(pr,x)=>Object.assign({v:2,email:pr+'@exemplo.com',name:pr,active:true,preset:pr,key:null,perms:ETERNA.presetPerms(pr),menu:ETERNA.presetMenu(pr).filter(v=>v!=='procurar')},x||{});const o={};
        for(const pr of ['foto','valida','quiosque','campo','ativ','snap']){const x=mk(pr);ETERNA.migraProcurar26(x);o[pr]=x.menu.includes('procurar');}
        const sup=mk('supervisor');ETERNA.migraProcurar26(sup);o.sup=sup.menu.includes('procurar')&&sup.menu.includes('importar');
        const semMenu=mk('venda',{menu:['impfila']});ETERNA.migraProcurar26(semMenu);o.semPosto=semMenu.menu.includes('procurar');
        const duas=mk('venda');ETERNA.migraProcurar26(duas);ETERNA.migraProcurar26(duas);o.duas=duas.menu.filter(v=>v==='procurar').length;
        // perfil gravado no servidor antes desta versão (sem a marca) ganha a tela; salvo depois (com a marca) vale como está
        const P0=ETERNA.PERFIS;const velho=ETERNA.presetMenu('venda').filter(v=>v!=='procurar');
        P0.venda={id:'venda',name:'Atendimento e venda',perms:ETERNA.presetPerms('venda'),menu:velho,inicio:'posto'};ETERNA.perfisAplica();o.perfilVelho=ETERNA.presetMenu('venda').includes('procurar')&&!P0.venda.menu.includes('procurar');
        P0.venda.mpf26=1;ETERNA.perfisAplica();o.perfilSalvo=ETERNA.presetMenu('venda').includes('procurar');
        delete P0.venda;ETERNA.perfisAplica();o.pronto=ETERNA.presetMenu('venda').includes('procurar');o.fotoPronto=ETERNA.presetMenu('foto').includes('procurar');o.supPronto=ETERNA.presetMenu('supervisor').includes('procurar');o.todas=ETERNA.ALL_VIEWS.includes('procurar');return o;});
      ok(!m.foto&&!m.valida&&!m.quiosque&&!m.campo&&!m.ativ&&!m.snap&&m.sup&&!m.semPosto&&m.duas===1&&m.perfilVelho&&!m.perfilSalvo&&m.pronto&&!m.fotoPronto&&m.supPronto&&m.todas,'migração: só quem vê o Posto ganha, uma vez; perfil gravado antes ganha, salvo depois vale como está: '+J(m));}
    await ctx.close();}
  {const {ctx,pg}=await novo(1280,800);await pg.goto(U+'#loja');await pg.waitForTimeout(2500);ok(await pg.evaluate(()=>!document.querySelector('#bf,.bf-card,[data-v="procurar"]')),'#loja (Checkout do cliente) sem nada da tela');await ctx.close();}
  // pessoa nova criada pelo Admin (tela Usuários) num perfil próprio "Posto sem Procurar fotos": nasce com a marca e não ganha a tela
  // na carga seguinte; a migração no navegador de quem altera Permissões deixa a linha no histórico
  {const {ctx,pg}=await novo(1280,800);ok(await entrar(pg,ADMIN),'login do Admin para criar pessoa');await abrir(pg,'#usuarios');
    const r=await pg.evaluate(()=>{const o={};const P0=ETERNA.PERFIS;const sem=ETERNA.presetMenu('venda').filter(v=>v!=='procurar');const e='pessoa.nova@exemplo.com';
      P0.psem={id:'psem',name:'Posto sem Procurar fotos',perms:ETERNA.presetPerms('venda'),menu:sem,inicio:'posto',mpf26:1};ETERNA.perfisAplica();o.perfilSem=!ETERNA.presetMenu('psem').includes('procurar');
      ETERNA.state.users.draft={email:e,email0:null,name:'Pessoa Nova de Teste',key:null,preset:'psem'};ETERNA.render();
      const b=document.createElement('button');b.dataset.act='user-save';document.querySelector('#main').appendChild(b);b.click();b.remove();
      const u=ETERNA.USERS[e];o.criou=!!u;if(!u)return o;o.marca=u.mpf26;o.preset=u.preset;o.semTela=!u.menu.includes('procurar')&&u.menu.includes('posto');
      const x=ETERNA.migrateUser(JSON.parse(JSON.stringify(u)));o.depois=!x.menu.includes('procurar');
      const gravado=JSON.parse(localStorage.getItem('eterna.users.v1'))[e];o.gravado=!!gravado&&gravado.mpf26===1&&!gravado.menu.includes('procurar');
      // controle: o mesmo cadastro sem a marca (gravado antes desta versão) ganha, e com o Admin conectado fica no histórico
      const y=JSON.parse(JSON.stringify(u));delete y.mpf26;y.email='pessoa.antiga@exemplo.com';ETERNA.migrateUser(y);o.controle=y.menu.includes('procurar');
      o.log=JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').filter(l=>l.acao==='migracao_procurar26'&&l.alvo===y.email&&l.mudancas.some(m=>m.campo==='menu'&&m.entra.join()==='procurar'&&!m.sai.length)).length;
      return o;});
    ok(r.perfilSem&&r.criou&&r.marca===1&&r.preset==='psem'&&r.semTela&&r.depois&&r.gravado&&r.controle&&r.log===1,'pessoa nova em perfil com Posto e sem Procurar fotos não ganha a tela; cadastro antigo sem a marca ganha, com linha no histórico do Admin: '+J(r));
    await ctx.close();}
  // sem o servidor do ponto: aviso, sem erro
  {const {ctx,pg}=await novo(1280,800,false);ok(await entrar(pg,ADMIN),'login do Admin sem servidor');await abrir(pg,'#procurar');
    ok(await pg.evaluate(()=>ETERNA.state.view==='procurar'&&/Sem conexão com o servidor do ponto/.test((document.querySelector('#bf-sem')||{}).textContent||'')),'sem servidor: aviso na tela');await ctx.close();}
  ok(!errs.length,'sem erro de JavaScript: '+errs.slice(0,3).join(' | '));
}catch(err){fails.push('exceção: '+(err&&err.stack||err));}
await b.close();console.log((fails.length?'FALHA':'OK')+' procurar-fotos'+(fails.length?': '+fails.length+' falha(s)\n - '+fails.join('\n - '):''));process.exit(fails.length?1:0);
})();
