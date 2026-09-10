# --- build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# The build context is the repo root, not this directory, because two projects
# go into this image: apps/api and the packages/shared it depends on. They are
# independent npm projects with a lockfile each — there is no workspace root and
# nothing is hoisted — so each gets its own install, from its own lockfile, into
# its own node_modules.
#
# Manifests for both first, so editing source doesn't invalidate either install.
# apps/api's install resolves "@correlliayards/shared": "file:../../packages/shared"
# by symlinking it, which needs that directory's package.json to already be here
# — hence both COPYs before either npm ci.
COPY packages/shared/package.json packages/shared/package-lock.json packages/shared/
COPY apps/api/package.json apps/api/package-lock.json apps/api/
RUN cd packages/shared && npm ci
RUN cd apps/api && npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api

# Shared first, and not for tidiness: apps/api imports @correlliayards/shared by
# its package name, which resolves through that symlink to packages/shared/dist.
# `dist` is in .dockerignore — correctly, the host's build has no business in
# the image — so nothing here has compiled it yet and the API's own tsc would
# fail to resolve the module. The root's build-api script pairs these two for
# the same reason.
RUN cd packages/shared && npm run build
RUN cd apps/api && npm run build

# --- production dependencies ---------------------------------------------
# A separate install rather than pruning the one above, because `npm prune`
# leaves behind whatever it cannot prove is unreachable. Starting from the
# lockfiles with --omit=dev gives exactly the runtime trees and nothing else.
FROM node:24-alpine AS deps
WORKDIR /app

COPY packages/shared/package.json packages/shared/package-lock.json packages/shared/
COPY apps/api/package.json apps/api/package-lock.json apps/api/
RUN cd packages/shared && npm ci --omit=dev
RUN cd apps/api && npm ci --omit=dev

# --- serve ---------------------------------------------------------------
FROM node:24-alpine AS serve
WORKDIR /app

# Read by config.ts, and it decides four things at once: the server binds
# 0.0.0.0 rather than loopback, X-Forwarded-For is trusted, TLS to Postgres
# defaults to verified, and the session cookie becomes Secure. It also keeps the
# dev auth console in routes/dev-console.ts unmounted — that console is a
# same-origin page which drives the login flow by hand, and it must never answer
# on a deployed instance.
ENV NODE_ENV=production

# packages/shared brings its own node_modules, and that is a real requirement
# rather than symmetry: shared/dist/index.js does `import { z } from 'zod'`, and
# node resolves that from packages/shared/node_modules. Under the old workspace
# layout zod was hoisted to a root node_modules and shared found it there by
# walking up. There is no root node_modules now, so if this line goes the API
# boots and dies on the first schema it touches.
COPY packages/shared/package.json packages/shared/package.json
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist

# apps/api/node_modules holds the symlink at @correlliayards/shared pointing up
# and across into packages/shared, which is why the three lines above have to
# land before this one means anything. npm writes that link as an absolute path
# rooted at the WORKDIR it installed under, so every stage here uses /app and
# the tree is reassembled at the same place it was built. Change the WORKDIR in
# one stage and the link dangles.
COPY apps/api/package.json apps/api/package.json
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
# Read from disk at runtime, not compiled in: db/migrate.ts resolves this folder
# two levels up from its own module url, so it has to sit beside dist/ exactly
# as it does in the repo. Without it a boot with DATABASE_MIGRATE unset — which
# is to say the default — finds no migrations and brings up a server against an
# empty schema.
COPY apps/api/drizzle apps/api/drizzle

# Drop root before running anything. The image ships with a `node` user for
# this; the process needs to read its own files and open a socket, and nothing
# else.
USER node

EXPOSE 8080

# Busybox wget, already in the base image. /health is registered before the
# listen call and does not touch the database, so it answers as soon as the
# socket is up — which is the question a healthcheck is asking.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/health || exit 1

# Straight to node, not through `npm run start`: that script carries
# --env-file-if-exists=.env.local for local runs, and an image reads its
# environment from the environment. npm in between would also swallow the
# SIGTERM that index.ts installs a handler for, turning every graceful shutdown
# into a ten-second wait for the kill.
CMD ["node", "apps/api/dist/index.js"]
