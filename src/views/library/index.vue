<script setup lang="ts">
import { computed, ref } from 'vue';
import { NIcon } from 'naive-ui';
import {
  VideoClip16Filled,
  MusicNote220Filled,
  Image24Filled,
  TextField24Regular,
  VideoSwitch24Filled
} from '@vicons/fluent';
import { WebCutExtensionPack, WebCutThingType } from '../../types';
import { useT, useWebCutLocale } from '../../i18n/hooks';
import { useWebCutContext } from '../../hooks';

import VideoPanel from './video/index.vue';
import AudioPanel from './audio/index.vue';
import ImagePanel from './image/index.vue';
import TextPanel from './text/index.vue';
import TransitionPanel from './transition/index.vue';

const activeTab = ref<string>('video');
const t = useT();
const { modules } = useWebCutContext();
useWebCutLocale();

const coreTabs = computed(() => [
  {
    key: 'video',
    label: t('视频'),
    icon: VideoClip16Filled,
    component: VideoPanel,
  },
  {
    key: 'audio',
    label: t('音频'),
    icon: MusicNote220Filled,
    component: AudioPanel,
  },
  {
    key: 'image',
    label: t('图片'),
    icon: Image24Filled,
    component: ImagePanel,
  },
  {
    key: 'text',
    label: t('文本'),
    icon: TextField24Regular,
    component: TextPanel,
  },
  {
    key: 'transition',
    label: t('转场'),
    icon: VideoSwitch24Filled,
    component: TransitionPanel,
  },
]);

const extensionTabs = computed<NonNullable<WebCutExtensionPack['materialConfig']>[]>(() => {
  return [...modules.value.values()].filter((item) => item.materialConfig).map(item => item.materialConfig) as any;
});

const libraryTabs = computed(() => [
  ...coreTabs.value,
  ...extensionTabs.value.map((cfg) => ({
    key: cfg.name,
    label: t(cfg.displayName),
    icon: cfg.icon,
    component: cfg.libraryComponent,
  })),
]);

const activePanel = computed(() => libraryTabs.value.find(item => item.key === activeTab.value) || libraryTabs.value[0]);

function handleTabChange(key: string) {
  activeTab.value = key as WebCutThingType;
}
</script>

<template>
  <div class="webcut-library">
    <div class="webcut-library-rail">
      <button
        v-for="item in libraryTabs"
        :key="item.key"
        :class="['webcut-library-tab', { 'webcut-library-tab--active': activeTab === item.key }]"
        type="button"
        @click="handleTabChange(item.key)"
      >
        <n-icon :component="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </div>
    <div class="webcut-library-panel">
      <component :is="activePanel.component" v-if="activePanel" />
    </div>
  </div>
</template>

<style scoped lang="less">
.webcut-library {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  background-color: var(--webcut-background-color);
}

.webcut-library-rail {
  width: 76px;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px;
  overflow-y: auto;
  box-sizing: border-box;
  border-right: 1px solid var(--webcut-line-color);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--webcut-thumb-color) 72%, transparent), transparent 28%),
    var(--webcut-background-color);
}

.webcut-library-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background-color: var(--webcut-background-color);
}

.webcut-library-tab {
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--text-color-base);
  padding: 10px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease, transform .2s ease;

  span {
    font-size: var(--webcut-font-size-tiny);
    line-height: 1.15;
    text-align: center;
    word-break: break-word;
  }

  :deep(.n-icon) {
    font-size: var(--webcut-font-size-large);
  }
}

.webcut-library-tab:hover {
  background-color: color-mix(in srgb, var(--webcut-rail-hover-bg-color) 70%, transparent);
}

.webcut-library-tab--active {
  color: var(--webcut-primary-color);
  border-color: color-mix(in srgb, var(--webcut-primary-color) 22%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--webcut-primary-color) 13%, transparent), transparent),
    color-mix(in srgb, var(--webcut-rail-hover-bg-color) 92%, transparent);
  transform: translateX(2px);
}
</style>
