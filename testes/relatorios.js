// Exportar relatório (ícones PDF | XLS e, onde a tela já tinha, CSV no mesmo grupo) nas telas de dados. Critérios de docs/planos/2026-11-15-exportar-relatorios.md.
// Lê os bytes do arquivo baixado: o .xlsx como ZIP (diretório, CRC e XML de cada parte) e o .pdf pela estrutura (cabeçalho, xref, páginas e rodapé).
// Sem dado real: usuário fictício, vendas de teste montadas aqui e os dados de exemplo do próprio index.html.
const entrarTeste=require('./_entrar');const escalaLigada=require('./_escala');
const {chromium}=require('playwright');const fs=require('fs');const os=require('os');const path=require('path');const zlib=require('zlib');const {spawnSync}=require('child_process');
const U=process.env.U||'http://127.0.0.1:8890/index.html';
const fails=[],errs=[];const ok=(c,m)=>{if(!c)fails.push(m);};const J=JSON.stringify;

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
  let pg=await ctx.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Fetch API cannot load|ERR_|net::|onnxruntime/.test(m.text()))errs.push(m.text())});
  await pg.goto(U);await pg.waitForTimeout(400);const ADM=await entrarTeste.adminFicticio(pg);ok(await entrarTeste(pg,ADM),'admin fictício não entrou');
  const abrir=(v,pre)=>pg.evaluate(([v,pre])=>{if(pre)new Function(pre)();ETERNA.state.view=v;ETERNA.render();},[v,pre||'']);
  const toast=()=>pg.evaluate(()=>{const t=document.querySelector('#toast');return t&&t.hasAttribute('data-on')?t.textContent:'';});
  const TE=(k,...a)=>pg.evaluate(([k,a])=>ETERNA.TE(k,...a),[k,a]);
  let nArq=0;
  // clica no botão da tela e devolve o arquivo; sem download em 1,5 s devolve null (e o toast)
  async function baixar(fmt){const espera=pg.waitForEvent('download',{timeout:1500}).catch(()=>null);await pg.click(`.rel-exp [data-act="rel-exportar"][data-fmt="${fmt}"]`);const dl=await espera;if(!dl)return null;
    const p=path.join(tmp,(++nArq)+'-'+dl.suggestedFilename());await dl.saveAs(p);const buf=fs.readFileSync(p);return {nome:dl.suggestedFilename(),buf,p};}
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
  // 16/11: o grupo mostra um ícone por formato (sem texto no botão); o nome do formato fica no aria-label e no title
  const grupo=sel=>pg.evaluate(sel=>{const g=document.querySelector(sel);return g?[...g.querySelectorAll('button')].map(b=>({fmt:b.dataset.fmt,act:b.dataset.act,rot:b.getAttribute('aria-label'),tit:b.title,ico:!!b.querySelector('svg.rel-ic.'+b.dataset.fmt+'[aria-hidden="true"]'),
    solto:[...b.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()),w:b.offsetWidth,h:b.offsetHeight,cor:getComputedStyle(b.querySelector('svg')||b).color})):null;},sel);
  const grupoOk=(g,fmts,rots,rot)=>{ok(g&&J(g.map(x=>x.fmt))===J(fmts),rot+': ícones do grupo '+J(g&&g.map(x=>x.fmt)));if(!g)return;
    ok(g.every(x=>x.ico&&!x.solto),rot+': botão sem ícone ou com texto solto '+J(g));ok(g.every(x=>x.w>=40&&x.h>=40),rot+': alvo de toque menor que 40 px '+J(g.map(x=>[x.w,x.h])));
    ok(J(g.map(x=>x.rot))===J(rots)&&g.every(x=>x.tit===x.rot),rot+': aria-label ou title '+J(g.map(x=>[x.rot,x.tit])));ok(new Set(g.map(x=>x.cor)).size===g.length,rot+': os ícones têm a mesma cor '+J(g.map(x=>x.cor)));};
  const csvBaixa=async act=>{const espera=pg.waitForEvent('download',{timeout:1500}).catch(()=>null);await pg.click(`.rel-exp [data-act="${act}"]`);const dl=await espera;if(!dl)return null;const p=path.join(tmp,(++nArq)+'-'+dl.suggestedFilename());await dl.saveAs(p);return {nome:dl.suggestedFilename(),txt:fs.readFileSync(p,'utf8')};};

  // ---------- critério 1 (parte): Bandeiras tem o botão no topo; 3 e 5: chip Atenção, nome hostil, sem as colunas de estimativa ----------
  const HOSTIL='=1+1 <b>&"';
  await abrir('bandeiras',`const L=ETERNA.flagLinhas().rows.map(r=>r.f.slice());L.push([9001,${J(HOSTIL)},'Teste',2,'A',1,'']);L.push([9002,'Ação Ünica 東京','Teste',1,'B',1,'']);ETERNA.SIM.flagList=L;ETERNA.SIM.flags=ETERNA.SIM.flags||{};
    ETERNA.SIM.flags[${J(HOSTIL)}]={state:'defeito',note:'rasgo'+String.fromCharCode(1)+' no canto (2 cm)',point:'campo2'};ETERNA.SIM.flags['Ação Ünica 東京']={state:'desgastada',note:'',point:'campo3'};ETERNA.state.flagFilter='atencao';`);
  ok(await pg.$('.head .rel-exp [data-fmt="pdf"]')&&await pg.$('.head .rel-exp [data-fmt="xlsx"]'),'Bandeiras: sem Exportar PDF e XLS no topo');
  ok((await pg.textContent('.rel-exp>span'))==='Exportar','Bandeiras: rótulo do grupo '+J(await pg.textContent('.rel-exp>span')));
  grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Exportar PDF','Exportar XLS'],'Bandeiras (2 ícones)');
  const tela=await pg.evaluate(()=>({nomes:ETERNA.flagLinhas().list.map(r=>r.f[1]),unid:ETERNA.flagLinhas().list.map(r=>r.f[3]),linhasTela:[...document.querySelectorAll('.panel table tbody tr td.name')].map(td=>td.firstChild.textContent),todas:ETERNA.flagLinhas().rows.length,venue:document.querySelector('#venue-name')?document.querySelector('#venue-name').textContent:''}));
  ok(tela.nomes.length>=2&&tela.nomes.length<tela.todas&&J(tela.nomes)===J(tela.linhasTela),'Bandeiras: o filtro Atenção da tela não bate com flagLinhas '+J([tela.nomes.length,tela.linhasTela.length]));
  let a=await baixar('xlsx');ok(a,'Bandeiras: XLS não baixou · '+await toast());
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
  a=await baixar('pdf');ok(a,'Bandeiras: PDF não baixou · '+await toast());
  if(a){const p=pdfLer(a.buf);ok(p.ini&&p.fim&&p.xref&&p.objs,'Bandeiras PDF: estrutura '+J([p.ini,p.fim,p.xref,p.objs]));
    ok(p.paginas>=1&&p.rodape.length===p.paginas&&p.rodape.every(([i,n],k)=>i===k+1&&n===p.paginas),'Bandeiras PDF: páginas '+p.paginas+' × rodapé '+J(p.rodape));
    ok(p.linhas[0]==='Bandeiras'&&p.linhas.some(l=>/^Posi..o em: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(l))&&p.linhas.includes('Gerado por: Admin de teste')&&p.linhas.includes('Uso interno'),'Bandeiras PDF: cabeçalho '+J(p.linhas.slice(0,8)));
    ok(p.linhas.includes(HOSTIL)&&p.linhas.includes('A\xe7\xe3o \xdcnica ??'),'Bandeiras PDF: texto hostil ou fora do WinAnsi '+J(p.linhas.filter(l=>/1\+1|nica/.test(l))));
    ok(!/[^\x00-\xff]/.test(p.texto)&&/\/BaseFont \/Helvetica-Bold/.test(p.texto)&&!/\/Subtype \/Image|\/XObject/.test(p.texto),'Bandeiras PDF: fonte ou imagem');}
  ok(await pg.evaluate(()=>ETERNA.pdfTxt('a(b)\\c é → ő 東')==='a\\(b\\)\\\\c \xe9 -> o ?'&&ETERNA.xmlTxt('<a&"b">\u0000\u0001\ud800x')==='&lt;a&amp;&quot;b&quot;&gt;x'),'pdfTxt ou xmlTxt');
  // ---------- critérios 2 e 4: Painel em 7 dias (dados de exemplo do index.html): 5 abas, total de receita igual ao da tela ----------
  const R7=await pg.evaluate(()=>{const f=ETERNA.state.range.from;const [y,m,d]=f.split('-').map(Number);return {from:f,to:new Date(Date.UTC(y,m-1,d+6)).toISOString().slice(0,10)};});
  await abrir('painel',`ETERNA.state.range=${J(R7)};ETERNA.state.painel={fonte:'tudo',pdv:''};`);
  grupoOk(await grupo('.pn-head .rel-exp'),['pdf','xlsx','csv'],['Exportar PDF','Exportar XLS','Exportar CSV'],'Painel (3 ícones)');
  ok(await pg.evaluate(()=>document.querySelectorAll('[data-act="pn-csv"]').length===1&&!!document.querySelector('.pn-head .rel-exp [data-act="pn-csv"]')&&!document.querySelector('.pn-btn[data-act="pn-csv"]')),'Painel: o CSV tem que estar só dentro do grupo Exportar');
  const pn=await pg.evaluate(()=>({tela:document.querySelector('.pn-kpi[data-k="receita"] .pn-big').textContent.replace(/\D/g,''),k:ETERNA.state.painelUlt.kpi,dias:ETERNA.state.painelUlt.dias.length,
    notas:ETERNA.state.painelUlt.notas,notasTela:(document.querySelector('.pn-notas')||{textContent:''}).textContent,semCon:ETERNA.TE('pn_nota_sem_con'),gasto:ETERNA.state.painelUlt.dias.map(x=>x.pax?Math.round(x.receita/x.pax):null)}));
  // revisão, item 2: as notas da tela (sem conexão, filtro de ponto e avisos) são as mesmas do arquivo
  ok(Array.isArray(pn.notas)&&pn.notas.includes(pn.semCon)&&pn.notasTela===pn.notas.join(' '),'Painel: notas da tela × lista comum '+J([pn.notas,pn.notasTela]));
  const dBR=d=>d.split('-').reverse().join('/');
  a=await baixar('xlsx');ok(a,'Painel: XLS não baixou · '+await toast());
  if(a){ok(a.nome.endsWith(`-painel-${R7.from}_${R7.to}.xlsx`),'Painel: nome do arquivo '+a.nome);const x=await xlsx(a,'Painel');const dd=x.abas[1];
    ok(J(x.abas.map(s=>s.nome))===J(['Resumo','Dia a dia','Produtos','Pagamentos','Atendimentos']),'Painel: abas '+J(x.abas.map(s=>s.nome)));
    ok(dd.cab.includes(`Período: ${dBR(R7.from)} a ${dBR(R7.to)}`),'Painel: período no cabeçalho '+J(dd.cab));
    const tot=dd.dados[dd.dados.length-1];const iR=dd.colunas.indexOf('Receita');
    ok(pn.dias===7&&dd.dados.length===8&&tot[0].v==='Total'&&tot[iR].t==='n'&&String(Math.round(tot[iR].v))===pn.tela&&tot[iR].v===pn.k.receita,'Painel: total de receita do arquivo '+J(tot[iR])+' × tela '+pn.tela);
    ok(Math.abs(dd.dados.slice(0,-1).reduce((s,l)=>s+l[iR].v,0)-tot[iR].v)<0.01,'Painel: soma dos dias difere do total');
    ok(dd.dados.slice(0,-1).every(l=>l[0].t==='n'&&l[0].v>40000&&l[iR].t==='n'),'Painel: dia ou receita não são número');
    const res=x.abas[0].dados.find(l=>l[0].v==='Faturamento');ok(res&&res[1].v===pn.k.receita,'Painel: faturamento do Resumo');
    ok(pn.notas.every(n=>dd.cab.includes(n))&&x.abas[0].cab.includes(pn.semCon),'Painel: nota da tela fora do arquivo '+J(dd.cab));
    // revisão, item 3: R$/visitante inteiro na linha e no total (como a tela), sem centavo inventado
    const iG=dd.colunas.indexOf('R$/visitante');const gl=dd.dados.slice(0,-1).map(l=>l[iG]?l[iG].v:null);
    ok(iG>0&&J(gl)===J(pn.gasto)&&gl.some(v=>v!=null)&&tot[iG].v===pn.k.gastoVisitante&&Number.isInteger(tot[iG].v),'Painel: R$/visitante da linha × total '+J([gl,pn.gasto,tot[iG]]));
    ok(/<bookViews><workbookView\/><\/bookViews><sheets>/.test(zipLer(a.buf)['xl/workbook.xml']),'XLS: workbook.xml sem bookViews');
    ok(x.abas[2].dados.length>1&&x.abas[3].dados.length>1&&x.abas[4].dados.length>=2,'Painel: abas vazias '+J(x.abas.map(s=>s.dados.length)));}
  a=await baixar('pdf');ok(a,'Painel: PDF não baixou · '+await toast());
  if(a){const p=pdfLer(a.buf);ok(p.ini&&p.fim&&p.xref&&p.objs,'Painel PDF: estrutura');ok(p.paginas>=1&&p.rodape.length===p.paginas&&p.rodape.every(([i,n],k)=>i===k+1&&n===p.paginas),'Painel PDF: páginas '+p.paginas+' × rodapé '+J(p.rodape));
    ok(p.linhas[0]==='Painel'&&p.linhas[1].length>2&&p.linhas.includes(`Per\xedodo: ${dBR(R7.from)} a ${dBR(R7.to)}`)&&p.linhas.includes('Gerado por: Admin de teste'),'Painel PDF: cabeçalho '+J(p.linhas.slice(0,8)));
    ok(p.linhas.some(l=>l==='R$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(pn.k.receita)),'Painel PDF: sem o total de receita');
    ok(!p.linhas.some(l=>/^R\$ [\d.]+,\d+$/.test(l))&&p.linhas.filter(l=>/^R\$ [\d.]+$/.test(l)).length>10,'Painel PDF: dinheiro com centavos '+J(p.linhas.filter(l=>/^R\$ .*,/.test(l)).slice(0,3)));
    ok(p.linhas.join(' ').includes(pn.semCon),'Painel PDF: sem a nota da tela');
    ok(/\/MediaBox \[0 0 841\.89 595\.28\]/.test(p.texto),'Painel PDF: 10 colunas deveriam sair em paisagem');}
  // critério 13: o CSV antigo do Painel continua
  // 16/11: o CSV é o mesmo de antes (mesma função, mesmo nome), só mudou de lugar
  {const dl=await csvBaixa('pn-csv');const esp=await pg.evaluate(()=>['\ufeff'+ETERNA.painelCSV(ETERNA.state.painelUlt),'eterna-painel-'+ETERNA.state.painelUlt.range.from+'_'+ETERNA.state.painelUlt.range.to+'.csv']);
    ok(dl&&dl.nome===esp[1]&&dl.txt===esp[0]&&dl.txt.length>100,'Painel: o CSV do grupo não é o mesmo arquivo de antes '+J(dl&&[dl.nome,dl.txt.length,esp[0].length]));}
  // critério 11: período sem dado não gera arquivo
  await abrir('painel',`ETERNA.state.range={from:'2019-01-01',to:'2019-01-07'};`);a=await baixar('xlsx');ok(!a&&(await toast())===await TE('rel_sem_linhas'),'Painel vazio: deveria avisar que não há linhas · '+await toast());
  await pg.evaluate(r=>{ETERNA.state.range=r;},R7);

  // ---------- critérios 1 e 7: Estatísticas só nas seções a, b, e; a seção e exporta só a tabela por idioma ----------
  const DIAS=[{dia:R7.from,v:2,vendas:5,faturamento:900.5,sessoes:10,sessoes_com_venda:5,fotos:100,por_idioma:{pt:{vendas:3,faturamento:500},en:{vendas:2,faturamento:400.5}},por_produto:{gramado:{n:3,receita:450},arquibancada:{n:2,receita:450.5}},por_meio:{pix:{vendas:5,faturamento:900.5}},por_posto:{'Caixa 1':{vendas:5,faturamento:900.5}},por_hora:{10:{vendas:5,faturamento:900.5,sessoes:10,fotos:100}},por_fotografo:{yago:{sessoes:6,fotos:60,vendas:3,faturamento:500.5,sessoes_com_venda:3},marinara:{sessoes:4,fotos:40,vendas:2,faturamento:400,sessoes_com_venda:2}},montagens:{vistas:8,compradas:2}},
    {dia:R7.to,v:2,vendas:5,faturamento:1070,sessoes:8,sessoes_com_venda:4,fotos:90,por_idioma:{pt:{vendas:1,faturamento:70},es:{vendas:4,faturamento:1000}},por_fotografo:{yago:{sessoes:8,fotos:90,vendas:5,faturamento:1070,sessoes_com_venda:4}}}];
  const es=sec=>abrir('estatisticas',`const M=ETERNA.state.es;M.sec=${J(sec)};M.rover=false;M.foto=null;M.ord='faturamento';M.dir=-1;M.chave=${J(R7.from+'|'+R7.to)};M.dias=${J(DIAS)};M.em=Date.now();`);
  for(const s of ['a','b','c','d','e','f','g']){await es(s);const tem=!!(await pg.$('.head .rel-exp'));ok(tem===['a','b','e'].includes(s),'Estatísticas seção '+s+': botão '+(tem?'sobrando':'faltando'));
    if(tem)grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Exportar PDF','Exportar XLS'],'Estatísticas seção '+s+' (2 ícones)');}
  // o CSV dos dias do ano é de outra tabela (seção Jogos e ano a ano): fica junto dela, com o ícone novo (testes/agenda-estatisticas.js clica nele com o servidor)
  {const fonte=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');ok(/\$\{relBotao\('',\{act:'es-dias-csv',rot:TE\('es_baixar_csv'\)\}\)\}/.test(fonte)&&!/<button[^>]*data-act="(es-dias-csv|pn-csv|sales-csv)"/.test(fonte),'CSV fora do grupo Exportar no index.html');
    const g=await pg.evaluate(()=>{const d=document.createElement('div');d.innerHTML=ETERNA.relBotao('',{act:'es-dias-csv',rot:ETERNA.TE('es_baixar_csv')});return [...d.querySelectorAll('button')].map(b=>[b.dataset.act,b.dataset.fmt,b.getAttribute('aria-label'),!!b.querySelector('svg.rel-ic.csv')]);});
    ok(J(g)===J([['es-dias-csv','csv','Baixar dias (CSV)',true]]),'Estatísticas, dias do ano: grupo só com o CSV '+J(g));}
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
  // ---------- critério 6: Lista de vendas com vendedor e status filtrados e mais de 50 linhas: todas as do filtro, nenhuma fora ----------
  const vs=await pg.evaluate(de=>{ETERNA.state.range={from:de,to:'2099-12-31'};const S=ETERNA.state.sales;Object.assign(S,{day:'all',seller:'all',pay:'all',q:'',canal:'all',status:'paga',page:0});const c={};const todas=ETERNA.salesFiltradas();todas.forEach(r=>{c[r.seller]=(c[r.seller]||0)+1;});
    const [seller,n]=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];S.seller=seller;ETERNA.state.view='vendas-lista';ETERNA.render();
    const cel={};ETERNA.salesFiltradas().forEach(r=>[r.no,r.time,r.card,r.seller].forEach(t=>{t=String(t||'');if(t&&!/[^\x20-\xff]/.test(t))cel[t]=(cel[t]||0)+1;}));
    return {seller,n,tot:todas.length,tile:document.querySelector('.sl-tiles .tile .v').textContent.replace(/\D/g,''),naTela:document.querySelectorAll('.sl-tbl tbody tr').length,nos:ETERNA.salesFiltradas().map(r=>r.no),celulas:Object.entries(cel)};},R7.from);
  ok(vs.n>50&&vs.n<vs.tot&&vs.naTela===50&&+vs.tile===vs.n,'Lista de vendas: cenário do teste '+J([vs.n,vs.tot,vs.naTela,vs.tile]));
  grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx','csv'],['Exportar PDF','Exportar XLS',await pg.evaluate(()=>ETERNA.TE('sl_csv',ETERNA.salesFiltradas().length))],'Lista de vendas (3 ícones)');
  ok(await pg.evaluate(()=>document.querySelectorAll('[data-act="sales-csv"]').length===1&&!!document.querySelector('.head .rel-exp [data-act="sales-csv"]')&&!document.querySelector('.btn[data-act="sales-csv"]')),'Lista de vendas: o CSV tem que estar só dentro do grupo Exportar');
  a=await baixar('xlsx');ok(a,'Lista de vendas: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Lista de vendas');const s=x.abas[0];ok(x.abas.length===1&&J(s.colunas)===J(['Venda','Data','Hora','Sessão','Vendedor','Itens','Fotos','Impr.','Pagamento','Total','Status','Canal']),'Lista de vendas: colunas '+J(s.colunas));
    ok(s.dados.length===vs.n&&J(s.dados.map(l=>l[0].v))===J(vs.nos),'Lista de vendas: '+s.dados.length+' linhas no arquivo para '+vs.n+' no filtro');
    ok(s.dados.every(l=>l[4].v===vs.seller&&l[10].v==='paga'),'Lista de vendas: linha fora do filtro no arquivo');
    ok(s.dados.every(l=>l[1].t==='n'&&l[6].t==='n'&&l[9].t==='n'),'Lista de vendas: data, fotos ou total não são número');
    ok(s.cab.some(l=>l.includes('Vendedor: '+vs.seller)&&l.includes('Status: paga'))&&!J(x).includes('pagamento_ref'),'Lista de vendas: filtros no cabeçalho '+J(s.cab));}
  a=await baixar('pdf');ok(a,'Lista de vendas: PDF não baixou · '+await toast());
  if(a){const p=pdfLer(a.buf);ok(p.ini&&p.fim&&p.xref&&p.objs&&p.paginas>1&&p.rodape.length===p.paginas&&p.rodape.every(([i,n],k)=>i===k+1&&n===p.paginas),'Lista de vendas PDF: páginas '+p.paginas+' × rodapé '+p.rodape.length);
    ok(p.linhas.filter(l=>l==='Venda').length===p.paginas,'Lista de vendas PDF: cabeçalho da tabela não repete em cada página');ok(vs.nos.every(n=>p.linhas.includes(n)),'Lista de vendas PDF: faltam vendas');
    // revisão, item 1: 12 colunas, e nenhuma data, hora, código de sessão, vendedor ou título de coluna sai partido
    const cont=t=>p.linhas.filter(l=>l===t).length;
    ok(p.linhas.filter(l=>/^\d{2}\/\d{2}\/\d{4}$/.test(l)).length===vs.n&&!p.linhas.some(l=>/^\d{2}\/\d{2}\/\d{0,3}$/.test(l)),'Lista de vendas PDF: data partida em duas linhas');
    ok(vs.celulas.every(([t,n])=>cont(t)>=n),'Lista de vendas PDF: código, hora ou vendedor partido '+J(vs.celulas.filter(([t,n])=>cont(t)<n).slice(0,4)));
    ok(['Venda','Data','Hora','Sess\xe3o','Vendedor','Itens','Fotos','Impr.','Pagamento','Total','Status','Canal'].every(h=>cont(h)===p.paginas),'Lista de vendas PDF: título de coluna partido');}
  {const dl=await csvBaixa('sales-csv');const esp=await pg.evaluate(()=>'\ufeff'+ETERNA.salesCSV(ETERNA.allSales()));
    ok(dl&&dl.nome==='eterna-vendas.csv'&&dl.txt===esp&&dl.txt.split('\n').length>50,'Lista de vendas: o CSV do grupo não é o mesmo arquivo de antes '+J(dl&&[dl.nome,dl.txt.length,esp.length]));}
  // critério 11: mais de 2.000 linhas não vira PDF (o XLS sai)
  await pg.evaluate(()=>{const f=ETERNA.REL['vendas-lista'];window.__relOrig=f;ETERNA.REL['vendas-lista']=()=>{const R=f();const L=R.abas[0].linhas;R.abas[0].linhas=Array.from({length:2001},(_,i)=>L[i%L.length]);return R;};});
  a=await baixar('pdf');ok(!a&&(await toast())===await TE('rel_muitas_pdf','2.001'),'PDF com 2.001 linhas deveria ser recusado · '+await toast());
  a=await baixar('xlsx');ok(a&&(await xlsx(a,'2.001 linhas')).abas[0].dados.length===2001,'XLS com 2.001 linhas deveria sair');
  // revisão, item 9: o XLS para em 20.000 linhas, com o aviso de muitas linhas
  await pg.evaluate(()=>{const f=window.__relOrig;ETERNA.REL['vendas-lista']=()=>{const R=f();const L=R.abas[0].linhas;R.abas[0].linhas=Array.from({length:20001},(_,i)=>L[i%L.length]);return R;};});
  a=await baixar('xlsx');ok(!a&&(await toast())===await TE('rel_muitas_xls','20.001'),'XLS com 20.001 linhas deveria ser recusado · '+await toast());
  await pg.evaluate(()=>{ETERNA.REL['vendas-lista']=window.__relOrig;});
  // revisão, item 10: clique duplo gera um arquivo e um registro só; os botões voltam depois
  {let nDl=0;const conta=()=>{nDl++;};pg.on('download',conta);const antes=await pg.evaluate(()=>ETERNA.auditRead().length);
    await pg.dblclick('.rel-exp [data-act="rel-exportar"][data-fmt="xlsx"]');const preso=await pg.evaluate(()=>[ETERNA.relOcupado(),ETERNA.relExportar('pdf'),[...document.querySelectorAll('.rel-exp button')].every(b=>b.disabled),document.querySelectorAll('.rel-exp button:disabled').length,ETERNA.relBotao('vendas-lista',{act:'sales-csv',rot:'x'}).split(' disabled>').length-1]);
    ok(preso.splice(3,2).join()==='3,3','Exportação em curso: os três ícones (PDF, XLS e CSV) têm que ficar desabilitados');
    await pg.waitForTimeout(1300);pg.off('download',conta);const dep=await pg.evaluate(()=>[ETERNA.auditRead().length,ETERNA.relOcupado(),[...document.querySelectorAll('.rel-exp button')].some(b=>b.disabled)]);
    ok(nDl===1&&dep[0]===antes+1&&J(preso)===J([true,false,true])&&dep[1]===false&&dep[2]===false,'Clique duplo no Exportar: '+J({arquivos:nDl,registros:dep[0]-antes,preso,dep}));}
  // revisão, item 1: tabela de 12 colunas com dados realistas direto no escritor do PDF. Só o texto longo quebra, e entre palavras.
  {const SIN=await pg.evaluate(async()=>{const R=ETERNA.relNovo('teste','Lista de teste');R.periodo={de:'2026-11-01',ate:'2026-11-15'};const nomes=['Marinara','Yago','Klacius','Fernanda Albuquerque'];const pags=['Pix','Cartão de crédito','Dinheiro'];
      const itens=['Foto digital','Impressão 15x21 + Porta-retrato + Pacote digital completo + Montagem Campeão + Chaveiro','Pacote digital completo + Impressão 20x30'];
      const cols=[['Venda'],['Data','data'],['Hora'],['Sessão'],['Vendedor'],['Itens'],['Fotos','int'],['Impressões','int'],['Pagamento'],['Total','moeda'],['Status'],['Canal']].map(([t,tipo])=>({t,tipo:tipo||'txt'}));
      const L=Array.from({length:60},(_,i)=>['V-2026-'+String(1000+i),'2026-11-'+String(1+i%15).padStart(2,'0'),String(9+i%9).padStart(2,'0')+':'+String(i%60).padStart(2,'0'),'MRC'+(4000+i),nomes[i%4],itens[i%3],3+i%20,i%7,pags[i%3],149.9+i*10,i%5?'paga':'aguardando','Checkout']);
      ETERNA.relAba(R,'Vendas','Vendas',cols,L);const u=new Uint8Array(await ETERNA.pdfBlob(R).arrayBuffer());let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));
      const pal=new Set();const poe=t=>ETERNA.pdfWin(String(t)).split(' ').forEach(w=>pal.add(w));cols.forEach(c=>poe(c.t));L.forEach(l=>[0,2,3,4,5,8,10,11].forEach(i=>poe(l[i])));return {s,pal:[...pal],n:L.length};});
    const p=pdfLer(Buffer.from(SIN.s,'latin1'));const i0=p.linhas.indexOf('Venda');const pal=new Set(SIN.pal);const cont=t=>p.linhas.filter(l=>l===t).length;
    const corpo=p.linhas.slice(i0).filter(l=>!/^P.gina \d+ de \d+$/.test(l)&&!/Uso interno$/.test(l)&&!/^R\$ [\d.]+,\d{2}$/.test(l)&&!/^\d{2}\/\d{2}\/\d{4}$/.test(l)&&!/^\d+$/.test(l));
    const soltas=corpo.filter(l=>l.split(' ').some(w=>!pal.has(w)));
    ok(i0>0&&p.paginas>1&&!soltas.length,'PDF de 12 colunas: palavra partida '+J(soltas.slice(0,6)));
    ok(p.linhas.filter(l=>/^\d{2}\/\d{2}\/\d{4}$/.test(l)).length===SIN.n&&p.linhas.filter(l=>/^MRC\d{4}$/.test(l)).length===SIN.n&&p.linhas.filter(l=>/^V-2026-\d{4}$/.test(l)).length===SIN.n&&cont('Marinara')===15&&cont('Impress\xf5es')===p.paginas&&p.linhas.filter(l=>/^R\$ [\d.]+,\d{2}$/.test(l)).length===SIN.n,'PDF de 12 colunas: data, código, nome ou título partido '+J([cont('Marinara'),cont('Impress\xf5es'),p.paginas]));
    ok(corpo.length>SIN.n*8+20&&corpo.some(l=>/^Impress\xe3o 15x21 \+/.test(l)&&!/Chaveiro$/.test(l)),'PDF de 12 colunas: a coluna longa (Itens) deveria quebrar em mais de uma linha');}
  // revisão, item 7: nome de aba sem apóstrofo no começo nem no fim, mesmo depois do corte em 31 caracteres
  {const ab=await pg.evaluate(()=>{const R=ETERNA.relNovo('t','t');["'Dani's'","''","'","a".repeat(30)+"'bcd","'Dani's'","x: y/z"].forEach(n=>ETERNA.relAba(R,n,n,[],[]));return R.abas.map(a=>a.nome);});
    ok(J(ab)===J(["Dani's","Dados","Dados 2","a".repeat(30),"Dani's 2","x y z"])&&ab.every(n=>n.length<=31&&!/^'|'$/.test(n)),'Nome de aba com apóstrofo na ponta: '+J(ab));}

  // ---------- Fotógrafos: tabela do período e, com a pessoa aberta, o dia a dia dela ----------
  await abrir('fotografos',`ETERNA.state.range=${J(R7)};ETERNA.state.person=null;ETERNA.state.personDay=null;`);
  ok(await pg.$('.head .rel-exp'),'Fotógrafos: sem Exportar no topo');grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Exportar PDF','Exportar XLS'],'Fotógrafos (2 ícones)');const telaF=await pg.evaluate(()=>[...document.querySelectorAll('.panel table tbody tr')].map(tr=>[tr.children[0].textContent,tr.children[1].textContent,tr.children[9].textContent.replace(/\D/g,'')]));
  a=await baixar('xlsx');ok(a,'Fotógrafos: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Fotógrafos');const d=x.abas[0].dados;ok(x.abas[0].colunas.length===15&&d.length===telaF.length&&d.every((l,i)=>l[0].v===telaF[i][0]&&(!l[1]||String(l[1].v)===telaF[i][1])&&String(Math.round(l[10].v))===telaF[i][2]),'Fotógrafos: arquivo × tela '+J([d.slice(0,2).map(txt),telaF.slice(0,2)]));}
  a=await baixar('pdf');ok(a&&pdfLer(a.buf).objs&&/841\.89 595\.28/.test(pdfLer(a.buf).texto),'Fotógrafos: PDF em paisagem');
  await pg.click('.panel table tbody tr[data-act="person"]');await pg.waitForTimeout(100);const nomeF=await pg.textContent('h1');ok(await pg.$('.head .rel-exp'),'Fotógrafo aberto: sem Exportar no topo');
  a=await baixar('xlsx');ok(a,'Fotógrafo aberto: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Fotógrafo aberto');const s=x.abas[0];const nTela=await pg.evaluate(()=>document.querySelectorAll('.panel table tbody tr').length);ok(s.nome==='Dia a dia'&&s.cab.includes('Filtros: Fotógrafo: '+nomeF)&&s.dados.length===nTela+1&&s.dados[s.dados.length-1][0].v==='Total','Fotógrafo aberto: '+J([s.nome,s.cab,s.dados.length,nTela]));}
  // ---------- critério 14: Escala (hoje e a semana da tela) e Diário (o filtro da tela) ----------
  // 16/11: a Escala está desligada no app (ESCALA_ON=false): nesta janela ela não tem tela nem exportação
  ok(await pg.evaluate(()=>ETERNA.escalaOn()===false&&!ETERNA.REL.escala&&ETERNA.relPode('escala')===false&&ETERNA.relBotao('escala')===''),'Escala desligada: não pode ter Exportar');
  // a exportação da Escala continua conferida numa janela com a chave ligada (testes/_escala.js), para religar sem surpresa
  const pgA=pg;const ctxE=await b.newContext({viewport:{width:1920,height:1080},locale:'pt-BR',timezoneId:'America/Sao_Paulo',acceptDownloads:true});await ctxE.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());await escalaLigada(ctxE);
  pg=await ctxE.newPage();pg.setDefaultTimeout(8000);pg.on('pageerror',e=>errs.push('Escala ligada: '+e.message));await pg.goto(U);await pg.waitForTimeout(400);ok(await entrarTeste(pg,await entrarTeste.adminFicticio(pg)),'Escala ligada: admin fictício não entrou');
  await abrir('escala');ok(await pg.$('.head .rel-exp'),'Escala: sem Exportar no topo');grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Exportar PDF','Exportar XLS'],'Escala (2 ícones)');
  const telaEsc=await pg.evaluate(()=>{const c=[...document.querySelectorAll('#esc-semana .grid-week > div')].map(e=>e.textContent);const L=[];for(let i=8;i<c.length;i+=8)L.push(c.slice(i,i+8));return {L,hoje:new Date().toISOString().slice(0,10),nHoje:document.querySelectorAll('.panel table tbody tr').length};});
  const maisDias=(d,k)=>{const [y,m,dd]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,dd+k)).toISOString().slice(0,10);};
  a=await baixar('xlsx');ok(a,'Escala: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Escala');const s=x.abas[1];ok(x.abas.length===2&&x.abas[0].dados.length===telaEsc.nHoje&&J(x.abas[0].colunas)===J(['Fotógrafo','Função','Tipo','Sessões hoje']),'Escala: aba de hoje '+J([x.abas.length,x.abas[0].colunas,x.abas[0].dados.length]));
    ok(s.cab.includes(`Período: ${dBR(telaEsc.hoje)} a ${dBR(maisDias(telaEsc.hoje,6))}`),'Escala: período '+J(s.cab));
    const esperado=[];telaEsc.L.forEach(l=>l.slice(1).forEach(t=>esperado.push([l[0],t])));
    ok(s.dados.length===esperado.length&&esperado.length>=14&&s.dados.every((l,i)=>l[0].v===esperado[i][0]&&l[1].t==='n'&&l[2].v.replace(/ \(previsto\)$/,'')===esperado[i][1]),'Escala: semana do arquivo × tela '+J([s.dados.length,esperado.length,s.dados.slice(0,2).map(txt),esperado.slice(0,2)]));
    ok(!/presen|falta|atraso|hor.rio/i.test(J(x.abas.map(q=>[q.colunas,q.cab]))),'Escala: o arquivo não pode sugerir controle de ponto');}
  a=await baixar('pdf');ok(a&&pdfLer(a.buf).objs&&pdfLer(a.buf).linhas[0]==='Escala','Escala: PDF');
  // quem é fotógrafo (sem alterar a Escala) exporta só os dias dele
  await pg.evaluate(()=>{const u=ETERNA.state.user;u.key='yago';u.perms.escala.u=false;});
  await abrir('escala');a=await baixar('xlsx');if(a){const x=await xlsx(a,'Escala do fotógrafo');ok(x.abas.length===1&&x.abas[0].dados.length===8&&x.abas[0].cab.includes('Filtros: Fotógrafo: Yago')&&J(x.abas[0].colunas)===J(['Dia','Função']),'Escala do fotógrafo: '+J([x.abas.length,x.abas[0].cab,x.abas[0].dados.length]));}else ok(false,'Escala do fotógrafo: XLS não baixou');
  await ctxE.close();pg=pgA;
  // Diário: registros de teste (texto livre com acento, quebra de linha e sinais de fórmula)
  await abrir('diario',`const h=new Date();const hoje=h.toISOString().slice(0,10);const ontem=new Date(h.getTime()-864e5);const u=ETERNA.state.user;
    ETERNA.SIM.diario=[{id:'dt1',at:h.toISOString(),date:hoje,key:null,by:u.email,name:u.name,point:'campo2',type:'convidado',item:'Reclamação',sev:'alta',text:'=SOMA(A1) visitante pediu para refazer\\na foto <b>da família</b>',status:'aberto'},
      {id:'dt2',at:h.toISOString(),date:hoje,key:'yago',by:'outra-pessoa',name:'Pessoa de teste',point:'campo3',type:'equip',item:'Bateria',sev:'media',text:'',status:'resolvido',resolvedBy:'alguem'},
      {id:'dt3',at:ontem.toISOString(),date:ontem.toISOString().slice(0,10),key:'marinara',by:'terceira-pessoa',name:'Terceira pessoa',point:'',type:'clima',item:'Chuva',sev:'baixa',text:'chuva forte às 15h',status:'aberto'}];ETERNA.state.diario.filter='hoje';`);
  ok(await pg.$('.head .rel-exp'),'Diário: sem Exportar no topo');grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Exportar PDF','Exportar XLS'],'Diário (2 ícones)');
  a=await baixar('xlsx');ok(a,'Diário: XLS não baixou · '+await toast());
  if(a){const x=await xlsx(a,'Diário');const s=x.abas[0];ok(J(s.colunas)===J(['Data','Hora','Quem','Ponto','Tipo','Registro','Grav.','Status'])&&s.dados.length===2&&(await pg.$$('table.wrap tbody tr')).length===2,'Diário de hoje: '+J([s.colunas,s.dados.map(txt)]));
    ok(s.cab.includes('Filtros: Registros: Hoje')&&s.cab.includes('Uso interno')&&s.cab.includes(`Período: ${dBR(telaEsc.hoje)}`),'Diário: cabeçalho '+J(s.cab));
    ok(s.dados[0][5].t==='s'&&s.dados[0][5].v.startsWith('Reclamação · =SOMA(A1) visitante')&&s.dados[0][5].v.includes('<b>da família</b>')&&s.dados[1][7].v==='resolvido · alguem','Diário: registro '+J(s.dados.map(txt)));}
  await abrir('diario',`ETERNA.state.diario.filter='todos';`);a=await baixar('xlsx');if(a){const x=await xlsx(a,'Diário todos');ok(x.abas[0].dados.length===3&&x.abas[0].cab.includes(`Período: ${dBR(maisDias(telaEsc.hoje,-1))} a ${dBR(telaEsc.hoje)}`),'Diário, Todos: '+J([x.abas[0].dados.length,x.abas[0].cab]));}else ok(false,'Diário, Todos: XLS não baixou');
  a=await baixar('pdf');ok(a&&pdfLer(a.buf).objs&&pdfLer(a.buf).linhas.some(l=>l.includes('=SOMA(A1) visitante')),'Diário: PDF');
  // quem é fotógrafo (sem alterar a Escala e sem excluir no Diário) exporta só o que a tela dele mostra
  await pg.evaluate(()=>{const u=ETERNA.state.user;window.__u=JSON.stringify(u);u.key='yago';u.perms.escala.u=false;u.perms.diario.d=false;ETERNA.state.view='diario';ETERNA.render();});
  a=await baixar('xlsx');if(a){const x=await xlsx(a,'Diário do fotógrafo');const s=x.abas[0];ok(!s.colunas.includes('Quem')&&s.dados.length===2&&!J(s.dados).includes('Terceira pessoa')&&!J(s.dados).includes('chuva forte'),'Diário do fotógrafo: saiu registro de outra pessoa '+J(s.dados.map(txt)));}else ok(false,'Diário do fotógrafo: XLS não baixou');
  const volta=()=>pg.evaluate(()=>{const u=ETERNA.state.user;const o=JSON.parse(window.__u);Object.keys(u).forEach(k=>delete u[k]);Object.assign(u,o);});await volta();

  // ---------- critério 9: sem a permissão da tela o botão não aparece e o clique forçado não baixa nada ----------
  const forcado=async rot=>{const r=await pg.evaluate(()=>{ETERNA.state.view='bandeiras';const r={pode:ETERNA.relPode('bandeiras'),botao:ETERNA.relBotao('bandeiras')};document.querySelector('#main').insertAdjacentHTML('beforeend','<div class="rel-exp"><button data-act="rel-exportar" data-fmt="pdf">x</button><button data-act="rel-exportar" data-fmt="xlsx">x</button></div>');return r;});
    ok(r.pode===false&&r.botao==='',rot+': o botão apareceria');for(const f of ['pdf','xlsx']){const a=await baixar(f);ok(!a&&(await toast())===await TE('sem_acesso_tela'),rot+': clique forçado em '+f+' · '+await toast());}};
  const antesN=await pg.evaluate(()=>ETERNA.auditRead().length);
  await pg.evaluate(()=>{const u=ETERNA.state.user;window.__u=JSON.stringify(u);u.perms.estoque.r=false;ETERNA.state.view='painel';ETERNA.render();});await forcado('Sem Ver em Estoque e bandeiras');await volta();
  await pg.evaluate(()=>{const u=ETERNA.state.user;window.__u=JSON.stringify(u);u.preset='supervisor';u.menu=(u.menu||[]).filter(v=>v!=='bandeiras');ETERNA.state.view='painel';ETERNA.render();});await forcado('Sem Bandeiras no menu');await volta();
  ok(await pg.evaluate(n=>ETERNA.auditRead().length===n,antesN),'Clique recusado não pode ficar registrado como exportação');

  // ---------- critério 10: cada exportação fica no histórico (local e usuarios_log), sem o conteúdo ----------
  await abrir('bandeiras',`ETERNA.state.flagFilter='atencao';window.__docs=[];window.__db=ETERNA.state.db;ETERNA.state.db={doc:p=>({set:v=>{window.__docs.push([p,JSON.parse(JSON.stringify(v))]);}})};`);
  const pedidos=[];const ouve=r=>{if(!/^(blob|data):/.test(r.url())&&r.resourceType()!=='image')pedidos.push(r.url());};await pg.waitForTimeout(400);pg.on('request',ouve); // as imagens das bandeiras são da tela, não do Exportar
  a=await baixar('pdf');pg.off('request',ouve);ok(a,'Bandeiras (registro): PDF não baixou');ok(!pedidos.length,'Exportar fez pedido de rede: '+pedidos.slice(0,2).join(', '));
  const reg=await pg.evaluate(()=>{const d=window.__docs.slice();ETERNA.state.db=window.__db;const l=ETERNA.auditRead()[0];return {d,l,guardado:JSON.parse(localStorage.getItem('eterna.users.log.v1')||'[]')[0]};});
  ok(reg.d.length===1&&/^usuarios_log\/L/.test(reg.d[0][0])&&reg.d[0][1].acao==='relatorio_exportado'&&reg.d[0][1].alvo==='relatorio/bandeiras'&&reg.d[0][1].mudancas[0].para==='pdf'&&reg.d[0][1].linhas>0&&reg.d[0][1].por===ADM,'Registro em usuarios_log: '+J(reg.d).slice(0,300));
  ok(reg.l&&reg.l.id===reg.d[0][1].id&&reg.guardado&&reg.guardado.id===reg.l.id,'Registro local (o que sobe na reconexão) não é o mesmo do servidor');
  ok(!J(reg.d).includes('1+1')&&!J(reg.d).includes('Vasco')&&J(reg.d[0][1].filtros)===J([['Inventário','Atenção']]),'O registro levou conteúdo do relatório ou perdeu o filtro '+J(reg.d[0][1].filtros));
  await abrir('permissoes',`ETERNA.state.perm.tab='historico';ETERNA.state.perm.logQ='';`);const hist=await pg.evaluate(()=>{const tr=document.querySelector('.perm-log tbody tr');return tr?[...tr.children].map(td=>td.textContent):null;});
  ok(hist&&hist[2]==='exportou o relatório'&&hist[3]==='Bandeiras'&&/^PDF · \d+ linhas · Inventário: Atenção$/.test(hist[4])&&hist[1].startsWith('Admin de teste'),'Permissões › Histórico: '+J(hist));

  {const h=await pg.evaluate(()=>ETERNA.auditText({acao:'relatorio_exportado',alvo:'relatorio/estatisticas-b',por:'x',mudancas:[{campo:'formato',para:'xlsx'}],linhas:3}).pessoa);ok(h==='Estatísticas · '+await TE('es_sec_b'),'Histórico: seção de Estatísticas exportada '+J(h));}
  // ---------- critério 8: idioma da pessoa em inglês; chaves rel_* nas 5 línguas ----------
  await pg.evaluate(()=>{window.__u=JSON.stringify(ETERNA.state.user);ETERNA.state.user.idioma='en';ETERNA.state.view='bandeiras';ETERNA.render();});
  ok((await pg.textContent('.rel-exp>span'))==='Export','Inglês: rótulo do grupo '+await pg.textContent('.rel-exp>span'));
  grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],['Export PDF','Export XLS'],'Inglês (2 ícones)');
  a=await baixar('xlsx');if(a){const x=await xlsx(a,'Inglês');const s=x.abas[0];ok(J(s.colunas)===J(['Flag','Country','Units','Fabric','Condition','Note','Spot'])&&s.cab[0]==='Flags · Inventory'&&s.cab.some(l=>/^Position as of: /.test(l))&&s.cab.includes('Generated by: Admin de teste')&&s.cab.includes('Internal use')&&s.cab.includes('Filters: Inventory: Attention')&&s.nome==='Inventory','Inglês: '+J([s.nome,s.colunas,s.cab]));}else ok(false,'Inglês: XLS não baixou');
  a=await baixar('pdf');if(a){const p=pdfLer(a.buf);ok(p.linhas[0]==='Flags'&&p.rodape.length===p.paginas&&/\(Page 1 of \d+\) Tj/.test(p.texto)&&p.linhas.includes('Internal use'),'Inglês PDF: '+J(p.linhas.slice(0,6)));}else ok(false,'Inglês: PDF não baixou');
  await volta();
  // 16/11: nome do formato no aria-label e no title nas 5 línguas, com 2 ícones (Bandeiras) e com 3 (Painel)
  {const ESP={pt:['Exportar','Exportar PDF','Exportar XLS','Exportar CSV'],en:['Export','Export PDF','Export XLS','Export CSV'],es:['Exportar','Exportar PDF','Exportar XLS','Exportar CSV'],fr:['Exporter','Exporter en PDF','Exporter en XLS','Exporter en CSV'],de:['Exportieren','PDF exportieren','XLS exportieren','CSV exportieren']};
    // a tela da equipe tem 4 línguas (IDIOMAS_EQ); o alemão existe no dicionário e é conferido por ele
    const dic=await pg.evaluate(()=>['rel_exportar','rel_pdf_t','rel_xls_t','pn_csv'].map(k=>ETERNA.EQ[k]));ok(J(dic.map(v=>v[4]))===J(ESP.de)&&Object.keys(ESP).every((lg,i)=>J(dic.map(v=>v[i]))===J(ESP[lg])),'Dicionário dos rótulos do Exportar nas 5 línguas '+J(dic));
    ok(await pg.evaluate(()=>ETERNA.EQ.sl_csv.length===5&&ETERNA.EQ.es_baixar_csv.length===5&&ETERNA.EQ.sl_csv.every(f=>/CSV/.test(f(3)))&&ETERNA.EQ.es_baixar_csv.every(t=>/CSV/.test(t))),'Rótulos do CSV da Lista de vendas e dos dias nas 5 línguas');
    for(const lg of await pg.evaluate(()=>ETERNA.IDIOMAS_EQ.map(x=>x[0]))){const e=ESP[lg];await pg.evaluate(lg=>{window.__u=JSON.stringify(ETERNA.state.user);ETERNA.state.user.idioma=lg;ETERNA.state.view='bandeiras';ETERNA.render();},lg);
      ok(await pg.getAttribute('.head .rel-exp','aria-label')===e[0],lg+': aria-label do grupo');grupoOk(await grupo('.head .rel-exp'),['pdf','xlsx'],e.slice(1,3),lg+' Bandeiras');
      await pg.evaluate(()=>{ETERNA.state.view='painel';ETERNA.render();});grupoOk(await grupo('.pn-head .rel-exp'),['pdf','xlsx','csv'],e.slice(1),lg+' Painel');await volta();}}
  const chaves=await pg.evaluate(()=>Object.entries(ETERNA.EQ).filter(([k])=>k.startsWith('rel_')).map(([k,v])=>[k,Array.isArray(v)?v.length:0,Array.isArray(v)&&v.every(x=>typeof x==='function'?String(x(3,4)).length>0:typeof x==='string'&&x.length>0)]));
  ok(chaves.length>=17&&chaves.every(c=>c[1]===5&&c[2])&&['rel_exportar','rel_pdf','rel_xls','rel_pdf_t','rel_xls_t','rel_periodo','rel_posicao_em','rel_filtros','rel_gerado_em','rel_gerado_por','rel_interno','rel_pagina','rel_sem_linhas','rel_muitas_pdf','rel_falhou','rel_ok','rel_aud'].every(k=>chaves.some(c=>c[0]===k)),'Chaves rel_* nas 5 línguas: '+J(chaves.filter(c=>c[1]!==5||!c[2])));

  // ---------- critério 12: nada de print, rede ou vendor (o CSV de Jogos e ano a ano, que precisa do servidor, é coberto por agenda-estatisticas.js) ----------
  {const fonte=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const i=fonte.indexOf('// ---------- Exportar relatório (PDF | XLS)'),f=fonte.indexOf('const VIEWFN=');const bloco=fonte.slice(i,f).replace(/^\/\/.*$/gm,'');
    ok(i>0&&f>i&&!/\bprint\s*\(|fetch\s*\(|agFetch|XMLHttpRequest|sendBeacon|WebSocket|importScripts|vendor\//.test(bloco),'O bloco do Exportar chama impressão, rede ou vendor');
    ok((fonte.match(/@media print/g)||[]).length===1&&(fonte.match(/window\.print\(/g)||[]).length<=3,'index.html ganhou @media print ou window.print');}

  // ---------- critério 4: data e hora do cabeçalho no fuso do venue, mesmo com o aparelho em outro fuso ----------
  {const c2=await b.newContext({viewport:{width:1280,height:900},locale:'pt-BR',timezoneId:'Asia/Tokyo',acceptDownloads:true});await c2.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());const p2=await c2.newPage();p2.setDefaultTimeout(8000);p2.on('pageerror',e=>errs.push('Tóquio: '+e.message));
    await p2.goto(U);await p2.waitForTimeout(400);const adm=await entrarTeste.adminFicticio(p2);await entrarTeste(p2,adm);await p2.evaluate(()=>{ETERNA.state.view='bandeiras';ETERNA.render();});
    const espera=p2.waitForEvent('download',{timeout:3000}).catch(()=>null);const t0=Date.now();await p2.click('.rel-exp [data-fmt="pdf"]');const dl=await espera;
    if(dl){const pp=path.join(tmp,'toquio.pdf');await dl.saveAs(pp);const p=pdfLer(fs.readFileSync(pp));const l=p.linhas.find(x=>/^Gerado em: /.test(x))||'';
      const sp=ms=>{const o=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `Gerado em: ${o.day}/${o.month}/${o.year} ${o.hour}:${o.minute}`;};
      ok([t0-60e3,t0,t0+60e3].map(sp).includes(l),'Fuso do venue: "'+l+'" com o aparelho em Tóquio, esperado '+sp(t0));}else ok(false,'Fuso do venue: PDF não baixou');
    await c2.close();}


  await ctx.close();
}catch(e){fails.push('exceção: '+(e&&e.stack||e));}
finally{await b.close();fs.rmSync(tmp,{recursive:true,force:true});}
const bom=!fails.length&&!errs.length;console.log(`${bom?'OK':'FALHA'} relatorios${fails.length?' · '+fails.slice(0,6).join(' · '):''}${errs.length?' · erros: '+errs.slice(0,3).join(' | '):''}`);process.exit(bom?0:1);})();
