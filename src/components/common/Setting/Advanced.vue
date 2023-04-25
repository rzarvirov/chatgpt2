<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { NButton, NInput, NSlider, useMessage } from 'naive-ui'
import { useSettingStore } from '@/store'
import type { SettingsState } from '@/store/modules/settings/helper'
import { t } from '@/locales'
import { useAuthStoreWithout } from '@/store/modules/auth'
import { fetchGetUserAccountType } from '@/api'

const authStore = useAuthStoreWithout()
const accountType = ref('')

const settingStore = useSettingStore()

const ms = useMessage()

const systemMessage = ref(settingStore.systemMessage ?? '')

const temperature = ref(settingStore.temperature ?? 0.8)
const top_p = ref(settingStore.top_p ?? 1)

function updateSettings(options: Partial<SettingsState>) {
  settingStore.updateSetting(options)
  ms.success(t('common.success'))
}

function handleReset() {
  settingStore.resetSetting()
  ms.success(t('common.success'))
  window.location.reload()
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

onMounted(async () => {
  if (authStore.session == null || !authStore.session.auth || authStore.token)
    await fetchAccountType()
})
</script>

<template>
  <div class="p-4 space-y-5 min-h-[200px]">
    <div class="space-y-6">
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.role') }}</span>
        <div class="flex-1">
          <NInput v-model:value="systemMessage" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" :disabled="accountType === 'free'" />
        </div>
        <NButton size="tiny" text type="primary" :disabled="accountType === 'free'" @click="updateSettings({ systemMessage })">
          {{ $t('common.save') }}
        </NButton>
      </div>
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.temperature') }} </span>
        <div class="flex-1">
          <NSlider v-model:value="temperature" :max="2" :min="0" :step="0.1" :disabled="accountType === 'free'" />
        </div>
        <span>{{ temperature }}</span>
        <NButton size="tiny" text type="primary" :disabled="accountType === 'free'" @click="updateSettings({ temperature })">
          {{ $t('common.save') }}
        </NButton>
      </div>
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.top_p') }} </span>
        <div class="flex-1">
          <NSlider v-model:value="top_p" :max="1" :min="0" :step="0.1" :disabled="accountType === 'free'" />
        </div>
        <span>{{ top_p }}</span>
        <NButton size="tiny" text type="primary" :disabled="accountType === 'free'" @click="updateSettings({ top_p })">
          {{ $t('common.save') }}
        </NButton>
      </div>
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">&nbsp;</span>
        <NButton size="small" :disabled="accountType === 'free'" @click="handleReset">
          {{ $t('common.reset') }}
        </NButton>
      </div>
    </div>
    <div v-if="accountType === 'free'" class="text-right">
      <a href="https://boosty.to/aibuddy" target="_blank" class="text-blue-500 underline">
        Подпишитесь, чтобы иметь доступ к тонким настройкам ассистента
      </a>
    </div>
  </div>
</template>
