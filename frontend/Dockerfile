# CIRCULO frontend — Phase 10 containerization.
#
# Two-stage build: compile the Vite app in a full Node image, then serve
# the static output with the tiny `serve` package in a fresh image — the
# final container doesn't need Node's full toolchain, npm, or any of the
# build-time dependencies, just the pre-built static files.

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite bakes env vars into the build at BUILD time (this is a client-side
# app — there's no server to read env vars from at runtime). Default
# matches frontend/.env.example: the browser reaches the backend via its
# published host port, same whether the backend is dockerized or not.
ARG VITE_API_BASE_URL=http://127.0.0.1:8000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 4173

CMD ["serve", "-s", "dist", "-l", "4173"]