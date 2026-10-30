// v86: 5º fundo de IA aprovado direto, Pódio de campeão (regra 14). Ativo por padrão, migração da escolha salva (uma vez só),
// FIA_REGRAS.podio com o grupo à esquerda da taça do fundo (borda direita até ~0,76), fileHi de 5000 px e mapa de fundos do agente.
// Recortes: formas desenhadas aqui (sem pessoa); nenhuma foto de convidado.
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const login=require('./_login.js');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;const RAIZ=path.join(__dirname,'..');
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;const near=(a,b,t)=>Math.abs(a-b)<=t;
(async()=>{let b=null;const H=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v86-'));
try{
  // recortes sintéticos 3000×2000: meio corpo (encosta embaixo), corpo inteiro (estreito) e grupo largo (6 pessoas)
  execFileSync('python3',['-c',`
import sys
from PIL import Image,ImageDraw
def novo(): return Image.new('RGBA',(3000,2000),(0,0,0,0))
im=novo();d=ImageDraw.Draw(im);d.ellipse([1300,300,1700,700],fill=(220,180,150,255));d.rectangle([1100,700,1900,1999],fill=(30,120,30,255));im.save(sys.argv[1]+'/meio.png')
im=novo();d=ImageDraw.Draw(im);d.ellipse([1400,200,1600,400],fill=(220,180,150,255));d.rectangle([1350,400,1650,1850],fill=(30,30,200,255));im.save(sys.argv[1]+'/inteiro.png')
im=novo();d=ImageDraw.Draw(im)
for i in range(6):
    x=200+i*450;d.ellipse([x+60,600,x+260,800],fill=(220,180,150,255));d.rectangle([x,800,x+320,1850],fill=(30,30,200,255))
im.save(sys.argv[1]+'/largo.png')
im=novo();d=ImageDraw.Draw(im)
for i in range(6):
    x=100+i*480;d.ellipse([x+60,500,x+260,700],fill=(220,180,150,255));d.rectangle([x,700,x+320,1999],fill=(30,30,200,255))
im.save(sys.argv[1]+'/largomeio.png')
`,H]);
  const CUT={a86000000001:'meio',a86000000002:'inteiro',a86000000003:'largo',a86000000004:'largomeio'};
  b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1440,height:900}});
  await ctx.route(ORIG+'/recorte',r=>{let q={};try{q=JSON.parse(r.request().postData()||'{}');}catch(e){}const n=CUT[q.pid];
    if(!n)return r.fulfill({status:404,contentType:'application/json',body:'{}'});r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(H,n+'.png'))});});
  const pg=await ctx.newPage();pg.setDefaultTimeout(15000);pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await pg.reload();await pg.waitForTimeout(400);

  // ---------- 1. dados do fundo e ativo por padrão ----------
  const d=await pg.evaluate(()=>{const b=ETERNA.bgOf('podio');return b&&{name:b.name,file:b.file,fileHi:b.fileHi,ang:b.ang,luz:b.luz,dir:b.dir,mono:b.mono,fit:b.fit,pos:b.pos,inativo:!!b.inativo,ativo:ETERNA.bgAtivo(b),
    on:ETERNA.bgOn(),opts:ETERNA.bgOpts().map(o=>o.id),ai:ETERNA.aiBgs().map(x=>x.id),regra:ETERNA.FIA_REGRAS.podio,flag:ETERNA.SIM.bgPodioV86};});
  ok(d&&d.name==='Pódio de campeão'&&d.file==='img/bg-podio.jpg'&&d.fileHi==='img/fundos-5k/podio.jpg'&&d.ang==='baixo'&&d.luz==='sol'&&d.dir==='frontal'&&d.mono===false&&J(d.fit)===J(['meio','close','inteiro'])&&!d.inativo&&d.ativo,'1: DATA.backgrounds podio: '+J(d));
  ok(d&&J(d.on)===J(['campeao','mirante','arq1950','tunel','podio'])&&d.opts.includes('podio')&&d.ai.includes('podio')&&d.ai.length===5,'1: pódio ativo por padrão, 5 no Checkout: '+J(d&&{on:d.on,ai:d.ai}));
  ok(d&&J(d.regra)===J({meio:{corte:1,alt:.8,larg:.62,cx:.45},inteiro:{corte:.62,alt:.8,larg:.62,cx:.45}}),'1: FIA_REGRAS.podio (regra 14): '+J(d&&d.regra));
  // Photoroom (bgPad): a área do grupo também não passa de 0,76 da largura
  const pad=await pg.evaluate(()=>{const p=ETERNA.bgPad(ETERNA.bgOf('podio'),2400,1600),t=ETERNA.bgPad(ETERNA.bgOf('tunel'),2400,1600);return {p,dir:(2400-p.right)/2400,tl:t.left,tr:t.right};});
  ok(pad.dir<=.761&&near(pad.p.top,.2*1600,1)&&pad.p.bottom===0&&near(pad.tl,60,1)&&near(pad.tr,60,1),'1: bgPad do pódio sem invadir a taça (túnel igual a antes): '+J(pad));

  // ---------- 2. montagem: grupo encostado embaixo, à esquerda da taça ----------
  const mont=(id,hi)=>pg.evaluate(async([id,hi])=>{const r=await ETERNA.fiaMontar(id,'podio',hi?{hi:true}:{});const L=r.layout;if(!L)return r;return {w:r.w||(hi?null:0),h:r.h,modo:L.modo,corte:L.corte,dst:L.dst,W:r.canvas?r.canvas.width:null,H:r.canvas?r.canvas.height:null,fonte:r.fonte,av:r.avisos,url:(r.url||'').slice(0,23)};},[id,hi]);
  for(const [id,nome] of Object.entries(CUT)){const m=await mont('ag_'+id);const W=m.W,Hh=m.H;const dir=(m.dst.x+m.dst.w)/W,cx=(m.dst.x+m.dst.w/2)/W;
    ok(W===2400&&Hh===1600,'2 '+nome+': prévia com o fundo de 2400 px: '+J(m));
    ok(dir<=.77,'2 '+nome+': borda direita do grupo passa de 0,77 (cobre a taça): '+J({dir,dst:m.dst}));
    ok(near(m.dst.y+m.dst.h,Hh,1)&&m.dst.h<=.8*Hh+1&&m.dst.w<=.62*W+1&&m.dst.x>=0,'2 '+nome+': encostado embaixo, até 80% da altura e 62% da largura: '+J(m.dst));
    ok(near(cx,.45,.01),'2 '+nome+': centro do grupo em 0,45: '+cx);
    if(nome==='inteiro')ok(m.modo==='inteiro'&&m.corte===.62,'2: corpo inteiro vira do joelho para cima (0,62): '+J(m));
    if(nome==='meio')ok(m.modo==='meio'&&m.corte===1,'2: meio corpo inteiro: '+J(m));
    if(/largo/.test(nome))ok(near(m.dst.w,.62*W,2),'2 '+nome+': grupo largo limitado pela largura de 62%: '+J(m.dst));}
  // impressão: fundo de 5000 px
  const px=await pg.evaluate(async()=>{const im=new Image();im.src='img/fundos-5k/podio.jpg';await im.decode().catch(()=>{});const p=new Image();p.src='img/bg-podio.jpg';await p.decode().catch(()=>{});return [im.naturalWidth,im.naturalHeight,p.naturalWidth,p.naturalHeight];});
  ok(J(px)===J([5000,3333,2400,1600]),'2: fileHi 5000×3333 e prévia 2400×1600: '+J(px));
  const hi=await pg.evaluate(async id=>{const r=await ETERNA.compHi(id,'podio');const L=r.layout||{};return {w:r.w,h:r.h,fonte:r.fonte,av:r.avisos,url:(r.url||'').slice(0,23),dir:L.dst?(L.dst.x+L.dst.w)/5000:null,err:r.err};},'ag_a86000000003');
  ok(hi.fonte==='img/fundos-5k/podio.jpg'&&!(hi.av||[]).length&&Math.max(hi.w,hi.h)>=1844&&Math.min(hi.w,hi.h)>=1240&&hi.url==='data:image/jpeg;base64,'&&hi.dir<=.77,'2: impressão do pódio com o fundo de 5000 px: '+J(hi));

  // ---------- 3. migração: escolha salva com 4 fundos ganha o pódio uma vez só ----------
  const salvar=async(f)=>{await pg.evaluate(f);await pg.reload();await pg.waitForTimeout(400);};
  const lerSim=()=>pg.evaluate(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');return {bgOn:s.bgOn,flag:s.bgPodioV86,on:ETERNA.bgOn(),k:localStorage.getItem('eterna.bgpodio.v')};});
  await salvar(()=>{localStorage.removeItem('eterna.bgpodio.v');const s=JSON.parse(localStorage.getItem('eterna.sim.v1')||'{}');s.bgOn=['campeao','mirante','arq1950','tunel'];delete s.bgPodioV86;s.caixaDin=s.caixaDin||[];s.catalogoV=2;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
  let m=await lerSim();ok(J(m.bgOn)===J(['campeao','mirante','arq1950','tunel','podio'])&&m.flag===true&&m.k==='86'&&m.on.includes('podio'),'3: SIM com 4 fundos ganha o pódio: '+J(m));
  // o usuário tira o pódio: não volta ao recarregar
  await login(pg);await pg.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await pg.waitForTimeout(200);
  await pg.click('[data-act="bg-on"][data-id="podio"]');await pg.waitForTimeout(150);await pg.reload();await pg.waitForTimeout(400);
  m=await lerSim();ok(J(m.bgOn)===J(['campeao','mirante','arq1950','tunel'])&&!m.on.includes('podio'),'3: tirou o pódio e ele voltou: '+J(m));
  // SIM antigo gravado por outra janela (sem a marca no SIM), com a chave própria já gravada: não refaz
  await salvar(()=>{const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));delete s.bgPodioV86;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
  m=await lerSim();ok(!m.bgOn.includes('podio'),'3: SIM de outra janela refez a migração: '+J(m));
  // escolha salva com 5 fundos (sem o pódio): não passa de 5 nem troca nada
  await salvar(()=>{localStorage.removeItem('eterna.bgpodio.v');const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));s.bgAtivo={imprensa:true};s.bgOn=['campeao','mirante','arq1950','tunel','imprensa'];delete s.bgPodioV86;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
  m=await lerSim();ok(J(m.bgOn)===J(['campeao','mirante','arq1950','tunel','imprensa'])&&m.flag===true,'3: com 5 já escolhidos, nada muda: '+J(m));
  // lista vazia salva de propósito (nenhum fundo no Checkout): continua vazia depois da migração, e a migração fica marcada
  await salvar(()=>{localStorage.removeItem('eterna.bgpodio.v');const s=JSON.parse(localStorage.getItem('eterna.sim.v1'));s.bgOn=[];delete s.bgPodioV86;localStorage.setItem('eterna.sim.v1',JSON.stringify(s));});
  m=await lerSim();ok(J(m.bgOn)===J([])&&J(m.on)===J([])&&m.flag===true&&m.k==='86','3: lista vazia salva ganhou o pódio ou voltou ao padrão: '+J(m));
  await pg.reload();await pg.waitForTimeout(300);m=await lerSim();ok(J(m.bgOn)===J([])&&J(m.on)===J([]),'3: lista vazia mudou no segundo carregamento: '+J(m));
  // sem escolha salva: segue o padrão (BG_DEF, com o pódio), sem gravar bgOn
  await salvar(()=>{localStorage.clear();});m=await lerSim();ok(m.bgOn==null&&J(m.on)===J(['campeao','mirante','arq1950','tunel','podio']),'3: sem escolha salva, padrão com o pódio: '+J(m));
  // tela Fundos de IA cita o Pódio de campeão e os cinco
  await login(pg);await pg.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await pg.waitForTimeout(200);
  const txt=await pg.evaluate(()=>document.querySelector('#main').innerText);ok(/cinco fundos aprovados/.test(txt)&&/Pódio de campeão/.test(txt)&&!/quatro fundos/.test(txt),'3: textos dos Fundos de IA com os cinco: '+txt.slice(0,300));

  // ---------- 4. agente: mapa fixo com o pódio (prévia e impressão) ----------
  {const HA=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-v86-ag-'));let out='';
    try{out=execFileSync('python3',['-I','-c',`
import importlib.util,hashlib,json,sys
sp=importlib.util.spec_from_file_location('ag',sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
h=lambda b:hashlib.sha256(b).hexdigest()
print(json.dumps({'p':m.bg_arquivo('podio'),'hi':m.bg_arquivo('podio',True),'bp':h(m.bg_bytes('podio')),'bh':h(m.bg_bytes('podio',True))}))`,path.join(RAIZ,'agente','eterna-agente.py')],{env:{...process.env,HOME:HA,ETERNA_SEM_OPENCV:'1',ETERNA_APP_ORIGIN:ORIG},timeout:60000}).toString().trim().split('\n').pop();}catch(e){out='erro '+String(e.message).slice(0,200);}
    const sha=p=>require('crypto').createHash('sha256').update(fs.readFileSync(path.join(RAIZ,p))).digest('hex');let j={};try{j=JSON.parse(out);}catch(e){}
    ok(j.p==='img/bg-podio.jpg'&&j.hi==='img/fundos-5k/podio.jpg'&&j.bp===sha('img/bg-podio.jpg')&&j.bh===sha('img/fundos-5k/podio.jpg'),'4: agente responde o arquivo certo do pódio: '+out);
    fs.rmSync(HA,{recursive:true,force:true});}

  // ---------- 5. duas páginas no mesmo navegador: a segunda já aberta, a primeira migra, a segunda grava algo e o pódio continua ----------
  {await pg.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await login(pg);
    const p2=await ctx.newPage();p2.setDefaultTimeout(15000);p2.on('pageerror',e=>errs.push('p2: '+e.message));
    await p2.goto(U);await p2.waitForTimeout(400);await p2.evaluate(()=>{ETERNA.state.view='chroma';ETERNA.render();});await p2.waitForTimeout(200);
    // a p2 fica com a escolha antiga em memória (4 fundos, sem marca), e o mesmo SIM salvo sem a chave própria: estado de antes da v86
    await p2.evaluate(()=>{const S=ETERNA.SIM;S.bgOn=['campeao','mirante','arq1950','tunel'];delete S.bgPodioV86;localStorage.setItem('eterna.sim.v1',JSON.stringify(S));localStorage.removeItem('eterna.bgpodio.v');ETERNA.render();});
    const antes=await p2.evaluate(()=>ETERNA.bgOn());
    await pg.reload();await pg.waitForTimeout(500);   // a primeira página carrega e migra
    const p1=await pg.evaluate(()=>({on:ETERNA.bgOn(),k:localStorage.getItem('eterna.bgpodio.v')}));
    await p2.waitForTimeout(300);
    const viu=await p2.evaluate(()=>({on:ETERNA.bgOn(),flag:ETERNA.SIM.bgPodioV86,janelaAntiga:!!ETERNA.state.janelaAntiga}));
    ok(J(antes)===J(['campeao','mirante','arq1950','tunel'])&&p1.on.includes('podio')&&p1.k==='86','5: primeira página não migrou: '+J({antes,p1}));
    ok(viu.on.includes('podio')&&viu.flag===true&&!viu.janelaAntiga,'5: segunda página não adotou o SIM migrado (ou tratou como janela antiga): '+J(viu));
    // a p2 grava outra coisa (tira o Túnel do Checkout): o pódio continua na escolha salva, nas duas páginas e depois de recarregar
    await p2.click('[data-act="bg-on"][data-id="tunel"]');await p2.waitForTimeout(300);
    const s2=await p2.evaluate(()=>JSON.parse(localStorage.getItem('eterna.sim.v1')).bgOn);
    const s1=await pg.evaluate(()=>ETERNA.bgOn());
    await pg.reload();await pg.waitForTimeout(400);const s1r=await pg.evaluate(()=>({on:ETERNA.bgOn(),salvo:JSON.parse(localStorage.getItem('eterna.sim.v1')).bgOn}));
    ok(J(s2)===J(['campeao','mirante','arq1950','podio'])&&J(s1)===J(s2)&&J(s1r.salvo)===J(s2)&&J(s1r.on)===J(s2),'5: a gravação da segunda página apagou o pódio: '+J({s2,s1,s1r}));
    await p2.close();}
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,600));}
finally{if(b)await b.close();fs.rmSync(H,{recursive:true,force:true});}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA v86: fundo Pódio de campeão · '+fails.join(' | '));process.exit(1);}
console.log('OK v86: Pódio de campeão ativo, migração uma vez só, regra 14 sem cobrir a taça, fileHi de 5000 px e agente');})();
