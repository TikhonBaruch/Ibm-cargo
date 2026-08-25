FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
COPY src ./src
ENV PORT=4500
EXPOSE 4500
CMD ["npm", "start"]
