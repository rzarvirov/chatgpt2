import { createApp } from 'vue'
import vue3GoogleLogin from 'vue3-google-login'
import { register } from 'swiper/element/bundle'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'

register()

async function bootstrap() {
  const app = createApp(App)
  setupAssets()

  setupScrollbarStyle()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.use(vue3GoogleLogin, {
    clientId: '474493346119-5o0f10gmqbr1ecdj8is1igk74jp65422.apps.googleusercontent.com',
  })

  app.mount('#app')
}

bootstrap()
