// Ajuste automático (24/11): só exposição, sem estourar as partes claras, e chute a gol sem ajuste.
const {chromium}=require('playwright');
(async()=>{const U=process.env.U||'http://127.0.0.1:8823/index.html';const b=await chromium.launch();const p=await b.newPage();const falhas=[];
  await p.goto(U);await p.waitForTimeout(1500);
  const r=await p.evaluate(async()=>{const {ajAuto,ajQueue,ajChute,UP,state,SIM}=ETERNA.ajT;
    const img=(base,claro)=>{const c=document.createElement('canvas');c.width=320;c.height=200;const x=c.getContext('2d');x.fillStyle=`rgb(${base+20},${base},${base-10})`;x.fillRect(0,0,320,200);if(claro){x.fillStyle=`rgb(${claro},${claro},${claro})`;x.fillRect(0,0,320,40);}return c.toDataURL('image/jpeg',.9);};
    const poe=(id,pt,src)=>{state.lib=state.lib.filter(f=>f.id!==id);state.lib.push({id,pt,t:0});UP['ag_'+id]={src,name:id+'.jpg'};if(SIM.edits)delete SIM.edits['ag_'+id];};
    SIM.edits=SIM.edits||{};const out={};
    poe('escura','-',img(50));out.escura={...(await ajAuto('ag_escura'))};
    poe('clara','-',img(215));out.clara={...(await ajAuto('ag_clara'))};
    poe('mista','-',img(50,240));out.mista={...(await ajAuto('ag_mista'))};
    poe('flash','-',img(45,225));out.flash={...(await ajAuto('ag_flash'))};poe('media','-',img(120,235));out.media={...(await ajAuto('ag_media'))};
    poe('chute','chute',img(50));out.chute={...(await ajAuto('ag_chute'))};
    // ajuste antigo com contraste é refeito pela fila; chute que já tinha ajuste volta ao neutro
    SIM.edits['ag_escura']={b:130,c:125,t:10,auto:true};SIM.edits['ag_chute']={b:130,c:100,t:0,auto:true};SIM.edits['ag_clara']={b:120,c:130,t:0,auto:false};
    SIM.edits['ag_antiga']={b:130,c:125,t:10,auto:true};SIM.edits['ag_antigamao']={b:130,c:125,t:10,auto:false};ajQueue.migrou=0;
    SIM.autoAj=true;state.lojaRota=null;ajQueue.busy=0;ajQueue();await new Promise(r=>setTimeout(r,1500));
    out.antiga={...SIM.edits['ag_antiga']};out.antigamao={...SIM.edits['ag_antigamao']};
    out.fila={escura:{...SIM.edits['ag_escura']},chute:{...SIM.edits['ag_chute']},mao:{...SIM.edits['ag_clara']}};
    // foto nova sem ponto espera; depois do prazo é ajustada
    poe('nova','',img(50));state.lib.find(f=>f.id==='nova').t=Date.now()/1000;ajQueue.busy=0;ajQueue();await new Promise(r=>setTimeout(r,800));out.espera=!SIM.edits['ag_nova'];
    state.lib.find(f=>f.id==='nova').t=Date.now()/1000-200;ajQueue.busy=0;ajQueue();await new Promise(r=>setTimeout(r,1200));out.depois={...(SIM.edits['ag_nova']||{})};
    return out;});
  const ok=(c,m)=>{if(!c)falhas.push(m);};
  ok(r.escura.b>100&&r.escura.c===100&&r.escura.t===0,'escura: clareia sem contraste nem temperatura '+JSON.stringify(r.escura));
  ok(r.clara.b<100&&r.clara.c===100&&r.clara.t===0,'clara: escurece só na exposição '+JSON.stringify(r.clara));
  ok(r.mista.b<=105&&r.mista.c===100,'escura com parte clara: não estoura '+JSON.stringify(r.mista));
  ok(r.flash.b===100,'flash com fundo escuro: não mexe '+JSON.stringify(r.flash));ok(r.media.b===100,'foto bem exposta: não mexe '+JSON.stringify(r.media));ok(r.mista.b===100,'escura com parte clara: não mexe');
  ok(r.chute.b===100&&r.chute.c===100&&r.chute.t===0,'chute a gol: sem ajuste '+JSON.stringify(r.chute));
  ok(r.fila.escura.c===100&&r.fila.escura.t===0,'ajuste antigo refeito '+JSON.stringify(r.fila.escura));
  ok(r.fila.chute.b===100,'chute já ajustado volta ao neutro '+JSON.stringify(r.fila.chute));
  ok(r.fila.mao.c===130&&r.fila.mao.auto===false,'ajuste à mão não muda '+JSON.stringify(r.fila.mao));
  ok(r.antiga.b===100&&r.antiga.c===100&&r.antiga.t===0,'automático antigo fora da biblioteca volta ao original '+JSON.stringify(r.antiga));ok(r.antigamao.b===130,'à mão fora da biblioteca não muda');
  ok(r.espera===true,'foto nova sem ponto espera');ok(r.depois.b>100,'sem ponto depois do prazo: ajusta '+JSON.stringify(r.depois));
  await b.close();if(falhas.length){console.log('FALHA ajuste-so-exposicao: '+falhas.join(' | '));process.exit(1);}console.log('OK ajuste-so-exposicao: só exposição, sem estourar, chute a gol sem ajuste, fila refaz o antigo e respeita o à mão, espera o ponto');})().catch(e=>{console.log('FALHA ajuste-so-exposicao: '+e.message);process.exit(1);});
