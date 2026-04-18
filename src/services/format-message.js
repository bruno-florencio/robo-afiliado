function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildHighlights(highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return [];
  }

  return highlights.slice(0, 3).map((item) => `- ${escapeHtml(item)}`);
}

function formatMessage({ campaign, product }) {
  const lines = [];
  const ctaText = campaign.ctaText || "Comprar agora";
  const sourceLabel =
    campaign.sourceLabel || (product.source === "amazon" ? "Amazon" : "Mercado Livre");

  if (campaign.messageTemplate) {
    lines.push(`<b>${escapeHtml(campaign.messageTemplate)}</b>`);
    lines.push("");
  }

  lines.push(escapeHtml(product.title));
  lines.push("");

  const price = formatCurrency(product.price);
  const originalPrice = formatCurrency(product.originalPrice);

  if (originalPrice && product.originalPrice > product.price) {
    lines.push(`💸 DE: <s>${originalPrice}</s>`);
  }

  if (price) {
    lines.push(`🔥 POR: <b>${price}</b>`);
    
    if (product.installments) {
      // Limpa os prefixos que os sites já trazem (como 'ou', 'em') para padronizar
      const instClean = product.installments.replace(/^(ou\s+)?(em\s+)?/i, '').trim();
      lines.push(`💳 ou em <b>${escapeHtml(instClean)}</b>`);
    }
  }

  if (product.coupon) {
    lines.push(`🎟️ <b>${escapeHtml(product.coupon.replace('Cupom', '').trim())}</b>`);
  }

  const featuresToUse = product.features && product.features.length ? product.features : campaign.highlights;
  const highlightLines = buildHighlights(featuresToUse);
  if (highlightLines.length > 0) {
    lines.push("");
    lines.push("✅ Destaques:");
    lines.push(...highlightLines);
  }

  lines.push("");
  lines.push(`🛒 Loja: <b>${escapeHtml(sourceLabel)}</b>`);
  lines.push(`🔗 Link do Produto:`);
  lines.push(product.url);

  if (campaign.disclosureText) {
    lines.push("");
    lines.push(`ℹ️ ${escapeHtml(campaign.disclosureText)}`);
  }

  if (campaign.hashtags.length > 0) {
    lines.push("");
    lines.push(
      campaign.hashtags.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ")
    );
  }

  return lines.join("\n");
}

module.exports = {
  formatMessage,
};
