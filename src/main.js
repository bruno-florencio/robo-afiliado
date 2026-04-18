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
      console.log(`[Agendador] Acionando robô do Mercado Livre (Playwright)...`);
      const { exec } = require("child_process");
      
      exec("npm run mercadolivre:run-once", (error, stdout, stderr) => {
        if (stdout) console.log(stdout.trim());
        if (stderr) console.error(stderr.trim());
        if (error) {
          console.error(`[Agendador] Erro no bot do MercadoLivre: ${error.message}`);
        }

        // Após concluir o Mercado Livre, aciona o da Amazon para não encavalar o processamento
        console.log(`[Agendador] Acionando robô da Amazon (Playwright)...`);
        exec("npm run amazon:run-once", (errorAmz, stdoutAmz, stderrAmz) => {
          if (stdoutAmz) console.log(stdoutAmz.trim());
          if (stderrAmz) console.error(stderrAmz.trim());
          if (errorAmz) {
            console.error(`[Agendador] Erro no bot da Amazon: ${errorAmz.message}`);
          }
        });
      });
    } catch (e) {
      console.error("[Agendador] Erro estrutural no ciclo:", e);
    }
  };

  const intervalMs = config.env.POST_INTERVAL_MINUTES * 60 * 1000;
  
  // No Render, aguarda 5 minutos antes do primeiro ciclo para evitar re-postagem
  // imediata após SIGTERM/restart (filesystem efêmero zera o history.json)
  // Localmente, respeita RUN_ON_START para testes
  const isCloud = !!process.env.RENDER;
  const initialDelay = isCloud ? 5 * 60 * 1000 : 0;

  if (!isCloud && config.env.RUN_ON_START) {
    console.log(`[Agendador] Rodando ciclo inicial imediato (modo local)...`);
    await run();
  } else if (isCloud) {
    console.log(`[Agendador] Nuvem detectada. Primeiro ciclo em 5 minutos (proteção anti-SIGTERM).`);
  }

  setTimeout(() => {
    run().catch(e => console.error("[Agendador] Erro no ciclo inicial agendado:", e));
    setInterval(() => {
      run().catch(e => console.error("[Agendador] Fatality no motor:", e));
    }, intervalMs);
  }, isCloud ? initialDelay : intervalMs);

  console.log(`[Agendador] Loop automático ativado (a cada ${config.env.POST_INTERVAL_MINUTES} minutos).`);
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
