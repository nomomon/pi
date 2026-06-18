FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all workspace dependencies
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/tui/package*.json packages/tui/
COPY packages/ai/package*.json packages/ai/
COPY packages/agent/package*.json packages/agent/
COPY packages/coding-agent/package*.json packages/coding-agent/
COPY packages/ui/package*.json packages/ui/
RUN npm install --ignore-scripts

# Build packages in dependency order
COPY packages/tui/src packages/tui/src
COPY packages/tui/tsconfig*.json packages/tui/
RUN npm run build --workspace=packages/tui

COPY packages/ai/src packages/ai/src
COPY packages/ai/scripts packages/ai/scripts
COPY packages/ai/tsconfig*.json packages/ai/
RUN npm run build --workspace=packages/ai

COPY packages/agent/src packages/agent/src
COPY packages/agent/tsconfig*.json packages/agent/
RUN npm run build --workspace=packages/agent

COPY packages/coding-agent/src packages/coding-agent/src
COPY packages/coding-agent/tsconfig*.json packages/coding-agent/
COPY packages/coding-agent/npm-shrinkwrap.json packages/coding-agent/
RUN npm run build --workspace=packages/coding-agent

# Build the UI
COPY packages/ui/src packages/ui/src
COPY packages/ui/index.html packages/ui/
COPY packages/ui/vite.config.ts packages/ui/
COPY packages/ui/tsconfig*.json packages/ui/
COPY packages/ui/server.ts packages/ui/
RUN npm run build --workspace=packages/ui

WORKDIR /app/packages/ui
EXPOSE 3030
ENV NODE_ENV=production CWD=/workspace

CMD ["node", "--import", "tsx/esm", "server.ts"]
