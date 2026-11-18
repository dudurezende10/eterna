// Escala desligada (16/11/2026): a chave ESCALA_ON do index.html nasce desligada. Os testes da Escala e da função do dia
// (escala-fotografo, a parte da Escala de relatorios, permissoes com a chave ligada, cliques de IA etc.) chamam
// escalaLigada(ctx) antes de abrir a página: o index.html chega com a chave ligada, o mesmo que religar no código.
// Também prova o critério "religar devolve tudo" sem deixar interruptor nenhum na página de produção.
const fs=require('fs');const path=require('path');
const CHAVE='const ESCALA_ON=false;';
function paginaLigada(){const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  if(html.split(CHAVE).length!==2)throw new Error('testes/_escala.js: a linha "'+CHAVE+'" tem que existir uma vez no index.html');
  return html.replace(CHAVE,'const ESCALA_ON=true;');}
// ctx: contexto (ou página) do Playwright. ehApp(url): opcional, para quando o app é servido em outro caminho (agente: "/").
async function escalaLigada(ctx,ehApp){const body=paginaLigada();const casa=ehApp||(u=>u.pathname.endsWith('/index.html'));
  await ctx.route(u=>casa(u),r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Cache-Control':'no-store'},body}):r.continue());}
module.exports=escalaLigada;module.exports.paginaLigada=paginaLigada;module.exports.CHAVE=CHAVE;
