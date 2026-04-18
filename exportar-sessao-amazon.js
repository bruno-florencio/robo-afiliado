const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function exportSessionAmazon() {
  console.log("==========================================================");
  console.log("🔥 GERADOR DE PASSAPORTE AMAZON ASSOCIADOS (NUVEM) 🔥");
  console.log("==========================================================");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    channel: "msedge",
    viewport: { width: 1280, height: 720 },
    locale: "pt-BR"
  });

  const page = context.pages()[0] || await context.newPage();
  
  console.log("-> Navegando para a página inicial da Amazon Brasil...");
  await page.goto("https://www.amazon.com.br/");

  console.log("\n⚠️ ATENÇÃO: Faça o login normalmente no navegador clicando em 'Faça seu login' no topo direito.");
  console.log("⚠️ Digite seu e-mail, senha e passe por qualquer verificação (Captcha/SMS).");
  console.log("\nAssim que a barra cinza de Associados Amazon (SiteStripe) aparecer no topo confirmando que você é afiliado, eu vou detectar e salvar sua aba!");

  // Aguarda até o usuário completar o login e a barra SiteStripe carregar
  await page.locator('text=SiteStripe').first().waitFor({ state: 'visible', timeout: 300000 });
  
  console.log("\n✅ Barra SiteStripe detectada com sucesso! Você está logado.");
  
  // Salva o passaporte (cookies)
  const sessionPath = path.resolve(process.cwd(), "amazon-session.json");
  await context.storageState({ path: sessionPath });

  console.log(`✅ SESSÃO SALVA EM: amazon-session.json`);
  console.log(`Pode fechar a janela. Faça o 'git add amazon-session.json' após enviar!`);

  await context.close();
  process.exit(0);
}

exportSessionAmazon().catch(err => {
  console.error("Ops, deu erro:", err);
  process.exit(1);
});
