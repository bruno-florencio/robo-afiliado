function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderShell({ title, body, adminMode = false }) {
  const securityScript = adminMode
    ? `
      <script>
        document.addEventListener("contextmenu", (event) => event.preventDefault());
        document.addEventListener("keydown", (event) => {
          const blocked =
            event.key === "F12" ||
            (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase())) ||
            (event.ctrlKey && event.key.toUpperCase() === "U");
          if (blocked) {
            event.preventDefault();
          }
        });
      </script>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #0a0d12;
        --panel: rgba(12, 17, 24, 0.88);
        --panel-strong: rgba(16, 22, 31, 0.96);
        --text: #eff4ff;
        --muted: #93a0b8;
        --line: rgba(196, 211, 255, 0.12);
        --accent: #d7ff64;
        --accent-strong: #bfe83d;
        --danger: #ff6f61;
        --shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at 20% 15%, rgba(215, 255, 100, 0.08), transparent 28%),
          radial-gradient(circle at 80% 0%, rgba(107, 133, 255, 0.16), transparent 24%),
          linear-gradient(145deg, #080b10 0%, #0d1219 48%, #05070b 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: radial-gradient(circle at center, black 38%, transparent 92%);
      }

      .page {
        width: min(1180px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }

      .hero, .panel, .login-card {
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .hero {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .ghost-card {
        width: min(760px, 100%);
        padding: 48px;
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(16, 22, 31, 0.94), rgba(8, 11, 16, 0.96));
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: var(--shadow);
      }

      .ghost-eyebrow, .eyebrow {
        display: inline-block;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        font-size: 11px;
        color: var(--accent);
        margin-bottom: 18px;
      }

      .ghost-code {
        font-size: clamp(64px, 16vw, 164px);
        line-height: 0.92;
        margin: 0;
      }

      .ghost-copy {
        max-width: 52ch;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.7;
      }

      .login-wrap {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .login-card {
        width: min(460px, 100%);
        border-radius: 28px;
        padding: 32px;
      }

      h1, h2, h3 {
        margin: 0 0 14px;
        font-weight: 600;
      }

      h1 { font-size: clamp(32px, 6vw, 62px); }
      h2 { font-size: 24px; }
      h3 { font-size: 18px; }

      p {
        margin: 0 0 14px;
        color: var(--muted);
      }

      .label {
        display: block;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 18px 0 10px;
      }

      input, textarea {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        color: var(--text);
        padding: 14px 16px;
        font: inherit;
      }

      textarea {
        min-height: 280px;
        resize: vertical;
        font-family: "Courier New", monospace;
        line-height: 1.45;
      }

      button, .button-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: none;
        padding: 13px 20px;
        text-decoration: none;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        letter-spacing: 0.04em;
        background: var(--accent);
        color: #111;
      }

      button.secondary, .button-link.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid rgba(255,255,255,0.12);
      }

      .toolbar, .header {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
      }

      .header {
        margin-bottom: 28px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 18px;
      }

      .panel {
        border-radius: 24px;
        padding: 24px;
      }

      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-4 { grid-column: span 4; }
      .span-6 { grid-column: span 6; }

      .metric {
        font-size: 34px;
        margin: 4px 0 6px;
      }

      .muted {
        color: var(--muted);
      }

      .notice {
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 18px;
        border: 1px solid rgba(255,255,255,0.08);
      }

      .notice.success {
        background: rgba(135, 230, 120, 0.08);
        color: #daf6cf;
      }

      .notice.error {
        background: rgba(255, 111, 97, 0.08);
        color: #ffd4cf;
      }

      .list {
        display: grid;
        gap: 12px;
      }

      .list-item {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
      }

      code {
        font-family: "Courier New", monospace;
        color: var(--accent);
      }

      @media (max-width: 900px) {
        .span-8, .span-6, .span-4 { grid-column: span 12; }
        .ghost-card, .login-card { padding: 28px; }
      }
    </style>
    ${securityScript}
  </head>
  <body>${body}</body>
</html>`;
}

function renderGhostPage() {
  return renderShell({
    title: "404",
    body: `
      <main class="hero">
        <section class="ghost-card">
          <div class="ghost-eyebrow">Signal Lost</div>
          <h1 class="ghost-code">404</h1>
          <p class="ghost-copy">
            Este endereco nao responde como um site publico. O endpoint solicitado nao esta disponivel
            ou foi removido da malha externa.
          </p>
          <p class="ghost-copy">
            Se voce chegou ate aqui por engano, feche esta aba. Se conhece a entrada administrativa,
            use o caminho reservado e autentique-se.
          </p>
        </section>
      </main>
    `,
  });
}

function renderLoginPage({ errorMessage, adminPath }) {
  const message = errorMessage
    ? `<div class="notice error">${escapeHtml(errorMessage)}</div>`
    : "";

  return renderShell({
    title: "Acesso Restrito",
    adminMode: true,
    body: `
      <main class="login-wrap">
        <section class="login-card">
          <div class="eyebrow">Restricted Console</div>
          <h2>Painel administrativo blindado</h2>
          <p>
            Esta interface controla automacoes, campanhas e agentes privados. O acesso depende de
            autenticacao no backend. O frontend exibe apenas o minimo necessario.
          </p>
          ${message}
          <form method="post" action="${adminPath}/login">
            <label class="label" for="username">Usuario</label>
            <input id="username" name="username" type="text" autocomplete="username" required />

            <label class="label" for="password">Senha</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />

            <div class="toolbar" style="margin-top: 22px;">
              <button type="submit">Entrar no console</button>
              <a class="button-link secondary" href="/">Voltar</a>
            </div>
          </form>
        </section>
      </main>
    `,
  });
}

