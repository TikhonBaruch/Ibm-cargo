# Base nginx Hub pulls are flaky on some networks; node:22-alpine is already
# cached for other services and provides Alpine apk for nginx.
FROM node:22-alpine
RUN apk add --no-cache nginx wget \
  && mkdir -p /run/nginx \
  && rm -rf /var/cache/apk/*
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
