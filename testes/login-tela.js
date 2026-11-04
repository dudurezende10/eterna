// Tela de entrada e botões de Senhas de acesso. As rotas /auth/* respondem no navegador (_entrar.js); a regra de verdade está em login_agente.py.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const servidorRotas=pg=>pg.route('**/auth/esqueci',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};
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
  await pg.click('[data-act="user-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(250);
  ok(await pg.$('[data-act="user-senha"]'),'quem tem a permissão vê Gerar senha');
  await pg.click('[data-act="user-senha"]');await pg.waitForTimeout(250);ok(/Senha provisória de carlos@eterna\.photo/.test(await pg.textContent('#main')),'a senha provisória aparece');
  await pg.click('[data-act="user-senha-ok"]');await pg.waitForTimeout(100);ok(!/provisoria-de-teste/.test(await pg.textContent('#main')),'a senha provisória some depois de entregue');
  // o mesmo perfil de administrador sem o módulo: nem Gerar nem Cancelar, e continua vendo Usuários
  await pg.evaluate(()=>{const u=ETERNA.state.user;u.perms.senhas={c:false,r:false,u:false,d:false};ETERNA.render();});await pg.waitForTimeout(100);
  ok(!await pg.$('[data-act="user-senha"]')&&!await pg.$('[data-act="user-senha-cancelar"]'),'sem a permissão, sem botões de senha');
  ok(await pg.$('[data-act="user-sel"]'),'sem a permissão de senhas, Usuários segue aberto');
  // novo usuário sem e-mail: identificador simples passa; com espaço, não
  await pg.click('[data-act="user-new"]');await pg.fill('[data-act="user-field"][data-k="name"]','Rafael');await pg.fill('[data-act="user-field"][data-k="email"]','rafael melo');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);
  ok(/inválido/.test(await pg.textContent('#toast')),'usuário com espaço é recusado');
  await pg.fill('[data-act="user-field"][data-k="email"]','rafael.melo');await pg.fill('[data-act="user-field"][data-k="contato"]','nao e email');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(80);
  ok(/E-mail inválido/.test(await pg.textContent('#toast')),'e-mail inválido é recusado');await pg.fill('[data-act="user-field"][data-k="contato"]','');await pg.click('[data-act="user-save"]');await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>!!ETERNA.USERS['rafael.melo']),'usuário sem e-mail é cadastrado');
  ok(!/Senha provisória de rafael/.test(await pg.textContent('#main')),'sem Criar em Senhas, o cadastro fica sem senha');
  ok(!errs.length,'erros na página: '+errs.join(' | ').slice(0,300));
}catch(e){fails.push('exceção: '+e.message.slice(0,300));}
await b.close();
if(fails.length){console.log('FALHA login-tela: '+fails.join(' | '));process.exit(1);}
console.log('OK login-tela: entrada com senha, redesenho, trocar senha, botões por permissão e usuário sem e-mail');
})();
