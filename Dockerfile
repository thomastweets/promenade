FROM node:22-bookworm AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev

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

FROM caddy:2.8-alpine AS static

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /usr/share/caddy
