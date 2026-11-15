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
  // ---------- critérios 2 e 4: Painel em 7 dias (dados de exemplo do index.html): 5 abas, total de receita igual ao da tela ----------
  const R7=await pg.evaluate(()=>{const f=ETERNA.state.range.from;const [y,m,d]=f.split('-').map(Number);return {from:f,to:new Date(Date.UTC(y,m-1,d+6)).toISOString().slice(0,10)};});
  await abrir('painel',`ETERNA.state.range=${J(R7)};ETERNA.state.painel={fonte:'tudo',pdv:''};`);
  ok(await pg.$('.pn-head .rel-exp')&&await pg.$('[data-act="pn-csv"]'),'Painel: sem Exportar ou sem o CSV antigo');
  const pn=await pg.evaluate(()=>({tela:document.querySelector('.pn-kpi[data-k="receita"] .pn-big').textContent.replace(/\D/g,''),k:ETERNA.state.painelUlt.kpi,dias:ETERNA.state.painelUlt.dias.length}));
  const dBR=d=>d.split('-').reverse().join('/');
  a=await baixar('xlsx','exemplo-painel.xlsx');ok(a,'Painel: XLS não baixou · '+await toast());
  if(a){ok(a.nome.endsWith(`-painel-${R7.from}_${R7.to}.xlsx`),'Painel: nome do arquivo '+a.nome);const x=await xlsx(a,'Painel');const dd=x.abas[1];
    ok(J(x.abas.map(s=>s.nome))===J(['Resumo','Dia a dia','Produtos','Pagamentos','Atendimentos']),'Painel: abas '+J(x.abas.map(s=>s.nome)));
    ok(dd.cab.includes(`Período: ${dBR(R7.from)} a ${dBR(R7.to)}`),'Painel: período no cabeçalho '+J(dd.cab));
    const tot=dd.dados[dd.dados.length-1];const iR=dd.colunas.indexOf('Receita');
    ok(pn.dias===7&&dd.dados.length===8&&tot[0].v==='Total'&&tot[iR].t==='n'&&String(Math.round(tot[iR].v))===pn.tela&&tot[iR].v===pn.k.receita,'Painel: total de receita do arquivo '+J(tot[iR])+' × tela '+pn.tela);
    ok(Math.abs(dd.dados.slice(0,-1).reduce((s,l)=>s+l[iR].v,0)-tot[iR].v)<0.01,'Painel: soma dos dias difere do total');
    ok(dd.dados.slice(0,-1).every(l=>l[0].t==='n'&&l[0].v>40000&&l[iR].t==='n'),'Painel: dia ou receita não são número');
    const res=x.abas[0].dados.find(l=>l[0].v==='Faturamento');ok(res&&res[1].v===pn.k.receita,'Painel: faturamento do Resumo');
    ok(x.abas[2].dados.length>1&&x.abas[3].dados.length>1&&x.abas[4].dados.length>=2,'Painel: abas vazias '+J(x.abas.map(s=>s.dados.length)));}
  a=await baixar('pdf','exemplo-painel.pdf');ok(a,'Painel: PDF não baixou · '+await toast());
  if(a){const p=pdfLer(a.buf);ok(p.ini&&p.fim&&p.xref&&p.objs,'Painel PDF: estrutura');ok(p.paginas>=1&&p.rodape.length===p.paginas&&p.rodape.every(([i,n],k)=>i===k+1&&n===p.paginas),'Painel PDF: páginas '+p.paginas+' × rodapé '+J(p.rodape));
    ok(p.linhas[0]==='Painel'&&p.linhas[1].length>2&&p.linhas.includes(`Per\xedodo: ${dBR(R7.from)} a ${dBR(R7.to)}`)&&p.linhas.includes('Gerado por: Admin de teste'),'Painel PDF: cabeçalho '+J(p.linhas.slice(0,8)));
    ok(p.linhas.some(l=>l==='R$ '+new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2}).format(pn.k.receita)),'Painel PDF: sem o total de receita');
    ok(/\/MediaBox \[0 0 841\.89 595\.28\]/.test(p.texto),'Painel PDF: 10 colunas deveriam sair em paisagem');}
  // critério 13: o CSV antigo do Painel continua
  {const espera=pg.waitForEvent('download',{timeout:1500}).catch(()=>null);await pg.click('[data-act="pn-csv"]');const dl=await espera;ok(dl&&/^eterna-painel-.*\.csv$/.test(dl.suggestedFilename()),'Painel: o Exportar CSV antigo parou');}
  // critério 11: período sem dado não gera arquivo
  await abrir('painel',`ETERNA.state.range={from:'2019-01-01',to:'2019-01-07'};`);a=await baixar('xlsx');ok(!a&&(await toast())===await TE('rel_sem_linhas'),'Painel vazio: deveria avisar que não há linhas · '+await toast());
  await pg.evaluate(r=>{ETERNA.state.range=r;},R7);

  // ---------- critérios 1 e 7: Estatísticas só nas seções a, b, e; a seção e exporta só a tabela por idioma ----------
  const DIAS=[{dia:R7.from,v:2,vendas:5,faturamento:900.5,sessoes:10,sessoes_com_venda:5,fotos:100,por_idioma:{pt:{vendas:3,faturamento:500},en:{vendas:2,faturamento:400.5}},por_produto:{gramado:{n:3,receita:450},arquibancada:{n:2,receita:450.5}},por_meio:{pix:{vendas:5,faturamento:900.5}},por_posto:{'Caixa 1':{vendas:5,faturamento:900.5}},por_hora:{10:{vendas:5,faturamento:900.5,sessoes:10,fotos:100}},por_fotografo:{yago:{sessoes:6,fotos:60,vendas:3,faturamento:500.5,sessoes_com_venda:3},marinara:{sessoes:4,fotos:40,vendas:2,faturamento:400,sessoes_com_venda:2}},montagens:{vistas:8,compradas:2}},
    {dia:R7.to,v:2,vendas:5,faturamento:1070,sessoes:8,sessoes_com_venda:4,fotos:90,por_idioma:{pt:{vendas:1,faturamento:70},es:{vendas:4,faturamento:1000}},por_fotografo:{yago:{sessoes:8,fotos:90,vendas:5,faturamento:1070,sessoes_com_venda:4}}}];
  const es=sec=>abrir('estatisticas',`const M=ETERNA.state.es;M.sec=${J(sec)};M.rover=false;M.foto=null;M.ord='faturamento';M.dir=-1;M.chave=${J(R7.from+'|'+R7.to)};M.dias=${J(DIAS)};M.em=Date.now();`);
  for(const s of ['a','b','c','d','e','f','g']){await es(s);const tem=!!(await pg.$('.head .rel-exp'));ok(tem===['a','b','e'].includes(s),'Estatísticas seção '+s+': botão '+(tem?'sobrando':'faltando'));}
  await es('e');const telaE=await pg.evaluate(()=>[...document.querySelectorAll('.es-sec table tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent)));
  a=await baixar('xlsx');ok(a,'Estatísticas e: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Estatísticas e');const d=x.abas[0].dados;ok(x.abas.length===1&&J(x.abas[0].colunas)===J(['Idioma','Vendas','Faturamento','Ticket']),'Estatísticas e: abas ou colunas '+J([x.abas.length,x.abas[0].colunas]));
    ok(d.length===3&&telaE.length===3&&d.every((l,i)=>l[0].v===telaE[i][0]&&String(l[1].v)===telaE[i][1]&&String(Math.round(l[2].v))===telaE[i][2].replace(/\D/g,'')&&String(Math.round(l[3].v))===telaE[i][3].replace(/\D/g,'')),'Estatísticas e: valores do arquivo × tela '+J([d.map(txt),telaE]));
    ok(J(d.map(l=>l[1].v))===J([4,4,2])&&d.find(l=>l[0].v==='Inglês')[2].v===400.5,'Estatísticas e: números '+J(d.map(txt)));ok(/-estatisticas-e-/.test(a.nome),'Estatísticas e: nome '+a.nome);}
  await es('a');a=await baixar('xlsx');ok(a,'Estatísticas a: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Estatísticas a');ok(x.abas.length===8&&x.abas[0].dados.find(l=>l[0].v==='Faturamento')[1].v===1970.5&&x.abas[1].dados.length===3,'Estatísticas a: abas '+J(x.abas.map(s=>[s.nome,s.dados.length])));}
  a=await baixar('pdf');ok(a&&pdfLer(a.buf).objs&&pdfLer(a.buf).rodape.length===pdfLer(a.buf).paginas,'Estatísticas a: PDF');
  await es('b');await pg.click('[data-act="es-ord"][data-c="nome"]');await pg.waitForTimeout(80);const telaB=await pg.evaluate(()=>[...document.querySelectorAll('.es-fotos tbody .es-link')].map(e=>e.textContent));
  a=await baixar('xlsx');ok(a,'Estatísticas b: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Estatísticas b');const d=x.abas[0].dados;ok(telaB.length>1&&J(d.map(l=>l[0].v))===J(telaB),'Estatísticas b: ordem do arquivo × tela');const y=d.find(l=>l[0].v==='Yago');ok(y&&y[2].v===14&&y[8].v===1570.5&&Math.abs(y[6].v-0.5)<1e-9,'Estatísticas b: números do Yago '+J(y&&txt(y)));}
  // FIM-FATIA


  await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e));}
finally{await b.close();fs.rmSync(tmp,{recursive:true,force:true});}
const bom=!fails.length&&!errs.length;console.log(`${bom?'OK':'FALHA'} relatorios${fails.length?' · '+fails.slice(0,6).join(' · '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(bom?0:1);})();
