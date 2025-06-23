<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold">Messages</h1>
      <Card>
        <CardHeader>
          <CardTitle>Send Message</CardTitle>
          <CardDescription>Send a WhatsApp message to a recipient.</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="onSubmit" autocomplete="off">
            <div class="space-y-4">
              <div>
                <Label for="recipient" class="text-lg font-medium">Recipient Phone Number</Label>
                <Input
                  id="recipient"
                  type="text"
                  v-model="form.recipient"
                  placeholder="e.g., +6281234567890"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.recipient.$errors.length }"
                  @blur="validateField('recipient')"
                />
                <p
                  v-for="error in r$.$fields.recipient.$errors"
                  :key="error.message"
                  class="text-destructive text-sm mt-1"
                >
                  {{ error.message }}
                </p>
              </div>
              <div>
                <Label for="content" class="text-lg font-medium">Message Content</Label>
                <Textarea
                  id="content"
                  v-model="form.content"
                  placeholder="Enter your message"
                  class="mt-1"
                  :class="{ 'border-destructive': r$.$fields.content.$errors.length }"
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
              <div>
                <Label for="templateId" class="text-lg font-medium">Template (Optional)</Label>
                <Select v-model="form.templateId" class="mt-1" @blur="validateField('templateId')">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="null">None</SelectItem>
                    <SelectItem v-for="template in templates" :key="template.id" :value="template.id">
                      {{ template.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="qrCode" class="qr-code mt-4">
                <p class="text-lg font-medium">Scan QR Code</p>
                <img :src="qrCode" alt="QR Code" class="mt-2" />
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
                {{ isSubmitting ? 'Sending...' : 'Send Message' }}
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
          <CardTitle>Sent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="message in messages" :key="message.id">
                <TableCell>{{ message.recipient }}</TableCell>
                <TableCell>{{ message.content }}</TableCell>
                <TableCell>{{ message.status }}</TableCell>
                <TableCell>{{ new Date(message.sentAt).toLocaleString() }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import api from '@/utils/api';
import { io } from 'socket.io-client';
import AppLayout from '@/components/AppLayout.vue';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import Input from '@/components/ui/input/Input.vue';
import Textarea from '@/components/ui/textarea/Textarea.vue';
import Select from '@/components/ui/select/Select.vue';
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue';
import SelectValue from '@/components/ui/select/SelectValue.vue';
import SelectContent from '@/components/ui/select/SelectContent.vue';
import SelectItem from '@/components/ui/select/SelectItem.vue';
import Label from '@/components/ui/label/Label.vue';
import Button from '@/components/ui/button/Button.vue';
import Alert from '@/components/ui/alert/Alert.vue';
import AlertTitle from '@/components/ui/alert/AlertTitle.vue';
import AlertDescription from '@/components/ui/alert/AlertDescription.vue';
import Table from '@/components/ui/table/Table.vue';
import TableHeader from '@/components/ui/table/TableHeader.vue';
import TableBody from '@/components/ui/table/TableBody.vue';
import TableRow from '@/components/ui/table/TableRow.vue';
import TableHead from '@/components/ui/table/TableHead.vue';
import TableCell from '@/components/ui/table/TableCell.vue';
import { useRegle } from '@regle/core';
import { required, minLength, withMessage } from '@regle/rules';

// Custom phone number rule
const phoneNumber = (value) => {
  if (!value) return false;
  const phoneRegex = /^\+?\d{8,15}$/;
  return phoneRegex.test(value);
};

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  recipient: '',
  content: '',
  templateId: null,
});

const templates = ref([]);
const messages = ref([]);
const isSubmitting = ref(false);
const error = ref(null);
const qrCode = ref(null); // For QR code display

const { r$ } = useRegle(form, {
  recipient: {
    required: withMessage(required, 'Missing recipient phone number'),
    phoneNumber: withMessage(phoneNumber, 'Enter a valid phone number (e.g., +6281234567890)'),
  },
  content: {
    required: withMessage(required, 'Missing message content'),
    minLength: withMessage(minLength(1), 'Message cannot be empty'),
  },
  templateId: {
    // Optional field, no validation needed
  },
});

const isInvalid = computed(() => !r$.$fields.recipient.$valid || !r$.$fields.content.$valid);
const isAllTouched = computed(() => r$.$fields.recipient.$touched && r$.$fields.content.$touched);

const validateField = async (field) => {
  r$.$fields[field].$touch();
  await nextTick();
};

const validateForm = async () => {
  r$.$fields.recipient.$touch();
  r$.$fields.content.$touch();
  await nextTick();
  return r$.$fields.recipient.$errors.length === 0 && r$.$fields.content.$errors.length === 0;
};

const fetchTemplates = async () => {
  try {
    const response = await api.get('/templates');
    templates.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch templates';
  }
};

const fetchMessages = async () => {
  try {
    const response = await api.get('/messages');
    messages.value = response.data;
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to fetch messages';
  }
};

const socket = io('http://localhost:3000', { transports: ['websocket'] });

socket.on('connect', () => console.log('Connected to Socket.IO'));
socket.on('disconnect', () => console.log('Disconnected from Socket.IO'));
socket.on('connectionStatus', (data) => console.log('Connection Status:', data));
socket.on('messageStatus', (data) => {
  const index = messages.value.findIndex(m => m.id === data.id);
  if (index !== -1) {
    messages.value[index].status = data.status;
    if (data.error) messages.value[index].error = data.error;
  } else if (data.status === 'queued') {
    messages.value.unshift({ id: data.id, status: data.status });
  }
});
socket.on('qrCode', (data) => {
  qrCode.value = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.qr)}`;
});

const onSubmit = async () => {
  error.value = null;
  const valid = await validateForm();
  if (!valid) return;

  isSubmitting.value = true;
  try {
    const payload = {
      recipient: form.value.recipient,
      content: form.value.content,
    };
    if (form.value.templateId) {
      payload.templateId = form.value.templateId;
    }
    const response = await api.post('/messages', payload);
    form.value.recipient = '';
    form.value.content = '';
    form.value.templateId = null;
    r$.$reset();
    await fetchMessages(); // Refresh messages to include new one
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to send message';
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  if (!authStore.token) {
    router.push('/login');
    return;
  }
  fetchTemplates();
  fetchMessages();
});
</script>

<style>
.qr-code img {
  margin-top: 10px;
}
</style>

// +6281275946124