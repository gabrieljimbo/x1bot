############################
# Base / Build stage
############################
FROM node:20-alpine AS base

RUN npm install -g pnpm@10 --registry=https://registry.npmjs.org/
WORKDIR /app
COPY .npmrc ./
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install native build tools for canvas
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    glib-dev \
    python3

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

# Avoid redundant apk updates and keep only runtime libraries
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
    cairo \
    pango \
    giflib \
    librsvg \
    pixman \
    && rm -rf /var/cache/apk/*

# Use direct chromium path to avoid symlink issues
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy all pre-compiled node_modules from base stage
# This avoids running pnpm install --prod in production (which would try to recompiling canvas)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=base /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy app code and artifacts
COPY . .
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/backend/dist ./apps/backend/dist

# Prisma CLI (needed for migrate deploy in entrypoint)
RUN npm install -g prisma@^5.8.0

# Generate Prisma Client (uses the binaries already present in node_modules)
WORKDIR /app/apps/backend
RUN npx prisma generate

RUN mkdir -p /app/data /app/logs

# Entrypoint (ensure LF line endings for Alpine)
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/apps/backend/docker-entrypoint.sh && chmod +x /app/apps/backend/docker-entrypoint.sh

EXPOSE 3041
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
