const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const { loadConfig } = require("../config");
const { createTelegramClient } = require("../lib/telegram");
const { formatMessage } = require("../services/format-message");
const { createHistoryStore } = require("../services/history-store");

const DEFAULT_OFFERS_URL =
  "https://www.mercadolivre.com.br/ofertas?promotion_type=deal_of_the_day#filter_applied=promotion_type&filter_position=2&origin=qcat";
const DEFAULT_LINKBUILDER_URL =
  "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub";

function ensureDebugDir() {
  const dir = path.resolve(process.cwd(), "data/mercadolivre");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function saveDebugSnapshot(page, name) {
  const dir = ensureDebugDir();
  const safeName = name.replace(/[^\w.-]+/g, "-");
  const screenshotPath = path.join(dir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { });
  return screenshotPath;
}

async function saveDebugHtml(page, name) {
  const dir = ensureDebugDir();
  const safeName = name.replace(/[^\w.-]+/g, "-");
  const htmlPath = path.join(dir, `${safeName}.html`);
  const content = await page.content().catch(() => "");
  fs.writeFileSync(htmlPath, content, "utf8");
  return htmlPath;
}

function getLoginFieldSelectors() {
  return [
    'input[type="email"]',
    'input[name="user_id"]',
    'input[id="user_id"]',
    'input[autocomplete="username"]',
    'input[placeholder*="E-mail"]',
    'input[placeholder*="e-mail"]',
    'input[placeholder*="telefone"]',
  ];
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        return true;
      }
    }
  }

  return false;
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.fill(value);
        return true;
      }
    }
  }

  return false;
}

async function loginIfNeeded(page, env) {
  if (!env.MERCADOLIVRE_AGENT_USERNAME || !env.MERCADOLIVRE_AGENT_PASSWORD) {
    throw new Error("Credenciais do agente Mercado Livre nao configuradas no .env.");
  }

  const loginFieldSelectors = getLoginFieldSelectors();
  const hasLoginButton =
    (await page.locator('a[href*="login"], button:has-text("Entrar"), a:has-text("Entre")').count()) >
    0;
  const hasEmailField =
    (await page.locator(loginFieldSelectors.join(", ")).count()) > 0;
  const hasUserMenu =
    (await page.locator('a[href*="/perfil"], [data-testid="nav-menu-user"]').count()) > 0;
  const looksLikeLoginScreen =
    page.url().includes("/login") ||
    (await page.locator('text=/iniciar sess[aã]o/i').count()) > 0 ||
    (await page.locator('text=/Digite seu e-mail/i').count()) > 0;

  if (hasUserMenu || (!hasLoginButton && !hasEmailField && !looksLikeLoginScreen)) {
    return;
  }

  if (hasLoginButton && !hasEmailField) {
    await clickFirst(page, [
      'a[href*="login"]',
      'button:has-text("Entrar")',
      'a:has-text("Entre")',
    ]);
    await page.waitForLoadState("domcontentloaded").catch(() => { });
    await page.waitForTimeout(3000);
  }

  const filledEmail = await fillFirst(page, loginFieldSelectors, env.MERCADOLIVRE_AGENT_USERNAME);

  if (!filledEmail) {
    await saveDebugSnapshot(page, "mercadolivre-login-missing-email");
    await saveDebugHtml(page, "mercadolivre-login-missing-email");
    throw new Error("Nao encontrei o campo de email/login do Mercado Livre.");
  }

  await clickFirst(page, ['button:has-text("Continuar")', 'button[type="submit"]']);
  await page.waitForLoadState("domcontentloaded").catch(() => { });
  await page.waitForTimeout(3000);

  await clickFirst(page, [
    '#password_validation .andes-ui-list__item-actionable',
    '#password_validation button',
    'li#password_validation',
    'button:has-text("Senha")',
  ]);
  await page.waitForLoadState("domcontentloaded").catch(() => { });
  await page.waitForTimeout(2000);

  const filledPassword = await fillFirst(page, [
    'input[type="password"]',
    'input[name="password"]',
    'input[id="password"]',
  ], env.MERCADOLIVRE_AGENT_PASSWORD);

  if (!filledPassword) {
    await saveDebugSnapshot(page, "mercadolivre-login-missing-password");
    await saveDebugHtml(page, "mercadolivre-login-missing-password");
    throw new Error("Nao encontrei o campo de senha do Mercado Livre.");
  }

  await clickFirst(page, ['button:has-text("Entrar")', 'button[type="submit"]']);
  await page.waitForLoadState("domcontentloaded").catch(() => { });
  await page.waitForTimeout(4000);

  // Tentativa rapida de preencher o PIN informado se a tela pedir
  const codeSelectors = [
    'input[name="code"]',
    'input[autocomplete="one-time-code"]',
    'input[type="tel"]',
    'input[autocomplete="off"]'
  ];
  try {
    for (const s of codeSelectors) {
      if ((await page.locator(s).count()) > 0) {
        if (await page.locator(s).first().isVisible()) {
          await page.locator(s).first().fill("752243");
          await page.waitForTimeout(500);
          await clickFirst(page, [
            'button:has-text("Continuar")',
            'button:has-text("Verificar")',
            'button[type="submit"]'
          ]);
          await page.waitForTimeout(4000);
          break;
        }
      }
    }
  } catch (e) {
    // ignorar falhas silenciosamente nessa heuristica
  }
}

