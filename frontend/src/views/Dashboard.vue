<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {{ authStore.user?.email }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div>
              <Label>JWT Token</Label>
              <Input :value="authStore.token" readonly class="mt-1 h-24" />
              <Button class="mt-2" @click="authStore.refreshToken">Refresh Token</Button>
            </div>
            <div>
              <Label>WhatsApp QR Code</Label>
              <div class="mt-2 flex flex-col items-center">
                <Alert v-if="error" variant="destructive" class="mb-4 w-full">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
                <div v-if="loading" class="text-muted-foreground text-sm">
                  Loading QR code...
                </div>
                <div v-else-if="qrImage" class="flex flex-col items-center">
                  <img :src="qrImage" alt="WhatsApp QR Code" class="w-64 h-64" />
                  <p class="text-muted-foreground text-sm mt-2">{{ qrMessage }}</p>
                </div>
                <div v-else-if="isConnected" class="text-primary text-sm">
                  WhatsApp is connected!
                  <Button class="mt-2" variant="destructive" @click="disconnectWhatsApp">
                    Disconnect WhatsApp
                  </Button>
                </div>
                <div v-else class="text-muted-foreground text-sm">
                  Waiting for QR code generation...
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../utils/api';
import AppLayout from '../components/AppLayout.vue';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Alert from '@/components/ui/alert/Alert.vue';
import AlertTitle from '@/components/ui/alert/AlertTitle.vue';
import AlertDescription from '@/components/ui/alert/AlertDescription.vue';

const authStore = useAuthStore();
const router = useRouter();
const qrImage = ref(null);
const qrMessage = ref('');
const isConnected = ref(false);
const loading = ref(true);
const error = ref(null);
let pollInterval = null;

const fetchQrCode = async () => {
  try {
    const response = await api.get('/whatsapp/qr');
    const { status, qr, message } = response.data;
    // console.log('QR response:', response.data);
    loading.value = false;
    error.value = null;

    if (status === 'connected') {
      isConnected.value = true;
      qrImage.value = null;
      qrMessage.value = '';
    } else if (status === 'qr') {
      isConnected.value = false;
      qrImage.value = qr;
      qrMessage.value = message;
    } else {
      isConnected.value = false;
      qrImage.value = null;
      qrMessage.value = message;
    }
  } catch (err) {
    console.error('QR fetch error:', err);
    loading.value = false;
    error.value = err.response?.data?.error || 'Failed to fetch QR code';
  }
};

const checkStatus = async () => {
  try {
    const response = await api.get('/whatsapp/status');
    const { isConnected: connected } = response.data;
    console.log('Status:', response.data);
    if (connected !== isConnected.value) {
      isConnected.value = connected;
      if (connected) {
        qrImage.value = null;
        qrMessage.value = '';
        clearInterval(pollInterval);
        pollInterval = null;
      } else {
        await fetchQrCode();
      }
    }
  } catch (err) {
    console.error('Status check error:', err);
    error.value = err.response?.data?.error || 'Failed to check status';
  }
};

const disconnectWhatsApp = async () => {
  try {
    await api.post('/whatsapp/disconnect');
    isConnected.value = false;
    qrImage.value = null;
    qrMessage.value = '';
    loading.value = true;
    await fetchQrCode();
    pollInterval = setInterval(checkStatus, 15000); // Increased to 15s post-disconnect
  } catch (err) {
    console.error('Disconnect error:', err);
    error.value = err.response?.data?.error || 'Failed to disconnect WhatsApp';
  }
};

onMounted(async () => {
  if (!authStore.token) {
    router.push('/login');
    return;
  }
  await fetchQrCode();
  if (!isConnected.value) {
    pollInterval = setInterval(checkStatus, 15000); // Increased to 15s
  }
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>