// login padrão dos testes: e-mail do admin e o código que a tela mostra no protótipo
const entrarTeste=require('./_entrar');
module.exports=async function login(pg){
  await pg.goto(process.env.U||'http://127.0.0.1:8890/index.html');await pg.waitForTimeout(400);
  await entrarTeste(pg,'eduardo@eduardorezende.com');};