function renderDashboard({
  adminPath,
  campaigns,
  social,
  history,
  flashMessage,
  flashType,
  runtime,
}) {
  const flash = flashMessage
    ? `<div class="notice ${flashType === "error" ? "error" : "success"}">${escapeHtml(
        flashMessage
      )}</div>`
    : "";

  const latestHistory = history.sentProducts.slice(0, 6);
  const activeCampaigns = (campaigns.campaigns || []).filter((campaign) => campaign.enabled);
  const activeChannels = (social.brands || []).flatMap((brand) =>
    (brand.channels || []).filter((channel) => channel.enabled)
  );

  return renderShell({
    title: "Console Privado",
    adminMode: true,
    body: `
      <main class="page">
        <header class="header">
          <div>
            <div class="eyebrow">Ghost Operations</div>
            <h2>Console administrativo local</h2>
            <p>
              Nucleo privado para controlar afiliados, conteudo social e rotinas internas por tras da
              fachada fantasma.
            </p>
          </div>
          <div class="toolbar">
            <a class="button-link secondary" href="${adminPath}/logout">Sair</a>
          </div>
        </header>

        ${flash}

        <section class="grid">
          <article class="panel span-4">
            <div class="muted">Campanhas ativas</div>
            <div class="metric">${activeCampaigns.length}</div>
            <p>Amazon e Mercado Livre prontos para serem administrados daqui.</p>
          </article>
          <article class="panel span-4">
            <div class="muted">Canais sociais ativos</div>
            <div class="metric">${activeChannels.length}</div>
            <p>Perfis configurados para LinkedIn e Instagram dentro da mesma central.</p>
          </article>
          <article class="panel span-4">
            <div class="muted">Itens no historico</div>
            <div class="metric">${history.sentProducts.length}</div>
            <p>Registro local usado para reduzir repeticao e acompanhar postagens recentes.</p>
          </article>

          <article class="panel span-12">
            <div class="toolbar">
              <div>
                <h3>Runtime local</h3>
                <p>Controles rapidos para testar o bot sem expor o painel ao publico.</p>
              </div>
              <form method="post" action="${adminPath}/run-affiliate-cycle">
                <button type="submit">Rodar ciclo de afiliado agora</button>
              </form>
            </div>
            <div class="list" style="margin-top: 16px;">
              <div class="list-item"><strong>Host:</strong> <code>${escapeHtml(runtime.host)}</code></div>
              <div class="list-item"><strong>Porta:</strong> <code>${escapeHtml(runtime.port)}</code></div>
              <div class="list-item"><strong>Rota administrativa:</strong> <code>${escapeHtml(runtime.adminPath)}</code></div>
            </div>
          </article>

          <article class="panel span-8">
            <h3>Campanhas de afiliado</h3>
            <p>Edite o JSON inteiro com cautela. O backend grava o arquivo em disco.</p>
            <form method="post" action="${adminPath}/save-campaigns">
              <label class="label" for="campaignsJson">config/campaigns.json</label>
              <textarea id="campaignsJson" name="json" style="min-height: 540px;">${escapeHtml(
                JSON.stringify(campaigns, null, 2)
              )}</textarea>
              <div class="toolbar" style="margin-top: 18px;">
                <button type="submit">Salvar campanhas</button>
              </div>
            </form>
          </article>

          <article class="panel span-4">
            <h3>Ultimos envios</h3>
            <p>Visao rapida do historico local do bot de ofertas.</p>
            <div class="list">
              ${
                latestHistory.length === 0
                  ? '<div class="list-item">Nenhum envio registrado ainda.</div>'
                  : latestHistory
                      .map(
                        (item) => `
                          <div class="list-item">
                            <strong>${escapeHtml(item.campaignId)}</strong><br />
                            <div class="muted" style="word-break: break-all; font-size: 11px; margin: 6px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                              ${escapeHtml(item.productId)}
                            </div>
                            <span class="muted" style="font-size: 11px;">${escapeHtml(item.sentAt)}</span>
                          </div>
                        `
                      )
                      .join("")
              }
            </div>
          </article>

          <article class="panel span-12">
            <div class="toolbar">
              <div>
                <h3>Terminal Sidecar (Logs Ao Vivo)</h3>
                <p>Veja em tempo real o que o robô está processando nos bastidores da nuvem.</p>
              </div>
              <button type="button" onclick="refreshLogs()">Atualizar Agora</button>
            </div>
            <textarea id="live-logs" readonly style="width: 100%; height: 500px; margin-top: 16px; background: #080b10; color: #accb5a; font-family: 'Courier New', monospace; font-size: 13px; border: 1px solid var(--line); border-radius: 12px; padding: 12px;"></textarea>
            <script>
              function refreshLogs() {
                 const t = document.getElementById('live-logs');
                 fetch('${adminPath}/api/logs')
                   .then(res => res.text())
                   .then(txt => { 
                      /* Clean up PM2 ANSI color codes to make logs readable */
                      const plainTxt = txt.replace(/\\x1b\\[[0-9;]*m/g, '');
                      t.value = plainTxt; 
                      t.scrollTop = t.scrollHeight; 
                   })
                   .catch(err => { t.value = 'Falha ao carregar logs: ' + err.message; });
              }
              // Atualiza logs a cada 8 segundos
              setInterval(refreshLogs, 8000);
              refreshLogs();
            </script>
          </article>
        </section>
      </main>
    `,
  });
}

module.exports = {
  renderDashboard,
  renderGhostPage,
  renderLoginPage,
};
