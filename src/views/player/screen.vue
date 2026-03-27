<script setup lang="ts">
import { watch, ref, watchEffect, onBeforeUnmount, onMounted, inject, computed } from 'vue';
import { useWebCutPlayer, useWebCutContext } from '../../hooks';
import { Evt } from '../../libs/evt';

const props = defineProps<{
    /** 最大宽度 */
    maxWidth?: number;
    /** 最大高度 */
    maxHeight?: number;
}>();

const { viewport, width, height, player, editTextState, currentSource } = useWebCutContext();
const { init, destroy } = useWebCutPlayer();
const canvasSizeRef = inject<any>('videoCanvasSizeRef', null);

const box = ref();
const canvasScale = ref(1);
const previewZoom = ref(1);
const previewOffsetX = ref(0);
const previewOffsetY = ref(0);
const boxWidth = ref(0);
const boxHeight = ref(0);

const PREVIEW_MIN_ZOOM = 0.5;
const PREVIEW_MAX_ZOOM = 12;
const PREVIEW_EDGE_MARGIN = 48;

let syncFrame = 0;
let mousePanCleanup: (() => void) | null = null;
let touchPinchState: {
    startZoom: number;
    startDistance: number;
    contentX: number;
    contentY: number;
} | null = null;

const isOnlySelectable = computed(() => {
    if (!currentSource.value) {
        return false;
    }
    const { sprite } = currentSource.value;
    return sprite.interactable === 'selectable';
});

watch(viewport, (el) => {
    if (el) {
        init();
    }
    else {
        destroy();
    }
}, { immediate: true });

function fitBoxSize() {
    if (!box.value) {
        return;
    }

    const canvasWidth = width.value;
    const canvasHeight = height.value;

    const { width: outerWidth, height: outerHeight } = box.value.getBoundingClientRect();
    boxWidth.value = outerWidth;
    boxHeight.value = outerHeight;
    const scale = Math.min(
        outerWidth / canvasWidth,
        outerHeight / canvasHeight,
        props.maxWidth ? props.maxWidth / canvasWidth : 1,
        props.maxHeight ? props.maxHeight / canvasHeight : 1,
    );
    canvasScale.value = scale;
    queuePreviewSync();
}

watchEffect(fitBoxSize);
watch([width, height], () => {
    fitPreview();
});

const effectiveCanvasScale = computed(() => canvasScale.value * previewZoom.value);
const renderedWidth = computed(() => width.value * effectiveCanvasScale.value);
const renderedHeight = computed(() => height.value * effectiveCanvasScale.value);
const viewportLeft = computed(() => ((boxWidth.value - renderedWidth.value) / 2) + previewOffsetX.value);
const viewportTop = computed(() => ((boxHeight.value - renderedHeight.value) / 2) + previewOffsetY.value);
const previewPercent = computed(() => Math.max(1, Math.round(effectiveCanvasScale.value * 100)));

function clampZoom(zoom: number) {
    return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, zoom));
}

function clampPreviewOffsets(nextX: number, nextY: number) {
    if (!boxWidth.value || !boxHeight.value || !renderedWidth.value || !renderedHeight.value) {
        return { x: nextX, y: nextY };
    }

    const baseLeft = (boxWidth.value - renderedWidth.value) / 2;
    const baseTop = (boxHeight.value - renderedHeight.value) / 2;

    const minX = PREVIEW_EDGE_MARGIN - baseLeft - renderedWidth.value;
    const maxX = boxWidth.value - PREVIEW_EDGE_MARGIN - baseLeft;
    const minY = PREVIEW_EDGE_MARGIN - baseTop - renderedHeight.value;
    const maxY = boxHeight.value - PREVIEW_EDGE_MARGIN - baseTop;

    return {
        x: Math.min(maxX, Math.max(minX, nextX)),
        y: Math.min(maxY, Math.max(minY, nextY)),
    };
}

function queuePreviewSync() {
    if (syncFrame) {
        return;
    }

    syncFrame = window.requestAnimationFrame(() => {
        syncFrame = 0;
        if (canvasSizeRef && viewport.value) {
            const { width, height } = viewport.value.getBoundingClientRect();
            // @ts-ignore
            canvasSizeRef.value = {
                width,
                height,
            };
        }
        evt.emit('previewchange', {
            zoom: previewZoom.value,
            scale: effectiveCanvasScale.value,
            percent: previewPercent.value,
        });
    });
}

watch([previewZoom, previewOffsetX, previewOffsetY, canvasScale], queuePreviewSync);

function getBoxRect() {
    return box.value?.getBoundingClientRect() || null;
}

function getViewportRect() {
    return viewport.value?.getBoundingClientRect() || null;
}

function getAnchorInBox(anchor?: { clientX: number; clientY: number }) {
    const rect = getBoxRect();
    if (!rect) {
        return null;
    }
    if (!anchor) {
        return {
            x: rect.width / 2,
            y: rect.height / 2,
            rect,
        };
    }
    return {
        x: anchor.clientX - rect.left,
        y: anchor.clientY - rect.top,
        rect,
    };
}

