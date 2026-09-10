import { defineConfig } from 'vitest/config'

/* config.ts validates the whole environment at import, by name, before anything
 * else starts — which is the behaviour we want in production and which means a
 * test importing any module that reaches it needs an environment to import
 * into. Almost everything reaches it: the route modules pull in the guards, the
 * guards pull in config, and public-url.ts reads publicBaseUrl directly.
 *
 * So the values below are a fixture, not configuration. They are deliberately
 * obvious nonsense: nothing here should ever connect to anything, and a test
 * that somehow did should fail against an address that plainly is not real
 * rather than quietly reach a developer's own database.
 *
 * DATABASE_URL carries no sslmode on purpose — config.ts refuses it there, and
 * a fixture that tripped that check would fail every test with an error about
 * TLS instead of the one the test was written for. */
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://test:test@127.0.0.1:1/none',
      DATABASE_SSL: 'disable',
      DATABASE_MIGRATE: 'false',
      ZITADEL_ISSUER: 'https://issuer.invalid',
      ZITADEL_CLIENT_ID: 'test-client',
      ZITADEL_CLIENT_SECRET: 'test-secret',
      APP_BASE_URL: 'https://app.invalid',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
    },
  },
})
