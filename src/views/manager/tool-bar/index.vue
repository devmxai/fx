<script setup lang="ts">
import WebCutManagerScaler from '../scaler/index.vue';
import ClearTool from '../../tools/clear/index.vue';
import DeleteTool from '../../tools/delete/index.vue';
import SplitTool from '../../tools/split/index.vue';
import SplitKeepLeft from '../../tools/split-keep-left/index.vue';
import SplitKeepRight from '../../tools/split-keep-right/index.vue';
import FlipH from '../../tools/flip-h/index.vue';
import Concat from '../../tools/concat/index.vue';
import { DividerTall16Regular } from '@vicons/fluent';
import { NIcon } from 'naive-ui';

const props = defineProps<{
    asideWidth?: number | string;
}>();
</script>

<template>
    <div class="webcut-manager-tools-bar" :style="{
        '--webcut-manager-aside-width': props.asideWidth && typeof props.asideWidth === 'number' ? props.asideWidth + 'px' : props.asideWidth,
    }">
        <div class="webcut-manager-tools-bar-right">
            <SplitTool></SplitTool>
            <SplitKeepRight></SplitKeepRight>
            <SplitKeepLeft></SplitKeepLeft>
            <DeleteTool></DeleteTool>
            <n-icon :component="DividerTall16Regular" class="webcut-divider-icon"></n-icon>
            <ClearTool></ClearTool>
            <FlipH></FlipH>
            <Concat></Concat>
            <slot name="middle"></slot>
            <span style="margin:auto"></span>
            <slot name="right"></slot>
            <WebCutManagerScaler></WebCutManagerScaler>
        </div>
    </div>
</template>

<style scoped>
.webcut-manager-tools-bar {
    display: flex;
    align-items: center;
    height: 46px;
    border-bottom: 1px solid var(--webcut-ui-divider-color, var(--webcut-line-color));
}
.webcut-manager-tools-bar-right {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 8px;
}
.webcut-manager-tools-bar-right :deep(.webcut-tool-button) {
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
.webcut-manager-tools-bar-right :deep(.webcut-tool-button:hover) {
    border-color: color-mix(in srgb, var(--webcut-primary-color) 28%, var(--webcut-line-color) 72%);
}
.webcut-manager-tools-bar-right :deep(.webcut-tool-button .n-icon),
.webcut-manager-tools-bar-right :deep(.webcut-tool-button .n-button__icon),
.webcut-manager-tools-bar-right :deep(.webcut-tool-button .n-button__content) {
    color: color-mix(in srgb, var(--text-color-base) 74%, var(--webcut-background-color) 26%);
}
.webcut-manager-tools-bar-right :deep(.webcut-tool-button .n-icon) {
    font-size: 18px !important;
}
.webcut-manager-tools-bar-right :deep(.webcut-tool-button:disabled) {
    opacity: .55;
}
.webcut-divider-icon {
    font-size: var(--webcut-font-size-large);
    opacity: .1;
}
</style>
