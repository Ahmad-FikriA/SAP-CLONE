# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure persistent volume directories exist and are writable
RUN mkdir -p data uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Health-check: verify the login endpoint responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/login \
        --post-data='{"username":"admin_01","password":"wrong"}' \
        --header='Content-Type: application/json' || exit 1

CMD ["node", "src/server.js"]
