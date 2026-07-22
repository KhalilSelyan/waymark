FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter web exec playwright install --with-deps chromium
RUN printf '%s\n' 'DATABASE_URL=postgresql://build:build@localhost:5432/build' 'BETTER_AUTH_SECRET=build-only-secret-012345678901234567890123456789' 'BETTER_AUTH_URL=https://build.invalid' 'CORS_ORIGIN=https://build.invalid' 'GOOGLE_CLIENT_ID=build-only-client' 'GOOGLE_CLIENT_SECRET=build-only-secret' > apps/web/.env && pnpm run build && rm apps/web/.env

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app /app

EXPOSE 3000
CMD ["node", "apps/web/build"]
