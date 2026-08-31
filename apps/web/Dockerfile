# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- serve ---------------------------------------------------------------
FROM caddy:2-alpine AS serve

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile