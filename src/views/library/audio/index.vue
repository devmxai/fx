<script setup lang="ts">
import { useWebCutLocalFile } from '../../../hooks/local-file';
import Container from '../_shared/container.vue';

const { fileUrl } = useWebCutLocalFile();

function toggleAudio(file: any) {
    const audio = document.getElementById(file.id) as HTMLAudioElement;
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
}

function stopAudio(file: any) {
    const audio = document.getElementById(file.id) as HTMLAudioElement;
    audio.pause();
}
</script>

<template>
  <Container
    thingType="audio"
    materialType="audio"
    accept="audio/*"
    :enableMultipleSelect="true"
    @leaveListItem="stopAudio"
    @clickListItem="toggleAudio"
    supportsDirectoryUpload
  >
    <template #listItemPreview>
      <div class="webcut-audio-placeholder">
          <span class="webcut-audio-icon">🎵</span>
      </div>
    </template>
    <template #listItemContent="{ file }">
      <audio :src="fileUrl(file.id)" class="webcut-material-audio" :id="file.id"></audio>
    </template>
  </Container>
</template>

<style scoped lang="less">
@import "../../../styles/library.less";

.webcut-audio-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--webcut-thumb-color) 55%, transparent);
  cursor: default;
}

.webcut-audio-icon {
  font-size: 1.8em;
  opacity: 0.88;
}
</style>
