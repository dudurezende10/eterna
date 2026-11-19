// 18/11 (regra 19, Eduardo D1): o plano B do Checkout (lojaAIAntigo: as 2 primeiras fotos com gente de qualquer ponto) acabou e
// fica atrás da chave FIA_ANTIGO_ON, desligada. Os testes antigos que ainda cobrem o jeito antigo ligam a chave:
//   await require('./_fia_antigo')(pg)            depois do goto (window.ETERNA.FIA_ANTIGO_ON = true)
//   require('./_fia_antigo').html(texto)          no texto do index.html (para juntar com o _escala.js no mesmo page.route)
//   await require('./_fia_antigo').contexto(ctx)  todas as páginas do contexto (antes do goto)
const CHAVE='let FIA_ANTIGO_ON=false;';
function html(t){if(t.split(CHAVE).length!==2)throw new Error('testes/_fia_antigo.js: a linha "'+CHAVE+'" tem que existir uma vez no index.html');return t.replace(CHAVE,'let FIA_ANTIGO_ON=true;');}
async function ligar(pg){await pg.waitForFunction(()=>window.ETERNA&&'FIA_ANTIGO_ON' in window.ETERNA,null,{timeout:20000});await pg.evaluate(()=>{window.ETERNA.FIA_ANTIGO_ON=true;});}
// o contexto inteiro (todas as páginas, também depois de recarregar) recebe o index.html com a chave ligada
async function contexto(ctx){const fs=require('fs'),path=require('path');const body=html(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'));
  await ctx.route(u=>u.pathname.endsWith('/index.html'),r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'text/html; charset=utf-8',headers:{'Cache-Control':'no-store'},body}):r.continue());}
module.exports=ligar;module.exports.html=html;module.exports.contexto=contexto;module.exports.CHAVE=CHAVE;
