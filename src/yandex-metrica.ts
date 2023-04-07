interface YandexMetrica {
  (...args: any[]): void
  a?: any[][]
  l?: number
}

declare global {
  interface Window {
    ym: YandexMetrica
    reachGoal: (targetName: string, params?: object) => void
  }
}

export function initYandexMetrica(metricaId: string): void {
  if (!window.ym) {
    const ym: YandexMetrica = function (...args: any[]) {
      (ym.a || (ym.a = [])).push(args)
    }
    ym.l = new Date().getTime()
    window.ym = ym

    const script = document.createElement('script')
    script.src = 'https://mc.yandex.ru/metrika/tag.js'
    script.async = true
    document.body.appendChild(script)
  }

  window.ym(metricaId, 'init', {
    id: metricaId,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
  })

  window.reachGoal = (targetName: string, params?: object) => {
    window.ym(metricaId, 'reachGoal', targetName, params)
  }
}
