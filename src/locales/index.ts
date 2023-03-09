import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import enUS from './en-US'
import zhCN from './zh-CN'
import zhTW from './zh-TW'
import ruRU from './ru-RU'
import { useAppStoreWithOut } from '@/store/modules/app'
import type { Language } from '@/store/modules/app/helper'

const appStore = useAppStoreWithOut()

const defaultLocale = appStore.language || 'ru-RU'

const i18n = createI18n({
  locale: defaultLocale,
  fallbackLocale: 'ru-RU',
  allowComposition: true,
  messages: {
    'en-US': enUS,
    'ru-RU': ruRU
    'zh-CN': zhCN,
    'zh-TW': zhTW,
  },
})

export function t(key: string) {
  return i18n.global.t(key)
}

export function setLocale(locale: Language) {
  i18n.global.locale = locale
}

export function setupI18n(app: App) {
  app.use(i18n)
}

export default i18n