async function extractFirstUnpublishedOffer(page, historyStore, campaignId) {
  const productSelectors = [
    'a[href*="/p/"]',
    'a.ui-search-link',
    'a.poly-component__title',
    'a[href*="MLB"]',
  ];

  let productLink = null;
  let productIdForHistory = null;

  for (const selector of productSelectors) {
    const locators = await page.locator(selector).all();
    if (locators.length > 0) {
      for (const locator of locators) {
        const href = await locator.getAttribute("href");
        if (href) {
          let cleanUrl = href;
          try {
            const urlObj = new URL(href);
            urlObj.search = "";
            urlObj.hash = "";
            cleanUrl = urlObj.toString();
          } catch (e) { }

          if (!(await historyStore.hasRecentProduct({ campaignId, productId: cleanUrl }))) {
            productLink = href;
            productIdForHistory = cleanUrl;
            break;
          }
        }
      }
      if (productLink) {
        break;
      }
    }
  }

  if (!productLink) {
    await saveDebugSnapshot(page, "mercadolivre-offers-no-product-links");
    await saveDebugHtml(page, "mercadolivre-offers-no-product-links");
    throw new Error("Nao encontrei nenhum link de produto inidito na pagina de ofertas.");
  }

  const detailPage = await page.context().newPage();
  await detailPage.goto(productLink, { waitUntil: "commit", timeout: 45000 }).catch(e => console.error("Aviso: Timeout no goto, mas seguindo...", e.message));
  await detailPage.waitForTimeout(4000);

  const title = await detailPage
    .locator("h1, .ui-pdp-title")
    .first()
    .textContent()
    .catch(() => null);

  const pricingData = await detailPage.evaluate(() => {
    let priceText = null;
    let centsText = null;
    let originalPriceText = null;
    let installmentsText = null;

    // Pega o preço original que fica dentro da tag <s> ou da classe de valor original
    const oldPriceNode = document.querySelector('s .andes-money-amount__fraction, .ui-pdp-price__original-value .andes-money-amount__fraction');
    if (oldPriceNode) {
      originalPriceText = oldPriceNode.innerText || oldPriceNode.textContent || "";
    }

    // Para o preço principal, iteramos nas frações e ignoramos as que são do preço antigo ou parcelamento baixo (menor contextualmente)
    // O meta tag [itemprop="price"] é a fonte mais segura de todas
    const metaPrice = document.querySelector('meta[itemprop="price"]');

    // Pega as frações de preço, e ignora as que estão dentro de <s> ou são o original
    const allFractions = document.querySelectorAll('.andes-money-amount__fraction, .price-tag-fraction');
    for (const node of allFractions) {
      if (node !== oldPriceNode && !node.closest('s') && !node.closest('.ui-pdp-price__original-value')) {
        priceText = node.innerText || node.textContent || "";
        const cNode = node.parentElement ? node.parentElement.querySelector('.andes-money-amount__cents, .price-tag-cents') : null;
        if (cNode) centsText = cNode.innerText || cNode.textContent || "";
        break;
      }
    }

    // Se achou no meta, a gente força porque é 100% oficial
    if (metaPrice && metaPrice.content && !priceText) {
      const parts = metaPrice.content.split('.');
      priceText = parts[0];
      if (parts[1]) centsText = parts[1];
    }

    // Busca a linha de parcelamento pra evitar a ideia de que o preço é só a vista
    const possibleInstNodes = document.querySelectorAll('.ui-pdp-price__sub-subtitle, .ui-pdp-payment-icon__text, .ui-pdp-color--GREEN');
    for (const node of possibleInstNodes) {
      const rawText = node.innerText || node.textContent || "";
      const text = rawText.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const match = text.match(/(\d+\s*x.*?(?:juros|OFF))/i);
      if (match) {
        installmentsText = match[1].trim();
        break;
      }
    }

    let couponText = null;
    const couponNode = document.querySelector('.ui-pdp-promotions-pill-label, .ui-pdp-promotions-badge__text, label[for*="coupon"]');
    if (couponNode) {
      const rawCoupon = couponNode.innerText || couponNode.textContent || "";
      if (/cupom|aplicar/i.test(rawCoupon)) couponText = rawCoupon.trim();
    }

    return { priceText, centsText, originalPriceText, installmentsText, couponText };
  }).catch((err) => {
    console.error("ERRO NO EVALUATE DE PRECO:", err);
    return { priceText: null, centsText: null, originalPriceText: null, installmentsText: null, couponText: null };
  });

  console.log("\n==============================");
  console.log("🔥 DUMP DO PREÇO EXTRAIDO 🔥");
  console.log(JSON.stringify(pricingData, null, 2));
  console.log("==============================\n");

  const { priceText, centsText, originalPriceText, installmentsText, couponText } = pricingData;

  const imageUrl =
    (await detailPage.locator('.ui-pdp-gallery__figure img').first().getAttribute("src").catch(() => null)) ||
    (await detailPage.locator('.ui-pdp-image.ui-pdp-gallery__figure__image').first().getAttribute("src").catch(() => null)) ||
    (await detailPage.locator('.ui-search-result-image__header img').first().getAttribute("src").catch(() => null)) ||
    (await detailPage.locator('img[decoding="async"]').first().getAttribute("src").catch(() => null)) ||
    (await detailPage.locator("img").first().getAttribute("src").catch(() => null));

  const features = await detailPage.evaluate(() => {
    const list = document.querySelectorAll('.ui-vpp-highlighted-specs__features-list li, .ui-pdp-specs__table tbody tr, .ui-pdp-list--bullet li, .ui-pdp-features__list li');
    if (!list || list.length === 0) return [];

    const items = [];
    for (const node of list) {
      if (items.length >= 6) break; // Limitando aos 6 primeiros mais importantes pra não floodar o post

      // Se for linha de tabela técnica
      const th = node.querySelector('th');
      const td = node.querySelector('td span, td');

      if (th && td) {
        const key = th.innerText.trim();
        const val = td.innerText.trim();
        if (key && val) items.push(`${key}: ${val}`);
      } else {
        // Se for lista de bullet ("O que você precisa saber...")
        const text = node.innerText.trim();
        if (text && text.length > 2) items.push(text);
      }
    }
    return items;
  }).catch(() => []);

  const cleanNumber = (value, cents) => {
    if (!value) {
      return undefined;
    }

    const normalized = String(value).replace(/\./g, "").replace(",", "");
    const joined = cents ? `${normalized}.${String(cents).replace(/\D/g, "")}` : normalized;
    const parsed = Number.parseFloat(joined.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const product = {
    id: productIdForHistory,
    title: (title || "").trim(),
    price: cleanNumber(priceText, centsText),
    originalPrice: cleanNumber(originalPriceText),
    installments: installmentsText,
    coupon: couponText,
    url: productLink,
    imageUrl,
    features,
    source: "mercadolivre",
  };

  if (!product.title || !product.url) {
    await saveDebugSnapshot(detailPage, "mercadolivre-product-missing-fields");
    throw new Error("Nao consegui extrair titulo/url do produto do Mercado Livre.");
  }

  await detailPage.close();
  return product;
}

async function generateAffiliateLink(page, productUrl, env) {
  const linkBuilderUrl = env.MERCADOLIVRE_AFFILIATE_LINKBUILDER_URL || DEFAULT_LINKBUILDER_URL;
  await page.goto(linkBuilderUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await loginIfNeeded(page, env);
  await page.goto(linkBuilderUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const filled = await fillFirst(page, [
    'input[type="url"]',
    'input[placeholder*="link"]',
    'input[placeholder*="URL"]',
    'textarea',
  ], productUrl);

  if (!filled) {
    await saveDebugSnapshot(page, "mercadolivre-linkbuilder-missing-input");
    await saveDebugHtml(page, "mercadolivre-linkbuilder-missing-input");
    throw new Error("Nao encontrei o campo para gerar o link de afiliado.");
  }

  await clickFirst(page, [
    'button:has-text("Gerar")',
    'button:has-text("Criar")',
    'button:has-text("Montar")',
    'button[type="submit"]',
  ]);
  await page.waitForTimeout(2500);

  const candidates = [
    'input[value^="http"]',
    'textarea',
    '[data-testid*="link"] input',
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).last();
    if ((await locator.count()) > 0) {
      const value = await locator.inputValue().catch(() => null);
      if (value && value.startsWith("http")) {
        return value;
      }
    }
  }

  await saveDebugSnapshot(page, "mercadolivre-linkbuilder-no-result");
  throw new Error("Nao consegui capturar o link de afiliado gerado.");
}

async function runMercadoLivreAgent() {
  const config = loadConfig();
  const env = config.env;
  const offersUrl = env.MERCADOLIVRE_OFFERS_URL || DEFAULT_OFFERS_URL;
  const historyStore = createHistoryStore();
  const telegram = createTelegramClient(env.TELEGRAM_BOT_TOKEN);
  const isCloud = !!process.env.RENDER || !!process.env.CI || process.env.NODE_ENV === "production";
  
  const cloudArgs = isCloud ? [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--mute-audio",
    "--no-first-run",
    "--js-flags=--max-old-space-size=256",
  ] : ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"];

  const launchOptions = {
    headless: isCloud,
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
    args: cloudArgs,
  };

  const sessionPath = path.resolve(process.cwd(), "ml-session.json");
  const hasSession = fs.existsSync(sessionPath);

  let browser, context;

  if (isCloud || hasSession) {
    // Na nuvem usamos o Chromium padrão, localmente com sessão usamos o Edge
    console.log(hasSession ? "[Robô] Usando passaporte/sessão exportado (ml-session.json)" : "[Robô] Iniciando em nuvem sem passaporte.");
    browser = await chromium.launch({ ...launchOptions, channel: isCloud ? undefined : "msedge" });
    context = await browser.newContext({ ...launchOptions, storageState: hasSession ? sessionPath : undefined });
  } else {
    // Em casa (Windwos Local), rodamos no Edge para reaproveitar os perfis de sessão como você via no teste
    console.log("[Robô] Entrando em modo Persistent Profile no Edge Local.");
    const userDataDir = path.resolve(process.cwd(), "data/mercadolivre/edge-profile");
    fs.mkdirSync(userDataDir, { recursive: true });
    launchOptions.channel = "msedge";
    context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(offersUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await loginIfNeeded(page, env);
    await page.goto(offersUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const campaign = {
      id: "mercadolivre-browser-agent",
      messageTemplate: "Oferta do dia no Mercado Livre",
      ctaText: "Abrir oferta no Mercado Livre",
      sourceLabel: "Mercado Livre",
      disclosureText: "Link de afiliado sujeito a disponibilidade da promocao.",
      highlights: [
        "oferta capturada automaticamente nas promocoes do dia",
        "link de afiliado gerado pelo agente",
        "preco e estoque podem mudar sem aviso",
      ],
      hashtags: ["mercadolivre", "oferta", "promo"],
    };

    const product = await extractFirstUnpublishedOffer(page, historyStore, campaign.id);
    const affiliateUrl = await generateAffiliateLink(page, product.url, env);
    product.url = affiliateUrl;

    const caption = formatMessage({ campaign, product });
    await telegram.sendOffer({
      chatId: env.TELEGRAM_CHAT_ID,
      caption,
      imageUrl: product.imageUrl,
    });

    await historyStore.remember({
      campaignId: campaign.id,
      productId: product.id,
    });

    const outputPath = path.resolve(process.cwd(), "data/mercadolivre/last-product.json");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(product, null, 2));

    console.log(`Produto publicado no Telegram: ${product.title}`);
    console.log(`Link afiliado: ${affiliateUrl}`);
  } finally {
    await context.close().catch(() => { });
    if (browser) {
       await browser.close().catch(() => {});
    }
  }
}

runMercadoLivreAgent().catch(async (error) => {
  console.error("Falha no agente navegador do Mercado Livre:", error);
  process.exitCode = 1;
});
