# Admin Next surface (C2 / ADR D20). Host-built standalone → .export/
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY containers/admin/.export ./
USER nextjs
EXPOSE 3001
# Monorepo tracing nests the entry under containers/admin/
CMD ["node", "containers/admin/server.js"]
