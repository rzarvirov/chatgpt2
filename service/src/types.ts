import type { FetchFn } from 'chatgpt'

export interface RequestProps {
  roomId: number
  uuid: number
  regenerate: boolean
  prompt: string
  options?: ChatContext
  systemMessage: string
  model?: string
  temperature?: number
  top_p?: number
}

export interface ChatContext {
  conversationId?: string
  parentMessageId?: string
}

export interface ChatGPTUnofficialProxyAPIOptions {
  accessToken: string
  apiReverseProxyUrl?: string
  model?: string
  debug?: boolean
  headers?: Record<string, string>
  fetch?: FetchFn
}

export interface ModelConfig {
  apiModel?: ApiModel
  reverseProxy?: string
  timeoutMs?: number
  socksProxy?: string
  httpsProxy?: string
  allowRegister?: boolean
  balance?: string
}

export type ApiModel = 'ChatGPTAPI' | 'ChatGPTUnofficialProxyAPI' | undefined
