<script setup lang="ts">
import { computed } from 'vue';
import type { WebCutRail, WebCutSegment } from 'webcut';
import { useWebCutContext, useWebCutLocalFile } from 'webcut';

const props = defineProps<{
  segment: WebCutSegment;
  rail: WebCutRail;
  railIndex: number;
  segmentIndex: number;
  segments: WebCutSegment[];
}>();

const { fileUrl } = useWebCutLocalFile();
const { sources } = useWebCutContext();
const source = computed(() => {
  return sources.value.get(props.segment.sourceKey);
});
</script>

<template>
  <div
    class="lipsync-segment"
    :style="{
      backgroundImage: `url(${source?.fileId ? fileUrl(source.fileId) : source?.url})`,
    }"
  />
</template>

<style scoped>
.lipsync-segment {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  background-repeat: repeat-x;
  background-size: contain;
  background-position: center;
  background-color: color-mix(in srgb, var(--webcut-manager-segment-bg-color) 88%, transparent);
}
</style>
