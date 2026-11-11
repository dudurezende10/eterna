// v96 (Testador, 10/11): critérios do Checkout em tela cheia com os prazos de verdade (relógio do Playwright, sem mexer nas constantes):
// câmera 60 s sem rosto e teto de 3 min desde o Iniciar (só rosto renova); escolha parada 90 s volta ao Iniciar e apaga marcas (toque renova);
// tela Pronto e do valor paradas 3 min voltam; tela final do QR com "Valor pago" e "Voltamos ao início em 40" que volta sozinha.
// Também: "Voltar às fotos" inativo depois que o caixa escolheu só o pacote; textos ao cliente sem "caixa" e sem travessão em 5 línguas;
// cliques repetidos no Continuar fazem um pedido só; nada rola nem sai da tela em 1920, 1366, 1536×730 e 390 nas telas do cliente.
const {chromium}=require('playwright');const fs=require('fs');const net=require('net');const path=require('path');const {spawn}=require('child_process');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SHOTS=process.env.SHOTS||path.join(__dirname,'prints');fs.mkdirSync(SHOTS,{recursive:true});
const portaUsada=p=>new Promise(r=>{const s=net.createServer();s.once('error',()=>r(true));s.listen(p,'127.0.0.1',()=>s.close(()=>r(false)));});
const fails=[],errs=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m);};const J=JSON.stringify;
const LINGUAS=['pt','en','es','fr','de'];
const PROIBIDO=/caixa|cashier|\bcaja\b|caisse|Kasse|—/i;
(async()=>{let srv=null;let U=process.env.U;
if(!U){let p=33000+Math.floor(Math.random()*900);while(await portaUsada(p))p++;srv=spawn('python3',['-m','http.server',String(p),'--bind','127.0.0.1'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});await sleep(800);U=`http://127.0.0.1:${p}/index.html`;process.env.U=U;}
const login=require('./_login');
const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
  const ctx=await b.newContext({locale:'pt-BR',permissions:['camera']});await ctx.clock.install();
  const L=await ctx.newPage();await L.setViewportSize({width:1920,height:1080});L.on('pageerror',e=>errs.push('checkout: '+e.message));
  await L.goto(U+'#loja');await L.evaluate(()=>localStorage.removeItem('eterna.sim.v1'));await L.reload();await L.waitForTimeout(800);
  const V=await ctx.newPage();await V.setViewportSize({width:1366,height:768});V.on('pageerror',e=>errs.push('posto: '+e.message));await login(V);await V.evaluate(()=>ETERNA.go('posto'));await V.waitForTimeout(300);
  const cards=await L.evaluate(()=>ETERNA.demoSessions().filter(s=>s.photos.length>=6).map(s=>s.card));
  const st=()=>L.evaluate(()=>{const k=ETERNA.state.kiosk;return {step:k.step,code:k.code,camOn:!!k.camOn,stream:!!ETERNA.state.cam.stream,ini:!!document.querySelector('[data-act="kiosk-start"]')};});
  const ff=async ms=>{await L.clock.fastForward(ms);await L.waitForTimeout(120);};
  const abrir=async card=>{await L.evaluate(()=>{ETERNA.lojaReset();ETERNA.render();});await L.click('[data-act="kiosk-emerg"]');await L.fill('#kcode',card);await L.click('[data-act="kiosk-go"]');
    for(let i=0;i<30&&(await st()).step!=='review';i++)await sleep(100);};
  const pend=()=>L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.pend);
  const rec=id=>L.evaluate(id=>JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin.find(x=>x.id===id),id);
  const marcas=c=>L.evaluate(c=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')).sessions[c]||{};return Object.keys(s.pick||{}).length+(s.selected||[]).length;},c);
  const txt=()=>L.evaluate(()=>(document.querySelector('.lj')||document.body).innerText);
  const textos=[];const guarda=async(tela)=>{for(const l of LINGUAS){await L.evaluate(l=>{ETERNA.state.lang=l;ETERNA.render();},l);textos.push([tela,l,await txt()]);}await L.evaluate(()=>{ETERNA.state.lang='pt';ETERNA.render();});};
  // medição de uma tela: sem rolagem, nada fora da tela
  const medir=()=>L.evaluate(()=>{const W=innerWidth,H=innerHeight,d=document.documentElement;const fora=[];
    const rolaY=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)&&p.scrollHeight>p.clientHeight+1)return true;}return false;};
    document.querySelectorAll('.lj button,.lj a').forEach(e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none')return;
      if(r.left<-1||r.right>W+1||(!rolaY(e)&&(r.top<-1||r.bottom>H+1)))fora.push((e.dataset.act||e.className)+' '+Math.round(r.left)+','+Math.round(r.top)+'..'+Math.round(r.right)+','+Math.round(r.bottom));});
    const rolam=[];document.querySelectorAll('.lj *').forEach(e=>{const s=getComputedStyle(e);if(/auto|scroll/.test(s.overflowY)&&e.scrollHeight>e.clientHeight+1&&e.getBoundingClientRect().height>0)rolam.push(e.className+' '+e.scrollHeight+'>'+e.clientHeight);});
    return {x:d.scrollWidth>W||document.body.scrollWidth>W,y:d.scrollHeight>H+1||document.body.scrollHeight>H+1,fora,rolam};});
  const TAM=[[1920,1080],[1366,768],[1536,730],[390,844]];
  const fotografa=async(tela,rolagemOk)=>{for(const [w,h] of TAM){await L.setViewportSize({width:w,height:h});await L.waitForTimeout(200);await L.screenshot({path:`${SHOTS}/v96-final-${tela}-${w}x${h}.png`});
      const m=await medir();ok(!m.x&&(rolagemOk||(!m.y&&!m.rolam.length))&&!m.fora.length,`${tela} ${w}×${h}: sem rolagem e nada fora da tela: `+J(m));}
    await L.setViewportSize({width:1920,height:1080});await L.waitForTimeout(150);};

  // ---- 1. Iniciar liga a câmera; 60 s sem rosto desliga; só rosto renova; teto de 3 min desde o Iniciar
  let s=await st();ok(s.ini&&!s.stream&&!s.camOn,'1: tela inicial com a câmera desligada: '+J(s));
  await fotografa('inicio');await guarda('inicio');
  await L.click('[data-act="kiosk-start"]');for(let i=0;i<30&&!(await st()).stream;i++)await sleep(100);s=await st();ok(s.stream&&s.camOn,'1: Iniciar liga a câmera: '+J(s));
  await fotografa('camera');await guarda('camera');
  await L.mouse.move(300,300);await L.mouse.move(900,600);await ff(55000);s=await st();ok(s.stream,'1: aos 55 s sem rosto a câmera segue ligada: '+J(s));
  await ff(7000);s=await st();ok(!s.stream&&!s.camOn&&s.ini,'1: 60 s sem rosto (movimento não conta) desliga e volta ao Iniciar: '+J(s));
  await L.click('[data-act="kiosk-start"]');for(let i=0;i<30&&!(await st()).stream;i++)await sleep(100);
  for(let t=0;t<3;t++){await ff(50000);await L.evaluate(()=>{ETERNA.state.kiosk.camRosto=Date.now();});}
  s=await st();ok(s.stream&&s.camOn,'1: com rosto a cada 50 s a câmera segue ligada aos 150 s: '+J(s));
  await ff(25000);await L.evaluate(()=>{ETERNA.state.kiosk.camRosto=Date.now();});s=await st();ok(s.stream,'1: aos 175 s ainda ligada: '+J(s));
  await ff(8000);s=await st();ok(!s.stream&&!s.camOn&&s.ini,'1: teto de 3 min desde o Iniciar desliga mesmo com rosto: '+J(s));

  // ---- escolha: prints, textos, Sair
  const c1=cards[0],c2=cards[1]||cards[0],c3=cards[2]||cards[0],c4=cards[3]||cards[1];
  await abrir(c1);ok((await st()).step==='review','abre a escolha pelo código');s=await st();ok(!s.stream,'1: na escolha a câmera fica desligada');
  await fotografa('escolha');await guarda('escolha');
  {const ctl=await L.evaluate(()=>[...document.querySelectorAll('#lj-lb button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.dataset.act).sort());
    ok(J(ctl)===J(['kiosk-fechar','kiosk-no','kiosk-ok','kiosk-sair','kiosk-ver','kiosk-ver','lj-lg']),'1: na foto só setas (kiosk-ver), ✗, ✓, bandeira, Sair e Ver todas: '+J(ctl));}
  {const nb=await L.evaluate(()=>({logo:!!document.querySelector('#lj-lb .lj-ovlogo,#lj-lb img[alt*="logo" i],#lj-lb .lj-logo,#lj-lb [class*="logo"]'),cnt:/^\s*1 \/ \d+\s*$/.test((document.querySelector('#lj-lb .lj-lbcnt,#lj-lb .lj-count')||{}).innerText||'')}));ok(nb.logo&&nb.cnt,'1: logo pequeno e contador na foto: '+J(nb));}
  await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(100);await fotografa('escolha-marcada');
  await L.click('#lj-lb [data-act="kiosk-sair"]');await L.waitForTimeout(150);await fotografa('sair-pergunta');await guarda('sair-pergunta');
  await L.keyboard.press('Escape');await L.waitForTimeout(150);s=await st();ok(s.step==='review'&&!(await L.$('.lj-ask'))&&await marcas(c1)>0,'2: Esc na pergunta do Sair continua escolhendo com as marcas: '+J(s));
  await L.click('#lj-lb [data-act="kiosk-fechar"]');await L.waitForTimeout(150);await fotografa('ver-todas',true);await guarda('ver-todas');
  // ---- 3. escolha parada 90 s (relógio real): 85 s fica; toque renova; 90 s sem toque volta e apaga
  await L.click('[data-act="kiosk-ver"][data-i="0"]').catch(()=>{});await L.waitForTimeout(100);
  await ff(60000);s=await st();ok(s.step==='review','3: aos 60 s parada a escolha continua');
  await L.mouse.click(5,540);await ff(60000);s=await st();ok(s.step==='review'&&await marcas(c1)>0,'3: um toque aos 60 s renova o prazo (120 s depois de abrir ainda na escolha): '+J(s));
  await ff(35000);s=await st();ok(s.step==='code'&&s.ini&&!s.code,'3: 90 s sem toque volta ao Iniciar: '+J(s));ok(await marcas(c1)===0,'3: e apaga as marcas');

  // ---- 4. Continuar · N fotos (com clique duplo) → Pronto → caixa escolhe só o pacote → Voltar às fotos inativo → meio → confirma → QR
  await abrir(c2);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(60);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.waitForTimeout(60);
  ok(/Continuar · 2 fotos/.test(await L.textContent('#lj-lb .lj-next')),'4: "Continuar · 2 fotos"');
  const nAntes=await L.evaluate(()=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).length);
  await L.dblclick('#lj-lb .lj-next').catch(()=>{});await L.click('#lj-lb .lj-next',{timeout:300}).catch(()=>{});await L.waitForTimeout(500);
  const nDep=await L.evaluate(()=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).filter(x=>x.estado==='escolha').length);
  ok(nDep===1&&(await L.evaluate(()=>(JSON.parse(localStorage.getItem('eterna.sim.v1')).caixaDin||[]).length))===nAntes+1,'clique repetido no Continuar faz um pedido só: '+J({nAntes,nDep}));
  const id1=await pend();let t=await txt();
  ok(/Pronto!/i.test(t)&&/O atendente vai finalizar sua compra/.test(t)&&/Voltar às fotos/.test(t)&&!/Voltar ao início/i.test(t)&&!(await L.$('.lj-pronto .lj-restart')),'4: tela Pronto com código e Voltar às fotos, sem Voltar ao início (v97: a espera do pagamento não tem saída para o início): '+t.replace(/\s+/g,' ').slice(0,200));
  ok(t.includes((await rec(id1)).codigo||'@@'),'4: tela Pronto mostra o código do pedido');
  await fotografa('pronto');await guarda('pronto');
  const r0=await rec(id1);ok(r0.estado==='escolha'&&r0.total==null,'6: pedido sem pacote nasce em escolha: '+J({e:r0.estado,t:r0.total}));
  const ideal=await V.evaluate(()=>ETERNA.lojaIdeal(2).pkg);
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.waitForTimeout(150);
  await V.click(`[data-pend="${id1}"] [data-act="pend-pkg"][data-p="${ideal}"]`);for(let i=0;i<30;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.total!=null))break;await sleep(100);}
  t=await txt();const vf=await L.evaluate(()=>{const e=document.querySelector('[data-act="kiosk-voltar-fotos"]');return e?{dis:e.disabled}:null;});
  ok(!vf||vf.dis,'4: "Voltar às fotos" inativo depois que o caixa escolheu só o pacote: '+J(vf));
  await L.evaluate(()=>ETERNA.lojaVoltarFotos());await L.waitForTimeout(100);ok((await st()).step==='done'&&(await rec(id1)).estado==='escolha','4: lojaVoltarFotos recusado depois do pacote');
  ok(/Valor a pagar/.test(t)&&/R\$/.test(t)&&/2 fotos/.test(t)&&/O atendente vai informar a forma de pagamento/.test(t)&&/Ver minhas fotos/.test(t),'4: tela do valor: '+t.replace(/\s+/g,' ').slice(0,200));
  await fotografa('valor');await guarda('valor');
  await L.click('[data-act="kiosk-minhas"]');await L.waitForTimeout(150);ok(await L.evaluate(()=>document.querySelectorAll('.lj-minhas .lj-mth').length)===2,'4: Ver minhas fotos com 2 miniaturas');
  await fotografa('minhas');await guarda('minhas');await L.click('[data-act="kiosk-minhas-x"]');await L.waitForTimeout(100);
  for(const [m,re] of [['cartao',/maquininha/],['pix',/PIX|Pix/],['dinheiro',/dinheiro/]]){await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});await V.click(`[data-pend="${id1}"] [data-act="pend-meio"][data-m="${m}"]`);
    for(let i=0;i<30;i++){if(await L.evaluate(m=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.meio===m,m))break;await sleep(100);}ok(re.test(await txt()),'4: frase do meio '+m+': '+(await txt()).replace(/\s+/g,' ').slice(0,160));await guarda('valor-'+m);}
  await V.screenshot({path:`${SHOTS}/v96-final-posto-1366x768.png`});
  await V.evaluate(id=>{ETERNA.simFresh();ETERNA.render();return ETERNA.pendConfirmar(id,{ref:''});},id1);
  for(let i=0;i<30;i++){if(await L.evaluate(()=>!!document.querySelector('#lqr canvas,#lqr img')))break;await sleep(100);}
  t=await txt();ok(/Valor pago R\$/.test(t)&&/Voltamos ao início em\s*(40|39)/.test(t),'4: tela final com "Valor pago" e "Voltamos ao início em 40": '+t.replace(/\s+/g,' ').slice(0,240));
  await fotografa('final');await guarda('final');
  await ff(30000);s=await st();ok(s.step==='done','4: aos 30 s a tela final continua');
  await ff(12000);s=await st();ok(s.step==='code'&&s.ini,'4: aos 40 s a tela final volta sozinha ao Iniciar: '+J(s));

  // ---- 4. tela Pronto parada 3 min volta (relógio real); a do valor também; Posto vê "o cliente saiu"
  await abrir(c3);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(400);const id2=await pend();
  await ff(170000);s=await st();ok(s.step==='done','4: tela Pronto aos 170 s continua');
  await ff(15000);s=await st();let r2=await rec(id2);ok(s.step==='code'&&r2.estado==='escolha'&&!!r2.saiu,'4: tela Pronto parada 3 min volta ao início e marca "o cliente saiu": '+J({s,e:r2.estado,saiu:r2.saiu}));
  await V.evaluate(()=>{ETERNA.simFresh();ETERNA.render();});ok(await V.evaluate(id=>/saiu/.test((document.querySelector(`[data-pend="${id}"]`)||{}).innerText||''),id2),'4: o Posto mostra que o cliente saiu');
  await V.evaluate(id=>ETERNA.dinCancelar(id),id2);
  await abrir(c4);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(400);const id3=await pend();
  await V.evaluate(([id,p])=>{ETERNA.simFresh();ETERNA.render();return ETERNA.pendEscolher(id,{pkg:p});},[id3,ideal]);for(let i=0;i<30;i++){if(await L.evaluate(()=>ETERNA.state.kiosk.paid&&ETERNA.state.kiosk.paid.total!=null))break;await sleep(100);}
  await ff(185000);s=await st();r2=await rec(id3);ok(s.step==='code'&&!!r2.saiu,'4: tela do valor parada 3 min volta ao início e marca "o cliente saiu": '+J({s,saiu:r2.saiu}));
  await V.evaluate(id=>ETERNA.dinCancelar(id),id3);

  // ---- 3. escolha com pedido aberto (cliente voltou pelo código depois de sair) parada 90 s: volta e o Posto vê "o cliente saiu"
  await abrir(c4);await L.click('#lj-lb [data-act="kiosk-ok"]');await L.click('#lj-lb .lj-next');await L.waitForTimeout(400);const id4=await pend();
  await L.waitForTimeout(150); // v97: a tela Pronto não tem mais "Voltar ao início"; o abrir() abaixo recomeça o Checkout
  await L.evaluate(id=>{const S=JSON.parse(localStorage.getItem('eterna.sim.v1'));const r=S.caixaDin.find(x=>x.id===id);delete r.saiu;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));ETERNA.simFresh();},id4);
  await abrir(c4);s=await st();const aberto=(await rec(id4)).estado;
  if(s.step==='review'||s.step==='talvez'||s.step==='gallery'){await ff(95000);s=await st();r2=await rec(id4);ok(s.step==='code'&&!!r2.saiu,'3: com pedido aberto a escolha parada 90 s volta e o Posto vê "o cliente saiu": '+J({s,aberto,e:r2.estado,saiu:r2.saiu}));}
  else ok(false,'3: com pedido aberto o código deveria abrir a escolha: '+J({s,aberto}));
  await V.evaluate(id=>{ETERNA.simFresh();if(ETERNA.SIM.caixaDin.find(x=>x.id===id&&x.estado==='escolha'))ETERNA.dinCancelar(id);},id4);

  // ---- 5. textos ao cliente: sem "caixa" e sem travessão, em 5 línguas
  const ruins=textos.filter(([,,x])=>PROIBIDO.test(x)).map(([tela,l,x])=>tela+'/'+l+': '+(x.match(new RegExp('.{0,30}('+PROIBIDO.source+').{0,30}','i'))||[''])[0].replace(/\s+/g,' '));
  ok(!ruins.length,'5: textos ao cliente sem "caixa" nem travessão: '+ruins.slice(0,6).join(' | '));
  const chaves=await L.evaluate(()=>{const h=document.documentElement.outerHTML;return null;});
  {const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const ini=src.indexOf('const I18N={');const bloco=src.slice(ini,src.indexOf('\n};',ini));
    const lj=bloco.split('\n').filter(l=>/^\s*(lj\w*):/.test(l)&&PROIBIDO.test(l.replace(/^\s*\w+:/,'')));ok(!lj.length,'5: nenhuma frase lj* do I18N (Checkout) com "caixa" ou travessão: '+lj.map(x=>x.trim().slice(0,90)).join(' | '));}
}catch(e){fails.push('erro: '+e.message.split('\n')[0]);}
await b.close();if(srv)srv.kill();
const bom=!fails.length&&!errs.length;console.log(`${bom?'OK':'FALHA'} v96-testador: ${n} verificações com o relógio de verdade (câmera 60 s e 3 min, escolha 90 s, Pronto e valor 3 min, QR 40 s), telas em 4 tamanhos e 5 línguas${fails.length?' · '+fails.slice(0,12).join(' | '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(bom?0:1);})();
