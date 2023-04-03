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

const loginLoading = ref(false)
const registerLoading = ref(false)
const username = ref('')
const password = ref('')

// ...
const loginDisabled = computed(() => !username.value.trim() || !password.value.trim() || loginLoading.value)
const registerDisabled = computed(() => registerLoading.value)
// ...

onMounted(async () => {
  const verifytoken = route.query.verifytoken as string
  await handleVerify(verifytoken)
})

async function handleVerify(verifytoken: string) {
  if (!verifytoken)
    return
  const secretKey = verifytoken.trim()
  try {
    loginLoading.value = true
    await fetchVerify(secretKey)
    ms.success('Verify success')
    router.replace('/')
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
  }
  finally {
    registerLoading.value = false
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
    loginLoading.value = true
    const result = await fetchLogin(name, pwd)
    authStore.setToken(result.data.token)
    ms.success('success')
    router.go(0)
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    password.value = ''
  }
  finally {
    loginLoading.value = false
  }
}
async function handleRegister() {
  const name = username.value.trim()
  const pwd = password.value.trim()
  if (!name || !pwd) {
    ms.warning('Введите почту и пароль для начала регистрации') // Change this message to match the style of other messages on the page.
    return
  }
  try {
    registerLoading.value = true
    const result = await fetchRegister(name, pwd)
    ms.success(result.message as string)
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
  }
  finally {
    registerLoading.value = false
  }
}

// pick and typ one random sentence:
const sentences = SentencesList

const currentSentenceIndex = ref(0)
const currentSentence = ref('')

function getNextSentenceIndex(): number {
  const index = Math.floor(Math.random() * sentences.length)
  return index === currentSentenceIndex.value
    ? getNextSentenceIndex()
    : index
}

function getNextSentence(): string {
  const index = getNextSentenceIndex()
  currentSentenceIndex.value = index
  return sentences[index]
}

function typeWriter(sentence: string, index: number, speed: number) {
  if (index === 0)
    currentSentence.value = ''

  if (index < sentence.length) {
    currentSentence.value += sentence.charAt(index)
    setTimeout(() => {
      typeWriter(sentence, index + 1, speed)
    }, speed)
  }
  else {
    setTimeout(() => {
      setTimeout(() => {
        currentSentence.value = ''
        currentSentence.value = getNextSentence()
        typeWriter(currentSentence.value, 0, 30)
      }, 3000)
    }, 0)
  }
}

onMounted(() => {
  currentSentence.value = getNextSentence()
  typeWriter(currentSentence.value, 0, 30)
})
</script>

<template>
  <NModal :show="visible" style="width: 90%; max-width: 640px;">
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
            :disabled="registerDisabled"
            :loading="registerLoading"
            @click.prevent="handleRegister"
          >
            {{ $t('common.register') }}
          </NButton>
          <NButton
            block
            type="primary"
            :disabled="loginDisabled"
            :loading="loginLoading"
            @click.prevent="handleLogin"
          >
            {{ $t('common.login') }}
          </NButton>
        </NSpace>

        <NButton
          v-if="!(authStore.session && authStore.session.allowRegister)"
          block
          type="primary"
          :disabled="loginDisabled"
          :loading="loginLoading"
          @click="handleLogin"
        >
          {{ $t('common.login') }}
        </NButton>
        <p class="text-base text-center text-slate-500">
          Вы сможете свободно использовать нейросетевого чат-бота нового поколения после прохождения короткой регистрации
        </p>
        <p class="text-base text-center text-slate-500">
          <small>{{ currentSentence }}</small>
        </p>
      <!--
        <p class="text-base text-center text-slate-500" @click="refreshPage">
          <small>Пример: {{ randomSentence }}</small>
        </p>
      -->
      </div>
    </div>
  </NModal>
</template>
