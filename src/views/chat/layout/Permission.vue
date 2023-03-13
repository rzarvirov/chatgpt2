<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NButton, NInput, NModal, NSpace, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { fetchLogin, fetchRegister, fetchVerify } from '@/api'
import { useAuthStore } from '@/store'
import Icon403 from '@/icons/403.vue'
import SentencesList from '@/assets/sentences.json'

interface Props {
  visible: boolean
}

defineProps<Props>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const ms = useMessage()

const loading = ref(false)
const username = ref('')
const password = ref('')

const disabled = computed(() => !username.value.trim() || !password.value.trim() || loading.value)

onMounted(async () => {
  const verifytoken = route.query.verifytoken as string
  await handleVerify(verifytoken)
})

async function handleVerify(verifytoken: string) {
  if (!verifytoken)
    return
  const secretKey = verifytoken.trim()
  try {
    loading.value = true
    await fetchVerify(secretKey)
    ms.success('Verify success')
    router.replace('/')
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
  }
  finally {
    loading.value = false
  }
}

function handlePress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleLogin()
  }
}
async function handleLogin() {
  const name = username.value.trim()
  const pwd = password.value.trim()
  if (!name || !pwd)
    return
  try {
    loading.value = true
    const result = await fetchLogin(name, pwd)
    authStore.setToken(result.data.token)
    ms.success('success')
    router.go(0)
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
    password.value = ''
  }
  finally {
    loading.value = false
  }
}
async function handleRegister() {
  const name = username.value.trim()
  const pwd = password.value.trim()
  if (!name || !pwd)
    return
  try {
    loading.value = true
    const result = await fetchRegister(name, pwd)
    ms.success(result.message as string)
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
  }
  finally {
    loading.value = false
  }
}

// pick and typ one random sentence:
const sentences = SentencesList
const text = ref('')
let currentSentenceIndex = -1

function typeSentence(sentence: string) {
  return new Promise<void>((resolve) => {
    let i = 0
    const timerId = setInterval(() => {
      text.value = sentence.substring(0, i)
      i++
      if (i > sentence.length) {
        clearInterval(timerId)
        setTimeout(resolve, 2000)
      }
    }, 100)
  })
}

async function typeNextSentence() {
  // Randomly select the next sentence
  let nextSentenceIndex = currentSentenceIndex
  while (nextSentenceIndex === currentSentenceIndex)
    nextSentenceIndex = Math.floor(Math.random() * sentences.length)

  currentSentenceIndex = nextSentenceIndex

  const sentence = sentences[currentSentenceIndex]
  await typeSentence(sentence)
  await new Promise(resolve => setTimeout(resolve, 2000)) // Pause for 2 seconds
  await typeNextSentence()
}

typeNextSentence()
</script>

<template>
  <NModal :show="visible" style="width: 90%; max-width: 640px">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            Авторизация
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            {{ $t('common.unauthorizedTips') }}
          </p>
          <Icon403 class="w-[200px] m-auto" />
        </header>
        <NInput v-model:value="username" type="text" placeholder="Email" />
        <NInput v-model:value="password" type="password" placeholder="Password" @keypress="handlePress" />

        <NSpace v-if="authStore.session && authStore.session.allowRegister" justify="space-around">
          <NButton
            block
            type="primary"
            :disabled="disabled"
            :loading="loading"
            @click.prevent="handleRegister"
          >
            {{ $t('common.register') }}
          </NButton>
          <NButton
            block
            type="primary"
            :disabled="disabled"
            :loading="loading"
            @click.prevent="handleLogin"
          >
            {{ $t('common.login') }}
          </NButton>
        </NSpace>

        <NButton
          v-if="!(authStore.session && authStore.session.allowRegister)"
          block
          type="primary"
          :disabled="disabled"
          :loading="loading"
          @click="handleLogin"
        >
          {{ $t('common.login') }}
        </NButton>
        <p class="text-base text-center text-slate-500">
          Вы сможете свободно использовать нейросетевого чат-бота нового поколения после прохождения короткой регистрации
        </p>
        <p ref="text" class="text-base text-center text-slate-500" />
      <!--
        <p class="text-base text-center text-slate-500" @click="refreshPage">
          <small>Пример: {{ randomSentence }}</small>
        </p>
      -->
      </div>
    </div>
  </NModal>
</template>
