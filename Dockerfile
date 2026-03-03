# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
# Install ALL dependencies (including dev tools like nodemon since we are mounting code and editing live)
RUN npm install

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install openssh-server, git, generate host keys, and configure sshd
RUN apk add --no-cache openssh-server git openrc && \
  ssh-keygen -A && \
  sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/g' /etc/ssh/sshd_config && \
  sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/g' /etc/ssh/sshd_config && \
  echo 'root:admin' | chpasswd

# Non-root user for the node application (ssh still uses root or configured user)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install nodemon globally so it's always in PATH regardless of volume mounts
RUN npm install -g nodemon

# Ensure persistent volume directories exist and are writable
RUN mkdir -p data uploads && chown -R appuser:appgroup /app

# Expose Node.js and SSH ports
EXPOSE 3000 22

# Health-check: verify the login endpoint responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/login \
  --post-data='{"username":"admin_01","password":"wrong"}' \
  --header='Content-Type: application/json' || exit 1

# Make start script executable
RUN chmod +x start.sh

# Start both sshd and Node.js (with an on-the-fly dos2unix fix for Windows CRLF issues)
CMD ["/bin/sh", "-c", "dos2unix start.sh && chmod +x start.sh && ./start.sh"]
