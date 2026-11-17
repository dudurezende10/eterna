// 17/11 (Ronaldo): Permissões › Perfis com criar, editar, excluir e atrelar pessoas. Quem está no perfil segue o perfil.
// O servidor está coberto em testes/perfis_agente.py.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);
  // Sandessa ficou Personalizado depois de um ajuste à mão
  await A.evaluate(()=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1'));const s=U0['sandessa@eterna.photo'];s.perms.galerias={c:false,r:true,u:false,d:false};s.preset='custom';localStorage.setItem('eterna.users.v1',JSON.stringify(U0));});
  await A.reload();await A.waitForTimeout(400);await E(A,adm);
  const st=()=>A.evaluate(()=>({s:ETERNA.state&&null}));
  const ev=f=>A.evaluate(f);
  await ev(()=>ETERNA.go('permissoes'));await A.waitForTimeout(200);
  await A.click('[data-act="perm-sel"][data-e="sandessa@eterna.photo"]');await A.waitForTimeout(150);
  // 1. criar perfil com as permissões dela
  ok(!!(await A.$('[data-act="pf-de-pessoa"]')),'1: botão Criar perfil com estas permissões no Personalizado');
  await A.click('[data-act="pf-de-pessoa"]');await A.waitForTimeout(150);
  ok(await A.$eval('[data-act="pf-quem"][data-e="sandessa@eterna.photo"]',e=>e.checked),'1: ela já vem marcada');
  await A.click('[data-act="pf-salvar"]');await A.waitForTimeout(150);
  ok(!!(await A.$('[data-act="pf-salvar"]')),'1: sem nome não salva');
  await A.fill('[data-act="pf-nome"]','Fotógrafo líder');await A.click('[data-act="pf-salvar"]');await A.waitForTimeout(200);
  let r=await ev(()=>{const P=JSON.parse(localStorage.getItem('eterna.perfis.v1')||'{}');const p=Object.values(P)[0]||{};const u=JSON.parse(localStorage.getItem('eterna.users.v1'))['sandessa@eterna.photo'];return {id:p.id,nome:p.name,gal:p.perms&&p.perms.galerias,preset:u.preset};});
  ok(r.nome==='Fotógrafo líder'&&r.gal&&r.gal.r&&r.preset===r.id,'1: perfil criado e Sandessa nele: '+J(r));
  const id=r.id;
  // 2. a lista de usuários mostra o nome do perfil
  await ev(()=>ETERNA.go('usuarios'));await A.waitForTimeout(150);
  ok(await A.evaluate(()=>{const tr=document.querySelector('tr[data-e="sandessa@eterna.photo"]');const p=tr&&tr.closest('.panel');return !!p&&p.querySelector('h2').textContent==='Fotógrafo líder';}),'2: lista de usuários mostra a pessoa no bloco do perfil');
  // 3. editar o perfil: tirar Galerias leva junto quem está nele
  await ev(()=>ETERNA.go('permissoes'));await A.click('[data-act="perm-tab"][data-t="perfis"]');await A.waitForTimeout(150);
  await A.click(`[data-act="pf-editar"][data-k="${id}"]`);await A.waitForTimeout(150);
  await A.click('[data-act="perm-op"][data-m="galerias"][data-op="r"]');await A.waitForTimeout(100);
  await A.click('[data-act="pf-salvar"]');await A.waitForTimeout(200);
  r=await ev(()=>JSON.parse(localStorage.getItem('eterna.users.v1'))['sandessa@eterna.photo']);
  ok(!r.perms.galerias.r&&r.preset===id,'3: a pessoa seguiu o perfil editado: '+J(r.perms.galerias));
  // 4. perfil pronto: editar o nome e voltar ao original
  await A.click('[data-act="pf-editar"][data-k="campo"]');await A.waitForTimeout(150);
  await A.fill('[data-act="pf-nome"]','Equipe de pista');await A.click('[data-act="pf-salvar"]');await A.waitForTimeout(200);
  ok((await A.textContent('.perm-cards')).includes('Equipe de pista'),'4: nome novo do perfil pronto');
  await A.click('[data-act="pf-tirar"][data-k="campo"]');await A.click('[data-act="pf-tirar-ok"][data-k="campo"]');await A.waitForTimeout(200);
  ok((await A.textContent('.perm-cards')).includes('Equipe de campo')&&!(await A.textContent('.perm-cards')).includes('Equipe de pista'),'4: voltou ao original');
  // 5. excluir: com gente dentro não exclui; sem gente, exclui
  await A.click(`[data-act="pf-tirar"][data-k="${id}"]`);await A.click(`[data-act="pf-tirar-ok"][data-k="${id}"]`);await A.waitForTimeout(150);
  r=await ev(id=>({p:Object.keys(JSON.parse(localStorage.getItem("eterna.perfis.v1"))),s:JSON.parse(localStorage.getItem("eterna.users.v1"))["sandessa@eterna.photo"].preset}),id);ok(r.p.includes(id),"5: com gente dentro não exclui: "+J(r)+" "+id);
  await A.click(`[data-act="pf-editar"][data-k="${id}"]`);await A.waitForTimeout(150);
  await A.click('[data-act="pf-quem"][data-e="sandessa@eterna.photo"]');await A.click('[data-act="pf-salvar"]');await A.waitForTimeout(200);
  r=await ev(()=>JSON.parse(localStorage.getItem('eterna.users.v1'))['sandessa@eterna.photo'].preset);
  ok(r==='custom','5: quem sai do perfil fica Personalizado: '+r);
  await A.click(`[data-act="pf-tirar"][data-k="${id}"]`);await A.click(`[data-act="pf-tirar-ok"][data-k="${id}"]`);await A.waitForTimeout(150);
  ok(await ev(id=>!JSON.parse(localStorage.getItem('eterna.perfis.v1'))[id],id),'5: sem gente, exclui');
  // 6. Admin não tem Editar
  ok(!(await A.$('[data-act="pf-editar"][data-k="admin"]')),'6: o Admin não muda');
  // 7. histórico
  await A.click('[data-act="perm-tab"][data-t="historico"]');await A.waitForTimeout(150);
  const h=await A.textContent('.perm-log');ok(/criou o perfil/.test(h)&&/excluiu o perfil/.test(h)&&/voltou ao original o perfil/.test(h),'7: histórico dos perfis');
  ok(!errs.length,'erros na página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA perfis: '+fails.join(' || '));process.exit(1);}
console.log('OK perfis: criar da pessoa, editar leva junto quem está, pronto volta ao original, excluir, histórico');process.exit(0);
})();
