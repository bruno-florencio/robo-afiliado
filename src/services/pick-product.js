function isWithinPriceRange(product, campaign) {
  if (campaign.minPrice && product.price < campaign.minPrice) {
    return false;
  }

  if (campaign.maxPrice && product.price > campaign.maxPrice) {
    return false;
  }

  return true;
}

function pickProduct(products, campaign, historyStore) {
  const eligible = products
    .filter((product) => isWithinPriceRange(product, campaign))
    .filter((product) =>
      !historyStore.hasRecentProduct({
        campaignId: campaign.id,
        productId: product.id,
      })
    );

  if (eligible.length === 0) {
    return null;
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}

module.exports = {
  pickProduct,
};
