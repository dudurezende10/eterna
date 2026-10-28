// v80: "Copiar permissões de…" em Permissões e no cadastro de Usuários (pedido do Eduardo, 28/10).
// Copia módulos C/R/U/D, menu e tela inicial; passa por permValidate; o que quem copia não pode dar fica de fora e é listado; registra permissoes_copiadas.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const P=__dirname+'/prints';require('fs').mkdirSync(P,{recursive:true});
async function nova(b){const ctx=await b.newContext({viewport:{width:1366,height:1000}});const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});return {ctx,pg};}
async function entrar(pg,email){await pg.goto(U);await pg.waitForTimeout(350);if(await pg.evaluate(()=>!!ETERNA.state.user)){await pg.evaluate(()=>localStorage.removeItem('eterna.session'));await pg.reload();await pg.waitForTimeout(350);}
  await pg.fill('[data-act="login-email"]',email);await pg.click('button[type=submit]');await pg.waitForTimeout(150);const otp=await pg.$('.otp');if(!otp)return false;const c=(await otp.textContent()).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(400);return pg.evaluate(()=>!!ETERNA.state.user);}
const acesso=(pg,e)=>pg.evaluate(e=>{const u=ETERNA.USERS[e];return u?JSON.parse(JSON.stringify({perms:ETERNA.permNorm(u.perms),menu:[...u.menu].sort(),inicio:u.inicio||null,preset:u.preset,name:u.name,active:u.active})):null;},e);
const log=(pg,acao)=>pg.evaluate(a=>ETERNA.auditRead().filter(e=>e.acao===a),acao);
const toast=pg=>pg.evaluate(()=>document.querySelector('#toast').textContent);
(async()=>{const b=await chromium.launch();
try{
  // ---------- 1. admin cria usuário novo começando com as permissões do Supervisor ----------
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'eduardo@eduardorezende.com'),'admin não entrou');
    await pg.evaluate(()=>{localStorage.removeItem('eterna.users.log.v1');ETERNA.go('usuarios');});await pg.waitForTimeout(150);
    await pg.click('[data-act="user-new"]');await pg.waitForTimeout(100);
    await pg.fill('[data-act="user-field"][data-k="name"]','Gerente Novo');await pg.fill('[data-act="user-field"][data-k="email"]','novo@eterna.photo');
    await pg.evaluate(()=>{['name','email'].forEach(k=>{const i=document.querySelector(`[data-act="user-field"][data-k="${k}"]`);i.dispatchEvent(new Event('input',{bubbles:true}));});});
    await pg.selectOption('select[data-act="user-copy-from"]','supervisor@eterna.photo');await pg.waitForTimeout(120);
    const prev=await pg.evaluate(()=>(document.querySelector('.perm-copy-prev')||{}).textContent||'');ok(/Supervisão/.test(prev)&&/Supervisor/.test(prev),'1: prévia do cadastro novo '+prev);
    ok(!(await acesso(pg,'novo@eterna.photo')),'1: gravou antes de criar');
    await pg.screenshot({path:P+'/copiar-permissoes-cadastro.png',fullPage:true});
    await pg.click('[data-act="user-save"]');await pg.waitForTimeout(150);
    const n=await acesso(pg,'novo@eterna.photo'),s=await acesso(pg,'supervisor@eterna.photo');
    ok(n&&J(n.perms)===J(s.perms)&&J(n.menu)===J(s.menu)&&n.inicio===s.inicio&&n.preset==='supervisor'&&n.name==='Gerente Novo'&&n.active!==false,'1: novo usuário deveria ter as permissões do Supervisor '+J(n&&{p:n.preset,i:n.inicio,name:n.name}));
    const l1=await log(pg,'permissoes_copiadas');ok(l1.some(e=>e.alvo==='novo@eterna.photo'&&e.de==='supervisor@eterna.photo'&&e.para==='novo@eterna.photo'&&e.mudancas.length),'1: auditLog permissoes_copiadas '+J(l1.map(e=>[e.alvo,e.de])));
    // ---------- 2. Permissões: copiar do Validador para o Carlos, com prévia antes de gravar ----------
    const c0=await acesso(pg,'carlos@eterna.photo');
    await pg.evaluate(()=>{ETERNA.state.perm.tab='usuario';ETERNA.go('permissoes');});await pg.waitForTimeout(100);await pg.click('[data-act="perm-sel"][data-e="carlos@eterna.photo"]');await pg.waitForTimeout(100);
    await pg.click('[data-act="perm-copy"]');await pg.waitForTimeout(100);await pg.selectOption('select[data-act="perm-copy-from"]','qualidade@eterna.photo');await pg.waitForTimeout(120);
    const pv=await pg.evaluate(()=>({li:[...document.querySelectorAll('.perm-copy-prev li')].map(x=>x.textContent),btn:!document.querySelector('[data-act="perm-copy-ok"]').disabled}));
    ok(pv.li.length>0&&pv.btn&&pv.li.some(x=>/Qualidade e IA/.test(x)),'2: prévia da cópia '+J(pv));ok(pv.li.some(x=>/^Perfil: /.test(x))&&pv.li.some(x=>/^Tela inicial: /.test(x))&&!pv.li.some(x=>/^(preset|inicio):/.test(x)),'revisão 3: prévia com nomes internos '+J(pv.li));ok(J(await acesso(pg,'carlos@eterna.photo'))===J(c0),'2: gravou antes de confirmar');
    await pg.screenshot({path:P+'/copiar-permissoes-previa.png',fullPage:true});
    await pg.click('[data-act="perm-copy-ok"]');await pg.waitForTimeout(150);
    const c1=await acesso(pg,'carlos@eterna.photo'),q=await acesso(pg,'qualidade@eterna.photo');
    ok(J(c1.perms)===J(q.perms)&&J(c1.menu)===J(q.menu)&&c1.inicio===q.inicio&&c1.name==='Carlos','2: Carlos deveria ter as permissões do Validador '+J({p:c1.preset,i:c1.inicio}));
    const l2=await log(pg,'permissoes_copiadas');ok(l2.some(e=>e.alvo==='carlos@eterna.photo'&&e.de==='qualidade@eterna.photo'),'2: auditLog da cópia para o Carlos');
    // o histórico mostra a cópia
    await pg.click('[data-act="perm-tab"][data-t="historico"]');await pg.waitForTimeout(100);ok(/copiou permissões para/.test(await pg.textContent('#main'))&&/copiado de/.test(await pg.textContent('#main')),'2: histórico sem a cópia');
    // Usuários › Copiar permissões de… abre Permissões com o painel de cópia
    await pg.evaluate(()=>ETERNA.go('usuarios'));await pg.waitForTimeout(80);await pg.click('[data-act="user-sel"][data-e="marinara@eterna.photo"]');await pg.waitForTimeout(80);await pg.click('[data-act="perm-copy-open"]');await pg.waitForTimeout(120);
    ok(await pg.evaluate(()=>ETERNA.state.view==='permissoes'&&ETERNA.state.perm.sel==='marinara@eterna.photo'&&!!document.querySelector('select[data-act="perm-copy-from"]')),'2: botão do cadastro deveria abrir a cópia em Permissões');
    await ctx.close();}
  {const {ctx,pg}=await nova(b);await pg.goto(U);await pg.waitForTimeout(300);
    // ---------- 3. preparar um gerente (não admin) que edita permissões ----------
    await pg.evaluate(()=>{const n=x=>({c:false,r:false,u:false,d:false,...x});const U0=JSON.parse(JSON.stringify(ETERNA.USERS));
      U0['gerente@eterna.photo']={v:2,mv:83,email:'gerente@eterna.photo',name:'Gerente',preset:'custom',key:null,perms:{usuarios:n({c:true,r:true,u:true}),permissoes:n({r:true,u:true}),estoque:n({r:true,u:true}),diario:n({r:true})},menu:['usuarios','permissoes','bandeiras','estoque','diario'],inicio:null,active:true,createdAt:'2026-10-27T10:00:00.000Z',createdBy:'teste',lastLogin:null};
      U0['alvo@eterna.photo']={v:2,mv:83,email:'alvo@eterna.photo',name:'Alvo',preset:'custom',key:null,perms:{diario:n({r:true})},menu:['diario'],inicio:null,active:true,createdAt:'2026-10-27T10:00:00.000Z',createdBy:'teste',lastLogin:null};
      localStorage.setItem('eterna.users.v1',JSON.stringify(U0));});
    await pg.reload();await pg.waitForTimeout(300);ok(await entrar(pg,'gerente@eterna.photo'),'3: gerente não entrou');
    await pg.evaluate(()=>{localStorage.removeItem('eterna.users.log.v1');ETERNA.state.perm.tab='usuario';ETERNA.go('permissoes');});await pg.waitForTimeout(120);
    await pg.click('[data-act="perm-sel"][data-e="alvo@eterna.photo"]');await pg.waitForTimeout(100);await pg.click('[data-act="perm-copy"]');await pg.waitForTimeout(80);
    await pg.selectOption('select[data-act="perm-copy-from"]','eduardo@eduardorezende.com');await pg.waitForTimeout(120);
    const av=await pg.evaluate(()=>({fora:(document.querySelector('.perm-copy-prev .alert')||{}).textContent||'',li:[...document.querySelectorAll('.perm-copy-prev li')].map(x=>x.textContent)}));
    ok(/Ficou de fora: você não pode dar estes acessos/.test(av.fora)&&/Números de vendas/.test(av.fora),'3: aviso do que ficou de fora ao copiar o Admin '+J(av.fora.slice(0,120)));
    await pg.screenshot({path:P+'/copiar-permissoes-bloqueio.png',fullPage:true});
    await pg.click('[data-act="perm-copy-ok"]');await pg.waitForTimeout(150);
    const a=await acesso(pg,'alvo@eterna.photo');const ex=await pg.evaluate(()=>({admin:ETERNA.adminCount({x:ETERNA.USERS['alvo@eterna.photo']}),extra:ETERNA.MODULES.some(([m])=>['c','r','u','d'].some(k=>ETERNA.USERS['alvo@eterna.photo'].perms[m][k]&&!ETERNA.USERS['gerente@eterna.photo'].perms[m][k]&&!(m==='diario'&&k==='r')))}));
    ok(!ex.admin&&!ex.extra&&!a.perms.financeiro.r&&a.perms.estoque.u,'3: copiar o Admin não pode dar mais do que o gerente tem '+J(ex));
    ok(/Ficou de fora/.test(await toast(pg)),'3: aviso no toast '+await toast(pg));
    const l3=await log(pg,'permissoes_copiadas');ok(l3.some(e=>e.alvo==='alvo@eterna.photo'&&e.de==='eduardo@eduardorezende.com'&&e.fora&&e.fora.length>0),'3: auditLog com o que ficou de fora');
    // copiar para quem tem mais acesso (o Admin): bloqueado, sem botão; forçar pelo estado também não grava
    await pg.click('[data-act="perm-sel"][data-e="eduardo@eduardorezende.com"]');await pg.waitForTimeout(100);ok(!(await pg.$('[data-act="perm-copy"]')),'3: botão de cópia para quem tem mais acesso');
    const adm0=await acesso(pg,'eduardo@eduardorezende.com');
    await pg.evaluate(()=>{ETERNA.state.perm.copy={open:true,de:'alvo@eterna.photo'};const bt=document.createElement('button');bt.dataset.act='perm-copy-ok';document.querySelector('#main').appendChild(bt);bt.click();});await pg.waitForTimeout(120);
    ok(J(await acesso(pg,'eduardo@eduardorezende.com'))===J(adm0),'3: cópia forçada mudou o Admin');ok(/Sem permissão|acessos que você não tem/.test(await toast(pg)),'3: cópia forçada sem aviso '+await toast(pg));
    await ctx.close();}
  // ---------- 4. quem só vê Permissões não copia (supervisor não tem Permissões; validador forçando a ação) ----------
  {const {ctx,pg}=await nova(b);ok(await entrar(pg,'qualidade@eterna.photo'),'4: validador não entrou');const c0=await acesso(pg,'carlos@eterna.photo');
    await pg.evaluate(()=>{ETERNA.state.perm.sel='carlos@eterna.photo';ETERNA.state.perm.copy={open:true,de:'eduardo@eduardorezende.com'};const bt=document.createElement('button');bt.dataset.act='perm-copy-ok';document.querySelector('#main').appendChild(bt);bt.click();});await pg.waitForTimeout(120);
    ok(J(await acesso(pg,'carlos@eterna.photo'))===J(c0),'4: validador copiou permissões pelo DOM');await ctx.close();}
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
await b.close();const ok2=!fails.length&&!errs.length;console.log(`${ok2?'OK':'FALHA'} copiar-permissoes: cadastro novo, prévia, confirmação, bloqueio do Admin, histórico${fails.length?' · '+fails.slice(0,10).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(ok2?0:1);})();
