const fs = require("node:fs");
const path = require("node:path");

function createHistoryStore() {
  const filePath = path.resolve(process.cwd(), "data/history.json");

  function read() {
    if (!fs.existsSync(filePath)) {
      return { sentProducts: [] };
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    hasRecentProduct({ campaignId, productId }) {
      const data = read();
      return data.sentProducts.some(
        (item) => item.campaignId === campaignId && item.productId === productId
      );
    },
    remember({ campaignId, productId }) {
      const data = read();
      const nextProducts = [
        {
          campaignId,
          productId,
          sentAt: new Date().toISOString(),
        },
        ...data.sentProducts.filter(
          (item) =>
            !(item.campaignId === campaignId && item.productId === productId)
        ),
      ].slice(0, 200);

      write({ sentProducts: nextProducts });
    },
  };
}

module.exports = {
  createHistoryStore,
};
