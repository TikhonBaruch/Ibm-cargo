# Broker Next surface (Phase 5 / ADR D16). Host-built standalone → .export/
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY containers/broker/.export ./
USER nextjs
EXPOSE 3002
CMD ["node", "containers/broker/server.js"]
