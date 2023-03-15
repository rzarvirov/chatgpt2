import { createApp } from 'vue'
import { register } from 'swiper/element/bundle'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'
import 'swiper/swiper-bundle.min.css'
register()

async function bootstrap() {
  const app = createApp(App)
  setupAssets()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.mount('#app')
}

bootstrap()
