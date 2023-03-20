import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'

class CustomChatGPTAPI extends ChatGPTAPI {
  async sendMessage(
    message: string,
    options: SendMessageOptions & { model?: string },
  ): Promise<ChatMessage> {
    const completionParams = options.model ? { model: options.model } : {}
    const modifiedOptions = {
      ...options,
      completionParams: { ...this._completionParams, ...completionParams },
    }
    return super.sendMessage(message, modifiedOptions)
  }
}

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] предоставлен неправильный ключ API | Incorrect API key provided',
  403: '[OpenAI] сервер отклонил доступ, пожалуйста, попробуйте позже | Server refused to access, please try again later',
  502: '[OpenAI] ошибочный шлюз | Bad Gateway',
  503: '[OpenAI] сервер занят, пожалуйста, попробуйте позже | Server is busy, please try again later',
  504: '[OpenAI] превышение времени ожидания шлюза | Gateway Time-out',
  500: '[OpenAI] внутренняя ошибка сервера | Internal Server Error',
}

dotenv.config()

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 30 * 10000

let apiModel: ApiModel

if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_ACCESS_TOKEN)
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let api: ChatGPTAPI | CustomChatGPTAPI | ChatGPTUnofficialProxyAPI

(async () => {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  if (process.env.OPENAI_API_KEY) {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      debug: true,
    }

    if (isNotEmptyString(process.env.OPENAI_API_BASE_URL))
      options.apiBaseUrl = process.env.OPENAI_API_BASE_URL

    if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
      const agent = new SocksProxyAgent({
        hostname: process.env.SOCKS_PROXY_HOST,
        port: process.env.SOCKS_PROXY_PORT,
      })
      options.fetch = (url, options) => {
        return fetch(url, { agent, ...options })
      }
    }

    api = new CustomChatGPTAPI({ ...options })
    api = new CustomChatGPTAPI({ ...options })
  }
  else {
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN,
      debug: true,
    }

    if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
      const agent = new SocksProxyAgent({
        hostname: process.env.SOCKS_PROXY_HOST,
        port: process.env.SOCKS_PROXY_PORT,
      })
      options.fetch = (url, options) => {
        return fetch(url, { agent, ...options })
      }
    }

    if (isNotEmptyString(process.env.API_REVERSE_PROXY))
      options.apiReverseProxyUrl = process.env.API_REVERSE_PROXY

    setupProxy(options)

    api = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
})()

async function chatReplyProcess(
  message: string,
  lastContext?: { conversationId?: string; parentMessageId?: string },
  process?: (chat: ChatMessage) => void,
  model?: string, // Add this line
) {
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (lastContext) {
      if (apiModel === 'ChatGPTAPI')
        options = { parentMessageId: lastContext.parentMessageId }
      else
        options = { ...lastContext }
    }

    const response = await api.sendMessage(message, {
      ...options,
      model,
      onProgress: (partialResponse) => {
        process?. (partialResponse)
      },
    })

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

async function fetchAPIBalance() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    }
    const response = await axios.get('https://api.openai.com/dashboard/billing/credit_grants', { headers })
    const balance = response.data.total_available ?? 0
    return Promise.resolve(balance.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig() {
  const apibalance = await fetchAPIBalance()
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`) : '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, apibalance },
  })
}

function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (process.env.HTTPS_PROXY || process.env.ALL_PROXY) {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
