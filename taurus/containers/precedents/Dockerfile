# Domain API (Phase 6). Build context = repo root.
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache wget openssl \
  && addgroup -S appuser && adduser -S -G appuser appuser

COPY containers/precedents/package.json ./
COPY prisma ./prisma
COPY containers/precedents/node_modules ./node_modules
COPY containers/precedents/src ./src

RUN npx prisma generate --schema=./prisma/schema.prisma \
  && chown -R appuser:appuser /app

ENV PORT=4800
EXPOSE 4800

USER appuser
CMD ["node", "src/index.js"]
