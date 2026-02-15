FROM node:24-slim AS base
WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

COPY . .

RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

EXPOSE 3000
ENV HOST="0.0.0.0"
ENV PORT="3000"

CMD [ "node", "build/index.js" ]