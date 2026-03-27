<script setup lang="ts">
import { NSplit, NButton, NIcon } from 'naive-ui';
import WebCutProvider from '../provider/index.vue';
import WebCutPlayerScreen from '../player/screen.vue';
import WebCutPlayerButton from '../player/button.vue';
import WebCutManager from '../manager/index.vue';
import { useWebCutContext, useWebCutPlayer, useWebCutThemeColors, useWebCutDarkMode } from '../../hooks';
import WebCutSelectAspectRatio from '../select-aspect-ratio/index.vue';
import WebCutTimeClock from '../time-clock/index.vue';
import WebCutLibrary from '../library/index.vue';
import Panel from '../panel/index.vue';
import { WebCutColors, WebCutExtensionPack } from '../../types';
import { useWebCutLocale } from '../../i18n/hooks';
import WebCutToast from '../toast/index.vue';
import AdvancedExport from '../../modules/advanced-export/index.vue';
import WebCutTextEditPanel from '../panel/text/contenteditable.vue';
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import HistoryRecover from '../tools/history-recover/index.vue';
import UndoTool from '../tools/undo/index.vue';
import RedoTool from '../tools/redo/index.vue';
import { Add, Subtract, FitToScreen, Export } from '@vicons/carbon';

const initialViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
const isDesktopViewport = initialViewportWidth >= 1280;
const editorTopPaneDefaultSize = isDesktopViewport ? 0.66 : 0.8;
const editorTopPaneMaxSize = isDesktopViewport ? 0.86 : 0.8;

const darkMode = defineModel<boolean | null | undefined>('darkMode', { default: null });
const language = defineModel<string | null | undefined>('language', { default: null });
const props = defineProps<{
    projectId?: string;
    colors?: Partial<WebCutColors>;
    /** 是否禁用顶部右侧栏 */
    disableTopRightBar?: boolean;
    packs?: (new () => WebCutExtensionPack)[];
}>();

const { registerExtensionPack } = useWebCutContext(() => props.projectId ? { id: props.projectId } : undefined);
useWebCutThemeColors(() => props.colors);
useWebCutDarkMode(darkMode);
useWebCutLocale(language);

if (props.packs) {
    props.packs.forEach(mod => registerExtensionPack(mod));
}

const { resize, play, pause } = useWebCutPlayer();
const { status, player } = useWebCutContext();

const manager = ref();
function handleResized() {
    manager.value?.resizeHeight();
}

const previewPercentLabel = computed(() => {
    return `${player.value?.previewPercent ?? 100}%`;
});

function handlePreviewZoomOut() {
    player.value?.zoomOut?.();
}

function handlePreviewZoomIn() {
    player.value?.zoomIn?.();
}

function handlePreviewFit() {
    player.value?.fitPreview?.();
}

function handlePreviewActualSize() {
    player.value?.actualSizePreview?.();
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const tagName = target.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
        return true;
    }

    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
        return true;
    }

    return false;
}

function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.code !== 'Space') {
        return;
    }

    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }

    if (isEditableTarget(event.target)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (status.value === 1) {
        pause();
        return;
    }

    play();
}

onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown, true);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown, true);
});
</script>

