FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/src ./src
COPY --chown=node:node backend/sql ./sql
COPY --chown=node:node frontend/index.html frontend/style.css frontend/script.js /app/frontend/

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
