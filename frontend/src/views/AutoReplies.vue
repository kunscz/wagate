<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold">Auto Replies</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create Auto Reply</CardTitle>
          <CardDescription>Configure a new automatic reply message.</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="onSubmit" autocomplete="off">
            <div class="space-y-4">
              <div>
                <Label for="keyword" class="text-lg font-medium">Trigger Keyword</Label>
                <Input
                  id="keyword"
                  type="text"
                  v-model="r$.$value.keyword"
                  placeholder="e.g., hello"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.keyword.$errors.length > 0 }"
                  @blur="validateField('keyword')"
                />
                <p
                  v-for="error in r$.$fields.keyword.$errors"
                  :key="error.message"
                  class="text-destructive text-sm mt-1"
                >
                  {{ error.message }}
                </p>
              </div>
              <div>
                <Label for="message" class="text-lg font-medium">Reply Message</Label>
                <Input
                  id="message"
                  type="text"
                  v-model="r$.$value.message"
                  placeholder="e.g., Hi! How can I assist you?"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.message.$errors.length > 0 }"
                  @blur="validateField('message')"
                />
                <p
                  v-for="error in r$.$fields.message.$errors"
                  :key="error.message"
                  class="text-destructive text-sm mt-1"
                >
                  {{ error.message }}
                </p>
              </div>
              <Alert v-if="error" variant="destructive" class="mt-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{{ error }}</AlertDescription>
              </Alert>
              <Button
                type="submit"
                class="w-full"
                :class="{ 'opacity-50 cursor-not-allowed': isInvalid && isAllTouched || isSubmitting }"
                :disabled="isInvalid && isAllTouched || isSubmitting"
              >
                {{ isSubmitting ? 'Saving...' : 'Save Auto Reply' }}
              </Button>
              <p v-if="isInvalid && isAllTouched" class="text-destructive text-sm text-center">
                Please fill out the form correctly.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Saved Auto Replies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="autoReply in autoReplies" :key="autoReply.id">
                <TableCell>{{ autoReply.keyword }}</TableCell>
                <TableCell>{{ autoReply.response }}</TableCell>
                <TableCell>{{ new Date(autoReply.createdAt).toLocaleString() }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import api from '@/utils/api'
import AppLayout from '@/components/AppLayout.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Button from '@/components/ui/button/Button.vue'
import Alert from '@/components/ui/alert/Alert.vue'
import AlertTitle from '@/components/ui/alert/AlertTitle.vue'
import AlertDescription from '@/components/ui/alert/AlertDescription.vue'
import Table from '@/components/ui/table/Table.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import { useRegle } from '@regle/core'
import { required, minLength, withMessage } from '@regle/rules'
import axios from 'axios'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  keyword: '',
  message: '',
})

const autoReplies = ref([])
const isSubmitting = ref(false)
const error = ref(null)

const { r$ } = useRegle(form, {
  keyword: {
    required: withMessage(required, 'Missing trigger keyword'),
    minLength: withMessage(minLength(2), 'Keyword must be at least 2 characters'),
  },
  message: {
    required: withMessage(required, 'Missing reply message'),
    minLength: withMessage(minLength(5), 'Message must be at least 5 characters'),
  },
})

const isInvalid = computed(() => !r$.$fields.keyword.$valid || !r$.$fields.message.$valid)
const isAllTouched = computed(() => r$.$fields.keyword.$touched && r$.$fields.message.$touched)

const validateField = async (field) => {
  r$.$fields[field].$touch()
  await nextTick()
}

const validateForm = async () => {
  r$.$fields.keyword.$touch()
  r$.$fields.message.$touch()
  await nextTick()
  return r$.$fields.keyword.$errors.length === 0 && r$.$fields.message.$errors.length === 0
}

const fetchAutoReplies = async () => {
  try {
    const response = await api.get('/auto-replies')
    autoReplies.value = response.data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch auto replies'
  }
}

const onSubmit = async () => {
	error.value = null
	const valid = await validateForm()
	if (!valid) return

	isSubmitting.value = true
	try {
		const apiUrl = import.meta.env.VITE_API_URL
		console.log('API URL:', apiUrl, 'Token:', authStore.token)
		const response = await axios.post(`${apiUrl}/auto-replies`, {
			keyword: r$.$value.keyword,
			response: r$.$value.message,
		}, {
			headers: { Authorization: `Bearer ${authStore.token}` },
		})
		console.log('Auto reply saved:', response.data)
		alert('Auto reply saved successfully!')
		form.value.keyword = ''
		form.value.message = ''
		r$.$reset()
		await fetchAutoReplies() // Refresh auto replies list
	} catch (err) {
		error.value = err.response?.data?.error || 'Failed to save auto reply'
	} finally {
		isSubmitting.value = false
	}
}

onMounted(() => {
  if (!authStore.token) {
    router.push('/login')
    return
  }
  fetchAutoReplies()
})
</script>

<style>
/* No specific styles needed, inheriting from message.vue */
</style>