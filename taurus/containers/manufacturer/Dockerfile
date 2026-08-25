# Manufacturer Next surface (ADR D31). Host-built standalone → .export/
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3004
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY containers/manufacturer/.export ./
USER nextjs
EXPOSE 3004
CMD ["node", "containers/manufacturer/server.js"]
