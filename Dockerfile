# syntax=docker/dockerfile:1

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Bundle add user script
RUN bun build scripts/add-user.ts --outdir . --target bun

# Runtime stage
FROM oven/bun:1-slim AS runtime

# Labels
LABEL org.opencontainers.image.title="DimeTime"
LABEL org.opencontainers.image.description="Personal financial planner"

WORKDIR /app

# Create data directory with proper ownership (use existing bun user)
RUN mkdir -p /data && chown bun:bun /data

# Install curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy built application with proper ownership
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder --chown=bun:bun /app/add-user.js ./
COPY --from=builder --chown=bun:bun /app/package.json ./

# Switch to non-root user
USER bun

# Environment defaults
ENV HOST=0.0.0.0
ENV PORT=4321
ENV DB_FILE_NAME=/data/sqlite.db

# Expose port
EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:4321/health || exit 1

# Start command: run migrations then start server
CMD ["sh", "-c", "bun run scripts/migrate.ts && bun run ./dist/server/entry.mjs"]