function zoomTo(nextZoom: number, anchor?: { clientX: number; clientY: number }) {
    const point = getAnchorInBox(anchor);
    if (!point || !width.value || !height.value || !canvasScale.value) {
        previewZoom.value = clampZoom(nextZoom);
        return;
    }

    const zoom = clampZoom(nextZoom);
    if (Math.abs(zoom - previewZoom.value) < 0.0001) {
        return;
    }

    const previousScale = effectiveCanvasScale.value;
    const previousRenderedWidth = width.value * previousScale;
    const previousRenderedHeight = height.value * previousScale;
    const previousBaseLeft = (point.rect.width - previousRenderedWidth) / 2;
    const previousBaseTop = (point.rect.height - previousRenderedHeight) / 2;

    const contentX = (point.x - (previousBaseLeft + previewOffsetX.value)) / previousScale;
    const contentY = (point.y - (previousBaseTop + previewOffsetY.value)) / previousScale;

    previewZoom.value = zoom;

    const nextScale = canvasScale.value * zoom;
    const nextRenderedWidth = width.value * nextScale;
    const nextRenderedHeight = height.value * nextScale;
    const nextBaseLeft = (point.rect.width - nextRenderedWidth) / 2;
    const nextBaseTop = (point.rect.height - nextRenderedHeight) / 2;

    const nextOffsetX = point.x - nextBaseLeft - (contentX * nextScale);
    const nextOffsetY = point.y - nextBaseTop - (contentY * nextScale);
    const clamped = clampPreviewOffsets(nextOffsetX, nextOffsetY);
    previewOffsetX.value = clamped.x;
    previewOffsetY.value = clamped.y;
}

function zoomIn(anchor?: { clientX: number; clientY: number }) {
    zoomTo(previewZoom.value * 1.12, anchor);
}

function zoomOut(anchor?: { clientX: number; clientY: number }) {
    zoomTo(previewZoom.value / 1.12, anchor);
}

function fitPreview() {
    previewZoom.value = 1;
    previewOffsetX.value = 0;
    previewOffsetY.value = 0;
    queuePreviewSync();
}

function actualSizePreview() {
    if (!canvasScale.value) {
        return;
    }
    previewZoom.value = clampZoom(1 / canvasScale.value);
    previewOffsetX.value = 0;
    previewOffsetY.value = 0;
    queuePreviewSync();
}

function screenToCanvasPoint(clientX: number, clientY: number) {
    const rect = getViewportRect();
    if (!rect || !width.value || !height.value) {
        return null;
    }

    return {
        x: ((clientX - rect.left) / rect.width) * width.value,
        y: ((clientY - rect.top) / rect.height) * height.value,
    };
}

function handleWheel(event: WheelEvent) {
    if (!box.value?.contains(event.target as Node)) {
        return;
    }

    event.preventDefault();

    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomTo(previewZoom.value * factor, { clientX: event.clientX, clientY: event.clientY });
}

function handleMousePanStart(event: PointerEvent) {
    if (event.button !== 1) {
        return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startOffsetX = previewOffsetX.value;
    const startOffsetY = previewOffsetY.value;

    const handleMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const clamped = clampPreviewOffsets(
            startOffsetX + (moveEvent.clientX - startX),
            startOffsetY + (moveEvent.clientY - startY),
        );
        previewOffsetX.value = clamped.x;
        previewOffsetY.value = clamped.y;
    };

    const handleEnd = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleEnd);
        mousePanCleanup = null;
    };

    mousePanCleanup = handleEnd;
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleEnd);
}

function getTouchDistance(touchA: Touch, touchB: Touch) {
    return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
}

function getTouchMidpoint(touchA: Touch, touchB: Touch) {
    return {
        clientX: (touchA.clientX + touchB.clientX) / 2,
        clientY: (touchA.clientY + touchB.clientY) / 2,
    };
}

function handleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 2) {
        return;
    }

    const [touchA, touchB] = [event.touches[0], event.touches[1]];
    const midpoint = getTouchMidpoint(touchA, touchB);
    const anchor = getAnchorInBox(midpoint);
    if (!anchor || !effectiveCanvasScale.value) {
        return;
    }

    event.preventDefault();

    const baseLeft = (anchor.rect.width - renderedWidth.value) / 2;
    const baseTop = (anchor.rect.height - renderedHeight.value) / 2;

    touchPinchState = {
        startZoom: previewZoom.value,
        startDistance: getTouchDistance(touchA, touchB),
        contentX: (anchor.x - (baseLeft + previewOffsetX.value)) / effectiveCanvasScale.value,
        contentY: (anchor.y - (baseTop + previewOffsetY.value)) / effectiveCanvasScale.value,
    };
}

