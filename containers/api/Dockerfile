# Domain API (Phase 6). Build context = repo root.
# Prefers host-vendored node_modules (npm-in-Docker often times out).
# 12-Factor: build-time prisma generate, node as PID 1, non-root USER.
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache wget openssl \
  && addgroup -S appuser && adduser -S -G appuser appuser

COPY containers/api/package.json ./
COPY prisma ./prisma
COPY containers/api/node_modules ./node_modules
COPY containers/api/src ./src
COPY src/lib/ved/tnved-layer-g.json ./src/tnved-layer-g.json
COPY src/lbm-bro/lib/hs-aliases.json ./src/hs-aliases.json

# Client generated at image build — not at container start (Factor III / V).
RUN npx prisma generate --schema=./prisma/schema.prisma \
  && chown -R appuser:appuser /app

ENV PORT=4000
EXPOSE 4000

USER appuser
# Exec form: node is PID 1 so SIGTERM reaches graceful-shutdown.js
CMD ["node", "src/index.js"]
