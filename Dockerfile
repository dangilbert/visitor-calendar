# Node 20 is end of life. 22.23.4 fixes CVE-2026-111497 (Brotli decoder
# out-of-bounds write), which matters here: axios decompresses the fetched
# calendar feed. Pinned to the patch release so the shipped runtime is explicit.
FROM node:22.23.4-alpine

LABEL org.opencontainers.image.source="https://github.com/dangilbert/visitor-calendar"

WORKDIR /usr/src/app

# Production dependencies only: nodemon, browser-sync and friends are for local
# development and have no business in the image.
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY . .

USER node
EXPOSE 3000
CMD ["node", "server.js"]
