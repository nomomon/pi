FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

EXPOSE 3030
ENV NODE_ENV=production CWD=/workspace

CMD ["node", "--import", "tsx/esm", "server.ts"]
