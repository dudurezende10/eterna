// v97 (E8, Eduardo 10/11): fundo "Telão do Maracanã". A família aparece DENTRO da tela do telão (quadrilátero em perspectiva),
// do peito ou da cintura para cima, grande e embaixo; fora da tela a foto do fundo fica igual. Entra no lugar do Pódio de
// campeão (que vai para Laboratório › Fundos em teste), com migração uma vez só. Recorte sintético (nunca foto de cliente).
const {chromium}=require('playwright');const {execFileSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';const ORIG=new URL(U).origin;
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const PNG=Buffer.from(execFileSync('python3',['-c',`
import io,base64
from PIL import Image,ImageDraw
im=Image.new('RGBA',(2400,1600),(0,0,0,0));d=ImageDraw.Draw(im)
for x in (700,1300):
    d.ellipse([x+120,300,x+380,560],fill=(230,190,160,255));d.rectangle([x,560,x+500,1600],fill=(255,0,255,255))
b=io.BytesIO();im.save(b,'PNG');print(base64.b64encode(b.getvalue()).decode())`]).toString().trim(),'base64');
(async()=>{const b=await chromium.launch();const errs=[];
try{const ctx=await b.newContext({viewport:{width:1366,height:900}});
  await ctx.route(ORIG+'/recorte',r=>r.fulfill({status:200,contentType:'image/png',body:PNG}));
  const pg=await ctx.newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(U);await pg.evaluate(()=>{localStorage.clear();});await pg.reload();await pg.waitForTimeout(500);
  const d=await pg.evaluate(()=>{const t=ETERNA.bgOf('telao'),p=ETERNA.bgOf('podio');return {t:t&&{file:t.file,quad:t.telao&&t.telao.quad,ativo:ETERNA.bgAtivo(t)},podio:ETERNA.bgAtivo(p),on:ETERNA.bgOn(),
    nomes:['pt','en','es','fr','de'].map(l=>{ETERNA.state.lang=l;try{localStorage.setItem('eterna.lang',l);}catch(e){}return ETERNA.bgNomeCli(t);})};});
  ok(d.t&&d.t.file==='img/bg-telao.jpg'&&d.t.quad.length===4&&d.t.ativo&&!d.podio&&J(d.on)===J(['campeao','mirante','arq1950','tunel','telao']),'Telão ativo no lugar do Pódio (Laboratório): '+J(d));
  const i18=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/bgTelao:\[([^\]]*)\]/);
  ok(i18&&i18[1].split("','").length===5&&/Telão do Maracanã/.test(i18[1]),'nome para o cliente nas 5 línguas: '+(i18&&i18[1]));
  // homografia: o retângulo vai exatamente para os 4 cantos medidos
  const h=await pg.evaluate(()=>{const q=ETERNA.bgOf('telao').telao.quad;const R=[[0,0],[1000,0],[1000,600],[0,600]];const H=ETERNA.fiaHomog(R,q);
    return R.map(([x,y])=>{const z=H[6]*x+H[7]*y+H[8];return [Math.round((H[0]*x+H[1]*y+H[2])/z),Math.round((H[3]*x+H[4]*y+H[5])/z)];}).map((p,i)=>Math.hypot(p[0]-q[i][0],p[1]-q[i][1]));});
  ok(h.every(e=>e<1),'homografia leva o quadro aos 4 cantos: '+J(h));
  await pg.evaluate(()=>{ETERNA.state.agent.on=true;ETERNA.state.agent.recorte={ok:true};});
  const m=await pg.evaluate(async()=>{const r=await ETERNA.fiaMontar('ag_7e1a00000001','telao');if(!r.canvas)return r;const c=r.canvas,x=c.getContext('2d');
    const pl=await new Promise(z=>{const i=new Image();i.onload=()=>z(i);i.src='img/bg-telao.jpg';});const c2=document.createElement('canvas');c2.width=c.width;c2.height=c.height;const x2=c2.getContext('2d');x2.drawImage(pl,0,0);
    const px=(cx,X,Y)=>Array.from(cx.getImageData(X,Y,1,1).data.slice(0,3));const q=ETERNA.bgOf('telao').telao.quad;
    const fora=[[100,1700],[2400,1500],[300,60],[1300,1500]].map(([X,Y])=>{const a=px(x,X,Y),b=px(x2,X,Y);return Math.max(...a.map((v,i)=>Math.abs(v-b[i])));});
    // ponto da tela perto da base, no centro: a pessoa (magenta) em perspectiva
    const bx=(q[2][0]+q[3][0])/2,by=(q[2][1]+q[3][1])/2,tx=(q[0][0]+q[1][0])/2,ty=(q[0][1]+q[1][1])/2;const lx=q[3][0]+(q[2][0]-q[3][0])*.3,ly=q[3][1]+(q[2][1]-q[3][1])*.3;const P=[Math.round(lx+(tx-bx)*.08),Math.round(ly+(ty-by)*.08)]; // 30% da largura, perto da base: o corpo da 1ª pessoa
    const pc=px(x,P[0],P[1]);return {w:r.w,h:r.h,fora,pc,L:{modo:r.layout.modo,tela:r.layout.tela,dst:r.layout.dst}};});
  ok(m.w===2576&&m.h===1840&&m.fora.every(v=>v<=2),'fora da tela a foto do fundo fica igual: '+J(m.fora));
  ok(m.pc&&m.pc[0]>180&&m.pc[2]>180&&m.pc[1]<120,'a pessoa aparece dentro do telão, embaixo e no centro: '+J(m.pc));
  ok(m.L&&m.L.modo==='meio'&&Math.abs(m.L.dst.y+m.L.dst.h-m.L.tela.h)<=1&&m.L.dst.h<=.94*m.L.tela.h+1,'meio corpo (o recorte encosta embaixo) do peito para cima, encostado embaixo da tela, até 94% da altura: '+J(m.L));
  const hi=await pg.evaluate(async()=>{const r=await ETERNA.compHi('ag_7e1a00000001','telao');return {w:r.w,h:r.h,av:r.avisos,f:r.fonte};});
  ok(hi.w===1844&&hi.h===1240&&!(hi.av||[]).length,'impressão 10×15 do Telão: '+J(hi));
  // migração: lista salva com o pódio troca pelo telão na mesma posição, uma vez só; com 4, ganha o telão
  const mig=await pg.evaluate(()=>{const S=ETERNA.SIM,r=[];const run=(on)=>{localStorage.removeItem('eterna.bgtelao.v');delete S.bgTelaoV97;S.bgOn=on;ETERNA.bgMigraTelao();return S.bgOn.slice();};
    r.push(run(['campeao','podio','mirante','arq1950','tunel']));r.push(run(['campeao','mirante','arq1950','tunel']));r.push(run(['campeao','mirante','arq1950','tunel','imprensa']));
    S.bgOn=['campeao','podio'];r.push(ETERNA.bgMigraTelao()===false&&S.bgOn.join());return r;});
  ok(J(mig[0])===J(['campeao','telao','mirante','arq1950','tunel'])&&J(mig[1])===J(['campeao','mirante','arq1950','tunel','telao'])&&J(mig[2])===J(['campeao','mirante','arq1950','tunel','imprensa'])&&mig[3]==='campeao,podio','migração do Telão: '+J(mig));
}catch(e){fails.push('erro: '+(e.stack||e.message).slice(0,500));}
finally{await b.close();}
if(errs.length)fails.push('erros na página: '+errs.slice(0,3).join(' | '));
if(fails.length){console.log('FALHA telao: '+fails.join(' | '));process.exit(1);}
console.log('OK telao: Telão do Maracanã no lugar do Pódio, homografia nos 4 cantos, família dentro da tela, impressão e migração (E8)');})();
