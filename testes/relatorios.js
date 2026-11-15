// Exportar relatório (PDF | XLS) nas telas de dados. Critérios de docs/planos/2026-11-15-exportar-relatorios.md.
// Lê os bytes do arquivo baixado: o .xlsx como ZIP (diretório, CRC e XML de cada parte) e o .pdf pela estrutura (cabeçalho, xref, páginas e rodapé).
// Sem dado real: usuário fictício, vendas de teste montadas aqui e os dados de exemplo do próprio index.html.
const entrarTeste=require('./_entrar');
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const zlib=require('zlib');const {spawnSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;
const SAIDA=process.env.REL_SAIDA||''; // pasta para guardar os arquivos gerados (exemplos); vazio = não guarda

// ---------- leitura do ZIP (só método 0, como o app grava) ----------
function zipLer(buf){const out={};let e=buf.length-22;while(e>=0&&buf.readUInt32LE(e)!==0x06054b50)e--;if(e<0)throw new Error('zip sem fim');
  const n=buf.readUInt16LE(e+10),cd=buf.readUInt32LE(e+16);let p=cd;
  for(let i=0;i<n;i++){if(buf.readUInt32LE(p)!==0x02014b50)throw new Error('diretório do zip');const met=buf.readUInt16LE(p+10),crc=buf.readUInt32LE(p+16),tam=buf.readUInt32LE(p+24),nl=buf.readUInt16LE(p+28),xl=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),off=buf.readUInt32LE(p+42);
    const nome=buf.slice(p+46,p+46+nl).toString('utf8');if(buf.readUInt32LE(off)!==0x04034b50)throw new Error('cabeçalho local de '+nome);
    const d0=off+30+buf.readUInt16LE(off+26)+buf.readUInt16LE(off+28);const dados=buf.slice(d0,d0+tam);
    if(met!==0)throw new Error('método '+met+' em '+nome);if((zlib.crc32(dados)>>>0)!==crc)throw new Error('CRC de '+nome);
    out[nome]=dados.toString('utf8');p+=46+nl+xl+cl;}
  return out;}
// ---------- leitura do PDF ----------
function pdfLer(buf){const s=buf.toString('latin1');const r={ini:s.startsWith('%PDF-1.'),fim:s.trimEnd().endsWith('%%EOF'),texto:s};
  r.paginas=(s.match(/\/Type \/Page(?![s\w])/g)||[]).length;const m=/startxref\n(\d+)\n%%EOF/.exec(s);r.xref=!!m&&s.slice(+m[1],+m[1]+4)==='xref';
  // cada entrada do xref aponta para "N 0 obj"
  r.objs=true;if(m){const t=s.slice(+m[1]).split('\n');const n=+t[1].split(' ')[1];for(let i=1;i<n;i++){const o=+t[2+i].slice(0,10);if(!s.slice(o).startsWith(i+' 0 obj'))r.objs=false;}}else r.objs=false;
  r.linhas=[...s.matchAll(/\((?:[^()\\]|\\.)*\) Tj/g)].map(x=>x[0].slice(1,-4).replace(/\\([\\()])/g,'$1'));
  const rod=[...s.matchAll(/\((?:P.gina|Page|Seite) (\d+) (?:de|of|sur|von) (\d+)\) Tj/g)];r.rodape=rod.map(x=>[+x[1],+x[2]]);return r;}

