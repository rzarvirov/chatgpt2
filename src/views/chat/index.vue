<!-- eslint-disable no-console -->
<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NAutoComplete, NButton, NInput, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useCopyCode } from './hooks/useCopyCode'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import PromptsList from '@/assets/prompts_RU.json'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore } from '@/store'
import { fetchChatAPIProcess, fetchGetUserAccountType, fetchGetUserBalance, fetchGetUserProBalance, fetchUpdateUserBalance, fetchUpdateUserProBalance } from '@/api'
import { t } from '@/locales'
import { useAuthStoreWithout } from '@/store/modules/auth'

const countdown: Ref<number> = ref(0)
const showCountdownModal = ref(false)

const showModal = ref(false)
const activeTab = ref(1)

function openUrl(url: string) {
  window.open(url, '_blank')
}

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()
const selectedModel = ref<string>('gpt-3.5-turbo')
const sendbuttonClicked = ref(false)
const chatStore = useChatStore()

useCopyCode()

// balance script

const authStore = useAuthStoreWithout()
const isAuthenticated = computed(() => authStore.session && authStore.session.auth)
const balance = ref(0)
const probalance = ref(0)
const accountType = ref('')

const isBalanceZero = computed(() => {
  // Replace `balance` with the variable or getter you use to track the balance
  return balance.value === 0
})

const isProBalanceZero = computed(() => {
  // Replace `balance` with the variable or getter you use to track the balance
  return probalance.value === 0
})

async function fetchBalance() {
  try {
    const response = await fetchGetUserBalance()
    balance.value = response.data.balance
  }
  catch (error) {
    console.error('Error fetching user balance:', error)
  }
}

async function fetchAccountType() {
  try {
    const response = await fetchGetUserAccountType()
    accountType.value = response.data.accounttype
  }
  catch (error) {
    console.error('Error fetching user account type:', error)
  }
}

async function fetchProBalance() {
  try {
    const response = await fetchGetUserProBalance()
    probalance.value = response.data.probalance
  }
  catch (error) {
    console.error('Error fetching user pro balance:', error)
  }
}

onMounted(async () => {
  if (authStore.session == null || !authStore.session.auth || authStore.token) {
    await fetchBalance()
    await fetchAccountType()
  }
})

onMounted(async () => {
  if (authStore.session == null || !authStore.session.auth || authStore.token)
    await fetchProBalance()
})

async function reduceBalance() {
  const newBalance = Math.max(0, balance.value - 1)
  try {
    await fetchUpdateUserBalance(newBalance)
    balance.value = newBalance
  }
  catch (error) {
    console.error('Error updating user balance:', error)
  }
}

async function reduceProBalance() {
  const newProBalance = Math.max(0, probalance.value - 1)
  try {
    await fetchUpdateUserProBalance(newProBalance)
    probalance.value = newProBalance
  }
  catch (error) {
    console.error('Error updating user balance:', error)
  }
}

// function handleRecharge() {
function handleRecharge() {
  showModal.value = true
  sendbuttonClicked.value = true

  /* Add your recharge logic here
  dialog.warning({
    title: 'Пополнение баланса',
    content: 'Автоматическое пополнение временно недоступно. Поддержите проект на Boosty для пополнение баланса. Хотите поддержать?',
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      // Replace 'https://example.com' with the URL you want to open
      window.open('https://boosty.to/aibuddy', '_blank')
    },
  }) */
}

// end of balance script

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()
const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !item.error)))

const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)

// Add PromptStore
const promptStore = usePromptStore()
// Use storeToRefs to ensure that after the store is modified, the Lenovo part can be re-rendered
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

