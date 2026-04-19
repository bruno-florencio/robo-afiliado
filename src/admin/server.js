const http = require("node:http");
const { URL } = require("node:url");
const querystring = require("node:querystring");
const { createAuthManager } = require("./auth");
const { loadAdminEnv } = require("./config");
const { createStateStore } = require("./state");
const { renderDashboard, renderGhostPage, renderLoginPage } = require("./templates");
const { loadConfig } = require("../config");
const { createTelegramClient } = require("../lib/telegram");
const { createHistoryStore } = require("../services/history-store");
const { runCycle } = require("../services/run-cycle");

function sendHtml(response, statusCode, html, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    ...headers,
  });
  response.end(html);
}

function redirect(response, location, headers = {}) {
  response.writeHead(302, {
    location,
    ...headers,
  });
  response.end();
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");

      if (body.length > 1_000_000) {
        reject(new Error("Corpo da requisicao excedeu o limite permitido."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeAdminPath(adminPath) {
  if (!adminPath.startsWith("/")) {
    return `/${adminPath}`;
  }

  return adminPath.replace(/\/+$/, "") || "/console";
}

function createFlashRedirect(response, location, message, type = "success", headers = {}) {
  const query = querystring.stringify({
    flash: message,
    type,
  });

  redirect(response, `${location}?${query}`, headers);
}

async function handleAffiliateCycle() {
  const config = loadConfig();
  const telegram = createTelegramClient(config.env.TELEGRAM_BOT_TOKEN);
  const historyStore = createHistoryStore();
  return runCycle({ config, telegram, historyStore });
}

async function createServer() {
  const env = loadAdminEnv();
  const adminPath = normalizeAdminPath(env.ADMIN_PATH);
  const stateStore = createStateStore(process.cwd());
  const auth = createAuthManager({
    usernameHash: env.ADMIN_USERNAME_HASH,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    sessionSecret: env.ADMIN_SESSION_SECRET,
  });

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const pathname = url.pathname;
      const session = auth.readSessionFromRequest(request);

      if (request.method === "GET" && pathname === "/") {
        sendHtml(response, 404, renderGhostPage());
        return;
      }

      if (request.method === "GET" && pathname === adminPath) {
        if (!session) {
          sendHtml(response, 200, renderLoginPage({ adminPath }));
          return;
        }

        sendHtml(
          response,
          200,
          renderDashboard({
            adminPath,
            campaigns: stateStore.readCampaigns(),
            social: stateStore.readSocial(),
            history: stateStore.readHistory(),
            flashMessage: url.searchParams.get("flash"),
            flashType: url.searchParams.get("type"),
            runtime: {
              host: env.ADMIN_HOST,
              port: String(env.ADMIN_PORT),
              adminPath,
            },
          })
        );
        return;
      }

      if (request.method === "POST" && pathname === `${adminPath}/login`) {
        const body = querystring.parse(await readRequestBody(request));
        const username = String(body.username || "");
        const password = String(body.password || "");

        if (!auth.verifyCredentials(username, password)) {
          sendHtml(
            response,
            401,
            renderLoginPage({
              adminPath,
              errorMessage: "Credenciais invalidas. Verifique usuario e senha.",
            })
          );
          return;
        }

        const { sessionId } = auth.createSession(username);
        redirect(response, adminPath, {
          "set-cookie": auth.signSessionCookie(sessionId),
        });
        return;
      }

      if (request.method === "GET" && pathname === `${adminPath}/logout`) {
        const cookies = auth.parseCookies(request.headers.cookie);
        const rawCookie = cookies.admin_session || "";
        const [sessionId] = rawCookie.split(".");

        if (sessionId) {
          auth.destroySession(sessionId);
        }

        redirect(response, adminPath, {
          "set-cookie": auth.signLogoutCookie(),
        });
        return;
      }

      if (!session) {
        sendHtml(response, 403, renderGhostPage());
        return;
      }

      if (request.method === "GET" && pathname === `${adminPath}/api/logs`) {
        const { exec } = require("child_process");
        // Remove characters de formataçao de cor padrão do PM2 usando replace, ou deixamos a UI lidar
        exec("pm2 logs robo-afiliado --lines 100 --nostream", (error, stdout, stderr) => {
          response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
          response.end((stdout || "") + "\\n" + (stderr || ""));
        });
        return;
      }

      if (request.method === "POST" && pathname === `${adminPath}/save-campaigns`) {
        const body = querystring.parse(await readRequestBody(request));
        const json = JSON.parse(String(body.json || ""));
        stateStore.writeCampaigns(json);
        createFlashRedirect(response, adminPath, "Campanhas salvas com sucesso.");
        return;
      }

      if (request.method === "POST" && pathname === `${adminPath}/save-social`) {
        const body = querystring.parse(await readRequestBody(request));
        const json = JSON.parse(String(body.json || ""));
        stateStore.writeSocial(json);
        createFlashRedirect(response, adminPath, "Configuracao social salva com sucesso.");
        return;
      }

      if (request.method === "POST" && pathname === `${adminPath}/run-affiliate-cycle`) {
        const result = await handleAffiliateCycle();

        if (!result) {
          createFlashRedirect(
            response,
            adminPath,
            "Ciclo executado, mas nenhuma oferta elegivel foi encontrada.",
            "success"
          );
          return;
        }

        createFlashRedirect(
          response,
          adminPath,
          `Ciclo executado com sucesso: ${result.campaignId} -> ${result.product.title}`,
          "success"
        );
        return;
      }

      sendHtml(response, 404, renderGhostPage());
    } catch (error) {
      const fallbackPath = normalizeAdminPath(loadAdminEnv().ADMIN_PATH);
      sendHtml(
        response,
        500,
        renderLoginPage({
          adminPath: fallbackPath,
          errorMessage: `Falha interna: ${error.message}`,
        })
      );
    }
  });

  return { server, env, adminPath };
}

async function main() {
  const { server, env, adminPath } = await createServer();
  server.listen(env.ADMIN_PORT, env.ADMIN_HOST, () => {
    console.log(
      `Painel fantasma ativo em http://${env.ADMIN_HOST}:${env.ADMIN_PORT}${adminPath}`
    );
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Falha ao iniciar o painel administrativo:", error);
    process.exitCode = 1;
  });
}

module.exports = { createServer };
