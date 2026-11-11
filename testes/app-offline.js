// v97: o Checkout abre sem internet com as fontes da marca. Uma origem local (esta pasta) entrega o app ao agente, o agente
// guarda tudo em disco, a origem cai, o agente reinicia e o navegador abre o Checkout pelo agente com toda requisição
// externa bloqueada. document.fonts precisa ter 'Big Shoulders Display' e 'Inter' com status loaded.
const {chromium}=require('playwright');const {spawn}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const http=require('http');
const RAIZ=path.join(__dirname,'..');const AG=path.join(RAIZ,'agente','eterna-agente.py');
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// portas 46600 a 46899 (o app_offline_agente.py usa 46000 a 46599); confere se estão livres (outras sessões de teste)
const livre=p=>new Promise(r=>{const s=require('net').createServer();s.once('error',()=>r(false));s.listen(p,'127.0.0.1',()=>s.close(()=>r(true)));});
let P,OP,FP;
const TIPOS={'.html':'text/html','.js':'application/javascript','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.wasm':'application/wasm'};
function origem(){return new Promise(res=>{const s=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(RAIZ,u==='/'?'index.html':u);
  if(!f.startsWith(RAIZ+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){r.writeHead(404);return r.end();}
  r.writeHead(200,{'Content-Type':TIPOS[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});s.listen(OP,'127.0.0.1',()=>res(s));});}
const get=p=>new Promise(res=>{const r=http.get({host:'127.0.0.1',port:P,path:p},rs=>{const c=[];rs.on('data',x=>c.push(x));rs.on('end',()=>res({s:rs.statusCode,b:Buffer.concat(c)}));});r.on('error',()=>res({s:0,b:Buffer.alloc(0)}));});
function subir(H){const p=spawn('python3',['-I',AG],{env:{...process.env,HOME:H,USERPROFILE:H,ETERNA_PORTA:String(P),ETERNA_FTP_PORTA:String(FP),ETERNA_APP_ORIGIN:'http://127.0.0.1:'+OP,ETERNA_SEM_OPENCV:'1',USER:'eterna-teste-sem-cartao',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'},stdio:['ignore','pipe','pipe']});
  p.log='';p.stdout.on('data',d=>p.log+=d);p.stderr.on('data',d=>p.log+=d);return p;}
const parar=p=>new Promise(r=>{if(!p||p.exitCode!==null)return r();p.on('exit',r);p.kill();});
async function status(){const r=await get('/status');try{return r.s===200?JSON.parse(r.b):{}}catch(e){return {}}}
(async()=>{
for(let i=0;i<50;i++){P=46600+Math.floor(Math.random()*100);OP=P+100;FP=P+200;if(await livre(P)&&await livre(OP)&&await livre(FP))break;}
const H=fs.mkdtempSync(path.join(os.tmpdir(),'app-offline-'));let ag=null,srv=null,b=null;
try{
  srv=await origem();ag=subir(H);
  let st={};for(let i=0;i<240&&st.app_offline_pronto!==true;i++){await sleep(250);st=await status();}
  ok(st.app_offline_pronto===true,'pré-aquecimento: app_offline_pronto não virou true: '+JSON.stringify(st.app_offline_pronto)+' '+ag.log.slice(-300));
  await parar(ag);ag=null;await new Promise(r=>srv.close(r));srv=null;
  ag=subir(H);for(let i=0;i<80&&(await get('/status')).s!==200;i++)await sleep(250);
  st=await status();ok(st.app_offline_pronto===true,'sem origem: app_offline_pronto deveria seguir true');
  b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});
  const fora=[],ruins=[],errs=[];const BASE='http://127.0.0.1:'+P;
  await ctx.route('**/*',r=>{const u=r.request().url();if(u.startsWith(BASE+'/'))return r.continue();fora.push(u);return r.abort();});
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));
  pg.on('response',r=>{if(r.status()>=400&&/\/(vendor|img)\//.test(r.url()))ruins.push(r.status()+' '+r.url());});
  await pg.goto(BASE+'/#loja');await pg.waitForTimeout(1200);
  const f=await pg.evaluate(async()=>{await document.fonts.load('800 40px "Big Shoulders Display"');await document.fonts.load('400 16px Inter');await document.fonts.ready;
    const l=[];document.fonts.forEach(x=>l.push({f:x.family.replace(/["']/g,''),w:x.weight,s:x.status}));
    return {l,ck:!!document.querySelector('.lj'),h:(document.querySelector('.lj-h1,.lj-h2')&&getComputedStyle(document.querySelector('.lj-h1,.lj-h2')).fontFamily)||''};});
  ok(f.ck,'Checkout não abriu pelo agente sem origem');
  ok(f.l.some(x=>x.f==='Big Shoulders Display'&&x.s==='loaded'),'Big Shoulders Display sem status loaded: '+JSON.stringify(f.l));
  ok(f.l.some(x=>x.f==='Inter'&&x.s==='loaded'),'Inter sem status loaded: '+JSON.stringify(f.l));
  ok(!f.l.some(x=>(x.f==='Big Shoulders Display'||x.f==='Inter')&&x.s==='error'),'fonte com status error: '+JSON.stringify(f.l.filter(x=>x.s==='error')));
  ok(/^"?Big Shoulders Display/.test(f.h),'título do Checkout em Big Shoulders: '+f.h);
  ok(!ruins.length,'arquivos do app com erro sem origem: '+ruins.join(' '));
  ok(!fora.some(u=>/fonts\.(googleapis|gstatic)\.com/.test(u)),'pedido de fonte externa: '+fora.join(' '));
  const html=fs.readFileSync(path.join(RAIZ,'index.html'),'utf8').split('\n').filter(l=>!/font-lolla/.test(l)).join('\n');   // a linha do Lollapalooza (teste antigo) fica de fora
  ok(!/fonts\.googleapis|gstatic/.test(html),'index.html ainda cita fonts.googleapis ou gstatic fora da linha do font-lolla');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+(e.stack||e));}
finally{if(b)await b.close();await parar(ag);if(srv)srv.close();try{fs.rmSync(H,{recursive:true,force:true})}catch(e){}}
if(fails.length){console.log('FALHA app-offline: '+fails.join(' || '));process.exit(1);}
console.log('OK app-offline: Checkout sem internet pelo agente reiniciado, Big Shoulders Display e Inter loaded');process.exit(0);
})();