function handleTouchMove(event: TouchEvent) {
    if (!touchPinchState || event.touches.length !== 2 || !box.value || !canvasScale.value) {
        return;
    }

    event.preventDefault();

    const [touchA, touchB] = [event.touches[0], event.touches[1]];
    const midpoint = getTouchMidpoint(touchA, touchB);
    const point = getAnchorInBox(midpoint);
    if (!point) {
        return;
    }

    const currentDistance = getTouchDistance(touchA, touchB);
    const nextZoom = clampZoom((currentDistance / touchPinchState.startDistance) * touchPinchState.startZoom);
    previewZoom.value = nextZoom;

    const nextScale = canvasScale.value * nextZoom;
    const nextRenderedWidth = width.value * nextScale;
    const nextRenderedHeight = height.value * nextScale;
    const nextBaseLeft = (point.rect.width - nextRenderedWidth) / 2;
    const nextBaseTop = (point.rect.height - nextRenderedHeight) / 2;

    const nextOffsetX = point.x - nextBaseLeft - (touchPinchState.contentX * nextScale);
    const nextOffsetY = point.y - nextBaseTop - (touchPinchState.contentY * nextScale);
    const clamped = clampPreviewOffsets(nextOffsetX, nextOffsetY);
    previewOffsetX.value = clamped.x;
    previewOffsetY.value = clamped.y;
}

function handleTouchEnd() {
    if (touchPinchState) {
        touchPinchState = null;
    }
}

function preventBrowserGesture(event: Event) {
    event.preventDefault();
}

onMounted(() => {
    window.addEventListener('resize', fitBoxSize);

    if (box.value) {
        box.value.addEventListener('wheel', handleWheel, { passive: false });
        box.value.addEventListener('pointerdown', handleMousePanStart);
        box.value.addEventListener('touchstart', handleTouchStart, { passive: false });
        box.value.addEventListener('touchmove', handleTouchMove, { passive: false });
        box.value.addEventListener('touchend', handleTouchEnd);
        box.value.addEventListener('touchcancel', handleTouchEnd);
        box.value.addEventListener('gesturestart', preventBrowserGesture);
        box.value.addEventListener('gesturechange', preventBrowserGesture);
        box.value.addEventListener('gestureend', preventBrowserGesture);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', fitBoxSize);
    if (box.value) {
        box.value.removeEventListener('wheel', handleWheel);
        box.value.removeEventListener('pointerdown', handleMousePanStart);
        box.value.removeEventListener('touchstart', handleTouchStart);
        box.value.removeEventListener('touchmove', handleTouchMove);
        box.value.removeEventListener('touchend', handleTouchEnd);
        box.value.removeEventListener('touchcancel', handleTouchEnd);
        box.value.removeEventListener('gesturestart', preventBrowserGesture);
        box.value.removeEventListener('gesturechange', preventBrowserGesture);
        box.value.removeEventListener('gestureend', preventBrowserGesture);
    }
    mousePanCleanup?.();
    if (syncFrame) {
        window.cancelAnimationFrame(syncFrame);
        syncFrame = 0;
    }
    destroy();
});

const evt = new Evt();
const exports = {
    fitBoxSize,
    on: evt.on.bind(evt),
    off: evt.off.bind(evt),
    once: evt.once.bind(evt),
    emit: evt.emit.bind(evt),
    zoomTo,
    zoomIn,
    zoomOut,
    fitPreview,
    actualSizePreview,
    screenToCanvasPoint,
    getPreviewRect: getViewportRect,
    get box() {
        return box.value;
    },
    get viewport() {
        return viewport.value;
    },
    get canvasScale() {
        return effectiveCanvasScale.value;
    },
    get fitScale() {
        return canvasScale.value;
    },
    get previewZoom() {
        return previewZoom.value;
    },
    get previewPercent() {
        return previewPercent.value;
    },
    get canvasSize() {
        return canvasSizeRef?.value;
    },
};
player.value = exports;
</script>

<template>
    <div class="webcut-screen-box" ref="box" :class="{
        'webcut-screen-box--text-edit-active': editTextState?.isActive,
        'webcut-screen-box--only-selectable': isOnlySelectable,
    }">
        <div class="webcut-screen-viewport" ref="viewport" :style="{
            width: renderedWidth + 'px',
            height: renderedHeight + 'px',
            left: viewportLeft + 'px',
            top: viewportTop + 'px',
        }"></div>
        <slot></slot>
    </div>
</template>

<style scoped>
.webcut-screen-box {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none;
    overscroll-behavior: contain;
    user-select: none;
}
.webcut-screen-viewport {
    position: absolute;
    transform-origin: top left;
}
.webcut-screen-box--text-edit-active :deep(.sprite-rect) {
    display: none;
}
.webcut-screen-box :deep(.sprite-rect:has(> div[class^="ctrl-key-"] > svg)) {
    cursor: default !important;
}
.webcut-screen-box :deep(.sprite-rect > div[class^="ctrl-key-"] > svg) {
    display: none !important;
}
</style>
