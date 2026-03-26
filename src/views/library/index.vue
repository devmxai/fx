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
  border-right: 1px solid var(--webcut-ui-divider-color, var(--webcut-line-color));
  background: var(--webcut-background-color);
}

.webcut-library-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background-color: var(--webcut-background-color);
}

.webcut-library-tab {
  width: 100%;
  min-height: 72px;
  border: 1px solid color-mix(in srgb, var(--webcut-line-color) 48%, var(--webcut-background-color) 52%);
  border-radius: 18px;
  background: color-mix(in srgb, var(--webcut-thumb-color) 12%, var(--webcut-background-color) 88%);
  color: color-mix(in srgb, var(--text-color-base) 66%, var(--webcut-background-color) 34%);
  padding: 8px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease;

  span {
    font-size: 11px;
    line-height: 1.15;
    text-align: center;
    word-break: break-word;
    font-weight: 600;
  }

  :deep(.n-icon) {
    font-size: 22px;
    color: inherit;
  }
}

.webcut-library-tab:hover {
  background-color: color-mix(in srgb, var(--webcut-thumb-color) 18%, var(--webcut-background-color) 82%);
  border-color: color-mix(in srgb, var(--webcut-line-color) 54%, var(--webcut-background-color) 46%);
}

.webcut-library-tab--active {
  color: color-mix(in srgb, white 90%, var(--webcut-background-color) 10%);
  border-color: color-mix(in srgb, var(--webcut-line-color) 50%, var(--webcut-background-color) 50%);
  background: color-mix(in srgb, var(--webcut-thumb-color) 22%, var(--webcut-background-color) 78%);
}

@media (max-width: 900px) {
  .webcut-library-rail {
    width: 72px;
    padding: 8px 7px;
  }

  .webcut-library-tab {
    min-height: 68px;
    border-radius: 16px;
  }
}

@media (max-width: 640px) {
  .webcut-library-rail {
    width: 64px;
    gap: 5px;
    padding: 8px 6px;
  }

  .webcut-library-tab {
    min-height: 62px;
    border-radius: 15px;
    padding: 8px 3px;

    span {
      font-size: 10px;
    }

    :deep(.n-icon) {
      font-size: 20px;
    }
  }
}
</style>
