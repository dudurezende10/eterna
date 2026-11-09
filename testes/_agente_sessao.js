// Ajudante dos testes que sobem o agente de verdade: sessão de uma pessoa e posto pareado, gravados no estado.db do HOME
// do agente (o agente lê o banco a cada pedido). Não é teste (começa com _).
//   const S=require('./_agente_sessao');const ck=S.sessao(home);          // 'eterna_sessao=...' (admin com tudo)
//   S.sessao(home,'foto1',{set:{r:true}})  ·  S.posto(home,'Caixa 2')  ·  await S.noNavegador(ctx,porta,[ck,ckPosto])
//   await S.parear(porta,ck,'Caixa 3')  -> 'eterna_posto=...' pela rota POST /postos/parear
const {execFileSync}=require('child_process');const path=require('path');const http=require('http');
const AG=path.join(__dirname,'..','agente','eterna-agente.py');const PY=path.join(__dirname,'_agente_sessao.py');
const roda=(home,args)=>execFileSync('python3',['-I',PY,AG,...args],{env:{...process.env,HOME:home,ETERNA_SEM_OPENCV:'1'},timeout:60000}).toString().trim().split('\n').pop();
const sessao=(home,usuario,perms)=>roda(home,['sessao',usuario||'admin-teste',...(perms?[JSON.stringify(perms)]:[])]);
const posto=(home,nome)=>roda(home,['posto',nome||'Posto de teste']);
async function noNavegador(ctx,porta,cookies){await ctx.addCookies(cookies.filter(Boolean).map(c=>{const i=c.indexOf('=');return {name:c.slice(0,i),value:c.slice(i+1),domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'};}));}
function parear(porta,cookie,nome){return new Promise((res,rej)=>{const d=Buffer.from(JSON.stringify({nome}));const r=http.request({host:'127.0.0.1',port:porta,method:'POST',path:'/postos/parear',
  headers:{'Content-Type':'application/json','Content-Length':d.length,'X-Eterna':'1',Host:'127.0.0.1:'+porta,Cookie:cookie}},rs=>{rs.resume();rs.on('end',()=>{const sc=(rs.headers['set-cookie']||[])[0]||'';rs.statusCode===200?res(sc.split(';')[0]):rej(new Error('parear '+rs.statusCode));});});r.on('error',rej);r.end(d);});}
module.exports={sessao,posto,noNavegador,parear};
