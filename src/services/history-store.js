const fs = require("node:fs");
const path = require("node:path");

// ─── Backend Supabase (nuvem persistente) ────────────────────────────────────
// Usado no Render: o histórico sobrevive a qualquer restart, redeploy ou SIGTERM
// porque vive no banco de dados externo, não no filesystem efêmero do servidor.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://buhobymzssenhwwmpnxi.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aG9ieW16c3Nlbmh3d21wbnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjQ1NzcsImV4cCI6MjA4NzY0MDU3N30.JpzMqY3HB5hHKP_qrG8atJBFQ3r0XL1Xs2jIc9aMZW4";
const TABLE = "affiliate_sent_products";

async function supabaseRequest(method, body) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}`;
  const res = await fetch(method === "GET" ? `${url}${body}` : url, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=minimal" : "",
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${method} falhou: ${res.status} ${text}`);
  }
  return method === "GET" ? res.json() : null;
}

// ─── Backend Local (arquivo JSON, para desenvolvimento local) ─────────────────

function getLocalFilePath() {
  return path.resolve(process.cwd(), "data/history.json");
}

function readLocal() {
  const filePath = getLocalFilePath();
  if (!fs.existsSync(filePath)) return { sentProducts: [] };
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeLocal(data) {
  const filePath = getLocalFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Factory ─────────────────────────────────────────────────────────────────

function createHistoryStore() {
  const isCloud = !!process.env.RENDER;

  if (isCloud) {
    console.log("[HistoryStore] Modo NUVEM — usando Supabase como memória persistente.");
  } else {
    console.log("[HistoryStore] Modo LOCAL — usando arquivo data/history.json.");
  }

  return {
    async hasRecentProduct({ campaignId, productId }) {
      if (isCloud) {
        try {
          // Busca na tabela registros do mesmo produto nos últimos 7 dias
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isoToday = today.toISOString();

          const query = `?campaign_id=eq.${encodeURIComponent(campaignId)}&product_id=eq.${encodeURIComponent(productId)}&sent_at=gte.${isoToday}&select=id&limit=1`;
          const rows = await supabaseRequest("GET", query);
          return Array.isArray(rows) && rows.length > 0;
        } catch (e) {
          console.error("[HistoryStore] Erro ao consultar Supabase, assumindo produto NOVO:", e.message);
          return false; // Em caso de falha, prefere não bloquear
        }
      } else {
        // Modo local: lê do arquivo JSON
        const data = readLocal();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        return data.sentProducts.some((item) => {
          if (item.campaignId !== campaignId || item.productId !== productId) return false;
          if (!item.sentAt) return false;
          const sentDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          return sentDate === today;
        });
      }
    },

    async remember({ campaignId, productId }) {
      if (isCloud) {
        try {
          await supabaseRequest("POST", { campaign_id: campaignId, product_id: productId });
          console.log(`[HistoryStore] Salvo no Supabase: ${campaignId} → ${productId.slice(0, 60)}...`);
        } catch (e) {
          console.error("[HistoryStore] Erro ao salvar no Supabase:", e.message);
        }
      } else {
        // Modo local: salva no arquivo JSON
        const data = readLocal();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const validHistory = data.sentProducts.filter((item) => {
          if (!item.sentAt) return false;
          const sentDate = new Date(item.sentAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          return sentDate === today;
        });

        const nextProducts = [
          { campaignId, productId, sentAt: new Date().toISOString() },
          ...validHistory.filter((item) => !(item.campaignId === campaignId && item.productId === productId)),
        ].slice(0, 200);

        writeLocal({ sentProducts: nextProducts });
      }
    },
  };
}

module.exports = {
  createHistoryStore,
};
