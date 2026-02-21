export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['@csrf-armor/nuxt'],
  app: {
    head: {
      titleTemplate: '%s | CSRF Armor',
      title: 'Nuxt Demo',
      meta: [
        { name: 'description', content: 'Interactive demo of CSRF protection strategies using @csrf-armor/nuxt' },
      ],
    },
  },
  csrfArmor: {
    strategy: 'signed-double-submit',
    secret: 'super-secret-key-for-dev-only-32-chars-long-enough',
    token: { expiry: 3600, fieldName: '_csrf' },
    cookie: { secure: false /* must be true in production (HTTPS) */, name: 'x-csrf-token' },
    allowedOrigins: ['http://localhost:3000'],
  },
  devtools: { enabled: false },
})
