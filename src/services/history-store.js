const fs = require("node:fs");
const path = require("node:path");

function createHistoryStore() {
  // No Oracle Cloud o filesystem é PERSISTENTE - o arquivo sobrevive a restarts e reboots.
  // No Render era efêmero (por isso tínhamos problemas). No Oracle, arquivo local é suficiente.
  const filePath = path.resolve(process.cwd(), "data/history.json");

  function read() {
    if (!fs.existsSync(filePath)) return { sentProducts: [] };
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    async hasRecentProduct({ campaignId, productId }) {
      const data = read();
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      return data.sentProducts.some((item) => {
        if (item.campaignId !== campaignId || item.productId !== productId) return false;
        if (!item.sentAt) return false;
        const sentDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        return sentDate === today;
      });
    },

    async remember({ campaignId, productId }) {
      const data = read();
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      // Mantém apenas produtos do dia atual (limpeza automática do histórico diário)
      const validHistory = data.sentProducts.filter((item) => {
        if (!item.sentAt) return false;
        const sentDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        return sentDate === today;
      });

      const nextProducts = [
        { campaignId, productId, sentAt: new Date().toISOString() },
        ...validHistory.filter((i) => !(i.campaignId === campaignId && i.productId === productId)),
      ].slice(0, 200);

      write({ sentProducts: nextProducts });
      console.log(`[HistoryStore] Salvo: ${campaignId} → ${productId.slice(0, 60)}...`);
    },
  };
}

module.exports = { createHistoryStore };
