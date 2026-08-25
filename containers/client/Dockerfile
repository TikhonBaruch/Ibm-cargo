# Client Next surface (Phase 5 / ADR D17). Host-built standalone → .export/
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY containers/client/.export ./
USER nextjs
EXPOSE 3003
CMD ["node", "containers/client/server.js"]
