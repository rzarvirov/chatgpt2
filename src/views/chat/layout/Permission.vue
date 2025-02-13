<!-- eslint-disable no-console -->
<script setup lang='ts'>
// Add this line before "import { fetchGoogleLogin, fetchLogin, fetchRegister, fetchVerify } from '@/api'"
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NInput, NModal, NSpace, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { fetchGoogleLogin, fetchLogin, fetchRegister, fetchVerify, fetchYandexLogin } from '@/api'
import { useAuthStore } from '@/store'
import SentencesList from '@/assets/sentences.json'
import { createRandomString } from '@/utils/functions'

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
    ms.success('Авторизация пройдена')
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

async function yandexAuth() {
  const redirectUri = encodeURIComponent(`${window.location.origin}`)
  const clientId = 'd83af6e2fe524b329046b7725b740b64'
  const authUrl = `https://oauth.yandex.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`
  window.location.href = authUrl
}

async function yandexAuthCallback(code: string) {
  try {
    loading.value = true
    const result = await fetchYandexLogin(code) // Get the result from the server
    await authStore.setToken(result.data.token) // Set the JWT token from the server
    ms.success('Авторизация пройдена')

    // Remove the code parameter from the URL
    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState(null, '', cleanUrl)

    window.location.reload()
  }
  catch (error: any) {
    ms.error(error.message ?? 'error')
    authStore.removeToken()
    token.value = ''

    // Remove the code parameter from the URL
    const cleanUrl = window.location.origin + window.location.pathname
    window.history.replaceState(null, '', cleanUrl)
  }
  finally {
    loading.value = false
  }
}

function createState() {
  const state = createRandomString(32)
  sessionStorage.setItem('mailru_auth_state', state)
  return state
}

