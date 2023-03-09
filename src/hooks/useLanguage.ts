import { computed } from 'vue'
import { enUS, zhCN, zhTW } from 'naive-ui'
import { useAppStore } from '@/store'
import { setLocale } from '@/locales'
import ruRU from '@/locales/ru-RU'

export function useLanguage() {
  const appStore = useAppStore()

  const language = computed(() => {
    switch (appStore.language) {
      case 'en-US':
        setLocale('en-US')
        return enUS
      case 'ru-RU':
        setLocale('ru-RU')
        return ruRU
      case 'zh-CN':
        setLocale('zh-CN')
        return zhCN
      case 'zh-TW':
        setLocale('zh-TW')
        return zhTW
      default:
        setLocale('zh-CN')
        return enUS
    }
  })

  return { language }
}
