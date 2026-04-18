const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { loadConfig } = require("../config");
const { createTelegramClient } = require("../lib/telegram");
const { createHistoryStore } = require("../services/history-store");
const { formatMessage } = require("../services/format-message");

const AMAZON_DEALS_URL = "https://www.amazon.com.br/deals?ref_=nav_cs_gb";

async function saveDebugSnapshot(page, name) {
  const dir = path.resolve(process.cwd(), "data/amazon");
  fs.mkdirSync(dir, { recursive: true });
  const safeName = name.replace(/[^\w.-]+/g, "-");
  const screenshotPath = path.join(dir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });
  return screenshotPath;
}

async function loginIfNeeded(page, env) {
  if (await page.locator('#nav-link-accountList-nav-line-1:has-text("Olá, faça seu login")').count() === 0) {
    if (await page.locator('text=SiteStripe').count() > 0) {
      console.log("-> [Amazon] Login já efetuado na sessão salva. Barra SiteStripe presente!");
      return;
    }
  }

  console.log("-> [Amazon] Iniciando fluxo de Login automático...");
  await page.click('#nav-link-accountList');
  await page.waitForTimeout(3000);

  if (await page.locator('#ap_email').count() > 0) {
    console.log("-> [Amazon] Preenchendo email...");
    await page.fill('#ap_email', env.AMAZON_AGENT_USERNAME);
    await page.click('.a-button-input[type="submit"]');
    await page.waitForTimeout(3000);
  }

  if (await page.locator('#ap_password').count() > 0) {
    console.log("-> [Amazon] Preenchendo senha...");
    await page.fill('#ap_password', env.AMAZON_AGENT_PASSWORD);
    await page.click('#signInSubmit');
    await page.waitForTimeout(5000);
  }

  if (await page.locator('text=SiteStripe').count() === 0) {
     console.log("-> [Amazon] ATENÇÃO: Barra SiteStripe não detectada! Pode estar pedindo 2FA/Captcha.");
     await saveDebugSnapshot(page, "amazon-login-falha-ou-captcha");
     throw new Error("Não foi possível acessar a barra de Afiliados. Verifique se a Amazon exigiu Captcha/SMS.");
  }
}

async function waitForAny(page, selectors, timeout = 10000) {
  for (const selector of selectors) {
    if ((await page.locator(selector).count()) > 0) return selector;
  }
  return null;
}

async function extractDealsFromGrid(page, historyStore, campaignId) {
  console.log("-> [Amazon] Analisando as Ofertas do Dia...");
  
  // A classe das ofertas muda frequentemente, vamos tentar alguns seletores comuns da Grid de Deals
  await page.waitForSelector('[data-testid="product-card"], [class*="GridItem-module__container"]', { timeout: 15000 }).catch(() => {});
  
  const dealCards = page.locator('[data-testid="product-card"], [class*="GridItem-module__container"]');
  const count = await dealCards.count();
  console.log(`-> [Amazon] ${count} cartões de oferta detectados na tela.`);

  for (let i = 0; i < count; i++) {
    const card = dealCards.nth(i);
    let linkLocator = card.locator('a.a-link-normal').first();
    
    if (await linkLocator.count() === 0) {
      linkLocator = card.locator('a').first();
    }
    
    if (await linkLocator.count() > 0) {
      const dealUrl = await linkLocator.getAttribute("href");
      
      let cleanUrl = dealUrl;
      try {
        const fullUrl = new URL(dealUrl, "https://www.amazon.com.br");
        // Remove todos os parametros de rastreamento (ref, pf_rd_r, etc) que a Amazon rotaciona a cada refresh
        fullUrl.search = ""; 
        cleanUrl = fullUrl.toString();
      } catch (e) { }

      // Se não tem barra ou https normaliza
      if (cleanUrl.startsWith("/")) cleanUrl = "https://www.amazon.com.br" + cleanUrl;

      if (!historyStore.hasRecentProduct({ campaignId, productId: cleanUrl })) {
         console.log(`-> [Amazon] Oferta inédita escolhida!`);
         return cleanUrl;
      }
    }
  }

  await saveDebugSnapshot(page, "amazon-deals-none-available");
  throw new Error("Nenhuma oferta inédita encontrada na primeira tela de Deals.");
}

async function extractProductDetails(page) {
  console.log("-> [Amazon] Extraindo informações do Produto...");
  
  let title = await page.locator('#productTitle').innerText().catch(() => "");
  
  // Amazon tem várias formas de mostrar preço (priceToPay, apexPrice, etc)
  let price = "";
  let originalPrice = "";

  const priceLocator = page.locator('.priceToPay span.a-offscreen, #corePrice_feature_div .a-price span.a-offscreen, .apexPriceToPay span.a-offscreen, span.a-price span.a-offscreen').first();
  if (await priceLocator.count() > 0) {
     price = await priceLocator.innerText();
  } else {
     // Fallback brutal
     const rawPrice = await page.locator('.priceToPay, .a-price').first().innerText().catch(() => "");
     price = rawPrice.split('\n').join(''); // Remove quebras de linha se o price whole e fraction vierem separados
  }

  const basisLocator = page.locator('span.a-text-price span.a-offscreen').first();
  if (await basisLocator.count() > 0) {
     originalPrice = await basisLocator.innerText();
  }
  
  let installments = await page.locator('#installmentCalculator_feature_div .best-offer-name').innerText().catch(() => "");

  // Imagem principal
  let imageUrl = await page.locator('#landingImage').getAttribute("src").catch(() => "");

  const cleanNumber = (value) => {
    if (!value) return undefined;
    const normalized = String(value).replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    id: title.slice(0, 30),
    title: title.trim(),
    price: cleanNumber(price),
    originalPrice: cleanNumber(originalPrice),
    installments: installments.trim(),
    imageUrl,
    url: page.url()
  };
}

