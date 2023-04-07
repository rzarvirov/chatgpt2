import { createApp } from 'vue'
import vue3GoogleLogin from 'vue3-google-login'
import { register } from 'swiper/element/bundle'
import { Swiper, SwiperSlide } from 'swiper/vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'
import 'swiper/swiper-bundle.css'

// Import the initYandexMetrica function
import { initYandexMetrica } from './yandex-metrica'

async function bootstrap() {
  const app = createApp(App)

  register()

  setupAssets()

  setupScrollbarStyle()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.use(vue3GoogleLogin, {
    clientId: '474493346119-5o0f10gmqbr1ecdj8is1igk74jp65422.apps.googleusercontent.com',
  })

  app.component('Swiper', Swiper)
  app.component('SwiperSlide', SwiperSlide)

  // Call the initYandexMetrica function with your Yandex Metrica ID
  const yandexMetricaId = '93129644' // Replace with your actual Yandex Metrica ID
  initYandexMetrica(yandexMetricaId)

  app.mount('#app')
}

bootstrap()
