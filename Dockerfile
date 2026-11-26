FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json server.json README.md LICENSE ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENTRYPOINT ["node", "dist/index.js"]
