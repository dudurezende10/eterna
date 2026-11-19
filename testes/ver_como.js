// 16/11 (Ronaldo): "Ver como" na tela e o perfil Vendedor Snap Pop. O servidor está coberto em testes/ver_como_agente.py;
// aqui: o botão só para Admin e só de quem não é Admin, a faixa com "Voltar", nada se grava enquanto ela está ligada
// (ações, fila do banco, POST ao servidor, venda das ativações) e o Snap Pop vê só a aba dele.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);
  // vendedores de teste no cadastro do navegador
  await A.evaluate(()=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1'));const P=(c,r,u,d)=>({c,r,u,d});
    U0['snap.teste']={v:2,email:'snap.teste',name:'Snap de teste',preset:'snap',key:null,active:true,perms:{ativvenda:P(true,true,false,false),ativentrega:P(true,true,true,false)},menu:['ativ-venda','ativ-entrega'],inicio:'ativ-venda',createdAt:'2026-11-16T10:00:00.000Z'};
    U0['outro.admin']={...U0['admin.teste@exemplo.com'],email:'outro.admin',name:'Outro admin'};
    localStorage.setItem('eterna.users.v1',JSON.stringify(U0));});
  await A.reload();await A.waitForTimeout(400);await E(A,adm);
  let assumir=0,voltar=0;
  await A.route('**/auth/assumir',r=>{assumir++;const c=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:c.usuario,cadastro:null,assumido_por:'admin.teste@exemplo.com',assumido_nome:'Admin de teste'})});});
  await A.route('**/auth/voltar',r=>{voltar++;r.fulfill({status:200,contentType:'application/json',body:J({ok:true,usuario:'admin.teste@exemplo.com',cadastro:null})});});
  // 1. botão no cadastro: aparece para quem não é Admin, não aparece para Admin
  await A.evaluate(()=>ETERNA.go('usuarios'));await A.waitForTimeout(200);
  await A.click('[data-act="user-sel"][data-e="outro.admin"]');await A.waitForTimeout(150);
  ok(!(await A.$('[data-act="user-assumir"]')),'1: Admin não tem Ver como');
  await A.click('[data-act="user-cancel"]');await A.click('[data-act="user-sel"][data-e="snap.teste"]');await A.waitForTimeout(150);
  ok(!!(await A.$('[data-act="user-assumir"]')),'1: botão Ver como no vendedor');
  // 2. ver como: faixa, tela inicial dela, só a aba do Snap Pop
  await A.click('[data-act="user-assumir"]');await A.waitForTimeout(500);
  const st=await A.evaluate(()=>({u:ETERNA.state.user&&ETERNA.state.user.email,a:ETERNA.state.assumido,v:ETERNA.state.view}));
  ok(assumir===1&&st.u==='snap.teste'&&st.a&&st.a.por==='admin.teste@exemplo.com'&&st.v==='ativ-venda','2: entrou como o vendedor: '+J(st));
  const fx=await A.textContent('.assumido-faixa').catch(()=>'');
  ok(/Vendo como Snap de teste \(Vendedor Snap Pop\)/.test(fx)&&/só visualização/.test(fx)&&/Voltar para Admin de teste/.test(fx),'2: faixa: '+fx);
  const cats=await A.$$eval('[data-act="av-cat"]',x=>x.map(e=>e.dataset.c));
  ok(J(cats)===J(['snap']),'2: Snap Pop vê só a aba dele: '+J(cats));
  ok(!(await A.$('#nav [data-v="usuarios"]')),'2: menu é o da pessoa');
  // 3. só olha
  const so=await A.evaluate(async()=>{const fila=()=>(JSON.parse(localStorage.getItem('eterna.db.fila.v1')||'[]')).length;const f0=fila();
    ETERNA.state.db&&ETERNA.state.db.doc('diario/x').set({a:1});const r=await ETERNA.agFetch(location.origin+'/ponto/docs',{method:'POST',body:'{}'});
    return {fila:fila()-f0,post:r.status};});
  ok(so.fila===0&&so.post===403,'3: nada vai para a fila nem para o servidor: '+J(so));
  // 4. voltar
  await A.click('[data-act="assumir-voltar"]');await A.waitForTimeout(500);
  const vt=await A.evaluate(()=>({u:ETERNA.state.user&&ETERNA.state.user.email,a:ETERNA.state.assumido,v:ETERNA.state.view}));
  ok(voltar===1&&vt.u==='admin.teste@exemplo.com'&&!vt.a&&vt.v==='usuarios'&&!(await A.$('.assumido-faixa')),'4: voltou para o Admin, em Usuários: '+J(vt));
  // 5. Admin de verdade vê as três abas
  await A.evaluate(()=>ETERNA.go('ativ-venda'));await A.waitForTimeout(200);
  ok((await A.$$('[data-act="av-cat"]')).length===3,'5: Admin vê as três abas');
  ok(!errs.length,'erros na página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{await b.close();}
if(fails.length){console.log('FALHA ver_como: '+fails.join(' || '));process.exit(1);}
console.log('OK ver_como: botão só para Admin, faixa, só a aba do Snap Pop, nada grava, voltar');process.exit(0);
})();
