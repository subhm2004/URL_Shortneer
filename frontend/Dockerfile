# Next.js, not a static bundle — so this serves a Node process rather than nginx.
#
# Three stages so the final image carries neither the source nor the build
# toolchain: only the standalone server output and its runtime dependencies.

# ---- deps -------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time, not read
# at runtime — so they have to arrive as build args. Changing one means
# rebuilding the image; setting it in the container's env would do nothing.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MCP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MCP_URL=$NEXT_PUBLIC_MCP_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run --------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Don't run as root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# The standalone output already contains a minimal node_modules and server.js.
# `static` and `public` are not bundled into it and must be copied alongside.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
