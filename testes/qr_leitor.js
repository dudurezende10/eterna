// v99.29.2: leitura de QR pela câmera sem o BarcodeDetector (Chrome e Edge no Windows): a jsQR local (vendor/jsqr) é carregada
// na hora e lê o QR da imagem. Aqui o QR é desenhado num canvas (no lugar do vídeo da câmera) e lido de volta.
const {chromium}=require('playwright');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
(async()=>{const b=await chromium.launch();
try{
  const ctx=await b.newContext();await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await ctx.addInitScript(()=>{try{delete window.BarcodeDetector;}catch(e){}window.BarcodeDetector=undefined;delete window.BarcodeDetector;});
  const P=await ctx.newPage();await P.goto(U);await P.waitForTimeout(500);
  const r=await P.evaluate(async()=>{const antes=!!window.jsQR;const leitor=await ETERNA.qrLeitor();if(!leitor)return {antes,leitor:false};
    const ler=async txt=>{const d=document.createElement('div');document.body.appendChild(d);ETERNA.qrDraw?ETERNA.qrDraw(d,txt,300):new QRCode(d,{text:txt,width:300,height:300});await new Promise(r=>setTimeout(r,100));
      const src=d.querySelector('canvas')||d.querySelector('img');const cv=document.createElement('canvas');cv.width=cv.height=420;const cx=cv.getContext('2d');
      cx.fillStyle='#fff';cx.fillRect(0,0,420,420);cx.drawImage(src,60,60,300,300);cv.videoWidth=420;cv.videoHeight=420;d.remove();return leitor.detect(cv);};
    return {antes,leitor:true,depois:!!window.jsQR,pul:await ler('00123'),cartao:await ler('https://eterna.photo/#g/'+'N'.repeat(21)+'2'),vazio:await leitor.detect({videoWidth:0,videoHeight:0})};});
  ok(!r.antes&&r.leitor&&r.depois,'jsQR carregada só na hora: '+JSON.stringify(r));
  ok(JSON.stringify(r.pul)==='["00123"]','lê o QR da pulseira: '+JSON.stringify(r.pul));
  ok(JSON.stringify(r.cartao)===JSON.stringify(['https://eterna.photo/#g/'+'N'.repeat(21)+'2']),'lê o QR do cartão: '+JSON.stringify(r.cartao));
  ok(JSON.stringify(r.vazio)==='[]','câmera ainda sem imagem: nada lido');
}catch(e){fails.push('erro: '+e.message);}
finally{await b.close();}
if(fails.length){console.log('FALHAS:\n- '+fails.join('\n- '));process.exit(1);}console.log('OK qr_leitor: sem BarcodeDetector, a jsQR local lê o QR da pulseira e do cartão');})();