async function generateAffiliateLink(page) {
  console.log("-> [Amazon] Requisitando SiteStripe (Amzn.to)...");
  
  // Tenta achar o botão "Texto" antigo, se não achar tenta o "Obter link" novo
  let siteStripeBtn = page.locator('#amzn-ss-text-link-button').first();
  if (await siteStripeBtn.count() === 0) {
     siteStripeBtn = page.locator('text="Obter link"').first();
  }
  
  if (await siteStripeBtn.count() === 0) {
     await saveDebugSnapshot(page, "amazon-no-sitestripe");
     throw new Error("Botão de obter link do SiteStripe não encontrado na página do produto.");
  }
  
  await siteStripeBtn.click();
  
  // Espera a caixa de diálogo do link carregar (seja o textarea antigo ou novo)
  await page.waitForSelector('#amzn-ss-text-shortlink-textarea, textarea', { timeout: 10000 }).catch(() => {});
  
  const textArea = page.locator('#amzn-ss-text-shortlink-textarea, textarea').first();
  if (await textArea.count() > 0) {
     const shortUrl = await textArea.inputValue();
     if (shortUrl && shortUrl.includes("amzn.to")) {
        return shortUrl;
     }
  }
  
  await saveDebugSnapshot(page, "amazon-linkbuilder-failed");
  throw new Error("Falha ao puxar o amzn.to do painel SiteStripe.");
}

async function runAmazonAgent() {
  const config = loadConfig();
  const env = config.env;
  const historyStore = createHistoryStore();
  const telegram = createTelegramClient(env.TELEGRAM_BOT_TOKEN);
  const isCloud = !!process.env.RENDER || !!process.env.CI || process.env.NODE_ENV === "production";
  
  const launchOptions = {
    headless: isCloud,
    channel: isCloud ? undefined : "msedge",
    viewport: { width: 1440, height: 960 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"]
  };

  const sessionPath = path.resolve(process.cwd(), "amazon-session.json");
  const hasSession = fs.existsSync(sessionPath);

  let browser, context;

  if (isCloud || hasSession) {
    console.log(hasSession ? "[Amazon] Usando passaporte/sessão exportado (amazon-session.json)" : "[Amazon] Iniciando em nuvem...");
    browser = await chromium.launch({ ...launchOptions });
    context = await browser.newContext({ ...launchOptions, storageState: hasSession ? sessionPath : undefined });
  } else {
    console.log("[Amazon] Entrando em modo Persistent Profile no Edge Local.");
    const userDataDir = path.resolve(process.cwd(), "data/amazon/edge-profile");
    fs.mkdirSync(userDataDir, { recursive: true });
    launchOptions.channel = "msedge";
    context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(AMAZON_DEALS_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    await loginIfNeeded(page, env);
    
    // As vezes o login redireciona, voltar pra Offers
    if (!page.url().includes("/deals")) {
       await page.goto(AMAZON_DEALS_URL, { waitUntil: "domcontentloaded" });
       await page.waitForTimeout(3000);
    }

    const campaign = config.campaigns.find(c => c.id === "amazon-eletronicos") || {
      id: "amazon-ofertas-do-dia",
      messageTemplate: "Oferta do dia na Amazon",
      ctaText: "Ver oferta na Amazon",
      sourceLabel: "Amazon Brasil",
      disclosureText: "⚠️ Oferta e preço sujeitos a alteração rápida.",
      highlights: [],
      hashtags: ["amazon", "oferta", "promo"],
    };

    const targetUrl = await extractDealsFromGrid(page, historyStore, campaign.id);
    console.log(`-> [Amazon] Navegando para produto: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    const product = await extractProductDetails(page);
    const affiliateUrl = await generateAffiliateLink(page);
    product.url = affiliateUrl; // Substitui pela curtinha do affiliado

    const caption = formatMessage({ campaign, product });
    await telegram.sendOffer({
      chatId: env.TELEGRAM_CHAT_ID,
      caption,
      imageUrl: product.imageUrl,
    });

    historyStore.remember({ campaignId: campaign.id, productId: targetUrl });
    
    const outputPath = path.resolve(process.cwd(), "data/amazon/last-product.json");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(product, null, 2));

    console.log(`✅ [Amazon] Produto publicado no Telegram: ${product.title}`);
    console.log(`✅ [Amazon] Link afiliado gerado: ${affiliateUrl}`);
  } finally {
    await context.close().catch(() => { });
    if (browser) await browser.close().catch(() => {});
  }
}

if (require.main === module) {
  runAmazonAgent().catch(async (error) => {
    console.error("❌ Falha no Agente Amazon:", error);
    process.exitCode = 1;
  });
}

module.exports = { runAmazonAgent };
