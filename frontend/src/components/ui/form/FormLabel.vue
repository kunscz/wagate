<script setup>
import { cn } from '@/components/lib/utils';
import { Label } from '@/components/ui/label';
import { useFormField } from "./useFormField";

const props = defineProps({
  for: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: [String, Object, Function], required: false },
  class: { type: null, required: false },
});

const { error, formItemId } = useFormField();
</script>

<template>
  <Label
    data-slot="form-label"
    :data-error="!!error"
    :class="cn('data-[error=true]:text-destructive-foreground', props.class)"
    :for="formItemId"
  >
    <slot />
  </Label>
</template>
