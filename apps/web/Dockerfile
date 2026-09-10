# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# The build context is the repo root, not this directory, because two projects
# go into this build: apps/web and the packages/shared it depends on. They are
# independent npm projects with a lockfile each — there is no workspace root and
# nothing is hoisted — so each gets its own install, from its own lockfile, into
# its own node_modules.
#
# Manifests for both first, so editing source doesn't invalidate either install.
# apps/web's install resolves "@correlliayards/shared": "file:../../packages/shared"
# by symlinking it, which needs that directory's package.json to already be here
# — hence both COPYs before either npm ci.
COPY packages/shared/package.json packages/shared/package-lock.json packages/shared/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN cd packages/shared && npm ci
RUN cd apps/web && npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

# Shared first. apps/web imports @correlliayards/shared by its package name,
# which resolves through that symlink to packages/shared/dist, and `dist` is in
# .dockerignore — so unless this runs, the host's build output is absent and
# nothing has replaced it. apps/web/tsconfig.json does not reference
# packages/shared as a project, so `tsc -b` will not build it either; it just
# fails to resolve the module. The root's build-front script pairs these two for
# the same reason.
RUN cd packages/shared && npm run build
RUN cd apps/web && npm run build

# --- serve ---------------------------------------------------------------
# Only the bundle crosses over. Vite has already inlined everything it needs
# from shared, so no node_modules and no packages/shared in this stage.
FROM caddy:2-alpine AS serve

COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
