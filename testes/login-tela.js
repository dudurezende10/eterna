// Tela de entrada e botões de Senhas de acesso. As rotas /auth/* respondem no navegador (_entrar.js); a regra de verdade está em login_agente.py.
const entrarTeste=require('./_entrar');
const fecharUsuario=p=>p.evaluate(()=>{if(ETERNA.state.users.draft){ETERNA.state.users.draft=null;ETERNA.render();}}); // o cadastro aberto esconde a lista
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const servidorRotas=pg=>pg.route('**/auth/esqueci',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
// Troca de pessoa no mesmo navegador (revisão 24/11): resposta 401 atrasada da pessoa anterior não encerra a sessão de quem entrou
// depois; no Sair, a fila do Treino só sobe a foto que o Sair espera; 403 so_ver/origem deixa a marcação na fila; /auth/sair sem
// resposta deixa a marca eterna.auth.sair e é repetido antes do próximo Entrar e ao abrir. Servidor falso com um "cookie" só.
async function trocaDePessoa(b){const J=JSON.stringify;
  const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const U0=new URL(U).origin;const js=(r,x,st)=>r.fulfill({status:st||200,contentType:'application/json',body:J(x)});
  const S={cookie:null,sair:[],entrar:[],rot:[],ord:[],sairFalha:false,sairSt:null,rotSt:null,amostraMs:1500};
  await ctx.route(U0+'/status',r=>js(r,{ok:true,agent:'eterna-agente',version:3,boot:'bT',rostos:{ligado:true},sessoes:{v:2,pausa:60,rostos:true,rev:1,gen:'gT',hoje:0,abertas:0},treino:{v:1,rotulos:0,analise:{ponto:'desligada',exposicao:'desligada'},modelo_ponto:null,ajuste:null}}));
  for(const p of ['/events*','/biblioteca','/sessoes*','/fila-fotografo','/ponto/docs/revs','/ponto/docs?*','/ponto/docs','/treino/dias','/postos/eu'])
    await ctx.route(U0+p,r=>js(r,{ok:true,events:[],fotos:[],sessoes:[],grupos:[],revs:{},docs:[],dias:[]}));
  // a sessão que vale é a do "cookie" na chegada do pedido; o servidor responde devagar
  await ctx.route(U0+'/treino/rotulo',async r=>{const quem=S.cookie,pid=r.request().postDataJSON().pid;S.rot.push({pid,quem});S.ord.push('rotulo:'+pid);await new Promise(ok=>setTimeout(ok,700));
    if(S.rotSt)return js(r,S.rotSt[1],S.rotSt[0]);if(!quem)return js(r,{erro:'sem_sessao'},401);js(r,{ok:true,doc:{v:1,pid,em:'x'}});});
  await ctx.route(U0+'/treino/amostra?*',async r=>{const quem=S.cookie;await new Promise(ok=>setTimeout(ok,S.amostraMs));if(!quem)return js(r,{erro:'sem_sessao'},401);js(r,{v:1,itens:[]});});
  const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/auth/*',async r=>{const p=new URL(r.request().url()).pathname;let c={};try{c=r.request().postDataJSON()||{}}catch(e){}
    if(p==='/auth/sair'){S.ord.push('sair');if(S.sairFalha)return r.abort();if(S.sairSt)return js(r,{erro:'servidor'},S.sairSt);S.sair.push(S.cookie);S.cookie=null;return js(r,{ok:true});}
    if(p==='/auth/entrar'){S.ord.push('entrar');S.cookie=String(c.usuario).toLowerCase();S.entrar.push(S.cookie);return js(r,{ok:true,usuario:S.cookie});}
    if(p==='/auth/eu')return S.cookie?js(r,{ok:true,usuario:S.cookie}):js(r,{erro:'sem_sessao'},401);
    return js(r,{ok:true});});
  const A='a.teste@exemplo.com',B='b.teste@exemplo.com';
  const espera=async(fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||8000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(80);}return false;};
  const entrar=async e=>{await pg.fill('[data-act="login-usuario"]',e);await pg.fill('[data-act="login-senha"]','x');await pg.click('button[type=submit]');await espera(e=>ETERNA.state.user&&ETERNA.state.user.email===e,6000,e);};
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(300);
  await pg.evaluate(([a,b])=>{const U0=JSON.parse(JSON.stringify(ETERNA.USERS));const base=Object.values(U0).find(u=>u&&u.preset==='admin');
    U0[a]={...base,email:a,name:'A',key:null};U0[b]={...base,email:b,name:'B',key:null};localStorage.setItem('eterna.users.v1',JSON.stringify(U0));},[A,B]);
  await pg.reload();await pg.waitForTimeout(300);
  // 1. 401 atrasado de A chega depois que B entrou
  await entrar(A);await espera(()=>ETERNA.state.agent.on);
  await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,6000);
  await pg.evaluate(o=>{ETERNA.agFetch(o+'/treino/amostra?dia=2026-11-15&modo=misto&n=150');},U0);await pg.waitForTimeout(50);
  await entrar(B);await pg.waitForTimeout(2500);
  ok(await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email)===B&&S.cookie===B,'1: 401 atrasado de A encerrou a sessão de B: '+J({tela:await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email),cookie:S.cookie}));
  ok(J(S.sair)===J([A]),'1: o /auth/sair saiu só uma vez, com a sessão de A: '+J(S.sair));
  // 1b. o dono da resposta é a sessão, não o e-mail: 401 atrasado da sessão anterior de B (pedido feito com B na tela) não derruba
  // a sessão nova do próprio B
  S.amostraMs=4000;S.cookie=null;await pg.evaluate(o=>{ETERNA.agFetch(o+'/treino/amostra?dia=2026-11-15&modo=misto&n=150');},U0);await pg.waitForTimeout(100);S.cookie=B;
  await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,6000);
  await entrar(B);await pg.waitForTimeout(4500);S.amostraMs=1500;
  ok(await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email)===B&&S.cookie===B,'1b: 401 atrasado da sessão anterior de B encerrou a sessão nova de B: '+J({tela:await pg.evaluate(()=>ETERNA.state.user&&ETERNA.state.user.email),cookie:S.cookie}));
  // 2. no Sair de B, a fila do Treino sobe a que estava subindo e a foto que o Sair espera; as outras ficam para B
  const P=['abc000000101','abc000000102','abc000000103','abc000000104'];
  await pg.evaluate(([b,P])=>{const t=Date.now();localStorage.setItem(ETERNA.TR_FILA,JSON.stringify(P.slice(0,3).map((pid,i)=>({pid,u:b,t:t+i,corpo:{pid,v:1,ponto:'gramado',ia:{serve:null,motivos:[],frente:null},qual:{nivel:null,motivos:[],ajuste:[]},duvida:false,obs:'',base_em:null}}))));
    ETERNA.trEnviar();},[B,P]);
  await espera(()=>ETERNA.trEnviar.on);S.ord.length=0;
  await pg.evaluate(p=>{const t=ETERNA.state.train;t.rasc[p]={ponto:'arquibancada',nivel:null,motivos:[],duvida:false,obs:'',base:null};t.vendo=p;ETERNA.logout();},P[3]);
  await espera(()=>!ETERNA.logout.sair,8000);
  const fila=await pg.evaluate(()=>ETERNA.trFila().map(x=>x.pid));
  ok(J(S.ord)===J(['rotulo:'+P[3],'sair']),'2: durante o Sair só sobe a foto esperada, antes do /auth/sair: '+J(S.ord));
  ok(J(fila.sort())===J([P[1],P[2]]),'2: as outras ficam na fila: '+J(fila));
  ok(S.rot.filter(x=>x.pid===P[3]).every(x=>x.quem===B),'2: a foto esperada subiu com a sessão de B');
  // 3. 403 so_ver e origem (também no formato antigo {error:'origem'}): a marcação fica na fila (como no 401); outro 403 tira
  await entrar(B);await espera(()=>ETERNA.state.agent.on);await pg.waitForTimeout(2200); // a fila de B sobe ao entrar
  for(const [st,j,fica] of [[403,{erro:'so_ver'},true],[403,{erro:'origem'},true],[403,{ok:false,error:'origem'},true],[403,{erro:'sem_permissao'},false]]){S.rotSt=[st,j];
    await pg.evaluate(([b,pid])=>{localStorage.setItem(ETERNA.TR_FILA,JSON.stringify([{pid,u:b,t:Date.now(),corpo:{pid,v:1,ponto:'gramado',ia:{serve:null,motivos:[],frente:null},qual:{nivel:null,motivos:[],ajuste:[]},duvida:false,obs:'',base_em:null}}]));clearTimeout(ETERNA.trEnviar.tm);ETERNA.trEnviar.tm=null;ETERNA.trEnviar();},[B,P[0]]);
    await pg.waitForTimeout(200);await espera(()=>!ETERNA.trEnviar.on,4000);
    const n=await pg.evaluate(()=>ETERNA.trFila().length);ok((n===1)===fica,'3: 403 '+(j.erro||j.error)+(fica?' deveria deixar':' deveria tirar')+' a marcação na fila: '+n);}
  S.rotSt=null;await pg.evaluate(()=>{clearTimeout(ETERNA.trEnviar.tm);ETERNA.trEnviar.tm=null;localStorage.setItem(ETERNA.TR_FILA,'[]');});
  // 4. /auth/sair sem resposta: a marca fica; antes do próximo Entrar o Sair é repetido (sem travar a entrada)
  S.sairFalha=true;S.ord.length=0;await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,8000);
  ok(await pg.evaluate(()=>!!localStorage.getItem('eterna.auth.sair')),'4: Sair sem resposta grava a marca');
  await entrar(A);
  ok(J(S.ord)===J(['sair','sair','entrar'])&&await pg.evaluate(a=>ETERNA.state.user&&ETERNA.state.user.email===a,A),'4: Sair repetido antes do Entrar, que segue mesmo sem resposta: '+J(S.ord));
  ok(await pg.evaluate(()=>!localStorage.getItem('eterna.auth.sair')),'4: entrar apaga a marca (o servidor encerra a sessão anterior)');
  // 5. de novo sem resposta; ao abrir a página (com o servidor respondendo) o Sair é repetido e a marca sai
  await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,8000);
  ok(await pg.evaluate(()=>!!localStorage.getItem('eterna.auth.sair')),'5: a marca volta');
  S.sairFalha=false;S.ord.length=0;S.cookie=A;await pg.reload();await espera(()=>!localStorage.getItem('eterna.auth.sair'),6000);
  ok(J(S.ord)===J(['sair'])&&S.cookie===null&&await pg.evaluate(()=>!localStorage.getItem('eterna.auth.sair')),'5: ao abrir, o Sair pendente é repetido e a marca sai: '+J(S.ord)+' '+S.cookie);
  // 6. só 200 ou 401 do /auth/sair limpam a marca; com 403 ou 5xx ela fica (no Sair e na repetição ao abrir)
  await entrar(A);
  for(const st of [403,503]){S.sairSt=st;await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,8000);
    ok(await pg.evaluate(()=>!!localStorage.getItem('eterna.auth.sair')),'6: /auth/sair com '+st+' deveria deixar a marca');
    S.ord.length=0;await pg.reload();{const t0=Date.now();while(!S.ord.length&&Date.now()-t0<6000)await pg.waitForTimeout(80);}await pg.waitForTimeout(400);
    ok(J(S.ord)===J(['sair'])&&await pg.evaluate(()=>!!localStorage.getItem('eterna.auth.sair')),'6: repetição ao abrir com '+st+' deveria deixar a marca: '+J(S.ord));
    S.sairSt=null;await pg.evaluate(()=>localStorage.removeItem('eterna.auth.sair'));await entrar(A);}
  S.sairSt=null;S.ord.length=0;await pg.evaluate(()=>ETERNA.logout());await espera(()=>!ETERNA.logout.sair,8000);
  ok(await pg.evaluate(()=>!localStorage.getItem('eterna.auth.sair'))&&S.cookie===null,'6: /auth/sair com 200 limpa a marca');
  await ctx.close();}
(async()=>{const b=await chromium.launch();
try{
  const pg=await b.newPage({viewport:{width:1280,height:900}});pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(500);
  const txt=await pg.textContent('#main');
  ok(!/código/i.test(txt)&&!await pg.$('.otp'),'a tela não fala mais em código nem mostra caixa simulada');
  ok(await pg.$('[data-act="login-senha"][type="password"]'),'campo de senha mascarado');
  // um redesenho no meio da digitação (o agente redesenha a tela) não apaga a senha nem tira o foco
  await pg.fill('[data-act="login-usuario"]','eduardo@eduardorezende.com');await pg.click('[data-act="login-senha"]');await pg.keyboard.type('abc');
  await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(50);await pg.keyboard.type('def');
  ok(await pg.inputValue('[data-act="login-senha"]')==='abcdef','redesenho apagou a senha: '+await pg.inputValue('[data-act="login-senha"]'));
  // campo de senha igual ao de usuário, e o olho mostra e oculta sem perder o que foi digitado nem o foco
  const est=q=>pg.$eval(q,e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return [c.borderTopWidth,c.borderTopColor,c.borderRadius,Math.round(r.height),Math.round(r.width)].join()});
  ok(await est('[data-act="login-senha"]')===await est('[data-act="login-usuario"]'),'campo de senha com aparência diferente da de usuário');
  await pg.click('[data-act="login-ver"]');ok(await pg.getAttribute('[data-act="login-senha"]','type')==='text','o olho mostra a senha');
  ok(await pg.getAttribute('[data-act="login-ver"]','aria-pressed')==='true','o olho indica que a senha está à mostra');
  await pg.keyboard.type('g');ok(await pg.inputValue('[data-act="login-senha"]')==='abcdefg','o olho apagou a senha ou tirou o foco');
  await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(50);ok(await pg.getAttribute('[data-act="login-senha"]','type')==='text','redesenho voltou a ocultar a senha');
  await pg.click('[data-act="login-ver"]');ok(await pg.getAttribute('[data-act="login-senha"]','type')==='password','o olho oculta a senha');
  ok(!await pg.$('[data-act="login-trocar"]'),'a tela de entrada não oferece trocar senha');
  // esqueci a senha: a resposta é a mesma para qualquer usuário, e voltar mantém o usuário digitado
  await pg.click('[data-act="login-esqueci"]');await pg.waitForTimeout(100);ok(!await pg.$('[data-act="login-senha"]'),'esqueci a senha não pede senha');
  await servidorRotas(pg);await pg.click('button[type=submit]');await pg.waitForTimeout(200);ok(/chega em alguns minutos/.test(await pg.textContent('#main')),'esqueci a senha confirma o pedido');
  await pg.click('[data-act="login-voltar"]');await pg.waitForTimeout(100);ok(await pg.inputValue('[data-act="login-usuario"]')==='eduardo@eduardorezende.com','voltar perdeu o usuário');await pg.fill('[data-act="login-senha"]','abc');
  // senha provisória: o servidor pede a troca e a tela já abre em Crie sua senha, com as regras antes de ir ao servidor
  await pg.route('**/auth/entrar',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":false,"troca":true}'}));
  await pg.click('button[type=submit]');await pg.waitForTimeout(200);ok(/Crie sua senha/.test(await pg.textContent('#main')),'a senha provisória leva a Crie sua senha');
  await pg.fill('[data-act="login-nova"]','curta');await pg.fill('[data-act="login-nova2"]','curta');await pg.click('button[type=submit]');await pg.waitForTimeout(100);
  ok(/10 caracteres/.test(await pg.textContent('.alert.bad')),'senha curta avisa');
  await pg.click('[data-act="login-voltar"]');await pg.waitForTimeout(100);ok(await pg.inputValue('[data-act="login-senha"]')==='','voltar limpa a senha');
  await pg.unroute('**/auth/entrar');
  // administrador com o módulo: vê os botões
  ok(await entrarTeste(pg,'eduardo@eduardorezende.com'),'administrador entra');
  ok(await pg.evaluate(()=>{const s=localStorage.getItem('eterna.session')||'';return !/senha/i.test(s)}),'a senha não fica no navegador');
  ok(await pg.evaluate(()=>{const u=ETERNA.USERS['eduardo@eduardorezende.com'];return ['c','r','u','d'].every(k=>u.perms.senhas&&u.perms.senhas[k]);}),'perfil Admin vem com Senhas de acesso');
  // trocar a própria senha fica dentro do sistema, e o redesenho não tira o foco nem apaga o que foi digitado
  await pg.click('[data-act="minha-senha"]');await pg.waitForTimeout(150);ok(/Trocar senha/.test(await pg.textContent('#main')),'a tela Trocar senha abre');
  await pg.click('[data-act="login-senha"]');await pg.keyboard.type('atual');await pg.evaluate(()=>ETERNA.render());await pg.waitForTimeout(50);await pg.keyboard.type('-1');
  ok(await pg.inputValue('[data-act="login-senha"]')==='atual-1','redesenho atrapalhou a troca de senha: '+await pg.inputValue('[data-act="login-senha"]'));
  await pg.fill('[data-act="login-nova"]','uma frase bem longa');await pg.fill('[data-act="login-nova2"]','uma frase bem longa');await pg.click('button[type=submit]');await pg.waitForTimeout(250);
  ok(/Senha alterada/.test(await pg.textContent('#toast')),'a troca confirma');ok(await pg.evaluate(()=>!!ETERNA.state.user&&ETERNA.state.view!=='minhasenha'&&!ETERNA.state.auth.senha),'depois de trocar segue dentro e limpa as senhas');
  await pg.evaluate(()=>{location.hash='#usuarios';});await pg.waitForTimeout(300);
  await fecharUsuario(pg);await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(250);ok(!(await pg.$('[data-act="user-sel"]'))&&!(await pg.$('[data-act="user-new"]'))&&!(await pg.$('[data-act="user-q"]')),'com um usuário aberto, a lista e a busca saem da tela');await pg.click('[data-act="user-cancel"]');ok(await pg.$('[data-act="user-sel"]'),'Fechar volta para a lista');await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(250);
  ok(await pg.$('[data-act="user-senha"]'),'quem tem a permissão vê Gerar senha');
  await pg.click('[data-act="user-senha"]');await pg.waitForTimeout(250);ok(/Senha provisória de carlos@eterna\.photo/.test(await pg.textContent('#main')),'a senha provisória aparece');
  await pg.click('[data-act="user-senha-ok"]');await pg.waitForTimeout(100);ok(!/provisoria-de-teste/.test(await pg.textContent('#main')),'a senha provisória some depois de entregue');
  // o mesmo perfil de administrador sem o módulo: nem Gerar nem Cancelar, e continua vendo Usuários
  await pg.evaluate(()=>{const u=ETERNA.state.user;u.perms.senhas={c:false,r:false,u:false,d:false};ETERNA.render();});await pg.waitForTimeout(100);
  ok(!await pg.$('[data-act="user-senha"]')&&!await pg.$('[data-act="user-senha-cancelar"]'),'sem a permissão, sem botões de senha');
  await fecharUsuario(pg);ok(await pg.$('[data-act="user-sel"]'),'sem a permissão de senhas, Usuários segue aberto');
  // novo usuário sem e-mail: identificador simples passa; com espaço, não
  await fecharUsuario(pg);await pg.click('[data-act="user-new"]');await pg.fill('[data-act="user-field"][data-k="name"]','Rafael');await pg.fill('[data-act="user-field"][data-k="email"]','rafael melo');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);
  ok(/inválido/.test(await pg.textContent('#toast')),'usuário com espaço é recusado');
  await pg.fill('[data-act="user-field"][data-k="email"]','rafael.melo');await pg.fill('[data-act="user-field"][data-k="contato"]','nao e email');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);
  ok(/E-mail inválido/.test(await pg.textContent('#toast')),'e-mail inválido é recusado');await pg.fill('[data-act="user-field"][data-k="contato"]','');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>!!ETERNA.USERS['rafael.melo']),'usuário sem e-mail é cadastrado');
  ok(!/Senha provisória de rafael/.test(await pg.textContent('#main')),'sem Criar em Senhas, o cadastro fica sem senha');
  await trocaDePessoa(b);
  ok(!errs.length,'erros na página: '+errs.join(' | ').slice(0,300));
}catch(e){fails.push('exceção: '+e.message.slice(0,300));}
await b.close();
if(fails.length){console.log('FALHA login-tela: '+fails.join(' | '));process.exit(1);}
console.log('OK login-tela: entrada com senha, redesenho, trocar senha, botões por permissão, usuário sem e-mail e troca de pessoa (401 atrasado, fila no Sair, Sair pendente)');
})();
