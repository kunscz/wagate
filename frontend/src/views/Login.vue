<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-800">
    <Card class="w-full max-w-md p-8">
      <CardHeader class="text-center">
        <CardTitle class="text-xl font-bold text-primary">WhatsApp Gateway</CardTitle>
        <CardDescription class="text-muted-foreground text-sm">Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="onSubmit" autocomplete="off">
          <div class="space-y-6">
            <div>
              <Label for="email" class="text-lg font-medium text-white">Email</Label>
              <Input
                id="email"
                type="email"
                v-model="form.email"
                placeholder="Enter email@example.com"
                class="mt-1"
                :class="{ 'border-destructive': r$.$fields.email.$errors.length }"
                @blur="validateField('email')"
              />
              <p v-for="error in r$.$fields.email.$errors" :key="error.message" class="text-destructive text-sm mt-1">
                {{ error.message }}
              </p>
            </div>
            <div>
              <Label for="password" class="text-lg font-medium text-white">Password</Label>
              <Input
                id="password"
                type="password"
                v-model="form.password"
                placeholder="••••••••"
                class="mt-1"
                :class="{ 'border-destructive': r$.$fields.password.$errors.length }"
                @blur="validateField('password')"
              />
              <p v-for="error in r$.$fields.password.$errors" :key="error.message" class="text-destructive text-sm mt-1">
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
              {{ isSubmitting ? 'Logging in...' : 'Login' }}
            </Button>
            <p v-if="isInvalid && isAllTouched" class="text-destructive text-sm text-center">
              Please fill out the form correctly.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Card from '@/components/ui/card/Card.vue';
import CardHeader from '@/components/ui/card/CardHeader.vue';
import CardTitle from '@/components/ui/card/CardTitle.vue';
import CardDescription from '@/components/ui/card/CardDescription.vue';
import CardContent from '@/components/ui/card/CardContent.vue';
import Input from '@/components/ui/input/Input.vue';
import Label from '@/components/ui/label/Label.vue';
import Button from '@/components/ui/button/Button.vue';
import Alert from '@/components/ui/alert/Alert.vue';
import AlertTitle from '@/components/ui/alert/AlertTitle.vue';
import AlertDescription from '@/components/ui/alert/AlertDescription.vue';
import { useRegle } from '@regle/core';
import { required, email, minLength, withMessage } from '@regle/rules';

const router = useRouter();
const authStore = useAuthStore();

const form = ref({
  email: '',
  password: '',
});

const isSubmitting = ref(false);
const error = ref(null);

const { r$ } = useRegle(form, {
  email: {
    required: withMessage(required, 'Missing email'),
    email: withMessage(email, 'Try a valid email?'),
  },
  password: {
    required: withMessage(required, 'Missing password'),
    minLength: withMessage(minLength(6), ({ $params: [min] }) => `Password needs ${min} characters`),
  },
});

const isInvalid = computed(() => !r$.$fields.email.$valid || !r$.$fields.password.$valid);
const isAllTouched = computed(() => r$.$fields.email.$touched && r$.$fields.password.$touched);

const validateField = async (field) => {
  r$.$fields[field].$touch();
  await nextTick();
};

const validateForm = async () => {
  r$.$fields.email.$touch();
  r$.$fields.password.$touch();
  await nextTick();
  return r$.$fields.email.$errors.length === 0 && r$.$fields.password.$errors.length === 0;
};

const onSubmit = async () => {
  error.value = null;
  const valid = await validateForm();
  if (!valid) return;

  isSubmitting.value = true;
  try {
    await authStore.login(form.value.email, form.value.password);
  } catch (err) {
    error.value = err;
  } finally {
    isSubmitting.value = false;
  }
};
</script>