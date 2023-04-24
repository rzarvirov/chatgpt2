<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSpace, useMessage } from 'naive-ui'
import { fetchGetUserAccountType, fetchUpdateChatRoomPrompt } from '@/api'
import { t } from '@/locales'
import { useAuthStoreWithout } from '@/store/modules/auth'
import { useBasicLayout } from '@/hooks/useBasicLayout'

import { useChatStore } from '@/store'

// Replace the previous watch function with watchEffect

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const authStore = useAuthStoreWithout()

const chatStore = useChatStore()
const currentChatHistory = computed(() => chatStore.getChatHistoryByCurrentActive)
const ms = useMessage()
const testing = ref(false)
const MAX_TITLE_LENGTH = 10
const titleWords = currentChatHistory.value?.title?.split(' ') ?? []
const trimmedTitle = titleWords.length > MAX_TITLE_LENGTH ? `${titleWords.slice(0, MAX_TITLE_LENGTH).join(' ')}...` : currentChatHistory.value?.title
const title = `Роль чат-бота для этого чата (${trimmedTitle})`

const promptValue = computed(() => currentChatHistory.value?.prompt ?? '')

// Add this line in the <script> section
const initialPromptValue = ref('')
const accountType = ref('')
// Replace the watchEffect with the watch function and set immediate option to true
watch(
  () => props.visible,
  (visible) => {
    if (visible)
      initialPromptValue.value = currentChatHistory.value?.prompt ?? ''
  },
  { immediate: true },
)

interface Props {
  visible: boolean
  roomId: string
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
}

const show = computed({
  get() {
    return props.visible
  },
  set(visible: boolean) {
    emit('update:visible', visible)
  },
})

async function fetchAccountType() {
  try {
    const response = await fetchGetUserAccountType()
    accountType.value = response.data.accounttype
  }
  catch (error) {
    console.error('Error fetching user account type:', error)
  }
}

onMounted(async () => {
  if (authStore.session == null || !authStore.session.auth || authStore.token)
    await fetchAccountType()
})

async function handleSaveChatRoomPrompt() {
  if (!currentChatHistory.value || !currentChatHistory.value)
    return

  // Check if the prompt value has not changed
  if (currentChatHistory.value.prompt === initialPromptValue.value) {
    show.value = false // Close the window
    return
  }

  testing.value = true
  try {
    const { message } = await fetchUpdateChatRoomPrompt(currentChatHistory.value.prompt ?? '', +props.roomId) as { status: string; message: string }
    ms.success(message)
    show.value = false
  }
  catch (error: any) {
    ms.error('hooray', error.message)
  }
  testing.value = false
}

async function handleResetChatRoomPrompt() {
  if (!currentChatHistory.value)
    return

  currentChatHistory.value.prompt = ''
  await handleSaveChatRoomPrompt()
}

const { isMobile } = useBasicLayout()
</script>

<template>
  <NModal
    v-model:show="show" :auto-focus="false" class="custom-card" preset="card" :style="{ width: isMobile ? '90%' : '600px' }" :title="title" size="huge"
    :bordered="false"
  >
    <NInput
      :value="promptValue"
      :disabled="accountType === 'free'"
      type="textarea"
      :autosize="{ minRows: 8, maxRows: 20 }" placeholder="Тут можно описать выбранную роль для этого чата. Если пусто - используем настроки по умолчанию. Поэкспериментируйте и попробуйте что-нибудь неожиданное, например: 'Терминатор, который всегда отвечает стихами про судный день'" @input="(val) => { if (currentChatHistory) currentChatHistory.prompt = val }"
    />

    <template #footer>
      <NSpace justify="end">
        <NButton type="default" @click="handleResetChatRoomPrompt">
          {{ t('common.reset') }}
        </NButton>
        <NButton :loading="testing" type="success" :disabled="accountType === 'free'" @click="handleSaveChatRoomPrompt">
          {{ t('common.save') }}
        </NButton>
        <div v-if="accountType === 'free'" class="text-right">
          <a href="https://boosty.to/aibuddy/about" target="_blank" class="text-blue-500 underline">
            Подпишитесь, чтобы иметь доступ к тонким настройкам роли ассистента
          </a>
        </div>
      </NSpace>
    </template>
  </NModal>
</template>

<style>
/* Styles for screens smaller than or equal to 768px */
@media (max-width: 768px) {
  .custom-card {
    width: 90%;
  }
}

/* Styles for screens larger than 768px */
@media (min-width: 769px) {
  .custom-card {
    width: 500px;
  }
}
</style>
