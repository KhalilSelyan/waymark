FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
ENV PLAYWRIGHT_BROWSERS_PATH=0

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter web exec playwright install --with-deps chromium
RUN printf '%s\n' 'DATABASE_URL=postgresql://build:build@localhost:5432/build' 'BETTER_AUTH_SECRET=build-only-secret-012345678901234567890123456789' 'BETTER_AUTH_URL=https://build.invalid' 'CORS_ORIGIN=https://build.invalid' 'GOOGLE_CLIENT_ID=build-only-client' 'GOOGLE_CLIENT_SECRET=build-only-secret' > apps/web/.env && pnpm run build && rm apps/web/.env

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=0

COPY --from=build /app /app

EXPOSE 3000
CMD ["node", "apps/web/build"]
