
# Stage 1: Build frontend assets
FROM node:22-alpine AS build

WORKDIR /app
COPY index.html style.css script.js ./
RUN mkdir -p /out && cp index.html style.css script.js /out/

# Stage 2: Run Nginx as a non-root user
FROM nginx:1.28-alpine AS runtime


RUN rm -f /etc/nginx/conf.d/default.conf \
 && sed -i \
      -e '/^[[:space:]]*user[[:space:]]*nginx;/d' \
      -e 's#^[[:space:]]*pid[[:space:]].*;#pid /tmp/nginx.pid;#' \
      /etc/nginx/nginx.conf \
 && mkdir -p /var/cache/nginx /var/run \
 && chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html /etc/nginx/conf.d

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /out/ /usr/share/nginx/html/

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
