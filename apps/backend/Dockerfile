############################
# Base / Build stage
############################
FROM node:20-slim AS base

# Install pnpm and build-time dependencies
RUN npm install -g pnpm@10 --registry=https://registry.npmjs.org/
WORKDIR /app

# Install native build tools for canvas and puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY .npmrc ./
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Force development mode for build deps
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# Prisma generate
WORKDIR /app/apps/backend
RUN pnpm db:generate

# Build shared & backend
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/apps/backend
RUN npx prisma generate --schema=prisma/schema.prisma
RUN pnpm build

############################
# Production stage
############################
FROM node:20-slim AS production

# Install pnpm in production stage as well
RUN npm install -g pnpm@10 --registry=https://registry.npmjs.org/

WORKDIR /app

# Install runtime libraries only
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

# Set timezone
ENV TZ=America/Sao_Paulo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user and set permissions
# Note: user 'node' (uid 1000) already exists in node images
RUN mkdir -p /app/data /app/logs /app/apps/backend/.wwebjs_auth /app/apps/backend/.wwebjs_cache \
    && chown -R node:node /app

# Copy dependencies and build artifacts from base
COPY --from=base --chown=node:node /app/node_modules ./node_modules
COPY --from=base --chown=node:node /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=base --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules

COPY --chown=node:node . .
COPY --from=base --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=base --chown=node:node /app/apps/backend/dist ./apps/backend/dist

# Entrypoint setup
COPY --chown=node:node apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

# Use non-root user
USER node

EXPOSE 3041
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
