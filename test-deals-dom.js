const { chromium } = require("playwright");

async function checkDeals() {
  const browser = await chromium.launch({ channel: "msedge", headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto("https://www.amazon.com.br/deals?ref_=nav_cs_gb", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  
  const extract = await page.evaluate(() => {
    // Busca qualquer a-link-normal que tenha imagem dentro do card, 
    // ou pega uma amostra das classes do main content div
    const cards = Array.from(document.querySelectorAll('div[data-testid]'));
    const testIds = cards.map(c => c.getAttribute('data-testid')).filter(id => id.includes("deal") || id.includes("card") || id.includes("grid"));
    
    // As in the screenshot, items are likely in a div grid.
    const items = Array.from(document.querySelectorAll('.a-section > div > div > img, div[class*="deal"], div[class*="Grid"]')).slice(0, 10);
    const classNames = items.map(el => el.className);
    
    // Another heuristic: find the highest wrapping list or grid
    const linkClasses = Array.from(document.querySelectorAll('a.a-link-normal[aria-hidden="true"]')).slice(0,3).map(el => el.parentElement.parentElement.className);
    
    return { testIds, classNames, linkClasses, html: document.body.innerHTML.substring(0, 500) };
  });

  console.log("Extracted Info:", extract);
  await browser.close();
}

checkDeals().catch(console.error);
