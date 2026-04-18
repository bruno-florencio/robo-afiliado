const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");

async function manualLogin() {
  const userDataDir = path.resolve(process.cwd(), "data/mercadolivre/edge-profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  console.log("Abrindo navegador para você realizar o login no Mercado Livre...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "msedge",
    headless: false,
    viewport: { width: 1440, height: 960 },
    locale: "pt-BR"
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://www.mercadolivre.com.br/afiliados/linkbuilder#hub");

  console.log("=========================================================================");
  console.log("✅ O NAVEGADOR ESTÁ ABERTO!");
  console.log("Faça o login normalmente colocando o e-mail, senha e PIN.");
  console.log("Você tem 5 minutos de tela aberta. Ao finalizar, ela fechará e salvará tudo!");
  console.log("=========================================================================");

  // Espera exatos 5 minutos para dar tempo total pro usuário digitar códigos e SMS.
  await new Promise(resolve => setTimeout(resolve, 300 * 1000));

  await context.close();
  console.log("A sessão e os cookies foram salvos permanentemente com sucesso!");
}

manualLogin().catch(console.error);
