// login padrão dos testes: e-mail do admin e o código que a tela mostra no protótipo
module.exports=async function login(pg){
  await pg.goto(process.env.U||'http://127.0.0.1:8890/index.html');await pg.waitForTimeout(400);
  await pg.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.click('button[type=submit]');await pg.waitForTimeout(150);
  const c=(await pg.textContent('.otp')).replace(/\s/g,'');await pg.fill('[data-act="login-code"]',c);await pg.waitForTimeout(400);};
