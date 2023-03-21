import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { get, post } from '@/utils/request'
import { useAuthStoreWithout } from '@/store/modules/auth'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}

export function fetchChatAPIProcess<T = any>(
  params: {
    roomId: number
    uuid: number
    regenerate?: boolean
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    model?: string
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  return post<T>({
    url: '/chat-process',
    data: {
      roomId: params.roomId,
      uuid: params.uuid,
      regenerate: params.regenerate || false,
      prompt: params.prompt,
      options: params.options,
      model: params.model,
    },
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}

export function fetchLogin<T = any>(username: string, password: string) {
  return post<T>({
    url: '/user-login',
    data: { username, password },
  })
}

export function fetchRegister<T = any>(username: string, password: string) {
  return post<T>({
    url: '/user-register',
    data: { username, password },
  })
}

export function fetchUpdateUserInfo<T = any>(name: string, avatar: string, description: string) {
  return post<T>({
    url: '/user-info',
    data: { name, avatar, description },
  })
}

export function fetchGetChatRooms<T = any>() {
  return get<T>({
    url: '/chatrooms',
  })
}

// Client-side function to fetch the user's account type
export function fetchGetUserAccountType<T = any>() {
  const authStore = useAuthStoreWithout()
  const token = authStore.token

  return get<T>({
    url: '/accounttype',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Client-side function to fetch the user's balance
export function fetchGetUserBalance<T = any>() {
  const authStore = useAuthStoreWithout()
  const token = authStore.token

  return get<T>({
    url: '/balance',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Update user balance
export function fetchUpdateUserBalance<T = any>(newBalance: number) {
  return post<T>({
    url: '/update-balance',
    data: {
      newBalance,
    },
  })
}

export function fetchCreateChatRoom<T = any>(title: string, roomId: number) {
  return post<T>({
    url: '/room-create',
    data: { title, roomId },
  })
}

export function fetchRenameChatRoom<T = any>(title: string, roomId: number) {
  return post<T>({
    url: '/room-rename',
    data: { title, roomId },
  })
}

export function fetchDeleteChatRoom<T = any>(roomId: number) {
  return post<T>({
    url: '/room-delete',
    data: { roomId },
  })
}

export function fetchGetChatHistory<T = any>(roomId: number) {
  return get<T>({
    url: `/chat-hisroty?roomid=${roomId}`,
  })
}

export function fetchClearChat<T = any>(roomId: number) {
  return post<T>({
    url: '/chat-clear',
    data: { roomId },
  })
}

export function fetchDeleteChat<T = any>(roomId: number, uuid: number, inversion?: boolean) {
  return post<T>({
    url: '/chat-delete',
    data: { roomId, uuid, inversion },
  })
}
