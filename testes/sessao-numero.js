// 26/11: número curto da sessão (docs/planos/2026-11-26-numero-da-sessao.md). Cada sessão de hoje tem um número dado pelo
// servidor (x.num em /sessoes). O nome completo é a data e o número (2026-11-26-147); a tela mostra a data pequena, o
// número em destaque e o LP apagado, e a busca aceita o número de hoje ou o nome completo.
// O agente é falso (page.route na própria origem), nos moldes do posto-procurar-sessao.js. Dados e miniaturas simulados
// (uma imagem do repositório), nunca foto de convidado. SN_VER=1 mostra cada conferência com o tempo.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const T0=Date.now();const ok=(c,m)=>{if(!c)fails.push(m);if(process.env.SN_VER)console.error(((Date.now()-T0)/1000).toFixed(1)+' s '+(c?'ok   ':'FALHA ')+m.slice(0,300));};const J=JSON.stringify;
const JPG=fs.readFileSync(path.join(__dirname,'..','img','ativ-snap.jpg'));
const dia=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const hoje=dia(Date.now()),ontem=dia(Date.now()-86400e3);
let seqPid=0;const pids=n=>Array.from({length:n},()=>(0xabd000000000+(++seqPid)).toString(16));
const agora=()=>Date.now()/1000;
function sessao(o){const a=agora();const t=o.t||300;const fotos=o.fotos||pids(o.n==null?4:o.n);return Object.assign({card:o.card,dia:hoje,fotografo:'carlos',fonte:'ftp',ponto:'terminal',trilha:'vivo',atrasada:false,status:'fechada',motivo:'pausa',
  aberta_em:a-t-60,ultima_chegada:a-t,cap0:a-t-65,cap1:a-t-5,fonte_t:'cap',fechada_em:a-t+60,fechada_por:'pausa',fotos,pend:[],dec:{},ia:[],sim_abertura:null,fundida_em:null,removida:false,rev:1},o,{fotos});}
const CAIXA='caixa.teste@exemplo.com';
const feedNovo=gen=>{const F={gen,rev:0,sessoes:[],posts:[],dialogos:[]};F.poe=x=>{x.rev=++F.rev;const i=F.sessoes.findIndex(y=>y.card===x.card);if(i>=0)F.sessoes[i]=x;else F.sessoes.push(x);return x;};return F;};
(async()=>{
const b=await chromium.launch();const errs=[];
async function agente(ctx,F){
  await ctx.route(ORIG+'/**',r=>{const rq=r.request();const u=new URL(rq.url());const p=u.pathname;const j=(o,s)=>r.fulfill({status:s||200,contentType:'application/json',body:J(o)});
    if(/\.(html|js|css|png|jpg|jpeg|webp|svg|json|woff2?|ico|wasm|onnx)$/.test(p))return r.fallback();
    if(p.startsWith('/auth/'))return r.fallback();
    if(p==='/status')return j({ok:true,agent:'eterna-agente',version:3,boot:F.gen,card:null,copied:0,dups:0,events:0,ftp:null,rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:F.rev,gen:F.gen,hoje:F.sessoes.length,abertas:0,visitas:{ligada:true}}});
    if(p==='/sessoes'){const d=+u.searchParams.get('desde')||0;return j({ok:true,gen:F.gen,rev:F.rev,pausa:60,rostos:true,completo:!d,sessoes:F.sessoes.filter(x=>x.rev>d&&u.searchParams.get('ontem')!=='1')});}
    if(p.startsWith('/thumb/')||p.startsWith('/file/'))return r.fulfill({status:200,contentType:'image/jpeg',body:JPG});
    if(p==='/events')return j({events:[],next:0,total:0});
    if(rq.method()!=='GET'){let body=null;try{body=rq.postDataJSON();}catch(e){}F.posts.push({p,body});return j({ok:true,visita:{id:'V1',levas:[]}});}
    return j({erro:'sem_permissao'},403);});}
const novo=async F=>{const ctx=await b.newContext({viewport:{width:1280,height:800},locale:'pt-BR'});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await agente(ctx,F);
  const pg=await ctx.newPage();pg.on('dialog',d=>{F.dialogos.push(d.message());d.accept();});pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text());});return {ctx,pg};};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||12000)){if(await pg.evaluate(fn,arg))return true;await pg.waitForTimeout(200);}return false;};
