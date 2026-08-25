# AI draft service (C3 / D21). Build context = repo root.
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY containers/ai/package.json ./
COPY containers/ai/src ./src
COPY src/lib/ved/ai-draft-rules.json ./src/ai-draft-rules.json
EXPOSE 4100
CMD ["npm", "start"]
