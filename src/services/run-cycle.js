const { fetchAmazonProducts } = require("../providers/amazon-paapi");
const { fetchMercadoLivreProducts } = require("../providers/mercadolivre");
const { formatMessage } = require("./format-message");
const { pickProduct } = require("./pick-product");

async function loadProductsForCampaign({ campaign, env }) {
  if (campaign.provider === "amazon") {
    return fetchAmazonProducts({ campaign, env });
  }

  if (campaign.provider === "mercadolivre") {
    return fetchMercadoLivreProducts({ campaign, env });
  }

  return [];
}

async function runCycle({ config, telegram, historyStore }) {
  const enabledCampaigns = config.campaigns.filter((campaign) => campaign.enabled);

  for (const campaign of enabledCampaigns) {
    let products = [];
    try {
      products = await loadProductsForCampaign({
        campaign,
        env: config.env,
      });
    } catch (error) {
      console.error(`Falha ao carregar produtos da campanha ${campaign.id}:`, error);
      continue;
    }

    const product = pickProduct(products, campaign, historyStore);
    if (!product) {
      continue;
    }

    const caption = formatMessage({ campaign, product });

    await telegram.sendOffer({
      chatId: config.env.TELEGRAM_CHAT_ID,
      caption,
      imageUrl: product.imageUrl,
    });

    historyStore.remember({
      campaignId: campaign.id,
      productId: product.id,
    });

    return {
      campaignId: campaign.id,
      product,
    };
  }

  return null;
}

module.exports = {
  runCycle,
};
