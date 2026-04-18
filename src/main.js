const { createServer } = require("./admin/server");
const { loadConfig } = require("./config");
const { createTelegramClient } = require("./lib/telegram");
const { createHistoryStore } = require("./services/history-store");
const { runCycle } = require("./services/run-cycle");

async function startBot() {
  const config = loadConfig();
  const telegram = createTelegramClient(config.env.TELEGRAM_BOT_TOKEN);
  const historyStore = createHistoryStore();

  const run = async () => {
    try {
      // Executa primeiro o script com o Playwright (Mercado Livre seguro)
      console.log(`[Agendador] Acionando robo do Mercado Livre (Playwright)...`);
      const { exec } = require("child_process");
      exec("npm run mercadolivre:run-once", (error, stdout, stderr) => {
        if (error) {
          console.error(`[Agendador] Erro no bot do MercadoLivre: ${error.message}`);
          return;
        }
        if (stdout) console.log(stdout.trim());
      });

      // Em paralelo, tenta rodar o ciclo convencional para campanhas API (Amazon)
      const result = await runCycle({ config, telegram, historyStore });
      if (result) {
        console.log(`[Agendador] Postagem API enviada: ${result.campaignId} -> ${result.product.title}`);
      }
    } catch (e) {
      console.error("[Agendador] Erro no ciclo de postagem API:", e);
    }
  };

  if (config.env.RUN_ON_START) {
    console.log(`[Agendador] Rodando ciclo inicial...`);
    await run();
  }

  const intervalMs = config.env.POST_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[Agendador] Loop automático ativado (a cada ${config.env.POST_INTERVAL_MINUTES} minutos).`);

  setInterval(() => {
    run().catch(e => console.error("[Agendador] Fatality no motor:", e));
  }, intervalMs);
}

async function main() {
  console.log("-----------------------------------------");
  console.log("🚀 LIGANDO MOTOR DO APP DE AFILIADOS 24/7 🚀");
  console.log("-----------------------------------------");

  // 1. Inicia o painel (Ghost Web Server)
  const { server, env, adminPath } = await createServer();

  // Usamos process.env.PORT pois provedores (Render/Railway/Heroku) injetam a porta dinamicamente
  const port = process.env.PORT || env.ADMIN_PORT || 3000;
  const host = "0.0.0.0"; // 0.0.0.0 é vital para Docker e Plataformas de Nuvem

  server.listen(port, host, () => {
    console.log(`[Painel] Ativo e roteando na porta ${port}`);
    if (!process.env.RENDER) {
      console.log(`[Painel] Acesso local via: http://localhost:${port}${adminPath}`);
    }

    // 2. Só sobe o Robô se o Painel subiu com estabilidade
    startBot();
  });
}

main().catch((error) => {
  console.error("Falha fatal na inicialização principal:", error);
  process.exitCode = 1;
});
