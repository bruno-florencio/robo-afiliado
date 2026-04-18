const fs = require("node:fs");
const path = require("node:path");

function createHistoryStore() {
  // No Render, /tmp persiste entre SIGTERM/restarts do mesmo container
  // Sem isso, o history.json some e o bot repete os posts
  const isCloud = !!process.env.RENDER;
  const filePath = isCloud
    ? "/tmp/affiliate-history.json"
    : path.resolve(process.cwd(), "data/history.json");

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
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
      
      return data.sentProducts.some((item) => {
        if (item.campaignId !== campaignId || item.productId !== productId) return false;
        if (!item.sentAt) return false;
        
        // Se a data de envio original for diferente de hoje na meia noite BR, ele "esquece"
        const sentDate = new Date(item.sentAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        return sentDate === today;
      });
    },
    remember({ campaignId, productId }) {
      const data = read();
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

      // Limpa coisas de dias anteriores pra não inchar o arquivo e focar só no dia atual
      const validHistory = data.sentProducts.filter(item => {
          if (!item.sentAt) return false;
          const sentDate = new Date(item.sentAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
          return sentDate === today;
      });

      const nextProducts = [
        {
          campaignId,
          productId,
          sentAt: new Date().toISOString(),
        },
        ...validHistory.filter(
          (item) => !(item.campaignId === campaignId && item.productId === productId)
        ),
      ].slice(0, 200);

      write({ sentProducts: nextProducts });
    },
  };
}

module.exports = {
  createHistoryStore,
};
