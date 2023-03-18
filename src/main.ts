import { createApp } from 'vue'
import { register } from 'swiper/element/bundle'
import GAuth from 'vue-google-oauth2'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'
import 'swiper/swiper-bundle.min.css'

register()

const gAuthOptions = {
  clientId: '474493346119-5o0f10gmqbr1ecdj8is1igk74jp65422.apps.googleusercontent.com',
  scope: 'profile email',
  prompt: 'select_account',
}

App.use(GAuth, gAuthOptions)

async function bootstrap() {
  const app = createApp(App)
  setupAssets()

  setupScrollbarStyle()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.mount('#app')
}

bootstrap()