async function entrar(pg){await pg.goto(U);await pg.waitForTimeout(350);
  await pg.evaluate(c=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1')||'null')||JSON.parse(JSON.stringify(ETERNA.USERS));
    U0[c]={v:2,email:c,name:'Caixa de teste',preset:'venda',key:null,active:true,perms:ETERNA.presetPerms('venda'),menu:ETERNA.presetMenu('venda'),inicio:ETERNA.PRESETS.venda.inicio||'',createdAt:'2026-11-26'};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},CAIXA);
  await pg.reload();await pg.waitForTimeout(350);return entrarTeste(pg,CAIXA);}
const abrir=async(pg,h)=>{await pg.goto('about:blank');await pg.goto(U+h);await pg.waitForTimeout(450);};
const clica=async(pg,sel)=>{if(!await pg.evaluate(sel=>{const x=document.querySelector(sel);if(!x)return false;x.click();return true;},sel))throw new Error('sem o elemento '+sel);};
const cartoes=(pg,lista)=>pg.evaluate(lista=>[...document.querySelectorAll(lista+' .ps-card')].map(c=>({card:c.dataset.card,num:(c.querySelector('.ps-cod .ss-num')||{}).textContent||'',dia:(c.querySelector('.ps-cod .ss-dia')||{}).textContent||'',lp:(c.querySelector('.ps-cod .ss-lp')||{}).textContent||'',cod:(c.querySelector('.ps-cod')||{}).textContent||''})),lista);
const toastTxt=pg=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
const juntar=(pg,a,txt)=>pg.evaluate(([a,txt])=>{const i=document.createElement('input');i.id='vis-lp';i.value=txt;document.body.appendChild(i);const x=document.createElement('button');x.dataset.act='visita-juntar';x.dataset.a=a;x.dataset.lp='1';x.dataset.id='p1';document.body.appendChild(x);x.click();x.remove();i.remove();},[a,txt]);
try{
  // ===== agente novo: sessões com número =====
  const F=feedNovo('n26');
  // a 14 é de 2 h atrás (fora do horário padrão); a 1470 é mais nova que a 147 (sem a regra do "igual primeiro" viria antes)
  const S={c14:F.poe(sessao({card:'LPNUMAAAA',num:14,t:7200})),c140:F.poe(sessao({card:'LPNUMBBBB',num:140,t:900})),c147:F.poe(sessao({card:'LPNUMCCCC',num:147,t:600})),
    c149:F.poe(sessao({card:'LPNUMDDDD',num:149,t:500})),c1470:F.poe(sessao({card:'LPNUMEEEE',num:1470,t:100})),lp7k:F.poe(sessao({card:'LP7K2QA3B',num:23,t:400,fotografo:'samuel'})),
    falso:F.poe(sessao({card:'LPX147XYZ',num:5,t:450})),sem:F.poe(sessao({card:'LPSEMNUM9',t:200}))};
  F.poe(sessao({card:'LPONTEMAA',num:147,dia:ontem,t:90000}));       // ontem com o mesmo número: nunca aparece
  const {ctx,pg}=await novo(F);
  ok(await entrar(pg),'login do perfil Atendimento e venda');
  await abrir(pg,'#posto');
  ok(await espera(pg,()=>ETERNA.psOn()&&ETERNA.psLista().itens.length>=6),'feed do agente falso chegou ao Posto');
  await clica(pg,'.posto-rodape [data-act="posto-manual"]');await pg.waitForTimeout(300);
  ok(await espera(pg,()=>ETERNA.psLista().itens.every(x=>ETERNA.psEstado?true:true)&&!!document.querySelector('#ps-lista .ps-card')),'lista do Procurar sessão aberta');
  // 1: cartão com o número em destaque e o LP pequeno
  let cs=await cartoes(pg,'#ps-lista');const k147=cs.find(c=>c.card==='LPNUMCCCC'),ksem=cs.find(c=>c.card==='LPSEMNUM9');
  ok(k147&&k147.num==='147'&&k147.lp==='LPNUMCCCC'&&k147.dia===hoje+'-'&&k147.cod===hoje+'-147LPNUMCCCC','1: cartão com a data pequena, o número em destaque e o LP: '+J(k147));
  ok(ksem&&!ksem.num&&ksem.cod==='LPSEMNUM9','1: sessão sem número mostra só o LP: '+J(ksem));
  {const m=await pg.evaluate(()=>{const q=s=>parseFloat(getComputedStyle(document.querySelector('#ps-lista .ps-card[data-card="LPNUMCCCC"] '+s)).fontSize);return {n:q('.ss-num'),l:q('.ss-lp'),d:q('.ss-dia')};});
    ok(m.n>=18&&m.l<m.n*0.7&&m.d<m.n*0.7&&m.l>=11&&m.d>=11,'1: o número é maior que a data e o LP, e os pequenos têm ao menos 11 px: '+J(m));}
  {const m=await pg.evaluate(()=>{const c=document.querySelector('#ps-lista .ps-card[data-card="LPNUMCCCC"] .ps-cod');const w=c.querySelector('.ss-cod'),dn=c.querySelector('.ss-dn');return {flex:getComputedStyle(w).display,nw:getComputedStyle(dn).whiteSpace,dentro:dn.contains(c.querySelector('.ss-dia'))&&dn.contains(c.querySelector('.ss-num'))&&!dn.contains(c.querySelector('.ss-lp'))};});
    ok(m.flex==='inline-flex'&&m.nw==='nowrap'&&m.dentro,'1: data e número juntos, sem quebra no hífen: '+J(m));}
  ok(!cs.some(c=>c.card==='LPONTEMAA')&&!cs.some(c=>c.card==='LPNUMAAAA'),'1: a de ontem não aparece; a de 2 h atrás fica fora do horário padrão');
  {const c=await pg.evaluate(()=>{const i=document.querySelector('#ck-code');return {ph:i.placeholder,aria:i.getAttribute('aria-label')};});ok(c.ph==='Nº ou LP'&&c.aria==='Número ou código da sessão','campo com "Nº ou LP": '+J(c));}
  // 2: busca por número (começo do número, o igual primeiro, sem filtro de horário) e por pedaço do LP
  await pg.fill('#ck-code','147');await pg.waitForTimeout(350);cs=await cartoes(pg,'#ps-lista');
  ok(cs.map(c=>c.card).join()==='LPNUMCCCC,LPNUMEEEE','2: "147" traz a 147 no topo e a 1470; LP com 147 no meio fica fora: '+cs.map(c=>c.card+'='+c.num).join());
  await pg.fill('#ck-code','14');await pg.waitForTimeout(350);cs=await cartoes(pg,'#ps-lista');
  ok(cs[0]&&cs[0].card==='LPNUMAAAA'&&cs.map(c=>c.num).sort().join()==='14,140,147,1470,149','2: "14" mostra 14 (primeiro, mesmo fora do horário), 140 a 149 e 1470: '+cs.map(c=>c.num).join());
  await pg.fill('#ck-code','LP7K');await pg.waitForTimeout(350);cs=await cartoes(pg,'#ps-lista');
  ok(cs.length===1&&cs[0].card==='LP7K2QA3B'&&cs[0].num==='23','2: "LP7K" segue achando pelo código: '+J(cs));
  await pg.fill('#ck-code','x147');await pg.waitForTimeout(350);cs=await cartoes(pg,'#ps-lista');
  ok(cs.length===1&&cs[0].card==='LPX147XYZ','2: com letra, pedaço do LP como sempre: '+J(cs));
  // nome completo (data + número), com e sem traços: só aquele número; de outro dia, lista vazia
  for(const q of [hoje+'-147',hoje.replace(/-/g,'')+'147']){await pg.fill('#ck-code',q);await pg.waitForTimeout(350);cs=await cartoes(pg,'#ps-lista');
    ok(cs.length===1&&cs[0].card==='LPNUMCCCC','2: "'+q+'" acha só a 147: '+cs.map(c=>c.card).join());}
  await pg.fill('#ck-code',ontem+'-147');await pg.waitForTimeout(350);
  ok(await pg.evaluate(()=>!document.querySelector('#ps-lista .ps-card')),'2: nome completo de ontem não acha nada na lista de hoje');
  await pg.fill('#ck-code','999');await pg.waitForTimeout(350);
  ok(await pg.evaluate(()=>!document.querySelector('#ps-lista .ps-card')&&/Nenhuma sessão com esse número ou código\./.test(document.querySelector('#ps-lista').textContent)),'2: número que não existe não acha nada e o aviso fala em número');
  await pg.fill('#ck-code','');await pg.waitForTimeout(300);
  // 3: sessão de ontem com o mesmo número: fora da lista e da busca; onde aparecer, leva a data (nunca o número solto)
  {const r=await pg.evaluate(o=>({n:ETERNA.sessNum('LPONTEMAA'),id:ETERNA.sessId('LPONTEMAA'),rot:ETERNA.sessRot('LPONTEMAA'),html:ETERNA.sessCodHtml('LPONTEMAA'),de:ETERNA.sessDeNumero('147'),deO:ETERNA.sessDeNumero(o+'-147'),
      b:ETERNA.sessBusca({card:'LPONTEMAA'},'147'),bO:ETERNA.sessBusca({card:'LPONTEMAA'},o+'-147'),lista:ETERNA.psLista().itens.some(x=>x.card==='LPONTEMAA'),te:ETERNA.TE('sessao_x',ETERNA.sessRot('LPONTEMAA'))}),ontem);
    ok(r.n===null&&r.id===ontem+'-147'&&r.rot===ontem+'-147'&&r.html==='<span class="ss-cod"><span class="ss-dn"><span class="ss-dia">'+ontem+'-</span><span class="ss-num">147</span></span><span class="ss-lp">LPONTEMAA</span></span>'&&r.de==='LPNUMCCCC'&&r.deO===null&&r.b===false&&r.bO===false&&!r.lista&&r.te==='Sessão '+ontem+'-147',
      '3: sessão de ontem com num 147 mostra a data e o número, fora da busca de hoje: '+J(r));}
  {const r=await pg.evaluate(()=>({n:ETERNA.sessNum('LPNUMCCCC'),rot:ETERNA.sessRot('LPNUMCCCC'),nada:ETERNA.sessNum('LPNAOEXISTE'),rotNada:ETERNA.sessRot('LPNAOEXISTE'),id:ETERNA.sessId('LPNUMCCCC'),deId:ETERNA.sessDeNumero(ETERNA.sessId('LPNUMCCCC')),deIdS:ETERNA.sessDeNumero(ETERNA.sessId('LPNUMCCCC').replace(/-/g,'')),q:[ETERNA.sessQ('147'),ETERNA.sessQ('LP7K'),ETERNA.sessQ('123456'),ETERNA.sessQ('')],de0:ETERNA.sessDeNumero('0147'),deL:ETERNA.sessDeNumero('LP7K'),de9:ETERNA.sessDeNumero('999'),
      xss:ETERNA.sessCodHtml('<img src=x onerror=1>'),proto:[ETERNA.sessNum('toString'),ETERNA.sessId('__proto__'),ETERNA.sessRot('constructor'),ETERNA.sessCodHtml('toString'),Object.getPrototypeOf(ETERNA.SRV.num)],ls:Object.keys(localStorage).filter(k=>/num/i.test(k))}));
    ok(r.id===hoje+'-147'&&r.deId==='LPNUMCCCC'&&r.deIdS==='LPNUMCCCC'&&J(r.q)===J([{n:147,exato:false,hoje:true},null,null,null])&&r.n===147&&r.rot==='147'&&r.nada===null&&r.rotNada==='LPNAOEXISTE'&&r.de0==='LPNUMCCCC'&&r.deL===null&&r.de9===null&&!/<img/.test(r.xss)&&J(r.proto)===J([null,null,'constructor','toString',null])&&!r.ls.length,'auxiliares sessNum, sessRot e sessDeNumero: '+J(r));}
  // número que chega depois (rev novo): o cartão redesenha sozinho
  F.poe(Object.assign({},S.sem,{num:200}));
  ok(await espera(pg,()=>((document.querySelector('#ps-lista .ps-card[data-card="LPSEMNUM9"] .ss-num')||{}).textContent)==='200'),'o número que chega do servidor aparece no cartão sem recarregar');
  // 4: cabeçalho da venda no Posto
  ok(await espera(pg,()=>!!document.querySelector('#ps-lista button.ps-card[data-card="LPNUMCCCC"]'),30000),'a 147 fica tocável');
  await clica(pg,'#ps-lista button.ps-card[data-card="LPNUMCCCC"]');await pg.waitForTimeout(300);
  {const h=await pg.evaluate(()=>{const c=document.querySelector('.posto-manual-cod');return c?{n:(c.querySelector('.ss-num')||{}).textContent,d:(c.querySelector('.ss-dia')||{}).textContent,l:(c.querySelector('.ss-lp')||{}).textContent,step:ETERNA.state.checkout.step,sess:ETERNA.state.checkout.session}:null;});
    ok(h&&h.n==='147'&&h.d===hoje+'-'&&h.l==='LPNUMCCCC'&&h.step===2,'4: cabeçalho da venda com a data, o 147 e o LP: '+J(h));}
  // 5: "Sessão 147" (pedido, Minhas vendas) e o recibo do cliente segue com o código de sempre
  {const r=await pg.evaluate(()=>{const o={};['pt','en','es','fr','de'].forEach((l,i)=>{o[l]=ETERNA.EQ.sessao_x[i](ETERNA.sessRot('LPNUMCCCC'));});o.lp=ETERNA.TE('sessao_x',ETERNA.sessRot('LPVELHA99'));return o;});
    ok(r.pt==='Sessão 147'&&r.en==='Session 147'&&r.es==='Sesión 147'&&r.fr==='Session 147'&&r.de==='Sitzung 147'&&r.lp==='Sessão LPVELHA99','5: "Sessão 147" nas 5 línguas; sem número, o LP: '+J(r));}
  await pg.evaluate(()=>{ETERNA.state.checkout.session=null;ETERNA.state.checkout.step=1;ETERNA.render();});await pg.waitForTimeout(200);
  // 6: Juntar leva pelo número (troca pelo card antes do POST); número que não existe não envia nada
  F.posts.length=0;await juntar(pg,'LPNUMBBBB','147');
  await pg.waitForTimeout(500);
  {const p=F.posts.filter(x=>x.p==='/visitas/juntar');ok(p.length===1&&p[0].body&&p[0].body.a==='LPNUMBBBB'&&p[0].body.b==='LPNUMCCCC','6: Juntar por número envia o card LP: '+J(p));
    const dl=F.dialogos[F.dialogos.length-1]||'';ok(dl.includes(hoje+'-147')&&dl.includes('LPNUMCCCC')&&dl.includes('Carlos')&&/\d\d:\d\d/.test(dl)&&/4 fotos/.test(dl),'6: a confirmação diz qual sessão foi achada (nome, LP, fotógrafo, hora): '+J(dl));}
  // sessão de hoje sem foto não é achada pelo número
  F.poe(sessao({card:'LPNUMVAZI',num:300,n:0,t:50}));ok(await espera(pg,()=>!!ETERNA.SRV.sess.LPNUMVAZI),'sessão sem foto chegou');
  F.posts.length=0;await juntar(pg,'LPNUMBBBB','300');await pg.waitForTimeout(400);
  ok(!F.posts.some(x=>x.p.startsWith('/visitas/'))&&await pg.evaluate(()=>ETERNA.sessDeNumero('300')===null),'6: número de sessão sem foto não junta: '+J(F.posts));
  F.posts.length=0;await juntar(pg,'LPNUMBBBB',hoje+'-149');await pg.waitForTimeout(500);
  {const p=F.posts.filter(x=>x.p==='/visitas/juntar');ok(p.length===1&&p[0].body.b==='LPNUMDDDD','6: Juntar pelo nome completo de hoje envia o card LP: '+J(p));}
  F.posts.length=0;await juntar(pg,'LPNUMBBBB',ontem+'-147');await pg.waitForTimeout(400);
  ok(!F.posts.some(x=>x.p.startsWith('/visitas/')),'6: nome completo de ontem não envia nada: '+J(F.posts));
  F.posts.length=0;await juntar(pg,'LPNUMBBBB','999');await pg.waitForTimeout(400);
  ok(!F.posts.some(x=>x.p.startsWith('/visitas/'))&&await toastTxt(pg)==='Digite o número ou o código LP da leva','6: número sem sessão avisa e não envia: '+await toastTxt(pg)+' '+J(F.posts));
  F.posts.length=0;await juntar(pg,'LPNUMBBBB','lp7k2qa3b');await pg.waitForTimeout(500);
  {const p=F.posts.filter(x=>x.p==='/visitas/juntar');ok(p.length===1&&p[0].body.b==='LP7K2QA3B'&&F.dialogos[F.dialogos.length-1]==='Esta leva é desta família?','6: o código LP digitado segue valendo, com a pergunta de sempre: '+J(p));}
  // Sessões esperando do Checkout: o número segue em destaque dentro do .lj-wait (fundo escuro e caixa clara da equipe)
  {const m=await pg.evaluate(()=>{const med=cls=>{const d=document.createElement('div');d.className=cls;d.innerHTML='<div class="lj-wait"><button><b>'+ETERNA.sessCodHtml('LPNUMCCCC')+'</b><span>Carlos · 10:00</span></button></div>';document.body.appendChild(d);
      const f=s=>parseFloat(getComputedStyle(d.querySelector(s)).fontSize);const o={n:f('.ss-num'),d:f('.ss-dia'),l:f('.ss-lp'),s:f('button>span'),cn:getComputedStyle(d.querySelector('.ss-num')).color,cb:getComputedStyle(d.querySelector('button')).color};d.remove();return o;};return [med(''),med('lj-eqbox')];});
    ok(m.every(x=>x.n>=20&&x.n>x.s&&x.d>=11&&x.l>=11&&x.d<x.n&&x.l<x.n&&x.cn===x.cb),'Sessões esperando: número grande, data e LP pequenos, na cor do botão: '+J(m));}
  // 7: Checkout do cliente não aceita número
  {const r=await pg.evaluate(()=>{sessionStorage.removeItem('eterna.ljcod');const a=ETERNA.lojaCodigo('147');const t=(document.querySelector('#toast')||{}).textContent;const c=[ETERNA.sessId('LPNUMCCCC'),ETERNA.sessId('LPNUMCCCC').replace(/-/g,'')].map(x=>ETERNA.lojaCodigo(x));const b=ETERNA.lojaCodigo('LPNUMCCCC');sessionStorage.removeItem('eterna.ljcod');return {a,t,c,b:b&&b.card};});
    ok(r.a===null&&r.c.every(x=>x===null)&&r.b==='LPNUMCCCC','7: o Checkout do cliente recusa "147" e o nome com data, e aceita o LP: '+J(r));}
  // 8: Procurar fotos
  await abrir(pg,'#procurar');
  ok(await espera(pg,()=>!!document.querySelector('#bf-lista .bf-card')),'Procurar fotos abriu com sessões');
  {const c=await pg.evaluate(()=>{const i=document.querySelector('#bf-cod');return {ph:i.placeholder,rot:i.closest('label').querySelector('.eyebrow').textContent,eq:ETERNA.EQ.bf_cod.join('|')===ETERNA.EQ.vm_cod_aria.join('|')};});
    ok(c.ph==='Nº ou LP'&&c.rot==='Número ou código da sessão'&&c.eq,'8: campo do Procurar fotos com o mesmo texto e placeholder do Posto: '+J(c));}
  await clica(pg,'[data-act="bf-hora"][data-h="dia"]');await pg.waitForTimeout(250);cs=await cartoes(pg,'#bf-lista');
  {const k=cs.find(c=>c.card==='LPNUMCCCC');ok(k&&k.num==='147'&&k.lp==='LPNUMCCCC','8: cartão do Procurar fotos com número e LP: '+J(k));}
  await clica(pg,'[data-act="bf-hora"][data-h="m30"]');await pg.focus('#bf-cod');await pg.keyboard.type('147');await pg.waitForTimeout(350);cs=await cartoes(pg,'#bf-lista');
  ok(cs.map(c=>c.card).join()==='LPNUMCCCC,LPNUMEEEE','8: "147" no Procurar fotos, com a igual no topo: '+cs.map(c=>c.card).join());
  await pg.fill('#bf-cod','14');await pg.waitForTimeout(350);cs=await cartoes(pg,'#bf-lista');
  ok(cs[0]&&cs[0].card==='LPNUMAAAA'&&cs.length===5,'8: "14" acha a 14 de 2 h atrás, com o horário em 30 min: '+cs.map(c=>c.num).join());
  await pg.fill('#bf-cod',hoje+'-147');await pg.waitForTimeout(350);cs=await cartoes(pg,'#bf-lista');
  ok(cs.length===1&&cs[0].card==='LPNUMCCCC'&&cs[0].dia===hoje+'-','8: nome completo no Procurar fotos: '+J(cs));
  await pg.fill('#bf-cod','lp7k');await pg.waitForTimeout(350);cs=await cartoes(pg,'#bf-lista');
  ok(cs.length===1&&cs[0].card==='LP7K2QA3B','8: "lp7k" no Procurar fotos: '+J(cs));
  await pg.fill('#bf-cod','147');await pg.waitForTimeout(350);await clica(pg,'#bf-lista [data-act="bf-abrir"][data-card="LPNUMCCCC"]');await pg.waitForTimeout(300);
  {const h=await pg.evaluate(()=>{const c=document.querySelector('#bf.bf-sess .up-lp');return c?{n:(c.querySelector('.ss-num')||{}).textContent,l:(c.querySelector('.ss-lp')||{}).textContent}:null;});
    ok(h&&h.n==='147'&&h.l==='LPNUMCCCC','8: sessão aberta no Procurar fotos com número e LP: '+J(h));}
  // 9: Minhas fotos (bloco da sessão)
  {const r=await pg.evaluate(()=>{const d=document.createElement('div');d.innerHTML=ETERNA.upSessBloco(ETERNA.SRV.sess.LPNUMCCCC);const c=d.querySelector('.up-lp');const e=document.createElement('div');e.innerHTML=ETERNA.upSessBloco(Object.assign({},ETERNA.SRV.sess.LPNUMCCCC,{card:'LPFORADAQ'}));
      return {n:(c.querySelector('.ss-num')||{}).textContent,l:(c.querySelector('.ss-lp')||{}).textContent,fora:e.querySelector('.up-lp').textContent,foraNum:!!e.querySelector('.ss-num')};});
    ok(r.n==='147'&&r.l==='LPNUMCCCC'&&r.fora==='LPFORADAQ'&&!r.foraNum,'9: Minhas fotos com número e LP; sessão fora do feed só o LP: '+J(r));}
  // 10: textos nas 5 línguas
  {const r=await pg.evaluate(()=>{const ruim=[];const ks=['vm_cod_aria','ss_ph','ss_juntar_erro','po_codigo_lp','bf_cod','vm_nenhuma_sess','ss_juntar_conf'];for(const k of ks){const e=ETERNA.EQ[k];if(!Array.isArray(e)||e.length<5){ruim.push(k+': menos de 5');continue;}
      e.slice(0,5).forEach((v,i)=>{if(typeof v==='function')v=v('2026-11-26-147','LPX','Carlos','10:00',4);if(typeof v!=='string'||!v.trim()||/[–—]/.test(v))ruim.push(k+'['+i+']: '+v);});}
      return {ruim,pt:ks.slice(0,4).map(k=>(ETERNA.EQ[k]||[])[0])};});
    ok(!r.ruim.length&&J(r.pt)===J(['Número ou código da sessão','Nº ou LP','Digite o número ou o código LP da leva','Número ou código LP']),'10: textos nas 5 línguas: '+J(r));}
  await ctx.close();
  // ===== agente antigo: nenhuma sessão com num, tudo como antes =====
  const G=feedNovo('v25');
  G.poe(sessao({card:'LPANT0147',t:300}));G.poe(sessao({card:'LPANT0200',t:200}));G.poe(sessao({card:'LPANTVELH',t:7200}));
  const {ctx:ctx2,pg:pg2}=await novo(G);
  ok(await entrar(pg2),'agente antigo: login');
  await abrir(pg2,'#posto');
  ok(await espera(pg2,()=>ETERNA.psOn()&&ETERNA.psLista().itens.length>=2),'agente antigo: feed chegou');
  await clica(pg2,'.posto-rodape [data-act="posto-manual"]');await pg2.waitForTimeout(300);cs=await cartoes(pg2,'#ps-lista');
  ok(cs.length===2&&cs.every(c=>!c.num&&!c.lp&&c.cod===c.card)&&await pg2.evaluate(()=>!document.querySelector('.ss-num,.ss-lp')),'agente antigo: cartões só com o LP, como antes: '+J(cs));
  await pg2.fill('#ck-code','0147');await pg2.waitForTimeout(350);cs=await cartoes(pg2,'#ps-lista');
  ok(cs.length===1&&cs[0].card==='LPANT0147','agente antigo: dígitos caem no pedaço do LP: '+J(cs));
  await pg2.fill('#ck-code','velh');await pg2.waitForTimeout(350);cs=await cartoes(pg2,'#ps-lista');
  ok(cs.length===1&&cs[0].card==='LPANTVELH','agente antigo: letra acha fora do horário: '+J(cs));
  {const r=await pg2.evaluate(()=>({n:ETERNA.sessNum('LPANT0147'),rot:ETERNA.sessRot('LPANT0147'),de:ETERNA.sessDeNumero('147'),te:ETERNA.TE('sessao_x',ETERNA.sessRot('LPANT0147'))}));
    ok(r.n===null&&r.rot==='LPANT0147'&&r.de===null&&r.te==='Sessão LPANT0147'&&await pg2.evaluate(h=>ETERNA.sessDeNumero(h+'-147')===null&&ETERNA.sessId('LPANT0147')===null,hoje),'agente antigo: sem número em lugar nenhum: '+J(r));}
  G.posts.length=0;await juntar(pg2,'LPANT0200','147');await pg2.waitForTimeout(400);
  ok(!G.posts.some(x=>x.p.startsWith('/visitas/')),'agente antigo: Juntar por número não envia nada: '+J(G.posts));
  await ctx2.close();
  ok(!errs.length,'sem erro de página: '+errs.slice(0,3).join(' | '));
}catch(e){fails.push('exceção: '+(e&&e.stack||e).toString().slice(0,400));}
await b.close();
const f=fails.filter(Boolean);
console.log(f.length?'FALHA sessao-numero: '+f.slice(0,6).join(' | '):'OK sessao-numero: data e número em destaque, busca por número e pelo nome completo, Juntar leva, Checkout do cliente e agente antigo');
process.exit(f.length?1:0);
})();