<template>
    <WebCutProvider>
        <slot name="header"></slot>
        <div class="webcut-editor">
            <div class="webcut-editor-app-bar">
                <div class="webcut-editor-app-bar__section webcut-editor-app-bar__section--left">
                    <div class="webcut-editor-history-tools">
                        <HistoryRecover />
                        <UndoTool />
                        <RedoTool />
                    </div>
                </div>

                <div class="webcut-editor-app-bar__section webcut-editor-app-bar__section--center">
                    <div class="webcut-editor-preview-controls">
                        <n-button quaternary circle :focusable="false" @click="handlePreviewZoomOut">
                            <template #icon>
                                <n-icon><Subtract /></n-icon>
                            </template>
                        </n-button>
                        <div class="webcut-editor-preview-controls__label">{{ previewPercentLabel }}</div>
                        <n-button quaternary circle :focusable="false" @click="handlePreviewZoomIn">
                            <template #icon>
                                <n-icon><Add /></n-icon>
                            </template>
                        </n-button>
                        <button class="webcut-editor-preview-controls__pill" type="button" @click="handlePreviewFit">
                            <n-icon size="14"><FitToScreen /></n-icon>
                            <span>Fit</span>
                        </button>
                        <button class="webcut-editor-preview-controls__pill" type="button" @click="handlePreviewActualSize">100%</button>
                    </div>
                </div>

                <div class="webcut-editor-app-bar__section webcut-editor-app-bar__section--right" v-if="!props.disableTopRightBar">
                    <AdvancedExport>
                        <template #trigger="{ open }">
                            <n-button
                                quaternary
                                circle
                                class="webcut-editor-app-bar__icon-button"
                                :focusable="false"
                                @click="open"
                            >
                                <template #icon>
                                    <n-icon size="16">
                                        <Export />
                                    </n-icon>
                                </template>
                            </n-button>
                        </template>
                    </AdvancedExport>
                </div>
            </div>
            <n-split
                direction="vertical"
                :default-size="editorTopPaneDefaultSize"
                min="400px"
                :max="editorTopPaneMaxSize"
                @update:size="handleResized"
            >
                <template #1>
                    <n-split default-size="360px" min="360px" max="360px" disabled @update:size="resize">
                        <template #1>
                            <div class="webcut-editor-left-side">
                                <WebCutLibrary></WebCutLibrary>
                            </div>
                        </template>
                        <template #2>
                            <n-split :default-size="0.75" :min="0.6" :max="0.75" @update:size="resize">
                                <template #1>
                                    <div class="webcut-editor-video-player-container">
                                        <WebCutPlayerScreen class="webcut-editor-video-player">
                                            <WebCutTextEditPanel></WebCutTextEditPanel>
                                        </WebCutPlayerScreen>
                                    </div>
                                    <div class="webcut-editor-video-player-buttons">
                                        <div class="webcut-editor-video-player-buttons-left">
                                            <WebCutTimeClock></WebCutTimeClock>
                                        </div>
                                        <WebCutPlayerButton></WebCutPlayerButton>
                                        <div class="webcut-editor-video-player-buttons-right">
                                            <WebCutSelectAspectRatio display-aspect></WebCutSelectAspectRatio>
                                        </div>
                                    </div>
                                </template>
                                <template #2>
                                    <div class="webcut-editor-right-side">
                                        <div class="webcut-editor-right-side-main">
                                            <Panel></Panel>
                                        </div>
                                    </div>
                                </template>
                                <template #resize-trigger>
                                    <div class="webcut-editor-split-resize-trigger--vertical"></div>
                                </template>
                            </n-split>
                        </template>
                        <template #resize-trigger>
                            <div class="webcut-editor-split-resize-trigger--vertical"></div>
                        </template>
                    </n-split>
                </template>
                <template #2>
                    <div class="webcut-editor-bottom-side">
                        <WebCutManager ref="manager" />
                    </div>
                </template>
                <template #resize-trigger>
                    <div class="webcut-editor-split-resize-trigger--horizontal"></div>
                </template>
            </n-split>
        </div>
        <slot name="footer"></slot>
        <WebCutToast></WebCutToast>
    </WebCutProvider>
</template>

