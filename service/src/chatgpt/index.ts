import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { sendResponse } from '../utils'
import { getCacheConfig, getOriginConfig } from '../storage/config'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import { getChatByMessageId } from '../storage/mongo'
import type { RequestOptions } from './types'

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] предоставлен неправильный ключ API | Incorrect API key provided',
  403: '[OpenAI] сервер отклонил доступ, пожалуйста, попробуйте позже | Server refused to access, please try again later',
  502: '[OpenAI] ошибочный шлюз | Bad Gateway',
  503: '[OpenAI] сервер занят, пожалуйста, попробуйте позже | Server is busy, please try again later',
  504: '[OpenAI] превышение времени ожидания шлюза | Gateway Time-out',
  500: '[OpenAI] внутренняя ошибка сервера | Internal Server Error',
}

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 100 * 1000

const { HttpsProxyAgent } = httpsProxyAgent

let apiModel: ApiModel
let api: ChatGPTAPI

export async function initApi() {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  const config = await getCacheConfig()
  if (!config.apiKey && !config.accessToken)
    throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

  if (isNotEmptyString(config.apiKey)) {
    const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: config.apiKey,
      completionParams: { model },
      debug: false,
      messageStore: undefined,
      getMessageById,
    }
    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    await setupProxy(options)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'
  }
  else {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: config.accessToken,
      debug: true,
    }
    if (isNotEmptyString(OPENAI_API_MODEL))
      options.model = OPENAI_API_MODEL

    if (isNotEmptyString(config.reverseProxy))
      options.apiReverseProxyUrl = config.reverseProxy

    await setupProxy(options)

    // api = new ChatGPTUnofficialProxyAPI({ ...options })
    // apiModel = 'ChatGPTUnofficialProxyAPI'
  }
}

async function chatReplyProcess(chatOptions: RequestOptions) {
  const { message, lastContext, process, systemMessage, model, temperature, top_p } = chatOptions
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
      if (isNotEmptyString(model)) {
        if (!options.completionParams)
          options.completionParams = {}

        options.completionParams.model = model
        options.completionParams.temperature = temperature
        options.completionParams.top_p = top_p
      }
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId
      else
        options = { ...lastContext }
    }

    const response = await api.sendMessage(message, {
      ...options,
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

async function fetchBalance() {
  const config = await getCacheConfig()
  const OPENAI_API_KEY = config.apiKey
  const OPENAI_API_BASE_URL = config.apiBaseUrl

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  try {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    const response = await axios.get(`${API_BASE_URL}/dashboard/billing/credit_grants`, { headers })
    const balance = response.data.total_available ?? 0
    return Promise.resolve(balance.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig() {
  const config = await getOriginConfig() as ModelConfig
  config.balance = await fetchBalance()
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: config,
  })
}

async function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  const config = await getCacheConfig()
  if (config.socksProxy) {
    const agent = new SocksProxyAgent({
      hostname: config.socksProxy.split(':')[0],
      port: parseInt(config.socksProxy.split(':')[1]),
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (config.httpsProxy || process.env.ALL_PROXY) {
      const httpsProxy = config.httpsProxy || process.env.ALL_PROXY
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

async function getMessageById(id: string): Promise<ChatMessage | undefined> {
  const isPrompt = id.startsWith('prompt_')
  const chatInfo = await getChatByMessageId(isPrompt ? id.substring(7) : id)

  if (chatInfo) {
    if (isPrompt) { // prompt
      return {
        id,
        conversationId: chatInfo.options.conversationId,
        parentMessageId: chatInfo.options.parentMessageId,
        role: 'user',
        text: chatInfo.prompt,
      }
    }
    else {
      return { // completion
        id,
        conversationId: chatInfo.options.conversationId,
        parentMessageId: `prompt_${id}`, // parent message is the prompt
        role: 'assistant',
        text: chatInfo.response,
      }
    }
  }
  else { return undefined }
}

initApi()

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
