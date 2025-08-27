# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# System deps (optional, but useful for native modules)
RUN apk add --no-cache python3 make g++

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
# Install deps (auto-detects your lockfile)
RUN \
    if [ -f package-lock.json ]; then npm ci --omit=dev=false; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm i; fi

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

RUN ls -la dist && sed -n '1,80p' dist/server.js

# ---- runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

# Create non-root user for security
RUN addgroup -S app && adduser -S app -G app
USER app

# Copy only the runtime bits
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Render will inject PORT; default 3000 for local
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/server.js"]
