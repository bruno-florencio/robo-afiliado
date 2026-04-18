const { loadConfig } = require("./config");
const { createTelegramClient } = require("./lib/telegram");
const { createHistoryStore } = require("./services/history-store");
const { runCycle } = require("./services/run-cycle");

async function main() {
  const config = loadConfig();
  const telegram = createTelegramClient(config.env.TELEGRAM_BOT_TOKEN);
  const historyStore = createHistoryStore();
  const once = process.argv.includes("--once");

  const run = async () => {
    try {
      const result = await runCycle({
        config,
        telegram,
        historyStore,
      });

      if (!result) {
        console.log("Nenhuma oferta elegivel encontrada neste ciclo.");
        return;
      }

      console.log(
        `Postagem enviada: ${result.campaignId} -> ${result.product.title}`
      );
    } catch (error) {
      console.error("Falha no ciclo de postagem:", error);
    }
  };

  if (once) {
    await run();
    return;
  }

  if (config.env.RUN_ON_START) {
    await run();
  }

  const intervalMs = config.env.POST_INTERVAL_MINUTES * 60 * 1000;
  console.log(
    `Bot iniciado. Proximos ciclos a cada ${config.env.POST_INTERVAL_MINUTES} minuto(s).`
  );

  setInterval(() => {
    run().catch((error) => {
      console.error("Erro inesperado no scheduler:", error);
    });
  }, intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
