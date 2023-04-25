<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NModal, NTabPane, NTabs } from 'naive-ui'
import General from './General.vue'
import Advanced from './Advanced.vue'
import About from './About.vue'
import Site from './Site.vue'
import Mail from './Mail.vue'
import { SvgIcon } from '@/components/common'
import { useAuthStore, useUserStore } from '@/store'
import { fetchGetUserAccountType } from '@/api'

const props = defineProps<Props>()
const emit = defineEmits<Emit>()
const accountType = ref('')
const userStore = useUserStore()
const authStore = useAuthStore()

const isChatGPTAPI = computed<boolean>(() => !!authStore.isChatGPTAPI)

interface Props {
  visible: boolean
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
}

const active = ref('General')

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
</script>

<template>
  <NModal v-model:show="show" :auto-focus="false" preset="card" style="width: 95%; max-width: 640px">
    <template #header>
      <div>
        Тип аккаунта:
        <a href="https://boosty.to/aibuddy/about" target="_blank" class="inline-flex items-center justify-center ml-1 px-2 py-0 text-white rounded no-underline" :class="accountType !== 'free' ? 'bg-yellow-500' : 'bg-blue-500'">
          {{ accountType }}
        </a>
      </div>
    </template>

    <div>
      <NTabs v-model:value="active" type="line" animated>
        <NTabPane name="General" tab="General">
          <template #tab>
            <SvgIcon class="text-lg" icon="ri:file-user-line" />
            <span class="ml-2">{{ $t('setting.general') }}</span>
          </template>
          <div class="min-h-[100px]">
            <General />
          </div>
        </NTabPane>
        <NTabPane v-if="isChatGPTAPI" name="Advanced" tab="Advanced">
          <template #tab>
            <SvgIcon class="text-lg" icon="ri:equalizer-line" />
            <span class="ml-2">{{ $t('setting.advanced') }}</span>
          </template>
          <div class="min-h-[100px]">
            <Advanced />
          </div>
        </NTabPane>
        <NTabPane v-if="userStore.userInfo.root" name="Config" tab="Config">
          <template #tab>
            <SvgIcon class="text-lg" icon="ri:list-settings-line" />
            <span class="ml-2">{{ $t('setting.config') }}</span>
          </template>
          <About />
        </NTabPane>
        <NTabPane v-if="userStore.userInfo.root" name="SiteConfig" tab="SiteConfig">
          <template #tab>
            <SvgIcon class="text-lg" icon="ri:settings-line" />
            <span class="ml-2">{{ $t('setting.siteConfig') }}</span>
          </template>
          <Site />
        </NTabPane>
        <NTabPane v-if="userStore.userInfo.root" name="MailConfig" tab="MailConfig">
          <template #tab>
            <SvgIcon class="text-lg" icon="ri:mail-line" />
            <span class="ml-2">{{ $t('setting.mailConfig') }}</span>
          </template>
          <Mail />
        </NTabPane>
      </NTabs>
    </div>
  </NModal>
</template>
