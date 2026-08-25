FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
COPY src ./src
ENV PORT=4601
EXPOSE 4601
CMD ["npm", "start"]
