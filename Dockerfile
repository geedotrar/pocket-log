# Multi-stage Dockerfile for Next.js app
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Development runner (for hot-reloading)
FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV WATCHPACK_POLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 3: Builder for production
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Prerender cache permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Standalone output from Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
