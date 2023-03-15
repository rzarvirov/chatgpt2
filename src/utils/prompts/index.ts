// utils.ts
import { t } from '@/locales'

export const downloadPromptTemplate = async (downloadURL: string) => {
  try {
    const response = await fetch(downloadURL)
    const jsonData = await response.json()
    let tempPromptValue = ''
    if ('key' in jsonData[0] && 'value' in jsonData[0])
      tempPromptValue = JSON.stringify(jsonData)
    if ('act' in jsonData[0] && 'prompt' in jsonData[0]) {
      const newJsonData = jsonData.map((item: { act: string; prompt: string }) => {
        return {
          key: item.act,
          value: item.prompt,
        }
      })
      tempPromptValue = JSON.stringify(newJsonData)
    }
    return tempPromptValue
  }
  catch {
    throw new Error(t('store.downloadError'))
  }
}
