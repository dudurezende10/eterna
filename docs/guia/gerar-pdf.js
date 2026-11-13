// Gera docs/Entendendo-o-Eterna.pdf a partir de docs/guia/entendendo-o-eterna.html.
// Usa o Chrome instalado no computador (playwright, channel "chrome").
//
// Uso (na raiz do repositório):
//   node docs/guia/gerar-pdf.js
// Se o playwright não estiver instalado no projeto, aponte para outra pasta com ele:
//   NODE_PATH=<pasta>/node_modules node docs/guia/gerar-pdf.js
//
// Antes de gravar, confere se algum conteúdo passou do fim da página ou invadiu o rodapé
// e lista as páginas com problema (o PDF é gerado mesmo assim).
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const HTML = path.join(__dirname, "entendendo-o-eterna.html");
const PDF = path.join(__dirname, "..", "Entendendo-o-Eterna.pdf");

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print" });
    await page.goto(pathToFileURL(HTML).href, { waitUntil: "load" });
    await page.waitForSelector("html[data-pronto='1']");

    const problemas = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("section.pagina").forEach((sec, i) => {
        const caixa = sec.getBoundingClientRect();
        const rodape = sec.querySelector(".rodape");
        const limite = rodape ? rodape.getBoundingClientRect().top - 1 : caixa.bottom;
        let pior = 0;
        sec.querySelectorAll("*").forEach((el) => {
          if (el.closest(".rodape") || el.closest(".pe")) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          if (r.bottom > limite) pior = Math.max(pior, r.bottom - limite);
          if (r.right > caixa.right + 0.5) pior = Math.max(pior, r.right - caixa.right);
        });
        if (pior > 0.5) out.push(`página ${i + 1} (${sec.id || "sem id"}): passa ${pior.toFixed(0)} px do limite`);
      });
      return out;
    });

    await page.pdf({
      path: PDF,
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const total = await page.evaluate(() => document.querySelectorAll("section.pagina").length);
    console.log(`PDF gerado: ${PDF} (${total} páginas)`);
    if (problemas.length) {
      console.log("Atenção, conteúdo fora da página:");
      problemas.forEach((p) => console.log("  - " + p));
      process.exitCode = 2;
    } else {
      console.log("Nenhuma página com conteúdo cortado.");
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