async function mailruAuth() {
  const redirectUri2 = encodeURIComponent(`${window.location.origin}`)
  const clientId2 = 'f23c1393c22e46fe9e821e2d91fdbb59'
  const state = createState()
  const authUrl = `https://oauth.mail.ru/login?response_type=code&client_id=${clientId2}&redirect_uri=${redirectUri2}&state=${state}`
  window.location.href = authUrl
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const yandexCode = urlParams.get('code')
  if (yandexCode)
    yandexAuthCallback(yandexCode)
})
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
            Зарегистрируйтесь и получите доступ к удивительным возможностям ChatGPT.
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
          <div>
            <button class="yandex-login-button" @click="yandexAuth">
              <svg width="188" height="36" viewBox="0 0 188 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 18C0 12.4087 0 9.61305 0.913446 7.4078C2.13137 4.46746 4.46746 2.13137 7.4078 0.913446C9.61305 0 12.4087 0 18 0H170C175.591 0 178.387 0 180.592 0.913446C183.533 2.13137 185.869 4.46746 187.087 7.4078C188 9.61305 188 12.4087 188 18C188 23.5913 188 26.3869 187.087 28.5922C185.869 31.5325 183.533 33.8686 180.592 35.0866C178.387 36 175.591 36 170 36H18C12.4087 36 9.61305 36 7.4078 35.0866C4.46746 33.8686 2.13137 31.5325 0.913446 28.5922C0 26.3869 0 23.5913 0 18Z" fill="black" />
                <rect x="21.5" y="9" width="18" height="18" rx="9" fill="#FC3F1D" />
                <path d="M31.7685 23.409H33.6488V12.609H30.9138C28.1633 12.609 26.7181 14.0231 26.7181 16.1054C26.7181 17.7681 27.5106 18.7471 28.9247 19.7572L26.4695 23.409H28.5052L31.2401 19.3221L30.2922 18.685C29.1423 17.908 28.5829 17.302 28.5829 15.9966C28.5829 14.8467 29.3909 14.0697 30.9293 14.0697H31.7685V23.409Z" fill="white" />
                <path d="M48.7214 12.962H52.1374C53.3321 12.962 54.2421 13.1487 54.8674 13.522C55.4928 13.8953 55.8054 14.5253 55.8054 15.412C55.8054 15.776 55.7541 16.0933 55.6514 16.364C55.5488 16.6253 55.3994 16.854 55.2034 17.05C55.0168 17.2367 54.7881 17.3907 54.5174 17.512C54.2468 17.6333 53.9481 17.7267 53.6214 17.792C54.4614 17.8947 55.0961 18.1233 55.5254 18.478C55.9548 18.8327 56.1694 19.374 56.1694 20.102C56.1694 20.6247 56.0668 21.0727 55.8614 21.446C55.6561 21.81 55.3714 22.1087 55.0074 22.342C54.6434 22.566 54.2141 22.734 53.7194 22.846C53.2248 22.9487 52.6881 23 52.1094 23H48.7214V12.962ZM50.4154 14.432V17.106H52.2214C52.7814 17.106 53.2341 16.9893 53.5794 16.756C53.9248 16.5133 54.0974 16.1353 54.0974 15.622C54.0974 15.1553 53.9388 14.8427 53.6214 14.684C53.3134 14.516 52.8748 14.432 52.3054 14.432H50.4154ZM50.4154 18.562V21.544H52.2774C52.5948 21.544 52.8841 21.5207 53.1454 21.474C53.4068 21.418 53.6308 21.334 53.8174 21.222C54.0041 21.1007 54.1488 20.9467 54.2514 20.76C54.3541 20.564 54.4054 20.326 54.4054 20.046C54.4054 19.4953 54.2234 19.1127 53.8594 18.898C53.5048 18.674 52.9308 18.562 52.1374 18.562H50.4154Z" fill="white" />
                <path d="M60.8636 23.14C60.3503 23.14 59.8743 23.056 59.4356 22.888C58.9969 22.72 58.6143 22.4773 58.2876 22.16C57.9703 21.8333 57.7183 21.4367 57.5316 20.97C57.3543 20.5033 57.2656 19.9667 57.2656 19.36C57.2656 18.7533 57.3543 18.2167 57.5316 17.75C57.7183 17.2833 57.9703 16.8913 58.2876 16.574C58.6143 16.2473 58.9969 16.0047 59.4356 15.846C59.8743 15.678 60.3503 15.594 60.8636 15.594C61.3769 15.594 61.8529 15.678 62.2916 15.846C62.7303 16.0047 63.1129 16.2473 63.4396 16.574C63.7663 16.8913 64.0229 17.2833 64.2096 17.75C64.3963 18.2167 64.4896 18.7533 64.4896 19.36C64.4896 19.9667 64.3963 20.5033 64.2096 20.97C64.0229 21.4367 63.7663 21.8333 63.4396 22.16C63.1129 22.4773 62.7303 22.72 62.2916 22.888C61.8529 23.056 61.3769 23.14 60.8636 23.14ZM60.8636 21.782C61.4236 21.782 61.8856 21.586 62.2496 21.194C62.6229 20.802 62.8096 20.1907 62.8096 19.36C62.8096 18.5387 62.6229 17.932 62.2496 17.54C61.8856 17.1387 61.4236 16.938 60.8636 16.938C60.3129 16.938 59.8509 17.1387 59.4776 17.54C59.1136 17.932 58.9316 18.5387 58.9316 19.36C58.9316 20.1907 59.1136 20.802 59.4776 21.194C59.8509 21.586 60.3129 21.782 60.8636 21.782Z" fill="white" />
                <path d="M69.1244 14.866C68.7324 14.866 68.3917 14.8147 68.1024 14.712C67.8224 14.6093 67.5844 14.4693 67.3884 14.292C67.2017 14.1053 67.0617 13.8907 66.9684 13.648C66.875 13.396 66.8284 13.13 66.8284 12.85H68.2564C68.2564 13.1767 68.331 13.4147 68.4804 13.564C68.639 13.704 68.8537 13.774 69.1244 13.774C69.395 13.774 69.605 13.704 69.7544 13.564C69.9037 13.4147 69.9784 13.1767 69.9784 12.85H71.4204C71.4204 13.13 71.3737 13.396 71.2804 13.648C71.187 13.8907 71.0424 14.1053 70.8464 14.292C70.6597 14.4693 70.4217 14.6093 70.1324 14.712C69.843 14.8147 69.507 14.866 69.1244 14.866ZM67.4584 20.802L70.8184 15.734H72.4144V23H70.8044V17.96L67.4724 23H65.8484V15.734H67.4584V20.802Z" fill="white" />
                <path d="M77.4909 17.05V23H75.8669V17.05H73.6689V15.734H79.7309V17.05H77.4909Z" fill="white" />
                <path d="M82.5795 20.802L85.9395 15.734H87.5355V23H85.9255V17.96L82.5935 23H80.9695V15.734H82.5795V20.802Z" fill="white" />
                <path d="M95.7862 23.14C95.1982 23.14 94.6708 23.056 94.2042 22.888C93.7375 22.7107 93.3408 22.4633 93.0142 22.146C92.6875 21.8193 92.4355 21.4227 92.2582 20.956C92.0808 20.4893 91.9922 19.9573 91.9922 19.36C91.9922 18.772 92.0808 18.2447 92.2582 17.778C92.4355 17.3113 92.6875 16.9193 93.0142 16.602C93.3408 16.2753 93.7422 16.028 94.2182 15.86C94.6942 15.6827 95.2262 15.594 95.8142 15.594C96.3182 15.594 96.7568 15.65 97.1302 15.762C97.5128 15.874 97.8162 16.014 98.0402 16.182V17.526C97.7508 17.3393 97.4335 17.1947 97.0882 17.092C96.7522 16.9893 96.3602 16.938 95.9122 16.938C94.4095 16.938 93.6582 17.7453 93.6582 19.36C93.6582 20.9747 94.3955 21.782 95.8702 21.782C96.3462 21.782 96.7522 21.7307 97.0882 21.628C97.4335 21.516 97.7508 21.376 98.0402 21.208V22.552C97.7975 22.7107 97.4942 22.8507 97.1302 22.972C96.7662 23.084 96.3182 23.14 95.7862 23.14Z" fill="white" />
                <path d="M102.71 16.112C102.71 15.58 102.803 15.118 102.99 14.726C103.177 14.3247 103.438 13.998 103.774 13.746C104.11 13.4847 104.511 13.2887 104.978 13.158C105.454 13.0273 105.981 12.962 106.56 12.962H109.822V23H108.114V19.136H106.56L103.998 23H102.024L104.852 18.884C104.124 18.7067 103.583 18.3847 103.228 17.918C102.883 17.442 102.71 16.84 102.71 16.112ZM108.114 17.722V14.432H106.546C105.911 14.432 105.403 14.558 105.02 14.81C104.647 15.0527 104.46 15.4727 104.46 16.07C104.46 16.658 104.628 17.0827 104.964 17.344C105.3 17.596 105.776 17.722 106.392 17.722H108.114Z" fill="white" />
                <path d="M116.49 19.934H113.424V23H111.8V15.734H113.424V18.618H116.49V15.734H118.114V23H116.49V19.934Z" fill="white" />
                <path d="M119.738 21.684C119.953 21.4973 120.121 21.2407 120.242 20.914C120.373 20.5873 120.476 20.1813 120.55 19.696C120.625 19.2013 120.681 18.6273 120.718 17.974C120.756 17.3207 120.788 16.574 120.816 15.734H126.136V21.684H127.228V25.072H125.814L125.688 23H120.676L120.55 25.072H119.122V21.684H119.738ZM124.512 21.684V17.05H122.216C122.17 18.198 122.09 19.15 121.978 19.906C121.876 20.6527 121.703 21.2453 121.46 21.684H124.512Z" fill="white" />
                <path d="M134.364 22.468C134.261 22.5333 134.135 22.608 133.986 22.692C133.836 22.7667 133.659 22.8367 133.454 22.902C133.248 22.9673 133.01 23.0233 132.74 23.07C132.469 23.1167 132.161 23.14 131.816 23.14C130.481 23.14 129.482 22.8087 128.82 22.146C128.166 21.4833 127.84 20.5547 127.84 19.36C127.84 18.772 127.928 18.2447 128.106 17.778C128.283 17.3113 128.53 16.9193 128.848 16.602C129.165 16.2753 129.543 16.028 129.982 15.86C130.42 15.6827 130.901 15.594 131.424 15.594C131.965 15.594 132.45 15.6827 132.88 15.86C133.318 16.0373 133.678 16.3033 133.958 16.658C134.238 17.0127 134.429 17.4513 134.532 17.974C134.644 18.4967 134.648 19.108 134.546 19.808H129.52C129.585 20.4707 129.804 20.97 130.178 21.306C130.551 21.6327 131.134 21.796 131.928 21.796C132.506 21.796 132.987 21.726 133.37 21.586C133.762 21.4367 134.093 21.2827 134.364 21.124V22.468ZM131.424 16.882C130.948 16.882 130.546 17.0267 130.22 17.316C129.893 17.6053 129.678 18.0347 129.576 18.604H132.992C133.01 18.016 132.88 17.582 132.6 17.302C132.32 17.022 131.928 16.882 131.424 16.882Z" fill="white" />
                <path d="M138.307 20.046H137.677V23H136.053V15.734H137.677V18.73H138.363L140.673 15.734H142.381L139.637 19.234L142.493 23H140.575L138.307 20.046Z" fill="white" />
                <path d="M146.577 23.14C145.989 23.14 145.462 23.056 144.995 22.888C144.529 22.7107 144.132 22.4633 143.805 22.146C143.479 21.8193 143.226 21.4227 143.049 20.956C142.872 20.4893 142.783 19.9573 142.783 19.36C142.783 18.772 142.872 18.2447 143.049 17.778C143.226 17.3113 143.479 16.9193 143.805 16.602C144.132 16.2753 144.533 16.028 145.009 15.86C145.485 15.6827 146.017 15.594 146.605 15.594C147.109 15.594 147.548 15.65 147.921 15.762C148.304 15.874 148.607 16.014 148.831 16.182V17.526C148.542 17.3393 148.225 17.1947 147.879 17.092C147.543 16.9893 147.151 16.938 146.703 16.938C145.201 16.938 144.449 17.7453 144.449 19.36C144.449 20.9747 145.186 21.782 146.661 21.782C147.137 21.782 147.543 21.7307 147.879 21.628C148.225 21.516 148.542 21.376 148.831 21.208V22.552C148.589 22.7107 148.285 22.8507 147.921 22.972C147.557 23.084 147.109 23.14 146.577 23.14Z" fill="white" />
                <path d="M155.265 12.962V23H153.571V12.962H155.265Z" fill="white" />
                <path d="M157.413 12.962H160.801C161.51 12.962 162.168 13.0413 162.775 13.2C163.391 13.3587 163.923 13.62 164.371 13.984C164.828 14.348 165.183 14.8287 165.435 15.426C165.696 16.0233 165.827 16.7607 165.827 17.638C165.827 18.5247 165.696 19.304 165.435 19.976C165.183 20.6387 164.824 21.194 164.357 21.642C163.9 22.09 163.354 22.4307 162.719 22.664C162.094 22.888 161.408 23 160.661 23H157.413V12.962ZM159.107 14.432V21.544H160.717C161.212 21.544 161.66 21.4693 162.061 21.32C162.472 21.1707 162.822 20.942 163.111 20.634C163.41 20.326 163.638 19.934 163.797 19.458C163.965 18.9727 164.049 18.3987 164.049 17.736C164.049 17.0827 163.97 16.546 163.811 16.126C163.652 15.6967 163.428 15.356 163.139 15.104C162.859 14.852 162.523 14.6793 162.131 14.586C161.739 14.4833 161.314 14.432 160.857 14.432H159.107Z" fill="white" />
              </svg>
            </button>
          </div>
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
