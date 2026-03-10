# Stage 1: Base & Build
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm and build dependencies
RUN npm install -g pnpm@10
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy configuration and workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies (including devDeps for building)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# Generate Prisma Client (needed for build)
WORKDIR /app/apps/backend
RUN npx prisma generate --schema=prisma/schema.prisma

# Build shared library then backend
WORKDIR /app/packages/shared
RUN pnpm build

WORKDIR /app/apps/backend
RUN pnpm build

# Stage 2: Production Dependencies (Minimal)
FROM node:20-slim AS runner-deps
WORKDIR /app
RUN npm install -g pnpm@10
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Runtime image
FROM node:20-slim AS production

WORKDIR /app

# Install runtime-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    ca-certificates \
    postgresql-client \
    openssl \
    ffmpeg \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Environment setup
ENV TZ=America/Sao_Paulo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Create non-root user and set permissions
RUN mkdir -p /app/data /app/logs /app/apps/backend/.wwebjs_auth /app/apps/backend/.wwebjs_cache \
    && chown -R node:node /app

# Copy production node_modules from runner-deps
COPY --from=runner-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=runner-deps --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=runner-deps --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built code from builder
COPY --from=builder --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /app/apps/backend/dist ./apps/backend/dist

# Copy static assets and config
COPY --chown=node:node apps/backend/prisma ./apps/backend/prisma
COPY --chown=node:node apps/backend/package.json ./apps/backend/package.json
COPY --chown=node:node apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

USER node
WORKDIR /app/apps/backend

EXPOSE 3041
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
