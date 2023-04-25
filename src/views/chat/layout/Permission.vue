<!-- eslint-disable no-console -->
<script setup lang='ts'>
// Add this line before "import { fetchGoogleLogin, fetchLogin, fetchRegister, fetchVerify } from '@/api'"
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSpace, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { fetchGoogleLogin, fetchLogin, fetchRegister, fetchVerify } from '@/api'
import { useAuthStore } from '@/store'
import SentencesList from '@/assets/sentences.json'

const props = defineProps<Props>()

interface Props {
  visible: boolean
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const ms = useMessage()

const visible = ref(props.visible) // Change this line
const username = ref('')
const password = ref('')
const showLoginForm = ref(false)
const showRegisterForm = ref(false)
const registerLoading = ref(false)
const loginLoading = ref(false)

// ...
const loginDisabled = computed(() => !username.value.trim() || !password.value.trim() || loginLoading.value)
const registerDisabled = computed(() => registerLoading.value)
// ...

watch(
  () => props.visible,
  (newValue) => {
    visible.value = newValue
  },
)

function showLogin() {
  showLoginForm.value = true
  showRegisterForm.value = false
}

function showRegister() {
  showLoginForm.value = false
  showRegisterForm.value = true
}

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
    authStore.removeToken()
  }
  finally {
    registerLoading.value = false
  }
}

function handlePress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (showLoginForm.value)
      handleLogin()

    else if (showRegisterForm.value)
      handleRegister()
  }
}

async function handleLogin() {
  const name = username.value.trim()
  const pwd = password.value.trim()
  if (!name || !pwd)
    return

  let loginSuccessful = false

  try {
    loginLoading.value = true
    const result = await fetchLogin(name, pwd)
    await authStore.setToken(result.data.token)
    ms.success('success')
    visible.value = false
    router.go(0)
    loginSuccessful = true
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
    password.value = ''
    // Remove the line that sets loginLoading.value to false
  }
  finally {
    // Set loginLoading.value to false only if the login was successful
    if (loginSuccessful) {
      loginLoading.value = false
      visible.value = false
    }
  }
}

function isValidPassword(pwd: string) {
  // Require at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]{8,}$/
  return regex.test(pwd)
}

function isValidEmail(email: string) {
  // Check if the email is in a valid format
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

async function handleRegister() {
  const name = username.value.trim()
  const pwd = password.value.trim()
  if (!name || !pwd) {
    ms.warning('Введите почту и пароль для начала регистрации')
    return
  }
  if (!isValidEmail(name)) {
    ms.warning('Введите действительный адрес электронной почты')
    return
  }
  if (!isValidPassword(pwd)) {
    ms.warning('Пароль должен содержать не менее 8 символов, включая заглавную букву, строчную букву, цифру и специальный символ (любой из @$!%*?&)')
    return
  }
  try {
    registerLoading.value = true
    const result = await fetchRegister(name, pwd)
    ms.success(result.message as string)
    showRegisterForm.value = false // Hide the registration form
    showLogin() // Show the login form after successful registration
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

// Google Auth
const loading = ref(false)
const token = ref('')

async function googleAuthCallback(response: any) {
  const credential = response?.credential
  if (!credential)
    return
  try {
    loading.value = true
    const result = await fetchGoogleLogin(credential) // Get the result from the server
    await authStore.setToken(result.data.token) // Set the JWT token from the server
    ms.success('success')
    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
    token.value = ''
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <NModal :show="visible" style="width: 95%; max-width: 640px;">
    <div class="p-10 bg-white rounded dark:bg-slate-800">
      <div v-if="!showLoginForm && !showRegisterForm" class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            Добро пожаловать
          </h2>
          <p class="text-base text-center text-slate-500 dark:text-slate-500">
            Зарегистрируйтесь и получите доступ* к удивительным возможностям ChatGPT (*бесплатно, ограничение по количеству запросов в день).
          </p>
          <p class="text-base text-center">
            <u><a href="http://about.aibuddy.ru/">Узнать подробности</a></u>
          </p>
          <p
            class="text-base text-center text-slate-500"
            style="line-height: 1.5; height: calc(1.5em * 3); overflow: hidden;"
          >
            <small>{{ currentSentence }}</small>
          </p>
        </header>
        <div class="flex flex-col items-center justify-center space-y-4">
          <div>
            <GoogleLogin :callback="googleAuthCallback" />
          </div>
          <div />
          <div>или создайте аккаунт / войдите</div>
          <div class="flex flex-row items-center justify-center space-x-4">
            <NButton type="primary" class="px-4 py-2" @click="showRegister">
              Регистрация
            </NButton>
            <NButton type="info" class="px-4 py-2" @click="showLogin">
              Вход
            </NButton>
          </div>
        </div>
      </div>
      <div v-if="showLoginForm || showRegisterForm" class="space-y-4">
        <header class="space-y-2">
          <h2 class="text-2xl font-bold text-center text-slate-800 dark:text-neutral-200">
            {{ showLoginForm ? 'Авторизация' : 'Регистрация' }}
          </h2>
        </header>
        <NInput v-model:value="username" type="text" placeholder="Email" />
        <NInput v-model:value="password" type="password" placeholder="Password" @keypress="handlePress" />
        <NSpace v-if="showLoginForm" justify="space-around">
          <NButton
            block
            type="primary"
            :disabled="loginDisabled"
            :loading="loginLoading"
            @click.prevent="handleLogin"
          >
            Вход
          </NButton>
        </NSpace>
        <NSpace v-if="showRegisterForm" justify="space-around">
          <NButton
            block
            type="primary"
            :disabled="registerDisabled"
            :loading="registerLoading"
            @click.prevent="handleRegister"
          >
            Регистрация
          </NButton>
        </NSpace>
        <p class="text-sm text-center text-slate-500 mt-3">
          Мы не собираем персональные данные, сообщения отправляются на сервер OpenAI в зашифрованном виде. Регистрация нужна для ограничения количества запросов в день.
        </p>
      </div>
    </div>
  </NModal>
</template>
