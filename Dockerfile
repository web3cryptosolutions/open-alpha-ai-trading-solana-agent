# Open Alpha — single image that can run the agent, the API, or a backtest.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# Install deps first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile || pnpm install

# Default: run the autonomous agent loop. Override CMD for api/dashboard/backtest.
ENV OPENALPHA_MODE=mock LOOP=1
CMD ["pnpm", "agent"]
