// Entrada nos testes de tela: digita usuário e senha, com as rotas /auth/* respondidas aqui no navegador. Quem confere a senha de verdade
// é o agente, e isso está coberto em testes/login_agente.py. Usuário fora do cadastro entra no servidor, mas a tela barra (teste de tela).
const SERVIDOR=new WeakSet();
async function servidorDeTeste(pg){if(SERVIDOR.has(pg))return;SERVIDOR.add(pg);let conectado=null;
  await pg.route('**/auth/*',async rota=>{const p=new URL(rota.request().url()).pathname;const c=rota.request().postDataJSON?(()=>{try{return rota.request().postDataJSON()||{}}catch(e){return {}}})():{};
    const resp=(j,status)=>rota.fulfill({status:status||200,contentType:'application/json',body:JSON.stringify(j)});
    if(p==='/auth/entrar'){const u=String(c.usuario||'').toLowerCase();conectado={ok:true,usuario:u};return resp(conectado);}
    if(p==='/auth/senhas')return resp({ok:true,senhas:{}});
    if(p==='/auth/eu')return conectado?resp(conectado):resp({erro:'sem_sessao'},404);
    if(p==='/auth/sair'){conectado=null;return resp({ok:true});}
    if(p==='/auth/senha/gerar')return resp({ok:true,usuario:c.usuario,senha:'provisoria-de-teste'});
    return resp({ok:true});});
  await pg.route('**/auth/senha/*',rota=>{const c=(()=>{try{return rota.request().postDataJSON()||{}}catch(e){return {}}})();return rota.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,usuario:c.usuario,senha:'provisoria-de-teste'})});});}
module.exports=async function entrarTeste(pg,usuario){await servidorDeTeste(pg);await pg.fill('[data-act="login-usuario"]',usuario);await pg.fill('[data-act="login-senha"]','senha-de-teste');await pg.click('button[type=submit]');await pg.waitForTimeout(350);return pg.evaluate(()=>!!ETERNA.state.user);};
