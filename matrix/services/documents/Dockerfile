FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
COPY src ./src
ENV PORT=4750
EXPOSE 4750
CMD ["npm", "start"]
