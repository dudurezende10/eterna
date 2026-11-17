// 17/11 (Ronaldo): foto do perfil no cadastro e, sem foto, as iniciais; lista de usuários em blocos por perfil, por nome.
// O servidor está coberto em testes/foto_perfil_agente.py.
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'foto-'));
execFileSync('python3',['-c',"from PIL import Image\nimport sys\nImage.new('RGB',(900,1200),(200,60,60)).save(sys.argv[1]+'/p.jpg',quality=80)",TMP]);
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const A=await ctx.newPage();A.on('pageerror',e=>errs.push(e.message));await A.goto(U);await A.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await A.reload();await A.waitForTimeout(400);
  const E=require('./_entrar');const adm=await E.adminFicticio(A);
  await A.evaluate(()=>{const U0=JSON.parse(localStorage.getItem('eterna.users.v1'));const P=(c,r,u,d)=>({c,r,u,d});const v={v:2,preset:'venda',key:null,active:true,perms:{venda:P(true,true,true,false)},menu:['posto'],inicio:'posto',createdAt:'2026-11-17'};
    U0['caixa.bia']={...v,email:'caixa.bia',name:'Bia Souza'};U0['caixa.ana']={...v,email:'caixa.ana',name:'Ana Lima'};
    localStorage.setItem('eterna.users.v1',JSON.stringify(U0));});
  await A.reload();await A.waitForTimeout(400);await E(A,adm);
  await A.evaluate(()=>ETERNA.go('usuarios'));await A.waitForTimeout(200);
  // 1. blocos por perfil, na ordem dos perfis, e nomes em ordem dentro de cada um
  const g=await A.evaluate(()=>[...document.querySelectorAll('#main .panel')].filter(p=>p.querySelector('tr[data-e]')).map(p=>({h:p.querySelector('h2').textContent,n:[...p.querySelectorAll('tr[data-e]')].map(t=>t.dataset.e)})));
  const venda=g.find(x=>x.n.includes('caixa.ana'));
  ok(g.length>=2&&venda&&venda.n.indexOf('caixa.ana')<venda.n.indexOf('caixa.bia'),'1: blocos por perfil e nomes em ordem: '+J(g));
  ok(!(await A.evaluate(()=>/fora desta lista/.test(document.querySelector('#main').textContent))),'1: sem a nota de rodapé');
  // 2. sem foto: iniciais
  const ini=await A.evaluate(()=>{const e=document.querySelector('tr[data-e="caixa.ana"] .av');return e&&e.tagName==='SPAN'?e.textContent:null;});
  ok(ini==='AL','2: iniciais da Ana Lima: '+ini);
  // 3. colocar foto no cadastro e salvar
  await A.click('[data-act="user-sel"][data-e="caixa.ana"]');await A.waitForTimeout(150);
  await A.setInputFiles('[data-act="user-foto"]',TMP+'/p.jpg');await A.waitForTimeout(600);
  ok(await A.evaluate(()=>!!document.querySelector('.us-foto img.av')&&!!document.querySelector('[data-act="user-foto-tirar"]')),'3: prévia da foto no cadastro');
  await A.click('[data-act="user-save"]');await A.waitForTimeout(300);
  const f=await A.evaluate(()=>{const u=JSON.parse(localStorage.getItem('eterna.users.v1'))['caixa.ana'];return u&&u.foto?{ini:u.foto.slice(0,23),n:u.foto.length}:null;});
  ok(f&&f.ini==='data:image/jpeg;base64,'&&f.n<40000,'3: foto gravada pequena: '+J(f));
  ok(await A.evaluate(()=>{const e=document.querySelector('tr[data-e="caixa.ana"] .av');return !!e&&e.tagName==='IMG';}),'3: foto na lista');
  const h=await A.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]').slice(0,3)));
  ok(!/base64/.test(h),'3: histórico sem a imagem');
  // 4. remover
  await A.click('[data-act="user-sel"][data-e="caixa.ana"]');await A.waitForTimeout(150);await A.click('[data-act="user-foto-tirar"]');await A.click('[data-act="user-save"]');await A.waitForTimeout(300);
  ok(await A.evaluate(()=>!JSON.parse(localStorage.getItem('eterna.users.v1'))['caixa.ana'].foto),'4: foto removida');
  // 5. a própria foto pelo rodapé do menu
  ok(await A.evaluate(()=>!!document.querySelector('#venue-sub .av-troca .av')),'5: avatar no rodapé');
  await A.setInputFiles('#venue-sub [data-act="minha-foto"]',TMP+'/p.jpg');await A.waitForTimeout(600);
  ok(await A.evaluate(a=>!!(JSON.parse(localStorage.getItem('eterna.users.v1'))[a]||{}).foto&&!!document.querySelector('#venue-sub img.av'),adm),'5: a própria foto trocada pelo rodapé');
}catch(e){fails.push('exceção: '+e.message.split('\n')[0]);}
await b.close();
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA foto-perfil: '+fails.join(' | '));process.exit(1);}
console.log('OK foto-perfil: iniciais sem foto, colocar, lista, histórico sem imagem, remover, a própria pelo rodapé; usuários em blocos por perfil');})();
