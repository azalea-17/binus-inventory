# ==============================================================================
# MULTI-STAGE DOCKERFILE: BACKEND (NODE.JS / EXPRESS)
# Security: Multi-stage build with non-root user execution ('node')
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependency Builder
# ------------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app/backend

# Install only production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ------------------------------------------------------------------------------
# Stage 2: Production Minimal Runner
# ------------------------------------------------------------------------------
FROM node:24-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app/backend

# Copy production dependencies from builder stage
COPY --from=builder /app/backend/node_modules ./node_modules
COPY backend/package*.json ./
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/sql ./sql
COPY --chown=node:node frontend/index.html frontend/style.css frontend/script.js /app/frontend/

# Security: Execute as non-root user 'node'
USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
