############################
# Base / Build stage
############################
FROM node:20-alpine AS base

RUN npm install -g pnpm@10
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install all deps (build + prisma)
RUN pnpm install --frozen-lockfile

# Prisma generate (types + client)
WORKDIR /app/apps/backend
RUN pnpm db:generate

# Build shared
WORKDIR /app/packages/shared
RUN pnpm build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm build


############################
# Production stage
############################
FROM node:20-alpine AS production

WORKDIR /app

RUN npm install -g pnpm@10
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-opensans \
    postgresql-client \
    openssl \
    udev \
    ttf-liberation \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Use direct chromium path to avoid symlink issues
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install ONLY production deps
RUN pnpm install --prod --frozen-lockfile

# Prisma CLI (somente para migrate deploy)
RUN npm install -g prisma@^5.8.0

# Copy build artifacts
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/backend/dist ./apps/backend/dist

# Generate Prisma Client in production stage
WORKDIR /app/apps/backend
RUN prisma generate

RUN mkdir -p /app/data /app/logs

# Entrypoint (ensure LF line endings for Alpine)
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/apps/backend/docker-entrypoint.sh && chmod +x /app/apps/backend/docker-entrypoint.sh

EXPOSE 3041
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
