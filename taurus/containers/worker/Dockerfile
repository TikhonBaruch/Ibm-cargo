FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json ./
COPY src ./src
ENV PORT=4200
EXPOSE 4200
CMD ["npm", "start"]
