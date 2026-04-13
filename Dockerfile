FROM node:22-bookworm AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS studio-runtime-base

RUN npx playwright install --with-deps chromium

FROM studio-runtime-base AS dev

EXPOSE 4321 4173 8787
CMD ["npm", "run", "dev:all"]

FROM base AS build

ARG SHOW=demo-show
ARG DEFAULT_LOCALE=de
ARG PUBLIC_SITE_URL=http://localhost:4321
ARG PUBLIC_ANALYTICS_PROVIDER=none
ARG PUBLIC_ANALYTICS_DOMAIN=

ENV SHOW=$SHOW \
    DEFAULT_LOCALE=$DEFAULT_LOCALE \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_ANALYTICS_PROVIDER=$PUBLIC_ANALYTICS_PROVIDER \
    PUBLIC_ANALYTICS_DOMAIN=$PUBLIC_ANALYTICS_DOMAIN

COPY . .
RUN npm run build

FROM base AS studio-build

ARG STUDIO_BASE_PATH=/

ENV STUDIO_BASE_PATH=$STUDIO_BASE_PATH

COPY . .
RUN npm run build:studio

FROM studio-runtime-base AS studio-api

COPY . .
EXPOSE 8787
CMD ["node", "--import", "tsx", "studio/server/index.ts"]

FROM caddy:2.8-alpine AS static

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /usr/share/caddy

FROM caddy:2.8-alpine AS studio-static

COPY --from=studio-build /app/studio/dist /usr/share/caddy

FROM caddy:2.8-alpine AS stack-proxy

COPY Caddyfile.stack /etc/caddy/Caddyfile
COPY scripts/bootstrap-dist.sh /usr/local/bin/bootstrap-dist.sh
COPY --from=build /app/dist /srv/dist-image
RUN date -u +%Y%m%d%H%M%S > /srv/dist-image/.promenade-build-id \
  && chmod +x /usr/local/bin/bootstrap-dist.sh \
  && mkdir -p /srv/dist

ENTRYPOINT ["/usr/local/bin/bootstrap-dist.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
