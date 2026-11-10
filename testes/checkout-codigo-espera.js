// Checkout: código de uma sessão que a aba já conhece, mas cujas fotos ainda não carregaram (aba recém-aberta, antes do
// primeiro /sessoes), espera a foto chegar e abre; código desconhecido continua avisando na hora; sessão que nunca carrega avisa.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);return !!c;};
const espera=async(pg,fn,ms,arg)=>{const t0=Date.now();while(Date.now()-t0<(ms||10000)){if(await pg.evaluate(fn,arg).catch(()=>false))return true;await pg.waitForTimeout(100);}return false;};
const MINI='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
(async()=>{
const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:800}});const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U+'#loja');await pg.waitForTimeout(500);
  // aba ligada a um agente (endereço que não responde) e duas sessões no SIM com fotos que esta aba ainda não carregou
  await pg.evaluate(()=>{const a=ETERNA.state.agent;a.url='http://127.0.0.1:9';a.sessoes={gen:'t',rev:1,dias:1};
    const S=ETERNA.SIM.sessions;const base={key:null,pdv:'',time:'10:00',date:'hoje',status:'fechada',selected:[],bg:null,cart:[]};
    S.LPESPER01=Object.assign({},base,{photos:[{id:'ag_esp000000001'},{id:'ag_esp000000002'}]});
    S.LPNUNCA02=Object.assign({},base,{photos:[{id:'ag_nun000000001'}]});ETERNA.lojaCodReset();});
  const abreCod=async c=>{await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});await pg.fill('#kcode',c);
    const t0=Date.now();await pg.click('[data-act="kiosk-go"]');return t0;};
  const toast=()=>pg.evaluate(()=>(document.querySelector('#toast')||{}).textContent||'');
  // 1) fotos chegam 800 ms depois do código: abre as fotos, sem "Código não encontrado"
  await abreCod('lpesper01');
  await pg.waitForTimeout(800);
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step==='emerg'),'enquanto espera as fotos, continua na tela do código');
  await pg.evaluate(m=>{ETERNA.UP.ag_esp000000001={src:m,name:'a'};ETERNA.UP.ag_esp000000002={src:m,name:'b'};},MINI);
  ok(await espera(pg,()=>ETERNA.state.kiosk.step==='review'&&ETERNA.state.kiosk.code==='LPESPER01',4000),'código da sessão com fotos chegando abre as fotos: '+await pg.evaluate(()=>ETERNA.state.kiosk.step)+' '+await toast());
  ok(!/não encontrado/i.test(await toast()),'sem aviso de código não encontrado: '+await toast());
  ok(await pg.evaluate(()=>ETERNA.LJ_COD.erros)===0,'nenhuma tentativa errada contada');
  // 2) código que esta aba não conhece: aviso na hora, como antes
  await abreCod('LPXXXXX99');
  ok(/não encontrado/i.test(await toast())&&await pg.evaluate(()=>ETERNA.LJ_COD.erros)===1,'código desconhecido avisa na hora: '+await toast());
  // 3) sessão conhecida cujas fotos nunca chegam: depois da espera (até 4 s) avisa e conta a tentativa
  await pg.evaluate(()=>{ETERNA.lojaCodReset();const t=document.querySelector('#toast');if(t)t.textContent='';});
  const t0=await abreCod('LPNUNCA02');
  ok(await espera(pg,()=>/não encontrado/i.test((document.querySelector('#toast')||{}).textContent||''),6000),'sessão sem foto avisa depois da espera');
  const dt=Date.now()-t0;ok(dt>=3500&&dt<6500,'espera de até 4 s: '+dt+' ms');
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step==='emerg'&&ETERNA.LJ_COD.erros===1),'continua na tela do código e conta 1 tentativa');
  // 4) clique repetido durante a espera não conta duas tentativas
  await pg.evaluate(()=>{ETERNA.lojaCodReset();});
  await abreCod('LPNUNCA02');await pg.click('[data-act="kiosk-go"]');await pg.click('[data-act="kiosk-go"]');
  await pg.waitForTimeout(5000);
  ok(await pg.evaluate(()=>ETERNA.LJ_COD.erros)===1,'cliques repetidos durante a espera contam 1 tentativa: '+await pg.evaluate(()=>ETERNA.LJ_COD.erros));
  // 5) tela volta ao início durante a espera e outro cliente abre o campo de código: a sessão do anterior não abre
  await pg.evaluate(()=>{ETERNA.lojaCodReset();const S=ETERNA.SIM.sessions;S.LPVOLTA03=Object.assign({},S.LPNUNCA02,{photos:[{id:'ag_vol000000001'}]});});
  await abreCod('LPVOLTA03');await pg.waitForTimeout(300);
  await pg.evaluate(()=>{ETERNA.lojaReset();ETERNA.state.kiosk.step='emerg';ETERNA.render();});
  await pg.evaluate(m=>{ETERNA.UP.ag_vol000000001={src:m,name:'c'};},MINI);
  await pg.waitForTimeout(1500);
  ok(await pg.evaluate(()=>ETERNA.state.kiosk.step==='emerg'&&!ETERNA.state.kiosk.code),'espera do cliente anterior não abre a sessão depois do reset: '+await pg.evaluate(()=>ETERNA.state.kiosk.step+' '+ETERNA.state.kiosk.code));
  // 6) todas as fotos da sessão descartadas ou recusadas: responde na hora, sem esperar
  const naHora=async(c,prep,msg)=>{await pg.evaluate(prep);await pg.evaluate(()=>{ETERNA.lojaCodReset();const t=document.querySelector('#toast');if(t)t.textContent='';});
    const t0=await abreCod(c);const foi=await espera(pg,()=>/não encontrado/i.test((document.querySelector('#toast')||{}).textContent||''),3000);const dt=Date.now()-t0;
    ok(foi&&dt<1000&&await pg.evaluate(()=>!ETERNA.state.kiosk.codEsp),msg+': '+dt+' ms '+await toast());};
  await naHora('LPDESC06',()=>{const S=ETERNA.SIM.sessions;S.LPDESC06=Object.assign({},S.LPNUNCA02,{photos:[{id:'ag_des000000001'},{id:'ag_des000000002'}]});
    ETERNA.SIM.discarded.ag_des000000001=true;ETERNA.SIM.invalid=ETERNA.SIM.invalid||{};ETERNA.SIM.invalid.ag_des000000002='teste';},'sessão com todas as fotos descartadas ou recusadas avisa na hora');
  // 7) sessão de dias que o Checkout não mostra mais: responde na hora
  await naHora('LPVENC07',()=>{const S=ETERNA.SIM.sessions;S.LPVENC07=Object.assign({},S.LPNUNCA02,{photos:[{id:'ag_ven000000001'}],closedAt:new Date(Date.now()-3*86400e3).toISOString()});},'sessão vencida avisa na hora');
  // 8) erro no caminho da espera (sessão do servidor com dado quebrado): a espera acaba, sem travar o botão
  await naHora('LPERRO08',()=>{ETERNA.SRV.mat.LPERRO08={card:'LPERRO08',get fotos(){throw new Error('teste');}};},'erro durante a espera encerra a espera');
  ok(!errs.length,'erros de página: '+errs.join(' | '));
}catch(e){fails.push('exceção: '+e.message);}
await b.close();
console.log((fails.length?'FALHA':'OK')+' checkout-codigo-espera: código de sessão com fotos ainda carregando abre depois que a foto chega'+(fails.length?' · '+fails.join(' | '):''));
process.exit(fails.length?1:0);
})();
