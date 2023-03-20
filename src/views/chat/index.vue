<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
import { fetchChatAPIProcess, fetchGetUserBalance, fetchUpdateUserBalance } from '@/api'
import { t } from '@/locales'
import { useAuthStoreWithout } from '@/store/modules/auth'

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()

// balance script

const authStore = useAuthStoreWithout()
const isAuthenticated = computed(() => authStore.session && authStore.session.auth)
const balance = ref(0)

const isBalanceZero = computed(() => {
  // Replace `balance` with the variable or getter you use to track the balance
  return balance.value === 0
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

onMounted(async () => {
  if (authStore.session == null || !authStore.session.auth || authStore.token)
    await fetchBalance()
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

function handleRecharge() {
  // Add your recharge logic here
  ms.warning('Лимит запросов исчерпан')
  dialog.warning({
    title: 'Пополнение баланса',
    content: 'Автоматическое пополнение временно недоступно. Поддержите проект на любую сумму и мы пополним ваш баланс. Текущая средняя стоимость запроса к gpt-4 ~ 0.1$ за сообщение. Возможность выбирать модель для использования (включая более доступную gpt-3.5) появится в следующем релизе. Не забудьте указать ваш e-mail в комментарии к переводу. Хотите поддержать?',
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      // Replace 'https://example.com' with the URL you want to open
      window.open('https://pay.cloudtips.ru/p/99817dfa', '_blank')
    },
  })
}

// end of balance script
useCopyCode()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()
const selectedModel = ref<string>('gpt-3.5-turbo')

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !item.error)))
const showModelSelection = computed(() => !dataSources.value.length)

const prompt = ref<string>('')
const loading = ref<boolean>(false)

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
  onConversation()
}

async function onConversation() {
  let message = prompt.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  controller = new AbortController()
  const chatUuid = Date.now()
  addChat(
    +uuid,
    {
      uuid: chatUuid,
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
      uuid: chatUuid,
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
        roomId: +uuid,
        uuid: chatUuid,
        prompt: message,
        options,
        model: selectedModel.value,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n')
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
                text: lastText + data.text ?? '',
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

            scrollToBottom()
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
      scrollToBottom()
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
    scrollToBottom()
  }
  finally {
    loading.value = false
  }
  await reduceBalance()
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
          const lastIndex = responseText.lastIndexOf('\n')
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
  }
  await reduceBalance()
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
      prompt.value = '' // Clear the textarea
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  // Add a check for isBalanceZero
  if (isBalanceZero.value) {
    // Display an error message
    // Replace `errorMessage` with the method or variable you use to display error messages
    ms.warning('Баланс запросов исчерпан')
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
const renderOption = (option: { label: string }) => {
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

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
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
const ITEMS_PER_PAGE = 22

const pages = computed(() => {
  const pagesArray = []
  for (let i = 0; i < keys.length; i += ITEMS_PER_PAGE)
    pagesArray.push(keys.slice(i, i + ITEMS_PER_PAGE))

  return pagesArray
})

const handleHashtagClick = (key: string) => {
  const clickedPrompt = PromptsList.find(prompt => prompt.key === key)
  if (clickedPrompt)
    prompt.value = clickedPrompt.value
}

const getColourForKey = (key: string) => {
  const prompt = PromptsList.find(prompt => prompt.key === key)
  return prompt ? prompt.colour : '#72BCD4' // Fallback color if not found
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
          <template v-if="showModelSelection">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-500">
              <select
                v-model="selectedModel"
                class="bg-white shadow-md rounded p-2 dark:bg-gray-800 dark:text-white"
              >
                <option value="gpt-3.5-turbo">
                  Базовая: gpt-3.5-turbo
                </option>
                <option value="gpt-4">
                  PRO: gpt-4
                </option>
              </select>
            </div>
            <br>
            <div style="text-align: center;">
              <swiper-container
                class="swiper-container-custom"
                slides-per-view="1"
                :pagination="{ clickable: true }"
                pagination-type="bullets"
                :space-between="30"
                css-mode="true"
                :mousewheel="true"
              >
                <swiper-slide v-for="(page, pageIndex) in pages" :key="pageIndex">
                  <div style="text-align: center;">
                    <div
                      v-for="(key, index) in page"
                      :key="index"
                      :style="`display: inline-block; background-color: ${getColourForKey(key)}; border: 1px solid ${getColourForKey(key)}; border-radius: 20px; padding: 5px 10px; margin: 5px; cursor: pointer; color: black; font-size: ${isMobile ? '12px' : '14px'};`"
                      @click="handleHashtagClick(key)"
                    >
                      {{ key }}
                    </div>
                  </div>
                </swiper-slide>
              </swiper-container>
            </div>
          </template>
          <template v-else>
            <div class="text-center mb-4 text-neutral-500">
              Выбранная модель: {{ selectedModel }}
            </div>
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
                v-model:value="prompt" type="textarea" :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: 8 }" @input="handleInput" @focus="handleFocus" @blur="handleBlur" @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
          <NButton v-if="balance > 0" type="primary" :disabled="buttonDisabled || isBalanceZero" @click="handleSubmit">
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
          <div v-if="isAuthenticated">
            <NButton
              v-if="balance === 0"
              style="display: inline-block; background-color: #72BCD4; border: 0px solid #72BCD4; border-radius: 20px; padding: 5px 10px; margin: 5px; cursor: pointer; font-size: ${isMobile ? '12px' : '16px'}"
              @click="handleRecharge"
            >
              Пополнить
            </NButton>
            <div v-else>
              <div class="circle-container">
                <div class="gold-circle flex items-center justify-center w-8 h-8 rounded-full bg-gold text-white">
                  <span>10</span>
                </div>
                <div class="blue-circle flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white">
                  <span>{{ balance }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
  .swiper-container-custom {
    padding-bottom: 40px;
  }

  .bg-gold {
  background-color: gold;
}
.circle-container {
  position: relative;
  display: inline-flex;
  margin-left: -35px; /* Add a negative margin to reduce space */
}

.blue-circle {
  z-index: 1;
}

.gold-circle {
  position: relative;
  right: -40px;
  z-index: 0;
}
</style>
