FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
COPY src ./src
ENV PORT=4800
EXPOSE 4800
CMD ["npm", "start"]