(async()=>{const b=await chromium.launch();const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'eterna-rel-'));
try{
  const ctx=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR',timezoneId:'America/Sao_Paulo',acceptDownloads:true});await ctx.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  const pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
  await pg.goto(U);await pg.waitForTimeout(400);const ADM=await entrarTeste.adminFicticio(pg);ok(await entrarTeste(pg,ADM),'admin fictício não entrou');
  const abrir=(v,pre)=>pg.evaluate(([v,pre])=>{if(pre)new Function(pre)();ETERNA.state.view=v;ETERNA.render();},[v,pre||'']);
  const toast=()=>pg.evaluate(()=>{const t=document.querySelector('#toast');return t&&t.hasAttribute('data-on')?t.textContent:'';});
  const TE=(k,...a)=>pg.evaluate(([k,a])=>ETERNA.TE(k,...a),[k,a]);
  let nArq=0;
  // clica no botão da tela e devolve o arquivo; sem download em 1,5 s devolve null (e o toast)
  async function baixar(fmt,guarda){const espera=pg.waitForEvent('download',{timeout:1500}).catch(()=>null);await pg.click(`.rel-exp [data-act="rel-exportar"][data-fmt="${fmt}"]`);const dl=await espera;if(!dl)return null;
    const p=path.join(tmp,(++nArq)+'-'+dl.suggestedFilename());await dl.saveAs(p);const buf=fs.readFileSync(p);if(SAIDA&&guarda){fs.mkdirSync(SAIDA,{recursive:true});fs.copyFileSync(p,path.join(SAIDA,guarda));}return {nome:dl.suggestedFilename(),buf,p};}
  // abre o .xlsx: ZIP válido (também pelo python3 -m zipfile), todo XML bem formado, e devolve as abas com as linhas [{t:'s'|'n', v, s}]
  async function xlsx(a,rot){const z=zipLer(a.buf);const py=spawnSync('python3',['-I','-m','zipfile','-l',a.p],{encoding:'utf8'});ok(py.status===0&&/xl\/workbook\.xml/.test(py.stdout),rot+': python3 -m zipfile não abriu o xlsx');
    const r=await pg.evaluate(z=>{const P=new DOMParser();const mal=[];const doc={};Object.entries(z).forEach(([n,x])=>{const d=P.parseFromString(x,'application/xml');if(d.querySelector('parsererror'))mal.push(n);doc[n]=d;});
      const abas=[...doc['xl/workbook.xml'].querySelectorAll('sheet')].map((s,i)=>{const d=doc['xl/worksheets/sheet'+(i+1)+'.xml'];
        const linhas=d?[...d.querySelectorAll('row')].map(r=>{const o=[];o.push(+r.getAttribute('r'));[...r.querySelectorAll('c')].forEach(c=>{const col=c.getAttribute('r').replace(/\d+/g,'');let k=0;for(const ch of col)k=k*26+ch.charCodeAt(0)-64;
          o[k]=c.getAttribute('t')==='inlineStr'?{t:'s',v:c.querySelector('t').textContent,s:+c.getAttribute('s')||0}:{t:'n',v:+c.querySelector('v').textContent,s:+c.getAttribute('s')||0};});return o;}):null;
        return {nome:s.getAttribute('name'),linhas};});
      return {mal,abas,formulas:Object.values(z).some(x=>/<f[ >]/.test(x))};},z);
    ok(!r.mal.length,rot+': XML malformado em '+r.mal.join(', '));ok(!r.formulas,rot+': o xlsx tem fórmula');ok(['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/styles.xml'].every(n=>z[n]),rot+': faltam partes do xlsx');
    // cada aba: bloco do cabeçalho, linha vazia, cabeçalho da tabela (negrito) e os dados
    // (a linha vazia não existe no XML: é um salto no número da linha)
    r.abas.forEach(ab=>{const L=ab.linhas||[];const iv=L.findIndex((l,i)=>i>0&&l[0]!==L[i-1][0]+1);const semN=l=>l.slice(1);ab.cab=L.slice(0,iv).map(l=>l[1]?l[1].v:'');ab.colunas=semN(L[iv]||[]).map(c=>c?c.v:'');ab.dados=L.slice(iv+1).map(semN);ab.seguidas=L.slice(iv).every((l,i,A)=>!i||l[0]===A[i-1][0]+1);});return r;}
  const txt=l=>l.map(c=>c?c.v:null);

  // ---------- critério 1 (parte): Bandeiras tem o botão no topo; 3 e 5: chip Atenção, nome hostil, sem as colunas de estimativa ----------
  const HOSTIL='=1+1 <b>&"';
  await abrir('bandeiras',`const L=ETERNA.flagLinhas().rows.map(r=>r.f.slice());L.push([9001,${J(HOSTIL)},'Teste',2,'A',1,'']);L.push([9002,'Ação Ünica 東京','Teste',1,'B',1,'']);ETERNA.SIM.flagList=L;ETERNA.SIM.flags=ETERNA.SIM.flags||{};
    ETERNA.SIM.flags[${J(HOSTIL)}]={state:'defeito',note:'rasgo'+String.fromCharCode(1)+' no canto (2 cm)',point:'campo2'};ETERNA.SIM.flags['Ação Ünica 東京']={state:'desgastada',note:'',point:'campo3'};ETERNA.state.flagFilter='atencao';`);
  ok(await pg.$('.head .rel-exp [data-fmt="pdf"]')&&await pg.$('.head .rel-exp [data-fmt="xlsx"]'),'Bandeiras: sem Exportar PDF e XLS no topo');
  ok((await pg.textContent('.rel-exp'))==='ExportarPDFXLS','Bandeiras: texto do botão '+J(await pg.textContent('.rel-exp')));
  const tela=await pg.evaluate(()=>({nomes:ETERNA.flagLinhas().list.map(r=>r.f[1]),unid:ETERNA.flagLinhas().list.map(r=>r.f[3]),linhasTela:[...document.querySelectorAll('.panel table tbody tr td.name')].map(td=>td.firstChild.textContent),todas:ETERNA.flagLinhas().rows.length,venue:document.querySelector('#venue-name')?document.querySelector('#venue-name').textContent:''}));
  ok(tela.nomes.length>=2&&tela.nomes.length<tela.todas&&J(tela.nomes)===J(tela.linhasTela),'Bandeiras: o filtro Atenção da tela não bate com flagLinhas '+J([tela.nomes.length,tela.linhasTela.length]));
  let a=await baixar('xlsx','exemplo-bandeiras.xlsx');ok(a,'Bandeiras: XLS não baixou · '+await toast());
  if(a){ok(/^eterna-[a-z0-9_-]+-bandeiras-\d{4}-\d{2}-\d{2}\.xlsx$/.test(a.nome),'Bandeiras: nome do arquivo '+a.nome);const x=await xlsx(a,'Bandeiras');const inv=x.abas[0];
    ok(x.abas.length===3,'Bandeiras: abas '+J(x.abas.map(s=>s.nome)));
    ok(J(inv.dados.slice(0,tela.nomes.length).map(l=>l[0].v))===J(tela.nomes),'Bandeiras: linhas do arquivo fora do filtro ou da ordem da tela');
    ok(inv.dados.length===tela.nomes.length+1&&inv.dados[tela.nomes.length][0].v==='Total'&&inv.dados[tela.nomes.length][2].v===tela.unid.reduce((p,q)=>p+q,0),'Bandeiras: total de unidades');
    const est=[await TE('pn_sessoes'),await TE('bd_vendidas'),await TE('bd_conv'),await TE('pn_receita')];ok(!inv.colunas.some(c=>est.includes(c))&&J(inv.colunas)===J(['Bandeira','País','Unid.','Pano','Estado','Observação','Ponto']),'Bandeiras: colunas '+J(inv.colunas));
    ok(inv.cab.some(l=>/^Posição em: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(l))&&!inv.cab.some(l=>/^Período/.test(l)),'Bandeiras: sem "Posição em" no cabeçalho '+J(inv.cab));
    ok(inv.cab.includes('Filtros: Inventário: Atenção')&&inv.cab.includes('Gerado por: Admin de teste')&&inv.cab.includes('Uso interno'),'Bandeiras: cabeçalho '+J(inv.cab));
    const h=inv.dados.find(l=>l[0].v===HOSTIL);ok(h&&h[0].t==='s'&&h[2].t==='n'&&h[2].v===2,'Bandeiras: nome hostil não saiu como texto literal ou unidade não é número '+J(h));
    ok(h&&h[5].v==='rasgo no canto (2 cm)','Bandeiras: caractere de controle não saiu da observação '+J(h&&h[5]));
    ok(inv.dados.slice(0,-1).every(l=>l[2].t==='n'),'Bandeiras: unidade como texto');
    ok(x.abas[1].dados.some(l=>l[0].v===HOSTIL)&&!x.abas[1].dados.some(l=>/sess/i.test(txt(l).join(' '))),'Bandeiras: lista de compra '+J(x.abas[1].dados.map(txt)));
    ok(x.abas[2].dados.length===5&&x.abas[2].dados.every(l=>l[1].t==='n'),'Bandeiras: unidades por ponto '+J(x.abas[2].dados.map(txt)));}
  // PDF: estrutura, cabeçalho e páginas (critério 4)
  a=await baixar('pdf','exemplo-bandeiras.pdf');ok(a,'Bandeiras: PDF não baixou · '+await toast());
  if(a){const p=pdfLer(a.buf);ok(p.ini&&p.fim&&p.xref&&p.objs,'Bandeiras PDF: estrutura '+J([p.ini,p.fim,p.xref,p.objs]));
    ok(p.paginas>=1&&p.rodape.length===p.paginas&&p.rodape.every(([i,n],k)=>i===k+1&&n===p.paginas),'Bandeiras PDF: páginas '+p.paginas+' × rodapé '+J(p.rodape));
    ok(p.linhas[0]==='Bandeiras'&&p.linhas.some(l=>/^Posi..o em: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(l))&&p.linhas.includes('Gerado por: Admin de teste')&&p.linhas.includes('Uso interno'),'Bandeiras PDF: cabeçalho '+J(p.linhas.slice(0,8)));
    ok(p.linhas.includes(HOSTIL)&&p.linhas.includes('A\xe7\xe3o \xdcnica ??'),'Bandeiras PDF: texto hostil ou fora do WinAnsi '+J(p.linhas.filter(l=>/1\+1|nica/.test(l))));
    ok(!/[^\x00-\xff]/.test(p.texto)&&/\/BaseFont \/Helvetica-Bold/.test(p.texto)&&!/\/Subtype \/Image|\/XObject/.test(p.texto),'Bandeiras PDF: fonte ou imagem');}
  ok(await pg.evaluate(()=>ETERNA.pdfTxt('a(b)\\c é → ő 東')==='a\\(b\\)\\\\c \xe9 -> o ?'&&ETERNA.xmlTxt('<a&"b">\u0000\u0001\ud800x')==='&lt;a&amp;&quot;b&quot;&gt;x'),'pdfTxt ou xmlTxt');

  await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e));}
finally{await b.close();fs.rmSync(tmp,{recursive:true,force:true});}
const bom=!fails.length&&!errs.length;console.log(`${bom?'OK':'FALHA'} relatorios${fails.length?' · '+fails.slice(0,6).join(' · '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(bom?0:1);})();
