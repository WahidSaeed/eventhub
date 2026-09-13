<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import { categoryMeta, coverGradient } from '../utils/categories';

const props = defineProps({
  category: { type: String, default: 'other' },
  seed: { type: String, default: '' },
  size: { type: String, default: 'md' }
});

const meta = computed(() => categoryMeta(props.category));
const background = computed(() => coverGradient(props.category, props.seed));
const iconClass = computed(() => ({ sm: 'h-5 w-5', md: 'h-9 w-9', lg: 'h-20 w-20' })[props.size] || 'h-9 w-9');
</script>

<template>
  <div class="cover" :style="{ background }" aria-hidden="true">
    <Icon :name="meta.icon" :class="iconClass" :stroke-width="size === 'lg' ? 1.25 : 1.75" />
  </div>
</template>
