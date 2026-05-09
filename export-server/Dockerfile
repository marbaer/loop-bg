# Stage 1: Build the Vite harness from the SPA source
FROM node:20-slim AS harness-builder
WORKDIR /spa
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build:harness

# Stage 2: Compile the export server TypeScript (needs devDependencies for @types/*)
FROM node:20-slim AS server-builder
WORKDIR /app
COPY export-server/package.json export-server/package-lock.json* ./
RUN npm ci
COPY export-server/src/ ./src/
COPY export-server/tsconfig.json ./
RUN npx tsc

# Stage 3: Runtime image — chromium + ffmpeg, production node_modules only
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY export-server/package.json export-server/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=server-builder /app/dist/ ./dist/
COPY --from=harness-builder /spa/dist-harness/ ./public/

ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
