<script setup>
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'; // Assuming Vue components
import { Settings, Check } from 'lucide-vue-next';

const props = defineProps({
  track: { type: Object, required: true },
  activeSource: { type: Object, default: null },
  pluginOptions: { type: Array, default: () => [] },
  activePluginOptionId: { type: String, default: null },
});

const emit = defineEmits(['selectSource', 'selectPluginOption']);

const hasHlsLevels = computed(() => props.activeSource?.format === 'hls' && props.pluginOptions.length > 0);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" title="Quality & Source">
        <Settings class="h-5 w-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-[200px]">
      <DropdownMenuLabel>Source</DropdownMenuLabel>
      <DropdownMenuItem v-for="source in track.sources" :key="source.src" @click="emit('selectSource', source)">
        <span class="flex-1">{{ source.quality || `${source.format} (${source.mediaType})` }}</span>
        <Check v-if="activeSource?.src === source.src" class="h-4 w-4 ml-2" />
      </DropdownMenuItem>
      <template v-if="hasHlsLevels">
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Quality (HLS)</DropdownMenuLabel>
        <DropdownMenuItem v-for="option in pluginOptions" :key="option.id" @click="emit('selectPluginOption', option.id)">
          <span class="flex-1">{{ option.label }}</span>
          <Check v-if="activePluginOptionId === option.id" class="h-4 w-4 ml-2" />
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
