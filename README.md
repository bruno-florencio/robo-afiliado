# Telegram Affiliate Bot

Bot em Node.js para publicar automaticamente ofertas de afiliado em um grupo ou canal do Telegram.

O workspace agora tambem pode evoluir para concentrar outros agentes, como um agente de conteudo para Instagram e LinkedIn.

## Painel fantasma local

O projeto agora tambem inclui uma base de painel administrativo privado rodando em localhost:

- pagina publica fantasma para visitantes comuns;
- console privado em rota separada;
- login por usuario e senha;
- edicao direta dos JSONs de campanhas e perfis sociais;
- disparo manual de um ciclo do bot de afiliados pelo painel.

### Como iniciar

1. Copie `.env.example` para `.env`.
2. Defina `ADMIN_USERNAME_HASH`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `ADMIN_HOST`, `ADMIN_PORT` e `ADMIN_PATH`.
3. Rode `npm.cmd run admin:start`.
4. Abra `http://127.0.0.1:8787/console` ou os valores que voce configurar no `.env`.

Observacao importante:

- os bloqueios de interface no admin, como desabilitar botao direito e atalhos comuns de inspeção, sao apenas camada extra;
- a seguranca real depende do backend, autenticacao, sessao, segredos fora do frontend e futuras camadas como 2FA, rate limit e auditoria.
- credenciais de colaborador do Mercado Livre para automacao devem ficar apenas no `.env`, nunca no frontend ou em JSON publico.

### Variaveis locais para o agente do Mercado Livre

O projeto agora reserva estas variaveis para um futuro agente navegador com conta colaboradora:

- `MERCADOLIVRE_AGENT_USERNAME`
- `MERCADOLIVRE_AGENT_PASSWORD`
- `MERCADOLIVRE_AFFILIATE_LINKBUILDER_URL`
- `MERCADOLIVRE_OFFERS_URL`

Essas variaveis servem para o fluxo interno:

1. abrir a pagina de ofertas;
2. selecionar produtos ou promocoes do dia;
3. acessar o link builder do programa de afiliados;
4. gerar o link afiliado;
5. devolver esse link para o painel e para os canais automatizados.

## O que este MVP faz

- Agenda postagens automaticas em intervalos fixos.
- Busca produtos da Amazon por palavra-chave usando a PA-API 5.0.
- Busca produtos do Mercado Livre pela API oficial de itens.
- Monta a mensagem pronta para Telegram com preco, CTA, destaques, aviso de afiliado e hashtags.
- Evita repetir o mesmo item seguidamente usando um historico local.
- Tenta enviar com foto e faz fallback para mensagem de texto se o envio da imagem falhar.

## Limitacoes importantes

- Amazon: a documentacao oficial informa que a PA-API 5.0 sera descontinuada em 30 de abril de 2026. O codigo ja esta isolado em um adaptador para facilitar migracao futura para a Creators API.
- Mercado Livre: encontrei API oficial de busca de itens, mas nao encontrei documentacao publica para geracao automatica de links de afiliado. Por isso, o bot suporta:
  - link direto do produto;
  - template customizado de link;
  - lista manual de links afiliados prontos.

## Como usar

1. Copie `.env.example` para `.env`.
2. Copie `config/campaigns.example.json` para `config/campaigns.json`.
3. Preencha suas credenciais e ajustes de campanha.
4. Rode `npm.cmd run run:once` para um disparo de teste.
5. Rode `npm.cmd start` para deixar o bot em execucao continua.

## Novo agente de conteudo

Foi adicionada uma base inicial para um segundo fluxo, separado do bot de afiliados:

- `src/social/index.js`: entrada do agente de conteudo.
- `src/social/config.js`: leitura e validacao das marcas, perfis e canais.
- `config/social-accounts.example.json`: modelo de configuracao para Instagram e LinkedIn.

Para preparar essa base:

1. Copie `config/social-accounts.example.json` para `config/social-accounts.json`.
2. Ajuste suas marcas, nichos, tons e perfis.
3. Rode `npm.cmd run social:plan` para conferir se a estrutura foi carregada corretamente.

Essa base ainda nao publica nas redes. Ela deixa o projeto pronto para a proxima etapa, em que vamos definir:

- pauta e calendario editorial;
- geracao de texto por canal;
- aprovacao manual ou automatica;
- integracao real com LinkedIn e Instagram.

## Estrutura

- `src/index.js`: entrada principal e loop do scheduler.
- `src/lib/telegram.js`: envio de mensagens/fotos para o Telegram.
- `src/providers/amazon-paapi.js`: busca de produtos Amazon.
- `src/providers/mercadolivre.js`: busca de produtos Mercado Livre.
- `src/services/run-cycle.js`: selecao do produto e postagem.
- `config/campaigns.example.json`: campanhas, palavras-chave e regras.

## Campos uteis por campanha

Cada campanha pode personalizar a postagem do grupo com:

- `messageTemplate`: titulo principal da oferta.
- `ctaText`: texto do link/CTA.
- `sourceLabel`: nome exibido da loja.
- `disclosureText`: aviso curto sobre afiliado ou disponibilidade.
- `highlights`: lista de ate 3 destaques do produto/oferta.