function handleSubmit() {
  sendbuttonClicked.value = true
  onConversation()
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function onConversation() {
  let message = prompt.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  // Check if the user has a free account and a balance less than or equal to 3
  if (balance.value <= 9 && accountType.value === 'free') {
    const delaySeconds = getRandomNumber(10, 20)
    countdown.value = delaySeconds
    showCountdownModal.value = true // Show countdown modal
    for (let i = 0; i < delaySeconds; i++) {
      setTimeout(() => {
        countdown.value -= 1
      }, i * 1000)
    }
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    showCountdownModal.value = false // Hide countdown modal
  }

  controller = new AbortController()
  const chatUuid = Date.now() // ?
  addChat(
    +uuid,
    {
      uuid: chatUuid, // ?
      dateTime: new Date().toLocaleString(),
      text: message,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      uuid: chatUuid, // ?
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        roomId: +uuid, // ?
        uuid: chatUuid, // ?
        prompt: message,
        options,
        model: selectedModel.value,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              dataSources.value.length - 1,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: false,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
          //
          }
        },
      })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    const errorMessage = error?.message ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)
    if (currentChat?.text && currentChat.text !== '') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
    if (selectedModel.value === 'gpt-3.5-turbo')
      await reduceBalance()

    else if (selectedModel.value === 'gpt-4')
      await reduceProBalance()
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true
  const chatUuid = dataSources.value[index].uuid
  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, ...options },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        roomId: +uuid,
        uuid: chatUuid || Date.now(),
        regenerate: true,
        prompt: message,
        options,
        model: selectedModel.value,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + data.text ?? '',
                inversion: false,
                error: false,
                loading: false,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, ...options },
              },
            )

            if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }
          }
          catch (error) {
            //
          }
        },
      })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, ...options },
      },
    )
  }
  finally {
    loading.value = false
    await reduceBalance()
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
      sendbuttonClicked.value = false
    },
  })
}

function handleClear() {
  if (loading.value)
    return
  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
      sendbuttonClicked.value = false
      prompt.value = ''
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  // Add a check for isBalanceZero
  if (selectedModel.value === 'gpt-3.5-turbo' && isBalanceZero.value) {
  // Display an error message for the base model if balance is zero
    ms.warning('Баланс запросов исчерпан')
    return
  }
  else if (selectedModel.value === 'gpt-4' && isProBalanceZero.value) {
  // Display an error message for the PRO model if balance is zero
    ms.warning('Баланс запросов PRO исчерпан')
    return
  }

  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

// optimizable part
// Calculation of search options, here value is used as the index item, so when there is a duplicate value, the rendering is abnormal (multiple selection effects appear at the same time)
// In an ideal state, the key should be used as the index item, but the official renderOption will have problems, so the value anti-renderLabel implementation is required
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})
// value anti-rendering key
function renderOption(option: { label: string }) {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})

// random keys
interface Prompt {
  key: string
  value: string
  colour: string
}

const keys = PromptsList.map((prompt: Prompt) => prompt.key)
const isMobile2 = window.innerWidth <= 768
const ITEMS_PER_PAGE = isMobile2 ? 20 : 60

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const pages = computed(() => {
  const pagesArray = []
  const shuffledKeys = shuffle([...keys]) // Create a shuffled copy of the keys array

  for (let i = 0; i < shuffledKeys.length; i += ITEMS_PER_PAGE)
    pagesArray.push(shuffledKeys.slice(i, i + ITEMS_PER_PAGE))

  return pagesArray
})

function handleHashtagClick(key: string) {
  const clickedPrompt = PromptsList.find(prompt => prompt.key === key)
  if (clickedPrompt)
    prompt.value = clickedPrompt.value
}

function getColourForKey(key: string) {
  const prompt = PromptsList.find(prompt => prompt.key === key)
  return prompt ? prompt.colour : '#72BCD4' // Fallback color if not found
}

const button = ref<HTMLElement | null>(null)

onMounted(() => {
  if (button.value)
    button.value.style.opacity = '1'
})

