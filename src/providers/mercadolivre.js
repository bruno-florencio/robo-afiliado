const { fetchJson } = require("../lib/http");

function buildAffiliateUrl(itemUrl, campaign) {
  if (campaign.affiliateMode === "template" && campaign.affiliateTemplate) {
    return campaign.affiliateTemplate.replace("{url}", encodeURIComponent(itemUrl));
  }

  return itemUrl;
}

function mapMercadoLivreItem(item, campaign) {
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    originalPrice: item.original_price || undefined,
    url: buildAffiliateUrl(item.permalink, campaign),
    imageUrl: item.thumbnail ? item.thumbnail.replace("-I.", "-O.") : undefined,
    source: "mercadolivre",
  };
}

async function fetchSearchProducts({ campaign, env }) {
  const keyword =
    campaign.keywords[Math.floor(Math.random() * campaign.keywords.length)];
  const params = new URLSearchParams({
    q: keyword,
    limit: String(campaign.limit || 10),
  });
  try {
    const data = await fetchJson(
      `https://api.mercadolibre.com/sites/${env.MERCADOLIVRE_SITE_ID}/search?${params.toString()}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36" } },
      "API do Mercado Livre"
    );

    return (data.results || [])
      .map((item) => mapMercadoLivreItem(item, campaign))
      .filter((item) => item.title && item.url && Number.isFinite(item.price));
  } catch (err) {
    console.error(`[API ML] Falha silenciosa contornada: ${err.message}`);
    return [];
  }
}

async function fetchMercadoLivreProducts({ campaign, env }) {
  if (campaign.mode === "manual") {
    return campaign.manualProducts.map((item) => ({
      ...item,
      source: "mercadolivre",
    }));
  }

  return fetchSearchProducts({ campaign, env });
}

module.exports = {
  fetchMercadoLivreProducts,
};
