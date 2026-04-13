# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:22-alpine AS build-frontend

WORKDIR /app

COPY duck-analytics-front/package.json duck-analytics-front/package-lock.json ./
RUN npm ci

COPY duck-analytics-front/ .
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:22-alpine AS build-backend

WORKDIR /app

COPY duck-analytics-backend/package.json duck-analytics-backend/package-lock.json ./
RUN npm ci

COPY duck-analytics-backend/ .
RUN npx prisma generate && npm run build

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:22-alpine AS runtime

RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Copy frontend build
COPY --from=build-frontend /app/dist /app/frontend

# Copy backend build + dependencies
COPY --from=build-backend /app/dist /app/backend/dist
COPY --from=build-backend /app/node_modules /app/backend/node_modules
COPY --from=build-backend /app/package.json /app/backend/package.json

# Copy Prisma files needed for migrations
COPY --from=build-backend /app/prisma /app/backend/prisma
COPY --from=build-backend /app/prisma.config.ts /app/backend/prisma.config.ts
COPY --from=build-backend /app/src/generated /app/backend/src/generated

# Copy config files
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
