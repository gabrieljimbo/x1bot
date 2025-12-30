FROM node:18-alpine AS base

# Install pnpm (version compatible with lockfileVersion 9.0)
RUN npm install -g pnpm@10

# Set working directory
WORKDIR /app


# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install dependencies (including devDependencies needed for Prisma)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client before building TypeScript
# This must happen before the TypeScript build so types are available
WORKDIR /app/apps/backend

# Generate Prisma Client (this creates types needed for TypeScript compilation)
RUN pnpm db:generate

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm (version compatible with lockfileVersion 9.0)
RUN npm install -g pnpm@10

# Install dependencies for runtime (Puppeteer needs Chromium)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client \
    openssl \
    openssl-dev

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Install all dependencies (needed for Prisma generation)
RUN pnpm install --frozen-lockfile

# Copy built files from build stage
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
# Verify main.js exists in the correct location
RUN test -f /app/apps/backend/dist/apps/backend/src/main.js || (echo "ERROR: main.js not found!" && find /app/apps/backend/dist -name "main.js" && exit 1)

WORKDIR /app/apps/backend

# Generate Prisma Client
RUN pnpm db:generate

# Install Prisma CLI globally for migrations (needed at runtime)
RUN npm install -g prisma@^5.8.0

# Remove devDependencies to reduce image size (Prisma Client remains)
WORKDIR /app
ENV CI=true
RUN pnpm prune --prod

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

# Expose port
EXPOSE 3041

# Use entrypoint script
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]