<style scoped lang="less">
.webcut-editor {
    position: relative;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    --webcut-ui-divider-color: color-mix(in srgb, var(--webcut-line-color) 94%, var(--webcut-background-color) 6%);
}
.webcut-editor :deep(.n-split) {
    min-height: 0;
}
.webcut-editor-app-bar {
    min-height: 40px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--webcut-ui-divider-color);
    background: var(--webcut-background-color);
}
.webcut-editor-app-bar__section {
    display: flex;
    align-items: center;
    min-width: 0;
}
.webcut-editor-app-bar__section--left {
    justify-content: flex-start;
}
.webcut-editor-app-bar__section--center {
    justify-content: center;
}
.webcut-editor-app-bar__section--right {
    justify-content: flex-end;
}
.webcut-editor-history-tools {
    display: flex;
    align-items: center;
    gap: 8px;
}
.webcut-editor-history-tools :deep(.webcut-tool-button),
.webcut-editor-app-bar__icon-button {
    width: 38px;
    height: 38px;
    min-width: 38px;
    padding: 0;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--webcut-line-color) 58%, var(--webcut-background-color) 42%);
    background: color-mix(in srgb, var(--webcut-thumb-color) 14%, var(--webcut-background-color) 86%);
    color: color-mix(in srgb, var(--text-color-base) 74%, var(--webcut-background-color) 26%);
    box-shadow: none;
}
.webcut-editor-history-tools :deep(.webcut-tool-button:hover),
.webcut-editor-app-bar__icon-button:hover {
    border-color: color-mix(in srgb, var(--webcut-primary-color) 28%, var(--webcut-line-color) 72%);
}
.webcut-editor-history-tools :deep(.webcut-tool-button .n-icon),
.webcut-editor-history-tools :deep(.webcut-tool-button .n-button__icon),
.webcut-editor-history-tools :deep(.webcut-tool-button .n-button__content),
.webcut-editor-app-bar__icon-button :deep(.n-icon),
.webcut-editor-app-bar__icon-button :deep(.n-button__icon),
.webcut-editor-app-bar__icon-button :deep(.n-button__content) {
    color: color-mix(in srgb, var(--text-color-base) 74%, var(--webcut-background-color) 26%);
}
.webcut-editor-history-tools :deep(.webcut-tool-button .n-icon) {
    font-size: 18px !important;
}
.webcut-editor-history-tools :deep(.webcut-tool-button:disabled),
.webcut-editor-app-bar__icon-button:disabled {
    opacity: .55;
}
.webcut-editor-preview-controls {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
}
.webcut-editor-preview-controls :deep(.n-button),
.webcut-editor-preview-controls__label,
.webcut-editor-preview-controls__pill {
    height: 38px;
    min-height: 38px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--webcut-line-color) 58%, var(--webcut-background-color) 42%);
    background: color-mix(in srgb, var(--webcut-thumb-color) 14%, var(--webcut-background-color) 86%);
    color: color-mix(in srgb, var(--text-color-base) 74%, var(--webcut-background-color) 26%);
    box-shadow: none;
}
.webcut-editor-preview-controls :deep(.n-button) {
    width: 38px;
    min-width: 38px;
    padding: 0;
}
.webcut-editor-preview-controls :deep(.n-button:hover),
.webcut-editor-preview-controls__label:hover,
.webcut-editor-preview-controls__pill:hover {
    border-color: color-mix(in srgb, var(--webcut-primary-color) 28%, var(--webcut-line-color) 72%);
}
.webcut-editor-preview-controls :deep(.n-button .n-icon),
.webcut-editor-preview-controls :deep(.n-button .n-button__icon),
.webcut-editor-preview-controls :deep(.n-button .n-button__content) {
    color: color-mix(in srgb, var(--text-color-base) 74%, var(--webcut-background-color) 26%);
}
.webcut-editor-preview-controls__label,
.webcut-editor-preview-controls__pill {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
}
.webcut-editor-preview-controls__label {
    min-width: 74px;
    padding: 6px 12px;
}
.webcut-editor-preview-controls__pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 84px;
    justify-content: center;
    padding: 6px 14px;
}
.webcut-editor-split-resize-trigger--horizontal {
    width: 100%;
    height: 8px;
    cursor: row-resize;
    position: relative;
    background-color: transparent;
}
.webcut-editor-split-resize-trigger--horizontal::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 1px;
    transform: translateY(-50%);
    background-color: var(--webcut-ui-divider-color);
}
.webcut-editor-split-resize-trigger--vertical {
    height: 100%;
    width: 1px;
    background-color: var(--webcut-ui-divider-color);
}
.webcut-editor-video-player-container {
    height: calc(100% - 56px);
    width: calc(100% - 32px);
    margin: 16px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.webcut-editor-video-player {
    height: 100%;
    width: 100%;
}
.webcut-editor-video-player-buttons {
    height: 24px;
    width: calc(100% - 32px);
    margin: 8px 16px;
    margin-top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}
.webcut-editor-video-player-buttons-right,
.webcut-editor-video-player-buttons-left {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    opacity: .6;
}
.webcut-editor-video-player-buttons-right {
    right: 0;
}
.webcut-editor-video-player-buttons-left {
    left: 0;
}
.webcut-editor-right-side {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.webcut-editor-right-side-main {
    flex: 1;
    overflow: auto;
}
.webcut-editor-bottom-side {
    height: 100%;
}
.webcut-editor-left-side {
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    border-right: 1px solid var(--webcut-ui-divider-color);
}

@media (max-width: 980px) {
    .webcut-editor-app-bar {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .webcut-editor-app-bar__section--left,
    .webcut-editor-app-bar__section--center,
    .webcut-editor-app-bar__section--right {
        justify-content: center;
    }

    .webcut-editor-preview-controls {
        flex-wrap: wrap;
        justify-content: center;
    }
}
</style>
