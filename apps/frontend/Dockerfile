FROM node:18-alpine AS base

# Install pnpm (version compatible with lockfileVersion 9.0)
RUN npm install -g pnpm@10

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm build

# Build frontend
WORKDIR /app/apps/frontend
# Create public directory if it doesn't exist (Next.js may need it)
RUN mkdir -p public
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm (version compatible with lockfileVersion 9.0)
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from build stage
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=base /app/apps/frontend/next.config.js ./apps/frontend/next.config.js
COPY --from=base /app/apps/frontend/package.json ./apps/frontend/package.json
# Create public directory (Next.js needs it, even if empty)
WORKDIR /app/apps/frontend
RUN mkdir -p public

WORKDIR /app/apps/frontend

# Expose port
EXPOSE 3040

ENV NODE_ENV=production
ENV PORT=3040

# Start the application
CMD ["pnpm", "start"]

