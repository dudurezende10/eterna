// login padrão dos testes: e-mail do admin e o código que a tela mostra no protótipo
const entrarTeste=require('./_entrar');
module.exports=async function login(pg){
  await pg.goto(process.env.U||'http://127.0.0.1:8890/index.html');await pg.waitForTimeout(400);
  // app de versão antiga (v94/v95, usado nas comparações do checkout-tela-cheia): entrada por e-mail e código na tela
  if(!(await pg.$('[data-act="login-usuario"]'))&&(await pg.$('[data-act="login-email"]'))){await pg.fill('[data-act="login-email"]','eduardo@eduardorezende.com');await pg.click('button[type=submit]');await pg.waitForTimeout(200);
    const otp=await pg.$('.otp');if(otp){await pg.fill('[data-act="login-code"]',(await otp.textContent()).replace(/\s/g,''));await pg.waitForTimeout(500);}return;}
  await entrarTeste(pg,'eduardo@eduardorezende.com');};
