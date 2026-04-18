const fs = require("node:fs");
const path = require("node:path");

function ensureJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createStateStore(rootDir) {
  const campaignsPath = path.resolve(rootDir, "config/campaigns.json");
  const socialPath = path.resolve(rootDir, "config/social-accounts.json");
  const historyPath = path.resolve(rootDir, "data/history.json");

  return {
    readCampaigns() {
      return ensureJsonFile(campaignsPath, { campaigns: [] });
    },
    writeCampaigns(data) {
      writeJsonFile(campaignsPath, data);
    },
    readSocial() {
      return ensureJsonFile(socialPath, { brands: [] });
    },
    writeSocial(data) {
      writeJsonFile(socialPath, data);
    },
    readHistory() {
      return ensureJsonFile(historyPath, { sentProducts: [] });
    },
    paths: {
      campaignsPath,
      socialPath,
      historyPath,
    },
  };
}

module.exports = {
  createStateStore,
};
