const crypto = require("node:crypto");
const { fetchJson } = require("../lib/http");

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function sha256(value, encoding = "hex") {
  return crypto.createHash("sha256").update(value, "utf8").digest(encoding);
}

function signRequest({ accessKey, secretKey, region, host, body, target }) {
  const service = "ProductAdvertisingAPI";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = "/paapi5/searchitems";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const payloadHash = sha256(body);
  const canonicalRequest = [
    "POST",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");

  return {
    authorization:
      `${algorithm} Credential=${accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
  };
}

function mapAmazonItem(item) {
  const detailPageUrl = item.DetailPageURL;
  const listing = item?.Offers?.Listings?.[0];
  const price = listing?.Price?.Amount;
  const originalPrice = listing?.SavingBasis?.Amount;
  const imageUrl = item?.Images?.Primary?.Large?.URL;
  const title = item?.ItemInfo?.Title?.DisplayValue;

  return {
    id: item.ASIN,
    title,
    price,
    originalPrice,
    url: detailPageUrl,
    imageUrl,
    source: "amazon",
  };
}

async function fetchAmazonProducts({ campaign, env }) {
  if (!env.AMAZON_ACCESS_KEY || !env.AMAZON_SECRET_KEY || !env.AMAZON_PARTNER_TAG) {
    return [];
  }

  const keyword =
    campaign.keywords[Math.floor(Math.random() * campaign.keywords.length)];
  const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
  const body = JSON.stringify({
    Keywords: keyword,
    SearchIndex: campaign.searchIndex || "All",
    ItemCount: campaign.itemCount || 10,
    PartnerTag: env.AMAZON_PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: env.AMAZON_MARKETPLACE,
    Resources: [
      "Images.Primary.Large",
      "ItemInfo.Title",
      "Offers.Listings.Price",
      "Offers.Listings.SavingBasis",
    ],
  });

  const { authorization, amzDate } = signRequest({
    accessKey: env.AMAZON_ACCESS_KEY,
    secretKey: env.AMAZON_SECRET_KEY,
    region: env.AMAZON_REGION,
    host: env.AMAZON_HOST,
    body,
    target,
  });

  const data = await fetchJson(
    `https://${env.AMAZON_HOST}/paapi5/searchitems`,
    {
      method: "POST",
      headers: {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        host: env.AMAZON_HOST,
        "x-amz-date": amzDate,
        "x-amz-target": target,
        Authorization: authorization,
      },
      body,
    },
    "Amazon PA-API"
  );

  return (data.SearchResult?.Items || [])
    .map(mapAmazonItem)
    .filter((item) => item.title && item.url && Number.isFinite(item.price));
}

module.exports = {
  fetchAmazonProducts,
};
