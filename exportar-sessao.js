const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function exportSession() {
  console.log("==========================================================");
  console.log("🚀 GERADOR DE PASSAPORTE MERCADO LIVRE (PARA NUVEM) 🚀");
  console.log("==========================================================");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "msedge",
    viewport: { width: 1280, height: 720 }
  });

  const page = context.pages()[0] || await context.newPage();

  console.log("-> Navegando para o Mercado Livre...");
  await page.goto("https://www.mercadolivre.com.br/afiliados/linkbuilder#hub");

  console.log("\n⚠️ ATENÇÃO: Faça o login normalmente no navegador que se abriu.");
  console.log("⚠️ Digite seu e-mail, senha e passe por qualquer verificação de SMS ou PIN.");
  console.log("\nAssim que a primeira tela do painel interno de afiliados carregar (onde gera links), eu vou detectar automaticamente e salvar sua sessão!");

  // Aguarda até o usuário completar o login e o elemento de "Gerar Link" aparecer
  await page.waitForSelector('button:has-text("Gerar"), input[placeholder*="http"]', { timeout: 300000 }); // 5 min de timeout

  console.log("\n✅ Login detectado com sucesso!");

  // Salva o passaporte (cookies e local storage) de forma não-criptografada
  const sessionPath = path.resolve(process.cwd(), "ml-session.json");
  await context.storageState({ path: sessionPath });

  console.log(`✅ SESSÃO SALVA EM: ml-session.json`);
  console.log(`Esse arquivo "ml-session.json" é o seu passaporte e PODE E DEVE ser enviado ao Github no próximo git push!`);

  await context.close();
  process.exit(0);
}

exportSession().catch(err => {
  console.error("Ops, deu erro:", err);
  process.exit(1);
});
