# Next.js web — host `npm run build` then stage standalone into .export/
#   npm run build && rm -rf containers/web/.export && mkdir -p containers/web/.export \
#     && cp -a .next/standalone/. containers/web/.export/ \
#     && cp -a .next/static containers/web/.export/.next/static \
#     && cp -a public containers/web/.export/public
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache wget su-exec \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY containers/web/.export ./
COPY containers/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
  && mkdir -p public/uploads/ved \
  && chown -R nextjs:nodejs public/uploads
EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
