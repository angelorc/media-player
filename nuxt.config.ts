import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  future: {
    compatibilityVersion: 4
  },
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxt/icon', 'shadcn-nuxt'],
  css: ['~/assets/css/tailwind.css'],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
})