function goToPage(url: string) {
  window.open(url, '_blank')
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent
      v-if="isMobile"
      :using-context="usingContext"
      @export="handleExport"
      @toggle-using-context="toggleUsingContext"
    />
    <main class="flex-1 overflow-hidden">
      <div
        id="scrollRef"
        ref="scrollRef"
        class="h-full overflow-hidden overflow-y-auto"
      >
        <div
          id="image-wrapper"
          class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <template v-if="!dataSources.length && !sendbuttonClicked">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-500">
              <select
                v-model="selectedModel"
                class="bg-white shadow-md rounded p-2 dark:bg-gray-800 dark:text-white mr-2"
              >
                <option value="gpt-3.5-turbo">
                  Базовый режим
                </option>
                <option value="gpt-4">
                  PRO режим
                </option>
              </select>

              <a href="https://www.about.aibuddy.ru/%D0%BC%D0%BE%D0%B4%D0%B5%D0%BB%D0%B8-chatgpt" target="_blank" class="mr-2">
                <SvgIcon icon="ri:question-line" width="30" />
              </a>

              <!-- New button to open the new window -->
              <button class="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded" @click="handleRecharge">
                Поддержать
              </button>
            </div>
            <br>
            <div style="text-align: center;">
              <swiper
                class="swiper-container-custom grey-bullets"
                slides-per-view="1"
                :pagination="{ clickable: true }"
                pagination-type="bullets"
                :space-between="30"
                :css-mode="true"
                :mousewheel="true"
              >
                <swiper-slide v-for="(page, pageIndex) in pages" :key="pageIndex">
                  <div style="text-align: center;">
                    <div
                      v-for="(key, index) in page"
                      :key="index"
                      :style="`display: inline-block; background-color: ${getColourForKey(key)}; border: 1px solid ${getColourForKey(key)}; border-radius: 10px; padding: 5px 10px; margin: 5px; cursor: pointer; color: black; font-size: ${isMobile ? '12px' : '14px'}; opacity: 1;`"
                      @click="handleHashtagClick(key)"
                    >
                      {{ key }}
                    </div>
                  </div>
                </swiper-slide>
              </swiper>
              <div style="display: flex; justify-content: center; width: 100%;">
                <div
                  ref="button"
                  class="button"
                  :style="`font-size: ${isMobile ? '14px' : '16px'}; display: flex; align-items: center;`"
                  @click="() => goToPage('https://about.aibuddy.ru/recipes')"
                >
                  <SvgIcon icon="ri:reactjs-fill" width="30" style="margin-right: 10px;" />
                  <span>Советы по использованию</span>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-center mt-4 text-center text-neutral-500">
              <select
                v-model="selectedModel"
                class="bg-white shadow-md rounded p-2 dark:bg-gray-800 dark:text-white"
              >
                <option value="gpt-3.5-turbo">
                  Базовый режим
                </option>
                <option value="gpt-4">
                  PRO режим
                </option>
              </select>
            </div><br>
            <div>
              <Message
                v-for="(item, index) of dataSources"
                :key="index"
                :date-time="item.dateTime"
                :text="item.text"
                :inversion="item.inversion"
                :error="item.error"
                :loading="item.loading"
                @regenerate="onRegenerate(index)"
                @delete="handleDelete(index)"
              />
              <div class="sticky bottom-0 left-0 flex justify-center">
                <NButton v-if="loading" type="warning" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="ri:stop-circle-line" />
                  </template>
                  Стоп
                </NButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full max-w-screen-xl m-auto">
        <div class="flex items-center justify-between space-x-2">
          <HoverButton @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="handleExport">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:download-2-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
              <SvgIcon icon="ri:chat-history-line" />
            </span>
          </HoverButton>
          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef"
                v-model:value="prompt" type="textarea" :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: 8 }" @input="handleInput" @focus="handleFocus" @blur="handleBlur" @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
          <NButton
            type="primary"
            :disabled="(selectedModel === 'gpt-3.5-turbo' && balance <= 0) || (selectedModel === 'gpt-4' && probalance <= 0)"
            @click="handleSubmit"
          >
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
          <div v-if="isAuthenticated">
            <NButton
              v-if="selectedModel === 'gpt-3.5-turbo' ? balance === 0 : probalance === 0"
              class="text-black border-0 rounded-lg py-1 px-2 my-1 cursor-pointer"
              :class="{
                'bg-blue-500': selectedModel === 'gpt-3.5-turbo',
                'bg-yellow-500': selectedModel === 'gpt-4',
                'text-xs': isMobile,
                'text-base': !isMobile,
              }"
              @click="handleRecharge"
            >
              Пополнить
            </NButton>

            <div v-else>
              <div class="circle-container">
                <div
                  v-if="(selectedModel === 'gpt-3.5-turbo' && accountType !== 'free') || (selectedModel === 'gpt-3.5-turbo' && balance < 10 && accountType === 'free')"
                  class="blue-circle flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white"
                  style="cursor: pointer;"
                  @click="handleRecharge"
                >
                  <span>{{ balance }}</span>
                </div>

                <div
                  v-else-if="selectedModel === 'gpt-4'"
                  class="blue-circle flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-white"
                  style="cursor: pointer;"
                  @click="handleRecharge"
                >
                  <span>{{ probalance }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
  <div
    v-show="showCountdownModal"
    class="countdown-modal fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
  >
    <div class="bg-white p-8 rounded shadow-lg max-w-lg w-full dark:text-black">
      <h2 class="text-xl font-bold mb-4">
        Вы используете бесплатный аккаунт
      </h2>
      <p>Запрос в очереди: <b>{{ countdown }}</b> секунд</p>
      <button
        class="w-full mt-4 bg-yellow-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        @click="openUrl('https://boosty.to/aibuddy')"
      >
        Поддержать и получить PRO аккаунт
      </button>
      <br><br>Выберите любой уровень подписки и используйте сервис без задержек:<br><br>
      <div class="mb-4 space-y-4 text-black">
        <div>
          <a href="https://boosty.to/aibuddy/purchase/1572084">
            <h3 class="font-bold">
              🔸 <span style="color: rgb(59, 130, 246); text-decoration: underline;">Базовая (99 ₽ в месяц)</span>
            </h3>
          </a>
        </div>
        <div>
          <a href="https://boosty.to/aibuddy/purchase/1572086">
            <h3 class="font-bold">
              🔸 <span style="color: rgb(59, 130, 246); text-decoration: underline;">PRO (299 ₽ в месяц)</span>
            </h3>
          </a>
        </div>
        <div>
          <a href="https://boosty.to/aibuddy/purchase/1628030">
            <h3 class="font-bold">
              🔸 <span style="color: rgb(59, 130, 246); text-decoration: underline;">PRO+ (499 ₽ в месяц)</span>
            </h3>
          </a>
        </div>
        <div>
          <a href="https://boosty.to/aibuddy/purchase/1572088">
            <h3 class="font-bold">
              🔸 <span style="color: rgb(59, 130, 246); text-decoration: underline;">Ultra (999 ₽ в месяц)</span>
            </h3>
          </a>
        </div>
        <div>
          <a href="https://boosty.to/aibuddy/purchase/1572090">
            <h3 class="font-bold">
              🔸 <span style="color: rgb(59, 130, 246); text-decoration: underline;">Unlimited (1 999 ₽ в месяц)</span>
            </h3>
          </a>
        </div>
      </div>
      <button
        class="w-full mt-4 bg-yellow-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        @click="openUrl('https://boosty.to/aibuddy')"
      >
        Узнать подробности и выбрать
      </button>
      <br><br>
      <b>Бесплатано:</b> каждые 24 часа баланс базовой модели увеличивается до 3-х запросов, чтобы вы могли продолжать пользоваться сервисом.
    </div>
  </div>

  <div
    v-show="showModal"
    :style="`font-size: ${isMobile ? '12px' : '14px'};`"
    class="modal fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50"
  >
    <div class="bg-white p-8 rounded shadow-lg max-w-lg w-full dark:text-black">
      <h2 class="text-xl font-bold mb-4 dark:text-black">
        Поддержите проект
      </h2>
      Нам нужна ваша поддержка, чтобы продолжать развиваться и не использовать рекламу. Выберите один из способов и получите вознаграждение.
      <div><br></div>
      <!-- Tab buttons -->
      <div class="flex mb-4">
        <button :class="{ 'bg-blue-500': activeTab === 1, 'bg-gray-400': activeTab !== 1 }" class="flex-1 text-white font-bold py-2 px-4 rounded-l" @click="activeTab = 1">
          Донат
        </button>
        <button :class="{ 'bg-yellow-500': activeTab === 2, 'bg-gray-400 ': activeTab !== 2 }" class="flex-1 text-white font-bold py-2 px-4 rounded-r" @click="activeTab = 2">
          Подписка
        </button>
        <button :class="{ 'bg-green-500': activeTab === 3, 'bg-gray-400': activeTab !== 3 }" class="flex-none text-white font-bold py-2 px-4 ml-2 rounded" @click="activeTab = 3">
          <span class="dark:text-black">
            <SvgIcon icon="ri:send-plane-fill" />
          </span>
        </button>
      </div>

      <!-- Tab content -->
      <div v-show="activeTab === 1" class="tab-content">
        <div class="mb-4 space-y-4 text-black">
          <div>
            <h3 class="font-bold">
              🔹 Старт (100 ₽):
            </h3>
            <p class="text-sm">
              100 запросов к Базовой модели (GPT-3.5)<br>
              5 запросов к PRO-модели (GPT-4)
            </p>
          </div>
          <div>
            <h3 class="font-bold">
              🔹 Развитие (300 ₽):
            </h3>
            <p class="text-sm">
              300 запросов к Базовой модели (GPT-3.5)<br>
              20 запросов к PRO-модели (GPT-4)
            </p>
          </div>
          <div>
            <h3 class="font-bold">
              🔹 Максимум (1 000 ₽):
            </h3>
            <p class="text-sm">
              1000 запросов к Базовой модели (GPT-3.5)<br>
              80 запросов к PRO-модели (GPT-4)
            </p>
          </div>
          <div>
            <h3 class="font-bold">
              Укажите ваш E-Mail в комментарии к переводу
            </h3>
          </div>
        </div>
        <button class="w-full mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" @click="openUrl('https://pay.cloudtips.ru/p/99817dfa')">
          Поддержать
        </button>
        <div class="text-black">
          <br>
          <b>Бесплатано:</b> каждые 24 часа баланс базовой модели увеличивается до 3-х запросов, чтобы вы могли продолжать пользоваться сервисом.
        </div>
      </div>

      <div v-show="activeTab === 2" class="tab-content">
        <!-- Subscription options -->
        <div class="mb-4 space-y-4 text-black">
          <div>
            <a href="https://boosty.to/aibuddy/purchase/1572084">
              <h3 class="font-bold">
                🔸 <span style="color: rgb(59 130 246); text-decoration: underline;">Базовая (99 ₽ в месяц)</span>:
              </h3>
              <p class="text-sm">
                Этот тариф подходит для тех, кто только начинает знакомиться с возможностями ChatGPT.
              </p></a>
          </div>
          <div>
            <h3 class="font-bold">
              🔸 <a href="https://boosty.to/aibuddy/purchase/1572086"><span style="color: rgb(59 130 246); text-decoration: underline;">PRO (299 ₽ в месяц)</span></a> / <a href="https://boosty.to/aibuddy/purchase/1628030"><span style="color: rgb(59 130 246); text-decoration: underline;">PRO+ (499 ₽ в месяц)</span>:
              </a>
            </h3>
            <p class="text-sm">
              Для пользователей с более активным использованием, таких как писатели, маркетологи, и программисты.
            </p>
          </div>
          <div>
            <a href="https://boosty.to/aibuddy/purchase/1572088">
              <h3 class="font-bold">
                🔸 <span style="color: rgb(59 130 246); text-decoration: underline;">Ultra (999 ₽ в месяц)</span>:
              </h3>
              <p class="text-sm">
                Этот тариф предназначен для тех, кто активно работает с большим объемом информации, например аналитиков, исследователей и менеджеров проектов.
              </p></a>
          </div>
          <div>
            <a href="https://boosty.to/aibuddy/purchase/1572090">
              <h3 class="font-bold">
                🔸 <span style="color: rgb(59 130 246); text-decoration: underline;">Unlimited (1 999 ₽ в месяц)</span>:
              </h3>
              <p class="text-sm">
                Этот тариф идеален для профессионалов и организаций, которые не хотят ограничивать свои возможности.
              </p></a>
          </div>
        </div>
        <button class="w-full mt-4 bg-yellow-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" @click="openUrl('https://boosty.to/aibuddy')">
          Выбрать и подписаться
        </button>
      </div>
      <br>
      <div v-show="activeTab === 3" class="tab-content text-black">
        <div class="flex justify-center space-x-4 mt-4">
          <!-- Telegram Share -->
          <a href="https://t.me/share/url?url=https://aibuddy.ru&text=Обалдеть!" target="_blank" class="text-blue-600 hover:text-blue-800">
            <SvgIcon icon="ri:telegram-fill" class="w-12 h-12" />
          </a>

          <!-- Facebook Share -->
          <a href="https://www.facebook.com/sharer/sharer.php?u=https://aibuddy.ru" target="_blank" class="text-blue-800 hover:text-blue-900">
            <SvgIcon icon="ri:facebook-fill" class="w-12 h-12" />
          </a>

          <!-- Twitter Share -->
          <a href="https://twitter.com/intent/tweet?url=https://aibuddy.ru&text=Вау!" target="_blank" class="text-blue-500 hover:text-blue-700">
            <SvgIcon icon="ri:twitter-fill" class="w-12 h-12" />
          </a>
        </div>
        <br><br>Поделитесь нашим сайтом с друзьями и мы начилим вам 50 запросов бесплатно (функция в разработке)
      </div>

      <!-- Close button -->
      <button class="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-white font-bold py-2 px-4 rounded" @click="showModal = false; sendbuttonClicked = false">
        Закрыть
      </button>
    </div>
  </div>
</template>

<style>
  .swiper-container-custom {
    padding-bottom: 40px;
  }
  .button {
  display: inline-block;
  background-color: rgb(59 130 246);
  border: 2px solid rgb(59 130 246);
  border-radius: 5px;
  padding: 5px 10px;
  margin: 5px;
  cursor: pointer;
  color: rgb(255, 255, 255);
  opacity: 0;
  transition: opacity 1s ease-in;
}
/* Add this to your styles */
.grey-bullets .swiper-pagination-bullet {
  background-color: #cccccc; /* Adjust the grey color to your preference */
}

.grey-bullets .swiper-pagination-bullet-active {
  background-color: rgb(59 130 246); /* Adjust the active bullet color to your preference */
}
</style>
