<script setup lang='ts'>
import type { DataTableColumns } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { NDataTable, NInput, NMessageProvider, NModal } from 'naive-ui'
import { usePromptStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'

interface DataProps {
  renderKey: string
  renderValue: string
  key: string
  value: string
}

interface Props {
  visible: boolean
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
}

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

const show = computed({
  get: () => props.visible,
  set: (visible: boolean) => emit('update:visible', visible),
})

const searchValue = ref<string>('')

// 移动端自适应相关
const { isMobile } = useBasicLayout()

const promptStore = usePromptStore()

// Prompt在线导入推荐List,根据部署者喜好进行修改(assets/recommend.json)
const promptList = ref<any>(promptStore.promptList)

// 移动端自适应相关
const renderTemplate = () => {
  const [keyLimit, valueLimit] = isMobile.value ? [20, 200] : [50, 400]

  return promptList.value.map((item: { key: string; value: string }) => {
    return {
      renderKey: item.key.length <= keyLimit ? item.key : `${item.key.substring(0, keyLimit)}...`,
      renderValue: item.value.length <= valueLimit ? item.value : `${item.value.substring(0, valueLimit)}...`,
      key: item.key,
      value: item.value,
    }
  })
}

const pagination = computed(() => {
  const [pageSize, pageSlot] = isMobile.value ? [6, 5] : [7, 15]
  return {
    pageSize, pageSlot,
  }
})

// table相关
const createColumns = (): DataTableColumns<DataProps> => {
  return [
    {
      title: t('store.title'),
      key: 'renderKey',
      width: '30%',
    },
    {
      title: t('store.description'),
      key: 'renderValue',
      width: '70%',
    },
  ]
}

const columns = createColumns()

watch(
  () => promptList,
  () => {
    promptStore.updatePromptList(promptList.value)
  },
  { deep: true },
)

const dataSource = computed(() => {
  const data = renderTemplate()
  const value = searchValue.value
  if (value && value !== '') {
    return data.filter((item: DataProps) => {
      return item.renderKey.includes(value) || item.renderValue.includes(value)
    })
  }
  return data
})

const fetchData = async () => {
  const response = await fetch('/prompts_RU.json')
  const jsonData = await response.json()
  promptList.value = jsonData
}

// Add this lifecycle hook at the end of the <script setup lang='ts'> section
onMounted(async () => {
  await fetchData()
})
</script>

<template>
  <NMessageProvider>
    <NModal v-model:show="show" style="width: 90%; max-width: 900px;" preset="card">
      <p class="mb-4">
        Чтобы использовать скачанные запросы в чате, наберите символ /
      </p>
      <div class="space-y-4">
        <div
          class="flex gap-3"
          :class="[isMobile ? 'flex-col' : 'flex-row justify-between']"
        >
          <div class="flex items-center">
            <NInput v-model:value="searchValue" style="width: 100%" />
          </div>
        </div>
        <br>
        <NDataTable
          :max-height="400"
          :columns="columns"
          :data="dataSource"
          :pagination="pagination"
          :bordered="false"
        />
      </div>
    </NModal>
  </NMessageProvider>
</template>
