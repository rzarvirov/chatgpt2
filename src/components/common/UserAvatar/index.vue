<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NAvatar } from 'naive-ui'
import { useUserStore } from '@/store'
import defaultAvatar from '@/assets/avatar.png'
import { isString } from '@/utils/is'
import { getUserBalance } from '@/../service/src/storage/mongo' // Import the getUserBalance function, replace the path with the correct path to your mongo.ts file

const userStore = useUserStore()

const userInfo = computed(() => userStore.userInfo)

const userBalance = ref(0) // Declare a ref to store the user's balance

onMounted(async () => {
  if (userInfo.value._id)
    userBalance.value = await getUserBalance(userInfo.value._id) // Fetch the user's balance and store it in the userBalance ref
})
</script>

<template>
  <div class="flex items-center overflow-hidden">
    <div class="w-10 h-10 overflow-hidden rounded-full shrink-0">
      <template v-if="isString(userInfo.avatar) && userInfo.avatar.length > 0">
        <NAvatar
          size="large"
          round
          :src="userInfo.avatar"
          :fallback-src="defaultAvatar"
        />
      </template>
      <template v-else>
        <NAvatar size="large" round :src="defaultAvatar" />
      </template>
    </div>
    <div class="flex-1 min-w-0 ml-2">
      <h2 v-if="userInfo.name" class="overflow-hidden font-bold text-md text-ellipsis whitespace-nowrap">
        {{ userInfo.name }}
      </h2>
      <h2 v-else class="overflow-hidden font-bold text-md text-ellipsis whitespace-nowrap">
        {{ $t('common.notLoggedIn') }}
      </h2>
    </div>
  </div>
</template>
