const { fetchJson } = require("./http");
const TELEGRAM_PHOTO_CAPTION_LIMIT = 1024;

async function telegramRequest(token, method, payload) {
  const data = await fetchJson(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    `Telegram API (${method})`
  );

  if (!data.ok) {
    throw new Error(
      `Telegram API retornou erro em ${method}: ${JSON.stringify(data)}`
    );
  }

  return data.result;
}

function createTelegramClient(token) {
  return {
    async sendOffer({ chatId, caption, imageUrl }) {
      const canUseCaption = caption.length <= TELEGRAM_PHOTO_CAPTION_LIMIT;

      if (imageUrl && canUseCaption) {
        try {
          return await telegramRequest(token, "sendPhoto", {
            chat_id: chatId,
            photo: imageUrl,
            caption,
            parse_mode: "HTML",
          });
        } catch (error) {
          console.warn(
            "Falha ao enviar foto para o Telegram. Tentando fallback em texto.",
            error.message
          );
        }
      }

      return telegramRequest(token, "sendMessage", {
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });
    },
  };
}

module.exports = {
  createTelegramClient,
};
