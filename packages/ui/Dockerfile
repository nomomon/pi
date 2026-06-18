FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user that the pi agent runs as.
# /home/pi  — agent config and sessions (~/.pi)
# /workspace — the working directory pi can read/write
RUN groupadd -g 1001 pi \
  && useradd -m -u 1001 -g 1001 -s /bin/bash pi \
  && mkdir -p /workspace /home/pi/.pi/agent/sessions \
  && chown -R pi:pi /workspace /home/pi

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
COPY packages/ui/public packages/ui/public
COPY packages/ui/index.html packages/ui/
COPY packages/ui/vite.config.ts packages/ui/
COPY packages/ui/tsconfig*.json packages/ui/
COPY packages/ui/server.ts packages/ui/
COPY packages/ui/ui-tools packages/ui/ui-tools

RUN npm run build --workspace=packages/ui \
  # Allow pi user to read the built app and run server.ts
  && chown -R pi:pi /app/packages/ui/dist \
  && chown pi:pi /app/packages/ui/server.ts \
  && chown -R pi:pi /app/packages/ui/ui-tools \
  # Symlink pi binary into PATH
  && ln -s /app/packages/coding-agent/dist/cli.js /usr/local/bin/pi

WORKDIR /app/packages/ui
USER pi
EXPOSE 3030
ENV NODE_ENV=production CWD=/workspace HOME=/home/pi

CMD ["node", "--import", "tsx/esm", "server.ts"]
