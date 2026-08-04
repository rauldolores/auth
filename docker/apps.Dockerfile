# Builds a single Next.js app (auth-server or admin-panel) from the monorepo.
# Usage: docker build -f docker/apps.Dockerfile --build-arg APP=auth-server .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
ARG APP
RUN pnpm turbo run build --filter=@kontrolia/${APP}

FROM base AS runner
ARG APP
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/${APP}
EXPOSE 3000
CMD ["pnpm", "start"]
