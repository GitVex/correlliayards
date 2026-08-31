# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# The build context is the repo root, not this directory: `npm ci` installs from
# the workspace lockfile, which lives above apps/web and describes every
# workspace at once. Manifests come over on their own first, so editing source
# doesn't invalidate the install layer.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=apps/web --include-workspace-root

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

# --- serve ---------------------------------------------------------------
FROM caddy:2-alpine AS serve

COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
