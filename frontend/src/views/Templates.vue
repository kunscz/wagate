<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold">Templates</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create Template</CardTitle>
          <CardDescription>Create or edit a message template.</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="onSubmit" autocomplete="off">
            <div class="space-y-4">
              <div>
                <Label for="name" class="text-lg font-medium">Template Name</Label>
                <Input
                  id="name"
                  type="text"
                  v-model="r$.$value.name"
                  placeholder="e.g., Welcome Message"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.name.$errors.length > 0 }"
                  @blur="validateField('name')"
                />
                <p
                  v-for="error in r$.$fields.name.$errors"
                  :key="error.message"
                  class="text-destructive text-sm mt-1"
                >
                  {{ error.message }}
                </p>
              </div>
              <div>
                <Label for="content" class="text-lg font-medium">Template Content</Label>
                <Input
                  id="content"
                  type="text"
                  v-model="r$.$value.content"
                  placeholder="e.g., Hello {name}, welcome!"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.content.$errors.length > 0 }"
                  @blur="validateField('content')"
                />
                <p
                  v-for="error in r$.$fields.content.$errors"
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
                {{ isSubmitting ? 'Saving...' : 'Save Template' }}
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
          <CardTitle>Saved Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="template in templates" :key="template.id">
                <TableCell>{{ template.name }}</TableCell>
                <TableCell>{{ template.content }}</TableCell>
                <TableCell>{{ new Date(template.createdAt).toLocaleString() }}</TableCell>
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
  name: '',
  content: '',
})

const templates = ref([])
const isSubmitting = ref(false)
const error = ref(null)

const { r$ } = useRegle(form, {
  name: {
    required: withMessage(required, 'Missing template name'),
    minLength: withMessage(minLength(3), 'Name must be at least 3 characters'),
  },
  content: {
    required: withMessage(required, 'Missing template content'),
    minLength: withMessage(minLength(10), 'Content must be at least 10 characters'),
  },
})

const isInvalid = computed(() => !r$.$fields.name.$valid || !r$.$fields.content.$valid)
const isAllTouched = computed(() => r$.$fields.name.$touched && r$.$fields.content.$touched)

const validateField = async (field) => {
  r$.$fields[field].$touch()
  await nextTick()
}

const validateForm = async () => {
  r$.$fields.name.$touch()
  r$.$fields.content.$touch()
  await nextTick()
  return r$.$fields.name.$errors.length === 0 && r$.$fields.content.$errors.length === 0
}

const fetchTemplates = async () => {
  try {
    const response = await api.get('/templates')
    templates.value = response.data
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch templates'
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
    const response = await axios.post(`${apiUrl}/templates`, {
      name: r$.$value.name,
      content: r$.$value.content,
    }, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    console.log('Template saved:', response.data)
    alert('Template saved successfully!')
    form.value.name = ''
    form.value.content = ''
    r$.$reset()
    await fetchTemplates() // Refresh templates list
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to save template'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  if (!authStore.token) {
    router.push('/login')
    return
  }
  fetchTemplates()
})
</script>

<style>
/* No specific styles needed, inheriting from message.vue */
</style>