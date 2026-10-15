# Stage 1: build the web app
FROM node:24-alpine AS web
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY data ./data
COPY web ./web
RUN cd web && npm run build

# Stage 2: the web-push library for notifications (the hooks call it through Node)
FROM node:24-alpine AS push
WORKDIR /push
RUN npm init -y >/dev/null && npm install --omit=dev web-push@3.6.7

# Stage 3: PocketBase serves the app and stores progress
FROM alpine:3.22
ARG PB_VERSION=0.40.5
RUN apk add --no-cache ca-certificates unzip wget nodejs \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb && rm /tmp/pb.zip
COPY server/pb_migrations /pb/pb_migrations
COPY server/pb_hooks /pb/pb_hooks
COPY data/titles.json /pb/titles.json
COPY --from=push /push/node_modules /pb/push/node_modules
COPY server/push/send.js /pb/push/send.js
COPY --from=web /app/web/dist /pb/pb_public
EXPOSE 8090
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--publicDir=/pb/pb_public"]
