FROM node:20-bookworm-slim

# Define o diretorio de trabalho dentro do container
WORKDIR /app

# Copia as regras de dependencias
COPY package*.json ./

# Instala as dependencias do Bot
RUN npm install

# Instala exclusivamente o Chromium e todas as bibliotecas do Linux (Ubuntu/Debian) que ele precisa pra rodar em ambiente sem tela (headless)
RUN npx playwright install --with-deps chromium

# Copia o restante do codigo (exceto o que estiver no .dockerignore)
COPY . .

# Expõe a porta para o Site Fantasma
EXPOSE 3000

# Comando para ligar as duas maquinas (Painel + Robo)
CMD ["npm", "start"]
